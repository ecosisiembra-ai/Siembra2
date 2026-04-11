// ── CARGA DE DATOS ──

// ── Cache de métricas — evita re-fetches en cada visita al dashboard ──
const _saCache = { metricas: null, ts: 0 };
const _SA_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function saClaveEscuela(escuela = {}) {
  return String(escuela.cct || escuela.id || '').trim();
}

function saMetricasEscuela(escuela = {}) {
  const cct = String(escuela.cct || '').trim();
  return escuelasMetricas[cct] || { alumnos:0, docentes:0, grupos:0, usuarios:0 };
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
    const { data, error } = await sb.from('escuelas')
      .select('id, cct, nombre, nivel, municipio, estado, zona_escolar, turno, ciclo_actual, activa, created_at')
      .order('created_at', { ascending: false });
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

    // Enriquecer con nombre de escuela desde escuelasData (sin join a BD)
    usuariosData = (data || []).map(u => {
      const esc = escuelasData.find(e => e.cct === u.escuela_cct || e.id === u.escuela_id);
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

  // Usar cache si tiene menos de 5 minutos
  const ahora = Date.now();
  if (_saCache.metricas && (ahora - _saCache.ts) < _SA_CACHE_TTL) {
    escuelasMetricas = _saCache.metricas;
    _aplicarMetricasAEscuelas();
    console.log('[SA] métricas desde cache');
    return;
  }

  try {
    // ── Intentar RPC agregada (mucho más eficiente — conteos en servidor) ──
    const { data: rpcData, error: rpcErr } = await sb.rpc('sa_metricas_escuelas');

    if (!rpcErr && rpcData) {
      // La RPC devuelve filas separadas para usuarios y grupos (UNION ALL)
      // Consolidar por escuela_cct
      const metricas = {};
      for (const row of rpcData) {
        const cct = String(row.escuela_cct || '').trim();
        if (!cct) continue;
        if (!metricas[cct]) metricas[cct] = { alumnos: 0, docentes: 0, usuarios: 0, grupos: 0 };
        metricas[cct].alumnos  += Number(row.total_alumnos  || 0);
        metricas[cct].docentes += Number(row.total_docentes || 0);
        metricas[cct].usuarios += Number(row.total_usuarios || 0);
        metricas[cct].grupos   += Number(row.total_grupos   || 0);
      }
      escuelasMetricas = metricas;
      _saCache.metricas = metricas;
      _saCache.ts = ahora;
      _aplicarMetricasAEscuelas();
      console.log('[SA] métricas via RPC:', Object.keys(metricas).length, 'escuelas');
      return;
    }

    // ── Fallback: fetch directo si RPC no existe aún ──
    console.warn('[SA] RPC sa_metricas_escuelas no disponible, usando fallback:', rpcErr?.message);
    await _cargarMetricasFallback(ahora);

  } catch(e) {
    console.warn('[SA] cargarMetricasEscuelas:', e.message);
    await _cargarMetricasFallback(ahora);
  }
}

// Fallback: fetch directo (menos eficiente — solo hasta que se ejecute functions.sql)
async function _cargarMetricasFallback(ts) {
  try {
    const [usuariosRes, gruposRes] = await Promise.all([
      sb.from('usuarios').select('rol, escuela_cct, escuela_id').neq('rol', 'superadmin').eq('activo', true).limit(5000),
      sb.from('grupos').select('escuela_cct').eq('activo', true).limit(5000),
    ]);

    const usuariosActivos = usuariosRes.data || [];
    const gruposActivos = gruposRes.data || [];
    const metricas = {};

    const ROLES_DOCENTE = new Set(['docente','tutor','coordinador','ts','prefecto','subdirector','director','admin']);

    escuelasData.forEach(esc => {
      const cct = String(esc.cct || '').trim();
      if (!cct) return;
      const usrsEsc = usuariosActivos.filter(u =>
        String(u.escuela_cct || '').trim() === cct || String(u.escuela_id || '').trim() === esc.id
      );
      metricas[cct] = {
        usuarios: usrsEsc.length,
        docentes: usrsEsc.filter(u => ROLES_DOCENTE.has(u.rol)).length,
        alumnos:  usrsEsc.filter(u => u.rol === 'alumno').length,
        grupos:   gruposActivos.filter(g => String(g.escuela_cct || '').trim() === cct).length,
      };
    });

    escuelasMetricas = metricas;
    _saCache.metricas = metricas;
    _saCache.ts = ts;
    _aplicarMetricasAEscuelas();
    console.log('[SA] métricas via fallback:', Object.keys(metricas).length, 'escuelas');
  } catch(e) {
    console.warn('[SA] _cargarMetricasFallback:', e.message);
    escuelasMetricas = {};
  }
}

function _aplicarMetricasAEscuelas() {
  escuelasData = escuelasData.map(e => {
    const met = saMetricasEscuela(e);
    return {
      ...e,
      total_usuarios: met.usuarios,
      total_alumnos:  met.alumnos,
      total_docentes: met.docentes,
      total_grupos:   met.grupos,
    };
  });
}

// Invalidar cache manualmente (llamar cuando se crea/elimina usuario/grupo)
function saInvalidarCache() {
  _saCache.metricas = null;
  _saCache.ts = 0;
}
window.saInvalidarCache = saInvalidarCache;

async function cargarInvitaciones() {
  if (!sb) { invitacionesData = []; return; }
  try {
    // Sin join a escuelas — ya tenemos escuelasData en memoria
    const { data, error } = await sb.from('invitaciones')
      .select('id, rol, email_destino, escuela_id, escuela_cct, estado, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    // Enriquecer con nombre de escuela desde memoria
    invitacionesData = (data || []).map(inv => {
      const esc = escuelasData.find(e => e.id === inv.escuela_id || e.cct === inv.escuela_cct);
      return { ...inv, escuelas: esc ? { nombre: esc.nombre } : null };
    });
  } catch(e) {
    console.warn('[SA] invitaciones:', e.message);
    invitacionesData = [];
  }
}

// ── RENDER DASHBOARD ──
function renderDashboard() {
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const total   = escuelasData.length;
  const activas = escuelasData.filter(e => e.activa !== false).length;
  const totalUsr  = escuelasData.reduce((acc, e) => acc + saMetricasEscuela(e).usuarios, 0);
  const alumnos   = escuelasData.reduce((acc, e) => acc + saMetricasEscuela(e).alumnos, 0);
  const docentes  = escuelasData.reduce((acc, e) => acc + saMetricasEscuela(e).docentes, 0);
  const invPend   = invitacionesData.filter(i => i.estado === 'pendiente').length;

  s('stat-escuelas', total);
  s('stat-escuelas-d', `${activas} activas`);
  s('stat-usuarios', totalUsr.toLocaleString());
  s('stat-alumnos', alumnos.toLocaleString());
  s('stat-docentes', docentes.toLocaleString());
  s('stat-invites', invPend);

  // Evidencias hoy — usar RPC si está disponible, evitar query ad-hoc
  s('stat-evidencias', '—');
  if (sb) {
    sb.rpc('sa_evidencias_hoy')
      .then(({ data, error }) => {
        if (!error && data != null) {
          s('stat-evidencias', Number(data).toLocaleString());
        } else {
          // Fallback
          const hoy = new Date().toISOString().split('T')[0];
          sb.from('evidencias').select('id', { count: 'exact', head: true })
            .gte('created_at', hoy)
            .then(({ count }) => { if (count != null) s('stat-evidencias', count); });
        }
      });
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
      return `<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--border);">
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:500;">${e.nombre || e.cct}</div>
          <div style="font-family:var(--mono);font-size:11px;color:var(--text3);">${e.cct || '-'} - ${e.municipio || '-'}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:4px;">${met.alumnos} alumnos · ${met.docentes} docentes · ${met.grupos} grupos</div>
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
        tiempo: e.created_at ? new Date(e.created_at).toLocaleDateString('es-MX') : 'Reciente'
      })),
      ...invitacionesData.slice(0,3).map(i => ({
        tipo:'amber', texto:`Invitación para rol <strong>${i.rol}</strong> generada`,
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