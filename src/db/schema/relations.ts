import { relations } from 'drizzle-orm';

import { buildItems, buildVotes, builds, comments, favorites } from './builds';
import { brands, categories, partPriceHistory, parts } from './parts';
import {
  caseSpecs,
  coolerSpecs,
  cpuSpecs,
  gpuSpecs,
  motherboardSpecs,
  psuSpecs,
  ramSpecs,
  storageSpecs,
} from './specs';
import { adminLogs, notifications } from './system';
import { partUsedPrices, partUsedStats, priceAlerts, usedPriceReports } from './used';
import { accounts, sessions, users } from './users';

// ความสัมพันธ์หลักตามหัวข้อ 6.6 ใช้กับคำสั่งแบบ db.query.xxx.findMany({ with: { ... } })
// ไม่ได้สร้างอะไรเพิ่มในฐานข้อมูล คีย์นอกจริงประกาศไว้ในแต่ละตารางแล้ว

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  builds: many(builds),
  comments: many(comments),
  votes: many(buildVotes),
  favorites: many(favorites),
  notifications: many(notifications, { relationName: 'notificationRecipient' }),
  usedPriceReports: many(usedPriceReports),
  priceAlerts: many(priceAlerts),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  parts: many(parts),
}));

export const brandsRelations = relations(brands, ({ many }) => ({
  parts: many(parts),
}));

export const partsRelations = relations(parts, ({ one, many }) => ({
  category: one(categories, { fields: [parts.categoryId], references: [categories.id] }),
  brand: one(brands, { fields: [parts.brandId], references: [brands.id] }),
  priceHistory: many(partPriceHistory),
  buildItems: many(buildItems),
  // 1:1 กับตารางสเปก ชิ้นหนึ่งจะมีค่าแค่ตารางเดียวตามหมวดของตัวเอง
  cpu: one(cpuSpecs),
  motherboard: one(motherboardSpecs),
  ram: one(ramSpecs),
  gpu: one(gpuSpecs),
  storage: one(storageSpecs),
  psu: one(psuSpecs),
  case: one(caseSpecs),
  cooler: one(coolerSpecs),
  usedPrices: many(partUsedPrices),
  usedReports: many(usedPriceReports),
  usedStats: many(partUsedStats),
  priceAlerts: many(priceAlerts),
}));

export const partPriceHistoryRelations = relations(partPriceHistory, ({ one }) => ({
  part: one(parts, { fields: [partPriceHistory.partId], references: [parts.id] }),
  changedByUser: one(users, { fields: [partPriceHistory.changedBy], references: [users.id] }),
}));

export const cpuSpecsRelations = relations(cpuSpecs, ({ one }) => ({
  part: one(parts, { fields: [cpuSpecs.partId], references: [parts.id] }),
}));
export const motherboardSpecsRelations = relations(motherboardSpecs, ({ one }) => ({
  part: one(parts, { fields: [motherboardSpecs.partId], references: [parts.id] }),
}));
export const ramSpecsRelations = relations(ramSpecs, ({ one }) => ({
  part: one(parts, { fields: [ramSpecs.partId], references: [parts.id] }),
}));
export const gpuSpecsRelations = relations(gpuSpecs, ({ one }) => ({
  part: one(parts, { fields: [gpuSpecs.partId], references: [parts.id] }),
}));
export const storageSpecsRelations = relations(storageSpecs, ({ one }) => ({
  part: one(parts, { fields: [storageSpecs.partId], references: [parts.id] }),
}));
export const psuSpecsRelations = relations(psuSpecs, ({ one }) => ({
  part: one(parts, { fields: [psuSpecs.partId], references: [parts.id] }),
}));
export const caseSpecsRelations = relations(caseSpecs, ({ one }) => ({
  part: one(parts, { fields: [caseSpecs.partId], references: [parts.id] }),
}));
export const coolerSpecsRelations = relations(coolerSpecs, ({ one }) => ({
  part: one(parts, { fields: [coolerSpecs.partId], references: [parts.id] }),
}));

export const buildsRelations = relations(builds, ({ one, many }) => ({
  owner: one(users, { fields: [builds.userId], references: [users.id] }),
  // Fork อ้างกลับไปหาต้นฉบับ
  forkedFrom: one(builds, {
    fields: [builds.forkedFromId],
    references: [builds.id],
    relationName: 'buildForks',
  }),
  forks: many(builds, { relationName: 'buildForks' }),
  items: many(buildItems),
  comments: many(comments),
  votes: many(buildVotes),
  favorites: many(favorites),
}));

export const buildItemsRelations = relations(buildItems, ({ one }) => ({
  build: one(builds, { fields: [buildItems.buildId], references: [builds.id] }),
  part: one(parts, { fields: [buildItems.partId], references: [parts.id] }),
}));

export const buildVotesRelations = relations(buildVotes, ({ one }) => ({
  build: one(builds, { fields: [buildVotes.buildId], references: [builds.id] }),
  user: one(users, { fields: [buildVotes.userId], references: [users.id] }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  build: one(builds, { fields: [comments.buildId], references: [builds.id] }),
  author: one(users, { fields: [comments.userId], references: [users.id] }),
  // ตอบกลับคอมเมนต์ 1 ชั้น
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: 'commentReplies',
  }),
  replies: many(comments, { relationName: 'commentReplies' }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  build: one(builds, { fields: [favorites.buildId], references: [builds.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.userId],
    references: [users.id],
    relationName: 'notificationRecipient',
  }),
  actor: one(users, { fields: [notifications.actorId], references: [users.id] }),
  build: one(builds, { fields: [notifications.buildId], references: [builds.id] }),
}));

export const adminLogsRelations = relations(adminLogs, ({ one }) => ({
  admin: one(users, { fields: [adminLogs.adminId], references: [users.id] }),
}));

export const partUsedPricesRelations = relations(partUsedPrices, ({ one }) => ({
  part: one(parts, { fields: [partUsedPrices.partId], references: [parts.id] }),
}));

export const usedPriceReportsRelations = relations(usedPriceReports, ({ one }) => ({
  part: one(parts, { fields: [usedPriceReports.partId], references: [parts.id] }),
  reporter: one(users, { fields: [usedPriceReports.userId], references: [users.id] }),
}));

export const partUsedStatsRelations = relations(partUsedStats, ({ one }) => ({
  part: one(parts, { fields: [partUsedStats.partId], references: [parts.id] }),
}));

export const priceAlertsRelations = relations(priceAlerts, ({ one }) => ({
  user: one(users, { fields: [priceAlerts.userId], references: [users.id] }),
  part: one(parts, { fields: [priceAlerts.partId], references: [parts.id] }),
}));
