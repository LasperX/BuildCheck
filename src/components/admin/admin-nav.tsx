'use client';

import {
  ArrowLeft,
  FileUp,
  Flag,
  History,
  LayoutDashboard,
  Package,
  Recycle,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// เมนูหลังบ้านครบ 9 หน้าตามหัวข้อ 5.2 และ 5.4
const ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/parts', label: 'จัดการอะไหล่', icon: Package, exact: true },
  { href: '/admin/parts/import', label: 'นำเข้า CSV', icon: FileUp, exact: true },
  { href: '/admin/used-prices', label: 'ราคามือสอง', icon: Recycle, exact: true },
  { href: '/admin/users', label: 'จัดการผู้ใช้', icon: Users, exact: true },
  { href: '/admin/reports', label: 'จัดการรายงาน', icon: Flag, exact: true },
  { href: '/admin/settings', label: 'ตั้งค่าระบบ', icon: Settings, exact: true },
  { href: '/admin/logs', label: 'บันทึกการทำงาน', icon: History, exact: true },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูแอดมิน" className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact
          ? pathname === href ||
            (href === '/admin/parts' && /^\/admin\/parts\/(new|\d+)/.test(pathname))
          : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className="flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-surface-2 hover:text-foreground aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-soft-fg [&>svg]:size-4.5"
          >
            <Icon aria-hidden />
            {label}
          </Link>
        );
      })}
      <Link
        href="/"
        className="flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-surface-2 hover:text-foreground lg:mt-4 [&>svg]:size-4.5"
      >
        <ArrowLeft aria-hidden />
        กลับหน้าเว็บ
      </Link>
    </nav>
  );
}
