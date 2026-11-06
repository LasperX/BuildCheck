import { ids, partName } from '../context';
import { includesNorm, joinList, type Rule } from './helpers';

// R12 ชุดระบายความร้อนต้องมีขายึดสำหรับ Socket ของ CPU
export const r12CoolerSocket: Rule = ({ cpu, cooler }) => {
  if (!cpu || !cooler) return [];
  const socket = cpu.part.spec.socket;
  const supported = cooler.part.spec.supportedSockets;
  if (includesNorm(supported, socket)) return [];
  return [
    {
      code: 'R12',
      level: 'error',
      title: 'ชุดระบายความร้อนไม่รองรับ Socket',
      message: `${partName(cpu)} ใช้ Socket ${socket} แต่ ${partName(cooler)} มีขายึดสำหรับ ${joinList(supported)} เท่านั้น`,
      fix: `เลือกชุดระบายความร้อนที่รองรับ Socket ${socket}`,
      partIds: ids(cpu, cooler),
      categories: ['cpu', 'cooler'],
      suggest: { category: 'cooler', label: `ดูชุดระบายความร้อนที่รองรับ ${socket}` },
    },
  ];
};

// R13 ชุดระบายความร้อนรับความร้อนได้น้อยกว่า TDP ของ CPU
// ใส่ได้และเปิดติด แต่ CPU จะร้อนและลดความเร็วตัวเอง (thermal throttling) จึงเป็นแค่ "เตือน"
export const r13CoolerTdp: Rule = ({ cpu, cooler }) => {
  if (!cpu || !cooler) return [];
  const tdp = cpu.part.spec.tdpWatt;
  const max = cooler.part.spec.maxTdpWatt;
  if (max >= tdp) return [];
  return [
    {
      code: 'R13',
      level: 'warning',
      title: 'ชุดระบายความร้อนอาจไม่พอ',
      message: `${partName(cpu)} มี TDP ${tdp} W แต่ ${partName(cooler)} รับได้ ${max} W ใช้งานหนักนานๆ CPU จะร้อนและลดความเร็วลง`,
      fix: `เลือกชุดระบายความร้อนที่รับ TDP ได้อย่างน้อย ${tdp} W`,
      partIds: ids(cpu, cooler),
      categories: ['cpu', 'cooler'],
      suggest: { category: 'cooler', label: `ดูชุดระบายความร้อนที่รับได้ ${tdp} W ขึ้นไป` },
    },
  ];
};
