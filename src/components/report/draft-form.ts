// Editor state for a draft: every input is kept as the text the user typed,
// so half-typed numbers like "10." survive until they are valid.
import type {
  AccuracyClass,
  ConditionSource,
  InstrumentModel,
  Manufacturer,
  ReadingRow,
  ReportRow,
  TestStage,
  WeightSet,
} from '@/lib/types';

export interface DraftForm {
  manufacturer: string;
  model: string;
  serial_number: string;
  accuracy_class: AccuracyClass | '';
  max_capacity_kg: string;
  interval_e_g: string;
  indicator_type: string;
  power_source: string;
  test_stage: TestStage;
  test_date: string;
  temperature_c: string;
  temperature_source: ConditionSource | null;
  humidity_pct: string;
  humidity_source: ConditionSource | null;
  voltage_v: string;
  weather_confirmed: boolean;
  reference_weights: string;
  remarks: string;
  /** Picked records; '' when typed in by hand. */
  manufacturer_id: string;
  model_id: string;
  weight_set_id: string;
}

export interface ReadingDraftRow {
  id: string;
  test_type: string;
  clause: string | null;
  load_kg: string;
  reference_kg: string;
  indicated_kg: string;
}

export type SetField = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => void;
export type PatchForm = (patch: Partial<DraftForm>) => void;

/** Records a technician can pick from while filling in a draft. */
export interface DraftRecords {
  manufacturers: Manufacturer[];
  models: InstrumentModel[];
  weightSets: WeightSet[];
}

/** Select value for "Other (type it in)". */
export const OTHER_OPTION = '__other__';

const text = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v));

export function reportToForm(r: ReportRow): DraftForm {
  return {
    manufacturer: text(r.manufacturer),
    model: text(r.model),
    serial_number: text(r.serial_number),
    accuracy_class: r.accuracy_class ?? '',
    max_capacity_kg: text(r.max_capacity_kg),
    interval_e_g: text(r.interval_e_g),
    indicator_type: text(r.indicator_type),
    power_source: text(r.power_source),
    test_stage: r.test_stage,
    test_date: text(r.test_date),
    temperature_c: text(r.temperature_c),
    temperature_source: r.temperature_source,
    humidity_pct: text(r.humidity_pct),
    humidity_source: r.humidity_source,
    voltage_v: text(r.voltage_v),
    weather_confirmed: r.weather_confirmed,
    reference_weights: text(r.reference_weights),
    remarks: text(r.remarks),
    manufacturer_id: text(r.manufacturer_id),
    model_id: text(r.model_id),
    weight_set_id: text(r.weight_set_id),
  };
}

export function readingsToDrafts(rows: ReadingRow[]): ReadingDraftRow[] {
  return rows.map((r) => ({
    id: r.id,
    test_type: r.test_type,
    clause: r.clause,
    load_kg: text(r.load_kg),
    reference_kg: text(r.reference_kg),
    indicated_kg: text(r.indicated_kg),
  }));
}
