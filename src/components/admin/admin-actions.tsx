'use client';

import { Ban, Check, EyeOff, MailCheck, ShieldCheck, TriangleAlert, Undo2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { FormAlert } from '@/components/auth/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { USAGE_LABELS } from '@/lib/builder/types';
import type { BudgetRatios } from '@/lib/compat/budget';
import type { EngineSettings, UsageType } from '@/lib/compat';
import { CATEGORY_LABELS, CATEGORY_SLUGS } from '@/lib/parts/spec-fields';
import {
  banUser,
  resolveReport,
  setUserRole,
  unbanUser,
  updateSetting,
  verifyUserEmail,
} from '@/server/actions/admin';

// ปุ่มและฟอร์มในหน้าแอดมิน ทุกปุ่มเรียก Server Action ที่ตรวจสิทธิ์แอดมินซ้ำเองเสมอ

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

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return setError(result.error ?? 'ทำรายการไม่สำเร็จ');
      setError(null);
      after?.();
      router.refresh();
    });
  return { pending, error, run };
}

// ---------- ผู้ใช้ ----------

export function UserActions({
  userId,
  name,
  role,
  banned,
  emailVerified,
  isSelf,
}: {
  userId: string;
  name: string;
  role: 'member' | 'admin';
  banned: boolean;
  emailVerified: boolean;
  isSelf: boolean;
}) {
  const { pending, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (isSelf) return <span className="text-xs text-muted-foreground">บัญชีของคุณ</span>;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        <NativeSelect
          aria-label={`สิทธิ์ของ ${name}`}
          value={role}
          disabled={pending}
          className="h-8 w-28 text-xs"
          onChange={(event) => {
            const next = event.target.value;
            if (
              !window.confirm(
                `เปลี่ยนสิทธิ์ ${name} เป็น ${next === 'admin' ? 'แอดมิน' : 'สมาชิก'}?`,
              )
            ) {
              event.target.value = role;
              return;
            }
            run(() => setUserRole(userId, next));
          }}
        >
          <option value="member">สมาชิก</option>
          <option value="admin">แอดมิน</option>
        </NativeSelect>
        {/* ใช้แทนอีเมลยืนยันเมื่อยังไม่ได้ตั้งระบบส่งอีเมล ยืนยันเฉพาะคนที่รู้จักตัวจริง */}
        {!emailVerified && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`ยืนยันอีเมลให้ ${name}? ทำเฉพาะคนที่คุณรู้จักตัวจริง`)) {
                run(() => verifyUserEmail(userId));
              }
            }}
          >
            <MailCheck aria-hidden />
            ยืนยันอีเมลให้
          </Button>
        )}
        {banned ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => unbanUser(userId))}
          >
            <Undo2 aria-hidden />
            ปลดระงับ
          </Button>
        ) : (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={role === 'admin'}
                title={role === 'admin' ? 'ลดสิทธิ์ก่อนระงับ' : undefined}
              >
                <Ban aria-hidden />
                ระงับ
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ระงับ {name}</DialogTitle>
                <DialogDescription>
                  ผู้ใช้จะออกจากระบบทุกอุปกรณ์ทันที ล็อกอินใหม่ไม่ได้ และสเปกถูกซ่อนจากหน้าชุมชน
                  ปลดระงับภายหลังได้
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`ban-${userId}`}>เหตุผล (บันทึกในบันทึกการทำงาน)</Label>
                <Input
                  id={`ban-${userId}`}
                  value={reason}
                  maxLength={200}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-err-fg">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending || reason.trim().length === 0}
                  onClick={() =>
                    run(
                      () => banUser(userId, reason),
                      () => setOpen(false),
                    )
                  }
                >
                  ยืนยันระงับ
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {error && !open && (
        <p role="alert" className="text-xs text-err-fg">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------- รายงาน ----------

export function ReportActions({ reportId, canHide }: { reportId: number; canHide: boolean }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        {canHide && (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (window.confirm('ซ่อนเนื้อหานี้และปิดรายงาน?'))
                run(() => resolveReport(reportId, 'hide'));
            }}
          >
            <EyeOff aria-hidden />
            ซ่อนเนื้อหา
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => resolveReport(reportId, 'dismiss'))}
        >
          <X aria-hidden />
          ไม่ผิดกติกา
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

// ---------- ตั้งค่าระบบ ----------

const pct = (value: number) => Math.round(value * 1000) / 10;

/** ค่าเผื่อกำลังไฟและวัตต์พื้นฐานของเมนบอร์ด */
export function EngineSettingsForm({ settings }: { settings: EngineSettings }) {
  const { pending, run } = useAction();
  const [message, setMessage] = useState<Message>(null);
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const headroom = Number(form.get('headroom')) / 100;
        const watt = Number(form.get('watt'));
        run(async () => {
          const a = await updateSetting('psu_headroom', headroom);
          if (!a.ok) {
            setMessage({ ok: false, text: a.error });
            return a;
          }
          const b = await updateSetting('mb_default_watt', watt);
          setMessage(
            b.ok
              ? { ok: true, text: 'บันทึกแล้ว ทุกหน้าที่ตรวจสเปกใช้ค่าใหม่ทันที' }
              : { ok: false, text: b.error },
          );
          return b;
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="headroom">ค่าเผื่อกำลังไฟ PSU (%)</Label>
          <Input
            id="headroom"
            name="headroom"
            inputMode="decimal"
            defaultValue={pct(settings.psuHeadroom)}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            PSU ที่แนะนำ = วัตต์รวม × (1 + ค่าเผื่อ) ปัดขึ้นหลัก 50
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="watt">วัตต์พื้นฐานของเมนบอร์ด (W)</Label>
          <Input
            id="watt"
            name="watt"
            inputMode="numeric"
            defaultValue={settings.motherboardDefaultWatt}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            ใช้เมื่อแอดมินไม่ได้กรอกวัตต์ของเมนบอร์ดรุ่นนั้น
          </p>
        </div>
      </div>
      <Feedback message={message} />
      <Button type="submit" disabled={pending} className="self-start">
        บันทึก
      </Button>
    </form>
  );
}

/** น้ำหนักคะแนน CPU/การ์ดจอตามประเภทการใช้งาน (หัวข้อ 4.4) */
export function WeightsForm({ weights }: { weights: EngineSettings['usageWeights'] }) {
  const { pending, run } = useAction();
  const [message, setMessage] = useState<Message>(null);
  const usages = Object.keys(USAGE_LABELS) as UsageType[];
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const value = Object.fromEntries(
          usages.map((usage) => [
            usage,
            {
              cpu: Number(form.get(`${usage}-cpu`)) / 100,
              gpu: Number(form.get(`${usage}-gpu`)) / 100,
            },
          ]),
        );
        run(async () => {
          const result = await updateSetting('usage_weights', value);
          setMessage(
            result.ok ? { ok: true, text: 'บันทึกแล้ว' } : { ok: false, text: result.error },
          );
          return result;
        });
      }}
    >
      <table className="w-full max-w-lg text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="py-1 text-left font-normal">
              ประเภท
            </th>
            <th scope="col" className="py-1 text-left font-normal">
              CPU (%)
            </th>
            <th scope="col" className="py-1 text-left font-normal">
              การ์ดจอ (%)
            </th>
          </tr>
        </thead>
        <tbody>
          {usages.map((usage) => (
            <tr key={usage}>
              <th scope="row" className="py-1 pr-3 text-left font-normal">
                {USAGE_LABELS[usage]}
              </th>
              <td className="py-1 pr-2">
                <Input
                  aria-label={`${USAGE_LABELS[usage]} CPU`}
                  name={`${usage}-cpu`}
                  inputMode="decimal"
                  defaultValue={pct(weights[usage].cpu)}
                  className="h-9 font-mono"
                />
              </td>
              <td className="py-1">
                <Input
                  aria-label={`${USAGE_LABELS[usage]} การ์ดจอ`}
                  name={`${usage}-gpu`}
                  inputMode="decimal"
                  defaultValue={pct(weights[usage].gpu)}
                  className="h-9 font-mono"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">แต่ละแถวต้องรวมได้ 100%</p>
      <Feedback message={message} />
      <Button type="submit" disabled={pending} className="self-start">
        บันทึกน้ำหนัก
      </Button>
    </form>
  );
}

/** สัดส่วนงบตามประเภทการใช้งาน (หัวข้อ 4.5) แสดงผลรวมสดระหว่างพิมพ์ */
export function BudgetRatiosForm({ ratios }: { ratios: Record<UsageType, BudgetRatios> }) {
  const { pending, run } = useAction();
  const [usage, setUsage] = useState<UsageType>('gaming');
  const [values, setValues] = useState(
    () =>
      Object.fromEntries(
        (Object.keys(ratios) as UsageType[]).map((u) => [
          u,
          Object.fromEntries(CATEGORY_SLUGS.map((cat) => [cat, String(pct(ratios[u][cat]))])),
        ]),
      ) as Record<UsageType, Record<string, string>>,
  );
  const [message, setMessage] = useState<Message>(null);
  const current = values[usage];
  const sum = CATEGORY_SLUGS.reduce((total, cat) => total + (Number(current[cat]) || 0), 0);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const value = Object.fromEntries(
          CATEGORY_SLUGS.map((cat) => [cat, (Number(current[cat]) || 0) / 100]),
        );
        run(async () => {
          const result = await updateSetting(`budget_ratio_${usage}`, value);
          setMessage(
            result.ok
              ? { ok: true, text: `บันทึกสัดส่วนงบ${USAGE_LABELS[usage]}แล้ว` }
              : { ok: false, text: result.error },
          );
          return result;
        });
      }}
    >
      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="ratio-usage">ประเภทการใช้งาน</Label>
        <NativeSelect
          id="ratio-usage"
          value={usage}
          onChange={(e) => {
            setUsage(e.target.value as UsageType);
            setMessage(null);
          }}
        >
          {(Object.keys(USAGE_LABELS) as UsageType[]).map((u) => (
            <option key={u} value={u}>
              {USAGE_LABELS[u]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CATEGORY_SLUGS.map((cat) => (
          <div key={cat} className="flex flex-col gap-1.5">
            <Label htmlFor={`ratio-${cat}`}>{CATEGORY_LABELS[cat]} (%)</Label>
            <Input
              id={`ratio-${cat}`}
              inputMode="decimal"
              value={current[cat]}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  [usage]: { ...prev[usage], [cat]: e.target.value },
                }))
              }
              className="font-mono"
            />
          </div>
        ))}
      </div>
      <p
        role="status"
        className={Math.abs(sum - 100) < 0.5 ? 'text-sm text-ok-fg' : 'text-sm text-err-fg'}
      >
        รวม <span className="font-mono font-semibold">{Math.round(sum * 10) / 10}%</span>
        {Math.abs(sum - 100) >= 0.5 && ' ต้องรวมได้ 100%'}
      </p>
      <Feedback message={message} />
      <Button type="submit" disabled={pending || Math.abs(sum - 100) >= 0.5} className="self-start">
        <ShieldCheck aria-hidden />
        บันทึกสัดส่วนงบ
      </Button>
    </form>
  );
}
