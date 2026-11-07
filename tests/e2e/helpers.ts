import { randomBytes } from 'node:crypto';

import { expect, type Page } from '@playwright/test';
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
