'use strict';

/**
 * Очистка и валидация входящего объекта отчёта перед сохранением.
 * Текст НЕ html-экранируем здесь (это делает рендер через textContent/escText),
 * но: приводим числа к конечным значениям, ограничиваем длины, проверяем URL
 * (только http/https) и цвет (строгий whitelist, т.к. он попадает в style).
 */

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const RGBA_RE = /^(rgba?\([\d.,\s%]+\)|#[0-9a-fA-F]{3,8})$/;
const DEFAULT_COLOR = '#8a96aa';

function str(v, max = 300) {
  return String(v == null ? '' : v).slice(0, max);
}
function fin(v, def = 0) {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : def;
}
function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}
function nonNeg(v) {
  return Math.max(0, fin(v, 0));
}

function sanitizeUrl(v) {
  const s = str(v, 500).trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : '';
}

function sanitizeBreakdown(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  let count = 0;
  for (const k of Object.keys(obj)) {
    if (count++ >= 30) break;
    const label = str(k, 80).trim();
    if (!label) continue;
    out[label] = nonNeg(obj[k]);
  }
  return out;
}

function sanitizeTraffic(arr, maxLen) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, maxLen).map((v) => nonNeg(v));
}

function sanitizeScenario(s, horizon) {
  s = s || {};
  const colorRaw = COLOR_RE.test(s.colorRaw) ? s.colorRaw : DEFAULT_COLOR;
  const soft = RGBA_RE.test(s.soft) ? s.soft : 'rgba(138,150,170,.18)';
  const invest = Array.isArray(s.invest)
    ? s.invest.slice(0, horizon).map(nonNeg)
    : nonNeg(s.invest);
  return {
    id: str(s.id, 40).replace(/[^a-zA-Z0-9_-]/g, '') || 'sc',
    name: str(s.name, 200),
    sub: str(s.sub, 200),
    colorRaw,
    soft,
    invest,
    breakdown: sanitizeBreakdown(s.breakdown),
    traffic: sanitizeTraffic(s.traffic, horizon),
  };
}

function sanitizeReport(input) {
  const r = input && typeof input === 'object' ? input : {};
  const horizon = clamp(Math.round(fin(r.horizon, 15)), 1, 36);
  const scenarios = Array.isArray(r.scenarios) ? r.scenarios.slice(0, 12) : [];
  const c = r.constants || {};

  return {
    client: {
      name: str(r.client && r.client.name, 300),
      url: sanitizeUrl(r.client && r.client.url),
    },
    title: str(r.title, 300),
    eyebrow: str(r.eyebrow, 300),
    horizon,
    currentTraffic: nonNeg(r.currentTraffic),
    constants: {
      convVisitToLead: clamp(fin(c.convVisitToLead, 0.01), 0, 1),
      retention: clamp(fin(c.retention, 0.75), 0, 1),
      revenuePerClient: nonNeg(c.revenuePerClient != null ? c.revenuePerClient : 2500),
    },
    scenarios: scenarios.map((s) => sanitizeScenario(s, horizon)),
  };
}

module.exports = { sanitizeReport };
