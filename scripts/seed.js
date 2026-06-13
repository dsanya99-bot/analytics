'use strict';

/** Создаёт демо-отчёт (platipomiru) для проверки. Идемпотентно. */

const reports = require('../src/db/reports');
const { sanitizeReport } = require('../src/util/sanitize');
const { defaultReport } = require('../src/data/defaults');

const data = sanitizeReport(defaultReport());

const dup = reports.list().find((r) => r.clientName === data.client.name && r.title === data.title);
if (dup) {
  console.log('Демо-отчёт уже существует: /r/' + dup.slug + '  (редактор: /editor/' + dup.id + ')');
  process.exit(0);
}

const rep = reports.create({
  clientName: data.client.name,
  title: data.title,
  status: 'published',
  data,
});

console.log('Создан демо-отчёт:');
console.log('  Публичная ссылка: /r/' + rep.slug);
console.log('  Редактор:         /editor/' + rep.id);
