'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleX } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { OrDivider } from '@/components/auth/auth-card';
import { FormAlert, FormField } from '@/components/auth/form-field';
import { GoogleButton } from '@/components/auth/google-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient, authErrorMessage } from '@/lib/auth-client';
import { type RegisterInput, registerSchema } from '@/lib/validators/auth';

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setError(null);
    const username = values.username.trim().toLowerCase();
    const result = await authClient.signUp.email({
      email: values.email,
      password: values.password,
      username,
      displayUsername: username,
      name: username, // ชื่อที่แสดงเริ่มต้นเท่ากับชื่อผู้ใช้ แก้ได้ในหน้าตั้งค่า
      callbackURL: '/me/settings?verified=1',
    });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    router.replace('/me/settings?welcome=1');
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
        <FormField
          id="username"
          label="ชื่อผู้ใช้"
          error={errors.username?.message}
          hint="ใช้ในลิงก์โปรไฟล์ ได้เฉพาะ a-z, 0-9 และขีดล่าง 3–30 ตัว"
        >
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            aria-invalid={Boolean(errors.username)}
            {...register('username')}
          />
        </FormField>
        <FormField
          id="password"
          label="รหัสผ่าน"
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
          label="ยืนยันรหัสผ่าน"
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
          {isSubmitting ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
        </Button>
      </form>
      {googleEnabled ? (
        <>
          <OrDivider />
          <GoogleButton label="สมัครด้วย Google" next="/me/settings" />
        </>
      ) : null}
      <p className="text-center text-sm text-muted-foreground">
        มีบัญชีแล้ว?{' '}
        <Link href="/login" className="font-medium text-link hover:underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </>
  );
}
