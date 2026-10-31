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
