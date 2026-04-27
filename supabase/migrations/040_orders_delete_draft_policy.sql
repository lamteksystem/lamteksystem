-- Allow customers to delete their own draft orders (used for basket management).
-- We restrict deletion to status='draft' so placed/invoiced history remains immutable.

drop policy if exists "Users delete own draft orders" on public.orders;
create policy "Users delete own draft orders"
  on public.orders for delete to authenticated
  using (auth.uid() = user_id and status = 'draft');

