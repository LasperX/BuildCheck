import { ids, partName } from '../context';
import { norm, type Rule } from './helpers';

// R01 CPU ↔ เมนบอร์ด: Socket ต้องตรงกัน ไม่ตรง = ใส่ CPU ลงบอร์ดไม่ได้ทางกายภาพ
export const r01CpuSocket: Rule = ({ cpu, motherboard }) => {
  if (!cpu || !motherboard) return [];
  const cpuSocket = cpu.part.spec.socket;
  const mbSocket = motherboard.part.spec.socket;
  if (norm(cpuSocket) === norm(mbSocket)) return [];
  return [
    {
      code: 'R01',
      level: 'error',
      title: 'Socket ไม่ตรงกัน',
      message: `${partName(cpu)} ใช้ Socket ${cpuSocket} แต่ ${partName(motherboard)} ใช้ ${mbSocket} ทั้งสองชิ้นใส่ด้วยกันไม่ได้`,
      fix: `เปลี่ยนเมนบอร์ดเป็นรุ่นที่ใช้ Socket ${cpuSocket} หรือเปลี่ยน CPU เป็นรุ่น Socket ${mbSocket}`,
      partIds: ids(cpu, motherboard),
      categories: ['cpu', 'motherboard'],
      suggest: {
        category: 'motherboard',
        label: `ดูเมนบอร์ด ${cpuSocket} ในงบใกล้เคียง`,
        filter: { socket: [cpuSocket] },
      },
    },
  ];
};
