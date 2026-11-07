import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import {
  BudgetRatiosForm,
  EngineSettingsForm,
  WeightsForm,
} from '@/components/admin/admin-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { requireAdmin } from '@/lib/session';
import { getSystemConfig } from '@/server/queries/settings';

export const metadata: Metadata = { title: 'ตั้งค่าระบบ · BuildCheck' };

// /admin/settings (หัวข้อ 5.2) ค่าเผื่อกำลังไฟ วัตต์พื้นฐาน น้ำหนักคะแนน และสัดส่วนงบตามประเภทการใช้งาน
// ค่าเสื่อมมือสองอยู่ที่ /admin/used-prices

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-border bg-card p-4">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

async function SettingsContent() {
  await requireAdmin();
  const config = await getSystemConfig();
  return (
    <div className="flex flex-col gap-6">
      <Section
        id="power-title"
        title="กำลังไฟ"
        description="ใช้กับสูตรวัตต์ เกจกำลังไฟ และกฎ R14 (หัวข้อ 4.3)"
      >
        <EngineSettingsForm settings={config.engine} />
      </Section>
      <Section
        id="weights-title"
        title="น้ำหนักคะแนนประสิทธิภาพ"
        description="คะแนน = น้ำหนัก CPU × คะแนน CPU + น้ำหนักการ์ดจอ × คะแนนการ์ดจอ (หัวข้อ 4.4)"
      >
        <WeightsForm weights={config.engine.usageWeights} />
      </Section>
      <Section
        id="ratios-title"
        title="สัดส่วนงบตามประเภทการใช้งาน"
        description="จุดตั้งต้นของอัลกอริทึมจัดสเปกตามงบ (หัวข้อ 4.5)"
      >
        <BudgetRatiosForm ratios={config.budgetRatios} />
      </Section>
      <p className="text-sm text-muted-foreground">
        ค่าเสื่อมราคามือสอง ตัวคูณเกรด และ Socket ที่เลิกผลิต ตั้งที่{' '}
        <Link href="/admin/used-prices" className="text-link hover:underline">
          จัดการราคามือสอง
        </Link>
      </p>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <>
      <h1 className="mb-4 t-h1">ตั้งค่าระบบ</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}
