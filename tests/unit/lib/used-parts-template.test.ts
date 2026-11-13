import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parsePartsCsv } from '@/lib/parts/csv';
import { CATEGORY_SLUGS } from '@/lib/parts/spec-fields';

// ไฟล์ CSV เปล่าใน docs/used-parts (pnpm parts:used-template) ต้องนำเข้าได้จริงเมื่อกรอกข้อมูล
// ตรวจแค่หัวคอลัมน์และค่า availability ข้อมูลสเปกจริงต้องมาจากหน้าเว็บผู้ผลิต ไม่ได้ใส่ในเทสต์นี้

describe('ไฟล์ CSV สำหรับอะไหล่ที่มีแต่มือสอง', () => {
  it.each(CATEGORY_SLUGS)(
    '%s: หัวคอลัมน์ครบตามที่ระบบนำเข้าต้องการ และมีคอลัมน์ availability',
    (category) => {
      const text = readFileSync(`docs/used-parts/${category}.csv`, 'utf8');
      const result = parsePartsCsv(text, category, new Map());
      // ไฟล์มีแต่หัวคอลัมน์ ผ่านการตรวจคอลัมน์แล้วไปติดที่ "ไม่พบข้อมูล" ซึ่งเป็นสิ่งที่ควรเป็น
      expect(result).toEqual({ ok: false, error: 'ไม่พบข้อมูลในไฟล์' });
      expect(text.split('\n')[0]).toContain('availability');
    },
  );

  it('ค่า มีแต่มือสอง ในคอลัมน์ availability อ่านเป็น used_only', () => {
    const header = readFileSync('docs/used-parts/cpu.csv', 'utf8').trim();
    const columns = header.replace(/^﻿/, '').split(',');
    // แถวทดสอบรูปแบบเท่านั้น (ยี่ห้อไม่มีในระบบ จึงไม่ใช่ข้อมูลที่จะนำเข้าจริง)
    const row = columns.map((column) => (column === 'availability' ? 'มีแต่มือสอง' : ''));
    const result = parsePartsCsv(`${header}\n${row.join(',')}`, 'cpu', new Map());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hasAvailabilityColumn).toBe(true);
    // แถวนี้ผิดเพราะไม่มียี่ห้อและสเปก แต่ต้องไม่ผิดเพราะค่า availability
    const errors = result.rows.flatMap((row) => (row.ok ? [] : row.errors));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.includes('availability'))).toBe(false);

    // ค่าที่ไม่รู้จักต้องถูกจับได้ (ยืนยันว่าเทสต์ด้านบนตรวจคอลัมน์นี้จริง)
    const wrong = columns.map((column) => (column === 'availability' ? 'มือสองนะ' : ''));
    const bad = parsePartsCsv(`${header}\n${wrong.join(',')}`, 'cpu', new Map());
    const badErrors = bad.ok ? bad.rows.flatMap((row) => (row.ok ? [] : row.errors)) : [];
    expect(badErrors.some((error) => error.includes('availability'))).toBe(true);
  });
});
