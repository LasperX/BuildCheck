import { eq, ilike, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminLogs, partPriceHistory, parts } from '@/db/schema';
import { db } from '@/lib/db';
import { PARTS_PAGE_SIZE, partsQuerySchema } from '@/lib/parts/catalog';
import { csvHeaderFor } from '@/lib/parts/csv';
import { importPartsCsv } from '@/server/actions/admin-parts';
import { ADMIN_PAGE_SIZE, listAdminParts } from '@/server/queries/admin-parts';
import { getParts } from '@/server/queries/parts';

import { actAs, cleanupAccounts, createAccount, type TestAccount } from './helpers';

// อะไหล่ราคาเท่ากันที่นำเข้า CSV รอบเดียวกัน (เวลาสร้างเท่ากันทั้งชุด) ต้องเรียงเหมือนเดิมทุกหน้า
// ไล่ครบทุกหน้าแล้วต้องได้ทุกชิ้น ชิ้นละครั้ง ไม่ขึ้นซ้ำ ไม่หาย
// ใช้การ์ดจอชื่อรุ่นขึ้นต้นด้วย MODEL_PREFIX (ไม่ใช่รุ่นจริง) แล้วลบทิ้งใน afterAll

const MODEL_PREFIX = 'ITEST Paging GPU';
const BRAND = 'MSI'; // ยี่ห้อจาก db:seed
// เกินสองเท่าของขนาดหน้า: หน้าแรก Postgres เรียงแบบ top-N heapsort ส่วนหน้าหลังเรียงทั้งชุด
// ถ้าลำดับไม่มีตัวตัดสินสุดท้าย สองวิธีนี้วางของที่ค่าเท่ากันต่างกัน จึงเห็นชิ้นซ้ำหรือหายได้จริง
const COUNT = 2 * Math.max(PARTS_PAGE_SIZE, ADMIN_PAGE_SIZE) + 13;

let admin: TestAccount;

const row = (index: number) =>
  [
    BRAND,
    `${MODEL_PREFIX} ${String(index).padStart(2, '0')}`,
    '7777',
    '',
    '',
    '',
    'https://example.test/spec',
    'ตรวจแล้ว',
    'มีขายมือหนึ่ง',
    'ITEST Chip',
    '8',
    '250',
    '',
    '150',
    '8pin:1',
    '40',
  ].join(',');

const testPartIds = async () =>
  (
    await db
      .select({ id: parts.id })
      .from(parts)
      .where(ilike(parts.model, `${MODEL_PREFIX}%`))
  ).map((part) => part.id);

/** ไล่ทุกหน้าตามจำนวนที่ระบบบอก แล้วคืนรหัสอะไหล่ทั้งหมดตามลำดับที่ได้ */
async function collectPages(
  fetchPage: (page: number) => Promise<{ ids: number[]; total: number }>,
  pageSize: number,
) {
  const first = await fetchPage(1);
  const ids = [...first.ids];
  for (let page = 2; page <= Math.ceil(first.total / pageSize); page++) {
    ids.push(...(await fetchPage(page)).ids);
  }
  return { ids, total: first.total };
}

beforeAll(async () => {
  admin = await createAccount({ role: 'admin' });
  actAs(admin);
  const text = [
    csvHeaderFor('gpu').join(','),
    ...Array.from({ length: COUNT }, (_, i) => row(i + 1)),
  ].join('\n');
  const data = new FormData();
  data.set('category', 'gpu');
  data.set('file', new File([text], 'gpu.csv', { type: 'text/csv' }));
  const done = await importPartsCsv(data);
  if (!done.ok) throw new Error(done.error);
});

afterAll(async () => {
  const ids = await testPartIds();
  if (ids.length) {
    await db.delete(partPriceHistory).where(inArray(partPriceHistory.partId, ids));
    await db.delete(parts).where(inArray(parts.id, ids));
  }
  await db.delete(adminLogs).where(eq(adminLogs.adminId, admin.id));
  await cleanupAccounts();
});

describe('แบ่งหน้ารายการอะไหล่ที่ราคาและเวลาสร้างเท่ากัน', () => {
  it('อะไหล่ชุดทดสอบนำเข้าครบและเวลาสร้างเท่ากันทั้งชุด', async () => {
    const rows = await db
      .select({ createdAt: parts.createdAt })
      .from(parts)
      .where(ilike(parts.model, `${MODEL_PREFIX}%`));
    expect(rows).toHaveLength(COUNT);
    expect(new Set(rows.map((r) => r.createdAt.getTime())).size).toBe(1);
  });

  // ทุกชิ้นในชุดนี้ค่าที่ใช้เรียงเท่ากันหมด ลำดับจึงต้องมาจากรหัสอะไหล่ที่ปิดท้ายไว้ล้วนๆ
  const ascending = (ids: number[]) => [...ids].sort((a, b) => a - b);
  const descending = (ids: number[]) => [...ids].sort((a, b) => b - a);
  const byIdWhenTied = {
    popular: ascending,
    price_asc: ascending,
    newest: descending,
    price_desc: descending,
  } as const;

  for (const sort of ['popular', 'newest', 'price_asc', 'price_desc'] as const) {
    it(`หน้าคลังอะไหล่ เรียงแบบ ${sort} ได้ครบทุกชิ้น ไม่ซ้ำ และของที่เท่ากันเรียงตามรหัส`, async () => {
      const { ids, total } = await collectPages(async (page) => {
        const result = await getParts(
          partsQuerySchema.parse({ category: 'gpu', q: MODEL_PREFIX, sort, page }),
        );
        return { ids: result.items.map((item) => item.id), total: result.total };
      }, PARTS_PAGE_SIZE);
      expect(total).toBe(COUNT);
      expect(new Set(ids).size).toBe(COUNT);
      expect(ids).toEqual(byIdWhenTied[sort](ids));
    });
  }

  it('หน้าจัดการอะไหล่หลังบ้าน ได้ครบทุกชิ้น ไม่ซ้ำ และของที่เท่ากันเรียงจากรหัสใหม่ไปเก่า', async () => {
    const { ids, total } = await collectPages(async (page) => {
      const result = await listAdminParts({ q: MODEL_PREFIX, page });
      return { ids: result.rows.map((part) => part.id), total: result.total };
    }, ADMIN_PAGE_SIZE);
    expect(total).toBe(COUNT);
    expect(new Set(ids).size).toBe(COUNT);
    expect(ids).toEqual(descending(ids));
  });

  it('เรียกหน้าเดิมซ้ำได้ลำดับเดิม', async () => {
    const page = async () =>
      (await listAdminParts({ q: MODEL_PREFIX, page: 1 })).rows.map((part) => part.id);
    expect(await page()).toEqual(await page());
  });
});
