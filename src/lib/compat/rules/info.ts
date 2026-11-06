import { CATEGORY_LABELS, type CategorySlug } from '@/lib/parts/spec-fields';

import { partName, totalSticks } from '../context';
import type { PriceResult } from '../types';
import type { Rule } from './helpers';

// ข้อความระดับ "ข้อมูล" เป็นคำแนะนำ ไม่ทำให้สถานะรวมเปลี่ยนสี

/** หมวดจำเป็น (มติในหัวข้อ C) การ์ดจอและระบายความร้อนดูแลโดย R18 และ I02 แทน */
export const REQUIRED_CATEGORIES: CategorySlug[] = [
  'cpu',
  'motherboard',
  'ram',
  'storage',
  'psu',
  'case',
];

// I01 ยังเลือกไม่ครบหมวดจำเป็น (แสดงเมื่อเริ่มเลือกแล้วอย่างน้อย 1 ชิ้น)
export const i01MissingCategories: Rule = ({ items }) => {
  if (items.length === 0) return [];
  const have = new Set(items.map((item) => item.part.categorySlug));
  const missing = REQUIRED_CATEGORIES.filter((cat) => !have.has(cat));
  if (missing.length === 0) return [];
  return [
    {
      code: 'I01',
      level: 'info',
      title: 'ยังเลือกอะไหล่ไม่ครบ',
      message: `ยังไม่ได้เลือก ${missing.map((cat) => CATEGORY_LABELS[cat]).join(', ')}`,
      fix: 'เลือกอะไหล่ให้ครบทุกหมวดจำเป็นเพื่อให้ตรวจได้ครบทุกกฎ',
      partIds: [],
      categories: missing,
      suggest: { category: missing[0], label: `เลือก ${CATEGORY_LABELS[missing[0]]}` },
    },
  ];
};

// I02 CPU ไม่มีพัดลมแถมและยังไม่ได้เลือกชุดระบายความร้อน
export const i02NoCooler: Rule = ({ cpu, cooler }) => {
  if (!cpu || cooler || cpu.part.spec.includesCooler) return [];
  return [
    {
      code: 'I02',
      level: 'info',
      title: 'ยังไม่มีชุดระบายความร้อน',
      message: `${partName(cpu)} ไม่มีพัดลมแถมมาในกล่อง`,
      fix: 'เลือกซิงก์ลมหรือชุดน้ำที่รองรับ Socket ของ CPU',
      partIds: [cpu.part.id],
      categories: ['cooler'],
      suggest: {
        category: 'cooler',
        label: `ดูชุดระบายความร้อนที่รองรับ ${cpu.part.spec.socket}`,
      },
    },
  ];
};

// I03 ราคารวมเกินงบที่ตั้งไว้
export function i03OverBudget(price: PriceResult, budget: number | null | undefined): Rule {
  return () => {
    if (!budget || price.overBudget === null) return [];
    return [
      {
        code: 'I03',
        level: 'info',
        title: 'ราคารวมเกินงบ',
        message: `ราคารวม ${price.total.toLocaleString('th-TH')} บาท เกินงบ ${budget.toLocaleString('th-TH')} บาท อยู่ ${price.overBudget.toLocaleString('th-TH')} บาท`,
        fix: 'ลดรุ่นอะไหล่บางชิ้น หรือพิจารณาอะไหล่มือสอง',
        partIds: [],
        categories: [],
      },
    ];
  };
}

// I04 แรมแถวเดียว ทำงานแบบ Single Channel แบนด์วิดท์ครึ่งเดียว
export const i04SingleChannel: Rule = (ctx) => {
  if (ctx.rams.length === 0 || totalSticks(ctx) !== 1) return [];
  return [
    {
      code: 'I04',
      level: 'info',
      title: 'ใส่แรมแถวเดียว',
      message: 'แรมแถวเดียวทำงานแบบ Single Channel ประสิทธิภาพต่ำกว่าแรม 2 แถวที่ความจุเท่ากัน',
      fix: 'แนะนำแรม 2 แถวเพื่อ Dual Channel เช่น 8 GB × 2 แทน 16 GB × 1',
      partIds: ctx.rams.map((ram) => ram.part.id),
      categories: ['ram'],
      suggest: { category: 'ram', label: 'ดูแรมชุด 2 แถว' },
    },
  ];
};
