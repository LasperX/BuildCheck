import { ChevronLeft, ChevronRight, Filter, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { BuildCardView } from '@/components/community/build-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { USAGE_LABELS } from '@/lib/builder/types';
import type { UsageType } from '@/lib/compat';
import { cn } from '@/lib/utils';
import {
  COMMUNITY_PAGE_SIZE,
  COMMUNITY_TABS,
  type CommunityQuery,
  communityQuerySchema,
  TAB_LABELS,
} from '@/lib/validators/community';
import { listCommunityBuilds } from '@/server/queries/community';

export const metadata: Metadata = {
  title: 'ชุมชน · BuildCheck',
  description:
    'สเปกคอมที่สมาชิกแชร์ เรียงตามใหม่ล่าสุด ยอดนิยมสัปดาห์นี้ และตลอดกาล กรองตามงบและการใช้งาน',
};

// หน้าชุมชน /builds (หัวข้อ 3.7, 5.1) ตัวกรองเป็นฟอร์ม GET ใช้ได้แม้ JavaScript ยังโหลดไม่เสร็จ

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function hrefWith(query: CommunityQuery, patch: Partial<CommunityQuery>) {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.tab !== 'new') params.set('tab', next.tab);
  if (next.usage) params.set('usage', next.usage);
  if (next.min !== undefined) params.set('min', String(next.min));
  if (next.max !== undefined) params.set('max', String(next.max));
  if (next.condition) params.set('condition', next.condition);
  if (next.page > 1) params.set('page', String(next.page));
  const text = params.toString();
  return text ? `/builds?${text}` : '/builds';
}

async function CommunityContent({
  searchParams,
}: {
  searchParams: PageProps<'/builds'>['searchParams'];
}) {
  const raw = await searchParams;
  const query = communityQuerySchema.parse({
    tab: one(raw.tab),
    usage: one(raw.usage) || undefined,
    min: one(raw.min) || undefined,
    max: one(raw.max) || undefined,
    condition: one(raw.condition) || undefined,
    page: one(raw.page),
  });
  const { items, total } = await listCommunityBuilds(query);
  const pages = Math.max(1, Math.ceil(total / COMMUNITY_PAGE_SIZE));

  return (
    <>
      <nav
        aria-label="เรียงสเปก"
        className="mt-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border"
      >
        {COMMUNITY_TABS.map((tab) => (
          <Link
            key={tab}
            href={hrefWith(query, { tab, page: 1 })}
            aria-current={query.tab === tab ? 'page' : undefined}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground aria-[current=page]:border-brand aria-[current=page]:text-foreground"
          >
            {TAB_LABELS[tab]}
          </Link>
        ))}
      </nav>

      <form
        action="/builds"
        className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_140px_auto] lg:items-end"
      >
        {query.tab !== 'new' && <input type="hidden" name="tab" value={query.tab} />}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          ประเภทการใช้งาน
          <NativeSelect name="usage" defaultValue={query.usage ?? ''}>
            <option value="">ทุกประเภท</option>
            {(Object.keys(USAGE_LABELS) as UsageType[]).map((usage) => (
              <option key={usage} value={usage}>
                {USAGE_LABELS[usage]}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          สภาพอะไหล่
          <NativeSelect name="condition" defaultValue={query.condition ?? ''}>
            <option value="">ทั้งหมด</option>
            <option value="used">มีอะไหล่มือสอง</option>
            <option value="new">มือหนึ่งทั้งชุด</option>
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          งบตั้งแต่ (บาท)
          <Input name="min" inputMode="numeric" defaultValue={query.min} className="font-mono" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          ถึง (บาท)
          <Input name="max" inputMode="numeric" defaultValue={query.max} className="font-mono" />
        </label>
        <Button type="submit" variant="secondary">
          <Filter aria-hidden />
          กรอง
        </Button>
      </form>

      <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
        พบ <span className="font-mono">{total.toLocaleString('th-TH')}</span> สเปก
      </p>

      {items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
          <Users aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 font-medium">
            {query.condition === 'used'
              ? 'ยังไม่มีสเปกมือสองที่แชร์ไว้'
              : 'ยังไม่มีสเปกสาธารณะที่ตรงกับตัวกรอง'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {query.condition === 'used'
              ? 'จัดสเปกแล้วกด “มือสอง A/B/C” ที่ช่องอะไหล่ หรือเปลี่ยนทั้งชุดเป็นมือสอง จากนั้นแชร์เป็น “สาธารณะ”'
              : 'จัดสเปกของคุณแล้วเปลี่ยนเป็น “สาธารณะ” เพื่อแชร์ในหน้านี้'}
          </p>
          <Button asChild className="mt-4">
            <Link href="/builder">เริ่มจัดสเปก</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((build) => (
            <li key={build.id}>
              <BuildCardView build={build} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="หน้า" className="mt-6 flex items-center justify-center gap-2">
          <Button
            asChild
            variant="secondary"
            size="sm"
            className={cn(query.page <= 1 && 'pointer-events-none opacity-50')}
          >
            <Link href={hrefWith(query, { page: query.page - 1 })} aria-disabled={query.page <= 1}>
              <ChevronLeft aria-hidden />
              ก่อนหน้า
            </Link>
          </Button>
          <span className="font-mono text-sm">
            {query.page} / {pages}
          </span>
          <Button
            asChild
            variant="secondary"
            size="sm"
            className={cn(query.page >= pages && 'pointer-events-none opacity-50')}
          >
            <Link
              href={hrefWith(query, { page: query.page + 1 })}
              aria-disabled={query.page >= pages}
            >
              ถัดไป
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </nav>
      )}
    </>
  );
}

export default function CommunityPage({ searchParams }: PageProps<'/builds'>) {
  return (
    <main className="container mx-auto px-4 py-6">
      <h1 className="t-h1">ชุมชน</h1>
      <p className="mt-1 text-muted-foreground">
        สเปกที่สมาชิกแชร์ไว้ โหวต คอมเมนต์ หรือ Fork ไปแก้เป็นของคุณได้
      </p>
      <Suspense
        fallback={
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        }
      >
        <CommunityContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
