import type { CategorySlug } from '@/lib/parts/spec-fields';

import type { EngineItem, EngineSettings, ItemOf } from './types';

// แยกอะไหล่ในสเปกตามหมวดไว้ล่วงหน้า กฎแต่ละข้อจะได้ไม่ต้องค้นหาเอง

export type BuildContext = {
  items: EngineItem[];
  cpu?: ItemOf<'cpu'>;
  motherboard?: ItemOf<'motherboard'>;
  gpu?: ItemOf<'gpu'>;
  psu?: ItemOf<'psu'>;
  pcCase?: ItemOf<'case'>;
  cooler?: ItemOf<'cooler'>;
  rams: ItemOf<'ram'>[];
  storages: ItemOf<'storage'>[];
  settings: EngineSettings;
};

function isCategory<C extends CategorySlug>(category: C) {
  return (item: EngineItem): item is ItemOf<C> => item.part.categorySlug === category;
}

export function buildContext(items: EngineItem[], settings: EngineSettings): BuildContext {
  // จำนวนที่น้อยกว่า 1 ถือว่าไม่ได้เลือก ป้องกันข้อมูลผิดทำให้ผลรวมติดลบ
  const valid = items.filter((item) => item.quantity >= 1);
  return {
    items: valid,
    cpu: valid.find(isCategory('cpu')),
    motherboard: valid.find(isCategory('motherboard')),
    gpu: valid.find(isCategory('gpu')),
    psu: valid.find(isCategory('psu')),
    pcCase: valid.find(isCategory('case')),
    cooler: valid.find(isCategory('cooler')),
    rams: valid.filter(isCategory('ram')),
    storages: valid.filter(isCategory('storage')),
    settings,
  };
}

/** ชื่อที่แสดงในข้อความ เช่น "ASUS TUF B650-PLUS" */
export const partName = (item: EngineItem) => `${item.part.brandName} ${item.part.model}`.trim();

/** จำนวนแถวแรมทั้งหมด: แถวต่อชุด × จำนวนชุด */
export const totalSticks = (ctx: BuildContext) =>
  ctx.rams.reduce((sum, ram) => sum + ram.part.spec.sticksInKit * ram.quantity, 0);

/** ความจุแรมรวม (GB) */
export const totalMemoryGb = (ctx: BuildContext) =>
  ctx.rams.reduce(
    (sum, ram) => sum + ram.part.spec.capacityPerStickGb * ram.part.spec.sticksInKit * ram.quantity,
    0,
  );

export const ids = (...items: (EngineItem | undefined)[]) =>
  items.filter((item): item is EngineItem => Boolean(item)).map((item) => item.part.id);
