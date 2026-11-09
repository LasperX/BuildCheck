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

/**
 * รูปอะไหล่ ถ้าแอดมินยังไม่ใส่รูปจะแสดงไอคอนของหมวดแทน
 * พื้นขาวเสมอ (ทั้งโหมดสว่างและมืด) เพราะรูปสินค้าส่วนใหญ่พื้นขาว รูปจะกลืนกับช่อง ไม่เห็นเป็นกล่องซ้อน
 * รูปพื้นโปร่งใสก็แสดงบนพื้นขาวได้สวยเหมือนกัน และใช้ object-contain ไม่ครอปส่วนของสินค้าทิ้ง
 */
export function PartImage({
  src,
  alt,
  category,
  size,
  className = '',
  zoom = false,
}: {
  src: string | null;
  alt: string;
  category: CategorySlug;
  size: number;
  className?: string;
  /** เอาเมาส์ชี้แล้วเห็นรูปใหญ่ ใช้กับรูปเล็กในหน้าจัดสเปก (เฉพาะอุปกรณ์ที่มีเมาส์) */
  zoom?: boolean;
}) {
  if (src) {
    const image = (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        unoptimized
        className={`rounded-md bg-white object-contain p-0.5 ring-1 ring-black/5 ${className}`}
      />
    );
    if (!zoom) return image;
    return (
      <span className="group/zoom relative flex shrink-0">
        {image}
        <span
          aria-hidden
          className="pointer-events-none invisible absolute top-0 left-full z-40 ml-3 size-60 scale-95 rounded-xl bg-white p-2 opacity-0 shadow-lg ring-1 ring-black/10 transition-[opacity,scale,visibility] duration-150 pointer-fine:group-hover/zoom:visible pointer-fine:group-hover/zoom:scale-100 pointer-fine:group-hover/zoom:opacity-100"
        >
          <Image
            src={src}
            alt=""
            width={240}
            height={240}
            unoptimized
            className="size-full object-contain"
          />
        </span>
      </span>
    );
  }
  const Icon = CATEGORY_ICONS[category];
  return (
    <span className={`grid place-items-center rounded-md bg-surface-2 text-subtle ${className}`}>
      <Icon aria-hidden style={{ width: size * 0.4, height: size * 0.4 }} />
    </span>
  );
}
