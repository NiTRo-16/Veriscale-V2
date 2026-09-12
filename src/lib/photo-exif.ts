import exifr from 'exifr';

/** When the photo was taken, from its EXIF data, as an ISO string — or null if the photo doesn't say. */
export async function readTakenAt(file: Blob): Promise<string | null> {
  try {
    const data = (await exifr.parse(file, ['DateTimeOriginal', 'CreateDate'])) as
      | { DateTimeOriginal?: Date; CreateDate?: Date }
      | undefined;
    const date = data?.DateTimeOriginal ?? data?.CreateDate;
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  } catch {
    return null;
  }
}
