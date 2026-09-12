// In-process Postgres for testing the Supabase migrations without Docker.
// Stubs the parts of Supabase the migrations rely on: the anon /
// authenticated / service_role roles, Supabase's default table privileges,
// auth.users + auth.uid(), and a minimal storage schema.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import type { Role } from '@/lib/types';

export type Db = PGlite;
export type Tx = Transaction;

const MIGRATIONS_DIR = path.resolve(__dirname, '../../supabase/migrations');

const SUPABASE_STUBS = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean not null default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text not null, owner uuid, created_at timestamptz not null default now()
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

  -- Supabase grants everything in public to these roles by default; the
  -- migrations must take away what each role should not have.
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export async function createDb(): Promise<Db> {
  const db = await PGlite.create();
  await db.exec(SUPABASE_STUBS);
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
    } catch (err) {
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }
  return db;
}

async function asRole<T>(db: Db, role: string, userId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? '']);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}

export const asUser = <T>(db: Db, userId: string, fn: (tx: Tx) => Promise<T>) => asRole(db, 'authenticated', userId, fn);
export const asAnon = <T>(db: Db, fn: (tx: Tx) => Promise<T>) => asRole(db, 'anon', null, fn);
export const asService = <T>(db: Db, fn: (tx: Tx) => Promise<T>) => asRole(db, 'service_role', null, fn);

let userCounter = 0;

/** Creates an auth user + profile directly (as the database owner). */
export async function seedUser(db: Db, role: Role, fullName?: string): Promise<string> {
  userCounter += 1;
  const name = fullName ?? `${role} ${userCounter}`;
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
    [`user${userCounter}@lab.example`],
  );
  const id = rows[0].id;
  await db.query(`insert into public.profiles (id, full_name, email, role) values ($1, $2, $3, $4)`, [
    id,
    name,
    `user${userCounter}@lab.example`,
    role,
  ]);
  return id;
}

const COMPLETE_INSTRUMENT = {
  manufacturer: 'Acme Weighing Systems',
  model: 'TW-150',
  serial_number: 'AWS-1',
  accuracy_class: 'III',
  max_capacity_kg: 150,
  interval_e_g: 50,
};

/** Creates a draft report (as the database owner) with complete instrument details. */
export async function seedDraft(
  db: Db,
  createdBy: string,
  fields: Record<string, unknown> = {},
): Promise<{ id: string; report_no: string }> {
  const data = { ...COMPLETE_INSTRUMENT, ...fields, created_by: createdBy };
  const cols = Object.keys(data);
  const { rows } = await db.query<{ id: string; report_no: string }>(
    `insert into public.reports (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})
     returning id, report_no`,
    Object.values(data),
  );
  return rows[0];
}

/** Adds a complete reading (as the database owner). */
export async function seedReading(db: Db, reportId: string, position = 0): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.readings (report_id, test_type, clause, load_kg, reference_kg, indicated_kg, position)
     values ($1, 'Weighing accuracy', 'A.4.4', 10, 10, 10.02, $2) returning id`,
    [reportId, position],
  );
  return rows[0].id;
}

/** Moves a draft straight to pending (as the database owner), filling what a submit would. */
export async function forcePending(db: Db, reportId: string, calculated: 'pass' | 'fail' = 'pass'): Promise<void> {
  await db.query(
    `update public.reports set status = 'pending', calculated_result = $2, submitted_at = now() where id = $1`,
    [reportId, calculated],
  );
}

export async function errorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    return (err as Error).message;
  }
  throw new Error('Expected the database to reject this, but it succeeded');
}
