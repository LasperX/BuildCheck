import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parts } from '@/db/schema';
import { db } from '@/lib/db';
import { deleteBuild, saveBuild, shareBuild } from '@/server/actions/builds';

import {
  actAs,
  buildRow,
  cleanupAccounts,
  createAccount,
  itemsOf,
  partsByCategory,
  type TestAccount,
} from './helpers';

// saveBuild / deleteBuild / shareBuild (หัวข้อ 8.3, 9.1 "แก้สเปกของคนอื่น")

let owner: TestAccount;
let other: TestAccount;
let cpuId: number;
let cpuPrice: number;
let boardId: number;
let boardPrice: number;
let secondCpuId: number;

const meta = {
  title: 'สเปกทดสอบ integration',
  description: '',
  usageType: 'gaming' as const,
  budget: 30000,
};

beforeAll(async () => {
  [owner, other] = await Promise.all([createAccount(), createAccount()]);
  const { pick } = await partsByCategory();
  const [cpu, cpu2] = pick('cpu');
  const [board] = pick('motherboard');
  if (!cpu || !cpu2 || !board) throw new Error('อะไหล่ตัวอย่างไม่พอ');
  cpuId = cpu.id;
  cpuPrice = cpu.price;
  secondCpuId = cpu2.id;
  boardId = board.id;
  boardPrice = board.price;
});

afterAll(async () => {
  await cleanupAccounts();
});

describe('saveBuild', () => {
  it('ผู้เยี่ยมชมบันทึกไม่ได้', async () => {
    actAs(null);
    const result = await saveBuild({ ...meta, items: [{ partId: cpuId, quantity: 1 }] });
    expect(result.ok).toBe(false);
  });

  it('สมาชิกบันทึกได้ และราคารวมคำนวณจากราคาในฐานข้อมูล ไม่ใช่จากหน้าเว็บ', async () => {
    actAs(owner);
    const result = await saveBuild({
      ...meta,
      items: [
        { partId: cpuId, quantity: 1 },
        { partId: boardId, quantity: 1 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = await buildRow(result.id);
    expect(row?.userId).toBe(owner.id);
    expect(row?.visibility).toBe('private');
    expect(row?.totalPrice).toBe(cpuPrice + boardPrice);
    const items = await itemsOf(result.id);
    expect(items.map((item) => item.priceAtAdd).sort()).toEqual([cpuPrice, boardPrice].sort());
  });

  it('ข้อมูลผิดรูปแบบถูกปฏิเสธด้วย Zod', async () => {
    actAs(owner);
    const empty = await saveBuild({ ...meta, title: '   ', items: [] });
    expect(empty.ok).toBe(false);
    const duplicate = await saveBuild({
      ...meta,
      items: [
        { partId: cpuId, quantity: 1 },
        { partId: cpuId, quantity: 1 },
      ],
    });
    expect(duplicate.ok).toBe(false);
    const zero = await saveBuild({ ...meta, items: [{ partId: cpuId, quantity: 0 }] });
    expect(zero.ok).toBe(false);
  });

  it('หมวดที่ใส่ได้ชิ้นเดียว ใส่ CPU 2 ตัวไม่ได้', async () => {
    actAs(owner);
    const result = await saveBuild({
      ...meta,
      items: [
        { partId: cpuId, quantity: 1 },
        { partId: secondCpuId, quantity: 1 },
      ],
    });
    expect(result).toMatchObject({ ok: false, error: 'หมวดนี้ใส่ได้ชิ้นเดียว' });
  });

  it('เพิ่มอะไหล่ที่เลิกขายแล้วไม่ได้', async () => {
    await db.update(parts).set({ isActive: false }).where(eq(parts.id, boardId));
    try {
      actAs(owner);
      const result = await saveBuild({ ...meta, items: [{ partId: boardId, quantity: 1 }] });
      expect(result.ok).toBe(false);
    } finally {
      await db.update(parts).set({ isActive: true }).where(eq(parts.id, boardId));
    }
  });

  it('ส่งรหัสสเปกของคนอื่นมา ระบบสร้างสเปกใหม่ให้ ไม่แก้ของเจ้าของ', async () => {
    actAs(owner);
    const created = await saveBuild({ ...meta, items: [{ partId: cpuId, quantity: 1 }] });
    if (!created.ok) throw new Error(created.error);

    actAs(other);
    const hijack = await saveBuild({ ...meta, id: created.id, title: 'แก้ของคนอื่น', items: [] });
    expect(hijack.ok).toBe(true);
    if (!hijack.ok) return;
    expect(hijack.id).not.toBe(created.id);
    const original = await buildRow(created.id);
    expect(original?.title).toBe(meta.title);
    expect(original?.userId).toBe(owner.id);
    expect(await itemsOf(created.id)).toHaveLength(1);
  });
});

describe('deleteBuild และ shareBuild', () => {
  it('ลบหรือเปลี่ยนการมองเห็นสเปกของคนอื่นไม่ได้ เจ้าของทำได้', async () => {
    actAs(owner);
    const created = await saveBuild({ ...meta, items: [{ partId: cpuId, quantity: 1 }] });
    if (!created.ok) throw new Error(created.error);

    actAs(other);
    expect((await deleteBuild(created.id)).ok).toBe(false);
    expect((await shareBuild(created.id, 'public')).ok).toBe(false);
    expect((await buildRow(created.id))?.visibility).toBe('private');

    actAs(null);
    expect((await deleteBuild(created.id)).ok).toBe(false);

    actAs(owner);
    const shared = await shareBuild(created.id);
    expect(shared).toMatchObject({ ok: true, visibility: 'unlisted' });
    expect((await deleteBuild(created.id)).ok).toBe(true);
    expect(await buildRow(created.id)).toBeUndefined();
  });

  it('รหัสสเปกผิดรูปแบบถูกปฏิเสธ', async () => {
    actAs(owner);
    expect((await deleteBuild("x' OR 1=1 --")).ok).toBe(false);
  });
});

describe('รุ่นที่มีแต่มือสอง', () => {
  it('ส่งมาเป็นมือหนึ่ง เซิร์ฟเวอร์บันทึกเป็นมือสองเกรด B (ไม่เชื่อค่าจากหน้าเว็บ)', async () => {
    await db.update(parts).set({ availability: 'used_only' }).where(eq(parts.id, cpuId));
    try {
      actAs(owner);
      const result = await saveBuild({
        ...meta,
        items: [
          { partId: cpuId, quantity: 1, condition: 'new' },
          { partId: boardId, quantity: 1, condition: 'new' },
        ],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const items = await itemsOf(result.id);
      expect(items.find((item) => item.partId === cpuId)?.condition).toBe('B');
      // ชิ้นที่ยังขายมือหนึ่ง ไม่ถูกเปลี่ยน
      expect(items.find((item) => item.partId === boardId)?.condition).toBe('new');
      await deleteBuild(result.id);
    } finally {
      await db.update(parts).set({ availability: 'new' }).where(eq(parts.id, cpuId));
    }
  });
});
