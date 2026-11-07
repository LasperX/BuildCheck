import 'server-only';

import { and, count, desc, eq, gt, isNull, lt } from 'drizzle-orm';

import { notifications } from '@/db/schema';
import { db } from '@/lib/db';
import type { NotificationView } from '@/lib/notifications';

// การแจ้งเตือนเป็นข้อมูลส่วนตัว ไม่แคช และอ่านด้วย user_id จาก Session เท่านั้น

export const NOTIFICATIONS_PAGE_SIZE = 20;

const columns = {
  id: notifications.id,
  type: notifications.type,
  message: notifications.message,
  buildId: notifications.buildId,
  readAt: notifications.readAt,
  createdAt: notifications.createdAt,
};

const toView = (row: {
  id: number;
  type: NotificationView['type'];
  message: string;
  buildId: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationView => ({
  ...row,
  readAt: row.readAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

/** จำนวนที่ยังไม่อ่าน ใช้ Index notifications(user_id, read_at) ตามหัวข้อ 6.7 */
export async function countUnread(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.value ?? 0;
}

/** รายการล่าสุด ใช้ในกระดิ่งแจ้งเตือน */
export async function latestNotifications(userId: string, limit = 8): Promise<NotificationView[]> {
  const rows = await db
    .select(columns)
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.id))
    .limit(limit);
  return rows.map(toView);
}

/** แถวที่ใหม่กว่า afterId สำหรับส่งแบบสด เรียงเก่าไปใหม่ */
export async function notificationsAfter(
  userId: string,
  afterId: number,
): Promise<NotificationView[]> {
  const rows = await db
    .select(columns)
    .from(notifications)
    .where(and(eq(notifications.userId, userId), gt(notifications.id, afterId)))
    .orderBy(notifications.id)
    .limit(20);
  return rows.map(toView);
}

/** หน้า /me/notifications แบ่งหน้าแบบ "โหลดเพิ่ม" ด้วยรหัสสุดท้าย (เร็วกว่า OFFSET เมื่อมีหลายแถว) */
export async function listNotifications(
  userId: string,
  options: { before?: number; unreadOnly?: boolean } = {},
): Promise<{ items: NotificationView[]; hasMore: boolean }> {
  const rows = await db
    .select(columns)
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        options.before ? lt(notifications.id, options.before) : undefined,
        options.unreadOnly ? isNull(notifications.readAt) : undefined,
      ),
    )
    .orderBy(desc(notifications.id))
    .limit(NOTIFICATIONS_PAGE_SIZE + 1);
  return {
    items: rows.slice(0, NOTIFICATIONS_PAGE_SIZE).map(toView),
    hasMore: rows.length > NOTIFICATIONS_PAGE_SIZE,
  };
}
