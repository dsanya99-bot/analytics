# Analytics Reports — генератор отчётов агентства

Внутренний инструмент: менеджер заходит в кабинет по общему паролю, заводит проект
(сайт клиента + 4 сценария продвижения), а система отдаёт **публичный отчёт по ссылке**
вида `https://домен/r/<slug>` — read-only, с тем же дизайном, что и исходная финмодель.

Числа считаются **движком** из небольшого набора входных данных, а не хранятся готовыми:

```
Лиды       = Трафик × конверсия (1%)
Клиенты    = Клиенты(пред.мес) × удержание (75%) + Лиды
Выручка    = Клиенты × ₽/клиент (2500)
Окупаемость= Выручка / Бюджет
₽/визит, ₽/лид, ₽/клиент = Бюджет / (визиты | лиды | клиенты)
```

(Модель реверс-инжинирена из исходного `index.html` и проверена тестом — см. `tests/`.)

## Стек
Node 18+ · Express · better-sqlite3 (SQLite, WAL) · helmet · express-rate-limit.
Без сборки и фреймворков на фронте — отчёт переиспользует исходный HTML как шаблон.

## Структура
```
public/assets/   engine.js (движок, общий) · admin.css · login/cabinet/editor.js
src/
  config/env.js  конфиг + путь к БД (вне OneDrive) + автосекрет сессий
  auth/          scrypt-пароль, токен (HMAC), middleware
  db/            подключение + CRUD отчётов
  data/          дефолтный шаблон (platipomiru)
  engine — см. public/assets/engine.js (UMD: и в браузере, и в Node)
  routes/        auth · projects (CRUD под паролем) · public (/r/:slug, /preview)
  util/          sanitize · http (cookie/slug/escape)
  views/         report.html (шаблон отчёта) · login · cabinet · editor
scripts/         hash-password.js · seed.js
```

## Запуск (Windows / PowerShell)
```powershell
npm install
# (по желанию) демо-отчёт:
npm run seed
npm run dev          # http://localhost:4100
```
Войти: открыть `http://localhost:4100/login`, пароль из `.env` (`ADMIN_PASSWORD`, по умолчанию `changeme123`).

## Где хранится БД
По умолчанию — `~/.analytics-reports/reports.db`, **вне папки OneDrive** (важно: OneDrive
синхронизирует и лочит `.db-wal`, что может повредить SQLite). Путь меняется через `DB_PATH` в `.env`.
Бэкап: остановить процесс и скопировать `reports.db` (в WAL-режиме лучше `sqlite3 reports.db ".backup ..."`).

## Безопасность (что уже сделано)
- Пароль проверяется **только на сервере**; в браузер не попадает. Хранится как scrypt-хеш.
- Сессия — подписанный (HMAC) **httpOnly + SameSite=Lax** cookie; `secure` в проде (HTTPS).
- Перебор пароля ограничен (`express-rate-limit`).
- Публичная ссылка `/r/<slug>` — **только чтение**; slug случайный (~128 бит), не угадывается;
  есть кнопка «Перевыпустить ссылку» (отзыв утёкшей).
- Редактор и все изменения — за паролем; публичный путь не даёт доступа к редактору/чужим отчётам.
- Пользовательский текст экранируется при рендере (имена, подписи, статьи расходов); цвет — по whitelist; URL — только http/https.
- `helmet` + CSP; данные отчёта отдаются как `application/json` (не исполняемый скрипт).

## Перед продом
1. Сгенерировать хеш пароля и положить в `ADMIN_PASSWORD_HASH`, очистить `ADMIN_PASSWORD`:
   ```powershell
   npm run hash -- "длинный-пароль-из-4-5-слов"
   ```
2. Задать `JWT_SECRET` (или оставить пустым — сгенерируется и сохранится рядом с БД).
3. `NODE_ENV=production`, HTTPS на reverse-proxy (nginx/Caddy), proxy_pass на `127.0.0.1:4100`.
4. Запуск под PM2: `pm2 start ecosystem.config.js`.
5. Для встраивания отчёта в Tilda — добавить домен Tilda в `REPORT_FRAME_ANCESTORS` (CSP frame-ancestors).

## Тесты
```powershell
npm test
```
