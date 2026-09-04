const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_STORE = path.join(DATA_DIR, 'submissions.json');

let pool = null;
let usePg = false;

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readFileStore() {
  ensureDir();
  if (!fs.existsSync(FILE_STORE)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE_STORE, 'utf8'));
  } catch {
    return [];
  }
}

function writeFileStore(rows) {
  ensureDir();
  fs.writeFileSync(FILE_STORE, JSON.stringify(rows, null, 2));
}

async function init() {
  if (process.env.DATABASE_URL) {
    const ssl = resolveSsl();
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        form_values JSONB NOT NULL,
        docx BYTEA,
        pdf BYTEA
      )
    `);
    usePg = true;
  } else {
    usePg = false;
    ensureDir();
  }
}

function resolveSsl() {
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false };
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (url.searchParams.get('sslmode') === 'require') {
      return { rejectUnauthorized: false };
    }
  } catch {
    /* ignore malformed URL */
  }
  return false;
}

async function save(values, docx, pdf) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (usePg) {
    await pool.query(
      'INSERT INTO reports (id, created_at, form_values, docx, pdf) VALUES ($1, $2, $3, $4, $5)',
      [id, createdAt, JSON.stringify(values), docx || null, pdf || null]
    );
  } else {
    const rows = readFileStore();
    rows.push({ id, createdAt, form_values: values, docx: docx || null, pdf: pdf || null });
    writeFileStore(rows);
  }
  return id;
}

async function list() {
  if (usePg) {
    const res = await pool.query('SELECT id, created_at, form_values FROM reports ORDER BY created_at DESC');
    return res.rows.map((r) => ({ id: r.id, createdAt: r.created_at, form_values: r.form_values }));
  }
  return readFileStore()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((r) => ({ id: r.id, createdAt: r.createdAt, form_values: r.form_values }));
}

async function get(id) {
  if (usePg) {
    const res = await pool.query('SELECT id, created_at, form_values, docx, pdf FROM reports WHERE id = $1', [id]);
    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      createdAt: r.created_at,
      form_values: r.form_values,
      docx: r.docx ? Buffer.from(r.docx) : null,
      pdf: r.pdf ? Buffer.from(r.pdf) : null,
    };
  }
  const row = readFileStore().find((r) => r.id === id);
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.createdAt,
    form_values: row.form_values,
    docx: row.docx ? Buffer.from(row.docx) : null,
    pdf: row.pdf ? Buffer.from(row.pdf) : null,
  };
}

module.exports = { init, save, list, get };
