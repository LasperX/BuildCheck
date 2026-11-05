import 'server-only';

import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';

import { brands, categories, partPriceHistory, parts } from '@/db/schema';
import { db } from '@/lib/db';
import { type CategorySlug, isCategorySlug, SPEC_FIELDS } from '@/lib/parts/spec-fields';
import type { PartFormValues } from '@/lib/validators/parts';

// คำสั่งอ่านข้อมูลของหลังบ้าน หน้าเว็บที่เรียกต้องผ่าน requireAdmin() ก่อน

export const ADMIN_PAGE_SIZE = 20;

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (m) => `\\${m}`);

export async function listAdminParts(filters: {
  q?: string | undefined;
  category?: string | undefined;
  page: number;
}) {
  const conditions: (SQL | undefined)[] = [];
  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    conditions.push(or(ilike(parts.model, pattern), ilike(brands.name, pattern)));
  }
  if (isCategorySlug(filters.category)) conditions.push(eq(categories.slug, filters.category));
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
