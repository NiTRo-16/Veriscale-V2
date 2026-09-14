import { ChevronLeft, ChevronRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { DraftEditor } from '@/components/report/DraftEditor';
import { PrintButton } from '@/components/report/PrintButton';
import { ReportPhotos, type PhotoWithUrl } from '@/components/report/ReportPhotos';
import { ReportView } from '@/components/report/ReportView';
import { ReviewDeskView } from '@/components/report/ReviewDeskView';
import { buttonClass, ButtonLink } from '@/components/ui/Button';
import { AccountNotReady } from '@/components/ui/Notice';
import { PageBody, PageHeader } from '@/components/ui/PageHeader';
import { StatusPill } from '@/components/ui/Pill';
import { requireSession } from '@/lib/auth';
import { loadReport, loadRules } from '@/lib/data';
import { PHOTO_BUCKET } from '@/lib/photos';
import { todayDate } from '@/lib/records';
import { loadManufacturers, loadModels, loadWeightSets } from '@/lib/records-data';
import { queuePosition } from '@/lib/review';
import { loadEarlierReports, loadQueueIds } from '@/lib/review-data';
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

function QueueStep({ id, label, direction }: { id: string | null; label: string; direction: 'previous' | 'next' }) {
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;
  const className = 'w-8 px-0';
  if (!id) {
    return (
      <span aria-disabled className={buttonClass('secondary', 'sm', `${className} pointer-events-none opacity-40`)}>
        <Icon size={16} />
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <ButtonLink href={`/reports/${id}`} variant="secondary" size="sm" className={className} title={label}>
      <Icon size={16} />
      <span className="sr-only">{label}</span>
    </ButtonLink>
  );
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
    const [rules, manufacturers, models, weightSets] = await Promise.all([
      loadRules(supabase),
      loadManufacturers(supabase),
      loadModels(supabase),
      loadWeightSets(supabase),
    ]);
    return (
      <>
        <PageHeader crumbs={crumbs} actions={<StatusPill status="draft" />} />
        <PageBody>
          <DraftEditor
            initial={full}
            rules={rules}
            photos={photos}
            records={{ manufacturers, models, weightSets }}
            today={todayDate()}
          />
        </PageBody>
      </>
    );
  }

  const reportPhotos = <ReportPhotos photos={photos} readings={full.readings} />;

  if (report.status === 'pending' && (profile.role === 'reviewer' || profile.role === 'admin')) {
    const [queueIds, earlier] = await Promise.all([
      loadQueueIds(supabase),
      loadEarlierReports(supabase, report.serial_number, report.id),
    ]);
    const queue = queuePosition(queueIds, report.id);
    return (
      <>
        <PageHeader
          crumbs={[{ label: 'Review queue', href: '/review' }, { label: report.report_no }]}
          actions={
            <>
              {queue.position !== null && (
                <span className="mr-1 text-[12.5px] text-muted">
                  {queue.position} of {queue.total} waiting
                </span>
              )}
              <QueueStep id={queue.previous} label="Previous report in the queue" direction="previous" />
              <QueueStep id={queue.next} label="Next report in the queue" direction="next" />
              <PrintButton />
            </>
          }
        />
        <PageBody className="no-print max-w-[1400px]">
          <ReviewDeskView
            full={full}
            photos={photos}
            earlier={earlier}
            nextHref={queue.afterDecision ? `/reports/${queue.afterDecision}` : '/review'}
          />
        </PageBody>
        <div className="hidden print:block">
          <ReportView full={full} photos={reportPhotos} />
        </div>
      </>
    );
  }

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
        <ReportView full={full} rules={rules} photos={reportPhotos} />
      </PageBody>
    </>
  );
}
