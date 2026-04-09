
// Usuario actual en sesión
let currentUser = null;
let currentPerfil = null;

// ── Verificar sesión activa al cargar página ──
window.addEventListener('DOMContentLoaded', async () => {
  if (window.SiembraAlumnoAuth?.bootstrapAlumnoSession) {
    await window.SiembraAlumnoAuth.bootstrapAlumnoSession();
    return;
  }
  window.SIEMBRA_RUNTIME?.setVisible?.('alumno-demo-wrap', !!window.SIEMBRA_RUNTIME?.shouldAllowDemoEntry?.(), 'block');
  // ── Verificar token de invitación en URL ──
  const _urlParams = new URLSearchParams(location.search);
  const _inviteToken = _urlParams.get('invite') || _urlParams.get('token');
  if (_inviteToken) {
    history.replaceState({}, '', location.pathname);
    mostrarRegistroAlumnoConToken(_inviteToken);
    return;
  }
  try {
    if (sb) {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        currentUser = session.user;
        await cargarPerfil();
        mostrarApp();
        // Arrancar watcher de sesión una vez que hay sesión válida
        if (window.SIEMBRA?.sessionWatcher) {
          window.SIEMBRA.sessionWatcher.start();
        }
      }
    }
  } catch(e) { console.warn('Error de sesión:', e); }
});

// ── Cargar perfil del alumno desde DB ──
async function cargarPerfil() {
  try {
    const { data, error } = await sb.from('usuarios')
      .select('*, perfil_alumno(*)')
      .eq('auth_id', currentUser.id)
      .single();
    if (data) {
      currentPerfil = data;
      const nombre = [data.nombre, data.apellido_p, data.apellido_m].filter(Boolean).join(' ') || data.nombre || '—';
      const xpTotal = data.perfil_alumno?.xp_total ?? 0;
      const racha = data.perfil_alumno?.racha_dias ?? 0;
      const nivel = data.perfil_alumno?.nivel ?? 1;
      // Header elements
      const nombreEl = document.getElementById('hero-name');
      if (nombreEl) nombreEl.textContent = nombre;
      const hdrAvEl = document.getElementById('hdr-avatar');
      if (hdrAvEl) hdrAvEl.textContent = nombre.charAt(0).toUpperCase();
      const xpEl = document.getElementById('header-xp-val');
      if (xpEl) xpEl.textContent = xpTotal + ' XP';
      const rachaEl = document.getElementById('header-streak-val');
      if (rachaEl) rachaEl.textContent = racha + '🔥';
      // Perfil page elements
      const pNomEl = document.getElementById('perfil-nombre');
      if (pNomEl) pNomEl.textContent = nombre;
      const pGradoEl = document.getElementById('perfil-grado');
      if (pGradoEl) pGradoEl.textContent = `${data.alumnos_grupos?.[0]?.grupos?.grado ?? ''}° ${data.alumnos_grupos?.[0]?.grupos?.seccion ?? ''} · Ciclo ${window.CICLO_ACTIVO || '2025–2026'}`;
      const pChipsEl = document.getElementById('perfil-chips');
      if (pChipsEl) pChipsEl.innerHTML = `<span class="perfil-chip">🌿 Nivel ${nivel}</span><span class="perfil-chip">⭐ ${xpTotal.toLocaleString()} XP</span><span class="perfil-chip">🔥 ${racha} días racha</span>`;
      // Cargar calificaciones reales y reemplazar datos demo
      await cargarCalificacionesReales();
      await cargarXPLogros();
    }
  } catch(e) { console.warn('Error cargando perfil:', e); }
}

// ── Cargar calificaciones reales del hub ──
async function cargarCalificacionesReales() {
  if (!sb || !currentPerfil) return;
  try {
    const { data, error } = await sb.from('calificaciones')
      .select('materia, calificacion, trimestre, aspecto, ciclo')
      .eq('alumno_id', currentPerfil.id)
      .eq('ciclo', window.CICLO_ACTIVO || '2025-2026')
      .order('materia');
    if (!data?.length) {
      // Sin calificaciones reales → limpiar demo y mostrar estado vacío
      window._sinCalificaciones = true;
      materias.forEach(m => { m.cal = null; m.bimestres = [0,0,0,0,0]; m.estado = 'sin-datos'; m.sugerencia = 'Tu docente aún no ha capturado calificaciones para este ciclo.'; });
      return;
    }
    window._sinCalificaciones = false;

    // Agrupar por materia → calcular promedio por bimestre/trimestre
    const porMateria = {};
    data.forEach(c => {
      const m = c.materia;
      if (!porMateria[m]) porMateria[m] = { bimestres: {}, cals: [] };
      const trim = parseInt(c.trimestre) || 1;
      if (!porMateria[m].bimestres[trim]) porMateria[m].bimestres[trim] = [];
      porMateria[m].bimestres[trim].push(parseFloat(c.calificacion) || 0);
      porMateria[m].cals.push(parseFloat(c.calificacion) || 0);
    });

    // Actualizar array materias con datos reales
    Object.keys(porMateria).forEach(nombreMat => {
      const matExist = materias.find(m =>
        m.nombre.toLowerCase().includes(nombreMat.toLowerCase()) ||
        nombreMat.toLowerCase().includes(m.nombre.toLowerCase())
      );
      const bData = porMateria[nombreMat].bimestres;
      const bimArr = [1,2,3,4,5].map(t => {
        if (!bData[t]?.length) return 0;
        return Math.round((bData[t].reduce((a,b)=>a+b,0) / bData[t].length) * 10) / 10;
      });
      const cals = porMateria[nombreMat].cals;
      const promedio = cals.length
        ? Math.round((cals.reduce((a,b)=>a+b,0)/cals.length) * 10) / 10
        : 0;

      if (matExist) {
        matExist.cal = promedio;
        matExist.bimestres = bimArr;
        // Calcular tendencia comparando último vs penúltimo bimestre
        const ultimos = bimArr.filter(b => b > 0);
        if (ultimos.length >= 2) {
          const diff = ultimos[ultimos.length-1] - ultimos[ultimos.length-2];
          matExist.tendencia = diff > 0.2 ? 'up' : diff < -0.2 ? 'down' : 'eq';
        }
        matExist.estado = promedio >= 9 ? 'excelente' : promedio >= 8 ? 'bien' : promedio >= 6 ? 'regular' : 'riesgo';
      } else {
        // Materia nueva que no está en el array demo — agregarla
        const META_ALUMNO = {
          'Lengua Materna (Español)':     { emoji:'📖', color:'#1e40af' },
          'Español':                      { emoji:'📖', color:'#1e40af' },
          'Matemáticas':                  { emoji:'📐', color:'#166534' },
          'Ciencias Naturales y Tecnología':{ emoji:'🔬', color:'#0369a1' },
          'Ciencias (Biología)':          { emoji:'🧬', color:'#059669' },
          'Ciencias (Física)':            { emoji:'⚡', color:'#0369a1' },
          'Ciencias (Química)':           { emoji:'🧪', color:'#7c3aed' },
          'Historia':                     { emoji:'🗺', color:'#9b59b6' },
          'Geografía':                    { emoji:'🌎', color:'#059669' },
          'Formación Cívica y Ética':     { emoji:'🏛', color:'#16a085' },
          'Educación Física':             { emoji:'⚽', color:'#f5c842' },
          'Educación Artística':          { emoji:'🎨', color:'#e74c3c' },
          'Artes':                        { emoji:'🎨', color:'#e74c3c' },
          'Lenguajes':                    { emoji:'📖', color:'#1e40af' },
          'Saberes y Pensamiento Científico':{ emoji:'🔬', color:'#166534' },
          'Ética, Naturaleza y Sociedades':{ emoji:'🌍', color:'#7c3aed' },
          'De lo Humano y lo Comunitario':{ emoji:'🤝', color:'#c2410c' },
        };
        const meta = META_ALUMNO[nombreMat] || { emoji:'📚', color:'#64748b' };
        materias.push({
          nombre: nombreMat,
          cal: promedio,
          bimestres: bimArr,
          tendencia: 'eq',
          estado: promedio >= 9 ? 'excelente' : promedio >= 8 ? 'bien' : promedio >= 6 ? 'regular' : 'riesgo',
          emoji: meta.emoji,
          color: meta.color,
        });
      }
    });

    // Guardar para análisis IA
    window._calificacionesReales = porMateria;
  } catch(e) { console.warn('Error cargando calificaciones:', e); }
}

// ── Cargar XP y logros reales ──
async function cargarXPLogros() {
  if (!sb || !currentPerfil) return;
  try {
    // XP recientes
    const { data: xpData } = await sb.from('xp_eventos_alumno')
      .select('cantidad, tipo, motivo, fecha')
      .eq('alumno_id', currentPerfil.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (xpData?.length) {
      window._xpEventos = xpData;
      // Mostrar en historial si existe el elemento
      const histEl = document.getElementById('xp-historial');
      if (histEl) {
        histEl.innerHTML = xpData.slice(0,5).map(x => `
          <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border-2);">
            <span style="font-size:16px;">${{asistencia:'✅',tarea:'📝',proyecto:'🔬',participacion:'🙋',docente_especial:'⭐',mejora_trabajo:'💪',concurso:'🏆'}[x.tipo]||'✨'}</span>
            <div style="flex:1;font-size:12px;color:var(--texto-2);">${x.motivo||x.tipo}</div>
            <span style="font-size:13px;font-weight:800;color:var(--verde);">+${x.cantidad} XP</span>
          </div>`).join('');
      }
    }

    // Logros reales
    const { data: logrosData } = await sb.from('logros_alumno')
      .select('logro_id, logros_catalogo(nombre,icono)')
      .eq('alumno_id', currentPerfil.id);

    if (logrosData?.length) {
      const logrosObtenidos = new Set(logrosData.map(l => l.logros_catalogo?.nombre).filter(Boolean));
      logros.forEach(l => {
        if (logrosObtenidos.has(l.nombre)) l.desbloqueado = true;
      });
    }
  } catch(e) { console.warn('Error cargando XP/logros:', e); }
}

// ── Análisis IA consolidado de todas las materias ──
async function generarAnalisisIA() {
  const el = document.getElementById('ia-analisis-texto');
  const btn = document.getElementById('btn-ia-analisis');
  if (!el) return;

  el.innerHTML = '<div style="display:flex;align-items:center;gap:8px;color:var(--texto-2);font-size:13px;"><span style="display:inline-block;width:16px;height:16px;border:2px solid var(--verde);border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite;"></span> Generando análisis personalizado…</div>';
  if (btn) btn.disabled = true;

  try {
    const nombre = currentPerfil?.nombre || 'el alumno';
    const resumen = materias.map(m => `${m.nombre}: ${m.cal ?? 'sin datos'} (${m.estado})`).join(', ');
    const bajas = materias.filter(m => m.cal != null && m.cal < 7).map(m => m.nombre);
    const altas = materias.filter(m => m.cal != null && m.cal >= 9).map(m => m.nombre);

    const prompt = `Eres un orientador educativo experto en la Nueva Escuela Mexicana (NEM) de México.
Analiza el desempeño académico de ${nombre}, alumno de primaria/secundaria:
Calificaciones: ${resumen}
${bajas.length ? `Materias que necesitan apoyo: ${bajas.join(', ')}` : ''}
${altas.length ? `Materias donde destaca: ${altas.join(', ')}` : ''}

Genera un análisis breve (4-5 oraciones) que incluya:
1. Reconocimiento de fortalezas específicas
2. Área de mayor oportunidad (sin ser negativo)
3. UNA recomendación práctica concreta para el alumno
4. Mensaje motivador final alineado a los valores NEM

Tono: cálido, directo, motivador. Habla directamente al alumno (usa "tú").
NO uses listas ni bullets. Solo párrafo continuo.`;

    const texto = await callAI({ feature: 'analisis_alumno', prompt });
    el.innerHTML = `<div style="line-height:1.7;font-size:14px;color:var(--texto);">${texto.replace(/\n/g,'<br>')}</div>
      <div style="margin-top:10px;font-size:11px;color:var(--texto-2);display:flex;align-items:center;gap:4px;">
        <span>✨</span> Análisis generado con IA · basado en tus calificaciones reales
      </div>`;
    // Guardar para que padres.html lo pueda ver
    if (sb && currentPerfil) {
      sb.from('analisis_ia').insert({
        alumno_id:  currentPerfil.id,
        tipo:       'desempeno',
        contenido:  JSON.stringify({ texto, materias: resumen, bajas, altas }),
        created_at: new Date().toISOString(),
      }).catch(()=>{});
    }
  } catch(e) {
    // Fallback análisis estático
    const nombre = currentPerfil?.nombre?.split(' ')[0] || 'tú';
    const bajas = materias.filter(m => m.cal != null && m.cal < 7);
    const altas = materias.filter(m => m.cal != null && m.cal >= 9);
    const matsConCal2 = materias.filter(m => m.cal != null);
    const promedio = matsConCal2.length ? (matsConCal2.reduce((s,m)=>s+m.cal,0)/matsConCal2.length).toFixed(1) : '—';
    el.innerHTML = `<div style="line-height:1.7;font-size:14px;color:var(--texto);">
      ${nombre}, tu promedio general es <strong>${promedio}</strong>.
      ${altas.length ? `Destacas especialmente en <strong>${altas[0].nombre}</strong>${altas[1]?' y <strong>'+altas[1].nombre+'</strong>':''}, donde tu desempeño es sobresaliente.` : ''}
      ${bajas.length ? `Te recomendamos poner especial atención en <strong>${bajas[0].nombre}</strong> — dedica 15 minutos diarios de repaso y notarás la diferencia muy pronto.` : 'Todas tus materias van muy bien — ¡sigue así!'}
      Recuerda que en la NEM lo más importante es tu aprendizaje integral. ¡Tú puedes lograrlo! 🌱
    </div>`;
  }
  if (btn) { btn.disabled = false; btn.textContent = '🔄 Regenerar análisis'; }
}
async function registrarActividad() {
  if (!currentUser || !currentPerfil) return;
  const hoy = new Date().toISOString().split('T')[0];
  const { data: perfil } = await sb.from('perfil_alumno')
    .select('ultimo_login, racha_dias')
    .eq('alumno_id', currentPerfil.id)
    .single();
  if (!perfil) return;
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  const ayerStr = ayer.toISOString().split('T')[0];
  let nuevaRacha = perfil.racha_dias || 0;
  if (perfil.ultimo_login === ayerStr) nuevaRacha++;
  else if (perfil.ultimo_login !== hoy) nuevaRacha = 1;
  await sb.from('perfil_alumno').update({ ultimo_login: hoy, racha_dias: nuevaRacha })
    .eq('alumno_id', currentPerfil.id);
}

// ── Sumar XP ──
async function sumarXP(cantidad, motivo) {
  if (!currentPerfil) return;
  await sb.from('historial_xp').insert({
    alumno_id: currentPerfil.id,
    cantidad,
    motivo
  });
  await sb.from('perfil_alumno')
    .update({ xp_total: (currentPerfil.perfil_alumno?.xp_total || 0) + cantidad })
    .eq('alumno_id', currentPerfil.id);
  // Refrescar perfil en pantalla
  await cargarPerfil();
}

// ── Guardar progreso de lectura ──
async function guardarProgresoLibro(libroId, paginaActual, totalPaginas) {
  if (!currentPerfil) return;
  const porcentaje = Math.round((paginaActual / totalPaginas) * 100);
  const completado = porcentaje >= 100;
  await sb.from('progreso_lectura').upsert({
    alumno_id: currentPerfil.id,
    libro_id: libroId,
    pagina_actual: paginaActual,
    porcentaje,
    completado,
    ultimo_acceso: new Date().toISOString()
  }, { onConflict: 'alumno_id,libro_id' });
  if (completado) await sumarXP(50, 'Libro completado');
}

// ── Cargar libros de la biblioteca desde DB ──
async function cargarLibrosDB() {
  if (!currentPerfil) return null;
  // Libros asignados al grupo del alumno
  const { data: grupos } = await sb.from('alumnos_grupos')
    .select('grupo_id').eq('alumno_id', currentPerfil.id);
  if (!grupos?.length) return null;
  const grupoIds = grupos.map(g => g.grupo_id);
  const { data: librosGrupo } = await sb.from('libros_grupos')
    .select('libro_id, obligatorio, libros(*)')
    .in('grupo_id', grupoIds);
  if (!librosGrupo?.length) return null;
  // Obtener progreso de cada libro
  const librosIds = librosGrupo.map(l => l.libro_id);
  const { data: progresos } = await sb.from('progreso_lectura')
    .select('*').eq('alumno_id', currentPerfil.id).in('libro_id', librosIds);
  // Combinar libro + progreso
  return librosGrupo.map(lg => ({
    ...lg.libros,
    obligatorio: lg.obligatorio,
    progreso: progresos?.find(p => p.libro_id === lg.libro_id)?.porcentaje || 0
  }));
}

// ── Registro con token de invitación ──────────────────────────────
async function mostrarRegistroAlumnoConToken(token) {
  // Verificar token
  let inv = null;
  try {
    if (sb) {
      const { data } = await sb.from('invitaciones')
        .select('*').eq('token', token).maybeSingle();
      inv = data;
    }
  } catch(e) {}

  const loginEl = document.getElementById('login-screen');
  if (!loginEl) return;
  loginEl.style.display = 'flex';

  if (!inv || inv.estado === 'usado') {
    loginEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:24px;text-align:center;">
      <div style="font-size:56px;margin-bottom:16px;">${inv?.estado==='usado'?'⚠️':'❌'}</div>
      <div style="font-size:20px;font-weight:800;margin-bottom:8px;">${inv?.estado==='usado'?'Invitación ya usada':'Link inválido'}</div>
      <div style="font-size:14px;color:#64748b;margin-bottom:24px;">${inv?.estado==='usado'?'Esta invitación ya fue utilizada. Inicia sesión si ya tienes cuenta.':'Este enlace no es válido o expiró. Pídele a tu escuela uno nuevo.'}</div>
      <button onclick="location.href='alumno.html'" style="padding:12px 24px;background:#0d5c2f;color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">Ir al inicio de sesión →</button>
    </div>`;
    return;
  }

  loginEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
    <div style="background:white;border-radius:24px;padding:32px;width:100%;max-width:380px;box-shadow:0 8px 40px rgba(0,0,0,.12);">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:48px;margin-bottom:10px;">🌱</div>
        <div style="font-size:22px;font-weight:800;color:#0d1a0f;">¡Bienvenido/a a SIEMBRA!</div>
        <div style="font-size:14px;color:#64748b;margin-top:6px;">Tu escuela te invitó. Crea tu cuenta para acceder a tus calificaciones, tareas y más.</div>
      </div>
      <input type="text"     id="areg-nombre" placeholder="Tu nombre completo"             value="${inv.nombre_destino||''}" style="width:100%;padding:12px 14px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;">
      <input type="email"    id="areg-email"  placeholder="tu@correo.com"                  value="${inv.email_destino||''}"  style="width:100%;padding:12px 14px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;" ${inv.email_destino?'readonly':''}>
      <input type="password" id="areg-pass"   placeholder="Crea una contraseña (mín. 8)"                                        style="width:100%;padding:12px 14px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;">
      <input type="password" id="areg-pass2"  placeholder="Repite la contraseña"                                                  style="width:100%;padding:12px 14px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:16px;">
      <button id="areg-btn" onclick="alumnoRegistrarConToken('${token}')" style="width:100%;padding:13px;background:linear-gradient(135deg,#0d5c2f,#157a40);color:white;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;">Crear mi cuenta →</button>
      <div id="areg-error" style="color:#dc2626;font-size:13px;margin-top:10px;display:none;"></div>
    </div>
  </div>`;
}

async function alumnoRegistrarConToken(token) {
  const nombre = document.getElementById('areg-nombre')?.value.trim();
  const email  = document.getElementById('areg-email')?.value.trim().toLowerCase();
  const pass   = document.getElementById('areg-pass')?.value;
  const pass2  = document.getElementById('areg-pass2')?.value;
  const errEl  = document.getElementById('areg-error');
  const btn    = document.getElementById('areg-btn');
  const showErr = msg => { if(errEl){errEl.textContent=msg;errEl.style.display='block';} };

  if (!nombre)         return showErr('⚠️ Ingresa tu nombre completo.');
  if (!email)          return showErr('⚠️ Ingresa tu correo.');
  if (pass.length < 8) return showErr('⚠️ La contraseña debe tener al menos 8 caracteres.');
  if (pass !== pass2)  return showErr('⚠️ Las contraseñas no coinciden.');

  if (btn) { btn.textContent = '⏳ Creando cuenta…'; btn.disabled = true; }
  try {
    if (typeof SIEMBRA !== 'undefined') {
      const r = await SIEMBRA.auth.registrarConToken(token, nombre, email, pass);
      if (r.error) throw r.error;
      const lr = await SIEMBRA.auth.login(email, pass);
      if (lr.error) throw lr.error;
    } else {
      // Fallback directo
      const inv = await sb.from('invitaciones').select('*').eq('token', token).maybeSingle().then(r => r.data);
      const { data: authData, error: ae } = await sb.auth.signUp({ email, password: pass });
      if (ae) throw ae;
      const partes = nombre.trim().split(/\s+/);
      await sb.from('usuarios').upsert({
        auth_id: authData.user.id, email, nombre: partes[0],
        apellido_p: partes[1]||'', apellido_m: partes[2]||'',
        rol: 'alumno', activo: true,
        escuela_cct: inv?.escuela_cct||null, escuela_id: inv?.escuela_id||null,
      }, { onConflict: 'email' });
      await sb.from('invitaciones').update({ estado:'usado', usado_at: new Date().toISOString() }).eq('token', token);
      const { data: { session } } = await sb.auth.signInWithPassword({ email, password: pass });
      currentUser = session?.user;
    }
    currentUser = window.currentUser || currentUser;
    await cargarPerfil();
    mostrarApp();
  } catch(e) {
    showErr('❌ ' + (e.message || 'Error al crear la cuenta.'));
    if (btn) { btn.textContent = 'Crear mi cuenta →'; btn.disabled = false; }
  }
}

function mostrarApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('app').style.flexDirection = 'column';
  initApp();
  registrarActividad();
}