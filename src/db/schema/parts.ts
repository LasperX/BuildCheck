import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './users';

// หัวข้อ 6.2 กลุ่มอะไหล่ (4 ตาราง)

// สถานะการขาย: new = ยังมีขายมือหนึ่ง, used_only = เลิกขายมือหนึ่งแล้ว หาได้แต่มือสอง
// used_only ใช้ช่อง price เป็น "ราคาตอนเปิดตัว" สำหรับคำนวณค่าเสื่อมเท่านั้น ไม่ใช่ราคาที่ซื้อได้
export const partAvailability = pgEnum('part_availability', ['new', 'used_only']);

// PostgreSQL มีชนิด tsvector แต่ Drizzle ไม่มีให้ในตัว จึงประกาศเอง
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 30 }).notNull().unique(),
  nameTh: varchar('name_th', { length: 60 }).notNull(),
  nameEn: varchar('name_en', { length: 60 }).notNull(),
  icon: varchar('icon', { length: 40 }).notNull(),
  sortOrder: integer('sort_order').notNull(),
  required: boolean('required').notNull().default(false),
  allowMultiple: boolean('allow_multiple').notNull().default(false),
});

export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 60 }).notNull().unique(),
  logoUrl: text('logo_url'),
});

// ข้อมูลกลางของอะไหล่ทุกชิ้น ส่วนสเปกเฉพาะหมวดแยกไปอยู่ specs.ts แบบ 1:1
export const parts = pgTable(
  'parts',
  {
    id: serial('id').primaryKey(),
    // restrict: ห้ามลบหมวดหรือยี่ห้อที่ยังมีอะไหล่ใช้อยู่
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    brandId: integer('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'restrict' }),
    model: varchar('model', { length: 150 }).notNull(),
    slug: varchar('slug', { length: 180 }).notNull().unique(),
    price: numeric('price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    powerWatt: integer('power_watt'),
    imageUrl: text('image_url'),
    releaseYear: smallint('release_year'),
    isActive: boolean('is_active').notNull().default(true),
    availability: partAvailability('availability').notNull().default('new'),
    // เพิ่มตามมติ Q5: แหล่งอ้างอิงสเปก และสถานะที่ตรวจแล้ว (false = "รอตรวจสอบ")
    specSourceUrl: text('spec_source_url'),
    specVerified: boolean('spec_verified').notNull().default(false),
    // Trigger ในฐานข้อมูลเติมค่านี้ให้จากชื่อรุ่น + ยี่ห้อ (ดู migration 0001)
    searchVector: tsvector('search_vector'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Index ตามหัวข้อ 6.7
    index('parts_category_active_price_idx').on(t.categoryId, t.isActive, t.price),
    index('parts_search_vector_idx').using('gin', t.searchVector),
    check('parts_price_non_negative', sql`${t.price} >= 0`),
  ],
);

// ประวัติราคาที่แอดมินปรับ
export const partPriceHistory = pgTable(
  'part_price_history',
  {
    id: serial('id').primaryKey(),
    partId: integer('part_id')
      .notNull()
      .references(() => parts.id, { onDelete: 'cascade' }),
    price: numeric('price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    // ลบบัญชีแอดมินแล้วประวัติราคายังอยู่ แค่ไม่รู้ว่าใครแก้
    changedBy: text('changed_by').references(() => users.id, { onDelete: 'set null' }),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('part_price_history_part_idx').on(t.partId, t.changedAt)],
);
