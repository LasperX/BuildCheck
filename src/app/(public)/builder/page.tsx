import type { Metadata } from 'next';
import { Suspense } from 'react';

import { BuilderView, type InitialBuild } from '@/components/builder/builder-view';
import { Skeleton } from '@/components/ui/skeleton';
import { getSession } from '@/lib/session';
import { buildIdSchema } from '@/lib/validators/builds';
import { getBuildWithItems } from '@/server/queries/builds';
import { getSystemConfig } from '@/server/queries/settings';

export const metadata: Metadata = {
  title: 'จัดสเปก · BuildCheck',
  description: 'เลือกอะไหล่คอมพิวเตอร์ทีละชิ้น ระบบตรวจความเข้ากันได้ กำลังไฟ และราคาให้ทันที',
};

/** อ่าน Session และสเปกที่ขอแก้ (?id=) แล้วส่งให้หน้าจัดสเปกฝั่งเบราว์เซอร์ */
async function Builder({ searchParams }: { searchParams: PageProps<'/builder'>['searchParams'] }) {
  const [session, params, config] = await Promise.all([
    getSession(),
    searchParams,
    getSystemConfig(),
  ]);
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

  return (
    <BuilderView loggedIn={Boolean(session)} initialBuild={initialBuild} settings={config.engine} />
  );
}

export default function BuilderPage({ searchParams }: PageProps<'/builder'>) {
  return (
    <main>
      {/* หัวข้อเรนเดอร์จากเซิร์ฟเวอร์ทันที เป็นสิ่งแรกที่ผู้ใช้เห็นขณะหน้าจัดสเปกโหลดสเปกจากเครื่อง (ช่วยค่า LCP) */}
      <div className="container mx-auto px-4 pt-5">
        <h1 className="text-xl font-semibold">จัดสเปกคอมพิวเตอร์</h1>
        <p className="text-sm text-muted-foreground">
          เลือกอะไหล่ทีละหมวด ระบบตรวจความเข้ากันได้ กำลังไฟ และราคาให้ทันที
        </p>
      </div>
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
    </main>
  );
}
