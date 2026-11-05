'use client';

import { useEffect } from 'react';

import { useBuilderStore } from '@/stores/builder-store';

/** โหลดสเปกที่จัดค้างไว้จาก localStorage หลังหน้าเว็บ Hydrate เสร็จ */
export function StoreHydrator() {
  useEffect(() => {
    void useBuilderStore.persist.rehydrate();
  }, []);
  return null;
}
