import { ImageIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import {
  RecomputeButton,
  ReviewButtons,
  SurveyCsvImport,
  SurveyForm,
  UsedSettingsForm,
} from '@/components/admin/used-admin';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CHANNEL_LABELS, REPORT_TYPE_LABELS } from '@/lib/builder/used-types';
import { assessOffer } from '@/lib/compat';
import { formatBaht } from '@/lib/parts/catalog';
import { CATEGORY_LABELS } from '@/lib/parts/spec-fields';
import { requireAdmin } from '@/lib/session';
import { getSystemConfig } from '@/server/queries/settings';
import {
  getPendingReports,
  getRecentSurveys,
  getUsedOnlyMissingSurvey,
} from '@/server/queries/used';
import { todayInThailand } from '@/server/used/stats';

export const metadata: Metadata = { title: 'จัดการราคามือสอง · BuildCheck' };

// /admin/used-prices (หัวข้อ 5.4): คิวรายงานรออนุมัติ ราคากลางที่สำรวจเอง และค่าเสื่อมต่อหมวด

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });

async function UsedAdminContent() {
  await requireAdmin();
  const today = todayInThailand();
  const [pending, surveys, config, missing] = await Promise.all([
    getPendingReports(),
    getRecentSurveys(),
    getSystemConfig(),
    getUsedOnlyMissingSurvey(today),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="queue-title"
        className="rounded-xl border border-border bg-card p-4"
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="queue-title" className="text-lg font-semibold">
              รายงานรออนุมัติ <span className="font-mono">({pending.length})</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              เรียงจากเก่าสุด เทียบกับราคากลางปัจจุบัน รายงานที่ต่ำกว่า 60% ควรตรวจรูปหลักฐานก่อน
            </p>
          </div>
          <RecomputeButton />
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มีรายงานรออนุมัติ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="py-2 text-left font-normal">
                    รุ่น
                  </th>
                  <th scope="col" className="py-2 text-left font-normal">
                    รายละเอียด
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    ราคา
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    เทียบราคากลาง
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    <span className="sr-only">ตรวจ</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pending.map((report) => {
                  const ratio =
                    report.median !== null ? assessOffer(report.price, report.median) : null;
                  return (
                    <tr key={report.id} className="border-b border-border align-top last:border-0">
                      <td className="py-3 pr-3">
                        <p className="text-xs text-muted-foreground">
                          {CATEGORY_LABELS[report.categorySlug]} · เกรด {report.grade}
                        </p>
                        <Link
                          href={`/parts/${report.categorySlug}/${report.slug}`}
                          className="font-medium hover:underline"
                        >
                          {report.brandName} {report.model}
                        </Link>
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">
                        <p>
                          {REPORT_TYPE_LABELS[report.reportType]} · {CHANNEL_LABELS[report.channel]}
                          {report.province ? ` · ${report.province}` : ''}
                        </p>
                        <p>
                          เห็นเมื่อ {formatDate(report.seenAt)} · ประกันเหลือ{' '}
                          {report.warrantyMonthsLeft} เดือน
                        </p>
                        <p>โดย {report.reporterName ?? 'บัญชีที่ลบแล้ว'}</p>
                        {report.proofImageUrl && (
                          <a
                            href={report.proofImageUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="mt-1 inline-flex items-center gap-1 text-link hover:underline"
                          >
                            <ImageIcon aria-hidden className="size-3.5" />
                            ดูรูปหลักฐาน
                          </a>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono font-semibold">
                        {formatBaht(report.price)}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        {ratio && report.median !== null ? (
                          <>
                            <Badge
                              variant={
                                ratio.verdict === 'suspicious'
                                  ? 'err'
                                  : ratio.verdict === 'expensive'
                                    ? 'warn'
                                    : 'neutral'
                              }
                              className="font-mono"
                            >
                              {Math.round(ratio.ratio * 100)}%
                            </Badge>
                            <p className="mt-1 font-mono text-xs text-muted-foreground">
                              กลาง {formatBaht(report.median)}
                            </p>
                          </>
                        ) : (
                          '–'
                        )}
                      </td>
                      <td className="py-3">
                        <ReviewButtons
                          id={report.id}
                          label={`${report.model} ${formatBaht(report.price)}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {missing.length > 0 ? (
        <section
          aria-labelledby="missing-title"
          className="rounded-xl border border-warn-border bg-warn-soft p-4"
        >
          <h2 id="missing-title" className="mb-1 text-lg font-semibold">
            รุ่นที่มีแต่มือสอง แต่ยังไม่มีราคาสำรวจ ({missing.length})
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            รุ่นพวกนี้ซื้อมือหนึ่งไม่ได้แล้ว ถ้ายังไม่มีรายงานหรือราคาสำรวจ
            ระบบจะประมาณจากราคาตอนเปิดตัว ซึ่งอาจคลาดจากตลาดจริงมาก
            ควรบันทึกราคาสำรวจในฟอร์มด้านล่าง
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {missing.map((part) => (
              <li key={part.partId} className="rounded-md border border-border bg-card px-2.5 py-1">
                <span className="text-xs text-muted-foreground">
                  {CATEGORY_LABELS[part.categorySlug]} ·{' '}
                </span>
                {part.brandName} {part.model}
                {part.releaseYear ? (
                  <span className="text-xs text-muted-foreground"> ({part.releaseYear})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section
          aria-labelledby="survey-title"
          className="rounded-xl border border-border bg-card p-4"
        >
          <h2 id="survey-title" className="mb-1 text-lg font-semibold">
            บันทึกราคาที่สำรวจตลาดเอง
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            ใช้เป็นราคากลางเมื่อรายงานของรุ่นและเกรดนั้นยังไม่ถึง 3 รายการ และสำรวจไว้ไม่เกิน 90 วัน
          </p>
          <SurveyForm today={today} />
          <h3 className="mt-6 mb-2 border-t border-border pt-4 text-sm font-semibold">
            นำเข้าหลายรุ่นพร้อมกันจากไฟล์ CSV
          </h3>
          <SurveyCsvImport />
        </section>

        <section
          aria-labelledby="settings-title"
          className="rounded-xl border border-border bg-card p-4"
        >
          <h2 id="settings-title" className="mb-1 text-lg font-semibold">
            สูตรประมาณค่าเสื่อม
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            ราคามือสอง = ราคาใหม่ × r<sup>ปี</sup> × k ใช้เมื่อไม่มีรายงานและไม่มีราคาสำรวจ
          </p>
          <UsedSettingsForm settings={config.used} legacySockets={config.engine.legacySockets} />
        </section>
      </div>

      <section
        aria-labelledby="surveys-title"
        className="rounded-xl border border-border bg-card p-4"
      >
        <h2 id="surveys-title" className="mb-3 text-lg font-semibold">
          ราคาสำรวจล่าสุด
        </h2>
        {surveys.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีราคาสำรวจ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="py-2 text-left font-normal">
                    วันที่
                  </th>
                  <th scope="col" className="py-2 text-left font-normal">
                    รุ่น
                  </th>
                  <th scope="col" className="py-2 text-left font-normal">
                    เกรด
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    ช่วงราคา
                  </th>
                  <th scope="col" className="py-2 text-left font-normal">
                    แหล่ง
                  </th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((survey) => (
                  <tr key={survey.id} className="border-b border-border last:border-0">
                    <td className="py-2 whitespace-nowrap text-muted-foreground">
                      {formatDate(survey.surveyedAt)}
                    </td>
                    <td className="py-2">
                      {survey.brandName} {survey.model}
                    </td>
                    <td className="py-2">{survey.grade}</td>
                    <td className="py-2 text-right font-mono">
                      {formatBaht(survey.minPrice)}–{formatBaht(survey.maxPrice)}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {survey.sourceNote ?? '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminUsedPricesPage() {
  return (
    <>
      <h1 className="mb-4 t-h1">จัดการราคามือสอง</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <UsedAdminContent />
      </Suspense>
    </>
  );
}
