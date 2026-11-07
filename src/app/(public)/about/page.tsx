import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'เกี่ยวกับ · BuildCheck',
  description:
    'BuildCheck เว็บจัดสเปกคอมพิวเตอร์พร้อมระบบตรวจสอบความเข้ากันได้ของอุปกรณ์ ภาษาไทย ไม่ขายสินค้า',
};

// /about (หัวข้อ 5.1) เกี่ยวกับโปรเจค เนื้อหาจากหัวข้อ 1 ของเอกสารสเปก
// ข้อมูลผู้จัดทำและช่องทางติดต่อเป็นข้อมูลจริงของผู้จัดทำ ยังไม่ได้กรอก แก้ที่ค่า CONTACT ด้านล่าง

/** รอกรอก: ชื่อผู้จัดทำ สถานศึกษา อาจารย์ที่ปรึกษา และช่องทางติดต่อ (เช่นอีเมลสำหรับโปรเจค) */
const CONTACT: { label: string; value: string }[] = [];

export default function AboutPage() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-6">
      <h1 className="t-h1">เกี่ยวกับ BuildCheck</h1>
      <p className="mt-1 text-muted-foreground">
        เว็บไซต์จัดสเปกคอมพิวเตอร์พร้อมระบบตรวจสอบความเข้ากันได้ของอุปกรณ์
        <span className="block text-sm">
          BuildCheck – PC Spec Builder with Compatibility Checking System
        </span>
      </p>

      <section aria-labelledby="why-title" className="mt-8">
        <h2 id="why-title" className="mb-2 t-h2">
          ทำไมถึงมีเว็บนี้
        </h2>
        <p>
          คนที่อยากประกอบคอมเองมักไม่รู้ว่าอะไหล่ตัวไหนใส่กันได้ เช่น ซื้อ CPU กับเมนบอร์ดคนละ
          Socket ซื้อแรม DDR5 มาใส่บอร์ด DDR4 หรือการ์ดจอยาวเกินเคส
          เว็บจัดสเปกส่วนใหญ่เป็นภาษาอังกฤษ หรือเป็นของร้านค้าที่ผูกกับการขาย BuildCheck
          จึงเป็นเครื่องมือกลางที่อธิบายเป็นภาษาไทยว่าทำไมถึงใส่ไม่ได้ และควรเปลี่ยนเป็นอะไร
        </p>
      </section>

      <section aria-labelledby="what-title" className="mt-8">
        <h2 id="what-title" className="mb-2 t-h2">
          ทำอะไรได้บ้าง
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>ตรวจความเข้ากันได้ 18 กฎ และกฎเฉพาะของมือสองอีก 6 กฎ ผลขึ้นทันทีที่เลือกอะไหล่</li>
          <li>คำนวณกำลังไฟรวมและแนะนำขนาด PSU</li>
          <li>จัดสเปกตามงบและประเภทการใช้งาน ได้ 3 ตัวเลือก</li>
          <li>จัดสเปกได้ทั้งของมือหนึ่ง มือสอง หรือผสมกัน พร้อมราคากลางมือสอง</li>
          <li>ชุมชนแชร์ โหวต คอมเมนต์ และ Fork สเปก</li>
        </ul>
      </section>

      <section aria-labelledby="not-title" className="mt-8">
        <h2 id="not-title" className="mb-2 t-h2">
          สิ่งที่เว็บนี้ไม่ทำ
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>ไม่ขายสินค้า ไม่มีระบบชำระเงิน และไม่เป็นตลาดซื้อขายมือสอง</li>
          <li>
            ไม่ดึงราคาหรือข้อมูลจากเว็บร้านค้า กลุ่ม Facebook หรือแอปซื้อขาย
            ข้อมูลอะไหล่แอดมินกรอกเอง ราคามือสองมาจากแอดมินสำรวจและสมาชิกรายงาน
          </li>
          <li>ไม่ใช้ AI ในการแนะนำ ใช้สูตรและเงื่อนไขที่เขียนเองทั้งหมด</li>
        </ul>
        <p className="mt-2 text-sm text-muted-foreground">
          ราคาบนเว็บเป็นราคาอ้างอิง ไม่ใช่ราคาขาย ควรตรวจสเปกกับผู้ผลิตก่อนซื้อจริงทุกครั้ง
        </p>
      </section>

      <section id="contact" aria-labelledby="contact-title" className="mt-8 scroll-mt-20">
        <h2 id="contact-title" className="mb-2 t-h2">
          ผู้จัดทำและติดต่อ
        </h2>
        <p>เว็บนี้เป็นโปรเจคจบระดับ ปวส. พัฒนาเพื่อการศึกษา</p>
        {CONTACT.length > 0 ? (
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
            {CONTACT.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            ข้อมูลผู้จัดทำและช่องทางติดต่อจะเพิ่มเร็ว ๆ นี้
          </p>
        )}
        <p className="mt-3 text-sm">
          พบข้อมูลสเปกอะไหล่ผิด แจ้งได้ด้วยปุ่มรายงานในหน้าสเปก หรืออ่าน{' '}
          <Link href="/privacy" className="text-link underline underline-offset-2">
            นโยบายความเป็นส่วนตัว
          </Link>
        </p>
      </section>
    </main>
  );
}
