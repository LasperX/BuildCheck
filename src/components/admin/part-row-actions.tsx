'use client';

import { Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell } from '@/components/ui/table';
import { deletePart, setPartActive, updatePartPrice } from '@/server/actions/admin-parts';

/** ช่องราคาแก้ไขด่วน และปุ่มจัดการในแถวของตารางอะไหล่ */
export function PartRowActions({
  id,
  price,
  isActive,
}: {
  id: number;
  price: number;
  isActive: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(price));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(result.error);
      router.refresh();
    });

  function savePrice() {
    if (Number(value) === price) return;
    run(() => updatePartPrice({ id, price: value }));
  }

  return (
    <>
      <TableCell className="min-w-32">
        <Input
          aria-label="ราคาอ้างอิง"
          inputMode="decimal"
          value={value}
          disabled={pending}
          aria-invalid={Boolean(error)}
          onChange={(event) => setValue(event.target.value)}
          onBlur={savePrice}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          className="h-8 w-28 font-mono text-xs md:text-xs"
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="icon-sm" title="แก้ไข">
            <Link href={`/admin/parts/${id}`} aria-label="แก้ไข">
              <Pencil />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            title={isActive ? 'ซ่อนจากหน้าเว็บ' : 'แสดงบนหน้าเว็บ'}
            aria-label={isActive ? 'ซ่อนจากหน้าเว็บ' : 'แสดงบนหน้าเว็บ'}
            onClick={() => run(() => setPartActive({ id, isActive: !isActive }))}
          >
            {isActive ? <EyeOff /> : <Eye />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            title="ลบ"
            aria-label="ลบ"
            onClick={() => {
              if (window.confirm('ลบอะไหล่นี้ถาวร?')) run(() => deletePart(id));
            }}
          >
            <Trash2 />
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-1 max-w-56 text-left text-xs whitespace-normal text-err-fg">
            {error}
          </p>
        ) : null}
      </TableCell>
    </>
  );
}
