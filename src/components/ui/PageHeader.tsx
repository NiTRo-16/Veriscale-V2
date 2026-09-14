import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';

export interface Crumb {
  label: string;
  href?: string;
}

/** The white bar at the top of each page: breadcrumb and/or title on the left, actions on the right. */
export function PageHeader({
  crumbs,
  title,
  subtitle,
  actions,
}: {
  crumbs?: Crumb[];
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="no-print sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-line bg-card px-6">
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px]">
            {crumbs.map((crumb, i) => {
              const last = i === crumbs.length - 1;
              return (
                <Fragment key={`${crumb.label}-${i}`}>
                  {i > 0 && <span className="text-line-strong">/</span>}
                  {crumb.href && !last ? (
                    <Link href={crumb.href} className="truncate text-muted hover:text-ink">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={`truncate ${last ? 'font-semibold text-ink' : 'text-muted'}`}>{crumb.label}</span>
                  )}
                </Fragment>
              );
            })}
          </nav>
        )}
        {title && (
          <div className="truncate text-[18px] font-semibold tracking-[-0.01em] text-ink">
            {title}
            {subtitle && <span className="ml-2 text-[13px] font-normal text-muted">{subtitle}</span>}
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PageBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto flex w-full max-w-[1200px] flex-col gap-4 p-6 ${className}`}>{children}</div>;
}
