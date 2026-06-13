'use strict';

/** Минимальный логгер (без зависимостей): время + уровень + сообщение. */

function ts() {
  return new Date().toISOString();
}
function fmt(level, msg, meta) {
  const tail = meta ? ' ' + JSON.stringify(meta) : '';
  return `${ts()} [${level}] ${msg}${tail}`;
}

module.exports = {
  info: (msg, meta) => console.log(fmt('info', msg, meta)),
  warn: (msg, meta) => console.warn(fmt('warn', msg, meta)),
  error: (msg, meta) => console.error(fmt('error', msg, meta)),
};
