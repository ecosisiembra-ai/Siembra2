// ══════════════════════════════════════════════════
// SIEMBRA — PORTAFOLIO DE EVIDENCIAS v1.0
// Portal Docente · siembra-hub-v19
// ══════════════════════════════════════════════════

const PF = {
  evidencias: [], filtradas: [],
  filtroEstado: 'todas', filtroCampo: 'todos', filtroAlumno: '',
  evidenciaActual: null, xpSeleccionado: 80,
  alumnos: [], iniciado: false,
};

const PF_CAMPOS = {
  'Lenguajes':{ ico:'💬', color:'#7c3aed', colorL:'#f5f3ff', label:'Lenguajes' },
  'Saberes y Pensamiento Científico':{ ico:'🔭', color:'#0369a1', colorL:'#e0f2fe', label:'Ciencias' },
  'Ética, Naturaleza y Sociedades':{ ico:'🌍', color:'#059669', colorL:'#d1fae5', label:'Ética' },
  'De lo Humano y lo Comunitario':{ ico:'🤝', color:'#d97706', colorL:'#fef3c7', label:'Comunitario' },
};
const PF_TIPO_ICO = { 'Tarea':'📝','Proyecto':'🔬','Escritura':'✍️','Video':'🎬','Investigación':'🔍','Otro':'📌' };

const PF_DEMO = window.SiembraDemoFixtures?.portafolio?.evidencias || [];

async function pfInit() {
  if (PF.iniciado) return;
  PF.iniciado = true;
  await pfCargarAlumnos();
  await pfCargarEvidencias();
  pfActualizarStats();
  pfRenderGrid();
}

async function pfCargarAlumnos() {
  const sel = document.getElementById('pf-alumno-sel');
  if (!sel) return;
  const demoAlumnos = window.SiembraDemoFixtures?.portafolioDemoAlumnos || [
    {id:'a3',nombre:'Alumno Demo 3'},
    {id:'a4',nombre:'Alumno Demo 4'},
    {id:'a5',nombre:'Alumno Demo 5'},
  ];
  let lista = demoAlumnos;
  if (typeof sb !== 'undefined' && sb && typeof currentPerfil !== 'undefined' && currentPerfil) {
    try {
      const grupos = await cargarGruposDocente();
      if (grupos.length) {
        const alumnos = await cargarAlumnosGrupo(grupos[0].id);
        if (alumnos.length) lista = alumnos.map(a => ({ id:a.id, nombre: a.nombre+' '+(a.apellido_p||'') }));
      }
    } catch(e) { console.warn('[PF] alumnos demo'); }
  }
  PF.alumnos = lista;
  // Limpiar opciones previas (excepto la primera)
  while (sel.options.length > 1) sel.remove(1);
  lista.forEach(a => {
    const o = document.createElement('option');
    o.value = a.id; o.textContent = a.nombre; sel.appendChild(o);
  });
}

async function pfCargarEvidencias() {
  if (typeof sb !== 'undefined' && sb && typeof currentPerfil !== 'undefined' && currentPerfil) {
    try {
      const grupos = await cargarGruposDocente();
      if (!grupos.length) { PF.evidencias = PF_DEMO; pfAplicarFiltros(); return; }
      const { data, error } = await sb.from('evidencias')
        .select('id,alumno_id,grupo_id,titulo,campo,tipo,archivo_url,archivo_tipo,estado,docente_nota,xp_otorgado,created_at,usuarios!evidencias_alumno_id_fkey(nombre,apellido_p)')
        .in('grupo_id', grupos.map(g=>g.id))
        .order('created_at', { ascending:false });
      if (error) throw error;
      PF.evidencias = (data||[]).map(ev => ({
        ...ev,
        alumno_nombre: ev.usuarios ? ev.usuarios.nombre+' '+(ev.usuarios.apellido_p||'') : 'Alumno',
        alumno_iniciales: ev.usuarios ? (ev.usuarios.nombre[0]+(ev.usuarios.apellido_p?.[0]||'')).toUpperCase() : '?',
      }));
    } catch(e) { console.warn('[PF] evidencias demo:', e.message); PF.evidencias = PF_DEMO; }
  } else {
    PF.evidencias = PF_DEMO;
  }
  pfAplicarFiltros();
}

function pfAplicarFiltros() {
  PF.filtradas = PF.evidencias.filter(ev => {
    if (PF.filtroEstado !== 'todas' && ev.estado !== PF.filtroEstado) return false;
    if (PF.filtroCampo !== 'todos' && ev.campo !== PF.filtroCampo) return false;
    if (PF.filtroAlumno && ev.alumno_id !== PF.filtroAlumno) return false;
    return true;
  });
}

function pfActualizarStats() {
  const evs = PF.evidencias;
  const s = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s('pf-cnt-pendientes', evs.filter(e=>e.estado==='pendiente').length);
  s('pf-cnt-aprobadas',  evs.filter(e=>e.estado==='aprobada').length);
  s('pf-cnt-rechazadas', evs.filter(e=>e.estado==='rechazada').length);
  s('pf-cnt-xp', evs.reduce((a,e)=>a+(e.xp_otorgado||0),0).toLocaleString()+' XP');
  // Badge en nav
  const pend = evs.filter(e=>e.estado==='pendiente').length;
  const navBtn = document.getElementById('nav-btn-portafolio');
  if (navBtn && pend > 0) {
    let badge = navBtn.querySelector('.badge');
    if (!badge) { badge = document.createElement('span'); badge.className='badge'; navBtn.appendChild(badge); }
    badge.textContent = pend;
  }
}

function pfActualizarStatsAlumno(alumnoId) {
  const panel = document.getElementById('pf-alumno-stats');
  if (!panel) return;
  if (!alumnoId) { panel.style.display='none'; return; }
  const evs = PF.evidencias.filter(e=>e.alumno_id===alumnoId);
  panel.style.display='flex';
  const s = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s('pf-alumno-pend',  '⏳ '+evs.filter(e=>e.estado==='pendiente').length);
  s('pf-alumno-aprov', '✅ '+evs.filter(e=>e.estado==='aprobada').length);
  s('pf-alumno-rech',  '↩ '+evs.filter(e=>e.estado==='rechazada').length);
}

function pfRenderGrid() {
  const skels = document.getElementById('pf-skeletons');
  const grid  = document.getElementById('pf-evidencias-grid');
  const empty = document.getElementById('pf-empty-state');
  if (!grid) return;
  if (skels) skels.style.display='none';
  if (!PF.filtradas.length) {
    grid.style.display='none';
    if (empty) empty.style.display='block';
    return;
  }
  if (empty) empty.style.display='none';
  grid.style.display='grid';
  grid.innerHTML = PF.filtradas.map(ev => pfRenderCard(ev)).join('');
}

function pfRenderCard(ev) {
  const c = PF_CAMPOS[ev.campo] || { ico:'📄', color:'#6b7280', colorL:'#f3f4f6', label:ev.campo };
  const tIco = PF_TIPO_ICO[ev.tipo] || '📄';
  const thumb = ev.archivo_url && ev.archivo_tipo==='imagen'
    ? `<img src="${ev.archivo_url}" alt="${ev.titulo}" loading="lazy">`
    : `<div style="width:100%;height:100%;background:${c.colorL};display:flex;align-items:center;justify-content:center;font-size:44px;">${tIco}</div>`;
  const estCfg = {
    pendiente:{ label:'⏳ Pendiente', bg:'#fef9c3', col:'#a16207' },
    aprobada:{ label:'✅ Aprobada', bg:'#dcfce7', col:'#15803d' },
    rechazada:{ label:'↩ Devuelta', bg:'#fee2e2', col:'#b91c1c' },
  };
  const est = estCfg[ev.estado] || estCfg.pendiente;
  const fecha = new Date(ev.created_at).toLocaleDateString('es-MX',{day:'numeric',month:'short'});
  const avatarColors = ['#0369a1','#7c3aed','#059669','#d97706','#c0392b','#1a7a3a'];
  const aColor = avatarColors[ev.alumno_nombre.charCodeAt(0)%avatarColors.length];
  const botonesHtml = ev.estado==='pendiente'
    ? `<button class="ev-accion-btn aprobar" onclick="pfAbrirModal('${ev.id}',event)">✅ Aprobar</button>
       <button class="ev-accion-btn rechazar" onclick="pfAbrirModal('${ev.id}',event)">↩ Devolver</button>`
    : `<button class="ev-accion-btn" onclick="pfAbrirModal('${ev.id}',event)" style="flex:2;">Ver detalle</button>`;
  return `<div class="ev-card ev-${ev.estado}" onclick="pfAbrirModal('${ev.id}')">
    <div class="ev-card-thumb">${thumb}
      <div class="ev-card-thumb-overlay"><span class="ev-card-tipo-badge">${tIco} ${ev.tipo}</span></div>
    </div>
    <div class="ev-card-body">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:26px;height:26px;border-radius:50%;background:${aColor};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:white;flex-shrink:0;">${ev.alumno_iniciales}</div>
        <div style="font-size:12px;font-weight:700;color:var(--gris-80);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ev.alumno_nombre}</div>
      </div>
      <div class="ev-card-titulo">${ev.titulo}</div>
      <div class="ev-card-meta">
        <span class="ev-card-campo" style="background:${c.colorL};color:${c.color};">${c.ico} ${c.label}</span>
        <span>${fecha}</span>
      </div>
      <div class="ev-card-status">
        <span class="ev-status-badge" style="background:${est.bg};color:${est.col};">${est.label}</span>
        ${ev.xp_otorgado ? `<span style="font-size:11px;font-weight:700;color:#7c3aed;">+${ev.xp_otorgado} XP</span>` : ''}
      </div>
      ${ev.docente_nota ? `<div style="margin-top:8px;padding:7px 10px;background:#f0fdf4;border-radius:8px;border-left:2px solid var(--verde);font-size:11px;color:var(--gris-80);line-height:1.5;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">"${ev.docente_nota}"</div>` : ''}
    </div>
    <div class="ev-card-acciones" onclick="event.stopPropagation()">
      ${botonesHtml}
      ${ev.archivo_url ? `<button class="ev-accion-btn ver-archivo" onclick="window.open('${ev.archivo_url}','_blank');event.stopPropagation()" aria-label="Copiar enlace">🔗</button>` : ''}
    </div>
  </div>`;
}

function pfAbrirModal(evId, event) {
  if (event) event.stopPropagation();
  const ev = PF.evidencias.find(e=>e.id===evId);
  if (!ev) return;
  PF.evidenciaActual = ev;
  PF.xpSeleccionado = 80;
  const c = PF_CAMPOS[ev.campo] || { ico:'📄', color:'#6b7280', label:ev.campo };
  const tIco = PF_TIPO_ICO[ev.tipo] || '📄';
  const s = (id,v) => { const el=document.getElementById(id); if(el) el.innerHTML=v; };
  s('pf-modal-emoji', tIco);
  s('pf-modal-titulo', ev.titulo);
  s('pf-modal-alumno', ev.alumno_nombre);
  s('pf-modal-campo', c.ico+' '+c.label);
  s('pf-modal-tipo', tIco+' '+ev.tipo);
  s('pf-modal-fecha', new Date(ev.created_at).toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'}));
  const estCfg = {
    pendiente:{ label:'⏳ Pendiente de revisión', bg:'#fef9c3', col:'#a16207' },
    aprobada:{ label:'✅ Aprobada', bg:'#dcfce7', col:'#15803d' },
    rechazada:{ label:'↩ Devuelta para mejorar', bg:'#fee2e2', col:'#b91c1c' },
  };
  const est = estCfg[ev.estado] || estCfg.pendiente;
  s('pf-modal-estado-badge', `<span style="display:inline-flex;align-items:center;font-size:13px;font-weight:700;padding:6px 14px;border-radius:99px;background:${est.bg};color:${est.col};">${est.label}</span>`);
  // Archivo
  const archEl = document.getElementById('pf-modal-archivo');
  const archLink = document.getElementById('pf-modal-archivo-link');
  if (archEl) {
    if (ev.archivo_url && ev.archivo_tipo==='imagen') {
      archEl.innerHTML = `<img src="${ev.archivo_url}" alt="${ev.titulo}" style="width:100%;height:100%;object-fit:contain;">`;
    } else {
      const bgMap = { video:'#fce7f3', documento:'#f3f4f6' };
      archEl.innerHTML = `<div style="width:100%;height:100%;background:${bgMap[ev.archivo_tipo]||'#f3f4f6'};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;"><div style="font-size:48px;">${tIco}</div><div style="font-size:12px;color:var(--gris-50);">${ev.tipo} enviado por el alumno</div></div>`;
    }
    if (archLink) archLink.style.display = ev.archivo_url ? 'block' : 'none';
  }
  // Nota previa
  const notaPrev = document.getElementById('pf-modal-nota-previa');
  const notaPrevTxt = document.getElementById('pf-modal-nota-previa-txt');
  if (notaPrev) notaPrev.style.display = ev.docente_nota ? 'block' : 'none';
  if (notaPrevTxt) notaPrevTxt.textContent = ev.docente_nota || '';
  // Input
  const ni = document.getElementById('pf-nota-input');
  if (ni) ni.value = ev.docente_nota || '';
  // XP btns reset
  document.querySelectorAll('.pf-xp-btn').forEach(b=>b.classList.remove('active'));
  const xpBtn2 = document.querySelector('.pf-xp-btn:nth-child(2)');
  if (xpBtn2) xpBtn2.classList.add('active');
  // Reset IA
  const iaPanel = document.getElementById('pf-ia-ev-panel');
  const iaBtnR  = document.getElementById('pf-btn-ia-retro');
  if (iaPanel) iaPanel.style.display='none';
  if (iaBtnR)  iaBtnR.style.display='block';
  // Botones
  const btnA = document.getElementById('pf-btn-aprobar');
  const btnR = document.getElementById('pf-btn-rechazar');
  if (ev.estado==='aprobada') {
    if (btnA) btnA.textContent='🔄 Cambiar nota/XP';
    if (btnR) btnR.style.display='none';
  } else {
    if (btnA) btnA.textContent='✅ Aprobar y dar XP';
    if (btnR) { btnR.style.display='block'; btnR.textContent='↩ Devolver para mejorar'; }
  }
  document.getElementById('pf-modal').classList.add('open');
}

function pfCerrarModal() {
  document.getElementById('pf-modal').classList.remove('open');
  PF.evidenciaActual = null;
}

async function pfAprobar() {
  const ev = PF.evidenciaActual;
  if (!ev) return;
  const nota = document.getElementById('pf-nota-input')?.value?.trim() || '';
  const xp   = PF.xpSeleccionado;
  const btn  = document.getElementById('pf-btn-aprobar');
  if (btn) { btn.disabled=true; btn.textContent='💾 Guardando…'; }
  try {
    if (typeof sb !== 'undefined' && sb) {
      const { error } = await sb.from('evidencias')
        .update({ estado:'aprobada', docente_nota:nota, xp_otorgado:xp, updated_at:new Date().toISOString() })
        .eq('id', ev.id);
      if (error) throw error;
      if (xp > 0) {
        await sb.from('historial_xp').insert({ alumno_id:ev.alumno_id, cantidad:xp, motivo:'Evidencia aprobada: '+ev.titulo });
        const { data:p } = await sb.from('perfil_alumno').select('xp_total').eq('alumno_id',ev.alumno_id).single();
        if (p) await sb.from('perfil_alumno').update({ xp_total:(p.xp_total||0)+xp }).eq('alumno_id',ev.alumno_id);
      }
    }
    const idx = PF.evidencias.findIndex(e=>e.id===ev.id);
    if (idx>-1) { PF.evidencias[idx].estado='aprobada'; PF.evidencias[idx].docente_nota=nota; PF.evidencias[idx].xp_otorgado=xp; }
    pfCerrarModal(); pfAplicarFiltros(); pfActualizarStats(); pfRenderGrid();
    if (typeof toast==='function') toast(`✅ Aprobada · +${xp} XP para ${ev.alumno_nombre.split(' ')[0]}`);
  } catch(e) {
    console.error('[PF]',e);
    if (typeof toast==='function') toast('❌ Error al guardar. Intenta de nuevo.');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='✅ Aprobar y dar XP'; }
  }
}

async function pfRechazar() {
  const ev = PF.evidenciaActual;
  if (!ev) return;
  const nota = document.getElementById('pf-nota-input')?.value?.trim() || '';
  if (!nota) {
    if (typeof toast==='function') toast('✏️ Escribe una nota para que el alumno sepa cómo mejorar');
    document.getElementById('pf-nota-input')?.focus();
    return;
  }
  const btn = document.getElementById('pf-btn-rechazar');
  if (btn) { btn.disabled=true; btn.textContent='💾 Guardando…'; }
  try {
    if (typeof sb !== 'undefined' && sb) {
      const { error } = await sb.from('evidencias')
        .update({ estado:'rechazada', docente_nota:nota, xp_otorgado:0, updated_at:new Date().toISOString() })
        .eq('id', ev.id);
      if (error) throw error;
    }
    const idx = PF.evidencias.findIndex(e=>e.id===ev.id);
    if (idx>-1) { PF.evidencias[idx].estado='rechazada'; PF.evidencias[idx].docente_nota=nota; PF.evidencias[idx].xp_otorgado=0; }
    pfCerrarModal(); pfAplicarFiltros(); pfActualizarStats(); pfRenderGrid();
    if (typeof toast==='function') toast(`↩ Devuelta a ${ev.alumno_nombre.split(' ')[0]} con retroalimentación`);
  } catch(e) {
    if (typeof toast==='function') toast('❌ Error al guardar. Intenta de nuevo.');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='↩ Devolver para mejorar'; }
  }
}

function pfSelXP(xp, btn) {
  PF.xpSeleccionado = xp;
  document.querySelectorAll('.pf-xp-btn').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function pfFiltrar(tipo, valor, btn) {
  if (tipo==='estado') {
    PF.filtroEstado = valor;
    document.querySelectorAll('#pf-filtros-estado .pf-filter-btn').forEach(b=>b.classList.remove('active'));
  } else {
    PF.filtroCampo = valor;
    document.querySelectorAll('#pf-filtros-campo .pf-filter-btn').forEach(b=>b.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');
  pfAplicarFiltros(); pfRenderGrid();
}

function pfCambiarAlumno(alumnoId) {
  PF.filtroAlumno = alumnoId;
  pfActualizarStatsAlumno(alumnoId);
  pfAplicarFiltros(); pfRenderGrid();
}

function pfAbrirArchivo() {
  if (PF.evidenciaActual?.archivo_url) window.open(PF.evidenciaActual.archivo_url,'_blank');
}

async function pfRefrescar() {
  const btn = document.getElementById('pf-refresh-btn');
  if (btn) btn.textContent='⟳ Cargando…';
  PF.iniciado = false;
  const skels = document.getElementById('pf-skeletons');
  const grid  = document.getElementById('pf-evidencias-grid');
  if (skels) skels.style.display='grid';
  if (grid)  grid.style.display='none';
  PF.evidencias = []; PF.filtradas = [];
  await pfCargarEvidencias();
  pfActualizarStats(); pfRenderGrid();
  PF.iniciado = true;
  if (btn) btn.textContent='⟳ Actualizar';
  if (typeof toast==='function') toast('✅ Evidencias actualizadas');
}

async function pfGenerarRetroIA() {
  const ev = PF.evidenciaActual;
  if (!ev) return;
  const panel = document.getElementById('pf-ia-ev-panel');
  const output = document.getElementById('pf-ia-ev-output');
  const btn    = document.getElementById('pf-btn-ia-retro');
  if (!panel || !output) return;
  panel.style.display='block';
  if (btn) btn.style.display='none';
  output.innerHTML='<span style="opacity:.7;">✨ Generando retroalimentación…</span>';
  try {
    const texto = await callAI({
      feature:'portafolio_retro',
      prompt:`Eres un docente experto en la NEM 2026 de México. Un alumno de primaria envió esta evidencia:\n- Título: "${ev.titulo}"\n- Campo formativo: ${ev.campo}\n- Tipo: ${ev.tipo}\n\nGenera una retroalimentación cálida, específica y constructiva en máximo 3 oraciones. Incluye: qué hizo bien, qué puede mejorar, y una pregunta que invite a reflexionar. Lenguaje accesible para primaria. Solo la nota, sin introducción.`,
      system:'Docente experto NEM 2026. Retroalimentación cálida, específica y formativa.',
    });
    output.innerHTML = '"'+texto.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'"';
    const ni = document.getElementById('pf-nota-input');
    if (ni && !ni.value.trim()) ni.value = texto;
  } catch(e) {
    output.innerHTML='❌ Error. Escribe tu nota manualmente.';
    if (btn) btn.style.display='block';
  }
}

async function pfAnalisisIAGrupo() {
  const panel  = document.getElementById('pf-ia-grupo-panel');
  const output = document.getElementById('pf-ia-grupo-output');
  if (!panel || !output) return;
  panel.style.display='block';
  output.innerHTML='<span style="opacity:.7;">Analizando portafolio del grupo…</span>';
  panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
  const evs = PF.evidencias;
  const campos = {};
  evs.forEach(e => { campos[e.campo] = (campos[e.campo]||0)+1; });
  try {
    const texto = await callAI({
      feature:'portafolio_analisis_grupo',
      prompt:`Asesor pedagógico NEM 2026.\nDatos del portafolio del grupo:\n- Total: ${evs.length} evidencias\n- Pendientes: ${evs.filter(e=>e.estado==='pendiente').length}\n- Aprobadas: ${evs.filter(e=>e.estado==='aprobada').length}\n- Devueltas: ${evs.filter(e=>e.estado==='rechazada').length}\n- Por campo: ${JSON.stringify(campos)}\n\nEn 4-5 oraciones: (1) observación sobre participación, (2) recomendación pedagógica, (3) campo que necesita más atención. Directo, sin introducción.`,
      system:'Asesor pedagógico NEM 2026. Análisis práctico para docente de primaria.',
    });
    output.innerHTML = texto.replace(/\n/g,'<br>');
  } catch(e) {
    output.innerHTML='❌ Error al generar el análisis. Intenta de nuevo.';
  }
}

// ══════════════════════════════════════════════════════════════════════
// 1. ALUMNO → HUB: función de redirección con traspaso de sesión
// ══════════════════════════════════════════════════════════════════════
async function alumnoAbrirPortal() {
  const overlay = document.createElement('div');
  overlay.id = 'alumno-transition';
  overlay.style.cssText = 'position:fixed;inset:0;background:#0a1f12;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:16px;';
  overlay.innerHTML = `
    <div style="font-family:'Fraunces',serif;font-size:36px;color:white;letter-spacing:2px;">🌱 SIEMBRA</div>
    <div style="font-size:14px;color:rgba(255,255,255,.6);">Abriendo tu espacio…</div>
    <div style="width:40px;height:40px;border:3px solid rgba(255,255,255,.2);border-top-color:#22c55e;border-radius:50%;animation:spin .8s linear infinite;"></div>
  `;
  document.body.appendChild(overlay);

  try {
    if (sb) {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.access_token) {
        try {
          localStorage.setItem('siembra_alumno_token',  session.access_token);
          localStorage.setItem('siembra_alumno_refresh', session.refresh_token || '');
          localStorage.setItem('siembra_supabase_url',   SUPABASE_URL);
          localStorage.setItem('siembra_supabase_key',   SUPABASE_KEY);
        } catch(e) {}
        // Redirigir al portal del alumno
        window.location.href = _URL_PORTAL_ALUMNO;
        return;
      }
    }
  } catch(e) { console.warn('[alumno] session error:', e); }

  // Demo mode: mostrar aviso en vez de redirigir
  overlay.innerHTML = `
    <div style="font-family:'Fraunces',serif;font-size:36px;color:white;letter-spacing:2px;">🌱 SIEMBRA</div>
    <div style="font-size:18px;color:white;font-weight:700;margin-top:10px;">Portal del Alumno</div>
    <div style="max-width:400px;text-align:center;margin-top:12px;">
      <div style="font-size:13px;color:rgba(255,255,255,.7);line-height:1.7;margin-bottom:20px;">
        En modo demo, el portal del alumno se abre en su propia página.<br>
        Para probarlo con una cuenta real, registra un alumno desde el portal del director.
      </div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <a href="${_URL_PORTAL_ALUMNO}" target="_blank" style="padding:10px 20px;background:#22c55e;color:white;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;text-decoration:none;">Abrir portal alumno ↗</a>
        <button onclick="document.getElementById('alumno-transition').remove();document.getElementById('hub-login').style.display='flex';" style="padding:10px 20px;background:rgba(255,255,255,.15);color:white;border:1px solid rgba(255,255,255,.25);border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;cursor:pointer;">← Volver</button>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════
// 2. HORARIO → DB: guardar y cargar horario en Supabase
// ══════════════════════════════════════════════════════════════════════
async function horarioGuardarDB() {
  if (!sb || !currentPerfil) {
    // Fallback a localStorage
    try { localStorage.setItem('siembra_horario', JSON.stringify(horarioData)); } catch(e) {}
    hubToast('💾 Horario guardado localmente');
    return;
  }
  hubToast('💾 Guardando horario…');
  try {
    const grupoId = window._grupoActivo || window._gruposDocente?.[0]?.id;
    const docenteId = currentPerfil.id;
    const rows = [];
    diasSemana.forEach(dia => {
      (horarioData[dia] || []).forEach((clase, hora_idx) => {
        if (!clase) return;
        const [materia, grupo] = clase.split('·').map(s => s.trim());
        rows.push({
          docente_id: docenteId,
          grupo_id:   grupoId || null,
          dia_semana: dia,
          hora_idx,
          materia:    materia || '',
          grupo_label: grupo || '',
          ciclo: window.CICLO_ACTIVO,
        });
      });
    });
    // Borrar existentes y reinsertar (upsert por docente+ciclo)
    await sb.from('horarios_docente')
      .delete()
      .eq('docente_id', docenteId)
      .eq('ciclo', window.CICLO_ACTIVO);
    if (rows.length) {
      const { error } = await sb.from('horarios_docente').insert(rows);
      if (error) throw error;
    }
    // Backup en localStorage
    try { localStorage.setItem('siembra_horario', JSON.stringify(horarioData)); } catch(e) {}
    hubToast('✅ Horario guardado', 'ok');
  } catch(e) {
    console.warn('[horario] save error:', e.message);
    // Guardar en localStorage como fallback
    try { localStorage.setItem('siembra_horario', JSON.stringify(horarioData)); } catch(ex) {}
    hubToast('💾 Horario guardado localmente (sin conexión)');
  }
}

async function horarioCargarDB() {
  // Primero intentar localStorage (carga rápida)
  try {
    const saved = JSON.parse(localStorage.getItem('siembra_horario') || 'null');
    if (saved) { Object.assign(horarioData, saved); renderHorario(); }
  } catch(e) {}

  if (!sb || !currentPerfil) return;
  try {
    const { data, error } = await sb.from('horarios_docente')
      .select('dia_semana, hora_idx, materia, grupo_label')
      .eq('docente_id', currentPerfil.id)
      .eq('ciclo', window.CICLO_ACTIVO);
    if (error || !data?.length) return;
    // Reconstruir horarioData
    diasSemana.forEach(d => { horarioData[d] = Array(horas.length).fill(''); });
    data.forEach(r => {
      if (horarioData[r.dia_semana] !== undefined && r.hora_idx < horas.length) {
        horarioData[r.dia_semana][r.hora_idx] = r.grupo_label
          ? `${r.materia}·${r.grupo_label}` : r.materia;
      }
    });
    renderHorario();
    try { localStorage.setItem('siembra_horario', JSON.stringify(horarioData)); } catch(e) {}
  } catch(e) { console.warn('[horario] load error:', e.message); }
}

// ══════════════════════════════════════════════════════════════════════
// 3. TAREAS → DB: migrar de localStorage a Supabase
// ══════════════════════════════════════════════════════════════════════
// SQL requerido (ejecutar en Supabase):
// CREATE TABLE IF NOT EXISTS tareas_docente (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   docente_id uuid REFERENCES usuarios(id),
//   grupo_id   uuid REFERENCES grupos(id),
//   titulo     text NOT NULL,
//   materia    text,
//   fecha_entrega date,
//   ciclo      text DEFAULT '2025-2026',
//   created_at timestamptz DEFAULT now()
// );
// CREATE TABLE IF NOT EXISTS tareas_entregas (
//   id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   tarea_id  uuid REFERENCES tareas_docente(id) ON DELETE CASCADE,
//   alumno_id uuid REFERENCES usuarios(id),
//   estado    text DEFAULT 'pendiente' CHECK (estado IN ('pendiente','entregada','tarde')),
//   updated_at timestamptz DEFAULT now(),
//   UNIQUE(tarea_id, alumno_id)
// );

async function tareasCargarDB() {
  // Siempre cargar localStorage primero para respuesta inmediata
  TAREAS_DATA = JSON.parse(localStorage.getItem('siembra_tareas') || '[]');
  tareasRender();

  if (!sb || !currentPerfil) return;
  const grupoId = window._grupoActivo;
  if (!grupoId) return;

  try {
    const { data: tareasDB, error } = await sb.from('tareas_docente')
      .select(`id, titulo, materia, fecha_entrega,
               tareas_entregas(alumno_id, estado)`)
      .eq('docente_id', currentPerfil.id)
      .eq('grupo_id', grupoId)
      .eq('ciclo', window.CICLO_ACTIVO)
      .order('created_at', { ascending: false });

    if (error || !tareasDB?.length) return;

    const alumnosList = window._alumnosActivos || alumnos;
    TAREAS_DATA = tareasDB.map(t => ({
      id:      t.id,
      titulo:  t.titulo,
      materia: t.materia,
      fecha:   t.fecha_entrega ? new Date(t.fecha_entrega).toLocaleDateString('es-MX') : '—',
      _db: true,
      alumnos: alumnosList.map((a, ai) => {
        const entrega = (t.tareas_entregas || []).find(e => e.alumno_id === (a.id || String(ai)));
        return { ai, alumno_id: a.id, estado: entrega?.estado || 'pendiente' };
      }),
    }));

    // Sincronizar localStorage
    try { localStorage.setItem('siembra_tareas', JSON.stringify(TAREAS_DATA)); } catch(e) {}
    tareasRender();
  } catch(e) { console.warn('[tareas] load DB error:', e.message); }
}

async function tareasGuardarDB(tarea) {
  if (!sb || !currentPerfil) {
    try { localStorage.setItem('siembra_tareas', JSON.stringify(TAREAS_DATA)); } catch(e) {}
    return;
  }
  const grupoId = window._grupoActivo;
  if (!grupoId) return;

  try {
    // Upsert tarea principal
    const { data: saved, error } = await sb.from('tareas_docente')
      .upsert({
        id:           tarea._db ? tarea.id : undefined,
        docente_id:   currentPerfil.id,
        grupo_id:     grupoId,
        titulo:       tarea.titulo,
        materia:      tarea.materia,
        fecha_entrega: null,
        ciclo: window.CICLO_ACTIVO,
      }, { onConflict: 'id' })
      .select('id').single();

    if (error) throw error;
    const tareaId = saved.id;

    // Upsert entregas
    const alumnosList = window._alumnosActivos || alumnos;
    const entregas = tarea.alumnos
      .filter(a => a.alumno_id || alumnosList[a.ai]?.id)
      .map(a => ({
        tarea_id:  tareaId,
        alumno_id: a.alumno_id || alumnosList[a.ai]?.id,
        estado:    a.estado || 'pendiente',
        updated_at: new Date().toISOString(),
      }));

    if (entregas.length) {
      await sb.from('tareas_entregas')
        .upsert(entregas, { onConflict: 'tarea_id,alumno_id' });
    }

    // Actualizar id local
    tarea.id   = tareaId;
    tarea._db  = true;
    try { localStorage.setItem('siembra_tareas', JSON.stringify(TAREAS_DATA)); } catch(e) {}
  } catch(e) { console.warn('[tareas] save DB error:', e.message); }
}

async function tareasActualizarEntrega(tareaIdx, alumnoIdx, nuevoEstado) {
  const tarea = TAREAS_DATA[tareaIdx];
  if (!tarea) return;
  const entrada = tarea.alumnos.find(a => a.ai === alumnoIdx);
  if (entrada) entrada.estado = nuevoEstado;

  // Guardar en DB si disponible
  if (sb && tarea._db && tarea.id) {
    const alumnosList = window._alumnosActivos || alumnos;
    const alumnoId = alumnosList[alumnoIdx]?.id;
    if (alumnoId) {
      try {
        await sb.from('tareas_entregas').upsert({
          tarea_id: tarea.id, alumno_id: alumnoId,
          estado: nuevoEstado, updated_at: new Date().toISOString(),
        }, { onConflict: 'tarea_id,alumno_id' });
      } catch(e) { console.warn('[tareas] entrega update error:', e.message); }
    }
  }
  try { localStorage.setItem('siembra_tareas', JSON.stringify(TAREAS_DATA)); } catch(e) {}
  tareasRender();
}

// ══════════════════════════════════════════════════════════════════════
// 4. EVALUACIÓN CUALITATIVA NEM A-D
// Agrega una columna "Observación cualitativa" a la tabla de calificaciones
// con textarea por alumno para el descriptor formativo
// ══════════════════════════════════════════════════════════════════════

// Descriptores NEM por nivel — el docente puede personalizarlos
const CAL_DESCRIPTORES_NEM = {
  A: 'Sobresaliente — demuestra dominio amplio del campo formativo con aplicación autónoma y creativa.',
  B: 'Satisfactorio — comprende los contenidos y los aplica correctamente en la mayoría de las situaciones.',
  C: 'Suficiente — identifica los elementos principales aunque requiere apoyo para su aplicación.',
  D: 'Básico — reconoce algunos elementos del campo formativo; necesita refuerzo continuo.',
  E: 'Requiere atención especial — se recomienda intervención pedagógica y seguimiento con USAER.',
};

// Almacén de observaciones cualitativas (en memoria + Supabase)
// Estructura: CAL_OBS[materia][trimestre][alumno_idx] = "texto libre"
let CAL_OBS = {};

function calObsInit() {
  MATERIAS_NEM.forEach(m => {
    CAL_OBS[m] = { 1:{}, 2:{}, 3:{} };
  });
}

async function calCargarObs(grupoId) {
  if (!sb || !currentPerfil || !grupoId) return;
  try {
    const { data } = await sb.from('cal_observaciones_cualitativas')
      .select('alumno_id, materia, trimestre, observacion')
      .eq('grupo_id', grupoId).eq('ciclo', window.CICLO_ACTIVO);
    if (!data?.length) return;
    const alumnosList = window._alumnosActivos || alumnos;
    data.forEach(r => {
      const ai = alumnosList.findIndex(a => a.id === r.alumno_id);
      if (ai < 0) return;
      if (!CAL_OBS[r.materia]) CAL_OBS[r.materia] = {};
      if (!CAL_OBS[r.materia][r.trimestre]) CAL_OBS[r.materia][r.trimestre] = {};
      CAL_OBS[r.materia][r.trimestre][ai] = r.observacion;
    });
  } catch(e) { console.warn('[calObs] load:', e.message); }
}

async function calGuardarObs(ai, mat, trim, texto) {
  CAL_OBS[mat] = CAL_OBS[mat] || {};
  CAL_OBS[mat][trim] = CAL_OBS[mat][trim] || {};
  CAL_OBS[mat][trim][ai] = texto;

  if (!sb || !currentPerfil) return;
  const grupoId = window._grupoActivo;
  if (!grupoId) return;
  const alumnosList = window._alumnosActivos || alumnos;
  const alumnoId = alumnosList[ai]?.id;
  if (!alumnoId) return;

  try {
    await sb.from('cal_observaciones_cualitativas').upsert({
      alumno_id:   alumnoId,
      grupo_id:    grupoId,
      docente_id:  currentPerfil.id,
      materia:     mat,
      trimestre:   trim,
      observacion: texto,
      ciclo: window.CICLO_ACTIVO,
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'alumno_id,grupo_id,materia,trimestre,ciclo' });
  } catch(e) { console.warn('[calObs] save:', e.message); }
}

// Modo cualitativo: abre la vista dedicada de observaciones por alumno
let CAL_MODO_CUALITATIVO = false;

function calToggleCualitativo() {
  const vista = document.getElementById('cal-vista-cualitativa');
  const principal = document.getElementById('cal-vista-principal');
  if (!vista || !principal) return;
  principal.style.display = 'none';
  vista.style.display = '';
  calCualitativaRender();
}

function calCualitativaVolver() {
  const vista = document.getElementById('cal-vista-cualitativa');
  const principal = document.getElementById('cal-vista-principal');
  if (vista) vista.style.display = 'none';
  if (principal) principal.style.display = '';
}

function calCualitativaRender() {
  const matLabel = document.getElementById('cal-cual-mat-label');
  const trimLabel = document.getElementById('cal-cual-trim-label');
  const lista = document.getElementById('cal-cual-alumnos-lista');
  const chipsEl = document.getElementById('cal-cual-desc-chips');
  if (!lista) return;

  const mat  = window.calMatActual || 'Matemáticas';
  const trim = window.calTrimActual || 1;
  if (matLabel) matLabel.textContent = mat;
  if (trimLabel) trimLabel.textContent = trim;

  // Chips de descriptores NEM
  if (chipsEl) {
    const colores = { A:'#dcfce7', B:'#dbeafe', C:'#fef9c3', D:'#fed7aa', E:'#fee2e2' };
    const textos  = { A:'A — Sobresaliente', B:'B — Satisfactorio', C:'C — Suficiente', D:'D — Básico', E:'E — Requiere atención' };
    chipsEl.innerHTML = Object.entries(textos).map(([k,v]) =>
      `<button onclick="calCualitativaAplicarTodos('${k}')" style="padding:6px 14px;background:${colores[k]};border:1.5px solid #cbd5e1;border-radius:20px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">${v}</button>`
    ).join('');
  }

  const alumnosList = window._alumnosActivos || alumnos;
  if (!alumnosList?.length) {
    lista.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Sin alumnos en el grupo activo.</div>';
    return;
  }

  lista.innerHTML = alumnosList.map((a, ai) => {
    const obsGuardada = CAL_OBS?.[mat]?.[trim]?.[ai] || '';
    const nombre = a.nombre || a.n || `Alumno ${ai+1}`;
    return `<div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:16px 20px;margin-bottom:12px;display:flex;align-items:flex-start;gap:16px;">
      <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#e8f5ee,#c8ecd6);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:15px;font-weight:700;color:#0d5c2f;flex-shrink:0;">${ai+1}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:8px;">${nombre}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
          ${['A','B','C','D','E'].map(k => {
            const desc = { A:'Sobresaliente', B:'Satisfactorio', C:'Suficiente', D:'Básico', E:'Requiere atención' };
            const colores = { A:'#dcfce7', B:'#dbeafe', C:'#fef9c3', D:'#fed7aa', E:'#fee2e2' };
            const textC   = { A:'#15803d',  B:'#1e40af',  C:'#a16207',  D:'#c2410c',  E:'#b91c1c' };
            const isActive = obsGuardada === k;
            return `<button onclick="calCualitativaSelDesc(${ai},'${k}')" id="cal-cual-chip-${ai}-${k}"
              style="padding:4px 12px;background:${isActive ? colores[k] : '#f8fafc'};border:1.5px solid ${isActive ? textC[k] : '#e2e8f0'};border-radius:16px;font-family:'Sora',sans-serif;font-size:11px;font-weight:${isActive?'800':'500'};color:${isActive?textC[k]:'#64748b'};cursor:pointer;transition:.15s;">${k} — ${desc[k]}</button>`;
          }).join('')}
        </div>
        <textarea id="cal-cual-texto-${ai}" placeholder="O escribe una observación libre…" rows="2"
          onchange="calCualitativaGuardar(${ai}, this.value)"
          style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;resize:vertical;outline:none;">${(obsGuardada && !['A','B','C','D','E'].includes(obsGuardada)) ? obsGuardada : ''}</textarea>
      </div>
    </div>`;
  }).join('');
}

function calCualitativaSelDesc(ai, desc) {
  const mat  = window.calMatActual || 'Matemáticas';
  const trim = window.calTrimActual || 1;
  // Limpiar textarea si se selecciona un descriptor NEM
  const ta = document.getElementById('cal-cual-texto-' + ai);
  if (ta) ta.value = '';
  // Actualizar chips visuals
  ['A','B','C','D','E'].forEach(k => {
    const chip = document.getElementById(`cal-cual-chip-${ai}-${k}`);
    const colores = { A:'#dcfce7', B:'#dbeafe', C:'#fef9c3', D:'#fed7aa', E:'#fee2e2' };
    const textC   = { A:'#15803d',  B:'#1e40af',  C:'#a16207',  D:'#c2410c',  E:'#b91c1c' };
    if (chip) {
      const isActive = k === desc;
      chip.style.background   = isActive ? colores[k] : '#f8fafc';
      chip.style.border       = `1.5px solid ${isActive ? textC[k] : '#e2e8f0'}`;
      chip.style.color        = isActive ? textC[k] : '#64748b';
      chip.style.fontWeight   = isActive ? '800' : '500';
    }
  });
  calGuardarObs(ai, mat, trim, desc);
}

function calCualitativaGuardar(ai, texto) {
  const mat  = window.calMatActual || 'Matemáticas';
  const trim = window.calTrimActual || 1;
  // Si escribe texto libre, desmarcar chips NEM
  if (texto.trim()) {
    ['A','B','C','D','E'].forEach(k => {
      const chip = document.getElementById(`cal-cual-chip-${ai}-${k}`);
      if (chip) { chip.style.background='#f8fafc'; chip.style.border='1.5px solid #e2e8f0'; chip.style.color='#64748b'; chip.style.fontWeight='500'; }
    });
  }
  calGuardarObs(ai, mat, trim, texto.trim());
}

async function calCualitativaGuardarTodas() {
  const mat  = window.calMatActual || 'Matemáticas';
  const trim = window.calTrimActual || 1;
  const alumnosList = window._alumnosActivos || alumnos;
  for (let ai = 0; ai < alumnosList.length; ai++) {
    const ta = document.getElementById('cal-cual-texto-' + ai);
    if (ta?.value?.trim()) {
      await calGuardarObs(ai, mat, trim, ta.value.trim());
    }
  }
  hubToast('✅ Observaciones guardadas', 'success');
  calCualitativaVolver();
}

function calCualitativaAplicarTodos(desc) {
  const alumnosList = window._alumnosActivos || alumnos;
  for (let ai = 0; ai < alumnosList.length; ai++) {
    calCualitativaSelDesc(ai, desc);
  }
}

// ── Patch: enriquecer calRenderTabla con columna cualitativa ──────────
// calRenderTabla patch applied after load
let _calRenderTablaOrig = null;
// Will be set in DOMContentLoaded after all scripts load