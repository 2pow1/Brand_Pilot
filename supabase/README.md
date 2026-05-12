# Supabase Setup

1. Create a Supabase project.
2. Open the SQL Editor.
3. Run `supabase/schema.sql`.
4. Add server-side environment variables:

```text
DATABASE_PROVIDER=supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
SUPABASE_SCHEMA=public
```

The service role key is for server-side jobs only. Do not expose it in browser code.

For local development, keep:

```text
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./data/brand-pilot.sqlite
```
