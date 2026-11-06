import { z } from 'zod';

import { CATEGORY_SLUGS } from '@/lib/parts/spec-fields';

import { usageTypeSchema } from './builds';

// ฟอร์มจัดสเปกตามงบ ใช้ทั้งฟอร์มบนหน้าเว็บและ Server Action
export const budgetInputSchema = z.object({
  budget: z.coerce
    .number({ error: 'กรุณากรอกงบเป็นตัวเลข' })
    .int({ error: 'กรุณากรอกงบเป็นจำนวนเต็ม' })
    .min(5000, { error: 'งบต้องไม่ต่ำกว่า 5,000 บาท' })
    .max(1_000_000, { error: 'งบต้องไม่เกิน 1,000,000 บาท' }),
  usage: usageTypeSchema,
  cpuBrand: z.string().trim().max(60).optional(),
  // ยอมใช้มือสอง (หัวข้อ 3.11): เลือกหมวดที่ยอมและเกรดที่ใช้คิดราคา
  allowUsed: z.boolean().default(false),
  usedCategories: z.array(z.enum(CATEGORY_SLUGS)).max(8).default([]),
  usedGrade: z.enum(['A', 'B', 'C']).default('B'),
});
