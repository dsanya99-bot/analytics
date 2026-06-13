'use strict';

/** CRUD по отчётам. data_json хранит весь объект отчёта (только входные данные). */

const db = require('./connection');
const { makeId, makeSlug } = require('../util/http');

const insertStmt = db.prepare(`
  INSERT INTO reports (id, slug, client_name, title, status, data_json, created_at, updated_at)
  VALUES (@id, @slug, @client_name, @title, @status, @data_json, @created_at, @updated_at)
`);
const updateStmt = db.prepare(`
  UPDATE reports SET client_name=@client_name, title=@title, status=@status,
         data_json=@data_json, updated_at=@updated_at
  WHERE id=@id
`);
const slugStmt = db.prepare(`UPDATE reports SET slug=@slug, updated_at=@updated_at WHERE id=@id`);
const byIdStmt = db.prepare(`SELECT * FROM reports WHERE id=?`);
const bySlugStmt = db.prepare(`SELECT * FROM reports WHERE slug=?`);
const delStmt = db.prepare(`DELETE FROM reports WHERE id=?`);
const listStmt = db.prepare(`
  SELECT id, slug, client_name, title, status, created_at, updated_at
  FROM reports ORDER BY updated_at DESC
`);
const listFullStmt = db.prepare(`SELECT * FROM reports ORDER BY updated_at DESC`);

function rowToReport(row) {
  if (!row) return null;
  let data = {};
  try { data = JSON.parse(row.data_json); } catch { data = {}; }
  return {
    id: row.id,
    slug: row.slug,
    clientName: row.client_name,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    data,
  };
}

function list() {
  return listStmt.all().map((r) => ({
    id: r.id, slug: r.slug, clientName: r.client_name, title: r.title,
    status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

function listFull() { return listFullStmt.all().map(rowToReport); }
function getById(id) { return rowToReport(byIdStmt.get(id)); }
function getBySlug(slug) { return rowToReport(bySlugStmt.get(slug)); }

function create({ clientName = '', title = '', status = 'published', data = {} }) {
  const now = new Date().toISOString();
  const id = makeId();
  let slug = makeSlug();
  // На всякий случай — гарантируем уникальность slug.
  while (bySlugStmt.get(slug)) slug = makeSlug();
  insertStmt.run({
    id, slug, client_name: clientName, title, status,
    data_json: JSON.stringify(data), created_at: now, updated_at: now,
  });
  return getById(id);
}

function update(id, { clientName, title, status, data }) {
  const existing = byIdStmt.get(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  updateStmt.run({
    id,
    client_name: clientName != null ? clientName : existing.client_name,
    title: title != null ? title : existing.title,
    status: status != null ? status : existing.status,
    data_json: data != null ? JSON.stringify(data) : existing.data_json,
    updated_at: now,
  });
  return getById(id);
}

function rotateSlug(id) {
  if (!byIdStmt.get(id)) return null;
  let slug = makeSlug();
  while (bySlugStmt.get(slug)) slug = makeSlug();
  slugStmt.run({ id, slug, updated_at: new Date().toISOString() });
  return getById(id);
}

function remove(id) { return delStmt.run(id).changes > 0; }

module.exports = { list, listFull, getById, getBySlug, create, update, rotateSlug, remove };
