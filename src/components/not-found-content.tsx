import { SearchX } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

// เนื้อหาหน้า 404 ภาษาไทย ใช้ทั้ง URL ที่ไม่มีอยู่และ notFound() ในทุกหน้า
// สเปกส่วนตัวของคนอื่นก็ได้หน้านี้ ไม่บอกว่ามีสเปกนั้นอยู่จริง
export function NotFoundContent() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <SearchX aria-hidden className="size-12 text-muted-foreground" />
      <h1 className="t-h1">ไม่พบหน้านี้</h1>
      <p className="text-muted-foreground">
        ลิงก์อาจพิมพ์ผิด ถูกลบไปแล้ว หรือเป็นสเปกส่วนตัวที่เจ้าของไม่ได้แชร์
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/">กลับหน้าแรก</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/builder">ไปจัดสเปก</Link>
        </Button>
      </div>
    </main>
  );
}
