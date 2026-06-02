-- Composed configuration code for a quoted/ordered unit, e.g. 1000-HL-BASE-WHI-DAW-WHI.
-- Built at add-to-order time from the order's setup (range, finishes, build style)
-- and the product/assembly (size, type). Immutable record of what was quoted,
-- alongside product_snapshot. Distinct from combination_label (a free-text quote
-- grouping like "Kitchen main").

alter table public.order_lines
  add column if not exists composed_code text;

comment on column public.order_lines.composed_code is
  'Composed configuration code for the configured unit (e.g. 1000-HL-BASE-WHI-DAW-WHI). Set at add-to-order time; components of one complete unit share the unit code.';
