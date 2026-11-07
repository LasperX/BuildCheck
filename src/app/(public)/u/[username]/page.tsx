import { ArrowBigUp, CalendarDays, Layers } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { UserAvatar } from '@/components/account/user-avatar';
import { ReportButton } from '@/components/community/build-actions';
import { BuildCardView } from '@/components/community/build-card';
import { Skeleton } from '@/components/ui/skeleton';
import { getSession } from '@/lib/session';
import { getPublicProfile } from '@/server/queries/community';

// โปรไฟล์สาธารณะ /u/[username] (หัวข้อ 3.7) รูป คำแนะนำตัว สเปกที่แชร์ คะแนนโหวตรวม ไม่แสดงอีเมล

type Params = PageProps<'/u/[username]'>['params'];

const USERNAME = /^[a-z0-9_]{3,30}$/;

async function readProfile(params: Params) {
  const username = decodeURIComponent((await params).username).toLowerCase();
  return USERNAME.test(username) ? getPublicProfile(username) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const profile = await readProfile(params);
  if (!profile) return { title: 'ไม่พบสมาชิก · BuildCheck', robots: { index: false } };
  return {
    title: `${profile.displayName} (@${profile.username}) · BuildCheck`,
    description: profile.bio ?? `สเปกคอมที่ ${profile.displayName} แชร์ไว้`,
  };
}

async function ProfileContent({ params }: { params: Params }) {
  const [profile, session] = await Promise.all([readProfile(params), getSession()]);
  if (!profile) notFound();
  const isMe = session?.user.username === profile.username;

  return (
    <>
      <section className="flex flex-wrap items-start gap-4 rounded-xl border border-border bg-card p-5">
        <UserAvatar name={profile.displayName} image={profile.image} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="t-h1 break-words">{profile.displayName}</h1>
          <p className="font-mono text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio && <p className="mt-2 whitespace-pre-line">{profile.bio}</p>}
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex items-center gap-1.5">
              <Layers aria-hidden className="size-4 text-muted-foreground" />
              <dt className="text-muted-foreground">สเปกที่แชร์</dt>
              <dd className="font-mono font-semibold">{profile.builds.length}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowBigUp aria-hidden className="size-4.5 text-muted-foreground" />
              <dt className="text-muted-foreground">คะแนนโหวตรวม</dt>
              <dd className="font-mono font-semibold">{profile.totalVotes}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarDays aria-hidden className="size-4 text-muted-foreground" />
              <dt className="text-muted-foreground">สมาชิกตั้งแต่</dt>
              <dd>
                {profile.joinedAt.toLocaleDateString('th-TH', {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'Asia/Bangkok',
                })}
              </dd>
            </div>
          </dl>
        </div>
        {!isMe && (
          <ReportButton
            targetType="user"
            targetId={profile.username}
            loggedIn={Boolean(session)}
            returnTo={`/u/${profile.username}`}
            compact
          />
        )}
      </section>

      <h2 className="mt-6 mb-3 text-lg font-semibold">สเปกที่แชร์</h2>
      {profile.builds.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มีสเปกสาธารณะ</p>
      ) : (
        <ul className="grid gap-4 xl:grid-cols-3 sm:grid-cols-2">
          {profile.builds.map((build) => (
            <li key={build.id}>
              <BuildCardView build={build} showOwner={false} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function ProfilePage({ params }: PageProps<'/u/[username]'>) {
  return (
    <main className="container mx-auto px-4 py-6">
      <Suspense fallback={<Skeleton className="h-40" />}>
        <ProfileContent params={params} />
      </Suspense>
    </main>
  );
}
