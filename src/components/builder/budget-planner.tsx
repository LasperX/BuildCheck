'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CircleCheck, Info, Pencil, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { FormAlert } from '@/components/auth/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  type BudgetOptionView,
  type BudgetResponse,
  OPTION_LABELS,
} from '@/lib/builder/budget-types';
import { USAGE_LABELS } from '@/lib/builder/types';
import type { BudgetRatios } from '@/lib/compat/budget';
import type { UsageType } from '@/lib/compat';
import { formatBaht } from '@/lib/parts/catalog';
import { CATEGORY_LABELS, type CategorySlug } from '@/lib/parts/spec-fields';
import { cn } from '@/lib/utils';
import { budgetInputSchema } from '@/lib/validators/budget';
import { generateBudgetBuilds } from '@/server/actions/budget';
import { useBuilderStore } from '@/stores/builder-store';

import { LEVEL_UI } from './levels';

type FormInput = z.input<typeof budgetInputSchema>;
const USAGES = Object.keys(USAGE_LABELS) as UsageType[];

/** หน้าจัดสเปกตามงบ (หัวข้อ 3.5) ฟอร์ม → 3 ตัวเลือก → นำไปแก้ต่อในหน้าจัดสเปก */
export function BudgetPlanner({
  cpuBrands,
  ratios,
}: {
  cpuBrands: string[];
  ratios: Record<UsageType, BudgetRatios>;
}) {
  const router = useRouter();
  const [response, setResponse] = useState<BudgetResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(budgetInputSchema),
    defaultValues: { budget: 30000, usage: 'gaming', cpuBrand: '' },
  });

  const onSubmit = (values: FormInput) =>
    startTransition(async () => {
      const result = await generateBudgetBuilds({
        ...values,
        cpuBrand: values.cpuBrand || undefined,
      });
      setResponse(result);
      requestAnimationFrame(() =>
        document.getElementById('budget-results')?.scrollIntoView({ behavior: 'smooth' }),
      );
    });

  const openInBuilder = (option: BudgetOptionView, budget: number, usage: UsageType) => {
    const store = useBuilderStore.getState();
    if (store.items.length > 0 && !store.buildId) {
      const ok = window.confirm(
        'สเปกที่จัดค้างไว้ในเครื่องนี้ยังไม่ได้บันทึก จะถูกแทนที่ ดำเนินการต่อ?',
      );
      if (!ok) return;
    }
    store.startFrom({
      meta: {
        title: `สเปก${USAGE_LABELS[usage]}งบ ${budget.toLocaleString('th-TH')} (${OPTION_LABELS[option.kind].title})`,
        description: '',
        usageType: usage,
        budget,
      },
      items: option.items.map((item) => ({
        partId: item.partId,
        categorySlug: item.categorySlug,
        quantity: item.quantity,
        condition: 'new',
        offeredPrice: null,
        warrantyMonthsLeft: null,
      })),
    });
    router.push('/builder');
  };

  // ส่วนแบ่งงบเปลี่ยนตามค่าที่กรอกอยู่ทันที ไม่ต้องกดจัดก่อน
  const liveUsage = useWatch({ control, name: 'usage' });
  const liveBudget = Number(
    String(useWatch({ control, name: 'budget' }) ?? '').replace(/[,\s฿]/g, ''),
  );
  const shownUsage: UsageType = liveUsage ?? 'gaming';
  const shownBudget = Number.isFinite(liveBudget) && liveBudget > 0 ? liveBudget : 0;

  return (
    <>
      <form
        method="post"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="mt-5 rounded-xl border border-border bg-card p-4 sm:p-5"
      >
        <div className="grid gap-4 xl:grid-cols-[180px_minmax(0,1fr)_200px_auto] xl:items-end sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="budget">งบประมาณ (บาท)</Label>
            <Input
              id="budget"
              inputMode="numeric"
              className="font-mono"
              aria-invalid={Boolean(errors.budget)}
              aria-describedby={errors.budget ? 'budget-error' : undefined}
              {...register('budget', {
                setValueAs: (value: unknown) =>
                  typeof value === 'string' ? value.replace(/[,\s฿]/g, '') : value,
              })}
            />
          </div>
          <fieldset className="flex min-w-0 flex-col gap-1.5 xl:col-span-1 sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium">ประเภทการใช้งาน</legend>
            <Controller
              control={control}
              name="usage"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 sm:grid-cols-4">
                  {USAGES.map((usage) => (
                    <button
                      key={usage}
                      type="button"
                      aria-pressed={field.value === usage}
                      onClick={() => field.onChange(usage)}
                      className="h-8 rounded-md px-2 text-sm font-medium whitespace-nowrap text-muted-foreground aria-pressed:bg-surface aria-pressed:text-foreground aria-pressed:shadow-sm"
                    >
                      {USAGE_LABELS[usage]}
                    </button>
                  ))}
                </div>
              )}
            />
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cpuBrand">ยี่ห้อ CPU ที่ชอบ (ไม่บังคับ)</Label>
            <NativeSelect id="cpuBrand" {...register('cpuBrand')}>
              <option value="">ไม่ระบุ</option>
              {cpuBrands.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'กำลังจัด…' : 'จัดให้เลย'}
            <ArrowRight aria-hidden />
          </Button>
        </div>
        {errors.budget && (
          <p id="budget-error" role="alert" className="mt-2 text-sm text-err-fg">
            {errors.budget.message}
          </p>
        )}
      </form>

      <section id="budget-results" aria-live="polite" className="scroll-mt-20">
        {response && !response.ok && (
          <div className="mt-6">
            <FormAlert variant="warn" icon={<TriangleAlert aria-hidden />}>
              {response.error}
            </FormAlert>
          </div>
        )}
        {response?.ok && (
          <>
            <h2 className="mt-8 mb-1 t-h2">
              3 ตัวเลือกจากงบ <span className="font-mono">{formatBaht(response.budget)}</span>
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {USAGE_LABELS[response.usage]} · ทุกชุดตรวจแล้วว่าไม่มีชิ้นที่ใส่ด้วยกันไม่ได้
              {response.brandFallback && ' · ไม่พบ CPU ยี่ห้อที่เลือก จึงเลือกจากทุกยี่ห้อ'}
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {response.options.map((option) => (
                <OptionCard
                  key={option.kind}
                  option={option}
                  budget={response.budget}
                  onOpen={() => openInBuilder(option, response.budget, response.usage)}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <AllocationBars budget={shownBudget} usage={shownUsage} ratios={ratios[shownUsage]} />
    </>
  );
}

function OptionCard({
  option,
  budget,
  onOpen,
}: {
  option: BudgetOptionView;
  budget: number;
  onOpen: () => void;
}) {
  const label = OPTION_LABELS[option.kind];
  const warnings = option.notes.filter((note) => note.level === 'warning');
  const infos = option.notes.filter((note) => note.level === 'info');
  const StatusIcon = option.status === 'ok' ? CircleCheck : TriangleAlert;

  return (
    <article
      aria-labelledby={`opt-${option.kind}`}
      className={cn(
        'flex flex-col rounded-xl border bg-card p-4',
        option.kind === 'balanced' ? 'border-brand' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 id={`opt-${option.kind}`} className="text-lg font-semibold">
            {label.title}
          </h3>
          <p className="text-xs text-muted-foreground">{label.hint}</p>
        </div>
        <Badge variant={option.status === 'ok' ? 'ok' : 'warn'}>
          <StatusIcon aria-hidden />
          {option.status === 'ok' ? 'เข้ากันได้' : `เตือน ${warnings.length}`}
        </Badge>
      </div>

      <p className="mt-3 font-mono text-3xl font-semibold tabular-nums">
        {formatBaht(option.total)}
      </p>
      <p className="text-xs text-muted-foreground">
        {Math.round((option.total / budget) * 100)}% ของงบ · เหลือ{' '}
        {formatBaht(budget - option.total)}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-surface-2 p-2">
          <dt className="text-muted-foreground">คะแนน</dt>
          <dd className="font-mono text-base font-semibold">{option.score}</dd>
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <dt className="text-muted-foreground">ความคุ้มค่า</dt>
          <dd className="font-mono text-base font-semibold">{option.value}</dd>
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <dt className="text-muted-foreground">กำลังไฟ</dt>
          <dd className="font-mono text-base font-semibold">{option.totalWatt} W</dd>
        </div>
      </dl>

      <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm">
        {option.items.map((item) => (
          <li key={item.partId} className="flex items-baseline justify-between gap-2">
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">
                {CATEGORY_LABELS[item.categorySlug]}
              </span>
              <span className="line-clamp-2">
                {item.brandName} {item.model}
                {item.quantity > 1 && <span className="font-mono"> × {item.quantity}</span>}
              </span>
            </span>
            <span className="shrink-0 font-mono tabular-nums">
              {formatBaht(item.price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      {(warnings.length > 0 || infos.length > 0) && (
        <ul className="mt-3 flex flex-col gap-1 text-xs">
          {[...warnings, ...infos].map((note, index) => {
            const ui = LEVEL_UI[note.level];
            const Icon = note.level === 'info' ? Info : ui.icon;
            return (
              <li key={`${note.code}-${index}`} className={cn('flex items-start gap-1', ui.text)}>
                <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {note.code.startsWith('R') && (
                    <span className="font-mono font-semibold">{note.code} </span>
                  )}
                  {note.title}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        type="button"
        className="mt-4"
        variant={option.kind === 'balanced' ? 'default' : 'secondary'}
        onClick={onOpen}
      >
        <Pencil aria-hidden />
        นำไปแก้ต่อในหน้าจัดสเปก
      </Button>
    </article>
  );
}

/**
 * งบถูกแบ่งอย่างไร: แท่งแนวนอนเรียงจากมากไปน้อย สีเดียว พร้อมตัวเลขทุกแถว
 * ใช้แทนกราฟวงกลม เพราะ 8 หมวดอ่านค่าจากมุมของวงกลมได้ยาก (บันทึกใน spec-review หัวข้อ E)
 */
function AllocationBars({
  budget,
  usage,
  ratios,
}: {
  budget: number;
  usage: UsageType;
  ratios: BudgetRatios;
}) {
  const rows = (Object.entries(ratios) as [CategorySlug, number][])
    .filter(([, ratio]) => ratio > 0)
    .sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] ?? 1;

  return (
    <section
      aria-labelledby="alloc-title"
      className="mt-8 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <h2 id="alloc-title" className="text-lg font-semibold">
        งบถูกแบ่งอย่างไร
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        สัดส่วนตั้งต้นของประเภท{USAGE_LABELS[usage]} จากงบ {formatBaht(budget)}{' '}
        แอดมินปรับได้ในหน้าตั้งค่า หมวดที่ไม่ต้องซื้อ (เช่น CPU มีพัดลมแถม)
        จะคืนงบให้หมวดอื่นตามสัดส่วน
      </p>
      <table className="w-full text-sm">
        <caption className="sr-only">สัดส่วนงบแต่ละหมวด</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">หมวด</th>
            <th scope="col">สัดส่วน</th>
            <th scope="col">งบ (บาท)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([cat, ratio]) => (
            <tr
              key={cat}
              title={`${CATEGORY_LABELS[cat]} ${Math.round(ratio * 100)}% ≈ ${formatBaht(budget * ratio)}`}
            >
              <th scope="row" className="w-36 py-1.5 pr-3 text-left font-normal whitespace-nowrap">
                {CATEGORY_LABELS[cat]}
              </th>
              <td className="py-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-3 flex-1">
                    <div
                      aria-hidden
                      className="h-full rounded-r-[4px] bg-chart-1"
                      style={{ width: `${(ratio / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-xs text-muted-foreground">
                    {Math.round(ratio * 100)}%
                  </span>
                </div>
              </td>
              <td className="w-24 py-1.5 pl-3 text-right font-mono tabular-nums">
                {formatBaht(budget * ratio)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
