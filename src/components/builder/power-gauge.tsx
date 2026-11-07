import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';

import type { PowerResult } from '@/lib/compat';
import { cn } from '@/lib/utils';

// เกจกำลังไฟครึ่งวงกลม (หัวข้อ 4.3 และมติ Q2)
// เขียว: เผื่อไฟได้ตามค่าตั้งระบบ (ค่าตั้งต้น 30% = โหลดไม่เกิน 76.9%) · เหลือง: เผื่อไม่ถึงแต่ไม่เกิน 100% · แดง: เกิน 100%

const STROKE = {
  none: 'var(--color-border-strong)',
  ok: 'var(--color-ok)',
  warning: 'var(--color-warn)',
  error: 'var(--color-err)',
} as const;

const R = 80;
const ARC = Math.PI * R; // ความยาวเส้นครึ่งวงกลม

export function PowerGauge({ power }: { power: PowerResult }) {
  const percent = power.load === null ? null : Math.round(power.load * 100);
  const fill = Math.min(power.load ?? 0, 1);
  // ข้อความตามค่าเผื่อที่แอดมินตั้ง ไม่เขียนตายตัว
  const headroom = Math.round(power.headroom * 100);

  const status = {
    none: {
      icon: Info,
      text:
        power.totalWatt > 0
          ? `แนะนำ PSU ${power.recommendedWatt} W ขึ้นไป`
          : 'ยังไม่มีอะไหล่ที่ใช้ไฟ',
      cls: 'text-muted-foreground',
    },
    ok: { icon: CircleCheck, text: `กำลังไฟเพียงพอ เผื่อไว้ถึง ${headroom}%`, cls: 'text-ok-fg' },
    warning: {
      icon: TriangleAlert,
      text: `เผื่อไม่ถึง ${headroom}% แนะนำ ${power.recommendedWatt} W`,
      cls: 'text-warn-fg',
    },
    error: {
      icon: CircleX,
      text: `PSU ไม่พอ ต้องการอย่างน้อย ${power.recommendedWatt} W`,
      cls: 'text-err-fg',
    },
  }[power.level];
  const StatusIcon = status.icon;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="meter"
        aria-label="กำลังไฟที่ใช้"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent === null ? 0 : Math.min(percent, 100)}
        aria-valuetext={`${power.totalWatt} วัตต์${power.psuWatt ? ` จาก ${power.psuWatt} วัตต์ คิดเป็น ${percent} เปอร์เซ็นต์` : ''}`}
        className="relative w-full max-w-[220px]"
      >
        <svg viewBox="0 0 200 110" className="w-full" aria-hidden>
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="var(--color-surface-3)"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {fill > 0 && (
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={STROKE[power.level]}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${ARC * fill} ${ARC}`}
              className="transition-[stroke-dasharray] duration-300 motion-reduce:transition-none"
            />
          )}
        </svg>
        <div className="absolute inset-x-0 bottom-1 text-center">
          <div className="font-mono text-2xl font-semibold tabular-nums">
            {power.totalWatt} <small className="text-sm font-normal text-muted-foreground">W</small>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {power.psuWatt ? (
          <>
            ใช้ <b className="font-mono text-foreground">{percent}%</b> ของ PSU {power.psuWatt} W
          </>
        ) : (
          'ยังไม่ได้เลือก PSU'
        )}
      </p>
      <p className={cn('flex items-center gap-1.5 text-sm font-medium', status.cls)}>
        <StatusIcon aria-hidden className="size-4 shrink-0" />
        {status.text}
      </p>
    </div>
  );
}
