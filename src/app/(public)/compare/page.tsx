import { Columns3, Cpu, Link2, Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { AdminBadge } from '@/components/account/admin-badge';
import { STATUS_UI } from '@/components/builder/levels';
import { CompareControls } from '@/components/community/compare-controls';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { compareBuilds } from '@/lib/builder/compare';
import { checkBuild } from '@/lib/compat';
import { formatBaht } from '@/lib/parts/catalog';
import { CATEGORY_LABELS } from '@/lib/parts/spec-fields';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { parseCompareIds } from '@/lib/validators/community';
import { canViewBuild, getBuildWithItems } from '@/server/queries/builds';
import { getCompareChoices } from '@/server/queries/community';
import { getSystemConfig } from '@/server/queries/settings';

export const metadata: Metadata = {
  title: 'เทียบสเปก · BuildCheck',
  description:
    'เทียบสเปกคอม 2–3 ชุดแบบคอลัมน์ข้างกัน ดูว่าชุดไหนแรงกว่าในแต่ละหมวด ราคา และวัตต์รวม',
};

// /compare (หัวข้อ 3.6) ?ids=a,b,c สเปกที่ไม่มีสิทธิ์ดู (ส่วนตัวของคนอื่น) ถูกตัดออกเหมือนไม่มี

function WinnerBadge({ text }: { text: string }) {
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-xs bg-ok-soft px-1.5 text-2xs font-medium text-ok-fg">
      <Trophy aria-hidden className="size-3" />
      {text}
    </span>
  );
}

async function CompareContent({
  searchParams,
}: {
  searchParams: PageProps<'/compare'>['searchParams'];
}) {
  const [raw, session, config] = await Promise.all([searchParams, getSession(), getSystemConfig()]);
  const ids = parseCompareIds(raw.ids);
  const found = await Promise.all(ids.map((id) => getBuildWithItems(id)));
  const visible = found.filter(
    (entry): entry is NonNullable<typeof entry> =>
      Boolean(entry) && canViewBuild(entry!.build, session?.user),
  );
  const choices = session ? await getCompareChoices(session.user.id) : [];

  const inputs = visible.map(({ build, items }) => ({
    build,
    items,
    result: checkBuild({
      items,
      budget: build.budget,
      usage: build.usageType,
      settings: config.engine,
    }),
  }));
  const { rows, totals } = compareBuilds(inputs);
  const formatTotal = (key: string, value: number) =>
    key === 'price' ? formatBaht(value) : key === 'watt' ? `${value} W` : String(value);

  return (
    <>
      <CompareControls
        ids={visible.map(({ build }) => build.id)}
        selected={visible.map(({ build }) => ({ id: build.id, title: build.title }))}
        choices={choices}
      />

      {inputs.length < 2 ? (
        // ยังเลือกไม่ครบ: บอกวิธีใช้เป็นขั้นตอน พร้อมทางไปหาสเปกมาเทียบ แทนหน้าว่าง
        <section
          aria-labelledby="compare-howto"
          className="mt-6 rounded-xl border border-dashed border-border-strong/40 bg-card p-5"
        >
          <h2 id="compare-howto" className="font-semibold">
            เลือกอย่างน้อย 2 สเปกเพื่อเริ่มเทียบ
          </h2>
          <ol className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              {
                icon: Cpu,
                title: 'มีสเปกที่จะเทียบ',
                text: 'จัดสเปกเองแล้วบันทึก หรือเลือกจากสเปกที่สมาชิกแชร์ไว้ในหน้าชุมชน',
              },
              {
                icon: Link2,
                title: 'ใส่ลิงก์หรือรหัสสเปก',
                text: 'วางในช่องด้านบน หรือกด “เทียบกับสเปกอื่น” ในหน้ารายละเอียดสเปก',
              },
              {
                icon: Columns3,
                title: 'ดูความต่างข้างกัน',
                text: 'ระบบไฮไลต์หมวดที่ต่างกัน และบอกว่าชุดไหนแรงกว่า คุ้มกว่า ใช้ไฟมากกว่า',
              },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-3 rounded-lg bg-surface-2 p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-soft-fg">
                  <step.icon aria-hidden className="size-4.5" />
                </span>
                <span>
                  <span className="block text-sm font-medium">
                    {index + 1}. {step.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/builds">ดูสเปกในชุมชน</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/budget">จัดสเปกตามงบ</Link>
            </Button>
          </div>
          {!session && (
            <p className="mt-3 text-xs text-muted-foreground">
              เข้าสู่ระบบเพื่อเลือกจากสเปกของคุณและรายการโปรดได้ทันที
            </p>
          )}
        </section>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] table-fixed text-sm">
            <caption className="sr-only">
              ตารางเทียบสเปก ช่องที่มีพื้นสีคือหมวดที่ต่างกัน ป้ายถ้วยคือชุดที่ดีกว่าในหมวดนั้น
            </caption>
            <colgroup>
              <col className="w-36" />
              {inputs.map(({ build }) => (
                <col key={build.id} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="p-3 text-left text-xs font-normal text-muted-foreground">
                  หมวด
                </th>
                {inputs.map(({ build, result }) => {
                  const status = STATUS_UI[result.status];
                  const Icon = status.icon;
                  return (
                    <th key={build.id} scope="col" className="p-3 text-left align-top">
                      <Link href={`/builds/${build.id}`} className="font-semibold hover:underline">
                        {build.title}
                      </Link>
                      <span className="block text-xs font-normal text-muted-foreground">
                        โดย {build.ownerName} <AdminBadge role={build.ownerRole} size={12} />
                      </span>
                      <span
                        className={cn(
                          'mt-1 flex items-center gap-1 text-xs font-normal',
                          status.text,
                        )}
                      >
                        <Icon aria-hidden className="size-3.5" />
                        {status.title}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.category} className="border-b border-border align-top">
                  <th scope="row" className="p-3 text-left font-normal text-muted-foreground">
                    {CATEGORY_LABELS[row.category]}
                    {row.differs && <span className="block text-2xs text-warn-fg">ต่างกัน</span>}
                  </th>
                  {row.cells.map((cell, index) => (
                    <td key={index} className={cn('p-3', row.differs && 'bg-warn-soft/40')}>
                      {cell.names.length === 0 ? (
                        <span className="text-muted-foreground">ไม่ได้เลือก</span>
                      ) : (
                        <>
                          {cell.names.map((name) => (
                            <span key={name} className="block break-words">
                              {name}
                            </span>
                          ))}
                          <span className="mt-1 block font-mono text-xs text-muted-foreground">
                            {formatBaht(cell.price)}
                            {cell.metric !== null &&
                              row.metricLabel &&
                              ` · ${cell.metric} ${row.metricLabel}`}
                          </span>
                          {row.best === index && <WinnerBadge text="แรงกว่า" />}
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {totals.map((total) => (
                <tr
                  key={total.key}
                  className="border-b border-border bg-surface-2/50 last:border-0"
                >
                  <th scope="row" className="p-3 text-left font-medium">
                    {total.label}
                  </th>
                  {total.values.map((value, index) => (
                    <td key={index} className="p-3">
                      <span className="font-mono font-semibold">
                        {formatTotal(total.key, value)}
                      </span>
                      {total.best === index && (
                        <WinnerBadge
                          text={
                            total.key === 'price'
                              ? 'ถูกกว่า'
                              : total.key === 'watt'
                                ? 'ประหยัดไฟกว่า'
                                : 'สูงกว่า'
                          }
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function ComparePage({ searchParams }: PageProps<'/compare'>) {
  return (
    <main className="container mx-auto px-4 py-6">
      <h1 className="t-h1">เทียบสเปก</h1>
      <p className="mt-1 text-muted-foreground">
        เลือก 2–3 สเปกมาเทียบข้างกัน ระบบไฮไลต์หมวดที่ต่างกันและบอกว่าชุดไหนแรงกว่า
      </p>
      <Suspense fallback={<Skeleton className="mt-5 h-96" />}>
        <CompareContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
