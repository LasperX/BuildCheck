import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminLogs, parts } from '@/db/schema';
import { db } from '@/lib/db';
import { setPartVerified } from '@/server/actions/admin-parts';
import { listReviewParts } from '@/server/queries/admin-parts';

import {
  actAs,
  cleanupAccounts,
  createAccount,
  partsByCategory,
  type TestAccount,
} from './helpers';

// หน้าตรวจสเปก: ปุ่ม "ตรวจแล้ว" เรียก setPartVerified ตรงจากเบราว์เซอร์ จึงต้องตรวจสิทธิ์และค่าที่ส่งมาเอง
// เทสต์เปลี่ยนสถานะของอะไหล่จริง 2 ชิ้น แล้วคืนค่าเดิมใน afterAll

let admin: TestAccount;
let member: TestAccount;
let ids: number[];
let original: { id: number; specVerified: boolean }[];

const verifiedOf = async (target: number[]) =>
  Object.fromEntries(
    (
      await db
        .select({ id: parts.id, v: parts.specVerified })
        .from(parts)
        .where(inArray(parts.id, target))
    ).map((row) => [row.id, row.v]),
  );

beforeAll(async () => {
  [admin, member] = await Promise.all([createAccount({ role: 'admin' }), createAccount()]);
  const { pick } = await partsByCategory();
  ids = pick('gpu')
    .slice(0, 2)
    .map((row) => row.id);
  original = await db
    .select({ id: parts.id, specVerified: parts.specVerified })
    .from(parts)
    .where(inArray(parts.id, ids));
});

afterAll(async () => {
  for (const row of original) {
    await db.update(parts).set({ specVerified: row.specVerified }).where(eq(parts.id, row.id));
  }
  await db.delete(adminLogs).where(eq(adminLogs.adminId, admin.id));
  await cleanupAccounts();
});

describe('setPartVerified สิทธิ์', () => {
  it('ผู้เยี่ยมชมและสมาชิกกดไม่ได้ และสถานะไม่เปลี่ยน', async () => {
    const before = await verifiedOf(ids);
    actAs(null);
    expect((await setPartVerified({ ids, verified: !before[ids[0]!] })).ok).toBe(false);
    actAs(member);
    expect(await setPartVerified({ ids, verified: !before[ids[0]!] })).toMatchObject({
      ok: false,
      error: 'ไม่มีสิทธิ์ทำรายการนี้',
    });
    expect(await verifiedOf(ids)).toEqual(before);
  });
});

describe('setPartVerified ค่าที่ส่งมา', () => {
  const bad: [string, unknown][] = [
    ['รายการว่าง', { ids: [], verified: true }],
    ['id ไม่ใช่ตัวเลข', { ids: ['1; DROP TABLE parts'], verified: true }],
    ['id ติดลบ', { ids: [-1], verified: true }],
    ['verified ไม่ใช่ boolean', { ids: [1], verified: 'true' }],
    ['มากกว่า 100 ชิ้น', { ids: Array.from({ length: 101 }, (_, i) => i + 1), verified: true }],
    ['ไม่ส่งอะไรมา', null],
  ];
  for (const [name, input] of bad) {
    it(name, async () => {
      actAs(admin);
      expect(await setPartVerified(input as Parameters<typeof setPartVerified>[0])).toMatchObject({
        ok: false,
        error: 'ข้อมูลไม่ถูกต้อง',
      });
    });
  }

  it('id ที่ไม่มีอยู่ บอกว่าไม่พบ', async () => {
    actAs(admin);
    expect(await setPartVerified({ ids: [2_000_000_000], verified: true })).toMatchObject({
      ok: false,
      error: 'ไม่พบอะไหล่ที่เลือก',
    });
  });
});

describe('ตรวจแล้ว / ยกเลิก', () => {
  it('แอดมินยกเลิกแล้วชิ้นนั้นขึ้นในคิวรอตรวจ กดตรวจแล้วหายจากคิว และมีบันทึกการทำงาน', async () => {
    actAs(admin);
    expect(await setPartVerified({ ids, verified: false })).toEqual({ ok: true });
    expect(await verifiedOf(ids)).toEqual({ [ids[0]!]: false, [ids[1]!]: false });

    const pending = await listReviewParts({ category: 'gpu', verified: false, page: 1 });
    const pendingIds = pending.items.map((item) => item.id);
    for (const id of ids) expect(pendingIds).toContain(id);
    // การ์ดแสดงสเปกของหมวดตัวเอง (ตาราง gpu_specs) ไม่ว่าง
    const card = pending.items.find((item) => item.id === ids[0]);
    expect(card?.categorySlug).toBe('gpu');
    expect(card?.spec).toHaveProperty('lengthMm');

    expect(await setPartVerified({ ids: [ids[0]!], verified: true })).toEqual({ ok: true });
    const after = await listReviewParts({ category: 'gpu', verified: false, page: 1 });
    expect(after.items.map((item) => item.id)).not.toContain(ids[0]);
    expect(after.total).toBe(pending.total - 1);

    const logs = await db
      .select({ action: adminLogs.action, targetId: adminLogs.targetId })
      .from(adminLogs)
      .where(and(eq(adminLogs.adminId, admin.id), eq(adminLogs.targetType, 'part')));
    expect(logs).toContainEqual({ action: 'part.verify', targetId: String(ids[0]) });
    expect(logs.filter((log) => log.action === 'part.unverify')).toHaveLength(2);
  });

  it('ตัวเลขบนแท็บหมวดของคิวรอตรวจตรงกับจำนวนรายการ', async () => {
    const all = await listReviewParts({ verified: false, page: 1 });
    const sum = Object.values(all.categoryCounts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(all.total);
    const gpu = await listReviewParts({ category: 'gpu', verified: false, page: 1 });
    expect(gpu.total).toBe(all.categoryCounts.gpu ?? 0);
    expect(gpu.items.every((item) => item.categorySlug === 'gpu')).toBe(true);
  });
});
