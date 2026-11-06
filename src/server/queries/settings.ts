import 'server-only';

import { inArray } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { z } from 'zod';

import { settings } from '@/db/schema';
import { type BudgetRatios, DEFAULT_BUDGET_RATIOS } from '@/lib/compat/budget';
import { DEFAULT_SETTINGS } from '@/lib/compat/settings';
import type { EngineSettings, UsageType } from '@/lib/compat/types';
import { db } from '@/lib/db';

// ค่าตั้งระบบจากตาราง settings (แอดมินแก้ในหน้าตั้งค่าเฟส 12)
// ยังไม่มีแถวหรือค่าผิดรูปแบบ → ใช้ค่าตั้งต้นในโค้ด ระบบจึงทำงานได้เสมอ

const USAGES: UsageType[] = ['gaming', 'office', 'creator', 'streaming'];

const ratioSchema = z
  .object({
    cpu: z.number().min(0).max(1),
    gpu: z.number().min(0).max(1),
    motherboard: z.number().min(0).max(1),
    ram: z.number().min(0).max(1),
    storage: z.number().min(0).max(1),
    psu: z.number().min(0).max(1),
    case: z.number().min(0).max(1),
    cooler: z.number().min(0).max(1),
  })
  // สัดส่วนต้องรวมได้ 100% (ยอมคลาดจากการปัดเศษ 0.5%)
  .refine((r) => Math.abs(Object.values(r).reduce((a, b) => a + b, 0) - 1) < 0.005);

const weightSchema = z.object({ cpu: z.number().min(0).max(1), gpu: z.number().min(0).max(1) });

export const SETTING_KEYS = {
  psuHeadroom: 'psu_headroom',
  motherboardDefaultWatt: 'mb_default_watt',
  usageWeights: 'usage_weights',
  budgetRatio: (usage: UsageType) => `budget_ratio_${usage}`,
} as const;

export type SystemConfig = {
  engine: EngineSettings;
  budgetRatios: Record<UsageType, BudgetRatios>;
};

export async function getSystemConfig(): Promise<SystemConfig> {
  'use cache';
  cacheTag('settings');
  cacheLife('minutes');

  const keys = [
    SETTING_KEYS.psuHeadroom,
    SETTING_KEYS.motherboardDefaultWatt,
    SETTING_KEYS.usageWeights,
    ...USAGES.map(SETTING_KEYS.budgetRatio),
  ];
  const rows = await db.select().from(settings).where(inArray(settings.key, keys));
  const value = new Map(rows.map((row) => [row.key, row.value]));
  const read = <T>(key: string, schema: z.ZodType<T>, fallback: T): T => {
    const parsed = schema.safeParse(value.get(key));
    return parsed.success ? parsed.data : fallback;
  };

  return {
    engine: {
      psuHeadroom: read(
        SETTING_KEYS.psuHeadroom,
        z.number().min(0).max(1),
        DEFAULT_SETTINGS.psuHeadroom,
      ),
      motherboardDefaultWatt: read(
        SETTING_KEYS.motherboardDefaultWatt,
        z.number().int().min(0).max(300),
        DEFAULT_SETTINGS.motherboardDefaultWatt,
      ),
      usageWeights: read(
        SETTING_KEYS.usageWeights,
        z.object({
          gaming: weightSchema,
          office: weightSchema,
          creator: weightSchema,
          streaming: weightSchema,
        }),
        DEFAULT_SETTINGS.usageWeights,
      ),
    },
    budgetRatios: Object.fromEntries(
      USAGES.map((usage) => [
        usage,
        read(SETTING_KEYS.budgetRatio(usage), ratioSchema, DEFAULT_BUDGET_RATIOS[usage]),
      ]),
    ) as Record<UsageType, BudgetRatios>,
  };
}
