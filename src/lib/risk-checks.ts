import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadReport } from './data';
import { photoReadingEnabled, readDisplayPhoto, readNameplatePhoto } from './photo-reading';
import { PHOTO_BUCKET } from './photos';
import {
  compareDisplay,
  compareNameplate,
  duplicatePhotoFlags,
  riskLevel,
  ruleFlags,
  sortFlags,
  type PhotoReadingStatus,
  type RiskFlag,
  type RuleInput,
} from './risk';
import { createAdminSupabase } from './supabase/admin';
import { LAB_TIME_ZONE } from './time-zone';
import type { PhotoRow, ReadingRow, ReportRow } from './types';

// Runs the risk checks for one submitted report and saves the result for reviewers.
// Uses the service client: technicians can't see these results.

/** Display photos read per report, to keep time and cost bounded. */
const MAX_DISPLAY_PHOTOS = 8;

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

type PhotoFile = { photo: PhotoRow; bytes: Uint8Array | null };

async function loadEarlier(sb: SupabaseClient, report: ReportRow): Promise<RuleInput['earlier']> {
  if (!report.serial_number?.trim()) return [];
  const { data: reports, error } = await sb
    .from('reports')
    .select('id, report_no')
    .eq('serial_number', report.serial_number)
    .neq('id', report.id)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  if (!reports?.length) return [];

  const { data: rows, error: readingsError } = await sb
    .from('readings')
    .select('report_id, test_type, load_kg, reference_kg, indicated_kg')
    .in('report_id', reports.map((r) => r.id))
    .order('position');
  if (readingsError) throw readingsError;
  return reports.map((r) => ({
    report_no: r.report_no as string,
    readings: (rows ?? [])
      .filter((row) => row.report_id === r.id)
      .map((row) => ({
        test_type: row.test_type as string,
        load_kg: num(row.load_kg),
        reference_kg: num(row.reference_kg),
        indicated_kg: num(row.indicated_kg),
      })),
  }));
}

async function loadPreviousByTechnician(sb: SupabaseClient, report: ReportRow): Promise<RuleInput['previousByTechnician']> {
  if (!report.submitted_at) return null;
  const { data, error } = await sb
    .from('reports')
    .select('report_no, temperature_c, humidity_pct')
    .eq('created_by', report.created_by)
    .neq('id', report.id)
    .lt('submitted_at', report.submitted_at)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { report_no: data.report_no as string, temperature_c: num(data.temperature_c), humidity_pct: num(data.humidity_pct) } : null;
}

async function downloadPhotos(sb: SupabaseClient, photos: PhotoRow[]): Promise<PhotoFile[]> {
  return Promise.all(
    photos.map(async (photo) => {
      const { data, error } = await sb.storage.from(PHOTO_BUCKET).download(photo.storage_path);
      return { photo, bytes: error || !data ? null : new Uint8Array(await data.arrayBuffer()) };
    }),
  );
}

/** Saves a fingerprint of each photo file and flags files already attached to another report. */
async function duplicateFlags(sb: SupabaseClient, reportId: string, files: PhotoFile[]): Promise<RiskFlag[]> {
  const prints = files.flatMap(({ photo, bytes }) =>
    bytes ? [{ photo, fingerprint: createHash('sha256').update(bytes).digest('hex') }] : [],
  );
  if (prints.length === 0) return [];

  const { error } = await sb
    .from('photo_fingerprints')
    .upsert(prints.map((p) => ({ photo_id: p.photo.id, report_id: reportId, fingerprint: p.fingerprint })), { onConflict: 'photo_id' });
  if (error) throw error;

  const { data: others, error: othersError } = await sb
    .from('photo_fingerprints')
    .select('fingerprint, report_id')
    .in('fingerprint', prints.map((p) => p.fingerprint))
    .neq('report_id', reportId);
  if (othersError) throw othersError;
  if (!others?.length) return [];

  const { data: reports, error: reportsError } = await sb
    .from('reports')
    .select('id, report_no')
    .in('id', [...new Set(others.map((o) => o.report_id as string))]);
  if (reportsError) throw reportsError;
  const reportNo = new Map((reports ?? []).map((r) => [r.id as string, r.report_no as string]));

  return duplicatePhotoFlags(
    prints.flatMap(({ photo, fingerprint }) => {
      const other = others.find((o) => o.fingerprint === fingerprint);
      return other ? [{ kind: photo.kind, report_no: reportNo.get(other.report_id as string) ?? 'another report' }] : [];
    }),
  );
}

/** Reads display and nameplate photos and compares them with the report. Throws if the reader fails. */
async function photoFlags(report: ReportRow, readings: ReadingRow[], files: PhotoFile[]): Promise<RiskFlag[]> {
  const displays = files
    .filter((f): f is { photo: PhotoRow; bytes: Uint8Array } => f.photo.kind === 'display' && Boolean(f.photo.reading_id) && f.bytes !== null)
    .slice(0, MAX_DISPLAY_PHOTOS);
  const nameplate = files.find((f): f is { photo: PhotoRow; bytes: Uint8Array } => f.photo.kind === 'nameplate' && f.bytes !== null);

  const [displayResults, nameplateResults] = await Promise.all([
    Promise.all(
      displays.map(async ({ photo, bytes }) => {
        const index = readings.findIndex((r) => r.id === photo.reading_id);
        if (index === -1) return null;
        return compareDisplay({ index, indicated_kg: readings[index].indicated_kg }, await readDisplayPhoto(bytes));
      }),
    ),
    nameplate ? readNameplatePhoto(nameplate.bytes).then((read) => compareNameplate(report, read)) : Promise.resolve([]),
  ]);
  return [...displayResults.filter((f): f is RiskFlag => f !== null), ...nameplateResults];
}

export async function runReportChecks(reportId: string): Promise<void> {
  const sb = createAdminSupabase();
  const full = await loadReport(sb, reportId);
  if (!full || full.report.status === 'draft') return;
  const { report, readings, photos } = full;

  const [earlier, previousByTechnician, files] = await Promise.all([
    loadEarlier(sb, report),
    loadPreviousByTechnician(sb, report),
    downloadPhotos(sb, photos),
  ]);

  const flags = ruleFlags({ report, readings, photos, earlier, previousByTechnician, timeZone: LAB_TIME_ZONE });
  flags.push(...(await duplicateFlags(sb, report.id, files)));

  let photoReading: PhotoReadingStatus = 'off';
  if (photoReadingEnabled()) {
    try {
      flags.push(...(await photoFlags(report, readings, files)));
      photoReading = 'done';
    } catch (err) {
      console.error('Photo reading failed', err);
      photoReading = 'failed';
    }
  }

  const { error } = await sb.from('report_checks').upsert(
    {
      report_id: report.id,
      risk: riskLevel(flags),
      flags: sortFlags(flags),
      photo_reading: photoReading,
      checked_at: new Date().toISOString(),
    },
    { onConflict: 'report_id' },
  );
  if (error) throw error;
}
