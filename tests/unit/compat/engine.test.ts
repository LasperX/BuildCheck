import { describe, expect, it } from 'vitest';

import {
  calculatePrice,
  checkBuild,
  DEFAULT_SETTINGS,
  evaluateCandidate,
  overallStatus,
  powerLevel,
  recommendedPsuWatt,
  resolveSettings,
  sortIssues,
  unitPrice,
  type Issue,
} from '@/lib/compat';
import { buildContext } from '@/lib/compat/context';

import {
  cooler,
  cpu,
  gpu,
  goodBuild,
  item,
  motherboard,
  pcCase,
  psu,
  ram,
  storage,
  toItems,
} from './fixtures';

describe('สูตรกำลังไฟ (4.3)', () => {
  it('ตัวอย่างในเอกสาร: 372 W แนะนำ PSU 500 W', () => {
    const b = goodBuild();
    const { power } = checkBuild({ items: toItems({ ...b, psu: psu({ wattage: 500 }) }) });
    expect(power.totalWatt).toBe(372);
    expect(power.recommendedWatt).toBe(500);
    expect(power.load).toBeCloseTo(0.744, 3);
    expect(power.level).toBe('ok');
  });

  it('นับแรมตามจำนวนแถว SSD/HDD ตามจำนวนตัว และชุดน้ำ 15 W', () => {
    const items = [
      item(cpu({ tdpWatt: 100 })),
      item(motherboard({}, { powerWatt: 80 })),
      item(ram({ sticksInKit: 2 }), 2), // 4 แถว = 20 W
      item(storage(), 2), // NVMe 2 ตัว = 14 W
      item(storage({ type: 'SATA_SSD', interface: 'SATA' })), // 7 W
      item(storage({ type: 'HDD', interface: 'SATA' }), 2), // 20 W
      item(cooler({ type: 'aio', heightMm: null, radiatorMm: 240 })), // 15 W
    ];
    const { power } = checkBuild({ items });
    // 100 + 80 + 20 + 21 + 20 + 15 + 15 = 271
    expect(power.totalWatt).toBe(271);
    expect(power.breakdown.map((row) => row.watt)).toEqual([100, 80, 20, 21, 20, 15, 15]);
    expect(power.psuWatt).toBeNull();
    expect(power.level).toBe('none');
  });

  it('ใช้วัตต์เมนบอร์ดตั้งต้น 50 W เมื่อแอดมินไม่ได้กรอก และแก้ค่าตั้งต้นได้', () => {
    const items = [item(motherboard())];
    expect(checkBuild({ items }).power.totalWatt).toBe(65);
    expect(checkBuild({ items, settings: { motherboardDefaultWatt: 80 } }).power.totalWatt).toBe(
      95,
    );
  });

  it('ไม่นับ 15 W พื้นฐานเมื่อมีแต่อะไหล่ที่ไม่ใช้ไฟ (เคส)', () => {
    expect(checkBuild({ items: [item(pcCase())] }).power.totalWatt).toBe(0);
  });

  it('PSU แนะนำปัดขึ้นเป็นหลัก 50 และไม่เพี้ยนจากทศนิยม', () => {
    expect(recommendedPsuWatt(372, 0.3)).toBe(500); // 483.6 → 500
    expect(recommendedPsuWatt(400, 0.3)).toBe(550); // 520 → 550
    expect(recommendedPsuWatt(1500, 0.1)).toBe(1650); // 1650.0000000000002 ต้องไม่กลายเป็น 1700
    expect(recommendedPsuWatt(500, 0.3)).toBe(650); // 650 พอดี
    expect(recommendedPsuWatt(0, 0.3)).toBe(0);
  });

  it('ระดับเกจ: ≤76.9% เขียว, ≤100% เหลือง, >100% แดง', () => {
    expect(powerLevel(null, 0.3)).toBe('none');
    expect(powerLevel(0.7, 0.3)).toBe('ok');
    expect(powerLevel(1 / 1.3, 0.3)).toBe('ok');
    expect(powerLevel(0.8, 0.3)).toBe('warning');
    expect(powerLevel(1, 0.3)).toBe('warning');
    expect(powerLevel(1.01, 0.3)).toBe('error');
  });

  it('จำนวนน้อยกว่า 1 ถือว่าไม่ได้เลือก', () => {
    const { power, issues } = checkBuild({ items: [item(cpu(), 0)] });
    expect(power.totalWatt).toBe(0);
    expect(issues).toEqual([]);
  });
});

describe('คะแนนประสิทธิภาพและความคุ้มค่า (4.4)', () => {
  const items = [item(cpu({ perfScore: 60 })), item(gpu({ perfScore: 80 }))];

  it('เล่นเกม: 0.3 × 60 + 0.7 × 80 = 74', () => {
    expect(checkBuild({ items, usage: 'gaming' }).score.score).toBe(74);
  });

  it('ออฟฟิศ: 0.8 × 60 + 0.2 × 80 = 64 และตัดต่อ 70 สตรีม 71', () => {
    expect(checkBuild({ items, usage: 'office' }).score.score).toBe(64);
    expect(checkBuild({ items, usage: 'creator' }).score.score).toBe(70);
    expect(checkBuild({ items, usage: 'streaming' }).score.score).toBe(71);
  });

  it('ไม่มีการ์ดจอให้ S_GPU = 0', () => {
    expect(checkBuild({ items: [items[0]], usage: 'gaming' }).score.score).toBe(18);
  });

  it('ความคุ้มค่า = คะแนน ÷ ราคารวม × 10,000', () => {
    // ราคารวม 6,000 + 12,000 = 18,000 → 74 ÷ 18,000 × 10,000 = 41.1
    expect(checkBuild({ items }).score.value).toBe(41.1);
    expect(checkBuild({ items: [] }).score.value).toBe(0);
  });

  it('ใช้น้ำหนักที่แอดมินแก้แทนค่าตั้งต้นได้', () => {
    const settings = {
      usageWeights: { ...DEFAULT_SETTINGS.usageWeights, gaming: { cpu: 0.5, gpu: 0.5 } },
    };
    expect(checkBuild({ items, settings }).score.score).toBe(70);
    expect(resolveSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('ราคารวม มือหนึ่งผสมมือสอง', () => {
  it('มือหนึ่งใช้ราคาอ้างอิง มือสองใช้ราคาที่เสนอ > ราคากลาง > ราคาใหม่', () => {
    const part = gpu({}, 12000);
    expect(unitPrice(item(part))).toBe(12000);
    expect(unitPrice(item(part, 1, 'B', { offeredPrice: 6000, usedPrice: 6500 }))).toBe(6000);
    expect(unitPrice(item(part, 1, 'B', { usedPrice: 6500 }))).toBe(6500);
    expect(unitPrice(item(part, 1, 'B'))).toBe(12000);
  });

  it('คำนวณราคารวม ราคาใหม่ทั้งชุด และส่วนที่ประหยัด', () => {
    const items = [item(gpu({}, 12000), 1, 'A', { usedPrice: 8000 }), item(ram({}, 2000), 2)];
    const price = calculatePrice(buildContext(items, DEFAULT_SETTINGS), 10000);
    expect(price).toEqual({ total: 12000, totalNew: 16000, saved: 4000, overBudget: 2000 });
  });
});

describe('การเรียงผลและสถานะรวม (4.2)', () => {
  const issue = (code: Issue['code'], level: Issue['level']): Issue => ({
    code,
    level,
    title: '',
    message: '',
    fix: '',
    partIds: [],
    categories: [],
  });

  it('เรียงผิดพลาด → เตือน → ข้อมูล แล้วตามรหัส', () => {
    const sorted = sortIssues([
      issue('I01', 'info'),
      issue('R13', 'warning'),
      issue('R09', 'error'),
      issue('R01', 'error'),
    ]);
    expect(sorted.map((i) => i.code)).toEqual(['R01', 'R09', 'R13', 'I01']);
  });

  it('สถานะ: มีผิดพลาด = แดง, มีแต่เตือน = เหลือง, ไม่มี = เขียว', () => {
    expect(overallStatus([issue('R13', 'warning'), issue('R01', 'error')])).toBe('error');
    expect(overallStatus([issue('R13', 'warning'), issue('I01', 'info')])).toBe('warning');
    expect(overallStatus([issue('I01', 'info')])).toBe('ok');
  });

  it('สเปกที่มีหลายปัญหานับจำนวนแต่ละระดับถูกต้อง', () => {
    const b = goodBuild();
    const result = checkBuild({
      items: toItems({
        ...b,
        cpu: cpu({ socket: 'LGA1700', includesCooler: false }),
        ram: ram({ speedMts: 7200 }),
        cooler: undefined,
      }),
    });
    expect(result.status).toBe('error');
    expect(result.counts).toEqual({ error: 1, warning: 1, info: 1 });
    expect(result.issues.map((i) => i.code)).toEqual(['R01', 'R07', 'I02']);
  });
});

describe('ตัวกรองอัจฉริยะ evaluateCandidate', () => {
  it('บอร์ด Socket ตรงกันเข้ากันได้ ส่วน Socket ไม่ตรงถูกตัดพร้อมเหตุผล', () => {
    const input = { items: [item(cpu())] };
    expect(evaluateCandidate(input, motherboard()).compatible).toBe(true);
    const bad = evaluateCandidate(input, motherboard({ socket: 'LGA1700' }));
    expect(bad.compatible).toBe(false);
    expect(bad.errors[0].code).toBe('R01');
  });

  it('หมวดชิ้นเดียวแทนชิ้นเดิม ไม่นับปัญหาของชิ้นเดิม', () => {
    const b = goodBuild();
    const input = { items: toItems({ ...b, gpu: gpu({ lengthMm: 400 }) }) };
    expect(evaluateCandidate(input, gpu({ lengthMm: 300 })).compatible).toBe(true);
  });

  it('ปัญหาเดิมของสเปกไม่ทำให้ตัวเลือกถูกตัด', () => {
    const b = goodBuild();
    // สเปกมี R08 อยู่แล้ว (เคสไม่รับบอร์ด ATX) ลองเลือกแรมใหม่ต้องยังเข้ากันได้
    const input = { items: toItems({ ...b, pcCase: pcCase({ supportedFormFactors: ['ITX'] }) }) };
    expect(evaluateCandidate(input, ram(), b.ram.id).compatible).toBe(true);
  });

  it('แรมแทนชิ้นที่ระบุ หรือเพิ่มเข้าไปถ้าไม่ระบุ', () => {
    const b = goodBuild();
    const input = { items: toItems({ ...b, ram: ram({ sticksInKit: 4, capacityPerStickGb: 8 }) }) };
    const twoSticks = ram({ sticksInKit: 2 });
    // เพิ่มอีก 2 แถวรวมเป็น 6 > 4 ช่อง
    expect(evaluateCandidate(input, twoSticks).errors.map((i) => i.code)).toContain('R05');
    // แทนชุดเดิม เหลือ 2 แถว
    expect(evaluateCandidate(input, twoSticks, input.items[2].part.id).compatible).toBe(true);
  });

  it('การ์ดจอที่ทำให้ PSU เดิมจ่ายไฟไม่พอถูกตัด', () => {
    const b = goodBuild();
    const input = { items: toItems({ ...b, gpu: undefined, psu: psu({ wattage: 400 }) }) };
    const result = evaluateCandidate(input, gpu({ tbpWatt: 350 }));
    expect(result.compatible).toBe(false);
    expect(result.errors[0].code).toBe('R14');
  });

  it('CPU ไม่มีกราฟิกในตัวไม่ถูกตัด (R18 แก้ได้ด้วยการเลือกการ์ดจอทีหลัง) แต่มีข้อควรรู้', () => {
    const result = evaluateCandidate({ items: [] }, cpu({ hasIgpu: false }));
    expect(result.compatible).toBe(true);
    expect(result.warnings.map((i) => i.code)).toEqual(['R18']);
  });
});

describe('ประสิทธิภาพ (9.2)', () => {
  it('ตรวจสเปกเต็มชุดได้ภายใน 100 ms', () => {
    const items = toItems(goodBuild());
    const start = performance.now();
    for (let i = 0; i < 100; i++) checkBuild({ items });
    const each = (performance.now() - start) / 100;
    expect(each).toBeLessThan(100);
  });
});
