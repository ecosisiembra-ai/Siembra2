// ══ SUBDIRECTOR PORTAL ═══════════════════════════════════════════════════
function subdirInit() {
  if (currentPerfil) {
    const n = document.getElementById('subdir-nombre');
    if (n) n.textContent = currentPerfil.nombre || 'Subdirector/a';
    const topTag = document.getElementById('subdir-escuela-tag');
    if (topTag) topTag.textContent = currentPerfil.escuela_nombre || currentPerfil.escuela_cct || 'Mi escuela';
  }
  _topbarPro({ titleId:'subdir-title', prefix:'subdir', searchPlaceholder:'Buscar docente, alerta…' });
  subdirNav('dashboard');
  // ── Cargar datos reales + IA al iniciar ──
  setTimeout(() => subdirCargarDashboard(), 600);
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
  };
  const t = document.getElementById('subdir-title');
  if (t) t.textContent = titles[page] || page;
  if (page === 'docentes')  subdirRenderDocentes();
  if (page === 'prefectos') subdirRenderPrefectos();
  if (page === 'boleta')    subdirBoletaInit();
  if (page === 'pemc')      { if(typeof nemPemcRender==='function') nemPemcRender(); if(typeof nemPemcCargar==='function') nemPemcCargar(); }
  if (page === 'horarios-pub') subdirCargarHorariosPublicados();
  if (page === 'asistencia-personal') subdirAsistenciaPersonalCargar();
  if (page === 'alertas-cruzadas')    subdirAlertasCargar();
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
  if (!window.sb || !cct) { sel.innerHTML = '<option value="">Sin conexión</option>'; return; }
  try {
    const { data: gs } = await window.sb.from('grupos').select('id,nombre,grado,grupo').eq('escuela_cct',cct).eq('activo',true).order('grado');
    sel.innerHTML = '<option value="">Seleccionar grupo…</option>' + (gs||[]).map(g=>`<option value="${g.id}">${g.nombre||g.grado+'° '+g.grupo}</option>`).join('');
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
  const cct = window.currentPerfil?.escuela_cct;
  const colors = ['#0d5c2f','#1e40af','#5b21b6','#c2410c','#a16207','#047857'];

  if (!window.sb || !cct) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:30px;text-align:center;color:#94a3b8;">Sin conexión a base de datos</div>';
    return;
  }
  grid.innerHTML = '<div style="grid-column:1/-1;padding:30px;text-align:center;color:#94a3b8;">Cargando docentes…</div>';
  try {
    const { data, error } = await window.sb.from('usuarios')
      .select('id, nombre, apellido_p, rol, activo, docente_grupos(grupos(nombre,grado,grupo))')
      .eq('escuela_cct', cct)
      .in('rol', ['docente','tutor','ts','prefecto','coordinador'])
      .eq('activo', true).order('nombre');
    if (error) throw error;
    const lista = data || [];
    if (!lista.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:#94a3b8;"><div style="font-size:36px;margin-bottom:10px;">👩‍🏫</div><div style="font-size:14px;font-weight:700;color:#0f172a;">Aún no hay docentes registrados</div><div style="font-size:13px;margin-top:6px;">Registra al personal para construir cobertura, horarios y seguimiento académico.</div></div>';
      return;
    }
    grid.innerHTML = lista.map((d,i) => {
      const nom = `${d.nombre||''} ${d.apellido_p||''}`.trim();
      const ini = nom.split(' ').map(p=>p[0]||'').join('').slice(0,2).toUpperCase();
      const gruposArr = (d.docente_grupos||[]).map(dg=>dg.grupos?.nombre||`${dg.grupos?.grado}°${dg.grupos?.grupo}`).filter(Boolean);
      const gruposStr = gruposArr.length ? gruposArr.slice(0,3).join(', ') : '—';
      return `<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:16px 18px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <div style="width:40px;height:40px;border-radius:50%;background:${colors[i%colors.length]};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;flex-shrink:0;">${ini}</div>
          <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nom}</div><div style="font-size:11px;color:#64748b;">${d.rol} · Grupos: ${gruposStr}</div></div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;color:#dc2626;font-size:13px;">Error: ${e.message}</div>`;
  }
}

async function subdirCargarPrefectos() {
  const cct = _getCct();
  if (!window.sb || !cct) return;
  const { data } = await window.sb.from('usuarios')
    .select('id, nombre, apellido_p, apellido_m, email, telefono')
    .eq('escuela_cct', cct).eq('rol', 'prefecto').eq('activo', true);
  if (data && data.length) {
    window.SUBDIR_PREFECTOS = data.map(u => ({
      id: u.id,
      nombre: `${u.nombre||''} ${u.apellido_p||''} ${u.apellido_m||''}`.trim(),
      email: u.email || '',
      telefono: u.telefono || '',
    }));
  }
}
window.subdirCargarPrefectos = subdirCargarPrefectos;

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
