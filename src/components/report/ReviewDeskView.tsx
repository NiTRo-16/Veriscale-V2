import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Pill, ResultText, SourcePill, StatusPill } from '@/components/ui/Pill';
import { daysWaiting, REVIEW_TARGET_DAYS } from '@/lib/dashboard';
import { formatAllowed, formatDate, formatDateTime, formatGrams, formatKg } from '@/lib/format';
import { ACCURACY_CLASS_OPTIONS, PHOTO_KIND_LABEL, RESULT_LABEL, TEST_STAGE_LABEL } from '@/lib/labels';
import {
  automaticChecks,
  NEAR_LIMIT_PCT,
  reportHistory,
  shareOfLimit,
  tallyReadings,
  waitingText,
  type HistoryStep,
} from '@/lib/review';
import type { ReviewListItem } from '@/lib/review-data';
import type { ConditionSource, FullReport } from '@/lib/types';
import { readingLabel, type PhotoWithUrl } from './ReportPhotos';
import { ReviewDesk } from './ReviewDesk';

function Detail({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  const empty = children === null || children === undefined || children === '';
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[13.5px] font-medium text-ink">{empty ? <span className="text-faint">—</span> : children}</dd>
    </div>
  );
}

function Condition({ value, unit, source }: { value: number | null; unit: string; source: ConditionSource | null }) {
  if (value === null) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono tabular">
        {value} {unit}
      </span>
      {source && <SourcePill source={source} />}
    </span>
  );
}

function LimitBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-faint">—</span>;
  const color = pct > 100 ? 'bg-red' : pct >= NEAR_LIMIT_PCT ? 'bg-amber' : 'bg-green';
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-hover">
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </span>
      <span className="w-10 text-right font-mono text-[12px] tabular text-ink-soft">{pct}%</span>
    </span>
  );
}

const DOT: Record<HistoryStep['tone'], string> = {
  green: 'bg-green',
  amber: 'bg-amber',
  red: 'bg-red',
  gray: 'bg-line-strong',
};

/** Everything a reviewer needs to decide a pending report, on one screen. */
export function ReviewDeskView({
  full,
  photos,
  earlier,
  nextHref,
}: {
  full: FullReport;
  photos: PhotoWithUrl[];
  earlier: ReviewListItem[];
  nextHref: string;
}) {
  const { report, readings, people } = full;
  const now = new Date();
  const technician = people[report.created_by] ?? 'The technician';
  const waited = report.submitted_at ? daysWaiting(report.submitted_at, now) : 0;
  const classOption = ACCURACY_CLASS_OPTIONS.find((c) => c.value === report.accuracy_class);
  const tally = tallyReadings(readings.map((r) => r.result));
  const shares = readings.map((r) => shareOfLimit(r.error_g, r.allowed_error_g));
  const nearLimit = readings.filter((r, i) => r.result === 'pass' && (shares[i] ?? 0) >= NEAR_LIMIT_PCT).length;
  const checks = automaticChecks(report, readings, photos.map((p) => p.kind));
  const history = reportHistory(report, people);

  const resultDetail =
    tally.total === 0
      ? 'No readings recorded'
      : tally.over > 0
        ? `${tally.over} of ${tally.total} ${tally.total === 1 ? 'reading' : 'readings'} over allowed error`
        : `All ${tally.total} ${tally.total === 1 ? 'reading' : 'readings'} inside allowed error`;

  const summary = [
    report.manufacturer,
    report.serial_number && `Serial ${report.serial_number}`,
    report.accuracy_class && `Class ${report.accuracy_class}`,
    TEST_STAGE_LABEL[report.test_stage],
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card bodyClassName="flex flex-wrap items-start justify-between gap-5 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">{report.model || 'Untitled report'}</h1>
              <Pill tone="amber">Pending review</Pill>
            </div>
            <p className="mt-1 text-[13px] text-muted">{summary}</p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <dt className="text-[12px] text-muted">Tested by</dt>
              <dd className="mt-1 flex items-center gap-2 text-[13px] font-medium text-ink">
                <Avatar name={technician} size={24} />
                {technician}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">Submitted</dt>
              <dd className="mt-1 font-mono text-[13px] text-ink">{formatDateTime(report.submitted_at)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">Waiting</dt>
              <dd className={`mt-1 text-[13px] font-medium ${waited > REVIEW_TARGET_DAYS ? 'text-amber-ink' : 'text-ink'}`}>
                {waitingText(waited)}
              </dd>
            </div>
          </dl>
        </Card>

        <Card
          title="Readings"
          subtitle="Error and allowed error worked out by VeriScale"
          actions={
            report.calculated_result && (
              <Pill tone={report.calculated_result === 'pass' ? 'green' : 'red'}>
                {RESULT_LABEL[report.calculated_result]} ·{' '}
                {tally.over > 0 ? `${tally.over} of ${tally.total} over limit` : `${tally.inside} of ${tally.total} inside limit`}
              </Pill>
            )
          }
          bodyClassName="p-0"
        >
          {readings.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted">No readings recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead className="border-b border-line bg-page text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
                  <tr>
                    <th className="px-5 py-2.5">Test</th>
                    <th className="px-3 py-2.5 text-right">Reference (kg)</th>
                    <th className="px-3 py-2.5 text-right">Indicated (kg)</th>
                    <th className="px-3 py-2.5 text-right">Error</th>
                    <th className="px-3 py-2.5 text-right">Allowed</th>
                    <th className="px-3 py-2.5">Use of limit</th>
                    <th className="px-5 py-2.5">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r, i) => (
                    <tr key={r.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-2.5">
                        <div className="font-medium text-ink">{r.test_type}</div>
                        <div className="text-[12px] text-muted">
                          {[r.clause, r.load_kg !== null && `${r.load_kg} kg load`].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular">{formatKg(r.reference_kg)}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular">{formatKg(r.indicated_kg)}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular">{formatGrams(r.error_g)}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular text-ink-soft">{formatAllowed(r.allowed_error_g)}</td>
                      <td className="px-3 py-2.5">
                        <LimitBar pct={shares[i]} />
                      </td>
                      <td className="px-5 py-2.5">
                        <ResultText result={r.result} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {nearLimit > 0 && (
            <p className="m-4 mt-0 flex items-start gap-2 rounded-lg bg-amber-soft px-3 py-2 text-[12.5px] text-amber-ink">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {nearLimit === 1 ? '1 reading uses' : `${nearLimit} readings use`} {NEAR_LIMIT_PCT}% or more of the allowed error. Compare{' '}
              {nearLimit === 1 ? 'it' : 'them'} with the display photo before deciding.
            </p>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Instrument">
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
              <Detail label="Manufacturer">{report.manufacturer}</Detail>
              <Detail label="Model">{report.model}</Detail>
              <Detail label="Serial number" wide>
                {report.serial_number && <span className="font-mono">{report.serial_number}</span>}
              </Detail>
              <Detail label="Accuracy class">{classOption?.label.replace(' — ', ' · ')}</Detail>
              <Detail label="Maximum capacity">
                {report.max_capacity_kg !== null && <span className="font-mono">{report.max_capacity_kg} kg</span>}
              </Detail>
              <Detail label="Interval e">
                {report.interval_e_g !== null && <span className="font-mono">{report.interval_e_g} g</span>}
              </Detail>
              <Detail label="Indicator">{report.indicator_type}</Detail>
              <Detail label="Power">{report.power_source}</Detail>
            </dl>
          </Card>

          <Card title="Test conditions">
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
              <Detail label="Temperature">
                <Condition value={report.temperature_c} unit="°C" source={report.temperature_source} />
              </Detail>
              <Detail label="Humidity">
                <Condition value={report.humidity_pct} unit="%" source={report.humidity_source} />
              </Detail>
              <Detail label="Supply voltage">
                {report.voltage_v !== null && <span className="font-mono">{report.voltage_v} V</span>}
              </Detail>
              <Detail label="Test date">{report.test_date && formatDate(report.test_date)}</Detail>
              <Detail label="Reference weights" wide>
                {report.reference_weights?.trim() || null}
              </Detail>
              {report.remarks?.trim() && (
                <Detail label="Remarks" wide>
                  <span className="whitespace-pre-line font-normal">{report.remarks}</span>
                </Detail>
              )}
            </dl>
          </Card>
        </div>

        <Card title="Photos" actions={<span className="text-[12px] text-muted">{photos.length} added</span>}>
          {photos.length === 0 ? (
            <p className="text-[13px] text-muted">No photos were added to this report.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo) => {
                const reading = readingLabel(readings, photo.reading_id);
                return (
                  <li key={photo.id} className="overflow-hidden rounded-[10px] border border-line bg-page">
                    {photo.url ? (
                      <a href={photo.url} target="_blank" rel="noreferrer" title="Open full size">
                        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived private links */}
                        <img src={photo.url} alt={PHOTO_KIND_LABEL[photo.kind]} className="aspect-[4/3] w-full object-cover" />
                      </a>
                    ) : (
                      <div className="grid aspect-[4/3] place-items-center text-[12px] text-muted">Photo unavailable</div>
                    )}
                    <div className="px-2.5 py-2 text-[12px]">
                      <div className="font-medium text-ink">{PHOTO_KIND_LABEL[photo.kind]}</div>
                      <div className="text-muted">
                        {reading ? `For ${reading.toLowerCase()}` : photo.taken_at ? `Taken ${formatDateTime(photo.taken_at)}` : ' '}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Report history">
          <ol className="flex flex-col gap-4">
            {history.map((step) => (
              <li key={`${step.at}-${step.text}`} className="flex gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[step.tone]}`} />
                <div className="min-w-0">
                  <div className="text-[13px] text-ink">
                    <span className="font-medium">{step.who}</span> {step.text}
                  </div>
                  <div className="font-mono text-[12px] text-muted">{formatDateTime(step.at)}</div>
                  {step.note && <p className="mt-1 whitespace-pre-line text-[12.5px] text-ink-soft">“{step.note}”</p>}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="flex flex-col gap-4 xl:sticky xl:top-20">
        <ReviewDesk
          reportId={report.id}
          calculated={report.calculated_result}
          resultDetail={resultDetail}
          autoChecks={checks}
          technicianName={technician}
          nextHref={nextHref}
        />

        <Card
          title="Earlier reports for this instrument"
          subtitle={report.serial_number ? `Same serial number ${report.serial_number}` : 'No serial number recorded'}
          bodyClassName="p-3"
        >
          {earlier.length === 0 ? (
            <p className="px-2 py-4 text-center text-[13px] text-muted">No earlier reports for this instrument.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {earlier.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/reports/${r.id}`}
                    className="flex items-center gap-3 rounded-[10px] px-3 py-2 hover:bg-page"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[13px] font-medium text-ink">{r.report_no}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {TEST_STAGE_LABEL[r.test_stage]} · {formatDate(r.submitted_at ?? r.created_at)}
                      </span>
                    </span>
                    <StatusPill status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
