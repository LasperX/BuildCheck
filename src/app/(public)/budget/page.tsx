import type { Metadata } from 'next';

import { BudgetPlanner } from '@/components/builder/budget-planner';
import { getPartFacets } from '@/server/queries/parts';
import { getSystemConfig } from '@/server/queries/settings';

export const metadata: Metadata = {
  title: 'จัดสเปกตามงบ · BuildCheck',
  description:
    'ใส่งบและการใช้งาน ระบบเลือกชุดอะไหล่ที่เข้ากันได้ให้ 3 ตัวเลือก ประหยัด สมดุล คุ้มสุด',
};

export default async function BudgetPage() {
  // ทั้งสองค่าอยู่ในแคช หน้านี้จึงสร้างล่วงหน้าได้ ไม่ต้องรอฐานข้อมูลทุกครั้ง
  const [facets, config] = await Promise.all([getPartFacets('cpu'), getSystemConfig()]);
  return (
    <main className="container mx-auto px-4 py-6">
      <h1 className="t-h1">จัดสเปกตามงบ</h1>
      <p className="mt-1 text-muted-foreground">
        บอกงบและการใช้งาน ระบบจะแบ่งงบแล้วเลือกชุดที่เข้ากันได้ให้ 3 ตัวเลือก
      </p>
      <BudgetPlanner
        cpuBrands={facets.brands.map((brand) => brand.name)}
        ratios={config.budgetRatios}
      />
    </main>
  );
}
