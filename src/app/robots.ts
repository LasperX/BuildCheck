import type { MetadataRoute } from 'next';

import { appUrl } from '@/lib/builder/share';

// robots.txt: ให้ search engine เก็บหน้าสาธารณะได้ แต่ไม่เข้าหลังบ้าน หน้าบัญชี และ API
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/me',
        '/api/',
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
      ],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
