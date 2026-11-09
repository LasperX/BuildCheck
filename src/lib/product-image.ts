import 'server-only';

import sharp from 'sharp';

// ปรับรูปอะไหล่ตอนอัปโหลด ให้ทุกรูปแสดงได้เท่ากันไม่ว่าต้นฉบับจะมีสัดส่วนหรือขอบแบบไหน
// 1. หมุนตามข้อมูล EXIF (รูปจากมือถือ)
// 2. ตัดขอบว่างรอบสินค้าออก (พื้นขาวหรือพื้นโปร่งใส) ตัวสินค้าจะเต็มกรอบขึ้น
// 3. วางกลางผืนสี่เหลี่ยมจัตุรัส เว้นขอบ 5% เติมด้วยสีพื้นเดิมของรูป รูปโปร่งใสยังโปร่งใสอยู่
// 4. ย่อไม่เกิน 800×800 และแปลงเป็น WebP ไฟล์เล็กลง โหลดเร็วขึ้น ไม่ขยายรูปเล็กจนแตก

export const PRODUCT_IMAGE_SIZE = 800;
const MARGIN = 0.05;
const TRIM_THRESHOLD = 18;

type Rgba = { r: number; g: number; b: number; alpha: number };

/** สีพื้นของรูป อ่านจากพิกเซลมุมซ้ายบน (รูปร้านค้าส่วนใหญ่พื้นขาว) */
async function backgroundOf(image: Buffer, hasAlpha: boolean): Promise<Rgba> {
  const pixel = await sharp(image)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const [r = 255, g = 255, b = 255, a = 255] = pixel;
  if (hasAlpha && a < 250) return { r: 255, g: 255, b: 255, alpha: 0 };
  return { r, g, b, alpha: 1 };
}

export async function toProductImage(bytes: Uint8Array): Promise<Buffer> {
  const upright = await sharp(bytes).rotate().toBuffer();
  const { hasAlpha = false } = await sharp(upright).metadata();
  const background = await backgroundOf(upright, hasAlpha);

  let trimmed = upright;
  try {
    trimmed = await sharp(upright).trim({ threshold: TRIM_THRESHOLD }).toBuffer();
  } catch {
    // รูปสีเดียวทั้งรูป ตัดไม่ได้ ใช้รูปเดิม
  }
  const { width = 1, height = 1 } = await sharp(trimmed).metadata();

  const inner = Math.min(Math.round(PRODUCT_IMAGE_SIZE * (1 - 2 * MARGIN)), Math.max(width, height));
  const pad = Math.round((inner * MARGIN) / (1 - 2 * MARGIN));

  return sharp(trimmed)
    .resize(inner, inner, { fit: 'contain', background })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background })
    .webp({ quality: 85, alphaQuality: 90 })
    .toBuffer();
}
