import { formatDate, formatMonth } from '@/lib/format';
import { addDays, monthTicks, schedulePosition, scheduleWindow, weightStatusLabel, type WeightStatus } from '@/lib/records';
import type { WeightSet, WeightState } from '@/lib/types';

const BAR: Record<WeightState, string> = {
  in_date: 'fill-green-light',
  due_soon: 'fill-amber',
  overdue: 'fill-red',
};
const TEXT: Record<WeightState, string> = {
  in_date: 'fill-green-ink',
  due_soon: 'fill-amber-ink',
  overdue: 'fill-red',
};

const WIDTH = 1080;
const LABEL_WIDTH = 150;
const RIGHT_ROOM = 160;
const TOP = 34;
const ROW = 40;
const BOTTOM = 30;

export function CheckScheduleLegend() {
  const swatch = (className: string, label: string) => (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-[3px] ${className}`} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-muted">
      {swatch('bg-green-light', 'In date')}
      {swatch('bg-amber', 'Due within 30 days')}
      {swatch('bg-red', 'Overdue')}
      <span className="flex items-center gap-1.5">
        <span className="h-3 border-l border-dashed border-ink" />
        Today
      </span>
    </div>
  );
}

/** Each set's bar runs from its last check to its next one, with today marked. */
export function CheckSchedule({ rows, today }: { rows: ReadonlyArray<{ set: WeightSet; status: WeightStatus }>; today: string }) {
  const window = scheduleWindow(
    rows.map((r) => r.set),
    today,
  );
  const chartWidth = WIDTH - LABEL_WIDTH - RIGHT_ROOM;
  const x = (date: string) => LABEL_WIDTH + schedulePosition(date, window) * chartWidth;
  const height = TOP + rows.length * ROW + BOTTOM;
  const todayX = x(today);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="block w-full min-w-[760px]"
        role="img"
        aria-label={`Check schedule for ${rows.length} weight sets. The table above lists the same dates.`}
      >
        {monthTicks(window).map((tick) => (
          <g key={tick}>
            <line x1={x(tick)} x2={x(tick)} y1={TOP - 10} y2={height - BOTTOM} className="stroke-line" />
            <text x={x(tick)} y={14} textAnchor="middle" fontSize={11} className="fill-muted">
              {formatMonth(tick)}
            </text>
          </g>
        ))}

        {rows.map(({ set, status }, i) => {
          const y = TOP + i * ROW;
          const from = set.last_checked ?? addDays(set.next_check, -365);
          const x1 = x(from);
          const x2 = Math.max(x(set.next_check), x1 + 4);
          const note =
            status.state === 'overdue'
              ? `Overdue since ${formatDate(set.next_check)}`
              : status.state === 'due_soon'
                ? `Due ${formatDate(set.next_check)}`
                : null;
          return (
            <g key={set.id}>
              <text x={0} y={y + 13} fontSize={12} fontWeight={600} className="fill-ink font-mono">
                {set.code}
              </text>
              <text x={0} y={y + 28} fontSize={11} className={TEXT[status.state]}>
                {weightStatusLabel(status)}
              </text>
              <rect x={x1} y={y + 6} width={x2 - x1} height={14} rx={4} className={BAR[status.state]}>
                <title>
                  {`${set.code} · last checked ${formatDate(set.last_checked)} · next check ${formatDate(set.next_check)}`}
                </title>
              </rect>
              {note && (
                <text x={x2 + 8} y={y + 17} fontSize={11} fontWeight={500} className={TEXT[status.state]}>
                  {note}
                </text>
              )}
            </g>
          );
        })}

        <line x1={todayX} x2={todayX} y1={TOP - 10} y2={height - BOTTOM + 4} strokeDasharray="4 4" className="stroke-ink" />
        <text x={todayX} y={height - 8} textAnchor="middle" fontSize={11} fontWeight={600} className="fill-ink">
          Today · {formatDate(today)}
        </text>
      </svg>
    </div>
  );
}
