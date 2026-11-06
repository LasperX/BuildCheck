'use client';

import { Check, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { FormAlert } from '@/components/auth/form-field';
import { type PickedPart, PartSearchField } from '@/components/used/part-search-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { GRADE_LABELS } from '@/lib/builder/used-types';
import { USED_GRADES, type UsedGrade, type UsedSettings } from '@/lib/compat';
import { CATEGORY_LABELS, CATEGORY_SLUGS } from '@/lib/parts/spec-fields';
import {
  recomputeAllUsedStats,
  reviewUsedReport,
  saveUsedSettings,
  saveUsedSurvey,
} from '@/server/actions/used';

// ส่วนที่กดได้ในหน้าแอดมินจัดการราคามือสอง ทุกปุ่มเรียก Server Action ที่ตรวจสิทธิ์แอดมินซ้ำเอง

type Message = { ok: boolean; text: string } | null;

function Feedback({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <FormAlert
      variant={message.ok ? 'ok' : 'err'}
      icon={message.ok ? <Check aria-hidden /> : <TriangleAlert aria-hidden />}
    >
      {message.text}
    </FormAlert>
  );
}

export function ReviewButtons({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const review = (decision: 'approved' | 'rejected') =>
    startTransition(async () => {
      const result = await reviewUsedReport({ id, decision });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => review('approved')}
          aria-label={`อนุมัติรายงาน ${label}`}
        >
          <Check aria-hidden />
          อนุมัติ
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => review('rejected')}
          aria-label={`ปฏิเสธรายงาน ${label}`}
        >
          <X aria-hidden />
          ปฏิเสธ
        </Button>
      </div>
      {error && <p className="text-xs text-err-fg">{error}</p>}
    </div>
  );
}

export function SurveyForm({ today }: { today: string }) {
  const router = useRouter();
  const [part, setPart] = useState<PickedPart | null>(null);
  const [grade, setGrade] = useState<UsedGrade>('B');
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        if (!part) {
          setMessage({ ok: false, text: 'กรุณาเลือกรุ่นอะไหล่' });
          return;
        }
        startTransition(async () => {
          const result = await saveUsedSurvey({
            partId: part.id,
            grade,
            minPrice: form.get('minPrice'),
            maxPrice: form.get('maxPrice'),
            surveyedAt: form.get('surveyedAt'),
            sourceNote: form.get('sourceNote'),
          });
          setMessage(
            result.ok
              ? { ok: true, text: 'บันทึกราคาสำรวจแล้ว ระบบคำนวณราคากลางของรุ่นนี้ใหม่ให้แล้ว' }
              : { ok: false, text: result.error },
          );
          if (result.ok) router.refresh();
        });
      }}
    >
      <PartSearchField value={part} onChange={setPart} />
      <div className="grid gap-3 xl:grid-cols-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="survey-grade">เกรด</Label>
          <NativeSelect
            id="survey-grade"
            value={grade}
            onChange={(event) => setGrade(event.target.value as UsedGrade)}
          >
            {USED_GRADES.map((g) => (
              <option key={g} value={g}>
                เกรด {g} · {GRADE_LABELS[g].detail}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="minPrice">ราคาต่ำสุดที่พบ</Label>
          <Input id="minPrice" name="minPrice" inputMode="numeric" className="font-mono" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maxPrice">ราคาสูงสุดที่พบ</Label>
          <Input id="maxPrice" name="maxPrice" inputMode="numeric" className="font-mono" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="surveyedAt">วันที่สำรวจ</Label>
          <Input id="surveyedAt" name="surveyedAt" type="date" defaultValue={today} max={today} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sourceNote">สำรวจจากที่ไหน</Label>
        <Input
          id="sourceNote"
          name="sourceNote"
          maxLength={200}
          placeholder="เช่น กลุ่มซื้อขายมือสอง 12 ประกาศ, ร้านมือสอง 3 ร้าน"
        />
      </div>
      <Feedback message={message} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'กำลังบันทึก…' : 'บันทึกราคาสำรวจ'}
      </Button>
    </form>
  );
}

export function UsedSettingsForm({
  settings,
  legacySockets,
}: {
  settings: UsedSettings;
  legacySockets: string[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await saveUsedSettings({
            depreciationRates: Object.fromEntries(
              CATEGORY_SLUGS.map((cat) => [cat, form.get(`rate-${cat}`)]),
            ),
            gradeFactors: Object.fromEntries(USED_GRADES.map((g) => [g, form.get(`grade-${g}`)])),
            legacySockets: String(form.get('legacySockets') ?? ''),
          });
          setMessage(
            result.ok
              ? { ok: true, text: 'บันทึกแล้ว และคำนวณราคากลางใหม่ทั้งหมดแล้ว' }
              : { ok: false, text: result.error },
          );
          if (result.ok) router.refresh();
        });
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          สัดส่วนราคาที่เหลือต่อปี (r) แยกตามหมวด
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORY_SLUGS.map((cat) => (
            <div key={cat} className="flex flex-col gap-1.5">
              <Label htmlFor={`rate-${cat}`}>{CATEGORY_LABELS[cat]}</Label>
              <Input
                id={`rate-${cat}`}
                name={`rate-${cat}`}
                inputMode="decimal"
                defaultValue={settings.depreciationRates[cat]}
                className="font-mono"
              />
            </div>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">ตัวคูณเกรด (k)</legend>
        <div className="grid grid-cols-3 gap-3 sm:max-w-md">
          {USED_GRADES.map((g) => (
            <div key={g} className="flex flex-col gap-1.5">
              <Label htmlFor={`grade-${g}`}>เกรด {g}</Label>
              <Input
                id={`grade-${g}`}
                name={`grade-${g}`}
                inputMode="decimal"
                defaultValue={settings.gradeFactors[g]}
                className="font-mono"
              />
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="legacySockets">Socket ที่เลิกผลิตแล้ว (กฎ U05)</Label>
        <Input
          id="legacySockets"
          name="legacySockets"
          defaultValue={legacySockets.join(', ')}
          placeholder="คั่นด้วยเครื่องหมายจุลภาค"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          ว่างไว้ได้ ระบบจะไม่แจ้งกฎ U05 จนกว่าจะกรอก ควรตรวจข้อมูลจากผู้ผลิตก่อนกรอก
        </p>
      </div>
      <Feedback message={message} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'กำลังบันทึก…' : 'บันทึกและคำนวณใหม่'}
      </Button>
    </form>
  );
}

export function RecomputeButton() {
  const router = useRouter();
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await recomputeAllUsedStats();
            setMessage(
              result.ok
                ? { ok: true, text: `คำนวณแล้ว ${result.rows ?? 0} รายการ` }
                : { ok: false, text: result.error },
            );
            if (result.ok) router.refresh();
          })
        }
      >
        <RefreshCw aria-hidden className={pending ? 'animate-spin' : undefined} />
        คำนวณราคากลางใหม่ทั้งหมด
      </Button>
      {message && (
        <p role="status" className={message.ok ? 'text-xs text-ok-fg' : 'text-xs text-err-fg'}>
          {message.text}
        </p>
      )}
    </div>
  );
}
