import { randomBytes } from 'node:crypto';

import { expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import pg from 'pg';

// เครื่องมือช่วยของ E2E test
// บัญชีทดสอบใช้อีเมล @example.test (โดเมนที่สงวนไว้สำหรับทดสอบ ส่งอีเมลจริงไม่ได้) และรหัสผ่านสุ่มทุกครั้ง

export const TEST_DOMAIN = 'example.test';
export const E2E_PREFIX = 'e2e';

export type TestUser = { email: string; username: string; password: string };

export function newUser(): TestUser {
  const tag = randomBytes(4).toString('hex');
  return {
    email: `${E2E_PREFIX}${tag}@${TEST_DOMAIN}`,
    username: `${E2E_PREFIX}_${tag}`,
    password: randomBytes(12).toString('base64url'),
  };
}

let pool: pg.Pool | null = null;
function db() {
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  return pool;
}

/**
 * ยืนยันอีเมลในฐานข้อมูลโดยตรง เพราะเทสต์อ่านอีเมลจริงไม่ได้
 * (การส่งลิงก์ยืนยันทดสอบแยกไว้ในเฟส 3 แล้ว)
 */
export async function verifyEmail(email: string) {
  await db().query('UPDATE users SET email_verified = true WHERE email = $1', [email]);
}

/** ลบบัญชีทดสอบทั้งหมดของ E2E (สเปก คอมเมนต์ โหวต ลบตามด้วย ON DELETE CASCADE) */
export async function cleanupTestUsers() {
  await db().query(`DELETE FROM users WHERE email LIKE $1`, [`${E2E_PREFIX}%@${TEST_DOMAIN}`]);
  await pool?.end();
  pool = null;
}

export async function register(page: Page, user: TestUser) {
  await page.goto('/register');
  await page.getByLabel('อีเมล').fill(user.email);
  await page.getByLabel('ชื่อผู้ใช้').fill(user.username);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(user.password);
  await page.getByLabel('ยืนยันรหัสผ่าน').fill(user.password);
  await page.getByRole('button', { name: 'สมัครสมาชิก' }).click();
  await expect(page).toHaveURL(/\/me\/settings/);
}

export async function login(page: Page, user: TestUser) {
  await page.goto('/login');
  await page.getByLabel('อีเมล').fill(user.email);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** ตั้งบัญชีทดสอบเป็นแอดมินในฐานข้อมูลโดยตรง (หน้าเว็บไม่มีทางให้สมาชิกตั้งตัวเองเป็นแอดมิน) */
export async function makeAdmin(email: string) {
  await db().query(`UPDATE users SET role = 'admin' WHERE email = $1`, [email]);
}

/** รูปถ่ายใหญ่สำหรับทดสอบการย่อรูป: PNG สุ่มจุด 2600 × 2000 px ราว 15 MB (บีบอัดยากที่สุด) */
export async function bigPhoto() {
  const width = 2600;
  const height = 2000;
  const png = await sharp(randomBytes(width * height * 3), { raw: { width, height, channels: 3 } })
    .png({ compressionLevel: 1 })
    .toBuffer();
  expect(png.length).toBeGreaterThan(10 * 1024 * 1024);
  return { name: 'photo.png', mimeType: 'image/png', buffer: png };
}

/**
 * เก็บเนื้อคำขอ Server Action ทุกคำขอแล้วยกเลิกก่อนถึงเซิร์ฟเวอร์
 * ใช้ทดสอบการอัปโหลดรูปโดยไม่ให้รูปทดสอบไปลงที่เก็บรูปจริง
 */
export async function captureServerActions(page: Page) {
  const bodies: Buffer[] = [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && request.headers()['next-action']) {
      bodies.push(request.postDataBuffer() ?? Buffer.alloc(0));
      await route.abort();
      return;
    }
    await route.continue();
  });
  return bodies;
}

/** รูปในคำขอถูกย่อเป็น WebP แล้ว และทั้งคำขอไม่เกิน 2 MB (เผื่อหัวข้อมูลของฟอร์ม 64 KB) */
export function expectCompressed(body: Buffer | undefined) {
  expect(body).toBeDefined();
  expect(body!.length).toBeLessThan(2 * 1024 * 1024 + 64 * 1024);
  expect(body!.toString('latin1')).toMatch(/filename="photo\.webp"\r\nContent-Type: image\/webp/);
}
