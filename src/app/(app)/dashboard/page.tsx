import type { SupabaseClient } from '@supabase/supabase-js';
import { CircleCheck, CircleX, FileText, PenLine } from 'lucide-react';
import { AreaChart } from '@/components/charts/AreaChart';
import { GroupedBars } from '@/components/charts/GroupedBars';
import { HalfDonut } from '@/components/charts/HalfDonut';
import { NewReportButton } from '@/components/report/NewReportButton';
import { RecentReports } from '@/components/report/RecentReports';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AccountNotReady } from '@/components/ui/Notice';
import { PageBody, PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { StatTile } from '@/components/ui/StatTile';
import { requireSession } from '@/lib/auth';
import {
  average,
  changeVsPrevious,
  classCounts,
  statusCounts,
  submittedVsReviewed,
  weekLabel,
  weeklySubmitted,
} from '@/lib/dashboard';
import { loadDashboardReports, loadMyDrafts, loadRecentDecisions, loadReviewQueue } from '@/lib/dashboard-data';
import { listReports } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

export const metadata = { title: 'Dashboard · VeriScale' };

const CLASS_COLORS = { I: '#2f6fdb', II: '#e0a030', III: '#8e5cd1', IIII: '#1f9d55' } as const;
const CLASS_NAMES = { I: 'Class I · Special', II: 'Class II · High', III: 'Class III · Medium', IIII: 'Class IIII · Ordinary' } as const;

export default async function DashboardPage() {
  const { profile } = await requireSession();
  if (!profile) return <AccountNotReady />;
  const supabase = await createServerSupabase();

  if (profile.role === 'admin') return <AdminDashboard sb={supabase} />;
  if (profile.role === 'reviewer') return <ReviewerDashboard sb={supabase} />;
  return <TechnicianDashboard sb={supabase} profile={profile} />;
}

async function AdminDashboard({ sb }: { sb: SupabaseClient }) {
  const [reports, recent] = await Promise.all([loadDashboardReports(sb), listReports(sb, { limit: 5 })]);
  const now = new Date();
  const counts = statusCounts(reports);
  const weekly = weeklySubmitted(reports, now, 12);
  const thisWeek = weekly[weekly.length - 1]?.count ?? 0;
  const change = changeVsPrevious(weekly.map((w) => w.count));
  const classes = classCounts(reports);
  const flow = submittedVsReviewed(reports, now, 6);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Overview' }, { label: 'Dashboard' }]}
        actions={
          counts.pending > 0 ? (
            <ButtonLink href="/reports?status=pending">
              <PenLine size={15} strokeWidth={1.75} /> Review {counts.pending} {counts.pending === 1 ? 'report' : 'reports'}
            </ButtonLink>
          ) : undefined
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="All reports" value={counts.all} icon={FileText} href="/reports" />
          <StatTile label="Pending" value={counts.pending} icon={PenLine} href="/reports?status=pending" />
          <StatTile label="Approved" value={counts.approved} icon={CircleCheck} href="/reports?status=approved" />
          <StatTile label="Failed" value={counts.failed} icon={CircleX} href="/reports?status=failed" />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card bodyClassName="flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[14px] font-semibold text-ink">Reports submitted</h2>
                <div className="mt-2.5 flex flex-wrap items-baseline gap-2.5">
                  <span className="text-[30px] font-semibold leading-none tracking-tight text-ink">{thisWeek}</span>
                  <span className="text-[13px] text-muted">this week</span>
                  {change !== null && (
                    <Pill tone={change >= 0 ? 'green' : 'gray'}>
                      {change >= 0 ? '+' : ''}
                      {change}% vs last week
                    </Pill>
                  )}
                </div>
              </div>
              <span className="text-[12px] text-muted">Last 12 weeks</span>
            </div>
            <AreaChart
              title="Reports submitted per week, last 12 weeks"
              points={weekly.map((w) => ({
                label: weekLabel(w.weekStart),
                value: w.count,
                tooltipTitle: `Week of ${formatDate(w.weekStart, 'UTC')}`,
                tooltipValue: `${w.count} ${w.count === 1 ? 'report' : 'reports'} submitted`,
              }))}
            />
          </Card>

          <Card title="Reports by accuracy class" bodyClassName="p-5">
            <HalfDonut
              title="Submitted reports by accuracy class"
              totalLabel="Submitted reports"
              segments={(['I', 'II', 'III', 'IIII'] as const).map((c) => ({
                label: CLASS_NAMES[c],
                value: classes[c],
                color: CLASS_COLORS[c],
              }))}
            />
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <Card title="Submitted vs reviewed" actions={<span className="text-[12px] text-muted">Last 6 weeks</span>} bodyClassName="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap gap-10">
              {[
                { label: 'Avg. submitted / week', value: average(flow.map((f) => f.submitted)), color: '#6dbe8c' },
                { label: 'Avg. reviewed / week', value: average(flow.map((f) => f.reviewed)), color: '#146b3e' },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex items-center gap-2 text-[12px] text-muted">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
                    {s.label}
                  </div>
                  <div className="mt-1.5 text-[24px] font-semibold leading-none tracking-tight text-ink">{s.value}</div>
                </div>
              ))}
            </div>
            <GroupedBars
              title="Reports submitted and reviewed per week, last 6 weeks"
              series={[
                { label: 'Submitted', color: '#6dbe8c' },
                { label: 'Reviewed', color: '#146b3e' },
              ]}
              groups={flow.map((f) => ({ label: weekLabel(f.weekStart), values: [f.submitted, f.reviewed] }))}
            />
          </Card>

          <Card
            title="Recent reports"
            actions={
              <ButtonLink href="/reports" variant="secondary" size="sm">
                View all
              </ButtonLink>
            }
            bodyClassName="p-3"
          >
            <RecentReports reports={recent} empty="No reports yet." />
          </Card>
        </div>
      </PageBody>
    </>
  );
}

async function ReviewerDashboard({ sb }: { sb: SupabaseClient }) {
  const [queue, decided] = await Promise.all([loadReviewQueue(sb), loadRecentDecisions(sb)]);
  return (
    <>
      <PageHeader crumbs={[{ label: 'Overview' }, { label: 'Dashboard' }]} />
      <PageBody>
        <Card
          title="Waiting for review"
          subtitle={queue.length ? 'Oldest first.' : undefined}
          actions={<Pill tone={queue.length ? 'amber' : 'gray'}>{queue.length} pending</Pill>}
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
      <PageHeader crumbs={[{ label: 'Overview' }, { label: 'Dashboard' }]} actions={<NewReportButton />} />
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
