'use server';

import { and, count, eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { updateTag } from 'next/cache';

import { buildItems, builds, buildVotes, comments, favorites, reports, users } from '@/db/schema';
import { newBuildId } from '@/lib/builder/build-id';
import { checkBuild } from '@/lib/compat';
import { db } from '@/lib/db';
import { clientIp, hitRateLimit } from '@/lib/rate-limit';
import { type ActionResult, authorizeMember, authorizeVerifiedMember } from '@/lib/session';
import { buildIdSchema } from '@/lib/validators/builds';
import { commentSchema, reportSchema, voteSchema } from '@/lib/validators/community';
import { notify } from '@/server/notify';
import { getBuildWithItems } from '@/server/queries/builds';
import { getSystemConfig } from '@/server/queries/settings';

// Server Actions ส่วนชุมชน (หัวข้อ 3.7, 8.3)
// ทุกฟังก์ชันตรวจสิทธิ์ก่อน ตรวจข้อมูลด้วย Zod และจำกัดความถี่กันสแปม (หัวข้อ 9.1)
// โหวต คอมเมนต์ Fork และรายงาน ต้องยืนยันอีเมลก่อน (มติ Q4)

const firstError = (issues: { message: string }[]) => issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง';

/** สเปกที่คนอื่นเข้าถึงได้ในฐานะชุมชน: สาธารณะ หรือมีลิงก์ (ส่วนตัวถือว่าไม่พบ) */
async function communityBuild(id: string) {
  const [build] = await db
    .select({
      id: builds.id,
      userId: builds.userId,
      title: builds.title,
      visibility: builds.visibility,
    })
    .from(builds)
    .where(eq(builds.id, id));
  if (!build || build.visibility === 'private') return null;
  return build;
}

function refreshBuild(visibility: string) {
  // หน้าชุมชนและโปรไฟล์แคชไว้ ต้องล้างเมื่อคะแนนหรือจำนวนคอมเมนต์ของสเปกสาธารณะเปลี่ยน
  if (visibility === 'public') updateTag('builds');
}

export type VoteResult = { ok: true; score: number; myVote: number } | { ok: false; error: string };

/**
 * โหวต +1/−1 หรือ 0 = ยกเลิก (หัวข้อ 8.3 voteBuild)
 * vote_score คำนวณใหม่จากผลรวมในตาราง build_votes ทุกครั้ง จึงไม่เพี้ยนแม้กดพร้อมกันหลายคน
 * แจ้งเตือนเจ้าของเฉพาะตอนโหวตครั้งแรก กดสลับไปมาจะไม่แจ้งซ้ำ
 */
export async function voteBuild(raw: unknown): Promise<VoteResult> {
  const auth = await authorizeVerifiedMember();
  if (!auth.ok) return auth;
  const parsed = voteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };
  const { buildId, value } = parsed.data;

  const limit = await hitRateLimit(`vote:${auth.user.id}`, 60);
  if (limit.count > 30) return { ok: false, error: 'โหวตถี่เกินไป กรุณารอสักครู่' };

  const build = await communityBuild(buildId);
  if (!build) return { ok: false, error: 'ไม่พบสเปกนี้' };
  if (build.userId === auth.user.id) return { ok: false, error: 'โหวตสเปกของตัวเองไม่ได้' };

  const score = await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ value: buildVotes.value })
      .from(buildVotes)
      .where(and(eq(buildVotes.buildId, buildId), eq(buildVotes.userId, auth.user.id)));
    if (value === 0) {
      await tx
        .delete(buildVotes)
        .where(and(eq(buildVotes.buildId, buildId), eq(buildVotes.userId, auth.user.id)));
    } else {
      await tx
        .insert(buildVotes)
        .values({ buildId, userId: auth.user.id, value })
        .onConflictDoUpdate({
          target: [buildVotes.buildId, buildVotes.userId],
          set: { value },
        });
    }
    const [row] = await tx
      .update(builds)
      .set({
        voteScore: sql`(SELECT COALESCE(SUM(${buildVotes.value}), 0) FROM ${buildVotes} WHERE ${buildVotes.buildId} = ${buildId})`,
      })
      .where(eq(builds.id, buildId))
      .returning({ voteScore: builds.voteScore });
    if (!before && value === 1) {
      await notify(tx, {
        userId: build.userId,
        actorId: auth.user.id,
        buildId,
        type: 'vote',
        message: `${auth.user.name} โหวตให้สเปก "${build.title}"`,
      });
    }
    return row?.voteScore ?? 0;
  });

  refreshBuild(build.visibility);
  return { ok: true, score, myVote: value };
}

/**
 * คอมเมนต์และตอบกลับได้ 1 ชั้น (หัวข้อ 3.7) จำกัด 10 คอมเมนต์ต่อนาที (หัวข้อ 9.1)
 * ข้อความเก็บเป็นตัวอักษรล้วน หน้าเว็บแสดงผ่าน React ซึ่ง escape ให้ ไม่แสดงเป็น HTML
 */
export async function addComment(raw: unknown): Promise<ActionResult & { id?: number }> {
  const auth = await authorizeVerifiedMember();
  if (!auth.ok) return auth;
  const parsed = commentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  const { buildId, body, parentId } = parsed.data;

  const limit = await hitRateLimit(`comment:${auth.user.id}`, 60);
  if (limit.count > 10) return { ok: false, error: 'คอมเมนต์ได้ไม่เกิน 10 ครั้งต่อนาที' };

  const build = await communityBuild(buildId);
  if (!build) return { ok: false, error: 'ไม่พบสเปกนี้' };

  let parentAuthor: string | null = null;
  if (parentId !== null) {
    const [parent] = await db
      .select({
        userId: comments.userId,
        parentId: comments.parentId,
        buildId: comments.buildId,
        isHidden: comments.isHidden,
      })
      .from(comments)
      .where(eq(comments.id, parentId));
    if (!parent || parent.buildId !== buildId || parent.isHidden) {
      return { ok: false, error: 'ไม่พบคอมเมนต์ที่จะตอบกลับ' };
    }
    // ตอบกลับได้ชั้นเดียว: ตอบคำตอบอีกทีไม่ได้
    if (parent.parentId !== null) return { ok: false, error: 'ตอบกลับได้เพียง 1 ชั้น' };
    parentAuthor = parent.userId;
  }

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(comments)
      .values({ buildId, userId: auth.user.id, body, parentId })
      .returning({ id: comments.id });
    const preview = body.length > 60 ? `${body.slice(0, 60)}…` : body;
    await notify(tx, [
      {
        userId: build.userId,
        actorId: auth.user.id,
        buildId,
        type: 'comment',
        message: `${auth.user.name} คอมเมนต์ในสเปก "${build.title}": ${preview}`,
      },
      // คนที่ถูกตอบกลับ (ถ้าไม่ใช่เจ้าของสเปก ซึ่งได้แจ้งเตือนข้างบนแล้ว)
      ...(parentAuthor && parentAuthor !== build.userId
        ? [
            {
              userId: parentAuthor,
              actorId: auth.user.id,
              buildId,
              type: 'reply' as const,
              message: `${auth.user.name} ตอบกลับคอมเมนต์ของคุณ: ${preview}`,
            },
          ]
        : []),
    ]);
    return row?.id;
  });

  refreshBuild(build.visibility);
  return { ok: true, id };
}

/** ลบคอมเมนต์ของตัวเอง (คำตอบใต้คอมเมนต์นั้นถูกลบตาม) */
export async function deleteComment(rawId: unknown): Promise<ActionResult> {
  const auth = await authorizeMember();
  if (!auth.ok) return auth;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };
  // ตรวจเจ้าของในเงื่อนไข WHERE ลบของคนอื่นไม่ได้
  const deleted = await db
    .delete(comments)
    .where(and(eq(comments.id, id), eq(comments.userId, auth.user.id)))
    .returning({ buildId: comments.buildId });
  if (deleted.length === 0) return { ok: false, error: 'ไม่พบคอมเมนต์นี้' };
  updateTag('builds');
  return { ok: true };
}

/** เพิ่ม/ลบรายการโปรด (หัวข้อ 3.7 และมติ Q6) */
export async function toggleFavorite(
  rawId: unknown,
): Promise<ActionResult & { favorited?: boolean }> {
  const auth = await authorizeMember();
  if (!auth.ok) return auth;
  const id = buildIdSchema.safeParse(rawId);
  if (!id.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };

  const [build] = await db
    .select({ userId: builds.userId, visibility: builds.visibility })
    .from(builds)
    .where(eq(builds.id, id.data));
  if (!build || (build.visibility === 'private' && build.userId !== auth.user.id)) {
    return { ok: false, error: 'ไม่พบสเปกนี้' };
  }

  const removed = await db
    .delete(favorites)
    .where(and(eq(favorites.userId, auth.user.id), eq(favorites.buildId, id.data)))
    .returning({ buildId: favorites.buildId });
  if (removed.length > 0) return { ok: true, favorited: false };

  const [{ value: total } = { value: 0 }] = await db
    .select({ value: count() })
    .from(favorites)
    .where(eq(favorites.userId, auth.user.id));
  if (total >= 500) return { ok: false, error: 'รายการโปรดเต็มแล้ว (500 รายการ)' };
  await db
    .insert(favorites)
    .values({ userId: auth.user.id, buildId: id.data })
    .onConflictDoNothing();
  return { ok: true, favorited: true };
}

export type ForkResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Fork: คัดลอกสเปกที่เปิดให้ดูได้มาเป็นสเปกส่วนตัวของเรา เก็บ forked_from_id ว่ามาจากสเปกไหน
 * เจ้าของกดคัดลอกสเปกตัวเองได้ด้วย (ปุ่ม "คัดลอก" ในหน้าสเปกของฉัน) แต่ไม่นับเป็น Fork
 * ราคาและผลตรวจคำนวณใหม่จากข้อมูลอะไหล่ล่าสุด ไม่คัดลอกตัวเลขเก่า
 */
export async function forkBuild(rawId: unknown): Promise<ForkResult> {
  const auth = await authorizeVerifiedMember();
  if (!auth.ok) return auth;
  const id = buildIdSchema.safeParse(rawId);
  if (!id.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };

  const limit = await hitRateLimit(`fork:${auth.user.id}`, 60);
  if (limit.count > 10) return { ok: false, error: 'คัดลอกถี่เกินไป กรุณารอสักครู่' };

  const source = await getBuildWithItems(id.data);
  const own = source?.build.userId === auth.user.id;
  if (!source || (source.build.visibility === 'private' && !own)) {
    return { ok: false, error: 'ไม่พบสเปกนี้' };
  }
  const [{ value: owned } = { value: 0 }] = await db
    .select({ value: count() })
    .from(builds)
    .where(eq(builds.userId, auth.user.id));
  if (owned >= 200)
    return { ok: false, error: 'มีสเปกในบัญชีครบ 200 ชุดแล้ว กรุณาลบสเปกที่ไม่ใช้ก่อน' };

  // อะไหล่ที่เลิกขายแล้วไม่คัดลอกไป เพราะสเปกใหม่เพิ่มอะไหล่ที่เลิกขายไม่ได้
  const items = source.items.filter((item) => item.part.isActive);
  const { engine } = await getSystemConfig();
  const result = checkBuild({
    items,
    budget: source.build.budget,
    usage: source.build.usageType,
    settings: engine,
  });

  const newId = newBuildId();
  const title = `${source.build.title} (${own ? 'สำเนา' : 'Fork'})`.slice(0, 100);
  await db.transaction(async (tx) => {
    await tx.insert(builds).values({
      id: newId,
      userId: auth.user.id,
      forkedFromId: own ? null : source.build.id,
      title,
      description: source.build.description,
      usageType: source.build.usageType,
      budget: source.build.budget,
      visibility: 'private',
      totalPrice: result.price.total,
      totalNewPrice: result.price.totalNew,
      totalWatt: result.power.totalWatt,
      perfScore: Math.round(result.score.score),
      compatStatus: result.status,
    });
    if (items.length) {
      await tx.insert(buildItems).values(
        items.map((item) => ({
          buildId: newId,
          partId: item.part.id,
          quantity: item.quantity,
          priceAtAdd: item.part.price,
          condition: item.condition,
          offeredPrice: item.offeredPrice,
          warrantyMonthsLeft: item.warrantyMonthsLeft,
        })),
      );
    }
    if (!own) {
      await notify(tx, {
        userId: source.build.userId,
        actorId: auth.user.id,
        buildId: source.build.id,
        type: 'fork',
        message: `${auth.user.name} Fork สเปก "${source.build.title}" ไปแก้ต่อ`,
      });
    }
  });
  return { ok: true, id: newId };
}

/** รายงานเนื้อหาไม่เหมาะสม (หัวข้อ 3.7) แอดมินจัดการในหน้า /admin/reports เฟส 12 */
export async function reportContent(raw: unknown): Promise<ActionResult> {
  const auth = await authorizeVerifiedMember();
  if (!auth.ok) return auth;
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  const { targetType, targetId, reason, detail } = parsed.data;

  const limit = await hitRateLimit(`report:${clientIp(await headers())}:${auth.user.id}`, 600);
  if (limit.count > 5) return { ok: false, error: 'รายงานถี่เกินไป กรุณารอสักครู่' };

  // ตรวจว่าเป้าหมายมีอยู่จริงและผู้รายงานมองเห็นได้
  const exists = await (async () => {
    if (targetType === 'build') {
      return buildIdSchema.safeParse(targetId).success && Boolean(await communityBuild(targetId));
    }
    if (targetType === 'comment') {
      const commentId = Number(targetId);
      if (!Number.isInteger(commentId) || commentId <= 0) return false;
      const [row] = await db
        .select({ id: comments.id })
        .from(comments)
        .where(eq(comments.id, commentId));
      return Boolean(row);
    }
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.username, targetId));
    return Boolean(row);
  })();
  if (!exists) return { ok: false, error: 'ไม่พบเนื้อหาที่รายงาน' };

  // รายงานซ้ำเรื่องเดิมที่ยังเปิดอยู่ไม่ได้
  const [open] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.reporterId, auth.user.id),
        eq(reports.targetType, targetType),
        eq(reports.targetId, targetId),
        eq(reports.status, 'open'),
      ),
    );
  if (open) return { ok: false, error: 'คุณรายงานเนื้อหานี้ไปแล้ว แอดมินกำลังตรวจสอบ' };

  await db.insert(reports).values({
    reporterId: auth.user.id,
    targetType,
    targetId,
    reason,
    detail: detail || null,
  });
  return { ok: true };
}
