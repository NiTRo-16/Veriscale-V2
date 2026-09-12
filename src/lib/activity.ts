import 'server-only';
import { createAdminSupabase } from './supabase/admin';
import type { Profile } from './types';

/** Adds a plain-words entry to the activity log. Never blocks the action it records. */
export async function logActivity(actor: Profile, message: string, reportNo?: string | null): Promise<void> {
  const { error } = await createAdminSupabase()
    .from('activity_log')
    .insert({ actor_id: actor.id, actor_name: actor.full_name, actor_role: actor.role, message, report_no: reportNo ?? null });
  if (error) console.error('Could not write to the activity log', error);
}
