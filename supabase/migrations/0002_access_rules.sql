-- VeriScale V2 — who can read and write what.
-- Supabase grants every role full access to new tables in `public` by
-- default; take that away, then grant back only what each role needs.
-- Row-level policies then narrow it to the right rows.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.allowed_error_rules enable row level security;
alter table public.report_counters enable row level security;
alter table public.reports enable row level security;
alter table public.readings enable row level security;
alter table public.photos enable row level security;
alter table public.activity_log enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies can look things up without recursion)
-- ---------------------------------------------------------------------------
create function public.current_user_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.is_own_draft(p_report_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reports r
    where r.id = p_report_id and r.created_by = auth.uid() and r.status = 'draft'
  );
$$;

revoke all on function public.current_user_role() from public, anon;
revoke all on function public.is_own_draft(uuid) from public, anon;
grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.is_own_draft(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Table privileges for signed-in users (anon gets nothing)
-- ---------------------------------------------------------------------------
grant select on public.profiles, public.allowed_error_rules, public.reports,
  public.readings, public.photos, public.activity_log to authenticated;

grant update (
  manufacturer, model, serial_number, accuracy_class, max_capacity_kg, interval_e_g,
  indicator_type, power_source, test_stage, test_date,
  temperature_c, temperature_source, humidity_pct, humidity_source, voltage_v, weather_confirmed,
  reference_weights, remarks
) on public.reports to authenticated;

-- id/report_id are updatable only so upserts work; the guard trigger rejects any real change.
grant insert (id, report_id, test_type, clause, load_kg, reference_kg, indicated_kg, position)
  on public.readings to authenticated;
grant update (id, report_id, test_type, clause, load_kg, reference_kg, indicated_kg, position)
  on public.readings to authenticated;
grant delete on public.readings to authenticated;

grant insert (id, report_id, reading_id, kind, storage_path, taken_at, uploaded_by)
  on public.photos to authenticated;
grant delete on public.photos to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level policies
-- ---------------------------------------------------------------------------
create policy "profiles: signed-in users read" on public.profiles
  for select to authenticated using (true);

create policy "rules: signed-in users read" on public.allowed_error_rules
  for select to authenticated using (true);

create policy "reports: signed-in users read all" on public.reports
  for select to authenticated using (true);

create policy "reports: creator edits own draft" on public.reports
  for update to authenticated
  using (created_by = auth.uid() and status = 'draft')
  with check (created_by = auth.uid() and status = 'draft');

create policy "readings: signed-in users read" on public.readings
  for select to authenticated using (true);

create policy "readings: creator adds to own draft" on public.readings
  for insert to authenticated with check (public.is_own_draft(report_id));

create policy "readings: creator changes own draft" on public.readings
  for update to authenticated
  using (public.is_own_draft(report_id))
  with check (public.is_own_draft(report_id));

create policy "readings: creator removes from own draft" on public.readings
  for delete to authenticated using (public.is_own_draft(report_id));

create policy "photos: signed-in users read" on public.photos
  for select to authenticated using (true);

create policy "photos: creator adds to own draft" on public.photos
  for insert to authenticated
  with check (public.is_own_draft(report_id) and uploaded_by = auth.uid());

create policy "photos: creator removes from own draft" on public.photos
  for delete to authenticated using (public.is_own_draft(report_id));

create policy "activity log: admins read" on public.activity_log
  for select to authenticated using (public.current_user_role() = 'admin');

-- report_counters: no policies and no grants — only the numbering trigger uses it.
