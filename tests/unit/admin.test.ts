import { describe, expect, it } from 'vitest';
import { isRole, multiplierLabel, ruleRangeLabel, validateNewUser } from '@/lib/admin';

const valid = { fullName: 'Kavya Rao', email: 'kavya@lab.example', password: 'longenough', role: 'reviewer' };

describe('validateNewUser', () => {
  it('accepts a complete new user', () => expect(validateNewUser(valid)).toBeNull());

  it('explains the first problem in plain words', () => {
    expect(validateNewUser({ ...valid, fullName: ' ' })).toBe("Enter the person's name.");
    expect(validateNewUser({ ...valid, email: 'kavya' })).toBe('Enter a valid email address.');
    expect(validateNewUser({ ...valid, password: 'short' })).toBe('The temporary password needs at least 8 characters.');
    expect(validateNewUser({ ...valid, role: 'owner' })).toBe('Choose a role.');
  });
});

describe('isRole', () => {
  it('only accepts the three roles', () => {
    expect(['technician', 'reviewer', 'admin'].every(isRole)).toBe(true);
    expect(isRole('superuser')).toBe(false);
  });
});

describe('rule labels', () => {
  it('describes load ranges, including open-ended ones', () => {
    expect(ruleRangeLabel({ min_n: 0, max_n: 500 })).toBe('0 – 500');
    expect(ruleRangeLabel({ min_n: 500, max_n: 2000 })).toBe('500 – 2,000');
    expect(ruleRangeLabel({ min_n: 2000, max_n: null })).toBe('above 2,000');
  });

  it('shows multipliers without losing precision', () => {
    expect(multiplierLabel(0.5)).toBe('0.5');
    expect(multiplierLabel(1)).toBe('1.0');
    expect(multiplierLabel(1.25)).toBe('1.25');
  });
});
