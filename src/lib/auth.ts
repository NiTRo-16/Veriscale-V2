import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createServerSupabase } from './supabase/server';
import type { Profile, Role } from './types';

export interface Session {
  userId: string;
  profile: Profile | null;
}

/** The signed-in user and their profile, once per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', user.id)
    .maybeSingle<Profile>();
  return { userId: user.id, profile: data ?? null };
});

/** For pages: the signed-in user's profile, or a redirect to sign in. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  return session;
}

export function hasRole(profile: Profile | null, roles: readonly Role[]): profile is Profile {
  return profile !== null && roles.includes(profile.role);
}
