import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isUuid } from './draft-fields';
import type {
  AllowedErrorRule,
  FullReport,
  PhotoRow,
  ReadingRow,
  ReportListItem,
  ReportRow,
  ReportStatus,
} from './types';

// Postgres numeric values can arrive as strings; normalise them.
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export async function loadRules(sb: SupabaseClient): Promise<AllowedErrorRule[]> {
  const { data, error } = await sb.from('allowed_error_rules').select('id, accuracy_class, min_n, max_n, multiplier').order('id');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    accuracy_class: r.accuracy_class,
    min_n: Number(r.min_n),
    max_n: num(r.max_n),
    multiplier: Number(r.multiplier),
  }));
}

function normaliseReport(r: ReportRow): ReportRow {
  return {
    ...r,
    max_capacity_kg: num(r.max_capacity_kg),
    interval_e_g: num(r.interval_e_g),
    temperature_c: num(r.temperature_c),
    humidity_pct: num(r.humidity_pct),
    voltage_v: num(r.voltage_v),
  };
}

function normaliseReading(r: ReadingRow): ReadingRow {
  return {
    ...r,
    load_kg: num(r.load_kg),
    reference_kg: num(r.reference_kg),
    indicated_kg: num(r.indicated_kg),
    error_g: num(r.error_g),
    allowed_error_g: num(r.allowed_error_g),
  };
}

export async function loadReport(sb: SupabaseClient, id: string): Promise<FullReport | null> {
  if (!isUuid(id)) return null;
  const { data: report, error } = await sb.from('reports').select('*').eq('id', id).maybeSingle<ReportRow>();
  if (error) throw error;
  if (!report) return null;

  const [readings, photos] = await Promise.all([
    sb.from('readings').select('*').eq('report_id', id).order('position'),
    sb.from('photos').select('*').eq('report_id', id).order('uploaded_at'),
  ]);
  if (readings.error) throw readings.error;
  if (photos.error) throw photos.error;

  const personIds = [report.created_by, report.reviewed_by].filter((v): v is string => Boolean(v));
  const { data: profiles } = await sb.from('profiles').select('id, full_name').in('id', personIds);

  return {
    report: normaliseReport(report),
    readings: ((readings.data ?? []) as ReadingRow[]).map(normaliseReading),
    photos: (photos.data ?? []) as PhotoRow[],
    people: Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name])),
  };
}

export const REPORT_LIST_COLUMNS =
  'id, report_no, status, manufacturer, model, serial_number, accuracy_class, calculated_result, created_by, created_at, submitted_at, reviewed_at, creator:profiles!reports_created_by_fkey(full_name)';

type ListRow = Omit<ReportListItem, 'creator_name'> & { creator: { full_name: string } | { full_name: string }[] | null };

export function toListItem(row: ListRow): ReportListItem {
  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  const { creator: _creator, ...rest } = row;
  return { ...rest, creator_name: creator?.full_name ?? 'Unknown' };
}

export async function listReports(
  sb: SupabaseClient,
  options: { status?: ReportStatus; limit?: number } = {},
): Promise<ReportListItem[]> {
  let query = sb.from('reports').select(REPORT_LIST_COLUMNS).order('created_at', { ascending: false }).limit(options.limit ?? 200);
  if (options.status) query = query.eq('status', options.status);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as ListRow[]).map(toListItem);
}
