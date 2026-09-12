-- VeriScale V2 — the three changes that must happen all-or-nothing.
-- Called only by the app's server (service role) after it has checked the
-- signed-in user; each function re-checks inside the transaction and writes
-- its activity-log entry in the same step.

-- ---------------------------------------------------------------------------
-- Submit a draft: store every reading's result, the report result, lock it.
-- p_results: [{ "id": uuid, "error_g": number, "allowed_error_g": number, "result": "pass"|"fail" }]
-- ---------------------------------------------------------------------------
create function public.submit_report(p_report_id uuid, p_actor uuid, p_results jsonb, p_calculated text)
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

-- ---------------------------------------------------------------------------
-- Review a pending report. A report that calculated as fail can only be
-- failed; failing one that calculated as pass needs a note.
-- ---------------------------------------------------------------------------
create function public.review_report(p_report_id uuid, p_actor uuid, p_decision text, p_note text)
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
     set status = p_decision::public.report_status, reviewed_by = p_actor, reviewed_at = now(), review_note = v_note
   where id = p_report_id;

  insert into public.activity_log (actor_id, actor_name, actor_role, message, report_no)
  values (
    v_actor.id, v_actor.full_name, v_actor.role,
    case when p_decision = 'approved' then 'Approved report' else 'Failed report' end,
    v_report.report_no
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Change one allowed-error value (admins only).
-- ---------------------------------------------------------------------------
create function public.update_allowed_error(p_rule_id text, p_multiplier numeric, p_actor uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.profiles%rowtype;
  v_rule public.allowed_error_rules%rowtype;
  v_range text;
begin
  select * into v_actor from public.profiles where id = p_actor;
  if not found or v_actor.role <> 'admin' then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_multiplier is null or p_multiplier <= 0 then
    raise exception 'BAD_VALUE';
  end if;

  select * into v_rule from public.allowed_error_rules where id = p_rule_id for update;
  if not found then
    raise exception 'RULE_NOT_FOUND';
  end if;

  update public.allowed_error_rules
     set multiplier = p_multiplier, updated_by = p_actor, updated_at = now()
   where id = p_rule_id;

  v_range := case
    when v_rule.max_n is null then 'above ' || to_char(v_rule.min_n, 'FM999,999,999,990')
    else to_char(v_rule.min_n, 'FM999,999,999,990') || '–' || to_char(v_rule.max_n, 'FM999,999,999,990')
  end;

  insert into public.activity_log (actor_id, actor_name, actor_role, message)
  values (
    v_actor.id, v_actor.full_name, v_actor.role,
    format('Changed allowed error for Class %s (%s)', v_rule.accuracy_class, v_range)
  );
end;
$$;

revoke all on function public.submit_report(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.review_report(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.update_allowed_error(text, numeric, uuid) from public, anon, authenticated;
grant execute on function public.submit_report(uuid, uuid, jsonb, text) to service_role;
grant execute on function public.review_report(uuid, uuid, text, text) to service_role;
grant execute on function public.update_allowed_error(text, numeric, uuid) to service_role;
