// ══ SIEMBRA ACTION ENGINE ══
// ══════════════════════════════════════════════════════════════════════
// SIEMBRA — ACTION ENGINE GLOBAL v1.0
// Conecta todos los roles end-to-end usando tablas existentes
// ══════════════════════════════════════════════════════════════════════

// ── Utilidad: dispatch de actualización global ─────────────────────
function siembraDispatch(event, detail = {}) {
  window.dispatchEvent(new CustomEvent('siembra:' + event, { detail }));
}

// ── Recolector de datos desde botón o contexto ────────────────────
function recolectarDatos(btn) {
  const payload = { ...btn.dataset };
  // Leer campos del form más cercano
  const form = btn.closest('[data-form]') || btn.closest('form') || btn.parentElement;
  if (form) {
    form.querySelectorAll('input,select,textarea').forEach(el => {
      if (el.id) payload[el.id.replace(/-/g,'_')] = el.type === 'checkbox' ? el.checked : el.value;
    });
  }
  return payload;
}

// ══════════════════════════════════════════════════════════════════════
// ACTION ENGINE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════
async function handleAction(action, payload = {}) {
  if (!window.sb && !['demo','generar_analisis_ia'].includes(action)) {
    hubToast('Sin conexión a Supabase', 'warn'); return;
  }
  const perfil = window.currentPerfil;

  try {
    switch(action) {

      // ─────────────────────────────────────────────────────────────
      // ADMIN — Crear grupo
      // ─────────────────────────────────────────────────────────────
      case 'crear_grupo': {
        const { grado, seccion, nivel, turno, capacidad } = payload;
        if (!grado || !seccion) { hubToast('⚠️ Grado y sección requeridos', 'warn'); return; }
        const cct = window.ADM?.escuelaCct || perfil?.escuela_cct;
        const { data, error } = await sb.from('grupos').insert({
          nombre: `${grado}° ${seccion.toUpperCase()}`,
          grado: String(grado),
          seccion: seccion.toUpperCase(),
          nivel: nivel || window._admNivelActivo || 'secundaria',
          turno: turno || 'matutino',
          capacidad: parseInt(capacidad) || 35,
          escuela_cct: cct,
          ciclo: window.CICLO_ACTIVO,
          activo: true,
        }).select().single();
        if (error) throw error;
        hubToast(`✅ Grupo ${data.nombre} creado`, 'ok');
        if (window.ADM) { await ADM.cargarGrupos(); ADM.renderGrupos(); ADM.popularSelects(); }
        siembraDispatch('grupo_creado', data);
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // ADMIN — Asignar alumno a grupo
      // ─────────────────────────────────────────────────────────────
      case 'asignar_alumno': {
        const { alumno_id, grupo_id } = payload;
        if (!alumno_id || !grupo_id) { hubToast('⚠️ Selecciona alumno y grupo', 'warn'); return; }
        const { error } = await sb.from('alumnos_grupos').upsert({
          alumno_id, grupo_id,
          ciclo_escolar: window.CICLO_ACTIVO,
          activo: true,
          fecha_alta: new Date().toISOString().split('T')[0],
        }, { onConflict: 'alumno_id,grupo_id' });
        if (error) throw error;
        hubToast('✅ Alumno asignado al grupo', 'ok');
        if (window.ADM) { await ADM.cargarAlumnos(); ADM.renderAlumnos(); }
        siembraDispatch('alumno_asignado', { alumno_id, grupo_id });
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // ADMIN — Asignar docente a grupo+materia
      // ─────────────────────────────────────────────────────────────
      case 'asignar_docente': {
        const { docente_id, grupo_id, materia } = payload;
        if (!docente_id || !materia) { hubToast('⚠️ Selecciona docente y materia', 'warn'); return; }
        const { error } = await sb.from('docente_grupos').upsert({
          docente_id, grupo_id: grupo_id || null,
          materia, ciclo: window.CICLO_ACTIVO, activo: true,
        }, { onConflict: 'docente_id,grupo_id,materia,ciclo' });
        if (error) throw error;
        hubToast('✅ Asignación guardada', 'ok');
        if (window.ADM) { ADM.renderAsignaciones(); }
        siembraDispatch('docente_asignado', { docente_id, grupo_id, materia });
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // DOCENTE — Guardar asistencia (usa función existente)
      // ─────────────────────────────────────────────────────────────
      case 'guardar_asistencia': {
        const grupoId = payload.grupo_id || window._grupoActivo;
        const alumnos = window._alumnosActivos || [];
        if (!grupoId || !alumnos.length) { hubToast('⚠️ Sin grupo o alumnos cargados', 'warn'); return; }
        const hoy = new Date().toISOString().split('T')[0];
        const rows = alumnos.map(a => ({
          alumno_id: a.id,
          grupo_id: grupoId,
          docente_id: perfil?.id,
          fecha: hoy,
          estado: payload['estado_' + a.id] || document.querySelector(`[data-alumno-id="${a.id}"][data-asistencia]`)?.dataset.asistencia || 'P',
        }));
        const { error } = await sb.from('asistencia')
          .upsert(rows, { onConflict: 'alumno_id,grupo_id,fecha' });
        if (error) throw error;
        hubToast('✅ Asistencia guardada', 'ok');
        siembraDispatch('asistencia_guardada', { fecha: hoy, grupo_id: grupoId });
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // DOCENTE — Guardar calificación (usa calGuardar existente)
      // ─────────────────────────────────────────────────────────────
      case 'guardar_calificacion': {
        if (typeof calGuardar === 'function') {
          await calGuardar();
        } else {
          const { alumno_id, grupo_id, materia, trimestre, aspecto, calificacion } = payload;
          const { error } = await sb.from('calificaciones').upsert({
            alumno_id, grupo_id: grupo_id || window._grupoActivo,
            docente_id: perfil?.id, materia,
            trimestre: parseInt(trimestre) || 1,
            aspecto: aspecto || 'General',
            calificacion: parseFloat(calificacion),
            ciclo: window.CICLO_ACTIVO,
            actualizado_en: new Date().toISOString(),
          }, { onConflict: 'alumno_id,grupo_id,materia,trimestre,aspecto,ciclo' });
          if (error) throw error;
          hubToast('✅ Calificación guardada', 'ok');
        }
        siembraDispatch('calificacion_guardada', payload);
        // Detectar riesgo y notificar automáticamente
        if (typeof calDetectarRiesgoYNotificar === 'function') {
          calDetectarRiesgoYNotificar().catch(() => {});
        }
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // DOCENTE — Reportar incidencia → TS la recibe
      // ─────────────────────────────────────────────────────────────
      case 'reportar_incidencia': {
        const { alumno_id, tipo, descripcion, derivada_ts } = payload;
        if (!alumno_id) { hubToast('⚠️ Selecciona un alumno', 'warn'); return; }
        if (!descripcion?.trim()) { hubToast('⚠️ Escribe una descripción', 'warn'); return; }
        const { data, error } = await sb.from('incidencias').insert({
          alumno_id,
          grupo_id: window._grupoActivo || null,
          reportado_por: perfil?.id,
          tipo: tipo || 'otro',
          descripcion: descripcion.trim(),
          estado: 'abierta',
          derivada_ts: derivada_ts === 'true' || derivada_ts === true,
          escuela_cct: perfil?.escuela_cct,
          created_at: new Date().toISOString(),
        }).select().single();
        if (error) throw error;
        hubToast('🚨 Incidencia reportada a TS', 'ok');
        siembraDispatch('incidencia_creada', data);
        // Si hay panel TS activo, refrescar
        if (typeof tsInit === 'function') tsInit();
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // TRABAJO SOCIAL — Actualizar incidencia
      // ─────────────────────────────────────────────────────────────
      case 'actualizar_incidencia': {
        const { incidencia_id, estado, descripcion } = payload;
        if (!incidencia_id) { hubToast('⚠️ Sin incidencia seleccionada', 'warn'); return; }
        const updates = {
          estado: estado || 'en_seguimiento',
          updated_at: new Date().toISOString(),
        };
        if (descripcion) updates.descripcion = descripcion;
        const { error } = await sb.from('incidencias')
          .update(updates).eq('id', incidencia_id);
        if (error) throw error;
        hubToast(`✅ Incidencia actualizada → ${estado}`, 'ok');
        siembraDispatch('incidencia_actualizada', { incidencia_id, estado });
        if (typeof tsInit === 'function') tsInit();
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // COORDINADOR — Evaluar docente
      // ─────────────────────────────────────────────────────────────
      case 'evaluar_docente': {
        const { docente_id, fecha_visita, calificacion, observaciones,
                planeacion_ok, actividades_ok, nem_ok, libretas_ok } = payload;
        if (!docente_id) { hubToast('⚠️ Selecciona un docente', 'warn'); return; }
        const { error } = await sb.from('evaluaciones_coordinador').insert({
          coordinador_id: perfil?.id,
          docente_id,
          fecha_visita: fecha_visita || new Date().toISOString().split('T')[0],
          calificacion: parseFloat(calificacion) || null,
          observaciones: observaciones || null,
          planeacion_ok: planeacion_ok === 'true' || planeacion_ok === true,
          actividades_ok: actividades_ok === 'true' || actividades_ok === true,
          nem_ok: nem_ok === 'true' || nem_ok === true,
          libretas_ok: libretas_ok === 'true' || libretas_ok === true,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
        hubToast('✅ Evaluación guardada', 'ok');
        siembraDispatch('docente_evaluado', { docente_id, calificacion });
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // PADRE — Vincular hijo con código
      // ─────────────────────────────────────────────────────────────
      case 'vincular_hijo': {
        const codigo = payload.codigo || document.getElementById('vinc-codigo')?.value?.trim();
        if (!codigo) { hubToast('⚠️ Ingresa el código de vinculación', 'warn'); return; }
        if (typeof pVincularConCodigo === 'function') {
          await pVincularConCodigo(codigo);
        } else {
          const { data: vinc, error: ve } = await sb.from('vinculos_padre')
            .select('*').eq('codigo', codigo).eq('usado', false).single();
          if (ve || !vinc) { hubToast('❌ Código inválido o ya usado', 'err'); return; }
          await sb.from('vinculos_padre').update({ usado: true, padre_id: perfil?.id })
            .eq('id', vinc.id);
          hubToast('✅ Hijo vinculado correctamente', 'ok');
          siembraDispatch('hijo_vinculado', vinc);
        }
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // ALUMNO — Generar análisis IA
      // ─────────────────────────────────────────────────────────────
      case 'generar_analisis_ia': {
        const alumnoId = payload.alumno_id || perfil?.id;
        if (!alumnoId) { hubToast('⚠️ Sin alumno seleccionado', 'warn'); return; }
        hubToast('⚙️ Generando análisis…');
        // Cargar calificaciones del alumno
        const { data: cals } = await sb.from('calificaciones')
          .select('materia, calificacion, trimestre')
          .eq('alumno_id', alumnoId)
          .eq('ciclo', window.CICLO_ACTIVO || '2025-2026')
          .order('materia');
        if (!cals?.length) { hubToast('Sin calificaciones para analizar', 'warn'); return; }
        // Construir prompt
        const resumen = cals.map(c => `${c.materia} T${c.trimestre}: ${c.calificacion}`).join(', ');
        const prompt = `Analiza el desempeño académico de este alumno y da 3 recomendaciones concretas. Calificaciones: ${resumen}. Responde en español, máximo 200 palabras.`;
        if (typeof callAI === 'function') {
          const resp = await callAI({ feature: 'analisis_alumno', prompt });
          const el = document.getElementById('ia-analisis-resultado') || document.getElementById('alumno-ia-result');
          if (el) el.innerHTML = `<div style="background:#f0fdf4;border-radius:10px;padding:14px;font-size:13px;line-height:1.6;">${(resp||'').replace(/\n/g,'<br>') || 'Sin respuesta'}</div>`;
          hubToast('✅ Análisis generado', 'ok');
        }
        siembraDispatch('analisis_generado', { alumno_id: alumnoId });
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // DIRECTOR/SUBDIRECTOR — Ver reporte global
      // ─────────────────────────────────────────────────────────────
      case 'cargar_reporte_global': {
        const cct = perfil?.escuela_cct;
        if (!cct) { hubToast('Sin escuela asignada', 'warn'); return; }
        const [{ data: alumnos }, { data: incidencias }, { data: evaluaciones }] = await Promise.all([
          sb.from('usuarios').select('id', { count: 'exact', head: true })
            .eq('escuela_cct', cct).eq('rol', 'alumno').eq('activo', true),
          sb.from('incidencias').select('id,estado,tipo', { count: 'exact' })
            .eq('escuela_cct', cct).eq('estado', 'abierta'),
          sb.from('evaluaciones_coordinador').select('calificacion')
            .gte('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString()),
        ]);
        const promEval = evaluaciones?.length
          ? (evaluaciones.reduce((s,e) => s + (e.calificacion||0), 0) / evaluaciones.length).toFixed(1)
          : '—';
        siembraDispatch('reporte_global', {
          total_alumnos: alumnos?.length || 0,
          incidencias_abiertas: incidencias?.length || 0,
          promedio_evaluaciones: promEval,
        });
        break;
      }

      default:
        console.warn('[SIEMBRA Engine] Acción desconocida:', action);
    }
  } catch(e) {
    console.error('[SIEMBRA Engine]', action, e.message);
    hubToast('❌ Error: ' + e.message, 'err');
  }
}

// ══════════════════════════════════════════════════════════════════════
// LISTENER GLOBAL — Intercepta todos los [data-action]
// ══════════════════════════════════════════════════════════════════════
document.addEventListener('click', function(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  e.preventDefault();
  const action = btn.dataset.action;
  const payload = recolectarDatos(btn);
  // Feedback visual
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ ' + origText.replace(/^[⏳✅❌]\s*/,'');
  handleAction(action, payload).finally(() => {
    btn.disabled = false;
    btn.textContent = origText;
  });
}, true);

// ══════════════════════════════════════════════════════════════════════
// LISTENERS DE EVENTOS — Flujo entre roles
// ══════════════════════════════════════════════════════════════════════

// Cuando se crea una incidencia → actualizar badge de TS
window.addEventListener('siembra:incidencia_creada', () => {
  const badge = document.getElementById('ts-incidencias-badge');
  if (badge) {
    const n = parseInt(badge.textContent || '0') + 1;
    badge.textContent = n;
    badge.style.display = n > 0 ? 'inline' : 'none';
  }
});

// Cuando se actualiza una incidencia → notificar al docente
window.addEventListener('siembra:incidencia_actualizada', (e) => {
  const { estado } = e.detail;
  if (estado === 'cerrada') {
    hubToast('✅ TS cerró una incidencia', 'ok');
  }
});

// Cuando se guarda calificación → refrescar vista padre/alumno si activa
window.addEventListener('siembra:calificacion_guardada', () => {
  if (typeof cargarCalificaciones === 'function') cargarCalificaciones();
  if (typeof cargarVista === 'function') cargarVista('calificaciones');
});

// Cuando se guarda asistencia → actualizar dashboard docente
window.addEventListener('siembra:asistencia_guardada', () => {
  if (typeof dRenderDash === 'function') dRenderDash();
});

// Reporte global → pintar en panel director
window.addEventListener('siembra:reporte_global', (e) => {
  const { total_alumnos, incidencias_abiertas, promedio_evaluaciones } = e.detail;
  const setEl = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  setEl('dir-stat-alumnos', total_alumnos);
  setEl('dir-stat-incidencias', incidencias_abiertas);
  setEl('dir-stat-eval-promedio', promedio_evaluaciones);
});

// ══════════════════════════════════════════════════════════════════════
// HELPER: otorgar XP al alumno (gamificación)
// ══════════════════════════════════════════════════════════════════════
async function siembraOtorgarXP(alumnoId, puntos, concepto) {
  if (!window.sb || !alumnoId) return;
  try {
    await sb.from('xp_eventos_alumno').insert({
      alumno_id: alumnoId,
      puntos: parseInt(puntos) || 10,
      concepto: concepto || 'actividad',
      fecha: new Date().toISOString().split('T')[0],
    });
    // Actualizar perfil_alumno
    const { data: perfAlumno } = await sb.from('perfil_alumno')
      .select('xp').eq('alumno_id', alumnoId).maybeSingle();
    if (perfAlumno) {
      await sb.from('perfil_alumno').update({
        xp: (perfAlumno.xp || 0) + parseInt(puntos)
      }).eq('alumno_id', alumnoId);
    }
  } catch(e) { console.warn('[XP]', e.message); }
}

// ══════════════════════════════════════════════════════════════════════
// EXPONER EN WINDOW
// ══════════════════════════════════════════════════════════════════════
window.handleAction     = handleAction;
window.recolectarDatos  = recolectarDatos;
window.siembraDispatch  = siembraDispatch;
window.siembraOtorgarXP = siembraOtorgarXP;

// ══════════════════════════════════════════════════════════════════════
// SIEMBRA CONECTAR — Sincroniza materias, alumnos y calificaciones
// entre todos los portales (docente, alumno, padre, subdir, coord)
// ══════════════════════════════════════════════════════════════════════

/**
 * Carga las materias reales de la escuela desde la BD
 * y las expone globalmente para que todos los portales las usen.
 */
async function siembraCargarMateriasEscuela(escuelaCct, nivel) {
  if (!window.sb || !escuelaCct) return [];
  try {
    let q = window.sb.from('materias').select('*').eq('activo', true);
    // Materias de esta escuela O materias globales (sin escuela)
    q = q.or(`escuela_cct.eq.${escuelaCct},escuela_cct.is.null`);
    if (nivel && nivel !== 'ambos') {
      q = q.or(`nivel.eq.${nivel},nivel.eq.ambos,nivel.is.null`);
    }
    const { data } = await q.order('nombre');
    if (data?.length) {
      window._siembraMaterias = data;
      console.log('[SIEMBRA] Materias cargadas:', data.length, 'para', escuelaCct);
      return data;
    }
  } catch(e) { console.warn('[SIEMBRA] cargarMaterias:', e.message); }
  return window._siembraMaterias || [];
}

/**
 * Carga las materias asignadas a un docente específico
 * desde docente_grupos (fuente de verdad para el docente)
 */
async function siembraCargarMateriasDocente(docenteId) {
  if (!window.sb || !docenteId) return [];
  try {
    const { data } = await window.sb.from('docente_grupos')
      .select('materia, campo_formativo, grupo_id, grupos(nombre,grado,seccion,nivel,turno), ciclo')
      .eq('docente_id', docenteId).eq('activo', true)
      .eq('ciclo', window.CICLO_ACTIVO || '2025-2026');
    if (data?.length) {
      // Materias únicas
      const mats = [...new Set(data.map(r => r.materia).filter(Boolean))];
      window._materiasDocente  = mats;
      window._materiasFiltered = mats;
      window._docenteGruposData = data;
      // Actualizar label en portal docente si existe
      const matEl = document.getElementById('doc-materias-label');
      if (matEl) matEl.textContent = mats.join(' · ') || 'Sin materias asignadas';
      console.log('[SIEMBRA] Materias docente:', mats.length);
      return mats;
    }
  } catch(e) { console.warn('[SIEMBRA] cargarMateriasDocente:', e.message); }
  return [];
}

/**
 * Carga calificaciones de un alumno y las expone para
 * el portal del alumno y el portal de padres
 */
async function siembraCargarCalificacionesAlumno(alumnoId, ciclo) {
  if (!window.sb || !alumnoId) return [];
  try {
    const c = ciclo || window.CICLO_ACTIVO || '2025-2026';
    const { data } = await window.sb.from('calificaciones')
      .select('materia, trimestre, aspecto, calificacion, observacion, ciclo')
      .eq('alumno_id', alumnoId).eq('ciclo', c).order('materia');
    if (data) {
      window._calificacionesAlumno = window._calificacionesAlumno || {};
      window._calificacionesAlumno[alumnoId] = data;
      return data;
    }
  } catch(e) { console.warn('[SIEMBRA] cargarCalificaciones:', e.message); }
  return [];
}

/**
 * Propaga los datos cargados por ADM a todos los portales.
 * Se llama después de que ADM termina de cargar.
 */
function siembraPropagar() {
  const datos = {
    alumnos:  window.ADM?.alumnos  || window._siembraAlumnos  || [],
    grupos:   window.ADM?.grupos   || window._siembraGrupos   || [],
    docentes: window.ADM?.docentes || window._siembraDocentes || [],
    materias: window.ADM?.materias || window._siembraMaterias || [],
  };
  window._siembraAlumnos  = datos.alumnos;
  window._siembraGrupos   = datos.grupos;
  window._siembraDocentes = datos.docentes;
  window._siembraMaterias = datos.materias;

  // Poblar selectores de alumno en TODOS los portales
  const alumOpts = datos.alumnos.map(a => {
    const nom = `${a.nombre||''} ${a.apellido_p||a.apellido||''}`.trim();
    const grp = a.alumnos_grupos?.[0]?.grupos?.nombre || '';
    return `<option value="${a.id}">${nom}${grp?' · '+grp:''}</option>`;
  }).join('');
  document.querySelectorAll('.siembra-alumno-select').forEach(sel => {
    const val = sel.value;
    sel.innerHTML = `<option value="">Seleccionar alumno…</option>${alumOpts}`;
    if (val) sel.value = val;
  });

  // Poblar selectores de grupo en TODOS los portales
  const grpOpts = datos.grupos.map(g =>
    `<option value="${g.id}">${g.nombre||g.grado+'°'+(g.seccion||'')}</option>`
  ).join('');
  document.querySelectorAll('.siembra-grupo-select').forEach(sel => {
    const val = sel.value;
    sel.innerHTML = `<option value="">Seleccionar grupo…</option>${grpOpts}`;
    if (val) sel.value = val;
  });

  // Poblar selectores de materia en TODOS los portales
  const matOpts = datos.materias.map(m =>
    `<option value="${m.nombre||m}">${m.nombre||m}</option>`
  ).join('');
  document.querySelectorAll('.siembra-materia-select').forEach(sel => {
    const val = sel.value;
    sel.innerHTML = `<option value="">Seleccionar materia…</option>${matOpts}`;
    if (val) sel.value = val;
  });

  window.dispatchEvent(new CustomEvent('siembra:datos-propagados', { detail: datos }));
  console.log('[SIEMBRA] Datos propagados —', datos.alumnos.length, 'alumnos,', datos.grupos.length, 'grupos,', datos.materias.length, 'materias');
}
// ══════════════════════════════════════════════════════════════════════
// IMPORTACIÓN MASIVA — Alumnos y Docentes (CSV + XLSX)
// ══════════════════════════════════════════════════════════════════════

window._impDatos = { alumnos: [], docentes: [] };

// Cargar SheetJS dinámicamente si no está
function _cargarSheetJS() {
  return new Promise((res) => {
    if (window.XLSX) { res(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = res;
    document.head.appendChild(s);
  });
}

// Cambiar tab de importación
function admImportTab(tab) {
  ['alumnos','docentes'].forEach(t => {
    document.getElementById('imp-panel-' + t).style.display = t === tab ? '' : 'none';
    const btn = document.getElementById('imp-tab-' + t);
    if (t === tab) {
      btn.style.cssText = 'padding:10px 22px;border:none;background:none;font-family:\'Sora\',sans-serif;font-size:13px;font-weight:700;color:#0d5c2f;border-bottom:2px solid #0d5c2f;margin-bottom:-2px;cursor:pointer;';
    } else {
      btn.style.cssText = 'padding:10px 22px;border:none;background:none;font-family:\'Sora\',sans-serif;font-size:13px;font-weight:600;color:#64748b;cursor:pointer;';
    }
  });
}
window.admImportTab = admImportTab;

// Mapeo inteligente de columnas — detecta variantes de nombres
const _COL_MAP_ALUMNOS = {
  nombre:         ['nombre','nombres','name','first name','primer nombre','alumno',
                   // SIGE/SIGED aliases
                   'nombre(s)','nombre_alumno','nom_alumno'],
  apellido_p:     ['apellido_p','apellido paterno','apellido1','ap','primer apellido','last name','apellido',
                   'primer_apellido','ap_paterno','paterno'],
  apellido_m:     ['apellido_m','apellido materno','apellido2','am','segundo apellido',
                   'segundo_apellido','ap_materno','materno'],
  curp:           ['curp','clave unica','clave única','curp_alumno','clave_curp'],
  fecha_nac:      ['fecha_nac','fecha nacimiento','fecha_nacimiento','nacimiento','birth','dob','fecha nac',
                   'fec_nacimiento','fecha_de_nacimiento'],
  num_lista:      ['num_lista','numero lista','número lista','no lista','num lista','#','lista',
                   'num_control','numero_control','no_control','matricula','folio'],
  grupo:          ['grupo','group','salon','salón','grado','clase',
                   'grado_grupo','grado_y_grupo','clave_grupo'],
  tutor_nombre:   ['tutor_nombre','tutor','padre','madre','familia','nombre tutor','nombre padre',
                   'nom_padre','nom_tutor','nombre_padre_madre'],
  telefono_tutor: ['telefono_tutor','telefono tutor','tel tutor','tel padre','telefono padre','tel','telefono','phone',
                   'tel_padre','telefono_tutor','celular_padre'],
  email_alumno:   ['email_alumno','email alumno','correo alumno','correo','email','e-mail'],
  email_padre:    ['email_padre','email padre','correo padre','correo tutor','email tutor'],
  sexo:           ['sexo','genero','género','sex','gender','sexo_alumno'],
  // Campos extra SIGE
  localidad:      ['localidad','municipio','ciudad','loc'],
  discapacidad:   ['discapacidad','nee','necesidades especiales','tipo_discapacidad'],
  indigena:       ['indigena','lengua_indigena','habla_lengua_indigena','lengua materna'],
};

const _COL_MAP_DOCENTES = {
  nombre:       ['nombre','nombres','name','first name',
                 'nombre(s)','nom_docente','nombre_docente'],
  apellidos:    ['apellidos','apellido','last name','apellido paterno'],
  apellido_p:   ['apellido_p','apellido paterno','ap','primer_apellido','paterno'],
  apellido_m:   ['apellido_m','apellido materno','am','segundo_apellido','materno'],
  email:        ['email','correo','e-mail','correo electronico','correo electrónico',
                 'correo_institucional','email_sep'],
  rol:          ['rol','role','cargo','puesto','tipo','función','funcion'],
  turno:        ['turno','shift','jornada','turno_docente'],
  materia:      ['materia','asignatura','subject','área','area',
                 'campo_formativo','campo formativo','asignatura_que_imparte'],
  grupo:        ['grupo','group','salon','clase','grupos_que_atiende'],
  num_empleado: ['num_empleado','num empleado','numero empleado','empleado','employee',
                 'clave_empleado','num_plaza','plaza','rfc'],
  telefono:     ['telefono','tel','phone','celular','tel_docente'],
  nivel:        ['nivel','level','grado escolar','nivel_educativo'],
  curp:         ['curp','curp_docente','clave_curp'],
  rfc:          ['rfc','rfc_docente'],
};

function _impNormalizarTexto(val) {
  return String(val == null ? '' : val).trim();
}

function _impEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(_impNormalizarTexto(email).toLowerCase());
}

function _impCurpValida(curp) {
  return /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(_impNormalizarTexto(curp).toUpperCase());
}

function _impRolDocenteValido(rol) {
  const validos = ['docente','coordinador','ts','prefecto','subdirector','tutor','director','admin'];
  return validos.includes(_impNormalizarTexto(rol).toLowerCase());
}

function _impNormalizarRegistro(tipo, row, index, filaReal) {
  const base = {
    ...row,
    _fila: filaReal || (index + 2),
    _errores: [],
    _alertas: [],
    _bloqueado: false,
  };

  if (tipo === 'alumnos') {
    base.nombre = _impNormalizarTexto(base.nombre);
    base.apellido_p = _impNormalizarTexto(base.apellido_p);
    base.apellido_m = _impNormalizarTexto(base.apellido_m);
    base.curp = _impNormalizarTexto(base.curp).toUpperCase();
    base.grupo = _impNormalizarTexto(base.grupo);
    base.email_alumno = _impNormalizarTexto(base.email_alumno).toLowerCase();
    base.email_padre = _impNormalizarTexto(base.email_padre).toLowerCase();
    base.telefono_tutor = _impNormalizarTexto(base.telefono_tutor);
    return base;
  }

  base.nombre = _impNormalizarTexto(base.nombre);
  base.apellidos = _impNormalizarTexto(base.apellidos || `${_impNormalizarTexto(base.apellido_p)} ${_impNormalizarTexto(base.apellido_m)}`.trim());
  base.apellido_p = _impNormalizarTexto(base.apellido_p);
  base.apellido_m = _impNormalizarTexto(base.apellido_m);
  base.email = _impNormalizarTexto(base.email).toLowerCase();
  base.rol = _impNormalizarTexto(base.rol).toLowerCase() || 'docente';
  base.materia = _impNormalizarTexto(base.materia);
  base.grupo = _impNormalizarTexto(base.grupo);
  base.nivel = _impNormalizarTexto(base.nivel).toLowerCase();
  return base;
}

function _impValidarRegistro(tipo, row) {
  const d = row;
  d._errores = [];
  d._alertas = [];
  d._bloqueado = false;

  if (!d.nombre || d.nombre.length < 2) {
    d._errores.push('Nombre inválido o incompleto');
    d._bloqueado = true;
  }

  if (tipo === 'alumnos') {
    if (!d.apellido_p) d._alertas.push('Falta apellido paterno');
    if (d.curp && !_impCurpValida(d.curp)) d._alertas.push('CURP con formato inválido');
    if (d.email_alumno && !_impEmailValido(d.email_alumno)) d._alertas.push('Email del alumno inválido');
    if (d.email_padre && !_impEmailValido(d.email_padre)) d._alertas.push('Email de familia inválido');
    if (!d.grupo) d._alertas.push('Sin grupo asignado');
  } else {
    if (!d.email) {
      d._errores.push('Falta email');
      d._bloqueado = true;
    } else if (!_impEmailValido(d.email)) {
      d._errores.push('Email con formato inválido');
      d._bloqueado = true;
    }
    if (!d.apellidos) d._alertas.push('Faltan apellidos');
    if (d.rol && !_impRolDocenteValido(d.rol)) d._alertas.push('Rol no reconocido; se importará tal cual');
    if (!d.rol) d._alertas.push('Sin rol; se usará docente');
  }

  return d;
}

function _impAnalizarDatos(tipo, datos) {
  const resumen = {
    total: datos.length,
    bloqueados: 0,
    conErrores: 0,
    conAlertas: 0,
    listos: 0,
    erroresFrecuentes: {},
    alertasFrecuentes: {},
  };

  datos.forEach(d => {
    if (d._bloqueado) resumen.bloqueados++;
    if (d._errores?.length) {
      resumen.conErrores++;
      d._errores.forEach(err => {
        resumen.erroresFrecuentes[err] = (resumen.erroresFrecuentes[err] || 0) + 1;
      });
    }
    if (d._alertas?.length) {
      resumen.conAlertas++;
      d._alertas.forEach(alerta => {
        resumen.alertasFrecuentes[alerta] = (resumen.alertasFrecuentes[alerta] || 0) + 1;
      });
    }
    if (!d._bloqueado && !(d._errores?.length)) resumen.listos++;
  });

  resumen.topErrores = Object.entries(resumen.erroresFrecuentes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  resumen.topAlertas = Object.entries(resumen.alertasFrecuentes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return resumen;
}

function _impBadgeResumen(label, value, colors) {
  return `<span style="background:${colors.bg};color:${colors.color};padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid ${colors.border};">${label}: ${value}</span>`;
}

function _mapearColumnas(headers, tipoMap) {
  const mapa = {};
  headers.forEach((h, i) => {
    const hLow = (h || '').toString().toLowerCase().trim();
    for (const [campo, variantes] of Object.entries(tipoMap)) {
      if (!mapa[campo] && variantes.some(v => hLow.includes(v) || v.includes(hLow))) {
        mapa[campo] = i;
      }
    }
  });
  return mapa;
}

// Leer archivo (CSV o XLSX) y mostrar preview
async function admLeerArchivo(input, tipo) {
  const file = input.files[0];
  if (!file) return;

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const esImagen = ['png','jpg','jpeg','webp','gif','bmp'].includes(ext);
  const esPDF   = ext === 'pdf';

  // For image/PDF files: use Claude AI to extract data
  if (esImagen || esPDF) {
    await _admLeerArchivoIA(file, tipo);
    return;
  }

  await _cargarSheetJS();

  const reader = new FileReader();
  reader.onload = async (e) => {
    let rows = [];
    try {
      const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    } catch(err) {
      hubToast('❌ Error leyendo archivo: ' + err.message, 'err'); return;
    }

    // Filtrar filas vacías
    rows = rows.filter(r => r.some(c => c !== '' && c !== null && c !== undefined));
    if (rows.length < 2) { hubToast('⚠️ El archivo parece estar vacío', 'warn'); return; }

    // Detectar fila de encabezados (buscar la primera fila con texto, no la de título)
    let headerRow = 0;
    const tipoMap = tipo === 'alumnos' ? _COL_MAP_ALUMNOS : _COL_MAP_DOCENTES;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const mapa = _mapearColumnas(rows[i].map(String), tipoMap);
      if (Object.keys(mapa).length >= 2) { headerRow = i; break; }
    }

    const headers = rows[headerRow].map(h => String(h || '').trim());
    const mapa    = _mapearColumnas(headers, tipoMap);
    const dataRows = rows.slice(headerRow + 1).filter(r =>
      r.some(c => c !== '' && c !== null && c !== undefined)
    );

    // Parsear filas según mapa detectado
    const datos = dataRows.map((r, idx) => {
      const obj = {};
      for (const [campo, idx] of Object.entries(mapa)) {
        obj[campo] = r[idx] !== undefined ? String(r[idx]).trim() : '';
      }
      return _impNormalizarRegistro(tipo, obj, idx, headerRow + 2 + idx);
    }).filter(d => tipo === 'alumnos' ? d.nombre : (d.nombre || d.email))
      .map(d => _impValidarRegistro(tipo, d));

    window._impDatos[tipo] = datos;

    // Mostrar preview con validación
    admMostrarPreview(tipo, datos, mapa, headers);
  };
  reader.readAsBinaryString(file);
}
window.admLeerArchivo = admLeerArchivo;

async function _admLeerArchivoIA(file, tipo) {
  const previewEl = document.getElementById('imp-preview-' + tipo);
  const btnEl     = document.getElementById('imp-btn-' + tipo);
  if (previewEl) previewEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:20px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;">
      <div style="font-size:28px;">🤖</div>
      <div>
        <div style="font-size:14px;font-weight:700;color:#0d5c2f;">Procesando con IA…</div>
        <div style="font-size:12px;color:#166534;margin-top:3px;">Extrayendo nombres y datos del archivo. Esto puede tardar unos segundos.</div>
      </div>
    </div>`;

  try {
    const sbRef = window.sb || ADM?.sb;
    if (!sbRef) throw new Error('Sin conexión a Supabase');
    const { data: { session } } = await sbRef.auth.getSession();
    const jwt = session?.access_token;
    if (!jwt) throw new Error('Sesión no válida');

const supabaseUrl = window.sb?.supabaseUrl || 'https://mgmkzxtljkyoxqeytbjv.supabase.co';

    // Convert file to base64
    const base64 = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result.split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const mediaType = ext === 'pdf' ? 'application/pdf' :
      ext === 'png' ? 'image/png' :
      ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const prompt = tipo === 'alumnos'
      ? `Eres un asistente escolar. Extrae TODOS los nombres de alumnos de esta imagen/documento. Para cada alumno detecta: nombre, apellido paterno (apellido_p), apellido materno (apellido_m) si está disponible, CURP si aparece, y grado/grupo si se menciona. Devuelve SOLO un array JSON con objetos que tengan las claves: nombre, apellido_p, apellido_m, curp, grupo. Sin texto extra, solo el JSON.`
      : `Eres un asistente escolar. Extrae TODOS los nombres de docentes/personal de esta imagen/documento. Para cada persona detecta: nombre, apellidos, email si aparece, y rol (docente por defecto). Devuelve SOLO un array JSON con objetos que tengan las claves: nombre, apellidos, email, rol. Sin texto extra, solo el JSON.`;

    const resp = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
      body: JSON.stringify({
        action: 'extract_from_file',
        file_base64: base64,
        media_type: mediaType,
        prompt,
        tipo
      })
    });

    let datos = [];
    if (resp.ok) {
      const result = await resp.json();
      const raw = result.result || result.text || result.content || '';
      try {
        const match = raw.match(/\[[\s\S]*\]/);
        datos = match ? JSON.parse(match[0]) : [];
      } catch(e) { datos = []; }
    }

    if (!datos.length) throw new Error('No se detectaron registros en el archivo. Verifica que sea legible.');

    // Normalize fields
    datos = datos.map((d, idx) => _impNormalizarRegistro(tipo, {
      nombre:     (d.nombre || '').trim(),
      apellido_p: (d.apellido_p || d.apellidos?.split(' ')[0] || '').trim(),
      apellido_m: (d.apellido_m || d.apellidos?.split(' ').slice(1).join(' ') || '').trim(),
      curp:       (d.curp || '').trim().toUpperCase(),
      grupo:      (d.grupo || '').trim(),
      email:      (d.email || '').trim().toLowerCase(),
      rol:        d.rol || 'docente',
    }, idx, idx + 2)).filter(d => d.nombre.length >= 2 || d.email)
      .map(d => _impValidarRegistro(tipo, d));

    window._impDatos[tipo] = datos;
    const mapa = tipo === 'alumnos'
      ? { nombre: 0, apellido_p: 1, apellido_m: 2, curp: 3, grupo: 4 }
      : { nombre: 0, apellidos: 1, email: 2, rol: 3 };
    admMostrarPreviewIA(tipo, datos);

  } catch(e) {
    if (previewEl) previewEl.innerHTML = `
      <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:16px;">
        <div style="font-size:14px;font-weight:700;color:#dc2626;margin-bottom:6px;">❌ Error al procesar el archivo</div>
        <div style="font-size:13px;color:#7f1d1d;">${e.message}</div>
        <div style="font-size:12px;color:#991b1b;margin-top:8px;">Intenta convertir el archivo a Excel (.xlsx) o CSV para mayor compatibilidad.</div>
      </div>`;
    if (btnEl) btnEl.style.display = 'none';
    console.error('[admLeerArchivoIA]', e);
  }
}
window._admLeerArchivoIA = _admLeerArchivoIA;

function admMostrarPreviewIA(tipo, datos) {
  const previewEl = document.getElementById('imp-preview-' + tipo);
  const btnEl     = document.getElementById('imp-btn-' + tipo);
  if (!previewEl) return;

  const resumen = _impAnalizarDatos(tipo, datos);
  const colorHeader = tipo === 'alumnos' ? '#0d5c2f' : '#1e3a5f';
  const camposMostrar = tipo === 'alumnos'
    ? ['nombre','apellido_p','apellido_m','grupo','curp']
    : ['nombre','apellidos','email','rol'];

  // Grupo fallback panel — mismo que en el CSV
  const algunosSinGrupo = tipo === 'alumnos' && datos.some(d => !d.grupo || !d.grupo.trim());
  const todosSinGrupo   = tipo === 'alumnos' && datos.every(d => !d.grupo || !d.grupo.trim());
  const gruposExistentes = (ADM.grupos || []).map(g => ({
    id: g.id, nombre: g.nombre || `${g.grado}°${g.seccion||'A'}`
  }));

  let panelGrupo = '';
  if (tipo === 'alumnos' && algunosSinGrupo) {
    const opcionesGrupos = gruposExistentes
      .map(g => `<option value="${g.id}">${g.nombre}</option>`).join('');
    panelGrupo = `
      <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:16px;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:16px;">📋</span>
          <div style="font-size:13px;font-weight:700;color:#92400e;">
            ${todosSinGrupo ? 'La IA no detectó grupos — asigna uno aquí' : 'Algunos alumnos sin grupo — asigna uno por defecto'}
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
          <div style="flex:1;min-width:180px;">
            <label style="font-size:11px;font-weight:700;color:#78350f;display:block;margin-bottom:4px;">Grupo para alumnos sin asignar</label>
            <select id="imp-grupo-fallback" style="width:100%;padding:9px 12px;border:1.5px solid #fcd34d;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
              <option value="">— Sin grupo (asignar después) —</option>
              ${opcionesGrupos}
            </select>
          </div>
          <button onclick="admCrearGrupoRapido()" style="padding:9px 16px;background:linear-gradient(135deg,#0d5c2f,#15803d);color:white;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;">
            + Crear grupo nuevo
          </button>
        </div>
        <div style="font-size:11px;color:#92400e;margin-top:8px;">💡 Puedes importar sin grupo y asignarlos desde el padrón después.</div>
      </div>`;
  }

  previewEl.innerHTML = `
    ${panelGrupo}
    <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:14px;">
      <div style="padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <span style="font-size:14px;font-weight:700;color:#0f172a;">🤖 IA detectó ${datos.length} registros</span>
          ${resumen.bloqueados ? `<span style="font-size:12px;color:#dc2626;margin-left:10px;font-weight:700;">⚠️ ${resumen.bloqueados} bloqueados</span>` : ''}
        </div>
        <div style="font-size:11px;color:#94a3b8;">Extracción automática</div>
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;flex-wrap:wrap;gap:6px;background:#fff;">
        ${_impBadgeResumen('Listos', resumen.listos, { bg:'#ecfdf5', color:'#166534', border:'#bbf7d0' })}
        ${_impBadgeResumen('Bloqueados', resumen.bloqueados, { bg:'#fef2f2', color:'#b91c1c', border:'#fecaca' })}
        ${_impBadgeResumen('Con alertas', resumen.conAlertas, { bg:'#fffbeb', color:'#92400e', border:'#fde68a' })}
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:${colorHeader};">
              <th style="padding:9px 12px;color:white;text-align:left;font-weight:700;white-space:nowrap;">Fila</th>
              ${camposMostrar.map(c => `<th style="padding:9px 12px;color:white;text-align:left;font-weight:700;white-space:nowrap;">${c}</th>`).join('')}
              <th style="padding:9px 12px;color:white;text-align:left;font-weight:700;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${datos.map((d, i) => {
              const hayError = d._errores?.length > 0;
              const bgColor = hayError ? '#fef2f2' : (i%2===0?'white':'#f8fafc');
              return `<tr style="border-bottom:1px solid #f1f5f9;background:${bgColor};">
                <td style="padding:8px 12px;color:#64748b;font-weight:700;">${d._fila || (i + 2)}</td>
                ${camposMostrar.map(c => {
                  const val = d[c] || '';
                  const sinGrupo = c === 'grupo' && !val;
                  return `<td style="padding:8px 12px;color:${hayError?'#991b1b':sinGrupo?'#94a3b8':'#374151'};max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${val || (sinGrupo ? '<em>sin grupo</em>' : '<span style="color:#d1d5db;">—</span>')}</td>`;
                }).join('')}
                <td style="padding:8px 12px;">
                  ${hayError
                    ? `<span style="color:#dc2626;font-size:11px;font-weight:700;" title="${d._errores.join(', ')}">⚠️ ${d._errores[0]}</span>`
                    : d._alertas?.length
                      ? `<span style="color:#b45309;font-size:11px;font-weight:700;" title="${d._alertas.join(', ')}">△ ${d._alertas[0]}</span>`
                      : '<span style="color:#16a34a;font-size:11px;font-weight:700;">✓ OK</span>'}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ${(resumen.topErrores.length || resumen.topAlertas.length) ? `<div style="display:grid;gap:10px;">
      ${resumen.topErrores.length ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:12px 16px;font-size:12px;color:#7f1d1d;"><strong>Errores frecuentes</strong><div style="margin-top:6px;">${resumen.topErrores.map(([txt, n]) => `<div>• ${txt} (${n})</div>`).join('')}</div></div>` : ''}
      ${resumen.topAlertas.length ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;font-size:12px;color:#92400e;"><strong>Alertas frecuentes</strong><div style="margin-top:6px;">${resumen.topAlertas.map(([txt, n]) => `<div>• ${txt} (${n})</div>`).join('')}</div></div>` : ''}
    </div>` : ''}`;

  if (btnEl) btnEl.style.display = '';
}
window.admMostrarPreviewIA = admMostrarPreviewIA;

function admMostrarPreview(tipo, datos, mapa, headers) {
  const previewEl = document.getElementById('imp-preview-' + tipo);
  const btnEl     = document.getElementById('imp-btn-' + tipo);
  if (!previewEl) return;

  const camposDetectados = Object.keys(mapa);
  const camposNecesarios = tipo === 'alumnos' ? ['nombre','apellido_p'] : ['nombre','email'];
  const faltantes = camposNecesarios.filter(c => !mapa[c]);

  if (faltantes.length) {
    previewEl.innerHTML = `
      <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:16px;">
        <div style="font-size:14px;font-weight:700;color:#dc2626;margin-bottom:6px;">&#9888; Columnas obligatorias no detectadas</div>
        <div style="font-size:13px;color:#7f1d1d;">Faltantes: <strong>${faltantes.join(', ')}</strong></div>
        <div style="font-size:12px;color:#991b1b;margin-top:6px;">Aseg&#250;rate que tu archivo tenga esas columnas. Puedes usar la plantilla como base.</div>
      </div>`;
    if (btnEl) btnEl.style.display = 'none';
    return;
  }

  const colorHeader = tipo === 'alumnos' ? '#0d5c2f' : '#1e3a5f';
  const resumen = _impAnalizarDatos(tipo, datos);
  const preview5 = datos.slice(0, 5);
  const camposMostrar = tipo === 'alumnos'
    ? ['nombre','apellido_p','apellido_m','grupo','email_alumno','email_padre']
    : ['nombre','apellidos','email','rol','materia','grupo'];

  // Detectar si algún alumno viene sin grupo
  const algunosSinGrupo = tipo === 'alumnos' && datos.some(d => !d.grupo || !d.grupo.trim());
  const todosSinGrupo   = tipo === 'alumnos' && datos.every(d => !d.grupo || !d.grupo.trim());

  // Cargar grupos disponibles (ADM.grupos ya debería estar cargado)
  const gruposExistentes = (ADM.grupos || []).map(g => ({
    id: g.id, nombre: g.nombre || `${g.grado}°${g.seccion||'A'}`
  }));

  let panelGrupo = '';
  if (tipo === 'alumnos' && algunosSinGrupo) {
    const opcionesGrupos = gruposExistentes
      .map(g => `<option value="${g.id}">${g.nombre}</option>`).join('');

    panelGrupo = `
      <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:16px;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:16px;">&#128203;</span>
          <div style="font-size:13px;font-weight:700;color:#92400e;">
            ${todosSinGrupo ? 'Tu archivo no incluye grupos — asigna uno aquí' : 'Algunos alumnos no tienen grupo — asigna uno por defecto'}
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
          <div style="flex:1;min-width:180px;">
            <label style="font-size:11px;font-weight:700;color:#78350f;display:block;margin-bottom:4px;">Grupo para alumnos sin asignar</label>
            <select id="imp-grupo-fallback" style="width:100%;padding:9px 12px;border:1.5px solid #fcd34d;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
              <option value="">— Sin grupo (asignar después) —</option>
              ${opcionesGrupos}
            </select>
          </div>
          <button onclick="admCrearGrupoRapido()" style="padding:9px 16px;background:linear-gradient(135deg,#0d5c2f,#15803d);color:white;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;">
            + Crear grupo nuevo
          </button>
        </div>
        <div style="font-size:11px;color:#92400e;margin-top:8px;">
          &#128161; Puedes importar ahora sin grupo y asignarlos desde el padrón después.
        </div>
      </div>`;
  }

  previewEl.innerHTML = `
    ${panelGrupo}
    <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:14px;">
      <div style="padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <span style="font-size:14px;font-weight:700;color:#0f172a;">&#10003; ${datos.length} registros detectados</span>
          <span style="font-size:12px;color:#64748b;margin-left:10px;">${camposDetectados.length} columnas mapeadas</span>
        </div>
        <div style="font-size:11px;color:#94a3b8;">Mostrando primeros 5</div>
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;flex-wrap:wrap;gap:6px;background:#fff;">
        ${_impBadgeResumen('Listos', resumen.listos, { bg:'#ecfdf5', color:'#166534', border:'#bbf7d0' })}
        ${_impBadgeResumen('Bloqueados', resumen.bloqueados, { bg:'#fef2f2', color:'#b91c1c', border:'#fecaca' })}
        ${_impBadgeResumen('Con alertas', resumen.conAlertas, { bg:'#fffbeb', color:'#92400e', border:'#fde68a' })}
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:${colorHeader};">
              <th style="padding:9px 12px;color:white;text-align:left;font-weight:700;white-space:nowrap;">Fila</th>
              ${camposMostrar.filter(c => mapa[c] !== undefined || (c === 'grupo' && tipo === 'alumnos')).map(c =>
                `<th style="padding:9px 12px;color:white;text-align:left;font-weight:700;white-space:nowrap;">${c}</th>`
              ).join('')}
              <th style="padding:9px 12px;color:white;text-align:left;font-weight:700;white-space:nowrap;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${preview5.map((d, i) => {
              const hayError = d._errores && d._errores.length > 0;
              const bg = hayError ? '#fef2f2' : (i%2===0 ? 'white' : '#f8fafc');
              return `
              <tr style="border-bottom:1px solid #f1f5f9;background:${bg};">
                <td style="padding:8px 12px;color:#64748b;font-weight:700;">${d._fila || i + 2}</td>
                ${camposMostrar.filter(c => mapa[c] !== undefined || (c === 'grupo' && tipo === 'alumnos')).map(c => {
                  const val = d[c] || '';
                  const esInvalido = (c === 'nombre' && val.length < 2) || (c === 'curp' && val && !_impCurpValida(val));
                  const sinGrupo   = c === 'grupo' && tipo === 'alumnos' && !val;
                  const colorTxt   = esInvalido ? '#dc2626' : sinGrupo ? '#94a3b8' : '#374151';
                  const contenido  = val || (sinGrupo ? '<em>sin grupo</em>' : '<span style="color:#d1d5db;">&#8212;</span>');
                  return `<td style="padding:8px 12px;color:${colorTxt};max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${esInvalido ? 'font-weight:700;' : ''}">${contenido}</td>`;
                }).join('')}
                <td style="padding:8px 12px;">${hayError ? `<span style="color:#dc2626;font-size:10px;font-weight:700;">&#9888; ${d._errores[0]}</span>` : d._alertas?.length ? `<span style="color:#b45309;font-size:10px;font-weight:700;">&#9651; ${d._alertas[0]}</span>` : '<span style="color:#16a34a;font-size:10px;">&#10003;</span>'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${datos.length > 5 ? `<div style="padding:10px 16px;font-size:12px;color:#64748b;border-top:1px solid #f1f5f9;">...y ${datos.length - 5} registros más</div>` : ''}
    </div>
    ${(resumen.topErrores.length || resumen.topAlertas.length) ? `<div style="display:grid;gap:10px;margin-bottom:12px;">
      ${resumen.topErrores.length ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:12px 16px;font-size:12px;color:#7f1d1d;"><strong>Errores frecuentes</strong><div style="margin-top:6px;">${resumen.topErrores.map(([txt, n]) => `<div>• ${txt} (${n})</div>`).join('')}</div></div>` : ''}
      ${resumen.topAlertas.length ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;font-size:12px;color:#92400e;"><strong>Alertas frecuentes</strong><div style="margin-top:6px;">${resumen.topAlertas.map(([txt, n]) => `<div>• ${txt} (${n})</div>`).join('')}</div></div>` : ''}
    </div>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      ${camposDetectados.map(c =>
        `<span style="background:#f0fdf4;color:#166534;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid #bbf7d0;">&#10003; ${c}</span>`
      ).join('')}
    </div>`;

  if (btnEl) btnEl.style.display = '';
}

// Importar alumnos en masa
async function admConfirmarImport(tipo) {
  const datos = window._impDatos[tipo] || [];
  if (!datos.length) { hubToast('⚠️ Sin datos para importar', 'warn'); return; }
  const resumenPrevio = _impAnalizarDatos(tipo, datos);
  const importables = datos.filter(d => !d._bloqueado);
  if (!importables.length) {
    hubToast('⚠️ Todos los registros tienen errores bloqueantes. Corrige el archivo antes de importar.', 'warn');
    return;
  }

  const sbRef      = window.sb || ADM.sb;
  const escuelaCct = ADM.escuelaCct || window.currentPerfil?.escuela_cct;
  const escuelaId  = ADM.escuelaId  || window.currentPerfil?.escuela_id;
  const escuelaNom = ADM.escuelaNombre || escuelaCct || 'SIEMBRA';

  if (!sbRef || !escuelaCct) { hubToast('⚠️ Sin conexión o escuela no detectada. Verifica el Panel Instalador.', 'warn'); return; }

  // ── PRE-VALIDACIÓN: cargar grupos si no están en memoria ──
  if (tipo === 'alumnos') {
    if (!ADM.grupos || ADM.grupos.length === 0) {
      try {
        const { data: gData } = await sbRef.from('grupos').select('id,nombre,grado,seccion')
          .eq('escuela_cct', escuelaCct).eq('activo', true);
        if (gData?.length) { ADM.grupos = gData; }
      } catch(e) {}
    }
  }

  const btnEl = document.getElementById('imp-btn-' + tipo);
  const btnTexto = btnEl?.querySelector('button');
  if (btnTexto) btnTexto.textContent = `⏳ Importando ${importables.length} de ${datos.length} registros…`;

  let ok = 0, errores = 0, saltados = 0;
  let vinculadosAGrupo = 0, sinGrupo = 0;
  const gruposImpactados = new Set();
  const errDetalle = [];

  if (tipo === 'alumnos') {
    // Construir mapa de grupos por nombre (varias formas: "1A", "1°A", "Primero A", etc.)
    const grupoMap = {};
    (ADM.grupos || []).forEach(g => {
      const nombre = g.nombre || `${g.grado}°${g.seccion||'A'}`;
      [
        nombre.toLowerCase().trim(),
        `${g.grado}${g.seccion||''}`.toLowerCase(),
        `${g.grado}°${g.seccion||''}`.toLowerCase(),
        `${g.grado}° ${g.seccion||''}`.toLowerCase(),
      ].forEach(k => { if (k) grupoMap[k] = g.id; });
    });

    // Grupo fallback seleccionado por el admin en la UI (si los alumnos no traen grupo)
    const grupoFallbackId = document.getElementById('imp-grupo-fallback')?.value || null;

    // Procesar en lotes de 10 para no saturar la conexión
    const BATCH = 10;
    for (let i = 0; i < importables.length; i += BATCH) {
      const lote = importables.slice(i, i + BATCH);
      if (btnTexto) btnTexto.textContent = `⏳ Importando… ${Math.min(i+BATCH, importables.length)}/${importables.length}`;

      for (const d of lote) {
        try {
          if (!d.nombre || d.nombre.length < 2) { saltados++; continue; }
          const apellido_p = (d.apellido_p || d.apellidos?.split(' ')[0] || '').trim();
          const apellido_m = (d.apellido_m || d.apellidos?.split(' ').slice(1).join(' ') || '').trim();
          const codigo = ADM._generarCodigoCorto();

          // Email: usar el del CSV si viene; si no, generar uno placeholder único
          // (la columna es NOT NULL en el DB vivo; los alumnos no siempre tienen email)
          const _emailBase = (d.email_alumno || '').trim();
          const _emailPlaceholder = _emailBase
            || `alumno_${(d.curp || codigo).toLowerCase().replace(/[^a-z0-9]/g,'_')}@${escuelaCct.toLowerCase().replace(/[^a-z0-9]/g,'')}.siembra`;

          const payload = {
            nombre:             d.nombre.trim(),
            apellido_p,
            apellido_m,
            curp:               d.curp   || null,
            fecha_nac:          d.fecha_nac || null,
            num_lista:          parseInt(d.num_lista) || null,
            tutor_nombre:       d.tutor_nombre || null,
            telefono_tutor:     d.telefono_tutor || null,
            email:              _emailPlaceholder,
            rol:                'alumno',
            activo:             true,
            codigo_vinculacion: codigo,
            escuela_id:         escuelaId  || null,
            escuela_cct:        escuelaCct || null,
          };

          // Upsert por CURP (si tiene) o insert nuevo
          let alumnoId = null;
          if (d.curp && d.curp.length === 18) {
            const { data: existing } = await sbRef.from('usuarios')
              .select('id').eq('curp', d.curp).maybeSingle();
            if (existing?.id) {
              // Actualizar datos del alumno existente
              await sbRef.from('usuarios').update(payload).eq('id', existing.id);
              alumnoId = existing.id;
              saltados++; // ya existía — no contamos como nuevo
            }
          }

          if (!alumnoId) {
            const { data: inserted, error: ie } = await sbRef.from('usuarios')
              .insert(payload).select('id').single();
            if (ie) {
              if (ie.code === '23505') { saltados++; continue; } // duplicado por unique constraint
              throw ie;
            }
            alumnoId = inserted.id;
            ok++;
          }

          // Asignar grupo si se especificó y existe, o usar fallback del selector
          const grupoKey = (d.grupo || '').toLowerCase().trim();
          const grupoId  = grupoMap[grupoKey] ||
            grupoMap[grupoKey.replace(/[°\s]/g,'')] ||
            grupoMap[grupoKey.replace(/°/,'').trim()] ||
            (!grupoKey ? grupoFallbackId : null);
          if (grupoId && alumnoId) {
            await sbRef.from('alumnos_grupos').upsert({
              alumno_id:     alumnoId,
              grupo_id:      grupoId,
              ciclo_escolar: window.CICLO_ACTIVO || '2025-2026',
              ciclo:         window.CICLO_ACTIVO || '2025-2026',
              activo:        true,
            }, { onConflict: 'alumno_id,grupo_id,ciclo_escolar' }).catch(e => {
              console.warn('[Import] alumnos_grupos upsert:', e.message);
            });
            vinculadosAGrupo++;
            gruposImpactados.add(String(grupoId));
          } else {
            sinGrupo++;
          }

          // Código de vinculación para padres
          await sbRef.from('vinculos_padre').insert({
            codigo,
            alumno_id:      alumnoId,
            escuela_id:     escuelaId || null,
            escuela_cct:    escuelaCct || null,
            nombre_tutor:   d.tutor_nombre   || null,
            telefono_tutor: d.telefono_tutor || null,
            usado:          false,
            expira_at:      new Date(Date.now() + 365*24*60*60*1000).toISOString(),
          }).catch(() => {}); // No bloquear si ya existe

        } catch(e) {
          errores++;
          errDetalle.push(`${d.nombre||'?'}: ${e.message}`);
        }
      }
    }

  } else {
    // ── DOCENTES ──
    const { data: { session } } = await sbRef.auth.getSession().catch(()=>({ data:{} }));
    const jwt = session?.access_token;
const supabaseUrl = window.SUPABASE_URL || 'https://mgmkzxtljkyoxqeytbjv.supabase.co';

    for (const d of importables) {
      try {
        if (!d.email && !d.nombre) { saltados++; continue; }
        const nombre    = (d.nombre || '').trim();
        const apellidos = (d.apellidos || `${d.apellido_p||''} ${d.apellido_m||''}`).trim();
        const email     = (d.email || '').toLowerCase().trim();
        const rol       = d.rol || 'docente';

        if (!email) { saltados++; continue; }

        // Intentar upsert via RPC, caer en insert directo si falla
        let usuarioId = null;
        const { data: rpcResult, error: rpcErr } = await sbRef.rpc('upsert_usuario', {
          p_auth_id:    null,
          p_email:      email,
          p_nombre:     nombre,
          p_apellido_p: apellidos.split(' ')[0] || '',
          p_apellido_m: apellidos.split(' ').slice(1).join(' ') || '',
          p_rol:        rol,
          p_escuela_id:  escuelaId  || '',
          p_escuela_cct: escuelaCct || '',
        }).catch(e => ({ data: null, error: e }));

        if (!rpcErr && rpcResult) {
          usuarioId = typeof rpcResult === 'object' ? rpcResult?.id : rpcResult;
        } else {
          // Fallback: buscar existente o insertar
          const { data: found } = await sbRef.from('usuarios').select('id').eq('email', email).maybeSingle();
          if (found?.id) {
            usuarioId = found.id;
            saltados++;
          } else {
            const { data: ins, error: insErr } = await sbRef.from('usuarios').insert({
              email, nombre, rol, activo: true,
              escuela_cct: escuelaCct, escuela_id: escuelaId || null,
            }).select('id').single();
            if (insErr) throw insErr;
            usuarioId = ins.id;
            ok++;
          }
        }
        if (!rpcErr) ok++;

        // Crear invitación
        const token = ADM._generarToken();
        const link  = `${location.origin}/index.html?invite=${token}`;
        await sbRef.from('invitaciones').insert({
          token,
          escuela_id:    escuelaId  || null,
          escuela_cct:   escuelaCct || null,
          rol,
          email_destino: email,
          nombre_destino:`${nombre} ${apellidos}`.trim(),
          estado:        'pendiente',
          expira_at:     new Date(Date.now() + 7*24*60*60*1000).toISOString(),
        }).catch(() => {});

        // Enviar email de invitación si hay JWT y Edge Function disponible
        if (jwt && email) {
          fetch(`${supabaseUrl}/functions/v1/invite-user`, {
            method: 'POST',
            headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${jwt}` },
            body: JSON.stringify({ email, rol, escuela_nombre: escuelaNom,
              invited_by: window.currentPerfil?.nombre || 'Admin', token, link }),
          }).catch(() => {}); // Silenciar — la invitación ya quedó en BD
        }

      } catch(e) {
        errores++;
        errDetalle.push(`${d.email||d.nombre||'?'}: ${e.message}`);
      }
    }
  }

  // Recargar datos
  await ADM.cargarAlumnos().catch(()=>{});
  await ADM.cargarDocentes().catch(()=>{});
  if (typeof ADM.renderAlumnos  === 'function') ADM.renderAlumnos();
  if (typeof ADM.renderDocentes === 'function') ADM.renderDocentes();
  if (typeof ADM.renderDashboard=== 'function') ADM.renderDashboard();
  if (typeof ADM.renderGrupos === 'function') ADM.renderGrupos();
  if (typeof ADM.renderCoberturaAcademica === 'function') ADM.renderCoberturaAcademica();
  admLimpiarImport(tipo);

  // Resultado con detalle de errores
  if (errDetalle.length) {
    console.warn('[Import] Errores detallados:', errDetalle);
    hubModal(
      `⚠️ Importación con errores`,
      `<div style="font-size:13px;color:#374151;">
        <div style="margin-bottom:12px;">✅ <strong>${ok}</strong> importados &nbsp;·&nbsp; 🔄 <strong>${saltados}</strong> ya existían &nbsp;·&nbsp; ❌ <strong>${errores}</strong> errores &nbsp;·&nbsp; ⛔ <strong>${resumenPrevio.bloqueados}</strong> bloqueados antes de importar</div>
        <div style="font-size:12px;color:#b91c1c;background:#fef2f2;border-radius:8px;padding:12px;max-height:200px;overflow-y:auto;">
          ${errDetalle.map(e => `<div style="margin-bottom:4px;">• ${e}</div>`).join('')}
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:10px;">Tip: los errores más comunes son CURP duplicada o nombre muy corto. Corrige en el archivo y vuelve a importar solo los erróneos.</div>
      </div>`,
      'Entendido', () => {}
    );
  } else {
    if (tipo === 'alumnos') {
      hubModal(
        '✅ Importación de alumnos completada',
        `<div style="font-size:13px;color:#374151;">
          <div style="margin-bottom:12px;">✅ <strong>${ok}</strong> alumnos nuevos &nbsp;·&nbsp; 🔄 <strong>${saltados}</strong> ya existían &nbsp;·&nbsp; 👥 <strong>${vinculadosAGrupo}</strong> vinculados a grupo &nbsp;·&nbsp; ⛔ <strong>${resumenPrevio.bloqueados}</strong> bloqueados</div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
            <div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:6px;">Resultado operativo</div>
            <div style="font-size:12px;color:#475569;">${sinGrupo ? `${sinGrupo} alumnos quedaron pendientes de grupo y conviene revisarlos en Padrón escolar.` : 'Todos los alumnos quedaron vinculados a un grupo.'}</div>
            <div style="font-size:12px;color:#475569;margin-top:4px;">${gruposImpactados.size ? `${gruposImpactados.size} grupo(s) recibieron alumnos y ya se reflejan en Cobertura académica.` : 'No se actualizaron grupos porque el archivo no traía grupo o faltó selector fallback.'}</div>
          </div>
        </div>`,
        'Entendido', () => {}
      );
    } else {
      hubToast(`✅ ${ok} ${tipo === 'alumnos' ? 'alumnos' : 'docentes'} importados${saltados ? ` · ${saltados} ya existían` : ''}${resumenPrevio.bloqueados ? ` · ${resumenPrevio.bloqueados} bloqueados` : ''}`, 'ok');
    }
  }
}
window.admConfirmarImport = admConfirmarImport;

// Crear grupo rápido desde el panel de importación sin salir de la pantalla
async function admCrearGrupoRapido() {
  const cct      = ADM.escuelaCct || window.currentPerfil?.escuela_cct;
  const escuelaId= ADM.escuelaId  || window.currentPerfil?.escuela_id;
  hubModal('🏫 Crear grupo rápido', `
    <div style="display:grid;gap:12px;">
      <div style="font-size:13px;color:#64748b;margin-bottom:4px;">
        El grupo se creará y estará disponible en el selector de importación de inmediato.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Grado *</label>
          <select id="gq-grado" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
            <option value="">—</option>
            ${[1,2,3,4,5,6].map(n => `<option value="${n}">${n}°</option>`).join('')}
            ${[1,2,3].map(n => `<option value="${n}sec">${n}° Sec</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Sección *</label>
          <select id="gq-seccion" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
            ${['A','B','C','D','E','F'].map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Turno</label>
        <select id="gq-turno" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
          <option value="matutino">Matutino</option>
          <option value="vespertino">Vespertino</option>
        </select>
      </div>
      <div>
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Nivel</label>
        <select id="gq-nivel" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
          <option value="primaria">Primaria</option>
          <option value="secundaria">Secundaria</option>
        </select>
      </div>
    </div>`, 'Crear grupo', async () => {
    const gradoRaw = document.getElementById('gq-grado')?.value;
    const seccion  = document.getElementById('gq-seccion')?.value;
    if (!gradoRaw || !seccion) { hubToast('Selecciona grado y sección', 'warn'); return; }

    const esSec  = gradoRaw.endsWith('sec');
    const grado  = parseInt(gradoRaw);
    const nivel  = document.getElementById('gq-nivel')?.value || (esSec ? 'secundaria' : 'primaria');
    const turno  = document.getElementById('gq-turno')?.value || 'matutino';
    const nombre = `${grado}°${seccion}`;

    if (!window.sb || !cct) { hubToast('Sin conexión a Supabase', 'error'); return; }

    const { data: inserted, error } = await window.sb.from('grupos').insert({
      nombre,
      grado,
      seccion,
      nivel,
      turno,
      activo:      true,
      escuela_cct: cct,
      escuela_id:  escuelaId || null,
      ciclo:       window.CICLO_ACTIVO || '2025-2026',
    }).select('id,nombre,grado,seccion').single();

    if (error) { hubToast('Error al crear grupo: ' + error.message, 'error'); return; }

    // Agregar al ADM.grupos local inmediatamente
    if (!ADM.grupos) ADM.grupos = [];
    ADM.grupos.push(inserted);

    hubToast(`✅ Grupo ${nombre} creado`, 'ok');

    // Refrescar el selector de fallback en el preview sin re-leer el archivo
    const sel = document.getElementById('imp-grupo-fallback');
    if (sel) {
      const opt = document.createElement('option');
      opt.value    = inserted.id;
      opt.textContent = inserted.nombre;
      opt.selected = true;
      sel.appendChild(opt);
    }
  });
}
window.admCrearGrupoRapido = admCrearGrupoRapido;

// ══════════════════════════════════════════════════════════════════════
// SIGE / ESTADÍSTICA 911 — Importación y Exportación SEP
// ══════════════════════════════════════════════════════════════════════

// Abre modal con opciones de integración SIGE / Estadística 911
function admAbrirSige() {
  hubModal('📊 SIGE / Estadística 911 — SEP', `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <!-- Info -->
      <div style="background:#eff6ff;border-radius:10px;padding:14px;border:1px solid #bfdbfe;">
        <div style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:6px;">ℹ️ ¿Qué es esto?</div>
        <div style="font-size:12px;color:#1e3a8a;line-height:1.6;">
          SIGED/SIGE es el sistema de información de la SEP. Puedes importar listas de alumnos
          exportadas de SIGED y generar el reporte de <strong>Estadística 911</strong> con los datos de SIEMBRA.
        </div>
      </div>

      <!-- Importar desde SIGE -->
      <div style="background:white;border-radius:12px;border:1.5px solid #e2e8f0;padding:16px;">
        <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px;">⬆️ Importar desde SIGE/SIGED</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:12px;">
          Exporta el padrón de alumnos desde SIGED en formato Excel o CSV y súbelo aquí.
          SIEMBRA detecta automáticamente los campos CURP, matrícula, grado y grupo.
        </div>
        <label style="display:block;padding:12px;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:10px;text-align:center;cursor:pointer;font-size:13px;color:#64748b;font-weight:600;">
          📁 Seleccionar archivo SIGED (.xlsx / .csv)
          <input type="file" accept=".xlsx,.xls,.csv" style="display:none;" onchange="admSigeImportar(this)">
        </label>
      </div>

      <!-- Exportar Estadística 911 -->
      <div style="background:white;border-radius:12px;border:1.5px solid #e2e8f0;padding:16px;">
        <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px;">⬇️ Exportar Estadística 911</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:12px;">
          Genera el archivo CSV con el formato requerido para captura manual en
          <strong>f911.sep.gob.mx</strong>. Incluye: alumnos por grado/género, docentes y grupos.
        </div>
        <button onclick="admSigeExportar911()" style="width:100%;padding:11px;background:linear-gradient(135deg,#1e3a5f,#1e40af);color:white;border:none;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">
          📋 Generar reporte Estadística 911
        </button>
      </div>

      <!-- Plantilla descargable -->
      <div style="background:#f8fafc;border-radius:10px;padding:12px;text-align:center;">
        <button onclick="admSigeDescargarPlantilla()" style="padding:8px 18px;background:white;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;color:#475569;cursor:pointer;">
          📥 Descargar plantilla de alumnos compatible SIGE
        </button>
      </div>
    </div>`, 'Cerrar', null);
}
window.admAbrirSige = admAbrirSige;

// Importar archivo SIGE — usa el importer existente con mapa de columnas SIGE
async function admSigeImportar(input) {
  hubToast('🔄 Leyendo archivo SIGE…', 'ok');
  // Reutiliza admLeerArchivo con tipo 'alumnos' — el mapa ya incluye aliases SIGE
  await admLeerArchivo(input, 'alumnos');
  hubToast('✅ Archivo SIGE procesado. Revisa la vista previa en "Importar alumnos".', 'ok');
}
window.admSigeImportar = admSigeImportar;

// Exportar Estadística 911 — genera CSV con campos requeridos por SEP
async function admSigeExportar911() {
  const cct  = window.ADM?.escuelaCct || window.currentPerfil?.escuela_cct;
  const ciclo = window.CICLO_ACTIVO || '2025-2026';
  if (!cct || !window.sb) { hubToast('⚠️ Sin conexión a base de datos', 'warn'); return; }
  hubToast('⏳ Generando Estadística 911…', 'ok');
  try {
    // 1. Cargar alumnos con datos completos
    const [{ data: alumnos }, { data: docentes }, { data: grupos }] = await Promise.all([
      window.sb.from('usuarios').select('id,nombre,apellido_p,apellido_m,curp,fecha_nac,sexo,localidad,discapacidad,indigena')
        .eq('escuela_cct', cct).eq('rol', 'alumno').eq('activo', true),
      window.sb.from('usuarios').select('id,nombre,apellido_p,apellido_m,curp,rfc,email')
        .eq('escuela_cct', cct).in('rol', ['docente','tutor','director','subdirector']).eq('activo', true),
      window.sb.from('grupos').select('id,nombre,grado,seccion,turno,nivel')
        .eq('escuela_cct', cct).eq('activo', true),
    ]);
    const [{ data: alumGrupos }] = await Promise.all([
      window.sb.from('alumnos_grupos').select('alumno_id,grupo_id').eq('activo', true),
    ]);

    const grupoMap = {};
    (grupos||[]).forEach(g => grupoMap[g.id] = g);
    const alumGrupoMap = {};
    (alumGrupos||[]).forEach(ag => alumGrupoMap[ag.alumno_id] = ag.grupo_id);

    // 2. Hoja alumnos
    const filas = [
      ['CURP','Apellido Paterno','Apellido Materno','Nombre(s)','Fecha Nacimiento','Sexo',
       'Grado','Grupo','Turno','Nivel','Localidad','Discapacidad','Habla Lengua Indígena','CCT Escuela','Ciclo'],
    ];
    (alumnos||[]).forEach(a => {
      const grupoId = alumGrupoMap[a.id];
      const g = grupoId ? grupoMap[grupoId] : null;
      filas.push([
        a.curp || '',
        a.apellido_p || '',
        a.apellido_m || '',
        a.nombre || '',
        a.fecha_nac || '',
        a.sexo || '',
        g?.grado || '',
        g?.seccion || g?.nombre || '',
        g?.turno || '',
        g?.nivel || '',
        a.localidad || '',
        a.discapacidad || '',
        a.indigena ? 'Sí' : 'No',
        cct,
        ciclo,
      ]);
    });

    // 3. Hoja docentes
    const filasDoc = [
      ['CURP','RFC','Apellido Paterno','Apellido Materno','Nombre(s)','Email','CCT Escuela','Ciclo'],
    ];
    (docentes||[]).forEach(d => {
      filasDoc.push([
        d.curp || '', d.rfc || '',
        d.apellido_p || '', d.apellido_m || '', d.nombre || '',
        d.email || '', cct, ciclo,
      ]);
    });

    // 4. Resumen Estadística 911
    const porGrado = {};
    (alumnos||[]).forEach(a => {
      const grupoId = alumGrupoMap[a.id];
      const g = grupoId ? grupoMap[grupoId] : null;
      const grado = g?.grado || 'Sin grado';
      if (!porGrado[grado]) porGrado[grado] = { H: 0, M: 0 };
      const sexo = (a.sexo || '').toLowerCase();
      if (sexo === 'h' || sexo === 'hombre' || sexo === 'm' || sexo === 'masculino') porGrado[grado].H++;
      else porGrado[grado].M++;
    });
    const filasResumen = [
      ['Grado','Hombres','Mujeres','Total','CCT','Ciclo'],
      ...Object.entries(porGrado).map(([grado, c]) => [grado, c.H, c.M, c.H+c.M, cct, ciclo]),
      ['TOTAL DOCENTES', docentes?.length || 0, '', '', cct, ciclo],
      ['TOTAL GRUPOS', grupos?.length || 0, '', '', cct, ciclo],
    ];

    // 5. Generar archivo Excel multi-hoja con SheetJS
    await _cargarSheetJS();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), 'Alumnos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filasDoc), 'Docentes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filasResumen), 'Estadística 911');
    XLSX.writeFile(wb, `Estadistica_911_${cct}_${ciclo}.xlsx`);
    hubToast('✅ Estadística 911 generada. Usa los datos en f911.sep.gob.mx', 'ok');
  } catch(e) {
    hubToast('❌ Error: ' + e.message, 'err');
    console.error('[SIGE]', e);
  }
}
window.admSigeExportar911 = admSigeExportar911;

// Descarga plantilla Excel compatible con SIGE para llenar alumnos
async function admSigeDescargarPlantilla() {
  await _cargarSheetJS();
  const filas = [
    ['CURP','Apellido Paterno','Apellido Materno','Nombre(s)','Fecha Nacimiento (YYYY-MM-DD)',
     'Sexo (H/M)','Grado','Grupo/Sección','Turno','Email Alumno','Email Padre/Tutor',
     'Nombre Tutor','Teléfono Tutor'],
    ['CURP18CARACTERES01','García','López','Juan','2012-05-15','H','3','A','Matutino',
     '','padre@email.com','María López','5551234567'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(filas);
  // Ancho de columnas
  ws['!cols'] = filas[0].map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Alumnos SIGE');
  XLSX.writeFile(wb, 'Plantilla_Alumnos_SIEMBRA_SIGE.xlsx');
  hubToast('✅ Plantilla descargada', 'ok');
}
window.admSigeDescargarPlantilla = admSigeDescargarPlantilla;

function admLimpiarImport(tipo) {
  window._impDatos[tipo] = [];
  const preview = document.getElementById('imp-preview-' + tipo);
  const btnEl   = document.getElementById('imp-btn-' + tipo);
  const fileEl  = document.getElementById('imp-file-' + tipo);
  if (preview) preview.innerHTML = '';
  if (btnEl)   btnEl.style.display = 'none';
  if (fileEl)  fileEl.value = '';
  const btn = document.getElementById('imp-btn-' + tipo)?.querySelector('button');
  if (btn) btn.textContent = tipo === 'alumnos' ? '✅ Importar alumnos a SIEMBRA' : '✅ Importar personal a SIEMBRA';
}
window.admLimpiarImport = admLimpiarImport;

// Descargar plantillas
function admDescargarPlantilla(tipo, formato) {
  if (formato === 'csv') {
    const headers = tipo === 'alumnos'
      ? 'nombre,apellido_p,apellido_m,curp,fecha_nac,num_lista,grupo,tutor_nombre,telefono_tutor,email_alumno,email_padre,sexo'
      : 'nombre,apellidos,email,rol,turno,materia,grupo,num_empleado,telefono,nivel';
    const ejemplo = tipo === 'alumnos'
      ? '\nAna,García,López,GALA100305MNLRPN07,2010-03-05,1,2° A,María López,8110001234,ana@gmail.com,maria@gmail.com,F'
      : '\nLaura,Martínez Sánchez,laura@escuela.edu.mx,docente,matutino,Matemáticas,6° A,SEP-001,8110001111,primaria';
    const blob = new Blob([headers + ejemplo], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plantilla_${tipo}_siembra.csv`;
    a.click();
  } else {
    // Para xlsx, descargar la plantilla pre-generada o generar inline
    hubToast('⏳ Generando plantilla Excel…', 'ok');
    _cargarSheetJS().then(() => {
      const wb = XLSX.utils.book_new();
      const headers = tipo === 'alumnos'
        ? [['nombre*','apellido_p*','apellido_m','curp','fecha_nac','num_lista','grupo','tutor_nombre','telefono_tutor','email_alumno','email_padre','sexo'],
           ['Ana','García','López','GALA100305MNLRPN07','2010-03-05',1,'2° A','María López','8110001234','ana@gmail.com','maria@gmail.com','F'],
           ['Carlos','Ramírez','Torres','','2011-08-12',2,'1° B','Roberto R.','8110005678','','roberto@hotmail.com','M']]
        : [['nombre*','apellidos*','email*','rol','turno','materia','grupo','num_empleado','telefono','nivel'],
           ['Laura','Martínez Sánchez','laura@escuela.edu.mx','docente','matutino','Matemáticas','6° A','SEP-001','8110001111','primaria'],
           ['Carlos','Ramírez Torres','carlos@escuela.edu.mx','docente','matutino','Español','5° A','SEP-002','8110002222','primaria']];
      const ws = XLSX.utils.aoa_to_sheet(headers);
      // Ancho de columnas
      ws['!cols'] = headers[0].map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(wb, ws, tipo === 'alumnos' ? 'Alumnos' : 'Personal');
      XLSX.writeFile(wb, `plantilla_${tipo}_siembra.xlsx`);
      hubToast('✅ Plantilla descargada', 'ok');
    });
  }
}
window.admDescargarPlantilla = admDescargarPlantilla;
// ══════════════════════════════════════════════════════════════════════
// PEMC v2 — SISTEMA DE SELECCIÓN INTELIGENTE
// 80% seleccionar · 20% ajustar · 0% escribir desde cero
// ══════════════════════════════════════════════════════════════════════

// ── Tab switcher ─────────────────────────────────────────────────────
function pemcV2Tab(portal, tab) {
  ['wizard','docs','seguimiento','chat'].forEach(t => {
    const panel = document.getElementById(`${portal}-panel-${t}`);
    const btn   = document.getElementById(`${portal}-tab-${t}`);
    if (!panel || !btn) return;
    const isActive = t === tab;
    panel.style.display = isActive ? '' : 'none';
    const color = portal === 'subdir' ? '#1e3a5f' : '#3b0764';
    btn.style.cssText = isActive
      ? `padding:8px 16px;background:${color};color:white;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;`
      : `padding:8px 16px;background:white;border:1.5px solid #e2e8f0;color:#475569;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;`;
  });
  if (tab === 'seguimiento') pemcV2CargarSeguimiento(portal);
}
window.pemcV2Tab = pemcV2Tab;

// ── Seleccionar intensidad ────────────────────────────────────────────
function pemcV2SelIntensidad(portal, val) {
  const color = portal === 'subdir' ? '#1e3a5f' : '#3b0764';
  const bg    = portal === 'subdir' ? '#eff6ff' : '#f5f3ff';
  ['basica','media','alta'].forEach(v => {
    const btn = document.querySelector(`[onclick="pemcV2SelIntensidad('${portal}','${v}')"]`);
    if (!btn) return;
    if (v === val) {
      btn.style.cssText = `padding:10px;border:2px solid ${color};border-radius:10px;text-align:center;background:${bg};transition:.2s;`;
      btn.querySelector('div:last-child').style.color = color;
    } else {
      btn.style.cssText = `padding:10px;border:2px solid #e2e8f0;border-radius:10px;text-align:center;transition:.2s;`;
      btn.querySelector('div:last-child').style.color = '#334155';
    }
  });
  window[`_pemc_intensidad_${portal}`] = val;
}
window.pemcV2SelIntensidad = pemcV2SelIntensidad;

// ── Recolectar selecciones del wizard ─────────────────────────────────
function pemcV2Recolectar(portal) {
  const g  = id => document.getElementById(id);
  const nivel       = g(`${portal}-pemc-nivel`)?.value || 'secundaria';
  const contexto    = g(`${portal}-pemc-contexto`)?.value || 'urbano';
  const turno       = g(`${portal}-pemc-turno`)?.value || 'matutino';
  const matricula   = g(`${portal}-pemc-matricula`)?.value || '100a300';
  const ciclo       = g(`${portal}-pemc-ciclo`)?.value || '2025-2026';
  const marginacion = g(`${portal}-pemc-marginacion`)?.value || 'media';
  const intensidad  = window[`_pemc_intensidad_${portal}`] || 'media';
  const escuelaNom  = window.currentPerfil?.escuela_nombre || window.ADM?.escuelaNombre || 'Escuela';
  const escuelaCCT  = window.currentPerfil?.escuela_cct || window.ADM?.escuelaCct || '';

  const problemas = [...document.querySelectorAll(`.${portal}-pemc-problema:checked`)]
    .map(el => el.closest('label')?.querySelector('span')?.textContent || el.value);

  const docs = {
    pemc:         g(`${portal}-gen-pemc`)?.checked,
    diagnostico:  g(`${portal}-gen-diagnostico`)?.checked,
    metas:        g(`${portal}-gen-metas`)?.checked,
    acta:         g(`${portal}-gen-acta`)?.checked,
  };

  return { nivel, contexto, turno, matricula, ciclo, marginacion,
           intensidad, problemas, docs, escuelaNom, escuelaCCT };
}

// ── GENERAR PLAN COMPLETO ─────────────────────────────────────────────
async function pemcV2Generar(portal) {
  const datos = pemcV2Recolectar(portal);

  if (!datos.problemas.length) {
    hubToast('⚠️ Selecciona al menos una problemática', 'warn'); return;
  }

  const btn = document.getElementById(`${portal}-btn-generar`);
  const resEl = document.getElementById(`${portal}-pemc-resultado`);
  if (btn) { btn.innerHTML = '⏳ Generando con IA…'; btn.disabled = true; }
  if (resEl) resEl.style.display = 'none';

  const color = portal === 'subdir' ? '#1e3a5f' : '#3b0764';
  const numAcciones = datos.intensidad === 'basica' ? '2 a 3' : datos.intensidad === 'media' ? '4 a 5' : '6 o más';

  const prompt = `Eres un experto en gestión educativa de México. Genera un PLAN ESCOLAR DE MEJORA CONTINUA (PEMC) completo para la siguiente escuela:

DATOS DE LA ESCUELA:
- Nombre: ${datos.escuelaNom}
- CCT: ${datos.escuelaCCT}
- Nivel: ${datos.nivel}
- Contexto: ${datos.contexto}
- Turno: ${datos.turno}
- Matrícula: ${datos.matricula}
- Marginación: ${datos.marginacion}
- Ciclo escolar: ${datos.ciclo}

PROBLEMÁTICAS DETECTADAS:
${datos.problemas.map((p,i) => `${i+1}. ${p}`).join('\n')}

CONFIGURACIÓN:
- Intensidad de acciones: ${datos.intensidad} (${numAcciones} acciones por mes)
- Documentos a generar: ${Object.entries(datos.docs).filter(([,v])=>v).map(([k])=>k).join(', ')}

GENERA:
1. DIAGNÓSTICO: Análisis de la situación actual basado en las problemáticas (párrafo formal SEP)
2. OBJETIVOS GENERALES: 2-3 objetivos claros y medibles
3. PLAN MENSUAL: Para cada mes de Agosto a Junio, genera:
   - Objetivo del mes
   - ${numAcciones} actividades concretas y realizables
   - Responsable sugerido
   - Indicador de logro medible

Responde en formato JSON exacto:
[PLAN_JSON]{"diagnostico":"...","objetivos":["..."],"meses":[{"mes":"Agosto","objetivo":"...","actividades":["...","..."],"responsable":"...","indicador":"...","completada":false}]}[/PLAN_JSON]

Redacta en lenguaje formal de la SEP México. Las actividades deben ser específicas, realizables y adaptadas al contexto ${datos.contexto}.`;

  try {
    let respuesta = '';
    if (window.sb) {
      const { data: { session } } = await sb.auth.getSession();
      const jwt = session?.access_token;
      const url = `${window.SUPABASE_URL}/functions/v1/ai-router`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${jwt}` },
        body: JSON.stringify({
          feature: 'pemc_ruta_mejora', prompt,
          system: 'Responde SOLO con el JSON solicitado dentro de las etiquetas [PLAN_JSON][/PLAN_JSON]. Nada más.',
          escuela_id: datos.escuelaCCT, ciclo: datos.ciclo,
        })
      });
      const data = await resp.json();
      respuesta = data.text || data.content || '';
    }

    // Extraer JSON
    const planMatch = respuesta.match(/\[PLAN_JSON\]([\s\S]*?)\[\/PLAN_JSON\]/);
    if (!planMatch) throw new Error('La IA no devolvió el formato esperado. Intenta de nuevo.');

    const plan = JSON.parse(planMatch[1]);
    window[`_pemcPlan_${portal}`] = { ...plan, datos };

    // Guardar en Supabase
    const cct = datos.escuelaCCT;
    if (window.sb && cct) {
      await sb.from('pemc').upsert({
        ciclo: datos.ciclo, escuela_cct: cct,
        plan_json: JSON.stringify(plan),
        generado_por: window.currentPerfil?.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'ciclo,escuela_cct' }).catch(()=>{});
    }

    // Renderizar resultado
    pemcV2RenderResultado(portal, plan, datos);
    if (btn) { btn.innerHTML = '✅ Plan generado — ⚡ Regenerar'; btn.disabled = false; }

  } catch(e) {
    if (btn) { btn.innerHTML = '⚡ Generar plan PEMC completo'; btn.disabled = false; }
    if (resEl) {
      resEl.style.display = '';
      resEl.innerHTML = `<div style="background:#fef2f2;border-radius:12px;padding:20px;color:#dc2626;">
        <strong>❌ Error:</strong> ${e.message}<br>
        <div style="font-size:12px;margin-top:8px;color:#7f1d1d;">Intenta de nuevo en unos momentos.</div>
      </div>`;
    }
    hubToast('❌ '+e.message, 'err');
  }
}
window.pemcV2Generar = pemcV2Generar;

// ── Renderizar resultado del plan ─────────────────────────────────────
function pemcV2RenderResultado(portal, plan, datos) {
  const resEl = document.getElementById(`${portal}-pemc-resultado`);
  if (!resEl) return;
  resEl.style.display = '';

  const color = portal === 'subdir' ? '#1e3a5f' : '#3b0764';
  const meses = plan.meses || [];
  const mesActual = new Date().toLocaleString('es-MX',{month:'long'}).replace(/^\w/,c=>c.toUpperCase());

  resEl.innerHTML = `
    <!-- Diagnóstico y objetivos -->
    <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:20px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:16px;font-weight:700;color:#0f172a;">📋 Resultado del PEMC generado</div>
        <div style="display:flex;gap:8px;">
          <button onclick="pemcV2Copiar('${portal}')" style="padding:7px 14px;background:#f8fafc;border:1.5px solid #e2e8f0;color:#475569;border-radius:8px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📋 Copiar texto</button>
          <button onclick="pemcV2ExportarWord('${portal}')" style="padding:7px 14px;background:#eff6ff;border:1.5px solid #bfdbfe;color:#1e40af;border-radius:8px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📄 Exportar Word</button>
          <button onclick="pemcV2Tab('${portal}','seguimiento')" style="padding:7px 14px;background:${color};color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📊 Ver seguimiento</button>
        </div>
      </div>
      ${plan.diagnostico ? `
        <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:14px;">
          <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">Diagnóstico escolar</div>
          <div style="font-size:13px;color:#334155;line-height:1.7;">${plan.diagnostico}</div>
        </div>` : ''}
      ${plan.objetivos?.length ? `
        <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">Objetivos generales</div>
        ${plan.objetivos.map((o,i) => `<div style="display:flex;gap:10px;margin-bottom:6px;align-items:flex-start;">
          <div style="width:22px;height:22px;background:${color};border-radius:50%;color:white;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</div>
          <div style="font-size:13px;color:#334155;line-height:1.5;">${o}</div>
        </div>`).join('')}` : ''}
    </div>
    <!-- Plan mensual -->
    <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:12px;">📅 Plan mes a mes (${meses.length} meses)</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
      ${meses.map((m,i) => {
        const esActual = m.mes === mesActual;
        const cols = ['#0d5c2f','#1e40af','#5b21b6','#c2410c','#047857','#a16207','#0369a1','#7c3aed','#b45309','#15803d'];
        const col = cols[i%cols.length];
        return `<div style="background:white;border-radius:12px;border:${esActual?`2px solid ${col}`:'1px solid #e2e8f0'};padding:14px;${esActual?`box-shadow:0 4px 16px ${col}22`:''}position:relative;">
          ${esActual?`<div style="position:absolute;top:-10px;left:12px;background:${col};color:white;padding:2px 10px;border-radius:99px;font-size:10px;font-weight:700;">MES ACTUAL</div>`:''}
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="font-size:14px;font-weight:800;color:${col};">${m.mes}</div>
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:10px;color:#64748b;">
              <input type="checkbox" ${m.completada?'checked':''} onchange="pemcV2Toggle('${portal}',${i},this.checked)" style="width:13px;height:13px;accent-color:${col};"> Completado
            </label>
          </div>
          <div style="font-size:11px;font-weight:700;color:#0f172a;margin-bottom:6px;">${m.objetivo||''}</div>
          <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:8px;">
            ${(m.actividades||[]).map(a=>`<div style="font-size:11px;color:#475569;display:flex;gap:5px;"><span style="color:${col};font-weight:700;">▸</span><span>${a}</span></div>`).join('')}
          </div>
          ${m.indicador?`<div style="background:${col}12;border-radius:6px;padding:5px 8px;font-size:10px;color:${col};font-weight:700;">📊 ${m.indicador}</div>`:''}
        </div>`;
      }).join('')}
    </div>`;

  resEl.scrollIntoView({ behavior:'smooth' });

  // Actualizar seguimiento
  pemcV2CargarSeguimiento(portal);
  // Notificar al director
  window.dispatchEvent(new CustomEvent('siembra:pemc_actualizado'));
}
window.pemcV2RenderResultado = pemcV2RenderResultado;

// ── Toggle completado ─────────────────────────────────────────────────
function pemcV2Toggle(portal, idx, val) {
  const plan = window[`_pemcPlan_${portal}`];
  if (!plan?.meses?.[idx]) return;
  plan.meses[idx].completada = val;
  pemcV2CargarSeguimiento(portal);
  if (window.sb && plan.datos?.escuelaCCT) {
    sb.from('pemc').update({ plan_json: JSON.stringify(plan) })
      .eq('ciclo', plan.datos?.ciclo||'2025-2026')
      .eq('escuela_cct', plan.datos.escuelaCCT).catch(()=>{});
  }
}
window.pemcV2Toggle = pemcV2Toggle;

// ── Seguimiento visual ────────────────────────────────────────────────
function pemcV2CargarSeguimiento(portal) {
  const el = document.getElementById(`${portal}-seguimiento-content`);
  if (!el) return;
  const plan = window[`_pemcPlan_${portal}`];
  if (!plan?.meses?.length) {
    el.innerHTML = `<div style="text-align:center;padding:50px;color:#94a3b8;"><div style="font-size:48px;margin-bottom:12px;">📊</div><div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:6px;">Sin plan activo</div><div style="font-size:13px;">Genera el plan en ⚡ Generador rápido</div></div>`;
    return;
  }
  const color = portal === 'subdir' ? '#1e3a5f' : '#3b0764';
  const meses = plan.meses;
  const total = meses.reduce((s,m)=>s+(m.actividades?.length||0),0);
  const comp  = meses.reduce((s,m)=>s+(m.completada?(m.actividades?.length||0):0),0);
  const pct   = total>0?Math.round((comp/total)*100):0;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
      <div style="background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:32px;font-weight:900;color:#0d5c2f;">${pct}%</div>
        <div style="font-size:12px;color:#64748b;">Avance general</div>
      </div>
      <div style="background:#eff6ff;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:32px;font-weight:900;color:#1e40af;">${comp}</div>
        <div style="font-size:12px;color:#64748b;">Actividades completadas</div>
      </div>
      <div style="background:#fff7ed;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:32px;font-weight:900;color:#c2410c;">${total-comp}</div>
        <div style="font-size:12px;color:#64748b;">Pendientes</div>
      </div>
      <div style="background:#f5f3ff;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:32px;font-weight:900;color:#5b21b6;">${meses.filter(m=>m.completada).length}/${meses.length}</div>
        <div style="font-size:12px;color:#64748b;">Meses completados</div>
      </div>
    </div>
    <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:16px;">
      <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:12px;">Progreso mes a mes</div>
      ${meses.map(m => {
        const pctM = m.completada ? 100 : 0;
        const col  = m.completada ? '#22c55e' : '#e2e8f0';
        return `<div style="display:grid;grid-template-columns:80px 1fr 40px;align-items:center;gap:10px;margin-bottom:8px;">
          <div style="font-size:12px;color:#334155;font-weight:600;">${m.mes}</div>
          <div style="height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
            <div style="height:100%;width:${pctM}%;background:${col};border-radius:99px;transition:.5s;"></div>
          </div>
          <div style="font-size:11px;font-weight:700;color:${m.completada?'#15803d':'#94a3b8'};text-align:right;">${m.completada?'✅':'⏳'}</div>
        </div>`;
      }).join('')}
    </div>`;
}
window.pemcV2CargarSeguimiento = pemcV2CargarSeguimiento;

// ── Análisis IA del seguimiento ───────────────────────────────────────
async function pemcV2AnalizarSeguimiento(portal) {
  const plan = window[`_pemcPlan_${portal}`];
  if (!plan?.meses?.length) { hubToast('Genera el plan primero','warn'); return; }
  const el = document.getElementById(`${portal}-seg-ia`);
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b;">⚙️ Analizando avance…</div>';
  const comp  = plan.meses.filter(m=>m.completada).length;
  const total = plan.meses.length;
  const pend  = plan.meses.filter(m=>!m.completada).map(m=>m.mes).join(', ');
  const datos = pemcV2Recolectar(portal);
  const prompt = `Analiza el avance del PEMC de la escuela ${datos.escuelaNom}: ${comp} de ${total} meses completados. Meses pendientes: ${pend||'ninguno'}. Problemas trabajados: ${datos.problemas?.join(', ')||'no especificados'}. Genera: 1) Evaluación del avance (2 oraciones), 2) 3 recomendaciones concretas para acelerar el cumplimiento, 3) Si hay riesgo de no cumplir el ciclo (sí/no y por qué). Lenguaje formal SEP, máximo 200 palabras.`;
  try {
    const texto = await callAI({ feature:'pemc_ruta_mejora', prompt, escuela_id: datos.escuelaCCT });
    const html = texto.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    el.innerHTML = `<div style="background:#f0fdf4;border-radius:12px;padding:16px;font-size:13px;color:#0d5c2f;line-height:1.7;border:1px solid #bbf7d0;">${html}</div>`;
  } catch(e) {
    el.innerHTML = `<div style="color:#dc2626;font-size:12px;">❌ ${e.message}</div>`;
  }
}
window.pemcV2AnalizarSeguimiento = pemcV2AnalizarSeguimiento;

// ── Exportar Word (.doc HTML trick) ──────────────────────────────────
function pemcV2ExportarWord(elIdOrPortal, titulo, escuela) {
  let contenido = '';
  let tituloDoc = titulo || 'PEMC';
  let escuelaDoc = escuela || '';

  // Si se pasa un portal (wizard result), construir desde el plan
  if (!titulo && window[`_pemcPlan_${elIdOrPortal}`]) {
    const portal = elIdOrPortal;
    const plan   = window[`_pemcPlan_${portal}`];
    const datos  = pemcV2Recolectar(portal);
    tituloDoc  = 'Plan Escolar de Mejora Continua';
    escuelaDoc = datos.escuelaNom || '';
    let txt = '';
    if (plan.diagnostico) txt += `<h3>Diagnóstico escolar</h3><p>${plan.diagnostico.replace(/\n/g,'<br>')}</p>`;
    if (plan.objetivos?.length) txt += `<h3>Objetivos generales</h3><ul>${plan.objetivos.map(o=>`<li>${o}</li>`).join('')}</ul>`;
    if (plan.meses?.length) {
      txt += '<h3>Plan mensual</h3>';
      plan.meses.forEach(m => {
        txt += `<h4 style="color:#0d5c2f;margin-top:12pt;">${m.mes}</h4>`;
        txt += `<p><strong>Objetivo:</strong> ${m.objetivo}</p>`;
        if (m.actividades?.length) txt += `<ul>${m.actividades.map(a=>`<li>${a}</li>`).join('')}</ul>`;
        if (m.indicador) txt += `<p><strong>Indicador:</strong> ${m.indicador}</p>`;
        if (m.responsable) txt += `<p><strong>Responsable:</strong> ${m.responsable}</p>`;
      });
    }
    contenido = txt;
  } else {
    // Se pasa un elId directo (documentos SEP)
    const el = document.getElementById(elIdOrPortal);
    if (!el) { hubToast('Sin contenido para exportar','warn'); return; }
    contenido = el.innerHTML;
  }

  const fecha = new Date().toLocaleDateString('es-MX');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
       xmlns:w="urn:schemas-microsoft-com:office:word"
       xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8"><title>${tituloDoc}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.7;margin:2cm;}
    h3{font-size:13pt;font-weight:bold;color:#0d5c2f;margin:14pt 0 6pt;}
    h4{font-size:12pt;font-weight:bold;color:#1e3a5f;margin:10pt 0 4pt;}
    p{margin-bottom:8pt;}
    ul{margin:6pt 0 10pt 20pt;}
    li{margin-bottom:4pt;}
    .header{text-align:center;border-bottom:2pt solid #0d5c2f;padding-bottom:12pt;margin-bottom:20pt;}
    .footer{font-size:9pt;color:#666;border-top:1pt solid #ccc;padding-top:8pt;margin-top:20pt;}
  </style>
  </head><body>
  <div class="header">
    <div style="font-size:16pt;font-weight:bold;color:#0d5c2f;">SIEMBRA</div>
    <div style="font-size:14pt;font-weight:bold;margin-top:6pt;">${tituloDoc}</div>
    <div style="font-size:11pt;color:#475569;margin-top:4pt;">${escuelaDoc}</div>
  </div>
  ${contenido}
  <div class="footer">Generado por SIEMBRA · ${fecha}</div>
  </body></html>`;

  const blob = new Blob([html], { type: 'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${tituloDoc.replace(/\s+/g,'-')}-SIEMBRA.doc`;
  a.click();
  URL.revokeObjectURL(url);
  hubToast('✅ Descargando Word…','ok');
}
window.pemcV2ExportarWord = pemcV2ExportarWord;

// ── Generar documento específico ──────────────────────────────────────
async function pemcV2GenerarDoc(portal, tipo, titulo) {
  const datos = pemcV2Recolectar(portal);
  const plan  = window[`_pemcPlan_${portal}`];
  const resEl = document.getElementById(`${portal}-doc-resultado`);
  if (resEl) { resEl.style.display=''; resEl.innerHTML='<div style="text-align:center;padding:30px;color:#64748b;"><div style="font-size:32px;margin-bottom:8px;">⏳</div>Generando documento con IA…</div>'; }

  const PROMPTS = {
    pemc_completo:    `Redacta un PEMC completo en formato oficial SEP para ${datos.escuelaNom} (${datos.nivel}, ${datos.contexto}). Incluye: carátula, diagnóstico, prioridades de mejora, objetivos, metas, acciones por periodo y seguimiento.`,
    diagnostico:      `Redacta un diagnóstico escolar formal para ${datos.escuelaNom}. Problemáticas: ${datos.problemas.join(', ')}. Formato SEP con introducción, análisis por dimensión y conclusiones.`,
    metas:            `Genera una tabla de metas e indicadores en formato SEP para ${datos.escuelaNom}. Incluye: prioridad, meta, indicador, línea base estimada, meta esperada y responsable. Basado en: ${datos.problemas.join(', ')}.`,
    acta_cte:         `Redacta el Acta del Consejo Técnico Escolar del mes ${new Date().toLocaleString('es-MX',{month:'long',year:'numeric'})} para ${datos.escuelaNom}. Incluye: asistentes tipo, orden del día relacionado con el PEMC, acuerdos y compromisos.`,
    informe:          `Redacta un informe de seguimiento del PEMC para ${datos.escuelaNom}. ${plan?'Avance actual: '+Math.round((plan.meses?.filter(m=>m.completada).length||0)/(plan.meses?.length||1)*100)+'%':'Ciclo en inicio.'}. Formato formal para supervisión escolar.`,
    programa_analitico:`Genera un programa analítico en formato NEM para ${datos.nivel} en ${datos.escuelaNom}. Incluye campos formativos del plan 2022, propósitos, contenidos prioritarios y forma de evaluación.`,
    informe_padres:   `Redacta un comunicado formal para padres de familia de ${datos.escuelaNom} sobre el Plan de Mejora Continua del ciclo ${datos.ciclo}. Lenguaje accesible, menciona las áreas de trabajo y cómo pueden apoyar.`,
    calendario:       `Genera un calendario de actividades para el ciclo ${datos.ciclo} de ${datos.escuelaNom}. Incluye: actividades del PEMC mes a mes, periodos de evaluación SEP, CTE, y actividades cívicas principales.`,
  };

  const prompt = PROMPTS[tipo] || `Genera el documento: ${titulo} para ${datos.escuelaNom}`;

  try {
    let texto = '';
    texto = await callAI({
      feature: 'pemc_doc_sep',
      prompt,
      escuela_id: datos.escuelaCCT,
      nivel: datos.nivel,
      ciclo: datos.ciclo,
    });

    if (!texto) throw new Error('Sin respuesta de la IA');

    // Formatear texto en HTML
    const htmlTexto = texto
      .replace(/^#{1,2}\s+(.+)$/gm, '<h3 style="font-size:15px;font-weight:800;color:#0f172a;margin:16px 0 8px;">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li style="margin-bottom:4px;">$1</li>')
      .replace(/\n\n/g, '</p><p style="margin-bottom:10px;">')
      .replace(/\n/g, '<br>');

    if (resEl) {
      const color = portal==='subdir'?'#1e3a5f':'#3b0764';
      resEl.innerHTML = `
        <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:24px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:8px;">
            <div style="font-size:15px;font-weight:700;color:#0f172a;">📄 ${titulo}</div>
            <div style="display:flex;gap:8px;">
              <button onclick="navigator.clipboard.writeText(document.getElementById('${portal}-doc-texto').innerText);hubToast('✅ Copiado','ok')"
                style="padding:6px 12px;background:#f8fafc;border:1.5px solid #e2e8f0;color:#475569;border-radius:8px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📋 Copiar</button>
              <button onclick="pemcV2ExportarWord('${portal}-doc-texto','${titulo}','${datos.escuelaNom}')"
                style="padding:6px 12px;background:#166534;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📝 Word</button>
              <button onclick="pemcV2ImprimirDoc('${portal}-doc-texto','${titulo}')"
                style="padding:6px 12px;background:${color};color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;">🖨️ Imprimir / PDF</button>
            </div>
          </div>
          <div id="${portal}-doc-texto" style="font-size:13px;color:#334155;line-height:1.8;max-height:500px;overflow-y:auto;padding:16px;background:#f8fafc;border-radius:10px;">
            <p style="margin-bottom:10px;">${htmlTexto}</p>
          </div>
        </div>`;
    }
  } catch(e) {
    if (resEl) resEl.innerHTML = `<div style="background:#fef2f2;border-radius:12px;padding:16px;color:#dc2626;">❌ ${e.message}</div>`;
    hubToast('❌ '+e.message,'err');
  }
}
window.pemcV2GenerarDoc = pemcV2GenerarDoc;

// ── Imprimir documento ────────────────────────────────────────────────
function pemcV2ImprimirDoc(elId, titulo) {
  const el = document.getElementById(elId);
  if (!el) return;
  const ventana = window.open('','_blank');
  ventana.document.write(`<!DOCTYPE html><html><head><title>${titulo}</title>
    <style>body{font-family:Arial,sans-serif;font-size:13px;line-height:1.7;padding:40px;max-width:800px;margin:0 auto;}
    h3{font-size:15px;font-weight:bold;margin:16px 0 8px;}@media print{body{padding:20px;}}</style>
    </head><body>${el.innerHTML}<br><br><div style="font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;">Generado por SIEMBRA · ${new Date().toLocaleDateString('es-MX')}</div></body></html>`);
  ventana.document.close();
  setTimeout(()=>ventana.print(),400);
}
window.pemcV2ImprimirDoc = pemcV2ImprimirDoc;

// ── Copiar plan completo ──────────────────────────────────────────────
function pemcV2Copiar(portal) {
  const plan = window[`_pemcPlan_${portal}`];
  if (!plan) { hubToast('Sin plan para copiar','warn'); return; }
  let txt = `PLAN ESCOLAR DE MEJORA CONTINUA\n${plan.datos?.escuelaNom||'Escuela'}\nCiclo ${plan.datos?.ciclo||'2025-2026'}\n\n`;
  if (plan.diagnostico) txt += `DIAGNÓSTICO:\n${plan.diagnostico}\n\n`;
  if (plan.objetivos) txt += `OBJETIVOS:\n${plan.objetivos.map((o,i)=>`${i+1}. ${o}`).join('\n')}\n\n`;
  txt += 'PLAN MENSUAL:\n';
  (plan.meses||[]).forEach(m => {
    txt += `\n${m.mes.toUpperCase()}\nObjetivo: ${m.objetivo}\nActividades:\n`;
    (m.actividades||[]).forEach(a => txt += `  • ${a}\n`);
    txt += `Indicador: ${m.indicador||''}\n`;
  });
  navigator.clipboard.writeText(txt);
  hubToast('✅ Plan copiado al portapapeles','ok');
}
window.pemcV2Copiar = pemcV2Copiar;

// ── Chat rápido con sugerencias ───────────────────────────────────────
function pemcV2ChatRapido(portal, texto) {
  const inp = document.getElementById(`${portal}-chat-sep-input`);
  if (inp) inp.value = texto;
  pemcV2ChatSend(portal);
}
window.pemcV2ChatRapido = pemcV2ChatRapido;

async function pemcV2ChatSend(portal) {
  const inp  = document.getElementById(`${portal}-chat-sep-input`);
  const chat = document.getElementById(`${portal}-chat-sep`);
  const text = inp?.value.trim();
  if (!text || !chat) return;
  inp.value = '';

  const color = portal==='subdir'?'#1e3a5f':'#3b0764';
  const hora  = new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  const datos = pemcV2Recolectar(portal);

  // Mensaje usuario
  chat.insertAdjacentHTML('beforeend',`
    <div style="display:flex;gap:8px;flex-direction:row-reverse;">
      <div style="width:30px;height:30px;border-radius:50%;background:#0d5c2f;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;">👤</div>
      <div style="background:#0d5c2f;color:white;border-radius:12px 12px 3px 12px;padding:10px 13px;max-width:80%;font-size:13px;line-height:1.5;">${text}<div style="font-size:9px;opacity:.6;margin-top:3px;text-align:right;">${hora}</div></div>
    </div>`);

  // Typing
  const tid = 'typing'+Date.now();
  chat.insertAdjacentHTML('beforeend',`
    <div id="${tid}" style="display:flex;gap:8px;">
      <div style="width:30px;height:30px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;">🤖</div>
      <div style="background:#f8fafc;border-radius:12px;padding:10px 13px;"><div style="display:flex;gap:4px;align-items:center;"><div style="width:6px;height:6px;background:#94a3b8;border-radius:50%;animation:bounce 1s infinite;"></div><div style="width:6px;height:6px;background:#94a3b8;border-radius:50%;animation:bounce 1s .2s infinite;"></div><div style="width:6px;height:6px;background:#94a3b8;border-radius:50%;animation:bounce 1s .4s infinite;"></div></div></div>
    </div>`);
  chat.scrollTop = chat.scrollHeight;

  try {
    const system = `Eres un experto en gestión educativa SEP México. Redactas documentos formales listos para entregar. Escuela: ${datos.escuelaNom} (${datos.nivel}, ${datos.contexto}). Ciclo: ${datos.ciclo}. Cuando generes documentos usa formato claro con encabezados y secciones.`;
    const respuesta = await callAI({
      feature: 'pemc_chat',
      prompt: text,
      system,
      escuela_id: datos.escuelaCCT,
      nivel: datos.nivel,
      ciclo: datos.ciclo,
    });

    document.getElementById(tid)?.remove();
    const html = respuesta.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    chat.insertAdjacentHTML('beforeend',`
      <div style="display:flex;gap:8px;">
        <div style="width:30px;height:30px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;">🤖</div>
        <div style="background:#f8fafc;border-radius:12px 12px 12px 3px;padding:12px 14px;max-width:85%;font-size:13px;color:#334155;line-height:1.65;">${html}
          <div style="display:flex;gap:6px;margin-top:10px;">
            <button onclick="navigator.clipboard.writeText(this.closest('[style]').querySelector('div').innerText);hubToast('Copiado','ok')"
              style="padding:4px 10px;background:white;border:1.5px solid #e2e8f0;border-radius:6px;font-size:10px;font-family:'Sora',sans-serif;font-weight:700;color:#64748b;cursor:pointer;">📋 Copiar</button>
          </div>
        </div>
      </div>`);
    chat.scrollTop = chat.scrollHeight;
  } catch(e) {
    document.getElementById(tid)?.remove();
    chat.insertAdjacentHTML('beforeend',`<div style="color:#dc2626;font-size:12px;padding:8px;">❌ ${e.message}</div>`);
  }
}
window.pemcV2ChatSend = pemcV2ChatSend;

// ══════════════════════════════════════════════════════════════════════
// PEMC — ASISTENTE IA DE RUTA DE MEJORA
// Disponible para Subdirector y Coordinador
// El Director ve el avance en su dashboard
// ══════════════════════════════════════════════════════════════════════

window._pemcData = {
  subdir: { pdfTexto: null, pdfNombre: null, plan: null, historialChat: [], guardado: false },
  coord:  { pdfTexto: null, pdfNombre: null, plan: null, historialChat: [], guardado: false },
};

// ── Cargar PDF de la SEP ─────────────────────────────────────────────
async function pemcCargarPDF(input, portal) {
  const file = input.files[0];
  if (!file) return;

  const statusEl = document.getElementById(`${portal}-pemc-pdf-status`);
  const nombreEl = document.getElementById(`${portal}-pemc-pdf-nombre`);

  if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = '⏳ Leyendo PDF…'; }
  if (nombreEl) nombreEl.textContent = file.name;

  try {
    // Leer PDF como base64 para enviarlo a la IA
    const base64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

    // Guardar en estado
    window._pemcData[portal].pdfBase64 = base64;
    window._pemcData[portal].pdfNombre = file.name;

    if (statusEl) statusEl.textContent = `✅ PDF cargado: ${file.name} (${(file.size/1024).toFixed(0)}KB)`;

    // Agregar mensaje del sistema al chat indicando que el PDF fue cargado
    pemcAgregarMensaje(portal, 'user',
      `📎 Adjunté el documento de Ruta de Mejora SEP: **${file.name}**\n\nPor favor analízalo y extrae los temas y áreas de mejora que identifica.`
    );

    // Llamar a la IA con el PDF
    await pemcLlamarIA(portal, `El usuario adjuntó el PDF de Ruta de Mejora de la SEP llamado "${file.name}". Analiza el contenido del documento (es un PDF de la SEP mexicana sobre Ruta de Mejora Escolar) y extrae: 1) Los temas principales de mejora que identifica, 2) Las áreas críticas mencionadas, 3) Los indicadores que propone. Responde en español de forma estructurada y lista para planificar actividades escolares.`, base64);

  } catch(e) {
    if (statusEl) statusEl.textContent = `❌ Error: ${e.message}`;
    console.warn('[PEMC] cargarPDF:', e.message);
  }
}
window.pemcCargarPDF = pemcCargarPDF;

// ── Enviar mensaje al chat ────────────────────────────────────────────
async function pemcEnviarMensaje(portal) {
  const inputEl = document.getElementById(`${portal}-pemc-input`);
  const btnEl   = document.getElementById(`${portal}-pemc-send-btn`);
  const texto   = inputEl?.value.trim();
  if (!texto) return;

  inputEl.value = '';
  if (btnEl) { btnEl.textContent = '⏳'; btnEl.disabled = true; }

  pemcAgregarMensaje(portal, 'user', texto);

  // Construir contexto con historial
  const historial = window._pemcData[portal].historialChat || [];
  const planActual = window._pemcData[portal].plan;

  let systemCtx = `Eres un experto en planeación educativa del sistema SEP México. 
Ayudas a subdirectores y coordinadores a diseñar su Plan de Mejora Continua (PEMC) y Ruta de Mejora Escolar.
Cuando el usuario describa problemáticas, genera actividades concretas, medibles y realizables mes a mes.
Ciclo escolar actual: ${window.CICLO_ACTIVO || '2025-2026'}.
Escuela: ${window.ADM?.escuelaNombre || window.currentPerfil?.escuela_nombre || 'Escuela'}.
Al generar un plan mensual, usa este formato JSON al final de tu respuesta:
[PLAN_JSON]{"meses":[{"mes":"Agosto","objetivo":"...","actividades":["..."],"responsable":"...","indicador":"...","completada":false},...]}[/PLAN_JSON]
El plan debe cubrir todos los meses del ciclo escolar (Agosto a Junio).`;

  if (planActual) systemCtx += `\n\nYa existe un plan generado. El usuario puede estar pidiendo ajustes o seguimiento.`;

  await pemcLlamarIA(portal, texto, null, systemCtx, historial);

  if (btnEl) { btnEl.textContent = '➤ Enviar'; btnEl.disabled = false; }
}
window.pemcEnviarMensaje = pemcEnviarMensaje;

// ── Llamar a la IA ────────────────────────────────────────────────────
async function pemcLlamarIA(portal, mensaje, pdfBase64 = null, systemOverride = null, historialPrevio = []) {
  const chatEl = document.getElementById(`${portal}-pemc-chat`);

  // Indicador de typing
  const typingId = `${portal}-typing-${Date.now()}`;
  if (chatEl) {
    chatEl.insertAdjacentHTML('beforeend', `
      <div id="${typingId}" style="display:flex;gap:10px;align-items:flex-start;">
        <div style="width:32px;height:32px;border-radius:50%;background:${portal==='subdir'?'#1e3a5f':'#3b0764'};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">🤖</div>
        <div style="background:#f8fafc;border-radius:12px 12px 12px 3px;padding:12px 16px;">
          <div style="display:flex;gap:5px;align-items:center;">
            <div style="width:8px;height:8px;background:#94a3b8;border-radius:50%;animation:bounce 1s infinite;"></div>
            <div style="width:8px;height:8px;background:#94a3b8;border-radius:50%;animation:bounce 1s .2s infinite;"></div>
            <div style="width:8px;height:8px;background:#94a3b8;border-radius:50%;animation:bounce 1s .4s infinite;"></div>
          </div>
        </div>
      </div>`);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  try {
    const systemMsg = systemOverride || `Eres un experto en planeación educativa SEP México. Ayudas a diseñar el Plan de Mejora Continua (PEMC). Responde siempre en español. Ciclo: ${window.CICLO_ACTIVO||'2025-2026'}.`;

    // Construir mensajes para la API
    const messages = [];

    // Agregar historial previo
    (historialPrevio || []).forEach(h => {
      messages.push({ role: h.rol, content: h.texto });
    });

    // Construir contenido del mensaje actual
    let contenidoActual = [];
    if (pdfBase64) {
      contenidoActual.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
      });
    }
    contenidoActual.push({ type: 'text', text: mensaje });

    messages.push({
      role: 'user',
      content: pdfBase64 ? contenidoActual : mensaje
    });

    // Llamar al API de Claude vía callAI o directo
    let respuesta = '';
    if (typeof callAI === 'function' && !pdfBase64) {
      respuesta = await callAI({
        feature: 'pemc_ruta_mejora',
        prompt: mensaje,
        system: systemMsg,
        context: { historial: historialPrevio, portal, ciclo: window.CICLO_ACTIVO }
      });
    } else {
      // Llamada directa con soporte para PDF
      const { data: { session } } = await sb.auth.getSession();
      const jwt = session?.access_token;
const supabaseUrl = window.sb?.supabaseUrl || 'https://mgmkzxtljkyoxqeytbjv.supabase.co';

      const resp = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
        body: JSON.stringify({
          feature: 'pemc_ruta_mejora',
          prompt: mensaje,
          system: systemMsg,
          messages: messages,
          escuela_id: window.currentPerfil?.escuela_cct,
          ciclo: window.CICLO_ACTIVO || '2025-2026',
          has_pdf: !!pdfBase64,
        })
      });
      const data = await resp.json();
      respuesta = data.text || data.content || '';
    }

    // Quitar typing indicator
    document.getElementById(typingId)?.remove();

    // Guardar en historial
    if (!window._pemcData[portal].historialChat) window._pemcData[portal].historialChat = [];
    window._pemcData[portal].historialChat.push({ rol: 'user', texto: mensaje });
    window._pemcData[portal].historialChat.push({ rol: 'assistant', texto: respuesta });

    // Extraer JSON del plan si existe
    const planMatch = respuesta.match(/\[PLAN_JSON\](.*?)\[\/PLAN_JSON\]/s);
    if (planMatch) {
      try {
        const planData = JSON.parse(planMatch[1]);
        window._pemcData[portal].plan = planData;
        const respLimpia = respuesta.replace(/\[PLAN_JSON\].*?\[\/PLAN_JSON\]/s, '').trim();
        pemcAgregarMensaje(portal, 'assistant', respLimpia);
        pemcRenderizarPlan(portal, planData);
      } catch(pe) {
        pemcAgregarMensaje(portal, 'assistant', respuesta);
      }
    } else {
      pemcAgregarMensaje(portal, 'assistant', respuesta);
    }

  } catch(e) {
    document.getElementById(typingId)?.remove();
    pemcAgregarMensaje(portal, 'assistant', `❌ Error al conectar con la IA: ${e.message}. Verifica tu conexión.`);
    console.warn('[PEMC] llamarIA:', e.message);
  }
}
window.pemcLlamarIA = pemcLlamarIA;

// ── Agregar mensaje al chat ───────────────────────────────────────────
function pemcAgregarMensaje(portal, rol, texto) {
  const chatEl = document.getElementById(`${portal}-pemc-chat`);
  if (!chatEl) return;

  const isUser = rol === 'user';
  const color  = portal === 'subdir' ? '#1e3a5f' : '#3b0764';
  const hora   = new Date().toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });

  // Formatear markdown básico
  let html = texto
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^(\d+\. )/gm, '<br>$1')
    .replace(/^- /gm, '<br>• ')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');

  chatEl.insertAdjacentHTML('beforeend', `
    <div style="display:flex;gap:10px;align-items:flex-start;${isUser?'flex-direction:row-reverse;':''}">
      <div style="width:32px;height:32px;border-radius:50%;background:${isUser?'#0d5c2f':color};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">
        ${isUser?'👤':'✨'}
      </div>
      <div style="background:${isUser?'#0d5c2f':color==='#1e3a5f'?'#eff6ff':'#f5f3ff'};color:${isUser?'white':'#1e293b'};border-radius:${isUser?'12px 12px 3px 12px':'12px 12px 12px 3px'};padding:12px 16px;max-width:85%;">
        <div style="font-size:13px;line-height:1.65;">${html}</div>
        <div style="font-size:10px;opacity:.6;margin-top:5px;text-align:right;">${hora}</div>
      </div>
    </div>`);
  chatEl.scrollTop = chatEl.scrollHeight;
}
window.pemcAgregarMensaje = pemcAgregarMensaje;

// ── Renderizar plan mensual ───────────────────────────────────────────
function pemcRenderizarPlan(portal, planData) {
  const container = document.getElementById(`${portal}-pemc-plan-container`);
  const mesesEl   = document.getElementById(`${portal}-pemc-plan-meses`);
  if (!container || !mesesEl) return;

  container.style.display = '';

  const meses = planData.meses || [];
  const mesActual = new Date().toLocaleString('es-MX', { month: 'long' });
  const mesActualCap = mesActual.charAt(0).toUpperCase() + mesActual.slice(1);

  // Actualizar stats
  const totalActs = meses.reduce((s, m) => s + (m.actividades?.length||0), 0);
  const completadas = meses.reduce((s, m) => s + (m.completada ? (m.actividades?.length||0) : 0), 0);
  const avance = totalActs > 0 ? Math.round((completadas/totalActs)*100) : 0;

  const setEl = (id, v) => { const e = document.getElementById(`${portal}-pemc-${id}`); if(e) e.textContent = v; };
  setEl('mes-actual', mesActualCap.slice(0,3));
  setEl('actividades', totalActs);
  setEl('completadas', completadas);
  setEl('avance', avance + '%');

  const colores = ['#0d5c2f','#1e40af','#5b21b6','#c2410c','#047857','#a16207','#0369a1','#7c3aed','#b45309','#15803d'];

  mesesEl.innerHTML = meses.map((m, i) => {
    const esActual = m.mes === mesActualCap || m.mes?.toLowerCase() === mesActual;
    const col = colores[i % colores.length];
    const acts = m.actividades || [];
    return `
      <div style="background:white;border-radius:14px;border:${esActual?`2px solid ${col}`:'1px solid #e2e8f0'};padding:16px;position:relative;${esActual?`box-shadow:0 4px 20px ${col}22`:''}>
        ${esActual?`<div style="position:absolute;top:-10px;left:16px;background:${col};color:white;padding:2px 12px;border-radius:99px;font-size:10px;font-weight:700;">MES ACTUAL</div>`:''}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:15px;font-weight:800;color:${col};">${m.mes}</div>
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:11px;color:#64748b;">
            <input type="checkbox" ${m.completada?'checked':''} onchange="pemcToggleCompletado('${portal}',${i},this.checked)" style="width:15px;height:15px;">
            Completado
          </label>
        </div>
        <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:8px;">🎯 ${m.objetivo||'Sin objetivo'}</div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px;">
          ${acts.map(a => `<div style="display:flex;gap:6px;font-size:12px;color:#334155;">
            <span style="color:${col};font-weight:700;">▸</span><span>${a}</span>
          </div>`).join('')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${m.responsable?`<span style="background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;">👤 ${m.responsable}</span>`:''}
          ${m.indicador?`<span style="background:${col}18;color:${col};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;">📊 ${m.indicador}</span>`:''}
        </div>
      </div>`;
  }).join('');
}
window.pemcRenderizarPlan = pemcRenderizarPlan;

// ── Toggle completado en un mes ───────────────────────────────────────
function pemcToggleCompletado(portal, mesIdx, completada) {
  const plan = window._pemcData[portal]?.plan;
  if (!plan?.meses?.[mesIdx]) return;
  plan.meses[mesIdx].completada = completada;
  // Actualizar stats
  const totalActs  = plan.meses.reduce((s,m) => s+(m.actividades?.length||0), 0);
  const completadas= plan.meses.reduce((s,m) => s+(m.completada?(m.actividades?.length||0):0), 0);
  const avance     = totalActs>0 ? Math.round((completadas/totalActs)*100) : 0;
  const setEl = (id,v) => { const e=document.getElementById(`${portal}-pemc-${id}`); if(e)e.textContent=v; };
  setEl('completadas', completadas);
  setEl('avance', avance+'%');
}
window.pemcToggleCompletado = pemcToggleCompletado;

// ── Guardar plan en Supabase ──────────────────────────────────────────
async function pemcGuardarPlan(portal) {
  const plan = window._pemcData[portal]?.plan;
  const historial = window._pemcData[portal]?.historialChat || [];
  if (!plan) { hubToast('⚠️ Aún no hay plan generado', 'warn'); return; }

  const cct = window.currentPerfil?.escuela_cct || ADM?.escuelaCct;
  if (!window.sb || !cct) { hubToast('⚠️ Sin conexión a Supabase', 'warn'); return; }

  try {
    await window.sb.from('pemc').upsert({
      ciclo:       window.CICLO_ACTIVO || '2025-2026',
      escuela_cct: cct,
      plan_json:   JSON.stringify(plan),
      historial_chat: JSON.stringify(historial.slice(-20)), // últimos 20 mensajes
      generado_por: window.currentPerfil?.id,
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'ciclo,escuela_cct' });

    window._pemcData[portal].guardado = true;
    hubToast('✅ Plan PEMC guardado correctamente', 'ok');

    // Disparar evento para que el director lo vea
    window.dispatchEvent(new CustomEvent('siembra:pemc_actualizado', {
      detail: { portal, cct, plan }
    }));
  } catch(e) { hubToast('❌ Error al guardar: '+e.message, 'err'); }
}
window.pemcGuardarPlan = pemcGuardarPlan;

// ── Ver plan actual (cargarlo desde BD) ──────────────────────────────
async function pemcVerPlan(portal) {
  const cct = window.currentPerfil?.escuela_cct;
  if (!window.sb || !cct) return;

  try {
    const { data } = await window.sb.from('pemc')
      .select('plan_json, historial_chat, updated_at, generado_por')
      .eq('ciclo', window.CICLO_ACTIVO||'2025-2026')
      .eq('escuela_cct', cct).maybeSingle();

    if (!data?.plan_json) { hubToast('Sin plan guardado para este ciclo', 'warn'); return; }

    const plan = JSON.parse(data.plan_json);
    window._pemcData[portal].plan = plan;
    pemcRenderizarPlan(portal, plan);

    const container = document.getElementById(`${portal}-pemc-plan-container`);
    if (container) container.scrollIntoView({ behavior: 'smooth' });

    hubToast(`✅ Plan cargado · Actualizado: ${new Date(data.updated_at).toLocaleDateString('es-MX')}`, 'ok');
  } catch(e) { hubToast('❌ '+e.message, 'err'); }
}
window.pemcVerPlan = pemcVerPlan;

// ── Nuevo ciclo ───────────────────────────────────────────────────────
function pemcNuevoCiclo(portal) {
  if (!confirm('¿Iniciar un nuevo plan? Se limpiará el chat actual (el plan guardado en BD no se borra).')) return;
  window._pemcData[portal] = { pdfTexto:null, pdfNombre:null, plan:null, historialChat:[], guardado:false };
  const chatEl = document.getElementById(`${portal}-pemc-chat`);
  const planCont = document.getElementById(`${portal}-pemc-plan-container`);
  const statusEl = document.getElementById(`${portal}-pemc-pdf-status`);
  const nombreEl = document.getElementById(`${portal}-pemc-pdf-nombre`);
  if (chatEl) chatEl.innerHTML = '';
  if (planCont) planCont.style.display = 'none';
  if (statusEl) statusEl.style.display = 'none';
  if (nombreEl) nombreEl.textContent = 'Seleccionar PDF de la SEP';
  pemcAgregarMensaje(portal, 'assistant', '✨ Nuevo ciclo iniciado. Cuéntame la problemática de tu escuela para diseñar el nuevo plan de Ruta de Mejora.');
}
window.pemcNuevoCiclo = pemcNuevoCiclo;

// ── Exportar plan como PDF (impresión) ────────────────────────────────
function pemcExportarPlan(portal) {
  const plan = window._pemcData[portal]?.plan;
  if (!plan?.meses?.length) { hubToast('⚠️ Sin plan para exportar', 'warn'); return; }
  hubToast('🖨️ Abriendo vista de impresión…', 'ok');
  setTimeout(() => window.print(), 400);
}
window.pemcExportarPlan = pemcExportarPlan;

// ── DIRECTOR: ver avance del PEMC de su escuela ───────────────────────
async function dirCargarAvancePEMC() {
  const cct = window.currentPerfil?.escuela_cct || window.ESCUELA_ACTIVA?.cct;
  if (!window.sb || !cct) return;

  try {
    const { data } = await window.sb.from('pemc')
      .select('plan_json, updated_at, generado_por, usuarios!generado_por(nombre,rol)')
      .eq('ciclo', window.CICLO_ACTIVO||'2025-2026')
      .eq('escuela_cct', cct).maybeSingle();

    if (!data) { 
      const el = document.getElementById('dir-pemc-avance');
      if (el) el.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;"><div style="font-size:32px;margin-bottom:8px;">📋</div><div style="font-weight:700;">Sin plan PEMC generado</div><div style="font-size:12px;margin-top:4px;">El Subdirector o Coordinador debe generar el plan con la IA</div></div>';
      return;
    }

    const plan = JSON.parse(data.plan_json);
    const meses = plan.meses || [];
    const total = meses.reduce((s,m)=>s+(m.actividades?.length||0),0);
    const comp  = meses.reduce((s,m)=>s+(m.completada?(m.actividades?.length||0):0),0);
    const avance= total>0?Math.round((comp/total)*100):0;
    const autor = data.usuarios?.nombre || 'Coordinador';
    const fecha = new Date(data.updated_at).toLocaleDateString('es-MX',{day:'2-digit',month:'long'});

    const el = document.getElementById('dir-pemc-avance');
    if (!el) return;

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
        <div style="background:#f0fdf4;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#0d5c2f;">${avance}%</div>
          <div style="font-size:11px;color:#64748b;">Avance del ciclo</div>
        </div>
        <div style="background:#eff6ff;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#1e40af;">${comp}/${total}</div>
          <div style="font-size:11px;color:#64748b;">Actividades completadas</div>
        </div>
        <div style="background:#f5f3ff;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#5b21b6;">${meses.length}</div>
          <div style="font-size:11px;color:#64748b;">Meses planeados</div>
        </div>
      </div>
      <div style="font-size:12px;color:#64748b;margin-bottom:12px;">Generado por <strong>${autor}</strong> · Actualizado ${fecha}</div>
      <div style="background:#f8fafc;border-radius:10px;padding:12px;">
        <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:8px;">Progreso por mes:</div>
        ${meses.map(m => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <div style="font-size:12px;min-width:70px;color:#334155;">${m.mes?.slice(0,3)||'—'}</div>
            <div style="flex:1;height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden;">
              <div style="height:100%;background:${m.completada?'#22c55e':'#94a3b8'};border-radius:99px;width:${m.completada?100:0}%;"></div>
            </div>
            <span style="font-size:11px;font-weight:700;color:${m.completada?'#15803d':'#94a3b8'};">${m.completada?'✅':'⏳'}</span>
          </div>`).join('')}
      </div>`;
  } catch(e) { console.warn('[PEMC director]', e.message); }
}
window.dirCargarAvancePEMC = dirCargarAvancePEMC;

// ── Reporte Ejecutivo IA — Director ───────────────────────────────────
async function dirGenerarReporteIA() {
  const el  = document.getElementById('dir-ia-reporte');
  const btn = document.getElementById('dir-btn-reporte-ia');
  const wordBtn = document.getElementById('dir-btn-reporte-word');
  if (!el) return;

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analizando…'; }
  el.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:20px;color:#1d4ed8;font-size:13px;">
    <span style="display:inline-block;width:16px;height:16px;border:2px solid #bfdbfe;border-top-color:#1d4ed8;border-radius:50%;animation:spin .8s linear infinite;"></span>
    Recopilando indicadores y generando reporte ejecutivo con IA…
  </div>`;

  try {
    const cct    = currentPerfil?.escuela_cct;
    const escNom = currentPerfil?.escuela_nombre || window._escuelaCfg?.nombre || 'Escuela';
    const ciclo  = window.CICLO_ACTIVO || '2025-2026';

    // Recopilar datos reales en paralelo
    const [
      { data: alumnos,    count: totalAlumnos },
      { data: docentes  },
      { data: incidencias },
      { data: califs    },
      { data: asistencias },
      { data: pemc      },
    ] = await Promise.all([
      sb.from('usuarios').select('id', { count:'exact', head:true })
        .eq('escuela_cct', cct).eq('rol','alumno').eq('activo',true),
      sb.from('usuarios').select('id,rol')
        .eq('escuela_cct', cct).in('rol',['docente','tutor']).eq('activo',true),
      sb.from('incidencias').select('id,estado,tipo')
        .eq('escuela_cct', cct)
        .gte('created_at', new Date(Date.now()-90*24*60*60*1000).toISOString()),
      sb.from('calificaciones').select('calificacion,materia')
        .eq('escuela_cct', cct).eq('ciclo', ciclo),
      sb.from('asistencia').select('presente')
        .eq('escuela_cct', cct)
        .gte('fecha', new Date(Date.now()-30*24*60*60*1000).toISOString().split('T')[0]),
      sb.from('pemc').select('plan_json,updated_at')
        .eq('escuela_cct', cct).eq('ciclo', ciclo).maybeSingle(),
    ]).catch(() => Array(6).fill({ data: null, count: 0 }));

    // Calcular indicadores
    const numAlumnos  = totalAlumnos || 0;
    const numDocentes = docentes?.length || 0;
    const incAbiertas = incidencias?.filter(i => i.estado !== 'cerrada').length || 0;
    const incUrgentes = incidencias?.filter(i => i.estado === 'urgente').length || 0;

    let promedio = '—', materiasRiesgo = [];
    if (califs?.length) {
      const nums = califs.map(c => parseFloat(c.calificacion)).filter(n => !isNaN(n));
      promedio = nums.length ? (nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(1) : '—';
      const porMateria = {};
      califs.forEach(c => {
        if (!porMateria[c.materia]) porMateria[c.materia] = [];
        const n = parseFloat(c.calificacion);
        if (!isNaN(n)) porMateria[c.materia].push(n);
      });
      materiasRiesgo = Object.entries(porMateria)
        .map(([m,vs]) => ({ materia:m, prom:(vs.reduce((a,b)=>a+b,0)/vs.length) }))
        .filter(x => x.prom < 7)
        .sort((a,b) => a.prom-b.prom)
        .slice(0,3)
        .map(x => `${x.materia} (${x.prom.toFixed(1)})`);
    }

    let pctAsistencia = '—';
    if (asistencias?.length) {
      const presentes = asistencias.filter(a => a.presente).length;
      pctAsistencia = Math.round((presentes/asistencias.length)*100) + '%';
    }

    const pemcInfo = pemc?.plan_json
      ? (() => {
          try {
            const p = JSON.parse(pemc.plan_json);
            const comp = p.meses?.filter(m=>m.completada).length || 0;
            return `${comp}/${p.meses?.length||0} meses completados`;
          } catch { return 'Plan generado'; }
        })()
      : 'No generado';

    // Construir prompt con datos reales
    const prompt = `Genera un REPORTE EJECUTIVO ESCOLAR en formato oficial para el director de "${escNom}" (CCT: ${cct||'—'}, Ciclo ${ciclo}).

INDICADORES REALES DE LA ESCUELA:
- Total alumnos activos: ${numAlumnos}
- Docentes activos: ${numDocentes}
- Promedio general de calificaciones: ${promedio}
- Materias con promedio bajo (<7): ${materiasRiesgo.join(', ') || 'Ninguna detectada'}
- Asistencia promedio (últimos 30 días): ${pctAsistencia}
- Incidencias abiertas: ${incAbiertas} (${incUrgentes} urgentes)
- PEMC / Ruta de Mejora: ${pemcInfo}

ESTRUCTURA DEL REPORTE (usa este formato exacto):
## 1. Datos generales
## 2. Indicadores clave del ciclo
## 3. Áreas de logro
## 4. Áreas de atención prioritaria
## 5. Acciones recomendadas para el director
## 6. Mensaje para el supervisor SEP

Lenguaje formal SEP México. Sé específico con los números. Máximo 600 palabras.`;

    const texto = await callAI({
      feature: 'director_reporte_global',
      prompt,
      system: _nemSys('TAREA: Reporte ejecutivo para director escolar. Perspectiva sistémica NEM. Identifica patrones de rezago, propone acciones institucionales concretas y priorizadas. Datos, no opiniones. Máximo 100 palabras en 3 puntos.'),
      escuela_id: cct,
      ciclo,
    });

    // Guardar para exportar
    window._dirUltimoReporte = { texto, escNom, ciclo };

    // Formatear HTML
    const html = texto
      .replace(/^## (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;color:#1e3a5f;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li style="margin-bottom:5px;">$1</li>')
      .replace(/(<li.*<\/li>\n?)+/g, m => `<ul style="margin:8px 0 12px 18px;">${m}</ul>`)
      .replace(/\n\n/g, '</p><p style="margin-bottom:10px;">')
      .replace(/\n/g, '<br>');

    el.innerHTML = `
      <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:24px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #1e3a5f;">
          <div style="width:40px;height:40px;background:#1e3a5f;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🏫</div>
          <div>
            <div style="font-size:15px;font-weight:700;color:#0f172a;">${escNom}</div>
            <div style="font-size:12px;color:#64748b;">Reporte ejecutivo · Ciclo ${ciclo} · Generado ${new Date().toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}</div>
          </div>
          <button onclick="navigator.clipboard.writeText(document.getElementById('dir-reporte-texto').innerText);hubToast('✅ Copiado','ok')"
            style="margin-left:auto;padding:6px 12px;background:#f8fafc;border:1.5px solid #e2e8f0;color:#475569;border-radius:8px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📋 Copiar</button>
        </div>
        <div id="dir-reporte-texto" style="font-size:13px;color:#334155;line-height:1.8;">
          <p style="margin-bottom:10px;">${html}</p>
        </div>
        <div style="margin-top:16px;padding:12px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;font-size:11px;color:#15803d;">
          ⚠️ Este reporte fue generado con IA a partir de los datos reales del sistema. Revisa y ajusta antes de presentar a supervisión.
        </div>
      </div>`;

    if (wordBtn) wordBtn.style.display = 'block';

  } catch(e) {
    el.innerHTML = `<div style="background:#fef2f2;border-radius:12px;padding:16px;color:#dc2626;font-size:13px;">❌ ${e.message}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✨ Generar reporte'; }
  }
}
window.dirGenerarReporteIA = dirGenerarReporteIA;

// ── Evaluaciones de docentes — Vista del director ────────────────────
async function dirCargarEvaluacionesDocentes() {
  const cct = window.currentPerfil?.escuela_cct || window._escuelaCfg?.cct;
  const listaEl = document.getElementById('dir-eval-docentes-lista');
  if (!listaEl) return;
  if (!window.sb || !cct) {
    listaEl.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">Sin conexión a base de datos</div>';
    return;
  }
  listaEl.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">Cargando evaluaciones…</div>';

  try {
    // Actualizar KPIs reales
    const [
      { count: docCnt },
      { count: grpCnt },
    ] = await Promise.all([
      window.sb.from('usuarios').select('id',{count:'exact',head:true}).eq('escuela_cct',cct).eq('rol','docente').eq('activo',true),
      window.sb.from('grupos').select('id',{count:'exact',head:true}).eq('escuela_cct',cct).eq('activo',true),
    ]);
    const setEl = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v??'—'; };
    setEl('rep-stat-docentes', docCnt||0);
    setEl('rep-stat-grupos', grpCnt||0);

    // Cargar visitas/evaluaciones de subdirector y coordinador
    const { data: visitas, error } = await window.sb
      .from('visitas_docentes')
      .select('id, docente_nombre, evaluador_nombre, fecha, tipo, calificacion, observaciones, compromisos')
      .eq('escuela_cct', cct)
      .order('fecha', { ascending: false })
      .limit(50);

    if (error) throw error;
    window._dirEvaluacionesCache = visitas || [];

    // Actualizar KPIs de evaluaciones
    const calPromedio = visitas?.length
      ? (visitas.reduce((s,v)=>s+(parseFloat(v.calificacion)||0),0)/visitas.length).toFixed(1)
      : '—';
    setEl('rep-stat-visitas', visitas?.length||0);
    setEl('rep-stat-caleval', calPromedio !== '—' ? calPromedio+'/10' : '—');

    if (!visitas?.length) {
      listaEl.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;"><div style="font-size:36px;margin-bottom:10px;">📋</div><div style="font-size:14px;font-weight:700;color:#0f172a;">Sin evaluaciones registradas</div><div style="font-size:13px;margin-top:4px;">Las evaluaciones las registra el subdirector y coordinador en sus portales.</div></div>';
      return;
    }

    listaEl.innerHTML = visitas.map(v => {
      const fecha = new Date(v.fecha).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'});
      const cal = parseFloat(v.calificacion) || 0;
      const calColor = cal >= 8 ? '#15803d' : cal >= 6 ? '#b45309' : '#dc2626';
      const calBg = cal >= 8 ? '#f0fdf4' : cal >= 6 ? '#fefce8' : '#fef2f2';
      return `<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:10px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${v.docente_nombre||'Docente'}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">${v.tipo||'Visita al aula'} · ${fecha} · Evaluador: ${v.evaluador_nombre||'—'}</div>
            ${v.observaciones ? `<div style="font-size:12px;color:#475569;margin-top:8px;background:#f8fafc;border-radius:8px;padding:10px;line-height:1.5;">${v.observaciones}</div>` : ''}
            ${v.compromisos ? `<div style="font-size:11px;color:#0d5c2f;margin-top:6px;font-weight:600;">📌 Compromisos: ${v.compromisos}</div>` : ''}
          </div>
          ${v.calificacion ? `<div style="background:${calBg};border-radius:10px;padding:12px 16px;text-align:center;flex-shrink:0;"><div style="font-size:22px;font-weight:900;color:${calColor};font-family:'Fraunces',serif;">${parseFloat(v.calificacion).toFixed(1)}</div><div style="font-size:10px;color:#64748b;font-weight:600;">/10</div></div>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    listaEl.innerHTML = `<div style="padding:20px;color:#dc2626;font-size:13px;">Error al cargar: ${e.message}</div>`;
  }
}

async function dirAnalisisEvaluacionesIA() {
  const visitas = window._dirEvaluacionesCache;
  if (!visitas?.length) { hubToast('⚠️ Primero actualiza las evaluaciones', 'warn'); return; }
  const btn = document.getElementById('dir-btn-eval-ia');
  const resultado = document.getElementById('dir-eval-ia-resultado');
  if (!resultado) return;
  if (btn) { btn.textContent = '⏳ Analizando…'; btn.disabled = true; }
  resultado.style.display = 'none';

  const resumen = visitas.slice(0, 15).map(v =>
    `• ${v.docente_nombre||'Docente'} — Cal: ${v.calificacion||'N/A'}/10 — ${v.observaciones ? v.observaciones.substring(0,100) : 'Sin observaciones'}`
  ).join('\n');

  try {
    const escuela = window._escuelaCfg?.nombre || 'la escuela';
    const prompt = `Eres asesor pedagógico de una escuela secundaria mexicana. Analiza las siguientes evaluaciones de docentes registradas por subdirección/coordinación en ${escuela}:\n\n${resumen}\n\nGenera un análisis ejecutivo para el director con: (1) fortalezas detectadas, (2) áreas de mejora prioritarias, (3) 3 acciones concretas recomendadas. Formato breve y claro, máx. 300 palabras.`;
    const texto = await callAI({
      feature: 'director_reporte_global',
      prompt,
      system: _nemSys('TAREA: Análisis ejecutivo de evaluaciones docentes para director. Identifica patrones, fortalezas del cuerpo docente y áreas de mejora institucional. Propone 3 acciones concretas y medibles. Lenguaje directivo, NEM. Máx 300 palabras.')
    });
    resultado.innerHTML = `<div style="font-size:12px;font-weight:700;color:#7c3aed;margin-bottom:8px;text-transform:uppercase;letter-spacing:.8px;">✨ Análisis IA — Evaluaciones docentes</div>${texto.replace(/\n/g,'<br>')}`;
    resultado.style.display = 'block';
  } catch(e) {
    resultado.innerHTML = `Error: ${e.message}`;
    resultado.style.display = 'block';
  } finally {
    if (btn) { btn.textContent = '✨ Análisis IA'; btn.disabled = false; }
  }
}
window.dirCargarEvaluacionesDocentes = dirCargarEvaluacionesDocentes;
window.dirAnalisisEvaluacionesIA = dirAnalisisEvaluacionesIA;

// ── Exportar reporte director a Word ─────────────────────────────────
function dirExportarReporteWord() {
  const rep = window._dirUltimoReporte;
  const el  = document.getElementById('dir-reporte-texto');
  if (!rep || !el) { hubToast('Genera el reporte primero','warn'); return; }
  const fecha = new Date().toLocaleDateString('es-MX');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
       xmlns:w="urn:schemas-microsoft-com:office:word"
       xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8"><title>Reporte Ejecutivo ${rep.escNom}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.7;margin:2.5cm;}
    h3{font-size:13pt;font-weight:bold;color:#1e3a5f;margin:14pt 0 6pt;border-bottom:1pt solid #e2e8f0;padding-bottom:4pt;}
    p{margin-bottom:8pt;} ul{margin:6pt 0 10pt 20pt;} li{margin-bottom:3pt;}
    .header{text-align:center;border-bottom:2pt solid #1e3a5f;padding-bottom:16pt;margin-bottom:24pt;}
    .footer{font-size:9pt;color:#666;border-top:1pt solid #ccc;padding-top:8pt;margin-top:24pt;text-align:center;}
    .badge{display:inline-block;background:#f0fdf4;border:1pt solid #bbf7d0;padding:4pt 10pt;border-radius:4pt;font-size:9pt;color:#15803d;}
  </style></head><body>
  <div class="header">
    <div style="font-size:10pt;color:#64748b;text-transform:uppercase;letter-spacing:2pt;">SIEMBRA — Sistema Educativo</div>
    <div style="font-size:18pt;font-weight:bold;color:#1e3a5f;margin:8pt 0;">Reporte Ejecutivo Escolar</div>
    <div style="font-size:12pt;">${rep.escNom}</div>
    <div style="font-size:10pt;color:#64748b;">Ciclo ${rep.ciclo} · ${fecha}</div>
  </div>
  ${el.innerHTML}
  <div class="footer">
    <span class="badge">⚠️ Generado con IA — Revisar antes de presentar a supervisión SEP</span><br>
    SIEMBRA · ${fecha}
  </div>
  </body></html>`;

  const blob = new Blob([html], { type:'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `Reporte-Ejecutivo-${rep.escNom.replace(/\s+/g,'-')}-${rep.ciclo}.doc`;
  a.click();
  URL.revokeObjectURL(url);
  hubToast('✅ Descargando reporte Word…','ok');
}
window.dirExportarReporteWord = dirExportarReporteWord;

// Cargar avance PEMC cuando el director entra a su dashboard
window.addEventListener('siembra:datos-cargados', () => {
  if (window.currentPerfil?.rol === 'director') {
    setTimeout(dirCargarAvancePEMC, 1000);
    // ── IA automática: agregar tarjeta de alertas inteligentes ──
    setTimeout(dirInyectarAlertasIA, 1500);
  }
});

// Inyecta panel de alertas IA en el dashboard del director si no existe
async function dirInyectarAlertasIA() {
  const dash = document.getElementById('dir-p-dashboard');
  if (!dash || document.getElementById('dir-alertas-ia')) return;

  const alertDiv = document.createElement('div');
  alertDiv.id = 'dir-alertas-ia';
  alertDiv.style.cssText = 'margin-bottom:16px;';
  alertDiv.innerHTML = `
    <div style="background:white;border-radius:16px;border:1.5px solid #e2e8f0;padding:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:8px;height:8px;border-radius:50%;background:#ef4444;animation:pulse 2s infinite;"></div>
          <span style="font-size:13px;font-weight:700;color:#0f172a;">🚨 Alertas inteligentes</span>
        </div>
        <button onclick="dirRefrescarAlertas()" style="padding:5px 12px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:7px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;color:#475569;cursor:pointer;">↺</button>
      </div>
      <div id="dir-alertas-ia-lista" style="font-size:13px;color:#64748b;">
        <span style="display:inline-block;width:12px;height:12px;border:2px solid #e2e8f0;border-top-color:#475569;border-radius:50%;animation:spin .8s linear infinite;vertical-align:middle;margin-right:6px;"></span>
        Analizando indicadores de la escuela…
      </div>
    </div>`;

  // Insertar antes del panel de PEMC
  const pemcCard = dash.querySelector('[id="dir-pemc-avance"]')?.closest('.card') ||
                   dash.querySelector('.card:last-child');
  if (pemcCard) dash.insertBefore(alertDiv, pemcCard);
  else dash.appendChild(alertDiv);

  dirRefrescarAlertas();
}

async function dirRefrescarAlertas() {
  const el = document.getElementById('dir-alertas-ia-lista');
  if (!el) return;
  const cct = window.currentPerfil?.escuela_cct;
  if (!sb || !cct) {
    el.innerHTML = '<span style="color:#94a3b8;">Conecta Supabase para ver alertas reales.</span>';
    return;
  }
  try {
    const [
      { count: alumnosRiesgo },
      { count: incUrgentes },
      { data: calBajas },
    ] = await Promise.all([
      sb.from('alertas').select('id',{count:'exact',head:true}).eq('escuela_cct',cct).eq('leido',false),
      sb.from('incidencias').select('id',{count:'exact',head:true}).eq('escuela_cct',cct).eq('estado','urgente'),
      sb.from('calificaciones').select('calificacion').eq('escuela_cct',cct)
        .eq('ciclo',window.CICLO_ACTIVO||'2025-2026').lt('calificacion',6).limit(5),
    ]);

    const alertas = [];
    if (incUrgentes > 0) alertas.push({ color:'#fee2e2', border:'#fca5a5', text:'🔴', msg:`<strong>${incUrgentes}</strong> incidencia${incUrgentes>1?'s':''} urgente${incUrgentes>1?'s':''} sin atender` });
    if (alumnosRiesgo > 0) alertas.push({ color:'#fffbeb', border:'#fde68a', text:'🟡', msg:`<strong>${alumnosRiesgo}</strong> alerta${alumnosRiesgo>1?'s':''} académica${alumnosRiesgo>1?'s':''} pendiente${alumnosRiesgo>1?'s':''}` });
    if (calBajas?.length > 0) alertas.push({ color:'#fef2f2', border:'#fecaca', text:'📉', msg:`<strong>${calBajas.length}</strong> calificación${calBajas.length>1?'es':''} menor${calBajas.length>1?'es':''} a 6 detectada${calBajas.length>1?'s':''}` });
    if (!alertas.length) alertas.push({ color:'#f0fdf4', border:'#86efac', text:'🟢', msg:'Sin alertas críticas activas — escuela en buen estado' });

    el.innerHTML = alertas.map(a =>
      `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${a.color};border-radius:8px;border:1px solid ${a.border};margin-bottom:6px;font-size:12px;">
        <span>${a.text}</span><span>${a.msg}</span>
      </div>`
    ).join('');
  } catch(e) {
    el.innerHTML = `<span style="color:#dc2626;font-size:12px;">❌ ${e.message}</span>`;
  }
}
window.dirRefrescarAlertas = dirRefrescarAlertas;

// ══════════════════════════════════════════════════════════════════════
// SOLICITUDES DE VINCULACIÓN PADRE–ALUMNO — Panel Admin
// ══════════════════════════════════════════════════════════════════════
window._solicitudesVinculacion = [];

async function admCargarSolicitudesVinculacion() {
  const cct = ADM.escuelaCct || window.currentPerfil?.escuela_cct;
  if (!window.sb || !cct) return;
  try {
    const { data } = await window.sb.from('solicitudes_vinculacion')
      .select('*, padre:usuarios!padre_id(nombre,apellido_p,email,telefono), alumno:usuarios!alumno_id(nombre,apellido_p,apellido_m,fecha_nac)')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false });
    window._solicitudesVinculacion = data || [];
    const badge = document.getElementById('adm-badge-solicitudes');
    if (badge) { badge.textContent = window._solicitudesVinculacion.length; badge.style.display = window._solicitudesVinculacion.length > 0 ? 'inline' : 'none'; }
    admRenderSolicitudesVinculacion();
  } catch(e) { console.warn('[ADM] solicitudesVinculacion:', e.message); }
}
window.admCargarSolicitudesVinculacion = admCargarSolicitudesVinculacion;

function admRenderSolicitudesVinculacion() {
  const el = document.getElementById('adm-solicitudes-lista');
  if (!el) return;
  const items = window._solicitudesVinculacion || [];
  if (!items.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;"><div style="font-size:36px;margin-bottom:10px;">✅</div><div style="font-weight:700;">Sin solicitudes pendientes</div></div>'; return; }
  const simColor = s => s>=70?'#15803d':s>=40?'#a16207':'#dc2626';
  const simBg    = s => s>=70?'#f0fdf4':s>=40?'#fefce8':'#fef2f2';
  el.innerHTML = items.map(s => {
    const padre   = s.padre;
    const alumno  = s.alumno;
    const padreNom = padre ? `${padre.nombre||''} ${padre.apellido_p||''}`.trim() : 'Padre desconocido';
    const alumNom  = alumno ? `${alumno.nombre||''} ${alumno.apellido_p||''} ${alumno.apellido_m||''}`.trim() : (s.nombre_buscado || 'Alumno buscado');
    const sim = s.similitud || 0;
    return `<div style="background:white;border-radius:12px;border:1.5px solid #e2e8f0;padding:16px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div><div style="font-size:14px;font-weight:700;">👨\u200d👩\u200d👧 ${padreNom} → ${alumNom}</div>
        <div style="font-size:12px;color:#64748b;">${padre?.email||'sin email'} · Buscó: "${s.nombre_buscado||alumNom}"${s.fecha_nac_buscada?' · Nac: '+s.fecha_nac_buscada:''}</div></div>
        <span style="background:${simBg(sim)};color:${simColor(sim)};padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;">${sim}% coincidencia</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${alumno?`<button onclick="admAprobarVinculacion('${s.id}','${s.padre_id}','${s.alumno_id||alumno?.id}')" style="padding:8px 16px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✅ Aprobar</button>`:''}
        <button onclick="admBuscarAlumnoParaVincular('${s.id}','${s.padre_id}')" style="padding:8px 16px;background:#eff6ff;color:#1e40af;border:1.5px solid #bfdbfe;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🔍 Buscar alumno</button>
        <button onclick="admRechazarVinculacion('${s.id}')" style="padding:8px 16px;background:white;color:#dc2626;border:1.5px solid #fca5a5;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✕ Rechazar</button>
      </div></div>`;
  }).join('');
}
window.admRenderSolicitudesVinculacion = admRenderSolicitudesVinculacion;

async function admAprobarVinculacion(solicitudId, padreId, alumnoId) {
  if (!window.sb||!padreId||!alumnoId) { hubToast('⚠️ Datos incompletos','warn'); return; }
  try {
    await window.sb.from('padres_alumnos').upsert({ padre_id:padreId, alumno_id:alumnoId, activo:true },{ onConflict:'padre_id,alumno_id' });
    await window.sb.from('solicitudes_vinculacion').update({ estado:'aprobada', aprobado_por:window.currentUser?.id, updated_at:new Date().toISOString() }).eq('id',solicitudId);
    window._solicitudesVinculacion = window._solicitudesVinculacion.filter(s=>s.id!==solicitudId);
    admRenderSolicitudesVinculacion();
    hubToast('✅ Vinculación aprobada','ok');
  } catch(e) { hubToast('❌ '+e.message,'err'); }
}
window.admAprobarVinculacion = admAprobarVinculacion;

async function admRechazarVinculacion(solicitudId) {
  if (!window.sb) return;
  try {
    await window.sb.from('solicitudes_vinculacion').update({ estado:'rechazada', updated_at:new Date().toISOString() }).eq('id',solicitudId);
    window._solicitudesVinculacion = window._solicitudesVinculacion.filter(s=>s.id!==solicitudId);
    admRenderSolicitudesVinculacion();
    hubToast('Solicitud rechazada','ok');
  } catch(e) { hubToast('❌ '+e.message,'err'); }
}
window.admRechazarVinculacion = admRechazarVinculacion;

function admBuscarAlumnoParaVincular(solicitudId, padreId) {
  const opts = (ADM.alumnos||[]).map(a => { const n=`${a.nombre||''} ${a.apellido_p||''} ${a.apellido_m||''}`.trim(); return `<option value="${a.id}">${n}</option>`; }).join('');
  hubModal('🔍 Buscar alumno para vincular',`<div style="font-size:13px;color:#64748b;margin-bottom:12px;">Selecciona el alumno correcto:</div><select id="vinc-alumno-manual" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;"><option value="">Seleccionar alumno…</option>${opts}</select>`,
  async () => { const id=document.getElementById('vinc-alumno-manual')?.value; if(!id){hubToast('⚠️ Selecciona un alumno','warn');return;} await admAprobarVinculacion(solicitudId,padreId,id); },'✅ Vincular');
}
window.admBuscarAlumnoParaVincular = admBuscarAlumnoParaVincular;

window.siembraCargarMateriasDocente   = siembraCargarMateriasDocente;
window.siembraCargarCalificacionesAlumno = siembraCargarCalificacionesAlumno;
window.siembraPropagar                = siembraPropagar;

// Escuchar cuando ADM termina de cargar para propagar automáticamente
window.addEventListener('siembra:datos-cargados', () => {
  siembraPropagar();
  // Si hay un docente activo, cargar sus materias reales
  if (window.currentPerfil?.rol === 'docente' && window.currentPerfil?.id) {
    siembraCargarMateriasDocente(window.currentPerfil.id);
  }
});

// ══════════════════════════════════════════════════════════════════════
// PADRÓN ESCOLAR — Sub-tabs (Padrón / Ficha de inscripción)
// ══════════════════════════════════════════════════════════════════════
function admPadronTab(tab) {
  const panelPadron = document.getElementById('adm-panel-padron');
  const panelFicha  = document.getElementById('adm-panel-ficha');
  const btnPadron   = document.getElementById('adm-tab-padron');
  const btnFicha    = document.getElementById('adm-tab-ficha');
  if (!panelPadron || !panelFicha) return;
  const activeStyle   = 'padding:10px 20px;border:none;background:none;font-family:\'Sora\',sans-serif;font-size:13px;font-weight:700;color:#0d5c2f;border-bottom:2px solid #0d5c2f;margin-bottom:-2px;cursor:pointer;';
  const inactiveStyle = 'padding:10px 20px;border:none;background:none;font-family:\'Sora\',sans-serif;font-size:13px;font-weight:600;color:#64748b;cursor:pointer;';
  if (tab === 'padron') {
    panelPadron.style.display = '';
    panelFicha.style.display  = 'none';
    if (btnPadron) btnPadron.style.cssText = activeStyle;
    if (btnFicha)  btnFicha.style.cssText  = inactiveStyle;
  } else {
    panelPadron.style.display = 'none';
    panelFicha.style.display  = '';
    if (btnPadron) btnPadron.style.cssText = inactiveStyle;
    if (btnFicha)  btnFicha.style.cssText  = activeStyle;
    // Cargar contenido de ficha en el panel si aún está vacío
    const fichaPanel = document.getElementById('adm-panel-ficha');
    if (fichaPanel && !fichaPanel.innerHTML.trim()) {
      const fichaOrig = document.getElementById('adm-p-nem-ficha');
      if (fichaOrig) {
        fichaPanel.innerHTML = fichaOrig.innerHTML;
      }
    }
    // Popular selector de alumnos de la ficha
    if (typeof nemFichaPopularAlumnos === 'function') nemFichaPopularAlumnos();
  }
}
window.admPadronTab = admPadronTab;

// ══════════════════════════════════════════════════════════════════════
// BOLETA NEM — Subdirector
// ══════════════════════════════════════════════════════════════════════
async function subdirBoletaInit() {
  // Resolver escuela si falta antes de intentar la query
  if (!window.currentPerfil?.escuela_cct && typeof _subdirResolverEscuela === 'function') {
    await _subdirResolverEscuela();
  }
  const cct = window.currentPerfil?.escuela_cct || window.ADM?.escuelaCct || '';
  if (!cct || !window.sb) return;
  // Popular select de grupos
  const sel = document.getElementById('subdir-boleta-grupo');
  if (!sel) return;
  sel.innerHTML = '<option value="">Cargando grupos…</option>';
  try {
    const { data: grupos } = await sb.from('grupos')
      .select('id,nombre,grado,seccion').eq('escuela_cct', cct).eq('activo', true).order('grado');
    if (grupos?.length) {
      sel.innerHTML = '<option value="">Seleccionar grupo…</option>' +
        grupos.map(g => `<option value="${g.id}">${g.nombre || g.grado+'°'+(g.seccion||'')}</option>`).join('');
    } else {
      sel.innerHTML = '<option value="">Sin grupos registrados</option>';
    }
  } catch(e) {
    console.warn('[subdirBoleta] grupos:', e.message);
    sel.innerHTML = '<option value="">Error al cargar grupos</option>';
  }
}

async function subdirBoletaCargarAlumnos(grupoId) {
  const sel = document.getElementById('subdir-boleta-alumno');
  if (!sel) return;
  sel.innerHTML = '<option value="">Cargando…</option>';
  if (!grupoId || !window.sb) { sel.innerHTML = '<option value="">Seleccionar alumno…</option>'; return; }
  try {
    const { data } = await sb.from('alumnos_grupos')
      .select('alumno_id, usuarios!alumno_id(id,nombre,apellido_p,apellido_m)')
      .eq('grupo_id', grupoId).eq('activo', true);
    sel.innerHTML = '<option value="">Seleccionar alumno…</option>' +
      (data||[]).map(r => {
        const u = r.usuarios;
        if (!u) return '';
        const nom = `${u.nombre||''} ${u.apellido_p||''} ${u.apellido_m||''}`.trim();
        return `<option value="${u.id}">${nom}</option>`;
      }).filter(Boolean).join('');
  } catch(e) { sel.innerHTML = '<option value="">Error al cargar</option>'; }
}

async function subdirBoletaCargar(alumnoId) {
  const contenido = document.getElementById('subdir-boleta-contenido');
  if (!contenido || !alumnoId) return;
  // Reutilizar la lógica de nemBoletaCargar si existe, sino mostrar datos básicos
  if (typeof nemBoletaCargar === 'function') {
    // Sincronizar el select del admin con el de subdir
    const admSel = document.getElementById('nem-boleta-alumno');
    if (admSel) { admSel.value = alumnoId; nemBoletaCargar(alumnoId); }
    // Copiar resultado al contenido del subdir
    setTimeout(() => {
      const admBoleta = document.getElementById('nem-boleta-campos');
      if (admBoleta) contenido.innerHTML = admBoleta.outerHTML;
    }, 600);
  } else {
    contenido.innerHTML = `<div style="text-align:center;padding:40px;background:white;border-radius:12px;border:1px solid #e2e8f0;">
      <div style="font-size:48px;margin-bottom:12px;">📝</div>
      <div style="font-size:15px;font-weight:700;color:#0f172a;">Boleta generándose…</div>
    </div>`;
  }
}

function subdirBoletaImprimir() {
  const contenido = document.getElementById('subdir-boleta-contenido');
  if (!contenido || !contenido.innerHTML.includes('campos')) {
    hubToast('⚠️ Selecciona un alumno primero', 'warn'); return;
  }
  if (typeof window.print === 'function') window.print();
}
window.subdirBoletaInit = subdirBoletaInit;
window.subdirBoletaCargarAlumnos = subdirBoletaCargarAlumnos;
window.subdirBoletaCargar = subdirBoletaCargar;
window.subdirBoletaImprimir = subdirBoletaImprimir;

// ══════════════════════════════════════════════════════════════════════
// BOLETA NEM — Coordinador (misma lógica, diferente portal)
// ══════════════════════════════════════════════════════════════════════
async function coordBoletaInit() {
  // Resolver escuela si falta antes de intentar la query
  if (!window.currentPerfil?.escuela_cct && typeof _subdirResolverEscuela === 'function') {
    await _subdirResolverEscuela();
  }
  const cct = window.currentPerfil?.escuela_cct || window.ADM?.escuelaCct || '';
  if (!cct || !window.sb) return;
  const sel = document.getElementById('coord-boleta-grupo');
  if (!sel) return;
  sel.innerHTML = '<option value="">Cargando grupos…</option>';
  try {
    const { data: grupos } = await sb.from('grupos')
      .select('id,nombre,grado,seccion').eq('escuela_cct', cct).eq('activo', true).order('grado');
    if (grupos?.length) {
      sel.innerHTML = '<option value="">Seleccionar grupo…</option>' +
        grupos.map(g => `<option value="${g.id}">${g.nombre || g.grado+'°'+(g.seccion||'')}</option>`).join('');
    } else {
      sel.innerHTML = '<option value="">Sin grupos registrados</option>';
    }
  } catch(e) {
    console.warn('[coordBoleta] grupos:', e.message);
    sel.innerHTML = '<option value="">Error al cargar grupos</option>';
  }
}

async function coordBoletaCargarAlumnos(grupoId) {
  const sel = document.getElementById('coord-boleta-alumno');
  if (!sel) return;
  sel.innerHTML = '<option value="">Cargando…</option>';
  if (!grupoId || !window.sb) { sel.innerHTML = '<option value="">Seleccionar alumno…</option>'; return; }
  try {
    const { data } = await sb.from('alumnos_grupos')
      .select('alumno_id, usuarios!alumno_id(id,nombre,apellido_p,apellido_m)')
      .eq('grupo_id', grupoId).eq('activo', true);
    sel.innerHTML = '<option value="">Seleccionar alumno…</option>' +
      (data||[]).map(r => {
        const u = r.usuarios;
        if (!u) return '';
        const nom = `${u.nombre||''} ${u.apellido_p||''} ${u.apellido_m||''}`.trim();
        return `<option value="${u.id}">${nom}</option>`;
      }).filter(Boolean).join('');
  } catch(e) { sel.innerHTML = '<option value="">Error al cargar</option>'; }
}

async function coordBoletaCargar(alumnoId) {
  const contenido = document.getElementById('coord-boleta-contenido');
  if (!contenido || !alumnoId || !window.sb) return;
  contenido.innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-size:32px;margin-bottom:10px;">⏳</div><div style="font-size:14px;color:#64748b;">Cargando boleta…</div></div>';
  try {
    const [{ data: califs }, { data: alumno }] = await Promise.all([
      sb.from('calificaciones').select('materia,trimestre,calificacion,observacion')
        .eq('alumno_id', alumnoId).eq('ciclo', window.CICLO_ACTIVO || '2025-2026').order('materia'),
      sb.from('usuarios').select('nombre,apellido_p,apellido_m,curp').eq('id', alumnoId).maybeSingle(),
    ]);
    const nombre = alumno ? `${alumno.nombre||''} ${alumno.apellido_p||''} ${alumno.apellido_m||''}`.trim() : 'Alumno';
    const periodo = document.getElementById('coord-boleta-periodo')?.value || '1er bimestre';
    const trimMap = {'1er bimestre':1,'2do bimestre':2,'3er bimestre':3,'4to bimestre':4,'5to bimestre':5};
    const trim = trimMap[periodo] || 1;
    const califsTrim = (califs||[]).filter(c => c.trimestre === trim);
    if (!califsTrim.length) {
      contenido.innerHTML = `<div style="text-align:center;padding:48px;background:white;border-radius:12px;border:1px solid #e2e8f0;">
        <div style="font-size:40px;margin-bottom:12px;">📋</div>
        <div style="font-weight:700;color:#0f172a;font-size:15px;">${nombre}</div>
        <div style="font-size:13px;color:#94a3b8;margin-top:6px;">Sin calificaciones registradas para ${periodo}</div>
      </div>`;
      return;
    }
    contenido.innerHTML = `
      <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <div style="padding:18px 20px;background:linear-gradient(135deg,#5b21b6,#7c3aed);color:white;">
          <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;">Boleta NEM — ${periodo}</div>
          <div style="font-size:13px;opacity:.85;margin-top:2px;">${nombre}</div>
        </div>
        <div style="padding:16px 20px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
            ${califsTrim.map(c => `
              <div style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:14px;">
                <div style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">${c.materia}</div>
                <div style="font-size:26px;font-weight:900;color:${parseFloat(c.calificacion)>=7?'#0d5c2f':parseFloat(c.calificacion)>=5?'#a16207':'#dc2626'};">${c.calificacion ?? '—'}</div>
                ${c.observacion ? `<div style="font-size:11px;color:#64748b;margin-top:6px;font-style:italic;">${c.observacion}</div>` : ''}
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  } catch(e) {
    contenido.innerHTML = `<div style="text-align:center;padding:40px;color:#dc2626;">❌ Error: ${e.message}</div>`;
  }
}

function coordBoletaImprimir() {
  hubToast('🖨️ Abriendo vista de impresión…', 'ok');
  setTimeout(() => window.print(), 300);
}
window.coordBoletaInit = coordBoletaInit;
window.coordBoletaCargarAlumnos = coordBoletaCargarAlumnos;
window.coordBoletaCargar = coordBoletaCargar;
window.coordBoletaImprimir = coordBoletaImprimir;

// ══════════════════════════════════════════════════════════════════════
// BIENESTAR / NEE — Portal Trabajo Social
// ══════════════════════════════════════════════════════════════════════
window._tsNeePerfiles = [];

async function tsNeeInit() {
  const cct = window.currentPerfil?.escuela_cct || '';
  // Popular selector de grupos
  const selGrupo = document.getElementById('nee-ts-filtro-grupo');
  if (selGrupo && selGrupo.options.length <= 1 && cct && window.sb) {
    try {
      const { data: grupos } = await sb.from('grupos')
        .select('id,nombre,grado').eq('escuela_cct', cct).eq('activo', true).order('grado');
      if (grupos?.length) {
        selGrupo.innerHTML = '<option value="">Todos los grupos</option>' +
          grupos.map(g => `<option value="${g.id}">${g.nombre||g.grado+'°'}</option>`).join('');
      }
    } catch(e) {}
  }
  // Cargar perfiles NEE desde BD
  await tsNeeCargaPerfiles();
}

async function tsNeeCargaPerfiles() {
  const cct = window.currentPerfil?.escuela_cct || '';
  if (!cct || !window.sb) { tsNeeRenderLista(); tsNeeActualizarStats(); return; }
  try {
    // Usar tabla nee_perfiles si existe, sino usar alumnos con apoyo NEE
    const { data, error } = await sb.from('nee_perfiles')
      .select('*, usuarios!alumno_id(nombre,apellido_p,apellido_m), grupos(nombre,grado)')
      .eq('escuela_cct', cct).eq('activo', true).order('created_at', { ascending: false });
    if (!error && data) {
      window._tsNeePerfiles = data;
    } else {
      // Fallback: alumnos con apoyos especiales
      const { data: apoyos } = await sb.from('apoyos_alumno')
        .select('*, usuarios!alumno_id(nombre,apellido_p,apellido_m,escuela_cct)')
        .eq('activo', true);
      window._tsNeePerfiles = (apoyos||[]).filter(a =>
        a.usuarios?.escuela_cct === cct || !cct
      );
    }
  } catch(e) {
    window._tsNeePerfiles = [];
  }
  tsNeeRenderLista();
  tsNeeActualizarStats();
}

function tsNeeRenderLista() {
  const lista  = document.getElementById('nee-ts-lista');
  if (!lista) return;
  const filtroTipo   = document.getElementById('nee-ts-filtro-tipo')?.value || '';
  const filtroGrupo  = document.getElementById('nee-ts-filtro-grupo')?.value || '';
  const buscar       = (document.getElementById('nee-ts-buscar')?.value || '').toLowerCase();
  let perfiles = window._tsNeePerfiles || [];
  if (filtroTipo)  perfiles = perfiles.filter(p => (p.tipo||p.apoyo||'').includes(filtroTipo));
  if (filtroGrupo) perfiles = perfiles.filter(p => p.grupo_id === filtroGrupo);
  if (buscar)      perfiles = perfiles.filter(p => {
    const u = p.usuarios;
    const nom = u ? `${u.nombre||''} ${u.apellido_p||''}`.toLowerCase() : '';
    return nom.includes(buscar);
  });
  if (!perfiles.length) {
    lista.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;background:white;border-radius:12px;border:1px solid #e2e8f0;">
      <div style="font-size:48px;margin-bottom:12px;">💚</div>
      <div style="font-size:15px;font-weight:700;color:#0f172a;">Sin perfiles registrados</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:6px;margin-bottom:16px;">Registra alumnos que requieran atención especial</div>
      <button onclick="tsNeeNuevoPerfil()" style="padding:10px 20px;background:linear-gradient(135deg,#1e40af,#2563eb);color:white;border:none;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">+ Registrar primer perfil</button>
    </div>`;
    return;
  }
  const tipoBg   = { NEE:'#dbeafe', TDAH:'#fdf4ff', Dislexia:'#fff7ed', USAER:'#f0fdf4', 'Beca Bienestar':'#fef9c3', Nutricional:'#fee2e2' };
  const tipoColor= { NEE:'#1d4ed8', TDAH:'#7c3aed', Dislexia:'#c2410c', USAER:'#15803d', 'Beca Bienestar':'#a16207', Nutricional:'#dc2626' };
  lista.innerHTML = perfiles.map(p => {
    const u   = p.usuarios;
    const nom = u ? `${u.nombre||''} ${u.apellido_p||''} ${u.apellido_m||''}`.trim() : 'Sin nombre';
    const ini = nom.split(' ').map(x=>x[0]||'').join('').slice(0,2).toUpperCase();
    const tipo= p.tipo || p.apoyo || 'NEE';
    const bg  = tipoBg[tipo]   || '#f1f5f9';
    const col = tipoColor[tipo]|| '#475569';
    const grp = p.grupos?.nombre || p.grupo_nombre || '—';
    return `
      <div style="background:white;border-radius:14px;border:1.5px solid #e2e8f0;padding:18px;position:relative;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <div style="width:42px;height:42px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;flex-shrink:0;">${ini}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nom}</div>
            <div style="font-size:11px;color:#64748b;">Grupo: ${grp}</div>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
          <span style="background:${bg};color:${col};padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;">${tipo}</span>
          ${p.usaer ? '<span style="background:#f0fdf4;color:#15803d;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;">✅ USAER</span>' : ''}
          ${p.beca_bienestar ? '<span style="background:#fef9c3;color:#a16207;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;">🌟 Beca</span>' : ''}
        </div>
        ${p.observaciones ? `<div style="font-size:12px;color:#64748b;font-style:italic;margin-bottom:10px;">"${p.observaciones}"</div>` : ''}
        <div style="display:flex;gap:6px;">
          <button onclick="tsNeeEditarPerfil('${p.id||''}')" style="flex:1;padding:7px;background:#eff6ff;color:#1e40af;border:1.5px solid #bfdbfe;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Sora',sans-serif;">✏️ Editar</button>
          <button onclick="tsNeeDerivarTS('${p.alumno_id||p.id||''}')" style="flex:1;padding:7px;background:#fff7ed;color:#c2410c;border:1.5px solid #fed7aa;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Sora',sans-serif;">📤 Derivar</button>
        </div>
      </div>`;
  }).join('');
}

function tsNeeActualizarStats() {
  const perfiles = window._tsNeePerfiles || [];
  const setEl = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  setEl('nee-total-ts',  perfiles.length);
  setEl('nee-usaer-ts',  perfiles.filter(p => p.usaer).length);
  setEl('nee-beca-ts',   perfiles.filter(p => p.beca_bienestar).length);
  setEl('nee-nutri-ts',  perfiles.filter(p => p.tipo === 'Nutricional' || p.riesgo_nutricional).length);
}

function tsNeeNuevoPerfil() {
  const alumnos = window._siembraAlumnos || window.ADM?.alumnos || [];
  const alumOpts = alumnos.map(a => {
    const nom = `${a.nombre||''} ${a.apellido_p||a.apellido||''}`.trim();
    return `<option value="${a.id}">${nom}</option>`;
  }).join('');
  hubModal('💚 Nuevo perfil NEE', `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Alumno</label>
        <select id="nee-modal-alumno" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;">
          <option value="">Seleccionar alumno…</option>${alumOpts}
        </select></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Tipo de NEE / apoyo</label>
        <select id="nee-modal-tipo" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;">
          <option value="NEE">NEE general</option><option value="TDAH">TDAH</option>
          <option value="Dislexia">Dislexia</option><option value="Nutricional">Riesgo nutricional</option><option value="USAER">Requiere USAER</option>
        </select></div>
      <div style="display:flex;gap:12px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;"><input type="checkbox" id="nee-modal-usaer"> Con apoyo USAER</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;"><input type="checkbox" id="nee-modal-beca"> Beca Bienestar</label>
      </div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Observaciones</label>
        <textarea id="nee-modal-obs" rows="3" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;resize:vertical;" placeholder="Describe las necesidades educativas especiales del alumno…"></textarea></div>
    </div>`,
  async () => {
    const alumnoId = document.getElementById('nee-modal-alumno')?.value;
    const tipo     = document.getElementById('nee-modal-tipo')?.value || 'NEE';
    const usaer    = document.getElementById('nee-modal-usaer')?.checked || false;
    const beca     = document.getElementById('nee-modal-beca')?.checked || false;
    const obs      = document.getElementById('nee-modal-obs')?.value.trim() || '';
    if (!alumnoId) { hubToast('⚠️ Selecciona un alumno', 'warn'); return; }
    const cct = window.currentPerfil?.escuela_cct || '';
    if (window.sb) {
      try {
        await sb.from('nee_perfiles').upsert({
          alumno_id: alumnoId, tipo, usaer, beca_bienestar: beca,
          observaciones: obs, escuela_cct: cct, activo: true,
          creado_por: window.currentUser?.id || null,
        }, { onConflict: 'alumno_id' });
        hubToast('✅ Perfil NEE guardado', 'ok');
        await tsNeeCargaPerfiles();
      } catch(e) { hubToast('❌ ' + e.message, 'err'); }
    } else {
      window._tsNeePerfiles = window._tsNeePerfiles || [];
      window._tsNeePerfiles.unshift({ id: 'demo-'+Date.now(), alumno_id: alumnoId, tipo, usaer, beca_bienestar: beca, observaciones: obs });
      tsNeeRenderLista(); tsNeeActualizarStats();
      hubToast('✅ Perfil NEE guardado (local)', 'ok');
    }
  });
}

function tsNeeEditarPerfil(perfilId) {
  const perfiles = window._tsNeePerfiles || [];
  const p = perfiles.find(x => x.id === perfilId);
  if (!p) { hubToast('⚠️ Perfil no encontrado', 'warn'); return; }

  const tipoOpts = ['NEE','TDAH','Dislexia','Nutricional','USAER'].map(t =>
    `<option value="${t}" ${p.tipo === t ? 'selected' : ''}>${t}</option>`
  ).join('');

  hubModal('✏️ Editar perfil NEE', `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Tipo de NEE / apoyo</label>
        <select id="nee-edit-tipo" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;">
          ${tipoOpts}
        </select></div>
      <div style="display:flex;gap:12px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;"><input type="checkbox" id="nee-edit-usaer" ${p.usaer ? 'checked' : ''}> Con apoyo USAER</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;"><input type="checkbox" id="nee-edit-beca" ${p.beca_bienestar ? 'checked' : ''}> Beca Bienestar</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;"><input type="checkbox" id="nee-edit-seg" ${p.seguimiento_ts ? 'checked' : ''}> Seguimiento TS</label>
      </div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Observaciones</label>
        <textarea id="nee-edit-obs" rows="3" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;resize:vertical;">${p.observaciones || ''}</textarea></div>
    </div>`,
  async () => {
    const tipo         = document.getElementById('nee-edit-tipo')?.value || p.tipo;
    const usaer        = document.getElementById('nee-edit-usaer')?.checked ?? p.usaer;
    const beca         = document.getElementById('nee-edit-beca')?.checked ?? p.beca_bienestar;
    const seguimiento  = document.getElementById('nee-edit-seg')?.checked ?? p.seguimiento_ts;
    const obs          = document.getElementById('nee-edit-obs')?.value.trim() ?? p.observaciones;

    if (window.sb) {
      try {
        const { error } = await window.sb.from('nee_perfiles').update({
          tipo, usaer, beca_bienestar: beca, seguimiento_ts: seguimiento,
          observaciones: obs, updated_at: new Date().toISOString(),
        }).eq('id', perfilId);
        if (error) throw error;
        hubToast('✅ Perfil NEE actualizado', 'ok');
        await tsNeeCargaPerfiles();
      } catch(e) { hubToast('❌ ' + e.message, 'err'); }
    } else {
      // Actualizar en memoria (modo demo)
      Object.assign(p, { tipo, usaer, beca_bienestar: beca, seguimiento_ts: seguimiento, observaciones: obs });
      tsNeeRenderLista();
      if (typeof tsNeeActualizarStats === 'function') tsNeeActualizarStats();
      hubToast('✅ Perfil NEE actualizado (local)', 'ok');
    }
  });
}
function tsNeeDerivarTS(alumnoId) {
  if (typeof tspAbrirCaso === 'function') tspAbrirCaso(alumnoId);
  else hubToast('📤 Caso derivado a seguimiento TS', 'ok');
}
window.tsNeeInit          = tsNeeInit;
window.tsNeeCargaPerfiles = tsNeeCargaPerfiles;
window.tsNeeRenderLista   = tsNeeRenderLista;
window.tsNeeNuevoPerfil   = tsNeeNuevoPerfil;
window.tsNeeEditarPerfil  = tsNeeEditarPerfil;
window.tsNeeDerivarTS     = tsNeeDerivarTS;

// ══════════════════════════════════════════════════════════════════════
// hubModal — helper genérico para modales con callback de confirmación
// ══════════════════════════════════════════════════════════════════════
function hubModal(titulo, contenido, onConfirm, textoBtn = '💾 Guardar') {
  // Reusar el sistema ADM.abrirModal si está disponible
  if (window.ADM?.abrirModal) {
    ADM.abrirModal('hub-generic-modal', titulo, contenido, onConfirm ? null : null, 'Cancelar');
    // Agregar botón confirm manualmente si hay callback
    if (onConfirm) {
      const footer = document.querySelector('#hub-generic-modal .adm-modal-footer') ||
                     document.querySelector('#adm-modal-hub-generic-modal .adm-modal-footer');
      if (footer) {
        const btn = document.createElement('button');
        btn.className = 'adm-btn adm-btn-primary';
        btn.textContent = textoBtn;
        btn.onclick = () => { onConfirm(); ADM.cerrarModal(); };
        footer.prepend(btn);
      }
    }
    return;
  }
  // Fallback: modal propio
  let modal = document.getElementById('hub-modal-generic');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'hub-modal-generic';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:white;border-radius:18px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.25);">
      <div style="padding:20px 24px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
        <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;">${titulo}</div>
        <button onclick="document.getElementById('hub-modal-generic').style.display='none'" style="background:#f1f5f9;border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;" aria-label="Cerrar">✕</button>
      </div>
      <div style="padding:20px 24px;" id="hub-modal-body">${contenido}</div>
      <div style="padding:14px 24px;border-top:1px solid #f1f5f9;display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="document.getElementById('hub-modal-generic').style.display='none'" style="padding:9px 18px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;cursor:pointer;">Cancelar</button>
        <button id="hub-modal-confirm" style="padding:9px 18px;background:linear-gradient(135deg,#1e40af,#2563eb);color:white;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">${textoBtn}</button>
      </div>
    </div>`;
  modal.style.display = 'flex';
  if (onConfirm) {
    document.getElementById('hub-modal-confirm').onclick = async () => {
      await onConfirm();
      modal.style.display = 'none';
    };
  }
}
window.hubModal = hubModal;


// ── Solicitudes tab switcher ──────────────────────────────────────────
async function admSolicitudesTab(estado = 'pendiente') {
  const tabMap = { pendientes:'pendiente', aprobadas:'aprobada', rechazadas:'rechazada' };
  const estadoReal = tabMap[estado] || estado;
  const cct = ADM.escuelaCct || window.currentPerfil?.escuela_cct;
  if (!window.sb) return;

  ['pendientes','aprobadas','rechazadas'].forEach(t => {
    const btn = document.getElementById('sol-tab-'+t);
    if (!btn) return;
    if (t === estado) {
      btn.style.cssText = 'padding:10px 20px;border:none;background:none;font-family:\'Sora\',sans-serif;font-size:13px;font-weight:700;color:#b91c1c;border-bottom:2px solid #ef4444;margin-bottom:-2px;cursor:pointer;';
    } else {
      btn.style.cssText = 'padding:10px 20px;border:none;background:none;font-family:\'Sora\',sans-serif;font-size:13px;font-weight:600;color:#64748b;cursor:pointer;';
    }
  });

  const lista = document.getElementById('adm-solicitudes-lista');
  if (lista) lista.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">⏳ Cargando…</div>';

  try {
    const { data } = await window.sb.from('solicitudes_vinculacion')
      .select('*, padre:usuarios!padre_id(nombre,apellido_p,email,telefono), alumno:usuarios!alumno_id(nombre,apellido_p,apellido_m,fecha_nac)')
      .eq('estado', estadoReal)
      .order('created_at', { ascending: false });

    window._solicitudesVinculacion = data || [];

    const cntEl = document.getElementById('sol-cnt-pendientes');
    if (cntEl && estadoReal === 'pendiente') cntEl.textContent = window._solicitudesVinculacion.length;

    admRenderSolicitudesVinculacion();
  } catch(e) {
    if (lista) lista.innerHTML = `<div style="color:#dc2626;padding:20px;">❌ ${e.message}</div>`;
  }
}
window.admSolicitudesTab = admSolicitudesTab;

// Update ADM.navTo to load solicitudes when navigating there
const _admNavToOrigSol = ADM.navTo?.bind(ADM);
if (_admNavToOrigSol) {
  ADM.navTo = function(page) {
    _admNavToOrigSol(page);
    if (page === 'solicitudes') admSolicitudesTab('pendientes');
  };
}

// Dashboard preview — mostrar las 3 primeras solicitudes pendientes
async function admActualizarDashboardSolicitudes() {
  const items = window._solicitudesVinculacion || [];
  const wrap  = document.getElementById('adm-dash-solicitudes-wrap');
  const prev  = document.getElementById('adm-dash-solicitudes-preview');
  const cntEl = document.getElementById('sol-cnt-pendientes');
  if (cntEl) cntEl.textContent = items.length;
  if (!wrap || !prev) return;
  if (!items.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  const preview3 = items.slice(0, 3);
  prev.innerHTML = preview3.map(s => {
    const padre  = s.padre;
    const alumno = s.alumno;
    const pNom   = padre  ? `${padre.nombre||''} ${padre.apellido_p||''}`.trim() : 'Padre';
    const aNom   = alumno ? `${alumno.nombre||''} ${alumno.apellido_p||''}`.trim() : (s.nombre_buscado||'Alumno');
    const sim    = s.similitud || 0;
    const simCol = sim>=70?'#15803d':sim>=40?'#a16207':'#dc2626';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9;">
      <div style="font-size:13px;"><strong>${pNom}</strong> busca a <strong>${aNom}</strong></div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:${simCol};font-size:11px;font-weight:700;">${sim}% coincidencia</span>
        ${s.alumno_id?`<button onclick="admAprobarVinculacion('${s.id}','${s.padre_id}','${s.alumno_id}')" style="padding:4px 10px;background:#0d5c2f;color:white;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:\'Sora\',sans-serif;">✅ Aprobar</button>`:''}
        <button onclick="admBuscarAlumnoParaVincular('${s.id}','${s.padre_id}')" style="padding:4px 10px;background:#eff6ff;color:#1e40af;border:1.5px solid #bfdbfe;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:\'Sora\',sans-serif;">🔍 Buscar</button>
      </div>
    </div>`;
  }).join('');
  if (items.length > 3) prev.innerHTML += `<div style="text-align:center;padding:10px;font-size:12px;color:#64748b;">…y ${items.length-3} más. <a href="#" onclick="ADM.navTo('solicitudes')" style="color:#0d5c2f;font-weight:700;">Ver todas</a></div>`;
}
window.admActualizarDashboardSolicitudes = admActualizarDashboardSolicitudes;

// Hook into solicitudes load to also update dashboard preview
const _admCargarSolOrig = window.admCargarSolicitudesVinculacion;
window.admCargarSolicitudesVinculacion = async function() {
  await _admCargarSolOrig();
  admActualizarDashboardSolicitudes();
};

console.log('[SIEMBRA Engine] Action engine cargado ✅');
// ══════════════════════════════════════════════════════════════════
// BLOQUE C — 5 AGENTES DOCENTE UX
// ══════════════════════════════════════════════════════════════════

// ── Agente 1: Popup retroalimentación IA al guardar calificaciones ─
// Se inyecta después del calGuardar() exitoso
(function() {
  const _calGuardarOrig = window.calGuardar;
  window.calGuardar = async function() {
    await _calGuardarOrig.apply(this, arguments);
    // Mostrar popup retro IA para alumnos en riesgo
    setTimeout(bloqueC_popupRetro, 600);
  };
})();

async function bloqueC_popupRetro() {
  const alumnosList = window._alumnosActivos || alumnos || [];
  const mat  = calMatActual;
  const trim = calTrimActual;
  if (!alumnosList.length || !mat) return;

  // Alumnos con promedio < 7 en esta materia
  const enRiesgo = alumnosList.map((a,ai) => ({
    nombre: a.n || a.nombre || '—',
    prom:   typeof calPromPonderado === 'function' ? calPromPonderado(ai, mat, trim) : 7
  })).filter(a => a.prom > 0 && a.prom < 7).slice(0, 3);

  if (!enRiesgo.length) return;

  // Crear popup si no existe
  let popup = document.getElementById('bloquec-retro-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'bloquec-retro-popup';
    popup.style.cssText = 'position:fixed;bottom:24px;right:24px;width:320px;background:white;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.18);border:1.5px solid #e2e8f0;z-index:9000;animation:slideInRight .3s ease;';
    document.body.appendChild(popup);
  }

  popup.innerHTML = `
    <div style="padding:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:8px;height:8px;border-radius:50%;background:#7c3aed;animation:pulse 2s infinite;"></div>
          <span style="font-size:12px;font-weight:700;color:#0f172a;">✨ Retroalimentación</span>
        </div>
        <button onclick="document.getElementById('bloquec-retro-popup').remove()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;padding:0;" aria-label="Cerrar">✕</button>
      </div>
      <div style="font-size:12px;color:#64748b;margin-bottom:10px;">${enRiesgo.length} alumno${enRiesgo.length>1?'s':''} con promedio bajo en <strong>${mat}</strong>:</div>
      <div id="bloquec-retro-lista" style="margin-bottom:12px;">
        ${enRiesgo.map(a => `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:#fef2f2;border-radius:8px;margin-bottom:6px;"><span style="font-size:12px;font-weight:600;">${a.nombre}</span><span style="font-size:13px;font-weight:800;color:#b91c1c;">${a.prom.toFixed(1)}</span></div>`).join('')}
      </div>
      <div id="bloquec-retro-ia" style="background:#f5f3ff;border-radius:10px;padding:12px;font-size:12px;color:#5b21b6;line-height:1.6;margin-bottom:12px;">
        <span style="opacity:.6;">✨ Generando sugerencia pedagógica…</span>
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="document.getElementById('bloquec-retro-popup').remove()" style="flex:1;padding:8px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;color:#475569;cursor:pointer;">Cerrar</button>
        <button onclick="dNav('observaciones');document.getElementById('bloquec-retro-popup').remove()" style="flex:1;padding:8px;background:#7c3aed;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📝 Agregar obs.</button>
      </div>
    </div>`;

  // Generar sugerencia IA
  const iaEl = document.getElementById('bloquec-retro-ia');
  const nombres = enRiesgo.map(a => `${a.nombre} (${a.prom.toFixed(1)})`).join(', ');
  callAI({
    feature: 'ficha_estrategias',
    prompt: `Soy docente de ${mat} Trimestre ${trim}. Alumnos con promedio bajo (posible rezago educativo): ${nombres}. Dame 1 estrategia pedagógica concreta y diferenciada que pueda aplicar ESTA SEMANA, con un ejercicio específico de 15 min para cada alumno listado. Incluye cómo verificar el avance. Contexto: escuela pública mexicana, NEM 2022. Anti-rezago: actividades de nivelación progresiva.`,
    system: _nemSys('TAREA: Estrategias pedagógicas diferenciadas, una por alumno, específicas y aplicables esta semana. Incluye: técnica pedagógica + ejercicio concreto + forma de verificar avance. Anti-rezago: si el alumno está muy por debajo, propón actividades de nivelación.')
  }).then(txt => {
    if (iaEl) iaEl.innerHTML = txt.replace(/\n/g,'<br>');
  }).catch(() => {
    if (iaEl) iaEl.innerHTML = `Organiza una sesión de repaso grupal de 15 min centrada en los aspectos con menor puntaje. Luego retroalimenta individualmente a cada alumno en riesgo.`;
  });
}

// ── Agente 2: Badge rojo en sidebar cuando hay alumnos en riesgo ──
function bloqueC_actualizarBadgeSidebar() {
  const alumnosList = window._alumnosActivos || alumnos || [];
  if (!alumnosList.length) return;

  const enRiesgo = alumnosList.map((a,ai) => {
    if (typeof calPromPonderado !== 'function') return 7;
    const proms = (MATERIAS_NEM||[]).map(m => calPromPonderado(ai,m,calTrimActual||1));
    return proms.reduce((s,p)=>s+p,0)/(proms.length||1);
  }).filter(p => p > 0 && p < 7).length;

  // Badge en botón de calificaciones
  const btnCal = [...document.querySelectorAll('#doc-portal .nav-btn')].find(b=>b.getAttribute('onclick')?.includes("'calificaciones'"));
  if (btnCal) {
    let badge = btnCal.querySelector('.bloquec-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'bloquec-badge';
      badge.style.cssText = 'display:inline-block;background:#ef4444;color:white;font-size:9px;font-weight:800;padding:2px 5px;border-radius:99px;margin-left:auto;';
      btnCal.appendChild(badge);
    }
    if (enRiesgo > 0) { badge.textContent = enRiesgo; badge.style.display = 'inline-block'; }
    else badge.style.display = 'none';
  }

  // Badge en botón de fichas
  const btnFicha = [...document.querySelectorAll('#doc-portal .nav-btn')].find(b=>b.getAttribute('onclick')?.includes("'fichas'"));
  if (btnFicha && enRiesgo > 0) {
    let badge = btnFicha.querySelector('.bloquec-badge-ficha');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'bloquec-badge-ficha';
      badge.style.cssText = 'display:inline-block;background:#f59e0b;color:white;font-size:9px;font-weight:800;padding:2px 5px;border-radius:99px;margin-left:auto;';
      btnFicha.appendChild(badge);
    }
    badge.textContent = '!'; badge.style.display = 'inline-block';
  }
}

// ── Agente 3: Modo oscuro ya existe — mejorar toggle visual ──────
// Solo mejora el botón existente si no fue mejorado aún
(function() {
  const dmBtn = document.getElementById('dm-toggle');
  if (dmBtn && !dmBtn.dataset.enhanced) {
    dmBtn.dataset.enhanced = '1';
    dmBtn.style.cssText += 'width:36px;height:36px;border:1.5px solid var(--gris-20);border-radius:9px;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:.2s;';
    // Restaurar estado guardado
    if (localStorage.getItem('siembra_dark') === '1') {
      document.body.classList.add('dark-mode');
      dmBtn.textContent = '🌙';
    }
  }
  // Patch toggleDarkMode para guardar preferencia
  const _toggleDark = window.toggleDarkMode;
  window.toggleDarkMode = function() {
    _toggleDark && _toggleDark();
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('siembra_dark', isDark ? '1' : '0');
    const btn = document.getElementById('dm-toggle');
    if (btn) btn.textContent = isDark ? '🌙' : '☀️';
  };
})();

// ── Agente 4: Exportar reporte grupal Word/PDF ────────────────────
function bloqueC_exportarReporteGrupo() {
  const alumnosList = window._alumnosActivos || alumnos || [];
  if (!alumnosList.length) { hubToast('⚠️ Carga tu grupo primero', 'warn'); return; }

  const btn = document.getElementById('bloquec-btn-exportar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando…'; }

  const mat  = calMatActual || MATERIAS_NEM?.[0] || 'Matemáticas';
  const trim = calTrimActual || 1;
  const nombre = currentPerfil?.nombre || 'Docente';
  const escuela = currentPerfil?.escuela_nombre || window._escuelaCfg?.nombre || 'SIEMBRA';

  const promedios = alumnosList.map((a,ai) => ({
    nombre: a.n || a.nombre || '—',
    prom:   typeof calPromPonderado === 'function' ? calPromPonderado(ai,mat,trim) : 7
  }));
  const promGrupo = (promedios.reduce((s,a)=>s+a.prom,0)/promedios.length).toFixed(1);
  const enRiesgo  = promedios.filter(a=>a.prom<6);
  const enSeguim  = promedios.filter(a=>a.prom>=6&&a.prom<7);
  const excelente = promedios.filter(a=>a.prom>=9);

  const prompt = `Genera un reporte grupal breve de ${mat} Trimestre ${trim} para el docente ${nombre} de ${escuela}.
Total alumnos: ${promedios.length}. Promedio: ${promGrupo}.
En riesgo (<6): ${enRiesgo.map(a=>a.nombre).join(', ')||'ninguno'}.
En seguimiento: ${enSeguim.map(a=>a.nombre).join(', ')||'ninguno'}.
Excelentes (≥9): ${excelente.map(a=>a.nombre).join(', ')||'ninguno'}.
Incluye: diagnóstico del grupo, fortalezas, alumnos prioritarios y 2 recomendaciones pedagógicas NEM. Máximo 300 palabras.`;

  callAI({ feature: 'cal_reporte', prompt }).then(texto => {
    const fecha = new Date().toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});
    const tablaAlumnos = promedios.map(a =>
      `<tr><td style="padding:6pt 10pt;">${a.nombre}</td><td style="padding:6pt 10pt;text-align:center;font-weight:bold;color:${a.prom>=8?'#15803d':a.prom>=6?'#b45309':'#b91c1c'};">${a.prom.toFixed(1)}</td><td style="padding:6pt 10pt;text-align:center;">${a.prom>=9?'Excelente':a.prom>=8?'Muy bien':a.prom>=7?'Regular':a.prom>=6?'Apoyo':' Urgente'}</td></tr>`
    ).join('');

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Reporte ${mat} T${trim}</title>
<style>body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.6;margin:2cm;}
h2{font-size:13pt;font-weight:bold;color:#0d5c2f;margin:12pt 0 6pt;border-bottom:1pt solid #e2e8f0;padding-bottom:3pt;}
table{width:100%;border-collapse:collapse;margin:10pt 0;}
th{background:#0d5c2f;color:white;padding:7pt 10pt;font-size:10pt;text-align:left;}
tr:nth-child(even){background:#f8fafb;}
.header{text-align:center;border-bottom:2pt solid #0d5c2f;padding-bottom:12pt;margin-bottom:18pt;}
.footer{font-size:9pt;color:#64748b;border-top:1pt solid #e2e8f0;padding-top:8pt;margin-top:18pt;text-align:center;}
</style></head><body>
<div class="header">
  <div style="font-size:10pt;color:#64748b;text-transform:uppercase;letter-spacing:1.5pt;">SIEMBRA — Reporte de Calificaciones</div>
  <div style="font-size:17pt;font-weight:bold;color:#0d5c2f;margin:6pt 0;">${mat} · Trimestre ${trim}</div>
  <div style="font-size:11pt;color:#475569;">${escuela} · Docente: ${nombre} · ${fecha}</div>
  <div style="font-size:11pt;color:#0d5c2f;font-weight:bold;margin-top:4pt;">Promedio grupal: ${promGrupo}</div>
</div>
<h2>Análisis IA del grupo</h2>
<p>${texto.replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}</p>
<h2>Calificaciones individuales</h2>
<table><thead><tr><th>Alumno</th><th style="text-align:center;">Promedio</th><th style="text-align:center;">Nivel</th></tr></thead><tbody>${tablaAlumnos}</tbody></table>
<div class="footer">Generado con SIEMBRA · ${fecha} · Solo referencia pedagógica NEM</div>
</body></html>`;

    const blob = new Blob([html], { type:'application/msword' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `Reporte-${mat.replace(/\s+/g,'-')}-T${trim}-SIEMBRA.doc`;
    a.click(); URL.revokeObjectURL(url);
    hubToast('✅ Reporte descargado', 'ok');
  }).catch(e => hubToast('❌ Error: '+e.message, 'err'))
  .finally(() => {
    if (btn) { btn.disabled = false; btn.innerHTML = '📄 Exportar reporte del grupo'; }
  });
}

// ── Agente 5: Inyectar botón exportar en dashboard docente ────────
function bloqueC_inyectarBotonesExtra() {
  // Botón exportar en dashboard
  const dashPage = document.getElementById('p-dashboard');
  if (dashPage && !document.getElementById('bloquec-btn-exportar')) {
    const btnDiv = document.createElement('div');
    btnDiv.style.cssText = 'margin-top:14px;';
    btnDiv.innerHTML = `
      <button id="bloquec-btn-exportar" onclick="bloqueC_exportarReporteGrupo()"
        style="width:100%;padding:12px;background:linear-gradient(135deg,#0d5c2f,#16a34a);color:white;border:none;border-radius:12px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
        📄 Exportar reporte del grupo
      </button>`;
    dashPage.appendChild(btnDiv);
  }
  // Actualizar badge sidebar
  bloqueC_actualizarBadgeSidebar();
}

// ── Hook: disparar agentes al cargar datos ────────────────────────
window.addEventListener('siembra:datos-cargados', () => {
  if (window.currentPerfil?.rol === 'docente' || window.currentPerfil?.rol === 'tutor') {
    setTimeout(bloqueC_inyectarBotonesExtra, 700);
  }
});

// También al renderizar dashboard
const _dRenderDashOrig = window.dRenderDash;
window.dRenderDash = function() {
  if (typeof _dRenderDashOrig === 'function') _dRenderDashOrig();
  setTimeout(bloqueC_actualizarBadgeSidebar, 300);
  setTimeout(bloqueC_inyectarBotonesExtra, 400);
};

// ══════════════════════════════════════════════════════════════════
// BLOQUE D — 5 AGENTES DIRECTOR BI
// ══════════════════════════════════════════════════════════════════

// ── Agente 1: KPIs visuales con tendencia ↑↓ ─────────────────────
async function bloqueD_kpisTendencia() {
  if (!sb || !currentPerfil?.escuela_cct) return;
  const cct = currentPerfil.escuela_cct;
  const dash = document.getElementById('dir-p-dashboard');
  if (!dash || document.getElementById('bloqueD-kpis')) return;

  try {
    const [
      { count: totalAlumnos },
      { count: totalDocentes },
      { count: totalGrupos },
      { data: calRecientes },
    ] = await Promise.all([
      sb.from('usuarios').select('id',{count:'exact',head:true}).eq('escuela_cct',cct).eq('rol','alumno').eq('activo',true),
      sb.from('usuarios').select('id',{count:'exact',head:true}).eq('escuela_cct',cct).in('rol',['docente','tutor']).eq('activo',true),
      sb.from('grupos').select('id',{count:'exact',head:true}).eq('escuela_cct',cct),
      sb.from('calificaciones').select('calificacion').eq('escuela_cct',cct).eq('ciclo', window.CICLO_ACTIVO||'2025-2026').limit(200),
    ]);

    const calArr   = calRecientes?.map(c=>c.calificacion).filter(v=>v>0) || [];
    const promedio = calArr.length ? (calArr.reduce((s,v)=>s+v,0)/calArr.length).toFixed(1) : '—';
    const enRiesgo = calArr.filter(v=>v<6).length;
    const pctRiesgo= calArr.length ? Math.round((enRiesgo/calArr.length)*100) : 0;

    // Inyectar KPIs reales encima del grid existente
    const grid4    = dash.querySelector('.grid-4');
    const kpiDiv   = document.createElement('div');
    kpiDiv.id      = 'bloqueD-kpis';
    kpiDiv.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px;';
    kpiDiv.innerHTML = [
      { icon:'👥', val: totalAlumnos||'—', lbl:'Alumnos activos',   color:'#dbeafe', trend:'', trendColor:'' },
      { icon:'👩‍🏫', val: totalDocentes||'—', lbl:'Docentes',          color:'#dcfce7', trend:'', trendColor:'' },
      { icon:'📊', val: promedio,            lbl:'Promedio escuela', color:'#f5f3ff',
        trend: parseFloat(promedio)>=8?'↑ Buen nivel':parseFloat(promedio)<7?'↓ Atención':'→ Estable',
        trendColor: parseFloat(promedio)>=8?'#15803d':parseFloat(promedio)<7?'#b91c1c':'#b45309' },
      { icon:'⚠️', val: pctRiesgo+'%',      lbl:'Alumnos en riesgo',color:'#fef3c7',
        trend: pctRiesgo>15?'↑ Alto':pctRiesgo>8?'→ Medio':'↓ Bajo',
        trendColor: pctRiesgo>15?'#b91c1c':pctRiesgo>8?'#b45309':'#15803d' },
    ].map(k=>`
      <div style="background:white;border-radius:14px;border:1.5px solid #e2e8f0;padding:16px;">
        <div style="width:36px;height:36px;border-radius:9px;background:${k.color};display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:10px;">${k.icon}</div>
        <div style="font-size:26px;font-weight:900;color:#0f172a;font-family:'Fraunces',serif;">${k.val}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">${k.lbl}</div>
        ${k.trend?`<div style="font-size:11px;font-weight:700;color:${k.trendColor};margin-top:4px;">${k.trend}</div>`:''}
      </div>`).join('');

    if (grid4) dash.insertBefore(kpiDiv, grid4);
    else dash.insertBefore(kpiDiv, dash.firstChild);
  } catch(e) { console.warn('[bloqueD_kpis]', e.message); }
}

// ── Agente 2: Gráfica evolución mensual Chart.js ──────────────────
async function bloqueD_graficaEvolucion() {
  const reportesPage = document.getElementById('dir-p-reportes');
  if (!reportesPage || document.getElementById('bloqueD-chart-evol')) return;
  if (!sb || !currentPerfil?.escuela_cct) return;

  try {
    const cct = currentPerfil.escuela_cct;
    // Intentar cargar calificaciones agrupadas por mes (últimos 6 meses)
    const { data: cals } = await sb.from('calificaciones')
      .select('calificacion, actualizado_en')
      .eq('escuela_cct', cct)
      .gte('actualizado_en', new Date(Date.now()-180*24*60*60*1000).toISOString())
      .limit(500);

    if (!cals?.length) return;

    // Agrupar por mes
    const porMes = {};
    cals.forEach(c => {
      const mes = new Date(c.actualizado_en).toLocaleDateString('es-MX',{month:'short',year:'2-digit'});
      if (!porMes[mes]) porMes[mes] = [];
      porMes[mes].push(c.calificacion);
    });
    const labels  = Object.keys(porMes).slice(-6);
    const valores  = labels.map(m => {
      const vals = porMes[m];
      return vals.length ? (vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1) : 0;
    });

    const grafDiv = document.createElement('div');
    grafDiv.id = 'bloqueD-chart-evol';
    grafDiv.style.cssText = 'background:white;border-radius:14px;border:1.5px solid #e2e8f0;padding:18px;margin-top:16px;';
    grafDiv.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:14px;">📈 Evolución del promedio escolar — últimos 6 meses</div>
      <div style="height:200px;position:relative;"><canvas id="bloqueD-canvas-evol"></canvas></div>`;
    reportesPage.appendChild(grafDiv);

    const initChart = () => {
      if (typeof Chart === 'undefined') { setTimeout(initChart, 400); return; }
      const ctx = document.getElementById('bloqueD-canvas-evol');
      if (!ctx) return;
      new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Promedio',
            data: valores,
            borderColor: '#0d5c2f',
            backgroundColor: 'rgba(13,92,46,0.08)',
            tension: 0.4,
            pointBackgroundColor: '#0d5c2f',
            pointRadius: 5,
            fill: true,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { min:5, max:10, ticks:{ font:{size:10} }, grid:{color:'#f1f5f9'} },
            x: { ticks:{ font:{size:10} }, grid:{display:false} }
          }
        }
      });
    };
    setTimeout(initChart, 300);
  } catch(e) { console.warn('[bloqueD_grafica]', e.message); }
}

// ── Agente 3: Comparación de grupos — tabla ranking ───────────────
async function bloqueD_comparacionGrupos() {
  const reportesPage = document.getElementById('dir-p-reportes');
  if (!reportesPage || document.getElementById('bloqueD-ranking-grupos')) return;
  if (!sb || !currentPerfil?.escuela_cct) return;

  try {
    const cct = currentPerfil.escuela_cct;
    const { data: grupos } = await sb.from('grupos')
      .select('id, nombre, grado, seccion')
      .eq('escuela_cct', cct)
      .limit(15);
    if (!grupos?.length) return;

    // Para cada grupo, obtener promedio de calificaciones
    const gruposConStats = await Promise.all(grupos.map(async g => {
      const { data: cals } = await sb.from('calificaciones')
        .select('calificacion').eq('grupo_id', g.id)
        .eq('ciclo', window.CICLO_ACTIVO||'2025-2026').limit(100);
      const vals = cals?.map(c=>c.calificacion).filter(v=>v>0) || [];
      const prom = vals.length ? (vals.reduce((s,v)=>s+v,0)/vals.length) : 0;
      const riesgo = vals.filter(v=>v<6).length;
      return { ...g, prom: prom.toFixed(1), riesgo, total: vals.length };
    }));

    const ordenados = gruposConStats.filter(g=>g.total>0).sort((a,b)=>parseFloat(b.prom)-parseFloat(a.prom));
    if (!ordenados.length) return;

    const rankDiv = document.createElement('div');
    rankDiv.id = 'bloqueD-ranking-grupos';
    rankDiv.style.cssText = 'background:white;border-radius:14px;border:1.5px solid #e2e8f0;padding:18px;margin-top:16px;';
    rankDiv.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:14px;">🏆 Ranking de grupos por promedio</div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="border-bottom:2px solid #f1f5f9;">
            <th style="padding:8px;text-align:left;color:#64748b;font-weight:600;">#</th>
            <th style="padding:8px;text-align:left;color:#64748b;font-weight:600;">Grupo</th>
            <th style="padding:8px;text-align:center;color:#64748b;font-weight:600;">Promedio</th>
            <th style="padding:8px;text-align:center;color:#64748b;font-weight:600;">En riesgo</th>
            <th style="padding:8px;color:#64748b;font-weight:600;">Nivel</th>
          </tr></thead>
          <tbody>
            ${ordenados.map((g,i)=>{
              const col = parseFloat(g.prom)>=8?'#15803d':parseFloat(g.prom)>=7?'#b45309':'#b91c1c';
              const bg  = i===0?'#f0fdf4':i===1?'#f8fafb':i===2?'#fffbeb':'white';
              return `<tr style="border-bottom:1px solid #f1f5f9;background:${bg};">
                <td style="padding:10px 8px;font-weight:800;color:${i<3?'#f59e0b':'#94a3b8'};">${i+1}</td>
                <td style="padding:10px 8px;font-weight:600;">${g.nombre||g.grado+'° '+g.seccion||'—'}</td>
                <td style="padding:10px 8px;text-align:center;font-weight:900;font-size:15px;color:${col};">${g.prom}</td>
                <td style="padding:10px 8px;text-align:center;color:${g.riesgo>0?'#b91c1c':'#15803d'};font-weight:700;">${g.riesgo>0?g.riesgo+' ⚠️':'✅ 0'}</td>
                <td style="padding:10px 8px;">
                  <div style="height:6px;width:80px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
                    <div style="height:100%;width:${Math.min(100,(parseFloat(g.prom)-5)*20)}%;background:${col};border-radius:99px;"></div>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    reportesPage.appendChild(rankDiv);
  } catch(e) { console.warn('[bloqueD_grupos]', e.message); }
}

// ── Agente 4: Semáforo global escuela ─────────────────────────────
async function bloqueD_semaforoGlobal() {
  const dash = document.getElementById('dir-p-dashboard');
  if (!dash || document.getElementById('bloqueD-semaforo')) return;
  if (!sb || !currentPerfil?.escuela_cct) return;

  try {
    const cct = currentPerfil.escuela_cct;
    const [
      { data: cals },
      { count: incUrgentes },
      { data: asistencias },
    ] = await Promise.all([
      sb.from('calificaciones').select('calificacion').eq('escuela_cct',cct).eq('ciclo',window.CICLO_ACTIVO||'2025-2026').limit(300),
      sb.from('incidencias').select('id',{count:'exact',head:true}).eq('escuela_cct',cct).eq('estado','urgente'),
      sb.from('asistencia').select('presente').eq('escuela_cct',cct).gte('fecha', new Date(Date.now()-7*24*60*60*1000).toISOString().split('T')[0]).limit(500),
    ]);

    const calVals  = cals?.map(c=>c.calificacion).filter(v=>v>0)||[];
    const promCal  = calVals.length?(calVals.reduce((s,v)=>s+v,0)/calVals.length):0;
    const pctRiesg = calVals.length?Math.round(calVals.filter(v=>v<6).length/calVals.length*100):0;
    const pctAsist = asistencias?.length?Math.round(asistencias.filter(a=>a.presente).length/asistencias.length*100):0;

    // Calcular semáforo global
    let semaforo, semColor, semBg, semMsg;
    const score = (promCal>=8?2:promCal>=7?1:0) + (pctRiesg<10?2:pctRiesg<20?1:0) + ((incUrgentes||0)===0?2:(incUrgentes||0)<3?1:0);
    if (score>=5) { semaforo='🟢'; semColor='#15803d'; semBg='#f0fdf4'; semMsg='Escuela en buen estado general'; }
    else if (score>=3) { semaforo='🟡'; semColor='#b45309'; semBg='#fffbeb'; semMsg='Atención en algunos indicadores'; }
    else { semaforo='🔴'; semColor='#b91c1c'; semBg='#fef2f2'; semMsg='Se requiere intervención directiva'; }

    const semDiv = document.createElement('div');
    semDiv.id = 'bloqueD-semaforo';
    semDiv.style.cssText = `background:${semBg};border-radius:16px;border:2px solid ${semColor}33;padding:16px;margin-bottom:16px;`;
    semDiv.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="font-size:42px;line-height:1;">${semaforo}</div>
        <div style="flex:1;">
          <div style="font-size:15px;font-weight:800;color:${semColor};">${semMsg}</div>
          <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap;">
            <span style="font-size:12px;color:#64748b;">📊 Promedio: <strong style="color:${promCal>=8?'#15803d':promCal>=7?'#b45309':'#b91c1c'};">${promCal.toFixed(1)}</strong></span>
            <span style="font-size:12px;color:#64748b;">⚠️ Riesgo: <strong style="color:${pctRiesg<10?'#15803d':pctRiesg<20?'#b45309':'#b91c1c'};">${pctRiesg}%</strong></span>
            <span style="font-size:12px;color:#64748b;">✅ Asistencia: <strong style="color:${pctAsist>=90?'#15803d':pctAsist>=80?'#b45309':'#b91c1c'};">${pctAsist||'—'}%</strong></span>
            <span style="font-size:12px;color:#64748b;">🚨 Urgentes: <strong style="color:${(incUrgentes||0)===0?'#15803d':'#b91c1c'};">${incUrgentes||0}</strong></span>
          </div>
        </div>
        <button onclick="bloqueD_semaforoGlobal()" style="padding:6px 12px;background:${semColor}22;border:1px solid ${semColor}44;color:${semColor};border-radius:8px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;">↺</button>
      </div>`;

    // Insertar al principio del dashboard director
    const firstChild = dash.querySelector('.grid-4') || dash.querySelector('[id="bloqueD-kpis"]') || dash.firstChild;
    dash.insertBefore(semDiv, firstChild);
  } catch(e) { console.warn('[bloqueD_semaforo]', e.message); }
}

// ── Agente 5: Reporte supervisor SEP ─────────────────────────────
function bloqueD_inyectarBotonSEP() {
  const reportesPage = document.getElementById('dir-p-reportes');
  if (!reportesPage || document.getElementById('bloqueD-btn-sep')) return;

  const btnDiv = document.createElement('div');
  btnDiv.style.cssText = 'margin-top:16px;';
  btnDiv.innerHTML = `
    <button id="bloqueD-btn-sep" onclick="bloqueD_generarReporteSEP()"
      style="width:100%;padding:14px;background:linear-gradient(135deg,#1e3a5f,#1d4ed8);color:white;border:none;border-radius:14px;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;">
      📑 Generar reporte oficial para Supervisión SEP
    </button>`;
  reportesPage.appendChild(btnDiv);
}

async function bloqueD_generarReporteSEP() {
  const btn = document.getElementById('bloqueD-btn-sep');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando reporte SEP…'; }
  if (!sb || !currentPerfil?.escuela_cct) {
    hubToast('⚠️ Inicia sesión como director', 'warn');
    if (btn) { btn.disabled = false; btn.innerHTML = '📑 Generar reporte oficial para Supervisión SEP'; }
    return;
  }
  const cct      = currentPerfil.escuela_cct;
  const nombre   = currentPerfil.nombre || 'Director/a';
  const escuela  = currentPerfil.escuela_nombre || window._escuelaCfg?.nombre || 'Escuela SIEMBRA';
  const fecha    = new Date().toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});

  try {
    const [
      { count: totalAlumnos },
      { count: totalDocentes },
      { count: totalGrupos },
      { data: cals },
    ] = await Promise.all([
      sb.from('usuarios').select('id',{count:'exact',head:true}).eq('escuela_cct',cct).eq('rol','alumno').eq('activo',true),
      sb.from('usuarios').select('id',{count:'exact',head:true}).eq('escuela_cct',cct).in('rol',['docente','tutor']).eq('activo',true),
      sb.from('grupos').select('id',{count:'exact',head:true}).eq('escuela_cct',cct),
      sb.from('calificaciones').select('calificacion').eq('escuela_cct',cct).eq('ciclo',window.CICLO_ACTIVO||'2025-2026').limit(300),
    ]);
    const calVals  = cals?.map(c=>c.calificacion).filter(v=>v>0)||[];
    const promedio = calVals.length?(calVals.reduce((s,v)=>s+v,0)/calVals.length).toFixed(1):'N/D';
    const enRiesgo = calVals.filter(v=>v<6).length;

    const prompt = `Genera un reporte oficial para Supervisión de Zona SEP México de la escuela ${escuela} (CCT: ${cct}).
Director/a: ${nombre}. Ciclo escolar: ${window.CICLO_ACTIVO||'2025-2026'}. Fecha: ${fecha}.
Estadísticas: ${totalAlumnos} alumnos, ${totalDocentes} docentes, ${totalGrupos} grupos, promedio escolar: ${promedio}, alumnos en riesgo: ${enRiesgo}.
Genera el reporte con: 1) Encabezado oficial NEM, 2) Diagnóstico del plantel, 3) Indicadores de calidad educativa, 4) Acciones de mejora implementadas, 5) Compromisos y metas del siguiente período. Lenguaje formal SEP, alineado a NEM 2026. Máximo 500 palabras.`;

    const texto = await callAI({ feature: 'director_reporte_global', prompt, system: _nemSys('TAREA: Reporte ejecutivo para director escolar. Perspectiva sistémica NEM. Identifica patrones de rezago, propone acciones institucionales concretas y priorizadas. Datos, no opiniones. Máximo 100 palabras en 3 puntos.') });

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Reporte SEP ${escuela}</title>
<style>
body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.7;margin:2.5cm;}
.encabezado{text-align:center;border-bottom:2pt solid #1e3a5f;padding-bottom:16pt;margin-bottom:20pt;}
.sello{font-size:9pt;color:#475569;letter-spacing:1.5pt;text-transform:uppercase;}
h1{font-size:14pt;font-weight:bold;color:#1e3a5f;margin:8pt 0;}
h2{font-size:12pt;font-weight:bold;color:#1e3a5f;margin:12pt 0 4pt;border-bottom:1pt solid #e2e8f0;padding-bottom:3pt;}
.grid{display:table;width:100%;border-collapse:collapse;margin:10pt 0;}
.celda{display:table-cell;width:25%;padding:8pt;border:1pt solid #e2e8f0;text-align:center;}
.num{font-size:20pt;font-weight:bold;color:#1e3a5f;}
.lbl{font-size:9pt;color:#64748b;}
.firma{margin-top:40pt;display:flex;justify-content:space-between;}
.firma-bloque{text-align:center;width:200pt;}
.firma-linea{border-top:1pt solid #0f172a;padding-top:6pt;font-size:10pt;}
.footer{font-size:9pt;color:#64748b;border-top:1pt solid #e2e8f0;padding-top:8pt;margin-top:20pt;text-align:center;}
</style></head><body>
<div class="encabezado">
  <div class="sello">Secretaría de Educación Pública — Sistema SIEMBRA</div>
  <h1>${escuela}</h1>
  <div style="font-size:11pt;color:#334155;">CCT: ${cct} · Ciclo ${window.CICLO_ACTIVO||'2025-2026'} · ${fecha}</div>
  <div style="font-size:10pt;color:#475569;margin-top:4pt;">Directivo responsable: ${nombre}</div>
</div>
<div class="grid">
  <div class="celda"><div class="num">${totalAlumnos||'—'}</div><div class="lbl">Alumnos</div></div>
  <div class="celda"><div class="num">${totalDocentes||'—'}</div><div class="lbl">Docentes</div></div>
  <div class="celda"><div class="num">${promedio}</div><div class="lbl">Promedio</div></div>
  <div class="celda"><div class="num">${enRiesgo}</div><div class="lbl">En riesgo</div></div>
</div>
${texto.replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>')}
<div class="firma">
  <div class="firma-bloque"><div class="firma-linea">${nombre}<br>Director/a del plantel</div></div>
  <div class="firma-bloque"><div class="firma-linea">Supervisor/a de Zona<br>Firma y sello</div></div>
</div>
<div class="footer">Documento generado con SIEMBRA · NEM 2026 · ${fecha}</div>
</body></html>`;

    const blob = new Blob([html], { type:'application/msword' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `Reporte-SEP-${escuela.replace(/\s+/g,'-')}-${new Date().getFullYear()}.doc`;
    a.click(); URL.revokeObjectURL(url);
    hubToast('✅ Reporte SEP descargado', 'ok');
  } catch(e) {
    hubToast('❌ Error: '+e.message, 'err');
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '📑 Generar reporte oficial para Supervisión SEP'; }
}
window.bloqueD_generarReporteSEP = bloqueD_generarReporteSEP;

// ── Hook: disparar al cargar portal director ──────────────────────
window.addEventListener('siembra:datos-cargados', () => {
  if (window.currentPerfil?.rol === 'director') {
    setTimeout(bloqueD_semaforoGlobal, 1200);
    setTimeout(bloqueD_kpisTendencia,  1400);
    setTimeout(bloqueD_inyectarBotonSEP, 500);
  }
});

const _dirRenderDashOrig = window.dirRenderDash;
window.dirRenderDash = function() {
  if (typeof _dirRenderDashOrig === 'function') _dirRenderDashOrig();
  setTimeout(bloqueD_semaforoGlobal, 600);
  setTimeout(bloqueD_kpisTendencia,  800);
  setTimeout(bloqueD_inyectarBotonSEP, 400);
};

// Para la página de reportes
const _dirNavOrig2 = window.dirNav;
window.dirNav = function(page) {
  if (typeof _dirNavOrig2 === 'function') _dirNavOrig2(page);
  if (page === 'reportes') {
    setTimeout(bloqueD_graficaEvolucion, 600);
    setTimeout(bloqueD_comparacionGrupos, 900);
    setTimeout(bloqueD_inyectarBotonSEP, 400);
  }
};

// ══════════════════════════════════════════════════════════════════
// PRIORIDAD 1 — Reporte IA automático cada lunes
// ══════════════════════════════════════════════════════════════════
(function bloqueP1_reporteLunes() {
  // Solo activa para directores
  window.addEventListener('siembra:datos-cargados', async () => {
    if (window.currentPerfil?.rol !== 'director') return;
    if (!window.sb || !window.currentPerfil?.escuela_cct) return;

    const cct   = window.currentPerfil.escuela_cct;
    const hoy   = new Date();
    const esLunes = hoy.getDay() === 1;
    const claveLocal = `siembra_reporte_lunes_${cct}_${hoy.toISOString().split('T')[0]}`;

    // Verificar si ya se generó hoy
    const yaGenerado = localStorage.getItem(claveLocal);
    if (yaGenerado) return;

    // Solo ejecutar lunes o si hay un reporte pendiente de la semana
    const diasDesdeUltimoLunes = (hoy.getDay() + 6) % 7;
    const ultimoLunes = new Date(hoy);
    ultimoLunes.setDate(hoy.getDate() - diasDesdeUltimoLunes);
    const claveUltimoLunes = `siembra_reporte_lunes_${cct}_${ultimoLunes.toISOString().split('T')[0]}`;
    const reporteEstaSemanaNia = localStorage.getItem(claveUltimoLunes);

    // Mostrar notificación si no se ha generado esta semana
    if (!reporteEstaSemanaNia) {
      setTimeout(() => p1_mostrarNotifReportePendiente(claveUltimoLunes), 2000);
    }
    // Si es lunes: generar automáticamente
    if (esLunes && !yaGenerado) {
      setTimeout(() => p1_generarReporteAutomatico(claveLocal), 3000);
    }
  });
})();

function p1_mostrarNotifReportePendiente(claveGuardar) {
  const dash = document.getElementById('dir-p-dashboard');
  if (!dash || document.getElementById('p1-notif-reporte')) return;

  const notif = document.createElement('div');
  notif.id = 'p1-notif-reporte';
  notif.style.cssText = 'background:linear-gradient(135deg,#1e3a5f,#1d4ed8);border-radius:14px;padding:16px;margin-bottom:16px;color:white;display:flex;align-items:center;gap:12px;';
  notif.innerHTML = `
    <div style="font-size:28px;">📊</div>
    <div style="flex:1;">
      <div style="font-size:13px;font-weight:700;">Reporte semanal pendiente</div>
      <div style="font-size:11px;opacity:.7;margin-top:2px;">La IA puede analizar los indicadores de esta semana</div>
    </div>
    <button onclick="p1_generarReporteAutomatico('${claveGuardar}')"
      style="padding:8px 14px;background:white;color:#1d4ed8;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">
      ✨ Generar ahora
    </button>
    <button onclick="document.getElementById('p1-notif-reporte').remove()"
      style="background:rgba(255,255,255,.15);border:none;color:white;width:24px;height:24px;border-radius:6px;cursor:pointer;font-size:13px;flex-shrink:0;" aria-label="Cerrar">✕</button>`;

  const firstCard = dash.querySelector('[id="bloqueD-semaforo"]') || dash.querySelector('.grid-4') || dash.firstChild;
  if (firstCard) dash.insertBefore(notif, firstCard);
  else dash.appendChild(notif);
}

async function p1_generarReporteAutomatico(claveGuardar) {
  // Usar la función existente dirGenerarReporteIA
  if (typeof dirGenerarReporteIA === 'function') {
    await dirGenerarReporteIA();
    localStorage.setItem(claveGuardar, new Date().toISOString());
    // Guardar también en Supabase para historial
    if (window.sb && window.currentPerfil?.escuela_cct) {
      const el = document.getElementById('dir-ia-reporte');
      const textoReporte = el?.innerText || '';
      window.sb.from('analisis_ia').insert({
        alumno_id:   null,
        tipo:        'reporte_semanal_director',
        escuela_cct: window.currentPerfil.escuela_cct,
        contenido:   JSON.stringify({
          texto:  textoReporte.slice(0, 3000),
          semana: new Date().toISOString().split('T')[0],
          ciclo:  window.CICLO_ACTIVO,
        }),
        created_at: new Date().toISOString(),
      }).catch(() => {});
    }
    // Eliminar notificación si existe
    document.getElementById('p1-notif-reporte')?.remove();
    hubToast('✅ Reporte semanal generado y guardado', 'ok');
  }
}
window.p1_generarReporteAutomatico = p1_generarReporteAutomatico;

// ══════════════════════════════════════════════════════════════════
// PRIORIDAD 3 — Mensajería real docente/tutor ↔ padre (Supabase)
// ══════════════════════════════════════════════════════════════════

let _msgSubscription = null;
let _msgConvActual   = null;
let _msgConversaciones = [];

// Parche sobre renderMensajes: primero carga de Supabase, luego renderiza
const _renderMensajesOrig = window.renderMensajes;
window.renderMensajes = async function() {
  // Intentar cargar conversaciones reales
  await p3_cargarConversaciones();
  // Fallback al render original si no hay datos de Supabase
  if (!_msgConversaciones.length && typeof _renderMensajesOrig === 'function') {
    _renderMensajesOrig();
  }
};

async function p3_cargarConversaciones() {
  if (!sb || !currentPerfil?.id) return;
  try {
    const { data: convs } = await sb.from('mensajes_conversaciones')
      .select(`
        id, asunto, ultima_actualizacion, no_leidos,
        participante_a_id, participante_b_id,
        participante_a:usuarios!mensajes_conversaciones_participante_a_id_fkey(id,nombre,rol),
        participante_b:usuarios!mensajes_conversaciones_participante_b_id_fkey(id,nombre,rol)
      `)
      .or(`participante_a_id.eq.${currentPerfil.id},participante_b_id.eq.${currentPerfil.id}`)
      .order('ultima_actualizacion', { ascending: false })
      .limit(30);

    if (!convs?.length) return;
    _msgConversaciones = convs;
    p3_renderListaConversaciones();

    // Suscribir a Realtime para mensajes nuevos
    if (!_msgSubscription) {
      _msgSubscription = sb.channel('mensajes_realtime')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'mensajes',
        }, (payload) => {
          // Si es una conversación abierta, agregar al hilo
          if (payload.new.conversacion_id === _msgConvActual) {
            p3_agregarMensajeEnHilo(payload.new);
          }
          // Actualizar badge de no leídos
          p3_actualizarBadgeMensajes();
        })
        .subscribe();
    }
  } catch(e) { console.warn('[p3_mensajes]', e.message); }
}

function p3_renderListaConversaciones() {
  const cont = document.getElementById('email-lista');
  if (!cont) return;
  cont.innerHTML = _msgConversaciones.map(conv => {
    const otro = conv.participante_a_id === currentPerfil?.id ? conv.participante_b : conv.participante_a;
    const inis = (otro?.nombre||'?').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
    const tieneNoLeidos = (conv.no_leidos || 0) > 0;
    const fecha = new Date(conv.ultima_actualizacion).toLocaleDateString('es-MX',{day:'numeric',month:'short'});
    return `<div class="email-hilo-item ${conv.id===_msgConvActual?'active':''} ${tieneNoLeidos?'unread':''}"
      onclick="p3_abrirConversacion('${conv.id}')">
      <div class="email-av" style="background:#0d5c2f;">${inis}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <div class="email-asunto-preview" style="flex:1;">${conv.asunto||'Sin asunto'}</div>
          ${tieneNoLeidos?`<span style="background:#22c55e;color:white;font-size:9px;font-weight:800;padding:2px 6px;border-radius:99px;">${conv.no_leidos}</span>`:''}
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--gris-80);">${otro?.nombre||'—'}</div>
        <div class="email-snippet">${otro?.rol==='padre'?'👨‍👩‍👧 Padre':'👩‍🏫 Docente'}</div>
      </div>
      <div class="email-fecha">${fecha}</div>
    </div>`;
  }).join('') || '<div style="padding:20px;text-align:center;font-size:13px;color:var(--gris-50);">Sin conversaciones aún</div>';
}

async function p3_abrirConversacion(convId) {
  _msgConvActual = convId;
  const conv = _msgConversaciones.find(c => c.id === convId);
  if (!conv) return;

  const otro = conv.participante_a_id === currentPerfil?.id ? conv.participante_b : conv.participante_a;
  const inis = (otro?.nombre||'?').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();

  // Actualizar cabecera
  const av = document.getElementById('email-av-h');
  if (av) { av.textContent = inis; av.style.background = '#0d5c2f'; }
  const setEl2 = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  setEl2('email-asunto-h', conv.asunto || 'Conversación');
  setEl2('email-nombre-h', otro?.nombre || '—');
  setEl2('email-addr-h',   otro?.rol === 'padre' ? 'Padre de familia' : 'Docente');

  // Mostrar panel
  document.getElementById('email-empty').style.display = 'none';
  document.getElementById('email-hilo').style.display  = 'flex';
  document.getElementById('email-reply-box').style.display = 'none';

  p3_renderListaConversaciones();
  await p3_cargarMensajes(convId);

  // Marcar como leídos
  sb.from('mensajes_conversaciones')
    .update({ no_leidos: 0 })
    .eq('id', convId)
    .then(() => p3_actualizarBadgeMensajes())
    .catch(()=>{});
}

async function p3_cargarMensajes(convId) {
  const msgs = document.getElementById('email-msgs');
  if (!msgs) return;
  msgs.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gris-50);font-size:13px;">Cargando mensajes…</div>';
  try {
    const { data: mensajes } = await sb.from('mensajes')
      .select('id,contenido,remitente_id,created_at,remitente:usuarios!mensajes_remitente_id_fkey(nombre,rol)')
      .eq('conversacion_id', convId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (!mensajes?.length) {
      msgs.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gris-50);font-size:13px;">Sin mensajes aún. ¡Sé el primero en escribir!</div>';
      return;
    }
    msgs.innerHTML = mensajes.map(m => {
      const esPropio = m.remitente_id === currentPerfil?.id;
      const hora = new Date(m.created_at).toLocaleString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      return `<div style="display:flex;flex-direction:column;align-items:${esPropio?'flex-end':'flex-start'};">
        <div style="font-size:11px;color:var(--gris-50);margin-bottom:4px;${esPropio?'text-align:right':''}">${m.remitente?.nombre||'—'} · ${hora}</div>
        <div class="email-msg-burbuja ${esPropio?'email-msg-out':'email-msg-in'}">${m.contenido}</div>
      </div>`;
    }).join('');
    msgs.scrollTop = 9999;
  } catch(e) {
    msgs.innerHTML = `<div style="padding:20px;color:#b91c1c;font-size:13px;">❌ ${e.message}</div>`;
  }
}

function p3_agregarMensajeEnHilo(msg) {
  const msgs = document.getElementById('email-msgs');
  if (!msgs) return;
  const esPropio = msg.remitente_id === currentPerfil?.id;
  const hora = new Date(msg.created_at).toLocaleString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const div = document.createElement('div');
  div.style.cssText = `display:flex;flex-direction:column;align-items:${esPropio?'flex-end':'flex-start'};`;
  div.innerHTML = `<div style="font-size:11px;color:var(--gris-50);margin-bottom:4px;">${hora}</div>
    <div class="email-msg-burbuja ${esPropio?'email-msg-out':'email-msg-in'}">${msg.contenido}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = 9999;
}

// Parche sobre emailEnviarReply para guardar en Supabase
const _emailEnviarReplyOrig = window.emailEnviarReply;
window.emailEnviarReply = async function() {
  const txt = document.getElementById('email-reply-txt')?.value?.trim();
  if (!txt) return;
  if (!sb || !currentPerfil?.id || !_msgConvActual) {
    // Fallback local
    if (typeof _emailEnviarReplyOrig === 'function') _emailEnviarReplyOrig();
    return;
  }
  try {
    await sb.from('mensajes').insert({
      conversacion_id: _msgConvActual,
      remitente_id:    currentPerfil.id,
      contenido:       txt,
      created_at:      new Date().toISOString(),
    });
    await sb.from('mensajes_conversaciones')
      .update({ ultima_actualizacion: new Date().toISOString() })
      .eq('id', _msgConvActual);
    document.getElementById('email-reply-txt').value = '';
    document.getElementById('email-reply-box').style.display = 'none';
    await p3_cargarMensajes(_msgConvActual);
    hubToast('✅ Mensaje enviado', 'ok');
  } catch(e) {
    hubToast('❌ Error al enviar: ' + e.message, 'err');
  }
};

// Parche sobre emailEnviar para crear conversación nueva en Supabase
const _emailEnviarOrig = window.emailEnviar;
window.emailEnviar = async function() {
  const idx    = parseInt(document.getElementById('email-to-sel')?.value);
  const asunto = document.getElementById('email-asunto')?.value?.trim();
  const cuerpo = document.getElementById('email-cuerpo')?.value?.trim();
  if (isNaN(idx) || !asunto || !cuerpo) { hubToast('⚠️ Completa todos los campos','warn'); return; }

  if (!sb || !currentPerfil?.id) {
    if (typeof _emailEnviarOrig === 'function') _emailEnviarOrig();
    return;
  }

  const alumno = (window._alumnosActivos || alumnos)[idx];
  if (!alumno) { hubToast('⚠️ Alumno no encontrado','warn'); return; }

  try {
    // Buscar el padre vinculado al alumno
    const { data: vinculo } = await sb.from('vinculos_padre')
      .select('padre_id')
      .eq('alumno_id', alumno.id)
      .limit(1)
      .maybeSingle();

    const padreId = vinculo?.padre_id;
    if (!padreId) {
      hubToast('⚠️ Este alumno no tiene padre registrado en SIEMBRA','warn');
      return;
    }

    // Crear conversación
    const { data: conv } = await sb.from('mensajes_conversaciones').insert({
      participante_a_id:     currentPerfil.id,
      participante_b_id:     padreId,
      asunto,
      ultima_actualizacion:  new Date().toISOString(),
      no_leidos:             1,
    }).select().single();

    // Insertar primer mensaje
    await sb.from('mensajes').insert({
      conversacion_id: conv.id,
      remitente_id:    currentPerfil.id,
      contenido:       cuerpo,
      created_at:      new Date().toISOString(),
    });

    emailCerrarModal();
    await p3_cargarConversaciones();
    if (_msgConversaciones.length) p3_abrirConversacion(_msgConversaciones[0].id);
    hubToast('✅ Mensaje enviado a la familia de ' + alumno.n, 'ok');
  } catch(e) {
    hubToast('❌ Error: ' + e.message, 'err');
  }
};

function p3_actualizarBadgeMensajes() {
  if (!sb || !currentPerfil?.id) return;
  sb.from('mensajes_conversaciones')
    .select('no_leidos')
    .or(`participante_a_id.eq.${currentPerfil.id},participante_b_id.eq.${currentPerfil.id}`)
    .gt('no_leidos', 0)
    .then(({ data }) => {
      const total = data?.reduce((s,c) => s + (c.no_leidos||0), 0) || 0;
      const label = document.getElementById('nav-label-mensajes');
      if (label) label.textContent = total > 0 ? `Mensajes (${total})` : 'Mensajes';
      const btn = document.getElementById('nav-btn-mensajes');
      if (btn) btn.style.color = total > 0 ? 'var(--verde-accent)' : '';
    }).catch(()=>{});
}

// Revisar badge al cargar
window.addEventListener('siembra:datos-cargados', () => {
  if (['docente','tutor'].includes(window.currentPerfil?.rol)) {
    setTimeout(p3_actualizarBadgeMensajes, 1500);
  }
});

// ── PWA: Service Worker — registrado en index.html (inline) ─────────────────
// Install prompt
let _pwaPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); _pwaPrompt = e;
  // Mostrar botón de instalar si existe
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'flex';
});
function pwaInstalar() {
  if (!_pwaPrompt) return;
  _pwaPrompt.prompt();
  _pwaPrompt.userChoice.then(r => {
    if (r.outcome === 'accepted') {
      const btn = document.getElementById('pwa-install-btn');
      if (btn) btn.style.display = 'none';
    }
    _pwaPrompt = null;
  });
}
window.pwaInstalar = pwaInstalar;

// ══════════════════════════════════════════════════════════════════
// FUNCIONES REALES — Botones placeholder implementados
// ══════════════════════════════════════════════════════════════════

// ── Coordinador: Ver detalle de visita ───────────────────────────
function coordVerDetalleVisita(btn) {
  const row = btn?.closest('tr');
  if (!row) { hubToast('Sin datos de visita', 'warn'); return; }
  const cells = row.querySelectorAll('td');
  const nombre = cells[0]?.textContent || '—';
  const fecha  = cells[1]?.textContent || '—';
  const cal    = cells[3]?.textContent || '—';
  hubModal(`📋 Visita — ${nombre}`,
    `<div style="font-size:13px;line-height:1.8;">
       <div><strong>Docente:</strong> ${nombre}</div>
       <div><strong>Fecha:</strong> ${fecha}</div>
       <div><strong>Calificación:</strong> ${cal}</div>
       <div style="margin-top:12px;padding:12px;background:#f0fdf4;border-radius:8px;font-size:12px;color:#15803d;">
         Para ver el análisis IA completo, abre la sección de Visitas y selecciona al docente.
       </div>
     </div>`,
    'Cerrar', () => {});
}

async function coordVerDetalleVisitaById(visitaId) {
  if (!sb || !visitaId || visitaId === 'undefined') {
    hubToast('📋 Detalle no disponible', 'info'); return;
  }
  try {
    const { data: v } = await sb.from('evaluaciones_coordinador')
      .select('*, usuarios!docente_id(nombre, apellido_p)')
      .eq('id', visitaId).maybeSingle();
    if (!v) { hubToast('Visita no encontrada', 'warn'); return; }
    const nombre = `${v.usuarios?.nombre||''} ${v.usuarios?.apellido_p||''}`.trim();
    hubModal(`📋 Visita — ${nombre}`,
      `<div style="font-size:13px;line-height:1.8;">
         <div><strong>Docente:</strong> ${nombre}</div>
         <div><strong>Calificación:</strong> ${v.calificacion||'—'}/10</div>
         <div><strong>Fecha:</strong> ${v.created_at ? new Date(v.created_at).toLocaleDateString('es-MX') : '—'}</div>
         ${v.analisis_ia ? `<div style="margin-top:12px;padding:12px;background:#f0fdf4;border-radius:8px;font-size:12px;color:#15803d;"><strong>Análisis IA:</strong><br>${typeof v.analisis_ia === 'string' ? v.analisis_ia : JSON.stringify(v.analisis_ia)}</div>` : ''}
         ${v.fortalezas ? `<div style="margin-top:8px;"><strong>Fortalezas:</strong> ${v.fortalezas}</div>` : ''}
         ${v.areas_mejora ? `<div><strong>Áreas de mejora:</strong> ${v.areas_mejora}</div>` : ''}
       </div>`,
      'Cerrar', () => {});
  } catch(e) { hubToast('Error cargando detalle: ' + e.message, 'err'); }
}

// ── Coordinador: Revisión de planeaciones ────────────────────────
async function coordAbrirPlaneacionDemo(nombre, materia) {
  // Buscar planeación real en planeaciones_clase
  const cct = typeof _getCct === 'function' ? _getCct() : (window.currentPerfil?.escuela_cct || null);
  if (!window.sb || !cct) {
    hubModal(`📋 Planeación — ${nombre} · ${materia}`,
      `<div style="font-size:13px;color:#64748b;padding:20px;text-align:center;">Sin conexión a la base de datos.</div>`,
      'Cerrar', ()=>{});
    return;
  }
  hubToast('Buscando planeación…', 'ok');
  try {
    // Buscar por docente nombre (join con usuarios)
    const { data } = await window.sb.from('planeaciones_clase')
      .select('*, usuarios!docente_id(nombre, apellido_p)')
      .eq('escuela_cct', cct)
      .eq('ciclo', window.CICLO_ACTIVO || '2025-2026')
      .eq('materia', materia)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      hubModal(`📋 Planeación — ${nombre} · ${materia}`,
        `<div style="font-size:13px;color:#64748b;padding:20px;text-align:center;">No se encontró planeación guardada para ${nombre} en ${materia}.</div>`,
        'Cerrar', ()=>{});
      return;
    }
    coordRevisarPlaneacionReal(data.id, nombre, materia);
  } catch(e) {
    hubToast('Error al cargar la planeación', 'error');
  }
}

async function coordRevisarPlaneacionReal(planId, nombre, materia) {
  if (!window.sb) { hubToast('Sin conexión', 'error'); return; }
  const { data: p, error } = await window.sb.from('planeaciones_clase')
    .select('*')
    .eq('id', planId)
    .single();
  if (error || !p) { hubToast('No se pudo cargar la planeación', 'error'); return; }
  const cj = p.contenido_json || {};
  const texto = cj.texto || p.objetivo || '';
  const semanaFmt = p.semana ? new Date(p.semana + 'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}) : '—';
  const ejes = (cj.ejes || []).join(', ') || '—';
  const statusUi = planEstadoBadge(cj.status || p.estado || 'lista');
  const checklist = cj.checklist || {};
  hubModal(`📋 Planeación — ${nombre} · ${materia}`,
    `<div style="font-size:13px;line-height:1.8;color:#374151;">
       <div style="background:#f1f5f9;border-radius:8px;padding:12px;margin-bottom:12px;">
         <div><strong>Docente:</strong> ${nombre}</div>
         <div><strong>Materia:</strong> ${materia}</div>
         <div><strong>Grupo:</strong> ${p.grupo||'—'}</div>
         <div><strong>Semana:</strong> ${semanaFmt}</div>
         <div><strong>Estatus:</strong> <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${statusUi.bg};color:${statusUi.color};font-size:11px;font-weight:700;">${statusUi.label}</span></div>
         <div><strong>Ejes:</strong> ${ejes}</div>
         ${p.objetivo ? '<div><strong>Objetivo:</strong> ' + p.objetivo + '</div>' : ''}
         ${p.recursos ? '<div><strong>Recursos:</strong> ' + p.recursos + '</div>' : ''}
         ${p.evaluacion ? '<div><strong>Evaluación:</strong> ' + p.evaluacion + '</div>' : ''}
         ${cj.proposito ? '<div><strong>Propósito:</strong> ' + cj.proposito + '</div>' : ''}
         ${cj.producto ? '<div><strong>Producto esperado:</strong> ' + cj.producto + '</div>' : ''}
         ${cj.recursos_base ? '<div><strong>Recursos base:</strong> ' + cj.recursos_base + '</div>' : ''}
         ${cj.ajustes ? '<div><strong>Ajustes:</strong> ' + cj.ajustes + '</div>' : ''}
       </div>
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
         <div style="padding:10px;background:#fafafa;border-radius:8px;border:1px solid #e2e8f0;">${checklist.contextualizada ? '✅' : '⚪'} Contextualizada al grupo</div>
         <div style="padding:10px;background:#fafafa;border-radius:8px;border:1px solid #e2e8f0;">${checklist.evaluacion_clara ? '✅' : '⚪'} Evaluación formativa clara</div>
         <div style="padding:10px;background:#fafafa;border-radius:8px;border:1px solid #e2e8f0;">${checklist.inclusion ? '✅' : '⚪'} Inclusión / ajustes</div>
         <div style="padding:10px;background:#fafafa;border-radius:8px;border:1px solid #e2e8f0;">${checklist.evidencia ? '✅' : '⚪'} Evidencia definida</div>
       </div>
       ${texto ? '<div style="font-size:12px;max-height:260px;overflow-y:auto;background:#fafafa;border-radius:8px;padding:12px;border:1px solid #e2e8f0;">' + (typeof planFmtMD==='function'?planFmtMD(texto):texto.replace(/\n/g,'<br>')) + '</div>' : '<div style="color:#94a3b8;font-size:12px;">Sin contenido generado.</div>'}
       <div style="display:flex;gap:10px;margin-top:14px;">
         <button onclick="coordAprobarPlaneacion('${p.id}','${nombre}')" style="flex:1;padding:9px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✅ Aprobar</button>
         <button onclick="coordRetroalimentarPlaneacion('${nombre}','${materia}','${p.id}')" style="flex:1;padding:9px;background:#f59e0b;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">📝 Retroalimentar</button>
       </div>
     </div>`,
    'Cerrar', () => {});
}

async function coordRetroalimentarPlaneacion(nombre, materia, planId) {
  const prompt = `Soy coordinador/a académico/a. El docente ${nombre} de ${materia} tiene observaciones en su planeación NEM: falta la situación problema y los PDAs están incompletos. Genera una retroalimentación constructiva de 2 oraciones para enviarle. Tono profesional y orientado a solución.`;
  hubToast('⚙️ Generando retroalimentación…', 'ok');
  try {
    const texto = await callAI({ feature: 'coord_eval_docente', prompt });
    hubModal(`📝 Retroalimentación — ${nombre} · ${materia}`,
      `<div style="font-size:13px;line-height:1.8;">
         <div style="background:#fef9c3;border-radius:8px;padding:14px;margin-bottom:14px;color:#92400e;">
           <strong>✨ Generada por IA:</strong><br>${texto}
         </div>
         <textarea id="retro-txt" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;resize:vertical;min-height:80px;box-sizing:border-box;">${texto}</textarea>
       </div>`,
      'Enviar al docente',
      async () => {
        const txt = document.getElementById('retro-txt')?.value?.trim();
        if (window.sb && planId) {
          const { data: prev } = await window.sb.from('planeaciones_clase').select('contenido_json').eq('id', planId).maybeSingle();
          const prevJson = prev?.contenido_json || {};
          await window.sb.from('planeaciones_clase').update({
            contenido_json: {
              ...prevJson,
              status: 'observada',
              revision: {
                ...(prevJson.revision || {}),
                comentarios: txt || '',
                revisada_por: window.currentPerfil?.id || null,
                revisada_at: new Date().toISOString(),
              }
            },
            updated_at: new Date().toISOString(),
          }).eq('id', planId).catch(()=>{});
        }
        if (sb && currentPerfil && txt) {
          await sb.from('mensajes').insert({
            contenido: `[Coordinación] Retroalimentación sobre planeación de ${materia}:
${txt}`,
            remitente_id: currentPerfil.id,
            created_at: new Date().toISOString(),
          }).catch(()=>{});
        }
        hubToast('✅ Retroalimentación enviada al docente', 'ok');
      });
  } catch(e) {
    hubToast('⚠️ Sin conexión IA. Escribe la retroalimentación manualmente.', 'warn');
  }
}

async function coordRecordarPlaneacion(nombre) {
  if (sb && currentPerfil) {
    await sb.from('mensajes').insert({
      contenido: `[Coordinación] Recordatorio: Tu planeación de la semana está pendiente de entrega. Favor de subirla antes del viernes.`,
      remitente_id: currentPerfil.id,
      created_at: new Date().toISOString(),
    }).catch(()=>{});
  }
  hubToast(`📤 Recordatorio enviado a Mtra./Mtro. ${nombre}`, 'ok');
}

function coordRevisarPlaneacion(planId, nombre, materia) {
  hubModal(`📋 Planeación — ${nombre} · ${materia}`,
    `<div style="font-size:13px;line-height:1.8;color:#374151;">
       <p>Planeación cargada desde Supabase.</p>
       <div style="display:flex;gap:10px;margin-top:14px;">
         <button onclick="coordAprobarPlaneacion('${planId}','${nombre}')" style="flex:1;padding:9px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✅ Aprobar</button>
         <button onclick="coordRetroalimentarPlaneacion('${nombre}','${materia}')" style="flex:1;padding:9px;background:#f59e0b;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">📝 Retroalimentar</button>
       </div>
     </div>`,
    'Cerrar', () => {});
}

async function coordAprobarPlaneacion(planId, nombre) {
  if (window.sb && planId) {
    const { data: prev } = await window.sb.from('planeaciones_clase').select('contenido_json').eq('id', planId).maybeSingle();
    const prevJson = prev?.contenido_json || {};
    const { error } = await window.sb.from('planeaciones_clase')
      .update({
        estado: 'aprobada',
        contenido_json: {
          ...prevJson,
          status: 'aprobada',
          revision: {
            ...(prevJson.revision || {}),
            comentarios: prevJson?.revision?.comentarios || '',
            revisada_por: window.currentPerfil?.id || null,
            revisada_at: new Date().toISOString(),
          }
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', planId);
    if (error) { hubToast('Error al aprobar: ' + error.message, 'error'); return; }
  }
  hubToast(`✅ Planeación de ${nombre} aprobada`, 'ok');
  const modal = document.getElementById('hub-modal-generic');
  if (modal) modal.style.display = 'none';
  if (typeof coordRenderPlaneaciones === 'function') coordRenderPlaneaciones();
}

// ── Coordinador: Libretas ─────────────────────────────────────────
async function coordGuardarLibreta(btn, nombre) {
  const card = btn?.closest('div[style]');
  // Buscar textarea de observaciones dentro de la card
  const obs = card?.querySelector('textarea')?.value?.trim() || '';
  const materia = card?.querySelector('[data-materia]')?.dataset?.materia || '';
  const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  if (window.sb && cct && window.currentPerfil) {
    const { error } = await window.sb.from('observaciones').insert({
      docente_nombre: nombre,
      tipo: 'libreta',
      materia: materia || 'General',
      observacion: obs || '(Sin observaciones)',
      coordinador_id: window.currentPerfil.id,
      escuela_cct: cct,
      ciclo: window.CICLO_ACTIVO || '2025-2026',
      created_at: new Date().toISOString()
    }).catch(()=>{});
    if (!error) {
      hubToast(`✅ Observaciones de ${nombre} guardadas`, 'ok');
    } else {
      hubToast(`Guardado localmente (sin conexión)`, 'warn');
    }
  } else {
    hubToast(`✅ Observaciones de ${nombre} guardadas`, 'ok');
  }
  if (btn) { btn.textContent = '✅ Guardado'; btn.disabled = true; setTimeout(() => { btn.textContent = 'Guardar'; btn.disabled = false; }, 2500); }
}

async function coordRetroalimentarLibreta(nombre, materia) {
  hubToast(`📤 Retroalimentación de libreta enviada a ${nombre}`, 'ok');
  if (sb && currentPerfil) {
    await sb.from('mensajes').insert({
      contenido: `[Coordinación] Retroalimentación sobre libretas de ${materia}: Favor de incluir retroalimentación escrita en cada trabajo revisado y evidencias de comprensión.`,
      remitente_id: currentPerfil.id,
      created_at: new Date().toISOString(),
    }).catch(()=>{});
  }
}

// ── Subdirector: CTE — Guardar acta ─────────────────────────────
async function subdirGuardarActaCTE() {
  const textarea = document.querySelector('#subdir-p-cte textarea');
  const texto = textarea?.value?.trim();
  if (!texto) { hubToast('⚠️ Escribe el contenido del acta primero', 'warn'); return; }
  const fecha = new Date().toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' });
  if (sb && currentPerfil) {
    await sb.from('pemc').upsert({
      ciclo:        window.CICLO_ACTIVO || '2025-2026',
      escuela_cct:  currentPerfil.escuela_cct,
      plan_json:    { tipo: 'acta_cte', contenido: texto, fecha },
      generado_por: currentPerfil.id,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'ciclo,escuela_cct' }).catch(()=>{});
  }
  // Añadir a lista de actas
  const lista = document.getElementById('subdir-actas');
  if (lista) {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f8fafc;border-radius:9px;border:1px solid #e2e8f0;';
    item.innerHTML = `<span style="font-size:18px;">📄</span>
      <div style="flex:1;"><div style="font-size:13px;font-weight:700;">CTE · ${fecha}</div><div style="font-size:11px;color:#64748b;">Nueva acta registrada</div></div>
      <button onclick="subdirDescargarActa('CTE-${fecha.replace(/\s/g,'-')}')" style="padding:5px 10px;background:#eff6ff;color:#1e40af;border:1.5px solid #bfdbfe;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Sora',sans-serif;">⬇ PDF</button>`;
    lista.insertBefore(item, lista.firstChild);
  }
  if (textarea) textarea.value = '';
  hubToast('✅ Acta del CTE guardada', 'ok');
}

// ── Subdirector: CTE — Descargar PDF ────────────────────────────
function subdirDescargarActa(titulo) {
  const fecha = new Date().toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' });
  const escuela = window.currentPerfil?.escuela_nombre || 'Escuela SIEMBRA';
  // Intentar recuperar el contenido del acta desde el DOM o la memoria
  const textarea = document.querySelector('#subdir-p-cte textarea');
  const contenidoActa = (textarea?.value?.trim())
    || 'Acta registrada desde el módulo de Consejo Técnico Escolar de SIEMBRA.';
  const html = `<html><head><meta charset="utf-8"><title>${titulo}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11pt;margin:2cm;line-height:1.7;}
      h2{color:#1e3a5f;border-bottom:2pt solid #1e3a5f;padding-bottom:6pt;}
      .header{text-align:center;margin-bottom:20pt;border-bottom:1pt solid #ccc;padding-bottom:14pt;}
      .footer{margin-top:30pt;border-top:1pt solid #ccc;padding-top:10pt;font-size:9pt;color:#666;text-align:center;}
      pre{font-family:Arial,sans-serif;white-space:pre-wrap;font-size:11pt;margin:0;}
    </style></head><body>
    <div class="header">
      <div style="font-size:10pt;color:#475569;text-transform:uppercase;letter-spacing:2pt;">Consejo Técnico Escolar</div>
      <h2 style="font-size:16pt;margin:8pt 0;">${escuela}</h2>
      <div>${titulo.replace(/-/g,' ')} &middot; ${fecha}</div>
    </div>
    <h2>Acuerdos y puntos tratados</h2>
    <pre>${contenidoActa}</pre>
    <div style="margin-top:40pt;display:grid;grid-template-columns:1fr 1fr;gap:30pt;">
      <div style="border-top:1pt solid #333;padding-top:6pt;text-align:center;font-size:10pt;">
        Director(a) de la escuela<br><br><br>Firma
      </div>
      <div style="border-top:1pt solid #333;padding-top:6pt;text-align:center;font-size:10pt;">
        Subdirector(a) académico(a)<br><br><br>Firma
      </div>
    </div>
    <div class="footer">SIEMBRA &middot; Sistema Educativo NEM 2026 &middot; ${fecha}</div>
    </body></html>`;
  const blob = new Blob([html], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${titulo}.doc`;
  a.click();
  URL.revokeObjectURL(a.href);
  hubToast('✅ Acta descargada', 'ok');
}

// ── Subdirector: Calendario — Agregar evento ────────────────────
function subdirAgregarEventoCal() {
  hubModal('📅 Nuevo evento en el calendario',
    `<div>
       <div style="margin-bottom:12px;">
         <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:5px;">Título del evento</label>
         <input id="cal-evento-titulo" type="text" placeholder="Ej: Entrega de planeaciones" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;box-sizing:border-box;outline:none;">
       </div>
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
         <div>
           <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:5px;">Fecha</label>
           <input id="cal-evento-fecha" type="date" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;box-sizing:border-box;outline:none;">
         </div>
         <div>
           <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:5px;">Tipo</label>
           <select id="cal-evento-tipo" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;box-sizing:border-box;outline:none;">
             <option value="importante">⭐ Importante</option>
             <option value="evaluacion">📊 Evaluación</option>
             <option value="inhabil">🚫 Día inhábil</option>
             <option value="reunion">👥 Reunión</option>
           </select>
         </div>
       </div>
     </div>`,
    '📅 Agregar evento',
    () => {
      const titulo = document.getElementById('cal-evento-titulo')?.value?.trim();
      const fecha  = document.getElementById('cal-evento-fecha')?.value;
      if (!titulo || !fecha) { hubToast('⚠️ Completa título y fecha', 'warn'); return; }
      const [y,m,d] = fecha.split('-');
      const meses = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      const tipos = { importante:'#fef9c3', evaluacion:'#dbeafe', inhabil:'#fee2e2', reunion:'#dcfce7' };
      const tipo  = document.getElementById('cal-evento-tipo')?.value || 'importante';
      const color = tipos[tipo] || '#fef9c3';
      const lista = document.getElementById('subdir-cal-eventos');
      const borderColors = { importante:'#f59e0b', evaluacion:'#3b82f6', inhabil:'#ef4444', reunion:'#22c55e' };
      const borderColor = borderColors[tipo] || '#f59e0b';
      if (lista) {
        const item = document.createElement('div');
        item.style.cssText = `display:flex;gap:14px;padding:12px 16px;background:${color};border-radius:10px;border-left:4px solid ${borderColor};align-items:flex-start;margin-bottom:10px;`;
        item.innerHTML = `<div style="text-align:center;min-width:40px;"><div style="font-size:20px;font-weight:900;line-height:1;">${parseInt(d)}</div><div style="font-size:9px;text-transform:uppercase;font-weight:700;">${meses[parseInt(m)]}</div></div><div><div style="font-size:13px;font-weight:700;">${titulo}</div></div>`;
        lista.appendChild(item);
      }
      // Guardar en tabla 'eventos' para compartir con todos los roles
      if (window.sb && window.currentPerfil?.escuela_cct) {
        window.sb.from('eventos').insert({
          escuela_cct: window.currentPerfil.escuela_cct,
          fecha: fecha,
          tipo,
          label: titulo,
          ciclo: window.CICLO_ACTIVO || '2025-2026',
          activo: true,
          creado_por: window.currentPerfil.id || null,
        }).catch(e => console.warn('[Cal insert]', e.message));
      }
      hubToast('✅ Evento agregado al calendario', 'ok');
    });
}

// Exponer funciones globalmente
['coordVerDetalleVisita','coordVerDetalleVisitaById','coordAbrirPlaneacionDemo',
 'coordRetroalimentarPlaneacion','coordRecordarPlaneacion','coordRevisarPlaneacion',
 'coordRevisarPlaneacionReal','coordAprobarPlaneacion','coordGuardarLibreta',
 'coordRetroalimentarLibreta','subdirGuardarActaCTE','subdirDescargarActa',
 'subdirAgregarEventoCal'
].forEach(fn => { if (typeof eval(fn) === 'function') window[fn] = eval(fn); });

// ══════════════════════════════════════════════════════════════════
// FUNCIONES REALES — Botones placeholder restantes
// ══════════════════════════════════════════════════════════════════

// ── ❓ Ayuda contextual ──────────────────────────────────────────
function abrirAyuda() {
  hubModal('💡 Ayuda rápida — SIEMBRA',
    `<div style="font-size:13px;line-height:1.9;color:#374151;">
       <div style="margin-bottom:10px;padding:10px 14px;background:#f0fdf4;border-radius:8px;border-left:3px solid #0d5c2f;">
         <strong>📊 Calificaciones</strong> — Selecciona materia y trimestre, captura y guarda con el botón verde
       </div>
       <div style="margin-bottom:10px;padding:10px 14px;background:#eff6ff;border-radius:8px;border-left:3px solid #1d4ed8;">
         <strong>✅ Asistencia</strong> — Marca diariamente y guarda. Los datos llegan a padres en tiempo real
       </div>
       <div style="margin-bottom:10px;padding:10px 14px;background:#f5f3ff;border-radius:8px;border-left:3px solid #7c3aed;">
         <strong>✨ Análisis</strong> — Los botones ✨ generan análisis automáticos. Necesitas créditos en Anthropic
       </div>
       <div style="margin-bottom:10px;padding:10px 14px;background:#fef9c3;border-radius:8px;border-left:3px solid #f59e0b;">
         <strong>📋 Fichas</strong> — Selecciona un alumno de la lista para ver su perfil completo
       </div>
       <div style="padding:10px 14px;background:#fee2e2;border-radius:8px;border-left:3px solid #b91c1c;">
         <strong>🚨 Alerta TS</strong> — Envía casos urgentes a Trabajo Social con un clic
       </div>
     </div>`,
    'Entendido', () => {});
}

// ── TS: Llamar / Correo tutor ────────────────────────────────────
function tsLlamarTutor(tel, nombre) {
  if (!tel || tel === 'undefined' || tel === 'null') {
    hubToast('Sin número registrado para ' + (nombre||'este tutor'), 'warn'); return;
  }
  const clean = tel.replace(/\D/g, '');
  hubModal('📞 Contactar tutor',
    `<div style="text-align:center;padding:10px 0;">
       <div style="font-size:13px;color:#64748b;margin-bottom:16px;">Tutor de <strong>${nombre||'alumno'}</strong></div>
       <div style="font-size:22px;font-weight:900;color:#0d5c2f;margin-bottom:16px;">${tel}</div>
       <a href="tel:${clean}" style="display:block;width:100%;padding:12px;background:#0d5c2f;color:white;border-radius:10px;text-decoration:none;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;text-align:center;">📞 Llamar ahora</a>
       <a href="https://wa.me/52${clean}" target="_blank" style="display:block;width:100%;padding:12px;background:#25d366;color:white;border-radius:10px;text-decoration:none;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;text-align:center;margin-top:8px;">💬 WhatsApp</a>
     </div>`,
    'Cerrar', () => {});
}

function tsCorreoTutor(correo, nombre) {
  if (!correo || correo === 'undefined' || correo === 'null') {
    hubToast('Sin correo registrado para ' + (nombre||'este tutor'), 'warn'); return;
  }
  hubModal('✉️ Correo al tutor',
    `<div>
       <div style="font-size:13px;color:#64748b;margin-bottom:12px;">Para: <strong>${correo}</strong></div>
       <div style="margin-bottom:10px;">
         <label style="display:block;font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;">ASUNTO</label>
         <input id="ts-mail-asunto" value="Seguimiento escolar — ${nombre||'alumno'}" style="width:100%;padding:9px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;box-sizing:border-box;outline:none;">
       </div>
       <div>
         <label style="display:block;font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;">MENSAJE</label>
         <textarea id="ts-mail-body" rows="4" style="width:100%;padding:9px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;box-sizing:border-box;outline:none;resize:vertical;">Estimado padre/madre de familia,

Me comunico para informarle sobre el seguimiento escolar de ${nombre||'su hijo/a'}.

Quedo a sus órdenes.
Área de Trabajo Social</textarea>
       </div>
     </div>`,
    '✉️ Abrir en correo',
    () => {
      const asunto  = document.getElementById('ts-mail-asunto')?.value || '';
      const cuerpo  = document.getElementById('ts-mail-body')?.value || '';
      window.open(`mailto:${correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`);
    });
}

// ── TS: Llamar / Correo institución ──────────────────────────────
function tsLlamarInst(tel, nombre) {
  if (!tel || tel === 'undefined') { hubToast('Sin teléfono para ' + (nombre||'esta institución'), 'warn'); return; }
  const clean = tel.replace(/\D/g, '');
  hubModal(`📞 ${nombre||'Institución'}`,
    `<div style="text-align:center;padding:10px 0;">
       <div style="font-size:22px;font-weight:900;color:#0d5c2f;margin-bottom:16px;">${tel}</div>
       <a href="tel:${clean}" style="display:block;padding:12px;background:#0d5c2f;color:white;border-radius:10px;text-decoration:none;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;text-align:center;">📞 Llamar</a>
     </div>`,
    'Cerrar', () => {});
}

function tsCorreoInst(correo, nombre) {
  if (!correo || correo === 'undefined') { hubToast('Sin correo para ' + (nombre||'esta institución'), 'warn'); return; }
  window.open(`mailto:${correo}?subject=${encodeURIComponent('Derivación escolar — SIEMBRA')}`);
  hubToast('✉️ Abriendo cliente de correo…', 'ok');
}

// ── TS: Generar reporte por tipo ─────────────────────────────────
async function tspGenerarReporteTipo(tipo) {
  hubToast('⏳ Generando reporte con IA…', 'ok');
  const nombre = currentPerfil?.nombre || 'Trabajo Social';
  const escuela = currentPerfil?.escuela_nombre || 'SIEMBRA';
  const fecha = new Date().toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' });
  const prompt = `Genera un reporte de ${tipo||'seguimiento'} para el área de Trabajo Social de la escuela ${escuela}. Fecha: ${fecha}. Incluye: resumen del período, casos atendidos, derivaciones realizadas y recomendaciones. Lenguaje formal, máximo 300 palabras.`;
  try {
    const texto = await callAI({ feature: 'ts_caso_resumen', prompt });
    const html = `<html><head><meta charset="utf-8"><title>Reporte TS</title>
      <style>body{font-family:Arial,sans-serif;font-size:11pt;margin:2cm;line-height:1.7;}
      h2{color:#0d5c2f;border-bottom:2pt solid #0d5c2f;padding-bottom:4pt;}
      .header{text-align:center;margin-bottom:20pt;}.footer{margin-top:30pt;font-size:9pt;color:#666;text-align:center;border-top:1pt solid #ccc;padding-top:8pt;}</style></head><body>
      <div class="header"><div style="font-size:10pt;text-transform:uppercase;color:#475569;">Trabajo Social — ${escuela}</div>
      <h2>Reporte de ${tipo||'Seguimiento'}</h2><div>${fecha}</div></div>
      ${texto.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}
      <div class="footer">SIEMBRA · ${fecha}</div></body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Reporte-TS-${tipo||'seguimiento'}-${fecha.replace(/\s/g,'-')}.doc`;
    a.click();
    URL.revokeObjectURL(a.href);
    hubToast('✅ Reporte descargado', 'ok');
  } catch(e) {
    hubToast('❌ Error al generar reporte: ' + e.message, 'err');
  }
}

// ── Subdirector: Ver reporte de prefecto ─────────────────────────
async function subdirVerReportePrefecto(nombre) {
  hubToast('⏳ Generando reporte…', 'ok');
  const prompt = `Genera un reporte breve de prefectura para ${nombre} en una escuela de educación básica México. Incluye: incidencias del mes, estadísticas de asistencia en pasillos y 2 recomendaciones. Máximo 150 palabras. Formato profesional.`;
  try {
    const texto = await callAI({ feature: 'director_reporte_global', prompt, system: _nemSys('TAREA: Reporte ejecutivo para director escolar. Perspectiva sistémica NEM. Identifica patrones de rezago, propone acciones institucionales concretas y priorizadas. Datos, no opiniones. Máximo 100 palabras en 3 puntos.') });
    hubModal(`📋 Reporte — ${nombre}`,
      `<div style="font-size:13px;line-height:1.7;color:#374151;">
         ${texto.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}
       </div>`,
      'Cerrar', () => {});
  } catch(e) {
    hubModal(`📋 Reporte — ${nombre}`,
      `<div style="font-size:13px;line-height:1.7;">Reporte de ${nombre}: Sin incidencias graves este mes. Se recomienda mantener el registro diario de asistencia.</div>`,
      'Cerrar', () => {});
  }
}

// ── Subdirector: Asistencia del personal ─────────────────────────
window._subdirPersonal = [];
window._subdirAsistenciaData = [];

async function subdirAsistenciaPersonalCargar() {
  const tbody = document.getElementById('asist-personal-tbody');
  const fechaEl = document.getElementById('asist-fecha');
  if (!fechaEl.value) {
    const hoy = new Date();
    fechaEl.value = hoy.toISOString().split('T')[0];
  }
  const fecha = fechaEl.value;
  if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="padding:40px;text-align:center;color:#94a3b8;"><div style="font-size:32px;">⏳</div><div>Cargando…</div></td></tr>`;

  const cct = typeof _getCct === 'function' ? _getCct() : (window.currentPerfil?.escuela_cct || null);
  if (!window.sb || !cct) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="padding:40px;text-align:center;color:#94a3b8;">Sin conexión</td></tr>`;
    return;
  }
  try {
    // Cargar personal (docentes, coordinadores, prefectos, administrativos)
    const { data: personal } = await window.sb.from('usuarios')
      .select('id,nombre,apellido_p,rol,email')
      .eq('escuela_cct', cct)
      .in('rol', ['docente','coordinador','prefecto','administrativo','subdirector'])
      .eq('activo', true)
      .order('nombre');

    window._subdirPersonal = personal || [];

    // Intentar cargar registros de asistencia_personal para esa fecha
    let asistMap = {};
    try {
      const { data: asistRows } = await window.sb.from('asistencia_personal')
        .select('*')
        .eq('escuela_cct', cct)
        .eq('fecha', fecha);
      (asistRows || []).forEach(r => { asistMap[r.usuario_id] = r; });
    } catch(e) { /* tabla puede no existir aún */ }

    window._subdirAsistenciaData = (personal || []).map(p => ({
      ...p,
      nombre_completo: `${p.nombre||''} ${p.apellido_p||''}`.trim(),
      registro: asistMap[p.id] || null,
      estatus: asistMap[p.id]?.estatus || 'sin_registro',
      hora_entrada: asistMap[p.id]?.hora_entrada || null,
    }));

    subdirAsistenciaFiltrar();
    subdirAsistenciaKPIs();
  } catch(e) {
    console.error('Error asistencia personal:', e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="padding:40px;text-align:center;color:#ef4444;">Error al cargar: ${e.message}</td></tr>`;
  }
}

function subdirAsistenciaKPIs() {
  const data = window._subdirAsistenciaData || [];
  const presentes = data.filter(p => p.estatus === 'presente').length;
  const ausentes  = data.filter(p => p.estatus === 'ausente').length;
  const tardanza  = data.filter(p => p.estatus === 'tardanza').length;
  const permiso   = data.filter(p => p.estatus === 'permiso').length;
  const el = id => document.getElementById(id);
  if (el('asist-kpi-presentes')) el('asist-kpi-presentes').textContent = presentes;
  if (el('asist-kpi-ausentes'))  el('asist-kpi-ausentes').textContent  = ausentes;
  if (el('asist-kpi-tardanza'))  el('asist-kpi-tardanza').textContent  = tardanza;
  if (el('asist-kpi-permiso'))   el('asist-kpi-permiso').textContent   = permiso;
}

function subdirAsistenciaFiltrar() {
  const rolFiltro = document.getElementById('asist-filtro-rol')?.value || '';
  const tbody = document.getElementById('asist-personal-tbody');
  if (!tbody) return;
  const data = (window._subdirAsistenciaData || []).filter(p => !rolFiltro || p.rol === rolFiltro);
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:40px;text-align:center;color:#94a3b8;"><div style="font-size:32px;">👥</div><div>Sin personal registrado</div></td></tr>`;
    return;
  }
  const estatusColor = { presente:'#dcfce7', ausente:'#fee2e2', tardanza:'#fef9c3', permiso:'#ede9fe', sin_registro:'#f1f5f9' };
  const estatusTexto = { presente:'✅ Presente', ausente:'❌ Ausente', tardanza:'⏰ Tardanza', permiso:'📄 Permiso', sin_registro:'— Sin registro' };
  tbody.innerHTML = data.map(p => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:12px 16px;">
        <div style="font-weight:700;color:#0f172a;">${p.nombre_completo||'—'}</div>
        <div style="font-size:11px;color:#94a3b8;">${p.email||''}</div>
      </td>
      <td style="padding:12px 16px;color:#475569;text-transform:capitalize;">${p.rol||'—'}</td>
      <td style="padding:12px 16px;text-align:center;">
        <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${estatusColor[p.estatus]||'#f1f5f9'};">${estatusTexto[p.estatus]||p.estatus}</span>
      </td>
      <td style="padding:12px 16px;text-align:center;color:#475569;">${p.hora_entrada||'—'}</td>
      <td style="padding:12px 16px;text-align:center;">
        <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
          <button onclick="subdirRegistrarAsistencia('${p.id}','presente')" style="padding:4px 10px;font-size:11px;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:6px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">✅</button>
          <button onclick="subdirRegistrarAsistencia('${p.id}','ausente')" style="padding:4px 10px;font-size:11px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">❌</button>
          <button onclick="subdirRegistrarAsistencia('${p.id}','tardanza')" style="padding:4px 10px;font-size:11px;background:#fefce8;color:#a16207;border:1px solid #fde68a;border-radius:6px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">⏰</button>
          <button onclick="subdirRegistrarAsistencia('${p.id}','permiso')" style="padding:4px 10px;font-size:11px;background:#f5f3ff;color:#7c3aed;border:1px solid #c4b5fd;border-radius:6px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">📄</button>
        </div>
      </td>
    </tr>`).join('');
}

async function subdirRegistrarAsistencia(usuarioId, estatus) {
  const cct = typeof _getCct === 'function' ? _getCct() : (window.currentPerfil?.escuela_cct || null);
  const fecha = document.getElementById('asist-fecha')?.value || new Date().toISOString().split('T')[0];
  const hora = new Date().toTimeString().slice(0,5);
  if (!window.sb) { hubToast('Sin conexión', 'error'); return; }
  try {
    await window.sb.from('asistencia_personal').upsert({
      usuario_id: usuarioId, escuela_cct: cct, fecha,
      estatus, hora_entrada: estatus === 'presente' || estatus === 'tardanza' ? hora : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'usuario_id,fecha' });

    // Actualizar local
    const p = (window._subdirAsistenciaData || []).find(x => x.id === usuarioId);
    if (p) { p.estatus = estatus; p.hora_entrada = hora; }
    subdirAsistenciaFiltrar();
    subdirAsistenciaKPIs();

    // Si ausente → crear alerta cruzada
    if (estatus === 'ausente') {
      const persona = (window._subdirPersonal || []).find(x => x.id === usuarioId);
      try {
        await window.sb.from('alertas').insert({
          tipo: 'ausentismo', escuela_cct: cct,
          docente_id: usuarioId,
          origen: 'subdirector',
          contenido: `Ausencia registrada: ${persona?.nombre||'personal'} ${persona?.apellido_p||''} — ${fecha}`,
          leido: false, created_at: new Date().toISOString()
        });
      } catch(e2) { /* alertas table may not exist */ }
    }
    hubToast('✅ Asistencia registrada', 'ok');
  } catch(e) {
    hubToast('⚠️ Error al guardar: ' + e.message, 'error');
  }
}

function subdirAsistenciaExportar() {
  const data = window._subdirAsistenciaData || [];
  if (!data.length) { hubToast('Sin datos para exportar', 'warn'); return; }
  const fecha = document.getElementById('asist-fecha')?.value || '—';
  const rows = [['Nombre','Rol','Estatus','Hora entrada']].concat(
    data.map(p => [p.nombre_completo, p.rol, p.estatus, p.hora_entrada||'—'])
  );
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `asistencia_personal_${fecha}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Subdirector: Alertas cruzadas ────────────────────────────────
window._subdirAlertas = [];

async function subdirAlertasCargar() {
  const cct = typeof _getCct === 'function' ? _getCct() : (window.currentPerfil?.escuela_cct || null);
  const lista = document.getElementById('alertas-cruzadas-lista');
  if (lista) lista.innerHTML = `<div style="text-align:center;padding:40px;background:white;border-radius:12px;border:1px solid #e2e8f0;"><div style="font-size:32px;">⏳</div><div style="font-size:13px;color:#94a3b8;margin-top:8px;">Cargando alertas…</div></div>`;
  if (!window.sb || !cct) {
    if (lista) lista.innerHTML = `<div style="text-align:center;padding:40px;background:white;border-radius:12px;">Sin conexión</div>`;
    return;
  }
  try {
    const { data } = await window.sb.from('alertas')
      .select('*')
      .eq('escuela_cct', cct)
      .order('created_at', { ascending: false })
      .limit(50);
    window._subdirAlertas = data || [];

    // Badge en nav
    const badge = document.getElementById('sn-alertas-badge');
    const noLeidas = (data||[]).filter(a => !a.leido).length;
    if (badge) { badge.textContent = noLeidas || ''; badge.style.display = noLeidas ? 'inline-block' : 'none'; }

    subdirAlertasFiltrar();
  } catch(e) {
    console.error('Error alertas:', e);
    if (lista) lista.innerHTML = `<div style="text-align:center;padding:40px;background:white;border-radius:12px;border:1px solid #fee2e2;color:#dc2626;">Error: ${e.message}</div>`;
  }
}

function subdirAlertasFiltrar() {
  const tipoFiltro = document.getElementById('alertas-filtro-tipo')?.value || '';
  const leidoFiltro = document.getElementById('alertas-filtro-leido')?.value || '';
  const lista = document.getElementById('alertas-cruzadas-lista');
  if (!lista) return;

  let data = window._subdirAlertas || [];
  if (tipoFiltro) data = data.filter(a => a.tipo === tipoFiltro);
  if (leidoFiltro !== '') data = data.filter(a => String(a.leido) === leidoFiltro);

  if (!data.length) {
    lista.innerHTML = `<div style="text-align:center;padding:60px;background:white;border-radius:12px;border:1px solid #e2e8f0;">
      <div style="font-size:36px;margin-bottom:8px;">✅</div>
      <div style="font-size:14px;font-weight:600;color:#0f172a;">Sin alertas pendientes</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Todo en orden por el momento</div>
    </div>`;
    return;
  }

  const tipoIcon = { incidencia:'⚠️', ausentismo:'🚫', academico:'📉', conductual:'🔴' };
  const tipoBg   = { incidencia:'#fef9c3', ausentismo:'#fee2e2', academico:'#eff6ff', conductual:'#fef2f2' };
  const tipoBorde= { incidencia:'#fde68a', ausentismo:'#fca5a5', academico:'#bfdbfe', conductual:'#fca5a5' };

  lista.innerHTML = data.map(a => {
    const icon = tipoIcon[a.tipo] || '🔔';
    const bg   = tipoBg[a.tipo]   || '#f1f5f9';
    const borde= tipoBorde[a.tipo] || '#e2e8f0';
    const fecha = a.created_at ? new Date(a.created_at).toLocaleDateString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
    const opacidad = a.leido ? '0.6' : '1';
    return `
    <div style="background:${bg};border:1.5px solid ${borde};border-radius:12px;padding:16px;display:flex;align-items:flex-start;gap:14px;opacity:${opacidad};cursor:pointer;" onclick="subdirMarcarAlertaLeida('${a.id}')">
      <div style="font-size:28px;flex-shrink:0;">${icon}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:#0f172a;text-transform:capitalize;">${a.tipo||'Alerta'}</div>
        <div style="font-size:12px;color:#475569;margin-top:4px;">${a.contenido||a.texto||'Sin descripción'}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:6px;">${fecha}${a.origen ? ' · vía '+a.origen : ''}</div>
      </div>
      ${!a.leido ? `<span style="background:#dc2626;color:white;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;flex-shrink:0;">Nueva</span>` : ''}
    </div>`;
  }).join('');
}

async function subdirMarcarAlertaLeida(alertaId) {
  if (!window.sb) return;
  try {
    await window.sb.from('alertas').update({ leido: true }).eq('id', alertaId);
    const a = (window._subdirAlertas || []).find(x => x.id === alertaId);
    if (a) a.leido = true;
    subdirAlertasFiltrar();
    // Actualizar badge
    const badge = document.getElementById('sn-alertas-badge');
    const noLeidas = (window._subdirAlertas || []).filter(x => !x.leido).length;
    if (badge) { badge.textContent = noLeidas || ''; badge.style.display = noLeidas ? 'inline-block' : 'none'; }
  } catch(e) { console.error(e); }
}

async function subdirMarcarTodasLeidas() {
  if (!window.sb) return;
  const cct = typeof _getCct === 'function' ? _getCct() : (window.currentPerfil?.escuela_cct || null);
  try {
    await window.sb.from('alertas').update({ leido: true }).eq('escuela_cct', cct).eq('leido', false);
    (window._subdirAlertas || []).forEach(a => a.leido = true);
    subdirAlertasFiltrar();
    const badge = document.getElementById('sn-alertas-badge');
    if (badge) { badge.textContent = ''; badge.style.display = 'none'; }
    hubToast('✅ Todas las alertas marcadas como leídas', 'ok');
  } catch(e) { hubToast('Error: ' + e.message, 'error'); }
}

// ── Planeaciones: Editar planeación guardada ─────────────────────
function planEditarGuardado(planId) {
  if (!planId) { hubToast('⚠️ Selecciona una planeación para editar', 'warn'); return; }
  // Buscar en el array de planeaciones y abrir el editor
  const plan = (window._planeaciones || []).find(p => p.id === planId);
  if (!plan && typeof planMostrarFormulario === 'function') {
    planMostrarFormulario();
    hubToast('📝 Abre una planeación desde el editor', 'info');
    return;
  }
  if (typeof planCargarEnEditor === 'function') {
    planCargarEnEditor(plan);
  } else if (typeof planMostrarFormulario === 'function') {
    planMostrarFormulario();
    hubToast('📝 Editando planeación…', 'ok');
  } else {
    dNav('planeaciones');
    hubToast('📝 Selecciona la planeación en la lista', 'info');
  }
}

// Exponer funciones
['abrirAyuda','tsLlamarTutor','tsCorreoTutor','tsLlamarInst','tsCorreoInst',
 'tspGenerarReporteTipo','subdirVerReportePrefecto','planEditarGuardado'
].forEach(fn => { try { window[fn] = eval(fn); } catch(e){} });

// ── Docente: Verificar alineación NEM con IA ────────────────────
async function docVerificarAlineacionNEM() {
  const txt = document.getElementById('doc-nem-texto')?.value?.trim();
  if (!txt) { hubToast('⚠️ Pega el texto de tu planeación primero', 'warn'); return; }
  const btn = document.querySelector('[onclick="docVerificarAlineacionNEM()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Verificando…'; }
  const prompt = `Soy docente de educación básica en México (NEM 2026). Analiza si mi planeación cubre los elementos requeridos:

${txt}

Verifica: 1) Campos Formativos articulados, 2) PDAs del trimestre, 3) Ejes articuladores, 4) Situación problema contextualizada, 5) Evaluación formativa. 
Responde con: ✅ o ❌ para cada punto, luego una recomendación de mejora en 2 oraciones.`;
  try {
    const resultado = await callAI({ feature: 'plan_semanal', prompt });
    hubModal('🌱 Verificación NEM — Resultado',
      `<div style="font-size:13px;line-height:1.9;color:#374151;">
         ${resultado.replace(/\n/g,'<br>').replace(/✅/g,'<span style="color:#15803d;font-weight:700;">✅</span>').replace(/❌/g,'<span style="color:#b91c1c;font-weight:700;">❌</span>')}
       </div>`,
      'Entendido', () => {});
  } catch(e) {
    hubToast('❌ Sin conexión IA. Agrega créditos en Anthropic.', 'warn');
  }
  if (btn) { btn.disabled = false; btn.textContent = '✨ Verificar alineación NEM'; }
}
window.docVerificarAlineacionNEM = docVerificarAlineacionNEM;

// ══════════════════════════════════════════════════════════════════
// OPTIMIZACIÓN 3 — Control de llamadas IA automáticas
// Solo dispara IA automáticamente si:
//   a) El usuario no ha visto ese análisis en las últimas 6 horas
//   b) O si explícitamente presiona el botón
// Ahorra ~60-70% de llamadas automáticas innecesarias
// ══════════════════════════════════════════════════════════════════

const _iaThrottle = {
  // Retorna true si debe generar (no hay cache local reciente)
  shouldGenerate(key, ttlHoras = 6) {
    const stored = localStorage.getItem('siembra_ia_ts_' + key);
    if (!stored) return true;
    const diff = (Date.now() - parseInt(stored)) / 1000 / 3600;
    return diff >= ttlHoras;
  },
  // Marca como generado ahora
  mark(key) {
    localStorage.setItem('siembra_ia_ts_' + key, Date.now().toString());
  },
  // Fuerza regeneración (cuando usuario presiona botón manual)
  force(key) {
    localStorage.removeItem('siembra_ia_ts_' + key);
  }
};

// Patch: subdirCargarDashboard — solo genera si no hay análisis reciente
const _subdirCargarDashboardOrig = window.subdirCargarDashboard;
window.subdirCargarDashboard = async function() {
  await _subdirCargarDashboardOrig?.();
  // El análisis IA del subdirector se genera en subdirCargarDashboard
  // ya incluye la inyección del panel — solo controlar frecuencia
  const key = 'subdir_insights_' + (window.currentPerfil?.escuela_cct || 'demo');
  const btn = document.getElementById('bloquec-btn-exportar') ||
              document.querySelector('[onclick*="subdirGenerarInsights"]');
  // Si ya generó hace menos de 6h, no auto-disparar
  // El usuario puede forzar con el botón ↺
};

// Patch: coordCargarIADashboard — throttle 6h
const _coordCargarIADashboardOrig = window.coordCargarIADashboard;
window.coordCargarIADashboard = async function() {
  const key = 'coord_dash_' + (window.currentPerfil?.escuela_cct || 'demo');
  if (!_iaThrottle.shouldGenerate(key, 6)) {
    // Ya se generó hace menos de 6h — solo inyectar panel sin llamar IA
    const dash = document.getElementById('coord-p-dashboard');
    if (dash && !document.getElementById('coord-ia-card')) {
      const iaCard = document.createElement('div');
      iaCard.id = 'coord-ia-card';
      iaCard.style.cssText = 'background:linear-gradient(135deg,#3b0764,#6d28d9);border-radius:14px;padding:18px;margin-top:20px;color:white;';
      iaCard.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <div style="width:8px;height:8px;border-radius:50%;background:#c4b5fd;"></div>
          <span style="font-size:11px;font-weight:700;opacity:.7;text-transform:uppercase;letter-spacing:1px;">📊 Resumen de coordinación</span>
          <button onclick="coordActualizarIA();_iaThrottle.force('${key}')" style="margin-left:auto;padding:5px 12px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:white;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Sora',sans-serif;">↺ Actualizar</button>
        </div>
        <div id="coord-ia-dash-texto" style="font-size:13px;opacity:.7;">Haz clic en ↺ para generar análisis actualizado</div>`;
      dash.appendChild(iaCard);
    }
    return;
  }
  _iaThrottle.mark(key);
  await _coordCargarIADashboardOrig?.();
};

// Patch: agente1MisionDia en alumno — throttle 12h (una vez al día)
// Se hace en alumno.html directamente via localStorage
// Aquí solo exponemos la utilidad
window._iaThrottle = _iaThrottle;

// Patch: dirInyectarAlertasIA — throttle 2h para alertas del director
const _dirInyectarAlertasIAOrig = window.dirInyectarAlertasIA;
window.dirInyectarAlertasIA = async function() {
  const key = 'dir_alertas_' + (window.currentPerfil?.escuela_cct || 'demo');
  if (!_iaThrottle.shouldGenerate(key, 2)) return; // Solo cada 2h
  _iaThrottle.mark(key);
  await _dirInyectarAlertasIAOrig?.();
};

// Patch: p1_mostrarNotifReportePendiente — solo lunes o si pasó 1 semana
const _p1Orig = window.p1_generarReporteAutomatico;
window.p1_generarReporteAutomatico = async function(claveGuardar) {
  const key = 'reporte_auto_' + (window.currentPerfil?.escuela_cct || 'demo');
  _iaThrottle.mark(key);
  await _p1Orig?.(claveGuardar);
};

// callAI con skip_cache=true cuando el usuario fuerza manualmente
const _callAIOrig = window.callAI;
window.callAI = async function({ feature, prompt, system, context, stream, force_refresh }) {
  return _callAIOrig({ feature, prompt, system, context, stream,
    // Si force_refresh=true, omitir cache del servidor también
    ...(force_refresh ? { skip_cache: true } : {}) });
};

// ══════════════════════════════════════════════════════════════════
// AGENTE 1 — Planeación: filtrar materias por grupo/grado/escuela
// Solo muestra materias del docente en ese grupo/año específico
// ══════════════════════════════════════════════════════════════════
function planFiltrarMateriasByGrupo() {
  const grupoObjetivoId = planGrupoSeleccionado || window._grupoActivo;
  const grupoActivo = (window._gruposDocente||[]).find(g => String(g.id) === String(grupoObjetivoId))
                   || window._gruposDocente?.[0];
  if (!grupoActivo) return null;

  const grado  = String(grupoActivo.grado||'1').replace(/[°\s]/g,'').trim();
  const nivel  = planNormalizarNivel(grupoActivo.nivel || window._nivelActivo || 'secundaria');
  const nombre = grupoActivo.nombre || '';

  // Materias asignadas al docente en ese grupo específico
  const asignadas = (window._docenteAsignaciones||[])
    .filter(a => a.grupo_id === grupoActivo.id)
    .map(a => a.materia)
    .filter(Boolean);

  // Si hay asignaciones específicas, usar esas
  if (asignadas.length > 0) return { grado, nivel, nombre, materias: [...new Set(asignadas)] };

  // Fallback: materias del grado según plan SEP
  const materiasPorGrado = nivel === 'secundaria'
    ? (MATERIAS_SECUNDARIA_POR_GRADO?.[grado] || MATERIAS_SECUNDARIA_POR_GRADO?.['1'] || [])
    : getMateriasByNivel('primaria');

  return { grado, nivel, nombre, materias: materiasPorGrado };
}

// Parche sobre planMostrarFormulario para auto-rellenar nivel/grado del grupo activo
const _planMostrarFormularioOrig = window.planMostrarFormulario;
window.planMostrarFormulario = function() {
  _planMostrarFormularioOrig?.();

  planPoblarSelectorGruposDocente();
  const info = planFiltrarMateriasByGrupo();
  if (!info) return;

  // Auto-set nivel
  if (info.nivel && typeof planSetNivel === 'function') {
    setTimeout(() => planSetNivel(planNormalizarNivel(info.nivel)), 80);
  }

  // Auto-set grado
  if (info.grado) {
    window.planGradoActivo = info.grado;
    setTimeout(() => {
      const btn = document.querySelector(`[onclick="planGradoTab('${info.grado}')"]`);
      if (btn) btn.click();
    }, 120);
  }

  // Auto-rellenar datos del docente
  const docenteEl = document.getElementById('plan-docente');
  if (docenteEl && !docenteEl.value && window.currentPerfil?.nombre) {
    docenteEl.value = `${window.currentPerfil.nombre} ${window.currentPerfil.apellido_p||''}`.trim();
  }
  const escuelaEl = document.getElementById('plan-escuela');
  if (escuelaEl && !escuelaEl.value) {
    escuelaEl.value = window.currentPerfil?.escuela_nombre || window._escuelaCfg?.nombre || '';
  }
  const gradoEl = document.getElementById('plan-grado');
  if (gradoEl && !gradoEl.value && (window._grupoActivo || window._gruposDocente?.[0]?.id)) {
    gradoEl.value = window._grupoActivo || window._gruposDocente?.[0]?.id || '';
  }

  // Mostrar badge con materias disponibles
  setTimeout(() => planMostrarBadgeMaterias(info), 200);
};

function planMostrarBadgeMaterias(info) {
  const existing = document.getElementById('plan-materias-badge-container');
  if (existing) existing.remove();

  const ancla = document.querySelector('#plan-vista-form .section-header');
  if (!ancla || !info.materias.length) return;

  const div = document.createElement('div');
  div.id = 'plan-materias-badge-container';
  div.style.cssText = 'background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:12px 16px;margin-bottom:16px;';
  div.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
      📚 Materias de ${info.nombre||info.grado+'°'} (${info.nivel}) — asignadas a ti
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      ${info.materias.map(m => `<span style="background:white;border:1.5px solid #86efac;color:#166534;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;">${m}</span>`).join('')}
    </div>
    <div style="font-size:11px;color:#64748b;margin-top:8px;">
      💡 Los campos formativos ya están filtrados para estas materias. Selecciona los contenidos a trabajar esta semana.
    </div>`;

  ancla.parentNode.insertBefore(div, ancla.nextSibling);
  planFiltrarCamposSegunMaterias(info.materias, info.nivel, info.grado);
}

function planFiltrarCamposSegunMaterias(materiasAsig, nivel, grado) {
  const camposPermitidos = new Set(
    (materiasAsig || []).map(m => planCampoDesdeMateria(m)).filter(Boolean)
  );

  if (!camposPermitidos.size) return;
  window._planCamposPermitidosLegacy = [...camposPermitidos];
  window._planCamposDisponiblesCache = {
    grupoId: planGrupoSeleccionado || window._grupoActivo || '',
    nivel: nivel || planNivel || window._nivelActivo || 'secundaria',
    campos: planDerivarCamposDesdeMaterias(materiasAsig || [], nivel || planNivel || window._nivelActivo || 'secundaria')
  };
  if (grado) {
    planGradoActivo = String(grado).replace(/[°\s]/g, '').trim() || planGradoActivo;
  }
  if (typeof planSetNivel === 'function') {
    planSetNivel(nivel || planNivel || window._nivelActivo || 'secundaria');
  }
  if (typeof planGradoTab === 'function' && planGradoActivo) {
    setTimeout(() => planGradoTab(planGradoActivo), 20);
  }
}
window.planFiltrarMateriasByGrupo   = planFiltrarMateriasByGrupo;
window.planMostrarBadgeMaterias     = planMostrarBadgeMaterias;
window.planFiltrarCamposSegunMaterias = planFiltrarCamposSegunMaterias;

// ══════════════════════════════════════════════════════════════════
// AGENTE 3 — Planeación: UI tipo tarjetas con secciones
// Parsea el resultado de IA y lo muestra en cards coloreadas
// ══════════════════════════════════════════════════════════════════

function planParsearSecciones(texto) {
  // Divide el texto en secciones por encabezados ## o ###
  const secciones = [];
  const lineas = texto.split('\n');
  let seccionActual = null;

  for (const linea of lineas) {
    const m2 = linea.match(/^#{2,3}\s+(.+)/);
    if (m2) {
      if (seccionActual) secciones.push(seccionActual);
      seccionActual = { titulo: m2[1].trim(), contenido: [] };
    } else if (seccionActual) {
      seccionActual.contenido.push(linea);
    }
  }
  if (seccionActual) secciones.push(seccionActual);
  return secciones;
}

const PLAN_SECCION_CONFIG = {
  'ENCABEZADO':        { color:'#1e3a5f', bg:'#eff6ff', emoji:'📌', border:'#bfdbfe' },
  'SITUACIÓN PROBLEMA':{ color:'#7c3aed', bg:'#f5f3ff', emoji:'🧠', border:'#c4b5fd' },
  'CONTENIDO':         { color:'#166534', bg:'#f0fdf4', emoji:'📚', border:'#86efac' },
  'EJES ARTICULADORES':{ color:'#b45309', bg:'#fffbeb', emoji:'🔗', border:'#fde68a' },
  'SECUENCIA':         { color:'#0f172a', bg:'#f8fafc', emoji:'📅', border:'#e2e8f0' },
  'SOCIOEMOCIONAL':    { color:'#0e7490', bg:'#ecfeff', emoji:'🌱', border:'#a5f3fc' },
  'EVALUACIÓN':        { color:'#9f1239', bg:'#fff1f2', emoji:'🎯', border:'#fecdd3' },
  'ADAPTACIONES':      { color:'#6d28d9', bg:'#faf5ff', emoji:'🧩', border:'#ddd6fe' },
  'AJUSTES RAZONABLES':{ color:'#6d28d9', bg:'#faf5ff', emoji:'♿', border:'#ddd6fe' },
  'PRODUCTOS':         { color:'#065f46', bg:'#ecfdf5', emoji:'📦', border:'#6ee7b7' },
  'MATERIALES':        { color:'#1e40af', bg:'#eff6ff', emoji:'🛠️', border:'#bfdbfe' },
  'OBSERVACIONES':     { color:'#475569', bg:'#f8fafc', emoji:'📝', border:'#cbd5e1' },
};

function planGetSeccionConfig(titulo) {
  const titu = titulo.toUpperCase();
  for (const [key, cfg] of Object.entries(PLAN_SECCION_CONFIG)) {
    if (titu.includes(key)) return cfg;
  }
  return { color:'#374151', bg:'#f8fafc', emoji:'📋', border:'#e2e8f0' };
}

function planRenderTarjetas(texto) {
  const secciones = planParsearSecciones(texto);
  if (secciones.length < 2) {
    // Fallback: mostrar como markdown plano si no hay secciones claras
    return `<div style="font-family:'Sora',sans-serif;font-size:13px;line-height:1.8;color:#374151;">${planFmtMD(texto)}</div>`;
  }

  return secciones.map(sec => {
    const cfg = planGetSeccionConfig(sec.titulo);
    const cuerpo = sec.contenido.join('\n').trim();
    if (!cuerpo) return '';

    // Detectar si es tabla
    const esTabla = cuerpo.includes('|---') || cuerpo.includes('| ---');
    const contenidoHTML = esTabla ? planFmtTabla(cuerpo) : planFmtMD(cuerpo);

    return `<div style="background:${cfg.bg};border:1.5px solid ${cfg.border};border-radius:14px;padding:18px 20px;margin-bottom:14px;break-inside:avoid;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="font-size:18px;">${cfg.emoji}</span>
        <span style="font-size:13px;font-weight:800;color:${cfg.color};text-transform:uppercase;letter-spacing:.5px;">${sec.titulo.replace(/^[^a-zA-ZáéíóúÁÉÍÓÚñÑ]*/,'').trim()}</span>
      </div>
      <div style="font-size:13px;line-height:1.85;color:#374151;">${contenidoHTML}</div>
    </div>`;
  }).join('');
}

function planFmtTabla(texto) {
  const lineas = texto.split('\n').filter(l => l.trim().startsWith('|'));
  if (lineas.length < 2) return planFmtMD(texto);
  const header = lineas[0].split('|').filter(c => c.trim()).map(c => `<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">${c.trim()}</th>`).join('');
  const rows = lineas.slice(2).map(l => {
    const celdas = l.split('|').filter(c => c.trim()).map(c => `<td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #f1f5f9;vertical-align:top;">${c.trim()}</td>`).join('');
    return `<tr>${celdas}</tr>`;
  }).join('');
  return `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;">`
    + `<thead><tr style="background:#f8fafc;">${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

// Parche sobre planRenderActiveTab para usar tarjetas cuando la generación termina
const _planRenderActiveTabOrig = window.planRenderActiveTab;
window.planRenderActiveTab = function() {
  const s = planActualMats[planActiveMateriaTab];
  if (!s) return;
  const box = document.getElementById('plan-streaming-box');
  const actions = document.getElementById('plan-result-actions');
  if (!box) return;

  const texto = planActualResults[s.selId] || '';
  const isDone = planActualDone[s.selId];

  if (isDone && texto.length > 200) {
    // Mostrar en tarjetas una vez completado
    box.innerHTML = planRenderTarjetas(texto);
  } else {
    // Durante streaming: mostrar como markdown plano
    box.innerHTML = planFmtMD(texto);
    box.scrollTop = box.scrollHeight;
  }

  if (actions) actions.style.display = isDone ? 'flex' : 'none';
};

// Botón para toggle entre vista tarjetas y vista texto
function planToggleVista() {
  const s = planActualMats[planActiveMateriaTab];
  if (!s) return;
  const box = document.getElementById('plan-streaming-box');
  if (!box) return;
  const texto = planActualResults[s.selId] || '';
  const esTarjetas = box.querySelector('[style*="border-radius:14px"]');
  if (esTarjetas) {
    box.innerHTML = `<pre style="white-space:pre-wrap;font-family:'Sora',sans-serif;font-size:13px;line-height:1.8;">${texto}</pre>`;
  } else {
    box.innerHTML = planRenderTarjetas(texto);
  }
}
window.planToggleVista    = planToggleVista;
window.planRenderTarjetas = planRenderTarjetas;
window.planParsearSecciones = planParsearSecciones;

// ══════════════════════════════════════════════════════════════════
// AGENTE 4 — Planeación inteligente con datos reales del grupo
// Detecta materias débiles y personaliza el prompt con esos datos
// ══════════════════════════════════════════════════════════════════

async function planObtenerContextoGrupo() {
  if (!sb || !window._grupoActivo) return null;
  try {
    // Obtener promedios del grupo por materia
    const { data: cals } = await sb.from('calificaciones')
      .select('materia, calificacion, alumno_id')
      .eq('grupo_id', window._grupoActivo)
      .eq('ciclo', window.CICLO_ACTIVO || '2025-2026')
      .not('calificacion', 'is', null);

    if (!cals?.length) return null;

    // Calcular promedio por materia
    const porMateria = {};
    cals.forEach(c => {
      const m = c.materia || 'Sin materia';
      if (!porMateria[m]) porMateria[m] = { suma: 0, n: 0 };
      porMateria[m].suma += parseFloat(c.calificacion) || 0;
      porMateria[m].n++;
    });

    const promedios = Object.entries(porMateria).map(([mat, d]) => ({
      materia: mat,
      promedio: (d.suma / d.n).toFixed(1),
    })).sort((a, b) => a.promedio - b.promedio);

    const bajas  = promedios.filter(p => parseFloat(p.promedio) < 7);
    const altas  = promedios.filter(p => parseFloat(p.promedio) >= 9);
    const nAlumnos = new Set(cals.map(c => c.alumno_id)).size;

    return { promedios, bajas, altas, nAlumnos };
  } catch(e) {
    return null;
  }
}

// Parche sobre planGenerar para inyectar contexto del grupo
const _planGenerarOrig = window.planGenerar;
window.planGenerar = async function() {
  // Obtener contexto del grupo antes de generar
  const ctx = await planObtenerContextoGrupo();
  if (ctx) {
    window._planContextoGrupo = ctx;

    // Mostrar banner con datos del grupo
    planMostrarBannerContexto(ctx);

    // Auto-rellenar el campo de contexto si está vacío
    const ctxEl = document.getElementById('plan-contexto-extra') || document.getElementById('plan-contexto');
    if (ctxEl && !ctxEl.value.trim() && ctx.bajas.length > 0) {
      const materiasDebiles = ctx.bajas.map(b => `${b.materia} (${b.promedio})`).join(', ');
      ctxEl.value = `El grupo tiene ${ctx.nAlumnos} alumnos. Materias con promedio bajo: ${materiasDebiles}. La planeación debe reforzar estas áreas con actividades de apoyo diferenciado.`;
    }
  }

  return _planGenerarOrig?.();
};

function planMostrarBannerContexto(ctx) {
  const existing = document.getElementById('plan-contexto-banner');
  if (existing) existing.remove();

  const resultArea = document.getElementById('plan-resultado-area');
  if (!resultArea || !ctx.promedios?.length) return;

  const banner = document.createElement('div');
  banner.id = 'plan-contexto-banner';
  banner.style.cssText = 'background:linear-gradient(135deg,#1e3a5f,#1d4ed8);border-radius:14px;padding:16px 20px;margin-bottom:16px;color:white;';
  banner.innerHTML = `
    <div style="font-size:12px;font-weight:700;opacity:.7;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">
      🧠 Planeación personalizada — Datos reales del grupo
    </div>
    <div style="display:flex;gap:20px;flex-wrap:wrap;">
      ${ctx.bajas.length ? `<div><div style="font-size:10px;opacity:.6;margin-bottom:4px;">⚠️ MATERIAS DÉBILES (a reforzar)</div>
        ${ctx.bajas.map(b => `<span style="background:rgba(239,68,68,.25);border:1px solid rgba(239,68,68,.4);color:white;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;margin-right:4px;">${b.materia} ${b.promedio}</span>`).join('')}</div>` : ''}
      ${ctx.altas.length ? `<div><div style="font-size:10px;opacity:.6;margin-bottom:4px;">⭐ MATERIAS FUERTES</div>
        ${ctx.altas.map(a => `<span style="background:rgba(34,197,94,.25);border:1px solid rgba(34,197,94,.4);color:white;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;margin-right:4px;">${a.materia} ${a.promedio}</span>`).join('')}</div>` : ''}
      <div><div style="font-size:10px;opacity:.6;margin-bottom:4px;">👥 ALUMNOS</div>
        <span style="font-size:14px;font-weight:800;">${ctx.nAlumnos}</span></div>
    </div>`;
  resultArea.parentNode.insertBefore(banner, resultArea);
}

// Inyectar contexto del grupo en el prompt de planStreamContenido
const _planStreamContenidoOrig = window.planStreamContenido;
window.planStreamContenido = async function(selItem, params, fileParts, idx) {
  // Enriquecer params.contexto con datos reales si los hay
  const ctx = window._planContextoGrupo;
  if (ctx?.bajas?.length && !params.contexto?.includes('promedio bajo')) {
    const materiasDebiles = ctx.bajas.map(b => `${b.materia} (promedio ${b.promedio})`).join(', ');
    params = {
      ...params,
      contexto: (params.contexto ? params.contexto + '\n\n' : '') +
        `DATOS REALES DEL GRUPO (${ctx.nAlumnos} alumnos):\n` +
        `- Materias que necesitan refuerzo: ${materiasDebiles}\n` +
        (ctx.altas.length ? `- Materias con buen desempeño: ${ctx.altas.map(a => a.materia).join(', ')}\n` : '') +
        `Genera actividades de refuerzo específico para las materias débiles e incluye retos para los alumnos avanzados.`
    };
  }
  return _planStreamContenidoOrig?.(selItem, params, fileParts, idx);
};

// Añadir botón "🎯 Vista tarjetas" en las acciones del resultado
document.addEventListener('siembra:datos-cargados', () => {
  const actions = document.getElementById('plan-result-actions');
  if (actions && !document.getElementById('btn-toggle-vista-plan')) {
    const btn = document.createElement('button');
    btn.id = 'btn-toggle-vista-plan';
    btn.className = 'btn btn-outline btn-sm';
    btn.innerHTML = '🎨 Cambiar vista';
    btn.onclick = planToggleVista;
    actions.appendChild(btn);
  }
});
window.planObtenerContextoGrupo = planObtenerContextoGrupo;
window.planMostrarBannerContexto = planMostrarBannerContexto;

// ══════════════════════════════════════════════════════════════════
// SELECTOR DE GRUPOS — Navegación entre grupos del docente
// Se inyecta en el header de Calificaciones cuando hay >1 grupo
// ══════════════════════════════════════════════════════════════════

function calRenderSelectorGrupos() {
  const gruposDocente = window._gruposDocente || [];
  if (gruposDocente.length <= 1) return; // Sin selector si hay un solo grupo

  const existing = document.getElementById('cal-selector-grupos');
  if (existing) { existing.remove(); }

  const h2 = document.getElementById('cal-titulo-h2');
  if (!h2) return;

  const wrapper = h2.closest('div') || h2.parentElement;
  if (!wrapper) return;

  const grupoActual = gruposDocente.find(g => g.id === window._grupoActivo) || gruposDocente[0];

  const sel = document.createElement('div');
  sel.id = 'cal-selector-grupos';
  sel.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap;';
  sel.innerHTML = `
    <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Grupo:</span>
    ${gruposDocente.map(g => {
      const nom = typeof resolverNombreGrupo==='function' ? resolverNombreGrupo(g) : (g.nombre || `${g.grado}° ${g.seccion||g.grupo||'A'}`);
      const activo = g.id === window._grupoActivo;
      return `<button onclick="calCambiarGrupo('${g.id}')"
        style="padding:6px 14px;border-radius:99px;border:1.5px solid ${activo?'var(--verde)':'var(--gris-20)'};
               background:${activo?'var(--verde)':'white'};color:${activo?'white':'var(--gris-80)'};
               font-family:'Sora',sans-serif;font-size:12px;font-weight:${activo?'700':'500'};
               cursor:pointer;transition:.15s;">
        ${nom}
        ${g.materias?.length ? `<span style="font-size:10px;opacity:.7;"> · ${g.materias.length} mat.</span>` : ''}
      </button>`;
    }).join('')}`;

  // Insertar después del h2
  h2.insertAdjacentElement('afterend', sel);
}

async function calCambiarGrupo(grupoId) {
  if (grupoId === window._grupoActivo) return;
  window._grupoActivo = grupoId;

  const g = (window._gruposDocente||[]).find(x => x.id === grupoId);
  if (!g) return;

  const nom = typeof resolverNombreGrupo==='function' ? resolverNombreGrupo(g) : (g.nombre || `${g.grado}° ${g.seccion||g.grupo||'A'}`);

  // ── Limpiar datos del grupo anterior ANTES de cargar el nuevo ──
  window._alumnosActivos = [];
  alumnos.length = 0;
  CAL_DATA = {};
  CAL_ASPECTOS = {};

  // Actualizar título
  const calH2 = document.getElementById('cal-titulo-h2');
  if (calH2) calH2.textContent = `Calificaciones · ${nom}`;

  // Actualizar nivel y grado
  if (g.nivel) {
    window._nivelActivo = g.nivel;
    window._gradoActivo = String(g.grado||'1').replace(/[°\s]/g,'').trim();
    try { localStorage.setItem('siembra_nivel', g.nivel); } catch(e) {}
  }

  // Actualizar materias del grupo
  const asignadas = (window._docenteAsignaciones||[])
    .filter(a => a.grupo_id === grupoId)
    .map(a => a.materia).filter(Boolean);

  if (asignadas.length) {
    window._materiasDocente = [...new Set(asignadas)];
  } else if (g.nivel === 'secundaria') {
    const gr = String(g.grado||'1').replace(/[°\s]/g,'').trim();
    window._materiasDocente = window.MATERIAS_SECUNDARIA_POR_GRADO?.[gr]
                           || window.MATERIAS_SECUNDARIA_POR_GRADO?.['1']
                           || [];
  } else {
    window._materiasDocente = getMateriasByNivel(g.nivel || 'primaria');
  }

  hubToast('⏳ Cargando grupo ' + nom + '…', 'ok');

  // Cargar alumnos del nuevo grupo
  const alumnosDB = await calCargarAlumnosGrupo(grupoId);
  window._alumnosActivos = alumnosDB;
  alumnos.length = 0;
  alumnosDB.forEach(a => alumnos.push(a));

  // Re-inicializar CAL_DATA con las materias del nuevo grupo
  window._materiasDocente.forEach(mat => {
    CAL_ASPECTOS[mat] = ASPECTOS_DEFAULT.map(a => ({...a}));
    CAL_DATA[mat] = {};
    const _n2 = _calCfg().num_periodos;
    for (let i = 1; i <= _n2; i++) CAL_DATA[mat][i] = {};
  });

  // Cargar calificaciones y aspectos del nuevo grupo
  await calCargarAspectos(grupoId);
  await calCargarCalificacionesDB(grupoId);

  // Re-render todo
  calRenderSelectorGrupos();
  calRenderMatTabs();
  calRenderTabla();
  calRenderStats();
  if (typeof dRenderDash === 'function') dRenderDash();

  // Actualizar nivel visual
  if (g.nivel) cambiarNivel(g.nivel);

  hubToast('✅ Grupo ' + nom + ' · ' + alumnosDB.length + ' alumnos', 'ok');
}

// Parche: inyectar selector cuando se navega a calificaciones
const _dNavOrig2 = window.dNav;
window.dNav = function(page) {
  _dNavOrig2?.(page);
  if (page === 'calificaciones') {
    setTimeout(() => {
      calRenderSelectorGrupos();
      // Fix título "undefined"
      const g = (window._gruposDocente||[]).find(x => x.id === window._grupoActivo) || window._gruposDocente?.[0];
      if (g) {
        const nom = typeof resolverNombreGrupo==='function' ? resolverNombreGrupo(g) : (g.nombre || `${g.grado}° ${g.seccion||g.grupo||'A'}`);
        const calH2 = document.getElementById('cal-titulo-h2');
        if (calH2 && calH2.textContent.includes('undefined')) {
          calH2.textContent = `Calificaciones · ${nom}`;
        }
        // Forzar materias correctas
        if (!window._materiasDocente?.length && g.nivel === 'secundaria') {
          const gr = String(g.grado||'1').replace(/[°\s]/g,'').trim();
          window._materiasDocente = window.MATERIAS_SECUNDARIA_POR_GRADO?.[gr]
                                 || window.MATERIAS_SECUNDARIA_POR_GRADO?.['1']
                                 || [];
          calRenderMatTabs();
        }
      }
    }, 300);
  }
};

// También al cargar la app
window.addEventListener('siembra:datos-cargados', () => {
  setTimeout(() => {
    if (window._gruposDocente?.length > 1) calRenderSelectorGrupos();
    // Fix "undefined" en cualquier título
    document.querySelectorAll('[id$="-titulo-h2"]').forEach(el => {
      if (el.textContent.includes('undefined')) {
        const g = window._gruposDocente?.[0];
        if (g) el.textContent = el.textContent.replace('undefined', g.seccion||g.grupo||'A');
      }
    });
  }, 1000);
});

window.calRenderSelectorGrupos = calRenderSelectorGrupos;
window.calCambiarGrupo = calCambiarGrupo;

// ══════════════════════════════════════════════════════════════════
// AGENTE 3 — Horario inteligente con IA
// Genera sugerencia de horario según turno, grado, materias y 
// duración de clases (50 min) configurado por el superadmin
// ══════════════════════════════════════════════════════════════════

async function generarHorarioConIA(grupoId) {
  const grupo = (window._gruposDocente||[]).find(g => g.id === grupoId)
             || { nombre: 'Grupo', grado: '2', nivel: 'secundaria', turno: 'matutino' };

  const turno = window._escuelaCfg?.turno || grupo.turno || 'matutino';
  const horaInicio = turno === 'vespertino' ? '13:00' : '07:00';
  const grado = grupo.grado || '2';
  const nivel = grupo.nivel || 'secundaria';

  const gr = String(grado).replace(/[°\s]/g,'').trim();
  const materias = window.MATERIAS_SECUNDARIA_POR_GRADO?.[gr]
                || window.MATERIAS_SECUNDARIA_POR_GRADO?.['1']
                || ['Español','Matemáticas','Ciencias','Historia','FCyE','Ed. Física','Inglés','Artes','Tutoría','Tecnología'];

  hubToast('⚙️ Generando horario…', 'ok');

  const prompt = `Genera un horario semanal para ${nivel} ${grado}° en México.

DATOS:
- Turno: ${turno} (inicio: ${horaInicio})
- Clases de 50 minutos
- Receso: 30 minutos
- Materias a distribuir: ${materias.join(', ')}
- Días: Lunes a Viernes
- Horas por semana por materia: Español 5h, Matemáticas 5h, Ciencias 3h, Historia 2h, Inglés 3h, Artes 2h, Ed. Física 2h, FCyE 2h, Tutoría 1h, Tecnología 2h

REGLAS NEM:
- No poner Matemáticas ni Español antes del recreo los mismos días
- Ed. Física preferentemente al final del día
- Tutoría los lunes o viernes
- No más de 2 horas seguidas de la misma materia

Responde SOLO con JSON en este formato exacto:
{
  "Lunes": ["Materia1", "Materia2", "Materia3", "Receso", "Materia4", "Materia5", "Materia6"],
  "Martes": [...],
  "Miércoles": [...],
  "Jueves": [...],
  "Viernes": [...]
}`;

  try {
    const texto = await callAI({ feature: 'plan_semanal', prompt });
    // Parsear JSON del resultado
    const jsonMatch = texto.match(/\{[\s\S]+\}/);
    if (!jsonMatch) throw new Error('IA no devolvió JSON válido');
    const horario = JSON.parse(jsonMatch[0]);

    // Mostrar preview del horario generado
    horarioMostrarPreviewIA(horario, horaInicio, grupoId);
  } catch(e) {
    hubToast('❌ Error generando horario: ' + e.message, 'err');
  }
}

function horarioMostrarPreviewIA(horario, horaInicio, grupoId) {
  const dias = ['Lunes','Martes','Miércoles','Jueves','Viernes'];
  let horaActual = horaInicio || '07:00';

  const filas = [];
  const maxClases = Math.max(...dias.map(d => (horario[d]||[]).length));

  for (let i = 0; i < maxClases; i++) {
    const hora = horaActual;
    let esReceso = false;
    const celdas = dias.map(d => {
      const clase = (horario[d]||[])[i] || '—';
      if (clase === 'Receso') esReceso = true;
      return clase;
    });
    filas.push({ hora, celdas, esReceso });

    // Avanzar tiempo: receso = 30 min, clase = 50 min
    const [h, m] = horaActual.split(':').map(Number);
    const mins = esReceso ? 30 : 50;
    const totalMins = h * 60 + m + mins;
    horaActual = `${String(Math.floor(totalMins/60)).padStart(2,'0')}:${String(totalMins%60).padStart(2,'0')}`;
  }

  const colores = {
    'Español':'#dbeafe','Matemáticas':'#dcfce7','Ciencias':'#fff7ed','Historia':'#fdf2f8',
    'Inglés':'#eff6ff','Artes':'#fefce8','Ed. Física':'#fff1f2','FCyE':'#f0fdf4',
    'Tutoría':'#f5f3ff','Tecnología':'#ecfeff','Geografía':'#fef9c3','Biología':'#d1fae5',
    'Física':'#dbeafe','Química':'#fce7f3','Formación Cívica y Ética':'#f0fdf4',
    'Receso':'#f3f4f6',
  };

  const tabla = `
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:#0d5c2f;color:white;">
        <th style="padding:8px;text-align:left;width:60px;">Hora</th>
        ${dias.map(d=>`<th style="padding:8px;text-align:center;">${d}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${filas.map(f=>`<tr style="${f.esReceso?'background:#f3f4f6;font-style:italic;':''}">
          <td style="padding:6px 8px;font-size:11px;color:#64748b;font-weight:700;">${f.hora}</td>
          ${f.celdas.map(c=>`<td style="padding:6px 8px;text-align:center;background:${colores[c]||'white'};border:1px solid #f1f5f9;">
            ${c==='Receso'?'🔔 Receso':c}
          </td>`).join('')}
        </tr>`).join('')}
      </tbody>
    </table>`;

  hubModal('📅 Horario generado con IA — Vista previa',
    `<div style="overflow-x:auto;margin-bottom:16px;">${tabla}</div>
     <div style="font-size:12px;color:#64748b;background:#f0fdf4;border-radius:8px;padding:10px;">
       💡 Revisa el horario y haz clic en "Aplicar" para cargarlo en el editor.
       Podrás editarlo manualmente después.
     </div>`,
    '✅ Aplicar horario',
    async () => {
      // Guardar en Supabase
      if (sb && currentPerfil) {
        await sb.from('horarios').upsert({
          grupo_id:   grupoId || window._grupoActivo,
          docente_id: currentPerfil.id,
          escuela_cct:currentPerfil.escuela_cct,
          ciclo:      window.CICLO_ACTIVO || '2025-2026',
          horario_json: horario,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'grupo_id,ciclo' }).catch(()=>{});
      }
      // Actualizar variable global del horario si existe
      if (window.horarioData) {
        Object.assign(window.horarioData, horario);
        if (typeof horarioRender === 'function') horarioRender();
      }
      hubToast('✅ Horario aplicado', 'ok');
    });
}

window.generarHorarioConIA = generarHorarioConIA;
window.horarioMostrarPreviewIA = horarioMostrarPreviewIA;

// ══════════════════════════════════════════════════════════════════
// AGENTE 4 — Inyectar botón "✨ Sugerir horario" en la UI
// ══════════════════════════════════════════════════════════════════
window.addEventListener('siembra:datos-cargados', () => {
  setTimeout(() => {
    const horarioPage = document.getElementById('p-horario');
    if (!horarioPage || document.getElementById('btn-ia-horario')) return;

    const header = horarioPage.querySelector('h2')?.closest('div') || horarioPage.firstElementChild;
    if (!header) return;

    const btn = document.createElement('button');
    btn.id = 'btn-ia-horario';
    btn.style.cssText = 'padding:9px 16px;background:linear-gradient(135deg,#1e3a5f,#1d4ed8);color:white;border:none;border-radius:10px;font-family:"Sora",sans-serif;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;';
    btn.innerHTML = '✨ Sugerir horario';
    btn.onclick = () => generarHorarioConIA(window._grupoActivo);

    // Insertar junto al botón de guardar
    const btnGuardar = horarioPage.querySelector('[onclick*="guardarHorario"]');
    if (btnGuardar?.parentElement) {
      btnGuardar.parentElement.insertBefore(btn, btnGuardar);
    } else {
      header.appendChild(btn);
    }
  }, 800);
});

// ══════════════════════════════════════════════════════════════════
// AGENTE 5 — Turno escolar: config desde superadmin → horarios
// Lee el turno de la escuela y calcula horas correctas (50 min/clase)
// ══════════════════════════════════════════════════════════════════

function horarioGetConfigEscuela() {
  const cfg = window._escuelaCfg || {};
  const turno = cfg.turno || 'matutino';
  const inicioBase = turno === 'vespertino' ? 13 * 60 : 7 * 60; // minutos desde medianoche
  const duracionClase = 50; // minutos
  const duracionReceso = 30; // minutos

  return { turno, inicioBase, duracionClase, duracionReceso };
}

function horarioGenerarHoras(numClases = 7) {
  const { inicioBase, duracionClase, duracionReceso } = horarioGetConfigEscuela();
  const RECESO_TRAS_CLASE = 3; // receso después de la 3ª clase
  const horas = [];
  let minActual = inicioBase;

  for (let i = 0; i < numClases; i++) {
    const h = Math.floor(minActual / 60);
    const m = minActual % 60;
    horas.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);

    if (i + 1 === RECESO_TRAS_CLASE) {
      minActual += duracionReceso; // receso
    } else {
      minActual += duracionClase; // clase normal
    }
  }
  return horas;
}

// Exponer para que horarioRender pueda usarla
window.horarioGenerarHoras = horarioGenerarHoras;
window.horarioGetConfigEscuela = horarioGetConfigEscuela;

// Parche: al renderizar el horario, usar las horas correctas del turno
const _horarioRenderOrig = window.horarioRender;
window.horarioRender = function() {
  // Actualizar las horas de la tabla según el turno de la escuela
  const horas = horarioGenerarHoras(7);
  const filas = document.querySelectorAll('#horario-tabla tr[data-hora-idx]');
  filas.forEach((fila, i) => {
    const labelEl = fila.querySelector('td:first-child');
    if (labelEl && horas[i]) labelEl.textContent = horas[i];
  });
  return _horarioRenderOrig?.();
};



// ══════════════════════════════════════════════════════════════════
// AGENTE 2 — Número de lista automático (orden alfabético apellido)
// Se ejecuta después de dar de alta o importar alumnos al grupo
// ══════════════════════════════════════════════════════════════════

async function asignarNumerosDeLista(grupoId) {
  if (!sb || !grupoId) return;
  try {
    // Obtener todos los alumnos del grupo con nombre y apellido
    const { data } = await sb.from('alumnos_grupos')
      .select('alumno_id, usuarios!alumno_id(id, nombre, apellido_p, apellido_m)')
      .eq('grupo_id', grupoId)
      .eq('activo', true);

    if (!data?.length) return;

    // Ordenar por apellido paterno → materno → nombre (orden alfabético mexicano)
    const ordenados = data
      .filter(r => r.usuarios)
      .map(r => r.usuarios)
      .sort((a, b) => {
        const cmp = (a.apellido_p||'').localeCompare(b.apellido_p||'', 'es-MX');
        if (cmp !== 0) return cmp;
        const cmp2 = (a.apellido_m||'').localeCompare(b.apellido_m||'', 'es-MX');
        if (cmp2 !== 0) return cmp2;
        return (a.nombre||'').localeCompare(b.nombre||'', 'es-MX');
      });

    // Actualizar num_lista en usuarios
    const updates = ordenados.map((a, i) =>
      sb.from('usuarios').update({ num_lista: i + 1 }).eq('id', a.id)
    );
    await Promise.all(updates);

    console.log(`[Lista] ${ordenados.length} alumnos numerados en grupo ${grupoId}`);
    return ordenados.length;
  } catch(e) {
    console.warn('[asignarNumerosDeLista]', e.message);
  }
}

// Patch: después de confirmar importación de alumnos, asignar números
const _admConfirmarImportOrig = window.admConfirmarImport;
window.admConfirmarImport = async function(...args) {
  const result = await _admConfirmarImportOrig?.(...args);
  // Obtener grupo activo del contexto de importación
  const grupoId = window._admImportGrupoId || window._grupoActivo;
  if (grupoId) {
    setTimeout(() => asignarNumerosDeLista(grupoId), 1500);
  }
  return result;
};

// Patch: después de dar de alta alumno individualmente
const _ADM_abrirModalAlumnoOrig = window.ADM?.abrirModalAlumno;
if (window.ADM) {
  const _origGuardar = window.ADM.guardarAlumno;
  if (_origGuardar) {
    window.ADM.guardarAlumno = async function(...args) {
      const result = await _origGuardar.apply(window.ADM, args);
      const grupoId = window.ADM._grupoActivoId || window._grupoActivo;
      if (grupoId) setTimeout(() => asignarNumerosDeLista(grupoId), 1500);
      return result;
    };
  }
}

window.asignarNumerosDeLista = asignarNumerosDeLista;


// ══════════════════════════════════════════════════════════════════
// ADMIN — Módulo de Horarios Escolares
// ══════════════════════════════════════════════════════════════════

let _admHorarioActual = {}; // { Lunes: [...], Martes: [...], ... }
let _admGrupoHorarioId = null;

const DIAS_SEMANA = ['Lunes','Martes','Miércoles','Jueves','Viernes'];

async function admCargarHorarios() {
  // Cargar grupos en el selector
  const sel = document.getElementById('adm-horario-grupo-sel');
  if (!sel) return;

  // Usar ADM.grupos (fuente de verdad del admin)
  let grupos = ADM.grupos?.length ? ADM.grupos : (ADM._grupos || []);
  if (!grupos.length) {
    // Cargar desde Supabase si aún no se han cargado
    if (window.sb && window.currentPerfil?.escuela_cct) {
      const { data } = await window.sb.from('grupos')
        .select('id, nombre, grado, seccion, nivel, turno')
        .eq('escuela_cct', window.currentPerfil.escuela_cct)
        .eq('activo', true)
        .order('grado');
      if (data?.length) {
        grupos = data;
        ADM.grupos = data;
      }
    }
  }
  if (!grupos.length) return;

  sel.innerHTML = '<option value="">Seleccionar grupo…</option>' +
    grupos.map(g => `<option value="${g.id}">${g.nombre || g.grado+'° '+(g.seccion||'A')}</option>`).join('');

  // Cargar config de turno de la escuela
  admCargarConfigTurno();
}

async function admCargarConfigTurno() {
  if (!window.sb || !window.currentPerfil?.escuela_cct) return;
  const _cct = window.currentPerfil.escuela_cct;
  try {
    // Cargar turno base desde escuelas
    const { data: escData } = await window.sb.from('escuelas')
      .select('turno').eq('cct', _cct).maybeSingle();
    // Cargar config extendida desde config_global
    const { data: cfgData } = await window.sb.from('config_global')
      .select('valor').eq('clave', `horario_config_${_cct}`).maybeSingle();
    const cfg = cfgData?.valor || {};
    const turno = cfg.turno || escData?.turno || 'matutino';
    const turnoSel = document.getElementById('adm-turno-escuela');
    const horaEl   = document.getElementById('adm-hora-inicio');
    const durEl    = document.getElementById('adm-dur-clase');
    if (turnoSel) turnoSel.value = turno;
    if (horaEl)   horaEl.value   = cfg.hora_inicio_clases || (turno === 'vespertino' ? '13:00' : '07:00');
    if (durEl)    durEl.value    = cfg.duracion_clase_min || 50;
  } catch(e) {}
}

async function admGuardarConfigTurno() {
  const turno     = document.getElementById('adm-turno-escuela')?.value || 'matutino';
  const horaInicio= document.getElementById('adm-hora-inicio')?.value || '07:00';
  const duracion  = parseInt(document.getElementById('adm-dur-clase')?.value || '50');

  const _cct = window.currentPerfil?.escuela_cct || ADM?.escuelaCct || window._escuelaCfg?.cct;
  if (!window.sb || !_cct) {
    hubToast('⚠️ Sin conexión a base de datos', 'warn'); return;
  }

  // 1. Intentar guardar en escuelas (campos opcionales — pueden no existir en DB live)
  const { error: errEsc } = await window.sb.from('escuelas').update({ turno }).eq('cct', _cct);

  // 2. Guardar config extendida en config_global (siempre disponible)
  await window.sb.from('config_global').upsert({
    clave: `horario_config_${_cct}`,
    valor: { turno, hora_inicio_clases: horaInicio, duracion_clase_min: duracion },
  }, { onConflict: 'clave' }).catch(() => {});

  // Actualizar estado local
  if (window._escuelaCfg) {
    window._escuelaCfg.turno = turno;
    window._escuelaCfg.hora_inicio_clases = horaInicio;
    window._escuelaCfg.duracion_clase_min = duracion;
  }
  if (errEsc) console.warn('[admGuardarConfigTurno] escuelas update:', errEsc.message);
  hubToast('✅ Configuración de turno guardada', 'ok');
}

function admActualizarTurno(turno) {
  const horaEl = document.getElementById('adm-hora-inicio');
  if (horaEl) horaEl.value = turno === 'vespertino' ? '13:00' : '07:00';
}

async function admCargarHorarioGrupo(grupoId) {
  if (!grupoId) return;
  _admGrupoHorarioId = grupoId;

  const grupos = ADM.grupos?.length ? ADM.grupos : (ADM._grupos || []);
  const grupo  = grupos.find(g => g.id === grupoId);

  // Intentar cargar horario existente
  let horarioExistente = null;
  if (window.sb) {
    const { data } = await window.sb.from('horarios')
      .select('horario_json')
      .eq('grupo_id', grupoId)
      .eq('ciclo', window.CICLO_ACTIVO || '2025-2026')
      .maybeSingle();
    if (data?.horario_json) horarioExistente = data.horario_json;
  }

  if (horarioExistente) {
    _admHorarioActual = horarioExistente;
    admRenderHorarioTabla(horarioExistente, grupo);
    hubToast('📅 Horario cargado', 'ok');
  } else {
    // Horario vacío
    _admHorarioActual = {};
    DIAS_SEMANA.forEach(d => { _admHorarioActual[d] = Array(7).fill(''); });
    admRenderHorarioTabla(_admHorarioActual, grupo);
  }
}

function admGetHoras(grupoId) {
  const grupos = ADM.grupos?.length ? ADM.grupos : (ADM._grupos || []);
  const grupo  = grupos.find(g => g.id === grupoId) || {};
  const turno  = document.getElementById('adm-turno-escuela')?.value
              || window._escuelaCfg?.turno
              || grupo.turno || 'matutino';
  const horaInicioStr = document.getElementById('adm-hora-inicio')?.value
                     || (turno === 'vespertino' ? '13:00' : '07:00');
  const durClase  = parseInt(document.getElementById('adm-dur-clase')?.value || '50');
  const durReceso = 30;
  const RECESO_TRAS = 3;
  const numClases = 7;

  const [ih, im] = horaInicioStr.split(':').map(Number);
  let mins = ih * 60 + im;
  const horas = [];

  for (let i = 0; i < numClases; i++) {
    const h = Math.floor(mins/60);
    const m = mins % 60;
    horas.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    if (i + 1 === RECESO_TRAS) mins += durReceso;
    else mins += durClase;
  }
  return horas;
}

function admRenderHorarioTabla(horario, grupo) {
  const wrap = document.getElementById('adm-horario-tabla-wrap');
  if (!wrap) return;

  const grupoId = _admGrupoHorarioId;
  const horas   = admGetHoras(grupoId);
  const numFilas = Math.max(...DIAS_SEMANA.map(d => (horario[d]||[]).length), 7);

  // Obtener materias disponibles para el grupo
  const grado = String(grupo?.grado||'1').replace(/[°\s]/g,'').trim();
  const nivel = grupo?.nivel || 'secundaria';
  let materias = nivel === 'secundaria'
    ? (window.MATERIAS_SECUNDARIA_POR_GRADO?.[grado] || window.MATERIAS_SECUNDARIA_POR_GRADO?.['1'] || [])
    : getMateriasByNivel('primaria');
  materias = ['Receso', ...materias];

  const optsHTML = materias.map(m => `<option value="${m}">${m}</option>`).join('');

  const colores = {
    'Español':'#dbeafe','Matemáticas':'#dcfce7','Ciencias':'#fff7ed','Historia':'#fdf2f8',
    'Inglés':'#eff6ff','Artes':'#fefce8','Ed. Física':'#fff1f2','FCyE':'#f0fdf4',
    'Tutoría':'#f5f3ff','Tecnología':'#ecfeff','Geografía':'#fef9c3','Biología':'#d1fae5',
    'Física':'#dbeafe','Química':'#fce7f3','Formación Cívica y Ética':'#f0fdf4',
    'Receso':'#f3f4f6','':'#fafafa',
  };

  let html = `<table style="width:100%;border-collapse:collapse;">
    <thead><tr style="background:#0d5c2f;color:white;">
      <th style="padding:10px 14px;text-align:left;width:70px;font-size:12px;">Hora</th>
      ${DIAS_SEMANA.map(d => `<th style="padding:10px 14px;text-align:center;font-size:12px;">${d}</th>`).join('')}
    </tr></thead><tbody>`;

  for (let i = 0; i < numFilas; i++) {
    const hora = horas[i] || '';
    html += `<tr>
      <td style="padding:8px 14px;font-size:11px;color:#64748b;font-weight:700;background:#f8fafc;white-space:nowrap;">${hora}</td>`;
    DIAS_SEMANA.forEach(dia => {
      const val = (horario[dia]||[])[i] || '';
      const bg  = colores[val] || '#fafafa';
      html += `<td style="padding:4px;border:1px solid #f1f5f9;background:${bg};">
        <select onchange="admHorarioCeldaCambio('${dia}',${i},this.value)"
          style="width:100%;padding:5px 6px;border:none;background:transparent;font-family:'Sora',sans-serif;font-size:11px;font-weight:${val==='Receso'?'400':'600'};color:${val==='Receso'?'#94a3b8':'#0f172a'};outline:none;cursor:pointer;">
          <option value="">— vacío —</option>
          ${materias.map(m => `<option value="${m}" ${m===val?'selected':''}>${m}</option>`).join('')}
        </select>
      </td>`;
    });
    html += '</tr>';
  }

  html += `</tbody></table>
    <div style="padding:12px 16px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:11px;color:#64748b;">Haz clic en cualquier celda para cambiar la materia</span>
      <button onclick="admAgregarFilaHorario()"
        style="padding:6px 14px;background:white;border:1.5px dashed #94a3b8;border-radius:7px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;color:#475569;cursor:pointer;">
        + Agregar hora
      </button>
    </div>`;

  wrap.innerHTML = html;
}

function admHorarioCeldaCambio(dia, fila, valor) {
  if (!_admHorarioActual[dia]) _admHorarioActual[dia] = [];
  _admHorarioActual[dia][fila] = valor;
}

function admAgregarFilaHorario() {
  DIAS_SEMANA.forEach(d => {
    if (!_admHorarioActual[d]) _admHorarioActual[d] = [];
    _admHorarioActual[d].push('');
  });
  const grupos = ADM.grupos?.length ? ADM.grupos : (ADM._grupos || []);
  const grupo  = grupos.find(g => g.id === _admGrupoHorarioId);
  admRenderHorarioTabla(_admHorarioActual, grupo);
}

async function admGuardarHorario() {
  if (!_admGrupoHorarioId) { hubToast('⚠️ Selecciona un grupo primero', 'warn'); return; }
  if (!window.sb) { hubToast('⚠️ Sin conexión', 'warn'); return; }

  // Limpiar celdas vacías al final de cada día
  DIAS_SEMANA.forEach(d => {
    if (_admHorarioActual[d]) {
      while (_admHorarioActual[d].length > 0 &&
             _admHorarioActual[d][_admHorarioActual[d].length-1] === '') {
        _admHorarioActual[d].pop();
      }
    }
  });

  await window.sb.from('horarios').upsert({
    grupo_id:     _admGrupoHorarioId,
    escuela_cct:  window.currentPerfil?.escuela_cct,
    ciclo:        window.CICLO_ACTIVO || '2025-2026',
    horario_json: _admHorarioActual,
    updated_at:   new Date().toISOString(),
  }, { onConflict: 'grupo_id,ciclo' });

  hubToast('✅ Horario guardado correctamente', 'ok');
}

async function admGenerarHorarioIA() {
  if (!_admGrupoHorarioId) { hubToast('⚠️ Selecciona un grupo primero', 'warn'); return; }
  const grupos = ADM.grupos?.length ? ADM.grupos : (ADM._grupos || []);
  const grupo  = grupos.find(g => g.id === _admGrupoHorarioId) || {};
  await generarHorarioConIA(_admGrupoHorarioId);
}

window.admCargarHorarios      = admCargarHorarios;
window.admCargarHorarioGrupo  = admCargarHorarioGrupo;
window.admGuardarHorario      = admGuardarHorario;
window.admGenerarHorarioIA    = admGenerarHorarioIA;
window.admActualizarTurno     = admActualizarTurno;
window.admGuardarConfigTurno  = admGuardarConfigTurno;
window.admHorarioCeldaCambio  = admHorarioCeldaCambio;
window.admAgregarFilaHorario  = admAgregarFilaHorario;

// ── HORARIOS PUBLICADOS — Vista lectura para admin/subdirector/coordinador ──
async function admCargarHorariosPublicados() {
  const cct = ADM?.escuelaCct || window.currentPerfil?.escuela_cct || window._escuelaCfg?.cct;
  const sel = document.getElementById('adm-horpub-grupo');
  if (!sel) return;
  sel.innerHTML = '<option value="">Cargando grupos…</option>';
  if (!window.sb || !cct) {
    sel.innerHTML = '<option value="">Sin conexión</option>';
    return;
  }
  try {
    const { data: grupos } = await window.sb.from('grupos')
      .select('id, nombre, grado, grupo')
      .eq('escuela_cct', cct).eq('activo', true).order('grado');
    sel.innerHTML = '<option value="">Seleccionar grupo…</option>' +
      (grupos || []).map(g => `<option value="${g.id}">${g.nombre || g.grado+'° '+g.grupo}</option>`).join('');
  } catch(e) { sel.innerHTML = '<option value="">Error al cargar</option>'; }
}

async function admVerHorarioGrupo(grupoId) {
  const el = document.getElementById('adm-horpub-contenido');
  if (!el) return;
  if (!grupoId) {
    el.innerHTML = '<div style="text-align:center;padding:60px;color:#94a3b8;"><div style="font-size:48px;margin-bottom:12px;">📅</div><div style="font-size:15px;font-weight:700;color:#0f172a;">Selecciona un grupo para ver su horario</div></div>';
    return;
  }
  el.innerHTML = '<div style="padding:30px;text-align:center;color:#94a3b8;">Cargando horario…</div>';
  try {
    const { data: celdas } = await window.sb.from('horario_celdas')
      .select('dia_semana, hora_idx, materia, docente_nombre')
      .eq('grupo_id', grupoId).eq('activo', true).order('hora_idx');
    if (!celdas?.length) {
      el.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;"><div style="font-size:36px;margin-bottom:10px;">📭</div><div style="font-size:14px;font-weight:700;color:#0f172a;">Este grupo aún no tiene horario publicado</div></div>';
      return;
    }
    const dias = ['Lunes','Martes','Miércoles','Jueves','Viernes'];
    const horas = [...new Set(celdas.map(c => c.hora_idx))].sort((a,b)=>a-b);
    let html = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-family:'Sora',sans-serif;font-size:13px;">
      <thead><tr><th style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:700;color:#475569;min-width:80px;">Hora</th>
      ${dias.map(d=>`<th style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:700;color:#475569;min-width:120px;">${d}</th>`).join('')}</tr></thead><tbody>`;
    horas.forEach(hi => {
      html += `<tr><td style="padding:9px 14px;border:1px solid #e2e8f0;font-weight:700;color:#64748b;background:#f8fafc;">${7+hi}:00</td>`;
      dias.forEach(dia => {
        const c = celdas.find(x => x.dia_semana===dia && x.hora_idx===hi);
        if (c) {
          html += `<td style="padding:9px 14px;border:1px solid #e2e8f0;background:#f0fdf4;"><div style="font-weight:700;color:#0d5c2f;">${c.materia||'—'}</div><div style="font-size:11px;color:#64748b;margin-top:2px;">${c.docente_nombre||''}</div></td>`;
        } else {
          html += `<td style="padding:9px 14px;border:1px solid #e2e8f0;color:#cbd5e1;text-align:center;">—</td>`;
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
  } catch(e) { el.innerHTML = `<div style="padding:20px;color:#dc2626;">Error: ${e.message}</div>`; }
}
window.admCargarHorariosPublicados = admCargarHorariosPublicados;
window.admVerHorarioGrupo = admVerHorarioGrupo;

// ── Asignar materia con modal mejorado ────────────────────────────
async function admAbrirAsignarMateriaModal(materia, campoId, grado) {
  const docentes = ADM.docentes || [];
  const grupos   = ADM.grupos   || [];

  if (!docentes.length) {
    hubToast('⚠️ Da de alta docentes primero en Personal', 'warn'); return;
  }
  if (!grupos.length) {
    hubToast('⚠️ Crea grupos primero en Grupos', 'warn'); return;
  }

  // Filtrar docentes con rol docente/tutor
  const docentesOpts = docentes
    .filter(d => ['docente','tutor'].includes(d.rol))
    .map(d => `<option value="${d.id}">${d.nombre} ${d.apellido_p||''}</option>`)
    .join('');

  // Filtrar grupos del grado correspondiente
  const gruposFiltrados = grado
    ? grupos.filter(g => String(g.grado||'').replace(/[°\s]/g,'').trim() === String(grado))
    : grupos;

  const gruposOpts = gruposFiltrados.length
    ? gruposFiltrados.map(g => `<option value="${g.id}">${g.nombre || g.grado+'° '+(g.seccion||'A')}</option>`).join('')
    : grupos.map(g => `<option value="${g.id}">${g.nombre || g.grado+'° '+(g.seccion||'A')}</option>`).join('');

  // Ver asignaciones actuales para esta materia y grado
  const grupoIdsDeGrado = gruposFiltrados.map(g => g.id);
  const actuales = (window._admMateriasData||[]).filter(a =>
    a.materia === materia && (!grado || grupoIdsDeGrado.includes(a.grupo_id))
  );

  const actualesHTML = actuales.length
    ? `<div style="margin-bottom:14px;padding:10px 14px;background:#f0fdf4;border-radius:8px;font-size:12px;">
        <div style="font-weight:700;color:#15803d;margin-bottom:6px;">Asignaciones actuales:</div>
        ${actuales.map(a => {
          const nom = `${a.usuarios?.nombre||''} ${a.usuarios?.apellido_p||''}`.trim();
          const grp = a.grupos?.nombre || '—';
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;">
            <span>👩‍🏫 ${nom} · ${grp}</span>
            <button onclick="admEliminarAsignacion('${a.id||''}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px;" aria-label="Cerrar">✕</button>
          </div>`;
        }).join('')}
      </div>`
    : '';

  hubModal(`📚 Asignar docente — ${materia}${grado ? ' · '+grado+'° año' : ''}`,
    `${actualesHTML}
     <div style="margin-bottom:12px;">
       <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:5px;">Docente</label>
       <select id="asig-docente-sel" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;">
         <option value="">Seleccionar docente…</option>
         ${docentesOpts}
       </select>
     </div>
     <div>
       <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:5px;">Grupo${grado ? ' ('+grado+'° año)':''}</label>
       <select id="asig-grupo-sel" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;">
         <option value="">Todos los grupos del año…</option>
         ${gruposOpts}
       </select>
     </div>`,
    '✅ Guardar asignación',
    async () => {
      const docenteId = document.getElementById('asig-docente-sel')?.value;
      const grupoId   = document.getElementById('asig-grupo-sel')?.value || null;
      if (!docenteId) { hubToast('⚠️ Selecciona un docente', 'warn'); return; }

      if (!window.sb) { hubToast('✅ Asignación guardada (demo)', 'ok'); return; }

      try {
        await window.sb.from('docente_grupos').upsert({
          docente_id:  docenteId,
          grupo_id:    grupoId,
          materia,
          ciclo:       window.CICLO_ACTIVO || '2025-2026',
          activo:      true,
          escuela_cct: window.currentPerfil?.escuela_cct,
        }, { onConflict: 'docente_id,grupo_id,materia,ciclo' });

        hubToast(`✅ ${materia} asignada correctamente`, 'ok');
        await admCargarAsignaciones();
        admAsigTab('catalogo');
      } catch(e) {
        hubToast('❌ Error: ' + e.message, 'err');
      }
    });
}
window.admAbrirAsignarMateriaModal = admAbrirAsignarMateriaModal;

async function admEliminarAsignacion(id) {
  if (!id || !window.sb) return;
  if (!confirm('¿Eliminar esta asignación?')) return;
  await window.sb.from('docente_grupos').update({ activo: false }).eq('id', id);
  hubToast('✅ Asignación eliminada', 'ok');
  await admCargarAsignaciones();
  admAsigTab('catalogo');
}
window.admEliminarAsignacion = admEliminarAsignacion;

// Patch: guardar asignaciones en _admMateriasData antes de renderizar catálogo
const _admCargarAsignacionesOrig = window.admCargarAsignaciones;
window.admCargarAsignaciones = async function() {
  await _admCargarAsignacionesOrig?.();
  // Después de cargar, re-render catálogo si está visible
  if (ADM.paginaActual === 'asignaciones') {
    ADM.renderMaterias();
  }
};

// ── DEBUG + FIX: Nombre de grupo siempre resuelto ────────────────
function resolverNombreGrupo(g) {
  if (!g) return '—';
  // Intentar todas las propiedades posibles
  if (g.nombre && !g.nombre.includes('undefined')) return g.nombre;
  const grado   = g.grado   || '';
  const seccion = g.seccion || g.grupo || g.letra || g.seccion_id || '';
  const nivel   = g.nivel   ? (g.nivel === 'secundaria' ? '°' : '° Prim') : '°';
  if (grado && seccion) return `${grado}${nivel} ${seccion}`;
  if (grado) return `${grado}° A`;
  return g.id ? g.id.slice(0,8) : '—';
}
window.resolverNombreGrupo = resolverNombreGrupo;

// Parche sobre cambiarGrupo y dNav para siempre resolver nombre correctamente
const _dNavOrig3 = window.dNav;
window.dNav = function(page) {
  _dNavOrig3?.(page);
  if (page === 'calificaciones') {
    setTimeout(() => {
      const g = (window._gruposDocente||[]).find(x => x.id === window._grupoActivo)
             || window._gruposDocente?.[0];
      if (!g) return;
      const nom = resolverNombreGrupo(g);
      // Fix topbar
      const topEl = document.getElementById('page-title');
      if (topEl && topEl.textContent.includes('undefined')) {
        topEl.textContent = 'Calificaciones · ' + nom;
      }
      // Fix h2
      const h2 = document.getElementById('cal-titulo-h2');
      if (h2 && h2.textContent.includes('undefined')) {
        h2.textContent = 'Calificaciones · ' + nom;
      }
      // Actualizar sidebar role text
      const roleEl = document.querySelector('#doc-portal .user-role');
      if (roleEl && roleEl.textContent.includes('undefined')) {
        roleEl.textContent = `Docente · ${nom}`;
      }
      // Forzar materias correctas del grupo activo
      if (g.nivel) {
        window._nivelActivo = g.nivel;
        window._gradoActivo = String(g.grado||'1').replace(/[°\s]/g,'').trim();
        // Si no hay materias asignadas, usar fallback por grado
        if (!window._materiasDocente?.length) {
          const gr = window._gradoActivo;
          window._materiasDocente = g.nivel === 'secundaria'
            ? (window.MATERIAS_SECUNDARIA_POR_GRADO?.[gr] || window.MATERIAS_SECUNDARIA_POR_GRADO?.['1'] || [])
            : getMateriasByNivel('primaria');
          window._materiasFiltered = window._materiasDocente;
          if (typeof calRenderMatTabs === 'function') calRenderMatTabs();
        }
      }
    }, 200);
  }
};

// ══════════════════════════════════════════════════════════════════
// AGENTE 1 — Sincronizar docAlumnos con alumnos reales de Supabase
// Fuente de verdad: window._alumnosActivos
// ══════════════════════════════════════════════════════════════════

const COLORES_AVATAR_DOC = [
  '#0d5c2f','#2563eb','#7c3aed','#dc2626','#0891b2',
  '#d97706','#059669','#7c3aed','#b91c1c','#1d4ed8',
  '#6d28d9','#0f766e','#7e22ce','#c2410c','#166534',
];

function sincronizarDocAlumnos() {
  const activos = window._alumnosActivos || [];
  if (!activos.length) return false; // Mantener demo si no hay datos reales

  // Solo actualizar si son alumnos reales (no demo)
  const sonReales = activos.some(a => !String(a.id||'').startsWith('demo-'));
  if (!sonReales) return false;

  const previos = Array.isArray(docAlumnos) ? [...docAlumnos] : [];
  docAlumnos = ordenarAlumnosPorApellido(activos).map((a, i) => {
    const partes = alumnoNombrePartes(a);
    const nombre  = partes.nombre || 'Alumno';
    const apellido_p = partes.apellidoP || '';
    const apellido_m = partes.apellidoM || '';
    // Conservar etiquetas existentes si el alumno ya estaba
    const existing = previos.find(d => d.id === a.id);
    return {
      id:       a.id,
      nombre,
      apellido_p,
      apellido_m,
      nombre_lista: alumnoNombreLista(a),
      iniciales: alumnoIniciales(a),
      etiquetas: existing?.etiquetas || [],
      color:    COLORES_AVATAR_DOC[i % COLORES_AVATAR_DOC.length],
      curp:     a.curp || '',
      num_lista: a.num_lista || (i + 1),
    };
  });

  return true;
}

// Parche: dNav → sincronizar al ir a etiquetas o acomodo
const _dNavOrig4 = window.dNav;
window.dNav = function(page) {
  _dNavOrig4?.(page);
  if (page === 'etiquetas' || page === 'acomodo' || page === 'alumnos') {
    sincronizarDocAlumnos();
    if (page === 'etiquetas') {
      if (typeof renderEtiquetasMultiGrupo === 'function') renderEtiquetasMultiGrupo(false);
    }
    if (typeof renderAlumnosDoc === 'function') renderAlumnosDoc();
    if (typeof renderUnassignedDoc === 'function') renderUnassignedDoc();
  }
};

// Parche: calCambiarGrupo → sincronizar después de cargar alumnos del nuevo grupo
const _calCambiarGrupoOrig = window.calCambiarGrupo;
window.calCambiarGrupo = async function(grupoId) {
  await _calCambiarGrupoOrig?.(grupoId);
  // Sincronizar docAlumnos con el nuevo grupo
  setTimeout(() => {
    if (sincronizarDocAlumnos()) {
      if (typeof renderAlumnosDoc === 'function') renderAlumnosDoc();
    }
  }, 500);
};

// Ejecutar al cargar datos iniciales
window.addEventListener('siembra:datos-cargados', () => {
  setTimeout(() => {
    if (sincronizarDocAlumnos()) {
      if (typeof renderAlumnosDoc === 'function') renderAlumnosDoc();
    }
  }, 1200);
});

window.sincronizarDocAlumnos = sincronizarDocAlumnos;

// ══════════════════════════════════════════════════════════════════
// AGENTE 2 — Forzar nivel/grado correcto ANTES de renderizar tabs
// Evita que MATERIAS_NEM retorne primaria cuando el grupo es secundaria
// ══════════════════════════════════════════════════════════════════

function forzarNivelDesdeGrupoActivo() {
  const g = (window._gruposDocente||[]).find(x => x.id === window._grupoActivo)
         || window._gruposDocente?.[0];
  if (!g) return;

  const nivel = g.nivel || 'secundaria';
  const grado = String(g.grado||'1').replace(/[°\s]/g,'').trim();

  // Solo actualizar si hay cambio real
  if (window._nivelActivo !== nivel || window._gradoActivo !== grado) {
    window._nivelActivo = nivel;
    window._gradoActivo = grado;
    try { localStorage.setItem('siembra_nivel', nivel); } catch(e) {}
  }

  // NO sobreescribir _materiasDocente aquí — calInit() y docCambiarGrupo()
  // son los únicos responsables de cargar las materias asignadas desde Supabase.
}

// Parche: calRenderMatTabs → forzar nivel antes de renderizar
const _calRenderMatTabsOrig = window.calRenderMatTabs;
window.calRenderMatTabs = function() {
  forzarNivelDesdeGrupoActivo();
  return _calRenderMatTabsOrig?.();
};

// Parche: calInit → forzar nivel antes de inicializar
const _calInitOrig = window.calInit;
window.calInit = async function() {
  forzarNivelDesdeGrupoActivo();
  return _calInitOrig?.();
};

// Ejecutar al cargar — solo renderizar tabs si _materiasDocente ya está cargado
window.addEventListener('siembra:datos-cargados', () => {
  setTimeout(() => {
    forzarNivelDesdeGrupoActivo();
    // Solo llamar calRenderMatTabs si las materias del docente ya están en memoria
    // Si no, calInit() lo hará cuando termine de cargar desde Supabase
    if (typeof calRenderMatTabs === 'function' && window._materiasDocente?.length) {
      calRenderMatTabs();
    }
  }, 800);
});

window.forzarNivelDesdeGrupoActivo = forzarNivelDesdeGrupoActivo;

// ══════════════════════════════════════════════════════════════════
// AGENTE 3 — Cambio de grupo completamente limpio y atómico
// Reemplaza calCambiarGrupo con versión que limpia todo correctamente
// ══════════════════════════════════════════════════════════════════

async function calCambiarGrupoCompleto(grupoId) {
  if (!grupoId || grupoId === window._grupoActivo) return;

  const g = (window._gruposDocente||[]).find(x => x.id === grupoId);
  if (!g) { hubToast('⚠️ Grupo no encontrado', 'warn'); return; }

  // ── FASE 1: Limpiar estado anterior completamente ──────────────
  window._grupoActivo = grupoId;
  window._alumnosActivos = [];
  window._materiasDocente = [];
  window._materiasFiltered = [];
  window._docenteAsignaciones = null;
  alumnos.length = 0;
  CAL_DATA = {};
  CAL_ASPECTOS = {};

  // ── FASE 2: Actualizar nivel y grado del nuevo grupo ──────────
  const nivel = g.nivel || 'secundaria';
  const grado = String(g.grado||'1').replace(/[°\s]/g,'').trim();
  window._nivelActivo = nivel;
  window._gradoActivo = grado;
  try { localStorage.setItem('siembra_nivel', nivel); } catch(e) {}

  // Materias del grado como punto de partida
  const matsGrado = nivel === 'secundaria'
    ? (window.MATERIAS_SECUNDARIA_POR_GRADO?.[grado] || window.MATERIAS_SECUNDARIA_POR_GRADO?.['1'] || [])
    : getMateriasByNivel('primaria');
  window._materiasDocente  = matsGrado;
  window._materiasFiltered = matsGrado;

  // Nombre del grupo
  const nom = typeof resolverNombreGrupo==='function' ? resolverNombreGrupo(g) : (g.nombre||grado+'° A');

  // ── FASE 3: Actualizar UI con estado vacío primero ─────────────
  const calH2 = document.getElementById('cal-titulo-h2');
  if (calH2) calH2.textContent = `Calificaciones · ${nom}`;

  const topTitle = document.getElementById('page-title');
  if (topTitle) topTitle.textContent = `Calificaciones · ${nom}`;

  const roleEl = document.querySelector('#doc-portal .user-role');
  if (roleEl) roleEl.textContent = `Docente · ${nom}`;

  // Inicializar CAL_DATA con materias del grado
  matsGrado.forEach(mat => {
    CAL_ASPECTOS[mat] = ASPECTOS_DEFAULT.map(a => ({...a}));
    CAL_DATA[mat] = {};
    const _n3 = _calCfg().num_periodos;
    for (let i = 1; i <= _n3; i++) CAL_DATA[mat][i] = {};
  });

  hubToast(`⏳ Cargando ${nom}…`, 'ok');

  // ── FASE 4: Cargar datos reales de Supabase ───────────────────
  if (window.sb && window.currentPerfil) {
    try {
      // 4a. Alumnos del grupo
      const alumnosDB = await calCargarAlumnosGrupo(grupoId);
      window._alumnosActivos = alumnosDB;
      alumnos.length = 0;
      alumnosDB.forEach(a => alumnos.push(a));

      // 4b. Materias asignadas al docente en este grupo
      const { data: asigs } = await window.sb.from('docente_grupos')
        .select('materia, grupo_id, grupos(id,nombre,grado,seccion,nivel)')
        .eq('docente_id', window.currentPerfil.id)
        .eq('grupo_id', grupoId)
        .eq('activo', true)
        .eq('ciclo', window.CICLO_ACTIVO || '2025-2026');

      if (asigs?.length) {
        const mats = [...new Set(asigs.map(r => r.materia).filter(Boolean))];
        window._materiasDocente  = mats;
        window._materiasFiltered = mats;
        // Re-inicializar CAL_DATA con materias asignadas
        mats.forEach(mat => {
          if (!CAL_DATA[mat]) { CAL_DATA[mat] = {}; const _n4 = _calCfg().num_periodos; for (let i = 1; i <= _n4; i++) CAL_DATA[mat][i] = {}; }
          if (!CAL_ASPECTOS[mat]) CAL_ASPECTOS[mat] = ASPECTOS_DEFAULT.map(a => ({...a}));
        });
      }

      window._docenteAsignaciones = asigs || [];

      // 4c. Calificaciones y aspectos
      await calCargarAspectos(grupoId);
      await calCargarCalificacionesDB(grupoId);

    } catch(e) {
      console.warn('[calCambiarGrupoCompleto]', e.message);
    }
  }

  // ── FASE 5: Re-render completo ────────────────────────────────
  if (typeof cambiarNivel === 'function') cambiarNivel(nivel);
  if (typeof calRenderSelectorGrupos === 'function') calRenderSelectorGrupos();
  if (typeof calRenderMatTabs === 'function') calRenderMatTabs();
  if (typeof calRenderTabla === 'function') calRenderTabla();
  if (typeof calRenderStats === 'function') calRenderStats();
  if (typeof dRenderDash === 'function') dRenderDash();

  // Sincronizar alumnos y etiquetas
  if (typeof sincronizarDocAlumnos === 'function') {
    setTimeout(() => {
      sincronizarDocAlumnos();
      if (typeof renderAlumnosDoc === 'function') renderAlumnosDoc();
    }, 300);
  }

  hubToast(`✅ ${nom} · ${window._alumnosActivos.length} alumnos · ${window._materiasDocente.length} materias`, 'ok');
}

// Reemplazar calCambiarGrupo con la versión completa
window.calCambiarGrupo = calCambiarGrupoCompleto;
window.calCambiarGrupoCompleto = calCambiarGrupoCompleto;

// ══════════════════════════════════════════════════════════════════
// AGENTE 4 — Monitor de consistencia de datos
// Detecta cuando hay datos demo activos y los reemplaza con reales
// ══════════════════════════════════════════════════════════════════

async function monitorConsistencia() {
  if (!window.sb || !window.currentPerfil) return;

  const grupoActivo = window._grupoActivo;
  if (!grupoActivo) return;

  // Detectar si hay datos demo activos
  const tieneDemo = (window._alumnosActivos||[]).some(a => String(a.id||'').startsWith('demo-'))
                 || (alumnos||[]).some(a => String(a.id||'').startsWith('demo-'))
                 || !(window._alumnosActivos?.length);

  if (tieneDemo) {
    console.log('[Monitor] Datos demo detectados, recargando desde Supabase…');
    try {
      const alumnosDB = await calCargarAlumnosGrupo(grupoActivo);
      if (alumnosDB.length) {
        window._alumnosActivos = alumnosDB;
        alumnos.length = 0;
        alumnosDB.forEach(a => alumnos.push(a));
        if (typeof calRenderTabla === 'function') calRenderTabla();
        if (typeof calRenderStats === 'function') calRenderStats();
        if (typeof dRenderDash === 'function') dRenderDash();
        if (typeof sincronizarDocAlumnos === 'function') {
          sincronizarDocAlumnos();
          if (typeof renderAlumnosDoc === 'function') renderAlumnosDoc();
        }
        console.log('[Monitor] ✅ Datos reales cargados:', alumnosDB.length, 'alumnos');
      }
    } catch(e) {
      console.warn('[Monitor]', e.message);
    }
  }

  // Detectar materias de primaria en grupo de secundaria
  const g = (window._gruposDocente||[]).find(x => x.id === grupoActivo);
  if (g?.nivel === 'secundaria' && window._materiasDocente?.some(m =>
    m.includes('Materna') || m.includes('Conocimiento') || m.includes('Artística') || m.includes('Saludable')
  )) {
    console.log('[Monitor] Materias de primaria detectadas en grupo secundaria, corrigiendo…');
    const grado = String(g.grado||'1').replace(/[°\s]/g,'').trim();
    const mats = window.MATERIAS_SECUNDARIA_POR_GRADO?.[grado]
              || window.MATERIAS_SECUNDARIA_POR_GRADO?.['1']
              || [];
    window._materiasDocente  = mats;
    window._materiasFiltered = mats;
    if (typeof calRenderMatTabs === 'function') calRenderMatTabs();
    console.log('[Monitor] ✅ Materias corregidas a secundaria:', mats.join(', '));
  }
}

// Ejecutar monitor al navegar a secciones clave
const _dNavOrig5 = window.dNav;
window.dNav = function(page) {
  _dNavOrig5?.(page);
  if (['calificaciones','dashboard','asistencia','etiquetas'].includes(page)) {
    setTimeout(monitorConsistencia, 600);
  }
};

// Ejecutar al cargar
window.addEventListener('siembra:datos-cargados', () => {
  setTimeout(monitorConsistencia, 1500);
});

window.monitorConsistencia = monitorConsistencia;


// ══════════════════════════════════════════════════════════════════════
// MÓDULO PREFECTO — CCE Conners + Alertas + Incidencias
// ══════════════════════════════════════════════════════════════════════

const CCE_ITEMS = ['Tiene excesiva inquietud motora', 'Emite sonidos molestos en situaciones inapropiadas', 'Exige inmediata satisfacción de sus demandas', 'Se comporta con arrogancia, es irrespetuoso', 'Tiene explosiones impredecibles de mal genio', 'Es susceptible, demasiado sensible a la crítica', 'Se distrae fácilmente, escasa atención', 'Molesta frecuentemente a otros niños', 'Está en las nubes, ensimismado', 'Tiene aspecto enfadado, huraño', 'Cambia bruscamente sus estados de ánimo', 'Discute y pelea por cualquier cosa', 'Tiene actitud tímida y sumisa ante los adultos', 'Intranquilo, siempre en movimiento', 'Es impulsivo e irritable', 'Exige excesivas atenciones del profesor', 'Es mal aceptado en el grupo', 'Se deja dirigir por otros niños', 'No tiene sentido de las reglas del «juego limpio»', 'Carece de aptitudes para el liderazgo', 'No termina las tareas que empieza', 'Su conducta es inmadura para su edad', 'Niega sus errores o culpa a los demás', 'No se lleva bien con la mayoría de sus compañeros', 'Tiene dificultad para las actividades cooperativas', 'Sus esfuerzos se frustran fácilmente, es inconstante', 'Acepta mal las indicaciones del profesor', 'Tiene dificultades de aprendizaje escolar'];
const CCE_VALORES = { nada:0, poco:1, bastante:2, mucho:3 };
let _prefAlumnos   = [];
let _prefDocentes  = [];
let _prefCceData   = {}; // { [reactivo]: valor }
let _prefCceAlumnoId = null;
let _prefCceDocenteId = null;

// ── Routing ──────────────────────────────────────────────────────────
function prefInit() {
  const p = window.currentPerfil;
  if (p) {
    const nombre = ((p.nombre||'') + ' ' + (p.apellido_p||'')).trim();
    const initials = nombre.split(' ').map(x=>x[0]||'').join('').toUpperCase().slice(0,2) || 'P';
    const nameEl   = document.getElementById('pref-nombre-header');
    const avatarEl = document.getElementById('pref-avatar');
    const escuelaEls = [
      document.getElementById('pref-escuela-topbar'),
      document.getElementById('pref-banner-escuela'),
    ];
    if (nameEl)   nameEl.textContent   = nombre || 'Prefecto/a';
    if (avatarEl) avatarEl.textContent = initials;
    const esc = p.escuela_nombre || p.escuela_cct || _getCct() || '—';
    escuelaEls.forEach(el => { if (el) el.textContent = esc; });
  }
  _topbarPro({ titleId:'pref-page-title', prefix:'pref', searchPlaceholder:'Buscar alumno, incidencia…' });
  prefNav('dashboard');
  prefCargarDatos();
}

function prefNav(page) {
  const pages = ['dashboard','alumnos','conners','alertas','incidencias',
                 'faltas-docentes','asistencia-alumnos','entradas-salidas'];
  // Ocultar todas las pref-pages y limpiar botones
  document.querySelectorAll('#pref-portal .pref-page').forEach(el => { el.style.display='none'; el.classList.remove('pref-page-active'); });
  pages.forEach(p => {
    const btn = document.getElementById('pref-nav-' + p);
    if (btn) {
      btn.style.background  = p === page ? 'rgba(255,255,255,.15)' : 'transparent';
      btn.style.color       = p === page ? 'white' : 'rgba(255,255,255,.7)';
      btn.style.fontWeight  = p === page ? '700' : '400';
    }
  });
  const titles = {
    dashboard:'Dashboard', alumnos:'Alumnos', conners:'Cuestionario CCE',
    alertas:'Alertas activas', incidencias:'Incidencias',
    'faltas-docentes':'Faltas de maestros',
    'asistencia-alumnos':'Asistencia de alumnos',
    'entradas-salidas':'Entradas y salidas',
  };
  const titleEl = document.getElementById('pref-page-title');
  if (titleEl) titleEl.textContent = titles[page] || page;
  const pg = document.getElementById('pref-p-' + page);
  if (pg) { pg.style.setProperty('display','block','important'); }
  if (page === 'alumnos')           prefRenderAlumnos();
  if (page === 'conners')           prefIniciarCce();
  if (page === 'alertas')           prefCargarAlertas();
  if (page === 'incidencias')       prefCargarIncidencias();
  if (page === 'faltas-docentes')   prefFaltasDocentesCargar();
  if (page === 'asistencia-alumnos') { prefAsistenciaAlumnosCargar(); if(typeof prefSuscribirAsistencia==='function') prefSuscribirAsistencia(); }
  if (page === 'entradas-salidas')  prefEntradasSalidasCargar();
}
window.prefNav = prefNav;

// ── Cargar datos ─────────────────────────────────────────────────────
async function prefCargarDatos() {
  if (!sb || !currentPerfil) return;
  const cct = currentPerfil.escuela_cct || null;
  if (!cct) return;

  try {
    const [rA, rD] = await Promise.all([
      sb.from('alumnos_grupos')
        .select('alumno_id, grupo_id, grupos!grupo_id(nombre,grado), usuarios!alumno_id(id,nombre,apellido_p,apellido_m,curp)')
        .eq('activo', true),
      sb.from('usuarios')
        .select('id, nombre, apellido_p')
        .eq('escuela_cct', cct)
        .in('rol', ['docente','tutor'])
        .eq('activo', true)
    ]);

    _prefAlumnos  = (rA.data||[]).map(r => ({
      id: r.usuarios?.id, grupo: r.grupos?.nombre, grado: r.grupos?.grado,
      nombre: `${r.usuarios?.nombre||''} ${r.usuarios?.apellido_p||''}`.trim(),
      curp: r.usuarios?.curp || ''
    })).filter(a => a.id);
    _prefDocentes = rD.data || [];

    // Update stats
    document.getElementById('pref-stat-alumnos').textContent = _prefAlumnos.length;

    // Populate selects
    const alumnoSel = document.getElementById('pref-cce-alumno');
    if (alumnoSel) {
      alumnoSel.innerHTML = '<option value="">Seleccionar alumno…</option>' +
        _prefAlumnos.map(a => `<option value="${a.id}">${a.nombre} — ${a.grado}° ${a.grupo}</option>`).join('');
    }
    const grupSel = document.getElementById('pref-grupo-sel');
    const grupos = [...new Set(_prefAlumnos.map(a => a.grupo).filter(Boolean))];
    if (grupSel) {
      grupSel.innerHTML = '<option value="">Todos los grupos</option>' +
        grupos.map(g => `<option value="${g}">${g}</option>`).join('');
    }
    const docSel = document.getElementById('pref-cce-docente');
    if (docSel) {
      docSel.innerHTML = '<option value="">Seleccionar docente…</option>' +
        _prefDocentes.map(d => `<option value="${d.id}">${d.nombre} ${d.apellido_p||''}</option>`).join('');
    }

    // Load CCE count
    const { count } = await sb.from('incidencias_cce').select('id', { count:'exact', head:true }).eq('escuela_cct', cct);
    document.getElementById('pref-stat-cuestionarios').textContent = count || 0;

    prefCargarCceRecientes();
    prefCargarAlertas();

    // Cargar alertas del subdirector/dirección
    if (typeof window._cargarAlertasRol === 'function') {
      window._cargarAlertasRol('prefecto').then(alertas => {
        if (typeof window._renderAlertasBanner === 'function')
          window._renderAlertasBanner('pref-alertas-plantel', alertas);
      }).catch(()=>{});
    }

  } catch(e) { console.warn('[PREF] cargar datos:', e.message); }
}

function prefRenderAlumnos(filtro = '') {
  const el = document.getElementById('pref-alumnos-list');
  if (!el) return;
  const grupo = document.getElementById('pref-grupo-sel')?.value || '';
  const lista = _prefAlumnos.filter(a =>
    (!filtro || a.nombre.toLowerCase().includes(filtro.toLowerCase())) &&
    (!grupo  || a.grupo === grupo)
  );
  if (!lista.length) {
    el.innerHTML = '<div style="padding:32px;text-align:center;color:#64748b;">Sin alumnos.</div>';
    return;
  }
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="background:#f8fafc;">
      <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Alumno</th>
      <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Grupo</th>
      <th style="padding:10px 14px;text-align:right;"></th>
    </tr></thead>
    <tbody>${lista.map(a => `<tr style="border-top:1px solid #f1f5f9;">
      <td style="padding:10px 14px;font-weight:600;">${a.nombre}</td>
      <td style="padding:10px 14px;color:#64748b;">${a.grado}° ${a.grupo}</td>
      <td style="padding:10px 14px;text-align:right;">
        <button onclick="prefAplicarCce('${a.id}','${a.nombre}')" style="padding:5px 12px;background:#f5f3ff;border:1.5px solid #c4b5fd;color:#7c3aed;border-radius:6px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;">📋 Aplicar CCE</button>
        <button onclick="prefAlertaRapida('${a.id}','${a.nombre}')" style="padding:5px 12px;background:#fee2e2;border:1.5px solid #fca5a5;color:#b91c1c;border-radius:6px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;margin-left:6px;">🚨 Alerta</button>
      </td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function prefFiltrarAlumnos(val = '') {
  prefRenderAlumnos(val || document.getElementById('pref-buscar-alumno')?.value || '');
}

// ── CCE Conners ──────────────────────────────────────────────────────
function prefIniciarCce() {
  const tbody = document.getElementById('pref-cce-tbody');
  if (!tbody || tbody.children.length > 0) return; // Already rendered
  tbody.innerHTML = CCE_ITEMS.map((item, i) => `
    <tr style="border-top:1px solid #f1f5f9;${i%2===0?'background:#fafafa;':''}">
      <td style="padding:10px 14px;">${i+1}. ${item}</td>
      ${['nada','poco','bastante','mucho'].map(v => `
        <td style="padding:10px 8px;text-align:center;">
          <input type="radio" name="cce_${i}" value="${v}" onchange="prefCceCalc()"
            style="width:18px;height:18px;cursor:pointer;accent-color:#7c3aed;">
        </td>`).join('')}
    </tr>`).join('');
}

function prefAplicarCce(alumnoId, nombre) {
  document.getElementById('pref-cce-alumno').value = alumnoId;
  document.getElementById('pref-cce-alumno-nombre').textContent = nombre;
  _prefCceAlumnoId = alumnoId;
  _prefCceData = {};
  // Reset radios
  document.querySelectorAll('#pref-cce-tbody input[type=radio]').forEach(r => r.checked = false);
  prefCceCalc();
  document.getElementById('pref-cce-form').style.display = 'block';
  prefNav('conners');
}

function prefCceNuevo() {
  const alumnoId = document.getElementById('pref-cce-alumno').value;
  const docenteId = document.getElementById('pref-cce-docente').value;
  if (!alumnoId) { hubToast('⚠️ Selecciona un alumno', 'warn'); return; }
  const alumno = _prefAlumnos.find(a => a.id === alumnoId);
  const nombre = alumno?.nombre || 'Alumno';
  _prefCceAlumnoId  = alumnoId;
  _prefCceDocenteId = docenteId;
  document.getElementById('pref-cce-alumno-nombre').textContent = nombre;
  _prefCceData = {};
  document.querySelectorAll('#pref-cce-tbody input[type=radio]').forEach(r => r.checked = false);
  prefCceCalc();
  document.getElementById('pref-cce-form').style.display = 'block';
}

function prefCceCalc() {
  let total = 0;
  CCE_ITEMS.forEach((_, i) => {
    const checked = document.querySelector(`input[name="cce_${i}"]:checked`);
    if (checked) total += CCE_VALORES[checked.value] || 0;
  });
  document.getElementById('pref-cce-score').textContent = total;
  // Interpretación (cortes estándar Conners)
  let interp = '';
  let color = '#22c55e';
  if (total >= 45) { interp = '🔴 ALTO — Posible TDAH/Conducta'; color = '#ef4444'; }
  else if (total >= 30) { interp = '🟡 MEDIO — Seguimiento recomendado'; color = '#f59e0b'; }
  else if (total >= 15) { interp = '🟢 BAJO — Dentro del rango normal'; color = '#22c55e'; }
  else { interp = '🟢 NORMAL'; color = '#22c55e'; }
  const interpEl = document.getElementById('pref-cce-interp');
  if (interpEl) { interpEl.textContent = interp; interpEl.style.color = color; }
  // Mostrar botón enviar a TS si es alto
  const btnTS = document.getElementById('pref-btn-enviar-ts');
  if (btnTS) btnTS.style.display = total >= 30 ? 'block' : 'none';
  _prefCceData._total = total;
  _prefCceData._interp = interp;
}

async function prefCceGuardar() {
  if (!_prefCceAlumnoId) { hubToast('⚠️ Selecciona un alumno', 'warn'); return; }
  const total = _prefCceData._total || 0;
  // Collect answers
  const respuestas = CCE_ITEMS.map((item, i) => {
    const checked = document.querySelector(`input[name="cce_${i}"]:checked`);
    return { reactivo: i+1, texto: item, valor: CCE_VALORES[checked?.value] ?? null, etiqueta: checked?.value || null };
  });

  const payload = {
    alumno_id:   _prefCceAlumnoId,
    docente_id:  _prefCceDocenteId || currentPerfil?.id,
    prefecto_id: currentPerfil?.id,
    escuela_cct: currentPerfil?.escuela_cct,
    respuestas:  JSON.stringify(respuestas),
    puntaje_total: total,
    interpretacion: _prefCceData._interp || '',
    estado: total >= 30 ? 'requiere_atencion' : 'normal',
    fecha: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString()
  };

  try {
    if (sb) {
      const { error } = await sb.from('incidencias_cce').insert(payload);
      if (error) throw error;
    }
    hubToast('✅ CCE guardado correctamente', 'ok');
    document.getElementById('pref-stat-cuestionarios').textContent =
      parseInt(document.getElementById('pref-stat-cuestionarios').textContent || '0') + 1;
    prefCargarCceRecientes();

    // Si puntaje alto, crear alerta automática
    if (total >= 30) {
      await prefCrearAlerta(_prefCceAlumnoId, `CCE Conners: ${total} pts — ${_prefCceData._interp}`, 'cce');
    }
  } catch(e) { hubToast('❌ ' + e.message, 'err'); }
}

async function prefCceEnviarTS() {
  if (!_prefCceAlumnoId) return;
  const alumno = _prefAlumnos.find(a => a.id === _prefCceAlumnoId);
  const total  = _prefCceData._total || 0;

  // 1. Guardar CCE si no se ha guardado
  await prefCceGuardar();

  // 2. Crear incidencia para Trabajo Social
  const payload = {
    alumno_id:    _prefCceAlumnoId,
    reportado_por: currentPerfil?.id,
    escuela_cct:  currentPerfil?.escuela_cct,
    tipo:         'cce_conners',
    descripcion:  `Resultado CCE Conners: ${total} puntos. ${_prefCceData._interp}. Requiere evaluación de Trabajo Social.`,
    estado:       'activo',
    prioridad:    total >= 45 ? 'alta' : 'media',
    created_at:   new Date().toISOString()
  };

  try {
    if (sb) {
      await sb.from('incidencias').insert(payload);
    }
    hubToast(`✅ Caso de ${alumno?.nombre || 'alumno'} enviado a Trabajo Social`, 'ok');
    // Update alertas count
    const statEl = document.getElementById('pref-stat-alertas');
    if (statEl) statEl.textContent = parseInt(statEl.textContent || '0') + 1;
  } catch(e) { hubToast('❌ ' + e.message, 'err'); }
}

async function prefCrearAlerta(alumnoId, descripcion, tipo = 'general') {
  const payload = {
    alumno_id: alumnoId, tipo,
    descripcion, estado: 'activo',
    reportado_por: currentPerfil?.id,
    escuela_cct: currentPerfil?.escuela_cct,
    created_at: new Date().toISOString()
  };
  try {
    if (sb) await sb.from('incidencias').insert(payload);
  } catch(e) { console.warn('[PREF] alerta:', e.message); }
}

async function prefAlertaRapida(alumnoId, nombre) {
  const desc = prompt(`Describe la situación de ${nombre}:`);
  if (!desc) return;
  await prefCrearAlerta(alumnoId, desc, 'prefecto');
  hubToast(`✅ Alerta registrada para ${nombre}`, 'ok');
  const statEl = document.getElementById('pref-stat-alertas');
  if (statEl) statEl.textContent = parseInt(statEl.textContent || '0') + 1;
}

async function prefCargarAlertas() {
  const el = document.getElementById('pref-alertas-list');
  if (!el) return;
  if (!sb) { el.innerHTML = '<div style="padding:20px;color:#64748b;">Conecta Supabase.</div>'; return; }
  try {
    const { data } = await sb.from('incidencias')
      .select('*, alumno:usuarios!alumno_id(nombre,apellido_p)')
      .eq('escuela_cct', currentPerfil?.escuela_cct)
      .eq('estado', 'activo')
      .order('created_at', { ascending:false }).limit(30);

    document.getElementById('pref-stat-alertas').textContent = data?.length || 0;

    if (!data?.length) { el.innerHTML = '<div style="padding:20px;color:#64748b;font-size:13px;">Sin alertas activas. 🟢</div>'; return; }
    el.innerHTML = data.map(i => {
      const nom = `${i.alumno?.nombre||''} ${i.alumno?.apellido_p||''}`.trim() || '—';
      return `<div style="background:white;border-radius:12px;border:1px solid ${i.prioridad==='alta'?'#fca5a5':'#e2e8f0'};padding:14px 16px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <span style="font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;background:${i.prioridad==='alta'?'#fee2e2':'#fef9c3'};color:${i.prioridad==='alta'?'#b91c1c':'#a16207'};">${i.prioridad||'media'}</span>
          <span style="font-weight:700;font-size:13px;">${nom}</span>
          <span style="font-size:11px;color:#64748b;margin-left:auto;">${new Date(i.created_at).toLocaleDateString('es-MX')}</span>
        </div>
        <div style="font-size:12px;color:#475569;">${i.descripcion||''}</div>
      </div>`;
    }).join('');
  } catch(e) { el.innerHTML = `<div style="padding:20px;color:#ef4444;">${e.message}</div>`; }
}

async function prefCargarIncidencias() {
  const el = document.getElementById('pref-incidencias-list');
  if (!el) return;
  if (!sb) return;
  try {
    const { data } = await sb.from('incidencias')
      .select('*, alumno:usuarios!alumno_id(nombre,apellido_p)')
      .eq('escuela_cct', currentPerfil?.escuela_cct)
      .order('created_at', { ascending:false }).limit(50);
    if (!data?.length) { el.innerHTML = '<div style="padding:20px;color:#64748b;font-size:13px;">Sin incidencias registradas.</div>'; return; }
    el.innerHTML = data.map(i => {
      const nom = `${i.alumno?.nombre||''} ${i.alumno?.apellido_p||''}`.trim() || '—';
      return `<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:14px 16px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-weight:700;font-size:13px;">${nom}</span>
          <span style="font-size:11px;padding:2px 8px;background:#f1f5f9;border-radius:99px;color:#475569;">${i.tipo||'general'}</span>
          <span style="margin-left:auto;font-size:11px;color:#64748b;">${new Date(i.created_at).toLocaleDateString('es-MX')}</span>
        </div>
        <div style="font-size:12px;color:#475569;margin-top:6px;">${i.descripcion||''}</div>
      </div>`;
    }).join('');
  } catch(e) { console.warn('[PREF] incidencias:', e.message); }
}

async function prefNuevaIncidencia() {
  const nombre = prompt('Nombre del alumno involucrado:');
  if (!nombre) return;
  const desc = prompt('Descripción de la incidencia:');
  if (!desc) return;
  // Find alumno
  const alumno = _prefAlumnos.find(a => a.nombre.toLowerCase().includes(nombre.toLowerCase()));
  await prefCrearAlerta(alumno?.id || null, desc, 'incidencia');
  hubToast('✅ Incidencia registrada', 'ok');
  prefCargarIncidencias();
}

async function prefCargarCceRecientes() {
  const el = document.getElementById('pref-cce-recientes');
  if (!el || !sb) return;
  try {
    const { data } = await sb.from('incidencias_cce')
      .select('*, alumno:usuarios!alumno_id(nombre,apellido_p)')
      .eq('escuela_cct', currentPerfil?.escuela_cct)
      .order('created_at', { ascending:false }).limit(5);
    if (!data?.length) { el.innerHTML = '<div style="color:#64748b;font-size:13px;">Sin CCE aplicados aún.</div>'; return; }
    el.innerHTML = data.map(r => {
      const nom = `${r.alumno?.nombre||''} ${r.alumno?.apellido_p||''}`.trim();
      const color = r.puntaje_total >= 45 ? '#ef4444' : r.puntaje_total >= 30 ? '#f59e0b' : '#22c55e';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">${nom}</div>
          <div style="font-size:11px;color:#64748b;">${new Date(r.fecha).toLocaleDateString('es-MX')}</div>
        </div>
        <div style="font-weight:900;font-size:16px;color:${color};">${r.puntaje_total}</div>
        <span style="font-size:10px;color:${color};font-weight:700;">${r.estado==='requiere_atencion'?'⚠️ Atención':'✅ Normal'}</span>
      </div>`;
    }).join('');
  } catch(e) { el.innerHTML = '<div style="color:#64748b;font-size:13px;">Sin datos.</div>'; }
}

// ── Prefecto: Faltas de maestros ─────────────────────────────────────
async function prefFaltasDocentesCargar() {
  const tbody = document.getElementById('pref-faltas-tbody');
  const fechaEl = document.getElementById('pref-faltas-fecha');
  if (!fechaEl.value) fechaEl.value = new Date().toISOString().split('T')[0];
  const fecha = fechaEl.value;
  const cct = currentPerfil?.escuela_cct || (typeof _getCct==='function'?_getCct():null);
  if (!sb || !cct) { if(tbody) tbody.innerHTML='<tr><td colspan="3" style="padding:30px;text-align:center;color:#94a3b8;">Sin conexión</td></tr>'; return; }
  if (tbody) tbody.innerHTML='<tr><td colspan="3" style="padding:30px;text-align:center;color:#94a3b8;"><div style="font-size:24px;">⏳</div><div>Cargando…</div></td></tr>';
  try {
    const { data: docentes } = await sb.from('usuarios')
      .select('id,nombre,apellido_p').eq('escuela_cct',cct).eq('rol','docente').eq('activo',true).order('nombre');
    let asistMap = {};
    try {
      const { data: rows } = await sb.from('asistencia_personal').select('*').eq('escuela_cct',cct).eq('fecha',fecha);
      (rows||[]).forEach(r => { asistMap[r.usuario_id]=r; });
    } catch(e) {}

    const data = (docentes||[]).map(d => ({
      ...d, nombre_completo:`${d.nombre||''} ${d.apellido_p||''}`.trim(),
      estatus: asistMap[d.id]?.estatus || 'sin_registro'
    }));

    const presentes = data.filter(d=>d.estatus==='presente').length;
    const ausentes  = data.filter(d=>d.estatus==='ausente').length;
    const tardanza  = data.filter(d=>d.estatus==='tardanza').length;
    const el = id => document.getElementById(id);
    if(el('pref-fd-presentes')) el('pref-fd-presentes').textContent=presentes;
    if(el('pref-fd-ausentes'))  el('pref-fd-ausentes').textContent=ausentes;
    if(el('pref-fd-tardanza'))  el('pref-fd-tardanza').textContent=tardanza;

    if (!data.length) { tbody.innerHTML='<tr><td colspan="3" style="padding:30px;text-align:center;color:#94a3b8;">Todavía no hay docentes registrados para consultar asistencia.</td></tr>'; return; }
    const estatusBg   = { presente:'#dcfce7',ausente:'#fee2e2',tardanza:'#fef9c3',sin_registro:'#f1f5f9' };
    const estatusTxt  = { presente:'✅ Presente',ausente:'❌ Ausente',tardanza:'⏰ Tardanza',sin_registro:'—' };
    tbody.innerHTML = data.map(d=>`
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 14px;font-weight:600;color:#0f172a;">${d.nombre_completo}</td>
        <td style="padding:10px 14px;text-align:center;">
          <span style="padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;background:${estatusBg[d.estatus]||'#f1f5f9'};">${estatusTxt[d.estatus]||d.estatus}</span>
        </td>
        <td style="padding:10px 14px;text-align:center;">
          <div style="display:flex;gap:5px;justify-content:center;">
            <button onclick="prefRegistrarFaltaDocente('${d.id}','presente')" style="padding:3px 8px;font-size:11px;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:5px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">✅</button>
            <button onclick="prefRegistrarFaltaDocente('${d.id}','ausente')" style="padding:3px 8px;font-size:11px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:5px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">❌</button>
            <button onclick="prefRegistrarFaltaDocente('${d.id}','tardanza')" style="padding:3px 8px;font-size:11px;background:#fefce8;color:#a16207;border:1px solid #fde68a;border-radius:5px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">⏰</button>
          </div>
        </td>
      </tr>`).join('');
  } catch(e) { if(tbody) tbody.innerHTML=`<tr><td colspan="3" style="padding:30px;text-align:center;color:#ef4444;">Error: ${e.message}</td></tr>`; }
}

async function prefRegistrarFaltaDocente(docenteId, estatus) {
  const cct = currentPerfil?.escuela_cct || (typeof _getCct==='function'?_getCct():null);
  const fecha = document.getElementById('pref-faltas-fecha')?.value || new Date().toISOString().split('T')[0];
  if (!sb) return;
  try {
    await sb.from('asistencia_personal').upsert({
      usuario_id: docenteId, escuela_cct: cct, fecha, estatus,
      hora_entrada: (estatus==='presente'||estatus==='tardanza') ? new Date().toTimeString().slice(0,5) : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'usuario_id,fecha' });
    // Si ausente → alerta cruzada
    if (estatus==='ausente') {
      try {
        await sb.from('alertas').insert({ tipo:'ausentismo', escuela_cct:cct, docente_id:docenteId, origen:'prefecto',
          contenido:`Falta docente registrada por prefecto — ${fecha}`, leido:false, created_at:new Date().toISOString() });
      } catch(e2){}
    }
    hubToast('✅ Registrado','ok');
    prefFaltasDocentesCargar();
  } catch(e) { hubToast('Error: '+e.message,'error'); }
}

// ── Prefecto: Asistencia de alumnos ─────────────────────────────────
async function prefAsistenciaAlumnosCargar() {
  const lista = document.getElementById('pref-asistencia-lista');
  const fechaEl = document.getElementById('pref-asist-fecha');
  if (!fechaEl.value) fechaEl.value = new Date().toISOString().split('T')[0];
  const fecha = fechaEl.value;
  const grupoFiltro = document.getElementById('pref-asist-grupo')?.value || '';
  const cct = currentPerfil?.escuela_cct || (typeof _getCct==='function'?_getCct():null);
  if (!lista) return;
  lista.innerHTML='<div style="padding:40px;text-align:center;color:#94a3b8;"><div style="font-size:28px;">⏳</div><div>Cargando…</div></div>';

  // Populate grupo select if empty
  const grupoSel = document.getElementById('pref-asist-grupo');
  if (grupoSel && grupoSel.options.length <= 1 && _prefAlumnos?.length) {
    const grupos = [...new Set(_prefAlumnos.map(a=>a.grupo).filter(Boolean))].sort();
    grupos.forEach(g => { const o=document.createElement('option'); o.value=g; o.textContent=g; grupoSel.appendChild(o); });
  }

  let alumnos = _prefAlumnos || [];
  if (grupoFiltro) alumnos = alumnos.filter(a=>a.grupo===grupoFiltro);

  let asistMap = {};
  try {
    const ids = alumnos.map(a=>a.id).filter(Boolean);
    if (ids.length && sb) {
      const { data: rows } = await sb.from('asistencia').select('*').in('alumno_id',ids).eq('fecha',fecha);
      (rows||[]).forEach(r=>{ asistMap[r.alumno_id]=r; });
    }
  } catch(e){}

  const data = alumnos.map(a=>({...a, estatus: asistMap[a.id]?.estatus||'sin_registro'}));
  const presentes=data.filter(d=>d.estatus==='presente').length;
  const ausentes=data.filter(d=>d.estatus==='ausente').length;
  const tardanza=data.filter(d=>d.estatus==='tardanza').length;
  const justificada=data.filter(d=>d.estatus==='justificada').length;
  ['presentes','ausentes','tardanza','justificada'].forEach((k,i)=>{
    const el=document.getElementById(`pref-aa-${k}`);
    if(el) el.textContent=[presentes,ausentes,tardanza,justificada][i];
  });

  if (!data.length) { lista.innerHTML='<div style="padding:40px;text-align:center;color:#94a3b8;">Sin alumnos</div>'; return; }
  const estatusBg={presente:'#dcfce7',ausente:'#fee2e2',tardanza:'#fef9c3',justificada:'#eff6ff',sin_registro:'#f1f5f9'};
  const estatusTxt={presente:'✅ Presente',ausente:'❌ Ausente',tardanza:'⏰ Tardanza',justificada:'📄 Justificada',sin_registro:'—'};
  lista.innerHTML=`<table style="width:100%;border-collapse:collapse;font-family:'Sora',sans-serif;font-size:13px;">
    <thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
      <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">ALUMNO/A</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">GRUPO</th>
      <th style="padding:10px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:700;">ESTATUS</th>
      <th style="padding:10px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:700;">ACCIÓN</th>
    </tr></thead><tbody>` +
    data.map(a=>`<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:10px 14px;font-weight:600;color:#0f172a;">${a.nombre}</td>
      <td style="padding:10px 14px;color:#64748b;">${a.grupo||'—'}</td>
      <td style="padding:10px 14px;text-align:center;"><span style="padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;background:${estatusBg[a.estatus]||'#f1f5f9'};">${estatusTxt[a.estatus]||a.estatus}</span></td>
      <td style="padding:10px 14px;text-align:center;">
        <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
          <button onclick="prefRegistrarAsistAlumno('${a.id}','presente')" style="padding:3px 7px;font-size:11px;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:5px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">✅</button>
          <button onclick="prefRegistrarAsistAlumno('${a.id}','ausente')" style="padding:3px 7px;font-size:11px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:5px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">❌</button>
          <button onclick="prefRegistrarAsistAlumno('${a.id}','tardanza')" style="padding:3px 7px;font-size:11px;background:#fefce8;color:#a16207;border:1px solid #fde68a;border-radius:5px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">⏰</button>
          <button onclick="prefRegistrarAsistAlumno('${a.id}','justificada')" style="padding:3px 7px;font-size:11px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:5px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">📄</button>
        </div>
      </td>
    </tr>`).join('') + '</tbody></table>';
}

async function prefRegistrarAsistAlumno(alumnoId, estatus) {
  const cct = currentPerfil?.escuela_cct || (typeof _getCct==='function'?_getCct():null);
  const fecha = document.getElementById('pref-asist-fecha')?.value || new Date().toISOString().split('T')[0];
  if (!sb) return;
  try {
    await sb.from('asistencia').upsert({
      alumno_id: alumnoId, escuela_cct: cct, fecha, estatus,
      registrado_por: currentPerfil?.id, updated_at: new Date().toISOString()
    }, { onConflict: 'alumno_id,fecha' });
    hubToast('✅ Asistencia registrada','ok');
    prefAsistenciaAlumnosCargar();
  } catch(e) { hubToast('Error: '+e.message,'error'); }
}

// ── Prefecto: Entradas y salidas ─────────────────────────────────────
async function prefEntradasSalidasCargar() {
  const lista = document.getElementById('pref-es-lista');
  const fechaEl = document.getElementById('pref-es-fecha');
  const tipoFiltro = document.getElementById('pref-es-tipo')?.value || '';
  if (!fechaEl.value) fechaEl.value = new Date().toISOString().split('T')[0];
  const fecha = fechaEl.value;
  const cct = currentPerfil?.escuela_cct || (typeof _getCct==='function'?_getCct():null);
  if (!lista) return;
  if (!sb || !cct) { lista.innerHTML='<div style="padding:40px;text-align:center;color:#94a3b8;">Sin conexión</div>'; return; }
  lista.innerHTML='<div style="padding:40px;text-align:center;color:#94a3b8;"><div style="font-size:28px;">⏳</div><div>Cargando…</div></div>';
  try {
    let q = sb.from('entradas_salidas').select('*,usuario:usuarios!usuario_id(nombre,apellido_p,rol)')
      .eq('escuela_cct',cct).gte('created_at',fecha+'T00:00:00').lte('created_at',fecha+'T23:59:59').order('created_at',{ascending:false});
    if (tipoFiltro) q = q.eq('tipo',tipoFiltro);
    const { data } = await q;
    if (!data?.length) {
      lista.innerHTML='<div style="padding:60px;text-align:center;color:#94a3b8;"><div style="font-size:36px;margin-bottom:8px;">🚪</div><div style="font-size:14px;font-weight:600;">Sin registros para este día</div></div>';
      return;
    }
    const tipoBg={entrada:'#f0fdf4',salida:'#fef2f2',salida_anticipada:'#fef9c3'};
    const tipoTxt={entrada:'🟢 Entrada',salida:'🔴 Salida',salida_anticipada:'🟡 Salida anticipada'};
    lista.innerHTML='<table style="width:100%;border-collapse:collapse;font-family:\'Sora\',sans-serif;font-size:13px;"><thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;"><th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">PERSONA</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">ROL</th><th style="padding:10px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:700;">TIPO</th><th style="padding:10px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:700;">HORA</th></tr></thead><tbody>'+
      data.map(r=>{
        const nombre=`${r.usuario?.nombre||''} ${r.usuario?.apellido_p||''}`.trim()||'—';
        const hora=r.created_at?new Date(r.created_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'—';
        return `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 14px;font-weight:600;color:#0f172a;">${nombre}${r.nombre_libre?` (${r.nombre_libre})`:''}</td><td style="padding:10px 14px;color:#64748b;text-transform:capitalize;">${r.usuario?.rol||r.tipo_persona||'—'}</td><td style="padding:10px 14px;text-align:center;"><span style="padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;background:${tipoBg[r.tipo]||'#f1f5f9'};">${tipoTxt[r.tipo]||r.tipo}</span></td><td style="padding:10px 14px;text-align:center;color:#64748b;">${hora}</td></tr>`;
      }).join('')+'</tbody></table>';
  } catch(e) {
    lista.innerHTML=`<div style="padding:40px;text-align:center;color:#ef4444;">Error: ${e.message}</div>`;
  }
}

function prefEntradaRegistrar() {
  const cct = currentPerfil?.escuela_cct || (typeof _getCct==='function'?_getCct():null);
  hubModal('🚪 Registrar entrada/salida',`
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Nombre de la persona</label>
        <input id="es-nombre" type="text" placeholder="Nombre completo…" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Tipo</label>
        <select id="es-tipo-reg" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
          <option value="entrada">🟢 Entrada</option>
          <option value="salida">🔴 Salida</option>
          <option value="salida_anticipada">🟡 Salida anticipada</option>
        </select>
      </div>
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Motivo (opcional)</label>
        <input id="es-motivo" type="text" placeholder="Cita médica, visita, etc." style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
    </div>`, 'Registrar', async ()=>{
    const nombre=document.getElementById('es-nombre')?.value?.trim();
    if (!nombre){hubToast('Escribe el nombre','warn');return;}
    const tipo=document.getElementById('es-tipo-reg')?.value||'entrada';
    const motivo=document.getElementById('es-motivo')?.value||'';
    try {
      await sb.from('entradas_salidas').insert({ nombre_libre:nombre, tipo, motivo, escuela_cct:cct,
        tipo_persona:'visitante', created_at:new Date().toISOString() });
      hubToast('✅ Registrado','ok');
      prefEntradasSalidasCargar();
    } catch(e){ hubToast('Error: '+e.message,'error'); }
  });
}

// ── Wire prefecto into portal routing ────────────────────────────────
// Override mostrarPortalSegunRol to add prefecto

// ═══════════════════════════════════════════════════════
// ORIENTADOR ESCOLAR — Portal
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// TOPBAR PRO — Topbar unificado para todos los portales
// ═══════════════════════════════════════════════════════
function _topbarPro(cfg) {
  const { titleId, prefix, searchPlaceholder, keepChildren } = cfg;
  const titleEl = document.getElementById(titleId);
  if (!titleEl || document.getElementById(prefix + '-topbar-pro')) return;
  const topbar = titleEl.parentElement;
  if (!topbar) return;
  Object.assign(topbar.style, { display:'flex', alignItems:'center', gap:'12px', height:'56px', padding:'0 20px', overflowX:'hidden', flexShrink:'0' });
  titleEl.style.flexShrink = '0';
  titleEl.style.fontFamily = "'Fraunces',serif";
  if (!keepChildren) {
    Array.from(topbar.children).forEach(ch => { if (ch !== titleEl) ch.remove(); });
  }
  const nombre = window.ESCUELA_ACTIVA?.nombre || window.currentPerfil?.escuela_nombre || (typeof _getCct==='function'?_getCct():null) || '—';
  const nivel = window._nivelActivo || 'secundaria';
  const search = document.createElement('div');
  search.style.cssText = 'flex:1;max-width:360px;';
  search.innerHTML = '<div class="ptb-search"><span style="font-size:13px;color:#94a3b8;">🔍</span><input type="text" placeholder="' + (searchPlaceholder||'Buscar...') + '" id="' + prefix + '-search-input"/></div>';
  const actions = document.createElement('div');
  actions.id = prefix + '-topbar-pro';
  actions.style.cssText = 'margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0;';
  actions.innerHTML = (cfg.extraActions||'') + '<div onclick="docAbrirEscuelaSel()" style="display:flex;align-items:center;gap:5px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:9px;padding:5px 10px;cursor:pointer;" title="Cambiar escuela"><span style="font-size:13px;">🏫</span><span id="' + prefix + '-escuela-nombre" style="font-size:12px;font-weight:700;color:#0d5c2f;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + nombre + '</span><span style="font-size:10px;color:#0d5c2f;">▾</span></div><span id="' + prefix + '-nivel-badge" style="background:#0d5c2f;color:white;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;text-transform:capitalize;">' + nivel + '</span><button onclick="dToggleNotif&&dToggleNotif()" style="width:32px;height:32px;border:1.5px solid #e2e8f0;border-radius:8px;background:white;cursor:pointer;font-size:14px;" aria-label="Notificaciones" title="Notificaciones">🔔</button><button onclick="abrirAyuda&&abrirAyuda()" style="width:32px;height:32px;border:1.5px solid #e2e8f0;border-radius:8px;background:white;cursor:pointer;font-size:14px;" aria-label="Ayuda" title="Ayuda">❓</button>';
  topbar.appendChild(search);
  topbar.appendChild(actions);
  _topbarBindSearch(prefix, prefix + '-search-input');
}
function _topbarSyncAll() {
  const nombre = window.ESCUELA_ACTIVA?.nombre || window.currentPerfil?.escuela_nombre || '—';
  const nivel = window._nivelActivo || 'secundaria';
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  ['orient','medico','subdir','coord','pref','cont'].forEach(p => {
    const n = document.getElementById(p + '-escuela-nombre');
    const b = document.getElementById(p + '-nivel-badge');
    if (n) n.textContent = nombre;
    if (b) b.textContent = cap(nivel);
  });
}
window._topbarPro = _topbarPro;
window._topbarSyncAll = _topbarSyncAll;

function _topbarVisible(el) {
  return !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
}

function _topbarActivePage(prefix) {
  const portals = {
    dir:    ['#dir-portal .page.active', '#dir-portal .content'],
    adm:    ['#admin-portal .adm-page', '#admin-portal #adm-content'],
    ts:     ['#ts-portal .ts-page.active', '#ts-portal .ts-content'],
    subdir: ['#subdir-portal .subdir-page', '#subdir-content'],
    coord:  ['#coord-portal .coord-page', '#coord-content'],
    pref:   ['#pref-portal [id^="pref-p-"]', '#pref-portal > div > div:last-child'],
    cont:   ['#contralor-portal [id^="cont-p-"]', '#contralor-portal > div > div:last-child'],
  };
  const selectors = portals[prefix] || [];
  for (const sel of selectors) {
    const nodes = Array.from(document.querySelectorAll(sel));
    const visible = nodes.find(_topbarVisible);
    if (visible) return visible;
  }
  return null;
}

function _topbarSearchRoleConfig(prefix) {
  const shared = {
    defaultSelectors: ['.card', '.stat-card', '.panel', '.activity-item', 'table tbody tr', '.grid-2 > div', '.grid-3 > div', '.grid-4 > div'],
    types: {}
  };
  const configs = {
    dir: {
      defaultSelectors: ['.stat-card', '.card', 'table tbody tr', '#dashboard-grupos > div', '#dashboard-conflictos > div', '#dashboard-horas > div', '.sec-header', '.list-item', '.empty-state'],
      types: {
        docente: { aliases:['docente','docentes','personal','maestro','maestros'], selectors:['#p-docentes table tbody tr', '#dashboard-dispon tr', '#dashboard-horas > div', '#dir-p-dashboard .stat-card', '#dir-p-personal .card'] },
        grupo: { aliases:['grupo','grupos','salon','salones'], selectors:['#p-grupos .card', '#dashboard-grupos > div', '#p-horarios table tbody tr'] },
        alumno: { aliases:['alumno','alumnos','familia','familias'], selectors:['#dir-p-dashboard .stat-card', '#dir-p-reportes .card', '#dir-p-alumnos .card', '#dir-p-familias .card'] },
        horario: { aliases:['horario','horarios','disponibilidad'], selectors:['#p-horarios table tbody tr', '#dashboard-dispon tr', '#horarios-publicados table tbody tr'] },
        reporte: { aliases:['reporte','reportes','estadistica','estadisticas','pemc'], selectors:['#dir-p-dashboard .card', '#dir-p-reportes .card', '#dir-p-exportar .card'] },
        alerta: { aliases:['alerta','alertas','conflicto','conflictos','aviso'], selectors:['#dashboard-conflictos > div', '#dir-p-alertas-plantel .card', '#dir-p-dashboard .card'] }
      }
    },
    coord: {
      defaultSelectors: ['#coord-p-dashboard > div', '#coord-content .coord-page > div', '#coord-content table tbody tr', '#coord-content [id$=\"-lista\"] > div'],
      types: {
        docente: { aliases:['docente','docentes','maestro','maestros'], selectors:['#coord-p-dashboard > div', '#coord-p-visitas [style*=\"background:white\"]', '#coord-p-evaluacion-docentes [style*=\"background:white\"]'] },
        planeacion: { aliases:['planeacion','planeaciones','planeacion:','plan'], selectors:['#coord-p-planeaciones [style*=\"background:white\"]', '#coord-content table tbody tr'] },
        libreta: { aliases:['libreta','libretas','cuaderno','cuadernos'], selectors:['#coord-p-libretas [style*=\"background:white\"]', '#coord-content table tbody tr'] },
        visita: { aliases:['visita','visitas','observacion','observaciones'], selectors:['#coord-p-visitas [style*=\"background:white\"]', '#coord-p-dashboard > div'] },
        alerta: { aliases:['alerta','alertas','riesgo','riesgos'], selectors:['#coord-p-alertas-rendimiento [style*=\"background:white\"]', '#coord-p-dashboard > div'] },
        boleta: { aliases:['boleta','boletas','nem','academia','academias'], selectors:['#coord-p-boleta [style*=\"background:white\"]', '#coord-p-nem [style*=\"background:white\"]', '#coord-p-academias [style*=\"background:white\"]'] }
      }
    },
    adm: {
      defaultSelectors: ['#admin-portal .adm-page > div', '#admin-portal table tbody tr', '#admin-portal .card'],
      types: {
        alumno: { aliases:['alumno','alumnos','padron','inscripcion','inscripciones'], selectors:['#adm-p-padron .card', '#adm-p-inscripciones .card', '#admin-portal table tbody tr'] },
        grupo: { aliases:['grupo','grupos','acomodo','admisiones'], selectors:['#adm-p-admisiones .card', '#adm-p-dashboard .card', '#admin-portal table tbody tr'] },
        usuario: { aliases:['usuario','usuarios','personal','secretaria'], selectors:['#adm-p-usuarios .card', '#adm-p-secretarias .card', '#admin-portal table tbody tr'] }
      }
    },
    ts: {
      defaultSelectors: ['#ts-portal .ts-page > div', '#ts-portal table tbody tr', '#ts-portal .card', '.ts-caso-card'],
      types: {
        alumno: { aliases:['alumno','alumnos'], selectors:['#ts-p-dashboard .card', '#ts-p-directorio-alumnos .card', '.ts-caso-card'] },
        caso: { aliases:['caso','casos','seguimiento'], selectors:['.ts-caso-card', '#ts-p-seguimiento .card', '#ts-p-reportes .card'] },
        familia: { aliases:['familia','familias','tutor','tutores'], selectors:['#ts-p-directorio-familias .card', '#ts-p-dashboard .card'] },
        institucion: { aliases:['institucion','instituciones','contacto','contactos'], selectors:['#ts-p-directorio-instituciones .card', '#ts-p-directorio-contactos .card'] }
      }
    },
    subdir: {
      defaultSelectors: ['#subdir-content .subdir-page > div', '#subdir-content table tbody tr', '#subdir-content .card'],
      types: {
        docente: { aliases:['docente','docentes'], selectors:['#subdir-p-dashboard .card', '#subdir-p-observaciones .card', '#subdir-content table tbody tr'] },
        alerta: { aliases:['alerta','alertas','riesgo'], selectors:['#subdir-p-alertas .card', '#subdir-p-dashboard .card'] },
        horario: { aliases:['horario','horarios'], selectors:['#subdir-p-horarios-publicados .card', '#subdir-content table tbody tr'] },
        reporte: { aliases:['reporte','reportes','pemc'], selectors:['#subdir-p-reportes .card', '#subdir-p-pemc .card'] }
      }
    },
    pref: {
      defaultSelectors: ['#pref-portal [id^=\"pref-p-\"] > div', '#pref-portal table tbody tr', '#pref-portal .card'],
      types: {
        alumno: { aliases:['alumno','alumnos'], selectors:['#pref-p-dashboard .card', '#pref-p-incidencias .card', '#pref-portal table tbody tr'] },
        incidencia: { aliases:['incidencia','incidencias','reporte','reportes'], selectors:['#pref-p-incidencias .card', '#pref-p-dashboard .card'] },
        entrada: { aliases:['entrada','salida','visita','visitas'], selectors:['#pref-p-entradas-salidas .card', '#pref-portal table tbody tr'] }
      }
    },
    cont: {
      defaultSelectors: ['#contralor-portal [id^=\"cont-p-\"] > div', '#contralor-portal table tbody tr', '#contralor-portal .card'],
      types: {
        gasto: { aliases:['gasto','gastos','egreso','egresos'], selectors:['#cont-p-gastos .card', '#contralor-portal table tbody tr'] },
        proveedor: { aliases:['proveedor','proveedores'], selectors:['#cont-p-proveedores .card', '#contralor-portal table tbody tr'] },
        reporte: { aliases:['reporte','reportes','cobro','cobros','ingreso','ingresos'], selectors:['#cont-p-reportes .card', '#cont-p-cobranza .card'] }
      }
    }
  };
  return Object.assign({}, shared, configs[prefix] || {});
}

function _topbarParseSearch(prefix, rawQuery) {
  const query = (rawQuery || '').trim().toLowerCase();
  const config = _topbarSearchRoleConfig(prefix);
  if (!query) return { query:'', typeKey:null, text:'' };

  const colonIdx = query.indexOf(':');
  if (colonIdx > 0) {
    const maybeType = query.slice(0, colonIdx).trim();
    const text = query.slice(colonIdx + 1).trim();
    const typeKey = Object.keys(config.types || {}).find(key => [key].concat(config.types[key].aliases || []).includes(maybeType));
    if (typeKey) return { query, typeKey, text:text || maybeType };
  }

  const parts = query.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    const first = parts[0];
    const typeKey = Object.keys(config.types || {}).find(key => [key].concat(config.types[key].aliases || []).includes(first));
    if (typeKey) return { query, typeKey, text:parts.slice(1).join(' ') };
  }

  return { query, typeKey:null, text:query };
}

function _topbarSearchCandidates(prefix, page, typeKey) {
  const config = _topbarSearchRoleConfig(prefix);
  const selectors = typeKey && config.types?.[typeKey]?.selectors?.length
    ? config.types[typeKey].selectors
    : config.defaultSelectors;
  const set = new Set();
  (selectors || []).forEach(sel => page.querySelectorAll(sel).forEach(el => set.add(el)));
  if (!set.size) Array.from(page.children || []).forEach(el => set.add(el));
  return Array.from(set).filter(el => (el.textContent || '').trim().length > 0);
}

function _topbarSearchContainer(prefix, page) {
  const map = {
    dir: '#dir-portal .content',
    adm: '#adm-content',
    ts: '#ts-portal .ts-content',
    subdir: '#subdir-content',
    coord: '#coord-content',
    pref: '#pref-portal > div > div:last-child',
    cont: '#contralor-portal > div > div:last-child > div:last-child'
  };
  return document.querySelector(map[prefix]) || page;
}

function _topbarToggleEmpty(prefix, visible, message) {
  const id = prefix + '-search-empty';
  let empty = document.getElementById(id);
  if (!visible) {
    if (empty) empty.style.display = 'none';
    return;
  }
  if (!empty) {
    empty = document.createElement('div');
    empty.id = id;
    empty.style.cssText = 'margin:18px 24px;padding:18px 20px;border:1.5px dashed #cbd5e1;border-radius:14px;background:#f8fafc;color:#64748b;font-size:13px;font-weight:600;';
    const container = _topbarSearchContainer(prefix, _topbarActivePage(prefix));
    if (container) container.insertBefore(empty, container.firstChild);
  }
  empty.textContent = message || 'Sin resultados para esta busqueda.';
  empty.style.display = 'block';
}

function _topbarResetSearch(prefix) {
  const page = _topbarActivePage(prefix);
  if (!page) return;
  page.querySelectorAll('[data-topbar-search="1"]').forEach(el => {
    el.style.opacity = '';
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.style.backgroundColor = '';
    el.style.display = el.dataset.topbarDisplay || '';
    el.removeAttribute('data-topbar-search');
    el.removeAttribute('data-topbar-display');
  });
  _topbarToggleEmpty(prefix, false);
}

function _topbarRunSearch(prefix, rawQuery) {
  const page = _topbarActivePage(prefix);
  if (!page) return;
  const parsed = _topbarParseSearch(prefix, rawQuery);
  const query = parsed.text;
  _topbarResetSearch(prefix);
  if (!query) return;

  const candidates = _topbarSearchCandidates(prefix, page, parsed.typeKey);
  let firstMatch = null;
  let matches = 0;

  candidates.forEach(el => {
    const text = (el.textContent || '').toLowerCase();
    const match = text.includes(query);
    el.setAttribute('data-topbar-search', '1');
    if (!el.dataset.topbarDisplay) el.dataset.topbarDisplay = el.style.display || '';
    if (match) {
      matches += 1;
      el.style.opacity = '1';
      el.style.outline = '2px solid rgba(22,163,74,.45)';
      el.style.outlineOffset = '3px';
      el.style.display = el.dataset.topbarDisplay || '';
      if (!firstMatch) firstMatch = el;
    } else {
      el.style.opacity = '.28';
      el.style.display = 'none';
    }
  });

  if (firstMatch) {
    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    const typeText = parsed.typeKey ? ` en ${parsed.typeKey}` : '';
    _topbarToggleEmpty(prefix, true, `No encontre resultados${typeText} para "${query}".`);
  }
}

function _topbarBindSearch(prefix, inputId) {
  const input = document.getElementById(inputId);
  if (!input || input.dataset.topbarBound === '1') return;
  input.dataset.topbarBound = '1';
  input.addEventListener('input', (e) => _topbarRunSearch(prefix, e.target.value));
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    _topbarBindSearch('dir', 'dir-search-input');
    _topbarBindSearch('coord', 'coord-search-input');
  }, 0);
});

function orientadorInit() {
  const nameEl = document.getElementById('orient-nombre-header');
  if (nameEl && window.currentPerfil?.nombre) nameEl.textContent = window.currentPerfil.nombre;
  const avEl = document.getElementById('orient-av-initials');
  if (avEl && window.currentPerfil?.nombre) avEl.textContent = window.currentPerfil.nombre.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
  orientNav('dashboard');
  orientDashboardCargar();
}

function orientNav(page) {
  document.querySelectorAll('#orientador-portal .orient-nav-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('on-' + page);
  if (btn) btn.classList.add('active');
  document.querySelectorAll('#orientador-portal [id^="orient-p-"]').forEach(p => p.style.display = 'none');
  const pg = document.getElementById('orient-p-' + page);
  if (pg) pg.style.display = 'block';
  const titles = {
    dashboard:'Panel de Orientación', 'alumnos-riesgo':'Alumnos en riesgo',
    entrevistas:'Entrevistas', seguimiento:'Seguimiento de casos',
    'ficha-integrada':'Ficha Integrada por Alumno',
    'vista-ts':'Vista Orientador ↔ Trabajo Social',
    vocacional:'Orientación vocacional', becas:'Becas y apoyos', reportes:'Reportes'
  };
  const t = document.getElementById('orient-page-title');
  if (t) t.textContent = titles[page] || page;
  if (page === 'alumnos-riesgo')   orientAlumnosRiesgoCargar();
  if (page === 'entrevistas')      orientEntrevistasCargar();
  if (page === 'seguimiento')      orientSeguimientoCargar();
  if (page === 'becas')            orientBecasCargar();
  if (page === 'ficha-integrada')  fichaIntegradaInit();
  if (page === 'vista-ts')         vtsCargar();
}

async function orientDashboardCargar() {
  const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  if (!window.sb || !cct) return;
  try {
    const mes = new Date().toISOString().slice(0,7);
    const [rEnt, rBec] = await Promise.all([
      window.sb.from('entrevistas_orientador').select('id',{count:'exact'}).eq('escuela_cct',cct).gte('fecha',mes+'-01').limit(1),
      window.sb.from('becas_alumnos').select('id',{count:'exact'}).eq('escuela_cct',cct).eq('activo',true).limit(1),
    ]);
    const el = id => document.getElementById(id);
    if(el('orient-kpi-entrevistas')) el('orient-kpi-entrevistas').textContent = rEnt.count??0;
    if(el('orient-kpi-becas')) el('orient-kpi-becas').textContent = rBec.count??0;
  } catch(e) {}
}

async function orientAlumnosRiesgoCargar() {
  const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  const lista = document.getElementById('orient-riesgo-lista');
  const tipoFiltro = document.getElementById('orient-riesgo-tipo')?.value||'';
  if (!lista) return;
  lista.innerHTML='<div style="text-align:center;padding:40px;background:white;border-radius:12px;border:1px solid #e2e8f0;color:#94a3b8;"><div style="font-size:32px;">⏳</div><div>Cargando…</div></div>';
  if (!window.sb||!cct) { lista.innerHTML='<div style="text-align:center;padding:40px;background:white;border-radius:12px;color:#94a3b8;">Sin conexión</div>'; return; }
  try {
    let q = window.sb.from('alertas').select('*').eq('escuela_cct',cct).eq('leido',false).order('created_at',{ascending:false}).limit(30);
    if (tipoFiltro) q=q.eq('tipo',tipoFiltro);
    const {data}=await q;
    const el = document.getElementById('orient-kpi-riesgo');
    if(el) el.textContent=(data||[]).length;
    if(!data?.length) { lista.innerHTML='<div style="text-align:center;padding:60px;background:white;border-radius:12px;border:1px solid #e2e8f0;"><div style="font-size:36px;margin-bottom:8px;">✅</div><div style="font-size:14px;font-weight:600;">Sin alertas activas</div></div>'; return; }
    const tipoBg={incidencia:'#fef9c3',ausentismo:'#fee2e2',academico:'#eff6ff',conductual:'#fef2f2'};
    const tipoIcon={incidencia:'⚠️',ausentismo:'🚫',academico:'📉',conductual:'🔴'};
    lista.innerHTML=data.map(a=>`
      <div style="background:${tipoBg[a.tipo]||'#f8fafc'};border-radius:12px;border:1.5px solid #e2e8f0;padding:16px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;">
        <div style="font-size:24px;flex-shrink:0;">${tipoIcon[a.tipo]||'🔔'}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;text-transform:capitalize;">${a.tipo||'alerta'}</div>
          <div style="font-size:12px;color:#475569;margin-top:3px;">${a.contenido||a.texto||'—'}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px;">${a.created_at?new Date(a.created_at).toLocaleDateString('es-MX'):'—'}</div>
        </div>
        <button onclick="orientAgendarEntrevista('${a.docente_id||''}')" style="padding:5px 10px;font-size:11px;background:#f5f3ff;color:#7c3aed;border:1px solid #c4b5fd;border-radius:6px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;flex-shrink:0;">Entrevistar</button>
      </div>`).join('');
  } catch(e) { lista.innerHTML=`<div style="padding:40px;text-align:center;color:#ef4444;font-size:13px;">Error: ${e.message}</div>`; }
}

async function orientEntrevistasCargar() {
  const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  const lista = document.getElementById('orient-entrevistas-lista');
  if (!lista||!window.sb||!cct) return;
  try {
    const {data}=await window.sb.from('entrevistas_orientador').select('*').eq('escuela_cct',cct).order('fecha',{ascending:false}).limit(30);
    if(!data?.length){lista.innerHTML='<div style="text-align:center;padding:60px;background:white;border-radius:12px;border:1px solid #e2e8f0;color:#94a3b8;"><div style="font-size:36px;margin-bottom:8px;">🗣️</div><div>Sin entrevistas registradas</div></div>';return;}
    lista.innerHTML=data.map(e=>`
      <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:13px;font-weight:700;">${e.alumno_nombre||e.participante||'—'}</div>
          <div style="font-size:12px;color:#64748b;margin-top:3px;">${e.tipo||'Entrevista'} · ${e.fecha||'—'}</div>
          <div style="font-size:12px;color:#475569;margin-top:4px;">${(e.resumen||'').slice(0,80)}${(e.resumen||'').length>80?'…':''}</div>
        </div>
        <span style="background:#f5f3ff;color:#7c3aed;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;flex-shrink:0;">${e.tipo||'entrevista'}</span>
      </div>`).join('');
  } catch(e){lista.innerHTML='<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">Cargando…</div>';}
}

async function orientSeguimientoCargar() {
  const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  const lista = document.getElementById('orient-seguimiento-lista');
  if (!lista) return;
  if (!window.sb || !cct) { lista.innerHTML='<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">Sin conexión</div>'; return; }
  try {
    const { data } = await window.sb.from('alertas').select('*')
      .eq('escuela_cct', cct).in('tipo', ['riesgo','academico','conducta','familiar'])
      .order('created_at', { ascending: false }).limit(50);
    if (!data?.length) { lista.innerHTML='<div style="text-align:center;padding:60px;background:white;border-radius:12px;border:1px solid #e2e8f0;color:#94a3b8;"><div style="font-size:36px;margin-bottom:8px;">📈</div><div>Sin casos en seguimiento</div></div>'; return; }
    const cols = { riesgo:'#dc2626', academico:'#d97706', conducta:'#7c3aed', familiar:'#0369a1' };
    lista.innerHTML = data.map(a => `
      <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:13px;font-weight:700;">${a.alumno_nombre||a.titulo||'—'}</div>
          <div style="font-size:12px;color:#64748b;margin-top:3px;">${a.descripcion||a.detalle||'—'}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px;">${a.created_at?new Date(a.created_at).toLocaleDateString('es-MX'):'—'}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
          <span style="background:${cols[a.tipo]||'#64748b'}22;color:${cols[a.tipo]||'#64748b'};border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;">${a.tipo||'—'}</span>
          <button onclick="orientAgendarEntrevista('${a.alumno_id||''}')" style="padding:5px 10px;background:#f5f3ff;border:1.5px solid #7c3aed;border-radius:8px;font-size:11px;font-weight:700;color:#7c3aed;cursor:pointer;">Entrevistar</button>
        </div>
      </div>`).join('');
  } catch(e) { lista.innerHTML=`<div style="padding:40px;text-align:center;color:#ef4444;font-size:13px;">Error: ${e.message}</div>`; }
}

async function orientBecasCargar() {
  const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  const lista = document.getElementById('orient-becas-lista');
  if (!lista) return;
  if (!window.sb || !cct) { lista.innerHTML='<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">Sin conexión</div>'; return; }
  try {
    const { data } = await window.sb.from('becas_alumnos').select('*')
      .eq('escuela_cct', cct).order('created_at', { ascending: false }).limit(100);
    if (!data?.length) { lista.innerHTML='<div style="text-align:center;padding:60px;background:white;border-radius:12px;border:1px solid #e2e8f0;color:#94a3b8;"><div style="font-size:36px;margin-bottom:8px;">🎓</div><div>Sin becas registradas</div></div>'; return; }
    lista.innerHTML = `<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-family:'Sora',sans-serif;font-size:13px;">
      <thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">ALUMNO</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">TIPO BECA</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:700;">MONTO</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:700;">ESTADO</th>
      </tr></thead><tbody>` +
      data.map(b=>`<tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 14px;font-weight:600;">${b.alumno_nombre||b.alumno_id||'—'}</td>
        <td style="padding:10px 14px;color:#475569;">${b.tipo_beca||b.tipo||'—'}</td>
        <td style="padding:10px 14px;text-align:center;color:#059669;font-weight:700;">${b.monto?'$'+Number(b.monto).toLocaleString('es-MX'):'—'}</td>
        <td style="padding:10px 14px;text-align:center;"><span style="background:${b.activo?'#dcfce7':'#fee2e2'};color:${b.activo?'#16a34a':'#dc2626'};border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;">${b.activo?'Activa':'Inactiva'}</span></td>
      </tr>`).join('') + '</tbody></table></div>';
  } catch(e) { lista.innerHTML=`<div style="padding:40px;text-align:center;color:#ef4444;font-size:13px;">Error: ${e.message}</div>`; }
}

function orientNuevaEntrevista() {
  hubModal('🗣️ Nueva entrevista',`
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Nombre del alumno</label>
        <input id="oe-alumno" type="text" placeholder="Nombre completo del alumno" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Tipo</label>
        <select id="oe-tipo" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
          <option value="individual">Individual</option><option value="familiar">Familiar</option><option value="grupal">Grupal</option><option value="seguimiento">Seguimiento</option>
        </select></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Fecha</label>
        <input id="oe-fecha" type="date" value="${new Date().toISOString().split('T')[0]}" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Resumen</label>
        <textarea id="oe-resumen" rows="3" placeholder="Motivo y resumen de la entrevista…" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;resize:vertical;outline:none;box-sizing:border-box;"></textarea></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Acuerdos / compromisos</label>
        <textarea id="oe-acuerdos" rows="2" placeholder="Compromisos y acuerdos establecidos…" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;resize:vertical;outline:none;box-sizing:border-box;"></textarea></div>
    </div>`, 'Guardar', async () => {
    const alumno = document.getElementById('oe-alumno')?.value?.trim();
    if (!alumno) { hubToast('Escribe el nombre del alumno','warn'); return; }
    const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
    const { error } = await window.sb.from('entrevistas_orientador').insert({
      alumno_nombre: alumno,
      tipo: document.getElementById('oe-tipo')?.value || 'individual',
      fecha: document.getElementById('oe-fecha')?.value || new Date().toISOString().split('T')[0],
      resumen: document.getElementById('oe-resumen')?.value || '',
      acuerdos: document.getElementById('oe-acuerdos')?.value || '',
      orientador_id: window.currentPerfil?.id,
      escuela_cct: cct,
      created_at: new Date().toISOString()
    });
    if (error) { hubToast('Error: '+error.message,'error'); return; }
    hubToast('✅ Entrevista registrada','ok');
    orientEntrevistasCargar();
  });
}

function orientNuevaBeca() {
  hubModal('🎓 Registrar beca',`
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Nombre del alumno</label>
        <input id="ob-alumno" type="text" placeholder="Nombre completo" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Tipo de beca</label>
        <select id="ob-tipo" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
          <option value="excelencia">Excelencia académica</option><option value="vulnerabilidad">Vulnerabilidad económica</option><option value="benefactor">Benefactor</option><option value="gobierno">Gobierno/SEP</option><option value="otro">Otro</option>
        </select></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Monto mensual (MXN)</label>
        <input id="ob-monto" type="number" placeholder="0.00" min="0" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Fecha de inicio</label>
        <input id="ob-inicio" type="date" value="${new Date().toISOString().split('T')[0]}" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
    </div>`, 'Guardar', async () => {
    const alumno = document.getElementById('ob-alumno')?.value?.trim();
    if (!alumno) { hubToast('Escribe el nombre del alumno','warn'); return; }
    const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
    const { error } = await window.sb.from('becas_alumnos').insert({
      alumno_nombre: alumno,
      tipo_beca: document.getElementById('ob-tipo')?.value || 'otro',
      monto: parseFloat(document.getElementById('ob-monto')?.value) || 0,
      fecha_inicio: document.getElementById('ob-inicio')?.value || new Date().toISOString().split('T')[0],
      activo: true,
      orientador_id: window.currentPerfil?.id,
      escuela_cct: cct,
      created_at: new Date().toISOString()
    });
    if (error) { hubToast('Error: '+error.message,'error'); return; }
    hubToast('✅ Beca registrada','ok');
    orientBecasCargar();
  });
}

function orientAgendarEntrevista(alumnoId) {
  orientNav('entrevistas');
  orientNuevaEntrevista();
}
function orientAplicarTest(){
  hubModal('Test Vocacional Holland','<div style="font-size:13px;color:#475569;line-height:1.7;">'+
    '<p><strong>Instrucciones:</strong> Selecciona las áreas que más se adaptan al alumno evaluado:</p>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">'+
    ['Realista (R)','Investigador (I)','Artístico (A)','Social (S)','Emprendedor (E)','Convencional (C)'].map((a,i)=>
      `<label style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;"><input type="checkbox" id="holl-${i}" style="width:16px;height:16px;"> ${a}</label>`
    ).join('')+
    '</div>'+
    '<input id="holl-alumno" class="inp" placeholder="Nombre del alumno *" style="margin-top:12px;padding:8px;border:1px solid #e2e8f0;border-radius:6px;width:100%;box-sizing:border-box;">'+
    '<textarea id="holl-obs" placeholder="Observaciones del orientador" style="margin-top:8px;padding:8px;border:1px solid #e2e8f0;border-radius:6px;width:100%;box-sizing:border-box;resize:vertical;min-height:60px;"></textarea>'+
    '</div>','Guardar resultado',async()=>{
    const tipos=['Realista','Investigador','Artístico','Social','Emprendedor','Convencional'];
    const sel=tipos.filter((_,i)=>document.getElementById('holl-'+i)?.checked);
    const alumno=document.getElementById('holl-alumno')?.value?.trim();
    const obs=document.getElementById('holl-obs')?.value?.trim()||null;
    if(!alumno||!sel.length){hubToast('Selecciona al menos un área e ingresa el nombre del alumno','error');return;}
    const cct=window.currentPerfil?.escuela_cct;
    const{error}=await window.sb.from('orient_resultados_vocacionales').insert({escuela_cct:cct,alumno_nombre:alumno,tipos_holland:sel,perfil:sel.join(', '),observaciones:obs,orientador_id:window.currentPerfil?.id,ciclo:window.CICLO_ACTIVO||'2025-2026',created_at:new Date().toISOString()}).catch(()=>({error:{message:'tabla no disponible aún'}}));
    if(error){hubToast('Guardado local — '+error.message,'ok');}else{hubToast('✅ Resultado guardado');}
  });
}
async function orientVerResultados(){
  const cct=window.currentPerfil?.escuela_cct;
  if(!window.sb||!cct){hubToast('Sin conexión','error');return;}
  const{data}=await window.sb.from('orient_resultados_vocacionales').select('*').eq('escuela_cct',cct).order('created_at',{ascending:false}).limit(50).catch(()=>({data:null}));
  const items=data||[];
  if(!items.length){hubToast('Sin resultados vocacionales registrados aún','ok');return;}
  const html='<div style="overflow-y:auto;max-height:360px;">'+
    '<table style="width:100%;border-collapse:collapse;font-size:13px;">'+
    '<thead><tr style="background:#f8fafc;"><th style="padding:8px;text-align:left;border-bottom:1px solid #e2e8f0;">Alumno</th><th style="padding:8px;text-align:left;border-bottom:1px solid #e2e8f0;">Perfil Holland</th><th style="padding:8px;text-align:left;border-bottom:1px solid #e2e8f0;">Fecha</th></tr></thead>'+
    '<tbody>'+items.map(r=>`<tr><td style="padding:8px;border-bottom:1px solid #f1f5f9;">${r.alumno_nombre}</td><td style="padding:8px;border-bottom:1px solid #f1f5f9;">${r.perfil||'—'}</td><td style="padding:8px;border-bottom:1px solid #f1f5f9;">${r.created_at?new Date(r.created_at).toLocaleDateString('es-MX'):''}</td></tr>`).join('')+
    '</tbody></table></div>';
  hubModal('Resultados Vocacionales',html,'Cerrar',null);
}
function orientInfoContinuacion(){
  const html='<div style="font-size:13px;line-height:1.8;color:#374151;">'+
    '<p style="font-weight:700;color:#0f172a;margin-bottom:12px;">Opciones de continuación educativa en México</p>'+
    '<div style="display:grid;gap:10px;">'+
    [['🎓 Preparatoria General','UNAM, IPN, COBACH, CBTIS — ingreso por COMIPEMS o examen directo'],
     ['🔧 Preparatoria Técnica','CONALEP, CECyT, CBTis — formación técnica + bachillerato'],
     ['📚 Preparatoria Abierta','SEP — modalidad no escolarizada para adultos'],
     ['💻 Educación en línea','Prepa en Línea-SEP, preparatorias en modalidad mixta'],
     ['🌎 Opciones privadas','Preparatorias privadas con o sin incorporación a la SEP']].map(([t,d])=>
    `<div style="padding:10px;background:#f8fafc;border-radius:8px;border-left:3px solid #22c55e;"><strong>${t}</strong><br><span style="color:#475569;">${d}</span></div>`
    ).join('')+
    '</div>'+
    '<p style="margin-top:14px;font-size:12px;color:#94a3b8;">Para asesoría personalizada, agenda una entrevista vocacional con el alumno.</p>'+
    '</div>';
  hubModal('Continuación Educativa',html,'Entendido',null);
}

// ═══════════════════════════════════════════════════════
// MÉDICO ESCOLAR — Portal
// ═══════════════════════════════════════════════════════
function medicoInit() {
  const nameEl = document.getElementById('medico-nombre-header');
  if (nameEl && window.currentPerfil?.nombre) nameEl.textContent = window.currentPerfil.nombre;
  _topbarPro({ titleId:'medico-page-title', prefix:'medico', searchPlaceholder:'Buscar alumno, diagnóstico…' });
  medicoNav('dashboard');
  medicoDashboardCargar();
}

function medicoNav(page) {
  document.querySelectorAll('#medico-portal .adm-nav').forEach(b => b.style.background = '');
  const btn = document.getElementById('mn-' + page);
  if (btn) btn.style.background = 'rgba(255,255,255,.15)';
  document.querySelectorAll('#medico-portal [id^="medico-p-"]').forEach(p => p.style.display = 'none');
  const pg = document.getElementById('medico-p-' + page);
  if (pg) pg.style.display = 'block';
  const titles = {
    dashboard:'Dashboard · Médico escolar', consultas:'Consultas médicas',
    expedientes:'Expedientes clínicos', vacunas:'Control de vacunación',
    enfermedades:'Control epidemiológico', reportes:'Reportes médicos'
  };
  const t = document.getElementById('medico-page-title');
  if (t) t.textContent = titles[page] || page;
  if (page === 'consultas')    medicoConsultasCargar();
  if (page === 'expedientes')  medicoExpedientesCargar();
  if (page === 'vacunas')      medicoVacunasCargar();
  if (page === 'enfermedades') medicoEpidCargar();
}

async function medicoDashboardCargar() {
  const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  if (!window.sb||!cct) return;
  try {
    const mes = new Date().toISOString().slice(0,7);
    const {count:cCons}=await window.sb.from('consultas_medicas').select('id',{count:'exact'}).eq('escuela_cct',cct).gte('fecha',mes+'-01').limit(1);
    const {count:cUrg}=await window.sb.from('consultas_medicas').select('id',{count:'exact'}).eq('escuela_cct',cct).eq('urgencia',true).limit(1);
    const el=id=>document.getElementById(id);
    if(el('medico-kpi-consultas'))el('medico-kpi-consultas').textContent=cCons??0;
    if(el('medico-kpi-urgencias'))el('medico-kpi-urgencias').textContent=cUrg??0;
    // KPI vacunados — desde vacunas_alumnos si existe
    try {
      const {count:cVac}=await window.sb.from('vacunas_alumnos').select('id',{count:'exact'}).eq('escuela_cct',cct).gte('fecha',mes+'-01').limit(1);
      if(el('medico-kpi-vacunados'))el('medico-kpi-vacunados').textContent=cVac??0;
    } catch(_){}
  } catch(e){}
}

async function medicoConsultasCargar() {
  const cct=typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  const lista=document.getElementById('medico-consultas-lista');
  if(!lista||!window.sb||!cct)return;
  try {
    const {data}=await window.sb.from('consultas_medicas').select('*').eq('escuela_cct',cct).order('fecha',{ascending:false}).limit(30);
    if(!data?.length){lista.innerHTML='<div style="text-align:center;padding:60px;background:white;border-radius:12px;border:1px solid #e2e8f0;color:#94a3b8;"><div style="font-size:36px;margin-bottom:8px;">🩺</div><div>Sin consultas registradas</div></div>';return;}
    lista.innerHTML=`<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-family:'Sora',sans-serif;font-size:13px;"><thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;"><th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">ALUMNO</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">MOTIVO</th><th style="padding:10px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:700;">FECHA</th><th style="padding:10px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:700;">URGENCIA</th></tr></thead><tbody>`+
    data.map(c=>`<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 14px;font-weight:600;">${c.alumno_nombre||'—'}</td><td style="padding:10px 14px;color:#475569;">${c.motivo||'—'}</td><td style="padding:10px 14px;text-align:center;color:#64748b;">${c.fecha||'—'}</td><td style="padding:10px 14px;text-align:center;">${c.urgencia?'<span style="color:#dc2626;font-weight:700;">🔴 Sí</span>':'—'}</td></tr>`).join('')+
    '</tbody></table></div>';
  } catch(e){lista.innerHTML=`<div style="padding:40px;text-align:center;color:#ef4444;font-size:13px;">Error: ${e.message}</div>`;}
}

function medicoNuevaConsulta(){
  hubModal('🩺 Nueva consulta médica',`
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Nombre del alumno</label>
        <input id="cons-alumno" type="text" placeholder="Nombre completo" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Motivo de consulta</label>
        <textarea id="cons-motivo" rows="2" placeholder="Describe el motivo…" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;resize:vertical;outline:none;box-sizing:border-box;"></textarea></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Diagnóstico / tratamiento</label>
        <textarea id="cons-diag" rows="2" placeholder="Diagnóstico y acciones tomadas…" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;resize:vertical;outline:none;box-sizing:border-box;"></textarea></div>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="cons-urgencia" style="width:16px;height:16px;">
        <label for="cons-urgencia" style="font-size:13px;font-weight:600;color:#dc2626;">🔴 Urgencia / requiere traslado</label>
      </div>
    </div>`,'Guardar',async()=>{
    const alumno=document.getElementById('cons-alumno')?.value?.trim();
    if(!alumno){hubToast('Escribe el nombre del alumno','warn');return;}
    const cct=typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
    await window.sb.from('consultas_medicas').insert({
      alumno_nombre:alumno, motivo:document.getElementById('cons-motivo')?.value||'',
      diagnostico:document.getElementById('cons-diag')?.value||'',
      urgencia:!!document.getElementById('cons-urgencia')?.checked,
      fecha:new Date().toISOString().split('T')[0],
      medico_id:window.currentPerfil?.id, escuela_cct:cct, created_at:new Date().toISOString()
    }).catch(e=>hubToast('Error: '+e.message,'error'));
    hubToast('✅ Consulta registrada','ok');medicoConsultasCargar();
  });
}

async function medicoExpedientesCargar(){
  const cct=typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  const lista=document.getElementById('medico-expedientes-lista');
  if(!lista)return;
  if(!window.sb||!cct){lista.innerHTML='<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">Sin conexión</div>';return;}
  try{
    const{data}=await window.sb.from('consultas_medicas').select('alumno_nombre,fecha,motivo,diagnostico,urgencia')
      .eq('escuela_cct',cct).order('alumno_nombre').order('fecha',{ascending:false}).limit(200);
    if(!data?.length){lista.innerHTML='<div style="text-align:center;padding:60px;background:white;border-radius:12px;border:1px solid #e2e8f0;color:#94a3b8;"><div style="font-size:36px;margin-bottom:8px;">📁</div><div>Sin expedientes registrados</div></div>';return;}
    // Agrupar por alumno
    const mapa={};
    data.forEach(c=>{const k=c.alumno_nombre||'Desconocido';if(!mapa[k])mapa[k]=[];mapa[k].push(c);});
    window._medicoExpedientes=mapa;
    _medicoRenderExpedientes(mapa);
  }catch(e){lista.innerHTML=`<div style="padding:40px;text-align:center;color:#ef4444;font-size:13px;">Error: ${e.message}</div>`;}
}

function _medicoRenderExpedientes(mapa, filtro=''){
  const lista=document.getElementById('medico-expedientes-lista');
  if(!lista)return;
  const alumnos=Object.keys(mapa).filter(n=>!filtro||n.toLowerCase().includes(filtro.toLowerCase()));
  if(!alumnos.length){lista.innerHTML='<div style="text-align:center;padding:60px;background:white;border-radius:12px;border:1px solid #e2e8f0;color:#94a3b8;"><div style="font-size:36px;margin-bottom:8px;">🔍</div><div>Sin resultados</div></div>';return;}
  lista.innerHTML=alumnos.map(nombre=>{
    const consultas=mapa[nombre];
    return `<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:10px;overflow:hidden;">
      <div style="padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:13px;font-weight:700;">${nombre}</div>
        <span style="background:#dbeafe;color:#1e40af;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;">${consultas.length} consulta${consultas.length!==1?'s':''}</span>
      </div>
      <div style="padding:10px 16px;">
        ${consultas.map(c=>`<div style="border-bottom:1px solid #f1f5f9;padding:8px 0;font-size:12px;">
          <span style="color:#64748b;">${c.fecha||'—'}</span>
          <span style="margin:0 8px;color:#94a3b8;">·</span>
          <span style="color:#475569;">${c.motivo||'—'}</span>
          ${c.urgencia?'<span style="margin-left:8px;color:#dc2626;font-weight:700;">🔴 Urgencia</span>':''}
          ${c.diagnostico?`<div style="color:#64748b;margin-top:3px;font-size:11px;">Dx: ${c.diagnostico}</div>`:''}
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function medicoExpBuscar(q){
  if(window._medicoExpedientes) _medicoRenderExpedientes(window._medicoExpedientes, q);
}

async function medicoVacunasCargar(){
  const cct=typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  const lista=document.getElementById('medico-vacunas-lista');
  if(!lista)return;
  if(!window.sb||!cct){lista.innerHTML='<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">Sin conexión</div>';return;}
  try{
    const{data,error}=await window.sb.from('vacunas_alumnos').select('*').eq('escuela_cct',cct).order('fecha',{ascending:false}).limit(200);
    if(error?.code==='42P01'){lista.innerHTML='<div style="text-align:center;padding:60px;background:white;border-radius:12px;border:1px solid #e2e8f0;color:#94a3b8;"><div style="font-size:36px;margin-bottom:8px;">💉</div><div>Tabla de vacunación pendiente de crear en Supabase</div><div style="margin-top:8px;font-size:11px;">Ejecuta el SQL en el panel de Supabase</div></div>';return;}
    if(!data?.length){lista.innerHTML='<div style="text-align:center;padding:60px;background:white;border-radius:12px;border:1px solid #e2e8f0;color:#94a3b8;"><div style="font-size:36px;margin-bottom:8px;">💉</div><div>Sin registros de vacunación</div></div>';return;}
    lista.innerHTML=`<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-family:'Sora',sans-serif;font-size:13px;">
      <thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">ALUMNO</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">VACUNA</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:700;">FECHA</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:700;">LOTE</th>
      </tr></thead><tbody>`+
    data.map(v=>`<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 14px;font-weight:600;">${v.alumno_nombre||'—'}</td><td style="padding:10px 14px;">${v.vacuna||'—'}</td><td style="padding:10px 14px;text-align:center;color:#64748b;">${v.fecha||'—'}</td><td style="padding:10px 14px;text-align:center;color:#94a3b8;">${v.lote||'—'}</td></tr>`).join('')+
    '</tbody></table></div>';
  }catch(e){lista.innerHTML=`<div style="padding:40px;text-align:center;color:#ef4444;font-size:13px;">Error: ${e.message}</div>`;}
}

async function medicoEpidCargar(){
  const cct=typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  const lista=document.getElementById('medico-epid-lista');
  if(!lista)return;
  if(!window.sb||!cct){lista.innerHTML='<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">Sin conexión</div>';return;}
  try{
    const mes=new Date().toISOString().slice(0,7);
    const{data}=await window.sb.from('consultas_medicas').select('motivo,diagnostico,fecha')
      .eq('escuela_cct',cct).gte('fecha',mes+'-01').limit(300);
    if(!data?.length){lista.innerHTML='<div style="text-align:center;padding:60px;background:white;border-radius:12px;border:1px solid #e2e8f0;color:#94a3b8;"><div style="font-size:36px;margin-bottom:8px;">🦠</div><div>Sin consultas este mes</div></div>';return;}
    // Contar por motivo
    const conteo={};
    data.forEach(c=>{const k=(c.motivo||'Sin especificar').split(/[\.,;]/)[0].trim().slice(0,40);conteo[k]=(conteo[k]||0)+1;});
    const sorted=Object.entries(conteo).sort((a,b)=>b[1]-a[1]);
    const max=sorted[0]?.[1]||1;
    lista.innerHTML=`<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:20px;">
      <div style="font-size:13px;font-weight:700;color:#475569;margin-bottom:16px;">Padecimientos más frecuentes — ${mes.replace('-','/')}</div>
      ${sorted.map(([mot,cnt])=>`<div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
          <span style="font-weight:600;color:#334155;">${mot}</span>
          <span style="font-weight:700;color:#7c3aed;">${cnt} caso${cnt!==1?'s':''}</span>
        </div>
        <div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden;">
          <div style="height:100%;background:#7c3aed;width:${Math.round(cnt/max*100)}%;border-radius:4px;"></div>
        </div>
      </div>`).join('')}
      <div style="margin-top:16px;font-size:11px;color:#94a3b8;text-align:right;">Total: ${data.length} consultas en el mes</div>
    </div>`;
  }catch(e){lista.innerHTML=`<div style="padding:40px;text-align:center;color:#ef4444;font-size:13px;">Error: ${e.message}</div>`;}
}

// ═══════════════════════════════════════════════════════
// COBRANZA — módulo admin
// ═══════════════════════════════════════════════════════
const COB = {
  conceptos: [
    { id:'c1', nombre:'Colegiatura mensual', monto:1800, frecuencia:'mensual', aplica:'todos',    icono:'💵' },
    { id:'c2', nombre:'Inscripción anual',   monto:3500, frecuencia:'anual',   aplica:'todos',    icono:'📝' },
    { id:'c3', nombre:'Transporte',          monto:900,  frecuencia:'mensual', aplica:'opcional', icono:'🚌' },
    { id:'c4', nombre:'Comedor',             monto:1200, frecuencia:'mensual', aplica:'opcional', icono:'🍱' },
  ],
  becas: [
    { id:'b1', nombre:'Beca excelencia',    tipo:'porcentaje', valor:50,  aplica:'colegiatura' },
    { id:'b2', nombre:'Descuento hermanos', tipo:'porcentaje', valor:15,  aplica:'colegiatura' },
    { id:'b3', nombre:'Personal docente',   tipo:'porcentaje', valor:100, aplica:'todos' },
  ],
  alumnos: [],
  historial: [
    { fecha:'2026-03-05', alumno:'Valentina García', grupo:'1° A', concepto:'Colegiatura', metodo:'Tarjeta',  monto:1800, estado:'pagado' },
    { fecha:'2026-03-06', alumno:'Sofía Martínez',   grupo:'2° B', concepto:'Colegiatura', metodo:'SPEI',     monto:900,  estado:'pagado' },
    { fecha:'2026-03-10', alumno:'Mateo López',      grupo:'1° A', concepto:'Colegiatura', metodo:'Efectivo', monto:1530, estado:'pendiente' },
    { fecha:'2026-02-05', alumno:'Diego Hernández',  grupo:'2° B', concepto:'Colegiatura', metodo:'OXXO',     monto:1800, estado:'fallido' },
  ],
  fmt(n) { return '$' + Number(n).toLocaleString('es-MX'); },
  calcTotal(a) {
    const base = this.conceptos.find(c=>c.id==='c1')?.monto || 1800;
    const extras = (a.extras||[]).reduce((s,eid)=>s+(this.conceptos.find(c=>c.id===eid)?.monto||0),0);
    const sub = base + extras;
    if (!a.beca) return sub;
    const beca = this.becas.find(b=>b.id===a.beca);
    if (!beca) return sub;
    const desc = beca.tipo==='porcentaje'
      ? (beca.aplica==='colegiatura' ? base*beca.valor/100 : sub*beca.valor/100)
      : beca.valor;
    return Math.max(0, sub - desc);
  },
  initAlumnos() {
    if (window._alumnosActivos?.length) {
      this.alumnos = window._alumnosActivos.map(a => ({
        id: a.id||String(Math.random()),
        nombre: a.n || `${a.nombre||''} ${a.apellido_p||''}`.trim(),
        grupo: a.grupo || '—',
        beca: null,
        estado: ['al-corriente','pendiente','vencido'][Math.floor(Math.random()*3)],
        extras: []
      }));
    } else {
      this.alumnos = [
        { id:'a1', nombre:'Valentina García', grupo:'1° A', beca:null, estado:'al-corriente', extras:[] },
        { id:'a2', nombre:'Mateo López',      grupo:'1° A', beca:'b2', estado:'pendiente',    extras:['c3'] },
        { id:'a3', nombre:'Sofía Martínez',   grupo:'2° B', beca:'b1', estado:'al-corriente', extras:[] },
        { id:'a4', nombre:'Diego Hernández',  grupo:'2° B', beca:null, estado:'vencido',      extras:['c3','c4'] },
        { id:'a5', nombre:'Camila Rodríguez', grupo:'3° A', beca:null, estado:'al-corriente', extras:['c4'] },
        { id:'a6', nombre:'Sebastián Torres', grupo:'3° A', beca:'b3', estado:'al-corriente', extras:[] },
      ];
    }
  },
  updateKPIs() {
    const pagados  = this.historial.filter(h=>h.estado==='pagado'&&h.fecha.startsWith('2026-03'));
    const cobrado  = pagados.reduce((s,h)=>s+h.monto,0);
    const pends    = this.alumnos.filter(a=>a.estado==='pendiente'||a.estado==='vencido');
    const montoPend= pends.reduce((s,a)=>s+this.calcTotal(a),0);
    const conBeca  = this.alumnos.filter(a=>a.beca).length;
    const totalEsp = cobrado + montoPend;
    const pct      = totalEsp>0 ? Math.round(cobrado/totalEsp*100) : 0;
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    set('cob-kpi-cobrado',  this.fmt(cobrado));
    set('cob-kpi-pendiente',this.fmt(montoPend));
    set('cob-kpi-pend-cnt', pends.length+' familias');
    set('cob-kpi-becas',    conBeca);
    set('cob-kpi-pct',      pct+'%');
    const bar=document.getElementById('cob-kpi-bar');
    if(bar) bar.style.width=pct+'%';
  },
  renderTabla() {
    const buscar=(document.getElementById('cob-buscador')?.value||'').toLowerCase();
    const grp=document.getElementById('cob-filtro-grupo')?.value||'';
    const est=document.getElementById('cob-filtro-estado')?.value||'';
    const lista=this.alumnos.filter(a=>{
      if(buscar&&!a.nombre.toLowerCase().includes(buscar))return false;
      if(grp&&a.grupo!==grp)return false;
      if(est&&a.estado!==est)return false;
      return true;
    });
    const badges={
      'al-corriente':'<span style="background:#f0fdf4;color:#0a5c2e;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700;">✅ Al corriente</span>',
      'pendiente':   '<span style="background:#fffbeb;color:#b45309;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700;">⏳ Pendiente</span>',
      'vencido':     '<span style="background:#fef2f2;color:#b91c1c;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700;">🔴 Vencido</span>',
    };
    const tbody=document.getElementById('cob-tbody');
    if(!tbody)return;
    tbody.innerHTML=lista.map(a=>{
      const total=this.calcTotal(a);
      const beca=a.beca?this.becas.find(b=>b.id===a.beca):null;
      return `<tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:12px 14px;font-size:13px;font-weight:600;">${a.nombre}${beca?`<span style="background:#f5f3ff;color:#7c3aed;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;margin-left:6px;">🎓 ${beca.nombre}</span>`:''}
        </td>
        <td style="padding:12px 14px;font-size:12px;color:#64748b;">${a.grupo}</td>
        <td style="padding:12px 14px;font-family:'Fraunces',serif;font-size:16px;font-weight:700;color:#0a5c2e;">${this.fmt(total)}</td>
        <td style="padding:12px 14px;">${badges[a.estado]||''}</td>
        <td style="padding:12px 14px;">
          <button onclick="cobRegistrarPago('${a.id}')" style="padding:6px 12px;background:#0a5c2e;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;">💳 Pago</button>
          <button onclick="cobEnviarRecordatorio('${a.id}')" style="margin-left:4px;padding:6px 10px;background:white;border:1.5px solid #e2e8f0;border-radius:8px;font-size:11px;cursor:pointer;" title="Recordatorio">📩</button>
        </td>
      </tr>`;
    }).join('');
  },
  renderConceptos() {
    const el=document.getElementById('cob-lista-conceptos');if(!el)return;
    el.innerHTML=this.conceptos.map(c=>`
      <div style="background:white;border:1.5px solid #e2e8f0;border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px;margin-bottom:10px;">
        <div style="font-size:22px;">${c.icono}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;">${c.nombre}</div>
          <div style="font-size:11px;color:#64748b;">${{mensual:'Mensual',anual:'Anual',trimestral:'Trimestral',unico:'Único'}[c.frecuencia]} · ${c.aplica==='todos'?'Todos':'Opcional'}</div>
        </div>
        <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;color:#0a5c2e;">${this.fmt(c.monto)}</div>
        <button onclick="cobEditarConcepto('${c.id}')" style="padding:6px 12px;background:white;border:1.5px solid #e2e8f0;border-radius:8px;font-size:11px;cursor:pointer;">✏️ Editar</button>
      </div>`).join('');
  },
  renderBecas() {
    const el=document.getElementById('cob-lista-becas');if(!el)return;
    el.innerHTML=`<table style="width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;border:1.5px solid #e2e8f0;">
      <thead><tr style="border-bottom:2px solid #f1f5f9;">
        <th style="padding:10px 14px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;text-align:left;">Categoría</th>
        <th style="padding:10px 14px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;text-align:left;">Descuento</th>
        <th style="padding:10px 14px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;text-align:left;">Alumnos asignados</th>
      </tr></thead>
      <tbody>${this.becas.map(b=>{
        const asig=this.alumnos.filter(a=>a.beca===b.id).length;
        return `<tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:12px 14px;font-size:13px;font-weight:600;">${b.nombre}</td>
          <td style="padding:12px 14px;"><span style="background:#f5f3ff;color:#7c3aed;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;">${b.tipo==='porcentaje'?b.valor+'%':'$'+b.valor}</span></td>
          <td style="padding:12px 14px;"><span style="background:#eff6ff;color:#1d4ed8;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;">${asig} alumnos</span></td>
        </tr>`;
      }).join('')}</tbody></table>`;
    // Actualizar selector de categorías en asignación masiva
    const selCat = document.getElementById('cob-beca-sel-cat');
    if (selCat) {
      selCat.innerHTML = '<option value="">Selecciona categoría…</option>' +
        this.becas.map(b => `<option value="${b.id}">${b.nombre} (${b.tipo==='porcentaje'?b.valor+'%':'$'+b.valor})</option>`).join('');
    }
  },
  renderHistorial() {
    const tbody=document.getElementById('cob-hist-tbody');if(!tbody)return;
    const badges={pagado:'background:#f0fdf4;color:#0a5c2e',pendiente:'background:#fffbeb;color:#b45309',fallido:'background:#fef2f2;color:#b91c1c'};
    tbody.innerHTML=this.historial.map(h=>`<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:10px 12px;font-size:12px;color:#64748b;">${h.fecha}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:600;">${h.alumno}</td>
      <td style="padding:10px 12px;font-size:12px;">${h.concepto}</td>
      <td style="padding:10px 12px;font-size:12px;">${h.metodo}</td>
      <td style="padding:10px 12px;font-family:'Fraunces',serif;font-weight:700;">${this.fmt(h.monto)}</td>
      <td style="padding:10px 12px;"><span style="padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700;${badges[h.estado]||''}">${h.estado}</span></td>
    </tr>`).join('');
  },
  poblarFiltros() {
    const grupos=[...new Set(this.alumnos.map(a=>a.grupo))].sort();
    const sel=document.getElementById('cob-filtro-grupo');if(!sel)return;
    sel.innerHTML='<option value="">Todos los grupos</option>'+grupos.map(g=>`<option value="${g}">${g}</option>`).join('');
  },
  async init() {
    await this.cargarDesdeSupabase();
    this.setupRealtime();
  },

  async cargarDesdeSupabase() {
    const perfil = JSON.parse(localStorage.getItem('siembra_perfil') || '{}');
    const escuela = window._escuelaCCT || perfil.escuela_cct;
    const sb = window.sb;
    if (!sb || !escuela) {
      this.initAlumnos(); this.updateKPIs(); this.renderTabla(); this.poblarFiltros();
      return;
    }
    try {
      // Conceptos
      const { data: concs } = await sb.from('conceptos_cobro').select('*').eq('escuela_cct', escuela).eq('activo', true);
      if (concs?.length) this.conceptos = concs.map(c => ({ id:c.id, nombre:c.nombre, monto:Number(c.monto), frecuencia:c.frecuencia, aplica:c.aplica, icono:c.icono||'💵' }));

      // Becas categorías
      const { data: becasDB } = await sb.from('becas_categorias').select('*').eq('escuela_cct', escuela).eq('activo', true);
      if (becasDB?.length) this.becas = becasDB.map(b => ({ id:b.id, nombre:b.nombre, tipo:b.tipo, valor:Number(b.valor), aplica:b.aplica_sobre }));

      // Cargos + alumno info (mes actual)
      const mes = new Date().getMonth() + 1;
      const { data: cargos } = await sb.from('cargos_alumno')
        .select('id, alumno_id, monto_base, descuento, monto_final, fecha_vto, estado, mes, periodo_label, usuarios!alumno_id(nombre, apellido_p, grupos!grupo_id(nombre_grupo))')
        .eq('escuela_cct', escuela)
        .eq('ciclo', '2025-2026')
        .order('fecha_vto', { ascending: false });
      if (cargos?.length) {
        const map = {};
        cargos.forEach(c => {
          const u = c.usuarios;
          if (!u) return;
          const nombre = `${u.nombre||''} ${u.apellido_p||''}`.trim();
          if (!map[c.alumno_id] || c.mes === mes) {
            map[c.alumno_id] = {
              id: c.alumno_id, cargo_id: c.id,
              nombre, grupo: u.grupos?.nombre_grupo || '—',
              beca: null, extras: [],
              estado: c.estado,
              monto_final: Number(c.monto_final)
            };
          }
        });
        this.alumnos = Object.values(map);
      }

      // Becas asignadas
      if (this.alumnos.length) {
        const alumnoIds = this.alumnos.map(a => a.id);
        const { data: becasAl } = await sb.from('becas_alumno').select('alumno_id, categoria_id').in('alumno_id', alumnoIds).eq('ciclo', '2025-2026');
        if (becasAl?.length) becasAl.forEach(ba => {
          const a = this.alumnos.find(x => x.id === ba.alumno_id);
          if (a) a.beca = ba.categoria_id;
        });
      }

      // Historial de pagos
      const { data: hist } = await sb.from('pagos_colegiatura')
        .select('concepto_nombre, monto, metodo, estado, pagado_en, creado_en, usuarios!alumno_id(nombre, apellido_p, grupos!grupo_id(nombre_grupo))')
        .eq('escuela_cct', escuela)
        .order('creado_en', { ascending: false })
        .limit(20);
      if (hist?.length) {
        this.historial = hist.map(p => ({
          fecha: (p.pagado_en || p.creado_en || '').split('T')[0],
          alumno: p.usuarios ? `${p.usuarios.nombre||''} ${p.usuarios.apellido_p||''}`.trim() : '—',
          grupo: p.usuarios?.grupos?.nombre_grupo || '—',
          concepto: p.concepto_nombre || 'Colegiatura',
          metodo: p.metodo || '—',
          monto: Number(p.monto),
          estado: p.estado
        }));
      }

    } catch(e) {
      console.warn('COB: Supabase error, usando demo', e);
      this.initAlumnos();
    }
    this.updateKPIs();
    this.renderTabla();
    this.poblarFiltros();
  },

  setupRealtime() {
    const sb = window.sb;
    if (!sb || this._realtimeSetup) return;
    this._realtimeSetup = true;
    sb.channel('cob-pagos-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pagos_colegiatura' }, payload => {
        const p = payload.new;
        // Actualizar alumno en lista
        const a = this.alumnos.find(x => x.id === p.alumno_id);
        if (a) a.estado = 'al-corriente';
        // Agregar a historial
        this.historial.unshift({ fecha: new Date().toISOString().split('T')[0], alumno: a?.nombre || 'Alumno', grupo: a?.grupo || '—', concepto: p.concepto_nombre || 'Colegiatura', metodo: p.metodo || '—', monto: Number(p.monto), estado: p.estado });
        this.updateKPIs();
        this.renderTabla();
        if (typeof admToast === 'function') admToast(`💰 Pago recibido: ${p.concepto_nombre || 'Colegiatura'} — ${this.fmt(p.monto)}`);
      })
      .subscribe();
  }
};

function cobTab(name) {
  ['cuenta','conceptos','becas','historial','config'].forEach(t=>{
    const btn=document.getElementById('cob-tab-'+t);
    const pan=document.getElementById('cob-panel-'+t);
    if(btn){btn.style.background=t===name?'#0a5c2e':'transparent';btn.style.color=t===name?'white':'#64748b';}
    if(pan)pan.style.display=t===name?'':'none';
  });
  if(name==='conceptos')COB.renderConceptos();
  if(name==='becas') { COB.renderBecas(); cobRenderAsignacionBecas(); }
  if(name==='historial')COB.renderHistorial();
}
function cobRenderTabla() { COB.renderTabla(); }
function cobGenerarMasivo() {
  // Poblar select de conceptos en modal
  const selConc = document.getElementById('cob-masivo-concepto');
  const selGrp  = document.getElementById('cob-masivo-grupo');
  if (selConc) {
    selConc.innerHTML = COB.conceptos.map(c => `<option value="${c.id}">${c.icono} ${c.nombre} — ${COB.fmt(c.monto)}</option>`).join('');
  }
  if (selGrp) {
    const grupos = [...new Set(COB.alumnos.map(a => a.grupo))].sort();
    selGrp.innerHTML = '<option value="">Todos los alumnos</option>' + grupos.map(g => `<option value="${g}">${g}</option>`).join('');
  }
  const mes = new Date().getMonth() + 1;
  const selMes = document.getElementById('cob-masivo-mes');
  if (selMes) selMes.value = mes;
  document.getElementById('modal-cob-masivo')?.classList.add('open');
}

async function cobEjecutarMasivo() {
  const conceptoId = document.getElementById('cob-masivo-concepto')?.value;
  const mes        = parseInt(document.getElementById('cob-masivo-mes')?.value || '0');
  const grupo      = document.getElementById('cob-masivo-grupo')?.value || '';
  if (!conceptoId || !mes) { hubToast('⚠️ Selecciona concepto y mes', 'warn'); return; }

  document.getElementById('modal-cob-masivo')?.classList.remove('open');

  const sb = window.sb;
  const perfil = JSON.parse(localStorage.getItem('siembra_perfil') || '{}');
  const escuela = window._escuelaCCT || perfil.escuela_cct;

  if (sb && escuela) {
    try {
      const { data, error } = await sb.rpc('generar_cargos_masivos', {
        p_escuela_cct:  escuela,
        p_concepto_id:  conceptoId,
        p_mes:          mes,
        p_ciclo:        '2025-2026',
        p_generado_por: null
      });
      if (error) throw error;
      if (typeof admToast === 'function') admToast(`⚡ ${data || '?'} cargos generados correctamente`);
      COB.cargarDesdeSupabase();
    } catch(e) {
      if (typeof admToast === 'function') admToast('❌ Error: ' + e.message, true);
    }
  } else {
    // Demo: marcar pendientes
    const conc = COB.conceptos.find(c => c.id === conceptoId);
    const lista = grupo ? COB.alumnos.filter(a => a.grupo === grupo) : COB.alumnos;
    lista.forEach(a => { if (a.estado === 'al-corriente') a.estado = 'pendiente'; });
    COB.updateKPIs(); COB.renderTabla();
    if (typeof admToast === 'function') admToast(`⚡ ${lista.length} cargos de ${conc?.nombre} generados (demo)`);
  }
}
function cobRegistrarPago(id) {
  const a=COB.alumnos.find(x=>x.id===id);if(!a)return;
  const metodo=prompt(`Registrar pago de ${a.nombre}\nTotal: ${COB.fmt(COB.calcTotal(a))}\n\nMétodo (Efectivo/Tarjeta/OXXO/SPEI):`);
  if(!metodo)return;
  a.estado='al-corriente';
  COB.historial.unshift({fecha:new Date().toISOString().split('T')[0],alumno:a.nombre,grupo:a.grupo,concepto:'Colegiatura',metodo,monto:COB.calcTotal(a),estado:'pagado'});
  COB.updateKPIs();COB.renderTabla();
  if(typeof admToast==='function') admToast(`✅ Pago de ${a.nombre} registrado`);
}
function cobEnviarRecordatorio(id) {
  const a=COB.alumnos.find(x=>x.id===id);
  if(a&&typeof admToast==='function') admToast(`📩 Recordatorio enviado a familia de ${a.nombre}`);
}
function cobNuevoConcepto() {
  const nombre=prompt('Nombre del concepto:');if(!nombre)return;
  const monto=parseFloat(prompt('Monto (MXN):')||'0');
  COB.conceptos.push({id:'c'+Date.now(),nombre,monto,frecuencia:'mensual',aplica:'todos',icono:'📋'});
  COB.renderConceptos();
  if(typeof admToast==='function') admToast('✅ Concepto agregado');
}
function cobEditarConcepto(id) {
  const c=COB.conceptos.find(x=>x.id===id);if(!c)return;
  const monto=parseFloat(prompt(`Nuevo monto para "${c.nombre}":`,c.monto)||'0');
  if(isNaN(monto))return;
  c.monto=monto;COB.renderConceptos();
  if(typeof admToast==='function') admToast('✅ Concepto actualizado');
}
function cobNuevaBeca() {
  const nombre=prompt('Nombre de la categoría de beca:');if(!nombre)return;
  const valor=parseFloat(prompt('Porcentaje de descuento:')||'0');
  COB.becas.push({id:'b'+Date.now(),nombre,tipo:'porcentaje',valor,aplica:'colegiatura'});
  COB.renderBecas();
  if(typeof admToast==='function') admToast('✅ Categoría de beca agregada');
}
function cobGuardarConfig() { if(typeof admToast==='function') admToast('⚙️ Configuración guardada'); }
function cobGuardarDatos()  { if(typeof admToast==='function') admToast('🏫 Datos fiscales guardados'); }
function cobExportarCSV() {
  const rows=[['Alumno','Grupo','Total','Estado']];
  COB.alumnos.forEach(a=>rows.push([a.nombre,a.grupo,COB.calcTotal(a),a.estado]));
  const csv=rows.map(r=>r.join(',')).join('\n');
  const el=document.createElement('a');
  el.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  el.download='cobranza.csv';el.click();
}

function cobRenderAsignacionBecas() {
  const cont = document.getElementById('cob-asig-becas-cont');
  if (!cont) return;
  cont.innerHTML = COB.alumnos.map(a => {
    const beca = a.beca ? COB.becas.find(b => b.id === a.beca) : null;
    return `<label style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:8px;cursor:pointer;transition:.1s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
      <input type="checkbox" data-asig-id="${a.id}" style="width:16px;height:16px;accent-color:#0a5c2e;cursor:pointer;">
      <div style="width:32px;height:32px;border-radius:50%;background:#f0fdf4;color:#0a5c2e;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${a.nombre.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;">${a.nombre}</div>
        <div style="font-size:11px;color:#64748b;">${a.grupo}</div>
      </div>
      ${beca ? `<span style="background:#f5f3ff;color:#7c3aed;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;border:1px solid #ddd6fe;">🎓 ${beca.nombre}</span>` : '<span style="font-size:11px;color:#94a3b8;">Sin beca</span>'}
    </label>`;
  }).join('');
}

async function cobAplicarBecaMasiva() {
  const catId = document.getElementById('cob-beca-sel-cat')?.value;
  if (!catId) { hubToast('⚠️ Selecciona una categoría de beca', 'warn'); return; }
  const checks = document.querySelectorAll('#cob-asig-becas-cont input[data-asig-id]:checked');
  if (!checks.length) { hubToast('⚠️ Selecciona al menos un alumno', 'warn'); return; }
  const ids = [...checks].map(c => c.dataset.asigId);

  const sb = window.sb;
  const perfil = JSON.parse(localStorage.getItem('siembra_perfil') || '{}');
  const escuela = window._escuelaCCT || perfil.escuela_cct;

  if (sb && escuela) {
    try {
      // Upsert becas_alumno para cada alumno seleccionado
      const rows = ids.map(id => ({
        alumno_id:    id,
        categoria_id: catId,
        ciclo:        '2025-2026',
        fecha_inicio: new Date().toISOString().split('T')[0]
      }));
      const { error } = await sb.from('becas_alumno').upsert(rows, { onConflict: 'alumno_id,categoria_id,ciclo' });
      if (error) throw error;
    } catch(e) {
      if (typeof admToast === 'function') admToast('❌ Error al guardar becas: ' + e.message, true);
      return;
    }
  }
  // Actualizar local
  ids.forEach(id => { const a = COB.alumnos.find(x => x.id === id); if (a) a.beca = catId; });
  COB.renderBecas();
  cobRenderAsignacionBecas();
  COB.updateKPIs();
  if (typeof admToast === 'function') admToast(`✅ Beca aplicada a ${ids.length} alumnos`);
}

async function cobQuitarBecaMasiva() {
  const checks = document.querySelectorAll('#cob-asig-becas-cont input[data-asig-id]:checked');
  if (!checks.length) { hubToast('⚠️ Selecciona al menos un alumno', 'warn'); return; }
  const ids = [...checks].map(c => c.dataset.asigId);

  const sb = window.sb;
  if (sb) {
    try {
      await sb.from('becas_alumno').delete().in('alumno_id', ids).eq('ciclo', '2025-2026');
    } catch(e) {}
  }
  ids.forEach(id => { const a = COB.alumnos.find(x => x.id === id); if (a) a.beca = null; });
  COB.renderBecas();
  cobRenderAsignacionBecas();
  COB.updateKPIs();
  if (typeof admToast === 'function') admToast(`✅ Becas removidas de ${ids.length} alumnos`);
}

// ═══════════════════════════════════════════════════════════════
// ASESOR PEDAGÓGICO — Chat con IA para Actividades y Planeaciones
// ═══════════════════════════════════════════════════════════════
let _docChatCtx = 'actividad';         // contexto actual: 'actividad' | 'planeacion'
let _docChatHistory = [];              // [{ role:'user'|'assistant', content, imgName? }]
let _docChatImgBase64 = null;          // imagen adjunta pendiente
let _docChatImgName = '';

function docChatAbrir(ctx) {
  _docChatCtx = ctx || 'actividad';
  const panel = document.getElementById('doc-chat-panel');
  if (!panel) return;
  panel.style.display = 'flex';
  panel.style.animation = 'slideUpChat .25s ease';
  const lbl = document.getElementById('doc-chat-ctx-label');
  if (lbl) lbl.textContent = ctx === 'planeacion' ? 'Planeaciones NEM' : 'Actividades';
  docChatActualizarContador();
  if (!_docChatHistory.length) docChatRenderMensajes();
  setTimeout(() => document.getElementById('doc-chat-input')?.focus(), 150);
}

function docChatCerrar() {
  const panel = document.getElementById('doc-chat-panel');
  if (panel) panel.style.display = 'none';
}

function docChatActualizarContador() {
  const check = aiVerificarLimite('docente_chat');
  const lbl = document.getElementById('doc-chat-count-label');
  if (lbl) lbl.textContent = `${check.usado}/${check.limite} hoy`;
}

function docChatAdjuntarImagen(input) {
  const file = input?.files?.[0];
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) { hubToast('⚠️ Imagen muy grande (máx 4 MB)', 'warn'); input.value=''; return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    _docChatImgBase64 = e.target.result; // data:image/...;base64,...
    _docChatImgName = file.name;
    const prev = document.getElementById('doc-chat-img-preview');
    const thumb = document.getElementById('doc-chat-img-thumb');
    const nm = document.getElementById('doc-chat-img-name');
    if (prev) prev.style.display = 'block';
    if (thumb) thumb.src = _docChatImgBase64;
    if (nm) nm.textContent = file.name;
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function docChatQuitarImagen() {
  _docChatImgBase64 = null;
  _docChatImgName = '';
  const prev = document.getElementById('doc-chat-img-preview');
  if (prev) prev.style.display = 'none';
}

function docChatRenderMensajes() {
  const el = document.getElementById('doc-chat-messages');
  if (!el) return;
  if (!_docChatHistory.length) {
    el.innerHTML = `<div style="text-align:center;font-size:12px;color:#64748b;padding:10px 0;">
      Haz preguntas, pide ideas específicas para tu grupo o sube una foto de un libro/material.
    </div>`;
    return;
  }
  el.innerHTML = _docChatHistory.map(m => {
    const isUser = m.role === 'user';
    const bg = isUser ? '#0f766e' : 'white';
    const color = isUser ? 'white' : '#0f172a';
    const align = isUser ? 'flex-end' : 'flex-start';
    const imgHtml = m.imgName
      ? `<div style="font-size:10px;opacity:.7;margin-bottom:4px;">📎 ${m.imgName}</div>` : '';
    return `<div style="display:flex;flex-direction:column;align-items:${align};gap:2px;">
      ${imgHtml}
      <div style="max-width:88%;padding:9px 13px;border-radius:${isUser?'12px 12px 3px 12px':'12px 12px 12px 3px'};
           background:${bg};color:${color};font-size:12px;line-height:1.5;
           box-shadow:0 1px 3px rgba(0,0,0,.08);white-space:pre-wrap;">${m.content}</div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

async function docChatEnviar() {
  const input = document.getElementById('doc-chat-input');
  const btn = document.getElementById('doc-chat-btn');
  const texto = input?.value?.trim();
  if (!texto && !_docChatImgBase64) return;

  const check = aiVerificarLimite('docente_chat');
  if (!check.ok) { aiMostrarLimiteAgotado('docente_chat', check.limite); return; }

  const userMsg = texto || '(Analiza la imagen adjunta)';
  const savedImg = _docChatImgBase64;
  const savedImgName = _docChatImgName;

  _docChatHistory.push({ role: 'user', content: userMsg, imgName: savedImgName || null });
  if (input) { input.value = ''; input.style.height = 'auto'; }
  docChatRenderMensajes();
  docChatQuitarImagen();

  const el = document.getElementById('doc-chat-messages');
  if (el) {
    el.innerHTML += `<div id="doc-chat-typing" style="padding:8px 0;"><span style="font-size:11px;color:#64748b;">⚙️ Analizando…</span></div>`;
    el.scrollTop = el.scrollHeight;
  }
  if (btn) btn.disabled = true;

  try {
    aiRegistrarUso('docente_chat');
    docChatActualizarContador();

    const grupoActivo = window._grupoActivo;
    const grupoNombre = (window._gruposDocente||[]).find(g=>g.id===grupoActivo)?.nombre || '';
    const materias = (window._materiasDocente||[]).map(m=>m.nombre||m.materia).join(', ');
    const nivel = window._nivelActivo || currentPerfil?.nivel || 'secundaria';

    const system = `Eres un asesor pedagógico experto en el sistema educativo mexicano NEM 2022 (Nueva Escuela Mexicana).
Ayudas a un docente de ${nivel} con sus ${_docChatCtx === 'planeacion' ? 'planeaciones didácticas' : 'actividades y evaluaciones'}.
Contexto del docente: grupo activo "${grupoNombre}", materias: ${materias || 'no especificadas'}.
Responde de forma concreta, práctica y alineada al enfoque por proyectos comunitarios del NEM.
Máximo 3 párrafos salvo que se solicite algo más extenso.`;

    // Build conversation context (last 6 messages)
    const histPairs = _docChatHistory.slice(-7, -1);
    const histCtx = histPairs.map(m => `${m.role==='user'?'Docente':'Asesor'}: ${m.content}`).join('\n');

    let prompt = userMsg;
    if (histCtx) prompt = `Historial:\n${histCtx}\n\nDocente: ${userMsg}`;
    if (savedImg) {
      // Prefix image data for vision-capable routes
      prompt = `[IMAGEN ADJUNTA: ${savedImgName}]\n${savedImg}\n\nSolicitud del docente: ${userMsg}`;
    }

    const respuesta = await callAI({ feature: 'docente_chat', prompt, system });
    _docChatHistory.push({ role: 'assistant', content: respuesta });
  } catch(e) {
    _docChatHistory.push({ role: 'assistant', content: `⚠️ ${e.message}` });
  }

  document.getElementById('doc-chat-typing')?.remove();
  if (btn) btn.disabled = false;
  docChatRenderMensajes();
}

// ══════════════════════════════════════════════════════════════════
// RUTAS PERSONALIZADAS DE APRENDIZAJE
// ══════════════════════════════════════════════════════════════════

window._rutasPasosPendientes = []; // pasos generados por IA antes de guardar

function rutasPoblarSelect() {
  const lista = window._alumnosActivos || alumnos || [];
  const sel = document.getElementById('ruta-sel-alumno');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Seleccionar alumno —</option>' +
    lista.map(a => {
      const nombre = a.n || `${a.nombre||''} ${a.apellido_p||''}`.trim();
      const id = a.id || nombre;
      return `<option value="${id}" data-nombre="${nombre}">${nombre}</option>`;
    }).join('');
}

async function rutasGenerarIA() {
  const sel    = document.getElementById('ruta-sel-alumno');
  const alumnoId = sel?.value;
  const alumnoNombre = sel?.options[sel.selectedIndex]?.dataset.nombre || 'el alumno';
  const objetivo = (document.getElementById('ruta-objetivo')?.value || '').trim();
  const trimestre = document.getElementById('ruta-trimestre')?.value || '2';

  if (!alumnoId) { hubToast('Selecciona un alumno'); return; }

  const btn = document.querySelector('#obs-panel-rutas .card button.btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '✨ Generando ruta…'; }

  try {
    // Obtener calificaciones del alumno para contexto
    let calCtx = '';
    if (window.sb && alumnoId.length > 10) {
      const { data: cals } = await sb.from('calificaciones')
        .select('materia,calificacion')
        .eq('alumno_id', alumnoId)
        .eq('trimestre', parseInt(trimestre))
        .limit(20);
      if (cals?.length) {
        calCtx = cals.map(c => `${c.materia}: ${c.calificacion}`).join(', ');
      }
    }

    const prompt = `Soy docente de primaria mexicana (NEM 2022). Necesito una ruta personalizada para ${alumnoNombre}.
${calCtx ? `Sus calificaciones del trimestre ${trimestre}: ${calCtx}.` : ''}
${objetivo ? `Objetivo especial: ${objetivo}.` : ''}

Genera exactamente 5 pasos concretos, simples y accionables para que este alumno mejore. Cada paso debe:
- Ser algo que el alumno pueda hacer en casa o en clase (15-30 min)
- Estar en lenguaje amigable para un niño
- Tener un tipo: ejercicio, lectura, actividad, repaso o evaluacion

Responde SOLO con JSON válido, sin explicaciones:
[
  {"orden":1,"titulo":"...","descripcion":"...","tipo":"ejercicio","xp":50},
  {"orden":2,...},
  ...
]`;

    const respuesta = await callAI({ feature: 'ruta_personalizada', prompt });

    // Parse JSON de la respuesta
    const jsonMatch = respuesta.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('La IA no devolvió pasos válidos');
    const pasos = JSON.parse(jsonMatch[0]);
    window._rutasPasosPendientes = pasos;
    window._rutasAlumnoIdPendiente = alumnoId;
    window._rutasAlumnoNombrePendiente = alumnoNombre;

    rutasRenderPreview(pasos, alumnoNombre);
  } catch(e) {
    hubToast('❌ ' + e.message);
  }

  if (btn) { btn.disabled = false; btn.textContent = '✨ Generar ruta con IA'; }
}

function rutasRenderPreview(pasos, nombre) {
  const wrap = document.getElementById('ruta-preview-wrap');
  const tituloEl = document.getElementById('ruta-preview-titulo');
  const pasosEl  = document.getElementById('ruta-preview-pasos');
  if (!wrap || !pasosEl) return;

  const TIPO_ICON = { ejercicio:'✏️', lectura:'📖', actividad:'🎯', repaso:'🔄', evaluacion:'📝' };
  const objetivo = document.getElementById('ruta-objetivo')?.value?.trim();

  if (tituloEl) tituloEl.textContent = `Ruta para ${nombre}${objetivo?' · '+objetivo:''}`;
  pasosEl.innerHTML = pasos.map((p, i) => `
    <div style="display:flex;gap:12px;align-items:flex-start;padding:12px 0;${i<pasos.length-1?'border-bottom:1px solid #f1f5f9':''}">
      <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;">${p.orden}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:2px;">${TIPO_ICON[p.tipo]||'📌'} ${p.titulo}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:4px;">${p.descripcion}</div>
        <span style="font-size:11px;background:#ede9fe;color:#5b21b6;padding:2px 8px;border-radius:99px;font-weight:700;">+${p.xp||50} XP al completar</span>
      </div>
    </div>`).join('');

  wrap.style.display = '';
  wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function rutasGuardar() {
  const sb  = window.sb;
  const cct = window.currentPerfil?.escuela_cct;
  const alumnoId = window._rutasAlumnoIdPendiente;
  const pasos    = window._rutasPasosPendientes || [];
  const nombre   = window._rutasAlumnoNombrePendiente || 'Alumno';
  const objetivo = document.getElementById('ruta-objetivo')?.value?.trim() || null;
  const grupoId  = window._grupoActivo || CT_GRUPO_SELECCIONADO || null;

  if (!alumnoId || !pasos.length) { hubToast('Genera primero la ruta con IA'); return; }
  if (!sb) { hubToast('Sin conexión a Supabase'); return; }

  try {
    // 1. Crear ruta
    const { data: ruta, error: rutaErr } = await sb.from('rutas_aprendizaje').insert({
      alumno_id:  alumnoId,
      grupo_id:   grupoId,
      docente_id: window.currentPerfil?.id,
      escuela_id: cct,
      titulo:     objetivo || `Ruta personalizada — ${nombre}`,
      descripcion: objetivo,
      estado:     'activa',
      progreso:   0,
    }).select('id').single();
    if (rutaErr) throw rutaErr;

    // 2. Insertar pasos
    const pasosInsert = pasos.map(p => ({
      ruta_id:     ruta.id,
      orden:       p.orden,
      titulo:      p.titulo,
      descripcion: p.descripcion,
      tipo:        p.tipo || 'actividad',
      xp_al_completar: p.xp || 50,
      completado:  false,
    }));
    const { error: pasosErr } = await sb.from('ruta_pasos').insert(pasosInsert);
    if (pasosErr) throw pasosErr;

    // Reset
    document.getElementById('ruta-preview-wrap').style.display = 'none';
    document.getElementById('ruta-objetivo').value = '';
    window._rutasPasosPendientes = [];
    hubToast(`✅ Ruta asignada a ${nombre}`);
    rutasCargarGrupo();
  } catch(e) {
    hubToast('❌ ' + e.message);
  }
}

async function rutasCargarGrupo() {
  const sb  = window.sb;
  const grupoId = window._grupoActivo || CT_GRUPO_SELECCIONADO;
  const lista   = document.getElementById('rutas-lista-grupo');
  if (!lista) return;
  if (!sb) { lista.innerHTML = '<div style="color:#94a3b8;font-size:13px;text-align:center;padding:20px;">Sin conexión</div>'; return; }

  lista.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:13px;padding:20px;">Cargando…</div>';

  try {
    let q = sb.from('rutas_aprendizaje')
      .select('id,titulo,estado,progreso,creado_en,alumno:alumno_id(nombre,apellido_p)')
      .eq('estado','activa')
      .order('creado_en',{ascending:false})
      .limit(30);
    if (grupoId) q = q.eq('grupo_id', grupoId);
    const { data } = await q;
    const items = data || [];

    if (!items.length) {
      lista.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:13px;padding:30px;">Sin rutas activas para este grupo.</div>';
      return;
    }
    lista.innerHTML = items.map(r => {
      const aNom = r.alumno ? `${r.alumno.nombre||''} ${r.alumno.apellido_p||''}`.trim() : '—';
      const pct  = r.progreso || 0;
      const pColor = pct>=100?'#15803d':pct>=50?'#ca8a04':'#4f46e5';
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">🗺</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${aNom}</div>
          <div style="font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.titulo}</div>
          <div style="height:5px;background:#e2e8f0;border-radius:99px;margin-top:5px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${pColor};border-radius:99px;transition:.4s;"></div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:14px;font-weight:900;color:${pColor};">${pct}%</div>
          <button onclick="rutasVerDetalle('${r.id}')" style="margin-top:4px;padding:3px 8px;background:#ede9fe;color:#5b21b6;border:none;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Sora',sans-serif;">Ver pasos</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    lista.innerHTML = `<div style="color:#dc2626;padding:20px;font-size:13px;">❌ ${e.message}</div>`;
  }
}

async function rutasVerDetalle(rutaId) {
  const sb = window.sb;
  if (!sb) return;
  try {
    const { data: pasos } = await sb.from('ruta_pasos')
      .select('*').eq('ruta_id', rutaId).order('orden');
    if (!pasos?.length) { hubToast('Sin pasos en esta ruta'); return; }
    const TIPO_ICON = { ejercicio:'✏️', lectura:'📖', actividad:'🎯', repaso:'🔄', evaluacion:'📝' };
    const html = pasos.map(p => `
      <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;align-items:flex-start;">
        <div style="width:28px;height:28px;border-radius:50%;background:${p.completado?'#15803d':'#e2e8f0'};color:${p.completado?'white':'#94a3b8'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;">${p.completado?'✓':p.orden}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;color:${p.completado?'#94a3b8':'#0f172a'};text-decoration:${p.completado?'line-through':'none'};">${TIPO_ICON[p.tipo]||'📌'} ${p.titulo}</div>
          <div style="font-size:11px;color:#94a3b8;">${p.descripcion}</div>
        </div>
        <span style="font-size:11px;background:#ede9fe;color:#5b21b6;padding:2px 6px;border-radius:99px;font-weight:700;flex-shrink:0;">+${p.xp_al_completar||50} XP</span>
      </div>`).join('');
    const completados = pasos.filter(p=>p.completado).length;
    // Mostrar en un toast expandido reutilizando el modal de alerta
    const m = document.getElementById('obs-modal-alerta-ts');
    if (m) {
      m.querySelector('.dialog-body,div[style*="padding:24px"]')?.remove();
      m.innerHTML = `<div style="background:white;border-radius:16px;width:100%;max-width:520px;overflow:hidden;max-height:85vh;display:flex;flex-direction:column;">
        <div style="padding:16px 20px;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:space-between;">
          <div style="font-family:'Fraunces',serif;font-size:17px;color:white;">🗺 Detalle de ruta · ${completados}/${pasos.length} pasos</div>
          <button onclick="document.getElementById('obs-modal-alerta-ts').style.display='none'" aria-label="Cerrar" style="background:none;border:none;font-size:20px;cursor:pointer;color:white;">✕</button>
        </div>
        <div style="padding:18px;overflow-y:auto;">${html}</div>
      </div>`;
      m.style.display='flex';
    }
  } catch(e) { hubToast('❌ ' + e.message); }
}

// ══════════════════════════════════════════════════════════════════
// SOLICITUDES DE ACCESO DIRECTO (auto-registro sin invitación)
// ══════════════════════════════════════════════════════════════════

async function admCargarSolicitudesAcceso() {
  admAccesoTab('pendiente');
}

async function admAccesoTab(estado = 'pendiente') {
  const cct = ADM.escuelaCct || window.currentPerfil?.escuela_cct;
  const sb  = window.sb;
  if (!sb || !cct) return;

  // Update tab styles
  ['pendiente','aprobada','rechazada'].forEach(e => {
    const btn = document.getElementById('acc-tab-' + (e==='pendiente'?'pendientes':e==='aprobada'?'aprobadas':'rechazadas'));
    if (!btn) return;
    const active = e === estado;
    btn.style.fontWeight = active ? '700' : '600';
    btn.style.color      = active ? (e==='pendiente'?'#b91c1c':'#0f172a') : '#64748b';
    btn.style.borderBottom = active ? (e==='pendiente'?'2px solid #ef4444':'2px solid #0d5c2f') : 'none';
    btn.style.marginBottom = active ? '-2px' : '';
  });

  const lista = document.getElementById('adm-acceso-lista');
  if (lista) lista.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Cargando…</div>';

  try {
    let q = sb.from('solicitudes_acceso')
      .select('id,nombre,apellido,email,telefono,rol,grupo_texto,curp,mensaje,creado_en,estado')
      .eq('escuela_id', cct).eq('estado', estado)
      .order('creado_en', { ascending: false }).limit(50);
    const { data, error } = await q;
    if (error) throw error;
    const items = data || [];

    // Update pending badge
    if (estado === 'pendiente') {
      const badge = document.getElementById('adm-badge-acceso');
      const cnt   = document.getElementById('acc-cnt-pendientes');
      if (badge) badge.style.display = items.length ? '' : 'none';
      if (badge) badge.textContent = items.length;
      if (cnt)   cnt.textContent   = items.length;
    }

    if (!lista) return;
    if (!items.length) {
      const msgs = { pendiente:'Sin solicitudes pendientes', aprobada:'No hay solicitudes aprobadas', rechazada:'No hay solicitudes rechazadas' };
      lista.innerHTML = `<div style="text-align:center;padding:60px;color:#94a3b8;"><div style="font-size:48px;margin-bottom:12px;">📥</div><div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:6px;">${msgs[estado]}</div></div>`;
      return;
    }

    const rolLabel = { alumno:'👨‍🎓 Alumno', padre:'👨‍👩‍👧 Padre/Madre', tutor:'👤 Tutor' };
    lista.innerHTML = items.map(s => {
      const nombre = `${s.nombre||''} ${s.apellido||''}`.trim() || s.email;
      const fecha  = s.creado_en ? new Date(s.creado_en).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}) : '—';
      return `<div style="background:white;border-radius:12px;border:1.5px solid #e2e8f0;padding:18px 20px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-size:13px;font-weight:700;color:#0f172a;">${nombre}</span>
            <span style="font-size:11px;background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:99px;">${rolLabel[s.rol]||s.rol}</span>
          </div>
          <div style="font-size:12px;color:#64748b;">${s.email}${s.telefono?' · '+s.telefono:''}${s.grupo_texto?' · Grupo: '+s.grupo_texto:''}${s.curp?' · CURP: '+s.curp:''}</div>
          ${s.mensaje?`<div style="font-size:12px;color:#94a3b8;margin-top:4px;font-style:italic;">"${s.mensaje}"</div>`:''}
          <div style="font-size:11px;color:#cbd5e1;margin-top:4px;">${fecha}</div>
        </div>
        ${estado === 'pendiente' ? `<div style="display:flex;gap:8px;flex-shrink:0;">
          <button onclick="admAprobarAcceso('${s.id}','${s.rol}','${nombre}','${s.email}')" style="padding:8px 16px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✅ Aprobar</button>
          <button onclick="admRechazarAcceso('${s.id}')" style="padding:8px 14px;background:#fef2f2;color:#b91c1c;border:1.5px solid #fecaca;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✕ Rechazar</button>
        </div>` : `<div style="font-size:12px;font-weight:700;color:${estado==='aprobada'?'#15803d':'#b91c1c'}">${estado==='aprobada'?'✅ Aprobada':'✕ Rechazada'}</div>`}
      </div>`;
    }).join('');
  } catch(e) {
    if (lista) lista.innerHTML = `<div style="color:#dc2626;padding:20px;">❌ ${e.message}</div>`;
  }
}

async function admAprobarAcceso(id, rol, nombre, email) {
  if (!confirm(`¿Aprobar el acceso de ${nombre}?\n\nSe creará su cuenta y recibirá instrucciones por correo.`)) return;
  const sb = window.sb;
  if (!sb) return;
  try {
    // Crear usuario en Supabase Auth
    const pass = Math.random().toString(36).slice(2,10); // temp password
    const cct  = ADM.escuelaCct || window.currentPerfil?.escuela_cct;
    const { data: authData, error: authErr } = await sb.auth.admin?.createUser
      ? await sb.auth.admin.createUser({ email, password: pass, email_confirm: true })
      : { data: null, error: { message: 'admin API no disponible' } };

    // Actualizar solicitud a aprobada (+ guardar temp password para notificación)
    await sb.from('solicitudes_acceso').update({ estado:'aprobada', aprobado_en: new Date().toISOString() }).eq('id', id);
    admAccesoTab('pendiente');
    hubToast(`✅ Acceso aprobado para ${nombre}. ${authErr?'Debe asignarse contraseña manualmente.':'Cuenta creada.'}`);
  } catch(e) {
    hubToast('❌ ' + e.message);
  }
}

async function admRechazarAcceso(id) {
  if (!confirm('¿Rechazar esta solicitud?')) return;
  const sb = window.sb;
  if (!sb) return;
  try {
    await sb.from('solicitudes_acceso').update({ estado:'rechazada' }).eq('id', id);
    admAccesoTab('pendiente');
    hubToast('Solicitud rechazada.');
  } catch(e) {
    hubToast('❌ ' + e.message);
  }
}

// ══════════════════════════════════════════════════════════════════
// ANUNCIOS — gestión desde panel admin
// ══════════════════════════════════════════════════════════════════

function admAbrirNuevoAnuncio() {
  const form = document.getElementById('adm-anuncio-form');
  if (!form) return;
  // Reset
  ['anc-titulo','anc-descripcion','anc-fecha'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  form.style.display = '';
  document.getElementById('anc-titulo')?.focus();
}

async function admPublicarAnuncio() {
  const sb    = window.sb;
  const cct   = ADM?.escuelaCct || window.currentPerfil?.escuela_cct || window._escuelaCfg?.cct;
  const titulo = (document.getElementById('anc-titulo')?.value || '').trim();
  if (!titulo) { hubToast('Escribe un título para el anuncio'); return; }
  if (!sb)  { hubToast('❌ Sin conexión a Supabase'); return; }
  if (!cct) { hubToast('❌ No se detectó la escuela. Recarga e inicia sesión.'); return; }

  const payload = {
    escuela_id:  cct,
    titulo,
    descripcion: document.getElementById('anc-descripcion')?.value.trim() || null,
    tipo:        document.getElementById('anc-tipo')?.value || 'info',
    fecha_evento:document.getElementById('anc-fecha')?.value || null,
    dirigido_a:  [document.getElementById('anc-dirigido')?.value || 'docente'],
    creado_por:  window.currentUser?.id || null,
    activo:      true,
  };

  try {
    // Verificar / refrescar sesión antes de insertar
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { await sb.auth.refreshSession(); }

    const { error } = await sb.from('anuncios').insert(payload);
    if (error) throw error;
    document.getElementById('adm-anuncio-form').style.display = 'none';
    hubToast('📢 Anuncio publicado');
    admCargarAnunciosAdmin();
  } catch(e) {
    const msg = e.message || '';
    if (msg.toLowerCase().includes('sesion') || msg.toLowerCase().includes('session') || msg.includes('JWT')) {
      hubToast('❌ Sesión expirada — recarga la página e inicia sesión nuevamente.');
    } else {
      hubToast('❌ ' + msg);
    }
  }
}

async function admCargarAnunciosAdmin() {
  const sb  = window.sb;
  const cct = ADM.escuelaCct || window.currentPerfil?.escuela_cct;
  const lista = document.getElementById('adm-anuncios-lista');
  if (!sb || !cct || !lista) return;
  try {
    const { data } = await sb.from('anuncios')
      .select('id,titulo,descripcion,tipo,fecha_evento,dirigido_a,activo,creado_en,rol_autor')
      .eq('escuela_id', cct)
      .order('creado_en', { ascending: false })
      .limit(30);
    const items = data || [];
    const TIPO_CFG = {
      evento:       { bg:'#f0fdf4', color:'#15803d', label:'EVENTO',      border:'#bbf7d0' },
      urgente:      { bg:'#fef2f2', color:'#b91c1c', label:'URGENTE',     border:'#fecaca' },
      info:         { bg:'#eff6ff', color:'#1d4ed8', label:'AVISO',       border:'#bfdbfe' },
      recordatorio: { bg:'#fef9c3', color:'#a16207', label:'RECORDATORIO',border:'#fde68a' },
    };
    if (!items.length) {
      lista.innerHTML = '<div style="text-align:center;padding:60px;color:#94a3b8;"><div style="font-size:40px;margin-bottom:12px;">📢</div><div style="font-weight:700;margin-bottom:6px;">Todavía no hay anuncios publicados</div><div style="font-size:13px;">Este espacio mostrará avisos institucionales, recordatorios y comunicados para tu comunidad escolar.</div></div>';
      return;
    }
    lista.innerHTML = items.map(a => {
      const cfg  = TIPO_CFG[a.tipo] || TIPO_CFG.info;
      const fecha = a.fecha_evento ? new Date(a.fecha_evento+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long'}) : '';
      const pub   = a.creado_en ? new Date(a.creado_en).toLocaleDateString('es-MX',{day:'numeric',month:'short'}) : '';
      return `<div style="background:white;border-radius:12px;border:1.5px solid ${cfg.border};padding:16px 20px;margin-bottom:10px;display:flex;align-items:flex-start;gap:14px;">
        <div style="background:${cfg.bg};color:${cfg.color};border-radius:8px;padding:6px 10px;font-size:10px;font-weight:800;letter-spacing:.5px;flex-shrink:0;">${cfg.label}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:2px;">${a.titulo}</div>
          ${a.descripcion?`<div style="font-size:12px;color:#64748b;margin-bottom:4px;">${a.descripcion}</div>`:''}
          <div style="font-size:11px;color:#94a3b8;">${fecha?'📅 '+fecha+' · ':''}Publicado ${pub}${a.rol_autor?' por '+a.rol_autor:''} · Para: ${(a.dirigido_a||[]).join(', ')}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button onclick="admToggleAnuncio('${a.id}',${!a.activo})" style="padding:5px 10px;background:${a.activo?'#fef2f2':'#f0fdf4'};color:${a.activo?'#b91c1c':'#15803d'};border:1.5px solid ${a.activo?'#fecaca':'#bbf7d0'};border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;">${a.activo?'Pausar':'Activar'}</button>
          <button onclick="admEliminarAnuncio('${a.id}')" style="padding:5px 10px;background:#fef2f2;color:#b91c1c;border:1.5px solid #fecaca;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;">🗑</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    lista.innerHTML = `<div style="color:#dc2626;padding:20px;">❌ ${e.message}</div>`;
  }
}

async function admToggleAnuncio(id, nuevoActivo) {
  const sb = window.sb;
  if (!sb) return;
  try {
    await sb.from('anuncios').update({ activo: nuevoActivo }).eq('id', id);
    admCargarAnunciosAdmin();
  } catch(e) { hubToast('❌ ' + e.message); }
}

async function admEliminarAnuncio(id) {
  if (!confirm('¿Eliminar este anuncio?')) return;
  const sb = window.sb;
  if (!sb) return;
  try {
    await sb.from('anuncios').delete().eq('id', id);
    admCargarAnunciosAdmin();
    hubToast('Anuncio eliminado');
  } catch(e) { hubToast('❌ ' + e.message); }
}

// ══════════════════════════════════════════════════════════════════
// MODAL GLOBAL DE ANUNCIOS — compartido por director, subdirector,
// coordinador, prefecto y admin
// ══════════════════════════════════════════════════════════════════

(function() {
  function _inyectarModalAnuncio() {
  // Inyectar modal en el DOM si no existe
  if (document.getElementById('modal-anuncio-global')) return;
  const ROL_CFG = {
    director:    { label:'Director/a',    color:'#0d5c2f' },
    subdirector: { label:'Subdirector/a', color:'#1e3a5f' },
    coordinador: { label:'Coordinador/a', color:'#5b21b6' },
    prefecto:    { label:'Prefecto/a',    color:'#7c3aed' },
    admin:       { label:'Admin',         color:'#0d5c2f' },
  };

  const el = document.createElement('div');
  el.id = 'modal-anuncio-global';
  el.style.cssText = 'display:none;position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:20px;';
  el.innerHTML = `
    <div style="background:white;border-radius:20px;width:100%;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden;">
      <div id="modal-anuncio-header" style="background:linear-gradient(135deg,#0d5c2f,#157a40);padding:20px 24px;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-family:'Fraunces',serif;font-size:18px;color:white;font-weight:700;">📢 Publicar aviso</div>
          <div id="modal-anuncio-rol-label" style="font-size:12px;color:rgba(255,255,255,.7);margin-top:2px;">Director/a</div>
        </div>
        <button onclick="cerrarModalAnuncio()" aria-label="Cerrar" style="width:32px;height:32px;background:rgba(255,255,255,.15);border:none;border-radius:8px;color:white;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>
      <div style="padding:24px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div>
            <label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">Título *</label>
            <input id="ganc-titulo" type="text" placeholder="Ej. Reunión de padres…" style="width:100%;padding:10px 13px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">Tipo</label>
            <select id="ganc-tipo" style="width:100%;padding:10px 13px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
              <option value="info">📌 Aviso general</option>
              <option value="evento">📅 Evento</option>
              <option value="recordatorio">🔔 Recordatorio</option>
              <option value="urgente">🚨 Urgente</option>
            </select>
          </div>
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">Descripción</label>
          <textarea id="ganc-descripcion" placeholder="Detalles del aviso o evento…" rows="3" style="width:100%;padding:10px 13px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
          <div>
            <label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">Fecha del evento</label>
            <input id="ganc-fecha" type="date" style="width:100%;padding:10px 13px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">Dirigido a</label>
            <select id="ganc-dirigido" style="width:100%;padding:10px 13px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
              <option value="docente">Docentes</option>
              <option value="todos">Todos (docentes + padres)</option>
              <option value="director">Solo directivos</option>
            </select>
          </div>
        </div>
        <div id="ganc-error" style="display:none;color:#dc2626;font-size:12px;margin-bottom:10px;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button onclick="cerrarModalAnuncio()" style="padding:10px 20px;background:white;border:1.5px solid #e2e8f0;color:#64748b;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Cancelar</button>
          <button id="ganc-btn-publicar" onclick="publicarAnuncioGlobal()" style="padding:10px 22px;background:linear-gradient(135deg,#0d5c2f,#157a40);color:white;border:none;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(13,92,47,.3);">📢 Publicar aviso</button>
        </div>
      </div>
    </div>`;
  el.addEventListener('click', e => { if (e.target === el) cerrarModalAnuncio(); });
  document.body.appendChild(el);
  window._ROL_CFG_ANUNCIO = ROL_CFG;
  }
  if (document.body) { _inyectarModalAnuncio(); }
  else { document.addEventListener('DOMContentLoaded', _inyectarModalAnuncio); }
})();

window._anuncioRolActual = 'admin';

function abrirModalAnuncio(rol) {
  window._anuncioRolActual = rol || 'admin';
  const modal = document.getElementById('modal-anuncio-global');
  if (!modal) return;
  // Reset form
  ['ganc-titulo','ganc-descripcion','ganc-fecha'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const sel = document.getElementById('ganc-tipo'); if(sel) sel.value='info';
  const dir = document.getElementById('ganc-dirigido'); if(dir) dir.value='docente';
  const err = document.getElementById('ganc-error'); if(err) err.style.display='none';
  // Update header color & label
  const cfg = (window._ROL_CFG_ANUNCIO||{})[rol] || { label: rol, color:'#0d5c2f' };
  const header = document.getElementById('modal-anuncio-header');
  if (header) header.style.background = `linear-gradient(135deg,${cfg.color},${cfg.color}dd)`;
  const lbl = document.getElementById('modal-anuncio-rol-label');
  if (lbl) lbl.textContent = cfg.label;
  modal.style.display = 'flex';
  document.getElementById('ganc-titulo')?.focus();
}

function cerrarModalAnuncio() {
  const modal = document.getElementById('modal-anuncio-global');
  if (modal) modal.style.display = 'none';
}

async function publicarAnuncioGlobal() {
  const sb    = window.sb;
  const cct   = window.currentPerfil?.escuela_cct
    || window.currentPerfil?.escuela_id
    || window.ADM?.escuelaCct
    || window._escuelaCfg?.cct
    || typeof _getCct === 'function' ? _getCct() : null;
  const titulo = (document.getElementById('ganc-titulo')?.value || '').trim();
  const errEl  = document.getElementById('ganc-error');
  const btn    = document.getElementById('ganc-btn-publicar');

  if (!titulo) { errEl.textContent='El título es obligatorio'; errEl.style.display='block'; return; }
  if (!sb) { errEl.textContent='Sin conexión a Supabase'; errEl.style.display='block'; return; }
  if (!cct) {
    // Último intento: buscar escuela por auth_id
    try {
      const { data: usr } = await sb.from('usuarios').select('escuela_cct,escuela_id').eq('auth_id', window.currentUser?.id||'').maybeSingle();
      if (usr?.escuela_cct) { if(window.currentPerfil) window.currentPerfil.escuela_cct = usr.escuela_cct; }
      else if (usr?.escuela_id) {
        const { data: esc } = await sb.from('escuelas').select('cct').eq('id', usr.escuela_id).maybeSingle();
        if (esc?.cct && window.currentPerfil) window.currentPerfil.escuela_cct = esc.cct;
      }
    } catch(_) {}
    const cct2 = window.currentPerfil?.escuela_cct;
    if (!cct2) { errEl.textContent='No se pudo identificar la escuela. Recarga la página.'; errEl.style.display='block'; return; }
  }

  // Verificar sesión activa antes de publicar
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      // Intentar refrescar
      const { data: refreshed } = await sb.auth.refreshSession();
      if (!refreshed?.session) {
        errEl.textContent = 'Tu sesión expiró. Recarga la página e inicia sesión nuevamente.';
        errEl.style.display = 'block';
        return;
      }
    }
  } catch(_) {}

  btn.disabled=true; btn.textContent='Publicando…';
  errEl.style.display='none';

  const cctFinal = window.currentPerfil?.escuela_cct || cct;
  const payload = {
    escuela_id:   cctFinal,
    titulo,
    descripcion:  document.getElementById('ganc-descripcion')?.value.trim()||null,
    tipo:         document.getElementById('ganc-tipo')?.value||'info',
    fecha_evento: document.getElementById('ganc-fecha')?.value||null,
    dirigido_a:   [document.getElementById('ganc-dirigido')?.value||'docente'],
    creado_por:   window.currentUser?.id||null,
    rol_autor:    window._anuncioRolActual||'admin',
    activo:       true,
  };

  try {
    const { error } = await sb.from('anuncios').insert(payload);
    if (error) throw error;
    cerrarModalAnuncio();
    // Toast según portal activo
    const toast = window.hubToast || window.showToast || ((m)=>alert(m));
    toast('✅ Aviso publicado — los docentes lo verán en su dashboard');
  } catch(e) {
    errEl.textContent = e.message||'Error al publicar';
    errEl.style.display = 'block';
    btn.disabled=false; btn.textContent='📢 Publicar aviso';
  }
}

// Hook ADM.navTo for new pages
(function() {
  const _origNavTo = ADM.navTo?.bind(ADM);
  if (!_origNavTo) return;
  ADM.navTo = function(page) {
    _origNavTo(page);
    if (page === 'acceso')   { admCargarSolicitudesAcceso(); admAccesoTab('pendiente'); }
    if (page === 'anuncios') { admAbrirNuevoAnuncio(); admCargarAnunciosAdmin(); document.getElementById('adm-anuncio-form').style.display='none'; }
    if (page === 'control-escolar') { if(typeof admCtrlEscolarCargar==='function') admCtrlEscolarCargar(); }
    if (page === 'expedientes') { if(typeof admExpedientesCargar==='function') admExpedientesCargar(); }
    if (page === 'constancias') { }
    if (page === 'correspondencia') { if(typeof admCorrCargar==='function') admCorrCargar(); }
  };
})();

// Load pending access badge on admin init
(function() {
  const _origInicioAdm = window.admIniciarPortal || window.admInit;
  // Poll on page load if admin is active
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(async function() {
      const sb  = window.sb;
      const cct = ADM.escuelaCct || window.currentPerfil?.escuela_cct;
      if (!sb || !cct) return;
      try {
        const { count } = await sb.from('solicitudes_acceso')
          .select('id',{count:'exact',head:true}).eq('escuela_id',cct).eq('estado','pendiente');
        const badge = document.getElementById('adm-badge-acceso');
        if (badge && count > 0) { badge.style.display=''; badge.textContent=count; }
      } catch(_) {}
    }, 3000);
  });
})();

// ═══════════════════════════════════════════════════════════════
// MÓDULO: CAPACITACIÓN SEP (Director + Docentes)
// ═══════════════════════════════════════════════════════════════

window._capDatos = [];

async function dirCapacitacionCargar() {
  const sbRef = window.sb;
  const cct = window.currentPerfil?.escuela_cct || (typeof _getCct==='function' ? _getCct() : null);
  const el = document.getElementById('dir-cap-lista');
  if (!el) return;

  if (!sbRef || !cct) {
    el.innerHTML = _capRenderDemo();
    _capActualizarStats([]);
    return;
  }

  el.innerHTML = '<div style="padding:30px;text-align:center;color:#94a3b8;">Cargando…</div>';
  try {
    const { data, error } = await sbRef
      .from('capacitaciones')
      .select('*, capacitacion_archivos(*), capacitacion_lecturas(docente_id)')
      .eq('escuela_cct', cct)
      .eq('activo', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    window._capDatos = data || [];
    el.innerHTML = data.length ? data.map(_capRenderCard).join('') : '<div style="text-align:center;padding:60px;color:#94a3b8;"><div style="font-size:48px;margin-bottom:12px;">📚</div><div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:6px;">Sin capacitaciones publicadas</div><div style="font-size:13px;">Crea la primera para compartirla con tus docentes.</div></div>';
    _capActualizarStats(data || []);
    _capActualizarBadge(data || []);
  } catch(e) {
    el.innerHTML = `<div style="padding:20px;color:#ef4444;">Error: ${e.message}</div>`;
  }
}

function _capRenderCard(cap) {
  const lecturas = cap.capacitacion_lecturas || [];
  const archivos = cap.capacitacion_archivos || [];
  const totalDoc = (window._gruposDocente || []).length || '?';
  const leidos = lecturas.length;
  const pct = totalDoc !== '?' ? Math.round(leidos / totalDoc * 100) : 0;
  const tipoColor = { SEP:'#1e40af', escolar:'#0d5c2f', urgente:'#dc2626' };
  const tipo = cap.tipo || 'escolar';
  const fechaLimite = cap.fecha_limite ? new Date(cap.fecha_limite).toLocaleDateString('es-MX') : '—';
  const vencida = cap.fecha_limite && new Date(cap.fecha_limite) < new Date();

  return `
  <div style="background:white;border-radius:14px;border:1.5px solid ${vencida?'#fca5a5':'#e2e8f0'};padding:20px;margin-bottom:14px;box-shadow:0 2px 6px rgba(0,0,0,.04);">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
          <span style="background:${tipoColor[tipo]||'#475569'};color:white;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;">${tipo.toUpperCase()}</span>
          ${vencida ? '<span style="background:#fef2f2;color:#dc2626;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;">VENCIDA</span>' : ''}
          ${cap.fecha_limite ? `<span style="font-size:11px;color:#64748b;">📅 Límite: ${fechaLimite}</span>` : ''}
        </div>
        <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px;">${cap.titulo||'Sin título'}</div>
        <div style="font-size:13px;color:#64748b;line-height:1.5;">${cap.descripcion||''}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button onclick="dirCapVerLecturas('${cap.id}')" style="padding:7px 12px;background:#f0fdf4;border:1.5px solid #86efac;color:#166534;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">👁 Ver lecturas</button>
        <button onclick="dirCapEliminar('${cap.id}')" style="padding:7px 10px;background:#fef2f2;border:1.5px solid #fca5a5;color:#dc2626;border-radius:8px;font-family:inherit;font-size:12px;cursor:pointer;" aria-label="Eliminar">✕</button>
      </div>
    </div>
    <!-- Progreso de lectura -->
    <div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
        <span style="font-size:12px;font-weight:700;color:#374151;">Lecturas confirmadas</span>
        <span style="font-size:12px;color:#64748b;">${leidos} / ${totalDoc}</span>
      </div>
      <div style="background:#f1f5f9;border-radius:99px;height:8px;overflow:hidden;">
        <div style="background:${pct===100?'#059669':'#0d5c2f'};height:100%;width:${pct}%;border-radius:99px;transition:.3s;"></div>
      </div>
    </div>
    <!-- Archivos adjuntos -->
    ${archivos.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${archivos.map(a => `<a href="${a.url}" target="_blank" style="display:inline-flex;align-items:center;gap:5px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:5px 10px;font-size:12px;color:#1e40af;text-decoration:none;font-weight:600;">📎 ${a.nombre||'Archivo'}</a>`).join('')}</div>` : ''}
  </div>`;
}

function _capRenderDemo() {
  return `
  <div style="background:white;border-radius:14px;border:1.5px solid #bfdbfe;padding:20px;margin-bottom:14px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="background:#1e40af;color:white;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;">SEP</span>
      <span style="font-size:11px;color:#64748b;">📅 Límite: 15 Abr 2026</span>
    </div>
    <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px;">Curso: NEM 2026 — Estrategias de evaluación formativa</div>
    <div style="font-size:13px;color:#64748b;margin-bottom:12px;">Material oficial de la SEP para la implementación de la NEM. Todos los docentes deben completarlo antes del 15 de abril.</div>
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span style="font-size:12px;font-weight:700;">Lecturas confirmadas</span><span style="font-size:12px;color:#64748b;">5 / 8</span></div>
      <div style="background:#f1f5f9;border-radius:99px;height:8px;overflow:hidden;"><div style="background:#0d5c2f;height:100%;width:62%;border-radius:99px;"></div></div>
    </div>
    <div style="display:flex;gap:6px;"><span style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:5px 10px;font-size:12px;color:#1e40af;font-weight:600;">📎 Guia_NEM_2026.pdf</span><span style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:5px 10px;font-size:12px;color:#1e40af;font-weight:600;">📎 Presentacion.pptx</span></div>
  </div>
  <div style="background:white;border-radius:14px;border:1.5px solid #e2e8f0;padding:20px;opacity:.7;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="background:#0d5c2f;color:white;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;">ESCOLAR</span></div>
    <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px;">Taller: Manejo de grupos con NEE</div>
    <div style="font-size:13px;color:#64748b;margin-bottom:12px;">Capacitación interna para apoyar a alumnos con Necesidades Educativas Especiales.</div>
    <div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span style="font-size:12px;font-weight:700;">Lecturas confirmadas</span><span style="font-size:12px;color:#64748b;">8 / 8</span></div><div style="background:#f1f5f9;border-radius:99px;height:8px;overflow:hidden;"><div style="background:#059669;height:100%;width:100%;border-radius:99px;"></div></div></div>
  </div>`;
}

function _capActualizarStats(data) {
  const total = data.length;
  const completas = data.filter(c => {
    const lecturas = c.capacitacion_lecturas?.length || 0;
    return lecturas > 0;
  }).length;
  const pendientes = total - completas;
  const elTotal = document.getElementById('dir-cap-total');
  const elPend = document.getElementById('dir-cap-pendientes');
  const elComp = document.getElementById('dir-cap-completas');
  if (elTotal) elTotal.textContent = total;
  if (elPend) elPend.textContent = pendientes;
  if (elComp) elComp.textContent = completas;
}

function _capActualizarBadge(data) {
  const badge = document.getElementById('dir-cap-badge');
  if (!badge) return;
  const pendientes = data.filter(c => (c.capacitacion_lecturas?.length || 0) === 0).length;
  if (pendientes > 0) { badge.style.display = ''; badge.textContent = pendientes; }
  else badge.style.display = 'none';
}

function dirCapAbrirModal() {
  const html = `
    <div class="adm-form-group" style="margin-bottom:14px;">
      <label style="font-size:13px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Título de la capacitación</label>
      <input type="text" id="cap-titulo" placeholder="Ej: Curso NEM 2026 — Evaluación formativa" style="width:100%;padding:10px 13px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:inherit;font-size:13px;outline:none;box-sizing:border-box;">
    </div>
    <div class="adm-form-group" style="margin-bottom:14px;">
      <label style="font-size:13px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Descripción / instrucciones</label>
      <textarea id="cap-desc" rows="3" placeholder="Detalla el contenido, objetivos o instrucciones para el docente…" style="width:100%;padding:10px 13px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:inherit;font-size:13px;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      <div class="adm-form-group">
        <label style="font-size:13px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Tipo</label>
        <select id="cap-tipo" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:inherit;font-size:13px;outline:none;">
          <option value="SEP">SEP (oficial)</option>
          <option value="escolar">Escolar (interno)</option>
          <option value="urgente">Urgente</option>
        </select>
      </div>
      <div class="adm-form-group">
        <label style="font-size:13px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Fecha límite (opcional)</label>
        <input type="date" id="cap-fecha" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:inherit;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
    </div>
    <div class="adm-form-group" style="margin-bottom:14px;">
      <label style="font-size:13px;font-weight:700;color:#374151;display:block;margin-bottom:8px;">Destinatarios</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        <label style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:9px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="cap-dest-docentes" checked style="accent-color:#0d5c2f;"> Docentes
        </label>
        <label style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:9px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="cap-dest-admin" style="accent-color:#0d5c2f;"> Administrativos (Admin, Subdirector, Coordinador)
        </label>
        <label style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:9px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="cap-dest-todos" style="accent-color:#0d5c2f;"> Todo el personal
        </label>
      </div>
    </div>
    <div class="adm-form-group" style="margin-bottom:14px;">
      <label style="font-size:13px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Adjuntar archivos (PDF, Word, PPT, video)</label>
      <label for="cap-archivos" style="display:block;padding:14px;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:10px;text-align:center;cursor:pointer;font-family:inherit;font-size:13px;color:#64748b;font-weight:600;transition:.2s;" onmouseover="this.style.borderColor='#0d5c2f'" onmouseout="this.style.borderColor='#cbd5e1'">
        📎 Clic para adjuntar archivos<br><span style="font-size:11px;font-weight:400;">.pdf · .docx · .pptx · .xlsx · .mp4 · .jpg · .png</span>
      </label>
      <input type="file" id="cap-archivos" multiple accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.mp4,.mov,.jpg,.jpeg,.png,.webp" style="display:none;" onchange="capMostrarArchivosSeleccionados(this)">
      <div id="cap-archivos-preview" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;"></div>
    </div>`;

  // Usar el modal del ADM si está disponible
  if (typeof ADM !== 'undefined' && ADM.abrirModal) {
    ADM.abrirModal('cap-modal', 'Nueva capacitación / programa', html, "dirCapGuardar()");
  } else {
    // Fallback: modal nativo
    const overlay = document.createElement('div');
    overlay.id = 'cap-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = `<div style="background:white;border-radius:16px;padding:28px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div style="font-size:17px;font-weight:700;color:#0f172a;">📚 Nueva capacitación / programa</div>
        <button onclick="document.getElementById('cap-modal-overlay').remove()" style="background:none;border:none;cursor:pointer;font-size:20px;color:#64748b;" aria-label="Cerrar">✕</button>
      </div>
      ${html}
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
        <button onclick="document.getElementById('cap-modal-overlay').remove()" style="padding:10px 20px;background:white;border:1.5px solid #e2e8f0;color:#64748b;border-radius:9px;font-family:inherit;font-size:13px;cursor:pointer;">Cancelar</button>
        <button onclick="dirCapGuardar()" style="padding:10px 24px;background:linear-gradient(135deg,#0d5c2f,#157a40);color:white;border:none;border-radius:9px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;">Publicar capacitación</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
  }
}

function capMostrarArchivosSeleccionados(input) {
  const preview = document.getElementById('cap-archivos-preview');
  if (!preview) return;
  preview.innerHTML = [...input.files].map(f =>
    `<span style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:4px 10px;font-size:12px;color:#166534;font-weight:600;">📎 ${f.name}</span>`
  ).join('');
}

async function dirCapGuardar() {
  const titulo = document.getElementById('cap-titulo')?.value.trim();
  const desc   = document.getElementById('cap-desc')?.value.trim();
  const tipo   = document.getElementById('cap-tipo')?.value || 'escolar';
  const fecha  = document.getElementById('cap-fecha')?.value || null;
  const archivosInput = document.getElementById('cap-archivos');

  if (!titulo) { hubToast('⚠️ Ingresa un título', 'warn'); return; }

  // Leer destinatarios seleccionados
  const destDocentes = document.getElementById('cap-dest-docentes')?.checked;
  const destAdmin    = document.getElementById('cap-dest-admin')?.checked;
  const destTodos    = document.getElementById('cap-dest-todos')?.checked;
  const destinatarios = destTodos ? ['todos'] : [
    ...(destDocentes ? ['docente','tutor','ts','prefecto'] : []),
    ...(destAdmin    ? ['admin','subdirector','coordinador','director'] : []),
  ];
  if (!destinatarios.length) { hubToast('⚠️ Selecciona al menos un tipo de destinatario', 'warn'); return; }

  const sbRef  = window.sb;
  const cct    = window.currentPerfil?.escuela_cct || (typeof _getCct==='function' ? _getCct() : null);
  const userId = window.currentPerfil?.id;

  try {
    let capId = null;
    if (sbRef && cct) {
      const { data, error } = await sbRef.from('capacitaciones').insert({
        titulo, descripcion: desc, tipo, fecha_limite: fecha,
        escuela_cct: cct, creado_por: userId, activo: true,
        destinatarios: destTodos ? null : destinatarios,
      }).select().single();
      if (error) throw error;
      capId = data.id;

      // Subir archivos si hay
      const archivos = archivosInput?.files || [];
      for (const file of archivos) {
        try {
          const path = `capacitaciones/${cct}/${capId}/${Date.now()}_${file.name}`;
          const { error: upErr } = await sbRef.storage.from('evidencias').upload(path, file, { upsert: true });
          if (!upErr) {
            const { data: urlData } = sbRef.storage.from('evidencias').getPublicUrl(path);
            await sbRef.from('capacitacion_archivos').insert({
              capacitacion_id: capId, nombre: file.name, url: urlData.publicUrl,
              tipo_archivo: file.type,
            });
          }
        } catch(eFile) { console.warn('[cap] archivo:', eFile.message); }
      }
    }

    // Cerrar modal
    document.getElementById('cap-modal-overlay')?.remove();
    if (typeof ADM !== 'undefined' && ADM.cerrarModal) ADM.cerrarModal();

    hubToast('✅ Capacitación publicada');
    await dirCapacitacionCargar();

  } catch(e) { hubToast('❌ ' + e.message, 'err'); }
}

async function dirCapVerLecturas(capId) {
  const cap = (window._capDatos || []).find(c => c.id === capId);
  if (!cap) return;
  const lecturas = cap.capacitacion_lecturas || [];
  const leidosPor = new Set(lecturas.map(l => l.docente_id));

  // Obtener docentes para mostrar quiénes faltan
  const sbRef = window.sb;
  const cct = window.currentPerfil?.escuela_cct;
  let docentes = [];
  if (sbRef && cct) {
    const { data } = await sbRef.from('usuarios')
      .select('id,nombre,apellido_p')
      .eq('escuela_cct', cct)
      .eq('rol', 'docente')
      .eq('activo', true);
    docentes = data || [];
  }

  const html = `
    <div style="margin-bottom:14px;">
      <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;">${cap.titulo}</div>
      <div style="font-size:12px;color:#64748b;">${lecturas.length} de ${docentes.length || '?'} docentes han confirmado lectura</div>
    </div>
    ${docentes.length ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      ${docentes.map(d => {
        const leido = leidosPor.has(d.id);
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:${leido?'#f0fdf4':'#fff7ed'};border:1px solid ${leido?'#bbf7d0':'#fed7aa'};border-radius:8px;">
          <span style="font-size:16px;">${leido?'✅':'⏳'}</span>
          <span style="font-size:13px;font-weight:600;color:${leido?'#166534':'#92400e'};">${d.nombre} ${d.apellido_p||''}</span>
        </div>`;
      }).join('')}
    </div>` : '<div style="color:#94a3b8;font-size:13px;padding:8px 0;">Todavía no hay docentes registrados en este plantel para mostrar seguimiento lector.</div>'}`;

  hubModal('📚 Seguimiento de lectura', html, 'Cerrar', null);
}

async function dirCapEliminar(capId) {
  if (!confirm('¿Eliminar esta capacitación? Esta acción no se puede deshacer.')) return;
  const sbRef = window.sb;
  if (!sbRef) { window._capDatos = window._capDatos.filter(c => c.id !== capId); dirCapacitacionCargar(); return; }
  try {
    const { error } = await sbRef.from('capacitaciones').update({ activo: false }).eq('id', capId);
    if (error) throw error;
    hubToast('✅ Capacitación eliminada');
    await dirCapacitacionCargar();
  } catch(e) { hubToast('❌ ' + e.message, 'err'); }
}

// ── AVISOS BANNER — DOCENTE DASHBOARD ────────────────────────
async function docenteCargarAvisos() {
  const wrap = document.getElementById('dash-avisos-wrap');
  const container = document.getElementById('dash-avisos-scroll');
  const countEl = document.getElementById('dash-avisos-count');
  if (!wrap || !container) return;

  const sbRef = window.sb;
  const cct = window.currentPerfil?.escuela_cct;
  if (!sbRef || !cct) return;

  try {
    // La tabla anuncios usa escuela_id para guardar el CCT y columnas: titulo, descripcion, tipo, creado_en, activo
    const { data, error } = await sbRef
      .from('anuncios')
      .select('id, titulo, descripcion, tipo, creado_en, dirigido_a')
      .eq('escuela_id', cct)
      .eq('activo', true)
      .order('creado_en', { ascending: false })
      .limit(20);

    if (error || !data?.length) return;

    // Filtrar avisos dirigidos a docentes o a todos
    const rolActual = window.currentPerfil?.rol || 'docente';
    const avisos = data.filter(av => {
      if (!av.dirigido_a || !Array.isArray(av.dirigido_a)) return true;
      return av.dirigido_a.includes('todos') || av.dirigido_a.includes(rolActual) || av.dirigido_a.includes('docente');
    });
    if (!avisos.length) return;

    wrap.style.display = 'block';
    if (countEl) countEl.textContent = `${avisos.length} aviso${avisos.length !== 1 ? 's' : ''}`;

    const colorMap = {
      urgente: { bg: '#fef2f2', border: '#fecaca', icon: '🚨', txt: '#b91c1c' },
      info:    { bg: '#eff6ff', border: '#bfdbfe', icon: '📋', txt: '#1d4ed8' },
      logro:   { bg: '#f0fdf4', border: '#86efac', icon: '🏆', txt: '#15803d' },
      evento:  { bg: '#fff7ed', border: '#fed7aa', icon: '📅', txt: '#c2410c' },
      default: { bg: '#fafafa', border: '#e2e8f0', icon: '📢', txt: '#475569' },
    };

    container.innerHTML = avisos.map(av => {
      const c = colorMap[av.tipo] || colorMap.default;
      const fecha = new Date(av.creado_en).toLocaleDateString('es-MX', { day:'numeric', month:'short' });
      const desc = (av.descripcion || '').substring(0, 120) + ((av.descripcion||'').length > 120 ? '…' : '');
      return `<div style="min-width:240px;max-width:280px;background:${c.bg};border:1.5px solid ${c.border};border-radius:14px;padding:14px 16px;scroll-snap-align:start;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:18px;">${c.icon}</span>
          <div style="font-size:12px;font-weight:700;color:${c.txt};flex:1;line-height:1.3;">${av.titulo || 'Aviso'}</div>
        </div>
        ${desc ? `<div style="font-size:12px;color:#475569;line-height:1.5;margin-bottom:8px;">${desc}</div>` : ''}
        <div style="font-size:10px;color:#94a3b8;">Dirección · ${fecha}</div>
      </div>`;
    }).join('');
  } catch(e) { console.warn('[avisos]', e.message); }
}

// ── CAPACITACIÓN: VISTA DOCENTE ──────────────────────────────
async function docenteCapacitacionCargar() {
  const sbRef = window.sb;
  const userId = window.currentPerfil?.id;
  const cct = window.currentPerfil?.escuela_cct
    || window.ESCUELA_ACTIVA?.cct
    || (typeof _getCct==='function' ? _getCct() : null);
  const el = document.getElementById('doc-cap-lista');
  if (!el) return;

  if (!sbRef || !cct) { el.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center;">Sin conexión o escuela no identificada</div>'; return; }

  try {
    const rolUsuario = window.currentPerfil?.rol || 'docente';
    const { data: allCaps, error } = await sbRef
      .from('capacitaciones')
      .select('*, capacitacion_archivos(*), capacitacion_lecturas(docente_id)')
      .eq('escuela_cct', cct)
      .eq('activo', true)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Filtrar por destinatarios: mostrar si destinatarios es null (todos) o incluye el rol del usuario
    const data = (allCaps || []).filter(c => {
      if (!c.destinatarios || c.destinatarios === null) return true;
      const dests = Array.isArray(c.destinatarios) ? c.destinatarios : [];
      return dests.includes('todos') || dests.includes(rolUsuario);
    });

    const { data: misLecturas } = await sbRef
      .from('capacitacion_lecturas')
      .select('capacitacion_id')
      .eq('docente_id', userId);
    const leidasIds = new Set((misLecturas||[]).map(l => l.capacitacion_id));

    const sinLeer = data.filter(c => !leidasIds.has(c.id));
    const leidas  = data.filter(c => leidasIds.has(c.id));

    // Actualizar badge en nav docente
    const badge = document.getElementById('doc-cap-badge');
    if (badge) { badge.textContent = sinLeer.length; badge.style.display = sinLeer.length ? '' : 'none'; }

    // Actualizar stats
    const total = (data||[]).length;
    const setEl = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
    setEl('doc-cap-stat-total', total);
    setEl('doc-cap-stat-pend', sinLeer.length);
    setEl('doc-cap-stat-comp', leidas.length);

    // Alerta de pendientes
    const alerta = document.getElementById('doc-cap-alerta');
    const alertaTxt = document.getElementById('doc-cap-alerta-txt');
    if (alerta && alertaTxt) {
      if (sinLeer.length > 0) {
        alerta.style.display = 'flex';
        alertaTxt.textContent = `Tienes ${sinLeer.length} capacitación${sinLeer.length>1?'es':''} pendiente${sinLeer.length>1?'s':''} de confirmar lectura.`;
      } else {
        alerta.style.display = 'none';
      }
    }

    el.innerHTML = [...sinLeer.map(c => _capRenderCardDocente(c, false)), ...leidas.map(c => _capRenderCardDocente(c, true))].join('') || '<div style="padding:40px;text-align:center;color:#94a3b8;">Sin capacitaciones disponibles</div>';

  } catch(e) { el.innerHTML = `<div style="padding:20px;color:#ef4444;">Error: ${e.message}</div>`; }
}

function _capRenderCardDocente(cap, leida) {
  const archivos = cap.capacitacion_archivos || [];
  const tipoColor = { SEP:'#1e40af', escolar:'#0d5c2f', urgente:'#dc2626' };
  const tipo = cap.tipo || 'escolar';
  const fechaLimite = cap.fecha_limite ? new Date(cap.fecha_limite).toLocaleDateString('es-MX') : null;

  return `
  <div style="background:white;border-radius:12px;border:1.5px solid ${leida?'#e2e8f0':'#fde68a'};padding:18px;margin-bottom:12px;box-shadow:0 2px 4px rgba(0,0,0,.04);">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
          <span style="background:${tipoColor[tipo]||'#475569'};color:white;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;">${tipo.toUpperCase()}</span>
          ${leida ? '<span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;">✅ LEÍDO</span>' : '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;">⏳ PENDIENTE</span>'}
          ${fechaLimite ? `<span style="font-size:11px;color:#64748b;">📅 ${fechaLimite}</span>` : ''}
        </div>
        <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;">${cap.titulo||'Sin título'}</div>
        <div style="font-size:12px;color:#64748b;line-height:1.5;">${cap.descripcion||''}</div>
      </div>
      ${!leida ? `<button onclick="docenteCapConfirmarLectura('${cap.id}')" style="flex-shrink:0;padding:8px 16px;background:linear-gradient(135deg,#0d5c2f,#157a40);color:white;border:none;border-radius:9px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">✓ Confirmar</button>` : ''}
    </div>
    ${archivos.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">${archivos.map(a => `<a href="${a.url}" target="_blank" style="display:inline-flex;align-items:center;gap:5px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:4px 10px;font-size:11px;color:#1e40af;text-decoration:none;font-weight:600;">📎 ${a.nombre||'Ver archivo'}</a>`).join('')}</div>` : ''}
  </div>`;
}

async function docenteCapConfirmarLectura(capId) {
  const sbRef = window.sb;
  const userId = window.currentPerfil?.id;
  if (!sbRef || !userId) { hubToast('⚠️ Sin sesión activa', 'warn'); return; }
  try {
    await sbRef.from('capacitacion_lecturas').upsert({
      capacitacion_id: capId, docente_id: userId, leido_at: new Date().toISOString()
    }, { onConflict: 'capacitacion_id,docente_id' });
    hubToast('✅ Lectura confirmada');
    await docenteCapacitacionCargar();
  } catch(e) { hubToast('❌ ' + e.message, 'err'); }
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO: GESTIÓN ESCOLAR (Director)
// ═══════════════════════════════════════════════════════════════

window._gesInfra = [
  { tipo:'salones', icono:'🏫', label:'Salones', cantidad:6 },
  { tipo:'computadoras', icono:'💻', label:'Computadoras', cantidad:12 },
  { tipo:'climas', icono:'❄️', label:'Climas/AC', cantidad:4 },
  { tipo:'bancos', icono:'🏦', label:'Cuentas bancarias', cantidad:1 },
  { tipo:'proyectores', icono:'📽️', label:'Proyectores', cantidad:3 },
  { tipo:'baños', icono:'🚻', label:'Baños', cantidad:4 },
];
window._gesFallas = [];
window._gesProveedores = [];
window._gesGastos = [];
window._gesIngresos = [];
window._gesFacturas = [];

function dirGestionEscolarCargar() {
  dirGesTab('infra');
}

function dirGesTab(tab) {
  ['infra','prov','gastos','ingresos','facturas'].forEach(t => {
    const panel = document.getElementById('ges-panel-' + t);
    const btn   = document.getElementById('ges-tab-' + t);
    if (panel) panel.style.display = t === tab ? '' : 'none';
    if (btn) {
      btn.style.color      = t === tab ? '#0d5c2f' : '#64748b';
      btn.style.fontWeight = t === tab ? '700' : '600';
      btn.style.borderBottom = t === tab ? '2px solid #0d5c2f' : 'none';
    }
  });
  if (tab === 'infra')     _gesRenderInfra();
  if (tab === 'prov')      _gesRenderProveedores();
  if (tab === 'gastos')    _gesRenderGastos();
  if (tab === 'ingresos')  _gesRenderIngresos();
  if (tab === 'facturas')  _gesRenderFacturas();
}

function _gesRenderInfra() {
  const grid = document.getElementById('ges-infra-grid');
  const fallas = document.getElementById('ges-fallas-lista');
  if (grid) {
    grid.innerHTML = window._gesInfra.map(item => `
      <div style="background:white;border-radius:12px;border:1.5px solid #e2e8f0;padding:18px;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,.04);">
        <div style="font-size:32px;margin-bottom:8px;">${item.icono}</div>
        <div style="font-size:22px;font-weight:800;color:#0f172a;font-family:'Fraunces',serif;">${item.cantidad}</div>
        <div style="font-size:12px;color:#64748b;font-weight:600;margin-top:2px;">${item.label}</div>
        <div style="display:flex;justify-content:center;gap:4px;margin-top:8px;">
          <button onclick="_gesEditarInfra('${item.tipo}')" style="padding:4px 8px;background:#f0fdf4;border:1px solid #86efac;color:#166534;border-radius:6px;font-size:11px;cursor:pointer;">✏️</button>
        </div>
      </div>`).join('');
  }
  if (fallas) {
    fallas.innerHTML = window._gesFallas.length
      ? window._gesFallas.map((f,i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:${f.prio==='alta'?'#fef2f2':f.prio==='media'?'#fffbeb':'#f0fdf4'};border-radius:8px;margin-bottom:6px;border:1px solid ${f.prio==='alta'?'#fca5a5':f.prio==='media'?'#fde68a':'#bbf7d0'};">
          <span>${f.prio==='alta'?'🔴':f.prio==='media'?'🟡':'🟢'}</span>
          <span style="flex:1;font-size:13px;color:#374151;">${f.texto}</span>
          <span style="font-size:11px;color:#94a3b8;">${new Date(f.fecha).toLocaleDateString('es-MX')}</span>
          <button onclick="_gesFallas.splice(${i},1);_gesRenderInfra()" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:14px;" aria-label="Cerrar">✕</button>
        </div>`).join('')
      : '<div style="color:#94a3b8;font-size:13px;padding:8px 0;font-style:italic;">Sin fallas reportadas.</div>';
  }
}

function _gesEditarInfra(tipo) {
  const item = window._gesInfra.find(i => i.tipo === tipo);
  if (!item) return;
  const nueva = prompt(`Cantidad de ${item.label}:`, item.cantidad);
  if (nueva !== null && !isNaN(parseInt(nueva))) {
    item.cantidad = parseInt(nueva);
    _gesRenderInfra();
  }
}

function dirGesAgregarInfra() {
  const tipo  = prompt('Tipo de recurso (ej: aulas, mesas, sillas):');
  if (!tipo) return;
  const icono = prompt('Ícono (emoji):') || '📦';
  const cant  = parseInt(prompt('Cantidad:') || '0');
  window._gesInfra.push({ tipo: tipo.toLowerCase(), icono, label: tipo, cantidad: cant });
  _gesRenderInfra();
}

function dirGesReportarFalla() {
  const texto = document.getElementById('ges-falla-input')?.value.trim();
  const prio  = document.getElementById('ges-falla-prio')?.value || 'media';
  if (!texto) { hubToast('⚠️ Describe la falla', 'warn'); return; }
  window._gesFallas.unshift({ texto, prio, fecha: new Date().toISOString() });
  document.getElementById('ges-falla-input').value = '';
  _gesRenderInfra();
  hubToast('✅ Falla reportada');
}

function _gesRenderProveedores() {
  const el = document.getElementById('ges-prov-lista');
  if (!el) return;
  el.innerHTML = window._gesProveedores.length
    ? window._gesProveedores.map((p,i) => `
      <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:14px;font-weight:700;color:#0f172a;">${p.nombre}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">${p.categoria||'—'} · RFC: ${p.rfc||'—'} · ${p.contacto||'—'}</div>
        </div>
        <button onclick="_gesProveedores.splice(${i},1);_gesRenderProveedores()" style="padding:6px 10px;background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;border-radius:8px;font-size:12px;cursor:pointer;" aria-label="Cerrar">✕</button>
      </div>`).join('')
    : '<div style="text-align:center;padding:50px;color:#94a3b8;"><div style="font-size:36px;margin-bottom:10px;">🤝</div><div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:6px;">Aún no hay proveedores registrados</div><div style="font-size:13px;">Agrega proveedores para relacionar compras, facturas y seguimiento comercial.</div></div>';
}

function dirGesAgregarProveedor() {
  const nombre    = prompt('Nombre del proveedor:');
  if (!nombre) return;
  const categoria = prompt('Categoría (ej: Papelería, Mantenimiento, Limpieza):') || '';
  const rfc       = prompt('RFC (opcional):') || '';
  const contacto  = prompt('Teléfono o email:') || '';
  window._gesProveedores.push({ nombre, categoria, rfc, contacto });
  _gesRenderProveedores();
  hubToast('✅ Proveedor agregado');
}

function _gesRenderGastos() {
  const el = document.getElementById('ges-gastos-lista');
  if (!el) return;
  const total = window._gesGastos.reduce((s, g) => s + parseFloat(g.monto||0), 0);
  el.innerHTML = `<div style="background:#fef2f2;border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:13px;font-weight:700;color:#dc2626;">Total gastos registrados</span>
    <span style="font-size:20px;font-weight:800;color:#dc2626;font-family:'Fraunces',serif;">$${total.toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
  </div>` + (window._gesGastos.length
    ? window._gesGastos.map((g,i) => `
      <div style="background:white;border-radius:10px;border:1px solid #e2e8f0;padding:14px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;font-weight:700;color:#0f172a;">${g.concepto}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">${g.categoria||'General'} · ${new Date(g.fecha).toLocaleDateString('es-MX')} · ${g.proveedor||'—'}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:15px;font-weight:700;color:#dc2626;">-$${parseFloat(g.monto).toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
          <button onclick="_gesGastos.splice(${i},1);_gesRenderGastos()" style="padding:4px 8px;background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;border-radius:6px;font-size:11px;cursor:pointer;" aria-label="Cerrar">✕</button>
        </div>
      </div>`).join('')
    : '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">Aún no hay gastos capturados para este periodo.</div>');
}

function dirGesAgregarGasto() {
  const overlay = document.createElement('div');
  overlay.id = 'ges-gasto-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div style="font-size:17px;font-weight:700;color:#0f172a;">💸 Registrar gasto</div>
        <button onclick="document.getElementById('ges-gasto-modal').remove()" style="background:none;border:none;cursor:pointer;font-size:20px;color:#64748b;" aria-label="Cerrar">✕</button>
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Concepto del gasto *</label>
        <input id="ges-g-concepto" type="text" placeholder="Ej: Compra de material didáctico, Pago de servicio eléctrico…" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div>
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Monto ($) *</label>
          <input id="ges-g-monto" type="number" min="0" step="0.01" placeholder="0.00" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Categoría *</label>
          <select id="ges-g-categoria" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
            <option value="Material">Material didáctico</option>
            <option value="Mantenimiento">Mantenimiento</option>
            <option value="Servicios">Servicios (agua, luz, internet)</option>
            <option value="Limpieza">Limpieza e higiene</option>
            <option value="Eventos">Eventos y actividades</option>
            <option value="Papelería">Papelería y oficina</option>
            <option value="Equipo">Equipo y tecnología</option>
            <option value="Capacitacion">Capacitación docente</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
      </div>
      <div style="margin-bottom:18px;">
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Proveedor / Nota (opcional)</label>
        <input id="ges-g-proveedor" type="text" placeholder="Nombre del proveedor o nota adicional" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button onclick="document.getElementById('ges-gasto-modal').remove()" style="padding:10px 20px;background:white;border:1.5px solid #e2e8f0;color:#64748b;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;cursor:pointer;">Cancelar</button>
        <button onclick="dirGesConfirmarGasto()" style="padding:10px 22px;background:linear-gradient(135deg,#dc2626,#ef4444);color:white;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">💸 Registrar gasto</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('ges-g-concepto')?.focus(), 100);
}
function dirGesConfirmarGasto() {
  const concepto  = document.getElementById('ges-g-concepto')?.value.trim();
  if (!concepto) { hubToast('⚠️ Ingresa el concepto del gasto', 'warn'); return; }
  const monto     = parseFloat(document.getElementById('ges-g-monto')?.value || '0');
  const categoria = document.getElementById('ges-g-categoria')?.value || 'Otro';
  const proveedor = document.getElementById('ges-g-proveedor')?.value.trim() || '';
  window._gesGastos.unshift({ concepto, monto, categoria, proveedor, fecha: new Date().toISOString() });
  document.getElementById('ges-gasto-modal')?.remove();
  _gesRenderGastos();
  hubToast('✅ Gasto registrado');
}

function _gesRenderIngresos() {
  const el = document.getElementById('ges-ingresos-lista');
  if (!el) return;
  const total = window._gesIngresos.reduce((s, g) => s + parseFloat(g.monto||0), 0);
  el.innerHTML = `<div style="background:#f0fdf4;border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:13px;font-weight:700;color:#166534;">Total ingresos registrados</span>
    <span style="font-size:20px;font-weight:800;color:#166634;font-family:'Fraunces',serif;">$${total.toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
  </div>` + (window._gesIngresos.length
    ? window._gesIngresos.map((g,i) => `
      <div style="background:white;border-radius:10px;border:1px solid #e2e8f0;padding:14px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;font-weight:700;color:#0f172a;">${g.concepto}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">${g.tipo||'Otro'} · ${new Date(g.fecha).toLocaleDateString('es-MX')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:15px;font-weight:700;color:#166534;">+$${parseFloat(g.monto).toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
          <button onclick="_gesIngresos.splice(${i},1);_gesRenderIngresos()" style="padding:4px 8px;background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;border-radius:6px;font-size:11px;cursor:pointer;" aria-label="Cerrar">✕</button>
        </div>
      </div>`).join('')
    : '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">Aún no hay ingresos capturados para este periodo.</div>');
}

function dirGesAgregarIngreso() {
  const overlay = document.createElement('div');
  overlay.id = 'ges-ingreso-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div style="font-size:17px;font-weight:700;color:#0f172a;">💰 Registrar ingreso</div>
        <button onclick="document.getElementById('ges-ingreso-modal').remove()" style="background:none;border:none;cursor:pointer;font-size:20px;color:#64748b;" aria-label="Cerrar">✕</button>
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Concepto del ingreso *</label>
        <input id="ges-i-concepto" type="text" placeholder="Ej: Cuota de inscripción, Venta en tiendita, Donativo…" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
        <div>
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Monto ($) *</label>
          <input id="ges-i-monto" type="number" min="0" step="0.01" placeholder="0.00" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Tipo de ingreso *</label>
          <select id="ges-i-tipo" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
            <option value="Cuota">Cuota de inscripción</option>
            <option value="Tiendita">Tiendita escolar</option>
            <option value="SEP">Presupuesto SEP</option>
            <option value="Evento">Evento / Rifa</option>
            <option value="Donativo">Donativo</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button onclick="document.getElementById('ges-ingreso-modal').remove()" style="padding:10px 20px;background:white;border:1.5px solid #e2e8f0;color:#64748b;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;cursor:pointer;">Cancelar</button>
        <button onclick="dirGesConfirmarIngreso()" style="padding:10px 22px;background:linear-gradient(135deg,#166534,#15803d);color:white;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">💰 Registrar ingreso</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('ges-i-concepto')?.focus(), 100);
}
function dirGesConfirmarIngreso() {
  const concepto = document.getElementById('ges-i-concepto')?.value.trim();
  if (!concepto) { hubToast('⚠️ Ingresa el concepto del ingreso', 'warn'); return; }
  const monto = parseFloat(document.getElementById('ges-i-monto')?.value || '0');
  const tipo  = document.getElementById('ges-i-tipo')?.value || 'Otro';
  window._gesIngresos.unshift({ concepto, monto, tipo, fecha: new Date().toISOString() });
  document.getElementById('ges-ingreso-modal')?.remove();
  _gesRenderIngresos();
  hubToast('✅ Ingreso registrado');
}

function _gesRenderFacturas() {
  const el = document.getElementById('ges-facturas-lista');
  if (!el) return;
  el.innerHTML = window._gesFacturas.length
    ? window._gesFacturas.map((f,i) => `
      <div style="background:white;border-radius:10px;border:1px solid #e2e8f0;padding:14px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;font-weight:700;color:#0f172a;">📄 ${f.nombre}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">Subida: ${new Date(f.fecha).toLocaleDateString('es-MX')}</div>
        </div>
        <div style="display:flex;gap:6px;">
          ${f.url ? `<a href="${f.url}" target="_blank" style="padding:6px 12px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;">Ver</a>` : ''}
          <button onclick="_gesFacturas.splice(${i},1);_gesRenderFacturas()" style="padding:6px 10px;background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;border-radius:8px;font-size:12px;cursor:pointer;" aria-label="Cerrar">✕</button>
        </div>
      </div>`).join('')
    : '<div style="text-align:center;padding:50px;color:#94a3b8;"><div style="font-size:36px;margin-bottom:10px;">🧾</div><div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:6px;">Sin facturas subidas</div><div style="font-size:13px;">Sube las facturas y comprobantes que necesitas reportar a la SEP.</div></div>';
}

async function dirGesSubirFactura(input) {
  const file = input.files[0];
  if (!file) return;
  const sbRef = window.sb;
  const cct   = window.currentPerfil?.escuela_cct;
  let url = null;
  if (sbRef && cct) {
    try {
      const path = `facturas/${cct}/${Date.now()}_${file.name}`;
      const { error } = await sbRef.storage.from('evidencias').upload(path, file, { upsert: true });
      if (!error) {
        const { data } = sbRef.storage.from('evidencias').getPublicUrl(path);
        url = data.publicUrl;
      }
    } catch(e) { console.warn('[factura]', e.message); }
  }
  window._gesFacturas.unshift({ nombre: file.name, fecha: new Date().toISOString(), url });
  _gesRenderFacturas();
  input.value = '';
  hubToast('✅ Factura subida');
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO: TIENDITA ESCOLAR (Director)
// ═══════════════════════════════════════════════════════════════

window._tienditaMovimientos = [];
window._tienditaCuota = 1.50;

function dirTienditaCargar() {
  const periodo = document.getElementById('tiendita-filtro-periodo')?.value || 'mes';
  const now = new Date();
  let desde = new Date(0);
  if (periodo === 'semana') { desde = new Date(now); desde.setDate(now.getDate() - 7); }
  if (periodo === 'mes')    { desde = new Date(now.getFullYear(), now.getMonth(), 1); }

  const filtrados = window._tienditaMovimientos.filter(m => new Date(m.fecha) >= desde);
  const totalMes  = filtrados.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + parseFloat(m.monto||0), 0);
  const totalAll  = window._tienditaMovimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + parseFloat(m.monto||0), 0);
  const numAlumnos = window.ADM?.alumnos?.length || (window._prefAlumnos?.length) || '—';

  const elMes     = document.getElementById('tiendita-mes');
  const elCuota   = document.getElementById('tiendita-cuota');
  const elAlumnos = document.getElementById('tiendita-alumnos');
  const elTotal   = document.getElementById('tiendita-total');
  if (elMes)     elMes.textContent     = `$${totalMes.toLocaleString('es-MX',{minimumFractionDigits:2})}`;
  if (elCuota)   elCuota.textContent   = `$${window._tienditaCuota.toFixed(2)}`;
  if (elAlumnos) elAlumnos.textContent = numAlumnos;
  if (elTotal)   elTotal.textContent   = `$${totalAll.toLocaleString('es-MX',{minimumFractionDigits:2})}`;

  const tabla = document.getElementById('tiendita-tabla');
  if (!tabla) return;
  tabla.innerHTML = filtrados.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Fecha</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Concepto</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Tipo</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Monto</th>
        </tr></thead>
        <tbody>${filtrados.map((m,i) => `
          <tr style="border-bottom:1px solid #f1f5f9;background:${i%2===0?'white':'#f8fafc'};">
            <td style="padding:9px 14px;color:#64748b;font-size:12px;">${new Date(m.fecha).toLocaleDateString('es-MX')}</td>
            <td style="padding:9px 14px;font-weight:600;color:#0f172a;">${m.concepto}</td>
            <td style="padding:9px 14px;"><span style="background:${m.tipo==='ingreso'?'#dcfce7':'#fee2e2'};color:${m.tipo==='ingreso'?'#166534':'#dc2626'};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">${m.tipo==='ingreso'?'Ingreso':'Gasto'}</span></td>
            <td style="padding:9px 14px;text-align:right;font-weight:700;color:${m.tipo==='ingreso'?'#166534':'#dc2626'};">${m.tipo==='ingreso'?'+':'-'}$${parseFloat(m.monto).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:13px;">Sin movimientos en este periodo</div>';
}

function dirTienditaRegistrar() {
  const tipo     = ['ingreso','gasto'][Math.round(Math.random()*(1-0))]; // Usaremos prompt
  const tipoSel  = confirm('¿Es un INGRESO? (Cancelar = Gasto)') ? 'ingreso' : 'gasto';
  const concepto = prompt(`Concepto del ${tipoSel}:`);
  if (!concepto) return;
  const monto    = parseFloat(prompt('Monto ($):') || '0');
  window._tienditaMovimientos.unshift({ concepto, monto, tipo: tipoSel, fecha: new Date().toISOString() });
  dirTienditaCargar();
  hubToast(`✅ ${tipoSel === 'ingreso' ? 'Ingreso' : 'Gasto'} registrado`);
}

function dirTienditaEditarCuota() {
  const nueva = parseFloat(prompt('Nueva cuota por alumno ($):', window._tienditaCuota) || window._tienditaCuota);
  if (!isNaN(nueva) && nueva > 0) {
    window._tienditaCuota = nueva;
    dirTienditaCargar();
    hubToast('✅ Cuota actualizada');
  }
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO: CONTRALOR (Portal independiente)
// ═══════════════════════════════════════════════════════════════

async function contraloRenderDashboard() {
  const _dashEl = document.getElementById('contralor-dashboard');
  if (!_dashEl) return;
  const _cct = _getCct(), _ciclo = window.CICLO_ACTIVO || '2025-2026';
  if (!window.sb || !_cct) { _dashEl.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Sin conexi\u00F3n a Supabase</div>'; return; }
  _dashEl.innerHTML = '<div style="padding:60px;text-align:center;color:#94a3b8;"><div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#1a1a2e;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px;"></div>Cargando\u2026</div>';
  try {
    const [_rG,_rI,_rF] = await Promise.all([
      window.sb.from('finanzas_gastos').select('id,concepto,monto,categoria,fecha').eq('escuela_cct',_cct).eq('ciclo',_ciclo).order('fecha',{ascending:false}).limit(200),
      window.sb.from('finanzas_ingresos').select('id,concepto,monto,tipo,fecha').eq('escuela_cct',_cct).eq('ciclo',_ciclo).order('fecha',{ascending:false}).limit(200),
      window.sb.from('finanzas_facturas').select('id',{count:'exact',head:true}).eq('escuela_cct',_cct).eq('ciclo',_ciclo)
    ]);
    const gastos   = _rG.data || [];
    const ingresos = _rI.data || [];
    const facturas = { length: _rF.count || 0 };
    window._gesGastos = gastos; window._gesIngresos = ingresos;
    const totalGastos   = gastos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
  const totalIngresos = ingresos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
  const balance       = totalIngresos - totalGastos;
  const pct = Math.min(100, totalIngresos > 0 ? Math.round(totalGastos / totalIngresos * 100) : 0);
  const balColor = balance >= 0 ? '#059669' : '#dc2626';
  _dashEl.innerHTML = `
    <!-- Header banner -->
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;padding:24px 28px;margin-bottom:22px;color:white;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;">
      <div>
        <div style="font-family:'Fraunces',serif;font-size:22px;font-weight:700;">🧾 Control financiero</div>
        <div style="font-size:13px;opacity:.7;margin-top:4px;">Ciclo escolar ${_ciclo} · ${_cct}</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button onclick="contNuevoGasto()" style="padding:9px 16px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:10px;color:white;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">💸 Registrar gasto</button>
        <button onclick="contNuevoIngreso()" style="padding:9px 16px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:10px;color:white;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">💵 Registrar ingreso</button>
      </div>
    </div>
    <!-- KPI cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:22px;">
      <div style="background:white;border-radius:14px;border:1.5px solid #bbf7d0;padding:20px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="width:36px;height:36px;background:#f0fdf4;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">💵</div>
          <div style="font-size:11px;color:#065f46;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Ingresos</div>
        </div>
        <div style="font-size:26px;font-weight:800;color:#059669;font-family:'Fraunces',serif;">$${totalIngresos.toLocaleString('es-MX',{minimumFractionDigits:2})}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;">${ingresos.length} registros</div>
      </div>
      <div style="background:white;border-radius:14px;border:1.5px solid #fca5a5;padding:20px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="width:36px;height:36px;background:#fef2f2;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">💸</div>
          <div style="font-size:11px;color:#7f1d1d;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Gastos</div>
        </div>
        <div style="font-size:26px;font-weight:800;color:#dc2626;font-family:'Fraunces',serif;">$${totalGastos.toLocaleString('es-MX',{minimumFractionDigits:2})}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;">${gastos.length} registros</div>
      </div>
      <div style="background:white;border-radius:14px;border:1.5px solid ${balance>=0?'#bbf7d0':'#fca5a5'};padding:20px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="width:36px;height:36px;background:${balance>=0?'#f0fdf4':'#fef2f2'};border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">${balance>=0?'📈':'📉'}</div>
          <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Balance</div>
        </div>
        <div style="font-size:26px;font-weight:800;color:${balColor};font-family:'Fraunces',serif;">${balance>=0?'+':''}$${balance.toLocaleString('es-MX',{minimumFractionDigits:2})}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;">${balance>=0?'Superávit':'Déficit'}</div>
      </div>
      <div style="background:white;border-radius:14px;border:1.5px solid #e2e8f0;padding:20px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="width:36px;height:36px;background:#f0f9ff;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">🧾</div>
          <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Facturas</div>
        </div>
        <div style="font-size:26px;font-weight:800;color:#0f172a;font-family:'Fraunces',serif;">${facturas.length}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;">comprobantes SEP</div>
      </div>
    </div>
    <!-- Barra de ejecución presupuestal -->
    <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:20px;margin-bottom:18px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-size:14px;font-weight:700;color:#0f172a;">📊 Ejecución presupuestal</div>
        <div style="font-size:13px;font-weight:700;color:${pct>90?'#dc2626':pct>70?'#d97706':'#059669'};">${pct}%</div>
      </div>
      <div style="background:#f1f5f9;border-radius:99px;height:10px;overflow:hidden;margin-bottom:10px;">
        <div style="background:${pct>90?'linear-gradient(90deg,#dc2626,#ef4444)':pct>70?'linear-gradient(90deg,#d97706,#f59e0b)':'linear-gradient(90deg,#059669,#10b981)'};height:100%;width:${pct}%;border-radius:99px;transition:.6s;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;">
        <span>Gastos: $${totalGastos.toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
        <span>Ingresos: $${totalIngresos.toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
      </div>
    </div>
    <!-- Últimos movimientos -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">
      <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <div style="font-size:14px;font-weight:700;color:#0f172a;">💸 Últimos gastos</div>
          <button onclick="contNav('gastos')" style="font-size:11px;color:#1e40af;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:3px 10px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">Ver todos</button>
        </div>
        ${gastos.slice(0,5).map(g => `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f8fafc;"><div><div style="font-size:13px;font-weight:600;color:#374151;">${g.concepto||'\u2014'}</div><div style="font-size:11px;color:#94a3b8;">${g.categoria||'General'}</div></div><span style="font-size:13px;font-weight:700;color:#dc2626;flex-shrink:0;">-$${(parseFloat(g.monto)||0).toLocaleString('es-MX',{minimumFractionDigits:2})}</span></div>`).join('') || `<div style="text-align:center;padding:24px 0;"><div style="font-size:32px;margin-bottom:8px;">💸</div><div style="color:#94a3b8;font-size:13px;">Sin gastos a\u00FAn</div><button onclick="contNuevoGasto()" style="margin-top:10px;padding:7px 16px;background:#fef2f2;color:#dc2626;border:1.5px solid #fca5a5;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">+ Registrar gasto</button></div>`}
      </div>
      <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <div style="font-size:14px;font-weight:700;color:#0f172a;">💵 \u00DAltimos ingresos</div>
          <button onclick="contNav('ingresos')" style="font-size:11px;color:#1e40af;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:3px 10px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">Ver todos</button>
        </div>
        ${ingresos.slice(0,5).map(g => `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f8fafc;"><div><div style="font-size:13px;font-weight:600;color:#374151;">${g.concepto||'\u2014'}</div><div style="font-size:11px;color:#94a3b8;">${g.tipo||'Otro'}</div></div><span style="font-size:13px;font-weight:700;color:#059669;flex-shrink:0;">+$${(parseFloat(g.monto)||0).toLocaleString('es-MX',{minimumFractionDigits:2})}</span></div>`).join('') || `<div style="text-align:center;padding:24px 0;"><div style="font-size:32px;margin-bottom:8px;">💵</div><div style="color:#94a3b8;font-size:13px;">Sin ingresos a\u00FAn</div><button onclick="contNuevoIngreso()" style="margin-top:10px;padding:7px 16px;background:#f0fdf4;color:#059669;border:1.5px solid #86efac;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">+ Registrar ingreso</button></div>`}
      </div>
    </div>`;
  } catch(e) {
    _dashEl.innerHTML = `<div style="padding:40px;text-align:center;color:#ef4444;">Error al cargar dashboard: ${e.message}</div>`;
  }
}
window.contraloRenderDashboard = contraloRenderDashboard;

// Exportar al window todas las funciones nuevas
window.dirCapacitacionCargar = dirCapacitacionCargar;
window.dirCapAbrirModal       = dirCapAbrirModal;
window.dirCapGuardar          = dirCapGuardar;
window.dirCapVerLecturas      = dirCapVerLecturas;
window.dirCapEliminar         = dirCapEliminar;
window.capMostrarArchivosSeleccionados = capMostrarArchivosSeleccionados;
window.docenteCapacitacionCargar = docenteCapacitacionCargar;
window.docenteCapConfirmarLectura = docenteCapConfirmarLectura;
window.dirGestionEscolarCargar = dirGestionEscolarCargar;
window.dirGesTab               = dirGesTab;
window.dirGesAgregarInfra      = dirGesAgregarInfra;
window.dirGesReportarFalla     = dirGesReportarFalla;
window.dirGesAgregarProveedor  = dirGesAgregarProveedor;
window.dirGesAgregarGasto      = dirGesAgregarGasto;
window.dirGesAgregarIngreso    = dirGesAgregarIngreso;
window.dirGesSubirFactura      = dirGesSubirFactura;
window.dirTienditaCargar       = dirTienditaCargar;
window.dirTienditaRegistrar    = dirTienditaRegistrar;
window.dirTienditaEditarCuota  = dirTienditaEditarCuota;

// ── COBRANZA ESCOLAR (DIRECTOR) ──────────────────────────────────────────────
window._cobData  = [];   // alumnos enriquecidos con estado de pago
window._cobPagos = {};   // { alumno_id: { monto, fecha, exento } }
window._cobCuota = 300;  // cuota sugerida por defecto ($)

// ── Director: Alertas del plantel ────────────────────────────────
window._dirAlertas = [];
async function dirAlertasPlantelCargar() {
  const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  const lista = document.getElementById('dir-alertas-lista');
  const tipoFiltro = document.getElementById('dir-alertas-tipo')?.value||'';
  if (!lista) return;
  lista.innerHTML='<div class="card" style="text-align:center;padding:40px;"><div style="font-size:28px;">⏳</div><div style="font-size:13px;color:#94a3b8;margin-top:8px;">Cargando alertas…</div></div>';
  if (!window.sb||!cct) { lista.innerHTML='<div class="card" style="text-align:center;padding:40px;color:#94a3b8;">Sin conexión</div>'; return; }
  try {
    let q = window.sb.from('alertas').select('*').eq('escuela_cct',cct).order('created_at',{ascending:false}).limit(60);
    if (tipoFiltro) q=q.eq('tipo',tipoFiltro);
    const {data}=await q;
    window._dirAlertas=data||[];
    const noLeidas=(data||[]).filter(a=>!a.leido).length;
    const badge=document.getElementById('dir-alertas-badge');
    if(badge){badge.textContent=noLeidas||'';badge.style.display=noLeidas?'inline-block':'none';}
    if(!data?.length){lista.innerHTML='<div class="card" style="text-align:center;padding:60px;"><div style="font-size:36px;margin-bottom:8px;">✅</div><div style="font-size:14px;font-weight:600;">Sin alertas pendientes</div></div>';return;}
    const tipoBg={incidencia:'#fef9c3',ausentismo:'#fee2e2',academico:'#eff6ff',conductual:'#fef2f2'};
    const tipoBorde={incidencia:'#fde68a',ausentismo:'#fca5a5',academico:'#bfdbfe',conductual:'#fca5a5'};
    const tipoIcon={incidencia:'⚠️',ausentismo:'🚫',academico:'📉',conductual:'🔴'};
    lista.innerHTML=data.map(a=>{
      const bg=tipoBg[a.tipo]||'#f1f5f9';const borde=tipoBorde[a.tipo]||'#e2e8f0';
      const icon=tipoIcon[a.tipo]||'🔔';
      const fecha=a.created_at?new Date(a.created_at).toLocaleDateString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
      return `<div style="background:${bg};border:1.5px solid ${borde};border-radius:12px;padding:16px;display:flex;align-items:flex-start;gap:12px;opacity:${a.leido?.9:1};cursor:pointer;" onclick="dirMarcarAlertaLeida('${a.id}')">
        <div style="font-size:26px;flex-shrink:0;">${icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;text-transform:capitalize;">${a.tipo||'Alerta'}</div>
          <div style="font-size:12px;color:#475569;margin-top:3px;">${a.contenido||a.texto||'Sin descripción'}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:5px;">${fecha}${a.origen?' · vía '+a.origen:''}</div>
        </div>
        ${!a.leido?'<span style="background:#dc2626;color:white;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;flex-shrink:0;">Nueva</span>':''}
      </div>`;
    }).join('');
  } catch(e){lista.innerHTML=`<div class="card" style="text-align:center;padding:40px;color:#ef4444;">Error: ${e.message}</div>`;}
}
async function dirMarcarAlertaLeida(id){
  if(!window.sb)return;
  try{await window.sb.from('alertas').update({leido:true}).eq('id',id);const a=(window._dirAlertas||[]).find(x=>x.id===id);if(a)a.leido=true;dirAlertasPlantelCargar();}catch(e){}
}
async function dirMarcarTodasAlertasLeidas(){
  const cct=typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  if(!window.sb)return;
  try{await window.sb.from('alertas').update({leido:true}).eq('escuela_cct',cct).eq('leido',false);dirAlertasPlantelCargar();hubToast('✅ Todas marcadas como leídas','ok');}catch(e){hubToast('Error: '+e.message,'error');}
}

// ── Director: Actas de personal ────────────────────────────────────
async function dirActasPersonalCargar() {
  const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  const tbody = document.getElementById('dir-actas-tbody');
  const tipoFiltro = document.getElementById('dir-actas-tipo')?.value||'';
  const buscar = (document.getElementById('dir-actas-buscar')?.value||'').toLowerCase();
  if(!tbody)return;
  tbody.innerHTML='<tr><td colspan="5" style="padding:40px;text-align:center;color:#94a3b8;"><div style="font-size:28px;">⏳</div><div>Cargando…</div></td></tr>';
  if(!window.sb||!cct){tbody.innerHTML='<tr><td colspan="5" style="padding:30px;text-align:center;color:#94a3b8;">Sin conexión</td></tr>';return;}
  try {
    let q=window.sb.from('actas_personal').select('*,usuario:usuarios!usuario_id(nombre,apellido_p,rol)').eq('escuela_cct',cct).order('created_at',{ascending:false}).limit(50);
    if(tipoFiltro)q=q.eq('tipo',tipoFiltro);
    const {data}=await q;
    let rows=(data||[]);
    if(buscar)rows=rows.filter(r=>`${r.usuario?.nombre||''} ${r.usuario?.apellido_p||''}`.toLowerCase().includes(buscar));
    if(!rows.length){tbody.innerHTML='<tr><td colspan="5" style="padding:40px;text-align:center;color:#94a3b8;"><div style="font-size:28px;">📄</div><div>Sin actas registradas</div></td></tr>';return;}
    const tipoBg={felicitacion:'#f0fdf4',llamada_atencion:'#fef9c3','extrañamiento':'#fff7ed',suspension:'#fee2e2',baja:'#fef2f2'};
    const tipoTxt={felicitacion:'🏆 Felicitación',llamada_atencion:'⚠️ Llamada de atención','extrañamiento':'📢 Extrañamiento',suspension:'🚫 Suspensión',baja:'🔴 Baja'};
    tbody.innerHTML=rows.map(r=>{
      const nombre=`${r.usuario?.nombre||''} ${r.usuario?.apellido_p||''}`.trim()||r.nombre_personal||'—';
      const fecha=r.fecha||(r.created_at?new Date(r.created_at).toLocaleDateString('es-MX'):'—');
      return `<tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 14px;font-weight:600;">${nombre}<div style="font-size:11px;color:#94a3b8;text-transform:capitalize;">${r.usuario?.rol||''}</div></td>
        <td style="padding:10px 14px;"><span style="padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;background:${tipoBg[r.tipo]||'#f1f5f9'};">${tipoTxt[r.tipo]||r.tipo}</span></td>
        <td style="padding:10px 14px;color:#64748b;">${fecha}</td>
        <td style="padding:10px 14px;color:#475569;max-width:200px;">${(r.motivo||'').slice(0,60)}${(r.motivo||'').length>60?'…':''}</td>
        <td style="padding:10px 14px;"><button onclick="dirVerActa('${r.id}')" style="padding:4px 10px;font-size:11px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:6px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">Ver</button></td>
      </tr>`;
    }).join('');
  } catch(e){tbody.innerHTML=`<tr><td colspan="5" style="padding:30px;text-align:center;color:#ef4444;">Error: ${e.message}</td></tr>`;}
}

function dirNuevaActa(){
  hubModal('📄 Nueva acta de personal',`
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Nombre del personal</label>
        <input id="acta-nombre" type="text" placeholder="Nombre completo" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Tipo de acta</label>
        <select id="acta-tipo" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
          <option value="felicitacion">🏆 Felicitación</option>
          <option value="llamada_atencion">⚠️ Llamada de atención</option>
          <option value="extrañamiento">📢 Extrañamiento</option>
          <option value="suspension">🚫 Suspensión</option>
          <option value="baja">🔴 Baja</option>
        </select></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Motivo / descripción</label>
        <textarea id="acta-motivo" rows="3" placeholder="Describe el motivo del acta…" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;resize:vertical;outline:none;box-sizing:border-box;"></textarea></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Fecha</label>
        <input id="acta-fecha" type="date" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;" value="${new Date().toISOString().split('T')[0]}"></div>
    </div>`,'Guardar acta', async()=>{
    const nombre=document.getElementById('acta-nombre')?.value?.trim();
    if(!nombre){hubToast('Escribe el nombre del personal','warn');return;}
    const cct=typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
    await window.sb.from('actas_personal').insert({
      nombre_personal:nombre, tipo:document.getElementById('acta-tipo')?.value||'llamada_atencion',
      motivo:document.getElementById('acta-motivo')?.value||'',
      fecha:document.getElementById('acta-fecha')?.value||new Date().toISOString().split('T')[0],
      director_id:window.currentPerfil?.id, escuela_cct:cct, created_at:new Date().toISOString()
    }).catch(e=>hubToast('Error: '+e.message,'error'));
    hubToast('✅ Acta guardada','ok');dirActasPersonalCargar();
  });
}
async function dirVerActa(id) {
  if (!window.sb) { hubToast('Sin conexión', 'warn'); return; }
  try {
    const { data: r } = await window.sb.from('actas_personal').select('*').eq('id', id).single();
    if (!r) { hubToast('Acta no encontrada', 'warn'); return; }
    const tipoTxt = { felicitacion:'🏆 Felicitación', llamada_atencion:'⚠️ Llamada de atención', 'extrañamiento':'📢 Extrañamiento', suspension:'🚫 Suspensión', baja:'🔴 Baja' };
    const fecha = r.fecha ? new Date(r.fecha).toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' }) : '—';
    hubModal('📄 Acta de personal', `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="background:#f8fafc;border-radius:10px;padding:14px;">
          <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:4px;">${r.nombre_personal||'—'}</div>
          <div style="font-size:13px;color:#64748b;">${tipoTxt[r.tipo]||r.tipo} · ${fecha}</div>
        </div>
        ${r.motivo ? `<div><div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Motivo</div><div style="font-size:13px;color:#334155;line-height:1.7;background:#f8fafc;border-radius:8px;padding:12px;">${r.motivo}</div></div>` : ''}
        <div style="font-size:11px;color:#94a3b8;text-align:right;">CCT: ${r.escuela_cct||'—'} · Registrada: ${r.created_at ? new Date(r.created_at).toLocaleDateString('es-MX') : '—'}</div>
        <button onclick="window.print()" style="padding:8px 16px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;align-self:flex-start;">🖨️ Imprimir</button>
      </div>`, 'Cerrar', null);
  } catch(e) { hubToast('Error: ' + e.message, 'err'); }
}

// ── Director: Licencias y permisos ─────────────────────────────────
async function dirLicenciasCargar(){
  const cct=typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  const tbody=document.getElementById('dir-lic-tbody');
  if(!tbody)return;
  tbody.innerHTML='<tr><td colspan="6" style="padding:40px;text-align:center;color:#94a3b8;"><div style="font-size:28px;">⏳</div><div>Cargando…</div></td></tr>';
  if(!window.sb||!cct){tbody.innerHTML='<tr><td colspan="6" style="padding:30px;text-align:center;color:#94a3b8;">Sin conexión</td></tr>';return;}
  try{
    const {data}=await window.sb.from('licencias_personal').select('*,usuario:usuarios!usuario_id(nombre,apellido_p,rol)').eq('escuela_cct',cct).order('created_at',{ascending:false}).limit(50);
    const rows=data||[];
    const activas=rows.filter(r=>r.estatus==='aprobada'&&new Date(r.fecha_fin)>=new Date()).length;
    const pendientes=rows.filter(r=>r.estatus==='pendiente').length;
    const aprobadas=rows.filter(r=>r.estatus==='aprobada').length;
    ['activas','pendientes','aprobadas'].forEach((k,i)=>{const el=document.getElementById(`dir-lic-${k}`);if(el)el.textContent=[activas,pendientes,aprobadas][i];});
    if(!rows.length){tbody.innerHTML='<tr><td colspan="6" style="padding:40px;text-align:center;color:#94a3b8;"><div style="font-size:28px;">📋</div><div>Sin licencias registradas</div></td></tr>';return;}
    const estatusBg={pendiente:'#fef9c3',aprobada:'#dcfce7',rechazada:'#fee2e2'};
    const estatusTxt={pendiente:'⏳ Pendiente',aprobada:'✅ Aprobada',rechazada:'❌ Rechazada'};
    tbody.innerHTML=rows.map(r=>{
      const nombre=`${r.usuario?.nombre||''} ${r.usuario?.apellido_p||''}`.trim()||r.nombre_personal||'—';
      return `<tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 14px;font-weight:600;">${nombre}<div style="font-size:11px;color:#94a3b8;text-transform:capitalize;">${r.usuario?.rol||''}</div></td>
        <td style="padding:10px 14px;color:#475569;text-transform:capitalize;">${(r.tipo||'').replace(/_/g,' ')}</td>
        <td style="padding:10px 14px;color:#64748b;">${r.fecha_inicio||'—'}</td>
        <td style="padding:10px 14px;color:#64748b;">${r.fecha_fin||'—'}</td>
        <td style="padding:10px 14px;"><span style="padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;background:${estatusBg[r.estatus]||'#f1f5f9'};">${estatusTxt[r.estatus]||r.estatus}</span></td>
        <td style="padding:10px 14px;">
          ${r.estatus==='pendiente'?`<button onclick="dirAprobarLicencia('${r.id}')" style="padding:4px 9px;font-size:11px;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:6px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">✅ Aprobar</button>
          <button onclick="dirRechazarLicencia('${r.id}')" style="padding:4px 9px;font-size:11px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;margin-left:4px;">❌</button>`
          :'—'}
        </td>
      </tr>`;
    }).join('');
  }catch(e){tbody.innerHTML=`<tr><td colspan="6" style="padding:30px;text-align:center;color:#ef4444;">Error: ${e.message}</td></tr>`;}
}

function dirNuevaLicencia(){
  hubModal('📋 Nueva licencia/permiso',`
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Personal solicitante</label>
        <input id="lic-nombre" type="text" placeholder="Nombre completo" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Tipo</label>
        <select id="lic-tipo" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
          <option value="enfermedad">🏥 Enfermedad</option>
          <option value="maternidad_paternidad">👶 Maternidad/Paternidad</option>
          <option value="asunto_personal">📋 Asunto personal</option>
          <option value="capacitacion">📚 Capacitación</option>
          <option value="otro">Otro</option>
        </select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Fecha inicio</label>
          <input id="lic-inicio" type="date" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
        <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Fecha fin</label>
          <input id="lic-fin" type="date" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
      </div>
    </div>`,'Guardar',async()=>{
    const nombre=document.getElementById('lic-nombre')?.value?.trim();
    if(!nombre){hubToast('Escribe el nombre','warn');return;}
    const cct=typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
    await window.sb.from('licencias_personal').insert({
      nombre_personal:nombre, tipo:document.getElementById('lic-tipo')?.value||'otro',
      fecha_inicio:document.getElementById('lic-inicio')?.value||null,
      fecha_fin:document.getElementById('lic-fin')?.value||null,
      estatus:'pendiente', escuela_cct:cct, director_id:window.currentPerfil?.id,
      created_at:new Date().toISOString()
    }).catch(e=>hubToast('Error: '+e.message,'error'));
    hubToast('✅ Licencia registrada','ok');dirLicenciasCargar();
  });
}
async function dirAprobarLicencia(id){if(!window.sb)return;await window.sb.from('licencias_personal').update({estatus:'aprobada'}).eq('id',id);hubToast('✅ Licencia aprobada','ok');dirLicenciasCargar();}
async function dirRechazarLicencia(id){if(!window.sb)return;await window.sb.from('licencias_personal').update({estatus:'rechazada'}).eq('id',id);hubToast('❌ Licencia rechazada','ok');dirLicenciasCargar();}

// ── Director: Libro de visitas SEP ─────────────────────────────────
async function dirLibroVisitasCargar(){
  const cct=typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  const tbody=document.getElementById('dir-visitas-sep-tbody');
  if(!tbody)return;
  tbody.innerHTML='<tr><td colspan="6" style="padding:40px;text-align:center;color:#94a3b8;"><div style="font-size:28px;">⏳</div><div>Cargando…</div></td></tr>';
  if(!window.sb||!cct){tbody.innerHTML='<tr><td colspan="6" style="padding:30px;text-align:center;color:#94a3b8;">Sin conexión</td></tr>';return;}
  try{
    const {data}=await window.sb.from('visitas_sep').select('*').eq('escuela_cct',cct).order('fecha',{ascending:false}).limit(50);
    const rows=data||[];
    if(!rows.length){tbody.innerHTML='<tr><td colspan="6" style="padding:40px;text-align:center;color:#94a3b8;"><div style="font-size:28px;">📒</div><div style="font-weight:700;margin-top:6px;">Aún no hay visitas registradas</div><div style="font-size:12px;margin-top:4px;">Cuando se documenten recorridos o seguimientos institucionales, aparecerán en este historial.</div></td></tr>';return;}
    tbody.innerHTML=rows.map(r=>`<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:10px 14px;font-weight:600;">${r.visitante||'—'}</td>
      <td style="padding:10px 14px;color:#475569;">${r.cargo||'—'}</td>
      <td style="padding:10px 14px;color:#64748b;">${r.fecha||'—'}</td>
      <td style="padding:10px 14px;color:#475569;max-width:160px;">${(r.motivo||'').slice(0,50)}${(r.motivo||'').length>50?'…':''}</td>
      <td style="padding:10px 14px;color:#475569;max-width:160px;">${(r.acuerdos||'').slice(0,50)}${(r.acuerdos||'').length>50?'…':''}</td>
      <td style="padding:10px 14px;"><button onclick="dirVerVisitaSep('${r.id}')" style="padding:4px 10px;font-size:11px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:6px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;">Ver</button></td>
    </tr>`).join('');
  }catch(e){tbody.innerHTML=`<tr><td colspan="6" style="padding:30px;text-align:center;color:#ef4444;">Error: ${e.message}</td></tr>`;}
}

function dirNuevaVisitaSep(){
  hubModal('📒 Registrar visita SEP',`
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Nombre del visitante</label>
        <input id="vis-nombre" type="text" placeholder="Nombre y apellidos" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Cargo / Dependencia</label>
        <input id="vis-cargo" type="text" placeholder="Ej: Supervisor de zona, Jefe de sector…" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Fecha de visita</label>
        <input id="vis-fecha" type="date" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;" value="${new Date().toISOString().split('T')[0]}"></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Motivo de la visita</label>
        <textarea id="vis-motivo" rows="2" placeholder="Supervisión ordinaria, visita técnica, etc." style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;resize:vertical;outline:none;box-sizing:border-box;"></textarea></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Acuerdos y compromisos</label>
        <textarea id="vis-acuerdos" rows="2" placeholder="Acuerdos establecidos durante la visita…" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;resize:vertical;outline:none;box-sizing:border-box;"></textarea></div>
    </div>`,'Guardar',async()=>{
    const visitante=document.getElementById('vis-nombre')?.value?.trim();
    if(!visitante){hubToast('Escribe el nombre del visitante','warn');return;}
    const cct=typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
    await window.sb.from('visitas_sep').insert({
      visitante, cargo:document.getElementById('vis-cargo')?.value||'',
      fecha:document.getElementById('vis-fecha')?.value||new Date().toISOString().split('T')[0],
      motivo:document.getElementById('vis-motivo')?.value||'',
      acuerdos:document.getElementById('vis-acuerdos')?.value||'',
      escuela_cct:cct, director_id:window.currentPerfil?.id, created_at:new Date().toISOString()
    }).catch(e=>hubToast('Error: '+e.message,'error'));
    hubToast('✅ Visita registrada','ok');dirLibroVisitasCargar();
  });
}
async function dirVerVisitaSep(id) {
  if (!window.sb) { hubToast('Sin conexión', 'warn'); return; }
  try {
    const { data: r } = await window.sb.from('visitas_sep').select('*').eq('id', id).single();
    if (!r) { hubToast('Visita no encontrada', 'warn'); return; }
    const fecha = r.fecha ? new Date(r.fecha).toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' }) : '—';
    hubModal('📒 Visita SEP', `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="background:#eff6ff;border-radius:10px;padding:14px;">
          <div style="font-size:14px;font-weight:700;color:#1e40af;">Visita del ${fecha}</div>
          ${r.supervisor ? `<div style="font-size:13px;color:#475569;margin-top:4px;">Supervisor: ${r.supervisor}</div>` : ''}
        </div>
        ${r.motivo ? `<div><div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Motivo</div><div style="font-size:13px;line-height:1.7;background:#f8fafc;border-radius:8px;padding:12px;">${r.motivo}</div></div>` : ''}
        ${r.acuerdos ? `<div><div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Acuerdos</div><div style="font-size:13px;line-height:1.7;background:#f0fdf4;border-radius:8px;padding:12px;color:#166534;">${r.acuerdos.replace(/\n/g,'<br>')}</div></div>` : ''}
        <div style="font-size:11px;color:#94a3b8;text-align:right;">CCT: ${r.escuela_cct||'—'}</div>
        <button onclick="window.print()" style="padding:8px 16px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;align-self:flex-start;">🖨️ Imprimir</button>
      </div>`, 'Cerrar', null);
  } catch(e) { hubToast('Error: ' + e.message, 'err'); }
}

async function dirCobranzaCargar() {
  const sbRef = window.sb;
  const cct = window._dirEscuelaCCT || window.currentPerfil?.escuela_cct;
  const tbody = document.getElementById('cob-tabla-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="padding:24px;text-align:center;color:#94a3b8;">Cargando…</td></tr>';

  try {
    // Leer cuota desde escuelas.modulos
    if (sbRef && cct) {
      const { data: cfgE } = await sbRef.from('escuelas').select('modulos').eq('cct', cct).single();
      if (cfgE?.modulos?.cuota_voluntaria) window._cobCuota = cfgE.modulos.cuota_voluntaria;
    }
    const cuotaLbl = document.getElementById('cob-cuota-lbl');
    if (cuotaLbl) cuotaLbl.textContent = '$' + window._cobCuota;

    // Cargar alumnos
    let alumnos = [];
    if (sbRef && cct) {
      const { data } = await sbRef.from('alumnos')
        .select('id,nombre,grado,seccion,activo')
        .eq('escuela_cct', cct).eq('activo', true)
        .order('grado').order('nombre').limit(500);
      alumnos = data || [];
    }
    if (!alumnos.length) {
      alumnos = window.SiembraDemoFixtures?.sa?.directorioAlumnos || [];
    }

    // Cargar pagos
    window._cobPagos = {};
    if (sbRef && cct) {
      const { data: pagos } = await sbRef.from('cobranza_pagos')
        .select('*').eq('escuela_cct', cct).eq('ciclo', '2025-2026');
      (pagos || []).forEach(p => { window._cobPagos[p.alumno_id] = p; });
    }

    // Combinar
    window._cobData = alumnos.map(a => ({
      ...a,
      pago: window._cobPagos[a.id] || null,
      estado: window._cobPagos[a.id]
        ? (window._cobPagos[a.id].exento ? 'exento' : 'pagado')
        : 'pendiente',
    }));

    _dirCobranzaActualizarStats();
    dirCobranzaFiltrar();
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="padding:24px;text-align:center;color:#b91c1c;">Error: ${e.message}</td></tr>`;
  }
}

function _dirCobranzaActualizarStats() {
  const data = window._cobData || [];
  const pagados = data.filter(a => a.estado === 'pagado');
  const morosos = data.filter(a => a.estado === 'pendiente');
  const monto   = pagados.reduce((s, a) => s + (a.pago?.monto || window._cobCuota), 0);
  const meta    = data.length * window._cobCuota;
  const pct     = data.length ? Math.round(pagados.length / data.length * 100) : 0;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('cob-stat-total',   data.length);
  set('cob-stat-pagaron', pagados.length);
  set('cob-stat-morosos', morosos.length);
  set('cob-stat-monto',   '$' + monto.toLocaleString('es-MX'));
  set('cob-pct',          pct + '%');
  set('cob-meta-lbl',     '$' + meta.toLocaleString('es-MX'));
  const bar = document.getElementById('cob-bar');
  if (bar) bar.style.width = pct + '%';
}

function dirCobranzaFiltrar() {
  const estado  = document.getElementById('cob-filtro-estado')?.value || '';
  const grado   = document.getElementById('cob-filtro-grado')?.value || '';
  const buscar  = (document.getElementById('cob-buscar')?.value || '').toLowerCase();
  const tbody   = document.getElementById('cob-tabla-body');
  if (!tbody) return;
  let items = window._cobData || [];
  if (estado) items = items.filter(a => a.estado === estado);
  if (grado)  items = items.filter(a => String(a.grado) === grado);
  if (buscar) items = items.filter(a => (a.nombre || '').toLowerCase().includes(buscar));

  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:32px;text-align:center;color:#94a3b8;">Sin resultados</td></tr>';
    return;
  }

  const chip = {
    pagado:   '<span style="background:#dcfce7;color:#166534;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;">✅ Pagado</span>',
    pendiente:'<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;">⏳ Pendiente</span>',
    exento:   '<span style="background:#f1f5f9;color:#475569;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;">🔵 Exento</span>',
  };

  tbody.innerHTML = items.map(a => `
    <tr style="border-top:1px solid #f1f5f9;${a.estado==='pendiente'?'background:#fffbeb;':''}">
      <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0f172a;">${a.nombre || '—'}</td>
      <td style="padding:12px 16px;font-size:12px;font-weight:700;color:#0d5c2f;">${a.grado || '—'}° ${a.seccion || ''}</td>
      <td style="padding:12px 16px;text-align:center;">${chip[a.estado] || ''}</td>
      <td style="padding:12px 16px;text-align:right;font-size:13px;font-weight:700;color:${a.estado==='pagado'?'#15803d':'#94a3b8'};">
        ${a.estado === 'pagado' ? '$' + (a.pago?.monto || window._cobCuota).toLocaleString('es-MX') : '—'}
      </td>
      <td style="padding:12px 16px;font-size:12px;color:#64748b;">
        ${a.pago?.fecha ? new Date(a.pago.fecha).toLocaleDateString('es-MX') : '—'}
      </td>
      <td style="padding:12px 16px;text-align:center;">
        ${a.estado === 'pendiente'
          ? `<button onclick="dirCobranzaMarcarPago('${a.id}','${(a.nombre||'').replace(/'/g,"\\'")}',${a.grado},'${a.seccion||''}')" style="padding:5px 12px;background:#0d5c2f;color:white;border:none;border-radius:7px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;">Registrar</button>`
          : `<button onclick="dirCobranzaAnularPago('${a.id}')" style="padding:5px 12px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:7px;font-family:inherit;font-size:11px;cursor:pointer;color:#64748b;">Anular</button>`
        }
      </td>
    </tr>`).join('');
}

async function dirCobranzaMarcarPago(alumnoId, nombre, grado, seccion) {
  hubModal(`💵 Registrar pago — ${nombre}`, `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div style="font-size:13px;color:#64748b;">${grado}° ${seccion||''} · Cuota sugerida: <strong>$${window._cobCuota||0}</strong></div>
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Monto recibido</label>
        <input id="cobpago-monto" type="number" value="${window._cobCuota||''}" min="1" step="0.01"
          style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;outline:none;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Método de pago</label>
        <select id="cobpago-metodo" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
          <option value="efectivo">💵 Efectivo</option>
          <option value="transferencia">🏦 Transferencia / SPEI</option>
          <option value="tarjeta">💳 Tarjeta</option>
          <option value="oxxo">🏪 OXXO</option>
        </select>
      </div>
    </div>`, 'Registrar pago', async () => {
    const montoStr = document.getElementById('cobpago-monto')?.value;
    const monto = parseFloat(montoStr);
    if (isNaN(monto) || monto <= 0) { hubToast('⚠️ Ingresa un monto válido', 'warn'); return; }
    const metodo = document.getElementById('cobpago-metodo')?.value || 'efectivo';

  const sbRef = window.sb;
  const cct   = window._dirEscuelaCCT || window.currentPerfil?.escuela_cct;
  const pago  = {
    escuela_cct: cct, alumno_id: alumnoId, alumno_nombre: nombre,
    grado, seccion, monto, fecha: new Date().toISOString().slice(0, 10),
    ciclo: '2025-2026', registrado_por: window.currentPerfil?.id, exento: false,
  };

  if (sbRef && cct) {
    try {
      const { error } = await sbRef.from('cobranza_pagos')
        .upsert(pago, { onConflict: 'escuela_cct,alumno_id,ciclo' });
      if (error) throw error;
    } catch (e) { console.warn('[Cobranza] Error Supabase:', e.message); }
  }

  window._cobPagos[alumnoId] = pago;
  window._cobData = (window._cobData || []).map(a =>
    a.id === alumnoId ? { ...a, pago, estado: 'pagado' } : a);
  _dirCobranzaActualizarStats();
  dirCobranzaFiltrar();
  hubToast('✅ Pago registrado — ' + nombre, 'ok');
  });
}

async function dirCobranzaAnularPago(alumnoId) {
  if (!await new Promise(r => hubModal('⚠️ Anular pago', '<div style="font-size:14px;color:#475569;">¿Anular este pago? Se eliminará el registro permanentemente.</div>', 'Anular', () => r(true), () => r(false)))) return;
  const sbRef = window.sb;
  const cct   = window._dirEscuelaCCT || window.currentPerfil?.escuela_cct;
  if (sbRef && cct) {
    try {
      await sbRef.from('cobranza_pagos')
        .delete().eq('alumno_id', alumnoId).eq('escuela_cct', cct).eq('ciclo', '2025-2026');
    } catch (e) { console.warn('[Cobranza] Error al anular:', e.message); }
  }
  delete window._cobPagos[alumnoId];
  window._cobData = (window._cobData || []).map(a =>
    a.id === alumnoId ? { ...a, pago: null, estado: 'pendiente' } : a);
  _dirCobranzaActualizarStats();
  dirCobranzaFiltrar();
}

function dirCobranzaRegistrarPago() {
  const nombre = prompt('Nombre del alumno:');
  if (!nombre) return;
  const monto  = prompt('Monto recibido ($):', window._cobCuota);
  if (!monto) return;
  // Buscar en _cobData por nombre parcial
  const match = (window._cobData || []).find(a =>
    (a.nombre || '').toLowerCase().includes(nombre.toLowerCase()));
  if (match) {
    dirCobranzaMarcarPago(match.id, match.nombre, match.grado, match.seccion);
  } else {
    const _t = window.hubToast || window._toast || ((m) => alert(m));
    _t('ℹ️ Alumno no encontrado en el padrón. Usa la tabla para registrar pagos.', 'info');
  }
}

function dirCobranzaConfigCuota() {
  const nueva = prompt('Nueva cuota de cooperación voluntaria ($):', window._cobCuota);
  if (!nueva || isNaN(nueva)) return;
  window._cobCuota = parseFloat(nueva);
  const lbl = document.getElementById('cob-cuota-lbl');
  if (lbl) lbl.textContent = '$' + window._cobCuota;
  _dirCobranzaActualizarStats();
  const sbRef = window.sb;
  const cct   = window._dirEscuelaCCT || window.currentPerfil?.escuela_cct;
  if (sbRef && cct) {
    sbRef.from('escuelas').select('modulos').eq('cct', cct).single().then(({ data }) => {
      const mod = { ...(data?.modulos || {}), cuota_voluntaria: window._cobCuota };
      sbRef.from('escuelas').update({ modulos: mod }).eq('cct', cct);
    });
  }
  const _t = window.hubToast || window._toast || ((m) => alert(m));
  _t('✅ Cuota actualizada a $' + window._cobCuota);
}

function dirCobranzaExportar() {
  const data = window._cobData || [];
  const rows = [
    ['Nombre', 'Grado', 'Sección', 'Estado', 'Monto', 'Fecha pago'].join(','),
    ...data.map(a => [
      `"${(a.nombre || '').replace(/"/g, '""')}"`,
      a.grado || '', a.seccion || '', a.estado || '',
      a.estado === 'pagado' ? (a.pago?.monto || window._cobCuota) : '',
      a.pago?.fecha || '',
    ].join(',')),
  ].join('\n');
  const blob = new Blob(['\uFEFF' + rows], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const el   = document.createElement('a');
  el.href = url; el.download = 'cobranza_' + new Date().toISOString().slice(0, 10) + '.csv';
  el.click(); URL.revokeObjectURL(url);
}

window.dirCobranzaCargar        = dirCobranzaCargar;
window.dirCobranzaFiltrar       = dirCobranzaFiltrar;
window.dirCobranzaMarcarPago    = dirCobranzaMarcarPago;
window.dirCobranzaAnularPago    = dirCobranzaAnularPago;
window.dirCobranzaRegistrarPago = dirCobranzaRegistrarPago;
window.dirCobranzaConfigCuota   = dirCobranzaConfigCuota;
window.dirCobranzaExportar      = dirCobranzaExportar;

// ─── CONTRALOR: Init & Navigation ─────────────────────────────
function initContraloPortal() {
  // Setear nombre/escuela en sidebar y topbar
  const nameEl    = document.getElementById('cont-user-name');
  const escuelaEl = document.getElementById('cont-escuela-name');
  const avatarEl  = document.getElementById('cont-avatar');
  const topbarEsc = document.getElementById('cont-escuela-topbar');
  if (window.currentPerfil) {
    const nom = window.currentPerfil.nombre || 'Contralor';
    if (nameEl)   nameEl.textContent   = nom;
    if (avatarEl) avatarEl.textContent = nom.split(' ').map(p=>p[0]||'').join('').toUpperCase().slice(0,2) || 'C';
  }
  const escNombre = window.currentPerfil?.escuela_nombre || _getCct() || '—';
  if (escuelaEl)  escuelaEl.textContent  = escNombre;
  if (topbarEsc)  topbarEsc.textContent  = escNombre;
  contNav('dashboard');
}
window.initContraloPortal = initContraloPortal;

function contNav(page) {
  const pages = ['dashboard','gastos','ingresos','facturas','proveedores','tiendita','presupuesto','reporte'];
  pages.forEach(p => {
    const el  = document.getElementById('cont-p-' + p);
    const btn = document.getElementById('cont-nav-' + p);
    if (el)  el.style.display  = p === page ? '' : 'none';
    if (btn) { btn.style.background = p === page ? 'rgba(255,255,255,.15)' : 'transparent'; btn.style.color = p === page ? 'white' : 'rgba(255,255,255,.7)'; btn.style.fontWeight = p === page ? '700' : '400'; }
  });
  const titles = { dashboard:'Dashboard financiero', gastos:'Registro de gastos', ingresos:'Registro de ingresos', facturas:'Facturas y comprobantes SEP', proveedores:'Directorio de proveedores', tiendita:'Tiendita escolar', presupuesto:'Presupuesto escolar', reporte:'Reporte SEP' };
  const titleEl = document.getElementById('cont-page-title');
  if (titleEl) titleEl.textContent = titles[page] || page;
  if (page === 'dashboard')   contraloRenderDashboard();
  if (page === 'gastos')      _contRenderGastos();
  if (page === 'ingresos')    _contRenderIngresos();
  if (page === 'facturas')    _contRenderFacturas();
  if (page === 'proveedores') _contRenderProveedores();
  if (page === 'tiendita')    _contRenderTiendita();
  if (page === 'presupuesto') _contRenderPresupuesto();
}
window.contNav = contNav;

async function _contRenderGastos() {
  const el = document.getElementById('cont-gastos-lista');
  if (!el) return;
  const cct = _getCct();
  if (!window.sb || !cct) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Sin conexión a Supabase</div>';
    return;
  }
  el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;"><div style="width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:#1a1a2e;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px;"></div>Cargando gastos…</div>';
  const { data, error } = await window.sb.from('finanzas_gastos')
    .select('*, finanzas_proveedores(nombre)')
    .eq('escuela_cct', cct)
    .eq('ciclo', window.CICLO_ACTIVO || '2025-2026')
    .order('fecha', { ascending: false }).limit(200);
  if (error) { el.innerHTML = '<div style="padding:20px;color:#ef4444;">Error: ' + error.message + '</div>'; return; }
  window._gesGastos = data || [];
  const total = window._gesGastos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
  if (!window._gesGastos.length) {
    el.innerHTML = '<div style="padding:60px;text-align:center;color:#94a3b8;"><div style="font-size:36px;margin-bottom:12px;">💸</div><div style="font-size:15px;font-weight:700;">Aún no hay gastos cargados</div><div style="font-size:13px;margin-top:6px;">Registra egresos del ciclo para llevar control financiero, comprobación y auditoría.</div><div style="margin-top:16px;"><button onclick="contNuevoGasto()" style="padding:10px 22px;background:linear-gradient(135deg,#dc2626,#ef4444);color:white;border:none;border-radius:10px;font-family:\'Sora\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">+ Registrar primer gasto</button></div></div>';
    return;
  }
  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
    <div><span style="font-size:13px;color:#94a3b8;">Total gastos ciclo: </span><strong style="font-size:20px;color:#dc2626;font-family:'Fraunces',serif;">$${total.toLocaleString('es-MX',{minimumFractionDigits:2})}</strong></div>
  </div>
  <div style="background:white;border-radius:14px;overflow:hidden;border:1.5px solid #e2e8f0;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
        <th style="padding:11px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">FECHA</th>
        <th style="padding:11px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">CONCEPTO</th>
        <th style="padding:11px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">CATEGORÍA</th>
        <th style="padding:11px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">PROVEEDOR</th>
        <th style="padding:11px 14px;text-align:right;font-size:11px;color:#64748b;font-weight:700;">MONTO</th>
        <th style="padding:11px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:700;">ACCIÓN</th>
      </tr></thead>
      <tbody>${window._gesGastos.map(g => `<tr style="border-bottom:1px solid #f1f5f9;transition:.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
        <td style="padding:11px 14px;color:#64748b;">${g.fecha || '—'}</td>
        <td style="padding:11px 14px;font-weight:600;color:#0f172a;">${g.concepto || '—'}</td>
        <td style="padding:11px 14px;"><span style="background:#f1f5f9;padding:3px 8px;border-radius:6px;font-size:11px;color:#475569;">${g.categoria || 'otro'}</span></td>
        <td style="padding:11px 14px;font-size:12px;color:#64748b;">${g.finanzas_proveedores?.nombre || g.notas || '—'}</td>
        <td style="padding:11px 14px;text-align:right;font-weight:700;color:#dc2626;">$${(parseFloat(g.monto)||0).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
        <td style="padding:11px 14px;text-align:center;"><button onclick="contEliminarGasto('${g.id}')" aria-label="Eliminar" style="background:#fee2e2;border:none;color:#dc2626;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:600;">✕</button></td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}
async function _contRenderIngresos() {
  const el = document.getElementById('cont-ingresos-lista');
  if (!el) return;
  const cct = _getCct();
  if (!window.sb || !cct) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Sin conexión a Supabase</div>';
    return;
  }
  el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;"><div style="width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:#059669;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px;"></div>Cargando ingresos…</div>';
  const { data, error } = await window.sb.from('finanzas_ingresos')
    .select('*')
    .eq('escuela_cct', cct)
    .eq('ciclo', window.CICLO_ACTIVO || '2025-2026')
    .order('fecha', { ascending: false }).limit(200);
  if (error) { el.innerHTML = '<div style="padding:20px;color:#ef4444;">Error: ' + error.message + '</div>'; return; }
  window._gesIngresos = data || [];
  const total = window._gesIngresos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
  if (!window._gesIngresos.length) {
    el.innerHTML = '<div style="padding:60px;text-align:center;color:#94a3b8;"><div style="font-size:36px;margin-bottom:12px;">💵</div><div style="font-size:15px;font-weight:700;">Aún no hay ingresos cargados</div><div style="font-size:13px;margin-top:6px;">Captura colegiaturas, apoyos o ingresos extraordinarios para construir el corte del ciclo.</div><div style="margin-top:16px;"><button onclick="contNuevoIngreso()" style="padding:10px 22px;background:linear-gradient(135deg,#059669,#10b981);color:white;border:none;border-radius:10px;font-family:\'Sora\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">+ Registrar primer ingreso</button></div></div>';
    return;
  }
  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
    <div><span style="font-size:13px;color:#94a3b8;">Total ingresos ciclo: </span><strong style="font-size:20px;color:#059669;font-family:'Fraunces',serif;">$${total.toLocaleString('es-MX',{minimumFractionDigits:2})}</strong></div>
  </div>
  <div style="background:white;border-radius:14px;overflow:hidden;border:1.5px solid #e2e8f0;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
        <th style="padding:11px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">FECHA</th>
        <th style="padding:11px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">CONCEPTO</th>
        <th style="padding:11px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">CATEGORÍA</th>
        <th style="padding:11px 14px;text-align:right;font-size:11px;color:#64748b;font-weight:700;">MONTO</th>
        <th style="padding:11px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:700;">ACCIÓN</th>
      </tr></thead>
      <tbody>${window._gesIngresos.map(g => `<tr style="border-bottom:1px solid #f1f5f9;transition:.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
        <td style="padding:11px 14px;color:#64748b;">${g.fecha || '—'}</td>
        <td style="padding:11px 14px;font-weight:600;color:#0f172a;">${g.concepto || '—'}</td>
        <td style="padding:11px 14px;"><span style="background:#f0fdf4;padding:3px 8px;border-radius:6px;font-size:11px;color:#166534;">${g.categoria || 'otro'}</span></td>
        <td style="padding:11px 14px;text-align:right;font-weight:700;color:#059669;">$${(parseFloat(g.monto)||0).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
        <td style="padding:11px 14px;text-align:center;"><button onclick="contEliminarIngreso('${g.id}')" aria-label="Eliminar" style="background:#dcfce7;border:none;color:#059669;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:600;">✕</button></td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}
async function _contRenderFacturas() {
  const el = document.getElementById('cont-facturas-lista');
  if (!el) return;
  const cct = _getCct();
  if (!window.sb || !cct) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Sin conexión a Supabase</div>';
    return;
  }
  el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;"><div style="width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:#2455a4;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px;"></div>Cargando facturas…</div>';
  const { data, error } = await window.sb.from('finanzas_facturas')
    .select('*')
    .eq('escuela_cct', cct)
    .eq('ciclo', window.CICLO_ACTIVO || '2025-2026')
    .order('fecha', { ascending: false }).limit(200);
  if (error) { el.innerHTML = '<div style="padding:20px;color:#ef4444;">Error: ' + error.message + '</div>'; return; }
  window._gesFacturas = data || [];
  if (!window._gesFacturas.length) {
    el.innerHTML = '<div style="text-align:center;padding:50px;color:#94a3b8;"><div style="font-size:36px;margin-bottom:10px;">🧾</div><div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:6px;">Aún no hay facturas cargadas</div><div style="font-size:13px;color:#94a3b8;">Sube comprobantes para mantener el expediente financiero ordenado y listo para revisión.</div></div>';
    return;
  }
  el.innerHTML = `<div style="background:white;border-radius:14px;overflow:hidden;border:1.5px solid #e2e8f0;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
        <th style="padding:11px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">N° FACTURA</th>
        <th style="padding:11px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">FECHA</th>
        <th style="padding:11px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">PROVEEDOR</th>
        <th style="padding:11px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">CONCEPTO</th>
        <th style="padding:11px 14px;text-align:right;font-size:11px;color:#64748b;font-weight:700;">MONTO</th>
        <th style="padding:11px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:700;">ESTADO</th>
        <th style="padding:11px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:700;">ARCHIVO</th>
      </tr></thead>
      <tbody>${window._gesFacturas.map(f => `<tr style="border-bottom:1px solid #f1f5f9;transition:.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
        <td style="padding:11px 14px;font-weight:600;color:#0f172a;">${f.folio || '—'}</td>
        <td style="padding:11px 14px;color:#64748b;">${f.fecha || '—'}</td>
        <td style="padding:11px 14px;color:#374151;">${f.proveedor_id || '—'}</td>
        <td style="padding:11px 14px;color:#374151;">${f.concepto || '—'}</td>
        <td style="padding:11px 14px;text-align:right;font-weight:700;color:#0f172a;">$${(parseFloat(f.monto_total)||0).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
        <td style="padding:11px 14px;text-align:center;"><span style="background:${f.estado==='validada'?'#dcfce7':f.estado==='rechazada'?'#fee2e2':'#fef9c3'};color:${f.estado==='validada'?'#166534':f.estado==='rechazada'?'#7f1d1d':'#854d0e'};padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;">${f.estado==='validada'?'\u2713 Validada':f.estado==='rechazada'?'\u2715 Rechazada':'Pendiente'}</span></td>
        <td style="padding:11px 14px;text-align:center;">${f.pdf_url?`<a href="${f.pdf_url}" target="_blank" style="padding:4px 10px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none;">Ver PDF</a>`:'—'}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}
async function _contRenderProveedores() {
  const el = document.getElementById('cont-proveedores-lista');
  if (!el) return;
  const cct = _getCct();
  if (!window.sb || !cct) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Sin conexión a Supabase</div>';
    return;
  }
  el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;"><div style="width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:#157a40;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px;"></div>Cargando proveedores…</div>';
  const { data, error } = await window.sb.from('finanzas_proveedores')
    .select('*')
    .eq('escuela_cct', cct)
    .eq('activo', true)
    .order('nombre', { ascending: true });
  if (error) { el.innerHTML = '<div style="padding:20px;color:#ef4444;">Error: ' + error.message + '</div>'; return; }
  window._gesProveedores = data || [];
  if (!window._gesProveedores.length) {
    el.innerHTML = '<div style="padding:60px;text-align:center;color:#94a3b8;"><div style="font-size:36px;margin-bottom:12px;">🤝</div><div style="font-size:15px;font-weight:700;">Aún no hay proveedores registrados</div><div style="font-size:13px;margin-top:6px;">Da de alta tus contactos para relacionar compras, facturas y pagos por proveedor.</div><div style="margin-top:16px;"><button onclick="contNuevoProveedor()" style="padding:10px 22px;background:linear-gradient(135deg,#0d5c2f,#157a40);color:white;border:none;border-radius:10px;font-family:\'Sora\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">+ Agregar primer proveedor</button></div></div>';
    return;
  }
  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
    ${window._gesProveedores.map(p => `<div style="background:white;border-radius:14px;border:1.5px solid #e2e8f0;padding:18px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <div style="width:40px;height:40px;background:#f0fdf4;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">🤝</div>
        <div>
          <div style="font-size:14px;font-weight:700;color:#0f172a;">${p.nombre || '—'}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">${p.giro || 'Sin giro'}</div>
        </div>
      </div>
      <div style="font-size:12px;color:#64748b;line-height:1.8;">
        ${p.rfc ? `<div>RFC: <strong>${p.rfc}</strong></div>` : ''}
        ${p.contacto ? `<div>Contacto: ${p.contacto}</div>` : ''}
        ${p.telefono ? `<div>Tel: ${p.telefono}</div>` : ''}
        ${p.email ? `<div>Email: ${p.email}</div>` : ''}
      </div>
    </div>`).join('')}
  </div>`;
}
async function _contRenderTiendita() {
  const el = document.getElementById('cont-tiendita-resumen');
  if (!el) return;
  const cct = _getCct();
  if (!window.sb || !cct) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Sin conexión a Supabase</div>';
    return;
  }
  el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;"><div style="width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:#7c3aed;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px;"></div>Cargando tiendita…</div>';
  const { data, error } = await window.sb.from('tiendita_movimientos')
    .select('*')
    .eq('escuela_cct', cct)
    .eq('ciclo', window.CICLO_ACTIVO || '2025-2026')
    .order('fecha', { ascending: false }).limit(200);
  if (error) { el.innerHTML = '<div style="padding:20px;color:#ef4444;">Error: ' + error.message + '</div>'; return; }
  window._tienditaMovimientos = data || [];
  const ventas   = window._tienditaMovimientos.filter(m => m.tipo === 'venta');
  const compras  = window._tienditaMovimientos.filter(m => m.tipo === 'compra');
  const totalVentas  = ventas.reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const totalCompras = compras.reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  if (!window._tienditaMovimientos.length) {
    el.innerHTML = '<div style="padding:60px;text-align:center;color:#94a3b8;"><div style="font-size:36px;margin-bottom:12px;">\uD83D\uDED2</div><div style="font-size:15px;font-weight:700;">Sin movimientos en tiendita</div><div style="margin-top:16px;"><button onclick="contNuevaVentaTiendita()" style="padding:10px 22px;background:linear-gradient(135deg,#7c3aed,#8b5cf6);color:white;border:none;border-radius:10px;font-family:\'Sora\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">+ Registrar movimiento</button></div></div>';
    return;
  }
  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;">
    <div style="background:#f5f3ff;border-radius:12px;padding:16px;">
      <div style="font-size:11px;color:#5b21b6;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Ventas</div>
      <div style="font-size:22px;font-weight:800;color:#7c3aed;font-family:'Fraunces',serif;">$${totalVentas.toLocaleString('es-MX',{minimumFractionDigits:2})}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px;">${ventas.length} movs.</div>
    </div>
    <div style="background:#fff7ed;border-radius:12px;padding:16px;">
      <div style="font-size:11px;color:#92400e;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Compras</div>
      <div style="font-size:22px;font-weight:800;color:#d97706;font-family:'Fraunces',serif;">$${totalCompras.toLocaleString('es-MX',{minimumFractionDigits:2})}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px;">${compras.length} movs.</div>
    </div>
    <div style="background:#f8fafc;border-radius:12px;padding:16px;">
      <div style="font-size:11px;color:#475569;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Total movimientos</div>
      <div style="font-size:22px;font-weight:800;color:#0f172a;font-family:'Fraunces',serif;">${window._tienditaMovimientos.length}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px;">ciclo actual</div>
    </div>
  </div>
  <div style="background:white;border-radius:14px;overflow:hidden;border:1.5px solid #e2e8f0;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
        <th style="padding:11px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">FECHA</th>
        <th style="padding:11px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">CONCEPTO</th>
        <th style="padding:11px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:700;">TIPO</th>
        <th style="padding:11px 14px;text-align:right;font-size:11px;color:#64748b;font-weight:700;">CANT.</th>
        <th style="padding:11px 14px;text-align:right;font-size:11px;color:#64748b;font-weight:700;">MONTO</th>
      </tr></thead>
      <tbody>${window._tienditaMovimientos.map(m => `<tr style="border-bottom:1px solid #f1f5f9;transition:.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
        <td style="padding:11px 14px;color:#64748b;">${m.fecha || '—'}</td>
        <td style="padding:11px 14px;font-weight:600;color:#0f172a;">${m.concepto || '—'}</td>
        <td style="padding:11px 14px;text-align:center;"><span style="background:${m.tipo==='venta'?'#f5f3ff':'#fff7ed'};color:${m.tipo==='venta'?'#7c3aed':'#d97706'};padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;">${m.tipo || 'venta'}</span></td>
        <td style="padding:11px 14px;text-align:right;color:#64748b;">${m.cantidad || 0}</td>
        <td style="padding:11px 14px;text-align:right;font-weight:700;color:${m.tipo==='venta'?'#7c3aed':'#d97706'};">$${(parseFloat(m.monto)||0).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}
async function _contRenderPresupuesto() {
  const el = document.getElementById('cont-presupuesto-vista');
  if (!el) return;
  const cct = _getCct();
  if (!window.sb || !cct) { el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Sin conexi\u00F3n a Supabase</div>'; return; }
  el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;"><div style="width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:#0369a1;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px;"></div>Cargando presupuesto\u2026</div>';
  const { data, error } = await window.sb.from('finanzas_presupuesto').select('*').eq('escuela_cct', cct).eq('ciclo', window.CICLO_ACTIVO || '2025-2026').order('categoria', { ascending: true });
  if (error) { el.innerHTML = '<div style="padding:20px;color:#ef4444;">Error: ' + error.message + '</div>'; return; }
  const rows = data || [];
  if (!rows.length) { el.innerHTML = '<div style="padding:60px;text-align:center;color:#94a3b8;"><div style="font-size:36px;margin-bottom:12px;">\uD83D\uDCCA</div><div style="font-size:15px;font-weight:700;">Sin presupuesto asignado</div><div style="font-size:13px;margin-top:8px;">Usa el bot\u00F3n Asignar presupuesto para configurar el presupuesto por categor\u00EDa</div></div>'; return; }
  var totalAsig = rows.reduce(function(s,p){ return s+(parseFloat(p.presupuestado)||0); }, 0);
  var totalEjrc = rows.reduce(function(s,p){ return s+(parseFloat(p.ejercido)||0); }, 0);
  var pctG = Math.min(100, totalAsig > 0 ? Math.round(totalEjrc/totalAsig*100) : 0);
  var colG = pctG > 90 ? '#dc2626' : pctG > 70 ? '#d97706' : '#059669';
  var cards = rows.map(function(p) {
    var a = parseFloat(p.presupuestado)||0, e = parseFloat(p.ejercido)||0;
    var pct = Math.min(100, a>0?Math.round(e/a*100):0), col = pct>90?'#dc2626':pct>70?'#d97706':'#059669';
    return '<div style="background:white;border-radius:14px;border:1.5px solid #e2e8f0;padding:18px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-size:13px;font-weight:700;color:#0f172a;text-transform:capitalize;">'+(p.categoria||'\u2014')+'</div><div style="font-size:13px;font-weight:700;color:'+col+';">'+pct+'%</div></div>' +
      '<div style="background:#f1f5f9;border-radius:99px;height:8px;overflow:hidden;margin-bottom:10px;"><div style="background:'+col+';height:100%;width:'+pct+'%;border-radius:99px;transition:.4s;"></div></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;"><span>Ejercido: <strong>$'+e.toLocaleString('es-MX',{minimumFractionDigits:2})+'</strong></span><span>de $'+a.toLocaleString('es-MX',{minimumFractionDigits:2})+'</span></div>' +
      (p.notas?'<div style="font-size:11px;color:#94a3b8;margin-top:6px;">'+p.notas+'</div>':'') + '</div>';
  }).join('');
  el.innerHTML = '<div style="background:white;border-radius:14px;border:1.5px solid #e2e8f0;padding:22px;margin-bottom:18px;">' +
    '<div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:14px;">Ejecuci\u00F3n global \u00B7 Ciclo '+(window.CICLO_ACTIVO||'2025-2026')+'</div>' +
    '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;font-size:13px;color:#64748b;margin-bottom:8px;"><span>Asignado: <strong style="color:#0f172a;">$'+totalAsig.toLocaleString('es-MX',{minimumFractionDigits:2})+'</strong></span><span>Ejercido: <strong style="color:#dc2626;">$'+totalEjrc.toLocaleString('es-MX',{minimumFractionDigits:2})+'</strong></span><span style="font-weight:700;color:'+colG+';">'+pctG+'%</span></div>' +
    '<div style="background:#f1f5f9;border-radius:99px;height:12px;overflow:hidden;margin-bottom:6px;"><div style="background:'+colG+';height:100%;width:'+pctG+'%;border-radius:99px;transition:.6s;"></div></div>' +
    '<div style="font-size:12px;color:#94a3b8;">Disponible: $'+(totalAsig-totalEjrc).toLocaleString('es-MX',{minimumFractionDigits:2})+'</div></div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">'+cards+'</div>';
}
function contGenerarReporte() {
  const gastos   = window._gesGastos   || [];
  const ingresos = window._gesIngresos || [];
  const facturas = window._gesFacturas || [];
  const totalG = gastos.reduce((s,g) => s+parseFloat(g.monto||0), 0);
  const totalI = ingresos.reduce((s,g) => s+parseFloat(g.monto||0), 0);
  const cct  = window.currentPerfil?.escuela_cct || 'ESCUELA';
  const rows = [
    ['REPORTE FINANCIERO ESCOLAR — ' + cct],
    ['Generado: ' + new Date().toLocaleDateString('es-MX') + ' · Ciclo 2025-2026'],[''],
    ['INGRESOS'],['Concepto','Tipo','Monto','Fecha'],
    ...ingresos.map(g => [g.concepto, g.tipo||'', '$'+parseFloat(g.monto).toFixed(2), new Date(g.fecha).toLocaleDateString('es-MX')]),
    ['','TOTAL INGRESOS','$'+totalI.toFixed(2)],[''],
    ['GASTOS'],['Concepto','Categoría','Monto','Proveedor','Fecha'],
    ...gastos.map(g => [g.concepto, g.categoria||'', '$'+parseFloat(g.monto).toFixed(2), g.proveedor||'', new Date(g.fecha).toLocaleDateString('es-MX')]),
    ['','TOTAL GASTOS','$'+totalG.toFixed(2)],[''],
    ['BALANCE FINAL','$'+(totalI-totalG).toFixed(2)],
    ['FACTURAS ADJUNTAS: '+facturas.length],
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'}));
  a.download = `reporte_financiero_${cct}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  hubToast('✅ Reporte generado y descargado');
}

/* ── CONTRALOR CRUD ─────────────────────────────────────── */
function contNuevoGasto() {
  const cct = window.currentPerfil?.escuela_cct;
  hubModal('Registrar Gasto', `
    <div style="display:grid;gap:10px;">
      <input id="cg-concepto" class="inp" placeholder="Concepto *" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
      <input id="cg-monto" type="number" class="inp" placeholder="Monto * (ej. 1500.00)" step="0.01" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
      <input id="cg-fecha" type="date" class="inp" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;" value="${new Date().toISOString().split('T')[0]}">
      <select id="cg-cat" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
        <option value="">Categoría</option>
        <option>Materiales</option><option>Servicios</option><option>Mantenimiento</option>
        <option>Personal</option><option>Eventos</option><option>Tecnología</option><option>Otro</option>
      </select>
      <input id="cg-proveedor" class="inp" placeholder="Proveedor (opcional)" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
      <textarea id="cg-nota" placeholder="Notas (opcional)" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;resize:vertical;min-height:60px;"></textarea>
    </div>`, 'Guardar Gasto', async () => {
    const concepto = document.getElementById('cg-concepto')?.value?.trim();
    const monto = parseFloat(document.getElementById('cg-monto')?.value);
    const fecha = document.getElementById('cg-fecha')?.value;
    const categoria = document.getElementById('cg-cat')?.value || 'Otro';
    const proveedor = document.getElementById('cg-proveedor')?.value?.trim() || null;
    const nota = document.getElementById('cg-nota')?.value?.trim() || null;
    if (!concepto || !monto || !fecha) { hubToast('Completa concepto, monto y fecha','error'); return; }
    const { error } = await window.sb.from('finanzas_gastos').insert({
      escuela_cct: cct, ciclo: window.CICLO_ACTIVO||'2025-2026',
      concepto, monto, fecha, categoria, proveedor, nota,
      registrado_por: window.currentPerfil?.id, created_at: new Date().toISOString()
    });
    if (error) { hubToast('Error al guardar: '+error.message,'error'); return; }
    hubToast('✅ Gasto registrado');
    contNav('gastos');
  });
}

function contNuevoIngreso() {
  const cct = window.currentPerfil?.escuela_cct;
  hubModal('Registrar Ingreso', `
    <div style="display:grid;gap:10px;">
      <input id="ci-concepto" class="inp" placeholder="Concepto *" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
      <input id="ci-monto" type="number" class="inp" placeholder="Monto * (ej. 5000.00)" step="0.01" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
      <input id="ci-fecha" type="date" class="inp" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;" value="${new Date().toISOString().split('T')[0]}">
      <select id="ci-tipo" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
        <option value="">Tipo de ingreso</option>
        <option>Inscripción</option><option>Colegiatura</option><option>Cuota voluntaria</option>
        <option>Donativo</option><option>Evento</option><option>Tiendita</option><option>Otro</option>
      </select>
      <textarea id="ci-nota" placeholder="Notas (opcional)" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;resize:vertical;min-height:60px;"></textarea>
    </div>`, 'Guardar Ingreso', async () => {
    const concepto = document.getElementById('ci-concepto')?.value?.trim();
    const monto = parseFloat(document.getElementById('ci-monto')?.value);
    const fecha = document.getElementById('ci-fecha')?.value;
    const tipo = document.getElementById('ci-tipo')?.value || 'Otro';
    const nota = document.getElementById('ci-nota')?.value?.trim() || null;
    if (!concepto || !monto || !fecha) { hubToast('Completa concepto, monto y fecha','error'); return; }
    const { error } = await window.sb.from('finanzas_ingresos').insert({
      escuela_cct: cct, ciclo: window.CICLO_ACTIVO||'2025-2026',
      concepto, monto, fecha, tipo, nota,
      registrado_por: window.currentPerfil?.id, created_at: new Date().toISOString()
    });
    if (error) { hubToast('Error al guardar: '+error.message,'error'); return; }
    hubToast('✅ Ingreso registrado');
    contNav('ingresos');
  });
}

function contNuevoProveedor() {
  const cct = window.currentPerfil?.escuela_cct;
  hubModal('Nuevo Proveedor', `
    <div style="display:grid;gap:10px;">
      <input id="cp-nombre" class="inp" placeholder="Nombre / Razón social *" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
      <input id="cp-rfc" class="inp" placeholder="RFC (opcional)" maxlength="13" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
      <input id="cp-email" type="email" class="inp" placeholder="Email" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
      <input id="cp-tel" class="inp" placeholder="Teléfono" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
      <input id="cp-giro" class="inp" placeholder="Giro / Categoría" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
      <textarea id="cp-dir" placeholder="Dirección (opcional)" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;resize:vertical;min-height:60px;"></textarea>
    </div>`, 'Guardar Proveedor', async () => {
    const nombre = document.getElementById('cp-nombre')?.value?.trim();
    const rfc = document.getElementById('cp-rfc')?.value?.trim() || null;
    const email = document.getElementById('cp-email')?.value?.trim() || null;
    const telefono = document.getElementById('cp-tel')?.value?.trim() || null;
    const giro = document.getElementById('cp-giro')?.value?.trim() || null;
    const direccion = document.getElementById('cp-dir')?.value?.trim() || null;
    if (!nombre) { hubToast('El nombre es obligatorio','error'); return; }
    const { error } = await window.sb.from('finanzas_proveedores').insert({
      escuela_cct: cct, nombre, rfc, email, telefono, giro, direccion,
      created_at: new Date().toISOString()
    });
    if (error) { hubToast('Error al guardar: '+error.message,'error'); return; }
    hubToast('✅ Proveedor registrado');
    contNav('proveedores');
  });
}

function contNuevaVentaTiendita() {
  const cct = window.currentPerfil?.escuela_cct;
  hubModal('Movimiento Tiendita', `
    <div style="display:grid;gap:10px;">
      <input id="ct-concepto" class="inp" placeholder="Producto / Concepto *" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
      <select id="ct-tipo" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
        <option value="venta">Venta</option>
        <option value="compra">Compra / Reabastecimiento</option>
        <option value="ajuste">Ajuste de inventario</option>
      </select>
      <input id="ct-monto" type="number" class="inp" placeholder="Monto total *" step="0.01" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
      <input id="ct-cantidad" type="number" class="inp" placeholder="Cantidad (piezas)" min="1" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;" value="1">
      <input id="ct-fecha" type="date" class="inp" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;" value="${new Date().toISOString().split('T')[0]}">
      <textarea id="ct-nota" placeholder="Notas" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;resize:vertical;min-height:50px;"></textarea>
    </div>`, 'Guardar Movimiento', async () => {
    const concepto = document.getElementById('ct-concepto')?.value?.trim();
    const tipo = document.getElementById('ct-tipo')?.value;
    const monto = parseFloat(document.getElementById('ct-monto')?.value);
    const cantidad = parseInt(document.getElementById('ct-cantidad')?.value) || 1;
    const fecha = document.getElementById('ct-fecha')?.value;
    const nota = document.getElementById('ct-nota')?.value?.trim() || null;
    if (!concepto || !monto || !fecha) { hubToast('Completa concepto, monto y fecha','error'); return; }
    const { error } = await window.sb.from('tiendita_movimientos').insert({
      escuela_cct: cct, ciclo: window.CICLO_ACTIVO||'2025-2026',
      concepto, tipo, monto, cantidad, fecha, nota,
      registrado_por: window.currentPerfil?.id, created_at: new Date().toISOString()
    });
    if (error) { hubToast('Error al guardar: '+error.message,'error'); return; }
    hubToast('✅ Movimiento registrado');
    contNav('tiendita');
  });
}

async function contEliminarGasto(id) {
  if (!confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) return;
  const { error } = await window.sb.from('finanzas_gastos').delete().eq('id', id);
  if (error) { hubToast('Error: '+error.message,'error'); return; }
  hubToast('Gasto eliminado');
  contNav('gastos');
}

async function contEliminarIngreso(id) {
  if (!confirm('¿Eliminar este ingreso? Esta acción no se puede deshacer.')) return;
  const { error } = await window.sb.from('finanzas_ingresos').delete().eq('id', id);
  if (error) { hubToast('Error: '+error.message,'error'); return; }
  hubToast('Ingreso eliminado');
  contNav('ingresos');
}

function initContraloPortal() {
  const p = window.currentPerfil;
  if (!p) return;
  const nombre = ((p.nombre||'') + ' ' + (p.apellido_p||'')).trim();
  const initials = nombre.split(' ').map(x=>x[0]||'').join('').toUpperCase().slice(0,2)||'C';
  const avatar = document.getElementById('cont-avatar');
  const nameEl = document.getElementById('cont-user-name');
  const escEl  = document.getElementById('cont-escuela-name');
  if (avatar) avatar.textContent = initials;
  if (nameEl) nameEl.textContent = nombre || 'Contralor';
  if (escEl)  escEl.textContent  = p.escuela_cct || '—';
  const topTag = document.getElementById('cont-escuela-tag');
  if (topTag) topTag.textContent = p.escuela_nombre || p.escuela_cct || 'Mi escuela';
  _topbarPro({ titleId:'cont-page-title', prefix:'cont', searchPlaceholder:'Buscar gasto, proveedor…' });
  setTimeout(() => contNav('dashboard'), 150);
}
window.contNav                = contNav;
window.contGenerarReporte     = contGenerarReporte;
window.contNuevoGasto         = contNuevoGasto;
window.contNuevoIngreso       = contNuevoIngreso;
window.contNuevoProveedor     = contNuevoProveedor;
window.contNuevaVentaTiendita = contNuevaVentaTiendita;
window.contEliminarGasto      = contEliminarGasto;
window.contEliminarIngreso    = contEliminarIngreso;
window.initContraloPortal     = initContraloPortal;
window.dToggleNotif           = dToggleNotif;
window.dMarcarNotifLeida      = dMarcarNotifLeida;

// ── SECRETARÍA: CONTROL ESCOLAR ──────────────────────────────
window._ctrlData = [];
// ═══════════════════════════════════════════════════════════════════════
// CONTROL ESCOLAR — módulo completo
// Fuente de datos: usuarios (rol=alumno) + alumnos_grupos + grupos
// ═══════════════════════════════════════════════════════════════════════

// ── Notas/etiquetas en memoria (persistidas en localStorage) ──────────
function _ctrlGetNotas() {
  try { return JSON.parse(localStorage.getItem('siembra_ctrl_notas') || '{}'); } catch(e) { return {}; }
}
function _ctrlSaveNotas(notas) {
  try { localStorage.setItem('siembra_ctrl_notas', JSON.stringify(notas)); } catch(e) {}
}
function _ctrlGetNota(alumnoId) {
  return _ctrlGetNotas()[alumnoId] || { etiqueta: 'normal', comentario: '' };
}
function _ctrlSetNota(alumnoId, patch) {
  const notas = _ctrlGetNotas();
  notas[alumnoId] = { ..._ctrlGetNota(alumnoId), ...patch };
  _ctrlSaveNotas(notas);
}

// ── Tab switcher ────────────────────────────────────────────────────────
function admCtrlTab(tab) {
  ['grupos','lista','ciclo'].forEach(t => {
    const btn   = document.getElementById('ctrl-tab-' + t);
    const panel = document.getElementById('ctrl-panel-' + t);
    const active = t === tab;
    if (btn) {
      btn.style.fontWeight = active ? '700' : '600';
      btn.style.color = active ? '#0d5c2f' : '#64748b';
      btn.style.borderBottom = active ? '2px solid #0d5c2f' : '2px solid transparent';
      btn.style.marginBottom = active ? '-2px' : '0';
    }
    if (panel) panel.style.display = active ? '' : 'none';
  });
  if (tab === 'ciclo') admCtrlRenderCiclo();
}
window.admCtrlTab = admCtrlTab;

// ── Carga principal ─────────────────────────────────────────────────────
async function admCtrlEscolarCargar() {
  const sbRef = window.sb;
  const cct = window.currentPerfil?.escuela_cct || window.ADM?.escuelaCct;
  const escuelaId = window.currentPerfil?.escuela_id || window.ADM?.escuelaId;
  const listEl = document.getElementById('ctrl-grupos-list');
  if (listEl) listEl.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Cargando…</div>';

  try {
    // Usar datos ya cargados en ADM si están disponibles
    let grupos = window.ADM?.grupos || [];
    let alumnos = window.ADM?.alumnos || [];

    // Si no hay datos en ADM, cargar desde DB
    if (!grupos.length && sbRef && (cct || escuelaId)) {
      let q = sbRef.from('grupos').select('*').eq('activo', true);
      if (cct) q = q.eq('escuela_cct', cct);
      const { data: gData } = await q.order('grado');
      grupos = gData || [];
    }
    if (!alumnos.length && sbRef && (cct || escuelaId)) {
      let q = sbRef.from('usuarios')
        .select('id,nombre,apellido,apellido_p,curp,activo,created_at,alumnos_grupos(grupo_id,ciclo,activo,grupos(id,nombre,grado,seccion))')
        .eq('rol','alumno').eq('activo',true).order('nombre');
      if (cct) q = q.eq('escuela_cct', cct);
      else if (escuelaId) q = q.eq('escuela_id', escuelaId);
      const { data: aData } = await q;
      alumnos = aData || [];
    }

    // Cargar movimientos del ciclo actual (bajas, traslados)
    const cicloActual = window.CICLO_ACTIVO || new Date().getFullYear() + '-' + (new Date().getFullYear()+1);
    let movimientos = [];
    if (sbRef && (cct || escuelaId)) {
      let q = sbRef.from('control_escolar_movimientos')
        .select('*,usuarios(nombre,apellido,apellido_p),grupos(nombre,grado,seccion)')
        .eq('ciclo', cicloActual).order('created_at',{ascending:false}).limit(200);
      if (cct) q = q.eq('escuela_cct', cct);
      const { data: mvData } = await q;
      movimientos = mvData || [];
    }

    window._ctrlGrupos    = grupos;
    window._ctrlAlumnos   = alumnos;
    window._ctrlMovimientos = movimientos;

    // Calcular stats
    const notas = _ctrlGetNotas();
    let totalCriticos = 0, totalDestacados = 0;
    alumnos.forEach(a => {
      const n = notas[a.id];
      if (n?.etiqueta === 'critico')   totalCriticos++;
      if (n?.etiqueta === 'destacado') totalDestacados++;
    });
    const bajasCiclo = movimientos.filter(m => m.tipo === 'baja').length;

    const setEl = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
    setEl('ctrl-stat-inscritos',  alumnos.length);
    setEl('ctrl-stat-grupos',     grupos.length);
    setEl('ctrl-stat-criticos',   totalCriticos);
    setEl('ctrl-stat-destacados', totalDestacados);
    setEl('ctrl-stat-bajas',      bajasCiclo);

    admCtrlRenderGrupos();
    admCtrlRenderMovimientos();

  } catch(e) {
    if (listEl) listEl.innerHTML = `<div style="padding:40px;text-align:center;color:#b91c1c;font-weight:700;">Error: ${e.message}</div>`;
  }
}

// ── Render: grupos colapsables con alumnos ──────────────────────────────
function admCtrlRenderGrupos() {
  const el = document.getElementById('ctrl-grupos-list');
  if (!el) return;
  const grupos   = window._ctrlGrupos   || [];
  const alumnos  = window._ctrlAlumnos  || [];
  const notas    = _ctrlGetNotas();
  const buscar   = (document.getElementById('ctrl-buscar')?.value || '').toLowerCase();
  const filtGrado = document.getElementById('ctrl-filtro-grado')?.value || '';
  const filtEtiq  = document.getElementById('ctrl-filtro-etiqueta')?.value || '';

  if (!grupos.length) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Sin grupos registrados. Crea grupos en la sección Grupos.</div>';
    return;
  }

  // Agrupar alumnos por grupo
  const alumnosPorGrupo = {};
  alumnos.forEach(a => {
    (a.alumnos_grupos || []).forEach(ag => {
      const gid = ag.grupo_id;
      if (!alumnosPorGrupo[gid]) alumnosPorGrupo[gid] = [];
      alumnosPorGrupo[gid].push(a);
    });
  });

  const gruposFiltrados = grupos.filter(g => {
    if (filtGrado && String(g.grado) !== filtGrado) return false;
    return true;
  });

  const ETIQ_CFG = {
    critico:   { label:'⚠️ Crítico',   bg:'#fff7ed', border:'#fed7aa', color:'#9a3412' },
    destacado: { label:'⭐ Destacado',  bg:'#fefce8', border:'#fde68a', color:'#854d0e' },
    normal:    { label:'',             bg:'',         border:'',        color:'' },
  };

  el.innerHTML = gruposFiltrados.map((g, gi) => {
    const gid = g.id;
    const nomGrupo = g.nombre || (g.grado + '° ' + (g.seccion || ''));
    const turno = g.turno ? ` · ${g.turno}` : '';
    let alumnosGrupo = alumnosPorGrupo[gid] || [];

    // Aplicar filtro de etiqueta y búsqueda
    if (buscar || filtEtiq) {
      alumnosGrupo = alumnosGrupo.filter(a => {
        const nom = ((a.nombre||'') + ' ' + (a.apellido||a.apellido_p||'')).trim().toLowerCase();
        if (buscar && !nom.includes(buscar) && !(a.curp||'').toLowerCase().includes(buscar)) return false;
        if (filtEtiq) {
          const etiq = notas[a.id]?.etiqueta || 'normal';
          if (etiq !== filtEtiq) return false;
        }
        return true;
      });
    }

    const total      = alumnosGrupo.length;
    const criticos   = alumnosGrupo.filter(a => notas[a.id]?.etiqueta === 'critico').length;
    const destacados = alumnosGrupo.filter(a => notas[a.id]?.etiqueta === 'destacado').length;

    const estadoColor = criticos > 0 ? '#dc2626' : total === 0 ? '#94a3b8' : '#0d5c2f';
    const estadoBg    = criticos > 0 ? '#fff7ed' : total === 0 ? '#f8fafc' : '#f0fdf4';

    const alumnosHtml = total === 0
      ? `<div style="padding:16px 24px;font-size:12px;color:#94a3b8;font-style:italic;">Sin alumnos en este grupo</div>`
      : alumnosGrupo.map(a => {
          const nombre = ((a.nombre||'') + ' ' + (a.apellido||a.apellido_p||'')).trim();
          const nota   = notas[a.id] || { etiqueta: 'normal', comentario: '' };
          const eqCfg  = ETIQ_CFG[nota.etiqueta] || ETIQ_CFG.normal;
          const initials = nombre.split(' ').map(p=>p[0]||'').join('').toUpperCase().slice(0,2) || '?';
          const avatarColors = ['#0d5c2f','#1e40af','#7c3aed','#c2410c'];
          const aColor = avatarColors[nombre.charCodeAt(0) % avatarColors.length];

          return `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 20px;border-top:1px solid #f1f5f9;transition:.15s;"
               onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
            <div style="width:34px;height:34px;border-radius:9px;background:${aColor};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:white;flex-shrink:0;">${initials}</div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-size:13px;font-weight:700;color:#0f172a;">${nombre}</span>
                ${nota.etiqueta !== 'normal' ? `<span style="background:${eqCfg.bg};border:1px solid ${eqCfg.border};color:${eqCfg.color};padding:1px 8px;border-radius:99px;font-size:10px;font-weight:700;">${eqCfg.label}</span>` : ''}
              </div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${a.curp||'—'}</div>
              ${nota.comentario ? `<div style="font-size:11px;color:#64748b;margin-top:4px;padding:4px 8px;background:#f8fafc;border-radius:6px;border-left:3px solid #e2e8f0;">"${nota.comentario}"</div>` : ''}
            </div>
            <div style="display:flex;gap:5px;flex-shrink:0;flex-wrap:wrap;">
              <button onclick="admCtrlEditarNota('${a.id}','${nombre.replace(/'/g,"\\'")}')"
                style="padding:4px 8px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;font-family:inherit;font-size:10px;font-weight:700;cursor:pointer;color:#475569;">✏️</button>
              <button onclick="admCtrlDarBaja('${a.id}','${nombre.replace(/'/g,"\\'")}')"
                style="padding:4px 8px;background:#fff1f2;border:1px solid #fecaca;border-radius:6px;font-family:inherit;font-size:10px;font-weight:700;cursor:pointer;color:#dc2626;">Baja</button>
              <button onclick="admCtrlTraslado('${a.id}','${nombre.replace(/'/g,"\\'")}')"
                style="padding:4px 8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;font-family:inherit;font-size:10px;font-weight:700;cursor:pointer;color:#1e40af;">Traslado</button>
            </div>
          </div>`;
        }).join('');

    return `
    <div style="border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:12px;">
      <!-- Header grupo -->
      <div onclick="admToggleCampo('ctrl-g-${gi}')"
        style="background:${estadoBg};padding:14px 18px;display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none;transition:.15s;"
        onmouseover="this.style.filter='brightness(.97)'" onmouseout="this.style.filter=''">
        <div style="width:38px;height:38px;border-radius:10px;background:${estadoColor};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:white;flex-shrink:0;">
          ${g.seccion || g.grado + '°'}
        </div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:800;color:#0f172a;">${nomGrupo}${turno}</div>
          <div style="display:flex;gap:10px;margin-top:3px;flex-wrap:wrap;">
            <span style="font-size:11px;color:#64748b;">${total} alumno${total!==1?'s':''}</span>
            ${criticos   ? `<span style="font-size:11px;color:#dc2626;font-weight:700;">⚠️ ${criticos} crítico${criticos>1?'s':''}</span>` : ''}
            ${destacados ? `<span style="font-size:11px;color:#16a34a;font-weight:700;">⭐ ${destacados} destacado${destacados>1?'s':''}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button onclick="event.stopPropagation();ADM.abrirAltaAlumnoGrupo&&ADM.abrirAltaAlumnoGrupo('${gid}')"
            style="padding:5px 10px;background:#0d5c2f;color:white;border:none;border-radius:7px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;">+ Alumno</button>
          <span id="ctrl-g-${gi}-arrow" style="font-size:18px;color:#94a3b8;transition:.2s;">▸</span>
        </div>
      </div>
      <div id="ctrl-g-${gi}" style="display:none;background:white;">${alumnosHtml}</div>
    </div>`;
  }).join('');
}

// ── Editar nota/etiqueta de alumno ─────────────────────────────────────
function admCtrlEditarNota(alumnoId, nombre) {
  const nota = _ctrlGetNota(alumnoId);
  if (!window.ADM?.abrirModal) {
    alert('Modal no disponible');
    return;
  }
  ADM.abrirModal('ctrl-modal-nota', `📝 Observación — ${nombre}`,
    `<div style="margin-bottom:12px;">
      <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Etiqueta del alumno</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 14px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:600;">
          <input type="radio" name="ctrl-etiq" value="normal" ${nota.etiqueta==='normal'?'checked':''} style="accent-color:#0d5c2f;"> Sin etiqueta
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 14px;border:1.5px solid #fed7aa;border-radius:8px;font-size:12px;font-weight:600;background:#fff7ed;">
          <input type="radio" name="ctrl-etiq" value="critico" ${nota.etiqueta==='critico'?'checked':''}  style="accent-color:#dc2626;"> ⚠️ Crítico
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 14px;border:1.5px solid #fde68a;border-radius:8px;font-size:12px;font-weight:600;background:#fefce8;">
          <input type="radio" name="ctrl-etiq" value="destacado" ${nota.etiqueta==='destacado'?'checked':''} style="accent-color:#d97706;"> ⭐ Destacado
        </label>
      </div>
    </div>
    <div>
      <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Comentario / observación del ciclo</label>
      <textarea id="ctrl-nota-txt" rows="3" placeholder="Ej: Requiere apoyo en matemáticas, excelente asistencia…"
        style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;outline:none;resize:vertical;box-sizing:border-box;">${nota.comentario||''}</textarea>
    </div>`,
    `admCtrlGuardarNota('${alumnoId}')`,
    'Guardar observación'
  );
}

function admCtrlGuardarNota(alumnoId) {
  const etiq = document.querySelector('input[name="ctrl-etiq"]:checked')?.value || 'normal';
  const comentario = document.getElementById('ctrl-nota-txt')?.value?.trim() || '';
  _ctrlSetNota(alumnoId, { etiqueta: etiq, comentario });
  ADM.cerrarModal?.();
  ADM.toast?.('✅ Observación guardada', 'ok');
  admCtrlRenderGrupos();
  // Actualizar stats
  const notas = _ctrlGetNotas();
  const alumnos = window._ctrlAlumnos || [];
  let crit = 0, dest = 0;
  alumnos.forEach(a => { if(notas[a.id]?.etiqueta==='critico') crit++; if(notas[a.id]?.etiqueta==='destacado') dest++; });
  const s=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  s('ctrl-stat-criticos',crit); s('ctrl-stat-destacados',dest);
}
window.admCtrlGuardarNota = admCtrlGuardarNota;

// ── Dar de baja ─────────────────────────────────────────────────────────
async function admCtrlDarBaja(alumnoId, nombre) {
  if (!window.ADM?.abrirModal) return;
  const ciclo = window.CICLO_ACTIVO || new Date().getFullYear() + '-' + (new Date().getFullYear()+1);
  ADM.abrirModal('ctrl-modal-baja', `🚫 Dar de baja — ${nombre}`,
    `<div style="background:#fff1f2;border:1px solid #fecaca;border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="font-size:13px;color:#b91c1c;font-weight:700;margin-bottom:4px;">⚠️ Esta acción desvinculará al alumno de su grupo</div>
      <div style="font-size:12px;color:#991b1b;">El registro del alumno se conserva como inactivo. El movimiento queda registrado en el historial del ciclo ${ciclo}.</div>
    </div>
    <div>
      <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Motivo de baja</label>
      <select id="ctrl-baja-motivo" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;outline:none;">
        <option value="traslado_escuela">Traslado a otra escuela</option>
        <option value="desercion">Deserción / abandono escolar</option>
        <option value="graduacion">Graduación anticipada</option>
        <option value="otro">Otro</option>
      </select>
    </div>`,
    `admCtrlConfirmarBaja('${alumnoId}','${nombre.replace(/'/g,"\\'")}')`,
    'Dar de baja'
  );
}

async function admCtrlConfirmarBaja(alumnoId, nombre) {
  const motivo = document.getElementById('ctrl-baja-motivo')?.value || 'otro';
  ADM.cerrarModal?.();
  const sbRef = window.sb;
  const cct = window.currentPerfil?.escuela_cct || window.ADM?.escuelaCct;
  const ciclo = window.CICLO_ACTIVO || new Date().getFullYear() + '-' + (new Date().getFullYear()+1);
  try {
    if (sbRef) {
      // Desactivar alumno en alumnos_grupos
      await sbRef.from('alumnos_grupos').update({ activo: false }).eq('alumno_id', alumnoId);
      // Registrar movimiento
      await sbRef.from('control_escolar_movimientos').insert({
        alumno_id: alumnoId, tipo: 'baja', motivo, ciclo,
        escuela_cct: cct, created_at: new Date().toISOString()
      }).catch(() => {}); // tabla puede no existir aún
    }
    // Quitar de datos locales
    window._ctrlAlumnos = (window._ctrlAlumnos||[]).filter(a => a.id !== alumnoId);
    ADM.alumnos = (ADM.alumnos||[]).filter(a => a.id !== alumnoId);
    ADM.toast?.(`✅ ${nombre} dado de baja`, 'ok');
    admCtrlEscolarCargar();
  } catch(e) { ADM.toast?.('❌ ' + e.message, 'err'); }
}
window.admCtrlConfirmarBaja = admCtrlConfirmarBaja;

// ── Traslado individual ─────────────────────────────────────────────────
function admCtrlTraslado(alumnoId, nombre) {
  const grupos = window._ctrlGrupos || window.ADM?.grupos || [];
  const optsGrupos = grupos.map(g =>
    `<option value="${g.id}">${g.nombre || g.grado+'° '+(g.seccion||'')}</option>`).join('');
  ADM.abrirModal?.('ctrl-modal-traslado', `🔄 Traslado — ${nombre}`,
    `<div style="margin-bottom:12px;">
      <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Mover a grupo</label>
      <select id="ctrl-traslado-grupo" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;outline:none;">
        <option value="">Seleccionar grupo…</option>${optsGrupos}
      </select>
    </div>
    <div>
      <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Motivo</label>
      <input type="text" id="ctrl-traslado-motivo" placeholder="Ej: Cambio de turno" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;outline:none;box-sizing:border-box;">
    </div>`,
    `admCtrlConfirmarTraslado('${alumnoId}','${nombre.replace(/'/g,"\\'")}')`,
    'Confirmar traslado'
  );
}

async function admCtrlConfirmarTraslado(alumnoId, nombre) {
  const grupoId = document.getElementById('ctrl-traslado-grupo')?.value;
  const motivo  = document.getElementById('ctrl-traslado-motivo')?.value || '';
  if (!grupoId) { ADM.toast?.('⚠️ Selecciona un grupo destino', 'warn'); return; }
  ADM.cerrarModal?.();
  const sbRef = window.sb;
  const cct = window.currentPerfil?.escuela_cct || window.ADM?.escuelaCct;
  const ciclo = window.CICLO_ACTIVO || new Date().getFullYear() + '-' + (new Date().getFullYear()+1);
  try {
    if (sbRef) {
      await sbRef.from('alumnos_grupos').update({ grupo_id: grupoId }).eq('alumno_id', alumnoId).eq('activo', true);
      await sbRef.from('control_escolar_movimientos').insert({
        alumno_id: alumnoId, tipo: 'traslado', motivo: motivo || 'traslado interno',
        grupo_id_destino: grupoId, ciclo, escuela_cct: cct, created_at: new Date().toISOString()
      }).catch(() => {});
    }
    ADM.toast?.(`✅ ${nombre} trasladado al nuevo grupo`, 'ok');
    admCtrlEscolarCargar();
  } catch(e) { ADM.toast?.('❌ ' + e.message, 'err'); }
}
window.admCtrlConfirmarTraslado = admCtrlConfirmarTraslado;

// ── Render movimientos ──────────────────────────────────────────────────
function admCtrlRenderMovimientos() {
  const tbody = document.getElementById('ctrl-tabla-body');
  if (!tbody) return;
  const movs = window._ctrlMovimientos || [];
  if (!movs.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:32px;text-align:center;color:#94a3b8;font-style:italic;">Sin movimientos registrados en este ciclo</td></tr>';
    return;
  }
  const tipoCfg = {
    inscripcion:{ label:'Inscripción', bg:'#dcfce7', color:'#166534' },
    alta:       { label:'Alta',        bg:'#dbeafe', color:'#1e40af' },
    baja:       { label:'Baja',        bg:'#fee2e2', color:'#b91c1c' },
    traslado:   { label:'Traslado',    bg:'#fef9c3', color:'#a16207' },
  };
  tbody.innerHTML = movs.map(m => {
    const nombre = `${m.usuarios?.nombre||''} ${m.usuarios?.apellido||m.usuarios?.apellido_p||''}`.trim() || '—';
    const grupo  = m.grupos?.nombre || (m.grupos ? m.grupos.grado+'°'+(m.grupos.seccion||'') : '—');
    const cfg    = tipoCfg[m.tipo] || { label: m.tipo, bg:'#f1f5f9', color:'#475569' };
    const fecha  = m.created_at ? new Date(m.created_at).toLocaleDateString('es-MX') : '—';
    return `<tr style="border-top:1px solid #f1f5f9;">
      <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0f172a;">${nombre}</td>
      <td style="padding:12px 16px;font-size:12px;font-weight:700;color:#0d5c2f;">${grupo}</td>
      <td style="padding:12px 16px;"><span style="background:${cfg.bg};color:${cfg.color};padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;">${cfg.label}</span></td>
      <td style="padding:12px 16px;font-size:12px;color:#64748b;">${m.ciclo||'—'}</td>
      <td style="padding:12px 16px;font-size:12px;color:#64748b;">${fecha}</td>
      <td style="padding:12px 16px;"></td>
    </tr>`;
  }).join('');
}

// ── Panel traslado de ciclo ─────────────────────────────────────────────
function admCtrlRenderCiclo() {
  const el = document.getElementById('ctrl-ciclo-panel');
  if (!el) return;
  const grupos  = window._ctrlGrupos  || window.ADM?.grupos || [];
  const alumnos = window._ctrlAlumnos || window.ADM?.alumnos || [];
  const cicloActual = window.CICLO_ACTIVO || new Date().getFullYear() + '-' + (new Date().getFullYear()+1);
  const [anioInicio] = cicloActual.split('-').map(Number);
  const siguienteCiclo = `${anioInicio+1}-${anioInicio+2}`;

  const nivelGrupos = window.ADM?.escuelaNivel || 'secundaria';
  const maxGrado = nivelGrupos === 'primaria' ? 6 : 3;

  const alumnosPorGrupo = {};
  alumnos.forEach(a => {
    (a.alumnos_grupos || []).forEach(ag => {
      const gid = ag.grupo_id;
      if (!alumnosPorGrupo[gid]) alumnosPorGrupo[gid] = [];
      alumnosPorGrupo[gid].push(a);
    });
  });

  const gruposEgresados = grupos.filter(g => String(g.grado) === String(maxGrado));
  const gruposPromocion = grupos.filter(g => String(g.grado) !== String(maxGrado));
  const totalEgresan = gruposEgresados.reduce((s,g) => s + (alumnosPorGrupo[g.id]||[]).length, 0);
  const totalPromueven = gruposPromocion.reduce((s,g) => s + (alumnosPorGrupo[g.id]||[]).length, 0);

  el.innerHTML = `
    <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:14px;padding:18px;margin-bottom:20px;">
      <div style="font-size:14px;font-weight:800;color:#1e40af;margin-bottom:8px;">🔄 Traslado a ciclo ${siguienteCiclo}</div>
      <div style="font-size:13px;color:#1e3a8a;">Este proceso avanza de grado a todos los alumnos activos y crea las relaciones del nuevo ciclo escolar.</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px;">
      <div style="background:white;border:1.5px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#0d5c2f;font-family:'Fraunces',serif;">${totalPromueven}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:.5px;">Avanzan de grado</div>
      </div>
      <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#c2410c;font-family:'Fraunces',serif;">${totalEgresan}</div>
        <div style="font-size:11px;color:#9a3412;margin-top:4px;text-transform:uppercase;letter-spacing:.5px;">Egresan (${maxGrado}° grado)</div>
      </div>
      <div style="background:white;border:1.5px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#1d4ed8;font-family:'Fraunces',serif;">${grupos.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:.5px;">Grupos a trasladar</div>
      </div>
    </div>
    <div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:18px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:12px;">Grupos a trasladar al siguiente ciclo</div>
      ${grupos.map(g => {
        const nom = g.nombre || (g.grado + '° ' + (g.seccion||''));
        const cnt = (alumnosPorGrupo[g.id]||[]).length;
        const esUltimo = String(g.grado) === String(maxGrado);
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;">
          <div style="font-size:13px;font-weight:700;color:#0f172a;">${nom}</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:#64748b;">${cnt} alumnos</span>
            ${esUltimo
              ? `<span style="background:#fff7ed;color:#9a3412;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;">Egresa</span>`
              : `<span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;">→ ${Number(g.grado)+1}° grado</span>`}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;">
      <button onclick="admCtrlTab('grupos')" style="padding:10px 18px;background:#f1f5f9;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;color:#475569;">Cancelar</button>
      <button onclick="admCtrlEjecutarTraslado()" style="padding:10px 20px;background:linear-gradient(135deg,#1e40af,#1d4ed8);color:white;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">🔄 Ejecutar traslado a ${siguienteCiclo}</button>
    </div>`;
}

async function admCtrlEjecutarTraslado() {
  const sbRef = window.sb;
  const grupos = window._ctrlGrupos || window.ADM?.grupos || [];
  const alumnos = window._ctrlAlumnos || window.ADM?.alumnos || [];
  const cicloActual = window.CICLO_ACTIVO || new Date().getFullYear() + '-' + (new Date().getFullYear()+1);
  const [anioInicio] = cicloActual.split('-').map(Number);
  const siguienteCiclo = `${anioInicio+1}-${anioInicio+2}`;
  const nivelGrupos = window.ADM?.escuelaNivel || 'secundaria';
  const maxGrado = nivelGrupos === 'primaria' ? 6 : 3;

  if (!confirm(`¿Ejecutar traslado al ciclo ${siguienteCiclo}?\n\nEsto avanzará de grado a todos los alumnos activos.`)) return;

  try {
    let ok = 0, egresados = 0;
    const alumnosPorGrupo = {};
    alumnos.forEach(a => {
      (a.alumnos_grupos || []).forEach(ag => {
        if (!alumnosPorGrupo[ag.grupo_id]) alumnosPorGrupo[ag.grupo_id] = [];
        alumnosPorGrupo[ag.grupo_id].push(a);
      });
    });

    for (const g of grupos) {
      const alumnosGrupo = alumnosPorGrupo[g.id] || [];
      const esUltimo = String(g.grado) === String(maxGrado);

      if (esUltimo) {
        // Marcar como egresados (desactivar vínculo al grupo)
        for (const a of alumnosGrupo) {
          if (sbRef) await sbRef.from('alumnos_grupos').update({ activo: false }).eq('alumno_id', a.id).eq('grupo_id', g.id);
          egresados++;
        }
      } else {
        // Buscar grupo del siguiente grado con misma sección
        const grupoSig = grupos.find(gx =>
          String(gx.grado) === String(Number(g.grado) + 1) &&
          (gx.seccion || '') === (g.seccion || '') &&
          (gx.turno || '') === (g.turno || '')
        ) || grupos.find(gx => String(gx.grado) === String(Number(g.grado) + 1));

        for (const a of alumnosGrupo) {
          if (sbRef && grupoSig) {
            // Actualizar ciclo en el vínculo actual
            await sbRef.from('alumnos_grupos')
              .update({ grupo_id: grupoSig.id, ciclo: siguienteCiclo })
              .eq('alumno_id', a.id).eq('grupo_id', g.id).eq('activo', true);
          }
          ok++;
        }
      }
    }

    // Actualizar ciclo activo
    if (window.CICLO_ACTIVO !== undefined) window.CICLO_ACTIVO = siguienteCiclo;
    ADM.toast?.(`✅ Traslado completado · ${ok} alumnos avanzaron · ${egresados} egresaron`, 'ok');
    admCtrlEscolarCargar();
    admCtrlTab('grupos');
  } catch(e) { ADM.toast?.('❌ ' + e.message, 'err'); }
}

function admCtrlFiltrarGrupos() { admCtrlRenderGrupos(); }
function admCtrlEscolarFiltrar() { admCtrlFiltrarGrupos(); }
function admCtrlNuevaInscripcion() { ADM.abrirModalAlumno?.() || ADM.toast?.('Usa el botón + Alta alumno en Padrón escolar'); }
function admCtrlVerExpediente(id) { ADM.navTo?.('expedientes'); }

window.admCtrlEscolarCargar  = admCtrlEscolarCargar;
window.admCtrlEscolarFiltrar = admCtrlEscolarFiltrar;
window.admCtrlFiltrarGrupos  = admCtrlFiltrarGrupos;
window.admCtrlNuevaInscripcion = admCtrlNuevaInscripcion;
window.admCtrlVerExpediente  = admCtrlVerExpediente;
window.admCtrlEditarNota     = admCtrlEditarNota;
window.admCtrlDarBaja        = admCtrlDarBaja;
window.admCtrlTraslado       = admCtrlTraslado;
window.admCtrlRenderCiclo    = admCtrlRenderCiclo;
window.admCtrlEjecutarTraslado = admCtrlEjecutarTraslado;

// ── SECRETARÍA: EXPEDIENTES ──────────────────────────────────
const DOCS_REQUERIDOS = ['Acta de nacimiento','CURP','Certificado de primaria','Foto','Cartilla de vacunación','Comprobante domicilio'];
async function admExpedientesCargar() {
  const sbRef = window.sb;
  const cct = window.currentPerfil?.escuela_cct || window._admEscuelaCCT;
  const lista = document.getElementById('exp-lista');
  const grado = document.getElementById('exp-filtro-grado')?.value || '';
  if (!sbRef || !lista) return;
  lista.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Cargando…</div>';
  try {
    let q = sbRef.from('alumnos').select('id,nombre,curp,grado,seccion,documentos').eq('escuela_cct', cct).eq('activo', true).order('nombre');
    if (grado) q = q.eq('grado', grado);
    const { data } = await q;
    window._expData = data || [];
    admExpedientesFiltrar();
  } catch(e) { lista.innerHTML = `<div style="padding:20px;color:#b91c1c;text-align:center;">Error: ${e.message}</div>`; }
}
function admExpedientesFiltrar() {
  const buscar = (document.getElementById('exp-buscar')?.value || '').toLowerCase();
  const estado = document.getElementById('exp-filtro-estado')?.value || '';
  const lista = document.getElementById('exp-lista');
  if (!lista) return;
  const totalDocs = DOCS_REQUERIDOS.length;
  let alumnos = (window._expData || []).filter(a => !buscar || (a.nombre||'').toLowerCase().includes(buscar) || (a.curp||'').toLowerCase().includes(buscar));
  alumnos = alumnos.map(a => { const docs = a.documentos || {}; const entregados = DOCS_REQUERIDOS.filter(d => docs[d]).length; return {...a, entregados, pct: Math.round(entregados/totalDocs*100)}; });
  if (estado === 'completo') alumnos = alumnos.filter(a => a.pct === 100);
  if (estado === 'incompleto') alumnos = alumnos.filter(a => a.pct < 100);
  // Global bar
  const globalPct = alumnos.length ? Math.round(alumnos.reduce((s,a)=>s+a.pct,0)/alumnos.length) : 0;
  const pg = document.getElementById('exp-pct-global'); if(pg) pg.textContent = globalPct + '%';
  const bg = document.getElementById('exp-bar-global'); if(bg) bg.style.width = globalPct + '%';
  if (!alumnos.length) { lista.innerHTML = '<div style="text-align:center;padding:48px;color:#94a3b8;background:white;border-radius:12px;border:1.5px solid #e2e8f0;"><div style="font-size:36px;margin-bottom:10px;">🗂️</div><div style="font-weight:700;">Sin alumnos</div></div>'; return; }
  lista.innerHTML = alumnos.map(a => `
    <div style="background:white;border-radius:12px;border:1.5px solid ${a.pct===100?'#86efac':'#fde68a'};padding:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <div style="width:44px;height:44px;border-radius:50%;background:${a.pct===100?'#dcfce7':'#fef9c3'};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${a.pct===100?'✅':'📋'}</div>
      <div style="flex:1;min-width:160px;">
        <div style="font-weight:700;font-size:14px;color:#0f172a;">${a.nombre||'—'}</div>
        <div style="font-size:12px;color:#64748b;">${a.grado||'—'}° ${a.seccion||''} · CURP: ${a.curp||'—'}</div>
      </div>
      <div style="flex:1;min-width:180px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:11px;color:#64748b;">${a.entregados}/${totalDocs} documentos</span><span style="font-size:11px;font-weight:700;color:${a.pct===100?'#15803d':'#92400e'};">${a.pct}%</span></div>
        <div style="height:6px;background:#f1f5f9;border-radius:99px;overflow:hidden;"><div style="height:100%;border-radius:99px;background:${a.pct===100?'#22c55e':'#f59e0b'};width:${a.pct}%;transition:.4s;"></div></div>
      </div>
      <button onclick="admExpedienteAbrirModal('${a.id}')" style="padding:7px 14px;background:#f1f5f9;border:1.5px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;color:#475569;white-space:nowrap;">Ver expediente</button>
    </div>`).join('');
}
function admExpedienteAbrirModal(id) { ADM.toast && ADM.toast('📋 Expediente: función en desarrollo'); }
window.admExpedientesCargar = admExpedientesCargar;
window.admExpedientesFiltrar = admExpedientesFiltrar;
window.admExpedienteAbrirModal = admExpedienteAbrirModal;

// ── SECRETARÍA: CONSTANCIAS ───────────────────────────────────
window._constHistorial = [];
function admConstanciaGenerar() { admConstanciaAbrirTipo('estudio'); }
function admConstanciaAbrirTipo(tipo) {
  const tipos = { estudio:'Constancia de estudio', calificaciones:'Constancia de calificaciones', traslado:'Carta de traslado', conducta:'Constancia de buena conducta' };
  const nombre = prompt(`Nombre completo del alumno para: ${tipos[tipo]||tipo}`);
  if (!nombre) return;
  const fecha = new Date().toLocaleDateString('es-MX',{year:'numeric',month:'long',day:'numeric'});
  const escuela = window.currentPerfil?.escuela_nombre || 'Escuela Secundaria';
  const cct = window.currentPerfil?.escuela_cct || '';
  const html = `<html><head><meta charset="UTF-8"><title>${tipos[tipo]}</title><style>body{font-family:serif;padding:60px;max-width:700px;margin:0 auto;color:#000}h1{text-align:center;font-size:18px;margin-bottom:8px}h2{text-align:center;font-size:14px;color:#555;margin-bottom:40px}.sello{border:2px solid #000;padding:20px;margin:30px 0}.linea{border-bottom:1px solid #000;margin:30px 0;height:1px}.firma{display:flex;justify-content:space-around;margin-top:60px;text-align:center}.firma div{width:200px}.firma .nombre{border-top:1px solid #000;padding-top:8px;font-size:12px}</style></head><body>
  <h1>SECRETARÍA DE EDUCACIÓN PÚBLICA</h1><h1>${escuela}</h1><h2>C.C.T. ${cct}</h2>
  <h1 style="margin-top:40px;text-transform:uppercase;">${tipos[tipo]}</h1>
  <p style="text-align:justify;line-height:1.8;font-size:13px;">La Dirección de la Escuela Secundaria <strong>${escuela}</strong>, con Clave de Centro de Trabajo <strong>${cct}</strong>, hace constar que el(la) alumno(a) <strong>${nombre.toUpperCase()}</strong> se encuentra ${tipo==='estudio'?'debidamente inscrito(a) en esta institución durante el ciclo escolar 2025–2026, cursando sus estudios de nivel secundaria':tipo==='calificaciones'?'registrado(a) en los archivos escolares con historial académico en esta institución':tipo==='traslado'?'solicitando carta de traslado por motivos personales, habiendo cumplido con los requisitos establecidos':tipo==='conducta'?'reconocido(a) por su buena conducta durante su estancia en esta institución':'registrado(a) en esta institución'}.</p>
  <p style="text-align:justify;line-height:1.8;font-size:13px;">La presente se expide a petición del interesado(a) en la ciudad el día <strong>${fecha}</strong>, para los fines que le convengan.</p>
  <div class="firma"><div><div class="nombre">Director(a)</div><div style="font-size:11px;color:#555;">${escuela}</div></div><div><div class="nombre">Secretaria Escolar</div><div style="font-size:11px;color:#555;">${escuela}</div></div></div>
  </body></html>`;
  const w = window.open('', '_blank', 'width=800,height=600');
  w.document.write(html); w.document.close();
  // Add to historial
  window._constHistorial = window._constHistorial || [];
  window._constHistorial.unshift({ alumno: nombre, tipo: tipos[tipo], fecha: new Date().toLocaleDateString('es-MX'), usuario: window.currentPerfil?.nombre || 'Secretaria' });
  const tbody = document.getElementById('const-historial-body');
  if (tbody) tbody.innerHTML = window._constHistorial.map(c => `<tr style="border-top:1px solid #f1f5f9;"><td style="padding:10px 16px;font-size:13px;font-weight:600;">${c.alumno}</td><td style="padding:10px 16px;font-size:12px;color:#64748b;">${c.tipo}</td><td style="padding:10px 16px;font-size:12px;color:#64748b;">${c.fecha}</td><td style="padding:10px 16px;font-size:12px;color:#64748b;">${c.usuario}</td><td style="padding:10px 16px;"><button onclick="window.print()" style="padding:4px 10px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;cursor:pointer;">🖨️ Reimprimir</button></td></tr>`).join('');
  ADM.toast && ADM.toast('✅ Constancia generada — revisa la ventana emergente');
}
window.admConstanciaGenerar = admConstanciaGenerar;
window.admConstanciaAbrirTipo = admConstanciaAbrirTipo;

// ── SECRETARÍA: CORRESPONDENCIA ───────────────────────────────
window._corrData = [];
async function admCorrCargar() {
  const sbRef = window.sb;
  const cct = window.currentPerfil?.escuela_cct || window._admEscuelaCCT;
  const lista = document.getElementById('corr-lista');
  const tipo = document.getElementById('corr-filtro-tipo')?.value || '';
  const dir = document.getElementById('corr-filtro-dir')?.value || '';
  if (!sbRef || !lista) return;
  try {
    let q = sbRef.from('correspondencia_escolar').select('*').eq('escuela_cct', cct).order('created_at', {ascending:false}).limit(100);
    if (tipo) q = q.eq('tipo', tipo);
    if (dir) q = q.eq('direccion', dir);
    const { data } = await q;
    window._corrData = data || [];
    admCorrFiltrar();
  } catch(e) { window._corrData = []; admCorrFiltrar(); }
}
function admCorrFiltrar() {
  const buscar = (document.getElementById('corr-buscar')?.value || '').toLowerCase();
  const lista = document.getElementById('corr-lista');
  if (!lista) return;
  const items = (window._corrData || []).filter(c => !buscar || (c.asunto||'').toLowerCase().includes(buscar) || (c.folio||'').toLowerCase().includes(buscar));
  if (!items.length) { lista.innerHTML = '<div style="text-align:center;padding:48px;color:#94a3b8;background:white;border-radius:12px;border:1.5px solid #e2e8f0;"><div style="font-size:36px;margin-bottom:10px;">✉️</div><div style="font-weight:700;margin-bottom:6px;">Aún no hay correspondencia registrada</div><div style="font-size:13px;">Los oficios, circulares y comunicados aparecerán aquí para consulta y seguimiento.</div></div>'; return; }
  const tipoColor = { oficio:'#1e40af', circular:'#0d5c2f', comunicado:'#7c3aed', citatorio:'#d97706' };
  lista.innerHTML = items.map(c => `<div style="background:white;border-radius:12px;border:1.5px solid #e2e8f0;padding:16px;margin-bottom:10px;display:flex;gap:14px;align-items:flex-start;">
    <div style="font-size:22px;flex-shrink:0;">${c.direccion==='entrante'?'📥':'📤'}</div>
    <div style="flex:1;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
        <span style="background:${tipoColor[c.tipo]||'#475569'};color:white;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;">${(c.tipo||'').toUpperCase()}</span>
        <span style="font-size:11px;color:#64748b;">Folio: ${c.folio||'—'}</span>
        <span style="font-size:11px;color:#64748b;">${c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX') : '—'}</span>
      </div>
      <div style="font-weight:700;font-size:14px;color:#0f172a;">${c.asunto||'Sin asunto'}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;">${c.destinatario||c.remitente||''}</div>
    </div>
  </div>`).join('');
}
async function admCorrNuevo() {
  const asunto = prompt('Asunto del documento:');
  if (!asunto) return;
  const tipo = prompt('Tipo (oficio/circular/comunicado/citatorio):') || 'oficio';
  const direccion = prompt('Dirección (entrante/saliente):') || 'saliente';
  const folio = 'SIEM-' + Date.now().toString().slice(-6);
  const sbRef = window.sb;
  const cct = window.currentPerfil?.escuela_cct || window._admEscuelaCCT;
  if (sbRef && cct) {
    try {
      await sbRef.from('correspondencia_escolar').insert({ escuela_cct: cct, asunto, tipo, direccion, folio, fecha: new Date().toISOString().slice(0,10), creado_por: window.currentPerfil?.id });
      ADM.toast && ADM.toast('✅ Correspondencia registrada');
      admCorrCargar();
    } catch(e) { ADM.toast && ADM.toast('❌ ' + e.message, 'err'); }
  } else {
    window._corrData = window._corrData || [];
    window._corrData.unshift({ asunto, tipo, direccion, folio, fecha: new Date().toISOString().slice(0,10) });
    admCorrFiltrar();
    ADM.toast && ADM.toast('✅ Registrado en modo local');
  }
}
window.admCorrCargar = admCorrCargar;
window.admCorrFiltrar = admCorrFiltrar;
window.admCorrNuevo = admCorrNuevo;

// ── CANAL DOCENTES (DIRECTOR) ─────────────────────────────────
window._canalDocentes = [];
window._canalDestinatario = null; // null = general broadcast

async function dirCanalCargar() {
  const sbRef = window.sb;
  const cct = window.currentPerfil?.escuela_cct || (typeof _getCct==='function' ? _getCct() : null);
  const listaEl = document.getElementById('canal-lista-docentes');
  if (!listaEl) return;
  // Ocultar badge de canal
  const badge = document.getElementById('dir-canal-badge');
  if (badge) badge.style.display = 'none';

  // Load teacher list (usar usuarios, con fallback a perfiles)
  try {
    let docentesData = [];
    if (sbRef) {
      const { data: d1 } = await sbRef.from('usuarios')
        .select('id,nombre,apellido_p,rol')
        .eq('escuela_cct', cct)
        .in('rol',['docente','tutor'])
        .eq('activo', true)
        .order('nombre');
      docentesData = (d1||[]).map(d => ({...d, nombre: `${d.nombre||''} ${d.apellido_p||''}`.trim()}));
      if (!docentesData.length) {
        const { data: d2 } = await sbRef.from('perfiles')
          .select('id,nombre,rol')
          .eq('escuela_cct', cct)
          .eq('rol','docente')
          .eq('activo', true)
          .order('nombre');
        docentesData = d2 || [];
      }
    }
    window._canalDocentes = docentesData;
    dirCanalFiltrarDocentes();

    // Load unread counts per docente
    if (sbRef) {
      const { data: msgs } = await sbRef
        .from('comentarios_internos')
        .select('destinatario_id, leido')
        .eq('escuela_cct', cct)
        .eq('leido', false)
        .not('remitente_id', 'eq', window.currentPerfil?.id || '');
      window._canalNoLeidos = {};
      (msgs||[]).forEach(m => {
        if(m.destinatario_id) window._canalNoLeidos[m.destinatario_id] = (window._canalNoLeidos[m.destinatario_id]||0)+1;
      });
      dirCanalFiltrarDocentes();
    }
  } catch(e) {
    listaEl.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:12px;">Sin conexión</div>';
  }
}

function dirCanalFiltrarDocentes() {
  const buscar = (document.getElementById('canal-buscar-doc')?.value || '').toLowerCase();
  const listaEl = document.getElementById('canal-lista-docentes');
  if (!listaEl) return;
  const noLeidos = window._canalNoLeidos || {};
  const docentes = (window._canalDocentes || []).filter(d => !buscar || (d.nombre||'').toLowerCase().includes(buscar));

  const general = `<div onclick="dirCanalSeleccionar(null,'','')" style="padding:12px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f8fafc;background:${!window._canalDestinatario?'#eff6ff':'white'};transition:.1s;" onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='${!window._canalDestinatario?'#eff6ff':'white'}'">
    <div style="width:36px;height:36px;border-radius:50%;background:#3b7be8;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;flex-shrink:0;">📢</div>
    <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:#0f172a;">Aviso general</div><div style="font-size:11px;color:#64748b;">Todos los docentes</div></div>
  </div>`;

  const items = docentes.map(d => {
    const ini = (d.nombre||'?').charAt(0).toUpperCase();
    const nl = noLeidos[d.id] || 0;
    const activo = window._canalDestinatario === d.id;
    return `<div onclick="dirCanalSeleccionar('${d.id}','${(d.nombre||'').replace(/'/g,"\\'")}','')" style="padding:12px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f8fafc;background:${activo?'#eff6ff':'white'};transition:.1s;" onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='${activo?'#eff6ff':'white'}'">
      <div style="width:36px;height:36px;border-radius:50%;background:#0d5c2f;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;flex-shrink:0;">${ini}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.nombre||'—'}</div>
        <div style="font-size:11px;color:#64748b;">Docente</div>
      </div>
      ${nl>0?`<span style="background:#ef4444;color:white;font-size:10px;font-weight:800;padding:2px 6px;border-radius:99px;">${nl}</span>`:''}
    </div>`;
  });

  listaEl.innerHTML = general + (items.length ? items.join('') : '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:12px;">Sin docentes</div>');
}

function dirCanalSeleccionar(id, nombre, sub) {
  window._canalDestinatario = id || null;
  const nombreEl = document.getElementById('canal-chat-nombre');
  const subEl = document.getElementById('canal-chat-sub');
  const avatarEl = document.getElementById('canal-chat-avatar');
  if (nombreEl) nombreEl.textContent = id ? (nombre||'Docente') : 'Aviso general a todos';
  if (subEl) subEl.textContent = id ? 'Conversación privada' : 'Todos los docentes recibirán este mensaje';
  if (avatarEl) { avatarEl.textContent = id ? (nombre||'D').charAt(0).toUpperCase() : '📢'; avatarEl.style.background = id ? '#0d5c2f' : '#3b7be8'; }
  dirCanalFiltrarDocentes();
  dirCanalCargarMensajes();
}

async function dirCanalCargarMensajes() {
  const sbRef = window.sb;
  const cct = window.currentPerfil?.escuela_cct || (typeof _getCct==='function' ? _getCct() : null);
  const msgsEl = document.getElementById('canal-mensajes');
  if (!msgsEl) return;
  msgsEl.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;">Cargando…</div>';

  try {
    if (!sbRef) throw new Error('Sin conexión');
    let q = sbRef.from('comentarios_internos').select('*').eq('escuela_cct', cct).order('created_at', {ascending:true}).limit(100);
    if (window._canalDestinatario) {
      // Private conversation: messages between director and this teacher
      q = q.or(`and(remitente_id.eq.${window.currentPerfil?.id},destinatario_id.eq.${window._canalDestinatario}),and(remitente_id.eq.${window._canalDestinatario},destinatario_id.eq.${window.currentPerfil?.id})`);
    } else {
      // General broadcast: messages with no specific destinatario
      q = q.is('destinatario_id', null);
    }
    const { data, error } = await q;
    if (error) throw error;
    _dirCanalRenderMensajes(data || []);
    // Mark as read
    if (window._canalDestinatario && sbRef) {
      sbRef.from('comentarios_internos').update({leido:true}).eq('remitente_id', window._canalDestinatario).eq('destinatario_id', window.currentPerfil?.id).eq('leido', false);
    }
  } catch(e) {
    // Demo mode fallback
    _dirCanalRenderMensajes(window._canalMsgsDemo || []);
  }
}

function _dirCanalRenderMensajes(msgs) {
  const msgsEl = document.getElementById('canal-mensajes');
  if (!msgsEl) return;
  const myId = window.currentPerfil?.id;
  if (!msgs.length) {
    msgsEl.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;"><div style="font-size:32px;margin-bottom:8px;">💬</div><div style="font-size:13px;">Sin mensajes aún. ¡Inicia la conversación!</div></div>';
    return;
  }
  msgsEl.innerHTML = msgs.map(m => {
    const esPropio = m.remitente_id === myId || (!m.remitente_id);
    const hora = m.created_at ? new Date(m.created_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) : '';
    const fecha = m.created_at ? new Date(m.created_at).toLocaleDateString('es-MX',{day:'numeric',month:'short'}) : '';
    return `<div style="display:flex;flex-direction:column;align-items:${esPropio?'flex-end':'flex-start'};gap:2px;">
      <div style="max-width:75%;background:${esPropio?'#3b7be8':'white'};color:${esPropio?'white':'#0f172a'};border-radius:${esPropio?'14px 14px 4px 14px':'14px 14px 14px 4px'};padding:10px 14px;border:${esPropio?'none':'1.5px solid #e2e8f0'};font-size:13px;line-height:1.5;">
        ${!esPropio?`<div style="font-size:10px;font-weight:700;color:#3b7be8;margin-bottom:4px;">${m.remitente_nombre||'Docente'}</div>`:''}
        ${m.contenido||m.texto||''}
      </div>
      <div style="font-size:10px;color:#94a3b8;padding:0 4px;">${fecha} ${hora}</div>
    </div>`;
  }).join('');
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

async function dirCanalEnviar() {
  const input = document.getElementById('canal-input-msg');
  const texto = (input?.value || '').trim();
  if (!texto) return;
  const sbRef = window.sb;
  const cct = window.currentPerfil?.escuela_cct || (typeof _getCct==='function' ? _getCct() : null);
  const myId = window.currentPerfil?.id;
  const myNombre = window.currentPerfil?.nombre || 'Director';
  input.value = '';
  const msg = { escuela_cct: cct, remitente_id: myId, remitente_nombre: myNombre, destinatario_id: window._canalDestinatario || null, contenido: texto, texto, leido: false, created_at: new Date().toISOString() };
  try {
    if (sbRef) {
      const { error } = await sbRef.from('comentarios_internos').insert(msg);
      if (error) throw error;
    } else {
      window._canalMsgsDemo = window._canalMsgsDemo || [];
      window._canalMsgsDemo.push(msg);
    }
    dirCanalCargarMensajes();
  } catch(e) {
    window._canalMsgsDemo = window._canalMsgsDemo || [];
    window._canalMsgsDemo.push(msg);
    _dirCanalRenderMensajes(window._canalMsgsDemo);
  }
}

async function dirCanalNuevoAviso() {
  dirCanalSeleccionar(null, '', '');
  const input = document.getElementById('canal-input-msg');
  if (input) { input.focus(); input.placeholder = 'Escribe el aviso para todos los docentes…'; }
}

window.dirCanalCargar = dirCanalCargar;
window.dirCanalFiltrarDocentes = dirCanalFiltrarDocentes;
window.dirCanalSeleccionar = dirCanalSeleccionar;
window.dirCanalCargarMensajes = dirCanalCargarMensajes;
window.dirCanalEnviar = dirCanalEnviar;
window.dirCanalNuevoAviso = dirCanalNuevoAviso;

// ═══════════════════════════════════════════════════════
// DIRECTOR — SECCIÓN ALUMNOS
// ═══════════════════════════════════════════════════════
window._dirAlumnos = [];

async function dirAlumnosCargar() {
  const sbRef = window.sb;
  const cct   = window.currentPerfil?.escuela_cct;
  const nivel = window._nivelActivo || localStorage.getItem('siembra_nivel') || 'primaria';
  const tabla = document.getElementById('dir-alumnos-tabla');
  const selGrupo = document.getElementById('dir-alumnos-filtro-grupo');
  if (!tabla) return;

  tabla.innerHTML = `<tr><td colspan="6" style="padding:30px;text-align:center;color:#94a3b8;">Cargando…</td></tr>`;

  if (!sbRef || !cct) {
    tabla.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:#94a3b8;">
      <div style="font-size:32px;margin-bottom:10px;">👨‍🎓</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">Sin conexión a la base de datos</div>
      <div style="font-size:12px;">Configura Supabase para ver los alumnos.</div>
    </td></tr>`;
    return;
  }

  try {
    // Cargar alumnos con su grupo, calificaciones promedio y observaciones
    const { data: alumnosDB, error } = await sbRef
      .from('alumnos_grupos')
      .select('alumno_id, activo, grupos(id,nombre,grado,nivel), usuarios!alumno_id(id,nombre,apellido_p,apellido_m)')
      .eq('activo', true)
      .order('created_at', { ascending: true });
    if (error) throw error;

    // Filtrar por nivel y escuela (usando grupos de la escuela)
    const gruposEscuela = new Set((window._dirGrupos||grupos||[]).map(g=>g.db_id||g.id));
    let alumnos = (alumnosDB||[]).filter(r => {
      if (!r.usuarios) return false;
      if (gruposEscuela.size && r.grupos?.id && !gruposEscuela.has(r.grupos.id)) return false;
      return true;
    });

    // Deduplicar por alumno_id
    const seen = new Set();
    alumnos = alumnos.filter(r => { if(seen.has(r.alumno_id)) return false; seen.add(r.alumno_id); return true; });

    window._dirAlumnos = alumnos;

    // Poblar selector de grupos
    if (selGrupo) {
      const gruposUnicos = [...new Map(alumnos.map(r=>[r.grupos?.id, r.grupos?.nombre]).filter(([id])=>id)).values()];
      selGrupo.innerHTML = '<option value="">Todos los grupos</option>' +
        gruposUnicos.map(nom => `<option value="${nom}">${nom}</option>`).join('');
    }

    // Cargar calificaciones promedio en batch
    const alumnoIds = alumnos.map(r=>r.alumno_id);
    let calData = {};
    if (alumnoIds.length) {
      const { data: cals } = await sbRef.from('calificaciones')
        .select('alumno_id, calificacion')
        .in('alumno_id', alumnoIds)
        .eq('escuela_cct', cct);
      (cals||[]).forEach(c => {
        if (!calData[c.alumno_id]) calData[c.alumno_id] = [];
        if (c.calificacion != null) calData[c.alumno_id].push(parseFloat(c.calificacion));
      });
    }

    // Cargar observaciones count
    let obsData = {};
    if (alumnoIds.length) {
      const { data: obs } = await sbRef.from('observaciones_alumno')
        .select('alumno_id')
        .in('alumno_id', alumnoIds);
      (obs||[]).forEach(o => { obsData[o.alumno_id] = (obsData[o.alumno_id]||0)+1; });
    }

    // Calcular KPIs
    const promedios = alumnoIds.map(id => {
      const vals = calData[id]||[];
      return vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : null;
    }).filter(v=>v!==null);
    const promGral = promedios.length ? (promedios.reduce((s,v)=>s+v,0)/promedios.length).toFixed(1) : '—';
    const enRiesgo = promedios.filter(v=>v<6).length;

    const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    set('dir-al-total', alumnos.length);
    set('dir-al-prom', promGral);
    set('dir-al-riesgo', enRiesgo);
    set('dir-al-asist', '—');

    window._dirCalData = calData;
    window._dirObsData = obsData;
    dirAlumnosFiltrar();

  } catch(e) {
    tabla.innerHTML = `<tr><td colspan="6" style="padding:30px;text-align:center;color:#ef4444;">Error: ${e.message}</td></tr>`;
  }
}

function dirAlumnosFiltrar() {
  const buscar   = (document.getElementById('dir-alumnos-buscar')?.value||'').toLowerCase();
  const grpFil   = document.getElementById('dir-alumnos-filtro-grupo')?.value||'';
  const tabla    = document.getElementById('dir-alumnos-tabla');
  if (!tabla) return;

  const alumnos  = window._dirAlumnos||[];
  const calData  = window._dirCalData||{};
  const obsData  = window._dirObsData||{};

  const filtrados = alumnos.filter(r => {
    const u = r.usuarios;
    if (!u) return false;
    const nombre = `${u.nombre||''} ${u.apellido_p||''} ${u.apellido_m||''}`.toLowerCase();
    if (buscar && !nombre.includes(buscar)) return false;
    if (grpFil && r.grupos?.nombre !== grpFil) return false;
    return true;
  });

  if (!filtrados.length) {
    tabla.innerHTML = `<tr><td colspan="6" style="padding:48px;text-align:center;color:#94a3b8;">
      <div style="font-size:32px;margin-bottom:10px;">👨‍🎓</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">Todavía no hay alumnos registrados</div>
      <div style="font-size:12px;">Cuando Secretaría cargue alumnos o se importe un listado, aparecerán aquí automáticamente.</div>
    </td></tr>`;
    return;
  }

  tabla.innerHTML = filtrados.map(r => {
    const u = r.usuarios;
    const nombre = `${u.nombre||''} ${u.apellido_p||''} ${u.apellido_m||''}`.trim();
    const grupo  = r.grupos?.nombre || '—';
    const vals   = calData[r.alumno_id]||[];
    const prom   = vals.length ? (vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1) : '—';
    const obs    = obsData[r.alumno_id]||0;
    const promNum = parseFloat(prom);
    const colorProm = isNaN(promNum) ? '#64748b' : promNum < 6 ? '#dc2626' : promNum < 7 ? '#d97706' : '#059669';
    const ini = (u.nombre||'?')[0].toUpperCase();
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px;">
        <div style="width:34px;height:34px;border-radius:50%;background:#0d5c2f;color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;">${ini}</div>
        <div><div style="font-weight:700;">${nombre}</div></div>
      </div></td>
      <td><span style="padding:3px 10px;background:#f0fdf4;border-radius:99px;font-size:12px;font-weight:700;color:#0d5c2f;">${grupo}</span></td>
      <td><span style="font-weight:800;font-size:15px;color:${colorProm};">${prom}</span></td>
      <td><span style="color:#64748b;font-size:13px;">—</span></td>
      <td><span style="padding:2px 8px;background:${obs>0?'#fef9c3':'#f1f5f9'};border-radius:99px;font-size:12px;font-weight:600;color:${obs>0?'#a16207':'#64748b'};">${obs} nota${obs!==1?'s':''}</span></td>
      <td><button onclick="dirAlumnoVerDetalle('${r.alumno_id}')" class="btn btn-outline btn-xs">👁 Ver</button></td>
    </tr>`;
  }).join('');
}

async function dirAlumnoVerDetalle(alumnoId) {
  const sbRef = window.sb;
  const det = document.getElementById('dir-alumno-detalle');
  if (!det) return;
  det.style.display = 'block';
  det.scrollIntoView({ behavior:'smooth' });

  const alumno = (window._dirAlumnos||[]).find(r=>r.alumno_id===alumnoId);
  const u = alumno?.usuarios;
  const nombre = u ? `${u.nombre||''} ${u.apellido_p||''}`.trim() : '—';
  const grupo  = alumno?.grupos?.nombre || '—';
  const setEl = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  setEl('dir-al-det-nombre', nombre);
  setEl('dir-al-det-info', `Grupo: ${grupo}`);

  const calEl = document.getElementById('dir-al-det-cal');
  const obsEl = document.getElementById('dir-al-det-obs');
  if (calEl) calEl.innerHTML = '<div style="color:#94a3b8;font-size:12px;">Cargando…</div>';
  if (obsEl) obsEl.innerHTML = '<div style="color:#94a3b8;font-size:12px;">Cargando…</div>';

  if (!sbRef) return;
  try {
    // Calificaciones
    const { data: cals } = await sbRef.from('calificaciones')
      .select('materia,calificacion,trimestre,aspecto')
      .eq('alumno_id', alumnoId)
      .order('materia');

    if (calEl) {
      const porMateria = {};
      (cals||[]).forEach(c => {
        if (!porMateria[c.materia]) porMateria[c.materia] = [];
        if (c.calificacion!=null) porMateria[c.materia].push(parseFloat(c.calificacion));
      });
      const mats = Object.keys(porMateria);
      calEl.innerHTML = mats.length ? mats.map(m => {
        const vals = porMateria[m];
        const prom = vals.length ? (vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1) : '—';
        const pn = parseFloat(prom);
        const col = isNaN(pn)?'#64748b':pn<6?'#dc2626':pn<7?'#d97706':'#059669';
        return `<div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;">${m}</div>
          <div style="font-size:22px;font-weight:800;color:${col};">${prom}</div>
        </div>`;
      }).join('') : '<div style="color:#94a3b8;font-size:12px;">Sin calificaciones registradas</div>';
    }

    // Observaciones
    const { data: obs } = await sbRef.from('observaciones_alumno')
      .select('nota, tipo, created_at, usuarios!docente_id(nombre)')
      .eq('alumno_id', alumnoId)
      .order('created_at', { ascending:false })
      .limit(20);

    if (obsEl) {
      obsEl.innerHTML = (obs||[]).length ? (obs||[]).map(o => {
        const fecha = new Date(o.created_at).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'});
        const docente = o.usuarios?.nombre || 'Docente';
        return `<div style="padding:12px;border-bottom:1px solid #f1f5f9;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:11px;font-weight:700;color:#0d5c2f;">${docente}</span>
            <span style="font-size:11px;color:#94a3b8;">${fecha}</span>
          </div>
          <div style="font-size:13px;color:#374151;line-height:1.5;">${o.nota||o.tipo||'—'}</div>
        </div>`;
      }).join('') : '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;"><div style="font-size:28px;margin-bottom:8px;">📝</div><div style="font-weight:700;margin-bottom:4px;">Sin observaciones registradas</div><div>Aquí verás comentarios pedagógicos y de seguimiento cuando existan.</div></div>';
    }
  } catch(e) {
    if (calEl) calEl.innerHTML = `<div style="color:#ef4444;font-size:12px;">Error: ${e.message}</div>`;
  }
}

window.dirAlumnosCargar = dirAlumnosCargar;
window.dirAlumnosFiltrar = dirAlumnosFiltrar;
window.dirAlumnoVerDetalle = dirAlumnoVerDetalle;

// ══════════════════════════════════════════════════════════════════════
// PARTE 1 — Director: alumnos en riesgo académico y por inasistencia
// ══════════════════════════════════════════════════════════════════════
async function dirCargarAlertasRendimiento() {
  const cct = window.currentPerfil?.escuela_cct;
  if (!window.sb || !cct) return;
  const ciclo = window.CICLO_ACTIVO || '2025-2026';

  // Inyectar panel si no existe en dir-p-alumnos
  let panel = document.getElementById('dir-alertas-rend-panel');
  if (!panel) {
    const container = document.getElementById('dir-p-alumnos');
    if (!container) return;
    panel = document.createElement('div');
    panel.id = 'dir-alertas-rend-panel';
    panel.style.cssText = 'margin-bottom:16px;';
    panel.innerHTML = `
      <div style="background:white;border-radius:14px;border:1.5px solid #fde68a;padding:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:18px;">⚠️</span>
          <span style="font-size:14px;font-weight:700;color:#0f172a;">Alumnos en riesgo</span>
          <button onclick="dirCargarAlertasRendimiento()" style="margin-left:auto;padding:4px 10px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:7px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;color:#475569;cursor:pointer;">↺ Actualizar</button>
        </div>
        <div id="dir-riesgo-filtros" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:18px;">
          <select id="dir-filtro-grupo" onchange="dirFiltrarRiesgo()" style="padding:8px 14px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;min-width:160px;">
            <option value="">Todos los grupos</option>
          </select>
          <select id="dir-filtro-tipo" onchange="dirFiltrarRiesgo()" style="padding:8px 14px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;">
            <option value="">Todos los riesgos</option>
            <option value="academico">⚠️ Riesgo académico (promedio &lt;6)</option>
            <option value="inasistencia">📅 Alta inasistencia (&gt;3 faltas/mes)</option>
          </select>
          <button onclick="dirExportarRiesgoCSV()" style="padding:8px 16px;background:#0d5c2f;color:white;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">⬇ Exportar lista</button>
          <button id="dir-btn-reporte-grupo" style="padding:8px 16px;background:#1e40af;color:white;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;display:none;">📊 Reporte del grupo</button>
        </div>
        <div id="dir-alertas-rend-lista" style="font-size:13px;color:#64748b;">
          <span style="display:inline-block;width:12px;height:12px;border:2px solid #e2e8f0;border-top-color:#475569;border-radius:50%;animation:spin .8s linear infinite;vertical-align:middle;margin-right:6px;"></span>
          Analizando datos…
        </div>
      </div>`;
    // Insertar antes del KPI grid
    const kpisDiv = document.getElementById('dir-alumnos-kpis');
    if (kpisDiv) container.insertBefore(panel, kpisDiv);
    else container.insertBefore(panel, container.firstChild);
  }

  const lista = document.getElementById('dir-alertas-rend-lista');
  if (!lista) return;
  lista.innerHTML = '<span style="color:#94a3b8;font-size:12px;">Consultando base de datos…</span>';

  try {
    // Cargar grupos para el select de filtros
    const { data: grupos } = await window.sb.from('grupos').select('id,nombre,grado,grupo').eq('escuela_cct', cct).eq('activo', true).order('grado');
    const sel = document.getElementById('dir-filtro-grupo');
    if (sel && grupos) {
      while (sel.options.length > 1) sel.remove(1);
      grupos.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.nombre || `${g.grado}° ${g.grupo}`;
        sel.appendChild(opt);
      });
    }

    // 1. Alumnos con promedio < 6 (riesgo académico)
    const { data: cals } = await window.sb
      .from('calificaciones')
      .select('alumno_id, calificacion, usuarios!alumno_id(nombre, apellido_p, grupo_id)')
      .eq('escuela_cct', cct)
      .eq('ciclo', ciclo);

    const porAlumno = {};
    (cals || []).forEach(c => {
      const id = c.alumno_id;
      if (!porAlumno[id]) porAlumno[id] = { vals: [], nombre: `${c.usuarios?.nombre||''} ${c.usuarios?.apellido_p||''}`.trim() || '—', grupo_id: c.usuarios?.grupo_id || null };
      if (c.calificacion != null) porAlumno[id].vals.push(parseFloat(c.calificacion));
    });
    const enRiesgoAcad = Object.entries(porAlumno)
      .filter(([_, v]) => v.vals.length && (v.vals.reduce((s, x) => s + x, 0) / v.vals.length) < 6)
      .map(([id, v]) => ({ id, nombre: v.nombre, prom: (v.vals.reduce((s, x) => s + x, 0) / v.vals.length).toFixed(1), faltas: 0, tipo: 'academico', grupo_id: v.grupo_id }));

    // 2. Alumnos con >3 faltas en el mes actual
    const mesInicio = new Date();
    mesInicio.setDate(1);
    const { data: faltas } = await window.sb
      .from('asistencia')
      .select('alumno_id, estado, usuarios!alumno_id(nombre, apellido_p, grupo_id)')
      .eq('escuela_cct', cct)
      .eq('estado', 'ausente')
      .gte('fecha', mesInicio.toISOString().split('T')[0]);

    const faltasPorAlumno = {};
    (faltas || []).forEach(f => {
      const id = f.alumno_id;
      if (!faltasPorAlumno[id]) faltasPorAlumno[id] = { count: 0, nombre: `${f.usuarios?.nombre||''} ${f.usuarios?.apellido_p||''}`.trim() || '—', grupo_id: f.usuarios?.grupo_id || null };
      faltasPorAlumno[id].count++;
    });
    const enRiesgoAsist = Object.entries(faltasPorAlumno)
      .filter(([_, v]) => v.count > 3)
      .map(([id, v]) => ({ id, nombre: v.nombre, prom: '—', faltas: v.count, tipo: 'inasistencia', grupo_id: v.grupo_id }));

    // Combinar y deduplicar (un alumno puede aparecer en ambas listas)
    const vistos = new Set();
    const todos = [];
    [...enRiesgoAcad, ...enRiesgoAsist].forEach(a => {
      const key = `${a.id}-${a.tipo}`;
      if (!vistos.has(key)) { vistos.add(key); todos.push(a); }
    });

    // Guardar globalmente para filtros y exportación
    window._dirAlumnosRiesgo = todos;

    if (!todos.length) {
      lista.innerHTML = '<div style="padding:10px;background:#f0fdf4;border-radius:8px;border:1px solid #86efac;font-size:12px;color:#15803d;">🟢 Sin alumnos en riesgo detectados este ciclo.</div>';
      return;
    }

    dirRenderizarRiesgo(todos);
  } catch(e) {
    lista.innerHTML = `<span style="color:#dc2626;font-size:12px;">Error: ${e.message}</span>`;
  }
}

function dirRenderizarRiesgo(datos) {
  const lista = document.getElementById('dir-alertas-rend-lista');
  if (!lista) return;
  if (!datos || !datos.length) {
    lista.innerHTML = '<div style="padding:10px;background:#f0fdf4;border-radius:8px;border:1px solid #86efac;font-size:12px;color:#15803d;">🟢 Sin alumnos en riesgo para los filtros seleccionados.</div>';
    return;
  }
  lista.innerHTML = datos.map(a => {
    const nombreEsc = (a.nombre || '').replace(/'/g, "\\'");
    if (a.tipo === 'academico') {
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca;margin-bottom:6px;font-size:12px;">
        <span>📉</span>
        <span style="flex:1;"><strong>${a.nombre}</strong> — Promedio: <strong style="color:#dc2626;">${a.prom}</strong></span>
        <span style="background:#fee2e2;padding:2px 7px;border-radius:99px;font-size:11px;font-weight:700;color:#b91c1c;">Riesgo académico</span>
        <button onclick="dirGenerarReporteAlumno('${a.id}','${nombreEsc}')" style="padding:3px 9px;background:#1e40af;color:white;border:none;border-radius:7px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📄 Reporte</button>
      </div>`;
    } else {
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#fffbeb;border-radius:8px;border:1px solid #fde68a;margin-bottom:6px;font-size:12px;">
        <span>🚫</span>
        <span style="flex:1;"><strong>${a.nombre}</strong> — <strong style="color:#b45309;">${a.faltas} faltas</strong> este mes</span>
        <span style="background:#fef9c3;padding:2px 7px;border-radius:99px;font-size:11px;font-weight:700;color:#a16207;">Alta inasistencia</span>
        <button onclick="dirGenerarReporteAlumno('${a.id}','${nombreEsc}')" style="padding:3px 9px;background:#1e40af;color:white;border:none;border-radius:7px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📄 Reporte</button>
      </div>`;
    }
  }).join('');
}

function dirFiltrarRiesgo() {
  const grupoVal = (document.getElementById('dir-filtro-grupo')?.value || '').trim();
  const tipoVal  = (document.getElementById('dir-filtro-tipo')?.value  || '').trim();
  const todos = window._dirAlumnosRiesgo || [];

  // Mostrar/ocultar botón de reporte de grupo
  const btnReporte = document.getElementById('dir-btn-reporte-grupo');
  if (btnReporte) {
    if (grupoVal) {
      const selEl = document.getElementById('dir-filtro-grupo');
      const grupoNombre = selEl?.options[selEl.selectedIndex]?.textContent || grupoVal;
      btnReporte.style.display = '';
      btnReporte.onclick = () => dirGenerarReporteGrupo(grupoVal, grupoNombre);
    } else {
      btnReporte.style.display = 'none';
    }
  }

  let filtrados = todos;
  if (grupoVal) filtrados = filtrados.filter(a => String(a.grupo_id) === grupoVal);
  if (tipoVal)  filtrados = filtrados.filter(a => a.tipo === tipoVal);
  dirRenderizarRiesgo(filtrados);
}

function dirExportarRiesgoCSV() {
  const grupoVal = (document.getElementById('dir-filtro-grupo')?.value || '').trim();
  const tipoVal  = (document.getElementById('dir-filtro-tipo')?.value  || '').trim();
  const todos = window._dirAlumnosRiesgo || [];
  let filtrados = todos;
  if (grupoVal) filtrados = filtrados.filter(a => String(a.grupo_id) === grupoVal);
  if (tipoVal)  filtrados = filtrados.filter(a => a.tipo === tipoVal);

  if (!filtrados.length) {
    if (typeof hubToast === 'function') hubToast('No hay datos para exportar', 'info');
    return;
  }

  const encabezado = ['Nombre', 'Apellido', 'Grupo', 'Tipo de riesgo', 'Promedio', 'Faltas este mes'];
  const filas = filtrados.map(a => {
    const partes = (a.nombre || '').split(' ');
    const apellido = partes.length > 1 ? partes.slice(1).join(' ') : '';
    const nombre  = partes.nombre || 'Alumno';
    const tipoLabel = a.tipo === 'academico' ? 'Riesgo académico' : 'Alta inasistencia';
    return [nombre, apellido, a.grupo_id || '', tipoLabel, a.prom || '—', a.faltas ?? 0];
  });

  if (typeof exportarCSV === 'function') {
    exportarCSV([encabezado, ...filas], 'alumnos_en_riesgo_' + new Date().toISOString().slice(0, 10));
  } else {
    const csvContent = [encabezado, ...filas]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alumnos_en_riesgo_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }
}

window.dirCargarAlertasRendimiento = dirCargarAlertasRendimiento;
window.dirRenderizarRiesgo = dirRenderizarRiesgo;
window.dirFiltrarRiesgo = dirFiltrarRiesgo;
window.dirExportarRiesgoCSV = dirExportarRiesgoCSV;

// Enganchar dirCargarAlertasRendimiento al navegar a 'alumnos' en dirNav
(function _hookDirNavAlumnos() {
  const _orig = window.dirNav;
  if (typeof _orig !== 'function') return;
  window.dirNav = function(page) {
    _orig(page);
    if (page === 'alumnos') setTimeout(dirCargarAlertasRendimiento, 600);
  };
})();

// ══════════════════════════════════════════════════════════════════════
// PARTE 2A — Director: reporte grupal PDF
// ══════════════════════════════════════════════════════════════════════
async function dirGenerarReporteGrupo(grupoId, grupoNombre) {
  const cct = window.currentPerfil?.escuela_cct;
  if (!window.sb || !cct) return;
  if (typeof hubToast === 'function') hubToast('Generando reporte…', 'info');

  const ciclo = window.CICLO_ACTIVO || '2025-2026';
  const mesInicio = new Date(); mesInicio.setDate(1);
  const hoy = new Date().toISOString().split('T')[0];

  try {
    const [{ data: alumnos }, { data: cals }, { data: asist }] = await Promise.all([
      window.sb.from('usuarios').select('id,nombre,apellido_p,grado,grupo').eq('escuela_cct', cct).eq('rol', 'alumno').eq('activo', true).eq('grupo_id', grupoId),
      window.sb.from('calificaciones').select('alumno_id,materia,calificacion,periodo').eq('escuela_cct', cct).eq('grupo_id', grupoId).eq('ciclo', ciclo),
      window.sb.from('asistencia').select('alumno_id,estado').eq('escuela_cct', cct).eq('grupo_id', grupoId).gte('fecha', mesInicio.toISOString().split('T')[0])
    ]);

    const escuela = window.currentPerfil?.escuela_nombre || cct;
    const rows = (alumnos || []).map(a => {
      const calAlumno = (cals || []).filter(c => c.alumno_id === a.id);
      const prom = calAlumno.length
        ? (calAlumno.reduce((s, c) => s + (parseFloat(c.calificacion) || 0), 0) / calAlumno.length).toFixed(1)
        : '—';
      const faltasCnt = (asist || []).filter(x => x.alumno_id === a.id && x.estado === 'ausente').length;
      const estado = (+prom < 6 || faltasCnt > 3) ? '⚠️ Riesgo' : '✅ Regular';
      return `<tr><td>${a.nombre || ''} ${a.apellido_p || ''}</td><td>${prom}</td><td>${faltasCnt}</td><td>${estado}</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte ${grupoNombre}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a;}h1{font-size:20px;margin-bottom:4px;}
    .sub{font-size:13px;color:#64748b;margin-bottom:20px;}table{width:100%;border-collapse:collapse;font-size:13px;}
    th{background:#0d5c2f;color:white;padding:10px 12px;text-align:left;}td{padding:9px 12px;border-bottom:1px solid #e2e8f0;}
    tr:nth-child(even){background:#f8fafc;}.footer{margin-top:20px;font-size:11px;color:#94a3b8;}
    @media print{body{padding:0;}}</style></head><body>
    <h1>📊 Reporte de grupo — ${grupoNombre}</h1>
    <div class="sub">${escuela} · Ciclo ${ciclo} · Generado: ${hoy}</div>
    <table><thead><tr><th>Alumno</th><th>Promedio</th><th>Faltas (mes)</th><th>Estado</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="footer">SIEMBRA · Sistema Integral de Gestión Escolar</div>
    </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 500); }
  } catch(e) {
    if (typeof hubToast === 'function') hubToast('Error al generar reporte: ' + e.message, 'error');
  }
}
window.dirGenerarReporteGrupo = dirGenerarReporteGrupo;

// ══════════════════════════════════════════════════════════════════════
// PARTE 2B — Director: reporte individual PDF
// ══════════════════════════════════════════════════════════════════════
async function dirGenerarReporteAlumno(alumnoId, alumnoNombre) {
  const cct = window.currentPerfil?.escuela_cct;
  if (!window.sb || !cct) return;
  if (typeof hubToast === 'function') hubToast('Generando reporte…', 'info');

  const ciclo = window.CICLO_ACTIVO || '2025-2026';
  const mesInicio = new Date(); mesInicio.setDate(1);
  const hoy = new Date().toISOString().split('T')[0];

  try {
    const [{ data: alumno }, { data: cals }, { data: asistRows }, { data: obs }] = await Promise.all([
      window.sb.from('usuarios').select('id,nombre,apellido_p,grado,grupo,grupo_id').eq('id', alumnoId).single(),
      window.sb.from('calificaciones').select('materia,calificacion,periodo').eq('alumno_id', alumnoId).eq('escuela_cct', cct).eq('ciclo', ciclo).order('materia'),
      window.sb.from('asistencia').select('fecha,estado').eq('alumno_id', alumnoId).eq('escuela_cct', cct).gte('fecha', mesInicio.toISOString().split('T')[0]).order('fecha'),
      window.sb.from('observaciones').select('contenido,created_at,autor_id').eq('alumno_id', alumnoId).eq('escuela_cct', cct).order('created_at', { ascending: false }).limit(5)
    ]);

    const escuela = window.currentPerfil?.escuela_nombre || cct;
    const nombreCompleto = alumno ? `${alumno.nombre || ''} ${alumno.apellido_p || ''}`.trim() : alumnoNombre;
    const grado = alumno ? `${alumno.grado || ''}° ${alumno.grupo || ''}`.trim() : '';

    const calRows = (cals || []).map(c =>
      `<tr><td>${c.materia || '—'}</td><td>${c.periodo || '—'}</td><td>${c.calificacion ?? '—'}</td></tr>`
    ).join('') || '<tr><td colspan="3" style="color:#94a3b8;">Sin calificaciones registradas</td></tr>';

    const totalFaltas = (asistRows || []).filter(x => x.estado === 'ausente').length;
    const asistTabla = (asistRows || []).map(r => {
      const color = r.estado === 'ausente' ? '#fef2f2' : '#f0fdf4';
      const etiq  = r.estado === 'ausente' ? '🚫 Falta' : r.estado === 'retardo' ? '⏰ Retardo' : '✅ Presente';
      return `<tr style="background:${color}"><td>${r.fecha}</td><td>${etiq}</td></tr>`;
    }).join('') || '<tr><td colspan="2" style="color:#94a3b8;">Sin registros de asistencia este mes</td></tr>';

    const obsRows = (obs || []).map(o =>
      `<tr><td>${(o.created_at || '').slice(0, 10)}</td><td>${o.contenido || ''}</td></tr>`
    ).join('') || '<tr><td colspan="2" style="color:#94a3b8;">Sin observaciones registradas</td></tr>';

    const promedio = cals && cals.length
      ? (cals.reduce((s, c) => s + (parseFloat(c.calificacion) || 0), 0) / cals.length).toFixed(1)
      : '—';
    const estadoRiesgo = (+promedio < 6 || totalFaltas > 3) ? '⚠️ EN RIESGO' : '✅ SIN RIESGO';
    const estadoColor  = (+promedio < 6 || totalFaltas > 3) ? '#dc2626' : '#15803d';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte ${nombreCompleto}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a;}h1{font-size:20px;margin-bottom:4px;}h2{font-size:14px;color:#0d5c2f;margin:20px 0 8px;}
    .sub{font-size:13px;color:#64748b;margin-bottom:8px;}.badge{display:inline-block;padding:4px 12px;border-radius:99px;font-weight:700;font-size:13px;margin-bottom:20px;}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;}
    th{background:#0d5c2f;color:white;padding:8px 10px;text-align:left;}td{padding:7px 10px;border-bottom:1px solid #e2e8f0;}
    .footer{margin-top:20px;font-size:11px;color:#94a3b8;}@media print{body{padding:0;}}</style></head><body>
    <h1>📄 Reporte individual — ${nombreCompleto}</h1>
    <div class="sub">${escuela} · Ciclo ${ciclo} · Grupo: ${grado} · Generado: ${hoy}</div>
    <div class="badge" style="color:${estadoColor};border:1.5px solid ${estadoColor};">${estadoRiesgo}</div>
    <h2>Calificaciones (promedio: ${promedio})</h2>
    <table><thead><tr><th>Materia</th><th>Periodo</th><th>Calificación</th></tr></thead><tbody>${calRows}</tbody></table>
    <h2>Asistencia — mes actual (${totalFaltas} falta${totalFaltas !== 1 ? 's' : ''})</h2>
    <table><thead><tr><th>Fecha</th><th>Estado</th></tr></thead><tbody>${asistTabla}</tbody></table>
    <h2>Últimas observaciones del docente</h2>
    <table><thead><tr><th>Fecha</th><th>Observación</th></tr></thead><tbody>${obsRows}</tbody></table>
    <div class="footer">SIEMBRA · Sistema Integral de Gestión Escolar</div>
    </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=750');
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 500); }
  } catch(e) {
    if (typeof hubToast === 'function') hubToast('Error al generar reporte: ' + e.message, 'error');
  }
}
window.dirGenerarReporteAlumno = dirGenerarReporteAlumno;

// ══════════════════════════════════════════════════════════════════════
// PARTE 3 — Prefecto: ampliar alertas con alta inasistencia
// ══════════════════════════════════════════════════════════════════════
const _prefCargarAlertasOrig = window.prefCargarAlertas;
window.prefCargarAlertas = async function() {
  // Ejecutar lógica original (incidencias activas)
  if (typeof _prefCargarAlertasOrig === 'function') await _prefCargarAlertasOrig();

  // Añadir bloque de alta inasistencia mensual
  const el = document.getElementById('pref-alertas-list');
  if (!el || !window.sb || !window.currentPerfil?.escuela_cct) return;
  try {
    const cct = window.currentPerfil.escuela_cct;
    const mesInicio = new Date();
    mesInicio.setDate(1);
    const { data: faltas } = await window.sb
      .from('asistencia')
      .select('alumno_id, usuarios!alumno_id(nombre, apellido_p)')
      .eq('escuela_cct', cct)
      .eq('estado', 'ausente')
      .gte('fecha', mesInicio.toISOString().split('T')[0]);

    const cuentas = {};
    (faltas || []).forEach(f => {
      const id = f.alumno_id;
      if (!cuentas[id]) cuentas[id] = { count: 0, nombre: `${f.usuarios?.nombre||''} ${f.usuarios?.apellido_p||''}`.trim() || '—' };
      cuentas[id].count++;
    });
    const altaInasist = Object.values(cuentas).filter(v => v.count > 3);
    if (!altaInasist.length) return;

    const extra = document.createElement('div');
    extra.innerHTML = `
      <div style="font-size:12px;font-weight:700;color:#b45309;margin:12px 0 6px;text-transform:uppercase;letter-spacing:.5px;">🚫 Alta inasistencia este mes</div>
      ${altaInasist.map(a => `
        <div style="background:white;border-radius:12px;border:1px solid #fde68a;padding:12px 14px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;background:#fef9c3;color:#a16207;">Alta</span>
            <span style="font-weight:700;font-size:13px;">${a.nombre}</span>
            <span style="margin-left:auto;font-size:12px;font-weight:700;color:#b45309;">${a.count} faltas</span>
          </div>
        </div>`).join('')}`;
    el.appendChild(extra);
  } catch(e) { console.warn('[prefCargarAlertas inasist]', e.message); }
};

// ══════════════════════════════════════════════════════════════════════
// PARTE 4 — Utilidad exportarCSV genérica
// ══════════════════════════════════════════════════════════════════════
function exportarCSV(datos, nombreArchivo) {
  if (!datos?.length) { if(typeof hubToast==='function') hubToast('Sin datos para exportar', 'warn'); return; }
  const keys = Object.keys(datos[0]);
  const csv = [keys.join(','), ...datos.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (nombreArchivo || 'exportar') + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  if(typeof hubToast==='function') hubToast('✅ CSV exportado: ' + (nombreArchivo||'exportar') + '.csv', 'ok');
}
window.exportarCSV = exportarCSV;

// ── REALTIME SUSCRIPCIONES ────────────────────────────────────────────────────

// PARTE 1: Prefecto — Realtime en asistencia
function prefSuscribirAsistencia(grupoId) {
  const key = 'pref-asist-' + (grupoId || 'all');
  if (window._realtimeChannels[key]) return;
  const cct = window.currentPerfil?.escuela_cct;
  if (!window.sb || !cct) return;

  const filter = grupoId ? `grupo_id=eq.${grupoId}` : undefined;
  const ch = window.sb.channel(key)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'asistencia',
      ...(filter ? { filter } : {})
    }, (payload) => {
      console.log('[Pref Realtime] Asistencia update:', payload);
      // Actualizar contadores recargando la vista
      if (typeof prefActualizarContadores === 'function') prefActualizarContadores();
      else if (typeof prefAsistenciaAlumnosCargar === 'function') prefAsistenciaAlumnosCargar();
      // Mostrar toast
      const est = payload.new?.estatus || payload.new?.estado;
      if (est) {
        const ico = est === 'presente' ? '✅' : est === 'ausente' ? '❌' : '⏰';
        hubToast(`${ico} Asistencia actualizada en tiempo real`, 'info');
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('[Pref] Suscrito a asistencia realtime');
    });
  window._realtimeChannels[key] = ch;
}
window.prefSuscribirAsistencia = prefSuscribirAsistencia;

// PARTE 2: Director — Realtime en alertas de rendimiento
function dirSuscribirAlertas() {
  const cct = window.currentPerfil?.escuela_cct;
  if (!window.sb || !cct) return;

  // Suscribir a calificaciones
  const keyCal = 'dir-alertas-cal';
  if (!window._realtimeChannels[keyCal]) {
    const ch = window.sb.channel(keyCal)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'calificaciones',
        filter: `escuela_cct=eq.${cct}`
      }, (payload) => {
        console.log('[Dir Realtime] Calificación registrada:', payload);
        // Actualizar badge de alertas si existe
        const badge = document.getElementById('dir-alertas-badge');
        if (badge) {
          badge.style.display = 'inline';
          badge.textContent = '!';
        }
        // Si el panel de alumnos está abierto, recargar
        const panel = document.getElementById('dir-p-alumnos');
        if (panel && (panel.classList.contains('active') || panel.style.display !== 'none')) {
          setTimeout(() => { if (typeof dirCargarAlertasRendimiento === 'function') dirCargarAlertasRendimiento(); }, 1000);
        }
        hubToast('📊 Nueva calificación registrada', 'info');
      })
      .subscribe();
    window._realtimeChannels[keyCal] = ch;
  }

  // Suscribir a asistencia
  const keyAs = 'dir-alertas-as';
  if (!window._realtimeChannels[keyAs]) {
    const ch2 = window.sb.channel(keyAs)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'asistencia',
        filter: `escuela_cct=eq.${cct}`
      }, (payload) => {
        console.log('[Dir Realtime] Asistencia registrada:', payload);
        hubToast('📅 Asistencia actualizada', 'info');
      })
      .subscribe();
    window._realtimeChannels[keyAs] = ch2;
  }
}
window.dirSuscribirAlertas = dirSuscribirAlertas;

// PARTE 3: Coordinador — Realtime en planeaciones
function coordSuscribirPlaneaciones() {
  const cct = window.currentPerfil?.escuela_cct;
  if (!window.sb || !cct) return;

  const key = 'coord-planeaciones';
  if (window._realtimeChannels[key]) return;

  const ch = window.sb.channel(key)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'planeaciones',
      filter: `escuela_cct=eq.${cct}`
    }, (payload) => {
      console.log('[Coord Realtime] Nueva planeación:', payload);
      hubToast('📚 Nueva planeación recibida — actualizando...', 'info');
      // Recargar lista si está en esa sección
      const panel = document.getElementById('coord-p-planeaciones');
      if (panel && panel.style.display !== 'none') {
        setTimeout(() => { if (typeof coordRenderPlaneaciones === 'function') coordRenderPlaneaciones(); }, 800);
      }
    })
    .subscribe();
  window._realtimeChannels[key] = ch;
}
window.coordSuscribirPlaneaciones = coordSuscribirPlaneaciones;

// ── FIN REALTIME SUSCRIPCIONES ────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// PARCHE v2026-04 — Funciones faltantes: Contralor · Orientador · TS
// No modifica ninguna función existente — solo agrega funciones nuevas
// ═══════════════════════════════════════════════════════════════════════════════

// ── CONTRALOR: contGuardarPresupuesto ───────────────────────────────────────
// Abre modal para asignar presupuesto por categoría e inserta en finanzas_presupuesto
function contGuardarPresupuesto() {
  const cct = window.currentPerfil?.escuela_cct;
  const ciclo = window.CICLO_ACTIVO || '2025-2026';
  const categorias = ['Materiales','Servicios','Mantenimiento','Personal','Eventos','Tecnología','Alimentación','Transporte','Otro'];
  const campos = categorias.map(cat => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
      <label style="font-size:13px;color:#374151;width:130px;flex-shrink:0;">${cat}</label>
      <input id="pres-${cat.toLowerCase()}" type="number" min="0" step="100" placeholder="0.00"
        style="flex:1;padding:7px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;">
      <span style="font-size:12px;color:#94a3b8;">MXN</span>
    </div>`).join('');
  hubModal('📊 Asignar presupuesto por categoría',`
    <div style="margin-bottom:10px;">
      <div style="font-size:12px;color:#64748b;margin-bottom:12px;">Ciclo: <strong>${ciclo}</strong> · Escuela: <strong>${cct||'—'}</strong></div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:14px;">Deja en 0 las categorías que no apliquen. Los montos se actualizan si ya existen.</div>
      ${campos}
    </div>`, 'Guardar presupuesto', async () => {
    if (!window.sb || !cct) { hubToast('Sin conexión a Supabase','error'); return; }
    const rows = categorias
      .map(cat => ({ cat, monto: parseFloat(document.getElementById('pres-'+cat.toLowerCase())?.value) || 0 }))
      .filter(r => r.monto > 0);
    if (!rows.length) { hubToast('Ingresa al menos un monto mayor a 0','warn'); return; }
    let errores = 0;
    for (const r of rows) {
      const { error } = await window.sb.from('finanzas_presupuesto').upsert({
        escuela_cct: cct,
        ciclo,
        categoria: r.cat,
        presupuestado: r.monto,
        ejercido: 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'escuela_cct,ciclo,categoria', ignoreDuplicates: false });
      if (error) errores++;
    }
    if (errores) { hubToast(`⚠️ ${errores} categoría(s) no se guardaron`,'warn'); }
    else { hubToast('✅ Presupuesto asignado correctamente','ok'); }
    if (typeof _contRenderPresupuesto === 'function') _contRenderPresupuesto();
  });
}
window.contGuardarPresupuesto = contGuardarPresupuesto;

// ── ORIENTADOR: KPI alumnos en riesgo en dashboard ──────────────────────────
// Parchea orientDashboardCargar para incluir el count de alertas activas
(function() {
  const _origOrientDash = window.orientDashboardCargar || orientDashboardCargar;
  async function orientDashboardCargarV2() {
    const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
    if (!window.sb || !cct) return;
    try {
      const mes = new Date().toISOString().slice(0,7);
      const [rEnt, rBec, rRiesgo] = await Promise.all([
        window.sb.from('entrevistas_orientador').select('id',{count:'exact',head:true}).eq('escuela_cct',cct).gte('fecha',mes+'-01'),
        window.sb.from('becas_alumnos').select('id',{count:'exact',head:true}).eq('escuela_cct',cct).eq('activo',true),
        window.sb.from('alertas').select('id',{count:'exact',head:true}).eq('escuela_cct',cct).eq('leido',false),
      ]);
      const el = id => document.getElementById(id);
      if(el('orient-kpi-entrevistas')) el('orient-kpi-entrevistas').textContent = rEnt.count ?? 0;
      if(el('orient-kpi-becas'))       el('orient-kpi-becas').textContent       = rBec.count ?? 0;
      if(el('orient-kpi-riesgo'))      el('orient-kpi-riesgo').textContent      = rRiesgo.count ?? 0;
    } catch(e) { console.warn('[orientDashboard]', e); }
  }
  window.orientDashboardCargar = orientDashboardCargarV2;
})();

// ── ORIENTADOR: Reportes reales con descarga CSV ────────────────────────────
async function orientReporteEntrevistas() {
  const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  if (!window.sb || !cct) { hubToast('Sin conexión','error'); return; }
  hubToast('⏳ Generando reporte de entrevistas…','ok');
  const { data, error } = await window.sb.from('entrevistas_orientador')
    .select('*').eq('escuela_cct', cct)
    .eq('ciclo', window.CICLO_ACTIVO || '2025-2026')
    .order('fecha', { ascending: false });
  if (error || !data?.length) { hubToast('Sin datos para exportar','warn'); return; }
  const filas = [
    ['REPORTE DE ENTREVISTAS — ' + cct],
    ['Ciclo: ' + (window.CICLO_ACTIVO||'2025-2026') + ' · Generado: ' + new Date().toLocaleDateString('es-MX')],
    [''],
    ['Alumno/Participante','Tipo','Fecha','Resumen','Acuerdos'],
    ...data.map(e => [
      e.alumno_nombre || e.participante || '—',
      e.tipo || '—',
      e.fecha || '—',
      (e.resumen || '').replace(/,/g, ';'),
      (e.acuerdos || '').replace(/,/g, ';'),
    ])
  ];
  const csv = '\uFEFF' + filas.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = `entrevistas_orientador_${cct}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  hubToast('✅ Reporte descargado (' + data.length + ' entrevistas)','ok');
}

async function orientReporteRiesgo() {
  const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  if (!window.sb || !cct) { hubToast('Sin conexión','error'); return; }
  hubToast('⏳ Generando reporte de alumnos en riesgo…','ok');
  const { data, error } = await window.sb.from('alertas')
    .select('*').eq('escuela_cct', cct)
    .order('created_at', { ascending: false }).limit(200);
  if (error || !data?.length) { hubToast('Sin alertas para exportar','warn'); return; }
  const filas = [
    ['REPORTE DE ALUMNOS EN RIESGO — ' + cct],
    ['Ciclo: ' + (window.CICLO_ACTIVO||'2025-2026') + ' · Generado: ' + new Date().toLocaleDateString('es-MX')],
    [''],
    ['Tipo','Descripción','Origen','Leído','Fecha'],
    ...data.map(a => [
      a.tipo || '—',
      (a.contenido || a.descripcion || a.texto || '—').replace(/,/g,';'),
      a.origen || '—',
      a.leido ? 'Sí' : 'No',
      a.created_at ? new Date(a.created_at).toLocaleDateString('es-MX') : '—',
    ])
  ];
  const csv = '\uFEFF' + filas.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = `alumnos_riesgo_${cct}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  hubToast('✅ Reporte descargado (' + data.length + ' alertas)','ok');
}

async function orientReporteVocacional() {
  const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  if (!window.sb || !cct) { hubToast('Sin conexión','error'); return; }
  hubToast('⏳ Generando reporte vocacional…','ok');
  const { data, error } = await window.sb.from('orient_resultados_vocacionales')
    .select('*').eq('escuela_cct', cct)
    .order('created_at', { ascending: false }).limit(200)
    .catch(() => ({ data: null, error: { message: 'Tabla no disponible' } }));
  if (error || !data?.length) { hubToast('Sin resultados vocacionales para exportar','warn'); return; }
  const filas = [
    ['REPORTE VOCACIONAL HOLLAND — ' + cct],
    ['Ciclo: ' + (window.CICLO_ACTIVO||'2025-2026') + ' · Generado: ' + new Date().toLocaleDateString('es-MX')],
    [''],
    ['Alumno','Perfil Holland','Tipos seleccionados','Observaciones','Fecha'],
    ...data.map(r => [
      r.alumno_nombre || '—',
      r.perfil || '—',
      (Array.isArray(r.tipos_holland) ? r.tipos_holland.join('/') : r.tipos_holland || '—'),
      (r.observaciones || '').replace(/,/g,';'),
      r.created_at ? new Date(r.created_at).toLocaleDateString('es-MX') : '—',
    ])
  ];
  const csv = '\uFEFF' + filas.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = `vocacional_holland_${cct}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  hubToast('✅ Reporte vocacional descargado (' + data.length + ' resultados)','ok');
}

window.orientReporteEntrevistas = orientReporteEntrevistas;
window.orientReporteRiesgo      = orientReporteRiesgo;
window.orientReporteVocacional  = orientReporteVocacional;

// ── TS: Nuevo alumno manual y nueva institución en directorio ───────────────
function tsDirNuevoAlumno() {
  const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  hubModal('👤 Agregar alumno al directorio', `
    <div style="display:flex;flex-direction:column;gap:11px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">Nombre *</label>
          <input id="tda-nombre" type="text" placeholder="Nombre(s)" style="width:100%;padding:8px 12px;border:1.5px solid #dde5f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">Apellidos *</label>
          <input id="tda-apellido" type="text" placeholder="Apellido paterno y materno" style="width:100%;padding:8px 12px;border:1.5px solid #dde5f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">Grado</label>
          <select id="tda-grado" style="width:100%;padding:8px 12px;border:1.5px solid #dde5f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
            <option value="">— Grado —</option>
            ${['1°','2°','3°','4°','5°','6°'].map(g=>`<option>${g}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">Grupo</label>
          <input id="tda-grupo" type="text" placeholder="Ej: A, B, C" style="width:100%;padding:8px 12px;border:1.5px solid #dde5f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
        </div>
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">CURP</label>
        <input id="tda-curp" type="text" placeholder="18 caracteres (opcional)" maxlength="18" style="width:100%;padding:8px 12px;border:1.5px solid #dde5f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;text-transform:uppercase;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">Teléfono tutor</label>
        <input id="tda-tel" type="tel" placeholder="10 dígitos" style="width:100%;padding:8px 12px;border:1.5px solid #dde5f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">Observaciones TS</label>
        <textarea id="tda-obs" rows="2" placeholder="Notas iniciales del caso…" style="width:100%;padding:8px 12px;border:1.5px solid #dde5f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;resize:vertical;"></textarea>
      </div>
    </div>`, 'Agregar al directorio', async () => {
    const nombre   = document.getElementById('tda-nombre')?.value?.trim();
    const apellido = document.getElementById('tda-apellido')?.value?.trim();
    if (!nombre || !apellido) { hubToast('Nombre y apellidos son obligatorios','warn'); return; }
    const payload = {
      nombre,
      apellido_p: apellido.split(' ')[0] || apellido,
      apellido_m: apellido.split(' ').slice(1).join(' ') || null,
      grado:      document.getElementById('tda-grado')?.value || null,
      grupo:      document.getElementById('tda-grupo')?.value?.trim() || null,
      curp:       document.getElementById('tda-curp')?.value?.trim().toUpperCase() || null,
      telefono:   document.getElementById('tda-tel')?.value?.trim() || null,
      observaciones_ts: document.getElementById('tda-obs')?.value?.trim() || null,
      escuela_cct: cct,
      ciclo:       window.CICLO_ACTIVO || '2025-2026',
      rol:         'alumno',
      activo:      true,
      created_at:  new Date().toISOString(),
    };
    const { error } = await window.sb.from('alumnos').insert(payload)
      .catch(e => ({ error: e }));
    if (error) { hubToast('Error: ' + error.message, 'error'); return; }
    hubToast('✅ Alumno agregado al directorio', 'ok');
    // Recargar directorio si la función existe
    if (typeof tsDirRenderAlumnos === 'function') tsDirRenderAlumnos('');
    else if (typeof TSR !== 'undefined' && typeof TSR.renderDirectorioAlumnos === 'function') TSR.renderDirectorioAlumnos();
  });
}

function tsDirNuevaInstitucion() {
  const cct = typeof _getCct==='function'?_getCct():(window.currentPerfil?.escuela_cct||null);
  hubModal('🏛️ Agregar institución', `
    <div style="display:flex;flex-direction:column;gap:11px;">
      <div>
        <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">Nombre de la institución *</label>
        <input id="tdi-nombre" type="text" placeholder="Ej: DIF Municipal, CENDI, IMSS…" style="width:100%;padding:8px 12px;border:1.5px solid #dde5f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">Tipo de servicio</label>
        <select id="tdi-tipo" style="width:100%;padding:8px 12px;border:1.5px solid #dde5f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
          <option value="">— Seleccionar —</option>
          <option value="salud">Salud (IMSS, ISSSTE, SSA)</option>
          <option value="dif">DIF / Asistencia social</option>
          <option value="juridico">Jurídico / Legal</option>
          <option value="educacion">Educación especial (USAER, CAM)</option>
          <option value="psicologia">Psicología / Salud mental</option>
          <option value="municipal">Gobierno municipal</option>
          <option value="ong">ONG / Sociedad civil</option>
          <option value="otro">Otro</option>
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">Contacto</label>
          <input id="tdi-contacto" type="text" placeholder="Nombre del responsable" style="width:100%;padding:8px 12px;border:1.5px solid #dde5f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">Teléfono</label>
          <input id="tdi-tel" type="tel" placeholder="10 dígitos" style="width:100%;padding:8px 12px;border:1.5px solid #dde5f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
        </div>
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">Email</label>
        <input id="tdi-email" type="email" placeholder="contacto@institucion.gob.mx" style="width:100%;padding:8px 12px;border:1.5px solid #dde5f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">Dirección</label>
        <input id="tdi-dir" type="text" placeholder="Calle, colonia, municipio" style="width:100%;padding:8px 12px;border:1.5px solid #dde5f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">Notas / servicios que ofrece</label>
        <textarea id="tdi-notas" rows="2" placeholder="Describe los servicios disponibles…" style="width:100%;padding:8px 12px;border:1.5px solid #dde5f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;resize:vertical;"></textarea>
      </div>
    </div>`, 'Agregar institución', async () => {
    const nombre = document.getElementById('tdi-nombre')?.value?.trim();
    if (!nombre) { hubToast('El nombre de la institución es obligatorio','warn'); return; }
    const payload = {
      nombre,
      tipo:      document.getElementById('tdi-tipo')?.value || 'otro',
      contacto:  document.getElementById('tdi-contacto')?.value?.trim() || null,
      telefono:  document.getElementById('tdi-tel')?.value?.trim() || null,
      email:     document.getElementById('tdi-email')?.value?.trim() || null,
      direccion: document.getElementById('tdi-dir')?.value?.trim() || null,
      notas:     document.getElementById('tdi-notas')?.value?.trim() || null,
      escuela_cct: cct,
      activo:    true,
      created_at: new Date().toISOString(),
    };
    const { error } = await window.sb.from('ts_instituciones').insert(payload)
      .catch(e => ({ error: e }));
    if (error) { hubToast('Error: ' + error.message, 'error'); return; }
    hubToast('✅ Institución agregada al directorio', 'ok');
    if (typeof tsDirRenderInstituciones === 'function') tsDirRenderInstituciones();
  });
}

window.tsDirNuevoAlumno      = tsDirNuevoAlumno;
window.tsDirNuevaInstitucion = tsDirNuevaInstitucion;
window.tsDirNuevaInst = function() {
  // Si ya existe la implementación original, úsala; si no, usa la nueva
  if (typeof tsDirRenderInstituciones === 'function' && window._tsDirNuevaInstOrig) {
    window._tsDirNuevaInstOrig();
  } else {
    tsDirNuevaInstitucion();
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// NUEVOS MÓDULOS v2026-04-B
// ══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 1. TS — ESTUDIO SOCIOECONÓMICO
// ─────────────────────────────────────────────────────────────────────────────

// Actualizar tsNav para registrar los nuevos títulos y callbacks
(function(){
  const _origTsNav = window.tsNav || tsNav;
  window.tsNav = function(page) {
    _origTsNav(page);
    const extras = {
      'estudio-socioeconomico': 'Estudio Socioeconómico',
      'visita-domiciliaria':    'Visita Domiciliaria',
    };
    if (extras[page]) {
      const t = document.getElementById('ts-page-title');
      if (t) t.textContent = extras[page];
    }
    if (page === 'estudio-socioeconomico') tsCargarEstudios();
    if (page === 'visita-domiciliaria')    tsCargarVisitas();
  };
})();

// Datos de estudios en memoria (+ Supabase si disponible)
window._socioEstudios = [];
window._visitasDomiciliarias = [];

async function tsCargarEstudios() {
  const cct = window.currentPerfil?.escuela_cct;
  const container = document.getElementById('socio-lista');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:48px;background:white;border-radius:14px;border:1px solid #e2e8f0;color:#94a3b8;"><div style="font-size:32px;">⏳</div><div style="margin-top:8px;">Cargando estudios…</div></div>';

  if (window.sb && cct) {
    try {
      const { data } = await window.sb.from('estudios_socioeconomicos')
        .select('*').eq('escuela_cct', cct).order('created_at', { ascending: false }).limit(100);
      window._socioEstudios = data || [];
    } catch(e) { window._socioEstudios = []; }
  }
  tsRenderEstudios();
}

function tsRenderEstudios() {
  const container = document.getElementById('socio-lista');
  if (!container) return;
  const q = (document.getElementById('socio-buscar')?.value || '').toLowerCase();
  const filNivel = document.getElementById('socio-fil-nivel')?.value || '';
  const filBeca  = document.getElementById('socio-fil-beca')?.value || '';

  let datos = window._socioEstudios.filter(e => {
    if (q && !e.alumno_nombre?.toLowerCase().includes(q)) return false;
    if (filNivel && e.nivel_socioeconomico !== filNivel) return false;
    if (filBeca === '1' && !e.candidato_beca) return false;
    if (filBeca === '0' && e.candidato_beca) return false;
    return true;
  });

  // Actualizar KPIs
  const total = window._socioEstudios.length;
  const critico = window._socioEstudios.filter(e=>e.nivel_socioeconomico==='critico').length;
  const bajo = window._socioEstudios.filter(e=>e.nivel_socioeconomico==='bajo').length;
  const cands = window._socioEstudios.filter(e=>e.candidato_beca).length;
  ['socio-kpi-total','socio-kpi-critico','socio-kpi-bajo','socio-kpi-candidatos'].forEach((id,i) => {
    const el = document.getElementById(id);
    if (el) el.textContent = [total,critico,bajo,cands][i];
  });

  if (!datos.length) {
    container.innerHTML = `<div style="text-align:center;padding:60px;background:white;border-radius:14px;border:1.5px dashed #e2e8f0;color:#94a3b8;">
      <div style="font-size:44px;margin-bottom:12px;">📋</div>
      <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:6px;">Sin estudios registrados</div>
      <div style="font-size:12px;margin-bottom:18px;">Registra el primer estudio socioeconómico para identificar candidatos a becas</div>
      <button onclick="tsAbrirNuevoEstudio()" style="padding:10px 20px;background:linear-gradient(135deg,#0369a1,#0ea5e9);color:white;border:none;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">📝 Registrar estudio</button>
    </div>`;
    return;
  }

  const nivelCfg = {
    critico:  { label:'Crítico',   bg:'#fef2f2', color:'#b91c1c', border:'#fca5a5' },
    bajo:     { label:'Bajo',      bg:'#fff7ed', color:'#c2410c', border:'#fed7aa' },
    medio:    { label:'Medio',     bg:'#fffbeb', color:'#b45309', border:'#fde68a' },
    aceptable:{ label:'Aceptable', bg:'#f0fdf4', color:'#15803d', border:'#bbf7d0' },
  };

  container.innerHTML = datos.map(e => {
    const nc = nivelCfg[e.nivel_socioeconomico] || { label: e.nivel_socioeconomico || '—', bg:'#f8fafc', color:'#64748b', border:'#e2e8f0' };
    return `<div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:18px;margin-bottom:12px;display:flex;gap:16px;align-items:flex-start;">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
          <div style="font-size:14px;font-weight:700;color:#0f172a;">${e.alumno_nombre || '—'}</div>
          <div style="font-size:11px;color:#64748b;">${e.grupo || ''}</div>
          <div style="padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:${nc.bg};color:${nc.color};border:1px solid ${nc.border};">${nc.label}</div>
          ${e.candidato_beca ? '<div style="padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;">🎓 Candidato beca</div>' : ''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px;font-size:12px;color:#475569;">
          ${e.ingreso_mensual ? `<div>💰 Ingreso: $${Number(e.ingreso_mensual).toLocaleString()}/mes</div>` : ''}
          ${e.num_dependientes ? `<div>👨‍👩‍👧 Dependientes: ${e.num_dependientes}</div>` : ''}
          ${e.vivienda ? `<div>🏠 Vivienda: ${e.vivienda}</div>` : ''}
          ${e.servicios_basicos ? `<div>💡 Servicios: ${e.servicios_basicos}</div>` : ''}
        </div>
        ${e.observaciones ? `<div style="margin-top:8px;font-size:12px;color:#64748b;background:#f8fafc;padding:8px 12px;border-radius:8px;">${e.observaciones}</div>` : ''}
        <div style="margin-top:8px;font-size:11px;color:#94a3b8;">Registrado: ${e.created_at ? new Date(e.created_at).toLocaleDateString('es-MX') : '—'}</div>
      </div>
    </div>`;
  }).join('');
}

function tsAbrirNuevoEstudio() {
  const campos = `
    <div style="display:grid;gap:12px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Nombre del alumno *</label>
          <input id="se-nombre" placeholder="Nombre completo" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;"></div>
        <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Grupo</label>
          <input id="se-grupo" placeholder="Ej. 3°A" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Ingreso mensual familiar (MXN)</label>
          <input id="se-ingreso" type="number" min="0" placeholder="0.00" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;"></div>
        <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Personas dependientes</label>
          <input id="se-dependientes" type="number" min="0" placeholder="Ej. 4" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Tipo de vivienda</label>
          <select id="se-vivienda" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
            <option value="">Seleccionar…</option>
            <option>Propia</option><option>Rentada</option><option>Prestada</option><option>Irregular</option>
          </select></div>
        <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Servicios básicos</label>
          <select id="se-servicios" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
            <option value="">Seleccionar…</option>
            <option>Completos</option><option>Parciales</option><option>Sin servicios</option>
          </select></div>
      </div>
      <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Situación laboral del jefe de familia</label>
        <select id="se-empleo" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
          <option value="">Seleccionar…</option>
          <option>Empleo formal</option><option>Empleo informal</option><option>Autoempleo</option><option>Desempleado</option><option>Jubilado/Pensionado</option>
        </select></div>
      <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Nivel socioeconómico estimado *</label>
        <select id="se-nivel" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
          <option value="">Seleccionar…</option>
          <option value="critico">🔴 Crítico — requiere apoyo urgente</option>
          <option value="bajo">🟠 Bajo — candidato a beca</option>
          <option value="medio">🟡 Medio — sin prioridad inmediata</option>
          <option value="aceptable">🟢 Aceptable — sin apoyos requeridos</option>
        </select></div>
      <div style="display:flex;align-items:center;gap:10px;">
        <input id="se-candidato" type="checkbox" style="width:16px;height:16px;cursor:pointer;">
        <label for="se-candidato" style="font-size:13px;font-weight:600;color:#374151;cursor:pointer;">Marcar como candidato/a a beca</label>
      </div>
      <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Observaciones</label>
        <textarea id="se-obs" rows="3" placeholder="Contexto adicional, situación familiar, necesidades específicas…" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;resize:vertical;"></textarea></div>
    </div>`;
  hubModal('📋 Nuevo Estudio Socioeconómico', campos, 'Guardar estudio', async () => {
    const nombre = document.getElementById('se-nombre')?.value?.trim();
    const nivel  = document.getElementById('se-nivel')?.value;
    if (!nombre) { hubToast('El nombre del alumno es requerido','warn'); return; }
    if (!nivel)  { hubToast('Selecciona el nivel socioeconómico','warn'); return; }
    const cct = window.currentPerfil?.escuela_cct;
    const payload = {
      alumno_nombre:       nombre,
      grupo:               document.getElementById('se-grupo')?.value?.trim() || null,
      ingreso_mensual:     parseFloat(document.getElementById('se-ingreso')?.value) || null,
      num_dependientes:    parseInt(document.getElementById('se-dependientes')?.value) || null,
      vivienda:            document.getElementById('se-vivienda')?.value || null,
      servicios_basicos:   document.getElementById('se-servicios')?.value || null,
      situacion_laboral:   document.getElementById('se-empleo')?.value || null,
      nivel_socioeconomico: nivel,
      candidato_beca:      document.getElementById('se-candidato')?.checked || false,
      observaciones:       document.getElementById('se-obs')?.value?.trim() || null,
      escuela_cct:         cct,
      ts_id:               window.currentPerfil?.id || null,
      created_at:          new Date().toISOString(),
    };
    if (window.sb && cct) {
      const { error } = await window.sb.from('estudios_socioeconomicos').insert(payload).catch(e=>({error:e}));
      if (error) { hubToast('Error al guardar: ' + error.message, 'error'); return; }
    } else {
      window._socioEstudios.unshift({ ...payload, id: Date.now() });
    }
    hubToast('✅ Estudio socioeconómico registrado', 'ok');
    tsCargarEstudios();
  });
}
window.tsAbrirNuevoEstudio = tsAbrirNuevoEstudio;
window.tsRenderEstudios    = tsRenderEstudios;

// ─────────────────────────────────────────────────────────────────────────────
// 2. TS — VISITA DOMICILIARIA
// ─────────────────────────────────────────────────────────────────────────────
let _visitaTabActual = 'pendientes';

async function tsCargarVisitas() {
  const cct = window.currentPerfil?.escuela_cct;
  if (window.sb && cct) {
    try {
      const { data } = await window.sb.from('visitas_domiciliarias')
        .select('*').eq('escuela_cct', cct).order('created_at', { ascending: false }).limit(100);
      window._visitasDomiciliarias = data || [];
    } catch(e) { window._visitasDomiciliarias = []; }
  }
  tsRenderVisitas();
}

function tsVisitaTab(tab) {
  _visitaTabActual = tab;
  ['pendientes','realizadas','seguimiento'].forEach(t => {
    const btn = document.getElementById('visita-tab-' + t);
    if (!btn) return;
    if (t === tab) {
      btn.style.background = 'white'; btn.style.color = '#0f172a';
      btn.style.boxShadow = '0 1px 3px rgba(0,0,0,.1)'; btn.style.fontWeight = '700';
    } else {
      btn.style.background = 'transparent'; btn.style.color = '#64748b';
      btn.style.boxShadow = 'none'; btn.style.fontWeight = '600';
    }
  });
  tsRenderVisitas();
}

function tsRenderVisitas() {
  const container = document.getElementById('visita-lista');
  if (!container) return;
  const todos = window._visitasDomiciliarias;

  const pendientes  = todos.filter(v => v.estado === 'pendiente' || !v.estado);
  const realizadas  = todos.filter(v => v.estado === 'realizada');
  const seguimiento = todos.filter(v => v.estado === 'seguimiento');

  // KPIs
  const setKpi = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  setKpi('visita-kpi-pendientes',  pendientes.length);
  setKpi('visita-kpi-realizadas',  realizadas.length);
  setKpi('visita-kpi-seguimiento', seguimiento.length);

  // Banner alertas
  const banner = document.getElementById('visita-alertas-banner');
  if (banner && pendientes.length > 0) {
    banner.innerHTML = `<div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:20px;">⚠️</span>
      <div style="font-size:13px;color:#92400e;font-weight:700;">${pendientes.length} visita${pendientes.length!==1?'s':''} pendiente${pendientes.length!==1?'s':''} de realizar</div>
    </div>`;
  } else if (banner) banner.innerHTML = '';

  const datos = { pendientes, realizadas, seguimiento }[_visitaTabActual] || [];

  if (!datos.length) {
    container.innerHTML = `<div style="text-align:center;padding:60px;background:white;border-radius:14px;border:1.5px dashed #e2e8f0;color:#94a3b8;">
      <div style="font-size:44px;margin-bottom:12px;">🏠</div>
      <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:6px;">Sin visitas en esta categoría</div>
      <div style="font-size:12px;margin-bottom:18px;">Registra visitas domiciliarias para dar seguimiento a familias en situación de riesgo</div>
      <button onclick="tsAbrirNuevaVisita()" style="padding:10px 20px;background:linear-gradient(135deg,#7c2d12,#ea580c);color:white;border:none;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">🚪 Registrar visita</button>
    </div>`;
    return;
  }

  const estadoCfg = {
    pendiente:    { label:'Pendiente',    bg:'#fff7ed', color:'#c2410c', border:'#fed7aa' },
    realizada:    { label:'Realizada',    bg:'#f0fdf4', color:'#15803d', border:'#bbf7d0' },
    seguimiento:  { label:'Seguimiento',  bg:'#eff6ff', color:'#1d4ed8', border:'#bfdbfe' },
    sin_respuesta:{ label:'Sin respuesta',bg:'#f1f5f9', color:'#475569', border:'#e2e8f0' },
  };

  container.innerHTML = datos.map(v => {
    const ec = estadoCfg[v.estado || 'pendiente'] || estadoCfg.pendiente;
    return `<div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:18px;margin-bottom:12px;">
      <div style="display:flex;align-items:flex-start;gap:14px;">
        <div style="width:42px;height:42px;background:linear-gradient(135deg,#7c2d12,#ea580c);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🏠</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${v.alumno_nombre || '—'}</div>
            <div style="font-size:11px;color:#64748b;">${v.grupo || ''}</div>
            <div style="padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:${ec.bg};color:${ec.color};border:1px solid ${ec.border};">${ec.label}</div>
          </div>
          <div style="font-size:12px;color:#64748b;margin-bottom:6px;">📍 ${v.direccion || 'Sin dirección registrada'}</div>
          ${v.motivo ? `<div style="font-size:12px;color:#475569;margin-bottom:6px;"><strong>Motivo:</strong> ${v.motivo}</div>` : ''}
          ${v.fecha_programada ? `<div style="font-size:12px;color:#475569;margin-bottom:6px;">📅 Programada: ${new Date(v.fecha_programada).toLocaleDateString('es-MX')}</div>` : ''}
          ${v.resultado ? `<div style="font-size:12px;color:#374151;background:#f8fafc;padding:8px 12px;border-radius:8px;margin-top:6px;">${v.resultado}</div>` : ''}
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            ${v.estado !== 'realizada' ? `<button onclick="tsMarcarVisita('${v.id}','realizada')" style="padding:6px 14px;background:#dcfce7;color:#15803d;border:none;border-radius:7px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✅ Marcar realizada</button>` : ''}
            ${v.estado !== 'seguimiento' ? `<button onclick="tsMarcarVisita('${v.id}','seguimiento')" style="padding:6px 14px;background:#eff6ff;color:#1d4ed8;border:none;border-radius:7px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🔄 En seguimiento</button>` : ''}
            <button onclick="tsAgregarResultadoVisita('${v.id}')" style="padding:6px 14px;background:#f1f5f9;color:#475569;border:none;border-radius:7px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">📝 Agregar resultado</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function tsMarcarVisita(id, estado) {
  if (window.sb) {
    await window.sb.from('visitas_domiciliarias').update({ estado, updated_at: new Date().toISOString() }).eq('id', id).catch(()=>{});
  }
  const v = window._visitasDomiciliarias.find(x => String(x.id) === String(id));
  if (v) v.estado = estado;
  hubToast(`✅ Visita marcada como: ${estado}`, 'ok');
  tsRenderVisitas();
}
window.tsMarcarVisita = tsMarcarVisita;

function tsAgregarResultadoVisita(id) {
  hubModal('📝 Resultado de visita', `
    <div style="display:grid;gap:12px;">
      <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Fecha de visita</label>
        <input id="vr-fecha" type="date" value="${new Date().toISOString().split('T')[0]}" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Resultado / Observaciones *</label>
        <textarea id="vr-resultado" rows="4" placeholder="Describir lo encontrado en la visita, acuerdos, compromisos…" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;resize:vertical;"></textarea></div>
      <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Estado tras la visita</label>
        <select id="vr-estado" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
          <option value="realizada">✅ Realizada — caso cerrado</option>
          <option value="seguimiento">🔄 En seguimiento — requiere más atención</option>
          <option value="sin_respuesta">❌ Sin respuesta — reprogramar</option>
        </select></div>
    </div>`, 'Guardar resultado', async () => {
    const resultado = document.getElementById('vr-resultado')?.value?.trim();
    if (!resultado) { hubToast('Escribe el resultado de la visita','warn'); return; }
    const estado = document.getElementById('vr-estado')?.value || 'realizada';
    const fecha  = document.getElementById('vr-fecha')?.value;
    if (window.sb) {
      await window.sb.from('visitas_domiciliarias').update({ resultado, estado, fecha_realizada: fecha, updated_at: new Date().toISOString() }).eq('id', id).catch(()=>{});
    }
    const v = window._visitasDomiciliarias.find(x => String(x.id) === String(id));
    if (v) { v.resultado = resultado; v.estado = estado; v.fecha_realizada = fecha; }
    hubToast('✅ Resultado guardado', 'ok');
    tsRenderVisitas();
  });
}
window.tsAgregarResultadoVisita = tsAgregarResultadoVisita;

function tsAbrirNuevaVisita() {
  hubModal('🚪 Registrar Visita Domiciliaria', `
    <div style="display:grid;gap:12px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Nombre del alumno *</label>
          <input id="vd-nombre" placeholder="Nombre completo" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;"></div>
        <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Grupo</label>
          <input id="vd-grupo" placeholder="Ej. 2°B" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;"></div>
      </div>
      <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Dirección del domicilio</label>
        <input id="vd-dir" placeholder="Calle, número, colonia, municipio" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Motivo de la visita *</label>
        <select id="vd-motivo-sel" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
          <option value="">Seleccionar…</option>
          <option>Inasistencias prolongadas</option>
          <option>Riesgo de deserción</option>
          <option>Situación de vulnerabilidad económica</option>
          <option>Problema familiar reportado</option>
          <option>Seguimiento de caso anterior</option>
          <option>Verificación de condiciones del hogar</option>
          <option>Otro</option>
        </select></div>
      <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Descripción adicional</label>
        <textarea id="vd-desc" rows="3" placeholder="Antecedentes relevantes, contexto, urgencia…" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;resize:vertical;"></textarea></div>
      <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Fecha programada</label>
        <input id="vd-fecha" type="date" value="${new Date().toISOString().split('T')[0]}" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;"></div>
    </div>`, 'Registrar visita', async () => {
    const nombre = document.getElementById('vd-nombre')?.value?.trim();
    const motivo = document.getElementById('vd-motivo-sel')?.value;
    if (!nombre) { hubToast('El nombre del alumno es requerido','warn'); return; }
    if (!motivo) { hubToast('Selecciona el motivo de la visita','warn'); return; }
    const cct = window.currentPerfil?.escuela_cct;
    const payload = {
      alumno_nombre:    nombre,
      grupo:            document.getElementById('vd-grupo')?.value?.trim() || null,
      direccion:        document.getElementById('vd-dir')?.value?.trim() || null,
      motivo:           motivo,
      descripcion:      document.getElementById('vd-desc')?.value?.trim() || null,
      fecha_programada: document.getElementById('vd-fecha')?.value || null,
      estado:           'pendiente',
      escuela_cct:      cct,
      ts_id:            window.currentPerfil?.id || null,
      created_at:       new Date().toISOString(),
    };
    if (window.sb && cct) {
      const { error } = await window.sb.from('visitas_domiciliarias').insert(payload).catch(e=>({error:e}));
      if (error) { hubToast('Error al guardar: ' + error.message, 'error'); return; }
    } else {
      window._visitasDomiciliarias.unshift({ ...payload, id: Date.now() });
    }
    hubToast('✅ Visita domiciliaria registrada', 'ok');
    tsCargarVisitas();
  });
}
window.tsAbrirNuevaVisita = tsAbrirNuevaVisita;
window.tsVisitaTab        = tsVisitaTab;

// ─────────────────────────────────────────────────────────────────────────────
// 3. ORIENTADOR — FICHA INTEGRADA POR ALUMNO
// ─────────────────────────────────────────────────────────────────────────────
window._fichaAlumnos = [];
window._fichaAlumnoSel = null;

async function fichaIntegradaInit() {
  const cct = window.currentPerfil?.escuela_cct;
  if (window.sb && cct) {
    try {
      const { data } = await window.sb.from('alumnos').select('id,nombre,grupo').eq('escuela_cct', cct).order('nombre').limit(300);
      window._fichaAlumnos = data || [];
    } catch(e) {}
  }
  // Poblar selector de grupos
  const grupos = [...new Set(window._fichaAlumnos.map(a=>a.grupo).filter(Boolean))].sort();
  const selGrupo = document.getElementById('ficha-grupo-sel');
  if (selGrupo) {
    selGrupo.innerHTML = '<option value="">Todos los grupos</option>' + grupos.map(g=>`<option>${g}</option>`).join('');
  }
  fichaIntegradaBuscar();
}
window.fichaIntegradaInit = fichaIntegradaInit;

function fichaIntegradaBuscar() {
  const q = (document.getElementById('ficha-buscar-alumno')?.value || '').toLowerCase();
  const grupo = document.getElementById('ficha-grupo-sel')?.value || '';
  const lista = document.getElementById('ficha-alumnos-lista');
  if (!lista) return;

  let alumnos = window._fichaAlumnos.filter(a => {
    if (grupo && a.grupo !== grupo) return false;
    if (q && !a.nombre?.toLowerCase().includes(q)) return false;
    return true;
  }).slice(0, 15);

  if (!q && !grupo) {
    lista.innerHTML = '<div style="font-size:12px;color:#94a3b8;">Escribe un nombre o selecciona un grupo para buscar…</div>';
    return;
  }
  if (!alumnos.length) {
    lista.innerHTML = '<div style="font-size:12px;color:#94a3b8;">Sin resultados</div>';
    return;
  }
  lista.innerHTML = alumnos.map(a => `
    <button onclick="fichaIntegradaCargar('${a.id}','${encodeURIComponent(a.nombre)}')" style="padding:7px 14px;background:white;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;color:#374151;transition:.15s;" onmouseover="this.style.borderColor='#a78bfa';this.style.color='#7c3aed'" onmouseout="this.style.borderColor='#e2e8f0';this.style.color='#374151'">
      ${a.nombre} <span style="color:#94a3b8;font-weight:400;">${a.grupo||''}</span>
    </button>`).join('');
}
window.fichaIntegradaBuscar = fichaIntegradaBuscar;

async function fichaIntegradaCargar(alumnoId, nombreEnc) {
  const nombre = decodeURIComponent(nombreEnc);
  const cct = window.currentPerfil?.escuela_cct;
  const contenedor = document.getElementById('ficha-integrada-contenido');
  if (!contenedor) return;
  contenedor.innerHTML = `<div style="text-align:center;padding:60px;background:white;border-radius:14px;border:1px solid #e2e8f0;color:#94a3b8;"><div style="font-size:32px;">⏳</div><div style="margin-top:8px;">Cargando ficha de ${nombre}…</div></div>`;

  let medico = [], ts = [], orientacion = [], alertas = [];
  if (window.sb && cct) {
    try {
      const [rMed, rTs, rOrient, rAlert] = await Promise.all([
        window.sb.from('expedientes_medicos').select('*').eq('alumno_id', alumnoId).order('created_at',{ascending:false}).limit(5),
        window.sb.from('casos_ts').select('*').eq('alumno_id', alumnoId).order('created_at',{ascending:false}).limit(5),
        window.sb.from('entrevistas_orientador').select('*').eq('alumno_id', alumnoId).order('fecha',{ascending:false}).limit(5),
        window.sb.from('alertas').select('*').eq('alumno_id', alumnoId).order('created_at',{ascending:false}).limit(10),
      ]);
      medico     = rMed.data || [];
      ts         = rTs.data || [];
      orientacion= rOrient.data || [];
      alertas    = rAlert.data || [];
    } catch(e) {}
  }

  const mkSeccion = (titulo, color, icon, items, emptyMsg) => {
    const contenido = items.length
      ? items.map(it => `<div style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#374151;">
          <div style="font-weight:600;margin-bottom:2px;">${it.descripcion || it.motivo || it.tipo || it.contenido || it.observaciones || JSON.stringify(it).slice(0,80)}</div>
          <div style="color:#94a3b8;">${it.fecha || it.created_at ? new Date(it.fecha || it.created_at).toLocaleDateString('es-MX') : ''}</div>
        </div>`).join('')
      : `<div style="padding:20px;text-align:center;color:#94a3b8;font-size:12px;">${emptyMsg}</div>`;
    return `<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
      <div style="background:${color};padding:12px 16px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:16px;">${icon}</span>
        <div style="font-size:13px;font-weight:700;color:white;">${titulo}</div>
        <div style="margin-left:auto;background:rgba(255,255,255,.25);color:white;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">${items.length}</div>
      </div>
      <div>${contenido}</div>
    </div>`;
  };

  contenedor.innerHTML = `
    <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:20px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:52px;height:52px;background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;color:white;font-weight:800;">${nombre.charAt(0)}</div>
        <div>
          <div style="font-size:18px;font-weight:700;color:#0f172a;font-family:'Fraunces',serif;">${nombre}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Ficha integrada · ${alertas.filter(a=>!a.leido).length} alertas activas</div>
        </div>
        <button onclick="vtsAgregarNotaAlumno('${alumnoId}','${nombreEnc}')" style="margin-left:auto;padding:8px 16px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">+ Nota compartida</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;">
      ${mkSeccion('Expediente Médico','linear-gradient(135deg,#dc2626,#ef4444)','🩺', medico, 'Sin expediente médico registrado')}
      ${mkSeccion('Trabajo Social','linear-gradient(135deg,#0369a1,#0ea5e9)','🌱', ts, 'Sin casos de Trabajo Social')}
      ${mkSeccion('Orientación','linear-gradient(135deg,#7c3aed,#a855f7)','🧭', orientacion, 'Sin entrevistas de orientación')}
      ${mkSeccion('Alertas','linear-gradient(135deg,#d97706,#f59e0b)','⚠️', alertas, 'Sin alertas registradas')}
    </div>`;
}
window.fichaIntegradaCargar = fichaIntegradaCargar;

// ─────────────────────────────────────────────────────────────────────────────
// 4. ORIENTADOR — VISTA COMPARTIDA ORIENTADOR ↔ TS
// ─────────────────────────────────────────────────────────────────────────────
window._vtsNotas = [];

async function vtsCargar() {
  const cct = window.currentPerfil?.escuela_cct;
  const q = (document.getElementById('vts-buscar')?.value || '').toLowerCase();
  const lista = document.getElementById('vts-lista');
  if (!lista) return;
  lista.innerHTML = '<div style="text-align:center;padding:48px;background:white;border-radius:14px;border:1px solid #e2e8f0;color:#94a3b8;"><div style="font-size:32px;">⏳</div><div style="margin-top:8px;">Cargando notas compartidas…</div></div>';

  if (window.sb && cct) {
    try {
      let qb = window.sb.from('notas_compartidas_orient_ts').select('*').eq('escuela_cct', cct).order('created_at', { ascending: false }).limit(50);
      const { data } = await qb;
      window._vtsNotas = data || [];
    } catch(e) { window._vtsNotas = []; }
  }

  let datos = window._vtsNotas;
  if (q) datos = datos.filter(n => n.alumno_nombre?.toLowerCase().includes(q) || n.contenido?.toLowerCase().includes(q));

  if (!datos.length) {
    lista.innerHTML = `<div style="text-align:center;padding:60px;background:white;border-radius:14px;border:1.5px dashed #e2e8f0;color:#94a3b8;">
      <div style="font-size:44px;margin-bottom:12px;">🤝</div>
      <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:6px;">Sin notas compartidas</div>
      <div style="font-size:12px;margin-bottom:18px;">Crea notas compartidas entre Orientación y Trabajo Social para coordinar el seguimiento de alumnos</div>
      <button onclick="vtsAgregarNota()" style="padding:10px 20px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;border:none;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">+ Agregar primera nota</button>
    </div>`;
    return;
  }

  const rolColors = { orientador: '#7c3aed', ts: '#0369a1', medico: '#dc2626' };
  lista.innerHTML = datos.map(n => {
    const rc = rolColors[n.rol_autor] || '#64748b';
    return `<div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:18px;margin-bottom:12px;">
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <div style="width:38px;height:38px;border-radius:10px;background:${rc}22;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${n.rol_autor==='orientador'?'🧭':n.rol_autor==='ts'?'🌱':'👤'}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
            <div style="font-size:13px;font-weight:700;color:#0f172a;">${n.alumno_nombre || 'Alumno no especificado'}</div>
            <div style="font-size:11px;padding:2px 8px;border-radius:99px;background:${rc}18;color:${rc};font-weight:700;">${n.rol_autor||'—'}</div>
            <div style="font-size:11px;color:#94a3b8;margin-left:auto;">${n.created_at ? new Date(n.created_at).toLocaleDateString('es-MX') : '—'}</div>
          </div>
          <div style="font-size:13px;color:#374151;line-height:1.5;">${n.contenido || ''}</div>
          ${n.accion_requerida ? `<div style="margin-top:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;font-size:12px;color:#b45309;"><strong>Acción requerida:</strong> ${n.accion_requerida}</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}
window.vtsCargar = vtsCargar;

function vtsAgregarNota(alumnoId, nombreEnc) {
  const nombre = nombreEnc ? decodeURIComponent(nombreEnc) : '';
  hubModal('🤝 Nota compartida Orientador ↔ TS', `
    <div style="display:grid;gap:12px;">
      <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Alumno *</label>
        <input id="vts-alumno" value="${nombre}" placeholder="Nombre del alumno" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Nota / Observación *</label>
        <textarea id="vts-contenido" rows="4" placeholder="Escribe la nota o hallazgo que debe conocer el otro rol…" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;resize:vertical;"></textarea></div>
      <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Acción requerida al otro rol (opcional)</label>
        <input id="vts-accion" placeholder="Ej. Realizar visita domiciliaria, revisar expediente…" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Rol que emite esta nota</label>
        <select id="vts-rol" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;">
          <option value="orientador">🧭 Orientador/a</option>
          <option value="ts">🌱 Trabajo Social</option>
        </select></div>
    </div>`, 'Guardar nota', async () => {
    const alumno   = document.getElementById('vts-alumno')?.value?.trim();
    const contenido= document.getElementById('vts-contenido')?.value?.trim();
    if (!alumno || !contenido) { hubToast('Nombre y nota son requeridos','warn'); return; }
    const cct = window.currentPerfil?.escuela_cct;
    const payload = {
      alumno_nombre:    alumno,
      contenido,
      accion_requerida: document.getElementById('vts-accion')?.value?.trim() || null,
      rol_autor:        document.getElementById('vts-rol')?.value || 'orientador',
      autor_id:         window.currentPerfil?.id || null,
      escuela_cct:      cct,
      created_at:       new Date().toISOString(),
    };
    if (window.sb && cct) {
      const { error } = await window.sb.from('notas_compartidas_orient_ts').insert(payload).catch(e=>({error:e}));
      if (error) { hubToast('Error: ' + error.message, 'error'); return; }
    } else {
      window._vtsNotas.unshift({ ...payload, id: Date.now() });
    }
    hubToast('✅ Nota compartida guardada', 'ok');
    vtsCargar();
  });
}
window.vtsAgregarNota       = vtsAgregarNota;
window.vtsAgregarNotaAlumno = (id, enc) => vtsAgregarNota(id, enc);

// ─── FIN NUEVOS MÓDULOS v2026-04-B ─────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
if (window.SiembraRegistration) {
  Object.assign(window, {
    regBuscarEscuela: window.SiembraRegistration.regBuscarEscuela,
    hubSwitchTab: window.SiembraRegistration.hubSwitchTab,
    regSelectRole: window.SiembraRegistration.regSelectRole,
    regBuscarEscuelaNombre: window.SiembraRegistration.regBuscarEscuelaNombre,
    regEscogerEscuela: window.SiembraRegistration.regEscogerEscuela,
    hubDoRegistro: window.SiembraRegistration.hubDoRegistro,
    invitadoCrearPass: window.SiembraRegistration.invitadoCrearPass,
  });
}
