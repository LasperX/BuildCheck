import { eq, ilike, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GET as exportParts } from '@/app/admin/parts/export/[category]/route';
import { GET as exportSurveys } from '@/app/admin/used-prices/export/route';
import { adminLogs, partPriceHistory, partUsedPrices, partUsedStats, parts } from '@/db/schema';
import { db } from '@/lib/db';
import { BOM, csvHeaderFor } from '@/lib/parts/csv';
import { SURVEY_CSV_COLUMNS } from '@/lib/used/survey-csv';
import { importPartsCsv } from '@/server/actions/admin-parts';
import { todayInThailand } from '@/server/used/stats';

import { actAs, cleanupAccounts, createAccount, type TestAccount } from './helpers';

// ส่งออก CSV จากหลังบ้าน (ไฟล์สำรอง และแก้ราคาหลายรุ่นใน Excel แล้วนำเข้ากลับ)
//   - เฉพาะแอดมิน
//   - ไฟล์อะไหล่: ครบทุกชิ้นของหมวด รวมชิ้นที่ซ่อน นำเข้ากลับแล้วอัปเดตชิ้นเดิม ไม่สร้างซ้ำ และคงสถานะซ่อนไว้
//   - ไฟล์ราคาสำรวจ: เฉพาะราคาล่าสุดของแต่ละรุ่นและเกรด ไม่รวมราคาที่ลงวันที่ในอนาคต
// ชิ้นทดสอบเป็นการ์ดจอชื่อรุ่นขึ้นต้นด้วย MODEL_PREFIX ลบทิ้งใน afterAll

const MODEL_PREFIX = 'ITEST Export GPU';

let admin: TestAccount;
let member: TestAccount;
const ids = { SHOWN: 0, HIDDEN: 0 };

const row = (name: string, price: number) =>
  [
    'MSI',
    `${MODEL_PREFIX} ${name}`,
    String(price),
    '2024',
    '',
    '',
    'https://example.test/spec',
    'ตรวจแล้ว',
    'มีขายมือหนึ่ง',
    'ITEST Chip',
    '8',
    '250',
    '2.5',
    '150',
    '6pin:1|8pin:1',
    '40',
  ].join(',');

const csvFile = (text: string) => {
  const data = new FormData();
  data.set('category', 'gpu');
  data.set('file', new File([text], 'gpu.csv', { type: 'text/csv' }));
  return data;
};

const shiftDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const gpuExport = () =>
  exportParts(new Request('http://localhost/admin/parts/export/gpu'), {
    params: Promise.resolve({ category: 'gpu' }),
  });

/** อ่านไฟล์เป็นไบต์ เพราะ response.text() ตัด BOM หน้าไฟล์ทิ้งให้เอง จึงเช็ก BOM จาก text() ไม่ได้ */
const readCsv = async (response: Response) => {
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    hasBom: bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
    lines: new TextDecoder().decode(bytes).split('\r\n'),
  };
};

beforeAll(async () => {
  admin = await createAccount({ role: 'admin' });
  member = await createAccount();
  actAs(admin);
  const header = csvHeaderFor('gpu').join(',');
  expect(
    await importPartsCsv(csvFile([header, row('SHOWN', 20000), row('HIDDEN', 30000)].join('\n'))),
  ).toMatchObject({ ok: true, created: 2 });
  for (const name of ['SHOWN', 'HIDDEN'] as const) {
    const [part] = await db
      .select({ id: parts.id })
      .from(parts)
      .where(eq(parts.model, `${MODEL_PREFIX} ${name}`));
    ids[name] = part!.id;
  }
  await db.update(parts).set({ isActive: false }).where(eq(parts.id, ids.HIDDEN));
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

describe('ส่งออกอะไหล่เป็น CSV', () => {
  it('สมาชิกทั่วไปและผู้เยี่ยมชมส่งออกไม่ได้', async () => {
    actAs(member);
    expect((await gpuExport()).status).toBe(403);
    actAs(null);
    expect((await gpuExport()).status).toBe(403);
  });

  it('หมวดที่ไม่มีจริง ตอบ 404', async () => {
    actAs(admin);
    const response = await exportParts(new Request('http://localhost/admin/parts/export/x'), {
      params: Promise.resolve({ category: 'x' }),
    });
    expect(response.status).toBe(404);
  });

  it('แอดมินได้ไฟล์ CSV รูปแบบเดียวกับไฟล์นำเข้า ครบทุกชิ้นรวมชิ้นที่ซ่อนอยู่', async () => {
    actAs(admin);
    const response = await gpuExport();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('content-disposition')).toMatch(
      /attachment; filename="buildcheck-gpu-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    const { hasBom, lines } = await readCsv(response);
    expect(hasBom).toBe(true);
    expect(lines[0]).toBe(csvHeaderFor('gpu').join(','));
    expect(lines).toContain(row('SHOWN', 20000));
    expect(lines).toContain(row('HIDDEN', 30000));
  });

  it('แก้ราคาในไฟล์ที่ส่งออกแล้วนำเข้ากลับ: อัปเดตชิ้นเดิม ไม่สร้างซ้ำ และชิ้นที่ซ่อนยังซ่อนอยู่', async () => {
    actAs(admin);
    const { lines } = await readCsv(await gpuExport());
    const edited = [
      lines[0],
      ...lines
        .filter((line) => line.includes(MODEL_PREFIX))
        .map((line) =>
          line.replace(`${MODEL_PREFIX} SHOWN,20000,`, `${MODEL_PREFIX} SHOWN,21500,`),
        ),
    ].join('\r\n');

    expect(await importPartsCsv(csvFile(`${BOM}${edited}`))).toMatchObject({
      ok: true,
      created: 0,
      updated: 2,
    });
    const rows = await db
      .select({ id: parts.id, price: parts.price, isActive: parts.isActive })
      .from(parts)
      .where(inArray(parts.id, [ids.SHOWN, ids.HIDDEN]));
    expect(rows.find((part) => part.id === ids.SHOWN)).toMatchObject({
      price: 21500,
      isActive: true,
    });
    expect(rows.find((part) => part.id === ids.HIDDEN)).toMatchObject({
      price: 30000,
      isActive: false,
    });
  });
});

describe('ส่งออกราคาสำรวจเป็น CSV', () => {
  it('สมาชิกทั่วไปส่งออกไม่ได้', async () => {
    actAs(member);
    expect((await exportSurveys()).status).toBe(403);
  });

  it('ได้เฉพาะราคาล่าสุดของแต่ละรุ่นและเกรด ไม่รวมราคาที่ลงวันที่ในอนาคต', async () => {
    const today = todayInThailand();
    const survey = (grade: 'A' | 'B', min: number, surveyedAt: string) => ({
      partId: ids.SHOWN,
      grade,
      minPrice: min,
      maxPrice: min + 1000,
      surveyedAt,
      sourceNote: 'ITEST',
      updatedBy: admin.id,
    });
    await db
      .insert(partUsedPrices)
      .values([
        survey('B', 9000, shiftDays(today, -30)),
        survey('B', 9500, shiftDays(today, -3)),
        survey('B', 9900, shiftDays(today, 5)),
        survey('A', 11000, shiftDays(today, -400)),
      ]);

    actAs(admin);
    const response = await exportSurveys();
    expect(response.status).toBe(200);
    const { hasBom, lines } = await readCsv(response);
    expect(hasBom).toBe(true);
    expect(lines[0]).toBe(SURVEY_CSV_COLUMNS.join(','));
    const mine = lines.filter((line) => line.includes(`${MODEL_PREFIX} SHOWN`));
    expect(mine).toEqual([
      `MSI,${MODEL_PREFIX} SHOWN,A,11000,12000,${shiftDays(today, -400)},ITEST`,
      `MSI,${MODEL_PREFIX} SHOWN,B,9500,10500,${shiftDays(today, -3)},ITEST`,
    ]);
  });
});
