import { describe, expect, it } from 'vitest';

import {
  bulkConditionUpdates,
  conditionForNewPart,
  impossibleConditionFixes,
} from '@/lib/builder/conditions';
import {
  calculatePrice,
  DEFAULT_SETTINGS,
  effectiveCondition,
  type EngineItem,
  type EnginePart,
  unitPrice,
} from '@/lib/compat';
import { applyUsedPrices } from '@/lib/compat/budget';
import { buildContext } from '@/lib/compat/context';

import { cpu, gpu, psu } from './fixtures';

// อะไหล่ที่ "มีแต่มือสอง" และทางลัดมือสองทั้งชุด (ค่าสมมติ ไม่ใช่สเปกหรือราคาจริง)

const usedOnly = <T extends EnginePart>(part: T): T => ({ ...part, availability: 'used_only' });

describe('effectiveCondition', () => {
  it('ชิ้นที่มีแต่มือสองตั้งเป็นมือหนึ่ง → มือสองเกรด B', () => {
    expect(effectiveCondition(usedOnly(gpu({}, 9000)), 'new')).toBe('B');
    expect(effectiveCondition(usedOnly(gpu({}, 9000)), 'C')).toBe('C');
  });
  it('ชิ้นที่ยังขายมือหนึ่ง และข้อมูลเก่าที่ไม่มีช่อง availability ไม่เปลี่ยน', () => {
    expect(effectiveCondition(gpu({}, 9000), 'new')).toBe('new');
    expect(effectiveCondition({ availability: 'new' }, 'new')).toBe('new');
  });
});

describe('ราคา', () => {
  it('ชิ้นที่มีแต่มือสองไม่ใช้ราคาตอนเปิดตัวเป็นราคาซื้อ', () => {
    const part = usedOnly(gpu({}, 20000));
    const item: EngineItem = { part, quantity: 1, condition: 'new', usedPrice: 6000 };
    expect(unitPrice(item)).toBe(6000);
  });

  it('ไม่นับเป็น "ประหยัดกว่าซื้อใหม่" เพราะซื้อใหม่ไม่ได้', () => {
    const items: EngineItem[] = [
      { part: usedOnly(gpu({}, 20000)), quantity: 1, condition: 'B', usedPrice: 6000 },
      { part: cpu({}, 8000), quantity: 1, condition: 'B', usedPrice: 5000 },
    ];
    const price = calculatePrice(buildContext(items, DEFAULT_SETTINGS));
    expect(price.total).toBe(11000);
    // totalNew = ราคามือสองของการ์ดจอ (ซื้อใหม่ไม่ได้) + ราคาใหม่ของ CPU
    expect(price.totalNew).toBe(14000);
    expect(price.saved).toBe(3000);
  });
});

describe('จัดตามงบ: applyUsedPrices', () => {
  const legacyGpu = usedOnly(gpu({ perfScore: 40 }, 15000));
  const newGpu = gpu({ perfScore: 50 }, 12000);

  it('ไม่ยอมมือสอง → ตัดรุ่นที่มีแต่มือสองออก', () => {
    const { catalog } = applyUsedPrices([legacyGpu, newGpu], undefined);
    expect(catalog.map((part) => part.id)).toEqual([newGpu.id]);
  });

  it('ยอมมือสองแต่ไม่มีราคากลางมือสอง → ตัดออก', () => {
    const { catalog } = applyUsedPrices([legacyGpu, newGpu], {
      categories: ['gpu'],
      grade: 'B',
      prices: {},
    });
    expect(catalog.map((part) => part.id)).toEqual([newGpu.id]);
  });

  it('ยอมมือสองในหมวดอื่น ไม่ใช่การ์ดจอ → ตัดออก', () => {
    const { catalog } = applyUsedPrices([legacyGpu, newGpu], {
      categories: ['cpu'],
      grade: 'B',
      prices: { [legacyGpu.id]: 5000 },
    });
    expect(catalog.map((part) => part.id)).toEqual([newGpu.id]);
  });

  it('ยอมมือสองและมีราคากลาง → ใช้ราคามือสองเสมอ แม้แพงกว่าราคาตอนเปิดตัว และคืนเป็นมือสอง', () => {
    const { catalog, restore } = applyUsedPrices([legacyGpu, newGpu], {
      categories: ['gpu'],
      grade: 'B',
      prices: { [legacyGpu.id]: 16000 },
    });
    const priced = catalog.find((part) => part.id === legacyGpu.id);
    expect(priced?.price).toBe(16000);
    const [item] = restore([{ part: priced!, quantity: 1, condition: 'new' }]);
    expect(item?.condition).toBe('B');
    expect(item?.part.price).toBe(15000);
    expect(item?.usedPrice).toBe(16000);
  });
});

describe('สภาพของชิ้นที่เพิ่มใหม่ (conditionForNewPart)', () => {
  it('ค่าตั้งต้นมือหนึ่ง: ชิ้นทั่วไปเป็นมือหนึ่ง รุ่นที่มีแต่มือสองเป็นเกรด B', () => {
    expect(conditionForNewPart(gpu({}, 1), 'new')).toBe('new');
    expect(conditionForNewPart(usedOnly(gpu({}, 1)), 'new')).toBe('B');
  });
  it('ค่าตั้งต้นมือสอง: ใช้เกรดที่ตั้ง ยกเว้น PSU ที่ยังเป็นมือหนึ่ง', () => {
    expect(conditionForNewPart(gpu({}, 1), 'A')).toBe('A');
    expect(conditionForNewPart(psu({}, 1), 'C')).toBe('new');
    expect(conditionForNewPart(usedOnly(psu({}, 1)), 'C')).toBe('C');
  });
});

describe('เปลี่ยนทั้งชุด (bulkConditionUpdates)', () => {
  const g = gpu({}, 1);
  const c = cpu({}, 1);
  const p = psu({}, 1);
  const legacy = usedOnly(gpu({}, 1));
  const parts = new Map<number, EnginePart>([g, c, p, legacy].map((part) => [part.id, part]));

  it('เป็นมือสองทั้งชุด: เปลี่ยนทุกชิ้นยกเว้น PSU และไม่ส่งชิ้นที่เป็นเกรดนั้นอยู่แล้ว', () => {
    const updates = bulkConditionUpdates(
      [
        { partId: g.id, condition: 'new' },
        { partId: c.id, condition: 'B' },
        { partId: p.id, condition: 'new' },
      ],
      parts,
      'B',
    );
    expect(updates).toEqual({ [g.id]: 'B' });
  });

  it('เป็นมือหนึ่งทั้งชุด: ข้ามรุ่นที่มีแต่มือสอง', () => {
    const updates = bulkConditionUpdates(
      [
        { partId: g.id, condition: 'A' },
        { partId: legacy.id, condition: 'A' },
      ],
      parts,
      'new',
    );
    expect(updates).toEqual({ [g.id]: 'new' });
  });

  it('impossibleConditionFixes แก้เฉพาะรุ่นที่มีแต่มือสองที่ตั้งเป็นมือหนึ่ง', () => {
    expect(
      impossibleConditionFixes(
        [
          { partId: legacy.id, condition: 'new' },
          { partId: g.id, condition: 'new' },
        ],
        parts,
      ),
    ).toEqual({ [legacy.id]: 'B' });
  });
});
