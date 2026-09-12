'use client';

import { FileText, LayoutDashboard, LogOut, PenLine, Scale, ScrollText, SlidersHorizontal, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import { signOut } from '@/app/(app)/sign-out/actions';
import { initials } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/labels';
import type { Profile } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  match: (path: string) => boolean;
}

const OVERVIEW: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: (p) => p === '/dashboard' },
  { href: '/reports', label: 'Reports', icon: FileText, match: (p) => p.startsWith('/reports') },
];

const ADMIN: NavItem[] = [
  { href: '/admin/rules', label: 'Rules', icon: SlidersHorizontal, match: (p) => p.startsWith('/admin/rules') },
  { href: '/admin/users', label: 'Users', icon: Users, match: (p) => p.startsWith('/admin/users') },
  { href: '/admin/activity', label: 'Activity log', icon: ScrollText, match: (p) => p.startsWith('/admin/activity') },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex h-[38px] items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors ${
        active ? 'bg-hover font-semibold text-ink' : 'text-ink-soft hover:bg-hover/70 hover:text-ink'
      }`}
    >
      <Icon size={18} strokeWidth={1.6} />
      {item.label}
    </Link>
  );
}

export function Sidebar({ profile, pendingCount }: { profile: Profile; pendingCount: number }) {
  const pathname = usePathname();
  const canReview = profile.role === 'reviewer' || profile.role === 'admin';

  return (
    <aside className="no-print sticky top-0 flex h-screen w-[248px] shrink-0 flex-col border-r border-line bg-sidebar px-3 py-4">
      <div className="flex items-center gap-2.5 px-1.5 pb-3.5">
        <div className="grid h-[38px] w-[38px] place-items-center rounded-[10px] bg-black text-white">
          <Scale size={20} strokeWidth={1.6} />
        </div>
        <div>
          <div className="text-[14px] font-semibold leading-tight text-ink">VeriScale</div>
          <div className="text-[11px] text-muted">NAWI test reports</div>
        </div>
      </div>

      {canReview && (
        <>
          <Link
            href="/reports?status=pending"
            className="flex h-[38px] items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-ink-soft hover:bg-hover/70 hover:text-ink"
          >
            <PenLine size={18} strokeWidth={1.6} />
            Pending review
            {pendingCount > 0 && (
              <span className="ml-auto grid h-[22px] min-w-6 place-items-center rounded-full bg-[#d94f24] px-1.5 text-[11px] font-semibold text-white">
                {pendingCount}
              </span>
            )}
          </Link>
          <div className="mx-1.5 my-2.5 h-px bg-line" />
        </>
      )}

      <nav className="flex flex-col gap-0.5" aria-label="Main">
        <div className="px-2.5 pb-1.5 pt-2 text-[11px] font-medium text-faint">Overview</div>
        {OVERVIEW.map((item) => (
          <NavLink key={item.href} item={item} active={item.match(pathname)} />
        ))}
        {profile.role === 'admin' && (
          <>
            <div className="px-2.5 pb-1.5 pt-4 text-[11px] font-medium text-faint">Administration</div>
            {ADMIN.map((item) => (
              <NavLink key={item.href} item={item} active={item.match(pathname)} />
            ))}
          </>
        )}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 rounded-xl border border-line bg-card p-2.5">
        <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-green-soft text-[12px] font-semibold text-green-ink">
          {initials(profile.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-ink">{profile.full_name}</div>
          <div className="text-[11.5px] text-muted">{ROLE_LABEL[profile.role]}</div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            title="Sign out"
            aria-label="Sign out"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-ink"
          >
            <LogOut size={16} strokeWidth={1.6} />
          </button>
        </form>
      </div>
    </aside>
  );
}
