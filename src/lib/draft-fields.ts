// Cleans what the draft editor sends before it is saved, so a half-typed or
// out-of-range value never makes autosave fail over and over. Shared by the
// editor (for field hints) and the server actions (for saving).
import { toNum } from './calc';
import { TEST_TYPES } from './labels';
import {
  EDITABLE_REPORT_FIELDS,
  type AccuracyClass,
  type ConditionSource,
  type EditableReportFields,
  type NumberLike,
} from './types';

const NUMBER_FIELDS = new Set(['max_capacity_kg', 'interval_e_g', 'temperature_c', 'humidity_pct', 'voltage_v']);
const CLASSES = new Set<AccuracyClass>(['I', 'II', 'III', 'IIII']);
const SOURCES = new Set<ConditionSource>(['sensor', 'manual', 'weather']);
const MAX_TEXT = 500;
export const MAX_READINGS = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

const isBlank = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** A plain hint for a number field, or null when the value is fine (or empty). */
export function fieldProblem(key: string, raw: unknown): string | null {
  if (!NUMBER_FIELDS.has(key) || isBlank(raw)) return null;
  const n = toNum(raw);
  if (n === null) return 'Enter a number';
  if ((key === 'max_capacity_kg' || key === 'interval_e_g') && n <= 0) return 'Enter a number above 0';
  if (key === 'humidity_pct' && (n < 0 || n > 100)) return 'Enter a value from 0 to 100';
  if (key === 'voltage_v' && n < 0) return 'Enter 0 or more';
  if (key === 'temperature_c' && (n < -50 || n > 100)) return 'Enter a value from -50 to 100';
  return null;
}

export function sanitizeDraftFields(input: Record<string, unknown>): Partial<EditableReportFields> {
  const out: Record<string, unknown> = {};
  for (const key of EDITABLE_REPORT_FIELDS) {
    if (!(key in input)) continue;
    const value = input[key];
    if (NUMBER_FIELDS.has(key)) {
      out[key] = fieldProblem(key, value) ? null : toNum(value);
    } else if (key === 'accuracy_class') {
      out[key] = CLASSES.has(value as AccuracyClass) ? value : null;
    } else if (key === 'test_stage') {
      out[key] = value === 'in_service' ? 'in_service' : 'initial';
    } else if (key === 'temperature_source' || key === 'humidity_source') {
      out[key] = SOURCES.has(value as ConditionSource) ? value : null;
    } else if (key === 'weather_confirmed') {
      out[key] = value === true;
    } else if (key === 'test_date') {
      out[key] = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
    } else if (key === 'manufacturer_id' || key === 'model_id' || key === 'weight_set_id') {
      out[key] = isUuid(value) ? value : null;
    } else {
      out[key] = typeof value === 'string' && value.trim() !== '' ? value.slice(0, MAX_TEXT) : null;
    }
  }
  return out as Partial<EditableReportFields>;
}

export interface ReadingDraft {
  id: string;
  test_type: string;
  load_kg: NumberLike;
  reference_kg: NumberLike;
  indicated_kg: NumberLike;
}

export interface ReadingRowToSave {
  id: string;
  report_id: string;
  test_type: string;
  clause: string;
  load_kg: number | null;
  reference_kg: number | null;
  indicated_kg: number | null;
  position: number;
}

const nonNegative = (v: NumberLike) => {
  const n = toNum(v);
  return n === null || n < 0 ? null : n;
};

/** Validates readings for saving. Throws BAD_VALUE for anything that isn't a real reading. */
export function sanitizeReadings(reportId: string, readings: readonly ReadingDraft[]): ReadingRowToSave[] {
  if (!isUuid(reportId) || !Array.isArray(readings) || readings.length > MAX_READINGS) throw new Error('BAD_VALUE');
  const seen = new Set<string>();
  return readings.map((r, position) => {
    if (!isUuid(r.id) || seen.has(r.id)) throw new Error('BAD_VALUE');
    seen.add(r.id);
    const type = TEST_TYPES.find((t) => t.name === r.test_type);
    if (!type) throw new Error('BAD_VALUE');
    return {
      id: r.id,
      report_id: reportId,
      test_type: type.name,
      clause: type.clause,
      load_kg: nonNegative(r.load_kg),
      reference_kg: nonNegative(r.reference_kg),
      indicated_kg: toNum(r.indicated_kg),
      position,
    };
  });
}
