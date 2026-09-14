'use client';

import { AlertTriangle, CircleCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { reviewReport, sendBackReport } from '@/app/(app)/reports/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Textarea } from '@/components/ui/Field';
import { ResultText } from '@/components/ui/Pill';
import { REVIEW_CHECKS } from '@/lib/labels';
import { firstName, noteRequired, type AutoCheck } from '@/lib/review';
import type { Decision, StoredResult } from '@/lib/types';

const SUBMIT: Record<Decision, { label: string; busy: string; variant: 'green' | 'primary' | 'danger' }> = {
  approved: { label: 'Approve report', busy: 'Approving…', variant: 'green' },
  sent_back: { label: 'Send back for changes', busy: 'Sending back…', variant: 'primary' },
  failed: { label: 'Fail report', busy: 'Failing…', variant: 'danger' },
};

/** The reviewer's side of the review desk: checks, a decision and a note. */
export function ReviewDesk({
  reportId,
  calculated,
  resultDetail,
  autoChecks,
  technicianName,
  nextHref,
}: {
  reportId: string;
  calculated: StoredResult | null;
  resultDetail: string;
  autoChecks: AutoCheck[];
  technicianName: string;
  /** Where to go once the decision is saved: the next report in the queue, or the queue itself. */
  nextHref: string;
}) {
  const router = useRouter();
  const canApprove = calculated === 'pass';
  const name = firstName(technicianName);
  const [checks, setChecks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(REVIEW_CHECKS.map((c) => [c.key, false])),
  );
  const [decision, setDecision] = useState<Decision>(canApprove ? 'approved' : 'failed');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ticked = REVIEW_CHECKS.filter((c) => checks[c.key]).length;
  const needsNote = noteRequired(decision, calculated);

  const options: Array<{ value: Decision; title: string; detail: string }> = [
    ...(canApprove
      ? [{ value: 'approved' as const, title: 'Approve', detail: 'The report becomes final and its certificate can be downloaded.' }]
      : []),
    { value: 'sent_back', title: 'Send back for changes', detail: `Returns to ${name} as a draft, with your note.` },
    {
      value: 'failed',
      title: 'Fail',
      detail: canApprove ? 'Closes the report as failed. A note is needed.' : 'Closes the report as failed.',
    },
  ];

  const submit = () => {
    setError(null);
    if (decision === 'approved' && ticked < REVIEW_CHECKS.length) {
      setError('Tick each of your checks before approving.');
      return;
    }
    if (needsNote && !note.trim()) {
      setError(
        decision === 'sent_back'
          ? `Add a note so ${name} knows what to change.`
          : 'Add a note explaining why this report fails.',
      );
      return;
    }
    startTransition(async () => {
      const result =
        decision === 'sent_back'
          ? await sendBackReport(reportId, note)
          : await reviewReport(reportId, decision, note, checks);
      if (!result.ok) {
        setError(result.error);
        router.refresh();
        return;
      }
      router.push(nextHref);
    });
  };

  return (
    <Card title="Your review" bodyClassName="flex flex-col divide-y divide-line">
      <section className="px-5 py-4">
        <div className="text-[12px] text-muted">Calculated result</div>
        <div className="mt-1 text-[20px] leading-tight">
          <ResultText result={calculated} />
        </div>
        <div className="mt-0.5 text-[12.5px] text-muted">{resultDetail}</div>
      </section>

      <section className="px-5 py-4">
        <h3 className="mb-2.5 text-[12px] font-semibold text-ink-soft">Checked by VeriScale</h3>
        <ul className="flex flex-col gap-2">
          {autoChecks.map((check) => (
            <li key={check.label} className="flex items-start gap-2 text-[12.5px]">
              {check.ok ? (
                <CircleCheck size={15} className="mt-px shrink-0 text-green" aria-label="Looks fine" />
              ) : (
                <AlertTriangle size={15} className="mt-px shrink-0 text-amber" aria-label="Take a closer look" />
              )}
              <span className={check.ok ? 'text-ink-soft' : 'text-amber-ink'}>{check.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[12px] font-semibold text-ink-soft">Your checks</h3>
          <span className={`text-[12px] font-medium ${ticked === REVIEW_CHECKS.length ? 'text-green-ink' : 'text-muted'}`}>
            {ticked} of {REVIEW_CHECKS.length}
          </span>
        </div>
        <div className="flex flex-col">
          {REVIEW_CHECKS.map((check) => (
            <label key={check.key} className="flex cursor-pointer items-start gap-2.5 py-1.5 text-[13px] text-ink">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-green"
                checked={checks[check.key] ?? false}
                disabled={pending}
                onChange={(e) => setChecks((c) => ({ ...c, [check.key]: e.target.checked }))}
              />
              {check.label}
            </label>
          ))}
        </div>
      </section>

      <section className="px-5 py-4">
        <h3 id="decision-label" className="mb-2.5 text-[12px] font-semibold text-ink-soft">
          Decision
        </h3>
        <div role="radiogroup" aria-labelledby="decision-label" className="flex flex-col gap-2">
          {options.map((option) => {
            const selected = decision === option.value;
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-[10px] border-[1.5px] p-3 transition-colors ${
                  selected ? 'border-green bg-[#f3faf6]' : 'border-line hover:bg-page'
                }`}
              >
                <input
                  type="radio"
                  name="decision"
                  value={option.value}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-green"
                  checked={selected}
                  disabled={pending}
                  onChange={() => {
                    setDecision(option.value);
                    setError(null);
                  }}
                />
                <span>
                  <span className="block text-[13px] font-semibold text-ink">{option.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-muted">{option.detail}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 px-5 py-4">
        <Field label={`Note for ${name} ${needsNote ? '(needed)' : '(optional)'}`} htmlFor="review-note">
          <Textarea
            id="review-note"
            value={note}
            maxLength={1000}
            disabled={pending}
            onChange={(e) => setNote(e.target.value)}
            placeholder={decision === 'sent_back' ? 'What needs to change…' : 'Add a note…'}
          />
        </Field>
        {error && (
          <p role="alert" className="rounded-lg bg-red-soft px-3 py-2 text-[12.5px] text-red">
            {error}
          </p>
        )}
        <Button variant={SUBMIT[decision].variant} className="w-full" disabled={pending} onClick={submit}>
          {pending ? SUBMIT[decision].busy : SUBMIT[decision].label}
        </Button>
        <p className="text-center text-[12px] text-muted">
          {nextHref === '/review'
            ? 'You go back to the review queue after you decide.'
            : 'The next report in the queue opens after you decide.'}
        </p>
      </section>
    </Card>
  );
}
