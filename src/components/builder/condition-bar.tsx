'use client';

import { Recycle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { bulkConditionUpdates } from '@/lib/builder/conditions';
import type { BuilderPart } from '@/lib/builder/types';
import type { ItemCondition } from '@/lib/compat';
import { type BuildItem, useBuilderStore } from '@/stores/builder-store';

// แถบ "สภาพอะไหล่" ในหน้าจัดสเปก: จัดสเปกมือสองทั้งชุดได้โดยไม่ต้องกดทีละชิ้น
// 1. ค่าตั้งต้นของชิ้นที่เพิ่มต่อจากนี้ (เบราว์เซอร์จำไว้)
// 2. ปุ่มเปลี่ยนทั้งชุดในครั้งเดียว ย้อนกลับได้ด้วย Ctrl+Z

const OPTIONS: { value: ItemCondition; label: string }[] = [
  { value: 'new', label: 'มือหนึ่ง' },
  { value: 'A', label: 'มือสอง เกรด A' },
  { value: 'B', label: 'มือสอง เกรด B' },
  { value: 'C', label: 'มือสอง เกรด C' },
];

const labelOf = (value: ItemCondition) =>
  OPTIONS.find((option) => option.value === value)?.label ?? value;

export function ConditionBar({
  items,
  parts,
}: {
  items: BuildItem[];
  parts: Map<number, BuilderPart>;
}) {
  const defaultCondition = useBuilderStore((s) => s.defaultCondition);
  const [target, setTarget] = useState<ItemCondition>('B');
  const [message, setMessage] = useState('');
  const updates = bulkConditionUpdates(items, parts, target);
  const changeCount = Object.keys(updates).length;

  function applyAll() {
    useBuilderStore.getState().setConditions(updates);
    setMessage(`เปลี่ยน ${changeCount} ชิ้นเป็น${labelOf(target)} แล้ว · กด Ctrl+Z เพื่อย้อนกลับ`);
  }

  return (
    <section
      aria-labelledby="condition-bar-title"
      className="rounded-xl border border-border bg-card px-4 py-3"
    >
      <h2 id="condition-bar-title" className="flex items-center gap-2 text-sm font-semibold">
        <Recycle aria-hidden className="size-4 text-used" />
        สภาพอะไหล่
      </h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="default-condition" className="text-xs text-muted-foreground">
            ชิ้นที่เพิ่มต่อจากนี้
          </label>
          <NativeSelect
            id="default-condition"
            value={defaultCondition}
            onChange={(event) =>
              useBuilderStore.getState().setDefaultCondition(event.target.value as ItemCondition)
            }
          >
            {OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bulk-condition" className="text-xs text-muted-foreground">
            เปลี่ยนทั้งชุดที่เลือกไว้เป็น
          </label>
          <div className="flex gap-2">
            <NativeSelect
              id="bulk-condition"
              value={target}
              onChange={(event) => {
                setTarget(event.target.value as ItemCondition);
                setMessage('');
              }}
            >
              {OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
            <Button
              type="button"
              variant="secondary"
              disabled={changeCount === 0}
              onClick={applyAll}
            >
              เปลี่ยน{changeCount > 0 ? ` ${changeCount} ชิ้น` : ''}
            </Button>
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        PSU ไม่เปลี่ยนเป็นมือสองให้อัตโนมัติ เพราะ PSU มือสองที่เสียอาจทำให้อะไหล่อื่นเสียด้วย
        (เปลี่ยนเองได้ที่ช่อง PSU) · รุ่นที่มีแต่มือสองเปลี่ยนเป็นมือหนึ่งไม่ได้
      </p>
      <p role="status" aria-live="polite" className="mt-1 text-xs font-medium text-ok-fg">
        {message}
      </p>
    </section>
  );
}
