import { describe, expect, it } from 'vitest';
import { resolveTimeZone } from '@/lib/time-zone';

describe('resolveTimeZone', () => {
  it('keeps a valid time zone', () => {
    expect(resolveTimeZone('Asia/Kolkata')).toBe('Asia/Kolkata');
  });

  it('trims spaces, line breaks and quotes pasted around the value', () => {
    expect(resolveTimeZone('  Asia/Kolkata ')).toBe('Asia/Kolkata');
    expect(resolveTimeZone('Asia/Kolkata\r\n')).toBe('Asia/Kolkata');
    expect(resolveTimeZone('"Asia/Kolkata"')).toBe('Asia/Kolkata');
    expect(resolveTimeZone("'Asia/Kolkata'")).toBe('Asia/Kolkata');
  });

  it('falls back to UTC when the value is missing or not a real time zone', () => {
    expect(resolveTimeZone(undefined)).toBe('UTC');
    expect(resolveTimeZone('')).toBe('UTC');
    expect(resolveTimeZone('   ')).toBe('UTC');
    expect(resolveTimeZone('Mars/Olympus')).toBe('UTC');
  });
});
