import { describe, expect, it } from 'vitest';

import { surveyForGrade } from '@/lib/compat/used-price';
import { BOM } from '@/lib/parts/csv';
import { parseSurveyCsv, surveyMatchKey, surveysToCsv } from '@/lib/used/survey-csv';

const HEAD = 'brand,model,grade,min_price,max_price,surveyed_at,source_note';
const TODAY = '2026-11-14';

describe('parseSurveyCsv', () => {
  it('อ่านแถวที่ถูกต้อง และรับ BOM กับเกรดตัวพิมพ์เล็ก', () => {
    const result = parseSurveyCsv(
      `﻿${HEAD}\nMSI,GeForce GTX 1050 Ti GAMING X 4G,b,1500,1700,2026-11-10,กลุ่มซื้อขาย\n`,
      TODAY,
    );
    expect(result).toEqual({
      ok: true,
      errors: [],
      rows: [
        {
          row: 2,
          brand: 'MSI',
          model: 'GeForce GTX 1050 Ti GAMING X 4G',
          grade: 'B',
          minPrice: 1500,
          maxPrice: 1700,
          surveyedAt: '2026-11-10',
          sourceNote: 'กลุ่มซื้อขาย',
        },
      ],
    });
  });

  it('บอกแถวที่ผิดพร้อมเหตุผล', () => {
    const result = parseSurveyCsv(
      [
        HEAD,
        'MSI,A,B,2000,1500,2026-11-10,',
        'MSI,B,D,100,200,2026-11-10,',
        'MSI,C,A,100,200,2026-12-01,',
        'MSI,D,A,abc,200,2026-11-10,',
        'MSI,E,A,100,200,10/11/2026,',
      ].join('\n'),
      TODAY,
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      { row: 2, message: 'ราคาต่ำสุดต้องไม่เกินราคาสูงสุด' },
      { row: 3, message: 'เกรดต้องเป็น A, B หรือ C' },
      { row: 4, message: 'วันที่สำรวจต้องไม่เป็นวันในอนาคต' },
      { row: 5, message: 'ราคาต้องเป็นตัวเลข' },
      { row: 6, message: 'วันที่สำรวจต้องเป็นรูปแบบ YYYY-MM-DD' },
    ]);
  });

  it('ไม่รับไฟล์ที่ขาดคอลัมน์หรือไม่มีข้อมูล', () => {
    expect(parseSurveyCsv('brand,model\nMSI,A\n', TODAY)).toEqual({
      ok: false,
      error: 'ไฟล์ไม่มีคอลัมน์: grade, min_price, max_price, surveyed_at',
    });
    expect(parseSurveyCsv(`${HEAD}\n`, TODAY)).toEqual({ ok: false, error: 'ไฟล์ไม่มีข้อมูล' });
  });

  it('กุญแจจับคู่ไม่สนตัวพิมพ์และช่องว่างซ้ำ', () => {
    expect(surveyMatchKey(' MSI ', 'GeForce  GTX 1050 Ti')).toBe(
      surveyMatchKey('msi', 'geforce gtx 1050 ti'),
    );
  });
});

describe('surveyForGrade', () => {
  const b = { minPrice: 1400, maxPrice: 1600, surveyedAt: '2026-11-10' };

  it('ใช้ราคาสำรวจของเกรดนั้นเองก่อน', () => {
    const a = { minPrice: 2000, maxPrice: 2200, surveyedAt: '2026-11-01' };
    expect(surveyForGrade({ A: a, B: b }, 'A', TODAY)).toBe(a);
  });

  it('เกรดที่ไม่ได้สำรวจ เทียบจากเกรด B ด้วยตัวคูณเกรด (A 1.00, B 0.90, C 0.75)', () => {
    // 1,400 × 1.00 ÷ 0.90 = 1,555.6 → 1,550 · 1,600 × 1.00 ÷ 0.90 = 1,777.8 → 1,800
    expect(surveyForGrade({ B: b }, 'A', TODAY)).toEqual({
      minPrice: 1550,
      maxPrice: 1800,
      surveyedAt: '2026-11-10',
    });
    // 1,400 × 0.75 ÷ 0.90 = 1,166.7 → 1,150 · 1,600 × 0.75 ÷ 0.90 = 1,333.3 → 1,350
    expect(surveyForGrade({ B: b }, 'C', TODAY)).toEqual({
      minPrice: 1150,
      maxPrice: 1350,
      surveyedAt: '2026-11-10',
    });
  });

  it('ราคาสำรวจเก่าแค่ไหนก็ยังใช้ (ไม่มีวันหมดอายุ) ทั้งเกรดตัวเองและเกรดที่เทียบจากเกรดนั้น', () => {
    const old = { minPrice: 1400, maxPrice: 1600, surveyedAt: '2025-01-15' };
    expect(surveyForGrade({ B: old }, 'B', TODAY)).toBe(old);
    expect(surveyForGrade({ B: old }, 'A', TODAY)).toEqual({
      minPrice: 1550,
      maxPrice: 1800,
      surveyedAt: '2025-01-15',
    });
  });

  it('ราคาที่ลงวันที่ในอนาคตยังไม่ใช้ และไม่มีราคาสำรวจเลยคืน null', () => {
    const future = { minPrice: 1400, maxPrice: 1600, surveyedAt: '2026-11-20' };
    expect(surveyForGrade({ B: future }, 'B', TODAY)).toBeNull();
    expect(surveyForGrade({ B: future }, 'A', TODAY)).toBeNull();
    expect(surveyForGrade({}, 'B', TODAY)).toBeNull();
  });
});

describe('surveysToCsv', () => {
  it('ส่งออกราคาสำรวจแล้วนำเข้ากลับได้ค่าเดิม (หมายเหตุที่มีจุลภาคก็อ่านถูก)', () => {
    const exported = surveysToCsv([
      {
        brand: 'MSI',
        model: 'GeForce GTX 1050 Ti GAMING X 4G',
        grade: 'B',
        minPrice: 1500,
        maxPrice: 1700,
        surveyedAt: '2026-11-10',
        sourceNote: 'กลุ่มซื้อขาย, Facebook',
      },
      {
        brand: 'AMD',
        model: 'Ryzen 5 3600',
        grade: 'A',
        minPrice: 2200,
        maxPrice: 2500,
        surveyedAt: '2025-06-01',
        sourceNote: null,
      },
    ]);
    expect(exported.startsWith(BOM)).toBe(true);
    expect(exported.slice(BOM.length).split('\r\n')[0]).toBe(HEAD);

    const parsed = parseSurveyCsv(exported, TODAY);
    expect(parsed.ok && parsed.errors).toEqual([]);
    expect(parsed.ok && parsed.rows).toEqual([
      {
        row: 2,
        brand: 'MSI',
        model: 'GeForce GTX 1050 Ti GAMING X 4G',
        grade: 'B',
        minPrice: 1500,
        maxPrice: 1700,
        surveyedAt: '2026-11-10',
        sourceNote: 'กลุ่มซื้อขาย, Facebook',
      },
      {
        row: 3,
        brand: 'AMD',
        model: 'Ryzen 5 3600',
        grade: 'A',
        minPrice: 2200,
        maxPrice: 2500,
        surveyedAt: '2025-06-01',
        sourceNote: '',
      },
    ]);
  });
});
