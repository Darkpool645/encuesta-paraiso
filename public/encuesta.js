// Panel del empleado – captura de respuestas
(async function () {
  const $ = s => document.querySelector(s);
  const cont = $('#contenido');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let E;
  try {
    E = await (await fetch('/api/encuesta')).json();
  } catch {
    cont.innerHTML = '<div class="card">No se pudo cargar la encuesta. Revisa tu conexión e intenta de nuevo.</div>';
    return;
  }

  if (!E.abierta) {
    cont.innerHTML = `<div class="card gracias"><h1>Encuesta cerrada</h1><p>La encuesta no está disponible en este momento. Gracias por tu interés.</p></div>`;
    return;
  }

  // Pasos: 0 intro, 1 datos generales, 2..9 rubros, 10 abiertas, 11 gracias
  const pasos = [
    { tipo: 'intro' },
    { tipo: 'datos', titulo: 'Datos generales', eti: 'Sección 1' },
    ...E.rubros.map((r, i) => ({ tipo: 'rubro', rubro: r, titulo: r.nombre, eti: `Rubro ${i + 1} de ${E.rubros.length}` })),
    { tipo: 'abiertas', titulo: 'Preguntas abiertas', eti: 'Última sección' },
  ];
  const estado = { paso: 0, departamento: null, antiguedad: null, escala: {}, abiertas: {} };
  const escalaNum = E.escala.filter(o => o.valor > 0);
  const totalEscala = E.rubros.reduce((n, r) => n + r.preguntas.length, 0);

  function contestadas() {
    return (estado.departamento ? 1 : 0) + (estado.antiguedad ? 1 : 0) + Object.keys(estado.escala).length;
  }

  function render() {
    const p = pasos[estado.paso];
    $('#msg').textContent = '';
    const enEncuesta = p.tipo !== 'intro';
    $('#progreso').classList.toggle('oculto', !enEncuesta);
    $('#nav').classList.toggle('oculto', !enEncuesta);
    if (enEncuesta) {
      const pct = Math.round(contestadas() / (totalEscala + 2) * 100);
      $('#barra').style.width = pct + '%';
      $('#pasoTxt').textContent = `Paso ${estado.paso} de ${pasos.length - 1}`;
      $('#pctTxt').textContent = pct + '% respondido';
      $('#btnSig').textContent = estado.paso === pasos.length - 1 ? 'Enviar respuestas' : 'Siguiente';
    }

    if (p.tipo === 'intro') {
      cont.innerHTML = `
        <div class="card intro">
          <h1>¡Queremos escucharte!</h1>
          <p>En Paraíso Country Club queremos conocer tu opinión sobre tu trabajo, el ambiente laboral, tus compañeros y las oportunidades que tenemos para mejorar.</p>
          <p>Tus respuestas son importantes y nos ayudarán a construir un mejor lugar para trabajar.</p>
          <div class="aviso">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
            <div><b>Esta encuesta es anónima.</b> No necesitas escribir tu nombre y tus respuestas se analizarán de manera grupal. Te pedimos responder con sinceridad, de acuerdo con tu experiencia.</div>
          </div>
          <p style="font-size:14px">Tiempo aproximado: 10 minutos · ${totalEscala + 5} preguntas</p>
          <button class="btn oro" id="btnEmpezar" style="width:100%;margin-top:8px">Comenzar encuesta</button>
        </div>`;
      $('#btnEmpezar').onclick = () => ir(1);
      return;
    }

    let html = `<div class="seccion-titulo"><small>${esc(p.eti)}</small><h2>${esc(p.titulo)}</h2></div>`;

    if (p.tipo === 'datos') {
      html += bloqueOpciones('departamento', 1, '¿En qué departamento trabajas?', E.departamentos);
      html += bloqueOpciones('antiguedad', 2, '¿Cuánto tiempo llevas trabajando en Paraíso Country Club?', E.antiguedad);
    }

    if (p.tipo === 'rubro') {
      for (const q of p.rubro.preguntas) {
        const v = estado.escala[q.id];
        html += `<div class="card pregunta" data-q="${q.id}">
          <div class="enunciado"><span class="n">${q.num}.</span>${esc(q.texto)}</div>
          <div class="escala">
            ${escalaNum.map(o => `<button type="button" class="${v === o.valor ? 'sel' : ''}" data-q="${q.id}" data-v="${o.valor}" aria-pressed="${v === o.valor}"><b>${o.valor}</b>${esc(o.etiqueta)}</button>`).join('')}
          </div>
          <button type="button" class="na ${v === 0 ? 'sel' : ''}" data-q="${q.id}" data-v="0" aria-pressed="${v === 0}">No aplica / No sé</button>
        </div>`;
      }
    }

    if (p.tipo === 'abiertas') {
      html += `<p style="color:var(--suave);margin-top:-6px">Estas preguntas son opcionales, pero tus comentarios nos ayudan mucho.</p>`;
      for (const q of E.abiertas) {
        html += `<div class="card pregunta">
          <label class="enunciado" for="${q.id}" style="display:block"><span class="n">${q.num}.</span>${esc(q.texto)} <span class="opcional">(opcional)</span></label>
          <textarea id="${q.id}" maxlength="2000" placeholder="Escribe aquí tu respuesta…">${esc(estado.abiertas[q.id] || '')}</textarea>
        </div>`;
      }
    }

    cont.innerHTML = html;

    cont.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
      estado.escala[b.dataset.q] = Number(b.dataset.v);
      const card = b.closest('.pregunta');
      card.classList.remove('falta');
      card.querySelectorAll('[data-v]').forEach(x => { const s = x === b; x.classList.toggle('sel', s); x.setAttribute('aria-pressed', s); });
      actualizarProgreso();
    });
    cont.querySelectorAll('[data-campo]').forEach(b => b.onclick = () => {
      estado[b.dataset.campo] = b.dataset.val;
      const card = b.closest('.pregunta');
      card.classList.remove('falta');
      card.querySelectorAll('.opcion').forEach(x => { const s = x === b; x.classList.toggle('sel', s); x.setAttribute('aria-pressed', s); });
      actualizarProgreso();
    });
    cont.querySelectorAll('textarea').forEach(t => t.oninput = () => { estado.abiertas[t.id] = t.value; });
  }

  function bloqueOpciones(campo, num, texto, lista) {
    return `<div class="card pregunta" data-bloque="${campo}">
      <div class="enunciado"><span class="n">${num}.</span>${esc(texto)}</div>
      <div class="opciones">
        ${lista.map(o => `<button type="button" class="opcion ${estado[campo] === o ? 'sel' : ''}" data-campo="${campo}" data-val="${esc(o)}" aria-pressed="${estado[campo] === o}"><span class="radio"></span>${esc(o)}</button>`).join('')}
      </div>
    </div>`;
  }

  function actualizarProgreso() {
    const pct = Math.round(contestadas() / (totalEscala + 2) * 100);
    $('#barra').style.width = pct + '%';
    $('#pctTxt').textContent = pct + '% respondido';
    $('#msg').textContent = '';
  }

  function faltantes() {
    const p = pasos[estado.paso];
    const f = [];
    if (p.tipo === 'datos') {
      if (!estado.departamento) f.push(cont.querySelector('[data-bloque="departamento"]'));
      if (!estado.antiguedad) f.push(cont.querySelector('[data-bloque="antiguedad"]'));
    }
    if (p.tipo === 'rubro') {
      for (const q of p.rubro.preguntas) if (!(q.id in estado.escala)) f.push(cont.querySelector(`.pregunta[data-q="${q.id}"]`));
    }
    return f;
  }

  function ir(n) {
    estado.paso = n;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('#btnAtras').onclick = () => ir(Math.max(0, estado.paso - 1));
  $('#btnSig').onclick = async () => {
    const f = faltantes();
    if (f.length) {
      f.forEach(el => el && el.classList.add('falta'));
      $('#msg').textContent = f.length === 1 ? 'Falta 1 respuesta' : `Faltan ${f.length} respuestas`;
      f[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (estado.paso < pasos.length - 1) return ir(estado.paso + 1);
    await enviar();
  };

  async function enviar() {
    const btn = $('#btnSig');
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const r = await fetch('/api/respuestas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departamento: estado.departamento, antiguedad: estado.antiguedad, escala: estado.escala, abiertas: estado.abiertas }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error al enviar');
      $('#progreso').classList.add('oculto');
      $('#nav').classList.add('oculto');
      cont.innerHTML = `<div class="card gracias">
        <div class="check"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
        <h1>¡Gracias por participar!</h1>
        <p>Tus respuestas se registraron de forma anónima. Tu opinión nos ayuda a hacer de Paraíso Country Club un mejor lugar para trabajar.</p>
        <button class="btn sec" id="otra" style="margin-top:16px">Registrar otra respuesta (equipo compartido)</button>
      </div>`;
      $('#otra').onclick = () => location.reload();
      window.scrollTo({ top: 0 });
    } catch (e) {
      $('#msg').textContent = e.message;
      btn.disabled = false; btn.textContent = 'Enviar respuestas';
    }
  }

  render();
})();
