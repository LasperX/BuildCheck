'use client';

import { MessageSquare, Reply, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { UserAvatar } from '@/components/account/user-avatar';
import { Button } from '@/components/ui/button';
import { COMMENT_MAX } from '@/lib/validators/community';
import { addComment, deleteComment } from '@/server/actions/community';
import type { CommentView } from '@/server/queries/community';

import { ReportButton } from './build-actions';

// คอมเมนต์และตอบกลับ 1 ชั้น (หัวข้อ 3.7)
// ข้อความแสดงเป็นตัวอักษรล้วนผ่าน React (escape ให้อัตโนมัติ) ไม่แปลงเป็น HTML หรือลิงก์ (หัวข้อ 9.1 XSS)

type Viewer = { id: string; verified: boolean } | null;

const formatTime = (date: Date) =>
  new Date(date).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });

function CommentForm({
  buildId,
  parentId,
  onDone,
  autoFocus,
  placeholder,
}: {
  buildId: string;
  parentId: number | null;
  onDone?: () => void;
  autoFocus?: boolean;
  placeholder: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = `comment-${parentId ?? 'root'}`;

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await addComment({ buildId, body, parentId });
          if (!result.ok) return setError(result.error);
          setBody('');
          setError(null);
          onDone?.();
          router.refresh();
        });
      }}
    >
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <textarea
        id={id}
        value={body}
        rows={parentId ? 2 : 3}
        maxLength={COMMENT_MAX}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => setBody(event.target.value)}
        className="w-full rounded-md border border-input bg-surface p-2 text-sm outline-none placeholder:text-subtle focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {body.length}/{COMMENT_MAX}
        </span>
        <div className="flex gap-2">
          {onDone && (
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              ยกเลิก
            </Button>
          )}
          <Button type="submit" size="sm" disabled={pending || body.trim().length === 0}>
            {pending ? 'กำลังส่ง…' : parentId ? 'ตอบกลับ' : 'ส่งคอมเมนต์'}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-err-fg">
          {error}
        </p>
      )}
    </form>
  );
}

function CommentItem({
  comment,
  buildId,
  viewer,
  ownerId,
  onReply,
}: {
  comment: Omit<CommentView, 'replies'>;
  buildId: string;
  viewer: Viewer;
  ownerId: string;
  onReply?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const mine = viewer?.id === comment.authorId;
  return (
    <div className="flex gap-3">
      <UserAvatar name={comment.authorName} image={comment.authorImage} size={32} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          {comment.authorUsername ? (
            <Link href={`/u/${comment.authorUsername}`} className="font-semibold hover:underline">
              {comment.authorName}
            </Link>
          ) : (
            <span className="font-semibold">{comment.authorName}</span>
          )}
          {comment.authorId === ownerId && (
            <span className="rounded-xs bg-brand-soft px-1 text-2xs text-brand-soft-fg">
              เจ้าของสเปก
            </span>
          )}
          <time
            className="text-xs text-muted-foreground"
            dateTime={new Date(comment.createdAt).toISOString()}
          >
            {formatTime(comment.createdAt)}
          </time>
        </p>
        <p className="mt-1 text-sm break-words whitespace-pre-line">{comment.body}</p>
        <div className="mt-1 flex items-center gap-1">
          {onReply && viewer?.verified && (
            <Button type="button" variant="ghost" size="sm" onClick={onReply}>
              <Reply aria-hidden />
              ตอบกลับ
            </Button>
          )}
          {mine ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (!window.confirm('ลบคอมเมนต์นี้? คำตอบใต้คอมเมนต์จะถูกลบด้วย')) return;
                startTransition(async () => {
                  await deleteComment(comment.id);
                  router.refresh();
                });
              }}
            >
              <Trash2 aria-hidden />
              ลบ
            </Button>
          ) : (
            <ReportButton
              targetType="comment"
              targetId={String(comment.id)}
              loggedIn={Boolean(viewer)}
              returnTo={`/builds/${buildId}`}
              compact
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function CommentSection({
  buildId,
  ownerId,
  comments,
  viewer,
}: {
  buildId: string;
  ownerId: string;
  comments: CommentView[];
  viewer: Viewer;
}) {
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const total = comments.reduce((sum, comment) => sum + 1 + comment.replies.length, 0);

  return (
    <section aria-labelledby="comments-title" className="mt-8">
      <h2 id="comments-title" className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <MessageSquare aria-hidden className="size-5" />
        คอมเมนต์ <span className="font-mono text-muted-foreground">({total})</span>
      </h2>

      {!viewer ? (
        <p className="rounded-lg border border-border bg-card p-3 text-sm">
          <Link
            href={`/login?next=${encodeURIComponent(`/builds/${buildId}`)}`}
            className="text-link underline"
          >
            เข้าสู่ระบบ
          </Link>{' '}
          เพื่อคอมเมนต์
        </p>
      ) : !viewer.verified ? (
        <p className="rounded-lg border border-warn-border bg-warn-soft p-3 text-sm">
          กรุณายืนยันอีเมลก่อนคอมเมนต์{' '}
          <Link href="/me/settings" className="text-link underline">
            ไปที่ตั้งค่าบัญชี
          </Link>
        </p>
      ) : (
        <div className="rounded-lg border border-border bg-card p-3">
          <CommentForm
            buildId={buildId}
            parentId={null}
            placeholder="แสดงความคิดเห็นหรือแนะนำสเปกนี้"
          />
        </div>
      )}

      {comments.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">ยังไม่มีคอมเมนต์</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-5">
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentItem
                comment={comment}
                buildId={buildId}
                viewer={viewer}
                ownerId={ownerId}
                onReply={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
              />
              {(comment.replies.length > 0 || replyTo === comment.id) && (
                <ul className="mt-3 ml-11 flex flex-col gap-4 border-l-2 border-border pl-4">
                  {comment.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentItem
                        comment={reply}
                        buildId={buildId}
                        viewer={viewer}
                        ownerId={ownerId}
                      />
                    </li>
                  ))}
                  {replyTo === comment.id && (
                    <li>
                      <CommentForm
                        buildId={buildId}
                        parentId={comment.id}
                        autoFocus
                        placeholder={`ตอบกลับ ${comment.authorName}`}
                        onDone={() => setReplyTo(null)}
                      />
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
