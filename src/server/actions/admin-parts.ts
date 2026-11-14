'use server';

import { eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';

import { writePart } from '@/db/parts-write';
import { adminLogs, brands, categories, partPriceHistory, parts } from '@/db/schema';
import { db } from '@/lib/db';
import { type CsvParseResult, matchExistingParts, parsePartsCsv } from '@/lib/parts/csv';
import { type CategorySlug, isCategorySlug } from '@/lib/parts/spec-fields';
import { type ActionResult, authorizeAdmin } from '@/lib/session';
import { uploadImage } from '@/lib/storage';
import { notifyPriceChange } from '@/server/notify';
import { z } from 'zod';
import { partInputSchema, partVerifySchema, priceUpdateSchema } from '@/lib/validators/parts';

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
      // ราคาเปลี่ยน → แจ้งเจ้าของสเปกที่มีชิ้นนี้ (หัวข้อ 3.8)
      if (written.priceChanged && !written.created) {
        await notifyPriceChange(
          tx,
          { id: written.id, model: parsed.data.model, newPrice: parsed.data.price },
          authz.user.id,
        );
      }
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
    const [part] = await tx
      .select({ price: parts.price, model: parts.model })
      .from(parts)
      .where(eq(parts.id, id));
    if (!part) return null;
    if (part.price === price) return false;
    await tx.update(parts).set({ price }).where(eq(parts.id, id));
    await tx.insert(partPriceHistory).values({ partId: id, price, changedBy: authz.user.id });
    await notifyPriceChange(tx, { id, model: part.model, newPrice: price }, authz.user.id);
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

/**
 * หน้าตรวจสเปก: ตั้งสถานะ "ตรวจแล้ว" หรือยกเลิก โดยไม่ต้องเปิดฟอร์มแก้ไข
 * รับเป็นรายการ id เผื่อกดหลายชิ้นพร้อมกัน บันทึก admin_logs ทีละชิ้นเพื่อให้ย้อนดูได้ว่าใครตรวจชิ้นไหน
 */
export async function setPartVerified(input: {
  ids: number[];
  verified: boolean;
}): Promise<ActionResult> {
  const authz = await authorizeAdmin();
  if (!authz.ok) return authz;
  const parsed = partVerifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };
  const { ids, verified } = parsed.data;

  const updated = await db.transaction(async (tx) => {
    const rows = await tx
      .update(parts)
      .set({ specVerified: verified })
      .where(inArray(parts.id, ids))
      .returning({ id: parts.id });
    if (rows.length > 0) {
      await tx.insert(adminLogs).values(
        rows.map((row) => ({
          adminId: authz.user.id,
          action: verified ? 'part.verify' : 'part.unverify',
          targetType: 'part',
          targetId: String(row.id),
        })),
      );
    }
    return rows.length;
  });
  if (updated === 0) return { ok: false, error: 'ไม่พบอะไหล่ที่เลือก' };
  revalidateParts();
  revalidatePath('/admin/parts/review');
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

/** อะไหล่ที่มีอยู่แล้วในหมวดนั้น ใช้จับคู่กับแถวใน CSV (รวมชิ้นที่ซ่อนไว้ จะได้ไม่สร้างซ้ำ) */
async function existingPartsIn(category: CategorySlug) {
  return db
    .select({
      id: parts.id,
      brandId: parts.brandId,
      model: parts.model,
      isActive: parts.isActive,
      imageUrl: parts.imageUrl,
      availability: parts.availability,
    })
    .from(parts)
    .innerJoin(categories, eq(parts.categoryId, categories.id))
    .where(eq(categories.slug, category));
}

/** ตรวจไฟล์แล้วคืนผลพรีวิว บอกด้วยว่าแถวไหนเพิ่มใหม่ แถวไหนอัปเดตชิ้นเดิม ยังไม่เขียนฐานข้อมูล */
export async function previewPartsCsv(formData: FormData): Promise<CsvParseResult> {
  const authz = await authorizeAdmin();
  if (!authz.ok) return authz;
  const form = await readCsvForm(formData);
  if ('error' in form) return { ok: false, error: form.error ?? 'ข้อมูลไม่ถูกต้อง' };
  const parsed = parsePartsCsv(form.text, form.category, await brandLookup());
  if (!parsed.ok) return parsed;
  return matchExistingParts(parsed, await existingPartsIn(form.category));
}

/**
 * นำเข้าจริง: ตรวจไฟล์ซ้ำฝั่งเซิร์ฟเวอร์อีกรอบ และเขียนใน Transaction เดียว
 * ถ้ามีแถวผิดแม้แถวเดียว จะไม่นำเข้าเลย จึงไม่มีข้อมูลค้างครึ่งไฟล์
 */
export async function importPartsCsv(
  formData: FormData,
): Promise<
  { ok: true; imported: number; created: number; updated: number } | { ok: false; error: string }
> {
  const authz = await authorizeAdmin();
  if (!authz.ok) return authz;
  const form = await readCsvForm(formData);
  if ('error' in form) return { ok: false, error: form.error ?? 'ข้อมูลไม่ถูกต้อง' };

  const firstPass = parsePartsCsv(form.text, form.category, await brandLookup());
  if (!firstPass.ok) return firstPass;
  // จับคู่ใหม่ตอนนำเข้าจริง ไม่เชื่อผลพรีวิวจากเบราว์เซอร์ เผื่อมีคนเพิ่มอะไหล่ระหว่างนั้น
  const existing = await existingPartsIn(form.category);
  const parsed = matchExistingParts(firstPass, existing);
  if (parsed.errorCount > 0) {
    return { ok: false, error: `มี ${parsed.errorCount} แถวที่ผิด แก้ไฟล์ก่อนนำเข้า` };
  }
  const existingById = new Map(existing.map((part) => [part.id, part]));

  try {
    await db.transaction(async (tx) => {
      for (const row of parsed.rows) {
        if (!row.ok) continue;
        const current = row.existingId ? existingById.get(row.existingId) : undefined;
        // อัปเดตชิ้นเดิม: CSV ไม่มีคอลัมน์ซ่อน/แสดง จึงคงสถานะเดิมไว้
        // ถ้าช่องรูปในไฟล์ว่าง ให้คงรูปเดิม ไม่ลบรูปที่อัปโหลดไว้
        // ไฟล์เก่าที่ไม่มีคอลัมน์ availability ให้คงสถานะการขายเดิม ไม่เปลี่ยนชิ้นที่มีแต่มือสองกลับเป็นมือหนึ่ง
        const input = current
          ? {
              ...row.input,
              id: current.id,
              isActive: current.isActive,
              imageUrl: row.input.imageUrl ?? current.imageUrl,
              availability: parsed.hasAvailabilityColumn
                ? row.input.availability
                : current.availability,
            }
          : row.input;
        const written = await writePart(tx, input, authz.user.id);
        if (written.priceChanged && !written.created) {
          await notifyPriceChange(
            tx,
            { id: written.id, model: row.input.model, newPrice: row.input.price },
            authz.user.id,
          );
        }
      }
      await tx.insert(adminLogs).values({
        adminId: authz.user.id,
        action: 'part.import',
        targetType: 'category',
        targetId: form.category,
        changes: {
          after: {
            rows: parsed.rows.length,
            created: parsed.createCount ?? 0,
            updated: parsed.updateCount ?? 0,
          },
        },
      });
    });
  } catch {
    return { ok: false, error: 'นำเข้าไม่สำเร็จ ไม่มีข้อมูลถูกเพิ่ม' };
  }
  revalidateParts();
  return {
    ok: true,
    imported: parsed.rows.length,
    created: parsed.createCount ?? 0,
    updated: parsed.updateCount ?? 0,
  };
}

const brandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'กรุณากรอกชื่อยี่ห้อ' })
    .max(60, { error: 'ชื่อยี่ห้อยาวเกิน 60 ตัวอักษร' }),
});

/**
 * แอดมินเพิ่มยี่ห้อใหม่ ใช้ก่อนนำเข้า CSV ที่มียี่ห้อซึ่งยังไม่มีในระบบ
 * ชื่อซ้ำกับที่มีอยู่ (ไม่สนตัวพิมพ์เล็กใหญ่) ไม่เพิ่ม กันยี่ห้อเดียวกันมีสองชื่อ
 */
export async function createBrand(input: unknown): Promise<ActionResult & { name?: string }> {
  const auth = await authorizeAdmin();
  if (!auth.ok) return auth;
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' };
  }
  const { name } = parsed.data;

  const [existing] = await db
    .select({ name: brands.name })
    .from(brands)
    .where(eq(sql`lower(${brands.name})`, name.toLowerCase()));
  if (existing) return { ok: false, error: `มียี่ห้อ ${existing.name} ในระบบอยู่แล้ว` };

  await db.transaction(async (tx) => {
    const [row] = await tx.insert(brands).values({ name }).returning({ id: brands.id });
    await tx.insert(adminLogs).values({
      adminId: auth.user.id,
      action: 'brand.create',
      targetType: 'brand',
      targetId: String(row?.id),
      changes: { after: { name } },
    });
  });
  revalidateParts();
  return { ok: true, name };
}

const partIdSchema = z.coerce.number().int().positive({ error: 'ไม่พบอะไหล่' });

/**
 * อัปโหลดรูปแล้วตั้งเป็นรูปของอะไหล่ชิ้นนั้นทันที (ใช้จากตารางในหน้าจัดการอะไหล่)
 * ต่างจาก uploadPartImage ที่แค่อัปโหลดแล้วคืน URL ให้ฟอร์มแก้ไขเก็บไว้ก่อนกดบันทึก
 */
export async function setPartImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const authz = await authorizeAdmin();
  if (!authz.ok) return authz;
  const id = partIdSchema.safeParse(formData.get('id'));
  if (!id.success) return { ok: false, error: 'ไม่พบอะไหล่' };
  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'ไม่พบไฟล์รูป' };

  const [part] = await db
    .select({ imageUrl: parts.imageUrl })
    .from(parts)
    .where(eq(parts.id, id.data));
  if (!part) return { ok: false, error: 'ไม่พบอะไหล่' };

  const uploaded = await uploadImage(file, 'parts');
  if (!uploaded.ok) return uploaded;

  await db.transaction(async (tx) => {
    await tx.update(parts).set({ imageUrl: uploaded.url }).where(eq(parts.id, id.data));
    await tx.insert(adminLogs).values({
      adminId: authz.user.id,
      action: 'part.image',
      targetType: 'part',
      targetId: String(id.data),
      changes: { before: { imageUrl: part.imageUrl }, after: { imageUrl: uploaded.url } },
    });
  });
  revalidateParts();
  return { ok: true, url: uploaded.url };
}
