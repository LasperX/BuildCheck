import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

import { AccountMenu } from '@/components/account/account-menu';
import { BuildFab } from '@/components/site/build-fab';
import { BottomTabBar, DesktopNav, HeaderSearch } from '@/components/site/main-nav';
import { ThemeToggle } from '@/components/site/theme';

/** แถบเมนูบนตามหัวข้อ 5.3: โลโก้ เมนูหลัก ช่องค้นหา สวิตช์โหมดมืด แจ้งเตือน และเมนูบัญชี */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-[1328px] items-center gap-6 px-4 md:px-6 lg:h-16">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold">
          {/* โลโก้ตัว B กับเครื่องหมายถูก ชื่อเว็บอยู่ข้างๆ จึงใส่ alt ว่าง
              มือถือจอแคบเหลือแค่โลโก้ ชื่อยังอยู่ให้โปรแกรมอ่านหน้าจออ่านได้ */}
          <Image src="/brand-mark.png" alt="" width={28} height={28} priority className="rounded-md" />
          <span className="max-sm:sr-only">BuildCheck</span>
        </Link>
        <Suspense>
          <DesktopNav />
        </Suspense>
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3">
          <HeaderSearch />
          <ThemeToggle />
          <Suspense fallback={<div className="size-8 rounded-full bg-surface-2" />}>
            <AccountMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

/** Footer ตามหัวข้อ 5.3 พร้อมลิงก์นโยบายความเป็นส่วนตัวตามหัวข้อ 9.1 */
export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border bg-surface pb-14 lg:pb-0">
      <div className="mx-auto flex w-full max-w-[1328px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted-foreground md:px-6">
        <span>BuildCheck · เครื่องมือจัดสเปกคอมภาษาไทย ไม่ขายสินค้า</span>
        <nav aria-label="ลิงก์ท้ายหน้า" className="flex flex-wrap gap-4 md:ml-auto">
          <Link href="/guide" className="hover:text-foreground hover:underline">
            คู่มือ
          </Link>
          <Link href="/about" className="hover:text-foreground hover:underline">
            เกี่ยวกับ
          </Link>
          <Link href="/about#contact" className="hover:text-foreground hover:underline">
            ติดต่อ
          </Link>
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            นโยบายความเป็นส่วนตัว
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/** ส่วนที่ลอยอยู่ด้านล่าง: แถบเมนูมือถือและปุ่มสเปกของฉัน */
export function SiteFloating() {
  return (
    <Suspense>
      <BottomTabBar />
      <BuildFab />
    </Suspense>
  );
}
