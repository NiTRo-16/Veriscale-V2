import { Lock } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { NoAccess } from '@/components/ui/Notice';
import { PageBody, PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { hasRole, requireSession } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/labels';
import { createServerSupabase } from '@/lib/supabase/server';
import type { ActivityRow } from '@/lib/types';

export const metadata = { title: 'Activity log · VeriScale' };

export default async function ActivityPage() {
  const { profile } = await requireSession();
  if (!hasRole(profile, ['admin'])) return <NoAccess />;

  const supabase = await createServerSupabase();
  const { data } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(200);
  const entries = (data ?? []) as ActivityRow[];

  const reportNos = [...new Set(entries.map((e) => e.report_no).filter((n): n is string => Boolean(n)))];
  const { data: reports } = reportNos.length
    ? await supabase.from('reports').select('id, report_no').in('report_no', reportNos)
    : { data: [] as Array<{ id: string; report_no: string }> };
  const reportIds = new Map((reports ?? []).map((r) => [r.report_no, r.id]));

  return (
    <>
      <PageHeader crumbs={[{ label: 'Administration' }, { label: 'Activity log' }]} />
      <PageBody>
        <Card
          title="Activity log"
          subtitle="Everything that happens is recorded here. Entries can't be edited or deleted."
          actions={
            <Pill>
              <Lock size={12} strokeWidth={2} /> Read-only
            </Pill>
          }
          bodyClassName="p-0"
        >
          {entries.length === 0 ? (
            <p className="px-5 py-12 text-center text-[13px] text-muted">Nothing has happened yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead className="bg-page text-left text-[11.5px] text-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">When</th>
                    <th className="px-5 py-2.5 font-medium">Who</th>
                    <th className="px-5 py-2.5 font-medium">What happened</th>
                    <th className="px-5 py-2.5 font-medium">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const reportId = entry.report_no ? reportIds.get(entry.report_no) : undefined;
                    return (
                      <tr key={entry.id} className="border-t border-line">
                        <td className="whitespace-nowrap px-5 py-3 font-mono text-[12.5px] text-ink-soft">
                          {formatDateTime(entry.created_at)}
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-medium text-ink">{entry.actor_name}</span>
                          <span className="text-muted"> · {ROLE_LABEL[entry.actor_role]}</span>
                        </td>
                        <td className="px-5 py-3 text-ink">{entry.message}</td>
                        <td className="px-5 py-3 font-mono text-[12.5px]">
                          {entry.report_no ? (
                            reportId ? (
                              <Link href={`/reports/${reportId}`} className="text-ink hover:text-green-ink">
                                {entry.report_no}
                              </Link>
                            ) : (
                              <span className="text-muted">{entry.report_no}</span>
                            )
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </PageBody>
    </>
  );
}
