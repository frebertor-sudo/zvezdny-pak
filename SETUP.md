# Как включить настоящий режим (Twitch + Supabase)

Пока в `config.js` пусто, сайт работает в демо: всё хранится в браузере. Когда заполнишь настройки, он сам переключится на сервер.

**Как это устроено:**
- Зритель покупает на твоём канале награду **«Звёздный пак»** за баллы канала.
- Twitch сообщает об этом серверу (EventSub), и у зрителя на сайте появляется **пакетик**.
- Пакет разыгрывается **на сервере** (шансы, гарантия, холо), коллекции хранятся в базе.
- Оверлей `overlay.html` показывает выпадения на стриме.

> Баллы канала и награды есть только у каналов-компаньонов (Affiliate) и партнёров Twitch.

---

## 1. Приложение Twitch
1. https://dev.twitch.tv/console/apps → **Register Your Application**.
2. **OAuth Redirect URLs:** `https://frebertor-sudo.github.io/zvezdny-pak/` (ровно так, со слешем).
3. **Category:** Website Integration. **Client Type:** Confidential.
4. Сохрани и скопируй **Client ID**. Нажми **New Secret** и сохрани **Client Secret**, он нужен только серверу. Никому его не показывай и не вставляй в сайт.

## 2. Проект Supabase
1. https://supabase.com/dashboard → **New project** (бесплатный план подходит).
2. **SQL Editor** → вставь содержимое `supabase/migrations/20261106000000_init.sql` → **Run**.
   Это создаст таблицы, функции розыгрыша и стартовый набор из 10 карточек.

## 3. Серверные функции
Через Supabase CLI (на своём компьютере):
```bash
npx supabase login
npx supabase link --project-ref <ref-проекта>
npx supabase functions deploy api --no-verify-jwt
npx supabase functions deploy eventsub --no-verify-jwt
npx supabase secrets set \
  TWITCH_CLIENT_ID=<client id> \
  TWITCH_CLIENT_SECRET=<client secret> \
  TWITCH_CHANNEL=<логин канала маленькими буквами> \
  EVENTSUB_SECRET=<любая случайная строка 20–100 символов> \
  SITE_ORIGINS=https://frebertor-sudo.github.io
```
`SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` Supabase подставляет в функции сам.

## 4. Настройки сайта
В `config.js`:
```js
window.ZVEZDNY_CONFIG = {
  twitchClientId: '<client id>',
  channel: '<логин канала>',
  supabaseUrl: 'https://<ref>.supabase.co',      // Project Settings → API → Project URL
  supabaseAnonKey: '<anon или publishable key>'  // Project Settings → API Keys (публичный)
};
```
Через минуту после сохранения в репозитории сайт обновится сам.

## 5. Награда на Twitch
1. Открой сайт → **Стример** → войди аккаунтом канала (сайт попросит доступ к наградам).
2. Нажми **«Создать награду „Звёздный пак“»**. Награда появится на канале, сервер подпишется на её покупки.
3. Цену награды задаёт поле «Цена пака, баллов» в панели. После изменения нажми кнопку ещё раз, и цена обновится на Twitch.

## 6. Оверлей для OBS
- Источник → **Браузер** → URL `https://frebertor-sudo.github.io/zvezdny-pak/overlay.html`, размер 1920×1080.
- Параметры: `?min=rare`, чтобы показывать только редкие и выше; `?sound=0`, чтобы выключить звук; `?test=1`, чтобы показать пробную плашку.

---

### Что где лежит
| Файл | Что делает |
|---|---|
| `supabase/migrations/…_init.sql` | таблицы, доступы, розыгрыш `open_pack`, крафт, начисление пакетиков |
| `supabase/functions/api` | API сайта: профиль, открыть пак, крафт, панель стримера, создание награды |
| `supabase/functions/eventsub` | приём покупок награды с Twitch (проверка подписи, защита от повторов) |
| `config.js` | публичные настройки сайта |
| `overlay.html` | оверлей для OBS |

### Безопасность
- В браузер попадают только публичные ключи. Секрет Twitch и service role key живут в секретах Supabase.
- Каждый запрос к API проверяет Twitch-токен у самого Twitch (`/oauth2/validate`).
- Панель стримера на сервере доступна только логину из `TWITCH_CHANNEL`.
- Публичный ключ даёт только чтение карточек, настроек и ленты выпадений. Коллекции и пакетики меняет только сервер.
