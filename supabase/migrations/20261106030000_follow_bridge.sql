-- Вход стримера через чат (ссылка для OBS без придуманного ключа) и паки только для фолловеров.
alter table admin_secret alter column key_hash drop not null;
alter table admin_secret add column if not exists bridge_key text;    -- ключ моста для ссылки OBS (только сервер)
alter table admin_secret add column if not exists decapi_token text;  -- токен decapi.me для проверки фолловеров (только сервер)
alter table settings add column if not exists follow_only boolean not null default false;
alter table profiles add column if not exists follow_ok_at timestamptz; -- когда последний раз подтвердили фоллоу
