'use client';

import { Check, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { CategorySlug } from '@/lib/parts/spec-fields';
import { useBuilderStore } from '@/stores/builder-store';

/** ปุ่มเพิ่มลงสเปกที่กำลังจัด ใช้ได้จากทุกหน้าที่แสดงอะไหล่ (หัวข้อ 3.2) */
export function AddToBuildButton({
  partId,
  categorySlug,
  size = 'sm',
  className,
}: {
  partId: number;
  categorySlug: CategorySlug;
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
        addPart(partId, categorySlug);
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
    >
      {added ? <Check aria-hidden /> : <Plus aria-hidden />}
      {added ? 'เพิ่มแล้ว' : 'เพิ่มลงสเปก'}
    </Button>
  );
}
