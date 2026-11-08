import { ArrowRight, ClipboardCheck, Cpu, MousePointerClick, Share2, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { BuildCardView } from '@/components/community/build-card';
import { PartImage } from '@/components/parts/part-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { USAGE_LABELS } from '@/lib/builder/types';
import type { UsageType } from '@/lib/compat';
import { formatBaht } from '@/lib/parts/catalog';
import { CATEGORY_LABELS } from '@/lib/parts/spec-fields';
import { listCommunityBuilds } from '@/server/queries/community';
import { getNewestParts } from '@/server/queries/parts';

export const metadata: Metadata = {
  title: 'BuildCheck · จัดสเปกคอมพร้อมเช็กความเข้ากันได้',
  description:
    'เลือกอะไหล่คอมทีละชิ้น ระบบบอกทันทีว่าใส่กันได้ไหม ไฟพอไหม และราคารวมเท่าไหร่ หรือใส่งบให้ระบบจัดให้ 3 ตัวเลือก',
};

// หน้าแรก (หัวข้อ 5.1): ภาพเปิดพร้อมปุ่มเริ่มจัดสเปก ช่องใส่งบด่วน สเปกยอดนิยมสัปดาห์นี้ อะไหล่มาใหม่ วิธีใช้ 3 ขั้นตอน
// ข้อมูลทั้งหมดอยู่ในแคช หน้านี้จึงสร้างล่วงหน้าได้ โหลดเร็วตามเป้า LCP ในหัวข้อ 9.2

const STEPS = [
  {
    icon: MousePointerClick,
    title: 'เลือกอะไหล่ทีละหมวด',
    body: 'หน้าต่างเลือกกรองเฉพาะชิ้นที่ใส่กับสเปกได้ให้อัตโนมัติ หรือใส่งบให้ระบบจัดให้',
  },
  {
    icon: ClipboardCheck,
    title: 'ดูผลตรวจทันที',
    body: 'ระบบตรวจ 18 กฎ บอกว่าชิ้นไหนใส่กันไม่ได้ ทำไม และควรเปลี่ยนเป็นอะไร พร้อมเกจกำลังไฟ',
  },
  {
    icon: Share2,
    title: 'บันทึกและแชร์',
    body: 'ส่งลิงก์หรือ QR ให้เพื่อนหรือร้านดู ให้คนในชุมชนช่วยโหวตและคอมเมนต์',
  },
];

async function PopularBuilds() {
  const { items } = await listCommunityBuilds({ tab: 'week', page: 1 });
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
        ยังไม่มีสเปกสาธารณะ เป็นคนแรกที่แชร์สเปกของคุณ
      </p>
    );
  }
  return (
    <ul className="grid gap-4 xl:grid-cols-3 sm:grid-cols-2">
      {items.slice(0, 6).map((build) => (
        <li key={build.id}>
          <BuildCardView build={build} />
        </li>
      ))}
    </ul>
  );
}

async function NewParts() {
  const items = await getNewestParts(8);
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((part) => (
        <li key={part.id}>
          <Link
            href={`/parts/${part.categorySlug}/${part.slug}`}
            className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-3 hover:border-border-strong hover:shadow-md"
          >
            <PartImage
              src={part.imageUrl}
              alt={`${part.brandName} ${part.model}`}
              category={part.categorySlug}
              size={96}
              className="h-24 w-full"
            />
            <span className="text-xs text-muted-foreground">
              {CATEGORY_LABELS[part.categorySlug]}
            </span>
            <span className="line-clamp-2 text-sm font-medium">
              {part.brandName} {part.model}
            </span>
            <span className="mt-auto font-mono text-sm font-semibold">
              {formatBaht(part.price)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function HomePage() {
  return (
    <main>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid w-full max-w-[1328px] gap-8 px-4 py-10 md:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-16">
          <div>
            {/* ภาษาไทยไม่มีช่องว่างระหว่างคำ จึงกันคำสำคัญไม่ให้ถูกตัดกลางบรรทัด */}
            <h1 className="t-display">
              จัดสเปกคอมให้<span className="whitespace-nowrap">ใส่กันได้จริง</span>{' '}
              <span className="whitespace-nowrap">ตั้งแต่ครั้งแรก</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              เลือกอะไหล่ทีละชิ้น BuildCheck บอกทันทีว่าใส่กันได้ไหม ไฟพอไหม และราคารวมเท่าไหร่
              พร้อมวิธีแก้เป็นภาษาไทย ไม่ขายของ ไม่ต้องสมัครก็ใช้ได้
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/builder">
                  <Cpu aria-hidden />
                  เริ่มจัดสเปก
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/guide">อ่านคู่มือ</Link>
              </Button>
            </div>
          </div>

          <form
            action="/budget"
            className="flex flex-col gap-3 self-start rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Wallet aria-hidden className="size-5 text-link" />
              มีงบเท่าไหร่ ให้ระบบจัดให้
            </h2>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              งบประมาณ (บาท)
              <Input
                name="budget"
                inputMode="numeric"
                defaultValue="40000"
                required
                pattern="[0-9,]*"
                className="font-mono"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              ใช้ทำอะไร
              <NativeSelect name="usage" defaultValue="gaming">
                {(Object.keys(USAGE_LABELS) as UsageType[]).map((usage) => (
                  <option key={usage} value={usage}>
                    {USAGE_LABELS[usage]}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <Button type="submit">
              จัดสเปก 3 ตัวเลือก
              <ArrowRight aria-hidden />
            </Button>
          </form>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-[1328px] flex-col gap-12 px-4 py-10 md:px-6">
        <section aria-labelledby="steps-title">
          <h2 id="steps-title" className="mb-4 t-h2">
            ใช้งานง่าย 3 ขั้นตอน
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-xl border border-border bg-card p-5">
                <span className="flex items-center gap-2 text-sm font-medium text-link">
                  <step.icon aria-hidden className="size-5" />
                  ขั้นที่ {index + 1}
                </span>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="popular-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2 id="popular-title" className="t-h2">
              สเปกยอดนิยมสัปดาห์นี้
            </h2>
            <Link href="/builds?tab=week" className="text-sm font-medium text-link hover:underline">
              ดูทั้งหมด
            </Link>
          </div>
          <Suspense fallback={<Skeleton className="h-48" />}>
            <PopularBuilds />
          </Suspense>
        </section>

        <section aria-labelledby="new-parts-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2 id="new-parts-title" className="t-h2">
              อะไหล่มาใหม่
            </h2>
            <Link href="/parts" className="text-sm font-medium text-link hover:underline">
              ดูคลังอะไหล่
            </Link>
          </div>
          <Suspense fallback={<Skeleton className="h-48" />}>
            <NewParts />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
