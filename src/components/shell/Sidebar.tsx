'use client';

import {
  CircleCheck,
  Factory,
  FileDown,
  FileText,
  LayoutDashboard,
  LogOut,
  PenLine,
  ScrollText,
  SlidersHorizontal,
  Scale,
  Users,
  Weight,
} from 'lucide-react';
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

const DASHBOARD: NavItem = { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: (p) => p === '/dashboard' };
const REPORTS: NavItem = { href: '/reports', label: 'Test reports', icon: FileText, match: (p) => p.startsWith('/reports') };
const CERTIFICATES: NavItem = {
  href: '/certificates',
  label: 'Certificates',
  icon: FileDown,
  match: (p) => p.startsWith('/certificates'),
};

const REVIEW: NavItem[] = [
  { href: '/review', label: 'Review queue', icon: PenLine, match: (p) => p.startsWith('/review') && !p.startsWith('/review/decisions') },
  { href: '/review/decisions', label: 'My decisions', icon: CircleCheck, match: (p) => p.startsWith('/review/decisions') },
];

const RECORDS: NavItem[] = [
  { href: '/records/manufacturers', label: 'Manufacturers', icon: Factory, match: (p) => p.startsWith('/records/manufacturers') },
  { href: '/records/models', label: 'Instrument models', icon: Scale, match: (p) => p.startsWith('/records/models') },
  { href: '/records/weights', label: 'Reference weights', icon: Weight, match: (p) => p.startsWith('/records/weights') },
];

const ADMIN: NavItem[] = [
  { href: '/admin/rules', label: 'Rules', icon: SlidersHorizontal, match: (p) => p.startsWith('/admin/rules') },
  { href: '/admin/users', label: 'Users', icon: Users, match: (p) => p.startsWith('/admin/users') },
  { href: '/admin/activity', label: 'Activity log', icon: ScrollText, match: (p) => p.startsWith('/admin/activity') },
];

function SectionLabel({ children }: { children: string }) {
  return <div className="px-2.5 pb-1.5 pt-3.5 text-[11px] font-medium text-faint first:pt-2">{children}</div>;
}

function NavLink({ item, active, trailing }: { item: NavItem; active: boolean; trailing?: React.ReactNode }) {
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
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {trailing}
    </Link>
  );
}

export function Sidebar({
  profile,
  allCount,
  pendingCount,
  dueWeights = 0,
}: {
  profile: Profile;
  allCount: number;
  pendingCount: number;
  dueWeights?: number;
}) {
  const pathname = usePathname();
  const canReview = profile.role === 'reviewer' || profile.role === 'admin';
  const canSeeRecords = profile.role !== 'technician';

  return (
    <aside className="no-print sticky top-0 flex h-screen w-[248px] shrink-0 flex-col overflow-y-auto border-r border-line bg-sidebar px-3 py-4">
      <div className="flex items-center gap-2.5 px-1.5 pb-3.5">
        <div className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-black text-white">
          <Scale size={20} strokeWidth={1.6} />
        </div>
        <div>
          <div className="text-[14px] font-semibold leading-tight text-ink">VeriScale</div>
          <div className="text-[11px] text-muted">NAWI test reports</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5" aria-label="Main">
        <SectionLabel>Overview</SectionLabel>
        <NavLink item={DASHBOARD} active={DASHBOARD.match(pathname)} />
        <NavLink
          item={REPORTS}
          active={REPORTS.match(pathname)}
          trailing={<span className="ml-auto text-[12px] font-medium text-faint">{allCount}</span>}
        />
        {!canSeeRecords && <NavLink item={CERTIFICATES} active={CERTIFICATES.match(pathname)} />}

        {canReview && (
          <>
            <SectionLabel>Review desk</SectionLabel>
            <NavLink
              item={REVIEW[0]}
              active={REVIEW[0].match(pathname)}
              trailing={
                pendingCount > 0 ? (
                  <span className="ml-auto grid h-[22px] min-w-6 place-items-center rounded-full bg-[#d94f24] px-1.5 text-[11px] font-semibold text-white">
                    {pendingCount}
                  </span>
                ) : undefined
              }
            />
            <NavLink item={REVIEW[1]} active={REVIEW[1].match(pathname)} />
            <NavLink item={CERTIFICATES} active={CERTIFICATES.match(pathname)} />
          </>
        )}

        {canSeeRecords && (
          <>
            <SectionLabel>Records</SectionLabel>
            <NavLink item={RECORDS[0]} active={RECORDS[0].match(pathname)} />
            <NavLink item={RECORDS[1]} active={RECORDS[1].match(pathname)} />
            <NavLink
              item={RECORDS[2]}
              active={RECORDS[2].match(pathname)}
              trailing={
                dueWeights > 0 ? (
                  <span className="ml-auto grid h-5 place-items-center rounded-full bg-amber-soft px-1.5 text-[11px] font-semibold text-amber-ink">
                    {dueWeights} due
                  </span>
                ) : undefined
              }
            />
          </>
        )}

        {profile.role === 'admin' && (
          <>
            <SectionLabel>Administration</SectionLabel>
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
