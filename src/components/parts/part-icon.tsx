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
 * ย่อรูปผ่าน Next.js ได้เฉพาะไฟล์ในเว็บเอง (/uploads ตอนพัฒนา) และที่เก็บรูปของเรา (ตั้งใน next.config.ts)
 * ลิงก์รูปจากเว็บอื่นที่นำเข้าผ่าน CSV แสดงตรงตามเดิม เพราะไม่ได้อนุญาตให้ Next.js ไปดึงมาย่อ
 */
function canOptimize(src: string): boolean {
  if (src.startsWith('/') && !src.startsWith('//')) return true;
  const origin = process.env.NEXT_PUBLIC_STORAGE_ORIGIN;
  return Boolean(origin) && src.startsWith(`${origin}/`);
}

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
  eager = false,
}: {
  src: string | null;
  alt: string;
  category: CategorySlug;
  /** ขนาดที่แสดง (px) ใช้เลือกขนาดรูปที่ย่อให้ ไม่ใช่ขนาดไฟล์ต้นฉบับ */
  size: number;
  className?: string;
  /** เอาเมาส์ชี้แล้วเห็นรูปใหญ่ ใช้กับรูปเล็กในหน้าจัดสเปก (เฉพาะอุปกรณ์ที่มีเมาส์) */
  zoom?: boolean;
  /** รูปที่เห็นทันทีตอนเปิดหน้า (แถวแรก) โหลดก่อน ไม่รอเลื่อนถึง */
  eager?: boolean;
}) {
  if (src) {
    const unoptimized = !canOptimize(src);
    const image = (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        unoptimized={unoptimized}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : undefined}
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
            unoptimized={unoptimized}
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
