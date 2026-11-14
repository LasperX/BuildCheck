import { z } from 'zod';

import { CATEGORY_SLUGS, type CategorySlug } from '@/lib/parts/spec-fields';

// ค่าตั้งของหน้าคลังอะไหล่ ใช้ร่วมกันทั้ง API และหน้าเว็บ

export const PARTS_PAGE_SIZE = 24;

export const SORT_OPTIONS = [
  { value: 'popular', label: 'ความนิยม' },
  { value: 'newest', label: 'รุ่นใหม่ล่าสุด' },
  { value: 'price_asc', label: 'ราคาต่ำไปสูง' },
  { value: 'price_desc', label: 'ราคาสูงไปต่ำ' },
] as const;
export type PartSort = (typeof SORT_OPTIONS)[number]['value'];

export const partsQuerySchema = z.object({
  category: z.enum(CATEGORY_SLUGS).optional(),
  q: z.string().trim().max(100).optional(),
  brand: z.array(z.coerce.number().int().positive()).max(50).default([]),
  min: z.coerce.number().min(0).optional(),
  max: z.coerce.number().min(0).optional(),
  sort: z.enum(['popular', 'newest', 'price_asc', 'price_desc']).default('popular'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  // สถานะการขาย: new = มีขายมือหนึ่ง, used_only = มีแต่มือสอง (ไม่ระบุ = ทั้งหมด)
  availability: z.enum(['new', 'used_only']).optional(),
  // ตัวกรองสเปกเฉพาะหมวด เช่น { socket: ["AM5"] } ตรวจชื่อกับ SPEC_FILTERS ฝั่งเซิร์ฟเวอร์
  spec: z.record(z.string(), z.array(z.string().max(40)).max(50)).default({}),
});
export type PartsQuery = z.infer<typeof partsQuerySchema>;

export type SpecFilter = { key: string; label: string };

// ตัวกรองเฉพาะหมวดตามหัวข้อ 3.2
export const SPEC_FILTERS: Record<CategorySlug, SpecFilter[]> = {
  cpu: [
    { key: 'socket', label: 'Socket' },
    { key: 'generation', label: 'รุ่น (Generation)' },
    { key: 'cores', label: 'จำนวนคอร์' },
  ],
  motherboard: [
    { key: 'socket', label: 'Socket' },
    { key: 'chipset', label: 'ชิปเซ็ต' },
    { key: 'formFactor', label: 'ขนาดบอร์ด' },
    { key: 'memoryType', label: 'ชนิดแรม' },
  ],
  ram: [
    { key: 'type', label: 'ชนิด' },
    { key: 'capacityPerStickGb', label: 'ความจุต่อแถว (GB)' },
    { key: 'speedMts', label: 'ความเร็ว (MT/s)' },
  ],
  gpu: [
    { key: 'chipset', label: 'ชิปประมวลผล' },
    { key: 'vramGb', label: 'VRAM (GB)' },
  ],
  storage: [
    { key: 'type', label: 'ชนิด' },
    { key: 'capacityGb', label: 'ความจุ (GB)' },
  ],
  psu: [
    { key: 'wattage', label: 'กำลังไฟ (W)' },
    { key: 'efficiency', label: '80 Plus' },
    { key: 'formFactor', label: 'ขนาด' },
    { key: 'modular', label: 'Modular' },
  ],
  case: [{ key: 'sidePanel', label: 'ฝาข้าง' }],
  cooler: [{ key: 'type', label: 'ชนิด' }],
};

export type PartListItem = {
  id: number;
  slug: string;
  model: string;
  brandName: string;
  categorySlug: CategorySlug;
  price: number;
  imageUrl: string | null;
  specVerified: boolean;
  availability: 'new' | 'used_only';
  chips: string[];
  /** ราคากลางมือสองเกรด B ของรุ่นที่มีแต่มือสอง (รุ่นที่ยังขายมือหนึ่งไม่ส่งมา) */
  usedPrice?: { median: number; source: 'reports' | 'survey' | 'estimate' };
};

export type PartsResponse = {
  items: PartListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type PartFacets = {
  brands: { id: number; name: string }[];
  spec: { key: string; label: string; values: string[] }[];
};

type Spec = Record<string, unknown>;

// ค่าสำคัญที่แสดงเป็นป้ายบนการ์ด
export function specChips(category: CategorySlug, s: Spec): string[] {
  const pick = {
    cpu: [s.socket, s.cores && `${s.cores} คอร์`, s.tdpWatt && `${s.tdpWatt} W`],
    motherboard: [s.socket, s.memoryType, s.formFactor],
    ram: [
      s.type,
      s.capacityPerStickGb && `${s.capacityPerStickGb} GB × ${s.sticksInKit}`,
      s.speedMts && `${s.speedMts} MT/s`,
    ],
    gpu: [
      s.vramGb && `${s.vramGb} GB`,
      s.tbpWatt && `${s.tbpWatt} W`,
      s.lengthMm && `${s.lengthMm} mm`,
    ],
    storage: [s.type, s.capacityGb && `${s.capacityGb} GB`, s.interface],
    psu: [s.wattage && `${s.wattage} W`, s.efficiency, s.formFactor],
    case: [
      Array.isArray(s.supportedFormFactors) ? s.supportedFormFactors.join('/') : null,
      s.maxGpuLengthMm && `การ์ดจอ ≤ ${s.maxGpuLengthMm} mm`,
    ],
    cooler: [
      s.type === 'aio' ? 'ชุดน้ำ' : 'ซิงก์ลม',
      s.type === 'aio'
        ? s.radiatorMm && `${s.radiatorMm} mm`
        : s.heightMm && `สูง ${s.heightMm} mm`,
      s.maxTdpWatt && `${s.maxTdpWatt} W`,
    ],
  }[category];
  return pick.filter((value): value is string | number => Boolean(value)).map(String);
}

export const formatBaht = (value: number) => `฿${Math.round(value).toLocaleString('en-US')}`;

/** แปลงคำค้นเป็นรูปแบบ to_tsquery โดยเก็บเฉพาะตัวอักษรและตัวเลข ป้องกันอักขระพิเศษทำให้คำสั่งพัง */
export function toPrefixQuery(q: string): string | null {
  const tokens = q.match(/[\p{L}\p{N}\p{M}]+/gu);
  if (!tokens?.length) return null;
  return tokens
    .slice(0, 8)
    .map((token) => `${token.toLowerCase()}:*`)
    .join(' & ');
}
