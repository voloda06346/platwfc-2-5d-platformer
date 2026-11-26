# PLATWFC — 2.5D Platformer

Игровой клиент и realtime-сервер PLATWFC. **Docker не требуется.** Сервер запускается напрямую на Windows через Node.js.

## Игровой клиент

Клиент публикуется через GitHub Pages. В репозитории открой **Settings → Pages → Build and deployment → Source: GitHub Actions**. Управление: WASD / стрелки, пробел — прыжок.

## Требования для разработки на Windows

- Windows 10/11;
- Node.js 20 или новее (вместе с npm);
- Git.

Склонируй репозиторий:

```powershell
git clone https://github.com/voloda06346/platwfc-2-5d-platformer.git
cd platwfc-2-5d-platformer
```

## Локальный запуск — без Docker и без Caddy

Открой PowerShell в корне проекта. Выполни:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\start-local.ps1
```

Скрипт сам установит npm-зависимости при первом запуске и запустит Node.js сервер.

Проверка из второго окна PowerShell:

```powershell
Invoke-RestMethod http://localhost:8080/health
```

Локальные адреса:
- HTTP-проверка: `http://localhost:8080/health`
- WebSocket: `ws://localhost:8080/ws`

Остановить сервер: `Ctrl+C`.

## Публичный режим на Windows — тоже без Docker

Чтобы игроки могли подключаться из интернета, нужен домен, который указывает на публичный адрес хоста, и HTTPS/WSS. Для этого используется **Caddy как обычный Windows .exe**, а не контейнер.

1. Установи Caddy для Windows по официальной инструкции: https://caddyserver.com/docs/install. Добавь `caddy.exe` в PATH либо положи его в `tools\caddy.exe` внутри проекта.
2. Создай файл `.env` из шаблона:

```powershell
Copy-Item .env.example .env
notepad .env
```

3. Впиши реальные значения:

```dotenv
PLATWFC_DOMAIN=game.your-domain.example
ACME_EMAIL=you@your-domain.example
```

4. Убедись, что DNS-запись домена указывает на публичный адрес компьютера и что сетевой администратор настроил доступность TCP-портов **80 и 443** для Caddy. Для домашней сети могут быть ограничения роутера или интернет-провайдера.
5. Запусти в PowerShell из корня проекта:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\start-public.ps1
```

Скрипт запускает Node.js сервер и Caddy. Держи окно PowerShell открытым; `Ctrl+C` останавливает оба процесса. Логи Node.js записываются в `logs\server-out.log` и `logs\server-error.log`.

Проверка публичного health endpoint:

```powershell
Invoke-RestMethod https://game.your-domain.example/health
```

Публичный WebSocket URL будет:

```text
wss://game.your-domain.example/ws
```

Открой GitHub Pages с параметрами сервера (замени домен на свой):

```text
https://voloda06346.github.io/platwfc-2-5d-platformer/?server=wss://game.your-domain.example/ws&name=Player&room=lobby
```

**Важно:** публичный режим не включается одной командой, если нет домена и доступного из интернета хоста. Компьютер должен быть включён и подключён к сети, а порты 80/443 доступны извне. Не публикуй домашний IP, адрес сети, содержимое `.env` или логи в чате/публичных репозиториях. Не открывай доступ к своему домашнему компьютеру без согласования с родителем/взрослым, который отвечает за сеть. Для постоянного сервера лучше использовать отдельную машину, а не основной домашний ПК.

## Обновление

```powershell
git pull
```

Затем перезапусти сервер. Зависимости автоматически проверяются скриптом при первом запуске; после изменения `server/package.json` выполни `npm install` в папке `server`.

## Протокол v1

- `join` — вход в комнату (до 16 игроков).
- `state` — обновление позиции игрока.
- `peer-joined`, `peer-state`, `peer-left` — события других игроков.
- `/health` — JSON-статус сервера.

**Текущий статус:** PLATWFC синхронизирует комнаты и позиции. Регистрация аккаунтов, безопасное хранение паролей и серверные ранги (включая `CREATOR`) ещё не реализованы. Ранг создателя будет назначаться серверной настройкой/первичной настройкой аккаунта, а не только по IP.
