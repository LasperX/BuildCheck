import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { PRODUCT_IMAGE_SIZE, toProductImage } = await import('@/lib/product-image');

/** สร้างรูปทดสอบ: พื้นสีหนึ่ง มีกล่องสีน้ำเงินอยู่ตรงกลาง */
async function makeImage(opts: {
  width: number;
  height: number;
  box: { width: number; height: number };
  transparent?: boolean;
}) {
  const box = await sharp({
    create: { width: opts.box.width, height: opts.box.height, channels: 3, background: '#1d4ed8' },
  })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: opts.width,
      height: opts.height,
      channels: 4,
      background: opts.transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : '#ffffff',
    },
  })
    .composite([{ input: box, gravity: 'center' }])
    .png()
    .toBuffer();
}

/** สัดส่วนของกล่องสีน้ำเงินในรูปผลลัพธ์ (ตามแนวกว้างที่สุด) */
async function boxShare(image: Buffer) {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let min = info.width;
  let max = -1;
  const row = Math.floor(info.height / 2);
  for (let x = 0; x < info.width; x++) {
    const i = (row * info.width + x) * 4;
    const blue = (data[i + 2] ?? 0) > 150 && (data[i] ?? 255) < 100 && (data[i + 3] ?? 0) > 200;
    if (blue) {
      min = Math.min(min, x);
      max = Math.max(max, x);
    }
  }
  return (max - min + 1) / info.width;
}

describe('toProductImage', () => {
  it('รูปแนวนอนที่มีขอบขาวเยอะ ได้รูปสี่เหลี่ยมจัตุรัส WebP และสินค้าเต็มกรอบ', async () => {
    const input = await makeImage({ width: 1600, height: 900, box: { width: 400, height: 400 } });
    const output = await toProductImage(input);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(meta.height);
    // เดิมกล่องกว้างแค่ 25% ของรูป ตัดขอบแล้วต้องกว้างราว 90%
    expect(await boxShare(output)).toBeGreaterThan(0.85);
  });

  it('รูปแนวตั้งก็ได้สี่เหลี่ยมจัตุรัส ขนาดไม่เกินที่กำหนด', async () => {
    const input = await makeImage({ width: 900, height: 2000, box: { width: 600, height: 1800 } });
    const meta = await sharp(await toProductImage(input)).metadata();
    expect(meta.width).toBe(meta.height);
    expect(meta.width).toBeLessThanOrEqual(PRODUCT_IMAGE_SIZE);
  });

  it('รูปพื้นโปร่งใสยังโปร่งใสอยู่ ไม่ถูกเติมพื้นขาว', async () => {
    const input = await makeImage({
      width: 1000,
      height: 1000,
      box: { width: 300, height: 500 },
      transparent: true,
    });
    const output = await toProductImage(input);
    const corner = await sharp(output)
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .ensureAlpha()
      .raw()
      .toBuffer();
    expect(corner[3]).toBe(0);
  });

  it('รูปเล็กไม่ถูกขยายจนแตก', async () => {
    const input = await makeImage({ width: 200, height: 200, box: { width: 120, height: 120 } });
    const meta = await sharp(await toProductImage(input)).metadata();
    expect(meta.width).toBeLessThan(200);
  });

  it('ไฟล์เสียโยน Error ให้ผู้เรียกแจ้งผู้ใช้', async () => {
    await expect(toProductImage(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).rejects.toThrow();
  });
});
