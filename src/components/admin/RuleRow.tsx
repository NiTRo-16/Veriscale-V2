'use client';

import { Check, Pencil, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateRule } from '@/app/(app)/admin/rules/actions';
import { multiplierLabel, ruleRangeLabel } from '@/lib/admin';
import type { AllowedErrorRule } from '@/lib/types';

export function RuleRow({ rule, firstOfClass }: { rule: AllowedErrorRule; firstOfClass: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(rule.multiplier));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cancel = () => {
    setEditing(false);
    setValue(String(rule.multiplier));
    setError(null);
  };

  const save = () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a number above 0.');
      return;
    }
    startTransition(async () => {
      const result = await updateRule(rule.id, n);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      setError(null);
      router.refresh();
    });
  };

  return (
    <tr className={`${firstOfClass ? 'border-t border-line-strong' : 'border-t border-line'} ${editing ? 'bg-green-soft/40' : ''}`}>
      <td className="px-5 py-3 font-medium text-ink">{firstOfClass ? `Class ${rule.accuracy_class}` : ''}</td>
      <td className="px-5 py-3 text-right font-mono tabular text-ink-soft">{ruleRangeLabel(rule)}</td>
      <td className="px-5 py-3 text-right">
        {editing ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-muted">±</span>
              <input
                aria-label={`Allowed error for Class ${rule.accuracy_class}, ${ruleRangeLabel(rule)}`}
                autoFocus
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') cancel();
                }}
                className="h-8 w-20 rounded-md border border-green bg-card px-2 text-right text-[13px] focus:outline-none"
              />
              <span className="text-muted">e</span>
            </div>
            {error && <span className="text-[12px] text-red">{error}</span>}
          </div>
        ) : (
          <span className="font-mono tabular text-ink">± {multiplierLabel(rule.multiplier)} e</span>
        )}
      </td>
      <td className="w-28 px-5 py-3 text-right">
        {editing ? (
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              aria-label="Save"
              className="grid h-8 w-8 place-items-center rounded-lg bg-green-soft text-green-ink hover:bg-green-soft/70 disabled:opacity-50"
            >
              <Check size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={pending}
              aria-label="Cancel"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-hover"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit allowed error for Class ${rule.accuracy_class}, ${ruleRangeLabel(rule)}`}
            className="grid h-8 w-8 place-items-center justify-self-end rounded-lg text-muted hover:bg-hover hover:text-ink"
          >
            <Pencil size={15} strokeWidth={1.75} />
          </button>
        )}
      </td>
    </tr>
  );
}
