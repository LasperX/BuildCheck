import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
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

// หัวข้อ 6.4 กลุ่มสเปกและชุมชน (5 ตาราง) รวมคอลัมน์มือสองจาก 6.8 และ warranty จากมติ Q5

export const usageType = pgEnum('usage_type', ['gaming', 'office', 'creator', 'streaming']);
export const buildVisibility = pgEnum('build_visibility', ['public', 'unlisted', 'private']);
export const compatStatus = pgEnum('compat_status', ['ok', 'warning', 'error']);
export const buildItemCondition = pgEnum('build_item_condition', ['new', 'A', 'B', 'C']);

export const builds = pgTable(
  'builds',
  {
    id: text('id').primaryKey(), // รหัสสั้น 10 ตัวอักษร ใช้ทำลิงก์แชร์
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // ต้นฉบับถูกลบ สเปกที่ Fork ไปยังอยู่ แค่ไม่มีลิงก์กลับ
    forkedFromId: text('forked_from_id').references((): AnyPgColumn => builds.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 100 }).notNull(),
    description: text('description'),
    usageType: usageType('usage_type').notNull(),
    budget: numeric('budget', { precision: 10, scale: 2, mode: 'number' }),
    visibility: buildVisibility('visibility').notNull().default('private'),
    // 4 ค่าด้านล่างคำนวณแล้วเก็บไว้ เพื่อให้กรองและเรียงหน้าชุมชนได้เร็ว
    totalPrice: numeric('total_price', { precision: 10, scale: 2, mode: 'number' })
      .notNull()
      .default(0),
    totalNewPrice: numeric('total_new_price', { precision: 10, scale: 2, mode: 'number' })
      .notNull()
      .default(0), // ราคาถ้าซื้อใหม่ทั้งชุด ใช้คำนวณยอดประหยัด
    totalWatt: integer('total_watt').notNull().default(0),
    perfScore: smallint('perf_score').notNull().default(0),
    compatStatus: compatStatus('compat_status').notNull().default('ok'),
    voteScore: integer('vote_score').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Index ตามหัวข้อ 6.7
    // ต้องระบุ nullsFirst ให้ตรงกับค่าเริ่มต้นของ ORDER BY ... DESC ใน PostgreSQL
    // ถ้าปล่อยตามค่าของ Drizzle (NULLS LAST) ฐานข้อมูลจะใช้ Index นี้ช่วยเรียงไม่ได้
    index('builds_visibility_votes_idx').on(t.visibility, t.voteScore.desc().nullsFirst()),
    index('builds_visibility_created_idx').on(t.visibility, t.createdAt.desc().nullsFirst()),
    index('builds_user_idx').on(t.userId),
  ],
);

export const buildItems = pgTable(
  'build_items',
  {
    id: serial('id').primaryKey(),
    buildId: text('build_id')
      .notNull()
      .references(() => builds.id, { onDelete: 'cascade' }),
    // restrict: อะไหล่ที่มีคนใช้อยู่ลบไม่ได้ ให้ซ่อนด้วย is_active แทน
    partId: integer('part_id')
      .notNull()
      .references(() => parts.id, { onDelete: 'restrict' }),
    quantity: smallint('quantity').notNull().default(1),
    priceAtAdd: numeric('price_at_add', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    condition: buildItemCondition('condition').notNull().default('new'),
    offeredPrice: numeric('offered_price', { precision: 10, scale: 2, mode: 'number' }),
    warrantyMonthsLeft: smallint('warranty_months_left'), // มติ Q5 ใช้กับ U04, ว่าง = ไม่ระบุ
  },
  (t) => [
    index('build_items_build_idx').on(t.buildId),
    index('build_items_part_idx').on(t.partId),
    check('build_items_quantity_positive', sql`${t.quantity} > 0`),
  ],
);

// หนึ่งคนโหวตได้หนึ่งครั้งต่อสเปก: ใช้ (build_id, user_id) เป็น PK จึงซ้ำไม่ได้
export const buildVotes = pgTable(
  'build_votes',
  {
    buildId: text('build_id')
      .notNull()
      .references(() => builds.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    value: smallint('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'build_votes_pk', columns: [t.buildId, t.userId] }),
    check('build_votes_value', sql`${t.value} IN (1, -1)`),
  ],
);

export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    buildId: text('build_id')
      .notNull()
      .references(() => builds.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // ตอบกลับได้ 1 ชั้น: Server Action ตรวจว่า parent ต้องไม่ใช่คำตอบอยู่แล้ว
    parentId: integer('parent_id').references((): AnyPgColumn => comments.id, {
      onDelete: 'cascade',
    }),
    body: varchar('body', { length: 1000 }).notNull(),
    isHidden: boolean('is_hidden').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('comments_build_idx').on(t.buildId, t.createdAt)],
);

export const favorites = pgTable(
  'favorites',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    buildId: text('build_id')
      .notNull()
      .references(() => builds.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: 'favorites_pk', columns: [t.userId, t.buildId] })],
);
