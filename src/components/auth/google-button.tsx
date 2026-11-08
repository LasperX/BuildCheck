'use client';

import { CircleX } from 'lucide-react';
import { useState } from 'react';

import { FormAlert } from '@/components/auth/form-field';
import { Button } from '@/components/ui/button';
import { authClient, authErrorMessage } from '@/lib/auth-client';

export function GoogleButton({ label, next }: { label: string; next: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    const result = await authClient.signIn.social({ provider: 'google', callbackURL: next });
    if (result.error) {
      setError(authErrorMessage(result.error));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <FormAlert variant="err" icon={<CircleX />}>
          {error}
        </FormAlert>
      ) : null}
      {/* สีปุ่มตามแนวทางปุ่ม "Sign in with Google" ของ Google: สว่าง = พื้นขาว ขอบเทา, มืด = พื้นเทาเข้ม */}
      <Button
        type="button"
        size="lg"
        disabled={pending}
        onClick={signIn}
        className="border-[#747775] bg-white text-[#1f1f1f] hover:bg-[#f2f2f2] dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1f1f20]"
      >
        <GoogleLogo />
        {pending ? 'กำลังไปที่ Google...' : label}
      </Button>
    </div>
  );
}

/** โลโก้ "G" 4 สีของ Google ตามที่ Google ให้ใช้กับปุ่มเข้าสู่ระบบ ห้ามเปลี่ยนสีหรือสัดส่วน */
function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-5 shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
