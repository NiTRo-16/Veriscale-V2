import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { Pill, ResultText, StatusPill } from '@/components/ui/Pill';
import { calculateReading } from '@/lib/calc';
import { formatAllowed, formatDate, formatDateTime, formatGrams, formatKg } from '@/lib/format';
import { ACCURACY_CLASS_OPTIONS, SOURCE_LABEL, TEST_STAGE_LABEL } from '@/lib/labels';
import type { AllowedErrorRule, ConditionSource, FullReport, LiveResult } from '@/lib/types';

function Item({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-3' : ''}>
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-0.5 text-[14px] font-medium text-ink">{children ?? '—'}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">{title}</h3>
      {children}
    </section>
  );
}

const SOURCE_TONE: Record<ConditionSource, 'green' | 'gray' | 'amber'> = { sensor: 'green', manual: 'gray', weather: 'amber' };

function Condition({ value, unit, source }: { value: number | null; unit: string; source: ConditionSource | null }) {
  if (value === null) return <span className="text-faint">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono tabular">
        {value} {unit}
      </span>
      {source && <Pill tone={SOURCE_TONE[source]}>{SOURCE_LABEL[source]}</Pill>}
    </span>
  );
}

const text = (v: string | null) => (v && v.trim() ? v : null);

/** Read-only report. `rules` is only needed for drafts, whose results aren't stored yet. */
export function ReportView({ full, rules, photos }: { full: FullReport; rules?: AllowedErrorRule[]; photos?: ReactNode }) {
  const { report, readings, people } = full;
  const classLabel = ACCURACY_CLASS_OPTIONS.find((c) => c.value === report.accuracy_class)?.label;
  const isDraft = report.status === 'draft';

  const rows = readings.map((r) => {
    if (!isDraft) return { reading: r, errorG: r.error_g, allowedErrorG: r.allowed_error_g, result: r.result as LiveResult | null };
    const live = rules
      ? calculateReading({ ...report, load_kg: r.load_kg, reference_kg: r.reference_kg, indicated_kg: r.indicated_kg }, rules)
      : { errorG: null, allowedErrorG: null, result: null };
    return { reading: r, ...live };
  });

  return (
    <Card bodyClassName="flex flex-col gap-5 p-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wide text-green-ink">Test report</div>
          <h2 className="mt-1 text-[20px] font-semibold text-ink">Non-automatic weighing instrument · OIML R 76</h2>
          <div className="mt-1 font-mono text-[13px] text-muted">{report.report_no}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusPill status={report.status} />
          {report.calculated_result && (
            <span className="text-[12px] text-muted">
              Readings result: <ResultText result={report.calculated_result} />
            </span>
          )}
        </div>
      </header>

      {isDraft && (
        <p className="rounded-lg bg-hover px-3 py-2 text-[12.5px] text-ink-soft">
          This report is still a draft by {people[report.created_by] ?? 'another user'}. Results below are worked out live and may change.
        </p>
      )}

      <Section title="Instrument">
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Item label="Manufacturer">{text(report.manufacturer)}</Item>
          <Item label="Model">{text(report.model)}</Item>
          <Item label="Serial number">
            {report.serial_number ? <span className="font-mono">{report.serial_number}</span> : null}
          </Item>
          <Item label="Accuracy class">{classLabel ?? null}</Item>
          <Item label="Maximum capacity">
            {report.max_capacity_kg !== null ? <span className="font-mono">{report.max_capacity_kg} kg</span> : null}
          </Item>
          <Item label="Verification interval (e)">
            {report.interval_e_g !== null ? <span className="font-mono">{report.interval_e_g} g</span> : null}
          </Item>
          <Item label="Indicator type">{text(report.indicator_type)}</Item>
          <Item label="Power source">{text(report.power_source)}</Item>
          <Item label="Test stage">{TEST_STAGE_LABEL[report.test_stage]}</Item>
        </div>
      </Section>

      <Section title="Test conditions">
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Item label="Temperature">
            <Condition value={report.temperature_c} unit="°C" source={report.temperature_source} />
          </Item>
          <Item label="Humidity">
            <Condition value={report.humidity_pct} unit="%" source={report.humidity_source} />
          </Item>
          <Item label="Supply voltage">
            {report.voltage_v !== null ? <span className="font-mono">{report.voltage_v} V</span> : null}
          </Item>
          <Item label="Test date">{formatDate(report.test_date)}</Item>
          <Item label="Reference weights" wide>
            {text(report.reference_weights)}
          </Item>
          {text(report.remarks) && (
            <Item label="Remarks" wide>
              <span className="whitespace-pre-line font-normal">{report.remarks}</span>
            </Item>
          )}
        </div>
      </Section>

      <Section title="Readings">
        {rows.length === 0 ? (
          <p className="text-[13px] text-muted">No readings recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="bg-page text-left text-[11.5px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Test</th>
                  <th className="px-3 py-2 text-right font-medium">Load (kg)</th>
                  <th className="px-3 py-2 text-right font-medium">Reference (kg)</th>
                  <th className="px-3 py-2 text-right font-medium">Indicated (kg)</th>
                  <th className="px-3 py-2 text-right font-medium">Error</th>
                  <th className="px-3 py-2 text-right font-medium">Allowed error</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ reading, errorG, allowedErrorG, result }) => (
                  <tr key={reading.id} className="border-t border-line">
                    <td className="px-3 py-2">
                      {reading.test_type} <span className="text-muted">· {reading.clause}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular">{formatKg(reading.load_kg)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular">{formatKg(reading.reference_kg)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular">{formatKg(reading.indicated_kg)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular">{formatGrams(errorG)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular">{formatAllowed(allowedErrorG)}</td>
                    <td className="px-3 py-2">
                      <ResultText result={result} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {photos}

      <Section title="People and dates">
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Item label="Tested by">
            {people[report.created_by] ?? 'Unknown'}
            <div className="text-[12px] font-normal text-muted">Created {formatDateTime(report.created_at)}</div>
          </Item>
          <Item label="Submitted">{report.submitted_at ? formatDateTime(report.submitted_at) : null}</Item>
          <Item label={report.status === 'failed' ? 'Failed by' : 'Approved by'}>
            {report.reviewed_by ? (
              <>
                {people[report.reviewed_by] ?? 'Unknown'}
                <div className="text-[12px] font-normal text-muted">{formatDateTime(report.reviewed_at)}</div>
              </>
            ) : null}
          </Item>
          {text(report.review_note) && (
            <Item label="Reviewer's note" wide>
              <span className="whitespace-pre-line font-normal">{report.review_note}</span>
            </Item>
          )}
        </div>
      </Section>
    </Card>
  );
}
