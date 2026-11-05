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
      <Button type="button" variant="secondary" size="lg" disabled={pending} onClick={signIn}>
        {label}
      </Button>
    </div>
  );
}
