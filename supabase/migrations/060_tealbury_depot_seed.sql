-- Tealbury — Lamtek group brand (tealbury.co.uk). Same Nottinghamshire campus; collection line for portal.
-- Inserts after 059 so legacy Trade Mouldings / extra depots are already normalised to HQ/LC.
insert into public.locations (name, code, address, phone, opening_hours, sort_order)
select v.name, v.code, v.address, v.phone, v.opening_hours, v.sort_order
from (values
  (
    'Tealbury (bespoke kitchens & living)'::text,
    'TB'::text,
    'Laminating Technology Ltd (Tealbury), Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire NG17 7JR'::text,
    ''::text,
    'Made-to-order kitchens and living spaces. Retailer network & enquiries: hello@tealbury.co.uk · tealbury.co.uk'::text,
    2::int
  )
) as v(name, code, address, phone, opening_hours, sort_order)
where not exists (select 1 from public.locations l where l.code = v.code);
