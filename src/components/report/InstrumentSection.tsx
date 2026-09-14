'use client';

import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { table3Hint } from '@/lib/calc';
import { fieldProblem } from '@/lib/draft-fields';
import { formatAmount } from '@/lib/format';
import { ACCURACY_CLASS_OPTIONS, INDICATOR_TYPES, POWER_SOURCES, TEST_STAGE_LABEL } from '@/lib/labels';
import type { InstrumentModel, Manufacturer, TestStage } from '@/lib/types';
import { OTHER_OPTION, type DraftForm, type PatchForm, type SetField } from './draft-form';
import { UnitInput } from './UnitInput';

export function InstrumentSection({
  form,
  setField,
  patchForm,
  manufacturers,
  models,
}: {
  form: DraftForm;
  setField: SetField;
  patchForm: PatchForm;
  manufacturers: Manufacturer[];
  models: InstrumentModel[];
}) {
  const hint = table3Hint(form.accuracy_class || null, form.max_capacity_kg, form.interval_e_g);

  // With no manufacturers listed yet, both fields stay plain text boxes.
  const picking = manufacturers.length > 0;
  const [typingMaker, setTypingMaker] = useState(() => !form.manufacturer_id && form.manufacturer.trim() !== '');
  const [typingModel, setTypingModel] = useState(() => !form.model_id && form.model.trim() !== '');
  const makerModels = models.filter((m) => m.manufacturer_id === form.manufacturer_id);
  const pickedModel = models.find((m) => m.id === form.model_id) ?? null;

  const pickMaker = (value: string) => {
    if (value === OTHER_OPTION) {
      setTypingMaker(true);
      setTypingModel(true);
      patchForm({ manufacturer_id: '', model_id: '' });
      return;
    }
    setTypingMaker(false);
    const maker = manufacturers.find((m) => m.id === value) ?? null;
    const keepModel = maker !== null && pickedModel?.manufacturer_id === maker.id;
    if (!keepModel) setTypingModel(false);
    patchForm({
      manufacturer_id: maker?.id ?? '',
      manufacturer: maker?.name ?? '',
      ...(keepModel ? {} : { model_id: '', model: '' }),
    });
  };

  // Picking a model fills in its class, capacity and interval.
  const pickModel = (value: string) => {
    if (value === OTHER_OPTION) {
      setTypingModel(true);
      patchForm({ model_id: '' });
      return;
    }
    setTypingModel(false);
    const model = makerModels.find((m) => m.id === value);
    if (!model) {
      patchForm({ model_id: '', model: '' });
      return;
    }
    patchForm({
      model_id: model.id,
      model: model.name,
      accuracy_class: model.accuracy_class,
      max_capacity_kg: String(model.max_capacity_kg),
      interval_e_g: String(model.interval_e_g),
    });
  };

  const modelTextDisabled = picking && !typingMaker && !form.manufacturer_id && form.model === '';

  return (
    <Card title="Instrument details" subtitle="The weighing instrument being tested.">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
        <Field label="Manufacturer" htmlFor="manufacturer">
          {picking ? (
            <>
              <Select
                id="manufacturer"
                value={form.manufacturer_id || (typingMaker ? OTHER_OPTION : '')}
                onChange={(e) => pickMaker(e.target.value)}
              >
                <option value="">Choose a manufacturer…</option>
                {manufacturers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
                <option value={OTHER_OPTION}>Other (type it in)</option>
              </Select>
              {typingMaker && (
                <Input
                  aria-label="Manufacturer name"
                  className="mt-2"
                  placeholder="Type the manufacturer's name"
                  value={form.manufacturer}
                  onChange={(e) => setField('manufacturer', e.target.value)}
                />
              )}
            </>
          ) : (
            <Input id="manufacturer" value={form.manufacturer} onChange={(e) => setField('manufacturer', e.target.value)} />
          )}
        </Field>
        <Field
          label="Model"
          htmlFor="model"
          hint={pickedModel ? 'Class, capacity and interval were filled in from this model.' : undefined}
        >
          {picking && form.manufacturer_id ? (
            <>
              <Select id="model" value={form.model_id || (typingModel ? OTHER_OPTION : '')} onChange={(e) => pickModel(e.target.value)}>
                <option value="">{makerModels.length > 0 ? 'Choose a model…' : 'No models listed for this manufacturer'}</option>
                {makerModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · class {m.accuracy_class} · {formatAmount(m.max_capacity_kg, 'kg')}
                  </option>
                ))}
                <option value={OTHER_OPTION}>Other (type it in)</option>
              </Select>
              {typingModel && (
                <Input
                  aria-label="Model name"
                  className="mt-2"
                  placeholder="Type the model name"
                  value={form.model}
                  onChange={(e) => setField('model', e.target.value)}
                />
              )}
            </>
          ) : (
            <Input
              id="model"
              value={form.model}
              disabled={modelTextDisabled}
              placeholder={modelTextDisabled ? 'Choose a manufacturer first' : undefined}
              onChange={(e) => setField('model', e.target.value)}
            />
          )}
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
