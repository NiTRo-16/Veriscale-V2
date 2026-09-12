import type { ComponentProps, ReactNode } from 'react';

export const inputClass =
  'h-10 w-full rounded-lg border border-line-strong bg-card px-3 text-[13px] text-ink placeholder:text-faint focus:border-green focus:outline-none disabled:bg-page disabled:text-muted';

export function Field({
  label,
  htmlFor,
  hint,
  error,
  extra,
  children,
  className = '',
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[12px] font-medium text-ink-soft">
          {label}
        </label>
        {extra}
      </div>
      {children}
      {error ? (
        <p className="text-[12px] text-red">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className = '', ...rest }: ComponentProps<'input'>) {
  return <input className={`${inputClass} ${className}`} {...rest} />;
}

export function Select({ className = '', ...rest }: ComponentProps<'select'>) {
  return <select className={`${inputClass} pr-8 ${className}`} {...rest} />;
}

export function Textarea({ className = '', ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={`${inputClass} h-auto min-h-[84px] py-2.5 ${className}`} {...rest} />;
}
