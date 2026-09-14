// What stops a draft from being submitted, and what a reviewer may decide.
import { toNum } from './calc';
import type { AccuracyClass, ConditionSource, NumberLike, ReadingInput, StoredResult } from './types';

export interface DraftForReadiness {
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  accuracy_class: AccuracyClass | null;
  max_capacity_kg: NumberLike;
  interval_e_g: NumberLike;
  test_date: string | null;
  temperature_source: ConditionSource | null;
  humidity_source: ConditionSource | null;
  weather_confirmed: boolean;
  /** True when the picked weight set is past its check date on the test date. */
  weight_set_overdue?: boolean;
}

const REQUIRED_TEXT: ReadonlyArray<[keyof DraftForReadiness, string]> = [
  ['manufacturer', 'Manufacturer'],
  ['model', 'Model'],
  ['serial_number', 'Serial number'],
  ['accuracy_class', 'Accuracy class'],
];
const REQUIRED_POSITIVE: ReadonlyArray<[keyof DraftForReadiness, string]> = [
  ['max_capacity_kg', 'Maximum capacity'],
  ['interval_e_g', 'Verification interval'],
];

const isBlank = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export function isReadingComplete(r: ReadingInput): boolean {
  return toNum(r.load_kg) !== null && toNum(r.reference_kg) !== null && toNum(r.indicated_kg) !== null;
}

export function submitProblems(report: DraftForReadiness, readings: readonly ReadingInput[]): string[] {
  const problems: string[] = [];

  const missing = [
    ...REQUIRED_TEXT.filter(([key]) => isBlank(report[key])).map(([, label]) => label),
    ...REQUIRED_POSITIVE.filter(([key]) => {
      const n = toNum(report[key]);
      return n === null || n <= 0;
    }).map(([, label]) => label),
    ...(isBlank(report.test_date) ? ['Test date'] : []),
  ];
  if (missing.length > 0) problems.push(`Fill in: ${missing.join(', ')}`);

  if (readings.length === 0) {
    problems.push('Add at least one reading');
  } else {
    const incomplete = readings.filter((r) => !isReadingComplete(r)).length;
    if (incomplete > 0) problems.push(`${incomplete} ${incomplete === 1 ? 'reading' : 'readings'} incomplete`);
  }

  const usesWeather = report.temperature_source === 'weather' || report.humidity_source === 'weather';
  if (usesWeather && !report.weather_confirmed) problems.push('Confirm weather values');
  if (report.weight_set_overdue) problems.push("Choose a weight set that isn't overdue");

  return problems;
}

export function reviewOptions(calculated: StoredResult | null): { canApprove: boolean; failNoteRequired: boolean } {
  if (calculated === 'pass') return { canApprove: true, failNoteRequired: true };
  return { canApprove: false, failNoteRequired: false };
}
