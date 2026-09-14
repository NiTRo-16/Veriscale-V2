import { AlertTriangle, CalendarClock, CircleCheck, Pencil, Plus, Weight } from 'lucide-react';
import Link from 'next/link';
import { CheckSchedule, CheckScheduleLegend } from '@/components/records/CheckSchedule';
import { EmptyRow, TD, TH, THEAD, TR } from '@/components/records/table';
import { WeightSetForm } from '@/components/records/WeightSetForm';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NoAccess } from '@/components/ui/Notice';
import { PageBody, PageHeader } from '@/components/ui/PageHeader';
import { Pill, type Tone } from '@/components/ui/Pill';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { StatTile } from '@/components/ui/StatTile';
import { hasRole, requireSession } from '@/lib/auth';
import { formatCount, formatDate } from '@/lib/format';
import { WEIGHT_STATE_LABEL } from '@/lib/labels';
import { addDays, DUE_SOON_DAYS, recordsHref, testedOn, todayDate, weightStatus, weightStatusLabel } from '@/lib/records';
import { loadRecordReports, loadWeightSets } from '@/lib/records-data';
import { createServerSupabase } from '@/lib/supabase/server';
import type { WeightState } from '@/lib/types';

export const metadata = { title: 'Reference weights · VeriScale' };

const BASE = '/records/weights';
const USED_DAYS = 30;
const TABS = ['all', 'in_date', 'due_soon', 'overdue'] as const;
type Tab = (typeof TABS)[number];

const STATE_TONE: Record<WeightState, Tone> = { in_date: 'green', due_soon: 'amber', overdue: 'red' };
const NEXT_CHECK_TEXT: Record<WeightState, string> = {
  in_date: 'text-ink-soft',
  due_soon: 'font-medium text-amber-ink',
  overdue: 'font-semibold text-red',
};

const isTab = (value: string | undefined): value is Tab => (TABS as readonly string[]).includes(value ?? '');

export default async function ReferenceWeightsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; edit?: string; add?: string }>;
}) {
  const { tab: tabParam, edit, add } = await searchParams;
  const { profile } = await requireSession();
  if (!hasRole(profile, ['reviewer', 'admin'])) return <NoAccess />;

  const supabase = await createServerSupabase();
  const [sets, reports] = await Promise.all([loadWeightSets(supabase), loadRecordReports(supabase)]);
  const today = todayDate();
  const usedSince = addDays(today, -USED_DAYS);

  // Most urgent first.
  const rows = sets
    .map((set) => ({
      set,
      status: weightStatus(set.next_check, today),
      used: reports.filter((r) => r.weight_set_id === set.id && r.status !== 'draft' && testedOn(r).slice(0, 10) >= usedSince)
        .length,
    }))
    .sort((a, b) => a.set.next_check.localeCompare(b.set.next_check) || a.set.code.localeCompare(b.set.code));

  const countOf = (state: WeightState) => rows.filter((r) => r.status.state === state).length;
  const counts: Record<Tab, number> = {
    all: rows.length,
    in_date: countOf('in_date'),
    due_soon: countOf('due_soon'),
    overdue: countOf('overdue'),
  };
  const tab: Tab = isTab(tabParam) ? tabParam : 'all';
  const shown = tab === 'all' ? rows : rows.filter((r) => r.status.state === tab);
  const overdue = rows.filter((r) => r.status.state === 'overdue');
  const editing = sets.find((s) => s.id === edit) ?? null;
  const showForm = editing !== null || Boolean(add);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Records' }, { label: 'Reference weights' }]}
        title="Reference weights"
        subtitle="The weight sets used in tests, and when each one is next due for its check"
        actions={
          !showForm && (
            <ButtonLink href={recordsHref(BASE, { add: '1' })} size="sm">
              <Plus size={15} /> Add weight set
            </ButtonLink>
          )
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Weight sets" value={counts.all} icon={Weight} href={BASE} />
          <StatTile
            label="In date"
            value={counts.in_date}
            icon={CircleCheck}
            href={recordsHref(BASE, { tab: 'in_date' })}
            iconClassName="border-green-soft bg-green-soft text-green-ink"
          />
          <StatTile
            label={`Due within ${DUE_SOON_DAYS} days`}
            value={counts.due_soon}
            icon={CalendarClock}
            href={recordsHref(BASE, { tab: 'due_soon' })}
            iconClassName="border-amber-soft bg-amber-soft text-amber-ink"
          />
          <StatTile
            label="Overdue"
            value={counts.overdue}
            sub={counts.overdue > 0 ? "Can't be used in reports" : undefined}
            icon={AlertTriangle}
            href={recordsHref(BASE, { tab: 'overdue' })}
            iconClassName="border-red-soft bg-red-soft text-red"
          />
        </div>

        {overdue.length > 0 && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-card border border-[#F4D3D0] bg-[#FCEBEA] px-4 py-3 text-[13px] text-[#8C1D17]"
          >
            <AlertTriangle size={16} className="shrink-0" />
            <p className="min-w-0 flex-1">
              <span className="font-semibold">
                {overdue.length === 1
                  ? `${overdue[0].set.code} is overdue for its check.`
                  : `${overdue.length} weight sets are overdue for their check.`}
              </span>{' '}
              Technicians can&apos;t send a report that uses an overdue set. After the check, enter the new check date.
            </p>
            <Link
              href={overdue.length === 1 ? recordsHref(BASE, { edit: overdue[0].set.id }) : recordsHref(BASE, { tab: 'overdue' })}
              className="font-semibold underline underline-offset-2"
            >
              {overdue.length === 1 ? `Update ${overdue[0].set.code}` : 'Show overdue sets'}
            </Link>
          </div>
        )}

        {showForm && <WeightSetForm key={editing?.id ?? 'new'} set={editing} doneHref={recordsHref(BASE, { tab: tab === 'all' ? undefined : tab })} />}

        <Card
          title="Weight sets"
          subtitle={`Status as of today, ${formatDate(today)}`}
          actions={
            <SegmentedTabs
              tabs={TABS.map((t) => ({ label: t === 'all' ? 'All' : WEIGHT_STATE_LABEL[t], value: t, count: counts[t] }))}
              active={tab}
              basePath={BASE}
            />
          }
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[13px]">
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Weight set</th>
                  <th className={TH}>Class</th>
                  <th className={TH}>Range</th>
                  <th className={TH}>Certificate</th>
                  <th className={TH}>Last checked</th>
                  <th className={TH}>Next check</th>
                  <th className={`${TH} text-right`}>Used · {USED_DAYS} days</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ set, status, used }) => (
                  <tr key={set.id} className={TR}>
                    <td className={TD}>
                      <div className="font-mono text-[12.5px] font-semibold text-ink">{set.code}</div>
                      {set.description && <div className="text-[12px] text-muted">{set.description}</div>}
                    </td>
                    <td className={`${TD} text-ink-soft`}>{set.weight_class}</td>
                    <td className={`${TD} text-ink-soft`}>{set.nominal_range ?? <span className="text-faint">—</span>}</td>
                    <td className={`${TD} font-mono text-[12.5px] text-ink-soft`}>
                      {set.certificate_no ?? <span className="text-faint">—</span>}
                    </td>
                    <td className={`${TD} text-ink-soft`}>{formatDate(set.last_checked)}</td>
                    <td className={`${TD} ${NEXT_CHECK_TEXT[status.state]}`}>{formatDate(set.next_check)}</td>
                    <td className={`${TD} text-right font-mono text-ink-soft`}>{formatCount(used)}</td>
                    <td className={TD}>
                      <Pill tone={STATE_TONE[status.state]}>{weightStatusLabel(status)}</Pill>
                    </td>
                    <td className={`${TD} text-right`}>
                      <Link
                        href={recordsHref(BASE, { edit: set.id, tab: tab === 'all' ? undefined : tab })}
                        className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-soft hover:text-ink"
                      >
                        <Pencil size={13} /> Edit
                      </Link>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <EmptyRow colSpan={9}>
                    {rows.length === 0 ? 'No weight sets yet. Add the sets your technicians use.' : 'No weight sets in this group.'}
                  </EmptyRow>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {rows.length > 0 && (
          <Card title="Check schedule" subtitle="Each bar runs from a set's last check to its next one." actions={<CheckScheduleLegend />}>
            <CheckSchedule rows={rows} today={today} />
          </Card>
        )}
      </PageBody>
    </>
  );
}
