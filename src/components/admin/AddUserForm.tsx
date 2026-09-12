'use client';

import { UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addUser } from '@/app/(app)/admin/users/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { ROLE_LABEL } from '@/lib/labels';
import type { Role } from '@/lib/types';

const EMPTY = { fullName: '', email: '', password: '', role: 'technician' };

export function AddUserForm() {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await addUser(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(`Added ${result.data.fullName}. Share the temporary password with them privately.`);
      setValues(EMPTY);
      router.refresh();
    });
  };

  return (
    <Card title="Add a new user" subtitle="People can't sign up on their own — add every technician, reviewer and admin here.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="Full name" htmlFor="new-name">
            <Input id="new-name" value={values.fullName} onChange={set('fullName')} autoComplete="off" required />
          </Field>
          <Field label="Email" htmlFor="new-email">
            <Input id="new-email" type="email" value={values.email} onChange={set('email')} autoComplete="off" required />
          </Field>
          <Field label="Temporary password" htmlFor="new-password" hint="At least 8 characters.">
            <Input
              id="new-password"
              type="password"
              value={values.password}
              onChange={set('password')}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <Field label="Role" htmlFor="new-role">
            <Select id="new-role" value={values.role} onChange={set('role')}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-soft px-3 py-2 text-[12.5px] text-red">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="rounded-lg bg-green-soft px-3 py-2 text-[12.5px] text-green-ink">
            {success}
          </p>
        )}
        <div>
          <Button type="submit" disabled={pending}>
            <UserPlus size={16} strokeWidth={1.75} />
            {pending ? 'Adding…' : 'Add user'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
