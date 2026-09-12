import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DashboardReport } from './dashboard';
import { REPORT_LIST_COLUMNS, toListItem } from './data';
import type { ReportListItem } from './types';

type Rows = Parameters<typeof toListItem>[0][];

export async function loadDashboardReports(sb: SupabaseClient): Promise<DashboardReport[]> {
  const { data, error } = await sb.from('reports').select('status, accuracy_class, created_at, submitted_at, reviewed_at').limit(10000);
  if (error) throw error;
  return (data ?? []) as DashboardReport[];
}

export async function loadMyDrafts(sb: SupabaseClient, userId: string): Promise<ReportListItem[]> {
  const { data, error } = await sb
    .from('reports')
    .select(REPORT_LIST_COLUMNS)
    .eq('status', 'draft')
    .eq('created_by', userId)
    .order('updated_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return ((data ?? []) as unknown as Rows).map(toListItem);
}

/** Pending reports, oldest submitted first. */
export async function loadReviewQueue(sb: SupabaseClient): Promise<ReportListItem[]> {
  const { data, error } = await sb
    .from('reports')
    .select(REPORT_LIST_COLUMNS)
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as Rows).map(toListItem);
}

export async function loadRecentDecisions(sb: SupabaseClient): Promise<ReportListItem[]> {
  const { data, error } = await sb
    .from('reports')
    .select(REPORT_LIST_COLUMNS)
    .in('status', ['approved', 'failed'])
    .order('reviewed_at', { ascending: false })
    .limit(8);
  if (error) throw error;
  return ((data ?? []) as unknown as Rows).map(toListItem);
}
