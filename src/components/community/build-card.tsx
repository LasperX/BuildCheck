import { ArrowBigUp, MessageSquare, Recycle, Zap } from 'lucide-react';
import Link from 'next/link';

import { AdminBadge } from '@/components/account/admin-badge';
import { STATUS_UI } from '@/components/builder/levels';
import { Badge } from '@/components/ui/badge';
import { USAGE_LABELS } from '@/lib/builder/types';
import { formatBaht } from '@/lib/parts/catalog';
import { cn } from '@/lib/utils';
import type { BuildCard } from '@/server/queries/community';

/** การ์ดสเปก 1 ชุด ใช้ในหน้าชุมชน โปรไฟล์ รายการโปรด และสเปกของฉัน */
export function BuildCardView({
  build,
  showOwner = true,
  footer,
}: {
  build: BuildCard;
  showOwner?: boolean;
  footer?: React.ReactNode;
}) {
  const status = STATUS_UI[build.compatStatus];
  const StatusIcon = status.icon;
  return (
    // กดตรงไหนของการ์ดก็เปิดสเปกได้: ลิงก์ชื่อสเปกขยายคลุมทั้งการ์ด (after:inset-0)
    // ส่วนลิงก์เจ้าของและปุ่มด้านล่างยกขึ้นมาด้วย relative z-10 จึงยังกดแยกได้
    <article className="relative flex h-full lift flex-col rounded-xl border border-border bg-card p-4 hover:border-border-strong hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <Badge variant="brand">{USAGE_LABELS[build.usageType]}</Badge>
        <span
          className={cn('inline-flex items-center gap-1 text-xs', status.text)}
          title={status.title}
        >
          <StatusIcon aria-hidden className="size-4" />
          <span className="sr-only">{status.title}</span>
        </span>
      </div>
      <h3 className="mt-2 line-clamp-2 text-lg font-semibold break-words">
        <Link
          href={`/builds/${build.id}`}
          className="after:absolute after:inset-0 after:rounded-xl hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
        >
          {build.title}
        </Link>
      </h3>
      {showOwner && (
        <p className="text-xs text-muted-foreground">
          โดย{' '}
          {build.ownerUsername ? (
            <Link href={`/u/${build.ownerUsername}`} className="relative z-10 hover:underline">
              {build.ownerName}
            </Link>
          ) : (
            build.ownerName
          )}{' '}
          <AdminBadge role={build.ownerRole} size={14} />
        </p>
      )}
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">
        {formatBaht(build.totalPrice)}
      </p>
      {/* สเปกที่มีของมือสอง บอกให้เห็นตั้งแต่การ์ด คนหาสเปกมือสองจะเลือกได้ทันที */}
      {build.usedCount > 0 && (
        <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs font-medium text-used-fg">
          <Recycle aria-hidden className="size-3.5" />
          {build.usedCount >= build.itemCount
            ? `มือสองทั้งชุด (${build.itemCount} ชิ้น)`
            : `มือสอง ${build.usedCount} จาก ${build.itemCount} ชิ้น`}
          {/* ยอดที่ประหยัดได้เทียบซื้อใหม่ทั้งชุด (คิดตอนบันทึกสเปก) */}
          {build.totalNewPrice > build.totalPrice && (
            <span className="text-ok-fg">
              · ประหยัดกว่าซื้อใหม่{' '}
              <span className="font-mono">
                {formatBaht(build.totalNewPrice - build.totalPrice)}
              </span>
            </span>
          )}
        </p>
      )}
      <div className="mt-auto flex items-center gap-4 pt-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1" title="คะแนนโหวต">
          <ArrowBigUp aria-hidden className="size-4.5" />
          <span className="font-mono">{build.weekScore ?? build.voteScore}</span>
          <span className="sr-only">
            {build.weekScore !== undefined ? 'คะแนนสัปดาห์นี้' : 'คะแนนโหวต'}
          </span>
        </span>
        <span className="flex items-center gap-1" title="คอมเมนต์">
          <MessageSquare aria-hidden className="size-4" />
          <span className="font-mono">{build.commentCount}</span>
          <span className="sr-only">คอมเมนต์</span>
        </span>
        <span className="flex items-center gap-1" title="กำลังไฟโดยประมาณ">
          <Zap aria-hidden className="size-4" />
          <span className="font-mono">{build.totalWatt} W</span>
        </span>
        {build.perfScore > 0 && (
          <span className="ml-auto font-mono text-xs" title="คะแนนประสิทธิภาพ">
            {build.perfScore}/100
          </span>
        )}
      </div>
      {footer ? <div className="relative z-10">{footer}</div> : null}
    </article>
  );
}
