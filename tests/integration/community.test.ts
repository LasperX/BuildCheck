import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildVotes, builds, comments, notifications } from '@/db/schema';
import { db } from '@/lib/db';
import { saveBuild } from '@/server/actions/builds';
import {
  addComment,
  deleteComment,
  forkBuild,
  reportContent,
  toggleFavorite,
  voteBuild,
} from '@/server/actions/community';
import { getBuildWithItems } from '@/server/queries/builds';

import {
  actAs,
  buildRow,
  cleanupAccounts,
  createAccount,
  itemsOf,
  partsByCategory,
  type TestAccount,
} from './helpers';

// โหวต คอมเมนต์ รายการโปรด Fork รายงาน (หัวข้อ 3.7, 8.3, มติ Q4 ต้องยืนยันอีเมล)

let owner: TestAccount;
let voter: TestAccount;
let unverified: TestAccount;
let publicBuild: string;
let privateBuild: string;

async function makeBuild(account: TestAccount, visibility: 'public' | 'private') {
  const { pick } = await partsByCategory();
  actAs(account);
  const result = await saveBuild({
    title: `สเปก ${visibility}`,
    description: '',
    usageType: 'gaming',
    budget: null,
    items: [{ partId: pick('cpu')[0]!.id, quantity: 1 }],
  });
  if (!result.ok) throw new Error(result.error);
  await db.update(builds).set({ visibility }).where(eq(builds.id, result.id));
  return result.id;
}

const notificationsOf = (userId: string, type: 'vote' | 'comment' | 'reply' | 'fork') =>
  db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.type, type)));

beforeAll(async () => {
  [owner, voter, unverified] = await Promise.all([
    createAccount(),
    createAccount(),
    createAccount({ verified: false }),
  ]);
  publicBuild = await makeBuild(owner, 'public');
  privateBuild = await makeBuild(owner, 'private');
});

afterAll(async () => {
  await cleanupAccounts();
});

describe('voteBuild', () => {
  it('ผู้เยี่ยมชมและบัญชีที่ยังไม่ยืนยันอีเมลโหวตไม่ได้', async () => {
    actAs(null);
    expect((await voteBuild({ buildId: publicBuild, value: 1 })).ok).toBe(false);
    actAs(unverified);
    expect((await voteBuild({ buildId: publicBuild, value: 1 })).ok).toBe(false);
  });

  it('โหวตสเปกของตัวเองและสเปกส่วนตัวของคนอื่นไม่ได้', async () => {
    actAs(owner);
    expect((await voteBuild({ buildId: publicBuild, value: 1 })).ok).toBe(false);
    actAs(voter);
    expect((await voteBuild({ buildId: privateBuild, value: 1 })).ok).toBe(false);
  });

  it('ค่าโหวตต้องเป็น 1, -1 หรือ 0 เท่านั้น', async () => {
    actAs(voter);
    expect((await voteBuild({ buildId: publicBuild, value: 5 })).ok).toBe(false);
  });

  it('โหวตซ้ำเป็นการแก้ค่าเดิม คะแนนรวมถูกต้อง และแจ้งเจ้าของครั้งเดียว', async () => {
    actAs(voter);
    expect(await voteBuild({ buildId: publicBuild, value: 1 })).toMatchObject({
      ok: true,
      score: 1,
    });
    expect(await voteBuild({ buildId: publicBuild, value: -1 })).toMatchObject({
      ok: true,
      score: -1,
    });
    expect(await voteBuild({ buildId: publicBuild, value: 1 })).toMatchObject({
      ok: true,
      score: 1,
    });
    const rows = await db.select().from(buildVotes).where(eq(buildVotes.buildId, publicBuild));
    expect(rows).toHaveLength(1);
    expect((await buildRow(publicBuild))?.voteScore).toBe(1);
    expect(await notificationsOf(owner.id, 'vote')).toHaveLength(1);
    expect(await voteBuild({ buildId: publicBuild, value: 0 })).toMatchObject({
      ok: true,
      score: 0,
    });
  });
});

describe('addComment / deleteComment', () => {
  it('ผู้เยี่ยมชมและบัญชีที่ยังไม่ยืนยันอีเมลคอมเมนต์ไม่ได้', async () => {
    actAs(null);
    expect((await addComment({ buildId: publicBuild, body: 'สวัสดี' })).ok).toBe(false);
    actAs(unverified);
    expect((await addComment({ buildId: publicBuild, body: 'สวัสดี' })).ok).toBe(false);
  });

  it('ข้อความว่างหรือยาวเกิน 1,000 ตัวอักษรถูกปฏิเสธ', async () => {
    actAs(voter);
    expect((await addComment({ buildId: publicBuild, body: '   ' })).ok).toBe(false);
    expect((await addComment({ buildId: publicBuild, body: 'ก'.repeat(1001) })).ok).toBe(false);
  });

  it('คอมเมนต์ในสเปกส่วนตัวของคนอื่นไม่ได้', async () => {
    actAs(voter);
    expect((await addComment({ buildId: privateBuild, body: 'แอบดู' })).ok).toBe(false);
  });

  it('คอมเมนต์และตอบกลับได้ 1 ชั้น ตอบซ้อนชั้นที่ 2 ไม่ได้ และแจ้งเตือนถูกคน', async () => {
    actAs(voter);
    const top = await addComment({ buildId: publicBuild, body: '<b>คอมเมนต์หลัก</b>' });
    expect(top.ok).toBe(true);
    // เก็บข้อความตามที่พิมพ์ (React escape ตอนแสดง) ไม่แปลงหรือรันเป็น HTML
    const [saved] = await db.select().from(comments).where(eq(comments.id, top.id!));
    expect(saved?.body).toBe('<b>คอมเมนต์หลัก</b>');

    actAs(owner);
    const reply = await addComment({ buildId: publicBuild, body: 'ตอบกลับ', parentId: top.id! });
    expect(reply.ok).toBe(true);
    actAs(voter);
    const nested = await addComment({ buildId: publicBuild, body: 'ซ้อน', parentId: reply.id! });
    expect(nested).toMatchObject({ ok: false, error: 'ตอบกลับได้เพียง 1 ชั้น' });

    // เจ้าของได้แจ้งเตือนคอมเมนต์ 1 ครั้ง (การตอบของตัวเองไม่แจ้ง) · คนคอมเมนต์ได้แจ้งเตือนว่ามีคนตอบกลับ
    expect(await notificationsOf(owner.id, 'comment')).toHaveLength(1);
    expect(await notificationsOf(voter.id, 'reply')).toHaveLength(1);
  });

  it('ลบคอมเมนต์ของคนอื่นไม่ได้ ลบของตัวเองได้', async () => {
    actAs(voter);
    const created = await addComment({ buildId: publicBuild, body: 'จะลบ' });
    actAs(owner);
    expect((await deleteComment(created.id)).ok).toBe(false);
    actAs(voter);
    expect((await deleteComment(created.id)).ok).toBe(true);
  });
});

describe('toggleFavorite / forkBuild / reportContent', () => {
  it('รายการโปรด: ผู้เยี่ยมชมไม่ได้ สเปกส่วนตัวของคนอื่นไม่ได้ กดซ้ำเป็นการเอาออก', async () => {
    actAs(null);
    expect((await toggleFavorite(publicBuild)).ok).toBe(false);
    actAs(voter);
    expect((await toggleFavorite(privateBuild)).ok).toBe(false);
    expect(await toggleFavorite(publicBuild)).toMatchObject({ ok: true, favorited: true });
    expect(await toggleFavorite(publicBuild)).toMatchObject({ ok: true, favorited: false });
  });

  it('Fork: ได้สเปกส่วนตัวของผู้ Fork พร้อมรหัสต้นฉบับ อะไหล่ครบ และแจ้งเจ้าของ', async () => {
    actAs(voter);
    expect((await forkBuild(privateBuild)).ok).toBe(false);
    const forked = await forkBuild(publicBuild);
    expect(forked.ok).toBe(true);
    if (!forked.ok) return;
    const row = await buildRow(forked.id);
    expect(row).toMatchObject({
      userId: voter.id,
      forkedFromId: publicBuild,
      visibility: 'private',
    });
    expect(await itemsOf(forked.id)).toHaveLength((await itemsOf(publicBuild)).length);
    expect(await notificationsOf(owner.id, 'fork')).toHaveLength(1);
  });

  it('รายงาน: ต้องยืนยันอีเมล และรายงานเรื่องเดิมซ้ำไม่ได้', async () => {
    actAs(unverified);
    expect(
      (await reportContent({ targetType: 'build', targetId: publicBuild, reason: 'spam' })).ok,
    ).toBe(false);
    actAs(voter);
    expect(
      (await reportContent({ targetType: 'build', targetId: publicBuild, reason: 'spam' })).ok,
    ).toBe(true);
    expect(
      (await reportContent({ targetType: 'build', targetId: publicBuild, reason: 'spam' })).ok,
    ).toBe(false);
    expect(
      (await reportContent({ targetType: 'build', targetId: privateBuild, reason: 'spam' })).ok,
    ).toBe(false);
  });
});

describe('ป้ายติ๊กถูกของแอดมิน (ownerRole / authorRole)', () => {
  it('ข้อมูลที่หน้าเว็บใช้แสดงป้าย มาจาก role ในฐานข้อมูล', async () => {
    const adminUser = await createAccount({ role: 'admin' });
    const memberUser = await createAccount();
    const { pick } = await partsByCategory();
    const cpuPart = pick('cpu')[0]!;
    const ids: string[] = [];
    for (const account of [adminUser, memberUser]) {
      actAs(account);
      const saved = await saveBuild({
        title: 'ทดสอบป้ายแอดมิน',
        description: '',
        usageType: 'gaming',
        budget: null,
        items: [{ partId: cpuPart.id, quantity: 1 }],
      });
      if (!saved.ok) throw new Error('บันทึกไม่สำเร็จ');
      ids.push(saved.id);
    }
    const [adminBuild, memberBuild] = await Promise.all(ids.map((id) => getBuildWithItems(id)));
    expect(adminBuild?.build.ownerRole).toBe('admin');
    expect(memberBuild?.build.ownerRole).toBe('member');
  });
});
