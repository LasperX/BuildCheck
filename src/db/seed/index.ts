import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { brands, categories } from '../schema';

// ข้อมูลตั้งต้น: 8 หมวดอะไหล่ และรายชื่อยี่ห้อ ไม่มีข้อมูลสเปกอะไหล่ในไฟล์นี้
// รันซ้ำได้โดยไม่เกิดข้อมูลซ้ำ เพราะใช้ onConflictDoNothing กับคอลัมน์ที่ห้ามซ้ำ

// required ตามที่สรุปใน docs/spec-review.md ส่วน C:
// การ์ดจอและระบายความร้อนไม่บังคับ เพราะ CPU บางรุ่นมีกราฟิกในตัวหรือมีพัดลมแถม (ดูแลโดย R18 และข้อความระดับข้อมูล)
const CATEGORIES = [
  {
    slug: 'cpu',
    nameTh: 'CPU',
    nameEn: 'CPU',
    icon: 'cpu',
    sortOrder: 1,
    required: true,
    allowMultiple: false,
  },
  {
    slug: 'motherboard',
    nameTh: 'เมนบอร์ด',
    nameEn: 'Motherboard',
    icon: 'circuit-board',
    sortOrder: 2,
    required: true,
    allowMultiple: false,
  },
  {
    slug: 'ram',
    nameTh: 'แรม',
    nameEn: 'Memory',
    icon: 'memory-stick',
    sortOrder: 3,
    required: true,
    allowMultiple: true,
  },
  {
    slug: 'gpu',
    nameTh: 'การ์ดจอ',
    nameEn: 'Graphics Card',
    icon: 'gpu',
    sortOrder: 4,
    required: false,
    allowMultiple: false,
  },
  {
    slug: 'storage',
    nameTh: 'อุปกรณ์เก็บข้อมูล',
    nameEn: 'Storage',
    icon: 'hard-drive',
    sortOrder: 5,
    required: true,
    allowMultiple: true,
  },
  {
    slug: 'psu',
    nameTh: 'PSU',
    nameEn: 'Power Supply',
    icon: 'plug-zap',
    sortOrder: 6,
    required: true,
    allowMultiple: false,
  },
  {
    slug: 'case',
    nameTh: 'เคส',
    nameEn: 'Case',
    icon: 'pc-case',
    sortOrder: 7,
    required: true,
    allowMultiple: false,
  },
  {
    slug: 'cooler',
    nameTh: 'ชุดระบายความร้อน',
    nameEn: 'CPU Cooler',
    icon: 'fan',
    sortOrder: 8,
    required: false,
    allowMultiple: false,
  },
] satisfies (typeof categories.$inferInsert)[];

// ชื่อยี่ห้อที่พบบ่อย แอดมินเพิ่มหรือลบได้ในหลังบ้าน ยังไม่ผูกกับหมวดใด เพราะตาราง brands ไม่มีคอลัมน์หมวด
const BRANDS = [
  'ยี่ห้อตัวอย่าง', // ใช้กับ CSV ตัวอย่างที่ยังรอตรวจสอบ ลบได้เมื่อมีข้อมูลจริง
  'AMD',
  'Intel',
  'NVIDIA',
  'ASUS',
  'MSI',
  'Gigabyte',
  'ASRock',
  'Biostar',
  'Sapphire',
  'PowerColor',
  'Zotac',
  'Palit',
  'Galax',
  'Inno3D',
  'PNY',
  'Corsair',
  'Kingston',
  'G.Skill',
  'TeamGroup',
  'ADATA',
  'Crucial',
  'Samsung',
  'Western Digital',
  'Seagate',
  'Lexar',
  'Seasonic',
  'Cooler Master',
  'Thermaltake',
  'be quiet!',
  'FSP',
  'Antec',
  'NZXT',
  'Lian Li',
  'Fractal Design',
  'Montech',
  'DeepCool',
  'Noctua',
  'ARCTIC',
  'ID-COOLING',
  'Thermalright',
].map((name) => ({ name }));

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('ไม่พบ DATABASE_URL ใน .env');

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);
  try {
    const c = await db.insert(categories).values(CATEGORIES).onConflictDoNothing().returning();
    const b = await db.insert(brands).values(BRANDS).onConflictDoNothing().returning();
    console.log(`เพิ่มหมวดใหม่ ${c.length} รายการ และยี่ห้อใหม่ ${b.length} รายการ`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
