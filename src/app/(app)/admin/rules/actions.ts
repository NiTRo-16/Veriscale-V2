'use server';

import { revalidatePath } from 'next/cache';
import { fail, getActor, ok, toFailure, type ActionResult } from '@/lib/actions';
import { createAdminSupabase } from '@/lib/supabase/admin';

export async function updateRule(ruleId: string, multiplier: number): Promise<ActionResult> {
  try {
    const actor = await getActor(['admin']);
    const value = Number(multiplier);
    if (!Number.isFinite(value) || value <= 0 || value > 100) return fail('Enter a number above 0.');
    const { error } = await createAdminSupabase().rpc('update_allowed_error', {
      p_rule_id: String(ruleId),
      p_multiplier: value,
      p_actor: actor.id,
    });
    if (error) throw error;
  } catch (err) {
    return toFailure(err);
  }
  revalidatePath('/admin/rules');
  revalidatePath('/admin/activity');
  return ok(null);
}
