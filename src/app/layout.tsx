import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans_Thai } from 'next/font/google';

import { Providers } from '@/components/providers';
import { StoreHydrator } from '@/components/site/store-hydrator';
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

export const metadata: Metadata = {
  title: 'BuildCheck · จัดสเปกคอมพร้อมเช็กความเข้ากันได้',
  description: 'เลือกอะไหล่คอมทีละชิ้น ระบบบอกทันทีว่าใส่กันได้ไหม ไฟพอไหม และราคารวมเท่าไหร่',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="th" className={`${plexSans.variable} ${plexMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <Providers>
          <TooltipProvider>{children}</TooltipProvider>
          <StoreHydrator />
        </Providers>
      </body>
    </html>
  );
}
