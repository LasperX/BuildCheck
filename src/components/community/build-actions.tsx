'use client';

import { ArrowBigDown, ArrowBigUp, Columns3, Flag, GitFork, Heart } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import { REPORT_REASON_LABELS } from '@/lib/validators/community';
import { forkBuild, reportContent, toggleFavorite, voteBuild } from '@/server/actions/community';

import { addToCompare } from './compare-list';

// ปุ่มโต้ตอบในหน้ารายละเอียดสเปก ผู้เยี่ยมชมกดแล้วไปหน้าเข้าสู่ระบบ

function loginHref(buildId: string) {
  return `/login?next=${encodeURIComponent(`/builds/${buildId}`)}`;
}

function ErrorText({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="text-xs text-err-fg">
      {text}
    </p>
  );
}

/** โหวตขึ้น/ลง กดซ้ำทางเดิม = ยกเลิก ตัวเลขเปลี่ยนทันที แล้วใช้ค่าจากเซิร์ฟเวอร์ */
export function VoteButtons({
  buildId,
  score,
  myVote,
  loggedIn,
  isOwner,
}: {
  buildId: string;
  score: number;
  myVote: number;
  loggedIn: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState({ score, myVote });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const vote = (direction: 1 | -1) => {
    if (!loggedIn) return router.push(loginHref(buildId));
    const next = state.myVote === direction ? 0 : direction;
    const previous = state;
    setState({ score: state.score - state.myVote + next, myVote: next });
    startTransition(async () => {
      const result = await voteBuild({ buildId, value: next });
      if (result.ok) {
        setState({ score: result.score, myVote: result.myVote });
        setError(null);
      } else {
        setState(previous);
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <div
        role="group"
        aria-label="โหวตสเปกนี้"
        className="inline-flex items-center rounded-lg border border-border bg-card"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={state.myVote === 1}
          aria-label="โหวตขึ้น"
          disabled={pending || isOwner}
          onClick={() => vote(1)}
          className={cn(state.myVote === 1 && 'text-link')}
        >
          <ArrowBigUp aria-hidden className={cn(state.myVote === 1 && 'anim-pop fill-current')} />
        </Button>
        <output aria-live="polite" className="min-w-8 text-center font-mono font-semibold">
          <span className="sr-only">คะแนน </span>
          {state.score}
        </output>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={state.myVote === -1}
          aria-label="โหวตลง"
          disabled={pending || isOwner}
          onClick={() => vote(-1)}
          className={cn(state.myVote === -1 && 'text-err-fg')}
        >
          <ArrowBigDown
            aria-hidden
            className={cn(state.myVote === -1 && 'anim-pop fill-current')}
          />
        </Button>
      </div>
      {isOwner && <p className="text-xs text-muted-foreground">โหวตสเปกของตัวเองไม่ได้</p>}
      <ErrorText text={error} />
    </div>
  );
}

export function FavoriteButton({
  buildId,
  favorited,
  count,
  loggedIn,
}: {
  buildId: string;
  favorited: boolean;
  count: number;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState({ favorited, count });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="secondary"
        aria-pressed={state.favorited}
        disabled={pending}
        onClick={() => {
          if (!loggedIn) return router.push(loginHref(buildId));
          startTransition(async () => {
            const result = await toggleFavorite(buildId);
            if (!result.ok) return setError(result.error);
            setError(null);
            const on = Boolean(result.favorited);
            setState((prev) => ({ favorited: on, count: prev.count + (on ? 1 : -1) }));
          });
        }}
      >
        <Heart aria-hidden className={cn(state.favorited && 'anim-pop fill-current text-err-fg')} />
        {state.favorited ? 'อยู่ในรายการโปรด' : 'บันทึกเป็นรายการโปรด'}
        <span className="font-mono text-xs text-muted-foreground">{state.count}</span>
      </Button>
      <ErrorText text={error} />
    </div>
  );
}

/** Fork แล้วเปิดสเปกใหม่ในหน้าจัดสเปกทันที */
export function ForkButton({
  buildId,
  loggedIn,
  label = 'Fork ไปแก้เป็นของฉัน',
  size = 'default',
}: {
  buildId: string;
  loggedIn: boolean;
  label?: string;
  size?: 'default' | 'sm';
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="secondary"
        size={size}
        disabled={pending}
        onClick={() => {
          if (!loggedIn) return router.push(loginHref(buildId));
          startTransition(async () => {
            const result = await forkBuild(buildId);
            if (!result.ok) return setError(result.error);
            router.push(`/builder?id=${result.id}`);
          });
        }}
      >
        <GitFork aria-hidden />
        {pending ? 'กำลังคัดลอก…' : label}
      </Button>
      <ErrorText text={error} />
    </div>
  );
}

export function CompareButton({ buildId }: { buildId: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => router.push(`/compare?ids=${addToCompare(buildId).join(',')}`)}
    >
      <Columns3 aria-hidden />
      เทียบกับสเปกอื่น
    </Button>
  );
}

/** รายงานเนื้อหาไม่เหมาะสม ใช้ได้กับสเปก คอมเมนต์ และผู้ใช้ */
export function ReportButton({
  targetType,
  targetId,
  loggedIn,
  returnTo,
  compact = false,
}: {
  targetType: 'build' | 'comment' | 'user';
  targetId: string;
  loggedIn: boolean;
  returnTo: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<keyof typeof REPORT_REASON_LABELS>('spam');
  const [detail, setDetail] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const label =
    targetType === 'build'
      ? 'รายงานสเปกนี้'
      : targetType === 'comment'
        ? 'รายงานคอมเมนต์'
        : 'รายงานผู้ใช้';

  if (!loggedIn) {
    return (
      <Button asChild variant="ghost" size={compact ? 'sm' : 'default'}>
        <Link href={`/login?next=${encodeURIComponent(returnTo)}`}>
          <Flag aria-hidden />
          {compact ? <span className="sr-only">{label}</span> : label}
        </Link>
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setMessage(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size={compact ? 'sm' : 'default'} title={label}>
          <Flag aria-hidden />
          {compact ? <span className="sr-only">{label}</span> : label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            แอดมินจะตรวจและซ่อนเนื้อหาถ้าผิดกติกา ผู้ถูกรายงานไม่เห็นชื่อคุณ
          </DialogDescription>
        </DialogHeader>
        {message?.ok ? (
          <p role="status" className="text-sm text-ok-fg">
            {message.text}
          </p>
        ) : (
          <form
            id={`report-${targetType}-${targetId}`}
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await reportContent({ targetType, targetId, reason, detail });
                setMessage(
                  result.ok
                    ? { ok: true, text: 'ส่งรายงานแล้ว ขอบคุณที่ช่วยดูแลชุมชน' }
                    : { ok: false, text: result.error },
                );
              });
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`reason-${targetId}`}>เหตุผล</Label>
              <NativeSelect
                id={`reason-${targetId}`}
                value={reason}
                onChange={(event) => setReason(event.target.value as typeof reason)}
              >
                {Object.entries(REPORT_REASON_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`detail-${targetId}`}>รายละเอียดเพิ่มเติม (ไม่บังคับ)</Label>
              <textarea
                id={`detail-${targetId}`}
                value={detail}
                maxLength={500}
                rows={3}
                onChange={(event) => setDetail(event.target.value)}
                className="rounded-md border border-input bg-surface p-2 text-sm outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring"
              />
            </div>
            {message && !message.ok && <ErrorText text={message.text} />}
          </form>
        )}
        <DialogFooter>
          {!message?.ok && (
            <Button type="submit" form={`report-${targetType}-${targetId}`} disabled={pending}>
              {pending ? 'กำลังส่ง…' : 'ส่งรายงาน'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
