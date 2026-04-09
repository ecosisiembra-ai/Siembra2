// ══════════════════════════════════════════════════
// PORTAL FAMILIA — pInit con datos reales Supabase
// ══════════════════════════════════════════════════
async function pInit() {
  if (!sb || !currentPerfil) { pInitDemo(); return; }
  try {
    // ── Buscar vínculos: primero en vinculos_padre (donde admin los crea),
    //    luego fallback a padre_alumno (vinculación por código manual)
    let alumnosPadre = [];

    // Fuente 1: vinculos_padre (el admin vincula aquí al dar de alta al padre)
    const { data: vp } = await sb.from('vinculos_padre')
      .select('alumno_id, alumno:alumno_id(id, nombre, apellido_p, apellido_m, curp)')
      .eq('padre_id', currentPerfil.id)
      .eq('activo', true);
    if (vp?.length) {
      alumnosPadre = vp.map(v => v.alumno).filter(Boolean);
    }

    // Fuente 2: padre_alumno (vinculación por código)
    if (!alumnosPadre.length) {
      const { data: pa } = await sb.from('padre_alumno')
        .select('alumno_id, usuarios!alumno_id(id, nombre, apellido_p, apellido_m, curp)')
        .eq('padre_id', currentPerfil.id)
        .eq('activo', true);
      alumnosPadre = pa?.map(v => v.usuarios).filter(Boolean) || [];
    }

    // Fuente 3: padres_alumnos (tabla alternativa usada en aprobación de solicitudes)
    if (!alumnosPadre.length) {
      const { data: pa2 } = await sb.from('padres_alumnos')
        .select('alumno_id, usuarios!alumno_id(id, nombre, apellido_p, apellido_m, curp)')
        .eq('padre_id', currentPerfil.id)
        .eq('activo', true);
      alumnosPadre = pa2?.map(v => v.usuarios).filter(Boolean) || [];
    }

    window._alumnosPadre = alumnosPadre;

    if (!alumnosPadre.length) {
      // Sin vínculo: mostrar pantalla de vinculación
      pMostrarVinculacion();
      return;
    }

    // Si hay múltiples hijos, mostrar selector
    if (alumnosPadre.length > 1) {
      pRenderSelectorHijos(alumnosPadre);
    }

    pSetAlumno(alumnosPadre[0]);
  } catch(e) {
    console.warn('pInit error:', e);
    pInitDemo();
  }
}

function pMostrarVinculacion() {
  // Reemplazar dashboard con pantalla de vinculación
  const dash = document.getElementById('p-page-dashboard');
  if (!dash) return;
  dash.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:32px 24px;text-align:center;">
      <div style="font-size:56px;margin-bottom:16px;">👨‍👩‍👧</div>
      <div style="font-family:'Fraunces',serif;font-size:22px;font-weight:700;color:white;margin-bottom:8px;">Bienvenido/a a SIEMBRA</div>
      <div style="font-size:14px;color:rgba(255,255,255,.6);margin-bottom:28px;line-height:1.7;max-width:300px;">
        Tu cuenta aún no está vinculada a ningún alumno.<br>
        Pide a la secretaría de tu escuela el código de vinculación.
      </div>
      <div style="background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.15);border-radius:16px;padding:24px;width:100%;max-width:320px;margin-bottom:20px;">
        <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Tengo un código de vinculación</div>
        <input id="p-vinc-code" type="text" placeholder="ABC-123" maxlength="10"
          style="width:100%;padding:12px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.2);border-radius:10px;color:white;font-family:'Fraunces',serif;font-size:24px;text-align:center;letter-spacing:4px;text-transform:uppercase;outline:none;margin-bottom:12px;"
          oninput="this.value=this.value.toUpperCase()">
        <button onclick="pVincularConCodigo()" style="width:100%;padding:12px;background:white;color:#0d5c2f;border:none;border-radius:10px;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">
          Vincular →
        </button>
        <div id="p-vinc-error" style="display:none;color:#fca5a5;font-size:12px;margin-top:8px;"></div>
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,.4);">
        ¿No tienes código? Contacta a la secretaría de la escuela.
      </div>
    </div>`;
}

async function pVincularConCodigo() {
  const code = document.getElementById('p-vinc-code')?.value.trim().toUpperCase();
  const errEl = document.getElementById('p-vinc-error');
  if (!code) { if(errEl){errEl.textContent='Ingresa el código';errEl.style.display='block';} return; }

  try {
    // Buscar código en tabla vinculos_padre o invitaciones
    const { data: vinc } = await sb.from('vinculos_padre')
      .select('*').eq('codigo', code).eq('usado', false).single();

    if (!vinc) throw new Error('Código inválido o ya usado');

    // Crear vínculo padre-alumno
    const { error } = await sb.from('padre_alumno').insert({
      padre_id: currentPerfil.id,
      alumno_id: vinc.alumno_id,
      activo: true,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;

    // Marcar código como usado
    await sb.from('vinculos_padre').update({ usado: true, padre_id: currentPerfil.id })
      .eq('id', vinc.id);

    hubToast('✅ Vinculado correctamente', 'ok');
    pInit(); // Recargar
  } catch(e) {
    if(errEl){ errEl.textContent = e.message; errEl.style.display='block'; }
  }
}

function pRenderSelectorHijos(alumnosPadre) {
  // Agregar selector de hijo en el topbar del portal padre
  const nameEl = document.getElementById('p-alumno-nombre');
  if (!nameEl) return;
  const wrap = nameEl.parentElement;
  const existing = document.getElementById('p-hijo-selector');
  if (existing) return;

  const div = document.createElement('div');
  div.style.cssText = 'margin-top:6px;';
  div.innerHTML = `<select id="p-hijo-selector" onchange="pCambiarHijo(this.value)"
    style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:6px;
           color:white;font-family:'Sora',sans-serif;font-size:11px;padding:3px 8px;cursor:pointer;outline:none;">
    ${alumnosPadre.map((a,i) => {
      const nom = (a.nombre + ' ' + (a.apellido_p||'')).trim();
      return `<option value="${i}" style="color:#333;">${nom}</option>`;
    }).join('')}
  </select>`;
  wrap.appendChild(div);
}

async function pCambiarHijo(idx) {
  const alumno = window._alumnosPadre?.[parseInt(idx)];
  if (!alumno) return;
  await pSetAlumno(alumno);
  hubToast(`✅ Viendo a ${alumno.nombre}`, 'ok');
}

function pInitDemo() {
  const demo = { id: null, nombre: 'Alumno', apellido_p: 'Demo', num_lista: 1 };
  window._alumnosPadre = [demo];
  pSetAlumno(demo);
}

async function pSetAlumno(alumno) {
  window._alumnoActivoPadre = alumno;
  const nombre = `${alumno.nombre} ${alumno.apellido_p || ''}`.trim();
  const nameEl = document.getElementById('p-alumno-nombre');
  if (nameEl) nameEl.textContent = nombre;
  const avEl = document.getElementById('p-alumno-avatar-txt');
  if (avEl) avEl.textContent = nombre.charAt(0);
  // Actualizar subtítulo del análisis IA con el nombre real
  const iaSubEl = document.getElementById('p-ia-subtitle');
  if (iaSubEl) iaSubEl.textContent = `Análisis pedagógico · Basado en datos reales de ${nombre.split(' ')[0]}`;
  if (sb && alumno.id) {
    await pCargarCalificaciones(alumno.id);
    await pCargarAsistencia(alumno.id);
    // Cargar badge y alerta de recuperaciones en background
    padreCargarAlertaRecuperaciones(alumno.id);
    // Si es lunes, ofrecer generar plan semanal automáticamente
    const hoy = new Date();
    if (hoy.getDay() === 1) { // 1 = lunes
      setTimeout(() => { if (!padrePlanCargarGuardado()) padreGenerarPlanSemanal(); }, 1500);
    }
  } else {
    pRenderCalificacionesDemo();
  }
}

async function padreCargarAlertaRecuperaciones(alumnoId) {
  if (!sb || !alumnoId) return;
  try {
    const { data } = await sb.from('recuperaciones')
      .select('id, materia, fecha_examen, calificacion_original, estado, temas_ia, comentarios_docente')
      .eq('alumno_id', alumnoId)
      .eq('estado', 'pendiente')
      .order('fecha_examen', { ascending: true });
    const pendientes = data || [];
    // Badge en nav
    const badge = document.getElementById('p-recup-badge');
    if (badge) {
      if (pendientes.length) {
        badge.textContent = pendientes.length;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
    // Tarjeta en dashboard
    const alertEl = document.getElementById('p-dash-recup-alert');
    if (!alertEl) return;
    if (!pendientes.length) { alertEl.style.display = 'none'; return; }
    const prox = pendientes[0];
    const hoy = new Date().toISOString().split('T')[0];
    const diasRestantes = prox.fecha_examen
      ? Math.ceil((new Date(prox.fecha_examen+'T12:00:00') - new Date()) / 86400000)
      : null;
    const urgente = diasRestantes !== null && diasRestantes <= 3;
    const fechaFmt = prox.fecha_examen
      ? new Date(prox.fecha_examen+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'})
      : 'Sin fecha';
    alertEl.style.display = 'block';
    alertEl.innerHTML = `<div style="background:${urgente?'#fff7ed':'#fefce8'};border:1.5px solid ${urgente?'#f97316':'#eab308'};border-radius:14px;padding:16px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <div>
          <div style="font-size:13px;font-weight:800;color:${urgente?'#c2410c':'#713f12'};">${urgente?'⚠️':'📅'} Examen de recuperación${pendientes.length>1?' ('+pendientes.length+' pendientes)':''}</div>
          <div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:4px;">${prox.materia}</div>
          <div style="font-size:12px;color:${urgente?'#c2410c':'#713f12'};margin-top:2px;">${fechaFmt}${diasRestantes!==null?' · '+( diasRestantes<=0?'¡Hoy!':diasRestantes===1?'Mañana':'En '+diasRestantes+' días'):''}  · Cal. original: <strong>${prox.calificacion_original??'—'}</strong></div>
          ${prox.comentarios_docente?`<div style="font-size:11px;color:#475569;margin-top:6px;">📝 ${prox.comentarios_docente}</div>`:''}
        </div>
        <button onclick="padreNav('recuperaciones')" style="padding:8px 14px;background:${urgente?'#ea580c':'#ca8a04'};color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;">Ver guía →</button>
      </div>
    </div>`;
  } catch(e) { console.warn('[alertaRecup]', e.message); }
}

async function pCargarCalificaciones(alumnoId) {
  const { data } = await sb.from('calificaciones')
    .select('materia, trimestre, aspecto, calificacion')
    .eq('alumno_id', alumnoId).eq('ciclo', window.CICLO_ACTIVO);
  if (!data) return;
  const promedios = {};
  const _cfgP = _calCfg();
  MATERIAS_NEM.forEach(m => {
    promedios[m] = {};
    for (let i = 1; i <= _cfgP.num_periodos; i++) promedios[m][i] = null;
  });
  const agrupado = {};
  data.forEach(c => {
    const key = `${c.materia}__${c.trimestre}`;
    if (!agrupado[key]) agrupado[key] = { suma:0, n:0 };
    agrupado[key].suma += parseFloat(c.calificacion||0);
    agrupado[key].n++;
  });
  Object.keys(agrupado).forEach(key => {
    const [mat,trim] = key.split('__');
    if (promedios[mat]) promedios[mat][parseInt(trim)] = Math.round(agrupado[key].suma/agrupado[key].n*10)/10;
  });
  window._promediosPadre = promedios;
  pRenderCalificaciones(promedios);
}

function pRenderCalificacionesDemo() {
  const demo = {};
  MATERIAS_NEM.forEach(m => { demo[m] = { 1: (7+Math.random()*2).toFixed(1)*1, 2: null, 3: null }; });
  pRenderCalificaciones(demo);
}

function pRenderCalificaciones(promedios) {
  // p-mat-list no existe en el HTML — usar p-cals-lista que sí existe
  const matList = document.getElementById('p-mat-list') || document.getElementById('p-cals-lista');
  if (!matList) return;
  const emos = {'Matemáticas':'➕','Lengua Materna':'📖','Ciencias Naturales':'🔬','Historia':'🏛️','Geografía':'🌎','Formación Cívica':'⚖️','Ed. Física':'⚽','Artes':'🎨'};
  const trim = window._padreTriActual || 1;
  matList.innerHTML = MATERIAS_NEM.map(mat => {
    const cal = promedios[mat]?.[trim];
    const pct = cal ? Math.round((cal-5)/5*100) : 0;
    const color = !cal ? '#aaa' : cal>=9 ? '#22c55e' : cal>=7 ? '#3b82f6' : cal>=6 ? '#f59e0b' : '#ef4444';
    return `<div class="p-mat-row">
      <div class="p-mat-ico">${emos[mat]||'📚'}</div>
      <div class="p-mat-info"><div class="p-mat-nombre">${mat}</div><div class="p-mat-sub">${_calCfg().nombre_periodo} ${trim}</div></div>
      <div class="p-mat-cal" style="color:${color};">${cal ?? '—'}</div>
      <div class="p-mat-bar"><div class="p-mat-fill" style="width:${Math.max(0,pct)}%;background:${color};"></div></div>
    </div>`;
  }).join('');
  // Actualizar también el comparativo trimestral si existe
  const bimEl = document.getElementById('p-trim-chart');
  if (bimEl) {
    bimEl.innerHTML = MATERIAS_NEM.map(mat => {
      const cal = promedios[mat]?.[trim] ?? null;
      const pct = cal ? Math.round((cal/10)*100) : 0;
      const color = !cal ? '#aaa' : cal>=9 ? '#22c55e' : cal>=7 ? '#3b82f6' : cal>=6 ? '#f59e0b' : '#ef4444';
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:90px;font-size:12px;color:var(--texto-2,#666);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${emos[mat]||'📚'} ${mat}</div>
        <div style="flex:1;height:8px;background:#f0f0f0;border-radius:99px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:99px;transition:.5s;"></div>
        </div>
        <div style="width:30px;font-size:12px;font-weight:800;color:${color};text-align:right;">${cal ?? '—'}</div>
      </div>`;
    }).join('');
  }
  // Sincronizar PADRE_DATA.materias para que padreDash use datos reales
  PADRE_DATA.materias = MATERIAS_NEM.map((mat,i) => ({
    nombre: mat,
    ico: emos[mat] || '📚',
    cal: promedios[mat]?.[trim] ?? 0,
    trim: [promedios[mat]?.[1]??0, promedios[mat]?.[2]??0, promedios[mat]?.[3]??0],
    campo: '',
    color: '#3b82f6',
  }));
}

async function pCargarAsistencia(alumnoId) {
  const { data } = await sb.from('asistencia')
    .select('fecha,estado').eq('alumno_id', alumnoId)
    .order('fecha', { ascending:false }).limit(60);
  if (!data) return;
  const p=data.filter(r=>r.estado==='P').length, a=data.filter(r=>r.estado==='A').length;
  const pct=data.length ? Math.round((p)*100/data.length) : 100;
  const asEl=document.getElementById('p-asist-pct'); if(asEl) asEl.textContent=pct+'%';
  const pEl=document.getElementById('p-asist-p');   if(pEl) pEl.textContent=p;
  const aEl=document.getElementById('p-asist-a');   if(aEl) aEl.textContent=a;
}
