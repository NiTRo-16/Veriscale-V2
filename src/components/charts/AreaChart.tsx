'use client';

import { useId, useState } from 'react';
import { niceCeiling } from '@/lib/dashboard';

export interface AreaPoint {
  label: string;
  value: number;
  tooltipTitle: string;
  tooltipValue: string;
}

const W = 700;
const H = 210;
const PAD = { left: 34, right: 16, top: 18, bottom: 30 };

/** Single-series area chart with a hover crosshair and tooltip. */
export function AreaChart({ points, title, color = '#1f9d55' }: { points: AreaPoint[]; title: string; color?: string }) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) return null;

  const max = niceCeiling(Math.max(...points.map((p) => p.value)));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const baseline = PAD.top + plotH;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i * plotW) / (points.length - 1));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const coords = points.map((p, i) => `${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`);
  const last = points.length - 1;
  const band = points.length === 1 ? plotW : plotW / (points.length - 1);

  const tip = active === null ? null : points[active];
  const tipX = active === null ? 0 : x(active) + 172 > W ? x(active) - 172 : x(active) + 12;
  const tipY = active === null ? 0 : Math.max(4, Math.min(y(points[active].value) - 24, baseline - 50));

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title} onMouseLeave={() => setActive(null)}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.16" />
            <stop offset="1" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, max / 2, max].map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#dde1e5' : '#eef0f2'} />
            <text x={PAD.left - 10} y={y(tick) + 3.5} textAnchor="end" fontSize="10.5" fill="#6b7079">
              {tick}
            </text>
          </g>
        ))}

        <path d={`M${x(0)} ${baseline} L${coords.join(' L')} L${x(last)} ${baseline} Z`} fill={`url(#${gradientId})`} />
        <polyline
          points={coords.join(' ').replace(/(\d) (\d)/g, '$1,$2')}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p, i) => (
          <text key={p.label} x={x(i)} y={H - 8} textAnchor={i === last ? 'end' : i === 0 ? 'start' : 'middle'} fontSize="10.5" fill="#6b7079">
            {p.label}
          </text>
        ))}

        {active === null && (
          <g>
            <circle cx={x(last)} cy={y(points[last].value)} r="4" fill={color} stroke="#fff" strokeWidth="2" />
            <text x={x(last)} y={y(points[last].value) - 10} textAnchor="end" fontSize="11" fontWeight="600" fill="#15171c">
              {points[last].value}
            </text>
          </g>
        )}

        {tip && active !== null && (
          <g pointerEvents="none">
            <line x1={x(active)} x2={x(active)} y1={y(tip.value)} y2={baseline} stroke="#c9cdd2" />
            <circle cx={x(active)} cy={y(tip.value)} r="5" fill={color} stroke="#fff" strokeWidth="2" />
            <rect x={tipX} y={tipY} width="160" height="46" rx="8" fill="#111317" />
            <text x={tipX + 12} y={tipY + 18} fontSize="10.5" fill="#a9aeb6">
              {tip.tooltipTitle}
            </text>
            <text x={tipX + 12} y={tipY + 35} fontSize="12" fontWeight="600" fill="#fff">
              {tip.tooltipValue}
            </text>
          </g>
        )}

        {points.map((p, i) => (
          <rect
            key={`hit-${p.label}`}
            x={x(i) - band / 2}
            y={PAD.top}
            width={band}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
          />
        ))}
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.tooltipTitle}</th>
              <td>{p.tooltipValue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
