'use strict';

/**
 * Мини-токен сессии: компактный аналог JWT на HMAC-SHA256.
 * Подпись секретом из env. Без зависимостей.
 * Формат:  base64url(payloadJson).base64url(hmac)
 */

const crypto = require('crypto');
const { JWT_SECRET, SESSION_TTL_HOURS } = require('../config/env');

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function sign(payloadB64) {
  return crypto.createHmac('sha256', JWT_SECRET).update(payloadB64).digest('base64url');
}

function createToken(extra = {}) {
  const now = Date.now();
  const payload = {
    sub: 'admin',
    iat: now,
    exp: now + SESSION_TTL_HOURS * 3600 * 1000,
    ...extra,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
  return payload;
}

module.exports = { createToken, verifyToken };
