'use client';

import { CircleCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';

import { FormAlert } from '@/components/auth/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { CHANNEL_LABELS, GRADE_LABELS, REPORT_TYPE_LABELS } from '@/lib/builder/used-types';
import { USED_GRADES } from '@/lib/compat';
import { usedReportSchema } from '@/lib/validators/used';
import { submitUsedReport } from '@/server/actions/used';

import { type PickedPart, PartSearchField } from './part-search-field';

// ฟอร์มรายงานราคามือสอง /used/report (หัวข้อ 3.11, 5.4)
// ตรวจด้วย Zod schema เดียวกับฝั่งเซิร์ฟเวอร์ก่อนส่ง แล้วเซิร์ฟเวอร์ตรวจซ้ำอีกรอบ

export function UsedReportForm({
  initialPart,
  today,
}: {
  initialPart: PickedPart | null;
  today: string;
}) {
  const [part, setPart] = useState<PickedPart | null>(initialPart);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    if (part) form.set('partId', String(part.id));
    const check = usedReportSchema.safeParse(
      Object.fromEntries([...form.entries()].filter(([key]) => key !== 'proof')),
    );
    if (!part) return setError('กรุณาเลือกรุ่นอะไหล่');
    if (!check.success) return setError(check.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
    const proof = form.get('proof');
    if (proof instanceof File && proof.size > 2 * 1024 * 1024) {
      return setError('รูปต้องมีขนาดไม่เกิน 2 MB');
    }
    startTransition(async () => {
      const result = await submitUsedReport(form);
      if (!result.ok) return setError(result.error);
      setDone(true);
      formRef.current?.reset();
    });
  };

  if (done) {
    return (
      <div className="mt-5 flex flex-col items-start gap-3 rounded-xl border border-ok-border bg-ok-soft p-5">
        <p className="flex items-center gap-2 font-semibold text-ok-fg">
          <CircleCheck aria-hidden className="size-5" />
          ส่งรายงานแล้ว ขอบคุณที่ช่วยกัน
        </p>
        <p className="text-sm">
          แอดมินจะตรวจก่อนนำไปคำนวณราคากลาง ผลการตรวจจะแจ้งในการแจ้งเตือนของคุณ
        </p>
        <div className="flex gap-2">
          <Button type="button" onClick={() => setDone(false)}>
            รายงานอีกรายการ
          </Button>
          <Button asChild variant="secondary">
            <Link href="/used">กลับไปตลาดมือสอง</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="mt-5 flex max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <PartSearchField value={part} onChange={setPart} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="price">ราคา (บาท)</Label>
          <Input id="price" name="price" inputMode="numeric" className="font-mono" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="grade">เกรดสภาพ</Label>
          <NativeSelect id="grade" name="grade" defaultValue="B">
            {USED_GRADES.map((grade) => (
              <option key={grade} value={grade}>
                เกรด {grade} · {GRADE_LABELS[grade].detail}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reportType">ประเภทรายงาน</Label>
          <NativeSelect id="reportType" name="reportType" defaultValue="bought">
            {Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="channel">ช่องทาง</Label>
          <NativeSelect id="channel" name="channel" defaultValue="facebook">
            {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="province">จังหวัด (ไม่บังคับ)</Label>
          <Input id="province" name="province" maxLength={40} placeholder="เช่น กรุงเทพมหานคร" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="seenAt">วันที่เห็นหรือซื้อขาย</Label>
          <Input id="seenAt" name="seenAt" type="date" defaultValue={today} max={today} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="warrantyMonthsLeft">ประกันเหลือ (เดือน)</Label>
          <Input
            id="warrantyMonthsLeft"
            name="warrantyMonthsLeft"
            inputMode="numeric"
            defaultValue="0"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">0 = ไม่มีประกัน</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="proof">รูปหลักฐาน (ไม่บังคับ)</Label>
          <Input
            id="proof"
            name="proof"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="h-auto py-1.5"
          />
          <p className="text-xs text-muted-foreground">
            JPG, PNG หรือ WebP ไม่เกิน 2 MB ปิดชื่อและเบอร์โทรในรูปก่อนส่ง
          </p>
        </div>
      </div>

      {error && (
        <FormAlert variant="err" icon={<TriangleAlert aria-hidden />}>
          {error}
        </FormAlert>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'กำลังส่ง…' : 'ส่งรายงาน'}
      </Button>
    </form>
  );
}
