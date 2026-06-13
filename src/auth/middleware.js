'use strict';

/** Гейт кабинета: пускаем только с валидным сессионным токеном из cookie. */

const { verifyToken } = require('./token');
const { parseCookies } = require('../util/http');

const COOKIE_NAME = 'session';

function getToken(req) {
  const cookies = parseCookies(req);
  if (cookies[COOKIE_NAME]) return cookies[COOKIE_NAME];
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

/** Для API: 401 JSON. */
function requireAuthApi(req, res, next) {
  const payload = verifyToken(getToken(req));
  if (!payload) return res.status(401).json({ error: 'Требуется авторизация' });
  req.admin = payload;
  next();
}

/** Для страниц: редирект на /login. */
function requireAuthPage(req, res, next) {
  const payload = verifyToken(getToken(req));
  if (!payload) return res.redirect('/login');
  req.admin = payload;
  next();
}

module.exports = { requireAuthApi, requireAuthPage, COOKIE_NAME, getToken };
