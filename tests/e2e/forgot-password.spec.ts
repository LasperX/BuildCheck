import { expect, test } from '@playwright/test';

// เว็บจริงที่ยังไม่ได้ตั้งระบบส่งอีเมล: หน้าลืมรหัสผ่านต้องบอกตามจริง ไม่มีฟอร์มให้กรอกแล้วขึ้นว่า "ส่งลิงก์แล้ว"
// (เดิม Better Auth ตอบว่าสำเร็จแม้ส่งอีเมลไม่ได้ ผู้ใช้จึงรออีเมลที่ไม่มีวันมา)
// ถ้าเซิร์ฟเวอร์ที่ทดสอบส่งอีเมลได้ (เช่น next dev ที่แสดงลิงก์ในหน้าจอ Terminal) ข้ามการทดสอบนี้

test('เว็บที่ยังส่งอีเมลไม่ได้: หน้าลืมรหัสผ่านแจ้งตามจริงและไม่มีฟอร์ม', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'ลืมรหัสผ่าน?' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole('heading', { name: 'ลืมรหัสผ่าน' })).toBeVisible();

  const sendButton = page.getByRole('button', { name: 'ส่งลิงก์ตั้งรหัสผ่านใหม่' });
  test.skip(await sendButton.isVisible(), 'เซิร์ฟเวอร์นี้ส่งอีเมลได้');

  await expect(page.getByText('เว็บยังไม่ได้เปิดระบบส่งอีเมล')).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.getByRole('link', { name: 'กลับไปเข้าสู่ระบบ' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
