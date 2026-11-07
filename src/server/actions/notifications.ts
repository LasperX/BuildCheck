'use server';

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { notifications, users } from '@/db/schema';
import { db } from '@/lib/db';
import { mutedSchema } from '@/lib/notifications';
import { type ActionResult, authorizeMember } from '@/lib/session';

// ทุกคำสั่งมีเงื่อนไข user_id = ผู้ล็อกอิน อยู่ใน WHERE จึงแก้การแจ้งเตือนของคนอื่นไม่ได้

const idsSchema = z.array(z.number().int().positive()).max(100);

/** ทำเครื่องหมายว่าอ่านแล้ว ไม่ส่ง ids = อ่านทั้งหมด */
export async function markNotificationsRead(rawIds?: unknown): Promise<ActionResult> {
  const auth = await authorizeMember();
  if (!auth.ok) return auth;
  const ids = rawIds === undefined ? null : idsSchema.safeParse(rawIds);
  if (ids && !ids.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, auth.user.id),
        isNull(notifications.readAt),
        ids ? inArray(notifications.id, ids.data) : undefined,
      ),
    );
  return { ok: true };
}

/** เปิด/ปิดการแจ้งเตือนแต่ละประเภท (หัวข้อ 3.8) ส่งรายการประเภทที่ "ปิด" มา */
export async function updateNotificationPrefs(raw: unknown): Promise<ActionResult> {
  const auth = await authorizeMember();
  if (!auth.ok) return auth;
  const parsed = mutedSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };
  await db
    .update(users)
    .set({ mutedNotifications: [...new Set(parsed.data)] })
    .where(eq(users.id, auth.user.id));
  return { ok: true };
}
