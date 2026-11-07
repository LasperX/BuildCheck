import type { NextConfig } from 'next';

// ---- ความปลอดภัยของเบราว์เซอร์ (หัวข้อ 9.1 XSS และ Content-Security-Policy) ----
// ใช้ CSP แบบไม่มี nonce ตามเอกสาร Next.js หัวข้อ "Without Nonces" เพราะโปรเจคเปิด Partial Prerendering
// (cacheComponents) ซึ่งเอกสารระบุว่าใช้ร่วมกับ CSP แบบ nonce ไม่ได้ (บันทึกใน spec-review หัวข้อ E เฟส 13)
// script-src ต้องมี 'unsafe-inline' เพราะ Next.js ส่งข้อมูลหน้าเว็บเป็นสคริปต์ในหน้า และสคริปต์โหมดมืด
// สิ่งที่ยังกันได้: โหลดสคริปต์จากโดเมนอื่น ฝังเว็บเราใน iframe ของเว็บอื่น ส่งฟอร์มไปเว็บอื่น <object>/<embed> และเปลี่ยน <base>

const isDev = process.env.NODE_ENV === 'development';
// บน Vercel เป็น HTTPS เสมอ ส่วน next start ในเครื่องเป็น http://localhost จึงเปิดสองข้อนี้เฉพาะบน Vercel
const isHttps = Boolean(process.env.VERCEL);

/** โดเมนรูปภายนอกที่อนุญาต: รูปโปรไฟล์ Google และที่เก็บรูปของเรา (ถ้าตั้งค่า STORAGE_PUBLIC_URL) */
function imageOrigins(): string[] {
  const origins = ['https://lh3.googleusercontent.com'];
  try {
    if (process.env.STORAGE_PUBLIC_URL) origins.push(new URL(process.env.STORAGE_PUBLIC_URL).origin);
  } catch {
    // ค่าไม่ใช่ URL ข้ามไป
  }
  return origins;
}

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${imageOrigins().join(' ')}`,
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isHttps ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // ไม่ให้เบราว์เซอร์เดาชนิดไฟล์เอง (กันไฟล์ที่อัปโหลดถูกตีความเป็นสคริปต์)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // เว็บนี้ไม่ใช้กล้อง ไมโครโฟน และตำแหน่ง
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
  ...(isHttps
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

const nextConfig: NextConfig = {
  // ค่าเริ่มต้นรับได้ 1 MB แต่หัวข้อ 9.1 อนุญาตรูปถึง 2 MB และ CSV ถึง 2 MB
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
  cacheComponents: true,
  // ฟอนต์ไทยของรูปสรุปสเปก อ่านจากไฟล์ตอนรัน ต้องบอกให้รวมไฟล์ไปตอน Deploy ด้วย
  outputFileTracingIncludes: { '/api/og/build/[id]': ['./src/assets/fonts/*.woff'] },
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
