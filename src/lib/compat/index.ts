// Compatibility Engine หัวข้อ 4.1–4.4
// จุดเข้าเดียวของการตรวจสเปก ทั้งหน้าจัดสเปก (ฝั่งเบราว์เซอร์) และ Server Action ตอนบันทึก เรียก checkBuild ตัวนี้

import { buildContext } from './context';
import { calculatePower } from './power';
import { r01CpuSocket } from './rules/r01-cpu-socket';
import { r02CpuChipset, r03CpuBios } from './rules/r02-r03-cpu-generation';
import { r04RamType, r05RamSlots, r06RamCapacity, r07RamSpeed } from './rules/r04-r07-memory';
import { r08BoardCase, r09GpuLength, r10CoolerHeight, r11Radiator } from './rules/r08-r11-case-fit';
import { r12CoolerSocket, r13CoolerTdp } from './rules/r12-r13-cooler';
import { r14PsuWattage, r15PsuCase, r16GpuConnectors } from './rules/r14-r16-psu';
import { r17StorageSlots } from './rules/r17-storage-slots';
import { r18NoDisplay } from './rules/r18-no-display';
import { i01MissingCategories, i02NoCooler, i03OverBudget, i04SingleChannel } from './rules/info';
import type { Rule } from './rules/helpers';
import { calculatePrice, calculateScore } from './score';
import { resolveSettings } from './settings';
import type {
  BuildInput,
  CheckResult,
  CompatStatus,
  EngineItem,
  EnginePart,
  Issue,
  Level,
  RuleCode,
} from './types';

export * from './types';
export { DEFAULT_SETTINGS, resolveSettings } from './settings';
export { calculatePower, recommendedPsuWatt, powerLevel } from './power';
export { calculatePrice, calculateScore, unitPrice } from './score';
export { REQUIRED_CATEGORIES } from './rules/info';

const LEVEL_ORDER: Record<Level, number> = { error: 0, warning: 1, info: 2 };

/** เรียงผิดพลาด → เตือน → ข้อมูล ระดับเดียวกันเรียงตามรหัสกฎ */
export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort(
    (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.code.localeCompare(b.code),
  );
}

/** มีผิดพลาดอย่างน้อย 1 = แดง · มีแต่เตือน = เหลือง · ไม่มีเลย = เขียว (ระดับข้อมูลไม่นับ) */
export function overallStatus(issues: Issue[]): CompatStatus {
  if (issues.some((issue) => issue.level === 'error')) return 'error';
  if (issues.some((issue) => issue.level === 'warning')) return 'warning';
  return 'ok';
}

/**
 * ตรวจสเปกทั้งชุด ขั้นตอนตามหัวข้อ 4.2
 *   1. แยกอะไหล่ตามหมวด
 *   2. คำนวณกำลังไฟ ราคา และคะแนน
 *   3. รันทุกกฎ กฎที่อะไหล่ยังเลือกไม่ครบจะคืนผลว่างเอง
 *   4. เรียงปัญหา แล้วสรุปสถานะรวม
 */
export function checkBuild(input: BuildInput): CheckResult {
  const settings = resolveSettings(input.settings);
  const ctx = buildContext(input.items, settings);
  const power = calculatePower(ctx);
  const price = calculatePrice(ctx, input.budget);
  const score = calculateScore(ctx, input.usage ?? 'gaming', price.total);

  const rules: Rule[] = [
    r01CpuSocket,
    r02CpuChipset,
    r03CpuBios,
    r04RamType,
    r05RamSlots,
    r06RamCapacity,
    r07RamSpeed,
    r08BoardCase,
    r09GpuLength,
    r10CoolerHeight,
    r11Radiator,
    r12CoolerSocket,
    r13CoolerTdp,
    r14PsuWattage(power),
    r15PsuCase,
    r16GpuConnectors,
    r17StorageSlots,
    r18NoDisplay,
    i01MissingCategories,
    i02NoCooler,
    i03OverBudget(price, input.budget),
    i04SingleChannel,
  ];

  const issues = sortIssues(rules.flatMap((rule) => rule(ctx)));
  const counts: Record<Level, number> = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) counts[issue.level] += 1;

  return { status: overallStatus(issues), issues, counts, power, price, score };
}

/** หมวดที่ใส่ได้ชิ้นเดียว เพิ่มชิ้นใหม่จะแทนชิ้นเดิม (แรมและเก็บข้อมูลใส่ได้หลายชิ้น) */
export const SINGLE_ITEM_CATEGORIES = new Set([
  'cpu',
  'motherboard',
  'gpu',
  'psu',
  'case',
  'cooler',
]);

export type CandidateResult = {
  /** ใส่ชิ้นนี้แล้วยังไม่มีผิดพลาดเพิ่มจากเดิม */
  compatible: boolean;
  /** ปัญหาระดับผิดพลาดที่เกิดขึ้นใหม่เพราะชิ้นนี้ */
  errors: Issue[];
  /** ปัญหาระดับเตือนที่เกิดขึ้นใหม่เพราะชิ้นนี้ */
  warnings: Issue[];
};

const issueKey = (issue: Issue) => `${issue.code}|${issue.title}`;

/**
 * ตัวกรองอัจฉริยะ (หัวข้อ 3.3): ลองใส่อะไหล่ตัวเลือกลงในสเปกปัจจุบัน แล้วดูว่าเกิดปัญหาใหม่ไหม
 * หมวดชิ้นเดียวจะแทนชิ้นเดิม ส่วนแรม/เก็บข้อมูลจะแทนชิ้นที่ระบุใน replacePartId หรือเพิ่มเข้าไป
 *
 * มี 2 โหมด
 *   ปกติ (เลือกอะไหล่ทั่วไป): เทียบกับสเปกที่ ยังไม่มีชิ้นนี้ ปัญหาทุกข้อที่ชิ้นนี้ทำให้เกิดนับหมด
 *     เช่น เปลี่ยนการ์ดจอยาวเกินเคสเป็นอีกรุ่นที่ยาวเกินเหมือนกัน ก็ยังถูกตัด
 *   แก้ปัญหา (fix = รหัสกฎ จากปุ่มแนะนำอะไหล่ทดแทน): ชิ้นนี้ต้องทำให้ปัญหานั้นหายไป
 *     และต้องไม่สร้างปัญหาใหม่ที่สเปกปัจจุบันยังไม่มี ปัญหาอื่นที่มีอยู่แล้วไม่นับ
 *     เพราะผู้ใช้กำลังแก้ทีละข้อ เช่นแก้ Socket ก่อน แล้วค่อยแก้ชนิดแรม
 */
export function evaluateCandidate(
  input: BuildInput,
  candidate: EnginePart,
  replacePartId?: number,
  fix?: RuleCode,
): CandidateResult {
  const single = SINGLE_ITEM_CATEGORIES.has(candidate.categorySlug);
  const kept = input.items.filter((item) => {
    if (single) return item.part.categorySlug !== candidate.categorySlug;
    return replacePartId === undefined || item.part.id !== replacePartId;
  });
  const next: EngineItem = { part: candidate, quantity: 1, condition: 'new' };

  const baseline = fix ? input.items : kept;
  const before = new Set(checkBuild({ ...input, items: baseline }).issues.map(issueKey));
  const all = checkBuild({ ...input, items: [...kept, next] }).issues;
  const fresh = all.filter((issue) => issue.level !== 'info' && !before.has(issueKey(issue)));
  // R18 (ไม่มีภาพออกจอ) แก้ได้ด้วยการเลือกการ์ดจอภายหลัง จึงไม่ตัด CPU ที่ไม่มีกราฟิกในตัวออกจากรายการ
  // แต่ยังแสดงเป็นข้อควรรู้ให้ผู้ใช้เห็น
  const errors = fresh.filter((issue) => issue.level === 'error' && issue.code !== 'R18');
  const warnings = fresh.filter((issue) => issue.level === 'warning' || issue.code === 'R18');
  // โหมดแก้ปัญหา: ปัญหาเดิมยังอยู่ = ชิ้นนี้ไม่ได้ช่วยแก้
  const unresolved = fix ? all.find((issue) => issue.code === fix) : undefined;
  if (unresolved) errors.unshift(unresolved);
  return { compatible: errors.length === 0, errors, warnings };
}
