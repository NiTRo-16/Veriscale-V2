// Numbers for the dashboards. Pure functions; weeks start on Monday (UTC).
import type { AccuracyClass, ReportStatus } from './types';

export interface DashboardReport {
  status: ReportStatus;
  accuracy_class: AccuracyClass | null;
  created_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
}

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Reviewers are asked to decide within this many days of a report being submitted. */
export const REVIEW_TARGET_DAYS = 2;

export function statusCounts(reports: readonly DashboardReport[]) {
  const counts = { all: reports.length, draft: 0, pending: 0, approved: 0, failed: 0 };
  for (const r of reports) counts[r.status] += 1;
  return counts;
}

/** Monday 00:00 UTC of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const daysSinceMonday = (new Date(midnight).getUTCDay() + 6) % 7;
  return new Date(midnight - daysSinceMonday * DAY);
}

function weekStarts(now: Date, weeks: number): Date[] {
  const current = startOfWeek(now).getTime();
  return Array.from({ length: weeks }, (_, i) => new Date(current - (weeks - 1 - i) * WEEK));
}

function countByWeek(dates: ReadonlyArray<string | null>, starts: Date[]): number[] {
  const counts = starts.map(() => 0);
  const first = starts[0].getTime();
  for (const value of dates) {
    if (!value) continue;
    const index = Math.floor((startOfWeek(new Date(value)).getTime() - first) / WEEK);
    if (index >= 0 && index < counts.length) counts[index] += 1;
  }
  return counts;
}

/** Reports submitted per week, oldest first; the last entry is the current week. */
export function weeklySubmitted(reports: readonly DashboardReport[], now: Date, weeks = 12) {
  const starts = weekStarts(now, weeks);
  const counts = countByWeek(reports.map((r) => r.submitted_at), starts);
  return starts.map((weekStart, i) => ({ weekStart, count: counts[i] }));
}

export function submittedVsReviewed(reports: readonly DashboardReport[], now: Date, weeks = 6) {
  const starts = weekStarts(now, weeks);
  const submitted = countByWeek(reports.map((r) => r.submitted_at), starts);
  const reviewed = countByWeek(reports.map((r) => r.reviewed_at), starts);
  return starts.map((weekStart, i) => ({ weekStart, submitted: submitted[i], reviewed: reviewed[i] }));
}

/** Reports decided (approved or failed) per week, oldest first, split by outcome. */
export function weeklyDecided(reports: readonly DashboardReport[], now: Date, weeks = 8) {
  const starts = weekStarts(now, weeks);
  const approved = countByWeek(
    reports.filter((r) => r.status === 'approved').map((r) => r.reviewed_at),
    starts,
  );
  const failed = countByWeek(
    reports.filter((r) => r.status === 'failed').map((r) => r.reviewed_at),
    starts,
  );
  return starts.map((weekStart, i) => ({ weekStart, approved: approved[i], failed: failed[i], count: approved[i] + failed[i] }));
}

/** Whole days between a report's submission and `now` (or its decision, if `until` is given). */
export function daysWaiting(submittedAt: string, now: Date, until?: string | null): number {
  const end = until ? new Date(until).getTime() : now.getTime();
  return Math.floor((end - new Date(submittedAt).getTime()) / DAY);
}

export interface WaitingBucket {
  label: string;
  count: number;
}

/** Buckets pending reports by how long they've been waiting: Today, 1 day, 2 days, 3+ days. */
export function waitingBuckets(submittedDates: readonly string[], now: Date): WaitingBucket[] {
  const buckets = { today: 0, one: 0, two: 0, threePlus: 0 };
  for (const submittedAt of submittedDates) {
    const days = daysWaiting(submittedAt, now);
    if (days <= 0) buckets.today += 1;
    else if (days === 1) buckets.one += 1;
    else if (days === 2) buckets.two += 1;
    else buckets.threePlus += 1;
  }
  return [
    { label: 'Today', count: buckets.today },
    { label: '1 day', count: buckets.one },
    { label: '2 days', count: buckets.two },
    { label: '3+ days', count: buckets.threePlus },
  ];
}

/** Submitted reports by accuracy class (drafts are left out). */
export function classCounts(reports: readonly DashboardReport[]): Record<AccuracyClass, number> {
  const counts: Record<AccuracyClass, number> = { I: 0, II: 0, III: 0, IIII: 0 };
  for (const r of reports) if (r.status !== 'draft' && r.accuracy_class) counts[r.accuracy_class] += 1;
  return counts;
}

/** Percentage change from the second-last to the last value, or null when there is nothing to compare. */
export function changeVsPrevious(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const previous = values[values.length - 2];
  if (previous === 0) return null;
  return Math.round(((values[values.length - 1] - previous) / previous) * 100);
}

export function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/** A tidy top for a chart axis whose halfway mark is a whole number: 2, 4, 6, 8, 10, 20, 40 … */
export function niceCeiling(value: number): number {
  if (!Number.isFinite(value) || value <= 2) return 2;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = [1, 2, 4, 6, 8, 10].find((s) => normalized <= s) ?? 10;
  return step * magnitude;
}

/** "7 Sep" */
export function weekLabel(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}
