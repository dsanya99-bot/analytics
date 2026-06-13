'use strict';

/* Редактор отчёта: живая модель, дебаунс-предпросмотр в iframe + KPI-полоса, индикатор сохранения. */

const id = location.pathname.split('/').pop();
let model = null;
let slug = '';
let status = 'draft';
let activeIdx = 0;
let previewReady = false;
let dirty = false;

const PALETTE = ['#8a96aa', '#5eead4', '#34d399', '#a3e635', '#22d3ee', '#fbbf24', '#f87171', '#a78bfa'];

const iframe = document.getElementById('preview');
const toastEl = document.getElementById('toast');

// ─── helpers ───────────────────────────────────────────────
function toast(msg, isErr) {
  toastEl.textContent = msg;
  toastEl.className = 'toast show' + (isErr ? ' err' : '');
  setTimeout(() => { toastEl.className = 'toast'; }, 2200);
}
function num(v) {
  const n = typeof v === 'string' ? parseFloat(String(v).replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function parseNums(text) {
  return String(text || '').split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean).map(num).filter(Number.isFinite);
}
function genTraffic(start, growthPct, months) {
  const out = [Math.round(num(start))];
  const g = 1 + num(growthPct) / 100;
  for (let i = 1; i < months; i++) out.push(Math.round(out[i - 1] * g));
  return out;
}
function hexToRgba(hex, a) {
  const m = String(hex || '').match(/^#?([0-9a-f]{6})$/i);
  if (!m) return 'rgba(138,150,170,' + a + ')';
  const n = parseInt(m[1], 16);
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function rubShort(v) {
  if (v >= 1e6) return (v / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млн';
  if (v >= 1e3) return Math.round(v / 1e3).toLocaleString('ru-RU') + ' тыс';
  return Math.round(v || 0).toLocaleString('ru-RU');
}
async function api(url, opts) {
  const res = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
  if (res.status === 401) { window.location.href = '/login'; throw new Error('unauth'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}
function el(tag, props, children) {
  const e = document.createElement(tag);
  if (props) Object.keys(props).forEach((k) => {
    if (k === 'class') e.className = props[k];
    else if (k === 'text') e.textContent = props[k];
    else if (k === 'onClick') e.addEventListener('click', props[k]);
    else if (k === 'style') e.setAttribute('style', props[k]);
    else e.setAttribute(k, props[k]);
  });
  (children || []).forEach((ch) => { if (ch != null) e.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch); });
  return e;
}
function input(value, type, onInput, attrs) {
  const i = el('input', Object.assign({ type: type || 'text' }, attrs || {}));
  i.value = value == null ? '' : value;
  if (onInput) i.addEventListener('input', () => onInput(i.value));
  return i;
}
function field(labelText, inputEl, hint) {
  return el('div', { class: 'field' }, [el('label', { text: labelText }), inputEl, hint ? el('div', { class: 'hint', text: hint }) : null]);
}
function kchip(v, l, accent) {
  return el('div', { class: 'chip' }, [el('div', { class: 'v' + (accent ? ' accent' : ''), text: v }), el('div', { class: 'l', text: l })]);
}

// ─── модель ↔ отчёт ────────────────────────────────────────
function fromReport(d) {
  d = d || {};
  const c = d.constants || {};
  return {
    client: { name: (d.client && d.client.name) || '', url: (d.client && d.client.url) || '' },
    title: d.title || '', eyebrow: d.eyebrow || '',
    horizon: d.horizon || 15, currentTraffic: d.currentTraffic || 0,
    constants: {
      convPct: (c.convVisitToLead != null ? c.convVisitToLead : 0.01) * 100,
      retentionPct: (c.retention != null ? c.retention : 0.75) * 100,
      revenuePerClient: c.revenuePerClient != null ? c.revenuePerClient : 2500,
    },
    scenarios: (d.scenarios || []).map((s) => ({
      id: s.id || 'sc', name: s.name || '', sub: s.sub || '',
      colorRaw: s.colorRaw || '#8a96aa', soft: s.soft || '',
      invest: s.invest || 0,
      breakdownRows: Object.keys(s.breakdown || {}).map((k) => ({ label: k, amount: s.breakdown[k] })),
      trafficText: (s.traffic || []).join(', '),
    })),
  };
}
function toReport(m) {
  return {
    client: { name: m.client.name, url: m.client.url },
    title: m.title, eyebrow: m.eyebrow,
    horizon: Math.round(num(m.horizon)) || 15,
    currentTraffic: num(m.currentTraffic),
    constants: {
      convVisitToLead: num(m.constants.convPct) / 100,
      retention: num(m.constants.retentionPct) / 100,
      revenuePerClient: num(m.constants.revenuePerClient),
    },
    scenarios: m.scenarios.map((s) => ({
      id: s.id, name: s.name, sub: s.sub, colorRaw: s.colorRaw, soft: s.soft || hexToRgba(s.colorRaw, 0.18),
      invest: num(s.invest),
      breakdown: s.breakdownRows.reduce((o, r) => { const l = String(r.label || '').trim(); if (l) o[l] = num(r.amount); return o; }, {}),
      traffic: parseNums(s.trafficText),
    })),
  };
}

// ─── индикатор сохранения ──────────────────────────────────
function updateSaveState() {
  const e = document.getElementById('save-state');
  if (dirty) { e.textContent = '● не сохранено'; e.className = 'save-state dirty'; }
  else { e.textContent = '✓ сохранено'; e.className = 'save-state saved'; }
}
function markDirty() { dirty = true; updateSaveState(); }

// ─── KPI-полоса (активный сценарий) ────────────────────────
function renderKpiStrip() {
  const strip = document.getElementById('kpi-strip');
  if (!strip || !model) return;
  let s = null;
  try { s = ReportEngine.buildScenarios(toReport(model))[activeIdx]; } catch (_) {}
  strip.replaceChildren();
  if (!s) return;
  const i = Math.min(11, s.months - 1);
  const base = num(model.currentTraffic);
  strip.appendChild(kchip(base > 0 ? '×' + (s.traffic[i] / base).toFixed(1) : '—', 'трафик, ' + (i + 1) + ' мес'));
  strip.appendChild(kchip(rubShort(s.revenue[i] || 0), 'выручка/мес', true));
  strip.appendChild(kchip((s.roi[i] != null ? Math.round(s.roi[i] * 100) : '—') + '%', 'окупаемость'));
  strip.appendChild(kchip(s.clients[i] != null ? Math.round(s.clients[i]) : '—', 'клиентов/мес'));
}

// ─── рендер формы ──────────────────────────────────────────
function setName() {
  document.getElementById('report-name').textContent = model.client.name || model.title || 'Отчёт';
}
function updateStatusBadge() {
  const b = document.getElementById('status-badge');
  b.className = 'badge ' + (status === 'published' ? 'published' : 'draft');
  b.textContent = status === 'published' ? 'опубликован' : 'черновик';
  document.getElementById('btn-publish').textContent = status === 'published' ? 'Снять с публикации' : 'Опубликовать';
}

function renderProjectFields() {
  const p = document.getElementById('project-fields');
  p.replaceChildren();
  p.appendChild(field('Название клиента', input(model.client.name, 'text', (v) => { model.client.name = v; setName(); markDirty(); schedule(); })));
  p.appendChild(field('Сайт клиента (URL)', input(model.client.url, 'url', (v) => { model.client.url = v; markDirty(); schedule(); }), 'Только http:// или https://'));
  p.appendChild(field('Заголовок отчёта', input(model.title, 'text', (v) => { model.title = v; markDirty(); schedule(); })));
  p.appendChild(field('Плашка над заголовком', input(model.eyebrow, 'text', (v) => { model.eyebrow = v; markDirty(); schedule(); })));
  const row = el('div', { class: 'row2' });
  row.appendChild(field('Горизонт, мес.', input(model.horizon, 'number', (v) => { model.horizon = v; markDirty(); schedule(); }, { min: 1, max: 36 })));
  row.appendChild(field('Базовый трафик/мес', input(model.currentTraffic, 'number', (v) => { model.currentTraffic = v; markDirty(); schedule(); }, { min: 0 })));
  p.appendChild(row);
  const row2 = el('div', { class: 'row2' });
  row2.appendChild(field('Конверсия визит→лид, %', input(model.constants.convPct, 'number', (v) => { model.constants.convPct = v; markDirty(); schedule(); }, { step: '0.1', min: 0 })));
  row2.appendChild(field('Удержание клиентов/мес, %', input(model.constants.retentionPct, 'number', (v) => { model.constants.retentionPct = v; markDirty(); schedule(); }, { step: '1', min: 0, max: 100 })));
  p.appendChild(row2);
  p.appendChild(field('Выручка с клиента/мес, ₽', input(model.constants.revenuePerClient, 'number', (v) => { model.constants.revenuePerClient = v; markDirty(); schedule(); }, { min: 0 }), 'В другом проекте было 30000 — меняйте под клиента'));
}

function renderScenarioTabs() {
  const tabs = document.getElementById('scen-tabs');
  tabs.replaceChildren();
  model.scenarios.forEach((s, i) => {
    const t = el('button', { class: 'scen-tab' + (i === activeIdx ? ' active' : ''), onClick: () => { activeIdx = i; renderScenarioTabs(); renderScenarioFields(); } });
    const dot = el('span', { class: 'dot' }); dot.style.background = s.colorRaw;
    t.appendChild(dot);
    t.appendChild(document.createTextNode(s.name || ('Сценарий ' + (i + 1))));
    tabs.appendChild(t);
  });
}

function updateBdSum() {
  const s = model.scenarios[activeIdx]; if (!s) return;
  const e = document.getElementById('bd-sum'); if (!e) return;
  const sum = s.breakdownRows.reduce((a, r) => a + num(r.amount), 0);
  const inv = num(s.invest);
  const mismatch = inv && Math.abs(sum - inv) > 1;
  e.className = 'bd-sum' + (mismatch ? ' warn' : '');
  let txt = 'Сумма разбивки: ' + sum.toLocaleString('ru-RU') + ' ₽';
  if (mismatch) txt += ' · бюджет ' + inv.toLocaleString('ru-RU') + ' ₽ — не совпадает';
  e.textContent = txt;
}

function renderScenarioFields() {
  const c = document.getElementById('scenario-fields');
  c.replaceChildren();
  const s = model.scenarios[activeIdx];
  if (!s) return;

  c.appendChild(field('Название сценария', input(s.name, 'text', (v) => { s.name = v; renderScenarioTabs(); markDirty(); schedule(); })));
  const colorInput = input(s.colorRaw, 'color', (v) => { s.colorRaw = v; s.soft = hexToRgba(v, 0.18); renderScenarioTabs(); markDirty(); schedule(); });
  const row = el('div', { class: 'row2' });
  row.appendChild(field('Подпись', input(s.sub, 'text', (v) => { s.sub = v; markDirty(); schedule(); })));
  row.appendChild(field('Цвет', colorInput));
  c.appendChild(row);
  const presets = el('div', { class: 'presets' }, [el('span', { class: 'hint', text: 'Пресеты:' })]);
  PALETTE.forEach((col) => {
    const sw = el('button', { class: 'swatch', title: col, onClick: () => { s.colorRaw = col; s.soft = hexToRgba(col, 0.18); colorInput.value = col; renderScenarioTabs(); markDirty(); schedule(); } });
    sw.style.background = col;
    presets.appendChild(sw);
  });
  c.appendChild(presets);

  c.appendChild(el('div', { class: 'field', style: 'margin-top:14px' }, [el('label', { text: 'Бюджет/мес, ₽' }), input(s.invest, 'number', (v) => { s.invest = v; updateBdSum(); markDirty(); schedule(); }, { min: 0 })]));

  c.appendChild(el('label', { text: 'Разбивка расходов' }));
  s.breakdownRows.forEach((r, ri) => {
    const bdRow = el('div', { class: 'bd-row' });
    bdRow.appendChild(input(r.label, 'text', (v) => { r.label = v; markDirty(); schedule(); }, { placeholder: 'Статья' }));
    bdRow.appendChild(input(r.amount, 'number', (v) => { r.amount = v; updateBdSum(); markDirty(); schedule(); }, { min: 0, placeholder: '₽' }));
    bdRow.appendChild(el('button', { class: 'x', text: '×', title: 'Удалить', onClick: () => { s.breakdownRows.splice(ri, 1); renderScenarioFields(); markDirty(); schedule(); } }));
    c.appendChild(bdRow);
  });
  c.appendChild(el('button', { class: 'btn btn-sm', text: '+ Статья', style: 'margin-top:4px', onClick: () => { s.breakdownRows.push({ label: '', amount: 0 }); renderScenarioFields(); } }));
  c.appendChild(el('div', { class: 'bd-sum', id: 'bd-sum' }));
  updateBdSum();

  const taWrap = el('div', { class: 'field', style: 'margin-top:16px' }, [el('label', { text: 'Трафик по месяцам (через запятую/пробел)' })]);
  const ta = el('textarea', { placeholder: '5000, 5849, 6815, ...' });
  ta.value = s.trafficText;
  ta.addEventListener('input', () => { s.trafficText = ta.value; markDirty(); schedule(); });
  taWrap.appendChild(ta);
  c.appendChild(taWrap);

  const startIn = input(model.currentTraffic, 'number', null, { min: 0 });
  const growthIn = input(15, 'number', null, { step: '1' });
  const gen = el('div', { class: 'gen-row' }, [
    field('Старт', startIn),
    field('Рост, %/мес', growthIn),
    el('button', { class: 'btn btn-sm', text: 'Сгенерировать', onClick: () => {
      const months = Math.max(1, Math.round(num(model.horizon)) || 15);
      const arr = genTraffic(num(startIn.value), num(growthIn.value), months);
      s.trafficText = arr.join(', '); ta.value = s.trafficText; markDirty(); schedule();
    } }),
  ]);
  c.appendChild(gen);

  renderKpiStrip();
}

// ─── предпросмотр ──────────────────────────────────────────
function postPreview() {
  if (!previewReady || !model || !iframe.contentWindow) return;
  iframe.contentWindow.postMessage({ type: 'report:update', report: toReport(model) }, location.origin);
}
function syncPreview() { postPreview(); renderKpiStrip(); }
let previewTimer = null;
function schedule() { clearTimeout(previewTimer); previewTimer = setTimeout(syncPreview, 250); }

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || !e.data) return;
  if (e.data.type === 'report:ready') { previewReady = true; postPreview(); }
});
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

// ─── действия ──────────────────────────────────────────────
async function save() {
  try {
    const rep = await api('/api/projects/' + id, { method: 'PUT', body: JSON.stringify({ data: toReport(model), status }) });
    slug = rep.slug; status = rep.status; updateStatusBadge();
    dirty = false; updateSaveState();
    toast('Сохранено');
  } catch (e) { if (e.message !== 'unauth') toast(e.message, true); }
}
function reportUrl() { return location.origin + '/r/' + slug; }

document.getElementById('btn-save').addEventListener('click', save);
document.getElementById('btn-publish').addEventListener('click', async () => {
  status = status === 'published' ? 'draft' : 'published';
  await save();
});
document.getElementById('btn-open').addEventListener('click', () => window.open(reportUrl(), '_blank', 'noopener'));
document.getElementById('btn-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(reportUrl()); toast('Ссылка скопирована'); }
  catch (_) { toast(reportUrl()); }
});
document.getElementById('btn-rotate').addEventListener('click', async () => {
  if (!confirm('Перевыпустить ссылку? Старая ссылка перестанет работать.')) return;
  try { const rep = await api('/api/projects/' + id + '/rotate-slug', { method: 'POST' }); slug = rep.slug; toast('Новая ссылка готова'); }
  catch (e) { toast(e.message, true); }
});

// ─── старт ─────────────────────────────────────────────────
(async function load() {
  try {
    const rep = await api('/api/projects/' + id);
    slug = rep.slug; status = rep.status;
    model = fromReport(rep.data);
    setName(); updateStatusBadge();
    renderProjectFields(); renderScenarioTabs(); renderScenarioFields();
    dirty = false; updateSaveState();
    syncPreview();
  } catch (e) { if (e.message !== 'unauth') toast(e.message, true); }
})();
