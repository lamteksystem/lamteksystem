-- 079_clean_product_names_and_descriptions.sql
--
-- Tealbury (and earlier) imports stuffed the SKU into the product name and
-- wrapped each description with a redundant "Section: ..." line that already
-- maps onto the product's category. This migration:
--
-- 1. Strips the leading "<sku> — " prefix from the name when the name starts
--    with the SKU's trade code, leaving a clean human-readable name like
--    "PLAIN END PANEL (Dawson)" instead of "ZGCE-18MM9102430PAN — PLAIN END
--    PANEL (Dawson)".
-- 2. Removes the "Section: ..." line from the description (the category
--    column already encodes that). Any other lines ("Item: ...",
--    "Dimensions: ...", "Specification: ...", "Size: ...") are preserved.
-- 3. For "PLAIN END PANEL" items with parseable H/W dimensions, the
--    `Item:` line is augmented with the panel sub-type ("SHOWBACK PANEL",
--    "TOWER PANEL", "WALL PANEL" or "BASE PANEL") so reviewers can tell at
--    a glance what shape of panel they're looking at.
--
-- All three operations are idempotent: re-running this migration on a fully
-- cleaned table is a no-op because the regexes only fire when the legacy
-- pattern is present.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Strip SKU prefix from name.
-- ---------------------------------------------------------------------------
-- Tealbury rows use "<tradeCode> · <sheetName>" as the SKU; the legacy name
-- format is "<tradeCode> — <desc> (<sheetName>)". We strip the leading trade
-- code first, then handle the older Lamtek "<sku> — <stuff>" format.
UPDATE products
SET name = btrim(substring(name FROM char_length(split_part(sku, ' · ', 1)) + 1))
WHERE name LIKE split_part(sku, ' · ', 1) || ' %';

UPDATE products
SET name = btrim(substring(name FROM char_length(sku) + 1))
WHERE name LIKE sku || ' %';

-- Strip any leading separator that survived (em-dash U+2014, en-dash U+2013,
-- ASCII hyphen, plus whitespace). Done via Unicode regex escapes so the file
-- stays ASCII and survives any client transcoding.
UPDATE products
SET name = btrim(regexp_replace(name, '^[\s\u2014\u2013-]+', ''))
WHERE name ~ '^[\s\u2014\u2013-]';

-- Anything reduced to empty (the rare "name == sku" rows) gets the SKU back
-- so we never end up with a NOT NULL violation or a blank label.
UPDATE products
SET name = sku
WHERE name IS NULL OR btrim(name) = '';

-- ---------------------------------------------------------------------------
-- 2. Drop the leading "Section: ..." line from description.
-- ---------------------------------------------------------------------------
-- The pattern is always the first line of the description; remove it plus
-- the trailing newline. Leaves any subsequent "Item:" / "Specification:" /
-- "Dimensions:" / "Size:" lines untouched.
UPDATE products
SET description = regexp_replace(description, '^Section:[^\n]*\n?', '')
WHERE description LIKE 'Section:%';

-- Tidy up any trailing whitespace left after the strip.
UPDATE products
SET description = btrim(description)
WHERE description IS NOT NULL AND description <> btrim(description);

-- ---------------------------------------------------------------------------
-- 3. Augment panel "Item:" lines with the panel sub-type.
-- ---------------------------------------------------------------------------
-- Pull H and W out of the description's "Dimensions:" line and decide which
-- of SHOWBACK / TOWER / WALL / BASE the panel is. Only rewrites items that
-- mention "PLAIN END PANEL" and don't already have a " - <SUBTYPE>" marker.
WITH parsed AS (
  SELECT
    id,
    description,
    NULLIF(substring(description from 'H (\d+)mm'), '')::int AS h,
    NULLIF(substring(description from 'W (\d+)mm'), '')::int AS w
  FROM products
  WHERE description LIKE '%Item: PLAIN END PANEL%'
    AND description !~ 'Item: PLAIN END PANEL\s*-\s*(SHOWBACK|TOWER|TALL|WALL|BASE)'
), classified AS (
  SELECT
    id,
    CASE
      WHEN h IS NULL OR w IS NULL THEN NULL
      -- Showback: tall + wide enough to span a wall/back area.
      WHEN h >= 2000 AND w >= 800 THEN 'SHOWBACK PANEL'
      -- Tower / tall: tall but only cabinet-depth-wide.
      WHEN h >= 2000 AND w BETWEEN 400 AND 799 THEN 'TOWER PANEL'
      -- Wall: short and narrow (wall cabinet depth ~330-400mm).
      WHEN h < 1500 AND w < 500 THEN 'WALL PANEL'
      -- Base: short and wider (base cabinet depth ~570-650mm or wider).
      WHEN h < 1500 AND w >= 500 THEN 'BASE PANEL'
      ELSE NULL
    END AS sub_type
  FROM parsed
)
UPDATE products p
SET description = regexp_replace(
  p.description,
  'Item: PLAIN END PANEL',
  'Item: PLAIN END PANEL - ' || c.sub_type
)
FROM classified c
WHERE p.id = c.id
  AND c.sub_type IS NOT NULL;

COMMIT;
