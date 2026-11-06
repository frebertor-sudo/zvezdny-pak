alter table public.settings add column if not exists es_state jsonb not null default '{}'::jsonb; -- что видит оверлей: подписка на прямые покупки по каналам
