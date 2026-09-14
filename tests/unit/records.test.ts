import { describe, expect, it } from 'vitest';
import {
  addDays,
  belongsToManufacturer,
  belongsToModel,
  daysBetween,
  isOverdueOn,
  latestPerInstrument,
  latestReport,
  monthTicks,
  recordsHref,
  recordStats,
  schedulePosition,
  scheduleWindow,
  todayDate,
  validateManufacturer,
  validateModel,
  validateWeightSet,
  weightSetSummary,
  weightStatus,
  weightStatusLabel,
  type RecordReport,
} from '@/lib/records';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

const report = (partial: Partial<RecordReport>): RecordReport => ({
  id: 'r',
  report_no: 'VS-0001',
  status: 'pending',
  manufacturer: null,
  manufacturer_id: null,
  model: null,
  model_id: null,
  serial_number: null,
  test_stage: 'initial',
  test_date: null,
  created_at: '2026-08-01T09:00:00Z',
  submitted_at: null,
  weight_set_id: null,
  ...partial,
});

describe('dates', () => {
  it('works out today in the lab time zone', () => {
    const now = new Date('2026-09-13T22:30:00Z');
    expect(todayDate(now, 'UTC')).toBe('2026-09-13');
    expect(todayDate(now, 'Asia/Kolkata')).toBe('2026-09-14');
  });

  it('adds days and counts days across months', () => {
    expect(addDays('2026-09-28', 5)).toBe('2026-10-03');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-09-13', '2026-10-06')).toBe(23);
    expect(daysBetween('2026-09-13', '2026-09-01')).toBe(-12);
  });
});

describe('weight set status', () => {
  const today = '2026-09-13';

  it('is overdue after the check date, due soon within 30 days, otherwise in date', () => {
    expect(weightStatus('2026-09-01', today)).toEqual({ state: 'overdue', days: -12 });
    expect(weightStatus('2026-09-13', today)).toEqual({ state: 'due_soon', days: 0 });
    expect(weightStatus('2026-10-13', today)).toEqual({ state: 'due_soon', days: 30 });
    expect(weightStatus('2026-10-14', today)).toEqual({ state: 'in_date', days: 31 });
  });

  it('describes the status in plain words', () => {
    expect(weightStatusLabel({ state: 'in_date', days: 90 })).toBe('In date');
    expect(weightStatusLabel({ state: 'due_soon', days: 0 })).toBe('Due today');
    expect(weightStatusLabel({ state: 'due_soon', days: 1 })).toBe('Due in 1 day');
    expect(weightStatusLabel({ state: 'due_soon', days: 23 })).toBe('Due in 23 days');
    expect(weightStatusLabel({ state: 'overdue', days: -1 })).toBe('Overdue 1 day');
    expect(weightStatusLabel({ state: 'overdue', days: -12 })).toBe('Overdue 12 days');
  });

  it('still allows a set on its check day', () => {
    expect(isOverdueOn('2026-09-13', '2026-09-13')).toBe(false);
    expect(isOverdueOn('2026-09-12', '2026-09-13')).toBe(true);
    expect(isOverdueOn(null, '2026-09-13')).toBe(false);
  });

  it('summarises a set for the report', () => {
    expect(
      weightSetSummary({ code: 'WS-4471', weight_class: 'F2', nominal_range: '1 mg – 20 kg', certificate_no: 'CAL-26-0412' }),
    ).toBe('WS-4471 · F2 · 1 mg – 20 kg · certificate CAL-26-0412');
    expect(weightSetSummary({ code: 'WS-1', weight_class: 'M1', nominal_range: null, certificate_no: null })).toBe('WS-1 · M1');
  });
});

describe('validation', () => {
  it('needs a manufacturer name', () => {
    expect(validateManufacturer({ name: '  ' })).toBe("Enter the manufacturer's name.");
    expect(validateManufacturer({ name: 'Acme' })).toBeNull();
    expect(validateManufacturer({ name: 'x'.repeat(121) })).toBe('Keep the name to 120 characters or fewer.');
    expect(validateWeightSet({ code: 'x'.repeat(61), weightClass: 'F2', lastChecked: '', nextCheck: '2027-01-01' })).toBe(
      'Keep the code to 60 characters or fewer.',
    );
  });

  it('checks each model field in order', () => {
    const good = { manufacturerId: ID_A, name: 'TW-150', accuracyClass: 'III', maxCapacityKg: '150', intervalEG: '50' };
    expect(validateModel(good)).toBeNull();
    expect(validateModel({ ...good, manufacturerId: 'nope' })).toBe('Choose a manufacturer.');
    expect(validateModel({ ...good, name: '' })).toBe('Enter the model name.');
    expect(validateModel({ ...good, accuracyClass: 'V' })).toBe('Choose an accuracy class.');
    expect(validateModel({ ...good, maxCapacityKg: '0' })).toBe('Enter a maximum capacity above 0.');
    expect(validateModel({ ...good, intervalEG: 'abc' })).toBe('Enter a verification interval above 0.');
  });

  it('checks a weight set and its dates', () => {
    const good = { code: 'WS-4471', weightClass: 'F2', lastChecked: '2026-03-01', nextCheck: '2027-03-01' };
    expect(validateWeightSet(good)).toBeNull();
    expect(validateWeightSet({ ...good, lastChecked: '' })).toBeNull();
    expect(validateWeightSet({ ...good, code: ' ' })).toBe('Enter the weight set code.');
    expect(validateWeightSet({ ...good, weightClass: 'X9' })).toBe('Choose a weight class.');
    expect(validateWeightSet({ ...good, lastChecked: '2026-02-30' })).toBe('Enter a real date for the last check.');
    expect(validateWeightSet({ ...good, nextCheck: '' })).toBe('Enter the next check date.');
    expect(validateWeightSet({ ...good, nextCheck: '2026-03-01' })).toBe('The next check must be after the last check.');
  });
});

describe('reports linked to records', () => {
  const acme = { id: ID_A, name: 'Acme Weighing' };

  it('matches picked reports by id and typed-in reports by name', () => {
    expect(belongsToManufacturer(report({ manufacturer_id: ID_A, manufacturer: 'Other' }), acme)).toBe(true);
    expect(belongsToManufacturer(report({ manufacturer_id: ID_B, manufacturer: 'Acme Weighing' }), acme)).toBe(false);
    expect(belongsToManufacturer(report({ manufacturer: '  acme weighing ' }), acme)).toBe(true);
    expect(belongsToManufacturer(report({ manufacturer: '' }), { id: ID_A, name: '' })).toBe(false);
  });

  it('matches typed-in models only under the same manufacturer', () => {
    const model = { id: ID_B, name: 'TW-150' };
    expect(belongsToModel(report({ model_id: ID_B }), model, acme)).toBe(true);
    expect(belongsToModel(report({ model: 'tw-150', manufacturer: 'Acme Weighing' }), model, acme)).toBe(true);
    expect(belongsToModel(report({ model: 'tw-150', manufacturer: 'Someone else' }), model, acme)).toBe(false);
  });

  it('counts sent reports and the share that passed', () => {
    const stats = recordStats([
      report({ status: 'draft', test_date: '2026-09-30' }),
      report({ status: 'approved', test_date: '2026-09-01' }),
      report({ status: 'approved', test_date: '2026-09-10' }),
      report({ status: 'failed', submitted_at: '2026-09-12T10:00:00Z' }),
      report({ status: 'pending', test_date: '2026-08-01' }),
    ]);
    expect(stats).toEqual({ reports: 4, approved: 2, failed: 1, passedPct: 67, lastTested: '2026-09-12T10:00:00Z' });
    expect(recordStats([report({ status: 'pending' })]).passedPct).toBeNull();
    expect(recordStats([]).lastTested).toBeNull();
  });

  it('keeps the latest report for each serial number', () => {
    const older = report({ id: 'a', serial_number: 'AWS-1', test_date: '2026-09-01' });
    const newer = report({ id: 'b', serial_number: ' aws-1 ', test_date: '2026-09-10' });
    const other = report({ id: 'c', serial_number: 'B-2', test_date: '2026-09-05' });
    const rows = latestPerInstrument([older, other, newer, report({ id: 'd' }), report({ id: 'e', status: 'draft', serial_number: 'Z' })]);
    expect(rows.map((r) => [r.serial, r.report.id, r.count])).toEqual([
      ['aws-1', 'b', 2],
      ['B-2', 'c', 1],
    ]);
    expect(latestReport([older, newer, other])?.id).toBe('b');
    expect(latestReport([report({ status: 'draft' })])).toBeNull();
  });
});

describe('check schedule', () => {
  const window = scheduleWindow(
    [
      { last_checked: '2025-09-01', next_check: '2026-09-01' },
      { last_checked: '2026-04-06', next_check: '2026-10-06' },
    ],
    '2026-09-13',
  );

  it('covers whole months from the earliest check to after the latest', () => {
    expect(window).toEqual({ start: '2025-09-01', end: '2026-11-01', days: 426 });
  });

  it('spaces month labels so there are no more than about eight', () => {
    expect(monthTicks(window)).toEqual([
      '2025-09-01',
      '2025-11-01',
      '2026-01-01',
      '2026-03-01',
      '2026-05-01',
      '2026-07-01',
      '2026-09-01',
      '2026-11-01',
    ]);
  });

  it('places dates across the window and keeps them inside it', () => {
    expect(schedulePosition('2025-09-01', window)).toBe(0);
    expect(schedulePosition('2026-11-01', window)).toBe(1);
    expect(schedulePosition('2030-01-01', window)).toBe(1);
    expect(schedulePosition('2020-01-01', window)).toBe(0);
  });
});

describe('recordsHref', () => {
  it('keeps only the query values that are set', () => {
    expect(recordsHref('/records/weights')).toBe('/records/weights');
    expect(recordsHref('/records/weights', { tab: undefined, edit: '' })).toBe('/records/weights');
    expect(recordsHref('/records/manufacturers', { id: ID_A, q: 'mettler & co' })).toBe(
      `/records/manufacturers?id=${ID_A}&q=mettler+%26+co`,
    );
  });
});
