import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BOM,
  csvHeaderFor,
  type CsvExportPart,
  parsePartsCsv,
  partsToCsv,
  specCsvValue,
} from '@/lib/parts/csv';
import { CATEGORY_SLUGS, type CategorySlug, SPEC_FIELDS } from '@/lib/parts/spec-fields';
import type { PartInput } from '@/lib/validators/parts';

// ส่งออกอะไหล่เป็น CSV: ไฟล์ที่ส่งออกต้องนำเข้ากลับได้ค่าเดิมทุกช่อง (ใช้เป็นไฟล์สำรองและแก้ราคาหลายรุ่นใน Excel)

const field = (category: CategorySlug, key: string) => {
  const found = SPEC_FIELDS[category].find((f) => f.key === key);
  if (!found) throw new Error(`ไม่มีช่อง ${key}`);
  return found;
};

const asExport = (input: PartInput, brandName: string): CsvExportPart => ({
  brandName,
  model: input.model,
  price: input.price,
  releaseYear: input.releaseYear,
  powerWatt: input.powerWatt,
  imageUrl: input.imageUrl,
  specSourceUrl: input.specSourceUrl,
  specVerified: input.specVerified,
  availability: input.availability,
  spec: input.spec as Record<string, unknown>,
});

const validInputs = (result: ReturnType<typeof parsePartsCsv>) =>
  result.ok ? result.rows.flatMap((row) => (row.ok ? [row.input] : [])) : [];

describe('specCsvValue', () => {
  it('แปลงค่าจากฐานข้อมูลเป็นข้อความในไฟล์ รูปแบบเดียวกับไฟล์นำเข้า', () => {
    expect(specCsvValue(field('cpu', 'hasIgpu'), true)).toBe('true');
    expect(specCsvValue(field('cpu', 'includesCooler'), false)).toBe('false');
    expect(specCsvValue(field('gpu', 'powerConnectors'), { '8pin': 2, '16pin': 1 })).toBe(
      '8pin:2|16pin:1',
    );
    expect(specCsvValue(field('cpu', 'memoryTypes'), ['DDR4', 'DDR5'])).toBe('DDR4|DDR5');
    expect(specCsvValue(field('case', 'radiatorSupportMm'), [240, 360])).toBe('240|360');
    // ตัวเลขทศนิยมจากฐานข้อมูลมาเป็นข้อความ "3.70" ส่งออกเป็น 3.7
    expect(specCsvValue(field('cpu', 'baseClockGhz'), '3.70')).toBe('3.7');
    expect(specCsvValue(field('cpu', 'baseClockGhz'), null)).toBe('');
  });
});

describe('partsToCsv', () => {
  it.each(CATEGORY_SLUGS)(
    'หมวด %s: ส่งออกไฟล์ตัวอย่างแล้วนำเข้ากลับได้ค่าเดิมทุกช่อง',
    (category) => {
      const text = readFileSync(
        path.join(process.cwd(), 'src', 'db', 'seed', 'csv', `${category}.csv`),
        'utf8',
      );
      // ยี่ห้อในไฟล์ตัวอย่างทุกชื่อ → รหัสสมมติ
      const names = [
        ...new Set(
          text
            .split(/\r?\n/)
            .slice(1)
            .filter(Boolean)
            .map((line) => line.split(',')[0]?.trim() ?? ''),
        ),
      ];
      const brandIds = new Map(names.map((name, index) => [name.toLowerCase(), index + 1]));
      const brandNames = new Map(names.map((name, index) => [index + 1, name]));

      const original = validInputs(parsePartsCsv(text, category, brandIds));
      expect(original.length).toBeGreaterThan(0);

      const exported = partsToCsv(
        category,
        original.map((input) => asExport(input, brandNames.get(input.brandId) ?? '')),
      );
      expect(exported.startsWith(BOM)).toBe(true);
      expect(exported.slice(BOM.length).split('\r\n')[0]).toBe(csvHeaderFor(category).join(','));

      const again = parsePartsCsv(exported, category, brandIds);
      expect(again.ok && again.errorCount).toBe(0);
      expect(validInputs(again)).toEqual(original);
    },
  );

  it('ชื่อรุ่นที่มีจุลภาคและเครื่องหมายคำพูด ใส่เครื่องหมายคำพูดครอบให้ Excel อ่านถูก และนำเข้ากลับได้ตรง', () => {
    const part: CsvExportPart = {
      brandName: 'MSI',
      model: 'GeForce "Test", 8G',
      price: 12900,
      releaseYear: 2024,
      powerWatt: null,
      imageUrl: null,
      specSourceUrl: 'https://example.test/spec',
      specVerified: false,
      availability: 'used_only',
      spec: {
        chipset: 'Test Chip',
        vramGb: 8,
        lengthMm: 240,
        slotWidth: '2.5',
        tbpWatt: 160,
        powerConnectors: { '8pin': 1 },
        perfScore: 50,
      },
    };
    const exported = partsToCsv('gpu', [part]);
    expect(exported).toContain('"GeForce ""Test"", 8G"');
    expect(exported).toContain('มีแต่มือสอง');
    expect(exported).toContain('รอตรวจสอบ');

    const parsed = parsePartsCsv(exported, 'gpu', new Map([['msi', 7]]));
    const [input] = validInputs(parsed);
    expect(input).toMatchObject({
      brandId: 7,
      model: 'GeForce "Test", 8G',
      price: 12900,
      availability: 'used_only',
      specVerified: false,
      spec: { slotWidth: 2.5, powerConnectors: { '8pin': 1 } },
    });
  });
});
