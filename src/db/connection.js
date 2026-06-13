'use strict';

/** Подключение к SQLite (better-sqlite3) + схема. Один файл, ноль администрирования. */

const Database = require('better-sqlite3');
const { DB_PATH } = require('../config/env');

const db = new Database(DB_PATH);

// WAL — конкурентное чтение; busy_timeout — мягко переждать редкие блокировки записи.
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS reports (
    id          TEXT PRIMARY KEY,
    slug        TEXT UNIQUE NOT NULL,
    client_name TEXT NOT NULL DEFAULT '',
    title       TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'published',
    data_json   TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_reports_slug ON reports(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_reports_updated ON reports(updated_at DESC)`,
];

for (const stmt of SCHEMA) db.prepare(stmt).run();

module.exports = db;
