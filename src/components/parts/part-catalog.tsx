'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CircleX, Clock, LayoutGrid, List, Search, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { FormAlert } from '@/components/auth/form-field';
import { AddToBuildButton } from '@/components/parts/add-to-build-button';
import { PartImage } from '@/components/parts/part-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatBaht,
  type PartFacets,
  type PartListItem,
  type PartsResponse,
  SORT_OPTIONS,
} from '@/lib/parts/catalog';
import { CATEGORY_LABELS, type CategorySlug } from '@/lib/parts/spec-fields';
import { cn } from '@/lib/utils';

// เก็บตัวกรองทั้งหมดไว้ใน URL จึงแชร์ลิงก์ได้ กดย้อนกลับได้ และเปิดหน้าใหม่แล้วค่าไม่หาย

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

async function fetchParts(query: string): Promise<PartsResponse> {
  const response = await fetch(`/api/parts?${query}`);
  if (!response.ok) throw new Error('โหลดรายการอะไหล่ไม่สำเร็จ');
  return response.json() as Promise<PartsResponse>;
}

export function PartCatalog({
  category,
  facets,
}: {
  category?: CategorySlug;
  facets?: PartFacets;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [q, setQ] = useState(params.get('q') ?? '');
  const debouncedQ = useDebounced(q, 250); // พิมพ์แล้วผลขึ้นทันที แต่รอให้หยุดพิมพ์สั้นๆ ก่อนเรียก API

  const update = (changes: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key);
      if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
      else if (value) next.set(key, value);
    }
    if (!('page' in changes)) next.delete('page');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  // ส่งคำค้นเข้า URL เมื่อหยุดพิมพ์
  useEffect(() => {
    if (debouncedQ !== (params.get('q') ?? '')) update({ q: debouncedQ || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ต้องการรันเฉพาะเมื่อคำค้นเปลี่ยน
  }, [debouncedQ]);

  const apiParams = new URLSearchParams(params.toString());
  if (category) apiParams.set('category', category);
  const apiQuery = apiParams.toString();

  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: ['parts', apiQuery],
    queryFn: () => fetchParts(apiQuery),
    placeholderData: keepPreviousData, // เปลี่ยนตัวกรองแล้วรายการเดิมยังอยู่ระหว่างรอ หน้าไม่กระพริบ
  });

  const page = data?.page ?? 1;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasFilters = Boolean(facets);

  const toggleIn = (name: string, value: string) => {
    const current = params.getAll(name);
    update({
      [name]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    });
  };

  return (
    <div className={hasFilters ? 'lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6' : undefined}>
      {facets ? (
        <aside
          aria-label="ตัวกรอง"
          className={`${filtersOpen ? 'block' : 'hidden'} mb-4 rounded-lg border border-border bg-surface p-4 lg:sticky lg:top-20 lg:mb-0 lg:block lg:self-start`}
        >
          <div className="flex flex-col gap-5">
            {facets.brands.length > 0 ? (
              <FilterGroup title="ยี่ห้อ">
                {facets.brands.map((brand) => (
                  <FilterCheck
                    key={brand.id}
                    label={brand.name}
                    checked={params.getAll('brand').includes(String(brand.id))}
                    onChange={() => toggleIn('brand', String(brand.id))}
                  />
                ))}
              </FilterGroup>
            ) : null}

            <FilterGroup title="ช่วงราคา (บาท)">
              <div className="flex items-center gap-2">
                <Input
                  aria-label="ราคาต่ำสุด"
                  placeholder="ต่ำสุด"
                  inputMode="numeric"
                  defaultValue={params.get('min') ?? ''}
                  className="h-8 font-mono md:text-xs"
                  onBlur={(event) => update({ min: event.target.value.trim() || null })}
                />
                <span className="text-subtle">–</span>
                <Input
                  aria-label="ราคาสูงสุด"
                  placeholder="สูงสุด"
                  inputMode="numeric"
                  defaultValue={params.get('max') ?? ''}
                  className="h-8 font-mono md:text-xs"
                  onBlur={(event) => update({ max: event.target.value.trim() || null })}
                />
              </div>
            </FilterGroup>

            <FilterGroup title="สถานะการขาย">
              {(
                [
                  ['', 'ทั้งหมด'],
                  ['new', 'มีขายมือหนึ่ง'],
                  ['used_only', 'มีแต่มือสอง'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex min-h-7 cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="availability"
                    checked={(params.get('availability') ?? '') === value}
                    onChange={() => update({ availability: value || null })}
                    className="size-4 shrink-0 accent-[var(--brand)]"
                  />
                  {label}
                </label>
              ))}
            </FilterGroup>

            {facets.spec
              .filter((group) => group.values.length > 0)
              .map((group) => (
                <FilterGroup key={group.key} title={group.label}>
                  {group.values.map((value) => (
                    <FilterCheck
                      key={value}
                      label={value}
                      checked={params.getAll(`spec.${group.key}`).includes(value)}
                      onChange={() => toggleIn(`spec.${group.key}`, value)}
                    />
                  ))}
                </FilterGroup>
              ))}
          </div>
        </aside>
      ) : null}

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
            />
            <Input
              type="search"
              value={q}
              placeholder="ค้นหาชื่อรุ่นหรือยี่ห้อ"
              aria-label="ค้นหาอะไหล่"
              className="pl-9"
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <div className="w-44">
            <NativeSelect
              aria-label="เรียงลำดับ"
              value={params.get('sort') ?? 'popular'}
              onChange={(event) => update({ sort: event.target.value })}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  เรียงตาม{option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          {hasFilters ? (
            <Button
              variant="secondary"
              className="lg:hidden"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal aria-hidden />
              ตัวกรอง
            </Button>
          ) : null}
          <div
            role="group"
            aria-label="รูปแบบการแสดงผล"
            className="inline-flex gap-0.5 rounded-md bg-surface-3 p-0.5"
          >
            <ViewButton active={view === 'cards'} label="การ์ด" onClick={() => setView('cards')}>
              <LayoutGrid aria-hidden />
            </ViewButton>
            <ViewButton active={view === 'table'} label="ตาราง" onClick={() => setView('table')}>
              <List aria-hidden />
            </ViewButton>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
          {data ? `พบ ${data.total.toLocaleString('en-US')} รายการ` : ' '}
          {isFetching && data ? ' · กำลังอัปเดต...' : ''}
        </p>

        <div className="mt-2">
          {/* หัวข้อสำหรับโปรแกรมอ่านหน้าจอ ให้ลำดับหัวข้อไม่ข้ามจาก h1 ไป h3 ของการ์ด */}
          <h2 className="sr-only">รายการอะไหล่</h2>
          {isError ? (
            <FormAlert variant="err" icon={<CircleX />}>
              โหลดรายการอะไหล่ไม่สำเร็จ กรุณาลองใหม่
            </FormAlert>
          ) : isPending ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3" aria-label="กำลังโหลด">
              {[1, 2, 3, 4, 5, 6].map((key) => (
                <Skeleton key={key} className="h-64 rounded-lg" />
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <p className="rounded-lg border border-border bg-surface p-8 text-center text-muted-foreground">
              ไม่พบอะไหล่ที่ตรงเงื่อนไข ลองลดตัวกรองหรือเปลี่ยนคำค้น
            </p>
          ) : view === 'cards' ? (
            <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4 md:grid-cols-3">
              {data.items.map((part) => (
                <li key={part.id}>
                  <PartCard part={part} />
                </li>
              ))}
            </ul>
          ) : (
            <PartTable items={data.items} />
          )}
        </div>

        {pages > 1 ? (
          <nav aria-label="แบ่งหน้า" className="mt-4 flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
            >
              ก่อนหน้า
            </Button>
            <span className="text-xs text-muted-foreground">
              หน้า {page} จาก {pages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= pages}
              onClick={() => update({ page: String(page + 1) })}
            >
              ถัดไป
            </Button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-xs font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function FilterCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-7 cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 accent-[var(--brand)]"
      />
      <span className="min-w-0 break-words">{label}</span>
    </label>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-sm text-muted-foreground hover:text-foreground aria-pressed:bg-surface aria-pressed:text-foreground aria-pressed:shadow-sm [&>svg]:size-4"
    >
      {children}
    </button>
  );
}

const partHref = (part: PartListItem) => `/parts/${part.categorySlug}/${part.slug}`;

function UsedOnlyBadge({ availability }: { availability: PartListItem['availability'] }) {
  if (availability !== 'used_only') return null;
  return (
    <Badge variant="used" className="h-5 px-1.5 text-2xs">
      มีแต่มือสอง
    </Badge>
  );
}

/** รุ่นที่มีแต่มือสอง: ราคาในระบบคือราคาตอนเปิดตัว ไม่ใช่ราคาที่ซื้อได้ จึงบอกให้ชัด */
function PriceLabel({ part, className }: { part: PartListItem; className?: string }) {
  if (part.availability === 'used_only') {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>
        ราคาเปิดตัว <span className="font-mono">{formatBaht(part.price)}</span>
      </span>
    );
  }
  return (
    <span className={cn('font-mono text-sm font-semibold', className)}>
      {formatBaht(part.price)}
    </span>
  );
}

function VerifiedHint({ verified }: { verified: boolean }) {
  if (verified) return null;
  return (
    <Badge variant="warn" className="h-5 px-1.5 text-2xs">
      <Clock aria-hidden />
      รอตรวจสอบ
    </Badge>
  );
}

function PartCard({ part }: { part: PartListItem }) {
  return (
    <article className="flex h-full lift flex-col rounded-lg border border-border bg-surface p-3 hover:border-border-strong hover:shadow-md">
      <Link href={partHref(part)} className="flex flex-1 flex-col">
        <PartImage
          src={part.imageUrl}
          alt=""
          category={part.categorySlug}
          size={120}
          className="h-28 w-full lg:h-32"
        />
        <span className="mt-3 text-xs text-muted-foreground">{part.brandName}</span>
        <h3 className="text-sm font-medium break-words">{part.model}</h3>
        <span className="mt-1 flex flex-wrap gap-1">
          {part.chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex h-5.5 items-center rounded-xs bg-surface-2 px-1.5 font-mono text-2xs text-muted-foreground"
            >
              {chip}
            </span>
          ))}
        </span>
        <span className="mt-2 flex flex-wrap gap-1">
          <UsedOnlyBadge availability={part.availability} />
          <VerifiedHint verified={part.specVerified} />
        </span>
        <PriceLabel part={part} className="mt-2" />
      </Link>
      <AddToBuildButton
        partId={part.id}
        categorySlug={part.categorySlug}
        availability={part.availability}
        className="mt-3 w-full"
      />
    </article>
  );
}

function PartTable({ items }: { items: PartListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="p-3 font-medium">รุ่น</th>
            <th className="p-3 font-medium">หมวด</th>
            <th className="p-3 font-medium">สเปก</th>
            <th className="p-3 text-right font-medium">ราคา</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((part) => (
            <tr key={part.id} className="border-b border-border last:border-0">
              <td className="p-3">
                <Link href={partHref(part)} className="font-medium hover:underline">
                  {part.model}
                </Link>
                <div className="text-xs text-muted-foreground">{part.brandName}</div>
                <UsedOnlyBadge availability={part.availability} />
              </td>
              <td className="p-3 whitespace-nowrap">{CATEGORY_LABELS[part.categorySlug]}</td>
              <td className="p-3 font-mono text-xs text-muted-foreground">
                {part.chips.join(' · ')}
              </td>
              <td className="p-3 text-right whitespace-nowrap">
                <PriceLabel part={part} />
              </td>
              <td className="p-3 text-right">
                <AddToBuildButton
                  partId={part.id}
                  categorySlug={part.categorySlug}
                  availability={part.availability}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
