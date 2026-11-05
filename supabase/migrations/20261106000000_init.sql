-- «Звёздный пак»: схема базы.
-- Вся запись идёт только через edge-функции (service role) — у анонимного ключа права только на чтение публичного.

-- ---------- настройки набора (одна строка) ----------
create table public.settings (
  id             int primary key default 1 check (id = 1),
  odds           jsonb   not null default '{"common":50,"rare":30,"epic":15,"legendary":5}',
  foil           numeric not null default 12 check (foil between 0 and 100),   -- шанс холо, %
  pity           int     not null default 10 check (pity between 2 and 100),   -- гарантия эпической
  cost           int     not null default 5000 check (cost > 0),              -- цена награды в баллах канала
  broadcaster_id text,
  reward_id      text,
  eventsub_id    text,
  updated_at     timestamptz not null default now()
);
insert into public.settings default values;

-- ---------- карточки ----------
create table public.cards (
  id         text primary key,
  sort       int  not null default 0,
  name       text not null check (char_length(name) between 1 and 40),
  flavor     text not null default '' check (char_length(flavor) <= 120),
  rarity     text not null check (rarity in ('common','rare','epic','legendary')),
  img        text not null,
  tall       boolean not null default true,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- зрители (по Twitch user id) ----------
create table public.profiles (
  twitch_id  text primary key,
  login      text not null,
  name       text,
  avatar     text,
  packs      int  not null default 0 check (packs >= 0),   -- неоткрытые пакетики (за награду на Twitch)
  dust       int  not null default 0 check (dust >= 0),
  pulls      int  not null default 0,
  since      int  not null default 0,                       -- паков без эпической (для гарантии)
  dupes      int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_login_idx on public.profiles (login);

-- ---------- коллекции ----------
create table public.owned (
  twitch_id text not null references public.profiles on delete cascade,
  card_id   text not null references public.cards on delete cascade,
  foil      boolean not null default false,
  count     int not null default 1 check (count >= 1),
  first_at  timestamptz not null default now(),
  primary key (twitch_id, card_id, foil)
);
create index owned_card_idx on public.owned (card_id);

-- ---------- лента выпадений (публичная) ----------
create table public.pulls (
  id         bigint generated always as identity primary key,
  twitch_id  text not null,
  login      text not null,
  name       text,
  card_id    text not null,
  rarity     text not null,
  foil       boolean not null,
  dupe       boolean not null,
  created_at timestamptz not null default now()
);

-- ---------- принятые награды (защита от повторов EventSub) ----------
create table public.redemptions (
  id         text primary key,
  twitch_id  text not null,
  created_at timestamptz not null default now()
);

-- ---------- доступ ----------
alter table public.settings    enable row level security;
alter table public.cards       enable row level security;
alter table public.profiles    enable row level security;
alter table public.owned       enable row level security;
alter table public.pulls       enable row level security;
alter table public.redemptions enable row level security;

create policy "cards: читать активные" on public.cards    for select using (active);
create policy "settings: читать"       on public.settings for select using (true);
create policy "pulls: читать ленту"    on public.pulls    for select using (true);
-- profiles, owned, redemptions — без политик: только через функции

-- ---------- картинки карточек ----------
insert into storage.buckets (id, name, public) values ('cards', 'cards', true)
  on conflict (id) do nothing;

-- ---------- открыть пакетик: всё в одной транзакции ----------
create or replace function public.open_pack(p_uid text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s settings; p profiles; c cards;
  rs text[]; hi text[]; r text; total numeric; x numeric;
  is_foil boolean; is_dupe boolean; gain int;
  dust_map constant jsonb := '{"common":10,"rare":25,"epic":100,"legendary":400}';
begin
  select * into s from settings where id = 1;
  select * into p from profiles where twitch_id = p_uid for update;
  if not found then raise exception 'no_profile'; end if;
  if p.packs < 1 then raise exception 'no_packs'; end if;

  -- редкости, у которых есть карточки и ненулевой шанс
  select array_agg(distinct cd.rarity) into rs
    from cards cd where cd.active and coalesce((s.odds ->> cd.rarity)::numeric, 0) > 0;
  if rs is null then
    select array_agg(distinct cd.rarity) into rs from cards cd where cd.active;
  end if;
  if rs is null then raise exception 'no_cards'; end if;

  -- гарантия: на последнем паке серии — только эпическая или легендарная
  if p.since >= s.pity - 1 then
    select array_agg(v) into hi from unnest(rs) v where v in ('epic', 'legendary');
    if hi is not null then rs := hi; end if;
  end if;

  select sum(greatest(coalesce((s.odds ->> v)::numeric, 0), 0.0001)) into total from unnest(rs) v;
  x := random() * total;
  foreach r in array rs loop
    x := x - greatest(coalesce((s.odds ->> r)::numeric, 0), 0.0001);
    exit when x <= 0;
  end loop;

  select * into c from cards where active and rarity = r order by random() limit 1;
  is_foil := random() * 100 < s.foil;

  insert into owned (twitch_id, card_id, foil, count) values (p_uid, c.id, is_foil, 1)
    on conflict (twitch_id, card_id, foil) do update set count = owned.count + 1
    returning (xmax <> 0) into is_dupe;

  gain := case when is_dupe then (dust_map ->> c.rarity)::int * (case when is_foil then 2 else 1 end) else 0 end;

  update profiles set
    packs = packs - 1,
    pulls = pulls + 1,
    since = case when c.rarity in ('epic', 'legendary') then 0 else since + 1 end,
    dust  = dust + gain,
    dupes = dupes + (case when is_dupe then 1 else 0 end),
    updated_at = now()
  where twitch_id = p_uid;

  insert into pulls (twitch_id, login, name, card_id, rarity, foil, dupe)
    values (p_uid, p.login, p.name, c.id, c.rarity, is_foil, is_dupe);

  return jsonb_build_object('card_id', c.id, 'foil', is_foil, 'dupe', is_dupe, 'dust_gain', gain);
end $$;

-- ---------- создать недостающую карточку из пыльцы ----------
create or replace function public.craft_card(p_uid text, p_card text, p_foil boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c cards; p profiles; price int;
  craft_map constant jsonb := '{"common":60,"rare":150,"epic":500,"legendary":1600}';
begin
  select * into c from cards where id = p_card and active;
  if not found then raise exception 'no_card'; end if;
  select * into p from profiles where twitch_id = p_uid for update;
  if not found then raise exception 'no_profile'; end if;
  if exists (select 1 from owned where twitch_id = p_uid and card_id = p_card and foil = p_foil) then
    raise exception 'already_owned';
  end if;
  price := (craft_map ->> c.rarity)::int * (case when p_foil then 3 else 1 end);
  if p.dust < price then raise exception 'not_enough_dust'; end if;
  update profiles set dust = dust - price, updated_at = now() where twitch_id = p_uid;
  insert into owned (twitch_id, card_id, foil, count) values (p_uid, p_card, p_foil, 1);
  return jsonb_build_object('card_id', p_card, 'foil', p_foil, 'spent', price);
end $$;

-- ---------- начислить пакетики (награда на Twitch или выдача стримером) ----------
create or replace function public.add_packs(p_uid text, p_login text, p_name text, p_n int)
returns int language plpgsql security definer set search_path = public as $$
declare left_packs int;
begin
  insert into profiles (twitch_id, login, name, packs) values (p_uid, lower(p_login), p_name, greatest(p_n, 0))
    on conflict (twitch_id) do update
      set packs = profiles.packs + greatest(p_n, 0), login = excluded.login,
          name = coalesce(excluded.name, profiles.name), updated_at = now()
    returning packs into left_packs;
  return left_packs;
end $$;

revoke execute on function public.open_pack(text)                 from public, anon, authenticated;
revoke execute on function public.craft_card(text, text, boolean) from public, anon, authenticated;
revoke execute on function public.add_packs(text, text, text, int) from public, anon, authenticated;
grant  execute on function public.open_pack(text)                 to service_role;
grant  execute on function public.craft_card(text, text, boolean) to service_role;
grant  execute on function public.add_packs(text, text, text, int) to service_role;

-- ---------- стартовый набор: арты лежат на сайте ----------
insert into public.cards (id, sort, name, flavor, rarity, img, tall) values
  ('cry',    1, 'Слёзы счастья',    'Когда донат пришёл в самый нужный момент',       'common',    'https://frebertor-sudo.github.io/zvezdny-pak/img/cry.webp',    false),
  ('oops',   2, 'Ой-ой',            'Чат, я ничего не видела. Совсем ничего.',         'rare',      'https://frebertor-sudo.github.io/zvezdny-pak/img/oops.webp',   false),
  ('love',   3, 'Мяу-любовь',       'Рейд на двести человек. Сердечко на максимум.',  'epic',      'https://frebertor-sudo.github.io/zvezdny-pak/img/love.webp',   false),
  ('smug',   4, 'Хитрый план',      'Всё идёт по плану. По какому — секрет.',          'legendary', 'https://frebertor-sudo.github.io/zvezdny-pak/img/smug.webp',   false),
  ('gaze',   5, 'Взгляд в упор',    'Смотрит в самую душу. И в чат заодно.',          'common',    'https://frebertor-sudo.github.io/zvezdny-pak/img/gaze.webp',   true),
  ('sun',    6, 'Солнечный зайчик', 'Улыбка, от которой в лесу светлеет.',            'common',    'https://frebertor-sudo.github.io/zvezdny-pak/img/sun.webp',    true),
  ('surf',   7, 'Летний заплыв',    'Плюшевый друг не утонет. Проверено.',            'rare',      'https://frebertor-sudo.github.io/zvezdny-pak/img/surf.webp',   true),
  ('shades', 8, 'Через очки',       'Один взгляд поверх оправы — и чат замолкает.',   'rare',      'https://frebertor-sudo.github.io/zvezdny-pak/img/shades.webp', true),
  ('bunny',  9, 'Хмурый кролик',    'Не дуется. Просто думает. Очень сердито.',       'epic',      'https://frebertor-sudo.github.io/zvezdny-pak/img/bunny.webp',  true),
  ('moon',  10, 'Лунная демоница',  'Появляется только в полнолуние над лесом.',      'legendary', 'https://frebertor-sudo.github.io/zvezdny-pak/img/moon.webp',   true);
