import { ids, partName } from '../context';
import type { PowerResult } from '../types';
import { includesNorm, joinList, type Rule } from './helpers';

// R14 กำลังไฟ PSU (ใช้ค่าเผื่อชุดเดียวกับเกจและ PSU ที่แนะนำ ตามมติ Q2)
//   วัตต์รวม > วัตต์ PSU                       → ผิดพลาด จ่ายไฟไม่พอ เครื่องดับเมื่อใช้งานหนัก
//   วัตต์รวม × (1 + ค่าเผื่อ) > วัตต์ PSU      → เตือน เผื่อไม่ถึง 30%
// R14 รับผลจากสูตรกำลังไฟ (power.ts) มาใช้ ไม่คำนวณซ้ำ
export function r14PsuWattage(power: PowerResult): Rule {
  return ({ psu, settings }) => {
    if (!psu || power.load === null) return [];
    const psuWatt = psu.part.spec.wattage;
    const percent = Math.round(power.load * 100);
    const allIds = ids(psu);
    if (power.level === 'error') {
      return [
        {
          code: 'R14',
          level: 'error',
          title: 'PSU กำลังไฟไม่พอ',
          message: `สเปกนี้ใช้ไฟประมาณ ${power.totalWatt} W แต่ ${partName(psu)} จ่ายได้ ${psuWatt} W (โหลด ${percent}%) เครื่องอาจดับเมื่อใช้งานหนัก`,
          fix: `เปลี่ยน PSU เป็นอย่างน้อย ${power.recommendedWatt} W`,
          partIds: allIds,
          categories: ['psu'],
          suggest: { category: 'psu', label: `ดู PSU ${power.recommendedWatt} W ขึ้นไป` },
        },
      ];
    }
    if (power.level === 'warning') {
      const headroom = Math.round(settings.psuHeadroom * 100);
      return [
        {
          code: 'R14',
          level: 'warning',
          title: `PSU เผื่อกำลังไฟไม่ถึง ${headroom}%`,
          message: `สเปกนี้ใช้ไฟประมาณ ${power.totalWatt} W คิดเป็น ${percent}% ของ ${partName(psu)} (${psuWatt} W) ใช้ได้แต่ PSU ทำงานหนักและร้อน`,
          fix: `แนะนำ PSU ${power.recommendedWatt} W ขึ้นไป`,
          partIds: allIds,
          categories: ['psu'],
          suggest: { category: 'psu', label: `ดู PSU ${power.recommendedWatt} W ขึ้นไป` },
        },
      ];
    }
    return [];
  };
}

// R15 ขนาด PSU (ATX/SFX) ต้องอยู่ในรายการที่เคสรองรับ
export const r15PsuCase: Rule = ({ psu, pcCase }) => {
  if (!psu || !pcCase) return [];
  const ff = psu.part.spec.formFactor;
  const supported = pcCase.part.spec.psuFormFactors;
  if (includesNorm(supported, ff)) return [];
  return [
    {
      code: 'R15',
      level: 'error',
      title: 'เคสใส่ PSU ขนาดนี้ไม่ได้',
      message: `${partName(psu)} เป็นขนาด ${ff} แต่ ${partName(pcCase)} รองรับ PSU ${joinList(supported)}`,
      fix: `เลือก PSU ขนาด ${joinList(supported)} หรือเคสที่รองรับ PSU ${ff}`,
      partIds: ids(psu, pcCase),
      categories: ['psu', 'case'],
      suggest: {
        category: 'psu',
        label: `ดู PSU ขนาด ${joinList(supported)}`,
        filter: { formFactor: [...supported] },
      },
    },
  ];
};

// R16 สายไฟเลี้ยงการ์ดจอ: นับหัวต่อตามชื่อที่แอดมินกรอก เช่น { "8pin": 2 }
// PSU ต้องมีหัวชนิดเดียวกันอย่างน้อยเท่าที่การ์ดจอต้องการ ไม่แปลงข้ามชนิด (มติในหัวข้อ C)
// ใช้หัวแปลงได้ จึงเป็นแค่ "เตือน"
export const r16GpuConnectors: Rule = ({ gpu, psu }) => {
  if (!gpu || !psu) return [];
  const need = Object.entries(gpu.part.spec.powerConnectors).filter(
    ([name, count]) => name !== 'none' && count > 0,
  );
  const have = psu.part.spec.pcieConnectors;
  const missing = need
    .map(([name, count]) => ({ name, count, has: have[name] ?? 0 }))
    .filter((row) => row.has < row.count);
  if (missing.length === 0) return [];
  const detail = missing.map((row) => `${row.name} ต้องการ ${row.count} มี ${row.has}`).join(', ');
  return [
    {
      code: 'R16',
      level: 'warning',
      title: 'สายไฟการ์ดจอไม่พอ',
      message: `${partName(gpu)} ต้องการหัวไฟที่ ${partName(psu)} มีไม่พอ (${detail})`,
      fix: 'เลือก PSU ที่มีหัวต่อการ์ดจอครบ หลีกเลี่ยงการใช้สายแปลงกับการ์ดจอกินไฟสูง',
      partIds: ids(gpu, psu),
      categories: ['gpu', 'psu'],
      suggest: { category: 'psu', label: 'ดู PSU ที่มีหัวต่อการ์ดจอครบ' },
    },
  ];
};
