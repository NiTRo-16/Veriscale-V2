// Every word the interface uses for statuses, results, sources, roles and
// photo kinds. Keep the wording plain — no technical terms (see the design
// spec, §3).
import type {
  AccuracyClass,
  ConditionSource,
  Decision,
  LiveResult,
  PhotoKind,
  ReportStatus,
  Role,
  TestStage,
  WeightClass,
  WeightState,
} from './types';

export const STATUS_LABEL: Record<ReportStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  failed: 'Failed',
};

export const RESULT_LABEL: Record<LiveResult, string> = {
  pass: 'Pass',
  fail: 'Fail',
  incomplete: 'Incomplete',
};

export const DECISION_LABEL: Record<Decision, string> = {
  approved: 'Approved',
  failed: 'Failed',
  sent_back: 'Sent back',
};

export const SOURCE_LABEL: Record<ConditionSource, string> = {
  sensor: 'Sensor',
  manual: 'Typed in',
  weather: 'Weather',
};

export const ROLE_LABEL: Record<Role, string> = {
  technician: 'Lab technician',
  reviewer: 'Reviewer',
  admin: 'Admin',
};

export const PHOTO_KIND_LABEL: Record<PhotoKind, string> = {
  nameplate: 'Nameplate',
  display: 'Display reading',
  setup: 'Test setup',
  seals: 'Seals',
  other: 'Other',
};

export const TEST_STAGE_LABEL: Record<TestStage, string> = {
  initial: 'Initial verification',
  in_service: 'In-service inspection',
};

export const TEST_TYPES: ReadonlyArray<{ name: string; clause: string }> = [
  { name: 'Weighing accuracy', clause: 'A.4.4' },
  { name: 'Eccentricity', clause: '3.6.2' },
  { name: 'Repeatability', clause: '3.6.1' },
  { name: 'Discrimination', clause: '3.8.2' },
  { name: 'Tare weighing', clause: '4.6' },
];

export const ACCURACY_CLASS_OPTIONS: ReadonlyArray<{ value: AccuracyClass; label: string }> = [
  { value: 'I', label: 'I — Special' },
  { value: 'II', label: 'II — High' },
  { value: 'III', label: 'III — Medium' },
  { value: 'IIII', label: 'IIII — Ordinary' },
];

/** What a reviewer checks by eye before deciding. Stored on the report by key. */
export const REVIEW_CHECKS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'nameplate', label: 'Nameplate photo matches the model and serial number' },
  { key: 'display', label: 'Display photo matches the readings' },
  { key: 'seals', label: 'Seals are in place in the seals photo' },
];

export const INDICATOR_TYPES =['Digital', 'Analog', 'Hybrid'] as const;
export const POWER_SOURCES = ['Mains AC', 'Battery', 'Mains + battery backup'] as const;

/** Classes of reference weight sets, most accurate first. */
export const WEIGHT_CLASSES: ReadonlyArray<WeightClass> = ['E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3'];

export const WEIGHT_STATE_LABEL: Record<WeightState, string> = {
  in_date: 'In date',
  due_soon: 'Due soon',
  overdue: 'Overdue',
};

export const RISK_LABEL: Record<'low' | 'medium' | 'high', string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
};
