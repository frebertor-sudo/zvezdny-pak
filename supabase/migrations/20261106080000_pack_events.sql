-- Сигнал сайту «зрителю начислены пакетики»: сайт опрашивает по своему нику и сразу обновляет счётчик.
create table if not exists public.pack_events (
  id bigserial primary key,
  login text not null,
  n int not null default 1,
  source text not null default 'reward', -- reward | grant
  created_at timestamptz not null default now()
);
create index if not exists pack_events_login_id on public.pack_events (login, id);
alter table public.pack_events enable row level security;
create policy "pack_events: читать" on public.pack_events for select using (true);
