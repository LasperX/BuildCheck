import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/auth-card';
import { RegisterForm } from '@/components/auth/register-form';
import { isGoogleEnabled } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'สมัครสมาชิก · BuildCheck',
  description:
    'สมัครสมาชิก BuildCheck ฟรี บันทึกสเปกคอมที่จัดไว้ แชร์ให้เพื่อนดู และร่วมรายงานราคาอะไหล่มือสอง',
};

export default function RegisterPage() {
  return (
    <AuthCard title="สมัครสมาชิก" description="สมัครฟรี บันทึกสเปกได้ไม่จำกัด">
      <RegisterForm googleEnabled={isGoogleEnabled} />
    </AuthCard>
  );
}
