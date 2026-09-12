import 'server-only';
import { getSession } from './auth';
import { friendlyError } from './db-errors';
import type { Profile, Role } from './types';

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** An error whose message is already safe to show. */
export class ActionError extends Error {}

/** The signed-in user's profile, checked against the allowed roles. */
export async function getActor(roles?: readonly Role[]): Promise<Profile> {
  const session = await getSession();
  if (!session) throw new ActionError('Your session has ended. Please sign in again.');
  if (!session.profile) throw new ActionError("Your account isn't set up yet. Ask your lab admin.");
  if (roles && !roles.includes(session.profile.role)) throw new ActionError("You don't have access to do this.");
  return session.profile;
}

export function toFailure(err: unknown): { ok: false; error: string } {
  if (err instanceof ActionError) return fail(err.message);
  console.error(err);
  return fail(friendlyError(err));
}
