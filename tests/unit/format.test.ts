import { describe, expect, it } from 'vitest';
import {
  formatAllowed,
  formatCount,
  formatDate,
  formatDateTime,
  formatGrams,
  formatKg,
  formatAmount,
  formatMonth,
  formatPlural,
  initials,
  safeNextPath,
} from '@/lib/format';

describe('dates', () => {
  it('formats a date-only value without shifting the day', () => {
    expect(formatDate('2026-09-11', 'America/Los_Angeles')).toBe('11 Sep 2026');
  });

  it('formats timestamps in the given time zone', () => {
    expect(formatDateTime('2026-09-11T16:05:00Z', 'UTC')).toBe('11 Sep 2026, 16:05');
    expect(formatDateTime('2026-09-11T20:05:00Z', 'Asia/Kolkata')).toBe('12 Sep 2026, 01:35');
  });

  it('formats a month', () => {
    expect(formatMonth('2026-09-01', 'America/Los_Angeles')).toBe('Sep 2026');
    expect(formatMonth(null)).toBe('—');
  });

  it('uses a dash for missing or invalid dates', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not a date')).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
  });
});

describe('numbers', () => {
  it('formats signed grams with one decimal', () => {
    expect(formatGrams(20)).toBe('+20.0 g');
    expect(formatGrams(-3)).toBe('-3.0 g');
    expect(formatGrams(0)).toBe('0.0 g');
    expect(formatGrams(-0.01)).toBe('0.0 g');
    expect(formatGrams(null)).toBe('—');
  });

  it('formats allowed error, kilograms and counts', () => {
    expect(formatAllowed(25)).toBe('± 25.0 g');
    expect(formatAllowed(null)).toBe('—');
    expect(formatKg(10.02)).toBe('10.020');
    expect(formatKg(undefined)).toBe('—');
    expect(formatCount(2000)).toBe('2,000');
  });
});

describe('formatAmount', () => {
  it('keeps small decimals and groups thousands', () => {
    expect(formatAmount(0.22, 'kg')).toBe('0.22 kg');
    expect(formatAmount(1500, 'kg')).toBe('1,500 kg');
    expect(formatAmount(0.00005, 'g')).toBe('0.0001 g');
    expect(formatAmount(null, 'kg')).toBe('—');
    expect(formatAmount(Number.NaN, 'kg')).toBe('—');
  });
});

describe('formatPlural', () => {
  it('uses the singular only for one', () => {
    expect(formatPlural(1, 'model')).toBe('1 model');
    expect(formatPlural(0, 'model')).toBe('0 models');
    expect(formatPlural(2000, 'test')).toBe('2,000 tests');
    expect(formatPlural(2, 'weight set')).toBe('2 weight sets');
  });
});

describe('initials', () => {
  it('takes first and last initials', () => {
    expect(initials('Kavya Rao')).toBe('KR');
    expect(initials('Anna Maria Lopez')).toBe('AL');
    expect(initials('Priya')).toBe('PR');
    expect(initials('  ')).toBe('?');
  });
});

describe('safeNextPath', () => {
  it('keeps paths inside the app', () => {
    expect(safeNextPath('/reports/abc?tab=photos')).toBe('/reports/abc?tab=photos');
  });

  it('rejects anything that could leave the app or loop', () => {
    expect(safeNextPath('https://evil.example')).toBe('/dashboard');
    expect(safeNextPath('//evil.example')).toBe('/dashboard');
    expect(safeNextPath('/\\evil.example')).toBe('/dashboard');
    expect(safeNextPath('/sign-in?next=/x')).toBe('/dashboard');
    expect(safeNextPath(null)).toBe('/dashboard');
  });
});
