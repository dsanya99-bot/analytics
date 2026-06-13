'use strict';

/** CRUD по отчётам — всё под авторизацией. */

const express = require('express');
const reports = require('../db/reports');
const { sanitizeReport } = require('../util/sanitize');
const { defaultReport } = require('../data/defaults');
const { requireAuthApi } = require('../auth/middleware');
const { buildScenarios } = require('../../public/assets/engine.js');

const router = express.Router();

router.use(requireAuthApi);
router.use(express.json({ limit: '1mb' }));

function normStatus(v) {
  return v === 'published' || v === 'draft' ? v : undefined;
}

// Краткая сводка для карточки кабинета (считаем движком на сервере).
function summarize(data) {
  try {
    const scs = buildScenarios(data);
    if (!scs.length) return null;
    const s = scs.find((x) => x.id === 'bal') || scs[Math.floor(scs.length / 2)] || scs[0];
    const i = Math.min(11, s.months - 1); // 12-й месяц или последний
    const base = Number(data.currentTraffic) || 0;
    return {
      scenarioName: s.name,
      color: s.colorRaw || '#4ade80',
      monthIndex: i + 1,
      trafficX: base > 0 ? +(s.traffic[i] / base).toFixed(1) : null,
      revenue: Math.round(s.revenue[i] || 0),
      roi: s.roi[i] != null ? Math.round(s.roi[i] * 100) : null,
    };
  } catch (_) {
    return null;
  }
}

// Список отчётов (для кабинета) — с сайтом, числом сценариев и KPI-сводкой
router.get('/', (req, res) => {
  const items = reports.listFull().map((r) => ({
    id: r.id, slug: r.slug, clientName: r.clientName, title: r.title, status: r.status,
    createdAt: r.createdAt, updatedAt: r.updatedAt,
    clientUrl: (r.data && r.data.client && r.data.client.url) || '',
    scenarioCount: (r.data && r.data.scenarios && r.data.scenarios.length) || 0,
    kpi: summarize(r.data),
  }));
  res.json({ reports: items });
});

// Создать новый отчёт — засеян дефолтным шаблоном (готов к правке/предпросмотру)
router.post('/', (req, res) => {
  const data = sanitizeReport(defaultReport());
  const rep = reports.create({
    clientName: data.client.name,
    title: data.title,
    status: 'draft',
    data,
  });
  res.status(201).json(rep);
});

// Загрузить отчёт в редактор (сырые данные — текст не экранирован)
router.get('/:id', (req, res) => {
  const rep = reports.getById(req.params.id);
  if (!rep) return res.status(404).json({ error: 'Не найдено' });
  res.json(rep);
});

// Сохранить отчёт
router.put('/:id', (req, res) => {
  const body = req.body || {};
  const data = sanitizeReport(body.data || {});
  const rep = reports.update(req.params.id, {
    clientName: data.client.name,
    title: data.title,
    status: normStatus(body.status),
    data,
  });
  if (!rep) return res.status(404).json({ error: 'Не найдено' });
  res.json(rep);
});

// Дублировать как черновик (переиспользование как шаблона)
router.post('/:id/duplicate', (req, res) => {
  const src = reports.getById(req.params.id);
  if (!src) return res.status(404).json({ error: 'Не найдено' });
  const rep = reports.create({
    clientName: src.clientName,
    title: (src.title || 'Отчёт') + ' (копия)',
    status: 'draft',
    data: src.data,
  });
  res.status(201).json(rep);
});

// Опубликовать
router.post('/:id/publish', (req, res) => {
  const rep = reports.update(req.params.id, { status: 'published' });
  if (!rep) return res.status(404).json({ error: 'Не найдено' });
  res.json(rep);
});

// Перевыпустить публичную ссылку (отозвать старую)
router.post('/:id/rotate-slug', (req, res) => {
  const rep = reports.rotateSlug(req.params.id);
  if (!rep) return res.status(404).json({ error: 'Не найдено' });
  res.json(rep);
});

// Удалить
router.delete('/:id', (req, res) => {
  const ok = reports.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Не найдено' });
  res.json({ ok: true });
});

module.exports = router;
