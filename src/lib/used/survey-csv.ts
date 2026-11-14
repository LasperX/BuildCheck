import Papa from 'papaparse';
import { z } from 'zod';

import type { UsedGrade } from '@/lib/compat/used-price';

// นำเข้าราคาสำรวจมือสองทีละหลายรุ่นจาก CSV (แหล่งที่ 2 ของราคากลาง หัวข้อ 4.6)
// ฟังก์ชันล้วน ไม่อ่านฐานข้อมูล การจับคู่รุ่นกับอะไหล่ในระบบทำใน Server Action

export const SURVEY_CSV_COLUMNS = [
  'brand',
  'model',
  'grade',
  'min_price',
  'max_price',
  'surveyed_at',
  'source_note',
] as const;

/** จำนวนแถวสูงสุดต่อไฟล์ กันไฟล์ใหญ่เกินจนคำสั่งเดียวช้า */
export const SURVEY_CSV_MAX_ROWS = 1000;

export type SurveyCsvRow = {
  /** เลขแถวในไฟล์ (แถวหัวคอลัมน์ = 1) */
  row: number;
  brand: string;
  model: string;
  grade: UsedGrade;
  minPrice: number;
  maxPrice: number;
  surveyedAt: string;
  sourceNote: string;
};

export type SurveyCsvResult =
  | { ok: false; error: string }
  | { ok: true; rows: SurveyCsvRow[]; errors: { row: number; message: string }[] };

const price = z.coerce
  .number({ error: 'ราคาต้องเป็นตัวเลข' })
  .positive({ error: 'ราคาต้องมากกว่า 0' })
  .max(1_000_000, { error: 'ราคาสูงเกินไป' });

const rowSchema = z
  .object({
    brand: z.string().trim().min(1, { error: 'ไม่มียี่ห้อ' }).max(80),
    model: z.string().trim().min(1, { error: 'ไม่มีชื่อรุ่น' }).max(200),
    grade: z
      .string()
      .trim()
      .toUpperCase()
      .pipe(z.enum(['A', 'B', 'C'], { error: 'เกรดต้องเป็น A, B หรือ C' })),
    min_price: price,
    max_price: price,
    surveyed_at: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'วันที่สำรวจต้องเป็นรูปแบบ YYYY-MM-DD' })
      .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
        error: 'วันที่สำรวจไม่ถูกต้อง',
      }),
    source_note: z.string().trim().max(200).optional().default(''),
  })
  .refine((value) => value.min_price <= value.max_price, {
    error: 'ราคาต่ำสุดต้องไม่เกินราคาสูงสุด',
  });

/** อ่านไฟล์ CSV ราคาสำรวจ คืนแถวที่ถูกต้องและรายการแถวที่ผิดพร้อมเหตุผล */
export function parseSurveyCsv(text: string, today: string): SurveyCsvResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  });
  const fields = parsed.meta.fields ?? [];
  const missing = SURVEY_CSV_COLUMNS.filter(
    (column) => column !== 'source_note' && !fields.includes(column),
  );
  if (missing.length > 0) {
    return { ok: false, error: `ไฟล์ไม่มีคอลัมน์: ${missing.join(', ')}` };
  }
  if (parsed.data.length === 0) return { ok: false, error: 'ไฟล์ไม่มีข้อมูล' };
  if (parsed.data.length > SURVEY_CSV_MAX_ROWS) {
    return { ok: false, error: `นำเข้าได้ไม่เกิน ${SURVEY_CSV_MAX_ROWS} แถวต่อไฟล์` };
  }

  const rows: SurveyCsvRow[] = [];
  const errors: { row: number; message: string }[] = [];
  parsed.data.forEach((raw, index) => {
    const row = index + 2;
    const result = rowSchema.safeParse(raw);
    if (!result.success) {
      errors.push({ row, message: result.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' });
      return;
    }
    const value = result.data;
    if (value.surveyed_at > today) {
      errors.push({ row, message: 'วันที่สำรวจต้องไม่เป็นวันในอนาคต' });
      return;
    }
    rows.push({
      row,
      brand: value.brand,
      model: value.model,
      grade: value.grade,
      minPrice: value.min_price,
      maxPrice: value.max_price,
      surveyedAt: value.surveyed_at,
      sourceNote: value.source_note,
    });
  });
  return { ok: true, rows, errors };
}

/** กุญแจจับคู่รุ่นในไฟล์กับอะไหล่ในระบบ ไม่สนตัวพิมพ์เล็กใหญ่และช่องว่างซ้ำ */
export const surveyMatchKey = (brand: string, model: string) =>
  `${brand.trim().toLowerCase()}|${model.trim().replace(/\s+/g, ' ').toLowerCase()}`;
