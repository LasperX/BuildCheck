import { and, count, eq, ilike, inArray, isNull, or } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { adminLogs, brands, categories, partPriceHistory, parts } from '@/db/schema';
import { db } from '@/lib/db';
import { csvHeaderFor } from '@/lib/parts/csv';
import { importPartsCsv, setPartImage } from '@/server/actions/admin-parts';
import { getAdminPartFacets, listAdminParts } from '@/server/queries/admin-parts';

import { actAs, cleanupAccounts, createAccount, type TestAccount } from './helpers';

// ตัวกรอง "ไม่มีรูป" และการตั้งรูปจากตารางในหน้าจัดการอะไหล่
// ไม่อัปโหลดไฟล์จริง: แทนที่เก็บรูปด้วย URL คงที่ ทดสอบเฉพาะการตรวจสิทธิ์และการบันทึกลงฐานข้อมูล

vi.mock('@/lib/storage', () => ({
  uploadImage: vi.fn(async () => ({ ok: true, url: '/uploads/parts/itest.webp' })),
}));

const MODEL_PREFIX = 'ITEST Image GPU';

let admin: TestAccount;
let member: TestAccount;
let partId: number;

const NO_IMAGE = or(isNull(parts.imageUrl), eq(parts.imageUrl, ''));
const imageFile = () => new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' });
const form = (id: string | number) => {
  const data = new FormData();
  data.set('id', String(id));
  data.set('file', imageFile());
  return data;
};

beforeAll(async () => {
  admin = await createAccount({ role: 'admin' });
  member = await createAccount({ verified: true });
  actAs(admin);
  const row = [
    'MSI',
    `${MODEL_PREFIX} A`,
    '9000',
    '',
    '',
    '',
    'https://example.test/spec',
    'รอตรวจสอบ',
    '',
    'ITEST Chip',
    '8',
    '250',
    '',
    '150',
    '8pin:1',
    '40',
  ].join(',');
  const data = new FormData();
  data.set('category', 'gpu');
  data.set(
    'file',
    new File([[csvHeaderFor('gpu').join(','), row].join('\n')], 'gpu.csv', { type: 'text/csv' }),
  );
  expect(await importPartsCsv(data)).toMatchObject({ ok: true, created: 1 });
  const [part] = await db
    .select({ id: parts.id })
    .from(parts)
    .where(ilike(parts.model, `${MODEL_PREFIX}%`));
  partId = part!.id;
});

afterAll(async () => {
  const ids = (
    await db
      .select({ id: parts.id })
      .from(parts)
      .where(ilike(parts.model, `${MODEL_PREFIX}%`))
  ).map((part) => part.id);
  if (ids.length) {
    await db.delete(partPriceHistory).where(inArray(partPriceHistory.partId, ids));
    await db.delete(parts).where(inArray(parts.id, ids));
  }
  await db.delete(adminLogs).where(eq(adminLogs.adminId, admin.id));
  await cleanupAccounts();
});

describe('ตัวกรองไม่มีรูป', () => {
  it('จำนวนบนปุ่มและผลกรองตรงกับจำนวนชิ้นที่ไม่มีรูปในฐานข้อมูล', async () => {
    const [expected] = await db.select({ value: count() }).from(parts).where(NO_IMAGE);
    const { missingImages } = await getAdminPartFacets(undefined);
    const { total, rows } = await listAdminParts({ image: 'missing', page: 1 });
    expect(missingImages).toBe(expected?.value);
    expect(total).toBe(expected?.value);
    expect(rows.every((row) => !row.imageUrl)).toBe(true);
    // ชิ้นทดสอบอาจอยู่หน้าอื่น จึงค้นด้วยชื่อร่วมกับตัวกรอง
    const mine = await listAdminParts({ image: 'missing', q: MODEL_PREFIX, page: 1 });
    expect(mine.rows.map((row) => row.id)).toEqual([partId]);
  });

  it('นับตามหมวดและยี่ห้อที่เลือก', async () => {
    const [msi] = await db.select({ id: brands.id }).from(brands).where(eq(brands.name, 'MSI'));
    const [expected] = await db
      .select({ value: count() })
      .from(parts)
      .innerJoin(categories, eq(parts.categoryId, categories.id))
      .where(and(NO_IMAGE, eq(categories.slug, 'gpu'), eq(parts.brandId, msi!.id)));
    expect((await getAdminPartFacets('gpu', msi!.id)).missingImages).toBe(expected?.value);
  });
});

describe('ตั้งรูปจากตาราง', () => {
  it('สมาชิกทั่วไปตั้งรูปไม่ได้', async () => {
    actAs(member);
    expect((await setPartImage(form(partId))).ok).toBe(false);
  });

  it('รหัสอะไหล่ผิดหรือไม่มีจริง ไม่บันทึก', async () => {
    actAs(admin);
    expect(await setPartImage(form('abc'))).toEqual({ ok: false, error: 'ไม่พบอะไหล่' });
    expect(await setPartImage(form(2_000_000_000))).toEqual({ ok: false, error: 'ไม่พบอะไหล่' });
  });

  it('แอดมินตั้งรูปได้ ชิ้นนั้นหายจากรายการไม่มีรูป และมีบันทึกการแก้ไข', async () => {
    actAs(admin);
    expect(await setPartImage(form(partId))).toEqual({
      ok: true,
      url: '/uploads/parts/itest.webp',
    });
    const [part] = await db
      .select({ imageUrl: parts.imageUrl })
      .from(parts)
      .where(eq(parts.id, partId));
    expect(part?.imageUrl).toBe('/uploads/parts/itest.webp');

    const missing = await listAdminParts({ image: 'missing', q: MODEL_PREFIX, page: 1 });
    expect(missing.total).toBe(0);
    const has = await listAdminParts({ image: 'has', q: MODEL_PREFIX, page: 1 });
    expect(has.rows.map((row) => row.id)).toEqual([partId]);

    const logs = await db
      .select({ action: adminLogs.action })
      .from(adminLogs)
      .where(and(eq(adminLogs.adminId, admin.id), eq(adminLogs.targetId, String(partId))));
    expect(logs.map((log) => log.action)).toContain('part.image');
  });
});
