import { partName } from '../context';
import type { Issue } from '../types';
import type { Rule } from './helpers';

// R17 ช่องเก็บข้อมูล: นับ SSD แบบ M.2 เทียบช่อง M.2 และไดรฟ์ SATA (SSD 2.5" และ HDD) เทียบพอร์ต SATA
// ตรวจแยกสองเรื่อง จึงคืนปัญหาได้สูงสุด 2 ข้อ
export const r17StorageSlots: Rule = ({ storages, motherboard }) => {
  if (!motherboard || storages.length === 0) return [];
  const mb = motherboard.part.spec;
  const m2 = storages.filter((s) => s.part.spec.interface === 'M2');
  const sata = storages.filter((s) => s.part.spec.interface === 'SATA');
  const count = (list: typeof storages) => list.reduce((sum, s) => sum + s.quantity, 0);
  const issues: Issue[] = [];

  const m2Count = count(m2);
  if (m2Count > mb.m2Slots) {
    issues.push({
      code: 'R17',
      level: 'error',
      title: 'SSD M.2 เกินจำนวนช่อง',
      message: `เลือก SSD M.2 รวม ${m2Count} ตัว แต่ ${partName(motherboard)} มีช่อง M.2 ${mb.m2Slots} ช่อง`,
      fix: `ลด SSD M.2 ให้เหลือ ${mb.m2Slots} ตัว หรือใช้ SSD แบบ SATA แทนบางตัว`,
      partIds: [motherboard.part.id, ...m2.map((s) => s.part.id)],
      categories: ['storage', 'motherboard'],
    });
  }

  const sataCount = count(sata);
  if (sataCount > mb.sataPorts) {
    issues.push({
      code: 'R17',
      level: 'error',
      title: 'ไดรฟ์ SATA เกินจำนวนพอร์ต',
      message: `เลือกไดรฟ์ SATA รวม ${sataCount} ตัว แต่ ${partName(motherboard)} มีพอร์ต SATA ${mb.sataPorts} พอร์ต`,
      fix: `ลดไดรฟ์ SATA ให้เหลือ ${mb.sataPorts} ตัว หรือใช้ไดรฟ์ความจุสูงขึ้นแทน`,
      partIds: [motherboard.part.id, ...sata.map((s) => s.part.id)],
      categories: ['storage', 'motherboard'],
    });
  }
  return issues;
};
