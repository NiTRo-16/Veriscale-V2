import { beforeAll, describe, expect, it } from 'vitest';
import { asAnon, asService, asUser, createDb, errorOf, forcePending, seedDraft, seedReading, seedUser, type Db } from './harness';

let db: Db;
let tech: string;
let reviewer: string;
let admin: string;

beforeAll(async () => {
  db = await createDb();
  tech = await seedUser(db, 'technician', 'Arjun Mehta');
  reviewer = await seedUser(db, 'reviewer', 'Kavya Rao');
  admin = await seedUser(db, 'admin', 'Priya Nair');
});

const idOf = async (query: Promise<{ rows: Array<{ id: string }> }>) => (await query).rows[0].id;

const saveManufacturer = (id: string | null, name: string, actor: string) =>
  idOf(asService(db, (tx) => tx.query<{ id: string }>('select public.save_manufacturer($1, $2, $3) as id', [id, name, actor])));

const saveModel = (
  id: string | null,
  manufacturerId: string,
  name: string,
  actor: string,
  values: { cls?: string; capacity?: number; interval?: number } = {},
) =>
  idOf(
    asService(db, (tx) =>
      tx.query<{ id: string }>('select public.save_instrument_model($1, $2, $3, $4, $5, $6, $7) as id', [
        id,
        manufacturerId,
        name,
        values.cls ?? 'III',
        values.capacity ?? 150,
        values.interval ?? 50,
        actor,
      ]),
    ),
  );

const saveWeightSet = (
  id: string | null,
  code: string,
  actor: string,
  dates: { last?: string | null; next: string },
  weightClass = 'F2',
) =>
  idOf(
    asService(db, (tx) =>
      tx.query<{ id: string }>('select public.save_weight_set($1, $2, $3, $4, $5, $6, $7, $8, $9) as id', [
        id,
        code,
        'Stainless steel set',
        weightClass,
        '1 mg – 20 kg',
        'CERT-1',
        dates.last ?? null,
        dates.next,
        actor,
      ]),
    ),
  );

const lastActivity = async () =>
  (await db.query<{ message: string; actor_name: string }>('select message, actor_name from public.activity_log order by id desc limit 1'))
    .rows[0];

describe('who can see and change records', () => {
  it('every signed-in user can read all three lists', async () => {
    for (const table of ['manufacturers', 'instrument_models', 'weight_sets']) {
      await expect(asUser(db, tech, (tx) => tx.query(`select * from public.${table}`))).resolves.toBeDefined();
    }
  });

  it('signed-out visitors cannot read them', async () => {
    for (const table of ['manufacturers', 'instrument_models', 'weight_sets']) {
      expect(await errorOf(asAnon(db, (tx) => tx.query(`select * from public.${table}`)))).toMatch('permission denied');
    }
  });

  it('nobody changes records directly, only through the functions', async () => {
    expect(
      await errorOf(asUser(db, reviewer, (tx) => tx.query(`insert into public.manufacturers (name) values ('Direct')`))),
    ).toMatch('permission denied');
    expect(
      await errorOf(asUser(db, admin, (tx) => tx.query('select public.save_manufacturer(null, $1, $2)', ['Direct', admin]))),
    ).toMatch('permission denied');
  });
});

describe('save_manufacturer', () => {
  it('lets a reviewer add one and records it in the activity log', async () => {
    const id = await saveManufacturer(null, '  Acme Weighing Systems ', reviewer);
    const { rows } = await db.query<{ name: string; created_by: string }>(
      'select name, created_by from public.manufacturers where id = $1',
      [id],
    );
    expect(rows[0]).toEqual({ name: 'Acme Weighing Systems', created_by: reviewer });
    expect(await lastActivity()).toEqual({ message: 'Added manufacturer Acme Weighing Systems', actor_name: 'Kavya Rao' });
  });

  it('lets an admin rename one', async () => {
    const id = await saveManufacturer(null, 'Metro Scales', reviewer);
    await saveManufacturer(id, 'Metro Scales Ltd', admin);
    expect(await lastActivity()).toEqual({ message: 'Renamed manufacturer Metro Scales to Metro Scales Ltd', actor_name: 'Priya Nair' });
    // Saving the same name again is fine.
    await expect(saveManufacturer(id, 'Metro Scales Ltd', admin)).resolves.toBe(id);
  });

  it('refuses technicians', async () => {
    expect(await errorOf(saveManufacturer(null, 'Tech Co', tech))).toMatch('NOT_ALLOWED');
  });

  it('refuses a name already in use, ignoring case and spaces', async () => {
    expect(await errorOf(saveManufacturer(null, ' acme weighing systems', reviewer))).toMatch('NAME_TAKEN');
  });

  it('refuses a blank name and an unknown record', async () => {
    expect(await errorOf(saveManufacturer(null, '   ', reviewer))).toMatch('BAD_VALUE');
    expect(await errorOf(saveManufacturer('00000000-0000-0000-0000-000000000000', 'Ghost', reviewer))).toMatch(
      'RECORD_NOT_FOUND',
    );
  });
});

describe('save_instrument_model', () => {
  let maker: string;
  let other: string;

  beforeAll(async () => {
    maker = await saveManufacturer(null, 'Model Maker', reviewer);
    other = await saveManufacturer(null, 'Other Maker', reviewer);
  });

  it('adds a model with its details', async () => {
    const id = await saveModel(null, maker, 'TW-150', admin, { cls: 'II', capacity: 150, interval: 5 });
    const { rows } = await db.query<{ accuracy_class: string; max_capacity_kg: string; interval_e_g: string }>(
      'select accuracy_class, max_capacity_kg, interval_e_g from public.instrument_models where id = $1',
      [id],
    );
    expect(rows[0]).toEqual({ accuracy_class: 'II', max_capacity_kg: '150', interval_e_g: '5' });
    expect(await lastActivity()).toEqual({ message: 'Added instrument model Model Maker TW-150', actor_name: 'Priya Nair' });
  });

  it('allows the same model name under a different manufacturer only', async () => {
    expect(await errorOf(saveModel(null, maker, 'tw-150', reviewer))).toMatch('NAME_TAKEN');
    await expect(saveModel(null, other, 'TW-150', reviewer)).resolves.toBeTruthy();
  });

  it('updates a model', async () => {
    const id = await saveModel(null, maker, 'BX-30', reviewer);
    await saveModel(id, maker, 'BX-30', reviewer, { capacity: 30, interval: 10 });
    const { rows } = await db.query<{ max_capacity_kg: string }>('select max_capacity_kg from public.instrument_models where id = $1', [id]);
    expect(rows[0].max_capacity_kg).toBe('30');
    expect(await lastActivity()).toEqual({ message: 'Updated instrument model Model Maker BX-30', actor_name: 'Kavya Rao' });
  });

  it('refuses bad values, unknown manufacturers and technicians', async () => {
    expect(await errorOf(saveModel(null, maker, 'Bad class', reviewer, { cls: 'V' }))).toMatch('BAD_VALUE');
    expect(await errorOf(saveModel(null, maker, 'No capacity', reviewer, { capacity: 0 }))).toMatch('BAD_VALUE');
    expect(await errorOf(saveModel(null, '00000000-0000-0000-0000-000000000000', 'Lost', reviewer))).toMatch('RECORD_NOT_FOUND');
    expect(await errorOf(saveModel(null, maker, 'Tech model', tech))).toMatch('NOT_ALLOWED');
  });
});

describe('save_weight_set', () => {
  it('adds and updates a weight set', async () => {
    const id = await saveWeightSet(null, 'WS-01', reviewer, { last: '2025-09-01', next: '2026-09-01' });
    expect(await lastActivity()).toEqual({ message: 'Added weight set WS-01', actor_name: 'Kavya Rao' });
    await saveWeightSet(id, 'WS-01', admin, { last: '2026-09-01', next: '2027-09-01' });
    const { rows } = await db.query<{ next_check: Date; certificate_no: string }>(
      'select next_check, certificate_no from public.weight_sets where id = $1',
      [id],
    );
    expect(rows[0].certificate_no).toBe('CERT-1');
    expect(rows[0].next_check.toISOString().slice(0, 10)).toBe('2027-09-01');
    expect(await lastActivity()).toEqual({ message: 'Updated weight set WS-01', actor_name: 'Priya Nair' });
  });

  it('refuses a code already in use', async () => {
    expect(await errorOf(saveWeightSet(null, 'ws-01', reviewer, { next: '2027-01-01' }))).toMatch('NAME_TAKEN');
  });

  it('refuses a next check that is not after the last check, and an unknown class', async () => {
    expect(await errorOf(saveWeightSet(null, 'WS-02', reviewer, { last: '2026-09-01', next: '2026-09-01' }))).toMatch('BAD_VALUE');
    expect(await errorOf(saveWeightSet(null, 'WS-03', reviewer, { next: '2027-01-01' }, 'X9'))).toMatch('BAD_VALUE');
  });

  it('refuses technicians', async () => {
    expect(await errorOf(saveWeightSet(null, 'WS-T', tech, { next: '2027-01-01' }))).toMatch('NOT_ALLOWED');
  });
});

describe('reports that use records', () => {
  let maker: string;
  let model: string;
  let inDate: string;
  let overdue: string;

  beforeAll(async () => {
    maker = await saveManufacturer(null, 'Report Maker', reviewer);
    model = await saveModel(null, maker, 'RM-60', reviewer);
    inDate = await saveWeightSet(null, 'WS-IN', reviewer, { last: '2026-01-01', next: '2027-01-01' });
    overdue = await saveWeightSet(null, 'WS-LATE', reviewer, { last: '2025-09-01', next: '2026-09-01' });
  });

  const submit = (reportId: string, readingId: string) =>
    asService(db, (tx) =>
      tx.query<{ report_no: string }>('select public.submit_report($1, $2, $3::jsonb, $4) as report_no', [
        reportId,
        tech,
        JSON.stringify([{ id: readingId, error_g: 20, allowed_error_g: 25, result: 'pass' }]),
        'pass',
      ]),
    );

  it('lets a technician pick records on their own draft', async () => {
    const draft = await seedDraft(db, tech);
    const res = await asUser(db, tech, (tx) =>
      tx.query('update public.reports set manufacturer_id = $1, model_id = $2, weight_set_id = $3 where id = $4', [
        maker,
        model,
        inDate,
        draft.id,
      ]),
    );
    expect(res.affectedRows).toBe(1);
  });

  it('blocks submitting with a weight set that was overdue on the test date', async () => {
    const draft = await seedDraft(db, tech, { weight_set_id: overdue, test_date: '2026-09-10' });
    const reading = await seedReading(db, draft.id);
    expect(await errorOf(submit(draft.id, reading))).toMatch('WEIGHTS_OVERDUE');
  });

  it('submits with a weight set that was in date', async () => {
    const draft = await seedDraft(db, tech, { weight_set_id: inDate, test_date: '2026-09-10' });
    const reading = await seedReading(db, draft.id);
    const { rows } = await submit(draft.id, reading);
    expect(rows[0].report_no).toBe(draft.report_no);
  });

  it('allows a test dated on or before the next check day', async () => {
    const draft = await seedDraft(db, tech, { weight_set_id: overdue, test_date: '2026-09-01' });
    const reading = await seedReading(db, draft.id);
    await expect(submit(draft.id, reading)).resolves.toBeDefined();
  });

  it('locks the picked records once submitted', async () => {
    const draft = await seedDraft(db, tech, { weight_set_id: inDate, model_id: model });
    await forcePending(db, draft.id);
    expect(await errorOf(db.query('update public.reports set weight_set_id = null where id = $1', [draft.id]))).toMatch(
      'REPORT_LOCKED',
    );
    expect(await errorOf(db.query('update public.reports set model_id = null where id = $1', [draft.id]))).toMatch('REPORT_LOCKED');
  });

  it('keeps records that reports point at from being deleted', async () => {
    expect(await errorOf(db.query('delete from public.weight_sets where id = $1', [inDate]))).toMatch('foreign key');
  });
});
