import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ค่าเริ่มต้นรับได้ 1 MB แต่หัวข้อ 9.1 อนุญาตรูปถึง 2 MB และ CSV ถึง 2 MB
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
  cacheComponents: true,
  // ฟอนต์ไทยของรูปสรุปสเปก อ่านจากไฟล์ตอนรัน ต้องบอกให้รวมไฟล์ไปตอน Deploy ด้วย
  outputFileTracingIncludes: { '/api/og/build/[id]': ['./src/assets/fonts/*.woff'] },
  partialPrefetching: true,
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
