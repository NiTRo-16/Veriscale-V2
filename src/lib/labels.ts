// Every word the interface uses for statuses, results, sources, roles and
// photo kinds. Keep the wording plain — no technical terms (see the design
// spec, §3).
import type {
  AccuracyClass,
  ConditionSource,
  LiveResult,
  PhotoKind,
  ReportStatus,
  Role,
  TestStage,
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

export const INDICATOR_TYPES = ['Digital', 'Analog', 'Hybrid'] as const;
export const POWER_SOURCES = ['Mains AC', 'Battery', 'Mains + battery backup'] as const;
