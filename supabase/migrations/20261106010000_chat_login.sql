-- Вход без приложения Twitch: код в чате канала → сессия сайта.
-- Мост (overlay.html в OBS) анонимно читает чат и сообщает серверу коды и покупки награды.

create table public.logins (
  id          uuid primary key default gen_random_uuid(),
  login       text not null,
  code        text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '10 minutes',
  verified_at timestamptz,
  twitch_id   text,
  token       text            -- сессия, которую сайт заберёт один раз
);
create index logins_pending_idx on public.logins (login) where verified_at is null;

create table public.sessions (
  token_hash text primary key,  -- sha256 от токена, сам токен в базе не храним
  twitch_id  text not null references public.profiles on delete cascade,
  login      text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 days'
);
create index sessions_user_idx on public.sessions (twitch_id);

alter table public.logins   enable row level security;
alter table public.sessions enable row level security;
-- без политик: только через функции

-- когда мост последний раз выходил на связь (показываем на сайте, работает ли вход)
alter table public.settings add column bridge_seen_at timestamptz;
-- после подписки по API награду ищем по id из тегов чата; привязывает её сам стример
comment on column public.settings.reward_id is 'id награды «Звёздный пак» (из тега custom-reward-id в чате)';
