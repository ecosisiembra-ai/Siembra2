window.SiembraRegistration = (function() {
  const state = {
    regRole: null,
    escuelaConfirmada: null,
    cctBusqTimer: null,
  };

  function syncState() {
    window.regRole = state.regRole;
    window._escuelaConfirmada = state.escuelaConfirmada;
  }

  function regBuscarEscuela(rawCct) {
    const value = rawCct.trim().toUpperCase();
    const found = document.getElementById('reg-escuela-found');
    const notFound = document.getElementById('reg-escuela-notfound');
    const icon = document.getElementById('reg-cct-ico');
    const btnReg = document.querySelector('#panel-registro .btn-login');
    state.escuelaConfirmada = null;
    syncState();
    if (btnReg) btnReg.disabled = true;

    if (value.length < 10) {
      found.style.display = 'none';
      notFound.style.display = 'none';
      icon.textContent = '🔍';
      return;
    }

    if (!window.cctValidarFormato(value)) {
      found.style.display = 'none';
      notFound.style.display = 'block';
      notFound.innerHTML = '❌ Formato inválido. Ejemplo correcto: <strong>19EPR0001A</strong> (estado + nivel + número + letra)';
      icon.textContent = '❌';
      return;
    }

    const decoded = window.cctDecodificar(value);
    found.style.display = 'block';
    found.innerHTML = `<span style="color:#a16207;">⏳ Buscando…</span> · ${decoded.estado} · ${decoded.nivel} · ${decoded.sostenimiento}`;
    notFound.style.display = 'none';
    icon.textContent = '⏳';

    clearTimeout(state.cctBusqTimer);
    state.cctBusqTimer = setTimeout(async () => {
      let escuela = await window.cctBuscarEnSupabase(value);
      if (!escuela) escuela = window.cctBuscarDemo(value);

      if (escuela) {
        state.escuelaConfirmada = escuela;
        syncState();
        found.style.display = 'block';
        found.innerHTML = `
          <div style="font-weight:700;margin-bottom:4px;">✅ ${escuela.nombre}</div>
          <div style="font-size:11px;font-weight:400;color:#166534;line-height:1.7;">
            📍 ${escuela.municipio}, ${escuela.estado}<br>
            🏛️ Zona ${escuela.zona} · Sector ${escuela.sector || '—'} · ${escuela.turno}<br>
            🎓 ${escuela.nivel} · ${escuela.sostenimiento}<br>
            ${escuela.director ? `👤 Director/a: ${escuela.director}` : ''}
          </div>`;
        notFound.style.display = 'none';
        icon.textContent = '✅';
        if (btnReg) btnReg.disabled = false;
      } else {
        state.escuelaConfirmada = { cct: value, ...decoded, nombre: `Escuela ${value}`, municipio: '—', estado: decoded.estado };
        syncState();
        found.style.display = 'block';
        found.innerHTML = `
          <div style="font-weight:700;margin-bottom:4px;">⚠️ CCT válido — escuela no registrada en SIEMBRA aún</div>
          <div style="font-size:11px;font-weight:400;color:#92400e;line-height:1.7;">
            ${decoded.estado} · ${decoded.nivel} · ${decoded.sostenimiento}<br>
            Tu escuela se registrará automáticamente. El director/a recibirá una solicitud de activación.<br>
            También puedes consultar en <a href="https://siged.sep.gob.mx/SIGED/escuelas.html" target="_blank" style="color:#92400e;">siged.sep.gob.mx</a> para verificar el CCT.
          </div>`;
        notFound.style.display = 'none';
        icon.textContent = '⚠️';
        if (btnReg) btnReg.disabled = false;
      }
    }, 600);
  }

  function hubSwitchTab(tab) {
    document.getElementById('panel-login').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('panel-registro').style.display = tab === 'registro' ? 'block' : 'none';
    document.getElementById('tab-login').style.background = tab === 'login' ? 'white' : 'transparent';
    document.getElementById('tab-registro').style.background = tab === 'registro' ? 'white' : 'transparent';
    document.getElementById('tab-login').style.color = tab === 'login' ? '#0d5c2f' : '#64748b';
    document.getElementById('tab-registro').style.color = tab === 'registro' ? '#0d5c2f' : '#64748b';
    document.getElementById('tab-login').style.boxShadow = tab === 'login' ? '0 1px 4px rgba(0,0,0,.08)' : 'none';
    document.getElementById('tab-registro').style.boxShadow = tab === 'registro' ? '0 1px 4px rgba(0,0,0,.08)' : 'none';
  }

  function regSelectRole(role) {
    state.regRole = role;
    syncState();
    ['docente', 'director', 'admin', 'subdirector', 'coordinador', 'prefecto', 'ts', 'padre'].forEach(currentRole => {
      const el = document.getElementById(`rr-${currentRole}`);
      if (el) el.classList.toggle('active', currentRole === role);
    });

    const bloqFam = document.getElementById('reg-bloque-familia');
    const bloqCct = document.getElementById('reg-bloque-cct');
    const bloqToken = document.getElementById('reg-bloque-token');
    const bloqPassFam = document.getElementById('reg-bloque-pass-familia');
    const extra = document.getElementById('reg-campo-extra');
    const footer = document.getElementById('reg-footer-hint');
    const rolesConToken = ['director', 'admin', 'subdirector', 'coordinador', 'prefecto', 'ts', 'docente'];

    if (role === 'padre') {
      bloqFam.style.display = 'block';
      bloqCct.style.display = 'none';
      bloqToken.style.display = 'none';
      if (bloqPassFam) bloqPassFam.style.display = 'block';
      if (footer) footer.textContent = 'La escuela de tu hijo/a vinculará tu cuenta una vez verificados los datos';
    } else if (rolesConToken.includes(role)) {
      bloqFam.style.display = 'none';
      bloqCct.style.display = 'none';
      bloqToken.style.display = 'block';
      if (bloqPassFam) bloqPassFam.style.display = 'none';
      if (extra) extra.style.display = 'none';
      if (footer) footer.textContent = '🔑 Ingresa el token y crea tu contraseña en un solo paso';
    } else {
      bloqFam.style.display = 'none';
      bloqCct.style.display = 'block';
      bloqToken.style.display = 'none';
      if (bloqPassFam) bloqPassFam.style.display = 'block';
      if (extra) extra.style.display = 'none';
      if (footer) footer.textContent = 'Tu cuenta será activada por el director/a de la escuela';
    }
  }

  function regBuscarEscuelaNombre(txt) {
    const found = document.getElementById('reg-esc-nombre-found');
    if (!found) return;
    clearTimeout(state.cctBusqTimer);
    if (txt.trim().length < 4) {
      found.style.display = 'none';
      return;
    }
    state.cctBusqTimer = setTimeout(() => {
      const query = txt.trim().toLowerCase();
      const match = (window.ESCUELAS_DEMO || []).filter(escuela => escuela.nombre.toLowerCase().includes(query));
      if (match.length) {
        state.escuelaConfirmada = match[0];
        syncState();
        found.style.display = 'block';
        found.innerHTML = match.slice(0, 3).map(escuela =>
          `<div style="cursor:pointer;padding:3px 0;" onclick="regEscogerEscuela('${escuela.cct}')">✅ <strong>${escuela.nombre}</strong> · ${escuela.municipio}</div>`
        ).join('');
      } else {
        found.style.display = 'block';
        found.innerHTML = '<span style="color:#92400e;">⚠️ No encontrada en el sistema. La escuela la vinculará manualmente.</span>';
      }
    }, 400);
  }

  function regEscogerEscuela(cct) {
    const escuela = (window.ESCUELAS_DEMO || []).find(item => item.cct === cct);
    if (!escuela) return;
    state.escuelaConfirmada = escuela;
    syncState();
    const input = document.getElementById('reg-alumno-escuela');
    if (input) input.value = escuela.nombre;
    const found = document.getElementById('reg-esc-nombre-found');
    if (found) found.innerHTML = `✅ <strong>${escuela.nombre}</strong> · ${escuela.municipio}, ${escuela.estado}`;
  }

  async function hubDoRegistro() {
    const nombre = document.getElementById('reg-nombre')?.value.trim();
    const apellidos = document.getElementById('reg-apellidos')?.value.trim();
    const email = document.getElementById('reg-email')?.value.trim().toLowerCase();
    const cctRaw = document.getElementById('reg-cct')?.value.trim().toUpperCase();
    const errEl = document.getElementById('reg-error');
    const btn = document.querySelector('#panel-registro .btn-login');

    errEl.style.display = 'none';

    const rolesConToken = ['director', 'admin', 'subdirector', 'coordinador', 'prefecto', 'ts', 'docente'];
    const usaToken = rolesConToken.includes(state.regRole);
    const pass = usaToken ? document.getElementById('reg-pass')?.value : document.getElementById('reg-pass-familia')?.value;
    const pass2 = document.getElementById('reg-pass2')?.value;
    const token = document.getElementById('reg-token')?.value.trim().toUpperCase();

    if (!state.regRole) {
      errEl.style.display = 'block';
      errEl.textContent = '⚠️ Selecciona tu rol';
      return;
    }
    if (!nombre) {
      errEl.style.display = 'block';
      errEl.textContent = '⚠️ Ingresa tu nombre';
      return;
    }
    if (!email) {
      errEl.style.display = 'block';
      errEl.textContent = '⚠️ Ingresa tu correo electrónico';
      return;
    }

    if (usaToken) {
      if (!token) {
        errEl.style.display = 'block';
        errEl.textContent = '⚠️ Ingresa el token de invitación';
        return;
      }
      if (!pass || pass.length < 8) {
        errEl.style.display = 'block';
        errEl.textContent = '⚠️ La contraseña debe tener al menos 8 caracteres';
        return;
      }
      if (pass !== pass2) {
        errEl.style.display = 'block';
        errEl.textContent = '⚠️ Las contraseñas no coinciden';
        return;
      }
    } else {
      if (!pass || pass.length < 8) {
        errEl.style.display = 'block';
        errEl.textContent = '⚠️ La contraseña debe tener al menos 8 caracteres';
        return;
      }
      const alumnoNombre = document.getElementById('reg-alumno-nombre')?.value.trim();
      if (!alumnoNombre) {
        errEl.style.display = 'block';
        errEl.textContent = '⚠️ Ingresa el nombre del alumno/a';
        return;
      }
    }

    if (btn) {
      btn.textContent = 'Creando cuenta…';
      btn.disabled = true;
    }

    try {
      let invData = null;

      if (usaToken && window.sb) {
        let inv = null;
        let invErr = null;
        const { data: inv1, error: err1 } = await window.sb
          .from('invitaciones')
          .select('*, escuelas(id, nombre, cct)')
          .eq('token', token)
          .single();
        if (!err1 && inv1) {
          inv = inv1;
        } else {
          const { data: inv2, error: err2 } = await window.sb
            .from('invitaciones')
            .select('*, escuelas(id, nombre, cct)')
            .ilike('token', token)
            .single();
          if (!err2 && inv2) {
            inv = inv2;
          } else {
            invErr = err1 || err2;
          }
        }

        if (invErr || !inv) {
          errEl.style.display = 'block';
          errEl.textContent = '❌ Token inválido. Revisa el token o pide una nueva invitación.';
          if (btn) {
            btn.textContent = 'Crear cuenta →';
            btn.disabled = false;
          }
          return;
        }
        if (inv.expira_at && new Date(inv.expira_at) < new Date()) {
          errEl.style.display = 'block';
          errEl.textContent = '❌ Este token ha expirado. Solicita una nueva invitación.';
          if (btn) {
            btn.textContent = 'Crear cuenta →';
            btn.disabled = false;
          }
          return;
        }
        if (inv.estado === 'usada' || inv.estado === 'usado') {
          const { data: loginData, error: loginErr } = await window.sb.auth.signInWithPassword({ email, password: pass });
          if (!loginErr && loginData?.user) {
            currentUser = loginData.user;
            await cargarPerfilHub();
            document.getElementById('hub-login').style.display = 'none';
            mostrarPortalSegunRol();
            return;
          }
          errEl.style.display = 'block';
          errEl.textContent = '⚠️ Esta invitación ya fue utilizada. Si ya tienes cuenta, usa "Iniciar sesión".';
          if (btn) {
            btn.textContent = 'Crear cuenta →';
            btn.disabled = false;
          }
          return;
        }
        invData = inv;
      }

      const nombreCompleto = `${nombre} ${apellidos}`.trim();
      const rolFinal = invData?.rol || state.regRole;
      let authUser = null;

      if (window.sb) {
        const { data: loginFirst, error: loginFirstErr } = await window.sb.auth.signInWithPassword({ email, password: pass });
        if (!loginFirstErr && loginFirst?.user) {
          authUser = loginFirst.user;
        } else {
          const { data: signupData, error: signupErr } = await window.sb.auth.signUp({
            email,
            password: pass,
            options: { data: { nombre: nombreCompleto, rol: rolFinal } },
          });
          if (signupErr?.message?.toLowerCase().includes('already')) {
            errEl.style.display = 'block';
            errEl.textContent = '⚠️ Este correo ya tiene cuenta. Usa "Iniciar sesión" o "¿Olvidaste tu contraseña?"';
            if (btn) {
              btn.textContent = 'Crear cuenta →';
              btn.disabled = false;
            }
            return;
          }
          if (signupErr) throw signupErr;
          authUser = signupData?.user;
          const { data: loginAfter } = await window.sb.auth.signInWithPassword({ email, password: pass });
          if (loginAfter?.user) authUser = loginAfter.user;
        }
      }

      if (window.sb && authUser) {
        const realEscuelaId = invData?.escuela_id || invData?.escuelas?.id || null;
        const realEscuelaCct = invData?.escuelas?.cct || cctRaw || null;

        const perfilPayload = {
          auth_id: authUser.id,
          email,
          nombre,
          apellido: apellidos || '',
          rol: rolFinal,
          activo: true,
          updated_at: new Date().toISOString(),
        };
        if (realEscuelaId) perfilPayload.escuela_id = realEscuelaId;
        if (realEscuelaCct) perfilPayload.escuela_cct = realEscuelaCct;

        try {
          await window.sb.rpc('upsert_usuario', {
            p_auth_id: authUser.id,
            p_email: email,
            p_nombre: nombre,
            p_apellido_p: apellidos?.split(' ')[0] || '',
            p_apellido_m: apellidos?.split(' ')[1] || '',
            p_rol: rolFinal,
            p_escuela_id: realEscuelaId || '',
            p_escuela_cct: realEscuelaCct || '',
          });
        } catch (rpcErr) {
          console.warn('[REG] upsert_usuario rpc:', rpcErr.message);
          const { error: insertErr } = await window.sb.from('usuarios').insert(perfilPayload);
          if (insertErr) {
            console.log('[REG] Insert failed, updating:', insertErr.message);
            await window.sb.from('usuarios').update({
              auth_id: authUser.id,
              nombre,
              rol: rolFinal,
              activo: true,
              updated_at: new Date().toISOString(),
            }).eq('email', email);
          }
        }
      }

      if (window.sb && invData) {
        const dbToken = invData.token || token;
        await window.sb.from('invitaciones')
          .update({ estado: 'usada', usado_por: authUser?.id, updated_at: new Date().toISOString() })
          .eq('token', dbToken)
          .neq('estado', 'usada');
      }

      if (authUser) {
        currentUser = authUser;
        try { await cargarPerfilHub(); } catch (e) {}
        document.getElementById('hub-login').style.display = 'none';
        mostrarPortalSegunRol();
      } else {
        document.getElementById('panel-registro').innerHTML = `
          <div style="text-align:center;padding:20px 0;">
            <div style="font-size:48px;margin-bottom:16px;">✅</div>
            <div style="font-family:'Fraunces',serif;font-size:20px;font-weight:700;color:var(--verde);margin-bottom:10px;">¡Cuenta creada!</div>
            <div style="font-size:13px;color:#475569;line-height:1.7;margin-bottom:20px;">
              Revisa tu correo <strong>${email}</strong> para confirmar tu cuenta y luego inicia sesión.
            </div>
            <button onclick="hubSwitchTab('login')" class="btn-login" style="width:auto;padding:10px 24px;">Ir al inicio de sesión</button>
          </div>`;
      }
    } catch (e) {
      errEl.style.display = 'block';
      errEl.style.color = '#ef4444';
      errEl.textContent = '❌ ' + (e.message || 'Error al crear la cuenta');
    } finally {
      if (btn) {
        btn.textContent = 'Crear cuenta →';
        btn.disabled = false;
      }
    }
  }

  async function invitadoCrearPass(email, rol) {
    const pass1 = document.getElementById('nueva-pass')?.value || '';
    const pass2 = document.getElementById('nueva-pass2')?.value || '';
    const errEl = document.getElementById('nueva-pass-error');

    if (pass1.length < 8) {
      errEl.textContent = '⚠️ Mínimo 8 caracteres';
      errEl.style.display = 'block';
      return;
    }
    if (pass1 !== pass2) {
      errEl.textContent = '⚠️ Las contraseñas no coinciden';
      errEl.style.display = 'block';
      return;
    }

    try {
      const { error } = await window.sb.auth.updateUser({ password: pass1 });
      if (error) throw error;

      const { data, error: loginErr } = await window.sb.auth.signInWithPassword({ email, password: pass1 });
      if (loginErr) throw loginErr;

      currentUser = data.user;
      const { data: perfil } = await window.sb.from('usuarios').select('*').eq('auth_id', currentUser.id).maybeSingle();
      if (perfil) {
        currentPerfil = perfil;
        document.getElementById('hub-login').style.display = 'none';
        _abrirPortalPorRol(perfil.rol);
      }
    } catch (e) {
      if (errEl) {
        errEl.textContent = '❌ ' + e.message;
        errEl.style.display = 'block';
      }
    }
  }

  const api = {
    state,
    regBuscarEscuela,
    hubSwitchTab,
    regSelectRole,
    regBuscarEscuelaNombre,
    regEscogerEscuela,
    hubDoRegistro,
    invitadoCrearPass,
  };

  Object.assign(window, api);
  syncState();
  return api;
})();
