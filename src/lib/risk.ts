// Risk checks: plain-worded flags that tell a reviewer where a submitted report
// needs a closer look. Pure functions; reading the photos happens in
// photo-reading.ts and the checks are saved by risk-checks.ts.
import { formatDate, formatPlural } from './format';
import { PHOTO_KIND_LABEL } from './labels';
import { daysBetween, todayDate } from './records';
import type { AccuracyClass, ConditionSource, PhotoKind } from './types';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskFlag {
  /** Stable name for the kind of flag, e.g. "display_mismatch". */
  code: string;
  severity: RiskLevel;
  title: string;
  detail: string;
}

/** Whether the photos were read automatically: off when no AI key is set up. */
export type PhotoReadingStatus = 'done' | 'off' | 'failed' | 'not_run';

/** The saved result of a report's risk checks. */
export interface ReportCheck {
  report_id: string;
  risk: RiskLevel;
  flags: RiskFlag[];
  photo_reading: PhotoReadingStatus;
  checked_at: string;
}

const RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

/** A report is as risky as its most serious flag. */
export function riskLevel(flags: readonly RiskFlag[]): RiskLevel {
  return flags.reduce<RiskLevel>((level, flag) => (RANK[flag.severity] > RANK[level] ? flag.severity : level), 'low');
}

export function sortFlags(flags: readonly RiskFlag[]): RiskFlag[] {
  return [...flags].sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// ---- Rules on the report's own data ----

type RuleReading = { test_type: string; load_kg: number | null; reference_kg: number | null; indicated_kg: number | null };

export interface RuleInput {
  report: {
    created_at: string;
    submitted_at: string | null;
    test_date: string | null;
    temperature_c: number | null;
    temperature_source: ConditionSource | null;
    humidity_pct: number | null;
    humidity_source: ConditionSource | null;
  };
  readings: RuleReading[];
  photos: Array<{ kind: PhotoKind; taken_at: string | null }>;
  /** Other submitted reports for the same serial number, with their readings. */
  earlier: Array<{ report_no: string; readings: RuleReading[] }>;
  /** The same technician's previous submitted report. */
  previousByTechnician: { report_no: string; temperature_c: number | null; humidity_pct: number | null } | null;
  timeZone: string;
}

/** Sent sooner than this after the draft was started, with several readings, looks too quick for a real test. */
const QUICK_SUBMIT_MINUTES = 10;
const MIN_READINGS_TO_COMPARE = 3;
const MIN_ZERO_ERROR_READINGS = 4;
/** Photos may be taken the day before or after the test date (late-night tests, time zones). */
const PHOTO_DAYS_ALLOWED = 1;

function quickSubmit({ report, readings, photos }: RuleInput): RiskFlag | null {
  if (!report.submitted_at || readings.length < MIN_READINGS_TO_COMPARE) return null;
  const minutes = Math.floor((Date.parse(report.submitted_at) - Date.parse(report.created_at)) / 60_000);
  if (!Number.isFinite(minutes) || minutes >= QUICK_SUBMIT_MINUTES) return null;
  return {
    code: 'quick_submit',
    severity: 'medium',
    title: 'Report was filled in very quickly',
    detail: `${formatPlural(readings.length, 'reading')} and ${formatPlural(photos.length, 'photo')} were recorded within ${formatPlural(Math.max(minutes, 0), 'minute')} of starting the report. Check the photos show a real test.`,
  };
}

function photoTimes({ photos, report, timeZone }: RuleInput): RiskFlag | null {
  if (photos.length === 0) return null;
  const timed = photos.filter((p): p is { kind: PhotoKind; taken_at: string } => Boolean(p.taken_at) && !Number.isNaN(Date.parse(p.taken_at as string)));
  if (timed.length === 0) {
    return {
      code: 'photo_times_missing',
      severity: 'medium',
      title: 'Photos have no time taken',
      detail: 'None of the photos record when they were taken. They may have been edited, forwarded or saved from somewhere else.',
    };
  }
  if (!report.test_date) return null;
  const testDate = report.test_date;
  const far = timed.filter((p) => Math.abs(daysBetween(todayDate(new Date(p.taken_at), timeZone), testDate)) > PHOTO_DAYS_ALLOWED);
  if (far.length === 0) return null;
  const days = [...new Set(far.map((p) => formatDate(p.taken_at, timeZone)))];
  return {
    code: 'photo_time_far',
    severity: 'medium',
    title: 'Photos taken on a different day',
    detail: `${far.length === 1 ? '1 photo was' : `${far.length} photos were`} taken on ${days.join(', ')}, but the test date is ${formatDate(testDate)}.`,
  };
}

const sameReadings = (a: readonly RuleReading[], b: readonly RuleReading[]) =>
  a.length === b.length &&
  a.every((r, i) => r.test_type === b[i].test_type && r.load_kg === b[i].load_kg && r.indicated_kg === b[i].indicated_kg);

function copiedReadings({ readings, earlier }: RuleInput): RiskFlag | null {
  if (readings.length < MIN_READINGS_TO_COMPARE) return null;
  const match = earlier.find((e) => sameReadings(readings, e.readings));
  if (!match) return null;
  return {
    code: 'copied_readings',
    severity: 'high',
    title: 'Readings match an earlier report',
    detail: `Every reading is exactly the same as in ${match.report_no} for this instrument.`,
  };
}

/** Error in grams, rounded to the milligram so floating-point noise never counts. */
const errorG = (r: RuleReading) =>
  r.reference_kg === null || r.indicated_kg === null ? null : Math.round((r.indicated_kg - r.reference_kg) * 1e6) / 1e3;

function zeroErrors({ readings }: RuleInput): RiskFlag | null {
  if (readings.length < MIN_ZERO_ERROR_READINGS) return null;
  if (!readings.every((r) => errorG(r) === 0)) return null;
  return {
    code: 'zero_errors',
    severity: 'medium',
    title: 'Every reading shows exactly zero error',
    detail: `All ${readings.length} readings match their reference weights exactly. Real instruments usually show small differences, so compare them with the display photo.`,
  };
}

function sameConditions({ report, previousByTechnician: previous }: RuleInput): RiskFlag | null {
  if (!previous || report.temperature_c === null || report.humidity_pct === null) return null;
  if (report.temperature_source === 'sensor' && report.humidity_source === 'sensor') return null;
  if (previous.temperature_c !== report.temperature_c || previous.humidity_pct !== report.humidity_pct) return null;
  return {
    code: 'same_conditions',
    severity: 'medium',
    title: 'Same conditions as the last report',
    detail: `${report.temperature_c} °C and ${report.humidity_pct} % were also recorded in ${previous.report_no} by the same technician, and were not read from the sensor.`,
  };
}

/** Flags that need only the report's own data and its history. */
export function ruleFlags(input: RuleInput): RiskFlag[] {
  return [quickSubmit(input), photoTimes(input), copiedReadings(input), zeroErrors(input), sameConditions(input)].filter(
    (f): f is RiskFlag => f !== null,
  );
}

// ---- Photos ----

export type MassUnit = 't' | 'kg' | 'g' | 'mg';
const MASS_UNITS: readonly MassUnit[] = ['t', 'kg', 'g', 'mg'];
const KG_PER: Record<MassUnit, number> = { t: 1000, kg: 1, g: 0.001, mg: 0.000001 };
const ACCURACY_CLASSES: readonly AccuracyClass[] = ['I', 'II', 'III', 'IIII'];

export interface Amount {
  value: number;
  unit: MassUnit;
}

export interface DisplayRead {
  readable: boolean;
  value: number | null;
  unit: 'kg' | 'g' | null;
}

export interface NameplateRead {
  readable: boolean;
  serial_number: string | null;
  model: string | null;
  max_capacity: Amount | null;
  interval_e: Amount | null;
  accuracy_class: AccuracyClass | null;
}

const UNREADABLE_DISPLAY: DisplayRead = { readable: false, value: null, unit: null };
const UNREADABLE_NAMEPLATE: NameplateRead = {
  readable: false,
  serial_number: null,
  model: null,
  max_capacity: null,
  interval_e: null,
  accuracy_class: null,
};

/** Checks the photo reader's answer for a display photo; anything malformed counts as unreadable. */
export function parseDisplayRead(value: unknown): DisplayRead {
  if (!isRecord(value) || value.readable !== true) return { ...UNREADABLE_DISPLAY };
  if (typeof value.value !== 'number' || !Number.isFinite(value.value)) return { ...UNREADABLE_DISPLAY };
  if (value.unit !== 'kg' && value.unit !== 'g') return { ...UNREADABLE_DISPLAY };
  return { readable: true, value: value.value, unit: value.unit };
}

const cleanText = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null);

function cleanAmount(v: unknown): Amount | null {
  if (!isRecord(v) || typeof v.value !== 'number' || !Number.isFinite(v.value) || v.value <= 0) return null;
  return (MASS_UNITS as readonly unknown[]).includes(v.unit) ? { value: v.value, unit: v.unit as MassUnit } : null;
}

/** Checks the photo reader's answer for a nameplate photo, keeping only well-formed fields. */
export function parseNameplateRead(value: unknown): NameplateRead {
  if (!isRecord(value) || value.readable !== true) return { ...UNREADABLE_NAMEPLATE };
  return {
    readable: true,
    serial_number: cleanText(value.serial_number),
    model: cleanText(value.model),
    max_capacity: cleanAmount(value.max_capacity),
    interval_e: cleanAmount(value.interval_e),
    accuracy_class: (ACCURACY_CLASSES as readonly unknown[]).includes(value.accuracy_class)
      ? (value.accuracy_class as AccuracyClass)
      : null,
  };
}

/** Values closer than half a milligram count as the same reading. */
const SAME_KG = 5e-7;

export function compareDisplay(reading: { index: number; indicated_kg: number | null }, read: DisplayRead): RiskFlag | null {
  const label = `reading ${reading.index + 1}`;
  if (!read.readable || read.value === null || read.unit === null) {
    return {
      code: 'display_unreadable',
      severity: 'low',
      title: 'Display photo could not be read',
      detail: `The value on the display photo for ${label} could not be read automatically. Check it by eye.`,
    };
  }
  if (reading.indicated_kg === null) return null;
  if (Math.abs(read.value * KG_PER[read.unit] - reading.indicated_kg) < SAME_KG) return null;
  return {
    code: 'display_mismatch',
    severity: 'high',
    title: "Display photo doesn't match the reading",
    detail: `The display photo shows ${read.value} ${read.unit}, but ${label} was typed as ${reading.indicated_kg} kg.`,
  };
}

const compact = (text: string) => text.replace(/[^a-z0-9]/gi, '').toUpperCase();
const closeTo = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(b), 1e-9) * 1e-6;

export function compareNameplate(
  report: {
    serial_number: string | null;
    model: string | null;
    max_capacity_kg: number | null;
    interval_e_g: number | null;
    accuracy_class: AccuracyClass | null;
  },
  read: NameplateRead,
): RiskFlag[] {
  if (!read.readable) {
    return [
      {
        code: 'nameplate_unreadable',
        severity: 'low',
        title: 'Nameplate photo could not be read',
        detail: 'The nameplate details could not be read automatically. Check the model and serial number by eye.',
      },
    ];
  }

  const flags: RiskFlag[] = [];
  if (read.serial_number && report.serial_number && compact(read.serial_number) !== compact(report.serial_number)) {
    flags.push({
      code: 'nameplate_serial',
      severity: 'high',
      title: 'Serial number on the nameplate is different',
      detail: `The nameplate photo shows serial number ${read.serial_number}, but the report says ${report.serial_number}.`,
    });
  }

  const differences: string[] = [];
  if (read.model && report.model) {
    const [photo, typed] = [compact(read.model), compact(report.model)];
    if (photo && typed && !photo.includes(typed) && !typed.includes(photo)) {
      differences.push(`model ${read.model} on the photo, ${report.model} in the report`);
    }
  }
  if (read.max_capacity && report.max_capacity_kg !== null) {
    if (!closeTo(read.max_capacity.value * KG_PER[read.max_capacity.unit], report.max_capacity_kg)) {
      differences.push(`Max ${read.max_capacity.value} ${read.max_capacity.unit} on the photo, ${report.max_capacity_kg} kg in the report`);
    }
  }
  if (read.interval_e && report.interval_e_g !== null) {
    if (!closeTo(read.interval_e.value * KG_PER[read.interval_e.unit] * 1000, report.interval_e_g)) {
      differences.push(`e ${read.interval_e.value} ${read.interval_e.unit} on the photo, ${report.interval_e_g} g in the report`);
    }
  }
  if (read.accuracy_class && report.accuracy_class && read.accuracy_class !== report.accuracy_class) {
    differences.push(`class ${read.accuracy_class} on the photo, class ${report.accuracy_class} in the report`);
  }
  if (differences.length > 0) {
    flags.push({
      code: 'nameplate_details',
      severity: 'medium',
      title: 'Nameplate details are different',
      detail: `${capitalize(differences.join('; '))}.`,
    });
  }
  return flags;
}

/** Photos whose exact file is also attached to another report. */
export function duplicatePhotoFlags(matches: ReadonlyArray<{ kind: PhotoKind; report_no: string }>): RiskFlag[] {
  if (matches.length === 0) return [];
  const parts = matches.map((m) => `the ${PHOTO_KIND_LABEL[m.kind].toLowerCase()} photo is also in ${m.report_no}`);
  return [
    {
      code: 'duplicate_photo',
      severity: 'high',
      title: 'Same photo used in another report',
      detail: `${capitalize(parts.join('; '))}.`,
    },
  ];
}
