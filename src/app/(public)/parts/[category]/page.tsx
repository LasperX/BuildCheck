import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { PartCatalog } from '@/components/parts/part-catalog';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORY_LABELS, CATEGORY_SLUGS, isCategorySlug } from '@/lib/parts/spec-fields';
import { getDefaultParts, getPartFacets } from '@/server/queries/parts';

// หมวดมีจำนวนคงที่ จึงสร้างหน้าไว้ล่วงหน้าได้
export function generateStaticParams() {
  return CATEGORY_SLUGS.map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: PageProps<'/parts/[category]'>): Promise<Metadata> {
  const { category } = await params;
  if (!isCategorySlug(category)) return { title: 'ไม่พบหมวด · BuildCheck' };
  return {
    title: `${CATEGORY_LABELS[category]} · คลังอะไหล่ BuildCheck`,
    description: `ค้นหา กรอง และเปรียบเทียบ${CATEGORY_LABELS[category]} พร้อมสเปกและราคาอ้างอิง`,
  };
}

// อ่าน params ภายใน <Suspense> เพื่อให้กดเปลี่ยนหมวดแล้วเห็นโครงหน้าทันที ระหว่างรอข้อมูลหมวดใหม่
export default function CategoryPage({ params }: PageProps<'/parts/[category]'>) {
  return (
    <Suspense fallback={<CategorySkeleton />}>
      <CategoryContent params={params} />
    </Suspense>
  );
}

function CategorySkeleton() {
  return (
    <main className="mx-auto w-full max-w-[1328px] px-4 py-4 md:px-6">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 mb-4 h-8 w-56" />
      <Skeleton className="h-[110svh] rounded-lg" />
    </main>
  );
}

async function CategoryContent({ params }: Pick<PageProps<'/parts/[category]'>, 'params'>) {
  const { category } = await params;
  if (!isCategorySlug(category)) notFound();
  const [facets, initial] = await Promise.all([getPartFacets(category), getDefaultParts(category)]);

  return (
    <main className="mx-auto w-full max-w-[1328px] px-4 py-4 md:px-6">
      <nav aria-label="เส้นทาง" className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/parts" className="hover:underline">
          คลังอะไหล่
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <span aria-current="page">{CATEGORY_LABELS[category]}</span>
      </nav>
      <h1 className="mt-1 mb-4 t-h1">{CATEGORY_LABELS[category]}</h1>
      {/* สูงเกินจอไว้ก่อน แถบล่างของเว็บจะไม่ขึ้นมาแล้วถูกดันลงตอนรายการโหลดเสร็จ (Lighthouse CLS) */}
      <Suspense fallback={<Skeleton className="h-[110svh] rounded-lg" />}>
        <PartCatalog key={category} category={category} facets={facets} initial={initial} />
      </Suspense>
    </main>
  );
}
