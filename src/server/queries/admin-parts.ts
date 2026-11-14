import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

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

/** กรองตามรูป: missing = ยังไม่มีรูป, has = มีรูปแล้ว */
export const ADMIN_IMAGE_FILTERS = ['missing', 'has'] as const;
export type AdminImageFilter = (typeof ADMIN_IMAGE_FILTERS)[number];
export const isAdminImageFilter = (value: unknown): value is AdminImageFilter =>
  typeof value === 'string' && (ADMIN_IMAGE_FILTERS as readonly string[]).includes(value);

// รูปว่าง ('') นับเป็นไม่มีรูปด้วย เผื่อข้อมูลเก่าที่บันทึกช่องว่างไว้
const NO_IMAGE = or(isNull(parts.imageUrl), eq(parts.imageUrl, ''));
const IMAGE_CONDITION: Record<AdminImageFilter, SQL | undefined> = {
  missing: NO_IMAGE,
  has: and(isNotNull(parts.imageUrl), sql`${parts.imageUrl} <> ''`),
};

export async function listAdminParts(filters: {
  q?: string | undefined;
  category?: string | undefined;
  brandId?: number | undefined;
  status?: string | undefined;
  image?: string | undefined;
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
  if (isAdminImageFilter(filters.image)) conditions.push(IMAGE_CONDITION[filters.image]);
  const where = and(...conditions);

  const [rows, total] = await Promise.all([
    db
      .select({
        id: parts.id,
        model: parts.model,
        slug: parts.slug,
        price: parts.price,
        imageUrl: parts.imageUrl,
        isActive: parts.isActive,
        availability: parts.availability,
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
export async function getAdminPartFacets(category: string | undefined, brandId?: number) {
  const [byCategory, byBrand, missing] = await Promise.all([
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
    // จำนวนที่ยังไม่มีรูป ในหมวดและยี่ห้อที่เลือกอยู่ (ไม่สนตัวกรองสถานะและคำค้น)
    db
      .select({ value: count() })
      .from(parts)
      .innerJoin(categories, eq(parts.categoryId, categories.id))
      .where(
        and(
          NO_IMAGE,
          isCategorySlug(category) ? eq(categories.slug, category) : undefined,
          brandId ? eq(parts.brandId, brandId) : undefined,
        ),
      ),
  ]);
  const categoryCounts = Object.fromEntries(byCategory.map((row) => [row.slug, row.value]));
  return { categoryCounts, brands: byBrand, missingImages: missing[0]?.value ?? 0 };
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
    availability: part.availability,
    spec: specToForm(category, (part[category] ?? {}) as Record<string, unknown>),
  };
  return { values, history, category };
}

export const REVIEW_PAGE_SIZE = 10;

/**
 * หน้าตรวจสเปก: ดึงอะไหล่พร้อมสเปกทุกช่องของหมวดตัวเอง เรียงตามหมวด แล้วตามวันที่เพิ่ม (เก่าก่อน)
 * verified=false คือคิวที่ยังไม่ได้ตรวจ ส่วน true ใช้ดูย้อนหลังหรือยกเลิกการตรวจ
 */
export async function listReviewParts(filters: {
  category?: string | undefined;
  verified: boolean;
  page: number;
}) {
  const category = isCategorySlug(filters.category) ? filters.category : undefined;
  const categoryRow = category
    ? await db.query.categories.findFirst({ where: eq(categories.slug, category) })
    : undefined;
  const where = and(
    eq(parts.specVerified, filters.verified),
    categoryRow ? eq(parts.categoryId, categoryRow.id) : undefined,
  );

  const [rows, totalRows, byCategory] = await Promise.all([
    db.query.parts.findMany({
      where,
      with: {
        category: true,
        brand: true,
        cpu: true,
        motherboard: true,
        ram: true,
        gpu: true,
        storage: true,
        psu: true,
        case: true,
        cooler: true,
      },
      orderBy: [asc(parts.categoryId), asc(parts.createdAt), asc(parts.id)],
      limit: REVIEW_PAGE_SIZE,
      offset: (filters.page - 1) * REVIEW_PAGE_SIZE,
    }),
    db.select({ value: count() }).from(parts).where(where),
    db
      .select({ slug: categories.slug, value: count() })
      .from(parts)
      .innerJoin(categories, eq(parts.categoryId, categories.id))
      .where(eq(parts.specVerified, filters.verified))
      .groupBy(categories.slug),
  ]);

  const items = rows.flatMap((part) => {
    const slug = part.category.slug;
    if (!isCategorySlug(slug)) return [];
    return [
      {
        id: part.id,
        model: part.model,
        brandName: part.brand.name,
        categorySlug: slug,
        price: Number(part.price),
        powerWatt: part.powerWatt,
        releaseYear: part.releaseYear,
        isActive: part.isActive,
        specVerified: part.specVerified,
        specSourceUrl: part.specSourceUrl,
        imageUrl: part.imageUrl,
        spec: (part[slug] ?? {}) as Record<string, unknown>,
      },
    ];
  });
  return {
    items,
    total: totalRows[0]?.value ?? 0,
    categoryCounts: Object.fromEntries(byCategory.map((row) => [row.slug, row.value])),
  };
}
