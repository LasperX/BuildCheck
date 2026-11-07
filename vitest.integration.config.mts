import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Integration test ของ Server Actions (หัวข้อ 10.2) รันกับฐานข้อมูล PostgreSQL ในเครื่องจริง
// ต้องเปิดฐานข้อมูลก่อน (pnpm db:up) และ seed อะไหล่ตัวอย่างแล้ว (pnpm db:seed:samples)
// คำสั่ง: pnpm test:integration

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 'server-only' ห้าม import นอก React Server Components ในเทสต์ให้เป็นโมดูลว่าง
      'server-only': fileURLToPath(new URL('./tests/integration/empty.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/integration/setup.ts'],
    // ทุกไฟล์ใช้ฐานข้อมูลเดียวกัน รันทีละไฟล์
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
