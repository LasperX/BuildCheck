import { CircleAlert, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { ReviewActions } from '@/components/admin/review-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBaht } from '@/lib/parts/catalog';
import {
  CATEGORY_LABELS,
  CATEGORY_SLUGS,
  formatSpecValue,
  isCategorySlug,
  SPEC_FIELDS,
} from '@/lib/parts/spec-fields';
import { requireAdmin } from '@/lib/session';
import { listReviewParts, REVIEW_PAGE_SIZE } from '@/server/queries/admin-parts';

export const metadata: Metadata = { title: 'ตรวจสเปก · BuildCheck' };

// หน้าตรวจสเปก: เห็นสเปกทุกช่องของหลายชิ้นในหน้าเดียว เปิดลิงก์ผู้ผลิตเทียบ แล้วกด "ตรวจแล้ว" ได้ทันที
// ไม่ต้องเข้าฟอร์มแก้ไขทีละชิ้น เปิดฟอร์มเฉพาะชิ้นที่เจอค่าผิด

const CHIP =
  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-surface-2 aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-soft-fg';

const isEmpty = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

async function ReviewContent({
  searchParams,
}: {
  searchParams: PageProps<'/admin/parts/review'>['searchParams'];
}) {
  await requireAdmin();
  const params = await searchParams;
  const one = (value: string | string[] | undefined) =>
    typeof value === 'string' ? value : undefined;
  const rawCategory = one(params.category);
  const category = isCategorySlug(rawCategory) ? rawCategory : undefined;
  const verified = one(params.status) === 'verified';
  const page = Math.max(1, Number(one(params.page)) || 1);
  const { items, total, categoryCounts } = await listReviewParts({ category, verified, page });
  const pages = Math.max(1, Math.ceil(total / REVIEW_PAGE_SIZE));
  const allCount = Object.values(categoryCounts).reduce((sum, n) => sum + n, 0);

  const hrefWith = (patch: { category?: string | undefined; status?: string; page?: number }) => {
    const values = {
      category,
      status: verified ? 'verified' : undefined,
      page: undefined as number | undefined,
      ...patch,
    };
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== '') next.set(key, String(value));
    }
    const query = next.toString();
    return query ? `/admin/parts/review?${query}` : '/admin/parts/review';
  };

  return (
    <>
      <nav aria-label="สถานะการตรวจ" className="mt-4 flex gap-1">
        <Link
          href={hrefWith({ status: '' })}
          aria-current={verified ? undefined : 'page'}
          className={CHIP}
        >
          รอตรวจสอบ
        </Link>
        <Link
          href={hrefWith({ status: 'verified' })}
          aria-current={verified ? 'page' : undefined}
          className={CHIP}
        >
          ตรวจแล้ว
        </Link>
      </nav>

      <nav
        aria-label="หมวดอะไหล่"
        className="mt-2 flex flex-wrap gap-1 border-b border-border pb-3"
      >
        <Link
          href={hrefWith({ category: undefined })}
          aria-current={category ? undefined : 'page'}
          className={CHIP}
        >
          ทั้งหมด <span className="text-xs opacity-70">{allCount}</span>
        </Link>
        {CATEGORY_SLUGS.map((slug) => (
          <Link
            key={slug}
            href={hrefWith({ category: slug })}
            aria-current={category === slug ? 'page' : undefined}
            className={CHIP}
          >
            {CATEGORY_LABELS[slug]}
            <span className="text-xs opacity-70">{categoryCounts[slug] ?? 0}</span>
          </Link>
        ))}
      </nav>

      <p className="mt-4 text-xs text-muted-foreground">
        {verified ? 'ตรวจแล้ว' : 'รอตรวจสอบ'} {total.toLocaleString('en-US')} รายการ
        {total > 0 ? ` · หน้า ${page} จาก ${pages}` : ''}
      </p>

      {items.length === 0 ? (
        <p className="mt-6 rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          {verified
            ? 'ยังไม่มีอะไหล่ที่ตรวจแล้วในหมวดนี้'
            : 'ตรวจครบแล้ว ไม่มีอะไหล่ค้างตรวจในหมวดนี้'}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {items.map((item) => {
            const fields = SPEC_FIELDS[item.categorySlug];
            const missing = fields.filter(
              (field) => field.required && isEmpty(item.spec[field.key]),
            );
            return (
              <li
                key={item.id}
                className="rounded-lg border border-border bg-surface p-4"
                aria-labelledby={`review-${item.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id={`review-${item.id}`} className="font-semibold">
                      {item.model}
                    </h2>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span>{item.brandName}</span>
                      <span aria-hidden>·</span>
                      <span>{CATEGORY_LABELS[item.categorySlug]}</span>
                      {item.isActive ? null : (
                        <Badge variant="neutral" className="text-[11px]">
                          ซ่อนอยู่
                        </Badge>
                      )}
                    </p>
                  </div>
                  <ReviewActions id={item.id} model={item.model} verified={item.specVerified} />
                </div>

                <div className="mt-3 text-sm">
                  {item.specSourceUrl ? (
                    <a
                      href={item.specSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 break-all text-link hover:underline"
                    >
                      <ExternalLink aria-hidden className="size-3.5 shrink-0" />
                      เปิดหน้าสเปกจากผู้ผลิต
                      <span className="sr-only">(เปิดแท็บใหม่)</span>
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-warn-fg">
                      <CircleAlert aria-hidden className="size-3.5" />
                      ไม่มีลิงก์แหล่งที่มาสเปก
                    </span>
                  )}
                </div>

                {missing.length > 0 ? (
                  <p className="mt-2 flex items-center gap-1 text-xs text-err-fg">
                    <CircleAlert aria-hidden className="size-3.5" />
                    ช่องจำเป็นที่ยังว่าง: {missing.map((field) => field.label).join(', ')}
                  </p>
                ) : null}

                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">ราคาอ้างอิง</dt>
                    <dd className="font-mono">{formatBaht(item.price)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">กำลังไฟ (W)</dt>
                    <dd className="font-mono">{item.powerWatt ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">ปีที่วางขาย</dt>
                    <dd className="font-mono">{item.releaseYear ?? '—'}</dd>
                  </div>
                  {fields.map((field) => {
                    const empty = isEmpty(item.spec[field.key]);
                    return (
                      <div key={field.key}>
                        <dt className="text-xs text-muted-foreground">
                          {field.label}
                          {field.required ? <span className="text-err-fg"> *</span> : null}
                        </dt>
                        <dd
                          className={
                            empty && field.required ? 'font-mono text-err-fg' : 'font-mono'
                          }
                        >
                          {formatSpecValue(item.spec[field.key], field.kind)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="แบ่งหน้า" className="mt-4 flex items-center justify-between gap-2">
          {page > 1 ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={hrefWith({ page: page - 1 })}>ก่อนหน้า</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">
            หน้า {page} จาก {pages}
          </span>
          {page < pages ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={hrefWith({ page: page + 1 })}>ถัดไป</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}

export default function ReviewPage({ searchParams }: PageProps<'/admin/parts/review'>) {
  return (
    <>
      <h1 className="t-h1">ตรวจสเปก</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        เปิดหน้าสเปกจากผู้ผลิตเทียบกับค่าด้านล่าง ถ้าถูกต้องกด &quot;ตรวจแล้ว&quot; ได้เลย
        ถ้าเจอค่าผิดกด &quot;แก้ไข&quot; ช่องที่มี * คือช่องจำเป็น
      </p>
      <Suspense fallback={<Skeleton className="mt-4 h-96 rounded-lg" />}>
        <ReviewContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
