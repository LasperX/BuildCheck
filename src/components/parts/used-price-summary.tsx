import { GRADE_LABELS, SOURCE_LABELS, type UsedPriceSet } from '@/lib/builder/used-types';
import { USED_GRADES } from '@/lib/compat';
import { formatBaht } from '@/lib/parts/catalog';
import { cn } from '@/lib/utils';

/**
 * ราคากลางมือสอง 3 เกรดในกล่องราคาของหน้ารายละเอียดอะไหล่
 * เว็บเน้นมือสอง จึงแสดงให้เห็นทันทีโดยไม่ต้องเปิดแท็บ "ราคามือสอง" (แท็บยังมีกราฟและรายงานครบ)
 * เกรด B (ใช้งานปกติ) เน้นไว้ เพราะเป็นสภาพที่เจอบ่อยที่สุดและเป็นค่าที่ใช้จัดตามงบ
 */
export function UsedPriceSummary({ prices }: { prices: UsedPriceSet | null }) {
  if (!prices) {
    return <p className="text-sm text-muted-foreground">ยังไม่มีราคามือสอง</p>;
  }
  const sources = [...new Set(USED_GRADES.map((grade) => prices[grade].source))];
  return (
    <div>
      <p className="text-sm text-muted-foreground">ราคากลางมือสอง</p>
      <dl className="mt-1.5 grid grid-cols-3 gap-1.5">
        {USED_GRADES.map((grade) => (
          <div
            key={grade}
            className={cn(
              'rounded-md px-2 py-1.5',
              grade === 'B' ? 'bg-used-soft ring-1 ring-used-border' : 'bg-surface-2',
            )}
          >
            <dt className="text-2xs text-muted-foreground" title={GRADE_LABELS[grade].detail}>
              เกรด {grade}
            </dt>
            <dd className="font-mono text-sm font-semibold tabular-nums">
              {formatBaht(prices[grade].median)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-1.5 text-2xs text-subtle">
        {sources.map((source) => SOURCE_LABELS[source]).join(' · ')} · รายละเอียดในแท็บราคามือสอง
      </p>
    </div>
  );
}
