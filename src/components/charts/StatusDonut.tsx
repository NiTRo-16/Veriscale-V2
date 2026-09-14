export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

const R = 52;
const CX = 70;
const CY = 70;
const STROKE = 16;
const CIRCUMFERENCE = 2 * Math.PI * R;
const GAP = 3;

/** Full-circle donut for a part-to-whole at a glance (report status mix), with a legend carrying the exact counts. */
export function StatusDonut({ segments, totalLabel, title }: { segments: DonutSegment[]; totalLabel: string; title: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);

  let offset = 0;
  const arcs = visible.map((s, i) => {
    const length = (s.value / total) * CIRCUMFERENCE;
    const dash = visible.length > 1 ? Math.max(0, length - GAP) : length;
    const element = (
      <circle
        key={s.label}
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke={s.color}
        strokeWidth={STROKE}
        strokeDasharray={`${dash.toFixed(2)} ${CIRCUMFERENCE - dash + 20}`}
        strokeDashoffset={(-offset).toFixed(2)}
        transform={`rotate(-90 ${CX} ${CY})`}
      />
    );
    offset += length;
    return element;
  });

  return (
    <figure className="m-0 flex flex-col gap-3">
      <div className="relative mx-auto h-[140px] w-[140px]">
        <svg viewBox="0 0 140 140" className="h-full w-full" role="img" aria-label={title}>
          {total === 0 ? (
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#eef0f2" strokeWidth={STROKE} />
          ) : (
            arcs
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-semibold leading-none tracking-tight text-ink">{total}</span>
          <span className="mt-1 text-[11px] text-muted">{totalLabel}</span>
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
