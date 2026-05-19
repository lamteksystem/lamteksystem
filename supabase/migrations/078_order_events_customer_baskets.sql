-- Customers can read and append basket audit events on their own orders.
create policy "Users select own order_events"
  on public.order_events for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_events.order_id and o.user_id = auth.uid()
    )
  );

create policy "Users insert own order_events"
  on public.order_events for insert to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_events.order_id and o.user_id = auth.uid()
    )
  );
