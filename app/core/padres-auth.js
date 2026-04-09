window.SiembraPadresAuth = (function() {
  function showLoginError(message) {
    if (typeof window.showLoginError === 'function') {
      window.showLoginError(message);
      return;
    }
    const el = document.getElementById('login-error');
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
    }
  }

  async function bootstrapPadresSession() {
    window.SIEMBRA_RUNTIME?.setVisible?.('padres-demo-wrap', !!window.SIEMBRA_RUNTIME?.shouldAllowDemoEntry?.(), 'flex');

    const params = new URLSearchParams(location.search);
    const inviteToken = params.get('invite') || params.get('token');
    if (inviteToken) {
      history.replaceState({}, '', location.pathname);
      if (typeof window.ocultarLoading === 'function') {
        window.ocultarLoading();
      }
      if (typeof window.mostrarRegistroConToken === 'function') {
        window.mostrarRegistroConToken(inviteToken);
      }
      return;
    }

    try {
      if (window.sb) {
        const { data: { session } } = await window.sb.auth.getSession();
        if (session) {
          window.currentUser = session.user;
          if (typeof window.cargarPerfil === 'function') {
            await window.cargarPerfil();
          }
          if (typeof window.mostrarApp === 'function') {
            window.mostrarApp();
          }
          if (window.SIEMBRA?.sessionWatcher) {
            window.SIEMBRA.sessionWatcher.start();
          }
          return;
        }
      }
    } catch (error) {
      console.warn('Session check error:', error);
    }

    setTimeout(() => {
      if (typeof window.ocultarLoading === 'function') {
        window.ocultarLoading();
      }
      if (typeof window.mostrarLogin === 'function') {
        window.mostrarLogin();
      }
    }, 400);
  }

  async function doLogin() {
    const email = document.getElementById('login-email')?.value?.trim();
    const pass = document.getElementById('login-pass')?.value || '';
    const btn = document.getElementById('btn-login');
    const errEl = document.getElementById('login-error');

    if (!email || !pass) {
      showLoginError('Ingresa tu correo y contrasena');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Entrando...';
    }
    if (errEl) {
      errEl.style.display = 'none';
    }

    try {
      if (!window.sb) {
        throw new Error(window.SIEMBRA_RUNTIME?.buildNoConnectionMessage?.() || 'Sin conexion al servidor.');
      }

      const { data, error } = await window.sb.auth.signInWithPassword({ email, password: pass });
      if (error) {
        throw error;
      }
      if (data?.session?.user) {
        window.currentUser = data.session.user;
      } else {
        throw new Error('No se pudo iniciar sesion.');
      }

      if (typeof window.cargarPerfil === 'function') {
        await window.cargarPerfil();
      }
      if (typeof window.mostrarApp === 'function') {
        window.mostrarApp();
      }
    } catch (error) {
      let message = error?.message || 'Error al iniciar sesion.';
      if (message === 'Invalid login credentials') {
        message = 'Correo o contrasena incorrectos. Verifica los datos.';
      } else if (/fetch|network/i.test(message)) {
        message = window.SIEMBRA_RUNTIME?.buildNoConnectionMessage?.() || 'Sin conexion al servidor.';
      }
      showLoginError(message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Entrar ->';
      }
    }
  }

  async function doLogout() {
    if (!window.confirm('Cerrar sesion?')) {
      return;
    }
    try {
      if (window.sb) {
        await window.sb.auth.signOut();
      }
    } catch (_) {}
    window.currentUser = null;
    window.currentPerfil = null;
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'none';
    }
    if (typeof window.mostrarLogin === 'function') {
      window.mostrarLogin();
    }
  }

  const api = {
    bootstrapPadresSession,
    doLogin,
    doLogout,
  };

  Object.assign(window, api);
  return api;
})();
