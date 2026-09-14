import { DecisionsTable } from '@/components/review/DecisionsTable';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AccountNotReady, NoAccess } from '@/components/ui/Notice';
import { PageBody, PageHeader } from '@/components/ui/PageHeader';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { requireSession } from '@/lib/auth';
import { DECISION_LABEL } from '@/lib/labels';
import { decisionEntries } from '@/lib/review';
import { loadMyDecisionReports } from '@/lib/review-data';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Decision } from '@/lib/types';

export const metadata = { title: 'My decisions · VeriScale' };

const isDecision = (v: unknown): v is Decision => typeof v === 'string' && v in DECISION_LABEL;

export default async function MyDecisionsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { profile } = await requireSession();
  if (!profile) return <AccountNotReady />;
  if (profile.role !== 'reviewer' && profile.role !== 'admin') return <NoAccess />;

  const { show } = await searchParams;
  const filter = isDecision(show) ? show : undefined;
  const sb = await createServerSupabase();
  const entries = decisionEntries(await loadMyDecisionReports(sb, profile.id), profile.id);
  const count = (kind: Decision) => entries.filter((e) => e.kind === kind).length;
  const rows = filter ? entries.filter((e) => e.kind === filter) : entries;

  const tabs = [
    { label: 'All', value: 'all', count: entries.length },
    { label: DECISION_LABEL.approved, value: 'approved', count: count('approved') },
    { label: DECISION_LABEL.sent_back, value: 'sent_back', count: count('sent_back') },
    { label: DECISION_LABEL.failed, value: 'failed', count: count('failed') },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Review queue', href: '/review' }, { label: 'My decisions' }]}
        actions={
          <ButtonLink href="/review" variant="secondary">
            Open review queue
          </ButtonLink>
        }
      />
      <PageBody>
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">My decisions</h1>
          <p className="mt-0.5 text-[13px] text-muted">Reports you approved, sent back or failed, newest first.</p>
        </div>
        <Card bodyClassName="p-0">
          <div className="border-b border-line px-5 py-3.5">
            <SegmentedTabs tabs={tabs} active={filter ?? 'all'} basePath="/review/decisions" paramName="show" />
          </div>
          <DecisionsTable
            entries={rows}
            empty={filter ? 'No decisions of this kind yet.' : "You haven't decided any reports yet."}
          />
        </Card>
      </PageBody>
    </>
  );
}
