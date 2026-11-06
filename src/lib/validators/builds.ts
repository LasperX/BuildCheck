import { z } from 'zod';

import type { RuleCode } from '@/lib/compat';
import { partsQuerySchema } from '@/lib/parts/catalog';

// กฎตรวจค่าของสเปก ใช้ทั้งฝั่งหน้าเว็บและ Server Action (เซิร์ฟเวอร์ตรวจซ้ำเสมอ)

export const MAX_BUILD_ITEMS = 20;
export const MAX_QUANTITY = 8;

export const usageTypeSchema = z.enum(['gaming', 'office', 'creator', 'streaming']);
export const visibilitySchema = z.enum(['public', 'unlisted', 'private']);

const money = z.number().finite().min(0).max(10_000_000);

export const buildItemInputSchema = z.object({
  partId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  condition: z.enum(['new', 'A', 'B', 'C']).default('new'),
  offeredPrice: money.nullable().default(null),
  warrantyMonthsLeft: z.number().int().min(0).max(120).nullable().default(null),
});

export const buildMetaSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: 'กรุณาตั้งชื่อสเปก' })
    .max(100, { error: 'ชื่อสเปกยาวได้ไม่เกิน 100 ตัวอักษร' }),
  description: z.string().trim().max(1000, { error: 'คำอธิบายยาวได้ไม่เกิน 1,000 ตัวอักษร' }),
  usageType: usageTypeSchema,
  budget: money.nullable(),
});

export const saveBuildSchema = buildMetaSchema.extend({
  /** ไม่ส่ง = สร้างสเปกใหม่ */
  id: z
    .string()
    .regex(/^[A-Za-z0-9]{10}$/)
    .optional(),
  items: z
    .array(buildItemInputSchema)
    .max(MAX_BUILD_ITEMS, { error: `สเปกหนึ่งมีอะไหล่ได้ไม่เกิน ${MAX_BUILD_ITEMS} รายการ` })
    .refine((items) => new Set(items.map((item) => item.partId)).size === items.length, {
      error: 'มีอะไหล่ซ้ำในสเปก',
    }),
});

export type SaveBuildInput = z.input<typeof saveBuildSchema>;

export const buildIdSchema = z.string().regex(/^[A-Za-z0-9]{10}$/);

/** พารามิเตอร์ build=12x1,15x2 ใน URL */
export const buildParamSchema = z
  .string()
  .max(400)
  .transform((value, ctx) => {
    if (!value) return [];
    const items = value.split(',').map((token) => {
      const match = /^(\d{1,9})x(\d{1,2})$/.exec(token);
      return match ? { partId: Number(match[1]), quantity: Number(match[2]) } : null;
    });
    if (items.some((item) => item === null) || items.length > MAX_BUILD_ITEMS) {
      ctx.addIssue({ code: 'custom', message: 'รูปแบบสเปกไม่ถูกต้อง' });
      return z.NEVER;
    }
    return items.filter((item) => item !== null);
  });

export const candidatesQuerySchema = partsQuerySchema.omit({ sort: true }).extend({
  category: partsQuerySchema.shape.category.unwrap(),
  sort: z.enum(['popular', 'near', 'price_asc', 'price_desc', 'newest']).default('popular'),
  smart: z.preprocess((value) => value === '1' || value === 'true', z.boolean()),
  build: buildParamSchema.default([]),
  replace: z.coerce.number().int().positive().optional(),
  /** ราคาอ้างอิงสำหรับเรียง "ราคาใกล้เคียงที่สุด" */
  near: z.coerce.number().min(0).max(10_000_000).optional(),
  usage: usageTypeSchema.default('gaming'),
  /** เปิดจากปุ่มแนะนำอะไหล่ทดแทน: รหัสกฎที่ต้องการแก้ */
  fix: z
    .string()
    .regex(/^R(0[1-9]|1[0-8])$/)
    .transform((code) => code as RuleCode)
    .optional(),
});

export type CandidatesQuery = z.infer<typeof candidatesQuerySchema>;
