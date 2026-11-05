import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { writePart } from '../parts-write';
import * as schema from '../schema';

import { parsePartsCsv } from '@/lib/parts/csv';
import { CATEGORY_SLUGS } from '@/lib/parts/spec-fields';

// นำเข้า CSV ตัวอย่างหมวดละ 3 แถว ใช้ทดสอบระบบระหว่างพัฒนา
// ข้อมูลในไฟล์เป็นค่าสมมติและมีสถานะ "รอตรวจสอบ" ไม่ใช่สเปกอะไหล่จริง
// รันซ้ำได้ แถวที่นำเข้าแล้วจะถูกข้าม

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  try {
    const allBrands = await db.select().from(schema.brands);
    const brandIds = new Map(allBrands.map((b) => [b.name.toLowerCase(), b.id]));
    const existing = new Set(
      (await db.select({ model: schema.parts.model }).from(schema.parts)).map((p) => p.model),
    );

    for (const category of CATEGORY_SLUGS) {
      const file = path.join(process.cwd(), 'src', 'db', 'seed', 'csv', `${category}.csv`);
      const parsed = parsePartsCsv(await readFile(file, 'utf8'), category, brandIds);
      if (!parsed.ok) throw new Error(`${category}: ${parsed.error}`);

      let added = 0;
      await db.transaction(async (tx) => {
        for (const row of parsed.rows) {
          if (!row.ok) throw new Error(`${category} แถว ${row.row}: ${row.errors.join(', ')}`);
          if (existing.has(row.input.model)) continue;
          await writePart(tx, row.input, null);
          added++;
        }
      });
      console.log(`${category}: เพิ่ม ${added} จาก ${parsed.rows.length} แถว`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
