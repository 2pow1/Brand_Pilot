# Supabase Setup

1. Create a Supabase project.
2. Open the SQL Editor.
3. Run `supabase/schema.sql`.
4. Run `supabase/storage.sql` to create the public Instagram artifact bucket.
5. Run `supabase/notion.sql` if `schema.sql` was already applied before the Notion columns were added.
6. Run `supabase/publish-lock.sql` if `schema.sql` was already applied before publish lock columns were added.
7. Run `supabase/notion-artifact-backup.sql` if `schema.sql` was already applied before Notion artifact backup columns were added.
8. Add server-side environment variables:

```text
DATABASE_PROVIDER=supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
SUPABASE_SCHEMA=public
SUPABASE_STORAGE_BUCKET=brand-pilot-instagram
DISCORD_PUBLIC_KEY=<discord-application-public-key>
NOTION_TOKEN=<notion-internal-integration-token>
NOTION_DATA_SOURCE_ID=<notion-data-source-id>
```

The service role key is for server-side jobs only. Do not expose it in browser code.

Deploy the Discord review function after setting the secrets:

```powershell
npx supabase secrets set DISCORD_PUBLIC_KEY=<discord-application-public-key> --project-ref <project-ref>
npx supabase functions deploy discord-review --no-verify-jwt --project-ref <project-ref> --use-api
```

`supabase/config.toml` disables Supabase JWT verification for `discord-review` because Discord calls this endpoint directly. The function still verifies Discord's Ed25519 signature before it changes content state.

The Supabase Edge Function runtime provides the reserved `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` values. The CLI may skip `SUPABASE_` names when reading `.env`; that is expected.

Use the deployed function URL as the Discord Interactions Endpoint URL.

For local development, keep:

```text
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./data/brand-pilot.sqlite
```

For free-first scheduled operation, add the same production values as GitHub repository secrets and enable `.github/workflows/brand-pilot-schedule.yml`.

Instagram publishing also needs public image URLs. Run `instagram upload` after `instagram render` to upload local PNG files and the manifest to the public Storage bucket before `instagram publish`.

Notion artifact backup imports those public Storage files into Notion-hosted files. Run `notion sync` first so each content item has a Notion page, then run `notion backup`.
