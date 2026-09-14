import type { WaitingBucket } from '@/lib/dashboard';

/** Horizontal bars for how long pending reports have waited. The last bucket is past the target. */
export function WaitingBars({ buckets }: { buckets: WaitingBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <ul className="flex flex-col gap-2.5" aria-label="Pending reports by how long they have waited">
      {buckets.map((bucket, i) => {
        const late = i === buckets.length - 1;
        return (
          <li key={bucket.label} className="grid grid-cols-[64px_1fr_28px] items-center gap-3 text-[12.5px]">
            <span className="text-ink-soft">{bucket.label}</span>
            <span className="h-3.5 overflow-hidden rounded bg-hover">
              <span
                className={`block h-full rounded ${late ? 'bg-amber' : 'bg-green'}`}
                style={{ width: `${(bucket.count / max) * 100}%` }}
              />
            </span>
            <span className="text-right font-mono tabular text-ink">{bucket.count}</span>
          </li>
        );
      })}
    </ul>
  );
}
