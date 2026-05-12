alter table public.content_items
  add column if not exists notion_page_id text not null default '';

alter table public.content_items
  add column if not exists notion_synced_at timestamptz;
