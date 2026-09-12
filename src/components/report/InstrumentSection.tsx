'use client';

import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { table3Hint } from '@/lib/calc';
import { fieldProblem } from '@/lib/draft-fields';
import { ACCURACY_CLASS_OPTIONS, INDICATOR_TYPES, POWER_SOURCES, TEST_STAGE_LABEL } from '@/lib/labels';
import type { TestStage } from '@/lib/types';
import type { DraftForm, SetField } from './draft-form';
import { UnitInput } from './UnitInput';

export function InstrumentSection({ form, setField }: { form: DraftForm; setField: SetField }) {
  const hint = table3Hint(form.accuracy_class || null, form.max_capacity_kg, form.interval_e_g);

  return (
    <Card title="Instrument details" subtitle="The weighing instrument being tested.">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
        <Field label="Manufacturer" htmlFor="manufacturer">
          <Input id="manufacturer" value={form.manufacturer} onChange={(e) => setField('manufacturer', e.target.value)} />
        </Field>
        <Field label="Model" htmlFor="model">
          <Input id="model" value={form.model} onChange={(e) => setField('model', e.target.value)} />
        </Field>
        <Field label="Serial number" htmlFor="serial_number">
          <Input
            id="serial_number"
            className="font-mono"
            value={form.serial_number}
            onChange={(e) => setField('serial_number', e.target.value)}
          />
        </Field>
        <Field label="Accuracy class" htmlFor="accuracy_class">
          <Select
            id="accuracy_class"
            value={form.accuracy_class}
            onChange={(e) => setField('accuracy_class', e.target.value as DraftForm['accuracy_class'])}
          >
            <option value="">Choose a class…</option>
            {ACCURACY_CLASS_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Maximum capacity" htmlFor="max_capacity_kg" error={fieldProblem('max_capacity_kg', form.max_capacity_kg)}>
          <UnitInput
            id="max_capacity_kg"
            unit="kg"
            value={form.max_capacity_kg}
            onChange={(e) => setField('max_capacity_kg', e.target.value)}
          />
        </Field>
        <Field label="Verification interval (e)" htmlFor="interval_e_g" error={fieldProblem('interval_e_g', form.interval_e_g)}>
          <UnitInput id="interval_e_g" unit="g" value={form.interval_e_g} onChange={(e) => setField('interval_e_g', e.target.value)} />
        </Field>
        <Field label="Indicator type" htmlFor="indicator_type">
          <Select id="indicator_type" value={form.indicator_type} onChange={(e) => setField('indicator_type', e.target.value)}>
            <option value="">Choose…</option>
            {INDICATOR_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Power source" htmlFor="power_source">
          <Select id="power_source" value={form.power_source} onChange={(e) => setField('power_source', e.target.value)}>
            <option value="">Choose…</option>
            {POWER_SOURCES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>

        <fieldset className="md:col-span-2">
          <legend className="mb-1.5 text-[12px] font-medium text-ink-soft">Test stage</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TEST_STAGE_LABEL) as TestStage[]).map((stage) => {
              const checked = form.test_stage === stage;
              return (
                <label
                  key={stage}
                  className={`flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3.5 text-[13px] font-medium ${
                    checked ? 'border-green bg-green-soft text-ink' : 'border-line-strong bg-card text-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="test_stage"
                    className="accent-green"
                    checked={checked}
                    onChange={() => setField('test_stage', stage)}
                  />
                  {TEST_STAGE_LABEL[stage]}
                </label>
              );
            })}
          </div>
        </fieldset>

        {hint && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-soft px-3 py-2 text-[12.5px] text-amber-ink md:col-span-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {hint}
          </p>
        )}
      </div>
    </Card>
  );
}
