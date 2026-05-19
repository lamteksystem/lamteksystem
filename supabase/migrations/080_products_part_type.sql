-- 080_products_part_type.sql
--
-- Adds a first-class "part type" concept to the products table itself.
--
-- Why: until now `assembly_part_types.code` only lived on `assembly_lines`
-- ("this product plays role X *inside this particular complete unit*").
-- That worked for Tealbury complete units (which explode into a carcass +
-- door + hinges + ... assembly), but the catalogue also carries products
-- that are *themselves* a single part — Panels, Plinth, Cornice/Pelmet,
-- Mouldings, Posts, Hinges, Handles, etc. Those have no assembly of their
-- own, yet admins still need to mark them as "this product IS a panel" so
-- stock take, auto-reorder and reporting can treat them as parts.
--
-- After this migration the contract is:
--
--   - `products.part_type` IS NULL
--       -> uncategorised / not classified yet (loose stock or made-to-measure)
--   - `products.part_type` set AND no `assemblies` row for the product
--       -> the product itself IS a single part of that type
--   - `assemblies` row exists for the product
--       -> the product is a complete unit assembled FROM other parts; each
--          assembly_line.component_role describes the role of each part
--
-- The two modes are mutually exclusive in the UI but the database lets you
-- have both (we don't FK-block it) — the modal explicitly nulls out one
-- side when switching to the other, so we keep the schema flexible for
-- edge cases (e.g. a panel that's *also* a kit with its own brackets).

BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS part_type text REFERENCES public.assembly_part_types(code);

CREATE INDEX IF NOT EXISTS idx_products_part_type
  ON public.products(part_type)
  WHERE part_type IS NOT NULL;

COMMENT ON COLUMN public.products.part_type IS
  'When set, the product itself IS a single part of this type (panel, plinth, hinge, etc.). NULL means the product is either a complete unit (see assemblies) or unclassified.';

COMMIT;
