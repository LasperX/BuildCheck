import 'server-only';

import { readFile } from 'node:fs/promises';
import { join, normalize, sep } from 'node:path';

import sharp from 'sharp';

// รูปอะไหล่สำหรับรูปสรุปสเปก (ImageResponse): ดึงรูปแล้วย่อเป็น PNG สี่เหลี่ยมพื้นขาว ส่งเป็น data URI
// - รูปอะไหล่เก็บเป็น WebP ขนาด 800 px ซึ่งตัวสร้างรูปอ่านได้ไม่แน่นอนและทำให้ช้า จึงย่อเป็น PNG เล็กก่อน
// - ดึงเฉพาะไฟล์ในเว็บเอง (/uploads ตอนพัฒนา) และที่เก็บรูปของเรา ลิงก์อื่นไม่ดึง กันเซิร์ฟเวอร์ถูกใช้ไปเรียกที่อื่น
// - ไม่มีรูป ดึงไม่ได้ หรือช้าเกินไป คืน null ให้รูปสรุปแสดงป้ายยี่ห้อแทน รูปสรุปต้องสร้างได้เสมอ

/** ด้านละกี่ px (2 เท่าของขนาดที่แสดงในรูปสรุป ให้คมเมื่อซูม) */
const SIZE = 144;
const TIMEOUT_MS = 3000;
const CACHE_LIMIT = 300;
const PUBLIC_DIR = join(process.cwd(), 'public');

export type ThumbnailSource = { kind: 'file'; path: string } | { kind: 'url'; url: string };

/** ต้นทางของที่เก็บรูปของเรา (ตั้งตอน build จาก STORAGE_PUBLIC_URL) */
function storageOrigin(): string | null {
  if (process.env.NEXT_PUBLIC_STORAGE_ORIGIN) return process.env.NEXT_PUBLIC_STORAGE_ORIGIN;
  try {
    return process.env.STORAGE_PUBLIC_URL ? new URL(process.env.STORAGE_PUBLIC_URL).origin : null;
  } catch {
    return null;
  }
}

/**
 * ลิงก์รูปนี้ให้เซิร์ฟเวอร์ดึงได้ไหม และดึงจากไหน
 * - "/uploads/..." อ่านไฟล์ในโฟลเดอร์ public ตรงๆ (ห้ามออกนอกโฟลเดอร์ด้วย ../)
 * - ลิงก์ที่ขึ้นต้นด้วยที่เก็บรูปของเรา ดึงผ่านเน็ต
 * - อย่างอื่นไม่ดึง
 */
export function thumbnailSource(
  imageUrl: string | null,
  storage: string | null,
): ThumbnailSource | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('/') && !imageUrl.startsWith('//')) {
    try {
      const pathname = decodeURIComponent(imageUrl.split(/[?#]/)[0] ?? '');
      const path = normalize(join(PUBLIC_DIR, pathname));
      return path.startsWith(PUBLIC_DIR + sep) ? { kind: 'file', path } : null;
    } catch {
      return null;
    }
  }
  if (storage && imageUrl.startsWith(`${storage}/`)) return { kind: 'url', url: imageUrl };
  return null;
}

async function readSource(source: ThumbnailSource): Promise<Buffer> {
  if (source.kind === 'file') return readFile(source.path);
  const response = await fetch(source.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// จำรูปที่ย่อแล้วไว้ (ชื่อไฟล์รูปที่อัปโหลดสุ่มใหม่ทุกครั้ง ลิงก์เดิมจึงได้รูปเดิมเสมอ) ดึงไม่สำเร็จไม่จำ
const cache = new Map<string, Promise<string | null>>();

/** รูปย่อ PNG พื้นขาวเป็น data URI สำหรับ ImageResponse หรือ null ถ้าไม่มีรูปหรือดึงไม่ได้ */
export function partThumbnail(imageUrl: string | null): Promise<string | null> {
  const source = thumbnailSource(imageUrl, storageOrigin());
  if (!imageUrl || !source) return Promise.resolve(null);
  const hit = cache.get(imageUrl);
  if (hit) return hit;

  const task = readSource(source)
    .then((data) =>
      sharp(data)
        .resize(SIZE, SIZE, { fit: 'contain', background: '#ffffff' })
        .flatten({ background: '#ffffff' })
        .png()
        .toBuffer(),
    )
    .then((png) => `data:image/png;base64,${png.toString('base64')}`)
    .catch(() => {
      cache.delete(imageUrl);
      return null;
    });
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(imageUrl, task);
  return task;
}
