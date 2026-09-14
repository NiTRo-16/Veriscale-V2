'use server';

import { revalidatePath } from 'next/cache';
import { fail, getActor, ok, toFailure, type ActionResult } from '@/lib/actions';
import { toNum } from '@/lib/calc';
import { isUuid } from '@/lib/draft-fields';
import { validateManufacturer, validateModel, validateWeightSet } from '@/lib/records';
import { createAdminSupabase } from '@/lib/supabase/admin';

const EDITORS = ['reviewer', 'admin'] as const;

function refreshRecordPages() {
  revalidatePath('/records/manufacturers');
  revalidatePath('/records/models');
  revalidatePath('/records/weights');
  revalidatePath('/admin/activity');
  revalidatePath('/reports', 'layout');
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const optional = (v: unknown) => text(v) || null;
const idOrNull = (v: unknown) => (isUuid(v) ? v : null);

export interface ManufacturerValues {
  id?: string | null;
  name: string;
}

export async function saveManufacturer(values: ManufacturerValues): Promise<ActionResult<string>> {
  let id: string;
  try {
    const actor = await getActor([...EDITORS]);
    const problem = validateManufacturer(values ?? {});
    if (problem) return fail(problem);
    const { data, error } = await createAdminSupabase().rpc('save_manufacturer', {
      p_id: idOrNull(values.id),
      p_name: text(values.name),
      p_actor: actor.id,
    });
    if (error) throw error;
    id = data as string;
  } catch (err) {
    return toFailure(err);
  }
  refreshRecordPages();
  return ok(id);
}

export interface ModelValues {
  id?: string | null;
  manufacturerId: string;
  name: string;
  accuracyClass: string;
  maxCapacityKg: string;
  intervalEG: string;
}

export async function saveModel(values: ModelValues): Promise<ActionResult<string>> {
  let id: string;
  try {
    const actor = await getActor([...EDITORS]);
    const problem = validateModel(values ?? {});
    if (problem) return fail(problem);
    const { data, error } = await createAdminSupabase().rpc('save_instrument_model', {
      p_id: idOrNull(values.id),
      p_manufacturer_id: values.manufacturerId,
      p_name: text(values.name),
      p_accuracy_class: text(values.accuracyClass),
      p_max_capacity_kg: toNum(values.maxCapacityKg),
      p_interval_e_g: toNum(values.intervalEG),
      p_actor: actor.id,
    });
    if (error) throw error;
    id = data as string;
  } catch (err) {
    return toFailure(err);
  }
  refreshRecordPages();
  return ok(id);
}

export interface WeightSetValues {
  id?: string | null;
  code: string;
  description: string;
  weightClass: string;
  nominalRange: string;
  certificateNo: string;
  lastChecked: string;
  nextCheck: string;
}

export async function saveWeightSet(values: WeightSetValues): Promise<ActionResult<string>> {
  let id: string;
  try {
    const actor = await getActor([...EDITORS]);
    const problem = validateWeightSet(values ?? {});
    if (problem) return fail(problem);
    const { data, error } = await createAdminSupabase().rpc('save_weight_set', {
      p_id: idOrNull(values.id),
      p_code: text(values.code),
      p_description: optional(values.description),
      p_weight_class: text(values.weightClass),
      p_nominal_range: optional(values.nominalRange),
      p_certificate_no: optional(values.certificateNo),
      p_last_checked: optional(values.lastChecked),
      p_next_check: text(values.nextCheck),
      p_actor: actor.id,
    });
    if (error) throw error;
    id = data as string;
  } catch (err) {
    return toFailure(err);
  }
  refreshRecordPages();
  return ok(id);
}
