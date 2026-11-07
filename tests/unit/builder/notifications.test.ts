import { describe, expect, it } from 'vitest';

import { mutedSchema, notificationHref, timeAgo } from '@/lib/notifications';

describe('timeAgo', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  it('แสดงเวลาแบบสั้นตามช่วง', () => {
    expect(timeAgo('2026-11-07T11:59:30Z', now)).toBe('เมื่อสักครู่');
    expect(timeAgo('2026-11-07T11:55:00Z', now)).toBe('5 นาทีที่แล้ว');
    expect(timeAgo('2026-11-07T09:00:00Z', now)).toBe('3 ชั่วโมงที่แล้ว');
    expect(timeAgo('2026-11-05T12:00:00Z', now)).toBe('2 วันที่แล้ว');
  });

  it('เวลาในอนาคต (นาฬิกาเครื่องเพี้ยน) ถือเป็นเมื่อสักครู่', () => {
    expect(timeAgo('2026-11-07T12:05:00Z', now)).toBe('เมื่อสักครู่');
  });
});

describe('notificationHref', () => {
  it('มีสเปกที่เกี่ยวข้องไปหน้าสเปก ไม่มีไปตามประเภท', () => {
    expect(notificationHref({ type: 'comment', buildId: 'aaaaaaaaaa' })).toBe('/builds/aaaaaaaaaa');
    expect(notificationHref({ type: 'price_alert', buildId: null })).toBe('/me/price-alerts');
    expect(notificationHref({ type: 'system', buildId: null })).toBe('/me/notifications');
  });
});

describe('mutedSchema', () => {
  it('รับเฉพาะประเภทที่ปิดได้ ประกาศจากระบบปิดไม่ได้', () => {
    expect(mutedSchema.safeParse(['vote', 'fork']).success).toBe(true);
    expect(mutedSchema.safeParse(['system']).success).toBe(false);
    expect(mutedSchema.safeParse(['hack']).success).toBe(false);
  });
});
