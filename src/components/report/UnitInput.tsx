import type { ComponentProps } from 'react';
import { inputClass } from '@/components/ui/Field';

/** A number input with its unit shown inside on the right. */
export function UnitInput({ unit, className = '', ...rest }: ComponentProps<'input'> & { unit: string }) {
  return (
    <div className="relative">
      <input inputMode="decimal" className={`${inputClass} pr-11 font-mono tabular ${className}`} {...rest} />
      <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-[12px] text-muted">
        {unit}
      </span>
    </div>
  );
}
