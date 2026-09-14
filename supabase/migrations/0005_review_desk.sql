-- VeriScale V2 — review desk.
-- Reviewers can send a pending report back to its technician for changes,
-- and record the checks they made on the photos when they decide.

alter table public.reports
  add column sent_back_at timestamptz,
  add column sent_back_by uuid references public.profiles (id) on delete set null,
  add column send_back_note text,
  add column review_checks jsonb;

-- ---------------------------------------------------------------------------
-- Report guard: same rules as before, plus one extra path — pending back to
-- draft — which only send_back_report can take (it sets a flag for the
-- length of its own update).
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
    new.weather_confirmed, new.reference_weights, new.remarks, new.calculated_result, new.submitted_at
  ) is distinct from (
    old.manufacturer, old.model, old.serial_number, old.accuracy_class, old.max_capacity_kg,
    old.interval_e_g, old.indicator_type, old.power_source, old.test_stage, old.test_date,
    old.temperature_c, old.temperature_source, old.humidity_pct, old.humidity_source, old.voltage_v,
    old.weather_confirmed, old.reference_weights, old.remarks, old.calculated_result, old.submitted_at
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
-- Send a pending report back to its technician. It becomes a draft again,
-- its stored results are cleared, and the note tells the technician why.
-- ---------------------------------------------------------------------------
create function public.send_back_report(p_report_id uuid, p_actor uuid, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_report public.reports%rowtype;
  v_actor public.profiles%rowtype;
  v_reviewer_name text;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into v_actor from public.profiles where id = p_actor;
  if not found or v_actor.role not in ('reviewer', 'admin') then
    raise exception 'NOT_ALLOWED';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'REPORT_NOT_FOUND';
  end if;

  if v_report.status = 'draft' then
    raise exception 'NOT_SUBMITTED';
  end if;

  if v_report.status in ('approved', 'failed') then
    select full_name into v_reviewer_name from public.profiles where id = v_report.reviewed_by;
    raise exception 'ALREADY_REVIEWED|%|%', v_report.status, coalesce(v_reviewer_name, 'someone else');
  end if;

  if v_note is null then
    raise exception 'SEND_BACK_NOTE_MISSING';
  end if;

  perform set_config('veriscale.send_back', 'on', true);
  update public.reports
     set status = 'draft', calculated_result = null, submitted_at = null,
         sent_back_at = now(), sent_back_by = p_actor, send_back_note = left(v_note, 1000),
         review_checks = null
   where id = p_report_id;
  perform set_config('veriscale.send_back', 'off', true);

  update public.readings
     set error_g = null, allowed_error_g = null, result = null
   where report_id = p_report_id;

  insert into public.activity_log (actor_id, actor_name, actor_role, message, report_no)
  values (v_actor.id, v_actor.full_name, v_actor.role, 'Sent back for changes', v_report.report_no);
end;
$$;

-- ---------------------------------------------------------------------------
-- review_report now also stores the reviewer's photo checks.
-- ---------------------------------------------------------------------------
drop function public.review_report(uuid, uuid, text, text);

create function public.review_report(p_report_id uuid, p_actor uuid, p_decision text, p_note text, p_checks jsonb default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_report public.reports%rowtype;
  v_actor public.profiles%rowtype;
  v_reviewer_name text;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if p_decision is null or p_decision not in ('approved', 'failed') then
    raise exception 'BAD_VALUE';
  end if;

  if p_checks is not null and jsonb_typeof(p_checks) <> 'object' then
    raise exception 'BAD_VALUE';
  end if;

  select * into v_actor from public.profiles where id = p_actor;
  if not found or v_actor.role not in ('reviewer', 'admin') then
    raise exception 'NOT_ALLOWED';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'REPORT_NOT_FOUND';
  end if;

  if v_report.status = 'draft' then
    raise exception 'NOT_SUBMITTED';
  end if;

  if v_report.status in ('approved', 'failed') then
    select full_name into v_reviewer_name from public.profiles where id = v_report.reviewed_by;
    raise exception 'ALREADY_REVIEWED|%|%', v_report.status, coalesce(v_reviewer_name, 'someone else');
  end if;

  if p_decision = 'approved' and v_report.calculated_result is distinct from 'pass' then
    raise exception 'APPROVE_NOT_ALLOWED';
  end if;

  if p_decision = 'failed' and v_report.calculated_result = 'pass' and v_note is null then
    raise exception 'NOTE_REQUIRED';
  end if;

  update public.reports
     set status = p_decision::public.report_status, reviewed_by = p_actor, reviewed_at = now(),
         review_note = v_note, review_checks = p_checks
   where id = p_report_id;

  insert into public.activity_log (actor_id, actor_name, actor_role, message, report_no)
  values (
    v_actor.id, v_actor.full_name, v_actor.role,
    case when p_decision = 'approved' then 'Approved report' else 'Failed report' end,
    v_report.report_no
  );
end;
$$;

revoke all on function public.send_back_report(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.review_report(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.send_back_report(uuid, uuid, text) to service_role;
grant execute on function public.review_report(uuid, uuid, text, text, jsonb) to service_role;
