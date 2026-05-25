alter table public.channel_outputs
  add column if not exists backup_status text not null default '';

alter table public.channel_outputs
  add column if not exists backup_completed_at timestamptz;

alter table public.channel_outputs
  add column if not exists backup_payload_json jsonb not null default '{}'::jsonb;

alter table public.channel_outputs
  add column if not exists backup_error text not null default '';
