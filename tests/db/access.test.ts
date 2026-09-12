import { beforeAll, describe, expect, it } from 'vitest';
import {
  asAnon,
  asUser,
  createDb,
  errorOf,
  forcePending,
  seedDraft,
  seedReading,
  seedUser,
  type Db,
} from './harness';

let db: Db;
let tech1: string;
let tech2: string;
let reviewer: string;
let admin: string;
let draft1: string;
let draft2: string;
let pending1: string;

beforeAll(async () => {
  db = await createDb();
  tech1 = await seedUser(db, 'technician');
  tech2 = await seedUser(db, 'technician');
  reviewer = await seedUser(db, 'reviewer');
  admin = await seedUser(db, 'admin');
  draft1 = (await seedDraft(db, tech1)).id;
  draft2 = (await seedDraft(db, tech2)).id;
  pending1 = (await seedDraft(db, tech1)).id;
  await seedReading(db, pending1);
  await forcePending(db, pending1);
  await db.query(
    `insert into public.activity_log (actor_id, actor_name, actor_role, message) values ($1, 'Admin', 'admin', 'Added user')`,
    [admin],
  );
});

describe('reading data', () => {
  it('every signed-in user can see all reports, including other people’s drafts', async () => {
    const { rows } = await asUser(db, tech1, (tx) => tx.query('select id from public.reports'));
    const ids = rows.map((r) => (r as { id: string }).id);
    expect(ids).toEqual(expect.arrayContaining([draft1, draft2, pending1]));
  });

  it('signed-out visitors cannot read reports', async () => {
    expect(await errorOf(asAnon(db, (tx) => tx.query('select id from public.reports')))).toMatch('permission denied');
  });

  it('everyone signed in can read profiles and rules', async () => {
    const profiles = await asUser(db, tech1, (tx) => tx.query('select id from public.profiles'));
    const rules = await asUser(db, reviewer, (tx) => tx.query('select id from public.allowed_error_rules'));
    expect(profiles.rows.length).toBeGreaterThanOrEqual(4);
    expect(rules.rows).toHaveLength(12);
  });

  it('the report counter is not readable', async () => {
    expect(await errorOf(asUser(db, admin, (tx) => tx.query('select * from public.report_counters')))).toMatch(
      'permission denied',
    );
  });
});

describe('editing drafts', () => {
  it('a technician can edit their own draft', async () => {
    const res = await asUser(db, tech1, (tx) =>
      tx.query(`update public.reports set model = 'TW-160', temperature_c = 22.5 where id = $1`, [draft1]),
    );
    expect(res.affectedRows).toBe(1);
  });

  it('a technician cannot edit someone else’s draft', async () => {
    const res = await asUser(db, tech1, (tx) => tx.query(`update public.reports set model = 'X' where id = $1`, [draft2]));
    expect(res.affectedRows).toBe(0);
  });

  it('a technician cannot submit, approve or set results directly', async () => {
    expect(
      await errorOf(asUser(db, tech1, (tx) => tx.query(`update public.reports set status = 'pending' where id = $1`, [draft1]))),
    ).toMatch('permission denied');
    expect(
      await errorOf(
        asUser(db, tech1, (tx) => tx.query(`update public.reports set calculated_result = 'pass' where id = $1`, [draft1])),
      ),
    ).toMatch('permission denied');
  });

  it('nobody can create or delete reports directly', async () => {
    expect(
      await errorOf(asUser(db, tech1, (tx) => tx.query('insert into public.reports (created_by) values ($1)', [tech1]))),
    ).toMatch('permission denied');
    expect(
      await errorOf(asUser(db, tech1, (tx) => tx.query('delete from public.reports where id = $1', [draft1]))),
    ).toMatch('permission denied');
  });

  it('a submitted report cannot be edited by its creator', async () => {
    const res = await asUser(db, tech1, (tx) => tx.query(`update public.reports set model = 'X' where id = $1`, [pending1]));
    expect(res.affectedRows).toBe(0);
  });
});

describe('readings', () => {
  it('a technician can add, change and remove readings on their own draft', async () => {
    const id = await asUser(db, tech1, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into public.readings (report_id, test_type, clause, load_kg, reference_kg, indicated_kg, position)
         values ($1, 'Eccentricity', '3.6.2', 50, 50, 49.98, 1) returning id`,
        [draft1],
      );
      return rows[0].id;
    });
    const updated = await asUser(db, tech1, (tx) => tx.query('update public.readings set indicated_kg = 50 where id = $1', [id]));
    const removed = await asUser(db, tech1, (tx) => tx.query('delete from public.readings where id = $1', [id]));
    expect(updated.affectedRows).toBe(1);
    expect(removed.affectedRows).toBe(1);
  });

  it('a technician cannot add readings to someone else’s draft', async () => {
    expect(
      await errorOf(
        asUser(db, tech1, (tx) =>
          tx.query(`insert into public.readings (report_id, test_type) values ($1, 'Eccentricity')`, [draft2]),
        ),
      ),
    ).toMatch('row-level security');
  });

  it('a reviewer cannot change readings', async () => {
    await seedReading(db, draft2);
    const res = await asUser(db, reviewer, (tx) =>
      tx.query('update public.readings set indicated_kg = 1 where report_id = $1', [draft2]),
    );
    expect(res.affectedRows).toBe(0);
  });

  it('nobody can write stored results directly', async () => {
    expect(
      await errorOf(
        asUser(db, tech1, (tx) => tx.query(`update public.readings set result = 'pass' where report_id = $1`, [draft1])),
      ),
    ).toMatch('permission denied');
  });
});

describe('photos', () => {
  it('a technician can record a photo on their own draft', async () => {
    const res = await asUser(db, tech1, (tx) =>
      tx.query(
        `insert into public.photos (report_id, kind, storage_path, uploaded_by) values ($1, 'nameplate', $2, $3)`,
        [draft1, `${draft1}/p1.jpg`, tech1],
      ),
    );
    expect(res.affectedRows).toBe(1);
  });

  it('cannot record photos on someone else’s draft or in someone else’s name', async () => {
    expect(
      await errorOf(
        asUser(db, tech1, (tx) =>
          tx.query(
            `insert into public.photos (report_id, kind, storage_path, uploaded_by) values ($1, 'setup', $2, $3)`,
            [draft2, `${draft2}/p2.jpg`, tech1],
          ),
        ),
      ),
    ).toMatch('row-level security');
    expect(
      await errorOf(
        asUser(db, tech1, (tx) =>
          tx.query(
            `insert into public.photos (report_id, kind, storage_path, uploaded_by) values ($1, 'setup', $2, $3)`,
            [draft1, `${draft1}/p3.jpg`, tech2],
          ),
        ),
      ),
    ).toMatch('row-level security');
  });
});

describe('admin-only data', () => {
  it('only admins can read the activity log', async () => {
    const asTech = await asUser(db, tech1, (tx) => tx.query('select id from public.activity_log'));
    const asReviewer = await asUser(db, reviewer, (tx) => tx.query('select id from public.activity_log'));
    const asAdmin = await asUser(db, admin, (tx) => tx.query('select id from public.activity_log'));
    expect(asTech.rows).toHaveLength(0);
    expect(asReviewer.rows).toHaveLength(0);
    expect(asAdmin.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('nobody can write the activity log, profiles or rules directly', async () => {
    expect(
      await errorOf(
        asUser(db, admin, (tx) =>
          tx.query(`insert into public.activity_log (actor_name, actor_role, message) values ('x', 'admin', 'x')`),
        ),
      ),
    ).toMatch('permission denied');
    expect(
      await errorOf(asUser(db, tech1, (tx) => tx.query(`update public.profiles set role = 'admin' where id = $1`, [tech1]))),
    ).toMatch('permission denied');
    expect(
      await errorOf(asUser(db, admin, (tx) => tx.query(`update public.allowed_error_rules set multiplier = 9`))),
    ).toMatch('permission denied');
  });
});
