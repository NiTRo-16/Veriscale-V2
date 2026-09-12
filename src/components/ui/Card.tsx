import type { ReactNode } from 'react';

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClassName = 'p-5',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`print-plain rounded-card border border-line bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[14px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="no-print flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
