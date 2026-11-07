import { type CheckResult, type EngineItem, unitPrice } from '@/lib/compat';
import { CATEGORY_SLUGS, type CategorySlug } from '@/lib/parts/spec-fields';

// เทียบสเปก 2–3 ชุด (หัวข้อ 3.6) ฟังก์ชันล้วน ทดสอบได้โดยไม่ต้องมีฐานข้อมูล
//   1. แต่ละหมวด: เอาชื่ออะไหล่ของทุกชุดมาเทียบ ถ้าไม่เหมือนกันทุกชุด = ช่องที่ต่างกัน (ไฮไลต์)
//   2. "แรงกว่า" วัดด้วยตัวเลขที่เทียบกันได้ตรง ๆ ของหมวดนั้น:
//        CPU และการ์ดจอ = คะแนนประสิทธิภาพ (0–100) · แรม = ความจุรวม (GB)
//        เก็บข้อมูล = ความจุรวม (GB) · PSU = วัตต์
//      หมวดอื่น (เมนบอร์ด เคส ชุดระบายความร้อน) ไม่มีตัวเลขที่บอกว่า "แรงกว่า" ได้ จึงไม่ตัดสิน
//   3. ชุดที่ได้ค่าดีที่สุดคนเดียวเท่านั้นที่ได้ป้าย ถ้าเสมอกันไม่ให้ใคร

export type CompareInput = { items: EngineItem[]; result: CheckResult };

export type CompareCell = {
  /** ชื่ออะไหล่ในหมวดนี้ (หลายชิ้นคั่นด้วยบรรทัดใหม่) ว่าง = ไม่ได้เลือก */
  names: string[];
  price: number;
  /** รหัสอะไหล่ จำนวน และสภาพ ใช้ตัดสินว่าช่องต่างกันไหม (ชื่อรุ่นอาจซ้ำกันได้) */
  signature: string;
  /** ค่าที่ใช้เทียบความแรง null = หมวดนี้ไม่เทียบ หรือไม่ได้เลือก */
  metric: number | null;
};

export type CompareRow = {
  category: CategorySlug;
  cells: CompareCell[];
  differs: boolean;
  /** ชุดที่แรงกว่าในหมวดนี้ (ตำแหน่งในอาร์เรย์) null = ไม่ตัดสินหรือเสมอ */
  best: number | null;
  metricLabel: string | null;
};

export type CompareTotals = {
  key: 'price' | 'watt' | 'score' | 'value';
  label: string;
  values: number[];
  /** ค่าน้อยดีกว่า (ราคา วัตต์) หรือค่ามากดีกว่า (คะแนน ความคุ้มค่า) */
  better: 'lower' | 'higher';
  best: number | null;
};

const METRIC_LABELS: Partial<Record<CategorySlug, string>> = {
  cpu: 'คะแนน',
  gpu: 'คะแนน',
  ram: 'GB',
  storage: 'GB',
  psu: 'W',
};

function metricOf(category: CategorySlug, items: EngineItem[]): number | null {
  if (items.length === 0) return null;
  let total = 0;
  for (const { part, quantity } of items) {
    switch (part.categorySlug) {
      case 'cpu':
      case 'gpu':
        total = Math.max(total, part.spec.perfScore);
        break;
      case 'ram':
        total += part.spec.capacityPerStickGb * part.spec.sticksInKit * quantity;
        break;
      case 'storage':
        total += part.spec.capacityGb * quantity;
        break;
      case 'psu':
        total = Math.max(total, part.spec.wattage);
        break;
      default:
        return null;
    }
  }
  return METRIC_LABELS[category] ? total : null;
}

/** ตำแหน่งที่ดีที่สุดแบบไม่เสมอ ถ้ามีค่าว่างหรือมีน้อยกว่า 2 ค่าให้ null */
export function uniqueBest(values: (number | null)[], better: 'lower' | 'higher'): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length < 2) return null;
  const target = better === 'higher' ? Math.max(...present) : Math.min(...present);
  const winners = values.flatMap((value, index) => (value === target ? [index] : []));
  return winners.length === 1 ? (winners[0] ?? null) : null;
}

export function compareBuilds(builds: CompareInput[]): {
  rows: CompareRow[];
  totals: CompareTotals[];
} {
  const rows = CATEGORY_SLUGS.map((category): CompareRow => {
    const cells = builds.map(({ items }) => {
      const inCategory = items.filter((item) => item.part.categorySlug === category);
      return {
        names: inCategory.map(
          (item) =>
            `${item.part.brandName} ${item.part.model}${item.quantity > 1 ? ` × ${item.quantity}` : ''}${item.condition !== 'new' ? ` (มือสอง ${item.condition})` : ''}`,
        ),
        signature: inCategory
          .map((item) => `${item.part.id}x${item.quantity}${item.condition}`)
          .sort()
          .join('|'),
        price: inCategory.reduce((sum, item) => sum + unitPrice(item) * item.quantity, 0),
        metric: metricOf(category, inCategory),
      };
    });
    return {
      category,
      cells,
      differs: new Set(cells.map((cell) => cell.signature)).size > 1,
      best: uniqueBest(
        cells.map((cell) => cell.metric),
        'higher',
      ),
      metricLabel: METRIC_LABELS[category] ?? null,
    };
  }).filter((row) => row.cells.some((cell) => cell.names.length > 0));

  const totalRow = (
    key: CompareTotals['key'],
    label: string,
    better: CompareTotals['better'],
    pick: (result: CheckResult) => number,
  ): CompareTotals => {
    const values = builds.map(({ result }) => pick(result));
    return { key, label, values, better, best: uniqueBest(values, better) };
  };

  return {
    rows,
    totals: [
      totalRow('price', 'ราคารวม', 'lower', (r) => r.price.total),
      totalRow('watt', 'วัตต์รวม', 'lower', (r) => r.power.totalWatt),
      totalRow('score', 'คะแนนประสิทธิภาพ', 'higher', (r) => r.score.score),
      totalRow('value', 'ความคุ้มค่า', 'higher', (r) => r.score.value),
    ],
  };
}
