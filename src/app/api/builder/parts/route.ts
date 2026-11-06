import { type NextRequest, NextResponse } from 'next/server';

import { buildParamSchema } from '@/lib/validators/builds';
import { getEngineParts } from '@/server/queries/engine-parts';
import { getUsedPriceSets } from '@/server/queries/used';

// สเปกเต็มของอะไหล่ในสเปกที่กำลังจัด หน้าจัดสเปกเอาไปให้ Engine ตรวจในเบราว์เซอร์
// รับ ?build=12x1,15x2 แบบเดียวกับ API รายการตัวเลือก ข้อมูลสาธารณะ ไม่ต้องล็อกอิน
export async function GET(request: NextRequest) {
  const parsed = buildParamSchema.safeParse(request.nextUrl.searchParams.get('build') ?? '');
  if (!parsed.success) {
    return NextResponse.json({ error: 'รูปแบบสเปกไม่ถูกต้อง' }, { status: 400 });
  }
  const ids = parsed.data.map((item) => item.partId);
  // แนบราคากลางมือสองไปด้วย ผู้ใช้สลับเป็นมือสองได้ทันทีโดยไม่ต้องโหลดใหม่
  const [parts, used] = await Promise.all([getEngineParts(ids), getUsedPriceSets(ids)]);
  return NextResponse.json(parts.map((part) => ({ ...part, used: used[part.id] })));
}
