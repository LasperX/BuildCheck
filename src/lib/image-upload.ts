// ย่อและบีบอัดรูปในเบราว์เซอร์ก่อนส่งขึ้นเซิร์ฟเวอร์ ผู้ใช้เลือกรูปขนาดเท่าไรก็ได้ ไม่ต้องไปหารูปที่เล็กกว่า 2 MB เอง
// - เซิร์ฟเวอร์รับรูปไม่เกิน 2 MB (หัวข้อ 9.1) และ Vercel รับคำขอได้ไม่เกินราว 4.5 MB
//   รูปจากมือถือ 10–20 MB จึงส่งไปบีบอัดที่เซิร์ฟเวอร์ไม่ได้ ต้องย่อตั้งแต่ในเบราว์เซอร์
// - รูปที่ไม่เกิน 2 MB และเป็น JPG/PNG/WebP อยู่แล้ว ส่งตามเดิม ไม่แตะคุณภาพ
// - รูปที่ใหญ่เกิน หรือเป็นชนิดอื่นที่เบราว์เซอร์เปิดได้ (เช่น GIF, BMP, AVIF และ HEIC บน Safari)
//   แปลงเป็น WebP ซึ่งเก็บพื้นโปร่งใสได้ (เบราว์เซอร์ที่สร้าง WebP ไม่ได้ใช้ JPEG พื้นขาว)
//   ด้านยาวไม่เกิน 2,400 px ลดคุณภาพทีละขั้น ถ้ายังเกินจึงลดขนาดภาพลงทีละ 20%
// เซิร์ฟเวอร์ยังตรวจขนาดและชนิดไฟล์ซ้ำเสมอ ฟังก์ชันนี้ช่วยผู้ใช้ ไม่ใช่ด่านความปลอดภัย

/** ต้องเท่ากับ MAX_IMAGE_BYTES ใน lib/storage.ts */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
/** รูปต้นฉบับใหญ่สุดที่ยอมเปิด กันเบราว์เซอร์มือถือหน่วยความจำไม่พอ */
export const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const MAX_SIDE = 2400;
const MIN_SIDE = 320;
const QUALITIES = [0.86, 0.78, 0.7, 0.6] as const;
const READY_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** สร้างไฟล์รูปขนาด width × height ที่คุณภาพ quality (0–1) */
export type Encode = (width: number, height: number, quality: number) => Promise<Blob>;

/**
 * หาขนาดและคุณภาพที่ได้ไฟล์ไม่เกิน maxBytes: ลองคุณภาพจากสูงไปต่ำ ไม่พอจึงลดขนาดภาพลงทีละ 20%
 * คืน null ถ้าย่อจนด้านยาวเหลือต่ำกว่า 320 px แล้วยังเกิน
 * (แยกจากส่วนที่ใช้ canvas ให้ทดสอบลำดับการลองได้โดยไม่ต้องมีเบราว์เซอร์)
 */
export async function fitWithin(
  source: { width: number; height: number },
  maxBytes: number,
  encode: Encode,
  maxSide = MAX_SIDE,
): Promise<Blob | null> {
  const longest = Math.max(source.width, source.height);
  let scale = Math.min(1, maxSide / longest);
  for (;;) {
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    for (const quality of QUALITIES) {
      const blob = await encode(width, height, quality);
      if (blob.size <= maxBytes) return blob;
    }
    if (longest * scale * 0.8 < MIN_SIDE) return null;
    scale *= 0.8;
  }
}

type OutputType = 'image/webp' | 'image/jpeg';

function canvasEncoder(bitmap: ImageBitmap, type: OutputType): Encode {
  return async (width, height, quality) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas');
    // JPEG ไม่มีพื้นโปร่งใส ส่วนที่โปร่งใสจะกลายเป็นสีดำ จึงปูพื้นขาวก่อน
    if (type === 'image/jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
    }
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (!blob) throw new Error('encode');
    return blob;
  };
}

let webpSupport: Promise<boolean> | null = null;

/** เบราว์เซอร์นี้สร้างไฟล์ WebP จาก canvas ได้ไหม (Safari รุ่นเก่าคืน PNG แทน) */
function canEncodeWebp(): Promise<boolean> {
  webpSupport ??= new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    canvas.toBlob((blob) => resolve(blob?.type === 'image/webp'), 'image/webp', 0.8);
  });
  return webpSupport;
}

export type PreparedImage = { ok: true; file: File } | { ok: false; error: string };

/** เตรียมรูปก่อนอัปโหลด: เล็กพออยู่แล้วส่งตามเดิม ใหญ่เกินหรือชนิดอื่นย่อและแปลงให้ไม่เกิน 2 MB */
export async function prepareImage(
  file: File,
  maxBytes = MAX_UPLOAD_BYTES,
): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) return { ok: false, error: 'รับเฉพาะไฟล์รูป' };
  if (file.size <= maxBytes && READY_TYPES.includes(file.type)) return { ok: true, file };
  if (file.size > MAX_SOURCE_BYTES) {
    return { ok: false, error: 'ไฟล์รูปใหญ่เกิน 40 MB ลองใช้รูปที่เล็กกว่านี้' };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, error: 'เปิดไฟล์รูปนี้ไม่ได้ ลองบันทึกเป็น JPG หรือ PNG แล้วเลือกใหม่' };
  }
  try {
    const type: OutputType = (await canEncodeWebp()) ? 'image/webp' : 'image/jpeg';
    const blob = await fitWithin(bitmap, maxBytes, canvasEncoder(bitmap, type));
    if (!blob) return { ok: false, error: 'ย่อรูปนี้ให้ไม่เกิน 2 MB ไม่ได้ ลองใช้รูปอื่น' };
    const base = file.name.replace(/\.[^./\\]+$/, '') || 'image';
    return {
      ok: true,
      file: new File([blob], `${base}.${type === 'image/webp' ? 'webp' : 'jpg'}`, { type }),
    };
  } catch {
    return { ok: false, error: 'ย่อรูปไม่สำเร็จ ลองใหม่อีกครั้ง หรือใช้รูปอื่น' };
  } finally {
    bitmap.close();
  }
}
