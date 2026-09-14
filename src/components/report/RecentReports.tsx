import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { ResultText, StatusPill } from '@/components/ui/Pill';
import { formatDate } from '@/lib/format';
import type { ReportListItem, ReportStatus } from '@/lib/types';

const BAR: Record<ReportStatus, string> = {
  draft: 'bg-blue',
  pending: 'bg-amber',
  approved: 'bg-green',
  failed: 'bg-red',
};

/** Compact report list for dashboards: status bar, date, instrument, pill. */
export function RecentReports({
  reports,
  empty,
  dateField = 'default',
}: {
  reports: ReportListItem[];
  empty: string;
  dateField?: 'default' | 'submitted' | 'reviewed';
}) {
  if (reports.length === 0) return <p className="py-6 text-center text-[13px] text-muted">{empty}</p>;

  return (
    <ul className="flex flex-col gap-1">
      {reports.map((r) => {
        const date =
          dateField === 'submitted' ? r.submitted_at : dateField === 'reviewed' ? r.reviewed_at : (r.submitted_at ?? r.created_at);
        return (
          <li key={r.id}>
            <Link
              href={`/reports/${r.id}`}
              className="group flex items-center gap-3.5 rounded-[10px] border border-transparent px-3 py-2.5 hover:border-line hover:bg-card hover:shadow-[0_4px_14px_rgba(16,24,40,0.08)]"
            >
              <span className={`h-[38px] w-[3px] shrink-0 rounded-full ${BAR[r.status]}`} />
              <span className="w-[92px] shrink-0 font-mono text-[12px] text-ink-soft">{formatDate(date)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">
                  {r.report_no} · {r.model || 'Untitled draft'}
                </span>
                <span className="block truncate text-[12px] text-muted">
                  {r.manufacturer || '—'} · Class {r.accuracy_class ?? '—'} · {r.creator_name}
                  {r.calculated_result && (
                    <>
                      {' · '}
                      <ResultText result={r.calculated_result} />
                    </>
                  )}
                </span>
              </span>
              <StatusPill status={r.status} />
              <ChevronRight size={16} className="shrink-0 text-faint group-hover:text-ink" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
