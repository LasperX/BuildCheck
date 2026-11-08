'use client';

import { Check, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { CategorySlug } from '@/lib/parts/spec-fields';
import { conditionForNewPart } from '@/lib/builder/conditions';
import type { PartAvailability } from '@/lib/compat';
import { useBuilderStore } from '@/stores/builder-store';

/** ปุ่มเพิ่มลงสเปกที่กำลังจัด ใช้ได้จากทุกหน้าที่แสดงอะไหล่ (หัวข้อ 3.2) */
export function AddToBuildButton({
  partId,
  categorySlug,
  availability,
  size = 'sm',
  className,
}: {
  partId: number;
  categorySlug: CategorySlug;
  /** รุ่นที่มีแต่มือสองจะถูกเพิ่มเป็นมือสองเสมอ */
  availability?: PartAvailability;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}) {
  const addPart = useBuilderStore((state) => state.addPart);
  const [added, setAdded] = useState(false);

  return (
    <Button
      type="button"
      size={size}
      variant={added ? 'secondary' : 'default'}
      className={className}
      aria-live="polite"
      onClick={() => {
        // ใช้ค่าตั้งต้น "ชิ้นที่เพิ่มต่อจากนี้" เดียวกับหน้าจัดสเปก
        const condition = conditionForNewPart(
          { availability, categorySlug },
          useBuilderStore.getState().defaultCondition,
        );
        addPart(partId, categorySlug, condition);
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
    >
      {added ? <Check aria-hidden /> : <Plus aria-hidden />}
      {added ? 'เพิ่มแล้ว' : 'เพิ่มลงสเปก'}
    </Button>
  );
}
