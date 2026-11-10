import type { BudgetOptionKind } from '@/lib/compat/budget';
import type { CompatStatus, Issue, ItemCondition, UsageType } from '@/lib/compat/types';
import type { CategorySlug } from '@/lib/parts/spec-fields';

// ข้อมูลที่ส่งจาก Server Action จัดสเปกตามงบไปหน้าเว็บ ส่งเฉพาะที่ต้องแสดง ไม่ส่งสเปกเต็ม

export const OPTION_LABELS: Record<BudgetOptionKind, { title: string; hint: string }> = {
  economy: { title: 'ประหยัด', hint: 'ใช้ราว 85% ของงบ เหลือเงินไว้ซื้ออุปกรณ์อื่น' },
  balanced: { title: 'สมดุล', hint: 'ใช้งบใกล้เต็ม ได้ประสิทธิภาพสูงสุดในงบ' },
  value: { title: 'คุ้มสุด', hint: 'คะแนนต่อราคาสูงสุดในงบนี้' },
};

export type BudgetOptionView = {
  kind: BudgetOptionKind;
  items: {
    partId: number;
    categorySlug: CategorySlug;
    quantity: number;
    condition: ItemCondition;
    /** ราคาต่อชิ้นตามสภาพ (มือสอง = ราคากลางของเกรดที่เลือก) */
    unitPrice: number;
    brandName: string;
    model: string;
    slug: string;
    price: number;
    chips: string[];
  }[];
  status: CompatStatus;
  total: number;
  /** ราคาถ้าซื้อใหม่ทั้งชุด และยอดที่ประหยัดได้ */
  totalNew: number;
  saved: number;
  totalWatt: number;
  recommendedWatt: number;
  psuLoad: number | null;
  score: number;
  value: number;
  /** ข้อควรรู้ระดับเตือนและข้อมูล (ไม่มีระดับผิดพลาดเพราะอัลกอริทึมไม่ส่งชุดที่ผิดพลาด) */
  notes: Pick<Issue, 'code' | 'level' | 'title'>[];
};

export type BudgetResponse =
  | {
      ok: true;
      budget: number;
      usage: UsageType;
      options: BudgetOptionView[];
      allocation: Record<CategorySlug, number>;
      brandFallback: boolean;
    }
  | {
      ok: false;
      error: string;
      budget?: number;
      usage?: UsageType;
      minimumBudget?: number | null;
      allocation?: Record<CategorySlug, number>;
      /** ทางเลือกที่ลองจัดจริงแล้วว่าได้ผล ให้ผู้ใช้กดลองต่อได้ทันที ไม่เจอทางตัน */
      alternatives?: BudgetAlternative[];
    };

/**
 * ทางเลือกเมื่องบไม่พอ ทุกข้อลองจัดบนเซิร์ฟเวอร์แล้วว่าได้ชุดที่เข้ากันได้จริง
 * - used: รวมอะไหล่มือสอง (ราคากลางเกรด B ไม่รวม PSU) ที่งบ budget
 * - usage: เปลี่ยนประเภทการใช้งาน จัดได้ในงบเดิม
 * - brand: ไม่จำกัดยี่ห้อ CPU จัดได้ในงบเดิม
 */
export type BudgetAlternative =
  { kind: 'used'; budget: number } | { kind: 'usage'; usage: UsageType } | { kind: 'brand' };
