import { TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthCard } from '@/components/auth/auth-card';
import { FormAlert } from '@/components/auth/form-field';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { isGoogleEnabled } from '@/lib/auth';
import { canDeliverEmail } from '@/lib/email-verification';

export const metadata: Metadata = { title: 'ลืมรหัสผ่าน · BuildCheck', robots: { index: false } };

export default function ForgotPasswordPage() {
  // เว็บจริงที่ยังไม่ได้ตั้งระบบส่งอีเมล: บอกตามจริง ไม่ให้กรอกแล้วขึ้นว่า "ส่งลิงก์แล้ว" ทั้งที่ไม่มีอีเมลออกไป
  // (ตั้ง RESEND_API_KEY และ EMAIL_FROM แล้ว Deploy ใหม่ ฟอร์มจะกลับมาเอง)
  if (!canDeliverEmail()) {
    return (
      <AuthCard title="ลืมรหัสผ่าน" description="ตั้งรหัสผ่านใหม่ทางอีเมลยังใช้ไม่ได้ชั่วคราว">
        <FormAlert variant="warn" icon={<TriangleAlert />}>
          เว็บยังไม่ได้เปิดระบบส่งอีเมล จึงยังส่งลิงก์ตั้งรหัสผ่านใหม่ให้ไม่ได้
        </FormAlert>
        {isGoogleEnabled ? (
          <p className="text-sm text-muted-foreground">
            ถ้าสมัครด้วยบัญชี Google เข้าสู่ระบบด้วย Google ได้ตามปกติ ไม่ต้องใช้รหัสผ่าน
          </p>
        ) : null}
        <Link href="/login" className="text-center text-sm font-medium text-link hover:underline">
          กลับไปเข้าสู่ระบบ
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="ลืมรหัสผ่าน"
      description="กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้"
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
