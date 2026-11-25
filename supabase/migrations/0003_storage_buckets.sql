-- Busi Rx Private Document Storage Bucket & RLS Policies (Supabase Storage)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'busirx-private-docs',
  'busirx-private-docs',
  false,
  20971520,
  array['application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

create policy "busirx_docs_owner_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'busirx-private-docs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "busirx_docs_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'busirx-private-docs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "busirx_docs_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'busirx-private-docs'
  and (storage.foldername(name))[1] = auth.uid()::text
);
