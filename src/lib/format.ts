// Display formatting. Months are spelled out by hand so output never depends
// on the runtime's locale data (newer ICU prints "Sept" for en-GB).
const DASH = '—';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || 'UTC';

type DateLike = string | Date | null | undefined;

function toDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function partsOf(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { year: get('year'), month: Number(get('month')), day: Number(get('day')), hour: get('hour'), minute: get('minute') };
}

const isDateOnly = (value: DateLike) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** "11 Sep 2026" */
export function formatDate(value: DateLike, timeZone = TIME_ZONE): string {
  const date = toDate(value);
  if (!date) return DASH;
  const p = partsOf(date, isDateOnly(value) ? 'UTC' : timeZone);
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
}

/** "Sep 2026" */
export function formatMonth(value: DateLike, timeZone = TIME_ZONE): string {
  const date = toDate(value);
  if (!date) return DASH;
  const p = partsOf(date, isDateOnly(value) ? 'UTC' : timeZone);
  return `${MONTHS[p.month - 1]} ${p.year}`;
}

/** "11 Sep 2026, 16:05" */
export function formatDateTime(value: DateLike, timeZone = TIME_ZONE): string {
  const date = toDate(value);
  if (!date) return DASH;
  const p = partsOf(date, timeZone);
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}, ${p.hour}:${p.minute}`;
}

/** Signed error in grams: "+20.0 g", "-3.0 g", "0.0 g" */
export function formatGrams(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : rounded < 0 ? '-' : '';
  return `${sign}${Math.abs(rounded).toFixed(1)} g`;
}

/** Allowed error: "± 25.0 g" */
export function formatAllowed(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return `± ${value.toFixed(1)} g`;
}

/** Mass in kg with three decimals: "10.000" */
export function formatKg(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return value.toFixed(3);
}

/** Whole numbers with thousands separators: "2,000" */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString('en-GB');
}

/** "1 model", "2,000 models" */
export function formatPlural(value: number, singular: string, plural = `${singular}s`): string {
  return `${formatCount(value)} ${Math.round(value) === 1 ? singular : plural}`;
}

/** 0.22 → "0.22 kg", 1500 → "1,500 kg" */
export function formatAmount(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('en-GB', { maximumFractionDigits: 4 })} ${unit}`;
}

/** "Kavya Rao" → "KR" */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Only allow returning to a path inside this app after sign-in. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string') return '/dashboard';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/dashboard';
  if (value === '/sign-in' || value.startsWith('/sign-in?')) return '/dashboard';
  return value;
}
