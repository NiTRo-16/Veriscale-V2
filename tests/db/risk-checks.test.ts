import { beforeAll, describe, expect, it } from 'vitest';
import { asService, asUser, createDb, errorOf, forcePending, seedDraft, seedReading, seedUser, type Db } from './harness';

let db: Db;
let tech: string;
let reviewer: string;
let admin: string;
let pendingId: string;

async function seedPhoto(reportId: string, uploadedBy: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.photos (report_id, kind, storage_path, uploaded_by)
     values ($1, 'display', $2, $3) returning id`,
    [reportId, `${reportId}/${crypto.randomUUID()}.jpg`, uploadedBy],
  );
  return rows[0].id;
}

async function seedChecks(reportId: string, photoId: string) {
  await db.query(
    `insert into public.report_checks (report_id, risk, flags, photo_reading)
     values ($1, 'high', '[{"code":"display_mismatch","severity":"high","title":"t","detail":"d"}]', 'done')`,
    [reportId],
  );
  await db.query(`insert into public.photo_fingerprints (photo_id, report_id, fingerprint) values ($1, $2, 'abc123')`, [
    photoId,
    reportId,
  ]);
}

beforeAll(async () => {
  db = await createDb();
  tech = await seedUser(db, 'technician');
  reviewer = await seedUser(db, 'reviewer');
  admin = await seedUser(db, 'admin');
  pendingId = (await seedDraft(db, tech)).id;
  await seedReading(db, pendingId);
  const photoId = await seedPhoto(pendingId, tech);
  await forcePending(db, pendingId);
  await seedChecks(pendingId, photoId);
});

describe('risk checks: who can see them', () => {
  it('reviewers and admins can read them', async () => {
    for (const user of [reviewer, admin]) {
      const { rows } = await asUser(db, user, (tx) => tx.query('select report_id, risk from public.report_checks'));
      expect(rows).toEqual([{ report_id: pendingId, risk: 'high' }]);
    }
  });

  it('technicians cannot see them', async () => {
    const { rows } = await asUser(db, tech, (tx) => tx.query('select report_id from public.report_checks'));
    expect(rows).toEqual([]);
  });

  it('no signed-in user can write them', async () => {
    const message = await errorOf(
      asUser(db, admin, (tx) =>
        tx.query(`update public.report_checks set risk = 'low' where report_id = $1`, [pendingId]),
      ),
    );
    expect(message).toMatch(/permission denied/);
  });

  it('photo fingerprints are hidden from every signed-in user', async () => {
    const message = await errorOf(asUser(db, admin, (tx) => tx.query('select * from public.photo_fingerprints')));
    expect(message).toMatch(/permission denied/);
  });

  it('the server can save checks for a submitted report', async () => {
    await asService(db, (tx) =>
      tx.query(
        `insert into public.report_checks (report_id, risk, flags, photo_reading) values ($1, 'medium', '[]', 'off')
         on conflict (report_id) do update set risk = excluded.risk, photo_reading = excluded.photo_reading`,
        [pendingId],
      ),
    );
    const { rows } = await db.query<{ risk: string }>('select risk from public.report_checks where report_id = $1', [pendingId]);
    expect(rows[0].risk).toBe('medium');
  });
});

describe('risk checks: stored values', () => {
  it('only accepts low, medium or high risk', async () => {
    const message = await errorOf(
      db.query(`update public.report_checks set risk = 'extreme' where report_id = $1`, [pendingId]),
    );
    expect(message).toMatch(/check/);
  });

  it('are removed with the report and its photos', async () => {
    const draftId = (await seedDraft(db, tech)).id;
    const photoId = await seedPhoto(draftId, tech);
    await seedChecks(draftId, photoId);
    await db.query('delete from public.reports where id = $1', [draftId]);
    const checks = await db.query('select 1 from public.report_checks where report_id = $1', [draftId]);
    const prints = await db.query('select 1 from public.photo_fingerprints where report_id = $1', [draftId]);
    expect(checks.rows).toEqual([]);
    expect(prints.rows).toEqual([]);
  });
});
