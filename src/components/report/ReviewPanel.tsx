'use client';

import { Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { reviewReport } from '@/app/(app)/reports/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Textarea } from '@/components/ui/Field';
import { ResultText } from '@/components/ui/Pill';
import { reviewOptions } from '@/lib/readiness';
import type { StoredResult } from '@/lib/types';

export function ReviewPanel({ reportId, calculated }: { reportId: string; calculated: StoredResult | null }) {
  const router = useRouter();
  const { canApprove, failNoteRequired } = reviewOptions(calculated);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<'approved' | 'failed' | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (decision: 'approved' | 'failed') => {
    setError(null);
    if (decision === 'failed' && failNoteRequired && !note.trim()) {
      setError('Please add a note explaining why this report fails.');
      return;
    }
    setChoice(decision);
    startTransition(async () => {
      const result = await reviewReport(reportId, decision, note);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  return (
    <Card
      className="no-print border-amber/40"
      title="Review this report"
      subtitle={
        calculated === 'fail'
          ? 'The readings failed, so this report can only be failed.'
          : 'The readings passed. Approve the report, or fail it with a note explaining why.'
      }
    >
      <div className="flex flex-col gap-4">
        <div className="text-[13px] text-ink-soft">
          Readings result: <ResultText result={calculated} />
        </div>
        <Field
          label={failNoteRequired ? 'Note (needed if you fail this report)' : 'Note (optional)'}
          htmlFor="review-note"
        >
          <Textarea
            id="review-note"
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything the technician or a later reader should know"
          />
        </Field>
        {error && (
          <p role="alert" className="rounded-lg bg-red-soft px-3 py-2 text-[12.5px] text-red">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="danger" disabled={pending} onClick={() => decide('failed')}>
            <X size={16} strokeWidth={2} />
            {pending && choice === 'failed' ? 'Failing…' : 'Fail report'}
          </Button>
          {canApprove && (
            <Button disabled={pending} onClick={() => decide('approved')}>
              <Check size={16} strokeWidth={2} />
              {pending && choice === 'approved' ? 'Approving…' : 'Approve'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
