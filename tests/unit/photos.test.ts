import { describe, expect, it } from 'vitest';
import { MAX_PHOTO_BYTES, isPhotoKind, isPhotoPathFor, photoPath, validatePhoto } from '@/lib/photos';

const REPORT = '0b7f6a52-4c1e-4a55-9a0e-2f4f1a9c1d10';
const PHOTO = '3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

describe('validatePhoto', () => {
  it('accepts JPEG, PNG and WebP up to 10 MB', () => {
    expect(validatePhoto({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(validatePhoto({ type: 'image/png', size: MAX_PHOTO_BYTES })).toBeNull();
    expect(validatePhoto({ type: 'image/webp', size: 5 })).toBeNull();
  });

  it('explains what is wrong in plain words', () => {
    expect(validatePhoto({ type: 'image/gif', size: 1000 })).toBe('Only JPEG, PNG or WebP photos can be added.');
    expect(validatePhoto({ type: 'application/pdf', size: 1000 })).toBe('Only JPEG, PNG or WebP photos can be added.');
    expect(validatePhoto({ type: 'image/jpeg', size: MAX_PHOTO_BYTES + 1 })).toBe('Photos must be 10 MB or smaller.');
    expect(validatePhoto({ type: 'image/jpeg', size: 0 })).toBe('That file is empty.');
  });
});

describe('photo paths', () => {
  it('puts each photo in its report folder with the right extension', () => {
    expect(photoPath(REPORT, PHOTO, 'image/jpeg')).toBe(`${REPORT}/${PHOTO}.jpg`);
    expect(photoPath(REPORT, PHOTO, 'image/webp')).toBe(`${REPORT}/${PHOTO}.webp`);
    expect(() => photoPath(REPORT, PHOTO, 'image/gif')).toThrow('BAD_VALUE');
  });

  it('only accepts the exact path for that photo and report', () => {
    expect(isPhotoPathFor(REPORT, PHOTO, `${REPORT}/${PHOTO}.png`)).toBe(true);
    expect(isPhotoPathFor(REPORT, PHOTO, `other/${PHOTO}.png`)).toBe(false);
    expect(isPhotoPathFor(REPORT, PHOTO, `${REPORT}/../${PHOTO}.png`)).toBe(false);
    expect(isPhotoPathFor(REPORT, PHOTO, `${REPORT}/${PHOTO}.exe`)).toBe(false);
  });

  it('recognises photo kinds', () => {
    expect(isPhotoKind('nameplate')).toBe(true);
    expect(isPhotoKind('selfie')).toBe(false);
  });
});
