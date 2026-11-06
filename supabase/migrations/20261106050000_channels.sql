-- Общий сайт на несколько каналов: основной канал (settings.channel) + дополнительные.
alter table public.settings add column if not exists channels text[] not null default '{}';      -- дополнительные каналы
alter table public.settings add column if not exists reward_ids jsonb not null default '{}'::jsonb; -- награда «Звёздный пак» на каждом канале
update public.settings set channels = array['lucifermorf'] where id = 1;
update public.settings set reward_ids = jsonb_build_object(channel, reward_id) where id = 1 and reward_id is not null and channel is not null;
