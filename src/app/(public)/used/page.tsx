import { Flame, Megaphone, Search, TrendingDown } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { CHANNEL_LABELS, CONFIDENCE_LABELS, REPORT_TYPE_LABELS } from '@/lib/builder/used-types';
import { USED_GRADES } from '@/lib/compat';
import { formatBaht } from '@/lib/parts/catalog';
import { CATEGORY_LABELS, CATEGORY_SLUGS } from '@/lib/parts/spec-fields';
import { getUsedMarket, type MarketPart } from '@/server/queries/used';

export const metadata: Metadata = {
  title: 'ตลาดมือสอง · BuildCheck',
  description:
    'ราคากลางอะไหล่คอมมือสองจากรายงานของสมาชิกและการสำรวจตลาด รุ่นที่ราคาลดมากสุดเดือนนี้ และรายงานล่าสุด',
};

// หน้าตลาดมือสอง /used (หัวข้อ 5.4) ระบบไม่ได้ขายของ แสดงเฉพาะราคาอ้างอิง

const filtersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: z.enum(CATEGORY_SLUGS).optional().catch(undefined),
  grade: z.enum(['A', 'B', 'C']).optional().catch(undefined),
});

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

function PartLink({ part }: { part: MarketPart }) {
  return (
    <Link href={`/parts/${part.categorySlug}/${part.slug}`} className="font-medium hover:underline">
      {part.brandName} {part.model}
    </Link>
  );
}

async function MarketContent({
  searchParams,
}: {
  searchParams: PageProps<'/used'>['searchParams'];
}) {
  const raw = await searchParams;
  const filters = filtersSchema.parse({
    q: one(raw.q) || undefined,
    category: one(raw.category) || undefined,
    grade: one(raw.grade) || undefined,
  });
  const market = await getUsedMarket(filters);

  return (
    <>
      <form
        action="/used"
        role="search"
        className="mt-5 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_180px_140px_auto] sm:items-end"
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          ค้นหาราคามือสองของรุ่น
          <Input name="q" type="search" defaultValue={filters.q} placeholder="ชื่อรุ่น" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          หมวด
          <NativeSelect name="category" defaultValue={filters.category ?? ''}>
            <option value="">ทุกหมวด</option>
            {CATEGORY_SLUGS.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          เกรด
          <NativeSelect name="grade" defaultValue={filters.grade ?? ''}>
            <option value="">ทุกเกรด</option>
            {USED_GRADES.map((grade) => (
              <option key={grade} value={grade}>
                เกรด {grade}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button type="submit">
          <Search aria-hidden />
          ค้นหา
        </Button>
      </form>

      {market.results && (
        <section aria-labelledby="results-title" className="mt-6">
          <h2 id="results-title" className="mb-3 text-lg font-semibold">
            ผลค้นหา “{filters.q}”
          </h2>
          {market.results.length === 0 ? (
            <p className="text-muted-foreground">ไม่พบรุ่นที่ตรงกับคำค้น</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="p-3 text-left font-normal">
                      รุ่น
                    </th>
                    <th scope="col" className="p-3 text-right font-normal">
                      ราคาใหม่
                    </th>
                    {USED_GRADES.map((grade) => (
                      <th key={grade} scope="col" className="p-3 text-right font-normal">
                        มือสอง {grade}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {market.results.map((row) => (
                    <tr key={row.partId} className="border-b border-border last:border-0">
                      <td className="p-3">
                        <p className="text-xs text-muted-foreground">
                          {CATEGORY_LABELS[row.categorySlug]}
                        </p>
                        <PartLink part={row} />
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground">
                        {formatBaht(row.newPrice)}
                      </td>
                      {USED_GRADES.map((grade) => (
                        <td key={grade} className="p-3 text-right">
                          <span className="font-mono font-semibold">
                            {formatBaht(row.prices[grade].median)}
                          </span>
                          <span className="block text-2xs text-muted-foreground">
                            {CONFIDENCE_LABELS[row.prices[grade].confidence]}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="drops-title"
          className="rounded-xl border border-border bg-card p-4"
        >
          <h2 id="drops-title" className="mb-1 flex items-center gap-1.5 text-lg font-semibold">
            <TrendingDown aria-hidden className="size-5 text-ok-fg" />
            ราคาลดมากสุดเดือนนี้
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            เทียบราคากลางของรายงาน 30 วันล่าสุดกับ 30 วันก่อนหน้า (ต้องมีอย่างน้อยช่วงละ 2 รายงาน)
          </p>
          {market.drops.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังมีรายงานไม่พอสำหรับเทียบราคา</p>
          ) : (
            <ol className="flex flex-col divide-y divide-border">
              {market.drops.map((drop) => (
                <li key={`${drop.partId}-${drop.grade}`} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <PartLink part={drop} />
                    <p className="text-xs text-muted-foreground">
                      เกรด {drop.grade} · {formatBaht(drop.before)} → {formatBaht(drop.now)}
                    </p>
                  </div>
                  <Badge variant="ok" className="font-mono">
                    −{Math.round(drop.drop * 100)}%
                  </Badge>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section
          aria-labelledby="popular-title"
          className="rounded-xl border border-border bg-card p-4"
        >
          <h2 id="popular-title" className="mb-1 flex items-center gap-1.5 text-lg font-semibold">
            <Flame aria-hidden className="size-5 text-warn-fg" />
            รุ่นที่ถูกรายงานบ่อย
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            นับรายงานที่อนุมัติแล้วใน 60 วันล่าสุด
          </p>
          {market.popular.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีรายงาน</p>
          ) : (
            <ol className="flex flex-col divide-y divide-border">
              {market.popular.map((part) => (
                <li key={part.partId} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">
                      {CATEGORY_LABELS[part.categorySlug]}
                    </span>
                    <PartLink part={part} />
                  </span>
                  <span className="shrink-0 font-mono text-sm">{part.reports} รายงาน</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section aria-labelledby="latest-title" className="mt-6">
        <h2 id="latest-title" className="mb-3 text-lg font-semibold">
          รายงานล่าสุด
        </h2>
        {market.latest.length === 0 ? (
          <p className="text-muted-foreground">
            ยังไม่มีรายงานที่อนุมัติแล้ว
            {filters.category || filters.grade ? 'ตามตัวกรองที่เลือก' : ''}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="p-3 text-left font-normal">
                    วันที่
                  </th>
                  <th scope="col" className="p-3 text-left font-normal">
                    รุ่น
                  </th>
                  <th scope="col" className="p-3 text-left font-normal">
                    เกรด
                  </th>
                  <th scope="col" className="p-3 text-left font-normal">
                    ประเภท · ช่องทาง
                  </th>
                  <th scope="col" className="p-3 text-right font-normal">
                    ราคา
                  </th>
                </tr>
              </thead>
              <tbody>
                {market.latest.map((report) => (
                  <tr key={report.id} className="border-b border-border last:border-0">
                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(report.seenAt)}
                    </td>
                    <td className="p-3">
                      <PartLink part={report} />
                    </td>
                    <td className="p-3">{report.grade}</td>
                    <td className="p-3">
                      {REPORT_TYPE_LABELS[report.reportType]} · {CHANNEL_LABELS[report.channel]}
                      {report.province ? ` · ${report.province}` : ''}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold">
                      {formatBaht(report.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default function UsedMarketPage({ searchParams }: PageProps<'/used'>) {
  return (
    <main className="container mx-auto px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="t-h1">ตลาดมือสอง</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            ราคากลางจากรายงานของสมาชิกที่แอดมินตรวจแล้ว และการสำรวจตลาด BuildCheck
            ไม่ได้ขายของและไม่ได้ดึงราคาจากเว็บอื่น
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/used/report">
            <Megaphone aria-hidden />
            รายงานราคาที่เจอ
          </Link>
        </Button>
      </div>
      <Suspense
        fallback={
          <div className="mt-5 flex flex-col gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </div>
        }
      >
        <MarketContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
