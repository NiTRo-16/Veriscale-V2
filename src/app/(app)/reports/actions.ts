'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { ActionError, fail, getActor, ok, toFailure, type ActionResult } from '@/lib/actions';
import { logActivity } from '@/lib/activity';
import { calculateReading, reportResult } from '@/lib/calc';
import { isUuid, sanitizeDraftFields, sanitizeReadings, type ReadingDraft } from '@/lib/draft-fields';
import { loadReport, loadRules } from '@/lib/data';
import { REVIEW_CHECKS } from '@/lib/labels';
import { PHOTO_BUCKET, isPhotoKind, isPhotoPathFor } from '@/lib/photos';
import { submitProblems } from '@/lib/readiness';
import { isOverdueOn, todayDate } from '@/lib/records';
import { runReportChecks } from '@/lib/risk-checks';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

function refreshReportPages(reportId?: string) {
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  revalidatePath('/review');
  revalidatePath('/review/decisions');
  revalidatePath('/certificates');
  if (reportId) revalidatePath(`/reports/${reportId}`);
}

const cleanNote = (note: unknown) => (typeof note === 'string' && note.trim() ? note.trim().slice(0, 1000) : null);

/** Keeps only the known check keys, as true/false. */
function cleanChecks(checks: unknown): Record<string, boolean> | null {
  if (!checks || typeof checks !== 'object') return null;
  const source = checks as Record<string, unknown>;
  return Object.fromEntries(REVIEW_CHECKS.map(({ key }) => [key, source[key] === true]));
}

/** Loads a report the actor is about to change and checks it is their own draft. */
async function requireOwnDraft(actor: Profile, reportId: string) {
  if (!isUuid(reportId)) throw new ActionError('This report could not be found.');
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from('reports')
    .select('id, report_no, status, created_by')
    .eq('id', reportId)
    .maybeSingle<{ id: string; report_no: string; status: string; created_by: string }>();
  if (error) throw error;
  if (!data) throw new ActionError('This report could not be found.');
  if (data.created_by !== actor.id) throw new ActionError('Only the person who created this report can change it.');
  if (data.status !== 'draft') throw new ActionError('This report has been submitted and can no longer be changed.');
  return { sb, report: data };
}

export async function createDraft(): Promise<ActionResult> {
  let reportId: string;
  try {
    const actor = await getActor(['technician', 'admin']);
    const { data, error } = await createAdminSupabase()
      .from('reports')
      .insert({ created_by: actor.id })
      .select('id, report_no')
      .single<{ id: string; report_no: string }>();
    if (error) throw error;
    await logActivity(actor, 'Created draft', data.report_no);
    reportId = data.id;
  } catch (err) {
    return toFailure(err);
  }
  refreshReportPages();
  redirect(`/reports/${reportId}`);
}

export async function deleteDraft(reportId: string): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const { report } = await requireOwnDraft(actor, reportId);
    const admin = createAdminSupabase();

    const { data: files } = await admin.storage.from(PHOTO_BUCKET).list(reportId, { limit: 1000 });
    if (files && files.length > 0) {
      await admin.storage.from(PHOTO_BUCKET).remove(files.map((f) => `${reportId}/${f.name}`));
    }

    const { error } = await admin.from('reports').delete().eq('id', reportId).eq('status', 'draft');
    if (error) throw error;
    await logActivity(actor, 'Deleted draft', report.report_no);
  } catch (err) {
    return toFailure(err);
  }
  refreshReportPages();
  redirect('/reports');
}

export async function saveDraftFields(reportId: string, fields: Record<string, unknown>): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const { sb } = await requireOwnDraft(actor, reportId);
    const clean = sanitizeDraftFields(fields ?? {});
    if (Object.keys(clean).length === 0) return ok(null);
    const { error } = await sb.from('reports').update(clean).eq('id', reportId);
    if (error) throw error;
    return ok(null);
  } catch (err) {
    return toFailure(err);
  }
}

export async function saveReadings(reportId: string, readings: ReadingDraft[]): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const { sb } = await requireOwnDraft(actor, reportId);
    const rows = sanitizeReadings(reportId, readings);

    let removal = sb.from('readings').delete().eq('report_id', reportId);
    if (rows.length > 0) removal = removal.not('id', 'in', `(${rows.map((r) => r.id).join(',')})`);
    const { error: removeError } = await removal;
    if (removeError) throw removeError;

    if (rows.length > 0) {
      const { error } = await sb.from('readings').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
    return ok(null);
  } catch (err) {
    return toFailure(err);
  }
}

export async function submitReport(reportId: string): Promise<ActionResult> {
  try {
    const actor = await getActor(['technician', 'admin']);
    const { sb } = await requireOwnDraft(actor, reportId);
    const full = await loadReport(sb, reportId);
    if (!full) throw new ActionError('This report could not be found.');

    let weightSetOverdue = false;
    if (full.report.weight_set_id) {
      const { data: weightSet, error: weightSetError } = await sb
        .from('weight_sets')
        .select('next_check')
        .eq('id', full.report.weight_set_id)
        .maybeSingle();
      if (weightSetError) throw weightSetError;
      weightSetOverdue = isOverdueOn(weightSet?.next_check, full.report.test_date ?? todayDate());
    }

    const problems = submitProblems({ ...full.report, weight_set_overdue: weightSetOverdue }, full.readings);
    if (problems.length > 0) return fail(`Can't submit yet: ${problems.join(' · ')}`);

    const rules = await loadRules(sb);
    const results = full.readings.map((r) => ({
      id: r.id,
      ...calculateReading(
        {
          accuracy_class: full.report.accuracy_class,
          interval_e_g: full.report.interval_e_g,
          test_stage: full.report.test_stage,
          load_kg: r.load_kg,
          reference_kg: r.reference_kg,
          indicated_kg: r.indicated_kg,
        },
        rules,
      ),
    }));
    if (results.some((r) => r.result === 'incomplete')) {
      return fail("Can't submit yet: some readings can't be worked out. Check the accuracy class and interval.");
    }

    const { error } = await createAdminSupabase().rpc('submit_report', {
      p_report_id: reportId,
      p_actor: actor.id,
      p_results: results.map((r) => ({ id: r.id, error_g: r.errorG, allowed_error_g: r.allowedErrorG, result: r.result })),
      p_calculated: reportResult(results.map((r) => r.result)),
    });
    if (error) throw error;
    // The risk checks read the photos, which takes a little while, so they run after the response.
    after(() => runReportChecks(reportId).catch((err) => console.error('Risk checks failed', err)));
  } catch (err) {
    return toFailure(err);
  }
  refreshReportPages(reportId);
  return ok(null);
}

export async function reviewReport(
  reportId: string,
  decision: 'approved' | 'failed',
  note: string,
  checks?: Record<string, boolean>,
): Promise<ActionResult> {
  try {
    const actor = await getActor(['reviewer', 'admin']);
    if (!isUuid(reportId)) throw new ActionError('This report could not be found.');
    if (decision !== 'approved' && decision !== 'failed') throw new ActionError("That choice isn't valid.");
    const { error } = await createAdminSupabase().rpc('review_report', {
      p_report_id: reportId,
      p_actor: actor.id,
      p_decision: decision,
      p_note: cleanNote(note),
      p_checks: cleanChecks(checks),
    });
    if (error) throw error;
  } catch (err) {
    refreshReportPages(reportId);
    return toFailure(err);
  }
  refreshReportPages(reportId);
  return ok(null);
}

export async function sendBackReport(reportId: string, note: string): Promise<ActionResult> {
  try {
    const actor = await getActor(['reviewer', 'admin']);
    if (!isUuid(reportId)) throw new ActionError('This report could not be found.');
    const { error } = await createAdminSupabase().rpc('send_back_report', {
      p_report_id: reportId,
      p_actor: actor.id,
      p_note: cleanNote(note),
    });
    if (error) throw error;
  } catch (err) {
    refreshReportPages(reportId);
    return toFailure(err);
  }
  refreshReportPages(reportId);
  return ok(null);
}

export async function addPhoto(
  reportId: string,
  photo: { id: string; kind: string; storagePath: string; takenAt: string | null; readingId: string | null },
): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const { sb } = await requireOwnDraft(actor, reportId);
    if (!isUuid(photo?.id) || !isPhotoPathFor(reportId, photo.id, photo.storagePath) || !isPhotoKind(photo.kind)) {
      throw new ActionError("That photo isn't valid.");
    }

    let readingId: string | null = null;
    if (isUuid(photo.readingId)) {
      const { data } = await sb.from('readings').select('id').eq('id', photo.readingId).eq('report_id', reportId).maybeSingle();
      readingId = data ? photo.readingId : null;
    }
    const takenAt = photo.takenAt && !Number.isNaN(Date.parse(photo.takenAt)) ? new Date(photo.takenAt).toISOString() : null;

    const { error } = await sb.from('photos').insert({
      id: photo.id,
      report_id: reportId,
      reading_id: readingId,
      kind: photo.kind,
      storage_path: photo.storagePath,
      taken_at: takenAt,
      uploaded_by: actor.id,
    });
    if (error) {
      await sb.storage.from(PHOTO_BUCKET).remove([photo.storagePath]);
      throw error;
    }
  } catch (err) {
    return toFailure(err);
  }
  revalidatePath(`/reports/${reportId}`);
  return ok(null);
}

export async function removePhoto(reportId: string, photoId: string): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const { sb } = await requireOwnDraft(actor, reportId);
    if (!isUuid(photoId)) throw new ActionError('That photo could not be found.');
    const { data, error } = await sb
      .from('photos')
      .delete()
      .eq('id', photoId)
      .eq('report_id', reportId)
      .select('storage_path')
      .maybeSingle<{ storage_path: string }>();
    if (error) throw error;
    if (data) await sb.storage.from(PHOTO_BUCKET).remove([data.storage_path]);
  } catch (err) {
    return toFailure(err);
  }
  revalidatePath(`/reports/${reportId}`);
  return ok(null);
}

/** Runs a submitted report's risk checks again, e.g. after photo reading was turned on. */
export async function checkReportAgain(reportId: string): Promise<ActionResult> {
  try {
    await getActor(['reviewer', 'admin']);
    if (!isUuid(reportId)) throw new ActionError('This report could not be found.');
    await runReportChecks(reportId);
  } catch (err) {
    return toFailure(err);
  }
  revalidatePath(`/reports/${reportId}`);
  revalidatePath('/review');
  return ok(null);
}
