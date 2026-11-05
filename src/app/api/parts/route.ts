import { type NextRequest, NextResponse } from 'next/server';

import { partsQuerySchema } from '@/lib/parts/catalog';
import { getParts } from '@/server/queries/parts';

// รายการอะไหล่สำหรับหน้าคลังอะไหล่และหน้าต่างเลือกอะไหล่ ข้อมูลสาธารณะ ไม่ต้องล็อกอิน
// ตัวกรองสเปกส่งเป็น spec.socket=AM5&spec.socket=LGA1700
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const spec: Record<string, string[]> = {};
  for (const key of new Set(params.keys())) {
    if (key.startsWith('spec.')) spec[key.slice(5)] = params.getAll(key);
  }
  const text = (name: string) => params.get(name) || undefined;

  const parsed = partsQuerySchema.safeParse({
    category: text('category'),
    q: text('q'),
    brand: params.getAll('brand'),
    min: text('min'),
    max: text('max'),
    sort: text('sort'),
    page: text('page'),
    spec,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'ตัวกรองไม่ถูกต้อง' }, { status: 400 });
  }
  return NextResponse.json(await getParts(parsed.data));
}
