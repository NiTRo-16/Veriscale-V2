import { notFound } from 'next/navigation';
import { DraftEditor } from '@/components/report/DraftEditor';
import { PrintButton } from '@/components/report/PrintButton';
import { ReportView } from '@/components/report/ReportView';
import { ReviewPanel } from '@/components/report/ReviewPanel';
import { AccountNotReady } from '@/components/ui/Notice';
import { PageBody, PageHeader } from '@/components/ui/PageHeader';
import { StatusPill } from '@/components/ui/Pill';
import { requireSession } from '@/lib/auth';
import { loadReport, loadRules } from '@/lib/data';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireSession();
  if (!profile) return <AccountNotReady />;

  const supabase = await createServerSupabase();
  const full = await loadReport(supabase, id);
  if (!full) notFound();
  const { report } = full;

  const crumbs = [{ label: 'Reports', href: '/reports' }, { label: report.report_no }];

  if (report.status === 'draft' && report.created_by === profile.id) {
    const rules = await loadRules(supabase);
    return (
      <>
        <PageHeader crumbs={crumbs} actions={<StatusPill status="draft" />} />
        <PageBody>
          <DraftEditor initial={full} rules={rules} />
        </PageBody>
      </>
    );
  }

  const canReview = report.status === 'pending' && (profile.role === 'reviewer' || profile.role === 'admin');
  const rules = report.status === 'draft' ? await loadRules(supabase) : undefined;

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        actions={
          <>
            <StatusPill status={report.status} />
            <PrintButton />
          </>
        }
      />
      <PageBody className="max-w-[960px]">
        {canReview && <ReviewPanel reportId={report.id} calculated={report.calculated_result} />}
        <ReportView full={full} rules={rules} />
      </PageBody>
    </>
  );
}
