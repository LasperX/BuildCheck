import {
  bigserial,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

import { builds } from './builds';
import { users } from './users';

// หัวข้อ 6.5 กลุ่มระบบ (4 ตาราง) รวมชนิดแจ้งเตือนมือสองจาก 6.8

export const notificationType = pgEnum('notification_type', [
  'comment',
  'reply',
  'vote',
  'fork',
  'price_change',
  'system',
  'price_alert',
  'report_reviewed',
]);
export const reportTargetType = pgEnum('report_target_type', ['build', 'comment', 'user']);
export const reportReason = pgEnum('report_reason', ['spam', 'offensive', 'wrong_info', 'other']);
export const reportStatus = pgEnum('report_status', ['open', 'resolved', 'dismissed']);

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id') // ผู้รับ
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }), // ผู้ทำให้เกิด
    buildId: text('build_id').references(() => builds.id, { onDelete: 'set null' }),
    message: varchar('message', { length: 255 }).notNull(),
    readAt: timestamp('read_at', { withTimezone: true }), // ว่าง = ยังไม่อ่าน
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Index ตามหัวข้อ 6.7
    index('notifications_user_read_idx').on(t.userId, t.readAt),
  ],
);

export const reports = pgTable(
  'reports',
  {
    id: serial('id').primaryKey(),
    // ลบบัญชีผู้รายงานแล้ว รายงานยังอยู่ให้แอดมินตรวจต่อได้
    reporterId: text('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    targetType: reportTargetType('target_type').notNull(),
    targetId: text('target_id').notNull(),
    reason: reportReason('reason').notNull(),
    detail: text('detail'),
    status: reportStatus('status').notNull().default('open'),
    resolvedBy: text('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [index('reports_status_idx').on(t.status, t.createdAt)],
);

// ค่าตั้งระบบแบบ key–value เช่น psu_headroom, budget_ratio_gaming, depreciation_rates
export const settings = pgTable('settings', {
  key: varchar('key', { length: 60 }).primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const adminLogs = pgTable(
  'admin_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    adminId: text('admin_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 40 }).notNull(), // เช่น part.update, user.ban
    targetType: varchar('target_type', { length: 40 }),
    targetId: varchar('target_id', { length: 40 }),
    changes: jsonb('changes').$type<{ before?: unknown; after?: unknown }>(), // ค่าก่อน/หลังแก้
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('admin_logs_admin_created_idx').on(t.adminId, t.createdAt)],
);

// ตัวนับจำกัดการใช้งาน ตามหัวข้อ 9.1 (ล็อกอินผิด 5 ครั้งต่อ 15 นาที, คอมเมนต์ 10 ครั้งต่อนาที)
// เก็บในฐานข้อมูลเพราะบน Vercel แต่ละคำขออาจอยู่คนละเครื่อง เก็บในหน่วยความจำจะนับไม่ตรง
// key เป็นค่าแฮช จึงไม่เก็บอีเมลหรือ IP แบบอ่านได้
// ตารางนี้เพิ่มจากเอกสารสเปกตามมติเฟส 3 จึงมีทั้งหมด 30 ตาราง
export const rateLimits = pgTable('rate_limits', {
  key: varchar('key', { length: 64 }).primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
});
