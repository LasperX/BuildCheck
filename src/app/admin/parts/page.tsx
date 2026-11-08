import { CircleCheck, ClipboardCheck, Clock, FileUp, Plus, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { PartRowActions } from '@/components/admin/part-row-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CATEGORY_LABELS, CATEGORY_SLUGS, isCategorySlug } from '@/lib/parts/spec-fields';
import { requireAdmin } from '@/lib/session';
import {
  ADMIN_PAGE_SIZE,
  ADMIN_PART_STATUSES,
  type AdminPartStatus,
  getAdminPartFacets,
  isAdminPartStatus,
  listAdminParts,
} from '@/server/queries/admin-parts';

export const metadata: Metadata = { title: 'จัดการอะไหล่ · BuildCheck' };

// ลิงก์แท็บและปุ่มกรอง ใช้สไตล์เดียวกับแท็บใน Dashboard ตัวที่เลือกอยู่มีพื้นสีฟ้าอ่อน
const CHIP =
  'inline-flex items-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-surface-2 aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-soft-fg';

const STATUS_LABELS: Record<AdminPartStatus, string> = {
  active: 'แสดงอยู่',
  hidden: 'ซ่อนอยู่',
  unverified: 'รอตรวจสอบ',
};

async function PartsContent({
  searchParams,
}: {
  searchParams: PageProps<'/admin/parts'>['searchParams'];
}) {
  await requireAdmin();
  const params = await searchParams;
  const one = (value: string | string[] | undefined) =>
    typeof value === 'string' ? value : undefined;
  const q = one(params.q);
  const rawCategory = one(params.category);
  const category = isCategorySlug(rawCategory) ? rawCategory : undefined;
  // กรองยี่ห้อได้เมื่อเลือกหมวดแล้วเท่านั้น เพราะปุ่มยี่ห้อแสดงตามหมวด
  const brandId = category ? Number(one(params.brand)) || undefined : undefined;
  const rawStatus = one(params.status);
  const status = isAdminPartStatus(rawStatus) ? rawStatus : undefined;
  const page = Math.max(1, Number(one(params.page)) || 1);
  const [{ rows, total }, facets] = await Promise.all([
    listAdminParts({ q, category, brandId, status, page }),
    getAdminPartFacets(category),
  ]);
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const allCount = Object.values(facets.categoryCounts).reduce((sum, n) => sum + n, 0);

  // สร้างลิงก์โดยคงตัวกรองเดิมไว้ เปลี่ยนเฉพาะค่าที่ส่งมา (undefined = เอาตัวกรองนั้นออก)
  // เปลี่ยนตัวกรองแล้วกลับไปหน้า 1 เสมอ
  const hrefWith = (patch: Record<string, string | number | undefined>) => {
    const values: Record<string, string | number | undefined> = {
      q,
      category,
      brand: brandId,
      status,
      page: undefined,
      ...patch,
    };
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== '') next.set(key, String(value));
    }
    const query = next.toString();
    return query ? `/admin/parts?${query}` : '/admin/parts';
  };
  const pageHref = (target: number) => hrefWith({ page: target });

  return (
    <>
      <nav
        aria-label="หมวดอะไหล่"
        className="mt-4 flex flex-wrap gap-1 border-b border-border pb-3"
      >
        <Link
          href={hrefWith({ category: undefined, brand: undefined })}
          aria-current={category ? undefined : 'page'}
          className={CHIP}
        >
          ทั้งหมด <span className="text-xs opacity-70">{allCount}</span>
        </Link>
        {CATEGORY_SLUGS.map((slug) => (
          <Link
            key={slug}
            href={hrefWith({ category: slug, brand: undefined })}
            aria-current={category === slug ? 'page' : undefined}
            className={CHIP}
          >
            {CATEGORY_LABELS[slug]}
            <span className="text-xs opacity-70">{facets.categoryCounts[slug] ?? 0}</span>
          </Link>
        ))}
      </nav>

      {category && facets.brands.length > 0 ? (
        <nav aria-label="ยี่ห้อ" className="mt-3 flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground">ยี่ห้อ</span>
          <Link
            href={hrefWith({ brand: undefined })}
            aria-current={brandId ? undefined : 'page'}
            className={CHIP}
          >
            ทุกยี่ห้อ
          </Link>
          {facets.brands.map((brand) => (
            <Link
              key={brand.id}
              href={hrefWith({ brand: brand.id })}
              aria-current={brandId === brand.id ? 'page' : undefined}
              className={CHIP}
            >
              {brand.name}
              <span className="text-xs opacity-70">{brand.value}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <nav aria-label="สถานะ" className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground">สถานะ</span>
          <Link
            href={hrefWith({ status: undefined })}
            aria-current={status ? undefined : 'page'}
            className={CHIP}
          >
            ทุกสถานะ
          </Link>
          {ADMIN_PART_STATUSES.map((value) => (
            <Link
              key={value}
              href={hrefWith({ status: value })}
              aria-current={status === value ? 'page' : undefined}
              className={CHIP}
            >
              {STATUS_LABELS[value]}
            </Link>
          ))}
        </nav>

        <form className="flex min-w-64 flex-1 gap-2" role="search">
          {category ? <input type="hidden" name="category" value={category} /> : null}
          {brandId ? <input type="hidden" name="brand" value={brandId} /> : null}
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
            />
            <Input
              name="q"
              type="search"
              defaultValue={q}
              placeholder={
                category ? `ค้นหาใน${CATEGORY_LABELS[category]}` : 'ค้นหาชื่อรุ่นหรือยี่ห้อ'
              }
              aria-label="ค้นหาอะไหล่"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            ค้นหา
          </Button>
        </form>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        ทั้งหมด {total.toLocaleString('en-US')} รายการ
      </p>

      <div className="mt-2 overflow-hidden rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>รุ่น</TableHead>
              <TableHead>หมวด</TableHead>
              <TableHead>ข้อมูลสเปก</TableHead>
              <TableHead>ราคา (บาท)</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  ยังไม่มีอะไหล่ที่ตรงเงื่อนไข
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className={row.isActive ? undefined : 'opacity-60'}>
                  <TableCell>
                    <Link href={`/admin/parts/${row.id}`} className="font-medium hover:underline">
                      {row.model}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {row.brandName}
                      {row.isActive ? '' : ' · ซ่อนอยู่'}
                      {row.availability === 'used_only' ? ' · มีแต่มือสอง' : ''}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{row.categoryName}</TableCell>
                  <TableCell>
                    {row.specVerified ? (
                      <Badge variant="ok">
                        <CircleCheck />
                        ตรวจแล้ว
                      </Badge>
                    ) : (
                      <Badge variant="warn">
                        <Clock />
                        รอตรวจสอบ
                      </Badge>
                    )}
                  </TableCell>
                  <PartRowActions id={row.id} price={row.price} isActive={row.isActive} />
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pages > 1 ? (
        <nav aria-label="แบ่งหน้า" className="mt-4 flex items-center justify-between gap-2">
          {page > 1 ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={pageHref(page - 1)}>ก่อนหน้า</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">
            หน้า {page} จาก {pages}
          </span>
          {page < pages ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={pageHref(page + 1)}>ถัดไป</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}

export default function AdminPartsPage({ searchParams }: PageProps<'/admin/parts'>) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="t-h1">จัดการอะไหล่</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/admin/parts/review">
              <ClipboardCheck />
              ตรวจสเปก
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/admin/parts/import">
              <FileUp />
              นำเข้า CSV
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/parts/new">
              <Plus />
              เพิ่มอะไหล่
            </Link>
          </Button>
        </div>
      </div>
      <Suspense fallback={<Skeleton className="mt-4 h-96 rounded-lg" />}>
        <PartsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
