import { Boxes, Cpu, Flag, Recycle, UserPlus, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { DailyChart } from '@/components/admin/daily-chart';
import { RankBars } from '@/components/admin/rank-bars';
import { Skeleton } from '@/components/ui/skeleton';
import { USAGE_LABELS } from '@/lib/builder/types';
import { formatBaht } from '@/lib/parts/catalog';
import { CATEGORY_LABELS, CATEGORY_SLUGS, isCategorySlug } from '@/lib/parts/spec-fields';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';
import { getDashboardStats } from '@/server/queries/admin';
import { getUsedMarket } from '@/server/queries/used';

export const metadata: Metadata = { title: 'Dashboard · BuildCheck' };

// Dashboard แอดมิน (หัวข้อ 3.10, 5.2 และส่วนมือสองใน 5.4)

const RANGES = [7, 30, 90] as const;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function Card({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon aria-hidden className="size-4" />
        {label}
      </p>
      <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
        {value.toLocaleString('th-TH')}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="rounded-xl border border-border bg-card p-4 hover:border-border-strong"
    >
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border border-border bg-card p-4">{body}</div>
  );
}

function Panel({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn('rounded-xl border border-border bg-card p-4', className)}
    >
      <h2 id={id} className="mb-3 text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: PageProps<'/admin'>['searchParams'];
}) {
  await requireAdmin();
  const raw = await searchParams;
  const rangeValue = Number(one(raw.range));
  const range = (RANGES as readonly number[]).includes(rangeValue)
    ? (rangeValue as 7 | 30 | 90)
    : 30;
  const catRaw = one(raw.cat);
  const cat = isCategorySlug(catRaw) ? catRaw : 'cpu';
  const [stats, market] = await Promise.all([getDashboardStats(range), getUsedMarket({})]);
  const { cards } = stats;
  const linkWith = (patch: Record<string, string>) =>
    `/admin?${new URLSearchParams({ range: String(range), cat, ...patch })}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 xl:grid-cols-4 sm:grid-cols-2">
        <Card icon={Users} label="สมาชิกทั้งหมด" value={cards.members} />
        <Card
          icon={UserPlus}
          label="สมาชิกใหม่ 7 วัน"
          value={cards.newMembers7}
          hint={`30 วัน: ${cards.newMembers30.toLocaleString('th-TH')} คน`}
        />
        <Card
          icon={Cpu}
          label="สเปกทั้งหมด"
          value={cards.builds}
          hint={`สาธารณะ ${cards.publicBuilds.toLocaleString('th-TH')} ชุด`}
        />
        <Card icon={Boxes} label="อะไหล่ที่ขายอยู่" value={cards.parts} href="/admin/parts" />
        <Card
          icon={Recycle}
          label="รายงานราคามือสองรออนุมัติ"
          value={cards.pendingUsedReports}
          href="/admin/used-prices"
        />
        <Card
          icon={Flag}
          label="รายงานเนื้อหารอตรวจ"
          value={cards.openReports}
          href="/admin/reports"
        />
      </div>

      <Panel id="daily-title" title="สมาชิกใหม่และสเปกใหม่รายวัน">
        <nav aria-label="ช่วงเวลา" className="mb-3 flex gap-1">
          {RANGES.map((value) => (
            <Link
              key={value}
              href={linkWith({ range: String(value) })}
              aria-current={range === value ? 'page' : undefined}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-surface-2 aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-soft-fg"
            >
              {value} วัน
            </Link>
          ))}
        </nav>
        <DailyChart data={stats.daily} />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel id="top-parts-title" title="อะไหล่ที่ถูกเลือกบ่อย 10 อันดับ">
          <nav aria-label="หมวด" className="mb-3 flex flex-wrap gap-1">
            {CATEGORY_SLUGS.map((slug) => (
              <Link
                key={slug}
                href={linkWith({ cat: slug })}
                aria-current={cat === slug ? 'page' : undefined}
                className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-surface-2 aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-soft-fg"
              >
                {CATEGORY_LABELS[slug]}
              </Link>
            ))}
          </nav>
          <RankBars
            rows={stats.topParts[cat].map((part) => ({ label: part.name, value: part.uses }))}
            format={(value) => `${value} สเปก`}
            empty="ยังไม่มีสเปกที่ใช้อะไหล่หมวดนี้"
          />
        </Panel>

        <Panel id="issues-title" title="ปัญหาความเข้ากันได้ที่เกิดบ่อย">
          <RankBars
            rows={stats.topIssues.map((issue) => ({
              label: `${issue.code} ${issue.title}`,
              value: issue.builds,
            }))}
            format={(value) => `${value} สเปก`}
            empty="ยังไม่พบปัญหาในสเปกที่บันทึกไว้"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            นับจากการตรวจสเปกที่บันทึกไว้ทุกชุดใหม่ด้วยกฎชุดเดียวกับหน้าจัดสเปก
            (ระดับผิดพลาดและเตือน)
          </p>
        </Panel>

        <Panel id="brand-cpu-title" title="สัดส่วนยี่ห้อ CPU ในสเปกทั้งหมด">
          <RankBars
            rows={stats.brandShare.cpu.map((b) => ({ label: b.brand, value: b.count }))}
            format={(v) => `${v} สเปก`}
            showShare
          />
        </Panel>

        <Panel id="brand-gpu-title" title="สัดส่วนยี่ห้อการ์ดจอในสเปกทั้งหมด">
          <RankBars
            rows={stats.brandShare.gpu.map((b) => ({ label: b.brand, value: b.count }))}
            format={(v) => `${v} สเปก`}
            showShare
          />
        </Panel>

        <Panel id="budget-title" title="งบเฉลี่ยแยกตามประเภทการใช้งาน">
          {stats.budgetByUsage.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีสเปก</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th scope="col" className="py-1 text-left font-normal">
                    ประเภท
                  </th>
                  <th scope="col" className="py-1 text-right font-normal">
                    จำนวนสเปก
                  </th>
                  <th scope="col" className="py-1 text-right font-normal">
                    งบเฉลี่ย
                  </th>
                  <th scope="col" className="py-1 text-right font-normal">
                    ราคารวมเฉลี่ย
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.budgetByUsage.map((row) => (
                  <tr key={row.usage} className="border-t border-border">
                    <th scope="row" className="py-2 text-left font-normal">
                      {USAGE_LABELS[row.usage]}
                    </th>
                    <td className="py-2 text-right font-mono">{row.count}</td>
                    <td className="py-2 text-right font-mono">
                      {row.avgBudget === null ? '–' : formatBaht(row.avgBudget)}
                    </td>
                    <td className="py-2 text-right font-mono">{formatBaht(row.avgPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            งบเฉลี่ยนับเฉพาะสเปกที่ผู้ใช้กรอกงบไว้
          </p>
        </Panel>

        <Panel id="used-drops-title" title="มือสอง: รุ่นที่ราคาเปลี่ยนมากสุดเดือนนี้">
          <RankBars
            rows={market.drops.slice(0, 8).map((drop) => ({
              label: `${drop.model} เกรด ${drop.grade}`,
              value: Math.round(drop.drop * 100),
              href: `/parts/${drop.categorySlug}/${drop.slug}`,
            }))}
            format={(value) => `−${value}%`}
            empty="รายงานยังไม่พอสำหรับเทียบราคา (ต้องมีอย่างน้อยช่วงละ 2 รายงาน)"
          />
        </Panel>
      </div>
    </div>
  );
}

export default function AdminPage({ searchParams }: PageProps<'/admin'>) {
  return (
    <>
      <h1 className="mb-4 t-h1">Dashboard</h1>
      <Suspense
        fallback={
          <div className="grid gap-3 xl:grid-cols-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        }
      >
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
