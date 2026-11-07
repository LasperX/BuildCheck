'use client';

import {
  ChevronUp,
  CircleCheck,
  CircleX,
  Clock,
  FilePlus,
  LogIn,
  Redo2,
  Save,
  Share2,
  TriangleAlert,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { USAGE_LABELS } from '@/lib/builder/types';
import type { EngineSettings, Issue, Suggestion, UsageType } from '@/lib/compat';
import { formatBaht } from '@/lib/parts/catalog';
import { CATEGORY_SLUGS, type CategorySlug } from '@/lib/parts/spec-fields';
import { cn } from '@/lib/utils';
import {
  type BuildItem,
  type BuildMeta,
  useBuilderHydrated,
  useBuilderStore,
} from '@/stores/builder-store';

import { IssueList } from './issue-list';
import { PartPicker, type PickerTarget } from './part-picker';
import { PartSlot } from './part-slot';
import { ShareDialog } from './share-dialog';
import { SummaryPanel } from './summary-panel';
import { type SaveState, useAutosave, useBuildCheck } from './use-build';

export type InitialBuild = { id: string; meta: BuildMeta; items: BuildItem[] };

const LEVEL_RANK = { error: 0, warning: 1, info: 2 } as const;

function SaveStatus({ state }: { state: SaveState }) {
  const text = {
    guest: 'เก็บไว้ในเครื่องนี้ · เข้าสู่ระบบเพื่อบันทึกถาวร',
    idle: 'บันทึกอัตโนมัติเมื่อแก้ไข',
    pending: 'มีการแก้ไขที่ยังไม่บันทึก',
    saving: 'กำลังบันทึก…',
    saved: 'บันทึกอัตโนมัติแล้ว',
    error: 'บันทึกไม่สำเร็จ',
  }[state.kind];
  return (
    <p
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5 text-xs',
        state.kind === 'error' ? 'text-err-fg' : 'text-muted-foreground',
      )}
    >
      {state.kind === 'error' ? (
        <CircleX aria-hidden className="size-3.5" />
      ) : (
        <Clock aria-hidden className="size-3.5" />
      )}
      {text}
      {state.kind === 'saved' &&
        ` · ${state.at.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`}
      {state.kind === 'error' && ` · ${state.message}`}
    </p>
  );
}

/** หน้าจัดสเปก (หัวข้อ 3.3 และ 5.1) */
export function BuilderView({
  loggedIn,
  initialBuild,
  settings,
}: {
  loggedIn: boolean;
  /** ค่าตั้งระบบจากแอดมิน ใช้ค่าเดียวกับเซิร์ฟเวอร์ ผลตรวจในเบราว์เซอร์จึงตรงกับตอนบันทึก */
  settings: EngineSettings;
  initialBuild: InitialBuild | null;
}) {
  const hydrated = useBuilderHydrated();
  const items = useBuilderStore((s) => s.items);
  const meta = useBuilderStore((s) => s.meta);
  const canUndo = useBuilderStore((s) => s.past.length > 0);
  const canRedo = useBuilderStore((s) => s.future.length > 0);
  const store = useBuilderStore.getState;

  const { result, parts, error } = useBuildCheck(settings);
  const { state: saveState, saveNow } = useAutosave(loggedIn);

  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // เปิดจาก "แก้ไข" ในหน้าสเปกของฉัน: โหลดสเปกนั้นมาแทน ถ้าเป็นสเปกเดียวกับที่แก้ค้างไว้ในเครื่องให้ใช้ของในเครื่อง
  const loaded = useRef(false);
  useEffect(() => {
    if (!hydrated || loaded.current || !initialBuild) return;
    loaded.current = true;
    if (store().buildId !== initialBuild.id) store().loadBuild(initialBuild);
  }, [hydrated, initialBuild, store]);

  // คีย์ลัด Ctrl+Z / Ctrl+Shift+Z (หรือ Ctrl+Y) เมื่อไม่ได้พิมพ์อยู่ในช่องกรอก
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        store().undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        store().redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const issuesFor = (category: CategorySlug): Issue | undefined =>
    result.issues
      .filter((issue) => issue.categories.includes(category) && issue.level !== 'info')
      .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level])[0];

  const openSuggestion = (suggest: Suggestion, issue: Issue) => {
    // ปุ่มแนะนำอะไหล่ทดแทน: เปิดหมวดที่ต้องเปลี่ยน พร้อมตัวกรอง และเรียงจากราคาใกล้เคียงชิ้นเดิมที่สุด
    const current = items.find(
      (item) => item.categorySlug === suggest.category && issue.partIds.includes(item.partId),
    );
    const currentPart = current ? parts.get(current.partId) : undefined;
    setPicker({
      category: suggest.category,
      replacePartId: current?.partId,
      filter: suggest.filter,
      near: currentPart?.price,
      fix: issue.code.startsWith('R') ? issue.code : undefined,
    });
  };

  const ensureSaved = async () => {
    const id = store().buildId;
    if (id && saveState.kind === 'saved') return id;
    return (await saveNow()) ?? store().buildId;
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const empty = items.length === 0;

  if (!hydrated) {
    return (
      <div className="container mx-auto grid gap-6 px-4 pt-4 pb-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12" />
          {CATEGORY_SLUGS.map((slug) => (
            <Skeleton key={slug} className="h-20" />
          ))}
        </div>
        <Skeleton className="hidden h-[520px] lg:block" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-4 pb-36 lg:pb-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-[220px] flex-1">
              <Input
                aria-label="ชื่อสเปก"
                value={meta.title}
                maxLength={100}
                onChange={(event) => store().setMeta({ title: event.target.value })}
                onBlur={(event) => {
                  if (!event.target.value.trim()) store().setMeta({ title: 'สเปกของฉัน' });
                }}
                className="h-auto border-transparent bg-transparent px-1 text-xl font-semibold shadow-none hover:border-border focus-visible:border-ring"
              />
              <div className="px-1">
                <SaveStatus state={saveState} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="ย้อนกลับ"
                title="ย้อนกลับ (Ctrl+Z)"
                disabled={!canUndo}
                onClick={() => store().undo()}
              >
                <Undo2 aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="ทำซ้ำ"
                title="ทำซ้ำ (Ctrl+Shift+Z)"
                disabled={!canRedo}
                onClick={() => store().redo()}
              >
                <Redo2 aria-hidden />
              </Button>
              <Button
                type="button"
                variant="secondary"
                aria-label="เริ่มสเปกใหม่"
                title="เริ่มสเปกใหม่"
                onClick={() => {
                  if (
                    empty ||
                    window.confirm('เริ่มสเปกใหม่? สเปกนี้ยังอยู่ในบัญชีถ้าบันทึกไว้แล้ว')
                  ) {
                    store().reset();
                  }
                }}
              >
                <FilePlus aria-hidden />
                <span className="hidden sm:inline">ใหม่</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={empty}
                onClick={() => setShareOpen(true)}
              >
                <Share2 aria-hidden />
                แชร์
              </Button>
              {loggedIn ? (
                <Button
                  type="button"
                  disabled={empty || saveState.kind === 'saving'}
                  onClick={() => void saveNow()}
                >
                  <Save aria-hidden />
                  บันทึก
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/login?next=/builder">
                    <LogIn aria-hidden />
                    เข้าสู่ระบบเพื่อบันทึก
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[180px_160px_minmax(0,1fr)]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="usage">ประเภทการใช้งาน</Label>
              <NativeSelect
                id="usage"
                value={meta.usageType}
                onChange={(event) =>
                  store().setMeta({ usageType: event.target.value as UsageType })
                }
              >
                {(Object.keys(USAGE_LABELS) as UsageType[]).map((usage) => (
                  <option key={usage} value={usage}>
                    {USAGE_LABELS[usage]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="budget">งบ (บาท)</Label>
              <Input
                id="budget"
                inputMode="numeric"
                className="font-mono"
                placeholder="ไม่กำหนด"
                value={meta.budget ?? ''}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
                  store().setMeta({ budget: digits ? Number(digits) : null });
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">คำอธิบาย</Label>
              <Input
                id="description"
                maxLength={1000}
                placeholder="เช่น เน้นเล่นเกม 1080p เงียบ ไม่แรงเกินงบ"
                value={meta.description}
                onChange={(event) => store().setMeta({ description: event.target.value })}
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-err-border bg-err-soft p-3 text-sm"
            >
              โหลดข้อมูลอะไหล่ไม่สำเร็จ ผลตรวจอาจไม่ครบ กรุณารีเฟรชหน้า
            </p>
          )}

          <section aria-labelledby="slots-title" className="mt-4 flex flex-col gap-3">
            <h2 id="slots-title" className="sr-only">
              ช่องอะไหล่ 8 หมวด
            </h2>
            {CATEGORY_SLUGS.map((category) => (
              <PartSlot
                key={category}
                category={category}
                items={items.filter((item) => item.categorySlug === category)}
                parts={parts}
                issue={issuesFor(category)}
                onPick={(replacePartId) => setPicker({ category, replacePartId })}
                onRemove={(partId) => store().removePart(partId)}
                onQuantity={(partId, quantity) => store().setQuantity(partId, quantity)}
                onUpdate={(partId, patch) => store().updateItem(partId, patch)}
              />
            ))}
          </section>

          <section id="issues" aria-labelledby="issues-title" className="mt-8 scroll-mt-20">
            <h2 id="issues-title" className="mb-3 text-lg font-semibold">
              ผลตรวจความเข้ากันได้
            </h2>
            <div aria-live="polite">
              <IssueList issues={result.issues} empty={empty} onSuggest={openSuggestion} />
            </div>
          </section>
        </div>

        <aside
          aria-label="สรุปสเปก"
          className="hidden self-start rounded-xl border border-border bg-card lg:sticky lg:top-20 lg:block"
        >
          <SummaryPanel result={result} itemCount={itemCount} budget={meta.budget} />
        </aside>
      </div>

      {/* แถบสรุปด้านล่างบนมือถือ กดแล้วเปิดแผงสรุปเต็ม */}
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setSheetOpen(true)}
        className="fixed inset-x-0 bottom-14 z-30 flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-2 text-left shadow-lg lg:hidden"
      >
        <span className="min-w-0">
          <span className="block font-mono text-lg font-semibold">
            {formatBaht(result.price.total)}
          </span>
          <span className="block text-xs text-muted-foreground">
            {result.power.totalWatt} W
            {result.power.load !== null && ` · ${Math.round(result.power.load * 100)}% ของ PSU`}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {result.counts.error > 0 && (
            <Badge variant="err">
              <CircleX aria-hidden />
              {result.counts.error}
              <span className="sr-only">ผิดพลาด</span>
            </Badge>
          )}
          {result.counts.warning > 0 && (
            <Badge variant="warn">
              <TriangleAlert aria-hidden />
              {result.counts.warning}
              <span className="sr-only">เตือน</span>
            </Badge>
          )}
          {!empty && result.status === 'ok' && (
            <Badge variant="ok">
              <CircleCheck aria-hidden />
              ผ่าน
            </Badge>
          )}
          <ChevronUp aria-hidden className="size-5 text-muted-foreground" />
          <span className="sr-only">เปิดสรุปสเปก</span>
        </span>
      </button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle>สรุปสเปก</SheetTitle>
          </SheetHeader>
          <SummaryPanel
            result={result}
            itemCount={itemCount}
            budget={meta.budget}
            onJumpToIssues={() => setSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <PartPicker
        target={picker}
        items={items}
        usage={meta.usageType}
        onClose={() => setPicker(null)}
        onSelect={(part, target) => {
          if (target.replacePartId) {
            store().replacePart(part.id, part.categorySlug, target.replacePartId);
          } else {
            store().addPart(part.id, part.categorySlug);
          }
          setPicker(null);
        }}
      />

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        loggedIn={loggedIn}
        ensureSaved={ensureSaved}
      />
    </div>
  );
}
