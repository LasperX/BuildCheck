import type { BuildContext } from './context';
import type { PowerLevel, PowerResult } from './types';

// สูตรคำนวณกำลังไฟ หัวข้อ 4.3
//
//   W_total = TDP_CPU + TBP_GPU + W_MB + 5·n_RAM + 7·n_SSD + 10·n_HDD + W_cooler + 15
//
//   n_RAM คือจำนวนแถวแรม ไม่ใช่จำนวนชุด, n_SSD รวม NVMe และ SATA SSD
//   W_MB = วัตต์ที่แอดมินกรอก (50 หรือ 80) ถ้าไม่กรอกใช้ 50
//   W_cooler = ซิงก์ลม 5 / ชุดน้ำ 15
//   15 วัตต์สุดท้ายคือพัดลมเคสและพอร์ต USB
//
//   PSU ที่แนะนำ = ⌈ W_total × (1 + ค่าเผื่อ) ÷ 50 ⌉ × 50   (ค่าเผื่อ 30% ตามมติ Q2)
//
// อะไหล่ที่ยังไม่ได้เลือกนับเป็น 0 วัตต์ และถ้าสเปกยังว่างทั้งหมด วัตต์รวมเป็น 0

export const WATT_PER_RAM_STICK = 5;
export const WATT_PER_SSD = 7;
export const WATT_PER_HDD = 10;
export const WATT_AIR_COOLER = 5;
export const WATT_AIO_COOLER = 15;
export const WATT_BASE = 15;

/** ปัดขึ้นเป็นหลัก 50 วัตต์ เช่น 483.6 → 500 */
export const roundUpTo50 = (watt: number) => Math.ceil(watt / 50) * 50;

export function recommendedPsuWatt(totalWatt: number, headroom: number): number {
  if (totalWatt <= 0) return 0;
  // ปัดเศษทศนิยมที่เกิดจากการคูณก่อน เช่น 1500 × 1.1 = 1650.0000000000002 ต้องได้ 1650 ไม่ใช่ 1700
  return roundUpTo50(Math.round(totalWatt * (1 + headroom) * 1000) / 1000);
}

/**
 * ระดับของเกจไฟตามมติ Q2:
 *   ok      โหลดไม่เกิน 1 ÷ 1.3 ≈ 76.9% (เผื่อถึง 30%)
 *   warning โหลดเกิน 76.9% แต่ไม่เกิน 100%
 *   error   โหลดเกิน 100% PSU จ่ายไฟไม่พอ
 */
export function powerLevel(load: number | null, headroom: number): PowerLevel {
  if (load === null) return 'none';
  if (load > 1) return 'error';
  if (load > 1 / (1 + headroom) + 1e-9) return 'warning';
  return 'ok';
}

export function calculatePower(ctx: BuildContext): PowerResult {
  const breakdown: { label: string; watt: number }[] = [];
  const add = (label: string, watt: number) => {
    if (watt > 0) breakdown.push({ label, watt });
  };

  if (ctx.cpu) add('CPU (TDP)', ctx.cpu.part.spec.tdpWatt);
  if (ctx.gpu) add('การ์ดจอ (TBP)', ctx.gpu.part.spec.tbpWatt);
  if (ctx.motherboard) {
    add('เมนบอร์ด', ctx.motherboard.part.powerWatt ?? ctx.settings.motherboardDefaultWatt);
  }

  const sticks = ctx.rams.reduce((sum, ram) => sum + ram.part.spec.sticksInKit * ram.quantity, 0);
  add(`แรม ${sticks} แถว`, WATT_PER_RAM_STICK * sticks);

  const ssd = ctx.storages
    .filter((s) => s.part.spec.type !== 'HDD')
    .reduce((sum, s) => sum + s.quantity, 0);
  const hdd = ctx.storages
    .filter((s) => s.part.spec.type === 'HDD')
    .reduce((sum, s) => sum + s.quantity, 0);
  add(`SSD ${ssd} ตัว`, WATT_PER_SSD * ssd);
  add(`HDD ${hdd} ตัว`, WATT_PER_HDD * hdd);

  if (ctx.cooler) {
    const aio = ctx.cooler.part.spec.type === 'aio';
    add(aio ? 'ชุดน้ำ' : 'ซิงก์ลม', aio ? WATT_AIO_COOLER : WATT_AIR_COOLER);
  }

  const partsWatt = breakdown.reduce((sum, row) => sum + row.watt, 0);
  // ค่าคงที่ 15 วัตต์นับเมื่อมีอะไหล่ที่ใช้ไฟอย่างน้อย 1 ชิ้น
  if (partsWatt > 0) add('พัดลมเคสและ USB', WATT_BASE);
  const totalWatt = breakdown.reduce((sum, row) => sum + row.watt, 0);

  const psuWatt = ctx.psu?.part.spec.wattage ?? null;
  const load = psuWatt && totalWatt > 0 ? totalWatt / psuWatt : null;

  return {
    totalWatt,
    recommendedWatt: recommendedPsuWatt(totalWatt, ctx.settings.psuHeadroom),
    psuWatt,
    load,
    level: powerLevel(load, ctx.settings.psuHeadroom),
    headroom: ctx.settings.psuHeadroom,
    breakdown,
  };
}
