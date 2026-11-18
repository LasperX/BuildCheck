import { NextResponse } from 'next/server';

import { partsToCsv } from '@/lib/parts/csv';
import { isCategorySlug } from '@/lib/parts/spec-fields';
import { authorizeAdmin } from '@/lib/session';
import { listPartsForExport } from '@/server/queries/admin-parts';
import { todayInThailand } from '@/server/used/stats';

/**
 * ส่งออกอะไหล่ทั้งหมวดเป็น CSV รูปแบบเดียวกับไฟล์นำเข้า (เฉพาะแอดมิน)
 * ใช้เป็นไฟล์สำรอง หรือแก้ราคาและสเปกหลายรุ่นใน Excel แล้วนำเข้ากลับ
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ category: string }> },
) {
  const authz = await authorizeAdmin();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: 403 });

  const { category } = await params;
  if (!isCategorySlug(category)) {
    return NextResponse.json({ error: 'ไม่พบหมวด' }, { status: 404 });
  }

  const csv = partsToCsv(category, await listPartsForExport(category));
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="buildcheck-${category}-${todayInThailand()}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
