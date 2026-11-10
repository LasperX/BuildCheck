'use server';

import { headers } from 'next/headers';
import type { z } from 'zod';

import type { BudgetAlternative, BudgetResponse } from '@/lib/builder/budget-types';
import type { BuilderPart } from '@/lib/builder/types';
import { DEFAULT_USED_CATEGORIES, generateBudgetBuilds as runBudget } from '@/lib/compat/budget';
import type { UsedGrade } from '@/lib/compat/used-price';
import { CATEGORY_SLUGS, type CategorySlug } from '@/lib/parts/spec-fields';
import { clientIp, hitRateLimit } from '@/lib/rate-limit';
import { budgetInputSchema } from '@/lib/validators/budget';
import { usageTypeSchema } from '@/lib/validators/builds';
import { getCategoryEngineParts } from '@/server/queries/engine-parts';
import { getSystemConfig } from '@/server/queries/settings';
import { getUsedPriceSets } from '@/server/queries/used';

// generateBudgetBuilds ในหัวข้อ 8.3 ทุกคนเรียกได้ ไม่ต้องล็อกอิน
// คำนวณบนเซิร์ฟเวอร์เพราะต้องใช้อะไหล่ทุกหมวด จำกัด 20 ครั้งต่อนาทีต่อ IP กันยิงถี่

const RATE_LIMIT = 20;

export async function generateBudgetBuilds(
  raw: z.input<typeof budgetInputSchema>,
): Promise<BudgetResponse> {
  const parsed = budgetInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' };
  }
  const { budget, usage, cpuBrand, allowUsed, usedCategories, usedGrade } = parsed.data;

  const limit = await hitRateLimit(`budget:${clientIp(await headers())}`, 60);
  if (limit.count > RATE_LIMIT) {
    return { ok: false, error: 'ขอจัดสเปกถี่เกินไป กรุณารอสักครู่' };
  }

  const [config, ...groups] = await Promise.all([
    getSystemConfig(),
    ...CATEGORY_SLUGS.map((category) => getCategoryEngineParts(category)),
  ]);
  const catalog = groups.flat();
  const usedFor = async (categories: readonly CategorySlug[], grade: UsedGrade) => {
    const sets = await getUsedPriceSets(
      catalog.filter((part) => categories.includes(part.categorySlug)).map((p) => p.id),
    );
    const prices = Object.fromEntries(
      Object.entries(sets).map(([id, set]) => [id, set[grade].median]),
    );
    return { categories, grade, prices };
  };
  const used = allowUsed && usedCategories.length ? await usedFor(usedCategories, usedGrade) : null;

  const run = (over: Partial<Parameters<typeof runBudget>[0]> = {}) => {
    const runUsage = over.usage ?? usage;
    return runBudget({
      budget,
      usage: runUsage,
      cpuBrand,
      catalog,
      ratios: config.budgetRatios[runUsage],
      settings: config.engine,
      used,
      ...over,
    });
  };

  const result = run();

  if (!result.ok) {
    return {
      ok: false,
      error: result.minimumBudget
        ? `งบนี้ยังจัดสเปกที่เข้ากันได้ไม่ได้ งบขั้นต่ำสำหรับประเภทนี้ประมาณ ${result.minimumBudget.toLocaleString('th-TH')} บาท`
        : 'ในระบบยังมีอะไหล่ไม่พอสำหรับจัดสเปกครบชุด',
      budget,
      usage,
      minimumBudget: result.minimumBudget,
      allocation: result.allocation,
      alternatives: await findAlternatives(),
    };
  }

  /** ลองจัดจริงทีละทางเลือก ส่งกลับเฉพาะทางที่ได้ผล คำนวณบนเซิร์ฟเวอร์ ไม่เรียกฐานข้อมูลเพิ่มนอกจากราคามือสอง */
  async function findAlternatives(): Promise<BudgetAlternative[]> {
    const found: BudgetAlternative[] = [];
    // 1. รวมมือสอง (ถ้ายังไม่ได้เปิด) ใช้ค่าเริ่มต้นของฟอร์ม: เกรด B ไม่รวม PSU
    if (!used) {
      const withUsed = run({ used: await usedFor(DEFAULT_USED_CATEGORIES, 'B') });
      const usedBudget = withUsed.ok ? budget : withUsed.minimumBudget;
      // บอกเฉพาะเมื่อถูกกว่าการซื้อมือหนึ่งทั้งชุด ไม่งั้นไม่ได้ช่วยอะไร
      if (
        usedBudget &&
        (!result.ok && result.minimumBudget ? usedBudget < result.minimumBudget : true)
      ) {
        found.push({ kind: 'used', budget: usedBudget });
      }
    }
    // 2. ไม่จำกัดยี่ห้อ CPU
    if (cpuBrand && run({ cpuBrand: undefined }).ok) found.push({ kind: 'brand' });
    // 3. ประเภทการใช้งานอื่นที่จัดได้ในงบเดิม
    for (const other of usageTypeSchema.options) {
      if (other !== usage && run({ usage: other }).ok) found.push({ kind: 'usage', usage: other });
    }
    return found;
  }

  return {
    ok: true,
    budget,
    usage,
    allocation: result.allocation,
    brandFallback: result.brandFallback,
    options: result.options.map((option) => ({
      kind: option.kind,
      totalNew: option.result.price.totalNew,
      saved: option.result.price.saved,
      items: option.items.map((item) => {
        // อะไหล่ในแคตตาล็อกมาจาก getCategoryEngineParts จึงมีข้อมูลแสดงผลครบ
        const part = item.part as BuilderPart;
        return {
          partId: part.id,
          categorySlug: part.categorySlug,
          quantity: item.quantity,
          condition: item.condition,
          unitPrice: item.condition === 'new' ? part.price : (item.usedPrice ?? part.price),
          brandName: part.brandName,
          model: part.model,
          slug: part.slug,
          price: part.price,
          chips: part.chips,
        };
      }),
      status: option.result.status,
      total: option.result.price.total,
      totalWatt: option.result.power.totalWatt,
      recommendedWatt: option.result.power.recommendedWatt,
      psuLoad: option.result.power.load,
      score: option.result.score.score,
      value: option.result.score.value,
      notes: option.result.issues.map(({ code, level, title }) => ({ code, level, title })),
    })),
  };
}
