# PLATWFC — 2.5D Platformer

Игровой клиент и отдельный realtime-сервер PLATWFC.

## Играть

Клиент публикуется через GitHub Pages. Включи **Settings → Pages → Build and deployment → Source: GitHub Actions**. Управление: WASD / стрелки, пробел — прыжок.

## Публичный сервер: ручной деплой через Docker

GitHub Pages обслуживает только статические файлы игры. WebSocket-сервер запускается отдельно на постоянно работающей машине с публичным IP (например, собственном VPS).

Подготовь:
- Linux-сервер с установленными Docker Engine и Docker Compose plugin;
- доменное имя, DNS-запись которого указывает на публичный IP сервера;
- доступность входящих TCP-портов **80** и **443** на сервере.

Не публикуй порт 8080 напрямую в интернет: он доступен только внутри Docker-сети. Caddy принимает HTTPS/WSS на 443 и проксирует трафик к PLATWFC.

### 1. Получить код на сервере

```bash
git clone https://github.com/voloda06346/platwfc-2-5d-platformer.git
cd platwfc-2-5d-platformer
```

### 2. Настроить домен

```bash
cp .env.example .env
```

Открой `.env` и замени примеры на свои реальные значения:

```dotenv
PLATWFC_DOMAIN=game.example.com
ACME_EMAIL=you@example.com
```

До запуска проверь, что DNS A-запись `game.example.com` указывает на публичный IPv4 сервера. Если настроена AAAA-запись, она тоже должна вести на этот сервер.

### 3. Собрать и запустить

```bash
docker compose up -d --build
```

Проверка состояния:

```bash
docker compose ps
docker compose logs -f server caddy
```

Проверка HTTP health endpoint:

```bash
curl https://game.example.com/health
```

Ожидаемый ответ содержит `"service":"PLATWFC"` и `"status":"ok"`. Caddy автоматически получает TLS-сертификат, когда DNS и порты настроены правильно.

### 4. Подключить игру

Открой GitHub Pages с параметрами сервера:

```text
https://voloda06346.github.io/platwfc-2-5d-platformer/?server=wss://game.example.com/ws&name=Player&room=lobby
```

Замени `game.example.com` на свой домен. Для публичного сайта используй именно `wss://`, а не `ws://`.

### Обновление сервера

```bash
git pull
docker compose up -d --build
```

### Остановка

```bash
docker compose down
```

## Локальная разработка без Docker

Требуется Node.js 20 или новее:

```bash
cd server
npm install
npm start
```

Локальный WebSocket endpoint: `ws://localhost:8080/ws`. Health endpoint: `http://localhost:8080/health`.

## Протокол v1

- `join` — вход в комнату (до 16 игроков).
- `state` — обновление позиции игрока.
- `peer-joined`, `peer-state`, `peer-left` — события других игроков.
- `/health` — JSON-статус сервера.

**Текущий статус:** сервер пока синхронизирует комнаты и позиции. Регистрация аккаунтов, безопасное хранение паролей и серверная система рангов (включая CREATOR) ещё не реализованы. Не добавляй секреты, пароли или приватные ключи в GitHub. Ранг CREATOR будет назначаться серверной конфигурацией/первичной настройкой аккаунта, а не только по IP-адресу.
