import type { Metadata } from 'next';
import { Suspense } from 'react';

import { BrandForm } from '@/components/admin/brand-form';
import { CsvImport } from '@/components/admin/csv-import';
import { requireAdmin } from '@/lib/session';

export const metadata: Metadata = { title: 'นำเข้า CSV · BuildCheck' };

async function Guard() {
  await requireAdmin();
  return (
    <>
      <CsvImport />
      <section
        aria-labelledby="brand-title"
        className="mt-6 max-w-3xl rounded-xl border border-border bg-card p-4"
      >
        <h2 id="brand-title" className="mb-1 text-lg font-semibold">
          เพิ่มยี่ห้อใหม่
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          ถ้าไฟล์มียี่ห้อที่ยังไม่มีในระบบ เพิ่มที่นี่ก่อนแล้วค่อยตรวจไฟล์อีกครั้ง
          สะกดให้ตรงกับในไฟล์
        </p>
        <BrandForm />
      </section>
    </>
  );
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
