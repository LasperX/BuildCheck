import { describe, expect, it } from 'vitest';

import { compareBuilds, uniqueBest } from '@/lib/builder/compare';
import { checkBuild, type EngineItem } from '@/lib/compat';
import { parseCompareIds } from '@/lib/validators/community';

import { cpu, gpu, item, motherboard, psu, ram } from '../compat/fixtures';

// อะไหล่สมมติจาก fixtures ไม่ใช่สเปกหรือราคาจริง

const build = (items: EngineItem[]) => ({ items, result: checkBuild({ items }) });

describe('uniqueBest', () => {
  it('เลือกค่าที่ดีที่สุดเมื่อไม่เสมอ', () => {
    expect(uniqueBest([10, 30, 20], 'higher')).toBe(1);
    expect(uniqueBest([10, 30, 20], 'lower')).toBe(0);
  });

  it('เสมอกันหรือมีค่าเดียวไม่ให้ใคร', () => {
    expect(uniqueBest([30, 30, 20], 'higher')).toBeNull();
    expect(uniqueBest([30, null], 'higher')).toBeNull();
  });
});

describe('compareBuilds', () => {
  const board = motherboard();
  const fast = cpu({ perfScore: 80 }, 9000);
  const slow = cpu({ perfScore: 50 }, 5000);
  const card = gpu();
  const a = build([item(fast), item(board), item(card), item(ram(), 2)]);
  const b = build([item(slow), item(board), item(card), item(ram())]);

  it('ไฮไลต์หมวดที่ต่างกัน และไม่ไฮไลต์หมวดที่เหมือนกัน', () => {
    const { rows } = compareBuilds([a, b]);
    const row = (cat: string) => rows.find((r) => r.category === cat);
    expect(row('cpu')?.differs).toBe(true);
    expect(row('motherboard')?.differs).toBe(false);
    expect(row('gpu')?.differs).toBe(false);
    expect(row('ram')?.differs).toBe(true);
  });

  it('บอกว่าชุดไหนแรงกว่าในแต่ละหมวด (CPU = คะแนน · แรม = ความจุรวม)', () => {
    const { rows } = compareBuilds([a, b]);
    expect(rows.find((r) => r.category === 'cpu')?.best).toBe(0);
    // ชุด a ใส่แรม 2 ชุด = 64 GB · ชุด b = 32 GB
    expect(rows.find((r) => r.category === 'ram')?.cells.map((c) => c.metric)).toEqual([64, 32]);
    expect(rows.find((r) => r.category === 'ram')?.best).toBe(0);
    // การ์ดจอรุ่นเดียวกัน เสมอ ไม่ให้ใคร
    expect(rows.find((r) => r.category === 'gpu')?.best).toBeNull();
    // เมนบอร์ดไม่มีตัวเลขเทียบความแรง
    expect(rows.find((r) => r.category === 'motherboard')?.metricLabel).toBeNull();
  });

  it('ไม่แสดงหมวดที่ไม่มีชุดไหนเลือก และหมวดที่ชุดเดียวเลือกเทียบความแรงไม่ได้', () => {
    const c = build([item(slow), item(psu())]);
    const { rows } = compareBuilds([b, c]);
    expect(rows.some((r) => r.category === 'case')).toBe(false);
    expect(rows.find((r) => r.category === 'psu')?.best).toBeNull();
  });

  it('สรุปราคาถูกกว่าและคะแนนสูงกว่า', () => {
    const { totals } = compareBuilds([a, b]);
    const price = totals.find((t) => t.key === 'price');
    const score = totals.find((t) => t.key === 'score');
    expect(price?.best).toBe(1);
    expect(score?.best).toBe(0);
  });
});

describe('parseCompareIds', () => {
  it('ตัดรหัสผิดรูปแบบและรหัสซ้ำ เก็บไม่เกิน 3 ชุด', () => {
    expect(parseCompareIds('aaaaaaaaaa,bad,aaaaaaaaaa,bbbbbbbbbb,cccccccccc,dddddddddd')).toEqual([
      'aaaaaaaaaa',
      'bbbbbbbbbb',
      'cccccccccc',
    ]);
    expect(parseCompareIds(undefined)).toEqual([]);
  });
});
