'use client';

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CategorySlug } from '@/lib/parts/spec-fields';

// สเปกที่กำลังจัด เก็บในเบราว์เซอร์ ผู้เยี่ยมชมจึงจัดได้เต็มที่โดยไม่ต้องล็อกอิน (หัวข้อ 2.1)
// เก็บเฉพาะรหัสอะไหล่และตัวเลือก ส่วนสเปกจริงอ่านจากเซิร์ฟเวอร์ทุกครั้ง เพื่อไม่ให้ข้อมูลเก่าค้าง

export type ItemCondition = 'new' | 'A' | 'B' | 'C';

export type BuildItem = {
  partId: number;
  categorySlug: CategorySlug;
  quantity: number;
  condition: ItemCondition;
  offeredPrice: number | null;
  warrantyMonthsLeft: number | null;
};

// หมวดที่เลือกได้หลายชิ้น ตรงกับ categories.allow_multiple
export const MULTI_CATEGORIES: readonly CategorySlug[] = ['ram', 'storage'];

const HISTORY_LIMIT = 50;

export type UsageType = 'gaming' | 'office' | 'creator' | 'streaming';

/** ชื่อ คำอธิบาย งบ และประเภทการใช้งาน (หัวข้อ 3.3) */
export type BuildMeta = {
  title: string;
  description: string;
  usageType: UsageType;
  budget: number | null;
};

export const DEFAULT_META: BuildMeta = {
  title: 'สเปกของฉัน',
  description: '',
  usageType: 'gaming',
  budget: null,
};

type BuilderState = {
  /** รหัสสเปกที่บันทึกแล้วในบัญชี ยังไม่บันทึก = null */
  buildId: string | null;
  meta: BuildMeta;
  items: BuildItem[];
  past: BuildItem[][];
  future: BuildItem[][];
  setMeta: (patch: Partial<BuildMeta>) => void;
  setBuildId: (id: string | null) => void;
  /** โหลดสเปกที่บันทึกไว้มาแก้ ล้างประวัติย้อนกลับ */
  loadBuild: (build: { id: string; meta: BuildMeta; items: BuildItem[] }) => void;
  /** เริ่มสเปกใหม่ทั้งหมด */
  reset: () => void;
  addPart: (partId: number, categorySlug: CategorySlug) => void;
  replacePart: (partId: number, categorySlug: CategorySlug, oldPartId?: number) => void;
  removePart: (partId: number) => void;
  setQuantity: (partId: number, quantity: number) => void;
  updateItem: (partId: number, patch: Partial<Omit<BuildItem, 'partId' | 'categorySlug'>>) => void;
  setItems: (items: BuildItem[]) => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
};

const newItem = (partId: number, categorySlug: CategorySlug): BuildItem => ({
  partId,
  categorySlug,
  quantity: 1,
  condition: 'new',
  offeredPrice: null,
  warrantyMonthsLeft: null,
});

export const useBuilderStore = create<BuilderState>()(
  persist(
    (set) => {
      // ทุกการเปลี่ยนแปลงเก็บสถานะก่อนหน้าไว้ เพื่อให้ย้อนกลับได้ และล้างรายการ "ทำซ้ำ"
      const commit = (next: (items: BuildItem[]) => BuildItem[]) =>
        set((state) => ({
          items: next(state.items),
          past: [...state.past, state.items].slice(-HISTORY_LIMIT),
          future: [],
        }));

      return {
        buildId: null,
        meta: DEFAULT_META,
        items: [],
        past: [],
        future: [],
        setMeta: (patch) => set((state) => ({ meta: { ...state.meta, ...patch } })),
        setBuildId: (buildId) => set({ buildId }),
        loadBuild: ({ id, meta, items }) => set({ buildId: id, meta, items, past: [], future: [] }),
        reset: () => set({ buildId: null, meta: DEFAULT_META, items: [], past: [], future: [] }),
        addPart: (partId, categorySlug) =>
          commit((items) => {
            if (!MULTI_CATEGORIES.includes(categorySlug)) {
              // หมวดที่มีได้ชิ้นเดียว เลือกใหม่จะแทนของเดิม
              return [
                ...items.filter((item) => item.categorySlug !== categorySlug),
                newItem(partId, categorySlug),
              ];
            }
            const found = items.find((item) => item.partId === partId);
            if (found) {
              return items.map((item) =>
                item.partId === partId ? { ...item, quantity: item.quantity + 1 } : item,
              );
            }
            return [...items, newItem(partId, categorySlug)];
          }),
        replacePart: (partId, categorySlug, oldPartId) =>
          commit((items) => {
            const old = items.find((item) => item.partId === oldPartId);
            const kept = items.filter((item) => item.partId !== oldPartId);
            return [
              ...kept,
              { ...newItem(partId, categorySlug), condition: old?.condition ?? 'new' },
            ];
          }),
        removePart: (partId) => commit((items) => items.filter((item) => item.partId !== partId)),
        setQuantity: (partId, quantity) =>
          commit((items) =>
            quantity < 1
              ? items.filter((item) => item.partId !== partId)
              : items.map((item) => (item.partId === partId ? { ...item, quantity } : item)),
          ),
        updateItem: (partId, patch) =>
          commit((items) =>
            items.map((item) => (item.partId === partId ? { ...item, ...patch } : item)),
          ),
        setItems: (items) => commit(() => items),
        clear: () => commit(() => []),
        undo: () =>
          set((state) => {
            const previous = state.past.at(-1);
            if (!previous) return state;
            return {
              items: previous,
              past: state.past.slice(0, -1),
              future: [state.items, ...state.future],
            };
          }),
        redo: () =>
          set((state) => {
            const next = state.future[0];
            if (!next) return state;
            return {
              items: next,
              past: [...state.past, state.items],
              future: state.future.slice(1),
            };
          }),
      };
    },
    {
      name: 'buildcheck-builder',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // เวอร์ชัน 1 เก็บแค่ items ค่าที่เพิ่มมาใช้ค่าตั้งต้น
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<BuilderState>;
        if (version < 2) return { items: state.items ?? [], buildId: null, meta: DEFAULT_META };
        return state;
      },
      // ไม่เก็บประวัติย้อนกลับลงเครื่อง
      partialize: (state) => ({ items: state.items, buildId: state.buildId, meta: state.meta }),
      skipHydration: true, // โหลดหลัง Hydrate เพื่อไม่ให้หน้าเว็บจากเซิร์ฟเวอร์กับเบราว์เซอร์ไม่ตรงกัน
    },
  ),
);

const subscribeHydration = (notify: () => void) =>
  useBuilderStore.persist.onFinishHydration(notify);

/** true เมื่ออ่านสเปกจาก localStorage เสร็จแล้ว ใช้ซ่อนตัวเลขก่อนโหลด */
export function useBuilderHydrated(): boolean {
  return useSyncExternalStore(
    subscribeHydration,
    () => useBuilderStore.persist.hasHydrated(),
    () => false,
  );
}
