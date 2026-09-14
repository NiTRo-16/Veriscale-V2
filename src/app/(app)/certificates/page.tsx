import { FileDown, Search } from 'lucide-react';
import Link from 'next/link';
import { TABLE_HEAD } from '@/components/review/DecisionsTable';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { AccountNotReady } from '@/components/ui/Notice';
import { PageBody, PageHeader } from '@/components/ui/PageHeader';
import { requireSession } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { TEST_STAGE_LABEL } from '@/lib/labels';
import { loadCertificates, loadNames } from '@/lib/review-data';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata = { title: 'Certificates · VeriScale' };

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { profile } = await requireSession();
  if (!profile) return <AccountNotReady />;

  const { q } = await searchParams;
  const query = typeof q === 'string' ? q.trim() : '';
  const sb = await createServerSupabase();
  const approved = await loadCertificates(sb);
  const names = await loadNames(sb, approved.map((r) => r.reviewed_by));

  const needle = query.toLowerCase();
  const reports = needle
    ? approved.filter((r) =>
        [r.report_no, r.model, r.manufacturer, r.serial_number].some((v) => v?.toLowerCase().includes(needle)),
      )
    : approved;

  return (
    <>
      <PageHeader title="Certificates" subtitle="Approved reports, ready to print" />
      <PageBody>
        <Card
          title={`${reports.length} ${reports.length === 1 ? 'certificate' : 'certificates'}`}
          subtitle="Open a report and choose Print to save its certificate as a PDF."
          actions={
            <form action="/certificates" className="flex items-center gap-2" role="search">
              <label htmlFor="certificate-search" className="sr-only">
                Search certificates
              </label>
              <Input
                id="certificate-search"
                name="q"
                defaultValue={query}
                placeholder="Report no., model or serial number"
                className="w-[260px]"
              />
              <Button type="submit" variant="secondary">
                <Search size={15} strokeWidth={1.75} /> Search
              </Button>
            </form>
          }
          bodyClassName="p-0"
        >
          {reports.length === 0 ? (
            <div className="px-5 py-12 text-center text-[13px] text-muted">
              {query ? `No approved reports match “${query}”.` : 'No reports have been approved yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-[13px]">
                <thead className={TABLE_HEAD}>
                  <tr>
                    <th className="px-5 py-2.5">Report no.</th>
                    <th className="px-5 py-2.5">Instrument</th>
                    <th className="px-5 py-2.5">Class</th>
                    <th className="px-5 py-2.5">Tested by</th>
                    <th className="px-5 py-2.5">Approved by</th>
                    <th className="px-5 py-2.5">Approved on</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0 hover:bg-page">
                      <td className="px-5 py-3">
                        <Link href={`/reports/${r.id}`} className="font-mono font-medium text-ink hover:text-green-ink">
                          {r.report_no}
                        </Link>
                        <div className="text-[12px] text-muted">{TEST_STAGE_LABEL[r.test_stage]}</div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-ink">{r.model || 'Untitled report'}</div>
                        <div className="text-[12px] text-muted">
                          {r.manufacturer || '—'} · <span className="font-mono">{r.serial_number || '—'}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-soft">Class {r.accuracy_class ?? '—'}</td>
                      <td className="px-5 py-3 text-ink-soft">{r.creator_name}</td>
                      <td className="px-5 py-3 text-ink-soft">{(r.reviewed_by && names[r.reviewed_by]) || '—'}</td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-[12.5px] text-ink-soft">{formatDate(r.reviewed_at)}</td>
                      <td className="px-5 py-3 text-right">
                        <ButtonLink href={`/reports/${r.id}`} variant="secondary" size="sm">
                          <FileDown size={14} strokeWidth={1.75} /> Open certificate
                        </ButtonLink>
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
