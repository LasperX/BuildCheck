import 'server-only';

import QRCode from 'qrcode';

// ลิงก์สั้นของสเปก /b/รหัส 10 ตัว และ QR Code ที่ชี้ไปลิงก์นั้น สร้างบนเซิร์ฟเวอร์ (หัวข้อ 7)

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100').replace(/\/$/, '');
}

export const shortUrl = (id: string) => `${appUrl()}/b/${id}`;

/** QR เป็น SVG ข้อความล้วน ไม่ต้องเก็บไฟล์รูป ฝังลงหน้าเว็บได้ทันที */
export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

export { newBuildId } from './build-id';
