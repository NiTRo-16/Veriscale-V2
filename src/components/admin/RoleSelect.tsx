'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { changeRole } from '@/app/(app)/admin/users/actions';
import { ROLE_LABEL } from '@/lib/labels';
import type { Role } from '@/lib/types';

export function RoleSelect({ userId, name, role, isSelf }: { userId: string; name: string; role: Role; isSelf: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState<Role>(role);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onChange = (next: Role) => {
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await changeRole(userId, next);
      if (!result.ok) {
        setValue(previous);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label={`Role for ${name}`}
        value={value}
        disabled={pending || isSelf}
        title={isSelf ? "You can't change your own role" : undefined}
        onChange={(e) => onChange(e.target.value as Role)}
        className="h-8 w-44 rounded-lg border border-line-strong bg-card px-2 text-[13px] text-ink focus:border-green focus:outline-none disabled:bg-page disabled:text-muted"
      >
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      {error && <span className="text-[12px] text-red">{error}</span>}
    </div>
  );
}
