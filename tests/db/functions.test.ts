import { beforeAll, describe, expect, it } from 'vitest';
import {
  asService,
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
let tech: string;
let tech2: string;
let reviewer: string;
let admin: string;

beforeAll(async () => {
  db = await createDb();
  tech = await seedUser(db, 'technician', 'Arjun Mehta');
  tech2 = await seedUser(db, 'technician', 'Rohan Desai');
  reviewer = await seedUser(db, 'reviewer', 'Kavya Rao');
  admin = await seedUser(db, 'admin', 'Priya Nair');
});

const results = (ids: string[], result: 'pass' | 'fail' = 'pass') =>
  JSON.stringify(ids.map((id) => ({ id, error_g: 20, allowed_error_g: 25, result })));

const submit = (reportId: string, actor: string, resultsJson: string, calculated = 'pass') =>
  asService(db, (tx) =>
    tx.query<{ report_no: string }>('select public.submit_report($1, $2, $3::jsonb, $4) as report_no', [
      reportId,
      actor,
      resultsJson,
      calculated,
    ]),
  );

const review = (reportId: string, actor: string, decision: string, note: string | null = null) =>
  asService(db, (tx) => tx.query('select public.review_report($1, $2, $3, $4)', [reportId, actor, decision, note]));

async function submittedReport(calculated: 'pass' | 'fail' = 'pass') {
  const { id } = await seedDraft(db, tech);
  const readingId = await seedReading(db, id);
  await submit(id, tech, results([readingId], calculated), calculated);
  return id;
}

const lastActivity = async () =>
  (
    await db.query<{ message: string; actor_name: string; actor_role: string; report_no: string | null }>(
      'select message, actor_name, actor_role, report_no from public.activity_log order by id desc limit 1',
    )
  ).rows[0];

describe('submit_report', () => {
  it('stores results, locks the report as pending and logs it', async () => {
    const { id, report_no } = await seedDraft(db, tech);
    const r1 = await seedReading(db, id, 0);
    const r2 = await seedReading(db, id, 1);
    const res = await submit(id, tech, results([r1, r2]));
    expect(res.rows[0].report_no).toBe(report_no);

    const report = (
      await db.query<{ status: string; calculated_result: string; submitted_at: Date | null }>(
        'select status, calculated_result, submitted_at from public.reports where id = $1',
        [id],
      )
    ).rows[0];
    expect(report.status).toBe('pending');
    expect(report.calculated_result).toBe('pass');
    expect(report.submitted_at).not.toBeNull();

    const stored = await db.query<{ result: string; error_g: string }>(
      'select result, error_g from public.readings where report_id = $1',
      [id],
    );
    expect(stored.rows.every((r) => r.result === 'pass')).toBe(true);
    expect(await lastActivity()).toMatchObject({
      message: 'Submitted report',
      actor_name: 'Arjun Mehta',
      actor_role: 'technician',
      report_no,
    });
  });

  it('only the creator can submit', async () => {
    const { id } = await seedDraft(db, tech);
    const readingId = await seedReading(db, id);
    expect(await errorOf(submit(id, tech2, results([readingId])))).toMatch('NOT_OWNER');
  });

  it('cannot submit twice', async () => {
    const id = await submittedReport();
    expect(await errorOf(submit(id, tech, '[]'))).toMatch('REPORT_NOT_DRAFT');
  });

  it('requires a result for every reading, and at least one reading', async () => {
    const { id } = await seedDraft(db, tech);
    const r1 = await seedReading(db, id, 0);
    await seedReading(db, id, 1);
    expect(await errorOf(submit(id, tech, results([r1])))).toMatch('RESULTS_MISMATCH');

    const empty = await seedDraft(db, tech);
    expect(await errorOf(submit(empty.id, tech, '[]'))).toMatch('RESULTS_MISMATCH');
  });

  it('rejects an unknown result value', async () => {
    const { id } = await seedDraft(db, tech);
    const readingId = await seedReading(db, id);
    expect(await errorOf(submit(id, tech, results([readingId]), 'maybe'))).toMatch('BAD_VALUE');
  });

  it('cannot be called by signed-in users directly', async () => {
    const { id } = await seedDraft(db, tech);
    expect(
      await errorOf(
        asUser(db, tech, (tx) => tx.query(`select public.submit_report($1, $2, '[]'::jsonb, 'pass')`, [id, tech])),
      ),
    ).toMatch('permission denied');
  });
});

describe('review_report', () => {
  it('approves a pending report that calculated as pass and logs it', async () => {
    const id = await submittedReport('pass');
    await review(id, reviewer, 'approved', 'All good');
    const row = (
      await db.query<{ status: string; reviewed_by: string; review_note: string }>(
        'select status, reviewed_by, review_note from public.reports where id = $1',
        [id],
      )
    ).rows[0];
    expect(row).toMatchObject({ status: 'approved', reviewed_by: reviewer, review_note: 'All good' });
    expect(await lastActivity()).toMatchObject({ message: 'Approved report', actor_name: 'Kavya Rao' });
  });

  it('fails a report that calculated as fail, without needing a note', async () => {
    const id = await submittedReport('fail');
    await review(id, admin, 'failed');
    const row = (await db.query<{ status: string }>('select status from public.reports where id = $1', [id])).rows[0];
    expect(row.status).toBe('failed');
    expect(await lastActivity()).toMatchObject({ message: 'Failed report', actor_role: 'admin' });
  });

  it('does not allow approving a report that calculated as fail', async () => {
    const id = await submittedReport('fail');
    expect(await errorOf(review(id, reviewer, 'approved'))).toMatch('APPROVE_NOT_ALLOWED');
  });

  it('requires a note to fail a report that calculated as pass', async () => {
    const id = await submittedReport('pass');
    expect(await errorOf(review(id, reviewer, 'failed', '  '))).toMatch('NOTE_REQUIRED');
    await review(id, reviewer, 'failed', 'Seal was broken');
    const row = (await db.query<{ status: string }>('select status from public.reports where id = $1', [id])).rows[0];
    expect(row.status).toBe('failed');
  });

  it('technicians cannot review', async () => {
    const id = await submittedReport('pass');
    expect(await errorOf(review(id, tech2, 'approved'))).toMatch('NOT_ALLOWED');
  });

  it('a second review is rejected and says who decided', async () => {
    const id = await submittedReport('pass');
    await review(id, reviewer, 'approved');
    expect(await errorOf(review(id, admin, 'failed', 'Late change'))).toMatch('ALREADY_REVIEWED|approved|Kavya Rao');
  });

  it('a draft cannot be reviewed', async () => {
    const { id } = await seedDraft(db, tech);
    expect(await errorOf(review(id, reviewer, 'approved'))).toMatch('NOT_SUBMITTED');
  });

  it('rejects an unknown decision', async () => {
    const id = await submittedReport('pass');
    expect(await errorOf(review(id, reviewer, 'maybe'))).toMatch('BAD_VALUE');
  });
});

describe('update_allowed_error', () => {
  const update = (ruleId: string, multiplier: number, actor: string) =>
    asService(db, (tx) => tx.query('select public.update_allowed_error($1, $2, $3)', [ruleId, multiplier, actor]));

  it('lets an admin change a value and logs it in plain words', async () => {
    await update('III-2', 1.2, admin);
    const rule = (
      await db.query<{ multiplier: string; updated_by: string }>(
        'select multiplier, updated_by from public.allowed_error_rules where id = $1',
        ['III-2'],
      )
    ).rows[0];
    expect(Number(rule.multiplier)).toBe(1.2);
    expect(rule.updated_by).toBe(admin);
    expect((await lastActivity()).message).toBe('Changed allowed error for Class III (500–2,000)');
  });

  it('describes open-ended and starting bands clearly', async () => {
    await update('III-3', 1.5, admin);
    expect((await lastActivity()).message).toBe('Changed allowed error for Class III (above 2,000)');
    await update('I-1', 0.5, admin);
    expect((await lastActivity()).message).toBe('Changed allowed error for Class I (0–50,000)');
  });

  it('only admins can change rules, with positive values, on known rules', async () => {
    expect(await errorOf(update('III-2', 1, reviewer))).toMatch('NOT_ALLOWED');
    expect(await errorOf(update('III-2', 0, admin))).toMatch('BAD_VALUE');
    expect(await errorOf(update('X-9', 1, admin))).toMatch('RULE_NOT_FOUND');
  });

  it('cannot be called by signed-in users directly', async () => {
    expect(
      await errorOf(asUser(db, admin, (tx) => tx.query(`select public.update_allowed_error('III-2', 1, $1)`, [admin]))),
    ).toMatch('permission denied');
  });
});

describe('locking still applies to pending reports moved by other means', () => {
  it('a pending report forced by the owner stays locked for review changes to content', async () => {
    const { id } = await seedDraft(db, tech);
    await forcePending(db, id);
    expect(await errorOf(db.query(`update public.reports set remarks = 'x' where id = $1`, [id]))).toMatch('REPORT_LOCKED');
  });
});
