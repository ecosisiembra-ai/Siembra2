window.SiembraSaAuth = (function() {
  async function bootstrapSaSession() {
    document.title = 'SIEMBRA - Admin Central';
    const passwordLabel = document.querySelector('label[for="login-pass"]') || Array.from(document.querySelectorAll('.field label')).find((label) => /contra/i.test(label.textContent || ''));
    if (passwordLabel) {
      passwordLabel.textContent = 'Contrasena';
    }
    const passwordInput = document.getElementById('login-pass');
    if (passwordInput) {
      passwordInput.setAttribute('placeholder', '********');
    }
    const loginButton = document.getElementById('login-btn');
    if (loginButton) {
      loginButton.textContent = 'Entrar ->';
    }
    const loginBadge = Array.from(document.querySelectorAll('.login-badge span')).find((node) => /supabase auth/i.test(node.textContent || ''));
    if (loginBadge) {
      loginBadge.textContent = 'Conexion cifrada - Supabase Auth';
    }

    // Nav section label "Gestión" → sin acento
    const navGestion = Array.from(document.querySelectorAll('.nav-section-label')).find((el) => /gesti/i.test(el.textContent || ''));
    if (navGestion) {
      navGestion.textContent = 'Gestion';
    }

    // Nav-config button: parchear solo el nodo de texto, sin tocar el <span class="ni">
    const navConfigBtn = document.getElementById('nav-config');
    if (navConfigBtn) {
      const textNode = Array.from(navConfigBtn.childNodes).find((n) => n.nodeType === 3 && /configuraci/i.test(n.textContent || ''));
      if (textNode) {
        textNode.textContent = ' Configuracion';
      }
    }

    // Page title de la sección Config
    const configPageTitle = document.querySelector('#page-config .page-title');
    if (configPageTitle) {
      configPageTitle.textContent = 'Configuracion global';
    }

    // Page title de la sección Checklist
    const checklistPageTitle = document.querySelector('#page-checklist .page-title');
    if (checklistPageTitle) {
      checklistPageTitle.textContent = 'Checklist de produccion';
    }

    // Page sub de Checklist
    const checklistPageSub = document.querySelector('#page-checklist .page-sub');
    if (checklistPageSub) {
      checklistPageSub.textContent = 'Estado real del sistema - que falta para que todo funcione al 100%';
    }

    // Page sub de Config
    const configPageSub = document.querySelector('#page-config .page-sub');
    if (configPageSub) {
      configPageSub.textContent = 'Parametros del sistema SIEMBRA';
    }

    // Panel titles en Config: "Conexión Supabase" y "Versión del sistema"
    document.querySelectorAll('#page-config .panel-title').forEach((pt) => {
      if (/conexi/i.test(pt.textContent)) {
        pt.textContent = '\u25ce Conexion Supabase';
      } else if (/versi/i.test(pt.textContent)) {
        pt.textContent = '\u25ce Version del sistema';
      }
    });

    // Panel title en Actividad: "Métricas del sistema"
    document.querySelectorAll('#page-actividad .panel-title').forEach((pt) => {
      if (/m\xe9tric/i.test(pt.textContent)) {
        pt.textContent = '\u25ce Metricas del sistema';
      }
    });

    // ── Nueva escuela ──

    // Page sub
    const nuevaEscPageSub = document.querySelector('#page-nueva-escuela .page-sub');
    if (nuevaEscPageSub) {
      nuevaEscPageSub.textContent = 'Registra un plantel y genera la invitacion para su director/a';
    }

    // Label "Límite de alumnos"
    const limitLabel = Array.from(document.querySelectorAll('#page-nueva-escuela label')).find((l) => /l\xedmite/i.test(l.textContent || ''));
    if (limitLabel) {
      limitLabel.textContent = 'Limite de alumnos';
    }

    // Opción "Básico" en el selector de plan
    const basicoOpt = document.querySelector('#ne-plan-tipo option[value="basico"]');
    if (basicoOpt) {
      basicoOpt.textContent = 'Basico';
    }

    // Botón crear escuela
    const neBtnCreate = document.getElementById('ne-btn');
    if (neBtnCreate) {
      neBtnCreate.textContent = 'Crear escuela y generar invitacion ->';
    }

    // Texto inicial del QR box
    const qrBox = document.getElementById('ne-qr-box');
    if (qrBox && /generando/i.test(qrBox.textContent || '')) {
      qrBox.textContent = 'QR generandose...';
    }

    // Hint "Clic para copiar · expira en 7 días"
    const copyHint = Array.from(document.querySelectorAll('#ne-result div')).find((d) => /expira.*d\xedas/i.test(d.textContent || '') && d.childElementCount === 0);
    if (copyHint) {
      copyHint.textContent = 'Clic para copiar - expira en 7 dias';
    }

    // Panel title "¿Cómo funciona el alta?"
    const comoFuncTitle = Array.from(document.querySelectorAll('#page-nueva-escuela .panel-title')).find((pt) => /c\xf3mo/i.test(pt.textContent || ''));
    if (comoFuncTitle) {
      comoFuncTitle.textContent = '\u25ce Como funciona el alta?';
    }

    // ── Invitaciones ──

    // Botón "＋ Generar invitación" en la página de invitaciones
    const invPageBtn = document.querySelector('#page-invitaciones .btn-primary');
    if (invPageBtn) {
      invPageBtn.textContent = '\uff0b Generar invitacion';
    }

    // ── Modal invitación ──

    // Título del modal
    const modalInvTitle = document.querySelector('#modal-inv .modal-title');
    if (modalInvTitle) {
      modalInvTitle.textContent = 'Generar invitacion';
    }

    // Label "Días de vigencia"
    const diasLabel = Array.from(document.querySelectorAll('#modal-inv label')).find((l) => /d\xedas de vig/i.test(l.textContent || ''));
    if (diasLabel) {
      diasLabel.textContent = 'Dias de vigencia';
    }

    // Opciones del select de días ("3 días" → "3 dias", etc.)
    document.querySelectorAll('#inv-dias option').forEach((opt) => {
      opt.textContent = opt.textContent.replace(/d\xedas/i, 'dias');
    });

    // Botón "Generar token →"
    const invBtn = document.getElementById('inv-btn');
    if (invBtn) {
      invBtn.textContent = 'Generar token ->';
    }

    const savedUrl = localStorage.getItem('sa_url');
    const savedKey = localStorage.getItem('sa_key');
    if (savedUrl && savedKey && window.supabase) {
      try {
        window.sb = window.supabase.createClient(savedUrl, savedKey);
      } catch (_) {}
    }

    try {
      if (window.sb) {
        await window.sb.auth.signOut();
      }
    } catch (_) {}

    if (!window.sb || window.SA_URL?.includes('DISABLED')) {
      const devMode = localStorage.getItem('sa_dev') === '1';
      if (devMode) {
        window.currentAdmin = { email: 'dev@siembra.mx' };
        if (typeof window.abrirApp === 'function') {
          window.abrirApp();
        }
      }
    }
  }

  async function doLogin() {
    const email = document.getElementById('login-email')?.value?.trim();
    const pass = document.getElementById('login-pass')?.value || '';
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');

    if (errEl) {
      errEl.style.display = 'none';
    }
    if (!email || !pass) {
      if (typeof window.mostrarError === 'function') {
        window.mostrarError('Ingresa email y contrasena');
      }
      return;
    }

    if (btn) {
      btn.textContent = 'Verificando...';
      btn.disabled = true;
    }

    try {
      if (!window.sb) {
        throw new Error('Sin conexion a Supabase.');
      }

      const { data, error } = await window.sb.auth.signInWithPassword({ email, password: pass });
      if (error) {
        throw error;
      }

      window.currentAdmin = data.user;
      const { data: perfil } = await window.sb.from('usuarios').select('rol').eq('auth_id', data.user.id).maybeSingle();
      if (perfil && perfil.rol !== 'superadmin') {
        await window.sb.auth.signOut();
        throw new Error('No tienes permisos de superadmin. Contacta al equipo SIEMBRA.');
      }

      if (typeof window.abrirApp === 'function') {
        window.abrirApp();
      }
    } catch (error) {
      if (typeof window.mostrarError === 'function') {
        window.mostrarError(error?.message || 'Error de autenticacion');
      }
      if (btn) {
        btn.textContent = 'Entrar ->';
        btn.disabled = false;
      }
      return;
    }

    if (btn) {
      btn.textContent = 'Entrar ->';
      btn.disabled = false;
    }
  }

  async function doLogout() {
    try {
      if (window.sb) {
        await window.sb.auth.signOut();
      }
    } catch (_) {}
    location.reload();
  }

  const api = {
    bootstrapSaSession,
    doLogin,
    doLogout,
  };

  Object.assign(window, api);
  return api;
})();
