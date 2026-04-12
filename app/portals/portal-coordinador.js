// ══ COORDINADOR PORTAL ════════════════════════════════════════════════════
function coordPortalInit() {
  if (currentPerfil) {
    const n = document.getElementById('coord-nombre');
    if (n) n.textContent = currentPerfil.nombre || 'Coordinador/a';
  }
  coordNav('dashboard');
  // ── IA visible al iniciar coordinador ──
  setTimeout(() => coordCargarIADashboard(), 800);
  if (typeof coordSuscribirPlaneaciones === 'function') coordSuscribirPlaneaciones();
}

// Inyecta tarjeta IA en el dashboard del coordinador si no existe
async function coordCargarIADashboard() {
  const dash = document.getElementById('coord-p-dashboard');
  if (!dash || document.getElementById('coord-ia-card')) return;

  const visitas = window._coordVisitas || [];
  const docentes = window._coordDocentes || [];
  const bajos = docentes.filter(d => {
    const vs = visitas.filter(v => v.docente_id === d.id);
    return vs.length && (vs.reduce((s,v)=>s+(v.calificacion||0),0)/vs.length) < 8;
  }).length;
  const sinVisita = docentes.filter(d => !visitas.some(v => v.docente_id === d.id)).length;

  const iaCard = document.createElement('div');
  iaCard.id = 'coord-ia-card';
  iaCard.style.cssText = 'background:linear-gradient(135deg,#3b0764,#6d28d9);border-radius:14px;padding:18px;margin-top:20px;color:white;';
  iaCard.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <div style="width:8px;height:8px;border-radius:50%;background:#c4b5fd;animation:pulse 2s infinite;"></div>
      <span style="font-size:11px;font-weight:700;opacity:.7;text-transform:uppercase;letter-spacing:1px;">📊 Resumen de coordinación</span>
      <button onclick="coordActualizarIA()" style="margin-left:auto;padding:5px 12px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:white;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Sora',sans-serif;">↺ Actualizar</button>
    </div>
    <div id="coord-ia-dash-texto" style="font-size:13px;line-height:1.7;opacity:.9;">
      <span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;animation:spin .8s linear infinite;vertical-align:middle;margin-right:8px;"></span>
      Analizando desempeño docente…
    </div>`;
  dash.appendChild(iaCard);

  coordActualizarIA(visitas, docentes, bajos, sinVisita);
}

async function coordActualizarIA(visitas, docentes, bajos, sinVisita) {
  const el = document.getElementById('coord-ia-dash-texto');
  if (!el) return;
  // Si no se pasaron parámetros, recalcular
  if (!visitas) {
    visitas  = window._coordVisitas  || [];
    docentes = window._coordDocentes || [];
    bajos    = docentes.filter(d => { const vs=visitas.filter(v=>v.docente_id===d.id); return vs.length&&(vs.reduce((s,v)=>s+(v.calificacion||0),0)/vs.length)<8; }).length;
    sinVisita= docentes.filter(d=>!visitas.some(v=>v.docente_id===d.id)).length;
  }
  const promVisitas = visitas.length
    ? (visitas.filter(v=>v.calificacion).reduce((s,v)=>s+(v.calificacion||0),0)/visitas.filter(v=>v.calificacion).length).toFixed(1)
    : '—';

  const prompt = `Soy coordinador/a académico/a en una escuela de educación básica en México (NEM).
Datos de mis visitas de acompañamiento: ${visitas.length} visitas realizadas, promedio de evaluación: ${promVisitas}/10, ${bajos} docentes con promedio menor a 8, ${sinVisita} docentes sin visita este mes, ${docentes.length} docentes en total.
Genera: 1) Estado del acompañamiento en 1 oración, 2) 2 acciones prioritarias para esta semana, 3) Un recordatorio motivador. Máximo 80 palabras. Directo y útil.`;

  try {
    const texto = await callAI({ feature: 'coord_eval_docente', prompt, system: _nemSys('TAREA: Retroalimentación coordinador→docente. Identifica fortalezas pedagógicas y áreas de mejora en planeación NEM. Propone 2 acciones prioritarias concretas y medibles para esta semana. Tono de acompañamiento, no supervisión punitiva.') });
    el.innerHTML = texto.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
  } catch(e) {
    el.innerHTML = visitas.length
      ? `Has realizado <strong>${visitas.length}</strong> visitas con promedio <strong>${promVisitas}</strong>. ${bajos>0?`<strong>${bajos}</strong> docente${bajos>1?'s':''} necesitan apoyo adicional.`:''} Sigue con tu plan de acompañamiento.`
      : 'Registra tu primera visita de acompañamiento para comenzar a generar análisis con IA.';
  }
}
window.coordActualizarIA = coordActualizarIA;

function coordNav(page) {
  document.querySelectorAll('.coord-page').forEach(p => p.style.display = 'none');
  const pg = document.getElementById('coord-p-' + page);
  if (pg) pg.style.display = 'block';
  document.querySelectorAll('#coord-portal .adm-nav').forEach(b => b.style.background = '');
  const btn = document.getElementById('cn-' + page);
  if (btn) btn.style.background = 'rgba(255,255,255,.1)';
  const titles = {
    dashboard:'Dashboard · Coordinación', visitas:'Visitas a docentes',
    planeaciones:'Revisión de planeaciones', libretas:'Revisión de libretas',
    pemc:'PEMC — Plan de Mejora Continua', boleta:'Boleta NEM', nem:'Alineación NEM',
    historial:'Historial de evaluaciones', 'horarios-pub':'Horarios publicados',
    'evaluacion-docentes':'Evaluación de docentes', academias:'Academias por materia',
    'alertas-rendimiento':'Alertas de bajo rendimiento'
  };
  const t = document.getElementById('coord-title');
  if (t) t.textContent = titles[page] || page;
  if (page === 'visitas')             { coordRenderVisitasLista(); }
  if (page === 'dashboard')           { coordRenderDash(); }
  if (page === 'historial')           { coordRenderHistorial(); }
  if (page === 'planeaciones')        { coordRenderPlaneaciones(); }
  if (page === 'boleta')              { coordBoletaInit(); }
  if (page === 'pemc')                { if(typeof nemPemcRender==='function') nemPemcRender(); if(typeof nemPemcCargar==='function') nemPemcCargar(); }
  if (page === 'horarios-pub')        { coordCargarHorariosPublicados(); }
  if (page === 'horarios')            { coordHorariosCargar(); }
  if (page === 'evaluacion-docentes') { coordEvaluacionCargar(); }
  if (page === 'academias')           { coordAcademiasCargar(); }
  if (page === 'alertas-rendimiento') { coordAlertasRendimientoCargar(); }
}

async function coordCargarHorariosPublicados() {
  const cct = window.currentPerfil?.escuela_cct;
  const sel = document.getElementById('coord-horpub-grupo');
  if (!sel) return;
  sel.innerHTML = '<option value="">Cargando grupos…</option>';
  if (!window.sb || !cct) { sel.innerHTML = '<option value="">Sin conexión</option>'; return; }
  try {
    const { data: gs } = await window.sb.from('grupos').select('id,nombre,grado,seccion').eq('escuela_cct',cct).eq('activo',true).order('grado');
    sel.innerHTML = '<option value="">Seleccionar grupo…</option>' + (gs||[]).map(g=>`<option value="${g.id}">${g.nombre||g.grado+'° '+g.seccion}</option>`).join('');
  } catch(e) { sel.innerHTML = '<option value="">Error</option>'; }
}
async function coordVerHorarioGrupo(grupoId) {
  const el = document.getElementById('coord-horpub-contenido');
  if (!el) return;
  if (!grupoId) { el.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">Selecciona un grupo</div>'; return; }
  el.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">Cargando…</div>';
  try {
    const { data: celdas } = await window.sb.from('horario_celdas').select('dia_semana,hora_idx,materia,docente_nombre').eq('grupo_id',grupoId).eq('activo',true).order('hora_idx');
    if (!celdas?.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;"><div style="font-size:36px;margin-bottom:10px;">📭</div><div>Este grupo aún no tiene horario publicado</div></div>'; return; }
    const dias=['Lunes','Martes','Miércoles','Jueves','Viernes'];
    const horas=[...new Set(celdas.map(c=>c.hora_idx))].sort((a,b)=>a-b);
    let html=`<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-family:'Sora',sans-serif;font-size:13px;"><thead><tr><th style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:700;color:#475569;">Hora</th>${dias.map(d=>`<th style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:700;color:#475569;">${d}</th>`).join('')}</tr></thead><tbody>`;
    horas.forEach(hi=>{html+=`<tr><td style="padding:9px 14px;border:1px solid #e2e8f0;font-weight:700;color:#64748b;background:#f8fafc;">${7+hi}:00</td>`;dias.forEach(dia=>{const c=celdas.find(x=>x.dia_semana===dia&&x.hora_idx===hi);html+=c?`<td style="padding:9px 14px;border:1px solid #e2e8f0;background:#faf5ff;"><div style="font-weight:700;color:#7c3aed;">${c.materia||'—'}</div><div style="font-size:11px;color:#64748b;">${c.docente_nombre||''}</div></td>`:`<td style="padding:9px 14px;border:1px solid #e2e8f0;color:#cbd5e1;text-align:center;">—</td>`;});html+=`</tr>`;});
    html+='</tbody></table></div>';el.innerHTML=html;
  } catch(e) { el.innerHTML=`<div style="padding:20px;color:#dc2626;">Error: ${e.message}</div>`; }
}

// ── Coordinador: Evaluación de docentes ──────────────────────────
const COORD_RUBRICA = [
  { id:'planeacion', label:'Planeación didáctica (NEM)', max:20 },
  { id:'inicio',     label:'Inicio de clase (activación)', max:15 },
  { id:'desarrollo', label:'Desarrollo de contenidos', max:25 },
  { id:'cierre',     label:'Cierre y evaluación formativa', max:20 },
  { id:'clima',      label:'Clima de aula y convivencia', max:10 },
  { id:'recursos',   label:'Uso de recursos y materiales', max:10 },
];

async function coordEvaluacionCargar() {
  const sel = document.getElementById('eval-doc-select');
  if (!sel) return;
  const cct = typeof _getCct === 'function' ? _getCct() : (window.currentPerfil?.escuela_cct || null);
  if (!window.sb || !cct) return;
  try {
    const { data } = await window.sb.from('usuarios')
      .select('id,nombre,apellido_p')
      .eq('escuela_cct', cct).eq('rol','docente').eq('activo',true).order('nombre');
    sel.innerHTML = '<option value="">Seleccionar docente…</option>' +
      (data||[]).map(d => `<option value="${d.id}">${d.nombre||''} ${d.apellido_p||''}</option>`).join('');
    window._coordDocentesEval = data || [];
  } catch(e) { console.error(e); }
}

function coordEvaluacionSeleccionarDocente(docenteId) {
  const form = document.getElementById('eval-doc-form');
  if (!form) return;
  if (!docenteId) { form.style.display = 'none'; return; }
  form.style.display = 'block';
  const docente = (window._coordDocentesEval || []).find(d => d.id === docenteId);
  const label = document.getElementById('eval-doc-nombre-label');
  if (label) label.textContent = docente ? `${docente.nombre||''} ${docente.apellido_p||''}` : docenteId;

  const itemsEl = document.getElementById('eval-rubrica-items');
  if (itemsEl) {
    itemsEl.innerHTML = COORD_RUBRICA.map(r => `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <label style="font-size:13px;font-weight:600;color:#374151;">${r.label}</label>
          <span style="font-size:12px;color:#94a3b8;">/ ${r.max} pts</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="range" id="eval-r-${r.id}" min="0" max="${r.max}" value="${Math.floor(r.max*0.7)}" step="1"
            style="flex:1;accent-color:#7c3aed;" oninput="coordEvaluacionActualizarTotal()">
          <span id="eval-rv-${r.id}" style="width:32px;text-align:right;font-weight:700;color:#5b21b6;">${Math.floor(r.max*0.7)}</span>
        </div>
      </div>`).join('');
    coordEvaluacionActualizarTotal();
  }
  coordEvaluacionHistorial(docenteId);
}

function coordEvaluacionActualizarTotal() {
  let total = 0;
  COORD_RUBRICA.forEach(r => {
    const el = document.getElementById(`eval-r-${r.id}`);
    const vEl = document.getElementById(`eval-rv-${r.id}`);
    if (el) { const v = parseInt(el.value)||0; total += v; if(vEl) vEl.textContent = v; }
  });
  const tEl = document.getElementById('eval-total-score');
  if (tEl) { tEl.textContent = total; tEl.style.color = total >= 70 ? '#15803d' : total >= 50 ? '#d97706' : '#dc2626'; }
}

async function coordEvaluacionGuardar() {
  const docenteId = document.getElementById('eval-doc-select')?.value;
  if (!docenteId) { hubToast('Selecciona un docente primero', 'warn'); return; }
  const tipo = document.getElementById('eval-doc-tipo')?.value || 'observacion';
  const observaciones = document.getElementById('eval-observaciones-texto')?.value || '';
  const cct = typeof _getCct === 'function' ? _getCct() : (window.currentPerfil?.escuela_cct || null);
  let rubrica = {};
  COORD_RUBRICA.forEach(r => { rubrica[r.id] = parseInt(document.getElementById(`eval-r-${r.id}`)?.value)||0; });
  const totalPts = Object.values(rubrica).reduce((a,b)=>a+b,0);

  try {
    await window.sb.from('evaluaciones_coordinador').insert({
      docente_id: docenteId, coordinador_id: window.currentPerfil?.id,
      escuela_cct: cct, tipo, rubrica, total_puntos: totalPts,
      observaciones, fecha: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    });
    hubToast('✅ Evaluación guardada correctamente', 'ok');
    coordEvaluacionHistorial(docenteId);
  } catch(e) { hubToast('Error: ' + e.message, 'error'); }
}

async function coordEvaluacionHistorial(docenteId) {
  const lista = document.getElementById('eval-historial-lista');
  if (!lista || !window.sb) return;
  try {
    const { data } = await window.sb.from('evaluaciones_coordinador')
      .select('*').eq('docente_id', docenteId).order('created_at',{ascending:false}).limit(10);
    if (!data?.length) {
      lista.innerHTML = `<div style="text-align:center;padding:30px;background:white;border-radius:12px;border:1px solid #e2e8f0;color:#94a3b8;font-size:13px;">Sin evaluaciones anteriores</div>`;
      return;
    }
    lista.innerHTML = data.map(e => {
      const fecha = e.fecha || (e.created_at ? new Date(e.created_at).toLocaleDateString('es-MX') : '—');
      const pts = e.total_puntos;
      const color = pts >= 70 ? '#15803d' : pts >= 50 ? '#d97706' : '#dc2626';
      return `<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;font-size:13px;color:#0f172a;">${e.tipo||'observación'} — ${fecha}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">${(e.observaciones||'').slice(0,80)}${(e.observaciones||'').length>80?'…':''}</div>
        </div>
        <div style="font-size:24px;font-weight:800;color:${color};flex-shrink:0;">${pts}<span style="font-size:12px;color:#94a3b8;">/100</span></div>
      </div>`;
    }).join('');
  } catch(e) { lista.innerHTML = `<div style="padding:20px;color:#ef4444;font-size:13px;">Error: ${e.message}</div>`; }
}

// ── Coordinador: Academias por materia ──────────────────────────
window._coordAcademias = [];

async function coordAcademiasCargar() {
  const grid = document.getElementById('academias-grid');
  if (!grid) return;
  const cct = typeof _getCct === 'function' ? _getCct() : (window.currentPerfil?.escuela_cct || null);
  if (!window.sb || !cct) {
    grid.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8;">Sin conexión</div>`;
    return;
  }
  try {
    const { data } = await window.sb.from('academias')
      .select('*').eq('escuela_cct', cct).order('materia');
    window._coordAcademias = data || [];
    coordAcademiasRender();
  } catch(e) {
    // Tabla puede no existir aún — mostrar demo con las materias comunes
    const demo = ['Matemáticas','Español','Ciencias Naturales','Historia','Geografía','Formación Cívica y Ética','Educación Física','Artes'].map((m,i)=>({
      id:i, materia:m, escuela_cct:cct, coordinador_nombre: window.currentPerfil?.nombre||'Coordinador',
      integrantes: Math.floor(Math.random()*4)+2, proxima_reunion: null, created_at: new Date().toISOString()
    }));
    window._coordAcademias = demo;
    coordAcademiasRender();
  }
}

function coordAcademiasRender() {
  const grid = document.getElementById('academias-grid');
  if (!grid) return;
  const data = window._coordAcademias || [];
  if (!data.length) {
    grid.innerHTML = `<div style="text-align:center;padding:60px;background:white;border-radius:12px;border:2px dashed #e2e8f0;color:#94a3b8;grid-column:1/-1;">
      <div style="font-size:36px;margin-bottom:8px;">🎓</div>
      <div style="font-size:14px;font-weight:600;">Sin academias registradas</div>
      <div style="font-size:12px;margin-top:4px;">Crea la primera academia con el botón de arriba</div>
    </div>`;
    return;
  }
  const colores = ['#7c3aed','#1e40af','#15803d','#9a3412','#0e7490','#6d28d9','#047857','#b45309'];
  grid.innerHTML = data.map((a, i) => `
    <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:20px;cursor:pointer;" onclick="coordAcademiaDetalle(${a.id||i})">
      <div style="width:44px;height:44px;background:${colores[i%colores.length]};border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:12px;">🎓</div>
      <div style="font-size:15px;font-weight:700;color:#0f172a;">${a.materia||'Academia'}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">${a.integrantes||0} docentes</div>
      ${a.proxima_reunion ? `<div style="font-size:11px;color:#7c3aed;margin-top:6px;font-weight:600;">Próxima reunión: ${new Date(a.proxima_reunion).toLocaleDateString('es-MX')}</div>` : `<div style="font-size:11px;color:#94a3b8;margin-top:6px;">Sin reunión programada</div>`}
      <div style="margin-top:12px;display:flex;gap:6px;">
        <button onclick="event.stopPropagation();coordAcademiaAgregarDocente(${a.id||i})" style="padding:5px 10px;font-size:11px;background:#f5f3ff;color:#7c3aed;border:1px solid #c4b5fd;border-radius:6px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">+ Docente</button>
        <button onclick="event.stopPropagation();coordAcademiaReunion(${a.id||i})" style="padding:5px 10px;font-size:11px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:6px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">📅 Reunión</button>
      </div>
    </div>`).join('');
}

function coordAcademiaCrear() {
  hubModal('🎓 Nueva academia', `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Nombre de la materia / campo formativo</label>
        <input id="nueva-academia-materia" type="text" placeholder="Ej: Matemáticas, Español…" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Fecha primera reunión (opcional)</label>
        <input id="nueva-academia-fecha" type="date" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
    </div>`, 'Crear academia', async () => {
    const materia = document.getElementById('nueva-academia-materia')?.value?.trim();
    if (!materia) { hubToast('Escribe el nombre de la materia', 'warn'); return; }
    const fecha = document.getElementById('nueva-academia-fecha')?.value || null;
    const cct = typeof _getCct === 'function' ? _getCct() : (window.currentPerfil?.escuela_cct || null);
    try {
      await window.sb.from('academias').insert({ materia, escuela_cct: cct, proxima_reunion: fecha, integrantes: 0, created_at: new Date().toISOString() });
      hubToast('✅ Academia creada', 'ok');
      coordAcademiasCargar();
    } catch(e) { hubToast('Error: ' + e.message, 'error'); }
  });
}

async function coordAcademiaDetalle(id) {
  const ac = window._coordAcademias?.find(a => (a.id === id || a.id === String(id)));
  if (!ac) { hubToast('Academia no encontrada', 'warn'); return; }
  const cct = typeof _getCct === 'function' ? _getCct() : (window.currentPerfil?.escuela_cct || null);
  // Cargar docentes de esta academia
  let docentesHtml = '<div style="color:#94a3b8;font-size:13px;">Sin docentes asignados</div>';
  try {
    if (window.sb && ac.docentes_ids?.length) {
      const { data: docs } = await window.sb.from('usuarios')
        .select('id,nombre,apellido_p').in('id', ac.docentes_ids);
      if (docs?.length) {
        docentesHtml = docs.map(d => `<div style="padding:6px 10px;background:#f5f3ff;border-radius:8px;font-size:13px;color:#4c1d95;font-weight:600;">${d.nombre} ${d.apellido_p||''}</div>`).join('');
      }
    }
  } catch(e) {}
  hubModal(`🎓 ${ac.materia || 'Academia'}`,`
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div style="background:#f8fafc;border-radius:10px;padding:14px;">
        <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Docentes en esta academia</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">${docentesHtml}</div>
      </div>
      ${ac.proxima_reunion ? `<div style="font-size:13px;color:#7c3aed;font-weight:600;">📅 Próxima reunión: ${new Date(ac.proxima_reunion).toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>` : ''}
      ${ac.descripcion ? `<div style="font-size:13px;color:#475569;">${ac.descripcion}</div>` : ''}
    </div>`, 'Cerrar', null);
}

async function coordAcademiaAgregarDocente(id) {
  const ac = window._coordAcademias?.find(a => (a.id === id || a.id === String(id)));
  if (!ac) { hubToast('Academia no encontrada', 'warn'); return; }
  const cct = typeof _getCct === 'function' ? _getCct() : (window.currentPerfil?.escuela_cct || null);
  // Cargar docentes de la escuela
  let optsHtml = '<option value="">Cargando…</option>';
  try {
    if (window.sb) {
      const { data: docs } = await window.sb.from('usuarios')
        .select('id,nombre,apellido_p').eq('escuela_cct', cct).eq('rol','docente').eq('activo',true).order('nombre');
      if (docs?.length) {
        optsHtml = '<option value="">Seleccionar docente…</option>' +
          docs.map(d => `<option value="${d.id}">${d.nombre} ${d.apellido_p||''}</option>`).join('');
      }
    }
  } catch(e) {}
  hubModal(`👩‍🏫 Agregar docente — ${ac.materia||'Academia'}`,`
    <div style="display:flex;flex-direction:column;gap:12px;">
      <select id="coord-ac-docente" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">${optsHtml}</select>
    </div>`, 'Agregar', async () => {
    const docenteId = document.getElementById('coord-ac-docente')?.value;
    if (!docenteId) { hubToast('Selecciona un docente', 'warn'); return; }
    const ids = [...(ac.docentes_ids || [])];
    if (!ids.includes(docenteId)) ids.push(docenteId);
    try {
      await window.sb.from('academias').update({ docentes_ids: ids, integrantes: ids.length }).eq('id', ac.id);
      hubToast('✅ Docente agregado a la academia', 'ok');
      coordAcademiasCargar();
    } catch(e) { hubToast('Error: ' + e.message, 'error'); }
  });
}

async function coordAcademiaReunion(id) {
  const ac = window._coordAcademias?.find(a => (a.id === id || a.id === String(id)));
  if (!ac) { hubToast('Academia no encontrada', 'warn'); return; }
  hubModal(`📅 Programar reunión — ${ac.materia||'Academia'}`,`
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Fecha de la reunión</label>
        <input id="coord-reunion-fecha" type="datetime-local" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Tema / orden del día</label>
        <textarea id="coord-reunion-tema" rows="3" placeholder="Describe el tema principal…" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;resize:vertical;"></textarea>
      </div>
    </div>`, 'Programar', async () => {
    const fecha = document.getElementById('coord-reunion-fecha')?.value;
    if (!fecha) { hubToast('Selecciona una fecha', 'warn'); return; }
    const tema = document.getElementById('coord-reunion-tema')?.value?.trim() || '';
    try {
      await window.sb.from('academias').update({
        proxima_reunion: new Date(fecha).toISOString(),
        descripcion: tema || ac.descripcion || null,
      }).eq('id', ac.id);
      hubToast('✅ Reunión programada', 'ok');
      coordAcademiasCargar();
    } catch(e) { hubToast('Error: ' + e.message, 'error'); }
  });
}

// ── Coordinador: Alertas de bajo rendimiento ─────────────────────
async function coordAlertasRendimientoCargar() {
  const cct = typeof _getCct === 'function' ? _getCct() : (window.currentPerfil?.escuela_cct || null);
  const lista = document.getElementById('alertas-rendimiento-lista');
  const umbral = parseFloat(document.getElementById('alerta-umbral')?.value || '7');
  if (!lista) return;
  lista.innerHTML = `<div style="text-align:center;padding:40px;background:white;border-radius:12px;border:1px solid #e2e8f0;"><div style="font-size:32px;">⏳</div><div style="font-size:13px;color:#94a3b8;margin-top:8px;">Analizando calificaciones…</div></div>`;
  if (!window.sb || !cct) { lista.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">Sin conexión</div>'; return; }
  try {
    // Obtener calificaciones de la escuela agrupadas por grupo/materia
    const { data: cals } = await window.sb.from('calificaciones')
      .select('alumno_id,grupo_id,materia,calificacion,grupos(nombre)')
      .eq('escuela_cct', cct);
    if (!cals?.length) {
      lista.innerHTML = `<div style="text-align:center;padding:60px;background:white;border-radius:12px;border:1px solid #e2e8f0;"><div style="font-size:36px;">✅</div><div style="font-size:14px;font-weight:600;color:#0f172a;margin-top:8px;">Sin alertas de rendimiento</div><div style="font-size:13px;color:#94a3b8;margin-top:4px;">Por ahora no hay alumnos en riesgo con los filtros actuales o aún no se han capturado evaluaciones.</div></div>`;
      return;
    }
    // Agrupar por grupo+materia
    const grupos = {};
    cals.forEach(c => {
      const key = `${c.grupo_id}__${c.materia||'General'}`;
      if (!grupos[key]) grupos[key] = { grupo_id: c.grupo_id, grupo_nombre: c.grupos?.nombre || c.grupo_id, materia: c.materia||'General', cals: [] };
      grupos[key].cals.push(parseFloat(c.calificacion)||0);
    });
    // Filtrar por umbral
    const alertas = Object.values(grupos).map(g => {
      const promedio = g.cals.reduce((a,b)=>a+b,0) / g.cals.length;
      const bajos = g.cals.filter(c => c < umbral).length;
      return { ...g, promedio, bajos, total: g.cals.length };
    }).filter(g => g.promedio < umbral).sort((a,b) => a.promedio - b.promedio);

    // KPIs
    const gruposRiesgo = new Set(alertas.map(a=>a.grupo_id)).size;
    const alumnosBajo = alertas.reduce((s,a)=>s+a.bajos,0);
    const materiasRiesgo = new Set(alertas.map(a=>a.materia)).size;
    document.getElementById('alerta-kpi-grupos').textContent = gruposRiesgo;
    document.getElementById('alerta-kpi-alumnos').textContent = alumnosBajo;
    document.getElementById('alerta-kpi-materias').textContent = materiasRiesgo;

    // Badge nav
    const badge = document.getElementById('cn-alertas-badge');
    if (badge) { badge.textContent = alertas.length||''; badge.style.display = alertas.length ? 'inline-block':'none'; }

    if (!alertas.length) {
      lista.innerHTML = `<div style="text-align:center;padding:60px;background:white;border-radius:12px;border:1px solid #e2e8f0;"><div style="font-size:36px;">✅</div><div style="font-size:14px;font-weight:600;color:#0f172a;margin-top:8px;">Todo está bien</div><div style="font-size:13px;color:#94a3b8;margin-top:4px;">Ningún grupo está bajo el umbral de ${umbral}</div></div>`;
      return;
    }
    lista.innerHTML = alertas.map(a => {
      const pct = (a.promedio / 10) * 100;
      const color = a.promedio < 5 ? '#dc2626' : a.promedio < umbral ? '#d97706' : '#15803d';
      return `<div style="background:white;border-radius:12px;border:1.5px solid #fee2e2;padding:16px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <div>
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${a.materia} — ${a.grupo_nombre}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">${a.bajos} de ${a.total} alumnos bajo ${umbral}</div>
          </div>
          <div style="font-size:22px;font-weight:800;color:${color};">${a.promedio.toFixed(1)}</div>
        </div>
        <div style="background:#f1f5f9;border-radius:20px;height:8px;overflow:hidden;">
          <div style="background:${color};height:100%;width:${Math.min(pct,100)}%;border-radius:20px;transition:.3s;"></div>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <button onclick="coordVisitarGrupo('${a.grupo_id}')" style="padding:5px 12px;font-size:11px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">📅 Programar visita</button>
          <button onclick="coordGenerarPlanApoyo('${a.grupo_id}','${a.materia}')" style="padding:5px 12px;font-size:11px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:6px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">📋 Plan de apoyo</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    lista.innerHTML = `<div style="padding:20px;color:#dc2626;font-size:13px;">Error: ${e.message}</div>`;
  }
}

function coordVisitarGrupo(grupoId) { hubToast('📅 Visita programada — ve a la sección Visitas a docentes', 'ok'); coordNav('visitas'); }
async function coordGenerarPlanApoyo(grupoId, materia) {
  hubToast('📋 Analizando datos del grupo…');
  const ciclo = window.CICLO_ACTIVO || '2025-2026';
  const cct = window.currentPerfil?.escuela_cct;

  const [{ data: cals }, { data: grupo }] = await Promise.all([
    sb.from('calificaciones')
      .select('alumno_id, calificacion, trimestre, usuarios!alumno_id(nombre,apellido_p)')
      .eq('grupo_id', grupoId).eq('materia', materia).eq('ciclo', ciclo),
    sb.from('grupos').select('nombre,grado').eq('id', grupoId).maybeSingle()
  ]);

  if (!cals?.length) { hubToast('Sin calificaciones registradas para generar plan','warn'); return; }

  const promedio = (cals.reduce((s,c) => s + (parseFloat(c.calificacion)||0), 0) / cals.length).toFixed(1);
  const bajos = cals.filter(c => (parseFloat(c.calificacion)||0) < 6);
  const riesgo = cals.filter(c => (parseFloat(c.calificacion)||0) >= 6 && (parseFloat(c.calificacion)||0) < 7);

  const prompt = `Contexto: Escuela ${cct || 'mexicana'} · Grupo ${grupo?.nombre || grupoId} (${grupo?.grado || '?'} grado) · Materia: ${materia} · Ciclo ${ciclo}

Datos académicos:
- Promedio grupal: ${promedio}/10
- Alumnos con calificación reprobatoria (<6): ${bajos.length} de ${cals.length}
- Alumnos en riesgo (6-6.9): ${riesgo.length}
- Alumnos que necesitan apoyo especial: ${bajos.map(c=>`${c.usuarios?.nombre||'Alumno'} (${c.calificacion})`).join(', ') || 'ninguno'}

Genera un Plan de Apoyo Pedagógico NEM con estas secciones:
1. Diagnóstico del grupo (2-3 oraciones)
2. Objetivos de mejora para el próximo período
3. Estrategias de remediación específicas para ${materia} (mínimo 4 actividades concretas, con enfoque NEM)
4. Acciones de apoyo extra-clase para alumnos en riesgo
5. Indicadores de logro medibles y verificables
6. Cronograma sugerido (30-60 días)`;

  const texto = await callAI({
    feature: 'coord_plan_apoyo',
    prompt,
    system: _nemSys(`TAREA: Eres coordinador académico generando un Plan de Apoyo Pedagógico oficial. Sé específico, práctico y usa el enfoque NEM. Materia actual: ${materia}.`)
  });

  hubModal(`<div style="padding:20px;max-width:560px;width:100%;max-height:75vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="font-size:16px;font-weight:800;">📋 Plan de Apoyo — ${materia}</h3>
      <button onclick="navigator.clipboard.writeText(${JSON.stringify(texto)});hubToast('✅ Copiado')"
        style="padding:6px 14px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Copiar</button>
    </div>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;font-size:13px;line-height:1.75;white-space:pre-wrap;color:#0f172a;">${texto}</div>
    <div style="margin-top:12px;font-size:11px;color:#94a3b8;">Generado con IA · Revisa y adapta antes de aplicar</div>
  </div>`);
}
window.coordGenerarPlanApoyo = coordGenerarPlanApoyo;

function coordRenderVisitasLista() {
  const lista = document.getElementById('coord-visitas-lista');
  if (!lista) return;
  // Usar docentes reales si están cargados, si no usar demo
  const src = window._coordDocentes?.length ? window._coordDocentes : (typeof COORD_DOCENTES !== 'undefined' ? COORD_DOCENTES : []);
  lista.innerHTML = src.map((d,i) => {
    const nombre  = d.nombre || d.n || '—';
    const materia = d.docente_grupos?.[0]?.materia || d.materia || '—';
    const visitas = (window._coordVisitas||[]).filter(v => v.docente_id === d.id);
    const ultimaV = visitas[0] ? new Date(visitas[0].created_at||visitas[0].fecha_visita).toLocaleDateString('es-MX') : 'Sin visitas';
    const prom    = d.promedio || (visitas[0]?.calificacion?.toFixed(1)) || '—';
    const color   = parseFloat(prom) >= 9 ? '#15803d' : parseFloat(prom) >= 8 ? '#1e40af' : '#a16207';
    const bg      = parseFloat(prom) >= 9 ? '#dcfce7' : parseFloat(prom) >= 8 ? '#dbeafe' : '#fef9c3';
    const ini     = nombre.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
    return `<div onclick="coordSelDocentePortal(${i})" style="padding:12px 16px;border-bottom:1px solid #f1f5f9;cursor:pointer;display:flex;align-items:center;gap:10px;"
      onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
      <div style="width:34px;height:34px;border-radius:50%;background:#5b21b6;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:white;flex-shrink:0;">${ini}</div>
      <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nombre}</div><div style="font-size:11px;color:#64748b;">${materia} · Última: ${ultimaV}</div></div>
      <span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:99px;background:${bg};color:${color};flex-shrink:0;">${prom}</span>
    </div>`;
  }).join('') || '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">Sin docentes cargados</div>';
}

// ── Función faltante: renderizar visitas en sección historial ──────────
function coordRenderVisitas() {
  // Esta función renderiza en la sección de historial
  coordRenderHistorial();
}

// ── Dashboard coordinador con datos reales ────────────────────────────
function coordRenderDash() {
  const docentes = window._coordDocentes || (typeof COORD_DOCENTES !== 'undefined' ? COORD_DOCENTES : []);
  const visitas  = window._coordVisitas  || [];
  const mes      = new Date().getMonth();

  // Actualizar stats
  const statDocs = document.getElementById('coord-stat-docentes');
  const statVis  = document.getElementById('coord-stat-visitas');
  const statPend = document.getElementById('coord-stat-pendientes');
  const statProm = document.getElementById('coord-stat-promedio');

  if (statDocs) statDocs.textContent = docentes.length || '—';
  if (statVis)  statVis.textContent  = visitas.length  || '—';

  // Pendientes = docentes sin visita este mes
  const visitasMes = visitas.filter(v => {
    const d = new Date(v.created_at || v.fecha_visita || 0);
    return d.getMonth() === mes;
  });
  const docConVisitaMes = new Set(visitasMes.map(v => v.docente_id));
  const pendientes = docentes.filter(d => !docConVisitaMes.has(d.id)).length;
  if (statPend) statPend.textContent = pendientes || '—';

  // Promedio general de rúbricas
  if (statProm && visitas.length) {
    const proms = visitas.filter(v => v.calificacion).map(v => parseFloat(v.calificacion));
    if (proms.length) statProm.textContent = (proms.reduce((s,p)=>s+p,0)/proms.length).toFixed(1);
  }

  // Alertas: docentes con calificación baja
  const alertEl = document.getElementById('coord-alertas-lista');
  if (alertEl) {
    const alertas = docentes.filter(d => {
      const vsDoc = visitas.filter(v => v.docente_id === d.id);
      if (!vsDoc.length) return false;
      const avgD = vsDoc.reduce((s,v)=>s+(v.calificacion||0),0)/vsDoc.length;
      return avgD < 8;
    });
    if (alertas.length) {
      alertEl.innerHTML = alertas.slice(0,3).map(d => {
        const vsDoc = visitas.filter(v => v.docente_id === d.id);
        const avgD  = (vsDoc.reduce((s,v)=>s+(v.calificacion||0),0)/vsDoc.length).toFixed(1);
        const ini   = (d.nombre||'').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
        return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fef9c3;border-radius:9px;margin-bottom:6px;">
          <div style="width:32px;height:32px;border-radius:50%;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:white;flex-shrink:0;">${ini}</div>
          <div style="flex:1;"><div style="font-size:13px;font-weight:700;">${d.nombre||'—'}</div><div style="font-size:11px;color:#92400e;">Promedio rúbrica: ${avgD}</div></div>
          <span style="font-size:11px;font-weight:800;background:#fef9c3;color:#a16207;padding:2px 8px;border-radius:99px;">${avgD}</span>
        </div>`;
      }).join('');
    }
  }
}

// ── Historial de evaluaciones con datos reales ────────────────────────
function coordRenderHistorial() {
  const tbody = document.querySelector('#coord-p-historial tbody');
  if (!tbody) return;
  const visitas = window._coordVisitas || [];
  if (!visitas.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:32px;text-align:center;color:#94a3b8;font-size:13px;">Todavía no hay evaluaciones registradas para este periodo. Cuando el coordinador capture visitas o seguimiento, aparecerán aquí.</td></tr>`;
    return;
  }
  tbody.innerHTML = visitas.slice(0,20).map(v => {
    const nombre = v.usuarios ? `${v.usuarios.nombre||''} ${v.usuarios.apellido_p||''}`.trim() : '—';
    const fecha  = v.created_at ? new Date(v.created_at).toLocaleDateString('es-MX') : (v.fecha_visita || '—');
    const tipo   = v.tipo || 'Visita aula';
    const cal    = v.calificacion ? v.calificacion.toFixed(1)+'/10' : '—';
    const color  = parseFloat(v.calificacion) >= 9 ? '#15803d' : parseFloat(v.calificacion) >= 8 ? '#1e40af' : '#a16207';
    const bg     = parseFloat(v.calificacion) >= 9 ? '#dcfce7' : parseFloat(v.calificacion) >= 8 ? '#dbeafe' : '#fef9c3';
    return `<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:12px 16px;font-weight:600;">${nombre}</td>
      <td style="padding:12px 16px;color:#64748b;">${fecha}</td>
      <td style="padding:12px 16px;"><span style="background:${bg};color:${color};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;">${tipo}</span></td>
      <td style="padding:12px 16px;font-weight:700;color:${color};">${cal}</td>
      <td style="padding:12px 16px;"><button onclick="coordVerDetalleVisitaById('${v.id}')" style="padding:4px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;cursor:pointer;font-family:'Sora',sans-serif;">Ver</button></td>
    </tr>`;
  }).join('');
}

// ── Planeaciones con datos reales ────────────────────────────────────
async function coordRenderPlaneaciones() {
  const lista = document.getElementById('coord-planeaciones-lista');
  if (!lista) return;
  const cct = typeof _getCct === 'function' ? _getCct() : (window.currentPerfil?.escuela_cct || null);
  if (!window.sb || !cct) return;
  lista.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b;font-size:13px;">Cargando planeaciones…</div>';
  try {
    // Cargar docentes reales de la escuela
    if (!window._coordDocentes?.length) {
      const { data: docentes } = await window.sb.from('usuarios')
        .select('id, nombre, apellido_p')
        .eq('rol', 'docente')
        .eq('escuela_cct', cct);
      window._coordDocentes = docentes || [];
    }
    const docenteIds = (window._coordDocentes || []).map(d => d.id);
    if (!docenteIds.length) {
      lista.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b;font-size:13px;">No hay docentes registrados en esta escuela.</div>';
      return;
    }
    const { data, error } = await window.sb.from('planeaciones_clase')
      .select('id, docente_id, materia, grupo, semana, objetivo, contenido_json, updated_at')
      .eq('escuela_cct', cct)
      .eq('ciclo', window.CICLO_ACTIVO || '2025-2026')
      .in('docente_id', docenteIds)
      .order('updated_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    if (!data?.length) {
      lista.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b;font-size:13px;">Ningún docente ha guardado planeaciones aún en este ciclo.</div>';
      return;
    }
    // Mapa docente_id → nombre
    const docenteMap = {};
    (window._coordDocentes || []).forEach(d => {
      docenteMap[d.id] = `${d.nombre||''} ${d.apellido_p||''}`.trim();
    });
    lista.innerHTML = data.map(p => {
      const nombre = docenteMap[p.docente_id] || 'Docente';
      const cj = p.contenido_json || {};
      const semanaFmt = p.semana ? new Date(p.semana + 'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'}) : 'Sin semana';
      const fecha = p.updated_at ? new Date(p.updated_at).toLocaleDateString('es-MX') : '—';
      const materia = p.materia || cj.campo || '—';
      const status = cj.status || p.estado || 'pendiente';
      const statusUi = planEstadoBadge(status);
      return `<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:16px 18px;display:flex;align-items:center;gap:14px;">
        <div style="width:44px;height:44px;border-radius:10px;background:#dcfce7;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📋</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;">${nombre} · ${materia}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">Semana: ${semanaFmt} · Grupo: ${p.grupo||'—'} · Actualizado: ${fecha}</div>
          ${(cj.proposito || cj.producto) ? `<div style="font-size:11px;color:#475569;margin-top:4px;">${cj.proposito || cj.producto}</div>` : ''}
        </div>
        <span style="font-size:10px;font-weight:700;padding:4px 8px;border-radius:999px;background:${statusUi.bg};color:${statusUi.color};">${statusUi.label}</span>
        <button onclick="coordRevisarPlaneacionReal('${p.id}','${nombre}','${materia}')" style="padding:6px 14px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Sora',sans-serif;color:#374151;">Revisar</button>
      </div>`;
    }).join('');
  } catch(e) {
    console.error('[coordRenderPlaneaciones]', e);
    lista.innerHTML = '<div style="padding:20px;text-align:center;color:#dc2626;font-size:13px;">Error al cargar planeaciones. Verifica la conexión.</div>';
  }
}

function coordSelDocentePortal(idx) {
  coordDocenteActual = idx;
  coordRenderVisitasLista();
  const d = COORD_DOCENTES[idx];
  const wrap = document.getElementById('coord-rubrica-wrap');
  if (!wrap) return;
  const hoy = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
  wrap.innerHTML = `
    <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:20px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #f1f5f9;">
        <div style="width:48px;height:48px;border-radius:50%;background:#5b21b6;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:white;flex-shrink:0;">${d.nombre.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase()}</div>
        <div style="flex:1;"><div style="font-size:16px;font-weight:700;">${d.nombre}</div><div style="font-size:12px;color:#64748b;">${d.materia} · ${d.grupo} · Visita ${hoy}</div></div>
      </div>
      ${COORD_RUBRICA.map(cat => `
        <div style="margin-bottom:18px;">
          <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#374151;margin-bottom:10px;padding:6px 10px;background:#faf5ff;border-radius:6px;">${cat.cat}</div>
          ${cat.items.map((item,ii) => {
            const key = 'p_'+idx+'_'+cat.id+'_'+ii;
            const val = coordCalificaciones[key] || 0;
            return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:10px 12px;background:#f8fafc;border-radius:8px;">
              <div style="flex:1;font-size:12px;color:#374151;line-height:1.5;">${item}</div>
              <div style="display:flex;gap:4px;flex-shrink:0;">
                ${[1,2,3,4,5].map(n=>`<button onclick="coordSetCal('${key}',${n},this)" style="width:28px;height:28px;border-radius:6px;border:1.5px solid ${val>=n?'#5b21b6':'#d1d5db'};background:${val>=n?'#ede9fe':'white'};font-size:12px;font-weight:700;color:${val>=n?'#5b21b6':'#9ca3af'};cursor:pointer;font-family:'Sora',sans-serif;transition:.15s;">${n}</button>`).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>`).join('')}
      <textarea id="coord-obs-p-${idx}" placeholder="Observaciones de la visita…" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;resize:vertical;min-height:80px;outline:none;margin-bottom:12px;box-sizing:border-box;"></textarea>
      <div style="display:flex;gap:10px;">
        <button onclick="coordGuardarEvaluacion(${idx})" style="flex:2;padding:11px;background:#5b21b6;color:white;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">💾 Guardar evaluación</button>
        <button onclick="coordEnviarDocente(${idx})" style="flex:1;padding:11px;background:#faf5ff;color:#5b21b6;border:1.5px solid #c4b5fd;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">📤 Enviar al docente</button>
      </div>
    </div>`;
}

async function hubLogout() {
  if (window.ADM) ADM._initialized = false;
  // Limpiar todos los canales Realtime antes de salir
  if (typeof realtimeDesuscribirTodos === 'function') realtimeDesuscribirTodos();
  // Limpiar timer de inactividad
  if (window._inactivityTimer) { clearTimeout(window._inactivityTimer); window._inactivityTimer = null; }
  if (window._inactivityWarnTimer) { clearTimeout(window._inactivityWarnTimer); window._inactivityWarnTimer = null; }

  // ── CRÍTICO: cerrar sesión en Supabase ANTES de mostrar el login ────
  // Si no se espera, el token sigue activo y el siguiente getSession() devuelve
  // la sesión stale causando el error "no tiene perfil"
  try { if (sb) await sb.auth.signOut(); } catch(e) {}

  // Limpiar estado en memoria
  window.currentUser = null;
  window.currentPerfil = null;
  window._grupoTutoria = null;
  window._modoSubdirector = false;
  window._modoCoordinador = false;
  window._modoPrefecto = false;

  // Limpiar caché de perfil en sessionStorage
  sessionStorage.removeItem('siembra_login_ts');
  sessionStorage.removeItem('siembra_last_activity');
  Object.keys(sessionStorage)
    .filter(k => k.startsWith('siembra_perfil_'))
    .forEach(k => sessionStorage.removeItem(k));

  // Limpiar escuela activa en memoria Y localStorage (forzar nueva selección)
  window._escuelaCfg = { cct:'', nombre:'', plan:'base', nivel_default:'secundaria' };
  window.ESCUELA_ACTIVA = null;
  window._nivelActivo = null;
  window.SIEMBRA_PLAN = 'base';
  try {
    localStorage.removeItem('siembra_escuela_cfg');
    localStorage.removeItem('siembra_nivel_activo');
    localStorage.removeItem('siembra_adm_nivel');
  } catch(e) {}

  // Ocultar todos los portales
  ['doc-portal','dir-portal','admin-portal','padre-portal','ts-portal',
   'contralor-portal','subdir-portal','coord-portal','pref-portal',
   'orientador-portal','medico-portal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Resetear rol seleccionado
  if (window.SiembraHub?.resetRole) window.SiembraHub.resetRole();
  const btn = document.getElementById('hub-login-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

  // Mostrar login y recargar escuelas disponibles
  document.getElementById('hub-login').style.display = 'grid';
  if (typeof hubCargarEscuelasDisponibles === 'function') {
    try {
      await hubCargarEscuelasDisponibles();
      if (typeof hubActualizarHint === 'function') hubActualizarHint();
      if (typeof hubActualizarBotones === 'function') hubActualizarBotones();
      if (typeof _cargarStatsLogin === 'function') _cargarStatsLogin();
    } catch(e) {}
  }
}

// ── Timer de inactividad ─────────────────────────────────────────────────
(function _setupInactivityTimer() {
  const INACTIVITY_MS  = 60 * 60 * 1000; // 60 minutos sin actividad
  const WARNING_MS     = 55 * 60 * 1000; // aviso al minuto 55
  let warnShown = false;

  function _resetInactivityTimer() {
    sessionStorage.setItem('siembra_last_activity', Date.now().toString());
    if (window._inactivityTimer) clearTimeout(window._inactivityTimer);
    if (window._inactivityWarnTimer) clearTimeout(window._inactivityWarnTimer);
    warnShown = false;

    // Aviso a los 55 min
    window._inactivityWarnTimer = setTimeout(() => {
      if (!currentUser) return;
      if (!warnShown) {
        warnShown = true;
        hubToast('⚠️ Tu sesión cerrará en 5 minutos por inactividad.', 'warn');
      }
    }, WARNING_MS);

    // Logout a los 60 min
    window._inactivityTimer = setTimeout(() => {
      if (!currentUser) return;
      hubToast('🔒 Sesión cerrada por inactividad.', 'err');
      setTimeout(() => hubLogout(), 1500);
    }, INACTIVITY_MS);
  }

  // Escuchar cualquier interacción del usuario
  ['mousemove','keydown','mousedown','touchstart','scroll','click'].forEach(ev => {
    document.addEventListener(ev, _resetInactivityTimer, { passive: true });
  });

  // Arrancar el timer al cargar
  window._resetInactivityTimer = _resetInactivityTimer;
})();

function hubToast(msg, type) {
  const t = document.getElementById('hub-toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = type==='ok'||type==='success' ? '#0d5c2f' : type==='err'||type==='error' ? '#c0392b' : type==='warn' ? '#b45309' : type==='info' ? '#3b82f6' : type==='realtime' ? '#7c3aed' : '#0f1f3d';
  if (type==='realtime' && !msg.startsWith('⚡')) { t.textContent = '⚡ ' + msg; }
  t.style.transform = 'translateY(0)'; t.style.opacity = '1';
  clearTimeout(window._ht);
  window._ht = setTimeout(() => { t.style.transform='translateY(60px)'; t.style.opacity='0'; }, 3000);
}

// Director: call all render functions
async function dirInitAll() {
  // Cargar datos reales desde Supabase
  await dirCargarDatosDB();
  // Render inicial
  if (typeof dirRenderDash  === 'function') dirRenderDash();
  if (typeof renderDocentes === 'function') renderDocentes();
  if (typeof renderGrupos   === 'function') renderGrupos();
  if (typeof renderConstructor === 'function') renderConstructor();
  if (typeof renderConflictos  === 'function') renderConflictos();
  if (typeof renderHorariosPublicados === 'function') renderHorariosPublicados();
}

async function dirCargarDatosDB() {
  if (!sb || !currentPerfil) return;
  // Use escuela_cct (real column) and resolve UUID if needed
  const escuelaId  = currentPerfil.escuela_id || null;
  const escuelaCct = currentPerfil.escuela_cct || null;
  if (!escuelaId && !escuelaCct) return;

  try {
    // Limpiar datos anteriores antes de cargar desde DB
    docentes.length = 0;
    grupos.length = 0;
    // Cargar docentes de esta escuela
    const dirEscFilter = escuelaCct
      ? { col: 'escuela_cct', val: escuelaCct }
      : { col: 'escuela_id', val: escuelaId };
    const { data: docentesDB } = await sb.from('usuarios')
      .select('id, nombre, apellido_p, apellido_m, email, rol, activo')
      .eq(dirEscFilter.col, dirEscFilter.val)
      .in('rol', ['docente','coordinador','ts','prefecto','tutor','subdirector','admin'])
      .eq('activo', true)
      .order('nombre');

    if (docentesDB?.length) {
      // Map to the format dirRenderDash expects
      docentesDB.forEach((d, i) => {
        const nom = `${d.nombre} ${d.apellido_p||''}`.trim();
        const ini = (d.nombre?.[0]||'') + (d.apellido_p?.[0]||'');
        // Add/update in the global docentes array
        const existing = docentes.find(x => x.db_id === d.id);
        if (!existing) {
          docentes.push({
            id: i, db_id: d.id,
            nombre: nom, ini: ini.toUpperCase(),
            materias: [], grupos: [],
            horas: 0, enviado: '—', estado: 'enviado',
            email: d.email, rol: d.rol
          });
        }
      });
    }

    // Cargar grupos de esta escuela
    const { data: gruposDB } = await sb.from('grupos')
      .select('id, nombre, grado, grupo, nivel')
      .eq('escuela_cct', window.currentPerfil?.escuela_cct || ADM.escuelaCct)
      .order('grado');

    if (gruposDB?.length) {
      gruposDB.forEach(g => {
        const nom = g.nombre || `${g.grado}° ${g.seccion}`;
        const existing = grupos.find(x => x.db_id === g.id);
        if (!existing) {
          grupos.push({
            db_id: g.id, nombre: nom,
            alumnos: 0, docente: '—', horario: false
          });
        }
      });

      // Contar alumnos por grupo
      for (const gr of grupos) {
        if (!gr.db_id) continue;
        const { count } = await sb.from('alumnos_grupos')
          .select('id', { count: 'exact', head: true })
          .eq('grupo_id', gr.db_id).eq('activo', true);
        if (count !== null) gr.alumnos = count;
      }
    }

    // Actualizar stats del topbar del director
    const statAlEl = document.getElementById('dir-stat-alumnos');
    const statDoEl = document.getElementById('dir-stat-docentes');
    const statGrEl = document.getElementById('dir-stat-grupos');
    const totalAl = grupos.reduce((s,g)=>s+(g.alumnos||0), 0);
    if (statAlEl) statAlEl.textContent = totalAl;
    if (statDoEl) statDoEl.textContent = docentes.length;
    if (statGrEl) statGrEl.textContent = grupos.length;

  } catch(e) {
    console.warn('[dirInitAll] DB error:', e.message);
    // Mantener arrays vacíos — mostrarán estado vacío
  }
}

// Admin nav & init
function adminNav(page) {
  closeSidebarOnMobile();
  document.querySelectorAll('#admin-portal .adm-page').forEach(p => p.style.display='none');
  const pg = document.getElementById('adm-p-'+page);
  if (pg) pg.style.display = 'block';
  document.querySelectorAll('.adm-nav').forEach(b => b.style.background = '');
  const btn = document.getElementById('an-'+page);
  if (btn) btn.style.background = 'rgba(255,255,255,.1)';
  const titles = {
    dashboard:'Dashboard · Secretaría', escuela:'Mi Escuela',
    inscripciones:'Inscripciones', padron:'Padrón de Alumnos',
    negocios:'Negocios Aliados', mapa:'Mapa Escolar',
    reportes:'Reportes SEP', usuarios:'Usuarios', config:'Configuración',
    materias:'Materias por Docente', secretarias:'Secretarías por Grado',
    admisiones:'Admisión y Acomodo de Grupos', coordinador:'Coordinador Académico',
    subdirector:'Subdirección'
  };
  const t = document.getElementById('adm-title');
  if (t) t.textContent = titles[page] || page;
  // Cargar datos al navegar
  if (page === 'usuarios')    { admCargarUsuarios(); admCargarGruposAdmin(); }
  if (page === 'admisiones')  { admCargarGruposAdmin(); }
  if (page === 'materias')    { admCargarAsignaciones(); }
  if (page === 'coordinador') { coordRenderDocentes(); }
  if (page === 'padron')      { admCargarAlumnosAdmin(); }
  if (page === 'constructor') { setTimeout(()=>{ if(typeof renderConstructor==='function') renderConstructor(); },100); }
  if (page === 'conflictos')  { setTimeout(()=>{ if(typeof renderConflictos==='function') renderConflictos(); },100); }
}
