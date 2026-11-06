import {
  evaluateCandidate,
  type EngineItem,
  type EngineSettings,
  type UsageType,
} from '@/lib/compat';
import { PARTS_PAGE_SIZE, SPEC_FILTERS } from '@/lib/parts/catalog';
import type { CandidatesQuery } from '@/lib/validators/builds';

import type { BuilderPart, CandidateItem, CandidatesResponse } from './types';

// รายการในหน้าต่างเลือกอะไหล่ (ตัวกรองอัจฉริยะ หัวข้อ 3.3)
// ฟังก์ชันล้วน รับอะไหล่ทั้งหมวดกับสเปกปัจจุบัน แล้วคืนรายการที่กรอง เรียง และแบ่งหน้าแล้ว
//
// ขั้นตอน
//   1. กรองตามคำค้น ยี่ห้อ ช่วงราคา และสเปกเฉพาะหมวด
//   2. ลองใส่แต่ละชิ้นลงในสเปกด้วย evaluateCandidate แล้วติดป้ายเข้ากันได้/ไม่ได้
//   3. ถ้าเปิดกรองอัจฉริยะ ซ่อนชิ้นที่ทำให้เกิดปัญหาระดับผิดพลาด
//   4. เรียงลำดับ แล้วตัดเป็นหน้าละ 24 ชิ้น

function matchesText(part: BuilderPart, q: string | undefined) {
  if (!q) return true;
  const haystack = `${part.brandName} ${part.model}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

function matchesSpec(part: BuilderPart, spec: Record<string, string[]>) {
  const allowed = SPEC_FILTERS[part.categorySlug].map((filter) => filter.key);
  const values = part.spec as unknown as Record<string, unknown>;
  return Object.entries(spec).every(([key, wanted]) => {
    if (!allowed.includes(key) || wanted.length === 0) return true;
    const value = values[key];
    const have = Array.isArray(value) ? value.map(String) : [String(value)];
    return have.some((item) => wanted.includes(item));
  });
}

export function rankCandidates(
  all: BuilderPart[],
  current: EngineItem[],
  query: CandidatesQuery,
  settings?: Partial<EngineSettings>,
): CandidatesResponse {
  const usage: UsageType = query.usage;
  const filtered = all.filter(
    (part) =>
      part.categorySlug === query.category &&
      matchesText(part, query.q) &&
      (query.brand.length === 0 || query.brand.includes(part.brandId)) &&
      (query.min === undefined || part.price >= query.min) &&
      (query.max === undefined || part.price <= query.max) &&
      matchesSpec(part, query.spec),
  );

  const evaluated: CandidateItem[] = filtered.map((part) => {
    const result = evaluateCandidate(
      { items: current, usage, settings },
      part,
      query.replace,
      query.fix,
    );
    const worst = result.errors[0] ?? result.warnings[0] ?? null;
    const { spec: _spec, ...rest } = part;
    return {
      ...rest,
      compatible: result.compatible,
      issue: worst && {
        code: worst.code,
        // R18 ไม่ทำให้ตัวเลือกใช้ไม่ได้ (เลือกการ์ดจอทีหลังได้) จึงแสดงเป็นข้อควรรู้ ไม่ใช่สีแดง
        level: worst.code === 'R18' ? 'info' : worst.level,
        title: worst.title,
        message: worst.message,
      },
    };
  });

  const visible = query.smart ? evaluated.filter((item) => item.compatible) : evaluated;

  const near = query.near ?? 0;
  const byYear = (item: CandidateItem) => item.releaseYear ?? 0;
  const sorters: Record<CandidatesQuery['sort'], (a: CandidateItem, b: CandidateItem) => number> = {
    popular: (a, b) => b.uses - a.uses || a.price - b.price,
    near: (a, b) => Math.abs(a.price - near) - Math.abs(b.price - near) || a.price - b.price,
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    newest: (a, b) => byYear(b) - byYear(a) || b.id - a.id,
  };
  // ชิ้นที่เข้ากันได้ขึ้นก่อนเสมอ แล้วค่อยเรียงตามที่ผู้ใช้เลือก
  const sorted = [...visible].sort(
    (a, b) => Number(b.compatible) - Number(a.compatible) || sorters[query.sort](a, b),
  );

  const start = (query.page - 1) * PARTS_PAGE_SIZE;
  return {
    items: sorted.slice(start, start + PARTS_PAGE_SIZE),
    total: visible.length,
    hidden: evaluated.length - visible.length,
    page: query.page,
    pageSize: PARTS_PAGE_SIZE,
  };
}
