'use client';

import { Cpu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useChangeKey } from '@/lib/use-motion';
import { useBuilderHydrated, useBuilderStore } from '@/stores/builder-store';

/** ปุ่มลอย "สเปกของฉัน (x ชิ้น)" กดแล้วกลับไปหน้าจัดสเปก (หัวข้อ 5.3) */
export function BuildFab() {
  const pathname = usePathname();
  const hydrated = useBuilderHydrated();
  const count = useBuilderStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0),
  );

  // ตัวเลขเด้งทุกครั้งที่เพิ่มหรือเอาอะไหล่ออก (ไม่เด้งตอนเปิดหน้า)
  const countKey = useChangeKey(count);

  if (pathname.startsWith('/builder') || !hydrated || count === 0) return null;
  return (
    <Link
      href="/builder"
      className="fixed right-4 bottom-[68px] z-30 inline-flex h-11 anim-slot-in items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg hover:bg-brand-hover lg:right-6 lg:bottom-6 lg:h-12 lg:px-5"
    >
      <Cpu aria-hidden className="size-4.5" />
      {/* รวมข้อความไว้ก้อนเดียว ไม่งั้น gap ของปุ่มจะแทรกช่องว่างใน "( 7 ชิ้น)" */}
      <span>
        สเปกของฉัน (
        <span key={countKey} className={countKey > 0 ? 'inline-block anim-pop' : 'inline-block'}>
          {count}
        </span>{' '}
        ชิ้น)
      </span>
    </Link>
  );
}
