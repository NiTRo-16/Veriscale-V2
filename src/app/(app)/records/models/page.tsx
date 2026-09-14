import { Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { ModelForm } from '@/components/records/ModelForm';
import { EmptyRow, LatestReportCell, TD, TH, THEAD, TR } from '@/components/records/table';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NoAccess } from '@/components/ui/Notice';
import { PageBody, PageHeader } from '@/components/ui/PageHeader';
import { hasRole, requireSession } from '@/lib/auth';
import { formatAmount, formatCount, formatPlural } from '@/lib/format';
import { belongsToModel, latestReport, recordsHref, recordStats } from '@/lib/records';
import { loadManufacturers, loadModels, loadRecordReports } from '@/lib/records-data';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata = { title: 'Instrument models · VeriScale' };

const BASE = '/records/models';

export default async function InstrumentModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; manufacturer?: string; add?: string }>;
}) {
  const { edit, manufacturer, add } = await searchParams;
  const { profile } = await requireSession();
  if (!hasRole(profile, ['reviewer', 'admin'])) return <NoAccess />;

  const supabase = await createServerSupabase();
  const [manufacturers, models, reports] = await Promise.all([
    loadManufacturers(supabase),
    loadModels(supabase),
    loadRecordReports(supabase),
  ]);
  const makers = new Map(manufacturers.map((m) => [m.id, m]));

  const editing = models.find((m) => m.id === edit) ?? null;
  // Arriving from a manufacturer's page prefills it and returns there afterwards.
  const fromMaker = manufacturer && makers.has(manufacturer) ? manufacturer : undefined;
  const showForm = manufacturers.length > 0 && (editing !== null || Boolean(add) || Boolean(fromMaker));
  const doneHref = fromMaker ? recordsHref('/records/manufacturers', { id: fromMaker }) : BASE;

  const rows = models
    .map((model) => {
      const maker = makers.get(model.manufacturer_id);
      const mine = reports.filter((r) => belongsToModel(r, model, maker));
      return { model, maker, stats: recordStats(mine), latest: latestReport(mine) };
    })
    .sort((a, b) => (a.maker?.name ?? '').localeCompare(b.maker?.name ?? '') || a.model.name.localeCompare(b.model.name));

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Records' }, { label: 'Instrument models' }]}
        title="Instrument models"
        subtitle="The models technicians pick from, with the numbers used to work out the allowed error"
        actions={
          !showForm &&
          manufacturers.length > 0 && (
            <ButtonLink href={recordsHref(BASE, { add: '1' })} size="sm">
              <Plus size={15} /> Add model
            </ButtonLink>
          )
        }
      />
      <PageBody>
        {manufacturers.length === 0 && (
          <Card>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-[14px] font-medium text-ink">Add a manufacturer first</p>
              <p className="max-w-sm text-[13px] text-muted">Every model belongs to a manufacturer. Add one, then add its models here.</p>
              <ButtonLink href={recordsHref('/records/manufacturers', { add: '1' })} size="sm">
                <Plus size={15} /> Add manufacturer
              </ButtonLink>
            </div>
          </Card>
        )}

        {showForm && (
          <ModelForm
            key={editing?.id ?? `new-${fromMaker ?? ''}`}
            manufacturers={manufacturers}
            model={editing}
            defaultManufacturerId={fromMaker}
            doneHref={doneHref}
          />
        )}

        {manufacturers.length > 0 && (
          <Card
            title="All models"
            actions={<span className="text-[12px] text-muted">{formatPlural(rows.length, 'model')}</span>}
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-[13px]">
                <thead className={THEAD}>
                  <tr>
                    <th className={TH}>Model</th>
                    <th className={TH}>Manufacturer</th>
                    <th className={TH}>Class</th>
                    <th className={`${TH} text-right`}>Max capacity</th>
                    <th className={`${TH} text-right`}>Interval e</th>
                    <th className={`${TH} text-right`}>Reports</th>
                    <th className={`${TH} text-right`}>Passed</th>
                    <th className={TH}>Latest report</th>
                    <th className={TH}>
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ model, maker, stats, latest }) => (
                    <tr key={model.id} className={TR}>
                      <td className={`${TD} font-medium text-ink`}>{model.name}</td>
                      <td className={TD}>
                        {maker ? (
                          <Link href={recordsHref('/records/manufacturers', { id: maker.id })} className="text-ink-soft hover:text-ink hover:underline">
                            {maker.name}
                          </Link>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className={`${TD} text-ink-soft`}>Class {model.accuracy_class}</td>
                      <td className={`${TD} text-right font-mono text-ink-soft`}>{formatAmount(model.max_capacity_kg, 'kg')}</td>
                      <td className={`${TD} text-right font-mono text-ink-soft`}>{formatAmount(model.interval_e_g, 'g')}</td>
                      <td className={`${TD} text-right font-mono text-ink-soft`}>{formatCount(stats.reports)}</td>
                      <td className={`${TD} text-right text-ink-soft`}>{stats.passedPct === null ? '—' : `${stats.passedPct}%`}</td>
                      <td className={TD}>
                        <LatestReportCell report={latest} />
                      </td>
                      <td className={`${TD} text-right`}>
                        <Link
                          href={recordsHref(BASE, { edit: model.id })}
                          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-soft hover:text-ink"
                        >
                          <Pencil size={13} /> Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && <EmptyRow colSpan={9}>No models yet. Add the models your technicians test.</EmptyRow>}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </PageBody>
    </>
  );
}
