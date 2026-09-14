-- VeriScale V2 — records.
-- Manufacturers, instrument models and reference weight sets. Reviewers and
-- admins keep them up to date; technicians pick from them in the draft
-- editor. Reports keep their own text copies of these details, so changing a
-- record later never changes a submitted report — the new *_id columns only
-- point back to the record that was picked.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index manufacturers_name_key on public.manufacturers (lower(name));

create table public.instrument_models (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  accuracy_class text not null check (accuracy_class in ('I', 'II', 'III', 'IIII')),
  max_capacity_kg numeric not null check (max_capacity_kg > 0),
  interval_e_g numeric not null check (interval_e_g > 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index instrument_models_name_key on public.instrument_models (manufacturer_id, lower(name));

create table public.weight_sets (
  id uuid primary key default gen_random_uuid(),
  code text not null check (length(trim(code)) between 1 and 60),
  description text,
  weight_class text not null check (weight_class in ('E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3')),
  nominal_range text,
  certificate_no text,
  last_checked date,
  next_check date not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weight_sets_check_order check (last_checked is null or next_check > last_checked)
);
create unique index weight_sets_code_key on public.weight_sets (lower(code));

-- Records that reports point at can't be deleted.
alter table public.reports
  add column manufacturer_id uuid references public.manufacturers (id) on delete restrict,
  add column model_id uuid references public.instrument_models (id) on delete restrict,
  add column weight_set_id uuid references public.weight_sets (id) on delete restrict;

create index reports_manufacturer_id_idx on public.reports (manufacturer_id);
create index reports_model_id_idx on public.reports (model_id);
create index reports_weight_set_id_idx on public.reports (weight_set_id);

-- ---------------------------------------------------------------------------
-- Access: every signed-in user reads the records; changes go through the
-- functions below. A technician may point their own draft at a record.
-- ---------------------------------------------------------------------------
revoke all on public.manufacturers, public.instrument_models, public.weight_sets from anon, authenticated;

alter table public.manufacturers enable row level security;
alter table public.instrument_models enable row level security;
alter table public.weight_sets enable row level security;

grant select on public.manufacturers, public.instrument_models, public.weight_sets to authenticated;
grant update (manufacturer_id, model_id, weight_set_id) on public.reports to authenticated;

create policy "manufacturers: signed-in users read" on public.manufacturers
  for select to authenticated using (true);
create policy "models: signed-in users read" on public.instrument_models
  for select to authenticated using (true);
create policy "weight sets: signed-in users read" on public.weight_sets
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Guard: the picked records are locked with the rest of a submitted report.
-- ---------------------------------------------------------------------------
create or replace function public.guard_report_update() returns trigger
language plpgsql as $$
declare
  v_send_back boolean := coalesce(current_setting('veriscale.send_back', true), '') = 'on'
    and old.status = 'pending' and new.status = 'draft';
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
    or v_send_back
  ) then
    raise exception 'BAD_STATUS_CHANGE';
  end if;

  if old.status <> 'draft' and not v_send_back and (
    new.manufacturer, new.model, new.serial_number, new.accuracy_class, new.max_capacity_kg,
    new.interval_e_g, new.indicator_type, new.power_source, new.test_stage, new.test_date,
    new.temperature_c, new.temperature_source, new.humidity_pct, new.humidity_source, new.voltage_v,
    new.weather_confirmed, new.reference_weights, new.remarks, new.calculated_result, new.submitted_at,
    new.manufacturer_id, new.model_id, new.weight_set_id
  ) is distinct from (
    old.manufacturer, old.model, old.serial_number, old.accuracy_class, old.max_capacity_kg,
    old.interval_e_g, old.indicator_type, old.power_source, old.test_stage, old.test_date,
    old.temperature_c, old.temperature_source, old.humidity_pct, old.humidity_source, old.voltage_v,
    old.weather_confirmed, old.reference_weights, old.remarks, old.calculated_result, old.submitted_at,
    old.manufacturer_id, old.model_id, old.weight_set_id
  ) then
    raise exception 'REPORT_LOCKED';
  end if;

  if old.status in ('approved', 'failed') and (new.reviewed_by, new.reviewed_at, new.review_note, new.review_checks)
     is distinct from (old.reviewed_by, old.reviewed_at, old.review_note, old.review_checks) then
    raise exception 'REPORT_LOCKED';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Saving records (reviewers and admins). A null id adds a new record.
-- ---------------------------------------------------------------------------
create function public.save_manufacturer(p_id uuid, p_name text, p_actor uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.profiles%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_old text;
  v_id uuid;
begin
  select * into v_actor from public.profiles where id = p_actor;
  if not found or v_actor.role not in ('reviewer', 'admin') then
    raise exception 'NOT_ALLOWED';
  end if;
  if length(v_name) not between 1 and 120 then
    raise exception 'BAD_VALUE';
  end if;
  if exists (select 1 from public.manufacturers where lower(name) = lower(v_name) and id is distinct from p_id) then
    raise exception 'NAME_TAKEN';
  end if;

  if p_id is null then
    insert into public.manufacturers (name, created_by) values (v_name, p_actor) returning id into v_id;
    insert into public.activity_log (actor_id, actor_name, actor_role, message)
    values (v_actor.id, v_actor.full_name, v_actor.role, format('Added manufacturer %s', v_name));
  else
    select name into v_old from public.manufacturers where id = p_id for update;
    if not found then
      raise exception 'RECORD_NOT_FOUND';
    end if;
    update public.manufacturers set name = v_name where id = p_id returning id into v_id;
    if v_old <> v_name then
      insert into public.activity_log (actor_id, actor_name, actor_role, message)
      values (v_actor.id, v_actor.full_name, v_actor.role, format('Renamed manufacturer %s to %s', v_old, v_name));
    end if;
  end if;
  return v_id;
end;
$$;

create function public.save_instrument_model(
  p_id uuid, p_manufacturer_id uuid, p_name text, p_accuracy_class text,
  p_max_capacity_kg numeric, p_interval_e_g numeric, p_actor uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.profiles%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_manufacturer text;
  v_id uuid;
begin
  select * into v_actor from public.profiles where id = p_actor;
  if not found or v_actor.role not in ('reviewer', 'admin') then
    raise exception 'NOT_ALLOWED';
  end if;
  if length(v_name) not between 1 and 120
     or p_accuracy_class is null or p_accuracy_class not in ('I', 'II', 'III', 'IIII')
     or p_max_capacity_kg is null or p_max_capacity_kg <= 0
     or p_interval_e_g is null or p_interval_e_g <= 0 then
    raise exception 'BAD_VALUE';
  end if;
  select name into v_manufacturer from public.manufacturers where id = p_manufacturer_id;
  if not found then
    raise exception 'RECORD_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.instrument_models
     where manufacturer_id = p_manufacturer_id and lower(name) = lower(v_name) and id is distinct from p_id
  ) then
    raise exception 'NAME_TAKEN';
  end if;

  if p_id is null then
    insert into public.instrument_models (manufacturer_id, name, accuracy_class, max_capacity_kg, interval_e_g, created_by)
    values (p_manufacturer_id, v_name, p_accuracy_class, p_max_capacity_kg, p_interval_e_g, p_actor)
    returning id into v_id;
    insert into public.activity_log (actor_id, actor_name, actor_role, message)
    values (v_actor.id, v_actor.full_name, v_actor.role, format('Added instrument model %s %s', v_manufacturer, v_name));
  else
    update public.instrument_models
       set manufacturer_id = p_manufacturer_id, name = v_name, accuracy_class = p_accuracy_class,
           max_capacity_kg = p_max_capacity_kg, interval_e_g = p_interval_e_g
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'RECORD_NOT_FOUND';
    end if;
    insert into public.activity_log (actor_id, actor_name, actor_role, message)
    values (v_actor.id, v_actor.full_name, v_actor.role, format('Updated instrument model %s %s', v_manufacturer, v_name));
  end if;
  return v_id;
end;
$$;

create function public.save_weight_set(
  p_id uuid, p_code text, p_description text, p_weight_class text, p_nominal_range text,
  p_certificate_no text, p_last_checked date, p_next_check date, p_actor uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.profiles%rowtype;
  v_code text := trim(coalesce(p_code, ''));
  v_id uuid;
begin
  select * into v_actor from public.profiles where id = p_actor;
  if not found or v_actor.role not in ('reviewer', 'admin') then
    raise exception 'NOT_ALLOWED';
  end if;
  if length(v_code) not between 1 and 60
     or p_weight_class is null or p_weight_class not in ('E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3')
     or p_next_check is null
     or (p_last_checked is not null and p_next_check <= p_last_checked) then
    raise exception 'BAD_VALUE';
  end if;
  if exists (select 1 from public.weight_sets where lower(code) = lower(v_code) and id is distinct from p_id) then
    raise exception 'NAME_TAKEN';
  end if;

  if p_id is null then
    insert into public.weight_sets
      (code, description, weight_class, nominal_range, certificate_no, last_checked, next_check, created_by)
    values (
      v_code, nullif(left(trim(coalesce(p_description, '')), 200), ''), p_weight_class,
      nullif(left(trim(coalesce(p_nominal_range, '')), 200), ''), nullif(left(trim(coalesce(p_certificate_no, '')), 200), ''),
      p_last_checked, p_next_check, p_actor
    )
    returning id into v_id;
    insert into public.activity_log (actor_id, actor_name, actor_role, message)
    values (v_actor.id, v_actor.full_name, v_actor.role, format('Added weight set %s', v_code));
  else
    update public.weight_sets
       set code = v_code,
           description = nullif(left(trim(coalesce(p_description, '')), 200), ''),
           weight_class = p_weight_class,
           nominal_range = nullif(left(trim(coalesce(p_nominal_range, '')), 200), ''),
           certificate_no = nullif(left(trim(coalesce(p_certificate_no, '')), 200), ''),
           last_checked = p_last_checked,
           next_check = p_next_check,
           updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'RECORD_NOT_FOUND';
    end if;
    insert into public.activity_log (actor_id, actor_name, actor_role, message)
    values (v_actor.id, v_actor.full_name, v_actor.role, format('Updated weight set %s', v_code));
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Submitting: a weight set that was overdue on the test date can't be used.
-- ---------------------------------------------------------------------------
create or replace function public.submit_report(p_report_id uuid, p_actor uuid, p_results jsonb, p_calculated text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_report public.reports%rowtype;
  v_actor public.profiles%rowtype;
  v_reading_count int;
  v_result_count int;
  v_matched int;
begin
  if p_calculated is null or p_calculated not in ('pass', 'fail') then
    raise exception 'BAD_VALUE';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'REPORT_NOT_FOUND';
  end if;
  select * into v_actor from public.profiles where id = p_actor;
  if not found or v_report.created_by <> p_actor then
    raise exception 'NOT_OWNER';
  end if;
  if v_report.status <> 'draft' then
    raise exception 'REPORT_NOT_DRAFT';
  end if;
  if v_report.weight_set_id is not null and exists (
    select 1 from public.weight_sets
     where id = v_report.weight_set_id and next_check < coalesce(v_report.test_date, current_date)
  ) then
    raise exception 'WEIGHTS_OVERDUE';
  end if;

  if p_results is null or jsonb_typeof(p_results) <> 'array' then
    raise exception 'BAD_VALUE';
  end if;
  select count(*) into v_reading_count from public.readings where report_id = p_report_id;
  select count(*) into v_result_count from jsonb_array_elements(p_results);
  if v_reading_count = 0 or v_reading_count <> v_result_count then
    raise exception 'RESULTS_MISMATCH';
  end if;

  with incoming as (
    select (e ->> 'id')::uuid as id,
           (e ->> 'error_g')::numeric as error_g,
           (e ->> 'allowed_error_g')::numeric as allowed_error_g,
           e ->> 'result' as result
    from jsonb_array_elements(p_results) e
  )
  update public.readings r
     set error_g = i.error_g, allowed_error_g = i.allowed_error_g, result = i.result
    from incoming i
   where r.id = i.id and r.report_id = p_report_id;
  get diagnostics v_matched = row_count;
  if v_matched <> v_reading_count then
    raise exception 'RESULTS_MISMATCH';
  end if;

  update public.reports
     set calculated_result = p_calculated, status = 'pending', submitted_at = now()
   where id = p_report_id;

  insert into public.activity_log (actor_id, actor_name, actor_role, message, report_no)
  values (v_actor.id, v_actor.full_name, v_actor.role, 'Submitted report', v_report.report_no);

  return v_report.report_no;
end;
$$;

revoke all on function public.save_manufacturer(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.save_instrument_model(uuid, uuid, text, text, numeric, numeric, uuid) from public, anon, authenticated;
revoke all on function public.save_weight_set(uuid, text, text, text, text, text, date, date, uuid) from public, anon, authenticated;
revoke all on function public.submit_report(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_manufacturer(uuid, text, uuid) to service_role;
grant execute on function public.save_instrument_model(uuid, uuid, text, text, numeric, numeric, uuid) to service_role;
grant execute on function public.save_weight_set(uuid, text, text, text, text, text, date, date, uuid) to service_role;
grant execute on function public.submit_report(uuid, uuid, jsonb, text) to service_role;
