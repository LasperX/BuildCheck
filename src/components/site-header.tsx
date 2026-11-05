import Link from 'next/link';
import { Suspense } from 'react';

import { AccountMenu } from '@/components/account/account-menu';

/**
 * แถบเมนูบนแบบย่อของเฟส 3: มีเฉพาะโลโก้และส่วนบัญชี
 * เมนูหลัก ช่องค้นหา แจ้งเตือน และสวิตช์โหมดมืด เพิ่มในเฟสของฟีเจอร์นั้น (หัวข้อ 5.3)
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-[1328px] items-center justify-between gap-6 px-4 md:px-6 lg:h-16">
        <Link href="/" className="text-lg font-bold">
          BuildCheck
        </Link>
        <Suspense fallback={<div className="h-8 w-8 rounded-full bg-surface-2" />}>
          <AccountMenu />
        </Suspense>
      </div>
    </header>
  );
}
