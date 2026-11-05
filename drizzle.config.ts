import { defineConfig } from 'drizzle-kit';

// โหลดค่าจาก .env ด้วยความสามารถในตัวของ Node.js ถ้าไม่มีไฟล์ (เช่นบน Vercel) ให้ใช้ค่าจากระบบ
try {
  process.loadEnvFile('.env');
} catch {
  // ไม่มีไฟล์ .env
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});
