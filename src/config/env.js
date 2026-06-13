'use strict';

/**
 * Конфигурация из переменных окружения + безопасные значения по умолчанию.
 * Здесь же — выбор пути к БД (вне OneDrive) и автогенерация JWT-секрета,
 * чтобы приложение запускалось «из коробки», но оставалось безопасным.
 */

require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

function int(name, def) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) ? v : def;
}

// Каталог данных по умолчанию — в домашней папке, ВНЕ OneDrive/Dropbox,
// чтобы синхронизация облака не повредила WAL-файлы SQLite.
const DATA_DIR = process.env.DB_PATH
  ? path.dirname(path.resolve(process.env.DB_PATH))
  : path.join(os.homedir(), '.analytics-reports');

fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(DATA_DIR, 'reports.db');

// Секрет подписи сессий: из env, иначе — постоянный файл рядом с БД.
function resolveJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
    return process.env.JWT_SECRET;
  }
  const secretFile = path.join(DATA_DIR, '.session-secret');
  try {
    return fs.readFileSync(secretFile, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(secretFile, secret, { mode: 0o600 });
    return secret;
  }
}

module.exports = {
  PORT: int('PORT', 4100),
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',

  DATA_DIR,
  DB_PATH,

  ADMIN_PASSWORD_HASH: (process.env.ADMIN_PASSWORD_HASH || '').trim(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',

  JWT_SECRET: resolveJwtSecret(),
  SESSION_TTL_HOURS: int('SESSION_TTL_HOURS', 12),

  LOGIN_MAX_ATTEMPTS: int('LOGIN_MAX_ATTEMPTS', 8),
  LOGIN_WINDOW_MINUTES: int('LOGIN_WINDOW_MINUTES', 10),
};
