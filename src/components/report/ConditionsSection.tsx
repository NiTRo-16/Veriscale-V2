'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Pill';
import { fieldProblem } from '@/lib/draft-fields';
import { SOURCE_LABEL } from '@/lib/labels';
import type { ConditionSource } from '@/lib/types';
import type { DraftForm, SetField } from './draft-form';
import { UnitInput } from './UnitInput';

function SourcePill({ source, confirmed }: { source: ConditionSource | null; confirmed: boolean }) {
  if (!source) return null;
  if (source === 'weather') return <Pill tone="amber">{confirmed ? 'Weather' : 'Weather · please confirm'}</Pill>;
  return <Pill tone={source === 'sensor' ? 'green' : 'gray'}>{SOURCE_LABEL[source]}</Pill>;
}

export function ConditionsSection({
  form,
  setField,
  setCondition,
  actions,
  notice,
}: {
  form: DraftForm;
  setField: SetField;
  setCondition: (key: 'temperature_c' | 'humidity_pct', value: string) => void;
  actions?: ReactNode;
  notice?: ReactNode;
}) {
  const usesWeather = form.temperature_source === 'weather' || form.humidity_source === 'weather';

  return (
    <Card title="Test conditions" subtitle="Each reading shows where it came from." actions={actions}>
      <div className="flex flex-col gap-4">
        {notice}
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <Field
            label="Temperature"
            htmlFor="temperature_c"
            extra={<SourcePill source={form.temperature_source} confirmed={form.weather_confirmed} />}
            error={fieldProblem('temperature_c', form.temperature_c)}
          >
            <UnitInput
              id="temperature_c"
              unit="°C"
              value={form.temperature_c}
              onChange={(e) => setCondition('temperature_c', e.target.value)}
            />
          </Field>
          <Field
            label="Humidity"
            htmlFor="humidity_pct"
            extra={<SourcePill source={form.humidity_source} confirmed={form.weather_confirmed} />}
            error={fieldProblem('humidity_pct', form.humidity_pct)}
          >
            <UnitInput id="humidity_pct" unit="%" value={form.humidity_pct} onChange={(e) => setCondition('humidity_pct', e.target.value)} />
          </Field>
          <Field
            label="Supply voltage"
            htmlFor="voltage_v"
            hint="Typed in from the supply meter."
            error={fieldProblem('voltage_v', form.voltage_v)}
          >
            <UnitInput id="voltage_v" unit="V" value={form.voltage_v} onChange={(e) => setField('voltage_v', e.target.value)} />
          </Field>
          <Field label="Test date" htmlFor="test_date">
            <Input id="test_date" type="date" value={form.test_date} onChange={(e) => setField('test_date', e.target.value)} />
          </Field>
          <Field label="Reference weights used" htmlFor="reference_weights" className="md:col-span-2">
            <Input
              id="reference_weights"
              value={form.reference_weights}
              placeholder="e.g. OIML class F2 weight set, certificate WS-4471"
              onChange={(e) => setField('reference_weights', e.target.value)}
            />
          </Field>
          <Field label="Remarks (optional)" htmlFor="remarks" className="md:col-span-2">
            <Textarea id="remarks" value={form.remarks} onChange={(e) => setField('remarks', e.target.value)} />
          </Field>
        </div>

        {usesWeather && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber/40 bg-amber-soft px-3 py-2.5 text-[13px] text-amber-ink">
            <input
              type="checkbox"
              className="mt-0.5 accent-green"
              checked={form.weather_confirmed}
              onChange={(e) => setField('weather_confirmed', e.target.checked)}
            />
            <span>
              These are outdoor weather estimates. I've checked they are close enough to the conditions in the lab.
            </span>
          </label>
        )}
      </div>
    </Card>
  );
}
