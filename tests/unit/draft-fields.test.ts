import { describe, expect, it } from 'vitest';
import { backoffDelay } from '@/lib/backoff';
import { MAX_READINGS, fieldProblem, isUuid, sanitizeDraftFields, sanitizeReadings } from '@/lib/draft-fields';

const REPORT = '0b7f6a52-4c1e-4a55-9a0e-2f4f1a9c1d10';
const R1 = '3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const R2 = '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';

describe('fieldProblem', () => {
  it('accepts empty and valid values', () => {
    expect(fieldProblem('humidity_pct', '')).toBeNull();
    expect(fieldProblem('humidity_pct', '47')).toBeNull();
    expect(fieldProblem('manufacturer', 'anything')).toBeNull();
  });

  it('gives plain hints for bad numbers', () => {
    expect(fieldProblem('max_capacity_kg', 'abc')).toBe('Enter a number');
    expect(fieldProblem('interval_e_g', '0')).toBe('Enter a number above 0');
    expect(fieldProblem('humidity_pct', '150')).toBe('Enter a value from 0 to 100');
    expect(fieldProblem('voltage_v', '-1')).toBe('Enter 0 or more');
    expect(fieldProblem('temperature_c', '400')).toBe('Enter a value from -50 to 100');
  });
});

describe('sanitizeDraftFields', () => {
  it('keeps only editable fields and converts numbers', () => {
    const out = sanitizeDraftFields({
      manufacturer: 'Acme',
      max_capacity_kg: '150',
      status: 'approved',
      calculated_result: 'pass',
      created_by: 'someone',
    });
    expect(out).toEqual({ manufacturer: 'Acme', max_capacity_kg: 150 });
  });

  it('saves invalid or out-of-range values as empty instead of failing', () => {
    const out = sanitizeDraftFields({ humidity_pct: '150', interval_e_g: '-2', temperature_c: 'warm', voltage_v: '230' });
    expect(out).toEqual({ humidity_pct: null, interval_e_g: null, temperature_c: null, voltage_v: 230 });
  });

  it('only accepts known choices', () => {
    const out = sanitizeDraftFields({
      accuracy_class: 'V',
      test_stage: 'weird',
      temperature_source: 'guess',
      humidity_source: 'weather',
      weather_confirmed: 'yes',
      test_date: '11/09/2026',
    });
    expect(out).toEqual({
      accuracy_class: null,
      test_stage: 'initial',
      temperature_source: null,
      humidity_source: 'weather',
      weather_confirmed: false,
      test_date: null,
    });
  });

  it('turns blank text into empty and limits long text', () => {
    const out = sanitizeDraftFields({ remarks: '   ', reference_weights: 'x'.repeat(900) });
    expect(out.remarks).toBeNull();
    expect(out.reference_weights).toHaveLength(500);
  });
});

describe('sanitizeReadings', () => {
  it('fills in clause and position and converts numbers', () => {
    const rows = sanitizeReadings(REPORT, [
      { id: R1, test_type: 'Eccentricity', load_kg: '50', reference_kg: '50', indicated_kg: '49.98' },
      { id: R2, test_type: 'Weighing accuracy', load_kg: '', reference_kg: '-3', indicated_kg: '-0.5' },
    ]);
    expect(rows).toEqual([
      { id: R1, report_id: REPORT, test_type: 'Eccentricity', clause: '3.6.2', load_kg: 50, reference_kg: 50, indicated_kg: 49.98, position: 0 },
      { id: R2, report_id: REPORT, test_type: 'Weighing accuracy', clause: 'A.4.4', load_kg: null, reference_kg: null, indicated_kg: -0.5, position: 1 },
    ]);
  });

  it('rejects unknown test types, bad or repeated ids, and too many rows', () => {
    const good = { id: R1, test_type: 'Eccentricity', load_kg: 1, reference_kg: 1, indicated_kg: 1 };
    expect(() => sanitizeReadings(REPORT, [{ ...good, test_type: 'Drop test' }])).toThrow('BAD_VALUE');
    expect(() => sanitizeReadings(REPORT, [{ ...good, id: 'r1' }])).toThrow('BAD_VALUE');
    expect(() => sanitizeReadings(REPORT, [good, good])).toThrow('BAD_VALUE');
    expect(() => sanitizeReadings('nope', [good])).toThrow('BAD_VALUE');
    const many = Array.from({ length: MAX_READINGS + 1 }, (_, i) => ({ ...good, id: `${R1.slice(0, -2)}${String(i).padStart(2, '0')}` }));
    expect(() => sanitizeReadings(REPORT, many)).toThrow('BAD_VALUE');
  });
});

describe('isUuid', () => {
  it('recognises uuids', () => {
    expect(isUuid(REPORT)).toBe(true);
    expect(isUuid('VS-2026-001')).toBe(false);
  });
});

describe('backoffDelay', () => {
  it('doubles from one second up to thirty seconds', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(backoffDelay)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
});
