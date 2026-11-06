import { describe, expect, it } from 'vitest';

import { checkBuild, type EngineItem, type RuleCode } from '@/lib/compat';

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

// ทุกกฎมีอย่างน้อย 2 เทสต์: กรณีผ่าน และกรณีไม่ผ่าน (บางกฎมีกรณีขอบเพิ่ม)

const codes = (items: EngineItem[], budget?: number) =>
  checkBuild({ items, budget }).issues.map((issue) => issue.code);

const find = (items: EngineItem[], code: RuleCode) =>
  checkBuild({ items }).issues.filter((issue) => issue.code === code);

describe('สเปกตั้งต้น', () => {
  it('สเปกที่เข้ากันทุกชิ้นได้สถานะเขียวและไม่มีปัญหาเลย', () => {
    const result = checkBuild({ items: toItems(goodBuild()) });
    expect(result.issues).toEqual([]);
    expect(result.status).toBe('ok');
  });

  it('สเปกว่างไม่มีปัญหาและวัตต์เป็น 0', () => {
    const result = checkBuild({ items: [] });
    expect(result.issues).toEqual([]);
    expect(result.power.totalWatt).toBe(0);
    expect(result.power.level).toBe('none');
  });
});

describe('R01 CPU ↔ เมนบอร์ด (Socket)', () => {
  it('ผ่านเมื่อ Socket ตรงกัน แม้ตัวพิมพ์ต่างกัน', () => {
    const b = goodBuild();
    expect(codes(toItems({ ...b, motherboard: motherboard({ socket: 'am5' }) }))).not.toContain(
      'R01',
    );
  });

  it('ผิดพลาดเมื่อ Socket ไม่ตรง พร้อมแนะนำบอร์ด Socket ของ CPU', () => {
    const b = goodBuild();
    const [issue] = find(
      toItems({ ...b, cpu: cpu({ socket: 'LGA1700', generation: 'Gen-B' }) }),
      'R01',
    );
    expect(issue.level).toBe('error');
    expect(issue.message).toContain('LGA1700');
    expect(issue.message).toContain('AM5');
    expect(issue.suggest?.filter).toEqual({ socket: ['LGA1700'] });
  });

  it('ข้ามเมื่อยังไม่ได้เลือกเมนบอร์ด', () => {
    expect(codes([item(cpu({ socket: 'LGA1700' }))])).not.toContain('R01');
  });
});

describe('R02 CPU ↔ ชิปเซ็ต และ R03 CPU ↔ BIOS', () => {
  it('ผ่านทั้งสองกฎเมื่อรุ่นอยู่ในรายการที่รองรับ', () => {
    const c = codes(toItems(goodBuild()));
    expect(c).not.toContain('R02');
    expect(c).not.toContain('R03');
  });

  it('R02 ผิดพลาดเมื่อรุ่นไม่อยู่ในทั้งสองรายการ', () => {
    const b = goodBuild();
    const [issue] = find(toItems({ ...b, cpu: cpu({ generation: 'Gen-Z' }) }), 'R02');
    expect(issue.level).toBe('error');
    expect(issue.message).toContain('Gen-Z');
  });

  it('R03 เตือนเมื่อรุ่นอยู่ในรายการต้องอัปเดต BIOS เท่านั้น และไม่แจ้ง R02', () => {
    const b = goodBuild();
    const items = toItems({
      ...b,
      cpu: cpu({ generation: 'Gen-C' }),
      motherboard: motherboard({ biosUpdateGenerations: ['Gen-C'] }),
    });
    const c = codes(items);
    expect(c).toContain('R03');
    expect(c).not.toContain('R02');
    expect(checkBuild({ items }).status).toBe('warning');
  });

  it('ไม่แจ้ง R02/R03 ซ้ำเมื่อ Socket ไม่ตรง (R01 แจ้งแล้ว)', () => {
    const b = goodBuild();
    const c = codes(toItems({ ...b, cpu: cpu({ socket: 'LGA1700', generation: 'Gen-Z' }) }));
    expect(c).toContain('R01');
    expect(c).not.toContain('R02');
    expect(c).not.toContain('R03');
  });
});

describe('R04 ชนิดแรม', () => {
  it('ผ่านเมื่อชนิดแรมตรงกับบอร์ด', () => {
    expect(codes(toItems(goodBuild()))).not.toContain('R04');
  });

  it('ผิดพลาดเมื่อแรม DDR4 กับบอร์ด DDR5', () => {
    const b = goodBuild();
    const [issue] = find(toItems({ ...b, ram: ram({ type: 'DDR4', speedMts: 3200 }) }), 'R04');
    expect(issue.level).toBe('error');
    expect(issue.suggest?.filter).toEqual({ type: ['DDR5'] });
  });
});

describe('R05 จำนวนแถวแรม', () => {
  it('ผ่านเมื่อแถวรวมเท่ากับจำนวนช่องพอดี (2 ชุด × 2 แถว = 4 ช่อง)', () => {
    const b = goodBuild();
    const items = [...toItems({ ...b, ram: undefined }), item(b.ram, 2)];
    expect(codes(items)).not.toContain('R05');
  });

  it('ผิดพลาดเมื่อแถวรวมเกินจำนวนช่อง (3 ชุด × 2 แถว = 6 > 4)', () => {
    const b = goodBuild();
    const items = [...toItems({ ...b, ram: undefined }), item(b.ram, 3)];
    const [issue] = find(items, 'R05');
    expect(issue.level).toBe('error');
    expect(issue.message).toContain('6 แถว');
  });
});

describe('R06 ความจุแรม', () => {
  it('ผ่านเมื่อความจุรวมเท่ากับค่าสูงสุดพอดี', () => {
    const b = goodBuild();
    const items = toItems({ ...b, motherboard: motherboard({ maxMemoryGb: 32 }) });
    expect(codes(items)).not.toContain('R06');
  });

  it('ผิดพลาดเมื่อความจุรวมเกินที่บอร์ดรองรับ (64 > 32)', () => {
    const b = goodBuild();
    const items = toItems({
      ...b,
      motherboard: motherboard({ maxMemoryGb: 32 }),
      ram: ram({ capacityPerStickGb: 32 }),
    });
    const [issue] = find(items, 'R06');
    expect(issue.level).toBe('error');
    expect(issue.message).toContain('64 GB');
  });
});

describe('R07 ความเร็วแรม', () => {
  it('ผ่านเมื่อแรมเร็วไม่เกินที่บอร์ดรองรับ', () => {
    expect(codes(toItems(goodBuild()))).not.toContain('R07');
  });

  it('เตือนเมื่อแรมเร็วกว่าบอร์ด', () => {
    const b = goodBuild();
    const [issue] = find(toItems({ ...b, ram: ram({ speedMts: 7200 }) }), 'R07');
    expect(issue.level).toBe('warning');
    expect(issue.message).toContain('6400');
  });
});

describe('R08 เมนบอร์ด ↔ เคส', () => {
  it('ผ่านเมื่อเคสรองรับขนาดบอร์ด', () => {
    expect(codes(toItems(goodBuild()))).not.toContain('R08');
  });

  it('ผิดพลาดเมื่อบอร์ด ATX กับเคส ITX', () => {
    const b = goodBuild();
    const [issue] = find(
      toItems({ ...b, pcCase: pcCase({ supportedFormFactors: ['ITX'] }) }),
      'R08',
    );
    expect(issue.level).toBe('error');
    expect(issue.categories).toEqual(['motherboard', 'case']);
  });
});

describe('R09 การ์ดจอ ↔ เคส', () => {
  it('ผ่านเมื่อการ์ดยาวเท่ากับค่าสูงสุดพอดี', () => {
    const b = goodBuild();
    expect(codes(toItems({ ...b, gpu: gpu({ lengthMm: 350 }) }))).not.toContain('R09');
  });

  it('ผิดพลาดเมื่อการ์ดยาวเกินเคส และบอกว่าเกินกี่มม.', () => {
    const b = goodBuild();
    const [issue] = find(toItems({ ...b, gpu: gpu({ lengthMm: 360 }) }), 'R09');
    expect(issue.level).toBe('error');
    expect(issue.message).toContain('เกิน 10 มม.');
  });
});

describe('R10 ซิงก์ลม ↔ เคส', () => {
  it('ผ่านเมื่อซิงก์สูงไม่เกินเคส', () => {
    expect(codes(toItems(goodBuild()))).not.toContain('R10');
  });

  it('ผิดพลาดเมื่อซิงก์สูงเกินเคส', () => {
    const b = goodBuild();
    const [issue] = find(toItems({ ...b, cooler: cooler({ heightMm: 170 }) }), 'R10');
    expect(issue.level).toBe('error');
  });

  it('ไม่ตรวจความสูงกับชุดน้ำ', () => {
    const b = goodBuild();
    const aio = cooler({ type: 'aio', heightMm: 999, radiatorMm: 240 });
    expect(codes(toItems({ ...b, cooler: aio }))).not.toContain('R10');
  });
});

describe('R11 ชุดน้ำ ↔ เคส', () => {
  it('ผ่านเมื่อเคสรองรับขนาดหม้อน้ำ', () => {
    const b = goodBuild();
    const aio = cooler({ type: 'aio', heightMm: null, radiatorMm: 360 });
    expect(codes(toItems({ ...b, cooler: aio }))).not.toContain('R11');
  });

  it('ผิดพลาดเมื่อเคสไม่รองรับขนาดหม้อน้ำ', () => {
    const b = goodBuild();
    const aio = cooler({ type: 'aio', heightMm: null, radiatorMm: 280 });
    const [issue] = find(toItems({ ...b, cooler: aio }), 'R11');
    expect(issue.level).toBe('error');
    expect(issue.message).toContain('240, 360');
  });

  it('ผิดพลาดเมื่อเคสไม่มีจุดติดตั้งหม้อน้ำเลย', () => {
    const b = goodBuild();
    const aio = cooler({ type: 'aio', heightMm: null, radiatorMm: 240 });
    const [issue] = find(
      toItems({ ...b, cooler: aio, pcCase: pcCase({ radiatorSupportMm: [] }) }),
      'R11',
    );
    expect(issue.message).toContain('ไม่มีจุดติดตั้งหม้อน้ำ');
  });
});

describe('R12 ชุดระบายความร้อน ↔ Socket', () => {
  it('ผ่านเมื่อชุดระบายความร้อนรองรับ Socket', () => {
    expect(codes(toItems(goodBuild()))).not.toContain('R12');
  });

  it('ผิดพลาดเมื่อไม่รองรับ Socket ของ CPU', () => {
    const b = goodBuild();
    const [issue] = find(
      toItems({ ...b, cooler: cooler({ supportedSockets: ['LGA1700'] }) }),
      'R12',
    );
    expect(issue.level).toBe('error');
  });
});

describe('R13 ระบายความร้อนพอหรือไม่', () => {
  it('ผ่านเมื่อรับ TDP ได้เท่ากับ CPU พอดี', () => {
    const b = goodBuild();
    expect(codes(toItems({ ...b, cooler: cooler({ maxTdpWatt: 65 }) }))).not.toContain('R13');
  });

  it('เตือนเมื่อรับ TDP ได้น้อยกว่า CPU', () => {
    const b = goodBuild();
    const items = toItems({
      ...b,
      cpu: cpu({ tdpWatt: 105, includesCooler: false }),
      cooler: cooler({ maxTdpWatt: 65 }),
    });
    const [issue] = find(items, 'R13');
    expect(issue.level).toBe('warning');
  });
});

describe('R14 กำลังไฟ PSU', () => {
  // สเปกตั้งต้นใช้ไฟ 65 + 220 + 50 + 10 + 7 + 5 + 15 = 372 W
  it('ผ่านเมื่อโหลดไม่เกิน 76.9% (372 W กับ PSU 500 W = 74.4%)', () => {
    const b = goodBuild();
    expect(codes(toItems({ ...b, psu: psu({ wattage: 500 }) }))).not.toContain('R14');
  });

  it('เตือนเมื่อเผื่อไม่ถึง 30% (372 W กับ PSU 450 W = 82.7%)', () => {
    const b = goodBuild();
    const [issue] = find(toItems({ ...b, psu: psu({ wattage: 450 }) }), 'R14');
    expect(issue.level).toBe('warning');
    expect(issue.fix).toContain('500 W');
  });

  it('ผิดพลาดเมื่อวัตต์รวมเกิน PSU (372 W กับ PSU 350 W)', () => {
    const b = goodBuild();
    const [issue] = find(toItems({ ...b, psu: psu({ wattage: 350 }) }), 'R14');
    expect(issue.level).toBe('error');
  });

  it('ไม่ผิดพลาดเมื่อวัตต์รวมเท่ากับ PSU พอดี (เป็นแค่เตือน)', () => {
    const b = goodBuild();
    const [issue] = find(toItems({ ...b, psu: psu({ wattage: 372 }) }), 'R14');
    expect(issue.level).toBe('warning');
  });
});

describe('R15 PSU ↔ เคส', () => {
  it('ผ่านเมื่อเคสรองรับขนาด PSU', () => {
    expect(codes(toItems(goodBuild()))).not.toContain('R15');
  });

  it('ผิดพลาดเมื่อ PSU ATX กับเคสที่รับแค่ SFX', () => {
    const b = goodBuild();
    const [issue] = find(toItems({ ...b, pcCase: pcCase({ psuFormFactors: ['SFX'] }) }), 'R15');
    expect(issue.level).toBe('error');
    expect(issue.suggest?.filter).toEqual({ formFactor: ['SFX'] });
  });
});

describe('R16 ช่องเสียบไฟการ์ดจอ', () => {
  it('ผ่านเมื่อ PSU มีหัวต่อพอ', () => {
    expect(codes(toItems(goodBuild()))).not.toContain('R16');
  });

  it('เตือนเมื่อหัว 8pin ไม่พอ', () => {
    const b = goodBuild();
    const items = toItems({
      ...b,
      gpu: gpu({ powerConnectors: { '8pin': 3 } }),
      psu: psu({ wattage: 850 }),
    });
    const [issue] = find(items, 'R16');
    expect(issue.level).toBe('warning');
    expect(issue.message).toContain('8pin ต้องการ 3 มี 2');
  });

  it('เตือนเมื่อการ์ดใช้หัวชนิดที่ PSU ไม่มีเลย', () => {
    const b = goodBuild();
    const items = toItems({ ...b, gpu: gpu({ powerConnectors: { '12VHPWR': 1 } }) });
    expect(find(items, 'R16')[0].message).toContain('12VHPWR ต้องการ 1 มี 0');
  });

  it('ไม่ตรวจการ์ดที่ไม่ต้องใช้ไฟเลี้ยงเพิ่ม (none)', () => {
    const b = goodBuild();
    const items = toItems({
      ...b,
      gpu: gpu({ powerConnectors: { none: 1 }, tbpWatt: 75 }),
      psu: psu({ pcieConnectors: {} }),
    });
    expect(codes(items)).not.toContain('R16');
  });
});

describe('R17 ช่อง M.2 / SATA', () => {
  it('ผ่านเมื่อ M.2 และ SATA ไม่เกินจำนวนช่อง', () => {
    const b = goodBuild();
    const items = [
      ...toItems({ ...b, storage: undefined }),
      item(b.storage, 2),
      item(storage({ type: 'HDD', interface: 'SATA' }), 4),
    ];
    expect(codes(items)).not.toContain('R17');
  });

  it('ผิดพลาดเมื่อ SSD M.2 เกินจำนวนช่อง', () => {
    const b = goodBuild();
    const items = [...toItems({ ...b, storage: undefined }), item(b.storage, 3)];
    const issues = find(items, 'R17');
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toContain('M.2');
  });

  it('ผิดพลาดเมื่อไดรฟ์ SATA เกินพอร์ต และแจ้งแยกจาก M.2', () => {
    const b = goodBuild();
    const items = [
      ...toItems({ ...b, storage: undefined }),
      item(b.storage, 3),
      item(storage({ type: 'SATA_SSD', interface: 'SATA' }), 5),
    ];
    const issues = find(items, 'R17');
    expect(issues).toHaveLength(2);
    expect(issues.every((issue) => issue.level === 'error')).toBe(true);
  });
});

describe('R18 ไม่มีภาพออกจอ', () => {
  it('ผ่านเมื่อ CPU มีกราฟิกในตัวแม้ไม่มีการ์ดจอ', () => {
    const b = goodBuild();
    expect(codes(toItems({ ...b, gpu: undefined }))).not.toContain('R18');
  });

  it('ผ่านเมื่อ CPU ไม่มีกราฟิกในตัวแต่มีการ์ดจอ', () => {
    const b = goodBuild();
    expect(codes(toItems({ ...b, cpu: cpu({ hasIgpu: false }) }))).not.toContain('R18');
  });

  it('ผิดพลาดเมื่อ CPU ไม่มีกราฟิกในตัวและไม่มีการ์ดจอ แม้เลือก CPU ชิ้นเดียว', () => {
    const [issue] = find([item(cpu({ hasIgpu: false }))], 'R18');
    expect(issue.level).toBe('error');
  });
});

describe('ข้อความระดับข้อมูล I01–I04', () => {
  it('I01 แจ้งหมวดจำเป็นที่ยังขาด แต่ไม่แสดงเมื่อสเปกว่าง', () => {
    const [issue] = find([item(cpu())], 'I01');
    expect(issue.level).toBe('info');
    expect(issue.categories).toEqual(['motherboard', 'ram', 'storage', 'psu', 'case']);
    expect(codes([])).not.toContain('I01');
  });

  it('I01 ไม่แสดงเมื่อเลือกครบหมวดจำเป็น (ไม่มีการ์ดจอ/ระบายความร้อนก็ได้)', () => {
    const b = goodBuild();
    expect(codes(toItems({ ...b, gpu: undefined, cooler: undefined }))).not.toContain('I01');
  });

  it('I02 แจ้งเมื่อ CPU ไม่มีพัดลมแถมและยังไม่เลือกชุดระบายความร้อน', () => {
    const b = goodBuild();
    expect(codes(toItems({ ...b, cooler: undefined }))).toContain('I02');
  });

  it('I02 ไม่แจ้งเมื่อ CPU มีพัดลมแถม', () => {
    const b = goodBuild();
    expect(
      codes(toItems({ ...b, cpu: cpu({ includesCooler: true }), cooler: undefined })),
    ).not.toContain('I02');
  });

  it('I03 แจ้งเมื่อราคารวมเกินงบ และไม่แจ้งเมื่ออยู่ในงบ', () => {
    const items = toItems(goodBuild()); // ราคารวม 32,200 บาท
    expect(codes(items, 30000)).toContain('I03');
    expect(codes(items, 40000)).not.toContain('I03');
    expect(codes(items)).not.toContain('I03');
  });

  it('I04 แจ้งเมื่อแรมแถวเดียว และไม่แจ้งเมื่อมี 2 แถว', () => {
    const b = goodBuild();
    expect(codes(toItems({ ...b, ram: ram({ sticksInKit: 1 }) }))).toContain('I04');
    expect(codes(toItems(b))).not.toContain('I04');
  });

  it('ระดับข้อมูลไม่ทำให้สถานะรวมเปลี่ยนสี', () => {
    const b = goodBuild();
    const result = checkBuild({ items: toItems({ ...b, ram: ram({ sticksInKit: 1 }) }) });
    expect(result.counts.info).toBe(1);
    expect(result.status).toBe('ok');
  });
});
