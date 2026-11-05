'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, CircleX } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, FormField } from '@/components/auth/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient, authErrorMessage } from '@/lib/auth-client';
import { type ResetPasswordInput, resetPasswordSchema } from '@/lib/validators/auth';

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  if (!token || params.get('error')) {
    return (
      <>
        <FormAlert variant="err" icon={<CircleX />}>
          ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่
        </FormAlert>
        <Link
          href="/forgot-password"
          className="text-center text-sm font-medium text-link hover:underline"
        >
          ขอลิงก์ใหม่
        </Link>
      </>
    );
  }

  async function onSubmit(values: ResetPasswordInput) {
    setError(null);
    const result = await authClient.resetPassword({
      newPassword: values.password,
      token: token ?? '',
    });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <>
        <FormAlert variant="ok" icon={<CircleCheck />}>
          ตั้งรหัสผ่านใหม่แล้ว และออกจากระบบทุกอุปกรณ์เรียบร้อย
        </FormAlert>
        <Button asChild size="lg">
          <Link href="/login">เข้าสู่ระบบ</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      {error ? (
        <FormAlert variant="err" icon={<CircleX />}>
          {error}
        </FormAlert>
      ) : null}
      <form
        method="post"
        className="flex flex-col gap-4"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
      >
        <FormField
          id="password"
          label="รหัสผ่านใหม่"
          error={errors.password?.message}
          hint="อย่างน้อย 8 ตัวอักษร"
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </FormField>
        <FormField
          id="confirmPassword"
          label="ยืนยันรหัสผ่านใหม่"
          error={errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </FormField>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
        </Button>
      </form>
    </>
  );
}
