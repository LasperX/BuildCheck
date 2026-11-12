import { expect, test } from '@playwright/test';

import { cleanupTestUsers, newUser, register } from './helpers';

// เว็บจริงที่ยังไม่ได้ตั้งระบบส่งอีเมล: คนที่สมัครด้วยอีเมลยืนยันอีเมลไม่ได้
// ระบบจึงต้องไม่ล็อกฟีเจอร์ชุมชนไว้ (lib/email-verification) และการ์ดสเปกต้องกดตรงไหนก็เปิดได้
// ถ้าเซิร์ฟเวอร์ที่ทดสอบบังคับยืนยันอีเมลอยู่ (เช่น next dev) ข้ามการทดสอบนี้

test.afterAll(async () => {
  await cleanupTestUsers();
});

test('สมัครด้วยอีเมลโดยไม่ยืนยัน กดการ์ดในหน้าชุมชนเข้าไปโหวตและคอมเมนต์ได้', async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  page.on('dialog', (dialog) => dialog.accept());

  const owner = newUser();
  await register(page, owner);
  const notRequired = page.getByText('ตอนนี้ไม่ต้องยืนยันอีเมล');
  test.skip(!(await notRequired.isVisible()), 'เซิร์ฟเวอร์นี้บังคับยืนยันอีเมล');

  // เจ้าของ: จัดสเปกจากหน้าจัดตามงบ แล้วแชร์เป็นสาธารณะ ตั้งชื่อเฉพาะไว้หาในหน้าชุมชน
  const title = `ทดสอบการ์ด ${Date.now()}`;
  await page.goto('/budget');
  await page.getByLabel('งบประมาณ (บาท)').fill('30000');
  await page.getByRole('button', { name: 'จัดให้เลย' }).click();
  await page.getByRole('button', { name: 'นำไปแก้ต่อในหน้าจัดสเปก' }).first().click();
  await expect(page).toHaveURL(/\/builder/);
  await page.getByLabel(/ชื่อสเปก/).fill(title);
  await expect(page.getByText(/บันทึก(อัตโนมัติ)?แล้ว/).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'แชร์' }).click();
  await page.getByRole('dialog').locator('#share-visibility').selectOption('public');
  await page.getByRole('dialog').getByRole('button', { name: 'ปิด' }).first().click();

  // อีกบัญชี (ไม่ยืนยันอีเมล): กดตรงราคาบนการ์ด ไม่ใช่ที่ชื่อสเปก ต้องเปิดหน้าสเปกได้
  // (ลิงก์ชื่อสเปกคลุมทั้งการ์ด จึงกดด้วยเมาส์ที่ตำแหน่งราคา เหมือนผู้ใช้จริง)
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await register(other, newUser());
  await other.goto('/builds', { waitUntil: 'networkidle' });
  const card = other.getByRole('article').filter({ hasText: title });
  await expect(card).toBeVisible();
  const price = await card.locator('p.font-mono').first().boundingBox();
  if (!price) throw new Error('ไม่พบราคาบนการ์ด');
  await other.mouse.click(price.x + price.width / 2, price.y + price.height / 2);
  await expect(other).toHaveURL(/\/builds\/[A-Za-z0-9]{10}/);

  await other.getByRole('button', { name: 'โหวตขึ้น' }).click();
  await expect(other.getByRole('button', { name: 'โหวตขึ้น' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const text = `คอมเมนต์จากบัญชีที่ไม่ได้ยืนยัน ${Date.now()}`;
  await other.getByRole('textbox', { name: 'แสดงความคิดเห็นหรือแนะนำสเปกนี้' }).fill(text);
  await other.getByRole('button', { name: 'ส่งคอมเมนต์' }).click();
  await expect(other.getByText(text)).toBeVisible();
  await otherContext.close();
});
