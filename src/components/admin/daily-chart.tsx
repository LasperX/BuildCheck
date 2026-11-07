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

// กราฟสมาชิกใหม่และสเปกใหม่รายวัน (หัวข้อ 3.10)
// สองเส้นหน่วยเดียวกัน (จำนวน) จึงใช้แกนเดียว สีตามลำดับคงที่ chart-1 / chart-2 (ตรวจกับเครื่องมือตรวจชุดสีแล้ว)
// เส้นสเปกเป็นเส้นประ แยกได้แม้มองไม่เห็นสี มีคำอธิบายเส้นและตารางสำรอง

const SERIES = [
  { key: 'members', label: 'สมาชิกใหม่', color: 'var(--chart-1)', dash: undefined },
  { key: 'builds', label: 'สเปกใหม่', color: 'var(--chart-2)', dash: '6 3' },
] as const;

const formatDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

export function DailyChart({ data }: { data: { day: string; members: number; builds: number }[] }) {
  return (
    <>
      <div role="img" aria-label="กราฟสมาชิกใหม่และสเปกใหม่รายวัน" className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={formatDay}
              tick={{ fill: 'var(--text-3)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              width={40}
              allowDecimals={false}
              tick={{ fill: 'var(--text-3)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              labelFormatter={(label) => formatDay(String(label))}
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
                <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{String(value)}</span>
              )}
            />
            {SERIES.map((series) => (
              <Line
                key={series.key}
                type="linear"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={2}
                strokeDasharray={series.dash}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-link">ดูเป็นตาราง</summary>
        <table className="mt-2 w-full max-w-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="py-1 text-left font-normal">
                วันที่
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                สมาชิกใหม่
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                สเปกใหม่
              </th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((row) => (
              <tr key={row.day} className="border-b border-border last:border-0">
                <td className="py-1 text-muted-foreground">{formatDay(row.day)}</td>
                <td className="py-1 text-right font-mono">{row.members}</td>
                <td className="py-1 text-right font-mono">{row.builds}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
