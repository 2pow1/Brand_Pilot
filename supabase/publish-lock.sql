alter table public.channel_outputs
  add column if not exists next_retry_at timestamptz;

alter table public.channel_outputs
  add column if not exists locked_until timestamptz;

create index if not exists idx_channel_outputs_publish_queue
  on public.channel_outputs(status, next_retry_at, locked_until);
