import { boolean, index, pgEnum, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

// หัวข้อ 6.1 กลุ่มผู้ใช้ (4 ตาราง)
// คอลัมน์ที่มีหมายเหตุ "Better Auth" ไม่อยู่ในเอกสารสเปก แต่ไลบรารีต้องใช้ ตรวจจากแพ็กเกจ better-auth 1.7.18
// เฟส 3 จะตั้งให้ name ชี้ไป display_name และ password ชี้ไป password_hash

export const userRole = pgEnum('user_role', ['member', 'admin']);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  // ว่างได้ เพราะคนที่สมัครด้วย Google ยังไม่มีชื่อผู้ใช้จนกว่าระบบจะสร้างให้
  username: varchar('username', { length: 30 }).unique(),
  displayUsername: varchar('display_username', { length: 30 }), // Better Auth
  displayName: varchar('display_name', { length: 60 }).notNull(),
  image: text('image'),
  bio: varchar('bio', { length: 300 }),
  role: userRole('role').notNull().default('member'),
  banned: boolean('banned').notNull().default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires', { withTimezone: true }), // Better Auth
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// วิธีล็อกอินของผู้ใช้: รหัสผ่าน (credential) หรือ Google
export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerId: varchar('provider_id', { length: 30 }).notNull(),
    accountId: text('account_id').notNull(),
    passwordHash: text('password_hash'),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'), // Better Auth
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }), // Better Auth
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }), // Better Auth
    scope: text('scope'), // Better Auth
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }) // Better Auth
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('accounts_user_id_idx').on(t.userId)],
);

// การล็อกอินแต่ละอุปกรณ์ ลบบัญชีแล้วลบตาม
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    impersonatedBy: text('impersonated_by'), // Better Auth
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), // Better Auth
    updatedAt: timestamp('updated_at', { withTimezone: true }) // Better Auth
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);

// โทเคนยืนยันอีเมลและรีเซ็ตรหัสผ่าน
export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), // Better Auth
    updatedAt: timestamp('updated_at', { withTimezone: true }) // Better Auth
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
);
