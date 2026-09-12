'use client';

import { AlertCircle } from 'lucide-react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { signIn, type SignInState } from './actions';

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state.error && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-soft px-3 py-2 text-[12.5px] text-red">
          <AlertCircle size={15} /> {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-1 h-10 w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
