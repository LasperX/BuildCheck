'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatBaht } from '@/lib/parts/catalog';

type Point = { price: number; date: string };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'Asia/Bangkok',
  });

/** กราฟเส้นชุดเดียว: เส้น 2 px พื้นจาง 10% มี Tooltip และตารางสำรองสำหรับโปรแกรมอ่านหน้าจอ */
export function PriceHistoryChart({ points }: { points: Point[] }) {
  return (
    <>
      <div role="img" aria-label="กราฟประวัติราคาอ้างอิง" className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fill: 'var(--text-3)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              tickLine={false}
              minTickGap={32}
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
              formatter={(value) => [formatBaht(Number(value)), 'ราคาอ้างอิง']}
              labelFormatter={(label) => formatDate(String(label))}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
            <Area
              type="linear"
              dataKey="price"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="var(--chart-1)"
              fillOpacity={0.1}
              dot={{ r: 3, fill: 'var(--chart-1)', strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-link">ดูเป็นตาราง</summary>
        <table className="mt-2 w-full max-w-sm">
          <tbody>
            {[...points].reverse().map((point) => (
              <tr key={point.date} className="border-b border-border last:border-0">
                <td className="py-1.5 text-muted-foreground">{formatDate(point.date)}</td>
                <td className="py-1.5 text-right font-mono">{formatBaht(point.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
