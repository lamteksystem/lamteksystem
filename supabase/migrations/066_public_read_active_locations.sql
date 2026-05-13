-- Marketing site (anonymous visitors) shows head-office contact + group depots.
-- Lamtek already publishes this on lamtek.co.uk, so allow public reads of active
-- locations to keep the marketing site in sync with admin → Locations edits.

drop policy if exists "Authenticated read active locations" on public.locations;

create policy "Public read active locations"
  on public.locations for select
  to anon, authenticated
  using (active = true);
