'use client';

import { CircleCheck, Pencil, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { setPartVerified } from '@/server/actions/admin-parts';

/** ปุ่มในการ์ดหน้าตรวจสเปก: กดตรวจแล้วได้ทันที หรือเปิดฟอร์มแก้ไขเมื่อเจอค่าผิด */
export function ReviewActions({
  id,
  model,
  verified,
}: {
  id: number;
  model: string;
  verified: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      setError(null);
      const result = await setPartVerified({ ids: [id], verified: !verified });
      if (!result.ok) setError(result.error);
      // โหลดรายการใหม่ ชิ้นที่ตรวจแล้วจะหายจากคิว ชิ้นถัดไปเลื่อนขึ้นมา
      router.refresh();
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link href={`/admin/parts/${id}`} aria-label={`แก้ไข ${model}`}>
            <Pencil />
            แก้ไข
          </Link>
        </Button>
        {verified ? (
          <Button variant="secondary" size="sm" onClick={toggle} disabled={pending}>
            <Undo2 />
            {pending ? 'กำลังบันทึก…' : 'ยกเลิกตรวจแล้ว'}
          </Button>
        ) : (
          <Button size="sm" onClick={toggle} disabled={pending} aria-label={`ตรวจแล้ว ${model}`}>
            <CircleCheck />
            {pending ? 'กำลังบันทึก…' : 'ตรวจแล้ว'}
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-err-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
