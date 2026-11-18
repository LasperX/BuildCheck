import 'server-only';

import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import {
  categories,
  cpuSpecs,
  gpuSpecs,
  partUsedPrices,
  partUsedStats,
  parts,
  priceAlerts,
  usedPriceReports,
} from '@/db/schema';
import {
  clampToPerfAnchors,
  type PerfAnchor,
  resolveUsedStat,
  roundTo50,
  surveyForGrade,
  USED_GRADES,
  type UsedGrade,
  type UsedReport,
  type UsedSettings,
  type UsedSurvey,
} from '@/lib/compat/used-price';
import { db } from '@/lib/db';
import { notify } from '@/server/notify';
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

  const partRows = await db
    .select({
      id: parts.id,
      price: parts.price,
      releaseYear: parts.releaseYear,
      availability: parts.availability,
      categorySlug: categories.slug,
      // คะแนนประสิทธิภาพ มีเฉพาะ CPU และการ์ดจอ
      perf: sql<number | null>`coalesce(${cpuSpecs.perfScore}, ${gpuSpecs.perfScore})`,
      // CPU เทียบกันเฉพาะ Socket เดียวกัน: CPU ต่าง Socket ใช้เมนบอร์ดและแรมคนละชุด ราคาจึงเทียบกันตรงๆ ไม่ได้
      socket: cpuSpecs.socket,
    })
    .from(parts)
    .innerJoin(categories, eq(parts.categoryId, categories.id))
    .leftJoin(cpuSpecs, eq(cpuSpecs.partId, parts.id))
    .leftJoin(gpuSpecs, eq(gpuSpecs.partId, parts.id))
    .where(
      partIds
        ? or(
            inArray(parts.id, partIds),
            // รุ่นที่ยังขายมือหนึ่งของ CPU และการ์ดจอ ใช้เป็นตัวเทียบของรุ่นที่มีแต่มือสอง จึงคำนวณด้วยเสมอ
            and(
              eq(parts.isActive, true),
              eq(parts.availability, 'new'),
              inArray(categories.slug, ['cpu', 'gpu']),
            ),
          )
        : eq(parts.isActive, true),
    );
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
    // ไม่จำกัดอายุ ใช้ไปจนกว่าแอดมินจะบันทึกราคาใหม่ ไม่นับราคาที่ลงวันที่ในอนาคต
    db
      .select({
        partId: partUsedPrices.partId,
        grade: partUsedPrices.grade,
        minPrice: partUsedPrices.minPrice,
        maxPrice: partUsedPrices.maxPrice,
        surveyedAt: partUsedPrices.surveyedAt,
      })
      .from(partUsedPrices)
      .where(and(inArray(partUsedPrices.partId, ids), lte(partUsedPrices.surveyedAt, today)))
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
        part: {
          price: part.price,
          categorySlug: category,
          releaseYear: part.releaseYear,
          availability: part.availability,
        },
        grade,
        reports: reports.get(key(part.id, grade)) ?? [],
        // เกรดที่ไม่ได้สำรวจ เทียบจากเกรดที่สำรวจไว้ของรุ่นเดียวกัน
        survey: surveyForGrade(
          {
            A: surveys.get(key(part.id, 'A')),
            B: surveys.get(key(part.id, 'B')),
            C: surveys.get(key(part.id, 'C')),
          },
          grade,
          today,
          settings,
        ),
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

  // รุ่นที่มีแต่มือสองซึ่งยังใช้ราคาประมาณการ: จำกัดให้อยู่ในกรอบของรุ่นที่ยังขายมือหนึ่งที่คะแนนใกล้กัน
  // (CPU เทียบเฉพาะ Socket เดียวกัน การ์ดจอเทียบทั้งหมวด)
  // (ไม่ถูกกว่ารุ่นที่ช้ากว่าซึ่งคะแนนใกล้ที่สุด ไม่แพงกว่ารุ่นที่แรงกว่า และไม่เกินราคาเปิดตัว) ดู clampToPerfAnchors
  const partById = new Map(partRows.map((part) => [part.id, part]));
  const anchors = new Map<string, PerfAnchor[]>();
  for (const value of values) {
    const part = partById.get(value.partId);
    if (!part || part.availability !== 'new' || part.perf === null) continue;
    const k = `${part.categorySlug}:${part.socket ?? ''}:${value.grade}`;
    anchors.set(k, [...(anchors.get(k) ?? []), { perf: part.perf, price: value.medianPrice }]);
  }
  for (const value of values) {
    const part = partById.get(value.partId);
    if (!part || part.availability !== 'used_only' || part.perf === null) continue;
    if (value.source !== 'estimate') continue;
    value.medianPrice = clampToPerfAnchors(
      value.medianPrice,
      part.perf,
      anchors.get(`${part.categorySlug}:${part.socket ?? ''}:${value.grade}`) ?? [],
      // มือสองไม่แพงกว่าราคาเปิดตัว (ราคาในระบบของรุ่นที่มีแต่มือสองคือราคาเปิดตัว) คูณตัวคูณเกรด
      roundTo50(part.price * settings.gradeFactors[value.grade]),
    );
  }

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
    await notify(
      tx,
      due.map((alert) => ({
        userId: alert.userId,
        type: 'price_alert' as const,
        message: `ราคากลางมือสอง ${alert.model} เกรด ${alert.grade} ลดเหลือ ${formatBaht(alert.median)} ถึงราคาที่ตั้งไว้แล้ว`,
      })),
    );
  });
  return due.length;
}
