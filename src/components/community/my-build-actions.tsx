'use client';

import { Eye, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { VisibilitySelect } from '@/components/builder/visibility-select';
import { Button } from '@/components/ui/button';
import type { Visibility } from '@/lib/builder/types';
import { deleteBuild } from '@/server/actions/builds';
import { useBuilderStore } from '@/stores/builder-store';

import { ForkButton } from './build-actions';

/** ปุ่มจัดการสเปกในหน้าสเปกของฉัน: แก้ ดู คัดลอก เปลี่ยนการมองเห็น ลบ */
export function MyBuildActions({
  buildId,
  title,
  visibility,
}: {
  buildId: string;
  title: string;
  visibility: Visibility;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
      <VisibilitySelect buildId={buildId} value={visibility} id={`visibility-${buildId}`} />
      <div className="flex flex-wrap gap-1">
        <Button asChild size="sm">
          <Link href={`/builder?id=${buildId}`}>
            <Pencil aria-hidden />
            แก้ไข
          </Link>
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link href={`/builds/${buildId}`}>
            <Eye aria-hidden />
            ดู
          </Link>
        </Button>
        <ForkButton buildId={buildId} loggedIn label="คัดลอก" size="sm" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          aria-label={`ลบสเปก ${title}`}
          onClick={() => {
            if (
              !window.confirm(
                `ลบสเปก "${title}"? คอมเมนต์และโหวตของสเปกนี้จะหายไปด้วย กู้คืนไม่ได้`,
              )
            )
              return;
            startTransition(async () => {
              const result = await deleteBuild(buildId);
              if (!result.ok) return setError(result.error);
              // ถ้ากำลังแก้สเปกนี้อยู่ในหน้าจัดสเปก ให้เลิกผูกกับรหัสที่ถูกลบ
              const store = useBuilderStore.getState();
              if (store.buildId === buildId) store.reset();
              router.refresh();
            });
          }}
        >
          <Trash2 aria-hidden />
          ลบ
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-err-fg">
          {error}
        </p>
      )}
    </div>
  );
}
