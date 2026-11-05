import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

import { parts } from './parts';
import { users } from './users';

// หัวข้อ 6.8 กลุ่มมือสอง (4 ตาราง)

export const usedGrade = pgEnum('used_grade', ['A', 'B', 'C']);
export const usedReportType = pgEnum('used_report_type', ['listed', 'bought', 'sold']);
export const usedReportChannel = pgEnum('used_report_channel', [
  'facebook',
  'marketplace_app',
  'shop',
  'friend',
  'other',
]);
export const usedReportStatus = pgEnum('used_report_status', ['pending', 'approved', 'rejected']);
export const usedPriceSource = pgEnum('used_price_source', ['reports', 'survey', 'estimate']);
export const usedPriceConfidence = pgEnum('used_price_confidence', ['high', 'medium', 'estimate']);

// ราคากลางที่แอดมินสำรวจตลาดเอง (แหล่งลำดับ 2 ในหัวข้อ 4.6)
export const partUsedPrices = pgTable(
  'part_used_prices',
  {
    id: serial('id').primaryKey(),
    partId: integer('part_id')
      .notNull()
      .references(() => parts.id, { onDelete: 'cascade' }),
    grade: usedGrade('grade').notNull(),
    minPrice: numeric('min_price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    maxPrice: numeric('max_price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    surveyedAt: date('surveyed_at').notNull(),
    sourceNote: text('source_note'),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    index('part_used_prices_part_grade_idx').on(t.partId, t.grade, t.surveyedAt),
    check('part_used_prices_range', sql`${t.minPrice} <= ${t.maxPrice}`),
  ],
);

// ราคาที่สมาชิกรายงาน (แหล่งลำดับ 1)
export const usedPriceReports = pgTable(
  'used_price_reports',
  {
    id: serial('id').primaryKey(),
    partId: integer('part_id')
      .notNull()
      .references(() => parts.id, { onDelete: 'cascade' }),
    // ลบบัญชีแล้วราคายังใช้คำนวณต่อได้ แต่ไม่ผูกกับตัวบุคคล (PDPA)
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    price: numeric('price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    grade: usedGrade('grade').notNull(),
    reportType: usedReportType('report_type').notNull(),
    channel: usedReportChannel('channel').notNull(),
    province: varchar('province', { length: 40 }),
    warrantyMonthsLeft: smallint('warranty_months_left').notNull().default(0), // 0 = ไม่มีประกัน
    seenAt: date('seen_at').notNull(),
    proofImageUrl: text('proof_image_url'),
    status: usedReportStatus('status').notNull().default('pending'),
    reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Index ตามหัวข้อ 6.8 สำหรับคำนวณราคากลาง
    index('used_price_reports_calc_idx').on(t.partId, t.grade, t.status, t.seenAt),
    check('used_price_reports_price_positive', sql`${t.price} > 0`),
  ],
);

// ผลคำนวณราคากลางที่เก็บไว้ คำนวณใหม่ทุกคืนและทุกครั้งที่อนุมัติรายงาน
export const partUsedStats = pgTable(
  'part_used_stats',
  {
    partId: integer('part_id')
      .notNull()
      .references(() => parts.id, { onDelete: 'cascade' }),
    grade: usedGrade('grade').notNull(),
    medianPrice: numeric('median_price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    p25Price: numeric('p25_price', { precision: 10, scale: 2, mode: 'number' }),
    p75Price: numeric('p75_price', { precision: 10, scale: 2, mode: 'number' }),
    reportCount: smallint('report_count').notNull().default(0),
    source: usedPriceSource('source').notNull(),
    confidence: usedPriceConfidence('confidence').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: 'part_used_stats_pk', columns: [t.partId, t.grade] })],
);

export const priceAlerts = pgTable(
  'price_alerts',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    partId: integer('part_id')
      .notNull()
      .references(() => parts.id, { onDelete: 'cascade' }),
    grade: usedGrade('grade').notNull(),
    targetPrice: numeric('target_price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    triggeredAt: timestamp('triggered_at', { withTimezone: true }), // ว่าง = ยังไม่ถึงราคา
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('price_alerts_part_grade_idx').on(t.partId, t.grade, t.triggeredAt)],
);
