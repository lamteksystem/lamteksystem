-- Staff-only wrapper so balance can be recomputed from transactions without exposing raw recalc to all roles.

create or replace function public.staff_recalc_customer_balance(p_customer_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can recalculate customer balance';
  end if;
  perform public.recalc_customer_balance(p_customer_user_id);
end;
$$;

grant execute on function public.staff_recalc_customer_balance(uuid) to authenticated;

comment on function public.staff_recalc_customer_balance(uuid)
  is 'Recomputes customer_profiles.balance_outstanding from account_transactions; staff only.';
