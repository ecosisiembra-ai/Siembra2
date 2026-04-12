// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// SIEMBRA · Módulo Administradora v1
// Este archivo se carga dentro del hub — agrega funciones completas
// para el panel de la administradora (secretaria escolar)
// Conecta a: maoioxmnfzzwnuinesyt
// ═══════════════════════════════════════════════════════════════════
// INSTRUCCIONES DE USO:
// 1. Guarda este archivo como siembra-admin-module.js
// 2. En siembra-hub-v20.html, antes del </body>, agrega:
//    [script src="siembra-admin-module.js"]
// 3. O pega TODO el contenido al final del <script> del hub
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// SELECTOR DE ESCUELA — para docentes/admins con múltiples escuelas
// ═══════════════════════════════════════════════════════
async function ADM_mostrarSelectorEscuela(escuelas) {
  const container = document.createElement('div');
  container.id = 'adm-school-picker';
  container.style.cssText = 'position:fixed;inset:0;background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 50%,#f0f9ff 100%);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  container.innerHTML = `
    <div style="background:white;border-radius:20px;padding:36px;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,0.12);text-align:center;">
      <div style="width:60px;height:60px;background:#f0fdf4;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 16px;">🏫</div>
      <h2 style="font-family:'Fraunces',serif;font-size:22px;color:#0d5c2f;margin-bottom:6px;">Selecciona tu escuela</h2>
      <p style="font-size:13px;color:#64748b;margin-bottom:24px;">Estás registrado/a en ${escuelas.length} escuelas. Elige con cuál trabajar:</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${escuelas.map(e => {
          const esc = e.escuelas || {};
          const nombre = esc.nombre || e.escuela_cct;
          const cct = esc.cct || e.escuela_cct;
          const nivel = esc.nivel || 'primaria';
          return `<button onclick="ADM_seleccionarEscuela('${cct}','${nombre.replace(/'/g,"\\'")}','${nivel}')"
            style="padding:16px 20px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;font-family:inherit;font-size:14px;font-weight:700;color:#0f172a;cursor:pointer;text-align:left;transition:.2s;display:flex;align-items:center;gap:12px;"
            onmouseover="this.style.borderColor='#0d5c2f';this.style.background='#f0fdf4'" onmouseout="this.style.borderColor='#e2e8f0';this.style.background='#f8fafc'">
            <span style="font-size:24px;">${nivel==='secundaria'?'🎓':'📚'}</span>
            <div>
              <div>${nombre}</div>
              <div style="font-size:11px;color:#64748b;font-weight:400;">CCT: ${cct} · ${nivel}</div>
            </div>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  document.body.appendChild(container);
}

function ADM_seleccionarEscuela(cct, nombre, nivel) {
  // Update profile with selected school
  if (window.currentPerfil) {
    window.currentPerfil.escuela_cct = cct;
    window.currentPerfil.escuela_nombre = nombre;
  }
  // Remove picker
  const picker = document.getElementById('adm-school-picker');
  if (picker) picker.remove();
  // Show admin portal
  document.getElementById('admin-portal').style.display = 'block';
  if (window.ADM?.init) {
    ADM.sb = sb;
    ADM.currentPerfil = window.currentPerfil;
    ADM.currentUser = window.currentUser;
    ADM.hubToast = hubToast;
    ADM.escuelaCct = cct;
    ADM.escuelaNombre = nombre;
    ADM.escuelaNivel = nivel;
    window._admNivelActivo = nivel;
    window._nivelActivo = nivel;
    ADM.init();
  }
}

window.ADM = window.ADM || {};
ADM._initialized = false;
ADM.escuelaCct = null;
ADM.escuelaId  = null;

// ── Estado del módulo ─────────────────────────────────────────────
ADM.grupos    = ADM.grupos   || [];
ADM.docentes  = ADM.docentes || [];
ADM.alumnos   = ADM.alumnos  || [];
ADM.materias  = ADM.materias || [];
ADM.paginaActual = 'adm-dashboard';

ADM._normalizarNivel = function(nivel) {
  const raw = String(nivel || '').toLowerCase().trim();
  if (raw === 'primaria_y_secundaria') return 'ambos';
  if (raw === 'primaria' || raw === 'secundaria' || raw === 'ambos') return raw;
  return 'secundaria';
};

ADM._escuelaManejaAmbos = function() {
  const raw = ADM._normalizarNivel(ADM.escuelaNivelRaw || window._escuelaCfg?.nivel || ADM.escuelaNivel);
  return raw === 'ambos';
};

ADM._nivelFormPersonal = function() {
  if (ADM._escuelaManejaAmbos()) {
    return ADM._normalizarNivel(ADM._personalNivelDraft || ADM.escuelaNivel || 'secundaria');
  }
  return ADM._normalizarNivel(ADM.escuelaNivel || ADM.escuelaNivelRaw || 'secundaria');
};

// ── Inicialización ────────────────────────────────────────────────
ADM.init = async function() {
  // FIX: Sincronizar escuelaCct ANTES del guard para que un reload
  // que ya tiene currentPerfil no quede con ADM.escuelaCct = null.
  if (window.currentPerfil) {
    ADM.currentPerfil = window.currentPerfil;
    ADM.escuelaId  = window.currentPerfil.escuela_id  || ADM.escuelaId  || null;
    ADM.escuelaCct = window.currentPerfil.escuela_cct || ADM.escuelaCct || null;
  }
  // FIX: El guard ahora solo evita doble-init si ya tenemos CCT Y datos cargados.
  // Si escuelaCct llegó null en la init anterior, SIEMPRE reintentar.
  if (ADM._initialized && ADM.escuelaCct && (ADM.grupos.length || ADM.docentes.length || ADM.alumnos.length)) {
    console.log('[ADM] Ya inicializado con datos, skip');
    return;
  }
  ADM._initialized = true;
  console.log('[ADM] Iniciando panel administradora...');

  // Siempre sincronizar desde window.currentPerfil primero (disponible inmediatamente)
  if (window.currentPerfil) {
    ADM.currentPerfil = window.currentPerfil;
    ADM.escuelaId  = window.currentPerfil.escuela_id  || ADM.escuelaId;
    ADM.escuelaCct = window.currentPerfil.escuela_cct || ADM.escuelaCct;
  }

  // Cargar perfil y escuela directamente desde la sesión activa de Supabase
  if (window.sb) {
    try {
      const { data: { session } } = await window.sb.auth.getSession();
      const authId = session?.user?.id;
      if (authId) {
        const { data: perfilFull } = await window.sb
          .from('usuarios').select('*').eq('auth_id', authId).maybeSingle();
        if (perfilFull) {
          window.currentPerfil = perfilFull;
          window.currentUser = session.user;
          ADM.currentPerfil = perfilFull;
          ADM.currentUser = session.user;

          // ── Resolver escuela — PRIORIDAD: escuela_id UUID > escuela_cct > fallbacks ──
          let escResuelta = null;

          // Estrategia 1: escuela_id como UUID — fuente más confiable
          if (!escResuelta && perfilFull.escuela_id) {
            const { data: esc } = await window.sb
              .from('escuelas').select('id, nombre, cct, nivel, nivel_default')
              .eq('id', perfilFull.escuela_id).maybeSingle();
            if (esc) escResuelta = esc;
          }

          // Estrategia 2: escuela_cct → solo si no tenemos escuela por UUID
          // Si la escuela hallada por UUID no coincide con el CCT del perfil,
          // preferir la de UUID (más específica y sin ambigüedad)
          if (!escResuelta && perfilFull.escuela_cct) {
            const { data: esc } = await window.sb
              .from('escuelas').select('id, nombre, cct, nivel, nivel_default')
              .eq('cct', perfilFull.escuela_cct).maybeSingle();
            if (esc) escResuelta = esc;
          }

          // Estrategia 3: escuela_id podría ser un CCT (string) → buscar por cct
          if (!escResuelta && perfilFull.escuela_id) {
            const { data: esc } = await window.sb
              .from('escuelas').select('id, nombre, cct, nivel, nivel_default')
              .eq('cct', perfilFull.escuela_id).maybeSingle();
            if (esc) escResuelta = esc;
          }

          // Estrategia 4: buscar en usuario_escuelas (usa auth_id - FK hacia auth.users)
          if (!escResuelta) {
            const authIdToUse = authId || perfilFull.auth_id;
            const { data: ue } = await window.sb
              .from('usuario_escuelas').select('escuela_cct')
              .eq('usuario_id', authIdToUse).eq('activo', true).limit(1).maybeSingle();
            if (ue?.escuela_cct) {
              const { data: esc } = await window.sb
                .from('escuelas').select('id, nombre, cct, nivel, nivel_default')
                .eq('cct', ue.escuela_cct).maybeSingle();
              if (esc) escResuelta = esc;
            }
          }

          // Estrategia 5: buscar por email del usuario en invitaciones → escuela
          if (!escResuelta && perfilFull.email) {
            const { data: inv } = await window.sb
              .from('invitaciones').select('escuela_id')
              .eq('email_destino', perfilFull.email).limit(1).maybeSingle();
            if (inv?.escuela_id) {
              const { data: esc } = await window.sb
                .from('escuelas').select('id, nombre, cct, nivel, nivel_default')
                .eq('id', inv.escuela_id).maybeSingle();
              if (esc) escResuelta = esc;
            }
          }

          // Estrategia 6: buscar por escuela_cct del perfil directamente
          if (!escResuelta && perfilFull.escuela_cct) {
            const { data: esc } = await window.sb
              .from('escuelas').select('id, nombre, cct, nivel, nivel_default')
              .eq('cct', perfilFull.escuela_cct).maybeSingle();
            if (esc) escResuelta = esc;
          }

          // Aplicar la escuela resuelta
          if (escResuelta) {
            console.log('[ADM] Escuela resuelta:', escResuelta.cct, escResuelta.nombre);
            ADM.escuelaId  = escResuelta.id;
            ADM.escuelaCct = escResuelta.cct;
            ADM.escuelaNombre = escResuelta.nombre;

            // ── Resolver nivel con lógica clara ──
            // Si la escuela tiene nivel específico (no 'ambos'), usarlo directamente
            // Si es 'ambos', usar nivel_default de ESA escuela o lo que el admin eligió
            let nivelFinal;
            const nivelEsc = (escResuelta.nivel || '').toLowerCase().trim();

            if (nivelEsc === 'ambos' || nivelEsc === 'primaria_y_secundaria') {
              // Escuela mixta: respetar lo que el admin eligió en localStorage
              // Si no eligió nada, usar nivel_default de la escuela
              const savedAdm = localStorage.getItem('siembra_adm_nivel');
              nivelFinal = savedAdm || escResuelta.nivel_default?.toLowerCase() || 'secundaria';
            } else if (nivelEsc === 'primaria' || nivelEsc === 'secundaria') {
              // Nivel único: forzar el nivel de la escuela, ignorar localStorage
              nivelFinal = nivelEsc;
              // Limpiar localStorage para que no pise el nivel correcto
              try { localStorage.setItem('siembra_adm_nivel', nivelFinal); } catch(e) {}
            } else {
              // Fallback seguro: secundaria
              nivelFinal = escResuelta.nivel_default?.toLowerCase() || 'secundaria';
            }

	            ADM.escuelaNivelRaw = nivelEsc || nivelFinal;
	            ADM.escuelaNivel = nivelFinal;
            window._admNivelActivo = nivelFinal;
            window._nivelActivo = nivelFinal;

            // Sincronizar CCT en el perfil si hay discrepancia
            if (perfilFull.escuela_cct && perfilFull.escuela_cct !== escResuelta.cct) {
              // El perfil tiene un CCT diferente al UUID resuelto — corregir en BD
              window.currentPerfil.escuela_cct = escResuelta.cct;
              ADM.currentPerfil.escuela_cct = escResuelta.cct;
              try {
                await window.sb.from('usuarios').update({
                  escuela_cct: escResuelta.cct,
                  escuela_id:  escResuelta.id,
                }).eq('auth_id', authId);
              } catch(e) {}
              console.log('[ADM] CCT corregido automáticamente:', perfilFull.escuela_cct, '→', escResuelta.cct);
            } else if (!perfilFull.escuela_cct) {
              window.currentPerfil.escuela_cct = escResuelta.cct;
              ADM.currentPerfil.escuela_cct = escResuelta.cct;
              try {
                await window.sb.from('usuarios').update({
                  escuela_cct: escResuelta.cct,
                  escuela_id:  escResuelta.id,
                }).eq('auth_id', authId);
              } catch(e) {}
            }

            console.log('[ADM] ✅ Escuela:', escResuelta.nombre, '| nivel_esc:', nivelEsc, '| nivelFinal:', nivelFinal, '| CCT:', escResuelta.cct);
          } else {
            console.warn('[ADM] No se pudo resolver ninguna escuela para este usuario');
          }
        }
      }
    } catch(e) { console.warn('[ADM] Error cargando perfil:', e.message); }
  }

  // FIX #2: Garantía final — si el bloque de sesión no resolvió el CCT,
  // tomarlo directo de currentPerfil (siempre disponible tras el login).
  if (!ADM.escuelaCct && window.currentPerfil?.escuela_cct) {
    ADM.escuelaCct = window.currentPerfil.escuela_cct;
    console.warn('[ADM] escuelaCct recuperado de currentPerfil como fallback:', ADM.escuelaCct);
  }
  if (!ADM.escuelaId && window.currentPerfil?.escuela_id) {
    ADM.escuelaId = window.currentPerfil.escuela_id;
  }
  // Si todavía no hay CCT, buscarlo directo en BD por escuela_id del perfil
  if (!ADM.escuelaCct && ADM.escuelaId && window.sb) {
    try {
      const { data: escFallback } = await window.sb
        .from('escuelas').select('id,cct,nombre,nivel,nivel_default')
        .eq('id', ADM.escuelaId).maybeSingle();
      if (escFallback) {
        ADM.escuelaCct    = escFallback.cct;
        ADM.escuelaNombre = escFallback.nombre;
        ADM.escuelaNivel  = escFallback.nivel_default || escFallback.nivel || ADM.escuelaNivel || 'secundaria';
        // Actualizar currentPerfil para que todo el sistema lo vea
        if (window.currentPerfil) window.currentPerfil.escuela_cct = escFallback.cct;
        console.log('[ADM] ✅ CCT resuelto por escuela_id fallback:', ADM.escuelaCct);
      }
    } catch(eFb) { console.warn('[ADM] fallback escuela_id lookup:', eFb.message); }
  }
  console.log('[ADM] CCT final antes de cargar datos:', ADM.escuelaCct);

  await Promise.all([
    ADM.cargarGrupos(),
    ADM.cargarDocentes(),
    ADM.cargarAlumnos(),
    ADM.cargarMaterias(),
  ]);
  ADM.renderDashboard();
  ADM.renderGrupos();
  ADM.renderDocentes();
  ADM.renderAlumnos();
  ADM.renderMaterias();
  ADM.popularSelects();
  // Inicializar topbar y avatar con datos del perfil
  ADM.navTo('dashboard');
  // Mostrar nombre de escuela en topbar
  const escuelaTag = document.getElementById('adm-escuela-tag');
  if (escuelaTag && ADM.escuelaNombre) escuelaTag.textContent = ADM.escuelaNombre;
  // Inicializar switcher de nivel (primaria/secundaria/ambas)
  if (typeof admInicializarSwitcherNivel === 'function') admInicializarSwitcherNivel();
  // Exponer datos a todos los portales para que usen la misma fuente de verdad
  window._siembraAlumnos  = ADM.alumnos;
  window._siembraGrupos   = ADM.grupos;
  window._siembraDocentes = ADM.docentes;
  window._siembraMaterias = ADM.materias;
  window.dispatchEvent(new CustomEvent('siembra:datos-cargados', {
    detail: { alumnos: ADM.alumnos, grupos: ADM.grupos, docentes: ADM.docentes, materias: ADM.materias }
  }));
  // Apply NEM navTo patch now that ADM is ready
  if (typeof _applyNemNavToPatch === 'function') _applyNemNavToPatch();
  // Pre-popular selector de horarios con los grupos ya cargados
  setTimeout(() => {
    const sel = document.getElementById('adm-horario-grupo-sel');
    if (sel && ADM.grupos?.length) {
      sel.innerHTML = '<option value="">Seleccionar grupo…</option>' +
        ADM.grupos.map(g => `<option value="${g.id}">${g.nombre || g.grado+'° '+(g.seccion||'A')}</option>`).join('');
    }
  }, 300);
};

// ── Navegación ────────────────────────────────────────────────────
ADM.navTo = function(page) {
  if (window.SiembraAdminNav?.navTo) {
    return window.SiembraAdminNav.navTo(ADM, page);
  }
};

// ═══════════════════════════════════════════════════════
// CARGAR DATOS
// ═══════════════════════════════════════════════════════

ADM.cargarGrupos = async function() {
  const ctx = await window.SiembraAdminContext.resolveSchoolContext(ADM);
  const sb = ctx.sb;
  const cct = ctx.escuelaCct;
  if (!sb || !cct) {
    console.warn('[ADM] cargarGrupos: sin CCT disponible', { admCct: ADM.escuelaCct, perfilCct: window.currentPerfil?.escuela_cct });
    ADM.grupos = [];
    return;
  }
  try {
    const nivel = ADM.escuelaNivel || window._admNivelActivo;
    const filtrarNivel = (ADM.escuelaNivel === 'primaria_y_secundaria' || ADM.escuelaNivel === 'ambos') && nivel;
    let q = sb.from('grupos').select('*').eq('escuela_cct', cct).eq('activo', true);
    if (filtrarNivel) q = q.eq('nivel', nivel);
    const { data: grupos, error } = await q.order('grado');
    if (error) throw error;
    ADM.grupos = ADM._enriquecerGruposConMateriasBase(grupos || []);
    console.log('[ADM] Grupos cargados:', ADM.grupos.length, 'para CCT:', cct);
  } catch(e) { console.warn("[ADM] cargarGrupos:", e.message); ADM.grupos = []; }
};

ADM.cargarDocentes = async function() {
  const ctx = await window.SiembraAdminContext.resolveSchoolContext(ADM);
  const sb = ctx.sb;
  const cct = ctx.escuelaCct;
  if (!sb || !cct) {
    console.warn('[ADM] cargarDocentes: sin CCT o sin Supabase — docentes vacíos', { cct, sbRef: !!sb });
    ADM.docentes = [];
    return;
  }
  try {
    const roles = ['docente','coordinador','ts','prefecto','subdirector','tutor'];
    const { data: d1 } = await sb.from('usuarios')
      .select('*').eq('escuela_cct', cct)
      .in('rol', roles).eq('activo', true).order('nombre');
    const combined = [...(d1 || [])];
    const seen = new Set();
    ADM.docentes = combined.filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true; });
    console.log('[ADM] Docentes cargados:', ADM.docentes.length, 'para CCT:', cct);
    // Cargar asignaciones de materias para mostrar en las tarjetas
    try {
      const ids = ADM.docentes.map(d => d.id);
      if (ids.length && window.SiembraAsignaciones?.cargarDesdeDB) {
        await window.SiembraAsignaciones.cargarDesdeDB(ADM, sb, ids);
      }
    } catch(e2) { console.warn('[ADM] asignaciones load:', e2.message); }
  } catch(e) { console.warn("[ADM] cargarDocentes:", e.message); ADM.docentes = []; }
};

ADM.cargarAlumnos = async function() {
  const ctx = await window.SiembraAdminContext.resolveSchoolContext(ADM);
  const sbRef = ctx.sb;
  const cctA = ctx.escuelaCct;
  const escuelaId = ctx.escuelaId;
  if (!sbRef) { console.warn('[ADM] cargarAlumnos: sb no disponible'); ADM.alumnos = []; return; }
  if (!cctA && !escuelaId) { console.warn('[ADM] cargarAlumnos: sin CCT ni escuelaId'); ADM.alumnos = []; return; }

  try {
    // Query 1: por escuela_cct
    let q1Data = [];
    if (cctA) {
      const { data: d1, error: e1 } = await sbRef.from('usuarios')
        .select('*, alumnos_grupos(grupo_id, grupos(nombre,grado,seccion,nivel))')
        .eq('escuela_cct', cctA).eq('rol', 'alumno').eq('activo', true).order('nombre');
      if (e1) console.warn('[ADM] cargarAlumnos q1:', e1.message);
      q1Data = d1 || [];
    }

    // Query 2: por escuela_id UUID (alumnos que solo tienen ese campo)
    let q2Data = [];
    if (escuelaId) {
      const { data: d2, error: e2 } = await sbRef.from('usuarios')
        .select('*, alumnos_grupos(grupo_id, grupos(nombre,grado,seccion,nivel))')
        .eq('escuela_id', escuelaId).eq('rol', 'alumno').eq('activo', true).order('nombre');
      if (e2) console.warn('[ADM] cargarAlumnos q2:', e2.message);
      q2Data = d2 || [];
    }

    // Deduplicar
    const seen = new Set();
    const combined = [...q1Data, ...q2Data].filter(a => {
      if (!a?.id || seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

    ADM.alumnos = combined;
    console.log('[ADM] Alumnos cargados:', ADM.alumnos.length, '| CCT:', cctA, '| EscuelaId:', escuelaId);
  } catch(e) { console.warn('[ADM] cargarAlumnos:', e.message); ADM.alumnos = []; }
};

// Materias predefinidas NEM (SEP primaria y secundaria)
// ADM uses the global CAMPOS_NEM structures defined in doc-portal
// Aliases for backward compatibility
ADM._MATERIAS_NEM_PRIMARIA  = () => getMateriasByNivel('primaria');
ADM._MATERIAS_NEM_SECUNDARIA = () => getMateriasByNivel('secundaria');

ADM.cargarMaterias = async function() {
  if (!window.sb) { ADM.materias = ADM._materiasDefault(); return; }
  try {
    // Nivel de la escuela — resuelto en ADM.init()
    const nivelFiltro = ADM.escuelaNivel || window._admNivelActivo || window._nivelActivo || 'secundaria';
    console.log('[ADM] cargarMaterias — nivel filtro:', nivelFiltro, '| ADM.escuelaNivel:', ADM.escuelaNivel);

    // Buscar materias en BD filtradas por escuela + nivel
    let qMaterias = sb.from('materias').select('*').eq('activo', true);
    if (cctM) {
      // Primero intentar con filtro de escuela
      qMaterias = qMaterias.or(`escuela_cct.eq.${cctM},escuela_cct.is.null`);
    }
    qMaterias = qMaterias.or(`nivel.eq.${nivelFiltro},nivel.eq.ambos,nivel.is.null`);
    const { data, error } = await qMaterias.order('nombre');

    if (error) console.warn('[ADM] materias query error:', error.message);

    if (data && data.length) {
      ADM.materias = data;
      console.log('[ADM] Materias cargadas de BD:', data.length, '| Nivel:', nivelFiltro);
    } else {
      // No hay materias del nivel correcto en BD — sembrar las correctas
      console.log('[ADM] Sin materias de', nivelFiltro, 'en BD — sembrando NEM...');
      const materiasNEM = getMateriasByNivel(nivelFiltro);
      const toInsert = materiasNEM.map(nombre => ({
        nombre, nivel: nivelFiltro, horas_semana: 5, activo: true
      }));
      ADM.materias = toInsert; // Usar inmediatamente para UI

      try {
        const { data: inserted } = await sb.from('materias')
          .upsert(toInsert, { onConflict: 'nombre,nivel' }).select();
        if (inserted?.length) {
          ADM.materias = inserted;
          console.log('[ADM] Materias NEM sembradas:', inserted.length, 'de nivel', nivelFiltro);
        }
      } catch(seedErr) { console.warn('[ADM] materias seed:', seedErr.message); }
    }
  } catch(e) {
    console.warn("[ADM] cargarMaterias error:", e.message);
    // Fallback: generar del nivel correcto sin BD
    const nivel = ADM.escuelaNivel || 'secundaria';
    ADM.materias = getMateriasByNivel(nivel).map((nombre, i) => ({
      id: 'mat-fallback-' + i, nombre, nivel, horas_semana: 5, activo: true
    }));
  }
};

ADM._materiasDefault = function() {
  // Usar siempre el nivel de la escuela resuelta, nunca asumir primaria
  const nivel = ADM.escuelaNivel || window._admNivelActivo || window._nivelActivo
    || window._escuelaCfg?.nivel_default || 'secundaria';
  return getMateriasByNivel(nivel).map((nombre, i) => ({
    id: 'mat-default-' + i, nombre, nivel, horas_semana: 5, activo: true
  }));
};

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════

ADM.renderDashboard = function() {
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('adm-stat-grupos',   ADM.grupos.length);
  s('adm-stat-docentes', ADM.docentes.length);
  s('adm-stat-alumnos',  ADM.alumnos.length);
  s('adm-stat-materias', 4); // 4 Campos Formativos NEM

  // Alumnos sin grupo
  const sinGrupo = ADM.alumnos.filter(a => !a.alumnos_grupos?.length).length;
  const warnEl = document.getElementById('adm-warn-sin-grupo');
  if (warnEl) {
    warnEl.style.display = sinGrupo > 0 ? 'block' : 'none';
    warnEl.textContent = `⚠️ ${sinGrupo} alumno${sinGrupo>1?'s':''} sin grupo asignado`;
  }
};

// ═══════════════════════════════════════════════════════
// GRUPOS
// ═══════════════════════════════════════════════════════

// Grado activo en el sidebar
window._admGradoActivo = null;

ADM.renderGrupos = function() {
  const el      = document.getElementById('adm-grupos-list');
  const sidebar = document.getElementById('adm-grados-sidebar');
  if (!el) return;

  if (!ADM.grupos.length) {
    if (sidebar) sidebar.innerHTML = '';
    el.innerHTML = `<div style="padding:48px 20px;text-align:center;background:white;border-radius:14px;border:1.5px solid #e2e8f0;">
      <div style="font-size:48px;margin-bottom:12px;">🏫</div>
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:6px;">Todavía no hay grupos registrados</div>
      <div style="font-size:13px;color:#94a3b8;margin-bottom:16px;">Crea la estructura del ciclo escolar para empezar a asignar alumnos, materias y docentes.</div>
      <button onclick="ADM.abrirModalGrupo()" style="padding:10px 20px;background:linear-gradient(135deg,#0d5c2f,#157a40);color:white;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;">+ Crear primer grupo</button>
    </div>`;
    return;
  }

  // Agrupar por grado y ordenar
  const porGrado = {};
  ADM.grupos.forEach(g => {
    const gr = parseInt(g.grado) || 0;
    if (!porGrado[gr]) porGrado[gr] = [];
    porGrado[gr].push(g);
  });
  // Ordenar grupos dentro de cada grado alfabéticamente por sección
  Object.values(porGrado).forEach(arr => arr.sort((a,b) => (a.seccion||'').localeCompare(b.seccion||'')));
  const grados = Object.keys(porGrado).map(Number).sort((a,b) => a-b);

  // Auto-seleccionar el primer grado si ninguno está activo
  if (!window._admGradoActivo || !porGrado[window._admGradoActivo]) {
    window._admGradoActivo = grados[0];
  }

  // Sidebar de grados
  if (sidebar) {
    sidebar.innerHTML = grados.map(gr => {
      const cnt = porGrado[gr].length;
      const isActive = gr === window._admGradoActivo;
      return `<button onclick="admSelGrado(${gr})" style="width:100%;text-align:left;padding:10px 12px;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;font-weight:${isActive?'700':'600'};cursor:pointer;background:${isActive?'#0d5c2f':'transparent'};color:${isActive?'white':'#334155'};display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;transition:.15s;">
        <span>${gr}° grado</span>
        <span style="font-size:10px;background:${isActive?'rgba(255,255,255,.25)':'#f1f5f9'};color:${isActive?'white':'#64748b'};border-radius:99px;padding:1px 7px;font-weight:700;">${cnt}</span>
      </button>`;
    }).join('');
  }

  // Grupos del grado seleccionado
  const gruposDelGrado = porGrado[window._admGradoActivo] || [];
  el.innerHTML = gruposDelGrado.map(g => {
    const alumnosDelGrupo = ADM.alumnos.filter(a =>
      a.alumnos_grupos?.some(ag => ag.grupo_id === g.id));
    const alumnosCnt = alumnosDelGrupo.length;
    const cobertura = ADM._coberturaGrupo(g);

    const docentesAsignados = [];
    if (window._admAsignaciones) {
      ADM.docentes.forEach(d => {
        const enEsteGrupo = (window._admAsignaciones[d.id] || []).filter(a => a.grupo_id === g.id);
        if (enEsteGrupo.length) docentesAsignados.push({
          nombre: ((d.nombre||'') + ' ' + (d.apellido||d.apellido_p||'')).trim(),
          materias: enEsteGrupo.map(a => a.materia).join(', ')
        });
      });
    }
    const docentesHtml = docentesAsignados.length
      ? docentesAsignados.map(d => `<span style="display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px;padding:3px 10px;font-size:11px;color:#166534;font-weight:600;">👩‍🏫 ${d.nombre.split(' ')[0]} <span style="color:#64748b;font-weight:400;">(${d.materias})</span></span>`).join(' ')
      : '<span style="font-size:11px;color:#94a3b8;">Sin docentes asignados</span>';
    const coberturaBadge = cobertura.estado === 'completo'
      ? '<span class="adm-badge" style="background:#dcfce7;color:#166534;">Cobertura completa</span>'
      : (cobertura.cubiertas.length
          ? `<span class="adm-badge" style="background:#fef3c7;color:#92400e;">Faltan ${cobertura.faltantes.length}</span>`
          : '<span class="adm-badge" style="background:#fee2e2;color:#b91c1c;">Sin cobertura docente</span>');
    const materiasBaseHtml = cobertura.esperadas.map(m => {
      const ok = cobertura.cubiertas.some(c => ADM._normalizarMateriaCobertura(c) === ADM._normalizarMateriaCobertura(m));
      return `<span style="display:inline-flex;align-items:center;gap:4px;background:${ok ? '#f0fdf4' : '#f8fafc'};border:1px solid ${ok ? '#bbf7d0' : '#e2e8f0'};border-radius:20px;padding:3px 10px;font-size:11px;color:${ok ? '#166534' : '#64748b'};font-weight:600;">${ok ? '✅' : '○'} ${m}</span>`;
    }).join(' ');
    const faltantesHtml = cobertura.faltantes.length
      ? cobertura.faltantes.map(m => `<span style="display:inline-flex;align-items:center;gap:4px;background:#fff7ed;border:1px solid #fed7aa;border-radius:20px;padding:3px 10px;font-size:11px;color:#9a3412;font-weight:700;">⚠️ ${m}</span>`).join(' ')
      : '<span style="font-size:11px;color:#16a34a;font-weight:700;">Todas las materias base están cubiertas.</span>';

    // Lista de alumnos (colapsable)
    const alumnosHtml = alumnosDelGrupo.length
      ? alumnosDelGrupo
          .sort((a,b) => ((a.apellido_p||a.apellido||'') + (a.nombre||'')).localeCompare((b.apellido_p||b.apellido||'') + (b.nombre||'')))
          .map(a => {
            const nombre = [a.apellido_p, a.apellido_m, a.nombre].filter(Boolean).join(' ') || a.nombre || '—';
            return `<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:#f8fafc;border-radius:7px;font-size:12px;">
              <div style="width:24px;height:24px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#475569;flex-shrink:0;">${(a.nombre||'?')[0].toUpperCase()}</div>
              <span style="flex:1;">${nombre}</span>
              <button onclick="ADM.abrirFichaAlumno && ADM.abrirFichaAlumno('${a.id}')" style="padding:2px 8px;border:1px solid #e2e8f0;border-radius:5px;background:white;font-size:10px;color:#64748b;cursor:pointer;font-family:'Sora',sans-serif;">Ver</button>
            </div>`;
          }).join('')
      : '<div style="padding:10px 12px;font-size:12px;color:#94a3b8;">Sin alumnos en este grupo</div>';

    const gid = g.id;
    return `<div class="adm-card" style="margin-bottom:12px;">
      <div class="adm-card-header" style="cursor:pointer;" onclick="admToggleGrupo('${gid}')">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:18px;font-weight:700;color:#15803d;flex-shrink:0;">${g.grado}°${g.seccion||'A'}</div>
            <div>
              <div class="adm-card-title">${g.nombre || g.grado + '° ' + (g.seccion||'A')}</div>
              <div class="adm-card-sub">${g.turno||'Matutino'} · ${g.nivel||'primaria'} · ${g.ciclo||window.CICLO_ACTIVO}</div>
            </div>
          </div>
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">${docentesHtml}</div>
          <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
            <span class="adm-badge" style="background:#eff6ff;color:#1d4ed8;">${cobertura.esperadas.length} materias base</span>
            <span class="adm-badge" style="background:#ecfeff;color:#0f766e;">${cobertura.cubiertas.length} cubiertas</span>
            ${coberturaBadge}
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:flex-start;">
          <span class="adm-badge adm-badge-green">${alumnosCnt} alumnos</span>
          <button class="adm-btn-sm" onclick="event.stopPropagation();ADM.abrirEditarGrupo('${gid}')">✏️</button>
          <button class="adm-btn-sm adm-btn-danger" onclick="event.stopPropagation();ADM.eliminarGrupo('${gid}','${g.nombre||g.grado}')" aria-label="Eliminar">✕</button>
          <span id="adm-grp-arrow-${gid}" style="font-size:14px;color:#94a3b8;transition:.2s;display:inline-block;">▼</span>
        </div>
      </div>
      <!-- Alumnos expandibles -->
      <div id="adm-grp-alumnos-${gid}" style="display:none;border-top:1px solid #f1f5f9;padding:10px 16px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <button class="adm-btn-sm" onclick="ADM.abrirAltaAlumnoGrupo('${gid}')">👨‍🎓 Alta alumno</button>
          <button class="adm-btn-sm" onclick="ADM.navTo && ADM.navTo('personal'); ADM.toast('📚 Revisa Personal para cubrir las materias faltantes del grupo', 'ok');">👩‍🏫 Asignar docentes</button>
        </div>
        <div style="margin-bottom:12px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:8px;">Cobertura académica</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">${materiasBaseHtml}</div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin:10px 0 8px;">Materias faltantes por cubrir</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">${faltantesHtml}</div>
        </div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:8px;">Alumnos · ${alumnosCnt}</div>
        <div style="display:flex;flex-direction:column;gap:4px;">${alumnosHtml}</div>
      </div>
    </div>`;
  }).join('') || `<div style="padding:40px;text-align:center;background:white;border-radius:14px;border:1.5px dashed #e2e8f0;color:#94a3b8;">Sin grupos en ${window._admGradoActivo}° grado</div>`;
};

function admSelGrado(grado) {
  window._admGradoActivo = grado;
  ADM.renderGrupos();
}

ADM.renderCoberturaAcademica = function() {
  const kpisEl = document.getElementById('adm-cobertura-kpis');
  const checklistEl = document.getElementById('adm-cobertura-checklist');
  const gradosEl = document.getElementById('adm-cobertura-grados');
  const estadosEl = document.getElementById('adm-cobertura-estados');
  const tablaEl = document.getElementById('adm-cobertura-tabla');
  const legendEl = document.getElementById('adm-cobertura-legend');
  if (!kpisEl || !gradosEl || !estadosEl || !tablaEl) return;

  const grupos = ADM.grupos || [];
  if (!grupos.length) {
    kpisEl.innerHTML = '';
    gradosEl.innerHTML = '<div style="padding:28px;color:#94a3b8;text-align:center;">Sin grupos para analizar todavía.</div>';
    estadosEl.innerHTML = '<div style="padding:28px;color:#94a3b8;text-align:center;">Crea grupos para ver cobertura.</div>';
    tablaEl.innerHTML = '<div style="padding:28px;color:#94a3b8;text-align:center;">Aún no hay datos de cobertura.</div>';
    return;
  }

  const resumen = window.SiembraCoberturas?.resumenGlobal
    ? window.SiembraCoberturas.resumenGlobal(ADM)
    : null;
  const detalle = resumen?.detalle || grupos.map(g => {
    const alumnosCnt = ADM.alumnos.filter(a => a.alumnos_grupos?.some(ag => ag.grupo_id === g.id)).length;
    const cobertura = ADM._coberturaGrupo(g);
    const porcentaje = cobertura.esperadas.length ? Math.round((cobertura.cubiertas.length / cobertura.esperadas.length) * 100) : 0;
    const estado = !alumnosCnt
      ? 'sin_alumnos'
      : (cobertura.estado === 'completo' ? 'completo' : (cobertura.cubiertas.length ? 'incompleto' : 'critico'));
    return { grupo: g, alumnosCnt, cobertura, porcentaje, estado, siguienteAccion: !alumnosCnt ? 'Cargar alumnos' : (cobertura.faltantes.length ? 'Asignar docentes' : 'Grupo operativo') };
  });

  const totalEsperadas = resumen?.totalEsperadas ?? detalle.reduce((acc, d) => acc + d.cobertura.esperadas.length, 0);
  const totalCubiertas = resumen?.totalCubiertas ?? detalle.reduce((acc, d) => acc + d.cobertura.cubiertas.length, 0);
  const totalFaltantes = resumen?.totalFaltantes ?? detalle.reduce((acc, d) => acc + d.cobertura.faltantes.length, 0);
  const gruposCompletos = resumen?.gruposCompletos ?? detalle.filter(d => d.estado === 'completo').length;
  const gruposSinAlumnos = resumen?.gruposSinAlumnos ?? detalle.filter(d => d.estado === 'sin_alumnos').length;
  const gruposOperativos = resumen?.gruposOperativos ?? detalle.filter(d => d.estado === 'completo' && d.alumnosCnt > 0).length;
  const porcentajeGlobal = resumen?.porcentajeGlobal ?? (totalEsperadas ? Math.round((totalCubiertas / totalEsperadas) * 100) : 0);

  kpisEl.innerHTML = [
    { label:'Cobertura global', value:`${porcentajeGlobal}%`, sub:`${totalCubiertas}/${totalEsperadas} materias cubiertas`, color:'#0d5c2f', bg:'#f0fdf4' },
    { label:'Grupos completos', value:String(gruposCompletos), sub:`de ${detalle.length} grupos activos`, color:'#1d4ed8', bg:'#eff6ff' },
    { label:'Grupos operativos', value:String(gruposOperativos), sub:'con cobertura y alumnos cargados', color:'#0f766e', bg:'#ecfeff' },
    { label:'Materias faltantes', value:String(totalFaltantes), sub:'pendientes de asignar', color:'#b45309', bg:'#fffbeb' },
    { label:'Grupos sin alumnos', value:String(gruposSinAlumnos), sub:'requieren carga escolar', color:'#be123c', bg:'#fff1f2' },
  ].map(card => `
    <div style="background:${card.bg};border:1px solid rgba(15,23,42,.06);border-radius:16px;padding:18px;">
      <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.6px;">${card.label}</div>
      <div style="font-size:34px;font-weight:900;color:${card.color};line-height:1;margin-top:8px;">${card.value}</div>
      <div style="font-size:12px;color:#64748b;margin-top:8px;">${card.sub}</div>
    </div>`).join('');

  if (checklistEl) {
    const checklist = window.SiembraCoberturas?.checklistOperativo
      ? window.SiembraCoberturas.checklistOperativo(ADM)
      : [];
    checklistEl.innerHTML = checklist.map(item => `
      <div style="background:white;border:1px solid ${item.ok ? '#bbf7d0' : '#e2e8f0'};border-radius:14px;padding:14px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:18px;">${item.ok ? '✅' : '⏳'}</span>
          <div style="font-size:13px;font-weight:800;color:#0f172a;">${item.label}</div>
        </div>
        <div style="font-size:12px;color:${item.ok ? '#166534' : '#64748b'};">${item.detail}</div>
      </div>`).join('');
  }

  const porGrado = {};
  detalle.forEach(d => {
    const grado = String(d.grupo.grado).replace(/[°\s]/g,'') || '1';
    if (!porGrado[grado]) porGrado[grado] = { cubiertas:0, esperadas:0, grupos:0 };
    porGrado[grado].cubiertas += d.cobertura.cubiertas.length;
    porGrado[grado].esperadas += d.cobertura.esperadas.length;
    porGrado[grado].grupos += 1;
  });
  gradosEl.innerHTML = Object.keys(porGrado).sort((a,b) => Number(a)-Number(b)).map(grado => {
    const row = porGrado[grado];
    const pct = row.esperadas ? Math.round((row.cubiertas / row.esperadas) * 100) : 0;
    const color = pct >= 95 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626';
    return `
      <div style="display:grid;grid-template-columns:90px 1fr 56px;gap:12px;align-items:center;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:800;color:#0f172a;">${grado}° grado</div>
        <div style="height:12px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:999px;"></div>
        </div>
        <div style="font-size:12px;font-weight:800;color:${color};text-align:right;">${pct}%</div>
      </div>`;
  }).join('');

  const estadoConfig = {
    completo: { label:'Completos', color:'#166534', bg:'#dcfce7' },
    incompleto: { label:'Incompletos', color:'#92400e', bg:'#fef3c7' },
    critico: { label:'Críticos', color:'#b91c1c', bg:'#fee2e2' },
    sin_alumnos: { label:'Sin alumnos', color:'#7c2d12', bg:'#ffedd5' },
  };
  estadosEl.innerHTML = Object.entries(estadoConfig).map(([key, cfg]) => {
    const count = detalle.filter(d => d.estado === key).length;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:14px;background:${cfg.bg};margin-bottom:10px;">
        <div style="font-size:13px;font-weight:800;color:${cfg.color};">${cfg.label}</div>
        <div style="font-size:26px;font-weight:900;color:${cfg.color};line-height:1;">${count}</div>
      </div>`;
  }).join('');

  if (legendEl) {
    legendEl.innerHTML = `
      <span style="padding:4px 10px;border-radius:999px;background:#dcfce7;color:#166534;font-size:11px;font-weight:800;">Completo</span>
      <span style="padding:4px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:800;">Incompleto</span>
      <span style="padding:4px 10px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:11px;font-weight:800;">Crítico</span>
      <span style="padding:4px 10px;border-radius:999px;background:#ffedd5;color:#9a3412;font-size:11px;font-weight:800;">Sin alumnos</span>`;
  }

  const estadoChip = (d) => {
    const map = {
      completo: ['#dcfce7', '#166534', 'Completo'],
      incompleto: ['#fef3c7', '#92400e', 'Incompleto'],
      critico: ['#fee2e2', '#b91c1c', 'Crítico'],
      sin_alumnos: ['#ffedd5', '#9a3412', 'Sin alumnos'],
    };
    const [bg, color, label] = map[d.estado];
    return `<span style="padding:4px 10px;border-radius:999px;background:${bg};color:${color};font-size:11px;font-weight:800;">${label}</span>`;
  };

  tablaEl.innerHTML = `
    <table class="adm-tabla" style="width:100%;">
      <thead>
        <tr>
          <th>Grupo</th>
          <th>Alumnos</th>
          <th>Cobertura</th>
          <th>Materias faltantes</th>
          <th>Estado</th>
          <th>Siguiente paso</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        ${detalle.sort((a,b) => (Number(a.grupo.grado)-Number(b.grupo.grado)) || String(a.grupo.seccion||'').localeCompare(String(b.grupo.seccion||''))).map(d => `
          <tr>
            <td>
              <div style="font-weight:800;color:#0f172a;">${d.grupo.nombre || `${d.grupo.grado}° ${d.grupo.seccion||'A'}`}</div>
              <div style="font-size:11px;color:#64748b;">${d.grupo.turno || 'matutino'} · ${d.grupo.nivel || ADM.escuelaNivel || window._admNivelActivo || '—'}</div>
            </td>
            <td style="font-weight:800;">${d.alumnosCnt}</td>
            <td>
              <div style="font-size:12px;font-weight:800;color:#0f172a;">${d.cobertura.cubiertas.length}/${d.cobertura.esperadas.length}</div>
              <div style="height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-top:6px;min-width:120px;">
                <div style="width:${d.porcentaje}%;height:100%;background:${d.porcentaje >= 95 ? '#16a34a' : d.porcentaje >= 70 ? '#d97706' : '#dc2626'};"></div>
              </div>
            </td>
            <td>
              ${d.cobertura.faltantes.length
                ? d.cobertura.faltantes.slice(0,3).map(m => `<span style="display:inline-flex;align-items:center;gap:4px;background:#fff7ed;border:1px solid #fed7aa;border-radius:20px;padding:3px 8px;font-size:10px;color:#9a3412;font-weight:700;margin:2px;">${m}</span>`).join('')
                : '<span style="font-size:11px;color:#16a34a;font-weight:800;">Sin faltantes</span>'}
            </td>
            <td>${estadoChip(d)}</td>
            <td style="font-size:12px;font-weight:700;color:${d.siguienteAccion === 'Grupo operativo' ? '#166534' : '#92400e'};">${d.siguienteAccion || 'Revisar grupo'}</td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="adm-btn-sm" onclick="ADM.abrirAltaAlumnoGrupo('${d.grupo.id}')">Alumno</button>
                <button class="adm-btn-sm" onclick="ADM.navTo('asignaciones'); ADM.toast('📚 Revisa asignaciones para cubrir las materias faltantes', 'ok');">Docente</button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
};

ADM.renderGrupos = function() {
  if (window.SiembraAdminGrupos?.renderGrupos) {
    return window.SiembraAdminGrupos.renderGrupos(ADM);
  }
};

ADM.renderCoberturaAcademica = function() {
  const checklistEl = document.getElementById('adm-cobertura-checklist');
  if (checklistEl) {
    const checklist = window.SiembraCoberturas?.checklistOperativo
      ? window.SiembraCoberturas.checklistOperativo(ADM)
      : [];
    checklistEl.innerHTML = checklist.map(item => `
      <div style="background:white;border:1px solid ${item.ok ? '#bbf7d0' : '#e2e8f0'};border-radius:14px;padding:14px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:18px;">${item.ok ? '✅' : '⏳'}</span>
          <div style="font-size:13px;font-weight:800;color:#0f172a;">${item.label}</div>
        </div>
        <div style="font-size:12px;color:${item.ok ? '#166534' : '#64748b'};">${item.detail}</div>
      </div>`).join('');
  }

  if (window.SiembraAdminGrupos?.renderCoberturaAcademica) {
    return window.SiembraAdminGrupos.renderCoberturaAcademica(ADM);
  }
};

function admToggleGrupo(gid) {
  const panel = document.getElementById('adm-grp-alumnos-' + gid);
  const arrow  = document.getElementById('adm-grp-arrow-' + gid);
  if (!panel) return;
  const open = panel.style.display === 'none';
  panel.style.display = open ? '' : 'none';
  if (arrow) arrow.style.transform = open ? 'rotate(180deg)' : '';
}

ADM._grupoLetras = function() {
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
};

ADM._gradosDisponibles = function() {
  const nivel = ADM.escuelaNivel || window._admNivelActivo || 'primaria';
  return nivel === 'secundaria' ? [1,2,3] : [1,2,3,4,5,6];
};

ADM._gradoLabel = function(grado) {
  return `${grado}° grado`;
};

ADM._normalizarMateriaCobertura = function(raw) {
  if (window.SiembraCoberturas?.normalizarMateria) {
    return window.SiembraCoberturas.normalizarMateria(raw);
  }
  return String(raw || '').trim().toLowerCase();
};

ADM._materiasBaseGrupo = function(grupo) {
  if (window.SiembraCoberturas?.materiasBaseGrupo) {
    return window.SiembraCoberturas.materiasBaseGrupo(ADM, grupo);
  }
  const nivel = grupo?.nivel || ADM.escuelaNivel || window._admNivelActivo || 'primaria';
  const grado = String(grupo?.grado || '').replace(/[°\s]/g, '').trim() || '1';
  if (nivel === 'secundaria') return [...(MATERIAS_SECUNDARIA_POR_GRADO?.[grado] || MATERIAS_SECUNDARIA_POR_GRADO['1'] || [])];
  return [...getMateriasByNivel('primaria')];
};

ADM._enriquecerGrupoConMateriasBase = function(grupo) {
  if (window.SiembraCoberturas?.enriquecerGrupo) {
    return window.SiembraCoberturas.enriquecerGrupo(ADM, grupo);
  }
  if (!grupo) return grupo;
  const materiasBase = ADM._materiasBaseGrupo(grupo);
  return { ...grupo, materias_base: materiasBase, materias_base_count: materiasBase.length };
};

ADM._enriquecerGruposConMateriasBase = function(grupos = []) {
  if (window.SiembraCoberturas?.enriquecerGrupos) {
    return window.SiembraCoberturas.enriquecerGrupos(ADM, grupos);
  }
  return (grupos || []).map(g => ADM._enriquecerGrupoConMateriasBase(g));
};

ADM.obtenerAsignacionesDocente = function(docenteId) {
  if (window.SiembraAsignaciones?.getDocenteAsignaciones) {
    return window.SiembraAsignaciones.getDocenteAsignaciones(ADM, docenteId);
  }
  const asignaciones = ADM.asignacionesPorDocente || window._admAsignaciones || {};
  return Array.isArray(asignaciones) ? [] : (asignaciones[docenteId] || []);
};

ADM._coberturaGrupo = function(grupo) {
  if (window.SiembraCoberturas?.coberturaGrupo) {
    return window.SiembraCoberturas.coberturaGrupo(ADM, grupo);
  }
  const esperadas = ADM._materiasBaseGrupo(grupo);
  return { esperadas, cubiertas: [], faltantes: esperadas, estado: 'sin_docentes' };
};

ADM.abrirAltaAlumnoGrupo = function(grupoId) {
  window._admGrupoAltaPreseleccionado = grupoId || '';
  ADM.abrirModalAlumno();
};

ADM._combosGrupoUsados = function(excludeId = '') {
  return new Set(
    (ADM.grupos || [])
      .filter(x => !excludeId || x.id !== excludeId)
      .map(x => `${String(x.grado).replace(/[°\s]/g,'')}-${String(x.seccion || 'A').toUpperCase()}`)
  );
};

ADM._leerPlanGruposMasivo = function() {
  const gradosDisp = ADM._gradosDisponibles();
  const letras = ADM._grupoLetras();
  const turno = document.getElementById('adm-gm-turno')?.value || 'matutino';
  const capacidad = parseInt(document.getElementById('adm-gm-cap')?.value || '35', 10) || 35;
  const omitir = document.getElementById('adm-gm-omitir')?.checked !== false;
  const nivel = ADM.escuelaNivel || window._admNivelActivo || 'primaria';
  const usados = ADM._combosGrupoUsados();
  const grupos = [];

  gradosDisp.forEach(grado => {
    const habilitado = document.getElementById(`adm-gm-inc-${grado}`)?.checked !== false;
    const ultimaSeccion = String(document.getElementById(`adm-gm-last-${grado}`)?.value || 'A').toUpperCase();
    const idxHasta = Math.max(0, letras.indexOf(ultimaSeccion));
    if (!habilitado) return;
    letras.slice(0, idxHasta + 1).forEach(seccion => {
      const nombre = `${grado}° ${seccion}`;
      const key = `${grado}-${seccion}`;
      const existe = usados.has(key);
      grupos.push({
        key,
        grado: String(grado),
        seccion,
        nombre,
        turno,
        nivel,
        capacidad,
        existe,
        crear: omitir ? !existe : true
      });
    });
  });

  return {
    grupos,
    turno,
    nivel,
    capacidad,
    omitir,
    total: grupos.length,
    existentes: grupos.filter(g => g.existe),
    nuevos: grupos.filter(g => g.crear && !g.existe),
  };
};

ADM.aplicarPresetGrupoMasivo = function(letraHasta = 'C') {
  const letras = ADM._grupoLetras();
  const val = letras.includes(letraHasta) ? letraHasta : 'C';
  ADM._gradosDisponibles().forEach(grado => {
    const inc = document.getElementById(`adm-gm-inc-${grado}`);
    const sel = document.getElementById(`adm-gm-last-${grado}`);
    if (inc) inc.checked = true;
    if (sel) sel.value = val;
  });
  ADM.actualizarPreviewGrupoMasivo();
};

ADM.aplicarSoloPrimerGradoGrupoMasivo = function(letraHasta = 'Z') {
  const grados = ADM._gradosDisponibles();
  grados.forEach((grado, idx) => {
    const inc = document.getElementById(`adm-gm-inc-${grado}`);
    const sel = document.getElementById(`adm-gm-last-${grado}`);
    if (inc) inc.checked = idx === 0;
    if (sel) sel.value = idx === 0 ? letraHasta : 'A';
  });
  ADM.actualizarPreviewGrupoMasivo();
};

ADM.actualizarPreviewGrupoMasivo = function() {
  const box = document.getElementById('adm-gm-preview');
  const resumen = document.getElementById('adm-gm-resumen');
  if (!box || !resumen) return;
  const plan = ADM._leerPlanGruposMasivo();
  if (!plan.total) {
    resumen.innerHTML = 'Sin grupos por crear.';
    box.innerHTML = '';
    return;
  }
  resumen.innerHTML = `
    <span style="padding:4px 10px;border-radius:999px;background:#dcfce7;color:#166534;font-weight:700;">${plan.nuevos.length} nuevos</span>
    <span style="padding:4px 10px;border-radius:999px;background:#f1f5f9;color:#475569;font-weight:700;">${plan.existentes.length} existentes</span>
    <span style="padding:4px 10px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-weight:700;">${plan.turno}</span>
  `;
  box.innerHTML = plan.grupos.map(g => `
    <div style="padding:8px 10px;border-radius:10px;border:1px solid ${g.existe ? '#cbd5e1' : '#86efac'};background:${g.existe ? '#f8fafc' : '#f0fdf4'};font-size:12px;font-weight:700;color:${g.existe ? '#64748b' : '#166534'};">
      ${g.nombre}${g.existe ? ' · ya existe' : ''}
    </div>
  `).join('');
};

ADM.cambiarModoGrupoModal = function(modo) {
  const single = document.getElementById('adm-grupo-modo-single');
  const bulk = document.getElementById('adm-grupo-modo-bulk');
  const btnSingle = document.getElementById('adm-grupo-tab-single');
  const btnBulk = document.getElementById('adm-grupo-tab-bulk');
  const hidden = document.getElementById('adm-g-modo');
  if (hidden) hidden.value = modo;
  if (single) single.style.display = modo === 'single' ? '' : 'none';
  if (bulk) bulk.style.display = modo === 'bulk' ? '' : 'none';
  if (btnSingle) {
    btnSingle.style.background = modo === 'single' ? '#0d5c2f' : '#fff';
    btnSingle.style.color = modo === 'single' ? '#fff' : '#475569';
    btnSingle.style.borderColor = modo === 'single' ? '#0d5c2f' : '#cbd5e1';
  }
  if (btnBulk) {
    btnBulk.style.background = modo === 'bulk' ? '#0d5c2f' : '#fff';
    btnBulk.style.color = modo === 'bulk' ? '#fff' : '#475569';
    btnBulk.style.borderColor = modo === 'bulk' ? '#0d5c2f' : '#cbd5e1';
  }
  if (modo === 'bulk') ADM.actualizarPreviewGrupoMasivo();
};

ADM.abrirModalGrupoMasivo = function() {
  ADM.abrirModalGrupo(null, 'bulk');
};

ADM.abrirModalGrupo = function(grupoId = null) {
  const editar = !!grupoId;
  const g = editar ? ADM.grupos.find(x => x.id === grupoId) : null;
  const modoInicial = editar ? 'single' : ((arguments[1] || 'single'));

  // Determine grade range based on school level
  const nivel = ADM.escuelaNivel || window._admNivelActivo || 'primaria';
  const esSecundaria = nivel === 'secundaria';
  const gradosDisp = esSecundaria ? [1,2,3] : [1,2,3,4,5,6];

  // Build set of used grado+seccion combinations (exclude current group if editing)
  const combosUsadas = new Set(
    (ADM.grupos || [])
      .filter(x => !grupoId || x.id !== grupoId)
      .map(x => `${String(x.grado).replace(/[°\s]/g,'')}-${x.seccion||'A'}`)
  );
  window._admModalGrupoEditId = grupoId || '';

  const gradoActual = g?.grado ? String(g.grado).replace(/[°\s]/g,'') : String(gradosDisp[0]);
  const letras = ADM._grupoLetras();

  const gradoOpts = gradosDisp.map(n => {
    const nStr = String(n);
    return `<option value="${nStr}" ${gradoActual === nStr ? 'selected' : ''}>${n}°</option>`;
  }).join('');

  const buildSeccionOpts = (grado, seccionSel) => letras.map(l => {
    const usada = combosUsadas.has(`${grado}-${l}`);
    const sel = (seccionSel === l) || (!seccionSel && l === 'A' && !usada);
    return `<option value="${l}" ${sel ? 'selected' : ''} ${usada ? 'disabled' : ''}>${l}${usada ? ' (en uso)' : ''}</option>`;
  }).join('');

  const letrasOpts = letras.map(l => `<option value="${l}">${l}</option>`).join('');
  const filasMasivas = gradosDisp.map((grado, idx) => `
    <div style="display:grid;grid-template-columns:110px 1fr;gap:12px;align-items:end;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:${idx % 2 === 0 ? '#fafdfb' : '#ffffff'};">
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;color:#0f172a;cursor:pointer;">
        <input type="checkbox" id="adm-gm-inc-${grado}" ${idx < 3 ? 'checked' : ''} onchange="ADM.actualizarPreviewGrupoMasivo()">
        ${grado}°
      </label>
      <div class="adm-form-group" style="margin:0;">
        <label>Crear hasta sección</label>
        <select id="adm-gm-last-${grado}" onchange="ADM.actualizarPreviewGrupoMasivo()">
          ${letrasOpts}
        </select>
      </div>
    </div>`).join('');

  ADM.abrirModal('adm-modal-grupo',
    editar ? 'Editar grupo' : 'Nuevo grupo',
    `
    <input type="hidden" id="adm-g-modo" value="${modoInicial}">
    ${editar ? '' : `
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="adm-grupo-tab-single" onclick="ADM.cambiarModoGrupoModal('single')" style="padding:8px 14px;border:1.5px solid #cbd5e1;border-radius:999px;background:${modoInicial==='single'?'#0d5c2f':'#fff'};color:${modoInicial==='single'?'#fff':'#475569'};font-size:12px;font-weight:700;cursor:pointer;">Individual</button>
      <button id="adm-grupo-tab-bulk" onclick="ADM.cambiarModoGrupoModal('bulk')" style="padding:8px 14px;border:1.5px solid #cbd5e1;border-radius:999px;background:${modoInicial==='bulk'?'#0d5c2f':'#fff'};color:${modoInicial==='bulk'?'#fff':'#475569'};font-size:12px;font-weight:700;cursor:pointer;">Masivo</button>
    </div>`}
    <div id="adm-grupo-modo-single" style="display:${modoInicial==='bulk' && !editar ? 'none' : ''};">
      <div class="adm-form-row">
        <div class="adm-form-group">
          <label>Año</label>
          <select id="adm-g-grado" onchange="ADM._actualizarSeccionesModal(this.value)">
            ${gradoOpts}
          </select>
        </div>
        <div class="adm-form-group">
          <label>Sección</label>
          <select id="adm-g-seccion">
            ${buildSeccionOpts(gradoActual, g?.seccion)}
          </select>
        </div>
      </div>
      <div class="adm-form-row">
        <div class="adm-form-group">
          <label>Turno</label>
          <select id="adm-g-turno">
            <option value="matutino" ${g?.turno==='matutino'||!g?'selected':''}>Matutino</option>
            <option value="vespertino" ${g?.turno==='vespertino'?'selected':''}>Vespertino</option>
          </select>
        </div>
        <div class="adm-form-group">
          <label>Capacidad máxima</label>
          <input type="number" id="adm-g-cap" value="${g?.capacidad||35}" min="1" max="60">
        </div>
      </div>
    </div>
    ${editar ? '' : `
    <div id="adm-grupo-modo-bulk" style="display:${modoInicial==='bulk' ? '' : 'none'};">
      <div style="padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:14px;font-size:12px;color:#475569;">
        <div style="font-weight:800;color:#0f172a;margin-bottom:4px;">Estructura base de ${nivel === 'secundaria' ? 'secundaria' : 'primaria'}</div>
        <div>La escuela ya está configurada en este nivel, así que aquí solo defines cuántos grupos abrir por cada grado. Después podrás asignar docentes, cargar alumnos y revisar faltantes.</div>
      </div>
      <div style="display:grid;gap:10px;margin-bottom:14px;">
        ${filasMasivas}
      </div>
      <div class="adm-form-row">
        <div class="adm-form-group">
          <label>Turno</label>
          <select id="adm-gm-turno" onchange="ADM.actualizarPreviewGrupoMasivo()">
            <option value="matutino">Matutino</option>
            <option value="vespertino">Vespertino</option>
          </select>
        </div>
        <div class="adm-form-group">
          <label>Capacidad máxima</label>
          <input type="number" id="adm-gm-cap" value="35" min="1" max="60" oninput="ADM.actualizarPreviewGrupoMasivo()">
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin:10px 0 14px;font-size:12px;font-weight:700;color:#334155;cursor:pointer;">
        <input type="checkbox" id="adm-gm-omitir" checked onchange="ADM.actualizarPreviewGrupoMasivo()">
        Omitir los grupos que ya existen
      </label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <button onclick="ADM.aplicarPresetGrupoMasivo('C')" style="padding:7px 12px;border:1px solid #cbd5e1;background:white;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer;color:#475569;">Todos A-C</button>
        <button onclick="ADM.aplicarPresetGrupoMasivo('F')" style="padding:7px 12px;border:1px solid #cbd5e1;background:white;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer;color:#475569;">Todos A-F</button>
        <button onclick="ADM.aplicarSoloPrimerGradoGrupoMasivo('Z')" style="padding:7px 12px;border:1px solid #cbd5e1;background:white;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer;color:#475569;">Solo 1° A-Z</button>
      </div>
      <div style="padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
          <div style="font-size:12px;font-weight:800;color:#0f172a;">Vista previa</div>
          <div id="adm-gm-resumen" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
        </div>
        <div id="adm-gm-preview" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;max-height:220px;overflow:auto;"></div>
      </div>
      <div style="margin-top:12px;padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;font-size:12px;color:#92400e;">
        <div style="font-weight:800;margin-bottom:4px;">Siguiente paso sugerido</div>
        <div>Al terminar de crear grupos, la plataforma debe ayudarte a: 1) aplicar materias base del nivel, 2) detectar materias sin docente, 3) cargar alumnos, y 4) revisar cobertura por grupo.</div>
      </div>
    </div>`}
    `,
    `ADM.guardarGrupoDesdeModal('${grupoId||''}')`
  );
  if (!editar) {
    setTimeout(() => {
      gradosDisp.forEach((grado, idx) => {
        const sel = document.getElementById(`adm-gm-last-${grado}`);
        if (sel) sel.value = idx < 3 ? 'A' : 'A';
      });
      ADM.cambiarModoGrupoModal(modoInicial);
    }, 0);
  }
};

ADM._actualizarSeccionesModal = function(grado) {
  const editId = window._admModalGrupoEditId || '';
  const combosUsadas = new Set(
    (ADM.grupos || [])
      .filter(x => !editId || x.id !== editId)
      .map(x => `${String(x.grado).replace(/[°\s]/g,'')}-${x.seccion||'A'}`)
  );
  const letras = 'ABCDEFGHIJKLMN'.split('');
  const sel = document.getElementById('adm-g-seccion');
  if (!sel) return;
  const prevVal = sel.value;
  sel.innerHTML = letras.map(l => {
    const usada = combosUsadas.has(`${grado}-${l}`);
    const selected = prevVal === l && !usada;
    return `<option value="${l}" ${selected ? 'selected' : ''} ${usada ? 'disabled' : ''}>${l}${usada ? ' (en uso)' : ''}</option>`;
  }).join('');
  // If previous selection is now disabled, auto-select first available
  if (!sel.value || combosUsadas.has(`${grado}-${sel.value}`)) {
    const firstAvail = letras.find(l => !combosUsadas.has(`${grado}-${l}`));
    if (firstAvail) sel.value = firstAvail;
  }
};

ADM.abrirEditarGrupo = function(id) { ADM.abrirModalGrupo(id); };

ADM.guardarGrupoDesdeModal = async function(grupoId = '') {
  const modo = document.getElementById('adm-g-modo')?.value || 'single';
  if (!grupoId && modo === 'bulk') return ADM.guardarGruposMasivo();
  return ADM.guardarGrupo(grupoId);
};

ADM.guardarGrupo = async function(grupoId = '') {
  const gradoVal = document.getElementById('adm-g-grado').value;
  const grado   = String(gradoVal); // grupos.grado is TEXT
  const seccion = document.getElementById('adm-g-seccion').value.trim().toUpperCase() || 'A';
  const turno   = document.getElementById('adm-g-turno').value;
  const nivel   = document.getElementById('adm-g-nivel')?.value || window._admNivelActivo || 'primaria';
  const cap     = parseInt(document.getElementById('adm-g-cap').value) || 35;
  const nombre  = `${grado}° ${seccion}`;

  // Resolver CCT desde todas las fuentes posibles
  const cct = ADM.escuelaCct || window.currentPerfil?.escuela_cct || ADM.currentPerfil?.escuela_cct;
  const eid = ADM.escuelaId  || window.currentPerfil?.escuela_id  || ADM.currentPerfil?.escuela_id || null;

  if (!cct) {
    ADM.toast('❌ No se pudo identificar la escuela. Recarga la página.', 'err');
    return;
  }
  const sbClient = window.sb || ADM.sb;
  if (!sbClient) {
    ADM.toast('❌ Sin conexión a Supabase.', 'err');
    return;
  }

  const payload = {
    nombre, grado, seccion, turno, nivel,
    capacidad: cap,
    ciclo:       window.CICLO_ACTIVO || '2025-2026',
    activo:      true,
    escuela_cct: cct,
  };

  // Agregar escuela_id solo si es UUID válido
  if (eid && /^[0-9a-f-]{36}$/i.test(String(eid))) {
    payload.escuela_id = eid;
  }

  try {
    if (grupoId) {
      await sbClient.from('grupos').update(payload).eq('id', grupoId);
    } else {
      const { data, error } = await sbClient.from('grupos').insert(payload).select().single();
      if (error) throw error;
      ADM.grupos.push(ADM._enriquecerGrupoConMateriasBase(data));
    }
    await ADM.cargarGrupos();
    ADM.renderGrupos();
    ADM.popularSelects();
    ADM.renderDashboard();
    ADM.cerrarModal();
    const materiasBase = ADM._materiasBaseGrupo(payload);
    ADM.toast(`✅ Grupo ${nombre} ${grupoId ? 'actualizado' : 'creado'} · ${materiasBase.length} materias base listas`);
  } catch(e) { ADM.toast('❌ ' + e.message, 'err'); console.error('[ADM.guardarGrupo]', e); }
};

ADM.guardarGruposMasivo = async function() {
  const cct = ADM.escuelaCct || window.currentPerfil?.escuela_cct || ADM.currentPerfil?.escuela_cct;
  const eid = ADM.escuelaId  || window.currentPerfil?.escuela_id  || ADM.currentPerfil?.escuela_id || null;
  const sbClient = window.sb || ADM.sb;
  if (!cct) {
    ADM.toast('❌ No se pudo identificar la escuela. Recarga la página.', 'err');
    return;
  }
  if (!sbClient) {
    ADM.toast('❌ Sin conexión a Supabase.', 'err');
    return;
  }

  const plan = ADM._leerPlanGruposMasivo();
  if (!plan.nuevos.length) {
    ADM.toast(plan.existentes.length ? '⚠️ Todos esos grupos ya existen' : '⚠️ No hay grupos por crear', 'warn');
    return;
  }

  const payloads = plan.nuevos.map(g => {
    const payload = {
      nombre: g.nombre,
      grado: g.grado,
      seccion: g.seccion,
      turno: g.turno,
      nivel: g.nivel,
      capacidad: g.capacidad,
      ciclo: window.CICLO_ACTIVO || '2025-2026',
      activo: true,
      escuela_cct: cct,
    };
    if (eid && /^[0-9a-f-]{36}$/i.test(String(eid))) payload.escuela_id = eid;
    return payload;
  });

  try {
    const { data, error } = await sbClient.from('grupos').insert(payloads).select();
    if (error) throw error;
    if (!ADM.grupos) ADM.grupos = [];
    ADM.grupos.push(...ADM._enriquecerGruposConMateriasBase(data || []));
    await ADM.cargarGrupos();
    ADM.renderGrupos();
    ADM.popularSelects();
    ADM.renderDashboard();
    ADM.cerrarModal();
    ADM.toast(`✅ ${plan.nuevos.length} grupos creados${plan.existentes.length ? ` · ${plan.existentes.length} omitidos por existentes` : ''}. Materias base aplicadas automáticamente.`);
  } catch(e) {
    ADM.toast('❌ ' + e.message, 'err');
    console.error('[ADM.guardarGruposMasivo]', e);
  }
};

ADM.eliminarGrupo = function(id, nombre) {
  // Calcular impacto antes de mostrar modal
  const alumnosCnt = ADM.alumnos.filter(a => a.alumnos_grupos?.some(ag => ag.grupo_id === id)).length;
  const asignsCnt = Object.values(ADM.asignacionesPorDocente || window._admAsignaciones || {})
    .flat().filter(a => a.grupo_id === id).length;

  const otrosGrupos = (ADM.grupos || []).filter(g => g.id !== id);
  const otrosOpts = otrosGrupos.map(g =>
    `<option value="${g.id}">${g.nombre || (g.grado + '° ' + (g.seccion || ''))}</option>`
  ).join('');

  const impactoHtml = `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px;margin-bottom:16px;">
      <div style="font-size:11px;font-weight:800;color:#9a3412;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">⚠️ Impacto de esta eliminación</div>
      ${alumnosCnt
        ? `<div style="font-size:13px;color:#7c2d12;margin-bottom:4px;">• <b>${alumnosCnt}</b> alumno${alumnosCnt > 1 ? 's' : ''} quedarán sin grupo asignado</div>`
        : ''}
      ${asignsCnt
        ? `<div style="font-size:13px;color:#7c2d12;">• <b>${asignsCnt}</b> asignación${asignsCnt > 1 ? 'es' : ''} de docentes serán removidas</div>`
        : ''}
      ${!alumnosCnt && !asignsCnt
        ? '<div style="font-size:13px;color:#7c2d12;">El grupo está vacío — sin impacto en alumnos ni docentes.</div>'
        : ''}
    </div>
    ${(alumnosCnt || asignsCnt) && otrosGrupos.length ? `
    <div style="margin-bottom:6px;">
      <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">
        Reasignar alumnos y docentes a:
      </label>
      <select id="adm-reasignar-a-sel" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;outline:none;">
        <option value="">— No reasignar (dejar sin grupo) —</option>
        ${otrosOpts}
      </select>
      <div style="font-size:11px;color:#94a3b8;margin-top:5px;">Si seleccionas un grupo, los alumnos y asignaciones de docentes se moverán automáticamente antes de eliminar.</div>
    </div>` : ''}`;

  ADM.abrirModal(
    'adm-modal-eliminar-grupo',
    `🗑️ Eliminar grupo ${nombre}`,
    impactoHtml,
    `ADM._ejecutarEliminarGrupo('${id}','${nombre.replace(/'/g, "\\'")}')`,
    'Eliminar grupo'
  );
};

ADM._ejecutarEliminarGrupo = async function(id, nombre) {
  const sbRef = window.sb || ADM.sb;
  if (!sbRef) { ADM.toast('❌ Sin conexión a base de datos', 'err'); return; }

  const reasignarA = document.getElementById('adm-reasignar-a-sel')?.value || null;
  ADM.cerrarModal();

  const alumnosCnt = ADM.alumnos.filter(a => a.alumnos_grupos?.some(ag => ag.grupo_id === id)).length;
  const asignsCnt = Object.values(ADM.asignacionesPorDocente || window._admAsignaciones || {})
    .flat().filter(a => a.grupo_id === id).length;

  try {
    if (reasignarA) {
      // Mover alumnos al nuevo grupo
      const { error: errAlumnos } = await sbRef.from('alumnos_grupos').update({ grupo_id: reasignarA }).eq('grupo_id', id);
      if (errAlumnos) throw errAlumnos;
      // Mover asignaciones de docentes al nuevo grupo
      const { error: errDocentes } = await sbRef.from('docente_grupos').update({ grupo_id: reasignarA }).eq('grupo_id', id).eq('activo', true);
      if (errDocentes) throw errDocentes;
    } else {
      // Desconectar alumnos
      const { error: errAlumnos } = await sbRef.from('alumnos_grupos').delete().eq('grupo_id', id);
      if (errAlumnos) throw errAlumnos;
      // Desactivar asignaciones de docentes
      const { error: errDocentes } = await sbRef.from('docente_grupos').update({ activo: false }).eq('grupo_id', id);
      if (errDocentes) throw errDocentes;
    }

    // Marcar grupo inactivo
    const { error } = await sbRef.from('grupos').update({ activo: false }).eq('id', id);
    if (error) throw error;

    await ADM.cargarGrupos();
    await ADM.cargarAlumnos();
    await ADM.cargarAsignaciones?.();
    ADM.renderGrupos();
    ADM.renderAlumnos?.();
    ADM.popularSelects();
    ADM.renderDashboard();

    let msg = `✅ Grupo "${nombre}" eliminado`;
    if (reasignarA) {
      const gDest = ADM.grupos.find(g => g.id === reasignarA);
      const nomDest = gDest?.nombre || gDest ? (gDest.grado + '° ' + (gDest.seccion || '')) : reasignarA;
      if (alumnosCnt) msg += ` · ${alumnosCnt} alumno${alumnosCnt > 1 ? 's' : ''} → ${nomDest}`;
      if (asignsCnt) msg += ` · ${asignsCnt} asignación${asignsCnt > 1 ? 'es' : ''} reasignadas`;
    } else {
      if (alumnosCnt) msg += ` · ${alumnosCnt} alumno${alumnosCnt > 1 ? 's' : ''} sin grupo`;
      if (asignsCnt) msg += ` · ${asignsCnt} asignación${asignsCnt > 1 ? 'es' : ''} removidas`;
    }
    ADM.toast(msg, 'ok');

    // Mostrar banner si quedan asignaciones huérfanas
    ADM._mostrarBannerHuerfanas();

  } catch(e) { ADM.toast('❌ ' + e.message, 'err'); console.error('[ADM._ejecutarEliminarGrupo]', e); }
};

ADM._mostrarBannerHuerfanas = function() {
  const grupoIds = new Set((ADM.grupos || []).map(g => g.id));
  const huerfanas = Object.values(ADM.asignacionesPorDocente || window._admAsignaciones || {})
    .flat().filter(a => a.grupo_id && !grupoIds.has(a.grupo_id));
  if (!huerfanas.length) return;

  // Inyectar banner dinámicamente antes de la lista de docentes
  const lista = document.getElementById('adm-docentes-list');
  if (!lista) return;
  const bannerId = 'adm-banner-huerfanas';
  let banner = document.getElementById(bannerId);
  if (!banner) {
    banner = document.createElement('div');
    banner.id = bannerId;
    lista.parentNode.insertBefore(banner, lista);
  }
  banner.innerHTML = `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px 16px;margin-bottom:14px;display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:20px;flex-shrink:0;line-height:1.2;">⚠️</span>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:800;color:#9a3412;margin-bottom:2px;">Asignaciones de grupos eliminados</div>
        <div style="font-size:12px;color:#92400e;">${huerfanas.length} asignación${huerfanas.length > 1 ? 'es' : ''} apuntan a grupos que ya no existen. Revisa y actualiza las asignaciones de los docentes afectados.</div>
      </div>
      <button onclick="document.getElementById('${bannerId}').remove()" style="background:none;border:none;cursor:pointer;color:#9a3412;font-size:18px;flex-shrink:0;line-height:1;" aria-label="Cerrar">✕</button>
    </div>`;
};

// ═══════════════════════════════════════════════════════
// DOCENTES Y STAFF
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// PERSONAL Y MATERIAS — página unificada
// ═══════════════════════════════════════════════════════════════════════

// ── Tab switcher (global para onclick en HTML) ──────────────────────────
window.admPMTab = function(tab) {
  const tabs = ['personal', 'catalogo', 'asignaciones'];
  tabs.forEach(t => {
    const btn = document.getElementById('adm-pm-tab-' + t);
    const panel = document.getElementById('adm-pm-panel-' + t);
    if (!btn || !panel) return;
    const active = t === tab;
    btn.style.fontWeight = active ? '700' : '600';
    btn.style.color = active ? '#0d5c2f' : '#64748b';
    btn.style.borderBottom = active ? '2px solid #0d5c2f' : '2px solid transparent';
    btn.style.marginBottom = active ? '-2px' : '0';
    panel.style.display = active ? '' : 'none';
  });
};

// ── KPI Cards ────────────────────────────────────────────────────────────
ADM.renderPersonalKPIs = function() {
  const el = document.getElementById('adm-personal-kpis');
  if (!el) return;

  const docentes = ADM.docentes || [];
  const grupos = ADM.grupos || [];
  const asigns = ADM.asignacionesPorDocente || window._admAsignaciones || {};

  // Docentes con al menos 1 asignación a algún grupo
  const docentesConAsign = docentes.filter(d => (asigns[d.id] || []).length > 0).length;
  const docentesSinAsign = docentes.length - docentesConAsign;

  // Materias pendientes: suma de faltantes en todos los grupos
  let totalFaltantes = 0;
  grupos.forEach(g => {
    const cob = ADM._coberturaGrupo(g);
    totalFaltantes += cob.faltantes.length;
  });

  // Cobertura global
  let totalEsp = 0, totalCub = 0;
  grupos.forEach(g => {
    const cob = ADM._coberturaGrupo(g);
    totalEsp += cob.esperadas.length;
    totalCub += cob.cubiertas.length;
  });
  const pctGlobal = totalEsp ? Math.round((totalCub / totalEsp) * 100) : 0;

  const cards = [
    { label: 'Profesores y personal', value: String(docentes.length), sub: docentes.length === 1 ? '1 frente a grupo' : `${docentes.length} registrados`, color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
    { label: 'Docentes por completar', value: String(docentesSinAsign), sub: docentesSinAsign === 0 ? 'todos ya tienen asignación' : `${docentesSinAsign} sin materia asignada`, color: docentesSinAsign === 0 ? '#16a34a' : '#d97706', bg: docentesSinAsign === 0 ? '#f0fdf4' : '#fffbeb', border: docentesSinAsign === 0 ? '#86efac' : '#fde68a' },
    { label: 'Materias pendientes', value: String(totalFaltantes), sub: totalFaltantes === 0 ? 'sin faltantes detectados' : `${totalFaltantes} sin docente asignado`, color: totalFaltantes === 0 ? '#16a34a' : '#b45309', bg: totalFaltantes === 0 ? '#f0fdf4' : '#fffbeb', border: totalFaltantes === 0 ? '#86efac' : '#fde68a' },
    { label: 'Cobertura actual', value: pctGlobal + '%', sub: `${totalCub}/${totalEsp} materias cubiertas`, color: pctGlobal >= 100 ? '#16a34a' : pctGlobal >= 60 ? '#1d4ed8' : '#dc2626', bg: pctGlobal >= 100 ? '#f0fdf4' : pctGlobal >= 60 ? '#eff6ff' : '#fff1f2', border: pctGlobal >= 100 ? '#86efac' : pctGlobal >= 60 ? '#bfdbfe' : '#fecaca' },
  ];

  el.innerHTML = cards.map(c => `
    <div style="background:${c.bg};border:1.5px solid ${c.border};border-radius:16px;padding:18px 20px;">
      <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.6px;">${c.label}</div>
      <div style="font-size:34px;font-weight:900;color:${c.color};line-height:1;margin:10px 0 6px;">${c.value}</div>
      <div style="font-size:12px;color:#64748b;">${c.sub}</div>
    </div>`).join('');
};

// ── Mapa de cobertura (tab Asignaciones) ─────────────────────────────────
ADM.renderMapaCobertura = function() {
  const el = document.getElementById('adm-mapa-cobertura');
  if (!el) return;

  const grupos = ADM.grupos || [];
  const docentes = ADM.docentes || [];
  if (!grupos.length) {
    el.innerHTML = `<div style="padding:48px 20px;text-align:center;color:#94a3b8;">
      <div style="font-size:40px;margin-bottom:12px;">🗂</div>
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:6px;">Sin grupos registrados</div>
      <div style="font-size:13px;">Crea grupos primero para ver el mapa de cobertura.</div>
    </div>`;
    return;
  }

  const normM = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const asigns = ADM.asignacionesPorDocente || window._admAsignaciones || {};

  // Calcular cobertura por grupo
  const detalles = grupos.map(g => {
    const cob = ADM._coberturaGrupo(g);
    const pct = cob.esperadas.length ? Math.round((cob.cubiertas.length / cob.esperadas.length) * 100) : 0;
    return { g, cob, pct };
  });

  // Materias únicas esperadas en todos los grupos
  const todasMaterias = [...new Set(detalles.flatMap(d => d.cob.esperadas))].sort();

  // KPI resumen en la parte superior del tab
  let totalEsp = 0, totalCub = 0, totalFalt = 0;
  detalles.forEach(({ cob }) => { totalEsp += cob.esperadas.length; totalCub += cob.cubiertas.length; totalFalt += cob.faltantes.length; });
  const pctG = totalEsp ? Math.round((totalCub / totalEsp) * 100) : 0;
  const colorPctG = pctG >= 100 ? '#16a34a' : pctG >= 60 ? '#d97706' : '#dc2626';

  // ── Heatmap: materias × grupos ──────────────────────────────────────
  const thGrupos = grupos.map(g =>
    `<th style="padding:6px 10px;font-size:11px;font-weight:700;color:#475569;border-bottom:1.5px solid #e2e8f0;text-align:center;min-width:58px;">${g.nombre || (g.grado + '°' + (g.seccion || ''))}</th>`
  ).join('');

  const filas = todasMaterias.map(materia => {
    const celdas = grupos.map(g => {
      const cob = ADM._coberturaGrupo(g);
      const cubierta = cob.cubiertas.some(c => normM(c) === normM(materia));
      const esperada = cob.esperadas.some(e => normM(e) === normM(materia));
      if (!esperada) return `<td style="padding:6px 8px;text-align:center;background:#f8fafc;color:#cbd5e1;font-size:12px;">–</td>`;
      if (cubierta) return `<td style="padding:6px 8px;text-align:center;background:#f0fdf4;color:#16a34a;font-size:15px;" title="Cubierta">✓</td>`;
      return `<td style="padding:6px 8px;text-align:center;background:#fff7ed;cursor:pointer;font-size:15px;" title="Sin docente — clic para asignar"
        onclick="ADM.navTo&&ADM.navTo('personal');admPMTab('personal')">⚠️</td>`;
    }).join('');
    return `<tr>
      <td style="padding:7px 12px;font-size:12px;font-weight:700;color:#0f172a;border-right:1.5px solid #e2e8f0;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis;">${materia}</td>
      ${celdas}
    </tr>`;
  }).join('');

  // ── Barras de progreso por grupo ──────────────────────────────────────
  const barrasGrupos = detalles.map(({ g, cob, pct }) => {
    const color = pct >= 100 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626';
    const nom = g.nombre || (g.grado + '° ' + (g.seccion || ''));
    return `
      <div style="display:grid;grid-template-columns:80px 1fr 50px;gap:10px;align-items:center;margin-bottom:10px;">
        <div style="font-size:12px;font-weight:800;color:#0f172a;">${nom}</div>
        <div style="height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:999px;transition:width .5s;"></div>
        </div>
        <div style="font-size:12px;font-weight:800;color:${color};text-align:right;">${pct}%</div>
      </div>
      ${cob.faltantes.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px;padding-left:90px;">
        ${cob.faltantes.map(m => `<span style="background:#fff7ed;border:1px solid #fed7aa;border-radius:20px;padding:2px 9px;font-size:10px;color:#9a3412;font-weight:700;">⚠️ ${m}</span>`).join('')}
      </div>` : `<div style="font-size:11px;color:#16a34a;padding-left:90px;margin-bottom:14px;font-weight:700;">✅ Cobertura completa</div>`}`;
  }).join('');

  // ── Docentes sin asignación ──────────────────────────────────────────
  const docentesSin = docentes.filter(d => !(asigns[d.id] || []).length);
  const docentesSinHtml = docentesSin.length
    ? docentesSin.map(d => {
        const nom = ((d.nombre || '') + ' ' + (d.apellido || d.apellido_p || '')).trim();
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;margin-bottom:8px;">
          <div>
            <div style="font-size:13px;font-weight:700;color:#0f172a;">${nom}</div>
            <div style="font-size:11px;color:#9a3412;">Sin materias asignadas</div>
          </div>
          <button onclick="admPMTab('personal')" style="padding:6px 14px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">Asignar</button>
        </div>`;
      }).join('')
    : `<div style="font-size:13px;color:#16a34a;font-weight:700;padding:12px 0;">✅ Todos los docentes tienen al menos una asignación</div>`;

  // ── Canvas Chart.js ─────────────────────────────────────────────────
  const chartId = 'adm-cobertura-chart-' + Date.now();

  el.innerHTML = `
    <!-- Resumen global -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:20px;">
      <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:14px;padding:16px;text-align:center;">
        <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Cobertura global</div>
        <div style="font-size:36px;font-weight:900;color:${colorPctG};line-height:1;margin:8px 0 4px;">${pctG}%</div>
        <div style="font-size:12px;color:#64748b;">${totalCub}/${totalEsp} materias</div>
      </div>
      <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:14px;padding:16px;text-align:center;">
        <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Materias faltantes</div>
        <div style="font-size:36px;font-weight:900;color:#c2410c;line-height:1;margin:8px 0 4px;">${totalFalt}</div>
        <div style="font-size:12px;color:#64748b;">pendientes de asignar</div>
      </div>
      <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:14px;padding:16px;text-align:center;">
        <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Grupos completos</div>
        <div style="font-size:36px;font-weight:900;color:#1d4ed8;line-height:1;margin:8px 0 4px;">${detalles.filter(d => d.pct >= 100).length}</div>
        <div style="font-size:12px;color:#64748b;">de ${grupos.length} grupos</div>
      </div>
      <div style="background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:14px;padding:16px;text-align:center;">
        <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Docentes activos</div>
        <div style="font-size:36px;font-weight:900;color:#7c3aed;line-height:1;margin:8px 0 4px;">${docentes.length}</div>
        <div style="font-size:12px;color:#64748b;">${docentesSin.length} sin asignar</div>
      </div>
    </div>

    <!-- Chart + barras por grupo -->
    <div style="display:grid;grid-template-columns:200px 1fr;gap:20px;margin-bottom:24px;align-items:start;">
      <div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:14px;text-align:center;">
        <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Materias por estado</div>
        <canvas id="${chartId}" width="170" height="170"></canvas>
        <div style="font-size:11px;color:#94a3b8;margin-top:8px;">
          <span style="color:#16a34a;">●</span> ${totalCub} cubiertas&nbsp;&nbsp;
          <span style="color:#dc2626;">●</span> ${totalFalt} faltantes
        </div>
      </div>
      <div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:16px;">
        <div style="font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Cobertura por grupo</div>
        ${barrasGrupos}
      </div>
    </div>

    <!-- Heatmap materias × grupos -->
    <div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:24px;">
      <div style="padding:14px 16px;background:#f8fafc;border-bottom:1.5px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;">Mapa de cobertura — Materias × Grupos</div>
        <div style="display:flex;gap:12px;font-size:11px;">
          <span><span style="color:#16a34a;font-weight:800;">✓</span> Cubierta</span>
          <span><span style="color:#f59e0b;font-weight:800;">⚠️</span> Faltante</span>
          <span><span style="color:#cbd5e1;font-weight:800;">–</span> No aplica</span>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:8px 12px;font-size:11px;font-weight:700;color:#475569;border-bottom:1.5px solid #e2e8f0;text-align:left;min-width:150px;">Materia</th>
              ${thGrupos}
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    </div>

    <!-- Docentes sin asignación -->
    <div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:16px;">
      <div style="font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Docentes por completar</div>
      ${docentesSinHtml}
    </div>`;

  // Inicializar Chart.js donut
  requestAnimationFrame(() => {
    const canvas = document.getElementById(chartId);
    if (!canvas || !window.Chart) return;
    try {
      new window.Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Cubiertas', 'Faltantes'],
          datasets: [{
            data: [totalCub, totalFalt],
            backgroundColor: ['#16a34a', '#dc2626'],
            borderWidth: 0,
          }],
        },
        options: {
          cutout: '70%',
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } } },
          animation: { duration: 600 },
        },
      });
    } catch(e) { console.warn('[ADM] Chart.js error:', e.message); }
  });
};

ADM.renderDocentes = function() {
  const el = document.getElementById('adm-docentes-list');
  if (!el) return;
  if (!ADM.docentes.length) {
    el.innerHTML = `<div class="adm-empty" style="padding:48px 20px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">👨‍🏫</div>
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:6px;">Sin personal registrado</div>
      <div style="font-size:13px;color:#94a3b8;margin-bottom:16px;">Da de alta a docentes, coordinadores y demás personal escolar</div>
      <button onclick="ADM.abrirModalPersonal()" style="padding:10px 20px;background:linear-gradient(135deg,#0d5c2f,#157a40);color:white;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;">+ Alta de personal</button>
    </div>`; return;
  }
  const rolIcon  = { docente:'👨‍🏫', coordinador:'📋', ts:'🧠', prefecto:'👮', subdirector:'🏫', tutor:'🎓', admin:'⚙️', director:'🏛️' };
  const rolColor = { docente:'adm-badge-blue', coordinador:'adm-badge-amber', ts:'adm-badge-green', prefecto:'adm-badge-red', subdirector:'adm-badge-blue', tutor:'adm-badge-green', admin:'adm-badge-amber', director:'adm-badge-green' };
  const rolLabel = { docente:'Docente', coordinador:'Coordinador', ts:'Trab. Social', prefecto:'Prefecto', subdirector:'Subdirector', tutor:'Tutor', admin:'Admin', director:'Director/a' };
  const initials = n => n.split(' ').map(p=>p[0]||'').join('').toUpperCase().slice(0,2)||'?';
  const avatarColors = ['#0d5c2f','#1e40af','#7c3aed','#c2410c','#a16207','#047857'];
  el.innerHTML = ADM.docentes.map((d, i) => {
    const nombre = ((d.nombre||'') + ' ' + (d.apellido||d.apellido_p||'')).trim();
    const materias = window._admAsignaciones?.[d.id] || [];
    const color = avatarColors[i % avatarColors.length];
    const nivelLabel = d.nivel === 'ambos'
      ? '🏫 Ambos niveles'
      : d.nivel === 'secundaria'
        ? '🎓 Secundaria'
        : d.nivel === 'primaria'
          ? '📚 Primaria'
          : '';
    return `
    <div class="adm-card" style="padding:16px 18px;">
      <div class="adm-card-header" style="gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
          <div style="width:42px;height:42px;border-radius:12px;background:${color};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;flex-shrink:0;">${initials(nombre)}</div>
          <div style="min-width:0;">
            <div class="adm-card-title" style="font-size:14px;">${nombre}</div>
            <div class="adm-card-sub" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.email||'—'}</div>
            <div style="display:flex;gap:5px;margin-top:5px;flex-wrap:wrap;">
              <span class="adm-badge ${rolColor[d.rol]||'adm-badge-blue'}">${rolIcon[d.rol]||'👤'} ${rolLabel[d.rol]||d.rol}</span>
              ${d.turno ? `<span class="adm-badge" style="background:#f1f5f9;color:#475569;">${d.turno}</span>` : ''}
              ${nivelLabel ? `<span class="adm-badge" style="background:#eef2ff;color:#3730a3;">${nivelLabel}</span>` : ''}
              ${materias.length ? `<span class="adm-badge adm-badge-green">📚 ${materias.length} materia${materias.length>1?'s':''}</span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:5px;align-items:flex-start;flex-shrink:0;flex-wrap:wrap;">
          <button class="adm-btn-sm" onclick="ADM.abrirAsignarMaterias('${d.id}','${nombre}')" title="Asignar materias y grupos">📚</button>
          <button class="adm-btn-sm" onclick="ADM.generarInvitacion('${d.id}','${d.email||''}','${d.rol}')" title="Enviar invitación">📧</button>
          <button class="adm-btn-sm adm-btn-danger" onclick="ADM.desactivarPersonal('${d.id}','${nombre}')" title="Desactivar" aria-label="Cerrar">✕</button>
        </div>
      </div>
    </div>`;
  }).join('');
};

ADM.abrirModalPersonal = function() {
  // Asegurar nivel correcto ANTES de renderizar
  if (!ADM.escuelaNivel) {
    ADM.escuelaNivel = window._admNivelActivo
      || window._nivelActivo
      || window._escuelaCfg?.nivel_default
      || 'secundaria';
  }

  // Verificar conexión — usar sb global (siempre disponible si Supabase cargó)
  const sbRef = window.sb || ADM.sb;
  if (!sbRef) {
    ADM.toast('⚠️ Sin conexión a Supabase. Recarga la página.', 'warn');
    return;
  }

  // Si no hay grupos, cargar y reabrir (solo una vez para evitar loop)
  if (!ADM.grupos.length) {
    ADM.toast('⏳ Cargando grupos…');
    ADM.cargarGrupos().then(() => {
      if (ADM.grupos.length) {
        ADM.abrirModalPersonal();
      } else {
        // Sin grupos: abrir el modal igual pero mostrando aviso
        ADM._abrirFormPersonal();
      }
    });
    return;
  }

  ADM._abrirFormPersonal();
};

ADM.cambiarNivelPersonal = function(nivel) {
  ADM._personalNivelDraft = ADM._normalizarNivel(nivel);
  const wrap = document.getElementById('adm-p-materias-wrap');
  if (!wrap) return;
  wrap.innerHTML = ADM._renderMateriasPersonal(ADM._personalNivelDraft);
};

ADM._renderMateriasPersonal = function(nivelPersonal) {
  const nivel = ADM._normalizarNivel(nivelPersonal);
  const esSecundaria = nivel === 'secundaria';
  const esAmbos = nivel === 'ambos';
  const nivelLabel = nivel === 'ambos'
    ? 'Ambos niveles'
    : esSecundaria
      ? 'Secundaria (Campos Formativos Fase 6)'
      : 'Primaria (Asignaturas NEM)';

  let materiasHtml = '';
  if (esSecundaria) {
    const gruposPorGrado = {};
    ADM.grupos.forEach(g => {
      const k = g.grado || '?';
      if (!gruposPorGrado[k]) gruposPorGrado[k] = [];
      gruposPorGrado[k].push(g);
    });

    materiasHtml = CAMPOS_NEM_SECUNDARIA.map(campo => {
      const subOpts = campo.contenidos.map(asig => {
        const uid = 'mat_' + asig.replace(/[^a-z0-9]/gi,'_');
        let gruposChips = '';
        if (!ADM.grupos.length) {
          gruposChips = `<span style="font-size:11px;color:#f59e0b;font-weight:600;">
            ⚠️ Crea grupos primero en la sección Grupos</span>`;
        } else {
          gruposChips = Object.entries(gruposPorGrado)
            .sort((a,b) => parseInt(a[0])-parseInt(b[0]))
            .map(([grado, grupos]) => `
              <div style="margin-bottom:6px;">
                <div style="font-size:10px;color:#94a3b8;font-weight:700;
                  margin-bottom:4px;">${grado}° GRADO</div>
                <div style="display:flex;flex-wrap:wrap;gap:4px;">
                  ${grupos.map(g => {
                    const nom = g.seccion || g.nombre || '';
                    const turno = g.turno ? g.turno.slice(0,3).toUpperCase() : '';
                    return `<label style="display:inline-flex;align-items:center;gap:5px;
                      cursor:pointer;padding:5px 10px;border:1.5px solid #e2e8f0;
                      border-radius:8px;background:#f8fafc;font-size:12px;font-weight:700;
                      transition:.15s;user-select:none;"
                      onmouseover="this.style.borderColor='${campo.color}';this.style.background='${campo.bg}'"
                      onmouseout="if(!this.querySelector('input').checked){this.style.borderColor='#e2e8f0';this.style.background='#f8fafc'}">
                      <input type="checkbox" class="mat-grupo-check"
                        data-grupo-id="${g.id}"
                        data-grupo-nombre="${g.nombre||g.grado+'°'+nom}"
                        style="accent-color:${campo.color};width:13px;height:13px;"
                        onchange="
                          var lbl=this.closest('label');
                          if(this.checked){lbl.style.borderColor='${campo.color}';lbl.style.background='${campo.bg}';lbl.style.color='${campo.color}';}
                          else{lbl.style.borderColor='#e2e8f0';lbl.style.background='#f8fafc';lbl.style.color='';}
                        ">
                      <span>${nom}</span>
                      <span style="font-size:9px;color:#94a3b8;font-weight:400;">${turno}</span>
                    </label>`;
                  }).join('')}
                </div>
              </div>`).join('');
        }

        return `
        <div style="margin:3px 0;border-radius:8px;border:1px solid #f1f5f9;overflow:hidden;">
          <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;
            cursor:pointer;background:#fafafa;">
            <input type="checkbox" id="chk_${uid}" class="mat-asig-check"
              data-materia="${asig}" data-campo="${campo.materias[0]}"
              style="accent-color:${campo.color};width:16px;height:16px;flex-shrink:0;"
              onchange="admToggleGruposMateria('${uid}',this.checked)">
            <span style="font-size:13px;font-weight:700;color:#0f172a;flex:1;">${asig}</span>
            <span style="font-size:10px;color:#94a3b8;" id="cnt_${uid}"></span>
          </label>
          <div id="grupos_${uid}" style="display:none;padding:10px 12px 12px;background:white;
            border-top:1px solid #f1f5f9;">
            <div style="font-size:10px;color:#64748b;margin-bottom:8px;font-weight:700;
              text-transform:uppercase;letter-spacing:.5px;">Selecciona los grupos donde imparte:</div>
            ${gruposChips}
          </div>
        </div>`;
      }).join('');

      return `
      <div style="border:1.5px solid #e2e8f0;border-radius:12px;margin-bottom:8px;overflow:hidden;
        box-shadow:0 1px 3px rgba(0,0,0,.05);">
        <div style="padding:12px 16px;background:${campo.bg};cursor:pointer;
          display:flex;align-items:center;gap:12px;"
          onclick="admToggleCampoSection('campo_${campo.id}')">
          <span style="font-size:22px;">${campo.emoji}</span>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:700;color:${campo.color};">${campo.nombre}</div>
            <div style="font-size:11px;color:#64748b;margin-top:1px;">${campo.contenidos.join(' · ')}</div>
          </div>
          <span id="arrow_campo_${campo.id}"
            style="font-size:18px;color:${campo.color};font-weight:700;transition:.2s;">▲</span>
        </div>
        <div id="campo_${campo.id}" style="display:block;padding:8px 12px 12px;background:white;">
          ${subOpts}
        </div>
      </div>`;
    }).join('');
  } else {
    const materias = (ADM.materias||[]).filter(m => {
      if (!m.nivel || m.nivel === 'ambos') return true;
      if (esAmbos) return m.nivel === 'primaria' || m.nivel === 'secundaria';
      return m.nivel === nivel;
    });
    const fallbackAmbos = [
      ...getMateriasByNivel('primaria'),
      ...CAMPOS_NEM_SECUNDARIA.flatMap(c => c.contenidos || [])
    ];
    const matList  = materias.length
      ? materias
      : [...new Set((esAmbos ? fallbackAmbos : getMateriasByNivel(nivel)).filter(Boolean))]
          .map((n,i)=>({id:'g'+i,nombre:n}));
    materiasHtml = matList.map(m => {
      const uid = 'mat_' + (m.nombre||m.id).replace(/[^a-z0-9]/gi,'_');
      return `
      <div class="mat-asig-row" id="row_${uid}" style="margin-bottom:6px;
        border:1.5px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <div style="padding:8px 12px;background:#f8fafc;display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="chk_${uid}" class="mat-asig-check"
            data-materia="${m.nombre||m.id}" data-campo=""
            style="accent-color:#0d5c2f;width:15px;height:15px;"
            onchange="admToggleGruposMateria('${uid}',this.checked)">
          <label for="chk_${uid}" style="font-size:13px;font-weight:600;cursor:pointer;">
            ${m.nombre||m.id}
          </label>
        </div>
        <div id="grupos_${uid}" style="display:none;padding:8px 12px;background:white;">
          <div style="font-size:11px;color:#64748b;margin-bottom:5px;font-weight:600;">
            Grupos donde imparte:
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${ADM.grupos.map(g => `
              <label style="display:flex;align-items:center;gap:4px;font-size:11px;
                font-weight:600;cursor:pointer;padding:4px 10px;
                border:1.5px solid #e2e8f0;border-radius:99px;background:#f8fafc;">
                <input type="checkbox" class="mat-grupo-check"
                  data-grupo-id="${g.id}"
                  data-grupo-nombre="${g.nombre||g.grado+'°'}"
                  style="accent-color:#0d5c2f;">
                ${g.nombre||g.grado+'°'} ${g.seccion||''}
                <span style="color:#94a3b8;font-size:10px;">${g.turno||''}</span>
              </label>`).join('')}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  return `
    <div class="adm-form-group">
      <label>${esSecundaria ? 'Campos Formativos y asignaturas que imparte' : esAmbos ? 'Materias y grupos habilitados' : 'Materias que imparte'}
        <span style="font-weight:400;color:#94a3b8;font-size:11px;">(${nivelLabel})</span>
      </label>
      <div style="font-size:11px;color:#64748b;margin-bottom:8px;">
        ${esAmbos
          ? 'El personal podrá operar en primaria y secundaria. Selecciona las materias y grupos que cubrirá en ambos niveles.'
          : 'Selecciona la materia y luego los grupos donde la imparte'
        }
      </div>
      <div id="adm-p-materias-checks">${materiasHtml}</div>
    </div>`;
};

// Función interna que renderiza el modal (separada para evitar el loop)
ADM._abrirFormPersonal = function() {
  const escuelaMixta = ADM._escuelaManejaAmbos();
  const nivelPersonal = ADM._nivelFormPersonal();
  const nivelLabel = nivelPersonal === 'ambos'
    ? 'Ambos niveles'
    : nivelPersonal === 'secundaria'
      ? 'Secundaria (Campos Formativos Fase 6)'
      : 'Primaria (Asignaturas NEM)';

  // Opciones de grupos para los selects de cada materia
  const grupoOptsHtml = ADM.grupos
    .map(g => `<option value="${g.id}">${g.nombre||g.grado+'°'} ${g.seccion||''} ${g.turno?'('+g.turno+')':''}</option>`)
    .join('');

  // Año/ciclo
  const anioActual = new Date().getFullYear();
  const ciclosHtml = [anioActual+'-'+(anioActual+1), (anioActual-1)+'-'+anioActual]
    .map((c,i)=>`<option value="${c}"${i===0?' selected':''}>${c}</option>`).join('');

  const alumnosHtml = ADM.alumnos.length
    ? ADM.alumnos.map(a => `<option value="${a.id}">${(a.nombre+' '+(a.apellido||a.apellido_p||'')).trim()}</option>`).join('')
    : '<option value="">Sin alumnos registrados</option>';

  const gruposTutoriaHtml = ADM.grupos
    .map(g => `<option value="${g.id}">${g.nombre||g.grado+'° '+(g.seccion||'A')}</option>`)
    .join('');

  ADM.abrirModal('adm-modal-personal',
    '➕ Alta de personal escolar',
    `<div style="background:#f0fdf4;border-radius:10px;padding:10px 14px;margin-bottom:16px;
      font-size:12px;color:#166534;display:flex;align-items:center;gap:8px;">
      <span style="font-size:16px;">📧</span>
      <span>Se enviará un correo de invitación automáticamente para que el usuario cree su contraseña.</span>
    </div>
    <div class="adm-form-row">
      <div class="adm-form-group"><label>Nombre(s)</label>
        <input type="text" id="adm-p-nombre" placeholder="María"></div>
      <div class="adm-form-group"><label>Apellido(s)</label>
        <input type="text" id="adm-p-apellido" placeholder="Apellido(s)"></div>
    </div>
    <div class="adm-form-group">
      <label>Correo electrónico</label>
      <input type="email" id="adm-p-email" placeholder="usuario&#64;escuela.edu.mx">
    </div>
    <div class="adm-form-row">
      <div class="adm-form-group">
        <label>Rol en la escuela</label>
        <select id="adm-p-rol" onchange="admToggleRolFields(this.value)">
          <option value="docente">Docente</option>
          <option value="director">Director/a</option>
          <option value="subdirector">Subdirector/a</option>
          <option value="coordinador">Coordinador académico</option>
          <option value="ts">Trabajo Social</option>
          <option value="prefecto">Prefecto/a</option>
          <option value="tutor">Tutor de grupo</option>
          <option value="padre">Familia / Padre de familia</option>
        </select>
      </div>
      <div class="adm-form-group">
        <label>Turno</label>
        <select id="adm-p-turno">
          <option value="matutino">Matutino</option>
          <option value="vespertino">Vespertino</option>
          <option value="discontinuo">Discontinuo</option>
        </select>
      </div>
    </div>
    <div class="adm-form-row">
      <div class="adm-form-group">
        <label>Ciclo escolar</label>
        <select id="adm-p-ciclo">${ciclosHtml}</select>
      </div>
      <div class="adm-form-group">
        <label>Nivel educativo</label>
        <select id="adm-p-nivel" ${escuelaMixta ? `onchange="ADM.cambiarNivelPersonal(this.value)"` : 'disabled'}
          style="${escuelaMixta ? '' : 'background:#f8fafc;color:#64748b;'}">
          ${escuelaMixta
            ? `
              <option value="primaria" ${nivelPersonal==='primaria'?'selected':''}>📚 Primaria</option>
              <option value="secundaria" ${nivelPersonal==='secundaria'?'selected':''}>🎓 Secundaria</option>
              <option value="ambos" ${nivelPersonal==='ambos'?'selected':''}>🏫 Ambos niveles</option>
            `
            : `<option value="${nivelPersonal}">${nivelLabel}</option>`
          }
        </select>
      </div>
    </div>
    <div class="adm-form-group" id="campo-grupo-tutoria">
      <label>Grupo tutoría</label>
      <select id="adm-p-grupo-tutoria">
        <option value="">— Sin tutoría —</option>${gruposTutoriaHtml}
      </select>
    </div>
    <div id="adm-p-grupos-wrap">
      <div id="adm-p-materias-wrap">${ADM._renderMateriasPersonal(nivelPersonal)}</div>
    </div>
    <div id="adm-p-familia-wrap" style="display:none;">
      <div class="adm-form-group">
        <label>Alumno que tutora</label>
        <select id="adm-p-familia-alumno">
          <option value="">Seleccionar alumno…</option>${alumnosHtml}
        </select>
      </div>
    </div>`,
    'ADM.guardarPersonal()',
    'Dar de alta y enviar invitación'
  );
  setTimeout(() => admToggleRolFields('docente'), 80);
}; // end ADM._abrirFormPersonal

// ── Toggle campo formativo (expandir/colapsar) ────────────────────────
function admToggleCampoSection(id) {
  const el    = document.getElementById(id);
  const arrow = document.getElementById('arrow_' + id);
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display    = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▼' : '▲';
}

// ── Toggle grupos de una materia al seleccionarla ─────────────────────
function admToggleGruposMateria(uid, checked) {
  const gruposWrap = document.getElementById('grupos_' + uid);
  if (!gruposWrap) return;
  gruposWrap.style.display = checked ? 'block' : 'none';
  if (!checked) {
    // Desmarcar todos los grupos al desmarcar la materia
    gruposWrap.querySelectorAll('.mat-grupo-check').forEach(cb => cb.checked = false);
  }
}


ADM.guardarPersonal = async function() {
  // Normalizar referencia a Supabase al inicio
  const sb = window.sb || ADM.sb || null;

  const nombre       = document.getElementById('adm-p-nombre').value.trim();
  const apellido     = document.getElementById('adm-p-apellido').value.trim();
  const email        = document.getElementById('adm-p-email').value.trim().toLowerCase();
  const rol          = document.getElementById('adm-p-rol').value;
  const turno        = document.getElementById('adm-p-turno')?.value || 'matutino';
  const nivelPersonal= document.getElementById('adm-p-nivel')?.value
    || ADM.escuelaNivel
    || window._admNivelActivo
    || window._nivelActivo
    || null;
  const cicloForm    = document.getElementById('adm-p-ciclo')?.value || window.CICLO_ACTIVO;
  const grupoTutoria   = document.getElementById('adm-p-grupo-tutoria')?.value || null;
  const familiaAlumnoId= document.getElementById('adm-p-familia-alumno')?.value || null;
  // Recoger grupos seleccionados
  const gruposSeleccionados = Array.from(
    document.querySelectorAll('#adm-p-grupos-checks input[type=checkbox]:checked')
  ).map(el => el.value).filter(Boolean);

  // ── Recoger asignaciones materia+grupos del nuevo modal ──────────────
  // Estructura: [{ materia, campo, grupoIds: [id1, id2...] }]
  const asignacionesNuevas = [];
  document.querySelectorAll('#adm-p-materias-checks .mat-asig-check:checked').forEach(chkMat => {
    const materia = chkMat.dataset.materia;
    const campo   = chkMat.dataset.campo || null;
    const uid     = chkMat.id.replace('chk_', '');
    // Grupos seleccionados para esta materia
    const gruposWrap = document.getElementById('grupos_' + uid);
    const grupoIds = gruposWrap
      ? Array.from(gruposWrap.querySelectorAll('.mat-grupo-check:checked'))
          .map(cb => cb.dataset.grupoId).filter(Boolean)
      : [];
    if (materia) {
      asignacionesNuevas.push({ materia, campo, grupoIds });
    }
  });

  // Para compatibilidad con el código anterior que usa materiasSeleccionadas y gruposSeleccionados
  const materiasSeleccionadas = asignacionesNuevas.map(a => a.materia);
  // gruposSeleccionados ya está definido arriba (de #adm-p-grupos-checks), mantenemos por compatibilidad
  // Obtener escuela — múltiples fuentes en orden de prioridad
  let escuelaCct = ADM.escuelaCct 
    || ADM.currentPerfil?.escuela_cct 
    || window.currentPerfil?.escuela_cct 
    || null;

  // Último recurso: buscar directo en BD la primera escuela activa
  if (!escuelaCct && window.sb) {
    const { data: escList } = await window.sb
      .from('escuelas').select('cct').eq('activa', true).limit(1).single();
    if (escList?.cct) {
      escuelaCct = escList.cct;
      ADM.escuelaCct = escuelaCct;
    }
  }

  const escuelaNom = ADM.escuelaNombre || escuelaCct || '—';

  if (!nombre || !email) { ADM.toast('⚠️ Nombre y correo son obligatorios', 'warn'); return; }
  if (!escuelaCct)       { ADM.toast('⚠️ No se detectó la escuela activa', 'warn'); return; }

  const ROL_LABELS = {
    docente:'Docente', director:'Director/a', subdirector:'Subdirector/a',
    coordinador:'Coordinador académico', ts:'Trabajo Social',
    prefecto:'Prefecto/a', tutor:'Tutor de grupo', padre:'Familia'
  };

  try {
    if (sb) {
      // ── PASO 1: Crear/actualizar usuario via sb.rpc('upsert_usuario') ──
      let usuarioData = null;
      let usuarioId   = null;

      // Resolver UUID de escuela ANTES de crear usuario
      let escuelaUuidFinal = ADM.escuelaId || null;
      if (!escuelaUuidFinal || !/^[0-9a-f-]{36}$/i.test(String(escuelaUuidFinal))) {
        if (escuelaCct && sb) {
          const { data: escRow } = await sb.from('escuelas')
            .select('id').eq('cct', escuelaCct).maybeSingle();
          if (escRow?.id) {
            escuelaUuidFinal = escRow.id;
            ADM.escuelaId = escRow.id;
          }
        }
      }

      try {
        const { data: rpcResult, error: rpcErr } = await sb.rpc('upsert_usuario', {
          p_auth_id:    null,
          p_email:      email,
          p_nombre:     nombre,
          p_apellido_p: apellido.split(' ')[0] || '',
          p_apellido_m: apellido.split(' ').slice(1).join(' ') || '',
          p_rol:        rol,
          p_escuela_id: escuelaUuidFinal || '',   // UUID real
          p_escuela_cct: escuelaCct || '',         // CCT texto
        });
        if (rpcErr) throw rpcErr;
        if (rpcResult && typeof rpcResult === 'object' && rpcResult.id) {
          usuarioData = rpcResult;
          usuarioId = rpcResult.id;
        } else if (rpcResult) {
          usuarioId = rpcResult;
        }
      } catch(rpcE) {
        console.warn('[ADM] upsert_usuario rpc failed, fallback directo:', rpcE.message);
        // Fallback: insert directo con tipos correctos
        const insertPayload = {
          nombre,
          apellido_p:  apellido.split(' ')[0] || '',
          apellido_m:  apellido.split(' ').slice(1).join(' ') || '',
          email, rol, activo: true, turno,
          nivel:       nivelPersonal,
          escuela_cct: escuelaCct || null,
          escuela_id:  escuelaUuidFinal || null,  // UUID, nunca CCT
          created_at:  new Date().toISOString(),
        };
        const { data: insertedData, error: insertErr } = await sb.from('usuarios')
          .insert(insertPayload).select().single();
        if (insertErr) {
          if (insertErr.message?.toLowerCase().includes('duplicate') || insertErr.code === '23505') {
            const { data: existingData } = await sb.from('usuarios')
              .select('*').eq('email', email).single();
            usuarioData = existingData;
            if (existingData?.id) {
              await sb.from('usuarios').update({
                escuela_cct: escuelaCct || null,
                escuela_id:  escuelaUuidFinal || null,
                rol, activo: true, turno, nivel: nivelPersonal
              }).eq('id', existingData.id);
            }
            ADM.toast(`ℹ️ ${nombre} ya existía — cuenta actualizada`, 'ok');
          } else {
            throw insertErr;
          }
        } else {
          usuarioData = insertedData;
        }
      }

      // Si no tenemos el objeto completo, buscarlo
      if (!usuarioData && usuarioId) {
        const { data: found } = await sb.from('usuarios').select('*').eq('id', usuarioId).single();
        if (found) usuarioData = found;
      }
      if (!usuarioId && usuarioData) usuarioId = usuarioData.id;
      // Si aún no tenemos el usuario, buscarlo por email
      if (!usuarioId) {
        const { data: byEmail } = await sb.from('usuarios').select('*').eq('email', email).single();
        if (byEmail) { usuarioData = byEmail; usuarioId = byEmail.id; }
      }

      // Asegurar metadatos del perfil aunque el alta haya pasado por RPC o fallback.
      if (usuarioId) {
        const perfilPatch = {
          turno,
          nivel: nivelPersonal,
        };
        try {
          const { error: perfilErr } = await sb.from('usuarios')
            .update(perfilPatch)
            .eq('id', usuarioId);
          if (perfilErr) console.warn('[ADM] perfilPatch:', perfilErr.message);
          else usuarioData = { ...(usuarioData || {}), ...perfilPatch };
        } catch(perfilErr) {
          console.warn('[ADM] perfilPatch:', perfilErr.message);
        }
      }

      // ── PASO 2: Vincular docente con la escuela en usuario_escuelas ──
      if (usuarioId) {
        try {
          await sb.from('usuario_escuelas').upsert({
            usuario_id:        usuarioId,
            escuela_cct:       escuelaCct,
            rol,
            activo:            true,
            fecha_solicitud:   new Date().toISOString(),
            fecha_aprobacion:  new Date().toISOString(),
            aprobado_por:      window.currentUser?.id || null,
          }, { onConflict: 'usuario_id,escuela_cct' });
        } catch(ueErr) { console.warn('[ADM] usuario_escuelas:', ueErr.message); }
      }

      // ── PASO 3: Asignaciones especiales ──
      // 3a. Si es tutor, asignar grupo en grupos.docente_guia Y en tutores_grupo
      if (grupoTutoria && usuarioId) {
        await sb.from('grupos').update({ docente_guia: usuarioId }).eq('id', grupoTutoria);
        // También escribir en tutores_grupo para que el chat padre↔tutor funcione
        try {
          await sb.from('tutores_grupo').upsert({
            tutor_id:    usuarioId,
            grupo_id:    grupoTutoria,
            ciclo:       cicloForm || window.CICLO_ACTIVO || '2025-2026',
            escuela_cct: ADM.escuelaCct || window.currentPerfil?.escuela_cct || '',
            activo:      true,
          }, { onConflict: 'tutor_id,grupo_id,ciclo' });
        } catch(tgErr) { console.warn('[ADM] tutores_grupo:', tgErr.message); }
        // Marcar al usuario como tutor
        try {
          await sb.from('usuarios').update({ es_tutor: true, grupo_tutoria: grupoTutoria }).eq('id', usuarioId);
        } catch(etErr) { console.warn('[ADM] es_tutor update:', etErr.message); }
      }

      // 3b. Guardar asignaciones materia+grupos usando la nueva estructura
      if (usuarioId && asignacionesNuevas.length) {
        const rows = [];
        for (const asig of asignacionesNuevas) {
          if (!asig.materia) continue;
          if (asig.grupoIds.length) {
            // Crear una fila por cada grupo seleccionado para esta materia
            for (const grupoId of asig.grupoIds) {
              const grupoObj = ADM.grupos.find(g => g.id === grupoId);
              rows.push({
                docente_id:      usuarioId,
                grupo_id:        grupoId,
                materia:         asig.materia,
                campo_formativo: asig.campo || null,
                ciclo:           cicloForm,
                turno:           grupoObj?.turno || null,
                nivel:           grupoObj?.nivel || ADM.escuelaNivel || null,
                activo:          true,
              });
            }
          } else {
            // Sin grupo específico → asignación general
            rows.push({
              docente_id:      usuarioId,
              grupo_id:        null,
              materia:         asig.materia,
              campo_formativo: asig.campo || null,
              ciclo:           cicloForm,
              turno:           null,
              nivel:           ADM.escuelaNivel || null,
              activo:          true,
            });
          }
        }
        if (rows.length) {
          try {
            const { error: dgErr } = await sb.from('docente_grupos')
              .upsert(rows, { onConflict: 'docente_id,grupo_id,materia,ciclo' });
            if (dgErr) console.warn('[ADM] docente_grupos insert:', dgErr.message);
            else console.log('[ADM] ✅ Asignaciones guardadas:', rows.length);
          } catch(e2) { console.warn('[ADM] docente_grupos insert:', e2.message); }
        }
      } else if (usuarioId && gruposSeleccionados.length && materiasSeleccionadas.length) {
        // Fallback: estructura antigua si el modal no generó asignacionesNuevas
        const rows = [];
        for (const gId of gruposSeleccionados) {
          for (const mat of materiasSeleccionadas) {
            rows.push({ docente_id: usuarioId, grupo_id: gId, materia: mat, ciclo: cicloForm, activo: true });
          }
        }
        try {
          await sb.from('docente_grupos').upsert(rows, { onConflict: 'docente_id,grupo_id,materia,ciclo' });
        } catch(e2) { console.warn('[ADM] docente_grupos fallback:', e2.message); }
      }

      // 3c. Si es padre de familia, vincular con el alumno
      if (rol === 'padre' && familiaAlumnoId && usuarioId) {
        try {
          const codigo = ADM._generarCodigoCorto();
          await sb.from('vinculos_padre').upsert({
            padre_id:   usuarioId,
            alumno_id:  familiaAlumnoId,
            codigo,
            escuela_id: escuelaCct,
            activo:     true,
            usado:      true,
            created_at: new Date().toISOString(),
          }, { onConflict: 'padre_id,alumno_id' });
        } catch(e3) { console.warn('[ADM] vinculos_padre:', e3.message); }
      }

      // ── PASO 4: Generar token → Guardar en invitaciones → Llamar Edge Function ──
      try {
        const token  = ADM._generarToken();
        const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const invLink = `${window.location.origin}/index.html?invite=${token}`;

        // 4a. Resolver UUID de escuela (necesario para invitaciones.escuela_id)
        let escuelaUuid = ADM.escuelaId || null;
        // Validar que sea UUID real (no CCT)
        const isValidUuid = escuelaUuid && /^[0-9a-f-]{36}$/i.test(String(escuelaUuid));
        if (!isValidUuid && escuelaCct) {
          const { data: escReal } = await sb.from('escuelas')
            .select('id').eq('cct', escuelaCct).maybeSingle();
          if (escReal?.id) {
            escuelaUuid = escReal.id;
            ADM.escuelaId = escReal.id;
          }
        }

        // 4b. Insertar invitación — siempre incluir escuela_cct como respaldo
        const invPayload = {
          token,
          escuela_id:     ADM.escuelaId || null,
          escuela_cct:    escuelaCct || null,
          rol,
          email_destino:  email,
          nombre_destino: `${nombre} ${apellido}`.trim(),
          estado:         'pendiente',
          expira_at:      expira,
          creado_por:     window.currentUser?.id || null,
          created_at:     new Date().toISOString(),
        };
        // Agregar escuela_id solo si es UUID válido
        if (escuelaUuid && /^[0-9a-f-]{36}$/i.test(String(escuelaUuid))) {
          invPayload.escuela_id = escuelaUuid;
        }

        const { error: invErr } = await sb.from('invitaciones')
          .upsert(invPayload, { onConflict: 'token' });

        if (invErr) {
          console.warn('[ADM] invitaciones insert error:', invErr.message);
          // Intentar sin escuela_id si hay error de tipo
          if (invErr.message?.includes('uuid') || invErr.message?.includes('type')) {
            delete invPayload.escuela_id;
            await sb.from('invitaciones').upsert(invPayload, { onConflict: 'token' });
          }
        }
        console.log('[ADM] ✅ Token guardado en invitaciones:', token.slice(0,12) + '...');

        // 4b. Llamar Edge Function invite-user para enviar email vía Brevo
        // ¡NUNCA llamar supabase.auth.admin.inviteUserByEmail()!
        let emailEnviado = false;
const supabaseUrl = window.sb?.supabaseUrl || SUPABASE_URL || 'https://mgmkzxtljkyoxqeytbjv.supabase.co';
        const { data: { session } } = await sb.auth.getSession();
        const jwt = session?.access_token;

        if (email && jwt) {
          try {
            const invRes = await fetch(`${supabaseUrl}/functions/v1/invite-user`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`,
              },
              body: JSON.stringify({
                email,
                rol,
                escuela_nombre: escuelaNom,
                invited_by:     window.currentPerfil?.nombre || 'Admin',
                token,
                link:           invLink,
              }),
            });
            const invResData = await invRes.json().catch(() => ({}));
            if (invRes.ok || invResData.ok || invResData.email_enviado) {
              emailEnviado = true;
            }
          } catch(efErr) { console.warn('[ADM] Edge Function invite-user:', efErr.message); }
        }

        // 4c. Mostrar resultado con link copiable, WhatsApp, email
        const emailMsg = emailEnviado
          ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#166534;font-weight:600;">✅ Email enviado a ${email}</div>`
          : `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#92400e;">⚠️ Email no enviado — comparte el link manualmente</div>`;

        // Cerrar modal de formulario primero
        ADM.cerrarModal();
        setTimeout(() => {
          ADM.abrirModal('adm-modal-token', `✅ ${nombre} dado de alta como ${ROL_LABELS[rol]||rol}`,
            `<div style="text-align:center;padding:8px 0;">
              ${emailMsg}
              <div style="font-size:13px;color:#64748b;margin-bottom:14px;">
                Comparte este enlace con <strong>${nombre}</strong> para que cree su cuenta:
              </div>
              <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:14px;">
                <div style="font-size:10px;color:#166534;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Link de registro</div>
                <div style="font-family:monospace;font-size:12px;color:#0d5c2f;word-break:break-all;cursor:pointer;" onclick="navigator.clipboard.writeText('${invLink}');ADM.toast('✅ Link copiado')">${invLink}</div>
              </div>
              <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                <button onclick="navigator.clipboard.writeText('${invLink}');ADM.toast('✅ Link copiado')"
                  style="padding:8px 16px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">📋 Copiar link</button>
                <button onclick="window.open('https://wa.me/?text='+encodeURIComponent('🌱 SIEMBRA — Te invito a registrarte como ${ROL_LABELS[rol]||rol}.\\nCrea tu cuenta aquí:\\n${invLink}\\nExpira en 7 días.'),'_blank')"
                  style="padding:8px 16px;background:#25d366;color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">💬 WhatsApp</button>
                <button onclick="window.open('mailto:${email}?subject='+encodeURIComponent('Invitación a SIEMBRA — ${escuelaNom}')+'&body='+encodeURIComponent('Hola ${nombre},\\n\\nTe invito a registrarte en SIEMBRA como ${ROL_LABELS[rol]||rol}.\\n\\nCrea tu cuenta aquí: ${invLink}\\n\\nExpira en 7 días.'),'_blank')"
                  style="padding:8px 16px;background:#dbeafe;border:1.5px solid #93c5fd;color:#1e40af;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">📧 Email</button>
              </div>
              <div style="margin-top:14px;padding:10px;background:#f8fafc;border-radius:8px;border:1px dashed #cbd5e1;">
                <div style="font-size:10px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">Token (respaldo)</div>
                <div style="font-family:monospace;font-size:13px;color:#475569;font-weight:600;cursor:pointer;" onclick="navigator.clipboard.writeText('${token}');ADM.toast('✅ Token copiado')">${token}</div>
              </div>
              <div style="font-size:11px;color:#94a3b8;margin-top:10px;">Válido por 7 días · Un solo uso</div>
            </div>`,
            null, 'Cerrar'
          );
        }, 300);

        ADM.toast(emailEnviado ? `✅ ${nombre} dado de alta · Email enviado a ${email}` : `✅ ${nombre} registrado · Comparte el link`, emailEnviado ? 'ok' : 'warn');

      } catch(invErr) {
        ADM.toast(`✅ ${nombre} registrado (sin invitación: ${invErr.message})`, 'warn');
        console.warn('[ADM] invite flow error:', invErr.message);
      }

      // Siempre agregar/actualizar en el array local para reflejar en la UI
      if (usuarioData) {
        const existIdx = ADM.docentes.findIndex(d => d.id === usuarioData.id || d.email === email);
        if (existIdx !== -1) ADM.docentes[existIdx] = usuarioData;
        else ADM.docentes.push(usuarioData);
      }

    } else {
      // Sin Supabase — mostrar error claro en lugar de guardar localmente
      ADM.toast('❌ Sin conexión a Supabase. Recarga la página e intenta de nuevo.', 'err');
      console.error('[ADM] guardarPersonal: sb es null. window.sb=', window.sb, 'ADM.sb=', ADM.sb);
      return;
    }

    ADM.renderDocentes();
    ADM.renderDashboard();
    // Recargar desde BD para confirmar que el dato persistió correctamente
    setTimeout(async () => {
      await ADM.cargarDocentes();
      ADM.renderDocentes();
      ADM.renderAsignaciones();
    }, 800);
  } catch(e) { ADM.toast('❌ ' + e.message, 'err'); }
};

// ── Panel de cobertura escolar global (para modal de asignaciones) ─────────
ADM._htmlPanelCoberturaEscolar = function(docenteId) {
  const grupos = ADM.grupos || [];
  if (!grupos.length) return '';

  // Por cada grupo: calcular qué cubre este docente y qué falta en total
  const asignStore = ADM.asignacionesPorDocente || window._admAsignaciones || {};
  const normM = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

  const filas = grupos.map(g => {
    const cobGlobal = ADM._coberturaGrupo(g);
    const misAsigns = (asignStore[docenteId] || []).filter(a => a.grupo_id === g.id);
    const misMateriasNorm = new Set(misAsigns.map(a => normM(a.materia)));
    const pct = cobGlobal.esperadas.length
      ? Math.round((cobGlobal.cubiertas.length / cobGlobal.esperadas.length) * 100)
      : 0;
    const colorBar = pct >= 100 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626';
    const nombreGrupo = g.nombre || (g.grado + '° ' + (g.seccion || ''));

    // Chips de materias faltantes con botón de asignación rápida
    const faltantesChips = cobGlobal.faltantes.map(m => {
      const yoLaTengo = misMateriasNorm.has(normM(m));
      return yoLaTengo
        ? `<span style="display:inline-flex;align-items:center;gap:3px;background:#dcfce7;border:1px solid #bbf7d0;border-radius:20px;padding:2px 9px;font-size:10px;color:#166534;font-weight:700;">✓ ${m}</span>`
        : `<button onclick="ADM._asignarRapido('${docenteId}','${g.id}','${m.replace(/'/g, "\\'")}')"
              style="display:inline-flex;align-items:center;gap:3px;background:#fff7ed;border:1px solid #fed7aa;border-radius:20px;padding:2px 9px;font-size:10px;color:#9a3412;font-weight:700;cursor:pointer;transition:.15s;"
              title="Asignar esta materia a este docente"
              onmouseover="this.style.background='#fed7aa'" onmouseout="this.style.background='#fff7ed'">+ ${m}</button>`;
    }).join('');

    return `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:8px;">
        <div style="display:grid;grid-template-columns:80px 1fr 44px;gap:8px;align-items:center;margin-bottom:6px;">
          <div style="font-size:12px;font-weight:800;color:#0f172a;">${nombreGrupo}</div>
          <div style="height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${colorBar};border-radius:999px;transition:width .4s;"></div>
          </div>
          <div style="font-size:11px;font-weight:800;color:${colorBar};text-align:right;">${pct}%</div>
        </div>
        ${cobGlobal.faltantes.length
          ? `<div style="display:flex;flex-wrap:wrap;gap:4px;">${faltantesChips}</div>`
          : `<div style="font-size:11px;color:#16a34a;font-weight:700;">✅ Cobertura completa</div>`}
      </div>`;
  }).join('');

  const totalEsp = grupos.reduce((acc, g) => acc + ADM._coberturaGrupo(g).esperadas.length, 0);
  const totalCub = grupos.reduce((acc, g) => acc + ADM._coberturaGrupo(g).cubiertas.length, 0);
  const pctGlobal = totalEsp ? Math.round((totalCub / totalEsp) * 100) : 0;
  const colorGlobal = pctGlobal >= 100 ? '#16a34a' : pctGlobal >= 60 ? '#d97706' : '#dc2626';

  return `
    <div style="border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:16px;">
      <div style="background:#f1f5f9;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;"
           onclick="const b=document.getElementById('adm-cobertura-body');b.style.display=b.style.display==='none'?'block':'none'">
        <div style="font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;">
          📊 Cobertura escolar por grupos
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:13px;font-weight:900;color:${colorGlobal};">${pctGlobal}% global</span>
          <span style="font-size:11px;color:#94a3b8;">${totalCub}/${totalEsp} materias</span>
          <span style="font-size:12px;color:#94a3b8;">▼</span>
        </div>
      </div>
      <div id="adm-cobertura-body" style="padding:12px;display:block;">
        <div style="font-size:11px;color:#64748b;margin-bottom:10px;">Los botones naranjas son materias sin docente — haz clic para asignarlas a este docente.</div>
        ${filas}
      </div>
    </div>`;
};

ADM._asignarRapido = function(docenteId, grupoId, materia) {
  const selMat = document.getElementById('adm-mat-sel');
  const selGrupo = document.getElementById('adm-mat-grupo-sel');
  if (selMat && selGrupo) {
    // Buscar option que contenga la materia
    const opts = Array.from(selMat.options);
    const match = opts.find(o => {
      const partes = o.value.split('::');
      const val = partes.length > 1 ? partes[1] : o.value;
      return val.trim().toLowerCase() === materia.trim().toLowerCase();
    });
    if (match) {
      selMat.value = match.value;
      selMat.dispatchEvent(new Event('change'));
    } else {
      // Usar "otra materia"
      selMat.value = '__nueva__';
      selMat.dispatchEvent(new Event('change'));
      const inp = document.getElementById('adm-mat-nueva');
      if (inp) inp.value = materia;
    }
    selGrupo.value = grupoId;
    // Scroll al form
    selMat.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

ADM.abrirAsignarMaterias = function(docenteId, docenteNombre) {
  const asignadas = ADM._getAsignacionesDocente(docenteId);
  const esSecundaria = ADM.escuelaNivel === 'secundaria';

  // Opciones de materia según nivel
  let materiaOptsHtml = '';
  if (esSecundaria) {
    CAMPOS_NEM_SECUNDARIA.forEach(campo => {
      materiaOptsHtml += `<optgroup label="${campo.emoji} ${campo.nombre}">`;
      campo.contenidos.forEach(c => {
        materiaOptsHtml += `<option value="${campo.materias[0]}::${c}">${c}</option>`;
      });
      materiaOptsHtml += `</optgroup>`;
    });
  } else {
    materiaOptsHtml = ADM.materias.map(m =>
      `<option value="${m.nombre||m.id}">${m.nombre}</option>`
    ).join('');
  }
  materiaOptsHtml += `<option value="__nueva__">+ Otra materia…</option>`;

  const grupoOpts = ADM.grupos.map(g =>
    `<option value="${g.id}">${g.nombre||g.grado+'°'} ${g.turno?'('+g.turno+')':''}</option>`
  ).join('');

  const anioActual = new Date().getFullYear();
  const cicloOpts = [
    `${anioActual}-${anioActual+1}`,
    `${anioActual-1}-${anioActual}`
  ].map((c,i) => `<option value="${c}" ${i===0?'selected':''}>${c}</option>`).join('');

  const asignadasHtml = asignadas.length
    ? asignadas.map(a => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;
          background:#f0fdf4;border-radius:8px;margin-bottom:6px;border:1px solid #bbf7d0;">
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;color:#0d5c2f;">${a.materia}</div>
            <div style="font-size:11px;color:#64748b;">
              ${a.grupo||'Todos los grupos'} ${a.ciclo ? '· '+a.ciclo : ''} ${a.turno ? '· '+a.turno : ''}
            </div>
          </div>
          <button onclick="ADM.quitarMateria('${docenteId}','${a.id}')"
            style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:16px;padding:2px 6px;"
            title="Quitar asignación" aria-label="Cerrar">✕</button>
        </div>`).join('')
    : '<div style="color:#94a3b8;font-size:13px;padding:8px 0;font-style:italic;">Sin materias asignadas — agrega la primera abajo</div>';

  const coberturaHtml = ADM._htmlPanelCoberturaEscolar(docenteId);

  ADM.abrirModal('adm-modal-materias',
    `📚 Asignaciones de ${docenteNombre}`,
    `<div id="adm-mat-asignadas" style="margin-bottom:16px;">${asignadasHtml}</div>
    ${coberturaHtml}
    <div style="border-top:1px solid #e5e7eb;padding-top:14px;">
      <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:10px;
        text-transform:uppercase;letter-spacing:.5px;">Agregar asignación</div>
      <div class="adm-form-row">
        <div class="adm-form-group">
          <label>${esSecundaria ? 'Campo Formativo / Asignatura' : 'Materia'}</label>
          <select id="adm-mat-sel" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;
            border-radius:8px;font-family:inherit;font-size:13px;outline:none;">
            <option value="">Seleccionar…</option>
            ${materiaOptsHtml}
          </select>
        </div>
        <div class="adm-form-group">
          <label>Grupo</label>
          <select id="adm-mat-grupo-sel" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;
            border-radius:8px;font-family:inherit;font-size:13px;outline:none;">
            <option value="">Todos los grupos</option>
            ${grupoOpts}
          </select>
        </div>
      </div>
      <div class="adm-form-row">
        <div class="adm-form-group">
          <label>Ciclo escolar</label>
          <select id="adm-mat-ciclo-sel" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;
            border-radius:8px;font-family:inherit;font-size:13px;outline:none;">
            ${cicloOpts}
          </select>
        </div>
        <div class="adm-form-group" id="adm-mat-nueva-wrap" style="display:none;">
          <label>Nombre de la materia</label>
          <input type="text" id="adm-mat-nueva" placeholder="Ej: Matemáticas"
            style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;
            font-family:inherit;font-size:13px;outline:none;">
        </div>
      </div>
    </div>`,
    `ADM.agregarMateria('${docenteId}')`
  );

  setTimeout(() => {
    const sel = document.getElementById('adm-mat-sel');
    if (sel) sel.onchange = () => {
      const wrap = document.getElementById('adm-mat-nueva-wrap');
      if (wrap) wrap.style.display = sel.value === '__nueva__' ? 'block' : 'none';
    };
  }, 100);
};

ADM._getAsignacionesDocente = function(docenteId) {
  // En demo retorna vacío, en producción viene de docente_grupos
  return window._admAsignaciones?.[docenteId] || [];
};

ADM.agregarMateria = async function(docenteId) {
  let materiaRaw = document.getElementById('adm-mat-sel')?.value;
  if (materiaRaw === '__nueva__') materiaRaw = document.getElementById('adm-mat-nueva')?.value.trim();
  const grupoId   = document.getElementById('adm-mat-grupo-sel')?.value || null;
  const ciclo     = document.getElementById('adm-mat-ciclo-sel')?.value || window.CICLO_ACTIVO;
  if (!materiaRaw) { ADM.toast('⚠️ Selecciona una materia', 'warn'); return; }

  // Para secundaria el formato es "CampoFormativo::Asignatura"
  // Guardamos la asignatura específica en materia y el campo en un campo separado
  const partes   = materiaRaw.split('::');
  const materia  = partes.length > 1 ? partes[1] : materiaRaw;
  const campoFormativo = partes.length > 1 ? partes[0] : null;

  // Turno del grupo seleccionado
  const grupoObj = ADM.grupos.find(g => g.id === grupoId);
  const turno    = grupoObj?.turno || null;
  const grupoNom = grupoObj?.nombre || 'Todos';

  try {
    if (window.sb) {
      const payload = {
        docente_id: docenteId,
        grupo_id:   grupoId || null,
        materia,
        ciclo,
        activo: true,
      };
      // Si la tabla tiene campo_formativo, agregarlo
      if (campoFormativo) payload.campo_formativo = campoFormativo;

      const { error } = await sb.from('docente_grupos')
        .upsert(payload, { onConflict: 'docente_id,grupo_id,materia,ciclo' });
      if (error) throw error;
    }

    // Actualizar caché local con id real para poder quitar después
    if (!window._admAsignaciones) window._admAsignaciones = {};
    if (!window._admAsignaciones[docenteId]) window._admAsignaciones[docenteId] = [];

    // Obtener id real de la fila recién insertada
    let realId = null;
    if (window.sb) {
      const { data: row } = await sb.from('docente_grupos')
        .select('id').eq('docente_id', docenteId).eq('materia', materia).eq('ciclo', ciclo)
        .eq('activo', true).maybeSingle();
      realId = row?.id || null;
    }

    window._admAsignaciones[docenteId].push({
      id:     realId || Date.now().toString(),
      materia: campoFormativo ? `${campoFormativo} — ${materia}` : materia,
      grupo:   grupoNom,
      grupo_id: grupoId,
      ciclo,
      turno,
    });

    ADM.toast(`✅ ${materia} asignada a ${grupoNom}`);
    ADM.cerrarModal();
    ADM.renderAsignaciones();
    // Reabrir para ver estado actualizado
    setTimeout(() => {
      const d = ADM.docentes.find(x => x.id === docenteId);
      if (d) ADM.abrirAsignarMaterias(docenteId, ((d.nombre||'') + ' ' + (d.apellido||d.apellido_p||'')).trim());
    }, 300);
  } catch(e) { ADM.toast('❌ ' + e.message, 'err'); }
};

ADM.quitarMateria = async function(docenteId, asignId) {
  try {
    if (window.sb && !asignId.includes('demo')) {
      await sb.from('docente_grupos').update({ activo: false }).eq('id', asignId);
    }
    if (window._admAsignaciones?.[docenteId]) {
      window._admAsignaciones[docenteId] = window._admAsignaciones[docenteId].filter(a => a.id !== asignId);
    }
    ADM.toast('✅ Materia removida');
    ADM.cerrarModal();
  } catch(e) { ADM.toast('❌ ' + e.message, 'err'); }
};

ADM.desactivarPersonal = async function(id, nombre) {
  if (!confirm(`¿Desactivar la cuenta de ${nombre}? Podrá reactivarse después.`)) return;
  try {
    if (window.sb) await sb.from('usuarios').update({ activo: false }).eq('id', id);
    ADM.docentes = ADM.docentes.filter(d => d.id !== id);
    ADM.renderDocentes();
    ADM.renderDashboard();
    ADM.toast(`✅ ${nombre} desactivado`);
  } catch(e) { ADM.toast('❌ ' + e.message, 'err'); }
};

// ═══════════════════════════════════════════════════════
// ALUMNOS
// ═══════════════════════════════════════════════════════

ADM.renderAlumnos = function(filtro = '') {
  const el = document.getElementById('adm-alumnos-list');
  if (!el) return;
  const lista = filtro
    ? ADM.alumnos.filter(a => {
        const nom = `${a.nombre||''} ${a.apellido_p||a.apellido||''} ${a.apellido_m||''}`.toLowerCase();
        return nom.includes(filtro.toLowerCase());
      })
    : ADM.alumnos;
  if (!lista.length) {
    el.innerHTML = `<div class="adm-empty" style="padding:48px 20px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">👨‍🎓</div>
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:6px;">Sin alumnos registrados</div>
      <div style="font-size:13px;color:#94a3b8;margin-bottom:16px;">Agrega alumnos uno a uno o importa una lista desde CSV</div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button onclick="ADM.abrirModalAlumno()" style="padding:10px 20px;background:linear-gradient(135deg,#0d5c2f,#157a40);color:white;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;">+ Alta de alumno</button>
        <button onclick="ADM.cargarAlumnos().then(()=>ADM.renderAlumnos())" style="padding:10px 20px;background:#eff6ff;border:1.5px solid #bfdbfe;color:#1e40af;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;">🔄 Recargar padrón</button>
        <button onclick="ADM.navTo('importar')" style="padding:10px 20px;background:#f0fdf4;border:1.5px solid #86efac;color:#166534;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;">⬆️ Importar CSV</button>
      </div>
    </div>`; return;
  }
  el.innerHTML = `
  <table class="adm-tabla">
    <thead><tr>
      <th>#</th><th>Nombre</th><th>Grupo</th><th>CURP</th><th>Código QR</th><th>Acciones</th>
    </tr></thead>
    <tbody>
    ${lista.map((a, i) => {
      const nombre = `${a.nombre||''} ${a.apellido_p||a.apellido||''} ${a.apellido_m||''}`.trim().replace(/\s+/g,' ');
      // grupo_id can come from alumnos_grupos (DB) or direct grupo_id (local)
      const grupoNom = a.alumnos_grupos?.[0]?.grupos?.nombre
        || (a.grupo_id ? (ADM.grupos.find(g=>g.id===a.grupo_id)?.nombre||null) : null);
      const grupoBadge = grupoNom
        ? `<span class="adm-badge adm-badge-blue">${grupoNom}</span>`
        : `<span class="adm-badge" style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;cursor:pointer;" onclick="ADM.asignarGrupoAlumno('${a.id}','${nombre}')" title="Sin grupo — click para asignar">Sin grupo</span>`;
      return `<tr>
        <td style="color:#94a3b8;font-size:12px;">${i+1}</td>
        <td style="font-weight:600;">${nombre}</td>
        <td>${grupoBadge}</td>
        <td style="font-family:monospace;font-size:11px;color:#64748b;">${a.curp||'—'}</td>
        <td>
          ${a.codigo_vinculacion
            ? `<span style="font-family:monospace;font-size:12px;font-weight:700;color:#0d5c2f;background:#dcfce7;padding:2px 8px;border-radius:6px;">${a.codigo_vinculacion}</span>`
            : `<button class="adm-btn-sm" onclick="ADM.generarCodigoAlumno('${a.id}','${nombre}')">🔑 Generar</button>`
          }
        </td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="adm-btn-sm" onclick="ADM.abrirEditarAlumno('${a.id}')" aria-label="Editar">✏️</button>
            <button class="adm-btn-sm" onclick="ADM.asignarGrupoAlumno('${a.id}','${nombre}')">🏫 Grupo</button>
            <button class="adm-btn-sm" onclick="ADM.imprimirQR('${a.id}','${nombre}','${a.codigo_vinculacion||''}')">🖨️ QR</button>
            <button class="adm-btn-sm adm-btn-danger" onclick="ADM.desactivarAlumno('${a.id}','${nombre}')" aria-label="Cerrar">✕</button>
          </div>
        </td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
};

ADM.abrirModalAlumno = function() {
  const grupoPre = window._admGrupoAltaPreseleccionado || '';
  ADM.abrirModal('adm-modal-alumno',
    '👨‍🎓 Alta de alumno',
    `<div class="adm-form-row">
      <div class="adm-form-group">
        <label>Nombre(s) <span style="color:#e11d48">*</span></label>
        <input type="text" id="adm-a-nombre" placeholder="Ana">
      </div>
      <div class="adm-form-group">
        <label>Apellidos <span style="color:#e11d48">*</span></label>
        <input type="text" id="adm-a-apellido" placeholder="Apellido(s)">
      </div>
    </div>
    <div class="adm-form-row">
      <div class="adm-form-group">
        <label>CURP</label>
        <input type="text" id="adm-a-curp" placeholder="GARL100305MNLRPN07" maxlength="18" oninput="this.value=this.value.toUpperCase()" style="text-transform:uppercase">
      </div>
      <div class="adm-form-group">
        <label>Fecha de nacimiento</label>
        <input type="date" id="adm-a-nacimiento">
      </div>
    </div>
    <div class="adm-form-row">
      <div class="adm-form-group">
        <label>Grupo</label>
        <select id="adm-a-grupo">
          <option value="">Sin grupo por ahora</option>
          ${ADM.grupos.map(g => `<option value="${g.id}" ${String(g.id)===String(grupoPre)?'selected':''}>${g.nombre||g.grado+'°'+(g.seccion||'')}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:4px;">
      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">📧 Acceso al portal del alumno (opcional)</div>
      <div class="adm-form-group">
        <label>Correo del alumno</label>
        <input type="email" id="adm-a-email" placeholder="alumno@correo.com" style="width:100%">
        <div style="font-size:11px;color:#64748b;margin-top:3px;">Si se proporciona, se enviará invitación para acceder al portal.</div>
      </div>
    </div>
    <div style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:4px;">
      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">👨‍👩‍👧 Datos del padre/tutor (para vinculación a la app)</div>
      <div class="adm-form-row">
        <div class="adm-form-group">
          <label>Nombre del tutor/a</label>
          <input type="text" id="adm-a-tutor" placeholder="Nombre completo">
        </div>
        <div class="adm-form-group">
          <label>Teléfono del tutor</label>
          <input type="tel" id="adm-a-tel" placeholder="+52 81…">
        </div>
      </div>
      <div class="adm-form-group">
        <label>Correo del tutor/padre</label>
        <input type="email" id="adm-a-email-padre" placeholder="padre@correo.com" style="width:100%">
        <div style="font-size:11px;color:#64748b;margin-top:3px;">Se enviará invitación para acceder al portal de familias.</div>
      </div>
    </div>`,
    'ADM.guardarAlumno()'
  );
  window._admGrupoAltaPreseleccionado = '';
};

ADM.guardarAlumno = async function() {
  const sbRef      = window.sb || ADM.sb;
  const nombre     = document.getElementById('adm-a-nombre')?.value.trim() || '';
  const apellido   = document.getElementById('adm-a-apellido')?.value.trim() || '';
  const curp       = document.getElementById('adm-a-curp')?.value.trim().toUpperCase() || '';
  const fechaNac   = document.getElementById('adm-a-nacimiento')?.value || null;
  const grupoId    = document.getElementById('adm-a-grupo')?.value || null;
  const numLista   = null; // orden alfabético por apellido — sin número de lista manual
  const tutor      = document.getElementById('adm-a-tutor')?.value.trim() || '';
  const telefono   = document.getElementById('adm-a-tel')?.value.trim() || '';
  const emailAlumno= document.getElementById('adm-a-email')?.value.trim().toLowerCase() || '';
  const emailPadre = document.getElementById('adm-a-email-padre')?.value.trim().toLowerCase() || '';

  if (!nombre)   { ADM.toast('⚠️ El nombre es obligatorio', 'warn'); return; }
  if (!apellido) { ADM.toast('⚠️ Los apellidos son obligatorios', 'warn'); return; }

  const escuelaCct = ADM.escuelaCct || window.currentPerfil?.escuela_cct || null;
  const escuelaId  = ADM.escuelaId  || window.currentPerfil?.escuela_id  || null;

  if (!escuelaCct && !escuelaId) {
    ADM.toast('⚠️ No se detectó la escuela. Recarga la página.', 'warn'); return;
  }

  const apellido_p = apellido.split(' ')[0] || '';
  const apellido_m = apellido.split(' ').slice(1).join(' ') || '';
  const codigo     = ADM._generarCodigoCorto();
  const escuelaNom = ADM.escuelaNombre || escuelaCct || 'SIEMBRA';

  const payload = {
    nombre,
    apellido_p,
    apellido_m,
    curp:            curp || null,
    fecha_nac:       fechaNac || null,
    num_lista:       numLista,
    telefono:        telefono || null,
    tutor_nombre:    tutor    || null,
    telefono_tutor:  telefono || null,
    email:           emailAlumno || null,
    rol:             'alumno',
    activo:          true,
    codigo_vinculacion: codigo,
    escuela_id:      escuelaId  || null,
    escuela_cct:     escuelaCct || null,
  };

  try {
    let alumnoId = null;
    let alumnoData = null;

    if (sbRef) {
      // ── PASO 1: Insertar alumno en usuarios ──
      const { data: inserted, error: insertErr } = await sbRef.from('usuarios')
        .insert(payload).select().single();

      if (insertErr) {
        // Duplicado: buscar el existente y actualizarlo
        if (insertErr.code === '23505') {
          let busca;
          if (emailAlumno) {
            ({ data: busca } = await sbRef.from('usuarios').select('*').eq('email', emailAlumno).maybeSingle());
          }
          if (!busca) {
            ({ data: busca } = await sbRef.from('usuarios').select('*')
              .eq('nombre', nombre).eq('apellido_p', apellido_p)
              .eq('escuela_cct', escuelaCct).maybeSingle());
          }
          if (busca) {
            alumnoId   = busca.id;
            alumnoData = busca;
            ADM.toast(`ℹ️ ${nombre} ya estaba registrado — actualizando`, 'ok');
            await sbRef.from('usuarios').update({
              apellido_p, apellido_m,
              curp: curp || busca.curp || null,
              tutor_nombre: tutor || null,
              telefono_tutor: telefono || null,
              escuela_id:  escuelaId  || busca.escuela_id  || null,
              escuela_cct: escuelaCct || busca.escuela_cct || null,
            }).eq('id', busca.id);
          } else {
            throw insertErr;
          }
        } else {
          throw insertErr;
        }
      } else {
        alumnoId   = inserted.id;
        alumnoData = inserted;
      }

      // ── PASO 2: Asignar al grupo ──
      if (grupoId && alumnoId) {
        const { error: agErr } = await sbRef.from('alumnos_grupos').upsert({
          alumno_id:     alumnoId,
          grupo_id:      grupoId,
          ciclo_escolar: window.CICLO_ACTIVO || '2025-2026',
          ciclo:         window.CICLO_ACTIVO || '2025-2026',
          activo:        true,
        }, { onConflict: 'alumno_id,grupo_id,ciclo_escolar' });
        if (agErr) console.warn('[ADM] alumnos_grupos:', agErr.message);
      }

      // ── PASO 3: Crear perfil XP ──
      if (alumnoId) {
        try {
          await sbRef.from('perfil_alumno')
            .upsert({ alumno_id: alumnoId, xp_total: 0, racha_dias: 0, nivel: 1 },
              { onConflict: 'alumno_id' });
        } catch(e) { console.warn('[ADM] perfil_alumno:', e.message); }
      }

      // ── PASO 4: Código de vinculación para padre ──
      if (alumnoId) {
        try {
          await sbRef.from('vinculos_padre').insert({
            codigo,
            alumno_id:      alumnoId,
            escuela_id:     escuelaId || null,
            usado:          false,
            nombre_tutor:   tutor    || null,
            telefono_tutor: telefono || null,
            expira_at:      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          });
        } catch(e) { console.warn('[ADM] vinculos_padre:', e.message); }
      }

      // ── PASO 5: Recargar alumno con grupos para mostrar en lista ──
      if (alumnoId) {
        const { data: alumnoFull } = await sbRef.from('usuarios')
          .select('*, alumnos_grupos(grupo_id, grupos(nombre,grado))')
          .eq('id', alumnoId).maybeSingle();
        if (alumnoFull) alumnoData = alumnoFull;
      }

      // ── PASO 6: Invitaciones (alumno + padre) ──
const supabaseUrl = window.sb?.supabaseUrl || 'https://mgmkzxtljkyoxqeytbjv.supabase.co';
      const { data: { session } } = await sbRef.auth.getSession();
      const jwt = session?.access_token;
      const expira7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      let linkAlumno = null, linkPadre = null;
      let emailAlumnoEnviado = false, emailPadreEnviado = false;

      // 6a. Invitación alumno
      if (emailAlumno && alumnoId) {
        const tokenAlumno = ADM._generarToken();
        linkAlumno = `${location.origin}/alumno.html?invite=${tokenAlumno}`;
        try {
          await sbRef.from('invitaciones').insert({
            token:          tokenAlumno,
            escuela_id:     escuelaId  || null,
            escuela_cct:    escuelaCct || null,
            rol:            'alumno',
            email_destino:  emailAlumno,
            nombre_destino: `${nombre} ${apellido}`.trim(),
            estado:         'pendiente',
            expira_at:      expira7d,
            creado_por:     window.currentUser?.id || null,
          });
        } catch(e) { console.warn('[ADM] inv alumno:', e.message); }

        if (jwt) {
          try {
            const r = await fetch(`${supabaseUrl}/functions/v1/invite-user`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
              body: JSON.stringify({ email: emailAlumno, rol: 'alumno',
                escuela_nombre: escuelaNom, invited_by: window.currentPerfil?.nombre || 'Admin',
                token: tokenAlumno, link: linkAlumno }),
            });
            const rd = await r.json().catch(() => ({}));
            if (rd.email_enviado || r.ok) emailAlumnoEnviado = true;
          } catch(e2) { console.warn('[ADM] email alumno:', e2.message); }
        }
      }

      // 6b. Invitación padre/tutor
      if (emailPadre) {
        const tokenPadre = ADM._generarToken();
        linkPadre = `${location.origin}/padres.html?invite=${tokenPadre}`;
        try {
          await sbRef.from('invitaciones').insert({
            token:          tokenPadre,
            escuela_id:     escuelaId  || null,
            escuela_cct:    escuelaCct || null,
            rol:            'padre',
            email_destino:  emailPadre,
            nombre_destino: tutor || emailPadre,
            estado:         'pendiente',
            expira_at:      expira7d,
            creado_por:     window.currentUser?.id || null,
            alumno_id:      alumnoId   || null,
          });
          // Si el padre ya tiene cuenta, crear vínculo inmediatamente
          if (alumnoId) {
            try {
              const { data: padreUsuario } = await sbRef.from('usuarios')
                .select('id').eq('email', emailPadre.toLowerCase().trim()).maybeSingle();
              if (padreUsuario?.id) {
                const { data: yaExiste } = await sbRef.from('padres_alumnos')
                  .select('id').eq('padre_id', padreUsuario.id).eq('alumno_id', alumnoId).maybeSingle();
                if (!yaExiste) {
                  await sbRef.from('padres_alumnos').insert({
                    padre_id:   padreUsuario.id,
                    alumno_id:  alumnoId,
                    escuela_id: escuelaId || null,
                    activo:     true,
                  });
                }
              }
            } catch(eLinkPadre) { console.warn('[ADM] auto-link padre:', eLinkPadre.message); }
          }
        } catch(e) { console.warn('[ADM] inv padre:', e.message); }

        if (jwt) {
          try {
            const r = await fetch(`${supabaseUrl}/functions/v1/invite-user`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
              body: JSON.stringify({ email: emailPadre, rol: 'padre',
                escuela_nombre: escuelaNom, invited_by: window.currentPerfil?.nombre || 'Admin',
                token: tokenPadre, link: linkPadre }),
            });
            const rd = await r.json().catch(() => ({}));
            if (rd.email_enviado || r.ok) emailPadreEnviado = true;
          } catch(e2) { console.warn('[ADM] email padre:', e2.message); }
        }
      }

      // ── PASO 7: Mostrar resultado ──
      if (alumnoData) {
        const idx = ADM.alumnos.findIndex(a => a.id === alumnoData.id);
        if (idx !== -1) ADM.alumnos[idx] = alumnoData;
        else ADM.alumnos.push(alumnoData);
      }

      window._siembraAlumnos = ADM.alumnos;
      window.dispatchEvent(new CustomEvent('siembra:datos-cargados', {
        detail: { alumnos: ADM.alumnos, grupos: ADM.grupos, docentes: ADM.docentes, materias: ADM.materias }
      }));
      ADM.renderAlumnos();
      ADM.renderDashboard();
      ADM.cerrarModal();

      // Mostrar modal de resultado con links y código
      setTimeout(() => {
        const invSections = [];
        if (emailAlumno) invSections.push(`
          <div style="background:${emailAlumnoEnviado?'#f0fdf4':'#fefce8'};border:1px solid ${emailAlumnoEnviado?'#bbf7d0':'#fde68a'};border-radius:8px;padding:10px 12px;margin-bottom:8px;">
            <div style="font-size:11px;font-weight:700;color:${emailAlumnoEnviado?'#166534':'#92400e'};">
              ${emailAlumnoEnviado?'✅':'⚠️'} Email alumno — ${emailAlumno}
            </div>
            ${linkAlumno?`<div style="font-family:monospace;font-size:10px;color:#475569;margin-top:4px;word-break:break-all;cursor:pointer;" onclick="navigator.clipboard.writeText('${linkAlumno}');ADM.toast('✅ Link copiado')">${linkAlumno}</div>`:''}
          </div>`);
        if (emailPadre) invSections.push(`
          <div style="background:${emailPadreEnviado?'#f0fdf4':'#fefce8'};border:1px solid ${emailPadreEnviado?'#bbf7d0':'#fde68a'};border-radius:8px;padding:10px 12px;margin-bottom:8px;">
            <div style="font-size:11px;font-weight:700;color:${emailPadreEnviado?'#166534':'#92400e'};">
              ${emailPadreEnviado?'✅':'⚠️'} Email padre/tutor — ${emailPadre}
            </div>
            ${linkPadre?`<div style="font-family:monospace;font-size:10px;color:#475569;margin-top:4px;word-break:break-all;cursor:pointer;" onclick="navigator.clipboard.writeText('${linkPadre}');ADM.toast('✅ Link copiado')">${linkPadre}</div>`:''}
          </div>`);

        ADM.abrirModal('adm-modal-token',
          `✅ ${nombre} ${apellido} dado de alta`,
          `<div style="padding:8px 0;">
            <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:14px;margin-bottom:14px;text-align:center;">
              <div style="font-size:11px;color:#166534;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Código de vinculación (familia)</div>
              <div style="font-family:monospace;font-size:22px;font-weight:900;color:#0d5c2f;letter-spacing:3px;cursor:pointer;" onclick="navigator.clipboard.writeText('${codigo}');ADM.toast('✅ Código copiado')">${codigo}</div>
              <div style="font-size:11px;color:#64748b;margin-top:4px;">El padre/tutor usa este código para vincularse en la app</div>
            </div>
            ${invSections.join('')}
            ${!emailAlumno && !emailPadre ? '<div style="font-size:12px;color:#64748b;text-align:center;margin-bottom:10px;">No se especificaron correos — comparte el código de vinculación manualmente.</div>' : ''}
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
              <button onclick="navigator.clipboard.writeText('${codigo}');ADM.toast('✅ Código copiado')"
                style="padding:8px 16px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">📋 Copiar código</button>
              <button onclick="window.open('https://wa.me/?text='+encodeURIComponent('🌱 SIEMBRA — Código de vinculación de tu hijo/a ${nombre}: *${codigo}*\\nDescarga la app e ingresa este código para ver su progreso escolar.'),'_blank')"
                style="padding:8px 16px;background:#25d366;color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">💬 WhatsApp</button>
            </div>
          </div>`,
          null, 'Cerrar'
        );
      }, 300);

    } else {
      // Sin Supabase — guardar localmente
      const grupoObj = grupoId ? ADM.grupos.find(g => g.id === grupoId) : null;
      const demo = { id: 'demo-' + Date.now(), ...payload,
        alumnos_grupos: grupoObj ? [{ grupo_id: grupoId, grupos: grupoObj }] : [] };
      ADM.alumnos.push(demo);
      window._siembraAlumnos = ADM.alumnos;
      ADM.renderAlumnos();
      ADM.renderDashboard();
      ADM.cerrarModal();
      ADM.toast(`✅ ${nombre} dado de alta · Código: ${codigo}`);
    }
  } catch(e) {
    console.error('[ADM] guardarAlumno:', e);
    ADM.toast('❌ ' + e.message, 'err');
  }
};

ADM.asignarGrupoAlumno = function(alumnoId, nombre) {
  ADM.abrirModal('adm-modal-asignar-grupo',
    `Asignar grupo — ${nombre}`,
    `<div class="adm-form-group">
      <label>Grupo</label>
      <select id="adm-ag-sel">
        <option value="">Sin grupo</option>
        ${ADM.grupos.map(g => `<option value="${g.id}">${g.nombre||g.grado+'°'}</option>`).join('')}
      </select>
    </div>`,
    `ADM.guardarAsignacionGrupo('${alumnoId}')`
  );
};

ADM.guardarAsignacionGrupo = async function(alumnoId) {
  const grupoId = document.getElementById('adm-ag-sel').value;
  if (!grupoId) { ADM.toast('⚠️ Selecciona un grupo', 'warn'); return; }
  try {
    if (window.sb) {
      // Desactivar asignaciones anteriores
      await sb.from('alumnos_grupos')
        .update({ activo: false })
        .eq('alumno_id', alumnoId)
        .eq('ciclo', window.CICLO_ACTIVO);
      // Nueva asignación
      await sb.from('alumnos_grupos').insert({
        alumno_id: alumnoId, grupo_id: grupoId,
        ciclo: window.CICLO_ACTIVO, activo: true,
      });
      await ADM.cargarAlumnos();
    }
    ADM.renderAlumnos();
    ADM.cerrarModal();
    ADM.toast('✅ Grupo asignado');
  } catch(e) { ADM.toast('❌ ' + e.message, 'err'); }
};

ADM.generarCodigoAlumno = async function(alumnoId, nombre) {
  const codigo = ADM._generarCodigoCorto();
  try {
    if (window.sb) {
      await sb.from('usuarios').update({ codigo_vinculacion: codigo }).eq('id', alumnoId);
      await sb.from('vinculos_padre').insert({
        codigo, alumno_id: alumnoId,
        escuela_id: ADM.escuelaId || window.currentPerfil?.escuela_id || null,
        usado: false,
        expira_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    const alumno = ADM.alumnos.find(a => a.id === alumnoId);
    if (alumno) alumno.codigo_vinculacion = codigo;
    ADM.renderAlumnos();
    ADM.toast(`✅ Código ${codigo} generado para ${nombre}`);
  } catch(e) { ADM.toast('❌ ' + e.message, 'err'); }
};

ADM.imprimirQR = function(alumnoId, nombre, codigo) {
  if (!codigo) { ADM.toast('⚠️ Genera primero el código de vinculación', 'warn'); return; }
  // Usar la función del hub si existe, si no abrir ventana directa
  if (typeof admGenerarVinculoPadre === 'function') {
    admGenerarVinculoPadre(alumnoId, nombre);
  } else {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>QR ${nombre}</title>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
    </head><body style="font-family:sans-serif;padding:40px;max-width:380px;margin:0 auto;text-align:center;">
    <h2 style="color:#0d5c2f;">SIEMBRA · Código de vinculación</h2>
    <p>Alumno/a: <strong>${nombre}</strong></p>
    <canvas id="qr" style="border-radius:12px;border:6px solid white;box-shadow:0 2px 16px rgba(0,0,0,.1);"></canvas>
    <div style="margin-top:16px;font-size:36px;font-weight:900;letter-spacing:8px;color:#0d5c2f;font-family:monospace;">${codigo}</div>
    <p style="font-size:12px;color:#94a3b8;margin-top:8px;">Muestra este código al padre/madre en la app SIEMBRA Familias</p>
    <script>QRCode.toCanvas(document.getElementById('qr'),'${codigo}',{width:200,color:{dark:'#0d5c2f',light:'#fff'}});setTimeout(()=>window.print(),800);<\/script>
    </body></html>`);
  }
};

ADM.abrirEditarAlumno = function(alumnoId) {
  const a = ADM.alumnos.find(x => x.id === alumnoId);
  if (!a) { ADM.toast('Alumno no encontrado', 'warn'); return; }
  const grupoActual = a.alumnos_grupos?.[0]?.grupo_id || '';
  ADM.abrirModal('adm-modal-alumno',
    'Editar alumno',
    `<div class="adm-form-row">
      <div class="adm-form-group">
        <label>Nombre(s)</label>
        <input type="text" id="adm-a-nombre" value="${a.nombre||''}" placeholder="Ana">
      </div>
      <div class="adm-form-group">
        <label>Apellido(s)</label>
        <input type="text" id="adm-a-apellido" value="${(a.apellido||a.apellido_p||'')+' '+(a.apellido_m||'')}" placeholder="Apellido(s)">
      </div>
    </div>
    <div class="adm-form-row">
      <div class="adm-form-group">
        <label>CURP</label>
        <input type="text" id="adm-a-curp" value="${a.curp||''}" placeholder="GARL100305MNLRPN07" maxlength="18" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()">
      </div>
      <div class="adm-form-group">
        <label>Fecha de nacimiento</label>
        <input type="date" id="adm-a-nacimiento" value="${a.fecha_nacimiento||''}">
      </div>
    </div>
    <div class="adm-form-group">
      <label>Grupo</label>
      <select id="adm-a-grupo">
        <option value="">Sin grupo</option>
        ${ADM.grupos.map(g => `<option value="${g.id}" ${g.id===grupoActual?'selected':''}>${g.nombre||g.grado+'°'}</option>`).join('')}
      </select>
    </div>
    <div class="adm-form-row">
      <div class="adm-form-group">
        <label>Tutor / Padre de familia</label>
        <input type="text" id="adm-a-tutor" value="${a.tutor_nombre||''}" placeholder="Nombre completo">
      </div>
      <div class="adm-form-group">
        <label>Teléfono contacto</label>
        <input type="tel" id="adm-a-tel" value="${a.telefono_tutor||''}" placeholder="+52 81…">
      </div>
    </div>`,
    `ADM.guardarEdicionAlumno('${alumnoId}')`
  );
};

ADM.guardarEdicionAlumno = async function(alumnoId) {
  const nombre   = document.getElementById('adm-a-nombre')?.value.trim();
  const apellido = document.getElementById('adm-a-apellido')?.value.trim();
  const curp     = document.getElementById('adm-a-curp')?.value.trim().toUpperCase();
  const nac      = document.getElementById('adm-a-nacimiento')?.value || null;
  const grupoId  = document.getElementById('adm-a-grupo')?.value || null;
  const tutor    = document.getElementById('adm-a-tutor')?.value.trim() || null;
  const tel      = document.getElementById('adm-a-tel')?.value.trim() || null;
  if (!nombre) { ADM.toast('⚠️ Ingresa el nombre', 'warn'); return; }
  try {
    const updates = {
      nombre, apellido_p: apellido?.split(' ')[0]||'', apellido_m: apellido?.split(' ')[1]||'',
      curp: curp||null, fecha_nacimiento: nac,
      tutor_nombre: tutor, telefono_tutor: tel,
    };
    if (window.sb) {
      await sb.from('usuarios').update(updates).eq('id', alumnoId);
      if (grupoId) {
        await sb.from('alumnos_grupos').upsert({ alumno_id: alumnoId, grupo_id: grupoId }, { onConflict: 'alumno_id' });
      }
    }
    const idx = ADM.alumnos.findIndex(x => x.id === alumnoId);
    if (idx !== -1) Object.assign(ADM.alumnos[idx], updates);
    ADM.renderAlumnos();
    ADM.cerrarModal();
    ADM.toast('✅ Alumno actualizado');
  } catch(e) { ADM.toast('❌ ' + e.message, 'err'); }
};

ADM.imprimirQRGrupo = function() {
  const grupoId = document.getElementById('adm-qr-grupo-sel')?.value;
  const lista   = document.getElementById('adm-qr-lista');
  if (!grupoId || !lista) { ADM.toast('⚠️ Selecciona un grupo primero', 'warn'); return; }
  const grupo    = ADM.grupos.find(g => g.id === grupoId);
  const alumnos  = ADM.alumnos.filter(a => a.alumnos_grupos?.some(ag => ag.grupo_id === grupoId));
  if (!alumnos.length) { ADM.toast('⚠️ Este grupo no tiene alumnos registrados', 'warn'); return; }
  lista.innerHTML = alumnos.map(a => {
    const cod  = a.codigo_vinculacion || '—';
    const nom  = (a.nombre + ' ' + (a.apellido||a.apellido_p||'')).trim();
    const ini  = nom.split(' ').map(p=>p[0]||'').join('').toUpperCase().slice(0,2);
    return `
    <div style="background:white;border-radius:14px;border:1.5px solid #e2e8f0;padding:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.06);">
      <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0d5c2f,#22c55e);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;margin:0 auto 8px;">${ini}</div>
      <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:4px;">${nom}</div>
      <div style="background:#f0fdf4;border-radius:8px;padding:4px 8px;font-family:monospace;font-size:13px;font-weight:800;color:#0d5c2f;">${cod}</div>
      ${cod !== '—' ? `<button onclick="ADM.imprimirQR('${a.id}','${nom}','${cod}')" class="adm-btn-sm" style="margin-top:8px;width:100%;">🖨️ Imprimir</button>` : `<button onclick="ADM.generarCodigoAlumno('${a.id}','${nom}')" class="adm-btn-sm" style="margin-top:8px;width:100%;background:#f0fdf4;border-color:#86efac;color:#166534;">🔑 Generar código</button>`}
    </div>`;
  }).join('');
  ADM.toast(`✅ ${grupo?.nombre||'Grupo'} — ${alumnos.length} alumnos mostrados`, 'ok');
};


ADM.desactivarAlumno = async function(id, nombre) {
  if (!confirm(`¿Desactivar a ${nombre}? Sus datos se conservan.`)) return;
  try {
    if (window.sb) await sb.from('usuarios').update({ activo: false }).eq('id', id);
    ADM.alumnos = ADM.alumnos.filter(a => a.id !== id);
    ADM.renderAlumnos();
    ADM.renderDashboard();
    ADM.toast(`✅ ${nombre} desactivado`);
  } catch(e) { ADM.toast('❌ ' + e.message, 'err'); }
};

// ═══════════════════════════════════════════════════════
// IMPORTAR CSV
// ═══════════════════════════════════════════════════════

ADM.importarCSV = function() {
  const input = document.getElementById('adm-csv-input');
  if (!input?.files?.[0]) { ADM.toast('⚠️ Selecciona un archivo CSV', 'warn'); return; }
  const reader = new FileReader();
  reader.onload = async (e) => {
    const lines = e.target.result.split('\n').filter(l => l.trim());
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const iNombre   = header.indexOf('nombre');
    const iApellido = header.indexOf('apellido') > -1 ? header.indexOf('apellido') : header.indexOf('apellido_p');
    const iCurp     = header.indexOf('curp');
    const iGrupo    = header.indexOf('grupo');
    const iFechaNac = header.indexOf('fecha_nacimiento') > -1 ? header.indexOf('fecha_nacimiento') : -1;

    if (iNombre === -1) { ADM.toast('❌ El CSV debe tener columna "nombre"', 'err'); return; }

    const preview = document.getElementById('adm-csv-preview');
    if (preview) {
      const rows = lines.slice(1, 6).map(l => l.split(','));
      preview.innerHTML = `<div style="font-size:12px;color:#64748b;margin-bottom:8px;">${lines.length-1} alumnos encontrados · Primeros 5:</div>
        <table class="adm-tabla" style="font-size:11px;">
          <thead><tr>${header.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c.trim()}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>`;
    }

    window._csvParsed = lines.slice(1).map(line => {
      const cols = line.split(',');
      return {
        nombre:  cols[iNombre]?.trim() || '',
        apellido: iApellido > -1 ? cols[iApellido]?.trim() : '',
        curp:    iCurp > -1 ? cols[iCurp]?.trim().toUpperCase() : '',
        grupo:   iGrupo > -1 ? cols[iGrupo]?.trim() : '',
        fecha_nac: iFechaNac > -1 ? cols[iFechaNac]?.trim() : '',
      };
    }).filter(r => r.nombre);

    ADM.toast(`✅ ${window._csvParsed.length} alumnos listos para importar`);
    const btnImportar = document.getElementById('adm-btn-importar-csv');
    if (btnImportar) btnImportar.style.display = 'block';
  };
  reader.readAsText(input.files[0]);
};

ADM.confirmarImportarCSV = async function() {
  const registros = window._csvParsed;
  if (!registros?.length) { ADM.toast('⚠️ Carga primero el CSV', 'warn'); return; }
  const btn = document.getElementById('adm-btn-importar-csv');
  if (btn) { btn.disabled = true; btn.textContent = 'Importando…'; }
  let ok = 0, err = 0;
  for (const r of registros) {
    const codigo   = ADM._generarCodigoCorto();
    const escuelaCct = window.currentPerfil?.escuela_cct || null;
    const escuelaId = window.currentPerfil?.escuela_id || null;
    const payload = {
      nombre: r.nombre, apellido: r.apellido, curp: r.curp || null,
      fecha_nac: r.fecha_nac || null, rol: 'alumno', activo: true,
      codigo_vinculacion: codigo,
      escuela_id:  escuelaId,
      escuela_cct: escuelaCct,
    };
    try {
      if (window.sb && window.currentPerfil?.escuela_cct) {
        const { data, error } = await sb.from('usuarios').insert(payload).select().single();
        if (error) throw error;
        // Buscar grupo por nombre
        if (r.grupo) {
          const grupo = ADM.grupos.find(g =>
            (g.nombre||'').toLowerCase().includes(r.grupo.toLowerCase()) ||
            g.grado?.toString() === r.grupo.replace(/[°\s]/g,'')
          );
          if (grupo) {
            await sb.from('alumnos_grupos').insert({
              alumno_id: data.id, grupo_id: grupo.id,
              ciclo: window.CICLO_ACTIVO, activo: true,
            }).catch(() => {});
          }
        }
        ADM.alumnos.push(data);
      } else {
        ADM.alumnos.push({ id: 'demo-' + Date.now(), ...payload });
      }
      ok++;
    } catch(e) { err++; }
  }
  await ADM.cargarAlumnos();
  ADM.renderAlumnos();
  ADM.renderDashboard();
  if (btn) { btn.disabled = false; btn.textContent = '✅ Importar alumnos'; }
  ADM.toast(`✅ ${ok} alumnos importados${err > 0 ? ` · ${err} errores` : ''}`);
  window._csvParsed = null;
};

// ═══════════════════════════════════════════════════════
// MATERIAS CATÁLOGO
// ═══════════════════════════════════════════════════════


function admAsigTab(tab) {
  const isCatalogo = tab === 'catalogo';
  document.getElementById('adm-asig-panel-catalogo').style.display = isCatalogo ? '' : 'none';
  document.getElementById('adm-asig-panel-asig').style.display     = isCatalogo ? 'none' : '';
  const btnCat  = document.getElementById('adm-asig-tab-catalogo');
  const btnAsig = document.getElementById('adm-asig-tab-asig');
  if (btnCat) {
    btnCat.style.color       = isCatalogo ? '#0d5c2f' : '#64748b';
    btnCat.style.borderBottom= isCatalogo ? '2px solid #0d5c2f' : '2px solid transparent';
    btnCat.style.fontWeight  = isCatalogo ? '700' : '600';
  }
  if (btnAsig) {
    btnAsig.style.color       = isCatalogo ? '#64748b' : '#0d5c2f';
    btnAsig.style.borderBottom= isCatalogo ? '2px solid transparent' : '2px solid #0d5c2f';
    btnAsig.style.fontWeight  = isCatalogo ? '600' : '700';
  }
}
ADM.renderMaterias = function() {
  const el = document.getElementById('adm-materias-cat-list');
  if (!el) return;

  const nivelEsc = ADM.escuelaNivel || window._admNivelActivo || window._nivelActivo || 'secundaria';

  // ── Construir mapa de cobertura desde _admAsignaciones (fuente real) ──
  // grupoId → materia(norm) → [{ nomDoc, docenteId, asignId, materia }]
  const normM = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const asigns = ADM.asignacionesPorDocente || window._admAsignaciones || {};
  const cobPorGrupo = {};
  Object.entries(asigns).forEach(([docId, rows]) => {
    const doc = (ADM.docentes || []).find(d => d.id === docId);
    const nomDoc = doc ? ((doc.nombre||'') + ' ' + (doc.apellido||doc.apellido_p||'')).trim() : '—';
    (rows || []).forEach(a => {
      if (!a.grupo_id) return;
      const gid = a.grupo_id;
      if (!cobPorGrupo[gid]) cobPorGrupo[gid] = {};
      const key = normM(a.materia);
      if (!cobPorGrupo[gid][key]) cobPorGrupo[gid][key] = [];
      cobPorGrupo[gid][key].push({ nomDoc, docenteId: docId, asignId: a.id, materia: a.materia });
    });
  });


  // ── Estructura por año y campo formativo ──────────────────────
  const GRADOS_SEC = [
    { grado: '1', label: '1° Año', ciencias: 'Biología' },
    { grado: '2', label: '2° Año', ciencias: 'Física'   },
    { grado: '3', label: '3° Año', ciencias: 'Química'  },
  ];

  const CAMPOS_SEC_BASE = [
    {
      id: 'lenguajes', emoji: '📖', color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe',
      nombre: 'Lenguajes',
      materias: (ciencias) => ['Español','Inglés','Artes'],
      horas: { 'Español':5, 'Inglés':3, 'Artes':2 }
    },
    {
      id: 'saberes', emoji: '🔬', color: '#166534', bg: '#f0fdf4', border: '#86efac',
      nombre: 'Saberes y Pensamiento Científico',
      materias: (ciencias) => ['Matemáticas', ciencias, 'Tecnología'],
      horas: { 'Matemáticas':5, 'Biología':3, 'Física':3, 'Química':3, 'Tecnología':2 }
    },
    {
      id: 'etica', emoji: '🌍', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe',
      nombre: 'Ética, Naturaleza y Sociedades',
      materias: (ciencias, grado) => grado === '1'
        ? ['Historia','Geografía','Formación Cívica y Ética']
        : ['Historia','Formación Cívica y Ética'],
      horas: { 'Historia':2, 'Geografía':2, 'Formación Cívica y Ética':2 }
    },
    {
      id: 'humano', emoji: '🤝', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa',
      nombre: 'De lo Humano y lo Comunitario',
      materias: (ciencias) => ['Educación Física','Tutoría'],
      horas: { 'Educación Física':2, 'Tutoría':1 }
    },
  ];

  const GRADOS_PRI = [
    { grado: '1', label: '1° Grado' },
    { grado: '2', label: '2° Grado' },
    { grado: '3', label: '3° Grado' },
    { grado: '4', label: '4° Grado' },
    { grado: '5', label: '5° Grado' },
    { grado: '6', label: '6° Grado' },
  ];

  const CAMPOS_PRI_BASE = [
    {
      id: 'lenguajes', emoji: '📖', color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe',
      nombre: 'Lenguajes',
      materias: () => ['Lengua Materna (Español)','Segunda Lengua (Inglés)','Educación Artística'],
      horas: { 'Lengua Materna (Español)':9, 'Segunda Lengua (Inglés)':2, 'Educación Artística':1 }
    },
    {
      id: 'saberes', emoji: '🔬', color: '#166534', bg: '#f0fdf4', border: '#86efac',
      nombre: 'Saberes y Pensamiento Científico',
      materias: () => ['Matemáticas','Ciencias Naturales y Tecnología'],
      horas: { 'Matemáticas':6, 'Ciencias Naturales y Tecnología':3 }
    },
    {
      id: 'etica', emoji: '🌍', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe',
      nombre: 'Ética, Naturaleza y Sociedades',
      materias: () => ['Historia','Geografía','Formación Cívica y Ética'],
      horas: { 'Historia':2, 'Geografía':2, 'Formación Cívica y Ética':1 }
    },
    {
      id: 'humano', emoji: '🤝', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa',
      nombre: 'De lo Humano y lo Comunitario',
      materias: () => ['Educación Física','Vida Saludable','Proyecto de Aula','Tutoría y Participación Social'],
      horas: { 'Educación Física':2, 'Vida Saludable':1, 'Proyecto de Aula':3, 'Tutoría y Participación Social':1 }
    },
  ];

  const esSecundaria = nivelEsc === 'secundaria';
  const grados  = esSecundaria ? GRADOS_SEC : GRADOS_PRI;
  const campos  = esSecundaria ? CAMPOS_SEC_BASE : CAMPOS_PRI_BASE;

  // Obtener grupos reales por grado
  const gruposPorGrado = {};
  (ADM.grupos || []).forEach(g => {
    const gr = String(g.grado || '').replace(/[°\s]/g, '').trim();
    if (!gruposPorGrado[gr]) gruposPorGrado[gr] = [];
    gruposPorGrado[gr].push(g);
  });

  // ── Helper: contar materias cubiertas en un grupo usando cobPorGrupo ──
  const matCubiertaEnGrupo = (grupoId, mat) => !!(cobPorGrupo[grupoId]?.[normM(mat)]?.length);
  const docsDeMatEnGrupo   = (grupoId, mat) => cobPorGrupo[grupoId]?.[normM(mat)] || [];

  el.innerHTML = grados.map((gradoInfo, gi) => {
    const gruposDeEsteGrado = gruposPorGrado[gradoInfo.grado] || [];

    // Campos de este grado
    const camposDeGrado = campos.map(campo => ({
      ...campo,
      matsGrado: campo.materias(gradoInfo.ciencias || '', gradoInfo.grado),
    }));
    const totalMatsGrado = camposDeGrado.reduce((s, c) => s + c.matsGrado.length, 0);

    // Cobertura total del año (materias únicas cubiertas en ALGÚN grupo del grado)
    const matsCubiertasAnio = new Set();
    gruposDeEsteGrado.forEach(g => {
      camposDeGrado.forEach(campo => {
        campo.matsGrado.forEach(mat => {
          if (matCubiertaEnGrupo(g.id, mat)) matsCubiertasAnio.add(mat);
        });
      });
    });
    // Total esperado = materias × grupos (cada grupo debe tener cada materia cubierta)
    const totalEsperadoAnio = totalMatsGrado * Math.max(gruposDeEsteGrado.length, 1);
    let totalCubiertoAnio = 0;
    gruposDeEsteGrado.forEach(g => {
      camposDeGrado.forEach(campo => {
        campo.matsGrado.forEach(mat => {
          if (matCubiertaEnGrupo(g.id, mat)) totalCubiertoAnio++;
        });
      });
    });

    const sinGrupo   = gruposDeEsteGrado.length === 0;
    const todoCompleto = !sinGrupo && totalCubiertoAnio === totalEsperadoAnio && totalEsperadoAnio > 0;
    const faltanAnio = totalEsperadoAnio - totalCubiertoAnio;

    const borderColor = todoCompleto ? '#86efac' : sinGrupo ? '#e2e8f0' : '#fde68a';
    const bgHeader    = todoCompleto ? '#f0fdf4' : sinGrupo ? '#f8fafc' : '#fffbeb';
    const bgAvatar    = todoCompleto ? '#0d5c2f' : sinGrupo ? '#94a3b8' : '#b45309';

    // ── Bloques por grupo dentro del año ──────────────────────────────
    const gruposHtml = sinGrupo
      ? `<div style="padding:16px 20px;font-size:13px;color:#94a3b8;text-align:center;">
           Sin grupos creados para este año — <button onclick="ADM.abrirModalGrupo()" style="background:none;border:none;color:#0d5c2f;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px;">+ Crear grupo</button>
         </div>`
      : gruposDeEsteGrado.map((grupo, gri) => {
          const gid = grupo.id;
          const nomGrupo = grupo.nombre || (grupo.grado + '° ' + (grupo.seccion || ''));
          const turno    = grupo.turno ? ` · ${grupo.turno}` : '';

          // Cobertura de este grupo
          let cubGrupo = 0, totalGrupo = 0;
          camposDeGrado.forEach(campo => {
            campo.matsGrado.forEach(mat => {
              totalGrupo++;
              if (matCubiertaEnGrupo(gid, mat)) cubGrupo++;
            });
          });
          const pctGrupo = totalGrupo ? Math.round((cubGrupo / totalGrupo) * 100) : 0;
          const faltanGrupo = totalGrupo - cubGrupo;
          const grupoCompleto = cubGrupo === totalGrupo && totalGrupo > 0;
          const colGrupo = grupoCompleto ? '#16a34a' : faltanGrupo > totalGrupo * 0.5 ? '#dc2626' : '#d97706';

          const grupoKey = `g-${gi}-${gri}`;

          // Campos formativos dentro del grupo
          const camposHtml = camposDeGrado.map((campo, ci) => {
            let cubCampo = 0;
            campo.matsGrado.forEach(mat => { if (matCubiertaEnGrupo(gid, mat)) cubCampo++; });
            const campoKey = `c-${gi}-${gri}-${ci}`;

            const materiasHtml = campo.matsGrado.map(mat => {
              const docs    = docsDeMatEnGrupo(gid, mat);
              const tieneDoc = docs.length > 0;
              const _matDB   = (ADM.materias || []).find(m => m.nombre === mat);
              const horas    = (_matDB?.horas_semana) || campo.horas[mat] || 3;

              const docsChips = tieneDoc
                ? docs.map(d => `
                    <span style="display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;border:1px solid #86efac;color:#15803d;padding:2px 9px;border-radius:99px;font-size:10px;font-weight:600;margin:2px 2px 2px 0;">
                      👩‍🏫 ${d.nomDoc}
                    </span>`).join('')
                : `<span style="font-size:10px;color:#94a3b8;font-style:italic;">Sin docente asignado</span>`;

              return `
                <div style="padding:9px 20px 9px 56px;border-top:1px solid #f1f5f9;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                  <div style="width:7px;height:7px;border-radius:50%;background:${tieneDoc ? campo.color : '#e2e8f0'};flex-shrink:0;"></div>
                  <div style="min-width:150px;flex:1;">
                    <div style="font-size:12px;font-weight:700;color:#0f172a;">${mat}</div>
                    <div style="font-size:10px;color:#94a3b8;">${horas}h/semana</div>
                  </div>
                  <div style="flex:2;min-width:160px;">${docsChips}</div>
                  <button onclick="ADM.abrirAsignarMaterias && (() => { const d=ADM.docentes[0]; admPMTab('personal'); setTimeout(()=>ADM.abrirAsignarMaterias(d?.id||'','${(ADM.docentes[0]?.nombre||'Docente').replace(/'/g,"\\'")}'),100); })()"
                    style="padding:4px 10px;background:${tieneDoc?'#f8fafc':'#f0fdf4'};border:1.5px solid ${tieneDoc?'#e2e8f0':'#86efac'};color:${tieneDoc?'#475569':'#15803d'};border-radius:6px;font-family:'Sora',sans-serif;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;">
                    ${tieneDoc ? '✏️ Editar' : '+ Asignar'}
                  </button>
                </div>`;
            }).join('');

            return `
              <div style="border-top:1px solid #e2e8f0;">
                <div onclick="admToggleCampo('${campoKey}')"
                  style="background:${campo.bg};padding:10px 16px 10px 36px;display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;">
                  <span style="font-size:14px;">${campo.emoji}</span>
                  <div style="flex:1;">
                    <div style="font-size:11px;font-weight:700;color:${campo.color};">${campo.nombre}</div>
                    <div style="font-size:10px;color:#64748b;">${cubCampo}/${campo.matsGrado.length} materias con docente</div>
                  </div>
                  <span id="${campoKey}-arrow" style="font-size:13px;color:${campo.color};">▸</span>
                </div>
                <div id="${campoKey}" style="display:none;background:white;">${materiasHtml}</div>
              </div>`;
          }).join('');

          return `
            <div style="border-top:1px solid #e2e8f0;">
              <!-- Header grupo -->
              <div onclick="admToggleCampo('${grupoKey}')"
                style="background:white;padding:12px 20px 12px 28px;display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;transition:.15s;"
                onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <div style="width:32px;height:32px;border-radius:8px;background:${colGrupo};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:white;flex-shrink:0;">
                  ${grupo.seccion || grupo.grado}
                </div>
                <div style="flex:1;">
                  <div style="font-size:13px;font-weight:800;color:#0f172a;">${nomGrupo}${turno}</div>
                  <div style="display:flex;align-items:center;gap:8px;margin-top:3px;">
                    <div style="height:5px;width:80px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
                      <div style="width:${pctGrupo}%;height:100%;background:${colGrupo};border-radius:999px;"></div>
                    </div>
                    <span style="font-size:10px;color:${colGrupo};font-weight:700;">${cubGrupo}/${totalGrupo} materias</span>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  ${grupoCompleto
                    ? '<span style="background:#dcfce7;color:#15803d;font-size:9px;font-weight:700;padding:2px 8px;border-radius:99px;">✅ Completo</span>'
                    : `<span style="background:#fef3c7;color:#a16207;font-size:9px;font-weight:700;padding:2px 8px;border-radius:99px;">⚠️ Faltan ${faltanGrupo}</span>`
                  }
                  <span id="${grupoKey}-arrow" style="font-size:16px;color:#94a3b8;">▸</span>
                </div>
              </div>
              <!-- Campos del grupo (colapsables) -->
              <div id="${grupoKey}" style="display:none;background:#fafafa;">${camposHtml}</div>
            </div>`;
        }).join('');

    return `
    <div style="border:2px solid ${borderColor};border-radius:16px;overflow:hidden;margin-bottom:16px;">
      <!-- Header año -->
      <div onclick="admToggleCampo('anio-${gi}')"
        style="background:${bgHeader};padding:16px 20px;display:flex;align-items:center;gap:14px;cursor:pointer;user-select:none;">
        <div style="width:40px;height:40px;border-radius:10px;background:${bgAvatar};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:white;flex-shrink:0;">
          ${gradoInfo.grado}°
        </div>
        <div style="flex:1;">
          <div style="font-size:15px;font-weight:800;color:#0f172a;">${gradoInfo.label}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">
            ${sinGrupo
              ? '⚠️ Sin grupos creados para este año'
              : `${gruposDeEsteGrado.length} grupo${gruposDeEsteGrado.length>1?'s':''} · ${totalCubiertoAnio}/${totalEsperadoAnio} asignaciones cubiertas`}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${todoCompleto
            ? '<span style="background:#dcfce7;color:#15803d;font-size:10px;font-weight:700;padding:3px 10px;border-radius:99px;">✅ Completo</span>'
            : sinGrupo
              ? '<span style="background:#f1f5f9;color:#64748b;font-size:10px;font-weight:700;padding:3px 10px;border-radius:99px;">Sin grupos</span>'
              : `<span style="background:#fef9c3;color:#a16207;font-size:10px;font-weight:700;padding:3px 10px;border-radius:99px;">⚠️ Faltan ${faltanAnio}</span>`
          }
          <span id="anio-${gi}-arrow" style="font-size:18px;color:#64748b;transition:.2s;">▸</span>
        </div>
      </div>
      <!-- Grupos del año (colapsables) -->
      <div id="anio-${gi}" style="display:none;background:#fafafa;">
        ${gruposHtml}
      </div>
    </div>`;
  }).join('');
};

function admToggleCampo(id) {
  const el = document.getElementById(id);
  const arrow = document.getElementById(id + '-arrow');
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▸' : '▾';
}
window.admToggleCampo = admToggleCampo;

ADM.abrirModalMateria = function() {
  const nivelEsc = ADM.escuelaNivel || window._admNivelActivo || 'primaria';
  ADM.abrirModal('adm-modal-materia-cat',
    'Nueva materia',
    `<div class="adm-form-group">
      <label>Nombre de la materia</label>
      <input type="text" id="adm-mc-nombre" placeholder="Ej: Matemáticas">
    </div>
    <div class="adm-form-row">
      <div class="adm-form-group">
        <label>Nivel</label>
        <select id="adm-mc-nivel">
          <option value="primaria" ${nivelEsc==='primaria'?'selected':''}>Primaria</option>
          <option value="secundaria" ${nivelEsc==='secundaria'?'selected':''}>Secundaria</option>
          <option value="ambos">Ambos</option>
        </select>
      </div>
      <div class="adm-form-group">
        <label>Horas por semana</label>
        <input type="number" id="adm-mc-horas" value="5" min="1" max="30">
      </div>
    </div>`,
    'ADM.guardarMateria()'
  );
};

ADM.guardarMateria = async function() {
  const nombre = document.getElementById('adm-mc-nombre').value.trim();
  const nivel  = document.getElementById('adm-mc-nivel').value;
  const horas  = parseInt(document.getElementById('adm-mc-horas').value) || 5;
  if (!nombre) { ADM.toast('⚠️ El nombre es obligatorio', 'warn'); return; }
  try {
    if (window.sb) {
      const { data, error } = await sb.from('materias')
        .insert({ nombre, nivel, horas_semana: horas, activo: true })
        .select().single();
      if (error) throw error;
      ADM.materias.push(data);
    } else {
      ADM.materias.push({ id: 'demo-' + Date.now(), nombre, nivel, horas_semana: horas });
    }
    ADM.renderMaterias();
    ADM.popularSelects();
    ADM.cerrarModal();
    ADM.toast(`✅ Materia ${nombre} creada`);
  } catch(e) { ADM.toast('❌ ' + e.message, 'err'); }
};

ADM.eliminarMateria = async function(id, nombre) {
  if (!confirm(`¿Eliminar la materia ${nombre}?`)) return;
  try {
    if (window.sb) await sb.from('materias').update({ activo: false }).eq('id', id);
    ADM.materias = ADM.materias.filter(m => m.id !== id);
    ADM.renderMaterias();
    ADM.toast(`✅ Materia ${nombre} eliminada`);
  } catch(e) { ADM.toast('❌ ' + e.message, 'err'); }
};

// ═══════════════════════════════════════════════════════
// INVITACIONES
// ═══════════════════════════════════════════════════════

ADM.generarInvitacion = async function(userId, email, rol) {
  const token  = ADM._generarToken();
  const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const escuelaCct = ADM.escuelaCct || window.currentPerfil?.escuela_cct;
  const escuelaId  = ADM.escuelaId || window.currentPerfil?.escuela_id || null;
  try {
    // Guardar invitación en BD
    if (window.sb && (escuelaCct || escuelaId)) {
      await sb.from('invitaciones').insert({
        token,
        escuela_id: escuelaId || escuelaCct,
        rol,
        email_destino: email,
        nombre_destino: email,
        estado: 'pendiente',
        expira_at: expira,
        created_at: new Date().toISOString(),
      });
    }

    // Construir link de invitación
    const invLink = `${location.origin}/index.html?invite=${token}`;

    // Enviar email vía Edge Function (solo envía correo, NO crea usuario)
    let emailEnviado = false;
    try {
const supabaseUrl = window.sb?.supabaseUrl || 'https://mgmkzxtljkyoxqeytbjv.supabase.co';
      const { data: { session } } = await sb.auth.getSession();
      const jwt = session?.access_token;
      if (email && jwt) {
        const escNombre = ADM.escuelaNombre || window.currentPerfil?.escuela_nombre || '';
        const res = await fetch(`${supabaseUrl}/functions/v1/invite-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
          body: JSON.stringify({
            email, rol,
            escuela_nombre: escNombre,
            invited_by: currentPerfil?.nombre || 'Admin',
            token,
            link: invLink,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.email_enviado) emailEnviado = true;
      }
    } catch(emailErr) { console.warn('Email send:', emailErr.message); }

    // Mostrar token y link para copiar/compartir
    const emailMsg = emailEnviado
      ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#166534;font-weight:600;">✅ Email enviado a ${email}</div>`
      : (email ? `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#92400e;">⚠️ Email no enviado — comparte el link manualmente</div>` : '');

    ADM.abrirModal('adm-modal-token',
      '✅ Invitación generada',
      `<div style="text-align:center;padding:12px 0;">
        ${emailMsg}
        <div style="font-size:13px;color:#64748b;margin-bottom:16px;">Envía este enlace al usuario para que cree su cuenta</div>
        <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:14px;">
          <div style="font-size:10px;color:#166534;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Link de registro</div>
          <div style="font-family:monospace;font-size:12px;color:#0d5c2f;word-break:break-all;cursor:pointer;" onclick="navigator.clipboard.writeText('${invLink}');ADM.toast('✅ Link copiado')">${invLink}</div>
        </div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          <button onclick="navigator.clipboard.writeText('${invLink}');ADM.toast('✅ Link copiado')" 
            style="padding:9px 16px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
            📋 Copiar link
          </button>
          <button onclick="window.open('https://wa.me/?text='+encodeURIComponent('🌱 SIEMBRA — Te invito a registrarte como ${rol}.\\n\\nCrea tu cuenta aquí:\\n${invLink}\\n\\nExpira en 7 días.'),'_blank')" 
            style="padding:9px 16px;background:#25d366;color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
            💬 WhatsApp
          </button>
        </div>
        <div style="margin-top:14px;padding:10px;background:#f8fafc;border-radius:8px;border:1px dashed #cbd5e1;">
          <div style="font-size:10px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">Token (respaldo)</div>
          <div style="font-family:monospace;font-size:13px;color:#475569;font-weight:600;cursor:pointer;" onclick="navigator.clipboard.writeText('${token}');ADM.toast('✅ Token copiado')">${token}</div>
        </div>
        <div style="font-size:11px;color:#94a3b8;margin-top:10px;">Válido por 7 días · Un solo uso</div>
      </div>`,
      null, 'Cerrar'
    );
    ADM.toast(`✅ Invitación generada para ${email||rol}`);
  } catch(e) { ADM.toast('❌ ' + e.message, 'err'); }
};

// ═══════════════════════════════════════════════════════
// POPULAR SELECTS (actualizar dropdowns del hub)
// ═══════════════════════════════════════════════════════

ADM.popularSelects = function() {
  // Actualizar selectores de grupo en todo el hub
  const grupoOpts = ADM.grupos.map(g => `<option value="${g.id}">${g.nombre||g.grado+'°'}</option>`).join('');
  document.querySelectorAll('.hub-select-grupos').forEach(sel => {
    const val = sel.value;
    sel.innerHTML = '<option value="">Seleccionar grupo…</option>' + grupoOpts;
    if (val) sel.value = val;
  });
  // Renderizar asignaciones si estamos en esa página
  ADM.renderAsignaciones();
};

// ═══════════════════════════════════════════════════════
// ASIGNACIONES — Vista completa de docente↔grupo↔materia
// ═══════════════════════════════════════════════════════

ADM.renderAsignaciones = function() {
  const el = document.getElementById('adm-asignaciones-list');
  if (!el) return;

  if (!ADM.docentes.length) {
    el.innerHTML = `<div class="adm-empty" style="padding:48px 20px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🗂</div>
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:6px;">Todavía no hay docentes registrados</div>
      <div style="font-size:13px;color:#94a3b8;margin-bottom:16px;">Invita o registra al personal docente para poder asignar materias y grupos.</div>
      <button onclick="ADM.navTo('docentes')" style="padding:10px 20px;background:linear-gradient(135deg,#0d5c2f,#157a40);color:white;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;">Ir a Personal →</button>
    </div>`;
    return;
  }

  const avatarColors = ['#0d5c2f','#1e40af','#7c3aed','#c2410c','#a16207','#047857'];
  const initials = n => n.split(' ').map(p=>p[0]||'').join('').toUpperCase().slice(0,2)||'?';

  el.innerHTML = ADM.docentes.map((d, i) => {
    const nombre  = ((d.nombre||'') + ' ' + (d.apellido||d.apellido_p||'')).trim();
    const asigns  = window._admAsignaciones?.[d.id] || [];
    const color   = avatarColors[i % avatarColors.length];
    const gruposAsignados = new Set(asigns.map(a => a.grupo_id || a.grupo || 'global')).size;

    // Agrupar asignaciones por materia para mostrar en qué grupos la imparte
    // Un docente puede impartir la misma materia en varios grupos
    const porMateria = {};
    asigns.forEach(a => {
      const mat = a.materia || '—';
      if (!porMateria[mat]) porMateria[mat] = [];
      porMateria[mat].push(a);
    });

    const asignsHtml = Object.keys(porMateria).length
      ? Object.entries(porMateria).map(([mat, rows]) => {
          const gruposChips = rows.map(r =>
            `<span style="display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;
              border:1px solid #bbf7d0;border-radius:99px;padding:2px 10px;font-size:11px;
              font-weight:600;color:#166534;">
              ${r.grupo || 'Todos'}
              ${r.turno ? `<span style="color:#64748b;">· ${r.turno}</span>` : ''}
              ${r.ciclo ? `<span style="color:#94a3b8;font-weight:400;">${r.ciclo}</span>` : ''}
              <button onclick="ADM.quitarMateria('${d.id}','${r.id}')"
                style="background:none;border:none;cursor:pointer;color:#ef4444;
                font-size:12px;line-height:1;padding:0 0 0 4px;margin:0;" aria-label="Cerrar">✕</button>
            </span>`
          ).join('');
          return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;
            border-bottom:1px solid #f1f5f9;">
            <div style="min-width:180px;font-size:13px;font-weight:700;color:#0f172a;
              padding-top:3px;">📚 ${mat}</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">${gruposChips}</div>
          </div>`;
        }).join('')
      : `<div style="padding:10px 0;font-size:12px;color:#94a3b8;font-style:italic;">
          Sin materias asignadas — usa "+ Agregar" para asignar
        </div>`;

    return `
    <div class="adm-card" style="margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:12px;padding-bottom:12px;
        border-bottom:1px solid #f1f5f9;margin-bottom:10px;cursor:pointer;"
        onclick="this.parentElement.querySelector('.adm-asign-body').style.display=
          this.parentElement.querySelector('.adm-asign-body').style.display==='none'?'block':'none'">
        <div style="width:42px;height:42px;border-radius:12px;background:${color};
          display:flex;align-items:center;justify-content:center;
          font-size:14px;font-weight:800;color:white;flex-shrink:0;">${initials(nombre)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:700;color:#0f172a;">${nombre}</div>
          <div style="font-size:12px;color:#64748b;">${d.email||'—'} · ${d.rol||'docente'}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;
            background:${asigns.length ? '#dcfce7' : '#fee2e2'};
            color:${asigns.length ? '#166534' : '#b91c1c'};">
            ${asigns.length
              ? `${Object.keys(porMateria).length} materia${Object.keys(porMateria).length>1?'s':''} · ${asigns.length} grupo${asigns.length>1?'s':''}`
              : '⚠️ Sin asignar'}
          </span>
          ${asigns.length ? `<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;background:#eff6ff;color:#1d4ed8;">${gruposAsignados} grupo${gruposAsignados>1?'s':''} activos</span>` : ''}
          <span style="font-size:12px;color:#94a3b8;">▼</span>
        </div>
      </div>
      <div class="adm-asign-body" style="display:none;">
        <div style="margin-bottom:12px;">${asignsHtml}</div>
        <button onclick="ADM.abrirAsignarMaterias('${d.id}','${nombre}')"
          style="padding:8px 14px;background:#f0fdf4;border:1.5px solid #86efac;
          color:#166534;border-radius:8px;font-family:inherit;font-size:12px;
          font-weight:700;cursor:pointer;">+ Agregar materia / grupo</button>
      </div>
    </div>`;
  }).join('');
};

ADM.abrirModalNuevaAsignacion = function() {
  if (!ADM.docentes.length) { ADM.toast('⚠️ Primero da de alta docentes', 'warn'); return; }
  const docenteOpts = ADM.docentes.map(d => {
    const nom = ((d.nombre||'') + ' ' + (d.apellido||d.apellido_p||'')).trim();
    return `<option value="${d.id}">${nom} (${d.rol||'docente'})</option>`;
  }).join('');
  const grupoOpts = ADM.grupos.map(g => `<option value="${g.id}">${g.nombre||g.grado+'°'}</option>`).join('');
  const materiaOpts = ADM.materias.map(m => `<option value="${m.nombre||m.id}">${m.nombre}</option>`).join('');

  ADM.abrirModal('adm-modal-nueva-asig',
    '➕ Nueva asignación',
    `<div class="adm-form-group">
      <label>Docente</label>
      <select id="adm-asig-docente">${docenteOpts}</select>
    </div>
    <div class="adm-form-group">
      <label>Grupo</label>
      <select id="adm-asig-grupo">
        <option value="">Todos los grupos</option>
        ${grupoOpts}
      </select>
    </div>
    <div class="adm-form-group">
      <label>Materia</label>
      <select id="adm-asig-materia">
        <option value="">Seleccionar…</option>
        ${materiaOpts}
      </select>
    </div>`,
    'ADM.guardarNuevaAsignacion()'
  );
};

ADM.guardarNuevaAsignacion = async function() {
  const docenteId = document.getElementById('adm-asig-docente')?.value;
  const grupoId   = document.getElementById('adm-asig-grupo')?.value || null;
  const materia   = document.getElementById('adm-asig-materia')?.value;
  if (!docenteId || !materia) { ADM.toast('⚠️ Selecciona docente y materia', 'warn'); return; }
  try {
    const conflicto = window.SiembraAsignaciones?.analizarConflicto
      ? window.SiembraAsignaciones.analizarConflicto(ADM, { docenteId, grupoId, materia, ciclo: window.CICLO_ACTIVO })
      : null;
    if (conflicto?.duplicadaMismoDocente) {
      ADM.toast('⚠️ Esa asignación ya existe para este docente y grupo', 'warn');
      return;
    }
    if (conflicto?.conflictoGrupoMateria) {
      const otroDocente = ADM.docentes.find(d => String(d.id) === String(conflicto.conflictoGrupoMateria.docente_id));
      const nom = otroDocente ? (((otroDocente.nombre||'') + ' ' + (otroDocente.apellido||otroDocente.apellido_p||'')).trim()) : 'otro docente';
      ADM.toast(`⚠️ ${materia} ya está cubierta en este grupo por ${nom}`, 'warn');
      return;
    }
    if (window.SiembraAsignaciones?.guardarAsignacion) {
      await window.SiembraAsignaciones.guardarAsignacion(ADM, {
        sb: window.sb || null,
        docenteId,
        grupoId,
        materia,
        ciclo: window.CICLO_ACTIVO,
      });
    }
    ADM.renderAsignaciones();
    ADM.renderGrupos();
    ADM.renderCoberturaAcademica?.();
    ADM.cerrarModal();
    const totalCarga = conflicto?.totalCargaDocente != null ? conflicto.totalCargaDocente + 1 : null;
    ADM.toast(`✅ ${materia} asignada${totalCarga ? ` · ${totalCarga} carga(s) activas` : ''}`);
  } catch(e) { ADM.toast('❌ ' + e.message, 'err'); }
};

ADM.quitarAsignacion = async function(docenteId, asignId) {
  if (!confirm('¿Quitar esta asignación?')) return;
  try {
    if (window.SiembraAsignaciones?.quitarAsignacion) {
      await window.SiembraAsignaciones.quitarAsignacion(ADM, {
        sb: window.sb || null,
        docenteId,
        asignId,
      });
    }
    ADM.renderAsignaciones();
    ADM.renderGrupos();
    ADM.renderCoberturaAcademica?.();
    ADM.toast('✅ Asignación removida');
  } catch(e) { ADM.toast('❌ ' + e.message, 'err'); }
};

// ═══════════════════════════════════════════════════════
// UTILIDADES — Modal, Toast, Helpers
// ═══════════════════════════════════════════════════════

ADM.abrirModal = function(id, titulo, cuerpo, onConfirmar, btnTexto = 'Guardar') {
  let modal = document.getElementById('adm-modal-universal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'adm-modal-universal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.onclick = (e) => { if (e.target === modal) ADM.cerrarModal(); };
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:520px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;color:#0d5c2f;">${titulo}</div>
        <button onclick="ADM.cerrarModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;line-height:1;" aria-label="Cerrar">✕</button>
      </div>
      <div id="adm-modal-cuerpo" style="margin-bottom:20px;">${cuerpo}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="ADM.cerrarModal()" style="padding:9px 18px;background:#f1f5f9;border:none;border-radius:8px;font-family:sans-serif;font-size:13px;font-weight:600;cursor:pointer;color:#64748b;">Cancelar</button>
        ${onConfirmar ? `<button onclick="${onConfirmar}" style="padding:9px 20px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-family:sans-serif;font-size:13px;font-weight:700;cursor:pointer;">${btnTexto}</button>` : ''}
      </div>
    </div>`;
  modal.style.display = 'flex';
};

ADM.cerrarModal = function() {
  const m = document.getElementById('adm-modal-universal');
  if (m) m.style.display = 'none';
};

ADM.toast = function(msg, tipo = 'ok') {
  if (typeof hubToast === 'function') { hubToast(msg, tipo); return; }
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:${tipo==='err'?'#ef4444':'#0d5c2f'};color:white;padding:12px 20px;border-radius:10px;font-family:sans-serif;font-size:13px;font-weight:700;z-index:99999;animation:fadeIn .3s;`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
};

ADM._generarToken = function() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return 'inv-' + Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map(b => chars[b % chars.length]).join('');
};

ADM._generarCodigoCorto = function() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => chars[b % chars.length]).join('');
};

// ═══════════════════════════════════════════════════════
// DATOS DEMO
// ═══════════════════════════════════════════════════════

ADM._demoGrupos = () => (window.SiembraDemoFixtures?.admin?.grupos || []).map(g => ({ ...g, ciclo: window.CICLO_ACTIVO }));
ADM._demoDocentes = () => window.SiembraDemoFixtures?.admin?.docentes || [];
ADM._demoAlumnos = () => window.SiembraDemoFixtures?.admin?.alumnos || [];
ADM._demoMaterias = () => {
  const nivel = window._admNivelActivo || window._nivelActivo || 'primaria';
  const campos = nivel === 'secundaria' ? CAMPOS_NEM_SECUNDARIA : CAMPOS_NEM_PRIMARIA;
  const result = [];
  campos.forEach((campo, ci) => {
    campo.materias.forEach((nombre, mi) => {
      result.push({
        id: `m-${ci}-${mi}`,
        nombre,
        nivel,
        campo: campo.id,
        campo_nombre: campo.nombre,
        horas_semana: nombre === 'Matemáticas' ? 5 : nombre.includes('Física') ? 3 : 4,
        activo: true,
      });
    });
  });
  return result;
}

// ═══════════════════════════════════════════════════════
// CSS del módulo (se inyecta dinámicamente)
// ═══════════════════════════════════════════════════════
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .adm-card { background:white; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; margin-bottom:8px; }
    .adm-card-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }
    .adm-card-title { font-weight:700; font-size:14px; color:#0f172a; }
    .adm-card-sub { font-size:12px; color:#64748b; margin-top:2px; }
    .adm-avatar { width:36px; height:36px; border-radius:50%; background:#dcfce7; color:#166534; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
    .adm-badge { display:inline-block; padding:2px 9px; border-radius:20px; font-size:11px; font-weight:700; }
    .adm-badge-green { background:#dcfce7; color:#166534; }
    .adm-badge-blue  { background:#dbeafe; color:#1e40af; }
    .adm-badge-amber { background:#fef9c3; color:#a16207; }
    .adm-btn-sm { padding:5px 10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; font-family:inherit; transition:.15s; white-space:nowrap; }
    .adm-btn-sm:hover { background:#f1f5f9; }
    .adm-btn-danger { background:#fff1f2; border-color:#fecdd3; color:#be123c; }
    .adm-btn-danger:hover { background:#ffe4e6; }
    .adm-empty { text-align:center; padding:32px; color:#94a3b8; font-size:13px; }
    .adm-form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
    .adm-form-group { margin-bottom:12px; }
    .adm-form-group label { display:block; font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.5px; margin-bottom:5px; }
    .adm-form-group input, .adm-form-group select { width:100%; padding:9px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-family:inherit; font-size:13px; outline:none; transition:border-color .2s; }
    .adm-form-group input:focus, .adm-form-group select:focus { border-color:#0d5c2f; }
    .adm-tabla { width:100%; border-collapse:collapse; font-size:13px; }
    .adm-tabla thead tr { background:#f8fafc; }
    .adm-tabla th { padding:10px 12px; text-align:left; font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; border-bottom:1px solid #e2e8f0; }
    .adm-tabla td { padding:10px 12px; border-bottom:1px solid #f1f5f9; }
    .adm-tabla tr:hover td { background:#fafcff; }
    .adm-nav-btn { display:flex; align-items:center; gap:8px; width:100%; padding:9px 14px; background:none; border:none; border-radius:8px; font-family:inherit; font-size:13px; font-weight:600; color:#64748b; cursor:pointer; text-align:left; transition:.15s; }
    .adm-nav-btn:hover { background:#f1f5f9; color:#0f172a; }
    .adm-nav-btn.active { background:#dcfce7; color:#166534; }
    #admin-portal .adm-page { display:none; } /* scopeado — no afectar otros portales */
    @media (max-width: 640px) { .adm-form-row { grid-template-columns:1fr; } }
  `;
  document.head.appendChild(style);
})();

// ═══════════════════════════════════════════════════════════════════
// PARTE 3 · Módulo Docente — XP, Evidencias, Calificaciones reales
// ═══════════════════════════════════════════════════════════════════

// ── Panel XP: el docente otorga puntos a alumnos ─────────────────
window.XP = {};

XP.TIPOS = [
  { id:'participacion',   label:'Participación en clase',   pts:5,  icon:'🙋' },
  { id:'tarea',           label:'Tarea entregada',           pts:10, icon:'📝' },
  { id:'proyecto',        label:'Proyecto completado',       pts:25, icon:'🔬' },
  { id:'calificacion_sube',label:'Mejoró calificación',      pts:15, icon:'📈' },
  { id:'docente_especial',label:'Nota especial del docente', pts:20, icon:'⭐' },
  { id:'mejora_trabajo',  label:'Mejora de trabajo',         pts:10, icon:'💪' },
  { id:'concurso',        label:'Participó en concurso',     pts:30, icon:'🏆' },
  { id:'otro',            label:'Otro motivo',               pts:5,  icon:'✨' },
];

XP.abrirPanel = function() {
  const alumnosLista = (window._alumnosActivos || alumnos || []);
  if (!alumnosLista.length) { hubToast('⚠️ Sin alumnos cargados', 'warn'); return; }

  const modal = document.createElement('div');
  modal.id = 'xp-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:540px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div style="font-family:'Fraunces',serif;font-size:20px;font-weight:700;color:#0d5c2f;">⭐ Otorgar XP al alumno</div>
        <button onclick="document.getElementById('xp-modal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;" aria-label="Cerrar">✕</button>
      </div>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Alumno</label>
        <select id="xp-alumno-sel" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;outline:none;">
          <option value="">Seleccionar alumno…</option>
          ${alumnosLista.map(a => `<option value="${a.id||a.n}">${a.nombre||a.n} ${a.apellido||a.apellido_p||''}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Motivo</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          ${XP.TIPOS.map(t => `
            <div onclick="XP.selTipo('${t.id}',this)" data-id="${t.id}" data-pts="${t.pts}"
              style="padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;transition:.15s;display:flex;align-items:center;gap:8px;">
              <span style="font-size:18px;">${t.icon}</span>
              <div>
                <div style="font-size:12px;font-weight:700;color:#0f172a;">${t.label}</div>
                <div style="font-size:11px;color:#64748b;">+${t.pts} XP</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Nota adicional (opcional)</label>
        <input type="text" id="xp-nota" placeholder="Ej: Excelente exposición oral…"
          style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;outline:none;">
      </div>
      <div style="background:#f0fdf4;border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:13px;color:#166534;font-weight:600;">XP a otorgar:</span>
        <span style="font-family:'Fraunces',serif;font-size:24px;font-weight:900;color:#0d5c2f;" id="xp-pts-preview">— XP</span>
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="document.getElementById('xp-modal').remove()" style="flex:1;padding:11px;background:#f1f5f9;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;color:#64748b;">Cancelar</button>
        <button onclick="XP.otorgar()" style="flex:2;padding:11px;background:#0d5c2f;color:white;border:none;border-radius:10px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;">⭐ Otorgar XP</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  window._xpTipoActual = null;
};

XP.selTipo = function(id, el) {
  document.querySelectorAll('#xp-modal [data-id]').forEach(d => {
    d.style.background = ''; d.style.borderColor = '#e2e8f0';
  });
  el.style.background = '#f0fdf4'; el.style.borderColor = '#86efac';
  window._xpTipoActual = id;
  const pts = parseInt(el.dataset.pts);
  const preview = document.getElementById('xp-pts-preview');
  if (preview) preview.textContent = `+${pts} XP`;
};

XP.otorgar = async function() {
  const alumnoId = document.getElementById('xp-alumno-sel')?.value;
  const tipo     = window._xpTipoActual;
  const nota     = document.getElementById('xp-nota')?.value.trim();
  if (!alumnoId) { hubToast('⚠️ Selecciona un alumno', 'warn'); return; }
  if (!tipo)     { hubToast('⚠️ Selecciona el motivo', 'warn'); return; }

  const tipoData = XP.TIPOS.find(t => t.id === tipo);
  const cantidad = tipoData?.pts || 5;
  const motivo   = nota || tipoData?.label || tipo;

  try {
    if (sb && currentPerfil) {
      // Insertar evento XP
      const { error: xpErr } = await sb.from('xp_eventos_alumno').insert({
        alumno_id:    alumnoId,
        cantidad,
        tipo,
        motivo,
        otorgado_por: currentPerfil.id,
        grupo_id:     window._grupoActivo || null,
        fecha:        new Date().toISOString().split('T')[0],
      });
      if (xpErr) throw xpErr;

      // Actualizar total en perfil_alumno
      await sb.from('perfil_alumno').upsert({
        alumno_id: alumnoId, xp_total: 0, puntos_canjeables: 0,
      }, { onConflict: 'alumno_id', ignoreDuplicates: true });

      await sb.rpc('incrementar_xp', { p_alumno_id: alumnoId, p_cantidad: cantidad })
        .then(() => {})
        .catch(async () => {
          // Fallback si no existe la función RPC
          const { data: perfil } = await sb.from('perfil_alumno')
            .select('xp_total, puntos_canjeables').eq('alumno_id', alumnoId).single();
          if (perfil) {
            await sb.from('perfil_alumno').update({
              xp_total: (perfil.xp_total || 0) + cantidad,
              puntos_canjeables: (perfil.puntos_canjeables || 0) + cantidad,
            }).eq('alumno_id', alumnoId);
          }
        });
    }
    document.getElementById('xp-modal')?.remove();
    hubToast(`✅ +${cantidad} XP otorgados · ${motivo}`, 'ok');
  } catch(e) {
    hubToast('❌ ' + e.message, 'err');
  }
};

// ── Ver evidencias subidas por padres ────────────────────────────
window.EVD = {};

EVD.abrirPanel = async function() {
  const grupoId = window._grupoActivo;
  const modal = document.createElement('div');
  modal.id = 'evd-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:620px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div style="font-family:'Fraunces',serif;font-size:20px;font-weight:700;color:#0d5c2f;">📸 Evidencias de familias</div>
        <button onclick="document.getElementById('evd-modal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;" aria-label="Cerrar">✕</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        <button onclick="EVD.filtrar('todas',this)" style="padding:6px 14px;background:#0d5c2f;color:white;border:none;border-radius:20px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;" class="evd-filter-btn">Todas</button>
        <button onclick="EVD.filtrar('pendiente',this)" style="padding:6px 14px;background:#f1f5f9;color:#64748b;border:none;border-radius:20px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;" class="evd-filter-btn">Pendientes</button>
        <button onclick="EVD.filtrar('aprobada',this)" style="padding:6px 14px;background:#f1f5f9;color:#64748b;border:none;border-radius:20px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;" class="evd-filter-btn">Aprobadas</button>
      </div>
      <div id="evd-lista" style="display:flex;flex-direction:column;gap:10px;">
        <div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">
          <div style="font-size:32px;margin-bottom:8px;">📷</div>
          Cargando evidencias…
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  await EVD.cargar('todas');
};

EVD._data = [];
EVD.cargar = async function(filtroEstado = 'todas') {
  const el = document.getElementById('evd-lista');
  if (!el) return;
  EVD._data = [];

  if (!sb || !currentPerfil) {
    EVD._data = EVD._demo();
    EVD.render(filtroEstado);
    return;
  }

  try {
    const alumnosIds = (window._alumnosActivos || []).map(a => a.id).filter(Boolean);
    if (!alumnosIds.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Sin alumnos en el grupo</div>'; return; }

    let query = sb.from('evidencias')
      .select('*, usuarios!alumno_id(nombre,apellido)')
      .in('alumno_id', alumnosIds)
      .order('created_at', { ascending: false })
      .limit(50);

    if (filtroEstado !== 'todas') query = query.eq('estado', filtroEstado);

    const { data, error } = await query;
    if (error) throw error;
    EVD._data = data || [];
  } catch(e) {
    EVD._data = EVD._demo();
  }
  EVD.render(filtroEstado);
};

EVD.filtrar = function(estado, btn) {
  document.querySelectorAll('.evd-filter-btn').forEach(b => {
    b.style.background = '#f1f5f9'; b.style.color = '#64748b';
  });
  if (btn) { btn.style.background = '#0d5c2f'; btn.style.color = 'white'; }
  EVD.cargar(estado);
};

EVD.render = function(filtro) {
  const el = document.getElementById('evd-lista');
  if (!el) return;
  const lista = filtro === 'todas' ? EVD._data : EVD._data.filter(e => e.estado === filtro);
  if (!lista.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;"><div style="font-size:32px;margin-bottom:8px;">✅</div>Sin evidencias en esta categoría</div>';
    return;
  }
  const estadoBadge = { pendiente:'#fef9c3:#a16207:⏳ Pendiente', aprobada:'#dcfce7:#166534:✅ Aprobada', comentada:'#dbeafe:#1e40af:💬 Comentada', rechazada:'#fee2e2:#b91c1c:↩ Devuelta' };
  el.innerHTML = lista.map(e => {
    const alumno = e.usuarios ? `${e.usuarios.nombre||''} ${e.usuarios.apellido||''}`.trim() : 'Alumno';
    const [bg, col, lbl] = (estadoBadge[e.estado] || '#f1f5f9:#64748b:—').split(':');
    const fecha = e.created_at ? new Date(e.created_at).toLocaleDateString('es-MX', { day:'numeric', month:'short' }) : '';
    return `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:white;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:40px;height:40px;border-radius:8px;background:#f0fdf4;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">
          ${{ tarea:'📝', proyecto:'🔬', examen:'📋', otra:'⭐' }[e.tipo] || '📄'}
        </div>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:13px;color:#0f172a;">${e.titulo || e.tipo || 'Evidencia'}</div>
          <div style="font-size:11px;color:#64748b;">${alumno} · ${fecha}</div>
        </div>
        <span style="background:${bg};color:${col};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">${lbl}</span>
      </div>
      ${e.url_archivo ? `<div style="margin-bottom:10px;"><a href="${e.url_archivo}" target="_blank" style="font-size:12px;color:#0d5c2f;font-weight:700;text-decoration:none;">🖼 Ver archivo →</a></div>` : ''}
      ${e.descripcion ? `<div style="font-size:12px;color:#64748b;margin-bottom:10px;">${e.descripcion}</div>` : ''}
      ${e.estado === 'pendiente' ? `
      <div style="display:flex;gap:6px;margin-top:6px;">
        <input type="text" placeholder="Comentario al padre (opcional)…" id="evd-coment-${e.id}"
          style="flex:1;padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:7px;font-family:inherit;font-size:12px;outline:none;">
        <button onclick="EVD.aprobar('${e.id}')" style="padding:7px 14px;background:#0d5c2f;color:white;border:none;border-radius:7px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">✅ Aprobar</button>
        <button onclick="EVD.comentar('${e.id}')" style="padding:7px 12px;background:#dbeafe;color:#1e40af;border:none;border-radius:7px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;" aria-label="Comentar">💬</button>
      </div>` : e.comentario_docente ? `<div style="background:#f8fafc;border-radius:8px;padding:8px 10px;font-size:12px;color:#64748b;margin-top:6px;">💬 ${e.comentario_docente}</div>` : ''}
    </div>`;
  }).join('');
};

EVD.aprobar = async function(id) {
  try {
    const coment = document.getElementById(`evd-coment-${id}`)?.value.trim();
    if (sb) {
      await sb.from('evidencias').update({
        estado: 'aprobada',
        comentario_docente: coment || null,
        docente_id: currentPerfil?.id,
      }).eq('id', id);
    }
    const ev = EVD._data.find(e => e.id === id);
    if (ev) ev.estado = 'aprobada';
    EVD.render('todas');
    hubToast('✅ Evidencia aprobada', 'ok');
  } catch(e) { hubToast('❌ ' + e.message, 'err'); }
};

EVD.comentar = async function(id) {
  const coment = document.getElementById(`evd-coment-${id}`)?.value.trim();
  if (!coment) { hubToast('⚠️ Escribe un comentario primero', 'warn'); return; }
  try {
    if (sb) {
      await sb.from('evidencias').update({
        estado: 'comentada',
        comentario_docente: coment,
        docente_id: currentPerfil?.id,
      }).eq('id', id);
    }
    const ev = EVD._data.find(e => e.id === id);
    if (ev) { ev.estado = 'comentada'; ev.comentario_docente = coment; }
    EVD.render('todas');
    hubToast('💬 Comentario enviado al padre', 'ok');
  } catch(e) { hubToast('❌ ' + e.message, 'err'); }
};

EVD._demo = () => [
  { id:'e1', tipo:'tarea', titulo:'Tarea de Matemáticas pág 45', estado:'pendiente', created_at: new Date().toISOString(), descripcion:'Ejercicios de fracciones completos', usuarios:{ nombre:'Diego', apellido:'García' } },
  { id:'e2', tipo:'proyecto', titulo:'Maqueta del sistema solar', estado:'pendiente', created_at: new Date(Date.now()-86400000).toISOString(), descripcion:'Proyecto de Ciencias Naturales', usuarios:{ nombre:'Sofía', apellido:'Ramírez' } },
  { id:'e3', tipo:'tarea', titulo:'Resumen de Historia', estado:'aprobada', created_at: new Date(Date.now()-172800000).toISOString(), comentario_docente:'¡Muy completo, felicidades!', usuarios:{ nombre:'Luis', apellido:'Hernández' } },
];

// ── Botones XP y Evidencias en portal docente ────────────────────
// Se inyectan en el nav del docente al iniciar
(function _inyectarBotonesDocente() {
  // XP ya está integrado en la sección Obs · XP · Alerta TS (tab "Otorgar XP")
  // Redirigir XP.abrirPanel() al tab integrado para evitar duplicados
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      if (typeof XP !== 'undefined') {
        XP.abrirPanel = function() {
          dNav('observaciones');
          setTimeout(() => { if (typeof obsTab === 'function') obsTab('xp'); }, 150);
        };
      }
      // Evidencias familias — accesible desde el header de Actividades (botón 📸)
    }, 1000);
  });
})();

console.log('[SIEMBRA] Módulos XP + Evidencias cargados · Parte 3');


// ══════════════════════════════════════════════════════════════════════
// SUPERADMIN MODULE
// ══════════════════════════════════════════════════════════════════════

let _saEscuelas = [];
let _saInvLink  = '';

async function saInit() {
  // Mostrar email en sidebar
  const emailEl = document.getElementById('sa-user-email');
  if (emailEl && currentUser?.email) emailEl.textContent = currentUser.email;

  await Promise.all([saCargarStats(), saCargarEscuelas()]);
  saNav('dashboard');
}

function saNav(page) {
  document.querySelectorAll('#superadmin-portal .sa-nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#superadmin-portal .sa-page').forEach(p => p.style.display = 'none');
  const btn = document.getElementById('sa-nav-' + page);
  const pg  = document.getElementById('sa-p-' + page);
  if (btn) btn.classList.add('active');
  if (pg)  pg.style.display = 'block';
  if (page === 'escuelas')     saRenderEscuelas();
  if (page === 'invitaciones') saCargarInvitaciones();
  if (page === 'usuarios')     saCargarUsuarios();
}

async function saCargarStats() {
  if (!sb) return;
  try {
    const [rE, rU, rI] = await Promise.all([
      sb.from('escuelas').select('id', { count:'exact', head:true }),
      sb.from('usuarios').select('id', { count:'exact', head:true }),
      sb.from('invitaciones').select('id', { count:'exact', head:true }).eq('estado','pendiente'),
    ]);
    const s = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v??'—'; };
    s('sa-stat-escuelas', rE.count??0);
    s('sa-stat-usuarios', rU.count??0);
    s('sa-stat-invitaciones', rI.count??0);
  } catch(e) { console.warn('[SA stats]', e.message); }
}

async function saCargarEscuelas() {
  if (!sb) { _saEscuelas = _saDemoEscuelas(); saRenderEscuelas(); return; }
  try {
    const { data } = await sb.from('escuelas').select('*').order('nombre');
    _saEscuelas = data || [];
    saRenderEscuelas();
    // Poblar selector en modal invitar
    const sel = document.getElementById('sa-inv-escuela');
    if (sel) {
      sel.innerHTML = '<option value="">Seleccionar escuela…</option>' +
        _saEscuelas.map(e => `<option value="${e.cct||e.id}">${e.nombre} (${e.cct||'—'})</option>`).join('');
    }
  } catch(e) { console.warn('[SA escuelas]', e.message); _saEscuelas = _saDemoEscuelas(); saRenderEscuelas(); }
}

function _saDemoEscuelas() {
  return window.SiembraDemoFixtures?.sa?.escuelas || [];
}

function saRenderEscuelas() {
  const el = document.getElementById('sa-escuelas-list');
  if (!el) return;
  if (!_saEscuelas.length) {
    el.innerHTML = `<div style="text-align:center;padding:48px;color:#64748b;">
      <div style="font-size:40px;margin-bottom:12px;">🏫</div>
      <div style="font-size:15px;font-weight:700;color:#94a3b8;margin-bottom:8px;">Sin escuelas registradas</div>
      <button onclick="saAbrirModalEscuela()" style="padding:10px 20px;background:#22c55e;color:#0f172a;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;">+ Registrar primera escuela</button>
    </div>`;
    return;
  }
  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
    ${_saEscuelas.map(e => `
      <div style="background:#1e293b;border-radius:14px;padding:18px;border:1px solid #334155;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <div style="width:44px;height:44px;border-radius:10px;background:#0f172a;display:flex;align-items:center;justify-content:center;font-size:20px;">🏫</div>
          <div style="flex:1;">
            <div style="font-weight:700;font-size:14px;color:white;">${e.nombre||'—'}</div>
            <div style="font-size:11px;color:#64748b;font-family:monospace;">${e.cct||'—'} · ${e.nivel||'—'}</div>
          </div>
          <span style="padding:3px 8px;background:${e.activo?'#14532d':'#450a0a'};color:${e.activo?'#22c55e':'#ef4444'};border-radius:6px;font-size:10px;font-weight:700;">${e.activo?'Activa':'Inactiva'}</span>
        </div>
        <div style="font-size:12px;color:#64748b;margin-bottom:12px;">📍 ${e.municipio||'—'}</div>
        <div style="display:flex;gap:8px;">
          <button onclick="saInvitarAdminEscuela('${e.cct||e.id}','${e.nombre}')" style="flex:1;padding:7px 10px;background:#1d4ed8;color:white;border:none;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">✉️ Invitar admin</button>
          <button onclick="saVerEscuela('${e.id}')" style="padding:7px 10px;background:#334155;color:white;border:none;border-radius:8px;font-family:inherit;font-size:12px;cursor:pointer;">Ver →</button>
        </div>
      </div>`).join('')}
  </div>`;
}

function saAbrirModalEscuela() {
  ['sa-esc-nombre','sa-esc-cct','sa-esc-municipio','sa-esc-email-dir'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  document.getElementById('sa-modal-esc-resultado').style.display = 'none';
  document.getElementById('sa-modal-escuela').style.display = 'flex';
}

async function saCrearEscuela() {
  const nombre    = document.getElementById('sa-esc-nombre').value.trim();
  const cct       = document.getElementById('sa-esc-cct').value.trim().toUpperCase();
  const municipio = document.getElementById('sa-esc-municipio').value.trim();
  const estado    = document.getElementById('sa-esc-estado')?.value.trim() || '';
  const nivelRaw  = document.getElementById('sa-esc-nivel').value;
  // Normalize — DB stores as 'primaria', 'secundaria', or 'primaria_y_secundaria'
  const nivel     = nivelRaw;
  // Para escuelas mixtas, secundaria como default (el admin puede cambiar con el switcher)
  const nivel_default = nivelRaw === 'primaria_y_secundaria' ? 'secundaria' : nivelRaw;
  const turno     = document.getElementById('sa-esc-turno')?.value || 'Matutino';
  const zona      = document.getElementById('sa-esc-zona')?.value.trim() || '';
  const emailDir  = document.getElementById('sa-esc-email-dir').value.trim().toLowerCase();

  if (!nombre || !cct) { hubToast('⚠️ Nombre y CCT son obligatorios', 'warn'); return; }

  const btn = document.getElementById('sa-btn-crear-esc');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Creando…'; }

  try {
    if (sb) {
      // 1. Insertar escuela y recuperar el UUID generado
      const { data: escInserted, error: escErr } = await sb.from('escuelas').insert({
        nombre, cct, municipio, estado, nivel, turno,
        nivel_default,
        zona_escolar: zona || null,
        activo: true,
        ciclo_actual: window.CICLO_ACTIVO,
        creado_en: new Date().toISOString(),
      }).select('id, cct, nivel, nivel_default').single();
      if (escErr && !escErr.message.includes('duplicate')) throw escErr;

      // Obtener el UUID real de la escuela (sea nueva o ya existente)
      let escuelaUuid = escInserted?.id || null;
      if (!escuelaUuid) {
        const { data: escExist } = await sb.from('escuelas')
          .select('id').eq('cct', cct).maybeSingle();
        escuelaUuid = escExist?.id || null;
      }
    }

    // 2. Enviar invitación real al admin/director via Edge Function
    let invLink = '';
    if (emailDir && sb) {
      try {
const supabaseUrl = sb.supabaseUrl || 'https://mgmkzxtljkyoxqeytbjv.supabase.co';
        const { data: { session: saSession } } = await sb.auth.getSession();
        const saJwt = saSession?.access_token;
        const res = await fetch(`${supabaseUrl}/functions/v1/invite-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(saJwt ? { 'Authorization': `Bearer ${saJwt}` } : {}),
          },
          body: JSON.stringify({
            email:          emailDir,
            rol:            'admin',
            escuela_id:     escuelaUuid || cct,  // UUID real, no el CCT
            escuela_cct:    cct,
            escuela_nombre: nombre,
            escuela_nivel:  nivel,
            invited_by:     currentUser?.email || 'SuperAdmin SIEMBRA',
          }),
        });
        const inv = await res.json();
        invLink = inv.reset_link || '';
        if (inv.ok) {
          hubToast(`✅ Correo de invitación enviado a ${emailDir}`, 'ok');
        }
      } catch(invErr) {
        console.warn('[saCrearEscuela] invite error:', invErr.message);
      }
    }

    // 3. Mostrar resultado
    const resEl = document.getElementById('sa-modal-esc-resultado');
    if (resEl) {
      resEl.style.display = 'block';
      resEl.innerHTML = `✅ Escuela <strong>${nombre}</strong> (${cct}) creada exitosamente.${emailDir ? `<br><span style="color:#86efac;">📧 Invitación enviada a ${emailDir}</span>` : ''}`;
    }

    hubToast(`✅ Escuela ${nombre} creada`, 'ok');
    await saCargarEscuelas();
    await saCargarStats();

  } catch(e) {
    hubToast('❌ ' + e.message, 'err');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Crear escuela →'; }
  }
}

function saInvitarAdmin() {
  document.getElementById('sa-inv-resultado').style.display = 'none';
  document.getElementById('sa-modal-invitar').style.display = 'flex';
}

function saInvitarAdminEscuela(cct, nombre) {
  const sel = document.getElementById('sa-inv-escuela');
  if (sel) sel.value = cct;
  saInvitarAdmin();
}

async function saEnviarInvitacion() {
  const escuelaCct = document.getElementById('sa-inv-escuela').value;
  const rol        = document.getElementById('sa-inv-rol').value;
  const nombre     = document.getElementById('sa-inv-nombre').value.trim();
  const email      = document.getElementById('sa-inv-email').value.trim().toLowerCase();

  if (!escuelaCct) { hubToast('⚠️ Selecciona una escuela', 'warn'); return; }
  if (!email)      { hubToast('⚠️ Ingresa el correo', 'warn'); return; }

  const btn = document.getElementById('sa-btn-inv');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Generando…'; }

  try {
const supabaseUrl = sb?.supabaseUrl || 'https://mgmkzxtljkyoxqeytbjv.supabase.co';

    // Enviar via Edge Function (crea usuario + envía correo real)
    const res = await fetch(`${supabaseUrl}/functions/v1/invite-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        rol,
        escuela_id:     escuelaCct,
        escuela_nombre: document.getElementById('sa-inv-escuela')?.selectedOptions[0]?.text || escuelaCct,
        invited_by:     'SuperAdmin SIEMBRA',
      }),
    });
    const inv = await res.json();

    if (!inv.ok) throw new Error(inv.error || 'Error en Edge Function');

    // También registrar en tabla invitaciones para auditoría
    if (sb) {
      const token  = _saGenerarToken();
      const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await sb.from('invitaciones').insert({
        token, escuela_cct: escuelaCct, rol, email_destino: email,
        nombre_destino: nombre || null,
        estado: 'enviada', expira_at: expira,
        auth_user_id: inv.user_id || null,
        creado_por: currentUser?.id || null,
        created_at: new Date().toISOString(),
      }).catch(() => {}); // no bloquear si falla el registro
    }

    _saInvLink = inv.reset_link || '';
    const linkEl = document.getElementById('sa-inv-link');
    if (linkEl) linkEl.textContent = _saInvLink || '(link generado internamente)';
    document.getElementById('sa-inv-resultado').style.display = 'block';
    hubToast(`✅ Invitación enviada a ${email}`, 'ok');
    saCargarInvitaciones();

  } catch(e) {
    hubToast('❌ ' + e.message, 'err');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Generar invitación →'; }
  }
}

function saInvCopiar() {
  if (!_saInvLink) return;
  navigator.clipboard.writeText(_saInvLink)
    .then(() => hubToast('📋 Link copiado', 'ok'))
    .catch(() => { const t=document.createElement('textarea'); t.value=_saInvLink; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); hubToast('📋 Copiado','ok'); });
}

function saInvWhatsApp() {
  if (!_saInvLink) return;
  const msg = encodeURIComponent(`Te invito a SIEMBRA 🌱\nRegistra tu cuenta aquí:\n${_saInvLink}\n\nEl link expira en 7 días.`);
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

async function saCargarInvitaciones() {
  const el = document.getElementById('sa-invitaciones-list');
  if (!el) return;

  if (!sb) { el.innerHTML = '<div style="color:#64748b;padding:20px;">Conecta Supabase para ver invitaciones.</div>'; return; }

  try {
    const { data } = await sb.from('invitaciones').select('*').order('created_at', { ascending:false }).limit(50);
    if (!data?.length) {
      el.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;font-size:13px;">Sin invitaciones generadas.</div>';
      return;
    }
    const rolIco = { director:'👩‍💼', admin:'⚙️', docente:'👩‍🏫', ts:'⚖️', coordinador:'📋' };
    el.innerHTML = `<div style="background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#0f172a;">
          <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Rol</th>
          <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Email</th>
          <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Escuela</th>
          <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Estado</th>
          <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Expira</th>
          <th style="padding:10px 14px;"></th>
        </tr></thead>
        <tbody>${data.map(inv => {
          const exp = inv.expira_at ? new Date(inv.expira_at) : null;
          const expirado = exp && exp < new Date();
          const estado = inv.estado==='usado' ? 'usado' : expirado ? 'expirado' : 'pendiente';
          const estadoColor = estado==='pendiente'?'#22c55e':estado==='usado'?'#64748b':'#ef4444';
          const link = `${location.origin}/index.html?invite=${inv.token}`;
          return `<tr style="border-top:1px solid #334155;">
            <td style="padding:10px 14px;color:white;">${rolIco[inv.rol]||'👤'} ${inv.rol}</td>
            <td style="padding:10px 14px;color:#94a3b8;font-size:12px;">${inv.email_destino||'—'}</td>
            <td style="padding:10px 14px;color:#94a3b8;font-size:11px;font-family:monospace;">${inv.escuela_cct||'—'}</td>
            <td style="padding:10px 14px;"><span style="color:${estadoColor};font-size:11px;font-weight:700;">● ${estado}</span></td>
            <td style="padding:10px 14px;font-size:11px;color:#64748b;">${exp?exp.toLocaleDateString('es-MX'):'—'}</td>
            <td style="padding:10px 14px;">
              ${estado==='pendiente'?`<button onclick="navigator.clipboard.writeText('${link}').then(()=>hubToast('📋 Copiado','ok'))" style="padding:4px 10px;background:#1d4ed8;color:white;border:none;border-radius:6px;font-family:inherit;font-size:11px;cursor:pointer;">Copiar</button>`:''}
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
  } catch(e) {
    el.innerHTML = `<div style="color:#ef4444;padding:20px;font-size:13px;">Error: ${e.message}</div>`;
  }
}

async function saCargarUsuarios() {
  const el = document.getElementById('sa-usuarios-list');
  if (!el) return;
  if (!sb) { el.innerHTML = '<div style="color:#64748b;padding:20px;">Conecta Supabase.</div>'; return; }
  el.innerHTML = '<div style="color:#64748b;padding:20px;font-size:13px;">Cargando…</div>';
  try {
    const { data } = await sb.from('usuarios').select('id,nombre,apellido_p,email,rol,escuela_cct,activo').order('rol').order('nombre').limit(200);
    if (!data?.length) { el.innerHTML = '<div style="color:#64748b;padding:20px;">Sin usuarios.</div>'; return; }
    const rolColor = { superadmin:'#22c55e', director:'#3b82f6', admin:'#f59e0b', docente:'#8b5cf6', alumno:'#64748b', ts:'#ec4899', padre:'#06b6d4' };
    el.innerHTML = `<div style="background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#0f172a;">
          <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Nombre</th>
          <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Email</th>
          <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Rol</th>
          <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Escuela</th>
        </tr></thead>
        <tbody>${data.map(u => `<tr style="border-top:1px solid #334155;">
          <td style="padding:9px 14px;color:white;font-weight:600;">${u.nombre||''} ${u.apellido_p||''}</td>
          <td style="padding:9px 14px;color:#94a3b8;font-size:12px;">${u.email||'—'}</td>
          <td style="padding:9px 14px;"><span style="color:${rolColor[u.rol]||'#94a3b8'};font-size:11px;font-weight:700;">${u.rol}</span></td>
          <td style="padding:9px 14px;color:#64748b;font-size:11px;font-family:monospace;">${u.escuela_cct||'—'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  } catch(e) { el.innerHTML = `<div style="color:#ef4444;padding:20px;">Error: ${e.message}</div>`; }
}

function saFiltrarUsuarios(query) {
  const rows = document.querySelectorAll('#sa-usuarios-list tbody tr');
  rows.forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(query.toLowerCase()) ? '' : 'none';
  });
}

function saVerEscuela(id) { saNav('usuarios'); }

function _saGenerarToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

// ── Also add superadmin chip to login ──
// (hooked via DOMContentLoaded below)
