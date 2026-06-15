# Деплой на VPS (рядом с другим проектом, без конфликтов)

Инструкция, как поднять сервис отчётов на том же сервере, где уже работает другой
Node-проект (напр. `tilda-proxy` на порту 3000), не задев его. Отчёты слушают порт
**4100** и отдаются на отдельном поддомене.

Плейсхолдеры (замени на свои): `ВАШ_IP`, `reports.ВАШ-ДОМЕН.ru`.

---

## 0. Безопасность — сделай в первую очередь
- Смени root-пароль (`passwd`) и переходи на вход по SSH-ключу; парольный вход root отключи.
- Все секреты только в `.env` на сервере (в гит не коммитятся).

## 1. DNS
Добавь A-запись поддомена на IP сервера:
```
reports   A   ВАШ_IP
```
Проверка: `ping reports.ВАШ-ДОМЕН.ru` (или `dig +short reports.ВАШ-ДОМЕН.ru`) — должен вернуться ВАШ_IP. DNS может обновляться до ~30 минут.

## 2. Код на сервер
```bash
sudo mkdir -p /opt && cd /opt
git clone https://github.com/dsanya99-bot/analytics.git analytics-reports
cd analytics-reports
node -v            # нужен Node 18+ (как у соседнего проекта)
npm ci --omit=dev
```
Если `better-sqlite3` не ставится из-за отсутствия пребилда под версию Node:
```bash
sudo apt-get update && sudo apt-get install -y build-essential python3
npm rebuild better-sqlite3
```

## 3. Секреты и конфиг (.env)
```bash
cp .env.example .env
# Сгенерируй секрет сессий:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# Сгенерируй хеш пароля кабинета:
npm run hash -- "ПРИДУМАЙ-ДЛИННЫЙ-ПАРОЛЬ"
nano .env
```
В `.env` пропиши:
```
PORT=4100
NODE_ENV=production
ADMIN_PASSWORD_HASH=<хеш из npm run hash>
ADMIN_PASSWORD=
JWT_SECRET=<секрет из команды выше>
SESSION_TTL_HOURS=12
DB_PATH=/var/lib/analytics-reports/reports.db
```
> `DB_PATH` указывает на каталог вне репозитория — БД переживёт обновления кода.

## 4. Каталог для базы
```bash
sudo mkdir -p /var/lib/analytics-reports
# (по желанию) создать демо-отчёт:
npm run seed
```

## 5. Запуск под PM2 (отдельный процесс)
У сервиса своё имя процесса (`analytics-reports`), поэтому соседний проект не затрагивается.
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup      # один раз — чтобы стартовал после перезагрузки (выполни команду, что он напечатает)
pm2 list         # должны быть видны оба процесса
curl -s localhost:4100/healthz   # -> {"ok":true}
```

## 6. Reverse-proxy (поддомен → 127.0.0.1:4100)
Узнай, что у тебя стоит: `which nginx caddy ; systemctl status nginx caddy 2>/dev/null | head`.

### Вариант A — nginx
Создай `/etc/nginx/sites-available/reports`:
```nginx
server {
    listen 80;
    server_name reports.ВАШ-ДОМЕН.ru;
    location / {
        proxy_pass http://127.0.0.1:4100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/reports /etc/nginx/sites-enabled/reports
sudo nginx -t && sudo systemctl reload nginx
# TLS:
sudo certbot --nginx -d reports.ВАШ-ДОМЕН.ru
```

### Вариант B — Caddy
В `/etc/caddy/Caddyfile` добавь блок (TLS Caddy выпустит сам):
```
reports.ВАШ-ДОМЕН.ru {
    reverse_proxy 127.0.0.1:4100
}
```
```bash
sudo systemctl reload caddy
```

## 7. Файрвол
```bash
sudo ufw allow 80,443/tcp    # порт 4100 наружу НЕ открываем — он только для прокси
```

## 8. Проверка
- `https://reports.ВАШ-ДОМЕН.ru/login` — открывается, вход по паролю.
- Создай отчёт → «Открыть» → ссылка `https://reports.ВАШ-ДОМЕН.ru/r/<slug>` работает без логина.

## Обновление в будущем
```bash
cd /opt/analytics-reports
git pull
npm ci --omit=dev
pm2 reload analytics-reports
```
(БД и `.env` не трогаются — они вне репозитория.)

## Почему не конфликтует с соседним проектом
- **Порт** другой (4100 vs 3000).
- **Процесс PM2** с отдельным именем.
- **БД** — свой файл в `/var/lib/analytics-reports/`.
- **Cookie** называется `session` (не пересекается с чужими), привязан к своему хосту.
- **Секреты** — свой `.env`.
