import type { Metadata } from 'next';
import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { PriceAlertList } from '@/components/used/alert-list';
import { requireUser } from '@/lib/session';
import { getMyPriceAlerts } from '@/server/queries/used';

export const metadata: Metadata = { title: 'เตือนราคาของฉัน · BuildCheck' };

async function AlertsContent() {
  const user = await requireUser();
  // อ่านด้วย id จาก Session เท่านั้น จึงเห็นแค่รายการของตัวเอง
  const alerts = await getMyPriceAlerts(user.id);
  return <PriceAlertList alerts={alerts} />;
}

export default function PriceAlertsPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-6">
      <h1 className="t-h1">เตือนราคาของฉัน</h1>
      <p className="mt-1 text-muted-foreground">
        ระบบตรวจราคากลางมือสองทุกคืนและทุกครั้งที่มีรายงานใหม่
        ถึงราคาที่ตั้งไว้เมื่อไหร่จะแจ้งเตือนทันที
      </p>
      <Suspense fallback={<Skeleton className="mt-5 h-48" />}>
        <AlertsContent />
      </Suspense>
    </main>
  );
}
