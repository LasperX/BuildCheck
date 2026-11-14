import type { Metadata } from 'next';

import { NotFoundContent } from '@/components/not-found-content';
import { SiteFooter, SiteHeader } from '@/components/site-header';

export const metadata: Metadata = { title: 'ไม่พบหน้านี้ · BuildCheck', robots: { index: false } };

// URL ที่ไม่ตรงกับหน้าไหนเลยจะมาที่นี่ ซึ่งอยู่นอกโครงหน้าผู้ใช้ จึงใส่แถบเมนูและ Footer เอง
// ให้ผู้ใช้กดไปหน้าอื่นต่อได้
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <NotFoundContent />
      </div>
      <SiteFooter />
    </>
  );
}
