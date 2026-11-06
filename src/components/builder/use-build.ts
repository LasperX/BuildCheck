'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { type BuilderPart, encodeBuildParam } from '@/lib/builder/types';
import { checkBuild, type CheckResult, type EngineItem, type EngineSettings } from '@/lib/compat';
import { saveBuild } from '@/server/actions/builds';
import { type BuildItem, useBuilderHydrated, useBuilderStore } from '@/stores/builder-store';

// ลำดับการทำงานตามหัวข้อ 8.1
//   1. ผู้ใช้เลือกอะไหล่ → Zustand อัปเดตสเปก
//   2. useBuilderParts ดึงสเปกเต็มของอะไหล่ที่เลือก (แคชไว้ เลือกซ้ำไม่โหลดใหม่)
//   3. useBuildCheck ส่งเข้า Engine ในเบราว์เซอร์ ผลขึ้นทันทีไม่ต้องรอเซิร์ฟเวอร์
//   4. useAutosave บันทึกหลังหยุดแก้ 2 วินาที เซิร์ฟเวอร์ตรวจซ้ำอีกรอบ

async function fetchBuilderParts(param: string): Promise<BuilderPart[]> {
  const response = await fetch(`/api/builder/parts?build=${encodeURIComponent(param)}`);
  if (!response.ok) throw new Error('โหลดข้อมูลอะไหล่ไม่สำเร็จ');
  return response.json() as Promise<BuilderPart[]>;
}

export function useBuilderParts(items: BuildItem[]) {
  // ใช้แค่รหัสที่เรียงแล้วเป็นคีย์ เปลี่ยนจำนวนไม่ต้องโหลดใหม่
  const ids = [...new Set(items.map((item) => item.partId))].sort((a, b) => a - b);
  const param = encodeBuildParam(ids.map((partId) => ({ partId, quantity: 1 })));
  const query = useQuery({
    queryKey: ['builder-parts', param],
    queryFn: () => fetchBuilderParts(param),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const parts = useMemo(
    () => new Map((ids.length ? (query.data ?? []) : []).map((part) => [part.id, part])),
    [query.data, ids.length],
  );
  return { parts, isLoading: query.isLoading && ids.length > 0, isError: query.isError };
}

export function toEngineItems(items: BuildItem[], parts: Map<number, BuilderPart>): EngineItem[] {
  return items.flatMap((item) => {
    const part = parts.get(item.partId);
    return part ? [{ ...item, part }] : [];
  });
}

export function useBuildCheck(settings?: EngineSettings): {
  result: CheckResult;
  parts: Map<number, BuilderPart>;
  loading: boolean;
  error: boolean;
} {
  const items = useBuilderStore((state) => state.items);
  const meta = useBuilderStore((state) => state.meta);
  const { parts, isLoading, isError } = useBuilderParts(items);
  const result = useMemo(
    () =>
      checkBuild({
        items: toEngineItems(items, parts),
        budget: meta.budget,
        usage: meta.usageType,
        settings,
      }),
    [items, parts, meta.budget, meta.usageType, settings],
  );
  return { result, parts, loading: isLoading, error: isError };
}

export type SaveState =
  | { kind: 'guest' }
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date }
  | { kind: 'error'; message: string };

const AUTOSAVE_DELAY = 2000;

/** บันทึกอัตโนมัติเมื่อล็อกอินอยู่ ผู้เยี่ยมชมเก็บไว้ในเครื่องอย่างเดียว */
export function useAutosave(loggedIn: boolean) {
  const hydrated = useBuilderHydrated();
  const buildId = useBuilderStore((state) => state.buildId);
  const items = useBuilderStore((state) => state.items);
  const meta = useBuilderStore((state) => state.meta);
  const setBuildId = useBuilderStore((state) => state.setBuildId);
  const [state, setState] = useState<SaveState>(loggedIn ? { kind: 'idle' } : { kind: 'guest' });
  const lastSaved = useRef<string | null>(null);
  const inFlight = useRef<Promise<string | null> | null>(null);

  const payload = JSON.stringify({ buildId, items, meta });

  /** บันทึกทันที คืนรหัสสเปก ถ้ากำลังบันทึกอยู่จะรอรอบนั้นแทนการยิงซ้ำ */
  const save = (): Promise<string | null> => {
    if (inFlight.current) return inFlight.current;
    inFlight.current = run().finally(() => {
      inFlight.current = null;
    });
    return inFlight.current;
  };

  const run = async (): Promise<string | null> => {
    const snapshot = useBuilderStore.getState();
    const body = JSON.stringify({
      buildId: snapshot.buildId,
      items: snapshot.items,
      meta: snapshot.meta,
    });
    setState({ kind: 'saving' });
    const result = await saveBuild({
      id: snapshot.buildId ?? undefined,
      ...snapshot.meta,
      items: snapshot.items.map(
        ({ partId, quantity, condition, offeredPrice, warrantyMonthsLeft }) => ({
          partId,
          quantity,
          condition,
          offeredPrice,
          warrantyMonthsLeft,
        }),
      ),
    }).catch(() => ({ ok: false as const, error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' }));
    if (!result.ok) {
      setState({ kind: 'error', message: result.error });
      return null;
    }
    if (result.id !== snapshot.buildId) setBuildId(result.id);
    // รหัสสเปกเปลี่ยนก็นับว่าบันทึกแล้ว จะได้ไม่บันทึกซ้ำทันที
    lastSaved.current = JSON.stringify({ ...JSON.parse(body), buildId: result.id });
    setState({ kind: 'saved', at: new Date(result.savedAt) });
    return result.id;
  };

  useEffect(() => {
    if (!loggedIn || !hydrated) return;
    if (lastSaved.current === null) {
      // ครั้งแรกหลังโหลด: สเปกที่บันทึกแล้วถือว่าตรงกับเซิร์ฟเวอร์ ส่วนสเปกว่างที่ยังไม่บันทึกไม่ต้องสร้าง
      if (buildId || items.length === 0) {
        lastSaved.current = payload;
        return;
      }
    }
    if (payload === lastSaved.current) return;
    setState({ kind: 'pending' });
    const timer = setTimeout(() => void save(), AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
    // save อ่านค่าล่าสุดจาก store เอง จึงไม่ต้องอยู่ใน dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, loggedIn, hydrated]);

  return { state, saveNow: save };
}
