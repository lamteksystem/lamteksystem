-- 081_orders_range_finish.sql
--
-- Adds the three structured fields the new order-start wizard captures:
--
--   * `kitchen_range_id` — FK to the `categories` row whose category_kind
--     is 'door_range' (Dawson, Oakham, Norwood, Cleveland, …). The chosen
--     range scopes every subsequent product look-up.
--   * `door_finish` — the finish of the chosen range (e.g. "Soft Matte",
--     "Painted Colour", "Gloss White"). Stored as text because the finish
--     vocabulary still lives inside `products.options.*_finish_prices_gbp`
--     keys and adding a normalised lookup table would be premature.
--   * `carcass_finish` — the cabinet/carcass colour (white / oak / grey /
--     custom). Also free-text for now; a small enum is enforced in the UI
--     and we promote it to a lookup table once the marketing team has
--     decided on the canonical SKUs.
--
-- All three are NULL-able so existing draft orders aren't disturbed and so
-- legacy flows (Tealbury search, Lamtek search) keep working unchanged.
-- Once the wizard ships, every freshly-created basket will have these
-- populated before the workbench opens.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS kitchen_range_id uuid REFERENCES public.categories(id),
  ADD COLUMN IF NOT EXISTS door_finish text,
  ADD COLUMN IF NOT EXISTS carcass_finish text;

CREATE INDEX IF NOT EXISTS idx_orders_kitchen_range_id
  ON public.orders(kitchen_range_id)
  WHERE kitchen_range_id IS NOT NULL;

COMMENT ON COLUMN public.orders.kitchen_range_id IS
  'Selected kitchen door range for this order (categories row with category_kind=''door_range'').';
COMMENT ON COLUMN public.orders.door_finish IS
  'Chosen finish of the door range (e.g. "Soft Matte", "Painted Colour", "Gloss White"). Matches a key in products.options.*_finish_prices_gbp for the same range.';
COMMENT ON COLUMN public.orders.carcass_finish IS
  'Chosen carcass/cabinet finish (typically white / light oak / grey). Free text for now.';

COMMIT;
