// Pass/Fail calculation for OIML R 76-1 (2006). Pure: no I/O, no React.
// Ported from the original VeriScale engine; allowed-error rules are data
// passed in, so admin edits change results without code changes.
import type { AccuracyClass, AllowedErrorRule, LiveResult, NumberLike, TestStage } from './types';

export interface CalcInput {
  accuracy_class: AccuracyClass | null;
  interval_e_g: NumberLike;
  test_stage: TestStage;
  load_kg: NumberLike;
  reference_kg: NumberLike;
  indicated_kg: NumberLike;
}

export interface ReadingCalc {
  errorG: number | null;
  allowedErrorG: number | null;
  result: LiveResult;
}

// Table 6 (initial verification). Top bands have no upper limit.
export const DEFAULT_RULES: AllowedErrorRule[] = [
  { id: 'I-1', accuracy_class: 'I', min_n: 0, max_n: 50000, multiplier: 0.5 },
  { id: 'I-2', accuracy_class: 'I', min_n: 50000, max_n: 200000, multiplier: 1.0 },
  { id: 'I-3', accuracy_class: 'I', min_n: 200000, max_n: null, multiplier: 1.5 },
  { id: 'II-1', accuracy_class: 'II', min_n: 0, max_n: 5000, multiplier: 0.5 },
  { id: 'II-2', accuracy_class: 'II', min_n: 5000, max_n: 20000, multiplier: 1.0 },
  { id: 'II-3', accuracy_class: 'II', min_n: 20000, max_n: null, multiplier: 1.5 },
  { id: 'III-1', accuracy_class: 'III', min_n: 0, max_n: 500, multiplier: 0.5 },
  { id: 'III-2', accuracy_class: 'III', min_n: 500, max_n: 2000, multiplier: 1.0 },
  { id: 'III-3', accuracy_class: 'III', min_n: 2000, max_n: null, multiplier: 1.5 },
  { id: 'IIII-1', accuracy_class: 'IIII', min_n: 0, max_n: 50, multiplier: 0.5 },
  { id: 'IIII-2', accuracy_class: 'IIII', min_n: 50, max_n: 200, multiplier: 1.0 },
  { id: 'IIII-3', accuracy_class: 'IIII', min_n: 200, max_n: null, multiplier: 1.5 },
];

// Table 3 — legal range of n = Max / e per class, for a non-blocking hint.
const TABLE3_RANGE: Record<AccuracyClass, { min: number; max: number }> = {
  I: { min: 50000, max: Infinity },
  II: { min: 100, max: 100000 },
  III: { min: 100, max: 10000 },
  IIII: { min: 100, max: 1000 },
};

// Readings are entered to the gram at most; this absorbs floating-point noise
// such as (50.03 − 50) × 1000 = 30.0000000004 without affecting real results.
const TOLERANCE_G = 1e-6;

export function toNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

const upperLimit = (rule: AllowedErrorRule) => rule.max_n ?? Number.POSITIVE_INFINITY;

// Bands cover (min_n, max_n]: a load exactly on a boundary uses the lower band.
export function allowedErrorMultiplier(
  cls: AccuracyClass,
  n: number,
  rules: readonly AllowedErrorRule[],
): number | null {
  if (!Number.isFinite(n) || n < 0) return null;
  const bands = rules
    .filter((r) => r.accuracy_class === cls)
    .sort((a, b) => (upperLimit(a) === upperLimit(b) ? 0 : upperLimit(a) < upperLimit(b) ? -1 : 1));
  if (bands.length === 0) return null;
  for (const band of bands) {
    if (n <= upperLimit(band)) return band.multiplier;
  }
  return bands[bands.length - 1].multiplier;
}

const INCOMPLETE: ReadingCalc = { errorG: null, allowedErrorG: null, result: 'incomplete' };

export function calculateReading(input: CalcInput, rules: readonly AllowedErrorRule[]): ReadingCalc {
  const e = toNum(input.interval_e_g);
  const load = toNum(input.load_kg);
  const reference = toNum(input.reference_kg);
  const indicated = toNum(input.indicated_kg);
  if (!input.accuracy_class || e === null || e <= 0) return INCOMPLETE;
  if (load === null || reference === null || indicated === null) return INCOMPLETE;

  const multiplier = allowedErrorMultiplier(input.accuracy_class, (load * 1000) / e, rules);
  if (multiplier === null) return INCOMPLETE;

  const errorG = (indicated - reference) * 1000;
  const allowedErrorG = multiplier * e * (input.test_stage === 'in_service' ? 2 : 1); // clause 3.5.2
  const result = Math.abs(errorG) <= allowedErrorG + TOLERANCE_G ? 'pass' : 'fail';
  return { errorG, allowedErrorG, result };
}

export function reportResult(results: readonly LiveResult[]): LiveResult {
  if (results.length === 0) return 'incomplete';
  if (results.includes('fail')) return 'fail';
  if (results.includes('incomplete')) return 'incomplete';
  return 'pass';
}

export function table3Hint(cls: AccuracyClass | null, maxKg: NumberLike, eG: NumberLike): string | null {
  const max = toNum(maxKg);
  const e = toNum(eG);
  if (!cls || max === null || e === null || e <= 0) return null;
  const range = TABLE3_RANGE[cls];
  const n = (max * 1000) / e;
  if (n >= range.min && n <= range.max) return null;
  const upper = range.max === Infinity ? 'no upper limit' : range.max.toLocaleString('en-GB');
  return `Max ÷ e is ${Math.round(n).toLocaleString('en-GB')}, outside the OIML R 76 Table 3 range for Class ${cls} (${range.min.toLocaleString('en-GB')}–${upper}). Check the capacity and interval.`;
}
