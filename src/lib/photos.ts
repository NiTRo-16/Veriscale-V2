import type { PhotoKind } from './types';

export const PHOTO_BUCKET = 'report-photos';
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PHOTO_KINDS: readonly PhotoKind[] = ['nameplate', 'display', 'setup', 'seals', 'other'];

const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** A plain message explaining why a file can't be added, or null. */
export function validatePhoto(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_PHOTO_TYPES as readonly string[]).includes(file.type)) return 'Only JPEG, PNG or WebP photos can be added.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_PHOTO_BYTES) return 'Photos must be 10 MB or smaller.';
  return null;
}

/** Storage path: "{reportId}/{photoId}.{ext}" */
export function photoPath(reportId: string, photoId: string, type: string): string {
  const ext = EXTENSION[type];
  if (!ext) throw new Error('BAD_VALUE');
  return `${reportId}/${photoId}.${ext}`;
}

/** True when `path` is exactly the storage path for this photo in this report. */
export function isPhotoPathFor(reportId: string, photoId: string, path: string): boolean {
  return Object.values(EXTENSION).some((ext) => path === `${reportId}/${photoId}.${ext}`);
}

export const isPhotoKind = (v: unknown): v is PhotoKind => typeof v === 'string' && (PHOTO_KINDS as readonly string[]).includes(v);
