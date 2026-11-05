-- Ключ стримера задаётся на сайте один раз, пока открыто окно claim_until. Храним только хеш.
alter table public.settings add column channel text;
alter table public.settings add column claim_until timestamptz;
create table public.admin_secret (
  id         int primary key default 1 check (id = 1),
  key_hash   text not null,
  created_at timestamptz not null default now()
);
alter table public.admin_secret enable row level security;
-- без политик: читают только функции
