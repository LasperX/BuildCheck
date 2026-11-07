'use client';

import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  NOTIFICATION_LABELS,
  notificationHref,
  type NotificationView,
  timeAgo,
} from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { markNotificationsRead } from '@/server/actions/notifications';

/** รายการแจ้งเตือนทั้งหมด อ่านแล้ว/ยังไม่อ่าน กดแล้วไปหน้าที่เกี่ยวข้อง */
export function NotificationList({
  items,
  hasUnread,
}: {
  items: NotificationView[];
  hasUnread: boolean;
}) {
  // เวลาแบบ "5 นาทีที่แล้ว" คำนวณหลังโหลดในเบราว์เซอร์ ก่อนหน้านั้นแสดงวันที่
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [readIds, setReadIds] = useState<Set<number>>(new Set());

  if (items.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center">
        <Bell aria-hidden className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-2 font-medium">ไม่มีการแจ้งเตือน</p>
      </div>
    );
  }

  return (
    <>
      {hasUnread && (
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await markNotificationsRead();
                router.refresh();
              })
            }
          >
            <CheckCheck aria-hidden />
            ทำเครื่องหมายว่าอ่านทั้งหมด
          </Button>
        </div>
      )}
      <ul className="mt-3 flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((item) => {
          const unread = !item.readAt && !readIds.has(item.id);
          return (
            <li key={item.id}>
              <Link
                href={notificationHref(item)}
                onClick={() => {
                  if (!unread) return;
                  setReadIds((prev) => new Set(prev).add(item.id));
                  void markNotificationsRead([item.id]);
                }}
                className={cn(
                  'flex items-start gap-3 p-4 hover:bg-surface-2',
                  unread && 'bg-brand-soft/40',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-2 size-2 shrink-0 rounded-full',
                    unread ? 'bg-link' : 'bg-transparent',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">
                    {NOTIFICATION_LABELS[item.type]} ·{' '}
                    {now
                      ? timeAgo(item.createdAt, now)
                      : new Date(item.createdAt).toLocaleDateString('th-TH', {
                          timeZone: 'Asia/Bangkok',
                        })}
                    {unread && <span className="sr-only"> · ยังไม่อ่าน</span>}
                  </span>
                  <span className={cn('block break-words', unread && 'font-medium')}>
                    {item.message}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
