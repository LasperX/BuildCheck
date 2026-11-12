import { MailWarning } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { UsedReportForm } from '@/components/used/report-form';
import { Skeleton } from '@/components/ui/skeleton';
import { requireUser } from '@/lib/session';
import { canUseCommunity } from '@/lib/email-verification';
import { getEngineParts } from '@/server/queries/engine-parts';
import { todayInThailand } from '@/server/used/stats';

export const metadata: Metadata = {
  title: 'รายงานราคามือสอง · BuildCheck',
  robots: { index: false },
};

// /used/report สำหรับสมาชิก (Proxy ส่งผู้เยี่ยมชมไปหน้าเข้าสู่ระบบก่อน และหน้านี้ตรวจซ้ำ)

async function ReportContent({
  searchParams,
}: {
  searchParams: PageProps<'/used/report'>['searchParams'];
}) {
  const user = await requireUser();
  const raw = (await searchParams).part;
  const partId = Number(Array.isArray(raw) ? raw[0] : raw);
  const [part] = Number.isInteger(partId) && partId > 0 ? await getEngineParts([partId]) : [];

  if (!canUseCommunity(user)) {
    return (
      <div className="mt-5 flex max-w-2xl items-start gap-3 rounded-xl border border-warn-border bg-warn-soft p-4">
        <MailWarning aria-hidden className="mt-0.5 size-5 shrink-0 text-warn-fg" />
        <p className="text-sm">
          กรุณายืนยันอีเมลก่อนรายงานราคา เพื่อกันสแปมราคา{' '}
          <Link href="/me/settings" className="text-link underline">
            ไปที่ตั้งค่าบัญชี
          </Link>
        </p>
      </div>
    );
  }

  return (
    <UsedReportForm
      today={todayInThailand()}
      initialPart={
        part?.isActive
          ? {
              id: part.id,
              model: part.model,
              brandName: part.brandName,
              categorySlug: part.categorySlug,
              price: part.price,
            }
          : null
      }
    />
  );
}

export default function UsedReportPage({ searchParams }: PageProps<'/used/report'>) {
  return (
    <main className="container mx-auto px-4 py-6">
      <h1 className="t-h1">รายงานราคามือสอง</h1>
      <p className="mt-1 max-w-2xl text-muted-foreground">
        บอกราคาที่คุณเห็นประกาศหรือซื้อขายจริง แอดมินจะตรวจก่อนนำไปคำนวณราคากลาง
        ระบบไม่แสดงชื่อผู้รายงานบนหน้าสาธารณะ
      </p>
      <Suspense fallback={<Skeleton className="mt-5 h-96 max-w-2xl" />}>
        <ReportContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
