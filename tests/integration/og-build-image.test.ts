import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { eq, ilike, inArray } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GET } from '@/app/api/og/build/[id]/route';
import { adminLogs, builds, partPriceHistory, partUsedStats, parts } from '@/db/schema';
import { db } from '@/lib/db';
import { csvHeaderFor } from '@/lib/parts/csv';
import { importPartsCsv } from '@/server/actions/admin-parts';
import { saveBuild } from '@/server/actions/builds';

import {
  actAs,
  cleanupAccounts,
  createAccount,
  partsByCategory,
  type TestAccount,
} from './helpers';

// รูปสรุปสเปกที่ดาวน์โหลด (/api/og/build/[id]) ต้องเห็นรูปอะไหล่ ไม่ใช่แค่ชื่อ
// ใช้การ์ดจอทดสอบที่รูปเป็นสีบานเย็นทั้งรูป (สีนี้ไม่มีที่อื่นในรูปสรุป) แล้วนับพิกเซลสีนั้นในรูปที่สร้างได้
// ตั้ง OG_PREVIEW_PATH=<ไฟล์.png> ตอนรัน เพื่อบันทึกรูปที่สร้างไว้เปิดดูด้วยตา

const MODEL_PREFIX = 'ITEST OG GPU';
const IMAGE_PATH = '/uploads/itest-og-magenta.png';
const IMAGE_FILE = join(process.cwd(), 'public', IMAGE_PATH);

let admin: TestAccount;
let owner: TestAccount;
let buildId = '';

const ogImage = (id: string) =>
  GET(new Request(`http://localhost/api/og/build/${id}`), { params: Promise.resolve({ id }) });

/** จำนวนพิกเซลสีบานเย็น (แดงและน้ำเงินสูง เขียวต่ำ) ในรูป PNG */
async function magentaPixels(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i]! > 200 && data[i + 1]! < 70 && data[i + 2]! > 200) count++;
  }
  return count;
}

beforeAll(async () => {
  await mkdir(join(process.cwd(), 'public', 'uploads'), { recursive: true });
  await sharp({
    create: { width: 300, height: 300, channels: 3, background: { r: 230, g: 20, b: 230 } },
  })
    .png()
    .toFile(IMAGE_FILE);

  [admin, owner] = await Promise.all([createAccount({ role: 'admin' }), createAccount()]);
  actAs(admin);
  const row = [
    'MSI',
    `${MODEL_PREFIX} PINK`,
    '15000',
    '2024',
    '',
    IMAGE_PATH,
    'https://example.test/spec',
    'รอตรวจสอบ',
    'มีขายมือหนึ่ง',
    'ITEST Chip',
    '8',
    '250',
    '2',
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
  const [gpu] = await db
    .select({ id: parts.id })
    .from(parts)
    .where(eq(parts.model, `${MODEL_PREFIX} PINK`));

  const { pick } = await partsByCategory();
  const [cpu] = pick('cpu');
  actAs(owner);
  const saved = await saveBuild({
    title: 'สเปกทดสอบรูปสรุป',
    description: '',
    usageType: 'gaming',
    budget: 40000,
    items: [
      { partId: cpu!.id, quantity: 1 },
      { partId: gpu!.id, quantity: 1 },
    ],
  });
  if (!saved.ok) throw new Error(saved.error);
  buildId = saved.id;
});

afterAll(async () => {
  if (buildId) await db.delete(builds).where(eq(builds.id, buildId));
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
  await rm(IMAGE_FILE, { force: true });
});

describe('รูปสรุปสเปก', () => {
  it('เห็นรูปอะไหล่ในการ์ด ไม่ใช่แค่ชื่อ', async () => {
    actAs(owner);
    const response = await ogImage(buildId);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');

    const png = Buffer.from(await response.arrayBuffer());
    if (process.env.OG_PREVIEW_PATH) await writeFile(process.env.OG_PREVIEW_PATH, png);
    const { width, height } = await sharp(png).metadata();
    expect({ width, height }).toEqual({ width: 1200, height: 630 });
    // รูปย่อ 64 × 64 px = 4,096 พิกเซล หักขอบและมุมโค้งแล้วยังต้องเห็นส่วนใหญ่
    expect(await magentaPixels(png)).toBeGreaterThan(3000);
  });

  it('สเปกส่วนตัว คนอื่นเปิดรูปสรุปไม่ได้', async () => {
    actAs(await createAccount());
    expect((await ogImage(buildId)).status).toBe(404);
    actAs(null);
    expect((await ogImage(buildId)).status).toBe(404);
  });
});
