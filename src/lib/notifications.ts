import { z } from 'zod';

// ประเภทการแจ้งเตือนและป้ายภาษาไทย (หัวข้อ 3.8) ใช้ทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์

export type NotificationType =
  | 'comment'
  | 'reply'
  | 'vote'
  | 'fork'
  | 'price_change'
  | 'system'
  | 'price_alert'
  | 'report_reviewed';

/** ประเภทที่ผู้ใช้ปิดได้ ส่วน "ประกาศจากระบบ" ปิดไม่ได้ */
export const MUTABLE_TYPES = [
  'comment',
  'reply',
  'vote',
  'fork',
  'price_change',
  'price_alert',
  'report_reviewed',
] as const satisfies readonly NotificationType[];

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  comment: 'มีคนคอมเมนต์สเปกของฉัน',
  reply: 'มีคนตอบกลับคอมเมนต์ของฉัน',
  vote: 'มีคนโหวตให้สเปกของฉัน',
  fork: 'มีคน Fork สเปกของฉัน',
  price_change: 'ราคาอะไหล่ในสเปกที่บันทึกไว้เปลี่ยน',
  price_alert: 'ราคากลางมือสองถึงราคาที่ตั้งเตือนไว้',
  report_reviewed: 'ผลตรวจรายงานราคามือสองของฉัน',
  system: 'ประกาศจากระบบ',
};

export const mutedSchema = z.array(z.enum(MUTABLE_TYPES)).max(MUTABLE_TYPES.length);

export type NotificationView = {
  id: number;
  type: NotificationType;
  message: string;
  buildId: string | null;
  readAt: string | null;
  createdAt: string;
};

/** ลิงก์ที่เปิดเมื่อกดการแจ้งเตือน */
export function notificationHref(item: Pick<NotificationView, 'type' | 'buildId'>): string {
  if (item.buildId) return `/builds/${item.buildId}`;
  if (item.type === 'price_alert') return '/me/price-alerts';
  if (item.type === 'report_reviewed') return '/used';
  return '/me/notifications';
}

/** เวลาแบบสั้น เช่น "เมื่อสักครู่" "5 นาทีที่แล้ว" ส่ง now มาเพื่อให้ผลแน่นอนตอนทดสอบ */
export function timeAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return 'เมื่อสักครู่';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} วันที่แล้ว`;
  return new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
}
