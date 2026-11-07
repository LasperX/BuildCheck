import 'server-only';

import { notifications } from '@/db/schema';
import type { db } from '@/lib/db';

// สร้างการแจ้งเตือน (หัวข้อ 3.8) จุดเดียวทุกประเภท
// เฟส 11 จะเพิ่มการเปิด/ปิดตามประเภทและส่งแบบสดผ่าน SSE โดยแก้ที่ไฟล์นี้ไฟล์เดียว

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

export type NotifyInput = {
  /** ผู้รับ */
  userId: string;
  type:
    | 'comment'
    | 'reply'
    | 'vote'
    | 'fork'
    | 'price_change'
    | 'system'
    | 'price_alert'
    | 'report_reviewed';
  /** ผู้ทำให้เกิด ถ้าเป็นคนเดียวกับผู้รับจะไม่แจ้ง (ไม่แจ้งเตือนตัวเอง) */
  actorId?: string | null;
  buildId?: string | null;
  message: string;
};

export async function notify(executor: Executor, input: NotifyInput | NotifyInput[]) {
  const list = (Array.isArray(input) ? input : [input]).filter(
    (item) => !item.actorId || item.actorId !== item.userId,
  );
  if (list.length === 0) return;
  await executor.insert(notifications).values(
    list.map((item) => ({
      userId: item.userId,
      type: item.type,
      actorId: item.actorId ?? null,
      buildId: item.buildId ?? null,
      // คอลัมน์ยาวได้ 255 ตัวอักษร
      message: item.message.slice(0, 255),
    })),
  );
}
