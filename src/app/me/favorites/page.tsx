import { Heart } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { BuildCardView } from '@/components/community/build-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { requireUser } from '@/lib/session';
import { getMyFavorites } from '@/server/queries/community';

export const metadata: Metadata = { title: 'รายการโปรด · BuildCheck' };

// /me/favorites (หัวข้อ 5.1 และมติ Q6 "ติดตามสเปก" = บันทึกเป็นรายการโปรด)

async function FavoritesContent() {
  const user = await requireUser();
  const builds = await getMyFavorites(user.id);
  if (builds.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center">
        <Heart aria-hidden className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-2 font-medium">ยังไม่มีรายการโปรด</p>
        <p className="mt-1 text-sm text-muted-foreground">
          กดปุ่ม “บันทึกเป็นรายการโปรด” ในหน้าสเปกที่สนใจ
        </p>
        <Button asChild variant="secondary" className="mt-4">
          <Link href="/builds">ไปหน้าชุมชน</Link>
        </Button>
      </div>
    );
  }
  return (
    <ul className="mt-5 grid gap-4 xl:grid-cols-3 sm:grid-cols-2">
      {builds.map((build) => (
        <li key={build.id}>
          <BuildCardView build={build} />
        </li>
      ))}
    </ul>
  );
}

export default function FavoritesPage() {
  return (
    <main className="container mx-auto px-4 py-6">
      <h1 className="t-h1">รายการโปรด</h1>
      <Suspense fallback={<Skeleton className="mt-5 h-64" />}>
        <FavoritesContent />
      </Suspense>
    </main>
  );
}
