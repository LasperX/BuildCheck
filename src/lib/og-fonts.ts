import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ฟอนต์สำหรับรูปที่สร้างด้วย ImageResponse (รูปสรุปสเปก และรูปตอนแชร์ลิงก์)
// IBM Plex Sans Thai (สัญญาอนุญาต OFL) แยกไฟล์ภาษาไทยกับละติน ตั้งชื่อแยกกัน แล้วใช้ OG_FONT_FAMILY
// ให้ตัวอังกฤษใช้ฟอนต์ละตินน้ำหนักเดียวกันก่อน ถ้าใช้ชื่อเดียวกัน ตัวอังกฤษตัวหนาจะไปหยิบฟอนต์ตัวบางมาแทน
// ต้องรวมไฟล์ฟอนต์ตอน Deploy ด้วย outputFileTracingIncludes ใน next.config.ts

const FONT_DIR = join(process.cwd(), 'src/assets/fonts');
let fontCache: Promise<{ name: string; data: Buffer; weight: 400 | 700 }[]> | null = null;

export const OG_FONT_FAMILY = 'PlexLatin, PlexThai';

export function loadOgFonts() {
  fontCache ??= Promise.all(
    (['thai', 'latin'] as const).flatMap((subset) =>
      ([400, 700] as const).map(async (weight) => ({
        name: subset === 'thai' ? 'PlexThai' : 'PlexLatin',
        weight,
        data: await readFile(join(FONT_DIR, `ibm-plex-sans-thai-${subset}-${weight}-normal.woff`)),
      })),
    ),
  );
  return fontCache;
}
