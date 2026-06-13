'use strict';

/** Вход в кабинет по общему паролю → подписанный httpOnly-cookie. */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyPassword, hashPassword } = require('../auth/password');
const { createToken } = require('../auth/token');
const { COOKIE_NAME } = require('../auth/middleware');
const env = require('../config/env');
const logger = require('../logger');

const router = express.Router();

// Хеш пароля: из env (прод) либо из ADMIN_PASSWORD (dev, хешируем при старте).
let PASSWORD_HASH = env.ADMIN_PASSWORD_HASH;
if (!PASSWORD_HASH && env.ADMIN_PASSWORD) {
  PASSWORD_HASH = hashPassword(env.ADMIN_PASSWORD);
  logger.warn('[auth] ADMIN_PASSWORD_HASH не задан — пароль захеширован из ADMIN_PASSWORD (только для разработки).');
}

const loginLimiter = rateLimit({
  windowMs: env.LOGIN_WINDOW_MINUTES * 60 * 1000,
  max: env.LOGIN_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Подождите немного и попробуйте снова.' },
});

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax', // Lax — чтобы кабинет открывался по ссылке из мессенджера/почты
    secure: env.isProd, // только HTTPS в проде
    path: '/',
    maxAge: env.SESSION_TTL_HOURS * 3600 * 1000,
  };
}

router.post('/login', loginLimiter, express.json({ limit: '8kb' }), (req, res) => {
  if (!PASSWORD_HASH) {
    return res.status(500).json({ error: 'Пароль не настроен на сервере (ADMIN_PASSWORD/ADMIN_PASSWORD_HASH).' });
  }
  const password = req.body && req.body.password;
  if (!password || !verifyPassword(password, PASSWORD_HASH)) {
    logger.warn('[auth] неудачный вход', { ip: req.ip });
    return res.status(401).json({ error: 'Неверный пароль' });
  }
  res.cookie(COOKIE_NAME, createToken(), cookieOptions());
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

module.exports = router;
