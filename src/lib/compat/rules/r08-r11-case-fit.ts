import { ids, partName } from '../context';
import { includesNorm, joinList, type Rule } from './helpers';

// กฎขนาดเคส R08–R11 ตรวจว่าอะไหล่ใส่ลงในเคสได้จริง

// R08 ขนาดเมนบอร์ด (ATX/mATX/ITX) ต้องอยู่ในรายการที่เคสรองรับ
export const r08BoardCase: Rule = ({ motherboard, pcCase }) => {
  if (!motherboard || !pcCase) return [];
  const ff = motherboard.part.spec.formFactor;
  const supported = pcCase.part.spec.supportedFormFactors;
  if (includesNorm(supported, ff)) return [];
  return [
    {
      code: 'R08',
      level: 'error',
      title: 'เคสใส่เมนบอร์ดขนาดนี้ไม่ได้',
      message: `${partName(motherboard)} เป็นขนาด ${ff} แต่ ${partName(pcCase)} รองรับเฉพาะ ${joinList(supported)}`,
      fix: `เลือกเคสที่รองรับบอร์ด ${ff} หรือเลือกบอร์ดขนาด ${joinList(supported)}`,
      partIds: ids(motherboard, pcCase),
      categories: ['motherboard', 'case'],
      suggest: { category: 'case', label: `ดูเคสที่รองรับบอร์ด ${ff}` },
    },
  ];
};

// R09 ความยาวการ์ดจอต้องไม่เกินที่เคสรองรับ
export const r09GpuLength: Rule = ({ gpu, pcCase }) => {
  if (!gpu || !pcCase) return [];
  const length = gpu.part.spec.lengthMm;
  const max = pcCase.part.spec.maxGpuLengthMm;
  if (length <= max) return [];
  return [
    {
      code: 'R09',
      level: 'error',
      title: 'การ์ดจอยาวเกินเคส',
      message: `${partName(gpu)} ยาว ${length} มม. แต่ ${partName(pcCase)} ใส่การ์ดจอได้ยาวสุด ${max} มม. (เกิน ${length - max} มม.)`,
      fix: `เลือกเคสที่รองรับการ์ดจอยาวอย่างน้อย ${length} มม. หรือการ์ดจอรุ่นที่สั้นกว่า`,
      partIds: ids(gpu, pcCase),
      categories: ['gpu', 'case'],
      suggest: { category: 'case', label: `ดูเคสที่ใส่การ์ดจอยาว ${length} มม. ได้` },
    },
  ];
};

// R10 ความสูงซิงก์ลมต้องไม่เกินที่เคสรองรับ (ชุดน้ำไม่ตรวจข้อนี้ ไปตรวจ R11 แทน)
export const r10CoolerHeight: Rule = ({ cooler, pcCase }) => {
  if (!cooler || !pcCase) return [];
  if (cooler.part.spec.type !== 'air' || cooler.part.spec.heightMm === null) return [];
  const height = cooler.part.spec.heightMm;
  const max = pcCase.part.spec.maxCoolerHeightMm;
  if (height <= max) return [];
  return [
    {
      code: 'R10',
      level: 'error',
      title: 'ซิงก์ลมสูงเกินเคส',
      message: `${partName(cooler)} สูง ${height} มม. แต่ ${partName(pcCase)} ใส่ซิงก์ลมได้สูงสุด ${max} มม. ปิดฝาข้างไม่ได้`,
      fix: `เลือกซิงก์ลมที่สูงไม่เกิน ${max} มม. หรือเปลี่ยนเป็นชุดน้ำ`,
      partIds: ids(cooler, pcCase),
      categories: ['cooler', 'case'],
      suggest: { category: 'cooler', label: `ดูชุดระบายความร้อนที่สูงไม่เกิน ${max} มม.` },
    },
  ];
};

// R11 ขนาดหม้อน้ำของชุดน้ำ (240/280/360 มม.) ต้องอยู่ในรายการที่เคสรองรับ
export const r11Radiator: Rule = ({ cooler, pcCase }) => {
  if (!cooler || !pcCase) return [];
  if (cooler.part.spec.type !== 'aio' || cooler.part.spec.radiatorMm === null) return [];
  const size = cooler.part.spec.radiatorMm;
  const supported = pcCase.part.spec.radiatorSupportMm;
  if (supported.includes(size)) return [];
  return [
    {
      code: 'R11',
      level: 'error',
      title: 'เคสใส่หม้อน้ำขนาดนี้ไม่ได้',
      message:
        supported.length === 0
          ? `${partName(cooler)} ใช้หม้อน้ำ ${size} มม. แต่ ${partName(pcCase)} ไม่มีจุดติดตั้งหม้อน้ำ`
          : `${partName(cooler)} ใช้หม้อน้ำ ${size} มม. แต่ ${partName(pcCase)} รองรับเฉพาะ ${joinList(supported)} มม.`,
      fix:
        supported.length === 0
          ? 'ใช้ซิงก์ลมแทน หรือเลือกเคสที่รองรับหม้อน้ำ'
          : `เลือกชุดน้ำขนาด ${joinList(supported)} มม. หรือเคสที่รองรับหม้อน้ำ ${size} มม.`,
      partIds: ids(cooler, pcCase),
      categories: ['cooler', 'case'],
    },
  ];
};
