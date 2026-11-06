'use client';

import { BellRing, CircleCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatBaht } from '@/lib/parts/catalog';
import { CATEGORY_LABELS } from '@/lib/parts/spec-fields';
import { deletePriceAlert } from '@/server/actions/used';
import type { AlertRow } from '@/server/queries/used';

/** รายการเตือนราคาของฉัน: รุ่น ราคาเป้าหมาย ราคากลางปัจจุบัน และสถานะ */
export function PriceAlertList({ alerts }: { alerts: AlertRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (alerts.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center">
        <BellRing aria-hidden className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-2 font-medium">ยังไม่ได้ตั้งเตือนราคา</p>
        <p className="mt-1 text-sm text-muted-foreground">
          เปิดหน้ารายละเอียดอะไหล่ แล้วไปที่แท็บ ราคามือสอง เพื่อตั้งราคาที่อยากได้
        </p>
        <Button asChild variant="secondary" className="mt-4">
          <Link href="/used">ไปตลาดมือสอง</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p role="alert" className="mt-4 text-sm text-err-fg">
          {error}
        </p>
      )}
      <ul className="mt-5 flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {alerts.map((alert) => {
          const reached = alert.triggeredAt !== null;
          const gap = alert.current !== null ? alert.current - alert.targetPrice : null;
          return (
            <li key={alert.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {CATEGORY_LABELS[alert.categorySlug]} · เกรด {alert.grade}
                </p>
                <Link
                  href={`/parts/${alert.categorySlug}/${alert.slug}`}
                  className="font-medium hover:underline"
                >
                  {alert.brandName} {alert.model}
                </Link>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 text-sm">
                <dt className="text-xs text-muted-foreground">ราคาเป้าหมาย</dt>
                <dt className="text-xs text-muted-foreground">ราคากลางตอนนี้</dt>
                <dd className="font-mono font-semibold">{formatBaht(alert.targetPrice)}</dd>
                <dd className="font-mono">
                  {alert.current !== null ? formatBaht(alert.current) : '–'}
                </dd>
              </dl>
              {reached ? (
                <Badge variant="ok">
                  <CircleCheck aria-hidden />
                  ถึงราคาแล้ว
                </Badge>
              ) : (
                <Badge variant="neutral">
                  {gap !== null && gap > 0 ? `อีก ${formatBaht(gap)}` : 'รอคำนวณรอบถัดไป'}
                </Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={pending}
                aria-label={`ลบเตือนราคา ${alert.model} เกรด ${alert.grade}`}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deletePriceAlert(alert.id);
                    if (!result.ok) setError(result.error);
                    else router.refresh();
                  })
                }
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
