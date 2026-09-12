export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

const R = 110;
const CX = 168;
const CY = 140;
const LENGTH = Math.PI * R;
const GAP = 4;

/** Half-donut for a part-to-whole at a glance, with a legend carrying the exact counts. */
export function HalfDonut({ segments, totalLabel, title }: { segments: DonutSegment[]; totalLabel: string; title: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const arc = `M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  const visible = segments.filter((s) => s.value > 0);

  let offset = 0;
  const arcs = visible.map((s, i) => {
    const length = (s.value / total) * LENGTH;
    const dash = i < visible.length - 1 ? Math.max(0, length - GAP) : length;
    const element = (
      <path
        key={s.label}
        d={arc}
        fill="none"
        stroke={s.color}
        strokeWidth="16"
        strokeDasharray={`${dash.toFixed(2)} ${LENGTH + 20}`}
        strokeDashoffset={(-offset).toFixed(2)}
      />
    );
    offset += length;
    return element;
  });

  return (
    <figure className="m-0 flex flex-col gap-3">
      <div className="relative mx-auto w-full max-w-[336px]">
        <svg viewBox="0 0 336 160" className="h-auto w-full" role="img" aria-label={title}>
          {total === 0 ? <path d={arc} fill="none" stroke="#eef0f2" strokeWidth="16" /> : arcs}
        </svg>
        <div className="absolute inset-x-0 top-[52%] flex flex-col items-center">
          <span className="text-[12px] text-muted">{totalLabel}</span>
          <span className="mt-1 text-[28px] font-semibold leading-none tracking-tight text-ink">{total}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-[12px] text-muted">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
            {s.label}
            <span className="ml-auto font-semibold text-ink">{s.value}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {segments.map((s) => (
            <tr key={s.label}>
              <th scope="row">{s.label}</th>
              <td>{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
