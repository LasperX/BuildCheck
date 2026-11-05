import {
  CircuitBoard,
  Cpu,
  Fan,
  Gpu,
  HardDrive,
  type LucideIcon,
  MemoryStick,
  PcCase,
  PlugZap,
} from 'lucide-react';
import Image from 'next/image';

import type { CategorySlug } from '@/lib/parts/spec-fields';

export const CATEGORY_ICONS: Record<CategorySlug, LucideIcon> = {
  cpu: Cpu,
  motherboard: CircuitBoard,
  ram: MemoryStick,
  gpu: Gpu,
  storage: HardDrive,
  psu: PlugZap,
  case: PcCase,
  cooler: Fan,
};

/** รูปอะไหล่ ถ้าแอดมินยังไม่ใส่รูปจะแสดงไอคอนของหมวดแทน */
export function PartImage({
  src,
  alt,
  category,
  size,
  className = '',
}: {
  src: string | null;
  alt: string;
  category: CategorySlug;
  size: number;
  className?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        unoptimized
        className={`rounded-md bg-surface-2 object-contain ${className}`}
      />
    );
  }
  const Icon = CATEGORY_ICONS[category];
  return (
    <span className={`grid place-items-center rounded-md bg-surface-2 text-subtle ${className}`}>
      <Icon aria-hidden style={{ width: size * 0.4, height: size * 0.4 }} />
    </span>
  );
}
