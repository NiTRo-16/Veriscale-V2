import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  allowedErrorMultiplier,
  calculateReading,
  reportResult,
  table3Hint,
  type CalcInput,
} from '@/lib/calc';
import type { AccuracyClass } from '@/lib/types';

const input = (partial: Partial<CalcInput>): CalcInput => ({
  accuracy_class: null,
  interval_e_g: null,
  test_stage: 'initial',
  load_kg: null,
  reference_kg: null,
  indicated_kg: null,
  ...partial,
});

describe('acceptance examples', () => {
  const base = { accuracy_class: 'III' as const, interval_e_g: 20, reference_kg: 50, indicated_kg: 50.025 };

  it('ref 50.000 / ind 50.025 at load 50 kg → +25.0 g, ±30.0 g, pass', () => {
    const c = calculateReading(input({ ...base, load_kg: 50 }), DEFAULT_RULES);
    expect(c.errorG).toBeCloseTo(25, 6);
    expect(c.allowedErrorG).toBeCloseTo(30, 6);
    expect(c.result).toBe('pass');
  });

  it('same reading at load 5 kg → ±10.0 g, fail', () => {
    const c = calculateReading(input({ ...base, load_kg: 5 }), DEFAULT_RULES);
    expect(c.errorG).toBeCloseTo(25, 6);
    expect(c.allowedErrorG).toBeCloseTo(10, 6);
    expect(c.result).toBe('fail');
  });
});

describe('Class III band boundaries (e = 20 g)', () => {
  const loadForN = (n: number) => (n * 20) / 1000;
  const allowedAt = (n: number) =>
    calculateReading(
      input({ accuracy_class: 'III', interval_e_g: 20, load_kg: loadForN(n), reference_kg: 1, indicated_kg: 1 }),
      DEFAULT_RULES,
    ).allowedErrorG;

  it('n = 500 (boundary) → 0.5 × e = 10 g', () => expect(allowedAt(500)).toBeCloseTo(10, 6));
  it('n just above 500 → 1.0 × e = 20 g', () => expect(allowedAt(500.0001)).toBeCloseTo(20, 6));
  it('n = 2000 (boundary) → 20 g', () => expect(allowedAt(2000)).toBeCloseTo(20, 6));
  it('n just above 2000 → 1.5 × e = 30 g', () => expect(allowedAt(2000.0001)).toBeCloseTo(30, 6));
  it('n = 10000 (boundary) → 30 g', () => expect(allowedAt(10000)).toBeCloseTo(30, 6));
  it('n above the top band still uses the top multiplier', () => {
    expect(allowedErrorMultiplier('III', 999999, DEFAULT_RULES)).toBe(1.5);
  });
});

describe('low-load multipliers per class', () => {
  it('Class I at n = 50000 → 0.5', () => expect(allowedErrorMultiplier('I', 50000, DEFAULT_RULES)).toBe(0.5));
  it('Class II at n = 5000 → 0.5', () => expect(allowedErrorMultiplier('II', 5000, DEFAULT_RULES)).toBe(0.5));
  it('Class IIII at n = 50 → 0.5', () => expect(allowedErrorMultiplier('IIII', 50, DEFAULT_RULES)).toBe(0.5));
  it('unknown class → null', () =>
    expect(allowedErrorMultiplier('X' as AccuracyClass, 100, DEFAULT_RULES)).toBeNull());
  it('negative n → null', () => expect(allowedErrorMultiplier('III', -1, DEFAULT_RULES)).toBeNull());
});

describe('open-ended top band', () => {
  it('top bands are stored with no upper limit', () => {
    const tops = DEFAULT_RULES.filter((r) => r.max_n === null).map((r) => r.id).sort();
    expect(tops).toEqual(['I-3', 'II-3', 'III-3', 'IIII-3']);
  });

  it('a rule with max_n = null covers any larger n', () => {
    expect(allowedErrorMultiplier('I', 1e12, DEFAULT_RULES)).toBe(1.5);
  });
});

describe('limit handling', () => {
  it('an error exactly at the allowed error passes despite floating-point noise', () => {
    // (50.03 − 50) × 1000 evaluates to 30.0000000004 in floating point
    const c = calculateReading(
      input({ accuracy_class: 'III', interval_e_g: 20, load_kg: 50, reference_kg: 50, indicated_kg: 50.03 }),
      DEFAULT_RULES,
    );
    expect(c.allowedErrorG).toBeCloseTo(30, 6);
    expect(c.result).toBe('pass');
  });

  it('one gram over the allowed error fails', () => {
    const c = calculateReading(
      input({ accuracy_class: 'III', interval_e_g: 20, load_kg: 50, reference_kg: 50, indicated_kg: 50.031 }),
      DEFAULT_RULES,
    );
    expect(c.result).toBe('fail');
  });
});

describe('in-service inspection', () => {
  it('doubles the allowed error', () => {
    const common = { accuracy_class: 'III' as const, interval_e_g: 20, load_kg: 50, reference_kg: 50, indicated_kg: 50.025 };
    const initial = calculateReading(input({ ...common, test_stage: 'initial' }), DEFAULT_RULES);
    const inService = calculateReading(input({ ...common, test_stage: 'in_service' }), DEFAULT_RULES);
    expect(inService.allowedErrorG).toBeCloseTo(initial.allowedErrorG! * 2, 6);
    expect(inService.allowedErrorG).toBeCloseTo(60, 6);
    expect(inService.result).toBe('pass');
  });
});

describe('incomplete or invalid input gives no numbers', () => {
  const cases: Partial<CalcInput>[] = [
    {},
    { accuracy_class: 'III', interval_e_g: 20 },
    { accuracy_class: 'III', interval_e_g: 20, load_kg: 50, reference_kg: 50 },
    { accuracy_class: 'III', interval_e_g: 0, load_kg: 50, reference_kg: 50, indicated_kg: 50 },
    { accuracy_class: 'III', interval_e_g: 20, load_kg: '', reference_kg: 'abc', indicated_kg: 50 },
  ];
  cases.forEach((c, i) => {
    it(`case #${i} → nulls and incomplete`, () => {
      const r = calculateReading(input(c), DEFAULT_RULES);
      expect(r.errorG).toBeNull();
      expect(r.allowedErrorG).toBeNull();
      expect(r.result).toBe('incomplete');
    });
  });

  it('accepts numeric strings', () => {
    const r = calculateReading(
      input({ accuracy_class: 'III', interval_e_g: '20', load_kg: ' 50 ', reference_kg: '50', indicated_kg: '50.01' }),
      DEFAULT_RULES,
    );
    expect(r.errorG).toBeCloseTo(10, 6);
    expect(r.result).toBe('pass');
  });
});

describe('reportResult', () => {
  it('no readings → incomplete', () => expect(reportResult([])).toBe('incomplete'));
  it('all pass → pass', () => expect(reportResult(['pass', 'pass'])).toBe('pass'));
  it('any fail → fail', () => expect(reportResult(['pass', 'fail', 'incomplete'])).toBe('fail'));
  it('pass with an incomplete row → incomplete', () => expect(reportResult(['pass', 'incomplete'])).toBe('incomplete'));
});

describe('table3Hint', () => {
  it('Class III, Max 100 kg, e = 20 g → no hint', () => expect(table3Hint('III', 100, 20)).toBeNull());
  it('Class IIII, Max 100 kg, e = 20 g → hint mentioning Table 3', () => {
    expect(table3Hint('IIII', 100, 20)).toMatch(/Table 3/);
  });
  it('incomplete input → no hint', () => expect(table3Hint('III', '', 20)).toBeNull());
});

describe('rules are data', () => {
  it('editing a multiplier changes the result', () => {
    const stricter = DEFAULT_RULES.map((r) => (r.id === 'III-3' ? { ...r, multiplier: 0.1 } : r));
    const c = input({ accuracy_class: 'III', interval_e_g: 20, load_kg: 50, reference_kg: 50, indicated_kg: 50.025 });
    expect(calculateReading(c, DEFAULT_RULES).result).toBe('pass');
    expect(calculateReading(c, stricter).result).toBe('fail');
  });
});
