-- Allow customers to update their own profile (company_name, contact_name).
-- Balance and other fields can still be updated by staff via existing Staff policies.

create policy "Users update own profile" on public.customer_profiles
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
