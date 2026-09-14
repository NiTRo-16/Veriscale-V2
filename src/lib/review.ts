// The review desk's numbers and wording: how close each reading is to its
// limit, what VeriScale checked by itself, and what has happened to a report.
// Pure functions; no I/O, no React.
import { startOfWeek } from './dashboard';
import { PHOTO_KIND_LABEL } from './labels';
import { submitProblems, type DraftForReadiness } from './readiness';
import type { ConditionSource, Decision, PhotoKind, ReadingInput, ReportRow, StoredResult } from './types';

const DAY = 86_400_000;

/** Readings that use at least this much of their allowed error get a second look. */
export const NEAR_LIMIT_PCT = 80;

/** Photos a reviewer expects to find on every report. */
export const REQUIRED_PHOTO_KINDS: readonly PhotoKind[] = ['nameplate', 'display', 'setup', 'seals'];

/** How much of its allowed error a reading uses, as a whole percentage. */
export function shareOfLimit(errorG: number | null, allowedErrorG: number | null): number | null {
  if (errorG === null || allowedErrorG === null) return null;
  if (!Number.isFinite(errorG) || !Number.isFinite(allowedErrorG) || allowedErrorG <= 0) return null;
  return Math.round((Math.abs(errorG) / allowedErrorG) * 100);
}

export interface ReadingsTally {
  total: number;
  inside: number;
  over: number;
}

export function tallyReadings(results: ReadonlyArray<StoredResult | null>): ReadingsTally {
  return {
    total: results.length,
    inside: results.filter((r) => r === 'pass').length,
    over: results.filter((r) => r === 'fail').length,
  };
}

/** "5 of 5 readings inside limit", "1 of 6 readings over limit" */
export function tallyText({ total, inside, over }: ReadingsTally): string {
  if (total === 0) return 'No readings';
  const noun = total === 1 ? 'reading' : 'readings';
  return over > 0 ? `${over} of ${total} ${noun} over limit` : `${inside} of ${total} ${noun} inside limit`;
}

/** "Today", "1 day", "3 days" */
export function waitingText(days: number): string {
  if (days <= 0) return 'Today';
  return days === 1 ? '1 day' : `${days} days`;
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] || name;

/** A note is needed to send a report back, and to fail a report whose readings passed. */
export function noteRequired(decision: Decision, calculated: StoredResult | null): boolean {
  return decision === 'sent_back' || (decision === 'failed' && calculated === 'pass');
}

/** The one source to show for a report's conditions: the least dependable of the two. */
export function mainSource(...sources: Array<ConditionSource | null>): ConditionSource | null {
  for (const source of ['manual', 'weather', 'sensor'] as const) {
    if (sources.includes(source)) return source;
  }
  return null;
}

export interface AutoCheck {
  label: string;
  /** false means the reviewer should take a closer look. */
  ok: boolean;
}

function conditionsCheck(sources: Array<ConditionSource | null>, weatherConfirmed: boolean): AutoCheck {
  if (sources.every((s) => s === 'sensor')) return { ok: true, label: 'Temperature and humidity came from the sensor' };
  if (sources.includes(null)) return { ok: false, label: 'Temperature or humidity is missing' };
  if (sources.includes('manual')) return { ok: false, label: 'Temperature or humidity was typed in, not read from the sensor' };
  return {
    ok: false,
    label: weatherConfirmed
      ? 'Temperature or humidity is a weather estimate, confirmed by the technician'
      : 'Weather estimate for temperature or humidity was not confirmed',
  };
}

/** What VeriScale can check without a person looking at the photos. */
export function automaticChecks(
  report: DraftForReadiness & { reference_weights: string | null },
  readings: readonly ReadingInput[],
  photoKinds: readonly PhotoKind[],
): AutoCheck[] {
  const problems = submitProblems(report, readings);
  const missingPhotos = REQUIRED_PHOTO_KINDS.filter((kind) => !photoKinds.includes(kind));
  return [
    problems.length === 0 ? { ok: true, label: 'All required details filled in' } : { ok: false, label: problems.join(' · ') },
    conditionsCheck([report.temperature_source, report.humidity_source], report.weather_confirmed),
    report.reference_weights?.trim()
      ? { ok: true, label: 'Reference weights recorded' }
      : { ok: false, label: 'Reference weights not recorded' },
    missingPhotos.length === 0
      ? { ok: true, label: 'Nameplate, display, setup and seals photos added' }
      : {
          ok: false,
          label: `Missing ${missingPhotos.length === 1 ? 'photo' : 'photos'}: ${missingPhotos.map((k) => PHOTO_KIND_LABEL[k]).join(', ')}`,
        },
  ];
}

export interface HistoryStep {
  at: string;
  who: string;
  text: string;
  note: string | null;
  tone: 'green' | 'amber' | 'red' | 'gray';
}

type HistoryFields = Pick<
  ReportRow,
  | 'status'
  | 'created_by'
  | 'created_at'
  | 'submitted_at'
  | 'reviewed_by'
  | 'reviewed_at'
  | 'review_note'
  | 'sent_back_by'
  | 'sent_back_at'
  | 'send_back_note'
>;

/** What has happened to a report, oldest first, built from the dates stored on it. */
export function reportHistory(report: HistoryFields, people: Readonly<Record<string, string>>): HistoryStep[] {
  const name = (id: string | null) => (id && people[id]) || 'Someone';
  const steps: HistoryStep[] = [
    { at: report.created_at, who: name(report.created_by), text: 'started the draft', note: null, tone: 'gray' },
  ];
  if (report.sent_back_at) {
    steps.push({
      at: report.sent_back_at,
      who: name(report.sent_back_by),
      text: 'sent it back for changes',
      note: report.send_back_note,
      tone: 'amber',
    });
  }
  if (report.submitted_at) {
    steps.push({
      at: report.submitted_at,
      who: name(report.created_by),
      text: report.sent_back_at ? 'sent the report for review again' : 'sent the report for review',
      note: null,
      tone: 'amber',
    });
  }
  if (report.reviewed_at && (report.status === 'approved' || report.status === 'failed')) {
    const approved = report.status === 'approved';
    steps.push({
      at: report.reviewed_at,
      who: name(report.reviewed_by),
      text: approved ? 'approved the report' : 'failed the report',
      note: report.review_note,
      tone: approved ? 'green' : 'red',
    });
  }
  return steps.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export interface DecisionEntry<T> {
  report: T;
  kind: Decision;
  at: string;
  note: string | null;
}

type DecisionFields = Pick<
  ReportRow,
  'status' | 'reviewed_by' | 'reviewed_at' | 'review_note' | 'sent_back_by' | 'sent_back_at' | 'send_back_note'
>;

/** Every approve, fail and send-back by one person, newest first. One report can appear twice. */
export function decisionEntries<T extends DecisionFields>(reports: readonly T[], userId: string): DecisionEntry<T>[] {
  const entries: DecisionEntry<T>[] = [];
  for (const report of reports) {
    if (report.reviewed_by === userId && report.reviewed_at && (report.status === 'approved' || report.status === 'failed')) {
      entries.push({
        report,
        kind: report.status === 'approved' ? 'approved' : 'failed',
        at: report.reviewed_at,
        note: report.review_note,
      });
    }
    if (report.sent_back_by === userId && report.sent_back_at) {
      entries.push({ report, kind: 'sent_back', at: report.sent_back_at, note: report.send_back_note });
    }
  }
  return entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** How many of the dates fall in the current week and in the week before it. */
export function thisWeekVsLast(dates: ReadonlyArray<string | null>, now: Date): { thisWeek: number; lastWeek: number } {
  const thisStart = startOfWeek(now).getTime();
  const lastStart = thisStart - 7 * DAY;
  let thisWeek = 0;
  let lastWeek = 0;
  for (const value of dates) {
    if (!value) continue;
    const time = Date.parse(value);
    if (time >= thisStart) thisWeek += 1;
    else if (time >= lastStart) lastWeek += 1;
  }
  return { thisWeek, lastWeek };
}

/** Where a report sits in the queue (ids oldest first), and where to go once it is decided. */
export function queuePosition(ids: readonly string[], id: string) {
  const index = ids.indexOf(id);
  const inQueue = index !== -1;
  return {
    position: inQueue ? index + 1 : null,
    total: ids.length,
    previous: index > 0 ? ids[index - 1] : null,
    next: inQueue && index < ids.length - 1 ? ids[index + 1] : null,
    afterDecision: (inQueue ? ids[index + 1] : undefined) ?? ids.find((other) => other !== id) ?? null,
  };
}
