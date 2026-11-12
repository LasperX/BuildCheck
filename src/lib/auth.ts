import 'server-only';

import { randomBytes } from 'node:crypto';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { admin, username } from 'better-auth/plugins';
import { after } from 'next/server';
import { z } from 'zod';

import * as schema from '@/db/schema';
import { db } from '@/lib/db';
import { sendResetPasswordEmail, sendVerificationEmail } from '@/lib/email';
import { isEmailVerificationRequired } from '@/lib/email-verification';
import { clientIp, hitRateLimit, peekRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { emailSchema, registerServerSchema } from '@/lib/validators/auth';

// ล็อกอินผิดได้ 5 ครั้งต่อ 15 นาที นับแยกทั้งต่อ IP และต่อบัญชี (หัวข้อ 9.1)
const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;

const loginKeys = (email: string, ip: string) => [`login:account:${email}`, `login:ip:${ip}`];
const loginEmail = (body: unknown) =>
  z.object({ email: emailSchema }).safeParse(body).data?.email ?? 'invalid';

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  // Better Auth ส่งอีเมลเป็นงานเบื้องหลัง บน Vercel ต้องบอกให้รอจนจบ ไม่เช่นนั้นเครื่องอาจหยุดก่อนส่งเสร็จ
  advanced: {
    backgroundTasks: {
      handler: (task) => {
        after(() => task);
      },
    },
  },

  // ตารางชื่อพหูพจน์ตามหัวข้อ 6.1 และชี้ชื่อคอลัมน์ของเราให้ Better Auth รู้จัก
  database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
  user: {
    fields: { name: 'displayName' },
    deleteUser: { enabled: true }, // ลบบัญชีของตัวเองได้ ข้อมูลที่ผูกไว้ลบตาม Foreign Key
  },
  account: { fields: { password: 'passwordHash' } },

  // Better Auth แฮชรหัสผ่านให้เอง ไม่มีการเก็บรหัสแบบอ่านได้
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // เข้าสู่ระบบได้ก่อนยืนยันอีเมล แต่ฟีเจอร์ชุมชนต้องยืนยันก่อน ตามมติ Q4
    requireEmailVerification: false,
    resetPasswordTokenExpiresIn: 60 * 60, // ลิงก์รีเซ็ตหมดอายุใน 1 ชั่วโมง
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail({ to: user.email, url });
    },
  },
  emailVerification: {
    // ส่งลิงก์ยืนยันตอนสมัครเฉพาะเมื่อส่งอีเมลได้จริง (ดู lib/email-verification)
    sendOnSignUp: isEmailVerificationRequired(),
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ to: user.email, url });
    },
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID ?? '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        },
      }
    : undefined,

  // Session อยู่ 7 วัน คุกกี้ HttpOnly และ SameSite=Lax เป็นค่าเริ่มต้นของไลบรารี
  // ส่วน Secure เปิดเองเมื่อ baseURL เป็น https (ตรวจแล้วในการทดสอบเฟส 3)
  session: { expiresIn: SEVEN_DAYS_SECONDS, updateAge: 60 * 60 * 24 },

  // เก็บโทเคนรีเซ็ตรหัสผ่านแบบแฮชตามหัวข้อ 6.1
  verification: { storeIdentifier: 'hashed' },

  // ตัวจำกัดคำขอทั่วไปของไลบรารี เก็บตัวนับในฐานข้อมูลเดียวกับเรา ใช้งานได้บน Vercel
  rateLimit: {
    window: 60,
    max: 100,
    customRules: { '/sign-in/email': false }, // ล็อกอินใช้ตัวนับครั้งที่ผิดด้านล่างแทน
    customStorage: {
      consume: async (key, rule) => {
        const { count, retryAfter } = await hitRateLimit(`ba:${key}`, rule.window);
        return count > rule.max
          ? { allowed: false, retryAfter }
          : { allowed: true, retryAfter: null };
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // คนสมัครด้วย Google ไม่มีชื่อผู้ใช้ สร้างให้จากอีเมลแล้วต่อท้ายด้วยตัวสุ่ม
        before: async (user) => {
          if (user.username) return { data: user };
          const base =
            user.email
              .split('@')[0]
              ?.toLowerCase()
              .replace(/[^a-z0-9_]/g, '')
              .slice(0, 20) || 'user';
          const generated = `${base}_${randomBytes(3).toString('hex')}`;
          return { data: { ...user, username: generated, displayUsername: generated } };
        },
      },
    },
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // ตรวจค่าฝั่งเซิร์ฟเวอร์ด้วยกฎชุดเดียวกับฟอร์ม ป้องกันคนยิง API ข้ามหน้าเว็บ
      if (ctx.path === '/sign-up/email') {
        const parsed = registerServerSchema.safeParse(ctx.body);
        if (!parsed.success) {
          throw new APIError('BAD_REQUEST', {
            message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง',
          });
        }
      }

      if (ctx.path === '/sign-in/email') {
        const keys = loginKeys(loginEmail(ctx.body), clientIp(ctx.headers));
        for (const key of keys) {
          const { count, retryAfter } = await peekRateLimit(key, LOGIN_WINDOW_SECONDS);
          if (count >= LOGIN_MAX_FAILURES) {
            throw new APIError('TOO_MANY_REQUESTS', {
              message: `ล็อกอินผิดหลายครั้งเกินไป ลองใหม่ใน ${Math.ceil(retryAfter / 60)} นาที`,
            });
          }
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-in/email') return;
      const email = loginEmail(ctx.body);
      const keys = loginKeys(email, clientIp(ctx.headers));
      if (ctx.context.returned instanceof APIError) {
        await Promise.all(keys.map((key) => hitRateLimit(key, LOGIN_WINDOW_SECONDS)));
      } else {
        // สำเร็จแล้วล้างเฉพาะตัวนับของบัญชี ตัวนับ IP ยังอยู่ กันการไล่เดาหลายบัญชีจาก IP เดียว
        await resetRateLimit(`login:account:${email}`);
      }
    }),
  },

  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameValidator: (value) => /^[a-z0-9_]+$/.test(value),
    }),
    admin({
      defaultRole: 'member',
      adminRoles: ['admin'],
      bannedUserMessage: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
    }),
    nextCookies(), // ต้องอยู่ท้ายสุด ให้ Server Action ตั้งคุกกี้ได้
  ],
});

export const isGoogleEnabled = googleEnabled;
export type Session = typeof auth.$Infer.Session;
