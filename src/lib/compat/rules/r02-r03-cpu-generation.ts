import { ids, partName } from '../context';
import { includesNorm, joinList, norm, type Rule } from './helpers';

// R02 CPU ↔ ชิปเซ็ต และ R03 CPU ↔ BIOS
// Socket เดียวกันไม่ได้แปลว่าใช้ได้ทุกรุ่น ชิปเซ็ตแต่ละตัวรองรับ CPU เฉพาะบางรุ่น (generation)
//   - อยู่ใน supportedGenerations                 → ผ่าน
//   - อยู่ใน biosUpdateGenerations เท่านั้น          → R03 เตือน: ใช้ได้แต่ต้องอัปเดต BIOS ก่อน
//   - ไม่อยู่ทั้งสองรายการ                          → R02 ผิดพลาด
// ทั้งสองกฎตรวจเมื่อ Socket ตรงกันแล้วเท่านั้น ถ้า Socket ไม่ตรง R01 แจ้งไปแล้ว ไม่ต้องแจ้งซ้ำ

export const r02CpuChipset: Rule = ({ cpu, motherboard }) => {
  if (!cpu || !motherboard) return [];
  if (norm(cpu.part.spec.socket) !== norm(motherboard.part.spec.socket)) return [];
  const gen = cpu.part.spec.generation;
  const mb = motherboard.part.spec;
  if (includesNorm(mb.supportedGenerations, gen) || includesNorm(mb.biosUpdateGenerations, gen)) {
    return [];
  }
  return [
    {
      code: 'R02',
      level: 'error',
      title: 'ชิปเซ็ตไม่รองรับ CPU รุ่นนี้',
      message: `${partName(cpu)} เป็นรุ่น ${gen} แต่ชิปเซ็ต ${mb.chipset} ของ ${partName(motherboard)} รองรับเฉพาะ ${joinList([...mb.supportedGenerations, ...mb.biosUpdateGenerations])}`,
      fix: `เปลี่ยนเมนบอร์ดเป็นรุ่นที่รองรับ ${gen} หรือเปลี่ยน CPU เป็นรุ่นที่บอร์ดนี้รองรับ`,
      partIds: ids(cpu, motherboard),
      categories: ['cpu', 'motherboard'],
      suggest: {
        category: 'motherboard',
        label: `ดูเมนบอร์ด ${cpu.part.spec.socket} ที่รองรับ ${gen}`,
        filter: { socket: [cpu.part.spec.socket] },
      },
    },
  ];
};

export const r03CpuBios: Rule = ({ cpu, motherboard }) => {
  if (!cpu || !motherboard) return [];
  if (norm(cpu.part.spec.socket) !== norm(motherboard.part.spec.socket)) return [];
  const gen = cpu.part.spec.generation;
  const mb = motherboard.part.spec;
  if (includesNorm(mb.supportedGenerations, gen)) return [];
  if (!includesNorm(mb.biosUpdateGenerations, gen)) return [];
  return [
    {
      code: 'R03',
      level: 'warning',
      title: 'ต้องอัปเดต BIOS ก่อนใช้งาน',
      message: `${partName(motherboard)} รองรับ ${partName(cpu)} (รุ่น ${gen}) หลังอัปเดต BIOS เท่านั้น ถ้าบอร์ดที่ได้มายังเป็น BIOS เก่า เครื่องจะเปิดไม่ติด`,
      fix: 'ถามร้านให้อัปเดต BIOS ให้ก่อนส่ง หรือเลือกบอร์ดที่รองรับ CPU นี้ตั้งแต่แรก',
      partIds: ids(cpu, motherboard),
      categories: ['cpu', 'motherboard'],
    },
  ];
};
