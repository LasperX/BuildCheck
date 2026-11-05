'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';

import { writePart } from '@/db/parts-write';
import { adminLogs, brands, partPriceHistory, parts } from '@/db/schema';
import { db } from '@/lib/db';
import { type CsvParseResult, parsePartsCsv } from '@/lib/parts/csv';
import { type CategorySlug, isCategorySlug } from '@/lib/parts/spec-fields';
import { type ActionResult, authorizeAdmin } from '@/lib/session';
import { uploadImage } from '@/lib/storage';
import { partInputSchema, priceUpdateSchema } from '@/lib/validators/parts';

// ทุกฟังก์ชันในไฟล์นี้เรียกจากเบราว์เซอร์ได้ตรงๆ จึงต้องขึ้นต้นด้วย authorizeAdmin() เสมอ

const MAX_CSV_BYTES = 2 * 1024 * 1024;

function revalidateParts() {
  revalidatePath('/admin/parts');
  // ล้างแคชหน้าคลังอะไหล่และหน้ารายละเอียด ผู้ใช้จะเห็นราคาใหม่ทันที
  updateTag('parts');
}

/** ตรวจว่าเป็น Error คีย์นอกจาก PostgreSQL หรือไม่ (รหัส 23503) */
function isForeignKeyError(error: unknown): boolean {
  const code = (e: unknown) => (e as { code?: string } | null)?.code;
  const cause = (error as { cause?: unknown } | null)?.cause;
  return code(error) === '23503' || code(cause) === '23503';
}

export async function upsertPart(input: unknown): Promise<ActionResult & { id?: number }> {
  const authz = await authorizeAdmin();
  if (!authz.ok) return authz;

  const parsed = partInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const written = await writePart(tx, parsed.data, authz.user.id);
      await tx.insert(adminLogs).values({
        adminId: authz.user.id,
        action: written.created ? 'part.create' : 'part.update',
        targetType: 'part',
        targetId: String(written.id),
        changes: {
          before: written.before,
          after: { model: parsed.data.model, price: parsed.data.price },
        },
      });
      return written;
    });
    revalidateParts();
    return { ok: true, id: result.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return { ok: false, error: /[฀-๿]/.test(message) ? message : 'บันทึกไม่สำเร็จ' };
  }
}

export async function updatePartPrice(input: unknown): Promise<ActionResult> {
  const authz = await authorizeAdmin();
  if (!authz.ok) return authz;

  const parsed = priceUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' };
  }
  const { id, price } = parsed.data;

  const changed = await db.transaction(async (tx) => {
    const [part] = await tx.select({ price: parts.price }).from(parts).where(eq(parts.id, id));
    if (!part) return null;
    if (part.price === price) return false;
    await tx.update(parts).set({ price }).where(eq(parts.id, id));
    await tx.insert(partPriceHistory).values({ partId: id, price, changedBy: authz.user.id });
    await tx.insert(adminLogs).values({
      adminId: authz.user.id,
      action: 'part.price',
      targetType: 'part',
      targetId: String(id),
      changes: { before: { price: part.price }, after: { price } },
    });
    return true;
  });
  if (changed === null) return { ok: false, error: 'ไม่พบอะไหล่' };
  revalidateParts();
  return { ok: true };
}

export async function setPartActive(input: {
  id: number;
  isActive: boolean;
}): Promise<ActionResult> {
  const authz = await authorizeAdmin();
  if (!authz.ok) return authz;
  if (!Number.isInteger(input?.id) || typeof input?.isActive !== 'boolean') {
    return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };
  }

  await db.transaction(async (tx) => {
    await tx.update(parts).set({ isActive: input.isActive }).where(eq(parts.id, input.id));
    await tx.insert(adminLogs).values({
      adminId: authz.user.id,
      action: input.isActive ? 'part.show' : 'part.hide',
      targetType: 'part',
      targetId: String(input.id),
    });
  });
  revalidateParts();
  return { ok: true };
}

export async function deletePart(id: number): Promise<ActionResult> {
  const authz = await authorizeAdmin();
  if (!authz.ok) return authz;
  if (!Number.isInteger(id)) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };

  try {
    await db.transaction(async (tx) => {
      const [removed] = await tx
        .delete(parts)
        .where(eq(parts.id, id))
        .returning({ model: parts.model, price: parts.price });
      await tx.insert(adminLogs).values({
        adminId: authz.user.id,
        action: 'part.delete',
        targetType: 'part',
        targetId: String(id),
        changes: { before: removed ?? null },
      });
    });
  } catch (error) {
    if (isForeignKeyError(error)) {
      return { ok: false, error: 'อะไหล่นี้อยู่ในสเปกของสมาชิก ลบไม่ได้ ให้ซ่อนแทน' };
    }
    return { ok: false, error: 'ลบไม่สำเร็จ' };
  }
  revalidateParts();
  return { ok: true };
}

export async function uploadPartImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const authz = await authorizeAdmin();
  if (!authz.ok) return authz;
  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'ไม่พบไฟล์รูป' };
  return uploadImage(file, 'parts');
}

async function readCsvForm(formData: FormData) {
  const file = formData.get('file');
  const category = formData.get('category');
  if (!(file instanceof File)) return { error: 'กรุณาเลือกไฟล์ CSV' } as const;
  if (file.size > MAX_CSV_BYTES) return { error: 'ไฟล์ CSV ต้องไม่เกิน 2 MB' } as const;
  if (!isCategorySlug(category)) return { error: 'กรุณาเลือกหมวด' } as const;
  return { text: await file.text(), category: category as CategorySlug } as const;
}

async function brandLookup() {
  const rows = await db.select({ id: brands.id, name: brands.name }).from(brands);
  return new Map(rows.map((row) => [row.name.toLowerCase(), row.id]));
}

/** ตรวจไฟล์แล้วคืนผลพรีวิว ยังไม่เขียนฐานข้อมูล */
export async function previewPartsCsv(formData: FormData): Promise<CsvParseResult> {
  const authz = await authorizeAdmin();
  if (!authz.ok) return authz;
  const form = await readCsvForm(formData);
  if ('error' in form) return { ok: false, error: form.error ?? 'ข้อมูลไม่ถูกต้อง' };
  return parsePartsCsv(form.text, form.category, await brandLookup());
}

/**
 * นำเข้าจริง: ตรวจไฟล์ซ้ำฝั่งเซิร์ฟเวอร์อีกรอบ และเขียนใน Transaction เดียว
 * ถ้ามีแถวผิดแม้แถวเดียว จะไม่นำเข้าเลย จึงไม่มีข้อมูลค้างครึ่งไฟล์
 */
export async function importPartsCsv(
  formData: FormData,
): Promise<{ ok: true; imported: number } | { ok: false; error: string }> {
  const authz = await authorizeAdmin();
  if (!authz.ok) return authz;
  const form = await readCsvForm(formData);
  if ('error' in form) return { ok: false, error: form.error ?? 'ข้อมูลไม่ถูกต้อง' };

  const parsed = parsePartsCsv(form.text, form.category, await brandLookup());
  if (!parsed.ok) return parsed;
  if (parsed.errorCount > 0) {
    return { ok: false, error: `มี ${parsed.errorCount} แถวที่ผิด แก้ไฟล์ก่อนนำเข้า` };
  }

  try {
    await db.transaction(async (tx) => {
      for (const row of parsed.rows) {
        if (row.ok) await writePart(tx, row.input, authz.user.id);
      }
      await tx.insert(adminLogs).values({
        adminId: authz.user.id,
        action: 'part.import',
        targetType: 'category',
        targetId: form.category,
        changes: { after: { rows: parsed.rows.length } },
      });
    });
  } catch {
    return { ok: false, error: 'นำเข้าไม่สำเร็จ ไม่มีข้อมูลถูกเพิ่ม' };
  }
  revalidateParts();
  return { ok: true, imported: parsed.rows.length };
}
