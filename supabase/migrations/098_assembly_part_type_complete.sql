-- Add "Complete" as a built-in BOM part type for complete-unit breakdowns.
-- Used when a component line represents the finished unit / carcass assembly.

insert into public.assembly_part_types (code, label, sort_order, active, is_system)
values ('complete', 'Complete', 5, true, true)
on conflict (code) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_system = true,
  active = true,
  updated_at = now();
