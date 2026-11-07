'use client';

import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { formatBaht } from '@/lib/parts/catalog';
import { MAX_COMPARE, parseCompareIds } from '@/lib/validators/community';

import { readCompare, writeCompare } from './compare-list';

type Choice = { id: string; title: string; totalPrice: number; ownerName: string };

/** เลือกสเปกที่จะเทียบ: จากสเปกของฉันและรายการโปรด หรือวางลิงก์/รหัสสเปก */
export function CompareControls({
  ids,
  selected,
  choices,
}: {
  ids: string[];
  selected: { id: string; title: string }[];
  choices: Choice[];
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const go = (next: string[]) => {
    writeCompare(next);
    router.push(next.length ? `/compare?ids=${next.join(',')}` : '/compare');
  };

  // เปิด /compare เปล่า ๆ แต่เคยเลือกไว้ในเครื่อง → แสดงชุดเดิมให้เลย
  useEffect(() => {
    if (ids.length > 0) {
      writeCompare(ids);
      return;
    }
    const saved = readCompare();
    if (saved.length > 0) router.replace(`/compare?ids=${saved.join(',')}`);
  }, [ids, router]);

  const add = (id: string) => {
    if (ids.includes(id)) return setError('สเปกนี้อยู่ในรายการเทียบแล้ว');
    if (ids.length >= MAX_COMPARE) return setError(`เทียบได้สูงสุด ${MAX_COMPARE} สเปก`);
    setError(null);
    go([...ids, id]);
  };

  const available = choices.filter((choice) => !ids.includes(choice.id));

  return (
    <div className="mt-5 flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <ul className="flex flex-wrap gap-2" aria-label="สเปกที่เลือกเทียบ">
        {selected.map((build) => (
          <li
            key={build.id}
            className="flex items-center gap-1 rounded-full border border-border bg-surface-2 py-1 pr-1 pl-3 text-sm"
          >
            <span className="max-w-56 truncate">{build.title}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`เอา ${build.title} ออกจากการเทียบ`}
              onClick={() => go(ids.filter((id) => id !== build.id))}
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
        {selected.length === 0 && (
          <li className="text-sm text-muted-foreground">ยังไม่ได้เลือกสเปก เลือกได้ 2–3 สเปก</li>
        )}
      </ul>

      {ids.length < MAX_COMPARE && (
        <div className="grid gap-2 lg:grid-cols-2">
          {available.length > 0 && (
            <NativeSelect
              aria-label="เพิ่มจากสเปกของฉันและรายการโปรด"
              value=""
              onChange={(event) => event.target.value && add(event.target.value)}
            >
              <option value="">+ เพิ่มจากสเปกของฉันและรายการโปรด</option>
              {available.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.title} · {choice.ownerName} · {formatBaht(choice.totalPrice)}
                </option>
              ))}
            </NativeSelect>
          )}
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              // รับได้ทั้งลิงก์เต็ม ลิงก์สั้น /b/xxx และรหัสสเปก
              const id = parseCompareIds(text.trim().split(/[/?#]/).filter(Boolean).pop())[0];
              if (!id) return setError('ไม่พบรหัสสเปกในข้อความที่วาง');
              setText('');
              add(id);
            }}
          >
            <Input
              aria-label="วางลิงก์หรือรหัสสเปก"
              placeholder="วางลิงก์สเปก หรือรหัส 10 ตัวอักษร"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <Button type="submit" variant="secondary">
              <Plus aria-hidden />
              เพิ่ม
            </Button>
          </form>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-err-fg">
          {error}
        </p>
      )}
    </div>
  );
}
