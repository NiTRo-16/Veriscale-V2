'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { deleteDraft, saveDraftFields, saveReadings, submitReport } from '@/app/(app)/reports/actions';
import { calculateReading, reportResult } from '@/lib/calc';
import { submitProblems } from '@/lib/readiness';
import type { AllowedErrorRule, FullReport } from '@/lib/types';
import { ConditionsSection } from './ConditionsSection';
import { readingsToDrafts, reportToForm, type DraftForm, type ReadingDraftRow, type SetField } from './draft-form';
import { InstrumentSection } from './InstrumentSection';
import { ReadingsTable } from './ReadingsTable';
import { SubmitBar } from './SubmitBar';
import { useAutosave, type SaveStatus } from './useAutosave';

const STATUS_ORDER: SaveStatus[] = ['failed', 'retrying', 'saving', 'saved'];

export function DraftEditor({ initial, rules }: { initial: FullReport; rules: AllowedErrorRule[] }) {
  const router = useRouter();
  const reportId = initial.report.id;
  const [form, setForm] = useState<DraftForm>(() => reportToForm(initial.report));
  const [readings, setReadings] = useState<ReadingDraftRow[]>(() => readingsToDrafts(initial.readings));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [deleting, startDelete] = useTransition();

  const saveFields = useCallback(
    (value: DraftForm) => saveDraftFields(reportId, { ...value } as Record<string, unknown>),
    [reportId],
  );
  const saveRows = useCallback((value: ReadingDraftRow[]) => saveReadings(reportId, value), [reportId]);
  const fieldsSave = useAutosave(form, saveFields);
  const readingsSave = useAutosave(readings, saveRows);

  const setField: SetField = useCallback((key, value) => setForm((f) => ({ ...f, [key]: value })), []);

  // Typing a temperature or humidity makes it a typed-in value and clears any weather confirmation.
  const setCondition = useCallback((key: 'temperature_c' | 'humidity_pct', value: string) => {
    const sourceKey = key === 'temperature_c' ? 'temperature_source' : 'humidity_source';
    setForm((f) => ({ ...f, [key]: value, [sourceKey]: value.trim() === '' ? null : 'manual', weather_confirmed: false }));
  }, []);

  const calcs = useMemo(
    () =>
      readings.map((r) =>
        calculateReading(
          {
            accuracy_class: form.accuracy_class || null,
            interval_e_g: form.interval_e_g,
            test_stage: form.test_stage,
            load_kg: r.load_kg,
            reference_kg: r.reference_kg,
            indicated_kg: r.indicated_kg,
          },
          rules,
        ),
      ),
    [readings, form.accuracy_class, form.interval_e_g, form.test_stage, rules],
  );

  const problems = submitProblems({ ...form, accuracy_class: form.accuracy_class || null }, readings);
  const saveStatus = STATUS_ORDER.find((s) => s === fieldsSave.status || s === readingsSave.status) ?? 'saved';
  const saveError = fieldsSave.error ?? readingsSave.error;

  const onSubmit = () => {
    setSubmitError(null);
    startSubmit(async () => {
      const [fieldsSaved, readingsSaved] = await Promise.all([fieldsSave.flush(), readingsSave.flush()]);
      if (!fieldsSaved || !readingsSaved) {
        setSubmitError("Your latest changes haven't saved yet. Please wait a moment and try again.");
        return;
      }
      const result = await submitReport(reportId);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!window.confirm("Delete this draft and its photos? This can't be undone.")) return;
    setSubmitError(null);
    startDelete(async () => {
      const result = await deleteDraft(reportId);
      if (result && !result.ok) setSubmitError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <InstrumentSection form={form} setField={setField} />
      <ConditionsSection form={form} setField={setField} setCondition={setCondition} />
      <ReadingsTable form={form} readings={readings} calcs={calcs} setReadings={setReadings} />
      <SubmitBar
        result={reportResult(calcs.map((c) => c.result))}
        problems={problems}
        saveStatus={saveStatus}
        saveError={saveError}
        submitError={submitError}
        submitting={submitting}
        deleting={deleting}
        onSubmit={onSubmit}
        onDelete={onDelete}
      />
    </div>
  );
}
