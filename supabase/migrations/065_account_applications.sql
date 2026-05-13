-- Trade-account self-registration.
--
-- A logged-out visitor fills the "Open an account" wizard on /create-account.
-- The form data + supporting documents are stored here, status='pending'.
-- Staff review (admin → Applications) and either approve (creating a real auth
-- user via the existing admin tooling) or reject with a note.

create table if not exists public.account_applications (
  id uuid primary key default gen_random_uuid(),

  -- Contact / company
  email text not null,
  company_name text not null,
  contact_name text not null,
  phone text not null,
  company_number text,
  vat_number text,
  trade_type text,

  -- Address
  address1 text,
  city text,
  postcode text,

  -- Preferences
  delivery_regions text[] not null default '{}',

  -- Supporting documents (Storage paths in the 'account-applications' bucket).
  -- Keys: proof_trade, photo_id, proof_address, references
  document_paths jsonb not null default '{}'::jsonb,

  -- Workflow
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_user_id uuid references auth.users(id) on delete set null,

  submitted_at timestamptz not null default now()
);

create index if not exists idx_account_applications_status
  on public.account_applications(status);
create index if not exists idx_account_applications_email_lower
  on public.account_applications(lower(email));

alter table public.account_applications enable row level security;

-- Anyone (including anonymous visitors) can submit. Cannot read or modify.
drop policy if exists "Anyone can submit applications" on public.account_applications;
create policy "Anyone can submit applications"
  on public.account_applications for insert
  to anon, authenticated
  with check (true);

-- Staff can read all applications.
drop policy if exists "Staff read applications" on public.account_applications;
create policy "Staff read applications"
  on public.account_applications for select
  to authenticated
  using (public.is_staff());

-- Staff can update (review / approve / reject) applications.
drop policy if exists "Staff update applications" on public.account_applications;
create policy "Staff update applications"
  on public.account_applications for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Staff can delete (cleanup) applications.
drop policy if exists "Staff delete applications" on public.account_applications;
create policy "Staff delete applications"
  on public.account_applications for delete
  to authenticated
  using (public.is_staff());

-- Storage bucket for supporting documents. Private; staff-readable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'account-applications',
  'account-applications',
  false,
  10485760,  -- 10 MB per file
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anonymous visitors can upload (writing only); cannot read or list.
drop policy if exists "Anon insert application docs" on storage.objects;
create policy "Anon insert application docs"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'account-applications');

-- Staff can read uploaded application docs.
drop policy if exists "Staff read application docs" on storage.objects;
create policy "Staff read application docs"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'account-applications' and public.is_staff());

-- Staff can delete application docs (cleanup with the application row).
drop policy if exists "Staff delete application docs" on storage.objects;
create policy "Staff delete application docs"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'account-applications' and public.is_staff());
