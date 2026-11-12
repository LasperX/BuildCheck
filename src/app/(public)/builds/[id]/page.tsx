import { Copy, GitFork, ImageDown, Pencil } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { AdminBadge } from '@/components/account/admin-badge';
import { IssueList } from '@/components/builder/issue-list';
import { STATUS_UI } from '@/components/builder/levels';
import { PowerGauge } from '@/components/builder/power-gauge';
import {
  CompareButton,
  FavoriteButton,
  ForkButton,
  ReportButton,
  VoteButtons,
} from '@/components/community/build-actions';
import { CommentSection } from '@/components/community/comment-section';
import { VisibilitySelect } from '@/components/builder/visibility-select';
import { PartImage } from '@/components/parts/part-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { qrSvg, shortUrl } from '@/lib/builder/share';
import { USAGE_LABELS, VISIBILITY_LABELS } from '@/lib/builder/types';
import { checkBuild, unitPrice } from '@/lib/compat';
import { formatBaht } from '@/lib/parts/catalog';
import { CATEGORY_LABELS } from '@/lib/parts/spec-fields';
import { getSession } from '@/lib/session';
import { canUseCommunity } from '@/lib/email-verification';
import { cn } from '@/lib/utils';
import { buildIdSchema } from '@/lib/validators/builds';
import { canViewBuild, getBuildWithItems } from '@/server/queries/builds';
import { getBuildSocial } from '@/server/queries/community';
import { getSystemConfig } from '@/server/queries/settings';

// หน้ารายละเอียดสเปก /builds/[id] (หัวข้อ 5.1) รายการอะไหล่ ผลตรวจ แชร์ โหวต คอมเมนต์ และ Fork

type Params = PageProps<'/builds/[id]'>['params'];

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const id = buildIdSchema.safeParse((await params).id);
  const found = id.success ? await getBuildWithItems(id.data) : null;
  // สเปกส่วนตัวไม่เปิดเผยชื่อในพรีวิวลิงก์
  if (!found || found.build.visibility === 'private') return { title: 'สเปก · BuildCheck' };
  const { build } = found;
  return {
    title: `${build.title} · BuildCheck`,
    description: `${USAGE_LABELS[build.usageType]} ราคารวม ${formatBaht(build.totalPrice)} ใช้ไฟประมาณ ${build.totalWatt} W`,
    openGraph: { images: [`/api/og/build/${build.id}`] },
    // ลิงก์แชร์แบบ "ทุกคนที่มีลิงก์" ไม่ให้เครื่องมือค้นหาเก็บ
    robots: build.visibility === 'unlisted' ? { index: false } : undefined,
  };
}

async function BuildContent({ params }: { params: Params }) {
  const id = buildIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const [found, session] = await Promise.all([getBuildWithItems(id.data), getSession()]);
  // ไม่มีสิทธิ์ดูก็ตอบว่าไม่พบ ไม่บอกว่ามีสเปกนี้อยู่
  if (!found || !canViewBuild(found.build, session?.user)) notFound();

  const { build, items } = found;
  const viewer = session?.user ?? null;
  const isOwner = viewer?.id === build.userId;
  const social = await getBuildSocial(build.id, build.forkedFromId, viewer?.id ?? null);
  // สเปกส่วนตัวเห็นได้แค่เจ้าของ จึงไม่มีส่วนชุมชน
  const community = build.visibility !== 'private';
  // ตรวจซ้ำด้วยข้อมูลอะไหล่ล่าสุด เผื่อแอดมินแก้สเปกอะไหล่หลังบันทึก
  const { engine } = await getSystemConfig();
  const result = checkBuild({
    items,
    budget: build.budget,
    usage: build.usageType,
    settings: engine,
  });
  const status = items.length ? STATUS_UI[result.status] : null;
  const StatusIcon = status?.icon;
  const url = shortUrl(build.id);
  const qr = await qrSvg(url);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="t-h1 break-words">{build.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="brand">{USAGE_LABELS[build.usageType]}</Badge>
              <span>
                โดย{' '}
                {build.ownerUsername ? (
                  <Link href={`/u/${build.ownerUsername}`} className="text-link hover:underline">
                    {build.ownerName}
                  </Link>
                ) : (
                  build.ownerName
                )}{' '}
                <AdminBadge role={build.ownerRole} />
              </span>
              <span>· แก้ไขล่าสุด {build.updatedAt.toLocaleDateString('th-TH')}</span>
            </p>
            {social.forkedFrom && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <GitFork aria-hidden className="size-4" />
                Fork มาจาก{' '}
                <Link
                  href={`/builds/${social.forkedFrom.id}`}
                  className="text-link hover:underline"
                >
                  {social.forkedFrom.title}
                </Link>{' '}
                ของ {social.forkedFrom.ownerName}
                <AdminBadge role={social.forkedFrom.ownerRole} size={14} />
              </p>
            )}
            {build.description && <p className="mt-3 whitespace-pre-line">{build.description}</p>}
          </div>
          {isOwner && (
            <Button asChild variant="secondary">
              <Link href={`/builder?id=${build.id}`}>
                <Pencil aria-hidden />
                แก้ไขในหน้าจัดสเปก
              </Link>
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-start gap-2">
          {community && (
            <VoteButtons
              buildId={build.id}
              score={build.voteScore}
              myVote={social.myVote}
              loggedIn={Boolean(viewer)}
              isOwner={isOwner}
            />
          )}
          {community && (
            <FavoriteButton
              buildId={build.id}
              favorited={social.favorited}
              count={social.favoriteCount}
              loggedIn={Boolean(viewer)}
            />
          )}
          {isOwner ? (
            <ForkButton buildId={build.id} loggedIn label="คัดลอกเป็นสเปกใหม่" />
          ) : (
            <ForkButton buildId={build.id} loggedIn={Boolean(viewer)} />
          )}
          <CompareButton buildId={build.id} />
          {community && !isOwner && (
            <ReportButton
              targetType="build"
              targetId={build.id}
              loggedIn={Boolean(viewer)}
              returnTo={`/builds/${build.id}`}
            />
          )}
        </div>
        {social.forkCount > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            มีคน Fork สเปกนี้ไปแล้ว <span className="font-mono">{social.forkCount}</span> ครั้ง
          </p>
        )}

        {status && StatusIcon && (
          <div className={cn('mt-4 flex items-start gap-3 rounded-xl border p-4', status.soft)}>
            <StatusIcon aria-hidden className={cn('size-7 shrink-0', status.text)} />
            <div>
              <h2 className="font-semibold">{status.title}</h2>
              <p className="text-sm text-muted-foreground">{status.body}</p>
            </div>
          </div>
        )}

        <section aria-labelledby="parts-title" className="mt-6">
          <h2 id="parts-title" className="mb-3 text-lg font-semibold">
            รายการอะไหล่
          </h2>
          {items.length === 0 ? (
            <p className="text-muted-foreground">สเปกนี้ยังไม่มีอะไหล่</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {items.map((item) => (
                <li key={item.partId} className="flex items-center gap-3 p-3">
                  <PartImage
                    src={item.part.imageUrl}
                    alt={`${item.part.brandName} ${item.part.model}`}
                    category={item.part.categorySlug}
                    size={64}
                    className="size-14 shrink-0 md:size-16"
                    zoom
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[item.part.categorySlug]}
                    </p>
                    <Link
                      href={`/parts/${item.part.categorySlug}/${item.part.slug}`}
                      className="font-medium hover:underline"
                    >
                      {item.part.brandName} {item.part.model}
                    </Link>
                    {item.condition !== 'new' && (
                      <Badge variant="used" className="ml-1 align-middle">
                        มือสอง {item.condition}
                      </Badge>
                    )}
                    {item.quantity > 1 && (
                      <span className="ml-1 font-mono text-sm text-muted-foreground">
                        × {item.quantity}
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatBaht(unitPrice(item) * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="issues-title" className="mt-8">
          <h2 id="issues-title" className="mb-3 text-lg font-semibold">
            ผลตรวจความเข้ากันได้
          </h2>
          <IssueList issues={result.issues} empty={items.length === 0} />
        </section>

        {community && (
          <CommentSection
            buildId={build.id}
            ownerId={build.userId}
            comments={social.comments}
            viewer={viewer ? { id: viewer.id, verified: canUseCommunity(viewer) } : null}
          />
        )}
      </div>

      <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-20">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">ราคารวม</p>
          <p className="font-mono text-3xl font-semibold">{formatBaht(result.price.total)}</p>
          {build.budget !== null && (
            <p className="text-xs text-muted-foreground">งบ {formatBaht(build.budget)}</p>
          )}
          {result.price.saved > 0 && (
            <p className="mt-1 text-xs text-used-fg">
              ราคาแบบผสมมือสอง ประหยัดกว่าซื้อใหม่{' '}
              <b className="font-mono">{formatBaht(result.price.saved)}</b>
            </p>
          )}
          <div className="mt-4">
            <PowerGauge power={result.power} />
          </div>
          {result.score.score > 0 && (
            <dl className="mt-3 flex justify-between text-xs">
              <div className="flex gap-1">
                <dt className="text-muted-foreground">คะแนนประสิทธิภาพ</dt>
                <dd className="font-mono font-semibold">{result.score.score}/100</dd>
              </div>
              <div className="flex gap-1">
                <dt className="text-muted-foreground">ความคุ้มค่า</dt>
                <dd className="font-mono font-semibold">{result.score.value}</dd>
              </div>
            </dl>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">แชร์สเปกนี้</h2>
          <div
            role="img"
            aria-label={`QR Code ของลิงก์ ${url}`}
            className="mx-auto size-40 overflow-hidden rounded-lg border border-border bg-white p-1 [&_svg]:size-full"
            // SVG สร้างจากไลบรารี qrcode บนเซิร์ฟเวอร์จากลิงก์ของระบบเอง ไม่มีข้อความจากผู้ใช้
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <p className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1.5 font-mono text-xs break-all">
            <Copy aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            {url}
          </p>
          {isOwner ? (
            <VisibilitySelect buildId={build.id} value={build.visibility} />
          ) : (
            <p className="text-xs text-muted-foreground">{VISIBILITY_LABELS[build.visibility]}</p>
          )}
          <Button asChild variant="secondary">
            <a href={`/api/og/build/${build.id}?download=1`} download>
              <ImageDown aria-hidden />
              ดาวน์โหลดรูปสรุป
            </a>
          </Button>
        </div>
      </aside>
    </div>
  );
}

export default function BuildPage({ params }: PageProps<'/builds/[id]'>) {
  return (
    <main className="container mx-auto px-4 py-6">
      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-64" />
          </div>
        }
      >
        <BuildContent params={params} />
      </Suspense>
    </main>
  );
}
