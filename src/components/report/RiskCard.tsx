'use client';

import { AlertCircle, AlertTriangle, CircleCheck, Info, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { checkReportAgain } from '@/app/(app)/reports/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RiskPill } from '@/components/ui/Pill';
import { formatDateTime } from '@/lib/format';
import type { PhotoReadingStatus, ReportCheck, RiskLevel } from '@/lib/risk';

const PHOTO_READING_TEXT: Record<PhotoReadingStatus, string> = {
  done: 'Display and nameplate photos were read automatically.',
  off: 'Automatic photo reading is turned off.',
  failed: "The photos couldn't be read this time. Check again to retry.",
  not_run: "The photos haven't been read yet.",
};

const FLAG_ICON: Record<RiskLevel, { Icon: typeof AlertCircle; className: string; label: string }> = {
  high: { Icon: AlertCircle, className: 'text-red', label: 'High risk' },
  medium: { Icon: AlertTriangle, className: 'text-amber', label: 'Medium risk' },
  low: { Icon: Info, className: 'text-muted', label: 'Low risk' },
};

/** What the risk checks found on a pending report, for the reviewer. */
export function RiskCard({ reportId, check }: { reportId: string; check: ReportCheck | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const checkAgain = () => {
    setError(null);
    startTransition(async () => {
      const result = await checkReportAgain(reportId);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  return (
    <Card
      title="Risk check"
      subtitle={check ? `Checked ${formatDateTime(check.checked_at)}` : 'Runs by itself when a report is submitted'}
      actions={check ? <RiskPill risk={check.risk} /> : undefined}
      bodyClassName="p-0"
    >
      <div className="px-5 py-4">
        {!check ? (
          <p className="text-[13px] text-muted">
            This report hasn&apos;t been checked yet. It usually takes under a minute. Refresh the page, or check it now.
          </p>
        ) : check.flags.length === 0 ? (
          <p className="flex items-center gap-2 text-[13px] text-ink-soft">
            <CircleCheck size={16} className="shrink-0 text-green" aria-hidden /> Nothing unusual found.
          </p>
        ) : (
          <ul className="flex flex-col gap-3.5">
            {check.flags.map((flag, i) => {
              const { Icon, className, label } = FLAG_ICON[flag.severity];
              return (
                <li key={`${flag.code}-${i}`} className="flex items-start gap-2.5">
                  <Icon size={16} className={`mt-0.5 shrink-0 ${className}`} aria-label={label} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-ink">{flag.title}</div>
                    <p className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">{flag.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-soft px-3 py-2 text-[12.5px] text-red">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className="text-[12px] text-muted">{PHOTO_READING_TEXT[check?.photo_reading ?? 'not_run']}</span>
        <Button size="sm" variant="secondary" disabled={pending} onClick={checkAgain}>
          <RotateCcw size={13} /> {pending ? 'Checking…' : 'Check again'}
        </Button>
      </div>
    </Card>
  );
}
