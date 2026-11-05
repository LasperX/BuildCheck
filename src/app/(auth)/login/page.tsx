import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';
import { isGoogleEnabled } from '@/lib/auth';

export const metadata: Metadata = { title: 'เข้าสู่ระบบ · BuildCheck' };

export default function LoginPage() {
  return (
    <AuthCard title="เข้าสู่ระบบ" description="เข้าสู่ระบบเพื่อบันทึกและแชร์สเปกของคุณ">
      {/* useSearchParams อ่านค่าจาก URL ตอนเปิดหน้า จึงต้องอยู่ใน Suspense */}
      <Suspense>
        <LoginForm googleEnabled={isGoogleEnabled} />
      </Suspense>
    </AuthCard>
  );
}
