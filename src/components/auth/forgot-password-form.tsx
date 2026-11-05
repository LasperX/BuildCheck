'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, CircleX } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, FormField } from '@/components/auth/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient, authErrorMessage } from '@/lib/auth-client';
import { type ForgotPasswordInput, forgotPasswordSchema } from '@/lib/validators/auth';

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    setError(null);
    const result = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: '/reset-password',
    });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    setSent(true);
  }

  if (sent) {
    // ข้อความเดียวกันไม่ว่าอีเมลจะมีในระบบหรือไม่ ป้องกันการไล่เช็กว่าใครเป็นสมาชิก
    return (
      <>
        <FormAlert variant="ok" icon={<CircleCheck />}>
          ถ้าอีเมลนี้มีบัญชีอยู่ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ให้แล้ว ลิงก์หมดอายุใน 1 ชั่วโมง
        </FormAlert>
        <Link href="/login" className="text-center text-sm font-medium text-link hover:underline">
          กลับไปเข้าสู่ระบบ
        </Link>
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
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        <FormField id="email" label="อีเมล" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </FormField>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'กำลังส่ง...' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
        </Button>
      </form>
      <Link href="/login" className="text-center text-sm font-medium text-link hover:underline">
        กลับไปเข้าสู่ระบบ
      </Link>
    </>
  );
}
