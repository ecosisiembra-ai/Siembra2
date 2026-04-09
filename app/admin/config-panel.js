function abrirConfig(){
  const modal = document.getElementById('modal-config');
  const box   = document.getElementById('config-box');
  // Llenar datos del usuario actual
  const p = window.currentPerfil || {};
  const nom = [p.nombre, p.apellido_p].filter(Boolean).join(' ') || p.email || 'Usuario';
  const inicial = (nom[0] || '?').toUpperCase();
  const el = id => document.getElementById(id);
  if (el('cfg-avatar'))  el('cfg-avatar').textContent  = inicial;
  if (el('cfg-nombre'))  el('cfg-nombre').textContent  = nom;
  if (el('cfg-rol'))     el('cfg-rol').textContent     = (p.rol || '—').charAt(0).toUpperCase() + (p.rol||'—').slice(1);
  if (el('cfg-escuela')) el('cfg-escuela').textContent = p.escuela_cct ? `CCT: ${p.escuela_cct}` : '';
  modal.style.opacity = '1'; modal.style.pointerEvents = 'all';
  box.style.transform = 'translateY(0)';
}
function cerrarConfig(){
  const modal = document.getElementById('modal-config');
  const box   = document.getElementById('config-box');
  modal.style.opacity = '0'; modal.style.pointerEvents = 'none';
  box.style.transform = 'translateY(24px)';
}
// Mantener compatibilidad con cualquier llamada residual a estas funciones
function configToggleVer(){}
function actualizarConfigStatus(){}
function guardarConfig(){ cerrarConfig(); }

// ══════════════════════════════════════════════════════
//  OBSERVACIONES + XP + ALERTA TS — PORTAL DOCENTE
// ══════════════════════════════════════════════════════

let _xpPuntosSeleccionados = 50;

function obsTab(tab) {
  ['nueva','historial','xp','rutas'].forEach(t => {
    const btn = document.getElementById('obs-tab-'+t);
    const pan = document.getElementById('obs-panel-'+t);
    const active = t === tab;
    if (btn) {
      btn.style.background = active ? 'white' : 'transparent';
      btn.style.color = active ? 'var(--verde)' : 'var(--gris-50)';
      btn.style.fontWeight = active ? '700' : '600';
      btn.style.boxShadow = active ? '0 1px 3px rgba(0,0,0,.08)' : 'none';
    }
    if (pan) pan.style.display = active ? '' : 'none';
  });
  if (tab === 'historial') obsCargarHistorial();
  if (tab === 'xp') {
    xpCargarRanking();
    const obsAlumno = document.getElementById('obs-sel-alumno')?.value;
    const xpSel = document.getElementById('xp-sel-alumno');
    if (xpSel && obsAlumno) xpSel.value = obsAlumno;
  }
  if (tab === 'rutas') {
    rutasPoblarSelect();
    rutasCargarGrupo();
  }
}

function obsPoblarSelects() {
  const lista = window._alumnosActivos || alumnos;
  const materias = (window._materiasDocente?.length)
    ? window._materiasDocente
    : (typeof MATERIAS_NEM !== 'undefined' ? MATERIAS_NEM : []);

  const alumnoOpts = `<option value="">— Seleccionar alumno —</option>` +
    lista.map(a => {
      const nombre = a.n || `${a.nombre||''} ${a.apellido_p||''}`.trim();
      const id = a.id || nombre;
      return `<option value="${id}">${nombre}</option>`;
    }).join('');

  const materiaOpts = `<option value="">— General —</option>` +
    materias.map(m => `<option value="${m}">${m}</option>`).join('');

  ['obs-sel-alumno','obs-hist-alumno','xp-sel-alumno','alerta-sel-alumno','ruta-sel-alumno'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) sel.innerHTML = alumnoOpts;
  });

  ['obs-sel-materia','alerta-materia'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) sel.innerHTML = materiaOpts;
  });

  // Poblar selector de materia en modal nueva tarea
  const ctMat = document.getElementById('ct-new-materia');
  if (ctMat) {
    ctMat.innerHTML = `<option value="">— Seleccionar —</option>` +
      materias.map(m => `<option value="${m}">${m}</option>`).join('');
  }
}

function obsSelTipo(tipo) {
  const info = document.getElementById('obs-destino-info');
  if (!info) return;
  if (tipo === 'positiva') {
    info.style.background = '#f0fdf4'; info.style.borderColor = '#86efac'; info.style.color = '#166534';
    info.innerHTML = '✅ Esta observación positiva será visible para la <strong>familia del alumno</strong> en su app.';
  } else if (tipo === 'negativa') {
    info.style.background = '#fef2f2'; info.style.borderColor = '#fecaca'; info.style.color = '#b91c1c';
    info.innerHTML = '⚠️ Esta observación se enviará a <strong>Trabajo Social</strong> para seguimiento. TS contactará a la familia si es necesario.';
  } else {
    info.style.background = '#f8fafc'; info.style.borderColor = '#e2e8f0'; info.style.color = '#64748b';
    info.innerHTML = '📋 Esta observación quedará en el expediente del alumno. Solo visible para el equipo escolar.';
  }
}

async function obsGuardar() {
  const alumnoId   = document.getElementById('obs-sel-alumno')?.value;
  const materia    = document.getElementById('obs-sel-materia')?.value || '';
  const tipo       = document.querySelector('input[name="obs-tipo"]:checked')?.value || 'positiva';
  const texto      = document.getElementById('obs-texto')?.value.trim();
  const trim       = parseInt(document.getElementById('obs-trimestre')?.value || '1');
  const notifPadre = document.getElementById('obs-notif-padre')?.checked || false;

  if (!alumnoId) { hubToast('⚠️ Selecciona un alumno', 'warn'); return; }
  if (!texto)    { hubToast('⚠️ Escribe la observación', 'warn'); return; }

  if (sb && currentPerfil) {
    try {
      const cct = ESCUELA_ACTIVA?.cct || currentPerfil?.escuela_cct || '';
      await sb.from('cal_observaciones_cualitativas').insert({
        alumno_id:  alumnoId,
        docente_id: currentPerfil.id,
        grupo_id:   window._grupoActivo || null,
        materia:    materia || 'General',
        trimestre:  trim,
        observacion: texto,
        ciclo: window.CICLO_ACTIVO,
        updated_at: new Date().toISOString(),
      });

      // Si es negativa → crear caso en TS automáticamente
      if (tipo === 'negativa') {
        await sb.from('casos_ts').insert({
          alumno_id:   alumnoId,
          escuela_cct: cct,
          tipo:        'academica',
          prioridad:   'media',
          estado:      'abierto',
          descripcion: `[${materia||'General'} · Trim ${trim}] ${texto}`,
          referido_por: currentPerfil.id,
          materia:      materia,
          grupo_id:     window._grupoActivo || null,
          notificado_padre: false,
          fecha_apertura: new Date().toISOString().split('T')[0],
          created_at:  new Date().toISOString(),
        });
        hubToast('⚠️ Observación guardada y enviada a Trabajo Social', 'warn');
      } else {
        hubToast('✅ Observación guardada', 'ok');
      }

      // Notificar al padre si el checkbox está marcado
      if (notifPadre) {
        try {
          const tipoLabel = tipo === 'positiva' ? '✅ Observación positiva' : tipo === 'negativa' ? '⚠️ Área de mejora' : '📋 Observación informativa';
          const docenteNom = `${currentPerfil.nombre||''} ${currentPerfil.apellido_p||''}`.trim() || 'El docente';
          await sb.from('avisos').insert({
            escuela_cct:  cct,
            titulo:       `${tipoLabel} · ${materia||'General'}`,
            cuerpo:       `${docenteNom} registró una observación sobre tu hijo/a: "${texto}"`,
            rol_destino:  'padre',
            alumno_id:    alumnoId,
            creado_por:   currentPerfil.id,
            leido:        false,
            created_at:   new Date().toISOString(),
          });
          hubToast('📬 Aviso enviado al padre/tutor', 'ok');
        } catch(eAviso) {
          console.warn('[obsGuardar] aviso padre:', eAviso.message);
        }
        // Limpiar checkbox después de usar
        const chk = document.getElementById('obs-notif-padre');
        if (chk) chk.checked = false;
      }
    } catch(e) {
      console.warn('[obsGuardar]', e.message);
      hubToast('⚠️ Guardado localmente (sin conexión)', 'warn');
    }
  } else {
    hubToast('✅ Observación guardada (modo demo)', 'ok');
  }

  document.getElementById('obs-texto').value = '';
}

async function obsCargarHistorial() {
  const alumnoId = document.getElementById('obs-hist-alumno')?.value ||
                   document.getElementById('obs-sel-alumno')?.value;
  const tipoFiltro = document.getElementById('obs-hist-tipo')?.value || '';
  const cont = document.getElementById('obs-historial-lista');
  if (!cont) return;

  if (!alumnoId) {
    cont.innerHTML = `<div style="text-align:center;padding:32px;color:var(--gris-50);font-size:13px;">Selecciona un alumno para ver su historial</div>`;
    return;
  }

  cont.innerHTML = `<div style="padding:20px;color:var(--gris-50);font-size:13px;">Cargando…</div>`;

  let data = [];
  if (sb) {
    let q = sb.from('cal_observaciones_cualitativas')
      .select('*')
      .eq('alumno_id', alumnoId)
      .order('updated_at', { ascending: false });
    const { data: rows } = await q;
    data = rows || [];
  }

  if (!data.length) {
    cont.innerHTML = `<div style="text-align:center;padding:32px;color:var(--gris-50);font-size:13px;"><div style="font-size:28px;margin-bottom:8px;">📋</div>Sin observaciones registradas</div>`;
    return;
  }

  cont.innerHTML = data.map(obs => {
    const fecha = obs.updated_at ? new Date(obs.updated_at).toLocaleDateString('es-MX') : '—';
    const esNeg = obs.observacion?.toLowerCase().includes('área') || obs.observacion?.toLowerCase().includes('dificultad');
    return `<div style="padding:14px 16px;border-bottom:1px solid var(--gris-10);display:flex;gap:12px;align-items:flex-start;">
      <div style="width:8px;height:8px;border-radius:50%;background:${esNeg?'#ef4444':'#22c55e'};margin-top:5px;flex-shrink:0;"></div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:11px;font-weight:700;color:var(--gris-80);">${obs.materia||'General'}</span>
          <span style="font-size:10px;color:var(--gris-50);">Trim ${obs.trimestre} · ${fecha}</span>
          ${esNeg?'<span style="font-size:10px;background:#fee2e2;color:#b91c1c;padding:1px 7px;border-radius:99px;font-weight:700;">→ TS</span>':'<span style="font-size:10px;background:#f0fdf4;color:#15803d;padding:1px 7px;border-radius:99px;font-weight:700;">→ Familia</span>'}
        </div>
        <div style="font-size:13px;color:var(--gris-80);">${obs.observacion}</div>
      </div>
    </div>`;
  }).join('');
}

async function obsGenerarIA() {
  const alumnoId = document.getElementById('obs-sel-alumno')?.value;
  const materia  = document.getElementById('obs-sel-materia')?.value || 'General';
  const tipo     = document.querySelector('input[name="obs-tipo"]:checked')?.value || 'positiva';
  if (!alumnoId) { hubToast('⚠️ Selecciona un alumno primero', 'warn'); return; }

  const txtEl = document.getElementById('obs-texto');
  if (txtEl) txtEl.value = '⏳ Generando sugerencia con IA…';

  try {
    const lista = window._alumnosActivos || alumnos;
    const alumno = lista.find(a => (a.id||a.n) === alumnoId);
    const nombre = alumno?.n || alumno?.nombre || 'el alumno';
    const prompt = tipo === 'positiva'
      ? `Genera una observación positiva breve (máx 2 oraciones) para un docente de primaria/secundaria sobre el alumno ${nombre} en la materia ${materia}. Tono profesional, cálido y específico. Solo la observación, sin introducción.`
      : `Genera una observación de área de mejora constructiva (máx 2 oraciones) para un docente de primaria/secundaria sobre el alumno ${nombre} en la materia ${materia}. Tono empático y orientado a soluciones. Solo la observación, sin introducción.`;

    const sugerencia = await callAI({ feature: 'portafolio_retro', prompt });
    if (txtEl && sugerencia) txtEl.value = sugerencia;
    hubToast('✅ Sugerencia generada', 'ok');
  } catch(e) {
    if (txtEl) txtEl.value = '';
    hubToast('⚠️ IA no disponible', 'warn');
  }
}

// ── XP ──────────────────────────────────────────────

function xpSelPuntos(pts, btn) {
  _xpPuntosSeleccionados = pts;
  document.querySelectorAll('.xp-pnt-btn').forEach(b => {
    b.style.background = 'white'; b.style.borderColor = 'var(--gris-20)'; b.style.color = 'var(--gris-80)';
  });
  if (btn) { btn.style.background = '#fef9c3'; btn.style.borderColor = 'var(--amarillo)'; btn.style.color = '#a16207'; }
}

async function xpOtorgar() {
  const alumnoId = document.getElementById('xp-sel-alumno')?.value;
  const motivo   = document.getElementById('xp-motivo')?.value || 'participacion';
  const nota     = document.getElementById('xp-nota')?.value.trim() || '';
  const pts      = _xpPuntosSeleccionados || 50;

  if (!alumnoId) { hubToast('⚠️ Selecciona un alumno', 'warn'); return; }

  const motivoTextos = {
    participacion: 'Participación destacada', tarea: 'Tarea excelente',
    comportamiento: 'Comportamiento ejemplar', mejora: 'Mejora notable',
    ayuda: 'Ayudó a un compañero', creatividad: 'Creatividad sobresaliente', otro: nota || 'XP otorgado'
  };

  if (sb && currentPerfil) {
    try {
      // Insertar en historial_xp
      await sb.from('historial_xp').insert({
        alumno_id:  alumnoId,
        tipo:       'docente',
        puntos:     pts,
        motivo:     nota || motivoTextos[motivo] || motivo,
        docente_id: currentPerfil.id,
        creado_en:  new Date().toISOString(),
      });
      // Actualizar xp_total en perfil_alumno
      const { data: p } = await sb.from('perfil_alumno').select('xp_total').eq('alumno_id', alumnoId).single();
      if (p) {
        await sb.from('perfil_alumno').update({ xp_total: (p.xp_total||0) + pts }).eq('alumno_id', alumnoId);
      }
      hubToast(`⭐ +${pts} XP otorgados al alumno`, 'ok');
    } catch(e) {
      console.warn('[xpOtorgar]', e.message);
      hubToast(`⭐ +${pts} XP registrados localmente`, 'ok');
    }
  } else {
    hubToast(`⭐ +${pts} XP otorgados (modo demo)`, 'ok');
  }

  document.getElementById('xp-nota').value = '';
  xpCargarRanking();
}

async function xpCargarRanking() {
  const cont = document.getElementById('xp-ranking-lista');
  if (!cont) return;
  const lista = window._alumnosActivos || alumnos;
  if (!lista.length) { cont.innerHTML = `<div style="color:var(--gris-50);font-size:13px;text-align:center;padding:16px;">Sin alumnos registrados</div>`; return; }

  let ranking = lista.map(a => ({ nombre: a.n || `${a.nombre||''} ${a.apellido_p||''}`.trim(), xp: a.xp_total || 0, id: a.id }));

  if (sb) {
    try {
      const ids = lista.map(a => a.id).filter(Boolean);
      if (ids.length) {
        const { data } = await sb.from('perfil_alumno').select('alumno_id,xp_total').in('alumno_id', ids);
        if (data) {
          data.forEach(p => {
            const idx = ranking.findIndex(r => r.id === p.alumno_id);
            if (idx >= 0) ranking[idx].xp = p.xp_total || 0;
          });
        }
      }
    } catch(e) {}
  }

  ranking.sort((a, b) => b.xp - a.xp);
  const medals = ['🥇','🥈','🥉'];
  cont.innerHTML = ranking.slice(0,10).map((r, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gris-10);">
      <span style="font-size:16px;width:24px;text-align:center;">${medals[i]||`${i+1}`}</span>
      <div style="flex:1;font-size:13px;font-weight:${i<3?'700':'500'};">${r.nombre}</div>
      <span style="font-size:12px;font-weight:700;color:#a16207;background:#fef9c3;padding:3px 10px;border-radius:99px;">⭐ ${r.xp} XP</span>
    </div>`).join('');
}

// ── ALERTA A TRABAJO SOCIAL ──────────────────────────

function obsAbrirAlertaTS() {
  obsPoblarSelects();
  const modal = document.getElementById('obs-modal-alerta-ts');
  if (modal) modal.style.display = 'flex';
}

async function alertaEnviarTS() {
  const alumnoId  = document.getElementById('alerta-sel-alumno')?.value;
  const tipo      = document.getElementById('alerta-tipo')?.value || 'academica';
  const materia   = document.getElementById('alerta-materia')?.value || '';
  const nivel     = document.getElementById('alerta-nivel')?.value || 'media';
  const desc      = document.getElementById('alerta-descripcion')?.value.trim();

  if (!alumnoId) { hubToast('⚠️ Selecciona un alumno', 'warn'); return; }
  if (!desc)     { hubToast('⚠️ Describe la situación', 'warn'); return; }

  const cct = ESCUELA_ACTIVA?.cct || currentPerfil?.escuela_cct || '';

  if (sb && currentPerfil) {
    try {
      // Insertar en alertas
      await sb.from('alertas').insert({
        alumno_id:    alumnoId,
        escuela_cct:  cct,
        tipo:         tipo,
        descripcion:  desc,
        nivel_alerta: nivel,
        materia:      materia || null,
        grupo_id:     window._grupoActivo || null,
        creado_por:   currentPerfil.id,
        vista:        false,
        resuelta:     false,
        creado_en:    new Date().toISOString(),
      });
      // También insertar en casos_ts
      await sb.from('casos_ts').insert({
        alumno_id:    alumnoId,
        escuela_cct:  cct,
        tipo:         tipo,
        prioridad:    nivel === 'alta' ? 'alta' : nivel === 'media' ? 'media' : 'baja',
        estado:       'abierto',
        descripcion:  desc,
        referido_por: currentPerfil.id,
        materia:      materia || null,
        grupo_id:     window._grupoActivo || null,
        notificado_padre: false,
        fecha_apertura: new Date().toISOString().split('T')[0],
        created_at:   new Date().toISOString(),
      });
      hubToast('🚨 Alerta enviada a Trabajo Social', 'ok');

      // ── IA analiza la alerta automáticamente ──────────────────
      try {
        const prompt = `Analiza esta alerta escolar:\nAlumno: ${alumnoId}\nTipo: ${tipo}\nNivel: ${nivel}\nMateria: ${materia||'N/A'}\nDescripción: ${desc}\n\nClasifica el riesgo (🔴 Urgente / 🟡 Seguimiento / 🟢 Preventivo), sugiere protocolo de intervención y 2 acciones inmediatas. Máximo 100 palabras.`;
        callAI({ feature: 'ts_alerta_analisis', prompt, escuela_id: cct })
          .then(analisis => {
            if (analisis) {
              sb.from('alertas').update({ analisis_ia: analisis })
                .eq('alumno_id', alumnoId).eq('resuelta', false)
                .order('creado_en', { ascending: false }).limit(1)
                .catch(() => {});
            }
          }).catch(() => {});
      } catch(_) {}
      // ─────────────────────────────────────────────────────────
    } catch(e) {
      console.warn('[alertaEnviarTS]', e.message);
      hubToast('⚠️ Guardado localmente (sin conexión)', 'warn');
    }
  } else {
    hubToast('🚨 Alerta registrada (modo demo)', 'ok');
  }

  document.getElementById('obs-modal-alerta-ts').style.display = 'none';
  document.getElementById('alerta-descripcion').value = '';
}

// Refrescar selects de obs/xp cuando el docente navega a esa sección
document.addEventListener('DOMContentLoaded', () => {
  const origDNav = window.dNav;
  if (typeof origDNav === 'function') {
    window.dNav = function(p) {
      origDNav(p);
      if (p === 'observaciones') setTimeout(obsPoblarSelects, 150);
      if (p === 'tareas') setTimeout(ctPoblarSelectorTareas, 150);
    };
  }
});

// ══════════════════════════════════════════════════════
// INCIDENCIAS DESDE EL PORTAL DOCENTE
// ══════════════════════════════════════════════════════

async function dCrearIncidencia(alumnoId, alumnoNombre) {
  const html = `<div style="padding:20px;max-width:420px">
    <h3 style="margin-bottom:16px">📋 Reportar Incidencia</h3>
    <div style="margin-bottom:12px">
      <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px">ALUMNO</label>
      <div style="padding:10px;background:#f8fafc;border-radius:10px;font-weight:600">${alumnoNombre}</div>
    </div>
    <div style="margin-bottom:12px">
      <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px">TIPO</label>
      <select id="inc-tipo" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px">
        <option value="academica">📚 Académica</option>
        <option value="conducta">⚡ Conducta</option>
        <option value="asistencia">📅 Asistencia</option>
        <option value="salud">🏥 Salud</option>
        <option value="familiar">👨‍👩‍👧 Familiar</option>
        <option value="otro">📌 Otro</option>
      </select>
    </div>
    <div style="margin-bottom:12px">
      <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px">PRIORIDAD</label>
      <select id="inc-prioridad" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px">
        <option value="baja">🟡 Baja</option>
        <option value="media">🟠 Media</option>
        <option value="alta">🔴 Alta — Requiere atención inmediata</option>
      </select>
    </div>
    <div style="margin-bottom:16px">
      <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px">DESCRIPCIÓN</label>
      <textarea id="inc-desc" rows="4" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;resize:vertical" placeholder="Describe la situación observada..."></textarea>
    </div>
    <div style="margin-bottom:12px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="inc-derivar-ts">
        <span style="font-size:13px;font-weight:600">Derivar a Trabajo Social</span>
      </label>
    </div>
    <button onclick="dGuardarIncidencia('${alumnoId}','${alumnoNombre}')" style="width:100%;padding:13px;background:linear-gradient(135deg,#15803d,#16a34a);color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer">Guardar Incidencia</button>
  </div>`;
  hubModal(html);
}
window.dCrearIncidencia = dCrearIncidencia;

async function dGuardarIncidencia(alumnoId, alumnoNombre) {
  const doc = window.currentPerfil;
  const tipo = document.getElementById('inc-tipo')?.value;
  const prioridad = document.getElementById('inc-prioridad')?.value;
  const desc = document.getElementById('inc-desc')?.value?.trim();
  const derivarTS = document.getElementById('inc-derivar-ts')?.checked;

  if (!desc) { hubToast('Escribe una descripción'); return; }

  const grupo = window._grupoActivo || window.docGrupos?.[0];
  const payload = {
    alumno_id: alumnoId,
    reportado_por: doc?.id || null,
    escuela_cct: doc?.escuela_cct || ESCUELA_ACTIVA?.cct || null,
    grupo_id: (typeof grupo === 'object' ? grupo?.grupo_id || grupo?.id : grupo) || null,
    tipo,
    prioridad,
    descripcion: desc,
    estado: 'abierta',
    derivada_ts: derivarTS
  };

  if (!sb || !doc) { hubToast('✅ Incidencia registrada (modo demo)' + (derivarTS ? ' y derivada a TS' : '')); hubModal(null); return; }

  const { error } = await sb.from('incidencias').insert(payload);
  if (error) { hubToast('❌ Error al guardar: ' + error.message); return; }

  // Si alta prioridad o derivar TS, crear alerta
  if (prioridad === 'alta' || derivarTS) {
    await sb.from('alertas').insert({
      tipo: derivarTS ? 'ts_referido' : 'incidencia_alta',
      usuario_id: alumnoId,
      escuela_cct: payload.escuela_cct,
      grupo_id: payload.grupo_id,
      descripcion: `Incidencia ${tipo} (${prioridad}): ${desc.slice(0, 120)}`,
      activa: true,
      generada_por: doc.id
    }).catch(e => console.warn('[dGuardarIncidencia alerta]', e.message));
  }

  hubModal(null);
  hubToast('✅ Incidencia registrada' + (derivarTS ? ' y derivada a TS' : ''));
}
window.dGuardarIncidencia = dGuardarIncidencia;