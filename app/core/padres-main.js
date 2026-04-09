
// ── Ciclo activo desde config_global ──────────
(async () => {
  try {
    if (sbHub) {
      const { data } = await sbHub.from('config_global')
        .select('valor').eq('clave','ciclo_activo').maybeSingle();
      if (data?.valor) {
        window.CICLO_ACTIVO = data.valor;
        localStorage.setItem('siembra_ciclo', data.valor);
      }
    }
  } catch(e) { console.warn('[padres] ciclo:', e.message); }
})();

// ── Estado global ─────────────────────────
let currentUser    = null;
let currentPerfil  = null;   // usuario padre
let hijosData      = [];     // array de alumnos vinculados
let hijoActivo     = null;   // alumno seleccionado
let calificaciones = [];
let asistencias    = [];
let preguntaRespondida = false;
let chartRadar     = null;

Object.defineProperties(window, {
  currentUser: {
    configurable: true,
    get: () => currentUser,
    set: (value) => { currentUser = value; },
  },
  currentPerfil: {
    configurable: true,
    get: () => currentPerfil,
    set: (value) => { currentPerfil = value; },
  },
});

// ─── PREGUNTAS DEL DÍA ───────────────────
const PREGUNTAS_DIA = [
  {
    texto: "¿Cuántos minutos al día dedica a leer en casa?",
    opciones: ["0 minutos", "15 minutos", "30 minutos", "Más de 1 hora"],
    correcta: 3,
    feedback: "¡Excelente hábito! Leer 30 minutos diarios mejora la comprensión lectora hasta un 40% según la SEP. Inténtalo esta semana."
  },
  {
    texto: "¿A qué hora se duerme tu hij@ entre semana?",
    opciones: ["Antes de las 9pm", "9 a 10pm", "10 a 11pm", "Después de las 11pm"],
    correcta: 1,
    feedback: "Los niños en edad escolar necesitan entre 9 y 11 horas de sueño para rendir mejor en la escuela."
  },
  {
    texto: "¿Revisa contigo la tarea antes de entregarla?",
    opciones: ["Casi nunca", "A veces", "Casi siempre", "Siempre"],
    correcta: 3,
    feedback: "Revisar la tarea juntos refuerza el aprendizaje y fortalece el vínculo. Dedica 10 minutos cada noche."
  },
  {
    texto: "¿Con qué frecuencia hablan sobre lo que aprendió en la escuela?",
    opciones: ["Nunca", "Una vez a la semana", "Algunos días", "Todos los días"],
    correcta: 3,
    feedback: "Platicar sobre la escuela activa la memoria activa de tu hij@ y le ayuda a conectar lo aprendido con la vida real."
  },
  {
    texto: "¿Desayuna antes de ir a la escuela?",
    opciones: ["Casi nunca", "A veces sí", "Casi siempre", "Siempre desayuna"],
    correcta: 3,
    feedback: "El desayuno es el combustible del cerebro. Los estudiantes que desayunan tienen mejor concentración y memoria."
  }
];

// ─── LOGROS DEMO ──────────────────────────
const LOGROS = [
  { icon: "🌟", name: "Primera semana", earned: true },
  { icon: "📚", name: "Lector activo", earned: true },
  { icon: "🎯", name: "Sin faltas", earned: false },
  { icon: "🏆", name: "Top 10", earned: false },
  { icon: "💪", name: "Mejoró Mates", earned: true },
  { icon: "🔥", name: "Racha 7 días", earned: false },
  { icon: "✅", name: "Tareas al día", earned: false },
  { icon: "👑", name: "Mejor bimestre", earned: false },
];

// ─── INIT ─────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  if (window.SiembraPadresAuth?.bootstrapPadresSession) {
    await window.SiembraPadresAuth.bootstrapPadresSession();
    return;
  }
  window.SIEMBRA_RUNTIME?.setVisible?.('padres-demo-wrap', !!window.SIEMBRA_RUNTIME?.shouldAllowDemoEntry?.(), 'flex');
  // ── Verificar token de invitación en URL ──
  const _urlParams = new URLSearchParams(location.search);
  const _inviteToken = _urlParams.get('invite') || _urlParams.get('token');
  if (_inviteToken) {
    history.replaceState({}, '', location.pathname);
    ocultarLoading();
    mostrarRegistroConToken(_inviteToken);
    return;
  }
  // Si hay sesión activa → mostrar app shell primero, luego cargar datos
  // Si no hay sesión → mostrar login (nunca saltar directo a vinculación)
  try {
    if (sbHub) {
      const { data: { session } } = await sbHub.auth.getSession();
      if (session) {
        currentUser = session.user;
        // Mostrar app antes de cargar datos: evita que _padresMostrarPantallaVinculacion
        // reemplace el #app cuando aún está oculto, lo que hacía que se viera de golpe
        // sin header ni contexto — parecía el flujo de registro en vez del de sesión activa
        await cargarPerfil();
        setTimeout(() => mostrarApp(), 400);
        // Arrancar watcher de sesión
        if (window.SIEMBRA?.sessionWatcher) window.SIEMBRA.sessionWatcher.start();
        return;
      }
    }
  } catch(e) { console.warn('Session check error:', e); }
  // Sin sesión → siempre ir al login, nunca a vinculación directa
  setTimeout(() => { ocultarLoading(); mostrarLogin(); }, 400);
});

function ocultarLoading() {
  const ls = document.getElementById('loading-screen');
  ls.style.opacity = '0';
  setTimeout(() => ls.style.display = 'none', 400);
}

function mostrarLogin() {
  document.getElementById('login-screen').style.display = 'flex';
}

// ── Registro con token de invitación ──────────────────────────────
async function mostrarRegistroConToken(token) {
  // Verificar que el token sea válido
  let inv = null;
  try {
    if (sbHub) {
      const { data } = await sbHub.from('invitaciones')
        .select('*').eq('token', token).maybeSingle();
      inv = data;
    }
  } catch(e) {}

  const loginScreen = document.getElementById('login-screen');
  if (!loginScreen) { mostrarLogin(); return; }

  loginScreen.style.display = 'flex';

  if (!inv || inv.estado === 'usado') {
    loginScreen.innerHTML = `
      <div class="login-logo">SIEM<span>BRA</span></div>
      <div class="login-card" style="text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">${inv?.estado==='usado' ? '⚠️' : '❌'}</div>
      <div class="login-title">${inv?.estado==='usado' ? 'Invitacion ya usada' : 'Invitacion invalida'}</div>
      <div class="login-hint" style="margin-top:8px;">${inv?.estado==='usado' ? 'Esta invitacion ya fue utilizada. Inicia sesion si ya tienes cuenta.' : 'Este link no es valido o ha expirado. Contacta a la escuela.'}</div>
      <button class="btn-primary" style="margin-top:20px;" onclick="document.getElementById('login-screen').innerHTML='';mostrarLogin();">Ir al inicio de sesion →</button>
      </div>`;
    return;
  }

  const nombrePre = inv.nombre_destino || '';
  const emailPre  = inv.email_destino  || '';

  loginScreen.innerHTML = `
    <div class="login-logo">SIEM<span>BRA</span></div>
    <div class="login-sub">Portal para familias</div>
    <div class="login-card">
      <div class="login-title">🎉 Bienvenido/a</div>
      <div class="login-hint">La escuela te invito a SIEMBRA. Crea tu cuenta para ver el progreso de tu hijo/a.</div>
      <input class="form-input" type="text"     id="reg-nombre" placeholder="Tu nombre completo"  value="${nombrePre}" style="margin-top:16px;">
      <input class="form-input" type="email"    id="reg-email"  placeholder="tu@correo.com"        value="${emailPre}"  style="margin-top:10px;" ${emailPre?'readonly':''}> 
      <input class="form-input" type="password" id="reg-pass"   placeholder="Crea una contrasena (min. 8 caracteres)" style="margin-top:10px;">
      <input class="form-input" type="password" id="reg-pass2"  placeholder="Repite la contrasena" style="margin-top:10px;">
      <button class="btn-primary" id="btn-reg" onclick="registrarConToken('${token}')" style="margin-top:16px;">Crear mi cuenta →</button>
      <div class="login-error" id="reg-error" style="display:none;"></div>
    </div>`;
}

async function registrarConToken(token) {
  const nombre = document.getElementById('reg-nombre')?.value.trim();
  const email  = document.getElementById('reg-email')?.value.trim().toLowerCase();
  const pass   = document.getElementById('reg-pass')?.value;
  const pass2  = document.getElementById('reg-pass2')?.value;
  const errEl  = document.getElementById('reg-error');
  const btn    = document.getElementById('btn-reg');

  const showErr = (msg) => { if(errEl){errEl.textContent=msg;errEl.style.display='block';} };

  if (!nombre)           return showErr('Ingresa tu nombre completo.');
  if (!email)            return showErr('Ingresa tu correo.');
  if (pass.length < 8)   return showErr('La contrasena debe tener al menos 8 caracteres.');
  if (pass !== pass2)    return showErr('Las contrasenas no coinciden.');

  if (btn) { btn.textContent = '⏳ Creando cuenta…'; btn.disabled = true; }

  try {
    const result = await SIEMBRA.auth.registrarConToken(token, nombre, email, pass);
    if (result.error) throw result.error;

    // Login automático
    const loginResult = await SIEMBRA.auth.login(email, pass);
    if (loginResult.error) throw loginResult.error;

    currentUser   = window.currentUser;
    currentPerfil = window.currentPerfil;
    ocultarLoading();
    await cargarPerfil();
    mostrarApp();
  } catch(e) {
    showErr((e.message || 'Error al crear la cuenta.'));
    if (btn) { btn.textContent = 'Crear mi cuenta →'; btn.disabled = false; }
  }
}

async function cargarPerfil() {
  try {
    if (!sbHub || !currentUser) return;
    const { data } = await sbHub.from('usuarios')
      .select('*').eq('auth_id', currentUser.id).single();
    if (data) currentPerfil = data;
    await cargarHijos();
  } catch(e) { console.warn('Error cargando perfil:', e); }
}

async function cargarHijos() {
  hijosData = [];
  if (!currentPerfil || !sbHub) {
    hijoActivo = { id: currentPerfil?.id, nombre: currentPerfil?.nombre || 'Mi hijo', apellido: '', grupo: '—' };
    return;
  }

  try {
    // 1. Buscar hijos vinculados via padres_alumnos
    const { data: vincPA } = await sbHub.from('padres_alumnos')
      .select('alumno_id, activo, usuarios!alumno_id(id,nombre,apellido_p,apellido_m,fecha_nac,escuela_cct,alumnos_grupos(grupo_id,grupos(nombre,grado,seccion)))')
      .eq('padre_id', currentPerfil.id).eq('activo', true);

    if (vincPA?.length) {
      hijosData = vincPA.map(v => {
        const u = v.usuarios;
        if (!u) return null;
        const grp = u.alumnos_grupos?.[0]?.grupos;
        return { ...u, apellido: `${u.apellido_p||''} ${u.apellido_m||''}`.trim(), grupo: grp?.nombre || `${grp?.grado||''}°${grp?.seccion||''}` || '—' };
      }).filter(Boolean);
    }

    // 2. Fallback: buscar via vinculos_padre (código de vinculación)
    if (!hijosData.length) {
      const { data: vincVP } = await sbHub.from('vinculos_padre')
        .select('alumno_id, usuarios!alumno_id(id,nombre,apellido_p,apellido_m,fecha_nac,escuela_cct,alumnos_grupos(grupo_id,grupos(nombre,grado,seccion)))')
        .eq('padre_id', currentPerfil.id);

      if (vincVP?.length) {
        hijosData = vincVP.map(v => {
          const u = v.usuarios;
          if (!u) return null;
          const grp = u.alumnos_grupos?.[0]?.grupos;
          return { ...u, apellido: `${u.apellido_p||''} ${u.apellido_m||''}`.trim(), grupo: grp?.nombre || `${grp?.grado||''}°${grp?.seccion||''}` || '—' };
        }).filter(Boolean);
      }
    }

    // 3. Fallback: buscar via invitaciones (email del padre + alumno_id guardado al crear el alumno)
    if (!hijosData.length && currentUser?.email) {
      const { data: invPadre } = await sbHub.from('invitaciones')
        .select('alumno_id, escuela_id')
        .eq('email_destino', currentUser.email.toLowerCase().trim())
        .eq('rol', 'padre')
        .not('alumno_id', 'is', null)
        .limit(5);

      if (invPadre?.length) {
        for (const inv of invPadre) {
          if (!inv.alumno_id) continue;
          // Crear vínculo si no existe
          const { data: yaVinc } = await sbHub.from('padres_alumnos')
            .select('id').eq('padre_id', currentPerfil.id).eq('alumno_id', inv.alumno_id).maybeSingle();
          if (!yaVinc) {
            await sbHub.from('padres_alumnos').insert({
              padre_id:   currentPerfil.id,
              alumno_id:  inv.alumno_id,
              escuela_id: inv.escuela_id || null,
              activo:     true,
            }).catch(()=>{});
          }
          // Cargar datos del alumno
          const { data: alumnoU } = await sbHub.from('usuarios')
            .select('id,nombre,apellido_p,apellido_m,fecha_nac,escuela_cct,alumnos_grupos(grupo_id,grupos(nombre,grado,seccion))')
            .eq('id', inv.alumno_id).maybeSingle();
          if (alumnoU) {
            const grp = alumnoU.alumnos_grupos?.[0]?.grupos;
            hijosData.push({ ...alumnoU, apellido: `${alumnoU.apellido_p||''} ${alumnoU.apellido_m||''}`.trim(), grupo: grp?.nombre || `${grp?.grado||''}°${grp?.seccion||''}` || '—' });
          }
        }
      }
    }

    // 4. Fallback: buscar en fichas_inscripcion por email_tutor (admin capturó el correo al dar de alta)
    if (!hijosData.length && currentUser?.email) {
      const emailNorm = currentUser.email.toLowerCase().trim();
      const { data: fichas } = await sbHub.from('fichas_inscripcion')
        .select('alumno_id')
        .eq('email_tutor', emailNorm)
        .not('alumno_id', 'is', null)
        .limit(5);

      if (fichas?.length) {
        for (const f of fichas) {
          // Crear vínculo permanente
          await sbHub.from('padres_alumnos').upsert({
            padre_id:  currentPerfil.id,
            alumno_id: f.alumno_id,
            activo:    true,
          }, { onConflict: 'padre_id,alumno_id' }).catch(()=>{});
          // Cargar datos del alumno
          const { data: au } = await sbHub.from('usuarios')
            .select('id,nombre,apellido_p,apellido_m,fecha_nac,escuela_cct,alumnos_grupos(grupo_id,grupos(nombre,grado,seccion))')
            .eq('id', f.alumno_id).maybeSingle();
          if (au) {
            const grp = au.alumnos_grupos?.[0]?.grupos;
            hijosData.push({ ...au, apellido: `${au.apellido_p||''} ${au.apellido_m||''}`.trim(), grupo: grp?.nombre || `${grp?.grado||''}°${grp?.seccion||''}` || '—' });
          }
        }
      }
    }

    // 5. Si aún no hay → intentar vinculación automática por nombre + fecha de nacimiento
    if (!hijosData.length) {
      await _padreIntentarVinculacionAuto();
    }

  } catch(e) { console.warn('[Padre] cargarHijos:', e.message); }

  if (hijosData.length > 0) {
    hijoActivo = hijosData[0];
    if (hijosData.length > 1) renderHijoSelector();
  } else {
    // Sin hijos vinculados — mostrar pantalla de vinculación DENTRO de la app
    // (no antes de mostrarApp, para que el header y contexto estén visibles)
    _padresMostrarPantallaVinculacion();
  }
}

async function _padreIntentarVinculacionAuto() {
  if (!currentPerfil || !sbHub) return;
  // Buscar si hay solicitud pendiente
  const { data: solPend } = await sbHub.from('solicitudes_vinculacion')
    .select('*').eq('padre_id', currentPerfil.id).neq('estado','rechazada').maybeSingle();
  if (solPend) {
    window._solicitudVinculacion = solPend;
    return; // Ya hay solicitud, esperar aprobación
  }
  // No hay solicitud → mostrar form para buscar hijo
  window._solicitudVinculacion = null;
}

function _padresMostrarPantallaVinculacion() {
  const contentEl = document.getElementById('app-content');
  if (!contentEl) return;

  // Verificar si hay solicitud de vinculación pendiente (flujo antiguo)
  const sol = window._solicitudVinculacion;
  if (sol && sol.estado === 'pendiente') {
    contentEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;min-height:60vh;font-family:var(--font-body);">
        <div style="background:white;border-radius:24px;padding:28px;width:100%;max-width:380px;box-shadow:0 4px 24px rgba(0,0,0,.09);text-align:center;">
          <div style="font-size:52px;margin-bottom:14px;">⏳</div>
          <div style="font-size:18px;font-weight:800;color:#0d1a0f;margin-bottom:8px;">Solicitud en revisión</div>
          <div style="font-size:13px;color:#64748b;line-height:1.6;">Tu solicitud de vinculación con <strong>${sol.nombre_buscado||'tu hijo/a'}</strong> está siendo revisada por la escuela.</div>
          <div style="margin-top:16px;padding:10px;background:#fef9c3;border-radius:10px;font-size:12px;color:#a16207;">Recibirás una notificación cuando sea aprobada.</div>
          <button onclick="location.reload()" style="margin-top:18px;padding:11px 24px;background:#0d5c2f;color:white;border:none;border-radius:12px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;width:100%;">🔄 Verificar estado</button>
        </div>
      </div>`;
    return;
  }

  // Sin hijos vinculados y sin solicitud pendiente → estado de espera claro
  contentEl.innerHTML = `
    <div style="padding:30px 20px;font-family:var(--font-body);text-align:center;max-width:400px;margin:0 auto;">
      <div style="font-size:64px;margin-bottom:18px;">🌱</div>
      <div style="font-size:20px;font-weight:800;color:#0d1a0f;margin-bottom:8px;">Cuenta creada</div>
      <div style="font-size:14px;color:#64748b;line-height:1.7;margin-bottom:24px;">
        Aún no hay alumnos vinculados a tu cuenta.<br>
        Cuando la escuela confirme la relación familiar, aquí verás el progreso, mensajes y seguimiento escolar.
      </div>

      <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:16px;padding:20px;margin-bottom:16px;text-align:left;">
        <div style="font-size:13px;font-weight:700;color:#15803d;margin-bottom:10px;">✅ ¿Ya tienes un código de vinculación?</div>
        <div style="font-size:12px;color:#166534;margin-bottom:12px;">La escuela pudo haberte enviado un código por correo o en papel.</div>
        <input id="vinc-codigo-rapido" type="text" placeholder="Ingresa el código ej: 3E6PG8"
          style="width:100%;padding:10px 14px;border:1.5px solid #86efac;border-radius:10px;font-family:inherit;font-size:14px;outline:none;text-transform:uppercase;box-sizing:border-box;margin-bottom:10px;"
          oninput="this.value=this.value.toUpperCase()">
        <button onclick="_padresUsarCodigoRapido()" style="width:100%;padding:11px;background:#0d5c2f;color:white;border:none;border-radius:10px;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer;">
          🔑 Usar código
        </button>
        <div id="vinc-cod-error" style="color:#dc2626;font-size:12px;margin-top:8px;display:none;"></div>
      </div>

      <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:16px;padding:20px;text-align:left;">
        <div style="font-size:13px;font-weight:700;color:#1d4ed8;margin-bottom:10px;">📥 ¿No tienes código?</div>
        <div style="font-size:12px;color:#1e40af;margin-bottom:12px;">Envía una solicitud y el administrador de la escuela aprobará tu acceso.</div>
        <button onclick="showSolicitudAcceso()" style="width:100%;padding:11px;background:#1d4ed8;color:white;border:none;border-radius:10px;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer;">
          📩 Solicitar vinculación
        </button>
      </div>

      <button onclick="doLogout()" style="margin-top:20px;background:none;border:none;font-size:12px;color:#94a3b8;cursor:pointer;font-family:inherit;">Cerrar sesión</button>
    </div>`;
}

async function _padresUsarCodigoRapido() {
  const codigo = (document.getElementById('vinc-codigo-rapido')?.value || '').trim().toUpperCase();
  const errEl  = document.getElementById('vinc-cod-error');
  const btn    = document.querySelector('[onclick="_padresUsarCodigoRapido()"]');
  const showErr = msg => { if(errEl){ errEl.textContent=msg; errEl.style.display='block'; } };

  if (!codigo) { showErr('Ingresa el código'); return; }
  if (btn) { btn.textContent='⏳ Verificando…'; btn.disabled=true; }
  if (errEl) errEl.style.display='none';

  try {
    const { data: vinc } = await sbHub.from('vinculos_padre')
      .select('*, usuarios!alumno_id(id,nombre,apellido_p,apellido_m,alumnos_grupos(grupos(nombre,grado,seccion)))')
      .eq('codigo', codigo).eq('usado', false).maybeSingle();

    if (!vinc) { showErr('❌ Código inválido o ya utilizado. Verifica con la escuela.'); if(btn){btn.textContent='🔑 Usar código';btn.disabled=false;} return; }

    await sbHub.from('vinculos_padre').update({ usado: true, padre_id: currentPerfil.id }).eq('id', vinc.id);
    await sbHub.from('padres_alumnos').upsert({
      padre_id: currentPerfil.id, alumno_id: vinc.alumno_id, activo: true
    }, { onConflict: 'padre_id,alumno_id' });

    showToast('✅ ¡Vinculación exitosa!');
    await cargarHijos();
    mostrarApp();
  } catch(e) {
    showErr('❌ ' + e.message);
    if(btn){btn.textContent='🔑 Usar código';btn.disabled=false;}
  }
}

async function _padresEnviarSolicitudVinculacion() {
  const nombre  = document.getElementById('vinc-nombre')?.value.trim();
  const fecha   = document.getElementById('vinc-fecha')?.value;
  const codigo  = document.getElementById('vinc-codigo')?.value.trim().toUpperCase();
  const errEl   = document.getElementById('vinc-error');
  const btn     = document.getElementById('vinc-btn');
  const showErr = msg => { if(errEl){errEl.textContent=msg;errEl.style.display='block';} };

  // Flujo 1: código de vinculación directo
  if (codigo && sbHub) {
    if(btn){btn.textContent='⏳ Verificando…';btn.disabled=true;}
    try {
      const { data: vinc } = await sbHub.from('vinculos_padre')
        .select('*, usuarios!alumno_id(id,nombre,apellido_p,apellido_m,alumnos_grupos(grupos(nombre,grado,seccion)))')
        .eq('codigo', codigo).eq('usado', false).maybeSingle();

      if (!vinc) { showErr('❌ Código inválido o ya utilizado.'); if(btn){btn.textContent='🔍 Buscar y vincular';btn.disabled=false;} return; }

      // Vincular
      await sbHub.from('vinculos_padre').update({ usado: true, padre_id: currentPerfil.id }).eq('id', vinc.id);
      await sbHub.from('padres_alumnos').upsert({
        padre_id: currentPerfil.id, alumno_id: vinc.alumno_id, activo: true
      }, { onConflict: 'padre_id,alumno_id' });

      // Recargar app
      await cargarHijos();
      mostrarApp();
      return;
    } catch(e) { showErr('❌ '+e.message); if(btn){btn.textContent='🔍 Buscar y vincular';btn.disabled=false;} return; }
  }

  if (!nombre) { showErr('⚠️ Ingresa el nombre del alumno.'); return; }

  if(btn){btn.textContent='⏳ Buscando…';btn.disabled=true;}

  try {
    // Buscar alumno por nombre (fuzzy)
    const partes = nombre.toUpperCase().split(/\s+/);
    const nombreBuscar = partes[0] || '';
    const apellidoBuscar = partes[1] || '';

    let q = sbHub.from('usuarios').select('id,nombre,apellido_p,apellido_m,fecha_nac,escuela_cct')
      .eq('rol','alumno').eq('activo',true)
      .ilike('nombre', `%${nombreBuscar}%`);
    if (apellidoBuscar) q = q.ilike('apellido_p', `%${apellidoBuscar}%`);

    const { data: candidatos } = await q.limit(10);

    // Calcular similitud
    let mejorMatch = null, mejorScore = 0;
    (candidatos||[]).forEach(c => {
      let score = 0;
      const nomC = `${c.nombre||''} ${c.apellido_p||''} ${c.apellido_m||''}`.toLowerCase();
      const nomB = nombre.toLowerCase();
      if (nomC.includes(nomB.split(' ')[0]?.toLowerCase())) score += 30;
      if (nomC.includes(nomB.split(' ')[1]?.toLowerCase()||'X')) score += 30;
      if (fecha && c.fecha_nac && c.fecha_nac.startsWith(fecha)) score += 40;
      if (score > mejorScore) { mejorScore = score; mejorMatch = c; }
    });

    if (mejorScore >= 70 && mejorMatch) {
      // Coincidencia alta → vincular automáticamente
      await sbHub.from('padres_alumnos').upsert({
        padre_id: currentPerfil.id, alumno_id: mejorMatch.id, activo: true
      }, { onConflict: 'padre_id,alumno_id' });
      await cargarHijos();
      mostrarApp();
    } else if (mejorScore >= 40 && mejorMatch) {
      // Coincidencia media → solicitud pendiente para admin
      try {
        await sbHub.from('solicitudes_vinculacion').insert({
          padre_id:      currentPerfil.id,
          alumno_id:     mejorMatch.id,
          nombre_buscado: nombre,
          fecha_nac_buscada: fecha || null,
          escuela_id:    null,
          estado:        'pendiente',
          similitud:     mejorScore,
        });
      } catch(_) {}
      window._solicitudVinculacion = { estado: 'pendiente', nombre_buscado: nombre };
      _padresMostrarPantallaVinculacion();
    } else {
      // Sin coincidencia → solicitud manual
      try {
        await sbHub.from('solicitudes_vinculacion').insert({
          padre_id:         currentPerfil.id,
          nombre_buscado:   nombre,
          fecha_nac_buscada: fecha || null,
          estado:           'pendiente',
          similitud:        0,
        });
      } catch(_) {}
      window._solicitudVinculacion = { estado: 'pendiente', nombre_buscado: nombre };
      _padresMostrarPantallaVinculacion();
    }
  } catch(e) {
    showErr('❌ '+e.message);
    if(btn){btn.textContent='🔍 Buscar y vincular';btn.disabled=false;}
  }
}
window._padresEnviarSolicitudVinculacion = _padresEnviarSolicitudVinculacion;

function mostrarApp() {
  ocultarLoading();
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  renderHeader();
  renderStreak();
  cargarVista('inicio');
  setTimeout(padreIniciarRealtime, 800);
  setTimeout(cfdiCargarRfcs, 1200);  // Pre-cargar RFCs del padre
}

// ══════════════════════════════════════════════════════════════════
// REALTIME SUBSCRIPTIONS — padres.html
// ══════════════════════════════════════════════════════════════════
function padreIniciarRealtime() {
  const sb = window.sbHub;
  if (!sb || !currentPerfil?.id) return;
  const alumnoId = hijoActivo?.id;
  const padreId  = currentPerfil.id;
  const grupoId  = hijoActivo?.grupo_id || hijoActivo?.grupo;
  const cct      = currentPerfil.escuela_cct || hijoActivo?.escuela_cct;

  // 1. Inasistencia → notificación inmediata al padre
  if (alumnoId) {
    window.SIEMBRA?.realtime?.subscribe('padre-asistencia-' + alumnoId, {
      event: 'INSERT',
      table: 'asistencia',
      filter: `alumno_id=eq.${alumnoId}`,
      onMessage: (payload) => {
        const est = payload.new?.estado;
        if (est && ['ausente','falta','F'].includes(est))
          showToast('⚠️ ' + (hijoActivo?.nombre || 'Tu hijo') + ' fue registrado como ausente hoy');
      },
    });
  }

  // 2. Nuevo cargo de colegiatura
  if (alumnoId) {
    window.SIEMBRA?.realtime?.subscribe('padre-pagos-' + alumnoId, {
      event: 'INSERT',
      table: 'pagos_colegiatura',
      filter: `alumno_id=eq.${alumnoId}`,
      onMessage: (payload) => {
        const m = payload.new?.monto ? ' · $' + Number(payload.new.monto).toLocaleString('es-MX') : '';
        showToast('💳 Nuevo cargo registrado' + m);
      },
    });
  }

  // 3. Nueva tarea asignada al grupo
  if (grupoId) {
    window.SIEMBRA?.realtime?.subscribe('padre-tareas-grupo-' + grupoId, {
      event: 'INSERT',
      table: 'tareas_docente',
      filter: `grupo_id=eq.${grupoId}`,
      onMessage: (payload) => {
        showToast('📋 Nueva tarea: ' + (payload.new?.titulo || 'sin título'));
      },
    });
  }

  // 4. Anuncios escolares
  if (cct) {
    window.SIEMBRA?.realtime?.subscribe('padre-anuncios-' + cct, {
      event: 'INSERT',
      table: 'anuncios',
      filter: `escuela_cct=eq.${cct}`,
      onMessage: (payload) => {
        showToast('📢 ' + (payload.new?.titulo || 'Nuevo aviso de la escuela'));
      },
    });
  }

  // 5. Feedback de evidencias del hijo
  if (alumnoId) {
    window.SIEMBRA?.realtime?.subscribe('padre-evidencias-' + alumnoId, {
      event: 'UPDATE',
      table: 'evidencias',
      filter: `alumno_id=eq.${alumnoId}`,
      onMessage: (payload) => {
        const est = payload.new?.estado;
        const nom = hijoActivo?.nombre || 'tu hijo';
        if (est === 'aprobada') showToast('✅ Una evidencia de ' + nom + ' fue aprobada');
        else if (est === 'rechazada') showToast('📝 El docente revisó una evidencia de ' + nom);
      },
    });
  }
}

// ══════════════════════════════════════════════════════════════════
// BLOQUE B — CFDI / FACTURACIÓN SAT para padres
// ══════════════════════════════════════════════════════════════════
let _rfcsDelPadre = [];

async function cfdiCargarRfcs() {
  if (!sbHub || !currentPerfil?.id) return;
  try {
    const { data } = await sbHub.from('parent_rfcs')
      .select('id,rfc,nombre_fiscal,empresa_nombre,es_predeterminado')
      .eq('user_id', currentPerfil.id).eq('activo', true)
      .order('es_predeterminado', { ascending: false });
    _rfcsDelPadre = data || [];
  } catch(e) { _rfcsDelPadre = []; }
}

function cfdiToggle() {
  const checked = document.getElementById('cfdi-check')?.checked;
  const panel   = document.getElementById('cfdi-rfc-panel');
  if (!panel) return;
  panel.style.display = checked ? 'block' : 'none';
  if (checked) cfdiRenderSelectRfc();
}

function cfdiRenderSelectRfc() {
  const sel = document.getElementById('cfdi-rfc-select');
  if (!sel) return;
  if (!_rfcsDelPadre.length) {
    cfdiCargarRfcs().then(() => cfdiRenderSelectRfc());
    return;
  }
  sel.innerHTML = _rfcsDelPadre.map(r =>
    `<option value="${r.rfc}">${r.rfc} · ${r.empresa_nombre || r.nombre_fiscal}</option>`
  ).join('') + '<option value="">Sin factura</option>';
  // Pre-seleccionar predeterminado
  const pred = _rfcsDelPadre.find(r => r.es_predeterminado);
  if (pred) sel.value = pred.rfc;
}

function cfdiObtenerRfcSeleccionado() {
  const check = document.getElementById('cfdi-check');
  if (!check?.checked) return null;
  return document.getElementById('cfdi-rfc-select')?.value || null;
}

function cfdiAgregarRfc() {
  // Mostrar formulario inline para agregar RFC
  const panel = document.getElementById('cfdi-rfc-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px;">
      <input id="cfdi-new-rfc"    type="text" placeholder="RFC (ej. GALO900101AB3)" maxlength="13"
        style="padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;outline:none;text-transform:uppercase;">
      <input id="cfdi-new-nombre" type="text" placeholder="Nombre fiscal exacto (según SAT)"
        style="padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;outline:none;">
      <input id="cfdi-new-regimen" type="text" placeholder="Régimen fiscal (ej. 612)"  maxlength="3"
        style="padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;outline:none;">
      <input id="cfdi-new-cp"     type="text" placeholder="Código postal fiscal (SAT)" maxlength="5"
        style="padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;outline:none;">
      <input id="cfdi-new-empresa" type="text" placeholder="Nombre empresa (opcional)"
        style="padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;outline:none;">
      <button onclick="cfdiGuardarRfc()" style="padding:10px;background:#0a5c2e;color:white;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">💾 Guardar RFC</button>
    </div>`;
}

async function cfdiGuardarRfc() {
  const rfc     = (document.getElementById('cfdi-new-rfc')?.value || '').trim().toUpperCase();
  const nombre  = (document.getElementById('cfdi-new-nombre')?.value || '').trim();
  const regimen = (document.getElementById('cfdi-new-regimen')?.value || '612').trim();
  const cp      = (document.getElementById('cfdi-new-cp')?.value || '').trim();
  const empresa = (document.getElementById('cfdi-new-empresa')?.value || '').trim();

  if (!rfc || rfc.length < 12)  { showToast('⚠️ RFC inválido (12-13 caracteres)', 'warn'); return; }
  if (!nombre)                   { showToast('⚠️ Ingresa el nombre fiscal', 'warn'); return; }
  if (!cp || cp.length !== 5)    { showToast('⚠️ CP fiscal debe tener 5 dígitos', 'warn'); return; }

  if (sbHub && currentPerfil?.id) {
    try {
      await sbHub.from('parent_rfcs').upsert({
        user_id: currentPerfil.id, rfc, nombre_fiscal: nombre,
        regimen_fiscal: regimen, domicilio_fiscal: cp, empresa_nombre: empresa,
        es_predeterminado: _rfcsDelPadre.length === 0,
      }, { onConflict: 'user_id,rfc' });
      showToast('✅ RFC guardado');
      await cfdiCargarRfcs();
      cfdiRenderSelectRfc();
    } catch(e) { showToast('❌ ' + e.message, 'warn'); }
  }
}

// Inicializar RFCs al cargar la app
window.cfdiToggle      = cfdiToggle;
window.cfdiAgregarRfc  = cfdiAgregarRfc;
window.cfdiGuardarRfc  = cfdiGuardarRfc;

// ─── HEADER ───────────────────────────────
function renderHeader() {
  if (!hijoActivo) return;
  const nombre = (hijoActivo.nombre || '') + ' ' + (hijoActivo.apellido || '');
  const padreNombre = currentPerfil?.nombre || 'Familia';
  document.getElementById('child-greeting').textContent = `Hola, ${padreNombre} 👋`;
  document.getElementById('child-name').textContent = nombre.trim() || 'Tu hij@';
  document.getElementById('child-group').textContent = hijoActivo.grupo || hijoActivo.grado_asignado || '—';
  const inicial = nombre.trim().charAt(0).toUpperCase();
  document.getElementById('child-avatar').textContent = inicial || '👦';
  // XP: buscar en db o demo
  cargarXP();
}

async function cargarXP() {
  // Demo mode: mostrar puntos del perfil demo
  if (window._demoMode) {
    document.getElementById('header-xp').textContent = '620';
    return;
  }
  try {
    if (sbHub && hijoActivo?.id) {
      const { data } = await sbHub.from('perfil_alumno')
        .select('xp_total, racha_dias')
        .eq('alumno_id', hijoActivo.id)
        .single();
      if (data) {
        document.getElementById('header-xp').textContent = data.xp_total ?? '0';
        return;
      }
    }
  } catch(e) {}
  document.getElementById('header-xp').textContent = '0';
}

// ─── SELECTOR DE HIJOS ────────────────────
function renderHijoSelector() {
  const sel = document.getElementById('hijo-selector');
  sel.style.display = 'flex';
  sel.innerHTML = hijosData.map((h, i) =>
    `<div class="hijo-chip ${i===0?'active':''}" onclick="selectHijo(${i})">${h.nombre}</div>`
  ).join('');
}

function selectHijo(idx) {
  hijoActivo = hijosData[idx];
  document.querySelectorAll('.hijo-chip').forEach((c, i) =>
    c.classList.toggle('active', i === idx));
  renderHeader();
  cargarVista(activeTab);
}

// ─── RACHA / ASISTENCIA ───────────────────
async function renderStreak() {
  const dias = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  let registros = new Array(7).fill('miss');
  try {
    if (sbHub && hijoActivo?.id) {
      const hoy = new Date();
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
      const fechas = Array.from({length:7}, (_,i) => {
        const d = new Date(lunes); d.setDate(lunes.getDate() + i);
        return d.toISOString().split('T')[0];
      });
      const { data: asist } = await sbHub.from('asistencia')
        .select('fecha,estado')
        .eq('alumno_id', hijoActivo.id)
        .in('fecha', fechas);
      const todayStr = hoy.toISOString().split('T')[0];
      if (asist) {
        fechas.forEach((f, i) => {
          const reg = asist.find(a => a.fecha === f);
          if (f === todayStr) registros[i] = 'today';
          else if (reg?.estado === 'presente') registros[i] = 'done';
          else if (f < todayStr && !reg) registros[i] = 'miss';
          else registros[i] = 'miss';
        });
      }
    }
  } catch(e) {}

  const bar = document.getElementById('streak-bar');
  bar.innerHTML = dias.map((d,i) => `
    <div class="streak-day-pill ${registros[i]}">
      ${d}
      <span class="streak-label">${registros[i]==='done'?'✓':registros[i]==='today'?'⬤':'·'}</span>
    </div>
  `).join('');
}

// ── MÓDULO: BOLETA NEM (padres) ──
let _padreBolTrim = 2;

function padreSwitchTrim(t) {
  _padreBolTrim = t;
  [1,2,3].forEach(n => {
    const b = document.getElementById('blt-p-t'+n);
    if (!b) return;
    if (n === t) {
      b.style.background = 'var(--verde)'; b.style.borderColor = 'var(--verde)'; b.style.color = 'white';
    } else {
      b.style.background = 'white'; b.style.borderColor = '#d1d5db'; b.style.color = '#374151';
    }
  });
  cargarBoleta();
}

async function cargarBoleta() {
  const cont = document.getElementById('boleta-padre-contenido');
  if (!cont) return;

  const alumnoId = hijoActivo?.id;
  if (!alumnoId) {
    cont.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;"><div style="font-size:32px;margin-bottom:10px;">🔗</div><div style="font-weight:700;margin-bottom:6px;">Sin alumno vinculado</div><div style="font-size:13px;">Primero necesitas una vinculación aprobada por la escuela.</div></div>';
    return;
  }

  cont.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8;">⏳ Cargando…</div>';

  const ciclo = window.CICLO_ACTIVO || '2025-2026';
  const trim  = _padreBolTrim;

  try {
    if (!sbHub) throw new Error('sin conexión');

    // Datos del alumno
    const { data: alu } = await sbHub.from('usuarios')
      .select('id,nombre,apellido_p,apellido_m,curp,grado,escuela_cct,escuela_nombre')
      .eq('id', alumnoId).maybeSingle();

    // Calificaciones del trimestre
    const { data: cals } = await sbHub.from('calificaciones')
      .select('materia,trimestre,calificacion,campo_formativo')
      .eq('alumno_id', alumnoId)
      .eq('ciclo', ciclo)
      .eq('trimestre', trim);

    // Boleta guardada
    const { data: boleta } = await sbHub.from('boletas_nem')
      .select('obs_general,asistencias,inasist_j,inasist_i,folio')
      .eq('alumno_id', alumnoId).eq('ciclo', ciclo)
      .eq('periodo', `T${trim}`).maybeSingle();

    const nombre  = alu ? `${alu.nombre||''} ${alu.apellido_p||''} ${alu.apellido_m||''}`.trim() : hijoActivo?.nombre || '—';
    const curp    = alu?.curp || '—';
    const grado   = alu?.grado || hijoActivo?.grado_asignado || '—';
    const cct     = alu?.escuela_cct || currentPerfil?.escuela_cct || '—';
    const escuela = alu?.escuela_nombre || '—';
    const folio   = boleta?.folio || `${cct}-${ciclo.replace(/\D/g,'').slice(0,4)}-T${trim}`;

    // Agrupar por campo formativo
    const orden = ['Lenguajes','Saberes y Pensamiento Científico','Humanidades','Ética, Naturaleza y Sociedades','De lo Humano y lo Comunitario'];
    const campos = {};
    orden.forEach(k => { campos[k] = []; });
    (cals || []).forEach(c => {
      const k = c.campo_formativo || 'Lenguajes';
      if (!campos[k]) campos[k] = [];
      campos[k].push({ materia: c.materia, cal: parseFloat(c.calificacion) });
    });

    const calColor = n => n >= 9 ? '#16a34a' : n >= 7 ? '#2563eb' : n >= 6 ? '#d97706' : '#dc2626';

    const filasHtml = orden.map(campo => {
      const mats = campos[campo] || [];
      if (!mats.length) return '';
      return mats.map((m, i) => `
        <tr>
          ${i === 0 ? `<td rowspan="${mats.length}" style="background:#f0fdf4;font-weight:700;font-size:11px;color:#166534;padding:6px 8px;border:1px solid #e2e8f0;vertical-align:middle;">${campo}</td>` : ''}
          <td style="padding:6px 10px;border:1px solid #e2e8f0;font-size:13px;">${m.materia}</td>
          <td style="text-align:center;padding:6px 10px;border:1px solid #e2e8f0;font-weight:900;font-size:15px;color:${calColor(m.cal)};">${isNaN(m.cal)?'—':m.cal.toFixed(1)}</td>
        </tr>`).join('');
    }).join('');

    cont.innerHTML = `
      <div style="border:2px solid #15803d;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#14532d,#15803d);color:white;padding:14px 16px;">
          <div style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:1px;">SEP · Nueva Escuela Mexicana · Plan 2022</div>
          <div style="font-size:15px;font-weight:900;margin-top:2px;">Boleta de Evaluación — ${trim}° Trimestre</div>
          <div style="font-size:11px;opacity:.8;margin-top:2px;">${escuela} · CCT: ${cct} · Ciclo ${ciclo}</div>
        </div>
        <!-- Datos -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px;">
          <div><span style="color:#64748b;">Alumno(a): </span><strong>${nombre}</strong></div>
          <div><span style="color:#64748b;">CURP: </span><strong style="font-family:monospace;font-size:11px;">${curp}</strong></div>
          <div><span style="color:#64748b;">Grado/Grupo: </span><strong>${grado}</strong></div>
          <div><span style="color:#64748b;">Folio: </span><strong style="font-family:monospace;font-size:10px;">${folio}</strong></div>
        </div>
        <!-- Calificaciones -->
        <div style="padding:12px 14px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:7px 8px;border:1px solid #e2e8f0;text-align:left;font-size:11px;color:#475569;">Campo Formativo</th>
                <th style="padding:7px 8px;border:1px solid #e2e8f0;text-align:left;font-size:11px;color:#475569;">Materia</th>
                <th style="padding:7px 8px;border:1px solid #e2e8f0;text-align:center;font-size:11px;color:#475569;">Cal.</th>
              </tr>
            </thead>
            <tbody>${filasHtml || '<tr><td colspan="3" style="text-align:center;padding:20px;color:#94a3b8;font-size:13px;">Sin calificaciones para este trimestre</td></tr>'}</tbody>
          </table>
          ${boleta ? `<div style="margin-top:10px;display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:#64748b;">
            <span>Asistencias: <strong>${boleta.asistencias||0}</strong></span>
            <span>Inasist. justif.: <strong>${boleta.inasist_j||0}</strong></span>
            <span>Inasist. injust.: <strong>${boleta.inasist_i||0}</strong></span>
          </div>` : ''}
          ${boleta?.obs_general ? `<div style="margin-top:10px;padding:10px 12px;background:#fffbeb;border-radius:8px;border-left:3px solid #f59e0b;font-size:12px;color:#92400e;">
            <strong>Observaciones del docente:</strong><br>${boleta.obs_general}
          </div>` : ''}
        </div>
      </div>`;
  } catch(e) {
    console.warn('[cargarBoleta]', e.message);
    cont.innerHTML = '<div style="text-align:center;padding:32px;color:#ef4444;font-size:13px;">Error al cargar la boleta. Inténtalo de nuevo.</div>';
  }
}

// ─── TABS ─────────────────────────────────
let activeTab = 'inicio';
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-pill').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const tabs = ['inicio','materias','lectura','avisos','recompensas','escuela','pagos','tutor','examenes','boleta'];
  const idx = tabs.indexOf(tab);
  const activeBtn = document.querySelectorAll('.tab-pill')[idx];
  activeBtn?.classList.add('active');
  activeBtn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  document.getElementById('view-'+tab)?.classList.add('active');
  cargarVista(tab);
  document.getElementById('app-content').scrollTop = 0;
}

async function cargarVista(tab) {
  if (tab === 'inicio')      await cargarInicio();
  if (tab === 'materias')    await cargarMaterias();
  if (tab === 'lectura')     await cargarLectura();
  if (tab === 'avisos')      await cargarAvisos();
  if (tab === 'recompensas') await cargarRecompensas();
  if (tab === 'escuela')     await cargarEscuela();
  if (tab === 'pagos')       await cargarPagos();
  if (tab === 'tutor')       await cargarTutorChat();
  if (tab === 'examenes')    await padresExamenesCargar();
  if (tab === 'boleta')      await cargarBoleta();
}

// ── MÓDULO: PRÓXIMOS EXÁMENES (padres) ──
async function padresExamenesCargar() {
  const el = document.getElementById('padres-examenes-lista');
  if (!el) return;

  // Get linked student's grupo_id from hijoActivo (same pattern as cargarEvidenciasPendientes)
  const grupoId = hijoActivo?.alumnos_grupos?.[0]?.grupo_id || null;

  if (!grupoId) {
    el.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8;font-size:13px;">No se pudo obtener el grupo del alumno</div>';
    return;
  }

  el.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;">⏳ Cargando exámenes…</div>';
  try {
    const { data } = await sbHub.from('examenes_docente')
      .select('id, nombre, materia, fecha_aplicacion, trimestre, descripcion, guia_ia, guia_pdf_url, temas_guia')
      .eq('grupo_id', grupoId)
      .eq('visible_alumnos', true)
      .order('fecha_aplicacion', { ascending: true });
    const lista = data || [];
    if (!lista.length) {
      el.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8;"><div style="font-size:28px;margin-bottom:8px;">✅</div><div style="font-weight:700;">Sin exámenes próximos</div></div>';
      return;
    }
    el.innerHTML = lista.map(ex => {
      const diasRestantes = ex.fecha_aplicacion
        ? Math.ceil((new Date(ex.fecha_aplicacion + 'T12:00:00') - new Date()) / 86400000)
        : null;
      const pasado = diasRestantes !== null && diasRestantes < 0;
      const urgente = diasRestantes !== null && diasRestantes <= 3 && diasRestantes >= 0;
      const color = pasado ? '#94a3b8' : urgente ? '#dc2626' : '#0a5c2e';
      const bg = pasado ? '#f8fafc' : urgente ? '#fff1f2' : '#f0fdf4';
      const border = pasado ? '#e2e8f0' : urgente ? '#fecaca' : '#bbf7d0';
      const fechaStr = ex.fecha_aplicacion
        ? new Date(ex.fecha_aplicacion + 'T12:00:00').toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' })
        : 'Sin fecha';
      const diasLabel = diasRestantes === null ? '' : pasado ? '(pasado)' : diasRestantes === 0 ? '¡HOY!' : diasRestantes === 1 ? '¡Mañana!' : `En ${diasRestantes} días`;
      const tieneGuia = ex.guia_ia || ex.guia_pdf_url;
      return `<div style="background:${bg};border-radius:14px;border:1.5px solid ${border};padding:16px;margin-bottom:10px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
          <div>
            <div style="font-size:14px;font-weight:800;color:#0f172a;">${ex.nombre}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">${ex.materia} · T${ex.trimestre || '?'}</div>
          </div>
          ${diasLabel ? `<span style="padding:3px 10px;border-radius:99px;font-size:11px;font-weight:800;background:${color}20;color:${color};white-space:nowrap;">${diasLabel}</span>` : ''}
        </div>
        <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:8px;">📅 ${fechaStr}</div>
        ${ex.descripcion ? `<div style="font-size:12px;color:#475569;background:white;border-radius:8px;padding:8px 10px;margin-bottom:8px;">${ex.descripcion}</div>` : ''}
        ${ex.temas_guia ? `<div style="font-size:12px;color:#475569;margin-bottom:8px;"><strong>📌 Temas:</strong> ${ex.temas_guia}</div>` : ''}
        ${tieneGuia ? `<details style="margin-top:4px;"><summary style="cursor:pointer;font-size:12px;font-weight:800;color:#7c3aed;">✨ Ver guía de estudio del docente</summary>
          <div style="margin-top:10px;">
            ${ex.guia_pdf_url ? `<a href="${ex.guia_pdf_url}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;background:#1e40af;color:white;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;margin-bottom:8px;">📄 Descargar PDF</a>` : ''}
            ${ex.guia_ia ? `<div style="background:#faf5ff;border:1px solid #ddd6fe;border-radius:10px;padding:12px;font-size:12px;color:#4c1d95;line-height:1.7;white-space:pre-wrap;max-height:300px;overflow-y:auto;">${ex.guia_ia}</div>` : ''}
          </div>
        </details>` : `<div style="font-size:11px;color:#94a3b8;font-style:italic;">El docente aún no publicó guía de estudio</div>`}
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;font-size:12px;">Error al cargar exámenes</div>';
    console.warn('[padresEx]', e.message);
  }
}

// ─── VISTA INICIO ─────────────────────────
async function cargarInicio() {
  await cargarCalificaciones();
  renderResumenMaterias();
  cargarAISugerencia();
  renderPreguntaDia();
  renderLogros();
  cargarAnalisisAlumno();
  cargarEvidenciasPendientes();
}

async function cargarEvidenciasPendientes() {
  const card = document.getElementById('card-evidencias-pendientes');
  const list = document.getElementById('evidencias-pendientes-list');
  if (!card || !list || !sbHub || !hijoActivo?.id) return;
  try {
    // Obtener grupo del hijo
    const grupoId = hijoActivo.alumnos_grupos?.[0]?.grupo_id || null;
    if (!grupoId) return;
    const { data } = await sbHub.from('tareas_docente')
      .select('id, titulo, materia, fecha_entrega')
      .eq('grupo_id', grupoId)
      .eq('requiere_evidencia', true)
      .order('fecha_entrega', { ascending: true })
      .limit(5);
    if (!data?.length) { card.style.display = 'none'; return; }
    // Verificar cuáles ya tienen evidencia subida
    const { data: evidSubmit } = await sbHub.from('evidencias')
      .select('tarea_id').eq('alumno_id', hijoActivo.id);
    const yaSubidas = new Set((evidSubmit||[]).map(e => e.tarea_id));
    const pendientes = data.filter(t => !yaSubidas.has(t.id));
    if (!pendientes.length) { card.style.display = 'none'; return; }
    card.style.display = '';
    list.innerHTML = pendientes.map(t => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--gris-100);">
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;">${t.titulo}</div>
          <div style="font-size:11px;color:var(--gris-400);">${t.materia||''}${t.fecha_entrega?' · Entrega: '+t.fecha_entrega:''}</div>
        </div>
        <button onclick="abrirSubirEvidencia('${t.id}','${t.titulo}')" style="padding:7px 12px;background:var(--verde);color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font-body);">📸 Subir</button>
      </div>`).join('');
  } catch(e) { card.style.display = 'none'; }
}

function abrirSubirEvidencia(tareaId, titulo) {
  // Pre-seleccionar el tipo y título en el form de evidencia
  document.getElementById('evidencia-tipo').value = 'tarea';
  document.getElementById('evidencia-titulo').value = titulo;
  window._evidenciaTareaId = tareaId;
  // Navegar a recompensas donde está el form
  switchTab('recompensas');
  setTimeout(() => {
    const el = document.getElementById('btn-subir-evidencia');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
}

async function cargarCalificaciones() {
  calificaciones = [];
  try {
    if (sbHub && hijoActivo?.id) {
      // Query calificaciones reales — misma tabla que usa el docente
      // Columnas: alumno_id, grupo_id, materia (text), trimestre, aspecto, calificacion, ciclo
      const { data, error } = await sbHub.from('calificaciones')
        .select('materia, trimestre, aspecto, calificacion, ciclo')
        .eq('alumno_id', hijoActivo.id)
        .eq('ciclo', window.CICLO_ACTIVO || localStorage.getItem('siembra_ciclo') || '2025-2026')
        .order('materia');
      
      if (data?.length) {
        // Agrupar por materia → promediar calificaciones de todos los aspectos/trimestres
        const porMateria = {};
        data.forEach(c => {
          const m = c.materia;
          if (!porMateria[m]) porMateria[m] = { cals: [], trimestres: {} };
          porMateria[m].cals.push(parseFloat(c.calificacion) || 0);
          const t = parseInt(c.trimestre) || 1;
          if (!porMateria[m].trimestres[t]) porMateria[m].trimestres[t] = [];
          porMateria[m].trimestres[t].push(parseFloat(c.calificacion) || 0);
        });

        // Iconos y colores por materia
        const META = {
          'Lengua Materna (Español)':     { icono:'📖', color:'#1e40af' },
          'Español':                      { icono:'📖', color:'#1e40af' },
          'Matemáticas':                  { icono:'📐', color:'#166534' },
          'Ciencias Naturales y Tecnología':{ icono:'🔬', color:'#0369a1' },
          'Ciencias (Biología)':          { icono:'🧬', color:'#059669' },
          'Ciencias (Física)':            { icono:'⚡', color:'#0369a1' },
          'Ciencias (Química)':           { icono:'🧪', color:'#7c3aed' },
          'Historia':                     { icono:'🗺', color:'#9b59b6' },
          'Geografía':                    { icono:'🌎', color:'#059669' },
          'Formación Cívica y Ética':     { icono:'🏛', color:'#16a085' },
          'Educación Física':             { icono:'⚽', color:'#f5c842' },
          'Educación Artística':          { icono:'🎨', color:'#e74c3c' },
          'Artes':                        { icono:'🎨', color:'#e74c3c' },
          'Segunda Lengua (Inglés)':      { icono:'🌐', color:'#2563eb' },
          'Lengua Extranjera (Inglés)':   { icono:'🌐', color:'#2563eb' },
          'Tecnología':                   { icono:'💻', color:'#0891b2' },
          'Lenguajes':                    { icono:'📖', color:'#1e40af' },
          'Saberes y Pensamiento Científico':{ icono:'🔬', color:'#166534' },
          'Ética, Naturaleza y Sociedades':{ icono:'🌍', color:'#7c3aed' },
          'De lo Humano y lo Comunitario':{ icono:'🤝', color:'#c2410c' },
        };

        calificaciones = Object.entries(porMateria).map(([materia, info]) => {
          const cals = info.cals;
          const promedio = cals.length ? Math.round((cals.reduce((a,b)=>a+b,0)/cals.length)*10)/10 : 0;
          // Calcular promedio del trimestre anterior para tendencia
          const trims = Object.keys(info.trimestres).sort((a,b)=>a-b);
          let calAnt = promedio;
          if (trims.length >= 2) {
            const prev = info.trimestres[trims[trims.length-2]];
            calAnt = prev.length ? Math.round((prev.reduce((a,b)=>a+b,0)/prev.length)*10)/10 : promedio;
          }
          const meta = META[materia] || { icono:'📚', color:'#1D9E75' };
          return {
            materia, cal: promedio, cal_ant: calAnt,
            icono: meta.icono, color: meta.color
          };
        });
        return;
      }
    }
  } catch(e) { console.warn('Error cargando calificaciones:', e); }
  // Si no hay calificaciones reales, dejar vacío (el render mostrará "Sin calificaciones registradas")
  // calificaciones ya fue inicializado como [] al inicio de la función
}

function getDemoCalificaciones() {
  return [
    { materia: 'Matemáticas',     cal: 8.4, cal_ant: 7.8, icono: '📐', color: '#1D9E75' },
    { materia: 'Español',         cal: 7.1, cal_ant: 7.4, icono: '📖', color: '#2d6fb5' },
    { materia: 'Ciencias Nat.',   cal: 5.8, cal_ant: 6.2, icono: '🔬', color: '#e05c3a' },
    { materia: 'Historia',        cal: 8.0, cal_ant: 7.5, icono: '🗺', color: '#9b59b6' },
    { materia: 'Educación Física',cal: 9.5, cal_ant: 9.5, icono: '⚽', color: '#f5c842' },
    { materia: 'Artes',           cal: 8.8, cal_ant: 8.5, icono: '🎨', color: '#e74c3c' },
  ];
}

function getMateriaData(c) {
  // Normaliza entre formato DB y demo
  return {
    nombre: c.materia || c.materias?.nombre || 'Materia',
    cal:    parseFloat(c.cal || c.calificacion || c.promedio || 0),
    calAnt: parseFloat(c.cal_ant || c.calificacion_anterior || 0),
    icono:  c.icono || '📚',
    color:  c.color || c.materias?.color || '#1D9E75',
  };
}

function renderResumenMaterias() {
  const el = document.getElementById('resumen-materias-list');
  if (!calificaciones.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div><div class="empty-text">Sin calificaciones registradas</div><div style="font-size:13px;color:#64748b;margin-top:8px;">Cuando el docente capture evaluaciones, aparecerán aquí con su avance por materia.</div></div>';
    return;
  }
  // Mostrar solo las 3 más relevantes (las más bajas primero para llamar atención)
  const sorted = [...calificaciones]
    .map(getMateriaData)
    .sort((a,b) => a.cal - b.cal)
    .slice(0, 4);

  el.innerHTML = sorted.map(m => {
    const pct = Math.min(100, Math.max(0, (m.cal / 10) * 100));
    const trend = m.cal > m.calAnt ? '↑' : m.cal < m.calAnt ? '↓' : '→';
    const trendColor = trend === '↑' ? 'var(--verde-mid)' : trend === '↓' ? 'var(--coral)' : 'var(--gris-400)';
    const calColor = m.cal >= 8 ? 'var(--verde-mid)' : m.cal >= 6 ? 'var(--azul)' : 'var(--coral)';
    return `
    <div class="materia-row" onclick="showMateriaDetail('${m.nombre}', ${m.cal})">
      <div class="materia-icon" style="background:${m.color}22">${m.icono}</div>
      <div class="materia-data">
        <div class="materia-nombre">${m.nombre}</div>
        <div class="materia-bar-wrap">
          <div class="materia-bar-fill" style="width:${pct}%;background:${m.color}"></div>
        </div>
        <div class="materia-desc">${calDesc(m.cal)}</div>
      </div>
      <div class="materia-cal" style="color:${calColor}">${m.cal.toFixed(1)}</div>
      <div class="trend-arrow" style="color:${trendColor}">${trend}</div>
    </div>`;
  }).join('');
}

function calDesc(cal) {
  if (cal >= 9) return '¡Excelente!';
  if (cal >= 8) return 'Muy bien 👍';
  if (cal >= 7) return 'Regular';
  if (cal >= 6) return 'Necesita apoyo';
  return '⚠️ Atención urgente';
}

// ─── AI SUGERENCIA ────────────────────────
async function cargarAISugerencia() {
  const el = document.getElementById('ai-text');
  const nombre = hijoActivo?.nombre || 'tu hij@';
  const mats = calificaciones.slice(0,4).map(getMateriaData);
  const peores = mats.filter(m => m.cal < 7).map(m => m.nombre).join(', ');
  const mejores = mats.filter(m => m.cal >= 8).map(m => m.nombre).join(', ');

  const prompt = `Soy padre/madre de ${nombre}, alumno de primaria o secundaria en México (Nueva Escuela Mexicana).
Sus calificaciones: ${mats.map(m => `${m.nombre}: ${m.cal}`).join(', ')}.
${peores ? `Materias con dificultad: ${peores}.` : ''}
${mejores ? `Materias donde destaca: ${mejores}.` : ''}
Dame UNA sugerencia práctica (2-3 oraciones máximo), amigable y directa, de algo que yo como padre pueda hacer HOY para apoyar a mi hij@. Sin listas, sin diagnósticos, solo un consejo cálido y accionable.`;

  try {
    const texto = await callAI({ feature: 'padre_reporte_ia', prompt });
    el.textContent = texto || 'Sin sugerencias disponibles por ahora.';
    return;
  } catch(e) {}

  // Fallback local si la IA no está disponible
  const fallbacks = [
    `Dedica 15 minutos esta noche a preguntarle a ${nombre} qué fue lo más interesante que aprendió hoy. Escucha sin interrumpir — ese momento vale más que cualquier tarea.`,
    `Revisa juntos la mochila de ${nombre} antes de dormir. Organizarla la noche anterior reduce el estrés matutino y mejora la puntualidad.`,
    `Felicita hoy a ${nombre} por algo específico de la escuela, no solo las calificaciones. El reconocimiento fortalece la motivación interna.`,
  ];
  el.textContent = fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ─── PREGUNTA DEL DÍA ─────────────────────
function renderPreguntaDia() {
  const hoy = new Date().getDay();
  const p = PREGUNTAS_DIA[hoy % PREGUNTAS_DIA.length];
  const yaRespondida = localStorage.getItem(`pregunta_${new Date().toDateString()}`);

  document.getElementById('pregunta-texto').textContent = p.texto;
  const optsEl = document.getElementById('pregunta-options');
  const feedEl = document.getElementById('pregunta-feedback');

  if (yaRespondida) {
    optsEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;font-size:13px;opacity:0.8">✅ Ya respondiste hoy. ¡Gracias!</div>`;
    feedEl.style.display = 'block';
    feedEl.textContent = p.feedback;
    return;
  }

  optsEl.innerHTML = p.opciones.map((opt, i) =>
    `<button class="pregunta-opt" onclick="responderPregunta(${i},${p.correcta},'${p.feedback.replace(/'/g,"\\'")}',this)">${opt}</button>`
  ).join('');
}

function responderPregunta(idx, correcta, feedback, btn) {
  if (preguntaRespondida) return;
  preguntaRespondida = true;
  const opts = document.querySelectorAll('.pregunta-opt');
  opts.forEach((o, i) => {
    o.disabled = true;
    if (i === correcta) o.classList.add('correct');
    if (i === idx && idx !== correcta) o.classList.add('wrong');
    if (i === idx && idx === correcta) o.classList.add('selected');
  });
  const feedEl = document.getElementById('pregunta-feedback');
  feedEl.style.display = 'block';
  feedEl.innerHTML = feedback + `<div class="xp-earned">+10 ✨ puntos</div>`;
  localStorage.setItem(`pregunta_${new Date().toDateString()}`, '1');
  sumarXPLocal(10);
}

function sumarXPLocal(pts) {
  const current = parseInt(document.getElementById('header-xp').textContent) || 0;
  document.getElementById('header-xp').textContent = current + pts;
}

// ─── LOGROS ───────────────────────────────
function renderLogros() {
  document.getElementById('logros-grid').innerHTML = LOGROS.map(l => `
    <div class="logro-item">
      <div class="logro-icon ${l.earned ? 'earned' : 'locked'}">${l.icon}</div>
      <div class="logro-name">${l.name}</div>
    </div>
  `).join('');
}

// ─── VISTA MATERIAS ───────────────────────
async function cargarMaterias() {
  if (!calificaciones.length) await cargarCalificaciones();
  const mats = calificaciones.map(getMateriaData);
  const promedio = mats.length
    ? (mats.reduce((a,m) => a + m.cal, 0) / mats.length).toFixed(1)
    : '—';
  document.getElementById('promedio-general').textContent = promedio;
  const pNum = parseFloat(promedio);
  document.getElementById('promedio-desc').textContent =
    pNum >= 9 ? `¡${hijoActivo?.nombre || 'Tu hij@'} está teniendo un ciclo excelente! Sigue apoyándole.` :
    pNum >= 7 ? `Va bien en general. Hay algunas materias donde puede mejorar con un poco de apoyo en casa.` :
    pNum >= 6 ? `Necesita refuerzo en algunas materias. Te recomendamos hablar con su docente.` :
    `Está enfrentando dificultades académicas. Te recomendamos una reunión con la maestra o maestro.`;

  // Radar chart
  if (chartRadar) { chartRadar.destroy(); chartRadar = null; }
  const ctx = document.getElementById('chart-radar');
  if (ctx && mats.length >= 3) {
    chartRadar = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: mats.map(m => m.nombre.substring(0,8)),
        datasets: [{
          data: mats.map(m => m.cal),
          backgroundColor: 'rgba(29,158,117,0.15)',
          borderColor: '#1D9E75',
          borderWidth: 2,
          pointBackgroundColor: '#1D9E75',
          pointRadius: 3,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { min: 0, max: 10, ticks: { stepSize: 2, font: { size: 9 } }, pointLabels: { font: { size: 10 } } } },
        plugins: { legend: { display: false } }
      }
    });
  }

  // Lista detalle
  const el = document.getElementById('materias-detail-list');
  if (!mats.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div><div class="empty-text">Sin calificaciones aún</div></div>';
    return;
  }
  el.innerHTML = mats.map(m => {
    const pct = Math.min(100, (m.cal/10)*100);
    const calColor = m.cal >= 8 ? 'var(--verde-mid)' : m.cal >= 6 ? 'var(--azul)' : 'var(--coral)';
    const trend = m.cal > m.calAnt ? '↑' : m.cal < m.calAnt ? '↓' : '→';
    const trendColor = trend==='↑'?'var(--verde-mid)':trend==='↓'?'var(--coral)':'var(--gris-400)';
    return `
    <div class="materia-row" onclick="showMateriaDetail('${m.nombre}', ${m.cal})">
      <div class="materia-icon" style="background:${m.color}22">${m.icono}</div>
      <div class="materia-data">
        <div class="materia-nombre">${m.nombre}</div>
        <div class="materia-bar-wrap">
          <div class="materia-bar-fill" style="width:${pct}%;background:${m.color}"></div>
        </div>
        <div class="materia-desc">${calDesc(m.cal)}</div>
      </div>
      <div class="materia-cal" style="color:${calColor}">${m.cal.toFixed(1)}</div>
      <div class="trend-arrow" style="color:${trendColor}">${trend}</div>
    </div>`;
  }).join('');
}

// ─── DETALLE MATERIA (MODAL) ──────────────
async function showMateriaDetail(nombre, cal) {
  document.getElementById('modal-materia-title').textContent = nombre;
  const body = document.getElementById('modal-materia-body');
  body.innerHTML = `<div style="text-align:center;padding:20px 0">
    <div style="font-size:64px;font-family:var(--font-display);font-weight:900;color:${cal>=8?'var(--verde-mid)':cal>=6?'var(--azul)':'var(--coral)'}">${cal.toFixed(1)}</div>
    <div style="font-size:14px;color:var(--gris-400);margin-bottom:20px">${calDesc(cal)}</div>
  </div>
  <div class="ai-card" style="margin:0 0 16px">
    <div class="ai-header"><div class="ai-dot"></div><div class="ai-label">Consejo para esta materia</div></div>
    <div class="ai-text" id="modal-ai-text"><div class="ai-loading"><div class="ai-dot-anim"></div><div class="ai-dot-anim"></div><div class="ai-dot-anim"></div></div></div>
  </div>`;

  openModal('modal-materia');

  // Cargar sugerencia IA para esta materia
  try {
    const prompt = `Dame un consejo MUY CORTO (1-2 oraciones) y práctico para que un padre de familia mexicano ayude a su hij@ a mejorar en la materia de ${nombre}. La calificación actual es ${cal.toFixed(1)}/10. Sin listas, tono amigable.`;
    const texto = await callAI({ feature: 'padre_reporte_ia', prompt });
    const elM = document.getElementById('modal-ai-text');
    if (elM) elM.textContent = texto || '—';
    return;
  } catch(e) {}
  const el = document.getElementById('modal-ai-text');
  if (el) el.textContent = cal < 7
    ? `Dedica 20 minutos diarios a repasar ${nombre} con tu hij@. Pregúntale qué parte le cuesta más y busquen videos cortos juntos en YouTube.`
    : `¡Va muy bien en ${nombre}! Sigue reforzando con pequeños repasos semanales para mantener el nivel.`;
}

// ─── VISTA AVISOS ─────────────────────────
async function cargarAvisos() {
  // Citatorios
  try {
    if (sbHub && hijoActivo?.id) {
      const { data: cit } = await sbHub.from('citatorios')
        .select('*').eq('alumno_id', hijoActivo.id)
        .order('fecha', { ascending: true }).limit(10);
      if (cit?.length) {
        renderCitatorios(cit);
        const nuevos = cit.filter(c => !c.visto).length;
        if (nuevos > 0) {
          document.getElementById('notif-badge').style.display = 'flex';
          document.getElementById('notif-badge').textContent = nuevos;
        }
      }
    }
  } catch(e) {}

  // Avisos generales de la escuela
  try {
    if (sbHub) {
      const { data: avs } = await sbHub.from('avisos')
        .select('*').eq('activo', true)
        .order('created_at', { ascending: false }).limit(10);
      if (avs?.length) { renderAvisosLista(avs); return; }
    }
  } catch(e) {}

  // Demo
  renderAvisosLista([
    { id:1, tipo:'evento', titulo:'Junta de padres', descripcion:'Reunión bimestral con docentes. Confirma asistencia.', fecha:'2026-03-18', icono:'👥', nuevo: true },
    { id:2, tipo:'logro',  titulo:'¡Felicidades!', descripcion:'Tu hij@ participó en el torneo escolar de ajedrez.', fecha:'2026-03-15', icono:'🏆', nuevo: false },
    { id:3, tipo:'aviso',  titulo:'Vacaciones próximas', descripcion:'Del 4 al 11 de abril no hay clases por periodo vacacional.', fecha:'2026-03-12', icono:'📅', nuevo: false },
  ]);
}

function renderCitatorios(lista) {
  const el = document.getElementById('citatorios-list');
  if (!lista.length) return;
  el.innerHTML = lista.map(c => `
    <div class="aviso-card" style="background:var(--coral-light)" onclick="marcarCitatorioVisto('${c.id}')">
      <div class="aviso-icon">📋</div>
      <div style="flex:1">
        <div class="aviso-titulo">${c.motivo || c.titulo || 'Citatorio'}</div>
        <div class="aviso-body">${c.descripcion || ''}</div>
        <div class="aviso-fecha">${formatFecha(c.fecha)}</div>
      </div>
      ${!c.visto ? '<div class="aviso-new"></div>' : ''}
    </div>
  `).join('');
}

function renderAvisosLista(lista) {
  const el = document.getElementById('avisos-list');
  if (!lista.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📢</div><div class="empty-text">Sin avisos recientes</div></div>';
    return;
  }
  el.innerHTML = lista.map(a => `
    <div class="aviso-card" style="background:var(--gris-100)">
      <div class="aviso-icon">${a.icono || '📢'}</div>
      <div style="flex:1">
        <div class="aviso-titulo">${a.titulo}</div>
        <div class="aviso-body">${a.descripcion || a.cuerpo || ''}</div>
        <div class="aviso-fecha">${formatFecha(a.fecha || a.created_at)}</div>
      </div>
      ${a.nuevo ? '<div class="aviso-new"></div>' : ''}
    </div>
  `).join('');
}

async function marcarCitatorioVisto(id) {
  try {
    if (sbHub) await sbHub.from('citatorios').update({ visto: true }).eq('id', id);
  } catch(e) {}
  showToast('✅ Citatorio marcado como leído');
}

// ─── VISTA ESCUELA ────────────────────────
async function cargarEscuela() {
  // Eventos
  try {
    if (sbHub) {
      const { data: evts } = await sbHub.from('eventos')
        .select('*').eq('activo', true)
        .gte('fecha', new Date().toISOString().split('T')[0])
        .order('fecha').limit(5);
      if (evts?.length) { renderEventos(evts); }
    }
  } catch(e) {}

  // Galería
  try {
    if (sbHub) {
      const { data: fotos } = await sbHub.from('galeria')
        .select('*').eq('activo', true)
        .order('created_at', { ascending: false }).limit(10);
      if (fotos?.length) { renderGaleria(fotos); return; }
    }
  } catch(e) {}

  // Demo galería
  renderGaleria([
    { titulo: 'Torneo de fútbol', icono: '⚽' },
    { titulo: 'Día del maestro', icono: '🌸' },
    { titulo: 'Concurso de ciencias', icono: '🔬' },
    { titulo: 'Festival de danza', icono: '💃' },
  ]);
}

async function cargarPagos() {
  // Datos del alumno activo
  const alumnoId = window._alumnoActivo?.id || window._currentAlumno?.id;
  const alumnoNombre = document.getElementById('child-name')?.textContent || 'tu hijo/a';

  // ── Estado de cuenta (resumen) ──────────────────────────
  const estadoWrap = document.getElementById('pagos-estado-wrap');
  const pendList   = document.getElementById('pagos-pendientes-list');
  const histList   = document.getElementById('pagos-historial-list');

  // Intentar cargar desde Supabase si está conectado
  let cargos = [], pagos = [];
  try {
    if (sbHub && alumnoId) {
      const { data: cargosDB } = await sbHub
        .from('cargos_alumno')
        .select('*, conceptos_cobro(nombre,icono,monto)')
        .eq('alumno_id', alumnoId)
        .order('fecha_vto', { ascending: false });
      if (cargosDB) cargos = cargosDB;

      const { data: pagosDB } = await sbHub
        .from('pagos_colegiatura')
        .select('*')
        .eq('alumno_id', alumnoId)
        .order('creado_en', { ascending: false })
        .limit(10);
      if (pagosDB) pagos = pagosDB;
    }
  } catch(e) {}

  // Si no hay datos reales, mostrar estado vacío honesto
  if (!cargos.length) {
    if (estadoWrap) estadoWrap.innerHTML = '<div style="text-align:center;padding:24px;color:#64748b;font-size:13px;">Sin cargos registrados este ciclo.</div>';
    if (pendList)   pendList.innerHTML   = '<div style="text-align:center;padding:20px;color:#64748b;font-size:13px;">Sin cargos pendientes.</div>';
    if (histList)   histList.innerHTML   = '<div style="text-align:center;padding:20px;color:#64748b;font-size:13px;">Sin historial de pagos.</div>';
    return;
  }

  // ── Calcular totales ──────────────────────────────────
  const pendientes = cargos.filter(c=>c.estado==='pendiente'||c.estado==='vencido');
  const pagados    = cargos.filter(c=>c.estado==='pagado');
  const montoPend  = pendientes.reduce((s,c)=>s+Number(c.monto_final||0),0);
  const montoPag   = pagados.reduce((s,c)=>s+Number(c.monto_final||0),0);
  const fmt = n => '$' + Number(n).toLocaleString('es-MX');

  // ── Render estado ─────────────────────────────────────
  if (estadoWrap) {
    const estadoBadge = pendientes.length === 0
      ? '<span style="background:#f0fdf4;color:#0a5c2e;padding:5px 14px;border-radius:99px;font-size:12px;font-weight:700;">✅ Al corriente</span>'
      : `<span style="background:#fffbeb;color:#b45309;padding:5px 14px;border-radius:99px;font-size:12px;font-weight:700;">⏳ ${pendientes.length} cargo${pendientes.length>1?'s':''} pendiente${pendientes.length>1?'s':''}</span>`;
    estadoWrap.innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;">
        <div style="flex:1;min-width:120px;background:#f0fdf4;border-radius:10px;padding:14px;">
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:4px;">Pagado</div>
          <div style="font-family:'Fraunces',serif;font-size:22px;font-weight:700;color:#0a5c2e;">${fmt(montoPag)}</div>
        </div>
        <div style="flex:1;min-width:120px;background:${pendientes.length?'#fffbeb':'#f0fdf4'};border-radius:10px;padding:14px;">
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:4px;">Por pagar</div>
          <div style="font-family:'Fraunces',serif;font-size:22px;font-weight:700;color:${pendientes.length?'#b45309':'#0a5c2e'};">${fmt(montoPend)}</div>
        </div>
      </div>
      <div>${estadoBadge}</div>`;
  }

  // ── Render cargos pendientes ───────────────────────────
  if (pendList) {
    if (!pendientes.length) {
      pendList.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b;font-size:13px;">🎉 ¡Sin pagos pendientes!</div>';
    } else {
      pendList.innerHTML = pendientes.map(c => {
        const estaVencido = c.estado === 'vencido';
        return `<div style="border:1.5px solid ${estaVencido?'#fecaca':'#fed7aa'};border-radius:12px;padding:14px 16px;margin-bottom:10px;background:${estaVencido?'#fef2f2':'#fffbeb'};">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <div>
              <div style="font-size:13px;font-weight:700;">${c.conceptos_cobro?.icono||'💵'} ${c.conceptos_cobro?.nombre||'Colegiatura'}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">${c.periodo_label||''} · Vence ${c.fecha_vto||''}</div>
              ${Number(c.descuento)>0?`<div style="font-size:11px;color:#7c3aed;margin-top:2px;">🎓 Descuento aplicado: -${fmt(c.descuento)}</div>`:''}
            </div>
            <div style="text-align:right;">
              <div style="font-family:'Fraunces',serif;font-size:20px;font-weight:700;color:${estaVencido?'#b91c1c':'#b45309'};">${fmt(c.monto_final)}</div>
              <button onclick="pagosSolicitarPago('${c.id}','${c.monto_final}','${c.conceptos_cobro?.nombre||'Colegiatura'}')" style="margin-top:6px;padding:7px 16px;background:linear-gradient(135deg,#0a5c2e,#16793a);color:white;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">💳 Pagar ahora</button>
            </div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // ── Render historial ──────────────────────────────────
  if (histList) {
    const histItems = pagos.length ? pagos : pagados;
    if (!histItems.length) {
      histList.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b;font-size:13px;">Sin pagos registrados.</div>';
    } else {
      histList.innerHTML = histItems.map(p => {
        const fecha = p.pagado_en ? new Date(p.pagado_en).toLocaleDateString('es-MX') : (p.fecha_vto||p.periodo_label||'—');
        const concepto = p.concepto_nombre || p.conceptos_cobro?.nombre || 'Colegiatura';
        const monto = p.monto || p.monto_final || 0;
        const metodo = p.metodo || '—';
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <div>
            <div style="font-size:13px;font-weight:600;">✅ ${concepto}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;">${fecha} · ${metodo}</div>
          </div>
          <div style="font-family:'Fraunces',serif;font-size:16px;font-weight:700;color:#0a5c2e;">${fmt(monto)}</div>
        </div>`;
      }).join('');
    }
  }
}

async function pagosSolicitarPago(cargoId, monto, concepto) {
  const montoNum = Number(monto);
  const montoFmt = '$' + montoNum.toLocaleString('es-MX');

  // Modal de selección de método de pago
  const metodosHtml = `
    <div id="pago-metodo-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:20px;">
      <div style="background:white;border-radius:20px 20px 16px 16px;padding:28px;width:100%;max-width:440px;box-shadow:0 -8px 40px rgba(0,0,0,.15);">
        <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;margin-bottom:4px;">💳 Pagar ${concepto}</div>
        <div style="font-size:22px;font-weight:700;color:#0a5c2e;font-family:'Fraunces',serif;margin-bottom:20px;">${montoFmt}</div>
        <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Selecciona método de pago</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button onclick="pagosProcesar('${cargoId}','${monto}','${concepto}','Efectivo')" style="display:flex;align-items:center;gap:14px;padding:14px 18px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;font-family:'Sora',sans-serif;font-size:13px;font-weight:600;cursor:pointer;text-align:left;">
            <span style="font-size:22px;">💵</span><div><div style="font-weight:700;">Efectivo</div><div style="font-size:11px;color:#64748b;">Pago en caja de la escuela</div></div>
          </button>
          <button onclick="pagosProcesar('${cargoId}','${monto}','${concepto}','OXXO')" style="display:flex;align-items:center;gap:14px;padding:14px 18px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;font-family:'Sora',sans-serif;font-size:13px;font-weight:600;cursor:pointer;text-align:left;">
            <span style="font-size:22px;">🏪</span><div><div style="font-weight:700;">OXXO Pay</div><div style="font-size:11px;color:#64748b;">Genera referencia de pago</div></div>
          </button>
          <button onclick="pagosProcesar('${cargoId}','${monto}','${concepto}','SPEI')" style="display:flex;align-items:center;gap:14px;padding:14px 18px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;font-family:'Sora',sans-serif;font-size:13px;font-weight:600;cursor:pointer;text-align:left;">
            <span style="font-size:22px;">🏦</span><div><div style="font-weight:700;">SPEI / Transferencia</div><div style="font-size:11px;color:#64748b;">Transferencia bancaria directa</div></div>
          </button>
          <button onclick="pagosProcesar('${cargoId}','${monto}','${concepto}','Tarjeta')" style="display:flex;align-items:center;gap:14px;padding:14px 18px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;font-family:'Sora',sans-serif;font-size:13px;font-weight:600;cursor:pointer;text-align:left;">
            <span style="font-size:22px;">💳</span><div><div style="font-weight:700;">Tarjeta de crédito/débito</div><div style="font-size:11px;color:#64748b;">Pago seguro con Conekta</div></div>
          </button>
        </div>
        <!-- ── CFDI: selector de RFC para facturar ── -->
        <div id="cfdi-section" style="margin-top:20px;padding:14px;background:#f0fdf4;border-radius:12px;border:1.5px solid #bbf7d0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="font-size:12px;font-weight:700;color:#0a5c2e;">🧾 Solicitar factura (CFDI 4.0)</div>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input type="checkbox" id="cfdi-check" onchange="cfdiToggle()" style="width:16px;height:16px;accent-color:#0a5c2e;">
              <span style="font-size:11px;color:#0a5c2e;font-weight:700;">Facturar</span>
            </label>
          </div>
          <div id="cfdi-rfc-panel" style="display:none;">
            <select id="cfdi-rfc-select" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:12px;margin-bottom:8px;outline:none;">
              <option value="">⏳ Cargando RFCs…</option>
            </select>
            <button onclick="cfdiAgregarRfc()" style="font-size:11px;color:#0a5c2e;background:none;border:none;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;text-decoration:underline;">+ Agregar nuevo RFC</button>
          </div>
        </div>
        <button onclick="document.getElementById('pago-metodo-modal').remove()" style="margin-top:16px;width:100%;padding:12px;background:transparent;border:none;font-family:'Sora',sans-serif;font-size:13px;color:#64748b;cursor:pointer;">Cancelar</button>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', metodosHtml);
}

async function pagosProcesar(cargoId, monto, concepto, metodo) {
  document.getElementById('pago-metodo-modal')?.remove();
  const montoNum = Number(monto);

  // Obtener alumno activo
  let alumnoId = null;
  let escuelaCCT = null;
  try {
    const { data: { session } } = await sbHub.auth.getSession();
    if (session?.user) {
      const { data: usr } = await sbHub.from('usuarios').select('id, escuela_cct').eq('auth_id', session.user.id).single();
      if (usr) { alumnoId = usr.id; escuelaCCT = usr.escuela_cct; }
    }
  } catch(e) {}

  // Intentar guardar en Supabase
  let guardadoOk = false;
  if (sbHub && alumnoId && escuelaCCT && !cargoId.startsWith('demo')) {
    try {
      // 1. Insertar pago
      const { error: errPago } = await sbHub.from('pagos_colegiatura').insert({
        cargo_id:        cargoId,
        alumno_id:       alumnoId,
        escuela_cct:     escuelaCCT,
        concepto_nombre: concepto,
        monto:           montoNum,
        metodo:          metodo,
        estado:          metodo === 'Efectivo' ? 'pendiente' : 'pendiente',
        notas:           'Solicitud desde portal padre',
        pagado_en:       metodo === 'Efectivo' ? null : new Date().toISOString(),
        creado_en:       new Date().toISOString()
      });
      if (errPago) throw errPago;

      // 2. Actualizar estado del cargo
      await sbHub.from('cargos_alumno').update({ estado: 'pagado' }).eq('id', cargoId);
      guardadoOk = true;
    } catch(e) {
      console.warn('Error guardando pago:', e);
    }
  }

  // ── Tarjeta: redirigir a Conekta Hosted Checkout ────────────────
  if (metodo === 'Tarjeta') {
    try {
      const { data: { session } } = await sbHub.auth.getSession();
      const resp = await fetch(`${window._supabaseUrl}/functions/v1/conekta-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          alumno_id:         alumnoId,
          cargo_id:          cargoId,
          monto:             Math.round(montoNum * 100), // centavos
          concepto,
          escuela_cct:       escuelaCCT,
          metodo:            'card',
          success_url:       window.location.href + '?pago=ok',
          cancel_url:        window.location.href + '?pago=cancelado',
          // CFDI: pasar RFC y datos del alumno para timbrado automático
          rfc_cfdi:          cfdiObtenerRfcSeleccionado() || '',
          solicitar_cfdi:    cfdiObtenerRfcSeleccionado() ? 'true' : 'false',
          padre_id:          currentPerfil?.id || '',
          alumno_nombre:     hijoActivo?.nombre ? `${hijoActivo.nombre} ${hijoActivo.apellido_p||''}`.trim() : '',
          alumno_curp:       hijoActivo?.curp || '',
          nivel_educativo:   hijoActivo?.nivel || 'Primaria',
          mes_colegiatura:   new Date().toISOString().slice(0,7),
        }),
      });
      const json = await resp.json();
      if (json?.checkout_url) {
        window.location.href = json.checkout_url;
        return;
      }
      // Si la Edge Function no está activa, informar sin romper
      showToast('⚠️ Checkout no disponible. Contacta a la escuela.', 'warn');
    } catch(e) {
      showToast('⚠️ Error al conectar con el procesador de pagos.', 'warn');
    }
    return;
  }

  // ── OXXO: mostrar referencia si viene de Supabase ─────────────────
  if (metodo === 'OXXO') {
    showToast('🏪 Solicitud enviada. La escuela te enviará la referencia OXXO.');
    await cargarPagos();
    return;
  }

  // ── SPEI: mostrar datos de transferencia ──────────────────────────
  if (metodo === 'SPEI') {
    showToast('🏦 Solicitud registrada. La escuela te compartirá los datos de transferencia.');
    await cargarPagos();
    return;
  }

  // ── Efectivo ──────────────────────────────────────────────────────
  showToast('✅ Solicitud enviada. Paga en caja y la escuela confirmará.');

  // Recargar vista de pagos
  await cargarPagos();
}

function renderEventos(lista) {
  const el = document.getElementById('eventos-list');
  const demos = [
    { titulo:'Torneo deportivo escolar', fecha:'2026-03-21', descripcion:'Equipos de fútbol y basquetbol. ¡Ven a apoyar!', icono:'⚽' },
    { titulo:'Concurso de oratoria', fecha:'2026-03-28', descripcion:'Participación voluntaria. Inscripciones abiertas.', icono:'🎤' },
    { titulo:'Junta de padres 2° bimestre', fecha:'2026-04-04', descripcion:'Entrega de calificaciones y acuerdos de grupo.', icono:'👥' },
  ];
  const data = lista.length ? lista : demos;
  el.innerHTML = data.map(e => `
    <div class="aviso-card" style="background:var(--verde-light);margin-bottom:8px">
      <div class="aviso-icon">${e.icono || '📅'}</div>
      <div style="flex:1">
        <div class="aviso-titulo">${e.titulo}</div>
        <div class="aviso-body">${e.descripcion || ''}</div>
        <div class="aviso-fecha">${formatFecha(e.fecha)}</div>
      </div>
    </div>
  `).join('');
}

function renderGaleria(lista) {
  const el = document.getElementById('galeria-list');
  el.innerHTML = lista.map(f => `
    <div class="galeria-item">
      <div class="galeria-img">${f.icono || (f.url_foto ? '' : '📸')}</div>
      <div class="galeria-caption">${f.titulo || f.descripcion || ''}</div>
    </div>
  `).join('');
}

// ─── NOTIFICACIONES MODAL ─────────────────
function showNotifsModal() {
  document.getElementById('notif-badge').style.display = 'none';
  document.getElementById('modal-notifs-list').innerHTML = `
    <div class="aviso-card" style="background:var(--verde-light)">
      <div class="aviso-icon">✅</div>
      <div><div class="aviso-titulo">Todo al día</div><div class="aviso-body">No tienes notificaciones pendientes.</div></div>
    </div>`;
  openModal('modal-notifs');
}

// ─── AUTH ─────────────────────────────────
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('btn-login');
  if (!email || !pass) { showLoginError('Ingresa tu correo y contraseña'); return; }
  btn.disabled = true; btn.textContent = 'Entrando...';
  errEl.style.display = 'none';

  let loggedIn = false;
  // Intentar en hub primero
  try {
    const { data, error } = await sbHub.auth.signInWithPassword({ email, password: pass });
    if (data?.session) {
      currentUser = data.session.user;
      loggedIn = true;
    } else if (error) throw error;
  } catch(e) {
    // Intentar en alumno db
    try {
      const { data, error } = await sbHub.auth.signInWithPassword({ email, password: pass });
      if (data?.session) { currentUser = data.session.user; loggedIn = true; }
      else throw error;
    } catch(e2) {
      showLoginError('Correo o contraseña incorrectos. Verifica los datos.');
      btn.disabled = false; btn.textContent = 'Entrar →';
      return;
    }
  }

  if (loggedIn) {
    await cargarPerfil();
    mostrarApp();
  }
  btn.disabled = false; btn.textContent = 'Entrar →';
}

async function doRegister() {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const email  = document.getElementById('reg-email').value.trim();
  const pass   = document.getElementById('reg-pass').value;
  const codigo = document.getElementById('reg-codigo').value.trim().toUpperCase();
  const errEl  = document.getElementById('reg-error');
  const btn    = document.getElementById('btn-register');

  if (!nombre||!email||!pass||!codigo) { showRegError('Completa todos los campos'); return; }
  if (pass.length < 6) { showRegError('La contraseña debe tener al menos 6 caracteres'); return; }

  btn.disabled = true; btn.textContent = 'Creando cuenta...';
  errEl.style.display = 'none';

  try {
    // Verificar código de alumno
    const { data: alumno } = await sbHub.from('usuarios')
      .select('id,nombre').eq('codigo_vinculacion', codigo).single();
    if (!alumno) { showRegError('Código de alumno no válido. Verifica con la escuela.'); btn.disabled=false; btn.textContent='Crear cuenta →'; return; }

    // Crear usuario en Supabase Auth
    const { data: authData, error: authErr } = await sbHub.auth.signUp({ email, password: pass });
    if (authErr) throw authErr;

    // Insertar en tabla usuarios
    await sbHub.from('usuarios').insert({
      auth_id: authData.user?.id, nombre, email, rol: 'padre'
    });

    // Crear vínculo padre-alumno
    if (authData.user?.id) {
      const { data: nuevoUsuario } = await sbHub.from('usuarios').select('id').eq('auth_id', authData.user.id).single();
      if (nuevoUsuario) {
        await sbHub.from('padres_alumnos').insert({ padre_id: nuevoUsuario.id, alumno_id: alumno.id });
      }
    }

    closeModal('modal-register');
    showToast('✅ Cuenta creada. Revisa tu correo para confirmar.');
  } catch(e) {
    showRegError('Error al crear la cuenta: ' + (e.message || 'Inténtalo de nuevo'));
  }
  btn.disabled = false; btn.textContent = 'Crear cuenta →';
}

// ─── VISTA LECTURA ─────────────────────────
async function cargarLectura() {
  if (!sbHub || !hijoActivo?.id) {
    document.getElementById('lectura-libros-lista').innerHTML =
      '<div style="text-align:center;padding:24px;color:var(--gris-400);font-size:13px;">Vincula a tu hij@ para ver su progreso de lectura.</div>';
    return;
  }

  try {
    // Cargar progreso de libros
    const { data: progresos } = await sbHub.from('progreso_lectura')
      .select('*, libros(titulo, autor, paginas, portada_url)')
      .eq('alumno_id', hijoActivo.id)
      .order('updated_at', { ascending: false })
      .limit(20);

    const terminados = progresos?.filter(p => p.terminado || p.porcentaje >= 100).length || 0;
    const leyendo    = progresos?.filter(p => !p.terminado && p.porcentaje > 0 && p.porcentaje < 100).length || 0;

    // Cargar XP de quiz
    const { data: quizzes } = await sbHub.from('quiz_resultados')
      .select('xp_ganado, aciertos, total, libro_id, created_at')
      .eq('alumno_id', hijoActivo.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const xpTotal = quizzes?.reduce((s, q) => s + (q.xp_ganado || 0), 0) || 0;

    // Actualizar stats
    document.getElementById('lect-terminados').textContent = terminados;
    document.getElementById('lect-leyendo').textContent    = leyendo;
    document.getElementById('lect-xp').textContent        = xpTotal + ' XP';

    // Renderizar libros
    const lista = document.getElementById('lectura-libros-lista');
    if (!progresos?.length) {
      lista.innerHTML = '<div style="text-align:center;padding:24px;color:var(--gris-400);font-size:13px;">Tu hij@ aún no ha iniciado ningún libro.</div>';
    } else {
      lista.innerHTML = progresos.map(p => {
        const libro   = p.libros || {};
        const pct     = Math.min(100, Math.round(p.porcentaje || 0));
        const color   = pct >= 100 ? '#15803d' : pct > 0 ? '#0369a1' : '#94a3b8';
        const estado  = pct >= 100 ? '✅ Terminado' : pct > 0 ? `📖 ${pct}%` : '📚 Sin iniciar';
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:12px;background:white;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:8px;">
            <div style="width:40px;height:52px;background:#e0f2fe;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">📗</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${libro.titulo || 'Libro'}</div>
              <div style="font-size:11px;color:#64748b;margin-bottom:6px;">${libro.autor || ''}</div>
              <div style="height:6px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${color};border-radius:99px;transition:.5s;"></div>
              </div>
            </div>
            <span style="font-size:11px;font-weight:700;color:${color};white-space:nowrap;">${estado}</span>
          </div>`;
      }).join('');
    }

    // Renderizar quiz
    const quizLista = document.getElementById('lectura-quiz-lista');
    if (!quizzes?.length) {
      quizLista.innerHTML = '<div style="text-align:center;padding:16px;color:var(--gris-400);font-size:13px;">Aún no ha completado ningún quiz de lectura.</div>';
    } else {
      quizLista.innerHTML = quizzes.slice(0, 5).map(q => {
        const pct   = Math.round((q.aciertos / q.total) * 100);
        const color = pct >= 80 ? '#15803d' : pct >= 60 ? '#0369a1' : '#dc2626';
        const fecha = new Date(q.created_at).toLocaleDateString('es-MX', { day:'numeric', month:'short' });
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:white;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:6px;">
            <div>
              <div style="font-size:13px;font-weight:700;">Quiz completado</div>
              <div style="font-size:11px;color:#64748b;">${fecha} · ${q.aciertos}/${q.total} respuestas correctas</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:16px;font-weight:900;color:${color};">${pct}%</div>
              <div style="font-size:10px;color:#64748b;">+${q.xp_ganado} XP</div>
            </div>
          </div>`;
      }).join('');
    }

    // Cargar informe pedagógico de lectura
    cargarLecturaIA(progresos, quizzes);

  } catch(e) {
    document.getElementById('lectura-libros-lista').innerHTML =
      `<div style="color:#dc2626;font-size:13px;padding:16px;">❌ ${e.message}</div>`;
  }
}

async function cargarLecturaIA(progresos, quizzes) {
  const el = document.getElementById('lectura-ia-texto');
  if (!el) return;
  const nombre    = hijoActivo?.nombre?.split(' ')[0] || 'tu hij@';
  const terminados = progresos?.filter(p => p.terminado || p.porcentaje >= 100).length || 0;
  const enProg    = progresos?.filter(p => !p.terminado && p.porcentaje > 0).map(p => p.libros?.titulo).filter(Boolean).join(', ') || 'ninguno';
  const promQuiz  = quizzes?.length
    ? Math.round(quizzes.reduce((s,q)=>s+(q.aciertos/q.total*100),0)/quizzes.length)
    : null;

  const prompt = `Soy padre/madre de ${nombre}, alumno/a de educación básica en México.
Libros terminados: ${terminados}. Leyendo actualmente: ${enProg}.
${promQuiz !== null ? `Promedio en quiz de comprensión: ${promQuiz}%.` : ''}
Dame un mensaje breve (2-3 oraciones) sobre su hábito lector y UNA sugerencia concreta de cómo apoyarlo desde casa. Tono cálido y motivador.`;

  try {
    const texto = await callAI({ feature: 'padre_reporte_ia', prompt });
    el.textContent = texto || 'Sin análisis disponible.';
  } catch(e) {
    el.textContent = terminados > 0
      ? `${nombre} ha completado ${terminados} libro${terminados>1?'s':''} — ¡excelente hábito lector! Sigue motivándole con pequeñas recompensas por cada libro terminado.`
      : `Anima a ${nombre} a leer al menos 15 minutos al día. Pueden elegir juntos un libro que le llame la atención.`;
  }
}

// ─── ANÁLISIS IA DEL ALUMNO (desde tabla analisis_ia) ─────────────
async function cargarAnalisisAlumno() {
  if (!sbHub || !hijoActivo?.id) return;
  try {
    const { data } = await sbHub.from('analisis_ia')
      .select('tipo, contenido, created_at')
      .eq('alumno_id', hijoActivo.id)
      .eq('tipo', 'desempeno')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return;
    const card = document.getElementById('card-analisis-alumno');
    const texto = document.getElementById('analisis-alumno-texto');
    const fecha = document.getElementById('analisis-alumno-fecha');
    if (!card || !texto) return;

    let contenido = '';
    try {
      const parsed = JSON.parse(data.contenido);
      contenido = parsed.texto || '';
    } catch { contenido = data.contenido || ''; }

    if (contenido) {
      texto.innerHTML = contenido.replace(/\n/g, '<br>');
      fecha.textContent = `Generado el ${new Date(data.created_at).toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' })} por el sistema SIEMBRA`;
      card.style.display = 'block';
    }
  } catch(e) { /* silencioso */ }
}

function doLogout() {
  if (!confirm('¿Cerrar sesión?')) return;
  try { sbHub?.auth.signOut(); } catch(e) {}
  currentUser = null; currentPerfil = null;
  document.getElementById('app').style.display = 'none';
  mostrarLogin();
}

// ─── UTILITIES ────────────────────────────
function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg; el.style.display = 'block';
}
function showRegError(msg) {
  const el = document.getElementById('reg-error');
  el.textContent = msg; el.style.display = 'block';
}
function showRegister() {
  openModal('modal-register');
}

function showSolicitudAcceso() {
  closeModal('modal-register');
  openModal('modal-solicitud-acceso');
}

async function doSolicitudAcceso() {
  const nombre  = (document.getElementById('sol-nombre')?.value || '').trim();
  const apellido= (document.getElementById('sol-apellido')?.value || '').trim();
  const email   = (document.getElementById('sol-email')?.value || '').trim();
  const tel     = (document.getElementById('sol-tel')?.value || '').trim();
  const hijo    = (document.getElementById('sol-hijo')?.value || '').trim();
  const escuela = (document.getElementById('sol-escuela')?.value || '').trim();
  const mensaje = (document.getElementById('sol-mensaje')?.value || '').trim();
  const errEl   = document.getElementById('sol-error');
  const btn     = document.getElementById('btn-solicitud');

  if (!nombre||!email||!escuela) {
    errEl.textContent='Nombre, correo y escuela son obligatorios'; errEl.style.display='block'; return;
  }

  btn.disabled=true; btn.textContent='Enviando…';
  errEl.style.display='none';

  try {
    const { error } = await sbHub.from('solicitudes_acceso').insert({
      nombre, apellido, email,
      telefono: tel||null,
      rol: 'padre',
      escuela_id: escuela,  // admin identifica por CCT o nombre
      grupo_texto: hijo||null,
      mensaje: mensaje||null,
      estado: 'pendiente',
      creado_en: new Date().toISOString(),
    });
    if (error) throw error;
    closeModal('modal-solicitud-acceso');
    showToast('✅ Solicitud enviada. El admin revisará tu acceso pronto.');
  } catch(e) {
    errEl.textContent = e.message || 'Error al enviar solicitud';
    errEl.style.display = 'block';
  }
  btn.disabled=false; btn.textContent='Enviar solicitud →';
}
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
function formatFecha(str) {
  if (!str) return '';
  try {
    return new Date(str).toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' });
  } catch(e) { return str; }
}

// ─── MODO DEMO ────────────────────────────
// Entra sin Supabase, con datos realistas de prueba
function entrarDemo() {
  if (!window.SIEMBRA_RUNTIME?.shouldAllowDemoEntry?.()) {
    showLoginError('La versión productiva no permite modo demo. Usa demo.html.');
    return;
  }
  // Perfil padre demo
  currentUser  = { id: 'demo-user-001', email: 'demo@siembra.mx' };
  currentPerfil = { id: 'demo-padre-001', nombre: 'Familia demo', email: 'demo@siembra.mx', rol: 'padre' };

  // Hijo demo
  hijoActivo = {
    id: 'demo-alumno-001',
    nombre: 'Alumno',
    apellido: 'Demo',
    grupo: '2°B · Turno matutino',
    grado_asignado: '2'
  };
  hijosData = [hijoActivo];

  // Calificaciones demo completas
  calificaciones = [
    { materia:'Matemáticas',        cal:8.4, cal_ant:7.8, icono:'📐', color:'#1D9E75' },
    { materia:'Español',            cal:7.1, cal_ant:7.4, icono:'📖', color:'#2d6fb5' },
    { materia:'Ciencias Naturales', cal:5.8, cal_ant:6.2, icono:'🔬', color:'#e05c3a' },
    { materia:'Historia',           cal:8.0, cal_ant:7.5, icono:'🗺', color:'#9b59b6' },
    { materia:'Educación Física',   cal:9.5, cal_ant:9.0, icono:'⚽', color:'#f5c842' },
    { materia:'Artes',              cal:8.8, cal_ant:8.5, icono:'🎨', color:'#e74c3c' },
    { materia:'Formación Cívica',   cal:7.6, cal_ant:7.2, icono:'🏛', color:'#16a085' },
  ];

  // Parchar funciones de DB para que usen datos demo
  _patchDemoFunctions();

  // Mostrar app
  mostrarApp();
  showToast('🧪 Modo demo activo — datos de prueba');
}

function _patchDemoFunctions() {
  // Sobreescribir cargarCalificaciones para que no llame a Supabase
  window._demoMode = true;

  // Racha demo: L-J presente, V=hoy, S-D libre
  const origStreak = renderStreak;
  window.renderStreak = function() {
    const dias = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    const estados = ['done','done','done','done','today','miss','miss'];
    const bar = document.getElementById('streak-bar');
    bar.innerHTML = dias.map((d,i) => `
      <div class="streak-day-pill ${estados[i]}">
        ${d}
        <span class="streak-label">${estados[i]==='done'?'✓':estados[i]==='today'?'⬤':'·'}</span>
      </div>
    `).join('');
  };

  // XP demo
  window.cargarXP = function() {
    document.getElementById('header-xp').textContent = '620';
  };

  // Avisos demo
  window._demoAvisos = [
    { id:1, tipo:'citatorio', titulo:'Citatorio — lunes 18 mar', descripcion:'Reunión con la maestra Rodríguez para hablar sobre el avance en Ciencias. Hora: 4:00 pm.', fecha:'2026-03-18', icono:'📋', nuevo:true },
    { id:2, tipo:'evento',    titulo:'Torneo de fútbol escolar', descripcion:'Diego está inscrito. Viernes 21 de marzo en canchas principales.', fecha:'2026-03-21', icono:'⚽', nuevo:true },
    { id:3, tipo:'aviso',     titulo:'Semana de evaluaciones', descripcion:'Del 25 al 28 de marzo — revisar agenda con tu hij@.', fecha:'2026-03-25', icono:'📝', nuevo:false },
    { id:4, tipo:'logro',     titulo:'¡Felicidades!', descripcion:'Diego obtuvo primer lugar en el concurso de lectura del bimestre.', fecha:'2026-03-10', icono:'🏆', nuevo:false },
  ];

  // Eventos demo
  window._demoEventos = [
    { titulo:'Torneo deportivo escolar',   fecha:'2026-03-21', descripcion:'Fútbol y basquetbol. ¡Ven a apoyar a Diego!', icono:'⚽' },
    { titulo:'Semana de evaluaciones',     fecha:'2026-03-25', descripcion:'Repaso en casa muy recomendado.', icono:'📝' },
    { titulo:'Junta bimestral de padres',  fecha:'2026-04-04', descripcion:'Entrega de calificaciones y acuerdos de grupo.', icono:'👥' },
    { titulo:'Vacaciones de Semana Santa', fecha:'2026-04-13', descripcion:'Del 13 al 20 de abril sin clases.', icono:'🌴' },
  ];
}

// Sobreescribir cargarAvisos para demo
const _origCargarAvisos = cargarAvisos;
window.cargarAvisos = async function() {
  if (!window._demoMode) { return _origCargarAvisos(); }
  // Separar citatorios de avisos generales
  const citatorios = window._demoAvisos?.filter(a => a.tipo === 'citatorio') || [];
  const avisos     = window._demoAvisos?.filter(a => a.tipo !== 'citatorio') || [];

  if (citatorios.length) {
    renderCitatorios(citatorios);
    const nuevos = citatorios.filter(c => c.nuevo).length;
    if (nuevos) {
      document.getElementById('notif-badge').style.display = 'flex';
      document.getElementById('notif-badge').textContent = nuevos;
    }
  }
  renderAvisosLista(avisos);
};

// Sobreescribir cargarEscuela para demo
const _origCargarEscuela = cargarEscuela;
window.cargarEscuela = async function() {
  if (!window._demoMode) { return _origCargarEscuela(); }
  renderEventos(window._demoEventos || []);
  renderGaleria([
    { titulo:'Torneo de fútbol marzo',   icono:'⚽' },
    { titulo:'Día del maestro',          icono:'🌸' },
    { titulo:'Concurso de ciencias',     icono:'🔬' },
    { titulo:'Festival cultural',        icono:'🎭' },
    { titulo:'Visita al museo',          icono:'🏛' },
    { titulo:'Clase de cocina NEM',      icono:'🍳' },
  ]);
};

// Sobreescribir cargarAISugerencia para demo (sin llamar al servidor)
const _origAI = cargarAISugerencia;
window.cargarAISugerencia = async function() {
  if (!window._demoMode) { return _origAI(); }
  await new Promise(r => setTimeout(r, 800));
  document.getElementById('ai-text').textContent =
    'El alumno vinculado necesita más apoyo en Ciencias Naturales. Esta semana dedica 10 minutos antes de dormir a preguntarle qué tema vio en clase y escúchale explicarlo con sus palabras; eso refuerza más que releer el libro.';
};

// ══════════════════════════════════════════
// RECOMPENSAS — nuevo módulo v2
// ══════════════════════════════════════════

async function cargarRecompensas() {
  await cargarPerfilPadre();
  await cargarLogrosPadre();
  await cargarTienda();
  await cargarMisCanjes();
}

async function cargarPerfilPadre() {
  if (window._demoMode) {
    document.getElementById('puntos-display').textContent = '340';
    document.getElementById('puntos-racha').textContent   = '5';
    document.getElementById('puntos-nivel').textContent   = '2';
    document.getElementById('puntos-canjeados').textContent = '1';
    return;
  }
  try {
    if (!sbHub || !currentPerfil) return;
    const { data } = await sbHub.from('perfil_padre')
      .select('*').eq('padre_id', currentPerfil.id).single();
    if (data) {
      document.getElementById('puntos-display').textContent    = data.puntos_canjeables ?? 0;
      document.getElementById('puntos-racha').textContent      = data.racha_dias ?? 0;
      document.getElementById('puntos-nivel').textContent      = data.nivel ?? 1;
    }
    const { count } = await sbHub.from('canjes')
      .select('*', { count:'exact', head:true }).eq('usuario_id', currentPerfil.id);
    document.getElementById('puntos-canjeados').textContent = count ?? 0;
  } catch(e) {}
}

async function cargarLogrosPadre() {
  const el = document.getElementById('logros-padre-grid');
  if (!el) return;
  const DEMO = [
    { icon:'👨‍👩‍👦', name:'Papá presente',    earned:true  },
    { icon:'📸', name:'Evidencia enviada', earned:true  },
    { icon:'💪', name:'Racha familiar',    earned:false },
    { icon:'🤝', name:'Junta al 100',      earned:false },
    { icon:'⭐', name:'Súper papá',        earned:false },
    { icon:'🏆', name:'Mes perfecto',      earned:false },
    { icon:'📋', name:'Sin citatorios',    earned:false },
    { icon:'🌟', name:'Primer logro',      earned:true  },
  ];
  let logros = DEMO;
  if (!window._demoMode && sbHub && currentPerfil) {
    try {
      const { data: cat } = await sbHub.from('logros_catalogo')
        .select('*').in('tipo', ['padre','ambos']);
      const { data: obt } = await sbHub.from('logros_padre')
        .select('logro_id').eq('padre_id', currentPerfil.id);
      if (cat?.length) {
        const obtIds = new Set((obt||[]).map(o => o.logro_id));
        logros = cat.map(l => ({ icon:l.icono, name:l.nombre, earned:obtIds.has(l.id) }));
      }
    } catch(e) {}
  }
  el.innerHTML = logros.map(l => `
    <div class="logro-item">
      <div class="logro-icon ${l.earned?'earned':'locked'}">${l.icon}</div>
      <div class="logro-name">${l.name}</div>
    </div>`).join('');
}

async function cargarTienda() {
  const el = document.getElementById('tienda-list');
  if (!el) return;
  let beneficios = [];
  if (!window._demoMode && sbHub) {
    try {
      const { data } = await sbHub.from('beneficios')
        .select('*, comercios(nombre,categoria)')
        .eq('activo', true).in('para_quien', ['padre','ambos'])
        .order('puntos_requeridos');
      if (data?.length) beneficios = data;
    } catch(e) {}
  }
  if (!beneficios.length) {
    beneficios = [
      { id:'b1', titulo:'15% en útiles escolares', descripcion:'Válido en cualquier compra', puntos_requeridos:200, tipo_beneficio:'descuento_porcentaje', valor:15, comercios:{nombre:'Papelería del Maestro',categoria:'papeleria'}},
      { id:'b2', titulo:'10% en ropa escolar',     descripcion:'Uniformes y ropa casual',    puntos_requeridos:300, tipo_beneficio:'descuento_porcentaje', valor:10, comercios:{nombre:'Coppel',categoria:'departamental'}},
      { id:'b3', titulo:'$50 de descuento',        descripcion:'En compras mayores a $500',  puntos_requeridos:400, tipo_beneficio:'descuento_fijo',       valor:50, comercios:{nombre:'Soriana',categoria:'supermercado'}},
      { id:'b4', titulo:'2x1 en boletos',          descripcion:'Domingo familiar',           puntos_requeridos:600, tipo_beneficio:'2x1',                  valor:0,  comercios:{nombre:'Cinépolis',categoria:'entretenimiento'}},
      { id:'b5', titulo:'Mochila gratis',          descripcion:'Con compra mínima de $300',  puntos_requeridos:800, tipo_beneficio:'producto_gratis',       valor:0,  comercios:{nombre:'Papelería del Maestro',categoria:'papeleria'}},
    ];
  }
  const pts = parseInt(document.getElementById('puntos-display').textContent) || 0;
  const ico = c => ({papeleria:'✏️',departamental:'🏬',supermercado:'🛒',entretenimiento:'🎬'}[c]||'🏪');
  const lbl = b => b.tipo_beneficio==='descuento_porcentaje'?`${b.valor}% OFF`:b.tipo_beneficio==='descuento_fijo'?`$${b.valor} OFF`:b.tipo_beneficio==='2x1'?'2x1':'GRATIS';
  el.innerHTML = beneficios.map(b => {
    const ok = pts >= b.puntos_requeridos;
    return `<div style="border:1.5px solid ${ok?'var(--verde-mid)':'var(--gris-200)'};border-radius:var(--radius-md);padding:12px;margin-bottom:8px;opacity:${ok?1:0.6}">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:44px;height:44px;border-radius:var(--radius-sm);background:${ok?'var(--verde-light)':'var(--gris-100)'};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${ico(b.comercios?.categoria)}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:800;color:var(--gris-900)">${b.titulo}</div>
          <div style="font-size:11px;color:var(--gris-400)">${b.comercios?.nombre||''} · ${b.descripcion}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:var(--font-display);font-size:13px;font-weight:900;color:${ok?'var(--verde)':'var(--gris-400)'}">${lbl(b)}</div>
          <div style="font-size:10px;color:var(--gris-400);font-weight:700">${b.puntos_requeridos} pts</div>
        </div>
      </div>
      ${ok
        ? `<button onclick="confirmarCanje('${b.id}','${b.titulo}','${b.puntos_requeridos}','${b.comercios?.nombre||''}')" style="width:100%;margin-top:10px;padding:9px;background:var(--verde);color:white;border:none;border-radius:var(--radius-sm);font-family:var(--font-display);font-size:13px;font-weight:800;cursor:pointer">Canjear ahora →</button>`
        : `<div style="text-align:center;margin-top:8px;font-size:11px;color:var(--gris-400);font-weight:700">Te faltan ${b.puntos_requeridos-pts} pts</div>`
      }</div>`;
  }).join('');
}

async function cargarMisCanjes() {
  const el = document.getElementById('canjes-list');
  if (!el) return;
  if (window._demoMode) {
    el.innerHTML = `<div style="border:1px solid var(--gris-200);border-radius:var(--radius-md);padding:12px;display:flex;gap:10px;align-items:center">
      <div style="font-size:24px">✏️</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700">15% en útiles escolares</div>
        <div style="font-size:11px;color:var(--gris-400)">Papelería del Maestro · hace 3 días</div>
        <div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:var(--verde);margin-top:3px">SIEM-AB12-CD34</div>
      </div>
      <div style="background:var(--verde-light);color:var(--verde);font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px">ACTIVO</div>
    </div>`;
    return;
  }
  try {
    if (!sbHub || !currentPerfil) return;
    const { data } = await sbHub.from('canjes')
      .select('*, beneficios(titulo,comercios(nombre))')
      .eq('usuario_id', currentPerfil.id)
      .order('created_at', { ascending:false }).limit(5);
    if (!data?.length) return;
    el.innerHTML = data.map(c => `
      <div style="border:1px solid var(--gris-200);border-radius:var(--radius-md);padding:12px;display:flex;gap:10px;align-items:center;margin-bottom:8px">
        <div style="font-size:24px">🎁</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">${c.beneficios?.titulo||'Beneficio'}</div>
          <div style="font-size:11px;color:var(--gris-400)">${c.beneficios?.comercios?.nombre||''} · ${formatFecha(c.created_at)}</div>
          <div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:var(--verde);margin-top:3px">${c.codigo_canje}</div>
        </div>
        <div style="background:${c.estado==='generado'?'var(--verde-light)':'var(--gris-200)'};color:${c.estado==='generado'?'var(--verde)':'var(--gris-400)'};font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px">${c.estado.toUpperCase()}</div>
      </div>`).join('');
  } catch(e) {}
}

function confirmarCanje(id, titulo, puntos, comercio) {
  document.getElementById('modal-canje-title').textContent = '¿Confirmar canje?';
  document.getElementById('modal-canje-body').innerHTML = `
    <div style="text-align:center;padding:8px 0 20px">
      <div style="font-size:48px;margin-bottom:12px">🛍</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:4px">${titulo}</div>
      <div style="font-size:13px;color:var(--gris-400);margin-bottom:16px">${comercio}</div>
      <div style="background:var(--coral-light);border-radius:var(--radius-md);padding:12px;margin-bottom:20px">
        <div style="font-size:13px;color:var(--coral);font-weight:700">Se descontarán <strong>${puntos} puntos</strong> de tu saldo</div>
      </div>
      <button onclick="ejecutarCanje('${id}','${titulo}','${comercio}','${puntos}')" style="width:100%;padding:13px;background:var(--verde);color:white;border:none;border-radius:var(--radius-md);font-family:var(--font-display);font-size:15px;font-weight:800;cursor:pointer;margin-bottom:8px">Sí, canjear →</button>
      <button onclick="closeModal('modal-canje')" style="width:100%;padding:11px;background:var(--gris-100);color:var(--gris-700);border:none;border-radius:var(--radius-md);font-family:var(--font-display);font-size:14px;font-weight:700;cursor:pointer">Cancelar</button>
    </div>`;
  openModal('modal-canje');
}

async function ejecutarCanje(beneficioId, titulo, comercio, puntos) {
  closeModal('modal-canje');
  const genCodigo = () => 'SIEM-'+Math.random().toString(36).substring(2,6).toUpperCase()+'-'+Math.random().toString(36).substring(2,6).toUpperCase();
  if (window._demoMode) {
    const codigo = genCodigo();
    document.getElementById('modal-codigo-comercio').textContent = `Presenta en: ${comercio}`;
    document.getElementById('modal-codigo-texto').textContent    = codigo;
    document.getElementById('modal-codigo-expira').textContent   = 'Válido por 30 días · demo';
    const pts = parseInt(document.getElementById('puntos-display').textContent)||0;
    document.getElementById('puntos-display').textContent = Math.max(0, pts - parseInt(puntos));
    openModal('modal-codigo');
    showToast('🎉 ¡Canje realizado!');
    return;
  }
  try {
    // Verificar que tiene suficientes puntos antes de insertar
    const ptsSaldo = parseInt(document.getElementById('puntos-display').textContent)||0;
    if (ptsSaldo < parseInt(puntos)) {
      showToast('⚠️ No tienes suficientes puntos'); return;
    }

    // Obtener comercio_id del beneficio
    const { data: bData } = await sbHub.from('beneficios')
      .select('comercio_id').eq('id', beneficioId).single();

    const { data, error } = await sbHub.from('canjes').insert({
      usuario_id:    currentPerfil.id,
      beneficio_id:  beneficioId,
      comercio_id:   bData?.comercio_id || null,
      puntos_usados: parseInt(puntos),
    }).select().single();
    if (error) throw error;

    document.getElementById('modal-codigo-comercio').textContent = `Presenta en: ${comercio}`;
    document.getElementById('modal-codigo-texto').textContent    = data.codigo_canje;
    document.getElementById('modal-codigo-expira').textContent   = `Válido hasta: ${formatFecha(data.fecha_expiracion)}`;
    openModal('modal-codigo');

    // Descontar puntos del perfil padre
    await sbHub.from('perfil_padre')
      .update({ puntos_canjeables: Math.max(0, ptsSaldo - parseInt(puntos)) })
      .eq('padre_id', currentPerfil.id);

    await cargarPerfilPadre();
    showToast('🎉 ¡Canje exitoso!');
  } catch(e) {
    console.error('[canje]', e);
    showToast('❌ Error al canjear: ' + (e.message || 'Intenta de nuevo'));
  }
}

function previewEvidencia(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('evidencia-img').src = e.target.result;
      document.getElementById('evidencia-preview').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
  const lbl = document.querySelector('#evidencia-label div div');
  if (lbl) lbl.textContent = file.name;
}

async function subirEvidencia() {
  const tipo   = document.getElementById('evidencia-tipo').value;
  const titulo = document.getElementById('evidencia-titulo').value.trim();
  const file   = document.getElementById('evidencia-file').files[0];
  const btn    = document.getElementById('btn-subir-evidencia');
  if (!titulo) { showToast('⚠️ Escribe una descripción'); return; }
  btn.disabled = true; btn.textContent = 'Subiendo...';
  if (window._demoMode) {
    await new Promise(r => setTimeout(r, 1200));
    showToast('📸 ¡Evidencia enviada! +15 pts para ti, +20 XP para tu hij@');
    document.getElementById('evidencia-titulo').value = '';
    document.getElementById('evidencia-preview').style.display = 'none';
    document.getElementById('evidencia-file').value = '';
    const pts = parseInt(document.getElementById('puntos-display').textContent)||340;
    document.getElementById('puntos-display').textContent = pts + 15;
    btn.disabled = false; btn.textContent = 'Subir evidencia → +15 pts';
    return;
  }
  try {
    let url_archivo = null, storage_path = null;
    if (file) {
      const ext = file.name.split('.').pop();
      storage_path = `${currentUser.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await sbHub.storage.from('evidencias').upload(storage_path, file);
      if (!upErr) {
        const { data: urlData } = sbHub.storage.from('evidencias').getPublicUrl(storage_path);
        url_archivo = urlData?.publicUrl;
      }
    }
    await sbHub.from('evidencias').insert({
      padre_id: currentPerfil.id, alumno_id: hijoActivo?.id,
      tipo, titulo, url_archivo, storage_path,
      tarea_id: window._evidenciaTareaId || null,
    });
    window._evidenciaTareaId = null; // reset after use
    showToast('📸 ¡Evidencia enviada! +15 pts para ti, +20 XP para tu hij@');
    document.getElementById('evidencia-titulo').value = '';
    document.getElementById('evidencia-preview').style.display = 'none';
    await cargarPerfilPadre();
  } catch(e) { showToast('❌ Error al subir. Intenta de nuevo.'); }
  btn.disabled = false; btn.textContent = 'Subir evidencia → +15 pts';
}
// ══════════════════════════════════════════════════════════════════
// BLOQUE B — 5 AGENTES PADRES
// ══════════════════════════════════════════════════════════════════

// ── Agente 1: Lenguaje emocional en tarjeta IA ────────────────────
// Mejora visual de ai-card: emoji estado + frase + acción
async function agente1LenguajeEmocional() {
  const card = document.getElementById('ai-card');
  if (!card || document.getElementById('ai-card-emocional')) return;
  const nombre  = hijoActivo?.nombre?.split(' ')[0] || 'tu hij@';
  const mats    = calificaciones.slice(0,6).map(getMateriaData);
  const promedio= mats.length ? (mats.reduce((s,m)=>s+m.cal,0)/mats.length) : 0;
  const bajas   = mats.filter(m=>m.cal<7);
  // Determinar estado emocional según promedio
  let emoji, estado, colorFondo, colorTexto;
  if (promedio >= 8.5)     { emoji='🌟'; estado='¡Está brillando!';       colorFondo='linear-gradient(135deg,#f0fdf4,#dcfce7)'; colorTexto='#15803d'; }
  else if (promedio >= 7.5){ emoji='😊'; estado='Va muy bien';             colorFondo='linear-gradient(135deg,#eff6ff,#dbeafe)'; colorTexto='#1d4ed8'; }
  else if (promedio >= 6.5){ emoji='💪'; estado='Puede mejorar';           colorFondo='linear-gradient(135deg,#fffbeb,#fef9c3)'; colorTexto='#b45309'; }
  else                     { emoji='❤️'; estado='Necesita tu apoyo';       colorFondo='linear-gradient(135deg,#fef2f2,#fee2e2)'; colorTexto='#b91c1c'; }

  // Inyectar header emocional arriba del ai-card
  const header = document.createElement('div');
  header.id = 'ai-card-emocional';
  header.style.cssText = `background:${colorFondo};border-radius:16px;padding:16px;margin-bottom:12px;border:1.5px solid ${colorTexto}22;`;
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="font-size:36px;line-height:1;">${emoji}</div>
      <div>
        <div style="font-size:15px;font-weight:800;color:${colorTexto};">${nombre} ${estado}</div>
        <div style="font-size:12px;color:${colorTexto};opacity:.7;margin-top:2px;">Promedio: ${promedio.toFixed(1)} · ${bajas.length>0?bajas.length+' materia'+(bajas.length>1?'s':'')+' con atención':'Todas las materias bien 🎉'}</div>
      </div>
    </div>`;
  card.insertBefore(header, card.firstChild);
}

// ── Agente 2: Acciones diarias — 3 chips con IA ───────────────────
async function agente2AccionesDiarias() {
  const view = document.getElementById('view-inicio');
  if (!view || document.getElementById('acciones-diarias-card')) return;
  const nombre  = hijoActivo?.nombre?.split(' ')[0] || 'tu hij@';
  const mats    = calificaciones.slice(0,4).map(getMateriaData);
  const bajas   = mats.filter(m=>m.cal<8).map(m=>m.nombre);

  const div = document.createElement('div');
  div.id = 'acciones-diarias-card';
  div.style.cssText = 'margin:0 16px 14px;';
  div.innerHTML = `
    <div style="font-size:11px;font-weight:800;color:var(--gris-400);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">✅ Hoy puedes hacer</div>
    <div id="acciones-chips" style="display:flex;flex-direction:column;gap:8px;">
      ${['Cargando acción 1…','Cargando acción 2…','Cargando acción 3…'].map(t=>`
        <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:white;border-radius:12px;border:1.5px solid var(--gris-100);">
          <div style="width:28px;height:28px;border-radius:50%;background:#f1f5f9;flex-shrink:0;"></div>
          <span style="font-size:13px;color:#94a3b8;">${t}</span>
        </div>`).join('')}
    </div>`;

  // Insertar después del card-resumen-materias
  const resumen = document.getElementById('card-resumen-materias');
  if (resumen?.nextSibling) view.insertBefore(div, resumen.nextSibling);
  else view.appendChild(div);

  const prompt = `Soy padre/madre de ${nombre} (educación básica México). Sus calificaciones: ${mats.map(m=>m.nombre+': '+m.cal).join(', ')}. ${bajas.length?'Necesita apoyo en: '+bajas.join(', ')+'.':''}
Genera 3 acciones MUY CORTAS (max 8 palabras cada una) que puedo hacer HOY con mi hijo. Responde SOLO con JSON: [{"emoji":"emoji","accion":"texto corto"},{"emoji":"...","accion":"..."},{"emoji":"...","accion":"..."}]`;

  try {
    const txt  = await callAI({ feature:'padre_reporte_ia', prompt, system:'Responde SOLO con el JSON. Sin markdown.' });
    const data = JSON.parse(txt.replace(/```json|```/g,'').trim());
    const chips= document.getElementById('acciones-chips');
    const colores = ['#dcfce7','#dbeafe','#fef9c3'];
    const textCol = ['#15803d','#1d4ed8','#b45309'];
    if (chips) chips.innerHTML = data.map((a,i)=>`
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:white;border-radius:12px;border:1.5px solid ${colores[i]||'#e2e8f0'};">
        <div style="width:32px;height:32px;border-radius:50%;background:${colores[i]||'#f1f5f9'};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${a.emoji||'✅'}</div>
        <span style="font-size:13px;font-weight:600;color:${textCol[i]||'#334155'};">${a.accion}</span>
      </div>`).join('');
  } catch(e) {
    const chips = document.getElementById('acciones-chips');
    if (chips) chips.innerHTML = [
      {emoji:'💬',txt:'Pregúntale qué aprendió hoy',col:'#dcfce7',tc:'#15803d'},
      {emoji:'📖',txt:`Revisa la tarea de ${bajas[0]||nombre}`,col:'#dbeafe',tc:'#1d4ed8'},
      {emoji:'⭐',txt:'Felicítale por algo de hoy',col:'#fef9c3',tc:'#b45309'},
    ].map(a=>`<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:white;border-radius:12px;border:1.5px solid ${a.col};"><div style="width:32px;height:32px;border-radius:50%;background:${a.col};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${a.emoji}</div><span style="font-size:13px;font-weight:600;color:${a.tc};">${a.txt}</span></div>`).join('');
  }
}

// ── Agente 3: Gráfica progreso lectura (Chart.js) ─────────────────
async function agente3GraficaLectura() {
  const view = document.getElementById('view-lectura');
  if (!view || document.getElementById('lectura-grafica-card')) return;
  if (!sbHub || !hijoActivo?.id) return;

  try {
    const { data: quizzes } = await sbHub.from('quiz_resultados')
      .select('pct,created_at,xp_ganado')
      .eq('alumno_id', hijoActivo.id)
      .order('created_at', { ascending: true })
      .limit(8);

    if (!quizzes?.length) return;

    const grafDiv = document.createElement('div');
    grafDiv.id = 'lectura-grafica-card';
    grafDiv.style.cssText = 'background:white;border-radius:16px;border:1.5px solid #e2e8f0;padding:16px;margin:0 0 14px;';
    grafDiv.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:12px;">📊 Comprensión lectora por quiz</div>
      <canvas id="lectura-chart" height="140"></canvas>`;

    const lista = document.getElementById('lectura-libros-lista');
    if (lista) view.querySelector('div[style*="padding"]')?.insertBefore(grafDiv, lista);
    else view.appendChild(grafDiv);

    // Esperar que Chart.js esté disponible
    const initChart = () => {
      if (typeof Chart === 'undefined') { setTimeout(initChart, 300); return; }
      const ctx = document.getElementById('lectura-chart');
      if (!ctx) return;
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: quizzes.map((_,i) => `Quiz ${i+1}`),
          datasets: [{
            label: 'Comprensión %',
            data: quizzes.map(q => q.pct || 0),
            backgroundColor: quizzes.map(q => (q.pct||0) >= 80 ? '#22c55e' : (q.pct||0) >= 60 ? '#f59e0b' : '#ef4444'),
            borderRadius: 8,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { min:0, max:100, ticks:{ callback: v => v+'%', font:{size:10} }, grid:{color:'#f1f5f9'} },
            x: { ticks:{ font:{size:10} }, grid:{display:false} }
          }
        }
      });
    };
    initChart();
  } catch(e) { console.warn('[agente3]', e.message); }
}

// ── Agente 4: Badge notificación si hay análisis nuevo ────────────
async function agente4BadgeNotificacion() {
  if (!sbHub || !hijoActivo?.id) return;
  try {
    const ayer = new Date(Date.now() - 24*60*60*1000).toISOString();
    const { data } = await sbHub.from('analisis_ia')
      .select('id,tipo,created_at')
      .eq('alumno_id', hijoActivo.id)
      .gte('created_at', ayer)
      .limit(3);

    if (!data?.length) return;

    // Añadir badge en el tab de inicio si no existe
    const tabInicio = document.querySelector("[onclick=\"switchTab('inicio')\"]");
    if (tabInicio && !document.getElementById('badge-nuevo-analisis')) {
      const badge = document.createElement('span');
      badge.id = 'badge-nuevo-analisis';
      badge.style.cssText = 'display:inline-block;background:#ef4444;color:white;font-size:9px;font-weight:800;padding:2px 5px;border-radius:99px;margin-left:4px;vertical-align:middle;';
      badge.textContent = data.length;
      tabInicio.appendChild(badge);
    }

    // Mostrar card de "análisis nuevo" en inicio si no existe
    const view = document.getElementById('view-inicio');
    if (view && !document.getElementById('card-nuevo-analisis')) {
      const nuevoCard = document.createElement('div');
      nuevoCard.id = 'card-nuevo-analisis';
      nuevoCard.style.cssText = 'margin:0 16px 14px;';
      nuevoCard.innerHTML = `
        <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:14px;padding:14px;color:white;display:flex;align-items:center;gap:12px;cursor:pointer;" onclick="switchTab('inicio')">
          <div style="font-size:28px;">🔔</div>
          <div>
            <div style="font-size:13px;font-weight:700;">Hay ${data.length} análisis nuevo${data.length>1?'s':''} de ${hijoActivo?.nombre?.split(' ')[0]||'tu hij@'}</div>
            <div style="font-size:11px;opacity:.7;margin-top:2px;">Generado${data.length>1?'s':''} en las últimas 24 horas</div>
          </div>
          <span style="margin-left:auto;font-size:18px;opacity:.7;">→</span>
        </div>`;
      const scrollPad = view.querySelector('.scroll-pad');
      if (scrollPad?.nextSibling) view.insertBefore(nuevoCard, scrollPad.nextSibling);
    }
  } catch(e) { /* silencioso */ }
}

// ── Agente 5: Reporte semanal completo exportable ─────────────────
async function agente5ReporteSemanal() {
  const view = document.getElementById('view-inicio');
  if (!view || document.getElementById('btn-reporte-semanal')) return;

  const btnDiv = document.createElement('div');
  btnDiv.style.cssText = 'margin:0 16px 14px;';
  btnDiv.innerHTML = `
    <button id="btn-reporte-semanal" onclick="agente5GenerarReporte()"
      style="width:100%;padding:14px;background:linear-gradient(135deg,#0d5c2f,#16a34a);color:white;border:none;border-radius:14px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
      📄 Ver reporte completo de esta semana
    </button>`;

  const logros = view.querySelector('.card:last-of-type');
  if (logros) view.insertBefore(btnDiv, logros);
  else view.appendChild(btnDiv);
}

async function agente5GenerarReporte() {
  const btn = document.getElementById('btn-reporte-semanal');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando reporte…'; }

  const nombre  = hijoActivo?.nombre || 'el alumno';
  const mats    = calificaciones.slice(0,6).map(getMateriaData);
  const promedio= mats.length ? (mats.reduce((s,m)=>s+m.cal,0)/mats.length).toFixed(1) : '—';
  const bajas   = mats.filter(m=>m.cal<7);
  const altas   = mats.filter(m=>m.cal>=9);

  const prompt = `Genera un reporte semanal completo para padres de ${nombre}, alumno de educación básica en México (NEM).
Calificaciones: ${mats.map(m=>m.nombre+': '+m.cal).join(', ')}.
Promedio: ${promedio}.
${altas.length?'Destacando en: '+altas.map(m=>m.nombre).join(', ')+'.':''}
${bajas.length?'Necesita apoyo en: '+bajas.map(m=>m.nombre).join(', ')+'.':''}
Incluye: 1) Resumen del desempeño, 2) Logros de la semana, 3) Áreas de mejora, 4) 3 acciones para apoyar en casa, 5) Mensaje motivador para el alumno.
Formato claro, lenguaje cálido y accesible para padres. Máximo 400 palabras.`;

  try {
    const texto = await callAI({ feature: 'padre_reporte_ia', prompt });
    // Exportar como Word
    const fecha = new Date().toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});
    const html  = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Reporte ${nombre}</title>
<style>body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.7;margin:2.5cm;}
h2{font-size:14pt;font-weight:bold;color:#0d5c2f;margin:14pt 0 6pt;border-bottom:1pt solid #e2e8f0;padding-bottom:4pt;}
.header{text-align:center;border-bottom:2pt solid #0d5c2f;padding-bottom:14pt;margin-bottom:20pt;}
.footer{font-size:9pt;color:#666;border-top:1pt solid #ccc;padding-top:8pt;margin-top:20pt;text-align:center;}
</style></head><body>
<div class="header">
  <div style="font-size:10pt;color:#64748b;text-transform:uppercase;letter-spacing:2pt;">SIEMBRA — Reporte Familiar</div>
  <div style="font-size:18pt;font-weight:bold;color:#0d5c2f;margin:8pt 0;">${nombre}</div>
  <div style="font-size:11pt;color:#475569;">Promedio general: ${promedio} · ${fecha}</div>
</div>
${texto.replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>')}
<div class="footer">Generado con SIEMBRA · ${fecha}</div>
</body></html>`;

    const blob = new Blob([html], { type:'application/msword' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `Reporte-${nombre.replace(/\s+/g,'-')}-SIEMBRA.doc`;
    a.click(); URL.revokeObjectURL(url);
    showToast('✅ Reporte descargado');
  } catch(e) {
    showToast('❌ Error al generar reporte. Verifica tu conexión.');
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '📄 Ver reporte completo de esta semana'; }
}

// ── Hook: disparar agentes al cargar vistas ───────────────────────
const _cargarInicioOrig = window.cargarInicio;
window.cargarInicio = async function() {
  await _cargarInicioOrig();
  setTimeout(agente1LenguajeEmocional, 400);
  setTimeout(agente2AccionesDiarias,   600);
  setTimeout(agente4BadgeNotificacion, 800);
  setTimeout(agente5ReporteSemanal,    200);
};

const _switchTabOrig = window.switchTab;
window.switchTab = function(tab) {
  _switchTabOrig(tab);
  if (tab === 'lectura') setTimeout(agente3GraficaLectura, 500);
};

// ── PWA: Service Worker + Install prompt ─────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(r => console.log('[SW] Registrado:', r.scope))
      .catch(e => console.warn('[SW] Error:', e));
  });
}
// Install prompt
let _pwaPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); _pwaPrompt = e;
  // Mostrar botón de instalar si existe
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'flex';
});
function pwaInstalar() {
  if (!_pwaPrompt) return;
  _pwaPrompt.prompt();
  _pwaPrompt.userChoice.then(r => {
    if (r.outcome === 'accepted') {
      const btn = document.getElementById('pwa-install-btn');
      if (btn) btn.style.display = 'none';
    }
    _pwaPrompt = null;
  });
}
window.pwaInstalar = pwaInstalar;

// ══════════════════════════════════════════════════════
//  CHAT TUTOR — PADRE
// ══════════════════════════════════════════════════════
let _padreConvId   = null;
let _padreTutorId  = null;
let _padreConvSub  = null; // Realtime subscription

async function cargarTutorChat() {
  const sb = window.sbHub;
  if (!sb || !currentPerfil) return;

  const alumnoId = currentHijo?.id;
  if (!alumnoId) { _mostrarSinTutor(); return; }

  // 1. Buscar tutor del grupo del alumno
  let tutorId = null, tutorNom = '', grupoNom = '';
  try {
    // Buscar en tutores_grupo
    const { data: tg } = await sb.from('tutores_grupo')
      .select('tutor_id, usuarios!tutor_id(id,nombre,apellido_p), grupos!grupo_id(nombre,grado)')
      .eq('activo', true)
      .eq('ciclo', window.CICLO_ACTIVO || '2025-2026');
    // Filtrar por el grupo del alumno
    const { data: ag } = await sb.from('alumnos_grupos')
      .select('grupo_id').eq('alumno_id', alumnoId).eq('activo', true).maybeSingle();
    if (ag && tg?.length) {
      const match = tg.find(t => t.grupo_id === ag.grupo_id || (t.grupos && t.grupos.id === ag.grupo_id));
      if (match?.usuarios) {
        tutorId = match.usuarios.id;
        tutorNom = `${match.usuarios.nombre||''} ${match.usuarios.apellido_p||''}`.trim();
        grupoNom = match.grupos?.nombre || `${match.grupos?.grado||''}°`;
      }
    }

    // Fallback: buscar docente con grupo_tutoria igual al grupo del alumno
    if (!tutorId && ag?.grupo_id) {
      const { data: doct } = await sb.from('usuarios')
        .select('id,nombre,apellido_p,grupo_tutoria')
        .eq('escuela_cct', currentPerfil.escuela_cct)
        .eq('es_tutor', true).maybeSingle();
      if (doct) { tutorId = doct.id; tutorNom = `${doct.nombre||''} ${doct.apellido_p||''}`.trim(); }
    }
  } catch(e) { console.warn('[ChatTutor] buscar tutor:', e.message); }

  if (!tutorId) { _mostrarSinTutor(); return; }
  _padreTutorId = tutorId;

  // 2. Mostrar info del tutor
  document.getElementById('tutor-nombre-lbl').textContent = tutorNom || 'Tutor del grupo';
  document.getElementById('tutor-grupo-lbl').textContent = grupoNom ? `Tutor de ${grupoNom}` : 'Tutor asignado';
  document.getElementById('btn-iniciar-chat').style.display = '';
  document.getElementById('sin-tutor-msg').style.display = 'none';

  // 3. Buscar conversación existente o crear
  let convId = null;
  const { data: convExist } = await sb.from('chat_conversaciones')
    .select('id').eq('tutor_id', tutorId).eq('padre_id', currentPerfil.id).eq('alumno_id', alumnoId).maybeSingle();
  if (convExist) {
    convId = convExist.id;
  } else {
    const { data: newConv } = await sb.from('chat_conversaciones').insert({
      escuela_cct: currentPerfil.escuela_cct, tutor_id: tutorId,
      padre_id: currentPerfil.id, alumno_id: alumnoId
    }).select('id').maybeSingle();
    convId = newConv?.id;
  }
  _padreConvId = convId;

  // 4. Cargar y mostrar mensajes
  if (convId) {
    document.getElementById('tutor-chat-card').style.display = '';
    document.getElementById('btn-iniciar-chat').style.display = 'none';
    await _padreCargarMensajes(convId);
    _padreSubscribeChat(convId);
  }
}

function _mostrarSinTutor() {
  document.getElementById('tutor-nombre-lbl').textContent = 'Sin tutor asignado';
  document.getElementById('tutor-grupo-lbl').textContent = '';
  document.getElementById('sin-tutor-msg').style.display = '';
  document.getElementById('tutor-chat-card').style.display = 'none';
  document.getElementById('btn-iniciar-chat').style.display = 'none';
}

async function _padreCargarMensajes(convId) {
  const sb = window.sbHub;
  const cont = document.getElementById('padre-chat-mensajes');
  if (!cont || !sb) return;
  const { data: msgs } = await sb.from('chat_mensajes')
    .select('id,contenido,emisor_id,created_at')
    .eq('conversacion_id', convId)
    .order('created_at', { ascending: true }).limit(80);

  const yo = currentPerfil?.id;
  if (!msgs?.length) {
    cont.innerHTML = '<div style="text-align:center;padding:30px;font-size:13px;color:#94a3b8;">Inicia la conversación con el tutor 👋</div>';
    return;
  }
  cont.innerHTML = msgs.map(m => {
    const esMio = m.emisor_id === yo;
    const hora = new Date(m.created_at).toLocaleTimeString('es-MX', {hour:'2-digit',minute:'2-digit'});
    return `<div style="max-width:82%;align-self:${esMio?'flex-end':'flex-start'};
      background:${esMio?'linear-gradient(135deg,#15803d,#16a34a)':'white'};
      color:${esMio?'white':'#0f172a'};
      border:${esMio?'none':'1px solid #e2e8f0'};
      border-radius:${esMio?'14px 14px 3px 14px':'14px 14px 14px 3px'};
      padding:10px 13px;font-size:13px;line-height:1.5;
      box-shadow:0 1px 3px rgba(0,0,0,.07);">
      ${m.contenido}
      <div style="font-size:9px;opacity:.55;margin-top:4px;text-align:right;">${hora}</div>
    </div>`;
  }).join('');
  cont.scrollTop = cont.scrollHeight;

  // Marcar como leídos
  await sb.from('chat_conversaciones').update({ no_leidos_padre: 0 }).eq('id', convId);
  const badge = document.getElementById('tutor-badge');
  if (badge) badge.style.display = 'none';
}

function _padreSubscribeChat(convId) {
  const sb = window.sbHub;
  if (!sb || _padreConvSub) return;
  _padreConvSub = window.SIEMBRA?.realtime?.subscribe('padre-chat-' + convId, {
      event: 'INSERT',
      table: 'chat_mensajes',
      filter: `conversacion_id=eq.${convId}`,
      onMessage: payload => {
      const m = payload.new;
      const yo = currentPerfil?.id;
      if (m.emisor_id === yo) return; // ya renderizado en optimistic
      const cont = document.getElementById('padre-chat-mensajes');
      if (!cont) return;
      const hora = new Date(m.created_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
      const div = document.createElement('div');
      div.style.cssText = 'max-width:82%;align-self:flex-start;background:white;color:#0f172a;border:1px solid #e2e8f0;border-radius:14px 14px 14px 3px;padding:10px 13px;font-size:13px;line-height:1.5;box-shadow:0 1px 3px rgba(0,0,0,.07);';
      div.innerHTML = m.contenido + `<div style="font-size:9px;opacity:.55;margin-top:4px;">${hora}</div>`;
      cont.appendChild(div);
      cont.scrollTop = cont.scrollHeight;
      // Badge en tab si no está activo
      if (activeTab !== 'tutor') {
        const badge = document.getElementById('tutor-badge');
        if (badge) { badge.style.display = 'inline-block'; badge.textContent = '•'; }
      }
      },
    });
}

async function padreIniciarChat() {
  if (!_padreTutorId || !_padreConvId) { await cargarTutorChat(); return; }
  document.getElementById('tutor-chat-card').style.display = '';
  document.getElementById('btn-iniciar-chat').style.display = 'none';
  await _padreCargarMensajes(_padreConvId);
}
window.padreIniciarChat = padreIniciarChat;

async function padreEnviarMensaje() {
  const sb = window.sbHub;
  const inp = document.getElementById('padre-chat-input');
  const texto = inp?.value?.trim();
  if (!texto || !_padreConvId || !sb) return;
  inp.value = '';
  const yo = currentPerfil?.id;
  // Optimistic
  const cont = document.getElementById('padre-chat-mensajes');
  if (cont) {
    const div = document.createElement('div');
    div.style.cssText = 'max-width:82%;align-self:flex-end;background:linear-gradient(135deg,#15803d,#16a34a);color:white;border-radius:14px 14px 3px 14px;padding:10px 13px;font-size:13px;line-height:1.5;';
    div.innerHTML = texto + '<div style="font-size:9px;opacity:.6;margin-top:4px;text-align:right;">Ahora</div>';
    cont.appendChild(div); cont.scrollTop = cont.scrollHeight;
  }
  const { error } = await sb.from('chat_mensajes').insert({ conversacion_id: _padreConvId, emisor_id: yo, contenido: texto });
  if (!error) {
    await sb.from('chat_conversaciones').update({
      ultimo_mensaje: texto, ultimo_msg_at: new Date().toISOString(), no_leidos_tutor: sb.rpc ? 0 : 1
    }).eq('id', _padreConvId);
  }
}
window.padreEnviarMensaje = padreEnviarMensaje;

// ══════════════════════════════════════════════════════════════════
// BLOQUE C-1 — Guardian Summary (Resumen semanal automático al padre)
// Inspirado en: Alma SIS, Google Classroom, FACTS Management
// ══════════════════════════════════════════════════════════════════
async function padreGenerarResumenSemanal(forceShow = false) {
  if (!sbHub || !hijoActivo?.id) return;
  const alumnoId = hijoActivo.id;
  const nombre   = hijoActivo.nombre || 'tu hijo';

  // Verificar si ya se mostró esta semana
  const semanaKey = 'guardian_summary_' + alumnoId + '_' + new Date().toISOString().slice(0, 10).slice(0, 7);
  if (!forceShow && localStorage.getItem(semanaKey)) return;

  try {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    const lunesStr = lunes.toISOString().split('T')[0];
    const hoyStr   = hoy.toISOString().split('T')[0];

    // Cargar datos de la semana
    const [asistRes, calRes, tareasRes, evidRes] = await Promise.all([
      sbHub.from('asistencia').select('fecha,estado')
        .eq('alumno_id', alumnoId).gte('fecha', lunesStr).lte('fecha', hoyStr),
      sbHub.from('calificaciones').select('materia,calificacion,periodo')
        .eq('alumno_id', alumnoId).order('created_at', { ascending: false }).limit(10),
      sbHub.from('tareas_docente').select('titulo,fecha_entrega,materia')
        .eq('grupo_id', hijoActivo.grupo_id || hijoActivo.grupo || '').gte('fecha_entrega', hoyStr).limit(5),
      sbHub.from('evidencias').select('titulo,estado,created_at')
        .eq('alumno_id', alumnoId).order('created_at', { ascending: false }).limit(3),
    ]);

    const asistencia  = asistRes.data || [];
    const cals        = calRes.data || [];
    const tareasPend  = tareasRes.data || [];
    const evidencias  = evidRes.data || [];

    const faltas  = asistencia.filter(a => ['ausente','falta','F'].includes(a.estado)).length;
    const presente= asistencia.filter(a => a.estado === 'presente').length;
    const promedio= cals.length ? (cals.reduce((s,c) => s + Number(c.calificacion||0), 0) / cals.length).toFixed(1) : null;

    // Construir tarjeta de resumen
    const tarjetaHtml = `
      <div id="guardian-summary-card" style="background:linear-gradient(135deg,#0a5c2e,#16793a);border-radius:16px;padding:20px;margin-bottom:16px;color:white;position:relative;">
        <button onclick="document.getElementById('guardian-summary-card').remove();localStorage.setItem('${semanaKey}','1');"
          style="position:absolute;top:12px;right:12px;background:rgba(255,255,255,.2);border:none;color:white;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:13px;" aria-label="Cerrar">✕</button>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:.7;margin-bottom:6px;">📋 Resumen semanal</div>
        <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;margin-bottom:14px;">${nombre}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
          <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:22px;font-weight:800;">${presente}</div>
            <div style="font-size:10px;opacity:.8;">días asistió</div>
          </div>
          <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:${faltas > 0 ? '#fca5a5' : 'white'}">${faltas}</div>
            <div style="font-size:10px;opacity:.8;">inasistencias</div>
          </div>
          ${promedio ? `
          <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:22px;font-weight:800;">${promedio}</div>
            <div style="font-size:10px;opacity:.8;">promedio</div>
          </div>` : ''}
          <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:22px;font-weight:800;">${tareasPend.length}</div>
            <div style="font-size:10px;opacity:.8;">tareas próximas</div>
          </div>
        </div>
        ${tareasPend.length ? `
        <div style="font-size:11px;font-weight:700;opacity:.8;margin-bottom:6px;">📌 PRÓXIMAS TAREAS</div>
        ${tareasPend.map(t => `<div style="font-size:12px;background:rgba(255,255,255,.1);border-radius:8px;padding:7px 10px;margin-bottom:4px;">
          ${t.titulo} · ${t.materia || ''} <span style="opacity:.7;float:right;">${t.fecha_entrega}</span>
        </div>`).join('')}` : ''}
        ${faltas > 0 ? `
        <button onclick="padreJustificarFalta()" style="margin-top:12px;width:100%;padding:10px;background:rgba(255,255,255,.2);color:white;border:1px solid rgba(255,255,255,.4);border-radius:10px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">
          📝 Justificar inasistencia
        </button>` : ''}
      </div>`;

    // Insertar al inicio de la vista de inicio
    const vistaInicio = document.getElementById('view-inicio');
    if (vistaInicio) {
      const existing = document.getElementById('guardian-summary-card');
      if (existing) existing.remove();
      vistaInicio.insertAdjacentHTML('afterbegin', tarjetaHtml);
    }

    localStorage.setItem(semanaKey, '1');
  } catch(e) {
    console.warn('[guardian-summary]', e);
  }
}
window.padreGenerarResumenSemanal = padreGenerarResumenSemanal;

// ══════════════════════════════════════════════════════════════════
// BLOQUE C-2 — Justificación de falta por padre (Edsby / ParentSquare)
// ══════════════════════════════════════════════════════════════════
async function padreJustificarFalta() {
  if (!sbHub || !hijoActivo?.id) { showToast('⚠️ Sin sesión activa', 'warn'); return; }

  const motivos = ['Enfermedad', 'Cita médica', 'Emergencia familiar', 'Viaje', 'Otro motivo'];
  const optsHtml = motivos.map(m => `<option value="${m}">${m}</option>`).join('');

  // Obtener últimas faltas
  const { data: faltas } = await sbHub.from('asistencia')
    .select('id,fecha,estado')
    .eq('alumno_id', hijoActivo.id)
    .in('estado', ['ausente','falta','F'])
    .order('fecha', { ascending: false }).limit(5);

  const faltasOpts = (faltas || []).map(f =>
    `<option value="${f.id}">${f.fecha}</option>`
  ).join('');

  if (!faltasOpts) { showToast('Sin inasistencias recientes para justificar', 'ok'); return; }

  // Mostrar modal de justificación
  const modalHtml = `
    <div id="modal-justificar" onclick="if(event.target===this)this.remove()"
      style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:20px;">
      <div style="background:white;border-radius:20px 20px 16px 16px;padding:24px;width:100%;max-width:440px;">
        <div style="font-family:'Fraunces',serif;font-size:17px;font-weight:700;margin-bottom:16px;">📝 Justificar inasistencia</div>
        <div style="margin-bottom:12px;">
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">Fecha de la falta</label>
          <select id="jf-fecha" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;">${faltasOpts}</select>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">Motivo</label>
          <select id="jf-motivo" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;">${optsHtml}</select>
        </div>
        <div style="margin-bottom:16px;">
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">Descripción (opcional)</label>
          <textarea id="jf-desc" rows="2" placeholder="Describe brevemente el motivo…"
            style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;resize:none;box-sizing:border-box;"></textarea>
        </div>
        <button onclick="padreEnviarJustificacion()" style="width:100%;padding:13px;background:#0a5c2e;color:white;border:none;border-radius:12px;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">✅ Enviar justificación</button>
        <button onclick="document.getElementById('modal-justificar').remove()" style="margin-top:8px;width:100%;padding:10px;background:transparent;border:none;font-family:'Sora',sans-serif;font-size:13px;color:#64748b;cursor:pointer;">Cancelar</button>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function padreEnviarJustificacion() {
  const asistenciaId = document.getElementById('jf-fecha')?.value;
  const motivo       = document.getElementById('jf-motivo')?.value || 'Otro motivo';
  const descripcion  = document.getElementById('jf-desc')?.value.trim() || '';

  if (!asistenciaId) { showToast('⚠️ Selecciona la fecha', 'warn'); return; }

  try {
    // Guardar justificación en Supabase (campo justificacion_padre en asistencia)
    if (sbHub) {
      await sbHub.from('asistencia').update({
        justificacion_padre: `${motivo}${descripcion ? ': ' + descripcion : ''}`,
        justificado:         true,
        justificado_en:      new Date().toISOString(),
      }).eq('id', asistenciaId);
    }
    document.getElementById('modal-justificar')?.remove();
    showToast('✅ Justificación enviada al docente');
  } catch(e) {
    showToast('❌ ' + e.message, 'warn');
  }
}

window.padreJustificarFalta     = padreJustificarFalta;
window.padreEnviarJustificacion = padreEnviarJustificacion;

// Disparar Guardian Summary al cargar la vista de inicio (lunes o forzado)
const _cargarVistaOrig = window.cargarVista;
window.cargarVista = function(tab) {
  if (typeof _cargarVistaOrig === 'function') _cargarVistaOrig(tab);
  if (tab === 'inicio' && hijoActivo?.id) {
    const esLunes = new Date().getDay() === 1;
    setTimeout(() => padreGenerarResumenSemanal(esLunes), 600);
  }
};

if (window.SiembraPadresAuth) {
  Object.assign(window, {
    doLogin: window.SiembraPadresAuth.doLogin,
    doLogout: window.SiembraPadresAuth.doLogout,
  });
}
