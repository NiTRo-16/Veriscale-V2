'use server';

import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/format';
import { createServerSupabase } from '@/lib/supabase/server';

export interface SignInState {
  error?: string;
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'Incorrect email or password.' };

  redirect(safeNextPath(formData.get('next')));
}
