-- ===========================================================================
-- VeriScale — risk checks
-- Flags that tell reviewers where a submitted report needs a closer look,
-- and the photo fingerprints used to spot the same photo in two reports.
-- Written only by the server (service client); reviewers and admins read.
-- ===========================================================================

create table public.report_checks (
  report_id     uuid primary key references public.reports (id) on delete cascade,
  risk          text not null check (risk in ('low', 'medium', 'high')),
  -- [{ code, severity, title, detail }]
  flags         jsonb not null default '[]'::jsonb,
  photo_reading text not null default 'not_run' check (photo_reading in ('done', 'off', 'failed', 'not_run')),
  checked_at    timestamptz not null default now()
);

create table public.photo_fingerprints (
  photo_id    uuid primary key references public.photos (id) on delete cascade,
  report_id   uuid not null references public.reports (id) on delete cascade,
  fingerprint text not null
);

create index photo_fingerprints_fingerprint_idx on public.photo_fingerprints (fingerprint);

revoke all on public.report_checks, public.photo_fingerprints from anon, authenticated;

alter table public.report_checks enable row level security;
alter table public.photo_fingerprints enable row level security;

grant select on public.report_checks to authenticated;

create policy "report checks: reviewers and admins read" on public.report_checks
  for select to authenticated using (public.current_user_role() in ('reviewer', 'admin'));

-- photo_fingerprints: no grants and no policies — only the server uses it.
