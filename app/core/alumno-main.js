// ══════════════════════════════════════════
// DATA
// ══════════════════════════════════════════
const alumnoData = {
  nombre: 'Alumno',
  apellido: 'Demo',
  grado: '4° A',
  xp: 1240,
  streak: 12,
  nivel: 4,
  xpNivel: 1240,
  xpSiguiente: 1800,
  promedio: 8.3,
  asistencia: 94,
};

const NIVELES = [
  { min:0,    icon:'🌱', nombre:'Semilla',         color:'#6b7280' },
  { min:200,  icon:'🌿', nombre:'Brote Verde',     color:'#16a34a' },
  { min:500,  icon:'🌳', nombre:'Árbol Joven',     color:'#15803d' },
  { min:900,  icon:'⭐', nombre:'Explorador',      color:'#d97706' },
  { min:1200, icon:'🌟', nombre:'Explorador Verde',color:'#7c3aed' },
  { min:1800, icon:'🏆', nombre:'Guardián SIEMBRA',color:'#0d5c2f' },
  { min:2800, icon:'💎', nombre:'Maestro del Saber',color:'#0369a1'},
];

const materias = [
  {
    id:'mate', nombre:'Matemáticas', campo:'Saberes y Pensamiento Científico',
    icon:'🔢', color:'#3b82f6', colorL:'#eff6ff',
    cal: 7.5, bimestres:[8,7,8,7,0], tendencia:'down',
    estado:'regular',
    sugerencia:'Estás un poco bajo en Matemáticas. Te recomendamos repasar fracciones — ¡solo 10 min al día hace la diferencia!',
    videos:[
      {titulo:'Fracciones para primaria',dur:'8 min',emoji:'🔢'},
      {titulo:'Multiplicación fácil',dur:'6 min',emoji:'✖️'},
      {titulo:'Problemas paso a paso',dur:'12 min',emoji:'📝'},
      {titulo:'Divisiones con truco',dur:'7 min',emoji:'➗'},
    ],
    ejercicios:[
      {tipo:'practica',titulo:'Fracciones equivalentes',desc:'Encuentra las fracciones que representan lo mismo usando figuras.',puntos:60},
      {tipo:'reto',titulo:'¡Reto relámpago!',desc:'5 multiplicaciones en menos de 2 minutos. ¿Puedes lograrlo?',puntos:120},
      {tipo:'repaso',titulo:'Repaso: Sumas y restas',desc:'Refuerza las operaciones básicas antes del siguiente bimestre.',puntos:40},
    ]
  },
  {
    id:'esp', nombre:'Español', campo:'Lenguajes',
    icon:'📖', color:'#16a34a', colorL:'#f0fdf4',
    cal: 9.0, bimestres:[9,9,9,9,0], tendencia:'up',
    estado:'excelente',
    sugerencia:'¡Excelente en Español! Eres de las mejores del grupo. Sigue con los ejercicios de escritura creativa para mantener tu nivel.',
    videos:[
      {titulo:'Tipos de texto',dur:'9 min',emoji:'📄'},
      {titulo:'Ortografía divertida',dur:'5 min',emoji:'✏️'},
    ],
    ejercicios:[
      {tipo:'practica',titulo:'Escritura creativa',desc:'Escribe un cuento corto con inicio, desarrollo y final.',puntos:80},
      {tipo:'reto',titulo:'¿Qué tipo de texto es?',desc:'Identifica 10 textos diferentes en tiempo récord.',puntos:100},
    ]
  },
  {
    id:'cien', nombre:'Ciencias Naturales', campo:'Saberes y Pensamiento Científico',
    icon:'🔬', color:'#059669', colorL:'#ecfdf5',
    cal: 8.5, bimestres:[8,9,8,9,0], tendencia:'up',
    estado:'bien',
    sugerencia:'¡Muy bien en Ciencias! Tu calificación subió este bimestre. Explora los videos de ecosistemas para profundizar más.',
    videos:[
      {titulo:'Ecosistemas de México',dur:'11 min',emoji:'🌿'},
      {titulo:'El cuerpo humano',dur:'8 min',emoji:'🫀'},
    ],
    ejercicios:[
      {tipo:'practica',titulo:'Cadena alimenticia',desc:'Ordena los organismos de un ecosistema en su cadena alimentaria.',puntos:70},
    ]
  },
  {
    id:'hist', nombre:'Historia', campo:'Ética, Naturaleza y Sociedades',
    icon:'🏛️', color:'#d97706', colorL:'#fffbeb',
    cal: 8.0, bimestres:[8,8,8,8,0], tendencia:'eq',
    estado:'bien',
    sugerencia:'Tu calificación en Historia se mantiene estable. Revisa los videos sobre la Revolución Mexicana para el siguiente bimestre.',
    videos:[
      {titulo:'Revolución Mexicana',dur:'10 min',emoji:'⚔️'},
      {titulo:'Culturas prehispánicas',dur:'7 min',emoji:'🏺'},
    ],
    ejercicios:[
      {tipo:'repaso',titulo:'Línea del tiempo',desc:'Coloca los eventos históricos en el orden correcto.',puntos:60},
    ]
  },
  {
    id:'geo', nombre:'Geografía', campo:'Ética, Naturaleza y Sociedades',
    icon:'🌎', color:'#0891b2', colorL:'#ecfeff',
    cal: 9.5, bimestres:[9,10,9,10,0], tendencia:'up',
    estado:'excelente',
    sugerencia:'¡Eres una estrella en Geografía! Calificación perfecta en el último bimestre. ¡Sigue así!',
    videos:[
      {titulo:'Regiones de México',dur:'8 min',emoji:'🗺️'},
    ],
    ejercicios:[
      {tipo:'reto',titulo:'¿Dónde está ese estado?',desc:'Ubica 10 estados de México en el mapa.',puntos:90},
    ]
  },
  {
    id:'fce', nombre:'Formación Cívica', campo:'Ética, Naturaleza y Sociedades',
    icon:'🤝', color:'#7c3aed', colorL:'#f5f3ff',
    cal: 9.0, bimestres:[9,9,9,9,0], tendencia:'eq',
    estado:'excelente',
    sugerencia:'Excelente en Formación Cívica. Eres un ejemplo de valores en el grupo.',
    videos:[],
    ejercicios:[]
  },
  {
    id:'arte', nombre:'Educación Artística', campo:'De lo Humano y lo Comunitario',
    icon:'🎨', color:'#db2777', colorL:'#fdf2f8',
    cal: 8.5, bimestres:[9,8,9,8,0], tendencia:'eq',
    estado:'bien',
    sugerencia:'Tienes mucho talento artístico. Tus proyectos de arte son de los mejores del grupo.',
    videos:[],
    ejercicios:[]
  },
  {
    id:'edfis', nombre:'Ed. Física', campo:'De lo Humano y lo Comunitario',
    icon:'⚽', color:'#f97316', colorL:'#fff7ed',
    cal: 10, bimestres:[10,10,10,10,0], tendencia:'up',
    estado:'excelente',
    sugerencia:'¡10 perfecto en Ed. Física! Eres la mejor deportista del grupo. ¡Sigue así!',
    videos:[],
    ejercicios:[]
  },
];

const logros = [
  {icon:'🔥',nombre:'Racha 10 días',desc:'Asististe 10 días seguidos',desbloqueado:true},
  {icon:'⭐',nombre:'Primera semana',desc:'Completaste tu primera semana',desbloqueado:true},
  {icon:'📚',nombre:'Lector estrella',desc:'Perfecto en Español dos bimestres',desbloqueado:true},
  {icon:'🌍',nombre:'Geógrafo pro',desc:'10 en Geografía',desbloqueado:true},
  {icon:'⚽',nombre:'Atleta',desc:'10 en Ed. Física',desbloqueado:true},
  {icon:'🎯',nombre:'100 puntos XP',desc:'Ganaste 100 XP en un día',desbloqueado:true},
  {icon:'🏆',nombre:'Top 3 del grupo',desc:'Promedio top 3 del grupo',desbloqueado:false},
  {icon:'💡',nombre:'Curiosidad',desc:'Viste 10 videos de apoyo',desbloqueado:false},
  {icon:'🌟',nombre:'Semana perfecta',desc:'100% asistencia en un mes',desbloqueado:false},
  {icon:'🔬',nombre:'Científico',desc:'10 en Ciencias',desbloqueado:false},
  {icon:'🎨',nombre:'Artista',desc:'Proyecto destacado en Artes',desbloqueado:false},
  {icon:'💎',nombre:'Nivel 6',desc:'Alcanza el nivel Guardián',desbloqueado:false},
];

const noticias = [
  {
    tipo:'Torneo', titulo:'¡Torneo de fútbol escolar!',
    desc:'Este viernes 14 de marzo a las 10am. Inscríbete con tu maestra antes del miércoles.',
    fecha:'10 Mar', emoji:'⚽', bg:'linear-gradient(135deg,#0d5c2f,#2db55d)',
    cta:'Inscribirse'
  },
  {
    tipo:'Concurso', titulo:'Concurso de matemáticas SEP',
    desc:'Convocatoria abierta para alumnos de 4° a 6°. Las inscripciones cierran el 20 de marzo.',
    fecha:'8 Mar', emoji:'🔢', bg:'linear-gradient(135deg,#1d4ed8,#3b82f6)',
    cta:'Ver convocatoria'
  },
  {
    tipo:'Asamblea', titulo:'Asamblea escolar general',
    desc:'Jueves 13 de marzo, 9am en el patio principal. Asistencia obligatoria para todos los grupos.',
    fecha:'7 Mar', emoji:'🏫', bg:'linear-gradient(135deg,#7c3aed,#8b5cf6)',
    cta:'Ver detalles'
  },
  {
    tipo:'Evento', titulo:'Día del árbol — ¡Plantemos juntos!',
    desc:'El 21 de marzo participaremos en la campaña de reforestación. Trae guantes y ganas.',
    fecha:'5 Mar', emoji:'🌳', bg:'linear-gradient(135deg,#d97706,#f59e0b)',
    cta:'Participar'
  },
];

const galeria = ['🎭','⚽','🎨','🌱','🏆','📚','🎪','🌳','🎶'];

// ══════════════════════════════════════════
// NAVEGACIÓN
// ══════════════════════════════════════════
function navTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const pg = document.getElementById('page-' + page);
  if (pg) pg.classList.add('active');
  const nb = document.getElementById('nav-' + page);
  if (nb) nb.classList.add('active');
  window.scrollTo(0, 0);
  // ── Inits por sección ──
  if (page === 'inicio')      { renderJardin(); renderLogrosScroll(); }
  if (page === 'materias')    { renderMaterias(); renderProgresoBimestral(); }
  if (page === 'asistencia')  { renderHistorialAsistencia(); }
  if (page === 'noticias')    { renderNoticias(); }
  if (page === 'perfil')      { renderLogrosTodos(); if(typeof dibujarQR==='function') dibujarQR(); }
  if (page === 'practicar')   { initPracticar(); }
  if (page === 'insignias')   { renderInsigniasPage(); }
  if (page === 'biblioteca')  { initBiblioteca(); }
  if (page === 'ruta')        { initRuta(); }
  if (page === 'examenes')    { exAlInit(); }
}

// ══════════════════════════════════════════
// RUTAS PERSONALIZADAS — alumno
// ══════════════════════════════════════════
async function initRuta() {
  if (!currentPerfil?.id || !sb) return;
  const pasosEl  = document.getElementById('ruta-alumno-pasos');
  const progWrap = document.getElementById('ruta-progreso-wrap');
  if (!pasosEl) return;

  pasosEl.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">Cargando tu ruta…</div>';

  try {
    // Buscar ruta activa del alumno
    const { data: rutas } = await sb.from('rutas_aprendizaje')
      .select('id,titulo,descripcion,progreso')
      .eq('alumno_id', currentPerfil.id)
      .eq('estado', 'activa')
      .order('creado_en', { ascending: false })
      .limit(1);

    if (!rutas?.length) {
      pasosEl.innerHTML = `<div style="text-align:center;padding:60px 20px;">
        <div style="font-size:56px;margin-bottom:16px;">🗺</div>
        <div style="font-size:17px;font-weight:700;color:#0f172a;margin-bottom:8px;">Sin ruta asignada</div>
        <div style="font-size:13px;color:#64748b;line-height:1.6;">Tu docente aún no ha creado tu ruta personalizada. Cuando lo haga, aparecerá aquí.</div>
      </div>`;
      if (progWrap) progWrap.style.display = 'none';
      return;
    }

    const ruta = rutas[0];
    document.getElementById('ruta-alumno-titulo').textContent = ruta.titulo || 'Mi ruta de aprendizaje';
    document.getElementById('ruta-alumno-sub').textContent = ruta.descripcion || 'Pasos personalizados para ti';

    // Cargar pasos
    const { data: pasos } = await sb.from('ruta_pasos')
      .select('*').eq('ruta_id', ruta.id).order('orden');

    if (!pasos?.length) {
      pasosEl.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Sin pasos aún.</div>';
      return;
    }

    const completados = pasos.filter(p => p.completado).length;
    const pct = Math.round((completados / pasos.length) * 100);

    // Actualizar barra
    if (progWrap) {
      progWrap.style.display = '';
      document.getElementById('ruta-pct-txt').textContent = pct + '%';
      document.getElementById('ruta-pct-bar').style.width = pct + '%';
      document.getElementById('ruta-pasos-cnt').textContent = `${completados} de ${pasos.length} pasos completados`;
    }

    // Badge en nav
    const pendientes = pasos.length - completados;
    const badge = document.getElementById('ruta-nav-badge');
    if (badge) { badge.style.display = pendientes > 0 ? '' : 'none'; badge.textContent = pendientes; }

    const TIPO_ICON = { ejercicio:'✏️', lectura:'📖', actividad:'🎯', repaso:'🔄', evaluacion:'📝' };
    pasosEl.innerHTML = pasos.map((p, i) => {
      const done    = p.completado;
      const bloq    = !done && i > 0 && !pasos[i-1].completado; // bloqueado si anterior no está hecho
      return `<div style="display:flex;gap:14px;align-items:flex-start;padding:16px;background:white;border-radius:14px;border:1.5px solid ${done?'#bbf7d0':bloq?'#f1f5f9':'#e0e7ff'};margin-bottom:10px;opacity:${bloq?'.55':'1'};">
        <!-- Número / check -->
        <div style="width:40px;height:40px;border-radius:50%;background:${done?'linear-gradient(135deg,#15803d,#16a34a)':bloq?'#e2e8f0':'linear-gradient(135deg,#4f46e5,#7c3aed)'};color:white;display:flex;align-items:center;justify-content:center;font-size:${done?'20':'15'}px;font-weight:800;flex-shrink:0;">
          ${done ? '✓' : TIPO_ICON[p.tipo]||p.orden}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:700;color:${done?'#94a3b8':'#0f172a'};text-decoration:${done?'line-through':'none'};margin-bottom:3px;">Paso ${p.orden}: ${p.titulo}</div>
          <div style="font-size:12px;color:#64748b;line-height:1.5;margin-bottom:8px;">${p.descripcion}</div>
          ${done
            ? `<span style="font-size:11px;background:#f0fdf4;color:#15803d;padding:3px 10px;border-radius:99px;font-weight:700;">✅ Completado · +${p.xp_al_completar||50} XP ganados</span>`
            : bloq
            ? `<span style="font-size:11px;color:#94a3b8;">🔒 Completa el paso anterior primero</span>`
            : `<button onclick="rutaCompletarPaso('${p.id}','${ruta.id}',${p.xp_al_completar||50})" style="padding:8px 18px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;border:none;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">✔ Marcar como completado · +${p.xp_al_completar||50} XP</button>`
          }
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    pasosEl.innerHTML = `<div style="color:#dc2626;padding:20px;font-size:13px;">❌ ${e.message}</div>`;
  }
}

async function rutaCompletarPaso(pasoId, rutaId, xp) {
  if (!sb) return;
  try {
    // Marcar paso como completado
    await sb.from('ruta_pasos').update({ completado: true, completado_en: new Date().toISOString() }).eq('id', pasoId);

    // Recalcular progreso de la ruta
    const { data: todosLosPasos } = await sb.from('ruta_pasos').select('completado').eq('ruta_id', rutaId);
    if (todosLosPasos) {
      const total = todosLosPasos.length;
      const hechos = todosLosPasos.filter(p => p.completado).length;
      const nuevoPct = Math.round((hechos / total) * 100);
      await sb.from('rutas_aprendizaje').update({
        progreso: nuevoPct,
        estado: nuevoPct === 100 ? 'completada' : 'activa',
      }).eq('id', rutaId);
    }

    // Dar XP al alumno
    if (xp > 0 && currentPerfil?.id) {
      await sb.from('xp_transacciones').insert({
        alumno_id: currentPerfil.id,
        puntos: xp,
        motivo: 'ruta_paso',
        descripcion: 'Paso de ruta de aprendizaje completado',
      });
      // Actualizar XP local
      const newXP = (currentPerfil.xp_total || 0) + xp;
      currentPerfil.xp_total = newXP;
      document.getElementById('hdr-xp').textContent = newXP.toLocaleString();
    }

    // Mostrar animación y recargar ruta
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;padding:20px 32px;border-radius:20px;font-size:20px;font-weight:900;z-index:9999;box-shadow:0 20px 60px rgba(79,70,229,.4);text-align:center;';
    toast.innerHTML = `⭐ +${xp} XP<br><span style="font-size:13px;font-weight:600;opacity:.85;">¡Paso completado!</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);

    initRuta(); // Recargar
  } catch(e) {
    const _t = document.getElementById('hub-toast');
    if (_t) { _t.textContent = '❌ ' + e.message; _t.className = 'show'; setTimeout(()=>_t.className='',3500); }
  }
}

// ── MÓDULO: PRÓXIMOS EXÁMENES (alumno) ──
let _exAlData = [];
let _exAlFiltro = 'proximos';

async function exAlInit() {
  await exAlCargar();
}

async function exAlCargar() {
  const el = document.getElementById('examenes-alumno-lista');
  if (!el) return;
  const grupoId = currentPerfil?.alumnos_grupos?.[0]?.grupo_id;
  if (!sb || !grupoId) {
    el.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8;font-size:13px;">Sin grupo asignado</div>';
    return;
  }
  el.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">⏳ Cargando…</div>';
  try {
    const { data } = await sb.from('examenes_docente')
      .select('id, nombre, materia, fecha_aplicacion, trimestre, descripcion, guia_ia, guia_pdf_url, temas_guia')
      .eq('grupo_id', grupoId)
      .eq('visible_alumnos', true)
      .order('fecha_aplicacion', { ascending: true });
    _exAlData = data || [];
  } catch(e) {
    console.warn('[exAl]', e.message);
    _exAlData = [];
  }
  // Badge
  const hoy = new Date().toISOString().split('T')[0];
  const prox = _exAlData.filter(e => e.fecha_aplicacion && e.fecha_aplicacion >= hoy);
  const badge = document.getElementById('examenes-nav-badge');
  if (badge) { if (prox.length) { badge.textContent = prox.length; badge.style.display = 'inline-block'; } else { badge.style.display = 'none'; } }
  exAlRender();
}

function exAlFiltrar(f) {
  _exAlFiltro = f;
  ['prox','todos'].forEach(k => {
    const btn = document.getElementById('exal-f-' + k);
    if (!btn) return;
    if ((k === 'prox' && f === 'proximos') || (k === 'todos' && f === 'todos')) {
      btn.style.background = '#0a5c2e'; btn.style.color = 'white'; btn.style.border = 'none';
    } else {
      btn.style.background = 'white'; btn.style.color = '#475569'; btn.style.border = '1.5px solid #e2e8f0';
    }
  });
  exAlRender();
}

function exAlRender() {
  const el = document.getElementById('examenes-alumno-lista');
  if (!el) return;
  const hoy = new Date().toISOString().split('T')[0];
  let lista = _exAlData;
  if (_exAlFiltro === 'proximos') lista = lista.filter(e => !e.fecha_aplicacion || e.fecha_aplicacion >= hoy);
  if (!lista.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#94a3b8;"><div style="font-size:36px;margin-bottom:10px;">📅</div><div style="font-weight:700;color:#64748b;">Sin exámenes próximos</div><div style="font-size:12px;margin-top:4px;">¡Estás al día!</div></div>';
    return;
  }
  el.innerHTML = lista.map(ex => {
    const diasRestantes = ex.fecha_aplicacion
      ? Math.ceil((new Date(ex.fecha_aplicacion + 'T12:00:00') - new Date()) / 86400000)
      : null;
    const esHoy = diasRestantes === 0;
    const esMañana = diasRestantes === 1;
    const urgente = diasRestantes !== null && diasRestantes <= 3 && diasRestantes >= 0;
    const pasado = diasRestantes !== null && diasRestantes < 0;
    const color = pasado ? '#94a3b8' : urgente ? '#dc2626' : '#0a5c2e';
    const bgColor = pasado ? '#f8fafc' : urgente ? '#fff1f2' : '#f0fdf4';
    const borderColor = pasado ? '#e2e8f0' : urgente ? '#fecaca' : '#bbf7d0';
    const fechaStr = ex.fecha_aplicacion
      ? new Date(ex.fecha_aplicacion + 'T12:00:00').toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' })
      : 'Sin fecha definida';
    const diasLabel = diasRestantes === null ? '' : pasado ? '(pasado)' : esHoy ? '¡HOY!' : esMañana ? '¡Mañana!' : `En ${diasRestantes} días`;
    const tieneGuia = ex.guia_ia || ex.guia_pdf_url;
    return `<div style="background:${bgColor};border-radius:16px;border:1.5px solid ${borderColor};padding:18px;overflow:hidden;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px;">
        <div style="flex:1;">
          <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:2px;">${ex.nombre}</div>
          <div style="font-size:12px;color:#64748b;">${ex.materia} · Trimestre ${ex.trimestre || '—'}</div>
        </div>
        ${diasLabel ? `<span style="padding:4px 10px;border-radius:99px;font-size:11px;font-weight:800;background:${color}20;color:${color};white-space:nowrap;flex-shrink:0;">${diasLabel}</span>` : ''}
      </div>
      <div style="font-size:12px;color:${color};font-weight:700;margin-bottom:8px;">📅 ${fechaStr}</div>
      ${ex.descripcion ? `<div style="font-size:12px;color:#475569;background:white;border-radius:8px;padding:8px 10px;margin-bottom:10px;">${ex.descripcion}</div>` : ''}
      ${ex.temas_guia ? `<div style="font-size:12px;color:#475569;margin-bottom:10px;"><strong>📌 Temas:</strong> ${ex.temas_guia}</div>` : ''}
      ${tieneGuia ? `<details style="margin-top:6px;"><summary style="cursor:pointer;font-size:12px;font-weight:800;color:#7c3aed;display:flex;align-items:center;gap:6px;">✨ Ver guía de estudio</summary>
        <div style="margin-top:10px;">
          ${ex.guia_pdf_url ? `<a href="${ex.guia_pdf_url}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#1e40af;color:white;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;margin-bottom:8px;">📄 Descargar PDF</a>` : ''}
          ${ex.guia_ia ? `<div style="background:#faf5ff;border:1px solid #ddd6fe;border-radius:10px;padding:12px;font-size:12px;color:#4c1d95;line-height:1.7;white-space:pre-wrap;max-height:320px;overflow-y:auto;">${ex.guia_ia}</div>` : ''}
        </div>
      </details>` : `<div style="font-size:11px;color:#94a3b8;font-style:italic;">El docente aún no ha publicado guía de estudio</div>`}
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════
// AUTO-REGISTRO ALUMNO
async function doSolicitudAlumno() {
  const nombre  = (document.getElementById('alu-sol-nombre')?.value || '').trim();
  const email   = (document.getElementById('alu-sol-email')?.value || '').trim();
  const escuela = (document.getElementById('alu-sol-escuela')?.value || '').trim();
  const grupo   = (document.getElementById('alu-sol-grupo')?.value || '').trim();
  const errEl   = document.getElementById('alu-sol-error');
  if (!nombre||!email||!escuela) {
    errEl.textContent='Nombre, correo y escuela son obligatorios'; errEl.style.display='block'; return;
  }
  try {
    const { error } = await sb.from('solicitudes_acceso').insert({
      nombre, email,
      rol: 'alumno',
      escuela_id: escuela,
      grupo_texto: grupo||null,
      estado: 'pendiente',
      creado_en: new Date().toISOString(),
    });
    if (error) throw error;
    document.getElementById('panel-solicitud-alumno').innerHTML = '<div style="text-align:center;padding:16px;color:#15803d;font-weight:700;">✅ Solicitud enviada. El admin revisará tu acceso pronto.</div>';
  } catch(e) {
    errEl.textContent=e.message||'Error al enviar'; errEl.style.display='block';
  }
}

// LOGIN / LOGOUT
// ══════════════════════════════════════════
async function doLogin() {
  const email = document.getElementById('login-user')?.value?.trim();
  const pass  = document.getElementById('login-pass')?.value?.trim();
  const btn   = document.querySelector('.btn-login');
  const errEl = document.getElementById('login-error') || (() => {
    const d = document.createElement('div');
    d.id = 'login-error';
    d.style.cssText = 'color:#ef4444;font-size:13px;margin-top:10px;text-align:center;display:none;';
    document.querySelector('.login-card')?.appendChild(d);
    return d;
  })();

  errEl.style.display = 'none';
  if (!email || !pass) { errEl.textContent = '⚠️ Ingresa tu correo y contraseña'; errEl.style.display = 'block'; return; }
  if (btn) { btn.textContent = 'Entrando…'; btn.disabled = true; }

  // Modo demo - acceso directo para pruebas
  if (email === 'alumno@siembra.test' || email === 'demo' || email === 'alumno') {
    if (!window.SIEMBRA_RUNTIME?.shouldAllowDemoEntry?.()) {
      errEl.textContent = 'La versión productiva no permite acceso demo. Usa demo.html.';
      errEl.style.display = 'block';
      if (btn) { btn.textContent = 'Entrar a mi espacio →'; btn.disabled = false; }
      return;
    }
    currentUser = { id: 'demo-user', email: 'alumno@siembra.test' };
    currentPerfil = {
      nombre: 'Sofía', apellido: 'Ramírez', grado: '6°', grupo: 'A',
      avatar_url: null, xp_total: 840, nivel: 4, monedas: 120,
      racha_dias: 7, insignias_count: 5
    };
    mostrarApp();
    if (btn) { btn.textContent = 'Entrar a mi espacio →'; btn.disabled = false; }
    return;
  }

  try {
    if (!sb) throw new Error('Sin conexión al servidor');
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    currentUser = data.user;
    await cargarPerfil();
    mostrarApp();
  } catch(e) {
    let msg = e.message || 'Error de conexión';
    if (msg === 'Invalid login credentials') msg = '❌ Correo o contraseña incorrectos';
    else if (msg.includes('fetch') || msg.includes('network')) msg = window.SIEMBRA_RUNTIME?.buildNoConnectionMessage?.() || '📡 Sin conexión.';
    else msg = '❌ ' + msg;
    errEl.textContent = msg;
    errEl.style.display = 'block';
    if (btn) { btn.textContent = 'Entrar a mi espacio →'; btn.disabled = false; }
  }
}

async function doLogout() {
  try { if (sb) await sb.auth.signOut(); } catch(e) {}
  currentUser = null; currentPerfil = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
if (window.SiembraAlumnoAuth) {
  window.doLogin = window.SiembraAlumnoAuth.doLogin;
  window.doLogout = window.SiembraAlumnoAuth.doLogout;
}

function initApp() {
  setGreeting();
  // Actualizar stats del hero con datos reales
  const matsConCal = materias.filter(m => m.cal != null);
  const promedio = matsConCal.length
    ? (matsConCal.reduce((s,m)=>s+m.cal,0)/matsConCal.length).toFixed(1)
    : '—';
  const hsEl = document.getElementById('hs-promedio');
  if (hsEl) hsEl.textContent = promedio;
  // Nombre en hero
  if (currentPerfil) {
    const n = document.getElementById('hero-nombre') || document.getElementById('hero-name');
    if (n) n.textContent = currentPerfil.nombre || 'Alumno';
  }
  renderJardin();
  renderLogrosScroll();
  renderMaterias();
  renderNoticias();
  renderGaleria();
  renderLogrosTodos();
  renderProgresoBimestral();
  renderHistorialAsistencia();
  dibujarQR();
  initInsignias();
  initInsigniasPage();
  initBiblioteca();
  // Si hay datos reales, re-renderizar con ellos
  if (window._calificacionesReales) {
    renderJardin();
    renderMaterias();
  }
}

function setGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Buenos días,' : h < 19 ? 'Buenas tardes,' : 'Buenas noches,';
  document.getElementById('hero-greeting').textContent = greet;
}

// ══════════════════════════════════════════
// JARDÍN DE MATERIAS
// ══════════════════════════════════════════
function getNivelPlanta(cal) {
  if (cal == null) return 'sin-datos';
  if (cal >= 9) return 'excelente';
  if (cal >= 8) return 'bien';
  if (cal >= 6) return 'regular';
  return 'riesgo';
}

function getPlantaEmoji(materia, estado) {
  const plantas = { excelente:'🌸', bien:'🌿', regular:'🌱', riesgo:'🥀' };
  return plantas[estado];
}

function renderJardin() {
  const g = document.getElementById('jardin-grid');
  // Mostrar solo las primeras 4 materias en el jardín
  const top4 = [materias[0], materias[1], materias[2], materias[3]];
  g.innerHTML = top4.map((m, i) => {
    const estado = getNivelPlanta(m.cal);
    const emoji = getPlantaEmoji(m, estado);
    const trend = m.tendencia === 'up' ? '<span class="trend-up">↑ subiendo</span>'
                : m.tendencia === 'down' ? '<span class="trend-down">↓ bajando</span>'
                : '<span class="trend-eq">→ estable</span>';
    return `
      <div class="planta-card ${estado} fade-in fade-in-${i+1}" onclick="abrirMateria('${m.id}')">
        <span class="planta-emoji">${emoji}</span>
        <div class="planta-materia">${m.nombre}</div>
        <div class="planta-cal ${estado}">${m.cal ?? '—'}</div>
        <div class="planta-trend">${m.cal != null ? trend : ''}</div>
        <div class="planta-bar"><div class="planta-bar-fill ${estado}" style="width:${(m.cal??0)*10}%"></div></div>
      </div>
    `;
  }).join('');
}

// ══════════════════════════════════════════
// LOGROS
// ══════════════════════════════════════════
function renderLogrosScroll() {
  const container = document.getElementById('logros-scroll');
  container.innerHTML = logros.slice(0, 8).map(l => `
    <div class="logro-chip ${l.desbloqueado ? 'desbloqueado' : 'bloqueado'}"
         onclick="toast('${l.desbloqueado ? '🏆 ' + l.nombre + ' — ' + l.desc : '🔒 Aún no desbloqueado'}')">
      <div class="logro-icon">${l.icon}</div>
      <div class="logro-nombre">${l.nombre}</div>
    </div>
  `).join('');
}

function renderLogrosTodos() {
  const container = document.getElementById('logros-todos');
  container.innerHTML = logros.map(l => `
    <div class="logro-item ${l.desbloqueado ? 'desbloqueado' : 'bloqueado'}"
         onclick="toast('${l.desbloqueado ? '🏆 ' + l.nombre : '🔒 ' + l.desc}')">
      <span class="logro-icon">${l.icon}</span>
      <div class="logro-txt">${l.nombre}</div>
    </div>
  `).join('');
}

// ══════════════════════════════════════════
// MATERIAS DETALLE
// ══════════════════════════════════════════
function renderMaterias() {
  const container = document.getElementById('materias-list');
  container.innerHTML = materias.map((m, idx) => {
    const estado = getNivelPlanta(m.cal);
    const calColor = estado === 'excelente' ? '#16a34a' : estado === 'bien' ? '#2563eb' : estado === 'regular' ? '#d97706' : '#dc2626';
    const bimHtml = m.bimestres.map((b, i) => `
      <div class="bim-item ${i === 3 ? 'current' : ''}">
        <div class="bim-num">B${i+1}</div>
        <div class="bim-cal" style="color:${b >= 8 ? '#16a34a' : b >= 6 ? '#d97706' : b === 0 ? '#9ca3af' : '#dc2626'}">
          ${b === 0 ? '—' : b}
        </div>
      </div>
    `).join('');

    const videosHtml = m.videos.length ? `
      <div style="margin-bottom:14px;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--texto-2);margin-bottom:8px;">📹 Videos de apoyo</div>
        <div class="videos-grid">
          ${m.videos.map(v => `
            <div class="video-card" onclick="toast('▶️ Abriendo: ${v.titulo}')">
              <div class="video-thumb" style="background:linear-gradient(135deg,${m.color}99,${m.color})">
                <span>${v.emoji}</span>
                <div class="video-play">▶</div>
              </div>
              <div class="video-info">
                <div class="video-titulo">${v.titulo}</div>
                <div class="video-dur">⏱ ${v.dur}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    const ejerciciosHtml = m.ejercicios.length ? `
      <div>
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--texto-2);margin-bottom:8px;">💪 Ejercicios de apoyo</div>
        ${m.ejercicios.map(e => `
          <div class="ejercicio-card" onclick="abrirEjercicio('${m.id}','${e.titulo}','${e.desc}',${e.puntos})">
            <div class="ejercicio-header">
              <span class="ejercicio-tipo tipo-${e.tipo}">${e.tipo === 'practica' ? '📝 Práctica' : e.tipo === 'reto' ? '🔥 Reto' : '📖 Repaso'}</span>
            </div>
            <div class="ejercicio-titulo">${e.titulo}</div>
            <div class="ejercicio-desc">${e.desc}</div>
            <div class="ejercicio-footer">
              <span class="ejercicio-puntos">⭐ +${e.puntos} XP</span>
              <span style="margin-left:auto;font-size:12px;font-weight:800;color:var(--verde);">Empezar →</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '';

    return `
      <div class="materia-detalle fade-in" style="animation-delay:${idx * 0.04}s" onclick="toggleMateria('mat-${m.id}')">
        <div class="materia-header">
          <div class="materia-icon" style="background:${m.colorL}">${m.icon}</div>
          <div class="materia-info">
            <div class="materia-nombre">${m.nombre}</div>
            <div class="materia-campo">${m.campo}</div>
          </div>
          <div class="materia-cal-big" style="color:${calColor}">${m.cal ?? '—'}</div>
        </div>
        <div class="materia-body" id="mat-${m.id}">
          <div class="sugerencia-ia">
            <div class="sugerencia-ia-icon">💡</div>
            <div class="sugerencia-ia-text">${m.sugerencia}</div>
          </div>
          <div style="margin-bottom:14px;">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--texto-2);margin-bottom:8px;">📊 Mis bimestres</div>
            <div class="bim-grid">${bimHtml}</div>
          </div>
          ${videosHtml}
          ${ejerciciosHtml}
        </div>
      </div>
    `;
  }).join('');
}

function toggleMateria(id) {
  const body = document.getElementById(id);
  if (!body) return;
  const isOpen = body.classList.contains('open');
  document.querySelectorAll('.materia-body').forEach(b => b.classList.remove('open'));
  if (!isOpen) body.classList.add('open');
}

function abrirMateria(id) {
  navTo('materias');
  setTimeout(() => {
    const body = document.getElementById('mat-' + id);
    if (body) {
      document.querySelectorAll('.materia-body').forEach(b => b.classList.remove('open'));
      body.classList.add('open');
      body.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
}

// ══════════════════════════════════════════
// EJERCICIOS MODAL
// ══════════════════════════════════════════
function abrirEjercicio(materiaId, titulo, desc, puntos) {
  const m = materias.find(x => x.id === materiaId);
  document.getElementById('modal-titulo').textContent = titulo;
  document.getElementById('modal-body').innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-size:13px;color:var(--texto-2);line-height:1.6;margin-bottom:16px;">${desc}</div>
      <div style="background:var(--amarillo-l);border:1.5px solid #fcd34d;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <span style="font-size:20px;">⭐</span>
        <div>
          <div style="font-size:13px;font-weight:800;color:#92400e;">Ganarás ${puntos} XP al completar</div>
          <div style="font-size:11px;color:#a16207;">Tu XP actual: ${alumnoData.xp}</div>
        </div>
      </div>
      <div style="background:var(--bg);border-radius:12px;padding:16px;margin-bottom:16px;">
        <div style="font-size:12px;font-weight:800;color:var(--texto-2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Pregunta de práctica</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:12px;">¿Cuál fracción es equivalente a ½?</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;" id="opciones-quiz">
          <button onclick="responderQuiz(this,false,${puntos})" style="padding:12px;border-radius:10px;border:2px solid var(--border);background:white;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">¼</button>
          <button onclick="responderQuiz(this,false,${puntos})" style="padding:12px;border-radius:10px;border:2px solid var(--border);background:white;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">⅓</button>
          <button onclick="responderQuiz(this,true,${puntos})" style="padding:12px;border-radius:10px;border:2px solid var(--border);background:white;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">²⁄₄</button>
          <button onclick="responderQuiz(this,false,${puntos})" style="padding:12px;border-radius:10px;border:2px solid var(--border);background:white;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">¾</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-ejercicio').classList.add('open');
}

function responderQuiz(btn, correcto, puntos) {
  document.querySelectorAll('#opciones-quiz button').forEach(b => b.disabled = true);
  if (correcto) {
    btn.style.background = '#dcfce7';
    btn.style.borderColor = '#22c55e';
    btn.style.color = '#15803d';
    alumnoData.xp += puntos;
    document.getElementById('hdr-xp').textContent = alumnoData.xp.toLocaleString();
    document.getElementById('nivel-xp-text').textContent = `${alumnoData.xp} / ${alumnoData.xpSiguiente} XP para Nivel 5`;
    document.getElementById('nivel-bar').style.width = Math.min(100, (alumnoData.xp / alumnoData.xpSiguiente * 100)) + '%';
    setTimeout(() => { cerrarModal(); toast(`✅ ¡Correcto! +${puntos} XP ganados 🎉`); }, 800);
  } else {
    btn.style.background = '#fee2e2';
    btn.style.borderColor = '#ef4444';
    btn.style.color = '#dc2626';
    // Highlight correct
    document.querySelectorAll('#opciones-quiz button')[2].style.background = '#dcfce7';
    document.querySelectorAll('#opciones-quiz button')[2].style.borderColor = '#22c55e';
    setTimeout(() => { cerrarModal(); toast('❌ Casi. La respuesta correcta era ²⁄₄'); }, 1200);
  }
}

function cerrarModal() {
  document.getElementById('modal-ejercicio').classList.remove('open');
}

// ══════════════════════════════════════════
// NOTICIAS
// ══════════════════════════════════════════
function renderNoticias() {
  const container = document.getElementById('noticias-list');
  container.innerHTML = noticias.map((n, i) => `
    <div class="noticia-card fade-in" style="animation-delay:${i*0.06}s" onclick="toast('📢 ${n.titulo}')">
      <div class="noticia-banner" style="background:${n.bg}">
        <span style="font-size:48px;">${n.emoji}</span>
        <span class="noticia-tipo">${n.tipo}</span>
      </div>
      <div class="noticia-body">
        <div class="noticia-titulo">${n.titulo}</div>
        <div class="noticia-desc">${n.desc}</div>
        <div class="noticia-footer">
          <span class="noticia-fecha">📅 ${n.fecha}</span>
          <span class="noticia-cta">${n.cta} →</span>
        </div>
      </div>
    </div>
  `).join('');
}

function renderGaleria() {
  const container = document.getElementById('galeria-grid');
  const colors = ['#dcfce7','#dbeafe','#fef9c3','#fce7f3','#ede9fe','#ffedd5','#cffafe','#f0fdf4','#fef2f2'];
  container.innerHTML = galeria.map((emoji, i) => `
    <div class="galeria-item fade-in" style="background:${colors[i]};animation-delay:${i*0.04}s"
         onclick="toast('📸 Abriendo foto del evento')">
      ${emoji}
    </div>
  `).join('');
}

// ══════════════════════════════════════════
// HISTORIAL ASISTENCIA
// ══════════════════════════════════════════
function renderHistorialAsistencia() {
  const dias = [
    {fecha:'Vie 7 Mar',estado:'presente'},
    {fecha:'Jue 6 Mar',estado:'presente'},
    {fecha:'Mié 5 Mar',estado:'presente'},
    {fecha:'Mar 4 Mar',estado:'presente'},
    {fecha:'Lun 3 Mar',estado:'presente'},
    {fecha:'Vie 28 Feb',estado:'tardanza'},
    {fecha:'Jue 27 Feb',estado:'presente'},
    {fecha:'Mié 26 Feb',estado:'ausente'},
    {fecha:'Mar 25 Feb',estado:'presente'},
    {fecha:'Lun 24 Feb',estado:'presente'},
  ];
  const icons = {presente:'✅', ausente:'❌', tardanza:'⏰'};
  const labels = {presente:'Presente', ausente:'Falta', tardanza:'Tardanza'};
  const colors = {presente:'#16a34a', ausente:'#dc2626', tardanza:'#d97706'};
  document.getElementById('historial-asistencia').innerHTML = dias.map(d => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:18px;">${icons[d.estado]}</span>
      <span style="font-size:13px;font-weight:700;flex:1;">${d.fecha}</span>
      <span style="font-size:12px;font-weight:800;color:${colors[d.estado]}">${labels[d.estado]}</span>
    </div>
  `).join('');
}

// ══════════════════════════════════════════
// PROGRESO BIMESTRAL
// ══════════════════════════════════════════
function renderProgresoBimestral() {
  const promedios = [8.5, 8.2, 8.6, 8.3];
  const max = 10;
  const container = document.getElementById('progreso-bimestral');
  container.innerHTML = promedios.map((p, i) => `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
      <div style="font-size:12px;font-weight:800;color:var(--texto-2);width:56px;">Bim ${i+1}</div>
      <div style="flex:1;background:var(--bg);border-radius:10px;height:12px;overflow:hidden;">
        <div style="height:100%;border-radius:10px;width:${p/max*100}%;
          background:${p>=9?'var(--verde-accent)':p>=8?'var(--azul)':p>=6?'var(--amarillo)':'var(--rojo)'};
          transition:width 1s ease;"></div>
      </div>
      <div style="font-size:14px;font-weight:900;width:28px;text-align:right;
        color:${p>=9?'#16a34a':p>=8?'#2563eb':'#d97706'}">${p}</div>
    </div>
  `).join('');
}

// ══════════════════════════════════════════
// QR SIMPLE (canvas)
// ══════════════════════════════════════════
function dibujarQR() {
  const canvas = document.getElementById('qr-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 120;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, size, size);
  // Patrón QR simulado
  const pattern = [
    [1,1,1,1,1,1,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,1,0,1,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,1,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,1,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,1,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,1,1,0,1,0,0,0,0,0,0,0],
    [1,1,0,1,0,1,1,1,0,0,1,0,1,1,0,1,0,1,1],
    [0,1,1,0,1,0,0,0,1,0,0,1,0,1,1,0,1,0,0],
    [1,0,1,1,0,1,1,1,0,1,1,0,1,0,1,1,0,1,1],
    [0,0,0,0,0,0,0,0,1,0,1,1,0,1,0,0,1,0,0],
    [1,1,1,1,1,1,1,0,1,1,0,1,1,0,1,0,1,1,0],
    [1,0,0,0,0,0,1,0,0,0,1,0,0,1,0,1,0,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,1,1,0,1,1,1,0,0],
    [1,0,1,1,1,0,1,0,0,1,1,0,0,1,0,1,0,1,1],
    [1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,0,1,0,1],
    [1,0,0,0,0,0,1,0,0,1,0,0,0,1,0,1,0,0,0],
    [1,1,1,1,1,1,1,0,1,0,1,1,1,0,1,0,1,1,1],
  ];
  const cell = size / pattern.length;
  pattern.forEach((row, y) => {
    row.forEach((val, x) => {
      ctx.fillStyle = val ? '#0d5c2f' : 'white';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    });
  });
}

// ══════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toast);
  window._toast = setTimeout(() => t.classList.remove('show'), 2800);
}

// ══════════════════════════════════════════
// IA — MÓDULO PRACTICAR
// ══════════════════════════════════════════
let tipoEjercicio = 'contexto';
let materiaSeleccionada = null;
let timerInterval = null;
let timerSeg = 0;
let esperandoRespuesta = false;

// Banco de ejercicios contextualizados a México por materia
const EJERCICIOS_IA = {
  mate: {
    contexto: [
      {
        pregunta: 'En el mercado de Oaxaca, una señora vende tlayudas. Cada tlayuda cuesta $25. Si un turista compra 4 tlayudas y paga con un billete de $100, ¿cuánto le regresan de cambio?',
        imagen: '🫔', contexto_badge: '🌮 Mercado de Oaxaca',
        tipo: 'opcion', opciones: ['$0 — justo el precio', '$25 de cambio', '$10 de cambio', '$100 completo'],
        correcta: 1, explicacion: '4 tlayudas × $25 = $100 de costo total. Si paga con $100, el cambio es $100 - $100 = $0... ¡Espera! La respuesta correcta es $0 porque 4 × 25 = 100 exactamente. Si solo comprara 3 serían $75 y recibiría $25 de cambio.'
      },
      {
        pregunta: 'El Estadio Azteca tiene capacidad para 87,500 personas. Si el martes asistieron 52,340 personas, ¿cuántos lugares quedaron vacíos?',
        imagen: '🏟️', contexto_badge: '⚽ Ciudad de México',
        tipo: 'opcion', opciones: ['35,160 lugares', '35,260 lugares', '34,160 lugares', '36,160 lugares'],
        correcta: 0, explicacion: '87,500 − 52,340 = 35,160 lugares vacíos. Para restar números grandes, empieza de derecha a izquierda: 0−0=0, 0−4 (pido prestado)=6, 4−3=1 (ya restamos 1 prestado)=0, 7−2=5... etc.'
      },
      {
        pregunta: 'En Guanajuato se cosecharon fresas en 3 parcelas. La primera dio ¾ de tonelada, la segunda ½ tonelada y la tercera ¼ de tonelada. ¿Cuántas toneladas cosecharon en total?',
        imagen: '🍓', contexto_badge: '🌾 Guanajuato',
        tipo: 'opcion', opciones: ['1 tonelada', '1½ toneladas', '2 toneladas', '¾ de tonelada'],
        correcta: 1, explicacion: '¾ + ½ + ¼ = ¾ + 2⁄4 + ¼ = (3+2+1)⁄4 = 6⁄4 = 1½ toneladas. El truco es convertir todas a fracciones con el mismo denominador (4) antes de sumar.'
      },
    ],
    reto: [
      {
        pregunta: '¡RETO RELÁMPAGO! 5 problemas, 90 segundos. Empieza con: En la Feria de San Marcos en Aguascalientes, cada boleto cuesta $15. ¿Cuánto cuestan 7 boletos?',
        imagen: '🎡', contexto_badge: '⏱ Reto cronometrado',
        tipo: 'opcion_rapida', tiempo: 90,
        opciones: ['$95', '$105', '$100', '$115'],
        correcta: 1, explicacion: '7 × $15 = $105. La tabla del 15: 15, 30, 45, 60, 75, 90, 105. ¡En un reto tienes que ser rápido y preciso!'
      }
    ]
  },
  esp: {
    contexto: [
      {
        pregunta: 'Lee este fragmento y responde: "El ahuizote era una criatura del agua según la mitología mexica. Se decía que jalaba a la gente hacia las profundidades de los lagos con sus manos en forma de zarpa." ¿Qué tipo de texto es este?',
        imagen: '📜', contexto_badge: '🏺 Cultura mexica',
        tipo: 'opcion',
        opciones: ['Texto literario — cuento de ficción', 'Texto informativo — describe algo real de la cultura', 'Texto de opinión — el autor opina', 'Texto instructivo — explica cómo hacer algo'],
        correcta: 1, explicacion: 'Es un texto informativo porque describe una creencia cultural real (la mitología mexica) de forma objetiva, sin inventar ni opinar. Usa datos ("según la mitología mexica") y describe características del ser.'
      },
      {
        pregunta: 'Elige la oración que tiene todas las palabras bien escritas con tilde (acento ortográfico):',
        imagen: '✏️', contexto_badge: '🇲🇽 Español mexicano',
        tipo: 'opcion',
        opciones: ['El niño comio tacos en el mercado', 'El niño comió tacos en el mercádo', 'El niño comió tacos en el mercado', 'El niño cómio tacos en el mercado'],
        correcta: 2, explicacion: '"comió" es una palabra aguda que termina en vocal, por eso lleva tilde. "mercado" es una palabra grave que termina en vocal, por eso NO lleva tilde (las graves solo se acentúan si terminan en consonante que no sea n o s).'
      }
    ],
    contexto_abierta: [
      {
        pregunta: 'Escribe UN párrafo (3-4 oraciones) describiendo un lugar típico de México que conozcas o hayas visitado. Usa al menos 2 adjetivos y menciona qué se puede hacer ahí.',
        imagen: '🌵', contexto_badge: '✍️ Escritura creativa',
        tipo: 'abierta',
        criterios: 'Menciona el lugar, incluye adjetivos descriptivos, describe actividades y usa oraciones completas.',
        explicacion: 'Un buen párrafo descriptivo tiene: oración temática (de qué trata), detalles descriptivos con adjetivos, y una conclusión. Por ejemplo: "El mercado de Jamaica en CDMX es un lugar colorido y fragante. Ahí puedes comprar flores de cempasúchil, frutas tropicales y plantas de todo tipo. Sus pasillos estrechos se llenan de colores brillantes que hacen sentir alegría."'
      }
    ]
  },
  cien: {
    contexto: [
      {
        pregunta: 'En el Bosque de Chapultepec viven ardillas, patos, garzas y peces. Si desaparecieran todos los peces, ¿qué le pasaría primero a las garzas?',
        imagen: '🌳', contexto_badge: '🦜 Bosque de Chapultepec',
        tipo: 'opcion',
        opciones: ['Nada, las garzas comen plantas', 'Aumentarían porque ya no compiten', 'Disminuirían porque pierden su alimento principal', 'Se irían a otro bosque inmediatamente'],
        correcta: 2, explicacion: 'Las garzas son depredadoras de peces — forman parte de la cadena alimenticia como consumidores secundarios. Si desaparece su alimento principal (los peces), su población disminuiría por falta de recursos. Esto se llama dependencia trófica en una red alimentaria.'
      }
    ]
  },
  hist: {
    contexto: [
      {
        pregunta: 'El 20 de noviembre de 1910 comenzó un movimiento histórico muy importante en México liderado por Francisco I. Madero. ¿Cómo se llama este movimiento y qué pedía?',
        imagen: '⚔️', contexto_badge: '🇲🇽 Historia de México',
        tipo: 'opcion',
        opciones: ['La Independencia — libertad de España', 'La Revolución Mexicana — fin de la dictadura de Díaz y más justicia', 'La Reforma — separar Iglesia y Estado', 'La Conquista — llegada de los españoles'],
        correcta: 1, explicacion: 'El 20 de noviembre de 1910 comenzó la Revolución Mexicana. Francisco I. Madero lanzó el Plan de San Luis llamando al pueblo a levantarse contra la dictadura de Porfirio Díaz, que llevaba 30 años en el poder. El movimiento pedía democracia, justicia social y reparto de tierras.'
      }
    ]
  },
  geo: {
    contexto: [
      {
        pregunta: 'México tiene 32 estados. ¿Cuál es el estado más grande del país y en qué región se ubica?',
        imagen: '🗺️', contexto_badge: '🌎 Geografía de México',
        tipo: 'opcion',
        opciones: ['Sonora — Noroeste', 'Chihuahua — Norte', 'Coahuila — Noreste', 'Tamaulipas — Noreste'],
        correcta: 1, explicacion: 'Chihuahua es el estado más grande de México con 247,455 km². Está ubicado en el Norte del país, fronterizo con Estados Unidos. Es famoso por el Cañón del Cobre (Barrancas del Cobre), uno de los cañones más grandes del mundo, y por la Cultura Rarámuri.'
      }
    ]
  },
  edfis: {
    contexto: [
      {
        pregunta: 'Durante la clase de Ed. Física corres 400 metros en 2 minutos. Tu compañero corre los mismos 400 metros en 1 minuto 40 segundos. ¿Quién fue más rápido y por cuántos segundos?',
        imagen: '🏃', contexto_badge: '⚽ Educación Física',
        tipo: 'opcion',
        opciones: ['Tú, por 10 segundos', 'Tu compañero, por 20 segundos', 'Tu compañero, por 10 segundos', 'Empate exacto'],
        correcta: 1, explicacion: 'Tú tardaste 2 minutos = 120 segundos. Tu compañero tardó 1 min 40 seg = 100 segundos. 120 − 100 = 20 segundos de diferencia. Tu compañero fue más rápido por 20 segundos. ¡Este problema combina Ed. Física con Matemáticas!'
      }
    ]
  }
};

function selTipo(tipo, btn) {
  tipoEjercicio = tipo;
  document.querySelectorAll('.practica-chip').forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
}

function renderMateriasSelector() {
  const sel = document.getElementById('materia-selector');
  const matsFiltradas = materias.filter(m => EJERCICIOS_IA[m.id]);
  sel.innerHTML = matsFiltradas.map(m => {
    const estado = getNivelPlanta(m.cal);
    const calColor = estado==='excelente'?'#16a34a':estado==='bien'?'#2563eb':estado==='regular'?'#d97706':'#dc2626';
    return `
      <div class="mat-btn ${materiaSeleccionada===m.id?'selected':''}" onclick="selMateria('${m.id}')">
        <div class="mat-btn-icon">${m.icon}</div>
        <div class="mat-btn-info">
          <div class="mat-btn-nombre">${m.nombre}</div>
          <div class="mat-btn-cal" style="color:${calColor}">Cal: ${m.cal ?? '—'}</div>
        </div>
      </div>
    `;
  }).join('');
}

function selMateria(id) {
  materiaSeleccionada = id;
  renderMateriasSelector();
  setTimeout(() => generarEjercicioIA(id), 150);
}

function generarEjercicioIA(materiaId) {
  const zona = document.getElementById('zona-ejercicio');
  zona.style.display = 'block';
  zona.innerHTML = `<div style="text-align:center;padding:32px;background:white;border-radius:var(--r);border:1.5px solid var(--border);margin-bottom:16px;">
    <div style="font-size:36px;margin-bottom:12px;">✨</div>
    <div style="font-weight:800;font-size:15px;margin-bottom:6px;">Generando ejercicio con IA…</div>
    <div style="color:var(--texto-2);font-size:13px;">Creando un problema contextualizado a México para ti</div>
    <div style="margin-top:16px;display:flex;justify-content:center;"><div class="plan-spinner-sm" style="width:28px;height:28px;"></div></div>
  </div>`;
  zona.scrollIntoView({ behavior:'smooth', block:'start' });

  // Usar Claude API para generar ejercicio dinámico
  generarEjercicioClaude(materiaId);
}

async function generarEjercicioClaude(materiaId) {
  const m = materias.find(x => x.id === materiaId);
  const banco = EJERCICIOS_IA[materiaId];
  const esTipoReto = tipoEjercicio === 'reto';
  const esTipoProyecto = tipoEjercicio === 'proyecto';

  // Construcción del prompt según tipo
  let promptTipo = '';
  if (esTipoReto) {
    promptTipo = 'Es un RETO CRONOMETRADO: crea una pregunta con contexto de México que requiera cálculo rápido mental. Debe ser emocionante y tener un tiempo límite de 60 segundos.';
  } else if (esTipoProyecto) {
    promptTipo = 'Es un MINI-PROYECTO: crea una actividad breve de investigación o creación (3-5 pasos simples) relacionada con algo de México. El alumno escribe su respuesta libremente.';
  } else {
    promptTipo = 'Es un ejercicio CONTEXTUALIZADO A MÉXICO: usa situaciones reales (mercados, ciudades, tradiciones, naturaleza, deportes, cultura) de nuestro país.';
  }

  const prompt = `Eres un tutor educativo para alumnos de primaria/secundaria en México. 
Genera UN ejercicio educativo para la materia: ${m.nombre} (Campo formativo: ${m.campo}).
Alumno: 4° grado de primaria, calificación actual ${m.cal}/10.
${promptTipo}

REGLAS IMPORTANTES:
- El problema DEBE estar ambientado en México (ciudades, tradiciones, naturaleza, comida, deportes, cultura mexicana real)
- Debe ser apropiado para niños de 9-10 años
- Debe ser retador pero alcanzable
- Alineado al programa NEM de la SEP

Responde SOLO con este JSON (sin markdown):
{
  "pregunta": "texto de la pregunta completa con contexto mexicano",
  "contexto_badge": "emoji + lugar o tema de México",
  "imagen_emoji": "un emoji representativo",
  "tipo": "opcion" o "abierta",
  "opciones": ["opción A", "opción B", "opción C", "opción D"] (solo si tipo=opcion),
  "correcta": 0 (índice 0-3, solo si tipo=opcion),
  "explicacion": "explicación clara de POR QUÉ es correcta, con el proceso de resolución paso a paso, máximo 3 oraciones",
  "xp": número entre 60 y 150
}`;

  try {
    const textoEj = await callAI({ feature: 'analisis_alumno', prompt,
      system: 'Responde SOLO con el JSON solicitado. Sin markdown ni texto adicional.' });
    const clean = textoEj.replace(/```json|```/g,'').trim();
    const ejercicio = JSON.parse(clean);
    mostrarEjercicio(ejercicio, m);
  } catch(e) {
    // Fallback al banco local
    const banco = EJERCICIOS_IA[materiaId];
    const pool = esTipoReto && banco.reto ? banco.reto : banco.contexto;
    const ej = pool[Math.floor(Math.random() * pool.length)];
    mostrarEjercicio({...ej, imagen_emoji: ej.imagen, xp: 100}, m);
  }
}

function mostrarEjercicio(ej, m) {
  limpiarTimer();
  const zona = document.getElementById('zona-ejercicio');
  const esReto = tipoEjercicio === 'reto';
  const esAbierta = ej.tipo === 'abierta';
  const xp = ej.xp || 100;

  let opcionesHtml = '';
  if (!esAbierta && ej.opciones) {
    opcionesHtml = `<div class="opciones-grid">
      ${ej.opciones.map((op, i) => `
        <button class="opcion-btn" onclick="responderOpcion(this,${i},${ej.correcta},${xp},'${escapar(ej.explicacion)}')">${op}</button>
      `).join('')}
    </div>`;
  } else {
    opcionesHtml = `<div class="ej-abierta">
      <textarea id="resp-abierta" placeholder="Escribe tu respuesta aquí…"></textarea>
      <button onclick="responderAbierta('${escapar(ej.explicacion)}',${xp})"
        style="width:100%;margin-top:10px;padding:13px;background:var(--verde);color:white;border:none;border-radius:12px;font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;font-weight:800;cursor:pointer;">
        ✅ Enviar respuesta
      </button>
    </div>`;
  }

  zona.innerHTML = `
    <div class="ejercicio-activo fade-in" style="margin-bottom:16px;">
      <div class="ej-header">
        <span class="ej-header-tipo ${esReto?'ej-tipo-reto':esAbierta?'ej-tipo-proyecto':'ej-tipo-contexto'}">
          ${esReto?'⏱ Reto':esAbierta?'🔭 Proyecto':'🌮 México'}
        </span>
        <span style="font-size:12px;font-weight:800;color:var(--texto-2);">${m.nombre}</span>
        ${esReto ? `<div class="ej-timer" id="ej-timer">⏱ <span id="timer-val">60</span>s</div>` : `<span class="ejercicio-puntos" style="margin-left:auto;">⭐ +${xp} XP</span>`}
      </div>
      <div class="ej-body">
        <div class="ej-contexto-badge">${ej.contexto_badge||'🇲🇽 México'}</div>
        <div class="ej-imagen">${ej.imagen_emoji||m.icon}</div>
        <div class="ej-pregunta">${ej.pregunta}</div>
        <div id="opciones-container">${opcionesHtml}</div>
        <div id="retro-container"></div>
        <div id="tutor-trigger-container"></div>
      </div>
    </div>
  `;

  if (esReto) iniciarTimer(60, xp, ej.explicacion);
}

function escapar(txt) {
  return (txt||'').replace(/'/g,"&#39;").replace(/\n/g,' ');
}

function responderOpcion(btn, idx, correctaIdx, xp, explicacion) {
  if (esperandoRespuesta) return;
  esperandoRespuesta = true;
  limpiarTimer();
  document.querySelectorAll('.opcion-btn').forEach(b => b.disabled = true);

  const esCorrecta = idx === correctaIdx;
  btn.classList.add(esCorrecta ? 'correcta' : 'incorrecta');
  if (!esCorrecta) document.querySelectorAll('.opcion-btn')[correctaIdx].classList.add('destacar');

  mostrarRetroalimentacion(esCorrecta, explicacion, xp);
}

function responderAbierta(explicacion, xp) {
  const txt = document.getElementById('resp-abierta')?.value?.trim();
  if (!txt || txt.length < 10) { toast('✏️ Escribe al menos una oración completa'); return; }
  esperandoRespuesta = true;
  mostrarRetroalimentacion(true, explicacion, xp, true);
}

function mostrarRetroalimentacion(correcto, explicacion, xp, esAbierta=false) {
  if (correcto) {
    alumnoData.xp += xp;
    document.getElementById('hdr-xp').textContent = alumnoData.xp.toLocaleString();
    const pct = Math.min(100, Math.round(alumnoData.xp / alumnoData.xpSiguiente * 100));
    const barEl = document.getElementById('nivel-bar');
    if (barEl) barEl.style.width = pct + '%';
    document.getElementById('nivel-xp-text').textContent = `${alumnoData.xp} / ${alumnoData.xpSiguiente} XP para Nivel 5`;
  }

  const retro = document.getElementById('retro-container');
  retro.innerHTML = `
    <div class="retro-card ${correcto?'retro-correcto':'retro-incorrecto'}">
      <div class="retro-icon">${correcto?'🎉':'💪'}</div>
      <div>
        <div class="retro-titulo">${correcto ? (esAbierta?'¡Muy bien! Revisamos juntos':'¡Correcto!') : 'Casi lo tienes'}</div>
        <div class="retro-texto">${correcto ? (esAbierta?'Tu respuesta fue enviada. Aquí la explicación completa:':'¡Excelente respuesta! Así se resuelve:') : 'No fue esta vez, pero aprendemos del error:'}</div>
        <div class="retro-explicacion">${explicacion}</div>
        ${correcto ? `<div class="retro-xp">⭐ +${xp} XP ganados</div>` : ''}
      </div>
    </div>
  `;

  document.getElementById('tutor-trigger-container').innerHTML = `
    <div class="tutor-trigger" onclick="abrirTutorConPregunta('${escapar(explicacion)}')">
      <div class="tutor-avatar">🌱</div>
      <div>
        <div class="tutor-texto">¿Aún tienes dudas?</div>
        <div class="tutor-sub">Pregúntale al Tutor SIEMBRA → explica paso a paso</div>
      </div>
      <span style="margin-left:auto;font-size:18px;">💬</span>
    </div>
    <div style="display:flex;gap:10px;margin-top:12px;">
      <button onclick="siguienteEjercicio()" style="flex:1;padding:13px;background:var(--verde);color:white;border:none;border-radius:12px;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:800;cursor:pointer;">
        ➡️ Siguiente ejercicio
      </button>
      <button onclick="document.getElementById('zona-ejercicio').style.display='none';esperandoRespuesta=false;" style="padding:13px 16px;background:white;border:2px solid var(--border);border-radius:12px;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:800;cursor:pointer;color:var(--texto-2);" aria-label="Cerrar">
        ✕
      </button>
    </div>
  `;

  retro.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function siguienteEjercicio() {
  esperandoRespuesta = false;
  if (materiaSeleccionada) generarEjercicioIA(materiaSeleccionada);
  else toast('Selecciona una materia para continuar');
}

// Timer reto
function iniciarTimer(segundos, xp, explicacion) {
  timerSeg = segundos;
  timerInterval = setInterval(() => {
    timerSeg--;
    const el = document.getElementById('timer-val');
    const cont = document.getElementById('ej-timer');
    if (el) el.textContent = timerSeg;
    if (cont && timerSeg <= 10) cont.classList.add('urgente');
    if (timerSeg <= 0) {
      limpiarTimer();
      document.querySelectorAll('.opcion-btn').forEach(b => b.disabled = true);
      esperandoRespuesta = true;
      mostrarRetroalimentacion(false, '⏰ Se acabó el tiempo. ' + explicacion, xp);
    }
  }, 1000);
}

function limpiarTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ══════════════════════════════════════════
// TUTOR IA (Chat)
// ══════════════════════════════════════════
function abrirTutor() {
  const chat = document.getElementById('chat-tutor');
  chat.classList.add('open');
  chat.scrollIntoView({ behavior:'smooth' });
}

function abrirTutorConPregunta(contexto) {
  abrirTutor();
  const inp = document.getElementById('chat-input');
  inp.value = '¿Puedes explicarme esto con más detalle?';
  inp.focus();
}

async function enviarMensaje() {
  const inp = document.getElementById('chat-input');
  const msg = inp.value.trim();
  if (!msg) return;
  inp.value = '';

  const msgs = document.getElementById('chat-messages');
  msgs.innerHTML += `<div class="chat-msg alumno">${msg}</div>`;
  msgs.innerHTML += `<div class="chat-msg loading" id="chat-loading"><div class="chat-dots"><span></span><span></span><span></span></div></div>`;
  msgs.scrollTop = msgs.scrollHeight;

  // Historial del chat para contexto
  const historial = [...msgs.querySelectorAll('.chat-msg:not(.loading)')].map(el => ({
    role: el.classList.contains('alumno') ? 'user' : 'assistant',
    content: el.textContent
  }));

  const _alumnoNombre = currentPerfil ? [currentPerfil.nombre, currentPerfil.apellido_p].filter(Boolean).join(' ') : 'el alumno';
  const _alumnoGrado = currentPerfil?.alumnos_grupos?.[0]?.grupos ? `${currentPerfil.alumnos_grupos[0].grupos.grado}° de primaria/secundaria` : 'primaria';
  const _alumnoMats = materias.filter(m=>m.cal!=null).map(m=>`${m.nombre} (${m.cal})`).join(', ') || 'calificaciones no disponibles aún';
  const sistema = `Eres el Tutor SIEMBRA, un asistente educativo amigable para alumnos de primaria y secundaria en México.
Estás ayudando a ${_alumnoNombre}, alumno/a de ${_alumnoGrado}.
Sus materias: ${_alumnoMats}.
Responde siempre de forma clara, amigable y con ejemplos de México cuando sea posible.
Usa emojis con moderación. Máximo 3-4 oraciones por respuesta. Si la pregunta no es educativa, redirige amablemente.`;

  try {
    const texto = await callAI({ feature: 'plan_semanal_alumno', prompt: msg, system: sistema });
    document.getElementById('chat-loading')?.remove();
    msgs.innerHTML += `<div class="chat-msg tutor">${texto || 'Lo siento, hubo un problema. ¡Intenta de nuevo!'}</div>`;
    msgs.scrollTop = msgs.scrollHeight;
  } catch(e) {
    document.getElementById('chat-loading')?.remove();
    msgs.innerHTML += `<div class="chat-msg tutor">😅 Parece que hay un problema de conexión. ¡Revisa tu internet e intenta de nuevo!</div>`;
    msgs.scrollTop = msgs.scrollHeight;
  }
}

// ══════════════════════════════════════════
// PLAN SEMANAL IA
// ══════════════════════════════════════════
async function generarPlanSemanal() {
  const body = document.getElementById('plan-semanal-body');
  body.innerHTML = `<div class="plan-loader"><div class="plan-spinner-sm"></div>Generando tu plan personalizado con IA…</div>`;

  const nombre = currentPerfil?.nombre || 'estudiante';
  const mats = window._materiasAlumno || materias || [];
  const resumenMats = mats.map(m=>`${m.nombre}: ${m.cal}`).join(', ') || 'calificaciones no disponibles';
  const bajas = mats.filter(m=>m.cal<8).map(m=>m.nombre).join(', ') || 'ninguna';
  const prompt = `Genera un plan de estudio semanal (lunes a viernes) para ${nombre}, alumno/a en México. Calificaciones: ${resumenMats}. Materias con más práctica necesaria: ${bajas}. Responde SOLO con este JSON sin markdown: [{"dia":"LUN","materia":"nombre","actividad":"descripción breve (max 8 palabras)","tiempo":"X min","xp":número}, ...5 elementos]`;

  try {
    const texto = await callAI({ feature: 'plan_semanal_alumno', prompt,
      system: 'Responde SOLO con el JSON solicitado. Sin markdown ni texto adicional.' });
    const plan = JSON.parse(texto.replace(/```json|```/g,'').trim());
    body.innerHTML = plan.map(d => `
      <div class="plan-dia">
        <div class="plan-dia-label">${d.dia}</div>
        <div class="plan-dia-info">
          <div class="plan-dia-titulo">${d.materia} — ${d.actividad}</div>
          <div class="plan-dia-sub">${d.tiempo} · ejercicios IA personalizados</div>
        </div>
        <span class="plan-dia-xp">+${d.xp} XP</span>
      </div>
    `).join('');
    toast('✅ Plan actualizado');
  } catch(e) {
    body.innerHTML = `<div style="padding:16px;color:var(--texto-2);font-size:13px;">⚠️ No se pudo generar el plan. Verifica tu conexión.</div>`;
  }
}

// ══════════════════════════════════════════
// SUGERENCIA IA PERSONALIZADA
// ══════════════════════════════════════════
async function generarSugerencia() {
  const el = document.getElementById('sugerencia-ia-texto');
  el.innerHTML = '<span style="color:var(--texto-2);">⚙️ Analizando tu progreso…</span>';

  const nombreS = currentPerfil?.nombre?.split(' ')[0] || 'estudiante';
  const matsS = window._materiasAlumno || materias || [];
  const resumenS = matsS.map(m=>`${m.nombre}: ${m.cal}`).join(', ') || 'calificaciones no disponibles';
  const xpS = currentPerfil?.xp_total || 0;
  const rachaS = currentPerfil?.racha_dias || 0;
  const prompt = `Analiza el progreso de ${nombreS}, alumno/a en México, y da un mensaje motivador y útil. Calificaciones: ${resumenS}. Racha: ${rachaS} días, XP: ${xpS}. Escribe UN párrafo corto (3 oraciones máximo): 1) identifica su punto débil con nombre, 2) da un consejo concreto y 3) reconoce sus fortalezas. Usa "tú" y sé amigable. Sin saludos, ve directo al análisis.`;

  try {
    const texto3 = await callAI({ feature: 'analisis_alumno', prompt });
    el.innerHTML = texto3 || el.innerHTML;
    toast('✅ Análisis actualizado');
  } catch(e) {
    el.innerHTML = 'Tu materia más débil esta semana es <strong>Matemáticas (7.5)</strong>. Practica fracciones y divisiones — con 3 ejercicios diarios en 10 días puedes subir. En Geografía y Español vas excelente 🌟';
  }
}

// Hook para inicializar practicar al entrar
// (se inyecta en el navTo original vía patch al final del init)
function initPracticar() {
  renderMateriasSelector();
  const ct = document.getElementById('chat-tutor');
  if (ct) ct.classList.remove('open');
  esperandoRespuesta = false;
  limpiarTimer();
  // Personalizar saludo con nombre real
  const nombre = currentPerfil?.nombre?.split(' ')[0] || 'estudiante';
  const msgs = document.getElementById('chat-messages');
  if (msgs && msgs.children.length <= 1) {
    msgs.innerHTML = `<div class="chat-msg tutor">¡Hola ${nombre}! 👋 Soy tu tutor SIEMBRA. Puedes preguntarme cualquier cosa de tus materias — ya sea una operación de Matemáticas, algo de Historia, o lo que sea. ¿En qué te ayudo hoy?</div>`;
  }
  const sugerenciaHdr = document.getElementById('sugerencia-ia-global')?.querySelector('div div:first-child');
  if (sugerenciaHdr) sugerenciaHdr.textContent = `¡Hola ${nombre}! Aquí va mi análisis`;
  const heroTitle = document.getElementById('practica-hero-title');
  if (heroTitle) heroTitle.textContent = `¡A practicar, ${nombre}!`;
  // Auto-generar sugerencia si hay materias cargadas
  if (materias?.length) setTimeout(generarSugerencia, 500);
}

const _modalEjercicio = document.getElementById('modal-ejercicio');
if (_modalEjercicio) _modalEjercicio.addEventListener('click', function(e) {
  if (e.target === this) cerrarModal();
});

// ══════════════════════════════════════════
// SISTEMA DE INSIGNIAS INTEGRADO
// ══════════════════════════════════════════
const INSIGNIAS = [
  {id:'C-001',rareza:'comun',emoji:'🌱',nombre:'Primera Semilla',desc:'Completaste tu primera semana en SIEMBRA. Bienvenido al jardín.',req:'Asistir 5 días seguidos por primera vez',desbloqueada:true,nueva:false,fecha:'3 Sep 2025',xp_req:0},
  {id:'C-002',rareza:'comun',emoji:'⚽',nombre:'Azteca de Oro',desc:'Demostraste tu espíritu deportivo.',req:'Completar tu primera clase de Ed. Física',desbloqueada:true,nueva:false,fecha:'5 Sep 2025',xp_req:50},
  {id:'C-003',rareza:'comun',emoji:'📖',nombre:'Lector Curioso',desc:'El conocimiento empieza con una página.',req:'Completar 1 ejercicio de Español',desbloqueada:true,nueva:false,fecha:'8 Sep 2025',xp_req:60},
  {id:'C-004',rareza:'comun',emoji:'🔢',nombre:'Calculista',desc:'Resolviste tu primer problema de Matemáticas.',req:'Completar 1 ejercicio de Matemáticas',desbloqueada:true,nueva:false,fecha:'10 Sep 2025',xp_req:60},
  {id:'C-005',rareza:'comun',emoji:'🌍',nombre:'Explorador',desc:'Comenzaste a descubrir la geografía de tu país.',req:'Completar 1 ejercicio de Geografía',desbloqueada:true,nueva:false,fecha:'12 Sep 2025',xp_req:60},
  {id:'C-006',rareza:'comun',emoji:'🔬',nombre:'Pequeño Científico',desc:'La curiosidad científica despertó en ti.',req:'Completar 1 ejercicio de Ciencias',desbloqueada:true,nueva:false,fecha:'15 Sep 2025',xp_req:60},
  {id:'C-007',rareza:'comun',emoji:'🎨',nombre:'Artista en Ciernes',desc:'El arte es parte de quien eres.',req:'Participar en tu primera actividad artística',desbloqueada:false,nueva:false,fecha:null,xp_req:80},
  {id:'C-008',rareza:'comun',emoji:'🤝',nombre:'Buen Compañero',desc:'Ayudaste a alguien en clase por primera vez.',req:'Ser reportado como apoyo por un compañero',desbloqueada:false,nueva:false,fecha:null,xp_req:100},
  {id:'C-009',rareza:'comun',emoji:'📅',nombre:'Puntual',desc:'Sin tardanzas en toda una semana.',req:'Asistir sin tardanzas durante 5 días',desbloqueada:false,nueva:false,fecha:null,xp_req:100},
  {id:'C-010',rareza:'comun',emoji:'💬',nombre:'Preguntón',desc:'Le hiciste 5 preguntas al Tutor SIEMBRA.',req:'Enviar 5 mensajes al tutor IA',desbloqueada:false,nueva:false,fecha:null,xp_req:120},
  {id:'C-011',rareza:'comun',emoji:'🏛️',nombre:'Historiador',desc:'La historia de México vive en ti.',req:'Completar 3 ejercicios de Historia',desbloqueada:false,nueva:false,fecha:null,xp_req:130},
  {id:'C-012',rareza:'comun',emoji:'📝',nombre:'Planificador',desc:'Seguiste tu plan de estudio semanal.',req:'Completar todo el plan semanal IA una vez',desbloqueada:false,nueva:false,fecha:null,xp_req:150},
  {id:'C-013',rareza:'comun',emoji:'🌮',nombre:'Rey del Tianguis',desc:'10 ejercicios con contexto mexicano.',req:'Completar 10 ejercicios contextualizados',desbloqueada:false,nueva:false,fecha:null,xp_req:200},
  {id:'C-014',rareza:'comun',emoji:'⭐',nombre:'Primeros 500 XP',desc:'Tu jardín empieza a florecer.',req:'Acumular 500 XP total',desbloqueada:false,nueva:false,fecha:null,xp_req:500},
  {id:'C-015',rareza:'comun',emoji:'🎯',nombre:'Objetivo Cumplido',desc:'Completaste todos los objetivos de una semana.',req:'Cumplir el 100% del plan semanal 3 veces',desbloqueada:false,nueva:false,fecha:null,xp_req:300},
  {id:'R-001',rareza:'rara',emoji:'🔥',nombre:'Racha de Fuego',desc:'30 días sin faltar. Eres imparable.',req:'Asistencia perfecta 30 días consecutivos',desbloqueada:true,nueva:true,fecha:'10 Mar 2026',xp_req:500},
  {id:'R-002',rareza:'rara',emoji:'🦋',nombre:'Monarca Migratoria',desc:'Como las mariposas de Michoacán, llegaste lejos.',req:'Asistencia perfecta durante un mes completo',desbloqueada:true,nueva:false,fecha:'28 Feb 2026',xp_req:600},
  {id:'R-003',rareza:'rara',emoji:'📚',nombre:'Lector Estrella',desc:'Español perfecto dos bimestres seguidos.',req:'Calificación 9+ en Español dos bimestres',desbloqueada:false,nueva:false,fecha:null,xp_req:700},
  {id:'R-004',rareza:'rara',emoji:'🗺️',nombre:'Geógrafo Pro',desc:'Conoces México como la palma de tu mano.',req:'Calificación 10 en Geografía',desbloqueada:false,nueva:false,fecha:null,xp_req:800},
  {id:'R-005',rareza:'rara',emoji:'🧪',nombre:'Mente Científica',desc:'La ciencia mexicana te necesita.',req:'Completar 20 ejercicios de Ciencias',desbloqueada:false,nueva:false,fecha:null,xp_req:750},
  {id:'R-006',rareza:'rara',emoji:'🏆',nombre:'Top 5 del Grupo',desc:'Entre los mejores de tu salón.',req:'Promedio top 5 del grupo durante un bimestre',desbloqueada:false,nueva:false,fecha:null,xp_req:900},
  {id:'R-007',rareza:'rara',emoji:'⚡',nombre:'Rayo Relámpago',desc:'Ganaste 10 retos cronometrados.',req:'Completar 10 retos cronometrados correctamente',desbloqueada:false,nueva:false,fecha:null,xp_req:850},
  {id:'R-008',rareza:'rara',emoji:'🌵',nombre:'Hijo del Desierto',desc:'Duro y resistente como el nopal.',req:'Completar módulo de ecosistemas de México',desbloqueada:false,nueva:false,fecha:null,xp_req:700},
  {id:'R-009',rareza:'rara',emoji:'🎭',nombre:'Maestro Alebrije',desc:'Tu creatividad brilla con los colores de Oaxaca.',req:'Destacado en 3 proyectos de Educación Artística',desbloqueada:false,nueva:false,fecha:null,xp_req:800},
  {id:'R-010',rareza:'rara',emoji:'💡',nombre:'1000 XP',desc:'Mil puntos. Tu jardín ya es un bosque.',req:'Acumular 1,000 XP total',desbloqueada:false,nueva:false,fecha:null,xp_req:1000},
  {id:'E-001',rareza:'epica',emoji:'🌋',nombre:'Guardián del Popocatépetl',desc:'10 calificaciones perfectas seguidas. Tan poderoso como el volcán más famoso de México.',req:'Obtener 10 en 10 ejercicios consecutivos',desbloqueada:true,nueva:true,fecha:'8 Mar 2026',xp_req:1500},
  {id:'E-002',rareza:'epica',emoji:'🦅',nombre:'Visión del Águila',desc:'Tu perspectiva lo abarca todo, como el águila del Escudo Nacional.',req:'Calificación 9+ en TODAS las materias en un bimestre',desbloqueada:false,nueva:false,fecha:null,xp_req:1800},
  {id:'E-003',rareza:'epica',emoji:'⚔️',nombre:'Espíritu Revolucionario',desc:'Como los héroes de la Revolución, nunca te rindes.',req:'Mejorar calificación en 3 materias distintas en un bimestre',desbloqueada:false,nueva:false,fecha:null,xp_req:1600},
  {id:'E-004',rareza:'epica',emoji:'🌊',nombre:'Señor de Tláloc',desc:'Dominas el flujo del aprendizaje como Tláloc domina la lluvia.',req:'100 ejercicios completados en SIEMBRA',desbloqueada:false,nueva:false,fecha:null,xp_req:2000},
  {id:'E-005',rareza:'epica',emoji:'🐉',nombre:'Serpiente de Conocimiento',desc:'Sabiduría y poder en uno.',req:'Completar todos los ejercicios de Ciencias e Historia en un ciclo',desbloqueada:false,nueva:false,fecha:null,xp_req:2200},
  {id:'E-006',rareza:'epica',emoji:'🏟️',nombre:'El Grande del Azteca',desc:'Grande entre los grandes.',req:'Top 3 del grupo en calificaciones un bimestre completo',desbloqueada:false,nueva:false,fecha:null,xp_req:2500},
  {id:'E-007',rareza:'epica',emoji:'🎪',nombre:'Alma de la Feria',desc:'La escuela eres tú.',req:'Participar activamente en 5 eventos escolares',desbloqueada:false,nueva:false,fecha:null,xp_req:1800},
  {id:'E-008',rareza:'epica',emoji:'🌺',nombre:'Flor de Cempasúchil',desc:'Tu presencia ilumina la escuela.',req:'Asistencia perfecta en noviembre (Día de Muertos)',desbloqueada:false,nueva:false,fecha:null,xp_req:2000},
  {id:'E-009',rareza:'epica',emoji:'🦁',nombre:'Corazón de León',desc:'Enfrentaste tus materias más difíciles y ganaste.',req:'Subir 2 puntos en tu materia más débil',desbloqueada:false,nueva:false,fecha:null,xp_req:1700},
  {id:'E-010',rareza:'epica',emoji:'🎓',nombre:'Maestro en Formación',desc:'Tu nivel ya rivaliza con el del siguiente grado.',req:'Alcanzar Nivel 6 en SIEMBRA (Guardián)',desbloqueada:false,nueva:false,fecha:null,xp_req:3000},
  {id:'L-001',rareza:'legendaria',emoji:'🦅',nombre:'Águila de Tenochtitlán',desc:'Solo los alumnos con promedio perfecto en TODO el ciclo la tienen. Eres historia viva.',req:'Promedio 10 en todas las materias durante todo el ciclo escolar',desbloqueada:false,nueva:false,fecha:null,xp_req:10000,limite:'Máximo 3 por escuela por ciclo'},
  {id:'L-002',rareza:'legendaria',emoji:'🐍',nombre:'Quetzalcóatl',desc:'La serpiente emplumada elige a uno solo. El alumno #1 de toda la escuela.',req:'Ser el alumno con mayor promedio general de toda la escuela',desbloqueada:false,nueva:false,fecha:null,xp_req:15000,limite:'Solo 1 alumno por escuela por ciclo'},
  {id:'L-003',rareza:'legendaria',emoji:'💎',nombre:'Piedra del Sol',desc:'Como el calendario azteca, lo abarca todo. Para quien completa CADA LOGRO.',req:'Desbloquear los 39 logros restantes del álbum',desbloqueada:false,nueva:false,fecha:null,xp_req:20000,limite:'Ilimitada — pero casi imposible'},
  {id:'L-004',rareza:'legendaria',emoji:'🌋',nombre:'Señor del Popocatépetl',desc:'Un año entero sin faltar un solo día.',req:'Asistencia perfecta durante 365 días consecutivos',desbloqueada:false,nueva:false,fecha:null,xp_req:12000,limite:'Máximo 5 por escuela por ciclo'},
  {id:'L-005',rareza:'legendaria',emoji:'🏛️',nombre:'Herencia Mexica',desc:'Ganaste una competencia oficial de la SEP. Eres orgullo de México.',req:'Ganar primer lugar en concurso SEP oficial',desbloqueada:false,nueva:false,fecha:null,xp_req:8000,limite:'Según resultados SEP reales'},
  {id:'L-006',rareza:'legendaria',emoji:'🦋',nombre:'Monarca Eterna',desc:'3 ciclos escolares de asistencia perfecta.',req:'Asistencia perfecta durante 3 ciclos escolares seguidos',desbloqueada:false,nueva:false,fecha:null,xp_req:25000,limite:'La más rara del sistema — histórica'},
  {id:'L-007',rareza:'legendaria',emoji:'🌱',nombre:'Semilla Inmortal',desc:'Fuiste el PRIMER alumno de tu escuela en alcanzar el nivel máximo. Tu nombre queda en la historia.',req:'Primer alumno de la escuela en alcanzar Nivel 7',desbloqueada:false,nueva:false,fecha:null,xp_req:5000,limite:'Solo 1 por escuela — para siempre'},
  {id:'L-008',rareza:'legendaria',emoji:'⭐',nombre:'Estrella de Cinco Puntas',desc:'No la ganas sola. La votan tus maestros y compañeros.',req:'Ser elegido por voto de toda la comunidad escolar',desbloqueada:false,nueva:false,fecha:null,xp_req:0,limite:'1 por ciclo escolar por grupo'},
  {id:'L-009',rareza:'legendaria',emoji:'🎭',nombre:'Gran Maestro Alebrije',desc:'Arte, color y fantasía mexicana en su máxima expresión.',req:'Calificación perfecta en Artes + proyecto destacado a nivel escuela',desbloqueada:false,nueva:false,fecha:null,xp_req:7000,limite:'1 por escuela por ciclo'},
  {id:'L-010',rareza:'legendaria',emoji:'🌞',nombre:'Tonatiuh — El Sol Invicto',desc:'Nunca bajaste de 9 en ninguna materia en toda la primaria. La más épica de todas.',req:'Nunca bajar de 9 en ninguna materia durante toda la primaria (6 años)',desbloqueada:false,nueva:false,fecha:null,xp_req:50000,limite:'La más legendaria de México — histórica'},
];

let albFiltroActual = 'todas';
const RAREZA_LABELS = {comun:'◆ Común',rara:'◈ Rara',epica:'✦ Épica',legendaria:'👑 Legendaria'};
const RAREZA_COL = {
  comun:      {bg:'linear-gradient(160deg,#2a1f14,#4a3728,#6b5040)',brd:'rgba(196,168,130,.5)',txt:'#f5deb3'},
  rara:       {bg:'linear-gradient(160deg,#0d1f35,#1a3a5c,#1e4d7a)',brd:'rgba(74,144,217,.6)',txt:'#a8d4ff'},
  epica:      {bg:'linear-gradient(160deg,#1a0535,#3b0764,#4c1280)',brd:'rgba(192,132,252,.5)',txt:'#e9d5ff'},
  legendaria: {bg:'linear-gradient(160deg,#1a0800,#3d1000,#5c1800)',brd:'rgba(255,215,0,.7)',txt:'#ffd700'},
};

function abrirAlbum() {
  document.getElementById('album-panel').classList.add('open');
  document.body.style.overflow = 'hidden';
  albGenerarEstrellas();
  albActualizarContadores();
  albRenderGrid('todas');
  // Reset filtro buttons
  document.querySelectorAll('.af-btn').forEach(b=>b.className='af-btn');
  document.querySelector('.af-btn')?.classList.add('sel-all');
  document.querySelectorAll('.alb-stat').forEach(t=>t.classList.remove('active'));
  document.getElementById('alb-tab-todas')?.classList.add('active');
}

function cerrarAlbum() {
  document.getElementById('album-panel').classList.remove('open');
  document.body.style.overflow = '';
}

function albGenerarEstrellas() {
  const cont = document.getElementById('alb-stars');
  if (cont && !cont.children.length) {
    for (let i=0;i<70;i++) {
      const s = document.createElement('div');
      s.className = 'astar';
      const sz = Math.random()*2+.5;
      s.style.cssText = `width:${sz}px;height:${sz}px;top:${Math.random()*100}%;left:${Math.random()*100}%;--d:${2+Math.random()*4}s;--dl:${Math.random()*4}s;`;
      cont.appendChild(s);
    }
  }
}

function albActualizarContadores() {
  const des = INSIGNIAS.filter(i=>i.desbloqueada);
  const cnt = {comun:0,rara:0,epica:0,legendaria:0};
  des.forEach(i=>cnt[i.rareza]++);
  const setTxt = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  setTxt('alb-hdr-cnt', `${des.length} / ${INSIGNIAS.length}`);
  setTxt('alb-cnt-todas', des.length);
  setTxt('alb-cnt-comun', cnt.comun);
  setTxt('alb-cnt-rara', cnt.rara);
  setTxt('alb-cnt-epica', cnt.epica);
  setTxt('alb-cnt-legend', cnt.legendaria);
}

function albRenderGrid(filtro) {
  albFiltroActual = filtro;
  let lista = [...INSIGNIAS];
  if (filtro==='comun') lista=lista.filter(i=>i.rareza==='comun');
  else if (filtro==='rara') lista=lista.filter(i=>i.rareza==='rara');
  else if (filtro==='epica') lista=lista.filter(i=>i.rareza==='epica');
  else if (filtro==='legendaria') lista=lista.filter(i=>i.rareza==='legendaria');
  else if (filtro==='des') lista=lista.filter(i=>i.desbloqueada);
  else if (filtro==='bloq') lista=lista.filter(i=>!i.desbloqueada);

  const grupos = [
    {key:'comun',label:'✦ Comunes',cls:'lc'},
    {key:'rara',label:'💠 Raras',cls:'lr'},
    {key:'epica',label:'🔮 Épicas',cls:'le'},
    {key:'legendaria',label:'👑 Las 10 Legendarias',cls:'ll'},
  ];
  let html = '';
  grupos.forEach(g => {
    const items = lista.filter(i=>i.rareza===g.key);
    if (!items.length) return;
    html += `<div class="alb-section">
      <div class="alb-sec-hdr"><div class="alb-sec-line"></div><div class="alb-sec-label ${g.cls}">${g.label}</div><div class="alb-sec-line"></div></div>
      <div class="alb-grid">${items.map(albRenderCarta).join('')}</div>
    </div>`;
  });
  const cont = document.getElementById('alb-grid-container');
  if (cont) cont.innerHTML = html;

  // Touch holo legendarias
  document.querySelectorAll('.ins-card.legendaria.des').forEach(el => {
    el.addEventListener('touchstart',()=>{
      el.classList.add('touched');
      setTimeout(()=>el.classList.remove('touched'),2200);
    },{passive:true});
  });
}

function albRenderCarta(ins) {
  const bloq = !ins.desbloqueada;
  const parts = ins.rareza==='legendaria'&&!bloq ? albParticulas() : '';
  const holo  = ins.rareza==='legendaria'&&!bloq ? '<div class="ins-holo"></div>' : '';
  const nueva = ins.nueva ? '<div class="ins-nueva">¡NUEVA!</div>' : '';
  return `<div class="ins-card ${ins.rareza} ${bloq?'bloq':'des'}" onclick="albAbrirModal('${ins.id}')" style="position:relative;">
    ${nueva}${holo}${parts}
    <div class="ins-pattern"></div>
    <div class="ins-badge">${RAREZA_LABELS[ins.rareza]}</div>
    <div class="ins-num">${ins.id}</div>
    <div class="ins-emoji-wrap"><span class="ins-emoji">${bloq?'🔒':ins.emoji}</span></div>
    <div class="ins-bottom"><div class="ins-nombre">${bloq?'???':ins.nombre}</div></div>
    ${bloq?'<div class="ins-lock"><div class="ins-lock-icon">🔒</div></div>':''}
  </div>`;
}

function albParticulas() {
  let h='<div class="ins-parts">';
  for(let i=0;i<10;i++) h+=`<div class="ins-part" style="left:${10+Math.random()*80}%;--d:${3+Math.random()*4}s;--dl:${Math.random()*4}s;"></div>`;
  return h+'</div>';
}

function albFiltrar(tipo, tabEl, btnEl) {
  if (tabEl) { document.querySelectorAll('.alb-stat').forEach(t=>t.classList.remove('active')); tabEl.classList.add('active'); }
  if (btnEl) {
    document.querySelectorAll('.af-btn').forEach(b=>b.className='af-btn');
    const map={todas:'sel-all',comun:'sel-comun',rara:'sel-rara',epica:'sel-epica',legendaria:'sel-legend',des:'sel-all',bloq:'sel-all'};
    btnEl.className=`af-btn ${map[tipo]||'sel-all'}`;
  }
  albRenderGrid(tipo);
  document.querySelector('.album-body')?.scrollTo(0,0);
}

function albAbrirModal(id) {
  const ins = INSIGNIAS.find(x=>x.id===id);
  if (!ins) return;
  const bloq = !ins.desbloqueada;
  const col = RAREZA_COL[ins.rareza];
  const holo = ins.rareza==='legendaria'&&!bloq ? '<div class="ins-holo" style="opacity:.5;"></div>' : '';
  const parts = ins.rareza==='legendaria'&&!bloq ? albParticulas() : '';
  const hash = ins.desbloqueada ? `SMBRX-${ins.id}-${btoa(ins.nombre+(ins.fecha||'')).substring(0,12).toUpperCase()}` : null;

  const el = document.getElementById('ins-modal-inner');
  if (!el) return;
  el.innerHTML = `
    <div class="ins-modal-card" style="background:${col.bg};border:2px solid ${col.brd};box-shadow:0 0 40px ${col.brd};">
      ${holo}${parts}
      <span class="ins-modal-emoji">${bloq?'🔒':ins.emoji}</span>
      <div class="ins-modal-nombre" style="color:${col.txt}">${bloq?'Bloqueada':ins.nombre}</div>
      <div class="ins-modal-rareza" style="color:${col.txt}">${RAREZA_LABELS[ins.rareza]}</div>
      <div class="ins-modal-desc">${bloq?'Completa el requisito para revelar esta insignia.':ins.desc}</div>
      ${ins.limite?`<div class="ins-modal-limit">⚠️ ${ins.limite}</div>`:''}
      ${hash?`<div class="ins-modal-id"><div><div class="ins-modal-id-lbl">ID Único de Autenticidad</div><div class="ins-modal-id-val">${hash}</div></div><div class="ins-modal-verify" onclick="albVerificar('${hash}')">✓</div></div>`:''}
    </div>
    <div class="ins-modal-req">
      <div class="ins-modal-req-lbl">${ins.desbloqueada?'✅ Requisito completado':'🔒 Para desbloquear'}</div>
      <div class="ins-modal-req-val">${ins.req}</div>
      ${ins.desbloqueada?`<div class="ins-modal-date">📅 Obtenida el ${ins.fecha}</div>`:''}
    </div>
    ${!bloq?`<button class="ins-modal-share" onclick="albCompartir('${ins.id}')">🔗 Compartir esta insignia</button>`:''}
    <button class="ins-modal-btn" onclick="cerrarInsModal()">Cerrar</button>
  `;
  document.getElementById('ins-modal').classList.add('open');
}

function cerrarInsModal() { document.getElementById('ins-modal').classList.remove('open'); }
function albVerificar(hash) { toast(`✅ Insignia verificada — ${hash}`); }
function albCompartir(id) {
  const ins=INSIGNIAS.find(x=>x.id===id);
  if(!ins) return;
  if(navigator.share) navigator.share({title:`¡Obtuve "${ins.nombre}" en SIEMBRA!`,text:`${ins.emoji} ${ins.desc}`});
  else toast(`📋 Insignia "${ins.nombre}" lista para compartir`);
}

function albMostrarUnlock(ins) {
  const ov = document.getElementById('ins-unlock');
  if (!ov) return;
  document.getElementById('ins-unlock-emoji').textContent = ins.emoji;
  document.getElementById('ins-unlock-titulo').textContent = ins.nombre.toUpperCase();
  document.getElementById('ins-unlock-sub').textContent = RAREZA_LABELS[ins.rareza] + ' desbloqueada';
  const rayos = document.getElementById('ins-rayos');
  if (rayos) {
    rayos.innerHTML = '';
    for(let i=0;i<12;i++){const r=document.createElement('div');r.className='ins-rayo';r.style.cssText=`transform:rotate(${i*30}deg);left:50%;height:${100+Math.random()*150}px;animation-delay:${Math.random()*.5}s;`;rayos.appendChild(r);}
  }
  ov.classList.add('show');
  setTimeout(()=>{
    ov.classList.remove('show');
    albActualizarContadores();
    albRenderGrid(albFiltroActual);
    albRenderPreview();
    albActualizarNotifInicio();
    toast(`🎉 ¡${ins.nombre} desbloqueada!`);
  }, 2600);
}

function albRenderPreview() {
  const des = INSIGNIAS.filter(i=>i.desbloqueada);
  const total = INSIGNIAS.length;
  const pct = Math.round(des.length/total*100);
  const subEl=document.getElementById('alb-prev-sub');
  const barEl=document.getElementById('alb-prev-bar');
  const miniEl=document.getElementById('alb-prev-mini');
  if (!subEl) return;
  subEl.textContent=`${des.length} de ${total} insignias desbloqueadas`;
  barEl.style.width=pct+'%';
  const preview=[...des.slice(0,6),...INSIGNIAS.filter(i=>!i.desbloqueada).slice(0,2)];
  miniEl.innerHTML=preview.map(ins=>`<div class="alb-mini-carta ${ins.rareza} ${ins.desbloqueada?'':'bloq'}" title="${ins.desbloqueada?ins.nombre:'???' }">${ins.desbloqueada?ins.emoji:'🔒'}</div>`).join('');
}

function albActualizarNotifInicio() {
  const nuevas=INSIGNIAS.filter(i=>i.desbloqueada&&i.nueva);
  const banner=document.getElementById('ins-notif');
  if (!banner) return;
  if (nuevas.length) {
    const ultima=nuevas[nuevas.length-1];
    banner.style.display='flex';
    document.getElementById('ins-notif-emoji').textContent=ultima.emoji;
    document.getElementById('ins-notif-titulo').textContent=`¡Nueva insignia: ${ultima.nombre}!`;
    document.getElementById('ins-notif-sub').textContent=`${RAREZA_LABELS[ultima.rareza]} · Toca para ver tu álbum`;
  } else {
    banner.style.display='none';
  }
}

function albDemoDesbloquear() {
  const sig=INSIGNIAS.find(i=>!i.desbloqueada);
  if (!sig) { toast('¡Ya tienes todas las insignias! 🎉'); return; }
  sig.desbloqueada=true; sig.nueva=true;
  sig.fecha=new Date().toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'});
  cerrarInsModal();
  if (document.getElementById('album-panel').classList.contains('open')) {
    albMostrarUnlock(sig);
  } else {
    abrirAlbum();
    setTimeout(()=>albMostrarUnlock(sig),500);
  }
}

function initInsignias() {
  albRenderPreview();
  albActualizarNotifInicio();
  albActualizarContadores();
}

// ══════════════════════════════════════════
// BIBLIOTECA — DATOS Y LÓGICA COMPLETA
// ══════════════════════════════════════════

const LIBROS = [
  {
    id:'L001', titulo:'El Principito', autor:'Antoine de Saint-Exupéry',
    emoji:'🌹', color1:'#1e3a5f', color2:'#1e40af',
    paginas:96, progreso:65, estado:'leyendo',
    capitulos: [
      { num:1, titulo:'El dibujo de la boa', texto:`<p>Cuando yo tenía seis años, vi en un libro sobre el bosque virgen que se titulaba "Historias vividas", una magnífica lámina. Representaba una serpiente boa en el momento de tragarse a una fiera.</p><p>En el libro se decía: "La serpiente boa se traga su presa entera, sin masticarla. Luego ya no puede moverse y duerme durante los seis meses que dura su digestión".</p><p>Reflexioné mucho sobre las aventuras de la jungla y logré trazar, con un lápiz de colores, mi primer dibujo. Mi dibujo número 1 era de esta manera: le mostré mi obra de arte a las personas mayores y les pregunté si mi dibujo les daba miedo.</p><p>Me respondieron: "¿Por qué habría de asustar un sombrero?" Mi dibujo no representaba un sombrero. Representaba una serpiente boa que digería un elefante.</p>` },
      { num:2, titulo:'El planeta del principito', texto:`<p>Así viví yo solo, sin tener a nadie con quien hablar verdaderamente, hasta cuando tuve una avería en el desierto del Sahara, hace seis años. Algo se había roto en el motor.</p><p>Como no llevaba conmigo ni mecánico ni pasajero alguno, me dispuse a realizar, solo, una reparación difícil. Era para mí una cuestión de vida o muerte, pues apenas tenía agua de beber para ocho días.</p><p>La primera noche me dormí sobre la arena a unas mil millas de distancia de cualquier región habitada. Estaba más aislado que un náufrago en una balsa en medio del océano. Imagínense, pues, mi sorpresa cuando al amanecer me despertó una extraña vocecita.</p><p>—Por favor... ¡dibújame un cordero!<br>—¿Eh?<br>—¡Dibújame un cordero!</p>` },
      { num:3, titulo:'La rosa', texto:`<p>Pronto supe también algo más sobre ese planeta. La única cosa que producía eran unas flores de pétalos sencillos que no ocupaban lugar y que no molestaban a nadie.</p><p>Aparecían una mañana entre la hierba y desaparecían por la tarde. Pero un día, de un germen llegado de quién sabe dónde, había brotado un retoño; y el principito vigiló muy de cerca esa ramita que no se parecía a las demás.</p><p>Podría ser un nuevo tipo de baobab. Pero el arbusto dejó pronto de crecer y empezó a producir una flor. El principito, que asistía a la formación de un capullo enorme, sentía bien que de él saldría una aparición milagrosa; pero la flor no acababa de finalizar su preparación en el abrigo de su alcoba verde.</p>` },
    ],
    capActual: 1,
    xpPorCap: 80,
    xpTotal: 240,
  },
  {
    id:'L002', titulo:'Corazón · Diario de un niño', autor:'Edmondo De Amicis',
    emoji:'❤️', color1:'#7c2d12', color2:'#c2410c',
    paginas:180, progreso:20, estado:'leyendo',
    capitulos: [
      { num:1, titulo:'Primera día de escuela', texto:`<p>Lunes, 17 de octubre. Hoy es el primer día de escuela. Tres meses de vacaciones en el campo han pasado como un sueño. Esta mañana, cuando mi madre me llevaba a la matriculación, vi pasar por las calles a los muchachos con sus carteras bajo el brazo.</p><p>La escuela de la Barrera Nova es un gran edificio. Las salas estaban llenas de padres y madres que acompañaban a sus hijos. Me llamó la atención la cantidad de alumnos que había. Todos parecían contentos de volver, o al menos, no se los veía tristes.</p><p>Mi maestro se llama el señor Perboni, un hombre largo, sin barba, con los cabellos grises, que tiene la voz lenta y que nunca sonríe. Vi que era bueno porque cuando uno de los alumnos se cayó al suelo, corrió a levantarlo.</p>` },
      { num:2, titulo:'Mi maestro', texto:`<p>Hoy el maestro Perboni nos contó algo sobre su vida. Vive solo. Su madre murió hace poco. Cuando lo dijo, se le veía el dolor en la cara, y todos callamos por un momento.</p><p>Me parece que le voy a tomar cariño. Cuando habla, aunque no sonríe, sus ojos dicen más que muchas palabras. Nos explicó que el estudio es como subir una montaña: cansa al principio, pero desde arriba se ve todo más claro.</p>` },
    ],
    capActual: 0,
    xpPorCap: 90,
    xpTotal: 0,
  },
  {
    id:'L003', titulo:'20,000 Leguas de Viaje Submarino', autor:'Jules Verne',
    emoji:'🐙', color1:'#064e3b', color2:'#065f46',
    paginas:304, progreso:100, estado:'terminado',
    capitulos:[{num:1,titulo:'El misterio del mar',texto:'<p>Completado.</p>'}],
    capActual:0, xpPorCap:100, xpTotal:400,
  },
  {
    id:'L004', titulo:'Robinson Crusoe', autor:'Daniel Defoe',
    emoji:'🏝️', color1:'#78350f', color2:'#92400e',
    paginas:260, progreso:100, estado:'terminado',
    capitulos:[{num:1,titulo:'El naufragio',texto:'<p>Completado.</p>'}],
    capActual:0, xpPorCap:100, xpTotal:350,
  },
  {
    id:'L005', titulo:'Las Aventuras de Tom Sawyer', autor:'Mark Twain',
    emoji:'🎣', color1:'#1e3a5f', color2:'#1e40af',
    paginas:205, progreso:0, estado:'catalogo',
    capitulos:[{num:1,titulo:'Tom y su tía',texto:'<p>Próximamente.</p>'}],
    capActual:0, xpPorCap:85, xpTotal:0,
  },
  {
    id:'L006', titulo:'El Libro de la Selva', autor:'Rudyard Kipling',
    emoji:'🐯', color1:'#365314', color2:'#3f6212',
    paginas:140, progreso:0, estado:'catalogo',
    capitulos:[{num:1,titulo:'Mowgli el cachorro de hombre',texto:'<p>Próximamente.</p>'}],
    capActual:0, xpPorCap:75, xpTotal:0,
  },
  {
    id:'L007', titulo:'Alicia en el País de las Maravillas', autor:'Lewis Carroll',
    emoji:'🐇', color1:'#4c1d95', color2:'#5b21b6',
    paginas:120, progreso:0, estado:'catalogo',
    capitulos:[{num:1,titulo:'Por la madriguera',texto:'<p>Próximamente.</p>'}],
    capActual:0, xpPorCap:80, xpTotal:0,
  },
  {
    id:'L008', titulo:'Los Viajes de Gulliver', autor:'Jonathan Swift',
    emoji:'🗺️', color1:'#1c1917', color2:'#292524',
    paginas:195, progreso:0, estado:'catalogo',
    capitulos:[{num:1,titulo:'Lilliput',texto:'<p>Próximamente.</p>'}],
    capActual:0, xpPorCap:90, xpTotal:0,
  },
];

const BIB_INSIGNIAS = [
  { emoji:'📖', nombre:'Primera lectura', req:'1 libro',    meta:1,  actual:2, bg:'#1e3a5f', col:'#bfdbfe', desbloqueada:true  },
  { emoji:'📚', nombre:'Pequeño lector',  req:'5 libros',   meta:5,  actual:2, bg:'#14532d', col:'#bbf7d0', desbloqueada:false },
  { emoji:'🌟', nombre:'Gran lector',     req:'10 libros',  meta:10, actual:2, bg:'#3b0764', col:'#e9d5ff', desbloqueada:false },
  { emoji:'👑', nombre:'Bibliófilo',      req:'20 libros',  meta:20, actual:2, bg:'#78350f', col:'#fef3c7', desbloqueada:false },
  { emoji:'🔥', nombre:'Racha lectora',   req:'7 días seguidos', meta:7, actual:3, bg:'#7c2d12', col:'#fed7aa', desbloqueada:false },
  { emoji:'⚡', nombre:'Velocista',       req:'2 caps en 1 día', meta:2, actual:1, bg:'#1e40af', col:'#dbeafe', desbloqueada:false },
];

let bibTabActual = 'leyendo';
let lectorLibroId = null;
let lectorCapIdx = 0;
let lectorFontSize = 16;
let lectorProgreso = {};

function bibTab(tipo, btn) {
  bibTabActual = tipo;
  document.querySelectorAll('.bib-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  bibRenderGrid();
}

function bibRenderGrid() {
  const grid = document.getElementById('bib-grid');
  if (!grid) return;
  const filtro = bibTabActual;
  let lista;
  if (filtro === 'leyendo')    lista = LIBROS.filter(l => l.estado === 'leyendo');
  else if (filtro === 'terminados') lista = LIBROS.filter(l => l.estado === 'terminado');
  else lista = LIBROS.filter(l => l.estado === 'catalogo');

  if (!lista.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--texto-2);font-size:13px;">
      ${filtro==='terminados'?'Aún no has terminado ningún libro 📚':'No hay libros aquí todavía'}</div>`;
    return;
  }

  grid.innerHTML = lista.map(l => {
    const pct = l.progreso;
    return `<div class="bib-libro-card" onclick="abrirLector('${l.id}')">
      <div class="bib-libro-portada" style="background:linear-gradient(160deg,${l.color1},${l.color2});">
        <div class="bib-libro-emoji">${l.emoji}</div>
        <div class="bib-libro-titulo">${l.titulo}</div>
        <div class="bib-libro-autor">${l.autor}</div>
      </div>
      ${l.estado==='catalogo' ? '<div class="bib-libro-nuevo">NUEVO</div>' : ''}
      ${l.estado==='terminado' ? '<div class="bib-libro-terminado">✓ LEÍDO</div>' : ''}
      ${l.estado==='leyendo' ? `
        <div class="bib-libro-badge">
          <div class="bib-libro-prog-bar"><div class="bib-libro-prog-fill" style="width:${pct}%"></div></div>
          <div class="bib-libro-pct">${pct}% leído</div>
        </div>` : ''}
    </div>`;
  }).join('');
}

function bibRenderInsignias() {
  const cont = document.getElementById('bib-ins-row');
  if (!cont) return;
  cont.innerHTML = BIB_INSIGNIAS.map(ins => `
    <div class="bib-ins-item" style="background:${ins.desbloqueada?ins.bg+'15':'#f8fafc'};border-color:${ins.desbloqueada?ins.bg+'30':'var(--border)'};${!ins.desbloqueada?'filter:grayscale(.7);opacity:.6':''}">
      <div class="bib-ins-emoji">${ins.desbloqueada?ins.emoji:'🔒'}</div>
      <div class="bib-ins-nombre">${ins.nombre}</div>
      <div class="bib-ins-req">${ins.req}</div>
    </div>`).join('');
}

function initBiblioteca() {
  bibRenderGrid();
  bibRenderInsignias();
}

// ── Abrir lector ──
async function abrirLector(libroId) {
  const libro = LIBROS.find(l => l.id === libroId);
  if (!libro) return;

  lectorLibroId = libroId;
  lectorCapIdx = libro.capActual;

  document.getElementById('lector-titulo').textContent = libro.titulo;
  document.getElementById('lector-panel').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Si el libro ya tiene progreso, ofrecer resumen IA
  const progAnterior = lectorProgreso[libroId];
  if (libro.progreso > 0 && libro.progreso < 100 && !progAnterior) {
    lectorProgreso[libroId] = true;
    await bibMostrarResumenIA(libro);
  } else {
    lectorRenderCapitulo(libro);
  }
}

function cerrarLector() {
  document.getElementById('lector-panel').classList.remove('open');
  document.body.style.overflow = '';
  // Actualizar progreso en la grid
  bibRenderGrid();
}

function lectorRenderCapitulo(libro) {
  if (!libro) libro = LIBROS.find(l => l.id === lectorLibroId);
  const cap = libro.capitulos[lectorCapIdx];
  if (!cap) return;

  document.getElementById('lector-titulo').textContent = libro.titulo;
  document.getElementById('lector-cap').textContent = `Cap. ${cap.num} · ${cap.titulo}`;
  document.getElementById('lector-body').innerHTML = `
    <div class="lector-capitulo-titulo">${cap.titulo}</div>
    <div class="lector-texto">${cap.texto}</div>`;

  const esUltimo = lectorCapIdx >= libro.capitulos.length - 1;
  const pct = Math.round(((lectorCapIdx + 1) / libro.capitulos.length) * 100);
  document.getElementById('lector-prog-fill').style.width = pct + '%';
  document.getElementById('lector-prog-lbl').textContent = `Capítulo ${lectorCapIdx+1} de ${libro.capitulos.length}`;

  const btnAccion = document.getElementById('lector-btn-accion');
  if (esUltimo) {
    btnAccion.textContent = '🎉 ¡Terminé el libro! → Quiz final';
    btnAccion.style.background = 'linear-gradient(135deg,#0369a1,#0ea5e9)';
    btnAccion.onclick = () => bibIniciarQuizFinal(libro);
  } else {
    btnAccion.textContent = 'Siguiente capítulo →';
    btnAccion.style.background = '';
    btnAccion.onclick = bibSigCapitulo;
  }

  // Actualizar progreso del libro
  libro.capActual = lectorCapIdx;
  libro.progreso = pct;
}

function bibSigCapitulo() {
  const libro = LIBROS.find(l => l.id === lectorLibroId);
  if (!libro) return;
  if (lectorCapIdx < libro.capitulos.length - 1) {
    lectorCapIdx++;
    lectorRenderCapitulo(libro);
    document.getElementById('lector-body').scrollTop = 0;
    toast('📖 +' + libro.xpPorCap + ' XP · ¡Bien leído!');
  }
}

function bibFontSize(delta) {
  lectorFontSize = Math.max(12, Math.min(22, lectorFontSize + delta));
  const texto = document.querySelector('.lector-texto');
  if (texto) texto.style.fontSize = lectorFontSize + 'px';
}

// ── Resumen IA al retomar ──
async function bibMostrarResumenIA(libro) {
  document.getElementById('lector-panel').classList.remove('open');
  const modal = document.getElementById('bib-resumen-modal');
  modal.classList.add('open');
  document.getElementById('bib-resumen-libro-nombre').textContent = libro.titulo;
  const textoEl = document.getElementById('bib-resumen-texto');
  textoEl.innerHTML = '<div class="bib-spinner"></div><div style="text-align:center;color:var(--texto-2);font-size:13px;">⚙️ Cargando tu lectura…</div>';

  const capsLeidas = libro.capitulos.slice(0, lectorCapIdx + 1).map(c => c.titulo).join(', ');
  const prompt = `Eres un tutor de lectura amigable para niños de primaria en México.
El alumno está leyendo "${libro.titulo}" de ${libro.autor}.
Lleva leídos los capítulos: ${capsLeidas || 'inicio del libro'}.
El libro tiene ${libro.paginas} páginas y va al ${libro.progreso}% de avance.

Escribe un resumen muy corto y emocionante (máximo 4 oraciones) de lo que ha pasado hasta ahora en la historia para que el alumno recuerde dónde se quedó. 
Usa un tono cálido y animador. Termina con una frase que lo motive a seguir leyendo. Dirígete al alumno por su nombre: ${window.currentPerfil?.nombre || 'amigo/a'}.`;

  try {
    const texto = await callAI({ feature: 'plan_semanal_alumno', prompt });
    textoEl.innerHTML = texto || 'No se pudo generar el resumen.';
  } catch(e) {
    textoEl.innerHTML = `Hasta ahora en <strong>${libro.titulo}</strong> has conocido a los personajes principales y el mundo de la historia. Las últimas escenas que leíste fueron muy emocionantes. Estás en un momento clave, sigue leyendo para descubrir qué pasa. 📚`;
  }
}

function bibVerResumen() {
  const libro = LIBROS.find(l => l.id === lectorLibroId);
  if (libro) bibMostrarResumenIA(libro);
}

function cerrarResumen() {
  document.getElementById('bib-resumen-modal').classList.remove('open');
  document.getElementById('lector-panel').classList.add('open');
  const libro = LIBROS.find(l => l.id === lectorLibroId);
  if (libro) lectorRenderCapitulo(libro);
}

// ── Quiz final del libro ──
let bibQuizPreguntas = [];
let bibQuizIdx = 0;
let bibQuizAciertos = 0;
let bibQuizRespond = false;

async function bibIniciarQuizFinal(libro) {
  cerrarLector();
  const modal = document.getElementById('bib-quiz-modal');
  modal.classList.add('open');
  document.getElementById('bib-quiz-libro-titulo').textContent = `📖 ${libro.titulo}`;
  document.getElementById('bib-quiz-body').innerHTML = `
    <div style="text-align:center;padding:40px 20px;">
      <div class="bib-spinner" style="border-color:rgba(255,255,255,.2);border-top-color:white;"></div>
      <div style="color:rgba(255,255,255,.7);font-size:13px;margin-top:12px;">⚙️ Generando preguntas sobre el libro…</div>
    </div>`;

  const prompt = `Eres un tutor educativo para niños de primaria en México.
El alumno terminó de leer "${libro.titulo}" de ${libro.autor}.

Genera EXACTAMENTE 3 preguntas de comprensión lectora, apropiadas para niños de 9-10 años.
Responde SOLO con este JSON (sin markdown):
[
  {"pregunta":"texto de la pregunta","opciones":["A","B","C","D"],"correcta":0,"explicacion":"por qué es correcta, en 1 oración simple"},
  {"pregunta":"...","opciones":[...],"correcta":1,"explicacion":"..."},
  {"pregunta":"...","opciones":[...],"correcta":2,"explicacion":"..."}
]`;

  try {
    const texto = await callAI({ feature: 'analisis_alumno', prompt,
      system: 'Responde SOLO con el JSON solicitado. Sin markdown ni texto adicional.' });
    bibQuizPreguntas = JSON.parse(texto.replace(/```json|```/g,'').trim());
  } catch(e) {
    bibQuizPreguntas = [
      { pregunta:`¿Cuál es el personaje principal de "${libro.titulo}"?`, opciones:['El narrador','El protagonista de la historia','Un personaje secundario','El autor'], correcta:1, explicacion:'El libro gira en torno al protagonista principal de la historia.' },
      { pregunta:'¿Qué tema principal aborda este libro?', opciones:['La amistad y el crecimiento','Las aventuras espaciales','La historia de México','Los animales del mar'], correcta:0, explicacion:'El libro habla principalmente sobre relaciones humanas y aprendizajes de vida.' },
      { pregunta:'¿Qué aprendiste leyendo este libro?', opciones:['Nada importante','Que las personas mayores siempre tienen razón','Que vale la pena ver el mundo con los ojos de un niño','Que leer es aburrido'], correcta:2, explicacion:'Los grandes libros clásicos nos enseñan a ver el mundo de una forma más especial.' },
    ];
  }

  bibQuizIdx = 0;
  bibQuizAciertos = 0;
  bibQuizRespond = false;
  bibRenderPregunta();
}

function bibRenderPregunta() {
  const body = document.getElementById('bib-quiz-body');
  const q = bibQuizPreguntas[bibQuizIdx];
  if (!q) return;
  const letras = ['A','B','C','D'];
  body.innerHTML = `
    <div class="bib-quiz-prog">
      ${bibQuizPreguntas.map((_,i) => `<div class="bib-quiz-prog-dot ${i<bibQuizIdx?'done':i===bibQuizIdx?'current':''}"></div>`).join('')}
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,.5);margin-bottom:12px;">Pregunta ${bibQuizIdx+1} de ${bibQuizPreguntas.length}</div>
    <div class="bib-quiz-pregunta">${q.pregunta}</div>
    <div id="bib-quiz-ops">
      ${q.opciones.map((op,i) => `
        <button class="bib-quiz-op" id="bq-op-${i}" onclick="bibResponder(${i})">
          <div class="bib-quiz-op-letra">${letras[i]}</div>
          ${op}
        </button>`).join('')}
    </div>
    <div id="bq-feedback" style="display:none;margin-top:14px;padding:14px;border-radius:12px;background:rgba(255,255,255,.1);color:white;font-size:13px;line-height:1.6;"></div>`;
}

function bibResponder(idx) {
  if (bibQuizRespond) return;
  bibQuizRespond = true;
  const q = bibQuizPreguntas[bibQuizIdx];
  const ok = idx === q.correcta;
  if (ok) bibQuizAciertos++;

  document.querySelectorAll('.bib-quiz-op').forEach((btn,i) => {
    btn.disabled = true;
    if (i === q.correcta) btn.classList.add('correcta');
    else if (i === idx && !ok) btn.classList.add('incorrecta');
  });

  const fb = document.getElementById('bq-feedback');
  fb.style.display = 'block';
  fb.innerHTML = `${ok ? '✅ ¡Correcto!' : '💡 No exactamente...'} ${q.explicacion}
    <button style="display:block;width:100%;margin-top:12px;padding:10px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);color:white;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;" onclick="bibSigPregunta()">
      ${bibQuizIdx < bibQuizPreguntas.length - 1 ? 'Siguiente pregunta →' : '🎉 Ver resultados'}
    </button>`;
}

function bibSigPregunta() {
  bibQuizIdx++;
  bibQuizRespond = false;
  if (bibQuizIdx >= bibQuizPreguntas.length) {
    bibMostrarResultadoFinal();
  } else {
    bibRenderPregunta();
  }
}

function bibMostrarResultadoFinal() {
  const body = document.getElementById('bib-quiz-body');
  const total = bibQuizPreguntas.length;
  const pct = Math.round((bibQuizAciertos / total) * 100);
  const perfecto = bibQuizAciertos === total;
  const libActual = LIBROS.find(l => l.id === lectorLibroId);

  // Marcar libro como terminado
  if (libActual) { libActual.estado = 'terminado'; libActual.progreso = 100; }

  // XP ganado
  const xpBase = 300;
  const xpBonus = perfecto ? 100 : bibQuizAciertos * 30;
  const xpTotal = xpBase + xpBonus;

  // ── Guardar en Supabase ──
  if (sb && currentPerfil) {
    // Guardar resultado del quiz
    sb.from('quiz_resultados').insert({
      alumno_id:  currentPerfil.id,
      libro_id:   lectorLibroId,
      aciertos:   bibQuizAciertos,
      total:      total,
      pct:        pct,
      xp_ganado:  xpTotal,
      ciclo:      window.CICLO_ACTIVO || '2025-2026',
      created_at: new Date().toISOString(),
    }).catch(()=>{});
    // Actualizar progreso del libro a 100%
    sb.from('progreso_lectura').upsert({
      alumno_id:    currentPerfil.id,
      libro_id:     lectorLibroId,
      porcentaje:   100,
      terminado:    true,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'alumno_id,libro_id' }).catch(()=>{});
    // Sumar XP real
    sumarXP(xpTotal, `Quiz completado: ${libActual?.titulo || 'libro'}`).catch(()=>{});
    // Guardar para que padres.html lo vea
    sb.from('analisis_ia').insert({
      alumno_id:  currentPerfil.id,
      tipo:       'lectura',
      contenido:  JSON.stringify({ libro: libActual?.titulo, aciertos: bibQuizAciertos, total, pct, xp: xpTotal }),
      created_at: new Date().toISOString(),
    }).catch(()=>{});
  }

  body.innerHTML = `
    <div class="bib-quiz-result">
      <div class="bib-quiz-result-ico">${pct===100?'🏆':pct>=66?'🌟':'📚'}</div>
      <div class="bib-quiz-result-titulo">${pct===100?'¡Lectura perfecta!':pct>=66?'¡Muy bien leído!':'¡Buen intento!'}</div>
      <div class="bib-quiz-result-sub">
        Respondiste <strong style="color:#fbbf24;">${bibQuizAciertos} de ${total}</strong> correctas
      </div>
      <div class="bib-quiz-result-ins">
        <div style="font-size:28px;margin-bottom:6px;">📖</div>
        <div style="font-size:14px;font-weight:900;color:#ffd700;">+${xpTotal} XP</div>
        <div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:2px;">
          ${xpBase} XP por terminar + ${xpBonus} XP por quiz
          ${perfecto ? ' · Bonus de lectura perfecta 🎯' : ''}
        </div>
      </div>
      ${perfecto ? `
        <div style="background:rgba(255,215,0,.15);border:1.5px solid rgba(255,215,0,.4);border-radius:14px;padding:14px;margin-bottom:16px;">
          <div style="font-size:22px;margin-bottom:4px;">📚</div>
          <div style="font-size:13px;font-weight:900;color:#ffd700;">¡Nueva insignia desbloqueada!</div>
          <div style="font-size:11px;color:rgba(255,255,255,.6);">Pequeño lector · 2 libros terminados</div>
        </div>` : ''}
      <button style="width:100%;padding:14px;background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.2);color:white;border-radius:14px;font-size:14px;font-weight:900;cursor:pointer;font-family:Nunito,sans-serif;" onclick="cerrarQuizBib()">
        Volver a la biblioteca →
      </button>
    </div>`;

  toast(`🎉 ¡Libro terminado! +${xpTotal} XP`);
}

function cerrarQuizBib() {
  document.getElementById('bib-quiz-modal').classList.remove('open');
  document.body.style.overflow = '';
  bibRenderGrid();
  bibRenderInsignias();
}



let insPageFiltroActual = 'todas';

function initInsigniasPage() {
  renderInsigniasPage();
}

function renderInsigniasPage() {
  const ins = INSIGNIAS;
  const des = ins.filter(i => i.desbloqueada);

  // Stats por rareza
  ['comun','rara','epica','legendaria'].forEach(r => {
    const el = document.getElementById('ins-cnt-' + r);
    if (el) el.textContent = des.filter(i => i.rareza === r).length;
  });

  // Barra progreso
  const pct = Math.round((des.length / ins.length) * 100);
  const barEl = document.getElementById('ins-page-bar');
  const cntEl = document.getElementById('ins-page-cnt');
  if (barEl) barEl.style.width = pct + '%';
  if (cntEl) cntEl.textContent = `${des.length} / ${ins.length}`;

  // Grid
  insPageRenderGrid(insPageFiltroActual);

  // NFT preview — usar la mejor insignia desbloqueada
  const mejorRareza = ['legendaria','epica','rara','comun'];
  let estrella = null;
  for (const r of mejorRareza) {
    estrella = des.find(i => i.rareza === r);
    if (estrella) break;
  }
  if (estrella) insRenderNFTPreview(estrella);

  // Próximas a desbloquear
  insRenderProximas();
}

function insPageRenderGrid(filtro) {
  const grid = document.getElementById('ins-page-grid');
  if (!grid) return;

  let lista = [...INSIGNIAS];
  if (filtro === 'desbloqueada') lista = lista.filter(i => i.desbloqueada);
  else if (['comun','rara','epica','legendaria'].includes(filtro)) lista = lista.filter(i => i.rareza === filtro);

  const col = RAREZA_COL;
  grid.innerHTML = lista.map(ins => {
    const bloq = !ins.desbloqueada;
    const c = col[ins.rareza];
    return `
      <div class="ins-page-card ${bloq ? 'bloqueada' : ''}"
           style="background:${c.bg};border-color:${c.brd};"
           onclick="albAbrirModal('${ins.id}')">
        ${ins.nueva && !bloq ? '<div class="ins-page-nueva">NUEVA</div>' : ''}
        <div class="ins-page-emoji">${bloq ? '🔒' : ins.emoji}</div>
        <div class="ins-page-nombre" style="color:${c.txt}">${bloq ? '???' : ins.nombre}</div>
        <div class="ins-page-rareza" style="color:${c.txt}">${RAREZA_LABELS[ins.rareza]}</div>
      </div>
    `;
  }).join('');
}

function insPageFiltro(tipo, btn) {
  insPageFiltroActual = tipo;
  document.querySelectorAll('#ins-page-filtros .ins-f-btn').forEach(b => b.classList.remove('ins-f-sel'));
  btn.classList.add('ins-f-sel');
  insPageRenderGrid(tipo);
}

// NFT Metadata — estructura ERC-721 compatible (con datos reales del alumno)
function insGenerarNFTMetadata(ins) {
  const p = window.currentPerfil || {};
  const nombre = p.nombre ? `${p.nombre} ${p.apellido_p||''}`.trim() : 'Alumno SIEMBRA';
  const alumnoId = p.id ? `SMBRX-${(p.nombre||'A').charAt(0)}${(p.apellido_p||'Z').charAt(0)}-${(p.grado||'?')}${(p.seccion||'A')}-${new Date().getFullYear()}` : 'SMBRX-DEMO-2026';
  const escuela = p.escuela_nombre || window._escuelaCfg?.nombre || 'Escuela SIEMBRA';
  const grado = p.grado ? `${p.grado}° ${p.seccion||'A'}` : '—';
  const alumno = { nombre, id: alumnoId, escuela, grado };
  const tokenId = `${ins.id}-${btoa(ins.nombre + alumno.id).substring(0,10).toUpperCase()}`;
  return {
    name: ins.nombre,
    description: ins.desc,
    image: `https://siembra.mx/nft/insignias/${ins.id}.png`,
    external_url: `https://siembra.mx/verificar/${tokenId}`,
    attributes: [
      { trait_type: 'Rareza',      value: ins.rareza.charAt(0).toUpperCase() + ins.rareza.slice(1) },
      { trait_type: 'Materia',     value: ins.campo || 'General' },
      { trait_type: 'Ciclo',       value: '2025–2026' },
      { trait_type: 'Grado',       value: alumno.grado },
      { trait_type: 'XP Requerido', value: ins.xp_req || 0, display_type: 'number' },
      { trait_type: 'Fecha',       value: ins.fecha || 'Pendiente' },
      { trait_type: 'Alumno ID',   value: alumno.id },
    ],
    token_id: tokenId,
    collection: 'SIEMBRA Insignias · México',
    blockchain_ready: true,
    standard: 'ERC-721',
    minted: false,
  };
}

function insRenderNFTPreview(ins) {
  const el = document.getElementById('nft-preview');
  if (!el) return;
  const meta = insGenerarNFTMetadata(ins);
  // Mostrar versión resumida
  const preview = {
    name: meta.name,
    token_id: meta.token_id,
    rareza: meta.attributes[0].value,
    ciclo: '2025–2026',
    blockchain_ready: true,
    standard: 'ERC-721',
    '...': `+${meta.attributes.length} atributos`
  };
  el.textContent = JSON.stringify(preview, null, 2);
}

function insExportarNFT() {
  const des = INSIGNIAS.filter(i => i.desbloqueada);
  if (!des.length) { toast('⚠️ Aún no tienes insignias desbloqueadas'); return; }
  const coleccion = {
    coleccion: 'SIEMBRA Insignias · México',
    version: '1.0',
    generado: new Date().toISOString(),
    alumno: `${window.currentPerfil?.nombre||'Alumno'} ${window.currentPerfil?.apellido_p||''} · ${window.currentPerfil?.id?.substring(0,8)||'DEMO'}`.trim(),
    total_insignias: des.length,
    tokens: des.map(ins => insGenerarNFTMetadata(ins))
  };
  const blob = new Blob([JSON.stringify(coleccion, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'siembra-nft-metadata.json';
  a.click(); URL.revokeObjectURL(url);
  toast('📥 Metadata NFT exportado · ' + des.length + ' insignias');
}

function insVerificarHash() {
  const des = INSIGNIAS.filter(i => i.desbloqueada);
  if (!des.length) { toast('Sin insignias para verificar'); return; }
  const mejorRareza = ['legendaria','epica','rara','comun'];
  let ins = null;
  for (const r of mejorRareza) { ins = des.find(i => i.rareza === r); if (ins) break; }
  const meta = insGenerarNFTMetadata(ins);
  toast(`✅ Token verificado: ${meta.token_id}`);
}

function insRenderProximas() {
  const cont = document.getElementById('ins-proximas');
  if (!cont) return;
  const proximas = INSIGNIAS.filter(i => !i.desbloqueada).slice(0, 4);
  const rarezaColor = { comun:'#78716c', rara:'#1d4ed8', epica:'#7c3aed', legendaria:'#b45309' };
  const rarezaBg = { comun:'#f5f5f4', rara:'#eff6ff', epica:'#faf5ff', legendaria:'#fefce8' };
  cont.innerHTML = proximas.map(ins => `
    <div class="ins-prox-item" onclick="albAbrirModal('${ins.id}')">
      <div class="ins-prox-emoji">${ins.emoji}</div>
      <div class="ins-prox-info">
        <div class="ins-prox-nombre">${ins.nombre}</div>
        <div class="ins-prox-req">${ins.req}</div>
      </div>
      <span class="ins-prox-rareza"
            style="background:${rarezaBg[ins.rareza]};color:${rarezaColor[ins.rareza]}">
        ${RAREZA_LABELS[ins.rareza]}
      </span>
    </div>
  `).join('');
}



// ══ BIBLIOTECA — LIBROS ASIGNADOS Y BÚSQUEDA OPEN LIBRARY ══

const LIBROS_ASIGNADOS = [
  {
    id:'A001', titulo:'Leyendas Mexicanas', autor:'Tradición oral mexicana',
    emoji:'🦅', color1:'#7c2d12', color2:'#991b1b',
    paginas:120, progreso:0, estado:'asignado', asignador:'Docente asignado',
    fechaLimite:'15 Mar 2026', materia:'Historia',
    desc:'La Llorona, El Charro Negro, La Xtabay y más leyendas de México.',
    capitulos:[
      { num:1, titulo:'La Llorona', texto:'<p>Cuenta la leyenda que en las noches de luna, cuando el silencio envuelve las calles del pueblo, se escucha un llanto desgarrador: <em>"¡Aaay, mis hijos...!"</em></p><p>Era una mujer de gran belleza que vivió en la época colonial. Dicen que sus hijos fueron arrebatados por un hombre poderoso, y que ella, consumida por el dolor, vaga eternamente por las orillas de los ríos buscándolos.</p><p>Los ancianos del pueblo dicen que quien la ve de frente queda marcado para siempre.</p>' },
      { num:2, titulo:'El Charro Negro', texto:'<p>En los caminos solitarios de México, especialmente en las noches sin luna, los viajeros hablan de un jinete misterioso montado en un caballo negro como el carbón.</p><p>Dicen que su sombrero es tan oscuro como la medianoche y que sus ojos brillan como ascuas. A quienes acepta su trato, les concede fortuna; pero a cambio, exige el alma.</p>' },
    ],
    capActual:0, xpPorCap:90, xpTotal:0,
  },
  {
    id:'A002', titulo:'Poemas de Amado Nervo', autor:'Amado Nervo',
    emoji:'📜', color1:'#1e3a5f', color2:'#1e40af',
    paginas:80, progreso:0, estado:'asignado', asignador:'Docente asignado',
    fechaLimite:'22 Mar 2026', materia:'Español',
    desc:'Los poemas más hermosos del gran poeta mexicano Amado Nervo.',
    capitulos:[
      { num:1, titulo:'En paz', texto:'<p><em>Muy cerca de mi ocaso, yo te bendigo, Vida,<br>porque nunca me diste ni esperanza fallida,<br>ni trabajos injustos, ni pena inmerecida.</em></p><p><em>Porque veo al final de mi rudo camino<br>que yo fui el arquitecto de mi propio destino.</em></p><p style="font-size:12px;color:var(--texto-2);margin-top:16px;">— Amado Nervo, 1918</p>' },
      { num:2, titulo:'Si tú me dices ven', texto:'<p><em>Si tú me dices "¡ven!", lo dejo todo...<br>No volveré siquiera la mirada<br>para mirar a la mujer amada.</em></p><p style="font-size:12px;color:var(--texto-2);margin-top:16px;">— Amado Nervo</p>' },
    ],
    capActual:0, xpPorCap:70, xpTotal:0,
  },
  {
    id:'A003', titulo:'Fábulas de Esopo', autor:'Esopo',
    emoji:'🦊', color1:'#365314', color2:'#3f6212',
    paginas:95, progreso:45, estado:'asignado', asignador:'Docente asignado',
    fechaLimite:'10 Mar 2026', materia:'Formación Cívica',
    desc:'Las fábulas más famosas con sus moralejas. Historias que enseñan valores.',
    capitulos:[
      { num:1, titulo:'La cigarra y la hormiga', texto:'<p>En un caluroso verano, una cigarra pasaba los días cantando alegremente bajo el sol, sin preocuparse por nada. Mientras tanto, su vecina la hormiga trabajaba sin descanso, guardando granos para el invierno.</p><p>"¿Por qué trabajas tanto?" preguntó la cigarra. La hormiga respondió: "Preparo comida para el frío. Te recomiendo hacer lo mismo."</p><p>Cuando llegó el invierno, la cigarra tenía hambre y frío. La hormiga le preguntó: "¿Cantaste todo el verano?" La cigarra asintió. "Pues baila todo el invierno."</p><p><strong>Moraleja:</strong> Trabaja hoy para no sufrir mañana.</p>' },
      { num:2, titulo:'El lobo y el cordero', texto:'<p>Un lobo vio a un cordero bebiendo agua en un arroyo y quiso comérselo buscando una excusa.</p><p>"¡Estás ensuciando mi agua!" — "Pero el agua corre hacia mí, no hacia ti." — "¡Tu padre me insultó!" — "Mi padre murió antes de que yo naciera."</p><p>El lobo dijo: "¡No dejaré que tus razones me quiten la cena!" Y se lo comió.</p><p><strong>Moraleja:</strong> El que quiere hacer daño siempre encuentra excusa.</p>' },
    ],
    capActual:1, xpPorCap:65, xpTotal:65,
  },
];

function getBibliotecaCompleta() {
  return [...LIBROS, ...LIBROS_ASIGNADOS];
}

const PALETAS_RANDOM = [
  ['#1e3a5f','#1e40af'],['#7c2d12','#c2410c'],['#064e3b','#065f46'],
  ['#4c1d95','#5b21b6'],['#78350f','#92400e'],['#0c4a6e','#0369a1'],
  ['#365314','#3f6212'],['#1c1917','#292524'],['#831843','#9d174d'],
];
function colorRandom(seed) {
  return PALETAS_RANDOM[(seed||0) % PALETAS_RANDOM.length];
}

let bibOLCache = {};

// Override bibTab to support new tabs
const _bibTabOrig = bibTab;
function bibTab(tipo, btn) {
  bibTabActual = tipo;
  document.querySelectorAll('.bib-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const buscarWrap = document.getElementById('bib-buscar-wrap');
  const grid = document.getElementById('bib-grid');
  if (tipo === 'buscar') {
    if (buscarWrap) { buscarWrap.style.display = 'block'; }
    if (grid) grid.style.display = 'none';
  } else {
    if (buscarWrap) buscarWrap.style.display = 'none';
    if (grid) { grid.style.display = 'grid'; }
    bibRenderGrid();
  }
}

// Override bibRenderGrid to support asignados
function bibRenderGrid() {
  const grid = document.getElementById('bib-grid');
  if (!grid) return;
  const todos = getBibliotecaCompleta();
  let lista;
  if      (bibTabActual === 'leyendo')    lista = todos.filter(l => l.estado === 'leyendo');
  else if (bibTabActual === 'asignados')  lista = todos.filter(l => l.estado === 'asignado');
  else if (bibTabActual === 'terminados') lista = todos.filter(l => l.estado === 'terminado');
  else lista = todos.filter(l => l.estado === 'catalogo');

  if (!lista.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--texto-2);font-size:13px;">' +
      (bibTabActual==='asignados'?'Todavía no tienes libros asignados. Cuando tu docente comparta lecturas, aparecerán aquí.':
       bibTabActual==='terminados'?'Aún no has terminado ningún libro en esta sección. Tus lecturas completadas aparecerán aquí.':'Todavía no hay libros disponibles en esta vista. Explora otra categoría o vuelve más tarde.') + '</div>';
    return;
  }

  grid.innerHTML = lista.map(function(l) {
    const pct = l.progreso;
    return '<div class="bib-libro-card" onclick="bibVerDetalleBib(\'' + l.id + '\')">' +
      '<div class="bib-libro-portada" style="background:linear-gradient(160deg,' + l.color1 + ',' + l.color2 + ');">' +
      '<div class="bib-libro-emoji">' + l.emoji + '</div>' +
      '<div class="bib-libro-titulo">' + l.titulo + '</div>' +
      '<div class="bib-libro-autor">' + l.autor + '</div>' +
      '</div>' +
      (l.estado==='catalogo' ? '<div class="bib-libro-nuevo">NUEVO</div>' : '') +
      (l.estado==='terminado' ? '<div class="bib-libro-terminado">✓ LEÍDO</div>' : '') +
      (l.estado==='asignado' ? '<div class="bib-libro-nuevo" style="background:#7c3aed;">ASIGNADO</div>' : '') +
      (l.estado==='leyendo'||l.estado==='asignado' ?
        '<div class="bib-libro-badge"><div class="bib-libro-prog-bar"><div class="bib-libro-prog-fill" style="width:' + pct + '%"></div></div><div class="bib-libro-pct">' + (pct>0?pct+'% leído':'Sin empezar') + '</div></div>' : '') +
      '</div>';
  }).join('');
}

// Override initBiblioteca — carga datos reales desde Supabase
async function initBiblioteca() {
  const grid = document.getElementById('bib-grid');
  if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--texto-2);font-size:13px;"><div style="font-size:28px;margin-bottom:8px;">📚</div>Cargando tu biblioteca…</div>';

  try {
    const librosDB = await cargarLibrosDB();
    if (librosDB && librosDB.length > 0) {
      // Mapear datos reales a formato LIBROS_ASIGNADOS
      const grado = window.currentPerfil?.grado || null;
      const nivel = window.currentPerfil?.nivel || 'primaria';
      // Filtrar por nivel si el libro tiene nivel especificado
      const librosParaAlumno = librosDB.filter(l => {
        if (!l.nivel_min && !l.nivel_max) return true;
        if (!grado) return true;
        const g = parseInt(grado);
        const min = parseInt(l.nivel_min || 0);
        const max = parseInt(l.nivel_max || 99);
        return g >= min && g <= max;
      });
      // Sobreescribir LIBROS_ASIGNADOS con datos reales
      LIBROS_ASIGNADOS.length = 0;
      const PALETA = [['#1e3a5f','#1e40af'],['#7c2d12','#c2410c'],['#064e3b','#065f46'],['#4c1d95','#5b21b6'],['#78350f','#92400e']];
      librosParaAlumno.forEach((l, i) => {
        const pal = PALETA[i % PALETA.length];
        LIBROS_ASIGNADOS.push({
          id: 'DB_' + l.id,
          titulo: l.titulo || l.nombre || 'Sin título',
          autor: l.autor || l.author || '—',
          emoji: l.emoji || '📖',
          color1: pal[0], color2: pal[1],
          paginas: l.paginas || l.total_paginas || 200,
          progreso: l.progreso || 0,
          estado: l.progreso >= 100 ? 'terminado' : (l.progreso > 0 ? 'leyendo' : 'asignado'),
          asignador: l.asignador || 'Tu escuela',
          materia: l.materia || '',
          desc: l.descripcion || '',
          url_descarga: l.url_pdf || l.url || null,
          obligatorio: l.obligatorio,
          capitulos: l.capitulos || [{ num:1, titulo:'Contenido', texto: l.contenido ? '<p>'+l.contenido+'</p>' : '<p>Contenido disponible en la app.</p>' }],
          capActual: l.pagina_actual ? Math.floor((l.pagina_actual / (l.total_paginas||200)) * (l.capitulos?.length||1)) : 0,
          xpPorCap: 80,
          xpTotal: l.progreso >= 100 ? 300 : 0,
        });
      });
      console.log('[BIB] Libros reales cargados:', LIBROS_ASIGNADOS.length);
    }
  } catch(e) {
    console.warn('[BIB] No se pudieron cargar libros desde DB:', e.message);
  }

  bibRenderGrid();
  bibRenderInsignias();
  // Guardar progreso de lectura al cambiar de página
  _iniciarAutoGuardadoProgreso();
}

function _iniciarAutoGuardadoProgreso() {
  // Guardar posición cada vez que se cambie de capítulo
  if (window._bibAutoGuardadoIniciado) return;
  window._bibAutoGuardadoIniciado = true;
  // Guardar al cerrar lector
  const origCerrarLector = window.cerrarLector;
  window.cerrarLector = async function() {
    if (lectorLibroId && sb && window.currentPerfil) {
      const libro = getBibliotecaCompleta().find(l => l.id === lectorLibroId);
      if (libro && libro.progreso > 0) {
        try {
          await guardarProgresoLibro(lectorLibroId.replace('DB_',''), libro.capActual, libro.capitulos?.length || 1);
        } catch(e) {}
      }
    }
    if (typeof origCerrarLector === 'function') origCerrarLector();
  };
}

// Open abrirLector to work with full library
const _abrirLectorOrig = abrirLector;
async function abrirLector(libroId) {
  const libro = getBibliotecaCompleta().find(function(l){return l.id===libroId;});
  if (!libro) return;
  lectorLibroId = libroId;
  lectorCapIdx = libro.capActual;
  document.getElementById('lector-titulo').textContent = libro.titulo;
  document.getElementById('lector-panel').classList.add('open');
  document.body.style.overflow = 'hidden';
  const progAnterior = lectorProgreso[libroId];
  if (libro.progreso > 0 && libro.progreso < 100 && !progAnterior) {
    lectorProgreso[libroId] = true;
    await bibMostrarResumenIA(libro);
  } else {
    lectorRenderCapitulo(libro);
  }
}

function lectorGetLibro() {
  return getBibliotecaCompleta().find(function(l){return l.id===lectorLibroId;});
}

function lectorRenderCapitulo(libro) {
  if (!libro) libro = lectorGetLibro();
  const cap = libro.capitulos[lectorCapIdx];
  if (!cap) return;
  document.getElementById('lector-titulo').textContent = libro.titulo;
  document.getElementById('lector-cap').textContent = 'Cap. ' + cap.num + ' · ' + cap.titulo;
  document.getElementById('lector-body').innerHTML =
    '<div class="lector-capitulo-titulo">' + cap.titulo + '</div>' +
    '<div class="lector-texto">' + cap.texto + '</div>';
  const esUltimo = lectorCapIdx >= libro.capitulos.length - 1;
  const pct = Math.round(((lectorCapIdx + 1) / libro.capitulos.length) * 100);
  document.getElementById('lector-prog-fill').style.width = pct + '%';
  document.getElementById('lector-prog-lbl').textContent = 'Capítulo ' + (lectorCapIdx+1) + ' de ' + libro.capitulos.length;
  const btnAccion = document.getElementById('lector-btn-accion');
  if (esUltimo) {
    btnAccion.textContent = '🎉 ¡Terminé el libro! → Quiz final';
    btnAccion.style.background = 'linear-gradient(135deg,#0369a1,#0ea5e9)';
    btnAccion.onclick = function(){ bibIniciarQuizFinal(libro); };
  } else {
    btnAccion.textContent = 'Siguiente capítulo →';
    btnAccion.style.background = '';
    btnAccion.onclick = bibSigCapitulo;
  }
  libro.capActual = lectorCapIdx;
  libro.progreso = pct;
}

// Modal detalle para libros locales/asignados
function bibVerDetalleBib(libroId) {
  const todos = getBibliotecaCompleta();
  const libro = todos.find(function(l){return l.id===libroId;});
  if (!libro) return;
  const modal = document.getElementById('bib-detalle-modal');
  const card  = document.getElementById('bib-detalle-card');
  if (!modal||!card) { abrirLector(libroId); return; }
  modal.classList.add('open');
  const esAsignado = libro.estado === 'asignado';
  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">' +
      '<div style="font-size:13px;font-weight:700;color:var(--texto-2);">' + (esAsignado?'📋 Asignado por tu maestra':'📚 Biblioteca SIEMBRA') + '</div>' +
      '<button onclick="cerrarDetalleBib()" style="border:none;background:#f0f0f0;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px;" aria-label="Cerrar">✕</button>' +
    '</div>' +
    '<div class="bib-detalle-portada-row">' +
      '<div style="flex-shrink:0;">' +
        '<div class="bib-detalle-portada-placeholder" style="background:linear-gradient(160deg,' + libro.color1 + ',' + libro.color2 + ');">' +
          '<span style="font-size:36px;">' + libro.emoji + '</span>' +
        '</div>' +
      '</div>' +
      '<div style="flex:1;">' +
        '<div class="bib-detalle-titulo">' + libro.titulo + '</div>' +
        '<div class="bib-detalle-autor">' + libro.autor + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' +
          '<span class="bib-detalle-chip" style="background:#f0fdf4;color:#15803d;">' + libro.paginas + ' págs.</span>' +
          (libro.materia ? '<span class="bib-detalle-chip" style="background:#f5f3ff;color:#7c3aed;">' + libro.materia + '</span>' : '') +
          (libro.progreso>0 ? '<span class="bib-detalle-chip" style="background:#e0f2fe;color:#0369a1;">' + libro.progreso + '% leído</span>' : '') +
        '</div>' +
        (esAsignado ? '<div class="bib-detalle-asig-badge">👩‍🏫 ' + libro.asignador + ' · ' + libro.fechaLimite + '</div>' : '') +
      '</div>' +
    '</div>' +
    (libro.desc ? '<div class="bib-detalle-desc">' + libro.desc + '</div>' : '') +
    '<button onclick="cerrarDetalleBib();abrirLector(\'' + libro.id + '\')" style="width:100%;padding:14px;background:linear-gradient(135deg,' + libro.color1 + ',' + libro.color2 + ');color:white;border:none;border-radius:14px;font-size:14px;font-weight:900;cursor:pointer;font-family:Nunito,sans-serif;margin-bottom:8px;">' +
      (libro.progreso>0 ? '📖 Continuar leyendo · ' + libro.progreso + '%' : '📖 Empezar a leer') +
    '</button>' +
    (libro.url_descarga ? '<a href="' + libro.url_descarga + '" target="_blank" download style="display:block;width:100%;padding:12px;background:#f0fdf4;color:#15803d;border:1.5px solid #86efac;border-radius:14px;font-size:13px;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;text-align:center;text-decoration:none;box-sizing:border-box;margin-bottom:8px;">📥 Descargar libro (PDF)</a>' : '') +
    '<button onclick="cerrarDetalleBib()" style="width:100%;padding:12px;background:#f0f0f0;color:var(--texto-2);border:none;border-radius:14px;font-size:13px;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;">Cerrar</button>';
}

function cerrarDetalleBib() {
  var m = document.getElementById('bib-detalle-modal');
  if (m) m.classList.remove('open');
}

// ── Open Library Search ──
var bibSearchCache = {};

async function bibBuscar() {
  var input = document.getElementById('bib-search-input');
  var q = input ? input.value.trim() : '';
  if (!q) return;
  bibBuscarTermino(q);
}

// ── Filtro de contenido para alumnos hasta 3° secundaria ──────────
const BIB_PALABRAS_BLOQUEADAS = [
  // Sexual explícito
  'erotic','erotica','erótica','sex manual','adult','pornograph','xxx','kama sutra',
  'sexual explícit','nude','nudism','fetish',
  // Violencia extrema
  'torture','tortura','gore','snuff','serial killer','asesino en serie',
  'massacre','masacre','brutal murder',
  // Temas no aptos para menores
  'drug addict','adiccion','cocaine','heroin','meth','narcotic',
  'suicide guide','suicid','how to kill',
  // Terror extremo
  'horror explicit','splatter',
];

const BIB_TERMINOS_BLOQUEADOS_BUSQUEDA = [
  'porn','porno','sex','sexy','erotic','adult book','xxx','kama','nude',
  'erotica','fetish','gore','splatter','snuff',
];

function bibTerminoBloqueado(termino) {
  const t = termino.toLowerCase();
  return BIB_TERMINOS_BLOQUEADOS_BUSQUEDA.some(p => t.includes(p));
}

function bibLibroEsApropiado(libro) {
  const texto = ((libro.title || '') + ' ' + (libro.subject || []).join(' ')).toLowerCase();
  return !BIB_PALABRAS_BLOQUEADAS.some(p => texto.includes(p));
}

async function bibBuscarTermino(termino) {
  var input = document.getElementById('bib-search-input');
  if (input) input.value = termino;
  var estadoEl = document.getElementById('bib-search-estado');
  var resultsEl = document.getElementById('bib-search-resultados');
  if (!estadoEl || !resultsEl) return;

  // Bloquear búsquedas con términos no apropiados
  if (bibTerminoBloqueado(termino)) {
    estadoEl.style.display = 'block';
    estadoEl.innerHTML = '<div style="font-size:13px;color:#dc2626;padding:12px;background:#fef2f2;border-radius:10px;">🚫 Búsqueda no permitida. Esta biblioteca es para alumnos de primaria y secundaria.</div>';
    if (resultsEl) resultsEl.innerHTML = '';
    return;
  }

  if (bibSearchCache[termino]) { bibRenderResultados(bibSearchCache[termino]); return; }

  estadoEl.style.display = 'block';
  estadoEl.innerHTML = '<div class="bib-spinner"></div><div style="color:var(--texto-2);font-size:13px;">Buscando "' + termino + '"…</div>';
  resultsEl.innerHTML = '';

  try {
    // Buscar en Open Library — añadir filtro de audiencia infantil/juvenil
    var url = 'https://openlibrary.org/search.json?q=' + encodeURIComponent(termino) + '&language=spa&limit=18&fields=key,title,author_name,cover_i,first_publish_year,number_of_pages_median,subject&lang=es';
    var resp = await fetch(url);
    if (!resp.ok) throw new Error('no response');
    var data = await resp.json();
    if (!data.docs || !data.docs.length) {
      estadoEl.innerHTML = '<div style="font-size:13px;color:var(--texto-2);padding:16px;">😕 Sin resultados para "' + termino + '". Prueba con otro título.</div>';
      return;
    }
    // Filtrar libros inapropiados y quedarnos con máx 9
    var libros = data.docs
      .filter(function(d){ return d.title && d.author_name && d.author_name.length > 0; })
      .filter(bibLibroEsApropiado)
      .slice(0, 9);

    if (!libros.length) {
      estadoEl.innerHTML = '<div style="font-size:13px;color:var(--texto-2);padding:16px;">😕 Sin resultados apropiados para "' + termino + '". Intenta con otro título.</div>';
      return;
    }
    bibSearchCache[termino] = libros;
    estadoEl.style.display = 'none';
    bibRenderResultados(libros);
  } catch(e) {
    estadoEl.innerHTML = '<div style="font-size:13px;color:var(--texto-2);padding:10px 0;">📡 Sin conexión. Mostrando sugerencias locales:</div>';
    bibRenderResultadosFallback(termino);
  }
}

function bibRenderResultados(libros) {
  var el = document.getElementById('bib-search-resultados');
  var est = document.getElementById('bib-search-estado');
  if (!el) return;
  if (est) est.style.display = 'none';
  el.innerHTML = libros.map(function(l, idx) {
    var cover = l.cover_i ? 'https://covers.openlibrary.org/b/id/' + l.cover_i + '-M.jpg' : null;
    var pal = colorRandom(idx + (l.cover_i||0));
    var c1=pal[0], c2=pal[1];
    var titulo = l.title ? (l.title.length>35?l.title.slice(0,33)+'…':l.title) : 'Sin título';
    var autor = l.author_name ? l.author_name[0] : 'Desconocido';
    var workId = l.key ? l.key.replace('/works/','') : ('OL_'+idx);
    bibOLCache[workId] = {title:l.title, author:autor, cover_i:l.cover_i||null, pages:l.number_of_pages_median||null, year:l.first_publish_year||null};
    var inner = cover
      ? '<img class="bib-resultado-portada" src="' + cover + '" loading="lazy" onerror="this.style.display=\'none\'">'
        + '<div class="bib-resultado-portada-placeholder" style="background:linear-gradient(160deg,' + c1 + ',' + c2 + ');display:none;"><div style="font-size:28px;">📖</div></div>'
      : '<div class="bib-resultado-portada-placeholder" style="background:linear-gradient(160deg,' + c1 + ',' + c2 + ');"><div style="font-size:28px;">📖</div><div style="font-size:9px;font-weight:900;color:white;margin-top:4px;text-align:center;padding:0 4px;">' + titulo + '</div></div>';
    return '<div class="bib-resultado-card" onclick="bibVerDetalleOL(\'' + workId + '\')">' +
      inner +
      '<div class="bib-resultado-info"><div class="bib-resultado-titulo">' + titulo + '</div><div class="bib-resultado-autor">' + autor.slice(0,20) + '</div></div>' +
      '</div>';
  }).join('');
}

function bibRenderResultadosFallback(termino) {
  bibRenderResultados([
    {title:'Don Quijote de la Mancha', author_name:['Miguel de Cervantes'], cover_i:null, key:'/works/OLfb1'},
    {title:'Lazarillo de Tormes', author_name:['Anónimo'], cover_i:null, key:'/works/OLfb2'},
    {title:'Cuentos de la selva', author_name:['Horacio Quiroga'], cover_i:null, key:'/works/OLfb3'},
  ]);
}

async function bibVerDetalleOL(workKey) {
  var meta = bibOLCache[workKey] || {};
  var modal = document.getElementById('bib-detalle-modal');
  var card  = document.getElementById('bib-detalle-card');
  if (!modal||!card) return;
  modal.classList.add('open');
  var pal = colorRandom(meta.cover_i||7);
  var c1=pal[0], c2=pal[1];
  var coverUrl = meta.cover_i ? 'https://covers.openlibrary.org/b/id/' + meta.cover_i + '-L.jpg' : null;
  var yaAgregado = getBibliotecaCompleta().some(function(l){return l.titulo===meta.title;});

  var portadaHTML = coverUrl
    ? '<img class="bib-detalle-portada-img" src="' + coverUrl + '" onerror="this.style.display=\'none\'">'
      + '<div class="bib-detalle-portada-placeholder" style="background:linear-gradient(160deg,' + c1 + ',' + c2 + ');display:none;"><span style="font-size:32px;">📖</span></div>'
    : '<div class="bib-detalle-portada-placeholder" style="background:linear-gradient(160deg,' + c1 + ',' + c2 + ');"><span style="font-size:32px;">📖</span></div>';

  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">' +
      '<div style="font-size:13px;font-weight:700;color:var(--texto-2);">📚 Open Library</div>' +
      '<button onclick="cerrarDetalleBib()" style="border:none;background:#f0f0f0;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px;" aria-label="Cerrar">✕</button>' +
    '</div>' +
    '<div class="bib-detalle-portada-row">' +
      '<div style="flex-shrink:0;">' + portadaHTML + '</div>' +
      '<div style="flex:1;">' +
        '<div class="bib-detalle-titulo">' + (meta.title||'') + '</div>' +
        '<div class="bib-detalle-autor">' + (meta.author||'') + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' +
          (meta.year ? '<span class="bib-detalle-chip" style="background:#f0f9ff;color:#0369a1;">' + meta.year + '</span>' : '') +
          (meta.pages ? '<span class="bib-detalle-chip" style="background:#f0fdf4;color:#15803d;">' + meta.pages + ' págs.</span>' : '') +
          '<span class="bib-detalle-chip" style="background:#fef3c7;color:#92400e;">Español</span>' +
          '<span class="bib-detalle-chip" style="background:#f5f3ff;color:#7c3aed;">Gratis</span>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div id="bib-detalle-desc-wrap"><div style="text-align:center;"><div class="bib-spinner"></div><div style="font-size:12px;color:var(--texto-2);">Cargando descripción…</div></div></div>' +
    '<div id="bib-detalle-botones" style="margin-top:16px;">' +
      (yaAgregado
        ? '<div style="text-align:center;padding:12px;color:var(--verde);font-weight:700;font-size:14px;">✅ Ya está en tu biblioteca</div>'
        : '<button onclick="bibAgregarDeOL(\'' + workKey + '\')" style="width:100%;padding:14px;background:linear-gradient(135deg,#0369a1,#0ea5e9);color:white;border:none;border-radius:14px;font-size:14px;font-weight:900;cursor:pointer;font-family:Nunito,sans-serif;margin-bottom:8px;">➕ Agregar a mi biblioteca (+50 XP)</button>' +
          '<button onclick="cerrarDetalleBib()" style="width:100%;padding:12px;background:#f0f0f0;color:var(--texto-2);border:none;border-radius:14px;font-size:13px;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;">Cancelar</button>') +
    '</div>';

  // Load description
  if (workKey && !workKey.includes('fb')) {
    try {
      var resp = await fetch('https://openlibrary.org/works/' + workKey + '.json');
      var data = await resp.json();
      var desc = typeof data.description === 'string' ? data.description : (data.description&&data.description.value ? data.description.value : 'Libro en dominio público disponible en español.');
      var descEl = document.getElementById('bib-detalle-desc-wrap');
      if (descEl) descEl.innerHTML = '<div class="bib-detalle-desc">' + (desc.length>300?desc.slice(0,298)+'…':desc) + '</div>';
    } catch(e) {
      var descEl = document.getElementById('bib-detalle-desc-wrap');
      if (descEl) descEl.innerHTML = '<div class="bib-detalle-desc">Libro en dominio público disponible en español.</div>';
    }
  }
}

function bibAgregarDeOL(workKey) {
  var meta = bibOLCache[workKey] || {};
  var idx = getBibliotecaCompleta().length;
  var pal = colorRandom(meta.cover_i||idx);
  var nuevoLibro = {
    id: 'OL_' + workKey,
    titulo: meta.title || 'Libro',
    autor: meta.author || 'Autor',
    emoji: '📖', color1: pal[0], color2: pal[1],
    paginas: meta.pages || 150,
    progreso: 0, estado: 'leyendo',
    capitulos: [{ num:1, titulo:'Inicio', texto:'<p>Este libro fue encontrado en Open Library. En la versión completa de SIEMBRA el texto se cargará automáticamente.</p>' }],
    capActual: 0, xpPorCap: 80, xpTotal: 0,
  };
  LIBROS.push(nuevoLibro);
  cerrarDetalleBib();
  bibTabActual = 'leyendo';
  document.querySelectorAll('.bib-tab').forEach(function(b){b.classList.remove('active');});
  var t = document.getElementById('bib-tab-leyendo'); if(t) t.classList.add('active');
  var bw = document.getElementById('bib-buscar-wrap'); if(bw) bw.style.display='none';
  var bg = document.getElementById('bib-grid'); if(bg) bg.style.display='grid';
  bibRenderGrid();
  toast('📚 "' + nuevoLibro.titulo + '" agregado · +50 XP');
}

// ══════════════════════════════════════════════════════════════════
// BLOQUE A — 5 AGENTES
// ══════════════════════════════════════════════════════════════════

// ── Agente 1: Coach IA diario ─────────────────────────────────────
async function agente1MisionDia() {
  const card  = document.getElementById('mision-dia-card');
  const texto = document.getElementById('mision-dia-texto');
  const chips = document.getElementById('mision-chips');
  if (!card || !texto) return;
  card.style.display = 'block';
  texto.innerHTML = '<span style="opacity:.6;">⚙️ Preparando tu misión de hoy…</span>';
  const nombre = currentPerfil?.nombre?.split(' ')[0] || 'estudiante';
  const mats   = window._materiasAlumno || materias || [];
  const bajas  = mats.filter(m => m.cal < 8).map(m => m.nombre).slice(0,2);
  const xpHoy  = alumnoData.xp || 0;
  const racha  = alumnoData.streak || 0;
  const prompt = `Soy tutor de ${nombre}. Sus materias: ${mats.map(m=>m.nombre+': '+m.cal).join(', ')}. XP: ${xpHoy}. Racha: ${racha} días. ${bajas.length?'Necesita reforzar: '+bajas.join(', '):''} Genera la misión de hoy en JSON: {"mensaje":"1 oración motivadora","tareas":["tarea 1","tarea 2","tarea 3"],"xp_total":120} Solo JSON.`;
  try {
    const txt  = await callAI({ feature: 'plan_semanal_alumno', prompt, system: 'Responde SOLO con el JSON. Sin markdown.' });
    const data = JSON.parse(txt.replace(/```json|```/g,'').trim());
    texto.innerHTML = `<div style="font-size:14px;margin-bottom:10px;">${data.mensaje}</div>`;
    if (chips && data.tareas) {
      chips.innerHTML = data.tareas.map(t => `<span style="padding:7px 13px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:20px;font-size:12px;font-weight:700;color:white;">${t}</span>`).join('');
      chips.innerHTML += `<span style="margin-left:auto;padding:7px 13px;background:rgba(255,215,0,.2);border:1px solid rgba(255,215,0,.4);border-radius:20px;font-size:12px;font-weight:700;color:#ffd700;">+${data.xp_total} XP</span>`;
    }
  } catch(e) {
    const mat = bajas[0] || 'tus materias';
    texto.innerHTML = `<div style="font-size:14px;margin-bottom:10px;">¡Hola ${nombre}! Hoy practica ${mat} por 15 minutos. 💪</div>`;
    if (chips) chips.innerHTML = `<span style="padding:7px 13px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:20px;font-size:12px;font-weight:700;color:white;">📖 Repasar ${mat}</span><span style="margin-left:auto;padding:7px 13px;background:rgba(255,215,0,.2);border:1px solid rgba(255,215,0,.4);border-radius:20px;font-size:12px;font-weight:700;color:#ffd700;">+100 XP</span>`;
  }
}

// ── Agente 2: Gamificación pro — nivel con mapa visual ────────────
function agente2NivelPro() {
  const xp = alumnoData.xp || currentPerfil?.perfil_alumno?.xp_total || 0;
  const nivelIdx   = [...NIVELES].reduce((best,n,i) => xp >= n.min ? i : best, 0);
  const nivelActual = NIVELES[nivelIdx];
  const nivelSig    = NIVELES[nivelIdx + 1];
  const xpSig       = nivelSig?.min || nivelActual.min + 600;
  const pct         = nivelSig ? Math.min(100, Math.round(((xp - nivelActual.min) / (xpSig - nivelActual.min)) * 100)) : 100;
  const iconEl  = document.getElementById('nivel-icon');
  const nomEl   = document.getElementById('nivel-nombre');
  const subEl   = document.getElementById('nivel-sub');
  const barEl   = document.getElementById('nivel-bar');
  const xpTxtEl = document.getElementById('nivel-xp-text');
  if (iconEl)  iconEl.textContent  = nivelActual.icon;
  if (nomEl)   nomEl.textContent   = nivelActual.nombre;
  if (subEl)   subEl.textContent   = `Nivel ${nivelIdx + 1} · ${pct}% al siguiente`;
  if (barEl)   { barEl.style.width = '0%'; setTimeout(() => barEl.style.width = pct + '%', 300); }
  if (xpTxtEl) xpTxtEl.textContent = nivelSig ? `${xp.toLocaleString()} / ${xpSig.toLocaleString()} XP para ${nivelSig.nombre}` : `${xp.toLocaleString()} XP · ¡Nivel máximo! 🏆`;
  // Mini mapa de niveles
  const nivelCard = document.querySelector('.nivel-card');
  if (nivelCard && !document.getElementById('nivel-mapa')) {
    const mapa = document.createElement('div');
    mapa.id = 'nivel-mapa';
    mapa.style.cssText = 'display:flex;align-items:center;gap:4px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.15);';
    mapa.innerHTML = NIVELES.map((n, i) => {
      const ok = xp >= n.min; const esAct = i === nivelIdx;
      return `<div style="flex:1;text-align:center;" title="${n.nombre}"><div style="font-size:${esAct?'20px':'14px'};opacity:${ok?'1':'0.3'};transition:.3s;">${n.icon}</div>${esAct?`<div style="width:6px;height:6px;border-radius:50%;background:#22c55e;margin:3px auto 0;"></div>`:''}</div>`;
    }).join('');
    nivelCard.appendChild(mapa);
  }
}

// ── Agente 3: Objetivos por materia ──────────────────────────────
function agente3ObjetivosMaterias() {
  const pg = document.getElementById('page-materias');
  if (!pg || document.getElementById('objetivos-materias')) return;
  const mats = window._materiasAlumno || materias || [];
  const bajas = mats.filter(m => m.cal < 9).slice(0, 3);
  if (!bajas.length) return;
  const div = document.createElement('div');
  div.id = 'objetivos-materias';
  div.style.cssText = 'margin-top:20px;';
  div.innerHTML = `<div class="section-title" style="margin-bottom:12px;">🎯 Mis objetivos</div>` +
    bajas.map(m => {
      const meta = Math.min(10, Math.ceil(m.cal) + 1);
      const pct  = Math.round((m.cal / meta) * 100);
      const col  = m.cal >= 8 ? '#22c55e' : m.cal >= 6 ? '#f59e0b' : '#ef4444';
      return `<div style="background:var(--card);border-radius:14px;border:1.5px solid var(--border);padding:14px 16px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">${m.icon||'📚'}</span>
            <div><div style="font-size:13px;font-weight:700;color:var(--texto);">${m.nombre}</div><div style="font-size:11px;color:var(--texto-2);">Meta: llegar a <strong>${meta}.0</strong></div></div>
          </div>
          <div style="text-align:right;"><div style="font-size:20px;font-weight:900;color:${col};">${m.cal.toFixed(1)}</div><div style="font-size:10px;color:var(--texto-2);">${pct}% hacia meta</div></div>
        </div>
        <div style="height:8px;background:var(--border-2);border-radius:99px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${col};border-radius:99px;transition:.8s;"></div></div>
      </div>`;
    }).join('');
  pg.appendChild(div);
}

// ── Agente 4: Alerta automática si materia < 6 ───────────────────
function agente4AlertaRiesgo() {
  const mats   = window._materiasAlumno || materias || [];
  const riesgo = mats.filter(m => m.cal < 6);
  if (!riesgo.length || document.getElementById('alerta-riesgo-alumno')) return;
  const pg = document.getElementById('page-inicio');
  if (!pg) return;
  const nombre = currentPerfil?.nombre?.split(' ')[0] || 'estudiante';
  const alerta = document.createElement('div');
  alerta.id = 'alerta-riesgo-alumno';
  alerta.style.cssText = 'margin-top:16px;';
  alerta.innerHTML = `<div style="background:linear-gradient(135deg,#fef2f2,#fee2e2);border:1.5px solid #fca5a5;border-radius:16px;padding:16px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <span style="font-size:24px;">⚠️</span>
      <div><div style="font-size:14px;font-weight:700;color:#b91c1c;">Necesitas reforzar ${riesgo.map(m=>m.nombre).join(', ')}</div><div style="font-size:12px;color:#991b1b;">La IA te da una estrategia personalizada</div></div>
    </div>
    <div id="alerta-riesgo-ia" style="font-size:13px;color:#7f1d1d;line-height:1.6;margin-bottom:10px;"><span style="opacity:.6;">Generando recomendación…</span></div>
    <button onclick="navTo('practicar')" style="width:100%;padding:10px;background:#b91c1c;color:white;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;">💪 Practicar ahora</button>
  </div>`;
  const heroCard = pg.querySelector('.nivel-card') || pg.querySelector('.hero-card');
  if (heroCard?.nextSibling) pg.insertBefore(alerta, heroCard.nextSibling);
  else pg.appendChild(alerta);
  callAI({ feature: 'analisis_alumno', prompt: `${nombre} tiene calificación menor a 6 en: ${riesgo.map(m=>m.nombre+' ('+m.cal+')').join(', ')}. En 2 oraciones dile exactamente qué hacer esta semana. Tono motivador, usa "tú".` })
    .then(txt => { const el=document.getElementById('alerta-riesgo-ia'); if(el) el.textContent=txt; })
    .catch(() => { const el=document.getElementById('alerta-riesgo-ia'); if(el) el.textContent=`Dedica 15 minutos diarios a repasar ${riesgo[0].nombre}. ¡Con práctica constante puedes mejorar!`; });
}

// ── Agente 5: Progreso visual biblioteca tipo Duolingo ────────────
function agente5ProgresoLectura() {
  const pg = document.getElementById('page-biblioteca');
  if (!pg || document.getElementById('lect-streak-banner')) return;
  const terminados = LIBROS.filter(l => l.estado==='terminado' || l.progreso>=100).length;
  const leyendo    = LIBROS.filter(l => l.progreso>0 && l.progreso<100).length;
  const totalPags  = LIBROS.reduce((s,l) => s + Math.round((l.paginas||200)*(l.progreso||0)/100), 0);
  const hero = pg.querySelector('.bib-hero');
  if (!hero) return;
  const banner = document.createElement('div');
  banner.id = 'lect-streak-banner';
  banner.style.cssText = 'margin-bottom:14px;';
  banner.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
      <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);border-radius:14px;padding:14px;text-align:center;color:white;"><div style="font-size:26px;font-weight:900;font-family:'Fraunces',serif;">${terminados}</div><div style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Terminados</div></div>
      <div style="background:linear-gradient(135deg,#0d5c2f,#16a34a);border-radius:14px;padding:14px;text-align:center;color:white;"><div style="font-size:26px;font-weight:900;font-family:'Fraunces',serif;">${totalPags}</div><div style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Páginas leídas</div></div>
      <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:14px;padding:14px;text-align:center;color:white;"><div style="font-size:26px;font-weight:900;font-family:'Fraunces',serif;">${leyendo}</div><div style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Leyendo</div></div>
    </div>
    <div style="background:var(--card);border-radius:14px;border:1.5px solid var(--border);padding:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;"><span style="font-size:12px;font-weight:700;color:var(--texto);">📚 Meta lectora del ciclo</span><span style="font-size:12px;font-weight:700;color:#0369a1;">${terminados}/5 libros</span></div>
      <div style="height:10px;background:var(--border-2);border-radius:99px;overflow:hidden;"><div id="lect-meta-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#0369a1,#0ea5e9);border-radius:99px;transition:1s;"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;">${[1,2,3,4,5].map(n=>`<span style="font-size:16px;opacity:${terminados>=n?'1':'0.25'};">📗</span>`).join('')}</div>
    </div>`;
  pg.insertBefore(banner, hero);
  setTimeout(() => { const bar=document.getElementById('lect-meta-bar'); if(bar) bar.style.width=Math.min(100,(terminados/5)*100)+'%'; }, 400);
}

// ── Hook navTo para disparar agentes ─────────────────────────────
const _navToOrig = window.navTo;
window.navTo = function(page) {
  _navToOrig(page);
  if (page === 'inicio')    { setTimeout(agente1MisionDia,500); setTimeout(agente2NivelPro,100); setTimeout(agente4AlertaRiesgo,200); }
  if (page === 'materias')  { setTimeout(agente3ObjetivosMaterias,300); }
  if (page === 'biblioteca'){ setTimeout(agente5ProgresoLectura,200); }
  if (page === 'tareas')    { initTareas(); }
};
// Disparar también en initApp
const _initAppBlqA = window.initApp;
window.initApp = function() {
  if (typeof _initAppBlqA === 'function') _initAppBlqA();
  setTimeout(agente2NivelPro,300);
  setTimeout(agente4AlertaRiesgo,400);
  setTimeout(agente1MisionDia,800);
};

// ── PWA: Service Worker + Install prompt ─────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(r => console.log('[SW] Registrado:', r.scope))
      .catch(e => console.warn('[SW] Error:', e));
  });
}
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

// ── Optimización 3: throttle en alumno.html ──────────────────────
// agente1MisionDia: max 1 vez cada 12h por alumno
const _agente1Orig = window.agente1MisionDia;
window.agente1MisionDia = async function() {
  const uid = window.currentPerfil?.id || 'demo';
  const key = 'mision_dia_' + uid;
  const stored = localStorage.getItem(key);
  const ttlHoras = 12;
  if (stored) {
    const diffH = (Date.now() - parseInt(stored)) / 3600000;
    if (diffH < ttlHoras) {
      // Mostrar tarjeta con mensaje de "ya generado hoy"
      const card = document.getElementById('mision-dia-card');
      const texto = document.getElementById('mision-dia-texto');
      if (card && texto && !texto.textContent.trim()) {
        card.style.display = 'block';
        texto.innerHTML = '<span style="opacity:.7;">✅ Tu misión de hoy ya fue generada. Regresa mañana para una nueva.</span>';
      }
      return;
    }
  }
  localStorage.setItem(key, Date.now().toString());
  await _agente1Orig?.();
};

// agente4AlertaRiesgo: solo si hay materias < 6 (ya lo verifica internamente)
// generarSugerencia en initPracticar: throttle 6h
const _initPracticarOrig = window.initPracticar;
window.initPracticar = function() {
  if (typeof _initPracticarOrig === 'function') _initPracticarOrig();
  // Throttle generarSugerencia a 6h
  const key = 'sugerencia_practicar_' + (window.currentPerfil?.id || 'demo');
  const stored = localStorage.getItem(key);
  const ttlH = 6;
  if (!stored || (Date.now() - parseInt(stored)) / 3600000 >= ttlH) {
    localStorage.setItem(key, Date.now().toString());
    if (window.materias?.length) setTimeout(generarSugerencia, 500);
  }
};
