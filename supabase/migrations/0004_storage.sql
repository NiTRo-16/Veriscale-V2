-- VeriScale V2 — private bucket for report photos.
-- Files live at report-photos/{report_id}/{photo_id}.{ext}. Signed-in users
-- can view them (through short-lived links); only the report's creator can
-- add or remove files, and only while the report is a draft.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create function public.is_own_draft_folder(p_object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reports r
    where r.id::text = (storage.foldername(p_object_name))[1]
      and r.created_by = auth.uid()
      and r.status = 'draft'
  );
$$;

revoke all on function public.is_own_draft_folder(text) from public, anon;
grant execute on function public.is_own_draft_folder(text) to authenticated, service_role;

create policy "report photos: signed-in users view" on storage.objects
  for select to authenticated
  using (bucket_id = 'report-photos');

create policy "report photos: creator uploads to own draft" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'report-photos' and public.is_own_draft_folder(name));

create policy "report photos: creator removes from own draft" on storage.objects
  for delete to authenticated
  using (bucket_id = 'report-photos' and public.is_own_draft_folder(name));
