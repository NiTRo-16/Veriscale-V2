import { AddUserForm } from '@/components/admin/AddUserForm';
import { RoleSelect } from '@/components/admin/RoleSelect';
import { Card } from '@/components/ui/Card';
import { NoAccess } from '@/components/ui/Notice';
import { PageBody, PageHeader } from '@/components/ui/PageHeader';
import { hasRole, requireSession } from '@/lib/auth';
import { formatDate, initials } from '@/lib/format';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

export const metadata = { title: 'Users · VeriScale' };

export default async function UsersPage() {
  const { profile } = await requireSession();
  if (!hasRole(profile, ['admin'])) return <NoAccess />;

  const supabase = await createServerSupabase();
  const { data } = await supabase.from('profiles').select('id, full_name, email, role, created_at').order('full_name');
  const users = (data ?? []) as Array<Profile & { created_at: string }>;

  return (
    <>
      <PageHeader crumbs={[{ label: 'Administration' }, { label: 'Users' }]} />
      <PageBody>
        <AddUserForm />
        <Card title="All users" actions={<span className="text-[12px] text-muted">{users.length} users</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="bg-page text-left text-[11.5px] text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Name</th>
                  <th className="px-5 py-2.5 font-medium">Email</th>
                  <th className="px-5 py-2.5 font-medium">Role</th>
                  <th className="px-5 py-2.5 font-medium">Added</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-line">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-green-soft text-[11px] font-semibold text-green-ink">
                          {initials(user.full_name)}
                        </span>
                        <span className="font-medium text-ink">
                          {user.full_name}
                          {user.id === profile.id && <span className="ml-1.5 text-[12px] font-normal text-muted">(you)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{user.email}</td>
                    <td className="px-5 py-3">
                      <RoleSelect userId={user.id} name={user.full_name} role={user.role} isSelf={user.id === profile.id} />
                    </td>
                    <td className="px-5 py-3 font-mono text-[12.5px] text-ink-soft">{formatDate(user.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
