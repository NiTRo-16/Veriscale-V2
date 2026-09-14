import { niceCeiling } from '@/lib/dashboard';

export interface DecidedWeek {
  label: string;
  count: number;
}

const W = 480;
const H = 180;
const PAD = { left: 30, right: 8, top: 14, bottom: 26 };
const BAR = 18;
const PAST = '#6dbe8c';
const CURRENT = '#1f9d55';

/** Reports decided per week: light green for past weeks, dark green for the current week. */
export function DecidedBars({ weeks, title }: { weeks: DecidedWeek[]; title: string }) {
  const max = niceCeiling(Math.max(0, ...weeks.map((w) => w.count)));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const baseline = PAD.top + plotH;
  const band = plotW / Math.max(1, weeks.length);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const lastIndex = weeks.length - 1;

  const barPath = (x: number, top: number, bottom: number) => {
    const r = Math.min(4, bottom - top);
    return `M${x} ${bottom}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + BAR - r}Q${x + BAR} ${top} ${x + BAR} ${top + r}V${bottom}Z`;
  };

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
        {[0, max / 2, max].map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#dde1e5' : '#eef0f2'} />
            <text x={PAD.left - 8} y={y(tick) + 3.5} textAnchor="end" fontSize="10.5" fill="#6b7079">
              {tick}
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const center = PAD.left + band * (i + 0.5);
          const color = i === lastIndex ? CURRENT : PAST;
          return (
            <g key={w.label}>
              {w.count > 0 && <path d={barPath(center - BAR / 2, y(w.count), baseline)} fill={color} />}
              {i === lastIndex && w.count > 0 && (
                <text x={center} y={y(w.count) - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#15171c">
                  {w.count}
                </text>
              )}
              <text x={center} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#6b7079">
                {w.label}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.label}>
              <th scope="row">{w.label}</th>
              <td>{w.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
