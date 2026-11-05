import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { PartCatalog } from '@/components/parts/part-catalog';
import { CATEGORY_ICONS } from '@/components/parts/part-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { isCategorySlug } from '@/lib/parts/spec-fields';
import { getCategoryCounts } from '@/server/queries/parts';

export const metadata: Metadata = {
  title: 'คลังอะไหล่ · BuildCheck',
  description: 'ค้นหาและเปรียบเทียบอะไหล่คอมพิวเตอร์ 8 หมวด พร้อมสเปกและราคาอ้างอิง',
};

async function CategoryGrid() {
  const categories = await getCategoryCounts();
  return (
    <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {categories.map((category) => {
        if (!isCategorySlug(category.slug)) return null;
        const Icon = CATEGORY_ICONS[category.slug];
        return (
          <li key={category.slug}>
            <Link
              href={`/parts/${category.slug}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:border-border-strong hover:shadow-md"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-2 text-muted-foreground">
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{category.nameTh}</span>
                <span className="block font-mono text-xs text-muted-foreground">
                  {category.total} รายการ
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function PartsIndexPage() {
  return (
    <main className="mx-auto w-full max-w-[1328px] px-4 py-6 md:px-6">
      <h1 className="t-h1">คลังอะไหล่</h1>
      <Suspense fallback={<Skeleton className="mt-4 h-40 rounded-lg" />}>
        <CategoryGrid />
      </Suspense>
      <h2 className="mt-8 mb-3 t-h2">ค้นหาอะไหล่ทุกหมวด</h2>
      <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
        <PartCatalog />
      </Suspense>
    </main>
  );
}
