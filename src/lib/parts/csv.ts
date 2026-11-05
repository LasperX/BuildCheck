import Papa from 'papaparse';

import { type CategorySlug, SPEC_FIELDS } from '@/lib/parts/spec-fields';
import { type PartInput, partInputSchema } from '@/lib/validators/parts';

// อ่านไฟล์ CSV ที่แอดมินเตรียมเอง แล้วแปลงแต่ละแถวเป็นค่าที่ผ่านกฎตรวจชุดเดียวกับฟอร์ม
// คอลัมน์หลักด้านล่าง + คอลัมน์สเปกของหมวดนั้นจาก SPEC_FIELDS

export const BASE_COLUMNS = [
  'brand',
  'model',
  'price',
  'release_year',
  'power_watt',
  'image_url',
  'spec_source_url',
  'verified',
] as const;

// คอลัมน์ verified: ข้อมูลที่ยังไม่ได้ตรวจกับแหล่งจริงให้ใส่ "รอตรวจสอบ"
export const VERIFIED_LABEL = 'ตรวจแล้ว';
export const UNVERIFIED_LABEL = 'รอตรวจสอบ';

export const csvHeaderFor = (category: CategorySlug) => [
  ...BASE_COLUMNS,
  ...SPEC_FIELDS[category].map((field) => field.csv),
];

export type CsvRowResult =
  | { row: number; ok: true; label: string; verified: boolean; input: PartInput }
  | { row: number; ok: false; label: string; errors: string[] };

export type CsvParseResult =
  | { ok: false; error: string }
  | { ok: true; rows: CsvRowResult[]; validCount: number; errorCount: number };

export const MAX_CSV_ROWS = 1000;

/** ตรวจไฟล์ทั้งไฟล์โดยยังไม่เขียนฐานข้อมูล ผลลัพธ์นี้ใช้แสดงพรีวิวและใช้ตอนยืนยันนำเข้า */
export function parsePartsCsv(
  text: string,
  category: CategorySlug,
  brandIdByName: Map<string, number>,
): CsvParseResult {
  // ลบ BOM ที่ Excel ใส่ไว้หน้าไฟล์ UTF-8 ไม่เช่นนั้นคอลัมน์แรกจะอ่านไม่ตรง
  const clean = text.replace(/^﻿/, '');
  const parsed = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  });

  const fieldsFound = parsed.meta.fields ?? [];
  const missing = csvHeaderFor(category).filter((column) => !fieldsFound.includes(column));
  if (missing.length) {
    return { ok: false, error: `ไฟล์ไม่มีคอลัมน์: ${missing.join(', ')}` };
  }
  if (parsed.data.length === 0) return { ok: false, error: 'ไม่พบข้อมูลในไฟล์' };
  if (parsed.data.length > MAX_CSV_ROWS) {
    return { ok: false, error: `นำเข้าได้ครั้งละไม่เกิน ${MAX_CSV_ROWS} แถว` };
  }

  const seen = new Set<string>();
  const rows: CsvRowResult[] = parsed.data.map((raw, index) => {
    const row = index + 2; // แถว 1 คือหัวคอลัมน์ ให้ตรงกับเลขแถวใน Excel
    const brandName = raw.brand?.trim() ?? '';
    const model = raw.model?.trim() ?? '';
    const label = `${brandName} ${model}`.trim() || '(ไม่มีชื่อ)';
    const errors: string[] = [];

    const brandId = brandIdByName.get(brandName.toLowerCase());
    if (!brandId) errors.push(`ไม่พบยี่ห้อ "${brandName}" ในระบบ`);

    const duplicateKey = `${brandName}|${model}`.toLowerCase();
    if (seen.has(duplicateKey)) errors.push('รุ่นนี้ซ้ำกับแถวก่อนหน้าในไฟล์');
    seen.add(duplicateKey);

    const spec = Object.fromEntries(
      SPEC_FIELDS[category].map((field) => [field.key, raw[field.csv] ?? '']),
    );
    const verifiedText = raw.verified?.trim() ?? '';
    const result = partInputSchema.safeParse({
      categorySlug: category,
      brandId: brandId ?? 0,
      model,
      price: raw.price,
      powerWatt: raw.power_watt,
      releaseYear: raw.release_year,
      imageUrl: raw.image_url,
      specSourceUrl: raw.spec_source_url,
      specVerified: verifiedText === VERIFIED_LABEL,
      isActive: true,
      spec,
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        // ซ่อนข้อความยี่ห้อซ้ำ เพราะแจ้งไปแล้วด้านบน
        if (issue.path[0] === 'brandId') continue;
        errors.push(issue.message);
      }
    }
    if (errors.length || !result.success) {
      return { row, ok: false, label, errors };
    }
    return { row, ok: true, label, verified: result.data.specVerified, input: result.data };
  });

  const validCount = rows.filter((r) => r.ok).length;
  return { ok: true, rows, validCount, errorCount: rows.length - validCount };
}
