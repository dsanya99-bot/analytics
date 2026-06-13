'use strict';

/** Мелкие хелперы: cookie-парсер, генерация slug, экранирование HTML. */

const crypto = require('crypto');

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

/** Непредсказуемый публичный идентификатор отчёта (~128 бит энтропии). */
function makeSlug() {
  return crypto.randomBytes(16).toString('base64url'); // 22 символа [A-Za-z0-9_-]
}

/** Внутренний id записи. */
function makeId() {
  return crypto.randomBytes(9).toString('base64url');
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);
}

module.exports = { parseCookies, makeSlug, makeId, escapeHtml };
