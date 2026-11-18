import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { cleanupTestUsers, login, makeAdmin, newUser, register } from './helpers';

// เครื่องมือหลังบ้านสำหรับเติมข้อมูลเอง: ส่งออก CSV และวางรูปที่คัดลอกไว้ด้วย Ctrl+V
// ตอนทดสอบวางรูป ดักคำขอ Server Action ทุกคำขอไว้ก่อนถึงเซิร์ฟเวอร์ รูปทดสอบจึงไม่ไปลงที่เก็บรูปจริง
// แล้วดูว่ารูปที่วางถูกส่งไปที่อะไหล่ชิ้นที่ชี้อยู่จริง
// ใช้บัญชีแอดมินเดียวทั้งไฟล์ เพราะระบบจำกัดการสมัครถี่ๆ จาก IP เดียว (เทสต์อื่นต้องสมัครต่อ)

// PNG ขนาด 1×1 px
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

test.describe.configure({ mode: 'serial' });

const admin = newUser();

test.afterAll(async () => {
  await cleanupTestUsers();
});

test('แอดมินส่งออกอะไหล่เป็น CSV ได้ ไฟล์มี BOM ให้ Excel อ่านภาษาไทยถูก', async ({ page }) => {
  await register(page, admin);
  await makeAdmin(admin.email);

  await page.goto('/admin/parts/import');
  const downloading = page.waitForEvent('download');
  await page.getByRole('link', { name: /ส่งออกข้อมูลปัจจุบัน/ }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^buildcheck-cpu-\d{4}-\d{2}-\d{2}\.csv$/);

  const bytes = await readFile(await download.path());
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const lines = bytes.subarray(3).toString('utf8').split('\r\n');
  expect(lines[0]).toMatch(/^brand,model,price,release_year,power_watt,image_url,/);
  expect(lines.length).toBeGreaterThan(1);
});

test('แอดมินชี้ที่ช่องรูปแล้ววางรูปที่คัดลอกไว้ ระบบส่งรูปไปที่ชิ้นนั้น ส่วนการวางในช่องค้นหาไม่ส่งรูป', async ({
  page,
}) => {
  await login(page, admin);

  const uploads: string[] = [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && request.headers()['next-action']) {
      uploads.push(request.postDataBuffer()?.toString('latin1') ?? '');
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto('/admin/parts');
  const cell = page.getByRole('button', { name: /^(เพิ่มรูป|เปลี่ยนรูป) / }).first();
  const editHref = await page
    .getByRole('row')
    .filter({ has: cell })
    .getByRole('link', { name: /.+/ })
    .first()
    .getAttribute('href');
  const partId = editHref?.match(/\/admin\/parts\/(\d+)$/)?.[1];
  expect(partId).toBeTruthy();

  const paste = (selector: string | null) =>
    page.evaluate(
      ({ target, base64 }) => {
        const png = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        const data = new DataTransfer();
        data.items.add(new File([png], 'pasted.png', { type: 'image/png' }));
        const element = target ? document.querySelector(target) : document.body;
        element?.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
        );
      },
      { target: selector, base64: PNG_BASE64 },
    );

  // กำลังพิมพ์ในช่องค้นหา: เป็นการวางข้อความตามปกติ ไม่ส่งรูป แม้เมาส์ชี้ที่ช่องรูปอยู่
  await page.getByLabel('ค้นหาอะไหล่').click();
  await cell.hover();
  await paste('input[name="q"]');
  await page.waitForTimeout(500);
  expect(uploads).toHaveLength(0);

  // ชี้ที่ช่องรูปแล้ววาง: ส่งรูปไปที่ชิ้นนั้น (คำขอถูกดักไว้ ช่องจึงแจ้งว่าอัปโหลดไม่สำเร็จแทนการทำให้หน้าพัง)
  await cell.hover();
  await paste(null);
  await expect.poll(() => uploads.length).toBe(1);
  expect(uploads[0]).toContain('filename="pasted.png"');
  // React ส่ง FormData ของ Server Action โดยเติมคำนำหน้าชื่อช่อง เช่น "_1_id"
  expect(uploads[0]?.match(/name="(?:_?\d+_)?id"\r\n\r\n(\d+)\r\n/)?.[1]).toBe(partId);
  await expect(page.getByRole('alert').filter({ hasText: 'อัปโหลดไม่สำเร็จ' })).toBeVisible();
});
