import { type NextRequest, NextResponse } from 'next/server';

import { rankCandidates } from '@/lib/builder/candidates';
import type { EngineItem } from '@/lib/compat';
import { candidatesQuerySchema } from '@/lib/validators/builds';
import { getCategoryEngineParts, getEngineParts } from '@/server/queries/engine-parts';
import { getSystemConfig } from '@/server/queries/settings';
import { getUsedPriceSets } from '@/server/queries/used';

// รายการอะไหล่ในหน้าต่างเลือก พร้อมป้ายเข้ากันได้/ไม่ได้ (getCompatibleParts ในหัวข้อ 8.3)
// ตรวจบนเซิร์ฟเวอร์ เพราะต้องลองใส่ทุกชิ้นในหมวด ไม่ต้องส่งสเปกของทุกชิ้นไปที่เบราว์เซอร์
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const spec: Record<string, string[]> = {};
  for (const key of new Set(params.keys())) {
    if (key.startsWith('spec.')) spec[key.slice(5)] = params.getAll(key);
  }
  const text = (name: string) => params.get(name) || undefined;

  const parsed = candidatesQuerySchema.safeParse({
    category: text('category'),
    q: text('q'),
    brand: params.getAll('brand'),
    min: text('min'),
    max: text('max'),
    sort: text('sort'),
    page: text('page'),
    spec,
    smart: text('smart'),
    build: text('build'),
    replace: text('replace'),
    near: text('near'),
    usage: text('usage'),
    fix: text('fix'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'ตัวกรองไม่ถูกต้อง' }, { status: 400 });
  }
  const query = parsed.data;

  const [all, buildParts, config] = await Promise.all([
    getCategoryEngineParts(query.category),
    getEngineParts(query.build.map((item) => item.partId)),
    getSystemConfig(),
  ]);
  const byId = new Map(buildParts.map((part) => [part.id, part]));
  const current: EngineItem[] = query.build.flatMap(({ partId, quantity }) => {
    const part = byId.get(partId);
    return part ? [{ part, quantity, condition: 'new' as const }] : [];
  });

  const ranked = rankCandidates(all, current, query, config.engine);
  // แนบราคากลางมือสองของชิ้นในหน้านี้ ให้หน้าต่างเลือกแสดงราคามือสองได้ (เฉพาะหน้าที่แสดง ไม่ใช่ทั้งหมวด)
  const used = await getUsedPriceSets(ranked.items.map((item) => item.id));
  return NextResponse.json({
    ...ranked,
    items: ranked.items.map((item) => ({ ...item, used: used[item.id] })),
  });
}
