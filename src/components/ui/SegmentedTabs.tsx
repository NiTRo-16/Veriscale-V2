import Link from 'next/link';

export interface SegmentedTab {
  label: string;
  value: string;
  count?: number;
}

/** Link-based segmented control that drives a `?tab=` query param. */
export function SegmentedTabs({
  tabs,
  active,
  basePath,
  paramName = 'tab',
}: {
  tabs: SegmentedTab[];
  active: string;
  basePath: string;
  paramName?: string;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-[10px] bg-hover p-[3px]">
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        const href = tab.value === tabs[0].value ? basePath : `${basePath}?${paramName}=${tab.value}`;
        return (
          <Link
            key={tab.value}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex h-[30px] items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium transition-colors ${
              isActive ? 'bg-card text-ink shadow-[0_1px_2px_rgba(16,24,40,0.08)]' : 'text-muted hover:text-ink'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <b className={`text-[11.5px] font-semibold ${isActive ? 'text-green-ink' : 'text-faint'}`}>{tab.count}</b>
            )}
          </Link>
        );
      })}
    </div>
  );
}
