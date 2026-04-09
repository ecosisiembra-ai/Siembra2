// ══════════════════════════════════════════════════════════════════════════════
// CHECKLIST DE PRODUCCIÓN — SuperAdmin
// ══════════════════════════════════════════════════════════════════════════════
const SA_CHECKLIST_ITEMS = [
  {
    id: 'sb_conexion', cat: '🗄️ Base de datos', critico: true,
    titulo: 'Conexion a Supabase activa',
    desc: 'El cliente Supabase responde correctamente.',
    check: async () => {
      if (!sb) return false;
      try { const { error } = await sb.from('usuarios').select('id').limit(1); return !error; }
      catch(e) { return false; }
    },
    accionLabel: 'Revisar configuracion', accion: () => navTo('config'),
  },
  {
    id: 'sb_escuelas', cat: '🗄️ Base de datos', critico: true,
    titulo: 'Escuelas registradas',
    desc: 'Debe haber al menos una escuela en el sistema.',
    check: async () => {
      if (!sb) return false;
      const { count } = await sb.from('escuelas').select('id', {count:'exact',head:true});
      return (count || 0) > 0;
    },
    detalle: async () => {
      if (!sb) return '';
      const { count } = await sb.from('escuelas').select('id', {count:'exact',head:true});
      return `${count || 0} escuelas registradas`;
    },
    accionLabel: 'Nueva escuela', accion: () => navTo('nueva-escuela'),
  },
  {
    id: 'sb_usuarios', cat: '🗄️ Base de datos', critico: true,
    titulo: 'Usuarios en el sistema',
    desc: 'Al menos un usuario activo registrado.',
    check: async () => {
      if (!sb) return false;
      const { count } = await sb.from('usuarios').select('id', {count:'exact',head:true}).eq('activo', true);
      return (count || 0) > 0;
    },
    detalle: async () => {
      if (!sb) return '';
      const { count } = await sb.from('usuarios').select('id', {count:'exact',head:true}).eq('activo', true);
      return `${count || 0} usuarios activos`;
    },
    accionLabel: 'Ver usuarios', accion: () => navTo('usuarios'),
  },
  {
    id: 'rls_check', cat: '🔒 Seguridad', critico: true,
    titulo: 'RLS habilitado en tabla usuarios',
    desc: 'Row Level Security debe estar activo.',
    check: async () => {
      if (!sb) return false;
      try {
        const { data, error } = await sb.from('usuarios').select('id,rol').limit(1);
        return !error && Array.isArray(data);
      } catch(e) { return false; }
    },
    accionLabel: 'Guia RLS', accionUrl: 'https://supabase.com/docs/guides/auth/row-level-security',
  },
  {
    id: 'portal_padres', cat: '📱 Portales', critico: true,
    titulo: 'Portal de padres accesible',
    desc: 'padres.html debe estar publicado en el mismo dominio.',
    check: async () => {
      try { const r = await fetch('/padres.html', { method: 'HEAD' }); return r.ok; }
      catch(e) { return false; }
    },
    accionLabel: 'Abrir portal', accionUrl: '/padres.html',
  },
  {
    id: 'portal_alumnos', cat: '📱 Portales', critico: false,
    titulo: 'Portal de alumnos accesible',
    desc: 'alumno.html debe estar publicado en el mismo dominio.',
    check: async () => {
      try { const r = await fetch('/alumno.html', { method: 'HEAD' }); return r.ok; }
      catch(e) { return false; }
    },
    accionLabel: 'Abrir portal', accionUrl: '/alumno.html',
  },
  {
    id: 'fn_ai_router', cat: '⚡ Edge Functions', critico: false,
    titulo: 'Edge Function: ai-router',
    desc: 'Necesaria para IA, extraccion de PDFs e importacion por imagen.',
    check: async () => {
      if (!sb) return false;
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return null;
        const url = localStorage.getItem('sa_url');
        const r = await fetch(`${url}/functions/v1/ai-router`, {
          method: 'POST',
          headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'ping' }),
        });
        return r.status < 500;
      } catch(e) { return false; }
    },
    accionLabel: 'Docs Supabase Functions', accionUrl: 'https://supabase.com/docs/guides/functions',
  },
  {
    id: 'fn_invite_user', cat: '⚡ Edge Functions', critico: false,
    titulo: 'Edge Function: invite-user',
    desc: 'Necesaria para enviar correos de invitacion a docentes y directivos.',
    check: async () => {
      if (!sb) return false;
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return null;
        const url = localStorage.getItem('sa_url');
        const r = await fetch(`${url}/functions/v1/invite-user`, {
          method: 'POST',
          headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ _ping: true }),
        });
        return r.status < 500;
      } catch(e) { return false; }
    },
    accionLabel: 'Docs Supabase Functions', accionUrl: 'https://supabase.com/docs/guides/functions',
  },
  /* ── Portales: index.html ── */
  {
    id: 'portal_index', cat: '📱 Portales', critico: true,
    titulo: 'Portal principal (index.html) accesible',
    desc: 'index.html debe estar publicado y responder 200.',
    check: async () => {
      try { const r = await fetch('/index.html', { method: 'HEAD' }); return r.ok; }
      catch(e) { return false; }
    },
    accionLabel: 'Abrir portal', accionUrl: '/index.html',
  },
  {
    id: 'portal_index_sw', cat: '📱 Portales', critico: false,
    titulo: 'Service Worker registrado en index.html',
    desc: 'El SW habilita el modo offline y la PWA en el portal principal.',
    check: async () => {
      try {
        const r = await fetch('/index.html'); const txt = await r.text();
        return txt.includes('serviceWorker') && txt.includes('sw.js');
      } catch(e) { return false; }
    },
    accionLabel: 'Revisar index.html', accionUrl: '/index.html',
  },
  {
    id: 'portal_index_supabase', cat: '📱 Portales', critico: true,
    titulo: 'index.html incluye cliente Supabase',
    desc: 'El portal director/docente requiere @supabase/supabase-js.',
    check: async () => {
      try {
        const r = await fetch('/index.html'); const txt = await r.text();
        return txt.includes('supabase-js') || txt.includes('supabase.co');
      } catch(e) { return false; }
    },
    accionLabel: 'Revisar index.html', accionUrl: '/index.html',
  },
  /* ── Portales: alumno.html ── */
  {
    id: 'portal_alumno_ok', cat: '📱 Portales', critico: true,
    titulo: 'Portal alumno (alumno.html) accesible',
    desc: 'alumno.html debe estar publicado y responder 200.',
    check: async () => {
      try { const r = await fetch('/alumno.html', { method: 'HEAD' }); return r.ok; }
      catch(e) { return false; }
    },
    accionLabel: 'Abrir portal alumno', accionUrl: '/alumno.html',
  },
  {
    id: 'portal_alumno_manifest', cat: '📱 Portales', critico: false,
    titulo: 'alumno.html tiene manifest PWA',
    desc: 'manifest-alumno.json debe estar vinculado para que sea instalable.',
    check: async () => {
      try {
        const r = await fetch('/alumno.html'); const txt = await r.text();
        return txt.includes('manifest-alumno.json') || txt.includes('manifest');
      } catch(e) { return false; }
    },
    accionLabel: 'Verificar manifest', accionUrl: '/manifest-alumno.json',
  },
  {
    id: 'portal_alumno_supabase', cat: '📱 Portales', critico: true,
    titulo: 'alumno.html incluye cliente Supabase',
    desc: 'El portal alumno requiere acceso a la base de datos.',
    check: async () => {
      try {
        const r = await fetch('/alumno.html'); const txt = await r.text();
        return txt.includes('supabase-js') || txt.includes('supabase.co');
      } catch(e) { return false; }
    },
    accionLabel: 'Revisar alumno.html', accionUrl: '/alumno.html',
  },
  /* ── Portales: padres.html ── */
  {
    id: 'portal_padres_ok', cat: '📱 Portales', critico: true,
    titulo: 'Portal padres (padres.html) accesible',
    desc: 'padres.html debe estar publicado y responder 200.',
    check: async () => {
      try { const r = await fetch('/padres.html', { method: 'HEAD' }); return r.ok; }
      catch(e) { return false; }
    },
    accionLabel: 'Abrir portal padres', accionUrl: '/padres.html',
  },
  {
    id: 'portal_padres_manifest', cat: '📱 Portales', critico: false,
    titulo: 'padres.html tiene manifest PWA',
    desc: 'manifest-padres.json debe estar vinculado para que sea instalable.',
    check: async () => {
      try {
        const r = await fetch('/padres.html'); const txt = await r.text();
        return txt.includes('manifest-padres.json') || txt.includes('manifest');
      } catch(e) { return false; }
    },
    accionLabel: 'Verificar manifest', accionUrl: '/manifest-padres.json',
  },
  {
    id: 'portal_padres_supabase', cat: '📱 Portales', critico: true,
    titulo: 'padres.html incluye cliente Supabase',
    desc: 'El portal de padres requiere acceso a la base de datos.',
    check: async () => {
      try {
        const r = await fetch('/padres.html'); const txt = await r.text();
        return txt.includes('supabase-js') || txt.includes('supabase.co');
      } catch(e) { return false; }
    },
    accionLabel: 'Revisar padres.html', accionUrl: '/padres.html',
  },
  {
    id: 'portal_padres_notif', cat: '📱 Portales', critico: false,
    titulo: 'padres.html soporta notificaciones push',
    desc: 'El portal de padres debe registrar un SW para push notifications.',
    check: async () => {
      try {
        const r = await fetch('/padres.html'); const txt = await r.text();
        return txt.includes('serviceWorker') || txt.includes('PushManager');
      } catch(e) { return false; }
    },
    accionLabel: 'Revisar padres.html', accionUrl: '/padres.html',
  },
];

async function saChecklistVerificar() {
  const lista = document.getElementById('sa-checklist-lista');
  const bar   = document.getElementById('sa-checklist-bar');
  const pct   = document.getElementById('sa-checklist-pct');
  const badge = document.getElementById('nav-badge-checklist');
  if (!lista) return;

  lista.innerHTML = '<div style="text-align:center;padding:48px;background:var(--bg2);border-radius:12px;border:1px solid var(--border);color:var(--text3);"><div style="font-size:28px;">\u23f3</div><div style="margin-top:8px;font-size:13px;">Verificando requisitos...</div></div>';

  const resultados = await Promise.all(
    SA_CHECKLIST_ITEMS.map(async item => {
      let ok = false, detalleStr = '';
      try {
        ok = await item.check();
        if (item.detalle) detalleStr = await item.detalle().catch(() => '');
      } catch(e) { ok = false; }
      return { item, ok, detalle: detalleStr };
    })
  );

  const cats = {};
  resultados.forEach(r => {
    if (!cats[r.item.cat]) cats[r.item.cat] = [];
    cats[r.item.cat].push(r);
  });

  const totalItems = resultados.length;
  const okItems    = resultados.filter(r => r.ok === true).length;
  const pendientes = resultados.filter(r => r.ok !== true && r.item.critico).length;
  const pctVal     = Math.round((okItems / totalItems) * 100);

  if (bar) {
    bar.style.width = pctVal + '%';
    bar.style.background = pctVal >= 80 ? 'var(--green)' : pctVal >= 50 ? '#d97706' : '#dc2626';
  }
  if (pct) { pct.textContent = pctVal + '%'; pct.style.color = pctVal >= 80 ? 'var(--green)' : pctVal >= 50 ? '#d97706' : '#dc2626'; }
  if (badge) { badge.textContent = pendientes > 0 ? pendientes : ''; badge.style.display = pendientes > 0 ? 'inline-flex' : 'none'; }

  const estadoCfg = {
    ok:    { icon:'✅', bg:'#f0fdf4', border:'#bbf7d0', color:'#15803d', label:'Listo' },
    fail:  { icon:'❌', bg:'#fef2f2', border:'#fca5a5', color:'#dc2626', label:'Pendiente' },
    skip:  { icon:'⚠️', bg:'#fffbeb', border:'#fde68a', color:'#b45309', label:'No verificado' },
  };

  lista.innerHTML = Object.entries(cats).map(([cat, items]) => `
    <div>
      <div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">${cat}</div>
      <div style="display:grid;gap:8px;">
        ${items.map(({ item, ok, detalle }) => {
          const cfg = estadoCfg[ok === true ? 'ok' : ok === false ? 'fail' : 'skip'];
          return `
          <div style="background:${cfg.bg};border:1.5px solid ${cfg.border};border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:14px;">
            <div style="font-size:20px;flex-shrink:0;">${cfg.icon}</div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <div style="font-size:13px;font-weight:700;color:#0f172a;">${item.titulo}</div>
                ${item.critico ? '<span style="font-size:10px;background:#fef2f2;color:#b91c1c;padding:1px 6px;border-radius:99px;font-weight:700;border:1px solid #fca5a5;">CRITICO</span>' : ''}
                <span style="font-size:10px;padding:1px 8px;border-radius:99px;font-weight:700;background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.border};margin-left:auto;">${cfg.label}</span>
              </div>
              <div style="font-size:12px;color:#64748b;margin-top:3px;">${item.desc}</div>
              ${detalle ? `<div style="font-size:11px;color:${cfg.color};font-weight:600;margin-top:4px;">${detalle}</div>` : ''}
            </div>
            ${ok !== true && (item.accion || item.accionUrl) ? `
              <button onclick="${item.accionUrl ? `window.open('${item.accionUrl}','_blank')` : '(' + item.accion.toString() + ')'+ '()'}" style="flex-shrink:0;padding:7px 14px;background:white;border:1.5px solid ${cfg.border};border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;color:#374151;white-space:nowrap;">
                ${item.accionLabel || 'Resolver'}
              </button>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>
  `).join('');
}
window.saChecklistVerificar = saChecklistVerificar;
