# Supabase connection setup

The Supabase clients are an isolated connection foundation. Existing Express API calls and authentication behavior remain unchanged. No Supabase project, schema, or credentials are included in this repository.

## Environment variables

Copy `.env.example` to `.env.local` in `knotty-app` and set:

- `NEXT_PUBLIC_SUPABASE_URL`: project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key for browser and cookie-backed server clients. Existing projects may temporarily use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead.
- `SUPABASE_SERVICE_ROLE_KEY`: optional server-only credential for explicitly trusted administrative operations. Do not prefix it with `NEXT_PUBLIC_`, expose it to browser code, or use the admin client for normal user requests.

The client factories validate configuration only when called. `checkSupabaseConfiguration()` in `lib/supabase/env.ts` checks configuration without contacting Supabase, so a production build does not require project credentials. It returns missing variable names and validation errors, never key values.

## Client usage

- Import `createClient` from `lib/supabase/client` inside Client Components.
- Import `createClient` from `lib/supabase/server` in Server Components, Server Actions, and Route Handlers. It uses the Next.js async cookie store; cookie writes that are unavailable in Server Components are safely ignored.
- Import `createAdminClient` from `lib/supabase/admin` only inside trusted server code. The `server-only` marker prevents importing it into a Client Component or browser bundle. The factory does not create a client until called and requires the optional server key.

`lib/supabase/database.types.ts` is an intentionally empty typed schema placeholder until reviewed database migrations exist. Regenerate it from the approved schema before using table queries. This setup does not add session refresh/proxy behavior or change AuthContext; those belong to the later authentication milestone.

References: [Supabase SSR client setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client) and [Supabase Next.js quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs).

## Local Supabase development

The local project configuration is at repository root in `supabase/config.toml`. The official Supabase CLI is pinned as a development dependency; install it with `npm install` in `knotty-app`. Use Node.js 22 or newer for the current Supabase JavaScript packages. Running the full local Supabase stack requires Docker Desktop (on Windows, with its container engine running) and enough disk space for the service images. Local services use PostgreSQL 17. No hosted project is linked by this setup.

From the repository root, use:

```powershell
npm --prefix knotty-app run supabase:start
npm --prefix knotty-app run supabase:status
npm --prefix knotty-app run supabase:test
npm --prefix knotty-app run supabase:stop
npm --prefix knotty-app run supabase:reset
```

`supabase:start` starts only the local stack. `supabase:status` reports local service state. `supabase:stop` stops containers but preserves their local database volume. `supabase:reset` runs `db reset --local`, applying local migrations and recreating the local database, deleting its local data; use it only when that reset is intended. Do not link this project or pass a hosted database URL to local commands. New installations need Docker running before start/test.

### Migration workflow

Use timestamped imperative SQL migrations in `supabase/migrations/`. Create each new file with the CLI, then review it before running it:

```powershell
npm --prefix knotty-app run supabase:migration:new -- <short_snake_case_description>
```

Commit reviewed migration SQL with its tests. Do not apply exploratory SQL to a hosted database and turn the result into a migration later. The migrations directory is intentionally empty today; no application tables or seed data have been created. Local seeding is disabled until a separately reviewed seed plan exists.

### Database smoke test

`supabase/tests/database/000_local_environment_test.sql` uses pgTAP through `supabase test db`. It checks the local database name, PostgreSQL version and availability of pgTAP and pgcrypto. It creates no application objects and rolls back its test transaction. Run the test only against the local stack:

```powershell
npm --prefix knotty-app run supabase:test
```

The repository ignores Supabase CLI state, local secrets and database data directories while keeping reviewed config, migrations, tests and function source under version control. Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with the key emitted by the local CLI when you later configure the frontend; do not put a secret/admin key in a `NEXT_PUBLIC_` variable.
