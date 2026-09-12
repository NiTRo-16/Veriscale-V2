import { niceCeiling } from '@/lib/dashboard';

export interface BarGroup {
  label: string;
  values: [number, number];
}

export interface BarSeries {
  label: string;
  color: string;
}

const W = 480;
const H = 180;
const PAD = { left: 30, right: 8, top: 14, bottom: 26 };
const BAR = 18;

function barPath(x: number, top: number, bottom: number) {
  const r = Math.min(4, bottom - top);
  return `M${x} ${bottom}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + BAR - r}Q${x + BAR} ${top} ${x + BAR} ${top + r}V${bottom}Z`;
}

/** Two series side by side per group, with a 2px gap between the pair. */
export function GroupedBars({ groups, series, title }: { groups: BarGroup[]; series: [BarSeries, BarSeries]; title: string }) {
  const max = niceCeiling(Math.max(0, ...groups.flatMap((g) => g.values)));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const baseline = PAD.top + plotH;
  const band = plotW / Math.max(1, groups.length);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const lastIndex = groups.length - 1;

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
        {groups.map((g, i) => {
          const center = PAD.left + band * (i + 0.5);
          return (
            <g key={g.label}>
              {g.values.map((value, s) =>
                value > 0 ? (
                  <path key={s} d={barPath(s === 0 ? center - BAR - 1 : center + 1, y(value), baseline)} fill={series[s].color} />
                ) : null,
              )}
              {i === lastIndex && g.values[1] > 0 && (
                <text x={center + 1 + BAR / 2} y={y(g.values[1]) - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#15171c">
                  {g.values[1]}
                </text>
              )}
              <text x={center} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#6b7079">
                {g.label}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">{series[0].label}</th>
            <th scope="col">{series[1].label}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.label}>
              <th scope="row">{g.label}</th>
              <td>{g.values[0]}</td>
              <td>{g.values[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
