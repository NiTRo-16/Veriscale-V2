// Records: manufacturers, instrument models and reference weight sets.
// Pure helpers shared by the records pages, the draft editor and the server actions.
import { toNum } from './calc';
import { isUuid } from './draft-fields';
import { WEIGHT_CLASSES } from './labels';
import type { ReportStatus, TestStage, WeightClass, WeightState } from './types';

/** A weight set whose check falls within this many days is "due soon". */
export const DUE_SOON_DAYS = 30;

const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// ---- Dates (all YYYY-MM-DD, worked out in UTC so they never shift) ----

/** Today's date in the lab's time zone. */
export function todayDate(now: Date = new Date(), timeZone = process.env.NEXT_PUBLIC_TIME_ZONE || 'UTC'): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export const isDateOnly = (v: unknown): v is string =>
  typeof v === 'string' && DATE_ONLY.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);

export function addDays(date: string, days: number): string {
  return new Date(utc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY_MS);
}

/** The first day of the month `months` after the month `date` falls in. */
export function shiftMonth(date: string, months: number): string {
  const d = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1 + months, 1));
  return d.toISOString().slice(0, 10);
}

// ---- Weight set status ----

export interface WeightStatus {
  state: WeightState;
  /** Days until the next check; negative once it is overdue. */
  days: number;
}

export function weightStatus(nextCheck: string, today: string): WeightStatus {
  const days = daysBetween(today, nextCheck);
  const state: WeightState = days < 0 ? 'overdue' : days <= DUE_SOON_DAYS ? 'due_soon' : 'in_date';
  return { state, days };
}

const dayWord = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

export function weightStatusLabel({ state, days }: WeightStatus): string {
  if (state === 'in_date') return 'In date';
  if (state === 'overdue') return `Overdue ${dayWord(-days)}`;
  return days === 0 ? 'Due today' : `Due in ${dayWord(days)}`;
}

/** True when a weight set can't be used for a test on this date. The check day itself is still fine. */
export function isOverdueOn(nextCheck: string | null | undefined, date: string): boolean {
  return Boolean(nextCheck) && (nextCheck as string) < date;
}

/** The text saved in a report's "Reference weights used" field when a set is picked. */
export function weightSetSummary(set: {
  code: string;
  weight_class: WeightClass;
  nominal_range: string | null;
  certificate_no: string | null;
}): string {
  return [set.code, set.weight_class, set.nominal_range, set.certificate_no && `certificate ${set.certificate_no}`]
    .filter(Boolean)
    .join(' · ');
}

// ---- Validation (plain messages, or null when fine) ----

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const positive = (v: unknown) => {
  const n = toNum(v as string | number | null);
  return n !== null && n > 0;
};

/** Longest names and codes the database accepts. */
export const MAX_NAME = 120;
export const MAX_CODE = 60;

export function validateManufacturer(input: { name: unknown }): string | null {
  if (!text(input.name)) return "Enter the manufacturer's name.";
  if (text(input.name).length > MAX_NAME) return `Keep the name to ${MAX_NAME} characters or fewer.`;
  return null;
}

export function validateModel(input: {
  manufacturerId: unknown;
  name: unknown;
  accuracyClass: unknown;
  maxCapacityKg: unknown;
  intervalEG: unknown;
}): string | null {
  if (!isUuid(input.manufacturerId)) return 'Choose a manufacturer.';
  if (!text(input.name)) return 'Enter the model name.';
  if (text(input.name).length > MAX_NAME) return `Keep the name to ${MAX_NAME} characters or fewer.`;
  if (!['I', 'II', 'III', 'IIII'].includes(text(input.accuracyClass))) return 'Choose an accuracy class.';
  if (!positive(input.maxCapacityKg)) return 'Enter a maximum capacity above 0.';
  if (!positive(input.intervalEG)) return 'Enter a verification interval above 0.';
  return null;
}

export function validateWeightSet(input: {
  code: unknown;
  weightClass: unknown;
  lastChecked: unknown;
  nextCheck: unknown;
}): string | null {
  if (!text(input.code)) return 'Enter the weight set code.';
  if (text(input.code).length > MAX_CODE) return `Keep the code to ${MAX_CODE} characters or fewer.`;
  if (!WEIGHT_CLASSES.includes(text(input.weightClass) as WeightClass)) return 'Choose a weight class.';
  const last = text(input.lastChecked);
  if (last && !isDateOnly(last)) return 'Enter a real date for the last check.';
  if (!isDateOnly(text(input.nextCheck))) return 'Enter the next check date.';
  if (last && text(input.nextCheck) <= last) return 'The next check must be after the last check.';
  return null;
}

// ---- Reports linked to records ----

export interface RecordReport {
  id: string;
  report_no: string;
  status: ReportStatus;
  manufacturer: string | null;
  manufacturer_id: string | null;
  model: string | null;
  model_id: string | null;
  serial_number: string | null;
  test_stage: TestStage;
  test_date: string | null;
  created_at: string;
  submitted_at: string | null;
  weight_set_id: string | null;
}

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

/** Reports picked from the list match by id; older typed-in reports match by name. */
export function belongsToManufacturer(r: RecordReport, m: { id: string; name: string }): boolean {
  if (r.manufacturer_id) return r.manufacturer_id === m.id;
  return norm(r.manufacturer) !== '' && norm(r.manufacturer) === norm(m.name);
}

export function belongsToModel(
  r: RecordReport,
  model: { id: string; name: string },
  manufacturer?: { id: string; name: string },
): boolean {
  if (r.model_id) return r.model_id === model.id;
  if (norm(r.model) === '' || norm(r.model) !== norm(model.name)) return false;
  return manufacturer ? belongsToManufacturer(r, manufacturer) : true;
}

/** When a report's test happened, falling back to when it was sent or started. */
export const testedOn = (r: RecordReport) => r.test_date ?? r.submitted_at ?? r.created_at;

const latestFirst = (a: RecordReport, b: RecordReport) => (testedOn(a) < testedOn(b) ? 1 : testedOn(a) > testedOn(b) ? -1 : 0);

export interface RecordStats {
  /** Reports sent for review (drafts are left out). */
  reports: number;
  approved: number;
  failed: number;
  /** Approved out of decided, as a whole percent; null before any decision. */
  passedPct: number | null;
  lastTested: string | null;
}

export function recordStats(reports: readonly RecordReport[]): RecordStats {
  const sent = reports.filter((r) => r.status !== 'draft');
  const approved = sent.filter((r) => r.status === 'approved').length;
  const failed = sent.filter((r) => r.status === 'failed').length;
  const decided = approved + failed;
  return {
    reports: sent.length,
    approved,
    failed,
    passedPct: decided === 0 ? null : Math.round((approved * 100) / decided),
    lastTested: sent.length === 0 ? null : testedOn([...sent].sort(latestFirst)[0]),
  };
}

/** The latest report for each serial number, newest first. */
export function latestPerInstrument(reports: readonly RecordReport[]): Array<{ serial: string; report: RecordReport; count: number }> {
  const groups = new Map<string, RecordReport[]>();
  for (const r of reports) {
    const key = norm(r.serial_number);
    if (r.status === 'draft' || key === '') continue;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()]
    .map((group) => {
      const report = [...group].sort(latestFirst)[0];
      return { serial: (report.serial_number ?? '').trim(), report, count: group.length };
    })
    .sort((a, b) => latestFirst(a.report, b.report));
}

/** The latest report in a list, or null. */
export function latestReport(reports: readonly RecordReport[]): RecordReport | null {
  const sent = reports.filter((r) => r.status !== 'draft');
  return sent.length === 0 ? null : [...sent].sort(latestFirst)[0];
}

/** A records page link carrying only the query values that are set. */
export function recordsHref(base: string, params: Record<string, string | null | undefined> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

// ---- Check schedule chart ----

export interface ScheduleWindow {
  start: string;
  end: string;
  days: number;
}

/** Whole months covering every set's last and next check, and today. */
export function scheduleWindow(sets: ReadonlyArray<{ last_checked: string | null; next_check: string }>, today: string): ScheduleWindow {
  const dates = [today, ...sets.flatMap((s) => [s.last_checked ?? addDays(s.next_check, -365), s.next_check])].sort();
  const start = shiftMonth(dates[0], 0);
  const end = shiftMonth(dates[dates.length - 1], 1);
  return { start, end, days: daysBetween(start, end) };
}

/** Month starts to label along the top, spaced so there are no more than about eight. */
export function monthTicks(window: ScheduleWindow): string[] {
  const months =
    (Number(window.end.slice(0, 4)) - Number(window.start.slice(0, 4))) * 12 +
    Number(window.end.slice(5, 7)) -
    Number(window.start.slice(5, 7));
  const step = months <= 8 ? 1 : months <= 16 ? 2 : months <= 24 ? 3 : months <= 48 ? 6 : 12;
  const ticks: string[] = [];
  for (let i = 0; i <= months; i += step) ticks.push(shiftMonth(window.start, i));
  return ticks;
}

/** Where a date falls across the window, from 0 to 1. */
export function schedulePosition(date: string, window: ScheduleWindow): number {
  if (window.days <= 0) return 0;
  return Math.min(1, Math.max(0, daysBetween(window.start, date) / window.days));
}
