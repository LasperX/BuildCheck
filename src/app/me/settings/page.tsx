import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SettingsPanels } from '@/components/account/settings-panels';
import { NotificationPrefs } from '@/components/notifications/notification-prefs';
import { Skeleton } from '@/components/ui/skeleton';
import { accounts, users } from '@/db/schema';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'ตั้งค่าบัญชี · BuildCheck' };

async function SettingsContent() {
  const sessionUser = await requireUser();

  // ใช้ id จาก Session เท่านั้น จึงเห็นได้แค่ข้อมูลบัญชีตัวเอง
  const [user] = await db
    .select({
      email: users.email,
      emailVerified: users.emailVerified,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      image: users.image,
      muted: users.mutedNotifications,
    })
    .from(users)
    .where(eq(users.id, sessionUser.id));
  const logins = await db
    .select({ providerId: accounts.providerId })
    .from(accounts)
    .where(eq(accounts.userId, sessionUser.id));

  if (!user) return null;
  const { muted, ...profile } = user;
  return (
    <div className="flex flex-col gap-4">
      <SettingsPanels
        user={{ ...profile, bio: profile.bio ?? '', username: profile.username ?? '' }}
        hasPassword={logins.some((login) => login.providerId === 'credential')}
      />
      <NotificationPrefs muted={muted} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-6 md:py-8">
      <h1 className="t-h1">ตั้งค่าบัญชี</h1>
      <div className="mt-6">
        <Suspense
          fallback={
            <div className="flex flex-col gap-4" aria-label="กำลังโหลด">
              <Skeleton className="h-64 rounded-lg" />
              <Skeleton className="h-64 rounded-lg" />
            </div>
          }
        >
          <SettingsContent />
        </Suspense>
      </div>
    </main>
  );
}
