import 'server-only';

import { and, asc, count, desc, eq, gte, lte, type SQL, sql } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';

import { builds, buildVotes, comments, favorites, users } from '@/db/schema';
import type { UsageType } from '@/lib/compat';
import { db } from '@/lib/db';
import { COMMUNITY_PAGE_SIZE, type CommunityQuery } from '@/lib/validators/community';

// อ่านข้อมูลส่วนชุมชน รายการสาธารณะแคชไว้ด้วย tag 'builds' ส่วนที่ขึ้นกับผู้ดู (โหวตของฉัน รายการโปรด) ไม่แคช

export type BuildCard = {
  id: string;
  title: string;
  usageType: UsageType;
  totalPrice: number;
  totalWatt: number;
  perfScore: number;
  compatStatus: 'ok' | 'warning' | 'error';
  voteScore: number;
  /** คะแนนโหวต 7 วันล่าสุด (เฉพาะแท็บยอดนิยมสัปดาห์นี้) */
  weekScore?: number;
  commentCount: number;
  visibility: 'public' | 'unlisted' | 'private';
  updatedAt: Date;
  ownerName: string;
  ownerUsername: string | null;
  /** ใช้แสดงป้ายติ๊กถูกของแอดมิน */
  ownerRole: 'member' | 'admin';
};

const commentCount = sql<number>`(SELECT COUNT(*)::int FROM ${comments} WHERE ${comments.buildId} = ${builds.id} AND ${comments.isHidden} = false)`;

const cardColumns = {
  id: builds.id,
  title: builds.title,
  usageType: builds.usageType,
  totalPrice: builds.totalPrice,
  totalWatt: builds.totalWatt,
  perfScore: builds.perfScore,
  compatStatus: builds.compatStatus,
  voteScore: builds.voteScore,
  visibility: builds.visibility,
  updatedAt: builds.updatedAt,
  ownerName: users.displayName,
  ownerUsername: users.username,
  ownerRole: users.role,
  commentCount,
};

/**
 * หน้าชุมชน /builds (หัวข้อ 3.7)
 *   ใหม่ล่าสุด = เรียงตามวันที่สร้าง
 *   ยอดนิยมสัปดาห์นี้ = ผลรวมโหวตที่เกิดใน 7 วันล่าสุด (ไม่ใช่คะแนนสะสมทั้งหมด) สเปกเก่าที่ยังมีคนโหวตจึงขึ้นได้
 *   ยอดนิยมตลอดกาล = vote_score สะสม
 * แสดงเฉพาะสเปกสาธารณะ และไม่แสดงของผู้ใช้ที่ถูกระงับ
 */
export async function listCommunityBuilds(
  query: CommunityQuery,
): Promise<{ items: BuildCard[]; total: number }> {
  'use cache';
  cacheTag('builds');
  cacheLife('minutes');

  const where: (SQL | undefined)[] = [eq(builds.visibility, 'public'), eq(users.banned, false)];
  if (query.usage) where.push(eq(builds.usageType, query.usage));
  if (query.min !== undefined) where.push(gte(builds.totalPrice, query.min));
  if (query.max !== undefined) where.push(lte(builds.totalPrice, query.max));

  const weekScore = sql<number>`COALESCE((SELECT SUM(${buildVotes.value})::int FROM ${buildVotes} WHERE ${buildVotes.buildId} = ${builds.id} AND ${buildVotes.createdAt} > now() - interval '7 days'), 0)`;
  const order =
    query.tab === 'new'
      ? [desc(builds.createdAt), desc(builds.id)]
      : query.tab === 'week'
        ? [desc(weekScore), desc(builds.voteScore), desc(builds.createdAt)]
        : [desc(builds.voteScore), desc(builds.createdAt)];

  const [items, [totalRow]] = await Promise.all([
    db
      .select({ ...cardColumns, weekScore })
      .from(builds)
      .innerJoin(users, eq(users.id, builds.userId))
      .where(and(...where))
      .orderBy(...order)
      .limit(COMMUNITY_PAGE_SIZE)
      .offset((query.page - 1) * COMMUNITY_PAGE_SIZE),
    db
      .select({ value: count() })
      .from(builds)
      .innerJoin(users, eq(users.id, builds.userId))
      .where(and(...where)),
  ]);
  return {
    // คะแนนสัปดาห์แสดงบนการ์ดเฉพาะแท็บยอดนิยมสัปดาห์นี้
    items: items.map((item) => (query.tab === 'week' ? item : { ...item, weekScore: undefined })),
    total: totalRow?.value ?? 0,
  };
}

/** สเปกของฉันทั้งหมด (ทุกสถานะการมองเห็น) ไม่แคชเพราะเป็นข้อมูลส่วนตัว */
export async function getMyBuilds(userId: string): Promise<BuildCard[]> {
  return db
    .select(cardColumns)
    .from(builds)
    .innerJoin(users, eq(users.id, builds.userId))
    .where(eq(builds.userId, userId))
    .orderBy(desc(builds.updatedAt));
}

/** รายการโปรดของฉัน สเปกที่เจ้าของเปลี่ยนเป็นส่วนตัวแล้วจะไม่แสดง */
export async function getMyFavorites(userId: string): Promise<BuildCard[]> {
  const rows = await db
    .select(cardColumns)
    .from(favorites)
    .innerJoin(builds, eq(builds.id, favorites.buildId))
    .innerJoin(users, eq(users.id, builds.userId))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));
  return rows.filter((row) => row.visibility !== 'private');
}

export type PublicProfile = {
  username: string;
  displayName: string;
  role: 'member' | 'admin';
  image: string | null;
  bio: string | null;
  joinedAt: Date;
  totalVotes: number;
  builds: BuildCard[];
};

/** โปรไฟล์สาธารณะ /u/[username] ไม่มีอีเมล (หัวข้อ 9.1) */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  'use cache';
  cacheTag('builds', 'profiles');
  cacheLife('minutes');

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      image: users.image,
      bio: users.bio,
      joinedAt: users.createdAt,
      banned: users.banned,
    })
    .from(users)
    .where(eq(users.username, username.toLowerCase()));
  if (!user?.username || user.banned) return null;

  const list = await db
    .select(cardColumns)
    .from(builds)
    .innerJoin(users, eq(users.id, builds.userId))
    .where(and(eq(builds.userId, user.id), eq(builds.visibility, 'public')))
    .orderBy(desc(builds.voteScore), desc(builds.createdAt))
    .limit(60);
  return {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    image: user.image,
    bio: user.bio,
    joinedAt: user.joinedAt,
    totalVotes: list.reduce((sum, build) => sum + build.voteScore, 0),
    builds: list,
  };
}

export type CommentView = {
  id: number;
  body: string;
  createdAt: Date;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorRole: 'member' | 'admin';
  authorImage: string | null;
  replies: Omit<CommentView, 'replies'>[];
};

export type BuildSocial = {
  myVote: number;
  favorited: boolean;
  favoriteCount: number;
  forkCount: number;
  forkedFrom: {
    id: string;
    title: string;
    ownerName: string;
    ownerRole: 'member' | 'admin';
  } | null;
  comments: CommentView[];
};

/** โหวต คอมเมนต์ รายการโปรด และต้นฉบับของสเปกหนึ่งชุด สำหรับหน้า /builds/[id] */
export async function getBuildSocial(
  buildId: string,
  forkedFromId: string | null,
  viewerId: string | null,
): Promise<BuildSocial> {
  const [vote, favorite, favoriteTotal, forkTotal, source, rows] = await Promise.all([
    viewerId
      ? db
          .select({ value: buildVotes.value })
          .from(buildVotes)
          .where(and(eq(buildVotes.buildId, buildId), eq(buildVotes.userId, viewerId)))
      : Promise.resolve([]),
    viewerId
      ? db
          .select({ buildId: favorites.buildId })
          .from(favorites)
          .where(and(eq(favorites.buildId, buildId), eq(favorites.userId, viewerId)))
      : Promise.resolve([]),
    db.select({ value: count() }).from(favorites).where(eq(favorites.buildId, buildId)),
    db.select({ value: count() }).from(builds).where(eq(builds.forkedFromId, buildId)),
    forkedFromId
      ? db
          .select({
            id: builds.id,
            title: builds.title,
            visibility: builds.visibility,
            ownerName: users.displayName,
            ownerRole: users.role,
          })
          .from(builds)
          .innerJoin(users, eq(users.id, builds.userId))
          .where(eq(builds.id, forkedFromId))
      : Promise.resolve([]),
    db
      .select({
        id: comments.id,
        parentId: comments.parentId,
        body: comments.body,
        createdAt: comments.createdAt,
        authorId: users.id,
        authorName: users.displayName,
        authorUsername: users.username,
        authorRole: users.role,
        authorImage: users.image,
      })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.userId))
      .where(and(eq(comments.buildId, buildId), eq(comments.isHidden, false)))
      .orderBy(asc(comments.createdAt))
      .limit(500),
  ]);

  // จัดเป็นต้นไม้ 1 ชั้น: คอมเมนต์หลัก แล้วคำตอบเรียงตามเวลาใต้แต่ละอัน
  const top: CommentView[] = [];
  const byId = new Map<number, CommentView>();
  for (const row of rows) {
    if (row.parentId === null) {
      const { parentId: _parentId, ...rest } = row;
      const view: CommentView = { ...rest, replies: [] };
      top.push(view);
      byId.set(row.id, view);
    }
  }
  for (const row of rows) {
    if (row.parentId === null) continue;
    const { parentId, ...rest } = row;
    byId.get(parentId)?.replies.push(rest);
  }

  // ต้นฉบับที่เจ้าของเปลี่ยนเป็นส่วนตัวแล้ว ไม่ให้ลิงก์และไม่บอกชื่อ
  const origin = source[0];
  return {
    myVote: vote[0]?.value ?? 0,
    favorited: favorite.length > 0,
    favoriteCount: favoriteTotal[0]?.value ?? 0,
    forkCount: forkTotal[0]?.value ?? 0,
    forkedFrom:
      origin && origin.visibility !== 'private'
        ? {
            id: origin.id,
            title: origin.title,
            ownerName: origin.ownerName,
            ownerRole: origin.ownerRole,
          }
        : null,
    comments: top.reverse(),
  };
}

/** สเปกของฉันและรายการโปรด ใช้เป็นตัวเลือกในหน้าเทียบสเปก */
export async function getCompareChoices(userId: string) {
  const [mine, favs] = await Promise.all([getMyBuilds(userId), getMyFavorites(userId)]);
  const seen = new Set<string>();
  return [...mine, ...favs]
    .filter((build) => (seen.has(build.id) ? false : (seen.add(build.id), true)))
    .slice(0, 50)
    .map(({ id, title, totalPrice, ownerName }) => ({ id, title, totalPrice, ownerName }));
}
