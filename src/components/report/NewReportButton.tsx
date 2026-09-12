'use client';

import { Plus } from 'lucide-react';
import { useState, useTransition } from 'react';
import { createDraft } from '@/app/(app)/reports/actions';
import { Button } from '@/components/ui/Button';

export function NewReportButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-[12px] text-red">{error}</span>}
      <Button
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await createDraft();
            if (result && !result.ok) setError(result.error);
          });
        }}
      >
        <Plus size={16} strokeWidth={2} />
        {pending ? 'Creating…' : 'New report'}
      </Button>
    </div>
  );
}
