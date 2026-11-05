import 'server-only';

import { createHash } from 'node:crypto';

import { eq, lt, sql } from 'drizzle-orm';

import { rateLimits } from '@/db/schema';
import { db } from '@/lib/db';

// ตัวนับแบบหน้าต่างเวลาคงที่: นับเพิ่มไปเรื่อยๆ เมื่อครบเวลาหน้าต่างจึงเริ่มนับ 1 ใหม่
// คำสั่ง INSERT ... ON CONFLICT ทำในคำสั่งเดียว คำขอที่มาพร้อมกันจึงนับไม่ตกหล่น

// แฮชคีย์ก่อนเก็บ จึงไม่มีอีเมลหรือ IP แบบอ่านได้อยู่ในตาราง (PDPA)
function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** นับเพิ่ม 1 ครั้ง แล้วคืนจำนวนในหน้าต่างปัจจุบันและเวลาที่ต้องรอ */
export async function hitRateLimit(key: string, windowSeconds: number) {
  const hashed = hashKey(key);
  const interval = sql`make_interval(secs => ${windowSeconds})`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key: hashed, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.windowStart} < now() - ${interval} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${rateLimits.windowStart} < now() - ${interval} THEN now() ELSE ${rateLimits.windowStart} END`,
      },
    })
    .returning({
      count: rateLimits.count,
      retryAfter: sql<number>`GREATEST(0, CEIL(EXTRACT(EPOCH FROM ${rateLimits.windowStart} + ${interval} - now())))::int`,
    });

  // ทำความสะอาดแถวเก่าเป็นครั้งคราว ไม่ให้ตารางโตเรื่อยๆ
  if (Math.random() < 0.01) {
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, sql`now() - interval '1 day'`));
  }

  return { count: row?.count ?? 1, retryAfter: row?.retryAfter ?? windowSeconds };
}

/** อ่านจำนวนในหน้าต่างปัจจุบันโดยไม่นับเพิ่ม */
export async function peekRateLimit(key: string, windowSeconds: number) {
  const interval = sql`make_interval(secs => ${windowSeconds})`;
  const [row] = await db
    .select({
      count: rateLimits.count,
      retryAfter: sql<number>`GREATEST(0, CEIL(EXTRACT(EPOCH FROM ${rateLimits.windowStart} + ${interval} - now())))::int`,
      active: sql<boolean>`${rateLimits.windowStart} >= now() - ${interval}`,
    })
    .from(rateLimits)
    .where(eq(rateLimits.key, hashKey(key)));

  if (!row?.active) return { count: 0, retryAfter: 0 };
  return { count: row.count, retryAfter: row.retryAfter };
}

/** ล้างตัวนับ เช่น เมื่อล็อกอินสำเร็จ */
export async function resetRateLimit(key: string) {
  await db.delete(rateLimits).where(eq(rateLimits.key, hashKey(key)));
}

/** IP ของผู้ใช้จาก Header ที่ Vercel ตั้งให้ ตอนพัฒนาไม่มี Header นี้จึงใช้ค่า local */
export function clientIp(headers: Headers | undefined): string {
  return headers?.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}
