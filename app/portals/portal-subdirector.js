// ══ SUBDIRECTOR PORTAL ═══════════════════════════════════════════════════
function subdirInit() {
  if (currentPerfil) {
    const n = document.getElementById('subdir-nombre');
    if (n) n.textContent = currentPerfil.nombre || 'Subdirector/a';
    const topTag = document.getElementById('subdir-escuela-tag');
    if (topTag) topTag.textContent = currentPerfil.escuela_nombre || currentPerfil.escuela_cct || 'Mi escuela';
  }
  _topbarPro({ titleId:'subdir-title', prefix:'subdir', searchPlaceholder:'Buscar docente, alerta…' });
  // Resolver escuela_cct si falta, luego arrancar
  _subdirResolverEscuela().then(() => {
    subdirNav('dashboard');
    setTimeout(() => subdirCargarDashboard(), 600);
  });
}

// Resuelve escuela_cct desde escuela_id cuando llega null en el perfil
async function _subdirResolverEscuela() {
  if (!window.sb || !window.currentPerfil) return;
  const p = window.currentPerfil;
  // Si ya tiene CCT, nada que hacer
  if (p.escuela_cct) return;
  // Intentar obtener CCT desde escuela_id
  if (p.escuela_id) {
    try {
      const { data: esc } = await window.sb.from('escuelas')
        .select('cct, nombre').eq('id', p.escuela_id).maybeSingle();
      if (esc?.cct) {
        p.escuela_cct = esc.cct;
        window.currentPerfil = p;
        // Persistir en DB en background
        window.sb.from('usuarios').update({ escuela_cct: esc.cct })
          .eq('id', p.id).then(()=>{}).catch(()=>{});
        // Actualizar tag
        const topTag = document.getElementById('subdir-escuela-tag');
        if (topTag) topTag.textContent = esc.nombre || esc.cct;
        console.log('[subdir] escuela_cct resuelto:', esc.cct);
        return;
      }
    } catch(e) { console.warn('[subdir] resolver escuela:', e.message); }
  }
  // Fallback: buscar escuelas disponibles para este usuario
  try {
    const { data: ue } = await window.sb.from('usuario_escuelas')
      .select('escuela_cct, escuelas(cct, nombre)')
      .eq('usuario_id', p.id).eq('activo', true).limit(1).maybeSingle();
    if (ue?.escuela_cct) {
      p.escuela_cct = ue.escuela_cct;
      window.currentPerfil = p;
      window.sb.from('usuarios').update({ escuela_cct: ue.escuela_cct })
        .eq('id', p.id).then(()=>{}).catch(()=>{});
      console.log('[subdir] escuela_cct desde usuario_escuelas:', ue.escuela_cct);
    }
  } catch(e) { console.warn('[subdir] resolver escuela fallback:', e.message); }
}

// Carga datos reales de Supabase y genera IA insights para el subdirector
async function subdirCargarDashboard() {
  if (!sb || !currentPerfil?.escuela_cct) return;
  const cct = currentPerfil.escuela_cct;
  // Cargar prefectos reales desde Supabase
  await subdirCargarPrefectos();
  try {
    const [
      { count: totalAlumnos },
      { count: totalDocentes },
      { data: incidencias },
      { count: totalGrupos },
    ] = await Promise.all([
      sb.from('usuarios').select('id',{count:'exact',head:true}).eq('escuela_cct',cct).eq('rol','alumno').eq('activo',true),
      sb.from('usuarios').select('id',{count:'exact',head:true}).eq('escuela_cct',cct).in('rol',['docente','tutor']).eq('activo',true),
      sb.from('incidencias').select('id,estado,tipo').eq('escuela_cct',cct).eq('estado','abierta').limit(50),
      sb.from('grupos').select('id',{count:'exact',head:true}).eq('escuela_cct',cct),
    ]);

    // Actualizar stats cards (los divs ya existen en el HTML hardcodeado)
    const cards = document.querySelectorAll('#subdir-p-dashboard .subdir-page > div:first-child > div');
    if (cards[0]) cards[0].querySelector('div:first-child').textContent = totalAlumnos || '—';
    if (cards[1]) cards[1].querySelector('div:first-child').textContent = totalDocentes || '—';

    // Añadir panel IA si no existe aún
    const dash = document.getElementById('subdir-p-dashboard');
    if (dash && !document.getElementById('subdir-ia-insights')) {
      const urgentes = incidencias?.filter(i => i.estado === 'urgente' || i.tipo === 'conducta').length || 0;
      const iaDiv = document.createElement('div');
      iaDiv.id = 'subdir-ia-insights';
      iaDiv.style.cssText = 'background:linear-gradient(135deg,#1e3a5f,#1e40af);border-radius:14px;padding:18px;margin-top:20px;color:white;';
      iaDiv.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <div style="width:8px;height:8px;border-radius:50%;background:#93c5fd;animation:pulse 2s infinite;"></div>
          <span style="font-size:11px;font-weight:700;opacity:.7;text-transform:uppercase;letter-spacing:1px;">📊 Insights — Subdirección</span>
          <button onclick="subdirGenerarInsights()" style="margin-left:auto;padding:5px 12px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:white;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Sora',sans-serif;">✨ Actualizar</button>
        </div>
        <div id="subdir-ia-texto" style="font-size:13px;line-height:1.7;opacity:.9;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;animation:spin .8s linear infinite;"></span>
            Generando análisis ejecutivo…
          </div>
        </div>`;
      dash.appendChild(iaDiv);
      // Auto-generar
      subdirGenerarInsights(totalAlumnos, totalDocentes, incidencias?.length || 0, urgentes, totalGrupos);
    }
  } catch(e) { console.warn('[subdir]', e.message); }
}

async function subdirGenerarInsights(alumnos, docentes, incidencias, urgentes, grupos) {
  const el = document.getElementById('subdir-ia-texto');
  if (!el) return;
  if (!alumnos) {
    // Re-cargar datos si no se pasaron
    subdirCargarDashboard(); return;
  }
  const prompt = `Soy subdirector/a de una escuela de educación básica en México.
Datos actuales: ${alumnos} alumnos, ${docentes} docentes, ${grupos} grupos, ${incidencias} incidencias abiertas (${urgentes} urgentes).
Genera un análisis ejecutivo breve (3 puntos) con: 1 logro de la semana, 1 área de atención y 1 acción prioritaria para hoy.
Máximo 100 palabras. Lenguaje directivo, NEM.`;
  try {
    const texto = await callAI({ feature: 'director_reporte_global', prompt, system: _nemSys('TAREA: Reporte ejecutivo para director escolar. Perspectiva sistémica NEM. Identifica patrones de rezago, propone acciones institucionales concretas y priorizadas. Datos, no opiniones. Máximo 100 palabras en 3 puntos.') });
    el.innerHTML = texto.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
  } catch(e) {
    el.innerHTML = 'Sin conexión a IA. Verifica que tengas créditos en Anthropic.';
  }
}
window.subdirGenerarInsights = subdirGenerarInsights;

function subdirNav(page) {
  document.querySelectorAll('.subdir-page').forEach(p => p.style.display = 'none');
  const pg = document.getElementById('subdir-p-' + page);
  if (pg) pg.style.display = 'block';
  document.querySelectorAll('#subdir-portal .adm-nav').forEach(b => b.style.background = '');
  const btn = document.getElementById('sn-' + page);
  if (btn) btn.style.background = 'rgba(255,255,255,.1)';
  const titles = {
    dashboard:'Dashboard · Subdirección', docentes:'Docentes', prefectos:'Prefectos',
    pemc:'PEMC — Plan de Mejora Continua', boleta:'Boleta NEM',
    cte:'Consejo Técnico Escolar', calendario:'Calendario Escolar', reportes:'Reportes',
    'horarios-pub':'Horarios publicados',
    'asistencia-personal':'Asistencia del personal',
    'alertas-cruzadas':'Alertas del plantel',
    'control-escolar':'Control Escolar',
  };
  const t = document.getElementById('subdir-title');
  if (t) t.textContent = titles[page] || page;
  if (page === 'docentes')  subdirRenderDocentes();
  if (page === 'prefectos') subdirCargarYRenderPrefectos();
  if (page === 'boleta')    subdirBoletaInit();
  if (page === 'pemc')      { if(typeof nemPemcRender==='function') nemPemcRender(); if(typeof nemPemcCargar==='function') nemPemcCargar(); }
  if (page === 'horarios-pub') subdirCargarHorariosPublicados();
  if (page === 'asistencia-personal') subdirAsistenciaPersonalCargar();
  if (page === 'alertas-cruzadas')    subdirAlertasCargar();
  if (page === 'control-escolar')     subdirCtrlCargar();
}

const SUBDIR_DOCENTES = [
  
  { nombre:'Docente 1',  materia:'Español',     grupo:'6°A', turno:'Matutino', asist:'100%' },
  { nombre:'Docente 2',  materia:'Ciencias',    grupo:'6°A', turno:'Matutino', asist:'95%' },
  { nombre:'Docente 3',  materia:'Historia',    grupo:'6°A', turno:'Matutino', asist:'97%' },
  { nombre:'Docente 4',  materia:'Artes / Ed.F',grupo:'6°A', turno:'Matutino', asist:'96%' },
  { nombre:'Docente 5',  materia:'Inglés',      grupo:'6°A', turno:'Matutino', asist:'94%' },
];

async function subdirCargarHorariosPublicados() {
  const cct = window.currentPerfil?.escuela_cct;
  const sel = document.getElementById('subdir-horpub-grupo');
  if (!sel) return;
  sel.innerHTML = '<option value="">Cargando grupos…</option>';
  if (!window.sb || !cct) {
    // Intentar resolver CCT una vez más antes de rendirse
    await _subdirResolverEscuela();
    const cct2 = window.currentPerfil?.escuela_cct;
    if (!cct2) { sel.innerHTML = '<option value="">Sin conexión</option>'; return; }
  }
  try {
    const { data: gs } = await window.sb.from('grupos').select('id,nombre,grado,seccion').eq('escuela_cct',cct).eq('activo',true).order('grado');
    sel.innerHTML = '<option value="">Seleccionar grupo…</option>' + (gs||[]).map(g=>`<option value="${g.id}">${g.nombre||g.grado+'° '+g.seccion}</option>`).join('');
  } catch(e) { sel.innerHTML = '<option value="">Error</option>'; }
}
async function subdirVerHorarioGrupo(grupoId) {
  const el = document.getElementById('subdir-horpub-contenido');
  if (!el) return;
  if (!grupoId) { el.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">Selecciona un grupo</div>'; return; }
  el.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">Cargando…</div>';
  try {
    const { data: celdas } = await window.sb.from('horario_celdas').select('dia_semana,hora_idx,materia,docente_nombre').eq('grupo_id',grupoId).eq('activo',true).order('hora_idx');
    if (!celdas?.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;"><div style="font-size:36px;margin-bottom:10px;">📭</div><div>Este grupo aún no tiene horario publicado</div></div>'; return; }
    const dias=['Lunes','Martes','Miércoles','Jueves','Viernes'];
    const horas=[...new Set(celdas.map(c=>c.hora_idx))].sort((a,b)=>a-b);
    let html=`<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-family:'Sora',sans-serif;font-size:13px;"><thead><tr><th style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:700;color:#475569;">Hora</th>${dias.map(d=>`<th style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:700;color:#475569;">${d}</th>`).join('')}</tr></thead><tbody>`;
    horas.forEach(hi=>{html+=`<tr><td style="padding:9px 14px;border:1px solid #e2e8f0;font-weight:700;color:#64748b;background:#f8fafc;">${7+hi}:00</td>`;dias.forEach(dia=>{const c=celdas.find(x=>x.dia_semana===dia&&x.hora_idx===hi);html+=c?`<td style="padding:9px 14px;border:1px solid #e2e8f0;background:#f5f3ff;"><div style="font-weight:700;color:#5b21b6;">${c.materia||'—'}</div><div style="font-size:11px;color:#64748b;">${c.docente_nombre||''}</div></td>`:`<td style="padding:9px 14px;border:1px solid #e2e8f0;color:#cbd5e1;text-align:center;">—</td>`;});html+=`</tr>`;});
    html+='</tbody></table></div>';el.innerHTML=html;
  } catch(e) { el.innerHTML=`<div style="padding:20px;color:#dc2626;">Error: ${e.message}</div>`; }
}

async function subdirRenderDocentes() {
  const grid = document.getElementById('subdir-docentes-grid');
  if (!grid) return;
  const colors = ['#0d5c2f','#1e40af','#5b21b6','#c2410c','#a16207','#047857'];

  if (!window.sb || !window.currentPerfil?.escuela_cct) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:30px;text-align:center;color:#94a3b8;">Resolviendo escuela…</div>';
    await _subdirResolverEscuela();
  }
  const cct = window.currentPerfil?.escuela_cct;
  if (!cct) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:30px;text-align:center;color:#94a3b8;">Sin conexión a base de datos</div>';
    return;
  }
  grid.innerHTML = '<div style="grid-column:1/-1;padding:30px;text-align:center;color:#94a3b8;">Cargando docentes…</div>';
  try {
    // Query simple sin joins anidados para evitar cascada de RLS
    const { data, error } = await window.sb.from('usuarios')
      .select('id, nombre, apellido_p, rol, activo')
      .eq('escuela_cct', cct)
      .in('rol', ['docente','tutor','ts','prefecto','coordinador'])
      .eq('activo', true)
      .order('nombre');
    if (error) throw error;
    const lista = data || [];
    if (!lista.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:#94a3b8;"><div style="font-size:36px;margin-bottom:10px;">👩‍🏫</div><div style="font-size:14px;font-weight:700;color:#0f172a;">Aún no hay docentes registrados</div><div style="font-size:13px;margin-top:6px;">Registra al personal para construir cobertura, horarios y seguimiento académico.</div></div>';
      return;
    }

    // Query separada para grupos (evita join anidado lento)
    const ids = lista.map(d => d.id);
    const { data: dgData } = await window.sb.from('docente_grupos')
      .select('docente_id, grupos(nombre,grado,seccion)')
      .in('docente_id', ids);
    const dgMap = {};
    (dgData || []).forEach(dg => {
      if (!dgMap[dg.docente_id]) dgMap[dg.docente_id] = [];
      const g = dg.grupos;
      if (g) dgMap[dg.docente_id].push(g.nombre || `${g.grado}°${g.seccion||''}`);
    });

    const rolLabels = { docente:'Docente', tutor:'Tutor', ts:'Trab. Social', prefecto:'Prefecto', coordinador:'Coordinador' };
    grid.innerHTML = lista.map((d,i) => {
      const nom = `${d.nombre||''} ${d.apellido_p||''}`.trim();
      const ini = nom.split(' ').map(p=>p[0]||'').join('').slice(0,2).toUpperCase();
      const gruposArr = dgMap[d.id] || [];
      const gruposStr = gruposArr.length ? gruposArr.slice(0,3).join(', ') : '—';
      return `<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:16px 18px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:40px;height:40px;border-radius:50%;background:${colors[i%colors.length]};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;flex-shrink:0;">${ini}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nom}</div>
            <div style="font-size:11px;color:#64748b;">${rolLabels[d.rol]||d.rol} · ${gruposStr}</div>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;color:#dc2626;font-size:13px;">Error: ${e.message}</div>`;
  }
}

async function subdirCargarPrefectos() {
  const cct = window.currentPerfil?.escuela_cct;
  if (!window.sb || !cct) return;
  const { data } = await window.sb.from('usuarios')
    .select('id, nombre, apellido_p, apellido_m, email, telefono')
    .eq('escuela_cct', cct).eq('rol', 'prefecto').eq('activo', true);
  if (data) {
    window.SUBDIR_PREFECTOS = data.map(u => ({
      id: u.id,
      nombre: `${u.nombre||''} ${u.apellido_p||''} ${u.apellido_m||''}`.trim(),
      email: u.email || '',
      telefono: u.telefono || '',
      incidencias: 0,
    }));
  }
}
window.subdirCargarPrefectos = subdirCargarPrefectos;

async function subdirCargarYRenderPrefectos() {
  const grid = document.getElementById('subdir-prefectos-grid');
  if (grid) grid.innerHTML = '<div style="grid-column:1/-1;padding:30px;text-align:center;color:#94a3b8;">Cargando prefectos…</div>';
  await subdirCargarPrefectos();
  subdirRenderPrefectos();
}
window.subdirCargarYRenderPrefectos = subdirCargarYRenderPrefectos;

const SUBDIR_PREFECTOS = [
  { nombre:'Lic. Juan Medina',  turno:'Matutino',  grados:'1° y 2°', incidencias: 5 },
  { nombre:'Lic. María Ramos',  turno:'Matutino',  grados:'3°',      incidencias: 2 },
  { nombre:'Lic. Andrés Flores',turno:'Vespertino', grados:'Todos',   incidencias: 3 },
];

function subdirRenderPrefectos() {
  const grid = document.getElementById('subdir-prefectos-grid');
  if (!grid) return;
  const colors = ['#7c3aed','#0369a1','#c2410c','#059669','#d97706','#db2777'];
  const lista = (window.SUBDIR_PREFECTOS && window.SUBDIR_PREFECTOS.length) ? window.SUBDIR_PREFECTOS : SUBDIR_PREFECTOS;
  grid.innerHTML = lista.map((p,i) => `
    <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:18px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <div style="width:44px;height:44px;border-radius:50%;background:${colors[i%colors.length]};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:white;flex-shrink:0;">${p.nombre.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()}</div>
        <div><div style="font-size:13px;font-weight:700;">${p.nombre}</div><div style="font-size:11px;color:#64748b;">${p.email||p.grados||'—'}${p.turno?' · '+p.turno:''}</div></div>
      </div>
      ${p.telefono ? `<div style="font-size:12px;color:#64748b;margin-bottom:10px;">📞 ${p.telefono}</div>` : ''}
      <div style="font-size:12px;color:#64748b;margin-bottom:12px;">Incidencias este mes: <strong style="color:#c2410c;">${p.incidencias??'—'}</strong></div>
      <button onclick="subdirVerReportePrefecto('${p.nombre}')" style="width:100%;padding:7px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;color:#475569;cursor:pointer;">Ver reportes</button>
    </div>`).join('');
}

function subdirAgregarMeta() {
  hubModal('📋 Nueva meta PEMC',`
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Objetivo / meta</label>
        <input id="pemc-meta" type="text" placeholder="Describe la meta…" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Responsable</label>
        <input id="pemc-resp" type="text" placeholder="Nombre del responsable" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Fecha compromiso</label>
        <input id="pemc-fecha" type="date" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
    </div>`, 'Agregar', async () => {
    const meta = document.getElementById('pemc-meta')?.value?.trim();
    if (!meta) { hubToast('Escribe la meta','warn'); return; }
    const cct = _getCct();
    await window.sb?.from('pemc').insert({
      escuela_cct: cct, ciclo: window.CICLO_ACTIVO||'2025-2026',
      tipo: 'meta', contenido: meta,
      responsable: document.getElementById('pemc-resp')?.value||'',
      fecha_compromiso: document.getElementById('pemc-fecha')?.value||null,
      autor_id: window.currentPerfil?.id, created_at: new Date().toISOString()
    }).catch(()=>{});
    hubToast('✅ Meta PEMC agregada','ok');
  });
}

function subdirAgregarPuntoCTE() {
  hubModal('📋 Agregar punto CTE',`
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Punto del orden del día</label>
        <input id="cte-punto" type="text" placeholder="Describe el punto…" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Responsable</label>
        <input id="cte-resp" type="text" placeholder="Nombre del responsable" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Tipo</label>
        <select id="cte-tipo" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
          <option value="informativo">Informativo</option><option value="acuerdo">Acuerdo</option><option value="compromiso">Compromiso</option><option value="evaluacion">Evaluación</option>
        </select></div>
    </div>`, 'Agregar', async () => {
    const punto = document.getElementById('cte-punto')?.value?.trim();
    if (!punto) { hubToast('Escribe el punto','warn'); return; }
    const cct = _getCct();
    await window.sb?.from('pemc').insert({
      escuela_cct: cct, ciclo: window.CICLO_ACTIVO||'2025-2026',
      tipo: 'punto_cte', contenido: punto,
      responsable: document.getElementById('cte-resp')?.value||'',
      subtipo: document.getElementById('cte-tipo')?.value||'informativo',
      autor_id: window.currentPerfil?.id, created_at: new Date().toISOString()
    }).catch(()=>{});
    // También añadir en el textarea visible del acta
    const ta = document.querySelector('#subdir-p-cte textarea');
    if (ta) ta.value += (ta.value?'\n\n':'') + `• [${document.getElementById('cte-tipo')?.value||'Punto'}] ${punto} — Responsable: ${document.getElementById('cte-resp')?.value||'—'}`;
    hubToast('✅ Punto agregado al orden del día','ok');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTROL ESCOLAR — Director / Subdirector
// ══════════════════════════════════════════════════════════════════════════════

// localStorage helpers (shared key with admin module)
function _sdCtrlGetNotas() {
  try { return JSON.parse(localStorage.getItem('siembra_ctrl_notas') || '{}'); } catch{ return {}; }
}
function _sdCtrlGetNota(id) { return _sdCtrlGetNotas()[id] || {}; }
function _sdCtrlSetNota(id, patch) {
  const all = _sdCtrlGetNotas();
  all[id] = Object.assign(all[id] || {}, patch);
  localStorage.setItem('siembra_ctrl_notas', JSON.stringify(all));
}

// In-memory data for subdir ctrl
window._sdCtrlGrupos     = [];
window._sdCtrlAlumnos    = {};    // grupoId -> [alumno]
window._sdCtrlMovimientos = [];

function subdirCtrlTab(tab) {
  ['grupos','lista','ciclo'].forEach(t => {
    const btn   = document.getElementById('subdir-ctrl-tab-' + t);
    const panel = document.getElementById('subdir-ctrl-panel-' + t);
    const active = t === tab;
    if (btn) {
      btn.style.fontWeight    = active ? '700' : '600';
      btn.style.color         = active ? '#0d5c2f' : '#64748b';
      btn.style.borderBottom  = active ? '2px solid #0d5c2f' : '2px solid transparent';
      btn.style.marginBottom  = active ? '-2px' : '0';
    }
    if (panel) panel.style.display = active ? '' : 'none';
  });
  if (tab === 'ciclo') _sdCtrlRenderCiclo();
}
window.subdirCtrlTab = subdirCtrlTab;

async function subdirCtrlCargar() {
  const sbRef = window.sb;
  const cct   = window.currentPerfil?.escuela_cct;
  const ciclo = window.CICLO_ACTIVO || '2025-2026';
  const listEl = document.getElementById('subdir-ctrl-grupos-list');
  const ciclolabel = document.getElementById('subdir-ctrl-ciclo-label');
  if (ciclolabel) ciclolabel.textContent = ciclo;
  if (listEl) listEl.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Cargando…</div>';
  if (!sbRef || !cct) {
    if (listEl) listEl.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Sin conexión</div>';
    return;
  }
  try {
    // Cargar grupos
    const { data: grupos } = await sbRef.from('grupos')
      .select('id,nombre,grado,seccion,turno')
      .eq('escuela_cct', cct).eq('activo', true).order('grado').order('seccion');
    window._sdCtrlGrupos = grupos || [];

    // Cargar alumnos con su grupo activo
    const { data: rows } = await sbRef.from('usuarios')
      .select('id,nombre,apellido_p,apellido_m,curp,alumnos_grupos!inner(grupo_id,ciclo,activo,grupos(id,nombre,grado,seccion))')
      .eq('escuela_cct', cct).eq('rol', 'alumno')
      .eq('alumnos_grupos.activo', true)
      .eq('alumnos_grupos.ciclo', ciclo);
    const alumnosMap = {};
    (rows || []).forEach(u => {
      const ag = Array.isArray(u.alumnos_grupos) ? u.alumnos_grupos[0] : u.alumnos_grupos;
      const gid = ag?.grupo_id;
      if (!gid) return;
      if (!alumnosMap[gid]) alumnosMap[gid] = [];
      alumnosMap[gid].push({ id: u.id, nombre: `${u.nombre||''} ${u.apellido_p||''} ${u.apellido_m||''}`.trim(), curp: u.curp || '' });
    });
    window._sdCtrlAlumnos = alumnosMap;

    // Cargar movimientos
    const { data: movs } = await sbRef.from('control_escolar_movimientos')
      .select('*').eq('escuela_cct', cct).eq('ciclo', ciclo).order('created_at', { ascending: false }).limit(200);
    window._sdCtrlMovimientos = movs || [];

    _sdCtrlRenderKpis();
    _sdCtrlRenderGrupos();
    _sdCtrlRenderMovimientos();
    subdirCtrlTab('grupos');
  } catch(e) {
    console.warn('[subdirCtrl]', e.message);
    if (listEl) listEl.innerHTML = `<div style="padding:20px;color:#dc2626;font-size:13px;">Error: ${e.message}</div>`;
  }
}
window.subdirCtrlCargar = subdirCtrlCargar;

function _sdCtrlRenderKpis() {
  const el = document.getElementById('subdir-ctrl-kpis');
  if (!el) return;
  const notas  = _sdCtrlGetNotas();
  let total = 0, criticos = 0, destacados = 0, bajas = 0;
  Object.values(window._sdCtrlAlumnos).forEach(arr => { total += arr.length; });
  Object.values(notas).forEach(n => {
    if (n.etiqueta === 'critico')   criticos++;
    if (n.etiqueta === 'destacado') destacados++;
  });
  bajas = (window._sdCtrlMovimientos || []).filter(m => m.tipo === 'baja').length;
  const grupos = window._sdCtrlGrupos?.length || 0;
  const kpis = [
    { label:'Inscritos',   val: total,     color:'#0d5c2f', bg:'#dcfce7' },
    { label:'Grupos',      val: grupos,    color:'#1e40af', bg:'#dbeafe' },
    { label:'Críticos',    val: criticos,  color:'#b45309', bg:'#fef3c7' },
    { label:'Destacados',  val: destacados,color:'#6d28d9', bg:'#ede9fe' },
    { label:'Bajas ciclo', val: bajas,     color:'#b91c1c', bg:'#fee2e2' },
  ];
  el.innerHTML = kpis.map(k => `
    <div style="background:${k.bg};border-radius:12px;padding:14px 16px;">
      <div style="font-size:22px;font-weight:800;color:${k.color};">${k.val}</div>
      <div style="font-size:11px;font-weight:700;color:${k.color};opacity:.75;margin-top:2px;">${k.label}</div>
    </div>`).join('');
}

function _sdCtrlRenderGrupos() {
  const el = document.getElementById('subdir-ctrl-grupos-list');
  if (!el) return;
  const buscar  = (document.getElementById('subdir-ctrl-buscar')?.value || '').toLowerCase();
  const filtGrado = document.getElementById('subdir-ctrl-filtro-grado')?.value || '';
  const filtEtiq  = document.getElementById('subdir-ctrl-filtro-etiqueta')?.value || '';
  const notas = _sdCtrlGetNotas();

  const grupos = (window._sdCtrlGrupos || []).filter(g => !filtGrado || String(g.grado) === filtGrado);
  if (!grupos.length) {
    el.innerHTML = '<div style="padding:60px;text-align:center;color:#94a3b8;"><div style="font-size:36px;margin-bottom:8px;">📭</div><div>No hay grupos para este ciclo</div></div>';
    return;
  }

  el.innerHTML = grupos.map(g => {
    let alumnos = (window._sdCtrlAlumnos[g.id] || [])
      .filter(a => !buscar || a.nombre.toLowerCase().includes(buscar) || a.curp.toLowerCase().includes(buscar))
      .filter(a => !filtEtiq || (notas[a.id]?.etiqueta || 'normal') === filtEtiq);

    const etiqBadge = (a) => {
      const et = notas[a.id]?.etiqueta || 'normal';
      const map = { critico:['#fef3c7','#b45309','Crítico'], destacado:['#ede9fe','#6d28d9','Destacado'], normal:['#f1f5f9','#64748b',''] };
      const [bg,col,label] = map[et] || map.normal;
      return label ? `<span style="background:${bg};color:${col};font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;">${label}</span>` : '';
    };

    const grupoNombre = g.nombre || `${g.grado}° ${g.seccion || ''}`.trim();
    const id = `sdctrl-g-${g.id}`;
    return `
      <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:12px;">
        <div onclick="admToggleCampo('${id}')" style="display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer;user-select:none;">
          <div style="width:36px;height:36px;background:linear-gradient(135deg,#1e3a5f,#2455a4);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;flex-shrink:0;">${g.grado}°</div>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${grupoNombre}</div>
            <div style="font-size:12px;color:#64748b;">${alumnos.length} alumnos</div>
          </div>
          <span id="${id}-icon" style="color:#94a3b8;font-size:12px;">▼</span>
        </div>
        <div id="${id}" style="display:none;border-top:1px solid #f1f5f9;padding:10px 14px 14px;">
          ${alumnos.length === 0
            ? '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">Sin alumnos en este grupo</div>'
            : alumnos.map(a => {
                const nota = notas[a.id] || {};
                return `
                <div style="display:flex;align-items:center;gap:8px;padding:9px 8px;border-radius:8px;margin-bottom:4px;background:#fafafa;">
                  <div style="width:30px;height:30px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#475569;flex-shrink:0;">${(a.nombre[0]||'?').toUpperCase()}</div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.nombre} ${etiqBadge(a)}</div>
                    ${nota.comentario ? `<div style="font-size:11px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nota.comentario}</div>` : ''}
                  </div>
                  <button onclick="subdirCtrlEditarNota('${a.id}','${a.nombre.replace(/'/g,'\\\'')}')" style="padding:4px 9px;background:#f1f5f9;border:1.5px solid #e2e8f0;border-radius:7px;font-family:'Sora',sans-serif;font-size:10px;font-weight:700;cursor:pointer;color:#475569;">✏️</button>
                  <button onclick="subdirCtrlBaja('${a.id}','${a.nombre.replace(/'/g,'\\\'')}')" style="padding:4px 9px;background:#fee2e2;border:1.5px solid #fca5a5;border-radius:7px;font-family:'Sora',sans-serif;font-size:10px;font-weight:700;cursor:pointer;color:#b91c1c;">Baja</button>
                </div>`;
              }).join('')
          }
        </div>
      </div>`;
  }).join('');
}
window._sdCtrlRenderGrupos = _sdCtrlRenderGrupos;

function subdirCtrlFiltrar() { _sdCtrlRenderGrupos(); }
window.subdirCtrlFiltrar = subdirCtrlFiltrar;

function subdirCtrlEditarNota(alumnoId, nombre) {
  const nota = _sdCtrlGetNota(alumnoId);
  hubModal(`✏️ Nota — ${nombre}`, `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;">Etiqueta</div>
        <div style="display:flex;gap:8px;">
          ${['normal','critico','destacado'].map(e => `
            <label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;border:2px solid ${nota.etiqueta===e||(!nota.etiqueta&&e==='normal')?'#0d5c2f':'#e2e8f0'};border-radius:9px;cursor:pointer;font-size:12px;font-weight:700;">
              <input type="radio" name="sd-ctrl-etiq" value="${e}" ${nota.etiqueta===e||(!nota.etiqueta&&e==='normal')?'checked':''} style="accent-color:#0d5c2f;">
              ${e==='normal'?'Normal':e==='critico'?'Crítico':'Destacado'}
            </label>`).join('')}
        </div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:4px;">Comentario</div>
        <textarea id="sd-ctrl-comentario" rows="3" placeholder="Observaciones del ciclo…" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;resize:vertical;box-sizing:border-box;">${nota.comentario||''}</textarea>
      </div>
    </div>`, 'Guardar', () => {
    const etiqueta  = document.querySelector('input[name="sd-ctrl-etiq"]:checked')?.value || 'normal';
    const comentario = document.getElementById('sd-ctrl-comentario')?.value?.trim() || '';
    _sdCtrlSetNota(alumnoId, { etiqueta, comentario });
    _sdCtrlRenderGrupos();
    _sdCtrlRenderKpis();
    hubToast('✅ Nota guardada','ok');
  });
}
window.subdirCtrlEditarNota = subdirCtrlEditarNota;

function subdirCtrlBaja(alumnoId, nombre) {
  hubModal(`🚫 Dar de baja — ${nombre}`, `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:9px;padding:12px;font-size:13px;color:#b91c1c;">
        Esta acción desactivará al alumno del grupo en el ciclo actual. Los datos se conservan.
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:4px;">Motivo</div>
        <select id="sd-ctrl-baja-motivo" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;background:white;box-sizing:border-box;">
          <option value="traslado_escuela">Traslado a otra escuela</option>
          <option value="abandono">Abandono escolar</option>
          <option value="cambio_ciclo">Cambio de ciclo/nivel</option>
          <option value="otro">Otro</option>
        </select>
      </div>
    </div>`, 'Confirmar baja', async () => {
    const motivo = document.getElementById('sd-ctrl-baja-motivo')?.value || 'otro';
    const cct    = window.currentPerfil?.escuela_cct;
    const ciclo  = window.CICLO_ACTIVO || '2025-2026';
    try {
      await window.sb?.from('alumnos_grupos')
        .update({ activo: false })
        .eq('usuario_id', alumnoId)
        .eq('ciclo', ciclo)
        .catch(()=>{});
      await window.sb?.from('control_escolar_movimientos')
        .insert({ escuela_cct: cct, ciclo, alumno_id: alumnoId, tipo: 'baja', detalle: motivo, created_at: new Date().toISOString() })
        .catch(()=>{});
    } catch(e) { console.warn(e); }
    hubToast('✅ Alumno dado de baja','ok');
    subdirCtrlCargar();
  });
}
window.subdirCtrlBaja = subdirCtrlBaja;

function _sdCtrlRenderMovimientos() {
  const tbody = document.getElementById('subdir-ctrl-tabla-body');
  if (!tbody) return;
  const movs = window._sdCtrlMovimientos || [];
  if (!movs.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:40px;text-align:center;color:#94a3b8;">Sin movimientos registrados en este ciclo</td></tr>';
    return;
  }
  const tipoMap = { baja:'🚫 Baja', traslado:'🔄 Traslado', inscripcion:'✅ Inscripción', egreso:'🎓 Egreso' };
  tbody.innerHTML = movs.map(m => {
    const fecha = m.created_at ? new Date(m.created_at).toLocaleDateString('es-MX') : '—';
    return `<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:11px 16px;font-size:13px;font-weight:600;">${m.alumno_nombre || m.alumno_id || '—'}</td>
      <td style="padding:11px 16px;font-size:13px;">${tipoMap[m.tipo] || m.tipo}</td>
      <td style="padding:11px 16px;font-size:13px;color:#64748b;">${m.grupo_origen || '—'}</td>
      <td style="padding:11px 16px;font-size:12px;color:#64748b;">${m.detalle || '—'}</td>
      <td style="padding:11px 16px;font-size:12px;color:#94a3b8;">${fecha}</td>
    </tr>`;
  }).join('');
}

function _sdCtrlRenderCiclo() {
  const el = document.getElementById('subdir-ctrl-ciclo-panel');
  if (!el) return;
  const cicloActual = window.CICLO_ACTIVO || '2025-2026';
  const [a1, a2] = cicloActual.split('-').map(Number);
  const cicloSiguiente = `${a1+1}-${a2+1}`;

  let totalAlumnos = 0, egresados = 0;
  const maxGrado = 6; // primaria; para secundaria sería 3
  (window._sdCtrlGrupos || []).forEach(g => {
    const alumnos = window._sdCtrlAlumnos[g.id] || [];
    totalAlumnos += alumnos.length;
    if (parseInt(g.grado) >= maxGrado) egresados += alumnos.length;
  });
  const avanzan = totalAlumnos - egresados;

  el.innerHTML = `
    <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:20px;margin-bottom:16px;">
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px;">Avance al ciclo ${cicloSiguiente}</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:16px;">Esta operación avanzará a todos los alumnos activos al grado siguiente.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:18px;">
        <div style="background:#dcfce7;border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#0d5c2f;">${totalAlumnos}</div>
          <div style="font-size:11px;color:#0d5c2f;font-weight:700;">Total inscritos</div>
        </div>
        <div style="background:#dbeafe;border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#1e40af;">${avanzan}</div>
          <div style="font-size:11px;color:#1e40af;font-weight:700;">Avanzan de grado</div>
        </div>
        <div style="background:#fef3c7;border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#b45309;">${egresados}</div>
          <div style="font-size:11px;color:#b45309;font-weight:700;">Egresan (${maxGrado}°)</div>
        </div>
      </div>
      <div style="background:#fef9e7;border:1px solid #fde68a;border-radius:9px;padding:12px;font-size:12px;color:#b45309;margin-bottom:14px;">
        ⚠️ Esta acción es irreversible. Los alumnos de ${maxGrado}° serán marcados como egresados. Los demás avanzarán un grado.
      </div>
      <button onclick="subdirCtrlEjecutarTraslado('${cicloActual}','${cicloSiguiente}')" style="padding:11px 22px;background:#0d5c2f;color:white;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">🎓 Ejecutar traslado al ciclo ${cicloSiguiente}</button>
    </div>`;
}

async function subdirCtrlEjecutarTraslado(cicloActual, cicloSiguiente) {
  if (!confirm(`¿Confirmas el traslado al ciclo ${cicloSiguiente}? Esta acción no se puede deshacer.`)) return;
  const cct = window.currentPerfil?.escuela_cct;
  if (!cct || !window.sb) { hubToast('Sin conexión','error'); return; }
  hubToast('Procesando traslado…','info');
  try {
    const maxGrado = 6;
    for (const g of (window._sdCtrlGrupos || [])) {
      const alumnos = window._sdCtrlAlumnos[g.id] || [];
      const grado   = parseInt(g.grado);
      for (const a of alumnos) {
        if (grado >= maxGrado) {
          // Egresar
          await window.sb.from('alumnos_grupos').update({ activo: false }).eq('usuario_id', a.id).eq('ciclo', cicloActual).catch(()=>{});
          await window.sb.from('control_escolar_movimientos').insert({ escuela_cct: cct, ciclo: cicloActual, alumno_id: a.id, tipo: 'egreso', detalle: `Egresado a ciclo ${cicloSiguiente}`, created_at: new Date().toISOString() }).catch(()=>{});
        } else {
          // Avanzar grado — actualizar ciclo en alumnos_grupos
          await window.sb.from('alumnos_grupos').update({ ciclo: cicloSiguiente }).eq('usuario_id', a.id).eq('ciclo', cicloActual).catch(()=>{});
        }
      }
    }
    window.CICLO_ACTIVO = cicloSiguiente;
    hubToast(`✅ Traslado al ciclo ${cicloSiguiente} completado`,'ok');
    subdirCtrlCargar();
  } catch(e) {
    hubToast('Error en traslado: ' + e.message, 'error');
  }
}
window.subdirCtrlEjecutarTraslado = subdirCtrlEjecutarTraslado;

function subdirCtrlNuevaInscripcion() {
  hubModal('✅ Nueva inscripción', `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:9px;padding:12px;font-size:13px;color:#0d5c2f;">
        Para registrar nuevos alumnos, usa el módulo <strong>Alumnos</strong> en el portal de administración y asígnalos a un grupo.
      </div>
    </div>`, 'Entendido', ()=>{});
}
window.subdirCtrlNuevaInscripcion = subdirCtrlNuevaInscripcion;
