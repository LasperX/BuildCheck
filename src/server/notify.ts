import 'server-only';

import { and, eq, inArray, ne } from 'drizzle-orm';

import { buildItems, builds, notifications, users } from '@/db/schema';
import type { db } from '@/lib/db';
import type { NotificationType } from '@/lib/notifications';
import { formatBaht } from '@/lib/parts/catalog';

// สร้างการแจ้งเตือน (หัวข้อ 3.8) จุดเดียวทุกประเภท
//   - ไม่แจ้งเตือนตัวเอง (ผู้ทำ = ผู้รับ)
//   - ข้ามผู้รับที่ปิดการแจ้งเตือนประเภทนั้นไว้ (users.muted_notifications)
// การส่งแบบสด: /api/notifications/stream อ่านแถวใหม่จากตารางนี้แล้วส่งให้เบราว์เซอร์ จึงไม่ต้องแก้จุดที่สร้าง

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

export type NotifyInput = {
  /** ผู้รับ */
  userId: string;
  type: NotificationType;
  /** ผู้ทำให้เกิด ถ้าเป็นคนเดียวกับผู้รับจะไม่แจ้ง */
  actorId?: string | null;
  buildId?: string | null;
  message: string;
};

export async function notify(executor: Executor, input: NotifyInput | NotifyInput[]) {
  const list = (Array.isArray(input) ? input : [input]).filter(
    (item) => !item.actorId || item.actorId !== item.userId,
  );
  if (list.length === 0) return 0;

  const recipients = [...new Set(list.map((item) => item.userId))];
  const prefs = await executor
    .select({ id: users.id, muted: users.mutedNotifications })
    .from(users)
    .where(inArray(users.id, recipients));
  const muted = new Map(prefs.map((row) => [row.id, new Set(row.muted)]));
  // ประกาศจากระบบปิดไม่ได้
  const allowed = list.filter(
    (item) => item.type === 'system' || !muted.get(item.userId)?.has(item.type),
  );
  if (allowed.length === 0) return 0;

  await executor.insert(notifications).values(
    allowed.map((item) => ({
      userId: item.userId,
      type: item.type,
      actorId: item.actorId ?? null,
      buildId: item.buildId ?? null,
      // คอลัมน์ยาวได้ 255 ตัวอักษร
      message: item.message.slice(0, 255),
    })),
  );
  return allowed.length;
}

/**
 * แอดมินเปลี่ยนราคาอะไหล่ → แจ้งเจ้าของสเปกที่มีชิ้นนี้ (หัวข้อ 3.8)
 * เทียบกับราคาตอนเพิ่มลงสเปก (build_items.price_at_add) สเปกละ 1 แจ้งเตือน
 * ถ้าราคากลับมาเท่ากับตอนเพิ่ม ไม่ต้องแจ้ง
 */
export async function notifyPriceChange(
  executor: Executor,
  part: { id: number; model: string; newPrice: number },
  adminId: string,
) {
  const rows = await executor
    .select({
      buildId: builds.id,
      title: builds.title,
      userId: builds.userId,
      priceAtAdd: buildItems.priceAtAdd,
    })
    .from(buildItems)
    .innerJoin(builds, eq(builds.id, buildItems.buildId))
    .where(and(eq(buildItems.partId, part.id), ne(buildItems.priceAtAdd, part.newPrice)));

  return notify(
    executor,
    rows.map((row) => {
      const diff = part.newPrice - row.priceAtAdd;
      return {
        userId: row.userId,
        actorId: adminId,
        buildId: row.buildId,
        type: 'price_change' as const,
        message: `${part.model} ในสเปก "${row.title}" ${diff < 0 ? 'ลดลง' : 'เพิ่มขึ้น'} ${formatBaht(Math.abs(diff))} เป็น ${formatBaht(part.newPrice)}`,
      };
    }),
  );
}
