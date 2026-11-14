import type { Metadata } from 'next';

import { NotFoundContent } from '@/components/not-found-content';

export const metadata: Metadata = { title: 'ไม่พบหน้านี้ · BuildCheck', robots: { index: false } };

// หน้า 404 ภายในโครงหน้าผู้ใช้ (มีแถบเมนูและ Footer จาก layout อยู่แล้ว)
export default function NotFound() {
  return <NotFoundContent />;
}
