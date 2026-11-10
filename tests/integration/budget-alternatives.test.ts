import { describe, expect, it } from 'vitest';

import { DEFAULT_USED_CATEGORIES } from '@/lib/compat/budget';
import { generateBudgetBuilds } from '@/server/actions/budget';

import { requestState } from './setup';

// ทางเลือกเมื่องบไม่พอ (หน้าจัดตามงบ): ทุกทางเลือกที่ส่งกลับต้องกดลองแล้วได้ชุดจริง
// ใช้อะไหล่ในฐานข้อมูลทดสอบตามจริง จึงไม่ผูกกับตัวเลขราคา ตรวจที่คุณสมบัติแทน

let ip = 1;
/** IP ต่างกันทุกครั้ง ไม่ให้ชนตัวจำกัด 20 ครั้งต่อนาที */
function freshRequest() {
  requestState.headers = new Headers({ 'x-forwarded-for': `10.77.0.${ip++}` });
}

const base = {
  usage: 'gaming' as const,
  allowUsed: false,
  usedCategories: [],
  usedGrade: 'B' as const,
};

describe('generateBudgetBuilds: ทางเลือกเมื่องบไม่พอ', () => {
  it('งบต่ำมากได้ ok: false พร้อมงบขั้นต่ำ และทุกทางเลือกลองแล้วได้ผลจริง', async () => {
    freshRequest();
    const result = await generateBudgetBuilds({ ...base, budget: 5000 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Array.isArray(result.alternatives)).toBe(true);

    for (const alt of result.alternatives ?? []) {
      freshRequest();
      if (alt.kind === 'usage') {
        const retry = await generateBudgetBuilds({ ...base, budget: 5000, usage: alt.usage });
        expect(retry.ok, `เปลี่ยนเป็น ${alt.usage}`).toBe(true);
        expect(alt.usage).not.toBe('gaming');
      } else if (alt.kind === 'used') {
        const retry = await generateBudgetBuilds({
          ...base,
          budget: alt.budget,
          allowUsed: true,
          usedCategories: [...DEFAULT_USED_CATEGORIES],
        });
        expect(retry.ok, `รวมมือสองที่งบ ${alt.budget}`).toBe(true);
        // ทางเลือกมือสองต้องถูกกว่าซื้อมือหนึ่งทั้งชุด ไม่งั้นไม่ควรแนะนำ
        if (result.minimumBudget) expect(alt.budget).toBeLessThan(result.minimumBudget);
      }
    }

    if (result.minimumBudget) {
      freshRequest();
      const atMinimum = await generateBudgetBuilds({ ...base, budget: result.minimumBudget });
      expect(atMinimum.ok, 'งบขั้นต่ำที่บอกต้องจัดได้จริง').toBe(true);
    }
  });

  it('เปิดมือสองไว้แล้ว ไม่แนะนำมือสองซ้ำ', async () => {
    freshRequest();
    const result = await generateBudgetBuilds({
      ...base,
      budget: 5000,
      allowUsed: true,
      usedCategories: [...DEFAULT_USED_CATEGORIES],
    });
    if (result.ok) return;
    expect(result.alternatives?.some((alt) => alt.kind === 'used')).toBe(false);
  });

  it('งบพอ ได้ตัวเลือกตามปกติ ไม่มีทางเลือกแนบมา', async () => {
    freshRequest();
    const result = await generateBudgetBuilds({ ...base, budget: 300000 });
    expect(result.ok).toBe(true);
    expect('alternatives' in result).toBe(false);
  });
});
