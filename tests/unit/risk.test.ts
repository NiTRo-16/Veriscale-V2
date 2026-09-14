import { describe, expect, it } from 'vitest';
import {
  compareDisplay,
  compareNameplate,
  duplicatePhotoFlags,
  parseDisplayRead,
  parseNameplateRead,
  riskLevel,
  ruleFlags,
  sortFlags,
  type RiskFlag,
  type RuleInput,
} from '@/lib/risk';

const reading = (load: number, reference: number, indicated: number, test_type = 'Weighing accuracy') => ({
  test_type,
  load_kg: load,
  reference_kg: reference,
  indicated_kg: indicated,
});

const base = (): RuleInput => ({
  report: {
    created_at: '2026-09-17T04:00:00Z',
    submitted_at: '2026-09-17T05:10:00Z',
    test_date: '2026-09-17',
    temperature_c: 24.3,
    temperature_source: 'sensor',
    humidity_pct: 51,
    humidity_source: 'sensor',
  },
  readings: [reading(2, 2, 2), reading(10, 10, 10.005), reading(20, 20, 19.995), reading(30, 30, 30.005)],
  photos: [
    { kind: 'nameplate', taken_at: '2026-09-17T04:20:00Z' },
    { kind: 'display', taken_at: '2026-09-17T04:30:00Z' },
  ],
  earlier: [],
  previousByTechnician: null,
  timeZone: 'Asia/Kolkata',
});

const codes = (flags: RiskFlag[]) => flags.map((f) => f.code);
const flag = (code: string, severity: RiskFlag['severity']): RiskFlag => ({ code, severity, title: code, detail: code });

describe('riskLevel', () => {
  it('is low with no flags or only low ones', () => {
    expect(riskLevel([])).toBe('low');
    expect(riskLevel([flag('a', 'low')])).toBe('low');
  });

  it('takes the most serious flag', () => {
    expect(riskLevel([flag('a', 'low'), flag('b', 'medium')])).toBe('medium');
    expect(riskLevel([flag('a', 'medium'), flag('b', 'high'), flag('c', 'low')])).toBe('high');
  });
});

describe('sortFlags', () => {
  it('puts the most serious flags first', () => {
    expect(codes(sortFlags([flag('a', 'low'), flag('b', 'high'), flag('c', 'medium')]))).toEqual(['b', 'c', 'a']);
  });
});

describe('ruleFlags', () => {
  it('finds nothing unusual in an ordinary report', () => {
    expect(ruleFlags(base())).toEqual([]);
  });

  it('flags a report started and sent within a few minutes', () => {
    const input = base();
    input.report.created_at = '2026-09-17T05:05:00Z';
    const flags = ruleFlags(input);
    expect(codes(flags)).toEqual(['quick_submit']);
    expect(flags[0].severity).toBe('medium');
    expect(flags[0].detail).toContain('5 minutes');
  });

  it('does not flag a report that took ten minutes or more', () => {
    const input = base();
    input.report.created_at = '2026-09-17T05:00:00Z';
    expect(codes(ruleFlags(input))).not.toContain('quick_submit');
  });

  it('flags photos that all have no time taken', () => {
    const input = base();
    input.photos = input.photos.map((p) => ({ ...p, taken_at: null }));
    const flags = ruleFlags(input);
    expect(codes(flags)).toEqual(['photo_times_missing']);
    expect(flags[0].severity).toBe('medium');
  });

  it('adds no photo flags when there are no photos', () => {
    const input = base();
    input.photos = [];
    expect(ruleFlags(input)).toEqual([]);
  });

  it('flags photos taken more than a day away from the test date', () => {
    const input = base();
    input.photos[1] = { kind: 'display', taken_at: '2026-09-10T04:00:00Z' };
    const flags = ruleFlags(input);
    expect(codes(flags)).toEqual(['photo_time_far']);
    expect(flags[0].detail).toContain('10 Sep 2026');
    expect(flags[0].detail).toContain('17 Sep 2026');
  });

  it("uses the lab's time zone for the day a photo was taken", () => {
    const input = base();
    input.report.test_date = '2026-09-19';
    // 20:00 UTC on the 17th is 01:30 on the 18th in Kolkata: one day before the test, which is fine.
    input.photos = [{ kind: 'display', taken_at: '2026-09-17T20:00:00Z' }];
    expect(ruleFlags(input)).toEqual([]);
  });

  it('flags readings identical to an earlier report of the same instrument', () => {
    const input = base();
    input.earlier = [{ report_no: 'VS-2025-212', readings: base().readings }];
    const flags = ruleFlags(input);
    expect(codes(flags)).toEqual(['copied_readings']);
    expect(flags[0].severity).toBe('high');
    expect(flags[0].detail).toContain('VS-2025-212');
  });

  it('does not flag an earlier report whose readings differ', () => {
    const input = base();
    const earlierReadings = base().readings;
    earlierReadings[2] = reading(20, 20, 20);
    input.earlier = [{ report_no: 'VS-2025-212', readings: earlierReadings }];
    expect(ruleFlags(input)).toEqual([]);
  });

  it('needs at least three readings to call them copied', () => {
    const input = base();
    input.readings = input.readings.slice(0, 2);
    input.earlier = [{ report_no: 'VS-2025-212', readings: input.readings }];
    expect(codes(ruleFlags(input))).not.toContain('copied_readings');
  });

  it('flags four or more readings that all show exactly zero error', () => {
    const input = base();
    input.readings = [reading(2, 2, 2), reading(10, 10, 10), reading(20, 20, 20), reading(30, 30, 30)];
    const flags = ruleFlags(input);
    expect(codes(flags)).toEqual(['zero_errors']);
    expect(flags[0].severity).toBe('medium');
  });

  it('does not flag zero error on fewer than four readings', () => {
    const input = base();
    input.readings = [reading(2, 2, 2), reading(10, 10, 10), reading(20, 20, 20)];
    expect(ruleFlags(input)).toEqual([]);
  });

  it("flags typed-in conditions identical to the technician's previous report", () => {
    const input = base();
    input.report.temperature_source = 'manual';
    input.report.humidity_source = 'manual';
    input.previousByTechnician = { report_no: 'VS-2026-150', temperature_c: 24.3, humidity_pct: 51 };
    const flags = ruleFlags(input);
    expect(codes(flags)).toEqual(['same_conditions']);
    expect(flags[0].detail).toContain('VS-2026-150');
  });

  it('does not flag matching conditions that came from the sensor', () => {
    const input = base();
    input.previousByTechnician = { report_no: 'VS-2026-150', temperature_c: 24.3, humidity_pct: 51 };
    expect(ruleFlags(input)).toEqual([]);
  });
});

describe('compareDisplay', () => {
  it('accepts a display photo that matches the typed reading', () => {
    expect(compareDisplay({ index: 1, indicated_kg: 10.005 }, { readable: true, value: 10.005, unit: 'kg' })).toBeNull();
  });

  it('converts grams on the display to kilograms', () => {
    expect(compareDisplay({ index: 1, indicated_kg: 10.005 }, { readable: true, value: 10005, unit: 'g' })).toBeNull();
  });

  it('flags a display photo showing a different value', () => {
    const result = compareDisplay({ index: 1, indicated_kg: 10.005 }, { readable: true, value: 10.05, unit: 'kg' });
    expect(result?.code).toBe('display_mismatch');
    expect(result?.severity).toBe('high');
    expect(result?.detail).toContain('10.05 kg');
    expect(result?.detail).toContain('10.005 kg');
    expect(result?.detail).toContain('reading 2');
  });

  it('gives a low flag when the display could not be read', () => {
    const result = compareDisplay({ index: 0, indicated_kg: 2 }, { readable: false, value: null, unit: null });
    expect(result?.code).toBe('display_unreadable');
    expect(result?.severity).toBe('low');
  });
});

describe('compareNameplate', () => {
  const report = { serial_number: 'TP30-24-01873', model: 'TP-30 Retail', max_capacity_kg: 30, interval_e_g: 5, accuracy_class: 'III' as const };
  const matching = {
    readable: true,
    serial_number: 'TP30 24 01873',
    model: 'TP-30',
    max_capacity: { value: 30, unit: 'kg' as const },
    interval_e: { value: 5, unit: 'g' as const },
    accuracy_class: 'III' as const,
  };

  it('accepts a nameplate that matches, ignoring spaces, dashes and case', () => {
    expect(compareNameplate(report, matching)).toEqual([]);
  });

  it('flags a different serial number as high risk', () => {
    const flags = compareNameplate(report, { ...matching, serial_number: 'TP30-24-09999' });
    expect(codes(flags)).toEqual(['nameplate_serial']);
    expect(flags[0].severity).toBe('high');
    expect(flags[0].detail).toContain('TP30-24-09999');
  });

  it('flags different capacity and interval together', () => {
    const flags = compareNameplate(report, {
      ...matching,
      max_capacity: { value: 60, unit: 'kg' },
      interval_e: { value: 0.01, unit: 'kg' },
    });
    expect(codes(flags)).toEqual(['nameplate_details']);
    expect(flags[0].severity).toBe('medium');
    expect(flags[0].detail).toContain('Max');
    expect(flags[0].detail).toContain('e ');
  });

  it('ignores details that are not visible on the photo', () => {
    expect(
      compareNameplate(report, { readable: true, serial_number: null, model: null, max_capacity: null, interval_e: null, accuracy_class: null }),
    ).toEqual([]);
  });

  it('gives a low flag when the nameplate could not be read', () => {
    const flags = compareNameplate(report, { ...matching, readable: false });
    expect(codes(flags)).toEqual(['nameplate_unreadable']);
    expect(flags[0].severity).toBe('low');
  });
});

describe('duplicatePhotoFlags', () => {
  it('adds nothing when no photo appears in another report', () => {
    expect(duplicatePhotoFlags([])).toEqual([]);
  });

  it('flags photos also attached to other reports', () => {
    const flags = duplicatePhotoFlags([
      { kind: 'display', report_no: 'VS-2026-120' },
      { kind: 'seals', report_no: 'VS-2026-098' },
    ]);
    expect(codes(flags)).toEqual(['duplicate_photo']);
    expect(flags[0].severity).toBe('high');
    expect(flags[0].detail).toContain('VS-2026-120');
    expect(flags[0].detail).toContain('VS-2026-098');
  });
});

describe('parsing what the photo reader returns', () => {
  it('keeps a well-formed display reading', () => {
    expect(parseDisplayRead({ readable: true, value: 10.005, unit: 'kg' })).toEqual({ readable: true, value: 10.005, unit: 'kg' });
  });

  it('treats anything malformed as unreadable', () => {
    const unreadable = { readable: false, value: null, unit: null };
    expect(parseDisplayRead(null)).toEqual(unreadable);
    expect(parseDisplayRead({ readable: true, value: 'ten', unit: 'kg' })).toEqual(unreadable);
    expect(parseDisplayRead({ readable: true, value: 10, unit: 'lb' })).toEqual(unreadable);
  });

  it('keeps known nameplate fields and drops the rest', () => {
    expect(
      parseNameplateRead({
        readable: true,
        serial_number: ' TP30-24-01873 ',
        model: '',
        max_capacity: { value: 30, unit: 'kg' },
        interval_e: { value: 'five', unit: 'g' },
        accuracy_class: 'V',
      }),
    ).toEqual({
      readable: true,
      serial_number: 'TP30-24-01873',
      model: null,
      max_capacity: { value: 30, unit: 'kg' },
      interval_e: null,
      accuracy_class: null,
    });
  });

  it('treats a malformed nameplate answer as unreadable', () => {
    expect(parseNameplateRead('nope').readable).toBe(false);
  });
});
