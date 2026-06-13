'use strict';

/** Проверяем, что движок воспроизводит исходные (доверенные) ряды отчёта. */

const test = require('node:test');
const assert = require('node:assert');
const { computeScenario } = require('../public/assets/engine.js');
const { defaultReport } = require('../src/data/defaults');

function near(a, b, eps) {
  assert.ok(Math.abs(a - b) <= eps, `ожидалось ~${b}, получено ${a} (eps ${eps})`);
}

test('Стартовый сценарий воспроизводит исходные ряды', () => {
  const r = defaultReport();
  const s = computeScenario(r.scenarios[0], r.constants);

  const expLeads = [null, 58.49, 68.15, 76.28, 89.55];
  const expClients = [null, 58.49, 112.0175, 160.2931, 209.7698];
  const expRevenue = [0, 146225, 280043.75, 400732.8125, 524424.6094];
  const expRoi = [null, 0.3279, 0.6279, 0.8985, 1.1758];

  for (let i = 1; i < expLeads.length; i++) near(s.leads[i], expLeads[i], 0.01);
  for (let i = 1; i < expClients.length; i++) near(s.clients[i], expClients[i], 0.01);
  for (let i = 0; i < expRevenue.length; i++) near(s.revenue[i], expRevenue[i], 0.5);
  for (let i = 1; i < expRoi.length; i++) near(s.roi[i], expRoi[i], 0.001);

  // месяц 1 — null'ы (кроме revenue=0 и rubPerVisit, который зависит только от трафика)
  assert.strictEqual(s.leads[0], null);
  assert.strictEqual(s.clients[0], null);
  assert.strictEqual(s.revenue[0], 0);
  near(s.rubPerVisit[0], 446000 / 5000, 0.01);
});

test('Деление на ноль не даёт NaN/Infinity', () => {
  const s = computeScenario(
    { invest: 100000, traffic: [0, 0, 1000] },
    { convVisitToLead: 0.01, retention: 0.75, revenuePerClient: 2500 }
  );
  assert.strictEqual(s.rubPerVisit[0], null);
  assert.strictEqual(s.cpl[1], null); // leads=0
  assert.ok(Number.isFinite(s.revenue[2]));
});
