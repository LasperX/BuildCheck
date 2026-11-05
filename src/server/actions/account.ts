'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { users } from '@/db/schema';
import { db } from '@/lib/db';
import { type ActionResult, authorizeMember } from '@/lib/session';
import { uploadImage } from '@/lib/storage';
import { profileSchema } from '@/lib/validators/auth';

/** แก้ชื่อที่แสดงและคำแนะนำตัวของบัญชีตัวเอง */
export async function updateProfile(input: unknown): Promise<ActionResult> {
  // 1) ตรวจสิทธิ์ก่อนเสมอ ใช้ id จาก Session ไม่ใช้ค่าจากหน้าเว็บ จึงแก้บัญชีคนอื่นไม่ได้
  const authz = await authorizeMember();
  if (!authz.ok) return authz;

  // 2) ตรวจค่าด้วย Zod ฝั่งเซิร์ฟเวอร์
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' };
  }

  // 3) บันทึก
  await db
    .update(users)
    .set({ displayName: parsed.data.displayName, bio: parsed.data.bio || null })
    .where(eq(users.id, authz.user.id));

  revalidatePath('/me/settings');
  return { ok: true };
}

/** อัปโหลดรูปโปรไฟล์ของบัญชีตัวเอง ไฟล์ถูกตรวจชนิดและขนาดใน uploadImage */
export async function updateAvatar(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeMember();
  if (!authz.ok) return authz;

  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'ไม่พบไฟล์รูป' };

  const uploaded = await uploadImage(file, 'avatars');
  if (!uploaded.ok) return uploaded;

  await db.update(users).set({ image: uploaded.url }).where(eq(users.id, authz.user.id));
  revalidatePath('/me/settings');
  return { ok: true };
}
