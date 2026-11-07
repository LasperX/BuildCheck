import { z } from 'zod';

import { buildIdSchema, usageTypeSchema } from './builds';

// ฟอร์มและพารามิเตอร์ส่วนชุมชน ใช้ทั้งหน้าเว็บและ Server Action (เซิร์ฟเวอร์ตรวจซ้ำเสมอ)

export const COMMENT_MAX = 1000;
export const COMMUNITY_PAGE_SIZE = 12;
export const MAX_COMPARE = 3;

export const voteSchema = z.object({
  buildId: buildIdSchema,
  /** 1 = โหวตขึ้น · -1 = โหวตลง · 0 = ยกเลิกโหวต */
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

export const commentSchema = z.object({
  buildId: buildIdSchema,
  body: z
    .string()
    .trim()
    .min(1, { error: 'กรุณาพิมพ์ข้อความ' })
    .max(COMMENT_MAX, {
      error: `คอมเมนต์ยาวได้ไม่เกิน ${COMMENT_MAX.toLocaleString('th-TH')} ตัวอักษร`,
    }),
  parentId: z.number().int().positive().nullable().default(null),
});

export const reportSchema = z.object({
  targetType: z.enum(['build', 'comment', 'user']),
  targetId: z.string().trim().min(1).max(40),
  reason: z.enum(['spam', 'offensive', 'wrong_info', 'other'], { error: 'กรุณาเลือกเหตุผล' }),
  detail: z.string().trim().max(500, { error: 'รายละเอียดยาวได้ไม่เกิน 500 ตัวอักษร' }).default(''),
});

export const REPORT_REASON_LABELS = {
  spam: 'สแปมหรือโฆษณา',
  offensive: 'ไม่สุภาพหรือไม่เหมาะสม',
  wrong_info: 'ข้อมูลผิดหรือทำให้เข้าใจผิด',
  other: 'อื่น ๆ',
} as const;

export const COMMUNITY_TABS = ['new', 'week', 'all'] as const;
export type CommunityTab = (typeof COMMUNITY_TABS)[number];

export const TAB_LABELS: Record<CommunityTab, string> = {
  new: 'ใหม่ล่าสุด',
  week: 'ยอดนิยมสัปดาห์นี้',
  all: 'ยอดนิยมตลอดกาล',
};

/** ตัวกรองหน้าชุมชน ค่าผิดรูปแบบใช้ค่าตั้งต้นแทน ไม่ทำให้หน้าพัง */
export const communityQuerySchema = z.object({
  tab: z.enum(COMMUNITY_TABS).catch('new'),
  usage: usageTypeSchema.optional().catch(undefined),
  min: z.coerce.number().int().min(0).max(10_000_000).optional().catch(undefined),
  max: z.coerce.number().int().min(0).max(10_000_000).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

export type CommunityQuery = z.infer<typeof communityQuerySchema>;

/** รายการสเปกที่จะเทียบ ?ids=a,b,c ตัดซ้ำและตัดรหัสผิดรูปแบบทิ้ง */
export function parseCompareIds(raw: string | string[] | undefined): string[] {
  const text = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
  const ids = text
    .split(',')
    .map((id) => id.trim())
    .filter((id) => buildIdSchema.safeParse(id).success);
  return [...new Set(ids)].slice(0, MAX_COMPARE);
}
