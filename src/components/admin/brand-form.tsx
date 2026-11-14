'use client';

import { Check, Plus, TriangleAlert } from 'lucide-react';
import { useState, useTransition } from 'react';

import { FormAlert } from '@/components/auth/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrand } from '@/server/actions/admin-parts';

/** เพิ่มยี่ห้อใหม่ก่อนนำเข้า CSV ที่มียี่ห้อซึ่งยังไม่มีในระบบ (Server Action ตรวจสิทธิ์แอดมินซ้ำเอง) */
export function BrandForm() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formElement = event.currentTarget;
        const name = new FormData(formElement).get('name');
        startTransition(async () => {
          const result = await createBrand({ name });
          setMessage(
            result.ok
              ? { ok: true, text: `เพิ่มยี่ห้อ ${result.name ?? ''} แล้ว นำเข้าไฟล์ได้เลย` }
              : { ok: false, text: result.error },
          );
          if (result.ok) formElement.reset();
        });
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-52 flex-1 flex-col gap-1.5">
          <Label htmlFor="brand-name">ชื่อยี่ห้อ</Label>
          <Input id="brand-name" name="name" maxLength={60} placeholder="เช่น Apacer" />
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          <Plus aria-hidden />
          {pending ? 'กำลังเพิ่ม...' : 'เพิ่มยี่ห้อ'}
        </Button>
      </div>
      {message ? (
        <FormAlert
          variant={message.ok ? 'ok' : 'err'}
          icon={message.ok ? <Check aria-hidden /> : <TriangleAlert aria-hidden />}
        >
          {message.text}
        </FormAlert>
      ) : null}
    </form>
  );
}
