import { describe, expect, it } from 'vitest';
import {
  ACCURACY_CLASS_OPTIONS,
  DECISION_LABEL,
  PHOTO_KIND_LABEL,
  RESULT_LABEL,
  REVIEW_CHECKS,
  ROLE_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  TEST_TYPES,
  WEIGHT_CLASSES,
  WEIGHT_STATE_LABEL,
} from '@/lib/labels';

const BANNED = /sha|hash|anchor|blockchain|\bmpe\b|verdict|sign-?off|audit/i;

describe('labels', () => {
  it('uses the agreed status words', () => {
    expect(STATUS_LABEL).toEqual({ draft: 'Draft', pending: 'Pending', approved: 'Approved', failed: 'Failed' });
  });

  it('uses the agreed decision words', () => {
    expect(DECISION_LABEL).toEqual({ approved: 'Approved', failed: 'Failed', sent_back: 'Sent back' });
  });

  it('uses the agreed result and source words', () => {
    expect(RESULT_LABEL).toEqual({ pass: 'Pass', fail: 'Fail', incomplete: 'Incomplete' });
    expect(SOURCE_LABEL).toEqual({ sensor: 'Sensor', manual: 'Typed in', weather: 'Weather' });
  });

  it('labels every role and photo kind', () => {
    expect(Object.keys(ROLE_LABEL).sort()).toEqual(['admin', 'reviewer', 'technician']);
    expect(Object.keys(PHOTO_KIND_LABEL).sort()).toEqual(['display', 'nameplate', 'other', 'seals', 'setup']);
  });

  it('offers the five test types with clauses and the four accuracy classes', () => {
    expect(TEST_TYPES.map((t) => t.name)).toEqual([
      'Weighing accuracy',
      'Eccentricity',
      'Repeatability',
      'Discrimination',
      'Tare weighing',
    ]);
    expect(ACCURACY_CLASS_OPTIONS.map((c) => c.value)).toEqual(['I', 'II', 'III', 'IIII']);
  });

  it('offers the weight classes and weight set states', () => {
    expect(WEIGHT_CLASSES).toEqual(['E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3']);
    expect(WEIGHT_STATE_LABEL).toEqual({ in_date: 'In date', due_soon: 'Due soon', overdue: 'Overdue' });
  });

  it('never contains technical words', () => {
    const all = [
      ...Object.values(STATUS_LABEL),
      ...Object.values(DECISION_LABEL),
      ...Object.values(RESULT_LABEL),
      ...Object.values(SOURCE_LABEL),
      ...Object.values(ROLE_LABEL),
      ...Object.values(PHOTO_KIND_LABEL),
      ...TEST_TYPES.map((t) => t.name),
      ...ACCURACY_CLASS_OPTIONS.map((c) => c.label),
      ...REVIEW_CHECKS.map((c) => c.label),
      ...Object.values(WEIGHT_STATE_LABEL),
    ];
    for (const label of all) expect(label).not.toMatch(BANNED);
  });
});
