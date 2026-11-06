import { type BuildContext, partName } from '../context';
import { assessOffer } from '../used-price';
import type { EngineItem, Issue } from '../types';
import { includesNorm, type Rule } from './helpers';

// กฎเฉพาะมือสอง U01–U06 หัวข้อ 4.6
// ทำงานเฉพาะอะไหล่ที่ผู้ใช้สลับเป็น "มือสอง" (condition = A, B หรือ C) ของมือหนึ่งไม่ถูกตรวจ
// ไม่มีกฎข้อไหนเป็นระดับผิดพลาด เพราะของมือสองยังใช้งานได้ ระบบแค่เตือนให้ตรวจก่อนซื้อ

const isUsed = (item: EngineItem | undefined): item is EngineItem =>
  Boolean(item) && item?.condition !== 'new';

/** PSU มือสองที่อายุเกินเท่านี้ (ปี) เตือนหนักขึ้น */
export const OLD_PSU_YEARS = 5;

// U01 การ์ดจอมือสอง: ความเสี่ยงหลักคือการ์ดที่เคยใช้ขุดเหรียญหรือร้อนจัด
export const u01UsedGpu: Rule = ({ gpu }) => {
  if (!isUsed(gpu)) return [];
  return [
    {
      code: 'U01',
      level: 'warning',
      title: 'การ์ดจอมือสอง ตรวจก่อนซื้อ',
      message: `${partName(gpu)} เป็นของมือสอง การ์ดจอที่ผ่านการใช้งานหนัก เช่น ขุดเหรียญ อาจเสื่อมเร็ว`,
      fix: 'ขอดูรันโปรแกรมทดสอบอย่างน้อย 15 นาที ถามประวัติการใช้ขุดเหรียญ และดูอุณหภูมิขณะทดสอบ',
      partIds: [gpu.part.id],
      categories: ['gpu'],
    },
  ];
};

// U02 PSU มือสอง: PSU เสียอาจพาอะไหล่อื่นเสียด้วย อายุเกิน 5 ปีจากปีวางขายเตือนหนักขึ้น
export const u02UsedPsu =
  (currentYear?: number): Rule =>
  ({ psu }) => {
    if (!isUsed(psu)) return [];
    const releaseYear = psu.part.releaseYear;
    // อ่านนาฬิกาเฉพาะตอนที่มี PSU มือสองจริง และเฉพาะเมื่อผู้เรียกไม่ได้ส่งปีมา
    const year = currentYear ?? new Date().getFullYear();
    const age = releaseYear === null ? null : year - releaseYear;
    const old = age !== null && age > OLD_PSU_YEARS;
    return [
      {
        code: 'U02',
        level: 'warning',
        title: old ? `PSU มือสองอายุเกิน ${OLD_PSU_YEARS} ปี` : 'PSU มือสอง',
        message: old
          ? `${partName(psu)} วางขายมาประมาณ ${age} ปี ตัวเก็บประจุภายในเสื่อมตามอายุ ถ้า PSU เสียอาจพาอะไหล่อื่นเสียไปด้วย`
          : `${partName(psu)} เป็นของมือสอง ถ้า PSU เสียอาจพาอะไหล่อื่นเสียไปด้วย`,
        fix: old
          ? 'ไม่แนะนำให้ซื้อ PSU มือสองที่อายุมากขนาดนี้ ควรซื้อใหม่'
          : 'แนะนำซื้อ PSU ใหม่ ถ้าจำเป็นต้องใช้มือสอง ให้เลือกตัวที่ยังมีประกัน',
        partIds: [psu.part.id],
        categories: ['psu'],
      },
    ];
  };

// U03 เก็บข้อมูลมือสอง: SSD/HDD มีอายุการเขียน ต้องดูค่า Health
export const u03UsedStorage: Rule = ({ storages }) => {
  const used = storages.filter(isUsed);
  if (used.length === 0) return [];
  return [
    {
      code: 'U03',
      level: 'warning',
      title: 'อุปกรณ์เก็บข้อมูลมือสอง',
      message: `${used.map(partName).join(', ')} เป็นของมือสอง อุปกรณ์เก็บข้อมูลมีอายุการเขียนจำกัด`,
      fix: 'ขอดูค่า Health จากโปรแกรมตรวจสุขภาพดิสก์ ต้องไม่ต่ำกว่า 90% ก่อนซื้อ',
      partIds: used.map((item) => item.part.id),
      categories: ['storage'],
    },
  ];
};

// U04 ไม่มีประกันเหลือ: ผู้ใช้กรอกประกันที่เหลือเป็น 0 เดือน (ไม่กรอก = ไม่ทราบ จึงไม่เตือน)
export const u04NoWarranty: Rule = ({ items }) => {
  const noWarranty = items.filter((item) => isUsed(item) && item.warrantyMonthsLeft === 0);
  if (noWarranty.length === 0) return [];
  return [
    {
      code: 'U04',
      level: 'info',
      title: 'ไม่มีประกันเหลือ',
      message: `${noWarranty.map(partName).join(', ')} ไม่มีประกันเหลือ ถ้าเสียต้องซ่อมหรือซื้อใหม่เอง`,
      fix: 'ทดสอบให้ละเอียดก่อนรับของ หรือเลือกชิ้นที่ยังมีประกันเหลือ',
      partIds: noWarranty.map((item) => item.part.id),
      categories: [...new Set(noWarranty.map((item) => item.part.categorySlug))],
    },
  ];
};

// U05 แพลตฟอร์มเก่า: CPU หรือเมนบอร์ดมือสองใช้ Socket ที่อยู่ในรายการเลิกผลิต (แอดมินตั้งค่า)
export const u05LegacyPlatform: Rule = (ctx: BuildContext) => {
  const { cpu, motherboard, settings } = ctx;
  if (!isUsed(cpu) && !isUsed(motherboard)) return [];
  const socket = cpu?.part.spec.socket ?? motherboard?.part.spec.socket;
  if (!socket || !includesNorm(settings.legacySockets, socket)) return [];
  const related: EngineItem[] = [];
  if (cpu) related.push(cpu);
  if (motherboard) related.push(motherboard);
  return [
    {
      code: 'U05',
      level: 'info',
      title: 'แพลตฟอร์มเก่า',
      message: `Socket ${socket} เลิกผลิตแล้ว ในอนาคตจะหา CPU รุ่นใหม่มาอัปเกรดได้จำกัด`,
      fix: 'ถ้าตั้งใจใช้ยาวหรืออยากอัปเกรดภายหลัง ลองดูแพลตฟอร์มที่ยังผลิตอยู่',
      partIds: related.map((item) => item.part.id),
      categories: related.map((item) => item.part.categorySlug),
    },
  ];
};

// U06 ราคาถูกผิดปกติ: ราคาที่ผู้ขายเสนอต่ำกว่า 60% ของราคากลาง
export const u06SuspiciousPrice: Rule = ({ items }) => {
  const issues: Issue[] = [];
  for (const item of items) {
    if (!isUsed(item) || !item.offeredPrice || !item.usedPrice) continue;
    const { verdict, ratio } = assessOffer(item.offeredPrice, item.usedPrice);
    if (verdict !== 'suspicious') continue;
    issues.push({
      code: 'U06',
      level: 'warning',
      title: 'ราคาถูกผิดปกติ',
      message: `${partName(item)} ราคาที่เสนอ ${item.offeredPrice.toLocaleString('th-TH')} บาท คิดเป็น ${Math.round(ratio * 100)}% ของราคากลาง ${item.usedPrice.toLocaleString('th-TH')} บาท`,
      fix: 'ระวังของเสีย ของผิดกฎหมาย หรือมิจฉาชีพ ขอดูของจริงและนัดรับของ ไม่โอนเงินก่อน',
      partIds: [item.part.id],
      categories: [item.part.categorySlug],
    });
  }
  return issues;
};
