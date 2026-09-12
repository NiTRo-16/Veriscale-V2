'use client';

import { AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { deleteDraft, saveDraftFields, saveReadings, submitReport } from '@/app/(app)/reports/actions';
import { calculateReading, reportResult } from '@/lib/calc';
import { submitProblems } from '@/lib/readiness';
import type { AllowedErrorRule, FullReport } from '@/lib/types';
import type { WeatherEstimate } from '@/lib/weather';
import { ConditionsSection } from './ConditionsSection';
import { readingsToDrafts, reportToForm, type DraftForm, type ReadingDraftRow, type SetField } from './draft-form';
import { InstrumentSection } from './InstrumentSection';
import { PhotosSection } from './PhotosSection';
import { ReadingsTable } from './ReadingsTable';
import type { PhotoWithUrl } from './ReportPhotos';
import { SensorButton } from './SensorButton';
import { SubmitBar } from './SubmitBar';
import { useAutosave, type SaveStatus } from './useAutosave';
import { WeatherButton } from './WeatherButton';

const STATUS_ORDER: SaveStatus[] = ['failed', 'retrying', 'saving', 'saved'];
const SOURCE_KEY = { temperature_c: 'temperature_source', humidity_pct: 'humidity_source' } as const;

export function DraftEditor({
  initial,
  rules,
  photos,
}: {
  initial: FullReport;
  rules: AllowedErrorRule[];
  photos: PhotoWithUrl[];
}) {
  const router = useRouter();
  const reportId = initial.report.id;
  const [form, setForm] = useState<DraftForm>(() => reportToForm(initial.report));
  const [readings, setReadings] = useState<ReadingDraftRow[]>(() => readingsToDrafts(initial.readings));
  const [conditionsMessage, setConditionsMessage] = useState<string | null>(null);
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
    setForm((f) => ({ ...f, [key]: value, [SOURCE_KEY[key]]: value.trim() === '' ? null : 'manual', weather_confirmed: false }));
  }, []);

  // Sensor values are rounded (0.1 °C, 1 %) and ignored when unchanged, so a
  // sensor that updates every second doesn't keep postponing autosave.
  const applySensor = useCallback((key: 'temperature_c' | 'humidity_pct', raw: number) => {
    const value = key === 'temperature_c' ? (Math.round(raw * 10) / 10).toFixed(1) : String(Math.round(raw));
    setForm((f) => (f[key] === value && f[SOURCE_KEY[key]] === 'sensor' ? f : { ...f, [key]: value, [SOURCE_KEY[key]]: 'sensor' }));
  }, []);
  const onSensorTemperature = useCallback((c: number) => applySensor('temperature_c', c), [applySensor]);
  const onSensorHumidity = useCallback((p: number) => applySensor('humidity_pct', p), [applySensor]);

  const applyWeather = useCallback((estimate: WeatherEstimate) => {
    setForm((f) => ({
      ...f,
      temperature_c: estimate.temperatureC.toFixed(1),
      temperature_source: 'weather',
      humidity_pct: String(estimate.humidityPct),
      humidity_source: 'weather',
      weather_confirmed: false,
    }));
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
      <ConditionsSection
        form={form}
        setField={setField}
        setCondition={setCondition}
        actions={
          <>
            <SensorButton onTemperature={onSensorTemperature} onHumidity={onSensorHumidity} onError={setConditionsMessage} />
            <WeatherButton onEstimate={applyWeather} onError={setConditionsMessage} />
          </>
        }
        notice={
          conditionsMessage ? (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-soft px-3 py-2 text-[12.5px] text-red">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {conditionsMessage}
            </p>
          ) : null
        }
      />
      <ReadingsTable form={form} readings={readings} calcs={calcs} setReadings={setReadings} />
      <PhotosSection reportId={reportId} initialPhotos={photos} readings={readings} beforeUpload={readingsSave.flush} />
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
