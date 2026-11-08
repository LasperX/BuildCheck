import { and, eq, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from './schema';
import {
  brands,
  caseSpecs,
  categories,
  coolerSpecs,
  cpuSpecs,
  gpuSpecs,
  motherboardSpecs,
  partPriceHistory,
  parts,
  psuSpecs,
  ramSpecs,
  storageSpecs,
} from './schema';

import type { PartInput } from '@/lib/validators/parts';

// โค้ดเขียนอะไหล่ลงฐานข้อมูล ใช้ร่วมกันทั้งฟอร์มหลังบ้าน การนำเข้า CSV และสคริปต์ Seed
// ไฟล์นี้ไม่ตรวจสิทธิ์ ผู้เรียกที่เป็น Server Action ต้องตรวจก่อนเสมอ

type Database = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** ทำชื่อใน URL จากยี่ห้อ + รุ่น เช่น "ASUS TUF B650" -> "asus-tuf-b650" */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9฀-๿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 170);
}

async function uniqueSlug(tx: Tx, base: string, ignoreId?: number): Promise<string> {
  const root = base || 'part';
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const conditions = [eq(parts.slug, candidate)];
    if (ignoreId) conditions.push(ne(parts.id, ignoreId));
    const [taken] = await tx
      .select({ id: parts.id })
      .from(parts)
      .where(and(...conditions));
    if (!taken) return candidate;
  }
}

async function writeSpec(tx: Tx, input: PartInput, partId: number) {
  // switch ตามหมวด TypeScript จึงรู้ว่า spec ของแต่ละกรณีตรงกับตารางไหน
  switch (input.categorySlug) {
    case 'cpu':
      await tx
        .insert(cpuSpecs)
        .values({ partId, ...input.spec })
        .onConflictDoUpdate({ target: cpuSpecs.partId, set: input.spec });
      break;
    case 'motherboard':
      await tx
        .insert(motherboardSpecs)
        .values({ partId, ...input.spec })
        .onConflictDoUpdate({ target: motherboardSpecs.partId, set: input.spec });
      break;
    case 'ram':
      await tx
        .insert(ramSpecs)
        .values({ partId, ...input.spec })
        .onConflictDoUpdate({ target: ramSpecs.partId, set: input.spec });
      break;
    case 'gpu':
      await tx
        .insert(gpuSpecs)
        .values({ partId, ...input.spec })
        .onConflictDoUpdate({ target: gpuSpecs.partId, set: input.spec });
      break;
    case 'storage':
      await tx
        .insert(storageSpecs)
        .values({ partId, ...input.spec })
        .onConflictDoUpdate({ target: storageSpecs.partId, set: input.spec });
      break;
    case 'psu':
      await tx
        .insert(psuSpecs)
        .values({ partId, ...input.spec })
        .onConflictDoUpdate({ target: psuSpecs.partId, set: input.spec });
      break;
    case 'case':
      await tx
        .insert(caseSpecs)
        .values({ partId, ...input.spec })
        .onConflictDoUpdate({ target: caseSpecs.partId, set: input.spec });
      break;
    case 'cooler':
      await tx
        .insert(coolerSpecs)
        .values({ partId, ...input.spec })
        .onConflictDoUpdate({ target: coolerSpecs.partId, set: input.spec });
      break;
  }
}

export type WritePartResult = {
  id: number;
  created: boolean;
  priceChanged: boolean;
  before: { price: number; model: string } | null;
};

/** เพิ่มหรือแก้อะไหล่พร้อมสเปก ถ้าเป็นอะไหล่ใหม่หรือราคาเปลี่ยนจะบันทึกประวัติราคา */
export async function writePart(
  tx: Tx,
  input: PartInput,
  changedBy: string | null,
): Promise<WritePartResult> {
  const [category] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, input.categorySlug));
  if (!category) throw new Error(`ไม่พบหมวด ${input.categorySlug}`);

  const [brand] = await tx
    .select({ name: brands.name })
    .from(brands)
    .where(eq(brands.id, input.brandId));
  if (!brand) throw new Error('ไม่พบยี่ห้อที่เลือก');

  const common = {
    brandId: input.brandId,
    model: input.model,
    price: input.price,
    powerWatt: input.powerWatt,
    imageUrl: input.imageUrl,
    releaseYear: input.releaseYear,
    specSourceUrl: input.specSourceUrl,
    specVerified: input.specVerified,
    isActive: input.isActive,
    availability: input.availability,
  };
  const slugBase = slugify(`${brand.name} ${input.model}`);

  if (input.id) {
    const [existing] = await tx
      .select({ price: parts.price, model: parts.model, categoryId: parts.categoryId })
      .from(parts)
      .where(eq(parts.id, input.id));
    if (!existing) throw new Error('ไม่พบอะไหล่ที่ต้องการแก้');
    // เปลี่ยนหมวดไม่ได้ เพราะสเปกอยู่คนละตาราง ถ้าเปลี่ยนสเปกเดิมจะค้าง
    if (existing.categoryId !== category.id) throw new Error('เปลี่ยนหมวดของอะไหล่ที่มีอยู่ไม่ได้');

    const slug = await uniqueSlug(tx, slugBase, input.id);
    await tx
      .update(parts)
      .set({ ...common, slug })
      .where(eq(parts.id, input.id));
    await writeSpec(tx, input, input.id);

    const priceChanged = existing.price !== input.price;
    if (priceChanged) {
      await tx.insert(partPriceHistory).values({ partId: input.id, price: input.price, changedBy });
    }
    return {
      id: input.id,
      created: false,
      priceChanged,
      before: { price: existing.price, model: existing.model },
    };
  }

  const slug = await uniqueSlug(tx, slugBase);
  const [row] = await tx
    .insert(parts)
    .values({ ...common, slug, categoryId: category.id })
    .returning({ id: parts.id });
  if (!row) throw new Error('บันทึกอะไหล่ไม่สำเร็จ');

  await writeSpec(tx, input, row.id);
  await tx.insert(partPriceHistory).values({ partId: row.id, price: input.price, changedBy });
  return { id: row.id, created: true, priceChanged: true, before: null };
}
