import { NextResponse } from 'next/server';

import { authorizeAdmin } from '@/lib/session';
import { surveysToCsv } from '@/lib/used/survey-csv';
import { listLatestSurveysForExport } from '@/server/queries/used';
import { todayInThailand } from '@/server/used/stats';

/**
 * ส่งออกราคาสำรวจล่าสุดของทุกรุ่นและเกรดเป็น CSV รูปแบบเดียวกับไฟล์นำเข้า (เฉพาะแอดมิน)
 * ใช้เป็นไฟล์สำรอง หรือแก้ราคาหลายรุ่นใน Excel แล้วนำเข้ากลับ
 */
export async function GET() {
  const authz = await authorizeAdmin();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: 403 });

  const today = todayInThailand();
  const csv = surveysToCsv(await listLatestSurveysForExport(today));
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="buildcheck-used-surveys-${today}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
