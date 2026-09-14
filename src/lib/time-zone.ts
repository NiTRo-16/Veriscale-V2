// The lab's time zone for dates shown in the app, from NEXT_PUBLIC_TIME_ZONE.

const FALLBACK = 'UTC';

/**
 * A time zone the runtime accepts. Values pasted into hosting dashboards often
 * carry spaces, line breaks or quotes, and an invalid zone makes Intl throw on
 * every date, so clean the value up and fall back to UTC instead of crashing.
 */
export function resolveTimeZone(value: string | undefined): string {
  const zone = (value ?? '').trim().replace(/^(['"])(.*)\1$/, '$2').trim();
  if (!zone) return FALLBACK;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone });
    return zone;
  } catch {
    return FALLBACK;
  }
}

// Read literally so Next.js can inline it for the browser.
export const LAB_TIME_ZONE = resolveTimeZone(process.env.NEXT_PUBLIC_TIME_ZONE);
