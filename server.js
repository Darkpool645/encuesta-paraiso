// Servidor – Encuesta de Clima Laboral · Paraíso Country Club
// Funciona en una PC/servidor propio (npm start) y en Vercel (se exporta la app).
require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const S = require('./survey');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Paraiso2026';
const SESSION_HOURS = 8;
// Firma de la sesión: si cambias ADMIN_PASSWORD, todas las sesiones abiertas se cierran.
const SECRET = crypto.createHash('sha256').update('paraiso:' + (process.env.SESSION_SECRET || ADMIN_PASSWORD)).digest();

if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠  ADMIN_PASSWORD no está definido. Se usa la contraseña por defecto "Paraiso2026".');
}

// ---------- Sesión de administrador (cookie firmada, sin estado en el servidor) ----------
const firmar = exp => crypto.createHmac('sha256', SECRET).update(String(exp)).digest('hex');
function crearToken() {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  return `${exp}.${firmar(exp)}`;
}
function tokenValido(token) {
  const [exp, sig] = String(token || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(firmar(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}
function requireAdmin(req, res, next) {
  if (!tokenValido(parseCookies(req).admin_session)) return res.status(401).json({ error: 'No autorizado' });
  next();
}
function passwordOk(input) {
  const a = crypto.createHash('sha256').update(String(input || '')).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}
const intentos = new Map(); // límite básico de intentos por IP (por instancia)

const h = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- App ----------
const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.get('/api/encuesta', h(async (req, res) => {
  res.json({
    abierta: (await db.getConfig('abierta')) === '1',
    departamentos: S.DEPARTAMENTOS, antiguedad: S.ANTIGUEDAD,
    escala: S.ESCALA, rubros: S.RUBROS, abiertas: S.ABIERTAS,
  });
}));

app.post('/api/respuestas', h(async (req, res) => {
  if ((await db.getConfig('abierta')) !== '1') return res.status(403).json({ error: 'La encuesta está cerrada en este momento.' });
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
  const fecha = new Date().toISOString().slice(0, 10); // solo fecha, sin hora, para proteger el anonimato
  const folio = await db.insertar({ fecha, departamento, antiguedad, escala: esc, abiertas: abi });
  res.json({ ok: true, folio });
}));

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
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `admin_session=${crearToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}${secure}`);
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/admin/respuestas', requireAdmin, h(async (req, res) => {
  res.json({ abierta: (await db.getConfig('abierta')) === '1', respuestas: await db.todas('DESC') });
}));

app.post('/api/admin/estado', requireAdmin, h(async (req, res) => {
  await db.setConfig('abierta', req.body?.abierta ? '1' : '0');
  res.json({ ok: true, abierta: (await db.getConfig('abierta')) === '1' });
}));

app.delete('/api/admin/respuestas/:id', requireAdmin, h(async (req, res) => {
  res.json({ ok: await db.eliminar(Number(req.params.id)) });
}));

app.get('/api/admin/export.csv', requireAdmin, h(async (req, res) => {
  const rows = await db.todas('ASC');
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Folio', 'Fecha', 'Departamento', 'Antigüedad',
    ...S.PREGUNTAS_ESCALA.map(p => `P${p.num}. ${p.texto}`),
    ...S.ABIERTAS.map(p => `P${p.num}. ${p.texto}`)];
  const lines = rows.map(r => [r.id, r.fecha, r.departamento, r.antiguedad,
    ...S.PREGUNTAS_ESCALA.map(p => (r.escala[p.id] === 0 ? 'No aplica' : r.escala[p.id])),
    ...S.ABIERTAS.map(p => r.abiertas[p.id])].map(esc).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="clima-laboral-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('\uFEFF' + [header.map(esc).join(','), ...lines].join('\r\n'));
}));

app.get('/api/salud', h(async (req, res) => {
  await db.getConfig('abierta');
  res.json({ ok: true, baseDeDatos: db.tipo });
}));

// Errores: siempre JSON con un mensaje claro
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Error del servidor. Revisa la conexión a la base de datos.' });
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  Encuesta de Clima Laboral – Paraíso Country Club  (base de datos: ${db.tipo})`);
    console.log(`  Empleados:      http://localhost:${PORT}/`);
    console.log(`  Administrador:  http://localhost:${PORT}/admin\n`);
  });
}