import { z } from 'zod';

// กฎตรวจค่าชุดเดียว ใช้ทั้งฟอร์มหน้าเว็บและฝั่งเซิร์ฟเวอร์

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }).max(255, 'อีเมลยาวเกินไป'));

// บังคับอย่างน้อย 8 ตัวตามหัวข้อ 9.1
export const passwordSchema = z
  .string()
  .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
  .max(128, 'รหัสผ่านยาวเกินไป');

// ชื่อผู้ใช้อยู่ใน URL /u/[username] จึงรับเฉพาะตัวพิมพ์เล็ก ตัวเลข และขีดล่าง
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร')
  .max(30, 'ชื่อผู้ใช้ยาวได้ไม่เกิน 30 ตัวอักษร')
  .regex(/^[a-z0-9_]+$/, 'ใช้ได้เฉพาะ a-z, 0-9 และขีดล่าง');

export const registerServerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
});

export const registerSchema = registerServerSchema
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    error: 'รหัสผ่านไม่ตรงกัน',
  });
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
});
export type LoginInput = z.input<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    error: 'รหัสผ่านไม่ตรงกัน',
  });
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'กรุณากรอกรหัสผ่านปัจจุบัน'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    error: 'รหัสผ่านไม่ตรงกัน',
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'กรุณากรอกชื่อที่แสดง')
    .max(60, 'ชื่อที่แสดงยาวได้ไม่เกิน 60 ตัวอักษร'),
  bio: z.string().trim().max(300, 'คำแนะนำตัวยาวได้ไม่เกิน 300 ตัวอักษร'),
});
export type ProfileInput = z.input<typeof profileSchema>;

/** ยอมให้กลับไปได้เฉพาะ path ในเว็บเรา ป้องกันลิงก์หลอกส่งผู้ใช้ออกนอกเว็บหลังล็อกอิน */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return fallback;
  }
  return next;
}
