import { beforeAll, describe, expect, it } from 'vitest';
import { createDb, errorOf, forcePending, seedDraft, seedReading, seedUser, type Db } from './harness';

let db: Db;
let tech: string;
const year = new Date().getFullYear();

beforeAll(async () => {
  db = await createDb();
  tech = await seedUser(db, 'technician');
});

describe('allowed-error rules seed', () => {
  it('seeds the 12 OIML R 76 bands with open-ended top bands', async () => {
    const { rows } = await db.query<{ id: string; max_n: string | null }>(
      'select id, max_n from public.allowed_error_rules order by id',
    );
    expect(rows).toHaveLength(12);
    expect(rows.filter((r) => r.max_n === null).map((r) => r.id).sort()).toEqual(['I-3', 'II-3', 'III-3', 'IIII-3']);
  });
});

describe('report numbers', () => {
  it('are assigned in sequence as VS-YYYY-NNN', async () => {
    const fresh = await createDb();
    const owner = await seedUser(fresh, 'technician');
    const first = await seedDraft(fresh, owner);
    const second = await seedDraft(fresh, owner);
    expect(first.report_no).toBe(`VS-${year}-001`);
    expect(second.report_no).toBe(`VS-${year}-002`);
  });

  it('stay unique across many drafts and ignore any supplied number', async () => {
    const numbers = new Set<string>();
    for (let i = 0; i < 20; i++) numbers.add((await seedDraft(db, tech, { report_no: 'VS-1999-001' })).report_no);
    expect(numbers.size).toBe(20);
    for (const n of numbers) expect(n).toMatch(new RegExp(`^VS-${year}-\\d{3,}$`));
  });

  it('grow past three digits without truncating', async () => {
    const fresh = await createDb();
    const owner = await seedUser(fresh, 'technician');
    await fresh.query('insert into public.report_counters (year, last_number) values ($1, 999)', [year]);
    expect((await seedDraft(fresh, owner)).report_no).toBe(`VS-${year}-1000`);
  });

  it('cannot be changed afterwards', async () => {
    const { id } = await seedDraft(db, tech);
    expect(await errorOf(db.query(`update public.reports set report_no = 'VS-2000-999' where id = $1`, [id]))).toMatch(
      'READ_ONLY_FIELD',
    );
  });
});

describe('status changes', () => {
  it('allow draft → pending → approved', async () => {
    const reviewer = await seedUser(db, 'reviewer');
    const { id } = await seedDraft(db, tech);
    await forcePending(db, id);
    await db.query(
      `update public.reports set status = 'approved', reviewed_by = $2, reviewed_at = now() where id = $1`,
      [id, reviewer],
    );
    const { rows } = await db.query<{ status: string }>('select status from public.reports where id = $1', [id]);
    expect(rows[0].status).toBe('approved');
  });

  it('reject skipping review (draft → approved)', async () => {
    const { id } = await seedDraft(db, tech);
    expect(await errorOf(db.query(`update public.reports set status = 'approved' where id = $1`, [id]))).toMatch(
      'BAD_STATUS_CHANGE',
    );
  });

  it('reject going backwards (pending → draft)', async () => {
    const { id } = await seedDraft(db, tech);
    await forcePending(db, id);
    expect(await errorOf(db.query(`update public.reports set status = 'draft' where id = $1`, [id]))).toMatch(
      'BAD_STATUS_CHANGE',
    );
  });

  it('require complete details before leaving draft', async () => {
    const { id } = await seedDraft(db, tech, { model: null });
    expect(await errorOf(forcePending(db, id))).toMatch('submitted_reports_complete');
  });
});

describe('locking after submit', () => {
  it('rejects content changes on a pending report', async () => {
    const { id } = await seedDraft(db, tech);
    await forcePending(db, id);
    expect(await errorOf(db.query(`update public.reports set model = 'Changed' where id = $1`, [id]))).toMatch(
      'REPORT_LOCKED',
    );
    expect(
      await errorOf(db.query(`update public.reports set calculated_result = 'fail' where id = $1`, [id])),
    ).toMatch('REPORT_LOCKED');
  });

  it('rejects review changes once a decision is final', async () => {
    const reviewer = await seedUser(db, 'reviewer');
    const { id } = await seedDraft(db, tech);
    await forcePending(db, id);
    await db.query(
      `update public.reports set status = 'failed', reviewed_by = $2, reviewed_at = now(), review_note = 'Seal broken' where id = $1`,
      [id, reviewer],
    );
    expect(await errorOf(db.query(`update public.reports set review_note = 'Edited' where id = $1`, [id]))).toMatch(
      'REPORT_LOCKED',
    );
  });

  it('rejects adding, changing or removing readings on a pending report', async () => {
    const { id } = await seedDraft(db, tech);
    const readingId = await seedReading(db, id);
    await forcePending(db, id);
    expect(await errorOf(seedReading(db, id, 1))).toMatch('REPORT_LOCKED');
    expect(
      await errorOf(db.query('update public.readings set indicated_kg = 11 where id = $1', [readingId])),
    ).toMatch('REPORT_LOCKED');
    expect(await errorOf(db.query('delete from public.readings where id = $1', [readingId]))).toMatch('REPORT_LOCKED');
  });

  it('rejects adding photos to a pending report', async () => {
    const { id } = await seedDraft(db, tech);
    await forcePending(db, id);
    expect(
      await errorOf(
        db.query(
          `insert into public.photos (report_id, kind, storage_path, uploaded_by) values ($1, 'nameplate', $2, $3)`,
          [id, `${id}/a.jpg`, tech],
        ),
      ),
    ).toMatch('REPORT_LOCKED');
  });

  it('keeps drafts fully editable', async () => {
    const { id } = await seedDraft(db, tech);
    const readingId = await seedReading(db, id);
    await db.query(`update public.reports set model = 'TW-200' where id = $1`, [id]);
    await db.query('update public.readings set indicated_kg = 10.01 where id = $1', [readingId]);
    const { rows } = await db.query<{ model: string }>('select model from public.reports where id = $1', [id]);
    expect(rows[0].model).toBe('TW-200');
  });
});

describe('deleting', () => {
  it('only allows deleting drafts', async () => {
    const { id } = await seedDraft(db, tech);
    await forcePending(db, id);
    expect(await errorOf(db.query('delete from public.reports where id = $1', [id]))).toMatch('DRAFTS_ONLY');
  });

  it('removes a draft together with its readings and photos', async () => {
    const { id } = await seedDraft(db, tech);
    const readingId = await seedReading(db, id);
    await db.query(
      `insert into public.photos (report_id, reading_id, kind, storage_path, uploaded_by) values ($1, $2, 'display', $3, $4)`,
      [id, readingId, `${id}/b.jpg`, tech],
    );
    await db.query('delete from public.reports where id = $1', [id]);
    const readings = await db.query('select 1 from public.readings where report_id = $1', [id]);
    const photos = await db.query('select 1 from public.photos where report_id = $1', [id]);
    expect(readings.rows).toHaveLength(0);
    expect(photos.rows).toHaveLength(0);
  });
});

describe('value checks', () => {
  it('rejects a non-positive capacity or interval', async () => {
    expect(await errorOf(seedDraft(db, tech, { max_capacity_kg: 0 }))).toMatch('check constraint');
    expect(await errorOf(seedDraft(db, tech, { interval_e_g: -5 }))).toMatch('check constraint');
  });

  it('keeps updated_at current', async () => {
    const { id } = await seedDraft(db, tech);
    const before = await db.query<{ updated_at: Date }>('select updated_at from public.reports where id = $1', [id]);
    await new Promise((r) => setTimeout(r, 15));
    await db.query(`update public.reports set remarks = 'Checked level' where id = $1`, [id]);
    const after = await db.query<{ updated_at: Date }>('select updated_at from public.reports where id = $1', [id]);
    expect(new Date(after.rows[0].updated_at).getTime()).toBeGreaterThan(new Date(before.rows[0].updated_at).getTime());
  });
});
