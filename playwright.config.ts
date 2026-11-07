import { defineConfig, devices } from '@playwright/test';

// E2E test (หัวข้อ 10.2) รันกับ production build ในเครื่อง: pnpm build แล้ว pnpm test:e2e
// ใช้ Chrome ที่ติดตั้งในเครื่อง (channel: 'chrome') จึงไม่ต้องดาวน์โหลดเบราว์เซอร์ของ Playwright
// ต้องมีฐานข้อมูลที่ seed อะไหล่ตัวอย่างแล้ว (pnpm db:seed:samples)

try {
  process.loadEnvFile('.env');
} catch {
  // บน CI ใช้ค่าจาก Environment Variables
}

const PORT = 3100;
// ตั้ง E2E_BASE_URL เพื่อรันกับเว็บที่ Deploy แล้ว (เช่น https://xxx.vercel.app) จะไม่เปิดเซิร์ฟเวอร์ในเครื่อง
const REMOTE = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  // ทุกเทสต์ใช้ฐานข้อมูลเดียวกัน รันทีละไฟล์เพื่อไม่ให้ชนกัน
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: REMOTE ?? `http://localhost:${PORT}`,
    channel: 'chrome',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      testIgnore: /mobile.spec.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], channel: 'chrome' },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: REMOTE
    ? undefined
    : {
        command: `pnpm start -p ${PORT}`,
        port: PORT,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
