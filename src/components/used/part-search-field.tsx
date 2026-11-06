'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { formatBaht, type PartListItem, type PartsResponse } from '@/lib/parts/catalog';
import { CATEGORY_LABELS, CATEGORY_SLUGS, type CategorySlug } from '@/lib/parts/spec-fields';

// ช่องเลือกรุ่นอะไหล่: เลือกหมวด พิมพ์ชื่อรุ่น แล้วกดเลือกจากรายการ (ใช้ในฟอร์มรายงานราคาและฟอร์มแอดมิน)

export type PickedPart = Pick<
  PartListItem,
  'id' | 'model' | 'brandName' | 'categorySlug' | 'price'
>;

export function PartSearchField({
  value,
  onChange,
  legend = 'รุ่นอะไหล่',
}: {
  value: PickedPart | null;
  onChange: (part: PickedPart | null) => void;
  legend?: string;
}) {
  const [category, setCategory] = useState<CategorySlug>(value?.categorySlug ?? 'gpu');
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<PartListItem[]>([]);

  // ค้นหารุ่นเมื่อหยุดพิมพ์ 300 มิลลิวินาที
  useEffect(() => {
    if (value) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ category });
      if (query.trim()) params.set('q', query.trim());
      const response = await fetch(`/api/parts?${params}`, { signal: controller.signal }).catch(
        () => null,
      );
      if (response?.ok) setOptions(((await response.json()) as PartsResponse).items.slice(0, 8));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [category, query, value]);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 p-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[value.categorySlug]}</p>
            <p className="font-medium">
              {value.brandName} {value.model}
            </p>
            <p className="text-xs text-muted-foreground">ราคาใหม่ {formatBaht(value.price)}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X aria-hidden />
            เปลี่ยนรุ่น
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)]">
            <NativeSelect
              aria-label="หมวด"
              value={category}
              onChange={(event) => setCategory(event.target.value as CategorySlug)}
            >
              {CATEGORY_SLUGS.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </NativeSelect>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
              />
              <Input
                type="search"
                aria-label="ค้นหาชื่อรุ่น"
                placeholder="พิมพ์ชื่อรุ่น"
                className="pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {options.length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground">ไม่พบรุ่นในหมวดนี้</li>
            ) : (
              options.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => onChange(option)}
                    className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm hover:bg-surface-2"
                  >
                    <span>
                      {option.brandName} {option.model}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatBaht(option.price)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </fieldset>
  );
}
