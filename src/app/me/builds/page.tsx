import { Cpu, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { BuildCardView } from '@/components/community/build-card';
import { MyBuildActions } from '@/components/community/my-build-actions';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { requireUser } from '@/lib/session';
import { getMyBuilds } from '@/server/queries/community';

export const metadata: Metadata = { title: 'สเปกของฉัน · BuildCheck' };

// /me/builds (หัวข้อ 5.1) สเปกทั้งหมดของตัวเอง แก้ ลบ คัดลอก เปลี่ยนสาธารณะ/ส่วนตัว

async function MyBuildsContent() {
  const user = await requireUser();
  // อ่านด้วย id จาก Session เท่านั้น
  const builds = await getMyBuilds(user.id);

  if (builds.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center">
        <Cpu aria-hidden className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-2 font-medium">ยังไม่มีสเปกที่บันทึกไว้</p>
        <p className="mt-1 text-sm text-muted-foreground">
          จัดสเปกขณะล็อกอินอยู่ ระบบจะบันทึกให้อัตโนมัติ
        </p>
        <Button asChild className="mt-4">
          <Link href="/builder">เริ่มจัดสเปก</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="mt-5 grid gap-4 xl:grid-cols-3 sm:grid-cols-2">
      {builds.map((build) => (
        <li key={build.id}>
          <BuildCardView
            build={build}
            showOwner={false}
            footer={
              <MyBuildActions
                buildId={build.id}
                title={build.title}
                visibility={build.visibility}
              />
            }
          />
        </li>
      ))}
    </ul>
  );
}

export default function MyBuildsPage() {
  return (
    <main className="container mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="t-h1">สเปกของฉัน</h1>
        <Button asChild>
          <Link href="/builder">
            <Plus aria-hidden />
            ไปหน้าจัดสเปก
          </Link>
        </Button>
      </div>
      <Suspense
        fallback={
          <div className="mt-5 grid gap-4 xl:grid-cols-3 sm:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        }
      >
        <MyBuildsContent />
      </Suspense>
    </main>
  );
}
