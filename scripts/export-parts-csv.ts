// ส่งออกอะไหล่จากฐานข้อมูลเป็นไฟล์ CSV หมวดละไฟล์ ใช้ย้ายข้อมูลจากเครื่องขึ้นเว็บจริง
// ไฟล์ที่ได้ใช้รูปแบบเดียวกับหน้า "นำเข้า CSV" ของแอดมิน นำเข้าได้ทันที และเก็บสถานะ "ตรวจแล้ว" ไว้
//
// pnpm parts:export [โฟลเดอร์ปลายทาง]   (ค่าเริ่มต้น: exports/parts)
//
// - ส่งออกเฉพาะอะไหล่ที่ "แสดงบนหน้าเว็บ" อะไหล่ที่ซ่อนไว้ (เช่นอะไหล่ตัวอย่าง) ไม่ถูกส่งออก
// - รูปที่อัปโหลดไว้ในเครื่อง (/uploads/...) ไม่มีบนเว็บจริง จึงเว้นช่อง image_url ว่าง ต้องอัปโหลดใหม่
// - อ่านอย่างเดียว ไม่แก้ข้อมูลในฐานข้อมูล

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import Papa from 'papaparse';
import { Pool } from 'pg';

import * as schema from '../src/db/schema';
import { csvHeaderFor, UNVERIFIED_LABEL, VERIFIED_LABEL } from '../src/lib/parts/csv';
import { CATEGORY_SLUGS, SPEC_FIELDS, type SpecField } from '../src/lib/parts/spec-fields';

/** แปลงค่าจากฐานข้อมูลเป็นข้อความในช่อง CSV รูปแบบเดียวกับที่ตัวนำเข้าอ่าน */
function toCell(field: SpecField, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (field.kind === 'bool') return value ? 'true' : 'false';
  if (field.kind === 'connectors') {
    return Object.entries(value as Record<string, number>)
      .map(([name, count]) => `${name}:${count}`)
      .join('|');
  }
  if (Array.isArray(value)) return value.join('|');
  return String(value);
}

async function main() {
  const outDir = path.resolve(process.argv[2] ?? path.join('exports', 'parts'));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  try {
    await mkdir(outDir, { recursive: true });
    for (const category of CATEGORY_SLUGS) {
      const categoryRow = await db.query.categories.findFirst({
        where: eq(schema.categories.slug, category),
      });
      if (!categoryRow) throw new Error(`ไม่พบหมวด ${category} ให้รัน pnpm db:seed ก่อน`);

      const rows = await db.query.parts.findMany({
        where: (parts, { and }) =>
          and(eq(parts.categoryId, categoryRow.id), eq(parts.isActive, true)),
        with: { brand: true, [category]: true },
        orderBy: [asc(schema.parts.createdAt), asc(schema.parts.id)],
      });

      const header = csvHeaderFor(category);
      const data = rows.map((part) => {
        const spec = ((part as Record<string, unknown>)[category] ?? {}) as Record<string, unknown>;
        const image = part.imageUrl && !part.imageUrl.startsWith('/uploads/') ? part.imageUrl : '';
        return [
          part.brand.name,
          part.model,
          String(Number(part.price)),
          part.releaseYear === null ? '' : String(part.releaseYear),
          part.powerWatt === null ? '' : String(part.powerWatt),
          image,
          part.specSourceUrl ?? '',
          part.specVerified ? VERIFIED_LABEL : UNVERIFIED_LABEL,
          part.availability,
          ...SPEC_FIELDS[category].map((field) => toCell(field, spec[field.key])),
        ];
      });

      // ใส่ BOM ให้ Excel เปิดภาษาไทยถูก ตัวนำเข้าตัด BOM ออกเอง
      const csv = `﻿${Papa.unparse({ fields: header, data }, { newline: '\r\n' })}\r\n`;
      const file = path.join(outDir, `${category}.csv`);
      await writeFile(file, csv, 'utf8');
      const verified = rows.filter((part) => part.specVerified).length;
      console.log(`${category}: ${rows.length} แถว (ตรวจแล้ว ${verified}) → ${file}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
