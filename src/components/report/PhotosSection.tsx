'use client';

import { ImagePlus, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { addPhoto, removePhoto } from '@/app/(app)/reports/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { formatDateTime } from '@/lib/format';
import { PHOTO_KIND_LABEL } from '@/lib/labels';
import { readTakenAt } from '@/lib/photo-exif';
import { ACCEPTED_PHOTO_TYPES, PHOTO_BUCKET, PHOTO_KINDS, photoPath, validatePhoto } from '@/lib/photos';
import { createBrowserSupabase } from '@/lib/supabase/client';
import type { PhotoKind } from '@/lib/types';
import type { ReadingDraftRow } from './draft-form';
import { readingLabel, type PhotoWithUrl } from './ReportPhotos';

interface Upload {
  key: string;
  file: File;
  kind: PhotoKind;
  readingId: string | null;
  preview: string;
  status: 'uploading' | 'failed';
  error?: string;
}

export function PhotosSection({
  reportId,
  initialPhotos,
  readings,
  beforeUpload,
}: {
  reportId: string;
  initialPhotos: PhotoWithUrl[];
  readings: ReadingDraftRow[];
  beforeUpload: () => Promise<boolean>;
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [kind, setKind] = useState<PhotoKind>('nameplate');
  const [readingId, setReadingId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const previews = useRef<string[]>([]);

  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const patchUpload = (key: string, patch: Partial<Upload>) =>
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...patch } : u)));

  const upload = async (item: Upload) => {
    patchUpload(item.key, { status: 'uploading', error: undefined });
    const fail = (error: string) => patchUpload(item.key, { status: 'failed', error });

    if (!(await beforeUpload())) return fail("Your latest changes haven't saved yet. Try again in a moment.");

    const id = crypto.randomUUID();
    const path = photoPath(reportId, id, item.file.type);
    const takenAt = await readTakenAt(item.file);

    const { error: uploadError } = await createBrowserSupabase()
      .storage.from(PHOTO_BUCKET)
      .upload(path, item.file, { contentType: item.file.type, upsert: false });
    if (uploadError) return fail('Upload failed. Check your connection and retry.');

    const result = await addPhoto(reportId, { id, kind: item.kind, storagePath: path, takenAt, readingId: item.readingId });
    if (!result.ok) return fail(result.error);

    setPhotos((list) => [
      ...list,
      {
        id,
        report_id: reportId,
        reading_id: item.readingId,
        kind: item.kind,
        storage_path: path,
        taken_at: takenAt,
        uploaded_by: '',
        uploaded_at: new Date().toISOString(),
        url: item.preview,
      },
    ]);
    setUploads((list) => list.filter((u) => u.key !== item.key));
  };

  const onFiles = (files: FileList | null) => {
    setMessage(null);
    if (!files) return;
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      const problem = validatePhoto(file);
      if (problem) {
        problems.push(`${file.name}: ${problem}`);
        continue;
      }
      const preview = URL.createObjectURL(file);
      previews.current.push(preview);
      const item: Upload = { key: crypto.randomUUID(), file, kind, readingId: readingId || null, preview, status: 'uploading' };
      setUploads((list) => [...list, item]);
      void upload(item);
    }
    if (problems.length) setMessage(problems.join(' '));
    if (input.current) input.current.value = '';
  };

  const onRemove = async (photoId: string) => {
    setRemoving(photoId);
    const result = await removePhoto(reportId, photoId);
    setRemoving(null);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setPhotos((list) => list.filter((p) => p.id !== photoId));
  };

  return (
    <Card title="Photos" subtitle="Nameplate, display readings, test setup and seals. JPEG, PNG or WebP up to 10 MB.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-soft">
            Photo shows
            <Select className="w-44" value={kind} onChange={(e) => setKind(e.target.value as PhotoKind)}>
              {PHOTO_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PHOTO_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-soft">
            For
            <Select className="w-64" value={readingId} onChange={(e) => setReadingId(e.target.value)}>
              <option value="">The whole report</option>
              {readings.map((r, i) => (
                <option key={r.id} value={r.id}>
                  Reading {i + 1} · {r.test_type}
                </option>
              ))}
            </Select>
          </label>
          <input
            ref={input}
            type="file"
            accept={ACCEPTED_PHOTO_TYPES.join(',')}
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button variant="secondary" onClick={() => input.current?.click()}>
            <ImagePlus size={16} strokeWidth={1.75} /> Add photos
          </Button>
        </div>

        {message && (
          <p role="alert" className="rounded-lg bg-red-soft px-3 py-2 text-[12.5px] text-red">
            {message}
          </p>
        )}

        {photos.length === 0 && uploads.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-muted">
            No photos yet.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => (
              <li key={photo.id} className="overflow-hidden rounded-lg border border-line bg-page">
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private, short-lived links
                  <img src={photo.url} alt={PHOTO_KIND_LABEL[photo.kind]} className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center text-[12px] text-muted">Photo unavailable</div>
                )}
                <div className="flex items-start justify-between gap-2 px-2.5 py-2 text-[12px]">
                  <div className="min-w-0">
                    <div className="font-medium text-ink">{PHOTO_KIND_LABEL[photo.kind]}</div>
                    {readingLabel(readings, photo.reading_id) && <div className="truncate text-muted">{readingLabel(readings, photo.reading_id)}</div>}
                    {photo.taken_at && <div className="text-muted">Taken {formatDateTime(photo.taken_at)}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(photo.id)}
                    disabled={removing === photo.id}
                    aria-label={`Remove ${PHOTO_KIND_LABEL[photo.kind]} photo`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-red-soft hover:text-red disabled:opacity-50"
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </li>
            ))}
            {uploads.map((u) => (
              <li key={u.key} className="overflow-hidden rounded-lg border border-line bg-page">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                  <img src={u.preview} alt="" className="aspect-[4/3] w-full object-cover opacity-60" />
                  {u.status === 'uploading' && (
                    <span className="absolute inset-0 grid place-items-center">
                      <Loader2 size={22} className="animate-spin text-ink" />
                    </span>
                  )}
                </div>
                <div className="px-2.5 py-2 text-[12px]">
                  <div className="font-medium text-ink">{PHOTO_KIND_LABEL[u.kind]}</div>
                  {u.status === 'uploading' ? (
                    <div className="text-muted">Uploading…</div>
                  ) : (
                    <>
                      <div className="text-red">{u.error}</div>
                      <div className="mt-1.5 flex gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => void upload(u)}>
                          <RotateCcw size={13} /> Retry
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setUploads((list) => list.filter((x) => x.key !== u.key))}>
                          Remove
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
