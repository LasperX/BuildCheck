// รวมไดอะแกรม Mermaid ทุกไฟล์ใน docs/diagrams เป็น docs/diagrams.md (GitHub แสดงเป็นรูปให้อัตโนมัติ)
// วิธีใช้: pnpm docs:diagrams (รัน pnpm docs:er ก่อนเพื่อสร้าง ER Diagram จาก Schema ล่าสุด)

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'docs', 'diagrams');

const SECTIONS: { file: string; title: string; note: string }[] = [
  {
    file: 'use-case.mmd',
    title: 'Use Case Diagram',
    note: 'ผู้ใช้ 3 ระดับและสิ่งที่ทำได้ ตามตารางสิทธิ์หัวข้อ 2.4',
  },
  {
    file: 'sitemap.mmd',
    title: 'ผังเว็บไซต์',
    note: 'ทุกหน้าในหัวข้อ 5.1, 5.2 และ 5.4 สีบอกสิทธิ์การเข้าถึง',
  },
  {
    file: 'architecture.mmd',
    title: 'สถาปัตยกรรมระบบ',
    note: 'ส่วนประกอบและการเชื่อมต่อตามหัวข้อ 7',
  },
  {
    file: 'er-overview.mmd',
    title: 'ER Diagram ภาพรวม 30 ตาราง',
    note: 'สร้างจาก Schema ของ Drizzle อัตโนมัติ แสดงเฉพาะ PK และ FK',
  },
  { file: 'er-users.mmd', title: 'ER Diagram กลุ่มผู้ใช้', note: 'หัวข้อ 6.1' },
  {
    file: 'er-parts.mmd',
    title: 'ER Diagram กลุ่มอะไหล่และสเปก',
    note: 'หัวข้อ 6.2–6.3 ตารางสเปกแต่ละหมวดสัมพันธ์ 1:1 กับ parts',
  },
  { file: 'er-builds.mmd', title: 'ER Diagram กลุ่มสเปกและชุมชน', note: 'หัวข้อ 6.4' },
  { file: 'er-system.mmd', title: 'ER Diagram กลุ่มระบบ', note: 'หัวข้อ 6.5' },
  { file: 'er-used.mmd', title: 'ER Diagram กลุ่มมือสอง', note: 'หัวข้อ 6.8' },
  {
    file: 'flow-check.mmd',
    title: 'Flowchart การตรวจความเข้ากันได้',
    note: 'checkBuild() หัวข้อ 4.2',
  },
  { file: 'flow-budget.mmd', title: 'Flowchart อัลกอริทึมจัดสเปกตามงบ', note: 'หัวข้อ 4.5' },
  { file: 'flow-used-price.mmd', title: 'Flowchart เลือกแหล่งราคากลางมือสอง', note: 'หัวข้อ 4.6' },
  {
    file: 'seq-save.mmd',
    title: 'Sequence Diagram เลือกอะไหล่และบันทึกอัตโนมัติ',
    note: 'หัวข้อ 8.1',
  },
  { file: 'seq-notify.mmd', title: 'Sequence Diagram แจ้งเตือนแบบสด', note: 'SSE หัวข้อ 3.8' },
];

const body = SECTIONS.map(({ file, title, note }) => {
  const code = readFileSync(path.join(dir, file), 'utf8').trim();
  return `## ${title}\n\n${note} · ไฟล์ต้นฉบับ \`docs/diagrams/${file}\`\n\n\`\`\`mermaid\n${code}\n\`\`\``;
});

const out = `# ไดอะแกรมสำหรับรูปเล่ม (บทที่ 3)

ไฟล์นี้สร้างด้วย \`pnpm docs:diagrams\` อย่าแก้ไฟล์นี้โดยตรง ให้แก้ไฟล์ \`.mmd\` ใน \`docs/diagrams\` แล้วรันใหม่

**นำไปใส่รูปเล่ม:** เปิดไฟล์นี้บน GitHub (แสดงเป็นรูปให้เอง) หรือคัดลอกโค้ดของแต่ละไดอะแกรมไปวางที่ <https://mermaid.live> แล้วกด Export เป็น PNG หรือ SVG

${body.join('\n\n')}
`;

writeFileSync(path.join(process.cwd(), 'docs', 'diagrams.md'), out);
console.log(`เขียน docs/diagrams.md (${SECTIONS.length} ไดอะแกรม)`);
