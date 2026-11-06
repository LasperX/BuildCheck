import { timingSafeEqual } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

import { getSystemConfig } from '@/server/queries/settings';
import { recomputeUsedStats } from '@/server/used/stats';

// Vercel Cron เรียกทุกคืน (ตั้งเวลาใน vercel.json) คำนวณราคากลางมือสองของทุกรุ่นใหม่ (หัวข้อ 4.6)
// Vercel ส่ง Authorization: Bearer <CRON_SECRET> มาให้ คนอื่นเรียกไม่ได้

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  // เทียบแบบใช้เวลาคงที่ ไม่ให้เดาค่าลับจากเวลาตอบกลับได้
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 401 });
  }
  const { used } = await getSystemConfig();
  const summary = await recomputeUsedStats(used);
  revalidateTag('used-prices', 'max');
  return NextResponse.json({ ok: true, ...summary });
}
