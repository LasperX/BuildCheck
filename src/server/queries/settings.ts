import 'server-only';

import { inArray } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { z } from 'zod';

import { settings } from '@/db/schema';
import { type BudgetRatios, DEFAULT_BUDGET_RATIOS } from '@/lib/compat/budget';
import { DEFAULT_SETTINGS } from '@/lib/compat/settings';
import { DEFAULT_USED_SETTINGS, type UsedSettings } from '@/lib/compat/used-price';
import type { EngineSettings, UsageType } from '@/lib/compat/types';
import { db } from '@/lib/db';

// ค่าตั้งระบบจากตาราง settings (แอดมินแก้ที่ /admin/settings และ /admin/used-prices)
// ยังไม่มีแถวหรือค่าผิดรูปแบบ → ใช้ค่าตั้งต้นในโค้ด ระบบจึงทำงานได้เสมอ

const USAGES: UsageType[] = ['gaming', 'office', 'creator', 'streaming'];

export const ratioSchema = z
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

// น้ำหนัก CPU + การ์ดจอ ต้องรวมได้ 1 (หัวข้อ 4.4)
export const weightSchema = z
  .object({ cpu: z.number().min(0).max(1), gpu: z.number().min(0).max(1) })
  .refine((w) => Math.abs(w.cpu + w.gpu - 1) < 0.005);

export const usageWeightsSchema = z.object({
  gaming: weightSchema,
  office: weightSchema,
  creator: weightSchema,
  streaming: weightSchema,
});
export const psuHeadroomSchema = z.number().min(0).max(1);
export const motherboardWattSchema = z.number().int().min(0).max(300);

const rate = z.number().gt(0).max(1);
export const depreciationSchema = z.object({
  cpu: rate,
  gpu: rate,
  motherboard: rate,
  ram: rate,
  storage: rate,
  psu: rate,
  case: rate,
  cooler: rate,
});
export const gradeFactorSchema = z.object({ A: rate, B: rate, C: rate });
export const legacySocketsSchema = z.array(z.string().trim().min(1).max(20)).max(50);

export const SETTING_KEYS = {
  psuHeadroom: 'psu_headroom',
  motherboardDefaultWatt: 'mb_default_watt',
  usageWeights: 'usage_weights',
  depreciationRates: 'depreciation_rates',
  gradeFactors: 'grade_factors',
  legacySockets: 'legacy_sockets',
  usedReportWindowDays: 'used_report_window_days',
  budgetRatio: (usage: UsageType) => `budget_ratio_${usage}`,
} as const;

export type SystemConfig = {
  engine: EngineSettings;
  budgetRatios: Record<UsageType, BudgetRatios>;
  used: UsedSettings;
};

export async function getSystemConfig(): Promise<SystemConfig> {
  'use cache';
  cacheTag('settings');
  cacheLife('minutes');

  const keys = [
    SETTING_KEYS.psuHeadroom,
    SETTING_KEYS.motherboardDefaultWatt,
    SETTING_KEYS.usageWeights,
    SETTING_KEYS.depreciationRates,
    SETTING_KEYS.gradeFactors,
    SETTING_KEYS.legacySockets,
    SETTING_KEYS.usedReportWindowDays,
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
      psuHeadroom: read(SETTING_KEYS.psuHeadroom, psuHeadroomSchema, DEFAULT_SETTINGS.psuHeadroom),
      motherboardDefaultWatt: read(
        SETTING_KEYS.motherboardDefaultWatt,
        motherboardWattSchema,
        DEFAULT_SETTINGS.motherboardDefaultWatt,
      ),
      usageWeights: read(
        SETTING_KEYS.usageWeights,
        usageWeightsSchema,
        DEFAULT_SETTINGS.usageWeights,
      ),
      legacySockets: read(
        SETTING_KEYS.legacySockets,
        legacySocketsSchema,
        DEFAULT_SETTINGS.legacySockets,
      ),
    },
    used: {
      depreciationRates: read(
        SETTING_KEYS.depreciationRates,
        depreciationSchema,
        DEFAULT_USED_SETTINGS.depreciationRates,
      ),
      gradeFactors: read(
        SETTING_KEYS.gradeFactors,
        gradeFactorSchema,
        DEFAULT_USED_SETTINGS.gradeFactors,
      ),
      reportWindowDays: read(
        SETTING_KEYS.usedReportWindowDays,
        z.number().int().min(7).max(365),
        DEFAULT_USED_SETTINGS.reportWindowDays,
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
