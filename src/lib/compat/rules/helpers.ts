import type { BuildContext } from '../context';
import type { Issue } from '../types';

/** กฎหนึ่งข้อ = ฟังก์ชันที่รับสเปกแล้วคืนรายการปัญหา (ไม่มีปัญหาคืนอาร์เรย์ว่าง) */
export type Rule = (ctx: BuildContext) => Issue[];

/** เทียบชื่อแบบไม่สนตัวพิมพ์และช่องว่าง เช่น "am5" กับ "AM5 " ถือว่าตรงกัน */
export const norm = (value: string) => value.trim().toUpperCase();

export const includesNorm = (list: readonly string[], value: string) =>
  list.some((item) => norm(item) === norm(value));

export const joinList = (list: readonly (string | number)[]) =>
  list.length === 0 ? '-' : list.join(', ');
