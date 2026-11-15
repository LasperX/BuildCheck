import { eq, ilike, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminLogs, partPriceHistory, partUsedStats, parts } from '@/db/schema';
import { db } from '@/lib/db';
import { csvHeaderFor } from '@/lib/parts/csv';
import { importPartsCsv } from '@/server/actions/admin-parts';

import { actAs, cleanupAccounts, createAccount, type TestAccount } from './helpers';

// ราคามือสองประมาณการหลังนำเข้าอะไหล่ (คำนวณใหม่อัตโนมัติ)
//   - รุ่นที่ยังขายมือหนึ่ง: ไม่หักตามปีวางขายซ้ำ
//   - รุ่นที่มีแต่มือสอง: อยู่ในกรอบของรุ่นที่ยังขายมือหนึ่งที่คะแนนใกล้กัน
// ใช้การ์ดจอชื่อรุ่นขึ้นต้นด้วย MODEL_PREFIX และคะแนน 99–100 ซึ่งสูงกว่าการ์ดจอจริงทุกตัว
// กรอบของชิ้นทดสอบจึงมาจากชิ้นทดสอบด้วยกันเท่านั้น ไม่ขึ้นกับข้อมูลอะไหล่ที่มีอยู่

const MODEL_PREFIX = 'ITEST Estimate GPU';

let admin: TestAccount;

const row = (name: string, price: number, year: string, availability: string, perf: number) =>
  [
    'MSI',
    `${MODEL_PREFIX} ${name}`,
    String(price),
    year,
    '',
    '',
    'https://example.test/spec',
    'รอตรวจสอบ',
    availability,
    'ITEST Chip',
    '8',
    '250',
    '',
    '150',
    '8pin:1',
    String(perf),
  ].join(',');

const statB = async (name: string) => {
  const [part] = await db
    .select({ id: parts.id })
    .from(parts)
    .where(eq(parts.model, `${MODEL_PREFIX} ${name}`));
  const rows = await db.select().from(partUsedStats).where(eq(partUsedStats.partId, part!.id));
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
      [
        [
          csvHeaderFor('gpu').join(','),
          // ยังขายมือหนึ่ง วางขายปี 2019 คะแนน 99
          row('NEW', 100000, '2019', 'มีขายมือหนึ่ง', 99),
          // มีแต่มือสอง แรงกว่า (คะแนน 100) วางขายปี 2016 ราคาเปิดตัวเท่ากัน
          row('OLD FAST', 100000, '2016', 'มีแต่มือสอง', 100),
        ].join('\n'),
      ],
      'gpu.csv',
      { type: 'text/csv' },
    ),
  );
  expect(await importPartsCsv(data)).toMatchObject({ ok: true, created: 2 });
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

describe('ราคามือสองประมาณการ', () => {
  it('รุ่นที่ยังขายมือหนึ่ง ไม่หักตามปีวางขาย: 100,000 × 0.75 × 0.90 = 67,500', async () => {
    expect(await statB('NEW')).toEqual({ median: 67500, source: 'estimate' });
  });

  it('รุ่นที่มีแต่มือสองซึ่งแรงกว่า ไม่ถูกกว่ารุ่นที่ยังขายมือหนึ่ง', async () => {
    // สูตรค่าเสื่อมอย่างเดียวได้ 100,000 × 0.75^10 × 0.90 ≈ 5,050 ต่ำกว่ารุ่นที่ช้ากว่ามาก
    // กรอบขั้นต่ำจึงยกขึ้นเท่ารุ่นคะแนน 99 ที่ยังขายอยู่ = 67,500
    expect(await statB('OLD FAST')).toEqual({ median: 67500, source: 'estimate' });
  });
});
