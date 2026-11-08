import { asc, eq } from 'drizzle-orm';
import type { MetadataRoute } from 'next';
import { cacheLife, cacheTag } from 'next/cache';

import { categories, parts } from '@/db/schema';
import { appUrl } from '@/lib/builder/share';
import { db } from '@/lib/db';
import { CATEGORY_SLUGS } from '@/lib/parts/spec-fields';

// sitemap.xml: รายชื่อหน้าสาธารณะให้ search engine รู้จัก
// หน้าคงที่ + หน้าหมวดอะไหล่ + หน้ารายละเอียดอะไหล่ที่แสดงบนเว็บ (ไม่รวมชิ้นที่ซ่อน)
// สเปกของสมาชิกไม่ใส่ เพราะเป็นเนื้อหาของผู้ใช้ และเปลี่ยนเป็นส่วนตัวได้ทุกเมื่อ

const STATIC_PATHS = [
  { path: '', priority: 1 },
  { path: '/builder', priority: 0.9 },
  { path: '/budget', priority: 0.9 },
  { path: '/parts', priority: 0.8 },
  { path: '/used', priority: 0.7 },
  { path: '/builds', priority: 0.7 },
  { path: '/compare', priority: 0.6 },
  { path: '/guide', priority: 0.5 },
  { path: '/about', priority: 0.4 },
  { path: '/privacy', priority: 0.2 },
] as const;

async function activePartPaths() {
  'use cache';
  cacheTag('parts');
  cacheLife('hours');
  return db
    .select({ slug: parts.slug, category: categories.slug, updatedAt: parts.updatedAt })
    .from(parts)
    .innerJoin(categories, eq(parts.categoryId, categories.id))
    .where(eq(parts.isActive, true))
    .orderBy(asc(categories.sortOrder), asc(parts.slug));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const partRows = await activePartPaths();
  return [
    ...STATIC_PATHS.map(({ path, priority }) => ({ url: `${base}${path}`, priority })),
    ...CATEGORY_SLUGS.map((slug) => ({ url: `${base}/parts/${slug}`, priority: 0.7 })),
    ...partRows.map((row) => ({
      url: `${base}/parts/${row.category}/${encodeURIComponent(row.slug)}`,
      lastModified: row.updatedAt,
      priority: 0.6,
    })),
  ];
}
