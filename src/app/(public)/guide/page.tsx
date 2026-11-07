import type { Metadata } from 'next';
import Link from 'next/link';

import { LEVEL_UI } from '@/components/builder/levels';
import { Badge } from '@/components/ui/badge';
import { CATEGORY_GUIDE, RULE_GUIDE } from '@/lib/compat/rule-guide';
import { CATEGORY_LABELS, CATEGORY_SLUGS } from '@/lib/parts/spec-fields';

export const metadata: Metadata = {
  title: 'คู่มือ · BuildCheck',
  description: 'อธิบายอะไหล่คอมแต่ละหมวด ความหมายของกฎตรวจความเข้ากันได้ และวิธีอ่านเกจกำลังไฟ',
};

// /guide (หัวข้อ 5.1) อธิบายแต่ละหมวดอะไหล่ ความหมายของกฎ และวิธีอ่านเกจไฟ สำหรับคนที่ไม่รู้เรื่องคอม

function LevelBadge({ level }: { level: (typeof RULE_GUIDE)[number]['level'] }) {
  if (level === 'error-warning') {
    return (
      <span className="flex flex-wrap gap-1">
        <LevelBadge level="error" />
        <LevelBadge level="warning" />
      </span>
    );
  }
  const ui = LEVEL_UI[level];
  const Icon = ui.icon;
  return (
    <Badge variant={ui.badge}>
      <Icon aria-hidden />
      {ui.label}
    </Badge>
  );
}

export default function GuidePage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-6">
      <h1 className="t-h1">คู่มือการใช้งาน</h1>
      <p className="mt-1 text-muted-foreground">
        ไม่ต้องรู้เรื่องคอมมาก่อน อ่านหน้านี้แล้วเริ่ม{' '}
        <Link href="/builder" className="text-link underline underline-offset-2">
          จัดสเปก
        </Link>{' '}
        ได้เลย
      </p>

      <nav aria-label="สารบัญ" className="mt-4 flex flex-wrap gap-3 text-sm">
        <a href="#categories" className="text-link underline underline-offset-2">
          อะไหล่ 8 หมวด
        </a>
        <a href="#levels" className="text-link underline underline-offset-2">
          ระดับของผลตรวจ
        </a>
        <a href="#rules" className="text-link underline underline-offset-2">
          กฎตรวจทั้งหมด
        </a>
        <a href="#gauge" className="text-link underline underline-offset-2">
          วิธีอ่านเกจกำลังไฟ
        </a>
        <a href="#used" className="text-link underline underline-offset-2">
          ซื้อมือสอง
        </a>
      </nav>

      <section id="categories" aria-labelledby="categories-title" className="mt-8 scroll-mt-20">
        <h2 id="categories-title" className="mb-3 t-h2">
          อะไหล่ 8 หมวด
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {CATEGORY_SLUGS.map((slug) => (
            <div key={slug} className="rounded-xl border border-border bg-card p-4">
              <dt className="font-semibold">
                <Link href={`/parts/${slug}`} className="hover:underline">
                  {CATEGORY_LABELS[slug]}
                </Link>
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground">{CATEGORY_GUIDE[slug]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="levels" aria-labelledby="levels-title" className="mt-8 scroll-mt-20">
        <h2 id="levels-title" className="mb-3 t-h2">
          ระดับของผลตรวจ
        </h2>
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex items-start gap-2">
            <LevelBadge level="error" /> ประกอบไม่ได้หรือเปิดไม่ติด ต้องแก้ก่อนซื้อ
            สถานะรวมเป็นสีแดง
          </li>
          <li className="flex items-start gap-2">
            <LevelBadge level="warning" /> ใช้ได้ แต่เสียประสิทธิภาพหรือมีความเสี่ยง
            สถานะรวมเป็นสีเหลือง
          </li>
          <li className="flex items-start gap-2">
            <LevelBadge level="info" /> คำแนะนำทั่วไป ไม่นับในสถานะรวม
          </li>
        </ul>
        <p className="mt-2 text-sm text-muted-foreground">
          ทุกสถานะมีไอคอนกำกับเสมอ ไม่ได้ใช้สีอย่างเดียวบอกความหมาย
        </p>
      </section>

      <section id="rules" aria-labelledby="rules-title" className="mt-8 scroll-mt-20">
        <h2 id="rules-title" className="mb-3 t-h2">
          กฎตรวจทั้งหมด
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          R01–R18 คือกฎความเข้ากันได้ ส่วน U01–U06 ใช้เฉพาะชิ้นที่เลือกเป็นมือสอง
        </p>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="p-3 text-left font-normal">
                  รหัส
                </th>
                <th scope="col" className="p-3 text-left font-normal">
                  ตรวจอะไร
                </th>
                <th scope="col" className="p-3 text-left font-normal">
                  มีปัญหาเมื่อ
                </th>
                <th scope="col" className="p-3 text-left font-normal">
                  ระดับ
                </th>
              </tr>
            </thead>
            <tbody>
              {RULE_GUIDE.map((rule) => (
                <tr key={rule.code} className="border-b border-border last:border-0">
                  <td className="p-3 font-mono font-semibold">{rule.code}</td>
                  <td className="p-3">{rule.check}</td>
                  <td className="p-3 text-muted-foreground">{rule.problem}</td>
                  <td className="p-3">
                    <LevelBadge level={rule.level} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="gauge" aria-labelledby="gauge-title" className="mt-8 scroll-mt-20">
        <h2 id="gauge-title" className="mb-3 t-h2">
          วิธีอ่านเกจกำลังไฟ
        </h2>
        <div className="flex flex-col gap-2 text-sm">
          <p>
            ตัวเลขกลางเกจคือวัตต์ที่เครื่องใช้โดยประมาณ (รวม CPU การ์ดจอ เมนบอร์ด แรม
            และอุปกรณ์เก็บข้อมูล) ส่วนแถบคือสัดส่วนเทียบกับวัตต์ของ PSU ที่เลือก
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>
              <b className="text-ok-fg">เขียว</b> ไฟพอและเผื่อไว้ตามค่าที่ระบบตั้ง (ค่าตั้งต้น 30%)
              เผื่อไว้เพราะไฟกระชากตอนเล่นเกมหนักและ PSU เสื่อมตามอายุ
            </li>
            <li>
              <b className="text-warn-fg">เหลือง</b> ไฟพอแต่เผื่อไม่ถึง ควรเลือก PSU
              วัตต์สูงขึ้นตามตัวเลขที่แนะนำ
            </li>
            <li>
              <b className="text-err-fg">แดง</b> PSU วัตต์ต่ำกว่าที่เครื่องใช้
              เครื่องอาจดับหรือเปิดไม่ติด
            </li>
          </ul>
        </div>
      </section>

      <section id="used" aria-labelledby="used-title" className="mt-8 scroll-mt-20">
        <h2 id="used-title" className="mb-3 t-h2">
          ซื้ออะไหล่มือสอง
        </h2>
        <p className="text-sm">
          ทุกช่องในหน้าจัดสเปกสลับเป็นมือสองได้ ระบบแสดงราคากลางพร้อมบอกว่ามาจากรายงานของสมาชิก
          การสำรวจของแอดมิน หรือสูตรประมาณการ กรอกราคาที่ผู้ขายเสนอแล้วระบบบอกว่าถูก สมเหตุสมผล
          หรือแพงกว่าตลาด ดูราคาได้ที่{' '}
          <Link href="/used" className="text-link underline underline-offset-2">
            ตลาดมือสอง
          </Link>
        </p>
      </section>
    </main>
  );
}
