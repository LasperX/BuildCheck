'use client';

import { Boxes, Cpu, House, type LucideIcon, Search, User, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { MAIN_NAV } from '@/components/site/nav-items';

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูหลัก" className="hidden gap-1 lg:flex">
      {MAIN_NAV.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? 'page' : undefined}
          className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-surface-2 hover:text-foreground aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-soft-fg"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'หน้าแรก', icon: House },
  { href: '/builder', label: 'จัดสเปก', icon: Cpu },
  { href: '/parts', label: 'อะไหล่', icon: Boxes },
  { href: '/builds', label: 'ชุมชน', icon: Users },
  { href: '/me/settings', label: 'บัญชี', icon: User },
];

/** แถบเมนูล่างบนมือถือ (หัวข้อ 5.3) */
export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="เมนูล่าง"
      className="fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-5 border-t border-border bg-surface lg:hidden"
    >
      {TABS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? 'page' : undefined}
          className="flex flex-col items-center justify-center gap-px text-[11px] leading-4 font-medium text-subtle aria-[current=page]:text-link [&>svg]:size-5"
        >
          <Icon aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** ช่องค้นหาอะไหล่บนแถบเมนู ส่งไปหน้าคลังอะไหล่ ใช้ได้แม้ JavaScript ยังโหลดไม่เสร็จ */
export function HeaderSearch() {
  return (
    <form action="/parts" role="search" className="relative hidden w-full max-w-72 xl:block">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
      />
      <input
        name="q"
        type="search"
        placeholder="ค้นหาชื่อรุ่นหรือยี่ห้อ"
        aria-label="ค้นหาอะไหล่"
        className="h-10 w-full rounded-md border border-input bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-subtle focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
      />
    </form>
  );
}
