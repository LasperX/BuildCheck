import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans_Thai } from 'next/font/google';

import { Providers } from '@/components/providers';
import { StoreHydrator } from '@/components/site/store-hydrator';
import { themeScript } from '@/lib/theme';
import { TooltipProvider } from '@/components/ui/tooltip';

import './globals.css';

// ฟอนต์ถูกดาวน์โหลดตอน build แล้วเสิร์ฟจากเว็บเราเอง จึงไม่ต้องเรียก Google ตอนเปิดหน้า
const plexSans = IBM_Plex_Sans_Thai({
  variable: '--font-plex-sans',
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

const SITE_DESCRIPTION =
  'เลือกอะไหล่คอมทีละชิ้น ระบบบอกทันทีว่าใส่กันได้ไหม ไฟพอไหม และราคารวมเท่าไหร่';

// metadataBase: ให้ลิงก์รูปตอนแชร์ (og:image) เป็นที่อยู่เต็ม LINE / Facebook จึงโหลดรูปได้
// openGraph / twitter: ทุกหน้าได้ชื่อเว็บ คำอธิบาย และรูปจาก app/opengraph-image.tsx เว้นแต่หน้านั้นกำหนดเอง
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100'),
  title: 'BuildCheck · จัดสเปกคอมพร้อมเช็กความเข้ากันได้',
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: 'BuildCheck',
    locale: 'th_TH',
    type: 'website',
    description: SITE_DESCRIPTION,
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // suppressHydrationWarning: สคริปต์โหมดมืดเปลี่ยน class ของ <html> ก่อน React โหลด จึงต่างจากที่เซิร์ฟเวอร์ส่งมาโดยตั้งใจ
    <html
      lang="th"
      className={`${plexSans.variable} ${plexMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* สคริปต์คงที่ที่เขียนเอง ไม่มีข้อมูลจากผู้ใช้ */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>
          <TooltipProvider>{children}</TooltipProvider>
          <StoreHydrator />
        </Providers>
      </body>
    </html>
  );
}
