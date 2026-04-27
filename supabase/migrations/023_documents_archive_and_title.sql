-- Documents: allow archiving (old brochures/pricelists) and ensure title is editable display name.
alter table public.documents
  add column if not exists is_archived boolean not null default false;

comment on column public.documents.is_archived is 'When true, document is hidden from main list and shown in archive (e.g. old pricelists).';

create index if not exists idx_documents_is_archived on public.documents(is_archived);

-- Staff can delete documents (for cleanup); optional, uncomment if needed
-- create policy "Staff delete documents" on public.documents for delete to authenticated using (public.is_staff());
