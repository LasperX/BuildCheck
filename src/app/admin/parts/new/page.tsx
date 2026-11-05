import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { PartForm } from '@/components/admin/part-form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORY_LABELS, CATEGORY_SLUGS, isCategorySlug } from '@/lib/parts/spec-fields';
import { requireAdmin } from '@/lib/session';
import { listBrands } from '@/server/queries/admin-parts';

export const metadata: Metadata = { title: 'เพิ่มอะไหล่ · BuildCheck' };

async function NewPartContent({
  searchParams,
}: {
  searchParams: PageProps<'/admin/parts/new'>['searchParams'];
}) {
  await requireAdmin();
  const { category } = await searchParams;
  const selected = isCategorySlug(category) ? category : null;

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="เลือกหมวด">
        {CATEGORY_SLUGS.map((slug) => (
          <Button
            key={slug}
            asChild
            size="sm"
            variant={slug === selected ? 'default' : 'secondary'}
          >
            <Link href={`/admin/parts/new?category=${slug}`} aria-current={slug === selected}>
              {CATEGORY_LABELS[slug]}
            </Link>
          </Button>
        ))}
      </div>
      <div className="mt-4">
        {selected ? (
          // key ทำให้ฟอร์มเริ่มใหม่เมื่อเปลี่ยนหมวด ค่าของหมวดเดิมจะไม่ค้าง
          <PartForm key={selected} category={selected} brands={await listBrands()} />
        ) : (
          <p className="text-muted-foreground">เลือกหมวดของอะไหล่ที่จะเพิ่ม</p>
        )}
      </div>
    </>
  );
}

export default function NewPartPage({ searchParams }: PageProps<'/admin/parts/new'>) {
  return (
    <>
      <h1 className="t-h1">เพิ่มอะไหล่</h1>
      <Suspense fallback={<Skeleton className="mt-4 h-96 rounded-lg" />}>
        <NewPartContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
