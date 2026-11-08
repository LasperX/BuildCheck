import { and, count, eq, ilike, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminLogs, gpuSpecs, partPriceHistory, parts } from '@/db/schema';
import { db } from '@/lib/db';
import { csvHeaderFor } from '@/lib/parts/csv';
import { importPartsCsv, previewPartsCsv, setPartActive } from '@/server/actions/admin-parts';

import { actAs, cleanupAccounts, createAccount, type TestAccount } from './helpers';

// นำเข้า CSV ซ้ำ: ยี่ห้อ + รุ่นเดียวกันต้องอัปเดตชิ้นเดิม ไม่สร้างซ้ำ
// ใช้การ์ดจอชื่อรุ่นขึ้นต้นด้วย MODEL_PREFIX (ไม่ใช่รุ่นจริง) แล้วลบทิ้งใน afterAll

const MODEL_PREFIX = 'ITEST Import GPU';
const BRAND = 'MSI'; // ยี่ห้อจาก db:seed

let admin: TestAccount;

type RowOptions = { length?: number; verified?: string; availability?: string };

const row = (model: string, price: number, opts: RowOptions = {}) =>
  [
    BRAND,
    model,
    String(price),
    '',
    '',
    '',
    'https://example.test/spec',
    opts.verified ?? 'รอตรวจสอบ',
    opts.availability ?? '',
    'ITEST Chip',
    '8',
    String(opts.length ?? 250),
    '',
    '150',
    '8pin:1',
    '40',
  ].join(',');

const csvText = (header: string[], rows: string[]) => {
  const text = [header.join(','), ...rows].join('\n');
  const data = new FormData();
  data.set('category', 'gpu');
  data.set('file', new File([text], 'gpu.csv', { type: 'text/csv' }));
  return data;
};

const csvFile = (...rows: string[]) => csvText(csvHeaderFor('gpu'), rows);

/** จำลองไฟล์เก่าที่สร้างก่อนมีคอลัมน์ availability */
const oldCsvFile = (...rows: string[]) => {
  const header = csvHeaderFor('gpu');
  const at = header.indexOf('availability');
  const drop = (line: string) =>
    line
      .split(',')
      .filter((_, i) => i !== at)
      .join(',');
  return csvText(
    header.filter((column) => column !== 'availability'),
    rows.map(drop),
  );
};

const testParts = () =>
  db
    .select({
      id: parts.id,
      model: parts.model,
      price: parts.price,
      isActive: parts.isActive,
      specVerified: parts.specVerified,
    })
    .from(parts)
    .where(ilike(parts.model, `${MODEL_PREFIX}%`));

beforeAll(async () => {
  admin = await createAccount({ role: 'admin' });
});

afterAll(async () => {
  const ids = (await testParts()).map((part) => part.id);
  if (ids.length) {
    await db.delete(partPriceHistory).where(inArray(partPriceHistory.partId, ids));
    await db.delete(parts).where(inArray(parts.id, ids));
  }
  await db.delete(adminLogs).where(eq(adminLogs.adminId, admin.id));
  await cleanupAccounts();
});

describe('นำเข้า CSV ซ้ำ', () => {
  it('ครั้งแรกเพิ่มใหม่ทั้งหมด', async () => {
    actAs(admin);
    const preview = await previewPartsCsv(
      csvFile(row(`${MODEL_PREFIX} A`, 10000), row(`${MODEL_PREFIX} B`, 12000)),
    );
    expect(preview).toMatchObject({ ok: true, createCount: 2, updateCount: 0 });

    const done = await importPartsCsv(
      csvFile(row(`${MODEL_PREFIX} A`, 10000), row(`${MODEL_PREFIX} B`, 12000)),
    );
    expect(done).toMatchObject({ ok: true, imported: 2, created: 2, updated: 0 });
    expect(await testParts()).toHaveLength(2);
  });

  it('นำเข้าไฟล์เดิมที่เพิ่มแถวใหม่และแก้ราคา: ชิ้นเดิมอัปเดต ไม่สร้างซ้ำ', async () => {
    actAs(admin);
    const [before] = await testParts().then((rows) =>
      rows.filter((part) => part.model === `${MODEL_PREFIX} A`),
    );
    // ซ่อนชิ้น A ไว้ก่อน การนำเข้าซ้ำต้องไม่ทำให้กลับมาแสดง
    await setPartActive({ id: before!.id, isActive: false });

    // ชื่อรุ่นต่างตัวพิมพ์และช่องว่าง ยังนับเป็นรุ่นเดียวกัน
    const file = () =>
      csvFile(
        row(`${MODEL_PREFIX.toLowerCase()}  a`, 9500, { length: 260, verified: 'ตรวจแล้ว' }),
        row(`${MODEL_PREFIX} B`, 12000),
        row(`${MODEL_PREFIX} C`, 15000),
      );
    expect(await previewPartsCsv(file())).toMatchObject({
      ok: true,
      createCount: 1,
      updateCount: 2,
    });
    expect(await importPartsCsv(file())).toMatchObject({ ok: true, created: 1, updated: 2 });

    const after = await testParts();
    expect(after).toHaveLength(3);
    const a = after.find((part) => part.id === before!.id);
    expect(Number(a?.price)).toBe(9500);
    expect(a?.isActive).toBe(false);
    expect(a?.specVerified).toBe(true);

    const [spec] = await db
      .select({ lengthMm: gpuSpecs.lengthMm })
      .from(gpuSpecs)
      .where(eq(gpuSpecs.partId, before!.id));
    expect(spec?.lengthMm).toBe(260);

    // ประวัติราคา: ตอนสร้าง 1 + ราคาเปลี่ยน 1 · ชิ้น B ราคาเดิม ไม่เพิ่มประวัติ
    const [history] = await db
      .select({ value: count() })
      .from(partPriceHistory)
      .where(eq(partPriceHistory.partId, before!.id));
    expect(history?.value).toBe(2);
    const b = after.find((part) => part.model === `${MODEL_PREFIX} B`);
    const [historyB] = await db
      .select({ value: count() })
      .from(partPriceHistory)
      .where(eq(partPriceHistory.partId, b!.id));
    expect(historyB?.value).toBe(1);
  });

  it('รุ่นเดียวกันซ้ำในไฟล์เดียว ไม่นำเข้าเลย', async () => {
    actAs(admin);
    const file = () => csvFile(row(`${MODEL_PREFIX} D`, 1000), row(`${MODEL_PREFIX} D`, 2000));
    const preview = await previewPartsCsv(file());
    expect(preview.ok && preview.errorCount).toBe(1);
    expect(preview.ok && preview.rows[1]?.ok === false && preview.rows[1].errors[0]).toMatch(/ซ้ำ/);
    expect(await importPartsCsv(file())).toMatchObject({ ok: false });
    expect((await testParts()).filter((part) => part.model.endsWith(' D'))).toHaveLength(0);
  });

  it('บันทึกการทำงานเก็บจำนวนเพิ่มใหม่และอัปเดต', async () => {
    const logs = await db
      .select({ changes: adminLogs.changes })
      .from(adminLogs)
      .where(and(eq(adminLogs.adminId, admin.id), eq(adminLogs.action, 'part.import')));
    expect(logs.map((log) => log.changes)).toContainEqual({
      after: { rows: 3, created: 1, updated: 2 },
    });
  });
});

describe('สถานะการขาย (availability) ใน CSV', () => {
  const availabilityOf = async (model: string) => {
    const [part] = await db
      .select({ availability: parts.availability })
      .from(parts)
      .where(ilike(parts.model, model));
    return part?.availability;
  };

  it('นำเข้ารุ่นที่มีแต่มือสอง ทั้งแบบ used_only และคำไทย', async () => {
    actAs(admin);
    const done = await importPartsCsv(
      csvFile(
        row(`${MODEL_PREFIX} Old1`, 8000, { availability: 'used_only' }),
        row(`${MODEL_PREFIX} Old2`, 7000, { availability: 'มีแต่มือสอง' }),
      ),
    );
    expect(done).toMatchObject({ ok: true, created: 2 });
    expect(await availabilityOf(`${MODEL_PREFIX} Old1`)).toBe('used_only');
    expect(await availabilityOf(`${MODEL_PREFIX} Old2`)).toBe('used_only');
  });

  it('ไฟล์เก่าที่ไม่มีคอลัมน์ availability นำเข้าได้ และไม่เปลี่ยนรุ่นที่มีแต่มือสองกลับเป็นมือหนึ่ง', async () => {
    actAs(admin);
    const done = await importPartsCsv(
      oldCsvFile(row(`${MODEL_PREFIX} Old1`, 7500), row(`${MODEL_PREFIX} New1`, 9000)),
    );
    expect(done).toMatchObject({ ok: true, created: 1, updated: 1 });
    expect(await availabilityOf(`${MODEL_PREFIX} Old1`)).toBe('used_only');
    expect(await availabilityOf(`${MODEL_PREFIX} New1`)).toBe('new');
  });

  it('ไฟล์ที่มีคอลัมน์ availability เปลี่ยนสถานะได้', async () => {
    actAs(admin);
    await importPartsCsv(csvFile(row(`${MODEL_PREFIX} Old2`, 7000, { availability: 'new' })));
    expect(await availabilityOf(`${MODEL_PREFIX} Old2`)).toBe('new');
  });

  it('ค่าที่ไม่รู้จักถูกปฏิเสธ', async () => {
    actAs(admin);
    const preview = await previewPartsCsv(
      csvFile(row(`${MODEL_PREFIX} Bad`, 1000, { availability: 'second-hand' })),
    );
    expect(preview.ok && preview.errorCount).toBe(1);
  });
});
