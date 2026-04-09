window.SiembraHub = (function() {
  const HUB_ROLES = window.SiembraDemoFixtures?.hubRoles || {};
  const state = {
    hubRole: null,
    escuelas: [],
    escuelaSeleccionada: false,
  };

  function syncState() {
    window.hubRole = state.hubRole;
    window.HUB_ESCUELAS = state.escuelas;
    window.HUB_ESCUELA_SELECCIONADA = state.escuelaSeleccionada;
  }

  function hubEscuelaRequerida() {
    return !!state.escuelas.length;
  }

  function hubTieneEscuelaSeleccionada() {
    return !hubEscuelaRequerida() || state.escuelaSeleccionada;
  }

  function hubEtiquetasRol() {
    return {
      docente: 'Docente',
      director: 'Director/a',
      admin: 'Administracion',
      padre: 'Familia',
      ts: 'Trabajo Social',
      tutor: 'Tutor de grupo',
      subdirector: 'Subdirector/a',
      coordinador: 'Coordinador/a',
      prefecto: 'Prefecto/a',
      contralor: 'Contralor',
      orientador: 'Orientador/a',
    };
  }

  function hubActualizarBotones() {
    const listo = !!state.hubRole && hubTieneEscuelaSeleccionada();
    const btn = document.getElementById('hub-login-btn');
    const demoBtn = document.getElementById('hub-demo-btn');
    if (btn) {
      btn.disabled = !listo;
      btn.style.opacity = listo ? '1' : '.5';
    }
    if (demoBtn) {
      const demoPermitido = !!window.SIEMBRA_RUNTIME?.shouldAllowDemoEntry?.();
      demoBtn.disabled = !listo || !demoPermitido;
      demoBtn.style.opacity = (listo && demoPermitido) ? '1' : '.5';
    }
  }

  function hubLimpiarSeleccionRol() {
    state.hubRole = null;
    syncState();
    document.querySelectorAll('.role-chip[id^="rc-"]').forEach(el => el.classList.remove('active'));
  }

  function hubActualizarHint() {
    const hintEl = document.getElementById('hub-hint');
    if (!hintEl) return;
    const escuela = window._escuelaCfg?.nombre || '';
    const plan = siembraPlanLabel(window.SIEMBRA_PLAN);
    const rolLabel = hubEtiquetasRol()[state.hubRole] || state.hubRole;
    if (!hubTieneEscuelaSeleccionada()) {
      hintEl.innerHTML = '1. Selecciona tu escuela para cargar su plan, roles y contadores';
      return;
    }
    if (!state.hubRole) {
      hintEl.innerHTML = `🏫 <strong>${escuela || 'Escuela seleccionada'}</strong> · Plan ${plan}. Ahora elige tu rol para continuar.`;
      return;
    }
    hintEl.innerHTML = `✅ <strong>${rolLabel}</strong> · ${escuela || 'Escuela seleccionada'} · Plan ${plan}`;
  }

  function hubActualizarVisibilidadRoles() {
    const rolesWrap = document.getElementById('hub-roles-wrap');
    const badgeEl = document.getElementById('siembra-plan-badge');
    const authWrap = document.getElementById('hub-auth-wrap');
    const visible = hubTieneEscuelaSeleccionada();
    if (rolesWrap) rolesWrap.style.display = visible ? '' : 'none';
    if (badgeEl && !visible) badgeEl.style.display = 'none';
    if (authWrap) authWrap.style.display = visible ? '' : 'none';
  }

  function hubAjustarRolDespuesDePlan() {
    const permitidos = new Set(siembraRolesPermitidosPorPlan(window.SIEMBRA_PLAN));
    if (state.hubRole && !permitidos.has(state.hubRole)) {
      hubLimpiarSeleccionRol();
      const errEl = document.getElementById('hub-error');
      if (errEl) {
        errEl.textContent = `El plan ${siembraPlanLabel(window.SIEMBRA_PLAN)} de esta escuela no incluye ese rol.`;
        errEl.style.display = 'block';
      }
    }
    hubActualizarVisibilidadRoles();
    hubActualizarHint();
    hubActualizarBotones();
  }

  function hubInferirPlanEscuela(esc = {}) {
    const planRaw = esc.plan || esc.plan_nombre || esc.plan_tipo || esc.tipo_plan || esc.licencia || esc.staff_plan;
    return siembraNormalizarPlan(planRaw || 'base');
  }

  function hubNormalizarEscuela(esc = {}) {
    const nivel = esc.nivel === 'primaria_y_secundaria'
      ? (esc.nivel_default || 'secundaria')
      : (esc.nivel || esc.nivel_default || 'secundaria');
    const statsAlumnos = esc.stats_alumnos ?? esc.total_alumnos ?? esc.alumnos_total ?? null;
    const statsDocentes = esc.stats_docentes ?? esc.total_docentes ?? esc.docentes_total ?? null;
    const statsGrupos = esc.stats_grupos ?? esc.total_grupos ?? esc.grupos_total ?? null;
    const statsUsuarios = esc.stats_usuarios ?? esc.total_usuarios ?? esc.usuarios_total ?? null;
    return {
      id: esc.id || null,
      cct: String(esc.cct || '').trim(),
      nombre: esc.nombre || esc.cct || 'Escuela',
      nivel,
      nivel_default: esc.nivel_default || nivel || 'secundaria',
      municipio: esc.municipio || '',
      estado: esc.estado || '',
      zona: esc.zona_escolar || esc.zona || '',
      turno: esc.turno || '',
      plan: hubInferirPlanEscuela(esc),
      stats_alumnos: statsAlumnos,
      stats_docentes: statsDocentes,
      stats_grupos: statsGrupos,
      stats_usuarios: statsUsuarios,
    };
  }

  async function hubCargarEscuelasDisponibles() {
    const wrap = document.getElementById('hub-escuela-wrap');
    const sel = document.getElementById('hub-escuela-sel');
    if (!wrap || !sel) return;

    let escuelas = [];
    if (window.sb) {
      try {
        if (window._escuelaCfg?.cct) {
          const cctGuardado = String(window._escuelaCfg.cct || '').trim();
          const { data: escuelaActual } = await window.sb.from('escuelas')
            .select('*')
            .eq('cct', cctGuardado)
            .maybeSingle();
          if (escuelaActual?.cct) escuelas = [hubNormalizarEscuela(escuelaActual)];
        }
        if (!escuelas.length) {
          const { data } = await window.sb.from('escuelas').select('*').order('nombre');
          escuelas = (data || []).map(hubNormalizarEscuela).filter(e => e.cct);
        }
      } catch (e) {
        console.warn('[hubCargarEscuelasDisponibles]', e.message);
      }
    }

    if (!escuelas.length && window._escuelaCfg?.cct) {
      escuelas = [hubNormalizarEscuela(window._escuelaCfg)];
    }

    const vistas = [];
    const seen = new Set();
    escuelas.forEach(esc => {
      if (!esc?.cct || seen.has(esc.cct)) return;
      seen.add(esc.cct);
      vistas.push(esc);
    });
    state.escuelas = vistas;
    syncState();

    if (!state.escuelas.length) {
      wrap.style.display = 'none';
      hubActualizarVisibilidadRoles();
      hubActualizarHint();
      hubActualizarBotones();
      return;
    }

    wrap.style.display = '';
    sel.innerHTML = '<option value="">Selecciona tu escuela…</option>' +
      state.escuelas.map(esc => `<option value="${esc.cct}">${esc.nombre} · ${esc.cct}</option>`).join('');
    sel.value = '';
    state.escuelaSeleccionada = false;
    syncState();
    window._escuelaCfg = { ...(window._escuelaCfg || {}), cct: '', nombre: '', plan: 'base', nivel_default: 'secundaria' };
    window.SIEMBRA_PLAN = 'base';
    hubLimpiarSeleccionRol();
    hubActualizarVisibilidadRoles();
    hubActualizarHint();
    hubActualizarBotones();
  }

  function hubCambiarEscuela(cct, opts = {}) {
    const esc = state.escuelas.find(e => e.cct === cct) || null;
    const errEl = document.getElementById('hub-error');
    const helpEl = document.getElementById('hub-escuela-help');
    if (!esc) {
      state.escuelaSeleccionada = false;
      syncState();
      window._escuelaCfg = { ...(window._escuelaCfg || {}), cct: '', nombre: '', plan: 'base', nivel_default: 'secundaria' };
      window.SIEMBRA_PLAN = 'base';
      if (helpEl) helpEl.textContent = 'Primero elige la escuela para ver sus roles y sus cifras reales';
      hubLimpiarSeleccionRol();
      siembraAplicarPlan('base');
      _cargarStatsLogin();
      if (errEl && !opts.silentError) {
        errEl.textContent = 'Selecciona una escuela antes de elegir el rol.';
        errEl.style.display = 'block';
      }
      hubActualizarVisibilidadRoles();
      hubActualizarHint();
      hubActualizarBotones();
      return;
    }

    window._escuelaCfg = {
      ...(window._escuelaCfg || {}),
      url: window.SUPABASE_URL,
      key: window.SUPABASE_KEY,
      id: esc.id,
      cct: esc.cct,
      nombre: esc.nombre,
      nivel: esc.nivel,
      nivel_default: esc.nivel_default || esc.nivel || 'secundaria',
      municipio: esc.municipio,
      estado: esc.estado,
      zona: esc.zona,
      turno: esc.turno,
      plan: esc.plan,
      stats_alumnos: esc.stats_alumnos ?? null,
      stats_docentes: esc.stats_docentes ?? null,
      stats_grupos: esc.stats_grupos ?? null,
      stats_usuarios: esc.stats_usuarios ?? null,
    };
    state.escuelaSeleccionada = true;
    syncState();
    window.SIEMBRA_PLAN = esc.plan;
    window.ESCUELA_ACTIVA = esc;
    window._nivelActivo = esc.nivel_default || esc.nivel || 'secundaria';

    try { localStorage.setItem('siembra_escuela_cfg', JSON.stringify(window._escuelaCfg)); } catch (e) {}

    if (helpEl) helpEl.textContent = `${esc.nombre} · CCT ${esc.cct} · Plan ${siembraPlanLabel(esc.plan)}`;
    if (errEl) errEl.style.display = 'none';

    siembraAplicarPlan(esc.plan);
    _cargarStatsLogin();
    hubActualizarHint();
    hubActualizarBotones();
  }

  function hubSelectRole(role) {
    const errEl = document.getElementById('hub-error');
    if (hubEscuelaRequerida() && !hubTieneEscuelaSeleccionada()) {
      if (errEl) {
        errEl.textContent = 'Primero selecciona la escuela para cargar sus roles disponibles.';
        errEl.style.display = 'block';
      }
      hubActualizarBotones();
      return;
    }

    const permitidos = new Set(siembraRolesPermitidosPorPlan(window.SIEMBRA_PLAN));
    if (!permitidos.has(role)) {
      if (errEl) {
        errEl.textContent = `El plan ${siembraPlanLabel(window.SIEMBRA_PLAN)} no incluye ese rol.`;
        errEl.style.display = 'block';
      }
      hubActualizarBotones();
      return;
    }

    state.hubRole = role;
    syncState();
    document.querySelectorAll('.role-chip[id^="rc-"]').forEach(el => el.classList.remove('active'));
    const chip = document.getElementById('rc-' + role);
    if (chip) chip.classList.add('active');

    const hintEl = document.getElementById('hub-hint');
    const rolLabels = hubEtiquetasRol();
    if (hintEl) hintEl.innerHTML = `✅ <strong>${rolLabels[role] || role}</strong> · ${window._escuelaCfg?.nombre || 'Escuela seleccionada'} · Plan ${siembraPlanLabel(window.SIEMBRA_PLAN)}`;

    const banner = document.getElementById('hub-demo-banner');
    if (banner) banner.style.display = 'none';

    if (errEl) errEl.style.display = 'none';
    hubActualizarBotones();
  }

  function hubDoDemo() {
    if (!window.SIEMBRA_RUNTIME?.shouldAllowDemoEntry?.()) {
      window.location.href = window.SIEMBRA_RUNTIME?.demoUrl || 'demo.html?mode=demo';
      return;
    }
    const errEl = document.getElementById('hub-error');
    if (hubEscuelaRequerida() && !hubTieneEscuelaSeleccionada()) {
      if (errEl) {
        errEl.textContent = '👆 Primero selecciona la escuela.';
        errEl.style.display = 'block';
      }
      return;
    }
    if (!state.hubRole) {
      if (errEl) {
        errEl.textContent = '👆 Primero selecciona un rol para explorar en demo.';
        errEl.style.display = 'block';
      }
      return;
    }
    document.getElementById('hub-login').style.display = 'none';
    _abrirPortalPorRol(state.hubRole);
  }

  async function hubDoLoginReal() {
    const errEl = document.getElementById('hub-error');
    if (hubEscuelaRequerida() && !hubTieneEscuelaSeleccionada()) {
      if (errEl) {
        errEl.textContent = 'Selecciona tu escuela antes de iniciar sesion.';
        errEl.style.display = 'block';
      }
      return;
    }
    if (!state.hubRole) {
      if (errEl) {
        errEl.textContent = '👆 Primero selecciona un rol.';
        errEl.style.display = 'block';
      }
      return;
    }
    const email = (document.getElementById('hub-email')?.value || '').trim();
    const pass = document.getElementById('hub-pass')?.value || '';
    if (errEl) errEl.style.display = 'none';
    if (!email) {
      if (errEl) {
        errEl.textContent = 'Ingresa tu correo electronico.';
        errEl.style.display = 'block';
      }
      return;
    }
    if (!pass) {
      if (errEl) {
        errEl.textContent = 'Ingresa tu contrasena.';
        errEl.style.display = 'block';
      }
      return;
    }
    if (!window.sb) {
      if (errEl) {
        errEl.textContent = window.SIEMBRA_RUNTIME?.buildNoConnectionMessage?.() || 'Sin conexion a Supabase.';
        errEl.style.display = 'block';
      }
      return;
    }
    const btn = document.getElementById('hub-login-btn');
    if (btn) {
      btn.textContent = '⏳ Verificando…';
      btn.disabled = true;
    }
    try {
      const { data, error } = await window.sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      currentUser = data.user;
      currentPerfil = null;
      let perfil = null;

      const { data: perfilByAuth } = await window.sb.from('usuarios').select('*').eq('auth_id', currentUser.id).maybeSingle();
      perfil = perfilByAuth;

      if (!perfil) {
        const { data: perfilByEmail } = await window.sb.from('usuarios').select('*').eq('email', email.toLowerCase().trim()).maybeSingle();
        if (perfilByEmail) {
          await window.sb.from('usuarios').update({
            auth_id: currentUser.id,
            activo: true,
          }).eq('id', perfilByEmail.id);
          perfil = { ...perfilByEmail, auth_id: currentUser.id };
          console.log('[SIEMBRA] auth_id vinculado automaticamente para:', email);
        }
      }

      if (!perfil) throw new Error('Tu cuenta existe pero aun no tiene perfil en SIEMBRA. Contacta al director.');
      currentPerfil = perfil;

      const ROL_ALIAS = {
        tutor: 'docente',
        superadmin: 'admin',
      };
      const rolReal = ROL_ALIAS[perfil.rol] || perfil.rol;
      if (state.hubRole && rolReal !== state.hubRole) {
        const ROL_LABELS = {
          docente: 'Docente',
          director: 'Director/a',
          admin: 'Administracion',
          padre: 'Familia',
          ts: 'Trabajo Social',
          tutor: 'Docente / Tutor',
          subdirector: 'Subdirector/a',
          coordinador: 'Coordinador/a',
          prefecto: 'Prefecto/a',
          superadmin: 'SuperAdmin',
          alumno: 'Alumno/a',
        };
        await window.sb.auth.signOut();
        currentUser = null;
        currentPerfil = null;
        throw new Error(`❌ Esta cuenta no corresponde al rol "${ROL_LABELS[state.hubRole] || state.hubRole}". Selecciona "${ROL_LABELS[perfil.rol] || perfil.rol}" e intenta de nuevo.`);
      }

      const perteneceAEscuela = await hubPerfilPerteneceAEscuela(perfil);
      if (!perteneceAEscuela) {
        await window.sb.auth.signOut();
        currentUser = null;
        currentPerfil = null;
        throw new Error(`❌ Esta cuenta no pertenece a la escuela seleccionada (${window._escuelaCfg?.nombre || window._escuelaCfg?.cct || 'escuela'}).`);
      }

      try { await window.sb.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', perfil.id); } catch (e) {}
      try {
        sessionStorage.setItem('siembra_login_ts', Date.now().toString());
        sessionStorage.setItem('siembra_last_activity', Date.now().toString());
      } catch (e) {}
      if (typeof window._resetInactivityTimer === 'function') window._resetInactivityTimer();
      document.getElementById('hub-login').style.display = 'none';
      _abrirPortalPorRol(perfil.rol);
    } catch (e) {
      if (errEl) {
        errEl.textContent = e.message === 'Invalid login credentials'
          ? '❌ Correo o contrasena incorrectos.'
          : (e.message || 'Error al iniciar sesion.');
        errEl.style.display = 'block';
      }
    } finally {
      if (btn) {
        btn.textContent = '✦ Entrar a SIEMBRA';
        btn.disabled = false;
      }
    }
  }

  function resetRole() {
    hubLimpiarSeleccionRol();
    hubActualizarBotones();
  }

  const api = {
    HUB_ROLES,
    state,
    hubEscuelaRequerida,
    hubTieneEscuelaSeleccionada,
    hubEtiquetasRol,
    hubActualizarBotones,
    hubLimpiarSeleccionRol,
    hubActualizarHint,
    hubActualizarVisibilidadRoles,
    hubAjustarRolDespuesDePlan,
    hubInferirPlanEscuela,
    hubNormalizarEscuela,
    hubCargarEscuelasDisponibles,
    hubCambiarEscuela,
    hubSelectRole,
    hubDoDemo,
    hubDoLoginReal,
    hubDoLogin: hubDoLoginReal,
    resetRole,
  };

  Object.assign(window, api);
  syncState();
  return api;
})();
