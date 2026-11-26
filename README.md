# PLATWFC — 2.5D Platformer

Игровой клиент и отдельный realtime-сервер PLATWFC.

## Играть локально
Открой GitHub Pages после включения **Settings → Pages → Source: GitHub Actions**. Управление: WASD / стрелки, пробел — прыжок.

## Запуск сервера PLATWFC
Требуется Node.js 20 или новее.

```bash
cd server
npm install
npm start
```

Сервер слушает порт `8080`, WebSocket endpoint — `/ws`, health check — `/health`. Для публикации используй отдельный хостинг, поддерживающий Node.js и WebSocket. GitHub Pages не запускает серверные процессы.

## Подключение клиента к серверу
После размещения сервера открой клиент со строкой параметров:

```
https://voloda06346.github.io/platwfc-2-5d-platformer/?server=wss://YOUR-HOST/ws&name=Player&room=lobby
```

Замени `wss://YOUR-HOST/ws` на WebSocket URL своего сервера. Для локальной проверки используй `ws://localhost:8080/ws` при локальном запуске клиента.

## Протокол v1
- `join` — вход в комнату (до 16 игроков).
- `state` — обновление позиции игрока.
- `peer-joined`, `peer-state`, `peer-left` — события других игроков.
- `/health` — JSON-статус сервера.

PLATWFC сейчас синхронизирует комнаты и позиции игроков; авторитетная физика, аккаунты и сохранения будут отдельными следующими этапами.