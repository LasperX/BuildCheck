import { CircleCheck, Clock, FileUp, Plus, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { PartRowActions } from '@/components/admin/part-row-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CATEGORY_LABELS, CATEGORY_SLUGS } from '@/lib/parts/spec-fields';
import { requireAdmin } from '@/lib/session';
import { ADMIN_PAGE_SIZE, listAdminParts } from '@/server/queries/admin-parts';

export const metadata: Metadata = { title: 'จัดการอะไหล่ · BuildCheck' };

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
  const category = one(params.category);
  const page = Math.max(1, Number(one(params.page)) || 1);
  const { rows, total } = await listAdminParts({ q, category, page });
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (category) next.set('category', category);
    next.set('page', String(target));
    return `/admin/parts?${next}`;
  };

  return (
    <>
      <form className="mt-4 flex flex-wrap items-end gap-2" role="search">
        <div className="relative min-w-52 flex-1">
          <Search
            aria-hidden
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
          />
          <Input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="ค้นหาชื่อรุ่นหรือยี่ห้อ"
            aria-label="ค้นหาอะไหล่"
            className="pl-9"
          />
        </div>
        <div className="w-48">
          <NativeSelect name="category" defaultValue={category ?? ''} aria-label="กรองตามหมวด">
            <option value="">ทุกหมวด</option>
            {CATEGORY_SLUGS.map((slug) => (
              <option key={slug} value={slug}>
                {CATEGORY_LABELS[slug]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="secondary">
          ค้นหา
        </Button>
      </form>

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
