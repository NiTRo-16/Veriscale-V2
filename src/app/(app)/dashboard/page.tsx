import type { SupabaseClient } from '@supabase/supabase-js';
import { CircleCheck, CircleX, FileText, PenLine } from 'lucide-react';
import Link from 'next/link';
import { DecidedBars } from '@/components/charts/DecidedBars';
import { StatusDonut } from '@/components/charts/StatusDonut';
import { NewReportButton } from '@/components/report/NewReportButton';
import { RecentReports } from '@/components/report/RecentReports';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AccountNotReady } from '@/components/ui/Notice';
import { PageBody, PageHeader } from '@/components/ui/PageHeader';
import { Pill, ResultText, StatusPill } from '@/components/ui/Pill';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { StatTile } from '@/components/ui/StatTile';
import { requireSession } from '@/lib/auth';
import { changeVsPrevious, statusCounts, weekLabel, weeklyDecided, weeklySubmitted } from '@/lib/dashboard';
import { loadDashboardReports, loadMyDrafts, loadRecentDecisions, loadReviewQueue } from '@/lib/dashboard-data';
import { listReports } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/labels';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Profile, ReportStatus } from '@/lib/types';

export const metadata = { title: 'Dashboard · VeriScale' };

const STATUS_COLORS: Record<ReportStatus, string> = { approved: '#1f9d55', pending: '#e0a030', draft: '#2f6fdb', failed: '#b3261e' };

const isStatus = (v: unknown): v is ReportStatus => typeof v === 'string' && v in STATUS_LABEL;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { profile } = await requireSession();
  if (!profile) return <AccountNotReady />;
  const supabase = await createServerSupabase();
  const { tab } = await searchParams;

  if (profile.role === 'admin') return <AdminDashboard sb={supabase} tab={tab} />;
  if (profile.role === 'reviewer') return <ReviewerDashboard sb={supabase} />;
  return <TechnicianDashboard sb={supabase} profile={profile} />;
}

async function AdminDashboard({ sb, tab }: { sb: SupabaseClient; tab?: string }) {
  const filter = isStatus(tab) ? tab : undefined;
  const [reports, tableRows] = await Promise.all([loadDashboardReports(sb), listReports(sb, { status: filter, limit: 10 })]);
  const now = new Date();
  const counts = statusCounts(reports);
  const weekly = weeklySubmitted(reports, now, 12);
  const thisWeek = weekly[weekly.length - 1]?.count ?? 0;
  const change = changeVsPrevious(weekly.map((w) => w.count));
  const decided = weeklyDecided(reports, now, 8);
  const decidedThisWeek = decided[decided.length - 1]?.count ?? 0;

  const tabs = [
    { label: 'All', value: 'all', count: counts.all },
    { label: STATUS_LABEL.draft, value: 'draft', count: counts.draft },
    { label: STATUS_LABEL.pending, value: 'pending', count: counts.pending },
    { label: STATUS_LABEL.approved, value: 'approved', count: counts.approved },
    { label: STATUS_LABEL.failed, value: 'failed', count: counts.failed },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of all test reports"
        actions={
          counts.pending > 0 ? (
            <ButtonLink href="/review">
              <PenLine size={15} strokeWidth={1.75} /> Review {counts.pending} {counts.pending === 1 ? 'report' : 'reports'}
            </ButtonLink>
          ) : undefined
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="All reports"
            value={counts.all}
            href="/reports"
            icon={FileText}
            sub={
              change !== null ? (
                <span className={change >= 0 ? 'text-green-ink' : 'text-muted'}>
                  {change >= 0 ? '+' : ''}
                  {change}% vs last week
                </span>
              ) : (
                `${thisWeek} submitted this week`
              )
            }
          />
          <StatTile
            label="Pending"
            value={counts.pending}
            href="/review"
            icon={PenLine}
            iconClassName="border-amber-soft text-amber-ink"
            sub="Waiting for a reviewer"
          />
          <StatTile
            label="Approved"
            value={counts.approved}
            href="/reports?status=approved"
            icon={CircleCheck}
            iconClassName="border-green-soft text-green-ink"
            sub={`${decidedThisWeek} decided this week`}
          />
          <StatTile
            label="Failed"
            value={counts.failed}
            href="/reports?status=failed"
            icon={CircleX}
            iconClassName="border-red-soft text-red"
            sub="Closed as failed"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card title="Test report status" subtitle="Every report, by its current status" bodyClassName="p-5">
            <StatusDonut
              title="Reports by status"
              totalLabel="Total reports"
              segments={[
                { label: STATUS_LABEL.approved, value: counts.approved, color: STATUS_COLORS.approved },
                { label: STATUS_LABEL.pending, value: counts.pending, color: STATUS_COLORS.pending },
                { label: STATUS_LABEL.draft, value: counts.draft, color: STATUS_COLORS.draft },
                { label: STATUS_LABEL.failed, value: counts.failed, color: STATUS_COLORS.failed },
              ]}
            />
          </Card>

          <Card title="Reports decided" subtitle="Approved or failed, per week" actions={<span className="text-[12px] text-muted">Last 8 weeks</span>} bodyClassName="p-5">
            <DecidedBars
              title="Reports decided per week, last 8 weeks"
              weeks={decided.map((d) => ({ label: weekLabel(d.weekStart), count: d.count }))}
            />
          </Card>
        </div>

        <Card bodyClassName="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <SegmentedTabs tabs={tabs} active={filter ?? 'all'} basePath="/dashboard" />
          </div>
          {tableRows.length === 0 ? (
            <div className="px-5 py-12 text-center text-[13px] text-muted">No reports match this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[13px]">
                <thead className="border-b border-line bg-page text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
                  <tr>
                    <th className="px-5 py-2.5">Report no.</th>
                    <th className="px-5 py-2.5">Instrument</th>
                    <th className="px-5 py-2.5">Manufacturer</th>
                    <th className="px-5 py-2.5">Result</th>
                    <th className="px-5 py-2.5">Tested by</th>
                    <th className="px-5 py-2.5">Date</th>
                    <th className="px-5 py-2.5">Status</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0 hover:bg-page">
                      <td className="px-5 py-3">
                        <Link href={`/reports/${r.id}`} className="font-mono font-medium text-ink hover:text-green-ink">
                          {r.report_no}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-ink">{r.model || 'Untitled draft'}</div>
                        <div className="text-[12px] text-muted">Class {r.accuracy_class ?? '—'} · {r.serial_number ?? '—'}</div>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{r.manufacturer || '—'}</td>
                      <td className="px-5 py-3">
                        <ResultText result={r.calculated_result} />
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{r.creator_name}</td>
                      <td className="px-5 py-3 font-mono text-[12.5px] text-ink-soft">{formatDate(r.submitted_at ?? r.created_at)}</td>
                      <td className="px-5 py-3">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link href={`/reports/${r.id}`} className="text-[12.5px] font-medium text-muted hover:text-ink">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </PageBody>
    </>
  );
}

async function ReviewerDashboard({ sb }: { sb: SupabaseClient }) {
  const [queue, decided] = await Promise.all([loadReviewQueue(sb), loadRecentDecisions(sb)]);
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your review work" />
      <PageBody>
        <Card
          title="Waiting for review"
          subtitle={queue.length ? 'Oldest first.' : undefined}
          actions={
            <div className="flex items-center gap-2">
              <Pill tone={queue.length ? 'amber' : 'gray'}>{queue.length} pending</Pill>
              <ButtonLink href="/review" variant="secondary" size="sm">
                Open review queue
              </ButtonLink>
            </div>
          }
          bodyClassName="p-3"
        >
          <RecentReports reports={queue} dateField="submitted" empty="Nothing to review right now." />
        </Card>
        <Card title="Recently reviewed" bodyClassName="p-3">
          <RecentReports reports={decided} dateField="reviewed" empty="No reports have been reviewed yet." />
        </Card>
      </PageBody>
    </>
  );
}

async function TechnicianDashboard({ sb, profile }: { sb: SupabaseClient; profile: Profile }) {
  const [drafts, recent] = await Promise.all([loadMyDrafts(sb, profile.id), listReports(sb, { limit: 8 })]);
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your test reports" actions={<NewReportButton />} />
      <PageBody>
        <Card title="Your drafts" subtitle={drafts.length ? 'Finish these and submit them for review.' : undefined} bodyClassName="p-3">
          <RecentReports reports={drafts} empty="You have no drafts. Start one with “New report”." />
        </Card>
        <Card
          title="Recent reports in the lab"
          actions={
            <ButtonLink href="/reports" variant="secondary" size="sm">
              View all
            </ButtonLink>
          }
          bodyClassName="p-3"
        >
          <RecentReports reports={recent} empty="No reports yet." />
        </Card>
      </PageBody>
    </>
  );
}
