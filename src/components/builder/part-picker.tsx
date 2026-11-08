'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CircleCheck, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';

import { CATEGORY_ICONS, PartImage } from '@/components/parts/part-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { type CandidateItem, type CandidatesResponse, encodeBuildParam } from '@/lib/builder/types';
import { isUsedOnly, type RuleCode, type UsageType } from '@/lib/compat';
import { conditionForNewPart } from '@/lib/builder/conditions';
import { formatBaht, type PartFacets } from '@/lib/parts/catalog';
import { CATEGORY_LABELS, type CategorySlug } from '@/lib/parts/spec-fields';
import { cn } from '@/lib/utils';
import { type BuildItem, useBuilderStore } from '@/stores/builder-store';

import { LEVEL_UI } from './levels';

export type PickerTarget = {
  category: CategorySlug;
  /** เปลี่ยนรุ่นของชิ้นนี้ ไม่ระบุ = เพิ่มใหม่ */
  replacePartId?: number;
  /** ตัวกรองสเปกตั้งต้น จากปุ่มแนะนำอะไหล่ทดแทน */
  filter?: Record<string, string[]>;
  /** ราคาอ้างอิงสำหรับเรียง "ราคาใกล้เคียงที่สุด" */
  near?: number;
  /** รหัสกฎที่ต้องการแก้ (เปิดจากปุ่มแนะนำอะไหล่ทดแทน) */
  fix?: RuleCode;
};

const SORTS = [
  { value: 'popular', label: 'เรียงตามความนิยม' },
  { value: 'near', label: 'ราคาใกล้เคียงที่สุด' },
  { value: 'price_asc', label: 'ราคาต่ำไปสูง' },
  { value: 'price_desc', label: 'ราคาสูงไปต่ำ' },
  { value: 'newest', label: 'รุ่นใหม่ล่าสุด' },
] as const;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
  return response.json() as Promise<T>;
}

/** หน้าต่างเลือกอะไหล่ (หัวข้อ 3.3 และ 5.1) เปิดใหม่ทุกครั้งจึงเริ่มจากค่าของ target */
export function PartPicker({
  target,
  items,
  usage,
  onClose,
  onSelect,
}: {
  target: PickerTarget | null;
  items: BuildItem[];
  usage: UsageType;
  onClose: () => void;
  onSelect: (part: CandidateItem, target: PickerTarget) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[min(92dvh,860px)] max-w-[calc(100%-1rem)] flex-col gap-0 p-0 sm:max-w-4xl">
        {target && (
          <PickerBody
            key={`${target.category}-${target.replacePartId ?? 'new'}`}
            target={target}
            items={items}
            usage={usage}
            onSelect={onSelect}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({
  target,
  items,
  usage,
  onSelect,
}: {
  target: PickerTarget;
  items: BuildItem[];
  usage: UsageType;
  onSelect: (part: CandidateItem, target: PickerTarget) => void;
}) {
  const { category } = target;
  const label = CATEGORY_LABELS[category];
  const Icon = CATEGORY_ICONS[category];

  const [q, setQ] = useState('');
  // กรองอัจฉริยะใช้ค่าเดียวกับสวิตช์บนหน้าจัดสเปก (ค่าเริ่มต้นปิด) กดในหน้าต่างนี้ก็เปลี่ยนค่านั้นด้วย
  // ยกเว้นเปิดจากปุ่มแก้ปัญหา (fix) ที่เปิดไว้เสมอ เพื่อให้เหลือเฉพาะรุ่นที่แก้ปัญหานั้นได้ และไม่ไปเปลี่ยนค่าหลัก
  const savedSmart = useBuilderStore((s) => s.smartFilter);
  const [fixSmart, setFixSmart] = useState(true);
  const smart = target.fix ? fixSmart : savedSmart;
  const setSmart = target.fix ? setFixSmart : useBuilderStore.getState().setSmartFilter;
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>(
    target.near !== undefined ? 'near' : 'popular',
  );
  const [brands, setBrands] = useState<number[]>([]);
  const [spec, setSpec] = useState<Record<string, string[]>>(target.filter ?? {});
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(Boolean(target.filter));
  const debouncedQ = useDebounced(q, 250);

  const params = new URLSearchParams({
    category,
    sort,
    page: String(page),
    usage,
    smart: smart ? '1' : '0',
    build: encodeBuildParam(items),
  });
  if (debouncedQ) params.set('q', debouncedQ);
  if (target.replacePartId) params.set('replace', String(target.replacePartId));
  if (target.near !== undefined) params.set('near', String(target.near));
  if (target.fix) params.set('fix', target.fix);
  if (min) params.set('min', min);
  if (max) params.set('max', max);
  for (const brand of brands) params.append('brand', String(brand));
  for (const [key, values] of Object.entries(spec)) {
    for (const value of values) params.append(`spec.${key}`, value);
  }
  const query = params.toString();

  const list = useQuery({
    queryKey: ['candidates', query],
    queryFn: () => getJson<CandidatesResponse>(`/api/builder/candidates?${query}`),
    placeholderData: keepPreviousData,
  });
  const facets = useQuery({
    queryKey: ['facets', category],
    queryFn: () => getJson<PartFacets>(`/api/parts/facets?category=${category}`),
    staleTime: 5 * 60_000,
  });

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  const changeFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const data = list.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const activeFilters =
    brands.length +
    Object.values(spec).reduce((n, v) => n + v.length, 0) +
    (min ? 1 : 0) +
    (max ? 1 : 0);

  return (
    <>
      <DialogHeader className="flex-row items-center gap-3 border-b border-border p-4 pr-12">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <DialogTitle className="text-lg">
            {target.replacePartId ? 'เปลี่ยน' : 'เลือก'}
            {/^[A-Z]/.test(label) ? ' ' : ''}
            {label}
          </DialogTitle>
          <DialogDescription className="text-xs" aria-live="polite">
            {data
              ? `${data.total} รุ่น${data.hidden ? ` · ซ่อน ${data.hidden} รุ่นที่ใส่ไม่ได้` : ''}`
              : 'กำลังโหลด…'}
          </DialogDescription>
        </div>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={q}
            onChange={(event) => changeFilter(() => setQ(event.target.value))}
            placeholder="ค้นหาชื่อรุ่นหรือยี่ห้อ"
            aria-label={`ค้นหา${label}`}
            className="pl-9"
          />
        </div>
        <label className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
          <Switch
            checked={smart}
            onCheckedChange={(checked) => changeFilter(() => setSmart(checked))}
            aria-describedby="smart-hint"
          />
          กรองอัจฉริยะ
        </label>
        <div className="w-48">
          <NativeSelect
            aria-label="เรียงลำดับ"
            value={sort}
            onChange={(event) =>
              changeFilter(() => setSort(event.target.value as (typeof SORTS)[number]['value']))
            }
          >
            {SORTS.filter((option) => option.value !== 'near' || target.near !== undefined).map(
              (option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ),
            )}
          </NativeSelect>
        </div>
        <Button
          type="button"
          variant="secondary"
          aria-expanded={filtersOpen}
          aria-controls="picker-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal aria-hidden />
          ตัวกรอง{activeFilters ? ` (${activeFilters})` : ''}
        </Button>
        <p id="smart-hint" className="w-full text-xs text-muted-foreground">
          {smart
            ? 'แสดงเฉพาะรุ่นที่เข้ากับอะไหล่ที่เลือกไว้'
            : 'แสดงทุกรุ่น รุ่นที่ใส่ไม่ได้มีป้ายบอกเหตุผล'}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {filtersOpen && (
          <div
            id="picker-filters"
            className="max-h-[40%] shrink-0 overflow-y-auto border-b border-border p-4 md:max-h-none md:w-60 md:border-r md:border-b-0"
          >
            <fieldset className="mb-4">
              <legend className="mb-2 text-sm font-semibold">ช่วงราคา (บาท)</legend>
              <div className="flex items-center gap-2">
                <Input
                  inputMode="numeric"
                  aria-label="ราคาต่ำสุด"
                  placeholder="ต่ำสุด"
                  value={min}
                  onChange={(e) => changeFilter(() => setMin(e.target.value.replace(/\D/g, '')))}
                  className="h-8 font-mono"
                />
                <span aria-hidden>–</span>
                <Input
                  inputMode="numeric"
                  aria-label="ราคาสูงสุด"
                  placeholder="สูงสุด"
                  value={max}
                  onChange={(e) => changeFilter(() => setMax(e.target.value.replace(/\D/g, '')))}
                  className="h-8 font-mono"
                />
              </div>
            </fieldset>
            {facets.data && facets.data.brands.length > 0 && (
              <fieldset className="mb-4">
                <legend className="mb-2 text-sm font-semibold">ยี่ห้อ</legend>
                {facets.data.brands.map((brand) => (
                  <label key={brand.id} className="flex items-center gap-2 py-1 text-sm">
                    <Checkbox
                      checked={brands.includes(brand.id)}
                      onCheckedChange={() =>
                        changeFilter(() => setBrands(toggle(brands, brand.id)))
                      }
                    />
                    {brand.name}
                  </label>
                ))}
              </fieldset>
            )}
            {facets.data?.spec
              .filter((filter) => filter.values.length > 0)
              .map((filter) => (
                <fieldset key={filter.key} className="mb-4">
                  <legend className="mb-2 text-sm font-semibold">{filter.label}</legend>
                  {filter.values.map((value) => (
                    <label key={value} className="flex items-center gap-2 py-1 text-sm">
                      <Checkbox
                        checked={spec[filter.key]?.includes(value) ?? false}
                        onCheckedChange={() =>
                          changeFilter(() =>
                            setSpec({
                              ...spec,
                              [filter.key]: toggle(spec[filter.key] ?? [], value),
                            }),
                          )
                        }
                      />
                      {value}
                    </label>
                  ))}
                </fieldset>
              ))}
            {activeFilters > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  changeFilter(() => {
                    setBrands([]);
                    setSpec({});
                    setMin('');
                    setMax('');
                  })
                }
              >
                ล้างตัวกรอง
              </Button>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-3" aria-busy={list.isFetching}>
          {list.isError ? (
            <p role="alert" className="p-6 text-center text-sm text-err-fg">
              โหลดรายการไม่สำเร็จ กรุณาลองใหม่
            </p>
          ) : !data ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {smart && data.hidden
                ? 'ไม่พบรุ่นที่เข้ากันได้ ลองปิดกรองอัจฉริยะเพื่อดูทั้งหมด'
                : 'ไม่พบรุ่นที่ตรงกับเงื่อนไข'}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.items.map((part) => (
                <CandidateRow
                  key={part.id}
                  part={part}
                  fix={target.fix}
                  selected={items.some((item) => item.partId === part.id)}
                  onSelect={() => onSelect(part, target)}
                />
              ))}
            </ul>
          )}
          {data && pages > 1 && (
            <nav aria-label="หน้า" className="mt-3 flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                ก่อนหน้า
              </Button>
              <span className="text-sm text-muted-foreground">
                หน้า {page} / {pages}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                ถัดไป
              </Button>
            </nav>
          )}
        </div>
      </div>
    </>
  );
}

function CandidateRow({
  part,
  fix,
  selected,
  onSelect,
}: {
  part: CandidateItem;
  fix?: RuleCode;
  selected: boolean;
  onSelect: () => void;
}) {
  const issue = part.issue;
  const ui = issue ? LEVEL_UI[issue.level] : null;
  const IssueIcon = ui?.icon ?? CircleCheck;
  const name = `${part.brandName} ${part.model}`;

  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border p-3 sm:flex-nowrap',
        issue?.level === 'error' ? 'border-err-border' : 'border-border',
      )}
    >
      <PartImage
        src={part.imageUrl}
        alt={name}
        category={part.categorySlug}
        size={56}
        className="size-14 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{name}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {isUsedOnly(part) ? <Badge variant="used">มีแต่มือสอง</Badge> : null}
          {part.chips.map((chip) => (
            <Badge key={chip} variant="neutral" className="font-mono">
              {chip}
            </Badge>
          ))}
        </div>
        <p
          className={cn('mt-1 flex items-start gap-1 text-xs', ui ? ui.text : 'text-ok-fg')}
          title={issue?.message}
        >
          <IssueIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {issue ? (
              <>
                <span className="font-mono font-semibold">{issue.code}</span> {issue.title}
                <span className="sr-only">: {issue.message}</span>
              </>
            ) : // โหมดแก้ปัญหา: ชิ้นนี้แก้ปัญหาที่กดมาได้ แต่ปัญหาอื่นที่มีอยู่เดิมอาจยังอยู่
            fix ? (
              `แก้ปัญหา ${fix} ได้ ไม่เพิ่มปัญหาใหม่`
            ) : (
              'เข้ากันได้กับที่เลือกไว้'
            )}
          </span>
        </p>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <CandidatePrice part={part} />
        <Button
          type="button"
          size="sm"
          variant={issue?.level === 'error' || selected ? 'secondary' : 'default'}
          onClick={onSelect}
          aria-label={`เลือก ${name}`}
        >
          {selected ? 'เลือกอยู่' : 'เลือก'}
        </Button>
      </div>
    </li>
  );
}

/**
 * ราคาในหน้าต่างเลือก: แสดงตามสภาพที่ชิ้นนี้จะได้ถ้ากดเลือก (ค่าตั้งต้น "ชิ้นที่เพิ่มต่อจากนี้")
 * มือสอง → ราคากลางมือสองเป็นราคาหลัก และราคาใหม่ตัวเล็กไว้เทียบ
 * รุ่นที่มีแต่มือสอง → ไม่แสดงราคาตอนเปิดตัวเป็นราคาซื้อ
 */
function CandidatePrice({ part }: { part: CandidateItem }) {
  const defaultCondition = useBuilderStore((s) => s.defaultCondition);
  const condition = conditionForNewPart(part, defaultCondition);
  if (condition === 'new') {
    return <span className="font-mono font-semibold tabular-nums">{formatBaht(part.price)}</span>;
  }
  const median = part.used?.[condition]?.median;
  return (
    <span className="flex flex-col items-end leading-tight">
      <span className="font-mono font-semibold tabular-nums">
        {median ? formatBaht(median) : '—'}
      </span>
      <span className="text-[11px] text-used">มือสอง {condition}</span>
      {isUsedOnly(part) ? null : (
        <span className="text-[11px] text-muted-foreground">
          ใหม่ <span className="font-mono">{formatBaht(part.price)}</span>
        </span>
      )}
    </span>
  );
}
