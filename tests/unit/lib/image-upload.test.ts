import { describe, expect, it } from 'vitest';

import { type Encode, fitWithin, MAX_UPLOAD_BYTES, prepareImage } from '@/lib/image-upload';

// ย่อรูปก่อนอัปโหลด: ลำดับการลองคุณภาพและขนาด (ส่วนที่ใช้ canvas จริงทดสอบใน E2E บน Chrome)
// ตัวเข้ารหัสจำลองให้ขนาดไฟล์ = กว้าง × สูง × คุณภาพ × bytesPerPixel และบันทึกทุกครั้งที่ถูกเรียก
// fitWithin ดูแค่ขนาดไฟล์ จึงคืนค่าที่มีแต่ size ไม่ต้องจองหน่วยความจำจริง

function fakeEncoder(bytesPerPixel: number) {
  const calls: { width: number; height: number; quality: number }[] = [];
  const encode: Encode = async (width, height, quality) => {
    calls.push({ width, height, quality });
    return { size: Math.round(width * height * quality * bytesPerPixel) } as Blob;
  };
  return { encode, calls };
}

describe('fitWithin', () => {
  it('รูปที่ย่อเหลือด้านยาว 2,400 px แล้วไม่เกินขีดจำกัด ใช้คุณภาพสูงสุดครั้งแรกเลย', async () => {
    const { encode, calls } = fakeEncoder(0.2);
    const blob = await fitWithin({ width: 6000, height: 4000 }, MAX_UPLOAD_BYTES, encode);
    expect(calls).toEqual([{ width: 2400, height: 1600, quality: 0.86 }]);
    expect(blob!.size).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
  });

  it('ลดคุณภาพทีละขั้นก่อน ไม่พอจึงลดขนาดภาพลงทีละ 20% จนไม่เกินขีดจำกัด', async () => {
    const { encode, calls } = fakeEncoder(1);
    const blob = await fitWithin({ width: 4000, height: 3000 }, MAX_UPLOAD_BYTES, encode);
    expect(blob!.size).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
    // ขนาดแรกลองครบ 4 ระดับคุณภาพก่อน แล้วจึงย่อ 2400 → 1920 → ...
    expect(calls.slice(0, 4).map((call) => call.quality)).toEqual([0.86, 0.78, 0.7, 0.6]);
    expect(calls[0]).toMatchObject({ width: 2400, height: 1800 });
    expect(calls[4]).toMatchObject({ width: 1920, height: 1440, quality: 0.86 });
    // ทุกครั้งก่อนหน้าครั้งสุดท้ายเกินขีดจำกัด
    const last = calls.at(-1)!;
    expect(last.width * last.height * last.quality).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
  });

  it('รูปเล็กกว่า 2,400 px ไม่ขยาย', async () => {
    const { encode, calls } = fakeEncoder(0.1);
    await fitWithin({ width: 800, height: 1200 }, MAX_UPLOAD_BYTES, encode);
    expect(calls[0]).toMatchObject({ width: 800, height: 1200 });
  });

  it('ย่อจนด้านยาวต่ำกว่า 320 px แล้วยังเกิน คืน null ไม่วนไม่จบ', async () => {
    const { encode, calls } = fakeEncoder(1e6);
    expect(await fitWithin({ width: 4000, height: 3000 }, MAX_UPLOAD_BYTES, encode)).toBeNull();
    expect(Math.max(...calls.map((call) => call.width))).toBe(2400);
    expect(Math.min(...calls.map((call) => call.width))).toBeGreaterThanOrEqual(320);
  });
});

describe('prepareImage', () => {
  it('รูป JPG/PNG/WebP ที่ไม่เกิน 2 MB ส่งตามเดิม ไม่แปลง', async () => {
    const file = new File([new Uint8Array(1000)], 'a.png', { type: 'image/png' });
    expect(await prepareImage(file)).toEqual({ ok: true, file });
  });

  it('ไฟล์ที่ไม่ใช่รูป และรูปใหญ่เกิน 40 MB ไม่รับ', async () => {
    const text = new File(['x'], 'a.txt', { type: 'text/plain' });
    expect(await prepareImage(text)).toEqual({ ok: false, error: 'รับเฉพาะไฟล์รูป' });
    const huge = new File([new Uint8Array(41 * 1024 * 1024)], 'a.jpg', { type: 'image/jpeg' });
    expect((await prepareImage(huge)).ok).toBe(false);
  });
});
