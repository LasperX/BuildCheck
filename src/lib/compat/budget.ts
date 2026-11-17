// อัลกอริทึมจัดสเปกตามงบ หัวข้อ 4.5 (และมติ Q3)
// ฟังก์ชันล้วน รับรายการอะไหล่ทั้งหมดที่ขายอยู่ คืน 3 ตัวเลือกที่ไม่มีปัญหาระดับผิดพลาด
//
// ภาพรวม
//   assemble(งบเป้าหมาย, เพดานราคา) = ประกอบสเปก 1 ชุดตามขั้นตอน 1–9 ของเอกสาร
//   buildForTarget(งบเป้าหมาย)      = เรียก assemble ซ้ำ ลดรุ่นเมื่อเกินงบ (ข้อ 10) และอัปเกรดเมื่อเหลือ (ข้อ 11)
//   generateBudgetBuilds(...)        = สร้างตัวเลือก ประหยัด / สมดุล / คุ้มสุด (ข้อ 12)
//
// "เพดานราคา" (caps) คือราคาสูงสุดที่ยอมให้หมวดนั้น การลดรุ่นทำโดยตั้งเพดานให้ต่ำกว่าชิ้นปัจจุบัน 1 บาท
// แล้วประกอบใหม่ทั้งชุด วิธีนี้ทำให้ชิ้นอื่นที่ต้องเข้ากัน (เช่นเมนบอร์ดตาม Socket) ถูกเลือกใหม่ให้ถูกต้องเสมอ
//
// ตัวเลือก "ยอมใช้มือสอง" (หัวข้อ 3.11): ก่อนเริ่ม หมวดที่ยอมเป็นมือสองจะใช้ราคากลางมือสองแทนราคาใหม่
// (เฉพาะชิ้นที่มือสองถูกกว่า) อัลกอริทึมจึงเห็นของมือสองเป็นของที่ถูกลงแล้วเลือกตามปกติ
// เมื่อได้ชุดแล้วค่อยเปลี่ยนชิ้นเหล่านั้นกลับเป็นอะไหล่ตัวจริงที่ระบุสภาพ "มือสอง" เพื่อให้กฎ U01–U06 ตรวจได้

import type { CategorySlug } from '@/lib/parts/spec-fields';

import { isUsedOnly } from './availability';
import { checkBuild } from './index';
import { buildContext } from './context';
import { calculatePower, recommendedPsuWatt } from './power';
import { norm, type Rule } from './rules/helpers';
import { r01CpuSocket } from './rules/r01-cpu-socket';
import { r02CpuChipset, r03CpuBios } from './rules/r02-r03-cpu-generation';
import { r08BoardCase, r09GpuLength, r10CoolerHeight, r11Radiator } from './rules/r08-r11-case-fit';
import { r12CoolerSocket, r13CoolerTdp } from './rules/r12-r13-cooler';
import { missingGpuConnectors, r15PsuCase, r16GpuConnectors } from './rules/r14-r16-psu';
import { r17StorageSlots } from './rules/r17-storage-slots';
import { resolveSettings } from './settings';
import type { UsedGrade } from './used-price';
import type {
  CheckResult,
  EngineItem,
  EngineSettings,
  EnginePart,
  PartOf,
  RuleCode,
  UsageType,
} from './types';

export type BudgetRatios = Record<CategorySlug, number>;

/** สัดส่วนงบตั้งต้นตามหัวข้อ 4.5 ออฟฟิศใช้การ์ดจอ 5% ระบายความร้อน 5% ตามมติ Q3 (รวม 100%) */
export const DEFAULT_BUDGET_RATIOS: Record<UsageType, BudgetRatios> = {
  gaming: {
    cpu: 0.2,
    gpu: 0.4,
    motherboard: 0.1,
    ram: 0.07,
    storage: 0.07,
    psu: 0.07,
    case: 0.06,
    cooler: 0.03,
  },
  office: {
    cpu: 0.3,
    gpu: 0.05,
    motherboard: 0.15,
    ram: 0.12,
    storage: 0.15,
    psu: 0.08,
    case: 0.1,
    cooler: 0.05,
  },
  creator: {
    cpu: 0.25,
    gpu: 0.3,
    motherboard: 0.1,
    ram: 0.12,
    storage: 0.1,
    psu: 0.06,
    case: 0.05,
    cooler: 0.02,
  },
  streaming: {
    cpu: 0.22,
    gpu: 0.35,
    motherboard: 0.1,
    ram: 0.09,
    storage: 0.09,
    psu: 0.07,
    case: 0.06,
    cooler: 0.02,
  },
};

/** แรมขั้นต่ำ (GB) ตามหัวข้อ 4.5 และมติ Q3: เล่นเกม 16 ขยับเป็น 32 ถ้ายังอยู่ในงบหมวดแรม */
export const MIN_RAM_GB: Record<UsageType, { min: number; preferred: number }> = {
  office: { min: 16, preferred: 16 },
  gaming: { min: 16, preferred: 32 },
  creator: { min: 32, preferred: 32 },
  streaming: { min: 32, preferred: 32 },
};

/**
 * ความจุที่เก็บข้อมูลขั้นต่ำ (GB) ตามประเภทการใช้งาน
 * เกมหนึ่งเกมใช้พื้นที่หลายสิบถึงร้อยกว่า GB จึงไม่จัด SSD 128–256 GB ให้เครื่องเล่นเกม
 * ใช้ 480 / 960 เพื่อรวมรุ่นที่ขายในชื่อ 480 GB / 500 GB / 512 GB และ 960 GB / 1 TB
 * เป็นเงื่อนไขบังคับเมื่อในระบบมีรุ่นที่ถึงขั้นต่ำ ถ้าไม่มีเลยจึงใช้รุ่นที่มี
 */
export const MIN_STORAGE_GB: Record<UsageType, number> = {
  office: 240,
  gaming: 480,
  streaming: 480,
  creator: 960,
};

export type BudgetInput = {
  budget: number;
  usage: UsageType;
  /** ยี่ห้อ CPU ที่ชอบ (ไม่บังคับ) เทียบกับชื่อยี่ห้อแบบไม่สนตัวพิมพ์ */
  cpuBrand?: string | null;
  /** อะไหล่ที่ขายอยู่ทุกหมวด */
  catalog: EnginePart[];
  ratios?: BudgetRatios;
  settings?: Partial<EngineSettings>;
  /** ยอมใช้มือสอง: หมวดที่ยอม เกรดที่ใช้คิดราคา และราคากลางมือสองของแต่ละชิ้น (รหัสอะไหล่ → บาท) */
  used?: {
    categories: readonly CategorySlug[];
    grade: UsedGrade;
    prices: Readonly<Record<number, number>>;
  } | null;
};

/** PSU ไม่ยอมเป็นมือสองเป็นค่าเริ่มต้น (หัวข้อ 3.11) เพราะ PSU เสียอาจพาอะไหล่อื่นเสียด้วย */
export const DEFAULT_USED_CATEGORIES: readonly CategorySlug[] = [
  'cpu',
  'motherboard',
  'ram',
  'gpu',
  'storage',
  'case',
  'cooler',
];

/**
 * เตรียมแคตตาล็อกสำหรับโหมดยอมใช้มือสอง
 * คืนแคตตาล็อกที่ราคาของชิ้นมือสองถูกแทนแล้ว และตัวแปลงรายการกลับเป็นอะไหล่ตัวจริง
 */
export function applyUsedPrices(
  catalog: EnginePart[],
  used: BudgetInput['used'],
): { catalog: EnginePart[]; restore: (items: EngineItem[]) => EngineItem[] } {
  // ชิ้นที่มีแต่มือสอง: ราคาในช่อง price คือราคาตอนเปิดตัว ซื้อในราคานั้นไม่ได้
  // จึงใช้ได้เฉพาะเมื่อผู้ใช้ยอมมือสองในหมวดนั้น และมีราคากลางมือสอง ไม่เช่นนั้นตัดออกจากแคตตาล็อก
  const usable = (part: EnginePart) =>
    !isUsedOnly(part) ||
    Boolean(used?.categories.includes(part.categorySlug) && used.prices[part.id]);
  if (!used || used.categories.length === 0) {
    return { catalog: catalog.filter(usable), restore: (items) => items };
  }
  const originals = new Map<number, EnginePart>();
  const priced = catalog.filter(usable).map((part) => {
    const usedPrice = used.prices[part.id];
    if (!used.categories.includes(part.categorySlug) || !usedPrice) return part;
    // ชิ้นที่ยังขายมือหนึ่ง ใช้ราคามือสองเมื่อถูกกว่าเท่านั้น ส่วนชิ้นที่มีแต่มือสองใช้ราคามือสองเสมอ
    if (!isUsedOnly(part) && usedPrice >= part.price) return part;
    originals.set(part.id, part);
    return { ...part, price: usedPrice } as EnginePart;
  });
  const restore = (items: EngineItem[]) =>
    items.map((item) => {
      const original = originals.get(item.part.id);
      if (!original) return item;
      return { ...item, part: original, condition: used.grade, usedPrice: item.part.price };
    });
  return { catalog: priced, restore };
}

export type BudgetOptionKind = 'economy' | 'balanced' | 'value';

export type BudgetOption = {
  kind: BudgetOptionKind;
  /** งบที่ตั้งเป้าของตัวเลือกนี้ */
  target: number;
  items: EngineItem[];
  result: CheckResult;
};

export type BudgetResult =
  | {
      ok: true;
      options: BudgetOption[];
      /** งบที่แบ่งให้แต่ละหมวด (บาท) ก่อนคืนงบของหมวดที่ไม่ต้องซื้อ */
      allocation: Record<CategorySlug, number>;
      /** ไม่พบ CPU ยี่ห้อที่เลือก จึงใช้ทุกยี่ห้อแทน */
      brandFallback: boolean;
    }
  | {
      ok: false;
      /** งบขั้นต่ำที่ทำได้สำหรับประเภทนี้ ปัดขึ้นหลักพัน ถ้าในระบบไม่มีอะไหล่พอเลยเป็น null */
      minimumBudget: number | null;
      allocation: Record<CategorySlug, number>;
    };

type Caps = Partial<Record<'cpu' | 'gpu' | 'ram' | 'storage', number>>;
type Mode = 'best' | 'cheapest';

type Catalog = {
  cpu: PartOf<'cpu'>[];
  motherboard: PartOf<'motherboard'>[];
  ram: PartOf<'ram'>[];
  gpu: PartOf<'gpu'>[];
  storage: PartOf<'storage'>[];
  psu: PartOf<'psu'>[];
  case: PartOf<'case'>[];
  cooler: PartOf<'cooler'>[];
};

const byPrice = <T extends EnginePart>(a: T, b: T) => a.price - b.price || a.id - b.id;
const byScoreDesc = <T extends PartOf<'cpu'> | PartOf<'gpu'>>(a: T, b: T) =>
  b.spec.perfScore - a.spec.perfScore || a.price - b.price || a.id - b.id;

function splitCatalog(parts: EnginePart[]): Catalog {
  const catalog: Catalog = {
    cpu: [],
    motherboard: [],
    ram: [],
    gpu: [],
    storage: [],
    psu: [],
    case: [],
    cooler: [],
  };
  for (const part of parts) (catalog[part.categorySlug] as EnginePart[]).push(part);
  return catalog;
}

const asItem = (part: EnginePart, quantity = 1): EngineItem => ({
  part,
  quantity,
  condition: 'new',
});

export function allocate(budget: number, ratios: BudgetRatios): Record<CategorySlug, number> {
  return Object.fromEntries(
    Object.entries(ratios).map(([cat, ratio]) => [cat, Math.round(budget * ratio)]),
  ) as Record<CategorySlug, number>;
}

/** คืนงบของหมวดที่ไม่ต้องซื้อให้หมวดที่เหลือ ตามสัดส่วนเดิม (มติ Q3 ข้อ 1) */
function redistribute(
  alloc: Record<CategorySlug, number>,
  ratios: BudgetRatios,
  skipped: CategorySlug[],
): Record<CategorySlug, number> {
  const freed = skipped.reduce((sum, cat) => sum + alloc[cat], 0);
  const remaining = (Object.keys(alloc) as CategorySlug[]).filter((cat) => !skipped.includes(cat));
  const weight = remaining.reduce((sum, cat) => sum + ratios[cat], 0);
  const next = { ...alloc };
  for (const cat of skipped) next[cat] = 0;
  for (const cat of remaining) next[cat] = alloc[cat] + Math.round((freed * ratios[cat]) / weight);
  return next;
}

/**
 * กฎที่ขั้นเลือกอะไหล่ใช้คัดหรือเรียงตัวเลือก ทุกข้อดูอะไหล่แค่ 2 หมวด ไม่ใช้กำลังไฟ ราคา หรือคะแนน
 * จึงรันเฉพาะกฎที่ต้องการแทน checkBuild ซึ่งคำนวณกำลังไฟ ราคา คะแนน และรันครบทุกกฎทุกครั้ง
 * (เดิมเรียก checkBuild ทุกครั้งที่ลองอะไหล่ 1 ชิ้น งบต่ำจึงใช้เวลาหลายวินาที)
 * ผลเหมือน checkBuild ทุกประการ เพราะปัญหาของรหัสกฎแต่ละข้อมาจากฟังก์ชันของกฎข้อนั้นเท่านั้น
 */
const STEP_RULES = {
  R01: r01CpuSocket,
  R02: r02CpuChipset,
  R03: r03CpuBios,
  R08: r08BoardCase,
  R09: r09GpuLength,
  R10: r10CoolerHeight,
  R11: r11Radiator,
  R12: r12CoolerSocket,
  R13: r13CoolerTdp,
  R15: r15PsuCase,
  R16: r16GpuConnectors,
  R17: r17StorageSlots,
} satisfies Partial<Record<RuleCode, Rule>>;

type StepCode = keyof typeof STEP_RULES;

function stepIssues(items: EngineItem[], codes: readonly StepCode[], settings: EngineSettings) {
  const ctx = buildContext(items, settings);
  const wanted: readonly RuleCode[] = codes;
  return codes
    .flatMap((code) => STEP_RULES[code](ctx))
    .filter((issue) => wanted.includes(issue.code));
}

/** ไม่มีปัญหาระดับผิดพลาดในกฎที่ระบุ */
function passes(items: EngineItem[], codes: readonly StepCode[], settings: EngineSettings) {
  return !stepIssues(items, codes, settings).some((issue) => issue.level === 'error');
}

function hasWarning(items: EngineItem[], codes: readonly StepCode[], settings: EngineSettings) {
  return stepIssues(items, codes, settings).some((issue) => issue.level === 'warning');
}

/**
 * เรียงชิ้นที่ไม่ติดคำเตือนก่อน ระดับเดียวกันเรียงตามราคา
 * ตรวจคำเตือนครั้งเดียวต่อชิ้นก่อนเรียง ไม่ตรวจในตัวเปรียบเทียบ ซึ่งจะตรวจซ้ำทุกครั้งที่เทียบ
 */
function warnedLast<T extends EnginePart>(parts: readonly T[], warned: (part: T) => boolean): T[] {
  return parts
    .map((part) => ({ part, warned: Number(warned(part)) }))
    .sort((a, b) => a.warned - b.warned || byPrice(a.part, b.part))
    .map(({ part }) => part);
}

/**
 * รายการตัวเลือกของหมวดที่เลือก "แรงสุดในงบ" (CPU การ์ดจอ)
 * มีชิ้นในงบ → เรียงจากคะแนนสูง · ไม่มีเลย → ใช้ชิ้นถูกสุดไปก่อน แล้วให้ขั้นลดรุ่นจัดการเรื่องงบ
 * มีเพดาน (กำลังลดรุ่น) → ต้องไม่เกินเพดานเท่านั้น
 */
function rankByScore<T extends PartOf<'cpu'> | PartOf<'gpu'>>(
  parts: T[],
  limit: number,
  cap: number | undefined,
  mode: Mode,
): T[] {
  const allowed = cap === undefined ? parts : parts.filter((part) => part.price <= cap);
  if (mode === 'cheapest') return [...allowed].sort(byPrice);
  // กำลังลดรุ่น: รุ่นที่แรงที่สุดที่ยังไม่เกินเพดาน = ลดลงหนึ่งขั้น
  if (cap !== undefined) return [...allowed].sort(byScoreDesc);
  const within = allowed.filter((part) => part.price <= limit).sort(byScoreDesc);
  return within.length ? within : [...allowed].sort(byPrice);
}

/** มี PSU ในแคตตาล็อกอย่างน้อยหนึ่งรุ่นที่จ่ายหัวไฟให้การ์ดจอนี้ได้ครบ (ไม่ติด R16) */
const poweredBySomePsu = (gpu: PartOf<'gpu'>, psus: readonly PartOf<'psu'>[]) =>
  psus.some(
    (psu) => missingGpuConnectors(gpu.spec.powerConnectors, psu.spec.pcieConnectors).length === 0,
  );

/**
 * ราคาต่ำสุดของแรม 2 แถวขึ้นไปที่ได้ความจุขั้นต่ำ (ไม่สนชนิดแรมและบอร์ด จึงเป็นขอบล่าง)
 * ไม่มีชุดแบบนั้นเลย ใช้ชุดถูกสุดที่ได้ความจุขั้นต่ำแทน
 */
function cheapestDualRam(kits: readonly PartOf<'ram'>[], minGb: number): number {
  let dual = Infinity;
  let any = Infinity;
  for (const kit of kits) {
    // ทุกจำนวนชุดที่ใส่ได้ในบอร์ดใหญ่สุด (ไม่เกิน 8 แถว) เช่น 1x16 สองชุด = 2 แถว
    for (let quantity = 1; kit.spec.sticksInKit * quantity <= 8; quantity++) {
      const gb = kit.spec.capacityPerStickGb * kit.spec.sticksInKit * quantity;
      if (gb < minGb) continue;
      const price = kit.price * quantity;
      any = Math.min(any, price);
      if (kit.spec.sticksInKit * quantity >= 2) dual = Math.min(dual, price);
    }
  }
  return Number.isFinite(dual) ? dual : any;
}

/** ราคาต่ำสุดของที่เก็บข้อมูลที่ถึงความจุขั้นต่ำ ไม่มีเลยใช้ชิ้นถูกสุด (ขอบล่างเหมือน cheapestDualRam) */
function cheapestStorage(drives: readonly PartOf<'storage'>[], minGb: number): number {
  const prices = (list: readonly PartOf<'storage'>[]) => list.map((drive) => drive.price);
  const big = drives.filter((drive) => drive.spec.capacityGb >= minGb);
  return Math.min(...prices(big.length ? big : drives));
}

type RamOption = {
  kit: PartOf<'ram'>;
  quantity: number;
  gb: number;
  sticks: number;
  price: number;
  penalty: number;
};

/**
 * ผลของขั้นเลือกอะไหล่ที่ใช้ซ้ำได้ภายในการจัดหนึ่งครั้ง (สร้างใหม่ทุกครั้งที่เรียก generateBudgetBuilds)
 * ขั้นลดรุ่นและอัปเกรดประกอบสเปกใหม่หลายร้อยรอบ แต่ละรอบลอง CPU เมนบอร์ด และ PSU ชุดเดิมซ้ำ
 * กฎใน STEP_RULES ดูอะไหล่แค่ 2 หมวด ผลจึงขึ้นกับ 2 ชิ้นนั้นเท่านั้น จำผลตามรหัสอะไหล่ได้
 * ส่วนแคตตาล็อก ประเภทการใช้งาน และการตั้งค่า คงที่ตลอดการจัดหนึ่งครั้ง (forceCategory เปลี่ยนแค่รายการ CPU หรือการ์ดจอ)
 */
type StepCache = {
  /** รหัสอะไหล่อีกหมวดที่ผ่านกฎเมื่อใส่คู่กับชิ้นนี้ คีย์ = รหัสกฎ|รหัสชิ้นนี้ */
  fits: Map<string, Set<number>>;
  /** เมนบอร์ดของ CPU นี้ เรียงตามลำดับที่จะลอง คีย์ = รหัส CPU|โหมด */
  boards: Map<string, PartOf<'motherboard'>[]>;
  /** ตัวเลือกแรมของบอร์ดนี้ก่อนตัดตามเพดาน */
  rams: Map<number, RamOption[]>;
  /** ที่เก็บข้อมูลที่ใส่บอร์ดนี้ได้และถึงเงื่อนไขขั้นต่ำ ก่อนตัดตามเพดาน */
  drives: Map<number, PartOf<'storage'>[]>;
  /** PSU ทุกรุ่น เรียงตามลำดับที่จะลองกับการ์ดจอนี้ คีย์ = รหัสการ์ดจอ (ไม่มี = 0)|โหมด */
  psus: Map<string, PartOf<'psu'>[]>;
  /** ชุดระบายความร้อนที่ใส่กับ CPU นี้ได้ เรียงตามลำดับที่จะลอง คีย์ = รหัส CPU|โหมด */
  coolers: Map<string, PartOf<'cooler'>[]>;
  /** การ์ดจอนี้มี PSU ในระบบที่จ่ายหัวไฟได้ครบไหม */
  powered: Map<number, boolean>;
};

const newStepCache = (): StepCache => ({
  fits: new Map(),
  boards: new Map(),
  rams: new Map(),
  drives: new Map(),
  psus: new Map(),
  coolers: new Map(),
  powered: new Map(),
});

function remember<K, V>(map: Map<K, V>, key: K, compute: () => V): V {
  const hit = map.get(key);
  if (hit !== undefined) return hit;
  const value = compute();
  map.set(key, value);
  return value;
}

type Context = {
  catalog: Catalog;
  usage: UsageType;
  ratios: BudgetRatios;
  settings: EngineSettings;
  cpuBrand: string | null;
  cache: StepCache;
};

/** รหัสของชิ้นใน others ที่ไม่ติดปัญหาระดับผิดพลาดของกฎ codes เมื่อใส่คู่กับ part */
function fitsWith(
  ctx: Context,
  part: EnginePart,
  others: readonly EnginePart[],
  codes: readonly StepCode[],
): Set<number> {
  return remember(
    ctx.cache.fits,
    `${codes.join()}|${part.id}`,
    () =>
      new Set(
        others
          .filter((other) => passes([asItem(part), asItem(other)], codes, ctx.settings))
          .map((other) => other.id),
      ),
  );
}

/** ประกอบสเปก 1 ชุดตามขั้นตอนข้อ 1–9 คืน null ถ้าประกอบไม่ได้ภายใต้เพดานที่ให้ */
function assemble(ctx: Context, target: number, caps: Caps, mode: Mode): EngineItem[] | null {
  const { catalog, usage, ratios, settings } = ctx;
  const base = allocate(target, ratios);
  // โหมดปกติเลือกชิ้นที่ไม่มีคำเตือนก่อน (ยอมจ่ายเพิ่มเล็กน้อย) ส่วนโหมดหาชุดถูกสุดดูราคาอย่างเดียว
  const prefer = (items: EngineItem[], codes: readonly StepCode[], s: EngineSettings) =>
    mode === 'best' && hasWarning(items, codes, s);

  // เช็กเร็วก่อนไล่ CPU ทุกรุ่น: ถ้าเพดานของแรมหรือที่เก็บข้อมูลต่ำกว่าชิ้นที่ถูกที่สุดที่ผ่านขั้นต่ำ
  // (แรม 2 แถวตามความจุขั้นต่ำ · ที่เก็บข้อมูลตามความจุขั้นต่ำ) ประกอบไม่ได้แน่นอน ไม่ต้องลองต่อ
  if (caps.ram !== undefined && caps.ram < cheapestDualRam(catalog.ram, MIN_RAM_GB[usage].min)) {
    return null;
  }
  if (
    caps.storage !== undefined &&
    caps.storage < cheapestStorage(catalog.storage, MIN_STORAGE_GB[usage])
  ) {
    return null;
  }

  const cpus = ctx.cpuBrand
    ? catalog.cpu.filter((cpu) => cpu.brandName.toLowerCase() === ctx.cpuBrand?.toLowerCase())
    : catalog.cpu;

  // ข้อ 2 เลือกการ์ดจอก่อน ยกเว้นออฟฟิศที่เลือก CPU ก่อน เพื่อรู้ว่าข้ามการ์ดจอได้ไหม (มติ Q3 ข้อ 2)
  const officeFirst = usage === 'office';
  let cpuOrder = rankByScore(cpus, base.cpu, caps.cpu, mode);
  // ออฟฟิศ: CPU ที่มีกราฟิกในตัวมาก่อน จะได้ไม่ต้องซื้อการ์ดจอ
  if (officeFirst) {
    cpuOrder = [...cpuOrder].sort((a, b) => Number(b.spec.hasIgpu) - Number(a.spec.hasIgpu));
  }
  const ranked = rankByScore(catalog.gpu, base.gpu, caps.gpu, mode);
  // โหมดปกติ: การ์ดจอที่มี PSU ในระบบจ่ายหัวไฟได้ครบ (ไม่ติด R16) มาก่อน ลำดับเดิมในแต่ละกลุ่มไม่เปลี่ยน
  // การ์ดที่ต้องใช้หัวแปลงยังเลือกได้ถ้าไม่มีทางอื่น
  const powered = (gpu: PartOf<'gpu'>) =>
    remember(ctx.cache.powered, gpu.id, () => poweredBySomePsu(gpu, catalog.psu));
  const gpuOrder =
    mode === 'best'
      ? [...ranked.filter(powered), ...ranked.filter((gpu) => !powered(gpu))]
      : ranked;

  for (const cpu of cpuOrder) {
    const skipGpu = officeFirst && cpu.spec.hasIgpu;
    const skipCooler = cpu.spec.includesCooler;
    const gpus: (PartOf<'gpu'> | null)[] = skipGpu ? [null] : gpuOrder;
    // ข้ามการ์ดจอได้เฉพาะออฟฟิศที่ CPU มีกราฟิกในตัว (ข้อ 2) ประเภทอื่นต้องมีการ์ดจอเสมอ
    if (gpus.length === 0) continue;
    for (const gpu of gpus.slice(0, 3)) {
      const skipped: CategorySlug[] = [];
      if (!gpu) skipped.push('gpu');
      if (skipCooler) skipped.push('cooler');
      const alloc = redistribute(base, ratios, skipped);
      const items = completeRest(ctx, alloc, caps, mode, cpu, gpu, !skipCooler);
      if (items) return items;
    }
  }
  return null;

  // ข้อ 4–9 หลังได้ CPU และการ์ดจอแล้ว
  // ผลตรวจกฎของแต่ละขั้นจำไว้ใน ctx.cache (ดู StepCache) ได้ลำดับและชิ้นที่เลือกเหมือนตรวจใหม่ทุกครั้ง
  // กฎแต่ละข้อตรวจกับอะไหล่ 2 ชิ้นที่กฎข้อนั้นดูเท่านั้น (ดู STEP_RULES) ผลจึงเหมือนตรวจทั้งชุด
  function completeRest(
    { catalog: c, usage: u, cache }: Context,
    alloc: Record<CategorySlug, number>,
    capsIn: Caps,
    modeIn: Mode,
    cpu: PartOf<'cpu'>,
    gpu: PartOf<'gpu'> | null,
    needCooler: boolean,
  ): EngineItem[] | null {
    const core = [asItem(cpu), ...(gpu ? [asItem(gpu)] : [])];

    // ข้อ 4 เมนบอร์ดที่ผ่าน R01–R02 ราคาถูกสุด มีช่อง M.2 อย่างน้อย 1 ช่อง (บอร์ดที่ไม่ต้องอัปเดต BIOS มาก่อน)
    const boards = remember(cache.boards, `${cpu.id}|${mode}`, () =>
      warnedLast(
        c.motherboard.filter(
          (mb) =>
            mb.spec.m2Slots >= 1 && passes([asItem(cpu), asItem(mb)], ['R01', 'R02'], settings),
        ),
        (mb) => prefer([asItem(cpu), asItem(mb)], ['R03'], settings),
      ),
    );

    for (const mb of boards.slice(0, 3)) {
      const withMb = [...core, asItem(mb)];

      // ข้อ 5 แรมที่ผ่าน R04–R06
      const ram = pickRam(mb, alloc.ram, capsIn.ram, u, modeIn);
      if (!ram) continue;
      const withRam = [...withMb, ram];

      // ข้อ 6 SSD NVMe ความจุมากสุดในงบหมวด
      const storage = pickStorage(mb, alloc.storage, capsIn.storage, modeIn);
      if (!storage) continue;
      const withStorage = [...withRam, asItem(storage)];

      // ข้อ 7 คำนวณวัตต์ (เผื่อซิงก์ลมไว้ก่อนถ้าต้องซื้อ) แล้วเลือก PSU ที่วัตต์ ≥ ค่าแนะนำ ราคาถูกสุด
      // ยังไม่รู้ว่าจะได้ซิงก์ลม (5 W) หรือชุดน้ำ (15 W) จึงเผื่อ 15 W ไว้ก่อน
      const power = calculatePower(buildContext(withStorage, settings));
      const estimated = recommendedPsuWatt(
        power.totalWatt + (needCooler ? 15 : 0),
        settings.psuHeadroom,
      );
      // ลำดับ PSU ทุกรุ่นกับการ์ดจอนี้ (ไม่ติด R16 มาก่อน แล้วตามราคา) จำไว้ แล้วค่อยตัดตามวัตต์ ลำดับไม่เปลี่ยน
      const psus = remember(cache.psus, `${gpu?.id ?? 0}|${mode}`, () =>
        warnedLast(c.psu, (psu) =>
          prefer([...(gpu ? [asItem(gpu)] : []), asItem(psu)], ['R16'], settings),
        ),
      ).filter((psu) => psu.spec.wattage >= estimated);

      for (const psu of psus.slice(0, 3)) {
        const withPsu = [...withStorage, asItem(psu)];
        // ข้อ 8–9 เคสที่ผ่าน R08 (กับบอร์ด) R09 (กับการ์ดจอ) R15 (กับ PSU)
        // และชุดระบายความร้อนที่ผ่าน R10–R13 (ถ้า CPU ไม่มีพัดลมแถม)
        const forBoard = fitsWith(ctx, mb, c.case, ['R08']);
        const forGpu = gpu ? fitsWith(ctx, gpu, c.case, ['R09']) : null;
        const forPsu = fitsWith(ctx, psu, c.case, ['R15']);
        const cases = c.case
          .filter(
            (pcCase) =>
              forBoard.has(pcCase.id) &&
              (!forGpu || forGpu.has(pcCase.id)) &&
              forPsu.has(pcCase.id),
          )
          .sort(byPrice);
        for (const pcCase of cases) {
          const withCase = [...withPsu, asItem(pcCase)];
          if (!needCooler) {
            if (isClean(withCase)) return withCase;
            continue;
          }
          // ชุดที่ใส่กับ CPU นี้ได้ (R12) เรียงไว้แล้ว (ไม่ติด R13 มาก่อน แล้วตามราคา)
          // ตัดเหลือชุดที่ใส่เคสนี้ได้ (R10 R11) ลำดับไม่เปลี่ยน
          const forCase = fitsWith(ctx, pcCase, c.cooler, ['R10', 'R11']);
          const coolers = remember(cache.coolers, `${cpu.id}|${mode}`, () =>
            warnedLast(
              c.cooler.filter((cooler) =>
                passes([asItem(cpu), asItem(cooler)], ['R12', 'R13'], settings),
              ),
              (cooler) => prefer([asItem(cpu), asItem(cooler)], ['R13'], settings),
            ),
          ).filter((cooler) => forCase.has(cooler.id));
          for (const cooler of coolers.slice(0, 2)) {
            const full = [...withCase, asItem(cooler)];
            if (isClean(full)) return full;
          }
        }
      }
    }
    return null;
  }

  function isClean(items: EngineItem[]) {
    return checkBuild({ items, settings, usage }).status !== 'error';
  }

  function pickRam(
    mb: PartOf<'motherboard'>,
    limit: number,
    cap: number | undefined,
    u: UsageType,
    modeIn: Mode,
  ): EngineItem | null {
    const { min, preferred } = MIN_RAM_GB[u];
    // ตัวเลือกของบอร์ดนี้ไม่ขึ้นกับเพดาน จึงจำไว้ต่อบอร์ด แล้วค่อยตัดตามเพดานและเรียงทุกครั้ง
    const valid = remember(ctx.cache.rams, mb.id, () => ramOptions(mb, min))
      .filter((o) => cap === undefined || o.price <= cap)
      .sort((a, b) => a.penalty - b.penalty || a.price - b.price || a.kit.id - b.kit.id);
    if (valid.length === 0) return null;
    if (modeIn === 'best' && preferred > min) {
      const bigger = valid.find((o) => o.gb >= preferred && o.price <= limit);
      if (bigger) return asItem(bigger.kit, bigger.quantity);
    }
    const chosen = valid[0];
    return asItem(chosen.kit, chosen.quantity);
  }

  /** ตัวเลือกแรมที่ใส่บอร์ดนี้ได้และถึงความจุขั้นต่ำ (ยังไม่ตัดตามเพดานและยังไม่เรียง) */
  function ramOptions(mb: PartOf<'motherboard'>, min: number): RamOption[] {
    // ทุกชุด × จำนวนชุดที่ใส่ได้ เช่น 8 GB × 2 จำนวน 2 ชุด
    const options = catalog.ram.flatMap((kit) => {
      const maxQty = Math.floor(mb.spec.memorySlots / kit.spec.sticksInKit);
      return Array.from({ length: Math.max(0, maxQty) }, (_, i) => {
        const quantity = i + 1;
        const gb = kit.spec.capacityPerStickGb * kit.spec.sticksInKit * quantity;
        const sticks = kit.spec.sticksInKit * quantity;
        return { kit, quantity, gb, sticks, price: kit.price * quantity };
      });
    });
    // R04–R06 ดูแค่แรมกับเมนบอร์ด จึงตรวจตรงๆ ไม่ต้องรัน Engine ทั้งชุดทุกตัวเลือก (ขั้นนี้ถูกเรียกหลายพันครั้ง)
    // เงื่อนไขเดียวกับกฎ: ชนิดแรมตรงบอร์ด · จำนวนแถวไม่เกินช่อง · ความจุรวมไม่เกินที่บอร์ดรับ
    const fitsBoard = options.filter(
      (o) =>
        o.gb >= min &&
        norm(o.kit.spec.type) === norm(mb.spec.memoryType) &&
        o.sticks <= mb.spec.memorySlots &&
        o.gb <= mb.spec.maxMemoryGb,
    );
    // 2 แถวขึ้นไป (Dual Channel) เป็นเงื่อนไขบังคับเมื่อบอร์ดนี้ใส่ได้ ไม่ใช่แค่ตัวเลือกที่ดีกว่า
    // ไม่งั้นขั้นลดรุ่นจะลดเป็นแถวเดียวเพื่อประหยัดไม่กี่สิบบาท และเสียความเร็วมากกว่าที่ได้
    const dual = fitsBoard.filter((o) => o.sticks >= 2);
    return (dual.length ? dual : fitsBoard).map((o) => ({
      ...o,
      // ตัวเลือกที่ดีกว่ามาก่อน: 2 แถวขึ้นไป (Dual Channel) และความเร็วไม่เกินบอร์ด (ไม่ติด R07)
      penalty: (o.sticks >= 2 ? 0 : 2) + (o.kit.spec.speedMts > mb.spec.maxMemorySpeed ? 1 : 0),
    }));
  }

  function pickStorage(
    mb: PartOf<'motherboard'>,
    limit: number,
    cap: number | undefined,
    modeIn: Mode,
  ): PartOf<'storage'> | null {
    // ชิ้นที่ใส่บอร์ดนี้ได้ (R17) ไม่ขึ้นกับเพดาน จึงจำไว้ต่อบอร์ด แล้วค่อยตัดตามเพดานทุกครั้ง
    const drives = remember(ctx.cache.drives, mb.id, () => {
      const fitsSlot = catalog.storage.filter((s) =>
        passes([asItem(mb), asItem(s)], ['R17'], settings),
      );
      // ความจุขั้นต่ำตามประเภทการใช้งาน บังคับเมื่อในระบบมีรุ่นที่ถึง (ดู MIN_STORAGE_GB)
      const bigEnough = fitsSlot.filter((s) => s.spec.capacityGb >= MIN_STORAGE_GB[usage]);
      const fits = bigEnough.length ? bigEnough : fitsSlot;
      // ข้อ 6 ใช้ NVMe เสมอถ้าในระบบมี การลดรุ่นลดเป็น NVMe ความจุน้อยลง ไม่เปลี่ยนเป็น SATA
      const nvme = fits.filter((s) => s.spec.type === 'NVMe');
      return nvme.length ? nvme : fits;
    });
    const pool = drives.filter((s) => cap === undefined || s.price <= cap);
    if (pool.length === 0) return null;
    if (modeIn === 'cheapest') return [...pool].sort(byPrice)[0];
    const bySize = (a: PartOf<'storage'>, b: PartOf<'storage'>) =>
      b.spec.capacityGb - a.spec.capacityGb || byPrice(a, b);
    const within = pool.filter((s) => s.price <= limit).sort(bySize);
    if (within.length) return within[0];
    // กำลังลดรุ่น: ความจุมากสุดที่ไม่เกินเพดาน · ไม่มีชิ้นในงบหมวด: ถูกสุดไปก่อน
    return cap !== undefined ? [...pool].sort(bySize)[0] : [...pool].sort(byPrice)[0];
  }
}

const total = (items: EngineItem[]) =>
  items.reduce((sum, item) => sum + item.part.price * item.quantity, 0);

/** ลายเซ็นของชุดอะไหล่ ใช้ตรวจว่าสองตัวเลือกเป็นชุดเดียวกันหรือไม่ (ไม่สนลำดับ) */
export const itemsKey = (items: readonly EngineItem[]) =>
  items
    .map((item) => `${item.part.id}x${item.quantity}:${item.condition}`)
    .sort()
    .join(',');

const find = (items: EngineItem[], cat: CategorySlug) =>
  items.find((item) => item.part.categorySlug === cat);

const MAX_ROUNDS = 60;

/**
 * ข้อ 10–11: ประกอบ ถ้าเกินงบให้ลดรุ่นหมวดที่เกินงบหมวดมากที่สุดทีละขั้น
 * ถ้าเหลืองบเกิน 5% อัปเกรด CPU หรือการ์ดจอทีละขั้น หมวดที่น้ำหนักการใช้งานสูงกว่าก่อน
 */
function buildForTarget(ctx: Context, target: number, upgrade: boolean): EngineItem[] | null {
  const alloc = allocate(target, ctx.ratios);
  const caps: Caps = {};
  let items = assemble(ctx, target, caps, 'best');

  // ข้อ 10 ลดรุ่น
  for (let round = 0; round < MAX_ROUNDS && items && total(items) > target; round++) {
    const current = items;
    const candidates = (['gpu', 'cpu', 'storage', 'ram'] as const)
      .map((cat) => {
        const item = find(current, cat);
        return item
          ? {
              cat,
              price: item.part.price * item.quantity,
              over: item.part.price * item.quantity - alloc[cat],
            }
          : null;
      })
      .filter((row) => row !== null)
      .sort((a, b) => b.over - a.over || b.price - a.price);

    let next: EngineItem[] | null = null;
    for (const row of candidates) {
      const trial: Caps = { ...caps, [row.cat]: row.price - 1 };
      const built = assemble(ctx, target, trial, 'best');
      if (built) {
        caps[row.cat] = row.price - 1;
        next = built;
        break;
      }
    }
    items = next;
  }
  if (!items || total(items) > target) return null;

  // ข้อ 11 อัปเกรดเมื่อเหลืองบเกิน 5%
  if (upgrade) {
    const weights = ctx.settings.usageWeights[ctx.usage];
    const order: ('cpu' | 'gpu')[] = weights.gpu >= weights.cpu ? ['gpu', 'cpu'] : ['cpu', 'gpu'];
    const score = (list: EngineItem[]) =>
      checkBuild({ items: list, usage: ctx.usage, settings: ctx.settings }).score.score;
    for (let round = 0; round < MAX_ROUNDS && target - total(items) > target * 0.05; round++) {
      const current: EngineItem[] = items;
      const leftover = target - total(current);
      const currentScore = score(current);
      const currentHasR16 = hasWarning(current, ['R16'], ctx.settings);
      let improved: EngineItem[] | null = null;
      for (const cat of order) {
        const item = find(current, cat);
        if (!item) continue;
        const pool = (ctx.catalog[cat] as (PartOf<'cpu'> | PartOf<'gpu'>)[])
          .filter(
            (part) =>
              cat !== 'cpu' ||
              !ctx.cpuBrand ||
              part.brandName.toLowerCase() === ctx.cpuBrand.toLowerCase(),
          )
          .filter((part) => part.spec.perfScore > (item.part as PartOf<'cpu'>).spec.perfScore)
          .filter((part) => part.price <= item.part.price + leftover)
          .sort((a, b) => a.spec.perfScore - b.spec.perfScore || a.price - b.price);
        // ทีละขั้น: ลองรุ่นที่แรงขึ้นถัดไปก่อน แล้วประกอบชิ้นอื่นใหม่ให้เข้ากับรุ่นนั้น
        for (const part of pool) {
          const built = forceCategory(ctx, target, caps, cat, part);
          if (!built || total(built) > target || score(built) <= currentScore) continue;
          // ไม่อัปเกรดไปเป็นชุดที่สายไฟการ์ดจอไม่พอ (R16) ถ้าชุดเดิมไม่มีปัญหานี้
          if (!currentHasR16 && hasWarning(built, ['R16'], ctx.settings)) continue;
          improved = built;
          break;
        }
        if (improved) break;
      }
      if (!improved) break;
      items = improved;
    }
  }
  return items;
}

/** ประกอบโดยบังคับให้หมวดนั้นใช้ชิ้นที่กำหนด (ใช้ตอนอัปเกรด) */
function forceCategory(
  ctx: Context,
  target: number,
  caps: Caps,
  cat: 'cpu' | 'gpu',
  part: PartOf<'cpu'> | PartOf<'gpu'>,
): EngineItem[] | null {
  const forced: Context = { ...ctx, catalog: { ...ctx.catalog, [cat]: [part] } };
  return assemble(forced, target, { ...caps, [cat]: undefined }, 'best');
}

export function generateBudgetBuilds(input: BudgetInput): BudgetResult {
  const settings = resolveSettings(input.settings);
  const ratios = input.ratios ?? DEFAULT_BUDGET_RATIOS[input.usage];
  const used = applyUsedPrices(input.catalog, input.used);
  const catalog = splitCatalog(used.catalog);
  const allocation = allocate(input.budget, ratios);

  const brand = input.cpuBrand?.trim() || null;
  const hasBrand = brand
    ? catalog.cpu.some((cpu) => cpu.brandName.toLowerCase() === brand.toLowerCase())
    : false;
  const ctx: Context = {
    catalog,
    usage: input.usage,
    ratios,
    settings,
    cpuBrand: hasBrand ? brand : null,
    cache: newStepCache(),
  };

  const make = (kind: BudgetOptionKind, target: number, picked: EngineItem[]): BudgetOption => {
    const items = used.restore(picked);
    return {
      kind,
      target,
      items,
      result: checkBuild({ items, budget: input.budget, usage: input.usage, settings }),
    };
  };

  const balancedItems = buildForTarget(ctx, input.budget, true);
  if (!balancedItems) {
    // บอกงบขั้นต่ำ: เริ่มจากราคาชุดที่ถูกที่สุดที่เข้ากันได้ แล้วลองจัดจริงทีละ 1,000 บาท
    // ตัวเลขที่บอกผู้ใช้จึงเป็นงบที่กดจัดแล้วได้ผลจริง
    const cheapest = assemble(ctx, input.budget, {}, 'cheapest');
    let minimumBudget: number | null = null;
    if (cheapest) {
      const start = Math.max(Math.ceil(total(cheapest) / 1000) * 1000, input.budget + 1000);
      for (let step = 0; step < 50 && minimumBudget === null; step++) {
        const candidate = start + step * 1000;
        if (buildForTarget(ctx, candidate, false)) minimumBudget = candidate;
      }
    }
    return { ok: false, minimumBudget, allocation };
  }

  // ประหยัด: ใช้ 85% ของงบ (ถ้าประกอบไม่ได้ ใช้ชุดถูกสุดที่ยังอยู่ในงบ)
  const economyTarget = Math.round(input.budget * 0.85);
  const economyItems =
    buildForTarget(ctx, economyTarget, true) ??
    (() => {
      const cheapest = assemble(ctx, input.budget, {}, 'cheapest');
      return cheapest && total(cheapest) <= input.budget ? cheapest : balancedItems;
    })();

  // คุ้มสุด: ลองงบเป้าหมาย 50–100% แล้วเลือกชุดที่ความคุ้มค่า (คะแนน ÷ ราคา) สูงสุด
  const tried: BudgetOption[] = [make('value', input.budget, balancedItems)];
  for (let percent = 50; percent < 100; percent += 5) {
    const target = Math.round((input.budget * percent) / 100);
    const items = buildForTarget(ctx, target, true);
    if (items) tried.push(make('value', target, items));
  }
  const ranked = tried.sort(
    (a, b) =>
      b.result.score.value - a.result.score.value || a.result.price.total - b.result.price.total,
  );
  // คุ้มสุดอาจเป็นชุดเดียวกับประหยัดหรือสมดุลได้ (เช่นอะไหล่ในระบบมีน้อย) ไม่บังคับให้ต่าง
  // เพราะชุดที่ต่างออกไปจะคุ้มน้อยกว่า เรียกว่าคุ้มสุดไม่ได้ หน้าเว็บรวมการ์ดที่ซ้ำกันแทน (sameAs)
  const value = ranked[0];

  return {
    ok: true,
    options: [
      make('economy', economyTarget, economyItems),
      make('balanced', input.budget, balancedItems),
      value,
    ],
    allocation,
    brandFallback: Boolean(brand) && !hasBrand,
  };
}
