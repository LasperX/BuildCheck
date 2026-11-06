import type { BuildContext } from './context';
import type { EngineItem, PriceResult, ScoreResult, UsageType } from './types';

// คะแนนประสิทธิภาพ หัวข้อ 4.4
//
//   Score = w_CPU · S_CPU + w_GPU · S_GPU
//
//   S_CPU, S_GPU คือคะแนน 0–100 ที่แอดมินกรอกให้แต่ละรุ่น (รุ่นแรงสุดในระบบ = 100)
//   w_CPU, w_GPU มาจากประเภทการใช้งาน เช่น เล่นเกม 0.3 / 0.7
//   ไม่มีการ์ดจอ (ใช้กราฟิกในตัว) ให้ S_GPU = 0
//
//   ความคุ้มค่า = Score ÷ ราคารวม × 10,000   ใช้จัดอันดับและเลือกตัวเลือก "คุ้มสุด"

export function calculateScore(
  ctx: BuildContext,
  usage: UsageType,
  totalPrice: number,
): ScoreResult {
  const weights = ctx.settings.usageWeights[usage];
  const cpu = ctx.cpu?.part.spec.perfScore ?? 0;
  const gpu = ctx.gpu?.part.spec.perfScore ?? 0;
  const score = Math.round((weights.cpu * cpu + weights.gpu * gpu) * 10) / 10;
  const value = totalPrice > 0 ? Math.round((score / totalPrice) * 10000 * 10) / 10 : 0;
  return { score, value };
}

/**
 * ราคาต่อชิ้นตามสภาพที่เลือก
 * มือหนึ่ง = ราคาอ้างอิง · มือสอง = ราคาที่ผู้ขายเสนอ ถ้าไม่ได้กรอกใช้ราคากลางมือสอง
 * ถ้ายังไม่มีราคามือสองเลย ใช้ราคาอ้างอิงไปก่อน เพื่อไม่ให้ราคารวมต่ำเกินจริง
 */
export function unitPrice(item: EngineItem): number {
  if (item.condition === 'new') return item.part.price;
  return item.offeredPrice ?? item.usedPrice ?? item.part.price;
}

export function calculatePrice(ctx: BuildContext, budget?: number | null): PriceResult {
  let total = 0;
  let totalNew = 0;
  for (const item of ctx.items) {
    total += unitPrice(item) * item.quantity;
    totalNew += item.part.price * item.quantity;
  }
  total = Math.round(total * 100) / 100;
  totalNew = Math.round(totalNew * 100) / 100;
  return {
    total,
    totalNew,
    saved: Math.max(0, Math.round((totalNew - total) * 100) / 100),
    overBudget: budget && total > budget ? Math.round((total - budget) * 100) / 100 : null,
  };
}
