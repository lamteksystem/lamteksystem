-- Smart categorise: editable per-band metadata.
--
-- Confidence bands are already editable via min_score / medium_threshold /
-- high_threshold (see migration 076). This migration adds the bits an admin
-- typically wants to tune alongside the threshold itself:
--   * label — the chip text shown next to a suggestion (defaults: Low/Medium/High)
--   * description — admin-authored help text rendered in tooltips and on the
--     Settings page (so teams can document their own policy: "Medium = review
--     before applying", "High = safe to bulk apply on Friday").
--   * auto_apply — whether the band is allowed in bulk "Apply confident"
--     actions. Off by default for Low, on for Medium/High.
alter table public.smart_category_settings
  add column if not exists low_label text not null default 'Low',
  add column if not exists medium_label text not null default 'Medium',
  add column if not exists high_label text not null default 'High',
  add column if not exists low_description text not null
    default 'Weak signal — usually needs manual correction.',
  add column if not exists medium_description text not null
    default 'Plausible match — review before applying.',
  add column if not exists high_description text not null
    default 'Strong word/phrase overlap — safe to apply in bulk.',
  add column if not exists low_auto_apply boolean not null default false,
  add column if not exists medium_auto_apply boolean not null default true,
  add column if not exists high_auto_apply boolean not null default true;
