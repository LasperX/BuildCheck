import { eq, ilike, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminLogs, partPriceHistory, partUsedStats, parts } from '@/db/schema';
import { db } from '@/lib/db';
import { csvHeaderFor } from '@/lib/parts/csv';
import { importPartsCsv } from '@/server/actions/admin-parts';

import { actAs, cleanupAccounts, createAccount, type TestAccount } from './helpers';

// กรอบราคามือสองของ CPU ที่มีแต่มือสอง เทียบเฉพาะ CPU ใน Socket เดียวกัน
// ใช้ Socket สมมติ ITEST-A / ITEST-B และคะแนน 99–100 สูงกว่า CPU จริงทุกตัว จึงไม่ขึ้นกับข้อมูลที่มีอยู่

const MODEL_PREFIX = 'ITEST Socket CPU';

let admin: TestAccount;

const row = (name: string, socket: string, year: string, availability: string, perf: number) =>
  [
    'AMD',
    `${MODEL_PREFIX} ${name}`,
    '100000',
    year,
    '',
    '',
    'https://example.test/spec',
    'รอตรวจสอบ',
    availability,
    socket,
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

const medianB = async (name: string) => {
  const [part] = await db
    .select({ id: parts.id })
    .from(parts)
    .where(eq(parts.model, `${MODEL_PREFIX} ${name}`));
  const rows = await db.select().from(partUsedStats).where(eq(partUsedStats.partId, part!.id));
  return Number(rows.find((stat) => stat.grade === 'B')?.medianPrice);
};

beforeAll(async () => {
  admin = await createAccount({ role: 'admin' });
  actAs(admin);
  expect(csvHeaderFor('cpu').join(',')).toContain('socket,generation');
  const data = new FormData();
  data.set('category', 'cpu');
  data.set(
    'file',
    new File(
      [
        [
          csvHeaderFor('cpu').join(','),
          // ยังขายมือหนึ่ง Socket A คะแนน 99
          row('NEW A', 'ITEST-A', '2025', 'มีขายมือหนึ่ง', 99),
          // มีแต่มือสอง คะแนน 100 วางขายปี 2016 ทั้งสอง Socket
          row('OLD A', 'ITEST-A', '2016', 'มีแต่มือสอง', 100),
          row('OLD B', 'ITEST-B', '2016', 'มีแต่มือสอง', 100),
        ].join('\n'),
      ],
      'cpu.csv',
      { type: 'text/csv' },
    ),
  );
  expect(await importPartsCsv(data)).toMatchObject({ ok: true, created: 3 });
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

describe('กรอบราคามือสองของ CPU เทียบใน Socket เดียวกัน', () => {
  it('รุ่นที่ยังขายมือหนึ่ง: 100,000 × 0.80 × 0.90 = 72,000', async () => {
    expect(await medianB('NEW A')).toBe(72000);
  });

  it('Socket เดียวกันและแรงกว่า: ไม่ถูกกว่ารุ่นที่ยังขายอยู่', async () => {
    expect(await medianB('OLD A')).toBe(72000);
  });

  it('ต่าง Socket: ไม่ถูกยกตามรุ่นของ Socket อื่น ใช้สูตรค่าเสื่อมตามเดิม', async () => {
    // 100,000 × 0.80^10 × 0.90 = 9,663.7 → ปัดหลัก 50 = 9,650
    expect(await medianB('OLD B')).toBe(9650);
  });
});
