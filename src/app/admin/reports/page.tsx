import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { ReportActions } from '@/components/admin/admin-actions';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { requireAdmin } from '@/lib/session';
import { REPORT_REASON_LABELS } from '@/lib/validators/community';
import { listReports } from '@/server/queries/admin';

export const metadata: Metadata = { title: 'จัดการรายงาน · BuildCheck' };

// /admin/reports (หัวข้อ 5.2) รายการรายงาน ดูเนื้อหา ซ่อน ปิดรายงาน

const TYPE_LABELS = { build: 'สเปก', comment: 'คอมเมนต์', user: 'ผู้ใช้' } as const;
const STATUS_LABELS = { open: 'รอตรวจ', resolved: 'ซ่อนแล้ว', dismissed: 'ไม่ผิดกติกา' } as const;

async function ReportsContent({
  searchParams,
}: {
  searchParams: PageProps<'/admin/reports'>['searchParams'];
}) {
  await requireAdmin();
  const tab = (await searchParams).tab === 'closed' ? 'closed' : 'open';
  const rows = await listReports(tab);

  return (
    <>
      <nav aria-label="สถานะรายงาน" className="mb-4 flex gap-1">
        {(['open', 'closed'] as const).map((value) => (
          <Link
            key={value}
            href={value === 'open' ? '/admin/reports' : '/admin/reports?tab=closed'}
            aria-current={tab === value ? 'page' : undefined}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-surface-2 aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-soft-fg"
          >
            {value === 'open' ? 'รอตรวจ' : 'จัดการแล้ว'}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
          {tab === 'open' ? 'ไม่มีรายงานรอตรวจ' : 'ยังไม่มีรายงานที่จัดการแล้ว'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((report) => (
            <li
              key={report.id}
              className="flex flex-wrap items-start gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="neutral">{TYPE_LABELS[report.targetType]}</Badge>
                  <Badge variant="warn">{REPORT_REASON_LABELS[report.reason]}</Badge>
                  {report.sameTarget > 1 && (
                    <Badge variant="err">ถูกรายงาน {report.sameTarget} ครั้ง</Badge>
                  )}
                  {tab === 'closed' && <Badge variant="ok">{STATUS_LABELS[report.status]}</Badge>}
                  <span>
                    โดย {report.reporterName ?? 'บัญชีที่ลบแล้ว'} ·{' '}
                    {report.createdAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
                  </span>
                </p>
                {report.preview ? (
                  <p className="mt-2 line-clamp-3 break-words whitespace-pre-line">
                    {report.preview.href ? (
                      <Link href={report.preview.href} className="hover:underline">
                        {report.preview.title}
                      </Link>
                    ) : (
                      report.preview.title
                    )}
                    {report.preview.hidden && (
                      <span className="ml-2 text-xs text-muted-foreground">(ซ่อนอยู่แล้ว)</span>
                    )}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">เนื้อหาถูกลบไปแล้ว</p>
                )}
                {report.detail && (
                  <p className="mt-1 text-sm text-muted-foreground">รายละเอียด: {report.detail}</p>
                )}
              </div>
              {tab === 'open' && (
                <ReportActions
                  reportId={report.id}
                  canHide={report.targetType !== 'user' && Boolean(report.preview)}
                />
              )}
              {tab === 'open' && report.targetType === 'user' && (
                <Link
                  href={`/admin/users?q=${encodeURIComponent(report.targetId)}`}
                  className="self-center text-xs text-link hover:underline"
                >
                  ไปหน้าจัดการผู้ใช้
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function AdminReportsPage({ searchParams }: PageProps<'/admin/reports'>) {
  return (
    <>
      <h1 className="mb-4 t-h1">จัดการรายงาน</h1>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <ReportsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
