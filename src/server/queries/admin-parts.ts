import 'server-only';

import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';

import { brands, categories, partPriceHistory, parts } from '@/db/schema';
import { db } from '@/lib/db';
import { type CategorySlug, isCategorySlug, SPEC_FIELDS } from '@/lib/parts/spec-fields';
import type { PartFormValues } from '@/lib/validators/parts';

// คำสั่งอ่านข้อมูลของหลังบ้าน หน้าเว็บที่เรียกต้องผ่าน requireAdmin() ก่อน

export const ADMIN_PAGE_SIZE = 20;

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (m) => `\\${m}`);

/** สถานะที่กรองได้ในหน้าจัดการอะไหล่ */
export const ADMIN_PART_STATUSES = ['active', 'hidden', 'unverified'] as const;
export type AdminPartStatus = (typeof ADMIN_PART_STATUSES)[number];
export const isAdminPartStatus = (value: unknown): value is AdminPartStatus =>
  typeof value === 'string' && (ADMIN_PART_STATUSES as readonly string[]).includes(value);

const STATUS_CONDITION: Record<AdminPartStatus, SQL> = {
  active: eq(parts.isActive, true),
  hidden: eq(parts.isActive, false),
  unverified: eq(parts.specVerified, false),
};

export async function listAdminParts(filters: {
  q?: string | undefined;
  category?: string | undefined;
  brandId?: number | undefined;
  status?: string | undefined;
  page: number;
}) {
  const conditions: (SQL | undefined)[] = [];
  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    conditions.push(or(ilike(parts.model, pattern), ilike(brands.name, pattern)));
  }
  if (isCategorySlug(filters.category)) conditions.push(eq(categories.slug, filters.category));
  if (filters.brandId) conditions.push(eq(parts.brandId, filters.brandId));
  if (isAdminPartStatus(filters.status)) conditions.push(STATUS_CONDITION[filters.status]);
  const where = and(...conditions);

  const [rows, total] = await Promise.all([
    db
      .select({
        id: parts.id,
        model: parts.model,
        slug: parts.slug,
        price: parts.price,
        isActive: parts.isActive,
        specVerified: parts.specVerified,
        categorySlug: categories.slug,
        categoryName: categories.nameTh,
        brandName: brands.name,
      })
      .from(parts)
      .innerJoin(categories, eq(parts.categoryId, categories.id))
      .innerJoin(brands, eq(parts.brandId, brands.id))
      .where(where)
      .orderBy(asc(categories.sortOrder), desc(parts.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((filters.page - 1) * ADMIN_PAGE_SIZE),
    db
      .select({ value: count() })
      .from(parts)
      .innerJoin(categories, eq(parts.categoryId, categories.id))
      .innerJoin(brands, eq(parts.brandId, brands.id))
      .where(where),
  ]);

  return { rows, total: total[0]?.value ?? 0 };
}

/**
 * ตัวเลขบนแท็บหมวดและปุ่มยี่ห้อ: จำนวนอะไหล่ต่อหมวด และต่อยี่ห้อในหมวดที่เลือก
 * แสดงเฉพาะยี่ห้อที่มีอะไหล่ในหมวดนั้นจริง ไม่ต้องไล่ดูยี่ห้อที่ไม่เกี่ยว
 */
export async function getAdminPartFacets(category: string | undefined) {
  const [byCategory, byBrand] = await Promise.all([
    db
      .select({ slug: categories.slug, value: count() })
      .from(parts)
      .innerJoin(categories, eq(parts.categoryId, categories.id))
      .groupBy(categories.slug),
    isCategorySlug(category)
      ? db
          .select({ id: brands.id, name: brands.name, value: count() })
          .from(parts)
          .innerJoin(categories, eq(parts.categoryId, categories.id))
          .innerJoin(brands, eq(parts.brandId, brands.id))
          .where(eq(categories.slug, category))
          .groupBy(brands.id, brands.name)
          .orderBy(asc(brands.name))
      : Promise.resolve([]),
  ]);
  const categoryCounts = Object.fromEntries(byCategory.map((row) => [row.slug, row.value]));
  return { categoryCounts, brands: byBrand };
}

export function listBrands() {
  return db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name));
}

/** แปลงค่าจากฐานข้อมูลเป็นข้อความในช่องฟอร์ม รูปแบบเดียวกับ CSV */
function specToForm(category: CategorySlug, spec: Record<string, unknown>) {
  const form: Record<string, string | boolean> = {};
  for (const field of SPEC_FIELDS[category]) {
    const value = spec[field.key];
    if (field.kind === 'bool') form[field.key] = Boolean(value);
    else if (field.kind === 'connectors') {
      form[field.key] = Object.entries((value ?? {}) as Record<string, number>)
        .map(([name, n]) => `${name}:${n}`)
        .join('|');
    } else if (Array.isArray(value)) form[field.key] = value.join('|');
    else form[field.key] = value === null || value === undefined ? '' : String(value);
  }
  return form;
}

export async function getPartForEdit(id: number) {
  const part = await db.query.parts.findFirst({
    where: eq(parts.id, id),
    with: {
      category: true,
      cpu: true,
      motherboard: true,
      ram: true,
      gpu: true,
      storage: true,
      psu: true,
      case: true,
      cooler: true,
    },
  });
  if (!part || !isCategorySlug(part.category.slug)) return null;
  const category = part.category.slug;

  const history = await db
    .select({ price: partPriceHistory.price, changedAt: partPriceHistory.changedAt })
    .from(partPriceHistory)
    .where(eq(partPriceHistory.partId, id))
    .orderBy(desc(partPriceHistory.changedAt))
    .limit(10);

  const values: PartFormValues = {
    id: part.id,
    categorySlug: category,
    brandId: String(part.brandId),
    model: part.model,
    price: String(part.price),
    powerWatt: part.powerWatt === null ? '' : String(part.powerWatt),
    releaseYear: part.releaseYear === null ? '' : String(part.releaseYear),
    imageUrl: part.imageUrl ?? '',
    specSourceUrl: part.specSourceUrl ?? '',
    specVerified: part.specVerified,
    isActive: part.isActive,
    spec: specToForm(category, (part[category] ?? {}) as Record<string, unknown>),
  };
  return { values, history, category };
}
