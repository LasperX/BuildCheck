import 'server-only';

import { and, count, desc, eq, gte, ilike, inArray, lt, or, type SQL, sql } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';

import {
  adminLogs,
  brands,
  buildItems,
  builds,
  categories,
  comments,
  parts,
  reports,
  usedPriceReports,
  users,
} from '@/db/schema';
import { checkBuild, type RuleCode, type UsageType } from '@/lib/compat';
import { db } from '@/lib/db';
import { CATEGORY_SLUGS, type CategorySlug, isCategorySlug } from '@/lib/parts/spec-fields';

import { getEngineParts } from './engine-parts';
import { getSystemConfig } from './settings';

// คำสั่งอ่านฝั่งแอดมิน ทุกหน้าที่เรียกต้องผ่าน requireAdmin() ก่อน

export const ADMIN_LIST_SIZE = 30;

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (m) => `\\${m}`);

// ---------- ผู้ใช้ ----------

export type AdminUserRow = {
  id: string;
  email: string;
  username: string | null;
  displayName: string;
  role: 'member' | 'admin';
  banned: boolean;
  banReason: string | null;
  emailVerified: boolean;
  createdAt: Date;
  buildCount: number;
  commentCount: number;
};

export async function listUsers(filters: {
  q?: string;
  status?: 'banned' | 'admin';
  page: number;
}): Promise<{ rows: AdminUserRow[]; total: number }> {
  const where: (SQL | undefined)[] = [];
  const q = filters.q?.trim();
  if (q) {
    const like = `%${escapeLike(q)}%`;
    where.push(
      or(ilike(users.email, like), ilike(users.username, like), ilike(users.displayName, like)),
    );
  }
  if (filters.status === 'banned') where.push(eq(users.banned, true));
  if (filters.status === 'admin') where.push(eq(users.role, 'admin'));

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        banned: users.banned,
        banReason: users.banReason,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        // กิจกรรมโดยย่อ: จำนวนสเปกและคอมเมนต์
        // ใส่ชื่อตารางเต็ม เพราะ Drizzle ตัดชื่อตารางออกเมื่อคำสั่งหลักมีตารางเดียว "id" จะไปชี้ผิดตาราง
        buildCount: sql<number>`(SELECT COUNT(*)::int FROM builds b WHERE b.user_id = "users"."id")`,
        commentCount: sql<number>`(SELECT COUNT(*)::int FROM comments c WHERE c.user_id = "users"."id")`,
      })
      .from(users)
      .where(and(...where))
      .orderBy(desc(users.createdAt))
      .limit(ADMIN_LIST_SIZE)
      .offset((filters.page - 1) * ADMIN_LIST_SIZE),
    db
      .select({ value: count() })
      .from(users)
      .where(and(...where)),
  ]);
  return { rows, total: total?.value ?? 0 };
}

// ---------- รายงานเนื้อหา ----------

export type AdminReportRow = {
  id: number;
  targetType: 'build' | 'comment' | 'user';
  targetId: string;
  reason: 'spam' | 'offensive' | 'wrong_info' | 'other';
  detail: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: Date;
  reporterName: string | null;
  /** สรุปเนื้อหาที่ถูกรายงาน ให้แอดมินตัดสินได้โดยไม่ต้องเปิดหลายหน้า */
  preview: { title: string; href: string | null; hidden: boolean } | null;
  /** จำนวนรายงานที่เปิดอยู่ของเนื้อหาเดียวกัน */
  sameTarget: number;
};

export async function listReports(status: 'open' | 'closed'): Promise<AdminReportRow[]> {
  const rows = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      detail: reports.detail,
      status: reports.status,
      createdAt: reports.createdAt,
      reporterName: users.displayName,
    })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.reporterId))
    .where(status === 'open' ? eq(reports.status, 'open') : sql`${reports.status} <> 'open'`)
    .orderBy(status === 'open' ? reports.createdAt : desc(reports.resolvedAt))
    .limit(100);

  const buildIds = rows.filter((r) => r.targetType === 'build').map((r) => r.targetId);
  const commentIds = rows
    .filter((r) => r.targetType === 'comment')
    .map((r) => Number(r.targetId))
    .filter((id) => Number.isInteger(id));
  const usernames = rows.filter((r) => r.targetType === 'user').map((r) => r.targetId);

  const [buildRows, commentRows, userRows] = await Promise.all([
    buildIds.length
      ? db
          .select({ id: builds.id, title: builds.title, visibility: builds.visibility })
          .from(builds)
          .where(inArray(builds.id, buildIds))
      : Promise.resolve([]),
    commentIds.length
      ? db
          .select({
            id: comments.id,
            body: comments.body,
            buildId: comments.buildId,
            isHidden: comments.isHidden,
          })
          .from(comments)
          .where(inArray(comments.id, commentIds))
      : Promise.resolve([]),
    usernames.length
      ? db
          .select({
            username: users.username,
            displayName: users.displayName,
            banned: users.banned,
          })
          .from(users)
          .where(inArray(users.username, usernames))
      : Promise.resolve([]),
  ]);
  const buildMap = new Map(buildRows.map((b) => [b.id, b]));
  const commentMap = new Map(commentRows.map((c) => [String(c.id), c]));
  const userMap = new Map(userRows.map((u) => [u.username ?? '', u]));
  const openCount = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== 'open') continue;
    const key = `${row.targetType}:${row.targetId}`;
    openCount.set(key, (openCount.get(key) ?? 0) + 1);
  }

  return rows.map((row) => {
    let preview: AdminReportRow['preview'] = null;
    if (row.targetType === 'build') {
      const build = buildMap.get(row.targetId);
      if (build)
        preview = {
          title: build.title,
          href: `/builds/${build.id}`,
          hidden: build.visibility === 'private',
        };
    } else if (row.targetType === 'comment') {
      const comment = commentMap.get(row.targetId);
      if (comment)
        preview = {
          title: comment.body,
          href: `/builds/${comment.buildId}`,
          hidden: comment.isHidden,
        };
    } else {
      const user = userMap.get(row.targetId);
      if (user)
        preview = {
          title: `${user.displayName} (@${row.targetId})`,
          href: `/u/${row.targetId}`,
          hidden: user.banned,
        };
    }
    return { ...row, preview, sameTarget: openCount.get(`${row.targetType}:${row.targetId}`) ?? 0 };
  });
}

// ---------- บันทึกการทำงาน ----------

export type AdminLogRow = {
  id: number;
  action: string;
  targetType: string | null;
  targetId: string | null;
  changes: { before?: unknown; after?: unknown } | null;
  createdAt: Date;
  adminName: string | null;
};

export async function listAdminLogs(filters: {
  adminId?: string;
  from?: string;
  to?: string;
  before?: number;
}): Promise<{ rows: AdminLogRow[]; hasMore: boolean; admins: { id: string; name: string }[] }> {
  const where: (SQL | undefined)[] = [];
  if (filters.adminId) where.push(eq(adminLogs.adminId, filters.adminId));
  // วันที่ตามเวลาไทย
  if (filters.from)
    where.push(gte(adminLogs.createdAt, new Date(`${filters.from}T00:00:00+07:00`)));
  if (filters.to) where.push(lt(adminLogs.createdAt, new Date(`${filters.to}T24:00:00+07:00`)));
  if (filters.before) where.push(lt(adminLogs.id, filters.before));

  const [rows, admins] = await Promise.all([
    db
      .select({
        id: adminLogs.id,
        action: adminLogs.action,
        targetType: adminLogs.targetType,
        targetId: adminLogs.targetId,
        changes: adminLogs.changes,
        createdAt: adminLogs.createdAt,
        adminName: users.displayName,
      })
      .from(adminLogs)
      .leftJoin(users, eq(users.id, adminLogs.adminId))
      .where(and(...where))
      .orderBy(desc(adminLogs.id))
      .limit(ADMIN_LIST_SIZE + 1),
    db
      .select({ id: users.id, name: users.displayName })
      .from(users)
      .where(sql`${users.id} IN (SELECT DISTINCT ${adminLogs.adminId} FROM ${adminLogs})`),
  ]);
  return { rows: rows.slice(0, ADMIN_LIST_SIZE), hasMore: rows.length > ADMIN_LIST_SIZE, admins };
}

// ---------- Dashboard (หัวข้อ 3.10, getDashboardStats) ----------

export type DashboardStats = {
  cards: {
    members: number;
    newMembers7: number;
    newMembers30: number;
    builds: number;
    publicBuilds: number;
    parts: number;
    pendingUsedReports: number;
    openReports: number;
  };
  /** สมาชิกใหม่และสเปกใหม่รายวัน ย้อนหลัง range วัน */
  daily: { day: string; members: number; builds: number }[];
  /** อะไหล่ที่ถูกเลือกบ่อย 10 อันดับแต่ละหมวด */
  topParts: Record<CategorySlug, { id: number; name: string; uses: number }[]>;
  /** สัดส่วนยี่ห้อ CPU และการ์ดจอในสเปกทั้งหมด */
  brandShare: { cpu: { brand: string; count: number }[]; gpu: { brand: string; count: number }[] };
  /** งบเฉลี่ยตามประเภทการใช้งาน (เฉพาะสเปกที่กรอกงบ) และราคารวมเฉลี่ย */
  budgetByUsage: { usage: UsageType; avgBudget: number | null; avgPrice: number; count: number }[];
  /** ปัญหาความเข้ากันได้ที่เกิดบ่อย ตรวจสเปกทุกชุดใหม่ด้วย Engine */
  topIssues: { code: RuleCode; title: string; builds: number }[];
};

const bangkokDay = sql<string>`to_char(timezone('Asia/Bangkok', ${users.createdAt}), 'YYYY-MM-DD')`;

/**
 * ตัวเลขและกราฟของ Dashboard แคช 5 นาที (หน้าแอดมินไม่ต้องสดทุกวินาที และบางส่วนต้องตรวจสเปกทุกชุด)
 * range = จำนวนวันย้อนหลังของกราฟรายวัน
 */
export async function getDashboardStats(range: 7 | 30 | 90): Promise<DashboardStats> {
  'use cache';
  cacheTag('builds', 'parts', 'dashboard');
  cacheLife('minutes');

  const now = Date.now();
  const days = (n: number) => new Date(now - n * 86_400_000);

  const [
    [memberRow],
    [new7],
    [new30],
    [buildRow],
    [publicRow],
    [partRow],
    [usedPending],
    [reportOpen],
    memberDays,
    buildDays,
    usage,
    budgetRows,
  ] = await Promise.all([
    db.select({ value: count() }).from(users),
    db
      .select({ value: count() })
      .from(users)
      .where(gte(users.createdAt, days(7))),
    db
      .select({ value: count() })
      .from(users)
      .where(gte(users.createdAt, days(30))),
    db.select({ value: count() }).from(builds),
    db.select({ value: count() }).from(builds).where(eq(builds.visibility, 'public')),
    db.select({ value: count() }).from(parts).where(eq(parts.isActive, true)),
    db
      .select({ value: count() })
      .from(usedPriceReports)
      .where(eq(usedPriceReports.status, 'pending')),
    db.select({ value: count() }).from(reports).where(eq(reports.status, 'open')),
    db
      .select({ day: bangkokDay, value: count() })
      .from(users)
      .where(gte(users.createdAt, days(range)))
      .groupBy(bangkokDay),
    db
      .select({
        day: sql<string>`to_char(timezone('Asia/Bangkok', ${builds.createdAt}), 'YYYY-MM-DD')`,
        value: count(),
      })
      .from(builds)
      .where(gte(builds.createdAt, days(range)))
      .groupBy(sql`1`),
    // จำนวนสเปกที่ใช้อะไหล่แต่ละชิ้น (นับสเปก ไม่นับจำนวนชิ้น)
    db
      .select({
        id: parts.id,
        model: parts.model,
        brand: brands.name,
        category: categories.slug,
        uses: sql<number>`COUNT(DISTINCT ${buildItems.buildId})::int`,
      })
      .from(buildItems)
      .innerJoin(parts, eq(parts.id, buildItems.partId))
      .innerJoin(brands, eq(brands.id, parts.brandId))
      .innerJoin(categories, eq(categories.id, parts.categoryId))
      .groupBy(parts.id, parts.model, brands.name, categories.slug),
    db
      .select({
        usage: builds.usageType,
        avgBudget: sql<number | null>`AVG(${builds.budget})::float`,
        avgPrice: sql<number>`COALESCE(AVG(${builds.totalPrice}), 0)::float`,
        count: count(),
      })
      .from(builds)
      .groupBy(builds.usageType),
  ]);

  // กราฟรายวัน: เติมวันที่ไม่มีข้อมูลเป็น 0 เพื่อให้เส้นต่อเนื่อง
  const dayKey = (date: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(date);
  const memberMap = new Map(memberDays.map((row) => [row.day, row.value]));
  const buildMap = new Map(buildDays.map((row) => [row.day, row.value]));
  const daily = Array.from({ length: range }, (_, i) => {
    const day = dayKey(days(range - 1 - i));
    return { day, members: memberMap.get(day) ?? 0, builds: buildMap.get(day) ?? 0 };
  });

  const topParts = Object.fromEntries(
    CATEGORY_SLUGS.map((cat) => [cat, []]),
  ) as unknown as DashboardStats['topParts'];
  const brandCount = { cpu: new Map<string, number>(), gpu: new Map<string, number>() };
  for (const row of [...usage].sort((a, b) => b.uses - a.uses)) {
    if (!isCategorySlug(row.category)) continue;
    const list = topParts[row.category];
    if (list.length < 10)
      list.push({ id: row.id, name: `${row.brand} ${row.model}`, uses: row.uses });
    if (row.category === 'cpu' || row.category === 'gpu') {
      const map = brandCount[row.category];
      map.set(row.brand, (map.get(row.brand) ?? 0) + row.uses);
    }
  }
  const share = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([brand, value]) => ({ brand, count: value }))
      .sort((a, b) => b.count - a.count);

  return {
    cards: {
      members: memberRow?.value ?? 0,
      newMembers7: new7?.value ?? 0,
      newMembers30: new30?.value ?? 0,
      builds: buildRow?.value ?? 0,
      publicBuilds: publicRow?.value ?? 0,
      parts: partRow?.value ?? 0,
      pendingUsedReports: usedPending?.value ?? 0,
      openReports: reportOpen?.value ?? 0,
    },
    daily,
    topParts,
    brandShare: { cpu: share(brandCount.cpu), gpu: share(brandCount.gpu) },
    budgetByUsage: budgetRows
      .map((row) => ({
        usage: row.usage,
        avgBudget: row.avgBudget === null ? null : Math.round(row.avgBudget),
        avgPrice: Math.round(row.avgPrice),
        count: row.count,
      }))
      .sort((a, b) => b.count - a.count),
    topIssues: await countIssues(),
  };
}

/**
 * ปัญหาที่เกิดบ่อย: ตรวจทุกสเปกใหม่ด้วย checkBuild (ไม่ได้เก็บรายการปัญหาไว้ในฐานข้อมูล)
 * นับเฉพาะระดับผิดพลาดและเตือน สเปกหนึ่งชุดนับรหัสเดิมครั้งเดียว อ่านล่าสุด 2,000 สเปก
 */
async function countIssues(): Promise<DashboardStats['topIssues']> {
  const recent = await db
    .select({ id: builds.id, budget: builds.budget, usage: builds.usageType })
    .from(builds)
    .orderBy(desc(builds.updatedAt))
    .limit(2000);
  if (recent.length === 0) return [];
  const items = await db
    .select({
      buildId: buildItems.buildId,
      partId: buildItems.partId,
      quantity: buildItems.quantity,
    })
    .from(buildItems)
    .where(
      inArray(
        buildItems.buildId,
        recent.map((b) => b.id),
      ),
    );
  const [partList, config] = await Promise.all([
    getEngineParts([...new Set(items.map((item) => item.partId))]),
    getSystemConfig(),
  ]);
  const partMap = new Map(partList.map((part) => [part.id, part]));
  const byBuild = new Map<string, typeof items>();
  for (const item of items) byBuild.set(item.buildId, [...(byBuild.get(item.buildId) ?? []), item]);

  const tally = new Map<RuleCode, { title: string; builds: number }>();
  for (const build of recent) {
    const engineItems = (byBuild.get(build.id) ?? []).flatMap((item) => {
      const part = partMap.get(item.partId);
      return part ? [{ part, quantity: item.quantity, condition: 'new' as const }] : [];
    });
    if (engineItems.length === 0) continue;
    const { issues } = checkBuild({
      items: engineItems,
      budget: build.budget,
      usage: build.usage,
      settings: config.engine,
    });
    const seen = new Set<RuleCode>();
    for (const issue of issues) {
      if (issue.level === 'info' || seen.has(issue.code)) continue;
      seen.add(issue.code);
      const entry = tally.get(issue.code) ?? { title: issue.title, builds: 0 };
      entry.builds += 1;
      tally.set(issue.code, entry);
    }
  }
  return [...tally.entries()]
    .map(([code, entry]) => ({ code, ...entry }))
    .sort((a, b) => b.builds - a.builds)
    .slice(0, 10);
}
