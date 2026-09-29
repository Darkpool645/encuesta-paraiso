// Servidor – Encuesta de Clima Laboral · Paraíso Country Club
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const Database = require('better-sqlite3');
const S = require('./survey');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Paraiso2026';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SESSION_HOURS = 8;

if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠  ADMIN_PASSWORD no está definido. Se usa la contraseña por defecto "Paraiso2026". Cámbiala en el archivo .env');
}

// ---------- Base de datos ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'encuesta.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS respuestas (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha        TEXT NOT NULL,          -- solo fecha (sin hora) para proteger el anonimato
    departamento TEXT NOT NULL,
    antiguedad   TEXT NOT NULL,
    escala       TEXT NOT NULL,          -- JSON {p3: 1..5 | 0 (No aplica)}
    abiertas     TEXT NOT NULL           -- JSON {p29: "...", ...}
  );
  CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT);
  INSERT OR IGNORE INTO config (clave, valor) VALUES ('abierta', '1');
`);
const getConfig = k => db.prepare('SELECT valor FROM config WHERE clave=?').get(k)?.valor;
const setConfig = (k, v) => db.prepare('INSERT INTO config (clave, valor) VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor').run(k, String(v));

// ---------- Sesiones de administrador ----------
const sesiones = new Map(); // token -> expiración
const intentos = new Map(); // ip -> {n, hasta}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}
function requireAdmin(req, res, next) {
  const token = parseCookies(req).admin_session;
  const exp = token && sesiones.get(token);
  if (!exp || exp < Date.now()) {
    if (token) sesiones.delete(token);
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}
function passwordOk(input) {
  const a = crypto.createHash('sha256').update(String(input || '')).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

// ---------- App ----------
const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('/api/encuesta', (req, res) => {
  res.json({
    abierta: getConfig('abierta') === '1',
    departamentos: S.DEPARTAMENTOS, antiguedad: S.ANTIGUEDAD,
    escala: S.ESCALA, rubros: S.RUBROS, abiertas: S.ABIERTAS,
  });
});

app.post('/api/respuestas', (req, res) => {
  if (getConfig('abierta') !== '1') return res.status(403).json({ error: 'La encuesta está cerrada en este momento.' });
  const { departamento, antiguedad, escala = {}, abiertas = {} } = req.body || {};
  if (!S.DEPARTAMENTOS.includes(departamento)) return res.status(400).json({ error: 'Selecciona tu departamento.' });
  if (!S.ANTIGUEDAD.includes(antiguedad)) return res.status(400).json({ error: 'Selecciona tu antigüedad.' });
  const esc = {};
  for (const p of S.PREGUNTAS_ESCALA) {
    const v = Number(escala[p.id]);
    if (!Number.isInteger(v) || v < 0 || v > 5) return res.status(400).json({ error: `Falta responder la pregunta ${p.num}.` });
    esc[p.id] = v;
  }
  const abi = {};
  for (const p of S.ABIERTAS) abi[p.id] = String(abiertas[p.id] || '').trim().slice(0, 2000);
  const fecha = new Date().toISOString().slice(0, 10);
  const info = db.prepare('INSERT INTO respuestas (fecha, departamento, antiguedad, escala, abiertas) VALUES (?,?,?,?,?)')
    .run(fecha, departamento, antiguedad, JSON.stringify(esc), JSON.stringify(abi));
  res.json({ ok: true, folio: info.lastInsertRowid });
});

// --- Administrador ---
app.post('/api/admin/login', (req, res) => {
  const ip = req.ip;
  const reg = intentos.get(ip) || { n: 0, hasta: 0 };
  if (reg.hasta > Date.now()) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
  if (!passwordOk(req.body?.password)) {
    reg.n += 1;
    if (reg.n >= 5) { reg.hasta = Date.now() + 5 * 60 * 1000; reg.n = 0; }
    intentos.set(ip, reg);
    return res.status(401).json({ error: 'Contraseña incorrecta.' });
  }
  intentos.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sesiones.set(token, Date.now() + SESSION_HOURS * 3600 * 1000);
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `admin_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}${secure}`);
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  sesiones.delete(parseCookies(req).admin_session);
  res.setHeader('Set-Cookie', 'admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/admin/respuestas', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM respuestas ORDER BY id DESC').all()
    .map(r => ({ ...r, escala: JSON.parse(r.escala), abiertas: JSON.parse(r.abiertas) }));
  res.json({ abierta: getConfig('abierta') === '1', respuestas: rows });
});

app.post('/api/admin/estado', requireAdmin, (req, res) => {
  setConfig('abierta', req.body?.abierta ? '1' : '0');
  res.json({ ok: true, abierta: getConfig('abierta') === '1' });
});

app.delete('/api/admin/respuestas/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM respuestas WHERE id=?').run(Number(req.params.id));
  res.json({ ok: info.changes > 0 });
});

app.get('/api/admin/export.csv', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM respuestas ORDER BY id').all();
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Folio', 'Fecha', 'Departamento', 'Antigüedad',
    ...S.PREGUNTAS_ESCALA.map(p => `P${p.num}. ${p.texto}`),
    ...S.ABIERTAS.map(p => `P${p.num}. ${p.texto}`)];
  const lines = rows.map(r => {
    const e = JSON.parse(r.escala), a = JSON.parse(r.abiertas);
    return [r.id, r.fecha, r.departamento, r.antiguedad,
      ...S.PREGUNTAS_ESCALA.map(p => (e[p.id] === 0 ? 'No aplica' : e[p.id])),
      ...S.ABIERTAS.map(p => a[p.id])].map(esc).join(',');
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="clima-laboral-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + [header.map(esc).join(','), ...lines].join('\r\n'));
});

app.listen(PORT, () => {
  console.log(`\n  Encuesta de Clima Laboral – Paraíso Country Club`);
  console.log(`  Empleados:      http://localhost:${PORT}/`);
  console.log(`  Administrador:  http://localhost:${PORT}/admin\n`);
});
