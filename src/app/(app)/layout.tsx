import { Sidebar } from '@/components/shell/Sidebar';
import { AccountNotReady, SetupNeeded } from '@/components/ui/Notice';
import { requireSession } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupNeeded />;

  const { profile } = await requireSession();
  if (!profile) return <AccountNotReady />;

  let pendingCount = 0;
  if (profile.role !== 'technician') {
    const supabase = await createServerSupabase();
    const { count } = await supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    pendingCount = count ?? 0;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} pendingCount={pendingCount} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
