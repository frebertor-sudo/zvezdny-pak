-- Прямые покупки наград за баллы (EventSub): без поля для текста в награде.
-- Токен «читать покупки наград» каждого канала получаем через twitchtokengenerator.com (своего приложения Twitch нет).
create table if not exists public.twitch_links (
  channel    text primary key,
  user_id    text not null,
  token      text not null,
  refresh    text not null,
  client_id  text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.twitch_links enable row level security; -- без политик: только сервер

create table if not exists public.twitch_pending (
  id text primary key,
  created_at timestamptz not null default now()
);
alter table public.twitch_pending enable row level security;

alter table public.settings add column if not exists direct jsonb not null default '{}'::jsonb; -- какие каналы подключены напрямую (для панели)
