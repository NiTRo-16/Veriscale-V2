import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  href,
  iconClassName = 'border-line text-muted',
}: {
  label: string;
  value: number | string;
  sub?: ReactNode;
  icon: LucideIcon;
  href?: string;
  iconClassName?: string;
}) {
  const body = (
    <div className="flex items-start justify-between rounded-card border border-line bg-card px-5 py-[18px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-line-strong">
      <div>
        <div className="text-[13px] text-muted">{label}</div>
        <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-ink">
          {typeof value === 'number' ? value.toLocaleString('en-GB') : value}
        </div>
        {sub && <div className="mt-2 text-[12px] text-muted">{sub}</div>}
      </div>
      <div className={`grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[10px] border ${iconClassName}`}>
        <Icon size={20} strokeWidth={1.6} />
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-card">
      {body}
    </Link>
  ) : (
    body
  );
}
