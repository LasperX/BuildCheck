import { expect, test } from '@playwright/test';

// หน้าจอมือถือ (หัวข้อ 5.3, 9.2): เมนูเป็นแถบล่าง และไม่มีหน้าไหนเลื่อนแนวนอน

const PAGES = ['/', '/builder', '/budget', '/parts', '/used', '/builds', '/compare', '/guide'];

test('แถบเมนูล่างแสดงบนมือถือ', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'เมนูล่าง' })).toBeVisible();
});

for (const path of PAGES) {
  test(`ไม่ล้นแนวนอน ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
