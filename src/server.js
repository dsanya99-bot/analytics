'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');

const env = require('./config/env');
const logger = require('./logger');
const { requireAuthPage, getToken } = require('./auth/middleware');
const { verifyToken } = require('./auth/token');

const authRouter = require('./routes/auth');
const projectsRouter = require('./routes/projects');
const publicRouter = require('./routes/public');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // за nginx/Caddy — корректный req.ip для rate-limit

const VIEWS = path.join(__dirname, 'views');
const ASSETS = path.join(__dirname, '..', 'public', 'assets');

// ─── Заголовки безопасности ────────────────────────────────
const frameAncestors = ["'self'"].concat(
  (process.env.REPORT_FRAME_ANCESTORS || '')
    .split(',').map((s) => s.trim()).filter(Boolean)
);
app.use(helmet({
  // X-Frame-Options отключаем — управляем встраиванием через CSP frame-ancestors
  // (нужно для предпросмотра в iframe и для вставки отчёта в Tilda).
  xFrameOptions: false,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      // 'unsafe-inline' для скриптов: логика отчёта встроена в шаблон (как в оригинале).
      // Реальная защита от XSS — экранирование пользовательского текста при рендере.
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors,
      baseUri: ["'self'"],
      formAction: ["'self'"],
      ...(env.isProd ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
}));

// ─── Статика (публичные ассеты: движок, css, скрипты кабинета) ──
app.use('/assets', express.static(ASSETS, { maxAge: env.isProd ? '7d' : 0 }));

app.get('/healthz', (req, res) => res.json({ ok: true }));

// ─── Страницы ──────────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/cabinet'));

app.get('/login', (req, res) => {
  if (verifyToken(getToken(req))) return res.redirect('/cabinet');
  res.sendFile(path.join(VIEWS, 'login.html'));
});

app.get('/cabinet', requireAuthPage, (req, res) => {
  res.sendFile(path.join(VIEWS, 'cabinet.html'));
});

app.get('/editor/:id', requireAuthPage, (req, res) => {
  res.sendFile(path.join(VIEWS, 'editor.html'));
});

// ─── API + публичные отчёты ────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/', publicRouter); // /r/:slug и /preview

// ─── 404 / ошибки ──────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  logger.error('Необработанная ошибка', { msg: err.message });
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(env.PORT, () => {
  logger.info(`Сервис отчётов запущен на http://localhost:${env.PORT}`);
  logger.info(`БД: ${env.DB_PATH}`);
});

module.exports = app;
