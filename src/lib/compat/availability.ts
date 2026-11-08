import type { ItemCondition, PartAvailability } from './types';
import type { UsedGrade } from './used-price';

// อะไหล่ที่ "มีแต่มือสอง" (เลิกขายมือหนึ่งแล้ว) ต้องคิดเป็นมือสองเสมอ
// ใช้ฟังก์ชันกลางนี้ทุกที่ที่อ่านสภาพของชิ้น (ราคา กฎมือสอง บันทึกสเปก) ผลจึงตรงกันทั้งเว็บ

/** เกรดที่ใช้เมื่อชิ้นที่มีแต่มือสองถูกตั้งเป็น "มือหนึ่ง" มา (เช่นสเปกเก่าก่อนแอดมินเปลี่ยนสถานะ) */
export const USED_ONLY_FALLBACK_GRADE: UsedGrade = 'B';

export const isUsedOnly = (part: { availability?: PartAvailability | undefined }) =>
  part.availability === 'used_only';

/** สภาพที่ใช้จริง: ชิ้นที่มีแต่มือสองเลือก "มือหนึ่ง" ไม่ได้ จึงเปลี่ยนเป็นมือสองเกรด B */
export function effectiveCondition(
  part: { availability?: PartAvailability | undefined },
  condition: ItemCondition,
): ItemCondition {
  return condition === 'new' && isUsedOnly(part) ? USED_ONLY_FALLBACK_GRADE : condition;
}
