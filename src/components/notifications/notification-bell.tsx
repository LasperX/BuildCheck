'use client';

import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { notificationHref, type NotificationView, timeAgo } from '@/lib/notifications';
import { markNotificationsRead } from '@/server/actions/notifications';

// กระดิ่งแจ้งเตือนบนแถบเมนู (หัวข้อ 5.3) รับรายการใหม่แบบสดจาก /api/notifications/stream
// EventSource ของเบราว์เซอร์ต่อใหม่ให้เองเมื่อหลุด และส่ง Last-Event-ID กลับไป จึงไม่พลาดรายการ

type Snapshot = { unread: number; items: NotificationView[] };

export function NotificationBell() {
  const router = useRouter();
  const [state, setState] = useState<Snapshot>({ unread: 0, items: [] });
  const [toast, setToast] = useState<NotificationView | null>(null);
  const [now, setNow] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const source = new EventSource('/api/notifications/stream');
    source.addEventListener('snapshot', (event) => {
      setState(JSON.parse((event as MessageEvent<string>).data) as Snapshot);
    });
    source.addEventListener('unread', (event) => {
      const { unread } = JSON.parse((event as MessageEvent<string>).data) as { unread: number };
      setState((prev) => ({ ...prev, unread }));
    });
    source.addEventListener('notification', (event) => {
      const { item, unread } = JSON.parse((event as MessageEvent<string>).data) as {
        item: NotificationView;
        unread: number;
      };
      setState((prev) => ({
        unread,
        items: [item, ...prev.items.filter((old) => old.id !== item.id)].slice(0, 8),
      }));
      setToast(item);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 6000);
      // หน้าที่เปิดอยู่ (เช่นคอมเมนต์ใหม่ในสเปกนี้) โหลดข้อมูลล่าสุด
      router.refresh();
    });
    return () => {
      source.close();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [router]);

  const markAll = async () => {
    setState((prev) => ({
      unread: 0,
      items: prev.items.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      })),
    }));
    await markNotificationsRead();
  };

  const open = (item: NotificationView) => {
    if (!item.readAt) {
      setState((prev) => ({
        unread: Math.max(0, prev.unread - 1),
        items: prev.items.map((old) =>
          old.id === item.id ? { ...old, readAt: new Date().toISOString() } : old,
        ),
      }));
      void markNotificationsRead([item.id]);
    }
    router.push(notificationHref(item));
  };

  return (
    <>
      <DropdownMenu onOpenChange={(next) => next && setNow(Date.now())}>
        <DropdownMenuTrigger
          aria-label={
            state.unread ? `การแจ้งเตือน ยังไม่อ่าน ${state.unread} รายการ` : 'การแจ้งเตือน'
          }
          className="relative grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Bell aria-hidden className="size-5" />
          {state.unread > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-err px-1 font-mono text-[10px] leading-none font-semibold text-white"
            >
              {state.unread > 99 ? '99+' : state.unread}
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
          <DropdownMenuLabel className="flex items-center justify-between">
            การแจ้งเตือน
            {state.unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="inline-flex items-center gap-1 text-xs font-normal text-link hover:underline"
              >
                <CheckCheck aria-hidden className="size-3.5" />
                อ่านทั้งหมด
              </button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {state.items.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              ยังไม่มีการแจ้งเตือน
            </p>
          ) : (
            state.items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => open(item)}
                className="flex items-start gap-2 whitespace-normal"
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    item.readAt ? 'bg-transparent' : 'bg-link',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm', !item.readAt && 'font-medium')}>
                    {item.message}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {now ? timeAgo(item.createdAt, now) : ''}
                    {!item.readAt && <span className="sr-only"> · ยังไม่อ่าน</span>}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/me/notifications" className="justify-center text-sm text-link">
              ดูทั้งหมด
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* แจ้งเตือนเด้งมุมจอ อ่านออกเสียงโดยโปรแกรมอ่านหน้าจอผ่าน role="status" */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-36 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-24"
      >
        {toast && (
          <button
            type="button"
            onClick={() => {
              setToast(null);
              open(toast);
            }}
            className="pointer-events-auto flex max-w-sm items-start gap-2 rounded-xl border border-border bg-card p-3 text-left text-sm shadow-lg"
          >
            <Bell aria-hidden className="mt-0.5 size-4 shrink-0 text-link" />
            <span>{toast.message}</span>
          </button>
        )}
      </div>
    </>
  );
}
