import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecordReport } from './records';
import type { InstrumentModel, Manufacturer, WeightSet } from './types';

export async function loadManufacturers(sb: SupabaseClient): Promise<Manufacturer[]> {
  const { data, error } = await sb.from('manufacturers').select('id, name, created_by, created_at').order('name');
  if (error) throw error;
  return (data ?? []) as Manufacturer[];
}

export async function loadModels(sb: SupabaseClient): Promise<InstrumentModel[]> {
  const { data, error } = await sb
    .from('instrument_models')
    .select('id, manufacturer_id, name, accuracy_class, max_capacity_kg, interval_e_g, created_at')
    .order('name');
  if (error) throw error;
  return (data ?? []).map((m) => ({ ...m, max_capacity_kg: Number(m.max_capacity_kg), interval_e_g: Number(m.interval_e_g) })) as InstrumentModel[];
}

export async function loadWeightSets(sb: SupabaseClient): Promise<WeightSet[]> {
  const { data, error } = await sb
    .from('weight_sets')
    .select('id, code, description, weight_class, nominal_range, certificate_no, last_checked, next_check, created_at, updated_at')
    .order('code');
  if (error) throw error;
  return (data ?? []) as WeightSet[];
}

/** The report details the records pages need to count and list reports. */
export async function loadRecordReports(sb: SupabaseClient): Promise<RecordReport[]> {
  const { data, error } = await sb
    .from('reports')
    .select(
      'id, report_no, status, manufacturer, manufacturer_id, model, model_id, serial_number, test_stage, test_date, created_at, submitted_at, weight_set_id',
    )
    .order('created_at', { ascending: false })
    .limit(10000);
  if (error) throw error;
  return (data ?? []) as RecordReport[];
}

/** Weight sets whose check is due within `days` of `today`, or already overdue. */
export async function countDueWeightSets(sb: SupabaseClient, lastDueDate: string): Promise<number> {
  const { count, error } = await sb.from('weight_sets').select('id', { count: 'exact', head: true }).lte('next_check', lastDueDate);
  if (error) throw error;
  return count ?? 0;
}
