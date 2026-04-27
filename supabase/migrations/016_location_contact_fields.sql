-- Contact details for depots (from trademouldings.com/contact-us)
alter table public.locations
  add column if not exists phone text,
  add column if not exists opening_hours text;

comment on column public.locations.phone is 'Depot phone number.';
comment on column public.locations.opening_hours is 'e.g. Mon-Thu 8.30-5.00, Fri 8.30-4.00';

-- Allow idempotent depot seed by code (unique constraint for ON CONFLICT)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'locations_code_key' and conrelid = 'public.locations'::regclass) then
    alter table public.locations add constraint locations_code_key unique (code);
  end if;
end $$;

-- Customers can read active depots (for Depots/Contact page)
create policy "Authenticated read active locations"
  on public.locations for select to authenticated
  using (active = true);
