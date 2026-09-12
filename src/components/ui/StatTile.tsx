import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

export function StatTile({ label, value, icon: Icon, href }: { label: string; value: number; icon: LucideIcon; href?: string }) {
  const body = (
    <div className="flex items-start justify-between rounded-card border border-line bg-card px-5 py-[18px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-line-strong">
      <div>
        <div className="text-[13px] text-muted">{label}</div>
        <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-ink">{value.toLocaleString('en-GB')}</div>
      </div>
      <div className="grid h-[42px] w-[42px] place-items-center rounded-[10px] border border-line text-muted">
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
