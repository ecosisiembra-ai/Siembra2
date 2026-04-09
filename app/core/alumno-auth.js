window.SiembraAlumnoAuth = (function() {
  async function bootstrapAlumnoSession() {
    window.SIEMBRA_RUNTIME?.setVisible?.('alumno-demo-wrap', !!window.SIEMBRA_RUNTIME?.shouldAllowDemoEntry?.(), 'block');

    const params = new URLSearchParams(location.search);
    const inviteToken = params.get('invite') || params.get('token');
    if (inviteToken) {
      history.replaceState({}, '', location.pathname);
      if (typeof window.mostrarRegistroAlumnoConToken === 'function') {
        window.mostrarRegistroAlumnoConToken(inviteToken);
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
        }
      }
    } catch (error) {
      console.warn('Error de sesion:', error);
    }
  }

  async function doLogin() {
    const email = document.getElementById('login-user')?.value?.trim();
    const pass = document.getElementById('login-pass')?.value?.trim();
    const btn = document.querySelector('.btn-login');
    const errEl = document.getElementById('login-error') || (() => {
      const el = document.createElement('div');
      el.id = 'login-error';
      el.style.cssText = 'color:#ef4444;font-size:13px;margin-top:10px;text-align:center;display:none;';
      document.querySelector('.login-card')?.appendChild(el);
      return el;
    })();

    errEl.style.display = 'none';
    if (!email || !pass) {
      errEl.textContent = 'Ingresa tu correo y contrasena.';
      errEl.style.display = 'block';
      return;
    }
    if (btn) {
      btn.textContent = 'Entrando...';
      btn.disabled = true;
    }

    if (email === 'alumno@siembra.test' || email === 'demo' || email === 'alumno') {
      if (!window.SIEMBRA_RUNTIME?.shouldAllowDemoEntry?.()) {
        errEl.textContent = 'La version productiva no permite acceso demo. Usa demo.html.';
        errEl.style.display = 'block';
        if (btn) {
          btn.textContent = 'Entrar a mi espacio ->';
          btn.disabled = false;
        }
        return;
      }
      window.currentUser = { id: 'demo-user', email: 'alumno@siembra.test' };
      window.currentPerfil = {
        nombre: 'Sofia',
        apellido: 'Ramirez',
        grado: '6',
        grupo: 'A',
        avatar_url: null,
        xp_total: 840,
        nivel: 4,
        monedas: 120,
        racha_dias: 7,
        insignias_count: 5,
      };
      if (typeof window.mostrarApp === 'function') {
        window.mostrarApp();
      }
      if (btn) {
        btn.textContent = 'Entrar a mi espacio ->';
        btn.disabled = false;
      }
      return;
    }

    try {
      if (!window.sb) throw new Error('Sin conexion al servidor');
      const { data, error } = await window.sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      window.currentUser = data.user;
      if (typeof window.cargarPerfil === 'function') {
        await window.cargarPerfil();
      }
      if (typeof window.mostrarApp === 'function') {
        window.mostrarApp();
      }
    } catch (error) {
      let msg = error.message || 'Error de conexion';
      if (msg === 'Invalid login credentials') msg = 'Correo o contrasena incorrectos.';
      else if (msg.includes('fetch') || msg.includes('network')) msg = window.SIEMBRA_RUNTIME?.buildNoConnectionMessage?.() || 'Sin conexion.';
      errEl.textContent = msg;
      errEl.style.display = 'block';
      if (btn) {
        btn.textContent = 'Entrar a mi espacio ->';
        btn.disabled = false;
      }
    }
  }

  async function doLogout() {
    try {
      if (window.sb) await window.sb.auth.signOut();
    } catch (_) {}
    window.currentUser = null;
    window.currentPerfil = null;
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  }

  const api = {
    bootstrapAlumnoSession,
    doLogin,
    doLogout,
  };

  Object.assign(window, api);
  return api;
})();
