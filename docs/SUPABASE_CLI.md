# Supabase CLI notes

## Why `npm run supabase:status` fails (Docker)

`supabase status` is meant for **local development**. It talks to Docker on your machine to show the status of a **local** Supabase stack (Postgres, Auth, etc. running in containers).

If you're only using a **remote** Supabase project (linked with `supabase link --project-ref ...`), you don't have those containers. So the command fails with something like:

- `failed to inspect container health`
- `the docker client must be run with elevated privileges`
- `open //./pipe/docker_engine: The system cannot find the file specified`

That's expected. You don't need `supabase status` when working against the hosted project. Use:

- **`npm run db:migrate`** (or `supabase db push`) to apply migrations to the remote DB.
- The [Supabase Dashboard](https://supabase.com/dashboard) to inspect the project, tables, and logs.

If you ever run Supabase **locally** with `supabase start`, then `supabase status` will work and show local URLs.
