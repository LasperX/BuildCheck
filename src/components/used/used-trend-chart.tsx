'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { UsedGrade } from '@/lib/compat';
import { formatBaht } from '@/lib/parts/catalog';

// กราฟแนวโน้มราคากลางรายสัปดาห์แยกตามเกรด (หัวข้อ 3.11)
// 3 เส้น สีตามลำดับคงที่ A = chart-1, B = chart-2, C = chart-3 (ตรวจกับเครื่องมือตรวจชุดสีแล้ว
// ผ่านทั้งโหมดสว่าง/มืด และผู้ที่ตาบอดสี) มีคำอธิบายเส้นและตารางสำรองเสมอ ไม่ใช้สีอย่างเดียว

type Trend = Record<UsedGrade, { week: string; median: number; count: number }[]>;

const COLORS: Record<UsedGrade, string> = {
  A: 'var(--chart-1)',
  B: 'var(--chart-2)',
  C: 'var(--chart-3)',
};
const DASH: Record<UsedGrade, string | undefined> = { A: undefined, B: '6 3', C: '2 3' };

const formatWeek = (week: string) =>
  new Date(`${week}T00:00:00Z`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

export function UsedTrendChart({ trend }: { trend: Trend }) {
  const grades = (['A', 'B', 'C'] as const).filter((grade) => trend[grade].length > 0);
  const weeks = [...new Set(grades.flatMap((grade) => trend[grade].map((p) => p.week)))].sort();
  const rows = weeks.map((week) => {
    const row: { week: string } & Partial<Record<UsedGrade, number>> = { week };
    for (const grade of grades) {
      const point = trend[grade].find((p) => p.week === week);
      if (point) row[grade] = point.median;
    }
    return row;
  });

  return (
    <>
      <div role="img" aria-label="กราฟแนวโน้มราคากลางมือสองรายสัปดาห์" className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="week"
              tickFormatter={formatWeek}
              tick={{ fill: 'var(--text-3)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              width={64}
              tick={{ fill: 'var(--text-3)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => value.toLocaleString('en-US')}
              domain={['auto', 'auto']}
            />
            <Tooltip
              formatter={(value, name) => [formatBaht(Number(value)), `เกรด ${String(name)}`]}
              labelFormatter={(label) => `สัปดาห์ของ ${formatWeek(String(label))}`}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
            <Legend
              formatter={(value) => (
                <span style={{ color: 'var(--text-2)', fontSize: 13 }}>เกรด {String(value)}</span>
              )}
            />
            {grades.map((grade) => (
              <Line
                key={grade}
                type="linear"
                dataKey={grade}
                name={grade}
                stroke={COLORS[grade]}
                strokeWidth={2}
                strokeDasharray={DASH[grade]}
                dot={{ r: 4, fill: COLORS[grade], stroke: 'var(--surface)', strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-link">ดูเป็นตาราง</summary>
        <table className="mt-2 w-full max-w-md text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="py-1.5 text-left font-normal">
                สัปดาห์
              </th>
              {grades.map((grade) => (
                <th key={grade} scope="col" className="py-1.5 text-right font-normal">
                  เกรด {grade}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((row) => (
              <tr key={row.week} className="border-b border-border last:border-0">
                <td className="py-1.5 text-muted-foreground">{formatWeek(row.week)}</td>
                {grades.map((grade) => (
                  <td key={grade} className="py-1.5 text-right font-mono">
                    {row[grade] ? formatBaht(row[grade]) : '–'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
