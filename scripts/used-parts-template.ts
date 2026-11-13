// สร้างไฟล์ CSV เปล่าสำหรับเพิ่มอะไหล่รุ่นเก่าที่ "มีแต่มือสอง" ทีละหมวด และคู่มือคอลัมน์
// คอลัมน์มาจาก BASE_COLUMNS และ SPEC_FIELDS ตัวเดียวกับที่ระบบนำเข้าใช้จริง จึงนำเข้าได้ทันทีหลังกรอก
// ใช้: pnpm parts:used-template → docs/used-parts/*.csv และ docs/used-parts/README.md

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { BASE_COLUMNS } from '@/lib/parts/csv';
import {
  CATEGORY_LABELS,
  CATEGORY_SLUGS,
  SPEC_FIELDS,
  type SpecField,
} from '@/lib/parts/spec-fields';

const outDir = path.join(process.cwd(), 'docs', 'used-parts');
mkdirSync(outDir, { recursive: true });

const KIND_HELP: Record<SpecField['kind'], string> = {
  text: 'ข้อความ',
  int: 'จำนวนเต็ม',
  decimal: 'ตัวเลขทศนิยมได้',
  bool: 'true หรือ false',
  enum: 'เลือกหนึ่งค่า',
  list: 'หลายค่าคั่นด้วย | เช่น ATX|mATX',
  intList: 'ตัวเลขหลายค่าคั่นด้วย | เช่น 240|360',
  connectors: 'ช่องไฟ เช่น 8pin:1|6pin:2',
};

const BASE_HELP: Record<(typeof BASE_COLUMNS)[number], string> = {
  brand: 'ยี่ห้อ ต้องมีอยู่ในระบบแล้ว (เพิ่มยี่ห้อใหม่ในหลังบ้านก่อนถ้ายังไม่มี)',
  model: 'ชื่อรุ่นตามผู้ผลิต',
  price: 'รุ่นที่มีแต่มือสอง: ใส่ราคาตอนเปิดตัว ใช้คิดค่าเสื่อมเท่านั้น ไม่ใช่ราคาที่ซื้อได้',
  release_year: 'ปีที่วางขาย (ค.ศ.) ใช้คิดค่าเสื่อมของราคามือสองประมาณการ',
  power_watt: 'เฉพาะเมนบอร์ด เว้นว่างได้ (ระบบใช้ 50 W)',
  image_url: 'เว้นว่างได้ แล้วอัปโหลดรูปในหน้าแก้ไขอะไหล่ทีหลัง',
  spec_source_url: 'ลิงก์หน้าสเปกของผู้ผลิต',
  verified: 'ตรวจแล้ว เมื่อเทียบสเปกกับหน้าผู้ผลิตแล้วเท่านั้น ไม่งั้นใส่ รอตรวจสอบ',
  availability: 'ใส่ มีแต่มือสอง (ไฟล์ชุดนี้ทำไว้สำหรับรุ่นเลิกขายมือหนึ่งแล้ว)',
};

const lines: string[] = [
  '# เพิ่มอะไหล่รุ่นเก่าที่มีแต่มือสอง',
  '',
  'ไฟล์ CSV ในโฟลเดอร์นี้มีแต่หัวคอลัมน์ ไม่มีข้อมูลตัวอย่าง (กันนำเข้าข้อมูลสมมติไปโดยไม่ตั้งใจ)',
  'สร้างจากโค้ดด้วย `pnpm parts:used-template` คอลัมน์ตรงกับที่ระบบนำเข้าใช้จริง',
  '',
  '## ขั้นตอน',
  '',
  '1. เปิดไฟล์ของหมวดด้วย Excel หรือ Google Sheets แล้วกรอกทีละแถว 1 แถว = 1 รุ่น',
  '2. สเปกทุกค่าต้องมาจาก**หน้าเว็บผู้ผลิต** ใส่ลิงก์ไว้ในช่อง spec_source_url',
  '3. ช่อง availability ใส่ `มีแต่มือสอง` ทุกแถว',
  '4. บันทึกเป็น CSV (UTF-8) แล้วนำเข้าที่หลังบ้าน → นำเข้า CSV',
  '5. บันทึกราคามือสองที่สำรวจจริงที่หลังบ้าน → ราคามือสอง (ระบบเตือนรุ่นที่มีแต่มือสองแต่ยังไม่มีราคาสำรวจไว้ให้)',
  '',
  'รายชื่อรุ่นที่แนะนำให้เพิ่ม (เช็กลิสต์ ไม่มีค่าสเปก) อยู่ที่ `model-list.md`',
  '',
  '## จุดที่มักพลาด',
  '',
  '- `generation` ของ CPU ต้องสะกดตรงกับรายการรุ่นที่เมนบอร์ดรองรับ ไม่งั้นกฎ R02/R03 จะเตือนผิด',
  '  ถ้าเพิ่ม CPU รุ่นเก่า ต้องเพิ่มเมนบอร์ดที่รองรับรุ่นนั้นด้วย (และกลับกัน) ไม่งั้นจัดสเปกรุ่นนั้นไม่ได้',
  '- `perf_score` (0–100) ใช้เทียบกันในหมวดเดียวกัน ให้ใช้เกณฑ์เดียวกับรุ่นที่มีในระบบอยู่แล้ว',
  '  รุ่นเก่าที่แรงน้อยกว่าต้องได้คะแนนน้อยกว่า ไม่งั้นการจัดตามงบจะเลือกผิด',
  '- นำเข้าซ้ำไฟล์เดิมได้ ระบบจับคู่ยี่ห้อ+ชื่อรุ่น แล้วอัปเดตชิ้นเดิม ไม่สร้างซ้ำ',
  '',
  '## คอลัมน์หลัก (ทุกหมวด)',
  '',
  '| คอลัมน์ | ความหมาย |',
  '|---|---|',
  ...BASE_COLUMNS.map((column) => `| \`${column}\` | ${BASE_HELP[column]} |`),
  '',
];

for (const category of CATEGORY_SLUGS) {
  const fields = SPEC_FIELDS[category];
  const header = [...BASE_COLUMNS, ...fields.map((field) => field.csv)].join(',');
  // BOM ให้ Excel เปิดภาษาไทยได้ถูก
  writeFileSync(path.join(outDir, `${category}.csv`), `﻿${header}\n`);

  lines.push(`## ${CATEGORY_LABELS[category]} (\`${category}.csv\`)`, '');
  lines.push('| คอลัมน์ | ความหมาย | ชนิด | บังคับ |', '|---|---|---|---|');
  for (const field of fields) {
    const options = field.options ? ` (${field.options.join(', ')})` : '';
    const hint = field.hint ? ` · ${field.hint}` : '';
    lines.push(
      `| \`${field.csv}\` | ${field.label}${hint} | ${KIND_HELP[field.kind]}${options} | ${field.required ? 'ใช่' : ''} |`,
    );
  }
  lines.push('');
}

writeFileSync(path.join(outDir, 'README.md'), lines.join('\n'));
console.log(
  `สร้างไฟล์ใน ${path.relative(process.cwd(), outDir)} แล้ว ${CATEGORY_SLUGS.length} หมวด`,
);
