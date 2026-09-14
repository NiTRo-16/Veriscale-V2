import { Sidebar } from '@/components/shell/Sidebar';
import { AccountNotReady, SetupNeeded } from '@/components/ui/Notice';
import { requireSession } from '@/lib/auth';
import { addDays, DUE_SOON_DAYS, todayDate } from '@/lib/records';
import { countDueWeightSets } from '@/lib/records-data';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupNeeded />;

  const { profile } = await requireSession();
  if (!profile) return <AccountNotReady />;

  const supabase = await createServerSupabase();
  const { count: allCount } = await supabase.from('reports').select('id', { count: 'exact', head: true });

  let pendingCount = 0;
  let dueWeights = 0;
  if (profile.role !== 'technician') {
    const [{ count }, due] = await Promise.all([
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      countDueWeightSets(supabase, addDays(todayDate(), DUE_SOON_DAYS)),
    ]);
    pendingCount = count ?? 0;
    dueWeights = due;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} allCount={allCount ?? 0} pendingCount={pendingCount} dueWeights={dueWeights} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
