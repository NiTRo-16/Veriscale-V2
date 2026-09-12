-- VeriScale V2 — tables, report numbers and lock triggers.
-- Apply migrations in file-name order (Supabase SQL editor or `supabase db push`).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('technician', 'reviewer', 'admin');
create type public.report_status as enum ('draft', 'pending', 'approved', 'failed');
create type public.condition_source as enum ('sensor', 'manual', 'weather');
create type public.photo_kind as enum ('nameplate', 'display', 'setup', 'seals', 'other');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  email text not null,
  role public.user_role not null,
  created_at timestamptz not null default now()
);

-- OIML R 76-1 (2006) Table 6, initial verification. max_n null = no upper limit.
create table public.allowed_error_rules (
  id text primary key,
  accuracy_class text not null check (accuracy_class in ('I', 'II', 'III', 'IIII')),
  min_n numeric not null check (min_n >= 0),
  max_n numeric check (max_n is null or max_n > min_n),
  multiplier numeric not null check (multiplier > 0),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.report_counters (
  year int primary key,
  last_number int not null
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  report_no text not null unique,
  status public.report_status not null default 'draft',

  manufacturer text,
  model text,
  serial_number text,
  accuracy_class text check (accuracy_class in ('I', 'II', 'III', 'IIII')),
  max_capacity_kg numeric check (max_capacity_kg > 0),
  interval_e_g numeric check (interval_e_g > 0),
  indicator_type text,
  power_source text,
  test_stage text not null default 'initial' check (test_stage in ('initial', 'in_service')),
  test_date date default current_date,

  temperature_c numeric,
  temperature_source public.condition_source,
  humidity_pct numeric check (humidity_pct between 0 and 100),
  humidity_source public.condition_source,
  voltage_v numeric check (voltage_v >= 0),
  weather_confirmed boolean not null default false,

  reference_weights text,
  remarks text,

  calculated_result text check (calculated_result in ('pass', 'fail')),

  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text,

  constraint submitted_reports_complete check (
    status = 'draft' or (
      manufacturer is not null and model is not null and serial_number is not null
      and accuracy_class is not null and max_capacity_kg is not null and interval_e_g is not null
      and test_date is not null and calculated_result is not null and submitted_at is not null
    )
  ),
  constraint reviewed_reports_have_reviewer check (
    status not in ('approved', 'failed') or (reviewed_by is not null and reviewed_at is not null)
  )
);

create index reports_status_idx on public.reports (status);
create index reports_created_at_idx on public.reports (created_at desc);
create index reports_created_by_idx on public.reports (created_by);

create table public.readings (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  test_type text not null,
  clause text,
  load_kg numeric check (load_kg >= 0),
  reference_kg numeric check (reference_kg >= 0),
  indicated_kg numeric,
  position int not null default 0,
  -- stored when the report is submitted
  error_g numeric,
  allowed_error_g numeric,
  result text check (result in ('pass', 'fail'))
);

create index readings_report_idx on public.readings (report_id, position);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  reading_id uuid references public.readings (id) on delete set null,
  kind public.photo_kind not null default 'other',
  storage_path text not null unique,
  taken_at timestamptz,
  uploaded_by uuid not null references public.profiles (id),
  uploaded_at timestamptz not null default now()
);

create index photos_report_idx on public.photos (report_id);

create table public.activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text not null,
  actor_role public.user_role not null,
  message text not null,
  report_no text,
  created_at timestamptz not null default now()
);

create index activity_log_created_at_idx on public.activity_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Report numbers: VS-YYYY-NNN, unique even when drafts are created at once
-- (the counter row is locked by the upsert).
-- ---------------------------------------------------------------------------
create function public.set_report_number() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_year int := extract(year from now())::int;
  v_next int;
begin
  insert into public.report_counters as c (year, last_number)
  values (v_year, 1)
  on conflict (year) do update set last_number = c.last_number + 1
  returning c.last_number into v_next;

  new.report_no := 'VS-' || v_year || '-' ||
    case when v_next < 1000 then lpad(v_next::text, 3, '0') else v_next::text end;
  return new;
end;
$$;

create trigger reports_set_number
  before insert on public.reports
  for each row execute function public.set_report_number();

-- ---------------------------------------------------------------------------
-- Report guards: allowed status changes, and nothing changes after submit.
-- These apply to every caller, including server code.
-- ---------------------------------------------------------------------------
create function public.guard_report_update() returns trigger
language plpgsql as $$
begin
  if new.id is distinct from old.id
     or new.report_no is distinct from old.report_no
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'READ_ONLY_FIELD';
  end if;

  if new.status is distinct from old.status and not (
       (old.status = 'draft' and new.status = 'pending')
    or (old.status = 'pending' and new.status in ('approved', 'failed'))
  ) then
    raise exception 'BAD_STATUS_CHANGE';
  end if;

  if old.status <> 'draft' and (
    new.manufacturer, new.model, new.serial_number, new.accuracy_class, new.max_capacity_kg,
    new.interval_e_g, new.indicator_type, new.power_source, new.test_stage, new.test_date,
    new.temperature_c, new.temperature_source, new.humidity_pct, new.humidity_source, new.voltage_v,
    new.weather_confirmed, new.reference_weights, new.remarks, new.calculated_result, new.submitted_at
  ) is distinct from (
    old.manufacturer, old.model, old.serial_number, old.accuracy_class, old.max_capacity_kg,
    old.interval_e_g, old.indicator_type, old.power_source, old.test_stage, old.test_date,
    old.temperature_c, old.temperature_source, old.humidity_pct, old.humidity_source, old.voltage_v,
    old.weather_confirmed, old.reference_weights, old.remarks, old.calculated_result, old.submitted_at
  ) then
    raise exception 'REPORT_LOCKED';
  end if;

  if old.status in ('approved', 'failed') and (new.reviewed_by, new.reviewed_at, new.review_note)
     is distinct from (old.reviewed_by, old.reviewed_at, old.review_note) then
    raise exception 'REPORT_LOCKED';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger reports_guard_update
  before update on public.reports
  for each row execute function public.guard_report_update();

create function public.guard_report_delete() returns trigger
language plpgsql as $$
begin
  if old.status <> 'draft' then
    raise exception 'DRAFTS_ONLY';
  end if;
  return old;
end;
$$;

create trigger reports_guard_delete
  before delete on public.reports
  for each row execute function public.guard_report_delete();

-- Readings and photos can only change while their report is a draft.
create function public.guard_child_rows() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_report uuid;
begin
  if tg_op = 'DELETE' then
    v_report := old.report_id;
  else
    v_report := new.report_id;
  end if;

  if tg_op = 'UPDATE' and (new.id is distinct from old.id or new.report_id is distinct from old.report_id) then
    raise exception 'READ_ONLY_FIELD';
  end if;

  if exists (select 1 from public.reports r where r.id = v_report and r.status <> 'draft') then
    raise exception 'REPORT_LOCKED';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger readings_guard
  before insert or update or delete on public.readings
  for each row execute function public.guard_child_rows();

create trigger photos_guard
  before insert or update or delete on public.photos
  for each row execute function public.guard_child_rows();

-- ---------------------------------------------------------------------------
-- Seed: Table 6 allowed-error bands
-- ---------------------------------------------------------------------------
insert into public.allowed_error_rules (id, accuracy_class, min_n, max_n, multiplier) values
  ('I-1', 'I', 0, 50000, 0.5),
  ('I-2', 'I', 50000, 200000, 1.0),
  ('I-3', 'I', 200000, null, 1.5),
  ('II-1', 'II', 0, 5000, 0.5),
  ('II-2', 'II', 5000, 20000, 1.0),
  ('II-3', 'II', 20000, null, 1.5),
  ('III-1', 'III', 0, 500, 0.5),
  ('III-2', 'III', 500, 2000, 1.0),
  ('III-3', 'III', 2000, null, 1.5),
  ('IIII-1', 'IIII', 0, 50, 0.5),
  ('IIII-2', 'IIII', 50, 200, 1.0),
  ('IIII-3', 'IIII', 200, null, 1.5);
