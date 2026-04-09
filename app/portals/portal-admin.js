// ══ ADMIN: MATERIAS POR DOCENTE ══════════════════════════════════════════
const ADM_MATERIAS_ASIGNADAS = [
  { docente: 'Docente Matemáticas',  materias: ['Matemáticas · 6°A', 'Matemáticas · 5°A'], horas: 10 },
  { docente: 'Docente Español',      materias: ['Español · 6°A', 'Español · 5°A', 'Español · 5°B'], horas: 15 },
  { docente: 'Docente Historia',     materias: ['Historia · 6°A', 'Geografía · 6°A'], horas: 10 },
  { docente: 'Docente Artes',        materias: ['Artes · 6°A', 'Formación · 6°A'], horas: 10 },
]; // Demo

// ══════════════════════════════════════════════════════════════════════
// ADMIN — Módulo 1: Alta de staff
// ══════════════════════════════════════════════════════════════════════

let _admStaffLink = '';

function admToggleRolFields(rol) {
  const campoTutoria  = document.getElementById('campo-grupo-tutoria');
  const campoGrupos   = document.getElementById('adm-p-grupos-wrap');
  const campoFamilia  = document.getElementById('adm-p-familia-wrap');
  const campoTurno    = document.getElementById('adm-p-turno')?.closest('.adm-form-group');

  // Grupo tutoría: docentes y tutores
  if (campoTutoria)  campoTutoria.style.display  = ['docente','tutor'].includes(rol) ? '' : 'none';
  // Grupos + materias: solo docentes y tutores
  if (campoGrupos)   campoGrupos.style.display   = ['docente','tutor'].includes(rol) ? '' : 'none';
  // Familia: mostrar selector de alumno
  if (campoFamilia)  campoFamilia.style.display  = rol === 'padre' ? '' : 'none';
  // Turno: ocultar para director, padre
  if (campoTurno)    campoTurno.style.display     = ['director','padre'].includes(rol) ? 'none' : '';
}

// ── Mostrar/ocultar subasignaturas de un campo formativo ──────────────
function admToggleCampoFormativo(checkbox) {
  const card = checkbox.closest('div[style*="border-radius:10px"]');
  if (!card) return;
  const subWrap = card.querySelector('.sub-materias-wrap');
  if (!subWrap) return;
  if (checkbox.checked) {
    subWrap.style.display = 'flex';
    subWrap.style.flexWrap = 'wrap';
    subWrap.style.gap = '6px';
    subWrap.style.padding = '10px 14px';
    // Auto-seleccionar todas las sub-materias al marcar el campo
    subWrap.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
  } else {
    subWrap.style.display = 'none';
    // Desmarcar todas las sub-materias
    subWrap.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
  }
}

async function admCrearStaff(sendWhatsapp = false) {
  const nombre  = document.getElementById('adm-doc-nombre')?.value.trim();
  const email   = document.getElementById('adm-doc-email')?.value.trim().toLowerCase();
  const rol     = document.getElementById('adm-doc-rol')?.value || 'docente';
  const nivel   = document.getElementById('adm-doc-nivel')?.value || window._admNivelActivo || 'primaria';
  const numempl = document.getElementById('adm-doc-numempl')?.value.trim() || null;
  const tutoria = document.getElementById('adm-doc-tutoria')?.value || null;

  if (!nombre) { hubToast('⚠️ Ingresa el nombre completo', 'warn'); return; }
  if (!email)  { hubToast('⚠️ Ingresa el correo electrónico', 'warn'); return; }

  const btn = document.getElementById('adm-staff-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Creando…'; }

  try {
    const escuelaId = currentPerfil?.escuela_id || null;
    const escuelaCct = currentPerfil?.escuela_cct || null;

    // 1. Insertar en tabla usuarios
    let usuarioId = null;
    if (sb) {
      const { data: usr, error: usrErr } = await sb.from('usuarios').insert({
        nombre: nombre.split(' ')[0],
        apellido_p: nombre.split(' ')[1] || '',
        apellido_m: nombre.split(' ')[2] || '',
        email, rol, nivel,
        num_empleado: numempl,
        grupo_tutoria: tutoria,
        escuela_id: escuelaId,
        escuela_cct: escuelaCct,
        activo: true,
        created_at: new Date().toISOString(),
      }).select('id').single();

      if (usrErr && !usrErr.message.includes('duplicate')) throw usrErr;
      usuarioId = usr?.id;
    }

    // 2. Generar token de invitación
    const inv = await dirGenerarInvitacion(rol, email, nombre, 7);
    const link = inv?.link || `${location.origin}/index.html?invite=${inv?.token}`;
    _admStaffLink = link;

    // 3. Mostrar resultado
    const resEl = document.getElementById('adm-staff-resultado');
    const linkEl = document.getElementById('adm-staff-link-txt');
    if (resEl) resEl.style.display = 'block';
    if (linkEl) {
      linkEl.textContent = link;
      linkEl._link = link;
    }

    // 4. Limpiar form
    ['adm-doc-nombre','adm-doc-email','adm-doc-numempl'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });

    // 5. WhatsApp si se pidió
    if (sendWhatsapp && link) admStaffWhatsappLink(link, nombre, rol);

    hubToast(`✅ ${nombre} registrado/a como ${rol}`, 'ok');
    admCargarUsuarios();

  } catch(e) {
    hubToast('Error: ' + e.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Crear y generar invitación'; }
  }
}

function admCrearStaffWhatsapp() { admCrearStaff(true); }

function admCopiarStaffLink() {
  if (!_admStaffLink) return;
  navigator.clipboard.writeText(_admStaffLink)
    .then(() => hubToast('📋 Link copiado', 'ok'))
    .catch(() => { const t=document.createElement('textarea'); t.value=_admStaffLink; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); hubToast('📋 Copiado','ok'); });
}

function admStaffWhatsapp() { admStaffWhatsappLink(_admStaffLink); }

function admStaffWhatsappLink(link, nombre='', rol='') {
  if (!link) return;
  const msg = encodeURIComponent(`¡Hola${nombre?' '+nombre.split(' ')[0]:''}! Te invito a registrarte en SIEMBRA como ${rol||'personal docente'} de nuestra escuela.

Entra aquí para crear tu cuenta:
${link}

El link expira en 7 días. 🌱`);
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

async function admCargarUsuarios() {
  const lista = document.getElementById('adm-usuarios-lista');
  if (!lista) return;

  const _uEscId  = currentPerfil?.escuela_id  || null;
  const _uEscCct = currentPerfil?.escuela_cct || null;
  if (!sb || (!_uEscId && !_uEscCct)) {
    // Demo
    lista.innerHTML = _admTablaUsrDemo();
    return;
  }

  lista.innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8;font-size:13px;">Cargando…</div>';

  try {
    const rolFil = document.getElementById('adm-usr-fil-rol')?.value || '';
    let q = sb.from('usuarios').select('id,nombre,apellido_p,email,rol,activo,grupo_tutoria,created_at')
      .order('rol').order('nombre');
    if (_uEscId) q = q.eq('escuela_id', _uEscId);
    else q = q.eq('escuela_cct', _uEscCct);
    if (rolFil) q = q.eq('rol', rolFil);
    const { data, error } = await q;

    if (error) throw error;
    if (!data?.length) {
      lista.innerHTML = `<div style="padding:40px;text-align:center;color:#94a3b8;font-size:13px;">
        <div style="font-size:32px;margin-bottom:10px;">👥</div>
        <div style="font-weight:600;color:#64748b;margin-bottom:6px;">Sin personal registrado</div>
        <div>Usa el formulario de arriba para agregar al primer miembro del equipo.</div>
      </div>`;
      return;
    }
    lista.innerHTML = _admTablaUsrRender(data);
  } catch(e) {
    lista.innerHTML = `<div style="padding:20px;color:#ef4444;font-size:13px;">Error: ${e.message}</div>`;
  }
}

function admFiltrarUsuarios() { admCargarUsuarios(); }

function _admTablaUsrRender(data) {
  const rolBadge = {
    director:'#dbeafe:#1e40af', subdirector:'#e0e7ff:#3730a3',
    coordinador:'#fef3c7:#92400e', docente:'#dcfce7:#15803d',
    ts:'#fef9c3:#a16207', prefecto:'#ffe4e6:#be123c',
    tutor:'#f0fdf4:#166534', admin:'#f1f5f9:#475569', padre:'#fdf4ff:#7c3aed'
  };
  const rows = data.map(u => {
    const [bg,col] = (rolBadge[u.rol]||'#f4f5f8:#333').split(':');
    const nom = `${u.nombre||''} ${u.apellido_p||''}`.trim();
    const fecha = u.created_at ? new Date(u.created_at).toLocaleDateString('es-MX',{day:'numeric',month:'short'}) : '—';
    return `<tr style="border-bottom:1px solid #f4f5f8;">
      <td style="padding:10px 14px;font-weight:600;font-size:13px;">${nom}</td>
      <td style="padding:10px 14px;font-size:12px;color:#64748b;">${u.email||'—'}</td>
      <td style="padding:10px 14px;"><span style="background:${bg};color:${col};padding:2px 9px;border-radius:10px;font-size:10px;font-weight:700;">${u.rol}</span>${u.grupo_tutoria?` <span style="font-size:10px;color:#15803d;">· ${u.grupo_tutoria}</span>`:''}</td>
      <td style="padding:10px 14px;"><span style="background:${u.activo?'#dcfce7':'#fee2e2'};color:${u.activo?'#15803d':'#dc2626'};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;">${u.activo?'Activo':'Inactivo'}</span></td>
      <td style="padding:10px 14px;font-size:12px;color:#94a3b8;">${fecha}</td>
      <td style="padding:10px 14px;">
        <button onclick="admReenviarInvitacion('${u.id}','${u.email||''}','${u.rol}')" style="padding:4px 10px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;border-radius:6px;font-family:'Sora',sans-serif;font-size:11px;cursor:pointer;">↩ Reinvitar</button>
      </td>
    </tr>`;
  }).join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="background:#f8fafc;">
      <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;color:#8890a8;text-transform:uppercase;">Nombre</th>
      <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;color:#8890a8;text-transform:uppercase;">Email</th>
      <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;color:#8890a8;text-transform:uppercase;">Rol</th>
      <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;color:#8890a8;text-transform:uppercase;">Estado</th>
      <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;color:#8890a8;text-transform:uppercase;">Alta</th>
      <th style="padding:9px 14px;"></th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

function _admTablaUsrDemo() {
  return _admTablaUsrRender(window.SiembraDemoFixtures?.admin?.usuarios || []);
}

async function admReenviarInvitacion(usuarioId, email, rol) {
  const inv = await dirGenerarInvitacion(rol, email, null, 7);
  if (inv?.link) {
    navigator.clipboard.writeText(inv.link).then(() => hubToast('✅ Nuevo link copiado', 'ok'));
  }
}

// Alias para compatibilidad con código antiguo
async function admCrearDocente() { return admCrearStaff(); }
function admCopiarPin() { admCopiarStaffLink(); }

// ══════════════════════════════════════════════════════════════════════
// ADMIN — Módulo 2: Grupos y alumnos
// ══════════════════════════════════════════════════════════════════════

let _admGruposDB   = [];  // grupos cargados desde Supabase
let _admCSVData    = [];  // alumnos del CSV parseado
let _admCSVHeaders = [];

function admAdmTab(tab) {
  ['grupos','alumnos','import'].forEach(t => {
    const btn = document.getElementById('adm-tab-'+t);
    const pan = document.getElementById('adm-panel-'+t);
    const active = t === tab;
    if (btn) { btn.style.background = active ? 'white' : 'transparent'; btn.style.color = active ? '#0d5c2f' : '#64748b'; btn.style.fontWeight = active ? '700' : '600'; btn.style.boxShadow = active ? '0 1px 3px rgba(0,0,0,.08)' : 'none'; }
    if (pan) pan.style.display = active ? '' : 'none';
  });
  if (tab === 'alumnos') admCargarAlumnosAdmin();
}

function admAbrirModalGrupo() {
  // Poblar selector de docentes
  const sel = document.getElementById('adm-gr-docente');
  if (sel) {
    sel.innerHTML = '<option value="">— Sin asignar —</option>';
    if (sb && currentPerfil?.escuela_id) {
      sb.from('usuarios').select('id,nombre,apellido_p').eq('escuela_id', currentPerfil.escuela_id).eq('rol','docente').then(({ data }) => {
        if (data) data.forEach(d => {
          const o = document.createElement('option');
          o.value = d.id;
          o.textContent = `${d.nombre} ${d.apellido_p||''}`.trim();
          sel.appendChild(o);
        });
      });
    }
  }
  const modal = document.getElementById('adm-modal-grupo');
  if (modal) modal.style.display = 'flex';
}

async function admCrearGrupo() {
  const grado   = document.getElementById('adm-gr-grado')?.value;
  const letra   = document.getElementById('adm-gr-letra')?.value;
  const nivel   = document.getElementById('adm-gr-nivel')?.value || ADM.escuelaNivel || 'secundaria';
  const docenteId = document.getElementById('adm-gr-docente')?.value || null;
  const nombre  = `${grado}° ${letra}`;

  // Resolver CCT y escuela_id desde múltiples fuentes
  const escuelaCct = window.currentPerfil?.escuela_cct || ADM.escuelaCct || ADM.currentPerfil?.escuela_cct;
  const escuelaId  = window.currentPerfil?.escuela_id  || ADM.escuelaId  || ADM.currentPerfil?.escuela_id || null;

  if (!grado || !letra) { hubToast('⚠️ Selecciona grado y grupo', 'warn'); return; }
  if (!escuelaCct) { hubToast('⚠️ No se pudo identificar la escuela. Recarga la página.', 'warn'); return; }

  try {
    if (!sb) throw new Error('Sin conexión a Supabase');

    const payload = {
      nombre,
      grado:     parseInt(grado),
      grupo:     letra,
      seccion:   letra,
      nivel,
      escuela_cct: escuelaCct,
      docente_guia:       docenteId || null,
      docente_titular_id: docenteId || null,
      ciclo:   window.CICLO_ACTIVO || '2025-2026',
      activo:  true,
    };

    // Agregar escuela_id solo si es un UUID válido
    if (escuelaId && /^[0-9a-f-]{36}$/i.test(String(escuelaId))) {
      payload.escuela_id = escuelaId;
    }

    const { data, error } = await sb.from('grupos').insert(payload).select('id').single();
    if (error) throw error;

    // Vincular docente al grupo
    if (docenteId && data?.id) {
      try {
        await sb.from('docente_grupos').upsert({
          docente_id: docenteId,
          grupo_id:   data.id,
          ciclo:      window.CICLO_ACTIVO || '2025-2026',
          activo:     true,
        }, { onConflict: 'docente_id,grupo_id,materia,ciclo' });
      } catch(e) {
        console.warn('[admCrearGrupo] docente_grupos:', e.message);
      }
    }

    document.getElementById('adm-modal-grupo').style.display = 'none';
    hubToast(`✅ Grupo ${nombre} creado`, 'ok');
    // Recargar en ambos sistemas
    await ADM.cargarGrupos();
    ADM.renderGrupos();
    admCargarGruposAdmin();
  } catch(e) {
    hubToast('Error: ' + e.message, 'err');
    console.error('[admCrearGrupo]', e);
  }
}

async function admCargarGruposAdmin() {
  const grid = document.getElementById('adm-grupos-grid');
  if (!grid) return;

  const cct = window.currentPerfil?.escuela_cct || ADM.escuelaCct || ADM.currentPerfil?.escuela_cct;

  if (!sb || !cct) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;color:#94a3b8;"><div style="font-size:32px;margin-bottom:10px;">⚠️</div><div>No se pudo identificar la escuela. Recarga la página.</div></div>';
    return;
  }

  grid.innerHTML = '<div style="padding:32px;text-align:center;color:#94a3b8;font-size:13px;grid-column:1/-1;">Cargando grupos…</div>';

  try {
    const { data, error } = await sb.from('grupos')
      .select('id,nombre,grado,grupo,nivel,docente_titular_id,usuarios!docente_titular_id(nombre,apellido_p)')
      .eq('escuela_cct', cct)
      .eq('activo', true).order('grado').order('grupo');
    if (error) throw error;
    _admGruposDB = data || [];

    if (!_admGruposDB.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:#94a3b8;">
        <div style="font-size:32px;margin-bottom:10px;">👥</div>
        <div style="font-weight:600;color:#64748b;margin-bottom:6px;">Todavía no hay grupos registrados</div>
        <button onclick="admAbrirModalGrupo()" style="padding:9px 18px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;margin-top:8px;">ï¼‹ Crear primer grupo</button>
      </div>`;
      return;
    }

    // Contar alumnos por grupo
    const cuentas = {};
    await Promise.all(_admGruposDB.map(async g => {
      const { count } = await sb.from('alumnos_grupos').select('id',{count:'exact',head:true}).eq('grupo_id',g.id).eq('activo',true);
      cuentas[g.id] = count || 0;
    }));

    grid.innerHTML = _admGruposDB.map(g => {
      const docNom = g.usuarios ? `${g.usuarios.nombre||''} ${g.usuarios.apellido_p||''}`.trim() : 'Sin docente';
      return `<div style="background:white;border-radius:12px;border:1px solid #e5e7ef;padding:16px;cursor:pointer;transition:.15s;" onmouseover="this.style.borderColor='#0d5c2f'" onmouseout="this.style.borderColor='#e5e7ef'" onclick="admVerGrupo('${g.id}','${g.nombre}')">
        <div style="width:48px;height:48px;border-radius:12px;background:#eaf6ee;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#0d5c2f;margin-bottom:10px;">${g.grado}°${g.grupo}</div>
        <div style="font-weight:700;font-size:14px;">${g.nombre}</div>
        <div style="font-size:12px;color:#64748b;margin-top:3px;">${cuentas[g.id]} alumnos · ${docNom}</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${g.nivel}</div>
      </div>`;
    }).join('');

    _poblarSelectoresGrupo(_admGruposDB);
  } catch(e) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;color:#ef4444;font-size:13px;">Error: ${e.message}</div>`;
  }
}

function _poblarSelectoresGrupo(grupos) {
  // Poblar todos los selectores de grupo en la UI
  ['adm-al-grupo','adm-al-fil-grupo','adm-doc-tutoria'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const placeholder = id === 'adm-al-fil-grupo' ? '<option value="">Todos los grupos</option>' :
                        id === 'adm-doc-tutoria'   ? '<option value="">— Sin tutoría —</option>' :
                                                     '<option value="">— Seleccionar grupo —</option>';
    sel.innerHTML = placeholder + grupos.map(g => `<option value="${g.id}">${g.nombre}</option>`).join('');
  });
}

function admVerGrupo(grupoId, grupoNom) {
  admAdmTab('alumnos');
  const sel = document.getElementById('adm-al-fil-grupo');
  if (sel) { sel.value = grupoId; admCargarAlumnosAdmin(); }
}

async function admCrearAlumno() {
  const nombre = document.getElementById('adm-al-nombre')?.value.trim();
  const ap     = document.getElementById('adm-al-ap')?.value.trim();
  const am     = document.getElementById('adm-al-am')?.value.trim() || '';
  const curp   = document.getElementById('adm-al-curp')?.value.trim().toUpperCase();
  const grupoId= document.getElementById('adm-al-grupo')?.value;
  const nac    = document.getElementById('adm-al-nac')?.value || null;

  if (!nombre || !ap) { hubToast('⚠️ Nombre y apellido paterno requeridos', 'warn'); return; }

  try {
    if (sb && (currentPerfil?.escuela_id || currentPerfil?.escuela_cct)) {
      const escuelaId = currentPerfil?.escuela_id || null;
      const escuelaCct = currentPerfil?.escuela_cct || null;
      // 1. Insertar usuario con rol alumno
      const { data: usr, error: usrErr } = await sb.from('usuarios').insert({
        nombre, apellido_p: ap, apellido_m: am, curp: curp||null,
        rol: 'alumno', escuela_id: escuelaId, escuela_cct: escuelaCct,
        fecha_nac: nac || null, activo: true,
        created_at: new Date().toISOString(),
      }).select('id').single();
      if (usrErr) throw usrErr;

      // 2. Asignar al grupo
      if (grupoId && usr?.id) {
        await sb.from('alumnos_grupos').insert({
          alumno_id: usr.id, grupo_id: grupoId,
          ciclo: window.CICLO_ACTIVO, activo: true,
        });
        // 3. Crear perfil de alumno (XP, racha)
        await sb.from('perfil_alumno').insert({
          alumno_id: usr.id, xp: 0, racha: 0, nivel: 1,
        }).catch(()=>{});
      }
    }
    // Limpiar form
    ['adm-al-nombre','adm-al-ap','adm-al-am','adm-al-curp','adm-al-nac'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    hubToast(`✅ ${nombre} ${ap} agregado/a`, 'ok');
    admCargarAlumnosAdmin();
  } catch(e) {
    hubToast('Error: ' + e.message, 'err');
  }
}

async function admCargarAlumnosAdmin() {
  const lista  = document.getElementById('adm-alumnos-lista');
  const total  = document.getElementById('adm-al-total');
  if (!lista) return;

  const grupoFil = document.getElementById('adm-al-fil-grupo')?.value || '';

  const _aEscId  = currentPerfil?.escuela_id  || null;
  const _aEscCct = currentPerfil?.escuela_cct || null;
  if (!sb || (!_aEscId && !_aEscCct)) {
    lista.innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8;font-size:13px;">Conecta Supabase para ver el padrón real.</div>';
    return;
  }

  lista.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;">Cargando…</div>';

  try {
    let q = sb.from('alumnos_grupos')
      .select('grupo_id,grupos(nombre,escuela_cct),usuarios!alumno_id(id,nombre,apellido_p,apellido_m,curp,activo)')
      .eq('activo', true);
    if (grupoFil) q = q.eq('grupo_id', grupoFil);
    else if (_aEscId) q = q.eq('grupos.escuela_id', _aEscId);
    else q = q.eq('grupos.escuela_cct', _aEscCct);

    const { data, error } = await q.order('grupo_id').limit(300);
    if (error) throw error;

    if (!data?.length) {
      lista.innerHTML = `<div style="padding:40px;text-align:center;color:#94a3b8;font-size:13px;">
        <div style="font-size:32px;margin-bottom:10px;">🎓</div>
        <div style="font-weight:600;color:#64748b;margin-bottom:6px;">Sin alumnos registrados</div>
        <div>Agrega alumnos manualmente o importa desde CSV.</div>
      </div>`;
      if (total) total.textContent = '';
      return;
    }

    if (total) total.textContent = `(${data.length})`;
    lista.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;color:#8890a8;text-transform:uppercase;">#</th>
        <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;color:#8890a8;text-transform:uppercase;">Nombre</th>
        <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;color:#8890a8;text-transform:uppercase;">CURP</th>
        <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;color:#8890a8;text-transform:uppercase;">Grupo</th>
        <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;color:#8890a8;text-transform:uppercase;">Estado</th>
      </tr></thead>
      <tbody>${data.map((r,i) => {
        const u = r.usuarios || {};
        const nom = `${u.nombre||''} ${u.apellido_p||''} ${u.apellido_m||''}`.trim();
        return `<tr style="border-bottom:1px solid #f4f5f8;">
          <td style="padding:9px 14px;color:#94a3b8;font-size:12px;">${i+1}</td>
          <td style="padding:9px 14px;font-weight:600;">${nom}</td>
          <td style="padding:9px 14px;font-size:11px;font-family:monospace;color:#64748b;">${u.curp||'—'}</td>
          <td style="padding:9px 14px;"><span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">${r.grupos?.nombre||'—'}</span></td>
          <td style="padding:9px 14px;"><span style="background:${u.activo?'#dcfce7':'#fee2e2'};color:${u.activo?'#15803d':'#dc2626'};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;">${u.activo?'Activo':'Inactivo'}</span></td>
        <td style="padding:9px 14px;">
            <button onclick="admGenerarVinculoPadre('${r.usuarios?.id||''}','${r.usuarios ? (r.usuarios.nombre+' '+(r.usuarios.apellido_p||'')).trim() : '—'}')"
              style="padding:4px 10px;background:#f0fdf4;border:1px solid #86efac;color:#15803d;border-radius:6px;font-family:'Sora',sans-serif;font-size:11px;cursor:pointer;">
              📲 QR padre
            </button>
          </td>
        </tr>`;
      }).join('')}</tbody></table>`;
  } catch(e) {
    lista.innerHTML = `<div style="padding:16px;color:#ef4444;font-size:13px;">Error: ${e.message}</div>`;
  }
}

// ── CSV Import ────────────────────────────────────────────────────────
function admDropCSV(e) {
  e.preventDefault();
  const f = e.dataTransfer?.files?.[0];
  if (f) _admProcesarCSVFile(f);
}

function admCargarCSV(input) {
  const f = input.files?.[0];
  if (f) _admProcesarCSVFile(f);
}

function _admProcesarCSVFile(file) {
  const info = document.getElementById('adm-csv-info');
  if (info) { info.style.display='block'; info.textContent=`📊 ${file.name} · ${(file.size/1024).toFixed(1)} KB`; }

  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).filter(l => l.trim());


    if (!lines.length) { hubToast('⚠️ Archivo vacío', 'warn'); return; }
    _admCSVHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["""]/g,''));
    _admCSVData = lines.slice(1).filter(l=>l.trim()).map(l => {
      const vals = l.split(',').map(v => v.trim().replace(/^["']|["']$/g,''));
      const obj = {};
      _admCSVHeaders.forEach((h,i) => { obj[h] = vals[i] || ''; });
      return obj;
    }).filter(r => r.nombre || r['nombre(s)']);

    _admRenderCSVPreview();
    const btn = document.getElementById('adm-csv-import-btn');
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  };
  reader.readAsText(file, 'UTF-8');
}

function _admRenderCSVPreview() {
  const el = document.getElementById('adm-csv-preview');
  if (!el || !_admCSVData.length) return;
  const cols = ['nombre','apellido_p','apellido_m','curp','grupo'].filter(c =>
    _admCSVHeaders.some(h => h.includes(c.split('_')[0]))
  );
  el.innerHTML = `<div style="font-size:12px;color:#15803d;font-weight:700;margin-bottom:8px;">✅ ${_admCSVData.length} alumnos detectados</div>
    <div style="overflow-x:auto;max-height:200px;overflow-y:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead><tr style="background:#f4f5f8;">${_admCSVHeaders.slice(0,5).map(h=>`<th style="padding:6px 10px;text-align:left;font-weight:700;color:#64748b;">${h}</th>`).join('')}</tr></thead>
      <tbody>${_admCSVData.slice(0,5).map(r=>`<tr style="border-bottom:1px solid #f4f5f8;">${_admCSVHeaders.slice(0,5).map(h=>`<td style="padding:6px 10px;color:#334155;">${r[h]||'—'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    ${_admCSVData.length>5?`<div style="padding:6px 10px;font-size:11px;color:#94a3b8;">… y ${_admCSVData.length-5} más</div>`:''}
    </div>`;
}

async function admImportarCSV() {
  if (!_admCSVData.length) { hubToast('⚠️ No hay datos para importar', 'warn'); return; }
  const btn = document.getElementById('adm-csv-import-btn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Importando…'; }

  let ok = 0, err = 0;
  const grupoFil = document.getElementById('adm-al-grupo')?.value || null;

  for (const row of _admCSVData) {
    try {
      const nombre = (row.nombre || row['nombre(s)'] || '').trim();
      const ap     = (row.apellido_p || row['apellido paterno'] || row['ap'] || '').trim();
      const am     = (row.apellido_m || row['apellido materno'] || row['am'] || '').trim();
      const curp   = (row.curp || '').trim().toUpperCase() || null;
      const grupoNom = (row.grupo || row['grupo'] || '').trim();
      if (!nombre) continue;

      if (sb && currentPerfil?.escuela_id) {
        const { data: usr, error: usrErr } = await sb.from('usuarios').insert({
          nombre, apellido_p: ap, apellido_m: am, curp,
          rol: 'alumno', escuela_id: currentPerfil.escuela_id,
          activo: true, created_at: new Date().toISOString(),
        }).select('id').single();
        if (usrErr && !usrErr.message.includes('duplicate')) throw usrErr;

        // Buscar grupo por nombre
        const grupoId = grupoFil || _admGruposDB.find(g => g.nombre?.includes(grupoNom))?.id;
        if (grupoId && usr?.id) {
          await sb.from('alumnos_grupos').insert({
            alumno_id: usr.id, grupo_id: grupoId,
            ciclo: window.CICLO_ACTIVO, activo: true,
          }).catch(()=>{});
          try { await sb.from('perfil_alumno').insert({ alumno_id: usr.id, xp:0, racha:0, nivel:1 }); } catch(e) {}
        }
        ok++;
      } else { ok++; } // demo count
    } catch(e) { err++; }
  }

  hubToast(`✅ ${ok} alumnos importados${err?` · ${err} errores`:''}`, ok>0?'ok':'warn');
  if (btn) { btn.disabled=false; btn.textContent='✦ Importar alumnos'; }
  _admCSVData = []; _admCSVHeaders = [];
  admCargarAlumnosAdmin();
}

// ══════════════════════════════════════════════════════════════════
// REPORTES SEP — Descarga real en CSV
// ══════════════════════════════════════════════════════════════════

function _csvDownload(filename, rows, headers) {
  const bom = '\uFEFF'; // UTF-8 BOM para Excel
  const csv = bom + [headers.join(','), ...rows.map(r =>
    headers.map(h => {
      const v = String(r[h] ?? '').replace(/"/g, '""');
      return v.includes(',') || v.includes('\n') ? `"${v}"` : v;
    }).join(',')
  )].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  hubToast(`✅ ${filename} descargado`, 'ok');
}

async function sepReporteCURP() {
  hubToast('⏳ Generando reporte CURP…');
  try {
    let rows = [];
    if (sb && currentPerfil?.escuela_id) {
      const { data } = await sb.from('alumnos_grupos')
        .select('usuarios!alumno_id(nombre,apellido_p,apellido_m,curp,fecha_nac), grupos!grupo_id(nombre,grado)')
        .eq('activo', true);
      rows = (data || []).map(r => ({
        nombre: `${r.usuarios?.nombre||''} ${r.usuarios?.apellido_p||''} ${r.usuarios?.apellido_m||''}`.trim(),
        curp: r.usuarios?.curp || '',
        grupo: r.grupos?.nombre || '',
        grado: r.grupos?.grado || '',
        nacimiento: r.usuarios?.fecha_nacimiento || '',
      }));
    } else {
      // Demo
      rows = alumnos.map((a,i) => ({ nombre: a.n, curp: `DEMO${i}000000000000`, grupo: '6° A', grado: 6, nacimiento: '2012-01-01' }));
    }
    _csvDownload(`padron_curp_${new Date().toISOString().split('T')[0]}.csv`, rows,
      ['nombre','curp','grupo','grado','nacimiento']);
  } catch(e) { hubToast('Error: ' + e.message, 'err'); }
}

async function sepPlantillaDocente() {
  hubToast('⏳ Generando plantilla docente…');
  try {
    let rows = [];
    if (sb && currentPerfil?.escuela_id) {
      const { data } = await sb.from('docente_grupos')
        .select('materia, usuarios!docente_id(nombre,apellido_p,num_empleado,email), grupos!grupo_id(nombre,grado)')
        .eq('activo', true);
      rows = (data || []).map(r => ({
        nombre: `${r.usuarios?.nombre||''} ${r.usuarios?.apellido_p||''}`.trim(),
        num_empleado: r.usuarios?.num_empleado || '',
        email: r.usuarios?.email || '',
        materia: r.materia || '',
        grupo: r.grupos?.nombre || '',
        grado: r.grupos?.grado || '',
      }));
    } else {
      rows = docentes.map(d => ({
        nombre: d.nombre, num_empleado: '', email: '', materia: d.materias.join('/'), grupo: d.grupos.join('/'), grado: ''
      }));
    }
    _csvDownload(`plantilla_docente_${new Date().toISOString().split('T')[0]}.csv`, rows,
      ['nombre','num_empleado','email','materia','grupo','grado']);
  } catch(e) { hubToast('Error: ' + e.message, 'err'); }
}

async function sepCalificaciones() {
  hubToast('⏳ Generando actas de calificaciones…');
  try {
    let rows = [];
    if (sb && currentPerfil?.escuela_id) {
      const { data } = await sb.from('calificaciones')
        .select('materia,trimestre,aspecto,calificacion, usuarios!alumno_id(nombre,apellido_p), grupos!grupo_id(nombre)')
        .eq('ciclo', window.CICLO_ACTIVO);
      rows = (data || []).map(r => ({
        alumno: `${r.usuarios?.nombre||''} ${r.usuarios?.apellido_p||''}`.trim(),
        grupo: r.grupos?.nombre || '',
        materia: r.materia || '',
        trimestre: r.trimestre || '',
        aspecto: r.aspecto || '',
        calificacion: r.calificacion ?? '',
      }));
    } else {
      alumnos.forEach(a => {
        MATERIAS_NEM.forEach(m => {
          [1,2,3].forEach(t => {
            rows.push({ alumno: a.n, grupo:'6° A', materia:m, trimestre:t, aspecto:'General', calificacion: a.cals[0]||7 });
          });
        });
      });
    }
    _csvDownload(`actas_calificaciones_${new Date().toISOString().split('T')[0]}.csv`, rows,
      ['alumno','grupo','materia','trimestre','aspecto','calificacion']);
  } catch(e) { hubToast('Error: ' + e.message, 'err'); }
}

async function sepReporteEstadistica() {
  hubToast('⏳ Generando estadística escolar…');
  try {
    let totalAlumnos = 0, totalGrupos = 0, totalDocentes = 0;
    if (sb && currentPerfil?.escuela_id) {
      const [rA, rG, rD] = await Promise.all([
        sb.from('alumnos_grupos').select('id',{count:'exact',head:true}).eq('activo',true),
        sb.from('grupos').select('id',{count:'exact',head:true}).eq('escuela_cct',currentPerfil.escuela_cct||ADM?.escuelaCct||'').eq('activo',true),
        sb.from('usuarios').select('id',{count:'exact',head:true}).eq('escuela_id',currentPerfil.escuela_id).eq('rol','docente'),
      ]);
      totalAlumnos = rA.count || 0; totalGrupos = rG.count || 0; totalDocentes = rD.count || 0;
    } else {
      totalAlumnos = alumnos.length; totalGrupos = grupos.length; totalDocentes = docentes.length;
    }
    const rows = [
      { concepto: 'Total alumnos inscritos', valor: totalAlumnos },
      { concepto: 'Total grupos activos', valor: totalGrupos },
      { concepto: 'Total docentes', valor: totalDocentes },
      { concepto: 'Ciclo escolar', valor: window.CICLO_ACTIVO },
      { concepto: 'Fecha de generación', valor: new Date().toLocaleDateString('es-MX') },
    ];
    _csvDownload(`estadistica_escolar_${new Date().toISOString().split('T')[0]}.csv`, rows, ['concepto','valor']);
  } catch(e) { hubToast('Error: ' + e.message, 'err'); }
}

async function sepFormato911() {
  hubToast('⏳ Generando Formato 911…');
  // Formato simplificado compatible con SEP
  try {
    const rows = [];
    if (sb && currentPerfil?.escuela_id) {
      const { data } = await sb.from('alumnos_grupos')
        .select('usuarios!alumno_id(nombre,apellido_p,apellido_m,curp,fecha_nac), grupos!grupo_id(nombre,grado,nivel)')
        .eq('activo',true);
      (data||[]).forEach(r => {
        rows.push({
          cct: currentPerfil.escuela_cct || '',
          nombre_alumno: `${r.usuarios?.apellido_p||''} ${r.usuarios?.apellido_m||''} ${r.usuarios?.nombre||''}`.trim(),
          curp: r.usuarios?.curp || '',
          sexo: r.usuarios?.sexo || '',
          fecha_nac: r.usuarios?.fecha_nacimiento || '',
          grado: r.grupos?.grado || '',
          grupo: r.grupos?.nombre || '',
          nivel: r.grupos?.nivel || 'primaria',
          turno: 'MATUTINO',
          ciclo: window.CICLO_ACTIVO,
        });
      });
    } else {
      alumnos.forEach(a => rows.push({ cct:'19EPR0001A', nombre_alumno:a.n, curp:'', sexo:'', fecha_nac:'', grado:6, grupo:'6° A', nivel:'primaria', turno:'MATUTINO', ciclo: window.CICLO_ACTIVO }));
    }
    _csvDownload(`formato_911_${new Date().toISOString().split('T')[0]}.csv`, rows,
      ['cct','nombre_alumno','curp','sexo','fecha_nac','grado','grupo','nivel','turno','ciclo']);
  } catch(e) { hubToast('Error: ' + e.message, 'err'); }
}

function sepReporteSIEMBRA() {
  hubToast('⏳ Generando reporte SIEMBRA…');
  const rows = alumnos.map(a => ({
    alumno: a.n, grupo: '6° A',
    xp: a.xp || 0, racha: a.racha || 0, nivel: a.nivel || 1,
    promedio: a.cals ? (a.cals.reduce((s,c)=>s+c,0)/a.cals.length).toFixed(1) : '—',
  }));
  _csvDownload(`reporte_siembra_${new Date().toISOString().split('T')[0]}.csv`, rows,
    ['alumno','grupo','xp','racha','nivel','promedio']);
}

// ── Lista de asistencia mensual (formato para impresión y firma) ──────
async function sepListaAsistencia() {
  hubToast('⏳ Generando lista de asistencia…');
  try {
    const hoy   = new Date();
    const mes   = hoy.getMonth() + 1;
    const anio  = hoy.getFullYear();
    // Días hábiles del mes actual (lunes-viernes)
    const dias  = [];
    const d     = new Date(anio, mes - 1, 1);
    while (d.getMonth() === mes - 1) {
      if (d.getDay() > 0 && d.getDay() < 6) dias.push(d.getDate());
      d.setDate(d.getDate() + 1);
    }

    const lista = window._alumnosActivos || alumnos;
    let asistData = {};

    if (sb && window._grupoActivo) {
      const desde = `${anio}-${String(mes).padStart(2,'0')}-01`;
      const hasta = `${anio}-${String(mes).padStart(2,'0')}-31`;
      const { data } = await sb.from('asistencia')
        .select('alumno_id, fecha, estado')
        .eq('grupo_id', window._grupoActivo)
        .gte('fecha', desde).lte('fecha', hasta);
      (data || []).forEach(r => {
        if (!asistData[r.alumno_id]) asistData[r.alumno_id] = {};
        const dia = new Date(r.fecha).getDate();
        asistData[r.alumno_id][dia] = r.estado;
      });
    }

    const rows = lista.map((a, idx) => {
      const row = { num: idx + 1, alumno: a.n || a.nombre || '—' };
      dias.forEach(dia => {
        const est = asistData[a.id]?.[dia];
        row[`d${dia}`] = est === 'A' ? 'F' : est === 'T' ? 'T' : '';
      });
      const faltas = dias.filter(dia => asistData[a.id]?.[dia] === 'A').length;
      row.total_faltas = faltas;
      return row;
    });

    const cols = ['num', 'alumno', ...dias.map(d => `d${d}`), 'total_faltas'];
    _csvDownload(`lista_asistencia_${anio}_${String(mes).padStart(2,'0')}.csv`, rows, cols);
    hubToast('✅ Lista de asistencia descargada', 'ok');
  } catch(e) { hubToast('Error: ' + e.message, 'err'); }
}

// ── Actas de evaluación (formato oficial por grupo y trimestre) ────────
async function sepGenerarActas() {
  hubToast('⏳ Generando actas de evaluación…');
  try {
    const trim = calTrimActual || 1;
    const lista = window._alumnosActivos || alumnos;
    const rows  = [];

    if (sb && window._grupoActivo) {
      const { data } = await sb.from('calificaciones')
        .select('alumno_id, materia, aspecto, calificacion, usuarios!alumno_id(nombre,apellido_p)')
        .eq('grupo_id', window._grupoActivo)
        .eq('trimestre', trim)
        .eq('ciclo', window.CICLO_ACTIVO);

      // Agrupar por alumno y calcular promedio
      const porAlumno = {};
      (data || []).forEach(c => {
        const nombre = `${c.usuarios?.nombre||''} ${c.usuarios?.apellido_p||''}`.trim();
        if (!porAlumno[c.alumno_id]) porAlumno[c.alumno_id] = { nombre, materias: {} };
        if (!porAlumno[c.alumno_id].materias[c.materia]) porAlumno[c.alumno_id].materias[c.materia] = [];
        porAlumno[c.alumno_id].materias[c.materia].push(parseFloat(c.calificacion || 0));
      });

      Object.values(porAlumno).forEach(al => {
        const row = { alumno: al.nombre, trimestre: trim, ciclo: window.CICLO_ACTIVO };
        let suma = 0, cnt = 0;
        MATERIAS_NEM.forEach(mat => {
          const cals = al.materias[mat] || [];
          const prom = cals.length ? (cals.reduce((s,c)=>s+c,0)/cals.length).toFixed(1) : '—';
          row[mat.replace(/ /g,'_').substring(0,15)] = prom;
          if (prom !== '—') { suma += parseFloat(prom); cnt++; }
        });
        row.promedio_general = cnt ? (suma/cnt).toFixed(1) : '—';
        rows.push(row);
      });
    } else {
      // Demo
      lista.forEach(a => {
        const row = { alumno: a.n || '—', trimestre: trim, ciclo: window.CICLO_ACTIVO };
        MATERIAS_NEM.forEach(mat => { row[mat.substring(0,15)] = (7 + Math.random()*3).toFixed(1); });
        row.promedio_general = (7.5 + Math.random()*2).toFixed(1);
        rows.push(row);
      });
    }

    const cols = ['alumno', 'trimestre', 'ciclo',
      ...MATERIAS_NEM.map(m => m.replace(/ /g,'_').substring(0,15)),
      'promedio_general'];
    _csvDownload(`acta_evaluacion_T${trim}_${new Date().toISOString().split('T')[0]}.csv`, rows, cols);
    hubToast('✅ Actas generadas correctamente', 'ok');
  } catch(e) { hubToast('Error: ' + e.message, 'err'); }
}

// ══════════════════════════════════════════════════════════════════
// ALERTAS DE RIESGO ACADÉMICO — Dashboard docente
// Detecta alumnos con promedio bajo, muchas faltas o sin tareas
// ══════════════════════════════════════════════════════════════════

function calcularRiesgoAlumnos() {
  const lista = window._alumnosActivos || alumnos;
  if (!lista.length) return [];

  return lista.map((a, ai) => {
    const riesgos = [];
    let nivel = 'verde'; // verde / amarillo / rojo

    // 1. Promedio bajo
    let prom = 7;
    if (typeof calPromPonderado === 'function' && Object.keys(CAL_DATA||{}).length) {
      const proms = MATERIAS_NEM.map(m => calPromPonderado(ai, m, calTrimActual||1));
      prom = proms.reduce((s,p)=>s+p,0) / proms.length;
    } else if (a.cals?.length) {
      prom = a.cals.reduce((s,c)=>s+c,0) / a.cals.length;
    }
    if (prom < 6)       { riesgos.push({ ico:'📉', txt:`Promedio ${prom.toFixed(1)} — crítico` }); nivel = 'rojo'; }
    else if (prom < 7)  { riesgos.push({ ico:'⚠️', txt:`Promedio ${prom.toFixed(1)} — en riesgo` }); if(nivel!=='rojo') nivel='amarillo'; }

    // 2. Asistencia baja
    if (a.as === 'A') { riesgos.push({ ico:'🚫', txt:'Falta registrada hoy' }); if(nivel!=='rojo') nivel='amarillo'; }

    // 3. Sin calificaciones capturadas
    const matSinCal = MATERIAS_NEM.filter(m => {
      const d = CAL_DATA?.[m]?.[calTrimActual||1]?.[ai];
      return !d || Object.values(d).every(v => !v);
    });
    if (matSinCal.length >= 4) { riesgos.push({ ico:'📋', txt:`Sin calificaciones en ${matSinCal.length} materias` }); if(nivel==='verde') nivel='amarillo'; }

    return { alumno: a.n, ai, prom, nivel, riesgos };
  }).filter(r => r.nivel !== 'verde' || r.riesgos.length);
}

function renderAlertas() {
  const el = document.getElementById('alertas-riesgo');
  if (!el) return;

  const alertas = calcularRiesgoAlumnos();
  const rojos    = alertas.filter(a => a.nivel === 'rojo');
  const amarillos = alertas.filter(a => a.nivel === 'amarillo');

  if (!alertas.length) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--gris-50);font-size:13px;">
      <div style="font-size:24px;margin-bottom:6px;">✅</div>
      Todos los alumnos están en buen nivel
    </div>`;
    return;
  }

  el.innerHTML = [
    ...rojos.map(a => _alertaCard(a, '#fee2e2', '#991b1b', '🔴')),
    ...amarillos.map(a => _alertaCard(a, '#fef9c3', '#92400e', '🟡')),
  ].join('');
}

function _alertaCard(a, bg, col, ico) {
  return `<div style="background:${bg};border-radius:10px;padding:12px 14px;margin-bottom:8px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <span>${ico}</span>
      <span style="font-weight:700;font-size:13px;color:${col};">${a.alumno}</span>
      <span style="margin-left:auto;font-size:12px;color:${col};font-weight:600;">Prom: ${a.prom.toFixed(1)}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:3px;">
      ${a.riesgos.map(r => `<div style="font-size:12px;color:${col};">${r.ico} ${r.txt}</div>`).join('')}
    </div>
    <button onclick="obsAbrirModal('${a.alumno}')" style="margin-top:8px;padding:4px 10px;background:white;border:1px solid ${col};color:${col};border-radius:6px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;">
      📝 Agregar observación
    </button>
  </div>`;
}

// ══════════════════════════════════════════════════════════════════
// VINCULACIÓN PADRE-ALUMNO — Genera código QR imprimible
// La secretaría lo genera por alumno, el padre lo escanea
// ══════════════════════════════════════════════════════════════════

async function admGenerarVinculoPadre(alumnoId, alumnoNombre) {
  // Generar código de 6 caracteres
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  const codigo = Array.from(arr, b => chars[b % chars.length]).join('');

  try {
    if (sb) {
      const { error } = await sb.from('vinculos_padre').insert({
        codigo, alumno_id: alumnoId,
        escuela_id: currentPerfil?.escuela_id || null,
        usado: false, created_at: new Date().toISOString(),
        expira_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
      if (error) throw error;
    }

    // Abrir ventana con QR imprimible
    const link = `${location.origin}${location.pathname}?vincular=${codigo}`;
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Código SIEMBRA · ${alumnoNombre}</title>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
    </head>
    <body style="font-family:'Helvetica Neue',sans-serif;padding:40px;max-width:380px;margin:0 auto;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">🌱</div>
      <h2 style="color:#0d5c2f;margin-bottom:4px;font-size:20px;">SIEMBRA · Código de vinculación</h2>
      <p style="color:#64748b;font-size:13px;margin-bottom:20px;">Para el alumno/a: <strong>${alumnoNombre}</strong></p>
      <canvas id="qr" style="border-radius:12px;border:6px solid white;box-shadow:0 2px 16px rgba(0,0,0,.12);"></canvas>
      <div style="margin-top:20px;font-size:36px;font-weight:900;letter-spacing:8px;color:#0d5c2f;font-family:monospace;">${codigo}</div>
      <p style="font-size:12px;color:#94a3b8;margin-top:8px;">Válido por 30 días · Un solo uso</p>
      <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb;">
      <p style="font-size:12px;color:#475569;line-height:1.6;">
        1. Descarga la app SIEMBRA o abre la página web<br>
        2. Crea tu cuenta como <strong>Familia</strong><br>
        3. Ingresa este código para vincular a tu hijo/a
      </p>
      <script>
        QRCode.toCanvas(document.getElementById('qr'), '${link}', {
          width: 200, margin: 2, color: { dark: '#0d5c2f', light: '#ffffff' }
        });
        setTimeout(() => window.print(), 900);
      <\/script>
    </body></html>`);

    hubToast(`✅ Código ${codigo} generado para ${alumnoNombre}`, 'ok');
    return codigo;
  } catch(e) {
    hubToast('Error generando código: ' + e.message, 'err');
    return null;
  }
}

// Detectar ?vincular=CODIGO en URL al cargar
(function() {
  const p = new URLSearchParams(location.search);
  const vc = p.get('vincular');
  if (vc) {
    window._vinculoCodigo = vc.toUpperCase();
    // Se procesará en pInit cuando el padre se loguee
  }
})();

function admDescargarPlantillaCSV() {
  const csv = 'nombre,apellido_p,apellido_m,curp,grupo,fecha_nacimiento\nAna,García,López,GARL100305MNLRPN07,1° A,2010-03-05\nCarlos,Mendoza,Ruiz,MERC100812HNLLRR08,1° A,2010-08-12';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'plantilla_alumnos_siembra.csv'; a.click();
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN — Módulo 3: Asignación materias por docente
// ══════════════════════════════════════════════════════════════════════

let _admMateriasData = []; // {docente_id, docente_nom, grupo_id, grupo_nom, materia}

function admRenderDocentes() {
  // Carga real desde Supabase
  admCargarAsignaciones();
}

async function admCargarAsignaciones() {
  const wrap = document.getElementById('adm-mat-tabla-wrap') || document.querySelector('#adm-p-materias .adm-mat-tabla');

  if (!sb || !currentPerfil?.escuela_cct) {
    admRenderAsignacionesDemo();
    return;
  }

  try {
    const { data, error } = await sb.from('docente_grupos')
      .select(`
        id, docente_id, grupo_id,
        materia, ciclo,
        usuarios!docente_id(nombre, apellido_p),
        grupos!grupo_id(nombre, grado, escuela_cct)
      `)
      .eq('activo', true)
      .eq('ciclo', window.CICLO_ACTIVO || '2025-2026');

    if (error) throw error;

    // Filtrar solo los de esta escuela
    const filtrados = (data || []).filter(r =>
      !r.grupos?.escuela_cct || r.grupos.escuela_cct === currentPerfil.escuela_cct
    );

    _admMateriasData = filtrados;
    window._admMateriasData = filtrados; // Exponer para renderMaterias

    if (wrap) admRenderTablaAsignaciones(filtrados);
    // Actualizar catálogo si está visible
    if (ADM.paginaActual === 'asignaciones') ADM.renderMaterias();
  } catch(e) {
    console.warn('[admMaterias]', e.message);
    admRenderAsignacionesDemo();
  }
}

function admRenderAsignacionesDemo() {
  const demoAsignaciones = window.SiembraDemoFixtures?.admin?.asignacionesResumen || ADM_MATERIAS_ASIGNADAS;
  _admMateriasData = demoAsignaciones.map((d,i) => ({
    _demo: true, docente_id: 'demo-'+i,
    usuarios: { nombre: d.docente.split(' ')[1]||'—', apellido_p: '' },
    docente_nom: d.docente, materias: d.materias, horas: d.horas,
  }));
  admRenderTablaAsignaciones(_admMateriasData);
}

function admRenderTablaAsignaciones(data) {
  const wrap = document.getElementById('adm-mat-tabla-wrap');
  if (!wrap) return;

  if (!data.length) {
    wrap.innerHTML = `<div style="padding:40px;text-align:center;color:#94a3b8;font-size:13px;">
      <div style="font-size:32px;margin-bottom:10px;">📚</div>
      <div style="font-weight:600;color:#64748b;margin-bottom:6px;">Sin asignaciones</div>
      <div>Agrega docentes y grupos primero.</div>
    </div>`;
    return;
  }

  const porDocente = window.SiembraAsignaciones?.agruparParaTabla(data) || {};

  wrap.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="background:#f8fafc;">
      <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#8890a8;text-transform:uppercase;">Docente</th>
      <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#8890a8;text-transform:uppercase;">Materias asignadas</th>
      <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#8890a8;text-transform:uppercase;">Grupos</th>
      <th style="padding:10px 16px;"></th>
    </tr></thead>
    <tbody>${Object.entries(porDocente).map(([key, d]) => `
      <tr style="border-bottom:1px solid #f4f5f8;">
        <td style="padding:12px 16px;font-weight:700;">${d.nombre}</td>
        <td style="padding:12px 16px;">
          ${d.asignaciones.map(a => `<span style="display:inline-block;padding:2px 8px;background:#e0f2fe;color:#0369a1;border-radius:10px;font-size:11px;font-weight:600;margin:2px;">${a.materia}</span>`).join('')}
        </td>
        <td style="padding:12px 16px;font-size:12px;color:#64748b;">
          ${[...new Set(d.asignaciones.map(a=>a.grupo))].filter(g=>g!=='—').join(', ')||'—'}
        </td>
        <td style="padding:12px 16px;">
          <button onclick="admAbrirAsignarMateria('${key}')" style="padding:5px 12px;background:#f0fdf4;border:1px solid #86efac;color:#15803d;border-radius:6px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;">+ Asignar</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

async function admAbrirAsignarMateria(docenteId) {
  const materia = prompt('Materia a asignar (ej: Matemáticas):');
  if (!materia?.trim()) return;
  const grupoNom = prompt('Grupo (ej: 6° A) — deja vacío para todos:') || '';

  const _mEscId  = currentPerfil?.escuela_id  || null;
  const _mEscCct = currentPerfil?.escuela_cct || null;
  if (!sb || (!_mEscId && !_mEscCct)) { hubToast('✅ Asignación demo guardada', 'ok'); return; }

  try {
    const grupoId = grupoNom ? _admGruposDB.find(g => g.nombre === grupoNom)?.id : null;
    const { error } = await sb.from('docente_grupos').upsert({
      docente_id: docenteId, grupo_id: grupoId, materia: materia.trim(), activo: true,
    }, { onConflict: 'docente_id,grupo_id' });
    if (error) throw error;
    hubToast(`✅ ${materia} asignada`, 'ok');
    admCargarAsignaciones();
  } catch(e) {
    hubToast('Error: ' + e.message, 'err');
  }
}

function admAsignarMateria() { hubToast('Usa el botón "+ Asignar" en la tabla', 'ok'); }

// Hook al nav para cargar datos al navegar


// ══════════════════════════════════════════════════════
//  CHART.JS — Gráfica asistencia con datos reales
// ══════════════════════════════════════════════════════
let _chartAsistencia = null;
async function renderChartAsistencia(grupoId) {
  const canvas = document.getElementById('chart-asistencia');
  if (!canvas) return;
  if (!window.Chart) return;

  let labels = [], presentes = [], ausentes = [];
  if (sb && grupoId) {
    const hoy = new Date();
    const hace7 = new Date(hoy); hace7.setDate(hace7.getDate() - 6);
    const fechaInicio = hace7.toISOString().split('T')[0];
    const fechaFin    = hoy.toISOString().split('T')[0];

    // UNA sola query en lugar de 7 queries en loop
    const { data, error } = await sb.from('asistencia')
      .select('fecha,estado')
      .eq('grupo_id', grupoId)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin);

    if (!error && data) {
      // Agrupar por fecha en JS
      const porFecha = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(hoy); d.setDate(d.getDate() - i);
        const f = d.toISOString().split('T')[0];
        porFecha[f] = { p: 0, a: 0, lbl: d.toLocaleDateString('es-MX', { weekday:'short', day:'numeric' }) };
      }
      data.forEach(r => {
        if (!porFecha[r.fecha]) return;
        if (r.estado === 'P' || r.estado === 'T') porFecha[r.fecha].p++;
        else if (r.estado === 'A') porFecha[r.fecha].a++;
      });
      Object.values(porFecha).forEach(d => {
        labels.push(d.lbl);
        presentes.push(d.p);
        ausentes.push(d.a);
      });
    } else {
      // fallback demo
      labels = ['Lun 6','Mar 7','Mié 8','Jue 9','Vie 10','Lun 13','Mar 14'];
      presentes = [30,28,31,29,30,27,31]; ausentes = [2,4,1,3,2,5,1];
    }
  } else {
    labels = ['Lun 6','Mar 7','Mié 8','Jue 9','Vie 10','Lun 13','Mar 14'];
    presentes = [30,28,31,29,30,27,31]; ausentes = [2,4,1,3,2,5,1];
  }

  if (_chartAsistencia) _chartAsistencia.destroy();
  const isDark = document.body.classList.contains('dark-mode');
  _chartAsistencia = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Presentes', data: presentes, backgroundColor: '#2db55d', borderRadius: 6 },
        { label: 'Ausentes',  data: ausentes,  backgroundColor: '#f87171', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: isDark ? '#c5c9e0' : '#3a3a36', font: { family: 'Sora', size: 12 } } } },
      scales: {
        x: { stacked: false, ticks: { color: isDark ? '#7c83a0' : '#9a9a90' }, grid: { color: isDark ? '#2e3350' : '#f0f0ec' } },
        y: { beginAtZero: true, ticks: { color: isDark ? '#7c83a0' : '#9a9a90' }, grid: { color: isDark ? '#2e3350' : '#f0f0ec' } }
      }
    }
  });
}

let _chartRendimiento = null;
function renderChartRendimiento(alumnosArr) {
  const canvas = document.getElementById('chart-rendimiento');
  if (!canvas || !window.Chart) return;
  const isDark = document.body.classList.contains('dark-mode');
  const labels = alumnosArr.slice(0,10).map(a => a.n.split(' ')[0]);
  const datos  = alumnosArr.slice(0,10).map(a => {
    const c = a.cals || [];
    return c.length ? (c.reduce((s,v)=>s+(+v||0),0)/c.length).toFixed(1) : 0;
  });
  const colores = datos.map(v => v>=8?'#2db55d':v>=6?'#f59e0b':'#f87171');
  if (_chartRendimiento) _chartRendimiento.destroy();
  _chartRendimiento = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Promedio', data: datos, backgroundColor: colores, borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { min:0, max:10, ticks:{ color: isDark?'#7c83a0':'#9a9a90' }, grid:{ color: isDark?'#2e3350':'#f0f0ec' } },
        y: { ticks:{ color: isDark?'#7c83a0':'#9a9a90', font:{size:11} }, grid:{ display:false } }
      }
    }
  });
}

function adminInit() { if(window.ADM){ ADM._initialized = false; ADM.sb=sb; ADM.currentPerfil=currentPerfil; ADM.currentUser=currentUser; ADM.hubToast=hubToast; ADM.escuelaCct=currentPerfil?.escuela_cct||ADM.escuelaCct||null; ADM.escuelaId=currentPerfil?.escuela_id||ADM.escuelaId||null; ADM.init(); _topbarPro({ titleId:'adm-topbar-title', prefix:'adm', searchPlaceholder:'Buscar alumno, grupo, personal…' }); return; }// legacy fallback below
  adminNav('dashboard');
  admCargarUsuarios();
  // Padrón
  const tb = document.getElementById('adm-padron-tb');
  if (tb) tb.innerHTML = [
    
    ['Carlos Hernández','6° A','HECC100415MNLRLN03'],
    ['Sofía Martínez',  '5° B','MASS110812MNLRTN01'],
    ['Luis Ramírez',    '4° A','RELL120305MNLRMN05'],
    ['Diego Torres',    '3° B','TOSD130722MNLRRG04'],
  ].map((r,i)=>`<tr style="border-bottom:1px solid #f4f5f8;"><td style="padding:10px 14px;">${i+1}</td><td style="padding:10px 14px;font-weight:600;">${r[0]}</td><td style="padding:10px 14px;">${r[1]}</td><td style="padding:10px 14px;font-size:11px;font-family:monospace;">${r[2]}</td><td style="padding:10px 14px;"><span style="background:#dcfce7;color:#15803d;padding:2px 9px;border-radius:10px;font-size:10px;font-weight:700;">Activo</span></td></tr>`).join('');
  // Negocios
  const nb = document.getElementById('adm-neg-tb');
  if (nb) nb.innerHTML = [
    ['Abarrotes Agustín','abarrotes','🌱×20',true],
    ['Super Toñita','abarrotes','🌱×10',true],
    ['Mercería La Rana','mercería','🌱×10',true],
    ['JM Mayoreo','cadena','🌱×50',true],
    ['Nuevo Negocio 1','abarrotes','🌱×20',false],
    ['Nuevo Negocio 2','mercería','🌱×10',false],
  ].map(r=>`<tr style="border-bottom:1px solid #f4f5f8;">
    <td style="padding:10px 14px;font-weight:700;">${r[0]}</td>
    <td style="padding:10px 14px;"><span style="background:#f4f5f8;padding:2px 9px;border-radius:10px;font-size:10px;font-weight:700;">${r[1]}</span></td>
    <td style="padding:10px 14px;font-weight:700;color:#0d5c2f;">${r[2]}</td>
    <td style="padding:10px 14px;"><span style="background:${r[3]?'#dcfce7':'#fef9c3'};color:${r[3]?'#15803d':'#a16207'};padding:2px 9px;border-radius:10px;font-size:10px;font-weight:700;">${r[3]?'✅ Aprobado':'⏳ Pendiente'}</span></td>
    <td style="padding:10px 14px;">${!r[3]?`<button onclick="this.closest('tr').querySelector('span').outerHTML='<span style=\'background:#dcfce7;color:#15803d;padding:2px 9px;border-radius:10px;font-size:10px;font-weight:700;\'>✅ Aprobado</span>';this.remove();hubToast('✅ ${r[0]} aprobado','ok')" style="padding:5px 11px;background:#dcfce7;color:#15803d;border:1.5px solid #86efac;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Sora',sans-serif;">✅ Aprobar</button>`:'<span style="color:#8890a8;font-size:11px;">—</span>'}</td>
  </tr>`).join('');
}

