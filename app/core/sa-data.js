// ── CARGA DE DATOS ──
function saClaveEscuela(escuela = {}) {
  return String(escuela.id || escuela.cct || '').trim();
}

function saUsuarioPerteneceAEscuela(usuario = {}, escuela = {}) {
  const escId = String(escuela.id || '').trim();
  const escCct = String(escuela.cct || '').trim();
  const usrId = String(usuario.escuela_id || '').trim();
  const usrCct = String(usuario.escuela_cct || '').trim();
  return !!((escId && usrId === escId) || (escCct && usrCct === escCct));
}

function saMetricasEscuela(escuela = {}) {
  return escuelasMetricas[saClaveEscuela(escuela)] || { alumnos:0, docentes:0, grupos:0, usuarios:0 };
}

async function cargarTodo() {
  await cargarEscuelas();
  await Promise.all([cargarUsuarios(), cargarInvitaciones(), cargarMetricasEscuelas()]);
  poblarSelectores();
  renderDashboard();
}

async function cargarEscuelas() {
  if (!sb) { 
    escuelasData = [];
    renderTablaEscuelas([]);
    return; 
  }
  try {
    const { data, error } = await sb.from('escuelas').select('id, cct, nombre, nivel, municipio, estado, zona_escolar, turno, ciclo_actual, activa, creado_en').order('creado_en', { ascending: false });
    if (error) throw error;
    escuelasData = data || [];
    renderTablaEscuelas(escuelasData);
  } catch(e) {
    console.warn('[SA] escuelas:', e.message);
    escuelasData = [];
    renderTablaEscuelas([]);
  }
}

async function cargarUsuarios() {
  if (!sb) { usuariosData = []; renderTablaUsuarios([]); return; }
  try {
    const { data, error } = await sb.from('usuarios')
      .select('id, nombre, apellido_p, email, rol, activo, escuela_id, escuela_cct, updated_at')
      .neq('rol', 'superadmin')
      .order('updated_at', { ascending: false })
      .limit(500);
    if (error) throw error;

    // Enriquecer con nombre de escuela desde escuelasData
    usuariosData = (data || []).map(u => {
      const esc = escuelasData.find(e => e.id === u.escuela_id || e.cct === u.escuela_cct);
      return { ...u, created_at: u.updated_at, escuelas: esc ? { nombre: esc.nombre } : null };
    });
    renderTablaUsuarios(usuariosData);
  } catch(e) {
    console.warn('[SA] usuarios:', e.message);
    usuariosData = [];
    renderTablaUsuarios([]);
  }
}

async function cargarMetricasEscuelas() {
  if (!sb) { escuelasMetricas = {}; return; }
  try {
    const [usuariosRes, alumnosRes, gruposRes] = await Promise.all([
      sb.from('usuarios').select('id, rol, activo, escuela_id, escuela_cct').neq('rol', 'superadmin').eq('activo', true).limit(5000),
      sb.from('alumnos').select('id, curp, nombre, activo, escuela_cct').eq('activo', true).limit(5000),
      sb.from('grupos').select('id, activo, escuela_cct').eq('activo', true).limit(5000),
    ]);

    const usuariosActivos = usuariosRes.data || [];
    const alumnosTabla = alumnosRes.data || [];
    const gruposActivos = gruposRes.data || [];
    const metricas = {};

    escuelasData.forEach(esc => {
      const key = saClaveEscuela(esc);
      const usuariosEsc = usuariosActivos.filter(u => saUsuarioPerteneceAEscuela(u, esc));
      const docentesEsc = usuariosEsc.filter(u => ['docente','tutor','coordinador','ts','prefecto','subdirector','director','admin'].includes(u.rol));
      const alumnosUsuariosEsc = usuariosEsc.filter(u => u.rol === 'alumno');
      const alumnosTablaEsc = alumnosTabla.filter(a => String(a.escuela_cct || '').trim() === String(esc.cct || '').trim());
      const gruposEsc = gruposActivos.filter(g => String(g.escuela_cct || '').trim() === String(esc.cct || '').trim());
      const alumnosUnicos = new Set();
      alumnosUsuariosEsc.forEach(a => alumnosUnicos.add('u:' + String(a.id || '').trim()));
      alumnosTablaEsc.forEach(a => alumnosUnicos.add('a:' + String(a.curp || a.id || a.nombre || '').trim()));
      metricas[key] = {
        usuarios: usuariosEsc.length,
        docentes: docentesEsc.length,
        alumnos: alumnosUnicos.size,
        grupos: gruposEsc.length,
      };
    });

    escuelasMetricas = metricas;
    escuelasData = escuelasData.map(e => {
      const met = metricas[saClaveEscuela(e)] || {};
      return {
        ...e,
        total_usuarios: met.usuarios ?? e.total_usuarios ?? 0,
        total_alumnos: met.alumnos ?? e.total_alumnos ?? 0,
        total_docentes: met.docentes ?? e.total_docentes ?? 0,
        total_grupos: met.grupos ?? e.total_grupos ?? 0,
        stats_usuarios: met.usuarios ?? e.stats_usuarios ?? 0,
        stats_alumnos: met.alumnos ?? e.stats_alumnos ?? 0,
        stats_docentes: met.docentes ?? e.stats_docentes ?? 0,
        stats_grupos: met.grupos ?? e.stats_grupos ?? 0,
      };
    });

    for (const esc of escuelasData) {
      const met = metricas[saClaveEscuela(esc)];
      if (!esc?.id || !met) continue;
      try {
        await sb.from('escuelas').update({
          total_usuarios: met.usuarios,
          total_alumnos: met.alumnos,
          total_docentes: met.docentes,
          total_grupos: met.grupos,
        }).eq('id', esc.id);
      } catch(e1) {
        try {
          await sb.from('escuelas').update({
            stats_usuarios: met.usuarios,
            stats_alumnos: met.alumnos,
            stats_docentes: met.docentes,
            stats_grupos: met.grupos,
          }).eq('id', esc.id);
        } catch(e2) {
          // Si la tabla aún no tiene columnas de resumen, seguir sin romper el dashboard.
        }
      }
    }
  } catch(e) {
    console.warn('[SA] metricas escuelas:', e.message);
    escuelasMetricas = {};
  }
}

async function cargarInvitaciones() {
  if (!sb) { invitacionesData = []; return; }
  try {
    const { data, error } = await sb.from('invitaciones')
      .select('*, escuelas(nombre)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    invitacionesData = data || [];
  } catch(e) {
    console.warn('[SA] invitaciones:', e.message);
    invitacionesData = [];
  }
}

// ── RENDER DASHBOARD ──
function renderDashboard() {
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const total      = escuelasData.length;
  const activas    = escuelasData.filter(e => e.activa !== false).length;
  const totalUsr   = escuelasData.reduce((acc, e) => acc + saMetricasEscuela(e).usuarios, 0);
  const alumnos    = escuelasData.reduce((acc, e) => acc + saMetricasEscuela(e).alumnos, 0);
  const docentes   = escuelasData.reduce((acc, e) => acc + saMetricasEscuela(e).docentes, 0);
  const invPend    = invitacionesData.filter(i => i.estado === 'pendiente').length;

  s('stat-escuelas', total);
  s('stat-escuelas-d', `${activas} activas`);
  s('stat-usuarios', totalUsr.toLocaleString());
  s('stat-alumnos', alumnos.toLocaleString());
  s('stat-docentes', docentes.toLocaleString());
  s('stat-invites', invPend);

  // Evidencias hoy (intentar)
  s('stat-evidencias', '—');
  if (sb) {
    const hoy = new Date().toISOString().split('T')[0];
    sb.from('evidencias').select('id', { count: 'exact', head: true })
      .gte('created_at', hoy)
      .then(({ count }) => { if (count !== null) s('stat-evidencias', count); });
  }

  // Nav badges
  const cntEsc = document.getElementById('nav-cnt-escuelas');
  if (cntEsc) cntEsc.textContent = total;
  const cntInv = document.getElementById('nav-cnt-inv');
  if (cntInv) {
    cntInv.textContent = invPend;
    cntInv.style.display = invPend > 0 ? 'inline-block' : 'none';
  }

  // Lista escuelas en dashboard
  const listaEl = document.getElementById('dash-escuelas-lista');
  if (listaEl) {
    listaEl.innerHTML = escuelasData.slice(0, 8).map(e => {
      const activo = e.activa !== false;
      const met = saMetricasEscuela(e);
      const pct    = 0;
      return `<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--border);">
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:500;">${e.nombre || e.cct}</div>
          <div style="font-family:var(--mono);font-size:11px;color:var(--text3);">${e.cct || '-'} - ${e.municipio || '-'}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:4px;">${met.alumnos} alumnos - ${met.docentes} docentes - ${met.grupos} grupos</div>
          <div class="meter"><div class="meter-fill" style="width:${pct}%;background:${pct>80?'var(--amber)':'var(--green)'};"></div></div>
        </div>
        <span class="badge ${activo ? 'badge-green' : 'badge-gray'}">
          <span class="badge-dot2"></span>${activo ? 'activa' : 'inactiva'}
        </span>
      </div>`;
    }).join('') || '<div style="color:var(--text3);font-size:13px;">Sin escuelas aun</div>';
  }

  // Actividad reciente
  const actEl = document.getElementById('dash-actividad');
  if (actEl) {
    const eventos = [
      ...escuelasData.slice(0,3).map(e => ({
        tipo:'green', texto:`Escuela <strong>${e.nombre||e.cct}</strong> registrada`,
        tiempo: e.creado_en ? new Date(e.creado_en).toLocaleDateString('es-MX') : 'Reciente'
      })),
      ...invitacionesData.slice(0,3).map(i => ({
        tipo:'amber', texto:`Invitacion para rol <strong>${i.rol}</strong> generada`,
        tiempo: i.created_at ? new Date(i.created_at).toLocaleDateString('es-MX') : 'Reciente'
      })),
    ].slice(0,6);
    actEl.innerHTML = eventos.length ? eventos.map(ev => `
      <div class="activity-item">
        <div class="activity-dot ${ev.tipo}"></div>
        <div>
          <div class="activity-text">${ev.texto}</div>
          <div class="activity-time">${ev.tiempo}</div>
        </div>
      </div>`).join('') :
      '<div style="color:var(--text3);font-size:13px;">Sin actividad registrada aun</div>';
  }
}