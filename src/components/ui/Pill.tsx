import type { ReactNode } from 'react';
import { DECISION_LABEL, RESULT_LABEL, RISK_LABEL, SOURCE_LABEL, STATUS_LABEL } from '@/lib/labels';
import type { RiskLevel } from '@/lib/risk';
import type { ConditionSource, Decision, LiveResult, ReportStatus } from '@/lib/types';

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray';

const TONES: Record<Tone, string> = {
  green: 'bg-green-soft text-green-ink',
  amber: 'bg-amber-soft text-amber-ink',
  red: 'bg-red-soft text-red-ink',
  blue: 'bg-blue-soft text-blue-ink',
  gray: 'bg-hover text-ink-soft',
};

export function Pill({ tone = 'gray', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<ReportStatus, Tone> = {
  draft: 'blue',
  pending: 'amber',
  approved: 'green',
  failed: 'red',
};

export function StatusPill({ status }: { status: ReportStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>;
}

export const DECISION_TONE: Record<Decision, Tone> = {
  approved: 'green',
  failed: 'red',
  sent_back: 'amber',
};

export function DecisionPill({ decision }: { decision: Decision }) {
  return <Pill tone={DECISION_TONE[decision]}>{DECISION_LABEL[decision]}</Pill>;
}

export const SOURCE_TONE: Record<ConditionSource, Tone> = { sensor: 'green', manual: 'gray', weather: 'amber' };

export function SourcePill({ source }: { source: ConditionSource }) {
  return <Pill tone={SOURCE_TONE[source]}>{SOURCE_LABEL[source]}</Pill>;
}

export const RISK_TONE: Record<RiskLevel, Tone> = { low: 'green', medium: 'amber', high: 'red' };

export function RiskPill({ risk }: { risk: RiskLevel | null }) {
  if (!risk) return <span className="whitespace-nowrap text-[12px] text-muted">Not checked yet</span>;
  return <Pill tone={RISK_TONE[risk]}>{RISK_LABEL[risk]}</Pill>;
}

export function ResultText({ result }: { result: LiveResult | null }) {
  if (!result) return <span className="text-faint">—</span>;
  const color = result === 'pass' ? 'text-green-ink' : result === 'fail' ? 'text-red' : 'text-muted';
  return <span className={`font-semibold ${color}`}>{RESULT_LABEL[result]}</span>;
}
