import { ChevronRight, CircleCheck, Clock, ExternalLink, Layers } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { AddToBuildButton } from '@/components/parts/add-to-build-button';
import { PartImage } from '@/components/parts/part-icon';
import { PartTabs } from '@/components/parts/part-tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBaht } from '@/lib/parts/catalog';
import { formatSpecValue, SPEC_FIELDS } from '@/lib/parts/spec-fields';
import { getSession } from '@/lib/session';
import { getPartDetail, getPopularBuildsUsingPart } from '@/server/queries/parts';
import { getPartUsedDetail } from '@/server/queries/used';

type Params = PageProps<'/parts/[category]/[slug]'>['params'];

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category, slug } = await params;
  const part = await getPartDetail(category, decodeURIComponent(slug));
  if (!part) return { title: 'ไม่พบอะไหล่ · BuildCheck' };
  return {
    title: `${part.brandName} ${part.model} · BuildCheck`,
    description: `สเปกและราคาอ้างอิงของ ${part.brandName} ${part.model}`,
  };
}

async function PartContent({ params }: { params: Params }) {
  const { category, slug } = await params;
  const part = await getPartDetail(category, decodeURIComponent(slug));
  if (!part) notFound();

  const [builds, used, session] = await Promise.all([
    getPopularBuildsUsingPart(part.id),
    getPartUsedDetail(part.id),
    getSession(),
  ]);
  const specRows = SPEC_FIELDS[part.categorySlug].map((field) => ({
    label: field.label,
    value: formatSpecValue(part.spec[field.key], field.kind),
  }));

  return (
    <>
      <nav
        aria-label="เส้นทาง"
        className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
      >
        <Link href="/parts" className="hover:underline">
          คลังอะไหล่
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <Link href={`/parts/${part.categorySlug}`} className="hover:underline">
          {part.categoryName}
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <span aria-current="page">{part.model}</span>
      </nav>

      <section className="mt-3 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_320px] md:grid-cols-[240px_minmax(0,1fr)]">
        <PartImage
          src={part.imageUrl}
          alt={`รูป ${part.model}`}
          category={part.categorySlug}
          size={320}
          className="h-48 w-full xl:h-70 md:h-56"
        />
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {part.brandName}
            {part.releaseYear ? ` · วางขายปี ${part.releaseYear}` : ''}
          </p>
          <h1 className="t-h1 break-words">{part.model}</h1>
          <div className="mt-2 flex flex-wrap gap-1">
            {part.chips.map((chip) => (
              <span
                key={chip}
                className="inline-flex h-5.5 items-center rounded-xs bg-surface-2 px-1.5 font-mono text-2xs text-muted-foreground"
              >
                {chip}
              </span>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Layers aria-hidden className="size-4" />
            อยู่ในสเปกของสมาชิก <b className="font-mono">{part.usedInBuilds}</b> ชุด
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {part.specVerified ? (
              <Badge variant="ok">
                <CircleCheck aria-hidden />
                ตรวจสเปกแล้ว
              </Badge>
            ) : (
              <Badge variant="warn">
                <Clock aria-hidden />
                สเปกรอตรวจสอบ
              </Badge>
            )}
            {part.specSourceUrl ? (
              <a
                href={part.specSourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline"
              >
                แหล่งอ้างอิงสเปก
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            ) : null}
          </div>
        </div>
        <Card className="xl:col-span-1 md:col-span-2">
          <CardContent className="flex flex-col gap-3">
            <div>
              <p className="text-sm text-muted-foreground">ราคาอ้างอิงล่าสุด</p>
              <p className="text-4xl font-semibold">{formatBaht(part.price)}</p>
              <p className="text-xs text-subtle">อัปเดตโดยแอดมิน · ราคาอ้างอิง ไม่ใช่ราคาขาย</p>
            </div>
            <AddToBuildButton
              partId={part.id}
              categorySlug={part.categorySlug}
              size="lg"
              className="w-full"
            />
          </CardContent>
        </Card>
      </section>

      <PartTabs
        specRows={specRows}
        history={part.history.map((entry) => ({
          price: entry.price,
          date: entry.changedAt.toISOString(),
        }))}
        builds={builds}
        used={{ partId: part.id, detail: used, loggedIn: Boolean(session) }}
      />
    </>
  );
}

export default function PartDetailPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-[1328px] px-4 py-4 md:px-6">
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <PartContent params={params} />
      </Suspense>
    </main>
  );
}
