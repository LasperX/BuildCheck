import { and, desc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminLogs,
  notifications,
  partPriceHistory,
  parts,
  sessions,
  settings,
  users,
} from '@/db/schema';
import { db } from '@/lib/db';
import {
  banUser,
  resolveReport,
  setUserRole,
  unbanUser,
  updateSetting,
} from '@/server/actions/admin';
import { setPartActive, updatePartPrice, upsertPart } from '@/server/actions/admin-parts';
import { saveBuild } from '@/server/actions/builds';
import { reviewUsedReport, saveUsedSettings } from '@/server/actions/used';

import {
  actAs,
  cleanupAccounts,
  createAccount,
  partsByCategory,
  type TestAccount,
} from './helpers';

// Server Actions ฝั่งแอดมิน (หัวข้อ 9.1 "ตรวจ role ในทุก Server Action ฝั่งแอดมิน ไม่เชื่อค่าจากหน้าเว็บ")

let admin: TestAccount;
let member: TestAccount;
let partId: number;
let originalPrice: number;

beforeAll(async () => {
  [admin, member] = await Promise.all([createAccount({ role: 'admin' }), createAccount()]);
  const { pick } = await partsByCategory();
  const part = pick('cpu')[0]!;
  partId = part.id;
  originalPrice = part.price;
});

afterAll(async () => {
  // คืนราคาเดิมและลบประวัติราคาที่เทสต์สร้าง
  await db.update(parts).set({ price: originalPrice, isActive: true }).where(eq(parts.id, partId));
  await db
    .delete(partPriceHistory)
    .where(and(eq(partPriceHistory.partId, partId), eq(partPriceHistory.changedBy, admin.id)));
  await db.delete(adminLogs).where(eq(adminLogs.adminId, admin.id));
  await db.delete(settings).where(eq(settings.updatedBy, admin.id));
  await cleanupAccounts();
});

describe('สิทธิ์แอดมิน: ผู้เยี่ยมชมและสมาชิกเรียกไม่ได้ทุกตัว', () => {
  const calls = {
    upsertPart: () => upsertPart({}),
    updatePartPrice: () => updatePartPrice({ id: partId, price: 1 }),
    setPartActive: () => setPartActive({ id: partId, isActive: false }),
    updateSetting: () => updateSetting('psu_headroom', 0.5),
    banUser: () => banUser(admin.id, 'ทดสอบ'),
    setUserRole: () => setUserRole(member.id, 'admin'),
    resolveReport: () => resolveReport(1, 'dismiss'),
    reviewUsedReport: () => reviewUsedReport({ id: 1, decision: 'approved' }),
    saveUsedSettings: () => saveUsedSettings({}),
  };

  for (const [name, call] of Object.entries(calls)) {
    it(name, async () => {
      actAs(null);
      expect((await call()).ok).toBe(false);
      actAs(member);
      expect(await call()).toMatchObject({ ok: false, error: 'ไม่มีสิทธิ์ทำรายการนี้' });
    });
  }

  it('สมาชิกเรียกแล้วข้อมูลไม่เปลี่ยน (ราคาและสิทธิ์)', async () => {
    const [part] = await db
      .select({ price: parts.price, active: parts.isActive })
      .from(parts)
      .where(eq(parts.id, partId));
    expect(part).toEqual({ price: originalPrice, active: true });
    const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, member.id));
    expect(row?.role).toBe('member');
  });
});

describe('updatePartPrice / upsertPart', () => {
  it('แอดมินปรับราคา: บันทึกประวัติราคา บันทึกการทำงาน และแจ้งเจ้าของสเปกที่มีชิ้นนี้', async () => {
    actAs(member);
    const build = await saveBuild({
      title: 'สเปกเตือนราคา',
      description: '',
      usageType: 'gaming',
      budget: null,
      items: [{ partId, quantity: 1 }],
    });
    expect(build.ok).toBe(true);

    actAs(admin);
    const newPrice = originalPrice + 123;
    expect((await updatePartPrice({ id: partId, price: newPrice })).ok).toBe(true);

    const [part] = await db.select({ price: parts.price }).from(parts).where(eq(parts.id, partId));
    expect(part?.price).toBe(newPrice);
    const [history] = await db
      .select()
      .from(partPriceHistory)
      .where(eq(partPriceHistory.partId, partId))
      .orderBy(desc(partPriceHistory.id))
      .limit(1);
    expect(history).toMatchObject({ price: newPrice, changedBy: admin.id });
    const [log] = await db
      .select()
      .from(adminLogs)
      .where(eq(adminLogs.adminId, admin.id))
      .orderBy(desc(adminLogs.id))
      .limit(1);
    expect(log).toMatchObject({ action: 'part.price', targetId: String(partId) });
    const alerts = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, member.id), eq(notifications.type, 'price_change')));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.message).toContain('เพิ่มขึ้น');
  });

  it('ราคาติดลบหรืออะไหล่ที่ไม่มีอยู่ถูกปฏิเสธ', async () => {
    actAs(admin);
    expect((await updatePartPrice({ id: partId, price: -5 })).ok).toBe(false);
    expect((await updatePartPrice({ id: 999_999_999, price: 100 })).ok).toBe(false);
  });

  it('ฟอร์มอะไหล่ที่ข้อมูลไม่ครบถูกปฏิเสธด้วย Zod', async () => {
    actAs(admin);
    expect((await upsertPart({ categorySlug: 'cpu', model: '' })).ok).toBe(false);
    expect((await upsertPart({ categorySlug: 'ไม่มีหมวดนี้' })).ok).toBe(false);
  });
});

describe('updateSetting', () => {
  it('ค่าผิดรูปแบบหรือคีย์ที่ไม่รู้จักบันทึกไม่ได้ ค่าที่ถูกบันทึกได้', async () => {
    actAs(admin);
    expect((await updateSetting('psu_headroom', 5)).ok).toBe(false);
    expect((await updateSetting('ไม่มีคีย์นี้', 1)).ok).toBe(false);
    expect((await updateSetting('budget_ratio_gaming', { cpu: 0.9, gpu: 0.9 })).ok).toBe(false);
    expect((await updateSetting('psu_headroom', 0.3)).ok).toBe(true);
    const [row] = await db.select().from(settings).where(eq(settings.key, 'psu_headroom'));
    expect(row?.value).toBe(0.3);
  });
});

describe('banUser / setUserRole', () => {
  it('แอดมินระงับหรือเปลี่ยนสิทธิ์ตัวเองไม่ได้', async () => {
    actAs(admin);
    expect((await banUser(admin.id, 'ทดสอบ')).ok).toBe(false);
    expect((await setUserRole(admin.id, 'member')).ok).toBe(false);
  });

  it('เหตุผลว่างถูกปฏิเสธ', async () => {
    actAs(admin);
    expect((await banUser(member.id, '   ')).ok).toBe(false);
  });

  it('ระงับแล้ว Session ถูกลบ ผู้ใช้ทำรายการต่อไม่ได้ ปลดระงับแล้วสถานะกลับ', async () => {
    actAs(admin);
    expect((await banUser(member.id, 'ทดสอบระบบระงับ')).ok).toBe(true);
    expect(await db.select().from(sessions).where(eq(sessions.userId, member.id))).toHaveLength(0);

    actAs(member);
    const after = await saveBuild({
      title: 'หลังถูกระงับ',
      description: '',
      usageType: 'gaming',
      budget: null,
      items: [],
    });
    expect(after.ok).toBe(false);

    actAs(admin);
    expect((await unbanUser(member.id)).ok).toBe(true);
    const [row] = await db
      .select({ banned: users.banned })
      .from(users)
      .where(eq(users.id, member.id));
    expect(row?.banned).toBe(false);
  });
});
