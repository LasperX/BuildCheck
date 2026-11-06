import { CircleCheck, CircleX, Info, type LucideIcon, TriangleAlert } from 'lucide-react';

import type { CompatStatus, Level } from '@/lib/compat';

// สีสถานะมาพร้อมไอคอนเสมอ คนตาบอดสีจึงแยกได้จากรูปทรง (หลักการในระบบออกแบบ)

export const LEVEL_UI: Record<
  Level,
  { label: string; icon: LucideIcon; badge: 'err' | 'warn' | 'info'; text: string; soft: string }
> = {
  error: {
    label: 'ผิดพลาด',
    icon: CircleX,
    badge: 'err',
    text: 'text-err-fg',
    soft: 'border-err-border bg-err-soft',
  },
  warning: {
    label: 'เตือน',
    icon: TriangleAlert,
    badge: 'warn',
    text: 'text-warn-fg',
    soft: 'border-warn-border bg-warn-soft',
  },
  info: {
    label: 'ข้อมูล',
    icon: Info,
    badge: 'info',
    text: 'text-info-fg',
    soft: 'border-info-border bg-info-soft',
  },
};

export const STATUS_UI: Record<
  CompatStatus,
  { title: string; body: string; icon: LucideIcon; soft: string; text: string }
> = {
  ok: {
    title: 'เข้ากันได้ทั้งหมด',
    body: 'ไม่พบปัญหาที่ทำให้ประกอบไม่ได้',
    icon: CircleCheck,
    soft: 'border-ok-border bg-ok-soft',
    text: 'text-ok-fg',
  },
  warning: {
    title: 'ใช้ได้ แต่มีข้อควรระวัง',
    body: 'ประกอบได้ แต่บางชิ้นเสียประสิทธิภาพหรือมีความเสี่ยง',
    icon: TriangleAlert,
    soft: 'border-warn-border bg-warn-soft',
    text: 'text-warn-fg',
  },
  error: {
    title: 'มีชิ้นที่ใส่ด้วยกันไม่ได้',
    body: 'แก้ปัญหาระดับผิดพลาดก่อนซื้อ',
    icon: CircleX,
    soft: 'border-err-border bg-err-soft',
    text: 'text-err-fg',
  },
};
