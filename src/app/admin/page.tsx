import type { Metadata } from 'next';
import { Suspense } from 'react';

import { requireAdmin } from '@/lib/session';

export const metadata: Metadata = { title: 'หลังบ้าน · BuildCheck' };

// หน้าชั่วคราวของเฟส 3 ใช้ทดสอบสิทธิ์แอดมิน Dashboard จริงทำในเฟส 12
async function AdminPlaceholder() {
  const admin = await requireAdmin();
  return <p className="mt-2 text-muted-foreground">เข้าสู่หลังบ้านในชื่อ {admin.name}</p>;
}

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-[1328px] flex-1 px-4 py-8 md:px-6">
      <h1 className="t-h1">หลังบ้าน</h1>
      <Suspense>
        <AdminPlaceholder />
      </Suspense>
    </main>
  );
}
