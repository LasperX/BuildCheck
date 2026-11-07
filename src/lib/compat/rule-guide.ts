import type { CategorySlug } from '@/lib/parts/spec-fields';

import type { Level, RuleCode } from './types';

// คำอธิบายกฎตรวจสำหรับหน้าคู่มือ /guide ข้อความตามตารางในหัวข้อ 4.1 และ 4.6 ของเอกสารสเปก

export type RuleGuide = {
  code: RuleCode;
  check: string;
  problem: string;
  level: Level | 'error-warning';
};

export const RULE_GUIDE: RuleGuide[] = [
  {
    code: 'R01',
    check: 'CPU ↔ เมนบอร์ด',
    problem: 'Socket ของ CPU ไม่ตรงกับเมนบอร์ด',
    level: 'error',
  },
  {
    code: 'R02',
    check: 'CPU ↔ ชิปเซ็ต',
    problem: 'รุ่น CPU ไม่อยู่ในรายการรุ่นที่ชิปเซ็ตรองรับ',
    level: 'error',
  },
  {
    code: 'R03',
    check: 'CPU ↔ BIOS',
    problem: 'ชิปเซ็ตรองรับ แต่ต้องอัปเดต BIOS ก่อน',
    level: 'warning',
  },
  {
    code: 'R04',
    check: 'ชนิดแรม',
    problem: 'ชนิดแรม (DDR4/DDR5) ไม่ตรงกับเมนบอร์ด',
    level: 'error',
  },
  {
    code: 'R05',
    check: 'จำนวนแถวแรม',
    problem: 'แถวแรมรวมมากกว่าช่องแรมบนเมนบอร์ด',
    level: 'error',
  },
  { code: 'R06', check: 'ความจุแรม', problem: 'ความจุรวมเกินที่เมนบอร์ดรองรับ', level: 'error' },
  {
    code: 'R07',
    check: 'ความเร็วแรม',
    problem: 'แรมเร็วกว่าที่เมนบอร์ดรองรับ จะวิ่งช้าลง',
    level: 'warning',
  },
  {
    code: 'R08',
    check: 'เมนบอร์ด ↔ เคส',
    problem: 'ขนาดเมนบอร์ดไม่อยู่ในรายการที่เคสรองรับ',
    level: 'error',
  },
  { code: 'R09', check: 'การ์ดจอ ↔ เคส', problem: 'การ์ดจอยาวกว่าที่เคสใส่ได้', level: 'error' },
  { code: 'R10', check: 'ซิงก์ลม ↔ เคส', problem: 'ซิงก์ลมสูงกว่าที่เคสใส่ได้', level: 'error' },
  {
    code: 'R11',
    check: 'ชุดน้ำ ↔ เคส',
    problem: 'ขนาดหม้อน้ำไม่อยู่ในรายการที่เคสรองรับ',
    level: 'error',
  },
  {
    code: 'R12',
    check: 'ชุดระบายความร้อน ↔ Socket',
    problem: 'ชุดระบายความร้อนไม่รองรับ Socket ของ CPU',
    level: 'error',
  },
  {
    code: 'R13',
    check: 'ระบายความร้อนพอไหม',
    problem: 'ชุดระบายความร้อนรับ TDP ได้น้อยกว่า CPU',
    level: 'warning',
  },
  {
    code: 'R14',
    check: 'กำลังไฟ PSU',
    problem: 'PSU ต่ำกว่าวัตต์ที่ใช้จริง (ผิดพลาด) หรือเผื่อไม่ถึงค่าที่ตั้งไว้ (เตือน)',
    level: 'error-warning',
  },
  { code: 'R15', check: 'PSU ↔ เคส', problem: 'ขนาด PSU (ATX/SFX) เคสไม่รองรับ', level: 'error' },
  {
    code: 'R16',
    check: 'สายไฟการ์ดจอ',
    problem: 'หัวต่อไฟที่ PSU มีไม่พอกับที่การ์ดจอต้องการ',
    level: 'warning',
  },
  {
    code: 'R17',
    check: 'ช่อง M.2 / SATA',
    problem: 'SSD M.2 หรือไดรฟ์ SATA มากกว่าช่องบนเมนบอร์ด',
    level: 'error',
  },
  {
    code: 'R18',
    check: 'ไม่มีภาพออกจอ',
    problem: 'CPU ไม่มีกราฟิกในตัว และยังไม่ได้เลือกการ์ดจอ',
    level: 'error',
  },
  {
    code: 'U01',
    check: 'การ์ดจอมือสอง',
    problem: 'ขอดูรันทดสอบ ถามประวัติขุดเหรียญ ดูอุณหภูมิ',
    level: 'warning',
  },
  {
    code: 'U02',
    check: 'PSU มือสอง',
    problem: 'PSU เสียอาจพาอะไหล่อื่นเสียด้วย อายุเกิน 5 ปีเตือนหนักขึ้น',
    level: 'warning',
  },
  {
    code: 'U03',
    check: 'เก็บข้อมูลมือสอง',
    problem: 'ตรวจค่า Health ไม่ต่ำกว่า 90% ก่อนซื้อ',
    level: 'warning',
  },
  { code: 'U04', check: 'ไม่มีประกันเหลือ', problem: 'ถ้าเสียต้องซ่อมเองทั้งหมด', level: 'info' },
  {
    code: 'U05',
    check: 'แพลตฟอร์มเก่า',
    problem: 'Socket อยู่ในรายการเลิกผลิต อัปเกรด CPU ต่อได้จำกัด',
    level: 'info',
  },
  {
    code: 'U06',
    check: 'ราคาถูกผิดปกติ',
    problem: 'ราคาที่ผู้ขายเสนอต่ำกว่า 60% ของราคากลาง',
    level: 'warning',
  },
];

export const CATEGORY_GUIDE: Record<CategorySlug, string> = {
  cpu: 'สมองของเครื่อง ดู Socket ให้ตรงกับเมนบอร์ด และ TDP (ความร้อนที่ปล่อยออกมา) เพื่อเลือกชุดระบายความร้อน รุ่นที่ไม่มีกราฟิกในตัวต้องมีการ์ดจอ',
  motherboard:
    'แผงที่ทุกชิ้นเสียบลงไป ต้องมี Socket ตรงกับ CPU รองรับชนิดแรม (DDR4/DDR5) และมีขนาด (ATX, mATX, ITX) ที่เคสใส่ได้',
  ram: 'หน่วยความจำขณะทำงาน ชนิดต้องตรงกับเมนบอร์ด แนะนำใส่ 2 แถวเพื่อ Dual Channel เล่นเกมควรมี 16 GB ขึ้นไป',
  gpu: 'ประมวลผลภาพ สำคัญที่สุดสำหรับเล่นเกม ดูความยาวการ์ดว่าเคสใส่ได้ และวัตต์ (TBP) เพื่อเลือก PSU',
  storage:
    'เก็บไฟล์และระบบปฏิบัติการ SSD NVMe เร็วที่สุด เสียบช่อง M.2 ส่วน SATA SSD และ HDD ใช้พอร์ต SATA',
  psu: 'จ่ายไฟให้ทั้งเครื่อง วัตต์ต้องพอพร้อมค่าเผื่อ และมีหัวต่อไฟพอสำหรับการ์ดจอ',
  case: 'ตัวถังเครื่อง ต้องรองรับขนาดเมนบอร์ด ความยาวการ์ดจอ ความสูงซิงก์ลม และขนาด PSU',
  cooler: 'ระบายความร้อน CPU มีแบบซิงก์ลมและชุดน้ำ ต้องรองรับ Socket และรับ TDP ของ CPU ได้',
};
