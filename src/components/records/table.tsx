import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDate } from '@/lib/format';
import { testedOn, type RecordReport } from '@/lib/records';

export const THEAD = 'border-b border-line bg-page text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted';
export const TH = 'px-5 py-2.5 font-semibold';
export const TR = 'border-b border-line last:border-0 hover:bg-page';
export const TD = 'px-5 py-3';

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-10 text-center text-[13px] text-muted">
        {children}
      </td>
    </tr>
  );
}

export function LatestReportCell({ report }: { report: RecordReport | null }) {
  if (!report) return <span className="text-faint">—</span>;
  return (
    <div>
      <Link href={`/reports/${report.id}`} className="font-mono text-[12.5px] font-medium text-ink hover:underline">
        {report.report_no}
      </Link>
      <div className="text-[12px] text-muted">{formatDate(testedOn(report))}</div>
    </div>
  );
}
