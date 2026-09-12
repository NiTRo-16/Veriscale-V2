import { describe, expect, it } from 'vitest';
import { reviewOptions, submitProblems, type DraftForReadiness } from '@/lib/readiness';

const complete: DraftForReadiness = {
  manufacturer: 'Acme Weighing Systems',
  model: 'TW-150',
  serial_number: 'AWS-1',
  accuracy_class: 'III',
  max_capacity_kg: 150,
  interval_e_g: 50,
  test_date: '2026-09-11',
  temperature_source: 'sensor',
  humidity_source: 'sensor',
  weather_confirmed: false,
};
const goodReading = { load_kg: 10, reference_kg: 10, indicated_kg: 10.02 };

describe('submitProblems', () => {
  it('a complete draft has no problems', () => {
    expect(submitProblems(complete, [goodReading])).toEqual([]);
  });

  it('lists missing required fields in plain words', () => {
    const problems = submitProblems({ ...complete, manufacturer: '  ', model: null, max_capacity_kg: null }, [goodReading]);
    expect(problems).toEqual(['Fill in: Manufacturer, Model, Maximum capacity']);
  });

  it('asks for at least one reading', () => {
    expect(submitProblems(complete, [])).toEqual(['Add at least one reading']);
  });

  it('counts incomplete readings with correct plural', () => {
    const blank = { load_kg: 10, reference_kg: null, indicated_kg: '' };
    expect(submitProblems(complete, [goodReading, blank])).toEqual(['1 reading incomplete']);
    expect(submitProblems(complete, [blank, blank])).toEqual(['2 readings incomplete']);
  });

  it('asks to confirm weather values only when a value came from weather', () => {
    expect(submitProblems({ ...complete, humidity_source: 'weather' }, [goodReading])).toEqual(['Confirm weather values']);
    expect(submitProblems({ ...complete, humidity_source: 'weather', weather_confirmed: true }, [goodReading])).toEqual([]);
    expect(submitProblems({ ...complete, temperature_source: 'manual', humidity_source: null }, [goodReading])).toEqual([]);
  });

  it('keeps problems in a stable order', () => {
    const problems = submitProblems({ ...complete, model: '', temperature_source: 'weather' }, []);
    expect(problems).toEqual(['Fill in: Model', 'Add at least one reading', 'Confirm weather values']);
  });
});

describe('reviewOptions', () => {
  it('a report that calculated as fail can only be failed', () => {
    expect(reviewOptions('fail')).toEqual({ canApprove: false, failNoteRequired: false });
  });

  it('a report that calculated as pass can be approved, or failed with a note', () => {
    expect(reviewOptions('pass')).toEqual({ canApprove: true, failNoteRequired: true });
  });

  it('no calculated result → cannot approve', () => {
    expect(reviewOptions(null)).toEqual({ canApprove: false, failNoteRequired: false });
  });
});
