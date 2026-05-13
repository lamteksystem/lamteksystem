-- Lamtek Ltd HQ + Lamtek Complete (Kirkby-in-Ashfield). Official Lamtek contact: https://www.lamtek.co.uk/contact
-- Idempotent: insert only when code missing.

insert into public.locations (name, code, address, phone, opening_hours, sort_order)
select v.name, v.code, v.address, v.phone, v.opening_hours, v.sort_order
from (values
  (
    'Kirkby-in-Ashfield (Head Office)'::text,
    'HQ'::text,
    'Lamtek Ltd, Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire NG17 7JR'::text,
    '01623 759 856'::text,
    'Opening: Mon–Fri 7:15–16:30. Loading: Mon–Thu 7:15–15:45, Fri 7:15–12:45.'::text,
    0::int
  ),
  (
    'Lamtek Complete (trade kitchens)'::text,
    'LC'::text,
    'Laminating Technology Ltd, Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire NG17 7JR'::text,
    '01543 466454'::text,
    'Trade kitchens and doors to the trade. Loading by arrangement — see lamtekcomplete.co.uk.'::text,
    1::int
  ),
  (
    'Tealbury (bespoke kitchens & living)'::text,
    'TB'::text,
    'Laminating Technology Ltd (Tealbury), Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire NG17 7JR'::text,
    ''::text,
    'Made-to-order kitchens and living spaces. hello@tealbury.co.uk · tealbury.co.uk'::text,
    2::int
  )
) as v(name, code, address, phone, opening_hours, sort_order)
where not exists (select 1 from public.locations l where l.code = v.code);
