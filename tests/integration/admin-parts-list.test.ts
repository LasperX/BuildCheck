import { and, count, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { brands, categories, parts } from '@/db/schema';
import { db } from '@/lib/db';
import { getAdminPartFacets, listAdminParts } from '@/server/queries/admin-parts';

// ตัวกรองหน้าจัดการอะไหล่: แท็บหมวด ปุ่มยี่ห้อ และสถานะ
// เทียบกับการนับตรงจากฐานข้อมูล จึงใช้ได้ไม่ว่าข้อมูลอะไหล่ตอนนั้นจะเป็นชุดไหน (อ่านอย่างเดียว ไม่แก้ข้อมูล)

const countWhere = async (...conditions: Parameters<typeof and>) => {
  const [row] = await db
    .select({ value: count() })
    .from(parts)
    .innerJoin(categories, eq(parts.categoryId, categories.id))
    .where(and(...conditions));
  return row?.value ?? 0;
};

describe('ตัวกรองหน้าจัดการอะไหล่', () => {
  it('ตัวเลขบนแท็บหมวดตรงกับจำนวนในฐานข้อมูล และรวมกันได้เท่าทั้งหมด', async () => {
    const { categoryCounts } = await getAdminPartFacets(undefined);
    expect(categoryCounts.cpu).toBe(await countWhere(eq(categories.slug, 'cpu')));
    const sum = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(await countWhere());
  });

  it('เลือกหมวดแล้วได้เฉพาะยี่ห้อที่มีอะไหล่หมวดนั้น และผลรวมเท่าจำนวนในหมวด', async () => {
    const { brands: cpuBrands, categoryCounts } = await getAdminPartFacets('cpu');
    expect(cpuBrands.length).toBeGreaterThan(0);
    expect(cpuBrands.reduce((a, b) => a + b.value, 0)).toBe(categoryCounts.cpu);
    for (const brand of cpuBrands) expect(brand.value).toBeGreaterThan(0);
  });

  it('ไม่ได้เลือกหมวด ไม่มีปุ่มยี่ห้อ', async () => {
    expect((await getAdminPartFacets(undefined)).brands).toEqual([]);
    expect((await getAdminPartFacets('ไม่มีหมวดนี้')).brands).toEqual([]);
  });

  it('กรองหมวด + ยี่ห้อ ได้เฉพาะรุ่นของยี่ห้อนั้นในหมวดนั้น', async () => {
    const { brands: cpuBrands } = await getAdminPartFacets('cpu');
    const brand = cpuBrands[0];
    if (!brand) throw new Error('ไม่มี CPU ในฐานข้อมูล');
    const { rows, total } = await listAdminParts({ category: 'cpu', brandId: brand.id, page: 1 });
    expect(total).toBe(brand.value);
    for (const row of rows) {
      expect(row.categorySlug).toBe('cpu');
      expect(row.brandName).toBe(brand.name);
    }
  });

  it('กรองสถานะ แสดงอยู่ / ซ่อนอยู่ / รอตรวจสอบ', async () => {
    const active = await listAdminParts({ status: 'active', page: 1 });
    const hidden = await listAdminParts({ status: 'hidden', page: 1 });
    const unverified = await listAdminParts({ status: 'unverified', page: 1 });
    expect(active.total).toBe(await countWhere(eq(parts.isActive, true)));
    expect(hidden.total).toBe(await countWhere(eq(parts.isActive, false)));
    expect(unverified.total).toBe(await countWhere(eq(parts.specVerified, false)));
    expect(active.rows.every((row) => row.isActive)).toBe(true);
    expect(hidden.rows.every((row) => !row.isActive)).toBe(true);
    expect(unverified.rows.every((row) => !row.specVerified)).toBe(true);
  });

  it('ค่าสถานะที่ไม่รู้จักถูกเพิกเฉย ไม่ทำให้ผลว่าง', async () => {
    const all = await listAdminParts({ page: 1 });
    const unknown = await listAdminParts({ status: "x' OR 1=1 --", page: 1 });
    expect(unknown.total).toBe(all.total);
  });

  it('ยี่ห้อที่ไม่มีอะไหล่ในหมวดนั้น ได้ผลว่าง', async () => {
    const [otherBrand] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.name, '__ไม่มียี่ห้อนี้__'));
    const { total } = await listAdminParts({
      category: 'cpu',
      brandId: otherBrand?.id ?? 2_000_000_000,
      page: 1,
    });
    expect(total).toBe(0);
  });
});
