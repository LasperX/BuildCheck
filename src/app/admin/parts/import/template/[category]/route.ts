import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { isCategorySlug } from '@/lib/parts/spec-fields';
import { authorizeAdmin } from '@/lib/session';

/** ดาวน์โหลดไฟล์ CSV ตัวอย่างของหมวด ข้อมูลในไฟล์เป็นค่าสมมติที่มีสถานะ "รอตรวจสอบ" */
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

  const file = path.join(process.cwd(), 'src', 'db', 'seed', 'csv', `${category}.csv`);
  return new NextResponse(await readFile(file), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="buildcheck-${category}.csv"`,
    },
  });
}
