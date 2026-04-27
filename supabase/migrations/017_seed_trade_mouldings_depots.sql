-- Seed Trade Mouldings depots (from https://trademouldings.com/contact-us/)
-- Rochdale (Head Office), Cookstown (N. Ireland), Dublin (ROI). Idempotent: insert only when code missing.
insert into public.locations (name, code, address, phone, opening_hours, sort_order)
select v.name, v.code, v.address, v.phone, v.opening_hours, v.sort_order
from (values
  ('Rochdale (Head Office)'::text, 'ROC'::text, 'Unit N1, Kingsway Business Park, Michael Faraday Avenue, Rochdale, Lancashire OL16 4GR'::text, '+44 (0)1706 753600'::text, 'Mon–Thu: 8.30–5.00pm, Fri: 8.30–4.00pm'::text, 0::int),
  ('Cookstown (Northern Ireland)'::text, 'COOK'::text, 'Cookstown Business Park, Sandholes Road, Cookstown, County Tyrone, Northern Ireland BT80 9AR'::text, '+44 (0)28 867 62993'::text, 'Mon–Thu: 8.30–5.00pm, Fri: 8.30–4.30pm'::text, 1::int),
  ('Dublin'::text, 'DUB'::text, 'Unit A1, Bluebell Industrial Estate, Bluebell Avenue, Dublin 12'::text, '+353 (0)1 460 3030'::text, 'Mon–Fri: 8.30–5.30pm'::text, 2::int)
) as v(name, code, address, phone, opening_hours, sort_order)
where not exists (select 1 from public.locations l where l.code = v.code);
