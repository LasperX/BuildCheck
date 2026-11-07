import { expect, test } from '@playwright/test';

import { cleanupTestUsers, newUser, register } from './helpers';

// สิทธิ์การเข้าถึง (หัวข้อ 2.4, 9.1) ตรวจจากเบราว์เซอร์จริง

test.afterAll(async () => {
  await cleanupTestUsers();
});

test('ผู้เยี่ยมชมเข้าหน้าสมาชิกและหลังบ้านไม่ได้ ถูกส่งไปหน้าเข้าสู่ระบบ', async ({ page }) => {
  for (const path of ['/me/builds', '/me/notifications', '/used/report', '/admin']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=/);
  }
});

test('สมาชิกทั่วไปเข้าหลังบ้านไม่ได้', async ({ page }) => {
  await register(page, newUser());
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/$/);
});

test('ผู้เยี่ยมชมจัดสเปกได้โดยไม่ต้องล็อกอิน และเห็นผลตรวจทันที', async ({ page }) => {
  await page.goto('/builder');
  await page
    .getByRole('article', { name: 'CPU' })
    .getByRole('button', { name: /^เลือก/ })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^เลือก / })
    .first()
    .click();
  await expect(
    page.getByRole('article', { name: 'CPU' }).getByRole('link', { name: /ตัวอย่าง/ }),
  ).toBeVisible();
  // ยังเลือกไม่ครบ ระบบบอกหมวดที่ยังขาด
  await expect(page.locator('#issues')).toContainText('ยังเลือกอะไหล่ไม่ครบ');
});

test('รหัสสเปกที่ไม่มีอยู่ได้หน้าไม่พบ', async ({ page }) => {
  const response = await page.goto('/b/ZZZZZZZZZZ');
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByText(/ไม่พบ/).first()).toBeVisible();
});
