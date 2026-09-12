export type Role = 'technician' | 'reviewer' | 'admin';
export type ReportStatus = 'draft' | 'pending' | 'approved' | 'failed';
export type AccuracyClass = 'I' | 'II' | 'III' | 'IIII';
export type TestStage = 'initial' | 'in_service';
export type ConditionSource = 'sensor' | 'manual' | 'weather';
export type PhotoKind = 'nameplate' | 'display' | 'setup' | 'seals' | 'other';
export type StoredResult = 'pass' | 'fail';
export type LiveResult = StoredResult | 'incomplete';
export type NumberLike = number | string | null | undefined;

export interface AllowedErrorRule {
  id: string;
  accuracy_class: AccuracyClass;
  min_n: number;
  /** null = no upper limit */
  max_n: number | null;
  multiplier: number;
}

export interface ReadingInput {
  load_kg: NumberLike;
  reference_kg: NumberLike;
  indicated_kg: NumberLike;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
}

export interface ReportRow {
  id: string;
  report_no: string;
  status: ReportStatus;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  accuracy_class: AccuracyClass | null;
  max_capacity_kg: number | null;
  interval_e_g: number | null;
  indicator_type: string | null;
  power_source: string | null;
  test_stage: TestStage;
  test_date: string | null;
  temperature_c: number | null;
  temperature_source: ConditionSource | null;
  humidity_pct: number | null;
  humidity_source: ConditionSource | null;
  voltage_v: number | null;
  weather_confirmed: boolean;
  reference_weights: string | null;
  remarks: string | null;
  calculated_result: StoredResult | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

/** Report columns a technician may change on their own draft. */
export const EDITABLE_REPORT_FIELDS = [
  'manufacturer',
  'model',
  'serial_number',
  'accuracy_class',
  'max_capacity_kg',
  'interval_e_g',
  'indicator_type',
  'power_source',
  'test_stage',
  'test_date',
  'temperature_c',
  'temperature_source',
  'humidity_pct',
  'humidity_source',
  'voltage_v',
  'weather_confirmed',
  'reference_weights',
  'remarks',
] as const;

export type EditableReportField = (typeof EDITABLE_REPORT_FIELDS)[number];
export type EditableReportFields = Pick<ReportRow, EditableReportField>;

export interface ReadingRow {
  id: string;
  report_id: string;
  test_type: string;
  clause: string | null;
  load_kg: number | null;
  reference_kg: number | null;
  indicated_kg: number | null;
  position: number;
  error_g: number | null;
  allowed_error_g: number | null;
  result: StoredResult | null;
}

export interface PhotoRow {
  id: string;
  report_id: string;
  reading_id: string | null;
  kind: PhotoKind;
  storage_path: string;
  taken_at: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

export interface ActivityRow {
  id: number;
  actor_id: string | null;
  actor_name: string;
  actor_role: Role;
  message: string;
  report_no: string | null;
  created_at: string;
}
