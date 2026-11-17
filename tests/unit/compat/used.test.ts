import { describe, expect, it } from 'vitest';

import {
  assessOffer,
  checkBuild,
  clampToPerfAnchors,
  daysBetween,
  estimateUsedPrice,
  iqrBounds,
  quantile,
  reportWeight,
  resolveUsedStat,
  roundTo50,
  statsFromReports,
  type EngineItem,
  type RuleCode,
  type UsedReport,
  weeklyTrend,
  weekStart,
  weightedPercentile,
} from '@/lib/compat';

import { cpu, gpu, goodBuild, item, motherboard, psu, storage, toItems } from './fixtures';

// ราคาตัวอย่างในเทสต์เป็นตัวเลขสมมติ ไม่ใช่ราคาตลาดจริง

const TODAY = '2026-06-30';

const find = (
  items: EngineItem[],
  code: RuleCode,
  extra: Parameters<typeof checkBuild>[0] = {
    items: [],
  },
) => checkBuild({ ...extra, items }).issues.filter((issue) => issue.code === code);

/** สเปกครบชุด แต่เปลี่ยนชิ้นที่ระบุเป็นของมือสอง */
function withUsed(replace: (parts: ReturnType<typeof goodBuild>) => EngineItem[]) {
  return replace(goodBuild());
}

describe('เครื่องมือคำนวณพื้นฐาน', () => {
  it('ปัดเป็นหลัก 50 บาท', () => {
    expect(roundTo50(6075)).toBe(6100);
    expect(roundTo50(6020)).toBe(6000);
    expect(roundTo50(6025)).toBe(6050);
  });

  it('นับวันระหว่างวันที่ไม่เพี้ยนตามเขตเวลา', () => {
    expect(daysBetween('2026-06-01', '2026-06-30')).toBe(29);
    expect(daysBetween('2026-06-30', '2026-06-30')).toBe(0);
    expect(daysBetween('2026-07-01', '2026-06-30')).toBe(-1);
  });

  it('quantile ประมาณเชิงเส้นระหว่างสองค่า', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10], 0.25)).toBe(10);
    expect(quantile([], 0.5)).toBe(0);
  });

  it('IQR ตัดค่าที่พิมพ์เกินหนึ่งหลักออก', () => {
    const { low, high } = iqrBounds([5000, 5200, 5100, 4900, 52000]);
    expect(52000).toBeGreaterThan(high);
    expect(4900).toBeGreaterThanOrEqual(low);
  });

  it('น้ำหนักรายงานตามอายุและประเภท', () => {
    expect(reportWeight(0, 'bought')).toBe(1);
    expect(reportWeight(14, 'sold')).toBe(1);
    expect(reportWeight(15, 'bought')).toBe(0.75);
    expect(reportWeight(31, 'sold')).toBe(0.5);
    expect(reportWeight(5, 'listed')).toBeCloseTo(0.8);
    expect(reportWeight(40, 'listed')).toBeCloseTo(0.4);
  });

  it('มัธยฐานถ่วงน้ำหนักเอียงไปทางรายงานที่น้ำหนักมาก', () => {
    const plain = [1000, 2000, 3000].map((value) => ({ value, weight: 1 }));
    expect(weightedPercentile(plain, 0.5)).toBe(2000);
    const heavy = [
      { value: 1000, weight: 0.5 },
      { value: 2000, weight: 0.5 },
      { value: 3000, weight: 2 },
    ];
    expect(weightedPercentile(heavy, 0.5)).toBe(3000);
  });

  it('น้ำหนักสะสมถึงครึ่งพอดีใช้ค่าเฉลี่ยของสองราคา', () => {
    const even = [1000, 2000, 3000, 4000].map((value) => ({ value, weight: 1 }));
    expect(weightedPercentile(even, 0.5)).toBe(2500);
    expect(weightedPercentile([], 0.5)).toBe(0);
  });
});

describe('ราคากลางจากรายงาน (แหล่งที่ 1)', () => {
  const report = (
    price: number,
    seenAt = '2026-06-25',
    reportType: UsedReport['reportType'] = 'bought',
  ) => ({
    price,
    seenAt,
    reportType,
  });

  it('รายงานไม่ถึง 3 รายการคืน null', () => {
    expect(statsFromReports([report(5000), report(5200)], TODAY)).toBeNull();
  });

  it('ไม่นับรายงานที่เก่ากว่า 60 วันหรือลงวันที่ในอนาคต', () => {
    const reports = [
      report(5000),
      report(5100),
      report(5200, '2026-04-01'),
      report(5300, '2026-07-05'),
    ];
    expect(statsFromReports(reports, TODAY)).toBeNull();
  });

  it('ตัดค่าผิดปกติแล้วคำนวณราคากลางและช่วงราคา ปัดหลัก 50', () => {
    const reports = [report(5000), report(5100), report(5200), report(5300), report(53000)];
    const stats = statsFromReports(reports, TODAY);
    expect(stats).not.toBeNull();
    expect(stats?.count).toBe(4); // 53,000 ถูกตัด
    expect(stats?.median).toBe(5150);
    expect(stats?.p25).toBe(5050); // น้ำหนักสะสมถึง 25% พอดีที่ 5,000 จึงเฉลี่ยกับ 5,100
    expect(stats?.p75).toBe(5250);
  });
});

describe('สูตรประมาณค่าเสื่อม (แหล่งที่ 3)', () => {
  it('ตัวอย่างในเอกสาร: การ์ดจอ 12,000 บาท 2 ปี เกรด B = 6,100 บาท', () => {
    expect(estimateUsedPrice(12000, 'gpu', 2024, 'B', 2026)).toBe(6100);
  });

  it('ไม่ทราบปีวางขายนับเป็น 1 ปี · ปีในอนาคตนับเป็น 0 ปี', () => {
    expect(estimateUsedPrice(10000, 'cpu', null, 'A', 2026)).toBe(8000);
    expect(estimateUsedPrice(10000, 'cpu', 2027, 'C', 2026)).toBe(7500);
  });

  it('PSU เสื่อมเร็วกว่า CPU', () => {
    const cpuPrice = estimateUsedPrice(10000, 'cpu', 2023, 'A', 2026);
    const psuPrice = estimateUsedPrice(10000, 'psu', 2023, 'A', 2026);
    expect(psuPrice).toBeLessThan(cpuPrice);
  });
});

describe('เลือกแหล่งราคากลาง', () => {
  const part = { price: 12000, categorySlug: 'gpu' as const, releaseYear: 2024 };
  const reports = (count: number): UsedReport[] =>
    Array.from({ length: count }, (_, i) => ({
      price: 7000 + i * 10,
      seenAt: '2026-06-28',
      reportType: 'sold' as const,
    }));

  it('รายงาน 10 รายการขึ้นไป = ความน่าเชื่อถือสูง', () => {
    const stat = resolveUsedStat({
      part,
      grade: 'B',
      reports: reports(10),
      survey: null,
      today: TODAY,
    });
    expect(stat.source).toBe('reports');
    expect(stat.confidence).toBe('high');
    expect(stat.reportCount).toBe(10);
  });

  it('รายงาน 3–9 รายการ = ความน่าเชื่อถือกลาง', () => {
    const stat = resolveUsedStat({
      part,
      grade: 'B',
      reports: reports(3),
      survey: null,
      today: TODAY,
    });
    expect(stat.source).toBe('reports');
    expect(stat.confidence).toBe('medium');
  });

  it('รายงานไม่พอ ใช้ราคาสำรวจที่ไม่เกิน 90 วัน', () => {
    const stat = resolveUsedStat({
      part,
      grade: 'B',
      reports: reports(2),
      survey: { minPrice: 6500, maxPrice: 7500, surveyedAt: '2026-05-01' },
      today: TODAY,
    });
    expect(stat).toMatchObject({
      source: 'survey',
      confidence: 'medium',
      median: 7000,
      p25: 6500,
      p75: 7500,
    });
  });

  it('ราคาสำรวจเก่ากว่า 90 วัน ใช้สูตรประมาณการ', () => {
    // รุ่นที่มีแต่มือสอง: หักตามอายุ 2 ปี → 12,000 × 0.75² × 0.90 = 6,075 → 6,100
    const stat = resolveUsedStat({
      part: { ...part, availability: 'used_only' },
      grade: 'B',
      reports: [],
      survey: { minPrice: 6500, maxPrice: 7500, surveyedAt: '2026-01-01' },
      today: TODAY,
    });
    expect(stat).toMatchObject({
      source: 'estimate',
      confidence: 'estimate',
      median: 6100,
      p25: null,
    });
  });

  it('รุ่นที่ยังขายมือหนึ่ง ไม่หักตามปีวางขายซ้ำ (t = 1 เสมอ)', () => {
    // ราคาร้านวันนี้ลดตามอายุมาแล้ว: 12,000 × 0.75¹ × 0.90 = 8,100 ไม่ว่าวางขายปีไหน
    for (const releaseYear of [2019, 2024, null]) {
      const stat = resolveUsedStat({
        part: { price: 12000, categorySlug: 'gpu', releaseYear, availability: 'new' },
        grade: 'B',
        reports: [],
        survey: null,
        today: TODAY,
      });
      expect(stat.median).toBe(8100);
    }
  });
});

describe('กรอบราคาตามคะแนนประสิทธิภาพ (รุ่นที่มีแต่มือสอง)', () => {
  // ราคามือสองของรุ่นที่ยังขายมือหนึ่ง: คะแนน 40 = 3,000 · คะแนน 50 = 4,000 · คะแนน 60 = 6,000
  const anchors = [
    { perf: 40, price: 3000 },
    { perf: 50, price: 4000 },
    { perf: 60, price: 6000 },
  ];

  it('อยู่ในกรอบอยู่แล้ว ไม่เปลี่ยน', () => {
    expect(clampToPerfAnchors(3500, 45, anchors)).toBe(3500);
  });

  it('แรงกว่ารุ่นที่ยังขายอยู่ ต้องไม่ถูกกว่ารุ่นนั้น', () => {
    // คะแนน 55 แรงกว่ารุ่นคะแนน 50 (4,000) จึงไม่ต่ำกว่า 4,000
    expect(clampToPerfAnchors(2500, 55, anchors)).toBe(4000);
  });

  it('ช้ากว่ารุ่นที่ยังขายอยู่ ต้องไม่แพงกว่ารุ่นนั้น', () => {
    // คะแนน 45 ช้ากว่ารุ่นคะแนน 50 (4,000) จึงไม่เกิน 4,000
    expect(clampToPerfAnchors(5200, 45, anchors)).toBe(4000);
  });

  it('ช้ากว่าทุกรุ่น มีแต่เพดาน · แรงกว่าทุกรุ่น มีแต่ขั้นต่ำ', () => {
    expect(clampToPerfAnchors(900, 20, anchors)).toBe(900);
    expect(clampToPerfAnchors(3500, 20, anchors)).toBe(3000);
    expect(clampToPerfAnchors(9000, 80, anchors)).toBe(9000);
    expect(clampToPerfAnchors(5000, 80, anchors)).toBe(6000);
  });

  it('ราคารุ่นมือหนึ่งไม่เรียงตามคะแนน ใช้เพดานเป็นหลัก · ไม่มีรุ่นให้เทียบ ไม่เปลี่ยน', () => {
    // รุ่นคะแนน 40 ราคา 5,000 แพงกว่ารุ่นคะแนน 50 ราคา 4,000: รุ่นคะแนน 45 ได้ไม่เกิน 4,000
    const odd = [
      { perf: 40, price: 5000 },
      { perf: 50, price: 4000 },
    ];
    expect(clampToPerfAnchors(4500, 45, odd)).toBe(4000);
    expect(clampToPerfAnchors(2000, 45, odd)).toBe(4000);
    expect(clampToPerfAnchors(2000, 45, [])).toBe(2000);
  });

  // รูปแบบเดียวกับข้อมูลการ์ดจอจริงที่เจอ: รุ่นใหม่คะแนน 65 ราคาสูง แต่รุ่นคะแนน 66 ที่แรงกว่าขายถูกกว่ามาก
  const unordered = [
    { perf: 59, price: 11950 },
    { perf: 65, price: 21550 },
    { perf: 66, price: 12750 },
    { perf: 66, price: 12500 },
    { perf: 77, price: 23500 },
  ];

  it('ขั้นต่ำมาจากรุ่นที่ช้ากว่าซึ่งคะแนนใกล้ที่สุด ไม่ใช่รุ่นที่แพงที่สุดในบรรดารุ่นที่ช้ากว่า', () => {
    // คะแนน 68: รุ่นที่ช้ากว่าที่ใกล้ที่สุดคือคะแนน 66 (12,500 และ 12,750) ไม่ใช่คะแนน 65 ที่ราคา 21,550
    expect(clampToPerfAnchors(9750, 68, unordered)).toBe(12500);
  });

  it('รุ่นที่ช้ากว่าคะแนนเท่ากันหลายรุ่น ใช้ราคาต่ำสุดของกลุ่มนั้น', () => {
    expect(clampToPerfAnchors(9000, 66, unordered)).toBe(12500);
  });

  it('ไม่เกินราคาเปิดตัว × ตัวคูณเกรด แม้ขั้นต่ำจากรุ่นที่ยังขายจะสูงกว่า', () => {
    // คะแนน 77 เท่ารุ่นที่ยังขายราคา 23,500 แต่ราคาเปิดตัว 20,970 × 0.9 (เกรด B) ≈ 18,850
    expect(clampToPerfAnchors(10600, 77, unordered, 18850)).toBe(18850);
    // ประมาณการต่ำกว่าเพดานอยู่แล้ว ไม่ถูกดันขึ้น
    expect(clampToPerfAnchors(3500, 45, anchors, 10000)).toBe(3500);
    // ไม่มีรุ่นให้เทียบ ยังใช้ราคาเปิดตัวเป็นเพดาน
    expect(clampToPerfAnchors(12000, 50, [], 9000)).toBe(9000);
  });
});

describe('ประเมินราคาที่ผู้ขายเสนอ', () => {
  it('แบ่งป้ายตามสัดส่วนของราคากลาง', () => {
    expect(assessOffer(5900, 10000).verdict).toBe('suspicious');
    expect(assessOffer(6000, 10000).verdict).toBe('cheap');
    expect(assessOffer(8999, 10000).verdict).toBe('cheap');
    expect(assessOffer(9000, 10000).verdict).toBe('fair');
    expect(assessOffer(11000, 10000).verdict).toBe('fair');
    expect(assessOffer(11001, 10000).verdict).toBe('expensive');
  });

  it('ราคากลางเป็น 0 ไม่หารด้วยศูนย์', () => {
    expect(assessOffer(5000, 0)).toEqual({ verdict: 'fair', ratio: 1 });
  });
});

describe('แนวโน้มรายสัปดาห์', () => {
  it('วันจันทร์ของสัปดาห์', () => {
    expect(weekStart('2026-06-30')).toBe('2026-06-29'); // วันอังคาร → วันจันทร์ก่อนหน้า
    expect(weekStart('2026-06-28')).toBe('2026-06-22'); // วันอาทิตย์นับเป็นท้ายสัปดาห์
  });

  it('จัดกลุ่มรายงานตามสัปดาห์และเรียงตามเวลา', () => {
    const trend = weeklyTrend([
      { price: 5000, seenAt: '2026-06-30', reportType: 'sold' },
      { price: 6000, seenAt: '2026-06-23', reportType: 'sold' },
      { price: 5200, seenAt: '2026-07-01', reportType: 'sold' },
    ]);
    expect(trend.map((t) => t.week)).toEqual(['2026-06-22', '2026-06-29']);
    expect(trend[1]).toMatchObject({ median: 5100, count: 2 });
  });
});

describe('U01 การ์ดจอมือสอง', () => {
  it('การ์ดจอมือหนึ่งไม่เตือน', () => {
    expect(find(toItems(goodBuild()), 'U01')).toEqual([]);
  });

  it('การ์ดจอมือสองเตือนให้ขอดูรันทดสอบ', () => {
    const items = withUsed(({ gpu: g, ...rest }) => [...toItems(rest), item(g, 1, 'B')]);
    const issues = find(items, 'U01');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.level).toBe('warning');
  });
});

describe('U02 PSU มือสอง', () => {
  it('PSU มือหนึ่งไม่เตือน', () => {
    expect(find(toItems(goodBuild()), 'U02')).toEqual([]);
  });

  it('PSU มือสองอายุไม่เกิน 5 ปี เตือนแบบปกติ', () => {
    const p = { ...psu(), releaseYear: 2022 };
    const issues = find([item(p, 1, 'A')], 'U02', { items: [], currentYear: 2026 });
    expect(issues[0]?.title).toBe('PSU มือสอง');
  });

  it('PSU มือสองอายุเกิน 5 ปี เตือนหนักขึ้น', () => {
    const p = { ...psu(), releaseYear: 2019 };
    const issues = find([item(p, 1, 'C')], 'U02', { items: [], currentYear: 2026 });
    expect(issues[0]?.title).toContain('อายุเกิน 5 ปี');
    expect(issues[0]?.fix).toContain('ควรซื้อใหม่');
  });

  it('ไม่ทราบปีวางขายเตือนแบบปกติ', () => {
    const p = { ...psu(), releaseYear: null };
    expect(find([item(p, 1, 'B')], 'U02')[0]?.title).toBe('PSU มือสอง');
  });
});

describe('U03 เก็บข้อมูลมือสอง', () => {
  it('SSD มือหนึ่งไม่เตือน', () => {
    expect(find([item(storage())], 'U03')).toEqual([]);
  });

  it('รวม SSD มือสองทุกชิ้นไว้ในคำเตือนเดียว', () => {
    const a = storage();
    const b = storage({ capacityGb: 2000 });
    const issues = find([item(a, 1, 'A'), item(b, 1, 'B'), item(storage())], 'U03');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.partIds).toEqual([a.id, b.id]);
  });
});

describe('U04 ไม่มีประกันเหลือ', () => {
  it('ไม่กรอกประกันหรือยังมีประกัน ไม่แจ้ง', () => {
    expect(
      find([item(gpu(), 1, 'B'), item(cpu(), 1, 'A', { warrantyMonthsLeft: 6 })], 'U04'),
    ).toEqual([]);
  });

  it('ประกันเหลือ 0 เดือนแจ้งระดับข้อมูล', () => {
    const issues = find([item(gpu(), 1, 'C', { warrantyMonthsLeft: 0 })], 'U04');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.level).toBe('info');
  });

  it('ของมือหนึ่งที่กรอก 0 ไม่นับ', () => {
    expect(find([item(gpu(), 1, 'new', { warrantyMonthsLeft: 0 })], 'U04')).toEqual([]);
  });
});

describe('U05 แพลตฟอร์มเก่า', () => {
  const settings = { legacySockets: ['OLD1'] };

  it('Socket ไม่อยู่ในรายการเลิกผลิตไม่แจ้ง', () => {
    expect(find([item(cpu(), 1, 'B')], 'U05', { items: [], settings })).toEqual([]);
  });

  it('CPU มือสองบน Socket เลิกผลิตแจ้งระดับข้อมูล', () => {
    const items = [item(cpu({ socket: 'old1' }), 1, 'B'), item(motherboard({ socket: 'OLD1' }))];
    const issues = find(items, 'U05', { items: [], settings });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.level).toBe('info');
    expect(issues[0]?.partIds).toHaveLength(2);
  });

  it('ของมือหนึ่งทั้งคู่ไม่แจ้ง แม้ Socket เลิกผลิต', () => {
    expect(find([item(cpu({ socket: 'OLD1' }))], 'U05', { items: [], settings })).toEqual([]);
  });

  it('ค่าตั้งต้นไม่มี Socket เลิกผลิต จึงไม่แจ้ง', () => {
    expect(find([item(cpu({ socket: 'OLD1' }), 1, 'C')], 'U05')).toEqual([]);
  });
});

describe('U06 ราคาถูกผิดปกติ', () => {
  it('ราคาที่เสนอ 60% ขึ้นไปของราคากลางไม่เตือน', () => {
    expect(find([item(gpu(), 1, 'B', { offeredPrice: 6000, usedPrice: 10000 })], 'U06')).toEqual(
      [],
    );
  });

  it('ราคาที่เสนอต่ำกว่า 60% เตือนพร้อมบอกเปอร์เซ็นต์', () => {
    const issues = find([item(gpu(), 1, 'B', { offeredPrice: 5000, usedPrice: 10000 })], 'U06');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('50%');
  });

  it('ยังไม่มีราคากลางหรือไม่ได้กรอกราคา ไม่เตือน', () => {
    expect(find([item(gpu(), 1, 'B', { offeredPrice: 1000 })], 'U06')).toEqual([]);
    expect(find([item(gpu(), 1, 'B', { usedPrice: 10000 })], 'U06')).toEqual([]);
  });
});

describe('ราคารวมแบบผสม', () => {
  it('มือสองใช้ราคาที่เสนอ ถ้าไม่กรอกใช้ราคากลาง แล้วคำนวณยอดประหยัด', () => {
    const g = gpu({}, 12000);
    const s = storage({}, 1500);
    const result = checkBuild({
      items: [
        item(g, 1, 'B', { usedPrice: 7000 }),
        item(s, 1, 'A', { offeredPrice: 1000, usedPrice: 1100 }),
      ],
    });
    expect(result.price.total).toBe(8000);
    expect(result.price.totalNew).toBe(13500);
    expect(result.price.saved).toBe(5500);
  });
});
