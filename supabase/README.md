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
DISCORD_PUBLIC_KEY=<discord-application-public-key>
```

The service role key is for server-side jobs only. Do not expose it in browser code.

Deploy the Discord review function after setting the secrets:

```powershell
supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
supabase secrets set DISCORD_PUBLIC_KEY=<discord-application-public-key>
supabase functions deploy discord-review
```

Use the deployed function URL as the Discord Interactions Endpoint URL.

For local development, keep:

```text
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./data/brand-pilot.sqlite
```

For free-first scheduled operation, add the same production values as GitHub repository secrets and enable `.github/workflows/brand-pilot-schedule.yml`.

Instagram publishing also needs public image URLs. The current `instagram publish` command can publish when the channel artifact manifest or payload includes public slide URLs; local render files must be uploaded to public storage first.
