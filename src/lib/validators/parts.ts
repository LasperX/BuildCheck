import { z } from 'zod';

import {
  COOLER_TYPES,
  FORM_FACTORS,
  MEMORY_TYPES,
  PSU_EFFICIENCIES,
  PSU_FORM_FACTORS,
  PSU_MODULAR,
  SIDE_PANELS,
  STORAGE_INTERFACES,
  STORAGE_TYPES,
} from '@/lib/parts/spec-fields';

// กฎตรวจค่าอะไหล่ชุดเดียว ใช้ทั้งฟอร์มหน้าเว็บ Server Action และการนำเข้า CSV
// ค่าจากฟอร์มและ CSV เป็นข้อความเสมอ จึงมีตัวช่วยแปลงเป็นตัวเลข รายการ และ true/false

const blankToNull = (value: unknown) =>
  value === '' || value === undefined || (typeof value === 'string' && !value.trim())
    ? null
    : value;

const SMALLINT_MAX = 32767;
// เว้นวรรคหน้าคำภาษาอังกฤษ เช่น "กรุณากรอก Socket"
const gap = (label: string) => (/^[A-Za-z]/.test(label) ? ` ${label}` : label);

// z.coerce แปลง null เป็น 0 จึงต้องกันค่าว่างก่อนถึงขั้นตอนแปลง
const requiredInt = (label: string, min = 0, max = SMALLINT_MAX) =>
  z.preprocess(
    (value) => (blankToNull(value) === null ? undefined : value),
    z.coerce
      .number({ error: `กรุณากรอก${gap(label)}เป็นตัวเลข` })
      .refine((v) => Number.isInteger(v), `${label}ต้องเป็นจำนวนเต็ม`)
      .min(min, `${label}ต้องไม่น้อยกว่า ${min}`)
      .max(max, `${label}ต้องไม่เกิน ${max}`),
  ) as z.ZodType<number, unknown>;

const optionalInt = (label: string, max = SMALLINT_MAX) =>
  z.preprocess(
    blankToNull,
    z.union([
      z.null(),
      z.coerce
        .number({ error: `${label}ต้องเป็นตัวเลข` })
        .refine((v) => Number.isInteger(v), `${label}ต้องเป็นจำนวนเต็ม`)
        .min(0, `${label}ต้องไม่ติดลบ`)
        .max(max, `${label}ต้องไม่เกิน ${max}`),
    ]),
  ) as z.ZodType<number | null, unknown>;

const optionalDecimal = (label: string, max: number) =>
  z.preprocess(
    blankToNull,
    z.union([
      z.null(),
      z.coerce
        .number({ error: `${label}ต้องเป็นตัวเลข` })
        .min(0, `${label}ต้องไม่ติดลบ`)
        .max(max, `${label}ต้องไม่เกิน ${max}`),
    ]),
  ) as z.ZodType<number | null, unknown>;

const text = (label: string, max: number) =>
  z
    .string({ error: `กรุณากรอก${gap(label)}` })
    .trim()
    .min(1, `กรุณากรอก${gap(label)}`)
    .max(max, `${label}ยาวได้ไม่เกิน ${max} ตัวอักษร`);

const bool = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  const s = String(value ?? '')
    .trim()
    .toLowerCase();
  return ['true', '1', 'yes', 'y', 'มี', 'ใช่'].includes(s);
}, z.boolean()) as z.ZodType<boolean, unknown>;

const enumOf = <T extends readonly [string, ...string[]]>(label: string, values: T) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.enum(values, { error: `${label}ต้องเป็นหนึ่งใน ${values.join(', ')}` }),
  ) as z.ZodType<T[number], unknown>;

const splitList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  return String(value ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
};

const listOf = (label: string, maxItemLength: number, required = true) =>
  z.preprocess(
    splitList,
    z
      .array(z.string().max(maxItemLength, `ค่าใน${label}ยาวเกินไป`))
      .min(required ? 1 : 0, `กรุณากรอก${gap(label)}`),
  ) as z.ZodType<string[], unknown>;

const listIn = <T extends readonly [string, ...string[]]>(label: string, values: T) =>
  z.preprocess(
    splitList,
    z
      .array(z.enum(values, { error: `${label}ต้องเป็น ${values.join(', ')}` }))
      .min(1, `กรุณากรอก${gap(label)}`),
  ) as z.ZodType<T[number][], unknown>;

const intList = (label: string) =>
  z.preprocess(
    (value) => splitList(value).map(Number),
    z.array(
      z
        .number({ error: `${label}ต้องเป็นตัวเลข` })
        .int(`${label}ต้องเป็นจำนวนเต็ม`)
        .min(0)
        .max(SMALLINT_MAX),
    ),
  ) as z.ZodType<number[], unknown>;

// "8pin:1|6pin:2" -> { "8pin": 1, "6pin": 2 } ส่วน none:0 แปลว่าไม่ต้องต่อไฟ
const connectors = (label: string) =>
  z.preprocess(
    (value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) return value;
      const entries = splitList(value).map((part) => {
        const [name, count] = part.split(':');
        return [name?.trim() ?? '', Number(count)] as const;
      });
      return Object.fromEntries(entries);
    },
    z
      .record(
        z.string().regex(/^[A-Za-z0-9+_-]+$/, `ชื่อใน${label}ใช้ได้เฉพาะ a-z 0-9 + _ -`),
        z
          .number({ error: `${label}ต้องอยู่ในรูปแบบ ชื่อ:จำนวน` })
          .int()
          .min(0)
          .max(20),
      )
      .refine((v) => Object.keys(v).length > 0, `กรุณากรอก${gap(label)} รูปแบบ ชื่อ:จำนวน`),
  ) as z.ZodType<Record<string, number>, unknown>;

const percent = (label: string) => requiredInt(label, 0, 100);

const cpuSpec = z.object({
  socket: text('Socket', 20),
  generation: text('รุ่น (Generation)', 30),
  cores: requiredInt('จำนวนคอร์', 1),
  threads: requiredInt('จำนวนเธรด', 1),
  baseClockGhz: optionalDecimal('ความเร็วพื้นฐาน', 99.99),
  boostClockGhz: optionalDecimal('ความเร็วสูงสุด', 99.99),
  tdpWatt: requiredInt('TDP', 1, 2000),
  hasIgpu: bool,
  includesCooler: bool,
  memoryTypes: listIn('ชนิดแรม', MEMORY_TYPES),
  perfScore: percent('คะแนนประสิทธิภาพ'),
});

const motherboardSpec = z.object({
  socket: text('Socket', 20),
  chipset: text('ชิปเซ็ต', 20),
  formFactor: enumOf('ขนาดบอร์ด', FORM_FACTORS),
  memoryType: enumOf('ชนิดแรม', MEMORY_TYPES),
  memorySlots: requiredInt('จำนวนช่องแรม', 1, 16),
  maxMemoryGb: requiredInt('แรมสูงสุด', 1),
  maxMemorySpeed: requiredInt('ความเร็วแรมสูงสุด', 1, 100000),
  m2Slots: requiredInt('ช่อง M.2', 0, 20),
  sataPorts: requiredInt('พอร์ต SATA', 0, 20),
  supportedGenerations: listOf('รุ่น CPU ที่ใช้ได้', 30),
  biosUpdateGenerations: listOf('รุ่น CPU ที่ต้องอัปเดต BIOS', 30, false),
  wifi: bool,
});

const ramSpec = z.object({
  type: enumOf('ชนิด', MEMORY_TYPES),
  capacityPerStickGb: requiredInt('ความจุต่อแถว', 1),
  sticksInKit: requiredInt('จำนวนแถวในชุด', 1, 2),
  speedMts: requiredInt('ความเร็ว', 1, 100000),
  casLatency: optionalInt('CAS Latency'),
  rgb: bool,
});

const gpuSpec = z.object({
  chipset: text('ชิปประมวลผล', 40),
  vramGb: requiredInt('VRAM', 1),
  lengthMm: requiredInt('ความยาว', 1, 1000),
  slotWidth: optionalDecimal('ความหนา', 99.9),
  tbpWatt: requiredInt('TBP', 1, 2000),
  powerConnectors: connectors('ช่องเสียบไฟ'),
  perfScore: percent('คะแนนประสิทธิภาพ'),
});

const storageSpec = z.object({
  type: enumOf('ชนิด', STORAGE_TYPES),
  interface: enumOf('ช่องเชื่อมต่อ', STORAGE_INTERFACES),
  capacityGb: requiredInt('ความจุ', 1, 1000000),
  readMbps: optionalInt('ความเร็วอ่าน', 1000000),
  writeMbps: optionalInt('ความเร็วเขียน', 1000000),
});

const psuSpec = z.object({
  wattage: requiredInt('กำลังไฟ', 1, 10000),
  efficiency: enumOf('80 Plus', PSU_EFFICIENCIES),
  formFactor: enumOf('ขนาด', PSU_FORM_FACTORS),
  modular: enumOf('Modular', PSU_MODULAR),
  pcieConnectors: connectors('สายไฟการ์ดจอ'),
});

const caseSpec = z.object({
  supportedFormFactors: listIn('ขนาดบอร์ดที่รองรับ', FORM_FACTORS),
  maxGpuLengthMm: requiredInt('การ์ดจอยาวสุด', 1, 2000),
  maxCoolerHeightMm: requiredInt('ซิงก์ลมสูงสุด', 1, 2000),
  radiatorSupportMm: intList('หม้อน้ำที่รองรับ'),
  psuFormFactors: listIn('ขนาด PSU ที่รองรับ', PSU_FORM_FACTORS),
  includedFans: z.preprocess(
    (v) => blankToNull(v) ?? 0,
    requiredInt('พัดลมแถม', 0, 50),
  ) as z.ZodType<number, unknown>,
  sidePanel: enumOf('ฝาข้าง', SIDE_PANELS),
});

const coolerSpec = z
  .object({
    type: enumOf('ชนิด', COOLER_TYPES),
    supportedSockets: listOf('Socket ที่รองรับ', 20),
    heightMm: optionalInt('ความสูง', 2000),
    radiatorMm: optionalInt('ขนาดหม้อน้ำ', 2000),
    maxTdpWatt: requiredInt('รับ TDP ได้สูงสุด', 1, 2000),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'air' && value.heightMm === null) {
      ctx.addIssue({ code: 'custom', path: ['heightMm'], message: 'ซิงก์ลมต้องระบุความสูง' });
    }
    if (value.type === 'aio' && value.radiatorMm === null) {
      ctx.addIssue({ code: 'custom', path: ['radiatorMm'], message: 'ชุดน้ำต้องระบุขนาดหม้อน้ำ' });
    }
  });

const baseFields = {
  id: z.number().int().positive().optional(),
  brandId: z.coerce.number({ error: 'กรุณาเลือกยี่ห้อ' }).int().positive('กรุณาเลือกยี่ห้อ'),
  model: text('ชื่อรุ่น', 150),
  price: z.preprocess(
    (value) => (blankToNull(value) === null ? undefined : value),
    z.coerce
      .number({ error: 'กรุณากรอกราคาเป็นตัวเลข' })
      .min(0, 'ราคาต้องไม่ติดลบ')
      .max(99999999.99, 'ราคาสูงเกินไป'),
  ) as z.ZodType<number, unknown>,
  powerWatt: optionalInt('วัตต์พื้นฐาน', 10000),
  releaseYear: z.preprocess(
    blankToNull,
    z.union([
      z.null(),
      z.coerce
        .number({ error: 'ปีที่วางขายต้องเป็นตัวเลข' })
        .int('ปีที่วางขายต้องเป็นจำนวนเต็ม')
        .min(1990, 'ปีที่วางขายต้องเป็น ค.ศ. ตั้งแต่ 1990')
        .max(2100, 'ปีที่วางขายต้องเป็น ค.ศ.'),
    ]),
  ) as z.ZodType<number | null, unknown>,
  imageUrl: z.preprocess(blankToNull, z.string().max(2000).nullable()) as z.ZodType<
    string | null,
    unknown
  >,
  specSourceUrl: z.preprocess(
    blankToNull,
    z.url({ error: 'แหล่งอ้างอิงต้องเป็น URL ที่ถูกต้อง' }).max(2000).nullable(),
  ) as z.ZodType<string | null, unknown>,
  specVerified: bool,
  isActive: bool,
};

// discriminatedUnion: เลือกกฎสเปกตามค่า categorySlug และ TypeScript รู้ชนิดของ spec ในแต่ละหมวด
export const partInputSchema = z.discriminatedUnion('categorySlug', [
  z.object({ ...baseFields, categorySlug: z.literal('cpu'), spec: cpuSpec }),
  z.object({ ...baseFields, categorySlug: z.literal('motherboard'), spec: motherboardSpec }),
  z.object({ ...baseFields, categorySlug: z.literal('ram'), spec: ramSpec }),
  z.object({ ...baseFields, categorySlug: z.literal('gpu'), spec: gpuSpec }),
  z.object({ ...baseFields, categorySlug: z.literal('storage'), spec: storageSpec }),
  z.object({ ...baseFields, categorySlug: z.literal('psu'), spec: psuSpec }),
  z.object({ ...baseFields, categorySlug: z.literal('case'), spec: caseSpec }),
  z.object({ ...baseFields, categorySlug: z.literal('cooler'), spec: coolerSpec }),
]);
export type PartInput = z.output<typeof partInputSchema>;

/** ค่าในฟอร์ม: ทุกช่องเป็นข้อความหรือ true/false ก่อนผ่านการแปลงของ Zod */
export type PartFormValues = {
  id?: number;
  categorySlug: string;
  brandId: string;
  model: string;
  price: string;
  powerWatt: string;
  releaseYear: string;
  imageUrl: string;
  specSourceUrl: string;
  specVerified: boolean;
  isActive: boolean;
  spec: Record<string, string | boolean>;
};

export const priceUpdateSchema = z.object({
  id: z.number().int().positive(),
  price: z.coerce
    .number({ error: 'ราคาต้องเป็นตัวเลข' })
    .min(0, 'ราคาต้องไม่ติดลบ')
    .max(99999999.99, 'ราคาสูงเกินไป'),
});

/** กดตรวจสเปกแล้ว / ยกเลิก ในหน้าตรวจสเปก รับหลายชิ้นได้ (สูงสุด 100 ต่อครั้ง) */
export const partVerifySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
  verified: z.boolean(),
});
