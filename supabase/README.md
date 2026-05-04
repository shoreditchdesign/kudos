# Supabase

Single Postgres table. No Auth, no RLS, no Storage, no Edge Functions.

## Apply migrations

```bash
supabase link --project-ref <project-ref>
supabase db push
```

`0001_wins.sql` is the only migration. It creates the `wins` table with two indexes and two CHECK constraints.

## Why no RLS

The `wins` table is only ever read or written by server code in the Next.js app, using `SUPABASE_SERVICE_ROLE_KEY`. The browser never holds a Supabase client. If that ever changes, enable RLS and add policies before exposing the database — see `docs/master-architecture.md` §5.
