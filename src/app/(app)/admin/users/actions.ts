'use server';

import { revalidatePath } from 'next/cache';
import { fail, getActor, ok, toFailure, type ActionResult } from '@/lib/actions';
import { logActivity } from '@/lib/activity';
import { isRole, validateNewUser, type NewUserInput } from '@/lib/admin';
import { isUuid } from '@/lib/draft-fields';
import { ROLE_LABEL } from '@/lib/labels';
import { createAdminSupabase } from '@/lib/supabase/admin';

export async function addUser(input: NewUserInput): Promise<ActionResult<{ fullName: string }>> {
  let fullName: string;
  try {
    const actor = await getActor(['admin']);
    const problem = validateNewUser(input);
    if (problem) return fail(problem);

    fullName = input.fullName.trim();
    const email = input.email.trim().toLowerCase();
    const role = input.role as keyof typeof ROLE_LABEL;
    const admin = createAdminSupabase();

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) {
      if (error && /already|registered|exists/i.test(error.message)) return fail('Someone with this email already has an account.');
      throw error ?? new Error('Could not create the account');
    }

    const { error: profileError } = await admin.from('profiles').insert({ id: data.user.id, full_name: fullName, email, role });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }

    await logActivity(actor, `Added user ${fullName} (${ROLE_LABEL[role]})`);
  } catch (err) {
    return toFailure(err);
  }
  revalidatePath('/admin/users');
  revalidatePath('/admin/activity');
  return ok({ fullName });
}

export async function changeRole(userId: string, role: string): Promise<ActionResult> {
  try {
    const actor = await getActor(['admin']);
    if (!isUuid(userId) || !isRole(role)) return fail("That choice isn't valid.");
    if (userId === actor.id && role !== 'admin') return fail("You can't remove your own admin role.");

    const { data, error } = await createAdminSupabase()
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select('full_name')
      .maybeSingle<{ full_name: string }>();
    if (error) throw error;
    if (!data) return fail('That user no longer exists.');

    await logActivity(actor, `Changed role for ${data.full_name} to ${ROLE_LABEL[role]}`);
  } catch (err) {
    return toFailure(err);
  }
  revalidatePath('/admin/users');
  revalidatePath('/admin/activity');
  return ok(null);
}
