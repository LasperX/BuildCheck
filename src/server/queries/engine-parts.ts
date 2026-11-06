import 'server-only';

import { and, count, eq, inArray } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';

import {
  brands,
  buildItems,
  caseSpecs,
  categories,
  coolerSpecs,
  cpuSpecs,
  gpuSpecs,
  motherboardSpecs,
  parts,
  psuSpecs,
  ramSpecs,
  storageSpecs,
} from '@/db/schema';
import type {
  CaseSpec,
  CoolerSpec,
  CpuSpec,
  EnginePart,
  GpuSpec,
  MotherboardSpec,
  PsuSpec,
  RamSpec,
  StorageSpec,
} from '@/lib/compat';
import { db } from '@/lib/db';
import type { BuilderPart } from '@/lib/builder/types';
import { specChips } from '@/lib/parts/catalog';
import { type CategorySlug, isCategorySlug } from '@/lib/parts/spec-fields';

// แปลงอะไหล่จากฐานข้อมูลเป็นรูปแบบที่ Compatibility Engine ใช้
// Engine ไม่อ่านฐานข้อมูลเอง ไฟล์นี้จึงเป็นตัวกลางที่อ่านแล้วส่งต่อให้

const SPEC_TABLES = {
  cpu: cpuSpecs,
  motherboard: motherboardSpecs,
  ram: ramSpecs,
  gpu: gpuSpecs,
  storage: storageSpecs,
  psu: psuSpecs,
  case: caseSpecs,
  cooler: coolerSpecs,
} as const;

type BaseRow = {
  id: number;
  slug: string;
  model: string;
  price: number;
  powerWatt: number | null;
  releaseYear: number | null;
  imageUrl: string | null;
  isActive: boolean;
  specVerified: boolean;
  brandId: number;
  brandName: string;
  categorySlug: string;
};

const baseColumns = {
  id: parts.id,
  slug: parts.slug,
  model: parts.model,
  price: parts.price,
  powerWatt: parts.powerWatt,
  releaseYear: parts.releaseYear,
  imageUrl: parts.imageUrl,
  isActive: parts.isActive,
  specVerified: parts.specVerified,
  brandId: parts.brandId,
  brandName: brands.name,
  categorySlug: categories.slug,
};

async function readSpecs(category: CategorySlug, ids: number[]) {
  if (ids.length === 0) return new Map<number, Record<string, unknown>>();
  const table = SPEC_TABLES[category];
  const rows: Record<string, unknown>[] = await db
    .select()
    .from(table)
    .where(inArray(table.partId, ids));
  return new Map(rows.map((row) => [row.partId as number, row]));
}

async function usageCounts(ids: number[]) {
  if (ids.length === 0) return new Map<number, number>();
  const rows = await db
    .select({ partId: buildItems.partId, uses: count() })
    .from(buildItems)
    .where(inArray(buildItems.partId, ids))
    .groupBy(buildItems.partId);
  return new Map(rows.map((row) => [row.partId, row.uses]));
}

/** รวมข้อมูลจากตาราง parts กับตารางสเปกของหมวด ถ้าไม่มีแถวสเปกถือว่าข้อมูลไม่ครบ ข้ามไป */
async function assemble(rows: BaseRow[]): Promise<BuilderPart[]> {
  const byCategory = new Map<CategorySlug, number[]>();
  for (const row of rows) {
    if (!isCategorySlug(row.categorySlug)) continue;
    byCategory.set(row.categorySlug, [...(byCategory.get(row.categorySlug) ?? []), row.id]);
  }
  const [specEntries, uses] = await Promise.all([
    Promise.all([...byCategory].map(async ([cat, ids]) => readSpecs(cat, ids))),
    usageCounts(rows.map((row) => row.id)),
  ]);
  const specs = new Map(specEntries.flatMap((map) => [...map]));

  return rows.flatMap((row) => {
    const specRow = specs.get(row.id);
    if (!specRow || !isCategorySlug(row.categorySlug)) return [];
    const { partId: _partId, ...spec } = specRow;
    // คอลัมน์ของตารางสเปกตั้งชื่อตรงกับชนิด CpuSpec, RamSpec ฯลฯ ใน Engine ทุกช่อง
    // TypeScript ยืนยันให้ด้วย SpecRowChecks ท้ายไฟล์ ถ้าแก้ตารางแล้วไม่ตรง typecheck จะล้ม
    const enginePart = {
      id: row.id,
      brandName: row.brandName,
      model: row.model,
      price: row.price,
      powerWatt: row.powerWatt,
      releaseYear: row.releaseYear,
      categorySlug: row.categorySlug,
      spec,
    } as EnginePart;
    return [
      {
        ...enginePart,
        slug: row.slug,
        brandId: row.brandId,
        imageUrl: row.imageUrl,
        isActive: row.isActive,
        specVerified: row.specVerified,
        chips: specChips(row.categorySlug, spec),
        uses: uses.get(row.id) ?? 0,
      },
    ];
  });
}

/** อะไหล่ตามรหัส รวมชิ้นที่ถูกซ่อนแล้ว เพราะสเปกที่บันทึกไว้อาจใช้อยู่ */
export async function getEngineParts(ids: number[]): Promise<BuilderPart[]> {
  'use cache';
  cacheTag('parts');
  cacheLife('minutes');

  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const rows = await db
    .select(baseColumns)
    .from(parts)
    .innerJoin(categories, eq(parts.categoryId, categories.id))
    .innerJoin(brands, eq(parts.brandId, brands.id))
    .where(inArray(parts.id, unique));
  return assemble(rows);
}

/** อะไหล่ทุกชิ้นที่ยังขายในหมวด ใช้ในหน้าต่างเลือกอะไหล่ ตัวกรองอัจฉริยะต้องตรวจทุกชิ้นจึงอ่านทั้งหมวด */
export async function getCategoryEngineParts(category: CategorySlug): Promise<BuilderPart[]> {
  'use cache';
  cacheTag('parts');
  cacheLife('minutes');

  const rows = await db
    .select(baseColumns)
    .from(parts)
    .innerJoin(categories, eq(parts.categoryId, categories.id))
    .innerJoin(brands, eq(parts.brandId, brands.id))
    .where(and(eq(categories.slug, category), eq(parts.isActive, true)));
  return assemble(rows);
}

// ตรวจตอน typecheck ว่าแถวของตารางสเปก (ตัด partId) ใช้แทนชนิดสเปกของ Engine ได้
type RowOf<T extends { $inferSelect: object }> = Omit<T['$inferSelect'], 'partId'>;
type Assert<T extends U, U> = [T, U];
export type SpecRowChecks = [
  Assert<RowOf<typeof cpuSpecs>, CpuSpec>,
  Assert<RowOf<typeof motherboardSpecs>, MotherboardSpec>,
  Assert<RowOf<typeof ramSpecs>, RamSpec>,
  Assert<RowOf<typeof gpuSpecs>, GpuSpec>,
  Assert<RowOf<typeof storageSpecs>, StorageSpec>,
  Assert<RowOf<typeof psuSpecs>, PsuSpec>,
  Assert<RowOf<typeof caseSpecs>, CaseSpec>,
  Assert<RowOf<typeof coolerSpecs>, CoolerSpec>,
];
