// Panel de administración – resultados de la encuesta
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MIN_GRUPO = 3; // tamaño mínimo de grupo para proteger el anonimato
  const COLORES = { 1: 'var(--s1)', 2: 'var(--s2)', 3: 'var(--s3)', 4: 'var(--s4)', 5: 'var(--s5)', 0: 'var(--s0)' };

  let E = null, datos = [], abierta = true, tab = 'resumen';

  // ---------- Autenticación ----------
  $('#formLogin').onsubmit = async ev => {
    ev.preventDefault();
    $('#errLogin').textContent = '';
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#pass').value }) });
    if (!r.ok) { $('#errLogin').textContent = (await r.json()).error || 'Error'; return; }
    $('#pass').value = '';
    iniciar();
  };
  $('#btnSalir').onclick = async () => { await fetch('/api/admin/logout', { method: 'POST' }); location.reload(); };

  async function cargar() {
    const r = await fetch('/api/admin/respuestas');
    if (r.status === 401) return false;
    const j = await r.json();
    datos = j.respuestas; abierta = j.abierta;
    return true;
  }

  async function iniciar() {
    if (!E) E = await (await fetch('/api/encuesta')).json();
    if (!(await cargar())) { $('#vistaLogin').classList.remove('oculto'); return; }
    $('#vistaLogin').classList.add('oculto');
    $('#vistaAdmin').classList.remove('oculto');
    $('#accionesCab').classList.remove('oculto');
    if ($('#fDep').options.length === 1) {
      E.departamentos.forEach(d => $('#fDep').add(new Option(d, d)));
      E.antiguedad.forEach(d => $('#fAnt').add(new Option(d, d)));
    }
    render();
  }

  $('#fDep').onchange = render;
  $('#fAnt').onchange = render;
  $('#btnRefrescar').onclick = async () => { await cargar(); render(); };
  $('#btnEstado').onclick = async () => {
    const accion = abierta ? 'cerrar' : 'abrir';
    if (!confirm(`¿Deseas ${accion} la encuesta para los empleados?`)) return;
    const r = await fetch('/api/admin/estado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ abierta: !abierta }) });
    abierta = (await r.json()).abierta; render();
  };
  $('#tabs').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.tab;
    document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('act', x === b));
    render();
  };

  // ---------- Cálculos ----------
  const preguntas = () => E.rubros.flatMap(r => r.preguntas.map(p => ({ ...p, rubro: r })));
  function filtrados() {
    const d = $('#fDep').value, a = $('#fAnt').value;
    return datos.filter(r => (!d || r.departamento === d) && (!a || r.antiguedad === a));
  }
  function stats(rows, ids) {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 0: 0 };
    let suma = 0, n = 0;
    for (const r of rows) for (const id of ids) {
      const v = r.escala[id];
      if (v === undefined) continue;
      dist[v]++;
      if (v > 0) { suma += v; n++; }
    }
    const fav = n ? (dist[4] + dist[5]) / n * 100 : null;
    const desf = n ? (dist[1] + dist[2]) / n * 100 : null;
    return { dist, n, prom: n ? suma / n : null, fav, desf, total: n + dist[0] };
  }
  const todosIds = () => preguntas().map(p => p.id);
  const colorFav = f => f == null ? '#ccc' : f >= 75 ? 'var(--s5)' : f >= 60 ? 'var(--oro)' : 'var(--s1)';
  const fmt = (v, d = 0) => v == null ? '—' : v.toFixed(d);
  const pct = v => v == null ? '—' : Math.round(v) + '%';

  function stack(dist) {
    const t = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
    return `<div class="stack" title="${[1, 2, 3, 4, 5, 0].map(k => `${k || 'N/A'}: ${dist[k]}`).join(' · ')}">${[1, 2, 3, 4, 5, 0].map(k => dist[k] ? `<i style="width:${dist[k] / t * 100}%;background:${COLORES[k]}"></i>` : '').join('')}</div>`;
  }
  const leyenda = () => `<div class="leyenda">${E.escala.map(o => `<span><i style="background:${COLORES[o.valor]}"></i>${o.valor ? o.valor + ' · ' : ''}${esc(o.etiqueta)}</span>`).join('')}</div>`;

  // ---------- Render ----------
  function render() {
    $('#estadoBadge').className = 'badge ' + (abierta ? 'ok' : 'off');
    $('#estadoBadge').textContent = abierta ? '● Encuesta abierta' : '● Encuesta cerrada';
    $('#btnEstado').textContent = abierta ? 'Cerrar encuesta' : 'Abrir encuesta';

    const rows = filtrados();
    const hayFiltro = $('#fDep').value || $('#fAnt').value;
    const al = $('#alertaFiltro');
    if (hayFiltro && rows.length > 0 && rows.length < MIN_GRUPO) {
      al.classList.remove('oculto');
      al.textContent = `Este filtro incluye solo ${rows.length} respuesta${rows.length === 1 ? '' : 's'}. Para proteger el anonimato, evita compartir resultados de grupos menores a ${MIN_GRUPO} personas.`;
    } else al.classList.add('oculto');

    const panel = $('#panel');
    if (!datos.length) {
      panel.innerHTML = `<div class="panel vacio"><h3>Aún no hay respuestas</h3><p>Comparte el enlace de la encuesta con los empleados: <b>${esc(location.origin)}/</b></p></div>`;
      return;
    }
    if (!rows.length) { panel.innerHTML = `<div class="panel vacio">No hay respuestas con los filtros seleccionados.</div>`; return; }

    panel.innerHTML = ({ resumen, preguntas: porPregunta, comparativo, comentarios, respuestas })[tab](rows);
    if (tab === 'respuestas') enlazarTabla(rows);
    if (tab === 'comentarios') enlazarComentarios(rows);
  }

  function resumen(rows) {
    const g = stats(rows, todosIds());
    const rubros = E.rubros.map(r => ({ r, s: stats(rows, r.preguntas.map(p => p.id)) }));
    const orden = [...rubros].filter(x => x.s.fav != null).sort((a, b) => b.s.fav - a.s.fav);
    const qs = preguntas().map(p => ({ p, s: stats(rows, [p.id]) })).filter(x => x.s.fav != null).sort((a, b) => b.s.fav - a.s.fav);
    const partDep = E.departamentos.map(d => ({ d, n: rows.filter(r => r.departamento === d).length }));
    const maxDep = Math.max(1, ...partDep.map(x => x.n));
    const nComent = rows.filter(r => Object.values(r.abiertas).some(t => t)).length;

    return `
    <div class="kpis">
      <div class="kpi"><small>Respuestas</small><div class="v">${rows.length}</div><div class="d">${nComent} con comentarios</div></div>
      <div class="kpi"><small>Índice de clima laboral</small><div class="v" style="color:${colorFav(g.fav)}">${pct(g.fav)}</div><div class="d">Respuestas favorables (4 y 5)</div></div>
      <div class="kpi"><small>Promedio general</small><div class="v">${fmt(g.prom, 2)}<span style="font-size:18px;color:var(--suave)"> / 5</span></div><div class="d">Excluye “No aplica”</div></div>
      <div class="kpi"><small>Respuestas desfavorables</small><div class="v" style="color:var(--s1)">${pct(g.desf)}</div><div class="d">Calificaciones 1 y 2</div></div>
    </div>

    <div class="grid2">
      <div class="panel">
        <h3>Índice por rubro</h3>
        <div class="sub">% de respuestas favorables · <span style="color:var(--s5)">■</span> ≥75% fortaleza · <span style="color:var(--oro)">■</span> 60–74% atención · <span style="color:var(--s1)">■</span> &lt;60% prioridad</div>
        ${rubros.map(({ r, s }) => `<div class="rubro-fila"><span>${esc(r.nombre)}</span><div class="pista"><i style="width:${s.fav || 0}%;background:${colorFav(s.fav)}"></i></div><span class="v">${pct(s.fav)}</span></div>`).join('')}
      </div>
      <div class="panel">
        <h3>Participación por departamento</h3>
        <div class="sub">Número de encuestas respondidas</div>
        ${partDep.map(x => `<div class="rubro-fila"><span>${esc(x.d)}</span><div class="pista"><i style="width:${x.n / maxDep * 100}%;background:var(--verde-2)"></i></div><span class="v">${x.n}</span></div>`).join('')}
      </div>
    </div>

    <div class="grid2">
      <div class="panel">
        <h3>Principales fortalezas</h3>
        <div class="sub">Afirmaciones con mayor % favorable</div>
        ${qs.slice(0, 5).map(x => `<div class="rubro-fila" style="grid-template-columns:1fr 52px"><span><b style="color:var(--oro)">${x.p.num}.</b> ${esc(x.p.texto)}</span><span class="v" style="color:var(--s5)">${pct(x.s.fav)}</span></div>`).join('')}
      </div>
      <div class="panel">
        <h3>Áreas de oportunidad</h3>
        <div class="sub">Afirmaciones con menor % favorable</div>
        ${qs.slice(-5).reverse().map(x => `<div class="rubro-fila" style="grid-template-columns:1fr 52px"><span><b style="color:var(--oro)">${x.p.num}.</b> ${esc(x.p.texto)}</span><span class="v" style="color:${colorFav(x.s.fav)}">${pct(x.s.fav)}</span></div>`).join('')}
      </div>
    </div>
    ${orden.length ? `<div class="panel"><h3>Lectura rápida</h3><p style="margin:6px 0 0">El rubro mejor evaluado es <b>${esc(orden[0].r.nombre)}</b> (${pct(orden[0].s.fav)} favorable) y el que requiere más atención es <b>${esc(orden.at(-1).r.nombre)}</b> (${pct(orden.at(-1).s.fav)} favorable).</p></div>` : ''}`;
  }

  function porPregunta(rows) {
    let h = `<div class="panel"><h3>Distribución de respuestas por pregunta</h3><div class="sub">Promedio en escala 1–5 (excluye “No aplica”). Pasa el cursor sobre una barra para ver los conteos.</div>${leyenda()}`;
    for (const r of E.rubros) {
      const s = stats(rows, r.preguntas.map(p => p.id));
      h += `<div class="rubro-cab">${esc(r.nombre)} <span style="font-weight:400;color:var(--suave)">· ${pct(s.fav)} favorable</span></div>`;
      for (const p of r.preguntas) {
        const q = stats(rows, [p.id]);
        h += `<div class="preg-fila"><span><span class="n">${p.num}.</span>${esc(p.texto)}</span>${stack(q.dist)}<span class="v">${fmt(q.prom, 2)}</span></div>`;
      }
    }
    return h + '</div>';
  }

  function comparativo(rows) {
    const cel = s => {
      if (!s.n) return `<td class="num" style="color:#aaa">—</td>`;
      const f = s.fav;
      const bg = f >= 75 ? '#d7eadf' : f >= 60 ? '#f3e7cf' : '#f4d9d3';
      return `<td class="num" style="background:${bg};font-weight:600">${pct(f)}</td>`;
    };
    const grupos = (campo, lista) => lista.map(v => ({ v, rs: rows.filter(r => r[campo] === v) }));
    const tabla = (titulo, campo, lista) => {
      const gs = grupos(campo, lista);
      return `<div class="panel"><h3>${titulo}</h3><div class="sub">% favorable por rubro. Los grupos con menos de ${MIN_GRUPO} respuestas se ocultan para proteger el anonimato.</div>
      <div class="tabla-wrap"><table><thead><tr><th>Rubro</th>${gs.map(g => `<th style="text-align:right;white-space:normal;min-width:90px">${esc(g.v)}<br><span style="font-weight:400">n=${g.rs.length}</span></th>`).join('')}</tr></thead><tbody>
      ${E.rubros.map(r => `<tr><td>${esc(r.nombre)}</td>${gs.map(g => g.rs.length < MIN_GRUPO ? `<td class="num" style="color:#aaa">${g.rs.length ? '🔒' : '—'}</td>` : cel(stats(g.rs, r.preguntas.map(p => p.id)))).join('')}</tr>`).join('')}
      <tr><td><b>Índice general</b></td>${gs.map(g => g.rs.length < MIN_GRUPO ? `<td class="num" style="color:#aaa">${g.rs.length ? '🔒' : '—'}</td>` : cel(stats(g.rs, todosIds()))).join('')}</tr>
      </tbody></table></div></div>`;
    };
    return tabla('Comparativo por departamento', 'departamento', E.departamentos) + tabla('Comparativo por antigüedad', 'antiguedad', E.antiguedad);
  }

  function comentarios(rows) {
    return `<div class="panel" style="padding-bottom:8px"><label style="font-size:12px;color:var(--suave);font-weight:600">Buscar en comentarios<input type="search" id="buscaCom" placeholder="Ej. horario, sueldo, capacitación…" style="margin-top:4px"></label></div>
      <div id="listaCom">${listaComentarios(rows, '')}</div>`;
  }
  function listaComentarios(rows, q) {
    q = q.toLowerCase();
    return E.abiertas.map(p => {
      const items = rows.filter(r => r.abiertas[p.id] && (!q || r.abiertas[p.id].toLowerCase().includes(q)));
      return `<div class="panel"><h3>${p.num}. ${esc(p.texto)}</h3><div class="sub">${items.length} comentario${items.length === 1 ? '' : 's'}</div>
        ${items.length ? items.map(r => `<div class="comentario">${esc(r.abiertas[p.id]).replace(/\n/g, '<br>')}<div class="meta">${esc(r.departamento)}</div></div>`).join('') : '<p style="color:var(--suave)">Sin comentarios.</p>'}</div>`;
    }).join('');
  }
  function enlazarComentarios(rows) {
    $('#buscaCom').oninput = e => { $('#listaCom').innerHTML = listaComentarios(rows, e.target.value); };
  }

  function respuestas(rows) {
    return `<div class="panel"><h3>Respuestas individuales</h3><div class="sub">Haz clic en una fila para ver el detalle. Las respuestas no contienen nombre ni datos personales.</div>
      <div class="tabla-wrap"><table><thead><tr><th>Folio</th><th>Fecha</th><th>Departamento</th><th>Antigüedad</th><th style="text-align:right">Promedio</th><th style="text-align:right">% Favorable</th><th>Comentarios</th></tr></thead><tbody>
      ${rows.map(r => { const s = stats([r], todosIds()); const c = Object.values(r.abiertas).filter(Boolean).length; return `<tr class="click" data-id="${r.id}"><td>#${r.id}</td><td>${esc(r.fecha)}</td><td>${esc(r.departamento)}</td><td>${esc(r.antiguedad)}</td><td class="num">${fmt(s.prom, 2)}</td><td class="num" style="color:${colorFav(s.fav)};font-weight:700">${pct(s.fav)}</td><td>${c ? c + ' 💬' : '—'}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
  }
  function enlazarTabla(rows) {
    document.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => detalle(rows.find(r => r.id == tr.dataset.id)));
  }

  function detalle(r) {
    const etiqueta = v => E.escala.find(o => o.valor === v)?.etiqueta || '—';
    $('#modal').innerHTML = `<div class="modal-fondo" id="mf"><div class="modal">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:start">
        <div><h3>Respuesta #${r.id}</h3><div class="sub" style="color:var(--suave);font-size:14px">${esc(r.fecha)} · ${esc(r.departamento)} · ${esc(r.antiguedad)}</div></div>
        <button class="btn sec peq" id="cerrarM">Cerrar</button>
      </div>
      ${E.rubros.map(ru => `<div class="rubro-cab">${esc(ru.nombre)}</div>${ru.preguntas.map(p => `<div class="r"><span><b style="color:var(--oro)">${p.num}.</b> ${esc(p.texto)}</span><span class="chip" style="background:${COLORES[r.escala[p.id]]};${r.escala[p.id] === 0 || r.escala[p.id] === 3 ? 'color:var(--texto)' : ''}">${r.escala[p.id] || 'N/A'} · ${esc(etiqueta(r.escala[p.id]))}</span></div>`).join('')}`).join('')}
      <div class="rubro-cab">Preguntas abiertas</div>
      ${E.abiertas.map(p => `<p style="margin:8px 0 2px;font-weight:600;font-size:14px">${p.num}. ${esc(p.texto)}</p><div class="comentario" style="margin:0">${esc(r.abiertas[p.id] || '—').replace(/\n/g, '<br>')}</div>`).join('')}
      <div style="margin-top:18px;text-align:right"><button class="btn peq" style="background:var(--rojo)" id="borrar">Eliminar respuesta</button></div>
    </div></div>`;
    const cerrar = () => { $('#modal').innerHTML = ''; };
    $('#cerrarM').onclick = cerrar;
    $('#mf').onclick = e => { if (e.target.id === 'mf') cerrar(); };
    $('#borrar').onclick = async () => {
      if (!confirm(`¿Eliminar definitivamente la respuesta #${r.id}? Esta acción no se puede deshacer.`)) return;
      await fetch('/api/admin/respuestas/' + r.id, { method: 'DELETE' });
      cerrar(); await cargar(); render();
    };
  }

  iniciar();
})();
