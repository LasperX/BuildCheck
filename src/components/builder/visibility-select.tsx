'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { VISIBILITY_LABELS, type Visibility } from '@/lib/builder/types';
import { shareBuild } from '@/server/actions/builds';

/** เจ้าของเปลี่ยนว่าใครเห็นสเปกได้ จากหน้ารายละเอียดสเปก */
export function VisibilitySelect({
  buildId,
  value,
  id = 'build-visibility',
}: {
  buildId: string;
  value: Visibility;
  /** หน้าที่มีหลายช่องต้องใช้ id ไม่ซ้ำกัน */
  id?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>ใครเห็นได้</Label>
      <NativeSelect
        id={id}
        defaultValue={value}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as Visibility;
          startTransition(async () => {
            const result = await shareBuild(buildId, next);
            setError(result.ok ? null : result.error);
            router.refresh();
          });
        }}
      >
        {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((key) => (
          <option key={key} value={key}>
            {VISIBILITY_LABELS[key]}
          </option>
        ))}
      </NativeSelect>
      {error && (
        <p role="alert" className="text-xs text-err-fg">
          {error}
        </p>
      )}
    </div>
  );
}
