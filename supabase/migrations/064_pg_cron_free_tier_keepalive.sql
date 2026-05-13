-- Keep the hosted Postgres instance active on free-tier projects: periodic trivial query
-- via Supabase Cron (pg_cron). Official pattern: https://supabase.com/docs/guides/cron
--
-- Schedule: every 12 hours UTC (adjust with cron.alter_job if you prefer).
-- If `create extension` fails on first push, enable **Integrations → Cron** in the Supabase
-- Dashboard (which enables pg_cron), then run `db push` again.

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Upsert by job name (same name replaces an existing job).
select cron.schedule(
  'lamtek_free_tier_keepalive',
  '0 */12 * * *',
  'select 1'
);
