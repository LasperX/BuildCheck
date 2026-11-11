import { randomBytes } from 'node:crypto';

import { eq, like } from 'drizzle-orm';

import { builds, buildItems, categories, parts, users } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

import { requestState } from './setup';

// บัญชีทดสอบ: อีเมล it…@example.test รหัสผ่านสุ่ม สมัครผ่าน Better Auth จริงเพื่อได้คุกกี้ Session จริง

export const IT_PREFIX = 'it';

export type TestAccount = { id: string; email: string; cookie: string; ip: string };

let ipCounter = 10;

/** สมัครบัญชีจริง แล้วตั้ง role / ยืนยันอีเมล ตามที่ระบุ */
export async function createAccount(
  options: { verified?: boolean; role?: 'member' | 'admin' } = {},
): Promise<TestAccount> {
  const tag = randomBytes(4).toString('hex');
  const email = `${IT_PREFIX}${tag}@example.test`;
  // IP ต่างกันทุกบัญชี กันชนตัวจำกัดความถี่ของการสมัคร
  const ip = `10.99.0.${ipCounter++}`;
  const result = await auth.api.signUpEmail({
    body: {
      email,
      password: randomBytes(12).toString('base64url'),
      name: `ทดสอบ ${tag}`,
      username: `${IT_PREFIX}_${tag}`,
    },
    headers: new Headers({ 'x-forwarded-for': ip }),
    returnHeaders: true,
  });
  const setCookie = result.headers.get('set-cookie') ?? '';
  const cookie = setCookie
    .split(/,(?=\s*[\w.-]+=)/)
    .map((part) => part.split(';')[0]?.trim())
    .filter((part): part is string => Boolean(part) && part!.includes('session_token'))
    .join('; ');
  if (!cookie) throw new Error('สมัครบัญชีทดสอบไม่สำเร็จ ไม่ได้คุกกี้ Session');

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!user) throw new Error('ไม่พบบัญชีทดสอบ');
  await db
    .update(users)
    .set({ emailVerified: options.verified ?? true, role: options.role ?? 'member' })
    .where(eq(users.id, user.id));
  return { id: user.id, email, cookie, ip };
}

/** ให้ Server Action ถัดไปทำงานในนามบัญชีนี้ (ส่งคุกกี้ Session จริง) */
export function actAs(account: TestAccount | null) {
  requestState.headers = new Headers(
    account
      ? { cookie: account.cookie, 'x-forwarded-for': account.ip }
      : { 'x-forwarded-for': '10.99.1.1' },
  );
}

/** ลบบัญชีทดสอบทั้งหมด สเปก คอมเมนต์ โหวต ลบตามด้วย ON DELETE CASCADE */
export async function cleanupAccounts() {
  await db.delete(users).where(like(users.email, `${IT_PREFIX}%@example.test`));
}

/** อะไหล่ที่ขายอยู่ 1 ชิ้นต่อหมวด (จากอะไหล่ตัวอย่าง) */
export async function partsByCategory() {
  const rows = await db
    .select({
      id: parts.id,
      price: parts.price,
      slug: categories.slug,
      model: parts.model,
      availability: parts.availability,
    })
    .from(parts)
    .innerJoin(categories, eq(categories.id, parts.categoryId))
    .where(eq(parts.isActive, true));
  const pick = (slug: string) => {
    const found = rows.filter((row) => row.slug === slug);
    if (found.length === 0) throw new Error(`ไม่มีอะไหล่หมวด ${slug} ให้รัน pnpm db:seed:samples`);
    return found;
  };
  return { pick, rows };
}

export async function itemsOf(buildId: string) {
  return db.select().from(buildItems).where(eq(buildItems.buildId, buildId));
}

export async function buildRow(buildId: string) {
  const [row] = await db.select().from(builds).where(eq(builds.id, buildId));
  return row;
}
