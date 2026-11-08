import {
  isUsedOnly,
  type ItemCondition,
  type PartAvailability,
  USED_ONLY_FALLBACK_GRADE,
} from '@/lib/compat';
import type { CategorySlug } from '@/lib/parts/spec-fields';

// กติกาสภาพอะไหล่ในหน้าจัดสเปก (ฟังก์ชันล้วน ทดสอบได้)
// - ชิ้นที่ "มีแต่มือสอง" เป็นมือหนึ่งไม่ได้
// - PSU ไม่เปลี่ยนเป็นมือสองให้อัตโนมัติ เพราะ PSU มือสองที่เสียอาจพาอะไหล่อื่นเสียด้วย (หัวข้อ 3.11)
//   ผู้ใช้ยังกดเปลี่ยน PSU เป็นมือสองเองทีละชิ้นได้

type PartInfo = { availability?: PartAvailability | undefined; categorySlug: CategorySlug };
type ItemInfo = { partId: number; condition: ItemCondition };

/** สภาพของชิ้นที่เพิ่งเลือก ตามค่าตั้งต้น "ชิ้นที่เพิ่มต่อจากนี้" */
export function conditionForNewPart(
  part: PartInfo,
  defaultCondition: ItemCondition,
): ItemCondition {
  if (isUsedOnly(part)) {
    return defaultCondition === 'new' ? USED_ONLY_FALLBACK_GRADE : defaultCondition;
  }
  if (part.categorySlug === 'psu') return 'new';
  return defaultCondition;
}

/**
 * ปุ่ม "เปลี่ยนทั้งชุด": คืนเฉพาะชิ้นที่ต้องเปลี่ยน (รหัสอะไหล่ → สภาพใหม่)
 * - เป็นมือหนึ่งทั้งชุด: ข้ามชิ้นที่มีแต่มือสอง
 * - เป็นมือสองทั้งชุด: ข้าม PSU
 */
export function bulkConditionUpdates(
  items: ItemInfo[],
  parts: Map<number, PartInfo>,
  target: ItemCondition,
): Record<number, ItemCondition> {
  const updates: Record<number, ItemCondition> = {};
  for (const item of items) {
    const part = parts.get(item.partId);
    if (!part) continue;
    if (target === 'new' && isUsedOnly(part)) continue;
    if (target !== 'new' && part.categorySlug === 'psu') continue;
    if (item.condition !== target) updates[item.partId] = target;
  }
  return updates;
}

/** ชิ้นที่มีแต่มือสองแต่รายการตั้งเป็นมือหนึ่ง (เช่นแอดมินเพิ่งเปลี่ยนสถานะ) → เปลี่ยนเป็นมือสองเกรด B */
export function impossibleConditionFixes(
  items: ItemInfo[],
  parts: Map<number, PartInfo>,
): Record<number, ItemCondition> {
  const fixes: Record<number, ItemCondition> = {};
  for (const item of items) {
    const part = parts.get(item.partId);
    if (part && item.condition === 'new' && isUsedOnly(part)) {
      fixes[item.partId] = USED_ONLY_FALLBACK_GRADE;
    }
  }
  return fixes;
}
