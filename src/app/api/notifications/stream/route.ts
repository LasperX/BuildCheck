import { type NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import {
  countUnread,
  latestNotifications,
  notificationsAfter,
} from '@/server/queries/notifications';

// แจ้งเตือนแบบสดด้วย Server-Sent Events (หัวข้อ 7, 8.3)
//
// ทำงานอย่างไร
//   1. เบราว์เซอร์เปิด EventSource มาที่ URL นี้ (ส่งคุกกี้ Session มาด้วยเอง)
//   2. เซิร์ฟเวอร์ส่ง "snapshot" ครั้งแรก: จำนวนที่ยังไม่อ่าน และรายการล่าสุด
//   3. จากนั้นทุก 3 วินาที อ่านแถวที่ id ใหม่กว่าตัวล่าสุดที่ส่งไปแล้ว ถ้ามีจะส่ง event "notification"
//   4. ทุก 15 วินาทีส่งบรรทัดว่าง (comment) กันพร็อกซีตัดการเชื่อมต่อ
//   5. ครบ 50 วินาทีปิดเอง เพราะ Vercel จำกัดเวลาต่อคำขอ เบราว์เซอร์จะต่อใหม่อัตโนมัติ
//      และส่ง Last-Event-ID มา จึงไม่พลาดรายการที่เกิดระหว่างต่อใหม่
//
// ทำไมวนอ่านฐานข้อมูล: บน Vercel แต่ละคำขออาจอยู่คนละเครื่อง เก็บไว้ในหน่วยความจำแล้วส่งข้ามเครื่องไม่ได้
// (บันทึกไว้ใน spec-review หัวข้อ D ข้อ 11)

export const maxDuration = 60;

const POLL_MS = 3000;
const HEARTBEAT_MS = 15_000;
const LIFETIME_MS = 50_000;

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response('กรุณาเข้าสู่ระบบ', { status: 401 });
  const userId = session.user.id;

  const lastEventId = Number(request.headers.get('last-event-id'));
  const encoder = new TextEncoder();

  // เก็บสถานะไว้นอก ReadableStream เพื่อให้ cancel() (เบราว์เซอร์ตัดการเชื่อมต่อ) หยุดลูปได้
  let closed = false;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      const event = (name: string, data: unknown, id?: number) =>
        send(`${id ? `id: ${id}\n` : ''}event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // ปิดไปแล้ว
        }
      };

      // ลูปเดียว: รอ 3 วินาที → อ่านแถวใหม่ → ส่ง วนจนครบ 50 วินาทีหรือเบราว์เซอร์ตัดการเชื่อมต่อ
      // เบราว์เซอร์ปิดการเชื่อมต่อ → ReadableStream เรียก cancel() → closed = true → ลูปหยุดในรอบถัดไป
      const run = async () => {
        // บอกเบราว์เซอร์ให้รอ 2 วินาทีก่อนต่อใหม่
        send('retry: 2000\n\n');
        let lastId: number;
        if (Number.isInteger(lastEventId) && lastEventId > 0) {
          // ต่อใหม่: ส่งจำนวนที่ยังไม่อ่านล่าสุด (อาจอ่านจากแท็บอื่นแล้ว) แล้วส่งเฉพาะรายการที่พลาดไป
          lastId = lastEventId;
          event('unread', { unread: await countUnread(userId) });
        } else {
          const [unread, items] = await Promise.all([
            countUnread(userId),
            latestNotifications(userId),
          ]);
          lastId = items[0]?.id ?? 0;
          event('snapshot', { unread, items }, lastId || undefined);
        }

        const startedAt = Date.now();
        let lastPing = startedAt;
        while (!closed && Date.now() - startedAt < LIFETIME_MS) {
          await sleep(POLL_MS);
          if (closed) break;
          const fresh = await notificationsAfter(userId, lastId);
          if (fresh.length > 0) {
            const unread = await countUnread(userId);
            for (const item of fresh) {
              lastId = item.id;
              event('notification', { item, unread }, item.id);
            }
          }
          if (Date.now() - lastPing >= HEARTBEAT_MS) {
            send(': ping\n\n');
            lastPing = Date.now();
          }
        }
      };
      run()
        .catch(() => undefined)
        .finally(finish);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // ปิด buffer ของพร็อกซี ข้อความจะไปถึงทันที
      'X-Accel-Buffering': 'no',
    },
  });
}
