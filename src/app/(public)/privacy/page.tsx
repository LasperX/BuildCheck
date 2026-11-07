import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'นโยบายความเป็นส่วนตัว · BuildCheck',
  description:
    'BuildCheck เก็บข้อมูลอะไร ใช้ทำอะไร และสิทธิ์ของคุณตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)',
};

// /privacy (หัวข้อ 9.1 ข้อมูลส่วนตัว) อธิบายตามสิ่งที่ระบบเก็บจริงในฐานข้อมูล (หัวข้อ 6)
// ถ้าเพิ่มการเก็บข้อมูลใหม่ ต้องแก้หน้านี้ด้วย

export default function PrivacyPage() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-6">
      <h1 className="t-h1">นโยบายความเป็นส่วนตัว</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
      </p>

      <section aria-labelledby="collect-title" className="mt-8">
        <h2 id="collect-title" className="mb-2 t-h2">
          ข้อมูลที่เก็บ
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            <b>บัญชี:</b> อีเมล ชื่อที่แสดง ชื่อผู้ใช้ รูปโปรไฟล์และคำแนะนำตัว (ถ้ากรอก)
            รหัสผ่านเก็บแบบแฮชที่อ่านย้อนกลับไม่ได้
          </li>
          <li>
            <b>ล็อกอินด้วย Google:</b> อีเมล ชื่อ และรูปโปรไฟล์จาก Google
          </li>
          <li>
            <b>สิ่งที่คุณสร้าง:</b> สเปก คอมเมนต์ โหวต รายการโปรด เตือนราคา รายงานราคามือสอง
            (รวมจังหวัดและรูปหลักฐานถ้าแนบ) และรายงานเนื้อหา
          </li>
          <li>
            <b>การใช้งาน:</b> Session สำหรับค้างการล็อกอิน (7 วัน) และตัวนับจำกัดความถี่ที่แฮช IP
            และอีเมลแล้ว ไม่เก็บแบบอ่านได้
          </li>
          <li>
            <b>ในเครื่องของคุณ:</b> สเปกที่กำลังจัด รายการเทียบสเปก และโหมดสว่าง/มืด เก็บใน
            localStorage ของเบราว์เซอร์ ไม่ส่งขึ้นเซิร์ฟเวอร์จนกว่าจะบันทึก
          </li>
        </ul>
      </section>

      <section aria-labelledby="use-title" className="mt-8">
        <h2 id="use-title" className="mb-2 t-h2">
          ใช้ข้อมูลทำอะไร
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>ให้บริการจัดสเปก บันทึก แชร์ และแจ้งเตือน</li>
          <li>ส่งอีเมลยืนยันบัญชีและรีเซ็ตรหัสผ่าน</li>
          <li>คำนวณราคากลางมือสองจากรายงานที่แอดมินอนุมัติ</li>
          <li>ป้องกันสแปมและการเดารหัสผ่าน</li>
          <li>สถิติรวมในหลังบ้าน (เช่นจำนวนสมาชิก อะไหล่ยอดนิยม) ไม่ระบุตัวบุคคล</li>
        </ul>
        <p className="mt-2">
          ไม่ขายหรือส่งข้อมูลให้บุคคลอื่นเพื่อการตลาด และไม่มีโฆษณาหรือตัวติดตามจากภายนอก
        </p>
      </section>

      <section aria-labelledby="public-title" className="mt-8">
        <h2 id="public-title" className="mb-2 t-h2">
          สิ่งที่คนอื่นเห็น
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>ชื่อที่แสดง ชื่อผู้ใช้ รูป คำแนะนำตัว สเปกที่ตั้งเป็นสาธารณะ และคอมเมนต์</li>
          <li>ไม่แสดงอีเมลบนหน้าสาธารณะ</li>
          <li>รายงานราคามือสองแสดงราคา เกรด ช่องทาง จังหวัด และวันที่ ไม่แสดงชื่อผู้รายงาน</li>
          <li>สเปกส่วนตัวเห็นได้เฉพาะคุณ สเปกแบบ “ทุกคนที่มีลิงก์” เห็นได้เฉพาะคนที่มีลิงก์</li>
        </ul>
      </section>

      <section aria-labelledby="rights-title" className="mt-8">
        <h2 id="rights-title" className="mb-2 t-h2">
          สิทธิ์ของคุณ
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            แก้ไขข้อมูลโปรไฟล์ได้ที่{' '}
            <Link href="/me/settings" className="text-link underline underline-offset-2">
              ตั้งค่าบัญชี
            </Link>
          </li>
          <li>ปิดการแจ้งเตือนแต่ละประเภทได้</li>
          <li>
            ลบบัญชีได้เอง ระบบลบสเปก คอมเมนต์ โหวต รายการโปรด และเตือนราคาของคุณ
            รายงานราคามือสองที่อนุมัติแล้วยังใช้คำนวณราคากลางต่อ แต่ไม่ผูกกับบัญชีของคุณอีก
          </li>
        </ul>
      </section>

      <section aria-labelledby="contact-title" className="mt-8">
        <h2 id="contact-title" className="mb-2 t-h2">
          ติดต่อเรื่องข้อมูลส่วนบุคคล
        </h2>
        <p>
          ดูช่องทางติดต่อผู้จัดทำได้ที่{' '}
          <Link href="/about#contact" className="text-link underline underline-offset-2">
            หน้าเกี่ยวกับ
          </Link>
        </p>
      </section>
    </main>
  );
}
