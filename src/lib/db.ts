import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '@/db/schema';

// ตอนพัฒนา Next.js โหลดโมดูลซ้ำทุกครั้งที่แก้โค้ด ถ้าสร้าง Pool ใหม่ทุกรอบ การเชื่อมต่อจะเต็ม
// จึงเก็บ Pool ไว้ที่ globalThis แล้วใช้ตัวเดิม
const globalForDb = globalThis as unknown as { pgPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('ไม่พบ DATABASE_URL ให้คัดลอก .env.example เป็น .env แล้วตั้งค่า');
  }
  return new Pool({ connectionString, max: 10 });
}

const pool = globalForDb.pgPool ?? createPool();
if (process.env.NODE_ENV !== 'production') globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
