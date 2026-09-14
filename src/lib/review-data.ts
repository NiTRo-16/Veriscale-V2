import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { REPORT_LIST_COLUMNS, toListItem } from './data';
import { isUuid } from './draft-fields';
import type { ReportCheck, RiskLevel } from './risk';
import type { ConditionSource, ReportListItem, StoredResult, TestStage } from './types';

const REVIEW_COLUMNS = `${REPORT_LIST_COLUMNS}, test_stage, temperature_source, humidity_source, reviewed_by, review_note, sent_back_at, sent_back_by, send_back_note`;

export interface ReviewListItem extends ReportListItem {
  test_stage: TestStage;
  temperature_source: ConditionSource | null;
  humidity_source: ConditionSource | null;
  reviewed_by: string | null;
  review_note: string | null;
  sent_back_at: string | null;
  sent_back_by: string | null;
  send_back_note: string | null;
}

/** A report in a review list, with what a reviewer sees at a glance. */
export interface QueueItem extends ReviewListItem {
  photo_count: number;
  /** The stored result of each reading, in order. */
  results: Array<StoredResult | null>;
  /** From the risk checks; null until they have run. */
  risk: RiskLevel | null;
}

type Rows = Parameters<typeof toListItem>[0][];
const toItems = (data: unknown): ReviewListItem[] =>
  ((data ?? []) as Rows).map((row) => ({ ...(row as object), ...toListItem(row) }) as unknown as ReviewListItem);

// The risk checks table arrives with migration 0007; until it is run, carry on without checks.
const MISSING_TABLE_CODES = new Set(['PGRST205', '42P01']);

/** Saved risk checks for these reports (reviewers and admins only; technicians get none). */
export async function loadReportChecks(sb: SupabaseClient, ids: readonly string[]): Promise<Map<string, ReportCheck>> {
  const valid = ids.filter((id) => isUuid(id));
  if (valid.length === 0) return new Map();
  const { data, error } = await sb
    .from('report_checks')
    .select('report_id, risk, flags, photo_reading, checked_at')
    .in('report_id', valid);
  if (error) {
    if (MISSING_TABLE_CODES.has(error.code)) {
      console.warn('Risk checks are not set up yet: run supabase/migrations/0007_risk_checks.sql');
      return new Map();
    }
    throw error;
  }
  return new Map(((data ?? []) as ReportCheck[]).map((check) => [check.report_id, check]));
}

async function withEvidence(sb: SupabaseClient, items: ReviewListItem[]): Promise<QueueItem[]> {
  if (items.length === 0) return [];
  const ids = items.map((r) => r.id);
  const [photos, readings, checks] = await Promise.all([
    sb.from('photos').select('report_id').in('report_id', ids),
    sb.from('readings').select('report_id, result').in('report_id', ids).order('position'),
    loadReportChecks(sb, ids),
  ]);
  if (photos.error) throw photos.error;
  if (readings.error) throw readings.error;

  const photoCount = new Map<string, number>();
  for (const p of photos.data ?? []) photoCount.set(p.report_id, (photoCount.get(p.report_id) ?? 0) + 1);
  const results = new Map<string, Array<StoredResult | null>>();
  for (const r of readings.data ?? []) results.set(r.report_id, [...(results.get(r.report_id) ?? []), r.result]);

  return items.map((item) => ({
    ...item,
    photo_count: photoCount.get(item.id) ?? 0,
    results: results.get(item.id) ?? [],
    risk: checks.get(item.id)?.risk ?? null,
  }));
}

/** Pending reports, oldest submitted first. */
export async function loadWaiting(sb: SupabaseClient): Promise<{ items: QueueItem[]; total: number }> {
  const { data, error, count } = await sb
    .from('reports')
    .select(REVIEW_COLUMNS, { count: 'exact' })
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true })
    .order('id')
    .limit(100);
  if (error) throw error;
  return { items: await withEvidence(sb, toItems(data)), total: count ?? 0 };
}

/** Drafts a reviewer sent back, still waiting on their technician. Newest first. */
export async function loadSentBack(sb: SupabaseClient): Promise<{ items: ReviewListItem[]; total: number }> {
  const { data, error, count } = await sb
    .from('reports')
    .select(REVIEW_COLUMNS, { count: 'exact' })
    .eq('status', 'draft')
    .not('sent_back_at', 'is', null)
    .order('sent_back_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return { items: toItems(data), total: count ?? 0 };
}

/** Ids of pending reports in queue order, for moving between reports on the review desk. */
export async function loadQueueIds(sb: SupabaseClient): Promise<string[]> {
  const { data, error } = await sb
    .from('reports')
    .select('id')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true })
    .order('id')
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}

/** Reports this person approved, failed or sent back. Turn into entries with `decisionEntries`. */
export async function loadMyDecisionReports(sb: SupabaseClient, userId: string): Promise<ReviewListItem[]> {
  if (!isUuid(userId)) return [];
  const { data, error } = await sb
    .from('reports')
    .select(REVIEW_COLUMNS)
    .or(`reviewed_by.eq.${userId},sent_back_by.eq.${userId}`)
    .order('updated_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return toItems(data);
}

/** Other submitted reports for the same serial number, newest first. */
export async function loadEarlierReports(sb: SupabaseClient, serial: string | null, excludeId: string): Promise<ReviewListItem[]> {
  if (!serial?.trim()) return [];
  const { data, error } = await sb
    .from('reports')
    .select(REVIEW_COLUMNS)
    .eq('serial_number', serial)
    .neq('id', excludeId)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return toItems(data);
}

/** Approved reports, most recently approved first. */
export async function loadCertificates(sb: SupabaseClient): Promise<ReviewListItem[]> {
  const { data, error } = await sb
    .from('reports')
    .select(REVIEW_COLUMNS)
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return toItems(data);
}

/** Profile id → full name for the given ids. */
export async function loadNames(sb: SupabaseClient, ids: ReadonlyArray<string | null>): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return {};
  const { data, error } = await sb.from('profiles').select('id, full_name').in('id', unique);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name]));
}
