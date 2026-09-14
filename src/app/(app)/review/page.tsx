import { AlertTriangle, ChevronRight, CircleCheck, Clock, CornerUpLeft, PenLine } from 'lucide-react';
import Link from 'next/link';
import { DecisionsTable, TABLE_HEAD } from '@/components/review/DecisionsTable';
import { WaitingBars } from '@/components/review/WaitingBars';
import { Avatar } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AccountNotReady, NoAccess } from '@/components/ui/Notice';
import { PageBody, PageHeader } from '@/components/ui/PageHeader';
import { DecisionPill, ResultText, RiskPill, SourcePill } from '@/components/ui/Pill';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { StatTile } from '@/components/ui/StatTile';
import { requireSession } from '@/lib/auth';
import { daysWaiting, REVIEW_TARGET_DAYS, waitingBuckets } from '@/lib/dashboard';
import { formatDateTime } from '@/lib/format';
import { TEST_STAGE_LABEL } from '@/lib/labels';
import { decisionEntries, mainSource, tallyReadings, tallyText, thisWeekVsLast, waitingText } from '@/lib/review';
import { loadMyDecisionReports, loadNames, loadSentBack, loadWaiting, type QueueItem, type ReviewListItem } from '@/lib/review-data';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata = { title: 'Review queue · VeriScale' };

const TAB_VALUES = ['waiting', 'sent-back', 'decided'] as const;
type Tab = (typeof TAB_VALUES)[number];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { profile } = await requireSession();
  if (!profile) return <AccountNotReady />;
  if (profile.role !== 'reviewer' && profile.role !== 'admin') return <NoAccess />;

  const { tab: rawTab } = await searchParams;
  const tab: Tab = TAB_VALUES.find((t) => t === rawTab) ?? 'waiting';
  const sb = await createServerSupabase();
  const now = new Date();

  const [waiting, sentBack, decisionReports] = await Promise.all([
    loadWaiting(sb),
    loadSentBack(sb),
    loadMyDecisionReports(sb, profile.id),
  ]);
  const names = await loadNames(sb, sentBack.items.map((r) => r.sent_back_by));
  const decisions = decisionEntries(decisionReports, profile.id);
  const week = thisWeekVsLast(decisions.map((d) => d.at), now);
  const weekChange = week.thisWeek - week.lastWeek;

  const days = (r: QueueItem) => (r.submitted_at ? daysWaiting(r.submitted_at, now) : 0);
  const oldest = waiting.items[0];
  const submittedToday = waiting.items.filter((r) => days(r) <= 0).length;
  const pastTarget = waiting.items.filter((r) => days(r) > REVIEW_TARGET_DAYS).length;
  const buckets = waitingBuckets(waiting.items.flatMap((r) => (r.submitted_at ? [r.submitted_at] : [])), now);

  const tabs = [
    { label: 'Waiting', value: 'waiting', count: waiting.total },
    { label: 'Sent back', value: 'sent-back', count: sentBack.total },
    { label: 'Decided by me', value: 'decided', count: decisions.length },
  ];
  const shown = tab === 'waiting' ? waiting.items.length : tab === 'sent-back' ? sentBack.items.length : Math.min(decisions.length, 50);
  const total = tab === 'waiting' ? waiting.total : tab === 'sent-back' ? sentBack.total : decisions.length;

  return (
    <>
      <PageHeader
        title="Review queue"
        subtitle="Reports waiting for a decision, oldest first"
        actions={
          oldest ? (
            <ButtonLink href={`/reports/${oldest.id}`}>
              <PenLine size={15} strokeWidth={1.75} /> Start next review
            </ButtonLink>
          ) : undefined
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Waiting for review"
            value={waiting.total}
            icon={PenLine}
            iconClassName="border-amber-soft text-amber-ink"
            sub={`${submittedToday} submitted today`}
          />
          <StatTile
            label="Oldest waiting"
            value={oldest ? waitingText(days(oldest)) : '—'}
            icon={Clock}
            iconClassName={oldest && days(oldest) > REVIEW_TARGET_DAYS ? 'border-amber-soft text-amber-ink' : undefined}
            href={oldest ? `/reports/${oldest.id}` : undefined}
            sub={oldest ? `${oldest.report_no} · ${oldest.model || 'Untitled report'}` : 'Nothing is waiting'}
          />
          <StatTile
            label="Reviewed by you this week"
            value={week.thisWeek}
            icon={CircleCheck}
            iconClassName="border-green-soft text-green-ink"
            href="/review/decisions"
            sub={
              weekChange === 0 ? (
                'Same as last week'
              ) : (
                <span className={weekChange > 0 ? 'text-green-ink' : 'text-muted'}>
                  {weekChange > 0 ? '+' : ''}
                  {weekChange} vs last week
                </span>
              )
            }
          />
          <StatTile
            label="Sent back for changes"
            value={sentBack.total}
            icon={CornerUpLeft}
            href="/review?tab=sent-back"
            sub="Waiting on technicians"
          />
        </div>

        <Card bodyClassName="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <SegmentedTabs tabs={tabs} active={tab} basePath="/review" />
            {tab === 'waiting' && pastTarget > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-amber-ink">
                <AlertTriangle size={14} /> {plural(pastTarget, 'report is', 'reports are')} past the {REVIEW_TARGET_DAYS}-day target
              </span>
            )}
          </div>
          {tab === 'waiting' && <WaitingTable items={waiting.items} days={days} />}
          {tab === 'sent-back' && <SentBackTable items={sentBack.items} names={names} />}
          {tab === 'decided' && (
            <DecisionsTable entries={decisions.slice(0, 50)} empty="You haven't decided any reports yet." />
          )}
          {total > 0 && (
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[12px] text-muted">
              <span>
                Showing {shown} of {plural(total, 'report', 'reports')}
              </span>
              {tab === 'decided' && decisions.length > 50 && (
                <Link href="/review/decisions" className="font-medium text-ink-soft hover:text-ink">
                  View all
                </Link>
              )}
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card
            title="Your recent decisions"
            actions={
              <ButtonLink href="/review/decisions" variant="secondary" size="sm">
                View all
              </ButtonLink>
            }
            bodyClassName="p-3"
          >
            {decisions.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted">Reports you approve, fail or send back will show here.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {decisions.slice(0, 5).map(({ report, kind, at, note }) => (
                  <li key={`${report.id}-${kind}`}>
                    <Link
                      href={`/reports/${report.id}`}
                      className="group flex items-center gap-3 rounded-[10px] border border-transparent px-3 py-2.5 hover:border-line hover:bg-card hover:shadow-[0_4px_14px_rgba(16,24,40,0.08)]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-ink">
                          {report.report_no} · {report.model || 'Untitled report'}
                        </span>
                        <span className="block truncate text-[12px] text-muted">
                          {formatDateTime(at)}
                          {note ? ` · “${note}”` : ''}
                        </span>
                      </span>
                      <DecisionPill decision={kind} />
                      <ChevronRight size={16} className="shrink-0 text-faint group-hover:text-ink" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="How long reports have waited" subtitle={`Target: a decision within ${REVIEW_TARGET_DAYS} days`}>
            <WaitingBars buckets={buckets} />
            {pastTarget > 0 && (
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-soft px-3 py-2 text-[12.5px] text-amber-ink">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                {plural(pastTarget, 'report is', 'reports are')} past the {REVIEW_TARGET_DAYS}-day target
              </p>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}

function ReportCell({ report }: { report: ReviewListItem }) {
  return (
    <td className="px-5 py-3">
      <Link href={`/reports/${report.id}`} className="font-mono font-medium text-ink hover:text-green-ink">
        {report.report_no}
      </Link>
      <div className="text-[12px] text-muted">{TEST_STAGE_LABEL[report.test_stage]}</div>
    </td>
  );
}

function InstrumentCell({ report }: { report: ReviewListItem }) {
  return (
    <td className="px-5 py-3">
      <div className="font-medium text-ink">{report.model || 'Untitled report'}</div>
      <div className="text-[12px] text-muted">
        {report.manufacturer || '—'} · <span className="font-mono">{report.serial_number || '—'}</span>
      </div>
    </td>
  );
}

function PersonCell({ name }: { name: string }) {
  return (
    <td className="px-5 py-3">
      <span className="flex items-center gap-2 text-ink-soft">
        <Avatar name={name} />
        <span className="truncate">{name}</span>
      </span>
    </td>
  );
}

function WaitingTable({ items, days }: { items: QueueItem[]; days: (r: QueueItem) => number }) {
  if (items.length === 0) {
    return <div className="px-5 py-12 text-center text-[13px] text-muted">Nothing is waiting for review. Nice work.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] text-[13px]">
        <thead className={TABLE_HEAD}>
          <tr>
            <th className="px-5 py-2.5">Report</th>
            <th className="px-5 py-2.5">Instrument</th>
            <th className="px-5 py-2.5">Class</th>
            <th className="px-5 py-2.5">Calculated result</th>
            <th className="px-5 py-2.5">Risk</th>
            <th className="px-5 py-2.5">Evidence</th>
            <th className="px-5 py-2.5">Tested by</th>
            <th className="px-5 py-2.5 text-right">Waiting</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => {
            const waited = days(r);
            const source = mainSource(r.temperature_source, r.humidity_source);
            return (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-page">
                <ReportCell report={r} />
                <InstrumentCell report={r} />
                <td className="whitespace-nowrap px-5 py-3 text-ink-soft">Class {r.accuracy_class ?? '—'}</td>
                <td className="px-5 py-3">
                  <ResultText result={r.calculated_result} />
                  <div className="text-[12px] text-muted">{tallyText(tallyReadings(r.results))}</div>
                </td>
                <td className="px-5 py-3">
                  <RiskPill risk={r.risk} />
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-soft">{plural(r.photo_count, 'photo', 'photos')}</span>
                    {source && <SourcePill source={source} />}
                  </div>
                </td>
                <PersonCell name={r.creator_name} />
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <span
                      className={`whitespace-nowrap ${waited > REVIEW_TARGET_DAYS ? 'font-medium text-amber-ink' : 'text-ink-soft'}`}
                    >
                      {waitingText(waited)}
                    </span>
                    <ButtonLink href={`/reports/${r.id}`} variant="secondary" size="sm">
                      Review
                    </ButtonLink>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SentBackTable({ items, names }: { items: ReviewListItem[]; names: Record<string, string> }) {
  if (items.length === 0) {
    return <div className="px-5 py-12 text-center text-[13px] text-muted">No reports are waiting on changes.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-[13px]">
        <thead className={TABLE_HEAD}>
          <tr>
            <th className="px-5 py-2.5">Report</th>
            <th className="px-5 py-2.5">Instrument</th>
            <th className="px-5 py-2.5">Note to the technician</th>
            <th className="px-5 py-2.5">Tested by</th>
            <th className="px-5 py-2.5">Sent back</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} className="border-b border-line align-top last:border-0 hover:bg-page">
              <ReportCell report={r} />
              <InstrumentCell report={r} />
              <td className="max-w-[300px] px-5 py-3 text-[12.5px] text-ink-soft">
                {r.send_back_note ? <span className="line-clamp-2 whitespace-pre-line">{r.send_back_note}</span> : '—'}
              </td>
              <PersonCell name={r.creator_name} />
              <td className="px-5 py-3">
                <div className="whitespace-nowrap font-mono text-[12.5px] text-ink-soft">{formatDateTime(r.sent_back_at)}</div>
                <div className="text-[12px] text-muted">by {(r.sent_back_by && names[r.sent_back_by]) || 'a reviewer'}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
