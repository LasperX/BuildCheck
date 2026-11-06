'use server';

import { and, eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';

import { buildItems, builds } from '@/db/schema';
import { newBuildId, qrSvg, shortUrl } from '@/lib/builder/share';
import { type CompatStatus, checkBuild, type EngineItem } from '@/lib/compat';
import { db } from '@/lib/db';
import { hitRateLimit } from '@/lib/rate-limit';
import { type ActionResult, authorizeMember } from '@/lib/session';
import {
  buildIdSchema,
  type SaveBuildInput,
  saveBuildSchema,
  visibilitySchema,
} from '@/lib/validators/builds';
import { getEngineParts } from '@/server/queries/engine-parts';
import { getSystemConfig } from '@/server/queries/settings';

// Server Actions ของสเปก (หัวข้อ 8.1 และ 8.3)
// ทุกตัว: ตรวจสิทธิ์ → ตรวจค่าด้วย Zod → ตรวจว่าเป็นเจ้าของ → ทำงาน
// ผลตรวจ ราคา และวัตต์คำนวณใหม่บนเซิร์ฟเวอร์จากข้อมูลในฐานข้อมูลเสมอ ไม่เชื่อตัวเลขจากหน้าเว็บ

const SINGLE = new Set(['cpu', 'motherboard', 'gpu', 'psu', 'case', 'cooler']);
const SAVE_LIMIT_PER_MINUTE = 60;

export type SaveBuildResult =
  { ok: true; id: string; status: CompatStatus; savedAt: string } | { ok: false; error: string };

async function ownedBuild(id: string, userId: string) {
  const [row] = await db
    .select({ id: builds.id, visibility: builds.visibility })
    .from(builds)
    .where(and(eq(builds.id, id), eq(builds.userId, userId)));
  return row ?? null;
}

export async function saveBuild(raw: SaveBuildInput): Promise<SaveBuildResult> {
  const auth = await authorizeMember();
  if (!auth.ok) return auth;

  const parsed = saveBuildSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'ข้อมูลสเปกไม่ถูกต้อง' };
  }
  const input = parsed.data;

  // บันทึกอัตโนมัติทุก 2 วินาทีที่หยุดแก้ จำกัดไว้ไม่ให้ยิงถี่ผิดปกติ
  const limit = await hitRateLimit(`build-save:${auth.user.id}`, 60);
  if (limit.count > SAVE_LIMIT_PER_MINUTE) {
    return { ok: false, error: 'บันทึกถี่เกินไป กรุณารอสักครู่' };
  }

  // id ที่ส่งมาไม่ใช่ของผู้ใช้คนนี้ (เช่นเปลี่ยนบัญชีในเครื่องเดียวกัน) → สร้างสเปกใหม่ ไม่แตะของคนอื่น
  const existing = input.id ? await ownedBuild(input.id, auth.user.id) : null;
  const previous = existing
    ? await db
        .select({ partId: buildItems.partId, priceAtAdd: buildItems.priceAtAdd })
        .from(buildItems)
        .where(eq(buildItems.buildId, existing.id))
    : [];
  const previousPrice = new Map(previous.map((row) => [row.partId, row.priceAtAdd]));

  const parts = await getEngineParts(input.items.map((item) => item.partId));
  const byId = new Map(parts.map((part) => [part.id, part]));
  const seen = new Set<string>();
  const engineItems: EngineItem[] = [];
  for (const item of input.items) {
    const part = byId.get(item.partId);
    // อะไหล่ที่แอดมินซ่อนแล้ว ใช้ต่อได้ถ้าอยู่ในสเปกเดิม แต่เพิ่มใหม่ไม่ได้
    if (!part || (!part.isActive && !previousPrice.has(part.id))) {
      return { ok: false, error: 'มีอะไหล่ที่ไม่มีในระบบหรือเลิกขายแล้ว กรุณาเอาออกก่อนบันทึก' };
    }
    if (SINGLE.has(part.categorySlug)) {
      if (seen.has(part.categorySlug) || item.quantity !== 1) {
        return { ok: false, error: 'หมวดนี้ใส่ได้ชิ้นเดียว' };
      }
      seen.add(part.categorySlug);
    }
    engineItems.push({ ...item, part });
  }

  const { engine } = await getSystemConfig();
  const result = checkBuild({
    items: engineItems,
    budget: input.budget,
    usage: input.usageType,
    settings: engine,
  });
  const values = {
    title: input.title,
    description: input.description || null,
    usageType: input.usageType,
    budget: input.budget,
    totalPrice: result.price.total,
    totalNewPrice: result.price.totalNew,
    totalWatt: result.power.totalWatt,
    perfScore: Math.round(result.score.score),
    compatStatus: result.status,
  };

  const id = existing?.id ?? newBuildId();
  await db.transaction(async (tx) => {
    if (existing) {
      await tx.update(builds).set(values).where(eq(builds.id, id));
      await tx.delete(buildItems).where(eq(buildItems.buildId, id));
    } else {
      await tx.insert(builds).values({ ...values, id, userId: auth.user.id });
    }
    if (engineItems.length) {
      await tx.insert(buildItems).values(
        engineItems.map((item) => ({
          buildId: id,
          partId: item.part.id,
          quantity: item.quantity,
          // ราคาตอนเพิ่ม ใช้แจ้งเตือนเมื่อราคาเปลี่ยน ชิ้นที่มีอยู่แล้วคงราคาเดิมไว้
          priceAtAdd: previousPrice.get(item.part.id) ?? item.part.price,
          condition: item.condition,
          offeredPrice: item.offeredPrice ?? null,
          warrantyMonthsLeft: item.warrantyMonthsLeft ?? null,
        })),
      );
    }
  });

  if (existing?.visibility === 'public') updateTag('builds');
  return { ok: true, id, status: result.status, savedAt: new Date().toISOString() };
}

export type ShareResult =
  | { ok: true; url: string; qr: string; visibility: 'public' | 'unlisted' | 'private' }
  | { ok: false; error: string };

/**
 * เปิดหน้าต่างแชร์: สเปกส่วนตัวเปลี่ยนเป็น "ทุกคนที่มีลิงก์" ให้อัตโนมัติ (มติในหัวข้อ C)
 * ถ้าส่ง visibility มาด้วยจะเปลี่ยนเป็นค่านั้น
 */
export async function shareBuild(rawId: string, rawVisibility?: string): Promise<ShareResult> {
  const auth = await authorizeMember();
  if (!auth.ok) return auth;
  const id = buildIdSchema.safeParse(rawId);
  const visibility = visibilitySchema.optional().safeParse(rawVisibility);
  if (!id.success || !visibility.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };

  const build = await ownedBuild(id.data, auth.user.id);
  if (!build) return { ok: false, error: 'ไม่พบสเปกนี้ในบัญชีของคุณ' };

  const next = visibility.data ?? (build.visibility === 'private' ? 'unlisted' : build.visibility);
  if (next !== build.visibility) {
    await db.update(builds).set({ visibility: next }).where(eq(builds.id, build.id));
    if (next === 'public' || build.visibility === 'public') updateTag('builds');
  }
  const url = shortUrl(build.id);
  return { ok: true, url, qr: await qrSvg(url), visibility: next };
}

export async function deleteBuild(rawId: string): Promise<ActionResult> {
  const auth = await authorizeMember();
  if (!auth.ok) return auth;
  const id = buildIdSchema.safeParse(rawId);
  if (!id.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };

  // เงื่อนไข user_id อยู่ในคำสั่งลบเลย ลบสเปกของคนอื่นไม่ได้แม้รู้รหัส (หัวข้อ 9.1)
  const deleted = await db
    .delete(builds)
    .where(and(eq(builds.id, id.data), eq(builds.userId, auth.user.id)))
    .returning({ visibility: builds.visibility });
  if (deleted.length === 0) return { ok: false, error: 'ไม่พบสเปกนี้ในบัญชีของคุณ' };
  if (deleted[0].visibility === 'public') updateTag('builds');
  return { ok: true };
}
