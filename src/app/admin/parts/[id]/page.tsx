import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { PartForm } from '@/components/admin/part-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORY_LABELS } from '@/lib/parts/spec-fields';
import { requireAdmin } from '@/lib/session';
import { getPartForEdit, listBrands } from '@/server/queries/admin-parts';

export const metadata: Metadata = { title: 'แก้ไขอะไหล่ · BuildCheck' };

async function EditContent({ params }: { params: PageProps<'/admin/parts/[id]'>['params'] }) {
  await requireAdmin();
  const { id } = await params;
  const partId = Number(id);
  if (!Number.isInteger(partId) || partId <= 0) notFound();

  const [part, brands] = await Promise.all([getPartForEdit(partId), listBrands()]);
  if (!part) notFound();

  return (
    <>
      <p className="mt-1 text-sm text-muted-foreground">หมวด {CATEGORY_LABELS[part.category]}</p>
      <div className="mt-4 flex flex-col gap-4">
        <PartForm category={part.category} brands={brands} initial={part.values} />
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>ประวัติราคา</CardTitle>
          </CardHeader>
          <CardContent>
            {part.history.length === 0 ? (
              <p className="text-muted-foreground">ยังไม่มีประวัติราคา</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {part.history.map((entry) => (
                  <li key={entry.changedAt.toISOString()} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      {entry.changedAt.toLocaleDateString('th-TH', {
                        dateStyle: 'medium',
                        timeZone: 'Asia/Bangkok',
                      })}
                    </span>
                    <span className="font-mono">฿{entry.price.toLocaleString('en-US')}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function EditPartPage({ params }: PageProps<'/admin/parts/[id]'>) {
  return (
    <>
      <h1 className="t-h1">แก้ไขอะไหล่</h1>
      <Suspense fallback={<Skeleton className="mt-4 h-96 rounded-lg" />}>
        <EditContent params={params} />
      </Suspense>
    </>
  );
}
