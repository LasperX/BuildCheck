import { eq, ilike } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminLogs, brands } from '@/db/schema';
import { db } from '@/lib/db';
import { createBrand } from '@/server/actions/admin-parts';

import { actAs, cleanupAccounts, createAccount, type TestAccount } from './helpers';

// แอดมินเพิ่มยี่ห้อใหม่ก่อนนำเข้า CSV ใช้ชื่อขึ้นต้นด้วย PREFIX (ไม่ใช่ยี่ห้อจริง) แล้วลบทิ้งใน afterAll

const PREFIX = 'ITEST Brand';

let admin: TestAccount;
let member: TestAccount;

const testBrands = () =>
  db
    .select({ name: brands.name })
    .from(brands)
    .where(ilike(brands.name, `${PREFIX}%`));

beforeAll(async () => {
  admin = await createAccount({ role: 'admin' });
  member = await createAccount({ verified: true });
});

afterAll(async () => {
  await db.delete(brands).where(ilike(brands.name, `${PREFIX}%`));
  await db.delete(adminLogs).where(eq(adminLogs.adminId, admin.id));
  await cleanupAccounts();
});

describe('เพิ่มยี่ห้อ', () => {
  it('สมาชิกทั่วไปเพิ่มไม่ได้', async () => {
    actAs(member);
    expect((await createBrand({ name: `${PREFIX} X` })).ok).toBe(false);
    expect(await testBrands()).toEqual([]);
  });

  it('แอดมินเพิ่มได้ ตัดช่องว่างหัวท้าย', async () => {
    actAs(admin);
    expect(await createBrand({ name: `  ${PREFIX} A  ` })).toEqual({
      ok: true,
      name: `${PREFIX} A`,
    });
    expect(await testBrands()).toEqual([{ name: `${PREFIX} A` }]);
  });

  it('ชื่อซ้ำ (ต่างตัวพิมพ์) และชื่อว่าง ไม่เพิ่ม', async () => {
    actAs(admin);
    expect(await createBrand({ name: `${PREFIX.toLowerCase()} a` })).toEqual({
      ok: false,
      error: `มียี่ห้อ ${PREFIX} A ในระบบอยู่แล้ว`,
    });
    expect(await createBrand({ name: '   ' })).toEqual({
      ok: false,
      error: 'กรุณากรอกชื่อยี่ห้อ',
    });
    expect(await testBrands()).toHaveLength(1);
  });
});
