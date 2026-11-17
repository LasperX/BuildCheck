import { eq, ilike, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminLogs, partPriceHistory, partUsedStats, parts } from '@/db/schema';
import { db } from '@/lib/db';
import { csvHeaderFor } from '@/lib/parts/csv';
import { importPartsCsv } from '@/server/actions/admin-parts';

import { actAs, cleanupAccounts, createAccount, type TestAccount } from './helpers';

// กรอบราคามือสองของรุ่นที่มีแต่มือสอง เมื่อราคารุ่นที่ยังขายไม่เรียงตามคะแนน
// - ขั้นต่ำมาจากรุ่นที่ช้ากว่าซึ่งคะแนนใกล้ที่สุด ไม่ใช่รุ่นที่ช้ากว่าแต่แพงที่สุด
// - ไม่เกินราคาเปิดตัว × ตัวคูณเกรด
// ใช้ Socket สมมติ ITEST-C และคะแนน 98–100 สูงกว่า CPU จริงทุกตัว จึงไม่ขึ้นกับข้อมูลที่มีอยู่
// ราคาเป็นตัวเลขสมมติ ไม่ใช่ราคาตลาดจริง

const MODEL_PREFIX = 'ITEST Ceiling CPU';
const SOCKET = 'ITEST-C';

let admin: TestAccount;

const row = (name: string, price: number, year: string, availability: string, perf: number) =>
  [
    'AMD',
    `${MODEL_PREFIX} ${name}`,
    String(price),
    year,
    '',
    '',
    'https://example.test/spec',
    'รอตรวจสอบ',
    availability,
    SOCKET,
    'ITEST Gen',
    '8',
    '16',
    '3.5',
    '5.0',
    '65',
    'false',
    'true',
    'DDR5',
    String(perf),
  ].join(',');

const median = async (name: string, grade: 'A' | 'B' | 'C') => {
  const [part] = await db
    .select({ id: parts.id })
    .from(parts)
    .where(eq(parts.model, `${MODEL_PREFIX} ${name}`));
  const rows = await db.select().from(partUsedStats).where(eq(partUsedStats.partId, part!.id));
  return Number(rows.find((stat) => stat.grade === grade)?.medianPrice);
};

beforeAll(async () => {
  admin = await createAccount({ role: 'admin' });
  actAs(admin);
  const data = new FormData();
  data.set('category', 'cpu');
  data.set(
    'file',
    new File(
      [
        [
          csvHeaderFor('cpu').join(','),
          // ยังขายมือหนึ่ง: คะแนน 98 ราคาสูงผิดลำดับ · คะแนน 99 ราคาปกติ
          row('NEW 98', 400000, '2025', 'มีขายมือหนึ่ง', 98),
          row('NEW 99', 200000, '2025', 'มีขายมือหนึ่ง', 99),
          // มีแต่มือสอง คะแนน 100 วางขายปี 2016 (สูตรค่าเสื่อมได้ราคาต่ำมาก จึงถูกยกตามขั้นต่ำ)
          row('OLD HIGH', 300000, '2016', 'มีแต่มือสอง', 100),
          row('OLD LOW', 100000, '2016', 'มีแต่มือสอง', 100),
        ].join('\n'),
      ],
      'cpu.csv',
      { type: 'text/csv' },
    ),
  );
  expect(await importPartsCsv(data)).toMatchObject({ ok: true, created: 4 });
});

afterAll(async () => {
  const ids = (
    await db
      .select({ id: parts.id })
      .from(parts)
      .where(ilike(parts.model, `${MODEL_PREFIX}%`))
  ).map((part) => part.id);
  if (ids.length) {
    await db.delete(partUsedStats).where(inArray(partUsedStats.partId, ids));
    await db.delete(partPriceHistory).where(inArray(partPriceHistory.partId, ids));
    await db.delete(parts).where(inArray(parts.id, ids));
  }
  await db.delete(adminLogs).where(eq(adminLogs.adminId, admin.id));
  await cleanupAccounts();
});

describe('กรอบราคามือสองเมื่อราคารุ่นที่ยังขายไม่เรียงตามคะแนน', () => {
  it('รุ่นที่ยังขายมือหนึ่ง: เกรด B = ราคา × 0.80 × 0.90', async () => {
    expect(await median('NEW 98', 'B')).toBe(288000);
    expect(await median('NEW 99', 'B')).toBe(144000);
  });

  it('ขั้นต่ำมาจากรุ่นคะแนน 99 ที่ใกล้ที่สุด ไม่ใช่รุ่นคะแนน 98 ที่แพงกว่า', async () => {
    // ถ้าใช้รุ่นที่แพงที่สุดในบรรดารุ่นที่ช้ากว่าจะได้ 288,000 (หรือ 270,000 เมื่อชนเพดานราคาเปิดตัว)
    expect(await median('OLD HIGH', 'B')).toBe(144000);
  });

  it('ไม่เกินราคาเปิดตัว × ตัวคูณเกรด แม้ขั้นต่ำจากรุ่นที่ยังขายจะสูงกว่า', async () => {
    // ขั้นต่ำ 144,000 แต่ราคาเปิดตัว 100,000: เกรด A ≤ 100,000 · B ≤ 90,000 · C ≤ 75,000
    expect(await median('OLD LOW', 'A')).toBe(100000);
    expect(await median('OLD LOW', 'B')).toBe(90000);
    expect(await median('OLD LOW', 'C')).toBe(75000);
  });
});
