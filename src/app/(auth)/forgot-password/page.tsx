import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = { title: 'ลืมรหัสผ่าน · BuildCheck', robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="ลืมรหัสผ่าน"
      description="กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้"
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
