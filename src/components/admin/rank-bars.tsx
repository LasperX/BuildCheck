// แท่งแนวนอนเรียงจากมากไปน้อย สีเดียว พร้อมตัวเลขทุกแถว (ใช้แทนกราฟวงกลมตามมติเฟส 8)
// เป็น HTML ล้วน โปรแกรมอ่านหน้าจออ่านได้เป็นรายการ ไม่ต้องมีตารางสำรอง

export function RankBars({
  rows,
  format = (value) => value.toLocaleString('th-TH'),
  showShare = false,
  empty = 'ยังไม่มีข้อมูล',
}: {
  rows: { label: string; value: number; href?: string }[];
  format?: (value: number) => string;
  /** แสดงเปอร์เซ็นต์ของผลรวม เช่นสัดส่วนยี่ห้อ */
  showShare?: boolean;
  empty?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.value), 1);
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((row) => (
        <li
          key={row.label}
          className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-2 text-sm"
        >
          <span className="truncate" title={row.label}>
            {row.href ? (
              <a href={row.href} className="hover:underline">
                {row.label}
              </a>
            ) : (
              row.label
            )}
          </span>
          <span aria-hidden className="h-3 rounded-r-sm bg-surface-2">
            <span
              className="block h-full rounded-r-sm bg-[var(--chart-1)]"
              style={{ width: `${Math.max((row.value / max) * 100, 2)}%` }}
            />
          </span>
          <span className="text-right font-mono text-xs tabular-nums">
            {format(row.value)}
            {showShare && (
              <span className="text-muted-foreground">
                {' '}
                · {Math.round((row.value / total) * 100)}%
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
