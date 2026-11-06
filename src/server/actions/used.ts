'use server';

import { and, eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';

import {
  adminLogs,
  notifications,
  partUsedPrices,
  parts,
  priceAlerts,
  settings,
  usedPriceReports,
} from '@/db/schema';
import { db } from '@/lib/db';
import { clientIp, hitRateLimit } from '@/lib/rate-limit';
import {
  type ActionResult,
  authorizeAdmin,
  authorizeMember,
  authorizeVerifiedMember,
} from '@/lib/session';
import { uploadImage } from '@/lib/storage';
import {
  priceAlertSchema,
  reviewSchema,
  surveySchema,
  usedReportSchema,
  usedSettingsSchema,
} from '@/lib/validators/used';
import { SETTING_KEYS, getSystemConfig } from '@/server/queries/settings';
import { recomputeUsedStats, todayInThailand } from '@/server/used/stats';
import { headers } from 'next/headers';

// Server Actions ส่วนมือสอง ทุกฟังก์ชันตรวจสิทธิ์ก่อน แล้วตรวจข้อมูลด้วย Zod

const firstError = (issues: { message: string }[]) => issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง';

/** รายงานต่อวันต่อบัญชี กันสแปมราคา */
const REPORTS_PER_DAY = 20;
const MAX_ALERTS = 30;

/** ราคากลางคำนวณใหม่แล้ว ล้างแคชหน้าที่แสดงราคามือสองทั้งหมด */
async function refreshStats(partIds?: number[]) {
  const { used } = await getSystemConfig();
  await recomputeUsedStats(used, partIds);
  updateTag('used-prices');
}

/**
 * สมาชิกรายงานราคามือสอง (หัวข้อ 3.11) รับ FormData เพราะแนบรูปหลักฐานได้
 * ต้องยืนยันอีเมลก่อน (มติ Q4) รายงานเข้าคิวรออนุมัติ ยังไม่ถูกนำไปคำนวณจนกว่าแอดมินอนุมัติ
 */
export async function submitUsedReport(form: FormData): Promise<ActionResult> {
  const auth = await authorizeVerifiedMember();
  if (!auth.ok) return auth;

  const parsed = usedReportSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  const input = parsed.data;

  // วันที่เห็นต้องไม่อยู่ในอนาคต และไม่เก่ากว่า 1 ปี
  const today = todayInThailand();
  if (input.seenAt > today) return { ok: false, error: 'วันที่ต้องไม่เป็นวันในอนาคต' };
  if (input.seenAt < `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`) {
    return { ok: false, error: 'รายงานได้เฉพาะราคาที่เห็นภายใน 1 ปี' };
  }

  const limit = await hitRateLimit(`used-report:${auth.user.id}`, 86_400);
  if (limit.count > REPORTS_PER_DAY) {
    return { ok: false, error: `รายงานได้วันละไม่เกิน ${REPORTS_PER_DAY} รายการ` };
  }

  const [part] = await db
    .select({ id: parts.id })
    .from(parts)
    .where(and(eq(parts.id, input.partId), eq(parts.isActive, true)));
  if (!part) return { ok: false, error: 'ไม่พบอะไหล่รุ่นนี้' };

  let proofImageUrl: string | null = null;
  const proof = form.get('proof');
  if (proof instanceof File && proof.size > 0) {
    const uploaded = await uploadImage(proof, 'used-proofs');
    if (!uploaded.ok) return uploaded;
    proofImageUrl = uploaded.url;
  }

  await db.insert(usedPriceReports).values({
    partId: input.partId,
    userId: auth.user.id,
    price: input.price,
    grade: input.grade,
    reportType: input.reportType,
    channel: input.channel,
    province: input.province || null,
    warrantyMonthsLeft: input.warrantyMonthsLeft,
    seenAt: input.seenAt,
    proofImageUrl,
  });
  return { ok: true };
}

/** แอดมินอนุมัติหรือปฏิเสธรายงาน อนุมัติแล้วคำนวณราคากลางของรุ่นนั้นใหม่ทันที */
export async function reviewUsedReport(raw: unknown): Promise<ActionResult> {
  const auth = await authorizeAdmin();
  if (!auth.ok) return auth;
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  const { id, decision } = parsed.data;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(usedPriceReports)
      .set({ status: decision, reviewedBy: auth.user.id })
      // อนุมัติได้เฉพาะรายงานที่ยังรออยู่ กดซ้ำหรือแอดมินสองคนกดพร้อมกันจะไม่ทำซ้ำ
      .where(and(eq(usedPriceReports.id, id), eq(usedPriceReports.status, 'pending')))
      .returning({
        partId: usedPriceReports.partId,
        userId: usedPriceReports.userId,
        price: usedPriceReports.price,
        grade: usedPriceReports.grade,
      });
    if (!row) return null;
    await tx.insert(adminLogs).values({
      adminId: auth.user.id,
      action: decision === 'approved' ? 'used_report.approve' : 'used_report.reject',
      targetType: 'used_report',
      targetId: String(id),
      changes: { after: { status: decision, price: row.price, grade: row.grade } },
    });
    if (row.userId) {
      const [part] = await tx
        .select({ model: parts.model })
        .from(parts)
        .where(eq(parts.id, row.partId));
      await tx.insert(notifications).values({
        userId: row.userId,
        actorId: auth.user.id,
        type: 'report_reviewed',
        message: (decision === 'approved'
          ? `รายงานราคา ${part?.model ?? ''} ของคุณได้รับการอนุมัติแล้ว ขอบคุณที่ช่วยกัน`
          : `รายงานราคา ${part?.model ?? ''} ของคุณไม่ผ่านการตรวจสอบ`
        ).slice(0, 255),
      });
    }
    return row;
  });
  if (!updated) return { ok: false, error: 'รายงานนี้ถูกตรวจไปแล้ว' };

  if (decision === 'approved') await refreshStats([updated.partId]);
  return { ok: true };
}

/** แอดมินบันทึกราคากลางที่สำรวจตลาดเอง (แหล่งที่ 2) */
export async function saveUsedSurvey(raw: unknown): Promise<ActionResult> {
  const auth = await authorizeAdmin();
  if (!auth.ok) return auth;
  const parsed = surveySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  const input = parsed.data;
  if (input.surveyedAt > todayInThailand()) {
    return { ok: false, error: 'วันที่สำรวจต้องไม่เป็นวันในอนาคต' };
  }

  const [part] = await db.select({ id: parts.id }).from(parts).where(eq(parts.id, input.partId));
  if (!part) return { ok: false, error: 'ไม่พบอะไหล่รุ่นนี้' };

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(partUsedPrices)
      .values({
        partId: input.partId,
        grade: input.grade,
        minPrice: input.minPrice,
        maxPrice: input.maxPrice,
        surveyedAt: input.surveyedAt,
        sourceNote: input.sourceNote || null,
        updatedBy: auth.user.id,
      })
      .returning({ id: partUsedPrices.id });
    await tx.insert(adminLogs).values({
      adminId: auth.user.id,
      action: 'used_survey.create',
      targetType: 'part',
      targetId: String(input.partId),
      changes: { after: { id: row?.id, ...input } },
    });
  });
  await refreshStats([input.partId]);
  return { ok: true };
}

/** ค่าเสื่อมต่อหมวด ตัวคูณเกรด และ Socket ที่เลิกผลิต แก้แล้วคำนวณราคากลางใหม่ทั้งหมด */
export async function saveUsedSettings(raw: unknown): Promise<ActionResult> {
  const auth = await authorizeAdmin();
  if (!auth.ok) return auth;
  const parsed = usedSettingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  const { depreciationRates, gradeFactors, legacySockets } = parsed.data;
  if (!(gradeFactors.A >= gradeFactors.B && gradeFactors.B >= gradeFactors.C)) {
    return { ok: false, error: 'ตัวคูณเกรดต้องเรียง A ≥ B ≥ C' };
  }

  const before = await getSystemConfig();
  const rows = [
    { key: SETTING_KEYS.depreciationRates, value: depreciationRates },
    { key: SETTING_KEYS.gradeFactors, value: gradeFactors },
    { key: SETTING_KEYS.legacySockets, value: legacySockets },
  ];
  await db.transaction(async (tx) => {
    for (const row of rows) {
      await tx
        .insert(settings)
        .values({ ...row, updatedBy: auth.user.id })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: row.value, updatedBy: auth.user.id },
        });
    }
    await tx.insert(adminLogs).values({
      adminId: auth.user.id,
      action: 'settings.used',
      targetType: 'settings',
      targetId: 'used',
      changes: {
        before: { ...before.used, legacySockets: before.engine.legacySockets },
        after: parsed.data,
      },
    });
  });
  updateTag('settings');
  await refreshStats();
  return { ok: true };
}

/** ตั้งเตือนราคา: ตั้งซ้ำรุ่นและเกรดเดิมจะแก้ราคาเป้าหมายแทนการเพิ่มแถวใหม่ */
export async function setPriceAlert(raw: unknown): Promise<ActionResult> {
  const auth = await authorizeMember();
  if (!auth.ok) return auth;
  const parsed = priceAlertSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  const { partId, grade, targetPrice } = parsed.data;

  const limit = await hitRateLimit(`price-alert:${clientIp(await headers())}`, 60);
  if (limit.count > 30) return { ok: false, error: 'ทำรายการถี่เกินไป กรุณารอสักครู่' };

  const [part] = await db.select({ id: parts.id }).from(parts).where(eq(parts.id, partId));
  if (!part) return { ok: false, error: 'ไม่พบอะไหล่รุ่นนี้' };

  const mine = await db
    .select({ id: priceAlerts.id, partId: priceAlerts.partId, grade: priceAlerts.grade })
    .from(priceAlerts)
    .where(eq(priceAlerts.userId, auth.user.id));
  const existing = mine.find((row) => row.partId === partId && row.grade === grade);
  if (existing) {
    await db
      .update(priceAlerts)
      .set({ targetPrice, triggeredAt: null })
      .where(and(eq(priceAlerts.id, existing.id), eq(priceAlerts.userId, auth.user.id)));
  } else {
    if (mine.length >= MAX_ALERTS) {
      return { ok: false, error: `ตั้งเตือนราคาได้ไม่เกิน ${MAX_ALERTS} รายการ` };
    }
    await db.insert(priceAlerts).values({ userId: auth.user.id, partId, grade, targetPrice });
  }
  return { ok: true };
}

export async function deletePriceAlert(rawId: unknown): Promise<ActionResult> {
  const auth = await authorizeMember();
  if (!auth.ok) return auth;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };
  // ตรวจเจ้าของในเงื่อนไข WHERE ลบของคนอื่นไม่ได้
  const deleted = await db
    .delete(priceAlerts)
    .where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, auth.user.id)))
    .returning({ id: priceAlerts.id });
  if (deleted.length === 0) return { ok: false, error: 'ไม่พบรายการนี้' };
  return { ok: true };
}

/** แอดมินสั่งคำนวณราคากลางใหม่ทั้งหมดทันที (ปกติ Cron ทำให้ทุกคืน) */
export async function recomputeAllUsedStats(): Promise<ActionResult & { rows?: number }> {
  const auth = await authorizeAdmin();
  if (!auth.ok) return auth;
  const limit = await hitRateLimit(`used-recompute:${auth.user.id}`, 60);
  if (limit.count > 3) return { ok: false, error: 'สั่งคำนวณถี่เกินไป กรุณารอสักครู่' };
  const { used } = await getSystemConfig();
  const summary = await recomputeUsedStats(used);
  updateTag('used-prices');
  return { ok: true, rows: summary.rows };
}
