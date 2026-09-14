import Link from 'next/link';
import type { ComponentProps } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'green';
type Size = 'md' | 'sm';

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<Variant, string> = {
  primary: 'rounded-full bg-black text-white hover:bg-black/85',
  secondary: 'rounded-lg border border-line-strong bg-card text-ink hover:bg-hover',
  danger: 'rounded-lg border border-red/30 bg-card text-red hover:bg-red-soft',
  ghost: 'rounded-lg text-muted hover:bg-hover hover:text-ink',
  green: 'rounded-lg bg-green font-semibold text-white hover:bg-green-ink',
};

const SIZES: Record<Size, string> = {
  md: 'h-9 px-4 text-[13px]',
  sm: 'h-8 px-3 text-[12.5px]',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
