import 'server-only';

import { and, count, desc, eq, gte, ilike, inArray, lte, type SQL } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';

import {
  brands,
  categories,
  partUsedPrices,
  partUsedStats,
  parts,
  priceAlerts,
  usedPriceReports,
  users,
} from '@/db/schema';
import type { UsedPriceSet, UsedStatView } from '@/lib/builder/used-types';
import {
  resolveUsedStat,
  roundTo50,
  USED_GRADES,
  type UsedGrade,
  weeklyTrend,
  weightedPercentile,
  reportWeight,
  SURVEY_MAX_AGE_DAYS,
} from '@/lib/compat/used-price';
import { db } from '@/lib/db';
import { type CategorySlug, isCategorySlug } from '@/lib/parts/spec-fields';
import { todayInThailand } from '@/server/used/stats';

import { getSystemConfig } from './settings';

// อ่านราคามือสองสำหรับหน้าเว็บ ข้อมูลเป็นสาธารณะ แคชไว้ด้วย tag 'used-prices'
// ไม่แสดงชื่อผู้รายงานบนหน้าสาธารณะ (หัวข้อ 9.1 ข้อมูลส่วนตัว)

const daysAgo = (today: string, days: number) =>
  new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

/**
 * ราคากลางครบ 3 เกรดของอะไหล่ที่ระบุ
 * ชิ้นที่ยังไม่เคยคำนวณ (เพิ่มเข้าระบบหลังรอบคำนวณล่าสุด) ใช้สูตรประมาณการสด จึงมีราคาเสมอ
 */
export async function getUsedPriceSets(ids: number[]): Promise<Record<number, UsedPriceSet>> {
  'use cache';
  cacheTag('used-prices', 'parts');
  cacheLife('hours');

  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};
  const [rows, partRows, config] = await Promise.all([
    db.select().from(partUsedStats).where(inArray(partUsedStats.partId, unique)),
    db
      .select({
        id: parts.id,
        price: parts.price,
        releaseYear: parts.releaseYear,
        categorySlug: categories.slug,
      })
      .from(parts)
      .innerJoin(categories, eq(parts.categoryId, categories.id))
      .where(inArray(parts.id, unique)),
    getSystemConfig(),
  ]);

  const stored = new Map(rows.map((row) => [`${row.partId}:${row.grade}`, row]));
  const today = todayInThailand();
  const result: Record<number, UsedPriceSet> = {};
  for (const part of partRows) {
    if (!isCategorySlug(part.categorySlug)) continue;
    const category = part.categorySlug;
    const entry = (grade: UsedGrade): UsedStatView => {
      const row = stored.get(`${part.id}:${grade}`);
      if (row) {
        return {
          grade,
          median: row.medianPrice,
          p25: row.p25Price,
          p75: row.p75Price,
          reportCount: row.reportCount,
          source: row.source,
          confidence: row.confidence,
          updatedAt: row.computedAt.toISOString(),
        };
      }
      const stat = resolveUsedStat({
        part: { price: part.price, categorySlug: category, releaseYear: part.releaseYear },
        grade,
        reports: [],
        survey: null,
        today,
        settings: config.used,
      });
      return { ...stat, updatedAt: `${today}T00:00:00.000Z` };
    };
    result[part.id] = { A: entry('A'), B: entry('B'), C: entry('C') };
  }
  return result;
}

export type PublicReport = {
  id: number;
  partId: number;
  grade: UsedGrade;
  price: number;
  reportType: 'listed' | 'bought' | 'sold';
  channel: 'facebook' | 'marketplace_app' | 'shop' | 'friend' | 'other';
  province: string | null;
  warrantyMonthsLeft: number;
  seenAt: string;
};

const publicReportColumns = {
  id: usedPriceReports.id,
  partId: usedPriceReports.partId,
  grade: usedPriceReports.grade,
  price: usedPriceReports.price,
  reportType: usedPriceReports.reportType,
  channel: usedPriceReports.channel,
  province: usedPriceReports.province,
  warrantyMonthsLeft: usedPriceReports.warrantyMonthsLeft,
  seenAt: usedPriceReports.seenAt,
};

export type TrendPoint = { week: string; median: number; count: number };

export type PartUsedDetail = {
  prices: UsedPriceSet | null;
  trend: Record<UsedGrade, TrendPoint[]>;
  latest: PublicReport[];
};

/** แท็บราคามือสองในหน้ารายละเอียดอะไหล่: ราคากลาง กราฟรายสัปดาห์ 26 สัปดาห์ และรายงานล่าสุด */
export async function getPartUsedDetail(partId: number): Promise<PartUsedDetail> {
  'use cache';
  cacheTag('used-prices', 'parts');
  cacheLife('hours');

  const today = todayInThailand();
  const [sets, reports] = await Promise.all([
    getUsedPriceSets([partId]),
    db
      .select(publicReportColumns)
      .from(usedPriceReports)
      .where(
        and(
          eq(usedPriceReports.partId, partId),
          eq(usedPriceReports.status, 'approved'),
          gte(usedPriceReports.seenAt, daysAgo(today, 26 * 7)),
        ),
      )
      .orderBy(desc(usedPriceReports.seenAt), desc(usedPriceReports.id)),
  ]);

  const trend = Object.fromEntries(
    USED_GRADES.map((grade) => [grade, weeklyTrend(reports.filter((r) => r.grade === grade))]),
  ) as Record<UsedGrade, TrendPoint[]>;
  return { prices: sets[partId] ?? null, trend, latest: reports.slice(0, 10) };
}

export type MarketPart = {
  partId: number;
  slug: string;
  model: string;
  brandName: string;
  categorySlug: CategorySlug;
  newPrice: number;
};

export type MarketDrop = MarketPart & {
  grade: UsedGrade;
  before: number;
  now: number;
  drop: number;
};
export type MarketPopular = MarketPart & { reports: number };
export type MarketReport = PublicReport & MarketPart;

export type UsedMarket = {
  drops: MarketDrop[];
  popular: MarketPopular[];
  latest: MarketReport[];
  results: (MarketPart & { prices: UsedPriceSet })[] | null;
  /** ราคากลางทุกรุ่น ใช้ตอนไม่ได้ค้นหา */
  overview: (MarketPart & { prices: UsedPriceSet })[];
};

export type MarketFilters = { q?: string; category?: CategorySlug; grade?: UsedGrade };

const partColumns = {
  partId: parts.id,
  slug: parts.slug,
  model: parts.model,
  brandName: brands.name,
  categorySlug: categories.slug,
  newPrice: parts.price,
};

const asMarketPart = <T extends { categorySlug: string }>(row: T) =>
  isCategorySlug(row.categorySlug) ? [{ ...row, categorySlug: row.categorySlug }] : [];

/**
 * หน้าตลาดมือสอง
 *   ราคาลดมากสุดเดือนนี้ = เทียบราคากลางของรายงานใน 30 วันล่าสุด กับ 31–60 วันก่อน
 *   (แต่ละช่วงต้องมีอย่างน้อย 2 รายงาน จึงไม่เอาราคาจากรายงานเดี่ยวมาตัดสิน)
 *   รุ่นที่ถูกรายงานบ่อย = จำนวนรายงานที่อนุมัติใน 60 วันล่าสุด
 */
export async function getUsedMarket(filters: MarketFilters): Promise<UsedMarket> {
  'use cache';
  cacheTag('used-prices', 'parts');
  cacheLife('hours');

  const today = todayInThailand();
  const since = daysAgo(today, 60);
  const monthAgo = daysAgo(today, 30);
  const where: (SQL | undefined)[] = [
    eq(usedPriceReports.status, 'approved'),
    eq(parts.isActive, true),
    gte(usedPriceReports.seenAt, since),
    lte(usedPriceReports.seenAt, today),
  ];
  if (filters.category) where.push(eq(categories.slug, filters.category));
  if (filters.grade) where.push(eq(usedPriceReports.grade, filters.grade));

  const recent = await db
    .select({ ...publicReportColumns, ...partColumns })
    .from(usedPriceReports)
    .innerJoin(parts, eq(parts.id, usedPriceReports.partId))
    .innerJoin(brands, eq(brands.id, parts.brandId))
    .innerJoin(categories, eq(categories.id, parts.categoryId))
    .where(and(...where))
    .orderBy(desc(usedPriceReports.seenAt), desc(usedPriceReports.id));
  const reports = recent.flatMap(asMarketPart);

  // ราคาลดมากสุด แยกตามรุ่นและเกรด
  const groups = new Map<string, MarketReport[]>();
  for (const report of reports) {
    const key = `${report.partId}:${report.grade}`;
    groups.set(key, [...(groups.get(key) ?? []), report]);
  }
  const median = (list: MarketReport[]) =>
    roundTo50(
      weightedPercentile(
        list.map((r) => ({ value: r.price, weight: reportWeight(0, r.reportType) })),
        0.5,
      ),
    );
  const drops: MarketDrop[] = [];
  for (const list of groups.values()) {
    const latest = list.filter((r) => r.seenAt > monthAgo);
    const earlier = list.filter((r) => r.seenAt <= monthAgo);
    const first = list[0];
    if (!first || latest.length < 2 || earlier.length < 2) continue;
    const before = median(earlier);
    const now = median(latest);
    if (before <= 0 || now >= before) continue;
    drops.push({ ...first, before, now, drop: (before - now) / before });
  }
  drops.sort((a, b) => b.drop - a.drop);

  const counts = new Map<number, MarketPopular>();
  for (const report of reports) {
    const found = counts.get(report.partId);
    if (found) found.reports += 1;
    else {
      const { partId, slug, model, brandName, categorySlug, newPrice } = report;
      counts.set(partId, { partId, slug, model, brandName, categorySlug, newPrice, reports: 1 });
    }
  }
  const popular = [...counts.values()].sort((a, b) => b.reports - a.reports).slice(0, 8);

  /** รุ่นที่ตรงเงื่อนไขพร้อมราคากลางทั้ง 3 เกรด (ราคาจากรายงาน การสำรวจ หรือสูตรประมาณค่าเสื่อม) */
  const withPrices = async (cond: (SQL | undefined)[], limit: number) => {
    if (filters.category) cond.push(eq(categories.slug, filters.category));
    const found = (
      await db
        .select(partColumns)
        .from(parts)
        .innerJoin(brands, eq(brands.id, parts.brandId))
        .innerJoin(categories, eq(categories.id, parts.categoryId))
        .where(and(...cond))
        .orderBy(categories.sortOrder, parts.model)
        .limit(limit)
    ).flatMap(asMarketPart);
    const sets = await getUsedPriceSets(found.map((part) => part.partId));
    return found.flatMap((part) => {
      const prices = sets[part.partId];
      return prices ? [{ ...part, prices }] : [];
    });
  };

  let results: UsedMarket['results'] = null;
  let overview: UsedMarket['overview'] = [];
  const q = filters.q?.trim();
  if (q) {
    results = await withPrices(
      [eq(parts.isActive, true), ilike(parts.model, `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)],
      20,
    );
  } else {
    // ไม่ได้ค้นหา: แสดงราคากลางของทุกรุ่นในหมวด หน้าไม่ว่างแม้ยังไม่มีรายงานจากสมาชิก
    overview = await withPrices([eq(parts.isActive, true)], 200);
  }

  return { drops: drops.slice(0, 8), popular, latest: reports.slice(0, 20), results, overview };
}

// ---------- ฝั่งสมาชิก ----------

export type AlertRow = MarketPart & {
  id: number;
  grade: UsedGrade;
  targetPrice: number;
  triggeredAt: Date | null;
  createdAt: Date;
  current: number | null;
};

/** เตือนราคาของฉัน พร้อมราคากลางปัจจุบัน (ไม่แคช เป็นข้อมูลส่วนตัว) */
export async function getMyPriceAlerts(userId: string): Promise<AlertRow[]> {
  const rows = await db
    .select({
      id: priceAlerts.id,
      grade: priceAlerts.grade,
      targetPrice: priceAlerts.targetPrice,
      triggeredAt: priceAlerts.triggeredAt,
      createdAt: priceAlerts.createdAt,
      ...partColumns,
    })
    .from(priceAlerts)
    .innerJoin(parts, eq(parts.id, priceAlerts.partId))
    .innerJoin(brands, eq(brands.id, parts.brandId))
    .innerJoin(categories, eq(categories.id, parts.categoryId))
    .where(eq(priceAlerts.userId, userId))
    .orderBy(desc(priceAlerts.createdAt));
  const sets = await getUsedPriceSets(rows.map((row) => row.partId));
  return rows.flatMap(asMarketPart).map((row) => ({
    ...row,
    current: sets[row.partId]?.[row.grade].median ?? null,
  }));
}

// ---------- ฝั่งแอดมิน ----------

export type PendingReport = PublicReport &
  MarketPart & {
    proofImageUrl: string | null;
    reporterName: string | null;
    createdAt: Date;
    median: number | null;
  };

/** คิวรายงานรออนุมัติ เก่าสุดก่อน พร้อมราคากลางปัจจุบันไว้เทียบ */
export async function getPendingReports(limit = 50): Promise<PendingReport[]> {
  const rows = await db
    .select({
      ...publicReportColumns,
      ...partColumns,
      proofImageUrl: usedPriceReports.proofImageUrl,
      reporterName: users.displayName,
      createdAt: usedPriceReports.createdAt,
    })
    .from(usedPriceReports)
    .innerJoin(parts, eq(parts.id, usedPriceReports.partId))
    .innerJoin(brands, eq(brands.id, parts.brandId))
    .innerJoin(categories, eq(categories.id, parts.categoryId))
    .leftJoin(users, eq(users.id, usedPriceReports.userId))
    .where(eq(usedPriceReports.status, 'pending'))
    .orderBy(usedPriceReports.createdAt)
    .limit(limit);
  const sets = await getUsedPriceSets(rows.map((row) => row.partId));
  return rows.flatMap(asMarketPart).map((row) => ({
    ...row,
    median: sets[row.partId]?.[row.grade].median ?? null,
  }));
}

export async function countPendingReports(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(usedPriceReports)
    .where(eq(usedPriceReports.status, 'pending'));
  return row?.value ?? 0;
}

export type SurveyRow = MarketPart & {
  id: number;
  grade: UsedGrade;
  minPrice: number;
  maxPrice: number;
  surveyedAt: string;
  sourceNote: string | null;
};

/** ราคาสำรวจล่าสุด 50 รายการ */
export async function getRecentSurveys(): Promise<SurveyRow[]> {
  const rows = await db
    .select({
      id: partUsedPrices.id,
      grade: partUsedPrices.grade,
      minPrice: partUsedPrices.minPrice,
      maxPrice: partUsedPrices.maxPrice,
      surveyedAt: partUsedPrices.surveyedAt,
      sourceNote: partUsedPrices.sourceNote,
      ...partColumns,
    })
    .from(partUsedPrices)
    .innerJoin(parts, eq(parts.id, partUsedPrices.partId))
    .innerJoin(brands, eq(brands.id, parts.brandId))
    .innerJoin(categories, eq(categories.id, parts.categoryId))
    .orderBy(desc(partUsedPrices.surveyedAt), desc(partUsedPrices.id))
    .limit(50);
  return rows.flatMap(asMarketPart);
}

export type UsedOnlyMissingSurvey = {
  partId: number;
  model: string;
  brandName: string;
  categorySlug: CategorySlug;
  releaseYear: number | null;
};

/**
 * รุ่นที่มีแต่มือสองแต่ยังไม่มีราคาสำรวจที่ใช้ได้ (ภายใน 90 วัน)
 * รุ่นพวกนี้ไม่มีราคามือหนึ่งให้เทียบ ราคาประมาณจากราคาตอนเปิดตัวอาจคลาดจากตลาดมาก แอดมินจึงควรสำรวจก่อน
 */
export async function getUsedOnlyMissingSurvey(today: string): Promise<UsedOnlyMissingSurvey[]> {
  const since = new Date(`${today}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - SURVEY_MAX_AGE_DAYS);
  const recent = await db
    .selectDistinct({ partId: partUsedPrices.partId })
    .from(partUsedPrices)
    .where(gte(partUsedPrices.surveyedAt, since.toISOString().slice(0, 10)));
  const surveyed = new Set(recent.map((row) => row.partId));

  const rows = await db
    .select({
      partId: parts.id,
      model: parts.model,
      brandName: brands.name,
      categorySlug: categories.slug,
      releaseYear: parts.releaseYear,
    })
    .from(parts)
    .innerJoin(brands, eq(brands.id, parts.brandId))
    .innerJoin(categories, eq(categories.id, parts.categoryId))
    .where(and(eq(parts.availability, 'used_only'), eq(parts.isActive, true)))
    .orderBy(categories.sortOrder, parts.model);
  return rows.filter((row) => !surveyed.has(row.partId)).flatMap(asMarketPart);
}
