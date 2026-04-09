// ══ MOBILE SIDEBAR TOGGLE ══
function docToggleSidebar() {
  const sb = document.querySelector('#doc-portal .sidebar');
  const ov = document.getElementById('mob-overlay');
  if (!sb) return;
  sb.classList.toggle('mob-open');
  ov.classList.toggle('show', sb.classList.contains('mob-open'));
}
function dirToggleSidebar() {
  const sb = document.querySelector('#dir-portal .sidebar');
  const ov = document.getElementById('mob-overlay');
  if (!sb) return;
  sb.classList.toggle('mob-open');
  ov.classList.toggle('show', sb.classList.contains('mob-open'));
}
function adminToggleSidebar() {
  const sb = document.querySelector('#admin-portal > div > div:first-child');
  const ov = document.getElementById('mob-overlay');
  if (!sb) return;
  sb.classList.toggle('mob-open');
  ov.classList.toggle('show', sb.classList.contains('mob-open'));
}
function closeMobSidebar() {
  document.querySelectorAll('.sidebar').forEach(s => s.classList.remove('mob-open'));
  const ov = document.getElementById('mob-overlay');
  if (ov) ov.classList.remove('show');
}
// Alias usado en dNav, dirNav, adminNav
function closeSidebarOnMobile() { closeMobSidebar(); }

// ══════════════════════════════════════════
// PORTAL FAMILIA — DATA & LÓGICA
// ══════════════════════════════════════════

const PADRE_DATA = {
  alumna: { nombre: 'Alumno vinculado', grado: '4° A', escuela: 'Escuela vinculada', nivel: 4, xp: 1240, racha: 12, promedio: 8.3, asistencia: 94 },
  padre:  { nombre: 'Familia vinculada', relacion: 'Responsable' },
  materias: [
    { nombre:'Matemáticas', ico:'🔢', cal:7.5, trim:[7.0,7.5,8.0], campo:'Lógica', color:'#3b82f6' },
    { nombre:'Español',     ico:'📖', cal:9.0, trim:[8.5,9.0,9.5], campo:'Lenguaje', color:'#22c55e' },
    { nombre:'Ciencias',    ico:'🔬', cal:8.5, trim:[8.0,8.5,9.0], campo:'Naturaleza', color:'#a855f7' },
    { nombre:'Historia',    ico:'📜', cal:8.0, trim:[7.5,8.0,8.5], campo:'Sociedad', color:'#f59e0b' },
    { nombre:'Geografía',   ico:'🌍', cal:9.5, trim:[9.0,9.5,10],  campo:'Sociedad', color:'#06b6d4' },
    { nombre:'Ed. Física',  ico:'⚽', cal:10,  trim:[10,10,10],     campo:'Salud',    color:'#ef4444' },
    { nombre:'Artes',       ico:'🎨', cal:8.5, trim:[8.0,8.5,9.0], campo:'Arte',     color:'#ec4899' },
    { nombre:'F. Cívica',   ico:'🏛️', cal:9.0, trim:[8.5,9.0,9.5], campo:'Ética',   color:'#8b5cf6' },
  ],
  tareas: [
    { nombre:'Ejercicios fracciones', materia:'Matemáticas', entrega:'Hoy', estado:'pendiente', color:'#ef4444' },
    { nombre:'Redacción: Mi familia', materia:'Español', entrega:'Mañana', estado:'en_proceso', color:'#f59e0b' },
    { nombre:'Mapa de México', materia:'Geografía', entrega:'Vie 13 Mar', estado:'entregada', color:'#22c55e' },
    { nombre:'Línea del tiempo', materia:'Historia', entrega:'Lun 16 Mar', estado:'pendiente', color:'#ef4444' },
    { nombre:'Experimento mezclas', materia:'Ciencias', entrega:'Mié 18 Mar', estado:'pendiente', color:'#ef4444' },
  ],
  mensajes: [
    { de:'Docente titular', rol:'Grupo 4°A', preview:'Se registró participación destacada en Historia...', fecha:'Hoy 14:22', nueva:true, emoji:'👩‍🏫' },
    { de:'SIEMBRA — Aviso', rol:'Automático', preview:'Recordatorio: Examen de Matemáticas el jueves...', fecha:'Ayer', nueva:true, emoji:'🔔' },
    { de:'Dirección escolar', rol:'Administración', preview:'Se comparte un aviso general para las familias...', fecha:'Mar 8', nueva:false, emoji:'👔' },
  ],
  insignias: [
    { emoji:'🌋', nombre:'Guardián del Popocatépetl', rareza:'epica', bg:'#4c1280', col:'#e9d5ff' },
    { emoji:'🌿', nombre:'Primera Semilla', rareza:'comun', bg:'#14532d', col:'#bbf7d0' },
    { emoji:'🔥', nombre:'Racha 7 días', rareza:'rara', bg:'#7c2d12', col:'#fed7aa' },
    { emoji:'⭐', nombre:'10 en Ed. Física', rareza:'comun', bg:'#713f12', col:'#fef3c7' },
    { emoji:'📖', nombre:'Lector Veloz', rareza:'rara', bg:'#1e3a5f', col:'#bfdbfe' },
  ],
  asistencia: [
    true,true,true,true,true,null,null,
    true,false,true,true,true,null,null,
    true,true,true,true,true,null,null,
    true,true,true,false,true,null,null,
  ],
  chatMsgs: [
    { yo:false, texto:'Buenos días, quería comentarles que Ana estuvo muy participativa esta semana en Historia. Se nota que estudia en casa 📚', hora:'Lun 9:15' },
    { yo:true,  texto:'Muchas gracias Maestra. ¿Hay algo en lo que debamos enfocarnos más?', hora:'Lun 10:03' },
    { yo:false, texto:'Sí, les recomiendo reforzar Matemáticas, especialmente fracciones. Tiene examen el jueves. ¡Ánimo! 💪', hora:'Lun 10:18' },
  ],
}; // Demo — se sobreescribe con datos reales de Supabase en pInit()

let padreNavActual = 'dashboard';
let padreChatHistorial = [...PADRE_DATA.chatMsgs];

function padreInit() {
  padreNav('dashboard');
  // Cargar plan guardado si existe
  padrePlanCargarGuardado();
  // ── Realtime: padre ve calificaciones al instante ──
  window.addEventListener('siembra:cal_update', (e) => {
    const alumnosIds = (window._alumnosPadre || []).map(a => a.id);
    const payload = e.detail;
    if (payload?.new?.alumno_id && alumnosIds.includes(payload.new.alumno_id)) {
      hubToast('📊 Nueva calificación registrada', 'ok');
      if (padreNavActual === 'calificaciones') padreCals();
    }
  });
  window.addEventListener('siembra:as_update', (e) => {
    if (padreNavActual === 'asistencia') padreAsist();
  });
}

function padreNav(page) {
  padreNavActual = page;
  document.querySelectorAll('#padre-portal .p-nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#padre-portal .p-page').forEach(p => p.classList.remove('active'));
  const btn = document.getElementById('p-nav-' + page);
  const pg  = document.getElementById('p-page-' + page);
  if (btn) btn.classList.add('active');
  if (pg)  pg.classList.add('active');
  const titles = { dashboard:'Inicio', calificaciones:'Calificaciones', recuperaciones:'Recuperaciones', asistencia:'Asistencia', boleta:'Boleta NEM', tareas:'Agenda y Tareas', mensajes:'Mensajes', insignias:'Insignias y Ejes NEM', ia:'Reporte IA', progreso:'Mi Progreso', ranking:'Ranking', evidencias:'Evidencias', recompensas:'Mis Puntos', mapa:'Tiendas Afiliadas' };
  const topTitle = document.getElementById('p-topbar-title');
  if (topTitle) topTitle.textContent = titles[page] || 'Portal Familia';
  // Sincronizar bottom nav mobile
  document.querySelectorAll('#p-bottom-nav .p-bnav-btn').forEach(b => b.classList.remove('active'));
  const pbn = document.getElementById('pbn-' + page);
  if (pbn) pbn.classList.add('active');
  // Render
  const renders = { dashboard: padreDash, calificaciones: padreCals, recuperaciones: padreRecuperaciones, asistencia: padreAsist, boleta: padreBoleta, tareas: padreTareas, mensajes: padreMensajes, insignias: padreInsignias, ia: padreIA };
  if (renders[page]) renders[page]();
  // Al entrar a IA: cargar plan guardado + resetear chat
  if (page === 'ia') {
    padrePlanCargarGuardado();
    // Resetear contexto de chat para el hijo activo
    window._padreChatContexto = null;
    window._padreChatHistorial = [];
    const chatCont = document.getElementById('p-chat-mensajes');
    if (chatCont) chatCont.innerHTML = '';
    const chips = document.getElementById('p-chat-chips');
    if (chips) chips.style.display = 'flex';
  }
  // Actualizar contador insignias dinámicamente
  if (page === 'insignias') {
    const total = PADRE_DATA.insignias.length;
    const maximo = 40;
    const sub = document.getElementById('p-ins-cnt-sub');
    const bar = document.getElementById('p-ins-progbar');
    if (sub) sub.textContent = `${total} de ${maximo} insignias desbloqueadas`;
    if (bar) bar.style.width = Math.round(total/maximo*100) + '%';
  }
}

function padreDash() {
  const d = PADRE_DATA;
  // Hero greeting
  const hr = new Date().getHours();
  const sal = hr < 12 ? 'Buenos días ☀️' : hr < 19 ? 'Buenas tardes 🌤️' : 'Buenas noches 🌙';
  const ge = id => document.getElementById(id);
  if (ge('p-hero-saludo')) ge('p-hero-saludo').textContent = sal;
  const a = window._alumnoActivo || d.alumna;
  if (a) {
    if (ge('p-hero-alumno')) ge('p-hero-alumno').textContent = a.nombre || d.alumna.nombre || '—';
    if (ge('p-hero-escuela')) ge('p-hero-escuela').textContent = (a.grado || d.alumna.grado || '') + (a.escuela ? ' · ' + a.escuela : d.alumna.escuela ? ' · ' + d.alumna.escuela : '');
    if (ge('p-alumno-nombre-sb')) ge('p-alumno-nombre-sb').textContent = a.nombre || d.alumna.nombre || '—';
    if (ge('p-alumno-grado-sb')) ge('p-alumno-grado-sb').textContent = a.grado || d.alumna.grado || '—';
    const prom = a.promedio || d.alumna.promedio;
    const asist = a.asistencia || d.alumna.asistencia;
    const racha = a.racha || d.alumna.racha || 0;
    if (ge('p-hero-chip-prom')) ge('p-hero-chip-prom').textContent = '📚 Promedio ' + prom;
    if (ge('p-hero-chip-asist')) ge('p-hero-chip-asist').textContent = '📅 Asistencia ' + asist + '%';
    if (ge('p-hero-chip-racha')) ge('p-hero-chip-racha').textContent = '🔥 Racha ' + racha + ' días';
    if (ge('p-racha-sb')) ge('p-racha-sb').textContent = '🔥 ' + racha;
  }
  // Stats
  document.getElementById('p-stat-prom').textContent = d.alumna.promedio;
  document.getElementById('p-stat-asist').textContent = d.alumna.asistencia + '%';
  document.getElementById('p-stat-racha').textContent = d.alumna.racha + '🔥';
  document.getElementById('p-stat-xp').textContent = d.alumna.xp.toLocaleString();
  // Materias resumen (top 3 + peor)
  const sorted = [...d.materias].sort((a,b) => a.cal - b.cal);
  const peor = sorted[0];
  const mejores = sorted.slice(-3).reverse();
  const resumen = document.getElementById('p-dash-materias');
  if (resumen) resumen.innerHTML = [...mejores, peor].map(m => padreMateriaRow(m)).join('');
  // Tareas pendientes
  const pend = d.tareas.filter(t => t.estado !== 'entregada');
  const tareasCont = document.getElementById('p-dash-tareas');
  if (tareasCont) tareasCont.innerHTML = pend.slice(0,3).map(t => padreTareaItem(t)).join('');
  // Insignia reciente
  const insEl = document.getElementById('p-dash-ins');
  const ins = d.insignias[0];
  if (insEl && ins) insEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;">
      <div style="width:52px;height:52px;border-radius:14px;background:${ins.bg};display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">${ins.emoji}</div>
      <div>
        <div style="font-size:13px;font-weight:800;color:var(--texto);">¡Nueva insignia desbloqueada!</div>
        <div style="font-size:14px;font-weight:900;color:#7c3aed;margin-top:2px;">${ins.nombre}</div>
        <div style="font-size:11px;color:var(--texto-2);margin-top:2px;">Obtenida el 8 Mar 2026 · Rareza ${ins.rareza}</div>
      </div>
    </div>
  `;
}

function padreMateriaRow(m) {
  const pct = (m.cal / 10) * 100;
  const col = m.cal >= 9 ? '#22c55e' : m.cal >= 8 ? '#3b82f6' : m.cal >= 7 ? '#f59e0b' : '#ef4444';
  return `<div class="p-mat-row">
    <div class="p-mat-ico">${m.ico}</div>
    <div class="p-mat-info">
      <div class="p-mat-nombre">${m.nombre}</div>
      <div class="p-mat-sub">${m.campo}</div>
    </div>
    <div class="p-mat-bar"><div class="p-mat-fill" style="width:${pct}%;background:${col};"></div></div>
    <div class="p-mat-cal" style="color:${col};">${m.cal}</div>
  </div>`;
}

function padreTareaItem(t) {
  const estados = { pendiente:['#fee2e2','#ef4444','Pendiente'], en_proceso:['#fef3c7','#f59e0b','En proceso'], entregada:['#dcfce7','#16a34a','Entregada'] };
  const [bg, col, lbl] = estados[t.estado] || estados.pendiente;
  return `<div class="p-tarea-item">
    <div class="p-tarea-dot" style="background:${t.color};"></div>
    <div style="flex:1;">
      <div class="p-tarea-nombre">${t.nombre}</div>
      <div class="p-tarea-meta">${t.materia} · ${t.entrega}</div>
    </div>
    <span class="p-tarea-estado" style="background:${bg};color:${col};">${lbl}</span>
  </div>`;
}

function padreCals() {
  const cont = document.getElementById('p-cals-lista');
  if (!cont) return;
  cont.innerHTML = PADRE_DATA.materias.map(m => padreMateriaRow(m)).join('');
  // Trimestral chart placeholder
  const bimEl = document.getElementById('p-trim-chart');
  if (bimEl) {
    bimEl.innerHTML = PADRE_DATA.materias.map(m => {
      const pct = (m.cal / 10) * 100;
      const col = m.cal >= 9 ? '#22c55e' : m.cal >= 8 ? '#3b82f6' : m.cal >= 7 ? '#f59e0b' : '#ef4444';
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:80px;font-size:12px;color:var(--texto-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.ico} ${m.nombre}</div>
        <div style="flex:1;height:8px;background:#f0f0f0;border-radius:99px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${col};border-radius:99px;transition:.5s;"></div>
        </div>
        <div style="width:30px;font-size:12px;font-weight:800;color:${col};text-align:right;">${m.cal}</div>
      </div>`;
    }).join('');
  }
}

async function padreRecuperaciones() {
  const cont = document.getElementById('p-recup-lista');
  if (!cont) return;
  // Obtener alumno activo
  const alumno = window._alumnoActivoPadre || window._alumnosPadre?.[0];
  if (!alumno) { cont.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8;">Sin alumno vinculado</div>'; return; }
  cont.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;">⏳ Cargando…</div>';
  try {
    const { data } = await sb.from('recuperaciones')
      .select('*')
      .eq('alumno_id', alumno.id)
      .order('fecha_examen', { ascending: true });
    const lista = data || [];
    if (!lista.length) {
      cont.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8;"><div style="font-size:32px;margin-bottom:8px;">✅</div><div style="font-weight:700;color:#0f172a;">Sin recuperaciones pendientes</div><div style="font-size:12px;margin-top:4px;">¡Todo en orden!</div></div>';
      return;
    }
    cont.innerHTML = lista.map(r => {
      const hoy = new Date().toISOString().split('T')[0];
      const vencido = r.estado === 'pendiente' && r.fecha_examen && r.fecha_examen < hoy;
      const estadoColor = r.estado === 'presentado' ? '#15803d' : r.estado === 'cancelado' ? '#94a3b8' : vencido ? '#dc2626' : '#d97706';
      const estadoLabel = r.estado === 'presentado' ? '✅ Presentado' : r.estado === 'cancelado' ? '🚫 Cancelado' : vencido ? '⚠️ Vencido' : '⏳ Pendiente';
      const fechaFmt = r.fecha_examen ? new Date(r.fecha_examen+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'}) : 'Sin fecha';
      const calRecup = r.calificacion_recuperacion != null ? `<div style="font-size:28px;font-weight:900;color:${r.calificacion_recuperacion>=6?'#15803d':'#dc2626'};">${r.calificacion_recuperacion}</div><div style="font-size:11px;color:${r.calificacion_recuperacion>=6?'#15803d':'#dc2626'};">${r.calificacion_recuperacion>=6?'¡Aprobado!':'Reprobado'}</div>` :
        `<div style="font-size:22px;font-weight:900;color:#d97706;">${r.calificacion_original ?? '—'}</div><div style="font-size:11px;color:#d97706;">Cal. original</div>`;
      return `<div style="background:white;border-radius:14px;border:1.5px solid #e2e8f0;padding:16px;margin-bottom:12px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px;">
          <div>
            <div style="font-size:15px;font-weight:700;color:#0d5c2f;">${r.materia}</div>
            ${r.estado==='pendiente' ? `<div style="font-size:12px;color:#d97706;font-weight:700;margin-top:2px;">📅 ${fechaFmt}</div>` : `<div style="font-size:12px;color:#94a3b8;margin-top:2px;">${fechaFmt}</div>`}
          </div>
          <div style="text-align:center;flex-shrink:0;">${calRecup}</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <span style="padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:${estadoColor}20;color:${estadoColor};">${estadoLabel}</span>
        </div>
        ${r.comentarios_docente ? `<div style="margin-top:10px;font-size:12px;background:#f0fdf4;border-radius:8px;padding:8px 10px;border-left:3px solid #0d5c2f;color:#14532d;">📝 <strong>Docente:</strong> ${r.comentarios_docente}</div>` : ''}
        ${r.temas_ia && r.estado==='pendiente' ? `<details style="margin-top:10px;"><summary style="cursor:pointer;font-size:12px;font-weight:700;color:#7c3aed;">✨ Ver guía de estudio</summary><div style="margin-top:8px;padding:10px;background:#faf5ff;border-radius:8px;font-size:12px;color:#4c1d95;line-height:1.7;white-space:pre-wrap;">${r.temas_ia}</div></details>` : ''}
      </div>`;
    }).join('');
  } catch(e) {
    cont.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;">Error al cargar recuperaciones</div>';
    console.warn('[padreRecuperaciones]', e.message);
  }
}

function padreAsist() {
  const cont = document.getElementById('p-asist-dias');
  if (!cont) return;
  const dias = ['L','M','X','J','V','S','D'];
  cont.innerHTML = '';
  PADRE_DATA.asistencia.forEach((v, i) => {
    const dia = document.createElement('div');
    dia.className = 'p-asist-dia';
    const diaNom = dias[i % 7];
    if (v === null) {
      dia.style.cssText = 'background:#f8fafc;color:#cbd5e1;';
      dia.textContent = diaNom;
    } else if (v === true) {
      dia.style.cssText = 'background:#dcfce7;color:#15803d;font-size:14px;';
      dia.textContent = '✓';
    } else {
      dia.style.cssText = 'background:#fee2e2;color:#ef4444;font-size:14px;';
      dia.textContent = '✗';
    }
    cont.appendChild(dia);
  });
}

function padreTareas() {
  const cont = document.getElementById('p-tareas-lista');
  if (cont) cont.innerHTML = PADRE_DATA.tareas.map(t => padreTareaItem(t)).join('');
}

function padreMensajes() {
  const cont = document.getElementById('p-msgs-lista');
  if (!cont) return;
  cont.innerHTML = PADRE_DATA.mensajes.map(m => `
    <div class="p-msg-item">
      <div class="p-msg-avatar">${m.emoji}</div>
      <div class="p-msg-body">
        <div class="p-msg-de">${m.de} <span style="font-size:11px;font-weight:400;color:var(--texto-2);">· ${m.rol}</span></div>
        <div class="p-msg-preview">${m.preview}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <div class="p-msg-fecha">${m.fecha}</div>
        ${m.nueva ? '<div class="p-msg-new"></div>' : ''}
      </div>
    </div>
  `).join('');
  // Render chat
  padreChatRender();
}

function padreChatRender() {
  const cont = document.getElementById('p-chat-msgs');
  if (!cont) return;
  cont.innerHTML = padreChatHistorial.map(m => `
    <div class="p-chat-msg ${m.yo ? 'yo' : 'ellos'}">
      ${m.texto}
      <div class="p-chat-msg-time">${m.hora}</div>
    </div>
  `).join('');
  cont.scrollTop = cont.scrollHeight;
}

function padreCambiarTrim(t) {
  // Render tabs si no existen aún
  const _cont = document.getElementById('p-trim-tabs-cont');
  if (_cont && !_cont.children.length) {
    const _cfg2 = _calCfg();
    for (let i = 1; i <= _cfg2.num_periodos; i++) {
      const _b = document.createElement('button');
      _b.id = 'p-tbtn-' + i;
      _b.textContent = _cfg2.nombre_periodo[0] + i; // e.g. "T1", "B1", "S1"
      _b.onclick = function() { padreCambiarTrim(i); };
      _b.style.cssText = 'padding:6px 14px;border-radius:20px;border:1.5px solid var(--borde);background:var(--bg);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;color:var(--texto-2);';
      _cont.appendChild(_b);
    }
  }
  window._padreTriActual = t;
  // Actualizar estilos de botones
  const _pn = _calCfg().num_periodos;
  Array.from({length: _pn}, (_,i) => i+1).forEach(i => {
    const btn = document.getElementById('p-tbtn-' + i);
    if (!btn) return;
    if (i === t) {
      btn.style.background = '#0d5c2f'; btn.style.color = 'white';
      btn.style.borderColor = '#0d5c2f';
    } else {
      btn.style.background = 'white'; btn.style.color = '#64748b';
      btn.style.borderColor = '#e2e8f0';
    }
  });
  // Re-renderizar con datos reales si existen, si no con demo
  if (window._promediosPadre) {
    pRenderCalificaciones(window._promediosPadre);
  } else {
    padreCals();
  }
}


function padreChatEnviar() {
  const input = document.getElementById('p-chat-input');
  if (!input || !input.value.trim()) return;
  const msg = input.value.trim();
  input.value = '';
  padreChatHistorial.push({ yo:true, texto:msg, hora:'Ahora' });
  padreChatRender();
  // Simular respuesta
  setTimeout(() => {
    padreChatHistorial.push({ yo:false, texto:'Gracias por su mensaje. Le responderé a la brevedad 🙏', hora:'Ahora' });
    padreChatRender();
  }, 1200);
}

// ── Ejes articuladores NEM 2026 ──────────────────────────────────────
const EJES_NEM_PADRE = [
  { id:'pensamiento_critico', nombre:'Pensamiento crítico', icono:'🧠',
    color:'#4f46e5', colorL:'#eef2ff',
    materias:['Matemáticas','Ciencias Naturales','Lengua Materna'],
    descripcion:'Analiza, argumenta y resuelve problemas con evidencias.' },
  { id:'interculturalidad', nombre:'Interculturalidad', icono:'🌍',
    color:'#0891b2', colorL:'#ecfeff',
    materias:['Historia','Geografía','Formación Cívica'],
    descripcion:'Valora la diversidad cultural y el diálogo entre saberes.' },
  { id:'igualdad_genero', nombre:'Igualdad de género', icono:'⚖️',
    color:'#db2777', colorL:'#fdf2f8',
    materias:['Formación Cívica','Historia'],
    descripcion:'Promueve relaciones igualitarias y no discriminatorias.' },
  { id:'vida_saludable', nombre:'Vida saludable', icono:'💚',
    color:'#16a34a', colorL:'#f0fdf4',
    materias:['Ed. Física','Ciencias Naturales'],
    descripcion:'Cuida el bienestar físico, emocional y social.' },
  { id:'sostenibilidad', nombre:'Sostenibilidad', icono:'♻️',
    color:'#059669', colorL:'#ecfdf5',
    materias:['Ciencias Naturales','Geografía'],
    descripcion:'Cuida el medio ambiente para las generaciones futuras.' },
  { id:'inclusion', nombre:'Inclusión', icono:'🤝',
    color:'#7c3aed', colorL:'#f5f3ff',
    materias:['Formación Cívica','Historia','Ed. Física'],
    descripcion:'Garantiza la participación de todos sin exclusión.' },
  { id:'lectura_escritura', nombre:'Lectura y escritura', icono:'📖',
    color:'#b45309', colorL:'#fffbeb',
    materias:['Lengua Materna','Historia','Geografía'],
    descripcion:'Desarrolla la comprensión lectora y expresión escrita.' },
];

// Calcula el nivel del eje según las calificaciones de sus materias asociadas
function ejePuntaje(eje, promedios) {
  const cals = eje.materias
    .map(m => {
      // Busca en promediosPadre (reales) o en PADRE_DATA.materias (demo)
      const real = promedios?.[m]?.[window._padreTriActual||1];
      if (real != null) return real;
      const demo = PADRE_DATA.materias.find(x => x.nombre === m || x.nombre.includes(m.split(' ')[0]));
      return demo?.cal ?? null;
    })
    .filter(c => c !== null);
  if (!cals.length) return null;
  return Math.round(cals.reduce((s,c)=>s+c,0)/cals.length * 10) / 10;
}

// ── BOLETA NEM (portal padre) ──
let _padreBolTrim = 2; // trimestre activo

function padreBoltarTrim(t) {
  _padreBolTrim = t;
  [1,2,3].forEach(n => {
    const b = document.getElementById('pb-t'+n);
    if (b) { b.className = n===t ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'; }
  });
  padreBoleta();
}

async function padreBoleta() {
  const cont = document.getElementById('p-boleta-contenido');
  if (!cont) return;

  // Determinar alumno activo
  const selEl   = document.getElementById('p-boleta-alumno-sel');
  const alumno  = window._alumnoActivoPadre || window._alumnosPadre?.[0];
  const alumnoId = selEl?.value || alumno?.id;

  if (!alumnoId) {
    cont.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Sin alumno vinculado</div>';
    return;
  }

  cont.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8;">⏳ Cargando…</div>';

  // Si hay múltiples hijos, mostrar selector
  const hijos = window._alumnosPadre || [];
  const selRow = document.getElementById('p-boleta-selector');
  if (selEl && hijos.length > 1) {
    if (selRow) selRow.style.display = '';
    if (!selEl.options.length || selEl.dataset.loaded !== '1') {
      selEl.innerHTML = hijos.map(h =>
        `<option value="${h.id}">${h.nombre} ${h.apellido_p||''}</option>`
      ).join('');
      selEl.dataset.loaded = '1';
    }
  }

  const ciclo = window.CICLO_ACTIVO || '2025-2026';
  const trim  = _padreBolTrim;

  try {
    if (!window.sb) throw new Error('sin sb');

    // Datos del alumno
    const { data: alu } = await sb.from('usuarios')
      .select('id,nombre,apellido_p,apellido_m,curp,grado,escuela_cct,escuela_nombre')
      .eq('id', alumnoId).maybeSingle();

    // Calificaciones del trimestre seleccionado
    const { data: cals } = await sb.from('calificaciones')
      .select('materia,trimestre,calificacion,campo_formativo')
      .eq('alumno_id', alumnoId)
      .eq('ciclo', ciclo)
      .eq('trimestre', trim);

    // Boleta guardada (observaciones generales)
    const { data: boleta } = await sb.from('boletas_nem')
      .select('obs_general,asistencias,inasist_j,inasist_i,folio,lenguajes_nivel,saberes_nivel,humanidades_nivel,etica_nivel,de_lo_humano_nivel')
      .eq('alumno_id', alumnoId).eq('ciclo', ciclo)
      .eq('periodo', `T${trim}`).maybeSingle();

    const nombre = alu ? `${alu.nombre} ${alu.apellido_p||''} ${alu.apellido_m||''}`.trim() : '—';
    const curp   = alu?.curp || '—';
    const grado  = alu?.grado || '—';
    const cct    = alu?.escuela_cct || window.currentPerfil?.escuela_cct || '—';
    const escuela= alu?.escuela_nombre || '—';
    const folio  = boleta?.folio || `${cct}-${ciclo.replace(/\D/g,'').slice(0,4)}-${trim}`;

    // Agrupar calificaciones por campo formativo
    const campos = {
      'Lenguajes': [], 'Saberes y Pensamiento Científico': [],
      'Humanidades': [], 'Ética, Naturaleza y Sociedades': [],
      'De lo Humano y lo Comunitario': []
    };
    (cals || []).forEach(c => {
      const campo = c.campo_formativo || 'Lenguajes';
      if (!campos[campo]) campos[campo] = [];
      campos[campo].push({ materia: c.materia, cal: parseFloat(c.calificacion) });
    });

    const nivelColor = n => n >= 9 ? '#16a34a' : n >= 7 ? '#2563eb' : n >= 6 ? '#d97706' : '#dc2626';
    const filasHtml = Object.entries(campos).map(([campo, mats]) => {
      if (!mats.length) return '';
      return mats.map((m, i) => `
        <tr>
          ${i === 0 ? `<td rowspan="${mats.length}" style="background:#f0fdf4;font-weight:700;font-size:11px;color:#166534;padding:6px 8px;border:1px solid #e2e8f0;vertical-align:middle;">${campo}</td>` : ''}
          <td style="padding:6px 10px;border:1px solid #e2e8f0;font-size:13px;">${m.materia}</td>
          <td style="text-align:center;padding:6px;border:1px solid #e2e8f0;font-weight:800;font-size:14px;color:${nivelColor(m.cal)};">${isNaN(m.cal)?'—':m.cal.toFixed(1)}</td>
        </tr>`).join('');
    }).join('');

    const obsHtml = boleta?.obs_general
      ? `<div style="margin-top:12px;padding:12px;background:#fffbeb;border-radius:8px;border-left:3px solid #f59e0b;font-size:13px;color:#92400e;">
           <strong>Observaciones:</strong> ${boleta.obs_general}
         </div>` : '';

    cont.innerHTML = `
      <div style="border:2px solid #0d5c2f;border-radius:10px;overflow:hidden;max-width:720px;margin:0 auto;">
        <!-- Encabezado -->
        <div style="background:#0d5c2f;color:white;padding:14px 18px;display:flex;align-items:center;gap:12px;">
          <div style="flex:1;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:.8;">Secretaría de Educación Pública · NEM Plan 2022</div>
            <div style="font-size:16px;font-weight:800;margin-top:2px;">Boleta de Evaluación Trimestral</div>
            <div style="font-size:11px;opacity:.8;margin-top:2px;">${escuela} · CCT: ${cct} · Ciclo ${ciclo}</div>
          </div>
          <div style="text-align:center;background:rgba(255,255,255,.15);padding:8px 14px;border-radius:8px;">
            <div style="font-size:10px;opacity:.8;">Trimestre</div>
            <div style="font-size:28px;font-weight:900;">${trim}°</div>
          </div>
        </div>
        <!-- Datos alumno -->
        <div style="padding:12px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;font-size:12px;">
          <div><span style="color:#64748b;">Alumno(a):</span> <strong>${nombre}</strong></div>
          <div><span style="color:#64748b;">CURP:</span> <strong style="font-family:monospace;">${curp}</strong></div>
          <div><span style="color:#64748b;">Grado/Grupo:</span> <strong>${grado}</strong></div>
          <div><span style="color:#64748b;">Folio:</span> <strong style="font-family:monospace;font-size:11px;">${folio}</strong></div>
        </div>
        <!-- Tabla calificaciones -->
        <div style="padding:14px 18px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#e2e8f0;">
                <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;font-size:11px;color:#475569;">Campo Formativo</th>
                <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;font-size:11px;color:#475569;">Materia / Asignatura</th>
                <th style="padding:8px;border:1px solid #e2e8f0;text-align:center;font-size:11px;color:#475569;">Cal.</th>
              </tr>
            </thead>
            <tbody>${filasHtml || '<tr><td colspan="3" style="text-align:center;padding:20px;color:#94a3b8;">Sin calificaciones registradas para este trimestre</td></tr>'}</tbody>
          </table>
          ${boleta ? `<div style="margin-top:10px;display:flex;gap:16px;font-size:12px;color:#64748b;">
            <span>Asistencias: <strong>${boleta.asistencias||0}</strong></span>
            <span>Inasist. justif.: <strong>${boleta.inasist_j||0}</strong></span>
            <span>Inasist. injust.: <strong>${boleta.inasist_i||0}</strong></span>
          </div>` : ''}
          ${obsHtml}
        </div>
      </div>`;
  } catch(e) {
    console.warn('[padreBoleta]', e.message);
    cont.innerHTML = '<div style="text-align:center;padding:32px;color:#ef4444;">Error al cargar la boleta. Inténtalo de nuevo.</div>';
  }
}

function padreInsignias() {
  const promedios = window._promediosPadre || null;

  // ── Grid de insignias ──
  const cont = document.getElementById('p-ins-grid');
  if (cont) {
    cont.innerHTML = PADRE_DATA.insignias.map(ins => `
      <div class="p-ins-item" style="background:${ins.bg}20;border:1.5px solid ${ins.bg}40;border-radius:12px;padding:12px;text-align:center;">
        <div style="font-size:28px;margin-bottom:6px;">${ins.emoji}</div>
        <div style="font-size:11px;font-weight:700;color:var(--texto);line-height:1.3;">${ins.nombre}</div>
        <div style="font-size:10px;color:var(--texto-2);margin-top:3px;text-transform:uppercase;letter-spacing:.5px;">${ins.rareza||'común'}</div>
      </div>
    `).join('');
  }

  // ── Ejes articuladores NEM ──
  const ejeCont = document.getElementById('p-ejes-nem-lista');
  if (!ejeCont) return;

  ejeCont.innerHTML = EJES_NEM_PADRE.map(eje => {
    const prom = ejePuntaje(eje, promedios);
    const pct  = prom !== null ? Math.round(Math.max(0,(prom-5)/5*100)) : 0;
    const niv  = prom === null ? null : prom>=9?'A':prom>=8?'B':prom>=7?'C':prom>=6?'D':'E';
    const nivLabel = { A:'Sobresaliente', B:'Satisfactorio', C:'Suficiente', D:'Básico', E:'Insuficiente' };
    const barColor = prom === null ? '#e5e7eb' : prom>=8 ? '#16a34a' : prom>=7 ? '#3b82f6' : prom>=6 ? '#f59e0b' : '#ef4444';

    return `<div style="background:white;border-radius:12px;border:1.5px solid ${eje.colorL};padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:36px;height:36px;border-radius:10px;background:${eje.colorL};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${eje.icono}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;color:var(--texto);">${eje.nombre}</div>
          <div style="font-size:11px;color:var(--texto-2);margin-top:1px;">${eje.descripcion}</div>
        </div>
        ${prom !== null ? `<div style="text-align:right;flex-shrink:0;">
          <div style="font-size:18px;font-weight:900;color:${barColor};">${prom.toFixed(1)}</div>
          <div style="font-size:10px;font-weight:700;color:${barColor};">${niv} · ${nivLabel[niv]}</div>
        </div>` : `<div style="font-size:11px;color:var(--texto-2);">Sin datos</div>`}
      </div>
      <div style="height:5px;background:#f0f0f0;border-radius:99px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${barColor};border-radius:99px;transition:.5s;"></div>
      </div>
      <div style="font-size:10px;color:var(--texto-2);margin-top:5px;">Materias: ${eje.materias.join(' · ')}</div>
    </div>`;
  }).join('');

  // Insignia sugerida según el eje más fuerte
  const mejorEje = EJES_NEM_PADRE
    .map(e => ({ eje: e, prom: ejePuntaje(e, promedios) }))
    .filter(x => x.prom !== null)
    .sort((a,b) => b.prom - a.prom)[0];
  const sugerenciaEl = document.getElementById('p-ins-sugerencia');
  if (sugerenciaEl && mejorEje) {
    sugerenciaEl.innerHTML = `<div style="padding:12px 14px;background:${mejorEje.eje.colorL};border-radius:10px;border-left:3px solid ${mejorEje.eje.color};">
      <div style="font-size:12px;font-weight:700;color:${mejorEje.eje.color};">${mejorEje.eje.icono} Próxima insignia a desbloquear</div>
      <div style="font-size:13px;font-weight:800;color:var(--texto);margin-top:3px;">Eje: ${mejorEje.eje.nombre}</div>
      <div style="font-size:11px;color:var(--texto-2);margin-top:2px;">Promedio actual ${mejorEje.prom.toFixed(1)} — llega a 9.0 para desbloquear la insignia "${mejorEje.eje.nombre}"</div>
    </div>`;
  }
}

// ── Plan semanal IA — render en portal padre ──────────────────────────
async function padreGenerarPlanSemanal() {
  const content = document.getElementById('p-plan-semanal-content');
  const btn     = document.getElementById('p-plan-btn');
  if (!content) return;

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando…'; }
  content.innerHTML = `<div style="text-align:center;padding:20px;color:var(--texto-2);font-size:13px;">
    ✨ Creando tu plan personalizado…
  </div>`;

  // Recopilar datos del alumno
  const alumno  = (window._alumnosPadre||[])[0];
  const promedios = window._promediosPadre || null;
  const nombre  = alumno ? `${alumno.nombre} ${alumno.apellido_p||''}`.trim() : PADRE_DATA.alumna.nombre;

  const calificaciones = MATERIAS_NEM.map((m,i) => ({
    materia: m,
    cal: promedios?.[m]?.[window._padreTriActual||1] ?? PADRE_DATA.materias[i]?.cal ?? null
  }));

  // Obtener observaciones del docente si hay conexión
  let observaciones = '';
  let evidenciasPend = 0;
  if (sb && alumno?.id) {
    try {
      const { data: obs } = await sb.from('observaciones')
        .select('texto').eq('alumno_id', alumno.id)
        .order('created_at', { ascending:false }).limit(2);
      if (obs?.length) observaciones = obs.map(o=>o.texto).join(' | ');
      const { count } = await sb.from('evidencias')
        .select('id',{count:'exact',head:true})
        .eq('alumno_id',alumno.id).eq('estado','pendiente');
      evidenciasPend = count || 0;
    } catch(e) {}
  }

  const plan = await generarPlanSemanal(alumno?.id, nombre, calificaciones, observaciones, evidenciasPend);

  const coloresDia = { Lunes:'#dbeafe', Martes:'#dcfce7', 'Miércoles':'#fef9c3', Jueves:'#fce7f3', Viernes:'#ede9fe', 'Sábado':'#e0f2fe', Domingo:'#fff7ed' };
  const coloresTxt = { Lunes:'#1e40af', Martes:'#15803d', 'Miércoles':'#a16207', Jueves:'#9d174d', Viernes:'#5b21b6', 'Sábado':'#0e7490', Domingo:'#c2410c' };

  content.innerHTML = plan.map((accion, i) => {
    const bgDia  = coloresDia[accion.dia]  || '#f3f4f6';
    const colDia = coloresTxt[accion.dia]  || '#374151';
    return `<div style="display:flex;gap:12px;align-items:flex-start;padding:12px;background:white;border-radius:12px;border:1.5px solid #e5e7eb;margin-bottom:8px;">
      <div style="width:38px;height:38px;border-radius:10px;background:${bgDia};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${accion.icono}</div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px;background:${bgDia};color:${colDia};">${accion.dia}</span>
          <span style="font-size:10px;color:var(--texto-2);">${accion.materia}</span>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--texto);line-height:1.4;">${accion.accion}</div>
      </div>
      <div style="flex-shrink:0;text-align:right;">
        <div style="font-size:14px;font-weight:900;color:#7c3aed;">+${accion.xp}</div>
        <div style="font-size:9px;color:var(--texto-2);">XP</div>
      </div>
    </div>`;
  }).join('') + `<div style="margin-top:8px;font-size:11px;color:var(--texto-2);text-align:center;">
    Plan generado el ${new Date().toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'})}
  </div>`;

  if (btn) { btn.disabled = false; btn.textContent = '🔄 Actualizar plan'; }

  // Guardar en localStorage para no regenerar cada vez
  try { localStorage.setItem('siembra_plan_semanal', JSON.stringify({ plan, fecha: new Date().toISOString() })); } catch(e){}
}

// ── Cargar plan guardado si existe y es de esta semana ────────────────
function padrePlanCargarGuardado() {
  try {
    const saved = JSON.parse(localStorage.getItem('siembra_plan_semanal')||'null');
    if (!saved) return false;
    const fechaSaved = new Date(saved.fecha);
    const hoy = new Date();
    // Mismo número de semana = no regenerar
    const semSaved = Math.floor((fechaSaved - new Date(fechaSaved.getFullYear(),0,1)) / 604800000);
    const semHoy   = Math.floor((hoy - new Date(hoy.getFullYear(),0,1)) / 604800000);
    if (semSaved !== semHoy) return false;
    // Mostrar plan guardado
    const btn     = document.getElementById('p-plan-btn');
    const content = document.getElementById('p-plan-semanal-content');
    if (!content) return false;
    const coloresDia = { Lunes:'#dbeafe',Martes:'#dcfce7','Miércoles':'#fef9c3',Jueves:'#fce7f3',Viernes:'#ede9fe','Sábado':'#e0f2fe',Domingo:'#fff7ed' };
    const coloresTxt = { Lunes:'#1e40af',Martes:'#15803d','Miércoles':'#a16207',Jueves:'#9d174d',Viernes:'#5b21b6','Sábado':'#0e7490',Domingo:'#c2410c' };
    content.innerHTML = saved.plan.map(accion => {
      const bgDia  = coloresDia[accion.dia]||'#f3f4f6';
      const colDia = coloresTxt[accion.dia]||'#374151';
      return `<div style="display:flex;gap:12px;align-items:flex-start;padding:12px;background:white;border-radius:12px;border:1.5px solid #e5e7eb;margin-bottom:8px;">
        <div style="width:38px;height:38px;border-radius:10px;background:${bgDia};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${accion.icono}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
            <span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px;background:${bgDia};color:${colDia};">${accion.dia}</span>
            <span style="font-size:10px;color:var(--texto-2);">${accion.materia}</span>
          </div>
          <div style="font-size:13px;font-weight:600;color:var(--texto);line-height:1.4;">${accion.accion}</div>
        </div>
        <div style="flex-shrink:0;text-align:right;">
          <div style="font-size:14px;font-weight:900;color:#7c3aed;">+${accion.xp}</div>
          <div style="font-size:9px;color:var(--texto-2);">XP</div>
        </div>
      </div>`;
    }).join('') + `<div style="margin-top:8px;font-size:11px;color:var(--texto-2);text-align:center;">Plan de esta semana</div>`;
    if (btn) { btn.disabled=false; btn.textContent='🔄 Actualizar plan'; }
    return true;
  } catch(e) { return false; }
}

async function padreIA() {
  const el = document.getElementById('p-ia-texto');
  if (!el) return;
  // Allow refresh by removing loaded flag on explicit click
  el.dataset.loaded = '';
  el.textContent = '⚙️ Generando análisis personalizado…';
  const d = PADRE_DATA;

  // ── Intentar enriquecer con datos reales de Supabase ──
  let obsDocente = '';
  let fichaTexto = '';
  let evidenciasPend = 0;
  let calReales = null;
  const alumno = (window._alumnosPadre || [])[0];

  if (sb && alumno?.id) {
    try {
      // Observaciones del docente
      const { data: obs } = await sb.from('observaciones')
        .select('texto, created_at')
        .eq('alumno_id', alumno.id)
        .order('created_at', { ascending: false })
        .limit(3);
      if (obs?.length) obsDocente = obs.map(o => o.texto).join(' | ');

      // Ficha descriptiva
      const { data: ficha } = await sb.from('fichas_descriptivas')
        .select('fortalezas, areas_oportunidad, observacion_general')
        .eq('alumno_id', alumno.id).maybeSingle();
      if (ficha) fichaTexto = `Fortalezas: ${ficha.fortalezas||''}. Áreas de oportunidad: ${ficha.areas_oportunidad||''}. ${ficha.observacion_general||''}`;

      // Evidencias pendientes de validar
      const { count } = await sb.from('evidencias')
        .select('id', { count: 'exact', head: true })
        .eq('alumno_id', alumno.id).eq('estado', 'pendiente');
      evidenciasPend = count || 0;

      // Calificaciones reales del trimestre actual
      if (window._promediosPadre) {
        calReales = MATERIAS_NEM.map(m => {
          const c = window._promediosPadre[m]?.[window._padreTriActual||1];
          return c !== null && c !== undefined ? `${m}: ${c}` : null;
        }).filter(Boolean).join(', ');
      }
    } catch(e) { console.warn('[padreIA] enriquecimiento:', e.message); }
  }

  const materiasStr = calReales || d.materias.map(m => `${m.nombre}: ${m.cal}`).join(', ');
  const alumnoNombre = alumno ? `${alumno.nombre} ${alumno.apellido_p||''}`.trim() : d.alumna.nombre;

  const prompt = `Eres un asistente educativo de SIEMBRA para padres de familia en México (NEM 2026).
Genera un reporte cálido y concreto (4-5 oraciones) sobre el progreso de ${alumnoNombre}, ${d.alumna.grado}.

Calificaciones actuales: ${materiasStr}.
Asistencia: ${d.alumna.asistencia}%. Racha de actividad en SIEMBRA: ${d.alumna.racha} días. XP acumulado: ${d.alumna.xp}.
${obsDocente ? `Observaciones del docente: "${obsDocente}".` : ''}
${fichaTexto ? `Ficha pedagógica: ${fichaTexto}.` : ''}
${evidenciasPend > 0 ? `Tiene ${evidenciasPend} evidencias de aprendizaje pendientes de revisión por el docente.` : ''}

Estructura tu respuesta así:
1. Frase de apertura positiva sobre el desempeño general.
2. Fortaleza concreta con materia específica.
3. Área donde puede crecer con acción concreta desde casa (máximo 2 materias).
4. Cierre motivacional para la familia.
Dirígete en segunda persona al padre/tutor. Sin bullets, como párrafo continuo.`;

  try {
    el.textContent = await callAI({ feature: 'padre_reporte_ia', prompt, system: _nemSys('TAREA: Informe para padre de familia (no docente). Lenguaje cálido, comprensible, sin tecnicismos. Incluye: 1 fortaleza específica del alumno, 1 área de oportunidad con ACCIÓN CONCRETA que el padre puede hacer en casa esta semana, y 1 motivación. Conecta con la vida cotidiana mexicana.') });
    el.dataset.loaded = '1';
  } catch(e) {
    el.textContent = `${alumnoNombre} tiene un desempeño sólido este trimestre. Sus mayores fortalezas están en las materias con calificaciones más altas. Les recomendamos dedicar 15 minutos diarios a reforzar las materias con menor promedio usando los ejercicios de SIEMBRA. ¡Sigan acompañando este proceso — su apoyo hace una diferencia real!`;
    el.dataset.loaded = '1';
  }
}

// ── Chat libre IA para padres ──
window._padreChatHistorial = []; // { role:'user'|'assistant', text }

async function _padreGetContexto() {
  const alumno = window._alumnoActivoPadre || (window._alumnosPadre||[])[0];
  if (!sb || !alumno?.id) return 'No hay datos del alumno disponibles.';

  const lines = [`Alumno: ${alumno.nombre} ${alumno.apellido_p||''} — ${alumno.grado||''} ${alumno.grupo||''}`];

  try {
    // Calificaciones
    if (window._promediosPadre) {
      const tri = window._padreTriActual || 1;
      const cals = MATERIAS_NEM.map(m => {
        const v = window._promediosPadre[m]?.[tri];
        return v != null ? `${m}: ${v}` : null;
      }).filter(Boolean);
      if (cals.length) lines.push(`Calificaciones trimestre ${tri}: ${cals.join(', ')}.`);
    }

    // Asistencia reciente
    const { data: asis } = await sb.from('asistencia')
      .select('fecha, estado')
      .eq('alumno_id', alumno.id)
      .order('fecha', { ascending: false })
      .limit(15);
    if (asis?.length) {
      const faltas = asis.filter(a => a.estado === 'falta').length;
      const total  = asis.length;
      lines.push(`Asistencia últimas ${total} clases registradas: ${total - faltas} presencias, ${faltas} faltas.`);
    }

    // Tareas pendientes
    const { data: tareas } = await sb.from('tareas_entregas')
      .select('estado, tareas_docente(titulo, fecha_entrega)')
      .eq('alumno_id', alumno.id)
      .in('estado', ['pendiente', 'retrasada'])
      .limit(5);
    if (tareas?.length) {
      const lista = tareas.map(t => {
        const td = t.tareas_docente;
        const fecha = td?.fecha_entrega ? ` (entrega: ${td.fecha_entrega})` : '';
        return `"${td?.titulo||'Sin título'}"${fecha}`;
      }).join('; ');
      lines.push(`Tareas pendientes: ${lista}.`);
    } else {
      lines.push('Tareas pendientes: ninguna.');
    }

    // Próximos exámenes
    const hoy = new Date().toISOString().split('T')[0];
    let grupoId = alumno.alumnos_grupos?.[0]?.grupo_id;
    if (!grupoId) {
      const { data: gData } = await sb.from('alumnos_grupos')
        .select('grupo_id').eq('alumno_id', alumno.id).maybeSingle();
      grupoId = gData?.grupo_id;
    }
    if (grupoId) {
      const { data: exs } = await sb.from('examenes_docente')
        .select('titulo, fecha_examen, materia')
        .eq('grupo_id', grupoId)
        .eq('visible_alumnos', true)
        .gte('fecha_examen', hoy)
        .order('fecha_examen')
        .limit(5);
      if (exs?.length) {
        const lista = exs.map(e => `"${e.titulo}" (${e.materia||''}) el ${e.fecha_examen}`).join('; ');
        lines.push(`Próximos exámenes: ${lista}.`);
      } else {
        lines.push('Próximos exámenes: ninguno programado próximamente.');
      }
    }

    // Recuperaciones pendientes
    const { data: recups } = await sb.from('recuperaciones')
      .select('materia, fecha_recuperacion, calificacion_original')
      .eq('alumno_id', alumno.id)
      .eq('estado', 'pendiente')
      .limit(5);
    if (recups?.length) {
      const lista = recups.map(r => `${r.materia} (original: ${r.calificacion_original}, fecha: ${r.fecha_recuperacion||'por definir'})`).join('; ');
      lines.push(`Recuperaciones pendientes: ${lista}.`);
    }

    // Observaciones del docente
    const { data: obs } = await sb.from('observaciones')
      .select('texto').eq('alumno_id', alumno.id)
      .order('created_at', { ascending: false }).limit(2);
    if (obs?.length) lines.push(`Observaciones recientes del docente: "${obs.map(o=>o.texto).join(' | ')}".`);

  } catch(e) { lines.push(`(Algunos datos no pudieron cargarse: ${e.message})`); }

  return lines.join('\n');
}

function _padreChatBurbuja(texto, from) {
  const esPadre = from === 'user';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;justify-content:${esPadre?'flex-end':'flex-start'};`;
  const burbuja = document.createElement('div');
  burbuja.style.cssText = `max-width:82%;padding:10px 13px;border-radius:${esPadre?'16px 16px 4px 16px':'16px 16px 16px 4px'};font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word;`
    + (esPadre
      ? 'background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;'
      : 'background:var(--card-bg,#fff);color:var(--texto);border:1.5px solid var(--borde);');
  burbuja.textContent = texto;
  div.appendChild(burbuja);
  return div;
}

function _padreChatScroll() {
  const c = document.getElementById('p-chat-mensajes');
  if (c) c.scrollTop = c.scrollHeight;
}

async function padreChatEnviar() {
  const inp = document.getElementById('p-chat-input');
  const btn = document.getElementById('p-chat-send-btn');
  const cont = document.getElementById('p-chat-mensajes');
  if (!inp || !cont) return;
  const texto = inp.value.trim();
  if (!texto) return;

  inp.value = '';
  btn.disabled = true;

  // Ocultar chips tras primer mensaje
  const chips = document.getElementById('p-chat-chips');
  if (chips) chips.style.display = 'none';

  // Mostrar mensaje del usuario
  cont.appendChild(_padreChatBurbuja(texto, 'user'));
  window._padreChatHistorial.push({ role: 'user', text: texto });
  _padreChatScroll();

  // Burbuja de "escribiendo..."
  const typing = document.createElement('div');
  typing.id = 'p-chat-typing';
  typing.style.cssText = 'display:flex;justify-content:flex-start;';
  typing.innerHTML = `<div style="padding:10px 14px;border-radius:16px 16px 16px 4px;background:var(--card-bg,#fff);border:1.5px solid var(--borde);font-size:13px;color:var(--texto-2);">✨ Consultando datos…</div>`;
  cont.appendChild(typing);
  _padreChatScroll();

  try {
    // Cargar contexto del alumno (sólo en el primer mensaje o cada 5 turnos)
    if (window._padreChatHistorial.length <= 1 || window._padreChatHistorial.length % 10 === 1) {
      window._padreChatContexto = await _padreGetContexto();
    }
    const contexto = window._padreChatContexto || '';

    // Construir historial reciente (últimos 8 turnos)
    const histReciente = window._padreChatHistorial.slice(-8);
    const histStr = histReciente.slice(0, -1) // excluir el último (la pregunta actual)
      .map(m => `${m.role === 'user' ? 'Padre' : 'SIEMBRA'}: ${m.text}`)
      .join('\n');

    const prompt = `${contexto ? `DATOS DEL ALUMNO:\n${contexto}\n\n` : ''}${histStr ? `CONVERSACIÓN PREVIA:\n${histStr}\n\n` : ''}Padre pregunta: ${texto}`;

    const system = _nemSys('Eres el asistente IA de SIEMBRA hablando con un padre/madre de familia en México. '
      + 'Responde de manera cálida, directa y en máximo 4 oraciones. '
      + 'Usa los datos del alumno para dar respuestas concretas. '
      + 'Si la pregunta no se puede responder con los datos disponibles, indícalo con honestidad y sugiere hablar con el docente. '
      + 'No uses listas largas ni bullet points — responde como conversación natural.');

    const respuesta = await callAI({ feature: 'padre_chat_ia', prompt, system });

    typing.remove();
    window._padreChatHistorial.push({ role: 'assistant', text: respuesta });
    cont.appendChild(_padreChatBurbuja(respuesta, 'assistant'));
    _padreChatScroll();
  } catch(e) {
    typing.remove();
    const err = 'Lo siento, no pude procesar tu pregunta en este momento. Intenta de nuevo.';
    window._padreChatHistorial.push({ role: 'assistant', text: err });
    cont.appendChild(_padreChatBurbuja(err, 'assistant'));
    _padreChatScroll();
  } finally {
    btn.disabled = false;
    inp.focus();
  }
}

function padreChatPregunta(texto) {
  const inp = document.getElementById('p-chat-input');
  if (inp) { inp.value = texto; }
  padreChatEnviar();
}

// ── Plan semanal IA para el alumno (NUEVO) ──
// Se llama el lunes o cuando el alumno abre su sección "Mi plan"
async function generarPlanSemanal(alumnoId, nombreAlumno, calificaciones, observaciones, evidenciasPend) {
  const hoy = new Date();
  const diasSem = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const diaHoy  = diasSem[hoy.getDay()];
  const fecha   = hoy.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' });

  const materiasDebiles = calificaciones
    .filter(c => c.cal !== null && c.cal < 8)
    .sort((a,b) => a.cal - b.cal)
    .slice(0, 3)
    .map(c => `${c.materia} (${c.cal})`);

  const prompt = `Eres el tutor IA de SIEMBRA para un alumno de primaria en México (NEM 2026).
Hoy es ${fecha}.

Alumno: ${nombreAlumno}
Materias con menor calificación: ${materiasDebiles.join(', ') || 'ninguna identificada aún'}.
${observaciones ? `Observaciones del docente: "${observaciones}".` : ''}
${evidenciasPend > 0 ? `Tiene ${evidenciasPend} evidencias pendientes de subir a su portafolio.` : ''}

Genera un "Plan de la semana" con exactamente 3 acciones concretas y alcanzables para esta semana.
Formato JSON estricto (sin markdown, sin explicación):
[
  {"dia":"Lunes","accion":"...","materia":"...","xp":20,"icono":"📝"},
  {"dia":"Miércoles","accion":"...","materia":"...","xp":30,"icono":"🔬"},
  {"dia":"Viernes","accion":"...","materia":"...","xp":25,"icono":"✅"}
]
Cada acción debe ser específica (ej: "Resuelve 5 ejercicios de fracciones en SIEMBRA"), alcanzable en 15-20 min, y motivante para un niño de primaria.`;

  try {
    const texto = await callAI({ feature: 'plan_semanal_alumno', prompt, system: _nemSys('TAREA: Plan semanal personalizado para alumno mexicano. Cada actividad diferente a semanas anteriores. Nivel de dificultad progresivo. Actividades de 15-20 min. Ejemplos con contexto mexicano (nombres, lugares, comida, cultura MX). JSON exacto como se solicita.') });
    const clean = texto.replace(/```json|```/g,'').trim();
    return JSON.parse(clean);
  } catch(e) {
    // Fallback demo
    return [
      { dia:'Lunes', accion:'Completa 5 ejercicios de práctica en SIEMBRA', materia:'Matemáticas', xp:20, icono:'📝' },
      { dia:'Miércoles', accion:'Lee 10 minutos y responde el quiz de comprensión', materia:'Lengua Materna', xp:25, icono:'📖' },
      { dia:'Viernes', accion:'Sube una evidencia de tu tarea de la semana', materia:'Portafolio', xp:30, icono:'📸' },
    ];
  }
}



// ══ PORTAL FAMILIA — SECCIONES NUEVAS (v6) ══
// Datos
var PADRE_MISIONES = [
  {ico:'📊', nombre:'Ver calificaciones de Ana', pts:10, done:true},
  {ico:'📸', nombre:'Subir evidencia de tarea', pts:15, done:false},
  {ico:'💬', nombre:'Enviar mensaje a la maestra', pts:15, done:false},
  {ico:'🧠', nombre:'Responder el quiz del día', pts:20, done:false},
  {ico:'✅', nombre:'Revisar asistencia semanal', pts:10, done:false}
];
var PADRE_RETOS = [
  {ico:'🔥', nombre:'Racha de 7 días', prog:7, meta:7, pts:50},
  {ico:'📸', nombre:'5 evidencias esta semana', prog:2, meta:5, pts:75},
  {ico:'💬', nombre:'Comunicarme 3 veces con la maestra', prog:1, meta:3, pts:40},
  {ico:'📖', nombre:'Leer 3 reportes IA', prog:1, meta:3, pts:30}
];
var PADRE_INS = [
  {emoji:'🌱', nombre:'Primer Login', bg:'#14532d', ok:true},
  {emoji:'🔥', nombre:'Racha 7 días', bg:'#7c2d12', ok:true},
  {emoji:'📸', nombre:'Primera evidencia', bg:'#1e3a5f', ok:false},
  {emoji:'👑', nombre:'Top 3 del salón', bg:'#3f1d07', ok:false}
];
var PADRE_RANKING = [
  {pos:1, em:'👩', nom:'Rosa Martínez', hijo:'Luis M.', pts:820, racha:21},
  {pos:2, em:'👨', nom:'Jorge Pérez', hijo:'Sofía P.', pts:710, racha:15},
  {pos:3, em:'👩', nom:'María Gómez', hijo:'Diego G.', pts:580, racha:12},
  {pos:4, em:'👨', nom:'Familia activa', hijo:'Alumno vinculado', pts:340, racha:7, yo:true},
  {pos:5, em:'👩', nom:'Lucía Torres', hijo:'Emilio T.', pts:290, racha:5},
  {pos:6, em:'👨', nom:'Marco Reyes', hijo:'Valeria R.', pts:230, racha:3},
  {pos:7, em:'👩', nom:'Ana Ruiz', hijo:'Tomás R.', pts:180, racha:2},
  {pos:8, em:'👨', nom:'Pedro López', hijo:'Camila L.', pts:150, racha:1},
]; // Demo
var RECOMPENSAS = [
  {ico:'🛒', nom:'Vale $50 Bodega Aurrerá', tienda:'Bodega Aurrerá', pts:200, cat:'despensa'},
  {ico:'🛒', nom:'Vale $100 Chedraui', tienda:'Chedraui', pts:350, cat:'despensa'},
  {ico:'💊', nom:'Vale $80 farmacia afiliada', tienda:'Farmacia afiliada', pts:280, cat:'salud'},
  {ico:'💊', nom:'Consulta médica gratis', tienda:'Farmacia Genérica Plus', pts:400, cat:'salud'},
  {ico:'✏️', nom:'Mochila escolar', tienda:'Útiles del Maestro', pts:500, cat:'utiles'},
  {ico:'✏️', nom:'Kit colores + cuadernos', tienda:'Papelería El Estudiante', pts:220, cat:'utiles'},
  {ico:'🏪', nom:'$30 en tienda', tienda:'Miscelánea La Esperanza', pts:100, cat:'local'},
  {ico:'🌮', nom:'Combo familiar tacos', tienda:'Tacos El Güero', pts:150, cat:'local'}
];
var HIST_CANJE = [
  {ico:'🏪', nom:'$30 en Miscelánea La Esperanza', pts:100, fecha:'5 Mar 2026'},
  {ico:'✏️', nom:'Kit colores + cuadernos', pts:220, fecha:'12 Feb 2026'}
];
var MAPA_LUGARES = [
  {tipo:'escuela', ico:'🏫', nom:'Escuela vinculada', dir:'Calle Roble 145', dist:'Tu escuela', left:'42%', top:'38%', color:'#1e40af'},
  {tipo:'despensa', ico:'🛒', nom:'Bodega Aurrerá Guadalupe', dir:'Blvd. Díaz Ordaz 890', dist:'0.8 km', left:'72%', top:'35%', color:'#16a34a'},
  {tipo:'salud', ico:'💊', nom:'Farmacia afiliada', dir:'Av. principal 234', dist:'0.5 km', left:'18%', top:'40%', color:'#dc2626'},
  {tipo:'local', ico:'🏪', nom:'Miscelánea La Esperanza', dir:'Calle Cedro 12', dist:'0.2 km', left:'55%', top:'62%', color:'#d97706'},
  {tipo:'local', ico:'🌮', nom:'Tacos El Güero', dir:'Calle Pino 8', dist:'0.3 km', left:'30%', top:'68%', color:'#d97706'},
  {tipo:'salud', ico:'💊', nom:'Farmacia Genérica Plus', dir:'Av. Juárez 560', dist:'1.1 km', left:'78%', top:'72%', color:'#dc2626'},
  {tipo:'despensa', ico:'🛒', nom:'Chedraui Guadalupe', dir:'Blvd. Díaz Ordaz 2000', dist:'1.4 km', left:'85%', top:'52%', color:'#16a34a'},
  {tipo:'local', ico:'🏪', nom:'Tienda Don Checo', dir:'Calle Álamo 3', dist:'0.1 km', left:'48%', top:'75%', color:'#d97706'}
];
var QUIZ_BANCO = [
  {q:'¿Cuál es la materia con mayor calificación del alumno vinculado?', ops:['Matemáticas','Geografía','Historia','Español'], ok:1, exp:'La mayor calificación actual está en Geografía 🌍'},
  {q:'¿Cuántos días de racha lleva el alumno vinculado?', ops:['5 días','8 días','12 días','20 días'], ok:2, exp:'12 días consecutivos 🔥'},
  {q:'¿Qué materia necesita más refuerzo?', ops:['Historia','Ciencias','Matemáticas','Artes'], ok:2, exp:'Matemáticas (7.5) — con práctica puede subir.'},
  {q:'¿Cuál es el porcentaje de asistencia del alumno vinculado?', ops:['88%','91%','94%','97%'], ok:2, exp:'94% de asistencia acumulada.'},
  {q:'¿Cuántos XP ha acumulado el alumno vinculado?', ops:['800 XP','1000 XP','1240 XP','1500 XP'], ok:2, exp:'1,240 XP. Está en Nivel 4.'}
];
var ppQuiz = null, ppQuizResp = false;
var prTabActual = 'semana';
var prwCatActual = 'todo';
var pevTareaSel = null;
var pevEvidencias = [
  {ico:'📐', nom:'Ejercicios fracciones p.45', fecha:'8 Mar 2026', com:'La actividad se completó sin apoyo adicional 💪'}
];

// Hook padreNav
(function(){
  var orig = padreNav;
  padreNav = function(page) {
    orig(page);
    if (page === 'progreso')    renderPadreProgreso();
    else if (page === 'ranking')     renderPadreRanking();
    else if (page === 'evidencias')  renderPadreEvidencias();
    else if (page === 'recompensas') renderPadreRecompensas();
    else if (page === 'mapa')        renderPadreMapa();
  };
})();

// ── MI PROGRESO ──
function renderPadreProgreso() {
  var hw = document.getElementById('pp-hero-wrap');
  if (hw) {
    hw.innerHTML = '<div style="background:linear-gradient(135deg,#1e40af,#2563eb);border-radius:20px;padding:22px 24px;display:flex;align-items:center;gap:20px;margin-bottom:16px;box-shadow:0 8px 24px rgba(30,64,175,.3);">'
      + '<div style="text-align:center;flex-shrink:0;position:relative;"><div style="font-size:52px;font-weight:900;color:white;line-height:1;">7</div><div style="font-size:11px;color:rgba(255,255,255,.6);">días activo</div><div style="position:absolute;top:-6px;right:-14px;font-size:22px;">🔥</div></div>'
      + '<div style="flex:1;"><div style="font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1px;">Tus puntos SIEMBRA</div><div style="font-size:28px;font-weight:900;color:#fbbf24;margin:2px 0;">340 pts</div><div style="height:8px;background:rgba(255,255,255,.15);border-radius:99px;overflow:hidden;margin-bottom:4px;"><div style="height:100%;width:34%;background:linear-gradient(90deg,#fbbf24,#f59e0b);border-radius:99px;"></div></div><div style="font-size:10px;color:rgba(255,255,255,.4);">160 pts para siguiente nivel</div></div>'
      + '</div>';
  }
  var nw = document.getElementById('pp-nivel-wrap');
  if (nw) {
    nw.innerHTML = '<div style="display:flex;align-items:center;gap:12px;background:white;border-radius:14px;padding:14px 16px;border:1px solid var(--borde);margin-bottom:16px;box-shadow:var(--sombra);"><div style="font-size:28px;">🌱</div><div><div style="font-size:14px;font-weight:800;">Nivel 2 — Padre Comprometido</div><div style="font-size:11px;color:var(--texto-2);margin-top:2px;">Siguiente: Nivel 3 · Padre Guardián (500 pts)</div></div></div>';
  }
  renderMisiones();
  renderQuizP();
  var rc = document.getElementById('pp-retos');
  if (rc) {
    rc.innerHTML = PADRE_RETOS.map(function(r) {
      var pct = Math.round(r.prog / r.meta * 100);
      return '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg);border-radius:10px;margin-bottom:8px;border:1px solid var(--borde);">'
        + '<div style="font-size:22px;">' + r.ico + '</div>'
        + '<div style="flex:1;"><div style="font-size:12px;font-weight:700;margin-bottom:4px;">' + r.nombre + '</div>'
        + '<div style="height:6px;background:#e2e8f0;border-radius:99px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;border-radius:99px;background:var(--azul-l);"></div></div></div>'
        + '<div style="font-size:11px;font-weight:700;color:#d97706;margin-left:6px;">+' + r.pts + '</div></div>';
    }).join('');
  }
  var ic = document.getElementById('pp-ins-padre');
  if (ic) {
    ic.innerHTML = PADRE_INS.map(function(ins) {
      return '<div style="border-radius:12px;padding:10px 6px;text-align:center;background:' + (ins.ok ? ins.bg+'22' : '#f8fafc') + ';border:1.5px solid ' + (ins.ok ? ins.bg+'44' : 'var(--borde)') + ';">'
        + (ins.ok ? ins.emoji : '🔒')
        + '<div style="font-size:9px;font-weight:700;color:var(--texto-2);margin-top:4px;">' + ins.nombre + '</div></div>';
    }).join('');
  }
}

function renderMisiones() {
  var mc = document.getElementById('pp-misiones');
  var dc = document.getElementById('pp-misiones-done');
  if (!mc) return;
  mc.innerHTML = PADRE_MISIONES.map(function(m, i) {
    var done = m.done;
    return '<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;margin-bottom:8px;border:1.5px solid ' + (done ? '#86efac' : 'var(--borde)') + ';background:' + (done ? '#f0fdf4' : 'white') + ';cursor:pointer;" onclick="ppToggleMision(' + i + ')">'
      + '<div style="font-size:22px;width:36px;text-align:center;flex-shrink:0;">' + m.ico + '</div>'
      + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;">' + m.nombre + '</div><div style="font-size:11px;color:var(--texto-2);">+' + m.pts + ' puntos</div></div>'
      + '<div style="width:26px;height:26px;border-radius:50%;border:2px solid ' + (done ? 'var(--verde-p)' : 'var(--borde)') + ';display:flex;align-items:center;justify-content:center;font-size:13px;background:' + (done ? 'var(--verde-p)' : 'white') + ';color:' + (done ? 'white' : 'transparent') + ';flex-shrink:0;">✓</div>'
      + '</div>';
  }).join('');
  if (dc) dc.textContent = PADRE_MISIONES.filter(function(m){return m.done;}).length + '/' + PADRE_MISIONES.length;
}

function ppToggleMision(i) {
  if (PADRE_MISIONES[i].done) return;
  PADRE_MISIONES[i].done = true;
  showToast('✅ +' + PADRE_MISIONES[i].pts + ' pts · Misión completada!');
  renderMisiones();
}

function renderQuizP() {
  if (!ppQuiz) { ppQuiz = QUIZ_BANCO[Math.floor(Math.random() * QUIZ_BANCO.length)]; ppQuizResp = false; }
  var pe = document.getElementById('pp-quiz-pregunta');
  var oe = document.getElementById('pp-quiz-opciones');
  var re = document.getElementById('pp-quiz-resultado');
  if (pe) pe.textContent = ppQuiz.q;
  if (oe) {
    oe.innerHTML = ppQuiz.ops.map(function(op, i) {
      return '<button onclick="ppResponder(' + i + ')" ' + (ppQuizResp ? 'disabled' : '') + ' style="padding:12px 16px;border-radius:10px;border:2px solid var(--borde);font-size:13px;font-weight:600;cursor:pointer;background:white;font-family:Sora,sans-serif;text-align:left;width:100%;transition:.2s;" id="pqop-' + i + '">' + op + '</button>';
    }).join('');
  }
  if (re && !ppQuizResp) re.style.display = 'none';
}

function ppResponder(idx) {
  if (ppQuizResp) return;
  ppQuizResp = true;
  var ok = idx === ppQuiz.ok;
  for (var i = 0; i < ppQuiz.ops.length; i++) {
    var b = document.getElementById('pqop-' + i);
    if (!b) continue;
    b.disabled = true;
    if (i === ppQuiz.ok) { b.style.background='#dcfce7'; b.style.borderColor='#22c55e'; }
    else if (i === idx && !ok) { b.style.background='#fee2e2'; b.style.borderColor='#ef4444'; }
  }
  var re = document.getElementById('pp-quiz-resultado');
  if (re) {
    re.style.display = 'block';
    re.style.background = ok ? '#dcfce7' : '#fef9c3';
    re.style.color = ok ? '#15803d' : '#92400e';
    re.innerHTML = (ok ? '🎉 ¡Correcto! +20 pts. ' : '💡 Casi. ') + ppQuiz.exp
      + ' <button onclick="ppSigQuiz()" style="display:block;margin-top:10px;padding:8px 16px;background:' + (ok?'#15803d':'#1e40af') + ';color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:Sora,sans-serif;">Siguiente →</button>';
  }
  if (ok) showToast('🎉 ¡Correcto! +20 pts');
}

function ppSigQuiz() {
  ppQuiz = QUIZ_BANCO[Math.floor(Math.random() * QUIZ_BANCO.length)];
  ppQuizResp = false;
  renderQuizP();
}

// ── RANKING ──
function renderPadreRanking() {
  var hw = document.getElementById('pr-hero-wrap');
  if (hw) {
    hw.innerHTML = '<div style="background:linear-gradient(135deg,#0f172a,#1e3a8a);border-radius:20px;padding:28px 24px;text-align:center;margin-bottom:16px;box-shadow:0 8px 24px rgba(15,23,42,.4);">'
      + '<div style="font-size:13px;color:rgba(255,255,255,.6);margin-bottom:4px;">Tu posición en el salón</div>'
      + '<div style="font-size:52px;font-weight:900;color:white;">#4</div>'
      + '<div style="font-size:14px;color:rgba(255,255,255,.7);">de 28 familias · 4° A</div>'
      + '<div style="margin-top:12px;display:flex;gap:20px;justify-content:center;">'
      + '<div style="text-align:center;"><div style="font-size:20px;font-weight:900;color:#fbbf24;">340</div><div style="font-size:10px;color:rgba(255,255,255,.5);">PUNTOS</div></div>'
      + '<div style="text-align:center;"><div style="font-size:20px;font-weight:900;color:#34d399;">7🔥</div><div style="font-size:10px;color:rgba(255,255,255,.5);">RACHA</div></div>'
      + '<div style="text-align:center;"><div style="font-size:20px;font-weight:900;color:#a78bfa;">18</div><div style="font-size:10px;color:rgba(255,255,255,.5);">MISIONES</div></div>'
      + '</div></div>';
  }
  var tw = document.getElementById('pr-tabs-wrap');
  if (tw) {
    tw.innerHTML = ['semana','mes','ciclo'].map(function(t) {
      var lbl = t==='semana'?'Esta semana':t==='mes'?'Este mes':'Ciclo completo';
      return '<button onclick="prTab(\'' + t + '\',this)" style="padding:8px 16px;border-radius:8px;border:1.5px solid var(--borde);background:' + (prTabActual===t?'var(--azul-p)':'white') + ';color:' + (prTabActual===t?'white':'var(--texto-2)') + ';font-family:Sora,sans-serif;font-size:12px;font-weight:600;cursor:pointer;">' + lbl + '</button>';
    }).join('');
  }
  renderRankingLista();
}

function prTab(tipo, btn) {
  prTabActual = tipo;
  renderPadreRanking();
}

function renderRankingLista() {
  var cont = document.getElementById('pr-lista');
  if (!cont) return;
  var mult = prTabActual==='semana' ? 1 : prTabActual==='mes' ? 3.2 : 8.5;
  cont.innerHTML = PADRE_RANKING.map(function(p) {
    var pts = Math.round(p.pts * mult);
    var med = p.pos===1?'🥇':p.pos===2?'🥈':p.pos===3?'🥉':p.pos;
    var yo = !!p.yo;
    return '<div style="display:flex;align-items:center;gap:12px;padding:12px ' + (yo?'24px':'0') + ';border-bottom:1px solid var(--borde);margin:' + (yo?'0 -24px':'') + ';background:' + (yo?'#dbeafe':'transparent') + ';border-radius:' + (yo?'10px':'0') + ';">'
      + '<div style="width:28px;text-align:center;font-size:14px;font-weight:900;flex-shrink:0;">' + med + '</div>'
      + '<div style="width:36px;height:36px;border-radius:50%;background:' + (yo?'#dbeafe':'#f1f5f9') + ';display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">' + p.em + '</div>'
      + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;">' + p.nom + (yo?' <span style="font-size:10px;background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:99px;">Tú</span>':'') + '</div><div style="font-size:11px;color:var(--texto-2);">' + p.hijo + ' · 4°A</div></div>'
      + '<div style="text-align:right;"><div style="font-size:14px;font-weight:900;color:var(--azul-p);">' + pts.toLocaleString() + ' pts</div><div style="font-size:10px;color:var(--texto-2);">' + p.racha + '🔥</div></div>'
      + '</div>';
  }).join('');
}

// ── EVIDENCIAS ──
function renderPadreEvidencias() {
  var sel = document.getElementById('pev-tareas-sel');
  var tareasPend = PADRE_DATA.tareas.filter(function(t){return t.estado !== 'entregada';});
  if (sel) {
    sel.innerHTML = tareasPend.map(function(t, i) {
      var isEl = pevTareaSel === i;
      return '<div onclick="pevSelTarea(' + i + ')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:2px solid ' + (isEl?'var(--azul-l)':'var(--borde)') + ';background:' + (isEl?'#eff6ff':'white') + ';cursor:pointer;margin-bottom:6px;transition:.15s;">'
        + '<div style="width:10px;height:10px;border-radius:50%;background:' + t.color + ';flex-shrink:0;"></div>'
        + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;">' + t.nombre + '</div><div style="font-size:11px;color:var(--texto-2);">' + t.materia + ' · ' + t.entrega + '</div></div>'
        + (isEl ? '<span style="color:#1e40af;">✓</span>' : '')
        + '</div>';
    }).join('');
  }
  var hist = document.getElementById('pev-historial');
  if (hist) {
    hist.innerHTML = pevEvidencias.length ? pevEvidencias.map(function(e) {
      return '<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--borde);">'
        + '<div style="width:52px;height:52px;border-radius:8px;background:#eff6ff;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">' + e.ico + '</div>'
        + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;">' + e.nom + '</div><div style="font-size:11px;color:var(--texto-2);">' + e.com + '</div></div>'
        + '<div style="text-align:right;flex-shrink:0;"><div style="font-size:11px;color:var(--texto-2);">' + e.fecha + '</div><div style="font-size:10px;color:#22c55e;font-weight:700;">✓ Enviada</div></div>'
        + '</div>';
    }).join('')
    : '<div style="padding:16px;text-align:center;color:var(--texto-2);font-size:13px;">Sin evidencias esta semana</div>';
  }
}

function pevSelTarea(i) { pevTareaSel = i; renderPadreEvidencias(); }

function pevCargarFoto(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var p = document.getElementById('pev-preview');
    if (p) { p.style.display='block'; p.innerHTML='<img src="'+e.target.result+'" style="max-width:100%;max-height:180px;border-radius:10px;object-fit:cover;"><div style="font-size:11px;color:#15803d;margin-top:6px;font-weight:700;">✓ Lista para enviar</div>'; }
  };
  reader.readAsDataURL(file);
}

function pevEnviar() {
  if (pevTareaSel === null) { showToast('⚠️ Selecciona una tarea primero'); return; }
  var tareasPend = PADRE_DATA.tareas.filter(function(t){return t.estado!=='entregada';});
  var t = tareasPend[pevTareaSel];
  var com = document.getElementById('pev-comentario');
  pevEvidencias.unshift({ico:'📸', nom:t.nombre, fecha:'Hoy', com: com ? com.value||'Sin comentario' : 'Sin comentario'});
  pevTareaSel = null;
  var p = document.getElementById('pev-preview'); if(p) p.style.display='none';
  if (com) com.value = '';
  showToast('📸 Evidencia enviada · +15 pts');
  renderPadreEvidencias();
}

// ── RECOMPENSAS ──
function renderPadreRecompensas() {
  var hw = document.getElementById('prw-hero-wrap');
  if (hw) {
    hw.innerHTML = '<div style="background:linear-gradient(135deg,#92400e,#d97706);border-radius:20px;padding:28px 24px;text-align:center;margin-bottom:16px;box-shadow:0 8px 24px rgba(146,64,14,.35);">'
      + '<div style="font-size:13px;color:rgba(255,255,255,.6);margin-bottom:4px;">Tu saldo actual</div>'
      + '<div style="font-size:56px;font-weight:900;color:#fbbf24;">340</div>'
      + '<div style="font-size:14px;color:rgba(255,255,255,.6);">puntos SIEMBRA</div>'
      + '<div style="margin-top:14px;display:flex;gap:10px;justify-content:center;">'
      + '<div style="background:rgba(255,255,255,.1);border-radius:10px;padding:10px 16px;text-align:center;"><div style="font-size:14px;font-weight:900;color:white;">18</div><div style="font-size:10px;color:rgba(255,255,255,.5);">misiones</div></div>'
      + '<div style="background:rgba(255,255,255,.1);border-radius:10px;padding:10px 16px;text-align:center;"><div style="font-size:14px;font-weight:900;color:white;">120</div><div style="font-size:10px;color:rgba(255,255,255,.5);">pts canjeados</div></div>'
      + '<div style="background:rgba(255,255,255,.1);border-radius:10px;padding:10px 16px;text-align:center;"><div style="font-size:14px;font-weight:900;color:white;">Nv. 2</div><div style="font-size:10px;color:rgba(255,255,255,.5);">nivel</div></div>'
      + '</div></div>';
  }
  var cg = document.getElementById('prw-como-ganar');
  var formas = [{ico:'✅',a:'Misión diaria',p:'+10–20'},{ico:'📸',a:'Evidencia de tarea',p:'+15'},{ico:'🧠',a:'Quiz del día',p:'+20'},{ico:'🔥',a:'Racha semanal',p:'+50'},{ico:'💬',a:'Mensaje a maestra',p:'+15'},{ico:'🏆',a:'Ser #1 mensual',p:'+500'}];
  if (cg) {
    cg.innerHTML = formas.map(function(f) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg);border-radius:10px;border:1px solid var(--borde);margin-bottom:6px;"><div style="font-size:20px;">' + f.ico + '</div><div style="flex:1;font-size:13px;font-weight:600;">' + f.a + '</div><div style="font-size:13px;font-weight:900;color:#d97706;">' + f.p + ' pts</div></div>';
    }).join('');
  }
  var cw = document.getElementById('prw-cats-wrap');
  if (cw) {
    var cats = [{k:'todo',l:'Todo'},{k:'despensa',l:'🛒 Despensa'},{k:'salud',l:'💊 Salud'},{k:'utiles',l:'✏️ Útiles'},{k:'local',l:'🏪 Local'}];
    cw.innerHTML = cats.map(function(c) {
      var sel = prwCatActual === c.k;
      return '<button onclick="prwFiltro(\'' + c.k + '\')" style="flex-shrink:0;padding:7px 14px;border-radius:99px;border:1.5px solid ' + (sel?'#d97706':'var(--borde)') + ';background:' + (sel?'#d97706':'white') + ';color:' + (sel?'white':'var(--texto-2)') + ';font-family:Sora,sans-serif;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">' + c.l + '</button>';
    }).join('');
  }
  renderRecompensasGrid(prwCatActual);
  var hist = document.getElementById('prw-historial');
  if (hist) {
    hist.innerHTML = HIST_CANJE.map(function(c) {
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--borde);"><div style="font-size:22px;">' + c.ico + '</div><div style="flex:1;"><div style="font-size:13px;font-weight:700;">' + c.nom + '</div><div style="font-size:11px;color:var(--texto-2);">' + c.fecha + '</div></div><div style="font-size:13px;font-weight:900;color:#b45309;">-' + c.pts + ' pts</div></div>';
    }).join('');
  }
}

function prwFiltro(cat) { prwCatActual = cat; renderPadreRecompensas(); }

function renderRecompensasGrid(cat) {
  var saldo = 340;
  var lista = cat==='todo' ? RECOMPENSAS : RECOMPENSAS.filter(function(r){return r.cat===cat;});
  var grid = document.getElementById('prw-grid');
  if (!grid) return;
  grid.innerHTML = lista.map(function(r) {
    var puede = saldo >= r.pts;
    return '<div onclick="' + (puede ? 'prwCanjear(\''+r.nom+'\','+r.pts+')' : 'showToast(\'Sin puntos suficientes\')') + '" style="background:white;border-radius:14px;border:1.5px solid var(--borde);padding:16px;box-shadow:var(--sombra);cursor:' + (puede?'pointer':'not-allowed') + ';opacity:' + (puede?'1':'0.55') + ';">'
      + '<div style="font-size:30px;margin-bottom:8px;">' + r.ico + '</div>'
      + '<div style="font-size:13px;font-weight:800;margin-bottom:4px;">' + r.nom + '</div>'
      + '<div style="font-size:11px;color:var(--texto-2);margin-bottom:8px;">' + r.tienda + '</div>'
      + '<div style="display:inline-block;background:#fef3c7;color:#92400e;font-size:12px;font-weight:900;padding:3px 10px;border-radius:99px;">' + r.pts + ' pts</div>'
      + (!puede ? '<div style="font-size:10px;color:#ef4444;margin-top:4px;">Faltan ' + (r.pts-saldo) + ' pts</div>' : '')
      + '</div>';
  }).join('');
}

function prwCanjear(nom, pts) { showToast('🎁 Canjeado: "' + nom + '" · -' + pts + ' pts'); }

// ── MAPA ──
function renderPadreMapa() {
  var pinsEl = document.getElementById('pmap-pins');
  if (pinsEl) {
    pinsEl.innerHTML = MAPA_LUGARES.map(function(l, i) {
      return '<div style="position:absolute;left:' + l.left + ';top:' + l.top + ';transform:translate(-50%,-100%);cursor:pointer;display:flex;flex-direction:column;align-items:center;" onclick="pmapTooltip(event,' + i + ')">'
        + '<div style="width:36px;height:36px;border-radius:50%;background:' + l.color + ';display:flex;align-items:center;justify-content:center;font-size:16px;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.2);">' + l.ico + '</div>'
        + '<div style="background:white;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;margin-top:3px;box-shadow:0 1px 4px rgba(0,0,0,.15);white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis;color:var(--texto);text-align:center;">' + l.nom.split(' ').slice(0,2).join(' ') + '</div>'
        + '</div>';
    }).join('');
  }
  var listaEl = document.getElementById('pmap-lista');
  if (listaEl) {
    listaEl.innerHTML = MAPA_LUGARES.map(function(l) {
      return '<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--borde);">'
        + '<div style="width:38px;height:38px;border-radius:10px;background:' + l.color + '22;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">' + l.ico + '</div>'
        + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;">' + l.nom + '</div><div style="font-size:11px;color:var(--texto-2);">' + l.dir + '</div></div>'
        + '<div style="font-size:11px;font-weight:700;color:' + l.color + ';flex-shrink:0;">' + l.dist + '</div>'
        + '</div>';
    }).join('');
  }
}

function pmapTooltip(e, idx) {
  var l = MAPA_LUGARES[idx];
  var tt = document.getElementById('pmap-tt');
  if (!tt) { tt = document.createElement('div'); tt.id='pmap-tt'; document.body.appendChild(tt); }
  tt.style.cssText = 'position:fixed;z-index:9999;background:white;border-radius:12px;padding:12px 16px;box-shadow:0 4px 20px rgba(0,0,0,.15);border:1px solid #e2e8f0;min-width:180px;pointer-events:none;';
  tt.innerHTML = '<div style="font-size:14px;font-weight:800;margin-bottom:4px;">' + l.ico + ' ' + l.nom + '</div>'
    + '<div style="font-size:12px;color:#64748b;">' + l.dir + '</div>'
    + '<div style="font-size:12px;font-weight:700;color:' + l.color + ';margin-top:4px;">📍 ' + l.dist + '</div>'
    + (l.tipo!=='escuela' ? '<div style="font-size:11px;color:#22c55e;margin-top:4px;font-weight:700;">✓ Acepta puntos SIEMBRA</div>' : '');
  tt.style.display = 'block';
  tt.style.left = Math.min(e.clientX + 12, window.innerWidth - 200) + 'px';
  tt.style.top = (e.clientY - 80) + 'px';
  clearTimeout(window._mtt);
  window._mtt = setTimeout(function(){ tt.style.display='none'; }, 3000);
}
