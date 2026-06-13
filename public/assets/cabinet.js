'use strict';

const listEl = document.getElementById('reports');
const toastEl = document.getElementById('toast');
const summaryEl = document.getElementById('summary');
const searchEl = document.getElementById('search');

let all = [];

// ─── helpers ───────────────────────────────────────────────
function toast(msg, isErr) {
  toastEl.textContent = msg;
  toastEl.className = 'toast show' + (isErr ? ' err' : '');
  setTimeout(() => { toastEl.className = 'toast'; }, 2200);
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
    else e.setAttribute(k, props[k]);
  });
  (children || []).forEach((ch) => { if (ch != null) e.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch); });
  return e;
}
function btn(text, cls, onClick) {
  return el('button', { class: 'btn btn-sm' + (cls ? ' ' + cls : ''), text, onClick });
}
function rubShort(v) {
  if (v >= 1e6) return (v / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млн';
  if (v >= 1e3) return Math.round(v / 1e3).toLocaleString('ru-RU') + ' тыс';
  return Math.round(v || 0).toLocaleString('ru-RU');
}
function relTime(iso) {
  const d = new Date(iso); const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'только что';
  if (s < 3600) return Math.floor(s / 60) + ' мин назад';
  if (s < 86400) return Math.floor(s / 3600) + ' ч назад';
  if (s < 7 * 86400) return Math.floor(s / 86400) + ' дн назад';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function hexToRgba(hex, a) {
  const m = String(hex || '').match(/^#?([0-9a-f]{6})$/i);
  if (!m) return 'rgba(74,222,128,' + a + ')';
  const n = parseInt(m[1], 16);
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function chip(value, label, accent) {
  const c = el('div', { class: 'chip' });
  c.appendChild(el('div', { class: 'v' + (accent ? ' accent' : ''), text: value }));
  c.appendChild(el('div', { class: 'l', text: label }));
  return c;
}

// ─── card ──────────────────────────────────────────────────
function renderCard(r) {
  const color = (r.kpi && r.kpi.color) || '#4ade80';
  const card = el('div', { class: 'card rcard fade-in' });
  card.style.setProperty('--glow', hexToRgba(color, 0.4));

  const accent = el('div', { class: 'rc-bar' });
  accent.style.background = 'linear-gradient(90deg, ' + color + ', transparent)';
  card.appendChild(accent);

  const body = el('div', { class: 'body' });

  const top = el('div', { class: 'rc-top' });
  const nameWrap = el('div', {}, [el('div', { class: 'rc-name', text: r.clientName || 'Без названия' })]);
  if (r.title) nameWrap.appendChild(el('div', { class: 'rc-title', text: r.title }));
  top.appendChild(nameWrap);
  top.appendChild(el('span', { class: 'badge ' + (r.status === 'published' ? 'published' : 'draft'), text: r.status === 'published' ? 'опубликован' : 'черновик' }));
  body.appendChild(top);

  if (r.clientUrl) {
    body.appendChild(el('a', { class: 'rc-url', href: r.clientUrl, target: '_blank', rel: 'noopener', text: r.clientUrl.replace(/^https?:\/\//, '') }));
  }

  if (r.kpi) {
    const chips = el('div', { class: 'rc-chips' });
    chips.appendChild(chip('×' + (r.kpi.trafficX != null ? r.kpi.trafficX : '—'), 'трафик'));
    chips.appendChild(chip(rubShort(r.kpi.revenue), 'выручка/мес', true));
    chips.appendChild(chip((r.kpi.roi != null ? r.kpi.roi : '—') + '%', 'окупаемость'));
    body.appendChild(chips);
    body.appendChild(el('div', { class: 'hint', text: r.kpi.scenarioName + ' · на ' + r.kpi.monthIndex + '-й мес · сценариев: ' + r.scenarioCount }));
  }

  const foot = el('div', { class: 'rc-foot' });
  foot.appendChild(el('div', { class: 'rc-date', text: 'обновлён ' + relTime(r.updatedAt) }));
  const reportUrl = location.origin + '/r/' + r.slug;
  const actions = el('div', { class: 'rc-actions' });
  actions.appendChild(btn('Редактировать', 'btn-primary', () => { window.location.href = '/editor/' + r.id; }));
  actions.appendChild(btn('Открыть', '', () => window.open(reportUrl, '_blank', 'noopener')));
  actions.appendChild(btn('Ссылка', '', async () => {
    try { await navigator.clipboard.writeText(reportUrl); toast('Ссылка скопирована'); } catch (_) { toast(reportUrl); }
  }));
  actions.appendChild(btn('Дубль', '', async () => {
    try { const nr = await api('/api/projects/' + r.id + '/duplicate', { method: 'POST' }); window.location.href = '/editor/' + nr.id; }
    catch (e) { toast(e.message, true); }
  }));
  actions.appendChild(btn('Удалить', 'btn-danger', async () => {
    if (!confirm('Удалить отчёт «' + (r.clientName || r.title) + '»? Действие необратимо.')) return;
    try { await api('/api/projects/' + r.id, { method: 'DELETE' }); load(); toast('Удалено'); }
    catch (e) { toast(e.message, true); }
  }));
  foot.appendChild(actions);
  body.appendChild(foot);

  card.appendChild(body);
  return card;
}

function render(items) {
  listEl.replaceChildren();
  if (!items.length) {
    const empty = el('div', { class: 'empty' });
    empty.appendChild(el('div', { class: 'big', text: all.length ? 'Ничего не найдено' : 'Пока нет отчётов' }));
    empty.appendChild(el('div', { text: all.length ? 'Измените поисковый запрос.' : 'Нажмите «Новый отчёт», чтобы создать первый.' }));
    listEl.appendChild(empty);
    return;
  }
  items.forEach((r) => listEl.appendChild(renderCard(r)));
}

function applyFilter() {
  const q = (searchEl.value || '').trim().toLowerCase();
  if (!q) return render(all);
  render(all.filter((r) =>
    (r.clientName || '').toLowerCase().includes(q) ||
    (r.title || '').toLowerCase().includes(q) ||
    (r.clientUrl || '').toLowerCase().includes(q)
  ));
}

function updateSummary() {
  const pub = all.filter((r) => r.status === 'published').length;
  summaryEl.replaceChildren(
    el('span', {}, [el('b', { text: String(all.length) }), document.createTextNode(' ' + plural(all.length, 'отчёт', 'отчёта', 'отчётов'))]),
    document.createTextNode(' · '),
    el('span', {}, [el('b', { text: String(pub) }), document.createTextNode(' опубликовано')])
  );
}
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

async function load() {
  try {
    const { reports } = await api('/api/projects');
    all = reports;
    updateSummary();
    applyFilter();
  } catch (e) {
    if (e.message !== 'unauth') toast(e.message, true);
  }
}

searchEl.addEventListener('input', applyFilter);
document.getElementById('btn-new').addEventListener('click', async () => {
  try { const nr = await api('/api/projects', { method: 'POST' }); window.location.href = '/editor/' + nr.id; }
  catch (e) { toast(e.message, true); }
});
document.getElementById('btn-logout').addEventListener('click', async () => {
  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (_) {}
  window.location.href = '/login';
});

load();
