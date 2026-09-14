'use client';

import { AlertCircle, CalendarClock } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Pill';
import { fieldProblem } from '@/lib/draft-fields';
import { formatDate } from '@/lib/format';
import { SOURCE_LABEL } from '@/lib/labels';
import { isDateOnly, isOverdueOn, weightSetSummary, weightStatus } from '@/lib/records';
import type { ConditionSource, WeightSet } from '@/lib/types';
import { OTHER_OPTION, type DraftForm, type PatchForm, type SetField } from './draft-form';
import { UnitInput } from './UnitInput';

function SourcePill({ source, confirmed }: { source: ConditionSource | null; confirmed: boolean }) {
  if (!source) return null;
  if (source === 'weather') return <Pill tone="amber">{confirmed ? 'Weather' : 'Weather · please confirm'}</Pill>;
  return <Pill tone={source === 'sensor' ? 'green' : 'gray'}>{SOURCE_LABEL[source]}</Pill>;
}

export function ConditionsSection({
  form,
  setField,
  patchForm,
  weightSets,
  today,
  setCondition,
  actions,
  notice,
}: {
  form: DraftForm;
  setField: SetField;
  patchForm: PatchForm;
  weightSets: WeightSet[];
  today: string;
  setCondition: (key: 'temperature_c' | 'humidity_pct', value: string) => void;
  actions?: ReactNode;
  notice?: ReactNode;
}) {
  const usesWeather = form.temperature_source === 'weather' || form.humidity_source === 'weather';

  // A set can't be used once its check date is before the test date.
  const picking = weightSets.length > 0;
  const [typingWeights, setTypingWeights] = useState(() => !form.weight_set_id && form.reference_weights.trim() !== '');
  const testDay = isDateOnly(form.test_date) ? form.test_date : today;
  const pickedSet = weightSets.find((s) => s.id === form.weight_set_id) ?? null;
  const pickedStatus = pickedSet ? weightStatus(pickedSet.next_check, testDay) : null;

  const pickWeights = (value: string) => {
    if (value === OTHER_OPTION) {
      setTypingWeights(true);
      patchForm({ weight_set_id: '' });
      return;
    }
    setTypingWeights(false);
    const set = weightSets.find((s) => s.id === value);
    patchForm({ weight_set_id: set?.id ?? '', reference_weights: set ? weightSetSummary(set) : '' });
  };

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
            {picking ? (
              <>
                <Select
                  id="reference_weights"
                  value={form.weight_set_id || (typingWeights ? OTHER_OPTION : '')}
                  onChange={(e) => pickWeights(e.target.value)}
                >
                  <option value="">Choose a weight set…</option>
                  {weightSets.map((s) => {
                    const overdue = isOverdueOn(s.next_check, testDay);
                    return (
                      <option key={s.id} value={s.id} disabled={overdue && s.id !== form.weight_set_id}>
                        {weightSetSummary(s)}
                        {overdue ? ' — overdue for its check' : ''}
                      </option>
                    );
                  })}
                  <option value={OTHER_OPTION}>Other (type it in)</option>
                </Select>
                {typingWeights && (
                  <Input
                    aria-label="Reference weights used"
                    className="mt-2"
                    value={form.reference_weights}
                    placeholder="e.g. OIML class F2 weight set, certificate WS-4471"
                    onChange={(e) => setField('reference_weights', e.target.value)}
                  />
                )}
                {pickedSet && pickedStatus?.state === 'overdue' && (
                  <p role="alert" className="mt-2 flex items-start gap-2 rounded-lg bg-red-soft px-3 py-2 text-[12.5px] text-red">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    {pickedSet.code} was due for its check on {formatDate(pickedSet.next_check)}. Choose another set, or ask a
                    reviewer to enter its new check date.
                  </p>
                )}
                {pickedSet && pickedStatus?.state === 'due_soon' && (
                  <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-soft px-3 py-2 text-[12.5px] text-amber-ink">
                    <CalendarClock size={15} className="mt-0.5 shrink-0" />
                    {pickedSet.code} is due for its check on {formatDate(pickedSet.next_check)}.
                  </p>
                )}
              </>
            ) : (
              <Input
                id="reference_weights"
                value={form.reference_weights}
                placeholder="e.g. OIML class F2 weight set, certificate WS-4471"
                onChange={(e) => setField('reference_weights', e.target.value)}
              />
            )}
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
