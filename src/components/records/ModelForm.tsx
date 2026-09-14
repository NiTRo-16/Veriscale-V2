'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveModel } from '@/app/(app)/records/actions';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { ACCURACY_CLASS_OPTIONS } from '@/lib/labels';
import { MAX_NAME } from '@/lib/records';
import type { InstrumentModel } from '@/lib/types';
import { FormError } from './FormError';

export function ModelForm({
  manufacturers,
  model,
  defaultManufacturerId,
  doneHref,
}: {
  manufacturers: ReadonlyArray<{ id: string; name: string }>;
  model?: InstrumentModel | null;
  defaultManufacturerId?: string;
  doneHref: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    manufacturerId: model?.manufacturer_id ?? defaultManufacturerId ?? '',
    name: model?.name ?? '',
    accuracyClass: model?.accuracy_class ?? '',
    maxCapacityKg: model ? String(model.max_capacity_kg) : '',
    intervalEG: model ? String(model.interval_e_g) : '',
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(model);

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveModel({ id: model?.id ?? null, ...values });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(doneHref);
    });
  };

  return (
    <Card
      title={editing ? 'Edit model' : 'Add model'}
      subtitle="Capacity and interval are used to work out the allowed error. Reports that were already sent don't change."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Field label="Manufacturer" htmlFor="model-manufacturer">
            <Select id="model-manufacturer" value={values.manufacturerId} onChange={set('manufacturerId')} required>
              <option value="">Choose…</option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Model name" htmlFor="model-name">
            <Input id="model-name" value={values.name} onChange={set('name')} maxLength={MAX_NAME} autoComplete="off" required />
          </Field>
          <Field label="Accuracy class" htmlFor="model-class">
            <Select id="model-class" value={values.accuracyClass} onChange={set('accuracyClass')} required>
              <option value="">Choose a class…</option>
              {ACCURACY_CLASS_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Maximum capacity (kg)" htmlFor="model-capacity">
            <Input id="model-capacity" inputMode="decimal" value={values.maxCapacityKg} onChange={set('maxCapacityKg')} required />
          </Field>
          <Field label="Verification interval e (g)" htmlFor="model-interval">
            <Input id="model-interval" inputMode="decimal" value={values.intervalEG} onChange={set('intervalEG')} required />
          </Field>
        </div>
        <FormError error={error} />
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save model' : 'Add model'}
          </Button>
          <ButtonLink href={doneHref} variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}
