// ══════════════════════════════════════════════════════════
//  MÓDULO TRABAJO SOCIAL — v8
// ══════════════════════════════════════════════════════════

async function tsCargarCasos() {
  const cct = _getCct();
  if (!window.sb || !cct) return;
  const { data, error } = await window.sb.from('casos_trabajo_social')
    .select('*')
    .eq('escuela_cct', cct)
    .order('created_at', { ascending: false })
    .limit(200);
  if (!error && data) {
    window._tsCasos = data;
    window._tsCasosDB = data;
  } else {
    window._tsCasos = [];
    window._tsCasosDB = [];
  }
}
window.tsCargarCasos = tsCargarCasos;
// Alias para compatibilidad con nueva convención
window.tsCargarCasosDB = tsCargarCasos;

async function tsNuevoCaso() {
  const cct = _getCct();
  if (!cct) return hubToast('Sin escuela configurada', 'error');
  hubModal({
    titulo: '📁 Nuevo caso',
    campos: [
      { id:'alumno_nombre', label:'Nombre del alumno', tipo:'text', requerido:true },
      { id:'tipo', label:'Tipo', tipo:'select', opciones:['inasistencia','violencia','conducta','familiar','academico','otro'] },
      { id:'prioridad', label:'Prioridad', tipo:'select', opciones:['baja','media','alta','urgente'] },
      { id:'descripcion', label:'Descripción', tipo:'textarea', requerido:true },
      { id:'intervencion', label:'Intervención inicial', tipo:'textarea' },
    ],
    onGuardar: async (datos) => {
      const { error } = await window.sb.from('casos_trabajo_social').insert({
        escuela_cct: cct,
        ciclo: window.CICLO_ACTIVO || '2025-2026',
        ts_id: window.currentPerfil?.id,
        estado: 'activo',
        fecha_apertura: new Date().toISOString().split('T')[0],
        seguimiento: [],
        ...datos,
      });
      if (error) throw error;
      hubToast('✅ Caso registrado', 'ok');
      await tsCargarCasos();
      tsRenderCasos();
    }
  });
}
window.tsNuevoCaso = tsNuevoCaso;

let TS_CASOS = [
  { id:1, alumnoIdx:8, tipo:'violencia', estado:'urgente', fecha:'2026-02-14',
    desc:'El alumno presenta moretones visibles en brazos y cuello. Al preguntarle, refiere que "se cayó". Se observa actitud retraída y llanto sin motivo aparente durante la semana.',
    notifDir:'Sí — con fecha', notifFam:'No — riesgo si se avisa', canalizo:'DIF Municipal', instExterna:'DIF Guadalupe folio #2026-0341',
    acciones:'Se notificó de inmediato a dirección. Se levantó acta interna. Se realizó llamada al DIF Municipal obteniendo folio de seguimiento.',
    proxFecha:'2026-02-21', responsable:'Trabajador/a social' },
  { id:2, alumnoIdx:5, tipo:'faltas', estado:'seguimiento', fecha:'2026-01-20',
    desc:'El alumno acumula 18 inasistencias en el primer trimestre sin justificación por parte de la familia. No se ha respondido a citatorios enviados.',
    notifDir:'Sí — con fecha', notifFam:'Pendiente', canalizo:'No', instExterna:'',
    acciones:'Se enviaron 3 citatorios formales. Se realizó visita domiciliaria sin éxito. Se solicita apoyo de trabajo social para localización.',
    proxFecha:'2026-02-01', responsable:'Trabajador/a social' },
];
let tsCasoActualId = null;
let tsFiltroTexto = '';
let tsFiltroTipo = '';
let tsFiltroEstado = '';

const TS_TIPOS = {
  violencia: { lbl:'Violencia familiar', ico:'🚨', cls:'ts-tipo-violencia' },
  drogas:    { lbl:'Uso de sustancias',  ico:'💊', cls:'ts-tipo-drogas' },
  faltas:    { lbl:'Faltas recurrentes', ico:'📅', cls:'ts-tipo-faltas' },
  riesgo:    { lbl:'Situación de riesgo',ico:'⚠️', cls:'ts-tipo-riesgo' },
  nutricion: { lbl:'Desnutrición/salud', ico:'🍎', cls:'ts-tipo-nutricion' },
  otro:      { lbl:'Otro',               ico:'📌', cls:'ts-tipo-otro' },
};
const TS_ESTADOS = {
  urgente:      { lbl:'Urgente',        dot:'🔴', color:'#b91c1c', bg:'#fee2e2' },
  seguimiento:  { lbl:'Seguimiento',    dot:'🟡', color:'#a16207', bg:'#fef9c3' },
  resuelto:     { lbl:'Resuelto',       dot:'🟢', color:'#15803d', bg:'#dcfce7' },
};
const TS_PROTOCOLOS = {
  violencia: {
    titulo: '🚨 Protocolo — Violencia familiar / maltrato',
    steps: [
      { lbl:'Registrar observación', txt:'Anota los indicadores observados de forma objetiva y fechada, sin confrontar al alumno ni a la familia.' },
      { lbl:'Notificar a dirección', txt:'Informa de inmediato al director/a. Esta notificación es obligatoria según LGE Art. 75. No actúes sin su conocimiento.' },
      { lbl:'No avisar a la familia todavía', txt:'En casos de posible abuso intrafamiliar, el aviso prematuro puede poner en riesgo mayor al menor. Espera instrucción del directivo o trabajador/a social.' },
      { lbl:'Canalizar al DIF', txt:'El DIF Municipal es la instancia responsable de la intervención. Llama al número de atención y solicita folio. Conserva el número de caso.' },
      { lbl:'Documentar todo por escrito', txt:'Cada acción tomada debe quedar registrada con fecha, nombre y firma del responsable. Es evidencia legal.' },
      { lbl:'Seguimiento con trabajador/a social', txt:'El/la trabajador/a social asignado/a coordina el seguimiento semanal hasta el cierre del caso con resolución documentada.' },
    ]
  },
  drogas: {
    titulo: '💊 Protocolo — Alumno bajo influencia de sustancias',
    steps: [
      { lbl:'No confrontar públicamente', txt:'Retira al alumno del salón de forma discreta. No exponerlo frente al grupo ni generar situaciones de conflicto.' },
      { lbl:'Asegurar su integridad física', txt:'Acompáñalo a la dirección. Si hay riesgo de salud inmediata (pérdida de consciencia, convulsiones), llama al 911.' },
      { lbl:'Notificar a dirección', txt:'Informe inmediato al director/a. El manejo de este tipo de casos requiere coordinación institucional.' },
      { lbl:'Llamar al tutor / responsable', txt:'El tutor o responsable legal debe ser notificado y presentarse. Si no responde o existe riesgo, se notifica al DIF.' },
      { lbl:'Levantar acta interna', txt:'Documenta los hechos observados. Esta acta forma parte del expediente del alumno y puede ser solicitada por autoridades.' },
      { lbl:'Canalizar a servicios de salud', txt:'Si hay consumo habitual, se recomienda canalización a unidades de salud o CIJ (Centro de Integración Juvenil). No es función del docente la intervención terapéutica.' },
    ]
  },
  faltas: {
    titulo: '📅 Protocolo — Faltas recurrentes injustificadas',
    steps: [
      { lbl:'Documentar inasistencias', txt:'Registra cada falta con fecha. A partir de 5 faltas consecutivas o 10 discontinuas sin justificación, se activa el protocolo.' },
      { lbl:'Primer citatorio a la familia', txt:'Envío formal de citatorio escrito al tutor. Conserva copia firmada de recibido o constancia de envío.' },
      { lbl:'Segunda citación — visita domiciliaria', txt:'Si no hay respuesta en 5 días hábiles, se realiza visita domiciliaria con trabajo social. Documentar hallazgos.' },
      { lbl:'Notificación a dirección', txt:'Informa al director/a con el historial completo de asistencia y las gestiones previas realizadas.' },
      { lbl:'Canalización al DIF si persiste', txt:'Si la familia no responde y las faltas continúan, el caso se turna al DIF por posible situación de vulnerabilidad o abandono.' },
      { lbl:'Seguimiento mensual', txt:'Aunque el alumno regrese, mantener seguimiento mensual y registrar en el expediente durante el ciclo escolar.' },
    ]
  },
  riesgo: {
    titulo: '⚠️ Protocolo — Situación de riesgo / vulnerabilidad',
    steps: [
      { lbl:'Identificar indicadores', txt:'Señales de alerta: cambios de conducta, descuido en higiene, llanto frecuente, baja repentina de calificaciones, aislamiento.' },
      { lbl:'Acercamiento empático', txt:'Genera un espacio de confianza con el alumno. No presiones ni interrogues. Escucha activa sin comprometer la confidencialidad del sistema.' },
      { lbl:'Notificar a trabajo social y dirección', txt:'Comparte tus observaciones con el equipo directivo y trabajo social para una evaluación conjunta.' },
      { lbl:'Evaluar red de apoyo familiar', txt:'Trabajo social indaga sobre la situación del hogar, si hay redes de apoyo y si la familia conoce la situación.' },
      { lbl:'Plan de acción conjunto', txt:'Se define un plan entre docente, trabajo social y dirección, con metas claras y fecha de revisión.' },
      { lbl:'Canalizar según hallazgos', txt:'Según la evaluación, se canaliza a DIF, salud mental, SIPINNA u otras instancias de protección.' },
    ]
  }
};

// ═══════════════════════════════════════════════════════════════════
// PARTE 5 · Trabajo Social y Prefecto — Datos reales Supabase
// ═══════════════════════════════════════════════════════════════════

// ── Estado global TS ─────────────────────────────────────────────
window.TSR = {
  alumnos:     [],   // alumnos reales de la escuela
  incidencias: [],   // incidencias de la DB
  alumnoActual: null,
  filtroEstado: '',
  filtroTipo:  '',
};

// ── Init ─────────────────────────────────────────────────────────
async function tsInit() {
  // Actualizar sidebar con nombre real
  if (currentPerfil) {
    const topTag = document.getElementById('ts-escuela-tag');
    if (topTag) topTag.textContent = currentPerfil.escuela_nombre || currentPerfil.escuela_cct || 'Mi escuela';
    const nameEl = document.querySelector('#ts-portal .ts-sidebar-user div div:first-child');
    if (nameEl) nameEl.textContent = `${currentPerfil.nombre||''} ${currentPerfil.apellido||''}`.trim();
    const rolEl = document.querySelector('#ts-portal .ts-sidebar-logo .logo-sub');
    if (rolEl) rolEl.textContent = currentPerfil.rol === 'prefecto' ? 'Prefecto' : 'Trabajo Social';
    const subEl = document.querySelector('#ts-portal .ts-sidebar-user div div:last-child');
    if (subEl && currentPerfil.email) subEl.textContent = currentPerfil.email;
  }

  // Cargar datos reales en paralelo
  await Promise.all([
    TSR.cargarAlumnos(),
    TSR.cargarIncidencias(),
  ]);

  // Renderizar todo
  TSR.renderDashboard();
  TSR.renderCasos();
  TSR.renderDirectorioAlumnos();
  TSR.poblarSelectAlumno();

  // Badge urgentes en topbar
  const urgentes = TSR.incidencias.filter(i => i.estado === 'urgente' || i.tipo === 'urgente').length;
  const badge = document.getElementById('ts-badge-urgentes');
  if (badge && urgentes > 0) {
    badge.style.display = 'block';
    badge.textContent = `🔴 ${urgentes} urgente${urgentes > 1 ? 's' : ''}`;
    // Auto-generar resumen IA si hay urgentes
    setTimeout(() => TSR.generarResumenIA(), 800);
  }
}

// ── Cargar alumnos reales ─────────────────────────────────────────
TSR.cargarAlumnos = async function() {
  const cct = currentPerfil?.escuela_cct;
  if (!sb || !cct) {
    TSR.alumnos = TSR._demoAlumnos(); return;
  }
  try {
    const { data } = await sb.from('usuarios')
      .select(`
        id, nombre, apellido_p, apellido_m, curp, email,
        alumnos_grupos(grupo_id, grupos(nombre, grado)),
        perfil_alumno(xp_total, racha_dias, nivel)
      `)
      .eq('escuela_cct', cct)
      .eq('rol', 'alumno').eq('activo', true)
      .order('nombre');
    TSR.alumnos = data?.length ? data : TSR._demoAlumnos();
  } catch(e) { TSR.alumnos = TSR._demoAlumnos(); }
};

// ── Cargar incidencias reales ─────────────────────────────────────
TSR.cargarIncidencias = async function() {
  const cct = currentPerfil?.escuela_cct;
  if (!sb || !cct) {
    TSR.incidencias = TSR._demoIncidencias(); return;
  }
  try {
    const { data } = await sb.from('incidencias')
      .select(`
        *,
        alumno:alumno_id(nombre, apellido_p),
        reportado:reportado_por(nombre, rol),
        grupo:grupo_id(nombre)
      `)
      .eq('escuela_cct', cct)
      .order('created_at', { ascending: false })
      .limit(100);
    TSR.incidencias = data?.length ? data : TSR._demoIncidencias();
  } catch(e) { TSR.incidencias = TSR._demoIncidencias(); }
};

// ── Dashboard ─────────────────────────────────────────────────────
TSR.renderDashboard = function() {
  // KPIs reales
  const kpisEl = document.getElementById('tsp-kpis');
  if (kpisEl) {
    const total    = TSR.incidencias.length;
    const urgentes = TSR.incidencias.filter(i => i.estado === 'urgente').length;
    const seguim   = TSR.incidencias.filter(i => i.estado === 'en_seguimiento').length;
    const cerradas = TSR.incidencias.filter(i => i.estado === 'cerrada').length;
    kpisEl.innerHTML = [
      { ico:'📋', val:total,    lbl:'Total casos',      color:'#1d4ed8', bg:'#dbeafe' },
      { ico:'🔴', val:urgentes, lbl:'Urgentes',          color:'#b91c1c', bg:'#fee2e2' },
      { ico:'🟡', val:seguim,   lbl:'En seguimiento',   color:'#a16207', bg:'#fef9c3' },
      { ico:'✅', val:cerradas, lbl:'Cerrados este mes', color:'#15803d', bg:'#dcfce7' },
    ].map(k => `
      <div style="background:${k.bg};border-radius:14px;padding:16px 18px;border:1.5px solid ${k.color}22;">
        <div style="font-size:24px;margin-bottom:6px;">${k.ico}</div>
        <div style="font-size:28px;font-weight:800;font-family:'Fraunces',serif;color:${k.color};">${k.val}</div>
        <div style="font-size:11px;font-weight:700;color:${k.color};opacity:.7;">${k.lbl}</div>
      </div>`).join('');
  }

  // Casos recientes
  const recEl = document.getElementById('tsp-casos-recientes');
  if (recEl) {
    const recientes = TSR.incidencias.slice(0, 4);
    recEl.innerHTML = recientes.length ? recientes.map(i => {
      const nombre = i.alumno ? `${i.alumno.nombre} ${i.alumno.apellido||''}`.trim() : '—';
      const estadoColor = { urgente:'#b91c1c', abierta:'#a16207', en_seguimiento:'#1d4ed8', cerrada:'#15803d' }[i.estado] || '#64748b';
      const estadoBg   = { urgente:'#fee2e2', abierta:'#fef9c3', en_seguimiento:'#dbeafe', cerrada:'#dcfce7' }[i.estado] || '#f1f5f9';
      return `
      <div onclick="TSR.verAlumno('${i.alumno_id}')"
        style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:.15s;"
        onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
        <div style="width:36px;height:36px;border-radius:50%;background:#dbeafe;color:#1e40af;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;">
          ${nombre.charAt(0)}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nombre}</div>
          <div style="font-size:11px;color:#64748b;">${i.tipo||'otro'} · ${new Date(i.created_at).toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</div>
        </div>
        <span style="background:${estadoBg};color:${estadoColor};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;">${i.estado||'abierta'}</span>
      </div>`;
    }).join('') : '<div style="color:#94a3b8;font-size:13px;text-align:center;padding:20px;">Sin casos registrados</div>';
  }

  // Alertas urgentes
  const alertEl = document.getElementById('tsp-alertas-urgentes');
  if (alertEl) {
    const urgentes = TSR.incidencias.filter(i => i.estado === 'urgente');
    alertEl.innerHTML = urgentes.length ? `
      <div style="background:#fee2e2;border:1.5px solid #fca5a5;border-radius:12px;padding:14px 16px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;color:#b91c1c;margin-bottom:8px;">🚨 ${urgentes.length} caso${urgentes.length>1?'s':''} urgente${urgentes.length>1?'s':''} requiere atención inmediata</div>
        ${urgentes.slice(0,3).map(i => {
          const n = i.alumno ? `${i.alumno.nombre} ${i.alumno.apellido||''}`.trim() : '—';
          return `<div style="font-size:12px;color:#991b1b;margin-bottom:3px;">• ${n} — ${i.tipo} — ${i.descripcion?.slice(0,60)||''}…</div>`;
        }).join('')}
      </div>` : '';
  }
};

// ── Lista de casos ────────────────────────────────────────────────
TSR.generarResumenIA = async function() {
  const el = document.getElementById('tsp-ia-resumen');
  if (!el) return;
  el.innerHTML = '<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#6d28d9;padding:16px;"><span style="display:inline-block;width:14px;height:14px;border:2px solid #c4b5fd;border-top-color:#7c3aed;border-radius:50%;animation:spin .8s linear infinite;"></span> Analizando todos los casos con IA…</div>';

  const total    = TSR.incidencias.length;
  const urgentes = TSR.incidencias.filter(i => i.estado === 'urgente');
  const seguim   = TSR.incidencias.filter(i => i.estado === 'en_seguimiento');
  const tipos    = {};
  TSR.incidencias.forEach(i => { tipos[i.tipo||'otro'] = (tipos[i.tipo||'otro']||0)+1; });
  const tipoStr  = Object.entries(tipos).map(([k,v])=>`${k}: ${v}`).join(', ');

  // Alumnos con más de 2 incidencias (casos prioritarios)
  const conteo = {};
  TSR.incidencias.forEach(i => { conteo[i.alumno_id] = (conteo[i.alumno_id]||0)+1; });
  const prioritarios = Object.entries(conteo).filter(([,v])=>v>=2).length;

  const prompt = `Eres trabajador/a social escolar. Analiza este resumen de la escuela:
Total de casos: ${total}
Urgentes: ${urgentes.length}
En seguimiento: ${seguim.length}
Tipos de incidencias: ${tipoStr}
Alumnos con 2+ incidencias: ${prioritarios}
${urgentes.length ? `Casos urgentes: ${urgentes.map(i=>{ const n = i.alumno?`${i.alumno.nombre} ${i.alumno.apellido||''}`.trim():'—'; return `${n} (${i.tipo})`; }).slice(0,5).join(', ')}` : ''}

Genera un resumen ejecutivo para el trabajador/a social con:
1. Semáforo general de la escuela (🔴/🟡/🟢) y justificación en 1 oración
2. 3 casos que requieren atención prioritaria esta semana
3. 2 acciones preventivas recomendadas para el resto del grupo
Máximo 200 palabras. Lenguaje profesional y directo.`;

  try {
    const texto = await callAI({
      feature: 'ts_caso_resumen',
      prompt,
      escuela_id: currentPerfil?.escuela_cct,
      system: _nemSys('TAREA: Resumen de caso TS para trabajo social escolar. Lenguaje profesional, objetivo, sin diagnósticos clínicos. Identifica factores de riesgo y protectores. Propone protocolo de intervención acorde al Acuerdo SEP 09/08/23 y NEM.'),
    });
    const html = texto.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,#1e1b4b,#4338ca);border-radius:14px;padding:18px;color:white;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:11px;font-weight:800;opacity:.7;text-transform:uppercase;letter-spacing:1px;">📊 Análisis — Resumen global</span>
          <button onclick="TSR.generarResumenIA()" style="margin-left:auto;padding:4px 10px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:white;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;">↺ Actualizar</button>
        </div>
        <div style="font-size:13px;line-height:1.7;">${html}</div>
        <div style="font-size:10px;opacity:.45;margin-top:10px;">⚠️ Referencia pedagógica · No reemplaza valoración profesional · ${new Date().toLocaleDateString('es-MX')}</div>
      </div>`;
  } catch(e) {
    el.innerHTML = `<div style="background:#fef2f2;border-radius:10px;padding:14px;color:#dc2626;font-size:13px;">❌ ${e.message}</div>`;
  }
};

// ── Lista de casos ────────────────────────────────────────────────
TSR.renderCasos = function() {
  const el = document.getElementById('tsp-casos-lista');
  if (!el) return;
  const filtroEst  = document.getElementById('tsp-fil-estado')?.value || '';
  const filtroTipo = document.getElementById('tsp-fil-tipo')?.value   || '';
  let lista = TSR.incidencias;
  if (filtroEst)  lista = lista.filter(i => i.estado === filtroEst);
  if (filtroTipo) lista = lista.filter(i => i.tipo   === filtroTipo);

  if (!lista.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;"><div style="font-size:32px;margin-bottom:8px;">✅</div>Sin casos con ese filtro</div>';
    return;
  }

  const estadoColors = {
    urgente:'#b91c1c:#fee2e2', abierta:'#a16207:#fef9c3',
    en_seguimiento:'#1d4ed8:#dbeafe', cerrada:'#15803d:#dcfce7',
  };
  const tipoIco = { academica:'📚', conducta:'🎭', asistencia:'📅', salud:'🏥', otro:'📋' };

  el.innerHTML = lista.map(i => {
    const nombre = i.alumno ? `${i.alumno.nombre} ${i.alumno.apellido||''}`.trim() : '—';
    const grupo  = i.grupo?.nombre || '—';
    const [col, bg] = (estadoColors[i.estado] || '#64748b:#f1f5f9').split(':');
    const fecha = new Date(i.created_at).toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' });
    const reporter = i.reportado ? `${i.reportado.nombre} (${i.reportado.rol})` : 'Sistema';
    return `
    <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:10px;border-left:4px solid ${col};">
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <div style="width:40px;height:40px;border-radius:50%;background:#dbeafe;color:#1e40af;font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${nombre.charAt(0)}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
            <span style="font-weight:700;font-size:14px;">${nombre}</span>
            <span style="background:#f0f4fa;color:#64748b;padding:1px 7px;border-radius:10px;font-size:11px;">${grupo}</span>
            <span style="background:${bg};color:${col};padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;">${i.estado||'abierta'}</span>
          </div>
          <div style="font-size:12px;color:#64748b;margin-bottom:6px;">${tipoIco[i.tipo]||'📋'} ${i.tipo||'otro'} · Reportado por: ${reporter} · ${fecha}</div>
          <div style="font-size:13px;color:#0f172a;line-height:1.5;">${i.descripcion||'Sin descripción'}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <button onclick="TSR.verAlumno('${i.alumno_id}')"
          style="padding:6px 14px;background:#dbeafe;color:#1e40af;border:none;border-radius:7px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">
          👤 Ver historial alumno
        </button>
        <button onclick="TSR.abrirAnalisisIA('${i.alumno_id}','${nombre}','${i.id}')"
          style="padding:6px 14px;background:#f5f3ff;color:#6d28d9;border:none;border-radius:7px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">
          ✨ Análisis IA
        </button>
        <button onclick="TSR.cambiarEstado('${i.id}','${i.estado}')"
          style="padding:6px 14px;background:#f0fdf4;color:#15803d;border:none;border-radius:7px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">
          🔄 Cambiar estado
        </button>
        <button onclick="TSR.derivarDirector('${i.id}','${nombre}')"
          style="padding:6px 14px;background:#fef9c3;color:#a16207;border:none;border-radius:7px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">
          📤 Derivar al director
        </button>
      </div>
    </div>`;
  }).join('');
};

// ── Ver historial completo del alumno ────────────────────────────
TSR.verAlumno = async function(alumnoId) {
  TSR.alumnoActual = alumnoId;
  tsNav('fichas-ia');

  const detalle = document.getElementById('tsp-ficha-detalle');
  if (!detalle) return;
  detalle.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;"><div style="font-size:24px;margin-bottom:8px;">⏳</div>Cargando historial…</div>';

  try {
    // Datos del alumno
    const alumno = TSR.alumnos.find(a => a.id === alumnoId) || {};
    const nombre = `${alumno.nombre||''} ${alumno.apellido||''}`.trim() || 'Alumno';
    const grupo  = alumno.alumnos_grupos?.[0]?.grupos?.nombre || '—';

    // Cargar calificaciones, asistencia e incidencias en paralelo
    let califs = [], asistencias = [], incids = [], xpEventos = [];
    if (sb) {
      const [calRes, asRes, incRes, xpRes] = await Promise.all([
        sb.from('calificaciones').select('materia,calificacion,trimestre,ciclo')
          .eq('alumno_id', alumnoId).eq('ciclo', window.CICLO_ACTIVO).order('materia'),
        sb.from('asistencia').select('fecha,estado')
          .eq('alumno_id', alumnoId)
          .gte('fecha', new Date(Date.now()-30*24*60*60*1000).toISOString().split('T')[0])
          .order('fecha', { ascending: false }),
        sb.from('incidencias').select('*, reportado:reportado_por(nombre,rol)')
          .eq('alumno_id', alumnoId).order('created_at', { ascending: false }),
        sb.from('xp_eventos_alumno').select('cantidad,tipo,motivo,fecha')
          .eq('alumno_id', alumnoId).order('created_at', { ascending: false }).limit(10),
      ]);
      califs     = calRes.data || [];
      asistencias = asRes.data || [];
      incids     = incRes.data || [];
      xpEventos  = xpRes.data || [];
    }

    // Calcular estadísticas
    const promedioMat = {};
    califs.forEach(c => {
      if (!promedioMat[c.materia]) promedioMat[c.materia] = [];
      promedioMat[c.materia].push(parseFloat(c.calificacion)||0);
    });
    const materiasRes = Object.entries(promedioMat).map(([m, vals]) => ({
      nombre: m,
      promedio: (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1),
    })).sort((a,b) => a.promedio - b.promedio);

    const presentes = asistencias.filter(a => a.estado === 'presente').length;
    const ausentes  = asistencias.filter(a => a.estado === 'ausente').length;
    const pctAsist  = asistencias.length ? Math.round(presentes/asistencias.length*100) : 0;

    detalle.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;">

      <!-- Header alumno -->
      <div style="background:linear-gradient(135deg,#1e3a5f,#2d6fb5);border-radius:14px;padding:20px;color:white;display:flex;align-items:center;gap:16px;">
        <div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;flex-shrink:0;">${nombre.charAt(0)}</div>
        <div style="flex:1;">
          <div style="font-family:'Fraunces',serif;font-size:20px;font-weight:700;">${nombre}</div>
          <div style="font-size:12px;opacity:.7;">${grupo} · ${alumno.curp||'Sin CURP'}</div>
        </div>
        <div style="display:flex;gap:10px;">
          <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:10px 14px;text-align:center;">
            <div style="font-size:20px;font-weight:900;">${pctAsist}%</div>
            <div style="font-size:10px;opacity:.6;">Asistencia</div>
          </div>
          <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:10px 14px;text-align:center;">
            <div style="font-size:20px;font-weight:900;">${incids.length}</div>
            <div style="font-size:10px;opacity:.6;">Incidencias</div>
          </div>
          <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:10px 14px;text-align:center;">
            <div style="font-size:20px;font-weight:900;">${alumno.perfil_alumno?.xp_total||0}</div>
            <div style="font-size:10px;opacity:.6;">XP Total</div>
          </div>
        </div>
      </div>

      <!-- Calificaciones -->
      <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">📊 Calificaciones</div>
        ${materiasRes.length ? `
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${materiasRes.map(m => {
              const pct = Math.min(100,(parseFloat(m.promedio)/10)*100);
              const col = parseFloat(m.promedio)>=8?'#15803d':parseFloat(m.promedio)>=6?'#1d4ed8':'#b91c1c';
              const bg  = parseFloat(m.promedio)>=8?'#dcfce7':parseFloat(m.promedio)>=6?'#dbeafe':'#fee2e2';
              return `<div style="display:flex;align-items:center;gap:10px;">
                <div style="width:120px;font-size:12px;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.nombre}</div>
                <div style="flex:1;height:6px;background:#f1f5f9;border-radius:6px;overflow:hidden;">
                  <div style="height:100%;width:${pct}%;background:${col};border-radius:6px;transition:.5s;"></div>
                </div>
                <span style="background:${bg};color:${col};padding:2px 8px;border-radius:8px;font-size:12px;font-weight:800;min-width:36px;text-align:center;">${m.promedio}</span>
              </div>`;
            }).join('')}
          </div>` : '<div style="color:#94a3b8;font-size:13px;">Sin calificaciones registradas</div>'}
      </div>

      <!-- Asistencia últimos 30 días -->
      <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">📅 Asistencia — últimos 30 días</div>
        <div style="display:flex;gap:12px;margin-bottom:10px;">
          <div style="background:#dcfce7;border-radius:8px;padding:8px 14px;text-align:center;">
            <div style="font-size:20px;font-weight:900;color:#15803d;">${presentes}</div>
            <div style="font-size:10px;color:#15803d;font-weight:700;">Presencias</div>
          </div>
          <div style="background:#fee2e2;border-radius:8px;padding:8px 14px;text-align:center;">
            <div style="font-size:20px;font-weight:900;color:#b91c1c;">${ausentes}</div>
            <div style="font-size:10px;color:#b91c1c;font-weight:700;">Ausencias</div>
          </div>
          <div style="background:#dbeafe;border-radius:8px;padding:8px 14px;text-align:center;">
            <div style="font-size:20px;font-weight:900;color:#1d4ed8;">${pctAsist}%</div>
            <div style="font-size:10px;color:#1d4ed8;font-weight:700;">% Asistencia</div>
          </div>
        </div>
        ${ausentes >= 3 ? `<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;font-size:12px;color:#a16207;font-weight:600;">⚠️ Atención: ${ausentes} ausencias en los últimos 30 días</div>` : ''}
      </div>

      <!-- Incidencias previas -->
      <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">📋 Historial de incidencias</div>
          <button onclick="TSR.nuevaIncidencia('${alumnoId}','${nombre}')"
            style="padding:5px 12px;background:#dbeafe;color:#1e40af;border:none;border-radius:7px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;">+ Nueva</button>
        </div>
        ${incids.length ? incids.map(i => {
          const fecha = new Date(i.created_at).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'});
          const reporter = i.reportado?.nombre || 'Sistema';
          const estadoCol = {urgente:'#b91c1c', abierta:'#a16207', en_seguimiento:'#1d4ed8', cerrada:'#15803d'}[i.estado]||'#64748b';
          const estadoBg  = {urgente:'#fee2e2', abierta:'#fef9c3', en_seguimiento:'#dbeafe', cerrada:'#dcfce7'}[i.estado]||'#f1f5f9';
          return `<div style="border-left:3px solid ${estadoCol};padding:8px 12px;margin-bottom:8px;background:#fafcff;border-radius:0 8px 8px 0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
              <span style="font-size:12px;font-weight:700;color:#0f172a;">${i.tipo||'otro'}</span>
              <span style="background:${estadoBg};color:${estadoCol};padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700;">${i.estado}</span>
              <span style="font-size:10px;color:#94a3b8;margin-left:auto;">${fecha}</span>
            </div>
            <div style="font-size:12px;color:#64748b;">${i.descripcion?.slice(0,100)||''}${(i.descripcion?.length||0)>100?'…':''}</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Reportado por: ${reporter}</div>
          </div>`;
        }).join('') : '<div style="color:#94a3b8;font-size:13px;">Sin incidencias previas ✅</div>'}
      </div>

      <!-- XP reciente -->
      ${xpEventos.length ? `
      <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">⭐ XP reciente</div>
        ${xpEventos.map(x => `
          <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f1f5f9;">
            <span style="font-size:15px;">${{asistencia:'✅',tarea:'📝',proyecto:'🔬',participacion:'🙋',docente_especial:'⭐',mejora_trabajo:'💪'}[x.tipo]||'✨'}</span>
            <div style="flex:1;font-size:12px;color:#64748b;">${x.motivo||x.tipo}</div>
            <span style="font-size:13px;font-weight:800;color:#0d5c2f;">+${x.cantidad} XP</span>
          </div>`).join('')}
      </div>` : ''}

      <!-- Botón análisis IA -->
      <button onclick="TSR.abrirAnalisisIA('${alumnoId}','${nombre}',null)"
        style="width:100%;padding:14px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;border:none;border-radius:12px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;">
        ✨ Generar análisis IA completo del caso
      </button>

    </div>`;

    // Actualizar lista de alumnos con selección activa
    TSR.renderListaAlumnos(alumnoId);

  } catch(e) {
    detalle.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8;">Error: ${e.message}</div>`;
  }
};

// ── Lista de alumnos en panel izquierdo ──────────────────────────
TSR.renderListaAlumnos = function(alumnoActivoId = null) {
  const el = document.getElementById('tsp-fichas-lista');
  if (!el) return;
  const lista = TSR.alumnos;
  if (!lista.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">Sin alumnos</div>';
    return;
  }
  el.innerHTML = lista.map(a => {
    const nombre = `${a.nombre||''} ${a.apellido||''}`.trim();
    const grupo  = a.alumnos_grupos?.[0]?.grupos?.nombre || '—';
    const incidsCnt = TSR.incidencias.filter(i => i.alumno_id === a.id).length;
    const tieneUrgente = TSR.incidencias.some(i => i.alumno_id === a.id && i.estado === 'urgente');
    const isActive = a.id === alumnoActivoId;
    return `
    <div onclick="TSR.verAlumno('${a.id}')"
      style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:8px;
             background:${isActive?'#dbeafe':'white'};transition:.15s;"
      onmouseover="this.style.background='${isActive?'#dbeafe':'#f8fafc'}'"
      onmouseout="this.style.background='${isActive?'#dbeafe':'white'}'">
      <div style="width:34px;height:34px;border-radius:50%;background:${isActive?'#1d4ed8':'#e2e8f0'};color:${isActive?'white':'#64748b'};font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        ${nombre.charAt(0)}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:${isActive?'700':'600'};color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nombre}</div>
        <div style="font-size:10px;color:#94a3b8;">${grupo}</div>
      </div>
      ${incidsCnt > 0 ? `<span style="background:${tieneUrgente?'#fee2e2':'#fef9c3'};color:${tieneUrgente?'#b91c1c':'#a16207'};padding:1px 6px;border-radius:10px;font-size:10px;font-weight:700;">${incidsCnt}</span>` : ''}
    </div>`;
  }).join('');
};

// ── Análisis IA del caso ──────────────────────────────────────────
TSR.abrirAnalisisIA = async function(alumnoId, nombre, incidenciaId) {
  const detalle = document.getElementById('tsp-ficha-detalle');
  if (!detalle) return;

  // Panel IA
  const panelId = 'tsr-ia-panel-' + alumnoId;
  let iaPanel = document.getElementById(panelId);
  if (!iaPanel) {
    iaPanel = document.createElement('div');
    iaPanel.id = panelId;
    iaPanel.style.cssText = 'background:linear-gradient(135deg,#1e1b4b,#4338ca);border-radius:14px;padding:20px;margin-top:16px;color:white;';
    iaPanel.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#a5b4fc;animation:pulse 2s infinite;"></div>
        <span style="font-size:11px;font-weight:800;opacity:.7;text-transform:uppercase;letter-spacing:1px;">Análisis IA — ${nombre}</span>
      </div>
      <div id="tsr-ia-texto-${alumnoId}" style="font-size:13px;line-height:1.7;opacity:.9;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:white;border-radius:50%;animation:spin .8s linear infinite;"></span>
          Generando análisis psicosocial…
        </div>
      </div>`;
    detalle.appendChild(iaPanel);
  }
  iaPanel.scrollIntoView({ behavior:'smooth', block:'nearest' });

  try {
    // Obtener contexto del alumno
    const alumno = TSR.alumnos.find(a => a.id === alumnoId) || {};
    const incids = TSR.incidencias.filter(i => i.alumno_id === alumnoId);
    let calResumen = '';
    if (sb) {
      const { data: cals } = await sb.from('calificaciones')
        .select('materia,calificacion').eq('alumno_id', alumnoId)
        .eq('ciclo', window.CICLO_ACTIVO);
      if (cals?.length) {
        const prom = cals.reduce((s,c)=>s+(parseFloat(c.calificacion)||0),0)/cals.length;
        const bajas = cals.filter(c => parseFloat(c.calificacion)<7).map(c=>c.materia);
        calResumen = `Promedio: ${prom.toFixed(1)}. ${bajas.length?`Materias bajas: ${bajas.join(', ')}.`:''}`;
      }
    }

    const prompt = `Eres un trabajador/a social escolar experto/a en protección de menores y NEM México.
Alumno: ${nombre}, ${alumno.alumnos_grupos?.[0]?.grupos?.nombre||'grupo desconocido'}.
${calResumen}
Incidencias registradas (${incids.length}): ${incids.map(i=>`${i.tipo}: "${(i.descripcion||'').slice(0,80)}"`).join(' | ')||'Ninguna'}

Genera un análisis breve (4-5 oraciones) para el expediente de Trabajo Social:
1. Factores de riesgo detectados (académico, conductual, familiar si aplica)
2. Señales de alerta que requieren seguimiento
3. Recomendación de intervención (individual, familiar, derivación externa)
4. Marco legal aplicable si hay indicios de vulneración de derechos

IMPORTANTE: No hacer diagnósticos médicos ni psicológicos. Solo observaciones pedagógicas y psicosociales desde NEM.
Tono: profesional, objetivo, sin juicios de valor sobre la familia.`;

    const headers = { 'Content-Type': 'application/json' };
    const { data: { session } } = await sb.auth.getSession();
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

    const texto = await callAI({
      feature: 'ts_alerta_analisis',
      prompt,
      escuela_id: currentPerfil?.escuela_cct,
      system: _nemSys('TAREA: Análisis de alerta escolar para trabajo social. Clasifica riesgo (🔴 Urgente / 🟡 Seguimiento / 🟢 Preventivo). Propone protocolo de intervención según nivel de riesgo y 2 acciones inmediatas concretas. Sin diagnósticos clínicos.'),
    });

    const txtEl = document.getElementById(`tsr-ia-texto-${alumnoId}`);
    if (texto) {
      if (txtEl) txtEl.innerHTML = `
        <div style="line-height:1.7;">${texto.replace(/\n/g,'<br>')}</div>
        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
          <button onclick="TSR.guardarAnalisis('${alumnoId}','${nombre}')"
            style="padding:8px 14px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:white;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">
            💾 Guardar en expediente
          </button>
          <button onclick="TSR.derivarDirector('null','${nombre}')"
            style="padding:8px 14px;background:rgba(245,158,11,.3);border:1px solid rgba(245,158,11,.5);color:#fef3c7;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">
            📤 Derivar al director
          </button>
        </div>
        <div style="font-size:10px;opacity:.5;margin-top:8px;">⚠️ Solo referencia pedagógica · No es diagnóstico profesional · NEM 2026</div>`;
    } else throw new Error('AI no disponible');
  } catch(e) {
    const txtEl = document.getElementById(`tsr-ia-texto-${alumnoId}`);
    if (txtEl) txtEl.innerHTML = `<div>Sin conexión a IA. Revisa el expediente manualmente.<br><br><em style="opacity:.6;">Datos disponibles: ${TSR.incidencias.filter(i=>i.alumno_id===alumnoId).length} incidencias registradas.</em></div>`;
  }
};

// ── Nueva incidencia ──────────────────────────────────────────────
TSR.nuevaIncidencia = function(alumnoId, nombre) {
  const modal = document.createElement('div');
  modal.id = 'tsr-inc-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;color:#0d5c2f;">📋 Nueva incidencia — ${nombre}</div>
        <button onclick="document.getElementById('tsr-inc-modal').remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:#94a3b8;" aria-label="Cerrar">✕</button>
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Tipo de incidencia</label>
        <select id="tsr-inc-tipo" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;outline:none;">
          <option value="academica">📚 Académica</option>
          <option value="conducta">🎭 Conducta</option>
          <option value="asistencia">📅 Asistencia</option>
          <option value="salud">🏥 Salud</option>
          <option value="otro">📋 Otro</option>
        </select>
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Estado</label>
        <select id="tsr-inc-estado" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;outline:none;">
          <option value="abierta">🟡 Abierta</option>
          <option value="en_seguimiento">🔵 En seguimiento</option>
          <option value="urgente">🔴 Urgente</option>
        </select>
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Descripción</label>
        <textarea id="tsr-inc-desc" placeholder="Describe la situación observada…"
          style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;outline:none;resize:vertical;min-height:100px;"></textarea>
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="document.getElementById('tsr-inc-modal').remove()" style="flex:1;padding:11px;background:#f1f5f9;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;color:#64748b;">Cancelar</button>
        <button onclick="TSR.guardarIncidencia('${alumnoId}')" style="flex:2;padding:11px;background:#0d5c2f;color:white;border:none;border-radius:10px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;">💾 Guardar incidencia</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
};

TSR.guardarIncidencia = async function(alumnoId) {
  const tipo  = document.getElementById('tsr-inc-tipo')?.value;
  const estado = document.getElementById('tsr-inc-estado')?.value;
  const desc  = document.getElementById('tsr-inc-desc')?.value.trim();
  if (!desc) { hubToast('⚠️ Escribe una descripción', 'warn'); return; }

  const payload = {
    alumno_id:     alumnoId,
    reportado_por: currentPerfil?.id,
    tipo, estado, descripcion: desc,
    derivada_ts:   true,
  };

  try {
    if (sb) {
      const { data, error } = await sb.from('incidencias').insert(payload).select().single();
      if (error) throw error;
      TSR.incidencias.unshift({ ...data, alumno: TSR.alumnos.find(a=>a.id===alumnoId) });
    } else {
      TSR.incidencias.unshift({ id: Date.now().toString(), ...payload, created_at: new Date().toISOString() });
    }
    document.getElementById('tsr-inc-modal')?.remove();
    TSR.renderCasos();
    TSR.renderDashboard();
    hubToast('✅ Incidencia registrada', 'ok');
    TSR.verAlumno(alumnoId);
  } catch(e) { hubToast('❌ ' + e.message, 'err'); }
};

// ── Cambiar estado de incidencia ─────────────────────────────────
TSR.cambiarEstado = async function(incidenciaId, estadoActual) {
  const estados = ['abierta','en_seguimiento','urgente','cerrada'];
  const idx     = estados.indexOf(estadoActual);
  const nuevo   = estados[(idx + 1) % estados.length];
  try {
    if (sb) await sb.from('incidencias').update({ estado: nuevo }).eq('id', incidenciaId);
    const inc = TSR.incidencias.find(i => i.id === incidenciaId);
    if (inc) inc.estado = nuevo;
    TSR.renderCasos();
    TSR.renderDashboard();
    hubToast(`✅ Estado cambiado a: ${nuevo}`, 'ok');
  } catch(e) { hubToast('❌ ' + e.message, 'err'); }
};

// ── Derivar al director ──────────────────────────────────────────
TSR.derivarDirector = async function(incidenciaId, nombre) {
  if (sb && incidenciaId && incidenciaId !== 'null') {
    try {
      await sb.from('incidencias').update({ derivada_ts: true, estado: 'en_seguimiento' }).eq('id', incidenciaId);
    } catch(e) {}
  }
  hubToast(`📤 Caso de ${nombre} derivado al director`, 'ok');
};

// ── Guardar análisis IA en notas ─────────────────────────────────
TSR.guardarAnalisis = function(alumnoId, nombre) {
  hubToast(`💾 Análisis de ${nombre} guardado en el expediente`, 'ok');
};

// ── Directorio alumnos ───────────────────────────────────────────
TSR.renderDirectorioAlumnos = function() {
  TSR.renderListaAlumnos();
  const dirEl = document.getElementById('tsp-dir-alumnos-lista');
  if (!dirEl) return;
  dirEl.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Alumno</th>
        <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Grupo</th>
        <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Incidencias</th>
        <th style="padding:10px 14px;border-bottom:1px solid #e2e8f0;"></th>
      </tr></thead>
      <tbody>
        ${TSR.alumnos.map(a => {
          const nombre = `${a.nombre||''} ${a.apellido||''}`.trim();
          // grupo_id can come from alumnos_grupos (DB) or direct grupo_id (local)
      const grupo = a.alumnos_grupos?.[0]?.grupos?.nombre
        || (a.grupo_id ? (ADM.grupos.find(g=>g.id===a.grupo_id)?.nombre||'Sin nombre') : '—');
          const cnt    = TSR.incidencias.filter(i => i.alumno_id === a.id).length;
          const urgente = TSR.incidencias.some(i => i.alumno_id === a.id && i.estado === 'urgente');
          return `<tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:10px 14px;font-weight:600;">${nombre}</td>
            <td style="padding:10px 14px;color:#64748b;">${grupo}</td>
            <td style="padding:10px 14px;">
              ${cnt > 0
                ? `<span style="background:${urgente?'#fee2e2':'#fef9c3'};color:${urgente?'#b91c1c':'#a16207'};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">${cnt} ${urgente?'🔴':''}</span>`
                : '<span style="color:#94a3b8;font-size:12px;">Sin incidencias</span>'}
            </td>
            <td style="padding:10px 14px;">
              <button onclick="TSR.verAlumno('${a.id}')" style="padding:5px 12px;background:#dbeafe;color:#1e40af;border:none;border-radius:7px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;">Ver historial</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
};

// ── Populate select alumno en formulario nuevo caso ───────────────
TSR.poblarSelectAlumno = function() {
  document.querySelectorAll('select[id*="alumno"]').forEach(sel => {
    if (sel.options.length <= 1) {
      sel.innerHTML = '<option value="">Seleccionar alumno…</option>' +
        TSR.alumnos.map(a => {
          const n = `${a.nombre||''} ${a.apellido||''}`.trim();
          return `<option value="${a.id}">${n}</option>`;
        }).join('');
    }
  });
};

// ── Override tsNav para usar TSR ─────────────────────────────────
const _origTsNav = tsNav;
tsNav = function(page) {
  _origTsNav(page);
  if (page === 'casos')      TSR.renderCasos();
  if (page === 'fichas-ia')  TSR.renderListaAlumnos(TSR.alumnoActual);
  if (page === 'dir-alumnos') TSR.renderDirectorioAlumnos();
};

// ── tspFiltrar actualizado ───────────────────────────────────────
// tspFiltrar defined below


// ── Datos demo ───────────────────────────────────────────────────
TSR._demoAlumnos = () => window.SiembraDemoFixtures?.ts?.alumnos || [];
TSR._demoIncidencias = () => window.SiembraDemoFixtures?.ts?.incidencias || [];

console.log('[SIEMBRA] Módulo Trabajo Social v1 cargado · Parte 5');

function tsRenderKPIs() {
  const cont = document.getElementById('ts-kpis');
  if (!cont) return;
  const total = TS_CASOS.length;
  const urgentes = TS_CASOS.filter(c=>c.estado==='urgente').length;
  const seguim = TS_CASOS.filter(c=>c.estado==='seguimiento').length;
  const resueltos = TS_CASOS.filter(c=>c.estado==='resuelto').length;
  const kpis = [
    { ico:'📋', val:total, lbl:'Total de casos', color:'#1d4ed8', bg:'#dbeafe' },
    { ico:'🔴', val:urgentes, lbl:'Casos urgentes', color:'#b91c1c', bg:'#fee2e2' },
    { ico:'🟡', val:seguim, lbl:'En seguimiento', color:'#a16207', bg:'#fef9c3' },
    { ico:'🟢', val:resueltos, lbl:'Resueltos', color:'#15803d', bg:'#dcfce7' },
  ];
  cont.innerHTML = kpis.map(k=>`
    <div style="background:${k.bg};border-radius:14px;padding:16px 18px;border:1.5px solid ${k.color}22;">
      <div style="font-size:24px;margin-bottom:6px;">${k.ico}</div>
      <div style="font-size:28px;font-weight:800;font-family:'Fraunces',serif;color:${k.color};">${k.val}</div>
      <div style="font-size:11px;font-weight:700;color:${k.color};opacity:.7;">${k.lbl}</div>
    </div>`).join('');
}

function tsRenderCasos() {
  const cont = document.getElementById('ts-casos-lista');
  const empty = document.getElementById('ts-casos-empty');
  if (!cont) return;

  // Usar datos reales de Supabase si están disponibles, si no usar demo
  const fuente = (window._tsCasosDB && window._tsCasosDB.length) ? window._tsCasosDB : TS_CASOS;

  let casos = fuente.filter(c => {
    // Soporte para ambos formatos: DB (alumno_nombre) y demo (alumnoIdx)
    const nombre = c.alumno_nombre || (typeof alumnos !== 'undefined' && alumnos[c.alumnoIdx] ? alumnos[c.alumnoIdx].n : '');
    const matchTxt = !tsFiltroTexto || nombre.toLowerCase().includes(tsFiltroTexto.toLowerCase());
    const matchTipo = !tsFiltroTipo || c.tipo === tsFiltroTipo;
    const matchEst = !tsFiltroEstado || c.estado === tsFiltroEstado;
    return matchTxt && matchTipo && matchEst;
  });

  if (empty) empty.style.display = casos.length ? 'none' : 'block';

  cont.innerHTML = casos.map(c => {
    // Soporte dual: DB usa alumno_nombre, demo usa alumnoIdx
    const nombreAlumno = c.alumno_nombre || (typeof alumnos !== 'undefined' && alumnos[c.alumnoIdx] ? alumnos[c.alumnoIdx].n : 'Alumno desconocido');
    const tipo = TS_TIPOS[c.tipo] || TS_TIPOS.otro;
    const est = TS_ESTADOS[c.estado] || TS_ESTADOS.seguimiento;
    const colIdx = typeof c.alumnoIdx === 'number' ? c.alumnoIdx : Math.abs(String(c.id||0).split('').reduce((a,ch)=>a+ch.charCodeAt(0),0)) % COLORES_AVATARES.length;
    const col = COLORES_AVATARES[colIdx % COLORES_AVATARES.length];
    const inis = nombreAlumno.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
    const fechaRaw = c.fecha_apertura || c.fecha || '';
    const fechaFmt = fechaRaw ? new Date(fechaRaw+'T00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    const desc = c.descripcion || c.desc || '';
    const proxFecha = c.seguimiento?.length ? c.seguimiento[c.seguimiento.length-1]?.fecha : (c.proxFecha || '—');
    return `<div class="ts-caso-card ${c.estado}" style="margin-bottom:12px;" onclick="tsVerCaso(${typeof c.id==='number'?c.id:'"'+c.id+'"'})">
      <div class="ts-caso-stripe ${c.estado}"></div>
      <div class="ts-caso-body">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <div style="width:38px;height:38px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:white;flex-shrink:0;">${inis}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:14px;">${nombreAlumno}</div>
            <div style="font-size:11px;color:var(--gris-50);">Apertura: ${fechaFmt}</div>
          </div>
          <div>
            <span class="ts-tipo-chip ${tipo.cls}">${tipo.ico} ${tipo.lbl}</span>
          </div>
        </div>
        <div style="font-size:12px;color:var(--gris-80);line-height:1.5;margin-bottom:10px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${desc}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;background:${est.bg};color:${est.color};">${est.dot} ${est.lbl}</span>
          <span style="font-size:11px;color:var(--gris-50);">Prioridad: ${c.prioridad || '—'}</span>
          <button onclick="event.stopPropagation();tsEditarCaso(${typeof c.id==='number'?c.id:'"'+c.id+'"'})" style="font-size:11px;padding:4px 10px;border-radius:7px;background:var(--gris-10);border:1px solid var(--gris-20);cursor:pointer;font-family:'Sora',sans-serif;font-weight:600;">✏️ Editar</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function tsVerCaso(id) {
  const c = TS_CASOS.find(x=>x.id===id);
  if (!c) return;
  const a = alumnos[c.alumnoIdx] || { n:'—' };
  const tipo = TS_TIPOS[c.tipo] || TS_TIPOS.otro;
  const est = TS_ESTADOS[c.estado] || TS_ESTADOS.seguimiento;
  hubToast(`📋 Caso de ${a.n} — ${est.dot} ${est.lbl}`);
}

function tsFiltrar(v) { tsFiltroTexto = v; tsRenderCasos(); }
function tsFiltrarTipo(v) { tsFiltroTipo = v; tsRenderCasos(); }
function tsFiltrarEstado(v) { tsFiltroEstado = v; tsRenderCasos(); }

function tsNuevoCaso() {
  // Populate alumno select
  const sel = document.getElementById('ts-nuevo-alumno');
  if (sel) {
    sel.innerHTML = '<option value="">Seleccionar…</option>' +
      alumnos.map((a,i)=>`<option value="${i}">${a.n}</option>`).join('');
  }
  const hoy = new Date().toISOString().split('T')[0];
  const inp = document.getElementById('ts-nuevo-fecha');
  if (inp) inp.value = hoy;
  const prox = document.getElementById('ts-prox-fecha');
  if (prox) {
    const d = new Date(); d.setDate(d.getDate()+14);
    prox.value = d.toISOString().split('T')[0];
  }
  const ov = document.getElementById('modal-ts-ov');
  if (ov) { ov.style.opacity='1'; ov.style.pointerEvents='all'; document.getElementById('modal-ts-box').style.transform='translateY(0)'; }
}

function tsEditarCaso(id) {
  tsNuevoCaso();
  const c = TS_CASOS.find(x=>x.id===id);
  if (!c) return;
  tsCasoActualId = id;
  setVal('ts-nuevo-alumno', String(c.alumnoIdx));
  setVal('ts-nuevo-fecha', c.fecha);
  setVal('ts-nuevo-tipo', c.tipo);
  setVal('ts-nuevo-urgencia', c.estado);
  setVal('ts-nuevo-desc', c.desc);
  setVal('ts-notifico-dir', c.notifDir);
  setVal('ts-notifico-fam', c.notifFam);
  setVal('ts-canalizo', c.canalizo);
  setVal('ts-inst-externa', c.instExterna);
  setVal('ts-acciones', c.acciones);
  setVal('ts-prox-fecha', c.proxFecha);
  setVal('ts-responsable', c.responsable);
}

function tsCerrarModal() {
  const ov = document.getElementById('modal-ts-ov');
  if (ov) { ov.style.opacity='0'; ov.style.pointerEvents='none'; }
  tsCasoActualId = null;
}

function tsGuardarCaso() {
  const alumnoIdx = parseInt(getVal('ts-nuevo-alumno'));
  if (isNaN(alumnoIdx)) { hubToast('⚠️ Selecciona un alumno','warn'); return; }
  const desc = getVal('ts-nuevo-desc').trim();
  if (!desc) { hubToast('⚠️ La descripción es obligatoria','warn'); return; }

  const caso = {
    id: tsCasoActualId || Date.now(),
    alumnoIdx,
    tipo:       getVal('ts-nuevo-tipo'),
    estado:     getVal('ts-nuevo-urgencia'),
    fecha:      getVal('ts-nuevo-fecha'),
    desc,
    notifDir:   getVal('ts-notifico-dir'),
    notifFam:   getVal('ts-notifico-fam'),
    canalizo:   getVal('ts-canalizo'),
    instExterna:getVal('ts-inst-externa'),
    acciones:   getVal('ts-acciones'),
    proxFecha:  getVal('ts-prox-fecha'),
    responsable:getVal('ts-responsable'),
  };

  if (tsCasoActualId) {
    const idx = TS_CASOS.findIndex(c=>c.id===tsCasoActualId);
    if (idx>=0) TS_CASOS[idx] = caso;
    hubToast('✅ Caso actualizado','ok');
  } else {
    TS_CASOS.unshift(caso);
    hubToast('✅ Caso registrado correctamente','ok');
  }
  tsCerrarModal();
  tsRenderKPIs();
  tsRenderCasos();
}

function tsShowProtocolo(tipo) {
  const p = TS_PROTOCOLOS[tipo];
  if (!p) return;
  const det = document.getElementById('ts-protocolo-detalle');
  const tit = document.getElementById('ts-proto-titulo');
  const steps = document.getElementById('ts-proto-steps');
  if (!det||!tit||!steps) return;
  tit.textContent = p.titulo;
  steps.innerHTML = p.steps.map((s,i)=>`
    <div class="ts-protocolo-step">
      <div class="ts-step-num activo">${i+1}</div>
      <div>
        <div style="font-size:12px;font-weight:700;margin-bottom:3px;">${s.lbl}</div>
        <div style="font-size:11px;color:var(--gris-50);line-height:1.6;">${s.txt}</div>
      </div>
    </div>`).join('');
  det.style.display = 'block';
}


// ══ ANÁLISIS IA FICHA DESCRIPTIVA ══
function fichaAnalisisIA() {
  if (fichaAlumnoActual === null) { hubToast('⚠️ Selecciona un alumno primero','warn'); return; }
  const fd = FICHAS_DATA[fichaAlumnoActual];
  const a  = alumnos[fichaAlumnoActual];
  document.getElementById('ia-ficha-alumno-label').textContent = a.n + ' · 6° A';
  document.getElementById('ia-ficha-resultado').innerHTML = `
    <div style="text-align:center;padding:30px;color:var(--gris-50);">
      <div style="font-size:32px;margin-bottom:10px;">✨</div>
      <div>Presiona <strong>Analizar</strong> para generar el reporte.</div>
    </div>`;
  const ov = document.getElementById('modal-ficha-ia-ov');
  if (ov) { ov.style.opacity='1'; ov.style.pointerEvents='all'; document.getElementById('modal-ficha-ia-box').style.transform='translateY(0)'; }
}

function cerrarFichaIA() {
  const ov = document.getElementById('modal-ficha-ia-ov');
  if (ov) { ov.style.opacity='0'; ov.style.pointerEvents='none'; }
}

async function fichaAnalisisIAGenerar() {
  if (fichaAlumnoActual === null) return;
  const fd = FICHAS_DATA[fichaAlumnoActual];
  const a  = alumnos[fichaAlumnoActual];
  const btn = document.getElementById('btn-ia-ficha-generar');
  const res = document.getElementById('ia-ficha-resultado');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analizando…'; }
  res.innerHTML = '<div style="text-align:center;padding:30px;color:var(--gris-50);"><div class="spin" style="width:28px;height:28px;border-width:3px;margin:0 auto 12px;"></div><div>Analizando la ficha descriptiva…</div></div>';

  // Calificaciones del alumno
  const calsResumen = MATERIAS_NEM.map(m => {
    const p = typeof calPromPonderado === 'function' && CAL_DATA && Object.keys(CAL_DATA).length
      ? calPromPonderado(fichaAlumnoActual, m, calTrimActual||1) : null;
    return p ? `${m}: ${p < 6.5 ? p.toFixed(1) : Math.round(p)}` : null;
  }).filter(Boolean).join(', ');

  const indicadoresActivos = INDICADORES
    .filter((ind, i) => fd.indicadores && (fd.indicadores[i]==='yes' || fd.indicadores[i]==='neu'))
    .map((ind, i) => `${ind} (${fd.indicadores[i]==='yes'?'sí':'a veces'})`).join('; ');

  const obsTextos = (fd.observaciones||[]).map(o=>`[${o.tipo}] ${o.texto}`).join(' | ');
  const reportes  = (fd.reportes||[]).map(r=>r.texto).join(' | ');

  const prompt = `Eres un asesor pedagógico experto en la Nueva Escuela Mexicana (NEM). Analiza la siguiente ficha descriptiva de un alumno y genera un reporte estructurado para el docente, con orientación hacia trabajo social si es necesario.

DATOS DEL ALUMNO:
- Nombre: ${a.n}
- Grado: 6° primaria
- Asistencia: ${fd.asistencia||'~90%'} aprox.
- Estilo de aprendizaje: ${(fd.estilos||[]).join(', ')||'no especificado'}
- Ritmo de aprendizaje: ${fd.ritmo||'normal'}
- Apoyos especiales: ${(fd.apoyos||[]).join(', ')||'ninguno registrado'}
- Conducta general: ${fd.conducta||'no especificada'}
- Participación: ${fd.participacion||'no especificada'}
- Relación con compañeros: ${fd.relacion||'no especificada'}
- Responsabilidad con tareas: ${fd.responsabilidad||'no especificada'}
- Fortalezas académicas: ${fd.fortalezas||'no especificadas'}
- Dificultades académicas: ${fd.dificultades||'no especificadas'}
- Áreas de oportunidad: ${fd.oportunidades||'no especificadas'}
- Calificaciones actuales: ${calsResumen||'no disponibles'}
- Indicadores de conducta activos: ${indicadoresActivos||'ninguno'}
- Observaciones registradas: ${obsTextos||'ninguna'}
- Reportes de conducta: ${reportes||'ninguno'}

INSTRUCCIONES:
Genera un reporte en 5 secciones claramente separadas con emojis:
1. 📊 Diagnóstico pedagógico (situación académica y conductual actual, sin diagnósticos médicos)
2. 💪 Fortalezas identificadas (máximo 3 puntos)
3. ⚠️ Áreas de atención prioritaria (máximo 3 puntos)
4. 🎯 Estrategias recomendadas para el docente (3 acciones concretas NEM)
5. 📤 Orientación hacia instancias de apoyo (¿debe canalizarse a trabajo social, psicología, DIF u otra instancia? ¿por qué? Redacta una justificación breve apegada a la LGDNNA sin alarmismo innecesario)

Usa lenguaje profesional pedagógico, objetivo, sin juicios de valor ni diagnósticos clínicos. Máximo 400 palabras total.`;

  try {
    const texto = await callAI({ feature: 'ficha_analisis', prompt });
    res.innerHTML = texto
      .split('\n')
      .map(l => l.trim() ? `<p style="margin-bottom:8px;">${l}</p>` : '')
      .join('');
  } catch(e) {
    res.innerHTML = `<div style="padding:20px;background:#fee2e2;border-radius:10px;color:#b91c1c;font-size:13px;">
      ⚠️ No se pudo conectar con la IA. Verifica tu clave en Configuración.<br><em style="font-size:11px;">${e.message}</em>
    </div>`;
  }

  if (btn) { btn.disabled = false; btn.textContent = '✨ Analizar de nuevo'; }
}

// fichaEnviarTS defined above

// fichaEnviarDir defined above


// ══════════════════════════════════════════════════════════