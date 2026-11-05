import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ค่าเริ่มต้นรับได้ 1 MB แต่หัวข้อ 9.1 อนุญาตรูปถึง 2 MB และ CSV ถึง 2 MB
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
  cacheComponents: true,
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
