// Capa de datos.
// - Si existe DATABASE_URL o POSTGRES_URL  -> usa Postgres (Vercel/Neon, Supabase, Render, etc.)
// - Si no                                  -> usa SQLite local en data/encuesta.db (instalación en una PC)
const path = require('path');
const fs = require('fs');

const PG_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

function crearPostgres() {
  const { Pool } = require('pg');
  const local = /localhost|127\.0\.0\.1/.test(PG_URL);
  const pool = new Pool({ connectionString: PG_URL, ssl: local ? false : { rejectUnauthorized: false }, max: 3 });
  let listo;
  const init = () => (listo ??= pool.query(`
    CREATE TABLE IF NOT EXISTS respuestas (
      id SERIAL PRIMARY KEY,
      fecha TEXT NOT NULL,
      departamento TEXT NOT NULL,
      antiguedad TEXT NOT NULL,
      escala JSONB NOT NULL,
      abiertas JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT);
    INSERT INTO config (clave, valor) VALUES ('abierta', '1') ON CONFLICT (clave) DO NOTHING;
  `).catch(e => { listo = null; throw e; }));
  const q = async (sql, params) => { await init(); return (await pool.query(sql, params)).rows; };

  return {
    tipo: 'postgres',
    async getConfig(k) { return (await q('SELECT valor FROM config WHERE clave=$1', [k]))[0]?.valor; },
    async setConfig(k, v) { await q('INSERT INTO config (clave, valor) VALUES ($1,$2) ON CONFLICT (clave) DO UPDATE SET valor=EXCLUDED.valor', [k, String(v)]); },
    async insertar(r) {
      return (await q('INSERT INTO respuestas (fecha, departamento, antiguedad, escala, abiertas) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [r.fecha, r.departamento, r.antiguedad, JSON.stringify(r.escala), JSON.stringify(r.abiertas)]))[0].id;
    },
    async todas(orden = 'DESC') { return q(`SELECT * FROM respuestas ORDER BY id ${orden === 'ASC' ? 'ASC' : 'DESC'}`); },
    async eliminar(id) { return (await q('DELETE FROM respuestas WHERE id=$1 RETURNING id', [id])).length > 0; },
  };
}

function crearSqlite() {
  const Database = require('better-sqlite3');
  const dir = process.env.DATA_DIR || path.join(__dirname, 'data');
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, 'encuesta.db'));
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS respuestas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL, departamento TEXT NOT NULL, antiguedad TEXT NOT NULL,
      escala TEXT NOT NULL, abiertas TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT);
    INSERT OR IGNORE INTO config (clave, valor) VALUES ('abierta', '1');
  `);
  const parse = r => ({ ...r, escala: JSON.parse(r.escala), abiertas: JSON.parse(r.abiertas) });
  return {
    tipo: 'sqlite',
    async getConfig(k) { return db.prepare('SELECT valor FROM config WHERE clave=?').get(k)?.valor; },
    async setConfig(k, v) { db.prepare('INSERT INTO config (clave, valor) VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor').run(k, String(v)); },
    async insertar(r) {
      return db.prepare('INSERT INTO respuestas (fecha, departamento, antiguedad, escala, abiertas) VALUES (?,?,?,?,?)')
        .run(r.fecha, r.departamento, r.antiguedad, JSON.stringify(r.escala), JSON.stringify(r.abiertas)).lastInsertRowid;
    },
    async todas(orden = 'DESC') { return db.prepare(`SELECT * FROM respuestas ORDER BY id ${orden === 'ASC' ? 'ASC' : 'DESC'}`).all().map(parse); },
    async eliminar(id) { return db.prepare('DELETE FROM respuestas WHERE id=?').run(id).changes > 0; },
  };
}

function crearFaltante() {
  const err = async () => {
    throw Object.assign(new Error('Base de datos no configurada. En Vercel, conecta una base de datos Postgres (Storage → Neon) para crear la variable DATABASE_URL y vuelve a desplegar.'), { status: 503 });
  };
  return { tipo: 'ninguna', getConfig: err, setConfig: err, insertar: err, todas: err, eliminar: err };
}

let db;
if (PG_URL) db = crearPostgres();
else if (process.env.VERCEL) db = crearFaltante(); // en Vercel no se puede escribir en disco
else db = crearSqlite();

module.exports = db;