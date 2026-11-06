import { describe, expect, it } from 'vitest';

import { newBuildId } from '@/lib/builder/build-id';
import { rankCandidates } from '@/lib/builder/candidates';
import { canViewBuild } from '@/lib/builder/permissions';
import { type BuilderPart, encodeBuildParam } from '@/lib/builder/types';
import type { EnginePart } from '@/lib/compat';
import {
  buildIdSchema,
  buildParamSchema,
  candidatesQuerySchema,
  saveBuildSchema,
} from '@/lib/validators/builds';

import { cpu, item, motherboard, ram } from '../compat/fixtures';

// อะไหล่สมมติ ไม่ใช่สเปกจริง

const asBuilder = (part: EnginePart, extra: Partial<BuilderPart> = {}): BuilderPart =>
  ({
    ...part,
    slug: `part-${part.id}`,
    brandId: 1,
    imageUrl: null,
    isActive: true,
    specVerified: false,
    chips: [],
    uses: 0,
    ...extra,
  }) as BuilderPart;

const query = (raw: Record<string, unknown>) => candidatesQuerySchema.parse(raw);

describe('rankCandidates (ตัวกรองอัจฉริยะ)', () => {
  const am5 = asBuilder(motherboard({ socket: 'AM5' }, { price: 4000 }), { uses: 5 });
  const lga = asBuilder(motherboard({ socket: 'LGA1700' }, { price: 3000 }), { uses: 9 });
  const all = [am5, lga];
  const current = [item(cpu({ socket: 'AM5' }))];

  it('เปิดกรองอัจฉริยะแล้วซ่อนรุ่นที่ใส่ไม่ได้ และนับจำนวนที่ซ่อน', () => {
    const result = rankCandidates(all, current, query({ category: 'motherboard', smart: '1' }));
    expect(result.items.map((part) => part.id)).toEqual([am5.id]);
    expect(result.hidden).toBe(1);
    expect(result.total).toBe(1);
  });

  it('ปิดกรองอัจฉริยะแล้วแสดงทั้งหมด รุ่นที่ใส่ไม่ได้มีป้ายเหตุผล และเรียงไว้ท้าย', () => {
    const result = rankCandidates(all, current, query({ category: 'motherboard', smart: '0' }));
    // LGA ได้รับความนิยมกว่า แต่ใส่ไม่ได้จึงอยู่หลัง
    expect(result.items.map((part) => part.id)).toEqual([am5.id, lga.id]);
    expect(result.items[0].issue).toBeNull();
    expect(result.items[1]).toMatchObject({ compatible: false, issue: { code: 'R01' } });
    // ไม่ส่งสเปกเต็มของทุกชิ้นไปเบราว์เซอร์
    expect('spec' in result.items[0]).toBe(false);
  });

  it('โหมดแก้ปัญหา: แสดงรุ่นที่แก้ปัญหาได้ แม้ยังมีปัญหาเดิมอื่นค้างอยู่', () => {
    const oldBoard = motherboard({ socket: 'LGA1700', memoryType: 'DDR5' });
    const build = [item(cpu({ socket: 'AM5' })), item(oldBoard), item(ram({ type: 'DDR4' }))];
    const ddr5 = asBuilder(motherboard({ socket: 'AM5', memoryType: 'DDR5' }));
    const params = { category: 'motherboard', smart: '1', replace: String(oldBoard.id) };

    // โหมดปกติ: บอร์ด AM5 ชนกับแรม DDR4 จึงถูกซ่อน
    expect(rankCandidates([ddr5], build, query(params)).items).toHaveLength(0);
    // โหมดแก้ R01: R04 มีอยู่แล้วกับบอร์ดเดิม ไม่นับเป็นปัญหาใหม่
    const fixed = rankCandidates([ddr5, lga], build, query({ ...params, fix: 'R01' }));
    expect(fixed.items.map((part) => part.id)).toEqual([ddr5.id]);
  });

  it('CPU ไม่มีกราฟิกในตัวไม่ถูกซ่อน แต่แสดงเป็นข้อควรรู้ระดับข้อมูล', () => {
    const noIgpu = asBuilder(cpu({ hasIgpu: false }));
    const result = rankCandidates([noIgpu], [], query({ category: 'cpu', smart: '1' }));
    expect(result.items[0]).toMatchObject({
      compatible: true,
      issue: { code: 'R18', level: 'info' },
    });
  });

  it('กรองคำค้น ยี่ห้อ ช่วงราคา และสเปกเฉพาะหมวด', () => {
    const other = asBuilder(motherboard({ socket: 'AM5', formFactor: 'ITX' }, { price: 9000 }), {
      brandId: 2,
      model: 'ITX พิเศษ',
    });
    const parts = [am5, lga, other];
    const run = (raw: Record<string, unknown>) =>
      rankCandidates(parts, [], query({ category: 'motherboard', ...raw })).items.map((p) => p.id);
    expect(run({ q: 'itx พิเศษ' })).toEqual([other.id]);
    expect(run({ brand: ['2'] })).toEqual([other.id]);
    expect(run({ max: '3500' })).toEqual([lga.id]);
    expect(run({ spec: { socket: ['AM5'] } }).sort()).toEqual([am5.id, other.id].sort());
    // คอลัมน์ที่ไม่อยู่ในรายการตัวกรองที่อนุญาตถูกข้าม
    expect(run({ spec: { maxMemoryGb: ['1'] } })).toHaveLength(3);
  });

  it('เรียงราคาใกล้เคียงที่สุด และแบ่งหน้าละ 24 ชิ้น', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      asBuilder(motherboard({}, { price: 1000 + i * 100 })),
    );
    const near = rankCandidates(
      many,
      [],
      query({ category: 'motherboard', sort: 'near', near: '2050' }),
    );
    expect(near.items.slice(0, 2).map((p) => p.price)).toEqual([2000, 2100]);
    expect(near.items).toHaveLength(24);
    const page2 = rankCandidates(many, [], query({ category: 'motherboard', page: '2' }));
    expect(page2.items).toHaveLength(6);
    expect(page2.total).toBe(30);
  });
});

describe('ตัวตรวจค่าของสเปก', () => {
  it('อ่านพารามิเตอร์ build=12x1,15x2 และปฏิเสธรูปแบบผิด', () => {
    expect(buildParamSchema.parse('12x1,15x2')).toEqual([
      { partId: 12, quantity: 1 },
      { partId: 15, quantity: 2 },
    ]);
    expect(buildParamSchema.parse('')).toEqual([]);
    expect(buildParamSchema.safeParse('12x1;DROP').success).toBe(false);
    expect(buildParamSchema.safeParse('abc').success).toBe(false);
    expect(encodeBuildParam([{ partId: 3, quantity: 2 }])).toBe('3x2');
  });

  it('รหัสกฎใน fix ต้องเป็น R01–R18 เท่านั้น', () => {
    expect(query({ category: 'cpu', fix: 'R18' }).fix).toBe('R18');
    expect(candidatesQuerySchema.safeParse({ category: 'cpu', fix: 'R19' }).success).toBe(false);
    expect(candidatesQuerySchema.safeParse({ category: 'cpu', fix: 'I01' }).success).toBe(false);
  });

  it('บันทึกสเปก: ปฏิเสธอะไหล่ซ้ำ ชื่อว่าง จำนวนเกิน และงบติดลบ', () => {
    const base = {
      title: 'สเปกทดสอบ',
      description: '',
      usageType: 'gaming',
      budget: null,
      items: [{ partId: 1, quantity: 1 }],
    };
    expect(saveBuildSchema.safeParse(base).success).toBe(true);
    const fails = [
      {
        items: [
          { partId: 1, quantity: 1 },
          { partId: 1, quantity: 2 },
        ],
      },
      { title: '   ' },
      { items: [{ partId: 1, quantity: 99 }] },
      { budget: -1 },
      { id: '../../etc' },
      { usageType: 'mining' },
    ];
    for (const patch of fails) {
      expect(saveBuildSchema.safeParse({ ...base, ...patch }).success).toBe(false);
    }
  });
});

describe('รหัสสเปกและสิทธิ์', () => {
  it('รหัสยาว 10 ตัว ใช้เฉพาะตัวอักษรที่ไม่สับสน และไม่ซ้ำกัน', () => {
    const ids = Array.from({ length: 2000 }, () => newBuildId());
    for (const id of ids.slice(0, 50)) {
      expect(buildIdSchema.safeParse(id).success).toBe(true);
      expect(id).not.toMatch(/[0O1lI]/);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('สเปกส่วนตัวเห็นเฉพาะเจ้าของและแอดมิน ส่วนแบบมีลิงก์และสาธารณะเห็นทุกคน', () => {
    const build = { userId: 'u1', visibility: 'private' as const };
    expect(canViewBuild(build, { id: 'u1' })).toBe(true);
    expect(canViewBuild(build, { id: 'u2', role: 'admin' })).toBe(true);
    expect(canViewBuild(build, { id: 'u2', role: 'user' })).toBe(false);
    expect(canViewBuild(build, null)).toBe(false);
    expect(canViewBuild({ ...build, visibility: 'unlisted' }, null)).toBe(true);
    expect(canViewBuild({ ...build, visibility: 'public' }, undefined)).toBe(true);
  });
});
