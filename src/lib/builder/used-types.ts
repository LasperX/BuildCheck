import type {
  ItemCondition,
  OfferVerdict,
  UsedConfidence,
  UsedGrade,
  UsedSource,
  UsedStat,
} from '@/lib/compat';
import type { CategorySlug } from '@/lib/parts/spec-fields';

// ชนิดข้อมูลและป้ายภาษาไทยของส่วนมือสอง ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์

export type UsedStatView = UsedStat & {
  /** วันที่คำนวณล่าสุด (ISO) ราคาประมาณการที่คำนวณสดเป็นวันนี้ */
  updatedAt: string;
};

/** ราคากลางครบ 3 เกรดของอะไหล่หนึ่งชิ้น */
export type UsedPriceSet = Record<UsedGrade, UsedStatView>;

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  new: 'มือหนึ่ง',
  A: 'มือสอง เกรด A',
  B: 'มือสอง เกรด B',
  C: 'มือสอง เกรด C',
};

export const GRADE_LABELS: Record<UsedGrade, { short: string; detail: string }> = {
  A: { short: 'A', detail: 'ดีมาก มีประกัน' },
  B: { short: 'B', detail: 'ใช้งานปกติ มีรอย' },
  C: { short: 'C', detail: 'มีตำหนิ ไม่มีกล่อง' },
};

export const SOURCE_LABELS: Record<UsedSource, string> = {
  reports: 'จากรายงานของสมาชิก',
  survey: 'จากการสำรวจตลาดของแอดมิน',
  estimate: 'ประมาณจากสูตรค่าเสื่อม',
};

export const CONFIDENCE_LABELS: Record<UsedConfidence, string> = {
  high: 'ความน่าเชื่อถือสูง',
  medium: 'ความน่าเชื่อถือกลาง',
  estimate: 'ประมาณการ',
};

export const VERDICT_LABELS: Record<OfferVerdict, string> = {
  suspicious: 'ถูกผิดปกติ ระวังของเสียหรือมิจฉาชีพ',
  cheap: 'ถูก',
  fair: 'สมเหตุสมผล',
  expensive: 'แพงกว่าตลาด ต่อรองได้',
};

export const REPORT_TYPE_LABELS = {
  listed: 'เห็นประกาศขาย',
  bought: 'ซื้อจริง',
  sold: 'ขายได้จริง',
} as const;

export const CHANNEL_LABELS = {
  facebook: 'กลุ่ม Facebook',
  marketplace_app: 'แอปซื้อขาย',
  shop: 'ร้านมือสอง',
  friend: 'คนรู้จัก',
  other: 'อื่น ๆ',
} as const;

export type ReportChannel = keyof typeof CHANNEL_LABELS;

/** เช็กลิสต์ก่อนซื้อมือสองแยกตามหมวด (หัวข้อ 3.11) */
export const BUYING_CHECKLIST: Record<CategorySlug, string[]> = {
  cpu: ['ดูขา CPU หรือฐาน Socket ว่าไม่งอ', 'ขอดูรันโปรแกรมทดสอบความร้อนและความเสถียร'],
  motherboard: [
    'ดูขาใน Socket ไม่งอและไม่มีรอยไหม้',
    'ลองเปิดเครื่องเข้า BIOS ได้',
    'ทดสอบช่องแรม ช่อง M.2 และพอร์ต USB',
  ],
  ram: ['รันโปรแกรมทดสอบหน่วยความจำอย่างน้อย 1 รอบ', 'ดูว่าความจุและความเร็วตรงตามที่ประกาศ'],
  gpu: [
    'ขอดูรันโปรแกรมทดสอบอย่างน้อย 15 นาที',
    'ดูอุณหภูมิและเสียงพัดลมขณะทดสอบ',
    'ถามประวัติการใช้ขุดเหรียญ',
  ],
  storage: ['ขอดูค่า Health ต้องไม่ต่ำกว่า 90%', 'ดูชั่วโมงการใช้งานและปริมาณข้อมูลที่เขียนไปแล้ว'],
  psu: ['แนะนำซื้อใหม่', 'ถ้าจำเป็นต้องซื้อ เลือกตัวที่ยังมีประกันและไม่มีกลิ่นไหม้'],
  case: ['ดูฝาข้าง กระจก และพอร์ตด้านหน้าไม่เสีย', 'ดูว่ามีน็อตและอุปกรณ์ติดตั้งครบ'],
  cooler: [
    'ดูขาจับ (Bracket) ตรงกับ Socket ที่ใช้',
    'ชุดน้ำ: ดูว่าไม่มีรอยรั่วและปั๊มไม่มีเสียงดัง',
  ],
};
