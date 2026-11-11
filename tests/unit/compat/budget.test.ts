import { describe, expect, it } from 'vitest';

import {
  allocate,
  applyUsedPrices,
  DEFAULT_USED_CATEGORIES,
  DEFAULT_BUDGET_RATIOS,
  generateBudgetBuilds,
  itemsKey,
  MIN_RAM_GB,
} from '@/lib/compat/budget';
import type { EngineItem, EnginePart } from '@/lib/compat';

import { cooler, cpu, gpu, motherboard, pcCase, psu, ram, storage } from './fixtures';

// แคตตาล็อกสมมติสำหรับทดสอบอัลกอริทึม ไม่ใช่สเปกหรือราคาจริง

const brand = <T extends EnginePart>(part: T, brandName: string): T => ({ ...part, brandName });

function catalog(): EnginePart[] {
  return [
    brand(
      cpu(
        { socket: 'AM5', generation: 'Gen-A', hasIgpu: true, includesCooler: true, perfScore: 50 },
        5000,
      ),
      'AMD',
    ),
    brand(
      cpu(
        {
          socket: 'AM5',
          generation: 'Gen-A',
          tdpWatt: 105,
          hasIgpu: false,
          includesCooler: false,
          perfScore: 80,
        },
        9000,
      ),
      'AMD',
    ),
    brand(
      cpu(
        {
          socket: 'LGA1700',
          generation: 'Gen-B',
          hasIgpu: true,
          includesCooler: true,
          perfScore: 45,
          memoryTypes: ['DDR4'],
        },
        4000,
      ),
      'Intel',
    ),
    motherboard({ socket: 'AM5', supportedGenerations: ['Gen-A'] }, { price: 4000 }),
    motherboard({ socket: 'AM5', supportedGenerations: ['Gen-A'], m2Slots: 0 }, { price: 2000 }),
    motherboard(
      {
        socket: 'LGA1700',
        formFactor: 'mATX',
        memoryType: 'DDR4',
        memorySlots: 2,
        maxMemoryGb: 64,
        maxMemorySpeed: 3200,
        m2Slots: 1,
        supportedGenerations: ['Gen-B'],
      },
      { price: 2500 },
    ),
    ram({ type: 'DDR5', capacityPerStickGb: 16, sticksInKit: 2, speedMts: 6000 }, 2400),
    ram({ type: 'DDR5', capacityPerStickGb: 16, sticksInKit: 1, speedMts: 5600 }, 1300),
    ram({ type: 'DDR5', capacityPerStickGb: 32, sticksInKit: 2, speedMts: 6000 }, 4500),
    ram({ type: 'DDR4', capacityPerStickGb: 8, sticksInKit: 2, speedMts: 3200 }, 1200),
    gpu({ lengthMm: 230, tbpWatt: 130, perfScore: 40, powerConnectors: { none: 1 } }, 7000),
    gpu({ lengthMm: 300, tbpWatt: 220, perfScore: 66, powerConnectors: { '8pin': 1 } }, 12000),
    gpu({ lengthMm: 340, tbpWatt: 350, perfScore: 92, powerConnectors: { '8pin': 2 } }, 24000),
    storage({ type: 'NVMe', interface: 'M2', capacityGb: 1000 }, 1500),
    storage({ type: 'NVMe', interface: 'M2', capacityGb: 2000 }, 2800),
    storage({ type: 'SATA_SSD', interface: 'SATA', capacityGb: 500 }, 900),
    psu({ wattage: 450, pcieConnectors: { '8pin': 1 } }, 1200),
    psu({ wattage: 650, pcieConnectors: { '8pin': 2 } }, 2000),
    psu({ wattage: 850, pcieConnectors: { '8pin': 3 } }, 3200),
    pcCase({ supportedFormFactors: ['ATX', 'mATX', 'ITX'], maxGpuLengthMm: 350 }, 1500),
    pcCase({ supportedFormFactors: ['mATX', 'ITX'], maxGpuLengthMm: 300 }, 1100),
    cooler(
      { type: 'air', supportedSockets: ['AM5', 'LGA1700'], heightMm: 155, maxTdpWatt: 180 },
      500,
    ),
    cooler(
      {
        type: 'aio',
        supportedSockets: ['AM5', 'LGA1700'],
        heightMm: null,
        radiatorMm: 240,
        maxTdpWatt: 250,
      },
      3200,
    ),
  ];
}

const total = (items: EngineItem[]) =>
  items.reduce((sum, item) => sum + item.part.price * item.quantity, 0);
const pick = (items: EngineItem[], cat: string) =>
  items.find((item) => item.part.categorySlug === cat);

describe('สัดส่วนงบ (4.5)', () => {
  it('ทุกประเภทการใช้งานรวมได้ 100% พอดี (ออฟฟิศใช้การ์ดจอ 5% ระบายความร้อน 5% ตามมติ Q3)', () => {
    for (const ratios of Object.values(DEFAULT_BUDGET_RATIOS)) {
      const sum = Object.values(ratios).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
    expect(DEFAULT_BUDGET_RATIOS.office.gpu).toBe(0.05);
  });

  it('แบ่งงบเป็นบาทตามสัดส่วน', () => {
    const alloc = allocate(30000, DEFAULT_BUDGET_RATIOS.gaming);
    expect(alloc.gpu).toBe(12000);
    expect(alloc.cpu).toBe(6000);
    expect(alloc.cooler).toBe(900);
  });
});

describe('generateBudgetBuilds', () => {
  it('งบ 40,000 เล่นเกม: ได้ 3 ตัวเลือก ทุกชุดไม่มีปัญหาระดับผิดพลาดและไม่เกินงบ', () => {
    const result = generateBudgetBuilds({ budget: 40000, usage: 'gaming', catalog: catalog() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.options.map((o) => o.kind)).toEqual(['economy', 'balanced', 'value']);
    for (const option of result.options) {
      expect(option.result.status).not.toBe('error');
      expect(option.result.price.total).toBeLessThanOrEqual(40000);
      // ครบหมวดจำเป็น และมีการ์ดจอเพราะเป็นเล่นเกม
      for (const cat of ['cpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'gpu']) {
        expect(pick(option.items, cat)).toBeDefined();
      }
    }
    const [economy, balanced] = result.options;
    expect(economy.result.price.total).toBeLessThanOrEqual(34000); // 85%
    expect(balanced.result.score.score).toBeGreaterThanOrEqual(economy.result.score.score);
  });

  it('ตัวเลือกคุ้มสุดมีความคุ้มค่าไม่ต่ำกว่าอีกสองตัวเลือก', () => {
    const result = generateBudgetBuilds({ budget: 40000, usage: 'gaming', catalog: catalog() });
    if (!result.ok) throw new Error('ควรจัดได้');
    const [economy, balanced, value] = result.options;
    expect(value.result.score.value).toBeGreaterThanOrEqual(economy.result.score.value);
    expect(value.result.score.value).toBeGreaterThanOrEqual(balanced.result.score.value);
  });

  it('ลดรุ่นเมื่อเกินงบ: งบ 30,000 ไม่ได้การ์ดจอ 24,000 บาท', () => {
    const result = generateBudgetBuilds({ budget: 30000, usage: 'gaming', catalog: catalog() });
    if (!result.ok) throw new Error('ควรจัดได้');
    const balanced = result.options[1];
    expect(total(balanced.items)).toBeLessThanOrEqual(30000);
    expect(pick(balanced.items, 'gpu')?.part.price).toBeLessThan(24000);
  });

  it('อัปเกรดเมื่อเหลืองบ: งบสูงได้การ์ดจอตัวแรงสุด', () => {
    const result = generateBudgetBuilds({ budget: 60000, usage: 'gaming', catalog: catalog() });
    if (!result.ok) throw new Error('ควรจัดได้');
    expect(pick(result.options[1].items, 'gpu')?.part.price).toBe(24000);
  });

  it('ออฟฟิศ: เลือก CPU ที่มีกราฟิกในตัวและไม่ซื้อการ์ดจอ', () => {
    const result = generateBudgetBuilds({ budget: 20000, usage: 'office', catalog: catalog() });
    if (!result.ok) throw new Error('ควรจัดได้');
    const balanced = result.options[1].items;
    expect(pick(balanced, 'gpu')).toBeUndefined();
    const chosen = pick(balanced, 'cpu')?.part;
    expect(chosen?.categorySlug === 'cpu' && chosen.spec.hasIgpu).toBe(true);
  });

  it('ตัดต่อ: แรมอย่างน้อย 32 GB', () => {
    const result = generateBudgetBuilds({ budget: 45000, usage: 'creator', catalog: catalog() });
    if (!result.ok) throw new Error('ควรจัดได้');
    const r = pick(result.options[1].items, 'ram');
    const gb =
      r && r.part.categorySlug === 'ram'
        ? r.part.spec.capacityPerStickGb * r.part.spec.sticksInKit * r.quantity
        : 0;
    expect(gb).toBeGreaterThanOrEqual(MIN_RAM_GB.creator.min);
  });

  it('เลือกยี่ห้อ CPU ได้ และถ้าไม่มียี่ห้อนั้นใช้ทุกยี่ห้อพร้อมแจ้ง', () => {
    const intel = generateBudgetBuilds({
      budget: 30000,
      usage: 'gaming',
      cpuBrand: 'intel',
      catalog: catalog(),
    });
    if (!intel.ok) throw new Error('ควรจัดได้');
    for (const option of intel.options) {
      expect(pick(option.items, 'cpu')?.part.brandName).toBe('Intel');
    }
    const unknown = generateBudgetBuilds({
      budget: 30000,
      usage: 'gaming',
      cpuBrand: 'ไม่มียี่ห้อนี้',
      catalog: catalog(),
    });
    expect(unknown.ok && unknown.brandFallback).toBe(true);
  });

  it('CPU ไม่มีพัดลมแถมได้ชุดระบายความร้อนที่เข้ากัน', () => {
    const result = generateBudgetBuilds({ budget: 60000, usage: 'creator', catalog: catalog() });
    if (!result.ok) throw new Error('ควรจัดได้');
    for (const option of result.options) {
      const c = pick(option.items, 'cpu')?.part;
      if (c?.categorySlug === 'cpu' && !c.spec.includesCooler) {
        expect(pick(option.items, 'cooler')).toBeDefined();
      }
    }
  });

  it('งบไม่พอ: บอกงบขั้นต่ำปัดขึ้นหลักพัน และกดจัดด้วยงบนั้นได้จริง', () => {
    // ชุดถูกสุดที่เข้ากันได้ = 4,000 + 7,000 + 2,500 + 1,200 + 1,500 + 1,200 + 1,100 = 18,500
    const result = generateBudgetBuilds({ budget: 10000, usage: 'gaming', catalog: catalog() });
    expect(result).toMatchObject({ ok: false, minimumBudget: 19000 });
    if (result.ok || !result.minimumBudget) return;
    const retry = generateBudgetBuilds({
      budget: result.minimumBudget,
      usage: 'gaming',
      catalog: catalog(),
    });
    expect(retry.ok).toBe(true);
    // งบต่ำกว่านั้น 1,000 บาทยังจัดไม่ได้
    const below = generateBudgetBuilds({
      budget: result.minimumBudget - 1000,
      usage: 'gaming',
      catalog: catalog(),
    });
    expect(below.ok).toBe(false);
  });

  it('ใช้ SSD NVMe เสมอเมื่อในระบบมี แม้ตัวเลือกที่ลดรุ่นลงมาแล้ว', () => {
    for (const budget of [20000, 30000, 40000]) {
      const result = generateBudgetBuilds({ budget, usage: 'gaming', catalog: catalog() });
      if (!result.ok) throw new Error('ควรจัดได้');
      for (const option of result.options) {
        const s = pick(option.items, 'storage')?.part;
        expect(s?.categorySlug === 'storage' && s.spec.type).toBe('NVMe');
      }
    }
  });

  it('ไม่มีอะไหล่ในระบบเลย: งบขั้นต่ำเป็น null', () => {
    const result = generateBudgetBuilds({ budget: 50000, usage: 'gaming', catalog: [] });
    expect(result).toMatchObject({ ok: false, minimumBudget: null });
  });

  it('ใช้เวลาไม่นาน (ไม่เกิน 2 วินาที) กับแคตตาล็อกหมวดละหลายสิบชิ้น', () => {
    const big = Array.from({ length: 8 }, () => catalog()).flat();
    const start = performance.now();
    const result = generateBudgetBuilds({ budget: 45000, usage: 'gaming', catalog: big });
    expect(result.ok).toBe(true);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe('ยอมใช้มือสอง', () => {
  const parts = catalog();
  // ราคามือสองสมมติ = 60% ของราคาใหม่ ทุกชิ้น
  const prices = Object.fromEntries(parts.map((part) => [part.id, Math.round(part.price * 0.6)]));

  it('applyUsedPrices ไม่แตะหมวดที่ไม่ยอม และคืนชิ้นตัวจริงพร้อมสภาพมือสอง', () => {
    const gpuPart = parts.find((part) => part.categorySlug === 'gpu');
    const psuPart = parts.find((part) => part.categorySlug === 'psu');
    if (!gpuPart || !psuPart) throw new Error('fixture');
    const { catalog: priced, restore } = applyUsedPrices(parts, {
      categories: ['gpu'],
      grade: 'B',
      prices,
    });
    expect(priced.find((p) => p.id === gpuPart.id)?.price).toBe(prices[gpuPart.id]);
    expect(priced.find((p) => p.id === psuPart.id)?.price).toBe(psuPart.price);
    const cheapGpu = priced.find((p) => p.id === gpuPart.id);
    if (!cheapGpu) throw new Error('fixture');
    const [restored] = restore([{ part: cheapGpu, quantity: 1, condition: 'new' }]);
    expect(restored).toMatchObject({ condition: 'B', usedPrice: prices[gpuPart.id] });
    expect(restored?.part.price).toBe(gpuPart.price);
  });

  it('ราคามือสองที่แพงกว่าของใหม่ไม่ถูกใช้', () => {
    const first = parts[0];
    if (!first) throw new Error('fixture');
    const { catalog: priced } = applyUsedPrices(parts, {
      categories: ['cpu'],
      grade: 'A',
      prices: { [first.id]: first.price + 1000 },
    });
    expect(priced[0]?.price).toBe(first.price);
  });

  it('PSU ไม่อยู่ในหมวดที่ยอมเป็นมือสองตามค่าเริ่มต้น', () => {
    expect(DEFAULT_USED_CATEGORIES).not.toContain('psu');
  });

  it('งบเท่ากัน ยอมใช้มือสองได้สเปกแรงขึ้นหรือเท่าเดิม และมีชิ้นมือสองพร้อมกฎ U', () => {
    const budget = 30000;
    const plain = generateBudgetBuilds({ budget, usage: 'gaming', catalog: parts });
    const withUsed = generateBudgetBuilds({
      budget,
      usage: 'gaming',
      catalog: parts,
      used: { categories: DEFAULT_USED_CATEGORIES, grade: 'B', prices },
    });
    if (!plain.ok || !withUsed.ok) throw new Error('ควรจัดได้');
    const balanced = (r: typeof plain) => r.options.find((o) => o.kind === 'balanced');
    expect(balanced(withUsed)?.result.score.score).toBeGreaterThanOrEqual(
      balanced(plain)?.result.score.score ?? 0,
    );
    const items = balanced(withUsed)?.items ?? [];
    expect(items.some((item) => item.condition === 'B')).toBe(true);
    expect(items.find((item) => item.part.categorySlug === 'psu')?.condition).toBe('new');
    // ไม่มีผิดพลาด และราคารวมแบบผสมไม่เกินงบ
    expect(balanced(withUsed)?.result.status).not.toBe('error');
    expect(balanced(withUsed)?.result.price.total).toBeLessThanOrEqual(budget);
    expect(balanced(withUsed)?.result.price.saved).toBeGreaterThan(0);
  });

  it('งบต่ำเกินสำหรับของใหม่ แต่จัดได้ถ้ายอมมือสอง', () => {
    const budget = 16000;
    const plain = generateBudgetBuilds({ budget, usage: 'gaming', catalog: parts });
    const withUsed = generateBudgetBuilds({
      budget,
      usage: 'gaming',
      catalog: parts,
      used: { categories: DEFAULT_USED_CATEGORIES, grade: 'C', prices },
    });
    expect(plain.ok).toBe(false);
    expect(withUsed.ok).toBe(true);
  });
});

describe('itemsKey (รวมการ์ดตัวเลือกที่ได้ชุดเดียวกัน)', () => {
  it('ชุดเดียวกันแม้เรียงต่างกันได้ลายเซ็นเดียวกัน ส่วนต่างจำนวนหรือสภาพได้คนละลายเซ็น', () => {
    const result = generateBudgetBuilds({ budget: 40000, usage: 'gaming', catalog: catalog() });
    if (!result.ok) throw new Error('ควรจัดได้');
    const items = result.options[0].items;
    expect(itemsKey([...items].reverse())).toBe(itemsKey(items));
    const first = items[0];
    if (!first) throw new Error('ควรมีอะไหล่');
    expect(itemsKey([{ ...first, quantity: first.quantity + 1 }, ...items.slice(1)])).not.toBe(
      itemsKey(items),
    );
    expect(itemsKey([{ ...first, condition: 'B' }, ...items.slice(1)])).not.toBe(itemsKey(items));
  });
});
