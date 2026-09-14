import { describe, expect, it } from 'vitest';
import {
  automaticChecks,
  decisionEntries,
  firstName,
  mainSource,
  noteRequired,
  queuePosition,
  reportHistory,
  shareOfLimit,
  tallyReadings,
  tallyText,
  thisWeekVsLast,
  waitingText,
} from '@/lib/review';

const BANNED = /sha|hash|anchor|blockchain|\bmpe\b|verdict|sign-?off|audit/i;
const NOW = new Date('2026-09-12T15:00:00Z'); // a Saturday; the week starts Mon 7 Sep

describe('shareOfLimit', () => {
  it('works out the share of the allowed error, either sign', () => {
    expect(shareOfLimit(20, 25)).toBe(80);
    expect(shareOfLimit(-40, 50)).toBe(80);
    expect(shareOfLimit(50, 75)).toBe(67);
    expect(shareOfLimit(60, 50)).toBe(120);
  });

  it('gives nothing when it cannot be worked out', () => {
    expect(shareOfLimit(null, 25)).toBeNull();
    expect(shareOfLimit(10, null)).toBeNull();
    expect(shareOfLimit(10, 0)).toBeNull();
  });
});

describe('tallyReadings and tallyText', () => {
  it('counts readings inside and over the limit', () => {
    expect(tallyReadings(['pass', 'fail', 'pass'])).toEqual({ total: 3, inside: 2, over: 1 });
  });

  it('describes the tally in plain words', () => {
    expect(tallyText(tallyReadings(['pass', 'pass', 'pass', 'pass', 'pass']))).toBe('5 of 5 readings inside limit');
    expect(tallyText(tallyReadings(['pass', 'fail', 'pass', 'pass', 'pass', 'pass']))).toBe('1 of 6 readings over limit');
    expect(tallyText(tallyReadings(['pass']))).toBe('1 of 1 reading inside limit');
    expect(tallyText(tallyReadings([]))).toBe('No readings');
  });
});

describe('small wording helpers', () => {
  it('says how long a report has waited', () => {
    expect(waitingText(-1)).toBe('Today');
    expect(waitingText(0)).toBe('Today');
    expect(waitingText(1)).toBe('1 day');
    expect(waitingText(3)).toBe('3 days');
  });

  it('takes the first name', () => {
    expect(firstName('Arjun Mehta')).toBe('Arjun');
    expect(firstName('  Neha ')).toBe('Neha');
  });

  it('shows the least dependable condition source', () => {
    expect(mainSource('sensor', 'sensor')).toBe('sensor');
    expect(mainSource('sensor', 'weather')).toBe('weather');
    expect(mainSource('weather', 'manual')).toBe('manual');
    expect(mainSource('sensor', null)).toBe('sensor');
    expect(mainSource(null, null)).toBeNull();
  });
});

describe('noteRequired', () => {
  it('always needs a note to send back', () => {
    expect(noteRequired('sent_back', 'pass')).toBe(true);
    expect(noteRequired('sent_back', 'fail')).toBe(true);
  });

  it('needs a note to fail a passing report only', () => {
    expect(noteRequired('failed', 'pass')).toBe(true);
    expect(noteRequired('failed', 'fail')).toBe(false);
    expect(noteRequired('approved', 'pass')).toBe(false);
  });
});

describe('automaticChecks', () => {
  const report = {
    manufacturer: 'Acme Weighing Systems',
    model: 'TW-150 Platform Scale',
    serial_number: 'AWS-TW150-004417',
    accuracy_class: 'III' as const,
    max_capacity_kg: 150,
    interval_e_g: 50,
    test_date: '2026-09-10',
    temperature_source: 'sensor' as const,
    humidity_source: 'sensor' as const,
    weather_confirmed: false,
    reference_weights: 'WS-4471 · F2 stainless set',
  };
  const readings = [{ load_kg: 10, reference_kg: 10, indicated_kg: 10.02 }];
  const allPhotos = ['nameplate', 'display', 'setup', 'seals', 'other'] as const;

  it('passes a complete report read from the sensor', () => {
    expect(automaticChecks(report, readings, allPhotos)).toEqual([
      { ok: true, label: 'All required details filled in' },
      { ok: true, label: 'Temperature and humidity came from the sensor' },
      { ok: true, label: 'Reference weights recorded' },
      { ok: true, label: 'Nameplate, display, setup and seals photos added' },
    ]);
  });

  it('flags typed-in conditions, missing weights and missing photos', () => {
    const checks = automaticChecks(
      { ...report, humidity_source: 'manual', reference_weights: '  ' },
      readings,
      ['nameplate', 'setup'],
    );
    expect(checks.map((c) => c.ok)).toEqual([true, false, false, false]);
    expect(checks[1].label).toBe('Temperature or humidity was typed in, not read from the sensor');
    expect(checks[2].label).toBe('Reference weights not recorded');
    expect(checks[3].label).toBe('Missing photos: Display reading, Seals');
  });

  it('flags weather estimates and missing details', () => {
    const checks = automaticChecks({ ...report, model: '', temperature_source: 'weather', weather_confirmed: true }, readings, allPhotos);
    expect(checks[0]).toEqual({ ok: false, label: 'Fill in: Model' });
    expect(checks[1].label).toBe('Temperature or humidity is a weather estimate, confirmed by the technician');
  });

  it('never uses technical words', () => {
    const checks = [
      ...automaticChecks(report, readings, allPhotos),
      ...automaticChecks({ ...report, temperature_source: 'weather', humidity_source: null }, [], ['seals']),
    ];
    for (const check of checks) expect(check.label).not.toMatch(BANNED);
  });
});

describe('reportHistory', () => {
  const people = { tech: 'Arjun Mehta', rev: 'Kavya Rao' };
  const pending = {
    status: 'pending' as const,
    created_by: 'tech',
    created_at: '2026-09-10T09:12:00Z',
    submitted_at: '2026-09-10T16:40:00Z',
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    sent_back_by: null,
    sent_back_at: null,
    send_back_note: null,
  };

  it('lists a submitted report', () => {
    expect(reportHistory(pending, people)).toEqual([
      { at: '2026-09-10T09:12:00Z', who: 'Arjun Mehta', text: 'started the draft', note: null, tone: 'gray' },
      { at: '2026-09-10T16:40:00Z', who: 'Arjun Mehta', text: 'sent the report for review', note: null, tone: 'amber' },
    ]);
  });

  it('orders a send-back, a second submission and the decision', () => {
    const steps = reportHistory(
      {
        ...pending,
        status: 'approved',
        sent_back_by: 'rev',
        sent_back_at: '2026-09-11T10:00:00Z',
        send_back_note: 'Seals photo is missing.',
        submitted_at: '2026-09-11T14:00:00Z',
        reviewed_by: 'rev',
        reviewed_at: '2026-09-12T09:30:00Z',
      },
      people,
    );
    expect(steps.map((s) => `${s.who} ${s.text}`)).toEqual([
      'Arjun Mehta started the draft',
      'Kavya Rao sent it back for changes',
      'Arjun Mehta sent the report for review again',
      'Kavya Rao approved the report',
    ]);
    expect(steps[1].note).toBe('Seals photo is missing.');
    expect(steps[3].tone).toBe('green');
  });

  it('names an unknown person plainly', () => {
    expect(reportHistory(pending, {})[0].who).toBe('Someone');
  });
});

describe('decisionEntries', () => {
  const base = {
    status: 'pending' as const,
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    sent_back_by: null,
    sent_back_at: null,
    send_back_note: null,
  };

  it('lists approvals, fails and send-backs by one person, newest first', () => {
    const reports = [
      { ...base, id: 'a', status: 'approved' as const, reviewed_by: 'me', reviewed_at: '2026-09-12T16:05:00Z', sent_back_by: 'me', sent_back_at: '2026-09-11T15:42:00Z', send_back_note: 'Add seals photo' },
      { ...base, id: 'b', status: 'failed' as const, reviewed_by: 'me', reviewed_at: '2026-09-12T11:20:00Z', review_note: 'Over limit' },
      { ...base, id: 'c', status: 'approved' as const, reviewed_by: 'someone-else', reviewed_at: '2026-09-12T17:00:00Z' },
    ];
    const entries = decisionEntries(reports, 'me');
    expect(entries.map((e) => [e.report.id, e.kind, e.note])).toEqual([
      ['a', 'approved', null],
      ['b', 'failed', 'Over limit'],
      ['a', 'sent_back', 'Add seals photo'],
    ]);
  });
});

describe('thisWeekVsLast', () => {
  it('splits dates into this week and last week', () => {
    expect(
      thisWeekVsLast(
        ['2026-09-07T00:00:00Z', '2026-09-12T08:00:00Z', '2026-09-06T23:59:59Z', '2026-08-31T00:00:00Z', '2026-08-30T12:00:00Z', null],
        NOW,
      ),
    ).toEqual({ thisWeek: 2, lastWeek: 2 });
  });
});

describe('queuePosition', () => {
  const ids = ['a', 'b', 'c'];

  it('finds neighbours in the queue', () => {
    expect(queuePosition(ids, 'b')).toEqual({ position: 2, total: 3, previous: 'a', next: 'c', afterDecision: 'c' });
  });

  it('goes back to the oldest report after the last one', () => {
    expect(queuePosition(ids, 'c')).toMatchObject({ position: 3, next: null, afterDecision: 'a' });
  });

  it('handles reports outside the queue and a queue of one', () => {
    expect(queuePosition(ids, 'x')).toMatchObject({ position: null, previous: null, next: null, afterDecision: 'a' });
    expect(queuePosition(['a'], 'a')).toMatchObject({ position: 1, afterDecision: null });
  });
});
