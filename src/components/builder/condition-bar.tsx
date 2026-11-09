'use client';

import { Recycle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { bulkConditionUpdates } from '@/lib/builder/conditions';
import type { BuilderPart } from '@/lib/builder/types';
import type { ItemCondition } from '@/lib/compat';
import { type BuildItem, useBuilderStore } from '@/stores/builder-store';

// แถบตัวเลือกเหนือช่องอะไหล่: กรองอัจฉริยะ + สภาพอะไหล่ รวมเป็นแถวเดียว ไม่ดันช่อง CPU ลงไปไกล
// สภาพอะไหล่: จัดสเปกมือสองทั้งชุดได้โดยไม่ต้องกดทีละชิ้น
// 1. ค่าตั้งต้นของชิ้นที่เพิ่มต่อจากนี้ (เบราว์เซอร์จำไว้)
// 2. ปุ่มเปลี่ยนทั้งชุดในครั้งเดียว ย้อนกลับได้ด้วย Ctrl+Z

const OPTIONS: { value: ItemCondition; label: string }[] = [
  { value: 'new', label: 'มือหนึ่ง' },
  { value: 'A', label: 'มือสอง A' },
  { value: 'B', label: 'มือสอง B' },
  { value: 'C', label: 'มือสอง C' },
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
  const smartFilter = useBuilderStore((s) => s.smartFilter);
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
      aria-label="ตัวเลือกการเลือกอะไหล่"
      className="rounded-xl border border-border bg-card px-4 py-3"
    >
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.6fr)] md:items-end">
        {/* สวิตช์อยู่นอกหน้าต่างเลือก ผู้ใช้เห็นและตั้งค่าได้ก่อนกดเลือก ใช้ค่าเดียวกันทุกหมวด */}
        <label className="flex items-center gap-3 md:pb-2">
          <Switch
            checked={smartFilter}
            onCheckedChange={(checked) => useBuilderStore.getState().setSmartFilter(checked)}
            aria-describedby="smart-filter-hint"
          />
          <span className="flex flex-col">
            <span className="text-sm font-semibold">กรองอัจฉริยะ</span>
            <span id="smart-filter-hint" className="text-xs text-muted-foreground">
              {smartFilter ? 'ซ่อนรุ่นที่ใส่ไม่ได้' : 'แสดงทุกรุ่น พร้อมป้ายเหตุผล'}
            </span>
          </span>
        </label>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="default-condition"
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Recycle aria-hidden className="size-3.5 text-used" />
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
              title="PSU ไม่เปลี่ยนเป็นมือสองให้อัตโนมัติ เพราะ PSU มือสองที่เสียอาจทำให้อะไหล่อื่นเสียด้วย · รุ่นที่มีแต่มือสองเปลี่ยนเป็นมือหนึ่งไม่ได้"
            >
              เปลี่ยน{changeCount > 0 ? ` ${changeCount} ชิ้น` : ''}
            </Button>
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        เปลี่ยนทั้งชุดเป็นมือสองจะไม่รวม PSU (เปลี่ยนเองได้ที่ช่อง PSU) ·
        รุ่นที่มีแต่มือสองเป็นมือหนึ่งไม่ได้
      </p>
      {message ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-1 anim-slot-in text-xs font-medium text-ok-fg"
        >
          {message}
        </p>
      ) : (
        <p role="status" aria-live="polite" className="sr-only" />
      )}
    </section>
  );
}
