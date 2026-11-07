import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { CATEGORY_ICONS, PartImage } from '@/components/parts/part-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { BuilderPart } from '@/lib/builder/types';
import type { Issue } from '@/lib/compat';
import { formatBaht } from '@/lib/parts/catalog';
import { CATEGORY_LABELS, type CategorySlug } from '@/lib/parts/spec-fields';
import { MAX_QUANTITY } from '@/lib/validators/builds';
import { cn } from '@/lib/utils';
import { type BuildItem, MULTI_CATEGORIES } from '@/stores/builder-store';

import { LEVEL_UI } from './levels';
import { slotUnitPrice, UsedControls } from './used-controls';

const REQUIRED: CategorySlug[] = ['cpu', 'motherboard', 'ram', 'storage', 'psu', 'case'];
const EMPTY_HINT: Partial<Record<CategorySlug, string>> = {
  gpu: 'ไม่บังคับถ้า CPU มีกราฟิกในตัว',
  cooler: 'ไม่บังคับถ้า CPU มีพัดลมแถม',
};

/** ช่องอะไหล่ 1 หมวด (หัวข้อ 3.3) */
export function PartSlot({
  category,
  items,
  parts,
  issue,
  onPick,
  onRemove,
  onQuantity,
  onUpdate,
}: {
  category: CategorySlug;
  items: BuildItem[];
  parts: Map<number, BuilderPart>;
  /** ปัญหาที่ร้ายแรงที่สุดของหมวดนี้ */
  issue: Issue | undefined;
  onPick: (replacePartId?: number) => void;
  onRemove: (partId: number) => void;
  onQuantity: (partId: number, quantity: number) => void;
  onUpdate: (partId: number, patch: Partial<Omit<BuildItem, 'partId' | 'categorySlug'>>) => void;
}) {
  const label = CATEGORY_LABELS[category];
  const Icon = CATEGORY_ICONS[category];
  const multi = MULTI_CATEGORIES.includes(category);
  const required = REQUIRED.includes(category);
  const level = issue && issue.level !== 'info' ? LEVEL_UI[issue.level] : null;
  const LevelIcon = level?.icon;

  const head = (
    <div className="flex items-baseline gap-1.5 text-sm">
      <h3 className="font-semibold">{label}</h3>
      {required && <span className="text-xs text-muted-foreground">· จำเป็น</span>}
    </div>
  );

  return (
    <article
      aria-label={label}
      className={cn(
        'rounded-xl border bg-card p-4',
        level
          ? issue?.level === 'error'
            ? 'border-err-border'
            : 'border-warn-border'
          : 'border-border',
      )}
    >
      {items.length === 0 ? (
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground">
            <Icon aria-hidden className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            {head}
            <p className="text-xs text-muted-foreground">
              {EMPTY_HINT[category] ?? 'ยังไม่ได้เลือก'}
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => onPick()}>
            <Plus aria-hidden />
            เลือก{/^[A-Z]/.test(label) ? ' ' : ''}
            {label}
          </Button>
        </div>
      ) : (
        <div>
          {head}
          <ul className="mt-2 flex flex-col gap-3">
            {items.map((item) => {
              const part = parts.get(item.partId);
              return (
                <li key={item.partId}>
                  {/* แถวบน: รูป ชื่อ ราคา ปุ่ม · แถวล่าง: สภาพมือหนึ่ง/มือสอง (แยกแถวกันไม่ให้ช่องมือสองบีบชื่ออะไหล่) */}
                  <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                    <PartImage
                      src={part?.imageUrl ?? null}
                      alt={part ? `${part.brandName} ${part.model}` : label}
                      category={category}
                      size={48}
                      className="size-12 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      {part ? (
                        <Link
                          href={`/parts/${category}/${part.slug}`}
                          className="line-clamp-2 font-medium hover:underline"
                        >
                          {part.brandName} {part.model}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">กำลังโหลด…</span>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {part?.chips.map((chip) => (
                          <Badge key={chip} variant="neutral" className="font-mono">
                            {chip}
                          </Badge>
                        ))}
                        {part && !part.isActive && <Badge variant="warn">เลิกขายแล้ว</Badge>}
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      <span className="mr-2 flex flex-col items-end font-mono tabular-nums">
                        <span className="font-semibold">
                          {part ? formatBaht(slotUnitPrice(item, part) * item.quantity) : '–'}
                        </span>
                        {part && item.condition !== 'new' && (
                          <span className="text-xs text-muted-foreground line-through">
                            <span className="sr-only">ราคาใหม่ </span>
                            {formatBaht(part.price * item.quantity)}
                          </span>
                        )}
                      </span>
                      {multi && (
                        <span
                          role="group"
                          aria-label={`จำนวน${label}`}
                          className="flex items-center rounded-lg border border-border"
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="ลดจำนวน"
                            onClick={() => onQuantity(item.partId, item.quantity - 1)}
                          >
                            <Minus aria-hidden />
                          </Button>
                          <output className="w-6 text-center font-mono text-sm" aria-live="polite">
                            {item.quantity}
                          </output>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="เพิ่มจำนวน"
                            disabled={item.quantity >= MAX_QUANTITY}
                            onClick={() => onQuantity(item.partId, item.quantity + 1)}
                          >
                            <Plus aria-hidden />
                          </Button>
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`เปลี่ยนรุ่น ${part?.model ?? label}`}
                        title="เปลี่ยนรุ่น"
                        onClick={() => onPick(item.partId)}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`เอา ${part?.model ?? label} ออก`}
                        title="เอาออก"
                        onClick={() => onRemove(item.partId)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </div>
                  <UsedControls
                    item={item}
                    part={part}
                    onUpdate={(patch) => onUpdate(item.partId, patch)}
                  />
                </li>
              );
            })}
          </ul>
          {multi && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => onPick()}
            >
              <Plus aria-hidden />
              เพิ่ม{label}อีกชิ้น
            </Button>
          )}
        </div>
      )}
      {level && LevelIcon && issue && (
        <p
          className={cn('mt-3 flex items-start gap-1.5 rounded-lg border p-2 text-sm', level.soft)}
        >
          <LevelIcon aria-hidden className={cn('mt-0.5 size-4 shrink-0', level.text)} />
          <span>
            <span className="font-mono font-semibold">{issue.code}</span> {issue.title} ·{' '}
            <a href="#issues" className="underline">
              ดูวิธีแก้
            </a>
          </span>
        </p>
      )}
    </article>
  );
}
