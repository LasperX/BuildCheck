import { expect, test } from '@playwright/test';

import {
  bigPhoto,
  captureServerActions,
  cleanupTestUsers,
  expectCompressed,
  login,
  newUser,
  register,
} from './helpers';

// รูปใหญ่เกิน 2 MB ต้องย่อและบีบอัดในเบราว์เซอร์ก่อนส่ง ผู้ใช้ไม่ต้องหารูปที่เล็กกว่าเอง (ฝั่งสมาชิก)
// ใช้รูปสุ่มจุด (บีบอัดยากที่สุด) ขนาดราว 15 MB แล้วดักคำขอ Server Action ทุกคำขอไว้ก่อนถึงเซิร์ฟเวอร์
// จึงไม่มีรูปทดสอบไปลงที่เก็บรูปจริง และไม่มีรายงานราคาทดสอบเข้าฐานข้อมูล
// ฝั่งแอดมิน (รูปอะไหล่) อยู่ใน admin-tools.spec.ts · ใช้บัญชีเดียวทั้งไฟล์ เพราะระบบจำกัดการสมัครถี่ๆ

test.describe.configure({ mode: 'serial' });

const member = newUser();

test.afterAll(async () => {
  await cleanupTestUsers();
});

test('รูปโปรไฟล์ใหญ่ 15 MB ถูกย่อเป็น WebP ไม่เกิน 2 MB ก่อนส่ง', async ({ page }) => {
  test.setTimeout(90_000);
  await register(page, member);
  const uploads = await captureServerActions(page);

  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(await bigPhoto());
  await expect.poll(() => uploads.length, { timeout: 45_000 }).toBe(1);
  expectCompressed(uploads[0]);
  // คำขอถูกดักไว้ ฟอร์มจึงบอกว่าอัปโหลดไม่สำเร็จ แทนการทำให้หน้าพัง
  await expect(page.getByText('อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง')).toBeVisible();
});

test('รูปหลักฐานรายงานราคามือสองใหญ่ 15 MB ถูกย่อเป็น WebP ไม่เกิน 2 MB ก่อนส่ง', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await login(page, member);
  await page.goto('/used/report');
  const uploads = await captureServerActions(page);
  await page
    .getByRole('group', { name: 'รุ่นอะไหล่' })
    .getByRole('listitem')
    .getByRole('button')
    .first()
    .click();
  await page.getByLabel('ราคา (บาท)').fill('3500');
  await page.getByLabel('รูปหลักฐาน (ไม่บังคับ)').setInputFiles(await bigPhoto());
  await page.getByRole('button', { name: 'ส่งรายงาน' }).click();

  await expect.poll(() => uploads.length, { timeout: 45_000 }).toBe(1);
  expectCompressed(uploads[0]);
  await expect(page.getByText('ส่งรายงานไม่สำเร็จ ลองใหม่อีกครั้ง')).toBeVisible();
});
