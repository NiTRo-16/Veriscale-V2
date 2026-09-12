import { formatDateTime } from '@/lib/format';
import { PHOTO_KIND_LABEL } from '@/lib/labels';
import type { PhotoRow, ReadingRow } from '@/lib/types';

export type PhotoWithUrl = PhotoRow & { url: string | null };

export function readingLabel(readings: Pick<ReadingRow, 'id' | 'test_type'>[], readingId: string | null): string | null {
  if (!readingId) return null;
  const index = readings.findIndex((r) => r.id === readingId);
  return index === -1 ? null : `Reading ${index + 1} · ${readings[index].test_type}`;
}

/** Read-only photo grid for the report page and print. */
export function ReportPhotos({ photos, readings }: { photos: PhotoWithUrl[]; readings: ReadingRow[] }) {
  return (
    <section className="border-t border-line pt-5">
      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">Photos</h3>
      {photos.length === 0 ? (
        <p className="text-[13px] text-muted">No photos attached.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => {
            const reading = readingLabel(readings, photo.reading_id);
            return (
              <li key={photo.id} className="overflow-hidden rounded-lg border border-line bg-page">
                {photo.url ? (
                  <a href={photo.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived private links */}
                    <img src={photo.url} alt={PHOTO_KIND_LABEL[photo.kind]} className="aspect-[4/3] w-full object-cover" />
                  </a>
                ) : (
                  <div className="grid aspect-[4/3] place-items-center text-[12px] text-muted">Photo unavailable</div>
                )}
                <div className="px-2.5 py-2 text-[12px]">
                  <div className="font-medium text-ink">{PHOTO_KIND_LABEL[photo.kind]}</div>
                  {reading && <div className="text-muted">{reading}</div>}
                  {photo.taken_at && <div className="text-muted">Taken {formatDateTime(photo.taken_at)}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
