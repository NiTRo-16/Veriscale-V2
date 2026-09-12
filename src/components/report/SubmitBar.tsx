'use client';

import { AlertCircle, Check, CloudOff, Loader2, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ResultText } from '@/components/ui/Pill';
import type { LiveResult } from '@/lib/types';
import type { SaveStatus } from './useAutosave';

function SaveIndicator({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === 'failed') {
    return (
      <span className="flex items-center gap-1.5 text-red">
        <AlertCircle size={14} /> {error ?? "Couldn't save"}
      </span>
    );
  }
  if (status === 'retrying') {
    return (
      <span className="flex items-center gap-1.5 text-amber-ink">
        <CloudOff size={14} /> Couldn't save — retrying
      </span>
    );
  }
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-muted">
        <Loader2 size={14} className="animate-spin" /> Saving…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-muted">
      <Check size={14} /> Saved
    </span>
  );
}

export function SubmitBar({
  result,
  problems,
  saveStatus,
  saveError,
  submitError,
  submitting,
  deleting,
  onSubmit,
  onDelete,
}: {
  result: LiveResult;
  problems: string[];
  saveStatus: SaveStatus;
  saveError: string | null;
  submitError: string | null;
  submitting: boolean;
  deleting: boolean;
  onSubmit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="sticky bottom-4 z-10 rounded-card border border-line bg-card px-5 py-4 shadow-[0_8px_24px_rgba(16,24,40,0.10)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px]">
          <span className="text-muted">
            Overall result: <ResultText result={result} />
          </span>
          <SaveIndicator status={saveStatus} error={saveError} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={deleting || submitting} onClick={onDelete}>
            <Trash2 size={15} strokeWidth={1.75} /> {deleting ? 'Deleting…' : 'Delete draft'}
          </Button>
          <Button disabled={problems.length > 0 || submitting || deleting} onClick={onSubmit}>
            <Send size={15} strokeWidth={1.75} /> {submitting ? 'Submitting…' : 'Submit report'}
          </Button>
        </div>
      </div>
      {problems.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-amber-ink">
          {problems.map((p) => (
            <li key={p} className="flex items-center gap-1.5">
              <AlertCircle size={13} /> {p}
            </li>
          ))}
        </ul>
      )}
      {submitError && (
        <p role="alert" className="mt-3 rounded-lg bg-red-soft px-3 py-2 text-[12.5px] text-red">
          {submitError}
        </p>
      )}
    </div>
  );
}
