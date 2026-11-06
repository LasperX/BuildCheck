import 'server-only';

import { and, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';

import {
  categories,
  notifications,
  partUsedPrices,
  partUsedStats,
  parts,
  priceAlerts,
  usedPriceReports,
} from '@/db/schema';
import {
  resolveUsedStat,
  USED_GRADES,
  type UsedGrade,
  type UsedReport,
  type UsedSettings,
  type UsedSurvey,
} from '@/lib/compat/used-price';
import { db } from '@/lib/db';
import { formatBaht } from '@/lib/parts/catalog';
import { isCategorySlug } from '@/lib/parts/spec-fields';

// คำนวณราคากลางมือสองแล้วเก็บลงตาราง part_used_stats (หัวข้อ 4.6)
// เรียกจาก Vercel Cron ทุกคืน และทุกครั้งที่แอดมินอนุมัติรายงานหรือบันทึกราคาสำรวจ
// สูตรทั้งหมดอยู่ใน src/lib/compat/used-price.ts ไฟล์นี้แค่อ่านข้อมูลแล้วเขียนผลลง

/** วันที่วันนี้ตามเวลาประเทศไทย รูปแบบ YYYY-MM-DD */
export function todayInThailand(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
}

const daysAgo = (today: string, days: number) =>
  new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

export type RecomputeSummary = { parts: number; rows: number; alerts: number };

/**
 * คำนวณราคากลางใหม่ของอะไหล่ที่ระบุ (ไม่ระบุ = ทุกชิ้นที่ยังขาย) ครบทั้ง 3 เกรด
 * แล้วตรวจเตือนราคาที่ถึงเป้า
 */
export async function recomputeUsedStats(
  settings: UsedSettings,
  partIds?: number[],
): Promise<RecomputeSummary> {
  const today = todayInThailand();
  const since = daysAgo(today, settings.reportWindowDays);
  const surveySince = daysAgo(today, 90);

  const partRows = await db
    .select({
      id: parts.id,
      price: parts.price,
      releaseYear: parts.releaseYear,
      categorySlug: categories.slug,
    })
    .from(parts)
    .innerJoin(categories, eq(parts.categoryId, categories.id))
    .where(partIds ? inArray(parts.id, partIds) : eq(parts.isActive, true));
  if (partRows.length === 0) return { parts: 0, rows: 0, alerts: 0 };
  const ids = partRows.map((row) => row.id);

  const [reportRows, surveyRows] = await Promise.all([
    db
      .select({
        partId: usedPriceReports.partId,
        grade: usedPriceReports.grade,
        price: usedPriceReports.price,
        reportType: usedPriceReports.reportType,
        seenAt: usedPriceReports.seenAt,
      })
      .from(usedPriceReports)
      .where(
        and(
          inArray(usedPriceReports.partId, ids),
          eq(usedPriceReports.status, 'approved'),
          gte(usedPriceReports.seenAt, since),
          lte(usedPriceReports.seenAt, today),
        ),
      ),
    // ราคาสำรวจล่าสุดของแต่ละรุ่นและเกรด (เรียงใหม่สุดก่อน แล้วเลือกแถวแรก)
    db
      .select({
        partId: partUsedPrices.partId,
        grade: partUsedPrices.grade,
        minPrice: partUsedPrices.minPrice,
        maxPrice: partUsedPrices.maxPrice,
        surveyedAt: partUsedPrices.surveyedAt,
      })
      .from(partUsedPrices)
      .where(and(inArray(partUsedPrices.partId, ids), gte(partUsedPrices.surveyedAt, surveySince)))
      .orderBy(desc(partUsedPrices.surveyedAt), desc(partUsedPrices.id)),
  ]);

  const key = (partId: number, grade: UsedGrade) => `${partId}:${grade}`;
  const reports = new Map<string, UsedReport[]>();
  for (const row of reportRows) {
    const k = key(row.partId, row.grade);
    reports.set(k, [...(reports.get(k) ?? []), row]);
  }
  const surveys = new Map<string, UsedSurvey>();
  for (const row of surveyRows) {
    const k = key(row.partId, row.grade);
    if (!surveys.has(k)) surveys.set(k, row);
  }

  const computedAt = new Date();
  const values = partRows.flatMap((part) => {
    if (!isCategorySlug(part.categorySlug)) return [];
    const category = part.categorySlug;
    return USED_GRADES.map((grade) => {
      const stat = resolveUsedStat({
        part: { price: part.price, categorySlug: category, releaseYear: part.releaseYear },
        grade,
        reports: reports.get(key(part.id, grade)) ?? [],
        survey: surveys.get(key(part.id, grade)) ?? null,
        today,
        settings,
      });
      return {
        partId: part.id,
        grade,
        medianPrice: stat.median,
        p25Price: stat.p25,
        p75Price: stat.p75,
        reportCount: stat.reportCount,
        source: stat.source,
        confidence: stat.confidence,
        computedAt,
      };
    });
  });

  // เขียนเป็นชุดละ 500 แถว ไม่ให้คำสั่งเดียวใหญ่เกินไป
  for (let i = 0; i < values.length; i += 500) {
    await db
      .insert(partUsedStats)
      .values(values.slice(i, i + 500))
      .onConflictDoUpdate({
        target: [partUsedStats.partId, partUsedStats.grade],
        set: {
          medianPrice: sql`excluded.median_price`,
          p25Price: sql`excluded.p25_price`,
          p75Price: sql`excluded.p75_price`,
          reportCount: sql`excluded.report_count`,
          source: sql`excluded.source`,
          confidence: sql`excluded.confidence`,
          computedAt: sql`excluded.computed_at`,
        },
      });
  }

  const alerts = await triggerPriceAlerts(ids);
  // ผู้เรียกล้างแคช tag 'used-prices' เอง: Server Action ใช้ updateTag ส่วน Cron ใช้ revalidateTag
  return { parts: partRows.length, rows: values.length, alerts };
}

/**
 * เตือนราคา: ราคากลางของรุ่นและเกรดที่ตั้งไว้ลดลงถึงราคาเป้าหมาย
 * ตั้งเวลาที่ถึงราคาไว้ (แจ้งครั้งเดียว) แล้วสร้างการแจ้งเตือนให้เจ้าของ
 */
async function triggerPriceAlerts(partIds: number[]): Promise<number> {
  const due = await db
    .select({
      id: priceAlerts.id,
      userId: priceAlerts.userId,
      grade: priceAlerts.grade,
      targetPrice: priceAlerts.targetPrice,
      median: partUsedStats.medianPrice,
      model: parts.model,
    })
    .from(priceAlerts)
    .innerJoin(
      partUsedStats,
      and(eq(partUsedStats.partId, priceAlerts.partId), eq(partUsedStats.grade, priceAlerts.grade)),
    )
    .innerJoin(parts, eq(parts.id, priceAlerts.partId))
    .where(
      and(
        inArray(priceAlerts.partId, partIds),
        isNull(priceAlerts.triggeredAt),
        lte(partUsedStats.medianPrice, priceAlerts.targetPrice),
      ),
    );
  if (due.length === 0) return 0;

  await db.transaction(async (tx) => {
    await tx
      .update(priceAlerts)
      .set({ triggeredAt: new Date() })
      .where(
        inArray(
          priceAlerts.id,
          due.map((alert) => alert.id),
        ),
      );
    await tx.insert(notifications).values(
      due.map((alert) => ({
        userId: alert.userId,
        type: 'price_alert' as const,
        message:
          `ราคากลางมือสอง ${alert.model} เกรด ${alert.grade} ลดเหลือ ${formatBaht(alert.median)} ถึงราคาที่ตั้งไว้แล้ว`.slice(
            0,
            255,
          ),
      })),
    );
  });
  return due.length;
}
