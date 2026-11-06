import type { Metadata } from 'next';
import { Suspense } from 'react';

import { BuilderView, type InitialBuild } from '@/components/builder/builder-view';
import { Skeleton } from '@/components/ui/skeleton';
import { getSession } from '@/lib/session';
import { buildIdSchema } from '@/lib/validators/builds';
import { getBuildWithItems } from '@/server/queries/builds';

export const metadata: Metadata = {
  title: 'จัดสเปก · BuildCheck',
  description: 'เลือกอะไหล่คอมพิวเตอร์ทีละชิ้น ระบบตรวจความเข้ากันได้ กำลังไฟ และราคาให้ทันที',
};

/** อ่าน Session และสเปกที่ขอแก้ (?id=) แล้วส่งให้หน้าจัดสเปกฝั่งเบราว์เซอร์ */
async function Builder({ searchParams }: { searchParams: PageProps<'/builder'>['searchParams'] }) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  const id = buildIdSchema.safeParse(params.id);

  let initialBuild: InitialBuild | null = null;
  if (session && id.success) {
    const found = await getBuildWithItems(id.data);
    // แก้ได้เฉพาะสเปกของตัวเอง สเปกของคนอื่นต้อง Fork (เฟส 10)
    if (found && found.build.userId === session.user.id) {
      initialBuild = {
        id: found.build.id,
        meta: {
          title: found.build.title,
          description: found.build.description ?? '',
          usageType: found.build.usageType,
          budget: found.build.budget,
        },
        items: found.items.map((item) => ({
          partId: item.partId,
          categorySlug: item.part.categorySlug,
          quantity: item.quantity,
          condition: item.condition,
          offeredPrice: item.offeredPrice,
          warrantyMonthsLeft: item.warrantyMonthsLeft,
        })),
      };
    }
  }

  return <BuilderView loggedIn={Boolean(session)} initialBuild={initialBuild} />;
}

export default function BuilderPage({ searchParams }: PageProps<'/builder'>) {
  return (
    <>
      <h1 className="sr-only">จัดสเปกคอมพิวเตอร์</h1>
      <Suspense
        fallback={
          <div className="container mx-auto flex flex-col gap-3 px-4 py-6">
            <Skeleton className="h-12" />
            <Skeleton className="h-64" />
          </div>
        }
      >
        <Builder searchParams={searchParams} />
      </Suspense>
    </>
  );
}
