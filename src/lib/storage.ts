import 'server-only';

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

// อัปโหลดรูปตามหัวข้อ 9.1: รับเฉพาะ JPG/PNG/WebP ไม่เกิน 2 MB ตรวจชนิดไฟล์จากเนื้อไฟล์จริง
// และตั้งชื่อใหม่แบบสุ่มเสมอ ไม่เชื่อชื่อหรือชนิดไฟล์ที่เบราว์เซอร์ส่งมา
//
// ที่เก็บ: ถ้าตั้งค่า STORAGE_* จะส่งขึ้นบริการแบบ S3 ซึ่งใช้ได้ทั้ง R2, Neon และ Supabase
// ถ้าไม่ได้ตั้งค่า ตอนพัฒนาจะเก็บใน public/uploads ส่วนบน Production จะแจ้ง Error

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

type ImageType = { ext: 'jpg' | 'png' | 'webp'; contentType: string };

/** อ่านลายเซ็นต้นไฟล์ (Magic Bytes) ไฟล์อันตรายที่เปลี่ยนนามสกุลเป็น .jpg จะไม่ผ่าน */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const startsWith = (...sig: number[]) => sig.every((value, i) => bytes[i] === value);
  if (startsWith(0xff, 0xd8, 0xff)) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { ext: 'png', contentType: 'image/png' };
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  return null;
}

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadImage(
  file: File,
  folder: 'parts' | 'avatars' | 'used-proofs',
): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, error: 'ไม่พบไฟล์รูป' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: 'รูปต้องมีขนาดไม่เกิน 2 MB' };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return { ok: false, error: 'รับเฉพาะไฟล์ JPG, PNG หรือ WebP' };

  const key = `${folder}/${randomUUID()}.${type.ext}`;
  const { STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_PUBLIC_URL } = process.env;

  if (STORAGE_ENDPOINT && STORAGE_BUCKET && STORAGE_PUBLIC_URL) {
    const client = new S3Client({
      endpoint: STORAGE_ENDPOINT,
      region: process.env.STORAGE_REGION || 'auto',
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',
      },
    });
    await client.send(
      new PutObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: type.contentType,
      }),
    );
    return { ok: true, url: `${STORAGE_PUBLIC_URL.replace(/\/$/, '')}/${key}` };
  }

  if (process.env.NODE_ENV === 'production') {
    return { ok: false, error: 'ยังไม่ได้ตั้งค่าที่เก็บรูป' };
  }

  const target = path.join(process.cwd(), 'public', 'uploads', folder);
  await mkdir(target, { recursive: true });
  await writeFile(path.join(process.cwd(), 'public', 'uploads', key), bytes);
  return { ok: true, url: `/uploads/${key}` };
}
