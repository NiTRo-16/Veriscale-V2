import { Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ManufacturerForm } from '@/components/records/ManufacturerForm';
import { EmptyRow, LatestReportCell, TD, TH, THEAD, TR } from '@/components/records/table';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { NoAccess } from '@/components/ui/Notice';
import { PageBody, PageHeader } from '@/components/ui/PageHeader';
import { StatusPill } from '@/components/ui/Pill';
import { hasRole, requireSession } from '@/lib/auth';
import { formatAmount, formatCount, formatDate, formatPlural, initials } from '@/lib/format';
import { TEST_STAGE_LABEL } from '@/lib/labels';
import {
  belongsToManufacturer,
  belongsToModel,
  latestPerInstrument,
  latestReport,
  recordsHref,
  recordStats,
  testedOn,
  type RecordReport,
  type RecordStats,
} from '@/lib/records';
import { loadManufacturers, loadModels, loadRecordReports } from '@/lib/records-data';
import { createServerSupabase } from '@/lib/supabase/server';
import type { InstrumentModel, Manufacturer } from '@/lib/types';

export const metadata = { title: 'Manufacturers · VeriScale' };

const BASE = '/records/manufacturers';
const CHART_LIMIT = 8;
const INSTRUMENT_LIMIT = 12;

interface MakerRow {
  maker: Manufacturer;
  models: InstrumentModel[];
  reports: RecordReport[];
  stats: RecordStats;
}

export default async function ManufacturersPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; q?: string; edit?: string; add?: string }>;
}) {
  const { id, q = '', edit, add } = await searchParams;
  const { profile } = await requireSession();
  if (!hasRole(profile, ['reviewer', 'admin'])) return <NoAccess />;

  const supabase = await createServerSupabase();
  const [manufacturers, models, reports] = await Promise.all([
    loadManufacturers(supabase),
    loadModels(supabase),
    loadRecordReports(supabase),
  ]);

  const rows: MakerRow[] = manufacturers.map((maker) => {
    const mine = reports.filter((r) => belongsToManufacturer(r, maker));
    return { maker, models: models.filter((m) => m.manufacturer_id === maker.id), reports: mine, stats: recordStats(mine) };
  });
  const query = q.trim().toLowerCase();
  const shown = query ? rows.filter((r) => r.maker.name.toLowerCase().includes(query)) : rows;
  const selected = rows.find((r) => r.maker.id === id) ?? shown[0] ?? null;
  const busiest = rows
    .filter((r) => r.stats.reports > 0)
    .sort((a, b) => b.stats.reports - a.stats.reports)
    .slice(0, CHART_LIMIT);
  const most = busiest[0]?.stats.reports ?? 0;
  const hrefFor = (makerId: string, extra: Record<string, string> = {}) => recordsHref(BASE, { id: makerId, q: q || undefined, ...extra });

  let addedBy: string | null = null;
  if (selected?.maker.created_by) {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', selected.maker.created_by).maybeSingle();
    addedBy = (data?.full_name as string | undefined) ?? null;
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Records' }, { label: 'Manufacturers' }]}
        title="Manufacturers"
        subtitle="Makers and their instrument models"
        actions={
          !add && (
            <ButtonLink href={recordsHref(BASE, { add: '1' })} size="sm">
              <Plus size={15} /> Add manufacturer
            </ButtonLink>
          )
        }
      />
      <PageBody>
        {add && <ManufacturerForm key="new" cancelHref={selected ? hrefFor(selected.maker.id) : BASE} />}

        {rows.length === 0 && !add && (
          <Card>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-[14px] font-medium text-ink">No manufacturers yet</p>
              <p className="max-w-sm text-[13px] text-muted">
                Add the makers of the instruments you test. Technicians then pick them when they fill in a report.
              </p>
              <ButtonLink href={recordsHref(BASE, { add: '1' })} size="sm">
                <Plus size={15} /> Add manufacturer
              </ButtonLink>
            </div>
          </Card>
        )}

        {rows.length > 0 && (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="flex flex-col gap-4">
              <Card title="All manufacturers" subtitle={formatPlural(rows.length, 'manufacturer')} bodyClassName="p-0">
                <form action={BASE} className="border-b border-line p-3">
                  <label htmlFor="maker-search" className="sr-only">
                    Search manufacturers
                  </label>
                  <Input id="maker-search" name="q" type="search" defaultValue={q} placeholder="Search manufacturers" />
                </form>
                <ul>
                  {shown.map((row) => {
                    const active = row.maker.id === selected?.maker.id;
                    return (
                      <li key={row.maker.id} className="border-b border-line last:border-0">
                        <Link
                          href={hrefFor(row.maker.id)}
                          aria-current={active ? 'true' : undefined}
                          className={`flex items-center gap-3 px-4 py-3 ${active ? 'bg-green-soft/60' : 'hover:bg-page'}`}
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-line bg-card text-[12px] font-semibold text-ink-soft">
                            {initials(row.maker.name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium text-ink">{row.maker.name}</span>
                            <span className="block text-[12px] text-muted">
                              {formatPlural(row.models.length, 'model')} · {formatPlural(row.stats.reports, 'report')}
                            </span>
                          </span>
                          <span className="whitespace-nowrap text-[12px] font-medium text-ink-soft">
                            {row.stats.passedPct === null ? '—' : `${row.stats.passedPct}% passed`}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                  {shown.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-muted">No manufacturers match “{q}”.</li>}
                </ul>
              </Card>

              {busiest.length > 0 && (
                <Card title="Reports by manufacturer" subtitle="Reports sent for review">
                  <ul className="flex flex-col gap-2.5">
                    {busiest.map((row) => (
                      <li key={row.maker.id}>
                        <Link
                          href={hrefFor(row.maker.id)}
                          className="grid grid-cols-[112px_minmax(0,1fr)_44px] items-center gap-3 text-[12.5px]"
                          title={`${row.maker.name}: ${formatPlural(row.stats.reports, 'report')}`}
                        >
                          <span className="truncate text-ink-soft">{row.maker.name}</span>
                          <span className="h-2.5 rounded-full bg-page">
                            <span
                              className="block h-full rounded-full bg-green-light"
                              style={{ width: `${Math.max(3, (row.stats.reports / most) * 100)}%` }}
                            />
                          </span>
                          <span className="text-right font-mono text-ink">{formatCount(row.stats.reports)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>

            {selected && (
              <div className="flex min-w-0 flex-col gap-4">
                {edit && <ManufacturerForm key={selected.maker.id} manufacturer={selected.maker} cancelHref={hrefFor(selected.maker.id)} />}
                <ManufacturerDetail row={selected} addedBy={addedBy} editHref={hrefFor(selected.maker.id, { edit: '1' })} />
              </div>
            )}
          </div>
        )}
      </PageBody>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1.5 text-[20px] font-semibold leading-none tracking-tight text-ink">{value}</div>
      {sub && <div className="mt-1.5 text-[11.5px] text-muted">{sub}</div>}
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-3 pt-5">
      <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
      {sub && <span className="text-[12px] text-muted">{sub}</span>}
    </div>
  );
}

function ManufacturerDetail({ row, addedBy, editHref }: { row: MakerRow; addedBy: string | null; editHref: string }) {
  const { maker, models, reports, stats } = row;
  const decided = stats.approved + stats.failed;
  const modelRows = models.map((model) => {
    const mine = reports.filter((r) => belongsToModel(r, model, maker));
    return { model, count: recordStats(mine).reports, latest: latestReport(mine) };
  });
  const instruments = latestPerInstrument(reports);

  return (
    <Card bodyClassName="p-0">
      <div className="flex flex-wrap items-start gap-4 border-b border-line p-5">
        <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[12px] border border-line bg-page text-[16px] font-semibold text-ink-soft">
          {initials(maker.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[18px] font-semibold tracking-tight text-ink">{maker.name}</h2>
          <p className="mt-1 text-[12.5px] text-muted">
            Added {formatDate(maker.created_at)}
            {addedBy && ` by ${addedBy}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={editHref} variant="secondary" size="sm">
            <Pencil size={14} /> Rename
          </ButtonLink>
          <ButtonLink href={recordsHref('/records/models', { manufacturer: maker.id })} size="sm">
            <Plus size={14} /> Add model
          </ButtonLink>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-line bg-line md:grid-cols-4">
        <Stat label="Models" value={formatCount(models.length)} />
        <Stat label="Reports" value={formatCount(stats.reports)} sub="Sent for review" />
        <Stat
          label="Passed"
          value={stats.passedPct === null ? '—' : `${stats.passedPct}%`}
          sub={decided > 0 ? `${formatCount(stats.approved)} of ${formatCount(decided)} decided` : 'No decisions yet'}
        />
        <Stat label="Last tested" value={stats.lastTested ? formatDate(stats.lastTested) : '—'} />
      </div>

      <SectionTitle title="Models" sub={formatPlural(models.length, 'model')} />
      <div className="overflow-x-auto border-b border-line">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead className={THEAD}>
            <tr>
              <th className={TH}>Model</th>
              <th className={`${TH} text-right`}>Max capacity</th>
              <th className={`${TH} text-right`}>Interval e</th>
              <th className={`${TH} text-right`}>Reports</th>
              <th className={TH}>Latest report</th>
              <th className={TH}>Status</th>
              <th className={TH}>
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {modelRows.map(({ model, count, latest }) => (
              <tr key={model.id} className={TR}>
                <td className={TD}>
                  <div className="font-medium text-ink">{model.name}</div>
                  <div className="text-[12px] text-muted">Class {model.accuracy_class}</div>
                </td>
                <td className={`${TD} text-right font-mono text-ink-soft`}>{formatAmount(model.max_capacity_kg, 'kg')}</td>
                <td className={`${TD} text-right font-mono text-ink-soft`}>{formatAmount(model.interval_e_g, 'g')}</td>
                <td className={`${TD} text-right font-mono text-ink-soft`}>{formatCount(count)}</td>
                <td className={TD}>
                  <LatestReportCell report={latest} />
                </td>
                <td className={TD}>{latest ? <StatusPill status={latest.status} /> : <span className="text-[12px] text-muted">No reports</span>}</td>
                <td className={`${TD} text-right`}>
                  <Link
                    href={recordsHref('/records/models', { edit: model.id, manufacturer: maker.id })}
                    className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-soft hover:text-ink"
                  >
                    <Pencil size={13} /> Edit
                  </Link>
                </td>
              </tr>
            ))}
            {modelRows.length === 0 && <EmptyRow colSpan={7}>No models yet. Add the models of this maker that you test.</EmptyRow>}
          </tbody>
        </table>
      </div>

      <SectionTitle
        title="Instruments tested"
        sub={
          instruments.length > INSTRUMENT_LIMIT
            ? `Latest ${INSTRUMENT_LIMIT} of ${formatCount(instruments.length)}`
            : 'Latest report for each serial number'
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead className={THEAD}>
            <tr>
              <th className={TH}>Serial number</th>
              <th className={TH}>Model</th>
              <th className={TH}>Latest report</th>
              <th className={TH}>Stage</th>
              <th className={TH}>Tested</th>
              <th className={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {instruments.slice(0, INSTRUMENT_LIMIT).map(({ serial, report, count }) => (
              <tr key={report.id} className={TR}>
                <td className={TD}>
                  <span className="font-mono text-[12.5px] text-ink">{serial}</span>
                  {count > 1 && <span className="ml-1.5 text-[12px] text-muted">· {formatPlural(count, 'report')}</span>}
                </td>
                <td className={`${TD} text-ink-soft`}>{report.model ?? <span className="text-faint">—</span>}</td>
                <td className={TD}>
                  <Link href={`/reports/${report.id}`} className="font-mono text-[12.5px] font-medium text-ink hover:underline">
                    {report.report_no}
                  </Link>
                </td>
                <td className={`${TD} text-ink-soft`}>{TEST_STAGE_LABEL[report.test_stage]}</td>
                <td className={`${TD} text-ink-soft`}>{formatDate(testedOn(report))}</td>
                <td className={TD}>
                  <StatusPill status={report.status} />
                </td>
              </tr>
            ))}
            {instruments.length === 0 && <EmptyRow colSpan={6}>No reports for this manufacturer yet.</EmptyRow>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
