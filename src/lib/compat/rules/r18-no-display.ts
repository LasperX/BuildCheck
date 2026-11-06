import { partName } from '../context';
import type { Rule } from './helpers';

// R18 ไม่มีภาพออกจอ: CPU ไม่มีกราฟิกในตัว (เช่นรุ่นที่ลงท้าย F) และยังไม่ได้เลือกการ์ดจอ
// ทำงานทันทีที่เลือก CPU แม้ยังไม่ครบหมวด เพราะกฎนี้ตรวจ "การไม่มีการ์ดจอ" โดยตรง (มติในหัวข้อ C)
export const r18NoDisplay: Rule = ({ cpu, gpu }) => {
  if (!cpu || gpu || cpu.part.spec.hasIgpu) return [];
  return [
    {
      code: 'R18',
      level: 'error',
      title: 'ไม่มีภาพออกจอ',
      message: `${partName(cpu)} ไม่มีกราฟิกในตัว และยังไม่ได้เลือกการ์ดจอ เครื่องจะไม่มีภาพออกจอ`,
      fix: 'เพิ่มการ์ดจอ หรือเปลี่ยนเป็น CPU ที่มีกราฟิกในตัว',
      partIds: [cpu.part.id],
      categories: ['cpu', 'gpu'],
      suggest: { category: 'gpu', label: 'เลือกการ์ดจอ' },
    },
  ];
};
