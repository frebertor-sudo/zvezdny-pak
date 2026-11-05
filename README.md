# Звёздный пак

Сайт коллекционных карточек канала за баллы Twitch: зрители открывают фольговые пакетики, вытаскивают карту и собирают альбом.

Сайт: https://frebertor-sudo.github.io/zvezdny-pak/

## Что внутри
- `index.html`, `style.css`, `app.js` — весь сайт, без сборки
- `img/` — арты карточек

## Вход через Twitch
1. Зарегистрируй приложение на https://dev.twitch.tv/console/apps
   - OAuth Redirect URL: `https://frebertor-sudo.github.io/zvezdny-pak/`
   - Категория: Website Integration, тип клиента: Confidential
2. В `config.js` укажи `twitchClientId` и `channel` (логин канала маленькими буквами).

Пока `clientId` пуст, на сайте работает демо-вход.

## Сервер
Настоящий режим с наградой за баллы канала, розыгрышем на сервере и оверлеем для OBS работает на Supabase. Пошаговая настройка — в [SETUP.md](SETUP.md).
