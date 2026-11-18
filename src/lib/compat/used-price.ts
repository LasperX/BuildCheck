import type { CategorySlug } from '@/lib/parts/spec-fields';

// ราคาตลาดมือสอง หัวข้อ 4.6
// ทุกฟังก์ชันในไฟล์นี้เป็นฟังก์ชันล้วน รับข้อมูลเข้า คืนผลออก ไม่อ่านฐานข้อมูลและไม่อ่านนาฬิกาเอง
// (วันที่ "วันนี้" ส่งเข้ามาเป็นพารามิเตอร์) จึงทดสอบได้แน่นอนทุกครั้ง
//
// ระบบเลือกราคากลางจาก 3 แหล่งตามลำดับ
//   1. รายงานจากสมาชิกที่แอดมินอนุมัติ ช่วง 60 วันล่าสุด ต้องมีอย่างน้อย 3 รายงานในเกรดนั้น
//   2. ราคาที่แอดมินสำรวจตลาดเอง ใช้ราคาล่าสุดไปจนกว่าแอดมินจะบันทึกราคาใหม่ (ไม่มีวันหมดอายุ)
//   3. สูตรประมาณค่าเสื่อมจากราคาใหม่

export type UsedGrade = 'A' | 'B' | 'C';
export type UsedSource = 'reports' | 'survey' | 'estimate';
export type UsedConfidence = 'high' | 'medium' | 'estimate';
export type ReportType = 'listed' | 'bought' | 'sold';

export const USED_GRADES: readonly UsedGrade[] = ['A', 'B', 'C'];

export type UsedSettings = {
  /** สัดส่วนราคาที่เหลือต่อปีของแต่ละหมวด (r) */
  depreciationRates: Record<CategorySlug, number>;
  /** ตัวคูณตามเกรด (k) */
  gradeFactors: Record<UsedGrade, number>;
  /** ใช้รายงานย้อนหลังกี่วัน */
  reportWindowDays: number;
};

export const DEFAULT_USED_SETTINGS: UsedSettings = {
  depreciationRates: {
    cpu: 0.8,
    gpu: 0.75,
    ram: 0.75,
    motherboard: 0.7,
    storage: 0.7,
    case: 0.7,
    cooler: 0.7,
    psu: 0.65,
  },
  gradeFactors: { A: 1, B: 0.9, C: 0.75 },
  reportWindowDays: 60,
};

/** ต้องมีรายงานอย่างน้อยเท่านี้จึงใช้แหล่งรายงาน */
export const MIN_REPORTS = 3;
/** รายงานตั้งแต่เท่านี้ขึ้นไป ความน่าเชื่อถือ "สูง" */
export const HIGH_CONFIDENCE_REPORTS = 10;

export type UsedReport = {
  price: number;
  reportType: ReportType;
  /** วันที่เห็นหรือซื้อขาย รูปแบบ YYYY-MM-DD */
  seenAt: string;
};

export type UsedSurvey = {
  minPrice: number;
  maxPrice: number;
  surveyedAt: string;
};

export type UsedStat = {
  grade: UsedGrade;
  /** ราคากลาง */
  median: number;
  /** ช่วงราคาที่พบบ่อย (ประมาณการไม่มีช่วง) */
  p25: number | null;
  p75: number | null;
  reportCount: number;
  source: UsedSource;
  confidence: UsedConfidence;
};

/** ปัดเป็นหลัก 50 บาท เช่น 6,075 → 6,100 · 6,020 → 6,000 */
export const roundTo50 = (value: number) => Math.round(value / 50) * 50;

const DAY_MS = 86_400_000;

/** จำนวนวันระหว่างวันที่สองวัน (YYYY-MM-DD) นับแบบ UTC จึงไม่เพี้ยนตามเขตเวลา */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/**
 * ค่าที่เปอร์เซ็นไทล์ p (0–1) แบบประมาณเชิงเส้นระหว่างสองค่า (วิธีเดียวกับ Excel PERCENTILE.INC)
 * values ต้องเรียงจากน้อยไปมากแล้ว
 */
export function quantile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * p;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  const a = sorted[lower] ?? 0;
  const b = sorted[upper] ?? a;
  return a + (b - a) * (pos - lower);
}

/**
 * ตัดค่าผิดปกติด้วยวิธี IQR
 *   IQR = Q3 − Q1
 *   ทิ้งค่าที่ต่ำกว่า Q1 − 1.5 × IQR หรือสูงกว่า Q3 + 1.5 × IQR
 * เช่นมีคนพิมพ์ราคาเกินไปหนึ่งหลัก ค่านั้นจะถูกตัดออกก่อนคำนวณราคากลาง
 */
export function iqrBounds(values: readonly number[]): { low: number; high: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  return { low: q1 - 1.5 * iqr, high: q3 + 1.5 * iqr };
}

/**
 * น้ำหนักของรายงานหนึ่งรายการ = น้ำหนักตามอายุ × น้ำหนักตามประเภท
 *   อายุ 0–14 วัน × 1.0 · 15–30 วัน × 0.75 · 31–60 วัน × 0.5
 *   ซื้อ/ขายได้จริง × 1.0 · เห็นประกาศขาย × 0.8 (ราคาประกาศมักสูงกว่าราคาที่ตกลงกันจริง)
 */
export function reportWeight(ageDays: number, reportType: ReportType): number {
  const age = ageDays <= 14 ? 1 : ageDays <= 30 ? 0.75 : 0.5;
  const type = reportType === 'listed' ? 0.8 : 1;
  return age * type;
}

/**
 * เปอร์เซ็นไทล์แบบถ่วงน้ำหนัก: เรียงราคาจากน้อยไปมาก แล้วสะสมน้ำหนักไปเรื่อย ๆ
 * ราคาแรกที่น้ำหนักสะสมถึง p ของน้ำหนักรวม คือคำตอบ
 * p = 0.5 คือมัธยฐานถ่วงน้ำหนัก (ราคากลาง) · ถ้าสะสมได้พอดีครึ่งหนึ่งระหว่างสองราคา ใช้ค่าเฉลี่ยของสองราคานั้น
 */
export function weightedPercentile(
  entries: readonly { value: number; weight: number }[],
  p: number,
): number {
  const sorted = entries.filter((e) => e.weight > 0).sort((a, b) => a.value - b.value);
  if (sorted.length === 0) return 0;
  const totalWeight = sorted.reduce((sum, e) => sum + e.weight, 0);
  const target = totalWeight * p;
  let running = 0;
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    if (!entry) break;
    running += entry.weight;
    // เทียบแบบเผื่อเศษทศนิยม 0.1 + 0.2 ไม่ได้เท่ากับ 0.3 พอดีในคอมพิวเตอร์
    if (Math.abs(running - target) < 1e-9) {
      const next = sorted[i + 1];
      return next ? (entry.value + next.value) / 2 : entry.value;
    }
    if (running > target) return entry.value;
  }
  return sorted[sorted.length - 1]?.value ?? 0;
}

export type ReportStats = {
  median: number;
  p25: number;
  p75: number;
  /** จำนวนรายงานที่ใช้จริงหลังตัดค่าผิดปกติ */
  count: number;
};

/**
 * ราคากลางจากรายงานของสมาชิก (แหล่งที่ 1)
 *   1. เลือกรายงานใน 60 วันล่าสุด (ไม่นับรายงานที่ลงวันที่ในอนาคต)
 *   2. ตัดค่าผิดปกติด้วย IQR
 *   3. ราคากลาง = มัธยฐานถ่วงน้ำหนัก · ช่วงราคาที่พบบ่อย = เปอร์เซ็นไทล์ 25 ถึง 75
 *   4. ปัดเป็นหลัก 50 บาท
 * เหลือรายงานไม่ถึง 3 รายการ คืน null ให้ไปใช้แหล่งถัดไป
 */
export function statsFromReports(
  reports: readonly UsedReport[],
  today: string,
  windowDays = DEFAULT_USED_SETTINGS.reportWindowDays,
): ReportStats | null {
  const inWindow = reports
    .map((report) => ({ ...report, age: daysBetween(report.seenAt, today) }))
    .filter((report) => report.age >= 0 && report.age <= windowDays && report.price > 0);
  if (inWindow.length < MIN_REPORTS) return null;

  const { low, high } = iqrBounds(inWindow.map((report) => report.price));
  const kept = inWindow.filter((report) => report.price >= low && report.price <= high);
  if (kept.length < MIN_REPORTS) return null;

  const entries = kept.map((report) => ({
    value: report.price,
    weight: reportWeight(report.age, report.reportType),
  }));
  return {
    median: roundTo50(weightedPercentile(entries, 0.5)),
    p25: roundTo50(weightedPercentile(entries, 0.25)),
    p75: roundTo50(weightedPercentile(entries, 0.75)),
    count: kept.length,
  };
}

/**
 * สูตรประมาณค่าเสื่อม (แหล่งที่ 3)
 *
 *   P_used = P_new × r^t × k
 *
 *   t = อายุนับจากปีที่วางขาย (ปี) ไม่ทราบปีวางขายให้ t = 1 · ปีวางขายอยู่ในอนาคตให้ t = 0
 *   r = สัดส่วนราคาที่เหลือต่อปีของหมวด · k = ตัวคูณเกรด
 *
 * ตัวอย่างในเอกสาร: การ์ดจอ 12,000 บาท วางขายมา 2 ปี เกรด B
 *   12,000 × 0.75² × 0.90 = 6,075 → ปัดเป็น 6,100 บาท
 */
export function estimateUsedPrice(
  newPrice: number,
  category: CategorySlug,
  releaseYear: number | null,
  grade: UsedGrade,
  currentYear: number,
  settings: UsedSettings = DEFAULT_USED_SETTINGS,
): number {
  const years = releaseYear === null ? 1 : Math.max(0, currentYear - releaseYear);
  const rate = settings.depreciationRates[category];
  const factor = settings.gradeFactors[grade];
  return roundTo50(newPrice * rate ** years * factor);
}

/**
 * ราคาสำรวจของแอดมินใช้ได้ไหม (หัวข้อ 4.6 แหล่งที่ 2)
 * ไม่มีวันหมดอายุ: แอดมินอัปเดตราคาเอง ระบบใช้ราคาล่าสุดไปจนกว่าจะบันทึกราคาใหม่
 * (เดิมใช้ได้ 90 วัน แล้วตกไปใช้สูตรค่าเสื่อม ราคาที่แอดมินตั้งใจกรอกจึงหายไปเอง)
 * ยกเว้นราคาที่ลงวันที่ในอนาคต ยังไม่ใช้จนกว่าจะถึงวันนั้น
 */
const isUsableSurvey = (survey: UsedSurvey, today: string) =>
  daysBetween(survey.surveyedAt, today) >= 0;

/**
 * ราคาสำรวจที่ใช้กับเกรดหนึ่ง
 * - เกรดนั้นมีราคาสำรวจ → ใช้ตามนั้น
 * - ไม่มี แต่เกรดอื่นของรุ่นเดียวกันมี → เทียบจากเกรดนั้นด้วยตัวคูณเกรด
 *     P_เกรดนี้ = P_เกรดที่สำรวจ × k_เกรดนี้ ÷ k_เกรดที่สำรวจ   (ปัดหลัก 50)
 *   เช่นสำรวจเกรด B ได้ 1,400 บาท (k = 0.90) เกรด A (k = 1.00) = 1,400 × 1.00 ÷ 0.90 ≈ 1,550 บาท
 *   ถ้าไม่ทำแบบนี้ เกรดที่ไม่ได้สำรวจจะตกไปใช้สูตรค่าเสื่อม ซึ่งรุ่นเก่ามากได้ราคาต่ำกว่าเกรดที่แย่กว่า
 * เลือกเกรดต้นทางตามลำดับ B → A → C (B คือสภาพทั่วไป สำรวจบ่อยที่สุด)
 */
export function surveyForGrade(
  surveys: Partial<Record<UsedGrade, UsedSurvey>>,
  grade: UsedGrade,
  today: string,
  settings: UsedSettings = DEFAULT_USED_SETTINGS,
): UsedSurvey | null {
  const own = surveys[grade];
  if (own && isUsableSurvey(own, today)) return own;
  for (const from of ['B', 'A', 'C'] as const) {
    const base = surveys[from];
    if (from === grade || !base || !isUsableSurvey(base, today)) continue;
    const ratio = settings.gradeFactors[grade] / settings.gradeFactors[from];
    return {
      minPrice: roundTo50(base.minPrice * ratio),
      maxPrice: roundTo50(base.maxPrice * ratio),
      surveyedAt: base.surveyedAt,
    };
  }
  return null;
}

export type PerfAnchor = { perf: number; price: number };

/**
 * กรอบราคาประมาณการของรุ่นที่มีแต่มือสอง (เฉพาะหมวดที่มีคะแนนประสิทธิภาพ: CPU และการ์ดจอ)
 * เทียบกับราคามือสองของรุ่นที่ยังขายมือหนึ่งในหมวดเดียวกันและเกรดเดียวกัน (anchors)
 *
 *   ขั้นต่ำ = ราคาต่ำสุดในกลุ่มรุ่นที่ยังขายซึ่งคะแนนใกล้ที่สุดจากด้านล่าง (คะแนน ≤ รุ่นนี้)
 *             รุ่นที่แรงกว่า ไม่ควรถูกกว่ารุ่นที่ช้ากว่าซึ่งคะแนนใกล้กันที่สุด
 *   เพดาน  = ราคาต่ำสุดของรุ่นที่ยังขายมือหนึ่งซึ่งคะแนน ≥ รุ่นนี้   (รุ่นที่ช้ากว่า ไม่ควรแพงกว่า)
 *             และไม่เกิน ceiling ที่ส่งมา (ราคาเปิดตัว × ตัวคูณเกรด: มือสองไม่ควรแพงกว่าตอนวางขายใหม่)
 *
 * ขั้นต่ำไม่ใช้ราคาสูงสุดของทุกรุ่นที่ช้ากว่า เพราะราคามือหนึ่งไม่ได้เรียงตามคะแนนเสมอ
 * เช่นการ์ดรุ่นใหม่คะแนน 65 ราคาสูงกว่ารุ่นคะแนน 66 เกือบเท่าตัว ถ้าใช้ราคาสูงสุด รุ่นคะแนน 68
 * จะถูกดันขึ้นไปเกินราคาเปิดตัวของตัวเอง ทั้งที่รุ่นคะแนน 66 ที่แรงกว่ารุ่นแพงนั้นขายถูกกว่ามาก
 * ส่วน CPU รุ่นมีกราฟิกในตัวหรือรุ่น APU ที่แพงกว่าแต่คะแนนต่ำกว่า ก็ไม่ดันราคารุ่นอื่นแล้วเหมือนกัน
 *
 * ถ้าขั้นต่ำสูงกว่าเพดาน ใช้เพดานเป็นหลัก · ไม่มีรุ่นให้เทียบฝั่งไหน ฝั่งนั้นไม่จำกัด
 */
export function clampToPerfAnchors(
  estimate: number,
  perf: number,
  anchors: readonly PerfAnchor[],
  ceiling = Infinity,
): number {
  const slower = anchors.filter((anchor) => anchor.perf <= perf);
  const nearestPerf = Math.max(...slower.map((anchor) => anchor.perf));
  const nearest = slower
    .filter((anchor) => anchor.perf === nearestPerf)
    .map((anchor) => anchor.price);
  const faster = anchors.filter((anchor) => anchor.perf >= perf).map((anchor) => anchor.price);
  const cap = Math.min(...faster, ceiling);
  const floor = Math.min(nearest.length ? Math.min(...nearest) : 0, cap);
  return Math.min(Math.max(estimate, floor), cap);
}

export type UsedPriceInput = {
  part: {
    price: number;
    categorySlug: CategorySlug;
    releaseYear: number | null;
    /** ไม่ระบุ = ยังขายมือหนึ่ง */
    availability?: 'new' | 'used_only' | undefined;
  };
  grade: UsedGrade;
  /** รายงานที่อนุมัติแล้วของรุ่นและเกรดนี้ */
  reports: readonly UsedReport[];
  /** ราคาสำรวจล่าสุดของรุ่นและเกรดนี้ */
  survey: UsedSurvey | null;
  today: string;
  settings?: UsedSettings;
};

/** เลือกราคากลางตามลำดับแหล่ง 1 → 2 → 3 และบอกเสมอว่ามาจากแหล่งไหน */
export function resolveUsedStat(input: UsedPriceInput): UsedStat {
  const settings = input.settings ?? DEFAULT_USED_SETTINGS;
  const { grade } = input;

  const fromReports = statsFromReports(input.reports, input.today, settings.reportWindowDays);
  if (fromReports) {
    return {
      grade,
      median: fromReports.median,
      p25: fromReports.p25,
      p75: fromReports.p75,
      reportCount: fromReports.count,
      source: 'reports',
      confidence: fromReports.count >= HIGH_CONFIDENCE_REPORTS ? 'high' : 'medium',
    };
  }

  const survey = input.survey;
  if (survey && isUsableSurvey(survey, input.today)) {
    return {
      grade,
      // ราคากลางของช่วงที่สำรวจ = จุดกึ่งกลางระหว่างต่ำสุดกับสูงสุด
      median: roundTo50((survey.minPrice + survey.maxPrice) / 2),
      p25: survey.minPrice,
      p75: survey.maxPrice,
      reportCount: 0,
      source: 'survey',
      confidence: 'medium',
    };
  }

  const currentYear = Number(input.today.slice(0, 4));
  return {
    grade,
    median: estimateUsedPrice(
      input.part.price,
      input.part.categorySlug,
      // รุ่นที่ยังขายมือหนึ่ง: ราคาในระบบคือราคาร้านวันนี้ ซึ่งลดลงตามอายุมาแล้ว
      // จึงไม่หักตามปีวางขายซ้ำอีก ใช้ t = 1 เสมอ (ส่ง null = ไม่ทราบปี)
      input.part.availability === 'used_only' ? input.part.releaseYear : null,
      grade,
      currentYear,
      settings,
    ),
    p25: null,
    p75: null,
    reportCount: 0,
    source: 'estimate',
    confidence: 'estimate',
  };
}

export type OfferVerdict = 'suspicious' | 'cheap' | 'fair' | 'expensive';

/**
 * ประเมินราคาที่ผู้ขายเสนอเทียบกับราคากลาง M
 *   ต่ำกว่า 60% ของ M → ถูกผิดปกติ (ระวังของเสียหรือมิจฉาชีพ)
 *   60% ถึงต่ำกว่า 90% → ถูก
 *   90% ถึง 110% → สมเหตุสมผล
 *   มากกว่า 110% → แพงกว่าตลาด ต่อรองได้
 */
export function assessOffer(
  offered: number,
  median: number,
): { verdict: OfferVerdict; ratio: number } {
  const ratio = median > 0 ? offered / median : 1;
  const verdict: OfferVerdict =
    ratio < 0.6 ? 'suspicious' : ratio < 0.9 ? 'cheap' : ratio <= 1.1 ? 'fair' : 'expensive';
  return { verdict, ratio };
}

/** วันจันทร์ของสัปดาห์ที่วันที่นั้นอยู่ (YYYY-MM-DD) ใช้จัดกลุ่มกราฟแนวโน้มรายสัปดาห์ */
export function weekStart(date: string): string {
  const time = Date.parse(`${date}T00:00:00Z`);
  const day = new Date(time).getUTCDay(); // 0 = อาทิตย์
  const offset = (day + 6) % 7;
  return new Date(time - offset * DAY_MS).toISOString().slice(0, 10);
}

/**
 * แนวโน้มราคากลางรายสัปดาห์ของหนึ่งเกรด: แต่ละสัปดาห์ใช้มัธยฐานถ่วงน้ำหนักตามประเภทรายงาน
 * (ไม่ถ่วงตามอายุ เพราะทุกรายงานในสัปดาห์เดียวกันอายุใกล้กัน)
 */
export function weeklyTrend(
  reports: readonly UsedReport[],
): { week: string; median: number; count: number }[] {
  const groups = new Map<string, UsedReport[]>();
  for (const report of reports) {
    const week = weekStart(report.seenAt);
    groups.set(week, [...(groups.get(week) ?? []), report]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, list]) => ({
      week,
      median: roundTo50(
        weightedPercentile(
          list.map((r) => ({ value: r.price, weight: reportWeight(0, r.reportType) })),
          0.5,
        ),
      ),
      count: list.length,
    }));
}
