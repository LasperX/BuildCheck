import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CsvImport } from '@/components/admin/csv-import';
import { requireAdmin } from '@/lib/session';

export const metadata: Metadata = { title: 'นำเข้า CSV · BuildCheck' };

async function Guard() {
  await requireAdmin();
  return <CsvImport />;
}

export default function ImportPage() {
  return (
    <>
      <h1 className="t-h1">นำเข้าอะไหล่จาก CSV</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        ระบบตรวจทุกแถวและแสดงพรีวิวก่อน ถ้ามีแถวที่ผิดจะยังนำเข้าไม่ได้
        เพื่อไม่ให้ข้อมูลเข้าไปครึ่งไฟล์
      </p>
      <Suspense>
        <Guard />
      </Suspense>
    </>
  );
}
