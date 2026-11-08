// ชนิดข้อมูลของ Compatibility Engine
// Engine เป็นฟังก์ชันล้วน: รับข้อมูลอะไหล่เข้ามา คืนผลตรวจออกไป ไม่อ่านฐานข้อมูล
// จึงใช้โค้ดชุดเดียวกันได้ทั้งในเบราว์เซอร์ (แสดงผลทันที) และบนเซิร์ฟเวอร์ (ตรวจซ้ำตอนบันทึก)

import type { CategorySlug } from '@/lib/parts/spec-fields';

export type UsageType = 'gaming' | 'office' | 'creator' | 'streaming';
export type Level = 'error' | 'warning' | 'info';
export type CompatStatus = 'ok' | 'warning' | 'error';
export type ItemCondition = 'new' | 'A' | 'B' | 'C';

/** สถานะการขายของอะไหล่: new = ยังมีขายมือหนึ่ง, used_only = เลิกขายมือหนึ่งแล้ว หาได้แต่มือสอง */
export type PartAvailability = 'new' | 'used_only';

export type CpuSpec = {
  socket: string;
  generation: string;
  cores: number;
  threads: number;
  baseClockGhz: number | null;
  boostClockGhz: number | null;
  tdpWatt: number;
  hasIgpu: boolean;
  includesCooler: boolean;
  memoryTypes: string[];
  perfScore: number;
};

export type MotherboardSpec = {
  socket: string;
  chipset: string;
  formFactor: string;
  memoryType: string;
  memorySlots: number;
  maxMemoryGb: number;
  maxMemorySpeed: number;
  m2Slots: number;
  sataPorts: number;
  supportedGenerations: string[];
  biosUpdateGenerations: string[];
  wifi: boolean;
};

export type RamSpec = {
  type: string;
  capacityPerStickGb: number;
  sticksInKit: number;
  speedMts: number;
  casLatency: number | null;
  rgb: boolean;
};

export type GpuSpec = {
  chipset: string;
  vramGb: number;
  lengthMm: number;
  slotWidth: number | null;
  tbpWatt: number;
  powerConnectors: Record<string, number>;
  perfScore: number;
};

export type StorageSpec = {
  type: 'NVMe' | 'SATA_SSD' | 'HDD' | string;
  interface: 'M2' | 'SATA' | string;
  capacityGb: number;
  readMbps: number | null;
  writeMbps: number | null;
};

export type PsuSpec = {
  wattage: number;
  efficiency: string;
  formFactor: string;
  modular: string;
  pcieConnectors: Record<string, number>;
};

export type CaseSpec = {
  supportedFormFactors: string[];
  maxGpuLengthMm: number;
  maxCoolerHeightMm: number;
  radiatorSupportMm: number[];
  psuFormFactors: string[];
  includedFans: number;
  sidePanel: string;
};

export type CoolerSpec = {
  type: 'air' | 'aio' | string;
  supportedSockets: string[];
  heightMm: number | null;
  radiatorMm: number | null;
  maxTdpWatt: number;
};

type PartBase = {
  id: number;
  brandName: string;
  model: string;
  price: number;
  powerWatt: number | null;
  releaseYear: number | null;
  /** ไม่ระบุ = new (ข้อมูลเก่าและเทสต์ที่สร้างก่อนมีช่องนี้) */
  availability?: PartAvailability;
};

// discriminated union: ดูค่า categorySlug แล้ว TypeScript รู้ทันทีว่า spec มีช่องอะไร
export type EnginePart =
  | (PartBase & { categorySlug: 'cpu'; spec: CpuSpec })
  | (PartBase & { categorySlug: 'motherboard'; spec: MotherboardSpec })
  | (PartBase & { categorySlug: 'ram'; spec: RamSpec })
  | (PartBase & { categorySlug: 'gpu'; spec: GpuSpec })
  | (PartBase & { categorySlug: 'storage'; spec: StorageSpec })
  | (PartBase & { categorySlug: 'psu'; spec: PsuSpec })
  | (PartBase & { categorySlug: 'case'; spec: CaseSpec })
  | (PartBase & { categorySlug: 'cooler'; spec: CoolerSpec });

export type PartOf<C extends CategorySlug> = Extract<EnginePart, { categorySlug: C }>;

export type EngineItem = {
  part: EnginePart;
  quantity: number;
  condition: ItemCondition;
  /** ราคาที่ผู้ขายเสนอจริง (มือสอง) */
  offeredPrice?: number | null;
  /** ราคากลางมือสองของเกรดนั้น ส่วนมือสองเพิ่มในเฟส 9 */
  usedPrice?: number | null;
  warrantyMonthsLeft?: number | null;
};

export type ItemOf<C extends CategorySlug> = EngineItem & { part: PartOf<C> };

export type EngineSettings = {
  /** ค่าเผื่อกำลังไฟ 0.30 = 30% ตามมติ Q2 */
  psuHeadroom: number;
  /** วัตต์ของเมนบอร์ดเมื่อแอดมินไม่ได้กรอก หัวข้อ 4.3 */
  motherboardDefaultWatt: number;
  /** น้ำหนักคะแนน CPU และการ์ดจอตามประเภทการใช้งาน หัวข้อ 4.4 */
  usageWeights: Record<UsageType, { cpu: number; gpu: number }>;
  /** Socket ที่เลิกผลิตแล้ว ใช้ในกฎ U05 แอดมินกรอกในหน้าตั้งค่า (ค่าตั้งต้นว่าง) */
  legacySockets: string[];
};

export type BuildInput = {
  items: EngineItem[];
  budget?: number | null;
  usage?: UsageType;
  settings?: Partial<EngineSettings>;
  /** ปีปัจจุบัน ใช้คำนวณอายุ PSU มือสองในกฎ U02 ไม่ส่งมาใช้ปีจากนาฬิกาเครื่อง */
  currentYear?: number;
};

export type RuleCode =
  | 'R01'
  | 'R02'
  | 'R03'
  | 'R04'
  | 'R05'
  | 'R06'
  | 'R07'
  | 'R08'
  | 'R09'
  | 'R10'
  | 'R11'
  | 'R12'
  | 'R13'
  | 'R14'
  | 'R15'
  | 'R16'
  | 'R17'
  | 'R18'
  | 'I01'
  | 'I02'
  | 'I03'
  | 'I04'
  | 'U01'
  | 'U02'
  | 'U03'
  | 'U04'
  | 'U05'
  | 'U06';

/** อะไหล่ทดแทนที่แนะนำ หน้าจัดสเปกใช้เปิดหน้าต่างเลือกอะไหล่พร้อมตัวกรองนี้ */
export type Suggestion = {
  category: CategorySlug;
  label: string;
  /** ตัวกรองสเปก เช่น { socket: ['AM5'] } */
  filter?: Record<string, string[]>;
};

export type Issue = {
  code: RuleCode;
  level: Level;
  title: string;
  /** สาเหตุเป็นภาษาไทย ระบุชื่ออะไหล่ที่เกี่ยวข้อง */
  message: string;
  /** วิธีแก้ */
  fix: string;
  partIds: number[];
  categories: CategorySlug[];
  suggest?: Suggestion;
};

export type PowerLevel = 'none' | 'ok' | 'warning' | 'error';

export type PowerResult = {
  /** วัตต์ที่ใช้จริงโดยประมาณ */
  totalWatt: number;
  /** ขนาด PSU ที่แนะนำ ปัดขึ้นเป็นหลัก 50 วัตต์ */
  recommendedWatt: number;
  /** PSU ที่เลือก ถ้ายังไม่เลือกเป็น null */
  psuWatt: number | null;
  /** สัดส่วนการใช้ไฟของ PSU 0.74 = 74% */
  load: number | null;
  level: PowerLevel;
  /** ค่าเผื่อกำลังไฟที่ใช้คำนวณ (จากค่าตั้งระบบ) ใช้แสดงข้อความบนเกจ */
  headroom: number;
  /** ใช้แสดงรายละเอียดว่าวัตต์มาจากไหน */
  breakdown: { label: string; watt: number }[];
};

export type PriceResult = {
  /** ราคารวมตามสภาพที่เลือก (ผสมมือหนึ่งมือสอง) */
  total: number;
  /** ราคาถ้าซื้อใหม่ทั้งชุด */
  totalNew: number;
  saved: number;
  overBudget: number | null;
};

export type ScoreResult = {
  /** คะแนนประสิทธิภาพ 0–100 */
  score: number;
  /** ความคุ้มค่า = คะแนน ÷ ราคารวม × 10,000 */
  value: number;
};

export type CheckResult = {
  status: CompatStatus;
  issues: Issue[];
  counts: Record<Level, number>;
  power: PowerResult;
  price: PriceResult;
  score: ScoreResult;
};
