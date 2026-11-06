import { type NextRequest, NextResponse } from 'next/server';

import { isCategorySlug } from '@/lib/parts/spec-fields';
import { getPartFacets } from '@/server/queries/parts';

// ตัวเลือกในตัวกรองของหมวด (ยี่ห้อ และค่าสเปกที่มีจริง) ใช้ในหน้าต่างเลือกอะไหล่
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category') ?? '';
  if (!isCategorySlug(category)) {
    return NextResponse.json({ error: 'ไม่พบหมวดนี้' }, { status: 400 });
  }
  return NextResponse.json(await getPartFacets(category));
}
