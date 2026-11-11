'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CircleCheck, Info, Pencil, Recycle, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Controller, type UseFormSetValue, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { FormAlert } from '@/components/auth/form-field';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PartImage } from '@/components/parts/part-icon';
import { NativeSelect } from '@/components/ui/native-select';
import { SegmentIndicator } from '@/components/ui/segment-indicator';
import {
  type BudgetOptionView,
  type BudgetResponse,
  OPTION_LABELS,
} from '@/lib/builder/budget-types';
import { USAGE_LABELS } from '@/lib/builder/types';
import { type BudgetRatios, DEFAULT_USED_CATEGORIES } from '@/lib/compat/budget';
import { GRADE_LABELS } from '@/lib/builder/used-types';
import type { UsageType } from '@/lib/compat';
import { formatBaht } from '@/lib/parts/catalog';
import { CATEGORY_LABELS, CATEGORY_SLUGS, type CategorySlug } from '@/lib/parts/spec-fields';
import { cn } from '@/lib/utils';
import { budgetInputSchema } from '@/lib/validators/budget';
import { generateBudgetBuilds } from '@/server/actions/budget';
import { useBuilderStore } from '@/stores/builder-store';

import { LEVEL_UI } from './levels';

type FormInput = z.input<typeof budgetInputSchema>;
const USAGES = Object.keys(USAGE_LABELS) as UsageType[];

const DEFAULT_BUDGET = '40000';

type FailedResponse = Extract<BudgetResponse, { ok: false }>;

/**
 * เมื่องบไม่พอ แสดงทางเลือกที่เซิร์ฟเวอร์ลองจัดแล้วว่าได้ผล กดแล้วเปลี่ยนค่าในฟอร์มและจัดใหม่ทันที
 * ผู้ใช้จึงไม่เจอทางตัน และเห็นว่าฟอร์มถูกเปลี่ยนเป็นอะไร (แก้กลับเองได้)
 */
function AlternativeList({
  response,
  pending,
  onTry,
  setValue,
}: {
  response: FailedResponse;
  pending: boolean;
  onTry: (change: () => void) => void;
  setValue: UseFormSetValue<FormInput>;
}) {
  const rows: { key: string; title: string; detail: string; apply: () => void }[] = [];
  const minimum = response.minimumBudget ?? null;
  const currentBudget = response.budget ?? 0;

  for (const alt of response.alternatives ?? []) {
    if (alt.kind === 'used') {
      const sameBudget = alt.budget <= currentBudget;
      rows.push({
        key: 'used',
        title: sameBudget
          ? `รวมอะไหล่มือสอง จัดได้ในงบ ${formatBaht(currentBudget)}`
          : `รวมอะไหล่มือสอง เริ่มที่ ${formatBaht(alt.budget)}`,
        detail:
          'คิดราคากลางมือสองเกรด B ทุกหมวดยกเว้น PSU' +
          (minimum && !sameBudget
            ? ` · ถูกกว่าซื้อมือหนึ่งทั้งชุด ${formatBaht(minimum - alt.budget)}`
            : ''),
        apply: () => {
          setValue('allowUsed', true);
          setValue('usedCategories', [...DEFAULT_USED_CATEGORIES]);
          setValue('usedGrade', 'B');
          if (!sameBudget) setValue('budget', String(alt.budget));
        },
      });
    } else if (alt.kind === 'brand') {
      rows.push({
        key: 'brand',
        title: 'ไม่จำกัดยี่ห้อ CPU',
        detail: 'ยี่ห้อที่เลือกไว้ยังไม่มีรุ่นที่ลงงบนี้ได้',
        apply: () => setValue('cpuBrand', ''),
      });
    } else {
      rows.push({
        key: `usage-${alt.usage}`,
        title: `ใช้${USAGE_LABELS[alt.usage]} จัดได้ในงบนี้`,
        detail:
          response.usage === 'gaming'
            ? 'ถ้าไม่ได้ต้องการเล่นเกมหนัก ๆ ประเภทนี้ไม่ต้องใช้การ์ดจอแรง'
            : 'ลองจัดให้แล้ว ได้ชุดที่เข้ากันได้ในงบเดิม',
        apply: () => setValue('usage', alt.usage),
      });
    }
  }
  if (minimum) {
    rows.push({
      key: 'minimum',
      title: `เพิ่มงบเป็น ${formatBaht(minimum)}`,
      detail: `งบขั้นต่ำสำหรับ${response.usage ? USAGE_LABELS[response.usage] : 'ประเภทนี้'} ซื้อมือหนึ่งทั้งชุด`,
      apply: () => setValue('budget', String(minimum)),
    });
  }
  if (rows.length === 0) return null;

  return (
    <div className="mt-3 anim-slot-in rounded-xl border border-border bg-card p-4">
      <h3 className="font-semibold">ลองทางเลือกเหล่านี้</h3>
      <p className="text-xs text-muted-foreground">
        ทุกข้อลองจัดให้แล้วว่าได้ชุดที่ใส่ด้วยกันได้จริง
      </p>
      <ul className="mt-3 flex flex-col divide-y divide-border">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{row.title}</p>
              <p className="text-xs text-muted-foreground">{row.detail}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => onTry(row.apply)}
            >
              ลองเลย
              <ArrowRight aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
    setValue,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(budgetInputSchema),
    // งบเริ่มต้นมาจาก defaultValue ของช่องที่ render จากเซิร์ฟเวอร์ ไม่ใส่ตรงนี้ เพื่อให้ตอนสคริปต์
    // โหลดเสร็จ RHF อ่านค่าจากช่องแทนการเขียนทับ (การเขียนทับทำให้ตัวที่กำลังพิมพ์หาย)
    defaultValues: {
      usage: 'gaming',
      cpuBrand: '',
      allowUsed: false,
      usedCategories: [...DEFAULT_USED_CATEGORIES],
      usedGrade: 'B',
    },
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

  // มาจากช่องใส่งบด่วนในหน้าแรก (/budget?budget=30000&usage=gaming) → ใส่ค่าแล้วจัดให้ทันที
  const autoRun = useRef(false);
  useEffect(() => {
    if (autoRun.current) return;
    autoRun.current = true;
    const params = new URLSearchParams(window.location.search);
    const quick = params.get('budget');
    if (!quick) return;
    setValue('budget', quick.replace(/\D/g, ''));
    const usage = params.get('usage');
    if (usage && usage in USAGE_LABELS) setValue('usage', usage as UsageType);
    void handleSubmit(onSubmit)();
    // ทำครั้งเดียวตอนเปิดหน้า
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        condition: item.condition,
        offeredPrice: null,
        warrantyMonthsLeft: null,
      })),
    });
    router.push('/builder');
  };

  const budgetField = register('budget', {
    setValueAs: (value: unknown) =>
      typeof value === 'string' ? value.replace(/[,\s฿]/g, '') : value,
  });

  // ส่วนแบ่งงบเปลี่ยนตามค่าที่กรอกอยู่ทันที ไม่ต้องกดจัดก่อน
  const liveUsage = useWatch({ control, name: 'usage' });
  const liveBudget = Number(
    String(useWatch({ control, name: 'budget', defaultValue: DEFAULT_BUDGET }) ?? '').replace(
      /[,\s฿]/g,
      '',
    ),
  );
  const shownUsage: UsageType = liveUsage ?? 'gaming';
  const shownBudget = Number.isFinite(liveBudget) && liveBudget > 0 ? liveBudget : 0;
  const allowUsed = useWatch({ control, name: 'allowUsed' });

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
              defaultValue={DEFAULT_BUDGET}
              {...budgetField}
              ref={(el) => {
                budgetField.ref(el);
                // ผู้ใช้พิมพ์งบก่อนสคริปต์โหลดเสร็จ → แจ้ง RHF ให้ส่วนแบ่งงบอัปเดตตาม
                if (el && el.value !== DEFAULT_BUDGET) {
                  setValue('budget', el.value.replace(/[,\s฿]/g, ''));
                }
              }}
            />
          </div>
          <fieldset className="flex min-w-0 flex-col gap-1.5 xl:col-span-1 sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium">ประเภทการใช้งาน</legend>
            <Controller
              control={control}
              name="usage"
              render={({ field }) => (
                <div className="group/seg relative grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 sm:grid-cols-4">
                  <SegmentIndicator
                    selector="[aria-pressed=true]"
                    className="bg-surface shadow-sm"
                  />
                  {USAGES.map((usage) => (
                    <button
                      key={usage}
                      type="button"
                      aria-pressed={field.value === usage}
                      onClick={() => field.onChange(usage)}
                      className="relative z-10 h-8 rounded-md px-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-200 hover:text-foreground aria-pressed:bg-surface aria-pressed:text-foreground aria-pressed:shadow-sm group-data-[seg=ready]/seg:aria-pressed:bg-transparent group-data-[seg=ready]/seg:aria-pressed:shadow-none"
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

        <div className="mt-4 border-t border-border pt-4">
          <Controller
            control={control}
            name="allowUsed"
            render={({ field }) => (
              <div>
                <label className="flex items-center gap-2 text-sm font-medium whitespace-nowrap">
                  <Checkbox
                    aria-describedby="allow-used-hint"
                    checked={Boolean(field.value)}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  <Recycle aria-hidden className="size-4 text-used-fg" />
                  ยอมใช้มือสอง
                </label>
                <p id="allow-used-hint" className="mt-1 pl-6 text-xs text-muted-foreground">
                  ใช้ราคากลางมือสองในหมวดที่เลือก เพื่อให้ได้สเปกแรงขึ้นในงบเท่าเดิม
                </p>
              </div>
            )}
          />
          {allowUsed && (
            <div className="mt-3 flex flex-col gap-3 rounded-lg border border-used-border bg-used-soft/50 p-3">
              <Controller
                control={control}
                name="usedCategories"
                render={({ field }) => {
                  const value = field.value ?? [];
                  return (
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium">หมวดที่ยอมเป็นมือสอง</legend>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {CATEGORY_SLUGS.map((cat) => (
                          <label key={cat} className="flex items-center gap-1.5 text-sm">
                            <Checkbox
                              checked={value.includes(cat)}
                              onCheckedChange={(checked) =>
                                field.onChange(
                                  checked === true
                                    ? [...value, cat]
                                    : value.filter((item) => item !== cat),
                                )
                              }
                            />
                            {CATEGORY_LABELS[cat]}
                          </label>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        PSU ปิดไว้เป็นค่าเริ่มต้น เพราะ PSU มือสองที่เสียอาจพาอะไหล่อื่นเสียด้วย
                      </p>
                    </fieldset>
                  );
                }}
              />
              <div className="flex max-w-xs flex-col gap-1.5">
                <Label htmlFor="usedGrade">คิดราคามือสองจากเกรด</Label>
                <NativeSelect id="usedGrade" {...register('usedGrade')}>
                  {(['A', 'B', 'C'] as const).map((grade) => (
                    <option key={grade} value={grade}>
                      เกรด {grade} · {GRADE_LABELS[grade].detail}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          )}
        </div>
      </form>

      <section id="budget-results" aria-live="polite" className="scroll-mt-20">
        {response && !response.ok && (
          <div className="mt-6">
            <FormAlert variant="warn" icon={<TriangleAlert aria-hidden />}>
              {response.error}
            </FormAlert>
            <AlternativeList
              response={response}
              pending={pending}
              onTry={(change) => {
                change();
                void handleSubmit(onSubmit)();
              }}
              setValue={setValue}
            />
          </div>
        )}
        {response?.ok && (
          <>
            <h2 className="mt-8 mb-1 t-h2">
              {response.options.length} ตัวเลือกจากงบ{' '}
              <span className="font-mono">{formatBaht(response.budget)}</span>
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {USAGE_LABELS[response.usage]} · ทุกชุดตรวจแล้วว่าไม่มีชิ้นที่ใส่ด้วยกันไม่ได้
              {response.brandFallback && ' · ไม่พบ CPU ยี่ห้อที่เลือก จึงเลือกจากทุกยี่ห้อ'}
              {response.options.some((option) => option.alsoKinds.length > 0) &&
                ' · บางแบบได้ชุดเดียวกัน จึงรวมไว้ในการ์ดเดียว'}
            </p>
            <div
              className={cn(
                'grid gap-4',
                response.options.length >= 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2',
              )}
            >
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
  // การ์ดที่รวมหลายแบบ: "ประหยัด · คุ้มสุด" พร้อมคำอธิบายของทุกแบบ
  const kinds = [option.kind, ...option.alsoKinds];
  const label = {
    title: kinds.map((kind) => OPTION_LABELS[kind].title).join(' · '),
    hint: kinds.map((kind) => OPTION_LABELS[kind].hint).join(' และ'),
  };
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
      {option.saved > 0 && (
        <p className="mt-1 flex items-center gap-1 text-xs text-used-fg">
          <Recycle aria-hidden className="size-3.5" />
          ประหยัดกว่าซื้อใหม่ทั้งชุด <b className="font-mono">{formatBaht(option.saved)}</b>
        </p>
      )}
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
          <li key={item.partId} className="flex items-center gap-2.5">
            <PartImage
              src={item.imageUrl}
              alt=""
              category={item.categorySlug}
              size={40}
              className="size-10 shrink-0"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted-foreground">
                {CATEGORY_LABELS[item.categorySlug]}
              </span>
              <span className="line-clamp-2">
                {item.brandName} {item.model}
                {item.quantity > 1 && <span className="font-mono"> × {item.quantity}</span>}
                {item.condition !== 'new' && (
                  <Badge variant="used" className="ml-1 align-middle">
                    มือสอง {item.condition}
                  </Badge>
                )}
              </span>
            </span>
            <span className="shrink-0 font-mono tabular-nums">
              {formatBaht(item.unitPrice * item.quantity)}
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
                  {!note.code.startsWith('I') && (
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
