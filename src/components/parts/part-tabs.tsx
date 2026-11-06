'use client';

import { ArrowBigUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { Skeleton } from '@/components/ui/skeleton';
import { UsedTab } from '@/components/used/used-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatBaht } from '@/lib/parts/catalog';
import type { PartUsedDetail } from '@/server/queries/used';

// โหลด Recharts เฉพาะตอนเปิดแท็บประวัติราคา เพื่อให้หน้าโหลดครั้งแรกเร็วขึ้น
const PriceHistoryChart = dynamic(
  () => import('@/components/parts/price-history-chart').then((m) => m.PriceHistoryChart),
  { ssr: false, loading: () => <Skeleton className="h-64 rounded-md" /> },
);

export type PricePoint = { price: number; date: string };

type BuildSummary = {
  id: string;
  title: string;
  totalPrice: number;
  voteScore: number;
  ownerName: string;
};

export function PartTabs({
  specRows,
  history,
  builds,
  used,
}: {
  specRows: { label: string; value: string }[];
  history: PricePoint[];
  builds: BuildSummary[];
  used: { partId: number; detail: PartUsedDetail; loggedIn: boolean };
}) {
  return (
    <Tabs defaultValue="spec" className="mt-6">
      <TabsList>
        <TabsTrigger value="spec">สเปกเต็ม</TabsTrigger>
        <TabsTrigger value="history">ประวัติราคา</TabsTrigger>
        <TabsTrigger value="used">ราคามือสอง</TabsTrigger>
        <TabsTrigger value="builds">สเปกที่ใช้ชิ้นนี้</TabsTrigger>
      </TabsList>

      <TabsContent value="spec" className="mt-4">
        <div className="max-w-3xl overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <tbody>
              {specRows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <th scope="row" className="w-2/5 p-3 text-left font-normal text-muted-foreground">
                    {row.label}
                  </th>
                  <td className="p-3 font-mono text-xs break-words">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TabsContent>

      <TabsContent value="history" className="mt-4">
        <div className="max-w-4xl rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-lg font-semibold">ราคาอ้างอิงที่แอดมินบันทึก (บาท)</h2>
          {history.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              {history[0]
                ? `มีราคาเดียวคือ ${formatBaht(history[0].price)} ยังไม่มีการเปลี่ยนแปลง`
                : 'ยังไม่มีประวัติราคา'}
            </p>
          ) : (
            <PriceHistoryChart points={history} />
          )}
        </div>
      </TabsContent>

      <TabsContent value="used" className="mt-4">
        <UsedTab {...used} />
      </TabsContent>

      <TabsContent value="builds" className="mt-4">
        {builds.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีสเปกสาธารณะที่ใช้อะไหล่ชิ้นนี้</p>
        ) : (
          <ul className="grid gap-3 xl:grid-cols-3 md:grid-cols-2">
            {builds.map((build) => (
              <li key={build.id}>
                <Link
                  href={`/builds/${build.id}`}
                  className="block rounded-lg border border-border bg-surface p-4 hover:border-border-strong hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold">{build.title}</h3>
                  <p className="text-xs text-muted-foreground">{build.ownerName}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-semibold">{formatBaht(build.totalPrice)}</span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <ArrowBigUp aria-hidden className="size-4.5" />
                      <span className="font-mono">{build.voteScore}</span>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
