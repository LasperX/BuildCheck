import Link from 'next/link';
import { Suspense } from 'react';

import { AdminNav } from '@/components/admin/admin-nav';

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-border bg-surface p-3 lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
        <Link href="/admin" className="mb-2 block px-3 py-1 text-lg font-bold lg:mb-4">
          BuildCheck
        </Link>
        {/* เมนูอ่าน URL ปัจจุบัน จึงต้องอยู่ใน Suspense ส่วนโครงหน้าจะได้โหลดทันที */}
        <Suspense>
          <AdminNav />
        </Suspense>
      </aside>
      <main className="min-w-0 p-4 lg:p-6">{children}</main>
    </div>
  );
}
