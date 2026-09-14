'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveWeightSet } from '@/app/(app)/records/actions';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { WEIGHT_CLASSES } from '@/lib/labels';
import { MAX_CODE } from '@/lib/records';
import type { WeightSet } from '@/lib/types';
import { FormError } from './FormError';

export function WeightSetForm({ set: weightSet, doneHref }: { set?: WeightSet | null; doneHref: string }) {
  const router = useRouter();
  const [values, setValues] = useState({
    code: weightSet?.code ?? '',
    description: weightSet?.description ?? '',
    weightClass: weightSet?.weight_class ?? '',
    nominalRange: weightSet?.nominal_range ?? '',
    certificateNo: weightSet?.certificate_no ?? '',
    lastChecked: weightSet?.last_checked ?? '',
    nextCheck: weightSet?.next_check ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(weightSet);

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveWeightSet({ id: weightSet?.id ?? null, ...values });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(doneHref);
    });
  };

  return (
    <Card
      title={editing ? `Edit ${weightSet?.code}` : 'Add weight set'}
      subtitle="After a new check, enter the new certificate and the next check date."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Code" htmlFor="ws-code">
            <Input
              id="ws-code"
              className="font-mono"
              value={values.code}
              onChange={set('code')}
              maxLength={MAX_CODE}
              placeholder="e.g. WS-4471"
              autoComplete="off"
              required
            />
          </Field>
          <Field label="Weight class" htmlFor="ws-class">
            <Select id="ws-class" value={values.weightClass} onChange={set('weightClass')} required>
              <option value="">Choose a class…</option>
              {WEIGHT_CLASSES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Range (optional)" htmlFor="ws-range">
            <Input id="ws-range" value={values.nominalRange} onChange={set('nominalRange')} placeholder="e.g. 1 mg – 20 kg" />
          </Field>
          <Field label="Certificate number (optional)" htmlFor="ws-certificate">
            <Input id="ws-certificate" className="font-mono" value={values.certificateNo} onChange={set('certificateNo')} />
          </Field>
          <Field label="Description (optional)" htmlFor="ws-description" className="md:col-span-2">
            <Input id="ws-description" value={values.description} onChange={set('description')} placeholder="e.g. Stainless steel set in case" />
          </Field>
          <Field label="Last checked (optional)" htmlFor="ws-last">
            <Input id="ws-last" type="date" value={values.lastChecked} onChange={set('lastChecked')} />
          </Field>
          <Field label="Next check" htmlFor="ws-next">
            <Input id="ws-next" type="date" value={values.nextCheck} onChange={set('nextCheck')} required />
          </Field>
        </div>
        <FormError error={error} />
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save weight set' : 'Add weight set'}
          </Button>
          <ButtonLink href={doneHref} variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}
