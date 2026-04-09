// ── MODAL INVITACION ──
function abrirModalInvitacion() {
  // Poblar selector de escuelas SIEMPRE desde escuelasData actualizado
  const sel = document.getElementById('inv-escuela-sel');
  sel.innerHTML = '<option value="">Seleccionar escuela...</option>' +
    escuelasData.map(e => `<option value="${e.id}">${e.nombre || e.cct} (${e.cct||''})</option>`).join('');
  document.getElementById('inv-result').style.display = 'none';
  document.getElementById('modal-inv').classList.add('open');
}

function cerrarModalInv() {
  document.getElementById('modal-inv').classList.remove('open');
}

async function generarInvitacion() {
  let escuelaId = document.getElementById('inv-escuela-sel').value;
  const rol     = document.getElementById('inv-rol-sel').value;
  const email   = document.getElementById('inv-email').value.trim().toLowerCase();
  const dias    = parseInt(document.getElementById('inv-dias').value) || 7;

  if (!email) { toast('Ingresa el email del usuario', 'err'); return; }
  if (!rol)   { toast('Selecciona un rol', 'err'); return; }

  // Resolver nombre de escuela del selector
  const escuelaSel = document.getElementById('inv-escuela-sel');
  const escuelaNombre = escuelaSel.options[escuelaSel.selectedIndex]?.text || '';

  // Si es ID demo (e1, e2...) intentar resolver UUID real de Supabase
  if (escuelaId && escuelaId.length < 10) {
    if (sb) {
      const { data } = await sb.from('escuelas').select('id, nombre').limit(20);
      if (data && data.length > 0) {
        // Buscar por nombre
        const match = data.find(e =>
          escuelaNombre.includes(e.nombre) || e.nombre.includes(escuelaNombre.split('(')[0].trim())
        );
        if (match) escuelaId = match.id;
        else escuelaId = data[0].id; // usar primera escuela real
      }
    }
    // Si sigue siendo demo ID, continuar igual (la Edge Function lo acepta como null)
    if (escuelaId.length < 10) escuelaId = null;
  }

  const btn = document.getElementById('inv-btn');
  btn.disabled = true; btn.textContent = 'Generando...';

  try {
    // 1. PRIMERO generar y guardar el token en la BD
    const token  = generarToken();
    const expira = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();

    if (sb) {
      const { error: insertErr } = await sb.from('invitaciones').insert({
        token,
        escuela_id: escuelaId || null,
        rol,
        email_destino: email,
        nombre_destino: email,
        estado: 'pendiente',
        expira_at: expira,
        created_at: new Date().toISOString(),
      });
      if (insertErr) {
        console.warn('Error guardando invitacion:', insertErr.message);
        // Si falla el insert (ej: token duplicado), reintentar con nuevo token
        const token2 = generarToken();
        await sb.from('invitaciones').insert({
          token: token2, escuela_id: escuelaId || null, rol,
          email_destino: email, estado: 'pendiente', expira_at: expira,
          created_at: new Date().toISOString(),
        });
        // Use token2 instead
        window._tokenGenerado = token2;
      } else {
        window._tokenGenerado = token;
      }
    } else {
      window._tokenGenerado = token;
    }

    const tokenFinal = window._tokenGenerado || token;

    // 2. Mostrar resultado visual INMEDIATAMENTE (el usuario ya tiene su token)
    document.getElementById('inv-token-display').textContent = tokenFinal;
    document.getElementById('inv-result').style.display = 'block';
    const invLink = invLinkParaRol(rol, tokenFinal);
    window._invLinkActual = invLink;
    const invCopyEl = document.getElementById('inv-link-display');
    if (invCopyEl) invCopyEl.textContent = invLink;

    // 3. Enviar email via Edge Function (solo envia correo, NO crea usuario)
    try {
      let jwt = SA_KEY;
      if (sb) {
        try {
          const { data: { session } } = await sb.auth.getSession();
          if (session?.access_token) jwt = session.access_token;
        } catch(e) {}
      }
      const escuelaSel = document.getElementById('inv-escuela-sel');
      const escNombre = escuelaSel?.options[escuelaSel.selectedIndex]?.text?.split('(')[0]?.trim() || '';

      const resp = await fetch(SA_URL + '/functions/v1/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + jwt,
        },
        body: JSON.stringify({
          email,
          rol,
          escuela_nombre: escNombre || null,
          invited_by: currentAdmin?.email || 'superadmin',
          token: tokenFinal,
          link: invLink,
        }),
      });
      if (resp.ok) {
        const data = await resp.json().catch(() => ({}));
        if (data.email_enviado) {
          toast('Invitacion enviada por email a ' + email, 'ok');
        } else {
          toast('Token generado. Email no enviado - comparte el link manualmente.', 'ok');
        }
      } else {
        toast('Token generado. Comparte por WhatsApp o copia el link.', 'ok');
      }
    } catch(emailErr) {
      console.warn('Email send error:', emailErr.message);
      toast('Token generado. Comparte por WhatsApp o copia el link.', 'ok');
    }

    await cargarInvitaciones();
    renderTablaInvitaciones(invitacionesData);

  } catch(e) {
    console.error('generarInvitacion error:', e);
    toast('Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Generar token ->';
  }
}

function generarInvEscuela(escuelaId, escuelaNom) {
  // Asegurar que usamos el ID real (no demo)
  // Si el ID parece demo, buscar el UUID real en escuelasData por nombre
  let realId = escuelaId;
  if (escuelaId && !escuelaId.includes('-')) {
    // Parece un ID demo (e1, e2) - buscar el real
    const found = escuelasData.find(e => e.id === escuelaId || e.nombre === escuelaNom);
    if (found) realId = found.id;
  }
  abrirModalInvitacion();
  setTimeout(() => {
    const sel = document.getElementById('inv-escuela-sel');
    if (sel) sel.value = realId;
  }, 50);
}

async function toggleEscuela(id, activo) {
  if (!sb) { toast('Sin conexion Supabase', 'err'); return; }
  // Try activa first, then activo
  let success = false;
  for (const col of ['activa', 'activo']) {
    const payload = {};
    payload[col] = !activo;
    const { error } = await sb.from('escuelas').update(payload).eq('id', id);
    if (!error) { success = true; break; }
    if (error && !error.message.includes('column')) { toast('Error: ' + error.message, 'err'); return; }
  }
  if (!success) { toast('Error: no se encontro columna activa/activo', 'err'); return; }
  await cargarEscuelas();
  renderTablaEscuelas(escuelasData);
  toast(activo ? 'Escuela suspendida' : 'Escuela activada', 'ok');
}

// ── ACTIVIDAD ──