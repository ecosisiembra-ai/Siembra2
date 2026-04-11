
// DATA
const alumnos = []; // Se llena con datos reales de Supabase al hacer login
const materias = ['Mat','Esp','Cie','His','Geo','For','Edu','Art'];
const diasSemana = ['Lunes','Martes','Miércoles','Jueves','Viernes'];
const horas = ['7:00','8:00','9:00','10:00','11:00','12:00','13:00'];
const coloresClase = ['#e8f5ee','#eff6ff','#fff7ed','#fef9c3','#fdf2f8','#f0fdf4'];
const horarioData = {}; // Se llena con datos reales de Supabase al hacer login
const claseColors = {'Matemáticas':'#e8f5ee','Español':'#eff6ff','Ciencias':'#fff7ed','Geografía':'#fef9c3','Historia':'#fdf2f8','Formación':'#f0fdf4','Ed. Física':'#fff1f2','Artes':'#fefce8','Receso':'#f3f3ef'};
const mensajesData = []; // Se llena con datos reales
const planeaciones = []; // Se llena con datos reales
const observacionesData = {}; // Se llena con datos reales
const eventos = []; // Se llena con datos reales

let currentTrim = 1;
let currentChat = 0;
let obsAlumno = '';
let calMes = 3, calAnio = 2026;

// LOGIN
function setRole(el, rol) {
  document.querySelectorAll('.role-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
}

// ══════════════════════════════════════════════════════════════════════
// ONBOARDING POR TOKEN DE INVITACIÓN
// Flujo: superadmin genera token → director recibe link → abre hub → se registra
// ══════════════════════════════════════════════════════════════════════

// Estado global del token activo
window._inviteData = null;

function inviteMostrarTokenUsado(inv) {
  // Invitation was used — show helpful screen to log in directly
  const loginEl = document.getElementById('hub-login');
  if (loginEl) loginEl.style.display = 'none';

  const screen = document.createElement('div');
  screen.id = 'invite-screen';
  screen.style.cssText = 'position:fixed;inset:0;background:#f0fdf4;display:flex;align-items:center;justify-content:center;z-index:500;font-family:"Sora",sans-serif;padding:24px;';
  const email = inv?.email_destino || '';
  const rolLabels = { director:'Director/a', admin:'Administrador/a', docente:'Docente',
    coordinador:'Coordinador/a', ts:'Trabajo Social', prefecto:'Prefecto/a',
    tutor:'Tutor/a', subdirector:'Subdirector/a',
    contralor:'Contralor/a', medico:'Médico escolar', orientador:'Orientador/a' };

  screen.innerHTML = `
    <div style="max-width:420px;width:100%;text-align:center;">
      <div style="font-size:56px;margin-bottom:16px;">🔑</div>
      <div style="font-family:'Fraunces',serif;font-size:24px;font-weight:700;color:#0d5c2f;margin-bottom:10px;">
        Tu cuenta ya fue creada
      </div>
      <div style="font-size:14px;color:#475569;line-height:1.7;margin-bottom:24px;">
        Esta invitación ya fue utilizada y tu cuenta de <strong>${rolLabels[inv?.rol]||'usuario'}</strong>
        está lista. Inicia sesión con el correo y contraseña que registraste.
      </div>
      ${email ? `<div style="background:white;border-radius:12px;padding:14px;font-size:13px;color:#475569;margin-bottom:20px;border:1px solid #e2e8f0;">
        <strong>Correo:</strong> ${email}
      </div>` : ''}
      <button onclick="inviteVolverlLogin()" 
        style="width:100%;padding:14px;background:linear-gradient(135deg,#0d5c2f,#157a40);color:white;border:none;border-radius:12px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;">
        Iniciar sesión →
      </button>
      <div style="margin-top:14px;">
        <a href="#" onclick="inviteVolverlLogin()" 
          style="font-size:13px;color:#64748b;text-decoration:none;">
          ¿Olvidaste tu contraseña? Usa "Recuperar contraseña" en la pantalla de login
        </a>
      </div>
    </div>`;
  document.body.appendChild(screen);
}

async function inviteProcessToken(token) {
  // Mostrar login normal mientras verificamos
  const loginEl = document.getElementById('hub-login');
  if (loginEl) loginEl.style.display = 'grid';

  if (!sb) {
    // Sin Supabase: mostrar onboarding demo
    inviteMostrarPantalla({
      token, rol: 'docente', escuela_id: null,
      escuelas: { nombre: 'Escuela Demo', cct: 'DEMO001' },
      email_destino: '', nombre_destino: '', estado: 'pendiente'
    });
    return;
  }

  try {
    hubToast('🔑 Verificando invitación…');
    console.log('[invite] Buscando token:', token.slice(0,12) + '...');
    // Primero buscar la invitación SIN join a escuelas (por si escuela_id no es UUID válido)
    let inv = null;
    let escuelaData = null;
    
    // Intentar con join primero
    const { data: invJoin, error: errJoin } = await sb
      .from('invitaciones')
      .select('*, escuelas(id, nombre, cct, municipio, estado, nivel, nivel_default)')
      .eq('token', token)
      .maybeSingle();
    
    if (invJoin) {
      inv = invJoin;
      escuelaData = invJoin.escuelas;
    } else {
      // Fallback: buscar sin join
      const { data: invPlain, error: errPlain } = await sb
        .from('invitaciones')
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (errPlain) throw errPlain;
      if (invPlain) {
        inv = invPlain;
        // Buscar escuela — primero por escuela_id, luego por escuela_cct
        if (invPlain.escuela_id) {
          const isUuidInv = /^[0-9a-f-]{36}$/i.test(String(invPlain.escuela_id));
          if (isUuidInv) {
            const { data: esc1 } = await sb.from('escuelas')
              .select('id, nombre, cct, municipio, estado, nivel, nivel_default')
              .eq('id', invPlain.escuela_id).maybeSingle();
            if (esc1) escuelaData = esc1;
          }
          if (!escuelaData) {
            const { data: esc2 } = await sb.from('escuelas')
              .select('id, nombre, cct, municipio, estado, nivel, nivel_default')
              .eq('cct', invPlain.escuela_id).maybeSingle();
            if (esc2) escuelaData = esc2;
          }
        }
        // Fallback: usar escuela_cct del invite
        if (!escuelaData && invPlain.escuela_cct) {
          const { data: esc3 } = await sb.from('escuelas')
            .select('id, nombre, cct, municipio, estado, nivel, nivel_default')
            .eq('cct', invPlain.escuela_cct).maybeSingle();
          if (esc3) escuelaData = esc3;
        }
        inv.escuelas = escuelaData;
      }
    }

    if (!inv) {
      console.error('[invite] Token no encontrado en BD:', token.slice(0,12) + '...');
      inviteMostrarError('Token inválido. Pide una nueva invitación a tu administrador.');
      return;
    }
    console.log('[invite] Token encontrado → estado:', inv.estado, '| escuela_cct:', inv.escuela_cct, '| rol:', inv.rol);
    if (inv.estado === 'usado') {
      // Token used — check if user can just log in
      inviteMostrarTokenUsado(inv);
      return;
    }
    if (inv.expira_at && new Date(inv.expira_at) < new Date()) {
      inviteMostrarError('Esta invitación ha expirado. Solicita una nueva al administrador de tu escuela.');
      return;
    }

    window._inviteData = inv;
    inviteMostrarPantalla(inv);

  } catch(e) {
    console.warn('[invite] error:', e.message);
    inviteMostrarError('No se pudo verificar la invitación. Verifica tu conexión e intenta de nuevo.');
  }
}

function inviteMostrarError(msg) {
  const loginEl = document.getElementById('hub-login');
  if (!loginEl) return;
  // Inyectar banner de error sobre el login normal
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#fef2f2;border-bottom:2px solid #ef4444;padding:14px 24px;display:flex;align-items:center;gap:12px;z-index:9999;font-family:"Sora",sans-serif;font-size:13px;color:#b91c1c;';
  banner.innerHTML = `<span style="font-size:20px;">⚠️</span><span>${msg}</span><button onclick="this.parentElement.remove()" style="margin-left:auto;background:none;border:none;font-size:18px;cursor:pointer;color:#b91c1c;" aria-label="Cerrar">✕</button>`;
  document.body.insertBefore(banner, document.body.firstChild);
}

function inviteMostrarPantalla(inv) {
  // Ocultar login normal
  const loginEl = document.getElementById('hub-login');
  if (loginEl) loginEl.style.display = 'none';

  // Crear pantalla de onboarding
  const rolLabels = {
    director:'Director/a', admin:'Administrador/a', docente:'Docente',
    coordinador:'Coordinador/a', ts:'Trabajo Social', prefecto:'Prefecto/a',
    tutor:'Tutor/a de grupo', subdirector:'Subdirector/a',
    contralor:'Contralor/a', medico:'Médico escolar', orientador:'Orientador/a',
  };
  const rolIcos = {
    director:'👩‍💼', admin:'⚙️', docente:'👩‍🏫', coordinador:'📋',
    ts:'⚖️', prefecto:'🛡️', tutor:'🎓', subdirector:'🏫',
    contralor:'🧾', medico:'🩺', orientador:'🧭',
  };
  const esc = inv.escuelas || {};
  const rolLbl = rolLabels[inv.rol] || inv.rol;
  const rolIco = rolIcos[inv.rol] || '👤';

  const screen = document.createElement('div');
  screen.id = 'invite-screen';
  screen.style.cssText = 'min-height:100vh;display:grid;grid-template-columns:1fr 1fr;animation:fadeIn .5s ease;';
  screen.innerHTML = `
    <div class="login-left" style="position:relative;">
      <div class="login-accent"></div>
      <div class="brand-logo">
        <div class="brand-icon">🌱</div>
        <div class="brand-text"><h1>SIEMBRA</h1><p>Portal Educativo</p></div>
      </div>
      <div class="login-hero">
        <h2>Bienvenido/a a<br><em>${esc.nombre || 'tu escuela'}</em></h2>
        <p>Estás a un paso de acceder a SIEMBRA. Crea tu cuenta para comenzar.</p>
      </div>
      <div class="login-stats">
        <div class="stat-item"><div class="stat-num">${rolIco}</div><div class="stat-label">${rolLbl}</div></div>
        <div class="stat-item"><div class="stat-num">NEM</div><div class="stat-label">2026</div></div>
        <div class="stat-item"><div class="stat-num">✓</div><div class="stat-label">Verificado</div></div>
      </div>
    </div>
    <div class="login-right">
      <div class="login-form-wrap">
        <div style="background:#dcfce7;border:1.5px solid #86efac;border-radius:12px;padding:14px 16px;margin-bottom:22px;">
          <div style="font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">🔑 Invitación verificada</div>
          <div style="font-size:13px;color:#166534;line-height:1.5;">
            Rol: <strong>${rolLbl}</strong><br>
            Escuela: <strong>${esc.nombre || '—'}</strong>${esc.cct ? ' · ' + esc.cct : ''}
          </div>
        </div>

        <h3 style="margin-bottom:4px;">Crea tu cuenta</h3>
        <p style="margin-bottom:16px;">Completa tus datos para acceder a SIEMBRA</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group">
            <label>Nombre(s)</label>
            <input type="text" id="inv-nombre" placeholder="María" style="width:100%;padding:10px;border:1.5px solid var(--gris-20);border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;">
          </div>
          <div class="form-group">
            <label>Apellidos</label>
            <input type="text" id="inv-apellidos" placeholder="Apellido(s)" style="width:100%;padding:10px;border:1.5px solid var(--gris-20);border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;">
          </div>
        </div>
        <div class="form-group">
          <label>Correo electrónico</label>
          <input type="email" id="inv-email" value="${inv.email_destino || ''}" placeholder="correo&#64;escuela.edu.mx" style="width:100%;padding:10px;border:1.5px solid var(--gris-20);border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;">
        </div>
        <div class="form-group">
          <label>Contraseña</label>
          <input type="password" id="inv-pass" placeholder="Mínimo 8 caracteres" style="width:100%;padding:10px;border:1.5px solid var(--gris-20);border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;" onkeydown="if(event.key==='Enter')inviteCrearCuenta()">
        </div>
        <div class="form-group">
          <label>Confirmar contraseña</label>
          <input type="password" id="inv-pass2" placeholder="Repite tu contraseña" style="width:100%;padding:10px;border:1.5px solid var(--gris-20);border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;" onkeydown="if(event.key==='Enter')inviteCrearCuenta()">
        </div>

        <div id="inv-error" style="color:var(--rojo);font-size:12px;margin-bottom:10px;display:none;"></div>

        <button class="btn-login" onclick="inviteCrearCuenta()" id="inv-btn">
          Crear mi cuenta y entrar →
        </button>

        <div style="text-align:center;margin-top:14px;">
          <button onclick="inviteVolverlLogin()" style="background:none;border:none;font-family:'Sora',sans-serif;font-size:12px;color:var(--gris-50);cursor:pointer;">
            ← Ya tengo cuenta, iniciar sesión
          </button>
        </div>
      </div>
    </div>`;

  document.body.insertBefore(screen, document.getElementById('hub-login'));

  // Pre-llenar nombre si viene en la invitación
  if (inv.nombre_destino) {
    const partes = inv.nombre_destino.trim().split(' ');
    const ni = document.getElementById('inv-nombre');
    const ai = document.getElementById('inv-apellidos');
    if (ni) ni.value = partes[0] || '';
    if (ai) ai.value = partes.slice(1).join(' ') || '';
  }
}

async function inviteCrearCuenta() {
  const inv    = window._inviteData;
  const nombre = document.getElementById('inv-nombre')?.value.trim();
  const apells = document.getElementById('inv-apellidos')?.value.trim();
  const email  = document.getElementById('inv-email')?.value.trim().toLowerCase();
  const pass   = document.getElementById('inv-pass')?.value;
  const pass2  = document.getElementById('inv-pass2')?.value;
  const errEl  = document.getElementById('inv-error');
  const btn    = document.getElementById('inv-btn');

  errEl.style.display = 'none';

  if (!nombre)          { errEl.style.display='block'; errEl.textContent='⚠️ Ingresa tu nombre'; return; }
  if (!email)           { errEl.style.display='block'; errEl.textContent='⚠️ Ingresa tu correo'; return; }
  if (!pass||pass.length<8) { errEl.style.display='block'; errEl.textContent='⚠️ La contraseña debe tener al menos 8 caracteres'; return; }
  if (pass !== pass2)   { errEl.style.display='block'; errEl.textContent='⚠️ Las contraseñas no coinciden'; return; }

  btn.textContent = 'Creando cuenta…'; btn.disabled = true;

  try {
    const nombreCompleto = `${nombre} ${apells}`.trim();
    const rol       = inv?.rol || 'docente';

    // Resolver escuela: el invite ahora guarda el UUID real en escuela_id
    // Si escuela_id parece un UUID (tiene guiones), usarlo como UUID
    // Si parece un CCT (sin guiones), es el CCT
    const invEscuelaId  = inv?.escuela_id || null;
    const isUuid = invEscuelaId && /^[0-9a-f-]{36}$/i.test(invEscuelaId);
    const escuelaId  = isUuid ? invEscuelaId : (inv?.escuelas?.id || null);
    const escuelaCct = isUuid ? (inv?.escuelas?.cct || inv?.escuela_cct || null)
                               : (invEscuelaId || inv?.escuelas?.cct || null);
    // Nivel de la escuela — viene del invite o de la escuela resuelta
    const escuelaNivel = inv?.escuela_nivel || inv?.escuelas?.nivel_default
      || inv?.escuelas?.nivel || null;
    const token     = window._inviteToken;

    // 1. Intentar login primero — si ya existe la cuenta (creada por admin vía inviteUserByEmail)
    let authUser = null;
    let loginOk  = false;
    if (sb) {
      const { data: loginData, error: loginErr } = await sb.auth.signInWithPassword({ email, password: pass });
      if (!loginErr && loginData?.user) {
        authUser = loginData.user;
        loginOk  = true;
      }
    }

    // 2. Si no existe, crear cuenta nueva
    if (!loginOk && sb) {
      const { data: signupData, error: signupErr } = await sb.auth.signUp({
        email, password: pass,
        options: { data: { nombre: nombreCompleto, rol } }
      });
      // If already registered, try login again (different password case)
      if (signupErr?.message?.includes('already registered')) {
        errEl.style.display = 'block';
        errEl.textContent   = '⚠️ Este correo ya tiene una cuenta. Usa tu contraseña anterior o recupera tu contraseña.';
        btn.textContent = 'Crear mi cuenta y entrar →'; btn.disabled = false;
        return;
      }
      if (signupErr) throw signupErr;
      authUser = signupData?.user;
    }

    // 3. Guardar/vincular perfil en tabla usuarios
    // Estrategia: primero buscar si ya existe por email (creado por admin sin auth_id)
    // Si existe → actualizar auth_id. Si no → insertar nuevo.
    if (sb && authUser) {
      let perfilGuardado = false;

      // 3a. Buscar si ya existe un perfil con este email (sin auth_id, creado por admin)
      try {
        const { data: existente } = await sb.from('usuarios')
          .select('id, auth_id').eq('email', email).maybeSingle();

        if (existente) {
          // Ya existe — solo actualizar auth_id y asegurar datos frescos
          const { error: updErr } = await sb.from('usuarios').update({
            auth_id:     authUser.id,
            activo:      true,
            escuela_id:  escuelaId  || existente.escuela_id  || null,
            escuela_cct: escuelaCct || existente.escuela_cct || null,
          }).eq('id', existente.id);
          if (!updErr) {
            perfilGuardado = true;
            console.log('[invite] ✅ auth_id vinculado al perfil existente:', existente.id);
          } else {
            console.warn('[invite] update auth_id:', updErr.message);
          }
        }
      } catch(e1) { console.warn('[invite] buscar existente:', e1.message); }

      // 3b. Si no existía, intentar upsert_usuario RPC
      if (!perfilGuardado) {
        try {
          const { error: rpcCreateErr } = await sb.rpc('upsert_usuario', {
            p_auth_id:    authUser.id,
            p_email:      email,
            p_nombre:     nombre,
            p_apellido_p: apells?.split(' ')[0] || '',
            p_apellido_m: apells?.split(' ').slice(1).join(' ') || '',
            p_rol:        rol,
            p_escuela_id:  escuelaId  || '',
            p_escuela_cct: escuelaCct || '',
          });
          if (!rpcCreateErr) {
            perfilGuardado = true;
            console.log('[invite] ✅ perfil creado via upsert_usuario RPC');
          } else {
            console.warn('[invite] upsert_usuario RPC error:', rpcCreateErr.message, rpcCreateErr.code);
          }
        } catch(rpcErr) {
          console.warn('[invite] upsert_usuario RPC excepción:', rpcErr.message);
        }
      }

      // 3c. Último fallback: insert directo
      if (!perfilGuardado) {
        try {
          await sb.from('usuarios').insert({
            auth_id:     authUser.id,
            email, nombre,
            apellido_p:  apells?.split(' ')[0] || '',
            apellido_m:  apells?.split(' ').slice(1).join(' ') || '',
            rol,
            escuela_id:  escuelaId  || null,
            escuela_cct: escuelaCct || null,
            activo: true,
          });
          perfilGuardado = true;
          console.log('[invite] ✅ perfil creado via insert directo');
        } catch(insErr) {
          // Si es duplicado, intentar update por email una vez más
          if (insErr.code === '23505') {
            try {
              await sb.from('usuarios').update({ auth_id: authUser.id, activo: true }).eq('email', email);
              perfilGuardado = true;
              console.log('[invite] ✅ auth_id actualizado en segundo intento');
            } catch(e3) { console.warn('[invite] segundo update:', e3.message); }
          } else {
            console.warn('[invite] insert fallback:', insErr.message);
          }
        }
      }

      if (!perfilGuardado) {
        console.error('[invite] ❌ No se pudo guardar el perfil del usuario');
      }
    }

    // 4. Marcar token como usado — SOLO ahora que todo salió bien
    if (sb && token) {
      await sb.from('invitaciones')
        .update({ estado: 'usado', usado_por: authUser?.id, updated_at: new Date().toISOString() })
        .eq('token', token)
        .eq('estado', 'pendiente'); // Solo si aún está pendiente (evita doble marcado)
    }

    // 4. Mostrar confirmación y hacer login automático
    document.getElementById('invite-screen').innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f0fdf4;">
        <div style="text-align:center;padding:40px;max-width:440px;">
          <div style="font-size:64px;margin-bottom:20px;">✅</div>
          <div style="font-family:'Fraunces',serif;font-size:26px;font-weight:700;color:#0d5c2f;margin-bottom:12px;">¡Cuenta creada!</div>
          <div style="font-size:14px;color:#475569;line-height:1.7;margin-bottom:24px;">
            Bienvenido/a a SIEMBRA, <strong>${nombreCompleto}</strong>.<br>
            Revisa tu correo <strong>${email}</strong> para confirmar tu cuenta.<br><br>
            En unos segundos entrarás automáticamente…
          </div>
          <div style="width:40px;height:40px;border:3px solid #86efac;border-top-color:#0d5c2f;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto;"></div>
        </div>
      </div>`;

    // 5. Si ya hicimos login exitoso, entrar directo al portal
    if (loginOk && authUser) {
      currentUser = authUser;
      try { await cargarPerfilHub(); } catch(e) {}
      document.getElementById('invite-screen')?.remove();
      mostrarPortalSegunRol();
      return;
    }

    // 6. Si la cuenta es nueva (signUp), intentar auto-login
    setTimeout(async () => {
      try {
        if (sb) {
          const { data: al, error: ae } = await sb.auth.signInWithPassword({ email, password: pass });
          if (!ae && al?.user) {
            currentUser = al.user;
            try { await cargarPerfilHub(); } catch(e) {}
            document.getElementById('invite-screen')?.remove();
            mostrarPortalSegunRol();
            return;
          }
        }
        // Email no confirmado o error — mostrar login con instrucciones claras
        document.getElementById('invite-screen')?.remove();
        const loginEl = document.getElementById('hub-login');
        if (loginEl) {
          loginEl.style.display = 'grid';
          // Pre-fill email
          const emailIn = document.getElementById('hub-email');
          if (emailIn) emailIn.value = email;
          // Show clear message
          const errEl = document.getElementById('hub-error');
          if (errEl) {
            errEl.style.display = 'block';
            errEl.style.background = '#f0fdf4';
            errEl.style.color = '#166534';
            errEl.textContent = '✅ Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión aquí.';
          }
        }
      } catch(e) { console.warn('[invite] auto-login:', e.message); }
    }, 1500);

  } catch(e) {
    errEl.style.display = 'block';
    errEl.textContent = '❌ ' + (e.message?.includes('already registered')
      ? 'Este correo ya tiene una cuenta. Usa "Ya tengo cuenta" para iniciar sesión.'
      : (e.message || 'Error al crear la cuenta'));
    btn.textContent = 'Crear mi cuenta y entrar →'; btn.disabled = false;
  }
}

function inviteVolverlLogin() {
  document.getElementById('invite-screen')?.remove();
  const loginEl = document.getElementById('hub-login');
  if (loginEl) loginEl.style.display = 'grid';
  window._inviteData  = null;
  window._inviteToken = null;
}

// ── Función para generar links de invitación desde el hub (para directores) ──
async function dirGenerarInvitacion(rol, emailDestino, nombreDestino, dias) {
  const _escId  = currentPerfil?.escuela_id  || null;
  const _escCct = currentPerfil?.escuela_cct || null;
  if (!sb || (!_escId && !_escCct)) {
    hubToast('⚠️ Necesitas estar vinculado a una escuela', 'warn');
    return null;
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const token = Array.from(arr, b => chars[b % chars.length]).join('');
  const diasVal = dias || 7;
  const expira = new Date(Date.now() + diasVal * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { error } = await sb.from('invitaciones').insert({
      token,
      escuela_id:     _escId,
      escuela_cct:    _escCct,
      rol,
      email_destino:  emailDestino || null,
      nombre_destino: nombreDestino || null,
      estado:         'pendiente',
      expira_at:      expira,
      created_at:     new Date().toISOString(),
    });
    if (error) throw error;

    // Construir link
    const base = location.origin + '/index.html';
    const link = `${base}?invite=${token}`;
    return { token, link, expira };
  } catch(e) {
    hubToast('❌ Error generando invitación: ' + e.message, 'error');
    return null;
  }
}

async function doLogin() {
  const email = document.getElementById('login-email')?.value?.trim()
              || document.querySelector('#login-screen input[type="email"], #login-screen input[type="text"]')?.value?.trim();
  const pass  = document.querySelector('#login-screen input[type="password"]')?.value?.trim();
  const btn   = document.querySelector('#login-screen .btn-login');
  if (!email || !pass) { hubToast('⚠️ Ingresa tu correo y contraseña', 'warn'); return; }
  if (btn) { btn.textContent = 'Entrando…'; btn.disabled = true; }
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    currentUser = data.user;
    localStorage.setItem('siembra_last_activity', String(Date.now()));
    await cargarPerfilHub();
    mostrarPortalSegunRol();
  } catch(e) {
    const msg = e.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : e.message;
    hubToast('❌ ' + msg, 'error');
    if (btn) { btn.textContent = 'Entrar'; btn.disabled = false; }
  }
}

async function doLogout() {
  try { await sb.auth.signOut(); } catch(e) {}
  currentUser = null; currentPerfil = null;
  // Ocultar todos los portales
  ['doc-portal','admin-portal','padre-portal','dir-portal','ts-portal',
   'subdir-portal','coord-portal','superadmin-portal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Mostrar login
  const hubLogin = document.getElementById('hub-login');
  if (hubLogin) hubLogin.style.display = 'grid';
}
async function dToggleNotif() {
  let panel = document.getElementById('notif-panel-global');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'notif-panel-global';
    panel.className = 'notif-panel';
    panel.style.cssText = 'position:fixed;top:64px;right:20px;width:340px;background:white;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.15);border:1px solid #e2e8f0;z-index:9999;display:none;max-height:480px;overflow-y:auto;';
    panel.innerHTML = `<div class="notif-header" style="padding:16px 20px;border-bottom:1px solid #f1f5f9;font-weight:700;font-size:14px;display:flex;justify-content:space-between;align-items:center;">
      <span>Notificaciones</span>
      <button onclick="document.getElementById('notif-panel-global').style.display='none'" style="background:none;border:none;cursor:pointer;font-size:18px;color:#94a3b8;">×</button>
    </div><div id="notif-lista" style="padding:8px 0;"><div style="padding:24px;text-align:center;color:#94a3b8;font-size:13px;">Cargando…</div></div>`;
    document.body.appendChild(panel);
    document.addEventListener('click', (e) => {
      const p2 = document.getElementById('notif-panel-global');
      if (p2 && p2.style.display !== 'none' && !p2.contains(e.target) && !e.target.closest('[onclick*="dToggleNotif"]')) {
        p2.style.display = 'none';
      }
    });
  }
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    const lista = document.getElementById('notif-lista');
    if (!lista) return;
    const cct = window.currentPerfil?.escuela_cct;
    const uid = window.currentPerfil?.id;
    if (!window.sb || !cct) {
      lista.innerHTML = '<div style="padding:16px 20px;font-size:13px;color:#94a3b8;">Sin conexión a datos.</div>';
      return;
    }
    try {
      const { data } = await window.sb.from('alertas')
        .select('id,tipo,mensaje,created_at,leida,alumno_nombre')
        .eq('escuela_cct', cct)
        .order('created_at', { ascending: false })
        .limit(20);
      const items = data || [];
      if (!items.length) {
        lista.innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8;font-size:13px;">Sin notificaciones recientes.</div>';
        return;
      }
      const iconoMap = { riesgo:'🚨', academico:'📚', conducta:'⚠️', familiar:'👨‍👩‍👧', asistencia:'📋', salud:'🏥', beca:'💰', default:'🔔' };
      lista.innerHTML = items.map(n => {
        const ico = iconoMap[n.tipo] || iconoMap.default;
        const ts = n.created_at ? new Date(n.created_at).toLocaleDateString('es-MX',{day:'2-digit',month:'short'}) : '';
        const bg = n.leida ? '' : 'background:#f0fdf4;';
        return `<div class="notif-item" style="padding:12px 20px;border-bottom:1px solid #f1f5f9;display:flex;gap:12px;cursor:pointer;${bg}" onclick="this.style.background='';dMarcarNotifLeida('${n.id}')">
          <div style="width:36px;height:36px;border-radius:10px;background:#dcfce7;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;">${ico}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${n.alumno_nombre||n.tipo||'Notificación'}</div>
            <div style="font-size:12px;color:#475569;margin-top:2px;line-height:1.4;">${n.mensaje||''}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px;">${ts}</div>
          </div>
        </div>`;
      }).join('');
      const noLeidas = items.filter(n => !n.leida).length;
      document.querySelectorAll('[onclick*="dToggleNotif"] .badge, .tb-btn .badge').forEach(b => {
        b.textContent = noLeidas > 0 ? noLeidas : '';
        b.style.display = noLeidas > 0 ? '' : 'none';
      });
    } catch(e) {
      lista.innerHTML = '<div style="padding:16px 20px;font-size:13px;color:#ef4444;">Error al cargar notificaciones.</div>';
    }
  }
}

async function dMarcarNotifLeida(id) {
  if (!window.sb || !id) return;
  await window.sb.from('alertas').update({ leida: true }).eq('id', id);
}

// NAV
// ── Nivel docente: fuerza el nivel asignado por admin y muestra/oculta switcher ──
function _aplicarNivelDocente(escuela) {
  const nivelDocente  = window.currentPerfil?.nivel;           // 'primaria' | 'secundaria' | 'ambos' | null
  const escTieneAmbos = escuela?.nivel === 'primaria_y_secundaria';
  const switcher      = document.getElementById('nivel-selector-doc');

  // Si el admin asignó un nivel específico (no 'ambos'), forzarlo
  if (nivelDocente && nivelDocente !== 'ambos') {
    window._nivelActivo = nivelDocente;
    try { localStorage.setItem('siembra_nivel', nivelDocente); } catch(e) {}
  }

  // Switcher visible solo si: escuela tiene ambos niveles Y docente tiene acceso a ambos
  if (switcher) {
    const puedeSwitch = escTieneAmbos && (!nivelDocente || nivelDocente === 'ambos');
    switcher.style.display = puedeSwitch ? 'flex' : 'none';
  }
}

// ── Selector Primaria / Secundaria ─────────────────────────────────────────
function cambiarNivel(nivel) {
  const grupoActivoDoc = (window._gruposDocente || []).find(g => String(g.id) === String(window._grupoActivo));
  const nivelGrupoDoc = grupoActivoDoc?.nivel || null;

  // Dentro del portal docente, el grupo activo manda sobre el nivel de escuela
  if (nivelGrupoDoc && document.getElementById('doc-portal')) {
    nivel = nivelGrupoDoc;
  }

  // Resolver el nivel real de la escuela activa antes de forzar el switcher.
  // `_escuelaCfg.nivel_default` puede quedar desfasado; por eso priorizamos
  // `ESCUELA_ACTIVA.nivel` y `ESCUELA_ACTIVA.nivel_default`.
  const escuelaActiva = window.ESCUELA_ACTIVA || window._escuelaCfg || {};
  const escuelaNivelRaw = String(
    escuelaActiva.nivel
    || escuelaActiva.nivel_default
    || window.currentPerfil?.nivel_default
    || window._escuelaCfg?.nivel
    || window._escuelaCfg?.nivel_default
    || ''
  ).trim().toLowerCase();
  const escuelaNivel = (escuelaNivelRaw === 'ambos' || escuelaNivelRaw === 'primaria_y_secundaria')
    ? 'ambos'
    : escuelaNivelRaw;
  
  // Si la escuela solo tiene un nivel, forzar ese nivel
  if (!nivelGrupoDoc && escuelaNivel === 'primaria' && nivel === 'secundaria') {
    hubToast && hubToast('⚠️ Tu escuela solo tiene nivel primaria', 'warn');
    nivel = 'primaria';
  }
  if (!nivelGrupoDoc && escuelaNivel === 'secundaria' && nivel === 'primaria') {
    hubToast && hubToast('⚠️ Tu escuela solo tiene nivel secundaria', 'warn');
    nivel = 'secundaria';
  }

  window._nivelActivo = nivel;
  localStorage.setItem('siembra_nivel', nivel);

  // Actualizar botones en portal docente
  const priDoc = document.getElementById('btn-nivel-pri');
  const secDoc = document.getElementById('btn-nivel-sec');
  if (priDoc && secDoc) {
    priDoc.style.background  = nivel === 'primaria'   ? 'var(--verde)'  : 'var(--crema)';
    priDoc.style.color       = nivel === 'primaria'   ? 'white'         : 'var(--gris-50)';
    secDoc.style.background  = nivel === 'secundaria' ? 'var(--verde)'  : 'var(--crema)';
    secDoc.style.color       = nivel === 'secundaria' ? 'white'         : 'var(--gris-50)';
  }
  // Actualizar botones en portal director
  const priDir = document.getElementById('dir-btn-nivel-pri');
  const secDir = document.getElementById('dir-btn-nivel-sec');
  if (priDir && secDir) {
    priDir.style.background  = nivel === 'primaria'   ? 'var(--verde)'  : 'var(--crema)';
    priDir.style.color       = nivel === 'primaria'   ? 'white'         : 'var(--gris-50)';
    secDir.style.background  = nivel === 'secundaria' ? 'var(--verde)'  : 'var(--crema)';
    secDir.style.color       = nivel === 'secundaria' ? 'white'         : 'var(--gris-50)';
  }
  // Actualizar botones en portal admin
  const priAdm = document.getElementById('adm-btn-nivel-pri');
  const secAdm = document.getElementById('adm-btn-nivel-sec');
  if (priAdm && secAdm) {
    priAdm.style.background  = nivel === 'primaria'   ? 'var(--verde)'  : 'var(--crema)';
    priAdm.style.color       = nivel === 'primaria'   ? 'white'         : 'var(--gris-50)';
    secAdm.style.background  = nivel === 'secundaria' ? 'var(--verde)'  : 'var(--crema)';
    secAdm.style.color       = nivel === 'secundaria' ? 'white'         : 'var(--gris-50)';
  }
  // Actualizar botones en portal TS
  const priTs = document.getElementById('ts-btn-nivel-pri');
  const secTs = document.getElementById('ts-btn-nivel-sec');
  if (priTs && secTs) {
    priTs.style.background   = nivel === 'primaria'   ? 'var(--ts-azul)': 'rgba(255,255,255,.12)';
    priTs.style.color        = 'white';
    secTs.style.background   = nivel === 'secundaria' ? 'var(--ts-azul)': 'rgba(255,255,255,.12)';
    secTs.style.color        = 'white';
  }

  // MATERIAS_NEM is now dynamic via Proxy — it auto-reflects the new nivel
  // Just need to re-render the UI components that use it

  // Re-render calificaciones mat buttons
  const matWrap = document.getElementById('cal-mat-buttons') || document.querySelector('.cal-materias-wrap');
  if (matWrap && typeof calRenderMatButtons === 'function') calRenderMatButtons();

  // Re-init cal structure for new materias
  const newMats = getMateriasByNivel(nivel);
  newMats.forEach(mat => {
    if (!CAL_ASPECTOS[mat]) CAL_ASPECTOS[mat] = ASPECTOS_DEFAULT.map(a => ({...a}));
    if (!CAL_DATA[mat]) { CAL_DATA[mat] = {}; const _n0 = _calCfg().num_periodos; for (let i = 1; i <= _n0; i++) CAL_DATA[mat][i] = {}; }
  });
  if (typeof calInit === 'function') {
    calMatActual = newMats[0] || calMatActual;
    calInit();
  }

  // Re-render planeaciones if visible
  if (typeof planSetNivel === 'function') planSetNivel(nivel);

  // Re-render observaciones materias selector
  if (typeof obsActualizarMaterias === 'function') obsActualizarMaterias();

  // Update materias selects everywhere
  document.querySelectorAll('select[data-type="materia"]').forEach(sel => {
    const current = sel.value;
    sel.innerHTML = newMats.map(m => `<option value="${m}">${m}</option>`).join('');
    if (newMats.includes(current)) sel.value = current;
  });

  // Recargar grupos del nivel activo si hay datos de Supabase
  if (window._gruposDocente?.length) {
    const gruposFiltrados = window._gruposDocente.filter(g => !g.nivel || g.nivel === nivel);
    if (gruposFiltrados.length) {
      window._grupoActivo = gruposFiltrados[0].id;
      calCargarAlumnosGrupo(gruposFiltrados[0].id).then(al => {
        if (al.length) { window._alumnosActivos = al; alumnos.length=0; al.forEach(a=>alumnos.push(a)); }
      }).catch(()=>{});
    }
  }

  // Actualizar título de calificaciones con el grupo activo tras cambio de nivel
  const _gActNiv = (window._gruposDocente||[]).find(g=>g.id===window._grupoActivo);
  const _gNomNiv = _gActNiv?.nombre || (_gActNiv ? `${_gActNiv.grado}° ${_gActNiv.seccion||_gActNiv.grupo||'A'}` : '—');
  const calH2 = document.getElementById('cal-titulo-h2');
  if (calH2) calH2.textContent = `Calificaciones · ${_gNomNiv}`;
  if (document.getElementById('p-calificaciones')?.classList.contains('active')) {
    document.getElementById('page-title').textContent = `Calificaciones · ${_gNomNiv}`;
  }

  // Update calificaciones scale info for secundaria
  const escalaInfo = document.getElementById('cal-escala-info');
  if (escalaInfo) {
    escalaInfo.innerHTML = nivel === 'secundaria'
      ? '🔢 Escala: <strong>5 – 10</strong> numérica · Mínimo aprobatorio: <strong>5</strong> · <strong>Calificación siempre numérica</strong> (Secundaria)'
      : '🔢 Escala: <strong>5 – 10</strong> · Mínimo aprobatorio: <strong>5</strong> · No hay reprobación (NEM)';
  }

  // Hide/show nivel switcher buttons based on school config
  const priBtn = document.getElementById('btn-nivel-pri');
  const secBtn = document.getElementById('btn-nivel-sec');
  if (priBtn && secBtn) {
    if (escuelaNivel === 'primaria') {
      priBtn.style.display = ''; secBtn.style.display = 'none';
    } else if (escuelaNivel === 'secundaria') {
      priBtn.style.display = 'none'; secBtn.style.display = '';
    } else {
      priBtn.style.display = ''; secBtn.style.display = '';
    }
  }
  // Sincronizar nivel en topbars de todos los portales
  if (typeof _topbarSyncAll === 'function') _topbarSyncAll();
}

// Inicializar estado visual del selector al cargar
(function initNivelUI() {
  document.addEventListener('DOMContentLoaded', () => {
    // Determinar nivel desde: 1) perfil del usuario, 2) config escuela, 3) localStorage, 4) default
    const perfilNivel = window.currentPerfil?.nivel_default;
    const escuelaNivel = window._escuelaCfg?.nivel_default;
    let n;
    
    // Si la escuela es solo secundaria, forzar secundaria
    if (escuelaNivel === 'secundaria') {
      n = 'secundaria';
    } else if (escuelaNivel === 'primaria') {
      n = 'primaria';
    } else {
      // Escuela con ambos niveles — prioridad: grupo activo > perfil > localStorage > secundaria
      const grupoActNivel = window._gruposDocente?.[0]?.nivel;
      n = grupoActNivel || perfilNivel || localStorage.getItem('siembra_nivel') || window._nivelActivo || 'secundaria';
    }

    const grupoActivoDoc = (window._gruposDocente || []).find(g => String(g.id) === String(window._grupoActivo)) || window._gruposDocente?.[0];
    if (grupoActivoDoc?.nivel) n = grupoActivoDoc.nivel;

    // Solo update visual si los botones existen (pueden cargarse tarde)
    setTimeout(() => cambiarNivel(n), 200);
  });
})();

function dNav(page) {
  closeSidebarOnMobile();
  document.querySelectorAll('#doc-portal .nav-btn').forEach(b=>b.classList.remove('active'));
  const btn = [...document.querySelectorAll('#doc-portal .nav-btn')].find(b=>b.getAttribute('onclick')===`dNav('${page}')`);
  if(btn) btn.classList.add('active');
  document.querySelectorAll('#doc-portal .page').forEach(p=>p.classList.remove('active'));
  const pg = document.getElementById('p-'+page);
  if(pg) pg.classList.add('active');
  // ── Título dinámico: calificaciones usa el nombre real del grupo activo ──
  const _grupoNomActivo = (function() {
    const gid = window._grupoActivo;
    if (!gid) return '—';
    const g = (window._gruposDocente || []).find(g => g.id === gid);
    return g?.nombre || g?.grado && g?.letra ? `${g.grado}° ${g.letra}` : '—';
  })();
  const titles = {
    dashboard:'Dashboard',
    calificaciones: `Calificaciones · ${_grupoNomActivo}`,
    asistencia:'Asistencia del día',
    horario:'Horario semanal',
    planeaciones:'Planeaciones NEM',
    observaciones:'Observaciones por alumno',
    tareas:'Actividades',
    entrevistas:'Entrevistas con padres',
    'comentarios-dir':'Canal con dirección',
    boletas:'Generador de boletas',
    reportes:'Reportes SEP',
    mensajes:'Mensajes con padres',
    calendario:'Calendario escolar',
    salones:'Mis salones',
    etiquetas:'Alumnos y etiquetas',
    acomodo:'Acomodo del salón',
    fichas:'Fichas descriptivas',
    portafolio:'Portafolio de Evidencias',
    examenes:'Exámenes',
    recuperaciones:'Recuperaciones',
    capacitacion:'Capacitación SEP',
  };
  document.getElementById('page-title').textContent = titles[page] || page;
  document.getElementById('notif-panel')?.classList.remove('open');
  if(page==='salones') { renderSalonesDoc(); salonesCargarCuentas(); }
  if(page==='etiquetas') { poblarSelectSalones(); renderAlumnosDoc(); if(typeof renderEtiquetasMultiGrupo==='function') renderEtiquetasMultiGrupo(); }
  if(page==='fichas') { fichaInit(); }
  if(page==='portafolio') { pfInit(); }
  if(page==='boletas') { bltInit(); }
  if(page==='tareas') { tareasInit(); rubricaRapidaInit(); }
  if(page==='calificaciones') { if(typeof calInit==='function') calInit(); }
  if(page==='entrevistas') { entrevistasInit(); }
  if(page==='comentarios-dir') { comentariosInternosInit(); }
  if(page==='examenes') { examenesInit(); }
  if(page==='recuperaciones') { recuperacionesInit(); }
  if(page==='capacitacion') { if(typeof docenteCapacitacionCargar==='function') docenteCapacitacionCargar(); }
  // ── Inits que faltaban ──
  if(page==='horario')    { if(typeof horarioCargarDB==='function') horarioCargarDB(); else if(typeof renderHorario==='function') renderHorario(); }
  if(page==='calendario') { if(typeof renderCalendario==='function') renderCalendario(); }
  if(page==='mensajes')   { if(typeof renderMensajes==='function') renderMensajes(); }
  if(page==='reportes')   { if(typeof renderReportes==='function') renderReportes(); }
  if(page==='tutoria')    { if(typeof tutoriaInit==='function') tutoriaInit(); }
  if(page==='acomodo') {
    poblarSelectSalones();
    // Auto-seleccionar primer grupo real si no hay activo
    if(!salonActivoDoc || !salonActivoDoc.id) {
      const gruposReales = window._gruposDocente || [];
      if (gruposReales.length) {
        const g = gruposReales[0];
        salonActivoDoc = { id: g.id, nombre: g.nombre || (g.grado+'° '+(g.seccion||'')).trim(), escuela: g.escuela_nombre || g.escuela_cct || '' };
      } else if (docSalones.length) {
        salonActivoDoc = docSalones[0];
      }
    }
    if(salonActivoDoc) {
      document.getElementById('acomodo-salon-label').textContent = salonActivoDoc.nombre + ' · ' + salonActivoDoc.escuela;
      document.getElementById('aco-salon-sel').value = salonActivoDoc.id || '';
      const pizGrupo = document.getElementById('aco-pizarron-grupo');
      if (pizGrupo) pizGrupo.textContent = salonActivoDoc.nombre || '';
      try{const raw=localStorage.getItem('aco_'+salonActivoDoc.id);docAcomodos=raw?JSON.parse(raw):[];}catch(e){docAcomodos=[];}
      // Cargar alumnos del grupo activo si docAlumnos está vacío o es de otro grupo
      if ((!docAlumnos.length || window._acoGrupoId !== salonActivoDoc.id) && sb && currentPerfil) {
        window._acoGrupoId = salonActivoDoc.id;
        cargarAlumnosGrupo(salonActivoDoc.id).then(data => {
          if (data?.length) {
            docAlumnos.length = 0;
            data.forEach(a => docAlumnos.push({ id: a.id, nombre: [a.nombre, a.apellido_p].filter(Boolean).join(' '), etiquetas: a.etiquetas || [], color: '#2db55d' }));
          }
          renderUnassignedDoc();
        }).catch(() => renderUnassignedDoc());
      }
    }
    // Reset grid con dimensiones actuales
    const filas=parseInt(document.getElementById('aco-filas')?.value)||5;
    const cols=parseInt(document.getElementById('aco-cols')?.value)||6;
    if(!docGridState.length) docGridState=Array.from({length:filas},()=>Array(cols).fill(null));
    renderGridDoc();
    renderSavedListDoc();
    renderUnassignedDoc();
  }
}

// INIT
async function initApp() {
  // ── Cargar datos reales del docente desde Supabase ──────────────────
  if (sb && currentPerfil) {
    try {
      // 0. Cargar escuelas reales del docente desde usuario_escuelas
      const { data: escuelasDB } = await sb
        .from('usuario_escuelas')
        .select('escuela_cct, rol, activo, escuelas(id,cct,nombre,nivel,municipio,estado,zona_escolar,turno,ciclo_actual)')
        .eq('usuario_id', currentPerfil.id)
        .eq('activo', true);

      if (escuelasDB?.length) {
        USUARIO_ESCUELAS = escuelasDB.map(r => ({
          ...r.escuelas,
          rol: r.rol,
          grupos: [],
        })).filter(e => e.cct);
        const escuelaPreseleccionada = String(window._escuelaCfg?.cct || '').trim();
        ESCUELA_ACTIVA = USUARIO_ESCUELAS.find(e => e.cct === escuelaPreseleccionada) || USUARIO_ESCUELAS[0];
        // ── CRÍTICO: sincronizar nivel con la escuela real ──────────
        if (ESCUELA_ACTIVA?.nivel) {
          const nivelEsc = ESCUELA_ACTIVA.nivel === 'primaria_y_secundaria'
            ? (ESCUELA_ACTIVA.nivel_default || 'secundaria')
            : ESCUELA_ACTIVA.nivel;
          window._nivelActivo = nivelEsc;
          try { localStorage.setItem('siembra_nivel', nivelEsc); } catch(e) {}
        }
        // ── Respetar nivel asignado al docente por el admin ──────────
        // usuarios.nivel puede ser 'primaria', 'secundaria', 'ambos' o null
        _aplicarNivelDocente(ESCUELA_ACTIVA);
        const nomEl = document.getElementById('doc-escuela-nombre');
        if (nomEl) nomEl.textContent = ESCUELA_ACTIVA.nombre || ESCUELA_ACTIVA.cct;
        // Show/hide multi-school switcher
        const switcher = document.getElementById('doc-escuela-switcher');
        if (switcher) switcher.title = USUARIO_ESCUELAS.length > 1
          ? `${USUARIO_ESCUELAS.length} escuelas — clic para cambiar`
          : ESCUELA_ACTIVA.nombre;
        cambiarNivel(window._nivelActivo || 'secundaria');
      } else if (currentPerfil?.escuela_cct) {
        // Fallback: sin usuario_escuelas → buscar escuela por CCT del perfil
        try {
          const { data: escFallback } = await sb.from('escuelas')
            .select('id, cct, nombre, nivel, nivel_default, turno')
            .eq('cct', currentPerfil.escuela_cct).maybeSingle();
          if (escFallback) {
            ESCUELA_ACTIVA = escFallback;
            USUARIO_ESCUELAS = [escFallback];
            const nivelEsc = escFallback.nivel === 'primaria_y_secundaria'
              ? (escFallback.nivel_default || 'secundaria')
              : escFallback.nivel;
            window._nivelActivo = nivelEsc;
            try { localStorage.setItem('siembra_nivel', nivelEsc); } catch(e) {}
            _aplicarNivelDocente(escFallback);
            const nomEl = document.getElementById('doc-escuela-nombre');
            if (nomEl) nomEl.textContent = escFallback.nombre || escFallback.cct;
            cambiarNivel(window._nivelActivo || 'secundaria');
          }
        } catch(e2) { console.warn('[initApp] escuela fallback:', e2.message); }
      }

      // Actualizar banner de bienvenida
      const hora = new Date().getHours();
      const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
      const nombreDoc = `${currentPerfil.nombre||''} ${currentPerfil.apellido_p||currentPerfil.apellido||''}`.trim();
      // Actualizar sidebar con nombre real (aunque no tenga grupos)
      const _snEl = document.querySelector('#doc-portal .user-name');
      const _saEl = document.getElementById('sidebar-doc-avatar');
      if (_snEl && nombreDoc) _snEl.textContent = nombreDoc;
      if (_saEl && nombreDoc) _saEl.textContent = nombreDoc.split(' ').map(p=>p[0]||'').join('').toUpperCase().slice(0,2);
      const bienEl = document.getElementById('dash-bienvenida');
      const escInfo = document.getElementById('dash-escuela-info');
      if (bienEl) bienEl.textContent = `${saludo}, ${nombreDoc || 'Docente'} 👋`;
      if (escInfo && ESCUELA_ACTIVA) {
        const nivelDash = window._nivelActivo || ESCUELA_ACTIVA.nivel || 'secundaria';
        escInfo.textContent = [ESCUELA_ACTIVA.nombre || '', nivelDash, ESCUELA_ACTIVA.turno || ''].filter(Boolean).join(' · ');
      }

      // 1. Grupos asignados al docente
      const gruposDB = await cargarGruposDocente();

      if (gruposDB.length) {
        window._gruposDocente = gruposDB;
        window._grupoActivo   = gruposDB[0].id;
        const g = gruposDB[0];

        // Sincronizar nivel con el grupo real — SIEMPRE usar el nivel del grupo
        if (g.nivel) {
          window._nivelActivo = g.nivel;
          window._gradoActivo = String(g.grado||'1').replace(/[°\s]/g,'').trim();
          try { localStorage.setItem('siembra_nivel', g.nivel); } catch(e) {}
          // Forzar cambio visual inmediato
          setTimeout(() => cambiarNivel(g.nivel), 100);
        }

        // 2. Actualizar nombre del docente y grupo en topbar
        const nombreDocente = `${currentPerfil.nombre||''} ${currentPerfil.apellido_p||currentPerfil.apellido||''}`.trim();
        const nameEl = document.querySelector('#doc-portal .user-name');
        const roleEl = document.querySelector('#doc-portal .user-role');
        const avatarEl = document.getElementById('sidebar-doc-avatar');
        const nomGrupo = typeof resolverNombreGrupo==='function' ? resolverNombreGrupo(g) : (g.nombre||`${g.grado}°A`);
        if (nameEl) nameEl.textContent = nombreDocente || 'Docente';
        if (roleEl) roleEl.textContent = `Docente · ${nomGrupo}`;
        if (avatarEl) avatarEl.textContent = (nombreDocente||'D').split(' ').map(p=>p[0]||'').join('').toUpperCase().slice(0,2);
        if (escInfo) escInfo.textContent = [ESCUELA_ACTIVA?.nombre || currentPerfil?.escuela_nombre || '', g.nivel || window._nivelActivo || 'secundaria', g.turno || ESCUELA_ACTIVA?.turno || ''].filter(Boolean).join(' · ');

        // 3. Actualizar título en módulo calificaciones
        const calTit = document.getElementById('cal-titulo-h2');
        if (calTit) calTit.textContent = `Calificaciones · ${nomGrupo}`;

        // 4. Cargar alumnos del primer grupo
        const alumnosDB = await calCargarAlumnosGrupo(g.id);
        window._alumnosActivos = alumnosDB;
        window._alumnosActivosGrupoId = g.id;
        if (!window._alumnosPorGrupo) window._alumnosPorGrupo = {};
        window._alumnosPorGrupo[g.id] = alumnosDB;
        alumnos.length = 0;
        alumnosDB.forEach(a => alumnos.push(a));

        // FIX 3: Sincronizar docAlumnos (módulo etiquetas) con alumnos reales desde inicio
        const _COLORES = ['#0d5c2f','#2563eb','#7c3aed','#dc2626','#0891b2','#c2410c','#065f46','#1d4ed8','#166534','#b91c1c'];
        docAlumnos.length = 0;
        alumnosDB.forEach((a, i) => {
          const partes = (a.n || '').split(' ');
          docAlumnos.push({
            id: a.id,
            nombre: partes[0] || 'Alumno',
            apellido: partes.slice(1).join(' ') || '',
            etiquetas: [],
            color: _COLORES[i % _COLORES.length]
          });
        });

        // FIX 2: Sincronizar salonActivoDoc con grupo real activo
        salonActivoDoc = {
          id: g.id,
          nombre: g.nombre || (g.grado + '°'),
          escuela: g.escuela_nombre || g.escuela_cct || ''
        };

        // 5. Materias del docente — SOLO del grupo activo actual
        try {
          const grupoActivoId = window._grupoActivo || gruposDB[0]?.id;
          const { data: asignaciones } = await sb.from('docente_grupos')
            .select('materia, campo_formativo, grupo_id, grupos(id,nombre,grado,seccion,nivel)')
            .eq('docente_id', currentPerfil.id)
            .eq('activo', true);

          if (asignaciones?.length) {
            // Filtrar asignaciones del grupo activo primero
            const asigGrupoActivo = grupoActivoId
              ? asignaciones.filter(a => a.grupo_id === grupoActivoId)
              : asignaciones;

            // Materias del grupo activo; si no hay asignaciones específicas, usar todas
            const mats = asigGrupoActivo.length
              ? [...new Set(asigGrupoActivo.map(r => r.materia).filter(Boolean))]
              : [...new Set(asignaciones.map(r => r.materia).filter(Boolean))];

            // Si aún no hay materias, usar fallback por grado
            if (!mats.length) {
              const g = gruposDB[0];
              const gr = String(g?.grado||'1').replace(/[°\s]/g,'').trim();
              const nivelG = g?.nivel || 'secundaria';
              window._materiasDocente = nivelG === 'secundaria'
                ? (window.MATERIAS_SECUNDARIA_POR_GRADO?.[gr] || window.MATERIAS_SECUNDARIA_POR_GRADO?.['1'] || [])
                : getMateriasByNivel('primaria');
            } else {
              window._materiasDocente   = mats;
            }
            window._materiasFiltered  = window._materiasDocente;
            window._docenteAsignaciones = asignaciones;
            window._docenteAsignaciones = asignaciones; // guardar para filtros por grupo

            const matEl = document.getElementById('doc-materias-label');
            if (matEl) matEl.textContent = mats.join(' · ') || 'Sin materias asignadas';

            // Actualizar selectores de materia en el portal del docente
            // para que SOLO aparezcan las materias asignadas
            document.querySelectorAll('.doc-materia-select, #cal-mat-sel, #asist-mat-sel').forEach(sel => {
              const val = sel.value;
              sel.innerHTML = '<option value="">Seleccionar materia…</option>' +
                mats.map(m => `<option value="${m}">${m}</option>`).join('');
              if (mats.includes(val)) sel.value = val;
              else if (mats.length === 1) sel.value = mats[0];
            });

            console.log('[Docente] Materias asignadas:', mats.length, '→', mats.join(', '));
          } else if (!window._materiasDocente?.length) {
            // Sin asignaciones en docente_grupos — usar materias del grado del grupo activo
            // Solo si _materiasDocente no fue ya cargada por calInit u otro proceso
            const grupoAct = (window._gruposDocente||[]).find(g=>g.id===window._grupoActivo) || window._gruposDocente?.[0];
            const grado = grupoAct?.grado || '1';
            const nivelAct = grupoAct?.nivel || window._nivelActivo || currentPerfil.nivel || 'secundaria';

            let fallbackMats = [];
            if (nivelAct === 'secundaria' && MATERIAS_SECUNDARIA_POR_GRADO) {
              const gr = String(grado).replace(/[°\s]/g,'').trim();
              fallbackMats = MATERIAS_SECUNDARIA_POR_GRADO[gr] || MATERIAS_SECUNDARIA_POR_GRADO['1'];
            } else {
              fallbackMats = getMateriasByNivel(nivelAct);
            }

            // Si es tutor, añadir Tutoría si no está
            if (currentPerfil.rol === 'tutor' && !fallbackMats.includes('Tutoría')) {
              fallbackMats = ['Tutoría', ...fallbackMats];
            }

            window._materiasDocente  = fallbackMats;
            window._materiasFiltered = fallbackMats;

            const matEl = document.getElementById('doc-materias-label');
            if (matEl) {
              matEl.textContent = fallbackMats.join(' · ');
              matEl.style.color = '';
            }

            // Actualizar selectores
            document.querySelectorAll('.doc-materia-select, #cal-mat-sel, #asist-mat-sel').forEach(sel => {
              sel.innerHTML = '<option value="">Seleccionar materia…</option>' +
                fallbackMats.map(m => `<option value="${m}">${m}</option>`).join('');
              if (fallbackMats.length === 1) sel.value = fallbackMats[0];
            });

            console.warn('[Docente] Sin asignaciones en docente_grupos — usando materias del grado', grado, ':', fallbackMats.join(', '));
            console.warn('[Docente] Solicita al administrador que asigne materias en docente_grupos para datos precisos.');
          }
        } catch(eMats) {
          console.warn('[Docente] cargarMaterias:', eMats.message);
          // Fallback: usar materias que ya venían en gruposDB
          const fromGrupos = [...new Set(gruposDB.flatMap(g=>g.materias||[]).filter(Boolean))];
          window._materiasDocente  = fromGrupos;
          window._materiasFiltered = fromGrupos;
        }

        // ── Refrescar UI con materias correctas ya cargadas ──────────────
        // Necesario porque cambiarNivel() a 100ms renderiza antes de que
        // las materias de docente_grupos estén disponibles
        if (typeof calRenderMatTabs === 'function') calRenderMatTabs();
        if (typeof obsPoblarSelects  === 'function') obsPoblarSelects();

        // 6. Construir selector de grupos si hay más de uno
        if (gruposDB.length > 1) {
          _docRenderSelectorGrupos(gruposDB);
        }

        // 7. Suscribir a Realtime
        if (typeof realtimeSuscribirCalificaciones === 'function')
          realtimeSuscribirCalificaciones(g.id);
        if (typeof realtimeSuscribirAsistencia === 'function')
          realtimeSuscribirAsistencia(g.id);

        // 8. Asistencia de hoy
        await asCargarHoy(g.id);

        // 9. Horario desde DB
        if (typeof horarioCargarDB === 'function') horarioCargarDB();
      } else {
        window._grupoActivo = null;
        window._alumnosActivos = [];
        window._gruposDocente = [];
        alumnos.length = 0;
        docAlumnos.length = 0;
        window._materiasDocente = [];
        window._materiasFiltered = [];
        salonActivoDoc = null;
      }
    } catch(e) {
      console.warn('[initApp]', e.message);
    }
  }

  // ── Render todos los módulos ──────────────────────────────────────
  dRenderDash();
  if (typeof renderAlertas === 'function') renderAlertas();
  calInit();
  fichaInit();
  renderAsistencia();
  renderHorario();
  renderPlaneaciones();
  // Inicializar nueva sección Obs+XP+AlertaTS
  setTimeout(() => {
    obsPoblarSelects();
    ctPoblarSelectorTareas();
  }, 300);
  // FIX 1: renderBoleta no existe — se usa bltInit() que sí está definido
  if (typeof bltInit === 'function') bltInit();
  renderMensajes();
  renderCalendario();
  cargarNoticiasDB();
  if (typeof tutoriaInit === 'function') tutoriaInit();
  if (typeof docenteCargarAvisos === 'function') docenteCargarAvisos();
  // Cargar alertas del subdirector/dirección en el dashboard del docente
  if (typeof window._cargarAlertasRol === 'function') {
    window._cargarAlertasRol('docente').then(alertas => {
      if (typeof window._renderAlertasBanner === 'function')
        window._renderAlertasBanner('dash-alertas-plantel', alertas);
    }).catch(()=>{});
  }
  setTimeout(() => {
    renderChartAsistencia(window._grupoActivo);
    renderChartRendimiento(window._alumnosActivos || alumnos);
  }, 500);
}

// Selector de grupos para docentes con múltiples grupos
function _docRenderSelectorGrupos(gruposDB) {
  // Buscar o crear el selector en el topbar del portal docente
  let sel = document.getElementById('doc-grupo-selector');
  if (!sel) {
    const nav = document.querySelector('#doc-portal .user-role');
    if (!nav) return;
    const wrap = nav.parentElement;
    const div = document.createElement('div');
    div.style.cssText = 'margin-top:4px;';
    div.innerHTML = `<select id="doc-grupo-selector" onchange="docCambiarGrupo(this.value)"
      style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);border-radius:6px;
             color:white;font-family:'Sora',sans-serif;font-size:11px;padding:3px 8px;cursor:pointer;
             outline:none;width:100%;">
      ${gruposDB.map(g => `<option value="${g.id}" style="color:#333;">${g.nombre}</option>`).join('')}
    </select>`;
    wrap.appendChild(div);
    sel = document.getElementById('doc-grupo-selector');
  } else {
    sel.innerHTML = gruposDB.map(g =>
      `<option value="${g.id}" style="color:#333;">${g.nombre}</option>`
    ).join('');
  }
}

async function docCambiarGrupo(grupoId) {
  if (!grupoId || !sb) return;
  window._grupoActivo = grupoId;
  const g = window._gruposDocente?.find(x => x.id === grupoId);

  // Sincronizar nivel con el grupo seleccionado (para docentes con nivel "ambos")
  if (g?.nivel && (currentPerfil?.nivel === 'ambos' || !currentPerfil?.nivel)) {
    window._nivelActivo = g.nivel;
    try { localStorage.setItem('siembra_nivel', g.nivel); } catch(e) {}
  }

  // Actualizar UI — usar resolverNombreGrupo para evitar "undefined"
  const _nomG = g ? (typeof resolverNombreGrupo === 'function' ? resolverNombreGrupo(g) : (g.nombre || g.grado + '°')) : grupoId;
  const roleEl = document.querySelector('#doc-portal .user-role');
  if (roleEl && g) roleEl.textContent = `Docente · ${_nomG}`;
  const escInfo = document.getElementById('dash-escuela-info');
  if (escInfo && g) escInfo.textContent = [ESCUELA_ACTIVA?.nombre || currentPerfil?.escuela_nombre || '', g.nivel || window._nivelActivo || 'secundaria', g.turno || ESCUELA_ACTIVA?.turno || ''].filter(Boolean).join(' · ');
  const calTit = document.getElementById('cal-titulo-h2');
  if (calTit && g) calTit.textContent = `Calificaciones · ${_nomG}`;
  const topTitle = document.getElementById('page-title');
  if (topTitle && topTitle.textContent.includes('Calificaciones')) topTitle.textContent = `Calificaciones · ${_nomG}`;

  // Recargar alumnos — SIEMPRE limpiar antes de asignar (grupo vacío también)
  const alumnosDB = await calCargarAlumnosGrupo(grupoId);
  window._alumnosActivos = alumnosDB;
  window._alumnosActivosGrupoId = grupoId;
  if (!window._alumnosPorGrupo) window._alumnosPorGrupo = {};
  window._alumnosPorGrupo[grupoId] = alumnosDB;
  alumnos.length = 0;
  alumnosDB.forEach(a => alumnos.push(a));

  // FIX 2: Sincronizar salonActivoDoc con el grupo activo real
  if (g) {
    salonActivoDoc = {
      id: g.id,
      nombre: g.nombre || (g.grado + '°'),
      escuela: g.escuela_nombre || g.escuela_cct || ''
    };
  }

  // FIX 3: Actualizar docAlumnos para el módulo de etiquetas — SIEMPRE limpiar
  docAlumnos.length = 0;
  if (alumnosDB.length) {
    const COLORES = ['#0d5c2f','#2563eb','#7c3aed','#dc2626','#0891b2','#c2410c','#065f46','#1d4ed8','#166534','#b91c1c'];
    docAlumnos.length = 0;
    alumnosDB.forEach((a, i) => {
      const partes = (a.n || '').split(' ');
      docAlumnos.push({
        id: a.id,
        nombre: partes[0] || 'Alumno',
        apellido: partes.slice(1).join(' ') || '',
        etiquetas: [],
        color: COLORES[i % COLORES.length]
      });
    });
  }

  // FIX 1: Actualizar materias del nuevo grupo activo
  try {
    const { data: asigNuevo } = await sb.from('docente_grupos')
      .select('materia, campo_formativo, grupo_id')
      .eq('docente_id', currentPerfil.id)
      .eq('grupo_id', grupoId)
      .eq('activo', true);

    if (asigNuevo?.length) {
      const mats = [...new Set(asigNuevo.map(r => r.materia).filter(Boolean))];
      if (mats.length) {
        window._materiasDocente = mats;
        window._materiasFiltered = mats;
        // Actualizar label de materias en sidebar
        const matEl = document.getElementById('doc-materias-label');
        if (matEl) matEl.textContent = mats.join(' · ');
        // Resetear materia activa si ya no está en el nuevo grupo
        if (!mats.includes(calMatActual)) calMatActual = mats[0];
        // Re-renderizar tabs de materias en calificaciones
        if (typeof calRenderMatTabs === 'function') calRenderMatTabs();
        if (typeof calRenderTabla === 'function') calRenderTabla();
        if (typeof calRenderStats === 'function') calRenderStats();
      } else {
        // Sin materias en docente_grupos — usar fallback por nivel/grado
        if (g?.nivel) {
          const gr = String(g.grado||'1').replace(/[°\s]/g,'').trim();
          const fallback = g.nivel === 'secundaria'
            ? (window.MATERIAS_SECUNDARIA_POR_GRADO?.[gr] || window.MATERIAS_SECUNDARIA_POR_GRADO?.['1'] || [])
            : (typeof getMateriasByNivel === 'function' ? getMateriasByNivel('primaria') : []);
          window._materiasDocente = fallback;
          window._materiasFiltered = fallback;
          if (typeof calRenderMatTabs === 'function') calRenderMatTabs();
        }
      }
    } else if (g?.nivel) {
      // Sin asignaciones — fallback por nivel/grado del grupo seleccionado
      const gr = String(g.grado||'1').replace(/[°\s]/g,'').trim();
      const fallback = g.nivel === 'secundaria'
        ? (window.MATERIAS_SECUNDARIA_POR_GRADO?.[gr] || window.MATERIAS_SECUNDARIA_POR_GRADO?.['1'] || [])
        : (typeof getMateriasByNivel === 'function' ? getMateriasByNivel('primaria') : []);
      window._materiasDocente = fallback;
      window._materiasFiltered = fallback;
      if (typeof calRenderMatTabs === 'function') calRenderMatTabs();
    }
  } catch(e) { console.warn('[docCambiarGrupo] materias:', e.message); }

  // Refrescar módulos clave
  if (typeof obsPoblarSelects === 'function') obsPoblarSelects();
  calInit();
  renderAsistencia();
  dRenderDash();
  if (document.getElementById('p-examenes')?.classList.contains('active') && typeof examenesInit === 'function') {
    examenesInit();
  }
  if (typeof ctSeleccionarGrupo === 'function') ctSeleccionarGrupo(grupoId);
  if (typeof planPoblarSelectorGruposDocente === 'function') planPoblarSelectorGruposDocente();
  if (typeof planSeleccionarGrupoDocente === 'function') planSeleccionarGrupoDocente(grupoId, { silent: true });
  await asCargarHoy(grupoId);
  hubToast(`✅ Grupo cambiado a ${g?.nombre||grupoId}`, 'ok');
}

async function docIrAGrupo(page, grupoId, extraAction) {
  await docCambiarGrupo(grupoId);
  if (typeof extraAction === 'function') {
    try { extraAction(); } catch(e) {}
  }
  dNav(page);
}

async function asCargarHoy(grupoId) {
  if (!sb) return;
  const hoy = new Date().toISOString().split('T')[0];
  const { data } = await sb.from('asistencia')
    .select('*')
    .eq('grupo_id', grupoId)
    .eq('fecha', hoy);
  if (!data) return;
  // Actualizar estado de asistencia en el array alumnos
  const alumnosList = window._alumnosActivos || alumnos;
  alumnosList.forEach((a, i) => {
    const reg = data.find(r => r.alumno_id === a.id);
    if (reg) a.as = reg.estado;
    else a.as = 'P'; // default presente
  });
}

async function cargarNoticiasDB() {
  if (!sb) return;
  try {
    const { data } = await sb.from('noticias')
      .select('*')
      .eq('activo', true)
      .order('creado_en', { ascending: false })
      .limit(5);
    if (data) window._noticiasDB = data;
  } catch(e) {}
}

function asActualizarStats() {
  const alumnosList = window._alumnosActivos || alumnos;
  let p=0, a=0, t=0;
  alumnosList.forEach(al => {
    if(al.as==='P') p++;
    else if(al.as==='A') a++;
    else if(al.as==='T') t++;
  });
  const total = alumnosList.length;
  const pct = total ? Math.round((p+t)*100/total) : 0;
  const ep = document.getElementById('as-pres'); if(ep) ep.textContent = p;
  const ea = document.getElementById('as-aus');  if(ea) ea.textContent = a;
  const et = document.getElementById('as-tard'); if(et) et.textContent = t;
  const pct_el = document.getElementById('as-pct'); if(pct_el) pct_el.textContent = pct+'%';
}
function dInit() { initApp(); } // alias para portal docente

// Estado vacío para el dashboard cuando no hay alumnos
function _mostrarDashboardVacio() {
  const ids = ['dash-stat-alumnos','dash-stat-asist','dash-stat-riesgo','dash-stat-calP'];
  ids.forEach(id => { const el = document.getElementById(id); if(el) el.textContent = '—'; });
  const semEl = document.getElementById('semaforo-wrap') || document.getElementById('dash-semaforo');
  if(semEl) semEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--gris-50);">
    <div style="font-size:32px;margin-bottom:10px;">🏫</div>
    <div style="font-size:14px;font-weight:700;color:var(--gris-80);margin-bottom:6px;">Bienvenido a SIEMBRA</div>
    <div style="font-size:13px;line-height:1.6;">Tu grupo aún no tiene alumnos registrados.<br>El director dará de alta los grupos y alumnos.</div>
  </div>`;
}

// DASHBOARD
function dRenderDash() {
  const lista = window._alumnosActivos || alumnos;

  // ── Estado vacío ──────────────────────────────────────────────────────
  if (!lista.length) {
    const semEl = document.getElementById('semaforo-list');
    if (semEl) semEl.innerHTML = `<div style="padding:24px 0;color:var(--gris-50);font-size:13px;text-align:center;">
      <div style="font-size:28px;margin-bottom:8px;">🏫</div>
      <div style="font-weight:700;color:var(--gris-80);margin-bottom:4px;">Bienvenido/a a SIEMBRA</div>
      <div>Tu grupo aún no tiene alumnos registrados.</div>
    </div>`;
    ['barras-materias','top-alumnos','eventos-proximos'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div style="padding:20px;color:var(--gris-50);font-size:12px;text-align:center;">Sin datos</div>';
    });
    ['radar-verde','radar-amarillo','radar-rojo'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '0';
    });
    return;
  }

  const promAlumno = (ai) => {
    if (typeof calPromPonderado === 'function' && CAL_DATA && Object.keys(CAL_DATA).length) {
      const proms = MATERIAS_NEM.map(m => calPromPonderado(ai, m, calTrimActual||1));
      return proms.reduce((s,p)=>s+p,0)/proms.length;
    }
    return lista[ai]?.cals?.reduce((s,c)=>s+c,0)/(lista[ai]?.cals?.length||1) || 7;
  };

  const conPromedios = lista.map((a,ai) => ({...a, promedio: promAlumno(ai)}));
  const _minR = _calCfg().minimo_aprobatorio;
  const enRiesgo     = conPromedios.filter(a => a.promedio < _minR);
  const enSeguim     = conPromedios.filter(a => a.promedio >= _minR && a.promedio < _minR + 1.5);
  const bien         = conPromedios.filter(a => a.promedio >= _minR + 1.5);

  // ── Radar semáforo ──
  const sv = document.getElementById('radar-verde');    if (sv) sv.textContent = bien.length;
  const sa = document.getElementById('radar-amarillo'); if (sa) sa.textContent = enSeguim.length;
  const sr = document.getElementById('radar-rojo');     if (sr) sr.textContent = enRiesgo.length;

  // ── Stats header ──
  const s = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  s('dash-stat-alumnos', lista.length);
  s('dash-stat-riesgo',  enRiesgo.length);
  const promsAll = conPromedios.map(a=>a.promedio).filter(p=>p>0);
  s('dash-stat-calP', promsAll.length ? (promsAll.reduce((a,b)=>a+b,0)/promsAll.length).toFixed(1) : '—');

  // ── Academic Health Score del grupo en background ──
  if (window._grupoActivo) {
    ahsCargarGrupo(window._grupoActivo).then(cache => {
      if (!cache) return;
      const scores = Object.values(cache).filter(v => v > 0);
      if (!scores.length) return;
      const ahsGrupo = Math.round(scores.reduce((a,b) => a+b, 0) / scores.length);
      const cfg = ahsConfig(ahsGrupo);
      const ahsEl = document.getElementById('dash-stat-asist');
      if (ahsEl) {
        ahsEl.textContent = ahsGrupo;
        ahsEl.style.color = cfg.color.replace('#','');
      }
      // Actualizar lista semáforo con AHS
      const sl2 = document.getElementById('semaforo-list');
      if (sl2) {
        const alumsConScore = lista.map(a => ({
          ...a, ahs: cache[a.id] || cache[a.n] || calcAHS({ promedio: a.promedio || 0 })
        })).sort((a,b) => a.ahs - b.ahs);
        const enRiesgoAHS = alumsConScore.filter(a => a.ahs < 50);
        const enSeguimAHS = alumsConScore.filter(a => a.ahs >= 50 && a.ahs < 65);
        document.getElementById('radar-rojo').textContent = enRiesgoAHS.length;
        document.getElementById('radar-amarillo').textContent = enSeguimAHS.length;
        document.getElementById('radar-verde').textContent = alumsConScore.filter(a => a.ahs >= 65).length;
        const mostrar = alumsConScore.slice(0, 5);
        sl2.innerHTML = mostrar.length
          ? mostrar.map(a => {
              const cfg2 = ahsConfig(a.ahs);
              return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f1f5f9;">
                <span style="font-size:14px;">${cfg2.emoji}</span>
                <div style="flex:1;">
                  <div style="font-size:13px;font-weight:600;color:#0f172a;">${a.n || a.nombre || '—'}</div>
                  <div style="font-size:11px;color:#64748b;">AHS: ${a.ahs}/100 · ${cfg2.label}</div>
                </div>
                <div style="height:6px;width:70px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
                  <div style="height:100%;width:${a.ahs}%;background:${cfg2.color};border-radius:99px;"></div>
                </div>
                <button onclick="dNav('calificaciones')" style="padding:4px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:10px;font-weight:700;color:#475569;cursor:pointer;font-family:'Sora',sans-serif;">Ver →</button>
              </div>`;
            }).join('')
          : '<div style="font-size:13px;color:#15803d;padding:12px 0;text-align:center;">🎉 ¡Todos los alumnos en buen nivel!</div>';
      }
    }).catch(() => {});
  }

  // ── Alerta dinámica (legacy) ──
  const alertaEl = document.getElementById('dash-alerta-riesgo');
  if (alertaEl) alertaEl.style.display = 'none';

  // ── Lista compacta de riesgo en radar ──
  const sl = document.getElementById('semaforo-list');
  if (sl) {
    const mostrar = [...enRiesgo, ...enSeguim].slice(0,5);
    sl.innerHTML = mostrar.length
      ? mostrar.map(a => {
          const p = a.promedio.toFixed(1);
          const esRiesgo = a.promedio < 6;
          return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f1f5f9;">
            <span style="font-size:14px;">${esRiesgo ? '🔴' : '🟡'}</span>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:600;color:#0f172a;">${a.n || a.nombre || '—'}</div>
              <div style="font-size:11px;color:#64748b;">Promedio: ${p}</div>
            </div>
            <div style="height:6px;width:70px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
              <div style="height:100%;width:${p*10}%;background:${esRiesgo?'#ef4444':'#eab308'};border-radius:99px;"></div>
            </div>
            <button onclick="dNav('calificaciones')" style="padding:4px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:10px;font-weight:700;color:#475569;cursor:pointer;font-family:'Sora',sans-serif;">Ver →</button>
          </div>`;
        }).join('') +
        (enRiesgo.length + enSeguim.length > 5
          ? `<div style="font-size:11px;color:#64748b;text-align:center;padding:8px;">+${enRiesgo.length+enSeguim.length-5} más con atención</div>`
          : '')
      : '<div style="font-size:13px;color:#15803d;padding:12px 0;text-align:center;">🎉 ¡Todos los alumnos en buen nivel!</div>';
  }

  // ── Barras materias ──
  const bm = document.getElementById('barras-materias');
  if (bm) {
    const promediosPorMateria = (window._materiasDocente?.length ? window._materiasDocente : Array.from(MATERIAS_NEM)).map(m => {
      const avg = lista.length ? lista.reduce((s,_,ai) =>
        s + (typeof calPromPonderado==='function' && CAL_DATA?.[m] ? calPromPonderado(ai,m,calTrimActual||1) : 7), 0) / lista.length : 7;
      return {m: m.split(' ')[0], avg};
    });
    bm.innerHTML = promediosPorMateria.map(({m,avg})=>`
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:50px;font-size:11px;color:#64748b;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m}</div>
        <div style="flex:1;height:8px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
          <div style="height:100%;width:${avg*10}%;background:${avg>=8?'#22c55e':avg>=6?'#eab308':'#ef4444'};border-radius:99px;transition:.5s;"></div>
        </div>
        <div style="width:32px;font-size:12px;font-weight:700;color:${avg>=8?'#15803d':avg>=6?'#b45309':'#b91c1c'};">${avg.toFixed(1)}</div>
      </div>
    `).join('');
  }

  // ── Top alumnos ──
  const top = [...conPromedios].sort((a,b)=>b.promedio-a.promedio).slice(0,5);
  const topEl = document.getElementById('top-alumnos');
  if (topEl) topEl.innerHTML = top.map((a,i)=>`
    <div style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9;">
      <div style="width:26px;height:26px;border-radius:50%;background:${i===0?'#f59e0b':i===1?'#9ca3af':i===2?'#b45309':'#f1f5f9'};color:${i<3?'white':'#64748b'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;margin-right:12px;flex-shrink:0;">${i+1}</div>
      <div style="flex:1;font-size:13px;font-weight:600;">${a.n || a.nombre || '—'}</div>
      <div style="font-size:15px;font-weight:800;color:#15803d;">${a.promedio.toFixed(1)}</div>
    </div>
  `).join('');

  // ── Eventos/Anuncios — cargar desde Supabase ──
  dashCargarAnuncios();

  // ── Pendientes del docente + Banner de evidencias ──
  dashCargarPendientes();
  dashCargarEvidenciasPendientes();
}

function dashRefrescarPendientes() { dashCargarPendientes(); dashCargarEvidenciasPendientes(); dashCargarAnuncios(); }

async function dashCargarAnuncios() {
  const evEl = document.getElementById('eventos-proximos');
  if (!evEl) return;
  // Tipo badge colors
  const TIPO_CFG = {
    evento:  { bg:'#f0fdf4', color:'#15803d', label:'EVENTO' },
    urgente: { bg:'#fef2f2', color:'#b91c1c', label:'URGENTE' },
    info:    { bg:'#eff6ff', color:'#1d4ed8', label:'AVISO' },
    recordatorio: { bg:'#fef9c3', color:'#a16207', label:'RECUERDO' },
  };
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  let items = [];
  if (sb && currentPerfil) {
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const { data } = await sb.from('anuncios')
        .select('id,titulo,descripcion,tipo,fecha_evento,dirigido_a,creado_en,rol_autor')
        .eq('escuela_id', currentPerfil.escuela_id || currentPerfil.escuela_cct)
        .eq('activo', true)
        .or(`fecha_evento.gte.${hoy},fecha_evento.is.null`)
        .order('fecha_evento', { ascending: true, nullsFirst: false })
        .limit(5);
      items = data || [];
    } catch(_) {}
  }
  // Fallback a demo si no hay datos reales
  if (!items.length) {
    const hoyD = new Date();
    items = eventos.slice(0,4).map((e,i) => ({
      titulo: e.texto, tipo: e.tipo === 'rojo' ? 'urgente' : e.tipo === 'amarillo' ? 'recordatorio' : 'evento',
      fecha_evento: new Date(hoyD.getFullYear(), hoyD.getMonth(), hoyD.getDate() + e.dia).toISOString().split('T')[0],
      _demo: true
    }));
  }
  evEl.innerHTML = items.map(e => {
    const cfg = TIPO_CFG[e.tipo] || TIPO_CFG.info;
    const fecha = e.fecha_evento ? new Date(e.fecha_evento + 'T12:00:00') : null;
    const diaNum = fecha ? fecha.getDate() : '—';
    const mesStr = fecha ? MESES[fecha.getMonth()] : '';
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;cursor:default;">
      <div style="min-width:38px;text-align:center;background:${cfg.bg};border-radius:9px;padding:5px 4px;flex-shrink:0;">
        <div style="font-size:18px;font-weight:900;color:${cfg.color};line-height:1;">${diaNum}</div>
        <div style="font-size:9px;font-weight:700;color:${cfg.color};text-transform:uppercase;letter-spacing:.5px;">${mesStr}</div>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.titulo}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:1px;">${e.rol_autor?e.rol_autor:''}${e.descripcion?` · ${e.descripcion}`:''}</div>
      </div>
      <span style="font-size:9px;font-weight:700;background:${cfg.bg};color:${cfg.color};padding:2px 7px;border-radius:99px;white-space:nowrap;">${cfg.label}</span>
    </div>`;
  }).join('') || '<div style="font-size:13px;color:#94a3b8;padding:20px 0;text-align:center;">Sin eventos próximos</div>';
}

async function dashCargarPendientes() {
  const el = document.getElementById('dash-pendientes-lista');
  if (!el) return;

  const items = [];

  // 1. Asistencia de hoy
  if (sb && window._grupoActivo) {
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const { count } = await sb.from('asistencia')
        .select('id', { count: 'exact', head: true })
        .eq('grupo_id', window._grupoActivo).eq('fecha', hoy);
      const totalAlumnos = (window._alumnosActivos || alumnos).length;
      if (!count || count < totalAlumnos) {
        items.push({ ico:'✅', texto: 'Registrar asistencia de hoy', sub: count ? `${count}/${totalAlumnos} registrados` : 'Sin registro aún', accion: "dNav('asistencia')", urgente: !count });
      }
    } catch(_) {}
  }

  // 2. Evidencias pendientes de revisar
  if (sb && currentPerfil) {
    try {
      const gids = (window._gruposDocente || []).map(g => g.id).filter(Boolean);
      let q = sb.from('evidencias').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente');
      if (gids.length) q = q.in('grupo_id', gids);
      const { count } = await q;
      if (count > 0) {
        items.push({ ico:'📸', texto: `${count} evidencia${count>1?'s':''} sin revisar`, sub: 'Familias esperan tu retroalimentación', accion: "EVD.abrirPanel()", urgente: count > 3 });
      }
    } catch(_) {}
  }

  // 3. Actividades sin calificación reciente (últimas 2 semanas)
  if (sb && currentPerfil && window._grupoActivo) {
    try {
      const hace2sem = new Date(Date.now() - 14*24*60*60*1000).toISOString();
      const { count } = await sb.from('tareas_docente')
        .select('id', { count: 'exact', head: true })
        .eq('grupo_id', window._grupoActivo)
        .eq('docente_id', currentPerfil.id)
        .gte('created_at', hace2sem);
      if (count > 0) {
        items.push({ ico:'🎯', texto: `${count} actividad${count>1?'es':''} esta quincena`, sub: 'Ver progreso en sección Actividades', accion: "dNav('tareas')", urgente: false });
      }
    } catch(_) {}
  }

  // 4. Observaciones: si no hay ninguna del trimestre actual
  if (sb && currentPerfil && window._grupoActivo) {
    try {
      const { count } = await sb.from('observaciones')
        .select('id', { count: 'exact', head: true })
        .eq('docente_id', currentPerfil.id)
        .eq('trimestre', calTrimActual || 1);
      if (!count) {
        items.push({ ico:'📝', texto: 'Sin observaciones este trimestre', sub: 'Registra observaciones formativas del grupo', accion: "dNav('observaciones')", urgente: false });
      }
    } catch(_) {}
  }

  if (!items.length) {
    el.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;color:#15803d;font-size:13px;font-weight:600;"><span style="font-size:22px;">🎉</span> ¡Todo al día! Sin pendientes urgentes.</div>`;
    return;
  }

  el.innerHTML = items.map(item => `
    <div onclick="${item.accion}" style="display:flex;align-items:center;gap:12px;padding:11px 14px;background:${item.urgente?'#fff7ed':'#f8fafc'};border:1.5px solid ${item.urgente?'#fed7aa':'#e2e8f0'};border-radius:10px;cursor:pointer;transition:.15s;" onmouseover="this.style.borderColor='#0d5c2f'" onmouseout="this.style.borderColor='${item.urgente?'#fed7aa':'#e2e8f0'}'">
      <span style="font-size:22px;flex-shrink:0;">${item.ico}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:#0f172a;">${item.texto}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">${item.sub}</div>
      </div>
      <span style="font-size:12px;color:#94a3b8;flex-shrink:0;">→</span>
    </div>`).join('');
}

async function dashCargarEvidenciasPendientes() {
  const banner = document.getElementById('dash-evidencias-banner');
  if (!banner || !sb || !currentPerfil) return;
  try {
    const grupoId = window._grupoActivo;
    let query = sb.from('evidencias').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente');
    if (grupoId) query = query.eq('grupo_id', grupoId);
    else {
      // Filtrar por grupos del docente
      const gids = (window._gruposDocente || []).map(g => g.id).filter(Boolean);
      if (gids.length) query = query.in('grupo_id', gids);
    }
    const { count } = await query;
    if (count > 0) {
      const txt = document.getElementById('dash-evd-texto');
      if (txt) txt.textContent = `${count} evidencia${count > 1 ? 's' : ''} pendiente${count > 1 ? 's' : ''} de revisar`;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  } catch(_) { banner.style.display = 'none'; }
}

function prom(a) { return a.cals?.reduce((s,c)=>s+c,0)/(a.cals?.length||1) || 0; }

// ══ ACADEMIC HEALTH SCORE (AHS) — 0 a 100 ══════════════════════════
// Componentes: Calificaciones 40% + Asistencia 30% + Tareas 20% + Tendencia 10%
function calcAHS(opts = {}) {
  const { promedio = 0, pctAsistencia = 100, pctTareas = 100, tendencia = 'estable' } = opts;
  const pCal   = Math.min(40, (promedio / 10) * 40);                  // 0-40
  const pAsist = Math.min(30, (pctAsistencia / 100) * 30);           // 0-30
  const pTarea = Math.min(20, (pctTareas / 100) * 20);               // 0-20
  const pTend  = tendencia === 'mejorando' ? 10 : tendencia === 'estable' ? 5 : 0; // 0-10
  return Math.round(pCal + pAsist + pTarea + pTend);
}

function ahsConfig(score) {
  if (score >= 80) return { color:'#15803d', bg:'#f0fdf4', border:'#86efac', emoji:'🟢', label:'Excelente' };
  if (score >= 65) return { color:'#b45309', bg:'#fffbeb', border:'#fde68a', emoji:'🟡', label:'Seguimiento' };
  if (score >= 50) return { color:'#c2410c', bg:'#fff7ed', border:'#fed7aa', emoji:'🟠', label:'Atención' };
  return             { color:'#b91c1c', bg:'#fef2f2', border:'#fecaca', emoji:'🔴', label:'Riesgo' };
}

function ahsBadge(score) {
  const cfg = ahsConfig(score);
  return `<span title="Academic Health Score: ${score}/100" style="display:inline-flex;align-items:center;gap:4px;background:${cfg.bg};border:1px solid ${cfg.border};border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700;color:${cfg.color};">${cfg.emoji} ${score}</span>`;
}

// Carga el AHS de todos los alumnos del grupo activo y lo guarda en window._ahsCache
async function ahsCargarGrupo(grupoId) {
  if (!sb || !grupoId) return;
  if (!window._ahsCache) window._ahsCache = {};
  const alums = window._alumnosActivos || alumnos;
  if (!alums.length) return;
  const haceUnMes = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];

  // Asistencia del último mes
  let asistMap = {};
  try {
    const { data: asist } = await sb.from('asistencia')
      .select('alumno_id, presente')
      .eq('grupo_id', grupoId)
      .gte('fecha', haceUnMes);
    (asist || []).forEach(r => {
      if (!asistMap[r.alumno_id]) asistMap[r.alumno_id] = { total: 0, presentes: 0 };
      asistMap[r.alumno_id].total++;
      if (r.presente) asistMap[r.alumno_id].presentes++;
    });
  } catch(_) {}

  // Tareas entregadas del último mes
  let tareasMap = {};
  try {
    const { data: entregas } = await sb.from('tareas_entregas')
      .select('alumno_id, estado, tarea_id')
      .in('alumno_id', alums.map(a => a.id).filter(Boolean));
    const totalTareas = new Set((entregas||[]).map(e => e.tarea_id)).size || 1;
    (entregas || []).forEach(r => {
      if (!tareasMap[r.alumno_id]) tareasMap[r.alumno_id] = { entregadas: 0, total: totalTareas };
      if (r.estado === 'entregada') tareasMap[r.alumno_id].entregadas++;
    });
  } catch(_) {}

  // Calificaciones (ya están en CAL_DATA o calculamos desde promedio)
  alums.forEach((a, ai) => {
    const id = a.id || a.n;
    // Promedio
    let prom = 0;
    if (typeof calPromPonderado === 'function' && CAL_DATA && Object.keys(CAL_DATA).length) {
      const mats = window._materiasDocente || MATERIAS_NEM || [];
      const vals = mats.map(m => calPromPonderado(ai, m, calTrimActual || 1)).filter(v => v > 0);
      prom = vals.length ? vals.reduce((s,v) => s+v, 0) / vals.length : 0;
    } else {
      prom = a.cals?.reduce((s,c) => s+c, 0) / (a.cals?.length || 1) || 0;
    }
    // Asistencia
    const asD = asistMap[id];
    const pctAsist = asD?.total ? Math.round((asD.presentes / asD.total) * 100) : 100;
    // Tareas
    const taD = tareasMap[id];
    const pctTareas = taD?.total ? Math.round((taD.entregadas / taD.total) * 100) : 100;
    // Tendencia (simple: si promedio < 6 → bajando, si > 8 → mejorando)
    const tend = prom >= 8 ? 'mejorando' : prom < 6 ? 'bajando' : 'estable';

    window._ahsCache[id] = calcAHS({ promedio: prom, pctAsistencia: pctAsist, pctTareas, tendencia: tend });
  });
  return window._ahsCache;
}

// ── Radar IA del grupo — análisis automático ──────────────────────
async function dashRadarIA() {
  const btn = document.getElementById('btn-radar-ia');
  const res = document.getElementById('radar-ia-resultado');
  const panel = document.getElementById('dash-ia-docente');
  const panelTxt = document.getElementById('dash-ia-docente-texto');
  if (!res || !btn) return;

  btn.disabled = true;
  btn.textContent = '⏳ Analizando…';
  res.style.display = 'block';
  res.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><span style="display:inline-block;width:14px;height:14px;border:2px solid #86efac;border-top-color:#0d5c2f;border-radius:50%;animation:spin .8s linear infinite;"></span> La IA está analizando tu grupo…</div>';

  const lista = window._alumnosActivos || alumnos;
  if (!lista.length) {
    res.innerHTML = '⚠️ Carga tu grupo primero para usar el análisis IA.';
    btn.disabled = false; btn.textContent = '✨ Análisis detallado';
    return;
  }

  const promAlumno = (ai) => {
    if (typeof calPromPonderado === 'function' && CAL_DATA && Object.keys(CAL_DATA).length) {
      const proms = MATERIAS_NEM.map(m => calPromPonderado(ai, m, calTrimActual||1));
      return proms.reduce((s,p)=>s+p,0)/proms.length;
    }
    return lista[ai]?.cals?.reduce((s,c)=>s+c,0)/(lista[ai]?.cals?.length||1) || 7;
  };

  const conPromedios = lista.map((a,ai) => ({...a, promedio: promAlumno(ai)}));
  const _minR2 = _calCfg().minimo_aprobatorio;
  const enRiesgo  = conPromedios.filter(a => a.promedio < _minR2);
  const enSeguim  = conPromedios.filter(a => a.promedio >= _minR2 && a.promedio < _minR2 + 1.5);
  const promGrupo = (conPromedios.reduce((s,a)=>s+a.promedio,0)/conPromedios.length).toFixed(1);

  const promediosMaterias = MATERIAS_NEM.map(m => {
    const avg = lista.length
      ? lista.reduce((s,_,ai) => s + (typeof calPromPonderado==='function' && CAL_DATA?.[m] ? calPromPonderado(ai,m,calTrimActual||1) : 7), 0) / lista.length
      : 7;
    return `${m.split(' ')[0]}: ${avg.toFixed(1)}`;
  }).join(', ');

  const prompt = `Soy docente de educación básica en México (NEM). Aquí el análisis de mi grupo:
Total alumnos: ${lista.length}
Promedio general: ${promGrupo}
Alumnos en riesgo (<6): ${enRiesgo.length} — ${enRiesgo.map(a=>a.n||a.nombre).join(', ')||'ninguno'}
En seguimiento (6-7.5): ${enSeguim.length} — ${enSeguim.map(a=>a.n||a.nombre).slice(0,3).join(', ')||'ninguno'}
Promedios por materia: ${promediosMaterias}

Genera un análisis breve del grupo con:
1. Diagnóstico en 2 oraciones
2. 2 acciones concretas que puedo hacer ESTA SEMANA
3. Un mensaje motivador para mí como docente

Máximo 150 palabras. Lenguaje NEM, directo y útil.`;

  try {
    const texto = await callAI({ feature: 'portafolio_analisis_grupo', prompt });
    const html = texto.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    res.innerHTML = html;
    // También mostrar en panel oscuro
    if (panel && panelTxt) {
      panelTxt.innerHTML = html;
      panel.style.display = 'block';
    }
    // Guardar en analisis_ia
    if (sb && currentPerfil) {
      sb.from('analisis_ia').insert({
        alumno_id: null, tipo: 'grupo_docente',
        contenido: JSON.stringify({ texto, grupo: window._grupoActivo, docente: currentPerfil.id }),
        created_at: new Date().toISOString(),
      }).catch(()=>{});
    }
  } catch(e) {
    res.innerHTML = `<div style="color:#b91c1c;font-size:12px;">❌ ${e.message}</div>`;
  }

  btn.disabled = false;
  btn.textContent = '✨ Análisis detallado';
}
window.dashRadarIA = dashRadarIA;


// ══════════════════════════════════════════════════════════
//  MÓDULO CALIFICACIONES NEM — v8
//  Aspectos personalizables, porcentajes, escala 5-10
// ══════════════════════════════════════════════════════════

// Materias del grupo (nombres completos NEM)
// ══ ESTRUCTURA NEM COMPLETA ══════════════════════════════════════
// Plan y Programas de Estudio 2022 — SEP / NEM
// ══════════════════════════════════════════════════════════════════

// PRIMARIA — Campos Formativos NEM (1°-6° grado)
const CAMPOS_NEM_PRIMARIA = [
  {
    id: 'lenguajes',
    nombre: 'Lenguajes',
    color: '#1e40af',
    bg: '#eff6ff',
    emoji: '📖',
    materias: [
      'Lengua Materna (Español)',
      'Segunda Lengua (Inglés)',
      'Educación Artística',
    ]
  },
  {
    id: 'saberes',
    nombre: 'Saberes y Pensamiento Científico',
    color: '#166534',
    bg: '#f0fdf4',
    emoji: '🔬',
    materias: [
      'Matemáticas',
      'Ciencias Naturales y Tecnología',
      'Conocimiento del Medio',        // solo 1° y 2°
    ]
  },
  {
    id: 'etica',
    nombre: 'Ética, Naturaleza y Sociedades',
    color: '#7c3aed',
    bg: '#f5f3ff',
    emoji: '🌍',
    materias: [
      'Historia',
      'Geografía',
      'Formación Cívica y Ética',
      'Vida Saludable',
    ]
  },
  {
    id: 'humano',
    nombre: 'De lo Humano y lo Comunitario',
    color: '#c2410c',
    bg: '#fff7ed',
    emoji: '🤝',
    materias: [
      'Educación Física',
      'Proyecto de Aula',
      'Tutoría y Participación Social',
    ]
  },
];

// SECUNDARIA — Campos Formativos Fase 6 NEM (1°-3° grado)
// En Fase 6 NEM, la calificación es POR CAMPO FORMATIVO, no por asignatura individual
// ── CAMPOS NEM SECUNDARIA — Plan 2022 (NEM 2026) ──────────────────
// Materias individuales por campo formativo
// Las ciencias cambian por grado: 1°=Biología, 2°=Física, 3°=Química
const CAMPOS_NEM_SECUNDARIA = [
  {
    id: 'lenguajes',
    nombre: 'Lenguajes',
    color: '#1e40af',
    bg: '#eff6ff',
    emoji: '📖',
    materias: [
      'Español',
      'Inglés',
      'Artes',
    ],
    contenidos: ['Lengua materna (Español)', 'Lengua extranjera (Inglés)', 'Artes']
  },
  {
    id: 'saberes',
    nombre: 'Saberes y Pensamiento Científico',
    color: '#166534',
    bg: '#f0fdf4',
    emoji: '🔬',
    materias: [
      'Matemáticas',
      'Ciencias',   // Nombre base — se especifica por grado en CIENCIAS_POR_GRADO
      'Tecnología',
    ],
    contenidos: ['Matemáticas', 'Ciencias', 'Tecnología']
  },
  {
    id: 'etica',
    nombre: 'Ética, Naturaleza y Sociedades',
    color: '#7c3aed',
    bg: '#f5f3ff',
    emoji: '🌍',
    materias: [
      'Historia',
      'Formación Cívica y Ética',
      // Geografía solo en 1° — se añade dinámicamente
    ],
    contenidos: ['Historia', 'Geografía (1°)', 'Formación Cívica y Ética']
  },
  {
    id: 'humano',
    nombre: 'De lo Humano y lo Comunitario',
    color: '#c2410c',
    bg: '#fff7ed',
    emoji: '🤝',
    materias: [
      'Educación Física',
      'Tutoría',
      'Tecnología',  // Tecnología también aparece aquí en algunos planes
    ],
    contenidos: ['Educación Física', 'Tutoría', 'Tecnología']
  },
];

// ── Ciencias por grado (secundaria) ──────────────────────────────
const CIENCIAS_POR_GRADO = {
  '1': 'Biología',
  '2': 'Física',
  '3': 'Química',
};

// ── Materias completas por grado (secundaria) ─────────────────────
const MATERIAS_SECUNDARIA_POR_GRADO = {
  '1': ['Español','Inglés','Artes','Matemáticas','Biología','Geografía',
        'Historia','Formación Cívica y Ética','Educación Física','Tutoría','Tecnología'],
  '2': ['Español','Inglés','Artes','Matemáticas','Física',
        'Historia','Formación Cívica y Ética','Educación Física','Tutoría','Tecnología'],
  '3': ['Español','Inglés','Artes','Matemáticas','Química',
        'Historia','Formación Cívica y Ética','Educación Física','Tutoría','Tecnología'],
};

// Helper: obtener materias según nivel y grado activo
function getMateriasByGrado(grado) {
  const gr = String(grado || '').replace(/[°\s]/g, '').trim();
  return MATERIAS_SECUNDARIA_POR_GRADO[gr] || MATERIAS_SECUNDARIA_POR_GRADO['1'];
}

// Helper: get flat list of materias for current nivel
function getMateriasByNivel(nivel) {
  const nivel_ = nivel || window._nivelActivo || 'primaria';
  if (nivel_ === 'secundaria') {
    // Si hay un grupo activo con grado definido, usar materias específicas del grado
    const grupoActivo = (window._gruposDocente || []).find(g => g.id === window._grupoActivo);
    const grado = grupoActivo?.grado || window._gradoActivo || '1';
    const gr = String(grado).replace(/[°\s]/g, '').trim();
    if (MATERIAS_SECUNDARIA_POR_GRADO?.[gr]) {
      return MATERIAS_SECUNDARIA_POR_GRADO[gr];
    }
    // Fallback: materias únicas de todos los campos
    const campos = CAMPOS_NEM_SECUNDARIA;
    const all = [];
    campos.forEach(c => c.materias.forEach(m => { if (!all.includes(m)) all.push(m); }));
    return all;
  }
  const campos = CAMPOS_NEM_PRIMARIA;
  const all = [];
  campos.forEach(c => c.materias.forEach(m => { if (!all.includes(m)) all.push(m); }));
  return all;
}

function getCamposByNivel(nivel) {
  const nivel_ = nivel || window._nivelActivo || 'primaria';
  return nivel_ === 'secundaria' ? CAMPOS_NEM_SECUNDARIA : CAMPOS_NEM_PRIMARIA;
}

// Dynamic MATERIAS_NEM — always reflects current nivel
// Used as getter so all existing code works automatically
let _MATERIAS_NEM_STATIC = getMateriasByNivel('primaria');
// Override with Proxy so reads always get current nivel's materias
const MATERIAS_NEM = new Proxy([], {
  get(target, prop) {
    const current = getMateriasByNivel(window._nivelActivo);
    if (prop === 'length') return current.length;
    if (prop === 'forEach') return current.forEach.bind(current);
    if (prop === 'map')     return current.map.bind(current);
    if (prop === 'filter')  return current.filter.bind(current);
    if (prop === 'reduce')  return current.reduce.bind(current);
    if (prop === 'indexOf') return current.indexOf.bind(current);
    if (prop === 'includes') return current.includes.bind(current);
    if (prop === 'slice')   return current.slice.bind(current);
    if (prop === 'find')    return current.find.bind(current);
    if (prop === Symbol.iterator) return current[Symbol.iterator].bind(current);
    if (typeof prop === 'string' && !isNaN(prop)) return current[parseInt(prop)];
    return current[prop];
  }
});

// Aspectos base por defecto para cualquier materia (el docente puede modificar)
const ASPECTOS_DEFAULT = [
  { nombre: 'Participación',  pct: 20 },
  { nombre: 'Proyectos',      pct: 20 },
  { nombre: 'Actividades',    pct: 30 },
  { nombre: 'Exámenes',       pct: 20 },
  { nombre: 'Asistencia',     pct: 10 },
];

// Estado central: { [materia]: { [trimestre]: { [alumnoIdx]: { [aspectoIdx]: calificacion } } } }
let CAL_DATA = {};
// Configuración de aspectos por materia: { [materia]: [ {nombre, pct} ] }
let CAL_ASPECTOS = {};

// Estado UI
let calTrimActual = 1;
let calMatActual  = MATERIAS_NEM[0];

// ── Leer configuración de evaluación (con defaults NEM) ──
function _calCfg() {
  const c = window.CAL_CONFIG || {};
  return {
    num_periodos:        c.num_periodos        || 3,
    nombre_periodo:      c.nombre_periodo      || 'Trimestre',
    escala:              c.escala              || '1-10',
    minimo_aprobatorio:  c.minimo_aprobatorio  != null ? c.minimo_aprobatorio  : 6,
    minimo_recuperacion: c.minimo_recuperacion != null ? c.minimo_recuperacion : 6,
  };
}

// Inicializar datos demo
async function calInit() {
  // Usar materias asignadas al docente, o todas si aún no se han cargado
  const matsInit = (window._materiasDocente?.length)
    ? window._materiasDocente
    : MATERIAS_NEM;
  matsInit.forEach(mat => {
    CAL_ASPECTOS[mat] = ASPECTOS_DEFAULT.map(a => ({...a}));
    CAL_DATA[mat] = {};
    const _n = _calCfg().num_periodos;
    for (let i = 1; i <= _n; i++) CAL_DATA[mat][i] = {};
  });
  calRenderPeriodTabs();
  // Sincronizar calMatActual con las materias disponibles
  if (matsInit.length && !matsInit.includes(calMatActual)) {
    calMatActual = matsInit[0];
  }

  if (!sb || !currentPerfil) {
    // Modo demo sin Supabase
    _calInitDemo();
    return;
  }

  try {
    // 1. Cargar grupos del docente (solo si no los tenemos ya)
    let grupos = window._gruposDocente;
    if (!grupos?.length) {
      grupos = await cargarGruposDocente();
      if (!grupos.length) {
        hubToast('⚠️ No tienes grupos asignados aún');
        _calInitDemo();
        return;
      }
      window._gruposDocente = grupos;
    }

    // CORRECCIÓN: Respetar el grupo activo seleccionado por el usuario,
    // solo usar grupos[0] si no hay grupo activo definido aún
    if (!window._grupoActivo) {
      window._grupoActivo = grupos[0].id;
    }
    const grupoIdActivo = window._grupoActivo;
    const grupoActivo = grupos.find(g => g.id === grupoIdActivo) || grupos[0];

    // Actualizar títulos con el nombre real del grupo activo
    const nomGrupo = typeof resolverNombreGrupo === 'function'
      ? resolverNombreGrupo(grupoActivo)
      : (grupoActivo.nombre || grupoActivo.grado + '°');
    const calH2 = document.getElementById('cal-titulo-h2');
    if (calH2) calH2.textContent = 'Calificaciones · ' + nomGrupo;
    const topTitle = document.getElementById('page-title');
    if (topTitle && topTitle.textContent.includes('Calificaciones')) {
      topTitle.textContent = 'Calificaciones · ' + nomGrupo;
    }

    // 1b. Cargar materias del docente para este grupo si aún no están en memoria
    if (!window._materiasDocente?.length && currentPerfil?.id) {
      try {
        const { data: asig } = await sb.from('docente_grupos')
          .select('materia')
          .eq('docente_id', currentPerfil.id)
          .eq('grupo_id', grupoIdActivo)
          .eq('activo', true);
        if (asig?.length) {
          const mats = [...new Set(asig.map(r => r.materia).filter(Boolean))];
          if (mats.length) {
            window._materiasDocente = mats;
            window._materiasFiltered = mats;
            // Re-inicializar estructuras de datos solo para materias asignadas
            mats.forEach(mat => {
              if (!CAL_ASPECTOS[mat]) CAL_ASPECTOS[mat] = ASPECTOS_DEFAULT.map(a => ({...a}));
              if (!CAL_DATA[mat]) { CAL_DATA[mat] = {}; const _n1 = _calCfg().num_periodos; for (let i = 1; i <= _n1; i++) CAL_DATA[mat][i] = {}; }
            });
          }
        }
      } catch(e) { console.warn('[calInit] materias:', e.message); }
    }

    // 2. Cargar alumnos del grupo ACTIVO (no siempre grupos[0])
    const alumnosDB = window._alumnosActivos?.length
      ? window._alumnosActivos
      : await calCargarAlumnosGrupo(grupoIdActivo);
    if (!alumnosDB.length) {
      _calInitDemo();
      return;
    }
    window._alumnosActivos = alumnosDB;
    window._alumnosActivosGrupoId = grupoIdActivo;
    if (!window._alumnosPorGrupo) window._alumnosPorGrupo = {};
    window._alumnosPorGrupo[grupoIdActivo] = alumnosDB;
    // Guardar conteo por grupo para mostrar en las tarjetas de Mis grupos
    if (!window._alumnosCountPorGrupo) window._alumnosCountPorGrupo = {};
    window._alumnosCountPorGrupo[grupoIdActivo] = alumnosDB.length;

    // 3. Cargar aspectos personalizados del docente (si existen)
    await calCargarAspectos(grupoIdActivo);

    // 4. Cargar calificaciones existentes del grupo activo
    await calCargarCalificacionesDB(grupoIdActivo);

  } catch(e) {
    console.warn('calInit DB error, usando demo:', e);
    _calInitDemo();
  }

  // Sincronizar calMatActual con materias del docente antes de renderizar
  const matsDisp = window._materiasDocente?.length ? window._materiasDocente : null;
  if (matsDisp && !matsDisp.includes(calMatActual)) calMatActual = matsDisp[0];

  calRenderMatTabs();
  calRenderTabla();
  calRenderStats();
}

function calRenderMatButtons() {
  // Re-render the materia selector buttons when nivel changes
  const mats = getMateriasByNivel(window._nivelActivo);
  const wrap = document.getElementById('cal-mat-buttons') || document.querySelector('[id^="cal-mat"]')?.parentElement;
  if (wrap) {
    wrap.innerHTML = mats.map(m => `
      <button onclick="calSetMateria('${m}')" 
        class="mat-btn${m === calMatActual ? ' active' : ''}"
        style="padding:6px 12px;border:1.5px solid ${m===calMatActual?'var(--verde)':'var(--gris-20)'};background:${m===calMatActual?'var(--verde)':'white'};color:${m===calMatActual?'white':'var(--gris-90)'};border-radius:8px;font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;transition:.15s;">
        ${m}
      </button>`).join('');
  }
  // Also update the materia select in cal config
  const sel = document.getElementById('cal-mat-sel');
  if (sel) {
    sel.innerHTML = mats.map(m => `<option value="${m}" ${m===calMatActual?'selected':''}>${m}</option>`).join('');
  }
}

function obsActualizarMaterias() {
  const mats = window._materiasDocente?.length
    ? window._materiasDocente
    : getMateriasByNivel(window._nivelActivo);
  document.querySelectorAll('#obs-filtro-materia, #cal-mat-obs-sel, select[id*="materia"]').forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = `<option value="">Todas las materias</option>` + 
      mats.map(m => `<option value="${m}">${m}</option>`).join('');
    if (mats.includes(cur)) sel.value = cur;
  });
}

function _calInitDemo() {
  // Datos demo para probar la UI — respeta materias asignadas al docente si las hay
  const mats = window._materiasDocente?.length ? window._materiasDocente : Array.from(MATERIAS_NEM);
  const matsDemo = mats;
  matsDemo.forEach(mat => {
    CAL_ASPECTOS[mat] = ASPECTOS_DEFAULT.map(a => ({...a}));
    CAL_DATA[mat] = {};
    [1,2,3].forEach(trim => {
      CAL_DATA[mat][trim] = {};
      const lista = window._alumnosActivos || alumnos;
      lista.forEach((a, ai) => {
        CAL_DATA[mat][trim][ai] = {};
        CAL_ASPECTOS[mat].forEach((asp, asi) => {
          const base = 5 + Math.random()*5;
          const raw = Math.min(10, Math.max(5, base + ((a.cals?.[0]||7)-7)));
          CAL_DATA[mat][trim][ai][asi] = raw < 6.5 ? Math.round(raw*10)/10 : Math.round(raw);
        });
      });
    });
  });
  calRenderMatTabs();
  calRenderTabla();
  calRenderStats();
}

async function calCargarAlumnosGrupo(grupoId) {
  if (!grupoId) return [];
  try {
    if (!window._alumnosPorGrupo) window._alumnosPorGrupo = {};
    const normalizarListaGrupo = (rows = []) => {
      const unicos = new Map();
      rows.forEach(r => {
        const a = r?.usuarios || r?.alumnos;
        if (!a?.id || unicos.has(a.id)) return;
        unicos.set(a.id, {
          id: a.id,
          nombre: a.nombre || '',
          apellido_p: a.apellido_p || '',
          apellido_m: a.apellido_m || '',
          n: `${a.nombre||''} ${a.apellido_p||''} ${a.apellido_m||''}`.trim(),
          cals: [7,7,7,7,7,7,7,7],
          as: 'P',
          curp: a.curp || '',
          num_lista: r?.num_lista || a.num_lista || null
        });
      });
      return ordenarAlumnosPorApellido(Array.from(unicos.values()));
    };

    if (typeof cargarAlumnosGrupo === 'function') {
      try {
        const listaBase = await cargarAlumnosGrupo(grupoId);
        const lista = normalizarListaGrupo((listaBase || []).map(a => ({
          usuarios: a,
          num_lista: a?.num_lista || null
        })));
        window._alumnosPorGrupo[grupoId] = lista;
        return lista;
      } catch(eBase) {
        console.warn('[calCargarAlumnosGrupo] cargarAlumnosGrupo fallback:', eBase.message);
      }
    }

    return [];
  } catch(e) {
    console.warn('[calCargarAlumnosGrupo]', e.message);
    return [];
  }
}

async function calCargarAspectos(grupoId) {
  const { data } = await sb.from('aspectos_evaluacion')
    .select('*')
    .eq('docente_id', currentPerfil.id)
    .eq('grupo_id', grupoId)
    .order('orden');
  if (!data || !data.length) return;

  // Agrupar por materia
  const byMat = {};
  data.forEach(asp => {
    if (!byMat[asp.materia]) byMat[asp.materia] = [];
    byMat[asp.materia].push({ nombre: asp.nombre, pct: asp.porcentaje });
  });
  // Actualizar CAL_ASPECTOS
  Object.keys(byMat).forEach(mat => {
    CAL_ASPECTOS[mat] = byMat[mat];
  });
}

async function calCargarCalificacionesDB(grupoId) {
  const alumnosActivos = window._alumnosActivos || [];
  if (!alumnosActivos.length) return;

  const alumnoIds = alumnosActivos.map(a => a.id);
  const { data, error } = await sb.from('calificaciones')
    .select('*')
    .eq('grupo_id', grupoId)
    .eq('ciclo', window.CICLO_ACTIVO)
    .in('alumno_id', alumnoIds);

  if (error || !data) return;

  // Poblar CAL_DATA con datos reales
  data.forEach(cal => {
    const ai = alumnosActivos.findIndex(a => a.id === cal.alumno_id);
    if (ai < 0) return;
    const mat  = cal.materia;
    const trim = cal.trimestre;
    const aspectos = CAL_ASPECTOS[mat] || [];
    const asi = aspectos.findIndex(a => a.nombre === cal.aspecto);
    if (asi < 0) return;

    if (!CAL_DATA[mat]) CAL_DATA[mat] = {};
    if (!CAL_DATA[mat][trim]) CAL_DATA[mat][trim] = {};
    if (!CAL_DATA[mat][trim][ai]) CAL_DATA[mat][trim][ai] = {};
    CAL_DATA[mat][trim][ai][asi] = parseFloat(cal.calificacion);
  });
}

// Tabs de materias
function calRenderMatTabs() {
  const wrap = document.getElementById('cal-mat-tabs');
  if (!wrap) return;

  // Prioridad de materias:
  // 1. Materias asignadas al docente en docente_grupos (fuente de verdad)
  // 2. Materias del grado activo según plan SEP (fallback inteligente)
  let mats = [];
  if (window._materiasDocente?.length) {
    mats = window._materiasDocente;
  } else if (!window._gruposDocente?.length) {
    // Grupos aún no cargados — mostrar skeleton en lugar de todas las materias
    if (wrap) wrap.innerHTML = '<div style="padding:6px 0;color:#94a3b8;font-size:12px;">Cargando materias…</div>';
    return;
  } else {
    // Fallback: materias del grado del grupo activo
    const grupoActivo = (window._gruposDocente||[]).find(g => g.id === window._grupoActivo)
                     || window._gruposDocente?.[0];
    const nivel = grupoActivo?.nivel || window._nivelActivo || 'secundaria';
    if (nivel === 'secundaria' && grupoActivo?.grado) {
      const gr = String(grupoActivo.grado).replace(/[°\s]/g,'').trim();
      mats = window.MATERIAS_SECUNDARIA_POR_GRADO?.[gr]
          || window.MATERIAS_SECUNDARIA_POR_GRADO?.['1']
          || getMateriasByNivel('secundaria');
    } else {
      mats = getMateriasByNivel(nivel);
    }
  }

  if (!mats.length) mats = getMateriasByNivel(window._nivelActivo || 'secundaria');

  // Excluir campos formativos — solo mostrar materias específicas
  const _CAMPOS_FORM = [
    'Lenguajes','Saberes y Pensamiento Científico','Ética, Naturaleza y Sociedades',
    'De lo Humano y lo Comunitario','Pensamiento Matemático',
    'Exploración de la Naturaleza y la Sociedad','Desarrollo Personal y Social','Conocimiento del Medio',
  ];
  mats = mats.filter(m => !_CAMPOS_FORM.includes(m));
  if (!mats.length) mats = getMateriasByNivel(window._nivelActivo || 'secundaria').filter(m => !_CAMPOS_FORM.includes(m));

  if (mats.length && !mats.includes(calMatActual)) calMatActual = mats[0];

  wrap.innerHTML = mats.map(m => `
    <button onclick="calSetMateria('${m}')"
      style="padding:7px 14px;border-radius:99px;border:1.5px solid ${m===calMatActual?'var(--verde)':'var(--gris-20)'};
             background:${m===calMatActual?'var(--verde)':'white'};color:${m===calMatActual?'white':'var(--gris-80)'};
             font-family:'Sora',sans-serif;font-size:12px;font-weight:${m===calMatActual?'700':'500'};
             cursor:pointer;white-space:nowrap;transition:.15s;">
      ${m}
    </button>`).join('');
}

function calSetMateria(mat) {
  calMatActual = mat;
  calRenderMatTabs();
  calRenderTabla();
  calRenderStats();
  // Resetear vistas expandidas
  document.getElementById('cal-graficas-wrap').style.display = 'none';
  document.getElementById('cal-reporte-wrap').style.display = 'none';
}

function calRenderPeriodTabs() {
  const cont = document.getElementById('cal-trim-tabs');
  if (!cont) return;
  const cfg = _calCfg();
  const ord = ['','1er','2do','3er','4to','5to'];
  cont.innerHTML = '';
  for (let i = 1; i <= cfg.num_periodos; i++) {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (i === 1 ? ' active' : '');
    btn.textContent = `${ord[i]||i+'°'} ${cfg.nombre_periodo}`;
    btn.onclick = function() { calSetTrim(i, this); };
    cont.appendChild(btn);
  }
  // Reset active trimestre to 1 when re-rendering
  if (window.calTrimActual > cfg.num_periodos) window.calTrimActual = 1;
}

function calSetTrim(num, btn) {
  calTrimActual = num;
  document.querySelectorAll('#cal-trim-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  calRenderTabla();
  calRenderStats();
}

// ── Tabla de captura ──
function calRenderTabla() {
  const t = document.getElementById('tabla-cals-nem');
  if (!t) return;

  // Estado vacío — sin alumnos registrados
  const lista = window._alumnosActivos || alumnos;
  if (!lista.length) {
    t.innerHTML = `<thead></thead><tbody><tr><td colspan="10" style="padding:48px 20px;text-align:center;color:var(--gris-50);">
      <div style="font-size:36px;margin-bottom:12px;">📋</div>
      <div style="font-size:15px;font-weight:700;color:var(--gris-80);margin-bottom:6px;">Aún no hay alumnos registrados</div>
      <div style="font-size:13px;line-height:1.6;">El director debe dar de alta los grupos y alumnos<br>desde el portal de dirección.</div>
    </td></tr></tbody>`;
    return;
  }

  const aspectos = CAL_ASPECTOS[calMatActual] || [];
  const data     = CAL_DATA[calMatActual]?.[calTrimActual] || {};

  // Verificar suma pct
  const sumaPct = aspectos.reduce((s,a)=>s+a.pct,0);
  const aviso = document.getElementById('cal-aviso-pct');
  if (aviso) aviso.style.display = sumaPct !== 100 ? 'block' : 'none';

  const isSecundaria = (window._nivelActivo === 'secundaria');

  // Cabecera: Alumno | Aspecto1 (%Xpct) | ... | Promedio | Nivel (solo primaria)
  let thead = `<thead><tr>
    <th style="min-width:140px;">Alumno</th>
    ${aspectos.map((a,i) => `<th style="min-width:80px;text-align:center;">
      <div style="font-size:11px;font-weight:700;">${a.nombre}</div>
      <div style="font-size:10px;color:#a0aec0;font-weight:400;">${a.pct}%</div>
    </th>`).join('')}
    <th style="min-width:80px;text-align:center;">Promedio<br><span style="font-size:10px;color:#a0aec0;font-weight:400;">Ponderado</span></th>
    ${isSecundaria ? '' : '<th style="min-width:70px;text-align:center;">Nivel</th>'}
  </tr></thead>`;

  // Cuerpo
  let tbody = '<tbody>' + alumnos.map((a, ai) => {
    const cals = data[ai] || {};
    const prom = calPromPonderado(ai, calMatActual, calTrimActual);
    const niv  = calNivel(prom);
    return `<tr>
      <td style="font-weight:600;font-size:13px;">${a.n}</td>
      ${aspectos.map((asp, asi) => {
        const val = calAplicarRegla(cals[asi] !== undefined ? cals[asi] : 7);
        const color = val >= 9 ? '#dcfce7' : val >= 7 ? '#fef9c3' : val >= 5 ? '#fff7ed' : '#fee2e2';
        const tc    = val >= 9 ? '#15803d' : val >= 7 ? '#a16207' : val >= 5 ? '#c2410c' : '#b91c1c';
        return `<td style="text-align:center;padding:6px;" id="cal-cell-${ai}-${asi}">
          <div onclick="_calShowPicker(this,${ai},${asi},'${calMatActual}',${calTrimActual})"
               style="width:52px;margin:auto;padding:6px 4px;border:1.5px solid #e2e8f0;border-radius:8px;
                      background:${color};color:${tc};font-family:'Sora',sans-serif;
                      font-size:14px;font-weight:700;text-align:center;cursor:pointer;
                      user-select:none;position:relative;transition:.2s;">
            ${val}
          </div>
        </td>`;
      }).join('')}
      <td style="text-align:center;">
        <strong id="cal-prom-${ai}" style="font-size:16px;color:${calColor(prom)};">${calFormatVal(prom)}</strong>
      </td>
      ${isSecundaria ? '' : `<td style="text-align:center;">
        <span id="cal-niv-${ai}" class="nivel-badge nivel-${niv}">${niv}</span>
      </td>`}
    </tr>`;
  }).join('') + '</tbody>';

  t.innerHTML = thead + tbody;

  // Titulo de la card
  const ct = document.getElementById('cal-card-titulo');
  if (ct) ct.textContent = `📋 ${calMatActual} · Trimestre ${calTrimActual}`;
}

// ── Stats rápidos ──
function calRenderStats() {
  const row = document.getElementById('cal-stats-row');
  if (!row) return;
  const lista = window._alumnosActivos || alumnos;
  if (!lista.length) {
    row.innerHTML = `
      <div class="stat-card"><div class="stat-ico verde">📊</div><div><div class="stat-val">—</div><div class="stat-lbl">Promedio del grupo</div></div></div>
      <div class="stat-card"><div class="stat-ico verde">🏆</div><div><div class="stat-val">—</div><div class="stat-lbl">Calificación más alta</div></div></div>
      <div class="stat-card"><div class="stat-ico amarillo">📉</div><div><div class="stat-val">—</div><div class="stat-lbl">Calificación más baja</div></div></div>
      <div class="stat-card"><div class="stat-ico verde">⚠️</div><div><div class="stat-val">—</div><div class="stat-lbl">Alumnos en atención</div></div></div>`;
    return;
  }
  const promedios = lista.map((_,ai) => calPromPonderado(ai, calMatActual, calTrimActual));
  const avg = promedios.reduce((s,p)=>s+p,0)/promedios.length;
  const maxP = Math.max(...promedios);
  const minP = Math.min(...promedios);
  const enRiesgo = promedios.filter(p=>p<6).length;

  row.innerHTML = [
    { ico:'📊', val: avg.toFixed(1), lbl:'Promedio del grupo', color:'verde' },
    { ico:'🏆', val: maxP.toFixed(1), lbl:'Calificación más alta', color:'verde' },
    { ico:'📉', val: minP.toFixed(1), lbl:'Calificación más baja', color: minP < 6 ? 'rojo' : 'amarillo' },
    { ico:'⚠️', val: enRiesgo,        lbl:'Alumnos en atención', color: enRiesgo > 0 ? 'rojo' : 'verde' },
  ].map(s => `
    <div class="stat-card">
      <div class="stat-ico ${s.color}">${s.ico}</div>
      <div><div class="stat-val">${s.val}</div><div class="stat-lbl">${s.lbl}</div></div>
    </div>`).join('');
}

// ── Cálculo promedio ponderado ──
function calPromPonderado(ai, mat, trim) {
  const aspectos = CAL_ASPECTOS[mat] || [];
  const cals     = CAL_DATA[mat]?.[trim]?.[ai] || {};
  const sumaPct  = aspectos.reduce((s,a)=>s+a.pct,0) || 100;
  let total = 0;
  aspectos.forEach((a, asi) => {
    const v = cals[asi] !== undefined ? cals[asi] : 7;
    total += v * (a.pct / sumaPct);
  });
  return Math.min(10, Math.max(5, total));
}

function calNivel(p) {
  const min = _calCfg().minimo_aprobatorio;
  return p>=(min+3)?'A':p>=(min+2)?'B':p>=(min+1)?'C':p>=min?'D':'E';
}
function calColor(p) {
  const min = _calCfg().minimo_aprobatorio;
  return p>=(min+2)?'#15803d':p>=min?'#a16207':'#b91c1c';
}

// ── Actualizar celda ──
// El docente elige valores discretos 5-10
function calAplicarRegla(raw) {
  let v = parseInt(raw);
  if (isNaN(v) || v < 5) return 5;
  if (v > 10) return 10;
  return v;
}
// Redondeo de calificación final: ≥7.5 → redondea al entero superior; <7.5 → sin cambio
function calRedondearFinal(v) {
  if (v >= 7.5) return Math.round(v);
  return Math.round(v * 10) / 10;
}
function calFormatVal(v) {
  const r = calRedondearFinal(v);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
function _calShowPicker(el, ai, asi, mat, trim) {
  document.querySelectorAll('.cal-picker').forEach(p => p.remove());
  const cur = parseInt(el.textContent.trim()) || 7;
  const picker = document.createElement('div');
  picker.className = 'cal-picker';
  picker.style.cssText = 'position:fixed;background:white;border:1.5px solid #e2e8f0;border-radius:12px;padding:8px;box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:9999;display:flex;gap:5px;';
  const rect = el.getBoundingClientRect();
  picker.style.top  = (rect.bottom + 6) + 'px';
  picker.style.left = Math.max(8, rect.left - 55) + 'px';
  [5,6,7,8,9,10].forEach(n => {
    const c  = n>=9?'#dcfce7':n>=7?'#fef9c3':'#fff7ed';
    const tc = n>=9?'#15803d':n>=7?'#a16207':'#c2410c';
    const btn = document.createElement('button');
    btn.textContent = n;
    const sel = n === cur;
    btn.style.cssText = 'width:34px;height:34px;border-radius:7px;border:1.5px solid '+(sel?tc:'#e2e8f0')+';background:'+(sel?c:'#f8fafc')+';color:'+(sel?tc:'#64748b')+';font-family:\'Sora\',sans-serif;font-size:13px;font-weight:'+(sel?800:600)+';cursor:pointer;transition:.15s;';
    btn.onmouseenter = () => { btn.style.background=c; btn.style.color=tc; btn.style.borderColor=tc; };
    btn.onmouseleave = () => { if(n!==cur){ btn.style.background=sel?c:'#f8fafc'; btn.style.color=sel?tc:'#64748b'; btn.style.borderColor=sel?tc:'#e2e8f0'; } };
    btn.onclick = (e) => { e.stopPropagation(); calUpdateCal(ai,asi,mat,trim,n); picker.remove(); };
    picker.appendChild(btn);
  });
  document.body.appendChild(picker);
  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', close); }
    });
  }, 10);
}

function calUpdateCal(ai, asi, mat, trim, val) {
  const v = calAplicarRegla(val);
  if (!CAL_DATA[mat]) CAL_DATA[mat] = {};
  if (!CAL_DATA[mat][trim]) CAL_DATA[mat][trim] = {};
  if (!CAL_DATA[mat][trim][ai]) CAL_DATA[mat][trim][ai] = {};
  CAL_DATA[mat][trim][ai][asi] = v;

  // Actualizar el cuadro de calificación
  const cell = document.getElementById(`cal-cell-${ai}-${asi}`);
  if (cell) {
    const el = cell.querySelector('div');
    if (el) {
      const color = v>=9?'#dcfce7':v>=7?'#fef9c3':v>=5?'#fff7ed':'#fee2e2';
      const tc    = v>=9?'#15803d':v>=7?'#a16207':v>=5?'#c2410c':'#b91c1c';
      el.style.background = color;
      el.style.color = tc;
      el.textContent = v;
    }
  }

  // Actualizar promedio fila
  const prom = calPromPonderado(ai, mat, trim);
  const pEl  = document.getElementById(`cal-prom-${ai}`);
  const nEl  = document.getElementById(`cal-niv-${ai}`);
  if (pEl) { pEl.textContent = calFormatVal(prom); pEl.style.color = calColor(prom); }
  if (nEl) { const niv = calNivel(prom); nEl.textContent = niv; nEl.className = `nivel-badge nivel-${niv}`; }
  calRenderStats();
}

// ── Guardar ──
async function calGuardar() {
  if (!sb || !currentPerfil) { hubToast('⚠️ Inicia sesión para guardar', 'warn'); return; }

  // Determinar grupo activo
  const grupoId = window._grupoActivo;
  if (!grupoId) { hubToast('⚠️ No hay grupo seleccionado', 'warn'); return; }

  const mat  = calMatActual;
  const trim = calTrimActual;
  const data = CAL_DATA[mat]?.[trim];
  if (!data) { hubToast('⚠️ No hay datos para guardar'); return; }

  const alumnosList = window._alumnosActivos || [];
  if (!alumnosList.length) { hubToast('⚠️ Sin alumnos cargados'); return; }

  hubToast('💾 Guardando…');

  const rows = [];
  alumnosList.forEach((alumno, ai) => {
    const aspectos = CAL_ASPECTOS[mat] || [];
    aspectos.forEach((asp, asi) => {
      const cal = data[ai]?.[asi];
      if (cal !== undefined && cal !== null) {
        rows.push({
          alumno_id:    alumno.id,
          grupo_id:     grupoId,
          docente_id:   currentPerfil.id,
          materia:      mat,
          trimestre:    trim,
          aspecto:      asp.nombre,
          calificacion: parseFloat(cal),
          ciclo: window.CICLO_ACTIVO,
          actualizado_en: new Date().toISOString()
        });
      }
    });
  });

  const { error } = await sb.from('calificaciones')
    .upsert(rows, { onConflict: 'alumno_id,grupo_id,materia,trimestre,aspecto,ciclo' });

  if (error) {
    console.error('Error guardando calificaciones:', error);
    hubToast('❌ Error al guardar: ' + error.message, 'error');
  } else {
    hubToast('✅ Calificaciones guardadas en Supabase', 'ok');
    // Auto-notificación de riesgo
    calDetectarRiesgoYNotificar().catch(()=>{});
  }
}

// ══════════════════════════════════════════════════════
// MÓDULO: EXÁMENES
// ══════════════════════════════════════════════════════
let _examenesData = [];

async function examenesInit() {
  const grupoSel = document.getElementById('ex-filtro-grupo');
  const matSel   = document.getElementById('ex-filtro-materia');
  const grupoActivoId = window._grupoActivo || '';
  const grupoActivo = (window._gruposDocente || []).find(g => g.id === grupoActivoId) || window._gruposDocente?.[0] || null;
  if (grupoSel && window._gruposDocente?.length) {
    grupoSel.innerHTML = '<option value="">Todos los grupos</option>' +
      window._gruposDocente.map(g =>
        `<option value="${g.id}">${g.nombre||g.grado+'°'} ${g.seccion||''}</option>`
      ).join('');
    if (grupoActivoId) grupoSel.value = grupoActivoId;
  }
  if (matSel && window._materiasDocente?.length) {
    matSel.innerHTML = '<option value="">Todas las materias</option>' +
      window._materiasDocente.map(m => `<option value="${m}">${m}</option>`).join('');
  }
  const ctx = document.getElementById('ex-contexto');
  if (ctx) {
    const grupoNombre = grupoActivo
      ? (grupoActivo.nombre || `${grupoActivo.grado}° ${grupoActivo.seccion || grupoActivo.grupo || ''}`.trim())
      : 'Sin grupo activo';
    const materias = (window._materiasDocente || []).filter(Boolean);
    ctx.style.display = '';
    ctx.innerHTML = `<strong>Grupo activo:</strong> ${grupoNombre}` +
      (materias.length ? ` <span style="color:#94a3b8;">|</span> <strong>Materias:</strong> ${materias.join(' · ')}` : '');
  }
  await examenesCargar();
}

function examenesGenerarIA() {
  const modal = document.getElementById('modal-examen-ia');
  if (!modal) return;
  // Poblar selector de materias con las asignadas al docente
  const matSel = document.getElementById('exia-materia');
  const mats = window._materiasDocente?.length ? window._materiasDocente : Array.from(MATERIAS_NEM);
  if (matSel) matSel.innerHTML = mats.map(m => `<option value="${m}">${m}</option>`).join('');
  // Pre-seleccionar grado del grupo activo
  const grupoActivo = (window._gruposDocente||[]).find(g=>g.id===window._grupoActivo) || window._gruposDocente?.[0];
  const gradoSel = document.getElementById('exia-grado');
  if (gradoSel && grupoActivo?.grado) {
    const gr = String(grupoActivo.grado).replace(/[°\s]/g,'').trim();
    gradoSel.value = gr;
  }
  document.getElementById('exia-resultado').style.display = 'none';
  modal.style.display = 'flex';
}

async function examenesGenerarIASubmit() {
  const materia = document.getElementById('exia-materia')?.value || '';
  const trim    = document.getElementById('exia-trim')?.value || '1';
  const temas   = document.getElementById('exia-temas')?.value?.trim() || '';
  const grado   = document.getElementById('exia-grado')?.value || '1';
  const npregs  = document.getElementById('exia-npregs')?.value || '15';
  const resDiv  = document.getElementById('exia-resultado');
  const textoEl = document.getElementById('exia-texto');
  if (!materia) { hubToast('⚠️ Selecciona una materia','warn'); return; }
  resDiv.style.display = 'block';
  textoEl.textContent = '⏳ Generando examen con IA…';
  const nivelLabel = window._nivelActivo === 'primaria' ? 'primaria' : 'secundaria';
  const edadAprox = window._nivelActivo === 'primaria' ? (parseInt(grado) <= 3 ? '6-9 años' : '9-12 años') : '12-15 años';
  const prompt = `Genera una evaluación formativa (no punitiva, enfoque NEM) de ${npregs} preguntas para el campo formativo de "${materia}", ${grado}° grado de ${nivelLabel} (alumnos de aprox. ${edadAprox}), Trimestre ${trim}.${temas ? ` Temas específicos: ${temas}.` : ''} ESTRUCTURA REQUERIDA — mezcla obligatoria: (a) 40% preguntas de comprensión/conocimiento con 4 opciones de respuesta; (b) 30% preguntas de aplicación práctica con respuesta corta; (c) 20% preguntas de análisis o resolución de problemas contextualizados en la vida cotidiana mexicana; (d) 10% (al menos 1) pregunta abierta de reflexión o conexión con la comunidad del alumno. Para cada pregunta: número, tipo entre corchetes, enunciado, líneas de respuesta. Al final: clave de respuestas para el docente. Vocabulario y complejidad apropiados para ${grado}° de ${nivelLabel}. Incluye al menos 2 ejemplos con nombres o lugares mexicanos.`;
  try {
    const texto = await callAI({ feature: 'examen_ia', prompt, system: _nemSys('TAREA: Genera un examen de evaluación formativa (no punitiva) con preguntas variadas: comprensión, aplicación, análisis y una pregunta abierta de reflexión. Formato: número de pregunta, tipo, pregunta, línea de respuesta. Apropiado exactamente para el grado indicado.') });
    textoEl.textContent = texto;
    window._examenIASugerido = { materia, trimestre: parseInt(trim), temas, texto };
  } catch(e) {
    textoEl.textContent = '❌ Error al generar: ' + e.message;
  }
}

function examenesUsarSugerencia() {
  const s = window._examenIASugerido;
  if (!s) return;
  document.getElementById('modal-examen-ia').style.display = 'none';
  examenesNuevo(s);
}

async function examenesCargar() {
  if (!sb || !currentPerfil) return;
  try {
    const { data, error } = await sb.from('examenes_docente')
      .select('*').eq('docente_id', currentPerfil.id)
      .eq('ciclo', window.CICLO_ACTIVO)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    _examenesData = data || [];
  } catch(e) {
    console.warn('[examenes]', e.message);
    _examenesData = [];
  }
  examenesRender();
  examenesStats();
}

function examenesRender() {
  const el = document.getElementById('ex-lista');
  if (!el) return;
  const grupoSel = document.getElementById('ex-filtro-grupo');
  const filtGrupo = grupoSel?.value || window._grupoActivo || '';
  const filtMat   = document.getElementById('ex-filtro-materia')?.value || '';
  const filtTrim  = document.getElementById('ex-filtro-trim')?.value || '';
  if (grupoSel && filtGrupo && grupoSel.value !== filtGrupo) grupoSel.value = filtGrupo;
  let lista = _examenesData;
  if (filtGrupo) lista = lista.filter(e => e.grupo_id === filtGrupo);
  if (filtMat)   lista = lista.filter(e => e.materia  === filtMat);
  if (filtTrim)  lista = lista.filter(e => String(e.trimestre) === filtTrim);
  if (!lista.length) {
    el.innerHTML = '<div style="text-align:center;padding:48px 20px;color:#94a3b8;"><div style="font-size:40px;margin-bottom:12px;">📝</div><div style="font-weight:700;color:#0f172a;margin-bottom:6px;">Sin exámenes registrados</div><div style="font-size:13px;">Crea tu primer examen con el botón &quot;+ Nuevo examen&quot;</div></div>';
    return;
  }
  el.innerHTML = lista.map(ex => {
    const prom = ex.promedio_grupo ?? '—';
    const aprobados = ex.total_aprobados ?? 0;
    const total = ex.total_alumnos ?? 0;
    const pct = total ? Math.round(aprobados/total*100) : 0;
    const color = pct>=70?'#166534':pct>=50?'#92400e':'#991b1b';
    const bg    = pct>=70?'#f0fdf4':pct>=50?'#fffbeb':'#fef2f2';
    return '<div style="background:white;border:1.5px solid #e2e8f0;border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">' +
      '<div style="flex:1;min-width:200px;"><div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:3px;">'+ex.nombre+'</div>' +
      '<div style="font-size:12px;color:#64748b;">'+(ex.materia||'—')+' · '+(ex.grupo_nombre||'—')+' · Trimestre '+(ex.trimestre||'—')+(ex.fecha_aplicacion?' · '+ex.fecha_aplicacion:'')+'</div></div>' +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">' +
      '<div style="text-align:center;padding:8px 14px;background:'+bg+';border-radius:8px;"><div style="font-size:20px;font-weight:800;color:'+color+';">'+prom+'</div><div style="font-size:10px;color:#64748b;font-weight:600;">PROMEDIO</div></div>' +
      '<div style="text-align:center;padding:8px 14px;background:#f8fafc;border-radius:8px;"><div style="font-size:20px;font-weight:800;color:#1e40af;">'+aprobados+'/'+total+'</div><div style="font-size:10px;color:#64748b;font-weight:600;">APROBADOS</div></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
      '<button onclick="examenesCapturar(\'' + ex.id + '\')" style="padding:7px 14px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">✏️ Capturar notas</button>' +
      '<button onclick="examenAbrirGuia(\'' + ex.id + '\')" style="padding:7px 14px;background:' + (ex.guia_ia||ex.guia_pdf_url?'#7c3aed':'#f1f5f9') + ';color:' + (ex.guia_ia||ex.guia_pdf_url?'white':'#475569') + ';border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">' + (ex.guia_ia||ex.guia_pdf_url?'✨ Ver guía':'📚 Agregar guía') + '</button>' +
      '<button onclick="examenToggleVisible(\'' + ex.id + '\',' + !ex.visible_alumnos + ')" style="padding:7px 14px;background:' + (ex.visible_alumnos?'#dcfce7':'#f8fafc') + ';color:' + (ex.visible_alumnos?'#166534':'#94a3b8') + ';border:1.5px solid ' + (ex.visible_alumnos?'#86efac':'#e2e8f0') + ';border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;" title="' + (ex.visible_alumnos?'Visible para alumnos/padres — clic para ocultar':'Oculto para alumnos/padres — clic para publicar') + '">' + (ex.visible_alumnos?'👁 Publicado':'🔒 Oculto') + '</button>' +
      '</div></div></div>';
  }).join('');
}

function examenesStats() {
  const el = document.getElementById('ex-stats');
  if (!el || !_examenesData.length) { if(el) el.innerHTML=''; return; }
  const filtGrupo = document.getElementById('ex-filtro-grupo')?.value || window._grupoActivo || '';
  const base = filtGrupo ? _examenesData.filter(e => e.grupo_id === filtGrupo) : _examenesData;
  if (!base.length) { el.innerHTML = ''; return; }
  const total = base.length;
  const withProm = base.filter(e=>e.promedio_grupo);
  const promGlobal = withProm.length ? withProm.reduce((s,e)=>s+(e.promedio_grupo||0),0)/withProm.length : 0;
  const enRiesgo = base.filter(e=>(e.promedio_grupo||10)<6).length;
  el.innerHTML = [
    {ico:'📝',val:total,lbl:'Exámenes',color:'#1e40af',bg:'#eff6ff'},
    {ico:'📊',val:promGlobal.toFixed(1),lbl:'Promedio global',color:'#166534',bg:'#f0fdf4'},
    {ico:'⚠️',val:enRiesgo,lbl:'Grupos en riesgo',color:'#b91c1c',bg:'#fef2f2'},
  ].map(s=>'<div style="background:'+s.bg+';border-radius:10px;padding:14px 16px;text-align:center;"><div style="font-size:22px;">'+s.ico+'</div><div style="font-size:22px;font-weight:800;color:'+s.color+';">'+s.val+'</div><div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">'+s.lbl+'</div></div>').join('');
}

function examenesNuevo() {
  const div = document.createElement('div');
  div.id = 'ex-modal';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';

  const inner = document.createElement('div');
  inner.style.cssText = 'background:white;border-radius:16px;padding:28px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;';

  const today = new Date().toISOString().split('T')[0];
  const gruposOpts = (window._gruposDocente||[]).map(g => {
    const o = document.createElement('option');
    o.value = g.id;
    o.textContent = (g.nombre||g.grado+'° '+(g.seccion||''));
    return o.outerHTML;
  }).join('');
  const matsOpts = (window._materiasDocente||[]).map(m => {
    const o = document.createElement('option');
    o.value = m; o.textContent = m;
    return o.outerHTML;
  }).join('');

  inner.innerHTML = [
    '<div style="font-family:Fraunces,serif;font-size:20px;font-weight:700;color:#0d5c2f;margin-bottom:20px;">📝 Nuevo examen</div>',
    '<div style="display:flex;flex-direction:column;gap:12px;">',
    '<div><label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Nombre del examen *</label>',
    '<input id="ex-n-nombre" type="text" placeholder="Ej: Examen parcial 1" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:Sora,sans-serif;font-size:13px;box-sizing:border-box;"></div>',
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">',
    '<div><label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Grupo *</label>',
    '<select id="ex-n-grupo" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:Sora,sans-serif;font-size:13px;"><option value="">Seleccionar...</option>'+gruposOpts+'</select></div>',
    '<div><label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Materia *</label>',
    '<select id="ex-n-materia" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:Sora,sans-serif;font-size:13px;"><option value="">Seleccionar...</option>'+matsOpts+'</select></div>',
    '</div>',
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">',
    '<div><label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Trimestre</label>',
    '<select id="ex-n-trim" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:Sora,sans-serif;font-size:13px;"><option value="1">T1</option><option value="2">T2</option><option value="3">T3</option></select></div>',
    '<div><label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Valor (pts)</label>',
    '<input id="ex-n-valor" type="number" min="1" max="100" value="10" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:Sora,sans-serif;font-size:13px;box-sizing:border-box;"></div>',
    '<div><label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Fecha</label>',
    '<input id="ex-n-fecha" type="date" value="'+today+'" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:Sora,sans-serif;font-size:13px;box-sizing:border-box;"></div></div>',
    '<div><label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Temas evaluados</label>',
    '<textarea id="ex-n-desc" rows="2" placeholder="Ej: Fracciones, decimales..." style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:Sora,sans-serif;font-size:13px;resize:vertical;box-sizing:border-box;"></textarea></div>',
    '</div>',
    '<div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">',
    '<button id="ex-cancel-btn" style="padding:10px 18px;background:#f1f5f9;border:none;border-radius:8px;font-family:Sora,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Cancelar</button>',
    '<button id="ex-save-btn" style="padding:10px 18px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-family:Sora,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Crear examen</button>',
    '</div>'
  ].join('');

  div.appendChild(inner);
  document.body.appendChild(div);
  // Attach events after DOM insertion (no inline onclick)
  document.getElementById('ex-cancel-btn').onclick = () => div.remove();
  document.getElementById('ex-save-btn').onclick = () => examenesGuardarNuevo();
}

async function examenesGuardarNuevo() {
  const nombre  = document.getElementById('ex-n-nombre')?.value.trim();
  const grupoId = document.getElementById('ex-n-grupo')?.value;
  const materia = document.getElementById('ex-n-materia')?.value;
  const trim    = parseInt(document.getElementById('ex-n-trim')?.value||'1');
  const valor   = parseFloat(document.getElementById('ex-n-valor')?.value||'10');
  const fecha   = document.getElementById('ex-n-fecha')?.value;
  const desc    = document.getElementById('ex-n-desc')?.value.trim();
  if (!nombre||!grupoId||!materia){hubToast('⚠️ Nombre, grupo y materia son obligatorios','warn');return;}
  const grupoObj = (window._gruposDocente||[]).find(g=>g.id===grupoId);
  try {
    const {data,error} = await sb.from('examenes_docente').insert({
      docente_id:currentPerfil.id,grupo_id:grupoId,grupo_nombre:grupoObj?.nombre||'',
      materia,trimestre:trim,fecha_aplicacion:fecha||null,valor_maximo:valor,
      nombre,descripcion:desc||null,ciclo:window.CICLO_ACTIVO,creado_en:new Date().toISOString()
    }).select().single();
    if(error) throw error;
    hubToast('✅ Examen creado','ok');
    document.getElementById('ex-modal')?.remove();
    _examenesData.unshift(data);
    examenesRender();
    setTimeout(()=>examenesCapturar(data.id),300);
  } catch(e){hubToast('❌ '+e.message,'err');console.error(e);}
}

function _ecalSel(aId, n, btn) {
  const wrap = document.getElementById('ecal_wrap_'+aId);
  if (!wrap) return;
  const c=n>=9?'#dcfce7':n>=7?'#fef9c3':'#fff7ed';
  const tc=n>=9?'#15803d':n>=7?'#a16207':'#c2410c';
  const bd=n>=9?'#16a34a':n>=7?'#ca8a04':'#ea580c';
  wrap.querySelectorAll('button').forEach(b=>{b.style.borderColor='#e2e8f0';b.style.background='#f8fafc';b.style.color='#94a3b8';b.style.fontWeight='600';});
  btn.style.borderColor=bd; btn.style.background=c; btn.style.color=tc; btn.style.fontWeight='800';
  const inp=document.getElementById('ecal_'+aId);
  if(inp) inp.value=n;
}

async function examenesCapturar(examenId) {
  const ex = _examenesData.find(e=>e.id===examenId);
  if(!ex) return;
  const alumnosDB = await calCargarAlumnosGrupo(ex.grupo_id);
  let calMap = {};
  try {
    const {data:cals} = await sb.from('examenes_calificaciones').select('*').eq('examen_id',examenId);
    (cals||[]).forEach(c=>calMap[c.alumno_id]=c);
  } catch(e){}
  const rows = alumnosDB.map((a,i)=>{
    const prev=calMap[a.id];
    const cv=parseInt(prev?.calificacion)||0;
    const ecPills=[5,6,7,8,9,10].map(n=>{const s=n===cv;const ec=n>=9?'#dcfce7':n>=7?'#fef9c3':'#fff7ed';const etc=n>=9?'#15803d':n>=7?'#a16207':'#c2410c';const ebd=n>=9?'#16a34a':n>=7?'#ca8a04':'#ea580c';return '<button onclick="_ecalSel(\''+a.id+'\','+n+',this)" style="width:26px;height:26px;border-radius:5px;padding:0;cursor:pointer;border:1.5px solid '+(s?ebd:'#e2e8f0')+';background:'+(s?ec:'#f8fafc')+';color:'+(s?etc:'#94a3b8')+';font-family:Sora,sans-serif;font-size:11px;font-weight:'+(s?800:600)+';">'+n+'</button>';}).join('');
    return '<div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;padding:7px 10px;background:'+(i%2?'white':'#f8fafc')+';border-radius:6px;">' +
      '<div style="font-size:13px;font-weight:600;">'+a.n+'</div>' +
      '<div id="ecal_wrap_'+a.id+'" style="display:flex;gap:2px;justify-content:center;">'+ecPills+'<input type="hidden" id="ecal_'+a.id+'" value="'+(prev?.calificacion||'')+'"></div>' +
      '<input type="text" placeholder="Comentario…" value="'+(prev?.comentario||'')+'" id="ecmt_'+a.id+'" style="width:100%;padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:6px;font-family:Sora,sans-serif;font-size:12px;"></div>';
  }).join('');
  const div = document.createElement('div');
  div.id = 'ex-cap-modal';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  const inner = document.createElement('div');
  inner.style.cssText = 'background:white;border-radius:16px;padding:24px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;';
  inner.innerHTML = [
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">',
    '<div><div style="font-family:Fraunces,serif;font-size:18px;font-weight:700;color:#0d5c2f;">'+ex.nombre+'</div>',
    '<div style="font-size:12px;color:#64748b;">'+ex.materia+' · '+ex.grupo_nombre+' · T'+ex.trimestre+' · Valor: '+ex.valor_maximo+' pts</div></div>',
    '<button id="ex-cap-close" style="background:#f1f5f9;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:16px;" aria-label="Cerrar">✕</button></div>',
    '<div style="display:grid;grid-template-columns:1fr 80px 1fr;gap:6px;padding:6px 10px;background:#f0fdf4;border-radius:6px;margin-bottom:8px;">',
    '<div style="font-size:11px;font-weight:700;color:#64748b;">ALUMNO</div>',
    '<div style="font-size:11px;font-weight:700;color:#64748b;text-align:center;">CALIF.</div>',
    '<div style="font-size:11px;font-weight:700;color:#64748b;">COMENTARIO</div></div>',
    '<div style="display:flex;flex-direction:column;gap:3px;">'+rows+'</div>',
    '<div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">',
    '<button id="ex-cap-cancel" style="padding:10px 18px;background:#f1f5f9;border:none;border-radius:8px;font-family:Sora,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Cancelar</button>',
    '<button id="ex-cap-save" style="padding:10px 18px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-family:Sora,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Guardar calificaciones</button>',
    '</div>'
  ].join('');
  div.appendChild(inner);
  document.body.appendChild(div);
  // Attach events after DOM insertion
  document.getElementById('ex-cap-close').onclick   = () => div.remove();
  document.getElementById('ex-cap-cancel').onclick  = () => div.remove();
  document.getElementById('ex-cap-save').onclick    = () => examenesGuardarCalif(examenId);
}

async function examenesGuardarCalif(examenId) {
  const ex = _examenesData.find(e=>e.id===examenId);
  if(!ex) return;
  const alumnosDB = await calCargarAlumnosGrupo(ex.grupo_id);
  const rows=[]; let suma=0,count=0,aprobados=0;
  alumnosDB.forEach(a=>{
    const cal = document.getElementById('ecal_'+a.id)?.value;
    const cmt = document.getElementById('ecmt_'+a.id)?.value.trim()||null;
    if(cal!==''&&cal!==undefined){
      const v=parseFloat(cal);
      rows.push({examen_id:examenId,alumno_id:a.id,grupo_id:ex.grupo_id,docente_id:currentPerfil.id,calificacion:v,comentario:cmt,ciclo:window.CICLO_ACTIVO});
      suma+=v; count++;
      if(v>=(ex.valor_maximo*0.6)) aprobados++;
    }
  });
  try {
    if(rows.length){
      const {error}=await sb.from('examenes_calificaciones').upsert(rows,{onConflict:'examen_id,alumno_id'});
      if(error) throw error;
    }
    const prom=count?Math.round(suma/count*10)/10:null;
    await sb.from('examenes_docente').update({promedio_grupo:prom,total_alumnos:alumnosDB.length,total_aprobados:aprobados}).eq('id',examenId);
    const exIdx=_examenesData.findIndex(e=>e.id===examenId);
    if(exIdx>=0) _examenesData[exIdx]={..._examenesData[exIdx],promedio_grupo:prom,total_alumnos:alumnosDB.length,total_aprobados:aprobados};
    hubToast('✅ '+rows.length+' calificaciones guardadas','ok');
    document.getElementById('ex-cap-modal')?.remove();
    examenesRender(); examenesStats();
    // Auto-notificar reprobados
    const reprobados=rows.filter(r=>r.calificacion<(ex.valor_maximo*0.6));
    if(reprobados.length){
      const nombres=reprobados.map(r=>(alumnosDB.find(a=>a.id===r.alumno_id)?.n||'?')).join(', ');
      try{await sb.from('alertas').insert({tipo:'reprobado_examen',origen:'docente',docente_id:currentPerfil.id,grupo_id:ex.grupo_id,materia:ex.materia,mensaje:'📝 Examen "'+ex.nombre+'" — '+reprobados.length+' alumno(s) reprobaron: '+nombres+'. Promedio: '+(prom||'—'),escuela_cct:currentPerfil.escuela_cct,ciclo:window.CICLO_ACTIVO,leido:false,creado_en:new Date().toISOString()});}
      catch(e2){console.warn('[alertas]',e2.message);}
      // Ofrecer crear recuperaciones
      const reprobadosInfo = reprobados.map(r => ({
        alumno_id: r.alumno_id,
        nombre: alumnosDB.find(a=>a.id===r.alumno_id)?.n || '?',
        calificacion: r.calificacion,
        comentario: r.comentario
      }));
      _mostrarSugerenciaRecuperaciones(ex, reprobadosInfo);
    }
  } catch(e){hubToast('❌ '+e.message,'err');}
}

async function calDetectarRiesgoYNotificar() {
  if(!sb||!currentPerfil) return;
  try {
    const als=window._alumnosActivos||[];
    const mat=calMatActual; const trim=calTrimActual;
    if(!als.length) return;

    const enRiesgo = als.map((_,ai)=>({ ai, alumno: als[ai], prom: calPromPonderado(ai,mat,trim) }))
      .filter(r => r.prom > 0 && r.prom < 6);

    if(!enRiesgo.length) return;

    // Guardar alerta en DB
    const nombres = enRiesgo.map(r => r.alumno?.n || r.alumno?.nombre || '?');
    await sb.from('alertas').insert({
      tipo:'riesgo_academico', origen:'docente',
      docente_id: currentPerfil.id,
      grupo_id:   window._grupoActivo,
      materia:    mat,
      mensaje:    '⚠️ Riesgo en '+mat+' T'+trim+': '+nombres.join(', '),
      escuela_cct: currentPerfil.escuela_cct,
      ciclo: window.CICLO_ACTIVO,
      leido: false, activa: true, creado_en: new Date().toISOString()
    }).catch(()=>{});

    // ── IA genera recomendaciones por cada alumno en riesgo ──
    // Se ejecuta en background, no bloquea al docente
    const resumenRiesgo = enRiesgo.map(r => {
      const aspectos = CAL_ASPECTOS[mat] || [];
      const detalles = aspectos.map((asp,asi) =>
        `${asp.nombre}: ${CAL_DATA[mat]?.[trim]?.[r.ai]?.[asi] ?? '—'}`
      ).join(', ');
      return `${r.alumno?.n || 'Alumno'} (prom ${r.prom.toFixed(1)}): ${detalles}`;
    }).join('\n');

    callAI({
      feature: 'ficha_estrategias',
      prompt: `Soy docente de ${mat} (Trimestre ${trim}). ALUMNOS EN REZAGO (promedio menor a 6):\n${resumenRiesgo}\n\nGenera para CADA alumno listado: 1 estrategia pedagógica diferenciada y concreta + 1 ejercicio específico de nivelación (scaffolding) aplicable esta semana. Formato exacto: "Nombre: [técnica pedagógica] | Ejercicio: [descripción concreta de 15 min] | Verificación: [cómo saber si avanzó]". Anti-rezago: propón actividades progresivas, no remediales punitivas. Contexto mexicano.`,
      system: _nemSys('TAREA: Estrategias pedagógicas diferenciadas, una por alumno, específicas y aplicables esta semana. Incluye: técnica pedagógica + ejercicio concreto + forma de verificar avance. Anti-rezago: si el alumno está muy por debajo, propón actividades de nivelación.'),
      escuela_id: currentPerfil.escuela_cct,
    }).then(texto => {
      if (!texto) return;
      // Mostrar en panel de calificaciones si existe
      let panel = document.getElementById('cal-riesgo-ia-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'cal-riesgo-ia-panel';
        // Insertar debajo del botón de guardar
        const btnGuardar = document.querySelector('[onclick="calGuardar()"]')?.closest('.sec-actions') ||
                           document.getElementById('cal-header-actions');
        if (btnGuardar) btnGuardar.insertAdjacentElement('afterend', panel);
        else {
          const wrap = document.getElementById('cal-graficas-wrap')?.parentElement ||
                       document.getElementById('p-calificaciones');
          if (wrap) wrap.insertAdjacentElement('afterbegin', panel);
        }
      }
      const html = texto.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
      panel.innerHTML = `
        <div style="background:linear-gradient(135deg,#fef9c3,#fef3c7);border:1.5px solid #f59e0b;border-radius:12px;padding:16px;margin:12px 0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="font-size:13px;font-weight:700;color:#92400e;">📋 Recomendaciones — Alumnos en riesgo (${mat} T${trim})</div>
            <button onclick="this.closest('#cal-riesgo-ia-panel').remove()"
              style="background:none;border:none;color:#92400e;cursor:pointer;font-size:16px;opacity:.6;" aria-label="Cerrar">✕</button>
          </div>
          <div style="font-size:12px;color:#78350f;line-height:1.7;">${html}</div>
          <div style="font-size:10px;color:#a16207;margin-top:8px;opacity:.7;">Estas recomendaciones también se enviaron a Trabajo Social como alerta.</div>
        </div>`;
      panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }).catch(()=>{});

  } catch(e){ console.warn('[riesgo]',e.message); }
}

// ══════════════════════════════════════════════════════════════
// MÓDULO: RECUPERACIONES
// ══════════════════════════════════════════════════════════════
let _recuperacionesData = [];

async function recuperacionesInit() {
  const matSel = document.getElementById('recup-filtro-materia');
  if (matSel && window._materiasDocente?.length) {
    matSel.innerHTML = '<option value="">Todas las materias</option>' +
      window._materiasDocente.map(m => `<option value="${m}">${m}</option>`).join('');
  }
  await recuperacionesCargar();
}

async function recuperacionesCargar() {
  if (!sb || !currentPerfil) return;
  try {
    const { data } = await sb.from('recuperaciones')
      .select('*, alumno:alumno_id(id, nombre, apellido_p, apellido_m)')
      .eq('docente_id', currentPerfil.id)
      .eq('ciclo', window.CICLO_ACTIVO || '2025-2026')
      .order('fecha_examen', { ascending: true });
    _recuperacionesData = data || [];
  } catch(e) {
    console.warn('[recuperaciones]', e.message);
    _recuperacionesData = [];
  }
  recuperacionesRender();
  recuperacionesStats();
}

function recuperacionesRender() {
  const el = document.getElementById('recup-lista');
  if (!el) return;
  const filtEstado  = document.getElementById('recup-filtro-estado')?.value || '';
  const filtMateria = document.getElementById('recup-filtro-materia')?.value || '';
  let lista = _recuperacionesData;
  if (filtEstado)  lista = lista.filter(r => r.estado === filtEstado);
  if (filtMateria) lista = lista.filter(r => r.materia === filtMateria);
  if (!lista.length) {
    el.innerHTML = '<div style="text-align:center;padding:48px 20px;color:#94a3b8;"><div style="font-size:40px;margin-bottom:12px;">🔄</div><div style="font-weight:700;color:#0f172a;margin-bottom:6px;">Sin recuperaciones</div><div style="font-size:13px;">No hay recuperaciones con los filtros seleccionados.</div></div>';
    return;
  }
  el.innerHTML = lista.map(r => {
    const a = r.alumno;
    const nombreAlumno = a ? `${a.nombre||''} ${a.apellido_p||''} ${a.apellido_m||''}`.trim() : '—';
    const hoy = new Date().toISOString().split('T')[0];
    const vencido = r.estado === 'pendiente' && r.fecha_examen && r.fecha_examen < hoy;
    const estadoColor = r.estado === 'presentado' ? '#15803d' : r.estado === 'cancelado' ? '#94a3b8' : vencido ? '#dc2626' : '#d97706';
    const estadoLabel = r.estado === 'presentado' ? '✅ Presentado' : r.estado === 'cancelado' ? '🚫 Cancelado' : vencido ? '⚠️ Vencido' : '⏳ Pendiente';
    const calRecup = r.calificacion_recuperacion != null ? `<span style="font-weight:700;color:${r.calificacion_recuperacion>=6?'#15803d':'#dc2626'};">${r.calificacion_recuperacion}</span>` : '—';
    return `<div style="background:white;border-radius:12px;border:1.5px solid #e2e8f0;padding:16px;display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-family:'Fraunces',serif;font-size:15px;font-weight:700;color:#0f172a;">${nombreAlumno}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">${r.materia} · Examen: ${r.fecha_examen ? new Date(r.fecha_examen+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long'}) : 'Sin fecha'}</div>
        </div>
        <span style="padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;background:${estadoColor}20;color:${estadoColor};">${estadoLabel}</span>
      </div>
      <div style="display:flex;gap:16px;font-size:12px;flex-wrap:wrap;">
        <div>Cal. original: <strong style="color:#dc2626;">${r.calificacion_original ?? '—'}</strong></div>
        <div>Cal. recuperación: <strong>${calRecup}</strong></div>
      </div>
      ${r.comentarios_docente ? `<div style="font-size:12px;color:#475569;background:#f8fafc;border-radius:8px;padding:8px 10px;border-left:3px solid #0d5c2f;">📝 ${r.comentarios_docente}</div>` : ''}
      ${r.temas_ia ? `<details style="font-size:12px;"><summary style="cursor:pointer;font-weight:700;color:#7c3aed;">✨ Ver guía de estudio IA</summary><div style="margin-top:8px;padding:10px;background:#faf5ff;border-radius:8px;color:#4c1d95;line-height:1.7;white-space:pre-wrap;">${r.temas_ia}</div></details>` : ''}
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
        ${r.estado === 'pendiente' ? `<button onclick="recuperacionRegistrarResultado('${r.id}')" style="padding:7px 14px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">📝 Registrar resultado</button>` : ''}
        ${r.estado === 'pendiente' ? `<button onclick="recuperacionCancelar('${r.id}')" style="padding:7px 14px;background:#f1f5f9;color:#64748b;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">Cancelar</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function recuperacionesStats() {
  const el = document.getElementById('recup-stats');
  if (!el) return;
  const total     = _recuperacionesData.length;
  const pendiente = _recuperacionesData.filter(r => r.estado === 'pendiente').length;
  const present   = _recuperacionesData.filter(r => r.estado === 'presentado').length;
  const aprobaron = _recuperacionesData.filter(r => r.estado === 'presentado' && (r.calificacion_recuperacion ?? 0) >= 6).length;
  el.innerHTML = [
    ['🔄', total,     'Total',       '#0d5c2f', '#f0fdf4'],
    ['⏳', pendiente, 'Pendientes',  '#d97706', '#fefce8'],
    ['✅', present ? `${aprobaron}/${present}` : '—', 'Aprobaron', '#15803d', '#dcfce7'],
  ].map(([ico,val,lbl,col,bg]) =>
    `<div style="background:${bg};border-radius:12px;padding:14px;text-align:center;border:1.5px solid ${col}30;">
      <div style="font-size:20px;">${ico}</div>
      <div style="font-size:22px;font-weight:900;color:${col};margin:4px 0;">${val}</div>
      <div style="font-size:11px;color:${col};font-weight:700;">${lbl}</div>
    </div>`
  ).join('');
}

// Llamada desde examenesGuardarCalif cuando hay reprobados
function _mostrarSugerenciaRecuperaciones(examen, reprobadosInfo) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  const lista = reprobadosInfo.map(r =>
    `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#fef2f2;border-radius:8px;margin-bottom:6px;">
      <div>
        <span style="font-size:13px;font-weight:700;color:#0f172a;">${r.nombre}</span>
        <span style="font-size:12px;color:#64748b;margin-left:8px;">Cal: <strong style="color:#dc2626;">${r.calificacion}</strong></span>
      </div>
      <button onclick="_recuperacionDesdeExamen('${r.alumno_id}','${r.nombre.replace(/'/g,"\\'")}',${r.calificacion},'${(r.comentario||'').replace(/'/g,"\\'")}','${examen.id}','${examen.materia}',this.closest('[data-recup-modal]'))"
        style="padding:6px 12px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">
        🔄 Crear recuperación
      </button>
    </div>`
  ).join('');
  modal.setAttribute('data-recup-modal','1');
  modal.innerHTML = `<div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div>
        <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;color:#0d5c2f;">🔄 Alumnos reprobados</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">${examen.nombre} · ${examen.materia}</div>
      </div>
      <button onclick="this.closest('[data-recup-modal]').remove()" aria-label="Cerrar" style="background:#f1f5f9;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:16px;">✕</button>
    </div>
    <div style="font-size:13px;color:#475569;margin-bottom:14px;">¿Deseas crear examen de recuperación para alguno de estos alumnos?</div>
    ${lista}
    <button onclick="this.closest('[data-recup-modal]').remove()" style="width:100%;margin-top:12px;padding:10px;background:#f1f5f9;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;cursor:pointer;">Cerrar</button>
  </div>`;
  document.body.appendChild(modal);
}

async function _recuperacionDesdeExamen(alumnoId, alumnoNombre, calOriginal, comentarioOriginal, examenId, materia, modalEl) {
  // Mostrar sub-modal de configurar fecha y comentarios del docente
  recuperacionAbrirModal({
    alumno_id: alumnoId,
    alumno_nombre: alumnoNombre,
    calificacion_original: calOriginal,
    comentarios_previos: comentarioOriginal,
    materia: materia,
    examen_origen_id: examenId
  });
}

function recuperacionNuevaManual() {
  // Crear desde el módulo de Recuperaciones sin examen origen
  recuperacionAbrirModal({ manual: true });
}

function recuperacionAbrirModal(cfg = {}) {
  const modal = document.getElementById('modal-recup-crear');
  if (!modal) return;
  // Mover al body si está dentro de un contenedor que puede estar oculto
  if (modal.parentElement !== document.body) document.body.appendChild(modal);
  const mats = window._materiasDocente?.length ? window._materiasDocente : [];
  const alumnosLista = window._alumnosActivos || alumnos || [];
  const alumnoSelector = cfg.alumno_id ? '' :
    `<div style="margin-bottom:14px;">
      <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-80);display:block;margin-bottom:6px;">Alumno</label>
      <select id="recup-m-alumno" style="width:100%;padding:9px 12px;border:1.5px solid var(--gris-20);border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;">
        <option value="">— Selecciona —</option>
        ${alumnosLista.map(a => `<option value="${a.id}">${a.n || (a.nombre+' '+(a.apellido_p||''))}</option>`).join('')}
      </select>
    </div>`;
  const materiaSelector = cfg.materia ?
    `<input type="hidden" id="recup-m-materia-val" value="${cfg.materia}">
     <div style="margin-bottom:14px;"><label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-80);display:block;margin-bottom:6px;">Materia</label>
     <div style="padding:9px 12px;background:#f8fafc;border:1.5px solid var(--gris-20);border-radius:8px;font-size:13px;font-weight:600;">${cfg.materia}</div></div>` :
    `<div style="margin-bottom:14px;">
      <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-80);display:block;margin-bottom:6px;">Materia</label>
      <select id="recup-m-materia-val" style="width:100%;padding:9px 12px;border:1.5px solid var(--gris-20);border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;">
        <option value="">— Selecciona —</option>${mats.map(m=>`<option value="${m}">${m}</option>`).join('')}
      </select>
    </div>`;
  const hoy = new Date(); hoy.setDate(hoy.getDate()+7);
  const fechaDef = hoy.toISOString().split('T')[0];
  modal.innerHTML = `<div style="background:white;border-radius:16px;width:100%;max-width:580px;overflow:hidden;animation:modalIn .2s ease;margin:auto;">
    <div style="background:linear-gradient(135deg,#0d5c2f,#16a34a);padding:20px 24px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;color:white;">🔄 Nueva recuperación</div>
        <div style="font-size:12px;color:rgba(255,255,255,.8);margin-top:2px;">${cfg.alumno_nombre ? 'Para: '+cfg.alumno_nombre : 'Selecciona alumno y configura la recuperación'}</div>
      </div>
      <button onclick="document.getElementById('modal-recup-crear').style.display='none'" aria-label="Cerrar" style="background:rgba(255,255,255,.2);border:none;color:white;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:16px;">✕</button>
    </div>
    <div style="padding:24px;">
      ${alumnoSelector}
      ${materiaSelector}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
        <div>
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-80);display:block;margin-bottom:6px;">Calificación original</label>
          <input type="number" id="recup-m-cal-orig" min="0" max="10" step="0.5" value="${cfg.calificacion_original ?? ''}" placeholder="Ej: 4.5" style="width:100%;padding:9px 12px;border:1.5px solid var(--gris-20);border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-80);display:block;margin-bottom:6px;">Fecha del examen</label>
          <input type="date" id="recup-m-fecha" value="${fechaDef}" style="width:100%;padding:9px 12px;border:1.5px solid var(--gris-20);border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
        </div>
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-80);display:block;margin-bottom:6px;">Comentarios para el alumno (qué mejorar)</label>
        <textarea id="recup-m-comentarios" rows="3" placeholder="Ej: Repasar fracciones equivalentes, tablas de multiplicar, problemas de división..." style="width:100%;padding:9px 12px;border:1.5px solid var(--gris-20);border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;resize:vertical;">${cfg.comentarios_previos || ''}</textarea>
      </div>
      <button onclick="recuperacionGenerarGuiaIA()" style="width:100%;padding:10px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;border:none;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:10px;">✨ Generar guía de estudio con IA</button>
      <div id="recup-m-guia-wrap" style="display:none;margin-bottom:14px;">
        <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#7c3aed;display:block;margin-bottom:6px;">✨ Guía de estudio generada:</label>
        <div id="recup-m-guia-texto" style="background:#faf5ff;border:1.5px solid #ddd6fe;border-radius:10px;padding:14px;font-size:12px;line-height:1.7;color:#4c1d95;white-space:pre-wrap;max-height:240px;overflow-y:auto;"></div>
      </div>
      <button onclick="recuperacionGuardar()" style="width:100%;padding:12px;background:var(--verde);color:white;border:none;border-radius:10px;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">💾 Guardar recuperación</button>
    </div>
  </div>`;
  modal.style.display = 'flex';
  modal.style.alignItems = 'flex-start';
  modal.style.justifyContent = 'center';
  modal.style.padding = '30px 20px';
  modal.style.overflowY = 'auto';
  // Guardar config en ventana temporal
  window._recupModalCfg = cfg;
}

async function recuperacionGenerarGuiaIA() {
  const materia    = document.getElementById('recup-m-materia-val')?.value || '';
  const comentarios = document.getElementById('recup-m-comentarios')?.value?.trim() || '';
  const calOrig    = document.getElementById('recup-m-cal-orig')?.value || '';
  if (!materia || !comentarios) { hubToast('⚠️ Escribe la materia y los comentarios primero','warn'); return; }
  const guiaWrap   = document.getElementById('recup-m-guia-wrap');
  const guiaTexto  = document.getElementById('recup-m-guia-texto');
  guiaWrap.style.display = 'block';
  guiaTexto.textContent = '⏳ Generando guía de estudio…';
  const cfg = window._recupModalCfg || {};
  try {
    const guia = await callAI({
      feature: 'guia_recuperacion',
      prompt: `Soy docente. El alumno${cfg.alumno_nombre ? ' '+cfg.alumno_nombre : ''} reprobó ${materia} con calificación ${calOrig || 'baja'}. Mis comentarios sobre lo que falló: "${comentarios}". Genera una guía de estudio personalizada para preparar el examen de recuperación. Incluye: 1) Los 3-5 temas prioritarios a estudiar. 2) Un ejercicio práctico específico por cada tema (con instrucciones claras, resoluble en 10-15 min). 3) Recursos sugeridos (tipo de ejercicios, páginas del libro si aplica). 4) Un mensaje motivador al final. Formato claro, dirigido al alumno, lenguaje sencillo y apropiado para nivel básico mexicano.`,
      system: _nemSys('TAREA: Guía de estudio personalizada para recuperación. Formato: temas, ejercicios específicos por tema, recursos, mensaje motivador. Lenguaje claro para alumno de educación básica mexicana.')
    });
    guiaTexto.textContent = guia;
    window._recupGuiaIA = guia;
  } catch(e) {
    guiaTexto.textContent = '❌ No se pudo generar: ' + e.message;
  }
}

async function recuperacionGuardar() {
  const cfg = window._recupModalCfg || {};
  const alumnoId   = cfg.alumno_id || document.getElementById('recup-m-alumno')?.value;
  const materia    = cfg.materia    || document.getElementById('recup-m-materia-val')?.value;
  const calOrig    = parseFloat(document.getElementById('recup-m-cal-orig')?.value) || null;
  const fecha      = document.getElementById('recup-m-fecha')?.value;
  const comentarios = document.getElementById('recup-m-comentarios')?.value?.trim() || null;
  const guiaIA     = window._recupGuiaIA || null;
  if (!alumnoId) { hubToast('⚠️ Selecciona un alumno','warn'); return; }
  if (!materia)  { hubToast('⚠️ Selecciona una materia','warn'); return; }
  if (!fecha)    { hubToast('⚠️ Indica la fecha del examen','warn'); return; }
  try {
    const row = {
      alumno_id: alumnoId,
      docente_id: currentPerfil.id,
      materia,
      calificacion_original: calOrig,
      comentarios_docente: comentarios,
      temas_ia: guiaIA,
      fecha_examen: fecha,
      estado: 'pendiente',
      escuela_cct: currentPerfil.escuela_cct || _getCct(),
      ciclo: window.CICLO_ACTIVO || '2025-2026'
    };
    const { data, error } = await sb.from('recuperaciones').insert(row).select().single();
    if (error) throw error;
    // Notificar al padre e insertar alerta
    const fechaFmt = new Date(fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});
    const alumnoNombre = cfg.alumno_nombre || '—';
    await sb.from('alertas').insert({
      tipo: 'recuperacion_programada',
      origen: 'docente',
      docente_id: currentPerfil.id,
      usuario_id: alumnoId,
      materia,
      mensaje: `📅 Examen de recuperación programado — ${materia} — ${alumnoNombre} — Fecha: ${fechaFmt}`,
      descripcion: comentarios,
      escuela_cct: currentPerfil.escuela_cct || _getCct(),
      ciclo: window.CICLO_ACTIVO || '2025-2026',
      activa: true, leido: false,
      creado_en: new Date().toISOString()
    }).catch(()=>{});
    hubToast('✅ Recuperación guardada y padre notificado','ok');
    document.getElementById('modal-recup-crear').style.display = 'none';
    window._recupGuiaIA = null;
    _recuperacionesData.unshift(data);
    recuperacionesRender();
    recuperacionesStats();
  } catch(e) { hubToast('❌ '+e.message,'err'); }
}

function _recupResSel(n, btn) {
  const pills = document.getElementById('recup-res-pills');
  if (!pills) return;
  const c=n>=9?'#dcfce7':n>=7?'#fef9c3':'#fff7ed';
  const tc=n>=9?'#15803d':n>=7?'#a16207':'#c2410c';
  const bd=n>=9?'#16a34a':n>=7?'#ca8a04':'#ea580c';
  pills.querySelectorAll('button').forEach(b=>{b.style.borderColor='#e2e8f0';b.style.background='#f8fafc';b.style.color='#94a3b8';});
  btn.style.borderColor=bd; btn.style.background=c; btn.style.color=tc;
  const inp=document.getElementById('recup-res-cal');
  if(inp) inp.value=n;
}

async function recuperacionRegistrarResultado(id) {
  const r = _recuperacionesData.find(x => x.id === id);
  if (!r) return;
  const a = r.alumno;
  const nombre = a ? `${a.nombre||''} ${a.apellido_p||''}`.trim() : '?';
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  div.innerHTML = `<div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:420px;">
    <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;color:#0d5c2f;margin-bottom:4px;">📝 Resultado recuperación</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:16px;">${nombre} · ${r.materia} · Cal. original: ${r.calificacion_original ?? '—'}</div>
    <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#475569;display:block;margin-bottom:6px;">Nueva calificación</label>
    <div id="recup-res-pills" style="display:flex;gap:6px;justify-content:center;margin-bottom:14px;flex-wrap:wrap;">
      ${[5,6,7,8,9,10].map(n=>`<button onclick="_recupResSel(${n},this)" style="width:44px;height:44px;border-radius:8px;padding:0;cursor:pointer;border:1.5px solid #e2e8f0;background:#f8fafc;color:#94a3b8;font-family:'Sora',sans-serif;font-size:15px;font-weight:700;">${n}</button>`).join('')}
    </div>
    <input type="hidden" id="recup-res-cal">
    <div style="display:flex;gap:10px;">
      <button onclick="this.closest('div[style*=\"fixed\"]').remove()" style="flex:1;padding:10px;background:#f1f5f9;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;cursor:pointer;">Cancelar</button>
      <button id="recup-res-save" style="flex:2;padding:10px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Guardar resultado</button>
    </div>
  </div>`;
  document.body.appendChild(div);
  div.querySelector('#recup-res-save').onclick = async () => {
    const cal = parseFloat(div.querySelector('#recup-res-cal').value);
    if (isNaN(cal) || cal < 5 || cal > 10) { hubToast('⚠️ Selecciona una calificación (5-10)','warn'); return; }
    try {
      await sb.from('recuperaciones').update({ calificacion_recuperacion: cal, estado: 'presentado' }).eq('id', id);
      const idx = _recuperacionesData.findIndex(x => x.id === id);
      if (idx >= 0) { _recuperacionesData[idx].calificacion_recuperacion = cal; _recuperacionesData[idx].estado = 'presentado'; }
      hubToast(`✅ Resultado registrado: ${cal}`, 'ok');
      div.remove();
      recuperacionesRender();
      recuperacionesStats();
    } catch(e) { hubToast('❌ '+e.message,'err'); }
  };
}

async function recuperacionCancelar(id) {
  if (!confirm('¿Cancelar esta recuperación?')) return;
  try {
    await sb.from('recuperaciones').update({ estado: 'cancelado' }).eq('id', id);
    const idx = _recuperacionesData.findIndex(x => x.id === id);
    if (idx >= 0) _recuperacionesData[idx].estado = 'cancelado';
    hubToast('Recuperación cancelada','ok');
    recuperacionesRender();
    recuperacionesStats();
  } catch(e) { hubToast('❌ '+e.message,'err'); }
}
// ══════════════════════════════════════════════════════════════
// FIN MÓDULO RECUPERACIONES

// ══════════════════════════════════════════════════════════════
// MÓDULO: GUÍAS DE ESTUDIO PARA EXÁMENES (docente)
// ══════════════════════════════════════════════════════════════

function examenAbrirGuia(exId) {
  const ex = _examenesData.find(e => e.id === exId);
  if (!ex) return;
  window._guiaExActual = exId;
  window._guiaIA_texto = null;

  const modal = document.createElement('div');
  modal.id = 'modal-guia-ex';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow-y:auto;';
  modal.innerHTML = `<div style="background:white;border-radius:16px;width:100%;max-width:640px;overflow:hidden;animation:modalIn .2s ease;margin:auto;">
    <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:20px 24px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-family:'Fraunces',serif;font-size:17px;font-weight:700;color:white;">📚 Guía de estudio</div>
        <div style="font-size:12px;color:rgba(255,255,255,.8);margin-top:2px;">${ex.nombre} · ${ex.materia} · T${ex.trimestre}</div>
      </div>
      <button onclick="document.getElementById('modal-guia-ex').remove()" aria-label="Cerrar" style="background:rgba(255,255,255,.2);border:none;color:white;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:15px;">✕</button>
    </div>
    <div style="padding:24px;">

      <!-- Temas a estudiar -->
      <div style="margin-bottom:16px;">
        <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;display:block;margin-bottom:6px;">Temas a estudiar (visible para alumnos y padres)</label>
        <input id="guia-temas" type="text" value="${ex.temas_guia || ''}" placeholder="Ej: Fracciones, tablas de multiplicar, geometría…"
          style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>

      <!-- Opciones de guía -->
      <div style="margin-bottom:16px;">
        <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;display:block;margin-bottom:10px;">Guía de estudio</label>
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
          <button onclick="guiaModo('ia')" id="guia-tab-ia" style="padding:7px 16px;border-radius:99px;border:none;background:#7c3aed;color:white;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✨ Generar con IA</button>
          <button onclick="guiaModo('pdf')" id="guia-tab-pdf" style="padding:7px 16px;border-radius:99px;border:1.5px solid #e2e8f0;background:white;color:#475569;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">📄 Subir PDF</button>
          <button onclick="guiaModo('texto')" id="guia-tab-texto" style="padding:7px 16px;border-radius:99px;border:1.5px solid #e2e8f0;background:white;color:#475569;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✏️ Escribir</button>
        </div>

        <!-- Panel IA -->
        <div id="guia-panel-ia">
          <div style="margin-bottom:10px;">
            <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">¿Qué temas o instrucciones para la IA?</label>
            <textarea id="guia-ia-prompt" rows="3" placeholder="Ej: Genera una guía para 4° grado sobre fracciones equivalentes y suma de fracciones con denominador diferente. Incluye ejemplos prácticos y ejercicios."
              style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;resize:vertical;">${ex.temas_guia || ''}</textarea>
          </div>
          <button onclick="examenGenerarGuiaIA()" style="width:100%;padding:10px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">✨ Generar guía con IA</button>
          <div id="guia-ia-resultado" style="display:none;margin-top:14px;">
            <div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;margin-bottom:6px;">Guía generada:</div>
            <div id="guia-ia-texto" style="background:#faf5ff;border:1.5px solid #ddd6fe;border-radius:10px;padding:14px;font-size:12px;color:#4c1d95;line-height:1.7;white-space:pre-wrap;max-height:280px;overflow-y:auto;"></div>
          </div>
        </div>

        <!-- Panel PDF -->
        <div id="guia-panel-pdf" style="display:none;">
          ${ex.guia_pdf_url ? `<div style="background:#eff6ff;border-radius:8px;padding:10px 14px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:12px;font-weight:700;color:#1e40af;">📄 PDF ya subido</span>
            <a href="${ex.guia_pdf_url}" target="_blank" style="font-size:11px;color:#1e40af;font-weight:700;">Ver →</a>
          </div>` : ''}
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">Selecciona el archivo PDF</label>
          <input type="file" id="guia-pdf-file" accept=".pdf" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;box-sizing:border-box;">
          <div style="font-size:11px;color:#94a3b8;margin-top:6px;">Máximo 10MB. Se sube al almacenamiento de SIEMBRA.</div>
          <div id="guia-pdf-progress" style="display:none;margin-top:10px;font-size:12px;color:#7c3aed;font-weight:600;">⏳ Subiendo…</div>
        </div>

        <!-- Panel Texto -->
        <div id="guia-panel-texto" style="display:none;">
          <textarea id="guia-texto-manual" rows="8" placeholder="Escribe aquí la guía de estudio para los alumnos…"
            style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;resize:vertical;">${ex.guia_ia || ''}</textarea>
        </div>
      </div>

      <!-- Visible toggle -->
      <div style="display:flex;align-items:center;gap:10px;background:#f8fafc;border-radius:10px;padding:12px 14px;margin-bottom:16px;">
        <input type="checkbox" id="guia-visible" ${ex.visible_alumnos ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;accent-color:#0d5c2f;">
        <div>
          <div style="font-size:13px;font-weight:700;color:#0f172a;">Publicar para alumnos y padres</div>
          <div style="font-size:11px;color:#64748b;">Al activarlo, el examen y su guía serán visibles en los portales</div>
        </div>
      </div>

      <button onclick="examenGuardarGuia()" style="width:100%;padding:12px;background:var(--verde);color:white;border:none;border-radius:10px;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">💾 Guardar guía</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function guiaModo(modo) {
  ['ia','pdf','texto'].forEach(m => {
    const panel = document.getElementById('guia-panel-' + m);
    const tab   = document.getElementById('guia-tab-' + m);
    if (!panel || !tab) return;
    if (m === modo) {
      panel.style.display = 'block';
      tab.style.background = '#7c3aed'; tab.style.color = 'white'; tab.style.border = 'none';
    } else {
      panel.style.display = 'none';
      tab.style.background = 'white'; tab.style.color = '#475569'; tab.style.border = '1.5px solid #e2e8f0';
    }
  });
}

async function examenGenerarGuiaIA() {
  const exId = window._guiaExActual;
  const ex   = _examenesData.find(e => e.id === exId);
  const promptExtra = document.getElementById('guia-ia-prompt')?.value?.trim() || '';
  const resDiv  = document.getElementById('guia-ia-resultado');
  const textoEl = document.getElementById('guia-ia-texto');
  if (!resDiv || !textoEl) return;
  resDiv.style.display = 'block';
  textoEl.textContent = '⏳ Generando guía de estudio…';
  const grupoObj = (window._gruposDocente||[]).find(g => g.id === ex?.grupo_id);
  const grado = grupoObj?.grado || '?';
  const nivelLabel = window._nivelActivo === 'primaria' ? 'primaria' : 'secundaria';
  try {
    const guia = await callAI({
      feature: 'guia_examen',
      prompt: `Soy docente de ${ex?.materia || 'una materia'} para ${grado}° grado de ${nivelLabel}. El examen se llama "${ex?.nombre}" (Trimestre ${ex?.trimestre}). ${promptExtra ? 'Instrucciones adicionales: ' + promptExtra : ''}\n\nGenera una guía de estudio completa para que los alumnos se preparen. Incluye: 1) Los temas más importantes a repasar (lista concreta). 2) Un ejercicio práctico por cada tema principal (con instrucciones claras). 3) Consejos de estudio específicos para este examen. 4) Un mensaje de motivación al final. Lenguaje claro y directo para alumnos de ${grado}° de ${nivelLabel} mexicana.`,
      system: _nemSys('TAREA: Guía de estudio completa para examen. Formato: temas numerados, ejercicios con instrucciones, consejos y mensaje motivador. Lenguaje apropiado para el grado indicado.')
    });
    textoEl.textContent = guia;
    window._guiaIA_texto = guia;
  } catch(e) {
    textoEl.textContent = '❌ Error: ' + e.message;
  }
}

async function examenGuardarGuia() {
  const exId = window._guiaExActual;
  const ex   = _examenesData.find(e => e.id === exId);
  if (!ex) return;

  const temas   = document.getElementById('guia-temas')?.value?.trim() || null;
  const visible = document.getElementById('guia-visible')?.checked ?? false;

  // Determinar qué guía guardar
  const panelIA     = document.getElementById('guia-panel-ia');
  const panelPDF    = document.getElementById('guia-panel-pdf');
  const panelTexto  = document.getElementById('guia-panel-texto');
  const modoActivo  = panelIA?.style.display !== 'none' ? 'ia'
                    : panelPDF?.style.display !== 'none' ? 'pdf' : 'texto';

  let guia_ia  = ex.guia_ia  || null;
  let guia_pdf = ex.guia_pdf_url || null;

  if (modoActivo === 'ia') {
    guia_ia = window._guiaIA_texto || document.getElementById('guia-ia-texto')?.textContent || guia_ia;
  } else if (modoActivo === 'texto') {
    guia_ia = document.getElementById('guia-texto-manual')?.value?.trim() || guia_ia;
  } else if (modoActivo === 'pdf') {
    const file = document.getElementById('guia-pdf-file')?.files?.[0];
    if (file) {
      const prog = document.getElementById('guia-pdf-progress');
      if (prog) prog.style.display = 'block';
      try {
        const path = `guias/${exId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
        const { data: upData, error: upErr } = await sb.storage.from('guias-examenes').upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = sb.storage.from('guias-examenes').getPublicUrl(path);
        guia_pdf = urlData?.publicUrl || null;
      } catch(e) {
        hubToast('❌ Error al subir PDF: ' + e.message, 'err');
        if (prog) prog.style.display = 'none';
        return;
      }
    }
  }

  try {
    const update = { temas_guia: temas, guia_ia, guia_pdf_url: guia_pdf, visible_alumnos: visible };
    const { error } = await sb.from('examenes_docente').update(update).eq('id', exId);
    if (error) throw error;
    // Update local data
    const idx = _examenesData.findIndex(e => e.id === exId);
    if (idx >= 0) _examenesData[idx] = { ..._examenesData[idx], ...update };
    hubToast('✅ Guía guardada' + (visible ? ' y publicada' : ''), 'ok');
    document.getElementById('modal-guia-ex')?.remove();
    examenesRender();
    // Enviar notificación si se publicó con guía
    if (visible && (guia_ia || guia_pdf)) {
      const exActualizado = _examenesData[idx >= 0 ? idx : _examenesData.findIndex(e => e.id === exId)];
      if (exActualizado) _examenCrearNotificaciones(exActualizado, 'guia_disponible').catch(() => {});
    } else if (visible) {
      const exActualizado = _examenesData[idx >= 0 ? idx : _examenesData.findIndex(e => e.id === exId)];
      if (exActualizado && !exActualizado.notificado) _examenCrearNotificaciones(exActualizado, 'examen_proximo').catch(() => {});
    }
  } catch(e) { hubToast('❌ ' + e.message, 'err'); }
}

async function examenToggleVisible(exId, nuevoValor) {
  try {
    await sb.from('examenes_docente').update({ visible_alumnos: nuevoValor }).eq('id', exId);
    const idx = _examenesData.findIndex(e => e.id === exId);
    if (idx >= 0) _examenesData[idx].visible_alumnos = nuevoValor;
    hubToast(nuevoValor ? '👁 Publicado para alumnos y padres' : '🔒 Ocultado', 'ok');
    // Enviar notificaciones in-app si se está publicando
    if (nuevoValor) {
      const ex = _examenesData[idx >= 0 ? idx : _examenesData.findIndex(e => e.id === exId)];
      if (ex) _examenCrearNotificaciones(ex, 'examen_proximo').catch(() => {});
    }
    examenesRender();
  } catch(e) { hubToast('❌ ' + e.message, 'err'); }
}

// ── Notificaciones automáticas al publicar un examen ─────────────────
// Crea una notificación para cada alumno del grupo y sus padres vinculados.
async function _examenCrearNotificaciones(ex, tipo) {
  if (!sb || !ex?.grupo_id) return;

  // Evitar duplicados: marcar el examen como notificado
  const ya = _examenesData.find(e => e.id === ex.id);
  if (ya?.notificado && tipo === 'examen_proximo') return;

  try {
    // Obtener alumnos del grupo
    const { data: alGrupos } = await sb.from('alumnos_grupos')
      .select('alumno_id, usuarios!alumno_id(id, nombre, codigo_vinculacion)')
      .eq('grupo_id', ex.grupo_id)
      .eq('activo', true);

    if (!alGrupos?.length) return;

    const alumnoIds = alGrupos.map(ag => ag.alumno_id).filter(Boolean);

    // Obtener padres vinculados (por codigo_vinculacion)
    const codigos = alGrupos
      .map(ag => ag.usuarios?.codigo_vinculacion)
      .filter(Boolean);

    let padreIds = [];
    if (codigos.length) {
      const { data: padres } = await sb.from('usuarios')
        .select('id')
        .in('codigo_vinculacion', codigos)
        .eq('rol', 'padre')
        .eq('activo', true);
      padreIds = (padres || []).map(p => p.id);
    }

    const fechaTexto = ex.fecha_aplicacion
      ? new Date(ex.fecha_aplicacion + 'T12:00:00').toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' })
      : 'fecha por confirmar';

    const notificaciones = [];

    // Para alumnos
    const tituloAlumno = tipo === 'guia_disponible'
      ? `📚 Guía de estudio disponible: ${ex.nombre}`
      : `📝 Próximo examen: ${ex.nombre}`;
    const cuerpoAlumno = tipo === 'guia_disponible'
      ? `Tu docente subió la guía de estudio para "${ex.nombre}" (${ex.materia}). ¡Revísala y prepárate!`
      : `Examen de ${ex.materia} el ${fechaTexto}.${ex.temas_guia ? ' Temas: ' + ex.temas_guia : ''} Revisa la guía de estudio en tu portal.`;

    alumnoIds.forEach(uid => {
      notificaciones.push({
        usuario_id: uid,
        tipo,
        titulo: tituloAlumno,
        cuerpo: cuerpoAlumno,
        icono: tipo === 'guia_disponible' ? '📚' : '📝',
        ref_tipo: 'examen',
        ref_id: ex.id,
        escuela_cct: ex.escuela_cct || currentPerfil?.escuela_cct,
      });
    });

    // Para padres
    const tituloPadre = tipo === 'guia_disponible'
      ? `📚 Guía de estudio: ${ex.nombre}`
      : `📅 Examen próximo: ${ex.nombre}`;
    const cuerpoPadre = tipo === 'guia_disponible'
      ? `El docente publicó la guía de estudio para el examen "${ex.nombre}" de ${ex.materia}. Apoya a tu hij@ a repasar.`
      : `Su hij@ tiene examen de ${ex.materia} el ${fechaTexto}.${ex.temas_guia ? ' Temas: ' + ex.temas_guia : ''} Hay una guía de estudio disponible en el portal.`;

    padreIds.forEach(uid => {
      notificaciones.push({
        usuario_id: uid,
        tipo,
        titulo: tituloPadre,
        cuerpo: cuerpoPadre,
        icono: tipo === 'guia_disponible' ? '📚' : '📅',
        ref_tipo: 'examen',
        ref_id: ex.id,
        escuela_cct: ex.escuela_cct || currentPerfil?.escuela_cct,
      });
    });

    if (notificaciones.length) {
      await sb.from('notificaciones').insert(notificaciones);
      // Marcar como notificado
      await sb.from('examenes_docente').update({ notificado: true }).eq('id', ex.id);
      const idx = _examenesData.findIndex(e => e.id === ex.id);
      if (idx >= 0) _examenesData[idx].notificado = true;
      console.log('[examenes] Notificaciones enviadas:', notificaciones.length);
    }
  } catch(e) {
    console.warn('[examenes] notificaciones:', e.message);
  }
}
// ══════════════════════════════════════════════════════════════
// FIN MÓDULO GUÍAS DE ESTUDIO
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════

function calExportar() {
  const mat  = calMatActual;
  const trim = calTrimActual;
  const als  = window._alumnosActivos || alumnos;
  if (!als.length) { hubToast('⚠️ Sin alumnos para exportar', 'warn'); return; }

  const aspectos = CAL_ASPECTOS[mat] || [];
  const headers  = ['No.', 'Nombre', ...aspectos.map(a => a.nombre), 'Promedio'];
  const rows     = als.map((a, ai) => {
    const asps = aspectos.map((_, asi) => {
      const val = CAL_DATA[mat]?.[trim]?.[ai]?.[asi];
      return val !== undefined && val !== null ? val : '';
    });
    const prom = calPromPonderado(ai, mat, trim);
    return [ai + 1, a.n || a.nombre || '—', ...asps, prom.toFixed(1)];
  });

  const csvLines = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvLines], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `SIEMBRA_${mat.replace(/ /g,'_')}_T${trim}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  hubToast('✅ CSV exportado correctamente', 'ok');
}

// ── Gráficas ──
function calVerGraficas() {
  const wrap = document.getElementById('cal-graficas-wrap');
  if (wrap.style.display !== 'none') { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  document.getElementById('cal-graf-titulo').textContent = `${calMatActual} · T${calTrimActual}`;

  // Barras por alumno
  const barras = document.getElementById('cal-graf-barras');
  const datos  = alumnos.map((a,ai) => ({ n: a.n, p: calPromPonderado(ai, calMatActual, calTrimActual) }));
  const maxVal = 10;
  barras.innerHTML = datos.map(d => `
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:110px;font-size:12px;color:var(--gris-50);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.n.split(' ')[0]}</div>
      <div style="flex:1;height:20px;background:var(--gris-10);border-radius:99px;overflow:hidden;">
        <div style="height:100%;width:${(d.p/maxVal)*100}%;background:${calColor(d.p)};border-radius:99px;transition:.4s;"></div>
      </div>
      <div style="width:36px;font-size:13px;font-weight:700;color:${calColor(d.p)};">${d.p.toFixed(1)}</div>
    </div>`).join('');

  // Promedio por aspecto
  const aspectos = CAL_ASPECTOS[calMatActual] || [];
  const grafAsp  = document.getElementById('cal-graf-aspectos');
  grafAsp.innerHTML = aspectos.map((asp, asi) => {
    const avg = alumnos.reduce((s,_,ai) => s + (CAL_DATA[calMatActual]?.[calTrimActual]?.[ai]?.[asi] || 7), 0) / alumnos.length;
    const pct = ((avg - 5) / 5) * 100;
    return `
      <div style="flex:1;min-width:100px;background:var(--crema);border-radius:12px;padding:14px;text-align:center;border:1px solid var(--gris-20);">
        <div style="font-size:11px;color:var(--gris-50);margin-bottom:8px;font-weight:700;">${asp.nombre}</div>
        <div style="font-size:11px;color:var(--gris-50);margin-bottom:8px;">${asp.pct}%</div>
        <div style="width:100%;height:8px;background:var(--gris-20);border-radius:99px;overflow:hidden;margin-bottom:8px;">
          <div style="height:100%;width:${pct}%;background:${calColor(avg)};border-radius:99px;"></div>
        </div>
        <div style="font-size:18px;font-weight:800;color:${calColor(avg)};">${avg.toFixed(1)}</div>
      </div>`;
  }).join('');

  wrap.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

// ── Reporte IA ──
async function calVerReporte() {
  const wrap = document.getElementById('cal-reporte-wrap');
  if (wrap.style.display !== 'none') { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  document.getElementById('cal-rep-titulo').textContent = `${calMatActual} · Trimestre ${calTrimActual}`;

  const textEl = document.getElementById('cal-rep-texto');
  textEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><div style="width:20px;height:20px;border:2px solid rgba(255,255,255,.4);border-top-color:white;border-radius:50%;animation:spin .8s linear infinite;"></div> Generando análisis…</div>';

  const aspectos = CAL_ASPECTOS[calMatActual] || [];
  const promedios = alumnos.map((a,ai) => ({
    nombre: a.n,
    prom: calPromPonderado(ai, calMatActual, calTrimActual),
    aspectos: aspectos.map((asp,asi) => `${asp.nombre}: ${CAL_DATA[calMatActual]?.[calTrimActual]?.[ai]?.[asi] || 7}`)
  }));
  const promGrupo = (promedios.reduce((s,p)=>s+p.prom,0)/promedios.length).toFixed(1);
  const enAtencion = promedios.filter(p=>p.prom<6).map(p=>p.nombre);

  const detalleAlumnos = promedios.map(p =>
    `  • ${p.nombre}: promedio ${p.prom.toFixed(1)} [${p.aspectos.join(' | ')}]`
  ).join('\n');
  const mejorAspecto = aspectos.length ? aspectos.reduce((best, asp, asi) => {
    const avg = alumnos.reduce((s,_,ai)=>s+(CAL_DATA[calMatActual]?.[calTrimActual]?.[ai]?.[asi]||7),0)/alumnos.length;
    return avg > (best.avg||0) ? {nombre:asp.nombre,avg} : best;
  }, {}).nombre || '—' : '—';
  const peorAspecto = aspectos.length ? aspectos.reduce((worst, asp, asi) => {
    const avg = alumnos.reduce((s,_,ai)=>s+(CAL_DATA[calMatActual]?.[calTrimActual]?.[ai]?.[asi]||7),0)/alumnos.length;
    return avg < (worst.avg||11) ? {nombre:asp.nombre,avg} : worst;
  }, {avg:11}).nombre || '—' : '—';
  const aprobados = promedios.filter(p=>p.prom>=6).length;
  const prompt = `Eres un asesor pedagógico experto en la Nueva Escuela Mexicana (NEM) de México, Acuerdo SEP 09/08/23.
Genera un análisis DETALLADO y ACCIONABLE del grupo en ${calMatActual}, Trimestre ${calTrimActual}.

DATOS DEL GRUPO:
- Total alumnos: ${promedios.length} | Aprobados: ${aprobados} | En atención (< 6): ${enAtencion.length}
- Promedio grupal: ${promGrupo}/10
- Aspecto con mayor fortaleza: ${mejorAspecto}
- Aspecto con mayor área de oportunidad: ${peorAspecto}
- Alumnos que requieren atención especial: ${enAtencion.join(', ') || 'ninguno'}

CALIFICACIONES POR ALUMNO Y ASPECTO:
${detalleAlumnos}

ESTRUCTURA DEL REPORTE (máximo 250 palabras):
1. **Diagnóstico grupal**: ¿Cómo está el grupo en general? ¿Hay polarización o distribución homogénea?
2. **Fortalezas identificadas**: ¿En qué aspecto destacan más? ¿Qué están logrando bien?
3. **Alumnos prioritarios**: Nombra específicamente a los alumnos en atención y qué necesitan.
4. **Áreas de oportunidad**: ¿Qué aspecto está más débil y por qué puede estar ocurriendo?
5. **2 estrategias pedagógicas NEM concretas**: Acciones específicas y realizables para la siguiente semana (aprendizaje colaborativo, diferenciación, retroalimentación formativa, etc.)
6. **Meta trimestral sugerida**: Un objetivo medible para el siguiente período.

IMPORTANTE: Usa lenguaje pedagógico orientativo, no clínico. Nombres reales de alumnos para hacerlo personalizado. Responde en español.`;

  try {
    textEl.textContent = await callAI({
      feature: 'cal_reporte',
      prompt,
      context: { materia: calMatActual, trimestre: calTrimActual, promGrupo, enAtencion },
      system: _nemSys('Eres asesor pedagógico NEM de alto nivel. Genera análisis DETALLADO con: diagnóstico grupal, alumnos prioritarios nominados, aspecto más débil, 2 estrategias pedagógicas concretas y realizables, y meta trimestral. Usa datos específicos. Lenguaje profesional orientativo, nunca clínico. Máximo 250 palabras en español.'),
    });
  } catch(e) {
    textEl.textContent = `El grupo de ${calMatActual} tiene un promedio de ${promGrupo}/10 en el Trimestre ${calTrimActual}. ${enAtencion.length>0?`Los alumnos ${enAtencion.join(' y ')} requieren atención especial.`:''} Se recomienda reforzar actividades diferenciadas para consolidar los aprendizajes clave del campo formativo.`;
  }
  wrap.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

// ── Recomendaciones IA por alumno individual ──────────────────────────
async function calRecomendacionesPorAlumno() {
  const wrap = document.getElementById('cal-recom-individual-wrap');
  if (!wrap) return;
  wrap.style.display = 'block';
  wrap.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:16px;background:#f0fdf4;border-radius:10px;font-size:13px;color:#0d5c2f;">
    <span style="display:inline-block;width:14px;height:14px;border:2px solid #86efac;border-top-color:#0d5c2f;border-radius:50%;animation:spin .8s linear infinite;"></span>
    Generando recomendaciones individuales…
  </div>`;

  const mat  = calMatActual;
  const trim = calTrimActual;
  const als  = window._alumnosActivos || alumnos;
  if (!als.length) { wrap.innerHTML = ''; wrap.style.display = 'none'; return; }

  const datos = als.map((a, ai) => {
    const prom = calPromPonderado(ai, mat, trim);
    const aspectos = CAL_ASPECTOS[mat] || [];
    const detalles = aspectos.map((asp,asi) => `${asp.nombre}: ${CAL_DATA[mat]?.[trim]?.[ai]?.[asi] ?? '—'}`).join(', ');
    return `${a.n||a.nombre} (${prom.toFixed(1)}): ${detalles}`;
  }).join('\n');

  const promGrupo = (als.map((_,ai)=>calPromPonderado(ai,mat,trim)).reduce((s,p)=>s+p,0)/als.length).toFixed(1);

  try {
    const texto = await callAI({
      feature: 'ficha_estrategias',
      prompt: `Soy docente de ${mat} Trimestre ${trim}. Promedio grupal: ${promGrupo}.\n\nDesempeño individual por alumno:\n${datos}\n\nGenera para CADA alumno una recomendación pedagógica PERSONALIZADA (no genérica). Prioridad: alumnos con promedio menor a 7 (posible rezago). Formato exacto por alumno:\n[Nombre] (prom [X]): [técnica pedagógica específica NEM] | Ejercicio sugerido esta semana: [descripción concreta 15 min] | Eje articulador NEM relacionado: [eje]\n\nNunca uses diagnósticos clínicos. Lenguaje motivador. Contexto mexicano.`,
      system: _nemSys('TAREA: Estrategias pedagógicas diferenciadas, una por alumno, específicas y aplicables esta semana. Incluye: técnica pedagógica + ejercicio concreto + forma de verificar avance. Anti-rezago: si el alumno está muy por debajo, propón actividades de nivelación.'),
      escuela_id: currentPerfil?.escuela_cct,
    });

    const html = texto
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/^(.+?):/gm,'<strong>$1</strong>:')
      .replace(/\n/g,'<br>');

    wrap.innerHTML = `
      <div style="background:white;border-radius:12px;border:1.5px solid #e2e8f0;padding:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="font-size:14px;font-weight:700;color:#0f172a;">👤 Recomendaciones IA por alumno · ${mat} T${trim}</div>
          <div style="display:flex;gap:8px;">
            <button onclick="navigator.clipboard.writeText(document.getElementById('cal-recom-texto').innerText);hubToast('✅ Copiado','ok')"
              style="padding:5px 10px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:7px;font-size:11px;font-weight:700;color:#475569;cursor:pointer;font-family:'Sora',sans-serif;">📋 Copiar</button>
            <button onclick="document.getElementById('cal-recom-individual-wrap').style.display='none'"
              style="padding:5px 10px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:7px;font-size:11px;color:#94a3b8;cursor:pointer;" aria-label="Cerrar">✕</button>
          </div>
        </div>
        <div id="cal-recom-texto" style="font-size:13px;color:#334155;line-height:1.9;">${html}</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:12px;padding-top:10px;border-top:1px solid #f1f5f9;">
          ⚖️ Orientativo · NEM 2026 · No constituye diagnóstico profesional
        </div>
      </div>`;
    wrap.scrollIntoView({ behavior:'smooth', block:'nearest' });
  } catch(e) {
    wrap.innerHTML = `<div style="background:#fef2f2;border-radius:10px;padding:14px;color:#dc2626;font-size:13px;">❌ ${e.message}</div>`;
  }
}
window.calRecomendacionesPorAlumno = calRecomendacionesPorAlumno;

// ══ CONFIGURACIÓN DE ASPECTOS ══
function calAbrirConfigAspectos() {
  const ov = document.getElementById('modal-aspectos-ov');
  ov.style.display = 'flex';
  // Poblar selector de materias — solo materias específicas (sin campos formativos)
  const sel = document.getElementById('cfg-mat-sel');
  const CAMPOS_FORM = [
    'Lenguajes','Saberes y Pensamiento Científico','Ética, Naturaleza y Sociedades',
    'De lo Humano y lo Comunitario','Pensamiento Matemático',
    'Exploración de la Naturaleza y la Sociedad','Desarrollo Personal y Social','Conocimiento del Medio',
  ];
  const raw = window._materiasDocente?.length ? window._materiasDocente : Array.from(MATERIAS_NEM);
  const _mats = raw.filter(m => !CAMPOS_FORM.includes(m));
  const final = _mats.length ? _mats : Array.from(MATERIAS_NEM).filter(m => !CAMPOS_FORM.includes(m));
  sel.innerHTML = final.map(m => `<option value="${m}" ${m===calMatActual?'selected':''}>${m}</option>`).join('');
  calCargarConfigMateria(calMatActual || final[0] || '');
}

function calCerrarConfig() {
  document.getElementById('modal-aspectos-ov').style.display = 'none';
}

function calCargarConfigMateria(mat) {
  document.getElementById('cfg-mat-nombre').textContent = mat;
  const aspectos = CAL_ASPECTOS[mat] || ASPECTOS_DEFAULT.map(a=>({...a}));
  calRenderAspectosList(mat, aspectos);
}

function calRenderAspectosList(mat, aspectos) {
  const lista = document.getElementById('cfg-aspectos-lista');
  lista.innerHTML = aspectos.map((a, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid var(--gris-20);border-radius:10px;margin-bottom:8px;background:var(--crema);">
      <div style="flex:1;">
        <input type="text" value="${a.nombre}" placeholder="Nombre del aspecto"
          style="width:100%;border:none;background:transparent;font-family:'Sora',sans-serif;font-size:13px;font-weight:600;outline:none;"
          onchange="calUpdateAspectoNombre('${mat}',${i},this.value)">
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <input type="number" min="0" max="100" step="5" value="${a.pct}"
          style="width:60px;padding:6px 8px;border:1.5px solid var(--gris-20);border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;text-align:center;outline:none;"
          onchange="calUpdateAspectoPct('${mat}',${i},this.value)">
        <span style="font-size:13px;color:var(--gris-50);">%</span>
        <button onclick="calEliminarAspecto('${mat}',${i})" 
          style="width:28px;height:28px;border:none;background:var(--rojo-light);color:var(--rojo);border-radius:6px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;" aria-label="Cerrar">✕</button>
      </div>
    </div>`).join('');
  calActualizarSuma(mat);
}

function calUpdateAspectoNombre(mat, i, val) {
  if (!CAL_ASPECTOS[mat]) CAL_ASPECTOS[mat] = ASPECTOS_DEFAULT.map(a=>({...a}));
  CAL_ASPECTOS[mat][i].nombre = val;
}
function calUpdateAspectoPct(mat, i, val) {
  if (!CAL_ASPECTOS[mat]) CAL_ASPECTOS[mat] = ASPECTOS_DEFAULT.map(a=>({...a}));
  CAL_ASPECTOS[mat][i].pct = parseInt(val)||0;
  calActualizarSuma(mat);
}
function calEliminarAspecto(mat, i) {
  if (!CAL_ASPECTOS[mat]) return;
  if (CAL_ASPECTOS[mat].length <= 1) { hubToast('⚠️ Debe haber al menos un aspecto','warn'); return; }
  CAL_ASPECTOS[mat].splice(i, 1);
  calRenderAspectosList(mat, CAL_ASPECTOS[mat]);
}
function calAgregarAspecto() {
  const mat = document.getElementById('cfg-mat-sel').value;
  if (!CAL_ASPECTOS[mat]) CAL_ASPECTOS[mat] = ASPECTOS_DEFAULT.map(a=>({...a}));
  CAL_ASPECTOS[mat].push({ nombre: 'Nuevo aspecto', pct: 0 });
  calRenderAspectosList(mat, CAL_ASPECTOS[mat]);
}
function calActualizarSuma(mat) {
  const suma = (CAL_ASPECTOS[mat]||[]).reduce((s,a)=>s+a.pct,0);
  const el   = document.getElementById('cfg-suma-val');
  const row  = document.getElementById('cfg-suma-row');
  if (el)  el.textContent = suma + '%';
  if (row) row.style.background = suma === 100 ? '#dcfce7' : suma > 100 ? '#fee2e2' : '#fef9c3';
}
function calGuardarConfig() {
  const mat   = document.getElementById('cfg-mat-sel').value;
  const suma  = (CAL_ASPECTOS[mat]||[]).reduce((s,a)=>s+a.pct,0);
  if (suma !== 100) {
    hubToast(`⚠️ Los porcentajes de ${mat} suman ${suma}%. Deben sumar exactamente 100%.`, 'warn');
    return;
  }
  calCerrarConfig();
  calRenderTabla();
  calRenderStats();
  hubToast('✅ Aspectos de ' + mat + ' guardados correctamente', 'ok');
}


// ══════════════════════════════════════════════════════════
//  MÓDULO FICHAS DESCRIPTIVAS — v8
// ══════════════════════════════════════════════════════════

const COLORES_AVATARES = ['#3b7be8','#7c3aed','#059669','#d97706','#db2777','#0891b2','#dc2626','#65a30d','#0d5c2f','#9333ea','#ea580c','#0e7490'];

// Base de datos de fichas (por alumno index)
let FICHAS_DATA = {};
let fichaAlumnoActual = null;

const ESTILOS_APZ = [
  { id:'visual',    ico:'👁️', txt:'Visual',    sub:'Aprende con imágenes, diagramas, colores' },
  { id:'auditivo',  ico:'👂', txt:'Auditivo',   sub:'Aprende escuchando explicaciones y música' },
  { id:'kinestesico',ico:'✋',txt:'Kinestésico', sub:'Aprende haciendo, manipulando, moviéndose' },
  { id:'lector',    ico:'📖', txt:'Lector',     sub:'Aprende leyendo y escribiendo' },
];
const RITMOS = [
  { id:'rapido',   ico:'⚡', lbl:'Rápido — avanza por encima del grupo' },
  { id:'normal',   ico:'✅', lbl:'Regular — sigue el ritmo del grupo' },
  { id:'pausado',  ico:'🐢', lbl:'Pausado — necesita más tiempo' },
  { id:'irregular',ico:'📈', lbl:'Irregular — varía según la materia' },
];
const APOYOS = ['NEE','TDAH','Dislexia','Discalculia','Visual','Auditivo','Superdotado','Bilingüe','Tutoría'];
const INDICADORES = [
  'Se distrae con facilidad',
  'Molesta a compañeros',
  'Agresividad verbal o física',
  'Timidez extrema',
  'Dificultad para seguir instrucciones',
  'Llega sin desayunar',
  'Apoyo familiar insuficiente',
];

function fichaInit() {
  // Inicializar fichas vacías para todos los alumnos
  alumnos.forEach((a, i) => {
    if (!FICHAS_DATA[i]) {
      FICHAS_DATA[i] = {
        nombre: a.n, curp: '', nacimiento: '', num: i+1,
        tutor: '', parentesco: 'Madre', tel: '', emailTutor: '',
        conducta: 'Buena', participacion: 'Activo/a', relacion: 'Muy sociable',
        responsabilidad: 'Casi siempre',
        fortalezas: '', dificultades: '', oportunidades: '',
        estilos: ['visual'], ritmo: 'normal', apoyos: [],
        indicadores: {},
        observaciones: [],
        reportes: [],
      };
    }
  });
  fichaRenderLista('');
}

function fichaRenderLista(filtro) {
  const cont = document.getElementById('fichas-lista-alumnos');
  if (!cont) return;
  const ff = filtro.toLowerCase();
  const items = alumnos.map((a, i) => ({a, i})).filter(({a}) => a.n.toLowerCase().includes(ff));
  cont.innerHTML = items.map(({a, i}) => {
    const prom = typeof calPromPonderado === 'function' && CAL_DATA && Object.keys(CAL_DATA).length
      ? (MATERIAS_NEM.reduce((s,m) => s + calPromPonderado(i,m,1), 0) / MATERIAS_NEM.length)
      : (a.cals.reduce((s,c)=>s+c,0)/a.cals.length);
    const niv = calNivel ? calNivel(prom) : 'B';
    const col = COLORES_AVATARES[i % COLORES_AVATARES.length];
    const inis = a.n.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
    const nColor = niv==='A'?'#15803d':niv==='B'?'#1d4ed8':niv==='C'?'#a16207':'#b91c1c';
    const nBg    = niv==='A'?'#dcfce7':niv==='B'?'#dbeafe':niv==='C'?'#fef9c3':'#fee2e2';
    return `<div class="ficha-alumno-item ${fichaAlumnoActual===i?'active':''}" onclick="fichaSeleccionar(${i})">
      <div class="ficha-alumno-av" style="background:${col};">${inis}</div>
      <div style="flex:1;min-width:0;">
        <div class="ficha-alumno-nombre">${a.n}</div>
        <div style="font-size:11px;color:var(--gris-50);">Núm. ${i+1}</div>
      </div>
      <span class="ficha-alumno-nivel" style="background:${nBg};color:${nColor};">${niv} · ${prom.toFixed(1)}</span>
    </div>`;
  }).join('') || '<div style="padding:20px;text-align:center;color:var(--gris-50);font-size:13px;">Sin resultados</div>';
}

function fichaFiltrar(v) { fichaRenderLista(v); }

function fichaSeleccionar(idx) {
  fichaAlumnoActual = idx;
  fichaRenderLista(document.querySelector('#p-fichas input[type="text"]')?.value || '');
  fichaCargarDatos(idx);
  document.getElementById('fichas-empty').style.display = 'none';
  document.getElementById('fichas-contenido').style.display = 'block';
  fichaTab('perfil', document.querySelector('#p-fichas .tab-btn'));
  // ── IA automática al abrir ficha ──────────────────────────────
  // Espera 800ms para no interferir con el render de la ficha
  setTimeout(() => {
    const analisisEl = document.getElementById('fd-analisis-empty');
    const loadingEl  = document.getElementById('fd-analisis-loading');
    // Solo dispara si el análisis no se ha generado aún
    if (analisisEl && analisisEl.style.display !== 'none' && typeof fichaAnalisisIAGenerar === 'function') {
      fichaAnalisisIAGenerar();
    }
  }, 800);
}

function fichaCargarDatos(idx) {
  const fd = FICHAS_DATA[idx];
  const a  = alumnos[idx];
  const col = COLORES_AVATARES[idx % COLORES_AVATARES.length];
  const inis = a.n.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();

  // Cabecera
  document.getElementById('ficha-avatar-grande').textContent = inis;
  document.getElementById('ficha-avatar-grande').style.background = col;
  document.getElementById('ficha-nombre-h').textContent = a.n;

  // Asistencia
  const pres = alumnos.filter((_,i)=>i===idx?a.as==='P':false).length;
  const totalDias = 80; // días del trimestre demo
  const ausDemo = Math.floor(Math.random()*3);
  const tardDemo = Math.floor(Math.random()*2);
  const presDemo = totalDias - ausDemo - tardDemo;
  const pctAs = Math.round(presDemo/totalDias*100);
  setEl('ficha-pct-asist', pctAs+'%');
  setEl('fd-as-pres', presDemo);
  setEl('fd-as-aus', ausDemo);
  setEl('fd-as-tard', tardDemo);
  setEl('fd-as-pct', pctAs+'%');
  const bar = document.getElementById('fd-as-bar');
  if (bar) { bar.style.width = pctAs+'%'; bar.style.background = pctAs>=90?'#22c55e':pctAs>=75?'#eab308':'#ef4444'; }

  // Promedio
  const prom = typeof calPromPonderado === 'function' && CAL_DATA && Object.keys(CAL_DATA).length
    ? (MATERIAS_NEM.reduce((s,m) => s + calPromPonderado(idx,m,1), 0) / MATERIAS_NEM.length)
    : (a.cals.reduce((s,c)=>s+c,0)/a.cals.length);
  setEl('ficha-prom-badge', prom.toFixed(1));

  // Datos perfil
  setVal('fd-nombre', fd.nombre || a.n);
  setVal('fd-curp', fd.curp);
  setVal('fd-nacimiento', fd.nacimiento);
  setVal('fd-num', fd.num);
  setVal('fd-tutor', fd.tutor);
  setVal('fd-parentesco', fd.parentesco);
  setVal('fd-tel', fd.tel);
  setVal('fd-email-tutor', fd.emailTutor);

  // Académico
  fichaRenderCalsTrim(idx);
  setVal('fd-fortalezas', fd.fortalezas);
  setVal('fd-dificultades', fd.dificultades);
  setVal('fd-oportunidades', fd.oportunidades);
  fichaRenderMatAtencion(idx);

  // Conductual
  setVal('fd-conducta', fd.conducta);
  setVal('fd-participacion', fd.participacion);
  setVal('fd-relacion', fd.relacion);
  setVal('fd-responsabilidad', fd.responsabilidad);
  fichaRenderIndicadores(fd);
  fichaRenderReportes(fd);

  // Académico — gráfica de progreso y metas
  setTimeout(() => {
    fichaRenderGraficaProgreso(idx);
    metasRender(idx);
  }, 50);

  // Aprendizaje
  fichaRenderEstilos(fd);
  fichaRenderRitmo(fd);
  fichaRenderApoyos(fd);
  // Reset para regenerar estrategias IA al cargar nuevo alumno
  const iaEl = document.getElementById('fd-ia-estrategias');
  if (iaEl) { iaEl.dataset.generado = ''; iaEl.innerHTML = '<em style="color:var(--gris-50);">Guardando la ficha generará estrategias personalizadas.</em>'; }

  // Observaciones
  const today = new Date().toISOString().split('T')[0];
  setVal('fd-obs-fecha', today);
  fichaRenderObsHistorial(fd);
}

function fichaRenderCalsTrim(idx) {
  const cont = document.getElementById('fd-cals-tabla');
  if (!cont) return;
  if (!CAL_DATA || !Object.keys(CAL_DATA).length) { cont.innerHTML = '<p style="color:var(--gris-50);font-size:13px;">Carga calificaciones en el módulo de Calificaciones primero.</p>'; return; }
  let html = '<table class="tabla" style="width:100%;"><thead><tr><th>Materia</th>';
  [1,2,3].forEach(t => html += `<th style="text-align:center;">Trim. ${t}</th>`);
  html += '<th style="text-align:center;">Anual</th></tr></thead><tbody>';
  MATERIAS_NEM.forEach(m => {
    const ps = [1,2,3].map(t => typeof calPromPonderado === 'function' ? calPromPonderado(idx,m,t) : 7);
    const anual = ps.reduce((s,p)=>s+p,0)/3;
    const fmt = v => v < 6.5 ? v.toFixed(1) : Math.round(v);
    const c = v => v>=8?'#dcfce7':v>=6?'#fef9c3':'#fee2e2';
    const tc= v => v>=8?'#15803d':v>=6?'#a16207':'#b91c1c';
    html += `<tr><td style="font-weight:600;font-size:13px;">${m}</td>
      ${ps.map(p=>`<td style="text-align:center;"><span style="background:${c(p)};color:${tc(p)};padding:3px 8px;border-radius:6px;font-weight:700;font-size:12px;">${fmt(p)}</span></td>`).join('')}
      <td style="text-align:center;"><strong style="color:${tc(anual)};">${fmt(anual)}</strong></td></tr>`;
  });
  html += '</tbody></table>';
  cont.innerHTML = html;
}

function fichaRenderMatAtencion(idx) {
  const cont = document.getElementById('fd-mat-atencion');
  if (!cont || !CAL_DATA || !Object.keys(CAL_DATA).length) { if(cont) cont.innerHTML='<span style="font-size:12px;color:var(--gris-50);">—</span>'; return; }
  const matAtencion = MATERIAS_NEM.filter(m => calPromPonderado(idx,m,calTrimActual||1) < 7);
  cont.innerHTML = matAtencion.length
    ? matAtencion.map(m=>`<span style="padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:#fee2e2;color:#b91c1c;">${m}</span>`).join('')
    : '<span style="font-size:12px;color:#15803d;font-weight:600;">✅ Sin materias en atención</span>';
}

function fichaRenderIndicadores(fd) {
  const cont = document.getElementById('fd-conducta-indicadores');
  if (!cont) return;
  cont.innerHTML = INDICADORES.map((ind, i) => {
    const sel = fd.indicadores[i] || 'neu';
    return `<div class="fd-indicador">
      <div class="fd-ind-label">${ind}</div>
      <div class="fd-ind-btns">
        <button class="fd-ind-btn ${sel==='yes'?'sel-yes':''}" onclick="fdSetInd(${i},'yes',this)" title="Sí">✅</button>
        <button class="fd-ind-btn ${sel==='neu'?'sel-neu':''}" onclick="fdSetInd(${i},'neu',this)" title="A veces">⚠️</button>
        <button class="fd-ind-btn ${sel==='no'?'sel-no':''}" onclick="fdSetInd(${i},'no',this)" title="No">❌</button>
      </div>
    </div>`;
  }).join('');
}
function fdSetInd(i, v, btn) {
  if (fichaAlumnoActual===null) return;
  FICHAS_DATA[fichaAlumnoActual].indicadores[i] = v;
  btn.closest('.fd-ind-btns').querySelectorAll('.fd-ind-btn').forEach(b=>b.className='fd-ind-btn');
  const vals = ['yes','neu','no'];
  const cls  = ['sel-yes','sel-neu','sel-no'];
  btn.classList.add(cls[vals.indexOf(v)]);
}

function fichaRenderReportes(fd) {
  const cont = document.getElementById('fd-reportes-conducta');
  if (!cont) return;
  cont.innerHTML = fd.reportes.length
    ? fd.reportes.map((r,i)=>`<div class="reporte-item">
        <span style="font-size:16px;">🚨</span>
        <div style="flex:1;"><div style="font-size:13px;">${r.texto}</div><div style="font-size:11px;color:var(--gris-50);margin-top:2px;">${r.fecha}</div></div>
        <button onclick="fdEliminarReporte(${i})" style="background:none;border:none;cursor:pointer;color:var(--gris-50);font-size:14px;" aria-label="Cerrar">✕</button>
      </div>`).join('')
    : '<div style="font-size:13px;color:var(--gris-50);font-style:italic;">Sin reportes registrados.</div>';
}
function fdAgregarReporte() {
  if (fichaAlumnoActual===null) return;
  const inp = document.getElementById('fd-nuevo-reporte');
  if (!inp||!inp.value.trim()) return;
  const hoy = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
  FICHAS_DATA[fichaAlumnoActual].reportes.push({ texto: inp.value.trim(), fecha: hoy });
  inp.value = '';
  fichaRenderReportes(FICHAS_DATA[fichaAlumnoActual]);
}
function fdEliminarReporte(i) {
  if (fichaAlumnoActual===null) return;
  FICHAS_DATA[fichaAlumnoActual].reportes.splice(i,1);
  fichaRenderReportes(FICHAS_DATA[fichaAlumnoActual]);
}

function fichaRenderEstilos(fd) {
  const cont = document.getElementById('fd-estilos-wrap');
  if (!cont) return;
  cont.innerHTML = ESTILOS_APZ.map(e=>`
    <div class="estilo-chip ${fd.estilos.includes(e.id)?'sel':''}" onclick="fdToggleEstilo('${e.id}',this)">
      <span class="estilo-chip-ico">${e.ico}</span>
      <div><div class="estilo-chip-txt">${e.txt}</div><div class="estilo-chip-sub">${e.sub}</div></div>
    </div>`).join('');
}
function fdToggleEstilo(id, el) {
  if (fichaAlumnoActual===null) return;
  const fd = FICHAS_DATA[fichaAlumnoActual];
  if (fd.estilos.includes(id)) fd.estilos = fd.estilos.filter(e=>e!==id);
  else fd.estilos.push(id);
  el.classList.toggle('sel');
}

function fichaRenderRitmo(fd) {
  const cont = document.getElementById('fd-ritmo-wrap');
  if (!cont) return;
  cont.innerHTML = RITMOS.map(r=>`
    <div onclick="fdSetRitmo('${r.id}',this)" style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;border:1.5px solid ${fd.ritmo===r.id?'var(--verde)':'var(--gris-20)'};background:${fd.ritmo===r.id?'var(--verde-light)':'white'};cursor:pointer;transition:.15s;">
      <span style="font-size:16px;">${r.ico}</span>
      <span style="font-size:13px;font-weight:${fd.ritmo===r.id?'700':'500'};">${r.lbl}</span>
    </div>`).join('');
}
function fdSetRitmo(id) {
  if (fichaAlumnoActual===null) return;
  FICHAS_DATA[fichaAlumnoActual].ritmo = id;
  fichaRenderRitmo(FICHAS_DATA[fichaAlumnoActual]);
}

function fichaRenderApoyos(fd) {
  const cont  = document.getElementById('fd-apoyo-wrap');
  const vacio = document.getElementById('fd-apoyo-vacio');
  if (!cont) return;
  const apoyos = fd.apoyos || [];
  if (!apoyos.length) {
    cont.innerHTML = '';
    if (vacio) vacio.style.display = 'block';
    return;
  }
  if (vacio) vacio.style.display = 'none';

  // ── Política de privacidad: el docente NO ve etiquetas de discapacidad/diagnóstico
  // Solo Trabajo Social y Director tienen acceso al diagnóstico completo.
  // El docente ve únicamente recomendaciones pedagógicas generales.
  const esDocente = currentPerfil?.rol === 'docente' || currentPerfil?.rol === 'tutor' || (!currentPerfil && !window._grupoTutoria);
  const esTSoDir  = currentPerfil?.rol === 'ts' || currentPerfil?.rol === 'director' || currentPerfil?.rol === 'subdirector' || currentPerfil?.rol === 'coordinador';

  if (esDocente && !esTSoDir) {
    // El docente ve solo que el alumno tiene apoyos, sin diagnóstico específico
    cont.innerHTML = `<div style="padding:12px 14px;background:#eff6ff;border-radius:10px;border-left:3px solid #3b82f6;">
      <div style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:4px;">🛡️ Este alumno tiene apoyos pedagógicos asignados</div>
      <div style="font-size:12px;color:#3b82f6;line-height:1.6;">Consulta las estrategias de enseñanza personalizadas en la sección de abajo. Los detalles del diagnóstico son confidenciales y están disponibles con Trabajo Social.</div>
    </div>`;
    fichaGenerarEstrategiasConApoyos(fd);
    return;
  }

  // TS / Director sí ven las etiquetas completas
  const APOYO_COLORS = {
    'NEE':['#dbeafe','#1d4ed8'],'TDAH':['#fdf4ff','#7c3aed'],
    'Dislexia':['#fff7ed','#c2410c'],'Discalculia':['#fef9c3','#a16207'],
    'Visual':['#f0fdf4','#15803d'],'Auditivo':['#f0f9ff','#0369a1'],
    'Superdotado':['#fdf4ff','#6d28d9'],'Bilingüe':['#ecfdf5','#047857'],
    'Tutoría':['#f8fafc','#475569'],
  };
  cont.innerHTML = apoyos.map(ap => {
    const [bg,color] = APOYO_COLORS[ap]||['#f1f5f9','#475569'];
    return `<span title="Apoyo registrado por Trabajo Social" style="padding:5px 12px;border-radius:99px;font-size:11px;font-weight:700;border:1.5px solid ${color}40;background:${bg};color:${color};">🛡️ ${ap}</span>`;
  }).join('');
  fichaGenerarEstrategiasConApoyos(fd);
}
function fdToggleApoyo(ap) {
  hubToast('⚠️ Solo Trabajo Social puede modificar los apoyos especiales','warn');
}
async function fichaGenerarEstrategiasConApoyos(fd) {
  const el = document.getElementById('fd-ia-estrategias');
  if (!el || el.dataset.generado==='true') return;
  const apoyos = fd.apoyos||[];
  if (!apoyos.length && !fd.estilos?.length) return;
  el.innerHTML='<span style="color:var(--verde);">✨ Generando estrategias personalizadas…</span>';
  const prompt=`Eres docente experto en educación inclusiva NEM. El alumno ${fd.nombre||'este alumno'} tiene:
- Estilo(s) de aprendizaje: ${(fd.estilos||[]).join(', ')||'no definido'}
- Ritmo: ${fd.ritmo||'regular'}
- Apoyos especiales (Trabajo Social): ${apoyos.join(', ')||'ninguno'}
- Fortalezas: ${fd.fortalezas||'no especificadas'}
- Dificultades: ${fd.dificultades||'no especificadas'}
Da 4 estrategias pedagógicas concretas (1-2 oraciones). Formato: emoji + estrategia. Sin encabezados.`;
  try {
    const texto = await callAI({ feature: 'ficha_estrategias', prompt, system: _nemSys('TAREA: Estrategias pedagógicas diferenciadas, una por alumno, específicas y aplicables esta semana. Incluye: técnica pedagógica + ejercicio concreto + forma de verificar avance. Anti-rezago: si el alumno está muy por debajo, propón actividades de nivelación.') });
    el.innerHTML=texto.replace(/\n/g,'<br>');
    el.dataset.generado='true';
  } catch(e){ el.innerHTML='<em style="color:var(--gris-50);">Error al generar estrategias.</em>'; }
}

function fichaRenderObsHistorial(fd) {
  const cont = document.getElementById('fd-obs-historial');
  if (!cont) return;
  const tipoClases = {
    'Académica': 'academica',
    Conductual: 'conductual',
    Emocional: 'emocional',
    Familiar: 'familiar',
    Salud: 'salud',
    Logro: 'logro'
  };
  cont.innerHTML = fd.observaciones.length
    ? [...fd.observaciones].reverse().map((o,i)=>`
        <div class="obs-item-fd">
          <div class="obs-item-fd-header">
            <span class="obs-tipo-chip obs-tipo-${tipoClases[o.tipo]||'academica'}">${o.tipo}</span>
            <span style="font-size:11px;color:var(--gris-50);margin-left:auto;">${o.fecha}</span>
          </div>
          <div style="font-size:13px;line-height:1.6;">${o.texto}</div>
        </div>`).join('')
    : '<div style="font-size:13px;color:var(--gris-50);font-style:italic;padding:8px 0;">Sin observaciones registradas.</div>';
}
function fdAgregarObservacion() {
  if (fichaAlumnoActual===null) return;
  const texto = document.getElementById('fd-obs-texto')?.value?.trim();
  const tipo  = document.getElementById('fd-obs-tipo')?.value;
  const fecha = document.getElementById('fd-obs-fecha')?.value;
  if (!texto) { hubToast('⚠️ Escribe el texto de la observación','warn'); return; }
  FICHAS_DATA[fichaAlumnoActual].observaciones.push({ texto, tipo, fecha });
  document.getElementById('fd-obs-texto').value = '';
  fichaRenderObsHistorial(FICHAS_DATA[fichaAlumnoActual]);
  hubToast('✅ Observación registrada','ok');
}

// ── Guardar ficha ──
function fichaGuardar() {
  if (fichaAlumnoActual===null) { hubToast('⚠️ Selecciona un alumno primero','warn'); return; }
  const fd = FICHAS_DATA[fichaAlumnoActual];
  fd.nombre = getVal('fd-nombre');
  fd.curp   = getVal('fd-curp');
  fd.nacimiento = getVal('fd-nacimiento');
  fd.num    = getVal('fd-num');
  fd.tutor  = getVal('fd-tutor');
  fd.parentesco = getVal('fd-parentesco');
  fd.tel    = getVal('fd-tel');
  fd.emailTutor = getVal('fd-email-tutor');
  fd.conducta      = getVal('fd-conducta');
  fd.participacion = getVal('fd-participacion');
  fd.relacion      = getVal('fd-relacion');
  fd.responsabilidad = getVal('fd-responsabilidad');
  fd.fortalezas  = getVal('fd-fortalezas');
  fd.dificultades= getVal('fd-dificultades');
  fd.oportunidades=getVal('fd-oportunidades');
  hubToast('✅ Ficha de ' + alumnos[fichaAlumnoActual].n + ' guardada','ok');
  // Persistir CURP en Supabase (usuarios.curp)
  const _fichaAluId = alumnos[fichaAlumnoActual]?.id;
  if (_fichaAluId && fd.curp && window.sb) {
    window.sb.from('usuarios').update({ curp: fd.curp }).eq('id', _fichaAluId)
      .then(({ error: _e }) => { if (_e) console.warn('[FICHA] CURP save:', _e.message); });
  }
  fichaRenderLista('');
  // IA estrategias
  fichaGenerarIA(fd);
}
async function fichaGenerarIA(fd) {
  // Called on save - updates the aprendizaje tab suggestions
  const el = document.getElementById('fd-ia-estrategias');
  if (!el) return;
  el.innerHTML = '<em style="color:var(--gris-50);">⚙️ Generando sugerencias…</em>';
  const prompt = `Eres asesor pedagógico NEM. Genera 3 estrategias concretas para el docente (máx 2 líneas cada una) para apoyar a un alumno con estas características:
Estilo de aprendizaje: ${fd.estilos.join(', ')}.
Ritmo: ${fd.ritmo}.
Apoyos especiales: ${fd.apoyos.join(', ')||'ninguno'}.
Dificultades: ${fd.dificultades||'no especificadas'}.
Fortalezas: ${fd.fortalezas||'no especificadas'}.
Formato: lista numerada, lenguaje pedagógico, sin diagnósticos clínicos. Marco NEM.`;
  try {
    const texto = await callAI({ feature: 'ficha_estrategias', prompt, system: _nemSys('TAREA: Estrategias pedagógicas diferenciadas, una por alumno, específicas y aplicables esta semana. Incluye: técnica pedagógica + ejercicio concreto + forma de verificar avance. Anti-rezago: si el alumno está muy por debajo, propón actividades de nivelación.') });
    el.innerHTML = texto.replace(/\n/g,'<br>');
  } catch(e) {
    el.innerHTML = '1. Usar recursos visuales como mapas mentales y esquemas.<br>2. Dar instrucciones paso a paso y verificar comprensión.<br>3. Asignar actividades diferenciadas según su ritmo de aprendizaje.';
  }
}

// ── Análisis completo IA para Trabajo Social ──
async function fichaGenerarAnalisisCompleto() {
  if (fichaAlumnoActual === null) { hubToast('⚠️ Selecciona un alumno','warn'); return; }
  const fd = FICHAS_DATA[fichaAlumnoActual];
  const a = alumnos[fichaAlumnoActual];
  if (!a) return;

  document.getElementById('fd-btn-analisis').disabled = true;
  document.getElementById('fd-analisis-loading').style.display = 'block';
  document.getElementById('fd-analisis-empty').style.display = 'none';
  document.getElementById('fd-analisis-resultado').style.display = 'none';

  // Build a comprehensive profile for the prompt
  const promsStr = MATERIAS_NEM.map(m => {
    const p = typeof calPromPonderado==='function' ? calPromPonderado(fichaAlumnoActual, m, 1) : 7;
    return `${m}: ${p.toFixed(1)}`;
  }).join(', ');

  const prompt = `Eres un orientador pedagógico escolar de primaria en México, sistema NEM (Nueva Escuela Mexicana). Analiza la siguiente ficha descriptiva de un alumno y genera un reporte estructurado en JSON estricto (sin markdown, sin backticks).

FICHA DEL ALUMNO:
- Nombre: ${a.n}
- Grado: 6° A
- Calificaciones por materia: ${promsStr}
- Estilo de aprendizaje: ${(fd.estilos||[]).join(', ')||'No especificado'}
- Ritmo de aprendizaje: ${fd.ritmo||'normal'}
- Apoyos especiales detectados: ${(fd.apoyos||[]).join(', ')||'ninguno'}
- Fortalezas académicas (docente): ${fd.fortalezas||'No especificado'}
- Dificultades académicas (docente): ${fd.dificultades||'No especificado'}
- Áreas de oportunidad (docente): ${fd.oportunidades||'No especificado'}
- Conducta general: ${fd.conducta||'Buena'}
- Participación: ${fd.participacion||'Activo/a'}
- Relación con compañeros: ${fd.relacion||'Sociable'}
- Responsabilidad: ${fd.responsabilidad||'Casi siempre'}
- Indicadores de conducta: ${Object.entries(fd.indicadores||{}).filter(([k,v])=>v==='yes').map(([k])=>INDICADORES[parseInt(k)]).join(', ')||'ninguno'}
- Observaciones registradas: ${(fd.observaciones||[]).length} observaciones
- Reportes de conducta: ${(fd.reportes||[]).length} reportes

INSTRUCCIONES:
Responde ÚNICAMENTE con un objeto JSON con estas claves exactas:
{
  "resumen": "Párrafo de 3-4 oraciones con el perfil integral del alumno. Lenguaje objetivo y pedagógico, sin diagnósticos clínicos.",
  "fortalezas": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
  "alertas": ["área de atención 1", "área de atención 2"],
  "recomendaciones": ["recomendación pedagógica 1", "recomendación 2", "recomendación 3"],
  "derivaciones": [
    {"instancia": "Trabajo Social", "motivo": "motivo concreto", "urgencia": "alta|media|baja", "aplicar": true|false},
    {"instancia": "Psicólogo escolar", "motivo": "motivo concreto", "urgencia": "alta|media|baja", "aplicar": true|false},
    {"instancia": "Dirección", "motivo": "motivo concreto", "urgencia": "alta|media|baja", "aplicar": true|false},
    {"instancia": "DIF Municipal", "motivo": "motivo concreto", "urgencia": "alta|media|baja", "aplicar": true|false}
  ]
}
Solo incluye derivaciones con "aplicar": true si hay indicios pedagógicos reales. Sé honesto y proporcional.`;

  try {
    const raw = await callAI({ feature: 'ficha_analisis', prompt });
    const clean = raw.replace(/```json|```/g,'').trim();
    const res = JSON.parse(clean);

    // Render results
    document.getElementById('fd-ia-resumen').innerHTML = res.resumen || '—';
    document.getElementById('fd-ia-fortalezas-res').innerHTML = (res.fortalezas||[]).map(f=>`<div style="display:flex;gap:8px;margin-bottom:6px;"><span style="color:#15803d;flex-shrink:0;">✅</span><span>${f}</span></div>`).join('') || '—';
    document.getElementById('fd-ia-alertas').innerHTML = (res.alertas||[]).map(a=>`<div style="display:flex;gap:8px;margin-bottom:6px;"><span style="color:#c2410c;flex-shrink:0;">⚠️</span><span>${a}</span></div>`).join('') || '—';
    document.getElementById('fd-ia-recomendaciones').innerHTML = (res.recomendaciones||[]).map((r,i)=>`<div style="display:flex;gap:10px;margin-bottom:8px;"><span style="font-size:11px;font-weight:800;background:#dbeafe;color:#1d4ed8;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</span><span style="font-size:13px;line-height:1.5;">${r}</span></div>`).join('') || '—';

    const urgColors = {alta:'#fee2e2;color:#b91c1c', media:'#fef9c3;color:#a16207', baja:'#dcfce7;color:#15803d'};
    const urgLabels = {alta:'🔴 Urgente', media:'🟡 Media', baja:'🟢 Baja'};
    const deriv = (res.derivaciones||[]).filter(d=>d.aplicar);
    document.getElementById('fd-ia-derivaciones').innerHTML = deriv.length
      ? deriv.map(d=>`<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-radius:10px;background:white;border:1.5px solid var(--gris-20);margin-bottom:8px;">
          <div style="flex:1;"><div style="font-size:13px;font-weight:700;margin-bottom:3px;">${d.instancia}</div><div style="font-size:12px;color:var(--gris-50);line-height:1.5;">${d.motivo}</div></div>
          <span style="padding:3px 10px;border-radius:99px;font-size:10px;font-weight:800;background:${urgColors[d.urgencia]||urgColors.baja};">${urgLabels[d.urgencia]||'🟢 Baja'}</span>
        </div>`).join('')
      : '<div style="font-size:13px;color:#15803d;">✅ La IA no detecta necesidad de derivación en este momento.</div>';

    // Store result for sending
    fd._ultimoAnalisis = res;

    document.getElementById('fd-analisis-loading').style.display = 'none';
    document.getElementById('fd-analisis-resultado').style.display = 'block';
    document.getElementById('fd-analisis-empty').style.display = 'none';

  } catch(e) {
    console.error(e);
    document.getElementById('fd-analisis-loading').style.display = 'none';
    document.getElementById('fd-analisis-empty').style.display = 'block';
    document.getElementById('fd-analisis-empty').innerHTML = '<div style="padding:20px;text-align:center;"><div style="font-size:36px;margin-bottom:8px;">⚠️</div><div style="font-size:13px;color:#b91c1c;">Error al generar el análisis. Intenta de nuevo en unos momentos.</div></div>';
  }
  document.getElementById('fd-btn-analisis').disabled = false;
}

function fichaEnviarTS() {
  if (fichaAlumnoActual===null) return;
  const a = alumnos[fichaAlumnoActual];
  const fd = FICHAS_DATA[fichaAlumnoActual];
  const analisis = fd?._ultimoAnalisis;
  // Auto-create a trabajo social case
  const caso = {
    id: Date.now(),
    alumnoIdx: fichaAlumnoActual,
    tipo: 'riesgo',
    estado: 'seguimiento',
    fecha: new Date().toISOString().split('T')[0],
    desc: analisis?.resumen || fd?.dificultades || 'Derivado desde ficha descriptiva.',
    notifDir: 'En proceso',
    notifFam: 'Pendiente',
    canalizo: 'No',
    instExterna: '',
    acciones: 'Derivación automática desde Ficha Descriptiva mediante análisis IA.',
    proxFecha: (() => { const d = new Date(); d.setDate(d.getDate()+7); return d.toISOString().split('T')[0]; })(),
    responsable: 'Trabajador/a social',
  };
  TS_CASOS.unshift(caso);
  hubToast(`📤 Caso de ${a.n} enviado a Trabajo Social`, 'ok');
}

function fichaEnviarDir() {
  const a = fichaAlumnoActual!==null ? alumnos[fichaAlumnoActual] : null;
  hubToast(a ? `🏫 Análisis de ${a.n} enviado a Dirección` : '⚠️ Selecciona alumno','ok');
}

function fichaExportarAnalisis(){
  const casos = window._tsCasos || window._tsData || [];
  if(!casos.length){hubToast('Sin datos para exportar','error');return;}
  const rows = casos.map(c=>`<tr><td>${c.alumno_nombre||'—'}</td><td>${c.tipo||'—'}</td><td>${c.descripcion||'—'}</td><td>${c.estatus||'—'}</td><td>${c.created_at?new Date(c.created_at).toLocaleDateString('es-MX'):''}</td></tr>`).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Análisis TS</title><style>body{font-family:Arial,sans-serif;margin:32px;font-size:13px;}h1{color:#166534;}table{width:100%;border-collapse:collapse;}th{background:#dcfce7;padding:8px;text-align:left;border:1px solid #ccc;}td{padding:7px;border:1px solid #e2e8f0;}@media print{button{display:none}}</style></head><body><h1>Reporte de Trabajo Social</h1><p>Escuela: ${window.currentPerfil?.escuela_cct||'—'} · Ciclo: ${window.CICLO_ACTIVO||'2025-2026'} · Generado: ${new Date().toLocaleDateString('es-MX')}</p><table><thead><tr><th>Alumno</th><th>Tipo</th><th>Descripción</th><th>Estatus</th><th>Fecha</th></tr></thead><tbody>${rows}</tbody></table><button onclick="window.print()" style="margin-top:16px;padding:8px 20px;background:#16a34a;color:white;border:none;border-radius:6px;cursor:pointer;">Imprimir</button></body></html>`;
  const w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}else{hubToast('Activa las ventanas emergentes para exportar','error');}
}

function fichaExportar(){
  const casos = window._tsCasos || window._tsData || [];
  if(!casos.length){hubToast('Sin datos para exportar','error');return;}
  const header = ['Alumno','Tipo','Descripción','Estatus','Fecha','Derivado a'];
  const rows = casos.map(c=>[
    `"${(c.alumno_nombre||'').replace(/"/g,'""')}"`,
    `"${c.tipo||''}"`,
    `"${(c.descripcion||'').replace(/"/g,'""')}"`,
    `"${c.estatus||''}"`,
    c.created_at?new Date(c.created_at).toLocaleDateString('es-MX'):'',
    `"${c.derivado_a||''}"`
  ].join(','));
  const csv = '\uFEFF'+[header.join(','),...rows].join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download=`fichas_ts_${window.currentPerfil?.escuela_cct||'escuela'}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  hubToast('✅ Fichas exportadas como CSV');
}

// ── Tabs de la ficha ──
function fichaTab(tab, btn) {
  document.querySelectorAll('#fichas-contenido .ficha-tab-content').forEach(t=>t.style.display='none');
  document.querySelectorAll('#fichas-contenido .tab-btn').forEach(b=>b.classList.remove('active'));
  const el = document.getElementById('ftab-'+tab);
  if (el) el.style.display='block';
  const btns = document.querySelectorAll('#fichas-contenido .tab-btn');
  const tabMap = {perfil:0,academico:1,conductual:2,aprendizaje:3,observaciones:4,'analisis-ia':5};
  const idx = tabMap[tab];
  if (idx!==undefined && btns[idx]) btns[idx].classList.add('active');
  // Show/hide correct empty state
  if(tab==='analisis-ia') {
    const hasResult = document.getElementById('fd-analisis-resultado')?.style.display !== 'none';
    document.getElementById('fd-analisis-empty').style.display = hasResult ? 'none' : 'block';
  }
}

// Helpers
function setEl(id, v) { const e=document.getElementById(id); if(e) e.textContent=v; }
function setVal(id, v) { const e=document.getElementById(id); if(e) e.value=v||''; }
function getVal(id) { return document.getElementById(id)?.value||''; }


// Modulo Trabajo Social v8 -> app/portals/portal-ts.js
//  PORTAL TRABAJO SOCIAL — JS
// ══════════════════════════════════════════════════════════

const DERIVAR_INSTANCIAS = [
  { id:'dif',       ico:'🏛️', lbl:'DIF Municipal',        desc:'Situaciones de maltrato, abandono, vulnerabilidad familiar', color:'#fee2e2', border:'#fca5a5' },
  { id:'psico',     ico:'🧠', lbl:'Psicólogo escolar',     desc:'Dificultades emocionales, conductuales, de aprendizaje', color:'#fdf4ff', border:'#d8b4fe' },
  { id:'direccion', ico:'🏫', lbl:'Dirección escolar',     desc:'Casos que requieren sanción, citatorio formal o acuerdo', color:'#eff6ff', border:'#93c5fd' },
  { id:'mp',        ico:'⚖️', lbl:'Ministerio Público',    desc:'Violencia grave, delitos, situaciones que obligan denuncia', color:'#fef2f2', border:'#fca5a5' },
  { id:'imss',      ico:'🏥', lbl:'IMSS / Servicios salud', desc:'Desnutrición, indicios de abuso físico, salud mental', color:'#f0fdf4', border:'#86efac' },
  { id:'sipinna',   ico:'🛡️', lbl:'SIPINNA',               desc:'Sistema Integral de Protección a Niñas, Niños y Adolescentes', color:'#fff7ed', border:'#fdba74' },
  { id:'cij',       ico:'💊', lbl:'CIJ — Centro de Integración Juvenil', desc:'Uso o consumo de sustancias. Tel: 800-290-0024 (gratuito 24h)', color:'#fdf4ff', border:'#c4b5fd', tel:'800-290-0024' },
  { id:'conadic',   ico:'🔵', lbl:'CONADIC / UNEME-CAPA',  desc:'Unidades especializadas en adicciones SEP-SS. Atención gratuita', color:'#eff6ff', border:'#93c5fd', tel:'800-911-2000' },
  { id:'lineavida', ico:'☎️', lbl:'Línea de la Vida',      desc:'Orientación en adicciones 24/7 · Anónimo y gratuito', color:'#f0fdf4', border:'#86efac', tel:'800-911-2000' },
];

let tspCasoSeleccionado = null;
let tspFichaSeleccionada = null;
let tspDerivCasoSel = null;

async function tsPortalInit() {
  document.getElementById('ts-portal').style.display = 'flex';
  // Show/hide prefecto-only items
  const isPrefecto = !!window._modoPrefecto;
  document.querySelectorAll('#ts-portal .prefecto-only').forEach(el => {
    el.style.display = isPrefecto ? (el.tagName === 'BUTTON' ? 'flex' : 'block') : 'none';
  });
  // Initialize shared data if needed
  if(typeof fichaInit==='function') fichaInit();
  if(typeof tsInit==='function') tsInit();
  await tsCargarCasos();
  _topbarPro({ titleId:'ts-page-title', prefix:'ts', searchPlaceholder:'Buscar alumno, caso…' });
  tsNav('dashboard');
}

function tsNav(page) {
  document.querySelectorAll('#ts-portal .ts-nav-btn').forEach(b=>b.classList.remove('active'));
  const btn = [...document.querySelectorAll('#ts-portal .ts-nav-btn')].find(b=>b.getAttribute('onclick')===`tsNav('${page}')`);
  if(btn) btn.classList.add('active');
  document.querySelectorAll('#ts-portal .ts-page').forEach(p=>p.classList.remove('active'));
  const pg = document.getElementById('tsp-'+page);
  if(pg) pg.classList.add('active');
  const titles = {
    dashboard:'Dashboard', casos:'Casos activos', 'fichas-ia':'Análisis de fichas',
    derivaciones:'Derivar casos', historial:'Historial', protocolos:'Protocolos legales',
    'reportes-ts':'Reportes', 'dir-alumnos':'Directorio · Alumnos',
    'dir-familias':'Directorio · Familias', 'dir-instituciones':'Directorio · Instituciones',
    'apoyos-especiales':'Apoyos especiales por alumno',
    'bienestar-nee':'Bienestar estudiantil y NEE',
    'faltas-docentes':'Faltas de maestros', 'asistencia-alumnos':'Asistencia de alumnos',
    'entradas-salidas':'Entradas y salidas',
  };
  const t = document.getElementById('ts-page-title');
  if(t) t.textContent = titles[page]||page;
  if(page==='dashboard')        tspRenderDash();
  if(page==='casos')            tspRenderCasos();
  if(page==='fichas-ia')        tspRenderFichasIA();
  if(page==='derivaciones')     tspRenderDerivar();
  if(page==='historial')        tspRenderHistorial();
  if(page==='protocolos')       tspRenderProtocolos();
  if(page==='reportes-ts')      tspRenderReportes();
  if(page==='dir-alumnos')      { tsDirRenderAlumnos(''); }
  if(page==='dir-familias')     { tsDirRenderFamilias(''); }
  if(page==='dir-instituciones'){ tsDirRenderInstituciones(); }
  if(page==='apoyos-especiales'){ tsApoyoInit(); }
  if(page==='bienestar-nee')    { tsNeeInit(); }
  if(page==='faltas-docentes')  { prefFaltasDocentesCargar(); }
  if(page==='asistencia-alumnos'){ prefAsistenciaAlumnosCargar(); }
  if(page==='entradas-salidas') { prefEntradasSalidasCargar(); }
}

// ══════════════════════════════════════════════════════════
// APOYOS ESPECIALES — Portal Trabajo Social
// ══════════════════════════════════════════════════════════
const APOYOS_CONFIG = [
  {id:'NEE',       lbl:'NEE',        ico:'🏫', bg:'#dbeafe', color:'#1d4ed8', desc:'Necesidades Educativas Especiales'},
  {id:'TDAH',      lbl:'TDAH',       ico:'⚡', bg:'#fdf4ff', color:'#7c3aed', desc:'Trastorno por Déficit de Atención'},
  {id:'Dislexia',  lbl:'Dislexia',   ico:'📖', bg:'#fff7ed', color:'#c2410c', desc:'Dificultad en lectoescritura'},
  {id:'Discalculia',lbl:'Discalculia',ico:'🔢', bg:'#fef9c3', color:'#a16207', desc:'Dificultad con números y cálculo'},
  {id:'Visual',    lbl:'Visual',     ico:'👁️', bg:'#f0fdf4', color:'#15803d', desc:'Discapacidad o dificultad visual'},
  {id:'Auditivo',  lbl:'Auditivo',   ico:'👂', bg:'#f0f9ff', color:'#0369a1', desc:'Discapacidad o dificultad auditiva'},
  {id:'Superdotado',lbl:'Superdotado',ico:'🌟',bg:'#fdf4ff', color:'#6d28d9', desc:'Altas capacidades intelectuales'},
  {id:'Bilingüe',  lbl:'Bilingüe',   ico:'🌐', bg:'#ecfdf5', color:'#047857', desc:'Necesita apoyo en español/lengua materna'},
  {id:'Tutoría',   lbl:'Tutoría',    ico:'🤝', bg:'#f8fafc', color:'#475569', desc:'Requiere tutoría entre pares'},
];

let tsApoyoAlumnoActual = null;
let tsApoyoSeleccionados = [];
let tsApoyoHistorial = [];

function tsApoyoInit() {
  const alumnosList = window._alumnosActivos || alumnos;
  tsApoyoRenderLista(alumnosList);
}

function tsApoyoFiltrar() {
  const q = document.getElementById('ts-apoyo-buscar')?.value.toLowerCase()||'';
  const alumnosList = (window._alumnosActivos||alumnos).filter(a=>(a.n||a.nombre||'').toLowerCase().includes(q));
  tsApoyoRenderLista(alumnosList);
}

function tsApoyoRenderLista(list) {
  const cont = document.getElementById('ts-apoyo-lista');
  if (!cont) return;
  cont.innerHTML = list.map((a,i) => {
    const nombre = a.n || `${a.nombre||''} ${a.apellido_p||''}`.trim();
    const ai = (window._alumnosActivos||alumnos).indexOf(a);
    const fd = FICHAS_DATA[ai];
    const numApoyos = fd?.apoyos?.length || 0;
    const av = nombre.charAt(0);
    const colors = ['#7c3aed','#0369a1','#15803d','#c2410c','#a16207','#047857'];
    const bg = colors[i % colors.length];
    return `<div onclick="tsApoyoSeleccionar(${ai})" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #f1f5f9;cursor:pointer;transition:.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
      <div style="width:34px;height:34px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:white;flex-shrink:0;">${av}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;color:#1e293b;">${nombre}</div>
        <div style="font-size:11px;color:#64748b;">Núm. ${(a.num_lista||i+1)}</div>
      </div>
      ${numApoyos ? `<span style="background:#ede9fe;color:#7c3aed;font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px;">${numApoyos} apoyos</span>` : ''}
    </div>`;
  }).join('');
}

function tsApoyoSeleccionar(ai) {
  tsApoyoAlumnoActual = ai;
  const a = (window._alumnosActivos||alumnos)[ai];
  const nombre = a?.n || `${a?.nombre||''} ${a?.apellido_p||''}`.trim();
  const fd = FICHAS_DATA[ai] || {};

  document.getElementById('ts-apoyo-vacio').style.display = 'none';
  document.getElementById('ts-apoyo-editor').style.display = 'block';
  document.getElementById('ts-apoyo-nombre').textContent = nombre;
  const avEl = document.getElementById('ts-apoyo-av');
  if (avEl) { avEl.textContent = nombre.charAt(0); }

  tsApoyoSeleccionados = [...(fd.apoyos||[])];
  tsApoyoRenderChips();
  tsApoyoRenderHistorial(fd);
}

function tsApoyoRenderChips() {
  const cont = document.getElementById('ts-apoyo-chips');
  if (!cont) return;
  cont.innerHTML = APOYOS_CONFIG.map(ap => {
    const sel = tsApoyoSeleccionados.includes(ap.id);
    return `<button onclick="tsApoyoToggle('${ap.id}')" title="${ap.desc}" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:99px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid ${sel ? ap.color : '#e2e8f0'};background:${sel ? ap.bg : 'white'};color:${sel ? ap.color : '#64748b'};transition:.15s;">
      ${ap.ico} ${ap.lbl}${sel ? ' ✓' : ''}
    </button>`;
  }).join('');
}

function tsApoyoToggle(id) {
  if (tsApoyoSeleccionados.includes(id)) tsApoyoSeleccionados = tsApoyoSeleccionados.filter(a=>a!==id);
  else tsApoyoSeleccionados.push(id);
  tsApoyoRenderChips();
}

function tsApoyoGuardar() {
  if (tsApoyoAlumnoActual === null) return;
  const fd = FICHAS_DATA[tsApoyoAlumnoActual];
  if (!fd) return;

  const anterior = [...(fd.apoyos||[])];
  fd.apoyos = [...tsApoyoSeleccionados];

  // Registrar en historial
  const ahora = new Date().toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  if (!fd.historialApoyos) fd.historialApoyos = [];
  fd.historialApoyos.unshift({
    fecha: ahora,
    cambio: `${anterior.join(', ')||'ninguno'} → ${fd.apoyos.join(', ')||'ninguno'}`,
    por: currentPerfil?.nombre || 'Trabajo Social'
  });

  // Actualizar el display del docente
  fichaRenderApoyos(fd);
  tsApoyoRenderHistorial(fd);
  tsApoyoRenderLista(window._alumnosActivos||alumnos);

  // Si hay conexión a Supabase, guardar en DB
  if (sb && currentPerfil) {
    const alumno = (window._alumnosActivos||alumnos)[tsApoyoAlumnoActual];
    if (alumno?.id) {
      sb.from('fichas_apoyos').upsert({
        alumno_id: alumno.id,
        apoyos: fd.apoyos,
        asignado_por: currentPerfil.id,
        actualizado_en: new Date().toISOString()
      }, { onConflict: 'alumno_id' }).then(({error}) => {
        if (error) console.warn('Error guardando apoyos:', error);
      });
    }
  }

  hubToast('✅ Apoyos guardados. El docente los verá en la ficha del alumno.', 'ok');
}

function tsApoyoRenderHistorial(fd) {
  const cont = document.getElementById('ts-apoyo-historial');
  if (!cont) return;
  const hist = fd.historialApoyos||[];
  if (!hist.length) { cont.innerHTML='<em style="color:#94a3b8;">Sin cambios registrados aún</em>'; return; }
  cont.innerHTML = hist.slice(0,5).map(h=>`
    <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
      <div style="font-size:10px;color:#94a3b8;white-space:nowrap;margin-top:2px;">${h.fecha}</div>
      <div style="flex:1;">
        <div style="font-size:12px;color:#334155;">${h.cambio}</div>
        <div style="font-size:11px;color:#94a3b8;">por ${h.por}</div>
      </div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════
// GRÁFICA DE PROGRESO INDIVIDUAL (Ficha Académico)
// ══════════════════════════════════════════════════════════
function fichaRenderGraficaProgreso(ai) {
  const cont = document.getElementById('fd-grafica-progreso');
  if (!cont) return;
  const fd = FICHAS_DATA[ai];
  if (!fd) return;

  // Colores por materia
  const colores = ['#7c3aed','#0369a1','#15803d','#c2410c','#a16207','#2563eb','#ea580c','#059669'];
  const mats = MATERIAS_NEM;

  // Obtener promedios por trimestre desde CAL_DATA
  const trims = [1,2,3];
  const series = mats.map((mat, mi) => ({
    mat, color: colores[mi],
    vals: trims.map(t => {
      const d = CAL_DATA[mat]?.[t];
      if (!d) return null;
      const vals = Object.values(d[ai]||{}).filter(v=>v!==null&&v!==undefined);
      return vals.length ? Math.round(vals.reduce((s,v)=>s+parseFloat(v),0)/vals.length*10)/10 : null;
    })
  }));

  const maxVal = 10, minVal = 0, h = 160, w = cont.offsetWidth||400;
  const padL = 30, padR = 10, padT = 10, padB = 30;
  const gW = w - padL - padR;
  const gH = h - padT - padB;
  const xStep = gW / 2;

  // Grid lines
  let svgLines = '';
  [6,7,8,9,10].forEach(v => {
    const y = padT + gH * (1 - (v-minVal)/(maxVal-minVal));
    svgLines += `<line x1="${padL}" y1="${y}" x2="${w-padR}" y2="${y}" stroke="#f1f5f9" stroke-width="1"/>`;
    svgLines += `<text x="${padL-4}" y="${y+4}" font-size="9" fill="#94a3b8" text-anchor="end">${v}</text>`;
  });
  // X labels
  ['T1','T2','T3'].forEach((lbl,i) => {
    const x = padL + i * xStep;
    svgLines += `<text x="${x}" y="${h-padB+16}" font-size="9" fill="#94a3b8" text-anchor="middle">${lbl}</text>`;
  });

  // Lines per materia
  let svgPaths = '';
  series.forEach(s => {
    const pts = s.vals.map((v,i) => v === null ? null : [padL + i*xStep, padT + gH*(1-(v-minVal)/(maxVal-minVal))]);
    const valid = pts.filter(Boolean);
    if (valid.length < 2) return;
    const d = valid.map((p,i)=>(i===0?`M${p[0]},${p[1]}`:`L${p[0]},${p[1]}`)).join(' ');
    svgPaths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>`;
    valid.forEach(p => svgPaths += `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${s.color}"/>`);
  });

  cont.innerHTML = `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible;">${svgLines}${svgPaths}</svg>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">${series.map(s=>`<div style="display:flex;align-items:center;gap:4px;font-size:10px;color:#475569;"><div style="width:10px;height:10px;border-radius:50%;background:${s.color};flex-shrink:0;"></div>${s.mat.length>8?s.mat.slice(0,8)+'…':s.mat}</div>`).join('')}</div>`;
}

// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════
// MÓDULO COTEJO / TAREAS v2
// Calificación numérica 5-10 · Notas seleccionables · Análisis IA
// ══════════════════════════════════════════════════════════════════════

// Notas pedagógicas predefinidas — el docente las marca por alumno
const CT_NOTAS = {
  positivo: [
    { id:'buena_letra',    ico:'✍️', txt:'Buena letra y presentación' },
    { id:'participacion',  ico:'🙋', txt:'Participa activamente' },
    { id:'creatividad',    ico:'💡', txt:'Muestra creatividad' },
    { id:'puntual',        ico:'⏰', txt:'Entregó a tiempo' },
    { id:'esfuerzo',       ico:'💪', txt:'Se nota el esfuerzo' },
    { id:'comprension',    ico:'🎯', txt:'Comprende el tema' },
    { id:'ayuda_pares',    ico:'🤝', txt:'Ayuda a sus compañeros' },
  ],
  mejorar: [
    { id:'ortografia',     ico:'🔤', txt:'Mejorar ortografía' },
    { id:'redaccion',      ico:'📝', txt:'Mejorar redacción' },
    { id:'presentacion',   ico:'📋', txt:'Mejorar presentación' },
    { id:'copiado',        ico:'🚫', txt:'No copiar — trabajo propio' },
    { id:'incompleto',     ico:'📌', txt:'Trabajo incompleto' },
    { id:'comprension_b',  ico:'🔄', txt:'Repasar el tema' },
    { id:'atencion',       ico:'👀', txt:'Mejorar atención en clase' },
    { id:'puntualidad',    ico:'⌚', txt:'Entregar a tiempo' },
    { id:'esfuerzo_b',     ico:'📈', txt:'Se puede esforzar más' },
    { id:'orden',          ico:'📦', txt:'Organizar mejor el trabajo' },
  ]
};

// Estado central: { [tareaId]: { [alumnoIdx]: { cal, notas:[], obs } } }
let CT_DATA = {};
let CT_TAREAS = []; // array de tareas con criterios
let CT_TAREA_ACTIVA = null;

// Alias para compatibilidad con código antiguo
let TAREAS_DATA = [];

function tareasInit() {
  TAREAS_DATA = JSON.parse(localStorage.getItem('siembra_tareas')||'[]');
  CT_TAREAS = TAREAS_DATA;
  try { CT_DATA = JSON.parse(localStorage.getItem('siembra_ct_data') || '{}') || {}; } catch(e) { CT_DATA = {}; }
  ctInit();
  // Cargar actividades reales desde DB si hay conexión
  if (sb && window._grupoActivo) {
    ctCargarActividadesDB(window._grupoActivo);
  }
}

async function ctCargarActividadesDB(grupoId) {
  if (!sb || !grupoId || !currentPerfil) return;
  try {
    const { data, error } = await sb.from('tareas_docente')
      .select('*')
      .eq('grupo_id', grupoId)
      .eq('docente_id', currentPerfil.id)
      .order('created_at', { ascending: false });
    if (error) { console.warn('[ctCargarActividadesDB]', error.message); return; }
    // Siempre sobreescribir con lo que hay en BD (puede ser vacío)
    CT_ACTIVIDADES_GRUPO[grupoId] = (data || []).map(a => ({
      id: a.id,
      titulo: a.titulo || a.nombre,
      subtitulo: a.subtitulo || '',
      materia: a.materia || '',
      tipo_eval: a.tipo_eval || 'carita',
      rubrica: a.rubrica || null,
      bloqueada: !!(a.rubrica || a.tipo_eval === 'rubrica'),
    }));
    // Marcar como cargado desde DB para no rellenar con demo
    window._ctGruposCargados = window._ctGruposCargados || {};
    window._ctGruposCargados[grupoId] = true;
    ctSeleccionarGrupo(grupoId);
  } catch(e) { console.warn('[ctCargarActividadesDB]', e.message); }
}

function ctInit() {
  // Poblar selector de materias en modal nueva actividad
  const matSel = document.getElementById('ct-new-materia');
  if (matSel) {
    const mats = window._materiasDocente || MATERIAS_NEM;
    matSel.innerHTML = '<option value="">— Seleccionar —</option>' +
      mats.map(m => `<option value="${m}">${m}</option>`).join('');
  }
  // Render grupos panel
  ctRenderGrupos();
  // Poblar selector de tareas en cotejo (backward compat)
  ctPoblarSelectorTareas();
  // Init rubrica items in modal (if function exists)
  if (typeof ctRenderRubricaItems === 'function') ctRenderRubricaItems();
  tareasRender();

  // Auto-seleccionar: usar _grupoActivo si viene de card de grupo, si no el primero disponible
  const grupos = window._gruposDocente || [];
  const gruposDemo = grupos.length ? grupos : [
    { id:'g1', nombre:'2° K', nivel:'secundaria', grado:2, grupo:'K', alumno_count:35 },
    { id:'g2', nombre:'6° A', nivel:'primaria', grado:6, grupo:'A', alumno_count:28 },
    { id:'g3', nombre:'3° B', nivel:'secundaria', grado:3, grupo:'B', alumno_count:32 },
  ];
  const grupoTarget = window._grupoActivo || CT_GRUPO_SELECCIONADO;
  if (grupoTarget) {
    setTimeout(() => ctSeleccionarGrupo(grupoTarget), 100);
  } else if (gruposDemo.length) {
    setTimeout(() => ctSeleccionarGrupo(gruposDemo[0].id), 100);
  }
}

// ── RUBRICA PRESETS ──
const RUBRICA_PRESETS = {
  nem_basica: [
    { nombre: 'Comprensión del tema',   peso: 30 },
    { nombre: 'Participación activa',   peso: 20 },
    { nombre: 'Trabajo colaborativo',   peso: 20 },
    { nombre: 'Reflexión personal',     peso: 15 },
    { nombre: 'Presentación',           peso: 15 },
  ],
  nem_proyecto: [
    { nombre: 'Investigación y contenido', peso: 25 },
    { nombre: 'Creatividad e innovación',  peso: 20 },
    { nombre: 'Trabajo en equipo',         peso: 15 },
    { nombre: 'Presentación oral',         peso: 20 },
    { nombre: 'Impacto comunitario',       peso: 10 },
    { nombre: 'Autoevaluación',            peso: 10 },
  ],
  exposicion: [
    { nombre: 'Dominio del tema',      peso: 30 },
    { nombre: 'Claridad al exponer',   peso: 25 },
    { nombre: 'Material de apoyo',     peso: 15 },
    { nombre: 'Manejo del tiempo',     peso: 10 },
    { nombre: 'Respuesta a preguntas', peso: 10 },
    { nombre: 'Presencia y postura',   peso: 10 },
  ],
  participacion: [
    { nombre: 'Aporta ideas relevantes', peso: 30 },
    { nombre: 'Escucha activa',          peso: 25 },
    { nombre: 'Respeto al participar',   peso: 20 },
    { nombre: 'Frecuencia de participación', peso: 15 },
    { nombre: 'Actitud positiva',        peso: 10 },
  ],
  trabajo_escrito: [
    { nombre: 'Contenido y profundidad', peso: 30 },
    { nombre: 'Redacción y coherencia',  peso: 25 },
    { nombre: 'Ortografía y gramática',  peso: 15 },
    { nombre: 'Presentación y formato',  peso: 15 },
    { nombre: 'Fuentes y referencias',   peso: 15 },
  ],
  custom: [
    { nombre: 'Criterio 1', peso: 50 },
    { nombre: 'Criterio 2', peso: 50 },
  ],
};

let CT_RUBRICA_ITEMS = [];

function ctRenderRubricaItems() {
  if (!CT_RUBRICA_ITEMS.length) {
    CT_RUBRICA_ITEMS = RUBRICA_PRESETS.nem_basica.map(r => ({...r}));
  }
  const wrap = document.getElementById('ct-rubrica-items');
  if (!wrap) return;
  wrap.innerHTML = CT_RUBRICA_ITEMS.map((r, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:white;border:1px solid #e2e8f0;border-radius:8px;">
      <input type="text" value="${r.nombre}" placeholder="Nombre del criterio"
        style="flex:1;border:none;background:transparent;font-family:'Sora',sans-serif;font-size:12px;font-weight:600;outline:none;"
        onchange="CT_RUBRICA_ITEMS[${i}].nombre=this.value">
      <input type="number" min="0" max="100" step="5" value="${r.peso}"
        style="width:55px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;text-align:center;outline:none;"
        onchange="CT_RUBRICA_ITEMS[${i}].peso=parseInt(this.value)||0;ctActualizarRubricaSuma()">
      <span style="font-size:11px;color:var(--gris-50);">%</span>
      <button onclick="CT_RUBRICA_ITEMS.splice(${i},1);ctRenderRubricaItems()"
        style="width:24px;height:24px;border:none;background:#fee2e2;color:#b91c1c;border-radius:6px;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;" aria-label="Cerrar">✕</button>
    </div>`).join('');
  ctActualizarRubricaSuma();
}

function ctActualizarRubricaSuma() {
  const suma = CT_RUBRICA_ITEMS.reduce((s,r) => s + (r.peso||0), 0);
  const el = document.getElementById('ct-rubrica-suma');
  if (el) {
    el.textContent = `Suma: ${suma}%`;
    el.style.color = suma === 100 ? '#15803d' : suma > 100 ? '#b91c1c' : '#a16207';
  }
}

function ctAgregarRubricaItem() {
  CT_RUBRICA_ITEMS.push({ nombre: 'Nuevo criterio', peso: 0 });
  ctRenderRubricaItems();
}

function ctCargarPresetRubrica(preset) {
  if (!preset || !RUBRICA_PRESETS[preset]) return;
  CT_RUBRICA_ITEMS = RUBRICA_PRESETS[preset].map(r => ({...r}));
  ctRenderRubricaItems();
}

async function ctRubricaSugerenciaIA() {
  const titulo = document.getElementById('ct-new-titulo')?.value || '';
  const materia = document.getElementById('ct-new-materia')?.value || '';
  const tipo = document.querySelector('input[name="ct-tipo"]:checked')?.value || 'tarea';
  const nivel = window._nivelActivo || 'primaria';

  const sugerenciaDiv = document.getElementById('ct-ia-sugerencia');
  const textoDiv = document.getElementById('ct-ia-texto');
  sugerenciaDiv.style.display = 'block';
  textoDiv.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><div style="width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:white;border-radius:50%;animation:spin .8s linear infinite;"></div> Generando sugerencia…</div>';

  try {
    const prompt = `Eres un asesor pedagógico de ${nivel} en México (NEM).
El docente creó una actividad:
- Título: ${titulo || 'Actividad sin título'}
- Materia: ${materia || 'General'}
- Tipo: ${tipo}
- Nivel: ${nivel}

Sugiere una rúbrica de evaluación con 4-6 criterios y sus pesos (que sumen 100%).
${nivel === 'secundaria' ? 'Las calificaciones serán SIEMPRE numéricas (5-10).' : 'Puede ser evaluación formativa o numérica.'}

Responde en formato JSON así:
{"criterios":[{"nombre":"...","peso":...,"descripcion":"..."}],"nota":"Breve sugerencia pedagógica"}

Solo el JSON, sin backticks ni introducción.`;

    const text = await callAI({ feature: 'rubrica_sugerencia', prompt, system: 'Responde solo JSON válido.' });
    const parsed = JSON.parse(text.replace(/```json|```/g,'').trim());
    
    window._sugerenciaRubricaIA = parsed;
    textoDiv.innerHTML = `<div style="margin-bottom:8px;font-weight:600;">Rúbrica sugerida:</div>` +
      (parsed.criterios||[]).map(c => `<div style="margin-bottom:4px;">• <strong>${c.nombre}</strong> (${c.peso}%) — ${c.descripcion||''}</div>`).join('') +
      (parsed.nota ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.2);font-style:italic;">${parsed.nota}</div>` : '');
  } catch(e) {
    // Fallback sugerencia local
    const fallback = RUBRICA_PRESETS[tipo === 'exposicion' ? 'exposicion' : tipo === 'participacion' ? 'participacion' : 'nem_basica'];
    window._sugerenciaRubricaIA = { criterios: fallback.map(r => ({...r, descripcion:''})), nota:'Sugerencia basada en plantillas predefinidas NEM.' };
    textoDiv.innerHTML = `<div style="margin-bottom:8px;font-weight:600;">Rúbrica sugerida (plantilla NEM):</div>` +
      fallback.map(c => `<div style="margin-bottom:4px;">• <strong>${c.nombre}</strong> (${c.peso}%)</div>`).join('') +
      `<div style="margin-top:8px;font-style:italic;">Puedes personalizar estos criterios según tu planeación.</div>`;
  }
}

function ctAplicarSugerenciaIA() {
  const sug = window._sugerenciaRubricaIA;
  if (!sug?.criterios) return;
  // Crear nueva rúbrica en el catálogo con los criterios sugeridos
  const titulo = document.getElementById('ct-new-titulo')?.value.trim() || 'Actividad';
  const nombre = `✨ ${titulo} (IA)`;
  const key = 'ia_' + Date.now();
  RUBRICAS_NEM[key] = {
    nombre,
    criterios: sug.criterios.map(c => ({
      nombre: c.nombre,
      desc: c.descripcion || '',
      niveles: ['Excelente','Bien','Suficiente','Necesita mejorar']
    }))
  };
  CT_RUBRICA_SEL = key;
  CT_EVAL_TIPO = 'rubrica';
  ctSelTipoEval('rubrica');
  ctRenderRubricasLista();
  document.getElementById('ct-ia-sugerencia').style.display = 'none';
  hubToast(`✅ Rúbrica "${nombre}" creada y seleccionada`, 'ok');
}

function ctConfigRubrica() {
  // Open the aspectos config modal for current materia
  if (typeof calAbrirConfigAspectos === 'function') calAbrirConfigAspectos();
}

// ── RÚBRICAS NEM CON NIVELES DESCRIPTIVOS ──
const RUBRICAS_NEM = {
  exposicion: {
    nombre: 'Exposición oral',
    criterios: [
      { nombre:'Contenido', desc:'¿El contenido ha sido adecuado a la temática?',
        niveles:['Se ha profundizado en los temas','Se han cubierto diferentes temas','Ideas correctas pero incompletas','Ideas simplistas'] },
      { nombre:'Estructura', desc:'¿La presentación estaba estructurada?',
        niveles:['Secciones planificadas para una presentación global','Se ha intentando relacionar las diferentes explicaciones','Secuencia correcta pero las secciones aparecen aisladas','Mal estructurado y difícil de entender'] },
      { nombre:'Organización', desc:'¿El equipo ha organizado bien la exposición?',
        niveles:['Tono apropiado y lenguaje preciso. Ha hecho participar al público','Fluida. El público sigue con interés','Clara y entendedora en general','Poco clara. Difícil de seguir'] },
      { nombre:'Materiales', desc:'¿Los materiales usados ayudaban?',
        niveles:['Muy interesantes y atractivos. Han sido un excelente soporte','Adecuados, han ayudado a entender conceptos','Adecuados, aunque no los han sabido aprovechar','Pocos y nada acertados'] },
      { nombre:'Equipo', desc:'¿Cómo ha trabajado el equipo?',
        niveles:['Muestra planificación y trabajo de grupo','Todos los miembros muestran conocer la presentación global','Muestra cierta planificación','Demasiado individualista'] },
    ]
  },
  participacion: {
    nombre: 'Participación',
    criterios: [
      { nombre:'Aportes', desc:'¿Aporta ideas relevantes al tema?',
        niveles:['Aporta ideas originales y relevantes constantemente','Aporta ideas que contribuyen a la discusión','Participa pero con aportes básicos','No aporta ideas significativas'] },
      { nombre:'Escucha', desc:'¿Escucha activamente a sus compañeros?',
        niveles:['Escucha con atención y retoma ideas de otros','Escucha con respeto la mayoría del tiempo','Escucha pero se distrae con frecuencia','No presta atención a los demás'] },
      { nombre:'Respeto', desc:'¿Muestra respeto al participar?',
        niveles:['Siempre respetuoso, pide la palabra y valora opiniones','Generalmente respetuoso','A veces interrumpe o no respeta turnos','Falta de respeto frecuente'] },
      { nombre:'Actitud', desc:'¿Muestra actitud positiva hacia el aprendizaje?',
        niveles:['Muy motivado, inspira a sus compañeros','Actitud positiva y dispuesto a aprender','Actitud indiferente','Actitud negativa o de rechazo'] },
    ]
  },
  proyecto: {
    nombre: 'Proyecto integrador NEM',
    criterios: [
      { nombre:'Investigación', desc:'¿El proyecto demuestra investigación?',
        niveles:['Investigación profunda con fuentes variadas y confiables','Investigación adecuada con fuentes pertinentes','Investigación básica, pocas fuentes','Sin investigación evidente'] },
      { nombre:'Creatividad', desc:'¿Demuestra creatividad e innovación?',
        niveles:['Propuesta original e innovadora que sorprende','Muestra creatividad en su desarrollo','Algunos elementos creativos','Sin creatividad, copia de modelos'] },
      { nombre:'Presentación', desc:'¿La presentación es clara y ordenada?',
        niveles:['Excelente presentación, limpia y profesional','Buena presentación, clara y ordenada','Presentación aceptable pero mejorable','Desordenado y poco claro'] },
      { nombre:'Impacto', desc:'¿Tiene impacto comunitario o social?',
        niveles:['Impacto claro y significativo en la comunidad','Se identifica un beneficio social','Mención de beneficio pero poco desarrollado','Sin relación con la comunidad'] },
      { nombre:'Reflexión', desc:'¿Incluye reflexión personal sobre el aprendizaje?',
        niveles:['Reflexión profunda que conecta con su vida','Reflexión clara sobre lo aprendido','Reflexión superficial','Sin reflexión personal'] },
    ]
  },
  aprend: {
    nombre: 'Aprendizaje formativo (NEM)',
    criterios: [
      { nombre:'Comprensión', desc:'¿Demuestra comprensión del tema?',
        niveles:['Comprensión profunda, explica con sus propias palabras','Comprende los conceptos principales','Comprensión parcial, requiere apoyo','No demuestra comprensión'] },
      { nombre:'Aplicación', desc:'¿Aplica lo aprendido en nuevas situaciones?',
        niveles:['Aplica en contextos diversos y propone soluciones','Aplica correctamente en situaciones similares','Aplica con apoyo del docente','No logra aplicar lo aprendido'] },
      { nombre:'Colaboración', desc:'¿Trabaja de forma colaborativa?',
        niveles:['Lidera y motiva al equipo constructivamente','Colabora activamente con sus compañeros','Colabora cuando se le pide','No colabora con el equipo'] },
      { nombre:'Autonomía', desc:'¿Muestra autonomía en su trabajo?',
        niveles:['Trabaja de forma autónoma y busca ampliar','Realiza el trabajo con poca supervisión','Necesita apoyo constante para avanzar','Dependiente total del docente'] },
    ]
  },
};

let CT_EVAL_TIPO = 'carita'; // 'carita' | 'rubrica'
let CT_RUBRICA_SEL = null;   // key de RUBRICAS_NEM
let RB_ALUMNO_IDX = null;
let RB_ACT_IDX = null;
let RB_SCORES = {};  // { [criterioIdx]: 1-4 }

function ctActividadUsaRubrica(act) {
  return !!(act && (act.tipo_eval === 'rubrica' || act.rubrica));
}

function ctActividadEsBloqueada(act) {
  return !!(act && (act.bloqueada || ctActividadUsaRubrica(act)));
}

async function ctPersistirCalificacionActividad(act, alumno, rec) {
  if (!sb || !act?.id || !alumno?.id) return;
  try {
    const entregada = rec?.entregada === true || (rec?.cal !== null && rec?.cal !== undefined);
    await sb.from('tareas_entregas').upsert({
      tarea_id: act.id,
      alumno_id: alumno.id,
      entregada,
      calificacion: rec?.cal ?? null,
      notas: rec?.notas || [],
      observacion: rec?.obs || null,
      comentario_docente: rec?.obs || null,
      fecha_entrega: entregada ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tarea_id,alumno_id' });
  } catch (e) {
    console.warn('[ctPersistirCalificacionActividad]', e.message);
  }
}

function ctNuevaActividad() {
  // Open modal, init
  const modal = document.getElementById('ct-modal-tarea');
  modal.style.display = 'flex';
  // Poblar materias
  const matSel = document.getElementById('ct-new-materia');
  if (matSel) {
    const mats = window._materiasDocente || MATERIAS_NEM;
    matSel.innerHTML = '<option value="">— Seleccionar —</option>' +
      mats.map(m => `<option value="${m}">${m}</option>`).join('');
  }
  // Render rubricas lista
  ctRenderRubricasLista();
  CT_EVAL_TIPO = 'carita';
  ctSelTipoEval('carita');
}

function ctSelTipoEval(tipo) {
  CT_EVAL_TIPO = tipo;
  const caritaBtn = document.getElementById('ct-eval-carita');
  const rubricaBtn = document.getElementById('ct-eval-rubrica');
  const rubricaCfg = document.getElementById('ct-rubrica-config');
  if (caritaBtn) { caritaBtn.style.borderColor = tipo==='carita' ? 'var(--verde)' : 'var(--gris-20)'; caritaBtn.style.background = tipo==='carita' ? 'var(--verde-light)' : 'white'; }
  if (rubricaBtn) { rubricaBtn.style.borderColor = tipo==='rubrica' ? 'var(--verde)' : 'var(--gris-20)'; rubricaBtn.style.background = tipo==='rubrica' ? 'var(--verde-light)' : 'white'; }
  if (rubricaCfg) rubricaCfg.style.display = tipo==='rubrica' ? '' : 'none';
}

function ctRenderRubricasLista() {
  const wrap = document.getElementById('ct-rubricas-lista');
  if (!wrap) return;
  wrap.innerHTML = Object.entries(RUBRICAS_NEM).map(([key, rb]) => {
    const isActive = CT_RUBRICA_SEL === key;
    return `<div style="display:flex;align-items:center;gap:6px;">
      <button onclick="CT_RUBRICA_SEL='${key}';ctRenderRubricasLista()" style="flex:1;padding:10px 14px;border:1.5px solid ${isActive?'var(--verde)':'#e2e8f0'};border-radius:10px;background:${isActive?'var(--verde-light)':'white'};cursor:pointer;text-align:left;font-family:'Sora',sans-serif;transition:.15s;">
        <div style="font-size:13px;font-weight:${isActive?'700':'500'};color:${isActive?'var(--verde)':'var(--gris-80)'};">${rb.nombre}</div>
        <div style="font-size:11px;color:var(--gris-50);margin-top:2px;">${rb.criterios.length} criterios · 4 niveles</div>
      </button>
      <button onclick="ctVerRubrica('${key}')" title="Ver criterios" style="padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;background:white;cursor:pointer;font-size:13px;">👁</button>
    </div>`;
  }).join('');
}

function ctVerRubrica(key) {
  const rb = RUBRICAS_NEM[key];
  if (!rb) return;
  const contenido = rb.criterios.map(c => `
    <div style="margin-bottom:12px;padding:10px;background:#f8fafc;border-radius:8px;border-left:3px solid var(--verde);">
      <div style="font-size:13px;font-weight:700;color:var(--texto);margin-bottom:6px;">📌 ${c.nombre}</div>
      ${(c.niveles||[]).map((n,i)=>
        `<div style="font-size:11px;padding:3px 0;color:var(--gris-80);">${['🟢','🔵','🟡','🔴'][i]||'·'} <strong>Nivel ${4-i}:</strong> ${n}</div>`
      ).join('')}
    </div>`).join('');
  // Use existing modal infrastructure or create inline modal
  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:900;display:flex;align-items:center;justify-content:center;padding:20px;';
  m.innerHTML = `<div style="background:white;border-radius:16px;width:100%;max-width:560px;max-height:80vh;overflow:hidden;display:flex;flex-direction:column;">
    <div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
      <div style="font-weight:700;font-size:15px;">${rb.nombre}</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--gris-50);">×</button>
    </div>
    <div style="padding:16px 20px;overflow-y:auto;">${contenido}</div>
  </div>`;
  m.onclick = e => { if(e.target===m) m.remove(); };
  document.body.appendChild(m);
}

function ctCrearRubricaCustom() {
  // Abrir modal para crear rúbrica personalizada
  const m = document.createElement('div');
  m.id = 'modal-rubrica-custom';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:900;display:flex;align-items:center;justify-content:center;padding:20px;';
  m.innerHTML = `<div style="background:white;border-radius:16px;width:100%;max-width:560px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;">
    <div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
      <div style="font-weight:700;font-size:15px;">+ Nueva rúbrica</div>
      <button onclick="document.getElementById('modal-rubrica-custom').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--gris-50);">×</button>
    </div>
    <div style="padding:16px 20px;overflow-y:auto;flex:1;">
      <div style="margin-bottom:12px;">
        <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-50);display:block;margin-bottom:4px;">Nombre de la rúbrica</label>
        <input id="rb-custom-nombre" type="text" placeholder="Ej: Proyecto de investigación NEM" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-50);margin-bottom:8px;">Criterios de evaluación</div>
      <div id="rb-custom-criterios" style="display:flex;flex-direction:column;gap:8px;"></div>
      <button onclick="ctRbCustomAgregarCriterio()" style="margin-top:8px;width:100%;padding:8px;border:1.5px dashed #e2e8f0;border-radius:8px;background:none;cursor:pointer;font-family:'Sora',sans-serif;font-size:13px;color:var(--verde);font-weight:600;">+ Agregar criterio</button>
    </div>
    <div style="padding:14px 20px;border-top:1px solid #f1f5f9;display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;">
      <button onclick="document.getElementById('modal-rubrica-custom').remove()" class="btn btn-outline btn-sm">Cancelar</button>
      <button onclick="ctRbCustomGuardar()" class="btn btn-primary btn-sm">Guardar rúbrica →</button>
    </div>
  </div>`;
  m.onclick = e => { if(e.target===m) m.remove(); };
  document.body.appendChild(m);
  // Add first criterion
  ctRbCustomAgregarCriterio();
  ctRbCustomAgregarCriterio();
  ctRbCustomAgregarCriterio();
}

let _rbCustomCount = 0;
function ctRbCustomAgregarCriterio() {
  const wrap = document.getElementById('rb-custom-criterios');
  if (!wrap) return;
  const id = ++_rbCustomCount;
  const div = document.createElement('div');
  div.id = 'rb-crit-'+id;
  div.style.cssText = 'display:flex;align-items:center;gap:8px;';
  div.innerHTML = `<input type="text" placeholder="Nombre del criterio" style="flex:1;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;outline:none;">
    <input type="number" placeholder="%" min="1" max="100" style="width:60px;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;outline:none;text-align:center;">
    <button onclick="document.getElementById('rb-crit-${id}').remove()" style="width:28px;height:28px;border:none;background:#fee2e2;border-radius:6px;cursor:pointer;color:#dc2626;font-size:14px;flex-shrink:0;">×</button>`;
  wrap.appendChild(div);
}

function ctRbCustomGuardar() {
  const nombre = document.getElementById('rb-custom-nombre')?.value.trim();
  if (!nombre) { hubToast('⚠️ Escribe el nombre de la rúbrica', 'warn'); return; }
  const rows = document.querySelectorAll('#rb-custom-criterios > div');
  const criterios = [...rows].map(row => {
    const inputs = row.querySelectorAll('input');
    return { nombre: inputs[0]?.value.trim(), desc: '', niveles: ['Excelente','Bien','Suficiente','Insuficiente'] };
  }).filter(c => c.nombre);
  if (!criterios.length) { hubToast('⚠️ Agrega al menos un criterio', 'warn'); return; }
  const key = 'custom_' + Date.now();
  RUBRICAS_NEM[key] = { nombre, criterios };
  CT_RUBRICA_SEL = key;
  document.getElementById('modal-rubrica-custom')?.remove();
  ctRenderRubricasLista();
  hubToast(`✅ Rúbrica "${nombre}" creada y seleccionada`, 'ok');
}

// ── GRUPOS Y ALUMNOS ──
let CT_GRUPO_SELECCIONADO = null;
let CT_ACTIVIDADES_GRUPO = {}; // { [grupoId]: [ {id, titulo, subtitulo, materia, fecha, tipo_eval, rubrica} ] }

function ctRenderGrupos() {
  const lista = document.getElementById('ct-grupos-lista');
  if (!lista) return;
  const grupos = window._gruposDocente || [];
  const gruposRender = grupos.length ? grupos : [
    { id:'g1', nombre:'2° K', nivel:'secundaria', grado:2, grupo:'K', alumno_count:35 },
    { id:'g2', nombre:'6° A', nivel:'primaria', grado:6, grupo:'A', alumno_count:28 },
    { id:'g3', nombre:'3° B', nivel:'secundaria', grado:3, grupo:'B', alumno_count:32 },
  ];
  lista.innerHTML = gruposRender.map(g => {
    const isActive = CT_GRUPO_SELECCIONADO === g.id;
    const cnt = window._alumnosCountPorGrupo?.[g.id] ?? g.alumno_count ?? 0;
    return `<button onclick="ctSeleccionarGrupo('${g.id}')" 
      style="width:100%;padding:12px 14px;border:1.5px solid ${isActive?'var(--verde)':'transparent'};
             border-radius:10px;background:${isActive?'var(--verde-light)':'transparent'};cursor:pointer;
             font-family:'Sora',sans-serif;text-align:left;margin-bottom:2px;transition:.15s;"
      onmouseover="if(!${isActive})this.style.background='#f8fafc'"
      onmouseout="if(!${isActive})this.style.background='transparent'">
      <div style="font-weight:700;font-size:14px;color:${isActive?'var(--verde)':'var(--gris-80)'};">${g.nombre || `${g.grado}° ${g.grupo}`}</div>
      <div style="font-size:11px;color:var(--gris-50);margin-top:2px;">${cnt} alumnos</div>
    </button>`;
  }).join('');
}

async function ctSeleccionarGrupo(grupoId) {
  CT_GRUPO_SELECCIONADO = grupoId;
  ctRenderGrupos();
  const tituloEl = document.getElementById('ct-grupo-titulo');
  const countEl = document.getElementById('ct-grupo-count');
  const wrapEl = document.getElementById('ct-alumnos-actividades');
  const grupo = (window._gruposDocente || []).find(g => g.id === grupoId) ||
    [{ id:'g1', nombre:'2° K' },{ id:'g2', nombre:'6° A' },{ id:'g3', nombre:'3° B' }].find(g => g.id === grupoId);
  if (tituloEl) tituloEl.textContent = grupo ? (grupo.nombre || `${grupo.grado}° ${grupo.grupo}`) : 'Grupo';

  // Load students — primero intentar desde DB, luego desde caché, nunca demo si hay grupo real
  let alumnosGrupo = [];
  if (sb && grupoId && !grupoId.startsWith('g')) {
    try { alumnosGrupo = await calCargarAlumnosGrupo(grupoId); } catch(e) {}
  }
  // Si no trajo de DB, usar caché exacta del grupo activo.
  if (!alumnosGrupo.length && window._alumnosPorGrupo?.[grupoId]?.length) {
    alumnosGrupo = window._alumnosPorGrupo[grupoId];
  }
  // Solo reutilizar _alumnosActivos cuando realmente pertenece a este grupo.
  if (!alumnosGrupo.length
    && window._alumnosActivosGrupoId === grupoId
    && window._alumnosActivos?.length
    && !window._alumnosActivos[0]?.id?.startsWith('d')) {
    alumnosGrupo = window._alumnosActivos;
  }
  // Solo usar demo si no hay sesión activa (modo prueba sin Supabase)
  if (!alumnosGrupo.length && (!sb || !currentPerfil)) {
    alumnosGrupo = [
      {n:'ALVARADO LOZANO, LEONARDO DANIEL',id:'d1'},{n:'BOCANEGRA HERNANDEZ, DEVANY ARLETH',id:'d2'},
      {n:'CAMPUZANO GOMEZ, BELLA JOCABET',id:'d3'},{n:'COLUNGA BARRIOS, CARLOS MATEO',id:'d4'},
      {n:'CORONA PONCE, LUIS REY',id:'d5'},{n:'CRUZ ALAMILLA, KEYLI YARENDI',id:'d6'},
      {n:'CUELLAR BAUTISTA, LIONEL',id:'d7'},{n:'DEL ANGEL GUADARRAMA, AXEL EDUARDO',id:'d8'},
      {n:'DOMINGUEZ FLORES, KARLA LIZBETH',id:'d9'},{n:'ESPIRICUETA RUIZ, EDGAR ALEXIS',id:'d10'},
      {n:'GALLEGOS HERNANDEZ, NUVIA ESTRELLA',id:'d11'},{n:'GARCIA LEIJA, EDSON YEHOSHAFAT',id:'d12'},
      {n:'GRAJALES GONZALEZ, KRISTEL GUADALUPE',id:'d13'},{n:'GUZMAN BUSTOS, JESUS EDUARDO',id:'d14'},
      {n:'GUZMAN GARCIA, VALERIA ALEJANDRA',id:'d15'},
    ];
  }
  if (alumnosGrupo.length) {
    window._alumnosActivos = alumnosGrupo;
    window._alumnosActivosGrupoId = grupoId;
    if (!window._alumnosPorGrupo) window._alumnosPorGrupo = {};
    window._alumnosPorGrupo[grupoId] = alumnosGrupo;
    if (!window._alumnosCountPorGrupo) window._alumnosCountPorGrupo = {};
    window._alumnosCountPorGrupo[grupoId] = alumnosGrupo.length;
  }
  if (countEl) countEl.textContent = `${alumnosGrupo.length} alumnos`;

  // Usar datos reales de DB si están disponibles; solo usar demo si NO hay sesión activa
  if (!CT_ACTIVIDADES_GRUPO[grupoId]) {
    const yaFueCargadoDeBD = window._ctGruposCargados?.[grupoId];
    if (!yaFueCargadoDeBD && (!sb || !currentPerfil)) {
      // Sin sesión → datos demo para presentación
      CT_ACTIVIDADES_GRUPO[grupoId] = [
        { id:'act_'+grupoId+'_1', titulo:'Portada', subtitulo:'13:33', materia:'Ciencias', tipo_eval:'carita', rubrica:null },
        { id:'act_'+grupoId+'_2', titulo:'Ex Firmado', subtitulo:'ACT 2', materia:'Ciencias', tipo_eval:'carita', rubrica:null },
        { id:'act_'+grupoId+'_3', titulo:'Transf de calor', subtitulo:'Act 3', materia:'Ciencias', tipo_eval:'carita', rubrica:'aprend' },
        { id:'act_'+grupoId+'_4', titulo:'electricidad', subtitulo:'Actividades 5', materia:'Ciencias', tipo_eval:'rubrica', rubrica:'exposicion' },
      ];
      const acts = CT_ACTIVIDADES_GRUPO[grupoId];
      alumnosGrupo.forEach((a, ai) => {
        acts.forEach((act, aci) => {
          if (!CT_DATA[act.id]) CT_DATA[act.id] = {};
          const baseScore = [5, 5, 5, 10, 5, 5, 5, 10, 5, 8, 5, 10, 5, 6, 5][ai] || 5;
          const variation = aci === 3 ? baseScore : (ai % 3 === 0 ? 10 : ai % 3 === 1 ? 5 : 8);
          CT_DATA[act.id][ai] = { cal: aci === 3 ? baseScore : variation, notas: [], obs: '', entregada: true };
        });
      });
    } else {
      // Con sesión pero aún no cargado de DB → inicializar vacío (la carga DB viene por ctCargarActividadesDB)
      CT_ACTIVIDADES_GRUPO[grupoId] = [];
    }
  }
  const actividades = CT_ACTIVIDADES_GRUPO[grupoId];

  // Render spreadsheet with emojis
  if (!wrapEl) return;

  const emojiFromScore = (score) => {
    if (score === null || score === undefined) return '<span style="font-size:20px;opacity:.3;">○</span>';
    if (score >= 9) return '<span style="font-size:20px;">😊</span>';
    if (score >= 7) return '<span style="font-size:20px;">🙂</span>';
    if (score >= 6) return '<span style="font-size:20px;">😐</span>';
    return '<span style="font-size:20px;">😟</span>';
  };

  const actHeaders = actividades.map((a, ai) => {
    const bloqueada = ctActividadEsBloqueada(a);
    return `<th style="padding:8px 6px;text-align:center;font-size:11px;min-width:90px;border-bottom:2px solid #e2e8f0;cursor:${bloqueada?'default':'pointer'};position:relative;"
        onclick="${bloqueada ? '' : `ctEditarColumna(${ai},'${grupoId}')`}">
      <div style="font-weight:700;color:#c2720c;font-size:12px;">${a.titulo}${bloqueada ? ' 🔒' : ''}</div>
      <div style="font-size:10px;font-weight:400;color:var(--gris-50);">${a.subtitulo||''}</div>
    </th>`;
  }).join('') +
    `<th style="padding:8px 6px;text-align:center;min-width:50px;border-bottom:2px solid #e2e8f0;">
      <button onclick="ctNuevaActividad()" style="width:32px;height:32px;border-radius:50%;border:2px solid #e2e8f0;background:white;cursor:pointer;font-size:16px;color:var(--gris-50);" title="Agregar actividad" aria-label="Agregar">+</button>
    </th>`;

  const rows = alumnosGrupo.map((a, ai) => {
    const nombre = a.n || `${a.nombre||''} ${a.apellido_p||''}`.trim();
    const celdas = actividades.map((act, aci) => {
      const rec = CT_DATA[act.id]?.[ai] || {};
      const score = rec.cal;
      const numVal = score !== null && score !== undefined ? score : '';
      const isRubrica = act.tipo_eval === 'rubrica' || act.rubrica;
      return `<td style="padding:6px;text-align:center;border-bottom:1px solid #f1f5f9;cursor:pointer;transition:.1s;"
                  onclick="${isRubrica ? `ctAbrirRubrica(${ai},${aci},'${grupoId}')` : `ctCiclarCarita(${ai},${aci},'${grupoId}')`}"
                  onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''"
                  id="ct-cell-${ai}-${aci}">
        ${act.tipo_eval === 'rubrica' || act.tipo_eval === 'numerico'
          ? `<span style="font-size:15px;font-weight:700;color:${score>=9?'#15803d':score>=7?'#a16207':score>=5?'#b91c1c':'var(--gris-50)'};">${numVal || '0,5'}</span>`
          : emojiFromScore(score)}
      </td>`;
    }).join('');

    return `<tr style="${ai%2===0?'':'background:#fafbfc;'}">
      <td style="padding:10px 14px;font-weight:600;font-size:12px;border-bottom:1px solid #f1f5f9;white-space:nowrap;position:sticky;left:0;background:${ai%2===0?'white':'#fafbfc'};z-index:1;max-width:280px;overflow:hidden;text-overflow:ellipsis;">
        <span style="color:var(--gris-50);margin-right:4px;">${ai+1}.</span> ${nombre}
        <span style="color:var(--gris-50);font-size:16px;margin-left:4px;">👤</span>
      </td>
      ${celdas}
      <td style="border-bottom:1px solid #f1f5f9;"></td>
    </tr>`;
  }).join('');

  wrapEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="position:sticky;top:0;z-index:4;background:white;box-shadow:0 2px 4px rgba(0,0,0,.06);">
      <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--gris-50);min-width:240px;position:sticky;left:0;background:white;z-index:5;border-bottom:2px solid #e2e8f0;">Actividades</th>
      ${actHeaders}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function ctCiclarCarita(ai, aci, grupoId) {
  const actividades = CT_ACTIVIDADES_GRUPO[grupoId] || [];
  const act = actividades[aci];
  if (!act) return;
  if (!CT_DATA[act.id]) CT_DATA[act.id] = {};
  if (!CT_DATA[act.id][ai]) CT_DATA[act.id][ai] = { cal: null, notas: [], obs: '', entregada: false };
  const rec = CT_DATA[act.id][ai];
  // Cycle: null → 10 → 8 → 6 → 5 → null
  const cycle = [null, 10, 8, 6, 5];
  const idx = cycle.indexOf(rec.cal);
  rec.cal = cycle[(idx + 1) % cycle.length];
  rec.entregada = rec.cal !== null;
  ctGuardarLocalStorage();
  const alumnosGrupo = window._alumnosActivos || alumnos || [];
  ctPersistirCalificacionActividad(act, alumnosGrupo[ai], rec);
  ctSeleccionarGrupo(grupoId); // Re-render
}

function ctAbrirRubrica(ai, aci, grupoId, preserveCurrent) {
  const actividades = CT_ACTIVIDADES_GRUPO[grupoId] || [];
  const act = actividades[aci];
  if (!act) return;
  // Get students from the grupo's loaded data
  const alumnosGrupo = window._alumnosActivos || alumnos || [];
  const alumno = alumnosGrupo[ai] || { n: `Alumno ${ai+1}` };

  const mismaRubrica = preserveCurrent && RB_ALUMNO_IDX === ai && RB_ACT_IDX === aci && window._rbGrupoId === grupoId;
  RB_ALUMNO_IDX = ai;
  RB_ACT_IDX = aci;
  if (!mismaRubrica) RB_SCORES = {};
  window._rbGrupoId = grupoId;

  document.getElementById('rb-alumno-nombre').textContent = alumno.n || `${alumno.nombre||''} ${alumno.apellido_p||''}`.trim();
  document.getElementById('rb-actividad-nombre').textContent = `${act.titulo} · ${act.materia||''}`;

  // Get rubrica
  const rubricaKey = act.rubrica || 'aprend';
  const rubrica = RUBRICAS_NEM[rubricaKey] || RUBRICAS_NEM.aprend;

  // Load existing scores
  const rec = CT_DATA[act.id]?.[ai] || {};
  if (!mismaRubrica && rec.rubrica_scores) RB_SCORES = {...rec.rubrica_scores};

  // Render criterios
  const body = document.getElementById('rb-criterios-body');
  body.innerHTML = rubrica.criterios.map((c, ci) => {
    const selected = RB_SCORES[ci] || 0;
    return `<div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:10px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:140px;padding:12px;vertical-align:top;border-right:1px solid #f1f5f9;background:#fafbfc;">
            <div style="font-weight:700;font-size:13px;">${c.nombre}</div>
            <div style="font-size:11px;color:var(--gris-50);margin-top:4px;line-height:1.4;">${c.desc}</div>
          </td>
          ${c.niveles.map((n, ni) => {
            const score = 4 - ni; // 4,3,2,1
            const isSelected = selected === score;
            const bgColor = isSelected ? (score>=4?'#dcfce7':score>=3?'#fef9c3':score>=2?'#fff7ed':'#fee2e2') : 'white';
            const borderColor = isSelected ? (score>=4?'#22c55e':score>=3?'#eab308':score>=2?'#f97316':'#ef4444') : 'transparent';
            return `<td onclick="rbSeleccionar(${ci},${score})" 
              style="padding:10px 12px;font-size:11px;line-height:1.5;color:var(--gris-80);cursor:pointer;
                     border-right:1px solid #f1f5f9;background:${bgColor};border-top:3px solid ${borderColor};
                     transition:.15s;vertical-align:top;width:${Math.floor(60/c.niveles.length)}%;"
              onmouseover="this.style.background='${isSelected?bgColor:'#f8fafc'}'"
              onmouseout="this.style.background='${bgColor}'"
              id="rb-cell-${ci}-${score}">${n}</td>`;
          }).join('')}
        </tr>
      </table>
    </div>`;
  }).join('');

  rbCalcNota();
  document.getElementById('ct-modal-rubrica').style.display = 'flex';
}

function rbSeleccionar(ci, score) {
  RB_SCORES[ci] = score;
  // Update visual — re-render the entire rubrica to update selection
  ctAbrirRubrica(RB_ALUMNO_IDX, RB_ACT_IDX, window._rbGrupoId, true);
}

function rbCalcNota() {
  const scores = Object.values(RB_SCORES);
  if (!scores.length) { document.getElementById('rb-nota-final').textContent = '—'; return; }
  // Average of scores (1-4) mapped to 5-10
  const avg = scores.reduce((s,v) => s+v, 0) / scores.length;
  // Map: 4→10, 3→8, 2→6, 1→5
  const nota = Math.round((avg / 4) * 5 + 5);
  const notaFinal = Math.min(10, Math.max(5, nota));
  document.getElementById('rb-nota-final').textContent = notaFinal;
}

function rbGuardar() {
  const grupoId = window._rbGrupoId;
  const actividades = CT_ACTIVIDADES_GRUPO[grupoId] || [];
  const act = actividades[RB_ACT_IDX];
  if (!act) return;

  const scores = Object.values(RB_SCORES);
  const avg = scores.length ? scores.reduce((s,v)=>s+v,0)/scores.length : 0;
  const nota = scores.length ? Math.min(10, Math.max(5, Math.round((avg/4)*5+5))) : null;

  if (!CT_DATA[act.id]) CT_DATA[act.id] = {};
  if (!CT_DATA[act.id][RB_ALUMNO_IDX]) CT_DATA[act.id][RB_ALUMNO_IDX] = { cal: null, notas: [], obs: '', entregada: false };
  CT_DATA[act.id][RB_ALUMNO_IDX].cal = nota;
  CT_DATA[act.id][RB_ALUMNO_IDX].entregada = nota !== null;
  CT_DATA[act.id][RB_ALUMNO_IDX].rubrica_scores = {...RB_SCORES};
  ctGuardarLocalStorage();
  const alumnosGrupo = window._alumnosActivos || alumnos || [];
  ctPersistirCalificacionActividad(act, alumnosGrupo[RB_ALUMNO_IDX], CT_DATA[act.id][RB_ALUMNO_IDX]);

  document.getElementById('ct-modal-rubrica').style.display = 'none';

  // If "saltar al siguiente"
  if (document.getElementById('rb-saltar-siguiente')?.checked) {
    const alumnosGrupo = window._alumnosActivos || alumnos;
    if (RB_ALUMNO_IDX + 1 < alumnosGrupo.length) {
      setTimeout(() => ctAbrirRubrica(RB_ALUMNO_IDX + 1, RB_ACT_IDX, grupoId), 200);
    }
  }

  ctSeleccionarGrupo(grupoId);
  hubToast('✅ Nota guardada: ' + nota + '/10', 'ok');
}

function ctEditarColumna(aci, grupoId) {
  const actividades = CT_ACTIVIDADES_GRUPO[grupoId] || [];
  const act = actividades[aci];
  if (!act) return;
  if (ctActividadEsBloqueada(act)) {
    hubToast('🔒 Las actividades con rúbrica guardada ya no se pueden editar ni mover.', 'warn');
    return;
  }
  document.getElementById('ccol-nombre').value = act.titulo || '';
  document.getElementById('ccol-tipo').value = act.tipo_eval || 'carita';
  // Poblar rúbricas select
  const sel = document.getElementById('ccol-rubrica');
  sel.innerHTML = '<option value="">Ninguna</option>' +
    Object.entries(RUBRICAS_NEM).map(([k,r]) => `<option value="${k}" ${act.rubrica===k?'selected':''}>${r.nombre}</option>`).join('');
  window._editColIdx = aci;
  window._editColGrupo = grupoId;
  document.getElementById('ct-modal-config-col').style.display = 'flex';
}

function ctGuardarConfigCol() {
  const aci = window._editColIdx;
  const grupoId = window._editColGrupo;
  const actividades = CT_ACTIVIDADES_GRUPO[grupoId];
  if (!actividades || !actividades[aci]) return;
  if (ctActividadEsBloqueada(actividades[aci])) {
    hubToast('🔒 Esta actividad ya quedó bloqueada y no admite cambios.', 'warn');
    document.getElementById('ct-modal-config-col').style.display = 'none';
    return;
  }
  actividades[aci].titulo = document.getElementById('ccol-nombre').value || actividades[aci].titulo;
  actividades[aci].tipo_eval = document.getElementById('ccol-tipo').value || 'carita';
  actividades[aci].rubrica = document.getElementById('ccol-rubrica').value || null;
  document.getElementById('ct-modal-config-col').style.display = 'none';
  ctSeleccionarGrupo(grupoId);
  hubToast('✅ Columna actualizada', 'ok');
}

function ctEliminarActividad() {
  if (!confirm('¿Eliminar esta actividad?')) return;
  const aci = window._editColIdx;
  const grupoId = window._editColGrupo;
  if (ctActividadEsBloqueada(CT_ACTIVIDADES_GRUPO[grupoId]?.[aci])) {
    hubToast('🔒 Esta actividad con rúbrica ya no se puede eliminar.', 'warn');
    document.getElementById('ct-modal-config-col').style.display = 'none';
    return;
  }
  CT_ACTIVIDADES_GRUPO[grupoId]?.splice(aci, 1);
  document.getElementById('ct-modal-config-col').style.display = 'none';
  ctSeleccionarGrupo(grupoId);
}

function ctAbrirConfigColumna() {
  // Open config for first activity
  const grupoId = CT_GRUPO_SELECCIONADO;
  if (!grupoId) { hubToast('Selecciona un grupo primero', 'warn'); return; }
  const acts = CT_ACTIVIDADES_GRUPO[grupoId];
  if (acts?.length) ctEditarColumna(0, grupoId);
}

function ctGuardarCalGrupo(actId, ai, val) {
  if (!CT_DATA[actId]) CT_DATA[actId] = {};
  if (!CT_DATA[actId][ai]) CT_DATA[actId][ai] = { cal: null, notas: [], obs: '' };
  CT_DATA[actId][ai].cal = val ? parseFloat(val) : null;
  CT_DATA[actId][ai].entregada = !!val;
}

function ctTab(tab) {
  ['grupos','cotejo','analisis'].forEach(t => {
    const btn = document.getElementById('ct-tab-'+t);
    const pan = document.getElementById('ct-panel-'+t);
    const active = t === tab;
    if (btn) { btn.style.background = active?'white':'transparent'; btn.style.color = active?'var(--verde)':'var(--gris-50)'; btn.style.fontWeight = active?'700':'600'; btn.style.boxShadow = active?'0 1px 3px rgba(0,0,0,.08)':'none'; }
    if (pan) pan.style.display = active?'':'none';
  });
  if (tab === 'grupos')   ctRenderGrupos();
  if (tab === 'analisis') ctMostrarAnalisis();
}

function ctPoblarSelectorTareas() {
  const sel = document.getElementById('ct-sel-tarea');
  if (!sel) return;
  const tareas = CT_TAREAS.length ? CT_TAREAS : TAREAS_DATA;
  sel.innerHTML = '<option value="">— Seleccionar tarea —</option>' +
    tareas.map((t,i) => `<option value="${i}">${t.titulo} · ${t.materia||''}</option>`).join('');
}

function ctCargarCotejo() {
  const ti = document.getElementById('ct-sel-tarea')?.value;
  if (ti === '' || ti === undefined) return;
  const tarea = (CT_TAREAS.length ? CT_TAREAS : TAREAS_DATA)[parseInt(ti)];
  if (!tarea) return;
  CT_TAREA_ACTIVA = { ...tarea, idx: parseInt(ti) };
  ctRenderTabla(CT_TAREA_ACTIVA);
}

function ctRenderTabla(tarea) {
  const wrap = document.getElementById('ct-tabla-wrap');
  if (!wrap) return;
  const listaCompleta = window._alumnosActivos || alumnos;
  if (!listaCompleta.length) {
    wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--gris-50);">Sin alumnos registrados.</div>`;
    return;
  }
  if (!CT_DATA[tarea.id]) CT_DATA[tarea.id] = {};

  // Aplicar filtro entregado/pendiente
  const filtroActual = window._ctFiltroEstado || 'todos';
  const lista = listaCompleta.filter((a, ai) => {
    if (filtroActual === 'todos') return true;
    const rec = CT_DATA[tarea.id]?.[ai] || {};
    const entregado = rec.entregada === true || (rec.cal !== null && rec.cal !== undefined);
    return filtroActual === 'entregado' ? entregado : !entregado;
  });

  wrap.innerHTML = `
    <div style="padding:14px 16px;border-bottom:1px solid var(--gris-10);display:flex;align-items:center;justify-content:space-between;">
      <div style="font-weight:700;font-size:14px;">${tarea.titulo}</div>
      <div style="font-size:12px;color:var(--gris-50);">${tarea.materia||''} · ${tarea.fecha||''}</div>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:var(--crema);">
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--gris-50);text-transform:uppercase;min-width:160px;">Alumno</th>
            <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:var(--gris-50);text-transform:uppercase;min-width:90px;">Entregado</th>
            <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:var(--gris-50);text-transform:uppercase;min-width:100px;">Calificación</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--gris-50);text-transform:uppercase;">Notas positivas</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--gris-50);text-transform:uppercase;">Áreas de mejora</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--gris-50);text-transform:uppercase;min-width:140px;">Observación</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map((a) => {
            const ai = listaCompleta.indexOf(a);
            const nombre = a.n || `${a.nombre||''} ${a.apellido_p||''}`.trim();
            const rec = CT_DATA[tarea.id]?.[ai] || { entregada: false, cal: null, notas: [], obs: '' };
            const calVal = rec.cal ?? '';
            const entregada = rec.entregada === true || (rec.cal !== null && rec.cal !== undefined);

            const calOpts = [5,6,7,8,9,10].map(n =>
              `<option value="${n}" ${calVal==n?'selected':''}>${n}</option>`
            ).join('');

            const posChips = CT_NOTAS.positivo.map(n =>
              `<button onclick="ctToggleNota(${ai},'${n.id}','positivo')"
                style="padding:2px 7px;border-radius:99px;font-size:10px;border:1.5px solid ${rec.notas.includes(n.id)?'var(--verde)':'var(--gris-20)'};background:${rec.notas.includes(n.id)?'var(--verde-light)':'white'};color:${rec.notas.includes(n.id)?'var(--verde)':'var(--gris-50)'};cursor:pointer;margin:2px;white-space:nowrap;">
                ${n.ico} ${n.txt}
              </button>`
            ).join('');

            const mejChips = CT_NOTAS.mejorar.map(n =>
              `<button onclick="ctToggleNota(${ai},'${n.id}','mejorar')"
                style="padding:2px 7px;border-radius:99px;font-size:10px;border:1.5px solid ${rec.notas.includes(n.id)?'#ef4444':'var(--gris-20)'};background:${rec.notas.includes(n.id)?'#fee2e2':'white'};color:${rec.notas.includes(n.id)?'#b91c1c':'var(--gris-50)'};cursor:pointer;margin:2px;white-space:nowrap;">
                ${n.ico} ${n.txt}
              </button>`
            ).join('');

            return `<tr style="border-bottom:1px solid var(--gris-10);${entregada?'':'opacity:.75;'}" id="ct-row-${ai}">
              <td style="padding:12px 14px;font-weight:600;">${nombre}</td>
              <td style="padding:12px 14px;text-align:center;">
                <button onclick="ctToggleEntregada(${ai})"
                  style="padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;border:1.5px solid ${entregada?'#86efac':'var(--gris-20)'};background:${entregada?'#f0fdf4':'white'};color:${entregada?'#15803d':'var(--gris-50)'};cursor:pointer;font-family:'Sora',sans-serif;">
                  ${entregada?'✅ Sí':'⏳ No'}
                </button>
              </td>
              <td style="padding:12px 14px;text-align:center;">
                <select onchange="ctGuardarCal(${ai},this.value)"
                  style="padding:6px 10px;border:1.5px solid ${calVal?'var(--verde)':'var(--gris-20)'};border-radius:8px;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;color:${calVal>=9?'#15803d':calVal>=7?'#a16207':calVal?'#b91c1c':'var(--gris-50)'};background:${calVal>=9?'#f0fdf4':calVal>=7?'#fef9c3':calVal?'#fef2f2':'white'};outline:none;cursor:pointer;">
                  <option value="">—</option>
                  ${calOpts}
                </select>
              </td>
              <td style="padding:10px 14px;max-width:220px;"><div style="display:flex;flex-wrap:wrap;">${posChips}</div></td>
              <td style="padding:10px 14px;max-width:220px;"><div style="display:flex;flex-wrap:wrap;">${mejChips}</div></td>
              <td style="padding:10px 14px;">
                <textarea onchange="ctGuardarObs(${ai},this.value)" placeholder="Nota libre…" rows="2"
                  style="width:100%;padding:6px 8px;border:1.5px solid var(--gris-20);border-radius:6px;font-family:'Sora',sans-serif;font-size:12px;outline:none;resize:vertical;">${rec.obs||''}</textarea>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="padding:12px 16px;background:var(--crema);border-top:1px solid var(--gris-10);font-size:12px;color:var(--gris-50);display:flex;align-items:center;gap:16px;">
      <span id="ct-prom-label" style="color:var(--gris-80);font-weight:600;"></span>
      <button onclick="ctGuardarTodoEnDB()" class="btn btn-primary btn-sm" style="margin-left:auto;">💾 Guardar en Supabase</button>
    </div>`;

  ctActualizarStats(tarea.id);
}

function ctGuardarCal(ai, val) {
  if (!CT_TAREA_ACTIVA) return;
  const tid = CT_TAREA_ACTIVA.id;
  if (!CT_DATA[tid]) CT_DATA[tid] = {};
  if (!CT_DATA[tid][ai]) CT_DATA[tid][ai] = { cal: null, notas: [], obs: '' };
  CT_DATA[tid][ai].cal = val ? parseFloat(val) : null;
  ctActualizarStats(tid);
  ctGuardarLocalStorage();
}

function ctToggleNota(ai, notaId, tipo) {
  if (!CT_TAREA_ACTIVA) return;
  const tid = CT_TAREA_ACTIVA.id;
  if (!CT_DATA[tid]) CT_DATA[tid] = {};
  if (!CT_DATA[tid][ai]) CT_DATA[tid][ai] = { cal: null, notas: [], obs: '' };
  const notas = CT_DATA[tid][ai].notas;
  const idx = notas.indexOf(notaId);
  if (idx >= 0) notas.splice(idx, 1);
  else notas.push(notaId);
  ctGuardarLocalStorage();
  // Refresh row
  ctRenderTabla(CT_TAREA_ACTIVA);
}

function ctGuardarObs(ai, val) {
  if (!CT_TAREA_ACTIVA) return;
  const tid = CT_TAREA_ACTIVA.id;
  if (!CT_DATA[tid]) CT_DATA[tid] = {};
  if (!CT_DATA[tid][ai]) CT_DATA[tid][ai] = { cal: null, notas: [], obs: '' };
  CT_DATA[tid][ai].obs = val;
  ctGuardarLocalStorage();
}

function ctActualizarStats(tid) {
  const lista = window._alumnosActivos || alumnos;
  const recs = CT_DATA[tid] || {};
  const cals = Object.values(recs).map(r => r.cal).filter(c => c !== null && c !== undefined);
  const entregados = Object.values(recs).filter(r => r.entregada === true || r.cal !== null).length;
  const pendientes = lista.length - entregados;
  const prom = cals.length ? (cals.reduce((s,c)=>s+c,0)/cals.length).toFixed(1) : null;

  const promEl = document.getElementById('ct-prom-label');
  if (promEl) promEl.textContent = `${entregados}/${lista.length} entregados · Promedio: ${prom||'—'}`;

  const stEnt = document.getElementById('ct-stat-entregados');
  const stPen = document.getElementById('ct-stat-pendientes');
  const stPro = document.getElementById('ct-stat-promedio');
  if (stEnt) { stEnt.textContent = `✅ ${entregados} entregados`; stEnt.style.display = 'inline'; }
  if (stPen) { stPen.textContent = `⏳ ${pendientes} pendientes`; stPen.style.display = 'inline'; }
  if (stPro) { stPro.textContent = `Prom: ${prom||'—'}`; stPro.style.display = 'inline'; }
}

function ctToggleEntregada(ai) {
  if (!CT_TAREA_ACTIVA) return;
  const tid = CT_TAREA_ACTIVA.id;
  if (!CT_DATA[tid]) CT_DATA[tid] = {};
  if (!CT_DATA[tid][ai]) CT_DATA[tid][ai] = { entregada: false, cal: null, notas: [], obs: '' };
  CT_DATA[tid][ai].entregada = !CT_DATA[tid][ai].entregada;
  ctGuardarLocalStorage();
  ctRenderTabla(CT_TAREA_ACTIVA);
}

function ctFiltrarEstado(estado, btn) {
  window._ctFiltroEstado = estado;
  document.querySelectorAll('[id^="ct-filtro-"]').forEach(b => {
    b.style.background = 'white';
    b.style.color = 'var(--gris-50)';
    b.style.borderColor = 'var(--gris-20)';
  });
  if (btn) {
    btn.style.background = 'var(--verde-light)';
    btn.style.color = 'var(--verde)';
    btn.style.borderColor = 'var(--verde)';
  }
  if (CT_TAREA_ACTIVA) ctRenderTabla(CT_TAREA_ACTIVA);
}

function ctGuardarLocalStorage() {
  try { localStorage.setItem('siembra_ct_data', JSON.stringify(CT_DATA)); } catch(e) {}
}

async function ctGuardarTodoEnDB() {
  if (!sb || !CT_TAREA_ACTIVA) { hubToast('ℹ️ Datos guardados localmente', 'ok'); return; }
  const lista = window._alumnosActivos || alumnos;
  const tid   = CT_TAREA_ACTIVA.id;
  const recs  = CT_DATA[tid] || {};
  let ok = 0;
  for (const [aiStr, rec] of Object.entries(recs)) {
    const ai = parseInt(aiStr);
    const alumno = lista[ai];
    if (!alumno?.id) continue;
    try {
      const entregada = rec.entregada === true || (rec.cal !== null && rec.cal !== undefined);
      await sb.from('tareas_entregas').upsert({
        tarea_id:           tid,
        alumno_id:          alumno.id,
        entregada:          entregada,
        calificacion:       rec.cal || null,
        notas:              rec.notas || [],
        observacion:        rec.obs || null,
        comentario_docente: rec.obs || null,
        fecha_entrega:      entregada ? new Date().toISOString() : null,
        updated_at:         new Date().toISOString(),
      }, { onConflict: 'tarea_id,alumno_id' });
      ok++;
    } catch(e) { console.warn(e); }
  }
  hubToast(`✅ ${ok} registros guardados en Supabase`, 'ok');
}

function ctNuevaTarea() {
  // Pre-fill fecha con hoy
  const fechaEl = document.getElementById('ct-new-fecha');
  if (fechaEl) fechaEl.value = new Date().toISOString().split('T')[0];
  document.getElementById('ct-modal-tarea').style.display = 'flex';
}

async function ctGuardarTarea() {
  const titulo = document.getElementById('ct-new-titulo')?.value.trim();
  const materia = document.getElementById('ct-new-materia')?.value;
  const fecha = document.getElementById('ct-new-fecha')?.value;
  const tipo = document.querySelector('input[name="ct-tipo"]:checked')?.value || 'tarea';
  const instrucciones = document.getElementById('ct-new-instrucciones')?.value.trim();
  const criteriosChk = [...document.querySelectorAll('input[name="ct-criterio"]:checked')].map(c => c.value);

  if (!titulo) { hubToast('⚠️ Escribe el nombre de la tarea', 'warn'); return; }

  const lista = window._alumnosActivos || alumnos;
  const nueva = {
    id: `t_${Date.now()}`,
    titulo, materia, fecha, tipo, instrucciones, criterios: criteriosChk,
    alumnos: lista.map((a, ai) => ({ ai, alumno_id: a.id || null, estado: 'pendiente' }))
  };

  CT_TAREAS.unshift(nueva);
  TAREAS_DATA = CT_TAREAS;

  // Guardar en Supabase
  if (sb && currentPerfil) {
    try {
      const grupoId = window._grupoActivo || null;
      const reqEvidencia = document.getElementById('ct-req-evidencia')?.checked || false;
      const tipoEvalSave = CT_EVAL_TIPO || 'carita';
      const rubricaSave  = CT_RUBRICA_SEL || null;
      const { data, error } = await sb.from('tareas_docente').insert({
        docente_id: currentPerfil.id, grupo_id: grupoId,
        titulo, materia, tipo, instrucciones,
        criterios: criteriosChk, fecha_entrega: fecha,
        ciclo: window.CICLO_ACTIVO, created_at: new Date().toISOString(),
        requiere_evidencia: reqEvidencia,
        tipo_eval: tipoEvalSave,
        rubrica: rubricaSave,
        subtitulo: document.getElementById('ct-new-subtitulo')?.value.trim() || '',
      }).select('id').single();
      if (!error && data) nueva.id = data.id;
    } catch(e) { console.warn('[ctGuardarTarea]', e.message); }
  }

  try { localStorage.setItem('siembra_tareas', JSON.stringify(CT_TAREAS)); } catch(e) {}

  // Agregar como columna en el spreadsheet del grupo activo
  const grupoActId = window._grupoActivo || CT_GRUPO_SELECCIONADO;
  if (grupoActId) {
    if (!CT_ACTIVIDADES_GRUPO[grupoActId]) CT_ACTIVIDADES_GRUPO[grupoActId] = [];
    const subtitulo = document.getElementById('ct-new-subtitulo')?.value.trim() || '';
    const tipoEval = CT_EVAL_TIPO || 'carita';
    const rubricaSel = CT_RUBRICA_SEL || null;
    CT_ACTIVIDADES_GRUPO[grupoActId].push({
      id: nueva.id,
      titulo,
      subtitulo,
      materia: materia || '',
      tipo_eval: tipoEval,
      rubrica: rubricaSel,
      bloqueada: !!(tipoEval === 'rubrica' || rubricaSel),
    });
    window._ctGruposCargados = window._ctGruposCargados || {};
    window._ctGruposCargados[grupoActId] = true;
    ctSeleccionarGrupo(grupoActId);
  }

  document.getElementById('ct-modal-tarea').style.display = 'none';
  document.getElementById('ct-new-titulo').value = '';
  if (document.getElementById('ct-new-subtitulo')) document.getElementById('ct-new-subtitulo').value = '';
  document.getElementById('ct-new-instrucciones').value = '';

  ctPoblarSelectorTareas();
  tareasRender();
  hubToast(`✅ Actividad "${titulo}" creada`, 'ok');
}

function ctExportarCSV() {
  if (!CT_TAREA_ACTIVA) { hubToast('⚠️ Selecciona una tarea primero', 'warn'); return; }
  const lista = window._alumnosActivos || alumnos;
  const recs  = CT_DATA[CT_TAREA_ACTIVA.id] || {};
  const rows = lista.map((a, ai) => {
    const rec = recs[ai] || { cal: '', notas: [], obs: '' };
    const nombre = a.n || `${a.nombre||''} ${a.apellido_p||''}`.trim();
    const notasTexto = rec.notas.map(id => {
      const n = [...CT_NOTAS.positivo, ...CT_NOTAS.mejorar].find(x => x.id === id);
      return n ? n.txt : id;
    }).join(' | ');
    return { alumno: nombre, calificacion: rec.cal ?? '', notas: notasTexto, observacion: rec.obs || '' };
  });
  const bom = 'ï»¿';
  const csv = bom + ['alumno,calificacion,notas,observacion',
    ...rows.map(r => `"${r.alumno}",${r.calificacion},"${r.notas}","${r.observacion}"`)
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `cotejo_${CT_TAREA_ACTIVA.titulo.replace(/\s+/g,'_')}.csv`;
  a.click();
  hubToast('✅ CSV exportado', 'ok');
}

// ── Generar actividad con IA ───────────────────────────────────────────────

function actGenerarIA() {
  const modal = document.getElementById('modal-act-ia');
  if (!modal) return;
  const matSel = document.getElementById('actia-materia');
  const mats = window._materiasDocente?.length ? window._materiasDocente : Array.from(MATERIAS_NEM);
  if (matSel) matSel.innerHTML = mats.map(m => `<option value="${m}">${m}</option>`).join('');
  const grupoActivo = (window._gruposDocente||[]).find(g=>g.id===window._grupoActivo) || window._gruposDocente?.[0];
  const gradoSel = document.getElementById('actia-grado');
  if (gradoSel && grupoActivo?.grado) {
    const gr = String(grupoActivo.grado).replace(/[°\s]/g,'').trim();
    gradoSel.value = gr;
  }
  document.getElementById('actia-resultado').style.display = 'none';
  modal.style.display = 'flex';
}

async function actGenerarIASubmit() {
  const materia = document.getElementById('actia-materia')?.value || '';
  const grado   = document.getElementById('actia-grado')?.value || '1';
  const tema    = document.getElementById('actia-tema')?.value?.trim() || '';
  const tipo    = document.getElementById('actia-tipo')?.value || 'individual';
  const trim    = document.getElementById('actia-trim')?.value || '1';
  const resDiv  = document.getElementById('actia-resultado');
  const textoEl = document.getElementById('actia-texto');
  if (!materia) { hubToast('⚠️ Selecciona una materia','warn'); return; }
  resDiv.style.display = 'block';
  textoEl.textContent = '⏳ Generando actividad con IA…';
  const nivel = window._nivelActivo === 'primaria' ? 'primaria' : 'secundaria';
  const edadRango = nivel === 'primaria' ? (parseInt(grado) <= 3 ? '6-9 años' : '9-12 años') : '12-15 años';

  // Prompts especializados por tipo
  const prompts = {
    individual:     `Diseña UNA actividad de trabajo individual para "${materia}", ${grado}° de ${nivel}, Trimestre ${trim}.${tema ? ` Tema: "${tema}".` : ''} Incluye: título, propósito NEM, materiales accesibles en México, instrucciones paso a paso (lenguaje para ${edadRango}), conexión con vida cotidiana, criterio de evaluación formativa, variante para alumno con rezago. Máx 20 min.`,
    equipo:         `Diseña UNA actividad de trabajo colaborativo en equipos para "${materia}", ${grado}° de ${nivel}, Trimestre ${trim}.${tema ? ` Tema: "${tema}".` : ''} Incluye: título, roles por integrante, propósito NEM, materiales, dinámica, criterio de evaluación grupal, producto esperado. Máx 30 min.`,
    proyecto:       `Diseña UN proyecto integrador NEM para "${materia}", ${grado}° de ${nivel}, Trimestre ${trim}.${tema ? ` Tema: "${tema}".` : ''} Incluye: nombre del proyecto, problema comunitario que resuelve, fases (investigación, desarrollo, presentación), recursos, duración, criterios de evaluación.`,
    investigacion:  `Diseña UNA guía de investigación para alumnos de "${materia}", ${grado}° de ${nivel}.${tema ? ` Tema: "${tema}".` : ''} Incluye: pregunta detonadora, fuentes sugeridas (libros, personas de la comunidad, internet), tabla para organizar datos, preguntas de análisis y producto final.`,
    experimento:    `Diseña UN experimento o práctica para "${materia}", ${grado}° de ${nivel}.${tema ? ` Tema: "${tema}".` : ''} Incluye: título, pregunta de indagación, materiales (accesibles y de bajo costo en México), procedimiento paso a paso, tabla de observaciones, conclusión guiada y extensión para alumnos avanzados.`,
    ejercicios:     `Crea una hoja de trabajo IMPRIMIBLE con 8 ejercicios variados sobre "${tema || materia}" para ${grado}° de ${nivel}, Trimestre ${trim}. Incluye: 3 de comprensión, 3 de aplicación, 1 de análisis y 1 de reflexión. Agrega espacio para responder. Formato listo para imprimir, con nombre del alumno y fecha al inicio.`,
    sopa_letras:    `Crea una SOPA DE LETRAS imprimible sobre "${tema || materia}" para ${grado}° de ${nivel}. Incluye: 10 palabras clave relacionadas al tema listadas abajo, la cuadrícula de letras en formato texto (15x15 con las palabras ocultas horizontal, vertical y diagonal), instrucciones para el alumno. Espacio para nombre y fecha.`,
    crucigrama:     `Crea un CRUCIGRAMA imprimible sobre "${tema || materia}" para ${grado}° de ${nivel}. Incluye: 8 palabras con sus definiciones (4 horizontales, 4 verticales) adecuadas para ${edadRango}, el diagrama del crucigrama en texto, y las pistas numeradas. Vocabulario contextualizado en México.`,
    completa:       `Crea una hoja de "COMPLETA LOS ESPACIOS" imprimible sobre "${tema || materia}" para ${grado}° de ${nivel}. Incluye: un párrafo de 5-6 oraciones con 8-10 palabras en blanco, el banco de palabras al final mezclado, respuestas en una sección separada para el docente. Lista para imprimir con nombre y fecha.`,
    relaciona:      `Crea una hoja de "RELACIONA COLUMNAS" imprimible sobre "${tema || materia}" para ${grado}° de ${nivel}. Incluye: 2 columnas de 8 conceptos cada una para relacionar con flechas, instrucciones claras, espacio para nombre, respuestas en sección aparte. Contexto mexicano.`,
    opcion_multiple:`Crea un EXAMEN DE OPCIÓN MÚLTIPLE de "${tema || materia}" para ${grado}° de ${nivel}, Trimestre ${trim}. Incluye: 10 preguntas con 4 opciones cada una (a-d), distribuidas en recuerdo (3), comprensión (4) y aplicación (3). Formato imprimible con nombre, fecha y clave de respuestas al final.`,
    debate:         `Diseña una actividad de DEBATE o MESA REDONDA sobre "${tema || materia}" para ${grado}° de ${nivel}. Incluye: tema polémico relacionado, roles (moderador, 2 equipos, secretario), preguntas guía para cada postura, reglas del debate, criterio de evaluación oral y reflexión final.`,
    juego:          `Diseña UN JUEGO DIDÁCTICO para aprender "${tema || materia}", ${grado}° de ${nivel}. Incluye: nombre del juego, número de jugadores, materiales (que se puedan hacer en clase), reglas claras, mecánica de juego, conexión con el aprendizaje esperado y variantes.`,
    mapa_mental:    `Diseña una actividad de MAPA MENTAL o CONCEPTUAL sobre "${tema || materia}" para ${grado}° de ${nivel}. Incluye: instrucciones paso a paso para construirlo, concepto central, 4-5 ramas principales con ejemplos, sugerencia de materiales (papel, colores) y criterio para evaluarlo.`,
    linea_tiempo:   `Diseña una actividad de LÍNEA DEL TIEMPO sobre "${tema || materia}" para ${grado}° de ${nivel}. Incluye: instrucciones, datos clave que deben incluir, template para trazar la línea con marcadores de fecha, criterio de evaluación y variante creativa (puede ser una línea del tiempo personal o comunitaria).`,
    tarea_casa:     `Diseña UNA TAREA PARA CASA sobre "${tema || materia}" para ${grado}° de ${nivel}. Incluye: instrucciones claras para padres y alumnos, materiales del hogar que pueden usar, actividad que conecte el tema con su entorno familiar, tiempo estimado (20-30 min) y cómo el alumno mostrará lo aprendido al día siguiente.`,
    lectura:        `Crea una ACTIVIDAD DE LECTURA Y COMPRENSIÓN sobre "${tema || materia}" para ${grado}° de ${nivel}. Incluye: un texto breve de 150-200 palabras contextualizado en México, 5 preguntas de comprensión (literal, inferencial, crítico), vocabulario nuevo con definiciones y una actividad de extensión creativa.`,
  };
  const prompt = prompts[tipo] || prompts.individual;

  try {
    const texto = await callAI({ feature: 'actividad_ia', prompt, system: _nemSys('TAREA: Genera el material pedagógico solicitado de forma concreta, lista para usar en el aula mexicana. Si es imprimible, usa formato de texto claro con secciones bien delimitadas.') });
    textoEl.textContent = texto;
    window._actIASugerida = { materia, grado, tema, tipo, trimestre: parseInt(trim), texto };
  } catch(e) {
    textoEl.textContent = '❌ Error al generar: ' + e.message;
  }
}

function actUsarSugerencia() {
  const s = window._actIASugerida;
  if (!s) return;
  document.getElementById('modal-act-ia').style.display = 'none';
  // Pre-llenar el modal de nueva actividad con los datos generados
  ctNuevaActividad();
  setTimeout(() => {
    const tituloEl = document.querySelector('#ct-modal-tarea [name="titulo"], #ct-modal-tarea #ct-act-titulo');
    const instrEl  = document.querySelector('#ct-modal-tarea [name="instrucciones"], #ct-modal-tarea #ct-act-instrucciones');
    const matEl    = document.querySelector('#ct-modal-tarea [name="materia"], #ct-modal-tarea #ct-act-materia');
    if (tituloEl) tituloEl.value = `Actividad ${s.materia} – ${s.tema || 'T'+s.trimestre}`;
    if (instrEl)  instrEl.value  = s.texto;
    if (matEl)    matEl.value    = s.materia;
  }, 200);
}

// ── Imprimir / PDF de actividad generada ─────────────────────────────────────
function actImprimirHoja() {
  const s = window._actIASugerida;
  const texto = document.getElementById('actia-texto')?.textContent || '';
  if (!texto || texto.startsWith('⏳') || texto.startsWith('❌')) {
    hubToast('⚠️ Genera una actividad primero', 'warn'); return;
  }
  const tipoLabels = {
    individual:'Trabajo individual', equipo:'Trabajo en equipo', proyecto:'Proyecto integrador',
    investigacion:'Investigación', experimento:'Experimento', ejercicios:'Ejercicios',
    sopa_letras:'Sopa de letras', crucigrama:'Crucigrama', completa:'Completa espacios',
    relaciona:'Relaciona columnas', opcion_multiple:'Opción múltiple', debate:'Debate',
    juego:'Juego didáctico', mapa_mental:'Mapa mental', linea_tiempo:'Línea del tiempo',
    tarea_casa:'Tarea para casa', lectura:'Lectura y comprensión',
  };
  const tipoNombre = s ? (tipoLabels[s.tipo] || s.tipo) : 'Actividad';
  const materia = s?.materia || '';
  const grado   = s ? `${s.grado}°` : '';
  const trim    = s ? `Trimestre ${s.trimestre}` : '';
  const tema    = s?.tema || '';

  const win = window.open('', '_blank');
  if (!win) { hubToast('⚠️ Permite ventanas emergentes', 'warn'); return; }
  win.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>${tipoNombre}: ${materia} ${grado}</title>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: letter portrait; margin: 2cm 2.5cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sora', sans-serif; font-size: 12px; line-height: 1.8; color: #0f172a; }
  .no-print { margin-bottom: 16px; }
  .no-print button { padding: 10px 22px; border: none; border-radius: 8px; font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; margin-right: 8px; }
  .btn-print { background: #b91c1c; color: white; }
  .btn-close  { background: #f1f5f9; color: #475569; }
  .encabezado { border-bottom: 2.5px solid #0a5c2e; padding-bottom: 12px; margin-bottom: 18px; }
  .encabezado h1 { font-size: 15px; color: #0a5c2e; margin-bottom: 6px; }
  .chips { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .chip { padding: 3px 12px; border-radius: 99px; font-size: 10px; font-weight: 700; background: #f0fdf4; color: #0a5c2e; border: 1px solid #bbf7d0; }
  .alumno-datos { display: flex; gap: 40px; margin-bottom: 20px; padding: 10px 0; border-bottom: 1px dashed #e2e8f0; font-size: 11.5px; }
  .alumno-datos .campo { flex: 1; border-bottom: 1px solid #334155; padding-bottom: 2px; color: #64748b; }
  .contenido { white-space: pre-wrap; font-size: 12px; line-height: 1.85; }
  .pie { margin-top: 28px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9.5px; color: #94a3b8; text-align: center; }
  @media print { .no-print { display: none !important; } }
</style></head><body>
  <div class="no-print">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
    <button class="btn-close" onclick="window.close()">✕ Cerrar</button>
  </div>
  <div class="encabezado">
    <h1>${tipoNombre}${tema ? ': ' + tema : ''}</h1>
    <div class="chips">
      ${materia ? `<span class="chip">${materia}</span>` : ''}
      ${grado   ? `<span class="chip">${grado} grado</span>` : ''}
      ${trim    ? `<span class="chip">${trim}</span>` : ''}
      <span class="chip">Ciclo ${window.CICLO_ACTIVO || '2025-2026'}</span>
    </div>
  </div>
  <div class="alumno-datos">
    <div><span style="font-weight:700;">Nombre:</span> <span class="campo">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
    <div><span style="font-weight:700;">Grupo:</span> <span class="campo">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
    <div><span style="font-weight:700;">Fecha:</span> <span class="campo">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
  </div>
  <div class="contenido">${texto.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
  <div class="pie">SIEMBRA · ${window.currentPerfil?.escuela_nombre || 'Escuela'} · ${new Date().getFullYear()}</div>
</body></html>`);
  win.document.close();
}
window.actImprimirHoja = actImprimirHoja;

// ── Análisis IA por alumno ─────────────────────────────────────────────────

async function ctAnalisisIA() {
  const lista = window._alumnosActivos || alumnos;
  if (!lista.length) { hubToast('⚠️ Sin alumnos para analizar', 'warn'); return; }
  ctTab('analisis');
  const grid = document.getElementById('ct-analisis-grid');
  if (!grid) return;

  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--gris-50);">
    <div style="font-size:28px;margin-bottom:10px;">✨</div>
    <div style="font-weight:600;margin-bottom:6px;">Generando análisis individual…</div>
    <div style="font-size:12px;">Esto puede tomar unos segundos</div>
  </div>`;

  // Compilar datos por alumno
  const resumen = lista.map((a, ai) => {
    const nombre = a.n || `${a.nombre||''} ${a.apellido_p||''}`.trim();
    const todasNotas = [];
    Object.values(CT_DATA).forEach(td => {
      const rec = td[ai];
      if (rec?.notas) todasNotas.push(...rec.notas);
    });

    // Contar frecuencia de notas
    const freq = {};
    todasNotas.forEach(id => { freq[id] = (freq[id]||0)+1; });

    // Calificación promedio de todas las tareas
    const cals = Object.values(CT_DATA).map(td => td[ai]?.cal).filter(c => c != null);
    const prom = cals.length ? cals.reduce((s,c)=>s+c,0)/cals.length : null;

    // Observaciones libres
    const obs = Object.values(CT_DATA).map(td => td[ai]?.obs).filter(Boolean);

    return { nombre, freq, prom, obs, ai };
  });

  // Generar tarjetas con análisis local (sin IA si no hay conexión)
  grid.innerHTML = resumen.map(r => {
    const notasPos = Object.entries(r.freq)
      .filter(([id]) => CT_NOTAS.positivo.find(n=>n.id===id))
      .sort((a,b)=>b[1]-a[1]).slice(0,3)
      .map(([id]) => CT_NOTAS.positivo.find(n=>n.id===id))
      .filter(Boolean);

    const notasMej = Object.entries(r.freq)
      .filter(([id]) => CT_NOTAS.mejorar.find(n=>n.id===id))
      .sort((a,b)=>b[1]-a[1]).slice(0,3)
      .map(([id]) => CT_NOTAS.mejorar.find(n=>n.id===id))
      .filter(Boolean);

    const promColor = r.prom==null?'var(--gris-50)':r.prom>=9?'#15803d':r.prom>=7?'#a16207':'#b91c1c';
    const promBg    = r.prom==null?'#f4f5f8':r.prom>=9?'#f0fdf4':r.prom>=7?'#fef9c3':'#fee2e2';

    return `<div class="card" style="padding:16px;" id="ct-card-${r.ai}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--verde);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;flex-shrink:0;">
          ${r.nombre.charAt(0)}
        </div>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:13px;">${r.nombre}</div>
          <div style="font-size:11px;color:var(--gris-50);">${Object.keys(r.freq).length} notas · ${Object.values(CT_DATA).filter(td=>td[r.ai]?.cal).length} tareas calificadas</div>
        </div>
        <div style="background:${promBg};color:${promColor};padding:4px 10px;border-radius:8px;font-weight:900;font-size:16px;">
          ${r.prom != null ? r.prom.toFixed(1) : '—'}
        </div>
      </div>

      ${notasPos.length ? `<div style="margin-bottom:8px;">
        <div style="font-size:10px;font-weight:700;color:var(--verde);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">✅ Fortalezas</div>
        ${notasPos.map(n=>`<div style="font-size:12px;color:var(--gris-80);padding:2px 0;">${n.ico} ${n.txt}</div>`).join('')}
      </div>` : ''}

      ${notasMej.length ? `<div style="margin-bottom:8px;">
        <div style="font-size:10px;font-weight:700;color:#b91c1c;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">📈 Áreas de mejora</div>
        ${notasMej.map(n=>`<div style="font-size:12px;color:var(--gris-80);padding:2px 0;">${n.ico} ${n.txt}</div>`).join('')}
      </div>` : ''}

      ${r.obs.length ? `<div style="margin-bottom:8px;">
        <div style="font-size:10px;font-weight:700;color:var(--gris-50);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">📝 Notas del docente</div>
        <div style="font-size:11px;color:var(--gris-80);line-height:1.5;">${r.obs.slice(0,2).join(' · ')}</div>
      </div>` : ''}

      <button onclick="ctAnalisisIAAlumno(${r.ai})" style="width:100%;padding:7px;background:var(--verde-light);border:1.5px solid var(--verde-mid);color:var(--verde);border-radius:7px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;margin-top:6px;">
        📊 Análisis pedagógico detallado
      </button>
    </div>`;
  }).join('');
}

function ctMostrarAnalisis() {
  const grid = document.getElementById('ct-analisis-grid');
  if (!grid || grid.children.length <= 1) ctAnalisisIA();
}

async function ctAnalisisIAAlumno(ai) {
  const lista = window._alumnosActivos || alumnos;
  const alumno = lista[ai];
  const nombre = alumno?.n || `${alumno?.nombre||''} ${alumno?.apellido_p||''}`.trim();
  const cardEl = document.getElementById(`ct-card-${ai}`);
  const btn = cardEl?.querySelector('button');
  if (btn) { btn.textContent = '⏳ Analizando con IA…'; btn.disabled = true; }

  // Compilar todas las notas y calificaciones del alumno
  const todasNotas = [];
  const todasObs = [];
  const cals = [];
  const tareas = [];
  Object.entries(CT_DATA).forEach(([tid, td]) => {
    const rec = td[ai];
    if (!rec) return;
    const tarea = CT_TAREAS.find(t => t.id === tid);
    if (rec.notas) todasNotas.push(...rec.notas);
    if (rec.obs) todasObs.push(rec.obs);
    if (rec.cal) { cals.push(rec.cal); tareas.push(`${tarea?.titulo||tid}: ${rec.cal}`); }
  });

  const notasTexto = todasNotas.map(id => {
    const n = [...CT_NOTAS.positivo, ...CT_NOTAS.mejorar].find(x => x.id === id);
    return n ? n.txt : id;
  }).join(', ');

  const prom = cals.length ? cals.reduce((s,c)=>s+c,0)/cals.length : null;

  // Prompt para IA
  const prompt = `Eres un asistente pedagógico para docentes de primaria/secundaria en México.
Analiza el desempeño de ${nombre} y genera retroalimentación concisa y útil para el docente.

Calificaciones: ${tareas.join(' | ')||'Sin calificaciones aún'}
Promedio: ${prom?.toFixed(1)||'—'}
Notas pedagógicas del docente: ${notasTexto||'Ninguna aún'}
Observaciones: ${todasObs.join(' | ')||'Ninguna'}

Responde en JSON con exactamente esta estructura:
{
  "resumen": "Una oración describiendo el perfil del alumno",
  "fortalezas": ["fortaleza 1", "fortaleza 2"],
  "areas_mejora": ["área 1", "área 2", "área 3"],
  "recomendacion_docente": "Acción concreta que el docente puede hacer",
  "mensaje_alumno": "Mensaje motivador breve para el alumno (máx 20 palabras)"
}`;

  try {
    let analisis = null;

    if (typeof fetch !== 'undefined') {
      const txt = await callAI({ feature: 'ficha_analisis', prompt,
        system: 'Responde SOLO con el JSON solicitado. Sin markdown ni texto adicional.' });
      const clean = txt.replace(/```json|```/g,'').trim();
      analisis = JSON.parse(clean);
    }

    if (!analisis) throw new Error('Sin respuesta IA');

    // Render resultado IA en la tarjeta
    const iaHTML = `
      <div style="background:linear-gradient(135deg,#f0fdf4,#eaf6ee);border:1.5px solid #86efac;border-radius:10px;padding:12px;margin-top:10px;">
        <div style="font-size:10px;font-weight:700;color:var(--verde);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">📊 Análisis pedagógico</div>
        <div style="font-size:12px;color:var(--gris-80);margin-bottom:8px;font-style:italic;">"${analisis.resumen}"</div>
        ${analisis.fortalezas?.length ? `<div style="margin-bottom:6px;"><span style="font-size:10px;font-weight:700;color:#15803d;">✅ Fortalezas: </span><span style="font-size:11px;color:var(--gris-80);">${analisis.fortalezas.join(' · ')}</span></div>` : ''}
        ${analisis.areas_mejora?.length ? `<div style="margin-bottom:6px;"><span style="font-size:10px;font-weight:700;color:#b91c1c;">📈 Mejorar: </span><span style="font-size:11px;color:var(--gris-80);">${analisis.areas_mejora.join(' · ')}</span></div>` : ''}
        ${analisis.recomendacion_docente ? `<div style="background:white;border-radius:6px;padding:8px;margin-top:6px;font-size:11px;color:var(--gris-80);"><strong>Para el docente:</strong> ${analisis.recomendacion_docente}</div>` : ''}
        ${analisis.mensaje_alumno ? `<div style="background:#fff9c4;border-radius:6px;padding:6px 8px;margin-top:6px;font-size:11px;color:#a16207;">💌 Para ${nombre.split(' ')[0]}: <em>${analisis.mensaje_alumno}</em></div>` : ''}
      </div>`;

    cardEl?.insertAdjacentHTML('beforeend', iaHTML);
    if (btn) { btn.style.display='none'; }

  } catch(e) {
    // Fallback análisis local si no hay IA disponible
    const local = ctAnalisisLocal(ai, todasNotas, prom);
    cardEl?.insertAdjacentHTML('beforeend', local);
    if (btn) { btn.textContent = '📊 Análisis pedagógico detallado'; btn.disabled = false; }
  }
}

function ctAnalisisLocal(ai, notas, prom) {
  const mejoras = notas.filter(id => CT_NOTAS.mejorar.find(n=>n.id===id));
  const fortalezas = notas.filter(id => CT_NOTAS.positivo.find(n=>n.id===id));
  const textosMej = mejoras.slice(0,3).map(id => CT_NOTAS.mejorar.find(n=>n.id===id)?.txt).filter(Boolean);
  const textosFort = fortalezas.slice(0,2).map(id => CT_NOTAS.positivo.find(n=>n.id===id)?.txt).filter(Boolean);

  return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-top:10px;font-size:11px;color:var(--gris-80);">
    <div style="font-size:10px;font-weight:700;color:var(--gris-50);margin-bottom:6px;">📊 Análisis basado en notas</div>
    ${textosFort.length ? `<div><strong style="color:#15803d;">Fortalezas:</strong> ${textosFort.join(', ')}</div>` : ''}
    ${textosMej.length ? `<div style="margin-top:4px;"><strong style="color:#b91c1c;">Trabajar en:</strong> ${textosMej.join(', ')}</div>` : ''}
    ${prom ? `<div style="margin-top:4px;"><strong>Promedio tareas:</strong> ${prom.toFixed(1)}</div>` : ''}
    <div style="margin-top:6px;font-size:10px;color:var(--gris-50);">Análisis IA disponible en la sección de reportes</div>
  </div>`;
}

// Mantener compatibilidad con código antiguo
// tareasRender defined below



// ══ SEGUIMIENTO DE TAREAS POR ALUMNO (legacy)
let TAREAS_DATA_LEGACY = [];

function tareasRender() {
  const cont = document.getElementById('tareas-lista');
  if (!cont) return;
  if (!TAREAS_DATA.length) {
    const listaActual = window._alumnosActivos || alumnos;
    if (!listaActual.length) {
      cont.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--gris-50);">
        <div style="font-size:36px;margin-bottom:12px;">📋</div>
        <div style="font-size:15px;font-weight:700;color:var(--gris-80);margin-bottom:6px;">Aún no hay alumnos</div>
        <div style="font-size:13px;">Registra alumnos primero para poder asignar tareas.</div>
      </div>`;
    } else {
      cont.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--gris-50);">
        <div style="font-size:36px;margin-bottom:12px;">✅</div>
        <div style="font-size:15px;font-weight:700;color:var(--gris-80);margin-bottom:6px;">Aún no hay tareas registradas</div>
        <div style="font-size:13px;margin-bottom:14px;">Crea la primera tarea para tu grupo.</div>
        <button onclick="tareasNueva()" class="btn btn-primary btn-sm">+ Nueva tarea</button>
      </div>`;
    }
    return;
  }
  const alumnosList = window._alumnosActivos||alumnos;
  cont.innerHTML = TAREAS_DATA.map((t,ti) => {
    const entregadas = t.alumnos.filter(a=>a.estado==='entregada').length;
    const total = alumnosList.length;
    const pct = total ? Math.round(entregadas/total*100) : 0;
    const color = pct>=80?'#22c55e':pct>=50?'#f59e0b':'#ef4444';
    return `<div class="card" style="padding:16px;margin-bottom:10px;cursor:pointer;" onclick="tareasVerDetalle(${ti})">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:700;">${t.titulo}</div>
          <div style="font-size:12px;color:var(--gris-50);">${t.materia} · ${t.fecha}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:18px;font-weight:900;color:${color};">${pct}%</div>
          <div style="font-size:11px;color:var(--gris-50);">${entregadas}/${total} entregas</div>
        </div>
      </div>
      <div style="margin-top:10px;height:5px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:99px;transition:.5s;"></div>
      </div>
    </div>`;
  }).join('');
}

async function tareasNueva() {
  const titulo = prompt('Nombre de la tarea:');
  if (!titulo) return;
  const materia = prompt('Materia (ej: Matemáticas):') || 'General';
  const alumnosList = window._alumnosActivos || alumnos;
  const nueva = {
    id: Date.now(), titulo, materia,
    fecha: new Date().toLocaleDateString('es-MX'),
    _db: false,
    alumnos: alumnosList.map((a, ai) => ({
      ai, alumno_id: a.id || null, estado: 'pendiente'
    }))
  };
  TAREAS_DATA.unshift(nueva);
  tareasRender();
  hubToast('✅ Tarea registrada — guardando…', 'ok');
  await tareasGuardarDB(nueva);
  hubToast('✅ Tarea guardada en Supabase', 'ok');
}

function tareasVerDetalle(ti) {
  const t = TAREAS_DATA[ti];
  const alumnosList = window._alumnosActivos||alumnos;
  const lista = alumnosList.map((a,ai)=>{
    const reg = t.alumnos.find(r=>r.ai===ai)||{estado:'pendiente'};
    const nombre = a.n||`${a.nombre||''} ${a.apellido_p||''}`.trim();
    const estados = [{v:'pendiente',lbl:'⏳ Pendiente',bg:'#fef9c3',c:'#a16207'},{v:'entregada',lbl:'✅ Entregada',bg:'#dcfce7',c:'#15803d'},{v:'tarde',lbl:'⚠️ Tarde',bg:'#fee2e2',c:'#b91c1c'}];
    const chips = estados.map(e=>`<button onclick="tareasMarcar(${ti},${ai},'${e.v}')" style="padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;border:1.5px solid ${reg.estado===e.v?e.c:'#e2e8f0'};background:${reg.estado===e.v?e.bg:'white'};color:${reg.estado===e.v?e.c:'#94a3b8'};cursor:pointer;">${e.lbl}</button>`).join('');
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;"><div style="font-size:13px;font-weight:600;flex:1;">${nombre}</div><div style="display:flex;gap:4px;">${chips}</div></div>`;
  }).join('');

  document.getElementById('modal-tareas-titulo').textContent = t.titulo;
  document.getElementById('modal-tareas-body').innerHTML = lista;
  document.getElementById('modal-tareas-idx').value = ti;
  document.getElementById('modal-tareas').style.display='flex';
}

function tareasMarcar(ti, ai, estado) {
  tareasActualizarEntrega(ti, ai, estado);
  tareasVerDetalle(ti);
}

// ══════════════════════════════════════════════════════════
// METAS ACADÉMICAS POR ALUMNO/TRIMESTRE
// ══════════════════════════════════════════════════════════
let METAS_DATA = JSON.parse(localStorage.getItem('siembra_metas')||'{}');
// estructura: { [ai_trim]: { meta, notas } }

function metasRender(ai) {
  const cont = document.getElementById('fd-metas-wrap');
  if (!cont) return;
  const trims = [1,2,3];
  cont.innerHTML = trims.map(t => {
    const key = `${ai}_${t}`;
    const m = METAS_DATA[key] || {};
    return `<div style="margin-bottom:12px;">
      <div style="font-size:11px;font-weight:700;color:var(--gris-50);margin-bottom:6px;">Trimestre ${t}</div>
      <input type="text" value="${m.meta||''}" onchange="metasGuardar(${ai},${t},this.value)" placeholder="Meta del alumno para T${t} (ej: mejorar a 8 en Matemáticas)" style="width:100%;padding:7px 10px;border:1.5px solid var(--gris-20);border-radius:8px;font-size:12px;font-family:'Sora',sans-serif;outline:none;">
    </div>`;
  }).join('');
}

function metasGuardar(ai, trim, valor) {
  const key = `${ai}_${trim}`;
  if (!METAS_DATA[key]) METAS_DATA[key] = {};
  METAS_DATA[key].meta = valor;
  localStorage.setItem('siembra_metas', JSON.stringify(METAS_DATA));
  hubToast('✅ Meta guardada','ok');
}

// ══════════════════════════════════════════════════════════
// REGISTRO DE ENTREVISTAS CON PADRES
// ══════════════════════════════════════════════════════════
let ENTREVISTAS_DATA = JSON.parse(localStorage.getItem('siembra_entrevistas')||'[]');

function entrevistasInit() {
  entrevistasRender();
}

function entrevistasRender() {
  const cont = document.getElementById('entrevistas-lista');
  if (!cont) return;
  if (!ENTREVISTAS_DATA.length) {
    cont.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gris-50);">🗓️ No hay entrevistas registradas.<br><button onclick="entrevistaNueva()" class="btn btn-primary btn-sm" style="margin-top:12px;">+ Registrar entrevista</button></div>';
    return;
  }
  cont.innerHTML = ENTREVISTAS_DATA.slice().reverse().map((e,i) => {
    const ri = ENTREVISTAS_DATA.length - 1 - i;
    return `<div class="card" style="padding:14px;margin-bottom:10px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-size:13px;font-weight:700;">${e.alumno}</span>
            <span style="font-size:10px;font-weight:700;background:${e.tipo==='presencial'?'#dcfce7':'#dbeafe'};color:${e.tipo==='presencial'?'#15803d':'#1d4ed8'};padding:2px 8px;border-radius:99px;">${e.tipo==='presencial'?'🏫 Presencial':'📞 Virtual'}</span>
          </div>
          <div style="font-size:12px;color:var(--gris-50);">${e.fecha} · ${e.tutor}</div>
          <div style="font-size:12px;margin-top:6px;line-height:1.5;">${e.notas}</div>
        </div>
        <button onclick="entreVistaEliminar(${ri})" style="background:none;border:none;color:#e2e8f0;cursor:pointer;font-size:16px;" title="Eliminar" aria-label="Eliminar">🗑️</button>
      </div>
      ${e.acuerdos ? `<div style="margin-top:8px;background:#fef9c3;border-radius:8px;padding:8px 10px;font-size:12px;border-left:3px solid #f59e0b;"><strong>Acuerdos:</strong> ${e.acuerdos}</div>` : ''}
    </div>`;
  }).join('');
}

function entrevistaNueva() {
  const alumnosList = window._alumnosActivos||alumnos;
  const optsAlumnos = alumnosList.map((a,i)=>{const n=a.n||`${a.nombre||''} ${a.apellido_p||''}`.trim();return `<option value="${n}">${n}</option>`;}).join('');
  document.getElementById('modal-entrevista-body').innerHTML = `
    <div style="display:grid;gap:10px;">
      <div><label style="font-size:11px;font-weight:700;color:var(--gris-50);display:block;margin-bottom:4px;">ALUMNO</label><select id="ev-alumno" style="width:100%;padding:8px;border:1.5px solid var(--gris-20);border-radius:8px;font-size:13px;">${optsAlumnos}</select></div>
      <div><label style="font-size:11px;font-weight:700;color:var(--gris-50);display:block;margin-bottom:4px;">PADRE/TUTOR</label><input id="ev-tutor" placeholder="Nombre del padre o tutor" style="width:100%;padding:8px;border:1.5px solid var(--gris-20);border-radius:8px;font-size:13px;font-family:'Sora',sans-serif;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><label style="font-size:11px;font-weight:700;color:var(--gris-50);display:block;margin-bottom:4px;">FECHA</label><input id="ev-fecha" type="date" style="width:100%;padding:8px;border:1.5px solid var(--gris-20);border-radius:8px;font-size:13px;" value="${new Date().toISOString().split('T')[0]}"></div>
        <div><label style="font-size:11px;font-weight:700;color:var(--gris-50);display:block;margin-bottom:4px;">TIPO</label><select id="ev-tipo" style="width:100%;padding:8px;border:1.5px solid var(--gris-20);border-radius:8px;font-size:13px;"><option value="presencial">🏫 Presencial</option><option value="virtual">📞 Virtual/Llamada</option></select></div>
      </div>
      <div><label style="font-size:11px;font-weight:700;color:var(--gris-50);display:block;margin-bottom:4px;">NOTAS DE LA ENTREVISTA</label><textarea id="ev-notas" rows="3" placeholder="¿De qué hablaron? Temas tratados, actitud del padre, información relevante…" style="width:100%;padding:8px;border:1.5px solid var(--gris-20);border-radius:8px;font-size:13px;font-family:'Sora',sans-serif;resize:vertical;"></textarea></div>
      <div><label style="font-size:11px;font-weight:700;color:var(--gris-50);display:block;margin-bottom:4px;">ACUERDOS (opcional)</label><input id="ev-acuerdos" placeholder="Ej: Padre se compromete a revisar tarea cada noche" style="width:100%;padding:8px;border:1.5px solid var(--gris-20);border-radius:8px;font-size:13px;font-family:'Sora',sans-serif;"></div>
    </div>`;
  document.getElementById('modal-entrevista').style.display='flex';
}

function entrevistaGuardar() {
  const alumno   = document.getElementById('ev-alumno')?.value;
  const tutor    = document.getElementById('ev-tutor')?.value;
  const fecha    = document.getElementById('ev-fecha')?.value;
  const tipo     = document.getElementById('ev-tipo')?.value;
  const notas    = document.getElementById('ev-notas')?.value;
  const acuerdos = document.getElementById('ev-acuerdos')?.value;
  if (!alumno||!notas) { hubToast('⚠️ Completa alumno y notas','warn'); return; }
  ENTREVISTAS_DATA.push({ alumno, tutor, fecha, tipo, notas, acuerdos, creado: new Date().toISOString() });
  localStorage.setItem('siembra_entrevistas', JSON.stringify(ENTREVISTAS_DATA));
  document.getElementById('modal-entrevista').style.display='none';
  entrevistasRender();
  hubToast('✅ Entrevista registrada','ok');
}

function entreVistaEliminar(i) {
  if (!confirm('¿Eliminar este registro de entrevista?')) return;
  ENTREVISTAS_DATA.splice(i,1);
  localStorage.setItem('siembra_entrevistas', JSON.stringify(ENTREVISTAS_DATA));
  entrevistasRender();
}

// ══════════════════════════════════════════════════════════
// LISTA DE COTEJO / RÚBRICA RÁPIDA
// ══════════════════════════════════════════════════════════
let RUBRICAS_RAPIDAS = JSON.parse(localStorage.getItem('siembra_rubricas_rapidas')||'[]');
let rubricaActual = null;

function rubricaRapidaInit() {
  rubricaRapidaRender();
}

function rubricaRapidaRender() {
  const cont = document.getElementById('rubricas-lista');
  if (!cont) return;
  if (!RUBRICAS_RAPIDAS.length) {
    cont.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gris-50);">📋 No hay rúbricas creadas.<br><button onclick="rubricaRapidaNueva()" class="btn btn-primary btn-sm" style="margin-top:12px;">+ Nueva rúbrica/cotejo</button></div>';
    return;
  }
  cont.innerHTML = RUBRICAS_RAPIDAS.map((r,i)=>`<div class="card" style="padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:12px;cursor:pointer;" onclick="rubricaRapidaAbrir(${i})">
    <div style="width:40px;height:40px;border-radius:10px;background:var(--verde-light);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📋</div>
    <div style="flex:1;"><div style="font-size:14px;font-weight:700;">${r.titulo}</div><div style="font-size:12px;color:var(--gris-50);">${r.criterios.length} criterios · ${r.materia}</div></div>
    <span style="font-size:11px;font-weight:700;background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:99px;">Ver / Aplicar</span>
  </div>`).join('');
}

function rubricaRapidaNueva() {
  const titulo = prompt('Nombre de la rúbrica o lista de cotejo:');
  if (!titulo) return;
  const materia = prompt('Materia:') || 'General';
  const numCrit = parseInt(prompt('¿Cuántos criterios? (1-10):')) || 3;
  const criterios = [];
  for (let i=0; i<Math.min(numCrit,10); i++) {
    const c = prompt(`Criterio ${i+1}:`);
    if (c) criterios.push({txt:c, niveles:['Excelente','Suficiente','Insuficiente']});
  }
  RUBRICAS_RAPIDAS.push({ titulo, materia, criterios, creado: new Date().toISOString() });
  localStorage.setItem('siembra_rubricas_rapidas', JSON.stringify(RUBRICAS_RAPIDAS));
  rubricaRapidaRender();
  hubToast('✅ Rúbrica creada','ok');
}

// ══════════════════════════════════════════════════════════
// COMENTARIOS DOCENTE ↔ DIRECTOR (internos)
// ══════════════════════════════════════════════════════════
let COMENTARIOS_INTERNOS = [];

function comentariosInternosInit() {
  comentariosInternosCargar();
}

async function comentariosInternosCargar() {
  // Cargar desde Supabase — misma tabla que usa el director (comentarios_internos)
  if (sb && currentPerfil) {
    try {
      const cct   = currentPerfil.escuela_cct || window.ESCUELA_ACTIVA?.cct || (typeof _getCct==='function' ? _getCct() : null);
      const myId  = currentPerfil.id || null;
      let q = sb.from('comentarios_internos')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);
      if (cct) q = q.eq('escuela_cct', cct);
      // Ver mensajes: propios, dirigidos a mí, o generales (destinatario_id IS NULL)
      if (myId) {
        q = q.or(`remitente_id.eq.${myId},destinatario_id.eq.${myId},destinatario_id.is.null`);
      }
      const { data } = await q;
      if (data) {
        COMENTARIOS_INTERNOS = data.map(m => ({
          id: m.id,
          de: m.rol_autor || (m.remitente_id === myId ? (currentPerfil.rol||'docente') : 'director'),
          autor: m.remitente_nombre || m.nombre_autor || 'Dirección',
          texto: m.contenido || m.texto || '',
          fecha: new Date(m.created_at).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
        }));
      }
    } catch(e) {
      // Fallback localStorage
      COMENTARIOS_INTERNOS = JSON.parse(localStorage.getItem('siembra_comentarios_int')||'[]');
    }
  } else {
    COMENTARIOS_INTERNOS = JSON.parse(localStorage.getItem('siembra_comentarios_int')||'[]');
  }
  comentariosInternosRender();
}

function comentariosInternosRender() {
  const cont = document.getElementById('comentarios-internos-lista');
  if (!cont) return;
  const esDocente = currentPerfil?.rol === 'docente' || !currentPerfil?.rol;
  cont.innerHTML = COMENTARIOS_INTERNOS.map(c=>`
    <div style="display:flex;gap:10px;margin-bottom:14px;${c.de==='docente'||c.de==='tutor'?'':'flex-direction:row-reverse;'}">
      <div style="width:34px;height:34px;border-radius:50%;background:${c.de==='director'?'#1e3a5f':c.de==='docente'||c.de==='tutor'?'var(--verde)':'#7c3aed'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:white;flex-shrink:0;">${c.autor?.charAt(0).toUpperCase()||'?'}</div>
      <div style="flex:1;${c.de==='director'?'text-align:right;':''}">
        <div style="font-size:10px;color:var(--gris-50);margin-bottom:3px;">${c.autor} · ${c.fecha}</div>
        <div style="display:inline-block;background:${c.de==='director'?'#eff6ff':c.de==='docente'||c.de==='tutor'?'var(--verde-light)':'#faf5ff'};border-radius:10px;padding:10px 14px;font-size:13px;line-height:1.5;max-width:85%;text-align:left;">${c.texto}</div>
      </div>
    </div>`).join('')||'<div style="text-align:center;padding:30px;color:var(--gris-50);">💬 No hay mensajes aún. Escribe el primero.</div>';
  cont.scrollTop = cont.scrollHeight;
}

async function comentarioInternoEnviar() {
  const input = document.getElementById('comentario-interno-input');
  const txt = input?.value.trim();
  if (!txt) return;
  input.value = '';
  const nuevo = {
    de: currentPerfil?.rol || 'docente',
    autor: [currentPerfil?.nombre, currentPerfil?.apellido_p].filter(Boolean).join(' ') || 'Docente',
    texto: txt,
    fecha: new Date().toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
  };
  COMENTARIOS_INTERNOS.push(nuevo);
  comentariosInternosRender();

  // Guardar en Supabase — misma tabla que el director (comentarios_internos)
  if (sb && currentPerfil) {
    try {
      const _cctEnv = currentPerfil.escuela_cct || window.ESCUELA_ACTIVA?.cct || (typeof _getCct==='function' ? _getCct() : null);
      await sb.from('comentarios_internos').insert({
        escuela_cct:      _cctEnv,
        remitente_id:     currentPerfil.id,
        remitente_nombre: nuevo.autor,
        rol_autor:        nuevo.de,
        destinatario_id:  null, // broadcast a dirección
        contenido:        txt,
        texto:            txt,
        leido:            false,
        created_at:       new Date().toISOString(),
      });
    } catch(e) {
      try { localStorage.setItem('siembra_comentarios_int', JSON.stringify(COMENTARIOS_INTERNOS)); } catch(_){}
    }
  } else {
    try { localStorage.setItem('siembra_comentarios_int', JSON.stringify(COMENTARIOS_INTERNOS)); } catch(_){}
  }
}


function tspRenderDash() {
  // Si TSR ya cargó datos reales, delegar a él
  if (window.TSR && TSR.alumnos?.length) { TSR.renderDashboard(); return; }
  // Usar datos reales de Supabase si están disponibles
  const _tsCasosFuente = (window._tsCasosDB && window._tsCasosDB.length) ? window._tsCasosDB : TS_CASOS;
  // KPIs
  const kpiEl = document.getElementById('tsp-kpis');
  if(kpiEl) {
    const total    = _tsCasosFuente.length;
    const urgentes = _tsCasosFuente.filter(c=>c.estado==='urgente'||c.prioridad==='urgente').length;
    const seguim   = _tsCasosFuente.filter(c=>c.estado==='seguimiento'||c.estado==='activo').length;
    const derivados= _tsCasosFuente.filter(c=>c.derivadoA).length;
    const kpis = [
      {ico:'📋',val:total,    lbl:'Total de casos',     color:'#1e3a5f',bg:'#eff6ff'},
      {ico:'🔴',val:urgentes, lbl:'Casos urgentes',     color:'#b91c1c',bg:'#fee2e2'},
      {ico:'🟡',val:seguim,   lbl:'En seguimiento',     color:'#a16207',bg:'#fef9c3'},
      {ico:'📤',val:derivados,lbl:'Derivados',          color:'#15803d',bg:'#dcfce7'},
    ];
    kpiEl.innerHTML = kpis.map(k=>`
      <div style="background:${k.bg};border-radius:14px;padding:18px;border:1.5px solid ${k.color}22;cursor:pointer;" onclick="tsNav('casos')">
        <div style="font-size:24px;margin-bottom:8px;">${k.ico}</div>
        <div style="font-size:30px;font-weight:800;font-family:'Fraunces',serif;color:${k.color};line-height:1;">${k.val}</div>
        <div style="font-size:11px;font-weight:700;color:${k.color};opacity:.7;margin-top:4px;">${k.lbl}</div>
      </div>`).join('');
  }

  // Alertas urgentes
  const urgEl = document.getElementById('tsp-alertas-urgentes');
  if(urgEl) {
    const urg = _tsCasosFuente.filter(c=>c.estado==='urgente'||c.prioridad==='urgente');
    if(urg.length) {
      const badge = document.getElementById('ts-badge-urgentes');
      if(badge){ badge.style.display='block'; badge.textContent = `🔴 ${urg.length} urgente${urg.length>1?'s':''}`; }
      urgEl.innerHTML = `<div style="background:#fef2f2;border:2px solid #fecaca;border-radius:14px;padding:16px 20px;margin-bottom:4px;">
        <div style="font-size:12px;font-weight:800;color:#b91c1c;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">🚨 Casos urgentes — requieren atención inmediata</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${urg.map(c=>{
            const nombreA = c.alumno_nombre || (typeof alumnos!=='undefined'&&alumnos[c.alumnoIdx]?alumnos[c.alumnoIdx].n:'Alumno');
            const tipo=TS_TIPOS[c.tipo]||TS_TIPOS.otro;
            const cid = typeof c.id==='number'?c.id:'"'+c.id+'"';
            return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:white;border-radius:10px;border:1px solid #fecaca;cursor:pointer;" onclick="tspAbrirCaso(${cid})">
              <span style="font-size:20px;">${tipo.ico}</span>
              <div style="flex:1;"><div style="font-size:13px;font-weight:700;">${nombreA}</div><div style="font-size:11px;color:#b91c1c;">${tipo.lbl} · ${c.fecha_apertura||c.fecha||'—'}</div></div>
              <button onclick="event.stopPropagation();tspAbrirCaso(${cid})" style="padding:5px 12px;background:#fee2e2;border:1px solid #fca5a5;border-radius:7px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;color:#b91c1c;cursor:pointer;">Ver caso →</button>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    } else {
      urgEl.innerHTML='';
    }
  }

  // Casos recientes
  const recEl = document.getElementById('tsp-casos-recientes');
  if(recEl) {
    const rec = _tsCasosFuente.slice(0,4);
    recEl.innerHTML = rec.length ? rec.map(c=>tspCasoMiniCard(c)).join('') : '<div style="color:#94a3b8;font-size:13px;padding:20px;text-align:center;">Sin casos registrados</div>';
  }

  // Fichas pendientes IA
  const ficEl = document.getElementById('tsp-fichas-pendientes');
  if(ficEl && typeof FICHAS_DATA!=='undefined' && typeof alumnos!=='undefined') {
    const pendientes = Object.entries(FICHAS_DATA)
      .filter(([i,fd])=>fd._ultimoAnalisis && (fd._ultimoAnalisis.derivaciones||[]).some(d=>d.aplicar))
      .slice(0,4);
    ficEl.innerHTML = pendientes.length
      ? pendientes.map(([i,fd])=>{
          const a=alumnos[parseInt(i)];
          const col=COLORES_AVATARES[parseInt(i)%COLORES_AVATARES.length];
          const inis=a?a.n.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase():'??';
          const deriv=(fd._ultimoAnalisis.derivaciones||[]).filter(d=>d.aplicar);
          return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:white;border-radius:10px;border:1.5px solid #dde5f0;margin-bottom:8px;cursor:pointer;" onclick="tsNav('fichas-ia')">
            <div style="width:32px;height:32px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:white;flex-shrink:0;">${inis}</div>
            <div style="flex:1;"><div style="font-size:13px;font-weight:600;">${a?a.n:'—'}</div><div style="font-size:11px;color:#64748b;">${deriv.length} derivación${deriv.length>1?'es':''} recomendada${deriv.length>1?'s':''}</div></div>
            <span style="font-size:10px;background:#fef9c3;color:#a16207;padding:2px 8px;border-radius:99px;font-weight:700;">Revisar</span>
          </div>`;
        }).join('')
      : '<div style="color:#94a3b8;font-size:13px;padding:20px;text-align:center;background:white;border-radius:12px;border:1.5px solid #dde5f0;">Sin análisis IA pendientes</div>';
  }
}

function tspCasoMiniCard(c) {
  const a = typeof alumnos!=='undefined'?alumnos[c.alumnoIdx]:null;
  const tipo = TS_TIPOS[c.tipo]||TS_TIPOS.otro;
  const est  = TS_ESTADOS[c.estado]||TS_ESTADOS.seguimiento;
  return `<div class="ts-p-caso" onclick="tspAbrirCaso(${c.id})">
    <div class="ts-p-caso-stripe ${c.estado}"></div>
    <div class="ts-p-caso-body">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="font-size:20px;">${tipo.ico}</span>
        <div style="flex:1;"><div style="font-size:13px;font-weight:700;">${a?a.n:'Alumno'}</div><div style="font-size:11px;color:#64748b;">${tipo.lbl} · ${c.fecha||'—'}</div></div>
        <span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:99px;background:${est.bg};color:${est.color};">${est.dot} ${est.lbl}</span>
      </div>
      <div style="font-size:12px;color:#475569;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${c.desc}</div>
      ${c.derivadoA?`<div style="margin-top:8px;font-size:11px;color:#15803d;font-weight:700;">📤 Derivado a: ${c.derivadoA}</div>`:''}
    </div>
  </div>`;
}

function tspRenderCasos() {
  // Si TSR tiene datos reales, delegar
  if (window.TSR && TSR.incidencias?.length) { TSR.renderCasos(); return; }
  const cont = document.getElementById('tsp-casos-lista');
  if(!cont) return;
  const filEst = document.getElementById('tsp-fil-estado')?.value||'';
  const filTipo= document.getElementById('tsp-fil-tipo')?.value||'';
  // Usar datos reales de Supabase si están disponibles
  const _fuente = (window._tsCasosDB && window._tsCasosDB.length) ? window._tsCasosDB : TS_CASOS;
  let casos = _fuente.filter(c=>(!filEst||c.estado===filEst)&&(!filTipo||c.tipo===filTipo));
  cont.innerHTML = casos.length ? casos.map(c=>tspCasoMiniCard(c)).join('') :
    '<div style="text-align:center;padding:60px;color:#94a3b8;"><div style="font-size:40px;margin-bottom:10px;">📋</div><div>Sin casos para estos filtros</div></div>';
}
function tspFiltrar() { tspRenderCasos(); }

function tspRenderFichasIA() {
  const cont = document.getElementById('tsp-fichas-lista');
  if(!cont || typeof alumnos==='undefined') return;
  cont.innerHTML = alumnos.map((a,i)=>{
    const fd = typeof FICHAS_DATA!=='undefined'?FICHAS_DATA[i]:null;
    const hasAnalysis = fd&&fd._ultimoAnalisis;
    const hasDeriv = hasAnalysis&&(fd._ultimoAnalisis.derivaciones||[]).some(d=>d.aplicar);
    const col = COLORES_AVATARES[i%COLORES_AVATARES.length];
    const inis = a.n.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9;transition:.15s;${tspFichaSeleccionada===i?'background:#eff6ff;':'background:white;'}" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='${tspFichaSeleccionada===i?'#eff6ff':'white'}'" onclick="tspVerFichaIA(${i})">
      <div style="width:32px;height:32px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:white;flex-shrink:0;">${inis}</div>
      <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.n}</div></div>
      ${hasDeriv?'<span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;flex-shrink:0;" title="Derivación pendiente"></span>':hasAnalysis?'<span style="width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0;" title="Sin alertas"></span>':'<span style="width:8px;height:8px;border-radius:50%;background:#e2e8f0;flex-shrink:0;" title="Sin análisis"></span>'}
    </div>`;
  }).join('');
}

function tspVerFichaIA(idx) {
  tspFichaSeleccionada = idx;
  tspRenderFichasIA(); // refresh selection
  const det = document.getElementById('tsp-ficha-detalle');
  if(!det) return;
  const a  = alumnos[idx];
  const fd = typeof FICHAS_DATA!=='undefined'?FICHAS_DATA[idx]:null;
  const col= COLORES_AVATARES[idx%COLORES_AVATARES.length];
  const inis=a.n.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();

  if(!fd || !fd._ultimoAnalisis) {
    det.innerHTML = `<div style="background:white;border-radius:14px;border:1.5px solid #dde5f0;padding:40px;text-align:center;color:#94a3b8;">
      <div style="font-size:40px;margin-bottom:10px;">📋</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">${a.n}</div>
      <div style="font-size:12px;">El docente aún no ha generado un análisis IA para esta ficha.<br>Cuando lo haga, aparecerá aquí con las recomendaciones.</div>
    </div>`;
    return;
  }

  const res = fd._ultimoAnalisis;
  const urgColors = {alta:'#fee2e2;color:#b91c1c',media:'#fef9c3;color:#a16207',baja:'#dcfce7;color:#15803d'};
  const urgLabels = {alta:'🔴 Urgente',media:'🟡 Media',baja:'🟢 Baja'};
  const deriv = (res.derivaciones||[]).filter(d=>d.aplicar);

  det.innerHTML = `
    <!-- Cabecera alumno -->
    <div style="background:linear-gradient(135deg,var(--ts-azul),#2455a4);border-radius:14px;padding:20px 22px;margin-bottom:16px;display:flex;align-items:center;gap:16px;">
      <div style="width:52px;height:52px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:white;border:2.5px solid rgba(255,255,255,.3);flex-shrink:0;">${inis}</div>
      <div style="flex:1;"><div style="font-family:'Fraunces',serif;font-size:18px;color:white;font-weight:700;">${a.n}</div><div style="font-size:11px;color:rgba(255,255,255,.5);">6° A · Análisis generado por el docente</div></div>
    </div>

    <!-- Resumen -->
    <div style="background:white;border-radius:14px;padding:16px 18px;margin-bottom:12px;border:1.5px solid #dde5f0;">
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">📋 Resumen pedagógico</div>
      <div style="font-size:13px;line-height:1.7;color:#334155;">${res.resumen||'—'}</div>
    </div>

    <!-- Dos columnas: fortalezas / alertas -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <div style="background:#f0fdf4;border-radius:12px;padding:14px;border:1.5px solid #86efac;">
        <div style="font-size:10px;font-weight:800;color:#15803d;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">💪 Fortalezas</div>
        ${(res.fortalezas||[]).map(f=>`<div style="font-size:12px;color:#166534;margin-bottom:5px;">✅ ${f}</div>`).join('')||'—'}
      </div>
      <div style="background:#fef2f2;border-radius:12px;padding:14px;border:1.5px solid #fecaca;">
        <div style="font-size:10px;font-weight:800;color:#b91c1c;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">⚠️ Áreas de atención</div>
        ${(res.alertas||[]).map(a=>`<div style="font-size:12px;color:#991b1b;margin-bottom:5px;">⚠️ ${a}</div>`).join('')||'—'}
      </div>
    </div>

    <!-- Derivaciones recomendadas -->
    ${deriv.length ? `
    <div style="background:white;border-radius:14px;padding:16px 18px;margin-bottom:14px;border:2px solid #fde68a;">
      <div style="font-size:11px;font-weight:800;color:#92400e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">📤 Derivaciones recomendadas por la IA</div>
      ${deriv.map(d=>`<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 14px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;margin-bottom:8px;">
        <div style="flex:1;"><div style="font-size:13px;font-weight:700;margin-bottom:3px;">${d.instancia}</div><div style="font-size:12px;color:#64748b;line-height:1.5;">${d.motivo}</div></div>
        <span style="padding:2px 9px;border-radius:99px;font-size:10px;font-weight:800;background:${urgColors[d.urgencia]||urgColors.baja};">${urgLabels[d.urgencia]||'🟢 Baja'}</span>
      </div>`).join('')}
    </div>` : `<div style="background:#f0fdf4;border-radius:12px;padding:14px;border:1.5px solid #86efac;margin-bottom:14px;font-size:13px;color:#15803d;">✅ La IA no detectó necesidad de derivación para este alumno.</div>`}

    <!-- Acciones TS -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn btn-primary btn-sm" style="background:var(--ts-azul);border-color:var(--ts-azul);" onclick="tspDerivacionRapida(${idx})">📤 Derivar caso</button>
      <button class="btn btn-outline btn-sm" onclick="tspCrearCasoDesde(${idx})">📋 Crear caso formal</button>
      <button class="btn btn-outline btn-sm" onclick="tspGenerarReporteAlumno(${idx})">⬇ Exportar reporte</button>
    </div>
  `;
}

function tspDerivacionRapida(idx) {
  const a = alumnos[idx];
  hubToast(`📤 Derivando caso de ${a.n}…`);
  // Add to casos if not already there
  const existe = TS_CASOS.find(c=>c.alumnoIdx===idx&&c.estado!=='resuelto');
  if(existe) { existe.estado='seguimiento'; hubToast(`📤 Caso de ${a.n} marcado para derivación · Ve a "Derivar casos"`, 'ok'); }
  else { fichaEnviarTS(); }
  tsNav('derivaciones');
}
function tspCrearCasoDesde(idx) { fichaAlumnoActual=idx; fichaEnviarTS(); tsNav('casos'); hubToast('📋 Caso creado · Ve a "Casos activos"','ok'); }
async function tspGenerarReporteAlumno(idx) {
  const a = alumnos[idx];
  if (!a) { hubToast('Alumno no encontrado', 'warn'); return; }
  hubToast('⏳ Generando reporte…', 'ok');
  const cct = window.currentPerfil?.escuela_cct || '—';
  const ciclo = window.CICLO_ACTIVO || '2025-2026';
  const caso = TS_CASOS.find(c => c.alumnoIdx === idx);
  const tipo = caso ? (TS_TIPOS[caso.tipo] || TS_TIPOS.otro) : null;
  // Intentar cargar calificaciones reales
  let calHtml = '<td colspan="2" style="padding:8px;color:#94a3b8;">Sin datos</td>';
  try {
    if (window.sb && a.id) {
      const { data: cals } = await window.sb.from('calificaciones')
        .select('materia,calificacion').eq('alumno_id', a.id).eq('ciclo', ciclo);
      if (cals?.length) {
        calHtml = cals.map(c => `<tr><td style="padding:6px 10px;border:1px solid #e2e8f0;">${c.materia||'—'}</td><td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;font-weight:700;">${c.calificacion||'—'}</td></tr>`).join('');
      }
    }
  } catch(e) {}
  const fecha = new Date().toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' });
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte TS — ${a.n}</title>
  <style>body{font-family:Arial,sans-serif;margin:32px;font-size:13px;color:#1e293b;}
  h1{color:#1e40af;font-size:18px;margin-bottom:4px;}h2{font-size:14px;color:#475569;font-weight:600;margin:18px 0 8px;}
  .badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;}
  table{width:100%;border-collapse:collapse;margin-bottom:14px;}th{background:#f0f9ff;padding:7px 10px;text-align:left;border:1px solid #bfdbfe;font-size:12px;}
  .footer{margin-top:32px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;}
  @media print{button{display:none!important}}</style></head><body>
  <h1>📋 Reporte de Trabajo Social</h1>
  <div style="font-size:12px;color:#64748b;margin-bottom:20px;">Escuela: <strong>${cct}</strong> · Ciclo: <strong>${ciclo}</strong> · Fecha: <strong>${fecha}</strong></div>
  <h2>Datos del alumno</h2>
  <table><tr><th>Nombre</th><td style="padding:7px 10px;border:1px solid #e2e8f0;">${a.n}</td></tr>
    <tr><th>Grupo</th><td style="padding:7px 10px;border:1px solid #e2e8f0;">${a.grupo||'—'}</td></tr>
    ${caso ? `<tr><th>Tipo de caso</th><td style="padding:7px 10px;border:1px solid #e2e8f0;">${tipo?.lbl||caso.tipo}</td></tr>
    <tr><th>Estado</th><td style="padding:7px 10px;border:1px solid #e2e8f0;">${caso.estado||'—'}</td></tr>
    ${caso.derivadoA ? `<tr><th>Derivado a</th><td style="padding:7px 10px;border:1px solid #e2e8f0;">${caso.derivadoA}</td></tr>` : ''}
    ${caso.descripcion ? `<tr><th>Descripción</th><td style="padding:7px 10px;border:1px solid #e2e8f0;">${caso.descripcion}</td></tr>` : ''}` : ''}
  </table>
  <h2>Calificaciones del ciclo</h2>
  <table><thead><tr><th>Materia</th><th style="text-align:center;">Calificación</th></tr></thead><tbody>${calHtml}</tbody></table>
  <div class="footer">Generado por SIEMBRA · Sistema de Gestión Escolar · ${cct}<br>
  <em>Este documento es de uso interno. Confidencialidad garantizada por RLS.</em></div>
  <br><button onclick="window.print()" style="padding:8px 20px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">🖨️ Imprimir / Guardar PDF</button>
  </body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
  else hubToast('⚠️ Permite ventanas emergentes para exportar', 'warn');
}

function tspRenderDerivar() {
  const lista = document.getElementById('tsp-derivar-lista');
  if(!lista) return;
  const pendientes = TS_CASOS.filter(c=>c.estado!=='resuelto');
  lista.innerHTML = pendientes.length ? pendientes.map(c=>{
    const a=alumnos[c.alumnoIdx];const tipo=TS_TIPOS[c.tipo]||TS_TIPOS.otro;
    return `<div class="ts-p-caso" onclick="tspSelDerivCaso(${c.id})" style="${tspDerivCasoSel===c.id?'border-color:#3b82f6;':''}">
      <div class="ts-p-caso-stripe ${c.estado}"></div>
      <div class="ts-p-caso-body" style="padding:12px 14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:18px;">${tipo.ico}</span>
          <div style="flex:1;"><div style="font-size:13px;font-weight:700;">${a?a.n:'—'}</div><div style="font-size:11px;color:#64748b;">${tipo.lbl}</div></div>
          ${c.derivadoA?`<span style="font-size:10px;background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:99px;font-weight:700;">✅ ${c.derivadoA}</span>`:''}
        </div>
      </div>
    </div>`;
  }).join('') : '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">Sin casos pendientes</div>';
}

function tspSelDerivCaso(id) {
  tspDerivCasoSel = id;
  tspRenderDerivar();
  const panel = document.getElementById('tsp-derivar-panel');
  if(!panel) return;
  const c = TS_CASOS.find(x=>x.id===id);
  const a = c?alumnos[c.alumnoIdx]:null;
  if(!c||!a) return;
  panel.innerHTML = `
    <div style="background:white;border-radius:14px;border:1.5px solid #dde5f0;padding:20px;">
      <div style="font-size:14px;font-weight:700;color:var(--ts-azul);margin-bottom:4px;">Derivar caso de ${a.n}</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:18px;">${(TS_TIPOS[c.tipo]||TS_TIPOS.otro).lbl} · Selecciona la instancia:</div>
      <div id="tsp-opts-deriv">
        ${DERIVAR_INSTANCIAS.map(inst=>`
          <div class="ts-derivar-opt" id="deriv-opt-${inst.id}" onclick="tspToggleDeriv('${inst.id}')">
            <div class="ts-derivar-ico" style="background:${inst.color};">${inst.ico}</div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:700;">${inst.lbl}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">${inst.desc}</div>
              ${inst.tel ? `<div style="font-size:11px;font-weight:700;color:#15803d;margin-top:3px;">📞 ${inst.tel}</div>` : ''}
            </div>
            <div id="deriv-check-${inst.id}" style="width:18px;height:18px;border-radius:50%;border:2px solid #dde5f0;flex-shrink:0;"></div>
          </div>`).join('')}
      </div>
      <div style="margin-top:14px;">
        <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">Notas de derivación</label>
        <textarea id="deriv-notas" style="width:100%;padding:8px 12px;border:1.5px solid #dde5f0;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;resize:none;height:70px;outline:none;" placeholder="Indica los motivos específicos, folio o número de caso externo…"></textarea>
      </div>
      <div style="margin-top:12px;display:flex;justify-content:flex-end;">
        <button onclick="tspConfirmarDerivacion(${id})" style="background:var(--ts-azul);color:white;border:none;padding:10px 20px;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">📤 Confirmar derivación</button>
      </div>
    </div>`;
}

let tspDerivSeleccionadas = new Set();
function tspToggleDeriv(id) {
  if(tspDerivSeleccionadas.has(id)) tspDerivSeleccionadas.delete(id);
  else tspDerivSeleccionadas.add(id);
  DERIVAR_INSTANCIAS.forEach(inst=>{
    const opt = document.getElementById('deriv-opt-'+inst.id);
    const chk = document.getElementById('deriv-check-'+inst.id);
    if(opt&&chk){
      const sel = tspDerivSeleccionadas.has(inst.id);
      opt.style.borderColor = sel?'#3b82f6':'#e2e8f0';
      opt.style.background  = sel?'#eff6ff':'white';
      chk.style.background  = sel?'#3b82f6':'';;
      chk.style.borderColor = sel?'#3b82f6':'#dde5f0';
      chk.innerHTML         = sel?'<svg viewBox="0 0 10 8" style="width:10px;height:10px;margin:2px;"><polyline points="1,4 4,7 9,1" stroke="white" stroke-width="1.5" fill="none"/></svg>':'';
    }
  });
}

async function tspConfirmarDerivacion(casoId) {
  if(!tspDerivSeleccionadas.size){ hubToast('⚠️ Selecciona al menos una instancia','warn'); return; }
  const c = TS_CASOS.find(x=>x.id===casoId);
  if(!c) return;
  const instancias = [...tspDerivSeleccionadas].map(id=>DERIVAR_INSTANCIAS.find(x=>x.id===id)?.lbl).join(', ');
  const notas = document.getElementById('deriv-notas')?.value||'';
  // Actualizar memoria local
  c.derivadoA = instancias;
  c.estado = 'seguimiento';
  c.notas_deriv = notas;
  // Guardar en Supabase
  try {
    if (window.sb && c.db_id) {
      await window.sb.from('casos_trabajo_social').update({
        estado: 'seguimiento',
        derivado_a: instancias,
        notas_derivacion: notas,
        fecha_derivacion: new Date().toISOString(),
      }).eq('id', c.db_id);
    } else if (window.sb) {
      const cct = window.currentPerfil?.escuela_cct;
      await window.sb.from('casos_trabajo_social').insert({
        escuela_cct: cct,
        alumno_id: c.alumno_id || null,
        tipo: c.tipo || 'general',
        estado: 'seguimiento',
        derivado_a: instancias,
        notas_derivacion: notas,
        fecha_derivacion: new Date().toISOString(),
        ts_id: window.currentPerfil?.id || null,
        descripcion: c.descripcion || '',
      });
    }
  } catch(e) { console.warn('[TS] derivacion save:', e.message); }
  tspDerivSeleccionadas.clear();
  hubToast(`✅ Caso derivado a: ${instancias}`,'ok');
  tspRenderDerivar();
}

function tspRenderHistorial() {
  const cont = document.getElementById('tsp-historial-lista');
  if(!cont) return;
  cont.innerHTML = TS_CASOS.map(c=>tspCasoMiniCard(c)).join('') ||
    '<div style="text-align:center;padding:60px;color:#94a3b8;">Sin casos en el historial</div>';
}

function tspRenderProtocolos() {
  const cont = document.getElementById('tsp-protos-grid');
  if(!cont) return;
  const protos = [
    {tipo:'violencia',color:'#fef2f2',border:'#fecaca',ico:'🚨',lbl:'Violencia familiar / maltrato'},
    {tipo:'drogas',   color:'#fdf4ff',border:'#d8b4fe',ico:'💊',lbl:'Uso de sustancias'},
    {tipo:'faltas',   color:'#fff7ed',border:'#fdba74',ico:'📅',lbl:'Faltas recurrentes'},
    {tipo:'riesgo',   color:'#fffbeb',border:'#fde68a',ico:'⚠️',lbl:'Situación de riesgo'},
  ];
  cont.innerHTML = protos.map(p=>{
    const proto = TS_PROTOCOLOS[p.tipo];
    return `<div style="background:${p.color};border:2px solid ${p.border};border-radius:14px;padding:18px;cursor:pointer;" onclick="tspExpandProto('${p.tipo}',this)">
      <div style="font-size:26px;margin-bottom:10px;">${p.ico}</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">${p.lbl}</div>
      <div id="proto-steps-${p.tipo}" style="display:none;margin-top:14px;"></div>
      <button style="margin-top:10px;background:rgba(0,0,0,.07);border:none;padding:6px 14px;border-radius:7px;font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;">Ver protocolo ▾</button>
    </div>`;
  }).join('');
}

function tspExpandProto(tipo, card) {
  const cont = document.getElementById('proto-steps-'+tipo);
  if(!cont) return;
  const open = cont.style.display!=='none';
  cont.style.display = open?'none':'block';
  if(!open && TS_PROTOCOLOS[tipo]) {
    cont.innerHTML = TS_PROTOCOLOS[tipo].steps.map((s,i)=>`
      <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.07);">
        <div style="width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.12);font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">${i+1}</div>
        <div><div style="font-size:12px;font-weight:700;margin-bottom:2px;">${s.lbl}</div><div style="font-size:11px;opacity:.7;line-height:1.5;">${s.txt}</div></div>
      </div>`).join('');
  }
}

function tspRenderReportes() {
  const cont = document.getElementById('tsp-reportes-grid');
  if(!cont) return;
  const total=TS_CASOS.length,urg=TS_CASOS.filter(c=>c.estado==='urgente').length,
        deriv=TS_CASOS.filter(c=>c.derivadoA).length;
  cont.innerHTML = [
    {ico:'📊',lbl:'Reporte mensual de casos',sub:'Todos los casos del mes con estado y derivaciones',btn:'⬇ Descargar Excel'},
    {ico:'📤',lbl:'Reporte de derivaciones',sub:'Listado de casos derivados por instancia',btn:'⬇ Descargar PDF'},
    {ico:'🏫',lbl:'Informe para Dirección',sub:'Resumen ejecutivo para el director/a',btn:'⬇ Descargar PDF'},
    {ico:'⚖️',lbl:'Acta de intervención',sub:'Formato oficial con firmas para expediente',btn:'Generar acta'},
    {ico:'📋',lbl:'Estadísticas del ciclo',sub:`${total} casos · ${urg} urgentes · ${deriv} derivados`,btn:'Ver estadísticas'},
    {ico:'🔒',lbl:'Expediente por alumno',sub:'Historial completo e individual del alumno',btn:'Seleccionar alumno'},
  ].map(r=>`<div style="background:white;border-radius:14px;padding:18px;border:1.5px solid #dde5f0;display:flex;flex-direction:column;gap:8px;">
    <div style="font-size:30px;">${r.ico}</div>
    <div style="font-size:13px;font-weight:700;color:var(--ts-azul);">${r.lbl}</div>
    <div style="font-size:12px;color:#64748b;flex:1;">${r.sub}</div>
    <button onclick="tspGenerarReporteTipo(r&&r.tipo?r.tipo:'general')" style="background:#eff6ff;border:1.5px solid #93c5fd;color:#1d4ed8;padding:7px 14px;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;margin-top:4px;">${r.btn}</button>
  </div>`).join('');
}

function tspAbrirCaso(id) {
  const c = TS_CASOS.find(x=>x.id===id);
  if(!c) return;
  const a = alumnos[c.alumnoIdx];
  const tipo = TS_TIPOS[c.tipo]||TS_TIPOS.otro;
  const est  = TS_ESTADOS[c.estado]||TS_ESTADOS.seguimiento;
  document.getElementById('modal-tsp-titulo').textContent = `${tipo.ico} ${a?a.n:'—'} — ${tipo.lbl}`;
  document.getElementById('modal-tsp-contenido').innerHTML = `
    <div class="ts-detalle-campo"><label>Estado</label><div class="valor"><span style="font-weight:700;color:${est.color};">${est.dot} ${est.lbl}</span></div></div>
    <div class="ts-detalle-campo"><label>Fecha de detección</label><div class="valor">${c.fecha||'—'}</div></div>
    <div class="ts-detalle-campo"><label>Descripción objetiva</label><div class="valor">${c.desc||'—'}</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      <div class="ts-detalle-campo"><label>Notificado a dirección</label><div class="valor">${c.notifDir||'—'}</div></div>
      <div class="ts-detalle-campo"><label>Contacto con familia</label><div class="valor">${c.notifFam||'—'}</div></div>
      <div class="ts-detalle-campo"><label>Canalización externa</label><div class="valor">${c.canalizo||'—'}</div></div>
      <div class="ts-detalle-campo"><label>Institución / Folio</label><div class="valor">${c.instExterna||'—'}</div></div>
    </div>
    <div class="ts-detalle-campo"><label>Acciones tomadas</label><div class="valor">${c.acciones||'—'}</div></div>
    ${c.derivadoA?`<div class="ts-detalle-campo"><label>Derivado a</label><div class="valor" style="color:#15803d;font-weight:700;">📤 ${c.derivadoA}</div></div>`:''}
    <div class="ts-detalle-campo"><label>Próxima revisión</label><div class="valor">${c.proxFecha||'—'}</div></div>
    <div class="ts-detalle-campo"><label>Responsable</label><div class="valor">${c.responsable||'—'}</div></div>
    <div style="margin-top:16px;padding:12px 14px;background:#f0f4fa;border-radius:10px;font-size:11px;color:#64748b;border-left:3px solid #3b82f6;">
      ⚖️ Este expediente es confidencial. Solo puede ser consultado por Trabajo Social, Dirección y personal autorizado según LGDNNA y Protocolo SEP.
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
      <button onclick="tspCambiarEstado(${id})" style="padding:8px 16px;background:#eff6ff;border:1.5px solid #93c5fd;color:#1d4ed8;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">Cambiar estado</button>
      <button onclick="tspCerrarModal()" style="padding:8px 16px;background:white;border:1.5px solid #dde5f0;color:#475569;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">Cerrar</button>
    </div>`;
  const ov = document.getElementById('modal-tsp-caso');
  if(ov){ ov.style.opacity='1'; ov.style.pointerEvents='all'; document.getElementById('modal-tsp-box').style.transform='translateY(0)'; }
}

function tspCerrarModal() {
  const ov = document.getElementById('modal-tsp-caso');
  if(ov){ ov.style.opacity='0'; ov.style.pointerEvents='none'; }
}

function tspCambiarEstado(id) {
  const c = TS_CASOS.find(x=>x.id===id);
  if(!c) return;
  const estados = ['urgente','seguimiento','resuelto'];
  const idx = estados.indexOf(c.estado);
  c.estado = estados[(idx+1)%3];
  tspCerrarModal();
  tspAbrirCaso(id);
  hubToast(`Estado actualizado: ${TS_ESTADOS[c.estado].dot} ${TS_ESTADOS[c.estado].lbl}`,'ok');
}

// ══════════════════════════════════════════════════════════════════
//  SISTEMA MULTI-ESCUELA + REGISTRO + DIRECTORIO TS
// ══════════════════════════════════════════════════════════════════

// ── Base de datos demo de escuelas ──
// ══════════════════════════════════════════════════════════════════
//  SISTEMA CCT — Supabase (fuente principal) + SIGED (fallback info)
//
//  Arquitectura real de producción:
//  ┌─────────────────────────────────────────────────────────────┐
//  │  tabla Supabase: escuelas                                   │
//  │   cct TEXT PK, nombre, municipio, estado, zona, sector,    │
//  │   turno, nivel, sostenimiento, director, tel, activa BOOL  │
//  │                                                             │
//  │  tabla Supabase: usuario_escuelas                           │
//  │   usuario_id UUID, escuela_cct TEXT, rol TEXT,             │
//  │   activo BOOL, fecha_solicitud TIMESTAMP                   │
//  │                                                             │
//  │  Carga inicial: CSV oficial SEP datos.gob.mx               │
//  │  ~250,000 registros cargados via script de importación     │
//  └─────────────────────────────────────────────────────────────┘
//
//  En esta demo: fallback local con escuelas de prueba
// ══════════════════════════════════════════════════════════════════

// Escuelas demo (en producción esto viene de Supabase)
const ESCUELAS_DEMO = window.SiembraDemoFixtures?.escuelas || [];

let USUARIO_ESCUELAS = window._escuelaCfg?.cct
  ? [{
      id: window._escuelaCfg.id || null,
      cct: window._escuelaCfg.cct,
      nombre: window._escuelaCfg.nombre || 'Mi escuela',
      nivel: window._escuelaCfg.nivel || window._escuelaCfg.nivel_default || 'secundaria',
      nivel_default: window._escuelaCfg.nivel_default || 'secundaria',
      turno: window._escuelaCfg.turno || '',
      rol: 'docente',
      grupos: [],
    }]
  : [];
let ESCUELA_ACTIVA = USUARIO_ESCUELAS[0] || null;

// ── Validar formato CCT (2 letras + 3 letras + 4 nums + 1 letra) ──
function cctValidarFormato(cct) {
  return /^[0-9]{2}[A-Z]{1}[A-Z]{2}[0-9]{4}[A-Z]{1}$/.test(cct.toUpperCase());
}

// ── Decodificar CCT (sin consulta, solo del código) ──
const CCT_ESTADOS = {
  '01':'Aguascalientes','02':'Baja California','03':'Baja California Sur','04':'Campeche',
  '05':'Coahuila','06':'Colima','07':'Chiapas','08':'Chihuahua','09':'Ciudad de México',
  '10':'Durango','11':'Guanajuato','12':'Guerrero','13':'Hidalgo','14':'Jalisco',
  '15':'Estado de México','16':'Michoacán','17':'Morelos','18':'Nayarit','19':'Nuevo León',
  '20':'Oaxaca','21':'Puebla','22':'Querétaro','23':'Quintana Roo','24':'San Luis Potosí',
  '25':'Sinaloa','26':'Sonora','27':'Tabasco','28':'Tamaulipas','29':'Tlaxcala',
  '30':'Veracruz','31':'Yucatán','32':'Zacatecas',
};
const CCT_NIVELES = {
  'PR':'Primaria','ES':'Secundaria','EP':'Preescolar','BA':'Bachillerato',
  'TC':'Telesecundaria','FI':'Educación Física','EE':'Ed. Especial',
  'BI':'Bilingüe','IN':'Inicial','CB':'CBTIS','SD':'SNTE',
};
const CCT_SOST = { 'D':'Federal transferido','E':'Estatal','P':'Particular','F':'Federal directo' };

function cctDecodificar(cct) {
  const v = cct.toUpperCase();
  const estadoClave = v.slice(0,2);
  const sostClave   = v.slice(2,3);
  const nivelClave  = v.slice(3,5);
  return {
    estado:       CCT_ESTADOS[estadoClave]  || `Estado ${estadoClave}`,
    nivel:        CCT_NIVELES[nivelClave]   || `Nivel ${nivelClave}`,
    sostenimiento:CCT_SOST[sostClave]       || `Sost. ${sostClave}`,
  };
}

// ── CAPA 1: Consulta Supabase por CCT ──
async function cctBuscarEnSupabase(cct) {
  if(!sb) return null;
  try {
    const { data, error } = await sb.from('escuelas').select('*').eq('cct', cct).single();
    if(error || !data) return null;
    return data;
  } catch(e) { return null; }
}

// ── CAPA 2: Fallback demo ──
function cctBuscarDemo(cct) {
  return ESCUELAS_DEMO.find(e => e.cct === cct) || null;
}

// ── Registro modularizado en app/core/registration.js ──

// ── Registro modularizado en app/core/registration.js ──

// ── Registro modularizado en app/core/registration.js ──

// ── Multi-escuela: abrir selector ──
function docAbrirEscuelaSel() {
  if(!document.getElementById('modal-escuela-sel')) {
    // Create modal on-the-fly
    const modal = document.createElement('div');
    modal.id = 'modal-escuela-sel';
    modal.className = 'escuela-modal-ov';
    modal.innerHTML = `<div class="escuela-modal-box">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;color:var(--verde);">🏫 Cambiar escuela</div>
        <button onclick="document.getElementById('modal-escuela-sel').classList.remove('open')" style="background:var(--gris-10);border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;" aria-label="Cerrar">✕</button>
      </div>
      <div id="escuela-sel-lista"></div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--gris-10);">
        <button onclick="docAgregarEscuela()" style="width:100%;padding:10px;background:var(--verde-light);border:1.5px dashed var(--verde-accent);border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:var(--verde);cursor:pointer;">+ Vincular otra escuela (CCT)</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  renderEscuelaSel();
  document.getElementById('modal-escuela-sel').classList.add('open');
}

function renderEscuelaSel() {
  const lista = document.getElementById('escuela-sel-lista');
  if(!lista) return;
  lista.innerHTML = USUARIO_ESCUELAS.map((e,i)=>`
    <div class="escuela-item ${ESCUELA_ACTIVA.cct===e.cct?'activa':''}" onclick="docCambiarEscuela(${i})">
      <div class="escuela-item-ico">🏫</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;">${e.nombre}</div>
        <div style="font-size:11px;color:#64748b;">${e.municipio} · Zona ${e.zona} · ${e.turno}</div>
        <div style="font-size:11px;color:#94a3b8;">CCT: ${e.cct}${e.nivel ? ' · ' + e.nivel : ''}</div>
      </div>
      ${ESCUELA_ACTIVA.cct===e.cct?'<span style="font-size:10px;font-weight:800;background:var(--verde-light);color:var(--verde);padding:2px 8px;border-radius:99px;">Activa</span>':''}
    </div>`).join('');
}

async function docCambiarEscuela(idx) {
  ESCUELA_ACTIVA = USUARIO_ESCUELAS[idx];
  const nombreEl = document.getElementById('doc-escuela-nombre');
  if(nombreEl) nombreEl.textContent = ESCUELA_ACTIVA.nombre;
  document.getElementById('modal-escuela-sel')?.classList.remove('open');
  hubToast(`⏳ Cambiando a ${ESCUELA_ACTIVA.nombre}…`);
  // Sincronizar nombre de escuela en topbars de todos los portales
  if (typeof _topbarSyncAll === 'function') _topbarSyncAll();

  // Actualizar nivel según la escuela seleccionada
  if (ESCUELA_ACTIVA.nivel) {
    const nivelEsc = ESCUELA_ACTIVA.nivel === 'primaria_y_secundaria'
      ? (ESCUELA_ACTIVA.nivel_default || 'secundaria')
      : ESCUELA_ACTIVA.nivel;
    window._nivelActivo = nivelEsc;
    try { localStorage.setItem('siembra_nivel', nivelEsc); } catch(e) {}
    cambiarNivel(nivelEsc);
  }

  // Recargar grupos de la nueva escuela
  const gruposDB = await cargarGruposDocente(ESCUELA_ACTIVA.cct);
  if (gruposDB.length) {
    window._gruposDocente = gruposDB;
    window._grupoActivo   = gruposDB[0].id;
    const g = gruposDB[0];
    // Actualizar sidebar
    const nameEl = document.querySelector('#doc-portal .user-name');
    const roleEl = document.querySelector('#doc-portal .user-role');
    const nombreDoc = `${currentPerfil.nombre||''} ${currentPerfil.apellido_p||currentPerfil.apellido||''}`.trim();
    if (nameEl) nameEl.textContent = nombreDoc || 'Docente';
    if (roleEl) roleEl.textContent = `Docente · ${g.nombre}`;
    // Recargar alumnos del primer grupo
    const alumnosDB = await calCargarAlumnosGrupo(g.id);
    window._alumnosActivos = alumnosDB;
    alumnos.length = 0;
    alumnosDB.forEach(a => alumnos.push(a));
    docAlumnos.length = 0;
    if (alumnosDB.length) {
      const COLORES = ['#0d5c2f','#2563eb','#7c3aed','#dc2626','#0891b2','#c2410c','#065f46','#1d4ed8','#166534','#b91c1c'];
      alumnosDB.forEach((a, i) => {
        const partes = (a.n || '').split(' ');
        docAlumnos.push({
          id: a.id,
          nombre: partes[0] || 'Alumno',
          apellido: partes.slice(1).join(' ') || '',
          etiquetas: [],
          color: COLORES[i % COLORES.length]
        });
      });
    }
    // Actualizar selector de grupos si hay más de uno
    if (gruposDB.length > 1) _docRenderSelectorGrupos(gruposDB);
    dRenderDash();
    hubToast(`✅ ${ESCUELA_ACTIVA.nombre} · ${gruposDB.length} grupo(s)`, 'ok');
  } else {
    window._gruposDocente = [];
    window._grupoActivo = null;
    window._alumnosActivos = [];
    alumnos.length = 0;
    docAlumnos.length = 0;
    window._materiasDocente = [];
    window._materiasFiltered = [];
    salonActivoDoc = null;
    hubToast(`🏫 ${ESCUELA_ACTIVA.nombre} — sin grupos asignados`, 'warn');
  }
}

async function docAgregarEscuela() {
  const cct = prompt('Ingresa el CCT de la escuela a vincular (Ej: 19EPR0001A):');
  if(!cct) return;
  const v = cct.trim().toUpperCase();
  if(!cctValidarFormato(v)) { hubToast('❌ Formato inválido. Ej: 19EPR0001A','err'); return; }
  if(USUARIO_ESCUELAS.find(e=>e.cct===v)) { hubToast('Ya estás vinculado a esa escuela'); return; }
  hubToast('⏳ Verificando CCT en Supabase…');
  let esc = await cctBuscarEnSupabase(v) || cctBuscarDemo(v);
  if(!esc) {
    const d = cctDecodificar(v);
    esc = { cct:v, nombre:`Escuela ${v}`, ...d, municipio:'—', zona:'—', sector:'—', turno:'Matutino' };
    hubToast(`⚠️ CCT válido pero escuela no registrada aún — vinculado de todas formas`);
  }
  USUARIO_ESCUELAS.push({...esc, rol:'docente', grupos:[]});
  renderEscuelaSel();
  hubToast(`✅ ${esc.nombre} · CCT ${v} vinculada`,'ok');
}

// ══════════════════════════════════════════════════════════
//  DIRECTORIO TS — DATA
// ══════════════════════════════════════════════════════════

// Alumnos con datos completos (demo)
const TS_ALUMNOS_DIR = [

  { nombre:'Sofía Ramírez Torres',   curp:'RATS100920MNLMRF01', grupo:'6° A', grado:'6°', nacimiento:'2010-09-20', domicilio:'Blvd. Díaz Ordaz 1200, Apt 4B', municipio:'San Nicolás', cp:'66450', tel_emerg:'81-5555-6666', tutor:'Laura Torres', parentesco:'Madre', tel_tutor:'81-5555-6666', correo_tutor:'ltorres&#64;gmail.com', nee:false, notas:'' },
  { nombre:'Luis Hernández Vega',    curp:'HEVL101115HNLRGN05', grupo:'6° A', grado:'6°', nacimiento:'2010-11-15', domicilio:'Calle 5 de Mayo 22, Col. Las Flores', municipio:'Guadalupe', cp:'67150', tel_emerg:'81-7777-8888', tutor:'Rosa Vega', parentesco:'Abuela', tel_tutor:'81-7777-8888', correo_tutor:'rvega&#64;yahoo.com', nee:false, notas:'Vive con abuela materna' },
  { nombre:'Valentina Cruz Salinas', curp:'CUSV110204MNLRLN09', grupo:'6° A', grado:'6°', nacimiento:'2011-02-04', domicilio:'Privada Las Palmas 15, Col. Residencial', municipio:'Apodaca', cp:'66600', tel_emerg:'81-9999-0000', tutor:'Jorge Cruz', parentesco:'Padre', tel_tutor:'81-9999-0000', correo_tutor:'jcruz&#64;empresa.mx', nee:false, notas:'' },
  { nombre:'Diego Morales Pérez',    curp:'MOPD100705HNLRRG02', grupo:'6° A', grado:'6°', nacimiento:'2010-07-05', domicilio:'Calle Reforma 456, Col. Industrial', municipio:'Guadalupe', cp:'67200', tel_emerg:'81-2222-3333', tutor:'Carmen Pérez', parentesco:'Madre', tel_tutor:'81-2222-3333', correo_tutor:'cperez&#64;gmail.com', nee:true, notas:'Tiene apoyo USAER desde 4° grado' },
  { nombre:'Isabella Torres Nava',   curp:'TONI110310MNLRRN03', grupo:'6° A', grado:'6°', nacimiento:'2011-03-10', domicilio:'Av. Colón 890, Col. Tecnológico', municipio:'Monterrey', cp:'64700', tel_emerg:'81-4444-5555', tutor:'Sandra Nava', parentesco:'Madre', tel_tutor:'81-4444-5555', correo_tutor:'snava&#64;outlook.com', nee:false, notas:'' },
  { nombre:'Mateo Vázquez Ortiz',    curp:'VAOM100622HNLZRT07', grupo:'6° A', grado:'6°', nacimiento:'2010-06-22', domicilio:'Priv. Hidalgo 34, Col. Santa Catarina', municipio:'Santa Catarina', cp:'66350', tel_emerg:'81-6666-7777', tutor:'Miguel Vázquez', parentesco:'Padre', tel_tutor:'81-6666-7777', correo_tutor:'mvazquez&#64;gmail.com', nee:false, notas:'' },
];

// Directorio de familias
const TS_FAMILIAS_DIR = TS_ALUMNOS_DIR.map(a=>({
  nombre: a.tutor, parentesco: a.parentesco, alumno: a.nombre, grupo: a.grupo,
  tel: a.tel_tutor, correo: a.correo_tutor,
  domicilio: a.domicilio, municipio: a.municipio,
  horario_contacto: 'Lun–Vie 8–14h',
}));

// Directorio de instituciones
const TS_INSTITUCIONES = [
  { nombre:'USAER Núm. 12 — Guadalupe',          categoria:'USAER',             ico:'🏫', color:'#dbeafe', colorTxt:'#1d4ed8', responsable:'Lic. responsable asignado', tel:'81-1500-1200', correo:'usaer12.nl&#64;sep.gob.mx', dir:'Av. principal 450, Guadalupe', municipio:'Guadalupe', horario:'Lun–Vie 8–15h', notas:'Atiende alumnos con NEE del sector 02' },
  { nombre:'DIF Municipal Guadalupe',              categoria:'DIF',               ico:'🏛️', color:'#fef3c7', colorTxt:'#92400e', responsable:'Lic. Manuel Flores',      tel:'81-1234-9000', correo:'dif&#64;guadalupe.gob.mx', dir:'Palacio Municipal s/n, Guadalupe', municipio:'Guadalupe', horario:'Lun–Vie 9–16h', notas:'Atención a menores y familias en situación de vulnerabilidad. Solicitar cita.' },
  { nombre:'Centro de Salud Mental IMSS UMF-7',   categoria:'Psiquiatría',        ico:'🏥', color:'#dcfce7', colorTxt:'#15803d', responsable:'Dr. Héctor Ríos',         tel:'800-623-2323', correo:'umf7.nl&#64;imss.gob.mx', dir:'Av. Constitución 1200, Guadalupe', municipio:'Guadalupe', horario:'Lun–Vie 7–19h', notas:'Urgencias psiquiátricas pediátricas disponibles 24h' },
  { nombre:'Psicólogo DGE — Sector 02',           categoria:'Psicología',         ico:'🧠', color:'#fdf4ff', colorTxt:'#7c3aed', responsable:'Mtro. Andrés Villarreal', tel:'81-8888-0012', correo:'psico.s02&#64;nl.sep.gob.mx', dir:'Sector 02 SEP, Monterrey', municipio:'Monterrey', horario:'Lun–Vie 8–14h', notas:'Atiende por solicitud de zona escolar. Llenar formato SEP-PS-01.' },
  { nombre:'SIPINNA Nuevo León',                   categoria:'SIPINNA',            ico:'🛡️', color:'#fff7ed', colorTxt:'#c2410c', responsable:'Lic. Fernanda Alvarado',  tel:'800-838-2585', correo:'sipinna&#64;nl.gob.mx', dir:'Zaragoza 1300 Nte., Monterrey', municipio:'Monterrey', horario:'24 horas', notas:'Línea de emergencia para protección de menores. Disponible fines de semana.' },
  { nombre:'Agencia del Ministerio Público',       categoria:'Ministerio Público', ico:'⚖️', color:'#fef2f2', colorTxt:'#b91c1c', responsable:'Agente del MP de guardia', tel:'81-2020-0304', correo:'', dir:'Av. Constitución 2060, Guadalupe', municipio:'Guadalupe', horario:'24 horas', notas:'Para denuncias de maltrato, abuso o delitos contra menores. Obligatorio en casos graves.' },
  { nombre:'CIJ — Centro de Integración Juvenil', categoria:'Otro',               ico:'💊', color:'#f0fdf4', colorTxt:'#15803d', responsable:'Lic. Patricia Morales',    tel:'81-8347-6000', correo:'cij.mty&#64;cij.gob.mx', dir:'Av. Pino Suárez 790, Monterrey', municipio:'Monterrey', horario:'Lun–Sáb 8–19h', notas:'Prevención y tratamiento de adicciones en niños, adolescentes y familias.' },
  { nombre:'IMSS Delegación NL — Trabajo Social', categoria:'IMSS',               ico:'💊', color:'#ecfdf5', colorTxt:'#065f46', responsable:'T.S. Gabriela Castro',      tel:'800-623-2323', correo:'ts.nl&#64;imss.gob.mx', dir:'Hidalgo 528 Pte., Monterrey', municipio:'Monterrey', horario:'Lun–Vie 8–16h', notas:'Apoyo en casos de violencia familiar, albergue, trabajo social clínico.' },
];

let tsDirFiltroInst = '';

// ══════════════════════════════════════════════════════════
//  DIRECTORIO TS — RENDER FUNCTIONS
// ══════════════════════════════════════════════════════════

async function tsDirRenderAlumnos(filtro) {
  const cct = window.currentPerfil?.escuela_cct;
  const body = document.getElementById('ts-dir-alumnos-body');
  if (!body) return;
  if (!cct) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#94a3b8;">Sin escuela configurada</td></tr>';
    return;
  }
  body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#64748b;">Cargando...</td></tr>';

  const { data, error } = await window.sb.from('alumnos_grupos')
    .select('alumno_id, grupos!grupo_id(id,nombre,grado,escuela_cct), usuarios!alumno_id(id,nombre,apellido_p,apellido_m,curp,fecha_nacimiento)')
    .eq('activo', true);

  if (error) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#ef4444;">Error: ${error.message}</td></tr>`;
    return;
  }

  const txt = (filtro || '').toLowerCase();
  let alumnos = (data || []).filter(r => r.usuarios && r.grupos && r.grupos.escuela_cct === cct);
  if (txt) {
    alumnos = alumnos.filter(r => {
      const u = r.usuarios;
      return (u.nombre + ' ' + (u.apellido_p||'') + ' ' + (u.apellido_m||'')).toLowerCase().includes(txt)
        || (u.curp || '').toLowerCase().includes(txt)
        || (r.grupos?.nombre || '').toLowerCase().includes(txt);
    });
  }

  if (!alumnos.length) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#94a3b8;">Sin resultados</td></tr>';
    return;
  }

  const colors = ['#7c3aed','#0369a1','#15803d','#c2410c','#a16207','#047857','#1d4ed8','#b45309'];
  body.innerHTML = alumnos.map((r, i) => {
    const u = r.usuarios; const g = r.grupos;
    const initials = ((u.nombre||'?')[0] + (u.apellido_p||'')[0]).toUpperCase();
    const bg = colors[i % colors.length];
    const nombreCompleto = `${u.nombre||''} ${u.apellido_p||''} ${u.apellido_m||''}`.trim();
    return `<tr class="ts-alum-row">
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:white;flex-shrink:0;">${initials}</div>
          <div><div style="font-weight:600;">${nombreCompleto}</div><div style="font-size:11px;color:#94a3b8;">${u.fecha_nacimiento||'—'}</div></div>
        </div>
      </td>
      <td style="font-size:11px;font-family:monospace;color:#475569;">${u.curp||'—'}</td>
      <td><span style="background:#eff6ff;color:#1d4ed8;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;">${g?.nombre||'—'}</span></td>
      <td style="font-size:12px;max-width:160px;">—</td>
      <td><div style="font-size:12px;color:#64748b;">—</div></td>
      <td>
        <div style="display:flex;gap:5px;">
          <button onclick="tsVerAlumnoDetalle && tsVerAlumnoDetalle('${u.id}')" style="padding:4px 10px;background:#eff6ff;border:1px solid #93c5fd;border-radius:6px;font-size:11px;font-weight:700;color:#1d4ed8;cursor:pointer;font-family:'Sora',sans-serif;" aria-label="Ver">👁️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function tsDirFiltrarAlumnos(v) { tsDirRenderAlumnos(v); }
function tsDirNuevoAlumno(){
  const cct = window.currentPerfil?.escuela_cct;
  hubModal('Agregar Alumno al Directorio','<div style="display:grid;gap:10px;">'+
    '<input id="tsda-nombre" class="inp" placeholder="Nombre completo *" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">'+
    '<input id="tsda-grado" class="inp" placeholder="Grado y grupo (ej. 2°A)" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">'+
    '<input id="tsda-curp" class="inp" placeholder="CURP (opcional)" maxlength="18" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;text-transform:uppercase;">'+
    '<input id="tsda-tutor" class="inp" placeholder="Nombre del tutor/padre" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">'+
    '<input id="tsda-tel" class="inp" placeholder="Teléfono de contacto" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">'+
    '<textarea id="tsda-obs" placeholder="Observaciones iniciales" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;resize:vertical;min-height:60px;"></textarea>'+
    '</div>','Guardar',async()=>{
    const nombre=document.getElementById('tsda-nombre')?.value?.trim();
    const grado=document.getElementById('tsda-grado')?.value?.trim()||null;
    const curp=(document.getElementById('tsda-curp')?.value?.trim()||'').toUpperCase()||null;
    const tutor=document.getElementById('tsda-tutor')?.value?.trim()||null;
    const telefono=document.getElementById('tsda-tel')?.value?.trim()||null;
    const observaciones=document.getElementById('tsda-obs')?.value?.trim()||null;
    if(!nombre){hubToast('El nombre es obligatorio','error');return;}
    const{error}=await window.sb.from('ts_directorio').insert({escuela_cct:cct,tipo:'alumno',nombre,grado,curp,tutor_nombre:tutor,telefono,observaciones,ts_id:window.currentPerfil?.id,created_at:new Date().toISOString()});
    if(error){hubToast('Error: '+error.message,'error');return;}
    hubToast('✅ Alumno agregado al directorio');
    if(typeof tsDirCargar==='function')tsDirCargar();
  });
}
function tsDirEditarAlumno(i) { const a=TS_ALUMNOS_DIR[i]; hubToast(`✏️ Editando ficha de ${a.nombre}`); }
function tsDirLlamar(tel)     { hubToast(`📞 Llamando a ${tel}…`); }

function tsDirRenderFamilias(filtro) {
  const txt = (filtro || '').toLowerCase();
  // Build groups from TS_ALUMNOS_DIR
  const grupos = {};
  TS_ALUMNOS_DIR.forEach((a, idx) => {
    const g = a.grupo || 'Sin grupo';
    if (!grupos[g]) grupos[g] = [];
    grupos[g].push({ ...a, _idx: idx });
  });

  const colMap = { 'Madre':'#fdf4ff','Padre':'#eff6ff','Abuela':'#fff7ed','Otro familiar':'#f0fdf4' };
  const txtMap = { 'Madre':'#7c3aed','Padre':'#1d4ed8','Abuela':'#c2410c','Otro familiar':'#15803d' };

  const renderCard = (a, i) => {
    const col = COLORES_AVATARES[a._idx % COLORES_AVATARES.length];
    const initT = a.tutor.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
    return `<div class="ts-fam-card">
      <div class="ts-fam-card-header">
        <div style="width:40px;height:40px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;flex-shrink:0;">${initT}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.tutor}</div>
          <span style="font-size:10px;font-weight:700;padding:1px 8px;border-radius:99px;background:${colMap[a.parentesco]||'#f1f5f9'};color:${txtMap[a.parentesco]||'#475569'};">${a.parentesco}</span>
          <span style="font-size:10px;color:#64748b;"> de <strong>${a.nombre}</strong></span>
        </div>
        ${a.nee ? '<span style="font-size:10px;background:#ede9fe;color:#7c3aed;padding:2px 7px;border-radius:99px;font-weight:700;flex-shrink:0;">🛡️ Apoyos</span>' : ''}
      </div>
      <div class="ts-fam-card-body">
        <div>👤 <strong>Alumno:</strong> ${a.nombre} · Núm. ${a.num_lista || '—'} · ${a.grupo}</div>
        <div>📞 <strong>Tel:</strong> ${a.tel_tutor || '—'}</div>
        <div>✉️ <strong>Correo:</strong> <span style="color:#3b82f6;">${a.correo_tutor || '—'}</span></div>
        <div>📍 <strong>Domicilio:</strong> ${a.domicilio || '—'}, ${a.municipio || ''}</div>
        ${a.notas ? `<div style="margin-top:6px;padding:6px 8px;background:#f8fafc;border-radius:6px;font-size:11px;color:#475569;border-left:2px solid #94a3b8;">📝 ${a.notas}</div>` : ''}
      </div>
      <div class="ts-fam-card-footer">
        <button onclick="tsLlamarTutor('${a.tel_tutor}','${a.nombre}')" style="flex:1;padding:6px;background:#f0fdf4;border:1px solid #86efac;border-radius:7px;font-size:11px;font-weight:700;color:#15803d;cursor:pointer;font-family:'Sora',sans-serif;">📞 Llamar</button>
        <button onclick="tsCorreoTutor('${a.correo_tutor}','${a.nombre}')" style="flex:1;padding:6px;background:#eff6ff;border:1px solid #93c5fd;border-radius:7px;font-size:11px;font-weight:700;color:#1d4ed8;cursor:pointer;font-family:'Sora',sans-serif;">✉️ Correo</button>
        <button onclick="tsVerCasosAlumno('${a.nombre}')" style="flex:1;padding:6px;background:#fff7ed;border:1px solid #fed7aa;border-radius:7px;font-size:11px;font-weight:700;color:#c2410c;cursor:pointer;font-family:'Sora',sans-serif;">📋 Casos</button>
      </div>
    </div>`;
  };

  // Render into group grids
  const grupoIds = { '6° A': 'ts-fam-grid-6A', '6° B': 'ts-fam-grid-6B', '5° A': 'ts-fam-grid-5A', '5° B': 'ts-fam-grid-5B' };
  Object.entries(grupos).forEach(([grupo, alumnos]) => {
    const gridId = grupoIds[grupo] || ('ts-fam-grid-' + grupo.replace(/[°\s]/g, ''));
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const filtrados = txt ? alumnos.filter(a =>
      a.nombre.toLowerCase().includes(txt) || a.tutor.toLowerCase().includes(txt) ||
      (a.tel_tutor || '').includes(txt) || (a.correo_tutor || '').toLowerCase().includes(txt)
    ) : alumnos;
    grid.innerHTML = filtrados.length
      ? filtrados.map((a, i) => renderCard(a, i)).join('')
      : '<div style="color:#94a3b8;font-size:13px;padding:12px;">Sin resultados</div>';
  });
}

function tsDirFiltrarFamilias(v) { tsDirRenderFamilias(v); }
function tsDirFiltrarFamiliasPorGrupo(grupo) {
  document.querySelectorAll('#ts-familias-grupos > div').forEach(d => {
    if (!grupo || d.querySelector('[style*="font-size:22px"]')?.textContent.trim() === grupo) {
      d.style.display = '';
    } else {
      d.style.display = 'none';
    }
  });
}
function tsDirNuevoContacto(){
  const cct = window.currentPerfil?.escuela_cct;
  hubModal('Nuevo Contacto','<div style="display:grid;gap:10px;">'+
    '<input id="tsdc-nombre" class="inp" placeholder="Nombre completo *" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">'+
    '<select id="tsdc-tipo" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;"><option value="">Tipo de contacto</option><option>Tutor/Padre</option><option>Médico</option><option>Psicólogo</option><option>Trabajador social externo</option><option>Autoridad</option><option>Otro</option></select>'+
    '<input id="tsdc-org" class="inp" placeholder="Organización / Institución" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">'+
    '<input id="tsdc-tel" class="inp" placeholder="Teléfono *" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">'+
    '<input id="tsdc-email" type="email" class="inp" placeholder="Email" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">'+
    '<textarea id="tsdc-obs" placeholder="Notas" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;resize:vertical;min-height:50px;"></textarea>'+
    '</div>','Guardar',async()=>{
    const nombre=document.getElementById('tsdc-nombre')?.value?.trim();
    const tipo=document.getElementById('tsdc-tipo')?.value||'Otro';
    const org=document.getElementById('tsdc-org')?.value?.trim()||null;
    const telefono=document.getElementById('tsdc-tel')?.value?.trim();
    const email=document.getElementById('tsdc-email')?.value?.trim()||null;
    const observaciones=document.getElementById('tsdc-obs')?.value?.trim()||null;
    if(!nombre||!telefono){hubToast('Nombre y teléfono son obligatorios','error');return;}
    const{error}=await window.sb.from('ts_directorio').insert({escuela_cct:cct,tipo:'contacto',subtipo:tipo,nombre,organizacion:org,telefono,email,observaciones,ts_id:window.currentPerfil?.id,created_at:new Date().toISOString()});
    if(error){hubToast('Error: '+error.message,'error');return;}
    hubToast('✅ Contacto agregado');
    if(typeof tsDirCargar==='function')tsDirCargar();
  });
}
function tsVerCasosAlumno(nombre) { tsNav('casos'); hubToast(`📋 Filtrando casos de ${nombre}`,'ok'); }

function tsInstFiltrar(cat) {
  tsDirFiltroInst = cat;
  document.querySelectorAll('.ts-cat-btn').forEach(b=>{
    b.classList.toggle('ts-cat-active', b.textContent.trim()===cat||(cat===''&&b.textContent.trim()==='Todas'));
  });
  tsDirRenderInstituciones();
}

const INST_COLOR = {
  'USAER':'#dbeafe','DIF':'#fef3c7','Psicología':'#fdf4ff','Psiquiatría':'#dcfce7',
  'SIPINNA':'#fff7ed','Ministerio Público':'#fef2f2','IMSS':'#ecfdf5','Otro':'#f1f5f9'
};
const INST_TXT = {
  'USAER':'#1d4ed8','DIF':'#92400e','Psicología':'#7c3aed','Psiquiatría':'#15803d',
  'SIPINNA':'#c2410c','Ministerio Público':'#b91c1c','IMSS':'#065f46','Otro':'#475569'
};

function tsDirRenderInstituciones() {
  const grid = document.getElementById('ts-inst-grid');
  if(!grid) return;
  const data = !tsDirFiltroInst ? TS_INSTITUCIONES : TS_INSTITUCIONES.filter(i=>i.categoria===tsDirFiltroInst);
  grid.innerHTML = data.map(inst=>`
    <div class="ts-inst-card">
      <div class="ts-inst-header">
        <div class="ts-inst-ico" style="background:${INST_COLOR[inst.categoria]||'#f1f5f9'};">${inst.ico}</div>
        <div style="flex:1;">
          <span class="ts-inst-cat-chip" style="background:${INST_COLOR[inst.categoria]||'#f1f5f9'};color:${INST_TXT[inst.categoria]||'#475569'};">${inst.categoria}</span>
          <div style="font-size:13px;font-weight:700;color:#1e293b;line-height:1.3;">${inst.nombre}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">${inst.responsable}</div>
        </div>
      </div>
      <div class="ts-inst-body">
        <div>📞 <strong>${inst.tel}</strong>${inst.correo?` · ✉️ ${inst.correo}`:''}</div>
        <div>📍 ${inst.dir}</div>
        <div>🕐 ${inst.horario}</div>
        ${inst.notas?`<div style="margin-top:6px;padding:7px 10px;background:#f8fafc;border-radius:7px;font-size:11px;border-left:3px solid #93c5fd;">💡 ${inst.notas}</div>`:''}
      </div>
      <div class="ts-inst-footer">
        <button onclick="tsLlamarInst('${inst.tel}','${inst.nombre}')" style="flex:1;padding:6px;background:#f0fdf4;border:1px solid #86efac;border-radius:7px;font-size:11px;font-weight:700;color:#15803d;cursor:pointer;font-family:'Sora',sans-serif;">📞 Llamar</button>
        ${inst.correo?`<button onclick="tsCorreoInst('${inst.correo}','${inst.nombre}')" style="flex:1;padding:6px;background:#eff6ff;border:1px solid #93c5fd;border-radius:7px;font-size:11px;font-weight:700;color:#1d4ed8;cursor:pointer;font-family:'Sora',sans-serif;">✉️ Correo</button>`:''}
        <button onclick="tsDirDerivacion('${inst.nombre.replace(/'/g, "\\'")}','${inst.tel}')" style="flex:1;padding:6px;background:#fef9c3;border:1px solid #fde68a;border-radius:7px;font-size:11px;font-weight:700;color:#a16207;cursor:pointer;font-family:'Sora',sans-serif;">📤 Derivar caso</button>
      </div>
    </div>`).join('') || '<div style="color:#94a3b8;font-size:13px;padding:20px;">Sin instituciones en esta categoría</div>';
}

async function tsDirDerivacion(nombre, tel) {
  // Cargar casos abiertos para seleccionar a cuál alumno derivar
  const cct = window.currentPerfil?.escuela_cct;
  const pendientes = TS_CASOS.filter(c => c.estado !== 'resuelto');
  const optsHtml = pendientes.length
    ? '<option value="">Seleccionar alumno…</option>' + pendientes.map(c => {
        const a = alumnos[c.alumnoIdx];
        return `<option value="${c.id}">${a ? a.n : 'Caso #'+c.id} — ${(TS_TIPOS[c.tipo]||TS_TIPOS.otro).lbl}</option>`;
      }).join('')
    : '<option value="">Sin casos abiertos</option>';
  hubModal(`📤 Derivar caso a ${nombre}`,`
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div style="font-size:13px;color:#475569;">Institución: <strong>${nombre}</strong>${tel ? ` · 📞 ${tel}` : ''}</div>
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Alumno / Caso</label>
        <select id="tsdir-caso-sel" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">${optsHtml}</select>
      </div>
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Motivo / notas</label>
        <textarea id="tsdir-notas" rows="3" placeholder="Describe el motivo de la derivación…" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;resize:vertical;"></textarea>
      </div>
    </div>`, 'Confirmar derivación', async () => {
    const casoId = parseInt(document.getElementById('tsdir-caso-sel')?.value);
    const notas = document.getElementById('tsdir-notas')?.value?.trim() || '';
    const c = TS_CASOS.find(x => x.id === casoId);
    if (!c) { hubToast('Selecciona un caso', 'warn'); return; }
    c.derivadoA = nombre;
    c.estado = 'seguimiento';
    c.notas_deriv = notas;
    try {
      if (window.sb) {
        if (c.db_id) {
          await window.sb.from('casos_trabajo_social').update({
            estado: 'seguimiento', derivado_a: nombre,
            notas_derivacion: notas, fecha_derivacion: new Date().toISOString(),
          }).eq('id', c.db_id);
        } else {
          await window.sb.from('casos_trabajo_social').insert({
            escuela_cct: cct, alumno_id: c.alumno_id || null,
            tipo: c.tipo || 'general', estado: 'seguimiento',
            derivado_a: nombre, notas_derivacion: notas,
            fecha_derivacion: new Date().toISOString(),
            ts_id: window.currentPerfil?.id || null, descripcion: c.descripcion || '',
          });
        }
      }
    } catch(e) { console.warn('[TS] tsDirDerivacion save:', e.message); }
    hubToast(`✅ Caso derivado a ${nombre}`, 'ok');
  });
}
function tsDirNuevaInst(){
  const cct = window.currentPerfil?.escuela_cct;
  hubModal('Nueva Institución de Apoyo','<div style="display:grid;gap:10px;">'+
    '<input id="tsdi-nombre" class="inp" placeholder="Nombre de la institución *" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">'+
    '<select id="tsdi-tipo" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;"><option value="">Tipo</option><option>DIF</option><option>IMSS</option><option>ISSSTE</option><option>Salud Mental</option><option>Protección Civil</option><option>Ministerio Público</option><option>ONG</option><option>Otro</option></select>'+
    '<input id="tsdi-dir" class="inp" placeholder="Dirección" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">'+
    '<input id="tsdi-tel" class="inp" placeholder="Teléfono *" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">'+
    '<input id="tsdi-web" class="inp" placeholder="Sitio web (opcional)" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;">'+
    '<textarea id="tsdi-serv" placeholder="Servicios que ofrece" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;resize:vertical;min-height:60px;"></textarea>'+
    '</div>','Guardar',async()=>{
    const nombre=document.getElementById('tsdi-nombre')?.value?.trim();
    const tipo=document.getElementById('tsdi-tipo')?.value||'Otro';
    const direccion=document.getElementById('tsdi-dir')?.value?.trim()||null;
    const telefono=document.getElementById('tsdi-tel')?.value?.trim();
    const web=document.getElementById('tsdi-web')?.value?.trim()||null;
    const servicios=document.getElementById('tsdi-serv')?.value?.trim()||null;
    if(!nombre||!telefono){hubToast('Nombre y teléfono son obligatorios','error');return;}
    const{error}=await window.sb.from('ts_directorio').insert({escuela_cct:cct,tipo:'institucion',subtipo:tipo,nombre,direccion,telefono,sitio_web:web,observaciones:servicios,ts_id:window.currentPerfil?.id,created_at:new Date().toISOString()});
    if(error){hubToast('Error: '+error.message,'error');return;}
    hubToast('✅ Institución agregada');
    if(typeof tsDirCargar==='function')tsDirCargar();
  });
}

// Patch tsNav to render directorio pages
const _tsNavOrig = typeof tsNav !== 'undefined' ? tsNav : null;
// Alias para compatibilidad con código previo
function renderCalificaciones() { calInit(); }
function guardarCals() { calGuardar(); }
function exportarExcel() { calExportar(); }
function setTrim(el,b){calTrimActual=b;}
function dExportarExcel(){ calExportar(); }
function exportarPDF(){ exportarBoletaPDF(); }
function generarReporte(tipo) {
  switch (tipo) {
    case 'boleta':
    case 'boletin':
      if (typeof exportarBoletaPDF === 'function') exportarBoletaPDF();
      else hubToast('📋 Ve a Calificaciones → Exportar boleta', 'ok');
      break;
    case 'asistencia':
      if (typeof calExportar === 'function') calExportar();
      else hubToast('📋 Ve a Asistencia → Exportar', 'ok');
      break;
    case 'grupo':
    case 'reporte_grupo':
      if (typeof dirGenerarReporteIA === 'function') dirGenerarReporteIA();
      else hubToast('📋 Ve a Director → Reporte de Grupo', 'ok');
      break;
    default:
      hubToast(`📋 Reporte "${tipo}" — usa los botones de exportación en cada sección`, 'ok');
  }
}
function nivel(p){return calNivel(p);}


// ASISTENCIA
function renderAsistencia() {
  const t = document.getElementById('tabla-asistencia');
  t.innerHTML = `<thead><tr><th>Alumno</th><th>Estado</th><th>Hora llegada</th><th>Acción</th></tr></thead>
  <tbody>${alumnos.map((a,i)=>`<tr>
    <td style="font-weight:600;">${a.n}</td>
    <td><span id="as-estado-${i}" class="chip ${a.as==='P'?'chip-verde':a.as==='A'?'chip-rojo':'chip-amarillo'}">${a.as==='P'?'Presente':a.as==='A'?'Ausente':'Tardanza'}</span></td>
    <td style="color:var(--gris-50);font-size:12px;">${a.as==='P'?'7:05':'—'}</td>
    <td style="display:flex;gap:4px;">
      <button class="btn btn-sm" style="background:#dcfce7;color:#15803d;border:none;" onclick="setAs(${i},'P')">✅</button>
      <button class="btn btn-sm" style="background:#fee2e2;color:#b91c1c;border:none;" onclick="setAs(${i},'A')">❌</button>
      <button class="btn btn-sm" style="background:#fef9c3;color:#a16207;border:none;" onclick="setAs(${i},'T')">⏰</button>
    </td>
  </tr>`).join('')}</tbody>`;
  actualizarContadores();
}
function setAs(i,estado){
  alumnos[i].as=estado;
  const chip=document.getElementById(`as-estado-${i}`);
  chip.className=`chip ${estado==='P'?'chip-verde':estado==='A'?'chip-rojo':'chip-amarillo'}`;
  chip.textContent=estado==='P'?'Presente':estado==='A'?'Ausente':'Tardanza';
  actualizarContadores();
}
function actualizarContadores(){
  const pres=alumnos.filter(a=>a.as==='P').length;
  const aus=alumnos.filter(a=>a.as==='A').length;
  const tard=alumnos.filter(a=>a.as==='T').length;
  document.getElementById('as-pres').textContent=pres;
  document.getElementById('as-aus').textContent=aus;
  document.getElementById('as-tard').textContent=tard;
  document.getElementById('as-pct').textContent=Math.round(pres/alumnos.length*100)+'%';
}
function marcarTodos(estado){alumnos.forEach((_,i)=>setAs(i,estado));}
async function guardarAsistencia() {
  if (!sb || !currentPerfil) {
    hubToast('✅ Asistencia guardada (demo)', 'ok');
    return;
  }

  const grupoId = window._grupoActivo;
  const alumnosList = window._alumnosActivos || [];
  if (!grupoId || !alumnosList.length) {
    hubToast('⚠️ Carga el grupo primero');
    return;
  }

  const hoy = new Date().toISOString().split('T')[0];
  const rows = alumnosList.map((alumno, i) => {
    const sel = document.querySelector(`input[name="as-${i}"]:checked`);
    const estado = sel ? sel.value : 'P';
    return {
      alumno_id: alumno.id,
      grupo_id:  grupoId,
      fecha:     hoy,
      estado
    };
  });

  const { error } = await sb.from('asistencia')
    .upsert(rows, { onConflict: 'alumno_id,fecha' });

  if (error) {
    hubToast('❌ Error: ' + error.message, 'error');
  } else {
    hubToast('✅ Asistencia guardada en Supabase', 'ok');
    asActualizarStats();

    // ── Alerta automática: alumnos con 12+ faltas injustificadas en el ciclo ──
    try {
      const ciclo = window.CICLO_ACTIVO || '2025-2026';
      const anoActual = new Date().getFullYear();
      const inicioAnio = `${anoActual}-08-01`;
      const ausentes = rows.filter(r => r.estado === 'F' || r.estado === 'ausente' || r.estado === 'falta');
      for (const reg of ausentes) {
        const { count } = await sb.from('asistencia')
          .select('id', { count: 'exact', head: true })
          .eq('alumno_id', reg.alumno_id)
          .in('estado', ['F', 'ausente', 'falta'])
          .gte('fecha', inicioAnio);
        if (count && count >= 12) {
          const { data: alertaExist } = await sb.from('alertas')
            .select('id')
            .eq('usuario_id', reg.alumno_id)
            .eq('tipo', 'inasistencia_critica')
            .eq('activa', true)
            .maybeSingle();
          if (!alertaExist) {
            await sb.from('alertas').insert({
              tipo: 'inasistencia_critica',
              usuario_id: reg.alumno_id,
              escuela_cct: currentPerfil?.escuela_cct || null,
              grupo_id: grupoId,
              descripcion: `El alumno acumula ${count} faltas injustificadas en el ciclo ${ciclo}. Requiere atención.`,
              activa: true,
              generada_por: currentPerfil?.id || null
            }).catch(e => console.warn('[guardarAsistencia alerta]', e.message));
          }
        }
      }
    } catch(e) { console.warn('[guardarAsistencia faltas]', e.message); }
    // ─────────────────────────────────────────────────────────────────────────
  }
}

// HORARIO
function renderHorario() {
  const g = document.getElementById('horario-grid');
  let html = '<div></div>'+diasSemana.map(d=>`<div class="dia-header">${d}</div>`).join('');
  horas.forEach((h,hi)=>{
    html+=`<div class="hora-label">${h}</div>`;
    diasSemana.forEach(d=>{
      const clase = horarioData[d][hi]||'';
      if(!clase){html+=`<div class="clase-slot clase-empty"></div>`;return;}
      const [mat,grupo] = clase.split('·');
      const bg = claseColors[mat.trim()]||'#f3f3ef';
      html+=`<div class="clase-slot" style="background:${bg};"><div class="clase-mat">${mat.trim()}</div><div class="clase-grupo">${grupo||''}</div></div>`;
    });
  });
  g.innerHTML = html;
}

// PLANEACIONES
function renderPlaneacionesSimple(){
  const el = document.getElementById('plan-list');
  if(!el) return;
  const lista = window._planeaciones || [];
  if(!lista.length){
    el.innerHTML=`<div style="text-align:center;padding:48px 20px;color:var(--gris-50);">
      <div style="font-size:36px;margin-bottom:12px;">📚</div>
      <div style="font-size:15px;font-weight:700;color:var(--gris-80);margin-bottom:6px;">Aún no hay planeaciones</div>
      <div style="font-size:13px;">Genera tu primera planeación con IA usando el botón de arriba.</div>
    </div>`;
    return;
  }
  el.innerHTML = lista.map(p=>{
    const cj = p.contenido_json || {};
    const titulo = cj.titulo || p.objetivo || p.materia || '—';
    const semanaFmt = p.semana ? new Date(p.semana + 'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'}) : '—';
    const status = cj.status || 'listo';
    return `
    <div class="plan-card">
      <div class="plan-semana">${semanaFmt}</div>
      <div class="plan-titulo">${titulo}</div>
      <div style="font-size:12px;color:var(--gris-50);margin:4px 0;">${cj.campo||''}</div>
      <div class="plan-meta">
        <span class="plan-tag">${p.materia||'—'}</span>
        <span class="plan-status ${status==='listo'?'status-listo':'status-borrador'}">${status==='listo'?'✅ Lista':'✏️ Borrador'}</span>
        <button class="btn btn-outline btn-sm" style="margin-left:auto;" onclick="planEditarGuardado('${p.id}')">✏️ Editar</button>
        <button class="btn btn-outline btn-sm" onclick="planExportarWordId('${p.id}')">⬇ Word</button>
      </div>
    </div>`;
  }).join('');
}
// ═══════════════════════════════════════════════════════
// PLANEACIONES IA-NEM
// ═══════════════════════════════════════════════════════


// ════ PLANEACIONES NEM FASE 6 — SIEMBRA IA (PRIMARIA + SECUNDARIA) ════

// ── BASE DE DATOS OFICIAL: 4 CAMPOS FORMATIVOS · CONTENIDOS · PDAs (SEP 2024) ──
// Fuente: Programa Sintético Fase 6 — exactamente como aparece en el documento oficial

const PLAN_DB = {

  // ╔══════════════════════════════════════════════════════════╗
  // ║  CAMPO 1 · LENGUAJES                                     ║
  // ╚══════════════════════════════════════════════════════════╝
  lenguajes: {
    nombre: 'Lenguajes', emoji: '📖', color: '#7c3aed', colorLight: '#f3e8ff',
    materias: {

      espanol: {
        nombre: 'Español', emoji: '📝',
        secundaria: {
          todos: [
            {
              c: 'La diversidad de lenguas y su uso en la comunicación familiar, escolar y comunitaria',
              pdas: {
                '1': 'Reconoce la riqueza lingüística de México y el mundo, a partir de obras literarias procedentes de distintas culturas. Comprende las características y recursos lingüísticos de la lengua española, para usarlos y valorarlos como parte de la riqueza pluricultural de México y del mundo. Analiza y reconoce algunas variantes lingüísticas de la lengua española, para valorarla como riqueza cultural.',
                '2': '(Continúa profundización del contenido en 2° grado)',
                '3': '(Continúa profundización del contenido en 3° grado)'
              }
            },
            {
              c: 'La diversidad étnica, cultural y lingüística de México a favor de una sociedad intercultural',
              pdas: {
                '1': 'Comprende las ideas centrales y secundarias de textos relacionados con la diversidad étnica, cultural y lingüística, que favorecen una sociedad intercultural, para comentarlas en forma oral y escrita. Compara y contrasta textos sobre las tensiones y conflictos en las sociedades contemporáneas y manifiesta, de manera oral o escrita, la necesidad de practicar la comunicación asertiva. Practica la comunicación asertiva y el diálogo intercultural en interacción con otras personas.',
                '2': 'Analiza textos sobre las sociedades multiculturales y expresa la función que tiene el diálogo intercultural para la construcción democrática. Comparte una propuesta creativa propia en la que valore y promueva textos en español a favor de una sociedad intercultural.',
                '3': '(Continúa profundización del contenido en 3° grado)'
              }
            },
            {
              c: 'Las lenguas como manifestación de la identidad y del sentido de pertenencia',
              pdas: {
                '1': 'Describe en un texto cómo el lenguaje oral manifiesta las identidades personal y colectiva, para reconocer lo común y lo diferente. Comprende y redacta textos narrativos sobre la construcción de la identidad y el sentido de pertenencia, a partir del análisis de variantes del español.',
                '2': 'Elabora textos argumentativos acerca de la interculturalidad crítica, para reconocer el valor de las lenguas, a fin de promoverlas y fortalecerlas.',
                '3': '(Continúa profundización del contenido en 3° grado)'
              }
            },
            {
              c: 'El dinamismo de las lenguas y su relevancia como patrimonio cultural',
              pdas: {
                '1': 'Identifica y expresa la relevancia de valorar las lenguas como legado de la comunidad. Reconoce cambios temporales y geográficos del español en la comunidad, el país o el mundo hispano.',
                '2': 'Analiza en textos literarios neologismos, juegos de lenguajes, caló, jerga, préstamos lingüísticos y extranjerismos como parte del dinamismo de la lengua española.',
                '3': '(Continúa profundización del contenido en 3° grado)'
              }
            },
            {
              c: 'La función creativa del español en la expresión de necesidades e intereses comunitarios',
              pdas: {
                '1': 'Identifica una situación problemática de la comunidad, haciendo uso del pensamiento crítico, para plantear diversas formas creativas de resolverla, por ejemplo, con un cuento.',
                '2': 'Expresa, mediante un ensayo, una postura crítica sobre necesidades, intereses y problemas de la comunidad.',
                '3': 'Crea textos literarios de distintos géneros para ofrecer una propuesta de solución a problemas de la comunidad.'
              }
            },
            {
              c: 'Los elementos y los recursos estéticos de la lengua española en la literatura oral y escrita',
              pdas: {
                '1': 'Reconoce los recursos estéticos en textos literarios líricos, orales y escritos, y disfruta de poemas, canciones y juegos de palabras, entre otros.',
                '2': 'Analiza las características y recursos estéticos de los textos narrativos, e interpreta y disfruta de cuentos y novelas.',
                '3': 'Usa creativa e intencionalmente las características y los recursos estéticos de textos dramáticos, para escenificar situaciones vinculadas con la comunidad.'
              }
            },
            {
              c: 'Textos literarios escritos en español o traducidos',
              pdas: {
                '1': 'Reconoce el valor estético de diversos géneros literarios en textos de su elección, para elaborar comentarios y promover su lectura.',
                '2': 'Analiza diversos textos literarios de su elección para expresar un juicio estético y lo comparte en la comunidad.',
                '3': 'Elabora un ensayo acerca del tratamiento de un tema de su elección, con base en algún género literario de su preferencia, para argumentar un juicio estético sobre éste.'
              }
            },
            {
              c: 'Creaciones literarias tradicionales y contemporáneas',
              pdas: {
                '1': 'Recupera y clasifica creaciones literarias de la comunidad o de un lugar de interés, como mitos, leyendas, fábulas, epopeyas, cantares de gesta, refranes, coplas, canciones, corridos y juegos de palabras, para promover de manera creativa su lectura.',
                '2': 'Valora textos literarios tradicionales y contemporáneos, como cuentos, novelas, poemas y textos dramáticos; los adapta a otros lenguajes para sensibilizar a la comunidad.',
                '3': 'Crea textos narrativos, poéticos, dramáticos y guiones para audiovisuales, entre otros, a partir del uso de recursos literarios, para exponer una situación real o ficticia.'
              }
            },
            {
              c: 'Recursos literarios en lengua española para expresar sensaciones, emociones, sentimientos e ideas vinculados con las familias, la escuela y la comunidad',
              pdas: {
                '1': 'Identifica recursos literarios en lengua española y los emplea en la elaboración de cartas personales y biografías, para expresar sensaciones, emociones, sentimientos e ideas que experimenta en su entorno familiar, escolar o comunitario.',
                '2': 'Analiza recursos literarios en lengua española para expresar sensaciones, emociones, sentimientos e ideas al elaborar una autobiografía con respecto a los vínculos consigo mismo y con el entorno familiar, escolar o comunitario.',
                '3': 'Recupera recursos literarios de la lengua española para crear un texto libre que describa los vínculos con el entorno familiar, escolar o comunitario.'
              }
            },
            {
              c: 'Los géneros periodísticos y sus recursos para comunicar sucesos significativos familiares, escolares, comunitarios y sociales',
              pdas: {
                '1': 'Identifica sucesos significativos familiares, escolares, comunitarios y sociales que forman parte de la memoria colectiva y los comunica haciendo uso de las características de los géneros periodísticos informativos.',
                '2': 'Investiga un evento familiar, escolar o comunitario significativo de la memoria colectiva, para comunicarlo utilizando las características de los géneros periodísticos de opinión.',
                '3': 'Analiza los sucesos más significativos de la comunidad y los comunica empleando las características de los géneros periodísticos de interpretación, para preservar la memoria colectiva.'
              }
            },
            {
              c: 'Comunicación asertiva y dialógica para erradicar expresiones de violencia',
              pdas: {
                '1': 'Realiza, de manera colectiva, una propuesta oral o por escrito, para promover acciones que posibiliten erradicar la violencia en las familias y la escuela. Elabora solicitudes de gestión de espacios y recursos para dar a conocer la propuesta.',
                '2': 'Participa en un debate acerca de algunas expresiones de violencia —como la de género y la sexual— para argumentar una postura de rechazo. Elabora invitaciones a expertos y redacta oficios de gestión para obtener recursos.',
                '3': 'Discute de forma colectiva y diseña una estrategia sobre la importancia de sensibilizar a la comunidad acerca de la violencia. Redacta un texto informativo acerca de la importancia de erradicar la violencia.'
              }
            },
            {
              c: 'Mensajes para promover una vida saludable, expresados en medios comunitarios o masivos de comunicación',
              pdas: {
                '1': 'Identifica las características y recursos de mensajes que promueven una vida saludable a través de los diferentes medios comunitarios o masivos de comunicación impresos o audiovisuales.',
                '2': 'Elabora un mensaje impreso empleando imágenes, textos, colores y otros recursos gráficos, para favorecer una vida saludable, y lo comparte en la comunidad.',
                '3': 'Construye narrativas acerca de una vida saludable, haciendo uso del lenguaje audiovisual y las transmite por medios comunitarios o masivos de comunicación.'
              }
            },
            {
              c: 'Textos de divulgación científica',
              pdas: {
                '1': 'Identifica las características del texto de divulgación científica y elabora uno.',
                '2': 'Analiza las características del texto de divulgación científica, para elaborar y dar a conocer diversos textos científicos orales o escritos que traten sobre un tema de interés personal o colectivo.',
                '3': 'Elabora una propuesta de divulgación científica, con la participación de la comunidad escolar, para fomentar el conocimiento de las ciencias.'
              }
            },
            {
              c: 'Manifestaciones culturales y artísticas que favorecen una sociedad incluyente',
              pdas: {
                '1': 'Reconoce manifestaciones culturales y artísticas creadas o ejecutadas por personas con alguna discapacidad, para distinguir sus valores estéticos y creativos y las comparte en forma oral o escrita con la comunidad.',
                '2': 'Elabora un texto oral o escrito acerca de las manifestaciones culturales y artísticas que promuevan una sociedad incluyente.',
                '3': 'Crea un texto literario que aborde un tema que promueva una sociedad incluyente.'
              }
            }
          ]
        }
      },

      ingles: {
        nombre: 'Inglés', emoji: '🌐',
        secundaria: {
          todos: [
            { c: 'La diversidad lingüística y sus formas de expresión en México y el mundo', pdas: { '1': 'Reconoce la diversidad lingüística y las formas de expresión en México y el mundo para valorar la riqueza cultural.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'La identidad y cultura de pueblos de habla inglesa', pdas: { '1': 'Explora la identidad y cultura de pueblos de habla inglesa para desarrollar una perspectiva intercultural.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Las manifestaciones culturales, lingüísticas y artísticas en inglés, a favor de la interculturalidad', pdas: { '1': 'Analiza manifestaciones culturales, lingüísticas y artísticas en inglés a favor de la interculturalidad.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Uso de diversos textos en inglés que promueven la preservación y conservación de las lenguas', pdas: { '1': 'Lee y comprende textos en inglés que promueven la preservación y conservación de las lenguas.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'El uso del inglés para expresar necesidades, intereses y problemas de la comunidad', pdas: { '1': 'Usa el inglés para expresar necesidades, intereses y problemas de la comunidad de manera oral y escrita.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Elementos y recursos estéticos del inglés', pdas: { '1': 'Identifica y aplica los elementos y recursos estéticos del inglés en distintas producciones.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Manifestaciones artísticas y culturales del inglés', pdas: { '1': 'Reconoce y valora manifestaciones artísticas y culturales expresadas en inglés.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Creaciones literarias tradicionales y contemporáneas en inglés', pdas: { '1': 'Lee y disfruta creaciones literarias tradicionales y contemporáneas en inglés para promover su lectura.', '2': '(Profundización 2° grado)', '3': 'Crea textos literarios en inglés a partir del uso de recursos propios del idioma.' } },
            { c: 'El inglés para expresar sensaciones, emociones, sentimientos e ideas vinculados con las familias, la escuela y la comunidad', pdas: { '1': 'Usa el inglés para expresar sensaciones, emociones, sentimientos e ideas relacionadas con su entorno familiar, escolar o comunitario.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Relatos en inglés para expresar sucesos significativos familiares, escolares, comunitarios y sociales', pdas: { '1': 'Elabora relatos en inglés sobre sucesos significativos familiares, escolares, comunitarios y sociales.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Comunicación asertiva y dialógica en inglés, para erradicar la violencia en las familias y la escuela', pdas: { '1': 'Usa la comunicación asertiva en inglés para proponer alternativas que erradiquen la violencia en las familias y la escuela.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Mensajes en inglés en medios de comunicación masiva, que promuevan una vida saludable', pdas: { '1': 'Produce mensajes en inglés para medios de comunicación que promuevan una vida saludable.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'El uso del inglés en la construcción de mensajes a favor de la inclusión', pdas: { '1': 'Construye mensajes en inglés que promuevan la inclusión social y educativa.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'El uso del inglés en las manifestaciones culturales y artísticas que favorecen la construcción de una sociedad incluyente', pdas: { '1': 'Analiza y produce manifestaciones culturales y artísticas en inglés que favorezcan una sociedad incluyente.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } }
          ]
        }
      },

      artes: {
        nombre: 'Artes', emoji: '🎭',
        secundaria: {
          todos: [
            { c: 'Diversidad de lenguajes artísticos en la riqueza pluricultural de México y del mundo', pdas: { '1': 'Reconoce y valora la diversidad de lenguajes artísticos como expresión de la riqueza pluricultural de México y del mundo.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Manifestaciones culturales y artísticas que conforman la diversidad étnica, cultural y lingüística', pdas: { '1': 'Identifica manifestaciones culturales y artísticas que expresan la diversidad étnica, cultural y lingüística.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Identidad y sentido de pertenencia en manifestaciones artísticas', pdas: { '1': 'Reconoce cómo las manifestaciones artísticas expresan identidad y sentido de pertenencia comunitaria.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Patrimonio cultural de la comunidad en manifestaciones artísticas que fomentan la identidad y el sentido de pertenencia', pdas: { '1': 'Identifica el patrimonio cultural de su comunidad expresado en manifestaciones artísticas que fomentan la identidad y el sentido de pertenencia.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Los lenguajes artísticos en la expresión de problemas de la comunidad', pdas: { '1': 'Usa los lenguajes artísticos como medio para expresar y visibilizar problemas de su comunidad.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Elementos de las artes y recursos estéticos apreciados en el entorno natural y social, así como en diversas manifestaciones artísticas', pdas: { '1': 'Identifica y aprecia los elementos de las artes y recursos estéticos en el entorno natural, social y en diversas manifestaciones artísticas.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Valor estético de la naturaleza, de la vida cotidiana y de diferentes manifestaciones culturales y artísticas', pdas: { '1': 'Aprecia el valor estético de la naturaleza, la vida cotidiana y diferentes manifestaciones culturales y artísticas.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Creaciones artísticas que tienen su origen en textos literarios', pdas: { '1': 'Explora y crea producciones artísticas que se inspiran en textos literarios.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Expresión artística de sensaciones, emociones, sentimientos e ideas, a partir de experiencias familiares, escolares o comunitarias', pdas: { '1': 'Produce expresiones artísticas que comunican sensaciones, emociones, sentimientos e ideas surgidas de su entorno familiar, escolar o comunitario.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Memoria colectiva representada por medios artísticos, para registrar experiencias comunitarias', pdas: { '1': 'Crea obras artísticas que representen la memoria colectiva y registren experiencias significativas de su comunidad.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Procesos creativos que ponen en práctica la comunicación dialógica, como estrategia para erradicar expresiones de violencia', pdas: { '1': 'Desarrolla procesos creativos dialógicos como estrategia artística para erradicar expresiones de violencia en la escuela y la comunidad.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Vida saludable expresada a través de mensajes construidos con elementos de las artes, para difundirlos por distintos medios de comunicación', pdas: { '1': 'Construye mensajes artísticos sobre vida saludable y los difunde por distintos medios de comunicación.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Sistemas alternativos y aumentativos de comunicación como herramientas creativas que favorecen la inclusión', pdas: { '1': 'Reconoce y aplica sistemas alternativos y aumentativos de comunicación como herramientas creativas e inclusivas.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } },
            { c: 'Manifestaciones artísticas que emplean sistemas alternativos y aumentativos de comunicación, elaboradas por personas en condición de discapacidad y/o diseñadas para ellas', pdas: { '1': 'Valora y crea manifestaciones artísticas que emplean sistemas de comunicación para personas con discapacidad.', '2': '(Profundización 2° grado)', '3': '(Profundización 3° grado)' } }
          ]
        }
      }
    }
  },

  // ╔══════════════════════════════════════════════════════════╗
  // ║  CAMPO 2 · SABERES Y PENSAMIENTO CIENTÍFICO             ║
  // ╚══════════════════════════════════════════════════════════╝
  cientifico: {
    nombre: 'Saberes y Pensamiento Científico', emoji: '🔬', color: '#0369a1', colorLight: '#e0f2fe',
    materias: {

      matematicas: {
        nombre: 'Matemáticas', emoji: '📐',
        secundaria: {
          todos: [
            { c: 'Expresión de fracciones como decimales y de decimales como fracciones', pdas: { '1': 'Usa diversas estrategias al convertir números fraccionarios a decimales y viceversa.', '2': '—', '3': '—' } },
            { c: 'Extensión de los números a positivos y negativos y su orden', pdas: { '1': 'Reconoce la necesidad de los números negativos a partir de usar cantidades que tienen al cero como referencia. Compara y ordena números con signo (enteros, fracciones y decimales) en la recta numérica y analiza en qué casos se cumple la propiedad de densidad.', '2': '—', '3': '—' } },
            { c: 'Extensión del significado de las operaciones y sus relaciones inversas', pdas: { '1': 'Reconoce el significado de las cuatro operaciones básicas y sus relaciones inversas al resolver problemas que impliquen el uso de números con signo. Usa criterios de divisibilidad y números primos al resolver problemas que implican calcular el máximo común divisor y el mínimo común múltiplo. Comprueba y argumenta si cada una de estas operaciones cumple las propiedades: conmutativa, asociativa y distributiva. Calcula potencias con exponente entero y la raíz cuadrada. Usa la notación científica. Identifica y aplica la jerarquía de operaciones y símbolos de agrupación.', '2': 'Usa la notación científica al realizar cálculos con cantidades muy grandes o muy pequeñas.', '3': '—' } },
            { c: 'Regularidades y Patrones', pdas: { '1': 'Representa algebraicamente una sucesión con progresión aritmética de figuras y números.', '2': 'Representa algebraicamente una sucesión con progresión cuadrática de figuras y números.', '3': '—' } },
            { c: 'Introducción al álgebra', pdas: { '1': 'Interpreta y plantea diversas situaciones del lenguaje común al lenguaje algebraico y viceversa. Representa algebraicamente perímetros de figuras.', '2': 'Representa algebraicamente áreas que generan una expresión cuadrática.', '3': 'Representa algebraicamente áreas y volúmenes de cuerpos geométricos y calcula el valor de una variable en función de las otras.' } },
            { c: 'Ecuaciones lineales y cuadráticas', pdas: { '1': 'Resuelve ecuaciones de la forma Ax=B, Ax+B=C, Ax+B=Cx+D con el uso de las propiedades de la igualdad. Modela y resuelve problemas cuyo planteamiento es una ecuación lineal.', '2': 'Identifica y usa las propiedades de los exponentes al resolver distintas operaciones algebraicas. Resuelve desigualdades con expresiones algebraicas. Modela y soluciona sistemas de dos ecuaciones lineales con dos incógnitas por algún método para dar respuesta a un problema.', '3': 'Resuelve ecuaciones de la forma Ax²+Bx+C=0 por factorización y fórmula general. Resuelve problemas cuyo planteamiento es una ecuación cuadrática. Resuelve problemas de porcentajes en diversas situaciones.' } },
            { c: 'Funciones', pdas: { '1': 'Relaciona e interpreta relaciones proporcional y no proporcional a partir de su representación tabular, gráfica y con diagramas. Modela y resuelve diversas situaciones a través de ecuaciones proporcionales con constante positiva y negativa.', '2': 'Relaciona e interpreta la proporcionalidad inversa de dos magnitudes o cantidades, además usa una tabla, gráfica o representación algebraica en diversos contextos.', '3': 'Relaciona e interpreta la variación de dos cantidades a partir de su representación tabular, gráfica y algebraica. Explora diversos procedimientos para resolver problemas de reparto proporcional.' } },
            { c: 'Rectas y ángulos', pdas: { '1': 'Explora las figuras básicas como rectas y ángulos y su notación. Encuentra y calcula los ángulos que se forman al intersecar dos segmentos.', '2': '—', '3': '—' } },
            { c: 'Construcción y propiedades de las figuras planas y cuerpos', pdas: { '1': 'Utiliza la regla y el compás para trazar: punto medio, mediatriz de un segmento, segmentos y ángulos congruentes, bisectriz de un ángulo, rectas perpendiculares y rectas paralelas.', '2': 'Construye con regla y compás polígonos regulares con distinta información. Identifica y usa las relaciones entre figuras en la construcción de teselados.', '3': 'Aplica las propiedades de la congruencia y semejanza de triángulos al construir y resolver problemas. Reconoce las propiedades de los sólidos. Explora la generación de sólidos de revolución a partir de figuras planas. Construye y clasifica triángulos y cuadriláteros a partir del análisis de distinta información. Explora y construye desarrollos planos de diferentes figuras tridimensionales, cilindros, pirámides y conos.' } },
            { c: 'Circunferencia, círculo y esfera', pdas: { '1': 'Identifica y traza las rectas notables en la circunferencia y las relaciones entre ellas. Investiga figuras relacionadas con círculos y propiedades de los círculos. Construye circunferencias a partir de distinta información.', '2': 'Identifica y usa las relaciones entre los ángulos, lados y diagonales para construir a escala triángulos, cuadriláteros y polígonos regulares o irregulares.', '3': 'Determina la medida de ángulos inscritos y centrales, así como de arcos de circunferencia. Explora las intersecciones entre círculos y figuras al calcular perímetros y áreas. Explora y construye desarrollos planos de esferas. Encuentra relaciones de volumen de la esfera, el cono y el cilindro.' } },
            { c: 'Medición y cálculo en diferentes contextos', pdas: { '1': 'Introduce la idea de distancia entre dos puntos como la longitud del segmento que los une. Encuentra la distancia de un punto a una recta y la distancia entre dos rectas paralelas. Explora la desigualdad del triángulo.', '2': 'Resuelve problemas que implican conversiones en múltiplos y submúltiplos del metro, litro, kilogramo y de unidades del sistema inglés (yarda, pulgada, galón, onza y libra). Utiliza estrategias diversas para determinar el perímetro y el área de figuras compuestas.', '3': 'Obtiene y aplica fórmulas o usa otras estrategias para calcular el perímetro y el área de polígonos regulares e irregulares y del círculo. Usa diferentes estrategias para calcular el volumen de prismas, pirámides y cilindros. Formula, justifica y usa el teorema de Pitágoras al resolver problemas. Resuelve problemas utilizando las razones trigonométricas seno, coseno y tangente.' } },
            { c: 'Obtención y representación de información', pdas: { '1': 'Usa tablas, gráficas de barras y circulares para el análisis de información.', '2': 'Recolecta, registra, lee y comunica información mediante histogramas, gráficas poligonales y de línea.', '3': 'Lee, interpreta y comunica información de cualquier tipo de gráficas.' } },
            { c: 'Interpretación de la información a través de medidas de tendencia central y de dispersión', pdas: { '1': 'Determina e interpreta la frecuencia absoluta, la frecuencia relativa, la media, la mediana y la moda en un conjunto de datos.', '2': 'Usa e interpreta las medidas de tendencia central (moda, media aritmética y mediana) y de dispersión (rango y la desviación media) de un conjunto de datos, y justifica con base en ellas sus decisiones.', '3': 'Determina y compara las medidas de tendencia central (media, mediana y moda) y de dispersión (rango y desviación media) de dos conjuntos de datos para tomar decisiones.' } },
            { c: 'Azar y probabilidad', pdas: { '1': 'Compara cualitativamente dos o más eventos a partir de sus resultados posibles, usa relaciones como: "es más probable que…", "es menos probable que…".', '2': 'Realiza experimentos aleatorios y registra los resultados en una tabla de frecuencia como la transición de la probabilidad frecuencial a la teórica. Identifica eventos en los que interviene el azar, determina el espacio muestral y experimenta. Identifica diversos procedimientos de conteo y resuelve problemas.', '3': 'Analiza las características de la medida de la probabilidad y su equivalencia y representación en números decimales, fraccionarios y porcentajes. Resuelve problemas donde se calcule la probabilidad de ocurrencia de dos eventos mutuamente excluyentes y de eventos complementarios (regla de la suma). Resuelve problemas donde se calcule la probabilidad de ocurrencia de dos eventos independientes (regla del producto). Indaga las condiciones necesarias para que un juego de azar sea justo.' } }
          ]
        }
      },

      biologia: {
        nombre: 'Biología', emoji: '🧬',
        nota: 'Primer grado',
        secundaria: {
          todos: [
            { c: 'Funcionamiento del cuerpo humano coordinado por los sistemas nervioso y endocrino', pdas: { '1': 'Explica la participación de los sistemas nervioso y endocrino en la coordinación de las funciones del cuerpo humano; reconoce el papel general de las hormonas y sus efectos en la maduración sexual y en la reproducción. Explica los efectos del consumo de sustancias adictivas en el sistema nervioso y en el funcionamiento integral del cuerpo humano; argumenta la importancia de evitar su consumo a partir del análisis de sus implicaciones en la salud, la sexualidad, la economía y la sociedad.', '2': '—', '3': '—' } },
            { c: 'Salud sexual y reproductiva: prevención de infecciones de transmisión sexual y del embarazo en adolescentes', pdas: { '1': 'Compara las maneras en que la cultura influye en el concepto de sexualidad; reconoce que todas las culturas tienen maneras distintas de comprender el género, la sexualidad y la reproducción. Cuestiona creencias, estereotipos y costumbres que impactan negativamente la salud sexual y reproductiva de niñas y mujeres; reconoce la importancia de la igualdad de género y la responsabilidad compartida en la prevención del embarazo en la adolescencia. Compara la efectividad de los métodos anticonceptivos; valora la efectividad del condón por su doble protección.', '2': '—', '3': '—' } },
            { c: 'Prevención de enfermedades relacionadas con la alimentación y el consumo de alimentos ultraprocesados', pdas: { '1': 'Identifica causas de la obesidad y la diabetes relacionadas con la dieta y el sedentarismo, a fin de formular su proyecto de vida saludable; incluye factores protectores y propone acciones para reducir factores de riesgo. Formula hipótesis acerca de las consecuencias de carencia o exceso de nutrimentos en la dieta; interpreta datos que muestran la correlación entre la incidencia de enfermedades y el consumo de exceso de sal, azúcar y grasas saturadas.', '2': '—', '3': '—' } },
            { c: 'La diversidad de saberes e intercambio de conocimientos acerca de los seres vivos y las relaciones con el medio ambiente', pdas: { '1': 'Reconoce la importancia de los conocimientos, prácticas e innovaciones de los pueblos originarios acerca de los seres vivos; intercambia vivencias y experiencias asociadas al aprovechamiento y la protección como el uso de la herbolaria, la milpa o la conservación de los bosques. Explica por qué los saberes de los pueblos originarios han aportado al aprovechamiento de los recursos naturales en el ecosistema local.', '2': '—', '3': '—' } },
            { c: 'Los procesos vitales de los seres vivos: nutrición, relación con el medio y reproducción', pdas: { '1': 'Compara las características comunes de los seres vivos; identifica que todos tienen estructuras especializadas asociadas a la nutrición, la relación con el medio y la reproducción y los distingue como rasgos adaptativos que favorecen la sobrevivencia de las especies. Clasifica organismos de acuerdo con características comunes; propone hipótesis en torno a posibles relaciones de parentesco entre ellos.', '2': '—', '3': '—' } },
            { c: 'La biodiversidad como expresión del cambio de los seres vivos en el tiempo', pdas: { '1': 'Analiza información acerca del estado de la biodiversidad local; expone razones sobre su importancia cultural, biológica, estética y ética; propone acciones para su cuidado. Indaga las principales aportaciones de Darwin y Wallace, las identifica como una de las explicaciones más fundamentadas acerca del origen de la biodiversidad.', '2': '—', '3': '—' } },
            { c: 'El calentamiento global como una consecuencia de la alteración de los ciclos biogeoquímicos en los ecosistemas', pdas: { '1': 'Representa la transferencia de materia y energía entre los organismos de un ecosistema mediante redes y pirámides tróficas. Identifica interacciones de competencia e interdependencia en el ecosistema local. Analiza las prácticas de consumo que han alterado los ciclos biogeoquímicos del carbono y el nitrógeno, sus efectos asociados al calentamiento global.', '2': '—', '3': '—' } },
            { c: 'Importancia del microscopio para el conocimiento de la unidad y la diversidad de los seres vivos', pdas: { '1': 'Compara cómo han cambiado las primeras observaciones microscópicas respecto de las actuales; valora el avance en el conocimiento de las bacterias, las células y los virus. Describe las estructuras y funciones básicas de la célula a partir de modelos. Formula preguntas y contrasta explicaciones acerca de la manipulación genética.', '2': '—', '3': '—' } },
            { c: 'Las vacunas: su relevancia en el control de algunas enfermedades infecciosas', pdas: { '1': 'Describe las características generales de las bacterias y los virus; formula hipótesis en torno al por qué de la rápida propagación de las enfermedades infecciosas. Valora la importancia y la necesidad de proteger la salud con el uso de las vacunas para el control de algunas enfermedades infecciosas; evalúa sus riesgos y beneficios sociales y económicos.', '2': '—', '3': '—' } }
          ]
        }
      },

      fisica: {
        nombre: 'Física', emoji: '⚡',
        nota: 'Segundo grado',
        secundaria: {
          todos: [
            { c: 'El pensamiento científico, una forma de plantear y solucionar problemas y su incidencia en la transformación de la sociedad', pdas: { '1': '—', '2': 'Describe problemas comunes de la vida cotidiana explicando cómo se procede para buscarles solución; conoce y caracteriza el pensamiento científico para plantearse y resolver problemas en la escuela y su cotidianeidad. Indaga en diferentes fuentes de consulta las aportaciones de mujeres y hombres en el desarrollo de la Física y su contribución al conocimiento científico y tecnológico a nivel nacional e internacional.', '3': '—' } },
            { c: 'Unidades y medidas utilizados en Física', pdas: { '1': '—', '2': 'Identifica las unidades de medición que se ocupan en su entorno escolar, familiar y en su comunidad. Identifica cuáles son, cómo se definen y cuál es la simbología de las unidades básicas y derivadas del Sistema Internacional de Unidades. Conoce los instrumentos de medición y realiza conversiones con los múltiplos y submúltiplos al referirse a una magnitud.', '3': '—' } },
            { c: 'Estructura, propiedades y características de la materia', pdas: { '1': '—', '2': 'Indaga sobre los saberes y prácticas del uso de materiales y sus propiedades y características para construcción, vestimenta y artefactos de uso común. Relaciona e interpreta las teorías sobre estructura de la materia, a partir de los modelos atómicos y de partículas y los fenómenos que les dieron origen. Explora algunos avances recientes en la comprensión de la constitución de la materia.', '3': '—' } },
            { c: 'Estados de agregación de la materia', pdas: { '1': '—', '2': 'Experimenta e interpreta los modelos atómicos y de partículas al proponer hipótesis que expliquen los tres estados de la materia, sus propiedades físicas como la temperatura de fusión, ebullición, densidad, entre otros. Interpreta la temperatura y el equilibrio térmico con base en el modelo de partículas.', '3': '—' } },
            { c: 'Interacciones en fenómenos relacionados con la fuerza y el movimiento', pdas: { '1': '—', '2': 'Experimenta e interpreta las interacciones de la fuerza y el movimiento relacionados con las Leyes de Newton para explicar actividades cotidianas. Identifica los elementos y los diferentes tipos de movimiento relacionados con la velocidad y aceleración y realiza experimentos sencillos. Identifica y describe la presencia de fuerzas en interacciones cotidianas (fricción y fuerzas en equilibrio).', '3': '—' } },
            { c: 'Principios de Pascal y de Arquímedes', pdas: { '1': '—', '2': 'Experimenta e interpreta las interacciones de la fuerza y el movimiento relacionados con los principios de Pascal y de Arquímedes, para explicar actividades cotidianas. Identifica algunos dispositivos de uso cotidiano en los cuales se aplica el Principio de Pascal (sistemas de frenos hidráulicos, elevadores y gatos hidráulicos) y de Arquímedes (flotación de barcos, submarinos y globos aerostáticos).', '3': '—' } },
            { c: 'Saberes y prácticas para el aprovechamiento de energías y la sustentabilidad', pdas: { '1': '—', '2': 'Analiza las características de la energía mecánica (cinética y potencial) y describe casos donde se conserva. Relaciona al calor como una forma de energía. Identifica saberes, prácticas y artefactos sobre el aprovechamiento de las diversas formas de energía renovables y no renovables (solar, eólica, hidráulica, geológica, mareomotriz y nuclear). Realiza experimentos en donde se aproveche la energía del Sol.', '3': '—' } },
            { c: 'Interacciones de la electricidad y el magnetismo', pdas: { '1': '—', '2': 'Experimenta e interpreta algunas manifestaciones y aplicaciones de la electricidad e identifica los cuidados que requiere su uso al revisar protocolos de seguridad. Relaciona e interpreta fenómenos comunes del magnetismo y experimenta con la interacción entre imanes. Experimenta e interpreta el comportamiento de la luz como resultado de la interacción entre electricidad y magnetismo. Explica el funcionamiento de aparatos tecnológicos de comunicación, a partir de las ondas electromagnéticas.', '3': '—' } },
            { c: 'Composición del Universo y Sistema Solar', pdas: { '1': '—', '2': 'Indaga algunos avances recientes en la comprensión sobre la evolución del Universo y su composición. Indaga cómo se lleva a cabo la exploración de los cuerpos celestes, por medio de la detección y procesamiento de las ondas electromagnéticas que emiten. Relaciona e interpreta las características y dinámica del Sistema Solar con la gravitación y el movimiento de los planetas, en particular el caso de la Tierra y la Luna.', '3': '—' } },
            { c: 'Fenómenos, procesos y factores asociados al cambio climático', pdas: { '1': '—', '2': 'Formula hipótesis que relacionan la actividad humana con el aumento de temperatura en el planeta y la emisión de gases de efecto invernadero. Diferencia entre calor, radiación y temperatura al explicar los procesos que originan el efecto invernadero. Indaga sobre fenómenos meteorológicos extremos como olas de calor, ciclones tropicales, sequías y lluvias torrenciales. Propone medidas de mitigación y adaptación, encaminadas al cuidado del medio ambiente y el bienestar común.', '3': '—' } }
          ]
        }
      },

      quimica: {
        nombre: 'Química', emoji: '⚗️',
        nota: 'Tercer grado',
        secundaria: {
          todos: [
            { c: 'Los hitos que contribuyeron al avance del conocimiento científico y tecnológico en el ámbito nacional e internacional, así como su relación en la satisfacción de necesidades humanas y sus implicaciones en la naturaleza', pdas: { '1': '—', '2': '—', '3': 'Reconoce los aportes de saberes de diferentes pueblos y culturas en la satisfacción de necesidades humanas en diversos ámbitos (medicina, construcción, artesanías, textiles y alimentos). Indaga en fuentes de consulta orales y escritas las aportaciones de mujeres y hombres en el desarrollo del conocimiento científico y tecnológico. Reflexiona acerca de los hábitos de consumo responsable a partir del análisis de las actividades relacionadas con el cuidado del medio ambiente.' } },
            { c: 'Las propiedades extensivas e intensivas, como una forma de identificar sustancias y materiales de uso común, así como el aprovechamiento en actividades humanas', pdas: { '1': '—', '2': '—', '3': 'Formula hipótesis para diferenciar propiedades extensivas e intensivas mediante actividades experimentales y, con base en el análisis de resultados, elabora conclusiones. Reconoce la importancia del uso de instrumentos de medición para identificar y diferenciar propiedades de sustancias y materiales cotidianos.' } },
            { c: 'Composición de las mezclas y su clasificación en homogéneas y heterogéneas, así como métodos de separación aplicados en diferentes contextos', pdas: { '1': '—', '2': '—', '3': 'Describe los componentes de una mezcla (soluto–disolvente; fase dispersa y fase dispersante) mediante actividades experimentales y las clasifica en homogéneas y heterogéneas en materiales de uso cotidiano. Deduce métodos para separar mezclas (evaporación, decantación, filtración, extracción, sublimación, cromatografía y cristalización) mediante actividades experimentales.' } },
            { c: 'Importancia de la concentración de sustancias en mezclas de productos de uso cotidiano', pdas: { '1': '—', '2': '—', '3': 'Analiza la concentración de sustancias de una mezcla expresadas en porcentaje en masa y porcentaje en volumen en productos de higiene personal, alimentos y limpieza, entre otros, para la toma de decisiones orientadas al cuidado de la salud y al consumo responsable. Relaciona la concentración de una mezcla con la efectividad o composición de diversos productos de uso cotidiano.' } },
            { c: 'Presencia de contaminantes y su concentración, relacionada con la degradación y contaminación ambiental en la comunidad', pdas: { '1': '—', '2': '—', '3': 'Indaga situaciones problemáticas relacionadas con la degradación y contaminación en la comunidad, vinculadas con el uso de productos y procesos químicos. Sistematiza la información de diferentes fuentes de consulta acerca de la concentración de contaminantes (partes por millón) en aire, agua y suelo. Diseña y lleva a cabo proyectos comunitarios para proponer medidas preventivas o alternativas de solución sustentables para el cuidado de la salud y el medio ambiente.' } },
            { c: 'Mezclas, compuestos y elementos representados con el modelo corpuscular de la materia en sólidos, líquidos y gases, así como su caracterización mediante actividades experimentales', pdas: { '1': '—', '2': '—', '3': 'Explica semejanzas y diferencias de mezclas, compuestos y elementos, a partir de actividades experimentales y los clasifica en materiales de uso cotidiano. Construye modelos corpusculares de mezclas, compuestos y elementos, a fin de comprender la estructura interna de los materiales en diferentes estados de agregación.' } },
            { c: 'La Tabla periódica: criterios de clasificación de los elementos químicos y sus propiedades (electronegatividad, energía de ionización y radio atómico)', pdas: { '1': '—', '2': '—', '3': 'Reconoce la presencia y predominancia de algunos elementos químicos que conforman a los seres vivos, la Tierra y el Universo, así como su ubicación en la Tabla periódica: metales, no metales y semimetales. Interpreta la información de la Tabla periódica ordenada por el número atómico, así como por grupos y periodos e identifica las propiedades periódicas de elementos representativos. Construye modelos atómicos de Bohr con base en el número atómico de los primeros elementos químicos. Representa los electrones de valencia de átomos de diferentes elementos químicos por medio de diagramas de Lewis.' } },
            { c: 'Los compuestos iónicos y moleculares: propiedades y estructura, así como su importancia en diferentes ámbitos', pdas: { '1': '—', '2': '—', '3': 'Experimenta y diferencia los compuestos iónicos y moleculares, a partir de las propiedades identificadas en actividades experimentales; elabora conclusiones, inferencias y predicciones con base en la evidencia obtenida. Analiza la formación y estructura de compuestos iónicos y moleculares, a partir de las propiedades de la Tabla periódica. Valora el aprovechamiento de propiedades de compuestos iónicos y moleculares en el cuerpo humano y en diferentes ámbitos.' } },
            { c: 'Los alimentos como fuente de energía química: carbohidratos, proteínas y lípidos', pdas: { '1': '—', '2': '—', '3': 'Reconoce los saberes de pueblos y culturas acerca de la diversidad de los alimentos y su importancia en el diseño de menús orientados a una dieta saludable acorde al contexto. Explica cómo obtiene la energía el cuerpo humano a partir de los nutrimentos e identifica los alimentos que los contienen. Valora la importancia de vitaminas, minerales y agua simple potable para el adecuado funcionamiento del cuerpo humano. Analiza el aporte energético de los alimentos y lo relaciona con las actividades físicas personales.' } },
            { c: 'Las reacciones químicas: manifestaciones, transformaciones y representaciones con base en la Ley de conservación de la materia y la energía', pdas: { '1': '—', '2': '—', '3': 'Reconoce distintas reacciones químicas en su entorno y en actividades experimentales, a partir de sus manifestaciones y el cambio de propiedades de reactivos a productos. Representa reacciones mediante modelos tridimensionales y ecuaciones químicas, con base en el lenguaje científico y la Ley de la conservación de la materia. Explica y representa intercambios de materia y energía –endotérmicas y exotérmicas– de reactivos a productos y su aprovechamiento en actividades humanas.' } },
            { c: 'Propiedades de ácidos y bases, reacciones de neutralización y modelo de Arrhenius', pdas: { '1': '—', '2': '—', '3': 'Distingue las propiedades de ácidos y bases en su entorno a partir de indicadores e interpreta la escala de acidez y basicidad. Deduce los productos de reacciones de neutralización sencillas con base en el modelo de Arrhenius, mediante actividades experimentales. Diseña y lleva a cabo reacciones de neutralización a fin de obtener productos útiles en la vida cotidiana. Evalúa los beneficios y riesgos a la salud y al medio ambiente de ácidos y bases.' } },
            { c: 'Las reacciones de óxido-reducción (redox): identificación del número de oxidación y de agentes oxidantes y reductores', pdas: { '1': '—', '2': '—', '3': 'Identifica reacciones de redox en su entorno y comprende su importancia en diferentes ámbitos. Analiza la transferencia de electrones entre reactivos y productos en reacciones de redox con base en el cambio del número de oxidación. Valora los beneficios y el costo ambiental de procesos y productos derivados de las reacciones redox, por medio de debates argumentando su postura a favor de la sustentabilidad.' } }
          ]
        }
      }
    }
  },

  // ╔══════════════════════════════════════════════════════════╗
  // ║  CAMPO 3 · ÉTICA, NATURALEZA Y SOCIEDADES               ║
  // ╚══════════════════════════════════════════════════════════╝
  etica: {
    nombre: 'Ética, Naturaleza y Sociedades', emoji: '🌱', color: '#047857', colorLight: '#d1fae5',
    materias: {

      geografia: {
        nombre: 'Geografía', emoji: '🌍',
        nota: 'Primer grado',
        secundaria: {
          todos: [
            { c: 'El espacio geográfico como una construcción social y colectiva', pdas: { '1': 'Comprende que el espacio geográfico se conforma de interrelaciones sociedad-naturaleza. Reconoce que el patrimonio biocultural es resultado de la relación entre las formas de organización económico-social, la cultura y la biodiversidad a través del tiempo. Distingue la distribución de las principales regiones bioculturales principales en México y el mundo.', '2': '—', '3': '—' } },
            { c: 'Las categorías de análisis espacial y representaciones del espacio geográfico', pdas: { '1': 'Reconoce saberes ancestrales acerca del espacio geográfico, formas de ubicación y representaciones en México y el mundo. Comprende las categorías de análisis espacial para explicar las características del espacio geográfico: lugar, región, paisaje y territorio. Utiliza los conceptos de localización, distribución, diversidad, temporalidad y cambio e interacción para el estudio del espacio geográfico.', '2': '—', '3': '—' } },
            { c: 'La distribución y dinámica de las aguas continentales y oceánicas en la Tierra', pdas: { '1': 'Analiza la distribución de las aguas continentales en México y el mundo: principales ríos, lagos, aguas subterráneas, llanuras inundables y humedales. Reconoce la importancia de las cuencas hidrográficas como un sistema para el desarrollo económico en México, así como para la conservación del agua y la tierra. Valora el mar territorial, la zona económica exclusiva de México y sus litorales, como recursos que contribuyen al desarrollo del país.', '2': '—', '3': '—' } },
            { c: 'La relación de las placas tectónicas con el relieve, la sismicidad y el vulcanismo', pdas: { '1': 'Identifica qué son las placas tectónicas, cuáles son sus características y dinámica. Argumenta la relación entre las placas tectónicas con las regiones sísmicas y volcánicas en México y el mundo, para fortalecer la cultura de la prevención. Relaciona los movimientos de las placas tectónicas con la distribución del relieve de la superficie terrestre y reconoce otros agentes que lo modelan.', '2': '—', '3': '—' } },
            { c: 'Los riesgos de desastre, su relación con los procesos naturales y la vulnerabilidad de la población en lugares específicos', pdas: { '1': 'Identifica que los desastres pueden ser originados por procesos naturales o por las actividades humanas. Relaciona los efectos ambientales, sociales y económicos de los desastres recientes en México y el mundo, tomando en cuenta la vulnerabilidad de la población. Valora la importancia de consolidar una cultura de prevención de desastres con la participación de instituciones, organismos y la sociedad.', '2': '—', '3': '—' } },
            { c: 'Crecimiento, distribución, composición y migración de la población', pdas: { '1': 'Analiza las implicaciones sociales, ambientales y económicas del crecimiento, distribución y composición de la población en diferentes países, con base en información estadística y cartográfica. Emplea las nociones de concentración y dispersión de la población para explicar los rasgos y problemas del espacio urbano y el rural. Distingue la movilidad como un derecho humano, los tipos de migración y principales flujos migratorios para comprender los efectos socioeconómicos y culturales.', '2': '—', '3': '—' } },
            { c: 'Los procesos productivos y sus consecuencias ambientales y sociales en la comunidad, México y el mundo', pdas: { '1': 'Compara procesos productivos y espacios económicos en México y el mundo, para reconocer sus implicaciones sociales, económicas y ambientales. Analiza y relaciona distintos procesos productivos sustantivos en la conformación social, económica y espacial de las sociedades a nivel mundial, para identificar sus contradicciones y desigualdades.', '2': '—', '3': '—' } },
            { c: 'Las prácticas de producción, distribución y consumo sustentables como alternativas para preservar el medio ambiente y asegurar el bienestar de las generaciones presentes y futuras', pdas: { '1': 'Comprende qué es la sustentabilidad e identifica prácticas de producción, distribución y consumo sustentables. Argumenta sobre prácticas sustentables de producción, distribución y consumo que pueden contribuir al bienestar de la comunidad y de México. Propone alternativas sustentables de desarrollo social para la preservación del medio ambiente y el bienestar de las generaciones presentes y futuras.', '2': '—', '3': '—' } },
            { c: 'Las desigualdades socioeconómicas en México y el mundo, y sus efectos en la calidad de vida de las personas', pdas: { '1': 'Comprende qué son las desigualdades socioeconómicas e identifica sus efectos y repercusiones en la vida de las personas. Argumenta las desigualdades socioeconómicas en México y el mundo, mediante la interpretación del Índice de Desarrollo Humano (IDH) y el Índice para una vida mejor. Propone acciones para reducir las desigualdades socioeconómicas en la comunidad, México y el mundo.', '2': '—', '3': '—' } },
            { c: 'Los conflictos territoriales actuales en México y el mundo, y sus implicaciones ambientales y sociales', pdas: { '1': 'Debate acerca de la multicausalidad de los conflictos territoriales en México y el mundo, la importancia de la ubicación geográfica de las partes involucradas y las consecuencias ambientales, sociales, económicas y políticas. Promueve alternativas de resolución justas y pacíficas a los conflictos territoriales.', '2': '—', '3': '—' } },
            { c: 'Los retos sociales y ambientales en la comunidad, en México y el mundo', pdas: { '1': 'Reconoce cómo las problemáticas sociales y ambientales afectan a la comunidad. Asume responsabilidad como agente de cambio para encontrar soluciones a las problemáticas sociales y ambientales de la comunidad.', '2': '—', '3': '—' } },
            { c: 'La diversidad de grupos sociales y culturales en México', pdas: { '1': 'Reconoce la diversidad de pueblos originarios, afromexicanos, migrantes, grupos urbanos, grupos sociales en México, como parte de la identidad nacional pluricultural y la compara con la diversidad social y cultural en el mundo. Valora la importancia del espacio en la conformación de las identidades juveniles.', '2': '—', '3': '—' } },
            { c: 'El suelo, recurso estratégico para la seguridad alimentaria y la vida en el planeta', pdas: { '1': 'Indaga sobre el origen, los usos y los problemas del suelo en la localidad. Reflexiona acerca de la contradicción que existe entre los países con suelo de vocación agrícola y la poca productividad asociada con los problemas del suelo (sobreexplotación, degradación, pérdida). Comparte alternativas para la protección y recuperación del suelo y colabora de manera organizada en acciones comunitarias.', '2': '—', '3': '—' } },
            { c: 'El reto del cambio climático', pdas: { '1': 'Reconoce las relaciones e interacciones entre los elementos y los factores del clima como base para comprender la distribución de las regiones naturales en la Tierra y analizar la biodiversidad en el mundo. Indaga y analiza de manera crítica los cambios ocurridos en el clima, sus causas y consecuencias en México y el mundo. Asume una postura crítica y activa ante los fenómenos derivados del calentamiento global y el cambio climático.', '2': '—', '3': '—' } }
          ]
        }
      },

      historia: {
        nombre: 'Historia', emoji: '🏛️',
        secundaria: {
          todos: [
            { c: 'Los albores de la humanidad: los pueblos antiguos del mundo y su devenir', pdas: { '1': 'Busca, localiza y estudia con sus pares fuentes que dan cuenta de mitos fundacionales de pueblos antiguos. Refleja acerca de las teorías que explican el poblamiento original de América. Emplea sistemas para ubicar en el espacio y en el tiempo aspectos de la vida cotidiana de los pueblos antiguos que surgieron en Mesoamérica, Aridoamérica y Oasisamérica. Desarrolla teóricamente el entramado de causas de diverso tipo que dieron lugar a la agricultura mesoamericana.', '2': 'Recupera las explicaciones de Darwin acerca del origen y evolución de la biodiversidad. Aplica el eje organizador uso y gestión del agua para analizar el desarrollo histórico de las antiguas civilizaciones mesopotámica, egipcia, hindú y china. Problematiza la relación germánicos-romanos y la desintegración del Imperio Romano de Occidente.', '3': '—' } },
            { c: 'La conformación de las metrópolis y los sistemas de dominación', pdas: { '1': 'Formula preguntas, recopila información y comparte sus hallazgos en torno a los pueblos originarios de México. Indaga los orígenes de la población afromexicana, sus aportaciones sociales y a la cultura de nuestro país. Revisa y contextualiza las campañas militares que Hernán Cortés llevó a cabo para someter a la población indígena. Ubica a la Conquista como un momento de ruptura en la historia de nuestro país.', '2': 'Explica la consolidación del Reino Español alrededor de Isabel I de Castilla y Fernando II de Aragón. Busca información acerca de la expedición de 1492 de Cristóbal Colón y el descubrimiento de América. Caracteriza las colonizaciones realizadas por españoles, portugueses, ingleses, franceses y holandeses en América y en Asia.', '3': '—' } },
            { c: 'Las gestas de resistencia y los movimientos independentistas', pdas: { '1': '—', '2': '—', '3': '(Profundización 3° grado)' } },
            { c: 'Las revoluciones modernas y sus tendencias', pdas: { '1': '—', '2': 'Analiza las revoluciones modernas y sus tendencias en el contexto histórico correspondiente.', '3': '—' } },
            { c: 'Las tensiones en el siglo XX', pdas: { '1': '—', '2': 'Analiza las principales tensiones del siglo XX y su impacto en el mundo actual.', '3': '—' } },
            { c: 'La construcción histórica de las ideas sobre las juventudes e infancias', pdas: { '1': '—', '2': 'Reflexiona sobre la construcción histórica de los conceptos de juventud e infancia a lo largo del tiempo.', '3': '—' } },
            { c: 'Las mujeres y sus historias', pdas: { '1': '—', '2': 'Reconoce el papel histórico de las mujeres y su contribución al desarrollo de las sociedades.', '3': '—' } },
            { c: 'Las luchas de las mujeres por sus derechos', pdas: { '1': '—', '2': 'Analiza los movimientos feministas y las luchas históricas de las mujeres por el reconocimiento de sus derechos.', '3': '—' } },
            { c: 'Movilidades humanas, migraciones y nuevos escenarios para la vida', pdas: { '1': '—', '2': 'Comprende las movilidades humanas y las migraciones como fenómenos históricos y contemporáneos que configuran nuevos escenarios para la vida.', '3': '—' } },
            { c: 'Amor, amistad, familias y relaciones entre las personas en la historia', pdas: { '1': '—', '2': 'Reflexiona sobre cómo el amor, la amistad, las familias y las relaciones entre las personas han sido interpretados y valorados a lo largo de la historia.', '3': '—' } },
            { c: 'Grupos sociales y culturales en la conformación de las identidades juveniles', pdas: { '1': '—', '2': 'Analiza cómo los grupos sociales y culturales influyen en la conformación de las identidades juveniles en distintos contextos históricos.', '3': '—' } },
            { c: 'Relaciones de poder y lucha por los derechos de grupos históricamente discriminados o subrepresentados', pdas: { '1': '—', '2': '—', '3': 'Analiza las relaciones de poder y las luchas históricas de grupos discriminados o subrepresentados por el reconocimiento de sus derechos.' } },
            { c: 'Discriminación, racismo, sexismo y prejuicios como construcciones históricas', pdas: { '1': '—', '2': '—', '3': 'Reflexiona críticamente sobre cómo la discriminación, el racismo, el sexismo y los prejuicios se han construido históricamente en las sociedades.' } }
          ]
        }
      },

      fce: {
        nombre: 'Formación Cívica y Ética', emoji: '⚖️',
        secundaria: {
          todos: [
            { c: 'Grupos sociales y culturales en la conformación de las identidades juveniles', pdas: { '1': 'Valora la diversidad de grupos e identidades juveniles en la escuela y en la comunidad y fortalece el respeto a formas de ser, pensar y expresarse en el marco de los derechos humanos.', '2': 'Argumenta sobre el derecho a pertenecer a una cultura, grupo social, económico, ideológico, sexual o de género, entre otros, para exigir el respeto a las identidades juveniles.', '3': 'Promueve espacios de participación juvenil, presenciales o virtuales, para construir comunidades que promuevan la colaboración, el respeto y el ejercicio de los derechos de niñas, niños y adolescentes.' } },
            { c: 'Los derechos humanos en México y en el mundo como valores compartidos por las sociedades actuales', pdas: { '1': 'Asume una postura crítica acerca de la vigencia de los derechos humanos como valores compartidos por distintas sociedades del mundo.', '2': 'Propone acciones orientadas a fortalecer la igualdad de derechos, el bienestar colectivo y el respeto a la dignidad humana en poblaciones históricamente marginadas y vulneradas.', '3': 'Debate acerca de la importancia de defender y exigir el respeto a los derechos humanos, como un reto de las sociedades actuales para vivir con dignidad, libertad, justicia e inclusión.' } },
            { c: 'Movimientos sociales y políticos por los derechos humanos en el mundo y en México', pdas: { '1': 'Asume una postura ética acerca de los movimientos sociales y políticos que originaron los derechos humanos en el mundo y su influencia en México.', '2': 'Explica la trascendencia de los movimientos sociales y políticos en México y América Latina, para garantizar el ejercicio de derechos económicos, políticos y sociales.', '3': 'Asume una postura ética sobre los movimientos sociales y políticos en la actualidad y participa en acciones para promover y defender los derechos humanos.' } },
            { c: 'Consecuencias de la desigualdad en la calidad de vida de las personas y comunidades', pdas: { '1': 'Analiza las causas que dan origen a las diferencias en la calidad de vida de la población en México y el mundo y las compara con su derecho a la igualdad sustantiva y a una vida digna.', '2': 'Explica las consecuencias de la desigualdad socioeconómica en la calidad de vida de la población y propone acciones que garanticen el derecho a una vida digna y justa.', '3': 'Actúa éticamente para reducir las desigualdades, fomentando el respeto y la solidaridad en los pueblos más vulnerados en su comunidad, México y América Latina.' } },
            { c: 'Normas, leyes, instituciones y organizaciones encargadas de proteger, defender y exigir la aplicación de los derechos humanos en la convivencia diaria', pdas: { '1': 'Aprecia los beneficios de participar en la construcción y aplicación de normas y leyes para garantizar la convivencia y el ejercicio de los derechos humanos en la comunidad y el país.', '2': 'Participa en la creación y transformación de normas y leyes que aplican en distintos contextos, orientadas a favorecer la igualdad, la libertad, la justicia y los derechos humanos.', '3': 'Analiza la función de instituciones y organizaciones nacionales e internacionales, para demandar la aplicación de normas y leyes que defienden y exigen respeto a los derechos humanos.' } },
            { c: 'El conflicto en la convivencia humana desde la cultura de paz', pdas: { '1': 'Analiza distintos tipos de conflictos en sus espacios de convivencia, su estructura y formas de solucionarlos desde la cultura de paz como una oportunidad de crecimiento personal y social.', '2': 'Propone distintas formas de resolver conflictos sociales y políticos ocurridos en México y América Latina, para generar estrategias de mediación desde la cultura de paz.', '3': 'Valora la resolución pacífica de conflictos sociales y políticos en México y el mundo y gestiona estrategias de participación y transformación social hacia una cultura de paz.' } },
            { c: 'La cultura de paz y la creación de ambientes que garanticen el respeto a la vida y la dignidad del ser humano', pdas: { '1': 'Comprende la influencia que tiene la cultura de paz en la convivencia escolar, familiar y comunitaria, para favorecer ambientes libres de discriminación y racismo.', '2': 'Aplica la cultura de paz para tomar decisiones responsables en contextos presenciales y virtuales que promuevan el respeto a la dignidad, la diversidad, la inclusión y la interculturalidad.', '3': 'Colabora con personas de la escuela, la comunidad, el país y el mundo, para rechazar y denunciar la violencia, así como fortalecer el tejido social mediante acciones orientadas hacia una cultura de paz.' } },
            { c: 'Personas, grupos y organizaciones a favor de la cultura de paz', pdas: { '1': 'Aprecia las acciones de personas, grupos u organizaciones en México a favor de la cultura de paz para promover ambientes libres de violencia.', '2': 'Analiza las acciones de personas, grupos u organizaciones realizadas en México y América Latina para promover actitudes, valores y comportamientos basados en una cultura de paz.', '3': 'Valora las acciones que personas, grupos u organizaciones han realizado en México y América Latina para resolver los conflictos territoriales, políticos y sociales de manera no violenta.' } },
            { c: 'Principios éticos como referentes para un desarrollo sustentable', pdas: { '1': 'Reflexiona éticamente acerca de la relación de las comunidades con su contexto socionatural para impulsar acciones que promuevan el desarrollo sustentable, así como actitudes de cuidado y respeto a otros seres vivos.', '2': 'Evalúa la contribución de la ética en las prácticas de producción, distribución y consumo de bienes y servicios, para generar alternativas de desarrollo sustentables.', '3': 'Implementa acciones de colaboración, reciprocidad, solidaridad y de participación igualitaria como valores para un desarrollo sustentable.' } },
            { c: 'Igualdad sustantiva en el marco de la interculturalidad, la inclusión y la perspectiva de género', pdas: { '1': 'Aprecia la interculturalidad y el respeto al derecho a la igualdad sustantiva para establecer relaciones incluyentes y respetuosas de la diversidad, rechazando la discriminación y el racismo.', '2': 'Elabora juicios éticos sobre problemas de injusticia y discriminación que afectan la igualdad sustantiva y realiza propuestas congruentes con el respeto a la inclusión, la interculturalidad y la perspectiva de género.', '3': 'Participa en acciones dirigidas a reducir brechas de desigualdad para promover y fortalecer la interculturalidad, la inclusión y la perspectiva de género.' } },
            { c: 'Medidas de protección y mecanismos de denuncia en el rechazo a la violencia de género, sexual y la trata de personas', pdas: { '1': 'Analiza situaciones de violencia escolar, de género, sexual y la trata de personas, con base en la perspectiva de género y demanda la aplicación de medidas de prevención y protección.', '2': 'Compara los tipos de violencia escolar, de género y la trata de personas e identifica medidas de protección y mecanismos de denuncia.', '3': 'Propone acciones de denuncia en contextos presenciales y en las redes sociales para garantizar el derecho a una vida libre de violencia de género, sexual y la trata de personas.' } },
            { c: 'Principios y valores de la cultura democrática como forma de gobierno y de vida', pdas: { '1': 'Aprecia en los principios y valores de la democracia una forma de vida y de gobierno, para tomar decisiones que fortalezcan la convivencia en los espacios donde participa.', '2': 'Propone acciones para fortalecer en su entorno los rasgos del Estado de derecho democrático como el imperio de la ley, la división de poderes, los contrapesos de poder y el respeto a los derechos humanos.', '3': 'Participa de manera activa, responsable e informada en la promoción, defensa y reivindicación de los principios y valores de la democracia.' } },
            { c: 'Proyectos como un recurso para atender problemáticas de la comunidad desde una ciudadanía democrática', pdas: { '1': 'Participa en actividades y proyectos en su entorno escolar y social, en donde aplica mecanismos de participación democrática y los rasgos de la ciudadanía responsable y crítica.', '2': 'Elabora proyectos orientados a resolver necesidades y problemas relacionados con la violencia escolar y de género, aprovechando los recursos de la ciudadanía digital.', '3': 'Colabora en proyectos con la comunidad para responder a necesidades colectivas en sus dimensiones política, civil y social, así como para transformar las condiciones que atentan contra los derechos humanos y la cultura democrática.' } },
            { c: 'Instituciones, organizaciones y mecanismos de representación democrática', pdas: { '1': 'Aprecia la función de las instituciones y organizaciones sociales y políticas, así como de los mecanismos de participación y representación ciudadana, que fortalecen la vida democrática.', '2': 'Destaca la importancia de la participación ciudadana, organizaciones sociales y partidos políticos en México, para evaluar los alcances y límites del gobierno democrático.', '3': 'Valora los retos que enfrenta la democracia en México y el mundo para involucrarse en su fortalecimiento.' } },
            { c: 'Defensa del derecho al acceso a la protección de datos personales, a la información, la transparencia y la rendición de cuentas en un gobierno democrático', pdas: { '1': 'Destaca la importancia de que las servidoras y los servidores públicos y representantes populares desempeñen sus funciones con apego a la ley de manera honesta, transparente y limitada.', '2': 'Aprecia la participación ciudadana para exigir a las autoridades que cumplan sus funciones y administren los recursos públicos con honestidad, transparencia y legalidad.', '3': 'Analiza el actuar de partidos políticos, organizaciones, gobiernos y las servidoras y los servidores públicos, mediante el acceso a la información, transparencia y rendición de cuentas.' } },
            { c: 'El derecho a la salud y la prevención en el consumo de drogas', pdas: { '1': 'Reconoce que el consumo de drogas afecta el derecho a la dignidad y la salud de las personas, y demanda la aplicación de medidas que contribuyan a la prevención y protección.', '2': 'Promueve valores y habilidades para desarrollar la autoestima, la autorregulación, el autocuidado y el asertividad para prevenir el consumo de drogas y demanda el derecho a la salud integral.', '3': 'Toma decisiones autónomas, responsables y comprometidas para prevenir el consumo de drogas y denuncia situaciones que atentan contra la salud.' } }
          ]
        }
      }
    }
  },

  // ╔══════════════════════════════════════════════════════════╗
  // ║  CAMPO 4 · DE LO HUMANO Y LO COMUNITARIO               ║
  // ╚══════════════════════════════════════════════════════════╝
  humano: {
    nombre: 'De lo Humano y lo Comunitario', emoji: '🎨', color: '#b45309', colorLight: '#fef3c7',
    materias: {

      tecnologia: {
        nombre: 'Tecnología', emoji: '⚙️',
        secundaria: {
          todos: [
            { c: 'Herramientas, máquinas e instrumentos, como extensión corporal, en la satisfacción continua de intereses y necesidades humanas', pdas: { '1': 'Explora las posibilidades corporales y la delegación de funciones en herramientas, máquinas, instrumentos y formas de organización para identificar sus funciones y procesos de cambio técnico, en la satisfacción de intereses y necesidades de diversas sociedades.', '2': 'Analiza las herramientas, máquinas, instrumentos y formas de organización, como una extensión de las posibilidades corporales para solucionar problemas en diversos contextos.', '3': 'Amplía sus posibilidades corporales por medio del conocimiento y habilidades en el manejo de herramientas, máquinas, instrumentos y formas de organización en procesos técnicos comunitarios, para favorecer la inclusión y la sustentabilidad.' } },
            { c: 'Materiales, procesos técnicos y comunidad', pdas: { '1': 'Distingue el origen, transformación y características tecnológicas de los materiales que comparten técnicas similares, para utilizarlos desde una perspectiva local, eficiente y sustentable.', '2': 'Explora el uso y transformación de los materiales, de acuerdo con sus características en los procesos técnicos de distintas comunidades, para prevenir daños sociales o a la naturaleza.', '3': 'Implementa alternativas a situaciones que, por el origen, transformación, uso o desecho de los materiales, ponen en riesgo el entorno de la comunidad, para favorecer el desarrollo sustentable.' } },
            { c: 'Usos e implicaciones de la energía en los procesos técnicos', pdas: { '1': 'Comprende la función de la energía en los sistemas técnicos y sus implicaciones en el desarrollo tecnológico para la toma de decisiones responsables, que permitan prever y disminuir riesgos personales, sociales y naturales.', '2': 'Explora las principales fuentes de energía en los procesos técnicos para su uso óptimo, así como las alternativas de prevención de riesgos personales, sociales y naturales.', '3': 'Analiza diversas fuentes de energía en los procesos técnicos para considerar posibles alternativas sustentables en su funcionamiento.' } },
            { c: 'Factores que inciden en los procesos técnicos', pdas: { '1': 'Comprende la satisfacción de necesidades como la base de la creación e innovación técnica para reflexionar acerca de la influencia de intereses, prejuicios, estereotipos y aspiraciones, que favorecen o limitan la igualdad de oportunidades, en el desarrollo de procesos técnicos.', '2': 'Analiza factores sociales, económicos, culturales y naturales a tomar en cuenta en la definición de criterios para el desarrollo de soluciones técnicas que mejoran la calidad de vida.', '3': 'Implementa técnicas, procesos o formas de organización en la comunidad, para favorecer la equidad, igualdad, inclusión y la sustentabilidad.' } },
            { c: 'Procesos técnicos', pdas: { '1': 'Describe los elementos que interactúan en los sistemas técnicos (formas de organización, medios, materiales, energía, conocimientos, saberes, experiencias) para comprender su vínculo con la sociedad, la cultura y la naturaleza.', '2': 'Analiza los diferentes sistemas técnicos: artesanales, industriales y automatizados para reconocer sus características y procesos, además de su vínculo con la ciencia, la sociedad, la cultura, la economía y la naturaleza.', '3': 'Propone e implementa posibles emprendimientos artesanales o fabriles para atender una problemática local, considerando los elementos del sistema técnico, desde una perspectiva sustentable.' } },
            { c: 'Comunicación y representación técnica', pdas: { '1': 'Explora la importancia del lenguaje técnico y el consenso en su uso desde diferentes contextos, para proponer formas de representación y comunicar sus ideas.', '2': 'Elabora representaciones gráficas de sus ideas con respecto a la operación, funcionamiento y diseño de las producciones técnicas, para ampliar las posibilidades de comunicación.', '3': 'Difunde por diversos medios el funcionamiento y operación de sus proyectos, para dar a conocer sus alcances a distintas personas.' } },
            { c: 'Pensamiento estratégico y creativo en la resolución de problemas', pdas: { '1': 'Analiza necesidades del entorno cercano para plantear un problema, investigar alternativas de solución y seleccionar la que mejor se adapte a los criterios y condiciones contextuales.', '2': 'Planifica y organiza acciones, medios técnicos e insumos, para el desarrollo de alternativas de solución a diversos problemas identificados.', '3': 'Implementa, da seguimiento y evalúa las propuestas conforme a los criterios y condiciones establecidas en un plan para satisfacer las necesidades o intereses identificados.' } },
            { c: 'Evaluación de sistemas tecnológicos', pdas: { '1': 'Comprende la importancia de la evaluación de los procesos como parte de la innovación y mejora continua, para el logro de la eficiencia, eficacia, fiabilidad y factibilidad de los sistemas técnicos.', '2': 'Analiza las implicaciones de los procesos, productos o servicios en la naturaleza y la sociedad, para desarrollar sistemas técnicos sustentables.', '3': 'Participa en la evaluación interna y externa de sistemas tecnológicos para mejorar su eficiencia, eficacia, fiabilidad y factibilidad desde un enfoque sustentable.' } }
          ]
        }
      },

      'Tutoría': {
        nombre: 'Educación Socioemocional / Tutoría', emoji: '💬',
        secundaria: {
          todos: [
            { c: 'Formas de ser, pensar, actuar y relacionarse', pdas: { '1': 'Reconoce ideas, gustos, necesidades, posibilidades, intereses, deseos y experiencias, para favorecer el autoconocimiento y descubrimiento de nuevas potencialidades.', '2': 'Analiza las formas de ser, pensar, actuar e interactuar, para comprender las diversas maneras de vivenciar situaciones cotidianas y lograr el bienestar personal y social.', '3': 'Promueve el entendimiento mutuo y la toma de decisiones, considerando formas de ser, pensar, actuar y relacionarse ante diferentes situaciones y contextos, para lograr un mayor bienestar personal y social.' } },
            { c: 'Los sentimientos y su influencia en la toma de decisiones', pdas: { '1': 'Distingue entre emociones, estados de ánimo y sentimientos como elementos que contribuyen a la construcción de relaciones afectivas inclusivas y equitativas. Reconoce que los sentimientos son resultado de las vivencias y la cultura.', '2': 'Reflexiona sobre cómo los sentimientos se construyen a partir de ideas y experiencias, para la toma de decisiones asertivas.', '3': 'Gestiona los afectos para tomar decisiones asertivas y construir relaciones de convivencia inclusivas y equitativas.' } },
            { c: 'Construcción del proyecto de vida', pdas: { '1': 'Reconoce cambios presentes a lo largo de la vida y en la adolescencia para definir metas personales y en colectivo, a alcanzar en un corto, mediano y largo plazo. Valora metas individuales y de otras personas a partir de identificar situaciones y formas de actuar que las afectan.', '2': 'Analiza intereses y necesidades, así como logros y metas personales y compartidas de acuerdo con conocimientos, capacidades y habilidades desarrolladas hasta el momento para proponer ideas acerca de un proyecto de vida personal. Replantea sus metas a partir del análisis de logros y situaciones afrontadas, para favorecer el bienestar personal y comunitario.', '3': 'Visualiza un proyecto de vida para determinar posibles retos a superar, estrategias de apoyo mutuo y acciones a realizar en favor del bienestar personal y colectivo. Reconoce nuevos intereses, habilidades y necesidades, propias y de las demás personas, con la finalidad de replantear metas individuales y grupales en favor del bienestar común.' } },
            { c: 'Prevención de situaciones de riesgo', pdas: { '1': 'Incorpora prácticas que inciden en la prevención de situaciones de riesgo ante accidentes, adicciones, formas de violencia y fenómenos naturales, para favorecer el desarrollo personal, familiar y comunitario, así como el cuidado del medio ambiente.', '2': 'Participa en la construcción de alternativas personales, familiares y comunitarias, que favorezcan la prevención de situaciones de riesgo ante accidentes, adicciones, formas de violencia y fenómenos naturales.', '3': 'Reflexiona sobre las condiciones del contexto familiar y comunitario que representan situaciones de riesgo a la salud, a la seguridad y al medio ambiente para el autocuidado y el bienestar colectivo.' } },
            { c: 'Educación Integral en Sexualidad', pdas: { '1': 'Identifica las dimensiones de la sexualidad: biológica, psicológica, social, cultural, entre otras, en distintos momentos de su vida, para establecer relaciones en favor del bienestar.', '2': 'Valora la identidad y la diversidad de formas de expresión de género para comprender la manera en que favorece la interacción con las personas y el desarrollo integral.', '3': 'Promueve estrategias en favor de una educación integral en sexualidad para incorporarlas permanentemente en su proyecto de vida.' } }
          ]
        }
      },

      edufisica: {
        nombre: 'Educación Física', emoji: '🏃',
        secundaria: {
          todos: [
            { c: 'Capacidades, habilidades y destrezas motrices', pdas: { '1': 'Explora las capacidades, habilidades y destrezas motrices, para enriquecer y ampliar el potencial propio y de las demás personas.', '2': 'Integra sus capacidades, habilidades y destrezas motrices, para poner a prueba el potencial individual y de conjunto.', '3': 'Valora las capacidades, habilidades y destrezas propias y de las demás personas, para mostrar mayor disponibilidad corporal y autonomía motriz.' } },
            { c: 'Potencialidades cognitivas, expresivas, motrices, creativas y de relación', pdas: { '1': 'Pone en práctica los elementos de la condición física en actividades motrices y recreativas, para reconocerlas como alternativas que fomentan el bienestar individual y colectivo.', '2': 'Analiza el incremento de su condición física, al participar en actividades recreativas, de iniciación deportiva y deporte educativo, para reflexionar acerca de su relación con el bienestar.', '3': 'Diseña, organiza y participa en actividades recreativas, de iniciación deportiva y deporte educativo, con la intención de fomentar el bienestar personal y social.' } },
            { c: 'Estilos de vida activos y saludables', pdas: { '1': 'Implementa acciones que le permiten mantenerse físicamente activo en diferentes momentos del día, para favorecer la práctica de estilos de vida saludables.', '2': 'Reflexiona acerca de los factores que afectan la práctica sistemática de actividad física, para proponer acciones que contribuyan a modificarlos o eliminarlos.', '3': 'Diseña alternativas que fomenten la práctica de estilos de vida activos y saludables, a partir del análisis de comportamientos que ponen en riesgo la salud, para hacer frente a problemas asociados con el sedentarismo.' } },
            { c: 'Pensamiento lúdico, estratégico y creativo', pdas: { '1': 'Toma decisiones individuales y colectivas en situaciones de juego (defensivas u ofensivas), con el propósito de valorar su efectividad.', '2': 'Valora las estrategias de juego que utiliza ante distintas condiciones que se presentan, para reestructurarlas e incrementar su efectividad.', '3': 'Emplea el pensamiento estratégico para favorecer la colaboración y creatividad en la resolución de situaciones individuales y colectivas.' } },
            { c: 'Interacción motriz', pdas: { '1': 'Pone a prueba la interacción motriz en situaciones de juego, iniciación deportiva y deporte educativo, con el fin de alcanzar metas comunes y obtener satisfacción al colaborar con las demás personas.', '2': 'Toma decisiones a favor de la participación colectiva en situaciones de iniciación deportiva y deporte educativo, para promover ambientes de aprendizaje y actitudes asertivas.', '3': 'Promueve relaciones asertivas con las demás personas en situaciones de juego, iniciación deportiva y deporte educativo, para fortalecer su autoestima y fomentar el juego limpio y la confrontación lúdica.' } }
          ]
        }
      }
    }
  }
};

// ── ESTADO GLOBAL PLANEACIONES ─────────────────────────────────────────────
var planNivel          = null;       // 'primaria' | 'secundaria'
var planCampoActivo    = 0;          // índice 0-3
var planGradoActivo    = '1';        // '1'..'6'
var planSeleccionados  = [];         // contenidos seleccionados
var planArchivosData   = [];         // archivos subidos
var planActualResults  = {};         // {selId: texto generado}
var planActualDone     = {};         // {selId: bool}
var planActiveMateriaTab = 0;        // tab activo en resultados
var planActualMats     = [];         // materias del resultado actual
var planActualMeta     = {};         // meta del resultado actual
var planGrupoSeleccionado = '';
var planGuardadas      = [           // planeaciones guardadas (demo)
  {id:1, titulo:'Español 2° — Recursos literarios', fecha:'Mar 2026', nivel:'secundaria', grado:'2', campos:'Lenguajes', texto:'Planeación de ejemplo guardada.'},
  {id:2, titulo:'Matemáticas 1° — Álgebra básica',  fecha:'Feb 2026', nivel:'secundaria', grado:'1', campos:'Sab. Científico', texto:'Planeación de ejemplo guardada.'}
];

const CAMPO_KEYS = ['lenguajes','cientifico','etica','humano'];
const CAMPO_ICONOS = {'Lenguajes':'📖','Saberes y Pensamiento Científico':'🔬','Ética, Naturaleza y Sociedades':'🌱','De lo Humano y lo Comunitario':'🎨'};

function planNormalizarCampoId(raw) {
  const txt = String(raw || '').toLowerCase().trim();
  if (!txt) return '';
  if (txt.includes('leng')) return 'lenguajes';
  if (txt.includes('saber') || txt.includes('cient')) return 'saberes';
  if (txt.includes('etic') || txt.includes('natur') || txt.includes('socied')) return 'etica';
  if (txt.includes('human') || txt.includes('comunit')) return 'humano';
  return txt;
}

function planNormalizarNivel(raw) {
  const txt = String(raw || '').toLowerCase().trim();
  if (txt.includes('prim')) return 'primaria';
  if (txt.includes('sec')) return 'secundaria';
  return txt || 'secundaria';
}

function planNormalizarTexto(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function planNormalizarMateriaClave(raw) {
  const txt = planNormalizarTexto(raw);
  if (!txt) return '';
  if (txt.includes('lengua materna') || txt.includes('espanol')) return 'espanol';
  if (txt.includes('ingles') || txt.includes('lengua extranjera')) return 'ingles';
  if (txt.includes('artes') || txt.includes('artistica')) return 'artes';
  if (txt.includes('matematic')) return 'matematicas';
  if (txt.includes('biolog')) return 'biologia';
  if (txt.includes('fisic')) return 'fisica';
  if (txt.includes('quimic')) return 'quimica';
  if (txt.includes('ciencias')) return 'ciencias';
  if (txt.includes('tecnolog')) return 'tecnologia';
  if (txt.includes('historia')) return 'historia';
  if (txt.includes('geografia')) return 'geografia';
  if (txt.includes('formacion civica') || txt === 'fce') return 'formacion civica y etica';
  if (txt.includes('educacion fisica')) return 'educacion fisica';
  if (txt.includes('tutoria')) return 'tutoria';
  return txt;
}

function planResolverCampoDbKey(raw) {
  const campo = planNormalizarCampoId(raw);
  if (campo === 'saberes') return 'cientifico';
  return campo;
}

function planCampoDesdeMateria(materia) {
  const mat = planNormalizarTexto(materia);
  if (!mat) return '';
  if (
    mat.includes('lengua materna')
    || mat.includes('espanol')
    || mat.includes('ingles')
    || mat.includes('lengua extranjera')
    || mat.includes('artes')
    || mat === 'lenguajes'
  ) return 'lenguajes';

  if (
    mat.includes('matematicas')
    || mat.includes('ciencias')
    || mat.includes('biologia')
    || mat.includes('fisica')
    || mat.includes('quimica')
    || mat.includes('tecnologia')
    || mat.includes('saberes y pensamiento cientifico')
  ) return 'saberes';

  if (
    mat.includes('geografia')
    || mat.includes('historia')
    || mat.includes('formacion civica')
    || mat === 'fce'
    || mat.includes('vida saludable')
    || mat.includes('etica naturaleza y sociedades')
  ) return 'etica';

  if (
    mat.includes('educacion fisica')
    || mat.includes('tutoria')
    || mat.includes('educacion socioemocional')
    || mat.includes('participacion social')
    || mat.includes('de lo humano y lo comunitario')
  ) return 'humano';

  return '';
}

function planMateriaEsCompatible(nombreMateria, materiasPermitidas) {
  if (!materiasPermitidas.length) return true;
  const base = planNormalizarTexto(nombreMateria);
  const baseKey = planNormalizarMateriaClave(nombreMateria);
  return materiasPermitidas.some(m => {
    const permitida = planNormalizarTexto(m);
    const permitidaKey = planNormalizarMateriaClave(m);
    return (permitidaKey && baseKey && permitidaKey === baseKey)
      || permitida === base
      || permitida.includes(base)
      || base.includes(permitida);
  });
}

function planDerivarCamposDesdeMaterias(materias, nivel) {
  const base = getCamposByNivel(nivel);
  const permitidos = new Set();
  (materias || []).forEach(m => {
    const campo = planNormalizarCampoId(planCampoDesdeMateria(m));
    if (campo) permitidos.add(campo);
  });
  if (permitidos.size) {
    return base.filter(c => permitidos.has(planNormalizarCampoId(c.id)));
  }
  const compatibles = base.filter(c =>
    (c.materias || []).some(m => planMateriaEsCompatible(m, materias || []))
  );
  return compatibles.length ? compatibles : base;
}

function planGradoRealGrupoSeleccionado() {
  const grupo = (window._gruposDocente || []).find(g =>
    String(g.id) === String(planGrupoSeleccionado || window._grupoActivo || '')
  );
  return String(grupo?.grado || '1').replace(/[°\s]/g, '').trim() || '1';
}

function planMateriasPermitidas() {
  const asigs = window._docenteAsignaciones || window._docenteGruposData || [];
  if (planGrupoSeleccionado) {
    const matsGrupo = asigs
      .filter(a => String(a.grupo_id) === String(planGrupoSeleccionado))
      .map(a => a.materia)
      .filter(Boolean);
    if (matsGrupo.length) return [...new Set(matsGrupo)];
  }
  const grupoActivo = (window._gruposDocente || []).find(g => String(g.id) === String(planGrupoSeleccionado || window._grupoActivo));
  if (grupoActivo?.materias?.length) {
    return [...new Set(grupoActivo.materias.filter(Boolean))];
  }
  if (window._materiasDocente?.length) return [...new Set(window._materiasDocente)];
  return [];
}

function planCamposPermitidos() {
  const asigs = window._docenteAsignaciones || window._docenteGruposData || [];
  const permitidos = new Set();
  const fuente = planGrupoSeleccionado
    ? asigs.filter(a => String(a.grupo_id) === String(planGrupoSeleccionado))
    : asigs;
  fuente.forEach(a => {
    const campo = planNormalizarCampoId(a.campo_formativo) || planCampoDesdeMateria(a.materia);
    if (campo) permitidos.add(campo);
  });
  if (!permitidos.size) {
    planMateriasPermitidas().forEach(m => {
      const campo = planCampoDesdeMateria(m);
      if (campo) permitidos.add(campo);
    });
  }
  if (!permitidos.size && Array.isArray(window._planCamposPermitidosLegacy)) {
    window._planCamposPermitidosLegacy.forEach(c => permitidos.add(c));
  }
  return permitidos;
}

function planCamposDisponibles(nivel) {
  const base = getCamposByNivel(nivel);
  const cache = window._planCamposDisponiblesCache;
  if (
    cache
    && String(cache.grupoId || '') === String(planGrupoSeleccionado || window._grupoActivo || '')
    && planNormalizarNivel(cache.nivel) === planNormalizarNivel(nivel)
    && Array.isArray(cache.campos)
  ) {
    return cache.campos;
  }
  const permitidos = planCamposPermitidos();
  if (permitidos.size) return base.filter(c => permitidos.has(c.id));

  const materias = planMateriasPermitidas();
  if (!materias.length) return base;

  const desdeMaterias = planDerivarCamposDesdeMaterias(materias, nivel);
  return desdeMaterias.length ? desdeMaterias : base;
}

function planSeleccionarGrupoDocente(grupoId, opts = {}) {
  const grupos = window._gruposDocente || [];
  const grupo = grupos.find(g => String(g.id) === String(grupoId)) || null;
  if (!grupo) return;
  planGrupoSeleccionado = grupo.id;
  window._grupoActivo = grupo.id;
  const nivel = planNormalizarNivel(grupo.nivel || window._nivelActivo || 'secundaria');
  const grado = String(grupo.grado || '1').replace(/[°\s]/g, '').trim() || '1';
  window._planCamposDisponiblesCache = null;
  if (typeof planSetNivel === 'function') planSetNivel(nivel);
  planGradoActivo = grado;
  setTimeout(() => {
    const info = planFiltrarMateriasByGrupo();
    const materiasGrupo = info?.materias?.length ? info.materias : (grupo.materias || []);
    window._planCamposDisponiblesCache = {
      grupoId: grupo.id,
      nivel,
      campos: planDerivarCamposDesdeMaterias(materiasGrupo, nivel)
    };
    const gradoEl = document.getElementById('plan-grado');
    if (gradoEl) gradoEl.value = grupo.id;
    if (typeof planRenderGruposDocenteActivos === 'function') planRenderGruposDocenteActivos();
    if (info) {
      if (typeof planMostrarBadgeMaterias === 'function') planMostrarBadgeMaterias(info);
      if (typeof planFiltrarCamposSegunMaterias === 'function') planFiltrarCamposSegunMaterias(info.materias, info.nivel, info.grado);
      if (typeof planSetNivel === 'function') planSetNivel(planNormalizarNivel(info.nivel || grupo.nivel || window._nivelActivo || 'secundaria'));
    }
    if (typeof planGradoTab === 'function') planGradoTab(info?.grado || grado);
  }, 40);
  if (!opts.silent) hubToast(`📚 Grupo seleccionado: ${grupo.nombre || `${grupo.grado}° ${grupo.seccion||''}`.trim()}`, 'ok');
}

function planPoblarSelectorGruposDocente() {
  const sel = document.getElementById('plan-grado');
  if (!sel) return;
  const grupos = (window._gruposDocente || []).filter(Boolean);
  if (!grupos.length) {
    sel.innerHTML = '<option value="">No tienes grupos asignados aún</option>';
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  sel.innerHTML = '<option value="">Selecciona un grupo asignado…</option>' + grupos.map(g => {
    const nombre = g.nombre || `${g.grado || ''}° ${g.seccion || ''}`.trim();
    const nivel = g.nivel ? ` · ${g.nivel}` : '';
    return `<option value="${g.id}">${nombre}${nivel}</option>`;
  }).join('');
  const preferido = planGrupoSeleccionado || window._grupoActivo || grupos[0]?.id || '';
  if (preferido) {
    sel.value = preferido;
    if (sel.value) planSeleccionarGrupoDocente(sel.value, { silent: true });
  }
  if (typeof planRenderGruposDocenteActivos === 'function') planRenderGruposDocenteActivos();
}

function planRenderGruposDocenteActivos() {
  const wrap = document.getElementById('plan-grupos-docente');
  if (!wrap) return;
  const grupos = (window._gruposDocente || []).filter(Boolean);
  if (!grupos.length) {
    wrap.innerHTML = '<div style="font-size:12px;color:#94a3b8;">Sin grupos asignados.</div>';
    return;
  }
  wrap.innerHTML = grupos.map(g => {
    const gid = String(g.id);
    const activo = gid === String(planGrupoSeleccionado || window._grupoActivo || '');
    const nombre = g.nombre || `${g.grado || ''}° ${g.seccion || g.grupo || ''}`.trim();
    const materias = (g.materias || []).filter(Boolean);
    return `<button onclick="planSeleccionarGrupoDocente('${gid}')"
      style="padding:8px 12px;border-radius:10px;border:1.5px solid ${activo ? '#16a34a' : '#e2e8f0'};
             background:${activo ? '#f0fdf4' : 'white'};cursor:pointer;text-align:left;font-family:'Sora',sans-serif;">
      <div style="font-size:12px;font-weight:800;color:${activo ? '#166534' : '#0f172a'};">${nombre}</div>
      <div style="font-size:10px;color:#64748b;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${materias.length ? materias.join(' · ') : 'Sin materias visibles'}
      </div>
    </button>`;
  }).join('');
}

// ── NIVEL ──────────────────────────────────────────────────────────────────
function planDetectNivel(val) {
  // Auto-detect from grado text: 1°-6° = primaria, 1°-3° with sec context
  const num = parseInt(val);
  if (!isNaN(num)) {
    if (num >= 4 || /prim/i.test(val)) planSetNivel('primaria');
    else if (/sec|secund/i.test(val)) planSetNivel('secundaria');
  }
}

function planSetNivel(nivel) {
  nivel = planNormalizarNivel(nivel);
  planNivel = nivel;
  ['pri','sec'].forEach(n => {
    const btn = document.getElementById('plan-nivel-' + n);
    if (!btn) return;
    const isSel = (n === 'pri' && nivel==='primaria') || (n === 'sec' && nivel==='secundaria');
    btn.style.borderColor = isSel ? 'var(--verde)' : 'var(--gris-20)';
    btn.style.background  = isSel ? 'var(--verde-light)' : 'var(--crema)';
    btn.style.color        = isSel ? 'var(--verde)' : '#555';
  });
  const badge = document.getElementById('plan-nivel-badge');
  if (badge) {
    badge.textContent = nivel === 'primaria' ? '🏫 Primaria' : '🎓 Secundaria';
    badge.style.background = nivel === 'primaria' ? '#dcfce7' : '#dbeafe';
    badge.style.color = nivel === 'primaria' ? '#166534' : '#1e40af';
  }
  // Refresh grado tabs: primaria has 6, secundaria has 3
  planRefreshGradoTabs();
  planRenderContenidos();

  // Update campo tabs to reflect new nivel's campos
  const camposTabs = document.getElementById('plan-campos-tabs');
  if (camposTabs) {
    const campos = planCamposDisponibles(nivel);
    if (!campos.length) {
      camposTabs.innerHTML = '<div style="padding:10px 0;color:#94a3b8;font-size:12px;">No hay campos formativos asignados para este grupo.</div>';
    } else {
    camposTabs.innerHTML = campos.map((c, i) => `
      <button onclick="planCampoTab(${i})" id="pct-${i}" 
        class="plan-campo-tab${i===0?' plan-campo-tab-active':''}"
        style="padding:10px 14px;border:none;border-bottom:2px solid ${i===0?'var(--verde)':'transparent'};
               background:${i===0?'white':'transparent'};cursor:pointer;
               font-family:'Sora',sans-serif;font-size:12px;font-weight:700;
               color:${i===0?'var(--verde)':'var(--gris-50)'};white-space:nowrap;margin-bottom:-2px;">
        ${c.emoji} ${c.nombre}
      </button>`).join('');
    }
  }

  // Update campo panels
  const camposPanels = document.getElementById('plan-campos-panels');
  if (camposPanels) {
    const campos = planCamposDisponibles(nivel);
    camposPanels.innerHTML = campos.map((c, i) => `
      <div id="pcp-${i}" style="display:${i===0?'block':'none'};">
        <div style="font-weight:700;font-size:13px;color:${c.color};margin-bottom:12px;">${c.emoji} ${c.nombre}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
          ${c.materias.map(m => `<span style="padding:3px 10px;background:${c.bg};color:${c.color};border-radius:99px;font-size:12px;font-weight:600;">${m}</span>`).join('')}
        </div>
        <div class="adm-form-group">
          <label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">
            Aprendizajes esperados — ${c.nombre}
          </label>
          <textarea id="plan-campo-${i}-aprendizajes" rows="3"
            style="width:100%;padding:9px;border:1.5px solid #e2e8f0;border-radius:9px;
                   font-family:inherit;font-size:13px;resize:vertical;outline:none;box-sizing:border-box;"
            placeholder="Describe qué aprenderán los alumnos en ${c.nombre} esta semana…"></textarea>
        </div>
        <div class="adm-form-group">
          <label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">
            Actividades y estrategias
          </label>
          <textarea id="plan-campo-${i}-actividades" rows="3"
            style="width:100%;padding:9px;border:1.5px solid #e2e8f0;border-radius:9px;
                   font-family:inherit;font-size:13px;resize:vertical;outline:none;box-sizing:border-box;"
            placeholder="¿Qué actividades realizarán? ¿Qué recursos usarán?…"></textarea>
        </div>
        <div class="adm-form-group">
          <label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">
            Evaluación formativa
          </label>
          <textarea id="plan-campo-${i}-evaluacion" rows="2"
            style="width:100%;padding:9px;border:1.5px solid #e2e8f0;border-radius:9px;
                   font-family:inherit;font-size:13px;resize:vertical;outline:none;box-sizing:border-box;"
            placeholder="¿Cómo evaluarás el logro? (rúbrica, observación, producto…)"></textarea>
        </div>
      </div>`).join('');
  }
}

function planRefreshGradoTabs() {
  const maxGrado = planNivel === 'primaria' ? 6 : 3;
  const gradoBloqueado = planGradoRealGrupoSeleccionado();
  [1,2,3,4,5,6].forEach(g => {
    const btn = document.getElementById('pgt-' + g);
    if (!btn) return;
    btn.style.display = g <= maxGrado ? '' : 'none';
    const permitido = String(g) === String(gradoBloqueado);
    btn.disabled = !permitido;
    btn.style.opacity = permitido ? '1' : '.45';
    btn.style.cursor = permitido ? 'pointer' : 'not-allowed';
  });
  // Add grados 4,5,6 buttons if not present
  const container = document.getElementById('pgt-1')?.parentElement;
  if (!container) return;
  [4,5,6].forEach(g => {
    if (!document.getElementById('pgt-' + g)) {
      const b = document.createElement('button');
      b.id = 'pgt-' + g;
      b.onclick = () => planGradoTab(String(g));
      b.className = 'plan-grado-btn';
      b.style.cssText = 'padding:5px 14px;border:1.5px solid var(--gris-20);background:var(--crema);color:#666;border-radius:20px;cursor:pointer;font-family:\'Sora\',sans-serif;font-size:12px;font-weight:500;';
      b.textContent = g + '°';
      b.style.display = planNivel === 'primaria' ? '' : 'none';
      container.insertBefore(b, document.getElementById('plan-nivel-badge'));
    } else {
      document.getElementById('pgt-' + g).style.display = planNivel === 'primaria' ? '' : 'none';
      const permitido = String(g) === String(gradoBloqueado);
      document.getElementById('pgt-' + g).disabled = !permitido;
      document.getElementById('pgt-' + g).style.opacity = permitido ? '1' : '.45';
      document.getElementById('pgt-' + g).style.cursor = permitido ? 'pointer' : 'not-allowed';
    }
  });
  if (planGradoActivo !== gradoBloqueado) {
    planGradoActivo = gradoBloqueado;
  }
  if (parseInt(planGradoActivo) > maxGrado) { planGradoActivo = '1'; }
}

// ── CAMPO TABS ─────────────────────────────────────────────────────────────
function planCampoTab(idx) {
  planCampoActivo = idx;
  const campos = planCamposDisponibles(planNivel);
  campos.forEach((k, i) => {
    const btn = document.getElementById('pct-' + i);
    if (!btn) return;
    const active = i === idx;
    btn.style.borderBottom = active ? '2px solid var(--verde)' : '2px solid transparent';
    btn.style.background   = active ? 'white' : 'transparent';
    btn.style.color        = active ? 'var(--verde)' : '#666';
    btn.style.fontWeight   = active ? '700' : '500';
  });
  planRenderContenidos();
}

// ── GRADO TABS ─────────────────────────────────────────────────────────────
function planGradoTab(grado) {
  const gradoReal = planGradoRealGrupoSeleccionado();
  if (String(grado) !== String(gradoReal)) {
    planGradoActivo = gradoReal;
    return;
  }
  planGradoActivo = grado;
  [1,2,3,4,5,6].forEach(g => {
    const btn = document.getElementById('pgt-' + g);
    if (!btn) return;
    const active = String(g) === grado;
    btn.style.borderColor = active ? 'var(--verde)' : 'var(--gris-20)';
    btn.style.background  = active ? 'var(--verde-light)' : 'var(--crema)';
    btn.style.color       = active ? 'var(--verde)' : '#666';
    btn.style.fontWeight  = active ? '700' : '500';
  });
  planRenderContenidos();
}

// ── RENDER CONTENIDOS ──────────────────────────────────────────────────────
function planRenderContenidos() {
  var lista = document.getElementById('plan-contenidos-lista');
  if (!lista) return;
  if (!planNivel) {
    lista.innerHTML = '<div style="color:#888;font-size:13px;padding:10px;">&#x1F446; Selecciona primero el nivel educativo</div>';
    return;
  }
  var camposDisponibles = planCamposDisponibles(planNivel);
  var campoSel = camposDisponibles[planCampoActivo];
  if (!campoSel && camposDisponibles.length) {
    planCampoActivo = 0;
    campoSel = camposDisponibles[0];
  }
  if (!campoSel) {
    lista.innerHTML = '<div style="color:#888;font-size:13px;padding:10px;">No hay campos formativos habilitados para este grupo.</div>';
    return;
  }
  var campoKey = planResolverCampoDbKey(campoSel.id);
  var campo = PLAN_DB[campoKey] || PLAN_DB[campoSel.id];
  if (!campo) { lista.innerHTML = ''; return; }
  var materiasPermitidas = planMateriasPermitidas();

  var allContenidos = [];
  var matEntries = Object.keys(campo.materias);
  for (var mi = 0; mi < matEntries.length; mi++) {
    var matId = matEntries[mi];
    var mat = campo.materias[matId];
    if (!planMateriaEsCompatible(mat.nombre || '', materiasPermitidas)) continue;
    var ramaNivel = planNormalizarNivel(planNivel);
    var items = (mat[ramaNivel] && mat[ramaNivel].todos) ? mat[ramaNivel].todos : [];
    for (var ci = 0; ci < items.length; ci++) {
      var item = items[ci];
      var pdaGrado = (item.pdas && item.pdas[planGradoActivo]) ? item.pdas[planGradoActivo] : '';
      var hasPDA = pdaGrado !== '' && pdaGrado !== '\u2014';
      allContenidos.push({
        campoKey: campoKey, campoNombre: campo.nombre,
        matId: matId, matNombre: mat.nombre, matEmoji: mat.emoji, matNota: mat.nota||'',
        c: item.c, pdas: item.pdas, hasPDA: hasPDA, pdaGrado: pdaGrado, idx: ci
      });
    }
  }

  if (!allContenidos.length) {
    lista.innerHTML = '<div style="color:#888;font-size:13px;padding:10px;">Sin contenidos para ' + campo.nombre + '</div>';
    var pb = document.getElementById('plan-pda-box');
    if (pb) pb.style.display = 'none';
    return;
  }

  var html = '';
  for (var i = 0; i < allContenidos.length; i++) {
    var item = allContenidos[i];
    var selId = item.campoKey + '::' + item.matId + '::' + encodeURIComponent(item.c);
    var isSel = planSeleccionados.some(function(s){ return s.selId === selId; });
    var opac = item.hasPDA ? '1' : '0.4';
    var bgCol = isSel ? '#dcfce7' : (item.hasPDA ? 'white' : '#f9f9f9');
    var borCol = isSel ? '#2db55d' : (item.hasPDA ? '#ddd' : '#eee');
    var cursor = item.hasPDA ? 'pointer' : 'default';
    var ckBg = isSel ? '#2db55d' : 'transparent';
    var ckBor = isSel ? '#2db55d' : (item.hasPDA ? '#bbb' : '#ddd');
    var ckTxt = isSel ? '&#x2713;' : '';
    var txtCol = isSel ? '#166534' : '#444';
    var matColor = isSel ? '#2db55d' : '#777';
    var notaTxt = item.matNota ? ' &middot; ' + item.matNota : '';

    var onclk = item.hasPDA ? 'planSelContenido(' + "'" + selId + "'," + i + ')' : '';
    var btnHtml = item.hasPDA
      ? '<button onclick="event.stopPropagation();planVerPDAs(\'' + selId + '\',' + i + ')" style="font-size:10px;padding:3px 8px;border:1px solid #ddd;border-radius:6px;background:white;cursor:pointer;color:#666;white-space:nowrap;flex-shrink:0;">Ver PDAs</button>'
      : '';
    var noPdaHtml = !item.hasPDA
      ? '<div style="font-size:10px;color:#bbb;margin-top:2px;">Sin PDA para ' + planGradoActivo + '\u00b0 grado</div>'
      : '';

    html += '<div onclick="' + onclk + '" id="pcont-' + i + '" style="display:flex;align-items:flex-start;gap:10px;padding:9px 13px;border:1.5px solid ' + borCol + ';border-radius:9px;cursor:' + cursor + ';background:' + bgCol + ';opacity:' + opac + ';margin-bottom:0;">';
    html += '<div style="width:18px;height:18px;border-radius:4px;border:2px solid ' + ckBor + ';background:' + ckBg + ';flex-shrink:0;margin-top:2px;display:flex;align-items:center;justify-content:center;font-size:11px;color:white;">' + ckTxt + '</div>';
    html += '<div style="flex:1;">';
    html += '<div style="font-size:11px;font-weight:700;color:' + matColor + ';margin-bottom:2px;">' + item.matEmoji + ' ' + item.matNombre + notaTxt + '</div>';
    html += '<div style="font-size:12px;color:' + txtCol + ';line-height:1.4;">' + item.c + '</div>';
    html += noPdaHtml;
    html += '</div>';
    html += btnHtml;
    html += '</div>';
  }
  lista.innerHTML = html;
  planRenderSeleccionados();
}

function planSelContenido(selId, i) {
  const [campoKey, matId, encC] = selId.split('::');
  const contenido = decodeURIComponent(encC);
  const campo = PLAN_DB[campoKey];
  const mat = campo?.materias[matId];
  const item = mat?.secundaria?.todos?.find(d => d.c === contenido);
  if (!item) return;

  const existing = planSeleccionados.findIndex(s => s.selId === selId);
  if (existing >= 0) {
    planSeleccionados.splice(existing, 1);
    document.getElementById('plan-pda-box').style.display = 'none';
  } else {
    const pdaTexto = item.pdas?.[planGradoActivo] || '';
    planSeleccionados.push({
      selId, campoKey, campoNombre: campo.nombre, matId,
      matNombre: mat.nombre, matEmoji: mat.emoji,
      contenido, grado: planGradoActivo, nivel: planNivel,
      pdaTexto,
      pdasSel: pdaTexto // texto completo de PDAs del grado seleccionado
    });
    planVerPDAs(selId, i);
  }
  planRenderContenidos();
}

function planVerPDAs(selId, i) {
  const [campoKey, matId, encC] = selId.split('::');
  const contenido = decodeURIComponent(encC);
  const campo = PLAN_DB[campoKey];
  const mat = campo?.materias[matId];
  const item = mat?.secundaria?.todos?.find(d => d.c === contenido);
  if (!item) return;

  const box = document.getElementById('plan-pda-box');
  const lista = document.getElementById('plan-pda-lista');
  const checks = document.getElementById('plan-pda-checks');
  if (!box || !lista || !checks) return;

  box.style.display = 'block';
  const pdaTexto = item.pdas?.[planGradoActivo] || 'Sin PDA para este grado.';

  lista.innerHTML = `<strong>${mat.emoji} ${mat.nombre}: ${contenido.substring(0,60)}${contenido.length>60?'…':''}</strong>`;

  // Mostrar PDAs de los 3 grados con el grado activo destacado
  checks.innerHTML = ['1','2','3'].map(g => {
    const txt = item.pdas?.[g] || '—';
    const isActive = g === planGradoActivo;
    const isEmpty = txt === '—';
    return `<div style="padding:8px 10px;border-radius:8px;border:1.5px solid ${isActive?'var(--verde)':isEmpty?'#eee':'var(--gris-20)'};background:${isActive?'var(--verde-light)':isEmpty?'#fafafa':'white'};margin-bottom:4px;">
      <div style="font-size:11px;font-weight:800;color:${isActive?'var(--verde)':'#999'};margin-bottom:4px;">${g}° GRADO ${isActive?'✅ (seleccionado)':''}</div>
      <div style="font-size:12px;line-height:1.5;color:${isEmpty?'#ccc':'#444'};">${isEmpty?'No aplica para este grado':txt}</div>
    </div>`;
  }).join('');

  box.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function planTogglePDA(encSelId, pdaIdx, checked) {
  // Legacy stub — no longer needed with new structure
}

// ── RENDER SELECCIONADOS ────────────────────────────────────────────────────
function planRenderSeleccionados() {
  var box   = document.getElementById('plan-seleccionados-box');
  var lista = document.getElementById('plan-seleccionados-lista');
  if (!box || !lista) return;
  if (!planSeleccionados.length) {
    box.style.display = 'none';
    return;
  }
  box.style.display = '';
  var html = '';
  for (var i = 0; i < planSeleccionados.length; i++) {
    var s = planSeleccionados[i];
    var campoColor = (PLAN_DB[s.campoKey] || {}).color || '#555';
    html += '<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;border:1.5px solid ' + campoColor + '33;background:' + campoColor + '11;margin:3px 3px 3px 0;">';
    html += '<span style="font-size:12px;color:' + campoColor + ';">' + s.matEmoji + ' ' + s.matNombre + ' · ' + s.grado + '°</span>';
    html += '<span style="font-size:11px;color:#555;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + s.contenido + '">' + s.contenido.substring(0, 40) + (s.contenido.length > 40 ? '…' : '') + '</span>';
    html += '<button onclick="planRemoveSeleccionado(' + i + ')" style="background:none;border:none;cursor:pointer;font-size:13px;color:#999;padding:0 2px;line-height:1;" aria-label="Cerrar">×</button>';
    html += '</div>';
  }
  lista.innerHTML = html;
}

function planRemoveSeleccionado(i) {
  planSeleccionados.splice(i, 1);
  planRenderContenidos();
  planRenderSeleccionados();
}

// ── ARCHIVOS ───────────────────────────────────────────────────────────────// ── ARCHIVOS ───────────────────────────────────────────────────────────────
function planDropFiles(e) {
  e.preventDefault();
  const dz = document.getElementById('plan-dropzone');
  if(dz){dz.style.borderColor='var(--gris-20)';dz.style.background='var(--crema)';}
  planAgregarArchivos(e.dataTransfer.files);
}
function planAgregarArchivos(files) {
  const allowed = ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','text/plain','image/jpeg','image/png','image/jpg','image/webp'];
  Array.from(files).forEach(f => {
    if (!allowed.includes(f.type) && !f.name.endsWith('.docx') && !f.name.endsWith('.txt')) return;
    if (planArchivosData.find(x=>x.name===f.name&&x.size===f.size)) return;
    const reader = new FileReader();
    reader.onload = e2 => { planArchivosData.push({name:f.name,size:f.size,type:f.type,b64:e2.target.result.split(',')[1]}); planRenderFiles(); };
    reader.readAsDataURL(f);
  });
}
function planRenderFiles() {
  const list = document.getElementById('plan-files-list'); if(!list)return;
  list.innerHTML = planArchivosData.map((f,i) => {
    const icon = f.type==='application/pdf'?'📄':f.type.startsWith('image/')?'🖼️':f.name.endsWith('.docx')?'📝':'📃';
    return `<div style="display:flex;align-items:center;gap:9px;padding:7px 11px;background:var(--verde-light);border:1px solid rgba(45,181,93,.25);border-radius:8px;">
      <span style="font-size:16px;">${icon}</span>
      <div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.name}</div><div style="font-size:10px;color:var(--gris-50);">${(f.size/1024).toFixed(0)} KB</div></div>
      <button onclick="planQuitarArchivo(${i})" style="background:var(--rojo-light);color:var(--rojo);border:none;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;" aria-label="Cerrar">✕</button>
    </div>`;
  }).join('');
}
function planQuitarArchivo(i){planArchivosData.splice(i,1);planRenderFiles();}
function planBuildFileParts(){
  return planArchivosData.map(f=>{
    if(f.type==='application/pdf')return{type:'document',source:{type:'base64',media_type:'application/pdf',data:f.b64}};
    if(f.type.startsWith('image/'))return{type:'image',source:{type:'base64',media_type:f.type==='image/jpg'?'image/jpeg':f.type,data:f.b64}};
    return null;
  }).filter(Boolean);
}

function planLeerCampoGuiado(baseId) {
  const base = (document.getElementById(baseId)?.value || '').trim();
  const extra = (document.getElementById(baseId + '-extra')?.value || '').trim();
  return [base, extra].filter(Boolean).join('. ');
}

// ── GENERAR ────────────────────────────────────────────────────────────────
async function planGenerar() {
  if (!planNivel) { hubToast('⚠️ Selecciona el nivel educativo (Primaria o Secundaria)','warn'); return; }
  const fecha = (document.getElementById('plan-fecha')?.value||'').trim();
  if (!fecha) { hubToast('⚠️ Ingresa la semana o fechas','warn'); return; }
  if (!planSeleccionados.length) { hubToast('⚠️ Selecciona al menos un contenido en los Campos Formativos','warn'); return; }

  const btn = document.getElementById('plan-btn-generar');
  btn.disabled=true; btn.textContent='⏳ Generando planeaciones…';
  const grupoSel = document.getElementById('plan-grado');
  const grupoIdSel = grupoSel?.value || planGrupoSeleccionado || window._grupoActivo || '';
  const grupoObjSel = window.SiembraPlaneaciones.getGrupoDocente(grupoIdSel, window._gruposDocente, window._grupoActivo);
  const grupoNombreSel = window.SiembraPlaneaciones.getGrupoNombre(grupoObjSel);
  if (!grupoIdSel || !grupoObjSel) {
    btn.disabled=false; btn.textContent='✨ Generador de planeaciones';
    hubToast('⚠️ Selecciona un grupo asignado antes de generar la planeación', 'warn');
    return;
  }

  planActualMeta = {
    nivel: planNivel,
    docente:(document.getElementById('plan-docente')?.value||'').trim(),
    grado:grupoNombreSel || (grupoSel?.options?.[grupoSel.selectedIndex]?.text || '').trim(),
    grupoId: grupoIdSel || '',
    grupoNombre: grupoNombreSel || '',
    fecha, sesiones:document.getElementById('plan-sesiones')?.value||'6',
    escuela:(document.getElementById('plan-escuela')?.value||'').trim(),
    contexto:planLeerCampoGuiado('plan-contexto'),
    proposito:planLeerCampoGuiado('plan-proposito'),
    producto:planLeerCampoGuiado('plan-producto'),
    recursosBase:(document.getElementById('plan-recursos-base')?.value||'').trim(),
    ajustes:planLeerCampoGuiado('plan-ajustes'),
    notasRevision:(document.getElementById('plan-notas-revision')?.value||'').trim()
  };
  planActualMats = [...planSeleccionados];
  planActualResults={}; planActualDone={}; planActiveMateriaTab=0;

  document.getElementById('plan-resultado-area').style.display='';
  planRenderResultTabs();
  planRenderActiveTab();
  document.getElementById('plan-resultado-area').scrollIntoView({behavior:'smooth',block:'start'});

  const fileParts = planBuildFileParts();
  // Throttle: máximo 3 llamadas IA simultáneas para no saturar rate limits
  const CONCURRENCIA = 3;
  const chunks = [];
  for (let i = 0; i < planActualMats.length; i += CONCURRENCIA) {
    chunks.push(planActualMats.slice(i, i + CONCURRENCIA));
  }
  for (const chunk of chunks) {
    await Promise.all(chunk.map((s, idx) => {
      const globalIdx = planActualMats.indexOf(s);
      return planStreamContenido(s, planActualMeta, fileParts, globalIdx);
    }));
  }

  btn.disabled=false; btn.textContent='✨ Generador de planeaciones';
  hubToast('✅ Planeaciones generadas correctamente','ok');
}

// ── STREAMING ──────────────────────────────────────────────────────────────
function planRenderResultTabs(){
  const tabs=document.getElementById('plan-result-tabs'); if(!tabs)return;
  tabs.innerHTML=planActualMats.map((s,i)=>{
    const isA=i===planActiveMateriaTab;
    return `<div onclick="planSwitchResultTab(${i})" id="plan-rtab-${i}" style="padding:7px 13px;border-radius:9px 9px 0 0;border:1.5px solid var(--gris-20);border-bottom:${isA?'1.5px solid #fff':'none'};background:${isA?'#fff':'var(--crema)'};cursor:pointer;font-size:12px;font-weight:${isA?700:400};color:${isA?'var(--verde)':'#555'};position:relative;z-index:${isA?2:1};margin-bottom:${isA?'-1.5px':0};white-space:nowrap;">
      ${s.matEmoji} ${s.matNombre} <span id="plan-rtab-status-${i}" style="font-size:10px;color:#bbb;">⏳</span>
    </div>`;
  }).join('');
}
function planSwitchResultTab(i){planActiveMateriaTab=i;planRenderResultTabs();planRenderActiveTab();}
function planRenderActiveTab(){
  const s=planActualMats[planActiveMateriaTab]; if(!s)return;
  const box=document.getElementById('plan-streaming-box');
  const actions=document.getElementById('plan-result-actions');
  if(box){box.innerHTML=planFmtMD(planActualResults[s.selId]||'');box.scrollTop=box.scrollHeight;}
  if(actions)actions.style.display=planActualDone[s.selId]?'flex':'none';
}

async function planStreamContenido(selItem, params, fileParts, idx) {
  const nivel = params.nivel;
  const esSecundaria = nivel === 'secundaria';
  const pdasStr = selItem.pdasSel || selItem.pdaTexto || '(PDAs del grado ${selItem.grado})';
  const hasFiles = fileParts.length > 0;

  // Evaluación diferenciada por nivel
  const evalSecundaria = `
**EVALUACIÓN FORMATIVA (Secundaria)**
- Diagnóstica: lluvia de ideas, preguntas generadoras al inicio
- Formativa: listas de cotejo, rúbricas, observación directa durante actividades
- Criterios NEM: Proceso de desarrollo del aprendizaje, trabajo colaborativo, argumentación
- Portafolio de evidencias: productos por momento didáctico
- Autoevaluación y coevaluación al final de la secuencia`;

  const evalPrimaria = `
**EVALUACIÓN FORMATIVA (Primaria)**
- Diagnóstica: exploración de saberes previos con preguntas orales o dibujos
- Formativa: observación directa, registro anecdótico, lista de cotejo
- Criterios: participación, comprensión del contenido, aplicación en contexto
- Evidencias: cuaderno de trabajo, dibujos, maquetas, reportes orales
- Evaluación procesual: considera el esfuerzo y el avance individual`;

  // ── Sistema NEM PRO v2 ────────────────────────────────────────
  const system = `Eres experto en planeación didáctica de la Nueva Escuela Mexicana (NEM 2026), Fase 6, SEP. Tu planeación debe ser PROFUNDA, PRÁCTICA y DIFERENCIADA.

PRINCIPIOS NEM que SIEMPRE incluyes:
1. ENFOQUE HUMANISTA: el alumno como ser integral (cognitivo, emocional, social)
2. APRENDIZAJE SIGNIFICATIVO: partir del contexto real del alumno y la comunidad
3. INCLUSIÓN Y DIVERSIDAD: adaptaciones para alumnos con rezago y alumnos avanzados
4. COMPONENTE SOCIOEMOCIONAL: actividades de regulación emocional, escucha activa, integración grupal
5. TRABAJO COLABORATIVO: dinámicas de equipo, roles definidos, coevaluación entre pares
6. EVALUACIÓN FORMATIVA CON RÚBRICA: criterios claros en 3 niveles (Alto/Medio/En proceso)
7. EVIDENCIAS DE APRENDIZAJE: productos concretos, no solo "observación"

${esSecundaria ? 'ESTRUCTURA: 5 Momentos NEM — 1-Saberes comunitarios, 2-Plan y acción, 3-Respuesta a la indagación, 4-Comunicación y aplicación, 5-Reflexión.' : 'ESTRUCTURA: Inicio (activación + socioemocional), Desarrollo (colaborativo y práctico), Cierre (reflexión y metacognición).'}

${hasFiles ? 'IMPORTANTE: Analiza los archivos adjuntos. Extrae temas, páginas y actividades específicas del libro para personalizar.' : ''}

Responde en español. Lenguaje claro para docentes de educación básica en México. Incluye emojis para facilitar la lectura.`;

  const textPrompt = `Genera una planeación semanal completa para ${nivel}:

MATERIA: ${selItem.matNombre}
CAMPO FORMATIVO: ${selItem.campoNombre}
GRADO: ${selItem.grado}° ${params.grado ? `(${params.grado})` : ''}
NIVEL: ${nivel.toUpperCase()}
DOCENTE: ${params.docente||'—'}
SEMANA/FECHA: ${params.fecha}
SESIONES: ${params.sesiones}
${params.escuela?`ESCUELA: ${params.escuela}`:''}
${params.contexto?`SITUACIÓN PROBLEMA / CONTEXTO: ${params.contexto}`:''}
${params.proposito?`PROPÓSITO DIDÁCTICO: ${params.proposito}`:''}
${params.producto?`PRODUCTO / EVIDENCIA ESPERADA: ${params.producto}`:''}
${params.recursosBase?`RECURSOS DISPONIBLES: ${params.recursosBase}`:''}
${params.ajustes?`AJUSTES RAZONABLES / INCLUSIÓN: ${params.ajustes}`:''}
${params.notasRevision?`NOTAS DE SEGUIMIENTO: ${params.notasRevision}`:''}

CONTENIDO SELECCIONADO: ${selItem.contenido}

PDAs A DESARROLLAR ESTA SEMANA:
${pdasStr}
${hasFiles?'\n⚠️ ANALIZA LOS ARCHIVOS ADJUNTOS y extrae temas específicos, páginas del libro y actividades para integrarlos en la planeación.':''}

Estructura de la planeación:

## 📌 ENCABEZADO
Datos completos: docente, nivel, grado/grupos, materia, campo formativo, semana, escuela, ciclo 2025-2026.

## 🎯 SITUACIÓN PROBLEMA
Pregunta detonadora contextualizada y motivadora para los alumnos.

## 📚 CONTENIDO Y PDAs
Indica el contenido y los PDAs seleccionados para esta semana.${hasFiles?'\nSi hay libro adjunto, menciona páginas y temas específicos.':''}

## 🔗 EJES ARTICULADORES
Lista los ejes articuladores que se trabajan (Pensamiento crítico, Inclusión, Interculturalidad, Vida saludable, Igualdad de género, Lectura y escritura).

## ♿ AJUSTES RAZONABLES (BAP)
Dos ajustes para alumnos con Barreras para el Aprendizaje y la Participación.

${esSecundaria ? `## 📅 SECUENCIA DIDÁCTICA — ${params.sesiones} SESIONES

Para cada sesión distribuye los 5 MOMENTOS NEM:
- **Momento 1 (Sesión 1) — Saberes de nuestra comunidad:** Activación de conocimientos previos, conexión con contexto comunitario.
- **Momento 2 (Sesión 2-3) — Plan y acción:** Indagación, experimentación o investigación.
- **Momento 3 (Sesión 3-4) — Respuesta a la indagación:** Análisis, síntesis y construcción de respuestas.
- **Momento 4 (Sesión 4-5) — Comunicación y aplicación:** Presentación de resultados y aplicación.
- **Momento 5 (Sesión ${params.sesiones}) — Reflexión:** Metacognición, evaluación y conclusiones.

Cada sesión dura exactamente 40 minutos.
Para cada sesión indica de forma visible:
- INICIO (8 min)
- DESARROLLO (24 min)
- CIERRE (8 min)
- Recursos específicos usados en la sesión (pizarrón, lápiz, videos, proyector, imágenes, recortes, copias, cuaderno, etc.).` :
`## 📅 SECUENCIA DIDÁCTICA — ${params.sesiones} SESIONES

Para cada sesión:
**SESIÓN N – Título:**
- INICIO (8 min): activación, motivación o exploración de saberes previos
- DESARROLLO (24 min): actividad principal con materiales concretos o manipulativos
- CIERRE (8 min): reflexión, conclusión o producto de la sesión
- Recursos específicos: materiales necesarios por sesión (pizarrón, lápiz, videos, proyector, imágenes, recortes, copias, etc.)

Cada sesión dura exactamente 40 minutos y esto debe verse explícitamente en la planeación.`}

## 📦 PRODUCTOS DE APRENDIZAJE
Evidencias y productos esperados por sesión/momento.

${esSecundaria ? evalSecundaria : evalPrimaria}

## 🌱 COMPONENTE SOCIOEMOCIONAL
Describe cómo se integra el bienestar emocional en las actividades:
- Momento de conexión al inicio (¿cómo se sienten hoy?)
- Actividad de trabajo colaborativo con roles definidos
- Reflexión emocional al cierre (¿qué aprendí?, ¿cómo me sentí trabajando en equipo?)
- Estrategia de inclusión: ¿cómo integrar al alumno que se resiste a participar?

## 🎯 EVALUACIÓN DIFERENCIADA CON RÚBRICA
Genera una rúbrica de 3 niveles para los productos de aprendizaje:

| Criterio | Alto (3) | Medio (2) | En proceso (1) |
|----------|----------|-----------|----------------|
| [criterio 1] | [descriptor] | [descriptor] | [descriptor] |
| [criterio 2] | [descriptor] | [descriptor] | [descriptor] |
| [criterio 3] | [descriptor] | [descriptor] | [descriptor] |

Incluye: autoevaluación del alumno (1 pregunta) y coevaluación entre pares.

## 🧩 ADAPTACIONES PARA LA DIVERSIDAD

**Alumnos con rezago o BAP:**
- Ajuste 1: [actividad simplificada, mismo objetivo]
- Ajuste 2: [apoyo visual, material concreto]

**Alumnos avanzados:**
- Reto 1: [extensión del aprendizaje]
- Reto 2: [profundización o aplicación creativa]

## 📦 MATERIALES Y RECURSOS
Lista específica de materiales por sesión. Si el docente indicó recursos disponibles, intégralos explícitamente.

## 📝 OBSERVACIONES DEL DOCENTE
Espacio para anotaciones, ajustes y seguimiento.`;

  const userContent = [...fileParts, {type:'text',text:textPrompt}];
  const key = selItem.selId;

  try {
    const resp = await callAI({ feature: 'plan_semanal', prompt: textPrompt, system, stream: true });
    if(!resp.ok){
      const e=await resp.json();
      planActualResults[key]=`❌ Error: ${e.error?.message||'Intenta de nuevo o contacta soporte'}`;
      planActualDone[key]=true; if(planActiveMateriaTab===idx)planRenderActiveTab();
      const st=document.getElementById(`plan-rtab-status-${idx}`);
      if(st){st.textContent='❌';st.style.color='var(--rojo)';}
      return;
    }
    const reader=resp.body.getReader(); const dec=new TextDecoder();
    while(true){
      const{done:sd,value}=await reader.read(); if(sd)break;
      const chunk=dec.decode(value,{stream:true});
      for(const line of chunk.split('\n')){
        if(!line.startsWith('data: '))continue;
        const data=line.slice(6).trim(); if(data==='[DONE]')continue;
        try{
          const p=JSON.parse(data);
          if(p.type==='content_block_delta'&&p.delta?.text){
            planActualResults[key]=(planActualResults[key]||'')+p.delta.text;
            if(planActiveMateriaTab===idx){
              const box=document.getElementById('plan-streaming-box');
              if(box){box.innerHTML=planFmtMD(planActualResults[key]);box.scrollTop=box.scrollHeight;}
            }
          }
        }catch{}
      }
    }
    planActualDone[key]=true; if(planActiveMateriaTab===idx)planRenderActiveTab();
    const st=document.getElementById(`plan-rtab-status-${idx}`);
    if(st){st.textContent='✓';st.style.color='var(--verde-accent)';}
  }catch(err){
    planActualResults[key]=`❌ Error: ${err.message}. Intenta de nuevo o contacta soporte.`;
    planActualDone[key]=true; if(planActiveMateriaTab===idx)planRenderActiveTab();
    const st=document.getElementById(`plan-rtab-status-${idx}`);
    if(st){st.textContent='❌';st.style.color='var(--rojo)';}
  }
}

function planFmtMD(text){
  if(!text)return'';
  return text
    .replace(/^## (.+)$/gm,'<h3 style="color:var(--verde);font-size:13px;margin:14px 0 5px;font-weight:700;border-bottom:1px solid var(--verde-light);padding-bottom:3px;">$1</h3>')
    .replace(/^### (.+)$/gm,'<h4 style="color:var(--verde-mid);font-size:12px;margin:9px 0 4px;font-weight:600;">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/^- (.+)$/gm,'<li style="margin:2px 0 2px 16px;list-style:disc;">$1</li>')
    .replace(/^\d+\. (.+)$/gm,'<li style="margin:2px 0 2px 16px;list-style:decimal;">$1</li>')
    .replace(/\n\n/g,'<br/><br/>').replace(/\n/g,'<br/>');
}

function planLeerChecklist() {
  return {
    contextualizada: !!document.getElementById('plan-check-contexto')?.checked,
    evaluacion_clara: !!document.getElementById('plan-check-evaluacion')?.checked,
    inclusion: !!document.getElementById('plan-check-inclusion')?.checked,
    evidencia: !!document.getElementById('plan-check-evidencia')?.checked,
  };
}

function planEstadoBadge(status) {
  const map = {
    borrador: { label: '📝 Borrador', bg: '#fff7ed', color: '#b45309' },
    en_revision: { label: '👀 En revisión', bg: '#eff6ff', color: '#1d4ed8' },
    observada: { label: '⚠️ Observada', bg: '#fef2f2', color: '#b91c1c' },
    aprobada: { label: '✅ Aprobada', bg: '#ecfdf5', color: '#047857' },
    lista: { label: '✅ Lista', bg: '#ecfdf5', color: '#047857' },
    pendiente: { label: '⏳ Pendiente', bg: '#fef9c3', color: '#92400e' },
  };
  return map[status] || map.lista;
}

function planConstruirPayloadActual(status) {
  const s = planActualMats[planActiveMateriaTab];
  if (!s || !planActualResults[s.selId]) return null;
  const semanaISO = (function(){
    const d = new Date(); d.setDate(d.getDate()-d.getDay()+1);
    return d.toISOString().split('T')[0];
  })();
  const checklist = planLeerChecklist();
  const params = {
    seleccion: s,
    texto: planActualResults[s.selId],
    meta: { ...planActualMeta, semana: semanaISO },
    checklist,
    status: status || 'lista',
    fechaHoy: planFechaHoy(),
  };
  const validacion = window.SiembraPlaneaciones?.validarPlaneacion
    ? window.SiembraPlaneaciones.validarPlaneacion(params)
    : { ok: true, errores: [], warnings: [] };
  if (!validacion.ok) {
    hubToast(validacion.errores[0] || 'La planeación no está lista para guardarse', 'warn');
    return null;
  }
  if (validacion.warnings?.length) {
    hubToast(validacion.warnings[0], 'warn');
  }
  return window.SiembraPlaneaciones.buildPayload(params);
}

// ── GUARDAR / EXPORTAR ─────────────────────────────────────────────────────
function planGuardarActual(){
  const planData = planConstruirPayloadActual('en_revision');
  if (!planData) return;
  planGuardarDB(planData);
}
function planGuardarBorradorActual(){
  const planData = planConstruirPayloadActual('borrador');
  if (!planData) return;
  planGuardarDB(planData);
}
function planCopiarActual(){
  const s=planActualMats[planActiveMateriaTab]; if(!s)return;
  navigator.clipboard.writeText(planActualResults[s.selId]||'').then(()=>hubToast('📋 Copiado','ok')).catch(()=>{});
}
function planExportarWordActual(){
  const s=planActualMats[planActiveMateriaTab];
  if(!s||!planActualResults[s.selId])return;
  planExportarWordContenido(`${s.matNombre}: ${s.contenido}`,planActualMeta.grado||'—',s.campoNombre,1,['Pensamiento crítico'],planActualResults[s.selId],planActualMeta.nivel);
}

// ── SUPABASE: CARGAR / GUARDAR PLANEACIONES ────────────────────────────────
async function planCargarDesdeDB() {
  const cct = _getCct();
  const docenteId = window.currentPerfil?.id;
  if (!window.sb || !cct || !docenteId) return;
  try {
    const data = await window.SiembraPlaneaciones.cargarDesdeDB({
      sb: window.sb,
      cct,
      docenteId,
      ciclo: window.CICLO_ACTIVO || '2025-2026',
    });
    window._planeaciones = data;
  } catch (error) {
    console.warn('[planCargarDesdeDB] error:', error.message);
  }
}
window.planCargarDesdeDB = planCargarDesdeDB;

async function planGuardarDB(planData) {
  const cct = _getCct();
  const docenteId = window.currentPerfil?.id;
  try {
    const data = await window.SiembraPlaneaciones.guardarDB({
      sb: window.sb,
      cct,
      docenteId,
      ciclo: window.CICLO_ACTIVO || '2025-2026',
      planData,
      updatedAt: new Date().toISOString(),
    });
    if (data && planData) planData.id = data.id;
    const status = planData?.contenido_json?.status || 'lista';
    hubToast(status === 'borrador' ? '📝 Borrador guardado' : '✅ Planeación guardada', 'ok');
    await planCargarDesdeDB();
    planRenderLista(window._planeaciones || []);
  } catch (error) {
    hubToast('Error al guardar: ' + error.message, 'error');
  }
}
window.planGuardarDB = planGuardarDB;

// ── LISTA ──────────────────────────────────────────────────────────────────
function renderPlaneaciones(){planMostrarLista();}
async function planMostrarLista(){
  document.getElementById('plan-vista-lista').style.display='';
  document.getElementById('plan-vista-form').style.display='none';
  document.getElementById('plan-vista-detalle').style.display='none';
  await planCargarDesdeDB();
  planRenderLista(window._planeaciones || []);
}
function planMostrarFormulario(){
  document.getElementById('plan-vista-lista').style.display='none';
  document.getElementById('plan-vista-form').style.display='';
  document.getElementById('plan-vista-detalle').style.display='none';
  document.getElementById('plan-resultado-area').style.display='none';
  // Auto-inicializar nivel secundaria (Fase 6) y render
  setTimeout(function(){
    if (typeof planPoblarSelectorGruposDocente === 'function') planPoblarSelectorGruposDocente();
    if (!planGrupoSeleccionado && (window._grupoActivo || window._gruposDocente?.[0]?.id)) {
      planSeleccionarGrupoDocente(window._grupoActivo || window._gruposDocente?.[0]?.id, { silent: true });
    }
    if(!planNivel) planSetNivel('secundaria');
    else planSetNivel(planNivel);
    planCampoTab(planCampoActivo);
  }, 60);
}
function planVolverLista(){planMostrarLista();}
function planFiltrar(tipo,btn){
  document.querySelectorAll('#p-planeaciones .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const all = window._planeaciones || [];
  if(tipo==='semana') planRenderLista(all.slice(0,5));
  else if(tipo==='borrador') planRenderLista(all.filter(p=>(p.contenido_json?.status||'listo')==='borrador'));
  else planRenderLista(all);
}
function planRenderLista(lista){
  const el=document.getElementById('plan-list');
  if(!el)return;
  if(!lista||!lista.length){el.innerHTML=`<div class="empty-state"><div class="es-icon">📚</div><p>No hay planeaciones aún. ¡Genera tu primera con IA!</p></div>`;return;}
  el.innerHTML=lista.map(p=>{
    const cj = p.contenido_json || {};
    const titulo = cj.titulo || p.objetivo || p.materia || '—';
    const campo = cj.campo || '';
    const nivel = cj.nivel || '';
    const grado = cj.grado || p.grupo || '—';
    const fecha = p.semana ? new Date(p.semana + 'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}) : '—';
    const status = cj.status || p.estado || 'lista';
    const statusUi = planEstadoBadge(status);
    const ejes = cj.ejes || [];
    return `
    <div class="plan-card" onclick="planVerDetalle('${p.id}')">
      <div class="plan-card-icon">${CAMPO_ICONOS[campo]||'📋'}</div>
      <div class="plan-card-info">
        <div class="plan-card-titulo">${titulo}</div>
        <div class="plan-card-meta">${nivel} · ${grado} · ${p.materia||campo} · ${fecha}</div>
        <div style="display:flex;gap:6px;margin-top:5px;flex-wrap:wrap;">${ejes.map(e=>`<span class="chip" style="background:#f0fdf4;color:#166534;border:none;font-size:10px;">${e}</span>`).join('')}</div>
      </div>
      <span class="plan-status" style="background:${statusUi.bg};color:${statusUi.color};">${statusUi.label}</span>
      <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();planExportarWordId('${p.id}')">📄 Word</button>
    </div>`;
  }).join('');
}
function planFechaHoy(){
  const d=new Date();
  return `${d.getDate()} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]} ${d.getFullYear()}`;
}
function planVerDetalle(id){
  const all = window._planeaciones || [];
  const p = all.find(x=>String(x.id)===String(id));
  if(!p)return;
  const cj = p.contenido_json || {};
  const titulo = cj.titulo || p.objetivo || p.materia || '—';
  const campo = cj.campo || '';
  const nivel = cj.nivel || '';
  const grado = cj.grado || p.grupo || '—';
  const ejes = cj.ejes || [];
  const texto = cj.texto || '';
  const status = cj.status || p.estado || 'lista';
  const statusUi = planEstadoBadge(status);
  const revision = cj.revision || {};
  document.getElementById('plan-vista-lista').style.display='none';
  document.getElementById('plan-vista-form').style.display='none';
  document.getElementById('plan-vista-detalle').style.display='';
  document.getElementById('plan-det-titulo').textContent=`${titulo} · ${grado}`;
  const el=document.getElementById('plan-det-contenido');
  el.innerHTML=texto
    ?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;"><span class="plan-chip" style="background:var(--verde);color:white;">${CAMPO_ICONOS[campo]||'📋'} ${campo}</span><span class="plan-chip" style="background:#dbeafe;color:#1e40af;">${nivel}</span><span class="plan-chip" style="background:${statusUi.bg};color:${statusUi.color};">${statusUi.label}</span>${ejes.map(e=>`<span class="plan-chip" style="background:#f0fdf4;color:#166534;">${e}</span>`).join('')}</div>
      ${(cj.proposito || cj.producto || cj.recursos_base || cj.ajustes || cj.notas_revision || revision.comentarios) ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
        ${cj.proposito ? `<div style="padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;"><div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">Propósito</div><div style="font-size:13px;color:#0f172a;margin-top:6px;">${cj.proposito}</div></div>` : ''}
        ${cj.producto ? `<div style="padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;"><div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">Producto / Evidencia</div><div style="font-size:13px;color:#0f172a;margin-top:6px;">${cj.producto}</div></div>` : ''}
        ${cj.recursos_base ? `<div style="padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;"><div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">Recursos base</div><div style="font-size:13px;color:#0f172a;margin-top:6px;">${cj.recursos_base}</div></div>` : ''}
        ${cj.ajustes ? `<div style="padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;"><div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">Ajustes razonables</div><div style="font-size:13px;color:#0f172a;margin-top:6px;">${cj.ajustes}</div></div>` : ''}
        ${(cj.notas_revision || revision.comentarios) ? `<div style="padding:12px;background:#fff7ed;border-radius:10px;border:1px solid #fed7aa;"><div style="font-size:11px;font-weight:800;color:#9a3412;text-transform:uppercase;">Seguimiento / revisión</div><div style="font-size:13px;color:#7c2d12;margin-top:6px;">${revision.comentarios || cj.notas_revision}</div></div>` : ''}
      </div>` : ''}
      <div style="font-size:13px;line-height:1.8;">${planFmtMD(texto)}</div>`
    :`<div style="text-align:center;padding:40px;"><div style="font-size:40px;margin-bottom:12px;">📋</div><div style="font-weight:700;">${titulo}</div>${p.objetivo?'<div style="margin-top:10px;font-size:13px;color:#64748b;">'+p.objetivo+'</div>':''}</div>`;
}
function planExportarWordGuardado(){hubToast('📄 Usa el botón Word en la lista','ok');}
async function planExportarWordId(id){
  const all = window._planeaciones || [];
  const p = all.find(x=>String(x.id)===String(id));
  if(!p){ hubToast('⚠️ Planeación no encontrada','warn'); return; }
  const cj = p.contenido_json || {};
  const texto = cj.texto || '';
  if(!texto){ hubToast('⚠️ Sin contenido generado','warn'); return; }
  const titulo = cj.titulo || p.objetivo || p.materia || '—';
  planExportarWordContenido(titulo, cj.grado||p.grupo||'—', cj.campo||'', 1, cj.ejes||[], texto, cj.nivel||'');
}
function planExportarWordContenido(titulo,grado,campo,semanas,ejes,texto,nivel){
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;margin:2cm;font-size:11pt;color:#111;}h1{color:#0d5c2f;font-size:16pt;border-bottom:2px solid #0d5c2f;padding-bottom:8px;}h2,h3{color:#1a7a3a;font-size:13pt;margin-top:18px;}.datos{background:#eaf6ee;padding:12px;border-radius:6px;margin-bottom:16px;}.dato-row{display:flex;gap:8px;margin-bottom:4px;font-size:10pt;}.dato-label{font-weight:bold;min-width:160px;color:#0d5c2f;}p{line-height:1.7;margin:5px 0;}.footer{margin-top:40px;border-top:1px solid #ccc;padding-top:10px;font-size:9pt;color:#888;}</style></head><body>
<h1>📋 Planeación NEM · ${nivel||''} · ${titulo}</h1>
<div class="datos"><div class="dato-row"><span class="dato-label">Nivel educativo:</span> ${e.nivel === 'primaria_y_secundaria' ? '🏫 Primaria y Secundaria' : e.nivel === 'secundaria' ? '🎓 Secundaria' : '📚 Primaria'}</div><div class="dato-row"><span class="dato-label">Grado y grupo:</span> ${grado}</div><div class="dato-row"><span class="dato-label">Campo Formativo:</span> ${campo}</div><div class="dato-row"><span class="dato-label">Ejes articuladores:</span> ${ejes.join(', ')}</div><div class="dato-row"><span class="dato-label">Ciclo escolar:</span> 2025–2026</div><div class="dato-row"><span class="dato-label">Generada con:</span> SIEMBRA IA · ${planFechaHoy()}</div></div>
${texto.replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>')}
<div class="footer">Generado por SIEMBRA · Programa Sintético Fase 6 NEM 2024 (SEP)</div></body></html>`;
  const blob=new Blob([html],{type:'application/msword'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download=`Planeacion_${titulo.substring(0,30).replace(/\s+/g,'_')}.doc`;a.click();
  URL.revokeObjectURL(url);hubToast('📄 Word exportado','ok');
}
// stubs compatibilidad
// planSwitchTab defined below
// planCargarPDF and planQuitarPDF defined below
async function planGenerarDesdePDF() {
  if (!planPDFbase64) { hubToast('⚠️ Primero carga un PDF', 'warn'); return; }
  planGenerar();
}
function planSelSemanas() {
  var inp = document.getElementById('plan-semanas');
  if (!inp) return;
  var val = parseInt(inp.value);
  if (isNaN(val) || val < 1) inp.value = 1;
  if (val > 8) inp.value = 8;
}
function planActualizarEjes() {
  // Ejes articuladores — simplemente actualiza el resumen visual si existe
  var resumen = document.getElementById('plan-ejes-resumen');
  if (!resumen) return;
  var sel = planGetEjesSeleccionados();
  resumen.textContent = sel.length ? sel.join(', ') : 'Ninguno seleccionado';
}
function planGetEjesSeleccionados() {
  var checks = document.querySelectorAll('.plan-eje-check:checked');
  var result = [];
  checks.forEach(function(c) { result.push(c.value); });
  return result;
}
function planGuardar() {
  planGuardarActual();
}
async function planRegenerarSeccion(seccion) {
  const s = planActualMats[planActiveMateriaTab];
  if (!s) { hubToast('⚠️ No hay planeación activa', 'warn'); return; }

  const textoActual = planActualResults[s.selId];
  if (!textoActual) { hubToast('⚠️ Genera la planeación primero', 'warn'); return; }

  // Map section key to heading in the markdown
  const seccionTitulos = {
    'situacion': '🎯 SITUACIÓN PROBLEMA',
    'secuencia': '📅 SECUENCIA DIDÁCTICA',
    'evaluacion': '🎯 EVALUACIÓN DIFERENCIADA CON RÚBRICA',
    'socioemocional': '🌱 COMPONENTE SOCIOEMOCIONAL',
    'adaptaciones': '🧩 ADAPTACIONES PARA LA DIVERSIDAD',
    'materiales': '📦 MATERIALES Y RECURSOS',
  };
  const titulo = seccionTitulos[seccion] || seccion;

  const box = document.getElementById('plan-streaming-box');
  if (box) {
    box.innerHTML = planFmtMD(textoActual) + `<div style="margin-top:12px;padding:10px;background:#eff6ff;border-radius:8px;color:#1d4ed8;font-size:12px;">🔄 Regenerando sección: <strong>${titulo}</strong>…</div>`;
  }

  try {
    const prompt = `Tienes esta planeación existente:

---
${textoActual.substring(0, 3000)}
---

Regenera ÚNICAMENTE la sección "${titulo}" de manera mejorada, más detallada y práctica.
Mantén el mismo contexto de materia: ${s.matNombre}, grado: ${s.grado || planActualMeta.grado}, sesiones: ${planActualMeta.sesiones || 5}.
Responde SOLO el contenido de esa sección, comenzando con el encabezado ## ${titulo}`;

    const resp = await callAI({
      feature: 'plan_semanal',
      prompt,
      system: 'Eres experto en planeación didáctica NEM 2026 México. Regenera solo la sección solicitada con mejoras prácticas y concretas. Responde en español.',
      stream: true,
    });

    if (!resp.ok) {
      const e = await resp.json();
      hubToast('❌ ' + (e.error?.message || 'Error al regenerar'), 'err');
      if (box) box.innerHTML = planFmtMD(textoActual);
      return;
    }

    // Stream the new section content
    let nuevaSeccion = '';
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = dec.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const p = JSON.parse(data);
          if (p.type === 'content_block_delta' && p.delta?.text) {
            nuevaSeccion += p.delta.text;
            if (box) {
              box.innerHTML = planFmtMD(textoActual) + '<hr style="margin:16px 0;"/>' +
                '<div style="background:#f0fdf4;border-radius:8px;padding:12px;">' +
                planFmtMD(nuevaSeccion) + '</div>';
              box.scrollTop = box.scrollHeight;
            }
          }
        } catch {}
      }
    }

    // Replace the section in the full text
    if (nuevaSeccion) {
      // Try to replace the old section with the new one
      const seccionRegex = new RegExp(`## ${titulo.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[\\s\\S]*?(?=\\n## |$)`, 'i');
      const textoNuevo = textoActual.replace(seccionRegex, nuevaSeccion.trim() + '\n\n');
      planActualResults[s.selId] = textoNuevo !== textoActual ? textoNuevo : textoActual + '\n\n---\n\n**Sección regenerada:**\n\n' + nuevaSeccion;
      planRenderActiveTab();
      hubToast('✅ Sección regenerada', 'ok');
    }
  } catch (err) {
    hubToast('❌ ' + err.message, 'err');
    if (box) box.innerHTML = planFmtMD(planActualResults[s.selId] || '');
  }
}
async function planExportarWord() {
  planExportarWordActual();
}
function planMostrarMenuRegenerarSeccion() {
  const secciones = [
    { key: 'situacion',     label: '🎯 Situación Problema' },
    { key: 'secuencia',     label: '📅 Secuencia Didáctica' },
    { key: 'evaluacion',    label: '🎯 Evaluación con Rúbrica' },
    { key: 'socioemocional',label: '🌱 Componente Socioemocional' },
    { key: 'adaptaciones',  label: '🧩 Adaptaciones para la Diversidad' },
    { key: 'materiales',    label: '📦 Materiales y Recursos' },
  ];
  const opts = secciones.map(s =>
    `<button onclick="planRegenerarSeccion('${s.key}');document.getElementById('hub-modal-overlay')?.remove();"
      style="display:block;width:100%;text-align:left;padding:10px 14px;margin-bottom:6px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;cursor:pointer;font-weight:600;color:#1e293b;">
      ${s.label}
    </button>`
  ).join('');
  hubModal('🔄 ¿Qué sección regenerar?',
    `<div style="padding:4px 0;">${opts}<p style="font-size:11px;color:#94a3b8;margin-top:8px;">La IA reescribirá solo esa sección usando el contexto de la planeación actual.</p></div>`,
    null, null
  );
}
window.planMostrarMenuRegenerarSeccion = planMostrarMenuRegenerarSeccion;

// ── PASO 1: Exportar planeación como PDF / Imprimir ──────────────────────────
function planExportarPDF() {
  const s = planActualMats[planActiveMateriaTab];
  if (!s || !planActualResults[s.selId]) { hubToast('⚠️ Sin contenido para exportar', 'warn'); return; }

  const docente  = planActualMeta.docente  || window.currentPerfil?.nombre || '';
  const grado    = s.grado || planActualMeta.grado || '';
  const escuela  = planActualMeta.escuela  || window.currentPerfil?.escuela_nombre || '';
  const fecha    = planActualMeta.fecha    || '';
  const titulo   = `Planeación: ${s.matNombre} · ${grado}° · ${fecha}`;
  const cuerpo   = planFmtMD(planActualResults[s.selId]);

  const win = window.open('', '_blank');
  if (!win) { hubToast('⚠️ Permite ventanas emergentes para exportar PDF', 'warn'); return; }
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${titulo}</title>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: letter portrait; margin: 2cm 2.5cm; }
  *  { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sora', sans-serif; font-size: 11.5px; line-height: 1.75; color: #0f172a; }
  .no-print { margin-bottom: 18px; }
  .no-print button { padding: 10px 22px; border: none; border-radius: 8px; font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; margin-right: 8px; }
  .btn-pdf  { background: #0a5c2e; color: white; }
  .btn-close{ background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0 !important; }
  .encabezado { border-bottom: 2.5px solid #0a5c2e; padding-bottom: 12px; margin-bottom: 18px; }
  .encabezado h1 { font-size: 16px; color: #0a5c2e; margin-bottom: 6px; }
  .encabezado .meta { font-size: 10.5px; color: #64748b; display: flex; gap: 20px; flex-wrap: wrap; }
  .encabezado .meta span::before { content: '•'; margin-right: 5px; color: #94a3b8; }
  .encabezado .meta span:first-child::before { display: none; }
  h3 { font-size: 12.5px; color: #0a5c2e; margin: 16px 0 5px; padding-bottom: 3px; border-bottom: 1px solid #dcfce7; }
  h4 { font-size: 11.5px; color: #16793a; margin: 10px 0 3px; }
  li { margin: 2px 0 2px 18px; }
  strong { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10.5px; page-break-inside: avoid; }
  th { background: #0a5c2e; color: white; padding: 6px 9px; text-align: left; font-weight: 700; }
  td { padding: 6px 9px; border: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .pie { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 9.5px; color: #94a3b8; text-align: center; }
  @media print { .no-print { display: none !important; } body { font-size: 11px; } }
</style>
</head>
<body>
  <div class="no-print">
    <button class="btn-pdf" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
    <button class="btn-close" onclick="window.close()">✕ Cerrar</button>
    <span style="font-size:11px;color:#64748b;margin-left:6px;">En Chrome: Guardar como PDF → destino "Guardar como PDF"</span>
  </div>
  <div class="encabezado">
    <h1>${titulo}</h1>
    <div class="meta">
      ${docente  ? `<span>Docente: ${docente}</span>` : ''}
      ${grado    ? `<span>Grado: ${grado}°</span>` : ''}
      ${escuela  ? `<span>Escuela: ${escuela}</span>` : ''}
      <span>Ciclo: ${window.CICLO_ACTIVO || '2025-2026'}</span>
      <span>Generado: ${new Date().toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' })}</span>
    </div>
  </div>
  ${cuerpo}
  <div class="pie">Generado por SIEMBRA · Sistema de Gestión Escolar · Nueva Escuela Mexicana 2026</div>
</body>
</html>`);
  win.document.close();
}
window.planExportarPDF = planExportarPDF;

// ── PASO 3: Rúbrica editable desde la planeación ─────────────────────────────
function planEditarRubrica() {
  const s = planActualMats[planActiveMateriaTab];
  if (!s || !planActualResults[s.selId]) { hubToast('⚠️ Sin planeación activa', 'warn'); return; }

  const texto = planActualResults[s.selId];
  // Extraer tabla markdown | col | col | ...
  const filas = texto.split('\n').filter(l => l.trim().startsWith('|'));
  if (filas.length < 2) { hubToast('⚠️ No se encontró rúbrica en la planeación. Genera primero o regenera la sección de evaluación.', 'warn'); return; }

  // Parsear filas (omitir separador ---)
  const parseadas = filas
    .filter(f => !/^\s*\|[\s\-|:]+\|\s*$/.test(f))
    .map(f => f.trim().replace(/^\||\|$/g,'').split('|').map(c => c.trim()));

  const encabezados = parseadas[0];
  const cuerpoFilas = parseadas.slice(1);

  // Construir tabla HTML editable
  const ths = encabezados.map(h => `<th style="background:#0a5c2e;color:white;padding:8px 10px;font-size:12px;font-weight:700;">${h}</th>`).join('');
  const trs = cuerpoFilas.map((fila, ri) =>
    `<tr>${fila.map((celda, ci) =>
      `<td contenteditable="true"
        style="padding:8px 10px;border:1px solid #e2e8f0;font-size:12px;vertical-align:top;min-width:80px;outline:none;background:${ri%2===0?'white':'#f8fafc'};"
        data-row="${ri}" data-col="${ci}">${celda}</td>`
    ).join('')}</tr>`
  ).join('');

  const tablaHtml = `
    <div style="margin-bottom:12px;font-size:12px;color:#475569;">Haz clic en cualquier celda para editar. Puedes imprimir o exportar.</div>
    <div style="overflow-x:auto;">
      <table id="rubrica-editable-table" style="width:100%;border-collapse:collapse;margin-bottom:14px;">
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button onclick="rubricaImprimirDesdeModal()" style="padding:9px 16px;background:#b91c1c;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🖨️ PDF / Imprimir</button>
      <button onclick="rubricaGuardarEnPlan()" style="padding:9px 16px;background:#0a5c2e;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">💾 Guardar cambios</button>
    </div>`;

  hubModal('📊 Rúbrica de evaluación editable', tablaHtml, null, null);
}
window.planEditarRubrica = planEditarRubrica;

function rubricaImprimirDesdeModal() {
  const tabla = document.getElementById('rubrica-editable-table');
  if (!tabla) return;
  const s = planActualMats[planActiveMateriaTab];
  const titulo = s ? `Rúbrica: ${s.matNombre} · ${s.grado || planActualMeta.grado}°` : 'Rúbrica de evaluación';
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: letter landscape; margin: 2cm; }
  body { font-family:'Sora',sans-serif; font-size:11px; color:#0f172a; }
  .no-print { margin-bottom:16px; }
  .no-print button { padding:9px 20px; border:none; border-radius:8px; font-family:inherit; font-size:12px; font-weight:700; cursor:pointer; margin-right:8px; background:#0a5c2e; color:white; }
  h2 { font-size:15px; color:#0a5c2e; margin-bottom:4px; }
  .meta { font-size:10px; color:#64748b; margin-bottom:16px; }
  table { width:100%; border-collapse:collapse; }
  th { background:#0a5c2e; color:white; padding:8px 10px; text-align:left; font-weight:700; }
  td { padding:8px 10px; border:1px solid #e2e8f0; vertical-align:top; }
  tr:nth-child(even) td { background:#f8fafc; }
  @media print { .no-print { display:none !important; } }
</style></head><body>
  <div class="no-print"><button onclick="window.print()">🖨️ Imprimir / PDF</button></div>
  <h2>${titulo}</h2>
  <div class="meta">Docente: ${planActualMeta.docente||window.currentPerfil?.nombre||'—'} · Ciclo ${window.CICLO_ACTIVO||'2025-2026'} · ${new Date().toLocaleDateString('es-MX')}</div>
  ${tabla.outerHTML}
</body></html>`);
  win.document.close();
}
window.rubricaImprimirDesdeModal = rubricaImprimirDesdeModal;

function rubricaGuardarEnPlan() {
  const tabla = document.getElementById('rubrica-editable-table');
  if (!tabla) return;
  const s = planActualMats[planActiveMateriaTab];
  if (!s) return;

  // Reconstruir markdown de la tabla
  const filas = Array.from(tabla.querySelectorAll('tr'));
  const mdFilas = filas.map((tr, i) => {
    const celdas = Array.from(tr.querySelectorAll('th, td')).map(c => c.innerText.trim());
    const fila = '| ' + celdas.join(' | ') + ' |';
    if (i === 0) return fila + '\n|' + celdas.map(() => '------').join('|') + '|';
    return fila;
  }).join('\n');

  // Reemplazar tabla en el texto de la planeación
  const texto = planActualResults[s.selId] || '';
  const tablaRegex = /(\|.+\|[\s\S]*?)(?=\n\n##|\n## |$)/;
  const textoNuevo = texto.replace(tablaRegex, mdFilas);
  planActualResults[s.selId] = textoNuevo !== texto ? textoNuevo : texto;

  hubToast('✅ Rúbrica guardada en la planeación', 'ok');
  planRenderActiveTab();
}
window.rubricaGuardarEnPlan = rubricaGuardarEnPlan;

function planMostrarResultado() {
  var area = document.getElementById('plan-resultado-area');
  if (area) area.style.display = '';
  planRenderResultTabs();
  planRenderActiveTab();
}
function planFormatearTexto(t){return`<div style="white-space:pre-line;">${t}</div>`;}

// ── TUTOR: switch entre correos e incidencias ─────────────────────────────
function tutorSwitchView(view) {
  const correos = document.getElementById('tutor-view-correos');
  const incidencias = document.getElementById('tutor-view-incidencias');
  const btnC = document.getElementById('btn-ver-correos');
  const btnI = document.getElementById('btn-ver-incidencias');
  if (!correos || !incidencias) return;
  if (view === 'correos') {
    correos.style.display = '';
    incidencias.style.display = 'none';
    if (btnC) { btnC.style.background = 'var(--verde)'; btnC.style.color = 'white'; btnC.style.borderColor = 'var(--verde)'; }
    if (btnI) { btnI.style.background = ''; btnI.style.color = ''; btnI.style.borderColor = ''; }
  } else {
    correos.style.display = 'none';
    incidencias.style.display = '';
    if (btnI) { btnI.style.background = 'var(--verde)'; btnI.style.color = 'white'; btnI.style.borderColor = 'var(--verde)'; }
    if (btnC) { btnC.style.background = ''; btnC.style.color = ''; btnC.style.borderColor = ''; }
  }
}

// tutorContactarPadre defined below (async version)

async function tutorDerivarTSCompleto(nombreAlumno, motivo) {
  if (sb && currentPerfil) {
    try {
      // Buscar alumno_id por nombre
      const alumno = (window._alumnosActivos || alumnos).find(a =>
        (a.n || a.nombre || '').toLowerCase().includes(nombreAlumno.toLowerCase())
      );
      const { error } = await sb.from('incidencias').insert({
        alumno_id:     alumno?.id || null,
        grupo_id:      window._grupoActivo || null,
        reportado_por: currentPerfil.id,
        tipo:          'otro',
        descripcion:   motivo || 'Derivado desde panel de tutoría',
        estado:        'abierta',
        derivada_ts:   true,
        created_at:    new Date().toISOString(),
      });
      if (error) throw error;
      hubToast(`📤 Caso de ${nombreAlumno} enviado a Trabajo Social`, 'ok');
    } catch(e) {
      hubToast('❌ Error al derivar: ' + e.message, 'err');
    }
  } else {
    hubToast(`📤 Caso de ${nombreAlumno} derivado a Trabajo Social · Motivo: ${motivo}`, 'ok');
  }
}

function tutorMarcarResuelta(btn) {
  const card = btn.closest('[style*="border-radius:14px"]');
  if (card) {
    const stripe = card.querySelector('[style*="height:4px"]');
    if (stripe) stripe.style.background = 'linear-gradient(90deg,#22c55e,#4ade80)';
    card.style.borderColor = '#bbf7d0';
  }
  btn.textContent = '✅ Resuelta';
  btn.disabled = true;
  hubToast('✅ Incidencia marcada como resuelta', 'ok');
}

function tutorRegistrarIncidencia() {
  const alumno = document.getElementById('inc-alumno')?.value;
  const tipo = document.getElementById('inc-tipo')?.value;
  const desc = document.getElementById('inc-desc')?.value.trim();
  if (!alumno || alumno === '— Seleccionar —') { hubToast('⚠️ Selecciona un alumno', 'warn'); return; }
  if (!desc) { hubToast('⚠️ Describe la incidencia', 'warn'); return; }
  hubToast(`✅ Incidencia registrada para ${alumno}`, 'ok');
  document.getElementById('inc-desc').value = '';
}

function tutorRegistrarYDerivar() {
  const alumno = document.getElementById('inc-alumno')?.value;
  const desc = document.getElementById('inc-desc')?.value.trim();
  if (!alumno || alumno === '— Seleccionar —') { hubToast('⚠️ Selecciona un alumno', 'warn'); return; }
  if (!desc) { hubToast('⚠️ Describe la incidencia', 'warn'); return; }
  hubToast(`✅ Incidencia registrada y derivada a Trabajo Social — ${alumno}`, 'ok');
  document.getElementById('inc-desc').value = '';
}

// ── TUTORÍA — inicialización desde perfil del docente ──────────────────────
// Se llama desde dInit() después de cargar el perfil del usuario.
// Si el docente tiene grupo_tutoria asignado en BD, aparece la pestaña.
// Si no tiene, la pestaña permanece oculta — nada cambia para ese docente.
async function tutoriaInit() {
  const perfil = window.currentPerfil;
  if (!perfil) return;

  // Buscar si tiene grupo de tutoría asignado
  // 1. Directo en el perfil (grupo_tutoria = nombre del grupo)
  // 2. En tutores_grupo (grupo_id = uuid del grupo)
  // 3. En docente_grupos donde materia = 'Tutoría'
  let grupoId   = null;
  let grupoNom  = perfil.grupo_tutoria || null;

  if (sb) {
    // Buscar en tutores_grupo
    try {
      const { data: tg } = await sb.from('tutores_grupo')
        .select('grupo_id, grupos(id,nombre,grado,seccion)')
        .eq('docente_id', perfil.id)
        .eq('ciclo', window.CICLO_ACTIVO || '2025-2026')
        .eq('activo', true).maybeSingle();
      if (tg?.grupos) {
        grupoId  = tg.grupo_id;
        grupoNom = tg.grupos.nombre || `${tg.grupos.grado}°${tg.grupos.seccion||'A'}`;
      }
    } catch(e) {}

    // Fallback: buscar en docente_grupos con materia Tutoría
    if (!grupoId) {
      try {
        const { data: dg } = await sb.from('docente_grupos')
          .select('grupo_id, grupos(id,nombre,grado,seccion)')
          .eq('docente_id', perfil.id).eq('activo', true)
          .ilike('materia', '%tutor%').maybeSingle();
        if (dg?.grupos) {
          grupoId  = dg.grupo_id;
          grupoNom = dg.grupos.nombre || `${dg.grupos.grado}°${dg.grupos.seccion||'A'}`;
        }
      } catch(e) {}
    }

    // Fallback: buscar grupos donde docente_guia = este docente
    if (!grupoId) {
      try {
        const { data: gg } = await sb.from('grupos')
          .select('id,nombre,grado,seccion')
          .eq('docente_guia', perfil.id)
          .eq('activo', true).maybeSingle();
        if (gg) { grupoId = gg.id; grupoNom = gg.nombre || `${gg.grado}°${gg.seccion||'A'}`; }
      } catch(e) {}
    }
  }

  window._grupoTutoria   = grupoNom;
  window._grupoTutoriaId = grupoId;

  const btn = document.getElementById('nav-btn-tutoria');
  const btnEntrevistas = document.getElementById('nav-btn-entrevistas');
  const btnMensajes    = document.getElementById('nav-btn-mensajes');
  if (!grupoNom && !grupoId) {
    if (btn) btn.style.display = 'none';
    if (btnEntrevistas) btnEntrevistas.style.display = 'none';
    if (btnMensajes)    btnMensajes.style.display    = 'none';
    return;
  }
  if (btn) btn.style.display = '';
  if (btnEntrevistas) btnEntrevistas.style.display = '';
  if (btnMensajes)    btnMensajes.style.display    = '';

  const h2 = document.getElementById('tutoria-titulo-h2');
  if (h2) h2.textContent = `🎓 Tutoría — ${grupoNom || 'Mi grupo'}`;

  const roleEl = document.querySelector('#doc-portal .user-role');
  if (roleEl) roleEl.textContent = `Docente · Tutor ${grupoNom || ''}`;

  // Cargar datos reales
  await Promise.all([
    _tutorCargarAlumnos(grupoId),
    _tutorCargarIncidencias(grupoId),
    _tutorCargarResumenAcademico(grupoId),
  ]);
}

async function _tutorCargarAlumnos(grupoId) {
  if (!grupoId || !sb) return;
  try {
    const { data } = await sb.from('alumnos_grupos')
      .select('alumno_id, usuarios!alumno_id(id,nombre,apellido_p,apellido_m,curp,telefono,tutor_nombre,codigo_vinculacion)')
      .eq('grupo_id', grupoId).eq('activo', true);
    window._alumnosTutoria = (data||[]).map(r=>r.usuarios).filter(Boolean);

    // Actualizar stat
    const statEl = document.getElementById('tutor-total-alumnos');
    if (statEl) statEl.textContent = window._alumnosTutoria.length;

    // Actualizar select en modal de incidencia
    const sel = document.getElementById('ti-alumno');
    if (sel) {
      sel.innerHTML = '<option value="">Seleccionar alumno…</option>' +
        window._alumnosTutoria.map(a => {
          const nom = `${a.nombre||''} ${a.apellido_p||''} ${a.apellido_m||''}`.trim();
          return `<option value="${a.id}">${nom}</option>`;
        }).join('');
    }
    console.log('[Tutoría] Alumnos cargados:', window._alumnosTutoria.length);
  } catch(e) { console.warn('[Tutoría] cargarAlumnos:', e.message); }
}

async function _tutorCargarIncidencias(grupoId) {
  if (!sb || !window.currentPerfil) return;
  try {
    const cct = window.currentPerfil.escuela_cct;
    let q = sb.from('incidencias')
      .select('*, usuarios!alumno_id(nombre,apellido_p), reportado:usuarios!reportado_por(nombre,rol)')
      .eq('estado', 'abierta')
      .order('created_at', { ascending: false })
      .limit(20);
    if (grupoId) q = q.eq('grupo_id', grupoId);
    else if (cct) q = q.eq('escuela_cct', cct);

    const { data: incidencias } = await q;
    window._tutorIncidencias = incidencias || [];

    // Stats
    const openEl = document.getElementById('tutor-incidencias-abiertas');
    const tsEl   = document.getElementById('tutor-derivadas-ts');
    if (openEl) openEl.textContent = window._tutorIncidencias.length;
    if (tsEl)   tsEl.textContent   = window._tutorIncidencias.filter(i=>i.derivada_ts).length;

    // Render lista
    _tutorRenderIncidencias();
  } catch(e) { console.warn('[Tutoría] cargarIncidencias:', e.message); }
}

function _tutorRenderIncidencias() {
  const lista = document.getElementById('tutor-incidencias-lista');
  if (!lista) return;
  const items = window._tutorIncidencias || [];
  if (!items.length) {
    lista.innerHTML = `<div style="text-align:center;padding:32px;color:#94a3b8;">
      <div style="font-size:36px;margin-bottom:10px;">✅</div>
      <div style="font-weight:700;">Sin incidencias abiertas</div>
      <div style="font-size:12px;margin-top:4px;">El grupo está al día</div>
    </div>`;
    return;
  }
  const tipoBg = { academica:'#fef9c3', conducta:'#fee2e2', asistencia:'#fff7ed', salud:'#f0fdf4', otro:'#f1f5f9' };
  const tipoCol= { academica:'#a16207', conducta:'#b91c1c', asistencia:'#c2410c', salud:'#15803d', otro:'#475569' };
  const tipoIco= { academica:'📚', conducta:'⚠️', asistencia:'📅', salud:'🏥', otro:'📋' };
  lista.innerHTML = items.map(inc => {
    const alumNom = inc.usuarios ? `${inc.usuarios.nombre||''} ${inc.usuarios.apellido_p||''}`.trim() : '—';
    const repNom  = inc.reportado ? `${inc.reportado.nombre||''} (${inc.reportado.rol||''})` : '—';
    const fecha   = inc.created_at ? new Date(inc.created_at).toLocaleDateString('es-MX',{day:'2-digit',month:'short'}) : '';
    const bg      = tipoBg[inc.tipo] || '#f1f5f9';
    const col     = tipoCol[inc.tipo] || '#475569';
    const ico     = tipoIco[inc.tipo] || '📋';
    return `<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--gris-10);align-items:flex-start;">
      <div style="width:36px;height:36px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;">${ico}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${alumNom}</div>
        <div style="font-size:11px;color:var(--gris-50);">Reportado por: ${repNom} · ${fecha}</div>
        <div style="font-size:12px;color:var(--gris-80);margin-top:4px;padding:8px;background:var(--crema);border-radius:6px;">${inc.descripcion||'—'}</div>
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="_tutorVerAlumno('${inc.alumno_id}')">👤 Ver alumno</button>
          ${!inc.derivada_ts ? `<button class="btn btn-sm" style="background:#fff7ed;color:#c2410c;border:1.5px solid #fed7aa;" onclick="tutorDerivarTS('${inc.id}')">📤 Derivar a TS</button>` : '<span style="font-size:11px;color:#15803d;font-weight:700;">✅ Derivado a TS</span>'}
        </div>
      </div>
      <span style="font-size:10px;background:${bg};color:${col};padding:2px 8px;border-radius:99px;font-weight:700;white-space:nowrap;">${inc.tipo||'otro'}</span>
    </div>`;
  }).join('');
}

async function _tutorCargarResumenAcademico(grupoId) {
  if (!grupoId || !sb) return;
  try {
    // Obtener promedios por materia del grupo
    const { data: cals } = await sb.from('calificaciones')
      .select('materia, calificacion, alumno_id')
      .eq('grupo_id', grupoId)
      .eq('ciclo', window.CICLO_ACTIVO || '2025-2026');

    if (!cals?.length) return;

    // Agrupar por materia
    const porMateria = {};
    cals.forEach(c => {
      if (!porMateria[c.materia]) porMateria[c.materia] = [];
      porMateria[c.materia].push(parseFloat(c.calificacion)||0);
    });

    const resumenEl = document.getElementById('tutor-resumen-grupo');
    if (!resumenEl) return;

    const materias = Object.entries(porMateria).map(([mat, vals]) => ({
      materia: mat,
      promedio: (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1),
    })).sort((a,b) => parseFloat(a.promedio) - parseFloat(b.promedio));

    resumenEl.innerHTML = materias.map(m => {
      const pct = Math.min(100, (parseFloat(m.promedio)/10)*100);
      const col = parseFloat(m.promedio)>=8 ? '#22c55e' : parseFloat(m.promedio)>=6 ? '#3b82f6' : '#ef4444';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gris-10);">
        <div style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.materia}</div>
        <div class="progress-bar" style="width:80px;"><div class="progress-fill" style="width:${pct}%;background:${col};"></div></div>
        <div style="font-size:13px;font-weight:700;min-width:28px;text-align:right;color:${col};">${m.promedio}</div>
      </div>`;
    }).join('') || '<div style="color:#94a3b8;font-size:13px;text-align:center;padding:20px;">Sin calificaciones registradas</div>';

  } catch(e) { console.warn('[Tutoría] resumenAcademico:', e.message); }
}

async function _tutorVerAlumno(alumnoId) {
  if (!alumnoId || !sb) return;
  try {
    const [{ data: alumno }, { data: cals }, { data: asist }, { data: incids }] = await Promise.all([
      sb.from('usuarios').select('*').eq('id', alumnoId).maybeSingle(),
      sb.from('calificaciones').select('materia,trimestre,calificacion,observacion')
        .eq('alumno_id', alumnoId).eq('ciclo', window.CICLO_ACTIVO||'2025-2026').order('materia'),
      sb.from('asistencia').select('fecha,estado')
        .eq('alumno_id', alumnoId)
        .gte('fecha', new Date(Date.now()-30*24*60*60*1000).toISOString().split('T')[0])
        .order('fecha', {ascending:false}),
      sb.from('incidencias').select('tipo,descripcion,estado,created_at,reportado:usuarios!reportado_por(nombre)')
        .eq('alumno_id', alumnoId).order('created_at',{ascending:false}).limit(5),
    ]);

    const nom    = alumno ? `${alumno.nombre||''} ${alumno.apellido_p||''} ${alumno.apellido_m||''}`.trim() : 'Alumno';
    const prom   = cals?.length ? (cals.reduce((s,c)=>s+parseFloat(c.calificacion||0),0)/cals.length).toFixed(1) : '—';
    const presentes = (asist||[]).filter(a=>a.estado==='presente').length;
    const pctAsist  = asist?.length ? Math.round((presentes/asist.length)*100) : null;
    const colProm   = parseFloat(prom)>=8?'#15803d':parseFloat(prom)>=6?'#1e40af':'#dc2626';

    hubModal(`👤 ${nom}`, `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
        <div style="background:#f0fdf4;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:${colProm};">${prom}</div>
          <div style="font-size:11px;color:#64748b;">Promedio general</div>
        </div>
        <div style="background:#eff6ff;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#1d4ed8;">${pctAsist !== null ? pctAsist+'%' : '—'}</div>
          <div style="font-size:11px;color:#64748b;">Asistencia (30d)</div>
        </div>
        <div style="background:#fff7ed;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#c2410c;">${(incids||[]).filter(i=>i.estado==='abierta').length}</div>
          <div style="font-size:11px;color:#64748b;">Incidencias abiertas</div>
        </div>
      </div>
      ${cals?.length ? `
        <div style="font-weight:700;font-size:13px;margin-bottom:8px;">Calificaciones por materia</div>
        <div style="max-height:180px;overflow-y:auto;background:#f8fafc;border-radius:8px;padding:8px;">
          ${cals.map(c=>`<div style="display:flex;justify-content:space-between;padding:5px 8px;font-size:12px;border-bottom:1px solid #f1f5f9;">
            <span>${c.materia}</span>
            <span style="font-weight:700;color:${parseFloat(c.calificacion)>=6?'#15803d':'#dc2626'};">T${c.trimestre}: ${c.calificacion}</span>
          </div>`).join('')}
        </div>` : '<div style="color:#94a3b8;font-size:13px;">Sin calificaciones registradas.</div>'}
      ${incids?.length ? `
        <div style="font-weight:700;font-size:13px;margin-top:14px;margin-bottom:8px;">Incidencias recientes</div>
        ${incids.map(i=>`<div style="background:#fef2f2;border-radius:8px;padding:8px 10px;margin-bottom:6px;font-size:12px;">
          <span style="font-weight:700;">${i.tipo}</span> — ${i.descripcion?.slice(0,80)}...
          <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${i.reportado?.nombre||'—'} · ${new Date(i.created_at).toLocaleDateString('es-MX')}</div>
        </div>`).join('')}` : ''}
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">
        <button onclick="tutorNuevaIncidencia('${alumnoId}')" style="padding:8px 14px;background:#fff7ed;color:#c2410c;border:1.5px solid #fed7aa;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">+ Nueva incidencia</button>
        <button onclick="tutorContactarPadre('${alumnoId}','${nom}')" style="padding:8px 14px;background:#eff6ff;color:#1e40af;border:1.5px solid #bfdbfe;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">💬 Contactar padre</button>
      </div>
    `, () => {}, 'Cerrar');
  } catch(e) { hubToast('❌ '+e.message,'err'); }
}
window._tutorVerAlumno = _tutorVerAlumno;

async function tutorContactarPadre(alumnoId, alumnoNom) {
  if (!alumnoId || !sb) { hubToast('Sin conexión','err'); return; }
  const doc = window.currentPerfil;

  // Buscar padre vinculado al alumno
  let padreId = null, padreNom = '';
  const { data: vinc } = await sb.from('padres_alumnos')
    .select('padre_id, usuarios!padre_id(id,nombre,apellido_p,email,telefono)')
    .eq('alumno_id', alumnoId).eq('activo', true).maybeSingle();
  if (vinc?.usuarios) { padreId = vinc.usuarios.id; padreNom = `${vinc.usuarios.nombre||''} ${vinc.usuarios.apellido_p||''}`.trim(); }

  // Fallback: vinculos_padre
  if (!padreId) {
    const { data: vp } = await sb.from('vinculos_padre')
      .select('padre_id, usuarios!padre_id(id,nombre,apellido_p)')
      .eq('alumno_id', alumnoId).eq('usado', true).maybeSingle();
    if (vp?.usuarios) { padreId = vp.usuarios.id; padreNom = `${vp.usuarios.nombre||''} ${vp.usuarios.apellido_p||''}`.trim(); }
  }

  if (!padreId) { hubToast('⚠️ Este alumno no tiene padre/tutor vinculado aún','warn'); return; }

  // Crear o encontrar conversación
  let convId = null;
  const { data: convExist } = await sb.from('chat_conversaciones')
    .select('id').eq('tutor_id', doc.id).eq('padre_id', padreId).eq('alumno_id', alumnoId).maybeSingle();
  if (convExist) {
    convId = convExist.id;
  } else {
    const { data: newConv, error: convErr } = await sb.from('chat_conversaciones').insert({
      escuela_cct: doc.escuela_cct, tutor_id: doc.id, padre_id: padreId, alumno_id: alumnoId
    }).select('id').maybeSingle();
    if (convErr) { hubToast('Error al iniciar chat: ' + convErr.message,'err'); return; }
    convId = newConv?.id;
  }

  window._chatConvActiva = { id: convId, padreNom, alumnoNom };
  _tutorAbrirChatModal(convId, padreNom, alumnoNom);
}
window.tutorContactarPadre = tutorContactarPadre;

async function _tutorAbrirChatModal(convId, padreNom, alumnoNom) {
  hubModal(`<div style="display:flex;flex-direction:column;height:460px;max-width:480px;width:100%">
    <div style="padding:14px 18px;background:linear-gradient(135deg,#064e2f,#15803d);color:white;border-radius:12px 12px 0 0;flex-shrink:0;">
      <div style="font-weight:800;font-size:15px;">💬 ${padreNom || 'Padre/Tutor'}</div>
      <div style="font-size:11px;opacity:.75;">Sobre: ${alumnoNom}</div>
    </div>
    <div id="tchat-mensajes" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f8fafc;">
      <div style="text-align:center;font-size:12px;color:#94a3b8;padding:20px;">Cargando mensajes...</div>
    </div>
    <div style="padding:10px 14px;background:white;border-top:1px solid #e2e8f0;display:flex;gap:8px;border-radius:0 0 12px 12px;flex-shrink:0;">
      <input id="tchat-input" type="text" placeholder="Escribe un mensaje…"
        style="flex:1;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:20px;font-size:14px;outline:none;font-family:inherit;"
        onkeydown="if(event.key==='Enter')_tutorEnviarMsg('${convId}')">
      <button onclick="_tutorEnviarMsg('${convId}')"
        style="padding:10px 18px;background:linear-gradient(135deg,#15803d,#16a34a);color:white;border:none;border-radius:20px;font-weight:700;cursor:pointer;font-size:14px;">Enviar</button>
    </div>
  </div>`);
  await _tutorCargarMensajes(convId);
}

async function _tutorCargarMensajes(convId) {
  const cont = document.getElementById('tchat-mensajes');
  if (!cont || !sb) return;
  const { data: msgs } = await sb.from('chat_mensajes')
    .select('id,contenido,emisor_id,created_at')
    .eq('conversacion_id', convId)
    .order('created_at', { ascending: true })
    .limit(60);
  const yo = window.currentPerfil?.id;
  if (!msgs?.length) { cont.innerHTML = '<div style="text-align:center;font-size:12px;color:#94a3b8;padding:30px;">Inicia la conversación saludando al padre 👋</div>'; return; }
  cont.innerHTML = msgs.map(m => {
    const esMio = m.emisor_id === yo;
    const hora = new Date(m.created_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
    return `<div style="max-width:80%;align-self:${esMio?'flex-end':'flex-start'};
      background:${esMio?'linear-gradient(135deg,#15803d,#16a34a)':'white'};
      color:${esMio?'white':'#0f172a'};
      border:${esMio?'none':'1px solid #e2e8f0'};
      border-radius:${esMio?'14px 14px 3px 14px':'14px 14px 14px 3px'};
      padding:10px 13px;font-size:13px;line-height:1.5;
      box-shadow:0 1px 4px rgba(0,0,0,.06);">
      ${m.contenido}
      <div style="font-size:9px;opacity:.6;margin-top:4px;text-align:right;">${hora}</div>
    </div>`;
  }).join('');
  cont.scrollTop = cont.scrollHeight;
}

async function _tutorEnviarMsg(convId) {
  const inp = document.getElementById('tchat-input');
  const texto = inp?.value?.trim();
  if (!texto || !sb) return;
  const yo = window.currentPerfil?.id;
  inp.value = '';
  // Optimistic UI
  const cont = document.getElementById('tchat-mensajes');
  if (cont) {
    const div = document.createElement('div');
    div.style.cssText = 'max-width:80%;align-self:flex-end;background:linear-gradient(135deg,#15803d,#16a34a);color:white;border-radius:14px 14px 3px 14px;padding:10px 13px;font-size:13px;';
    div.innerHTML = texto + '<div style="font-size:9px;opacity:.6;margin-top:4px;text-align:right;">Ahora</div>';
    cont.appendChild(div);
    cont.scrollTop = cont.scrollHeight;
  }
  const { error } = await sb.from('chat_mensajes').insert({ conversacion_id: convId, emisor_id: yo, contenido: texto });
  if (!error) {
    await sb.from('chat_conversaciones').update({ ultimo_mensaje: texto, ultimo_msg_at: new Date().toISOString() }).eq('id', convId);
  } else { hubToast('Error al enviar: ' + error.message,'err'); }
}
window._tutorEnviarMsg = _tutorEnviarMsg;

function tutorNuevaIncidencia() {
  // Mostrar formulario inline si no existe
  let modal = document.getElementById('modal-tutor-incidencia');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-tutor-incidencia';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);z-index:900;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;padding:28px;width:100%;max-width:440px;box-shadow:0 20px 60px rgba(0,0,0,.2);">
        <h3 style="font-family:'Fraunces',serif;font-size:18px;margin-bottom:20px;color:#1c1c1a;">📋 Nueva incidencia</h3>
        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:11px;font-weight:700;color:#6b6b65;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Alumno</label>
          <select id="ti-alumno" style="width:100%;padding:10px 12px;border:1.5px solid #e2e0d8;border-radius:8px;font-size:14px;font-family:inherit;outline:none;background:white;">
            <option value="">Seleccionar alumno…</option>
            ${(window._alumnosActivos||alumnos).map(a=>`<option value="${a.id||a.n}">${a.n||a.nombre}</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:11px;font-weight:700;color:#6b6b65;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Tipo</label>
          <select id="ti-tipo" style="width:100%;padding:10px 12px;border:1.5px solid #e2e0d8;border-radius:8px;font-size:14px;font-family:inherit;outline:none;background:white;">
            <option value="academica">Académica</option>
            <option value="conducta">Conducta</option>
            <option value="asistencia">Asistencia</option>
            <option value="salud">Salud</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:11px;font-weight:700;color:#6b6b65;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Descripción</label>
          <textarea id="ti-desc" rows="3" placeholder="Describe la situación…" style="width:100%;padding:10px 12px;border:1.5px solid #e2e0d8;border-radius:8px;font-size:14px;font-family:inherit;outline:none;resize:vertical;"></textarea>
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;cursor:pointer;font-size:13px;color:#334155;">
          <input type="checkbox" id="ti-derivar" style="width:16px;height:16px;">
          Derivar a Trabajo Social
        </label>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button onclick="document.getElementById('modal-tutor-incidencia').style.display='none'"
            style="padding:9px 18px;border:1.5px solid #e2e0d8;border-radius:8px;background:white;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Cancelar</button>
          <button onclick="_tutorGuardarIncidencia()"
            style="padding:9px 18px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Guardar incidencia</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) modal.style.display='none'; });
  }
  // Actualizar lista de alumnos
  const sel = modal.querySelector('#ti-alumno');
  if (sel) {
    sel.innerHTML = '<option value="">Seleccionar alumno…</option>' +
      (window._alumnosActivos||alumnos).map(a=>`<option value="${a.id||a.n}">${a.n||a.nombre}</option>`).join('');
  }
  modal.querySelector('#ti-desc').value = '';
  modal.querySelector('#ti-derivar').checked = false;
  modal.style.display = 'flex';
}

async function _tutorGuardarIncidencia() {
  const alumnoVal = document.getElementById('ti-alumno')?.value;
  const tipo      = document.getElementById('ti-tipo')?.value;
  const desc      = document.getElementById('ti-desc')?.value.trim();
  const derivar   = document.getElementById('ti-derivar')?.checked;

  if (!alumnoVal) { hubToast('⚠️ Selecciona un alumno', 'warn'); return; }
  if (!desc)      { hubToast('⚠️ Escribe una descripción', 'warn'); return; }

  if (sb && currentPerfil) {
    try {
      const { error } = await sb.from('incidencias').insert({
        alumno_id:     alumnoVal,
        grupo_id:      window._grupoActivo || null,
        reportado_por: currentPerfil.id,
        tipo,
        descripcion:   desc,
        estado:        'abierta',
        derivada_ts:   derivar,
        created_at:    new Date().toISOString(),
      });
      if (error) throw error;
      hubToast(derivar ? '✅ Incidencia registrada y enviada a TS' : '✅ Incidencia registrada', 'ok');
    } catch(e) {
      hubToast('❌ Error: ' + e.message, 'err'); return;
    }
  } else {
    hubToast('✅ Incidencia registrada (demo)', 'ok');
  }
  document.getElementById('modal-tutor-incidencia').style.display = 'none';
}

function tutorVerIncidencia(id) {
  hubToast('🔍 Incidencia #' + String(id).slice(0,8) + ' — ver en sección Tutoría', 'info');
}

async function tutorDerivarTS(id) {
  if (!sb || !currentPerfil) { hubToast('📤 Incidencia derivada a TS (demo)', 'ok'); return; }
  try {
    const { error } = await sb.from('incidencias')
      .update({ derivada_ts: true, estado: 'en_seguimiento' })
      .eq('id', id);
    if (error) throw error;
    hubToast('📤 Incidencia derivada a Trabajo Social', 'ok');
  } catch(e) { hubToast('❌ Error: ' + e.message, 'err'); }
}
async function tutorEnviarMensaje() {
  const inp = document.getElementById('tutor-chat-input');
  const texto = inp?.value?.trim();
  if (!texto) return;
  // Si hay conversación activa abierta, usar esa
  const conv = window._chatConvActiva;
  if (conv?.id && sb) {
    inp.value = '';
    const yo = window.currentPerfil?.id;
    // Optimistic render en el panel principal
    const chat = document.getElementById('tutor-chat-padres');
    if (chat) {
      const div = document.createElement('div');
      div.style.cssText = 'background:var(--verde);color:white;border-radius:10px 10px 3px 10px;padding:10px 13px;max-width:85%;align-self:flex-end;font-size:13px;';
      div.innerHTML = `<div style="font-size:10px;font-weight:700;opacity:.7;margin-bottom:4px;">Tú · Ahora</div>${texto}`;
      chat.appendChild(div); chat.scrollTop = chat.scrollHeight;
    }
    const { error } = await sb.from('chat_mensajes').insert({ conversacion_id: conv.id, emisor_id: yo, contenido: texto });
    if (!error) {
      await sb.from('chat_conversaciones').update({ ultimo_mensaje: texto, ultimo_msg_at: new Date().toISOString() }).eq('id', conv.id);
      hubToast('✅ Mensaje enviado a ' + (conv.padreNom || 'padre'), 'ok');
    } else { hubToast('Error: ' + error.message,'err'); }
    return;
  }
  // Sin conversación seleccionada: indicar que deben seleccionar alumno primero
  hubToast('💬 Selecciona un alumno y usa "Contactar padre" para iniciar chat','warn');
}

// Extender dNav para soportar la página de tutoría
const _dNavOrig = typeof dNav === 'function' ? dNav : null;
function dNavExtended(page) {
  if (page === 'tutoria') {
    document.querySelectorAll('#doc-portal .page').forEach(p => p.classList.remove('active'));
    const pg = document.getElementById('p-tutoria');
    if (pg) pg.classList.add('active');
    const titleEl = document.querySelector('#doc-portal .topbar-title');
    if (titleEl) titleEl.textContent = `Tutoría — ${window._grupoTutoria || 'Mi grupo'}`;
    document.querySelectorAll('#doc-portal .nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-btn-tutoria')?.classList.add('active');
    return;
  }
  if (_dNavOrig) _dNavOrig(page);
}
// Override dNav after page load
document.addEventListener('DOMContentLoaded', () => {
  if (typeof dNav !== 'undefined') window.dNav = dNavExtended;
  // tutoriaInit() se llama desde dInit() al cargar el perfil del docente
});

// ══════════════════════════════════════════════════════════
//  BOLETA NEM 2026 — Generador completo con export PDF
// ══════════════════════════════════════════════════════════

// Campos formativos NEM para cada materia
const BLT_CAMPOS = {
  // ── Lenguajes ────────────────────────────────────────────────────────
  'Español':                        { campo:'Lenguajes', color:'#7c3aed', colorL:'#f5f3ff' },
  'Lengua Materna':                 { campo:'Lenguajes', color:'#7c3aed', colorL:'#f5f3ff' },
  'Lengua Materna (Español)':       { campo:'Lenguajes', color:'#7c3aed', colorL:'#f5f3ff' },
  'Segunda Lengua (Inglés)':        { campo:'Lenguajes', color:'#7c3aed', colorL:'#f5f3ff' },
  'Inglés':                         { campo:'Lenguajes', color:'#7c3aed', colorL:'#f5f3ff' },
  'Artes':                          { campo:'Lenguajes', color:'#7c3aed', colorL:'#f5f3ff' },
  'Educación Artística':            { campo:'Lenguajes', color:'#7c3aed', colorL:'#f5f3ff' },
  // ── Saberes y Pensamiento Científico ─────────────────────────────────
  'Matemáticas':                    { campo:'Saberes y Pensamiento Científico', color:'#0369a1', colorL:'#e0f2fe' },
  'Ciencias Naturales':             { campo:'Saberes y Pensamiento Científico', color:'#0369a1', colorL:'#e0f2fe' },
  'Ciencias Naturales y Tecnología':{ campo:'Saberes y Pensamiento Científico', color:'#0369a1', colorL:'#e0f2fe' },
  'Conocimiento del Medio':         { campo:'Saberes y Pensamiento Científico', color:'#0369a1', colorL:'#e0f2fe' },
  'Biología':                       { campo:'Saberes y Pensamiento Científico', color:'#0369a1', colorL:'#e0f2fe' },
  'Física':                         { campo:'Saberes y Pensamiento Científico', color:'#0369a1', colorL:'#e0f2fe' },
  'Química':                        { campo:'Saberes y Pensamiento Científico', color:'#0369a1', colorL:'#e0f2fe' },
  'Tecnología':                     { campo:'Saberes y Pensamiento Científico', color:'#0369a1', colorL:'#e0f2fe' },
  // ── Ética, Naturaleza y Sociedades ───────────────────────────────────
  'Historia':                       { campo:'Ética, Naturaleza y Sociedades', color:'#059669', colorL:'#d1fae5' },
  'Geografía':                      { campo:'Ética, Naturaleza y Sociedades', color:'#059669', colorL:'#d1fae5' },
  'Formación Cívica y Ética':       { campo:'Ética, Naturaleza y Sociedades', color:'#059669', colorL:'#d1fae5' },
  'Formación Cívica':               { campo:'Ética, Naturaleza y Sociedades', color:'#059669', colorL:'#d1fae5' },
  'Vida Saludable':                 { campo:'Ética, Naturaleza y Sociedades', color:'#059669', colorL:'#d1fae5' },
  // ── De lo Humano y lo Comunitario ────────────────────────────────────
  'Educación Física':               { campo:'De lo Humano y lo Comunitario', color:'#d97706', colorL:'#fef3c7' },
  'Ed. Física':                     { campo:'De lo Humano y lo Comunitario', color:'#d97706', colorL:'#fef3c7' },
  'Tutoría':                        { campo:'De lo Humano y lo Comunitario', color:'#d97706', colorL:'#fef3c7' },
  'Tutoría y Participación Social': { campo:'De lo Humano y lo Comunitario', color:'#d97706', colorL:'#fef3c7' },
  'Proyecto de Aula':               { campo:'De lo Humano y lo Comunitario', color:'#d97706', colorL:'#fef3c7' },
};

const BLT_NIVEL_CFG = {
  A:{ label:'A', desc:'Sobresaliente', bg:'#dcfce7', color:'#15803d' },
  B:{ label:'B', desc:'Satisfactorio', bg:'#dbeafe', color:'#1e40af' },
  C:{ label:'C', desc:'Suficiente',    bg:'#fef9c3', color:'#a16207' },
  D:{ label:'D', desc:'Básico',        bg:'#ffedd5', color:'#9a3412' },
  E:{ label:'E', desc:'Insuficiente',  bg:'#fee2e2', color:'#b91c1c' },
};

function bltNivel(cal) {
  if (cal >= 9) return 'A';
  if (cal >= 8) return 'B';
  if (cal >= 7) return 'C';
  if (cal >= 6) return 'D';
  return 'E';
}

function bltActualizar() {
  const nombreSel = document.getElementById('blt-alumno-sel')?.value || 'Sin alumno seleccionado';
  const escuela   = document.getElementById('blt-escuela')?.value || 'Escuela no definida';
  const cct       = document.getElementById('blt-cct')?.value || '—';
  const municipio = document.getElementById('blt-municipio')?.value || 'Ubicación pendiente';
  const docente   = document.getElementById('blt-docente')?.value || 'Por definir';
  const ciclo     = document.getElementById('blt-ciclo')?.value || '2025–2026';
  const obs       = document.getElementById('blt-observacion')?.value?.trim() || '';
  const curp      = document.getElementById('blt-curp')?.value?.trim() || '';
  const grado     = document.getElementById('blt-grado')?.value?.trim() || '—';
  let   folio     = document.getElementById('blt-folio')?.value?.trim() || '';

  // Auto-generar folio si está vacío: CCT + ciclo-corto + hash-nombre
  if (!folio) {
    const cicloShort = ciclo.replace(/\D/g,'').slice(0,4);
    const hash = Array.from(nombreSel).reduce((h,c) => (h*31+c.charCodeAt(0))&0xffff, 0).toString(16).toUpperCase().padStart(4,'0');
    folio = `${cct}-${cicloShort}-${hash}`;
  }

  // Actualizar encabezado
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('blt-h-escuela', escuela);
  s('blt-h-cct', `CCT: ${cct} · ${municipio}`);
  s('blt-h-ciclo', `Ciclo escolar ${ciclo}`);
  s('blt-h-trim', 'Evaluación Trimestral');
  s('blt-d-alumno', nombreSel);
  s('blt-d-docente', docente);
  s('blt-d-grado', grado);
  s('blt-d-curp', curp || '(sin CURP)');
  s('blt-d-folio', folio);
  s('blt-firma-docente', docente);
  s('blt-pie-fecha', `Emitida el ${new Date().toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}`);

  // Nivel educativo por CCT
  const nivelMap = { E:'Preescolar', P:'Primaria', S:'Secundaria', B:'Bachillerato' };
  const nivelClave = cct.charAt(3)?.toUpperCase() || 'P';
  s('blt-d-nivel', cct && cct !== '—' ? (nivelMap[nivelClave] || 'Primaria') : '—');

  // Asistencia demo
  const aluData = (typeof alumnos !== 'undefined' && alumnos.find(a => a.n === nombreSel)) || { cals:[], as:'P' };
  const asist = aluData.as === 'P' ? '96%' : aluData.as === 'A' ? '78%' : '92%';
  s('blt-d-asistencia', asist);

  // Observación
  const obsWrap = document.getElementById('blt-obs-wrap');
  const obsTxt  = document.getElementById('blt-obs-txt');
  if (obsWrap && obsTxt) {
    obsWrap.style.display = obs ? 'block' : 'none';
    obsTxt.textContent = obs;
  }

  // Tabla de materias — 3 trimestres en columnas (formato DGAIR)
  const tbody = document.getElementById('boleta-body');
  if (!tbody) return;

  const calsDB = window._calBoleta || {};

  // Función para obtener cal de un trimestre
  const getCal = (mat, trim, idx) => {
    if (calsDB[mat] && calsDB[mat][trim] != null) return calsDB[mat][trim];
    if (aluData.cals && aluData.cals[idx] != null) return trim === 2 ? aluData.cals[idx] : null;
    return null;
  };

  // Calcular promedios por trimestre
  const promsTrim = [0,0,0];
  const cantsTrim = [0,0,0];

  const bltNivCircle = (cal) => {
    if (cal === null) return '<span style="color:#ccc;font-size:10px;">—</span>';
    const n = bltNivel(cal);
    const nc = BLT_NIVEL_CFG[n];
    return `<span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:${nc.bg};color:${nc.color};font-size:10px;font-weight:800;line-height:20px;text-align:center;">${nc.label}</span>`;
  };

  tbody.innerHTML = MATERIAS_NEM.map((mat, i) => {
    const cals = [1,2,3].map(t => getCal(mat, t, i));
    cals.forEach((c, ti) => { if (c !== null) { promsTrim[ti] += c; cantsTrim[ti]++; } });

    const campo = BLT_CAMPOS[mat] || { campo:'—', color:'#6b7280', colorL:'#f3f4f6' };
    const rowBg = i % 2 === 0 ? 'white' : '#fafaf8';

    // Promedio final de la materia
    const validos = cals.filter(c => c !== null);
    const promFinal = validos.length ? (validos.reduce((a,b)=>a+b,0)/validos.length) : null;
    const promColor = promFinal !== null && promFinal < 6 ? '#b91c1c' : '#0d5c2f';

    return `<tr style="background:${rowBg};">
      <td style="padding:6px 8px;font-weight:600;color:#1a2e1e;font-size:11px;">${mat}</td>
      <td style="padding:6px 8px;">
        <span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:99px;background:${campo.colorL};color:${campo.color};">${campo.campo}</span>
      </td>
      <td style="padding:6px;text-align:center;font-size:12px;font-weight:800;color:${cals[0]!==null&&cals[0]<6?'#b91c1c':'#0d5c2f'};border-left:1px solid #e5e7eb;">${cals[0]!==null?cals[0].toFixed(1).replace(/\.0$/,''):'—'}</td>
      <td style="padding:6px;text-align:center;">${bltNivCircle(cals[0])}</td>
      <td style="padding:6px;text-align:center;font-size:12px;font-weight:800;color:${cals[1]!==null&&cals[1]<6?'#b91c1c':'#0d5c2f'};border-left:1px solid #e5e7eb;">${cals[1]!==null?cals[1].toFixed(1).replace(/\.0$/,''):'—'}</td>
      <td style="padding:6px;text-align:center;">${bltNivCircle(cals[1])}</td>
      <td style="padding:6px;text-align:center;font-size:12px;font-weight:800;color:${cals[2]!==null&&cals[2]<6?'#b91c1c':'#0d5c2f'};border-left:1px solid #e5e7eb;">${cals[2]!==null?cals[2].toFixed(1).replace(/\.0$/,''):'—'}</td>
      <td style="padding:6px;text-align:center;">${bltNivCircle(cals[2])}</td>
      <td style="padding:6px;text-align:center;font-size:13px;font-weight:800;color:${promColor};">${promFinal!==null?promFinal.toFixed(1).replace(/\.0$/,''):'—'}</td>
    </tr>`;
  }).join('');

  // Promedios por trimestre en el footer
  const pSet = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  const pNiv = (id, val) => {
    const el=document.getElementById(id);
    if(!el||val===null) return;
    const n=bltNivel(val); const nc=BLT_NIVEL_CFG[n];
    el.innerHTML=`<span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:${nc.bg};color:${nc.color};font-size:10px;font-weight:800;line-height:20px;text-align:center;">${nc.label}</span>`;
  };

  const [p1, p2, p3] = [0,1,2].map(i => cantsTrim[i]>0 ? promsTrim[i]/cantsTrim[i] : null);
  pSet('boleta-prom-t1', p1!==null ? p1.toFixed(1) : '—'); pNiv('boleta-nivel-t1', p1);
  pSet('boleta-prom-t2', p2!==null ? p2.toFixed(1) : '—'); pNiv('boleta-nivel-t2', p2);
  pSet('boleta-prom-t3', p3!==null ? p3.toFixed(1) : '—'); pNiv('boleta-nivel-t3', p3);

  // Promedio final global
  const allVals = [p1,p2,p3].filter(v=>v!==null);
  const promFinalGlobal = allVals.length ? allVals.reduce((a,b)=>a+b,0)/allVals.length : null;
  const promEl = document.getElementById('boleta-prom');
  if(promEl) promEl.textContent = promFinalGlobal!==null ? promFinalGlobal.toFixed(1) : '—';
}

// Actualizar al cambiar de alumno (carga calificaciones + CURP de DB)
async function bltCambiarAlumno() {
  const sel    = document.getElementById('blt-alumno-sel');
  const nombre = sel?.value;
  // Obtener alumno_id del atributo data-id del option seleccionado (cargado por bltInit)
  const opt      = sel?.options[sel?.selectedIndex];
  const alumnoId = opt?.dataset?.id || window._bltAlumnosMap?.[nombre];

  window._calBoleta = {};
  if (typeof sb !== 'undefined' && sb) {
    try {
      let alumnoRec = null;
      if (alumnoId) {
        const { data } = await sb.from('usuarios')
          .select('id,curp,nombre,apellido_p,apellido_m')
          .eq('id', alumnoId)
          .maybeSingle();
        alumnoRec = data;
      } else if (nombre) {
        // Fallback: buscar por primer nombre si no hay UUID
        const { data } = await sb.from('usuarios')
          .select('id,curp,nombre,apellido_p,apellido_m')
          .eq('nombre', nombre.split(' ')[0])
          .eq('rol', 'alumno')
          .maybeSingle();
        alumnoRec = data;
      }
      if (alumnoRec) {
        const curpEl = document.getElementById('blt-curp');
        if (curpEl && alumnoRec.curp) curpEl.value = alumnoRec.curp;

        const { data: cals } = await sb.from('calificaciones')
          .select('materia,trimestre,calificacion,aspecto')
          .eq('alumno_id', alumnoRec.id)
          .eq('ciclo', window.CICLO_ACTIVO || '2025-2026');
        if (cals) {
          // Agrupar por materia+trimestre y calcular promedio ponderado de aspectos
          const grupos = {};
          cals.forEach(c => {
            const key = `${c.materia}|${c.trimestre}`;
            if (!grupos[key]) grupos[key] = { materia: c.materia, trimestre: c.trimestre, vals: {} };
            const v = parseFloat(c.calificacion);
            if (!isNaN(v)) grupos[key].vals[c.aspecto || 'General'] = v;
          });
          const mapa = {};
          Object.values(grupos).forEach(g => {
            // Intentar promedio ponderado usando CAL_ASPECTOS o ASPECTOS_DEFAULT
            const conf = (typeof CAL_ASPECTOS !== 'undefined' && CAL_ASPECTOS[g.materia]?.length)
              ? CAL_ASPECTOS[g.materia]
              : (typeof ASPECTOS_DEFAULT !== 'undefined' ? ASPECTOS_DEFAULT : []);
            let suma = 0, totalPct = 0;
            conf.forEach(asp => {
              if (g.vals[asp.nombre] !== undefined) {
                suma += g.vals[asp.nombre] * (asp.pct || 20);
                totalPct += (asp.pct || 20);
              }
            });
            if (!mapa[g.materia]) mapa[g.materia] = {};
            if (totalPct > 0) {
              mapa[g.materia][g.trimestre] = suma / totalPct;
            } else {
              // Fallback: promedio simple si los aspectos no coinciden
              const vals = Object.values(g.vals);
              mapa[g.materia][g.trimestre] = vals.length
                ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
            }
          });
          window._calBoleta = mapa;
        }
      }
    } catch(e) { console.warn('[BLT] usando demo:', e.message); }
  }
  bltActualizar();
}

function updateBoleta(v) { bltActualizar(); }
function imprimirBoleta() {
  // Construir datos desde el DOM del boleta-preview y abrir popup limpio
  const g = id => document.getElementById(id)?.value?.trim() || '';
  const s = id => document.getElementById(id)?.textContent?.trim() || '';

  // Reconstruir campos desde _calBoleta (ya tiene promedios ponderados)
  const calsDB = window._calBoleta || {};
  const trimSel = parseInt(g('blt-trimestre-sel') || '1');
  const campos = {};
  Object.entries(calsDB).forEach(([materia, trims]) => {
    const cal = trims[trimSel];
    if (cal == null) return;
    const cfg = BLT_CAMPOS[materia] || { campo: 'Otros' };
    if (!campos[cfg.campo]) campos[cfg.campo] = [];
    campos[cfg.campo].push({ materia, cal });
  });

  const datos = {
    escuela:    g('blt-escuela') || s('blt-h-escuela'),
    cct:        g('blt-cct')     || s('blt-h-cct').replace('CCT: ','').split(' ·')[0],
    municipio:  g('blt-municipio'),
    ciclo:      g('blt-ciclo')   || window.CICLO_ACTIVO || '2025-2026',
    trimestre:  trimSel,
    docente:    g('blt-docente') || s('blt-firma-docente'),
    alumno:     g('blt-alumno-sel'),
    curp:       g('blt-curp'),
    grado:      g('blt-grado')   || s('blt-d-grado'),
    folio:      g('blt-folio')   || s('blt-d-folio'),
    obsGeneral: g('blt-observacion'),
    campos,
    asistencias: null, inasistJust: null, inasistInjust: null,
  };

  if (typeof _bltAbrirVentanaImpresion === 'function' && typeof _bltGenerarHTML === 'function') {
    _bltAbrirVentanaImpresion(_bltGenerarHTML(datos), `Boleta ${datos.alumno} T${trimSel}`);
  } else {
    window.print();
  }
}

// ── EXPORT PDF con html2canvas + jsPDF ──
async function exportarBoletaPDF() {
  const btn    = document.getElementById('blt-btn-pdf');
  const status = document.getElementById('blt-pdf-status');
  const boleta = document.getElementById('boleta-preview');
  if (!boleta) { if(typeof toast==='function') toast('❌ No se encontró la boleta'); return; }

  if (btn)    { btn.disabled = true; btn.textContent = '⏳ Generando…'; }
  if (status) status.style.display = 'block';

  try {
    // Cargar librerías si no están disponibles
    await bltCargarLibrerias();

    // Capturar el div con html2canvas
    const canvas = await html2canvas(boleta, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: boleta.scrollWidth,
      height: boleta.scrollHeight,
    });

    const imgData   = canvas.toDataURL('image/jpeg', 0.92);
    const { jsPDF } = window.jspdf;
    const pdf       = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pdfW  = pdf.internal.pageSize.getWidth();
    const pdfH  = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const imgW  = pdfW - margin * 2;
    const imgH  = (canvas.height * imgW) / canvas.width;

    // Si la boleta es más alta que una página, escala para ajustar
    const finalH = imgH > pdfH - margin * 2 ? pdfH - margin * 2 : imgH;

    pdf.addImage(imgData, 'JPEG', margin, margin, imgW, finalH);

    // Nombre del archivo
    const alumno   = document.getElementById('blt-alumno-sel')?.value || 'alumno';
    const trim     = document.getElementById('blt-trimestre-sel')?.value || '2';
    const ciclo    = (document.getElementById('blt-ciclo')?.value || window.CICLO_ACTIVO).replace('–', '-');
    const filename = `Boleta_NEM_${alumno.replace(/\s+/g,'_')}_T${trim}_${ciclo}.pdf`;

    pdf.save(filename);
    if(typeof toast==='function') toast(`✅ PDF generado: ${filename}`);

  } catch(e) {
    console.error('[BLT PDF]', e);
    if(typeof toast==='function') toast('❌ Error al generar PDF. Usa Imprimir como alternativa.');
  } finally {
    if (btn)    { btn.disabled = false; btn.textContent = '⬇ Descargar PDF'; }
    if (status) status.style.display = 'none';
  }
}

function bltCargarLibrerias() {
  return new Promise((resolve, reject) => {
    const needed = [];
    if (!window.html2canvas) needed.push({ src: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', check: () => window.html2canvas });
    if (!window.jspdf) needed.push({ src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', check: () => window.jspdf });

    if (needed.length === 0) { resolve(); return; }

    let loaded = 0;
    needed.forEach(lib => {
      const s = document.createElement('script');
      s.src = lib.src;
      s.onload = () => { loaded++; if (loaded === needed.length) resolve(); };
      s.onerror = () => reject(new Error('No se pudo cargar: ' + lib.src));
      document.head.appendChild(s);
    });
  });
}

// Generar todas las boletas como PDF multi-página
async function bltGenerarTodas() {
  if(typeof toast==='function') toast('⏳ Generando boletas para todo el grupo…');
  const btn = document.getElementById('blt-btn-pdf');
  if (btn) { btn.disabled = true; }
  try {
    await bltCargarLibrerias();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const boleta = document.getElementById('boleta-preview');
    const pdfW   = pdf.internal.pageSize.getWidth();
    const pdfH   = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const alumnoSel = document.getElementById('blt-alumno-sel');
    const nombreOriginal = alumnoSel.value;

    for (let i = 0; i < alumnos.length; i++) {
      const a = alumnos[i];
      alumnoSel.value = a.n;
      bltActualizar();
      await new Promise(r => setTimeout(r, 100)); // Esperar render

      const canvas = await html2canvas(boleta, { scale: 2, useCORS: true, backgroundColor:'#ffffff', logging:false });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const imgW  = pdfW - margin * 2;
      const imgH  = (canvas.height * imgW) / canvas.width;
      const finalH = imgH > pdfH - margin * 2 ? pdfH - margin * 2 : imgH;
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, margin, imgW, finalH);
    }

    // Restaurar selección original
    alumnoSel.value = nombreOriginal;
    bltActualizar();

    const trim  = document.getElementById('blt-trimestre-sel')?.value || '2';
    const ciclo = (document.getElementById('blt-ciclo')?.value || window.CICLO_ACTIVO).replace('–','-');
    pdf.save(`Boletas_NEM_Grupo_T${trim}_${ciclo}.pdf`);
    if(typeof toast==='function') toast(`✅ PDF con ${alumnos.length} boletas generado`);
  } catch(e) {
    console.error('[BLT ALL]', e);
    if(typeof toast==='function') toast('❌ Error generando boletas. Intenta de nuevo.');
  } finally {
    if (btn) { btn.disabled = false; }
  }
}

// Init al navegar a boletas — carga alumnos reales del grupo activo del docente
async function bltInit() {
  const sel = document.getElementById('blt-alumno-sel');

  // Rellenar campos de escuela/docente desde el perfil activo
  const p = window.currentPerfil;
  if (p) {
    const escEl = document.getElementById('blt-escuela');
    const cctEl = document.getElementById('blt-cct');
    const munEl = document.getElementById('blt-municipio');
    const docEl = document.getElementById('blt-docente');
    if (escEl && p.escuela_nombre && !escEl.value.trim()) escEl.value = p.escuela_nombre;
    if (cctEl && p.escuela_cct && !cctEl.value.trim()) cctEl.value = p.escuela_cct;
    if (munEl && !munEl.value.trim()) {
      munEl.value = [p.escuela_municipio, p.escuela_estado].filter(Boolean).join(', ');
    }
    if (docEl && p.nombre && !docEl.value.trim()) {
      docEl.value = `${p.nombre} ${p.apellido_p || ''}`.trim();
    }
  }

  if (!window.sb || !sel) { bltActualizar(); return; }

  try {
    // Usar grupos ya cargados, o cargar ahora
    const grupos = window._gruposDocente?.length
      ? window._gruposDocente
      : await cargarGruposDocente();
    if (!grupos.length) { bltActualizar(); return; }

    const grupoId = window._grupoActivo || grupos[0].id;
    const alu = await calCargarAlumnosGrupo(grupoId);
    if (!alu.length) { bltActualizar(); return; }

    // Mapa nombre→id para bltCambiarAlumno cuando no hay data-id
    window._bltAlumnosMap = {};
    alu.forEach(a => { window._bltAlumnosMap[a.n] = a.id; });

    // Poblar el selector con alumnos reales
    sel.innerHTML = '<option value="">Selecciona un alumno…</option>' + alu.map(a =>
      `<option value="${a.n.replace(/"/g,'&quot;')}" data-id="${a.id}">${a.n}</option>`
    ).join('');

    // Cargar datos del primer alumno
    if (alu[0]?.n) {
      sel.value = alu[0].n;
      await bltCambiarAlumno();
    } else {
      bltActualizar();
    }
  } catch(e) {
    console.warn('[bltInit]', e.message);
    bltActualizar();
  }
}

// MENSAJES
// ══ CORREOS CON PADRES ══
let emailHilos = window.SIEMBRA_RUNTIME?.shouldAllowDemoEntry?.() ? [
  { id:1, alumnoIdx:0, nombre:'Familia demo 1', addr:'familia.demo1@gmail.com', asunto:'Seguimiento académico', leido:true, msgs:[
    { out:false, de:'Familia', t:'Nos gustaría revisar el avance académico de esta semana.', h:'Lun 3 Mar · 9:15 a.m.' },
    { out:true,  de:'Docente', t:'Claro. Les comparto un resumen y puedo agendar una reunión si lo requieren.', h:'Lun 3 Mar · 11:40 a.m.' },
  ]},
  { id:2, alumnoIdx:1, nombre:'Familia demo 2', addr:'familia.demo2@gmail.com', asunto:'Asistencia', leido:false, msgs:[
    { out:true, de:'Docente', t:'Se registró una incidencia de asistencia y conviene dar seguimiento con la familia.', h:'Mié 5 Mar · 8:00 a.m.' },
  ]},
] : [];
let emailActualId = null;
let emailFiltroTxt = '';

function renderMensajes(){
  emailRenderLista();
  if (emailHilos.length) emailSeleccionar(emailHilos[0].id);
  else {
    const empty = document.getElementById('email-empty');
    const hilo = document.getElementById('email-hilo');
    if (empty) empty.style.display = '';
    if (hilo) hilo.style.display = 'none';
  }
}

function emailRenderLista() {
  const cont = document.getElementById('email-lista');
  if (!cont) return;
  const ff = emailFiltroTxt.toLowerCase();
  const hilos = emailHilos.filter(h =>
    h.nombre.toLowerCase().includes(ff) || h.asunto.toLowerCase().includes(ff)
  );
  cont.innerHTML = hilos.map(h => {
    const ultimo = h.msgs.at(-1);
    const col = COLORES_AVATARES[h.alumnoIdx % COLORES_AVATARES.length];
    const inis = h.nombre.split(' ').slice(-2).map(p=>p[0]).join('').toUpperCase().slice(0,2);
    return `<div class="email-hilo-item ${h.id===emailActualId?'active':''} ${!h.leido?'unread':''}" onclick="emailSeleccionar(${h.id})">
      <div class="email-av" style="background:${col};">${inis}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <div class="email-asunto-preview" style="flex:1;">${h.asunto}</div>
          ${!h.leido?'<span style="width:7px;height:7px;border-radius:50%;background:var(--verde-accent);flex-shrink:0;"></span>':''}
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--gris-80);margin-bottom:2px;">${h.nombre}</div>
        <div class="email-snippet">${ultimo.t}</div>
      </div>
      <div class="email-fecha">${ultimo.h.split('·')[0].trim()}</div>
    </div>`;
  }).join('') || '<div style="padding:20px;text-align:center;font-size:13px;color:var(--gris-50);">Sin resultados</div>';
}

function emailSeleccionar(id) {
  emailActualId = id;
  const h = emailHilos.find(x=>x.id===id);
  if (!h) return;
  h.leido = true;
  emailRenderLista();

  // Cabecera
  const col = COLORES_AVATARES[h.alumnoIdx % COLORES_AVATARES.length];
  const inis = h.nombre.split(' ').slice(-2).map(p=>p[0]).join('').toUpperCase().slice(0,2);
  const av = document.getElementById('email-av-h');
  if (av) { av.textContent = inis; av.style.background = col; }
  setEl('email-asunto-h', h.asunto);
  setEl('email-nombre-h', h.nombre);
  setEl('email-addr-h', h.addr);

  // Mensajes del hilo
  const msgs = document.getElementById('email-msgs');
  if (msgs) {
    msgs.innerHTML = h.msgs.map(m=>`
      <div style="display:flex;flex-direction:column;align-items:${m.out?'flex-end':'flex-start'};">
        <div style="font-size:11px;color:var(--gris-50);margin-bottom:4px;${m.out?'text-align:right':''}">${m.de} · ${m.h}</div>
        <div class="email-msg-burbuja ${m.out?'email-msg-out':'email-msg-in'}">${m.t}</div>
      </div>`).join('');
    msgs.scrollTop = 9999;
  }

  // Mostrar panel
  const empty = document.getElementById('email-empty');
  const hilo  = document.getElementById('email-hilo');
  if (empty) empty.style.display = 'none';
  if (hilo)  { hilo.style.display = 'flex'; }
  document.getElementById('email-reply-box').style.display = 'none';
}

function emailFiltrar(v) { emailFiltroTxt = v; emailRenderLista(); }

function emailResponder() {
  const h = emailHilos.find(x=>x.id===emailActualId);
  if (!h) return;
  setEl('email-reply-to', h.addr);
  document.getElementById('email-reply-box').style.display = 'block';
  document.getElementById('email-reply-txt').focus();
}
function emailCancelarReply() {
  document.getElementById('email-reply-box').style.display = 'none';
}
function emailEnviarReply() {
  const txt = document.getElementById('email-reply-txt')?.value?.trim();
  if (!txt) return;
  const h = emailHilos.find(x=>x.id===emailActualId);
  if (!h) return;
  const hoy = new Date().toLocaleString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  h.msgs.push({ out:true, de:(window.currentPerfil?.nombre || 'Docente'), t:txt, h:hoy });
  document.getElementById('email-reply-txt').value = '';
  emailSeleccionar(emailActualId);
  hubToast('✅ Respuesta enviada','ok');
}
async function emailReenviar(){
  const cct=window.currentPerfil?.escuela_cct;
  if(!window.sb||!cct){hubToast('Sin conexión','error');return;}
  hubToast('🔄 Reenviando invitación…','ok');
  try{
    await window.sb.from('invitaciones').update({reenviado_at:new Date().toISOString(),estado:'pendiente'}).eq('escuela_cct',cct).eq('estado','expirada');
    hubToast('✅ Invitaciones pendientes reenviadas');
  }catch(e){hubToast('Error al reenviar: '+e.message,'error');}
}

function emailNuevo() {
  const sel = document.getElementById('email-to-sel');
  if (sel) {
    sel.innerHTML = '<option value="">Seleccionar familia…</option>' +
      alumnos.map((a,i)=>`<option value="${i}">Familia de ${a.n}</option>`).join('');
  }
  const ov = document.getElementById('modal-email-ov');
  if (ov) { ov.style.opacity='1'; ov.style.pointerEvents='all'; document.getElementById('modal-email-box').style.transform='translateY(0)'; }
}
function emailCerrarModal() {
  const ov = document.getElementById('modal-email-ov');
  if (ov) { ov.style.opacity='0'; ov.style.pointerEvents='none'; }
}
function emailEnviar() {
  const idx = parseInt(getVal('email-to-sel'));
  const asunto = getVal('email-asunto').trim();
  const cuerpo = getVal('email-cuerpo').trim();
  if (isNaN(idx) || !asunto || !cuerpo) { hubToast('⚠️ Completa todos los campos','warn'); return; }
  const a = alumnos[idx];
  const hoy = new Date().toLocaleString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  emailHilos.unshift({
    id: Date.now(), alumnoIdx: idx,
    nombre: `Familia de ${a.n}`,
    addr: `familia.${a.n.toLowerCase().replace(/\s+/g,'.')}` + '&#64;' + `gmail.com`,
    asunto, leido: true,
    msgs: [{ out:true, de:(window.currentPerfil?.nombre || 'Docente'), t:cuerpo, h:hoy }]
  });
  emailCerrarModal();
  emailRenderLista();
  emailSeleccionar(emailHilos[0].id);
  hubToast('✅ Correo enviado','ok');
}
function sendMsg() { emailEnviarReply(); }  // alias legacy

// CALENDARIO
// Carga eventos de escuela desde Supabase y actualiza el arreglo local
async function _cargarEventosEscuela() {
  const cct = window.currentPerfil?.escuela_cct;
  if (!window.sb || !cct) return;
  try {
    const { data } = await window.sb.from('eventos')
      .select('fecha,tipo,label,titulo,descripcion')
      .eq('escuela_cct', cct).eq('activo', true)
      .order('fecha').limit(60);
    if (data?.length) {
      // Convertir al formato {dia, texto, tipo} que usa renderCalendario
      eventos.length = 0;
      data.forEach(ev => {
        const d = new Date((ev.fecha || '') + 'T12:00:00');
        if (isNaN(d)) return;
        const mesEv = d.getMonth() + 1;
        if (mesEv === calMes && d.getFullYear() === calAnio) {
          eventos.push({ dia: d.getDate(), texto: ev.label || ev.titulo || '—', tipo: ev.tipo || 'evento' });
        }
      });
      // Guardar todos para navegación de mes
      window._calEventosTodos = data;
    }
  } catch(e) { console.warn('[Calendario]', e.message); }
}

function _actualizarEventosMes() {
  const todos = window._calEventosTodos || [];
  eventos.length = 0;
  todos.forEach(ev => {
    const d = new Date((ev.fecha || '') + 'T12:00:00');
    if (isNaN(d)) return;
    if (d.getMonth() + 1 === calMes && d.getFullYear() === calAnio) {
      eventos.push({ dia: d.getDate(), texto: ev.label || ev.titulo || '—', tipo: ev.tipo || 'evento' });
    }
  });
}

function renderCalendario(){
  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesEl = document.getElementById('mes-actual');
  if (mesEl) mesEl.textContent=`${meses[calMes-1]} ${calAnio}`;
  const primerDia=new Date(calAnio,calMes-1,1).getDay();
  const diasMes=new Date(calAnio,calMes,0).getDate();
  const today = new Date();
  let html=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d=>`<div class="cal-day-header">${d}</div>`).join('');
  for(let i=0;i<primerDia;i++) html+=`<div class="cal-day otro-mes">${new Date(calAnio,calMes-1,-primerDia+i+1).getDate()}</div>`;
  for(let d=1;d<=diasMes;d++){
    const hoy=d===today.getDate()&&calMes===today.getMonth()+1&&calAnio===today.getFullYear();
    const ev=eventos.find(e=>e.dia===d);
    html+=`<div class="cal-day ${hoy?'today':''} ${ev?'has-event':''}" title="${ev?ev.texto:''}">${d}</div>`;
  }
  const calGrid = document.getElementById('cal-grid');
  if (calGrid) calGrid.innerHTML=html;
  const evMes = document.getElementById('eventos-mes');
  if (evMes) evMes.innerHTML=eventos.length ? eventos.map(e=>`
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--gris-10);">
      <div style="width:32px;height:32px;border-radius:8px;background:var(--verde-light);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:var(--verde);">${e.dia}</div>
      <div style="font-size:13px;">${e.texto}</div>
      <span class="chip chip-${e.tipo}" style="margin-left:auto;">${e.tipo}</span>
    </div>
  `).join('') : '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">Sin eventos este mes</div>';

  // Cargar desde Supabase si aún no se ha hecho
  if (!window._calEventosTodos) {
    _cargarEventosEscuela().then(() => renderCalendario());
  }
}
function mesAnterior(){if(calMes===1){calMes=12;calAnio--;}else calMes--;_actualizarEventosMes();renderCalendario();}
function mesSiguiente(){if(calMes===12){calMes=1;calAnio++;}else calMes++;_actualizarEventosMes();renderCalendario();}
function nuevoEvento(){
  let modal = document.getElementById('modal-nuevo-evento');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-nuevo-evento';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);z-index:900;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `<div style="background:white;border-radius:16px;padding:28px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.2);">
        <h3 style="font-family:'Fraunces',serif;font-size:18px;margin-bottom:20px;color:#1c1c1a;">&#x1F4C5; Nuevo evento</h3>
        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:11px;font-weight:700;color:#6b6b65;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Título</label>
          <input id="ev-titulo" type="text" placeholder="Ej. Junta de padres" maxlength="60"
            style="width:100%;padding:10px 12px;border:1.5px solid #e2e0d8;border-radius:8px;font-size:14px;font-family:inherit;outline:none;">
        </div>
        <div style="display:flex;gap:10px;margin-bottom:16px;">
          <div style="flex:1;">
            <label style="display:block;font-size:11px;font-weight:700;color:#6b6b65;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Día</label>
            <input id="ev-dia" type="number" min="1" max="31" placeholder="18"
              style="width:100%;padding:10px 12px;border:1.5px solid #e2e0d8;border-radius:8px;font-size:14px;font-family:inherit;outline:none;">
          </div>
          <div style="flex:1;">
            <label style="display:block;font-size:11px;font-weight:700;color:#6b6b65;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Tipo</label>
            <select id="ev-tipo" style="width:100%;padding:10px 12px;border:1.5px solid #e2e0d8;border-radius:8px;font-size:14px;font-family:inherit;outline:none;background:white;">
              <option value="evento">Evento</option>
              <option value="festivo">Día festivo</option>
              <option value="examen">Examen</option>
              <option value="aviso">Aviso</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button onclick="document.getElementById('modal-nuevo-evento').style.display='none'"
            style="padding:9px 18px;border:1.5px solid #e2e0d8;border-radius:8px;background:white;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Cancelar</button>
          <button onclick="_guardarEvento()"
            style="padding:9px 18px;background:#1a6b4a;color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) modal.style.display='none'; });
  }
  document.getElementById('ev-titulo').value = '';
  document.getElementById('ev-dia').value    = new Date().getDate();
  document.getElementById('ev-tipo').value   = 'evento';
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('ev-titulo').focus(), 80);
}
function _guardarEvento() {
  const titulo = document.getElementById('ev-titulo')?.value.trim();
  const dia    = parseInt(document.getElementById('ev-dia')?.value);
  const tipo   = document.getElementById('ev-tipo')?.value || 'evento';
  if (!titulo) { hubToast('&#x26A0;&#xFE0F; Escribe un título', 'warn'); return; }
  if (!dia || dia < 1 || dia > 31) { hubToast('&#x26A0;&#xFE0F; Día inválido', 'warn'); return; }
  if (typeof eventos !== 'undefined') eventos.push({ dia, texto: titulo, tipo });
  if (typeof renderCalendario === 'function') renderCalendario();
  document.getElementById('modal-nuevo-evento').style.display = 'none';
  hubToast('&#x1F4C5; Evento "' + titulo + '" agregado', 'ok');
}


// ═══════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════
const DIAS = ['Lunes','Martes','Miércoles','Jueves','Viernes'];
const HORAS = ['7:00','8:00','9:00','10:00','11:00 Receso','12:00','13:00'];
const HORAS_LABELS = ['7:00 – 8:00','8:00 – 9:00','9:00 – 10:00','10:00 – 11:00','RECESO','12:00 – 13:00','13:00 – 14:00'];

const DOCENTES_COLORS = [
  {bg:'#3b7be8',light:'#dbeafe'},{bg:'#7c3aed',light:'#f5f3ff'},
  {bg:'#059669',light:'#d1fae5'},{bg:'#d97706',light:'#fef3c7'},
  {bg:'#db2777',light:'#fce7f3'},{bg:'#0891b2',light:'#cffafe'},
  {bg:'#dc2626',light:'#fee2e2'},{bg:'#65a30d',light:'#ecfccb'},
];

const docentes = []; // Se llena con datos reales de Supabase al hacer login

// Disponibilidad: 0=no, 1=sí, 2=preferida
const disponibilidades = {};
docentes.forEach(d => {
  disponibilidades[d.id] = Array(7).fill(null).map(()=>
    DIAS.map(()=> d.estado==='pendiente' ? 0 : (Math.random()>.3 ? (Math.random()>.6?2:1) : 0))
  );
});

const grupos = []; // Se llena con datos reales de Supabase al hacer login

// Horario construido: [hora][dia] = {docId, materia} | null | 'receso'
let horarioActual = {};
let grupoActual = '6A';
let modalSlot = null; // {hora, dia}

// Horario demo para 6A
function initHorario6A() {
  horarioActual['6A'] = Array(7).fill(null).map(()=>Array(5).fill(null));
  const h = horarioActual['6A'];
  h[0][0]={d:0,m:'Matemáticas'}; h[0][1]={d:1,m:'Español'};     h[0][2]={d:2,m:'Ciencias'};   h[0][3]={d:0,m:'Matemáticas'}; h[0][4]={d:1,m:'Formación'};
  h[1][0]={d:1,m:'Español'};     h[1][1]={d:0,m:'Matemáticas'}; h[1][2]={d:3,m:'Ed. Física'}; h[1][3]={d:2,m:'Historia'};    h[1][4]={d:0,m:'Ciencias'};
  h[2][0]={d:2,m:'Historia'};    h[2][1]={d:4,m:'Artes'};       h[2][2]={d:1,m:'Español'};    h[2][3]={d:4,m:'Formación'};   h[2][4]={d:2,m:'Geografía'};
  h[3][0]={d:2,m:'Geografía'};   h[3][1]={d:2,m:'Historia'};    h[3][2]={d:0,m:'Matemáticas'};h[3][3]={d:1,m:'Español'};     h[3][4]={d:4,m:'Artes'};
  // [4] = receso
  h[5][0]={d:0,m:'Ciencias'};    h[5][1]={d:3,m:'Ed. Física'}; h[5][2]={d:4,m:'Artes'};      h[5][3]={d:0,m:'Matemáticas'}; h[5][4]={d:1,m:'Español'};
  h[6][0]={d:1,m:'Formación'};   h[6][1]={d:4,m:'Artes'};      h[6][2]={d:2,m:'Geografía'};  h[6][3]={d:3,m:'Ed. Física'};  h[6][4]={d:0,m:'Matemáticas'};
}

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
function dirNav(page) {
  closeSidebarOnMobile();

  // Páginas que pueden estar fuera de #dir-portal (dentro del modal-celda por error estructural)
  // Las movemos al contenedor .content la primera vez que se acceden
  const _content = document.querySelector('#dir-portal .content');
  const _roguePagesIds = ['capacitacion','gestion-escolar','tiendita','canal-mensajes','cobranza',
                          'calendario','cte','pemc','prefectos'];
  _roguePagesIds.forEach(id => {
    const el = document.getElementById('dir-p-' + id);
    if (el && _content && !_content.contains(el)) {
      _content.appendChild(el);   // rescatar página del interior del modal
    }
  });

  // Desactivar todas las páginas (ahora todas están dentro de #dir-portal)
  document.querySelectorAll('#dir-portal .page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#dir-portal .nav-btn').forEach(b=>b.classList.remove('active'));
  const _dirPg = document.getElementById('dir-p-'+page) || document.getElementById('p-'+page);
  if (_dirPg) _dirPg.classList.add('active');
  const btn = [...document.querySelectorAll('#dir-portal .nav-btn')].find(b=>b.getAttribute('onclick')===`dirNav('${page}')`);
  if(btn) btn.classList.add('active');
  const titles = {
    dashboard:'Dashboard · Ciclo 2025–2026',
    docentes:'Docentes registrados',
    grupos:'Grupos y salones',
    alumnos:'Alumnos registrados',
    disponibilidad:'Disponibilidades de docentes',
    'horarios-publicados':'Horarios publicados',
    reportes:'Estadísticas y reportes',
    exportar:'Exportar horarios',
    invitaciones:'Invitar personal',
    cobranza:'Cobranza escolar',
    'canal-mensajes':'Canal Docentes',
    capacitacion:'Capacitación y programas SEP',
    'gestion-escolar':'Gestión escolar',
    tiendita:'Tiendita escolar / Cooperativa',
    'alertas-plantel':'Alertas del plantel',
    'actas-personal':'Actas administrativas de personal',
    'licencias-permisos':'Licencias y permisos del personal',
    'libro-visitas':'Libro de visitas SEP',
  };
  document.getElementById('dir-page-title').textContent = titles[page]||page;
  document.getElementById('dir-notif-slide').classList.remove('open');

  // Render on demand
  if(page==='dashboard') dirRenderDash();
  if(page==='docentes') renderDocentes();
  if(page==='disponibilidad') renderDisponibilidad();
  if(page==='constructor') renderConstructor();
  if(page==='conflictos') renderConflictos();
  if(page==='horarios-publicados') renderHorariosPublicados();
  if(page==='grupos') renderGrupos();
  if(page==='alumnos') dirAlumnosCargar();
  if(page==='reportes') { renderReportes(); if(typeof dirCargarEvaluacionesDocentes==='function') dirCargarEvaluacionesDocentes(); }
  if(page==='invitaciones') dirCargarInvitaciones();
  if(page==='canal-mensajes') dirCanalCargar();
  if(page==='capacitacion') dirCapacitacionCargar();
  if(page==='gestion-escolar') dirGestionEscolarCargar();
  if(page==='tiendita') dirTienditaCargar();
  if(page==='cobranza') dirCobranzaCargar();
  if(page==='alertas-plantel')  dirAlertasPlantelCargar();
  if(page==='actas-personal')   dirActasPersonalCargar();
  if(page==='licencias-permisos') dirLicenciasCargar();
  if(page==='libro-visitas')    dirLibroVisitasCargar();
}

function dirToggleNotif() {
  document.getElementById('dir-notif-slide').classList.toggle('open');
}

// ══ DIRECTOR CANAL MENSAJES (reemplazado por Canal Docentes completo) ══
// Las funciones principales están definidas más abajo como dirCanalCargar, etc.

// ═══════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════
function dirRenderDash() {
  // ── Estado vacío ──
  const emptyRow = (msg, action='') => `<tr><td colspan="4" style="padding:32px;text-align:center;color:var(--gris-50);">
    <div style="font-size:13px;font-weight:600;margin-bottom:6px;">${msg}</div>${action}</td></tr>`;

  // Tabla docentes/disponibilidades
  const dispEl = document.getElementById('dashboard-dispon');
  if (dispEl) {
    const nivelActivoDisp = window._dirNivelActivo || window._admNivelActivo || 'secundaria';
    // Filter docentes by groups assigned to the active nivel (secundaria = groups 1-3, primaria = groups 1-6)
    const docentesFiltrados = docentes.filter(d => {
      if (!d.grupos || !d.grupos.length) return true; // show docentes with no group assigned
      return d.grupos.some(gNombre => {
        const grado = parseInt(String(gNombre).replace(/[°\s]/g,''));
        if (nivelActivoDisp === 'secundaria') return grado <= 3;
        return grado <= 6;
      });
    });
    if (!docentesFiltrados.length) {
      dispEl.innerHTML = emptyRow('Aún no hay docentes registrados',
        `<button onclick="dirNav('invitaciones')" class="btn btn-primary btn-sm" style="margin-top:6px;">✉️ Invitar docentes</button>`);
    } else {
      dispEl.innerHTML = docentesFiltrados.map(d=>`
    <tr>
      <td><div style="display:flex;align-items:center;gap:8px;">
        <div style="width:28px;height:28px;border-radius:50%;background:${DOCENTES_COLORS[d.id%8].bg};color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;">${d.ini}</div>
        <span style="font-weight:600;font-size:13px;">${d.nombre}</span>
      </div></td>
      <td style="font-size:12px;color:var(--gris-50);">${d.materias.join(', ')}</td>
      <td style="font-size:12px;">${d.enviado}</td>
      <td><span class="chip ${d.estado==='enviado'?'chip-ok':'chip-pend'}">${d.estado==='enviado'?'✅ Enviado':'⏳ Pendiente'}</span></td>
    </tr>
  `).join('');
    }
  }

  // Grupos
  const gruposEl = document.getElementById('dashboard-grupos');
  if (gruposEl) {
    const nivelActivo = window._dirNivelActivo || window._admNivelActivo || 'secundaria';
    const gruposFiltrados = grupos.filter(g => {
      const grado = parseInt(String(g.nombre || g.grado || '').replace(/[°\s]/g,''));
      if (nivelActivo === 'secundaria') return grado <= 3;
      return grado <= 6;
    });
    if (!gruposFiltrados.length) {
      gruposEl.innerHTML = `<div style="padding:32px;text-align:center;color:var(--gris-50);">
        <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Aún no hay grupos registrados</div>
        <div style="font-size:12px;">Crea los grupos del ciclo para comenzar asignaciones, horarios y cobertura.</div>
      </div>`;
    } else {
      gruposEl.innerHTML = gruposFiltrados.map(g=>`
    <div style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid var(--gris-10);gap:10px;">
      <div style="width:36px;height:36px;border-radius:8px;background:var(--azul-light);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:var(--azul-accent);">${g.nombre.split(' ')[0]}</div>
      <div style="flex:1;"><div style="font-weight:700;font-size:13px;">${g.nombre}</div><div style="font-size:11px;color:var(--gris-50);">${g.docente} · ${g.alumnos} alumnos</div></div>
      <span class="chip ${g.horario?'chip-ok':'chip-pend'}">${g.horario?'✅ Listo':'⏳ Pendiente'}</span>
    </div>
  `).join('');
    }
  }

  // Conflictos — solo mostrar si hay docentes
  const confEl = document.getElementById('dashboard-conflictos');
  if (confEl) {
    if (!docentes.length) {
      confEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--gris-50);font-size:13px;">Sin conflictos detectados</div>`;
    } else {
      confEl.innerHTML = `
    <div class="conflicto-item conflicto-error"><div class="conf-ico">❌</div><div><div class="conf-title">Docente doble asignado</div><div class="conf-sub">Prof. Ramírez · Martes 10:00 · 6A y 5A simultáneos</div></div></div>
    <div class="conflicto-item conflicto-warn"><div class="conf-ico">⚠️</div><div><div class="conf-title">Sin conflictos por ahora</div><div class="conf-sub">Los conflictos aparecen al construir horarios</div></div></div>
  `;
    }
  }

  // Horas por docente
  const horasEl = document.getElementById('dashboard-horas');
  if (horasEl) {
    if (!docentes.length) {
      horasEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--gris-50);font-size:13px;">—</div>`;
    } else {
      horasEl.innerHTML = docentes.map(d=>`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <div style="width:80px;font-size:12px;color:var(--gris-50);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.nombre.split(' ')[0]}</div>
      <div class="prog-bar" style="flex:1;"><div class="prog-fill" style="width:${d.horas/24*100}%;background:${DOCENTES_COLORS[d.id%8].bg};"></div></div>
      <div style="font-size:12px;font-weight:700;width:28px;text-align:right;">${d.horas}h</div>
    </div>
  `).join('');
    }
  }
}

// ═══════════════════════════════════════════════
// DOCENTES
// ═══════════════════════════════════════════════
function renderDocentes() {
  const tabla = document.getElementById('docentes-tabla');
  if (!tabla) return;
  if (!docentes.length) {
    tabla.innerHTML = `<tr><td colspan="6" style="padding:48px;text-align:center;color:var(--gris-50);">
      <div style="font-size:32px;margin-bottom:10px;">👩‍🏫</div>
      <div style="font-size:14px;font-weight:700;color:var(--gris-80);margin-bottom:6px;">Aún no hay docentes registrados</div>
      <div style="font-size:13px;margin-bottom:14px;">Usa la sección <strong>Invitar personal</strong> para dar de alta a tu equipo docente.</div>
      <button onclick="dirNav('invitaciones')" class="btn btn-primary btn-sm">✉️ Invitar docentes</button>
    </td></tr>`;
    return;
  }
  tabla.innerHTML = docentes.map(d=>`
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px;">
        <div style="width:34px;height:34px;border-radius:50%;background:${DOCENTES_COLORS[d.id%8].bg};color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;">${d.ini}</div>
        <div><div style="font-weight:700;">${d.nombre}</div><div style="font-size:11px;color:var(--gris-50);">ID-${String(d.id+1).padStart(3,'0')}</div></div>
      </div></td>
      <td>${d.materias.map(m=>`<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${DOCENTES_COLORS[d.id%8].light};color:${DOCENTES_COLORS[d.id%8].bg};margin:2px;">${m}</span>`).join('')}</td>
      <td style="font-size:13px;">${d.grupos.join(', ')}</td>
      <td><span style="font-weight:700;">${d.horas}</span> <span style="color:var(--gris-50);font-size:11px;">hrs/sem</span></td>
      <td><span class="chip ${d.estado==='enviado'?'chip-ok':'chip-pend'}">${d.estado==='enviado'?'✅ Enviada':'⏳ Pendiente'}</span></td>
      <td style="display:flex;gap:6px;">
        <button class="btn btn-outline btn-xs" onclick="verDisponibilidad(${d.id})">👁 Ver</button>
        <button class="btn btn-outline btn-xs" onclick="recordar(${d.id})">📧</button>
      </td>
    </tr>
  `).join('');
}

// ═══════════════════════════════════════════════
// DISPONIBILIDAD
// ═══════════════════════════════════════════════
function renderDisponibilidad() {
  const sel = document.getElementById('filtro-doc');
  if (!docentes.length) {
    const g = document.getElementById('dispon-grid-view');
    if (g) g.innerHTML = `<div style="padding:48px;text-align:center;color:var(--gris-50);font-size:13px;">
      Todavía no hay docentes registrados. Invita a tu equipo para consultar disponibilidad y organizar coberturas.</div>`;
    return;
  }
  // Poblar filtro
  sel.innerHTML = `<option value="">Todos los docentes</option>` +
    docentes.map(d=>`<option value="${d.id}">${d.nombre}</option>`).join('');

  renderDisponGrid(0);
  renderResumenDispon();
}

function renderDisponGrid(docId) {
  const disp = disponibilidades[docId];
  const g = document.getElementById('dispon-grid-view');
  let html = '<div></div>'+DIAS.map(d=>`<div class="dispon-header">${d}</div>`).join('');
  HORAS.forEach((h,hi)=>{
    html+=`<div class="dispon-hora">${h}</div>`;
    DIAS.forEach((_,di)=>{
      const v = hi===4 ? 'receso' : (disp[hi]?.[di]??0);
      if(v==='receso'){html+=`<div class="dispon-cell" style="background:var(--gris-10);border-color:var(--gris-20);cursor:default;"><span style="color:var(--gris-50);font-size:10px;">RECESO</span></div>`;return;}
      const cls = v===2?'preferida':v===1?'disponible':'no-disponible';
      const lbl = v===2?'⭐ Pref':v===1?'✅ Sí':'❌ No';
      html+=`<div class="dispon-cell ${cls}" onclick="toggleDispon(${docId},${hi},${di},this)">${lbl}</div>`;
    });
  });
  g.innerHTML = html;
  document.querySelector('.card-title').textContent = `Vista: ${docentes[docId]?.nombre||'—'}`;
}

function toggleDispon(docId,hi,di,el){
  const v = disponibilidades[docId][hi][di];
  const next = v===0?1:v===1?2:0;
  disponibilidades[docId][hi][di]=next;
  el.className=`dispon-cell ${next===2?'preferida':next===1?'disponible':'no-disponible'}`;
  el.textContent=next===2?'⭐ Pref':next===1?'✅ Sí':'❌ No';
}

function filtrarDispon(){
  const v=document.getElementById('filtro-doc').value;
  if(v!=='') renderDisponGrid(parseInt(v));
}

function renderResumenDispon(){
  const el=document.getElementById('dispon-resumen-list');
  el.innerHTML=docentes.map(d=>{
    const disp=disponibilidades[d.id];
    const total=disp.flat().filter(x=>typeof x==='number'&&x>0).length;
    return `<div style="padding:12px 0;border-bottom:1px solid var(--gris-10);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="width:28px;height:28px;border-radius:50%;background:${DOCENTES_COLORS[d.id%8].bg};color:white;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;">${d.ini}</div>
        <div style="flex:1;font-weight:700;font-size:13px;">${d.nombre}</div>
        <span class="chip ${d.estado==='enviado'?'chip-ok':'chip-pend'}" style="font-size:10px;">${total} horas disp.</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:2px;">
        ${DIAS.map((_,di)=>{
          const hrsOk=disp.filter((r,hi)=>hi!==4&&typeof r[di]==='number'&&r[di]>0).length;
          return `<div style="height:6px;border-radius:3px;background:${hrsOk>=5?'#86efac':hrsOk>=3?'#fde68a':'#fca5a5'};"></div>`;
        }).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:2px;margin-top:2px;">
        ${DIAS.map(d=>`<div style="font-size:9px;text-align:center;color:var(--gris-50);">${d.slice(0,3)}</div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function verDisponibilidad(id){
  dirNav('disponibilidad');
  setTimeout(()=>{document.getElementById('filtro-doc').value=id;renderDisponGrid(id);},100);
}

// ═══════════════════════════════════════════════
// CONSTRUCTOR
// ═══════════════════════════════════════════════
function renderConstructor() {
  if(!horarioActual['6A']) initHorario6A();
  renderHorarioBuilder();
  renderDocentesDrag();
  actualizarContadorHoras();
}

function renderHorarioBuilder() {
  const g = document.getElementById('horario-builder');
  const h = horarioActual[grupoActual] || Array(7).fill(null).map(()=>Array(5).fill(null));
  let html = `<div style="height:36px;"></div>` +
    DIAS.map(d=>`<div class="hb-header">${d}</div>`).join('');

  HORAS.forEach((hora,hi)=>{
    html+=`<div class="hb-hora">${hora.replace(' Receso','')}</div>`;
    if(hora.includes('Receso')){
      DIAS.forEach(()=>{html+=`<div class="hb-cell receso"><div class="receso-label">☕ Receso</div></div>`;});
      return;
    }
    DIAS.forEach((_,di)=>{
      const cls=h[hi]?.[di];
      if(cls){
        const doc=docentes[cls.d];
        const color=DOCENTES_COLORS[cls.d%8];
        html+=`<div class="hb-cell filled" style="background:${color.light};border-color:${color.bg};"
          ondragover="dragOver(event)" ondrop="drop(event,${hi},${di})">
          <div class="clase-block">
            <div class="clase-mat" style="color:${color.bg};">${cls.m}</div>
            <div class="clase-doc">${doc.ini} ${doc.nombre.split(' ')[1]}</div>
          </div>
          <button class="clase-remove" onclick="quitarClase(${hi},${di})" aria-label="Cerrar">✕</button>
        </div>`;
      } else {
        html+=`<div class="hb-cell" onclick="abrirModal(${hi},${di})"
          ondragover="dragOver(event)" ondrop="drop(event,${hi},${di})">
          <span style="font-size:10px;color:var(--gris-50);">+ Asignar</span>
        </div>`;
      }
    });
  });
  g.innerHTML = html;

  // Leyenda
  const usados = new Set();
  (horarioActual[grupoActual]||[]).forEach(row=>row.forEach(c=>{if(c)usados.add(c.d);}));
  document.getElementById('leyenda-colores').innerHTML=[...usados].map(id=>{
    const c=DOCENTES_COLORS[id%8];const d=docentes[id];
    return `<div style="display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;background:${c.light};font-size:11px;font-weight:700;color:${c.bg};">${d.ini} ${d.nombre.split(' ')[1]}</div>`;
  }).join('');
}

function renderDocentesDrag(){
  document.getElementById('docentes-drag-list').innerHTML=docentes.map(d=>`
    <div class="docente-item" draggable="true" ondragstart="dragStart(event,${d.id})">
      <div class="docente-row">
        <div class="doc-avatar" style="background:${DOCENTES_COLORS[d.id%8].bg};">${d.ini}</div>
        <div><div class="doc-nombre">${d.nombre}</div><div class="doc-materias">${d.materias.join(' · ')}</div></div>
        <div class="doc-horas">${d.horas}h</div>
      </div>
      <div class="materias-chips">
        ${d.materias.map(m=>`<div class="mat-chip" style="background:${DOCENTES_COLORS[d.id%8].light};color:${DOCENTES_COLORS[d.id%8].bg};" 
          draggable="true" ondragstart="dragStartMat(event,${d.id},'${m}')">${m}</div>`).join('')}
      </div>
    </div>
  `).join('');
}

// Drag & Drop
let dragData = null;
function dragStart(e,docId){dragData={docId,materia:docentes[docId].materias[0]};e.dataTransfer.effectAllowed='copy';}
function dragStartMat(e,docId,mat){dragData={docId,materia:mat};e.dataTransfer.effectAllowed='copy';e.stopPropagation();}
function dragOver(e){e.preventDefault();e.currentTarget.classList.add('drag-over');}
function drop(e,hi,di){
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if(!dragData)return;
  if(!horarioActual[grupoActual]) horarioActual[grupoActual]=Array(7).fill(null).map(()=>Array(5).fill(null));
  // Check disponibilidad
  const disp=disponibilidades[dragData.docId][hi]?.[di];
  if(disp===0){showToast('⚠️ El docente no está disponible en ese horario','error');return;}
  horarioActual[grupoActual][hi][di]={d:dragData.docId,m:dragData.materia};
  renderHorarioBuilder();
  actualizarContadorHoras();
  dragData=null;
}

function quitarClase(hi,di){
  if(!horarioActual[grupoActual])return;
  horarioActual[grupoActual][hi][di]=null;
  renderHorarioBuilder();
  actualizarContadorHoras();
}

// Modal
function abrirModal(hi,di){
  modalSlot={hi,di};
  document.getElementById('modal-slot-info').textContent=`${DIAS[di]} · ${HORAS_LABELS[hi]} · Grupo ${grupoActual}`;
  const sel=document.getElementById('modal-docente');
  sel.innerHTML=docentes.map(d=>`<option value="${d.id}">${d.nombre}</option>`).join('');
  updateMaterias();
  verificarDisponModal(parseInt(sel.value),hi,di);
  document.getElementById('modal-celda').style.display='flex';
}
function cerrarModal(){document.getElementById('modal-celda').style.display='none';modalSlot=null;}
function updateMaterias(){
  const id=parseInt(document.getElementById('modal-docente').value);
  document.getElementById('modal-materia').innerHTML=docentes[id].materias.map(m=>`<option>${m}</option>`).join('');
  if(modalSlot) verificarDisponModal(id,modalSlot.hi,modalSlot.di);
}
function verificarDisponModal(docId,hi,di){
  const v=disponibilidades[docId][hi]?.[di];
  const el=document.getElementById('modal-dispon-check');
  if(v===2){el.style.cssText='background:#dbeafe;color:#1d4ed8;';el.textContent='⭐ Hora preferida por el docente';}
  else if(v===1){el.style.cssText='background:#dcfce7;color:#15803d;';el.textContent='✅ Docente disponible en este horario';}
  else{el.style.cssText='background:#fee2e2;color:#b91c1c;';el.textContent='❌ Docente NO disponible — asignar de todas formas';}
}
function confirmarAsignacion(){
  const docId=parseInt(document.getElementById('modal-docente').value);
  const mat=document.getElementById('modal-materia').value;
  if(!horarioActual[grupoActual]) horarioActual[grupoActual]=Array(7).fill(null).map(()=>Array(5).fill(null));
  horarioActual[grupoActual][modalSlot.hi][modalSlot.di]={d:docId,m:mat};
  cerrarModal();
  renderHorarioBuilder();
  actualizarContadorHoras();
  showToast(`✅ ${mat} asignada a ${docentes[docId].nombre.split(' ')[0]}`,'success');
}

function actualizarContadorHoras(){
  const h=horarioActual[grupoActual]||[];
  const asig=h.flat().filter(c=>c&&typeof c==='object').length;
  const total=30; // 6hrs x 5días
  document.getElementById('horas-contador').textContent=`${asig} / ${total} horas asignadas`;
}

function cambiarGrupo(){
  grupoActual=document.getElementById('sel-grupo').value;
  document.getElementById('grupo-label').textContent=grupoActual.replace(/([0-9]+)([A-Z])/,'$1° $2');
  if(!horarioActual[grupoActual]) horarioActual[grupoActual]=Array(7).fill(null).map(()=>Array(5).fill(null));
  renderHorarioBuilder();
  actualizarContadorHoras();
}

function limpiarHorario(){
  if(confirm('¿Limpiar todo el horario de este grupo?')){
    horarioActual[grupoActual]=Array(7).fill(null).map(()=>Array(5).fill(null));
    renderHorarioBuilder();
    actualizarContadorHoras();
    showToast('🗑 Horario limpiado');
  }
}

function autoAsignar(){
  showToast('⚙️ Auto-asignando horario…');
  setTimeout(()=>{
    initHorario6A();
    renderHorarioBuilder();
    actualizarContadorHoras();
    showToast('✅ Auto-asignación completada — revisa los conflictos','success');
  },1200);
}

async function guardarHorario(){
  showToast('💾 Guardando horario…');
  if (sb && currentPerfil) {
    try {
      await horarioGuardarDB();
      showToast('✅ Horario guardado. Docentes notificados.','success');
    } catch(e) {
      showToast('❌ Error: ' + e.message, 'error');
    }
  } else {
    // Demo: guardar en localStorage
    try { localStorage.setItem('siembra_horario_dir', JSON.stringify({grupos, horarioData, grupoActual})); } catch(e) {}
    setTimeout(()=>{ showToast('✅ Horario guardado localmente (demo)','success'); }, 800);
  }
}

// ═══════════════════════════════════════════════
// CONFLICTOS
// ═══════════════════════════════════════════════
function renderConflictos(){
  document.getElementById('conflictos-errores').innerHTML=`
    <div class="conflicto-item conflicto-error"><div class="conf-ico">❌</div><div>
      <div class="conf-title">Docente doble asignado</div>
      <div class="conf-sub">Prof. Carlos Ramírez está asignado en Martes 10:00 simultáneamente en 6°A (Español) y 5°A (Formación)</div>
      <button class="btn btn-danger btn-xs" style="margin-top:8px;" onclick="dirNav('constructor')">Ir al constructor →</button>
    </div></div>
    <div class="conflicto-item conflicto-error"><div class="conf-ico">❌</div><div>
      <div class="conf-title">Materia sin asignar</div>
      <div class="conf-sub">Grupo 6°A no tiene docente asignado para Ciencias los miércoles</div>
      <button class="btn btn-danger btn-xs" style="margin-top:8px;" onclick="dirNav('constructor')">Ir al constructor →</button>
    </div></div>`;

  document.getElementById('conflictos-warnings').innerHTML=`
    <div class="conflicto-item conflicto-warn"><div class="conf-ico">⚠️</div><div>
      <div class="conf-title">Exceso de horas por docente</div>
      <div class="conf-sub">Prof. Roberto Sánchez tiene 22 hrs/sem (máximo recomendado: 20)</div>
    </div></div>
    <div class="conflicto-item conflicto-warn"><div class="conf-ico">⚠️</div><div>
      <div class="conf-title">Disponibilidad no confirmada</div>
      <div class="conf-sub">Prof. Jorge Gómez y Prof. Roberto Sánchez no han enviado su disponibilidad</div>
      <button class="btn btn-outline btn-xs" style="margin-top:8px;" onclick="enviarRecordatorio()">Enviar recordatorio</button>
    </div></div>`;

  document.getElementById('conflictos-ok').innerHTML=`
    <div class="conflicto-item conflicto-ok"><div class="conf-ico">✅</div><div><div class="conf-title">Sin solapamientos en 3°A, 4°A, 5°A</div><div class="conf-sub">Todos los horarios son compatibles</div></div></div>
    <div class="conflicto-item conflicto-ok"><div class="conf-ico">✅</div><div><div class="conf-title">Recesos en horario correcto</div><div class="conf-sub">Todos los grupos tienen receso 11:00–12:00</div></div></div>
    <div class="conflicto-item conflicto-ok"><div class="conf-ico">✅</div><div><div class="conf-title">Carga horaria equilibrada</div><div class="conf-sub">6 de 8 docentes están dentro del rango óptimo</div></div></div>
    <div class="conflicto-item conflicto-ok"><div class="conf-ico">✅</div><div><div class="conf-title">Ed. Física distribuida</div><div class="conf-sub">Todos los grupos tienen Ed. Física confirmada</div></div></div>`;
}

function verificarConflictos(){
  const data = window._dirHorarios || window._horarioData || [];
  if(!data.length){hubToast('No hay datos de horario para verificar','ok');return;}
  const conflictos=[];
  const mapa={};
  data.forEach(h=>{
    ['lunes','martes','miercoles','jueves','viernes'].forEach(dia=>{
      const hora=h[dia];if(!hora)return;
      const key=`${h.docente_nombre||'?'}|${dia}|${hora}`;
      if(mapa[key]){conflictos.push(`${h.docente_nombre||'Docente'}: conflicto el ${dia} a las ${hora} (${mapa[key]} y ${h.grupo||'?'})`);}
      else{mapa[key]=h.grupo||'?';}
    });
  });
  if(!conflictos.length){hubToast('✅ Sin conflictos detectados en el horario','ok');}
  else{hubModal('⚠️ Conflictos detectados','<ul style="font-size:13px;line-height:2;padding-left:20px;">'+conflictos.map(c=>`<li>${c}</li>`).join('')+'</ul>','Entendido',null);}
}
function verificarTodos(){
  const data = window._dirHorarios || window._horarioData || [];
  const errores=[];const advertencias=[];
  if(!data.length){hubToast('No hay datos de horario cargados','ok');return;}
  const mapa={};
  data.forEach(h=>{
    ['lunes','martes','miercoles','jueves','viernes'].forEach(dia=>{
      const hora=h[dia];if(!hora)return;
      const key=`${h.docente_nombre}|${dia}|${hora}`;
      if(mapa[key]){errores.push(`Conflicto: ${h.docente_nombre} tiene 2 grupos el ${dia} a las ${hora}`);}
      else{mapa[key]=h.grupo;}
    });
    if(!h.docente_nombre)advertencias.push(`Fila sin docente asignado: grupo ${h.grupo||'?'}`);
    if(!h.grupo)advertencias.push(`Fila sin grupo: docente ${h.docente_nombre||'?'}`);
  });
  const total=errores.length+advertencias.length;
  if(!total){hubToast('✅ Verificación completa — sin errores ni advertencias','ok');return;}
  const html='<div style="font-size:13px;">'+(errores.length?'<p style="color:#ef4444;font-weight:700;">❌ '+errores.length+' error(es):</p><ul style="color:#ef4444;padding-left:20px;">'+errores.map(e=>`<li>${e}</li>`).join('')+'</ul>':'')+(advertencias.length?'<p style="color:#f59e0b;font-weight:700;margin-top:8px;">⚠️ '+advertencias.length+' advertencia(s):</p><ul style="color:#92400e;padding-left:20px;">'+advertencias.map(a=>`<li>${a}</li>`).join('')+'</ul>':'')+'</div>';
  hubModal('Resultado de verificación',html,'Cerrar',null);
}

// ═══════════════════════════════════════════════
// HORARIOS PUBLICADOS
// ═══════════════════════════════════════════════
function renderHorariosPublicados(){
  // Generar tabs dinámicamente según grupos reales o nivel activo
  const tabsEl = document.getElementById('pub-tabs');
  const selEl  = document.getElementById('sel-grupo');
  const nivel  = window._nivelActivo || localStorage.getItem('siembra_nivel') || 'primaria';
  const maxGrado = nivel === 'secundaria' ? 3 : 6;

  // Usar grupos reales si están disponibles; si no, generar del 1 al maxGrado
  const gruposReales = (window._dirGrupos || grupos || []).filter(g => {
    if (!g.grado) return true; // sin info de grado, incluir
    return g.grado <= maxGrado;
  });
  const tabGrupos = gruposReales.length
    ? gruposReales.map(g => g.nombre || `${g.grado}° A`)
    : Array.from({length: maxGrado}, (_, i) => `${i+1}A`);

  if (tabsEl) {
    tabsEl.innerHTML = tabGrupos.map((g, i) => {
      const label = g.includes('°') ? g : g.replace(/([0-9]+)([A-Z])/,'$1° $2');
      return `<button class="tab${i===0?' active':''}" onclick="setTabGrupo(this,'${g}')">${label}</button>`;
    }).join('');
  }
  if (selEl) {
    selEl.innerHTML = tabGrupos.map(g => {
      const label = g.includes('°') ? g : g.replace(/([0-9]+)([A-Z])/,'$1° $2');
      return `<option value="${g}">${label}</option>`;
    }).join('');
  }

  const primerGrupo = tabGrupos[0] || '1A';
  if(!horarioActual[primerGrupo] && !horarioActual['6A']) initHorario6A();
  renderPreviewHorario(primerGrupo);
}
function setTabGrupo(el,g){
  document.querySelectorAll('#pub-tabs .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('pub-grupo-label').textContent=`Horario · ${g.replace(/([0-9]+)([A-Z])/,'$1° $2')}`;
  renderPreviewHorario(g);
}
function renderPreviewHorario(g){
  const prev=document.getElementById('horario-preview');
  const h=horarioActual[g]||Array(7).fill(null).map(()=>Array(5).fill(null));
  let html=`<div style="height:36px;"></div>`+DIAS.map(d=>`<div class="hb-header">${d}</div>`).join('');
  HORAS.forEach((hora,hi)=>{
    html+=`<div class="hb-hora">${hora.replace(' Receso','')}</div>`;
    if(hora.includes('Receso')){DIAS.forEach(()=>{html+=`<div class="hb-cell receso"><div class="receso-label">☕ Receso</div></div>`;});return;}
    DIAS.forEach((_,di)=>{
      const cls=h[hi]?.[di];
      if(cls){const doc=docentes[cls.d];const color=DOCENTES_COLORS[cls.d%8];
        html+=`<div class="hb-cell filled" style="background:${color.light};border-color:${color.bg};"><div class="clase-block"><div class="clase-mat" style="color:${color.bg};">${cls.m}</div><div class="clase-doc">${doc.ini} ${doc.nombre.split(' ')[1]}</div></div></div>`;
      }else{html+=`<div class="hb-cell" style="cursor:default;opacity:.4;"><span style="font-size:10px;color:var(--gris-50);">—</span></div>`;}
    });
  });
  prev.innerHTML=html;
}

// ═══════════════════════════════════════════════
// GRUPOS
// ═══════════════════════════════════════════════
function renderGrupos(){
  const el = document.getElementById('grupos-grid');
  if (!el) return;
  if (!grupos.length) {
    el.innerHTML = `<div style="grid-column:1/-1;padding:48px;text-align:center;color:var(--gris-50);">
      <div style="font-size:32px;margin-bottom:10px;">👥</div>
      <div style="font-size:14px;font-weight:700;color:var(--gris-80);margin-bottom:6px;">Aún no hay grupos</div>
      <div style="font-size:13px;">Se crean al inscribir alumnos a la escuela.</div>
    </div>`;
    return;
  }
  el.innerHTML=grupos.map(g=>`
    <div class="card" style="cursor:pointer;" onclick="dirNav('constructor')">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div style="width:48px;height:48px;border-radius:12px;background:var(--azul-light);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:20px;font-weight:700;color:var(--azul-accent);">${g.nombre.replace(' ','')}</div>
        <div><div style="font-weight:800;font-size:15px;">${g.nombre}</div><div style="font-size:12px;color:var(--gris-50);">${g.alumnos} alumnos</div></div>
        <span class="chip ${g.horario?'chip-ok':'chip-pend'}" style="margin-left:auto;">${g.horario?'Listo':'Pendiente'}</span>
      </div>
      <div style="font-size:12px;color:var(--gris-50);">Docente titular:</div>
      <div style="font-size:13px;font-weight:700;margin-top:2px;">${g.docente}</div>
      <div style="margin-top:12px;"><div class="prog-bar"><div class="prog-fill" style="width:${g.horario?'100':'0'}%;"></div></div></div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════
// REPORTES
// ═══════════════════════════════════════════════
function renderReportes(){
  const el = document.getElementById('reporte-horas');
  if (!el) return;
  if (!docentes.length) {
    el.innerHTML = `<div style="padding:32px;text-align:center;color:var(--gris-50);font-size:13px;">Sin docentes para reportar.</div>`;
    return;
  }
  el.innerHTML=docentes.map(d=>`
    <div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid var(--gris-10);">
      <div style="width:32px;height:32px;border-radius:50%;background:${DOCENTES_COLORS[d.id%8].bg};color:white;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${d.ini}</div>
      <div style="width:160px;font-size:13px;font-weight:600;">${d.nombre}</div>
      <div class="prog-bar" style="flex:1;"><div class="prog-fill" style="width:${d.horas/24*100}%;background:${d.horas>20?'var(--rojo)':d.horas>16?'var(--azul-accent)':'var(--verde-accent)'};"></div></div>
      <div style="width:40px;text-align:right;font-size:13px;font-weight:800;">${d.horas}h</div>
      <span class="chip ${d.horas>20?'chip-no':d.horas>=14?'chip-ok':'chip-pend'}">${d.horas>20?'Exceso':d.horas>=14?'Óptimo':'Bajo'}</span>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════
// MISC
// ═══════════════════════════════════════════════
function showToast(msg,type=''){
  const t=document.getElementById('dir-toast');
  document.getElementById('toast-msg').textContent=msg;
  t.style.display='flex'; t.className=`toast ${type} show`;
  setTimeout(()=>{ t.classList.remove('show'); t.style.display='none'; },3000);
}
function dirExportarExcel(){
  const data = window._dirHorarios || window._horarioData || [];
  const cct = window.currentPerfil?.escuela_cct || 'escuela';
  if(!data.length){
    const csv = '\uFEFFDocente,Materia,Grupo,Lunes,Martes,Miércoles,Jueves,Viernes\n(Sin datos de horario)\n';
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));a.download=`horarios_${cct}.csv`;a.click();
    hubToast('✅ Plantilla de horarios descargada');return;
  }
  const header='Docente,Materia,Grupo,Lunes,Martes,Miércoles,Jueves,Viernes';
  const rows=data.map(h=>[h.docente_nombre||'',h.materia||'',h.grupo||'',h.lunes||'',h.martes||'',h.miercoles||'',h.jueves||'',h.viernes||''].join(','));
  const csv='\uFEFF'+[header,...rows].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));a.download=`horarios_${cct}_${new Date().toISOString().split('T')[0]}.csv`;a.click();
  hubToast('✅ Horarios exportados como CSV');
}
function dirExportarPDF(){
  const contenido = document.getElementById('dir-horarios-content') || document.getElementById('dir-horarios-container') || document.querySelector('#dir-portal .horario-tabla');
  if(!contenido){hubToast('No hay contenido de horarios visible para exportar','error');return;}
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Horarios</title><style>body{font-family:Arial,sans-serif;margin:20px;font-size:12px;}h2{color:#1e3a5f;}table{width:100%;border-collapse:collapse;}th{background:#1e3a5f;color:white;padding:6px;text-align:left;}td{padding:5px;border:1px solid #e2e8f0;}@media print{button{display:none}}</style></head><body><h2>Horarios — ${window.currentPerfil?.escuela_cct||''}</h2><p>Ciclo: ${window.CICLO_ACTIVO||'2025-2026'} · ${new Date().toLocaleDateString('es-MX')}</p>${contenido.innerHTML}<button onclick="window.print()" style="margin-top:16px;padding:8px 20px;background:#1e3a5f;color:white;border:none;border-radius:6px;cursor:pointer;">Imprimir / Guardar PDF</button></body></html>`;
  const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();}else{hubToast('Activa ventanas emergentes para exportar','error');}
}
async function publicarTodo(){
  const cct=window.currentPerfil?.escuela_cct;
  if(!window.sb||!cct){hubToast('Sin conexión','error');return;}
  const{error}=await window.sb.from('horarios').update({publicado:true,publicado_at:new Date().toISOString()}).eq('escuela_cct',cct).eq('ciclo',window.CICLO_ACTIVO||'2025-2026');
  if(error){hubToast('Error: '+error.message,'error');return;}
  hubToast('✅ Horarios publicados — los docentes ya pueden verlos');
}
async function notificarDocentes(){
  const cct=window.currentPerfil?.escuela_cct;
  if(!window.sb||!cct){hubToast('Sin conexión','error');return;}
  const{data:docentes}=await window.sb.from('usuarios').select('id').eq('escuela_cct',cct).eq('rol','docente').eq('activo',true);
  if(!docentes||!docentes.length){hubToast('Sin docentes registrados','error');return;}
  const registros=docentes.map(d=>({escuela_cct:cct,tipo:'aviso',mensaje:'El horario del ciclo '+( window.CICLO_ACTIVO||'2025-2026')+' ha sido publicado. Revisa tus horarios asignados.',destinatario_id:d.id,leida:false,created_at:new Date().toISOString()}));
  const{error}=await window.sb.from('alertas').insert(registros);
  if(error){hubToast('Error: '+error.message,'error');return;}
  hubToast('✅ Notificaciones enviadas a '+docentes.length+' docentes');
}
async function enviarRecordatorio(){
  const cct=window.currentPerfil?.escuela_cct;
  if(!window.sb||!cct){hubToast('Sin conexión','error');return;}
  const{data:docentes}=await window.sb.from('usuarios').select('id,nombre').eq('escuela_cct',cct).eq('rol','docente').eq('activo',true);
  if(!docentes||!docentes.length){hubToast('Sin docentes registrados','error');return;}
  const registros=docentes.map(d=>({escuela_cct:cct,tipo:'recordatorio',mensaje:'Recordatorio: Verifica tu planeación y asistencias pendientes para esta semana.',destinatario_id:d.id,leida:false,created_at:new Date().toISOString()}));
  const{error}=await window.sb.from('alertas').insert(registros);
  if(error){hubToast('Error: '+error.message,'error');return;}
  hubToast('✅ Recordatorio enviado a '+docentes.length+' docentes');
}
function recordar(id){showToast(`📧 Recordatorio enviado a ${docentes[id].nombre}`);}

// INIT


// ════ HUB ROUTER (modularizado en app/core/hub.js) ════

// ── Crear contraseña para usuario invitado: modularizado en app/core/registration.js ──


function _abrirPortalPorRol(rol) {
  const mapa = {
    'docente':      ['doc-portal',      initApp],
    'director':     ['dir-portal',      dirInitAll],
    'admin':        ['admin-portal',    adminInit],
    'padre':        ['padre-portal',    () => { padreInit(); if(typeof pInit==='function') pInit(); }],
    'ts':           ['ts-portal',       () => { tsPortalInit(); if(typeof tsInit==='function') tsInit(); }],
    'contralor':    ['contralor-portal', () => { if(typeof initContraloPortal==='function') initContraloPortal(); }],
    'tutor':        ['doc-portal',      initApp],  // tutor es un docente con grupo_tutoria asignado
    'subdirector':  ['subdir-portal',   subdirInit],
    'coordinador':  ['coord-portal',    () => { coordPortalInit(); if(typeof coordInit==='function') coordInit(); }],
    'prefecto':     ['pref-portal',     () => { if(typeof prefInit==='function') prefInit(); }],
    'orientador':   ['orientador-portal', () => { if(typeof orientadorInit==='function') orientadorInit(); }],
    'medico':       ['medico-portal',  () => { if(typeof medicoInit==='function') medicoInit(); }],
    'alumno':       [null, alumnoAbrirPortal],
    'superadmin':   [null, () => { window.location.href = _URL_PORTAL_ADMIN; }],
  };
  const entry = mapa[rol];
  if (!entry) {
    console.warn('[SIEMBRA] Rol desconocido:', rol);
    const errEl = document.getElementById('hub-error');
    if (errEl) { errEl.textContent = 'Rol no reconocido. Contacta a la secretaría.'; errEl.style.display = 'block'; }
    return;
  }
  // Ocultar hub-login y TODOS los portales antes de mostrar el nuevo
  const hubEl = document.getElementById('hub-login');
  if (hubEl) hubEl.style.display = 'none';
  const TODOS_PORTALES = [
    'doc-portal','dir-portal','admin-portal','padre-portal','ts-portal',
    'contralor-portal','subdir-portal','coord-portal','pref-portal',
    'orientador-portal','medico-portal',
  ];
  TODOS_PORTALES.forEach(pid => {
    const pe = document.getElementById(pid);
    if (pe) pe.style.display = 'none';
  });

  const [portalId, initFn] = entry;
  if (portalId) {
    const el = document.getElementById(portalId);
    if (el) {
      // portales con layout flex interno usan display:block en el contenedor raíz
      const BLOCK_PORTALS = ['admin-portal','contralor-portal','pref-portal',
                             'orientador-portal','medico-portal','subdir-portal','coord-portal'];
      el.style.display = BLOCK_PORTALS.includes(portalId) ? 'block' : 'flex';
    }
  }
  // Sincronizar window.currentPerfil antes de llamar al init
  // para que los portales que dependen de window.currentPerfil lo encuentren
  if (currentPerfil) window.currentPerfil = currentPerfil;
  if (typeof initFn === 'function') initFn();
}

// Subdirector portal -> app/portals/portal-subdirector.js
// Coordinador portal -> app/portals/portal-coordinador.js
// Admin: materias por docente, CSV, documentos -> app/portals/portal-admin.js
// Mobile sidebar + Portal Familia -> app/portals/portal-familia.js