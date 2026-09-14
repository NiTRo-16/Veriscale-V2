import { initials } from '@/lib/format';

/** Round initials badge for a person. */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-green-soft font-semibold text-green-ink"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.39) }}
    >
      {initials(name)}
    </span>
  );
}
