import { Settings } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { NotificationList } from '@/components/notifications/notification-list';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { requireUser } from '@/lib/session';
import { listNotifications } from '@/server/queries/notifications';

export const metadata: Metadata = { title: 'การแจ้งเตือน · BuildCheck' };

// /me/notifications (หัวข้อ 5.1) รายการแจ้งเตือน อ่านแล้ว/ยังไม่อ่าน แบ่งหน้าด้วย ?before=รหัสสุดท้าย

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function NotificationsContent({
  searchParams,
}: {
  searchParams: PageProps<'/me/notifications'>['searchParams'];
}) {
  const [user, raw] = await Promise.all([requireUser(), searchParams]);
  const unreadOnly = one(raw.filter) === 'unread';
  const before = Number(one(raw.before)) || undefined;
  const { items, hasMore } = await listNotifications(user.id, { before, unreadOnly });
  const base = unreadOnly ? '/me/notifications?filter=unread' : '/me/notifications';

  return (
    <>
      <nav aria-label="กรองการแจ้งเตือน" className="mt-5 flex gap-1">
        {[
          { href: '/me/notifications', label: 'ทั้งหมด', active: !unreadOnly },
          { href: '/me/notifications?filter=unread', label: 'ยังไม่อ่าน', active: unreadOnly },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? 'page' : undefined}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-surface-2 aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-soft-fg"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <NotificationList items={items} hasUnread={items.some((item) => !item.readAt)} />
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button asChild variant="secondary">
            <Link href={`${base}${unreadOnly ? '&' : '?'}before=${items.at(-1)?.id ?? ''}`}>
              ดูเก่ากว่านี้
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}

export default function NotificationsPage({ searchParams }: PageProps<'/me/notifications'>) {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="t-h1">การแจ้งเตือน</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/me/settings#notifications">
            <Settings aria-hidden />
            ตั้งค่าการแจ้งเตือน
          </Link>
        </Button>
      </div>
      <Suspense fallback={<Skeleton className="mt-5 h-64" />}>
        <NotificationsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
