'use client';

import { RotateCw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

// หน้าแสดงเมื่อเกิดข้อผิดพลาดที่ไม่คาดคิด ภาษาไทย ไม่แสดงรายละเอียดทางเทคนิคให้ผู้ใช้ (รหัสอ้างอิงช่วยแอดมินค้น Log)
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <TriangleAlert aria-hidden className="size-12 text-warn-fg" />
      <h1 className="t-h1">เกิดข้อผิดพลาด</h1>
      <p className="text-muted-foreground">
        ระบบทำงานไม่สำเร็จชั่วคราว ลองใหม่อีกครั้ง หรือกลับหน้าแรก
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">รหัสอ้างอิง {error.digest}</p>
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={reset}>
          <RotateCw aria-hidden />
          ลองใหม่
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">กลับหน้าแรก</Link>
        </Button>
      </div>
    </main>
  );
}
