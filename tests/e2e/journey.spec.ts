import { expect, test } from '@playwright/test';

import { cleanupTestUsers, newUser, register, verifyEmail } from './helpers';

// เส้นทางหลักตามหัวข้อ 10.2:
//   สมัคร → จัดสเปกครบ 8 ชิ้น → แก้ปัญหาตามคำแนะนำ → บันทึก → แชร์ → อีกบัญชีเปิดลิงก์แล้วคอมเมนต์
// ใช้อะไหล่ตัวอย่างจาก pnpm db:seed:samples (เมนบอร์ด 1 = AM5, เมนบอร์ด 2 = LGA1700)

test.afterAll(async () => {
  await cleanupTestUsers();
});

test('สมัคร จัดสเปก แก้ปัญหา แชร์ แล้วอีกบัญชีคอมเมนต์ เจ้าของได้แจ้งเตือนสด', async ({
  page,
  browser,
}) => {
  const owner = newUser();
  await register(page, owner);
  await verifyEmail(owner.email);
  page.on('dialog', (dialog) => dialog.accept());

  // 1. จัดสเปกครบชุดจากหน้าจัดตามงบ แล้วนำไปแก้ต่อ
  await page.goto('/budget');
  await page.getByLabel('งบประมาณ (บาท)').fill('30000');
  await page.getByRole('button', { name: 'จัดให้เลย' }).click();
  await expect(page.getByRole('heading', { name: /3 ตัวเลือกจากงบ/ })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'นำไปแก้ต่อในหน้าจัดสเปก' }).nth(1).click();
  await expect(page).toHaveURL(/\/builder/);

  const summary = page.getByRole('complementary').first();
  const board = page.getByRole('article', { name: 'เมนบอร์ด' });
  await expect(board.getByRole('link')).toBeVisible();
  const boardName = (await board.getByRole('link').first().textContent()) ?? '';
  // 8 หมวดที่มีอะไหล่ (ชุดระบายความร้อนอาจไม่ต้องใช้ถ้า CPU มีพัดลมแถม) และสถานะไม่มีผิดพลาด
  await expect(page.getByText('มีชิ้นที่ใส่ด้วยกันไม่ได้').filter({ visible: true })).toHaveCount(
    0,
  );

  // 2. จงใจเปลี่ยนเมนบอร์ดเป็นคนละ Socket (กรองอัจฉริยะปิดเป็นค่าเริ่มต้น จึงเลือกได้เลย)
  const wrongBoard = boardName.includes('เมนบอร์ด 1') ? 'ตัวอย่างเมนบอร์ด 2' : 'ตัวอย่างเมนบอร์ด 1';
  await board.getByRole('button', { name: /^เปลี่ยนรุ่น/ }).click();
  const picker = page.getByRole('dialog');
  await expect(picker.getByRole('switch')).not.toBeChecked();
  await picker.getByRole('button', { name: new RegExp(`^เลือก .*${wrongBoard}`) }).click();
  const issues = page.locator('#issues');
  await expect(issues.getByText('R01', { exact: true })).toBeVisible();

  // 3. กดปุ่มแนะนำใต้ R01 → หน้าต่างเลือกโหมดแก้ปัญหา → เลือกชิ้นแรก → R01 หายไป
  await issues.getByRole('button', { name: /^ดูเมนบอร์ด/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^เลือก / })
    .first()
    .click();
  await expect(issues.getByText('R01', { exact: true })).toHaveCount(0);

  // 4. บันทึกอัตโนมัติ แล้วแชร์เป็นสาธารณะ
  await expect(page.getByText(/บันทึก(อัตโนมัติ)?แล้ว/).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'แชร์' }).click();
  const share = page.getByRole('dialog');
  await share.locator('#share-visibility').selectOption('public');
  const url = await share.locator('#share-url').inputValue();
  expect(url).toMatch(/\/b\/[A-Za-z0-9]{10}$/);
  await share.getByRole('button', { name: 'ปิด' }).first().click();
  await expect(summary).toBeVisible();

  // 5. อีกบัญชีเปิดลิงก์แชร์แล้วคอมเมนต์
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  const commenter = newUser();
  await register(other, commenter);
  await verifyEmail(commenter.email);
  await other.goto(new URL(url).pathname);
  await expect(other).toHaveURL(/\/builds\/[A-Za-z0-9]{10}/);
  const text = `ทดสอบคอมเมนต์ ${Date.now()}`;
  await other.getByRole('textbox', { name: 'แสดงความคิดเห็นหรือแนะนำสเปกนี้' }).fill(text);
  await other.getByRole('button', { name: 'ส่งคอมเมนต์' }).click();
  await expect(other.getByText(text)).toBeVisible();

  // 6. เจ้าของสเปกได้แจ้งเตือนแบบสด (SSE วนอ่านทุก 3 วินาที)
  await expect(page.getByRole('button', { name: /การแจ้งเตือน ยังไม่อ่าน/ })).toBeVisible({
    timeout: 15_000,
  });
  await otherContext.close();
});
