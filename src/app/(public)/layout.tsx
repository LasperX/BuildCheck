import { ViewTransition } from 'react';

import { SiteFloating, SiteFooter, SiteHeader } from '@/components/site-header';

export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <SiteHeader />
      {/* เปลี่ยนหน้าแบบค่อยๆ จาง เฉพาะเนื้อหา แถบเมนูกับท้ายเว็บอยู่นิ่ง (เบราว์เซอร์ที่ไม่รองรับจะเปลี่ยนหน้าตามปกติ) */}
      <ViewTransition>
        <div className="flex-1">{children}</div>
      </ViewTransition>
      <SiteFooter />
      <SiteFloating />
    </>
  );
}
