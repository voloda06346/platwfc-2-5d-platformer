# PLATWFC — 2.5D Platformer

Браузерный 2.5D-платформер с планируемым сетевым режимом на собственном сервере PLATWFC.

## Клиент
Сейчас в проекте есть интерактивный прототип: движение по WASD/стрелкам и прыжок на пробел.

## GitHub Pages
В репозитории добавлен workflow `.github/workflows/pages.yml`. В Settings → Pages выбери **Source: GitHub Actions**. После этого workflow автоматически опубликует сайт при push в `main`.

## Сервер PLATWFC
GitHub Pages обслуживает статические файлы и не запускает Node.js/WebSocket-сервер. Сервер будет отдельным процессом на хостинге с поддержкой Node.js и WebSocket.

## Управление
- WASD / стрелки — движение
- Пробел — прыжок