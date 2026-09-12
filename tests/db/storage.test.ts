import { beforeAll, describe, expect, it } from 'vitest';
import { asAnon, asUser, createDb, errorOf, forcePending, seedDraft, seedUser, type Db } from './harness';

let db: Db;
let owner: string;
let other: string;
let reviewer: string;
let draft: string;
let pending: string;

const upload = (userId: string, name: string, bucket = 'report-photos') =>
  asUser(db, userId, (tx) =>
    tx.query('insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)', [bucket, name, userId]),
  );

beforeAll(async () => {
  db = await createDb();
  owner = await seedUser(db, 'technician');
  other = await seedUser(db, 'technician');
  reviewer = await seedUser(db, 'reviewer');
  draft = (await seedDraft(db, owner)).id;
  pending = (await seedDraft(db, owner)).id;
  await forcePending(db, pending);
});

describe('report-photos bucket', () => {
  it('is private with a 10 MB limit and image types only', async () => {
    const { rows } = await db.query<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'report-photos'`,
    );
    expect(rows[0].public).toBe(false);
    expect(Number(rows[0].file_size_limit)).toBe(10 * 1024 * 1024);
    expect(rows[0].allowed_mime_types).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });

  it('the creator can upload into their own draft’s folder', async () => {
    expect((await upload(owner, `${draft}/one.jpg`)).affectedRows).toBe(1);
  });

  it('nobody can upload into a submitted report’s folder', async () => {
    expect(await errorOf(upload(owner, `${pending}/late.jpg`))).toMatch('row-level security');
  });

  it('other users cannot upload into someone else’s draft folder', async () => {
    expect(await errorOf(upload(other, `${draft}/sneaky.jpg`))).toMatch('row-level security');
  });

  it('uploads outside the photos bucket are not allowed by these rules', async () => {
    await db.query(`insert into storage.buckets (id, name) values ('other', 'other') on conflict do nothing`);
    expect(await errorOf(upload(owner, `${draft}/x.jpg`, 'other'))).toMatch('row-level security');
  });

  it('signed-in users can view photos; signed-out visitors cannot', async () => {
    const asReviewer = await asUser(db, reviewer, (tx) =>
      tx.query(`select name from storage.objects where bucket_id = 'report-photos'`),
    );
    const asVisitor = await asAnon(db, (tx) => tx.query(`select name from storage.objects where bucket_id = 'report-photos'`));
    expect(asReviewer.rows.length).toBeGreaterThanOrEqual(1);
    expect(asVisitor.rows).toHaveLength(0);
  });

  it('only the creator can remove photos from their draft', async () => {
    await upload(owner, `${draft}/two.jpg`);
    const byOther = await asUser(db, other, (tx) =>
      tx.query('delete from storage.objects where name = $1', [`${draft}/two.jpg`]),
    );
    const byOwner = await asUser(db, owner, (tx) =>
      tx.query('delete from storage.objects where name = $1', [`${draft}/two.jpg`]),
    );
    expect(byOther.affectedRows).toBe(0);
    expect(byOwner.affectedRows).toBe(1);
  });
});
