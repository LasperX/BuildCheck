import { NextResponse } from 'next/server';

import { buildIdSchema } from '@/lib/validators/builds';

// ลิงก์สั้น /b/รหัส ส่งต่อไปหน้ารายละเอียดสเปก (หัวข้อ 3.3) ตรวจรูปแบบรหัสก่อนกันลิงก์แปลกๆ
export async function GET(request: Request, { params }: RouteContext<'/b/[id]'>) {
  const id = buildIdSchema.safeParse((await params).id);
  const target = id.success ? `/builds/${id.data}` : '/';
  return NextResponse.redirect(new URL(target, request.url), 307);
}
