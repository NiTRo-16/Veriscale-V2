import { describe, expect, it } from 'vitest';
import { GENERIC_ERROR, friendlyError } from '@/lib/db-errors';

describe('friendlyError', () => {
  it('explains a second review, naming who decided', () => {
    expect(friendlyError({ message: 'ALREADY_REVIEWED|approved|Kavya Rao' })).toBe(
      'This report was already approved by Kavya Rao.',
    );
    expect(friendlyError(new Error('ALREADY_REVIEWED|failed|Priya Nair'))).toBe(
      'This report was already failed by Priya Nair.',
    );
  });

  it('maps our database codes to plain sentences', () => {
    expect(friendlyError({ message: 'REPORT_LOCKED' })).toBe('This report has been submitted and can no longer be changed.');
    expect(friendlyError({ message: 'NOTE_REQUIRED' })).toBe('Please add a note explaining why this report fails.');
    expect(friendlyError({ message: 'APPROVE_NOT_ALLOWED' })).toBe("A report whose readings failed can't be approved.");
  });

  it('does not confuse similar codes', () => {
    expect(friendlyError({ message: 'REPORT_NOT_DRAFT' })).toBe('This report has already been submitted.');
    expect(friendlyError({ message: 'NOT_ALLOWED' })).toBe("You don't have access to do this.");
  });

  it('treats access-rule failures as no access', () => {
    expect(friendlyError({ message: 'permission denied for table reports' })).toBe("You don't have access to do this.");
    expect(friendlyError({ message: 'new row violates row-level security policy for table "photos"' })).toBe(
      "You don't have access to do this.",
    );
  });

  it('never shows raw technical messages', () => {
    expect(friendlyError({ message: 'duplicate key value violates unique constraint "photos_pkey"' })).toBe(GENERIC_ERROR);
    expect(friendlyError(undefined)).toBe(GENERIC_ERROR);
  });
});
