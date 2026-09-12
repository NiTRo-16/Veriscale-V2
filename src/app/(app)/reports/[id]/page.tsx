import { notFound } from 'next/navigation';
import { DraftEditor } from '@/components/report/DraftEditor';
import { PrintButton } from '@/components/report/PrintButton';
import { ReportPhotos, type PhotoWithUrl } from '@/components/report/ReportPhotos';
import { ReportView } from '@/components/report/ReportView';
import { ReviewPanel } from '@/components/report/ReviewPanel';
import { AccountNotReady } from '@/components/ui/Notice';
import { PageBody, PageHeader } from '@/components/ui/PageHeader';
import { StatusPill } from '@/components/ui/Pill';
import { requireSession } from '@/lib/auth';
import { loadReport, loadRules } from '@/lib/data';
import { PHOTO_BUCKET } from '@/lib/photos';
import { createServerSupabase } from '@/lib/supabase/server';
import type { PhotoRow } from '@/lib/types';

const LINK_SECONDS = 60 * 60;

async function withLinks(supabase: Awaited<ReturnType<typeof createServerSupabase>>, photos: PhotoRow[]): Promise<PhotoWithUrl[]> {
  if (photos.length === 0) return [];
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(
    photos.map((p) => p.storage_path),
    LINK_SECONDS,
  );
  const links = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return photos.map((p) => ({ ...p, url: links.get(p.storage_path) ?? null }));
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireSession();
  if (!profile) return <AccountNotReady />;

  const supabase = await createServerSupabase();
  const full = await loadReport(supabase, id);
  if (!full) notFound();
  const { report } = full;
  const photos = await withLinks(supabase, full.photos);

  const crumbs = [{ label: 'Reports', href: '/reports' }, { label: report.report_no }];

  if (report.status === 'draft' && report.created_by === profile.id) {
    const rules = await loadRules(supabase);
    return (
      <>
        <PageHeader crumbs={crumbs} actions={<StatusPill status="draft" />} />
        <PageBody>
          <DraftEditor initial={full} rules={rules} photos={photos} />
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
        <ReportView full={full} rules={rules} photos={<ReportPhotos photos={photos} readings={full.readings} />} />
      </PageBody>
    </>
  );
}
