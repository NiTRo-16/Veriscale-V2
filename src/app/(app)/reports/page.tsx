import Link from 'next/link';
import { NewReportButton } from '@/components/report/NewReportButton';
import { Card } from '@/components/ui/Card';
import { PageBody, PageHeader } from '@/components/ui/PageHeader';
import { ResultText, StatusPill } from '@/components/ui/Pill';
import { AccountNotReady } from '@/components/ui/Notice';
import { requireSession } from '@/lib/auth';
import { listReports } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/labels';
import { createServerSupabase } from '@/lib/supabase/server';
import type { ReportStatus } from '@/lib/types';

export const metadata = { title: 'Reports · VeriScale' };

const TABS: Array<{ label: string; status?: ReportStatus }> = [
  { label: 'All' },
  { label: STATUS_LABEL.draft, status: 'draft' },
  { label: STATUS_LABEL.pending, status: 'pending' },
  { label: STATUS_LABEL.approved, status: 'approved' },
  { label: STATUS_LABEL.failed, status: 'failed' },
];

const isStatus = (v: unknown): v is ReportStatus => typeof v === 'string' && v in STATUS_LABEL;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { profile } = await requireSession();
  if (!profile) return <AccountNotReady />;
  const { status } = await searchParams;
  const filter = isStatus(status) ? status : undefined;

  const supabase = await createServerSupabase();
  const reports = await listReports(supabase, { status: filter });
  const canCreate = profile.role === 'technician' || profile.role === 'admin';

  return (
    <>
      <PageHeader crumbs={[{ label: 'Reports' }]} actions={canCreate ? <NewReportButton /> : undefined} />
      <PageBody>
        <nav className="flex flex-wrap gap-1.5" aria-label="Filter by status">
          {TABS.map((tab) => {
            const active = tab.status === filter;
            return (
              <Link
                key={tab.label}
                href={tab.status ? `/reports?status=${tab.status}` : '/reports'}
                aria-current={active ? 'page' : undefined}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium ${
                  active ? 'border-black bg-black text-white' : 'border-line-strong bg-card text-ink-soft hover:bg-hover'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <Card bodyClassName="p-0">
          {reports.length === 0 ? (
            <div className="px-5 py-12 text-center text-[13px] text-muted">
              {filter ? `No ${STATUS_LABEL[filter].toLowerCase()} reports.` : 'No reports yet.'}
              {canCreate && !filter && ' Use “New report” to start one.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead className="border-b border-line bg-page text-left text-[11.5px] text-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Report no.</th>
                    <th className="px-5 py-2.5 font-medium">Instrument</th>
                    <th className="px-5 py-2.5 font-medium">Class</th>
                    <th className="px-5 py-2.5 font-medium">Result</th>
                    <th className="px-5 py-2.5 font-medium">Tested by</th>
                    <th className="px-5 py-2.5 font-medium">Date</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0 hover:bg-page">
                      <td className="px-5 py-3">
                        <Link href={`/reports/${r.id}`} className="font-mono font-medium text-ink hover:text-green-ink">
                          {r.report_no}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-ink">{r.model || 'Untitled draft'}</div>
                        <div className="text-[12px] text-muted">{r.manufacturer || '—'}</div>
                      </td>
                      <td className="px-5 py-3">{r.accuracy_class ?? '—'}</td>
                      <td className="px-5 py-3">
                        <ResultText result={r.calculated_result} />
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{r.creator_name}</td>
                      <td className="px-5 py-3 font-mono text-[12.5px] text-ink-soft">
                        {formatDate(r.submitted_at ?? r.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill status={r.status} />
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
