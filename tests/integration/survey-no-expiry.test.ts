import { eq, ilike, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminLogs, partPriceHistory, partUsedPrices, partUsedStats, parts } from '@/db/schema';
import { DEFAULT_USED_SETTINGS } from '@/lib/compat/used-price';
import { db } from '@/lib/db';
import { csvHeaderFor } from '@/lib/parts/csv';
import { importPartsCsv } from '@/server/actions/admin-parts';
import { getUsedOnlyMissingSurvey } from '@/server/queries/used';
import { recomputeUsedStats, todayInThailand } from '@/server/used/stats';

import { actAs, cleanupAccounts, createAccount, type TestAccount } from './helpers';

// ราคาสำรวจของแอดมินไม่มีวันหมดอายุ (เดิมใช้ได้ 90 วัน แล้วตกไปใช้สูตรค่าเสื่อม)
//   - ราคาที่สำรวจไว้นานแล้วยังเป็นราคากลางหลังคำนวณใหม่ จนกว่าแอดมินจะบันทึกราคาใหม่
//   - รุ่นที่เคยสำรวจแล้วไม่อยู่ในรายการ "ยังไม่มีราคาสำรวจ" ของหลังบ้าน
//   - ราคาที่ลงวันที่ในอนาคตยังไม่ใช้
// ชิ้นทดสอบเป็นการ์ดจอที่มีแต่มือสอง ชื่อรุ่นขึ้นต้นด้วย MODEL_PREFIX คะแนน 99–100 ไม่ชนกับข้อมูลจริง

const MODEL_PREFIX = 'ITEST Survey Age GPU';

let admin: TestAccount;
let today: string;
const ids = { OLD: 0, FUTURE: 0 };

const shiftDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const row = (name: string, perf: number) =>
  [
    'MSI',
    `${MODEL_PREFIX} ${name}`,
    '20000',
    '2018',
    '',
    '',
    'https://example.test/spec',
    'รอตรวจสอบ',
    'มีแต่มือสอง',
    'ITEST Chip',
    '8',
    '250',
    '',
    '150',
    '8pin:1',
    String(perf),
  ].join(',');

const statB = async (partId: number) => {
  const rows = await db.select().from(partUsedStats).where(eq(partUsedStats.partId, partId));
  const b = rows.find((stat) => stat.grade === 'B');
  return { median: Number(b?.medianPrice), source: b?.source };
};

beforeAll(async () => {
  admin = await createAccount({ role: 'admin' });
  actAs(admin);
  const data = new FormData();
  data.set('category', 'gpu');
  data.set(
    'file',
    new File(
      [[csvHeaderFor('gpu').join(','), row('OLD', 99), row('FUTURE', 100)].join('\n')],
      'gpu.csv',
      { type: 'text/csv' },
    ),
  );
  expect(await importPartsCsv(data)).toMatchObject({ ok: true, created: 2 });

  for (const name of ['OLD', 'FUTURE'] as const) {
    const [part] = await db
      .select({ id: parts.id })
      .from(parts)
      .where(eq(parts.model, `${MODEL_PREFIX} ${name}`));
    ids[name] = part!.id;
  }

  today = todayInThailand();
  await db.insert(partUsedPrices).values([
    // สำรวจไว้ 400 วันก่อน (เกิน 90 วันมานานแล้ว)
    {
      partId: ids.OLD,
      grade: 'B',
      minPrice: 9000,
      maxPrice: 11000,
      surveyedAt: shiftDays(today, -400),
      sourceNote: 'ITEST',
      updatedBy: admin.id,
    },
    // ลงวันที่ล่วงหน้า 5 วัน
    {
      partId: ids.FUTURE,
      grade: 'B',
      minPrice: 9000,
      maxPrice: 11000,
      surveyedAt: shiftDays(today, 5),
      sourceNote: 'ITEST',
      updatedBy: admin.id,
    },
  ]);
  await recomputeUsedStats(DEFAULT_USED_SETTINGS, [ids.OLD, ids.FUTURE]);
});

afterAll(async () => {
  const all = (
    await db
      .select({ id: parts.id })
      .from(parts)
      .where(ilike(parts.model, `${MODEL_PREFIX}%`))
  ).map((part) => part.id);
  if (all.length) {
    await db.delete(partUsedPrices).where(inArray(partUsedPrices.partId, all));
    await db.delete(partUsedStats).where(inArray(partUsedStats.partId, all));
    await db.delete(partPriceHistory).where(inArray(partPriceHistory.partId, all));
    await db.delete(parts).where(inArray(parts.id, all));
  }
  await db.delete(adminLogs).where(eq(adminLogs.adminId, admin.id));
  await cleanupAccounts();
});

describe('ราคาสำรวจของแอดมินไม่มีวันหมดอายุ', () => {
  it('ราคาที่สำรวจไว้ 400 วันก่อน ยังเป็นราคากลาง (กึ่งกลาง 9,000–11,000 = 10,000)', async () => {
    expect(await statB(ids.OLD)).toEqual({ median: 10000, source: 'survey' });
  });

  it('ราคาที่ลงวันที่ในอนาคต ยังไม่ใช้ ระบบใช้สูตรค่าเสื่อมแทน', async () => {
    expect((await statB(ids.FUTURE)).source).toBe('estimate');
  });

  it('หลังบ้าน: รุ่นที่สำรวจไว้นานแล้วไม่ถูกเตือนว่ายังไม่มีราคาสำรวจ ส่วนรุ่นที่มีแต่ราคาลงวันที่ในอนาคตยังถูกเตือน', async () => {
    const missing = new Set((await getUsedOnlyMissingSurvey(today)).map((part) => part.partId));
    expect(missing.has(ids.OLD)).toBe(false);
    expect(missing.has(ids.FUTURE)).toBe(true);
  });
});
