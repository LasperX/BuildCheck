'use client';

import { BellPlus, Megaphone } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import { UsedPriceLine } from '@/components/builder/used-controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CHANNEL_LABELS,
  GRADE_LABELS,
  REPORT_TYPE_LABELS,
  SOURCE_LABELS,
} from '@/lib/builder/used-types';
import { USED_GRADES, type UsedGrade } from '@/lib/compat';
import { formatBaht } from '@/lib/parts/catalog';
import { setPriceAlert } from '@/server/actions/used';
import type { PartUsedDetail } from '@/server/queries/used';

const UsedTrendChart = dynamic(
  () => import('@/components/used/used-trend-chart').then((m) => m.UsedTrendChart),
  { ssr: false, loading: () => <Skeleton className="h-64 rounded-md" /> },
);

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });

/** แท็บราคามือสองในหน้ารายละเอียดอะไหล่ */
export function UsedTab({
  partId,
  detail,
  loggedIn,
}: {
  partId: number;
  detail: PartUsedDetail;
  loggedIn: boolean;
}) {
  const hasTrend = USED_GRADES.some((grade) => detail.trend[grade].length > 0);
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      {detail.prices && (
        <ul className="grid gap-3 md:grid-cols-3">
          {USED_GRADES.map((grade) => {
            const stat = detail.prices?.[grade];
            if (!stat) return null;
            return (
              <li key={grade} className="rounded-lg border border-border bg-surface p-4">
                <p className="text-sm font-semibold">
                  เกรด {grade}{' '}
                  <span className="font-normal text-muted-foreground">
                    · {GRADE_LABELS[grade].detail}
                  </span>
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold">{formatBaht(stat.median)}</p>
                <div className="mt-1">
                  <UsedPriceLine stat={stat} />
                </div>
                <p className="mt-1 text-xs text-subtle">{SOURCE_LABELS[stat.source]}</p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold">แนวโน้มราคากลางรายสัปดาห์ (บาท)</h2>
        {hasTrend ? (
          <UsedTrendChart trend={detail.trend} />
        ) : (
          <p className="text-sm text-muted-foreground">
            ยังไม่มีรายงานจากสมาชิกในช่วง 26 สัปดาห์ ราคาด้านบนจึงมาจากการสำรวจหรือสูตรประมาณการ
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">รายงานล่าสุด</h2>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/used/report?part=${partId}`}>
                <Megaphone aria-hidden />
                รายงานราคาที่เจอ
              </Link>
            </Button>
          </div>
          {detail.latest.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีรายงานที่อนุมัติแล้ว</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="py-2 text-left font-normal">
                      วันที่
                    </th>
                    <th scope="col" className="py-2 text-left font-normal">
                      เกรด
                    </th>
                    <th scope="col" className="py-2 text-left font-normal">
                      ประเภท
                    </th>
                    <th scope="col" className="py-2 text-left font-normal">
                      ช่องทาง
                    </th>
                    <th scope="col" className="py-2 text-right font-normal">
                      ราคา
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.latest.map((report) => (
                    <tr key={report.id} className="border-b border-border last:border-0">
                      <td className="py-2 whitespace-nowrap text-muted-foreground">
                        {formatDate(report.seenAt)}
                      </td>
                      <td className="py-2">{report.grade}</td>
                      <td className="py-2">{REPORT_TYPE_LABELS[report.reportType]}</td>
                      <td className="py-2">
                        {CHANNEL_LABELS[report.channel]}
                        {report.province ? ` · ${report.province}` : ''}
                      </td>
                      <td className="py-2 text-right font-mono">{formatBaht(report.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <PriceAlertForm
          partId={partId}
          loggedIn={loggedIn}
          suggested={detail.prices?.B.median ?? null}
        />
      </div>
    </div>
  );
}

function PriceAlertForm({
  partId,
  loggedIn,
  suggested,
}: {
  partId: number;
  loggedIn: boolean;
  suggested: number | null;
}) {
  const [grade, setGrade] = useState<UsedGrade>('B');
  const [target, setTarget] = useState(suggested ? String(Math.round(suggested * 0.9)) : '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!loggedIn) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="mb-1 flex items-center gap-1.5 font-semibold">
          <BellPlus aria-hidden className="size-4" />
          ตั้งเตือนราคา
        </h2>
        <p className="text-muted-foreground">
          <Link href="/login" className="text-link hover:underline">
            เข้าสู่ระบบ
          </Link>{' '}
          เพื่อรับแจ้งเตือนเมื่อราคากลางมือสองลดถึงราคาที่ตั้งไว้
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await setPriceAlert({ partId, grade, targetPrice: target });
          setMessage(
            result.ok
              ? { ok: true, text: 'ตั้งเตือนแล้ว ดูรายการได้ที่หน้าเตือนราคาของฉัน' }
              : { ok: false, text: result.error },
          );
        });
      }}
    >
      <h2 className="flex items-center gap-1.5 font-semibold">
        <BellPlus aria-hidden className="size-4" />
        ตั้งเตือนราคา
      </h2>
      <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="alert-grade">เกรด</Label>
          <NativeSelect
            id="alert-grade"
            value={grade}
            onChange={(event) => setGrade(event.target.value as UsedGrade)}
          >
            {USED_GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="alert-target">ราคาเป้าหมาย (บาท)</Label>
          <Input
            id="alert-target"
            inputMode="numeric"
            className="font-mono"
            value={target}
            onChange={(event) => setTarget(event.target.value.replace(/[^\d]/g, ''))}
          />
        </div>
      </div>
      <Button type="submit" disabled={pending || !target}>
        {pending ? 'กำลังบันทึก…' : 'แจ้งเตือนเมื่อถึงราคานี้'}
      </Button>
      {message && (
        <p role="status" className={message.ok ? 'text-sm text-ok-fg' : 'text-sm text-err-fg'}>
          {message.text}{' '}
          {message.ok && (
            <Link href="/me/price-alerts" className="text-link underline">
              ไปที่หน้าเตือนราคา
            </Link>
          )}
        </p>
      )}
    </form>
  );
}
