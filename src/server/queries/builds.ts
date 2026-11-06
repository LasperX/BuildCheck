import 'server-only';

import { asc, eq } from 'drizzle-orm';

import { buildItems, builds, users } from '@/db/schema';
import { db } from '@/lib/db';
import { CATEGORY_SLUGS } from '@/lib/parts/spec-fields';

import { getEngineParts } from './engine-parts';

// อ่านสเปกที่บันทึกไว้ ไม่ใส่แคช เพราะผลขึ้นกับว่าใครเปิด (สเปกส่วนตัวเห็นเฉพาะเจ้าของ)

export async function getBuildWithItems(id: string) {
  const [build] = await db
    .select({
      id: builds.id,
      userId: builds.userId,
      title: builds.title,
      description: builds.description,
      usageType: builds.usageType,
      budget: builds.budget,
      visibility: builds.visibility,
      totalPrice: builds.totalPrice,
      totalNewPrice: builds.totalNewPrice,
      totalWatt: builds.totalWatt,
      perfScore: builds.perfScore,
      compatStatus: builds.compatStatus,
      voteScore: builds.voteScore,
      forkedFromId: builds.forkedFromId,
      createdAt: builds.createdAt,
      updatedAt: builds.updatedAt,
      ownerName: users.displayName,
      ownerUsername: users.username,
      ownerImage: users.image,
    })
    .from(builds)
    .innerJoin(users, eq(builds.userId, users.id))
    .where(eq(builds.id, id));
  if (!build) return null;

  const items = await db
    .select({
      partId: buildItems.partId,
      quantity: buildItems.quantity,
      condition: buildItems.condition,
      offeredPrice: buildItems.offeredPrice,
      warrantyMonthsLeft: buildItems.warrantyMonthsLeft,
      priceAtAdd: buildItems.priceAtAdd,
    })
    .from(buildItems)
    .where(eq(buildItems.buildId, id))
    .orderBy(asc(buildItems.id));

  const parts = await getEngineParts(items.map((item) => item.partId));
  const byId = new Map(parts.map((part) => [part.id, part]));
  return {
    build,
    // เรียงตามลำดับหมวด CPU → เมนบอร์ด → … ไม่ใช่ลำดับที่เพิ่ม
    items: items
      .flatMap((item) => {
        const part = byId.get(item.partId);
        return part ? [{ ...item, part }] : [];
      })
      .sort(
        (a, b) =>
          CATEGORY_SLUGS.indexOf(a.part.categorySlug) - CATEGORY_SLUGS.indexOf(b.part.categorySlug),
      ),
  };
}

export type BuildWithItems = NonNullable<Awaited<ReturnType<typeof getBuildWithItems>>>;

export { canViewBuild } from '@/lib/builder/permissions';
