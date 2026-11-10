import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'ตั้งรหัสผ่านใหม่ · BuildCheck',
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthCard title="ตั้งรหัสผ่านใหม่">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
