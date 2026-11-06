'use client';

import { AlertTriangle, CheckCircle2, ClipboardList, Info, Scale } from 'lucide-react';
import { useId, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  BUYING_CHECKLIST,
  CONFIDENCE_LABELS,
  GRADE_LABELS,
  SOURCE_LABELS,
  type UsedStatView,
  VERDICT_LABELS,
} from '@/lib/builder/used-types';
import type { BuilderPart } from '@/lib/builder/types';
import { assessOffer, type OfferVerdict, USED_GRADES, type UsedGrade } from '@/lib/compat';
import { formatBaht } from '@/lib/parts/catalog';
import { cn } from '@/lib/utils';
import type { BuildItem } from '@/stores/builder-store';

// สวิตช์มือหนึ่ง/มือสอง เกรด และช่องราคาที่เจอจริง ในทุกช่องอะไหล่ (หัวข้อ 3.11)

type Patch = Partial<Pick<BuildItem, 'condition' | 'offeredPrice' | 'warrantyMonthsLeft'>>;

const VERDICT_UI: Record<OfferVerdict, { icon: typeof Info; className: string }> = {
  suspicious: { icon: AlertTriangle, className: 'border-err-border bg-err-soft text-err-fg' },
  cheap: { icon: CheckCircle2, className: 'border-ok-border bg-ok-soft text-ok-fg' },
  fair: { icon: Scale, className: 'border-border bg-surface-2 text-foreground' },
  expensive: { icon: Info, className: 'border-warn-border bg-warn-soft text-warn-fg' },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

/** ข้อความราคากลาง: ราคา ช่วงราคา จำนวนรายงาน วันที่ และป้ายความน่าเชื่อถือ */
export function UsedPriceLine({ stat }: { stat: UsedStatView }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>
        ราคากลาง <b className="font-mono text-foreground">{formatBaht(stat.median)}</b>
      </span>
      {stat.p25 !== null && stat.p75 !== null && (
        <span>
          ช่วงที่พบบ่อย{' '}
          <span className="font-mono">
            {formatBaht(stat.p25)}–{formatBaht(stat.p75)}
          </span>
        </span>
      )}
      {stat.reportCount > 0 && <span>{stat.reportCount} รายงาน</span>}
      <span>อัปเดต {formatDate(stat.updatedAt)}</span>
      <Badge
        variant={
          stat.confidence === 'high' ? 'ok' : stat.confidence === 'medium' ? 'used' : 'neutral'
        }
        title={SOURCE_LABELS[stat.source]}
      >
        {CONFIDENCE_LABELS[stat.confidence]}
      </Badge>
      <span className="sr-only">{SOURCE_LABELS[stat.source]}</span>
    </p>
  );
}

export function UsedControls({
  item,
  part,
  onUpdate,
}: {
  item: BuildItem;
  part: BuilderPart | undefined;
  onUpdate: (patch: Patch) => void;
}) {
  const id = useId();
  const condition = item.condition;
  const used = condition !== 'new';
  const grade: UsedGrade = condition === 'new' ? 'B' : condition;
  const stat = part?.used?.[grade];
  // พิมพ์ราคาเก็บไว้ในช่องก่อน แล้วค่อยบันทึกเมื่อออกจากช่อง ประวัติย้อนกลับจะได้ไม่เก็บทุกตัวอักษร
  const [offered, setOffered] = useState(item.offeredPrice?.toString() ?? '');
  const [warranty, setWarranty] = useState(item.warrantyMonthsLeft?.toString() ?? '');

  const commitNumber = (text: string, key: 'offeredPrice' | 'warrantyMonthsLeft', max: number) => {
    const value = text.trim() === '' ? null : Math.round(Number(text));
    const next =
      value === null || (Number.isFinite(value) && value >= 0 && value <= max) ? value : null;
    if (next !== item[key]) onUpdate({ [key]: next });
  };

  const verdict = stat && item.offeredPrice ? assessOffer(item.offeredPrice, stat.median) : null;
  const VerdictIcon = verdict ? VERDICT_UI[verdict.verdict].icon : null;

  return (
    <div className="mt-2 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label={`สภาพของ ${part?.model ?? 'อะไหล่'}`}
          className="flex rounded-lg border border-border p-0.5 text-xs"
        >
          {(['new', ...USED_GRADES] as const).map((value) => {
            const active = item.condition === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                title={
                  value === 'new'
                    ? 'มือหนึ่ง'
                    : `มือสอง เกรด ${value}: ${GRADE_LABELS[value].detail}`
                }
                onClick={() => !active && onUpdate({ condition: value })}
                className={cn(
                  'rounded-md px-2 py-1 font-medium transition-colors',
                  active
                    ? value === 'new'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-used text-white'
                    : 'text-muted-foreground hover:bg-surface-2',
                )}
              >
                {value === 'new' ? 'มือหนึ่ง' : `มือสอง ${value}`}
              </button>
            );
          })}
        </div>
        {used && (
          <span className="text-xs text-muted-foreground">{GRADE_LABELS[grade].detail}</span>
        )}
      </div>

      {used && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-used-border bg-used-soft/50 p-3">
          {stat ? (
            <UsedPriceLine stat={stat} />
          ) : (
            <p className="text-xs text-muted-foreground">กำลังโหลดราคากลาง…</p>
          )}
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
            <div>
              <label htmlFor={`${id}-offered`} className="text-xs font-medium">
                ราคาที่เจอจริง (บาท)
              </label>
              <Input
                id={`${id}-offered`}
                inputMode="numeric"
                placeholder={
                  stat ? `เช่น ${stat.median.toLocaleString('th-TH')}` : 'ราคาที่ผู้ขายเสนอ'
                }
                value={offered}
                onChange={(event) => setOffered(event.target.value.replace(/[^\d]/g, ''))}
                onBlur={() => commitNumber(offered, 'offeredPrice', 1_000_000)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitNumber(offered, 'offeredPrice', 1_000_000);
                }}
                className="h-9 bg-surface font-mono"
              />
            </div>
            <div>
              <label htmlFor={`${id}-warranty`} className="text-xs font-medium">
                ประกันเหลือ (เดือน)
              </label>
              <Input
                id={`${id}-warranty`}
                inputMode="numeric"
                placeholder="ไม่ทราบ"
                value={warranty}
                onChange={(event) => setWarranty(event.target.value.replace(/[^\d]/g, ''))}
                onBlur={() => commitNumber(warranty, 'warrantyMonthsLeft', 120)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitNumber(warranty, 'warrantyMonthsLeft', 120);
                }}
                className="h-9 bg-surface font-mono"
              />
            </div>
          </div>
          {verdict && VerdictIcon && (
            <p
              role="status"
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm',
                VERDICT_UI[verdict.verdict].className,
              )}
            >
              <VerdictIcon aria-hidden className="size-4 shrink-0" />
              <span>
                <b>{VERDICT_LABELS[verdict.verdict]}</b> · {Math.round(verdict.ratio * 100)}%
                ของราคากลาง
              </span>
            </p>
          )}
          {part && (
            <details className="text-sm">
              <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-used-fg">
                <ClipboardList aria-hidden className="size-3.5" />
                เช็กลิสต์ก่อนซื้อ
              </summary>
              <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                {BUYING_CHECKLIST[part.categorySlug].map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/** ราคาต่อชิ้นที่แสดงในช่อง: มือสองใช้ราคาที่เจอจริง ถ้าไม่ได้กรอกใช้ราคากลาง */
export function slotUnitPrice(item: BuildItem, part: BuilderPart): number {
  if (item.condition === 'new') return part.price;
  return item.offeredPrice ?? part.used?.[item.condition].median ?? part.price;
}
