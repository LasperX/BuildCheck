import { z } from 'zod';

// ฟอร์มส่วนมือสอง ใช้ทั้งบนหน้าเว็บและใน Server Action (ตรวจซ้ำฝั่งเซิร์ฟเวอร์เสมอ)

export const gradeSchema = z.enum(['A', 'B', 'C'], { error: 'กรุณาเลือกเกรดสภาพ' });

const price = z.coerce
  .number({ error: 'กรุณากรอกราคาเป็นตัวเลข' })
  .positive({ error: 'ราคาต้องมากกว่า 0' })
  .max(1_000_000, { error: 'ราคาสูงเกินไป' });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'รูปแบบวันที่ไม่ถูกต้อง' });

export const usedReportSchema = z.object({
  partId: z.coerce.number().int().positive({ error: 'กรุณาเลือกรุ่นอะไหล่' }),
  price,
  grade: gradeSchema,
  reportType: z.enum(['listed', 'bought', 'sold'], { error: 'กรุณาเลือกประเภทรายงาน' }),
  channel: z.enum(['facebook', 'marketplace_app', 'shop', 'friend', 'other'], {
    error: 'กรุณาเลือกช่องทาง',
  }),
  province: z.string().trim().max(40).optional().default(''),
  warrantyMonthsLeft: z.coerce.number().int().min(0).max(120).default(0),
  seenAt: isoDate,
});

export type UsedReportInput = z.input<typeof usedReportSchema>;

export const reviewSchema = z.object({
  id: z.coerce.number().int().positive(),
  decision: z.enum(['approved', 'rejected']),
});

export const surveySchema = z
  .object({
    partId: z.coerce.number().int().positive({ error: 'กรุณาเลือกรุ่นอะไหล่' }),
    grade: gradeSchema,
    minPrice: price,
    maxPrice: price,
    surveyedAt: isoDate,
    sourceNote: z.string().trim().max(200).optional().default(''),
  })
  .refine((v) => v.minPrice <= v.maxPrice, {
    error: 'ราคาต่ำสุดต้องไม่เกินราคาสูงสุด',
    path: ['maxPrice'],
  });

export const priceAlertSchema = z.object({
  partId: z.coerce.number().int().positive(),
  grade: gradeSchema,
  targetPrice: price,
});

/** ค่าเสื่อมต่อหมวดและตัวคูณเกรด ที่แอดมินแก้ในหน้าจัดการราคามือสอง */
const rate = z.coerce
  .number({ error: 'กรุณากรอกตัวเลข' })
  .gt(0, { error: 'ต้องมากกว่า 0' })
  .max(1, { error: 'ต้องไม่เกิน 1' });

export const usedSettingsSchema = z.object({
  depreciationRates: z.object({
    cpu: rate,
    gpu: rate,
    motherboard: rate,
    ram: rate,
    storage: rate,
    psu: rate,
    case: rate,
    cooler: rate,
  }),
  gradeFactors: z.object({ A: rate, B: rate, C: rate }),
  legacySockets: z
    .string()
    .max(500)
    .transform((text) =>
      [
        ...new Set(
          text
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ].slice(0, 50),
    )
    .pipe(z.array(z.string().max(20, { error: 'ชื่อ Socket ยาวเกิน 20 ตัวอักษร' }))),
});
