import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

// ด่านแรกก่อนเข้าถึงหน้า (Next.js 16 เปลี่ยนชื่อ Middleware เป็น Proxy)
// - /me/*    ต้องล็อกอิน
// - /admin/* ต้องเป็นแอดมิน
// - หน้าล็อกอินและสมัคร ถ้าล็อกอินแล้วให้กลับหน้าแรก
// นี่เป็นแค่ด่านหน้าเพื่อ UX: Server Action และหน้าเว็บตรวจสิทธิ์ซ้ำเองผ่าน lib/session.ts เสมอ (หัวข้อ 9.1)

const GUEST_ONLY = ['/login', '/register', '/forgot-password', '/reset-password'];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await auth.api.getSession({ headers: request.headers });

  if (GUEST_ONLY.includes(pathname)) {
    return session ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  }

  if (!session) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname + search);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith('/admin') && session.user.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/me/:path*',
    '/admin/:path*',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
  ],
};
