-- Удержание зрителей: пакетик за просмотр стрима, звездопад от стримера, подарки НЛО.
alter table public.settings
  add column if not exists watch_minutes int not null default 30,  -- минут просмотра за пакетик
  add column if not exists watch_daily   int not null default 4;   -- максимум пакетиков за просмотр в сутки

alter table public.profiles
  add column if not exists watch_sec   int not null default 0,     -- накоплено секунд к следующему пакетику
  add column if not exists watch_last  timestamptz,                -- последний «я смотрю» с сайта
  add column if not exists watch_day   date,
  add column if not exists watch_today int not null default 0,     -- пакетиков за просмотр сегодня
  add column if not exists ufo_last    timestamptz;                -- когда последний раз поймал НЛО

-- звездопад: стример запускает, зрители на сайте ловят звезду
create table if not exists public.drops (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  until timestamptz not null,
  packs int not null default 1
);
alter table public.drops enable row level security;
create policy "drops: читать" on public.drops for select using (true);

create table if not exists public.drop_claims (
  drop_id bigint not null references public.drops(id) on delete cascade,
  twitch_id text not null,
  created_at timestamptz not null default now(),
  primary key (drop_id, twitch_id)
);
alter table public.drop_claims enable row level security; -- без политик: пишет только сервер
