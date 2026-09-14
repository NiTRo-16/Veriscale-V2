'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveManufacturer } from '@/app/(app)/records/actions';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { MAX_NAME } from '@/lib/records';
import { FormError } from './FormError';

export function ManufacturerForm({
  manufacturer,
  cancelHref,
}: {
  manufacturer?: { id: string; name: string } | null;
  cancelHref: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(manufacturer?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(manufacturer);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveManufacturer({ id: manufacturer?.id ?? null, name });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/records/manufacturers?id=${result.data}`);
    });
  };

  return (
    <Card
      title={editing ? 'Rename manufacturer' : 'Add manufacturer'}
      subtitle={
        editing
          ? 'Reports that were already sent keep the name they were sent with.'
          : 'Technicians pick from this list when they fill in a report.'
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="manufacturer-name" className="max-w-md">
          <Input
            id="manufacturer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME}
            autoComplete="off"
            autoFocus
            required
          />
        </Field>
        <FormError error={error} />
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save name' : 'Add manufacturer'}
          </Button>
          <ButtonLink href={cancelHref} variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}
