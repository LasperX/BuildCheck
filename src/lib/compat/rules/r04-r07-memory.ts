import { partName, totalMemoryGb, totalSticks } from '../context';
import { norm, type Rule } from './helpers';

// กฎเกี่ยวกับแรม R04–R07 ตรวจแรมทุกชุดที่เลือกเทียบกับเมนบอร์ด
// "แถว" = จำนวนแรมจริงที่เสียบ: ชุด 16 GB × 2 จำนวน 1 ชุด = 2 แถว

// R04 ชนิดแรม (DDR4/DDR5) ต้องตรงกับบอร์ด รอยบากต่างกัน เสียบไม่ได้
export const r04RamType: Rule = ({ rams, motherboard }) => {
  if (!motherboard || rams.length === 0) return [];
  const mbType = motherboard.part.spec.memoryType;
  const wrong = rams.filter((ram) => norm(ram.part.spec.type) !== norm(mbType));
  if (wrong.length === 0) return [];
  return [
    {
      code: 'R04',
      level: 'error',
      title: 'ชนิดแรมไม่ตรงกับเมนบอร์ด',
      message: `${partName(motherboard)} ใช้แรม ${mbType} แต่ ${wrong.map((ram) => `${partName(ram)} เป็น ${ram.part.spec.type}`).join(', ')} เสียบด้วยกันไม่ได้`,
      fix: `เปลี่ยนแรมเป็น ${mbType}`,
      partIds: [motherboard.part.id, ...wrong.map((ram) => ram.part.id)],
      categories: ['ram', 'motherboard'],
      suggest: { category: 'ram', label: `ดูแรม ${mbType}`, filter: { type: [mbType] } },
    },
  ];
};

// R05 จำนวนแถวแรมรวมต้องไม่เกินจำนวนช่องบนบอร์ด
export const r05RamSlots: Rule = (ctx) => {
  const { rams, motherboard } = ctx;
  if (!motherboard || rams.length === 0) return [];
  const sticks = totalSticks(ctx);
  const slots = motherboard.part.spec.memorySlots;
  if (sticks <= slots) return [];
  return [
    {
      code: 'R05',
      level: 'error',
      title: 'แรมเกินจำนวนช่อง',
      message: `เลือกแรมรวม ${sticks} แถว แต่ ${partName(motherboard)} มีช่องแรม ${slots} ช่อง`,
      fix: `ลดจำนวนแรมให้เหลือไม่เกิน ${slots} แถว หรือใช้แรมความจุต่อแถวสูงขึ้น`,
      partIds: [motherboard.part.id, ...rams.map((ram) => ram.part.id)],
      categories: ['ram', 'motherboard'],
    },
  ];
};

// R06 ความจุแรมรวมต้องไม่เกินที่บอร์ดรองรับ
export const r06RamCapacity: Rule = (ctx) => {
  const { rams, motherboard } = ctx;
  if (!motherboard || rams.length === 0) return [];
  const total = totalMemoryGb(ctx);
  const max = motherboard.part.spec.maxMemoryGb;
  if (total <= max) return [];
  return [
    {
      code: 'R06',
      level: 'error',
      title: 'ความจุแรมเกินที่บอร์ดรองรับ',
      message: `แรมรวม ${total} GB แต่ ${partName(motherboard)} รองรับสูงสุด ${max} GB`,
      fix: `ลดความจุแรมรวมให้ไม่เกิน ${max} GB`,
      partIds: [motherboard.part.id, ...rams.map((ram) => ram.part.id)],
      categories: ['ram', 'motherboard'],
    },
  ];
};

// R07 แรมเร็วกว่าที่บอร์ดรองรับ ใช้ได้แต่จะถูกลดความเร็วลงมาเท่าที่บอร์ดรับไหว
export const r07RamSpeed: Rule = ({ rams, motherboard }) => {
  if (!motherboard || rams.length === 0) return [];
  const max = motherboard.part.spec.maxMemorySpeed;
  const fast = rams.filter((ram) => ram.part.spec.speedMts > max);
  if (fast.length === 0) return [];
  return [
    {
      code: 'R07',
      level: 'warning',
      title: 'แรมเร็วกว่าที่บอร์ดรองรับ',
      message: `${fast.map((ram) => `${partName(ram)} (${ram.part.spec.speedMts} MT/s)`).join(', ')} จะวิ่งได้แค่ ${max} MT/s ตามที่ ${partName(motherboard)} รองรับ`,
      fix: `ใช้แรมความเร็ว ${max} MT/s ซึ่งมักถูกกว่า หรือเปลี่ยนบอร์ดที่รองรับความเร็วสูงขึ้น`,
      partIds: [motherboard.part.id, ...fast.map((ram) => ram.part.id)],
      categories: ['ram', 'motherboard'],
    },
  ];
};
