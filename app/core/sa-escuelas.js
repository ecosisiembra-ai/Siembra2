// ── TABLAS ──
function renderTablaEscuelas(data) {
  const tb = document.getElementById('esc-tbody');
  if (!tb) return;
  if (!data.length) { tb.innerHTML = `<tr><td colspan="8" style="color:var(--text3);text-align:center;padding:32px;">Sin escuelas registradas</td></tr>`; return; }
  tb.innerHTML = data.map(e => {
    const activo = e.activa !== false;
    const met = saMetricasEscuela(e);
    const usrCnt = met.usuarios;
    const dir    = usuariosData.find(u => saUsuarioPerteneceAEscuela(u, e) && (u.rol === 'director' || u.rol === 'admin'));
    return `<tr>
      <td style="font-weight:500;">${e.nombre || '—'}</td>
      <td class="tbl-mono">${e.cct || '—'}</td>
      <td style="font-size:12px;">${dir ? dir.nombre || dir.email : '<span style="color:var(--text3)">Sin director</span>'}</td>
      <td style="font-size:12px;color:var(--text2);">${e.municipio || '—'}${e.estado ? ', ' + e.estado : ''}</td>
      <td><span class="badge badge-blue">${e.nivel || 'primaria'}</span></td>
      <td class="tbl-mono">${usrCnt}<div style="font-size:10px;color:var(--text3);margin-top:3px;">${met.alumnos} al - ${met.docentes} doc - ${met.grupos} gr</div></td>
      <td><span class="badge ${activo ? 'badge-green' : 'badge-gray'}"><span class="badge-dot2"></span>${activo ? 'activa' : 'inactiva'}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="editarEscuela('${e.id}')" title="Editar escuela">✏️</button>
          <button class="btn btn-outline btn-sm" onclick="generarInvEscuela('${e.id}','${e.nombre||e.cct}')">+ Invitar</button>
          <button class="btn btn-danger btn-sm" onclick="toggleEscuela('${e.id}',${activo})">${activo ? 'Suspender' : 'Activar'}</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarEscuela('${e.id}','${(e.nombre||e.cct||'').replace(/'/g,'')}')" title="Eliminar escuela permanentemente">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function editarEscuela(id) {
  const esc = escuelasData.find(e => e.id === id);
  if (!esc) return;
  // Pre-llenar formulario de nueva escuela con datos existentes
  navTo('nueva-escuela');
  setTimeout(() => {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    setVal('ne-nombre',    esc.nombre);
    setVal('ne-cct',       esc.cct);
    setVal('ne-municipio', esc.municipio);
    setVal('ne-estado',    esc.estado);
    setVal('ne-nivel',     esc.nivel);
    setVal('ne-plan-tipo', esc.plan_tipo);
    // Límite de alumnos: usar el valor real, no el default del HTML (500)
    const limEl = document.getElementById('ne-limite');
    if (limEl) limEl.value = esc.limite_alumnos != null ? esc.limite_alumnos : 500;
    // Director/admin - pre-llenar si existen
    setVal('ne-dir-nombre', esc.admin_nombre);
    setVal('ne-dir-email',  esc.admin_email);
    const btn = document.getElementById('ne-btn');
    if (btn) { btn.textContent = 'Guardar cambios ->'; btn.setAttribute('data-edit-id', id); }
    toast('Editando escuela - modifica los campos y guarda', 'info');
  }, 150);
}

function filtrarEscuelas(q) {
  const f = q.toLowerCase();
  renderTablaEscuelas(escuelasData.filter(e =>
    (e.nombre||'').toLowerCase().includes(f) || (e.cct||'').toLowerCase().includes(f)
  ));
}

function renderTablaUsuarios(data) {
  const tb = document.getElementById('usr-tbody');
  if (!tb) return;
  const rolBadge = { director:'badge-blue', admin:'badge-blue', docente:'badge-green', alumno:'badge-amber', padre:'badge-gray', ts:'badge-gray', superadmin:'badge-red' };
  tb.innerHTML = data.slice(0, 100).map(u => {
    const escNom = u.escuelas?.nombre || '—';
    const fecha  = u.created_at ? new Date(u.created_at).toLocaleDateString('es-MX',{day:'numeric',month:'short'}) : '—';
    return `<tr>
      <td style="font-weight:500;">${u.nombre || '—'}</td>
      <td class="tbl-mono" style="font-size:11px;">${u.email || '—'}</td>
      <td><span class="badge ${rolBadge[u.rol]||'badge-gray'}">${u.rol || '—'}</span></td>
      <td style="font-size:12px;color:var(--text2);">${escNom}</td>
      <td class="tbl-mono" style="font-size:11px;">${fecha}</td>
      <td><span class="badge ${u.activo!==false ? 'badge-green' : 'badge-gray'}"><span class="badge-dot2"></span>${u.activo!==false ? 'activo' : 'inactivo'}</span></td>
      <td><button class="btn btn-danger btn-sm" onclick="eliminarUsuario('${u.id}','${(u.email||'').replace(/'/g,'')}')">🗑️</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" style="color:var(--text3);text-align:center;padding:32px;">Sin usuarios</td></tr>`;
}

function filtrarUsuarios() {
  const escId = document.getElementById('usr-escuela-fil')?.value || '';
  const rol   = document.getElementById('usr-rol-fil')?.value || '';
  const f = usuariosData.filter(u =>
    (!escId || u.escuela_id === escId) &&
    (!rol || u.rol === rol)
  );
  renderTablaUsuarios(f);
}

function renderTablaInvitaciones(data) {
  const tb = document.getElementById('inv-tbody');
  if (!tb) return;
  tb.innerHTML = data.map(i => {
    const exp    = i.expira_at ? new Date(i.expira_at).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}) : '—';
    const usado  = i.estado === 'usado';
    const exp2   = i.expira_at && new Date(i.expira_at) < new Date();
    const estado = usado ? 'badge-gray' : exp2 ? 'badge-red' : 'badge-green';
    const estadoLbl = usado ? 'Usado' : exp2 ? 'Expirado' : 'Pendiente';
    return `<tr>
      <td class="tbl-mono" style="font-size:11px;cursor:pointer;" onclick="copiarTexto('${i.token}')" title="Clic para copiar">${(i.token||'').slice(0,16)}...</td>
      <td style="font-size:12px;">${i.escuelas?.nombre || i.escuela_id || '—'}</td>
      <td><span class="badge badge-blue">${i.rol||'—'}</span></td>
      <td class="tbl-mono" style="font-size:11px;">${i.email_destino||'—'}</td>
      <td class="tbl-mono" style="font-size:11px;">${exp}</td>
      <td><span class="badge ${estado}"><span class="badge-dot2"></span>${estadoLbl}</span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="copiarTexto('${i.token}')">Copiar</button>
          ${!usado && !exp2 ? `<button class="btn btn-outline btn-sm" onclick="reenviarInvitacion('${i.id}')">Reenviar</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="eliminarInvitacion('${i.id}')">Eliminar</button>
        </div>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" style="color:var(--text3);text-align:center;padding:32px;">Sin invitaciones</td></tr>`;
}

// ── HELPERS DE INVITACION ──
function invLinkParaRol(rol, token) {
  if (rol === 'alumno') return `${location.origin}/alumno.html?invite=${token}`;
  if (rol === 'padre')  return `${location.origin}/padres.html?invite=${token}`;
  return `${location.origin}/index.html?invite=${token}`;
}

async function enviarInvitacionBackend({ email, rol, escuelaNombre, escuelaId, escuelaCct, token, link }) {
  if (!email) return false;

  const resp = await fetch(SA_URL + '/functions/v1/invite-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      rol,
      escuela_nombre: escuelaNombre,
      escuela_id:     escuelaId,
      escuela_cct:    escuelaCct,
      invited_by:     currentAdmin?.email || 'superadmin',
      token,
      link,
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    console.warn('[invite-user] Error HTTP', resp.status, errBody);
    return false;
  }
  const data = await resp.json().catch(() => ({}));
  return Boolean(data.email_enviado || data.email_sent);
}

// ── CREAR ESCUELA ──
let _creandoEscuela = false;
async function crearEscuela() {
  if (_creandoEscuela) return;
  _creandoEscuela = true;

  const nombre    = document.getElementById('ne-nombre').value.trim();
  const cct       = document.getElementById('ne-cct').value.trim().toUpperCase();
  const municipio = document.getElementById('ne-municipio').value.trim();
  const estado    = document.getElementById('ne-estado').value;
  const nivel     = document.getElementById('ne-nivel').value;
  const limite    = parseInt(document.getElementById('ne-limite').value) || 500;
  const dirNombre = document.getElementById('ne-dir-nombre').value.trim();
  const dirEmail  = document.getElementById('ne-dir-email').value.trim().toLowerCase();
  const dirRol    = document.getElementById('ne-dir-rol').value;

  if (!nombre || !cct) { toast('Ingresa nombre y CCT de la escuela', 'err'); _creandoEscuela = false; return; }
  if (!dirEmail)        { toast('Ingresa el email del director/a', 'err'); _creandoEscuela = false; return; }

  const btn = document.getElementById('ne-btn');
  const editId = btn?.getAttribute('data-edit-id') || '';
  const isEdit = Boolean(editId);
  btn.disabled = true; btn.textContent = isEdit ? 'Guardando...' : 'Creando...';

  try {
    let escuelaId = null;

    if (sb) {
      // 1. Crear o actualizar escuela
      const planTipo = document.getElementById('ne-plan-tipo')?.value || 'basico';
      const escPayload = {
        nombre,
        cct,
        municipio,
        estado:      estado || 'Nuevo Le\xf3n',
        nivel:       nivel || 'primaria',
        plan_tipo:   planTipo,
        activa:      true,
        limite_alumnos: limite,
        admin_nombre: dirNombre || null,
        admin_email: dirEmail || null,
      };
      let esc = null;
      let escErr = null;
      if (isEdit) {
        ({ data: esc, error: escErr } = await sb.from('escuelas').update(escPayload).eq('id', editId).select('id').single());
      } else {
        escPayload.creado_en = new Date().toISOString();
        ({ data: esc, error: escErr } = await sb.from('escuelas').insert(escPayload).select('id').single());
      }
      if (escErr) throw escErr;
      escuelaId = esc.id;
    } else {
      escuelaId = 'demo-' + Date.now();
    }

    // 2. Generar o reutilizar invitacion
    let token = generarToken();
    const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (sb) {
      const { data: invExistente } = await sb
        .from('invitaciones')
        .select('id, token')
        .eq('escuela_id', escuelaId)
        .eq('email_destino', dirEmail)
        .eq('rol', dirRol)
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (invExistente?.id) {
        token = invExistente.token || token;
        const { error: invUpdErr } = await sb.from('invitaciones').update({
          nombre_destino: dirNombre,
          expira_at: expira,
          reenviado_at: new Date().toISOString(),
          escuela_cct: cct,
        }).eq('id', invExistente.id);
        if (invUpdErr) throw invUpdErr;
      } else {
        const { error: invErr } = await sb.from('invitaciones').insert({
          token, escuela_id: escuelaId, escuela_cct: cct, rol: dirRol,
          email_destino: dirEmail, nombre_destino: dirNombre,
          estado: 'pendiente', expira_at: expira,
          created_at: new Date().toISOString()
        });
        if (invErr) throw invErr;
      }
    }

    // 3. Mostrar resultado
    document.getElementById('ne-result').style.display = 'block';
    document.getElementById('ne-token-display').textContent = token;
    window._tokenActual = token;
    window._escuelaCreada = { nombre, cct, dirEmail, dirNombre, token };

    // QR real con qrcode.js
    const invLink = `${location.origin}/index.html?invite=${token}`;
    const qrBox = document.getElementById('ne-qr-box');
    if (qrBox) {
      qrBox.innerHTML = '<canvas id="ne-qr-canvas"></canvas>';
      if (window.QRCode) {
        QRCode.toCanvas(document.getElementById('ne-qr-canvas'), invLink,
          { width:140, margin:2, color:{ dark:'#0d5c2f', light:'#ffffff' } });
      } else {
        qrBox.innerHTML = `<div style="font-size:10px;text-align:center;color:#666;word-break:break-all;padding:8px;"><code>${token.slice(0,24)}...</code></div>`;
      }
    }
    window._invLinkActual = invLink;

    // Enviar email automatico via Edge Function
    if (dirEmail) {
      try {
        const emailEnviado = await enviarInvitacionBackend({
          email: dirEmail,
          rol: dirRol,
          escuelaNombre: nombre,
          escuelaId,
          escuelaCct: cct,
          token,
          link: invLink,
        });
        if (emailEnviado) {
          toast(`Escuela "${nombre}" ${isEdit ? 'actualizada' : 'creada'} - Email enviado a ${dirEmail}`, 'ok');
        } else {
          toast(`Escuela "${nombre}" ${isEdit ? 'actualizada' : 'creada'} - Email no enviado, comparte el link`, 'ok');
        }
      } catch(emailErr) {
        console.warn('Email send error:', emailErr);
        toast(`Escuela "${nombre}" ${isEdit ? 'actualizada' : 'creada'} - Token generado`, 'ok');
      }
    } else {
      toast(`Escuela "${nombre}" ${isEdit ? 'actualizada' : 'creada'} - Token generado`, 'ok');
    }

    // Recargar datos
    await cargarEscuelas();
    await cargarInvitaciones();
    renderDashboard();

  } catch(e) {
    toast('Error: ' + e.message, 'err');
  } finally {
    _creandoEscuela = false;
    btn.disabled = false;
    btn.textContent = 'Crear escuela y generar invitacion ->';
    btn.removeAttribute('data-edit-id');
  }
}

function limpiarFormEscuela() {
  ['ne-nombre','ne-cct','ne-municipio','ne-dir-nombre','ne-dir-email'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('ne-result').style.display = 'none';
  const btn = document.getElementById('ne-btn');
  if (btn) {
    btn.textContent = 'Crear escuela y generar invitacion ->';
    btn.removeAttribute('data-edit-id');
  }
}

function copiarToken() {
  const t = document.getElementById('ne-token-display').textContent;
  copiarTexto(t);
}

function copiarLinkInvitacion() {
  const t = window._tokenActual;
  if (!t) return;
  const link = `${location.origin}/?invite=${t}`;
  copiarTexto(link);
}

function compartirWhatsApp() {
  const link = window._invLinkActual;
  if (!link) return;
  const d = window._escuelaCreada || {};
  const token = window._tokenActual || document.getElementById('ne-token-display')?.textContent || '';
  const msg = encodeURIComponent(`\uD83C\uDF31 *SIEMBRA* - Invitacion de acceso

\uD83D\uDCCD Escuela: *${d.nombre||'SIEMBRA'}*

\uD83D\uDC49 *Paso 1:* Abre este link para crear tu cuenta:
${link}

\uD83D\uDC49 *Paso 2:* Completa tu nombre, correo y contrasena

\u23F3 La invitacion expira en 7 dias.

_Si el link no funciona, ve a siembra-nine.vercel.app y usa este token:_
*${token}*`);
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

// ── EMAIL INVITACION ──
async function enviarEmailInvitacion() {
  const d = window._escuelaCreada;
  if (!d || !d.dirEmail) { toast('No hay datos de invitacion para enviar', 'err'); return; }
  const emailEnviado = await enviarInvitacionBackend({
    email: d.dirEmail,
    rol: document.getElementById('ne-dir-rol')?.value || 'director',
    escuelaNombre: d.nombre,
    escuelaId: escuelasData.find(e => e.cct === d.cct)?.id || null,
    escuelaCct: d.cct,
    token: d.token || window._tokenActual,
    link: window._invLinkActual || invLinkParaRol('director', d.token || window._tokenActual || ''),
  }).catch(() => false);

  if (emailEnviado) {
    toast('\uD83D\uDCE7 Email enviado automaticamente a ' + d.dirEmail, 'ok');
    return;
  }

  const subject = encodeURIComponent('\uD83C\uDF31 SIEMBRA - Invitacion de acceso - ' + (d.nombre || ''));
  const body = encodeURIComponent(
    `Hola ${d.dirNombre || ''},\n\n` +
    `Se te ha generado una invitacion para acceder a SIEMBRA como administrador/director de la escuela ${d.nombre} (${d.cct}).\n\n` +
    `Tu link de acceso:\n${window._invLinkActual || ''}\n\n` +
    `Este token expira en 7 dias.\n\n` +
    `- Equipo SIEMBRA`
  );
  window.open(`mailto:${d.dirEmail}?subject=${subject}&body=${body}`, '_blank');
  toast('\uD83D\uDCE7 Email automatico no disponible; se abrio tu cliente de correo', 'info');
}

// ── COMPARTIR INVITACION (modal) ──
function invCopiarLink() {
  const link = window._invLinkActual;
  if (link) copiarTexto(link);
  else toast('No hay link generado', 'err');
}

function invWhatsApp() {
  const link = window._invLinkActual;
  if (!link) return;
  const email = document.getElementById('inv-email')?.value || '';
  const rol = document.getElementById('inv-rol-sel')?.value || 'usuario';
  const escSel = document.getElementById('inv-escuela-sel');
  const escNombre = escSel?.options[escSel.selectedIndex]?.text?.split('(')[0]?.trim() || 'SIEMBRA';
  const token = document.getElementById('inv-token-display')?.textContent || '';
  const msg = encodeURIComponent(`\uD83C\uDF31 *SIEMBRA* - Invitacion de acceso

\uD83D\uDCCD Escuela: *${escNombre}*
\uD83D\uDC64 Rol: *${rol}*

\uD83D\uDC49 *Abre este link para crear tu cuenta:*
${link}

\u23F3 Expira en 7 dias.

_Token de respaldo: ${token}_`);
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

function invEnviarEmail() {
  const link = window._invLinkActual;
  const email = document.getElementById('inv-email')?.value || '';
  const rol = document.getElementById('inv-rol-sel')?.value || 'usuario';
  const escSel = document.getElementById('inv-escuela-sel');
  const escNombre = escSel?.options[escSel.selectedIndex]?.text?.split('(')[0]?.trim() || 'SIEMBRA';
  const token = document.getElementById('inv-token-display')?.textContent || '';
  const escuelaId = escSel?.value || null;
  const escuela = escuelasData.find(e => e.id === escuelaId);

  enviarInvitacionBackend({
    email,
    rol,
    escuelaNombre: escNombre,
    escuelaId,
    escuelaCct: escuela?.cct || null,
    token,
    link,
  }).then((emailEnviado) => {
    if (emailEnviado) {
      toast('\uD83D\uDCE7 Email enviado automaticamente a ' + (email || 'destinatario'), 'ok');
      return;
    }

    const subject = encodeURIComponent(`\uD83C\uDF31 SIEMBRA - Invitacion como ${rol} - ${escNombre}`);
    const body = encodeURIComponent(
      `Hola,\n\n` +
      `Se te ha generado una invitacion para acceder a SIEMBRA como ${rol} de la escuela ${escNombre}.\n\n` +
      `Abre este link para crear tu cuenta:\n${link}\n\n` +
      `Este enlace expira en 7 dias.\n\n` +
      `- Equipo SIEMBRA`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    toast('\uD83D\uDCE7 Email automatico no disponible; se abrio tu correo', 'info');
  }).catch(() => {
    const subject = encodeURIComponent(`\uD83C\uDF31 SIEMBRA - Invitacion como ${rol} - ${escNombre}`);
    const body = encodeURIComponent(
      `Hola,\n\n` +
      `Se te ha generado una invitacion para acceder a SIEMBRA como ${rol} de la escuela ${escNombre}.\n\n` +
      `Abre este link para crear tu cuenta:\n${link}\n\n` +
      `Este enlace expira en 7 dias.\n\n` +
      `- Equipo SIEMBRA`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    toast('\uD83D\uDCE7 Email automatico no disponible; se abrio tu correo', 'info');
  });
}

async function reenviarInvitacion(id) {
  const invs = window.invitacionesData || invitacionesData || [];
  const inv = invs.find(x => x.id === id);
  if (!inv) { toast('No se encontro la invitacion', 'err'); return; }

  const token = inv.token || generarToken();
  const link = invLinkParaRol(inv.rol, token);
  const escuelaNombre = inv.escuelas?.nombre || (escuelasData.find(e => e.id === inv.escuela_id)?.nombre) || 'SIEMBRA';

  const emailEnviado = await enviarInvitacionBackend({
    email: inv.email_destino,
    rol: inv.rol,
    escuelaNombre,
    escuelaId: inv.escuela_id,
    escuelaCct: inv.escuela_cct,
    token,
    link,
  }).catch(() => false);

  if (sb) {
    await sb.from('invitaciones').update({
      reenviado_at: new Date().toISOString(),
      expira_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      token,
    }).eq('id', id);
    await cargarInvitaciones();
  }

  toast(emailEnviado ? `Email reenviado a ${inv.email_destino}` : 'Invitacion actualizada; comparte el link manualmente', emailEnviado ? 'ok' : 'info');
}

async function eliminarInvitacion(id) {
  const invs = window.invitacionesData || invitacionesData || [];
  const inv = invs.find(x => x.id === id);
  if (!inv) { toast('No se encontro la invitacion', 'err'); return; }
  if (!confirm(`Eliminar la invitacion para ${inv.email_destino || 'este usuario'}?`)) return;
  if (!sb) { toast('Supabase no disponible', 'err'); return; }

  const { error } = await sb.from('invitaciones').delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }

  await cargarInvitaciones();
  toast('Invitacion eliminada', 'ok');

async function eliminarEscuela(id, nombre) {
  if (!confirm('¿Eliminar la escuela "' + (nombre || id) + '" permanentemente? Esta accion no se puede deshacer.')) return;
  if (!confirm('CONFIRMAR: Se eliminaran todos los datos de la escuela. ¿Continuar?')) return;
  if (!sb) { toast('Supabase no disponible', 'err'); return; }
  try {
    // Eliminar usuarios de la escuela
    await sb.from('usuarios').delete().eq('escuela_id', id);
    // Eliminar invitaciones de la escuela
    await sb.from('invitaciones').delete().eq('escuela_id', id);
    // Eliminar la escuela
    const { error } = await sb.from('escuelas').delete().eq('id', id);
    if (error) throw error;
    await cargarEscuelas();
    await cargarUsuarios();
    toast('Escuela eliminada correctamente', 'ok');
  } catch(e) {
    toast('Error al eliminar: ' + (e.message || e), 'err');
  }
}

async function eliminarUsuario(id, email) {
  if (!confirm('¿Eliminar al usuario ' + (email || id) + '? Esta accion no se puede deshacer.')) return;
  if (!sb) { toast('Supabase no disponible', 'err'); return; }
  try {
    // Eliminar de tabla usuarios
    const { error } = await sb.from('usuarios').delete().eq('id', id);
    if (error) throw error;
    // Intentar eliminar de Auth (puede fallar sin service role en frontend)
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        await fetch(window.SA_URL + '/auth/v1/admin/users/' + id, {
          method: 'DELETE',
          headers: { 'apikey': window.SA_KEY || '', 'Authorization': 'Bearer ' + (window.SA_SECRET || session.access_token) }
        });
      }
    } catch(_) {}
    await cargarUsuarios();
    toast('Usuario eliminado correctamente', 'ok');
  } catch(e) {
    toast('Error al eliminar: ' + (e.message || e), 'err');
  }
}
}
