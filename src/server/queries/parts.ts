import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import type { AnyPgColumn, AnyPgTable } from 'drizzle-orm/pg-core';
import { cacheLife, cacheTag } from 'next/cache';

import {
  brands,
  buildItems,
  builds,
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
  users,
} from '@/db/schema';
import { db } from '@/lib/db';
import {
  type PartFacets,
  type PartListItem,
  type PartsQuery,
  type PartsResponse,
  PARTS_PAGE_SIZE,
  SPEC_FILTERS,
  specChips,
  toPrefixQuery,
} from '@/lib/parts/catalog';
import { type CategorySlug, isCategorySlug } from '@/lib/parts/spec-fields';

// คำสั่งอ่านข้อมูลอะไหล่สำหรับฝั่งผู้ใช้ เห็นเฉพาะรายการที่ is_active เท่านั้น

// ตารางสเปกของแต่ละหมวด ใช้เลือกตารางตามหมวดตอนกรอง และตอนอ่านรายละเอียด
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

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (m) => `\\${m}`);

function searchCondition(q: string | undefined): SQL | undefined {
  const text = q?.trim();
  if (!text) return undefined;
  const prefix = toPrefixQuery(text);
  const like = `%${escapeLike(text)}%`;
  // ภาษาไทยไม่มีตัวตัดคำใน PostgreSQL จึงเสริมด้วย ILIKE ให้หาคำกลางชื่อรุ่นเจอ
  return or(
    prefix ? sql`${parts.searchVector} @@ to_tsquery('simple', ${prefix})` : undefined,
    ilike(parts.model, like),
  );
}

const specColumn = (category: CategorySlug, key: string): AnyPgColumn | undefined => {
  if (!SPEC_FILTERS[category].some((filter) => filter.key === key)) return undefined;
  return (SPEC_TABLES[category] as unknown as Record<string, AnyPgColumn>)[key];
};

export async function getParts(query: PartsQuery): Promise<PartsResponse> {
  const { category, q, brand, min, max, sort, page, spec, availability } = query;

  const conditions: (SQL | undefined)[] = [eq(parts.isActive, true), searchCondition(q)];
  if (category) conditions.push(eq(categories.slug, category));
  if (brand.length) conditions.push(inArray(parts.brandId, brand));
  if (availability) conditions.push(eq(parts.availability, availability));
  if (min !== undefined) conditions.push(gte(parts.price, min));
  if (max !== undefined) conditions.push(lte(parts.price, max));

  // ตัวกรองสเปกใช้ได้เมื่อระบุหมวด คอลัมน์ที่ไม่อยู่ในรายการอนุญาตจะถูกข้าม
  const specTable: AnyPgTable | undefined = category ? SPEC_TABLES[category] : undefined;
  if (category) {
    for (const [key, values] of Object.entries(spec)) {
      const column = specColumn(category, key);
      if (column && values.length) {
        conditions.push(sql`${column}::text IN ${values}`);
      }
    }
  }
  const where = and(...conditions);

  const usage = db
    .select({ partId: buildItems.partId, uses: count().as('uses') })
    .from(buildItems)
    .groupBy(buildItems.partId)
    .as('usage');

  const orderBy = {
    popular: [desc(sql`coalesce(${usage.uses}, 0)`), asc(parts.price)],
    newest: [desc(parts.releaseYear), desc(parts.createdAt)],
    price_asc: [asc(parts.price)],
    price_desc: [desc(parts.price)],
  }[sort];

  const baseRows = db
    .select({
      id: parts.id,
      slug: parts.slug,
      model: parts.model,
      price: parts.price,
      imageUrl: parts.imageUrl,
      specVerified: parts.specVerified,
      availability: parts.availability,
      brandName: brands.name,
      categorySlug: categories.slug,
    })
    .from(parts)
    .innerJoin(categories, eq(parts.categoryId, categories.id))
    .innerJoin(brands, eq(parts.brandId, brands.id))
    .leftJoin(usage, eq(usage.partId, parts.id))
    .$dynamic();
  const baseCount = db
    .select({ value: count() })
    .from(parts)
    .innerJoin(categories, eq(parts.categoryId, categories.id))
    .$dynamic();

  if (category && specTable) {
    const partIdColumn = SPEC_TABLES[category].partId;
    baseRows.innerJoin(specTable, eq(partIdColumn, parts.id));
    baseCount.innerJoin(specTable, eq(partIdColumn, parts.id));
  }

  const [rows, totalRows] = await Promise.all([
    baseRows
      .where(where)
      .orderBy(...orderBy)
      .limit(PARTS_PAGE_SIZE)
      .offset((page - 1) * PARTS_PAGE_SIZE),
    baseCount.where(where),
  ]);

  return {
    items: await withChips(rows),
    total: totalRows[0]?.value ?? 0,
    page,
    pageSize: PARTS_PAGE_SIZE,
  };
}

type RawRow = Omit<PartListItem, 'chips' | 'categorySlug'> & { categorySlug: string };

/** อ่านสเปกของรายการในหน้านั้นครั้งเดียวต่อหมวด เพื่อทำป้ายบนการ์ด */
async function withChips(rows: RawRow[]): Promise<PartListItem[]> {
  const byCategory = new Map<CategorySlug, number[]>();
  for (const row of rows) {
    if (!isCategorySlug(row.categorySlug)) continue;
    byCategory.set(row.categorySlug, [...(byCategory.get(row.categorySlug) ?? []), row.id]);
  }

  const specs = new Map<number, Record<string, unknown>>();
  await Promise.all(
    [...byCategory].map(async ([category, ids]) => {
      const table = SPEC_TABLES[category];
      const specRows: Record<string, unknown>[] = await db
        .select()
        .from(table)
        .where(inArray(table.partId, ids));
      for (const spec of specRows) specs.set(spec.partId as number, spec);
    }),
  );

  return rows.flatMap((row) => {
    if (!isCategorySlug(row.categorySlug)) return [];
    return [
      {
        ...row,
        categorySlug: row.categorySlug,
        chips: specChips(row.categorySlug, specs.get(row.id) ?? {}),
      },
    ];
  });
}

/**
 * หน้าแรกของคลังอะไหล่ (ไม่มีตัวกรอง) เรนเดอร์มากับ HTML เลย ไม่ต้องรอเบราว์เซอร์เรียก API
 * หน้าจึงไม่มีจังหวะโครงโหลดแล้วกระตุก (Lighthouse CLS) และรูปการ์ดแถวแรกเริ่มโหลดได้เร็วขึ้น
 */
export async function getDefaultParts(category?: CategorySlug): Promise<PartsResponse> {
  'use cache';
  cacheTag('parts');
  cacheLife('minutes');

  return getParts({ category, brand: [], sort: 'popular', page: 1, spec: {} });
}

/** ตัวเลือกในตัวกรอง: ยี่ห้อที่มีของในหมวด และค่าที่มีจริงของแต่ละคอลัมน์สเปก */
export async function getPartFacets(category: CategorySlug): Promise<PartFacets> {
  'use cache';
  cacheTag('parts');
  cacheLife('minutes');

  const table = SPEC_TABLES[category];
  const [brandRows, specRows] = await Promise.all([
    db
      .selectDistinct({ id: brands.id, name: brands.name })
      .from(parts)
      .innerJoin(brands, eq(parts.brandId, brands.id))
      .innerJoin(categories, eq(parts.categoryId, categories.id))
      .where(and(eq(parts.isActive, true), eq(categories.slug, category)))
      .orderBy(brands.name),
    Promise.all(
      SPEC_FILTERS[category].map(async (filter) => {
        const column = specColumn(category, filter.key);
        if (!column) return { ...filter, values: [] };
        const values = await db
          .selectDistinct({ value: sql<string>`${column}::text` })
          .from(table)
          .innerJoin(parts, eq(parts.id, table.partId))
          .where(eq(parts.isActive, true));
        const sorted = values
          .map((row) => row.value)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
        return { ...filter, values: sorted };
      }),
    ),
  ]);
  return { brands: brandRows, spec: specRows };
}

export type PartDetail = {
  id: number;
  slug: string;
  model: string;
  price: number;
  imageUrl: string | null;
  releaseYear: number | null;
  powerWatt: number | null;
  specVerified: boolean;
  availability: 'new' | 'used_only';
  specSourceUrl: string | null;
  updatedAt: Date;
  brandName: string;
  categorySlug: CategorySlug;
  categoryName: string;
  spec: Record<string, unknown>;
  chips: string[];
  history: { price: number; changedAt: Date }[];
  usedInBuilds: number;
};

/**
 * เก็บผลไว้ในแคชเพื่อให้หน้าโหลดเร็ว และล้างด้วย updateTag('parts') เมื่อแอดมินแก้อะไหล่
 * ใช้ได้กับทุกคนเพราะข้อมูลไม่ขึ้นกับผู้ใช้
 */
export async function getPartDetail(
  categorySlug: string,
  slug: string,
): Promise<PartDetail | null> {
  'use cache';
  cacheTag('parts');
  cacheLife('minutes');

  if (!isCategorySlug(categorySlug)) return null;
  const [part] = await db
    .select({
      id: parts.id,
      slug: parts.slug,
      model: parts.model,
      price: parts.price,
      imageUrl: parts.imageUrl,
      releaseYear: parts.releaseYear,
      powerWatt: parts.powerWatt,
      specVerified: parts.specVerified,
      availability: parts.availability,
      specSourceUrl: parts.specSourceUrl,
      updatedAt: parts.updatedAt,
      brandName: brands.name,
      categoryName: categories.nameTh,
    })
    .from(parts)
    .innerJoin(categories, eq(parts.categoryId, categories.id))
    .innerJoin(brands, eq(parts.brandId, brands.id))
    .where(and(eq(parts.slug, slug), eq(categories.slug, categorySlug), eq(parts.isActive, true)));
  if (!part) return null;

  const table = SPEC_TABLES[categorySlug];
  const [specRows, history, used] = await Promise.all([
    db.select().from(table).where(eq(table.partId, part.id)) as Promise<Record<string, unknown>[]>,
    db
      .select({ price: partPriceHistory.price, changedAt: partPriceHistory.changedAt })
      .from(partPriceHistory)
      .where(eq(partPriceHistory.partId, part.id))
      .orderBy(asc(partPriceHistory.changedAt)),
    db
      .select({ value: sql<number>`count(distinct ${buildItems.buildId})::int` })
      .from(buildItems)
      .where(eq(buildItems.partId, part.id)),
  ]);
  const spec = specRows[0] ?? {};

  return {
    ...part,
    categorySlug,
    spec,
    chips: specChips(categorySlug, spec),
    history,
    usedInBuilds: used[0]?.value ?? 0,
  };
}

/** สเปกสาธารณะยอดนิยมที่ใช้อะไหล่ชิ้นนี้ */
export async function getPopularBuildsUsingPart(partId: number) {
  'use cache';
  cacheTag('parts', 'builds');
  cacheLife('minutes');

  return db
    .selectDistinct({
      id: builds.id,
      title: builds.title,
      totalPrice: builds.totalPrice,
      voteScore: builds.voteScore,
      usageType: builds.usageType,
      ownerName: users.displayName,
      ownerRole: users.role,
    })
    .from(buildItems)
    .innerJoin(builds, eq(buildItems.buildId, builds.id))
    .innerJoin(users, eq(builds.userId, users.id))
    .where(and(eq(buildItems.partId, partId), eq(builds.visibility, 'public')))
    .orderBy(desc(builds.voteScore))
    .limit(6);
}

export async function getCategoryCounts() {
  'use cache';
  cacheTag('parts');
  cacheLife('minutes');

  return db
    .select({
      slug: categories.slug,
      nameTh: categories.nameTh,
      icon: categories.icon,
      total: sql<number>`count(${parts.id}) filter (where ${parts.isActive})::int`,
    })
    .from(categories)
    .leftJoin(parts, eq(parts.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(categories.sortOrder);
}

/** อะไหล่ที่เพิ่มเข้าระบบล่าสุด สำหรับหน้าแรก (หัวข้อ 5.1 "อะไหล่มาใหม่") */
export async function getNewestParts(limit = 8) {
  'use cache';
  cacheTag('parts');
  cacheLife('minutes');

  const rows = await db
    .select({
      id: parts.id,
      slug: parts.slug,
      model: parts.model,
      price: parts.price,
      imageUrl: parts.imageUrl,
      brandName: brands.name,
      categorySlug: categories.slug,
    })
    .from(parts)
    .innerJoin(categories, eq(parts.categoryId, categories.id))
    .innerJoin(brands, eq(parts.brandId, brands.id))
    .where(eq(parts.isActive, true))
    .orderBy(desc(parts.createdAt), desc(parts.id))
    .limit(limit);
  return rows.flatMap((row) =>
    isCategorySlug(row.categorySlug) ? [{ ...row, categorySlug: row.categorySlug }] : [],
  );
}
