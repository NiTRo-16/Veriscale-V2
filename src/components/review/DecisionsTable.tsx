import Link from 'next/link';
import { DecisionPill, StatusPill } from '@/components/ui/Pill';
import { formatDateTime } from '@/lib/format';
import type { DecisionEntry } from '@/lib/review';
import type { ReviewListItem } from '@/lib/review-data';

export const TABLE_HEAD =
  'border-b border-line bg-page text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted';

/** Approvals, fails and send-backs by one person. */
export function DecisionsTable({ entries, empty }: { entries: DecisionEntry<ReviewListItem>[]; empty: string }) {
  if (entries.length === 0) return <div className="px-5 py-12 text-center text-[13px] text-muted">{empty}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-[13px]">
        <thead className={TABLE_HEAD}>
          <tr>
            <th className="px-5 py-2.5">Decided</th>
            <th className="px-5 py-2.5">Report</th>
            <th className="px-5 py-2.5">Instrument</th>
            <th className="px-5 py-2.5">Decision</th>
            <th className="px-5 py-2.5">Your note</th>
            <th className="px-5 py-2.5">Status now</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ report, kind, at, note }) => (
            <tr key={`${report.id}-${kind}`} className="border-b border-line align-top last:border-0 hover:bg-page">
              <td className="whitespace-nowrap px-5 py-3 font-mono text-[12.5px] text-ink-soft">{formatDateTime(at)}</td>
              <td className="px-5 py-3">
                <Link href={`/reports/${report.id}`} className="font-mono font-medium text-ink hover:text-green-ink">
                  {report.report_no}
                </Link>
              </td>
              <td className="px-5 py-3">
                <div className="font-medium text-ink">{report.model || 'Untitled report'}</div>
                <div className="text-[12px] text-muted">
                  {report.manufacturer || '—'} · Tested by {report.creator_name}
                </div>
              </td>
              <td className="px-5 py-3">
                <DecisionPill decision={kind} />
              </td>
              <td className="max-w-[280px] px-5 py-3 text-[12.5px] text-ink-soft">
                {note ? <span className="line-clamp-2 whitespace-pre-line">{note}</span> : <span className="text-faint">—</span>}
              </td>
              <td className="px-5 py-3">
                <StatusPill status={report.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
