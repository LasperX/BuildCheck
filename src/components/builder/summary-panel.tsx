import { Recycle } from 'lucide-react';

import type { CheckResult, Level } from '@/lib/compat';
import { formatBaht } from '@/lib/parts/catalog';
import { cn } from '@/lib/utils';

import { LEVEL_UI, STATUS_UI } from './levels';
import { PowerGauge } from './power-gauge';

/** แผงสรุปด้านข้าง: สถานะรวม ราคา งบ เกจกำลังไฟ จำนวนปัญหา และคะแนน (หัวข้อ 3.3) */
export function SummaryPanel({
  result,
  itemCount,
  budget,
  onJumpToIssues,
}: {
  result: CheckResult;
  itemCount: number;
  budget: number | null;
  onJumpToIssues?: () => void;
}) {
  const status = itemCount === 0 ? null : STATUS_UI[result.status];
  const StatusIcon = status?.icon;
  const { price, power, score, counts } = result;
  const usedPercent = budget ? Math.min((price.total / budget) * 100, 100) : 0;
  const over = budget !== null && price.total > budget;

  return (
    <div className="flex flex-col divide-y divide-border">
      {status && StatusIcon ? (
        <div className={cn('flex items-start gap-3 rounded-t-xl border-b p-4', status.soft)}>
          <StatusIcon aria-hidden className={cn('size-7 shrink-0', status.text)} />
          <div>
            <h2 className="font-semibold">{status.title}</h2>
            <p className="text-sm text-muted-foreground">{status.body}</p>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <h2 className="font-semibold">สรุปสเปก</h2>
          <p className="text-sm text-muted-foreground">เลือกอะไหล่แล้วผลจะแสดงที่นี่</p>
        </div>
      )}

      <div className="flex flex-col gap-3 p-4">
        <div>
          <p className="text-sm text-muted-foreground">ราคารวม{price.saved > 0 ? 'แบบผสม' : ''}</p>
          <p className="font-mono text-3xl font-semibold tabular-nums">{formatBaht(price.total)}</p>
        </div>
        {price.saved > 0 && (
          <p className="flex items-center justify-between text-sm text-used-fg">
            <span className="flex items-center gap-1.5">
              <Recycle aria-hidden className="size-3.5" />
              ประหยัดกว่าซื้อใหม่ทั้งชุด
            </span>
            <b className="font-mono">{formatBaht(price.saved)}</b>
          </p>
        )}
        {budget !== null && budget > 0 && (
          <div>
            <div
              role="img"
              aria-label={`ใช้งบ ${Math.round((price.total / budget) * 100)}%`}
              className="h-2 overflow-hidden rounded-full bg-surface-3"
            >
              <div
                className={cn('h-full rounded-full', over ? 'bg-err' : 'bg-brand')}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>งบ {formatBaht(budget)}</span>
              <span className={cn(over && 'font-medium text-err-fg')}>
                {over
                  ? `เกินงบ ${formatBaht(price.total - budget)}`
                  : `เหลือ ${formatBaht(budget - price.total)}`}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <PowerGauge power={power} />
      </div>

      <div className="p-4">
        <div className="grid grid-cols-3 gap-2">
          {(['error', 'warning', 'info'] as Level[]).map((level) => {
            const ui = LEVEL_UI[level];
            const Icon = ui.icon;
            const n = counts[level];
            return (
              <a
                key={level}
                href="#issues"
                onClick={onJumpToIssues}
                className={cn(
                  'flex flex-col items-center rounded-lg border px-2 py-2 text-center',
                  n ? ui.soft : 'border-border text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex items-center gap-1 font-mono text-lg font-semibold',
                    n && ui.text,
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                  {n}
                </span>
                <span className="text-xs">{ui.label}</span>
              </a>
            );
          })}
        </div>
        {score.score > 0 && (
          <dl className="mt-3 flex justify-between gap-2 text-xs">
            <div className="flex gap-1">
              <dt className="text-muted-foreground">คะแนนประสิทธิภาพ</dt>
              <dd className="font-mono font-semibold">{score.score}/100</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted-foreground">ความคุ้มค่า</dt>
              <dd className="font-mono font-semibold">{score.value}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
