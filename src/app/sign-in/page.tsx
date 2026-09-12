import { Scale } from 'lucide-react';
import { SetupNeeded } from '@/components/ui/Notice';
import { safeNextPath } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { SignInForm } from './SignInForm';

export const metadata = { title: 'Sign in · VeriScale' };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!isSupabaseConfigured()) return <SetupNeeded />;
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page px-4">
      <div className="mb-7 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-black text-white">
          <Scale size={22} strokeWidth={1.6} />
        </div>
        <div>
          <div className="text-[18px] font-semibold leading-tight text-ink">VeriScale</div>
          <div className="text-[12px] text-muted">Test reports for weighing instruments</div>
        </div>
      </div>
      <div className="w-full max-w-[400px] rounded-card border border-line bg-card p-7 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_rgba(16,24,40,0.06)]">
        <h1 className="text-[18px] font-semibold text-ink">Sign in</h1>
        <p className="mb-6 mt-1 text-[13px] text-muted">Use the account your lab admin gave you.</p>
        <SignInForm next={safeNextPath(next)} />
      </div>
      <p className="mt-5 text-[12px] text-muted">Accounts are added by your lab admin.</p>
    </div>
  );
}
