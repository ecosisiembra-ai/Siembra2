// ══════════════════════════════════════════════════════════
// DIRECTOR — Módulo de Invitaciones
// ══════════════════════════════════════════════════════════

let _dirInvLink = '';

function dirAbrirModalInv() {
  const modal = document.getElementById('dir-modal-inv');
  if (modal) { modal.style.display = 'flex'; }
  document.getElementById('dir-inv-result').style.display = 'none';
  document.getElementById('dir-inv-email').value = '';
  document.getElementById('dir-inv-nombre').value = '';
  document.getElementById('dir-inv-gen-btn').textContent = 'Generar invitación →';
  document.getElementById('dir-inv-gen-btn').disabled = false;
}

function dirCerrarModalInv() {
  const modal = document.getElementById('dir-modal-inv');
  if (modal) modal.style.display = 'none';
  _dirInvLink = '';
}

async function dirGenerarInvBtn() {
  const rol    = document.getElementById('dir-inv-rol').value;
  const email  = document.getElementById('dir-inv-email').value.trim().toLowerCase();
  const nombre = document.getElementById('dir-inv-nombre').value.trim();
  const dias   = parseInt(document.getElementById('dir-inv-dias').value) || 7;
  const btn    = document.getElementById('dir-inv-gen-btn');

  btn.disabled = true; btn.textContent = 'Generando…';

  // Usar dirGenerarInvitacion del módulo de onboarding
  const resultado = await dirGenerarInvitacion(rol, email || null, nombre || null, dias);

  if (resultado) {
    _dirInvLink = resultado.link;
    document.getElementById('dir-inv-link-display').textContent = resultado.link;
    document.getElementById('dir-inv-result').style.display = 'block';
    btn.textContent = '✓ Generada';
    // Recargar tabla
    dirCargarInvitaciones();
  } else {
    btn.disabled = false;
    btn.textContent = 'Generar invitación →';
  }
}

function dirCopiarInvLink() {
  if (!_dirInvLink) return;
  navigator.clipboard.writeText(_dirInvLink).then(() => hubToast('✅ Link copiado', 'ok'))
    .catch(() => { /* fallback */ const ta=document.createElement('textarea'); ta.value=_dirInvLink; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); hubToast('✅ Link copiado', 'ok'); });
}

function dirCompartirWhatsapp() {
  if (!_dirInvLink) return;
  const rol = document.getElementById('dir-inv-rol').value;
  const rolLabels = { docente:'docente', coordinador:'coordinador/a', ts:'trabajo social', prefecto:'prefecto/a', tutor:'tutor/a', subdirector:'subdirector/a', admin:'administrador/a' };
  const msg = encodeURIComponent(`¡Hola! Te invito a registrarte en SIEMBRA como ${rolLabels[rol]||rol} de nuestra escuela.

Entra a este link para crear tu cuenta:
${_dirInvLink}

El link expira en ${document.getElementById('dir-inv-dias').value} días.`);
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

function dirImprimirQR() {
  if (!_dirInvLink) return;
  const rol = document.getElementById('dir-inv-rol').value;
  const escNom = currentPerfil?.escuela_nombre || 'SIEMBRA';
  const w = window.open('', '_blank');
  const qrSrc = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
  const html = '<!DOCTYPE html><html><head><title>SIEMBRA QR</title>'
    + '<scr' + "ipt src=\"" + qrSrc + "\"><\\/scr" + "ipt>"
    + '</head><body style="font-family:sans-serif;text-align:center;padding:40px;">'
    + '<h2 style="color:#0d5c2f;">SIEMBRA</h2>'
    + '<p style="color:#475569;font-size:13px;">' + escNom + '</p>'
    + '<canvas id="qr" style="border:8px solid white;border-radius:12px;"></canvas>'
    + '<p style="font-size:13px;color:#0d5c2f;font-weight:700;margin-top:16px;">'
    + 'Registrarse como: ' + rol + '</p>'
    + '<p style="font-size:11px;color:#94a3b8;word-break:break-all;">' + _dirInvLink + '</p>'
    + '<scr' + "ipt>QRCode.toCanvas(document.getElementById('qr'),'" + _dirInvLink + "',{width:200,color:{dark:'#0d5c2f',light:'#fff'}});setTimeout(()=>window.print(),800);<\\/scr" + "ipt>"
    + '</body></html>';
  w.document.write(html);
  w.document.close();
}

async function dirCargarInvitaciones() {
  const tbody = document.getElementById('dir-inv-tbody');
  const cnt   = document.getElementById('dir-inv-cnt');
  if (!tbody) return;

  const _escId  = currentPerfil?.escuela_id  || null;
  const _escCct = currentPerfil?.escuela_cct || null;
  if (!sb || (!_escId && !_escCct)) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:32px;text-align:center;color:var(--gris-50);">
      Conecta Supabase para ver las invitaciones generadas.</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--gris-50);">Cargando…</td></tr>`;

  try {
    let qInv = sb.from('invitaciones').select('*').order('created_at', { ascending: false }).limit(50);
    if (_escId) qInv = qInv.eq('escuela_id', _escId);
    else qInv = qInv.eq('escuela_cct', _escCct);
    const { data, error } = await qInv;

    if (error) throw error;

    const rolIcos = { docente:'👩‍🏫', director:'👩‍💼', coordinador:'📋', ts:'⚖️', prefecto:'🛡️', tutor:'🎓', subdirector:'🏫', admin:'⚙️' };
    const rows = (data || []);
    if (cnt) cnt.textContent = `${rows.length} invitaciones`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:32px;text-align:center;color:var(--gris-50);">
        Aún no has generado invitaciones.<br>
        <button onclick="dirAbrirModalInv()" class="btn btn-primary btn-sm" style="margin-top:10px;">+ Generar primera invitación</button>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(inv => {
      const exp    = inv.expira_at ? new Date(inv.expira_at) : null;
      const expirado = exp && exp < new Date();
      const estado = inv.estado === 'usado' ? 'usado' : expirado ? 'expirado' : 'pendiente';
      const estadoBadge = {
        pendiente: '<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">● Pendiente</span>',
        usado:     '<span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">✓ Usado</span>',
        expirado:  '<span style="background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">✕ Expirado</span>',
      }[estado];
      const expStr = exp ? exp.toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' }) : '—';
      const base = location.origin + '/index.html';
      const link = `${base}?invite=${inv.token}`;

      return `<tr style="border-top:1px solid #f1f5f9;">
        <td style="padding:12px 16px;">${rolIcos[inv.rol]||'👤'} <strong>${inv.rol}</strong></td>
        <td style="padding:12px 16px;font-size:12px;color:var(--gris-50);">${inv.email_destino || '—'}</td>
        <td style="padding:12px 16px;font-size:12px;color:${expirado?'#b91c1c':'var(--gris-50)'};">${expStr}</td>
        <td style="padding:12px 16px;">${estadoBadge}</td>
        <td style="padding:12px 16px;">
          ${estado === 'pendiente' ? `
            <div style="display:flex;gap:6px;">
              <button onclick="navigator.clipboard.writeText('${link}').then(()=>hubToast('✅ Link copiado','ok'))" class="btn btn-outline btn-sm">Copiar link</button>
              <button onclick="window.open('https://wa.me/?text='+encodeURIComponent('Regístrate en SIEMBRA:\n${link}'),'_blank')" class="btn btn-outline btn-sm" aria-label="Comentar">💬</button>
            </div>` : '<span style="color:var(--gris-50);font-size:12px;">—</span>'}
        </td>
      </tr>`;
    }).join('');

  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:24px;text-align:center;color:#b91c1c;font-size:13px;">
      Error cargando invitaciones: ${e.message}</td></tr>`;
  }
}