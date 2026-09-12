import { describe, expect, it } from 'vitest';
import {
  average,
  changeVsPrevious,
  classCounts,
  niceCeiling,
  startOfWeek,
  statusCounts,
  submittedVsReviewed,
  weekLabel,
  weeklySubmitted,
  type DashboardReport,
} from '@/lib/dashboard';

const report = (partial: Partial<DashboardReport>): DashboardReport => ({
  status: 'pending',
  accuracy_class: 'III',
  created_at: '2026-09-01T09:00:00Z',
  submitted_at: null,
  reviewed_at: null,
  ...partial,
});

const iso = (d: Date) => d.toISOString().slice(0, 10);
const NOW = new Date('2026-09-12T15:00:00Z'); // a Saturday

describe('startOfWeek', () => {
  it('returns Monday midnight UTC', () => {
    expect(iso(startOfWeek(new Date('2026-09-09T10:00:00Z')))).toBe('2026-09-07');
    expect(iso(startOfWeek(new Date('2026-09-07T00:00:00Z')))).toBe('2026-09-07');
    expect(iso(startOfWeek(new Date('2026-09-13T23:59:00Z')))).toBe('2026-09-07');
  });
});

describe('weeklySubmitted', () => {
  it('counts submitted reports per week, oldest first, with empty weeks as zero', () => {
    const reports = [
      report({ submitted_at: '2026-09-08T10:00:00Z' }),
      report({ submitted_at: '2026-09-12T08:00:00Z' }),
      report({ submitted_at: '2026-08-24T00:00:00Z' }),
      report({ status: 'draft', submitted_at: null }),
      report({ submitted_at: '2026-08-10T10:00:00Z' }), // too old for 3 weeks
    ];
    const weeks = weeklySubmitted(reports, NOW, 3);
    expect(weeks.map((w) => iso(w.weekStart))).toEqual(['2026-08-24', '2026-08-31', '2026-09-07']);
    expect(weeks.map((w) => w.count)).toEqual([1, 0, 2]);
  });
});

describe('submittedVsReviewed', () => {
  it('counts reviews by the week they happened', () => {
    const reports = [
      report({ status: 'approved', submitted_at: '2026-09-01T10:00:00Z', reviewed_at: '2026-09-08T10:00:00Z' }),
      report({ status: 'failed', submitted_at: '2026-09-09T10:00:00Z', reviewed_at: '2026-09-10T10:00:00Z' }),
    ];
    const weeks = submittedVsReviewed(reports, NOW, 2);
    expect(weeks).toEqual([
      { weekStart: new Date('2026-08-31T00:00:00Z'), submitted: 1, reviewed: 0 },
      { weekStart: new Date('2026-09-07T00:00:00Z'), submitted: 1, reviewed: 2 },
    ]);
  });
});

describe('counts', () => {
  it('counts statuses', () => {
    const counts = statusCounts([report({ status: 'draft' }), report({ status: 'approved' }), report({ status: 'approved' })]);
    expect(counts).toEqual({ all: 3, draft: 1, pending: 0, approved: 2, failed: 0 });
  });

  it('counts submitted reports by class, leaving out drafts and blanks', () => {
    const counts = classCounts([
      report({ accuracy_class: 'I' }),
      report({ accuracy_class: 'III' }),
      report({ accuracy_class: 'III', status: 'draft' }),
      report({ accuracy_class: null }),
    ]);
    expect(counts).toEqual({ I: 1, II: 0, III: 1, IIII: 0 });
  });
});

describe('helpers', () => {
  it('works out week-on-week change', () => {
    expect(changeVsPrevious([4, 11, 13])).toBe(18);
    expect(changeVsPrevious([0, 5])).toBeNull();
    expect(changeVsPrevious([5])).toBeNull();
  });

  it('averages to one decimal', () => {
    expect(average([8, 11, 14, 13, 11, 13])).toBe(11.7);
    expect(average([])).toBe(0);
  });

  it('picks tidy axis tops', () => {
    expect([0, 1, 7, 13, 16, 45, 100].map(niceCeiling)).toEqual([2, 2, 8, 20, 20, 60, 100]);
  });

  it('labels weeks by day and month', () => {
    expect(weekLabel(new Date('2026-09-07T00:00:00Z'))).toBe('7 Sep');
  });
});
