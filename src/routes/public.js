'use strict';

/** Публичные read-only отчёты по ссылке + шелл предпросмотра для редактора. */

const express = require('express');
const fs = require('fs');
const path = require('path');
const reports = require('../db/reports');
const { sanitizeReport } = require('../util/sanitize');
const { requireAuthPage } = require('../auth/middleware');

const router = express.Router();

const TEMPLATE_PATH = path.join(__dirname, '..', 'views', 'report.html');
let TEMPLATE = fs.readFileSync(TEMPLATE_PATH, 'utf8');
if (process.env.NODE_ENV !== 'production') {
  // В dev перечитываем шаблон на каждый запрос — удобно при правках вёрстки.
  TEMPLATE = null;
}
function template() {
  return TEMPLATE || fs.readFileSync(TEMPLATE_PATH, 'utf8');
}

function renderWithData(reportData) {
  const json = JSON.stringify(reportData).replace(/</g, '\\u003c'); // безопасно внутри <script>
  const block = `<script id="report-data" type="application/json">${json}</script>`;
  return template().replace('<!--REPORT_DATA-->', block);
}

function notFound(res) {
  res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(
    '<!doctype html><meta charset="utf-8"><title>Отчёт не найден</title>' +
    '<body style="font-family:system-ui;background:#07090d;color:#e7ecf3;display:flex;' +
    'min-height:100vh;align-items:center;justify-content:center;margin:0">' +
    '<div style="text-align:center"><h1 style="font-size:64px;margin:0">404</h1>' +
    '<p style="color:#94a0b3">Отчёт не найден или ссылка устарела.</p></div>'
  );
}

// Публичный отчёт по slug — без авторизации, только чтение.
router.get('/r/:slug', (req, res) => {
  const rep = reports.getBySlug(req.params.slug);
  if (!rep) return notFound(res);
  const data = sanitizeReport(rep.data);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(renderWithData(data));
});

// Шелл предпросмотра (данные приходят через postMessage из редактора). Под авторизацией.
router.get('/preview', requireAuthPage, (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(template().replace('<!--REPORT_DATA-->', ''));
});

module.exports = router;
