import { eq, ilike, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminLogs, partPriceHistory, partUsedPrices, partUsedStats, parts } from '@/db/schema';
import { db } from '@/lib/db';
import { csvHeaderFor } from '@/lib/parts/csv';
import { importPartsCsv } from '@/server/actions/admin-parts';
import { importUsedSurveys } from '@/server/actions/used';
import { todayInThailand } from '@/server/used/stats';

import { actAs, cleanupAccounts, createAccount, type TestAccount } from './helpers';

// นำเข้าราคาสำรวจมือสองจาก CSV: บันทึกทุกแถวหรือไม่บันทึกเลย และราคากลางเปลี่ยนไปใช้ราคาสำรวจ
// ใช้การ์ดจอชื่อรุ่นขึ้นต้นด้วย MODEL_PREFIX (ไม่ใช่รุ่นจริง) แล้วลบทิ้งใน afterAll

const MODEL_PREFIX = 'ITEST Survey GPU';
const BRAND = 'MSI'; // ยี่ห้อจาก db:seed
const HEAD = 'brand,model,grade,min_price,max_price,surveyed_at,source_note';

let admin: TestAccount;
let member: TestAccount;
const today = todayInThailand();

// รุ่นเก่า (ปี 2016) ที่มีแต่มือสอง: สูตรค่าเสื่อมให้ราคาต่ำมาก ราคาสำรวจต้องมาแทน
const partRow = (model: string) =>
  [
    BRAND,
    model,
    '5000',
    '2016',
    '',
    '',
    'https://example.test/spec',
    'รอตรวจสอบ',
    'มีแต่มือสอง',
    'ITEST Chip',
    '4',
    '200',
    '',
    '75',
    'none:0',
    '10',
  ].join(',');

const testParts = () =>
  db
    .select({ id: parts.id, model: parts.model })
    .from(parts)
    .where(ilike(parts.model, `${MODEL_PREFIX}%`));

const statsOf = async (partId: number) => {
  const rows = await db.select().from(partUsedStats).where(eq(partUsedStats.partId, partId));
  return Object.fromEntries(
    rows.map((row) => [row.grade, { median: Number(row.medianPrice), source: row.source }]),
  );
};

beforeAll(async () => {
  admin = await createAccount({ role: 'admin' });
  member = await createAccount({ verified: true });
  actAs(admin);
  const data = new FormData();
  data.set('category', 'gpu');
  data.set(
    'file',
    new File(
      [
        [
          csvHeaderFor('gpu').join(','),
          partRow(`${MODEL_PREFIX} A`),
          partRow(`${MODEL_PREFIX} B`),
        ].join('\n'),
      ],
      'gpu.csv',
      { type: 'text/csv' },
    ),
  );
  expect(await importPartsCsv(data)).toMatchObject({ ok: true, created: 2 });
});

afterAll(async () => {
  const ids = (await testParts()).map((part) => part.id);
  if (ids.length) {
    await db.delete(partUsedPrices).where(inArray(partUsedPrices.partId, ids));
    await db.delete(partUsedStats).where(inArray(partUsedStats.partId, ids));
    await db.delete(partPriceHistory).where(inArray(partPriceHistory.partId, ids));
    await db.delete(parts).where(inArray(parts.id, ids));
  }
  await db.delete(adminLogs).where(eq(adminLogs.adminId, admin.id));
  await cleanupAccounts();
});

describe('นำเข้าราคาสำรวจจาก CSV', () => {
  it('สมาชิกทั่วไปนำเข้าไม่ได้', async () => {
    actAs(member);
    const result = await importUsedSurveys({
      csv: `${HEAD}\n${BRAND},${MODEL_PREFIX} A,B,1400,1600,${today},`,
    });
    expect(result.ok).toBe(false);
  });

  it('มีรุ่นที่ไม่พบในระบบ: ไม่บันทึกแถวไหนเลย', async () => {
    actAs(admin);
    const result = await importUsedSurveys({
      csv: [
        HEAD,
        `${BRAND},${MODEL_PREFIX} A,B,1400,1600,${today},`,
        `${BRAND},${MODEL_PREFIX} ไม่มีจริง,B,1400,1600,${today},`,
      ].join('\n'),
    });
    expect(result).toEqual({
      ok: false,
      error: `แถว 3: ไม่พบ ${BRAND} ${MODEL_PREFIX} ไม่มีจริง ในระบบ`,
    });
    const ids = (await testParts()).map((part) => part.id);
    expect(
      await db.select().from(partUsedPrices).where(inArray(partUsedPrices.partId, ids)),
    ).toEqual([]);
  });

  it('นำเข้าสำเร็จ: เกรดที่สำรวจใช้ราคาสำรวจ เกรดอื่นเทียบด้วยตัวคูณเกรด', async () => {
    actAs(admin);
    const result = await importUsedSurveys({
      csv: [
        HEAD,
        // ชื่อรุ่นต่างตัวพิมพ์ ยังจับคู่ได้
        `msi,${MODEL_PREFIX.toLowerCase()} a,b,1400,1600,${today},ไฟล์ทดสอบ`,
        `${BRAND},${MODEL_PREFIX} B,A,2000,2200,${today},`,
      ].join('\n'),
    });
    expect(result).toEqual({ ok: true, imported: 2 });

    const rows = await testParts();
    const a = rows.find((part) => part.model === `${MODEL_PREFIX} A`);
    const b = rows.find((part) => part.model === `${MODEL_PREFIX} B`);

    // รุ่น A สำรวจเกรด B = (1,400 + 1,600) ÷ 2 = 1,500
    // เกรด A: ช่วง 1,550–1,800 (× 1.00 ÷ 0.90 ปัดหลัก 50) → กลาง 1,675 → 1,700
    // เกรด C: ช่วง 1,150–1,350 (× 0.75 ÷ 0.90 ปัดหลัก 50) → กลาง 1,250
    expect(await statsOf(a!.id)).toEqual({
      A: { median: 1700, source: 'survey' },
      B: { median: 1500, source: 'survey' },
      C: { median: 1250, source: 'survey' },
    });
    // รุ่น B สำรวจเกรด A = 2,100 ตรงตัว
    expect((await statsOf(b!.id)).A).toEqual({ median: 2100, source: 'survey' });
  });
});
