'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';

import { adminLogs, builds, comments, reports, sessions, settings, users } from '@/db/schema';
import { db } from '@/lib/db';
import { type ActionResult, authorizeAdmin } from '@/lib/session';
import { notify } from '@/server/notify';
import {
  motherboardWattSchema,
  psuHeadroomSchema,
  ratioSchema,
  SETTING_KEYS,
  usageWeightsSchema,
} from '@/server/queries/settings';

// Server Actions ฝั่งแอดมิน (หัวข้อ 3.9, 8.3) ทุกตัวเริ่มด้วย authorizeAdmin() และเขียน admin_logs ทุกครั้ง

// ---------- ตั้งค่าระบบ updateSetting(key, value) ----------

const SETTING_SCHEMAS: Record<string, z.ZodType> = {
  [SETTING_KEYS.psuHeadroom]: psuHeadroomSchema,
  [SETTING_KEYS.motherboardDefaultWatt]: motherboardWattSchema,
  [SETTING_KEYS.usageWeights]: usageWeightsSchema,
  [SETTING_KEYS.budgetRatio('gaming')]: ratioSchema,
  [SETTING_KEYS.budgetRatio('office')]: ratioSchema,
  [SETTING_KEYS.budgetRatio('creator')]: ratioSchema,
  [SETTING_KEYS.budgetRatio('streaming')]: ratioSchema,
};

const SETTING_ERRORS: Record<string, string> = {
  [SETTING_KEYS.psuHeadroom]: 'ค่าเผื่อกำลังไฟต้องอยู่ระหว่าง 0–100%',
  [SETTING_KEYS.motherboardDefaultWatt]: 'วัตต์พื้นฐานของเมนบอร์ดต้องเป็นจำนวนเต็ม 0–300 W',
  [SETTING_KEYS.usageWeights]: 'น้ำหนัก CPU + การ์ดจอ ของแต่ละประเภทต้องรวมได้ 100%',
};

/**
 * แก้ค่าตั้งระบบ 1 คีย์ ตรวจรูปแบบด้วย Schema เดียวกับตอนอ่าน (ค่าผิดบันทึกไม่ได้)
 * แก้แล้วทุกหน้าที่ตรวจสเปกใช้ค่าใหม่ทันที เพราะล้างแคช tag 'settings'
 */
export async function updateSetting(key: string, value: unknown): Promise<ActionResult> {
  const auth = await authorizeAdmin();
  if (!auth.ok) return auth;
  const schema = SETTING_SCHEMAS[key];
  if (!schema) return { ok: false, error: 'ไม่รู้จักค่าตั้งนี้' };
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        SETTING_ERRORS[key] ?? 'สัดส่วนงบทุกหมวดต้องรวมได้ 100% และแต่ละหมวดอยู่ระหว่าง 0–100%',
    };
  }

  await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, key));
    await tx
      .insert(settings)
      .values({ key, value: parsed.data, updatedBy: auth.user.id })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: parsed.data, updatedBy: auth.user.id },
      });
    await tx.insert(adminLogs).values({
      adminId: auth.user.id,
      action: 'settings.update',
      targetType: 'settings',
      targetId: key,
      changes: { before: before?.value ?? null, after: parsed.data },
    });
  });
  updateTag('settings');
  return { ok: true };
}

// ---------- จัดการผู้ใช้ ----------

const userIdSchema = z.string().min(1).max(100);

/** ระงับผู้ใช้: ออกจากระบบทุกอุปกรณ์ทันที และล็อกอินใหม่ไม่ได้ (Better Auth admin plugin ตรวจ banned) */
export async function banUser(rawId: unknown, rawReason: unknown): Promise<ActionResult> {
  const auth = await authorizeAdmin();
  if (!auth.ok) return auth;
  const id = userIdSchema.safeParse(rawId);
  const reason = z
    .string()
    .trim()
    .min(1, { error: 'กรุณาระบุเหตุผล' })
    .max(200)
    .safeParse(rawReason);
  if (!id.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };
  if (!reason.success)
    return { ok: false, error: reason.error.issues[0]?.message ?? 'กรุณาระบุเหตุผล' };
  if (id.data === auth.user.id) return { ok: false, error: 'ระงับบัญชีของตัวเองไม่ได้' };

  const done = await db.transaction(async (tx) => {
    const [target] = await tx
      .update(users)
      .set({ banned: true, banReason: reason.data })
      .where(and(eq(users.id, id.data), eq(users.role, 'member')))
      .returning({ id: users.id });
    if (!target) return false;
    await tx.delete(sessions).where(eq(sessions.userId, id.data));
    await tx.insert(adminLogs).values({
      adminId: auth.user.id,
      action: 'user.ban',
      targetType: 'user',
      targetId: id.data,
      changes: { after: { banned: true, reason: reason.data } },
    });
    return true;
  });
  // ระงับแอดมินด้วยกันไม่ได้ ต้องลดสิทธิ์ก่อน
  if (!done) return { ok: false, error: 'ไม่พบผู้ใช้ หรือเป็นแอดมิน (ต้องลดสิทธิ์ก่อนระงับ)' };
  // สเปกและโปรไฟล์ของผู้ใช้ที่ถูกระงับถูกซ่อนจากหน้าชุมชน
  updateTag('builds');
  updateTag('profiles');
  revalidatePath('/admin/users');
  return { ok: true };
}

export async function unbanUser(rawId: unknown): Promise<ActionResult> {
  const auth = await authorizeAdmin();
  if (!auth.ok) return auth;
  const id = userIdSchema.safeParse(rawId);
  if (!id.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ banned: false, banReason: null, banExpires: null })
      .where(eq(users.id, id.data));
    await tx.insert(adminLogs).values({
      adminId: auth.user.id,
      action: 'user.unban',
      targetType: 'user',
      targetId: id.data,
      changes: { after: { banned: false } },
    });
  });
  updateTag('builds');
  updateTag('profiles');
  revalidatePath('/admin/users');
  return { ok: true };
}

/** เปลี่ยนสิทธิ์ member ↔ admin เปลี่ยนสิทธิ์ตัวเองไม่ได้ (กันแอดมินคนสุดท้ายลดสิทธิ์ตัวเองจนไม่มีใครเข้าหลังบ้านได้) */
export async function setUserRole(rawId: unknown, rawRole: unknown): Promise<ActionResult> {
  const auth = await authorizeAdmin();
  if (!auth.ok) return auth;
  const id = userIdSchema.safeParse(rawId);
  const role = z.enum(['member', 'admin']).safeParse(rawRole);
  if (!id.success || !role.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };
  if (id.data === auth.user.id) return { ok: false, error: 'เปลี่ยนสิทธิ์ของตัวเองไม่ได้' };

  const done = await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ role: users.role, banned: users.banned })
      .from(users)
      .where(eq(users.id, id.data));
    if (!before) return 'missing';
    if (before.banned && role.data === 'admin') return 'banned';
    await tx.update(users).set({ role: role.data }).where(eq(users.id, id.data));
    await tx.insert(adminLogs).values({
      adminId: auth.user.id,
      action: 'user.role',
      targetType: 'user',
      targetId: id.data,
      changes: { before: { role: before.role }, after: { role: role.data } },
    });
    return 'ok';
  });
  if (done === 'missing') return { ok: false, error: 'ไม่พบผู้ใช้' };
  if (done === 'banned') return { ok: false, error: 'ปลดระงับก่อนให้สิทธิ์แอดมิน' };
  revalidatePath('/admin/users');
  return { ok: true };
}

/**
 * แอดมินยืนยันอีเมลให้สมาชิก ใช้แทนอีเมลยืนยันเมื่อเว็บยังไม่ได้ตั้งระบบส่งอีเมล (Resend)
 * สมาชิกที่ยืนยันแล้วจึงโหวต คอมเมนต์ Fork และรายงานราคาได้ (มติ Q4)
 * แอดมินควรยืนยันเฉพาะคนที่รู้จักตัวจริง เช่นผู้ร่วมทดสอบ เพราะไม่ได้พิสูจน์ว่าเป็นเจ้าของอีเมลจริง
 */
export async function verifyUserEmail(rawId: unknown): Promise<ActionResult> {
  const auth = await authorizeAdmin();
  if (!auth.ok) return auth;
  const id = userIdSchema.safeParse(rawId);
  if (!id.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };

  const done = await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, id.data));
    if (!before) return 'missing';
    if (before.emailVerified) return 'already';
    await tx.update(users).set({ emailVerified: true }).where(eq(users.id, id.data));
    await tx.insert(adminLogs).values({
      adminId: auth.user.id,
      action: 'user.verify_email',
      targetType: 'user',
      targetId: id.data,
      changes: { before: { emailVerified: false }, after: { emailVerified: true } },
    });
    return 'ok';
  });
  if (done === 'missing') return { ok: false, error: 'ไม่พบผู้ใช้' };
  if (done === 'already') return { ok: false, error: 'ผู้ใช้นี้ยืนยันอีเมลแล้ว' };
  revalidatePath('/admin/users');
  return { ok: true };
}

// ---------- จัดการรายงาน resolveReport(id, action) ----------

/**
 * hide = ซ่อนเนื้อหาแล้วปิดรายงาน (คอมเมนต์ → ซ่อน · สเปก → เปลี่ยนเป็นส่วนตัว · ผู้ใช้ → ใช้ปุ่มระงับในหน้าผู้ใช้)
 * dismiss = ไม่ผิดกติกา ปิดรายงาน
 * รายงานอื่นที่ชี้ไปเนื้อหาเดียวกันถูกปิดพร้อมกัน
 */
export async function resolveReport(rawId: unknown, rawAction: unknown): Promise<ActionResult> {
  const auth = await authorizeAdmin();
  if (!auth.ok) return auth;
  const id = z.number().int().positive().safeParse(rawId);
  const action = z.enum(['hide', 'dismiss']).safeParse(rawAction);
  if (!id.success || !action.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };

  const result = await db.transaction(async (tx) => {
    const [report] = await tx.select().from(reports).where(eq(reports.id, id.data));
    if (!report || report.status !== 'open') return 'closed';

    if (action.data === 'hide') {
      if (report.targetType === 'comment') {
        await tx
          .update(comments)
          .set({ isHidden: true })
          .where(eq(comments.id, Number(report.targetId)));
      } else if (report.targetType === 'build') {
        const [build] = await tx
          .update(builds)
          .set({ visibility: 'private' })
          .where(eq(builds.id, report.targetId))
          .returning({ userId: builds.userId, title: builds.title });
        if (build) {
          await notify(tx, {
            userId: build.userId,
            actorId: auth.user.id,
            buildId: report.targetId,
            type: 'system',
            message: `สเปก "${build.title}" ถูกเปลี่ยนเป็นส่วนตัวเพราะถูกรายงานว่าไม่เหมาะสม`,
          });
        }
      } else {
        return 'user';
      }
    }

    await tx
      .update(reports)
      .set({
        status: action.data === 'hide' ? 'resolved' : 'dismissed',
        resolvedBy: auth.user.id,
        resolvedAt: new Date(),
      })
      .where(
        and(
          eq(reports.targetType, report.targetType),
          eq(reports.targetId, report.targetId),
          eq(reports.status, 'open'),
        ),
      );
    await tx.insert(adminLogs).values({
      adminId: auth.user.id,
      action: action.data === 'hide' ? 'report.hide' : 'report.dismiss',
      targetType: report.targetType,
      targetId: report.targetId,
      changes: { after: { reportId: report.id, reason: report.reason } },
    });
    return 'ok';
  });
  if (result === 'closed') return { ok: false, error: 'รายงานนี้ถูกจัดการไปแล้ว' };
  if (result === 'user')
    return { ok: false, error: 'รายงานผู้ใช้ ให้ใช้ปุ่มระงับในหน้าจัดการผู้ใช้' };
  updateTag('builds');
  revalidatePath('/admin/reports');
  return { ok: true };
}
