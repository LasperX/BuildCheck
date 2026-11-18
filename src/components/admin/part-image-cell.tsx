'use client';

import { ImagePlus, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useRef, useState, useTransition } from 'react';

import { PartImage } from '@/components/parts/part-icon';
import { TableCell } from '@/components/ui/table';
import { clipboardImage, isTypingTarget } from '@/lib/clipboard-image';
import type { CategorySlug } from '@/lib/parts/spec-fields';
import { cn } from '@/lib/utils';
import { setPartImage } from '@/server/actions/admin-parts';

// ช่องที่รับรูปจาก Ctrl+V: ช่องที่เมาส์ชี้อยู่ ถ้าไม่ได้ชี้ช่องไหนใช้ช่องที่โฟกัสอยู่ (ทีละช่องเสมอ)
let hoveredCell: number | null = null;
let focusedCell: number | null = null;

/**
 * ช่องรูปย่อในตารางอะไหล่: กดเพื่อเลือกไฟล์ ลากรูปมาวาง หรือชี้แล้วกด Ctrl+V วางรูปที่คัดลอกไว้
 * แล้วตั้งเป็นรูปของชิ้นนั้นทันที ไม่ต้องเข้าหน้าแก้ไข ใช้ไล่เติมรูปทีละแถวตอนกรอง "ไม่มีรูป"
 */
export function PartImageCell({
  id,
  model,
  imageUrl,
  category,
}: {
  id: number;
  model: string;
  imageUrl: string | null;
  category: CategorySlug;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = preview ?? (imageUrl || null);

  function upload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('รับเฉพาะไฟล์รูป');
      return;
    }
    setError(null);
    start(async () => {
      const data = new FormData();
      data.set('id', String(id));
      data.set('file', file);
      try {
        const result = await setPartImage(data);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setPreview(result.url);
        router.refresh();
      } catch {
        // เน็ตหลุดระหว่างส่ง: บอกในช่องนั้น ไม่ให้ทั้งหน้าพัง
        setError('อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง');
      }
    });
  }

  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    if ((hoveredCell ?? focusedCell) !== id || pending || isTypingTarget(event.target)) return;
    const file = clipboardImage(event.clipboardData);
    if (!file) return;
    event.preventDefault();
    upload(file);
  });

  useEffect(() => {
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('paste', onPaste);
      if (hoveredCell === id) hoveredCell = null;
      if (focusedCell === id) focusedCell = null;
    };
  }, [id]);

  const hint = 'กด ลากรูปมาวาง หรือชี้แล้วกด Ctrl+V เพื่อวางรูปที่คัดลอกไว้';

  return (
    <TableCell className="w-14 py-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => input.current?.click()}
        onMouseEnter={() => {
          hoveredCell = id;
        }}
        onMouseLeave={() => {
          if (hoveredCell === id) hoveredCell = null;
        }}
        onFocus={() => {
          focusedCell = id;
        }}
        onBlur={() => {
          if (focusedCell === id) focusedCell = null;
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          upload(event.dataTransfer.files[0]);
        }}
        aria-label={shown ? `เปลี่ยนรูป ${model}` : `เพิ่มรูป ${model}`}
        title={shown ? `${hint} (เปลี่ยนรูป)` : hint}
        className={cn(
          'relative grid size-11 place-items-center overflow-hidden rounded-md border transition-colors',
          shown ? 'border-transparent' : 'border-dashed border-border-strong text-subtle',
          dragging && 'border-brand bg-brand-soft text-brand-soft-fg',
          'hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        )}
      >
        {shown ? (
          <PartImage src={shown} alt="" category={category} size={44} className="size-11" />
        ) : (
          <ImagePlus aria-hidden className="size-5" />
        )}
        {pending ? (
          <span className="absolute inset-0 grid place-items-center bg-surface/80">
            <LoaderCircle aria-hidden className="size-5 animate-spin" />
          </span>
        ) : null}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          upload(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {error ? (
        <p role="alert" className="mt-1 max-w-28 text-2xs text-err-fg">
          {error}
        </p>
      ) : null}
    </TableCell>
  );
}
