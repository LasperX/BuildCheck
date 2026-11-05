'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleX } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { OrDivider } from '@/components/auth/auth-card';
import { FormAlert, FormField } from '@/components/auth/form-field';
import { GoogleButton } from '@/components/auth/google-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient, authErrorMessage } from '@/lib/auth-client';
import { type LoginInput, loginSchema, safeNextPath } from '@/lib/validators/auth';

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setError(null);
    const result = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    router.replace(next);
    router.refresh();
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
        <FormField id="email" label="อีเมล" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </FormField>
        <FormField id="password" label="รหัสผ่าน" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </FormField>
        <div className="text-right">
          <Link href="/forgot-password" className="text-xs font-medium text-link hover:underline">
            ลืมรหัสผ่าน?
          </Link>
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </Button>
      </form>
      {googleEnabled ? (
        <>
          <OrDivider />
          <GoogleButton label="เข้าสู่ระบบด้วย Google" next={next} />
        </>
      ) : null}
      <p className="text-center text-sm text-muted-foreground">
        ยังไม่มีบัญชี?{' '}
        <Link href="/register" className="font-medium text-link hover:underline">
          สมัครสมาชิก
        </Link>
      </p>
    </>
  );
}
