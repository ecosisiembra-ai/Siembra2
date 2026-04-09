// ── TABS DE ACTIVIDAD ──
function actTab(tab) {
  ['eventos','errores','salud'].forEach(t => {
    const btn = document.getElementById('act-tab-'+t);
    const pan = document.getElementById('act-panel-'+t);
    const active = t === tab;
    if (btn) {
      btn.style.background = active ? (t==='errores' ? 'var(--red-dim)' : t==='salud' ? 'var(--blue-dim)' : 'var(--green-dim)') : 'transparent';
      btn.style.color = active ? (t==='errores' ? '#fca5a5' : t==='salud' ? '#93c5fd' : 'var(--green)') : 'var(--text2)';
      btn.style.fontWeight = active ? '700' : '500';
    }
    if (pan) pan.style.display = active ? '' : 'none';
  });
  if (tab === 'errores') cargarErrores();
  if (tab === 'salud')   cargarSalud();
}

// ── CARGAR ERRORES ──
async function cargarErrores() {
  const tbody = document.getElementById('err-tbody');
  if (!tbody) return;

  let errores = [];
  if (sb) {
    try {
      const { data } = await sb.from('system_logs')
        .select('*, usuarios(nombre,email), escuelas(nombre)')
        .in('tipo', ['error','warning'])
        .order('created_at', { ascending: false })
        .limit(50);
      errores = data || [];
    } catch(e) { console.warn('Error cargando logs:', e.message); }
  }

  // Demo fallback
  if (!errores.length) {
    errores = [
      { id:'el1', tipo:'error', severidad:'high', mensaje:'Auth: token expirado al intentar login', portal:'docente', created_at:new Date(Date.now()-3600000).toISOString(), usuarios:{nombre:'Docente activo',email:'docente@edu.mx'}, escuelas:{nombre:'Escuela piloto'}, resuelto:false },
      { id:'el2', tipo:'warning', severidad:'medium', mensaje:'Evidencia rechazada: archivo excede 5MB', portal:'alumno', created_at:new Date(Date.now()-7200000).toISOString(), usuarios:{nombre:'Alumno activo',email:'alumno@escuela.edu'}, escuelas:{nombre:'Escuela piloto'}, resuelto:false },
      { id:'el3', tipo:'error', severidad:'low', mensaje:'Timeout al generar reporte IA (>30s)', portal:'docente', created_at:new Date(Date.now()-86400000).toISOString(), usuarios:{nombre:'Docente activo',email:'docente@sec.demo'}, escuelas:{nombre:'Escuela secundaria piloto'}, resuelto:true },
      { id:'el4', tipo:'warning', severidad:'medium', mensaje:'RLS: usuario intento acceder a datos de otra escuela', portal:'admin', created_at:new Date(Date.now()-86400000*2).toISOString(), usuarios:{nombre:'Anonimo',email:'-'}, escuelas:{nombre:'-'}, resuelto:false },
      { id:'el5', tipo:'error', severidad:'high', mensaje:'Edge Function invite-user: rate limit excedido', portal:'superadmin', created_at:new Date(Date.now()-86400000*3).toISOString(), usuarios:{nombre:'Admin',email:'admin@siembra.mx'}, escuelas:null, resuelto:true },
    ];
  }

  // Stats
  const hoy = new Date().toISOString().split('T')[0];
  const semanaAtras = new Date(Date.now()-7*86400000).toISOString();
  document.getElementById('err-stat-hoy').textContent = errores.filter(e => (e.created_at||'').startsWith(hoy)).length;
  document.getElementById('err-stat-semana').textContent = errores.filter(e => e.created_at >= semanaAtras).length;
  const emailsUnicos = new Set(errores.map(e => e.usuarios?.email).filter(Boolean));
  document.getElementById('err-stat-usuarios').textContent = emailsUnicos.size;

  // Render
  const sevBadge = { critical:'badge-red', high:'badge-red', medium:'badge-amber', low:'badge-gray' };
  const tipoBadge = { error:'badge-red', warning:'badge-amber' };
  tbody.innerHTML = errores.map(e => {
    const fecha = e.created_at ? new Date(e.created_at).toLocaleString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
    return `<tr style="${e.resuelto?'opacity:.5;':''}">
      <td class="tbl-mono" style="font-size:11px;">${fecha}</td>
      <td><span class="badge ${tipoBadge[e.tipo]||'badge-gray'}">${e.tipo}</span></td>
      <td style="font-size:12px;">${e.usuarios?.nombre||'—'}<br><span class="tbl-mono" style="font-size:10px;">${e.usuarios?.email||''}</span></td>
      <td style="font-size:12px;color:var(--text2);">${e.escuelas?.nombre||'—'}</td>
      <td style="font-size:12px;max-width:280px;">${e.mensaje}</td>
      <td><span class="badge ${sevBadge[e.severidad]||'badge-gray'}">${e.severidad||'—'}</span></td>
      <td>${e.resuelto ? '<span class="badge badge-green">✓</span>' : `<button class="btn btn-outline btn-sm" onclick="actResolverError('${e.id}')">Resolver</button>`}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" style="color:var(--text3);text-align:center;padding:32px;">Sin errores registrados 🎉</td></tr>';
}

async function actResolverError(id) {
  if (sb) {
    try {
      await sb.from('system_logs').update({ resuelto: true }).eq('id', id);
    } catch(e) {}
  }
  toast('Error marcado como resuelto', 'ok');
  cargarErrores();
}

function actLimpiarErrores() {
  if (!confirm('Eliminar los errores marcados como resueltos?')) return;
  toast('Errores resueltos limpiados', 'ok');
  cargarErrores();
}

// ── SALUD DEL SISTEMA ──
async function cargarSalud() {
  // Intentar cargar métricas reales
  if (sb) {
    try {
      // Storage
      const { count: storageCount } = await sb.from('evidencias').select('id', { count: 'exact', head: true });
      const metStorage = document.getElementById('met-storage');
      if (metStorage && storageCount !== null) metStorage.textContent = `${storageCount} archivos`;

      // Usuarios activos hoy
      const hoy = new Date().toISOString().split('T')[0];
      const { count: activosHoy } = await sb.from('usuarios').select('id', { count: 'exact', head: true }).gte('last_seen', hoy);
      const metActivos = document.getElementById('met-activos');
      if (metActivos && activosHoy !== null) metActivos.textContent = activosHoy;

      // Sesiones recientes
      const { data: sesiones } = await sb.from('usuarios')
        .select('nombre, email, rol, last_seen, escuelas(nombre)')
        .order('last_seen', { ascending: false })
        .limit(10);
      const stb = document.getElementById('salud-sesiones-tbody');
      if (stb && sesiones?.length) {
        stb.innerHTML = sesiones.map(s => `<tr>
          <td style="font-weight:500;">${s.nombre||'—'}</td>
          <td class="tbl-mono" style="font-size:11px;">${s.email||'—'}</td>
          <td style="font-size:12px;color:var(--text2);">${s.escuelas?.nombre||'—'}</td>
          <td><span class="badge badge-blue">${s.rol||'—'}</span></td>
          <td class="tbl-mono" style="font-size:11px;">${s.last_seen ? new Date(s.last_seen).toLocaleString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}</td>
          <td class="tbl-mono" style="font-size:11px;color:var(--text3);">—</td>
        </tr>`).join('');
      }
    } catch(e) { console.warn('Salud:', e.message); }
  }

  // Demo data for sesiones if no real data
  const stb = document.getElementById('salud-sesiones-tbody');
  if (stb && stb.querySelector('td[colspan]')) {
    stb.innerHTML = [
      { n:'Docente activo', e:'docente@escuela.demo', esc:'Escuela piloto', rol:'docente', t:'hace 12 min' },
      { n:'Director activo', e:'direccion@escuela.demo', esc:'Escuela piloto', rol:'director', t:'hace 45 min' },
      { n:'Directivo activo', e:'directivo@sec.demo', esc:'Escuela secundaria piloto', rol:'director', t:'hace 2h' },
    ].map(s => `<tr>
      <td style="font-weight:500;">${s.n}</td>
      <td class="tbl-mono" style="font-size:11px;">${s.e}</td>
      <td style="font-size:12px;color:var(--text2);">${s.esc}</td>
      <td><span class="badge badge-blue">${s.rol}</span></td>
      <td class="tbl-mono" style="font-size:11px;">${s.t}</td>
      <td class="tbl-mono" style="font-size:11px;color:var(--text3);">—</td>
    </tr>`).join('');
  }
}

function actFiltrar() {
  // Filter activity feed based on tipo and escuela selections
  cargarActividad();
}

function actExportarLogs() {
  toast('Exportando logs... (funcionalidad disponible con Supabase conectado)', 'ok');
}

function imprimirInvitacion() {
  const d = window._escuelaCreada;
  if (!d) return;
  const w = window.open('','_blank');
  w.document.write(`<html><body style="font-family:sans-serif;padding:40px;text-align:center;">
    <h2 style="color:#0d5c2f;">\uD83C\uDF31 SIEMBRA - Invitacion de acceso</h2>
    <p><strong>Escuela:</strong> ${d.nombre} (${d.cct})</p>
        <p style="font-size:11px;margin-top:8px;word-break:break-all;background:rgba(0,0,0,.1);padding:8px;border-radius:6px;">
          <strong>Link directo:</strong><br>
          <span id="inv-link-display" style="font-family:monospace;font-size:10px;cursor:pointer;" onclick="copiarTexto(this.textContent)">—</span>
        </p>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button onclick="copiarTexto(window._invLinkActual||'')" style="padding:6px 12px;background:rgba(255,255,255,.15);color:white;border:none;border-radius:6px;font-family:inherit;font-size:11px;cursor:pointer;">📋 Copiar link</button>
          <button onclick="compartirWhatsApp()" style="padding:6px 12px;background:#25d366;color:white;border:none;border-radius:6px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;">💬 WhatsApp</button>
        </div>
    <p><strong>Para:</strong> ${d.dirNombre} - ${d.dirEmail}</p>
    <p style="font-size:12px;margin-top:20px;background:#f0f0f0;padding:16px;border-radius:8px;">Token de acceso:<br><code style="font-size:14px;word-break:break-all;">${d.token}</code></p>
    <p style="font-size:12px;color:#666;">Entra a siembra.edu.mx y usa este token para registrarte</p>
    <script>window.print();<\/script>
  </body></html>`);
}

// ── ACTIVIDAD ──
async function cargarActividad() {
  const el = document.getElementById('act-feed');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;">Cargando...</div>';

  const eventos = [];
  if (sb) {
    try {
      const { data: escNew } = await sb.from('escuelas').select('nombre,creado_en').order('creado_en',{ascending:false}).limit(5);
      (escNew||[]).forEach(e => eventos.push({ tipo:'green', texto:`Nueva escuela: <strong>${e.nombre}</strong>`, tiempo: e.creado_en }));
      const { data: invNew } = await sb.from('invitaciones').select('rol,email_destino,created_at,estado').order('created_at',{ascending:false}).limit(5);
      (invNew||[]).forEach(i => eventos.push({ tipo:'amber', texto:`Invitacion <strong>${i.rol}</strong>${i.email_destino?' -> '+i.email_destino:''} - ${i.estado}`, tiempo: i.created_at }));
      const { data: usrNew } = await sb.from('usuarios').select('nombre,rol,created_at').order('created_at',{ascending:false}).limit(5);
      (usrNew||[]).forEach(u => eventos.push({ tipo:'blue', texto:`Nuevo usuario: <strong>${u.nombre||'—'}</strong> (${u.rol})`, tiempo: u.created_at }));
    } catch(e) { console.warn('[SA] actividad:', e.message); }
  }

  eventos.sort((a,b) => new Date(b.tiempo) - new Date(a.tiempo));
  el.innerHTML = eventos.length ? eventos.map(ev => `
    <div class="activity-item">
      <div class="activity-dot ${ev.tipo}"></div>
      <div>
        <div class="activity-text">${ev.texto}</div>
        <div class="activity-time">${ev.tiempo ? new Date(ev.tiempo).toLocaleString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}</div>
      </div>
    </div>`).join('') :
    '<div style="color:var(--text3);font-size:13px;">Sin actividad registrada. Las acciones apareceran aqui en tiempo real.</div>';
}

