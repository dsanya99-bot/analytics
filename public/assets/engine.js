/* ============================================================
   ДВИЖОК ФИНМОДЕЛИ — детерминированный, без побочных эффектов.
   Реверс-инжинирен из исходного отчёта и проверен на числах
   (сходимость до ~0.05 ₽ — это округления Excel-выгрузки).

   Хранятся ТОЛЬКО входные данные на сценарий:
     traffic[]  — кривая визитов по месяцам
     invest     — бюджет ₽/мес (число) или массив по месяцам
     breakdown  — разбивка расходов { 'Контент': 160000, ... }
   и константы проекта:
     convVisitToLead (1%), retention (75%), revenuePerClient (2500 ₽)

   Всё остальное (лиды, клиенты, выручка, ROI, стоимости) —
   ВЫЧИСЛЯЕТСЯ здесь, никогда не хранится.

   Работает и в браузере (window.ReportEngine), и в Node (require).
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReportEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULTS = { convVisitToLead: 0.01, retention: 0.75, revenuePerClient: 2500 };

  function num(v) {
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function toInvestArray(invest, months) {
    if (Array.isArray(invest)) {
      const a = invest.map(num).slice(0, months);
      while (a.length < months) a.push(a.length ? a[a.length - 1] : 0);
      return a;
    }
    return Array(months).fill(num(invest));
  }

  /**
   * Считает один сценарий: дополняет входной объект производными рядами.
   * @returns копия сценария со всеми рядами, нужными рендереру.
   */
  function computeScenario(scenario, constants) {
    const C = Object.assign({}, DEFAULTS, constants || {}, scenario.overrides || {});
    const traffic = (scenario.traffic || []).map(num);
    const months = traffic.length;
    const investSeries = toInvestArray(scenario.invest, months);

    const leads = [], clients = [], revenue = [], roi = [];
    const rubPerVisit = [], cpl = [], rubPerClientCost = [];

    for (let i = 0; i < months; i++) {
      const t = traffic[i];
      // ₽ за визит определён уже с 1-го месяца (нужен только трафик)
      rubPerVisit[i] = t > 0 ? investSeries[i] / t : null;

      if (i === 0) {
        // Первый месяц: воронка ещё не раскрутилась — null'ы (Chart.js их пропустит)
        leads[i] = null; clients[i] = null; revenue[i] = 0;
        roi[i] = null; cpl[i] = null; rubPerClientCost[i] = null;
        continue;
      }

      leads[i] = t * C.convVisitToLead;
      const prevClients = i === 1 ? 0 : clients[i - 1]; // защита от null * 0.75 = NaN
      clients[i] = prevClients * C.retention + leads[i];
      revenue[i] = clients[i] * C.revenuePerClient;

      roi[i] = investSeries[i] > 0 ? revenue[i] / investSeries[i] : null;
      cpl[i] = leads[i] > 0 ? investSeries[i] / leads[i] : null;
      rubPerClientCost[i] = clients[i] > 0 ? investSeries[i] / clients[i] : null;
    }

    const investTotal = investSeries.reduce((a, b) => a + b, 0);
    const revenueTotal = revenue.reduce((a, b) => a + (b || 0), 0);

    return Object.assign({}, scenario, {
      months,
      traffic,
      invest: num(Array.isArray(scenario.invest) ? investSeries[1] || investSeries[0] : scenario.invest),
      investSeries,
      rubPerClient: C.revenuePerClient,
      leads, clients, revenue, roi, rubPerVisit, cpl, rubPerClientCost,
      totals: {
        investTotal,
        revenueTotal,
        clientsEnd: clients[months - 1],
        roiOverall: investTotal > 0 ? revenueTotal / investTotal : null,
      },
    });
  }

  /**
   * Принимает сохранённый объект отчёта и возвращает массив сценариев
   * со всеми производными рядами — ровно в той форме, что ждёт рендерер.
   */
  function buildScenarios(report) {
    const constants = report.constants || {};
    return (report.scenarios || []).map((s) => computeScenario(s, constants));
  }

  /** Генерация кривой трафика из «старт + рост %» — удобство для новых клиентов. */
  function generateTraffic(start, monthlyGrowthPct, months) {
    const out = [num(start)];
    const g = 1 + num(monthlyGrowthPct) / 100;
    for (let i = 1; i < months; i++) out.push(out[i - 1] * g);
    return out.map((v) => Math.round(v));
  }

  return { DEFAULTS, computeScenario, buildScenarios, generateTraffic };
});
