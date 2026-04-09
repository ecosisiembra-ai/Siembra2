// ══════════════════════════════════════════════════
// MÓDULO: SALONES + ACOMODO (integrado en Hub)
// ══════════════════════════════════════════════════
const ETIQUETAS_DOC = [
  {id:'distraido',label:'Distraído',clase:'etq-distraido',dot:'#f59e0b'},
  {id:'platicador',label:'Platicador',clase:'etq-platicador',dot:'#ec4899'},
  {id:'especial',label:'Atención especial',clase:'etq-especial',dot:'#8b5cf6'},
  {id:'listo',label:'Listo/Aplicado',clase:'etq-listo',dot:'#10b981'},
  {id:'timido',label:'Tímido/Callado',clase:'etq-timido',dot:'#0ea5e9'},
  {id:'inquieto',label:'Inquieto',clase:'etq-inquieto',dot:'#f97316'},
  {id:'lider',label:'Líder natural',clase:'etq-lider',dot:'#eab308'},
  {id:'creativo',label:'Creativo',clase:'etq-creativo',dot:'#a855f7'},
  {id:'agresivo',label:'Conducta difícil',clase:'etq-agresivo',dot:'#ef4444'},
  {id:'solidario',label:'Solidario',clase:'etq-solidario',dot:'#22c55e'},
  {id:'perfeccionista',label:'Perfeccionista',clase:'etq-perfeccionista',dot:'#84cc16'},
  {id:'impulsivo',label:'Impulsivo',clase:'etq-impulsivo',dot:'#fb923c'},
];

const COLORES_ALUMNO = ['#0d5c2f','#2563eb','#7c3aed','#dc2626','#0891b2','#d97706','#0f766e','#9333ea','#b91c1c','#166534','#1d4ed8','#15803d'];

let docSalones = [
  {id:'s1',nombre:'6° A',grado:6,escuela:'Escuela piloto 1',turno:'Matutino',ciclo:'2024-2025'},
  {id:'s2',nombre:'5° B',grado:5,escuela:'Escuela piloto 1',turno:'Vespertino',ciclo:'2024-2025'},
  {id:'s3',nombre:'4° A',grado:4,escuela:'Escuela piloto 2',turno:'Matutino',ciclo:'2024-2025'},
];
let docAlumnos = [
  {id:'a01',nombre:'Sofía',apellido:'Ramírez',etiquetas:['listo','lider'],color:'#0d5c2f'},
  {id:'a02',nombre:'Carlos',apellido:'González',etiquetas:['distraido','inquieto'],color:'#2563eb'},
  {id:'a03',nombre:'Ana',apellido:'Martínez',etiquetas:['timido','solidario'],color:'#7c3aed'},
  {id:'a04',nombre:'Luis',apellido:'Pérez',etiquetas:['platicador','impulsivo'],color:'#dc2626'},
  {id:'a05',nombre:'Valeria',apellido:'Torres',etiquetas:['listo','perfeccionista'],color:'#0891b2'},
  {id:'a06',nombre:'Diego',apellido:'Flores',etiquetas:['creativo','inquieto'],color:'#7c3aed'},
  {id:'a07',nombre:'Isabella',apellido:'López',etiquetas:['especial','timido'],color:'#9333ea'},
  {id:'a08',nombre:'Mateo',apellido:'Hernández',etiquetas:['agresivo','platicador'],color:'#b91c1c'},
  {id:'a09',nombre:'Camila',apellido:'Díaz',etiquetas:['listo','solidario'],color:'#166534'},
  {id:'a10',nombre:'Sebastián',apellido:'Ruiz',etiquetas:['distraido','lider'],color:'#1d4ed8'},
  {id:'a11',nombre:'Lucía',apellido:'Sánchez',etiquetas:['timido','creativo'],color:'#6d28d9'},
  {id:'a12',nombre:'Miguel',apellido:'Vargas',etiquetas:['platicador','lider'],color:'#0f766e'},
  {id:'a13',nombre:'Fernanda',apellido:'Castro',etiquetas:['especial','solidario'],color:'#7e22ce'},
  {id:'a14',nombre:'Rodrigo',apellido:'Morales',etiquetas:['inquieto','impulsivo'],color:'#c2410c'},
  {id:'a15',nombre:'Renata',apellido:'Jiménez',etiquetas:['listo','creativo'],color:'#0d5c2f'},
  {id:'a16',nombre:'Emilio',apellido:'Reyes',etiquetas:['distraido','timido'],color:'#374151'},
  {id:'a17',nombre:'Mariana',apellido:'Cruz',etiquetas:['solidario','lider'],color:'#065f46'},
  {id:'a18',nombre:'Andrés',apellido:'Ortega',etiquetas:['agresivo','inquieto'],color:'#991b1b'},
  {id:'a19',nombre:'Daniela',apellido:'Ramos',etiquetas:['listo','timido'],color:'#1e3a5f'},
  {id:'a20',nombre:'Tomás',apellido:'Mendoza',etiquetas:['platicador','creativo'],color:'#4a1d96'},
];
let salonActivoDoc = docSalones[0];
let docAcomodos = [];
let docGridState = [];
let docNotasGrid = {};
let docIAStrategy = 'pedagogico';
let docEditAlumnoId = null;
let docEditNotaKey = null;
let docDragSrc = null;

function getEtqDoc(id){ return ETIQUETAS_DOC.find(e=>e.id===id); }
function tagHTMLDoc(id){ const e=getEtqDoc(id);if(!e)return'';return`<span class="etq-tag ${e.clase}">${e.label}</span>`; }
function dotHTMLDoc(id){ const e=getEtqDoc(id);if(!e)return'';return`<span class="seat-dot" style="background:${e.dot}" title="${e.label}"></span>`; }

// ── Modales ──
function openMod(id){ document.getElementById(id).classList.add('mopen'); }
function closeMod(id){ document.getElementById(id).classList.remove('mopen'); }

function hubToastDoc(msg){
  if(typeof showToast==='function') showToast(msg);
  else if(typeof hubToast==='function') hubToast(msg);
  else { const t=document.getElementById('hub-toast');if(t){t.textContent=msg;t.style.transform='translateY(0)';t.style.opacity='1';setTimeout(()=>{t.style.transform='translateY(60px)';t.style.opacity='0';},3000);} }
}

// ── Poblar selects con salones ──
function poblarSelectSalones(){
  // FIX 2: usar grupos reales de Supabase si existen, si no usar demo
  const gruposReales = window._gruposDocente || [];
  const fuente = gruposReales.length
    ? gruposReales.map(g => ({
        id: g.id,
        nombre: g.nombre || (g.grado + '° ' + (g.seccion||'')).trim(),
        escuela: g.escuela_nombre || g.escuela_cct || 'Mi escuela'
      }))
    : docSalones;

  ['etq-salon-sel','aco-salon-sel'].forEach(id=>{
    const sel=document.getElementById(id); if(!sel)return;
    sel.innerHTML='<option value="">Seleccionar salón…</option>'+fuente.map(s=>`<option value="${s.id}" ${salonActivoDoc?.id===s.id?'selected':''}>${s.nombre} · ${s.escuela}</option>`).join('');
  });

  // Si hay grupos reales y no hay salonActivo aún, seleccionar el primero
  if (gruposReales.length && (!salonActivoDoc || !salonActivoDoc.id)) {
    const g = gruposReales[0];
    salonActivoDoc = { id: g.id, nombre: g.nombre || g.grado+'°', escuela: g.escuela_nombre || g.escuela_cct || '' };
  }
}

// ══ SALONES ══
function renderSalonesDoc(){
  const grid=document.getElementById('doc-salones-grid');
  const empty=document.getElementById('doc-salones-empty');

  // Usar grupos reales de Supabase o fallback a demo
  const gruposParaMostrar = (window._gruposDocente?.length
    ? window._gruposDocente.map(g => ({
        id: g.id,
        nombre: g.nombre || (g.grado + '° ' + (g.seccion||'')).trim(),
        grado: g.grado || '—',
        seccion: g.seccion || '',
        escuela: currentPerfil?.escuela_nombre || g.escuela_nombre || g.escuela_cct || 'Mi escuela',
        turno: g.turno || 'Matutino',
        ciclo: g.ciclo || window.CICLO_ACTIVO || '2025-2026',
        nivel: g.nivel || 'secundaria',
        materias: g.materias || []
      }))
    : docSalones);

  if (!gruposParaMostrar.length) {
    grid.style.display='none'; empty.style.display='';
    empty.innerHTML = `<div style="font-size:48px;margin-bottom:12px;">🏫</div>
      <div style="font-weight:700;font-size:15px;margin-bottom:6px;">Sin grupos asignados</div>
      <div style="font-size:13px;">La secretaría debe asignarte grupos desde el portal de administración.</div>`;
    return;
  }
  grid.style.display=''; empty.style.display='none';

  const TURNO_ICO = { 'Matutino':'🌅', 'Vespertino':'🌇', 'Nocturno':'🌙' };
  const NIVEL_COLOR = { primaria: { stripe:'#3b82f6,#60a5fa,#93c5fd', badge:'#dbeafe', badgeText:'#1d4ed8', ico:'📚' },
                        secundaria:{ stripe:'#2db55d,#52c27a,#8de8a4', badge:'#dcfce7', badgeText:'#15803d', ico:'🏫' } };

  grid.innerHTML = gruposParaMostrar.map(s => {
    const esActivo = salonActivoDoc?.id === s.id;
    const alumnosCount = window._alumnosCountPorGrupo?.[s.id]
      ?? (esActivo ? (window._alumnosActivos?.length ?? 0) : 0);
    const etiqCount = esActivo
      ? (window._alumnosActivos || docAlumnos).filter(a=>a.etiquetas?.length>0).length
      : 0;
    const nv = NIVEL_COLOR[s.nivel] || NIVEL_COLOR.secundaria;
    const turnoLabel = s.turno || 'Matutino';
    const turnoIco = TURNO_ICO[turnoLabel] || '🌅';
    const materias = s.materias?.length ? s.materias : (window._docenteAsignaciones || [])
      .filter(a => a.grupo_id === s.id).map(a => a.materia).filter(Boolean);
    const materiasLabel = materias.length
      ? materias.slice(0,3).join(' · ') + (materias.length > 3 ? ` +${materias.length-3}` : '')
      : 'Materias asignadas por admin';
    const nivelLabel = s.nivel === 'primaria' ? 'Primaria' : 'Secundaria';

    return `
    <div class="salon-card ${esActivo?'sc-active':''}" onclick="selSalonDoc('${s.id}')" style="${esActivo?'border-color:var(--verde);box-shadow:0 8px 28px rgba(13,92,47,.18);':''}">
      <div class="salon-card-stripe" style="background:linear-gradient(90deg,${nv.stripe});height:7px;"></div>
      <div class="salon-card-top" style="padding:18px 18px 10px;">
        <div class="salon-card-ico" style="background:linear-gradient(145deg,${nv.badge},${nv.badge});font-size:26px;">${nv.ico}</div>
        <div class="salon-card-info">
          <div class="salon-card-nombre" style="font-size:26px;">${s.nombre}</div>
          <div class="salon-card-escuela" style="margin-top:2px;">📍 ${s.escuela}&nbsp;·&nbsp;${s.ciclo}</div>
          <div style="margin-top:5px;font-size:11px;color:#5a7060;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${materias.join(', ')}">📖 ${materiasLabel}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;">
          <div class="salon-card-badge" style="background:${nv.badge};color:${nv.badgeText};border-color:${nv.badge};">${turnoIco} ${turnoLabel}</div>
          <div style="font-size:9px;font-weight:800;padding:3px 8px;border-radius:20px;background:#f1f5f9;color:#64748b;text-transform:uppercase;letter-spacing:.4px;">${nivelLabel}</div>
        </div>
      </div>
      <div class="salon-card-stats">
        <div class="salon-stat-col">
          <div class="salon-stat-num">${alumnosCount}</div>
          <div class="salon-stat-lbl">Alumnos</div>
        </div>
        <div class="salon-stat-col">
          <div class="salon-stat-num">${s.grado}°</div>
          <div class="salon-stat-lbl">Grado</div>
        </div>
        <div class="salon-stat-col">
          <div class="salon-stat-num">${etiqCount}</div>
          <div class="salon-stat-lbl">Etiquetados</div>
        </div>
      </div>
      <div class="salon-card-actions">
        <button class="salon-card-btn" onclick="event.stopPropagation();docIrAGrupo('etiquetas','${s.id}',()=>cambiarSalonEtq('${s.id}'))">👥 Alumnos</button>
        <button class="salon-card-btn" onclick="event.stopPropagation();docIrAGrupo('tareas','${s.id}')">🎯 Actividades</button>
        <button class="salon-card-btn" onclick="event.stopPropagation();dNav('acomodo');cambiarSalonAco('${s.id}')">🪑 Acomodo</button>
        <button class="salon-card-btn" onclick="event.stopPropagation();docIrAGrupo('calificaciones','${s.id}')" style="color:var(--verde);font-weight:800;">📊 Calificar</button>
      </div>
    </div>`;
  }).join('');
}

// Carga el conteo de alumnos para todos los grupos en background
async function salonesCargarCuentas() {
  if (!sb || !currentPerfil) return;
  const grupos = window._gruposDocente || [];
  if (!grupos.length) return;
  if (!window._alumnosCountPorGrupo) window._alumnosCountPorGrupo = {};
  let actualizado = false;
  for (const g of grupos) {
    if (window._alumnosCountPorGrupo[g.id] !== undefined) continue; // ya cargado
    try {
      const { count } = await sb.from('alumnos_grupos')
        .select('id', { count: 'exact', head: true })
        .eq('grupo_id', g.id).eq('activo', true);
      window._alumnosCountPorGrupo[g.id] = count || 0;
      actualizado = true;
    } catch(_) {}
  }
  if (actualizado) renderSalonesDoc();
}

function selSalonDoc(id){
  // Buscar en grupos reales primero
  const grupoReal = (window._gruposDocente||[]).find(g=>g.id===id);
  if (grupoReal) {
    window._grupoActivo = grupoReal.id;
    if (grupoReal.nivel) {
      window._nivelActivo = grupoReal.nivel;
    }
    salonActivoDoc = { id: grupoReal.id, nombre: grupoReal.nombre || (grupoReal.grado+'° '+(grupoReal.seccion||'')).trim(), escuela: grupoReal.escuela_nombre || grupoReal.escuela_cct || '' };
  } else {
    salonActivoDoc = docSalones.find(s=>s.id===id) || salonActivoDoc;
  }
  renderSalonesDoc();
  hubToastDoc('✅ Grupo '+(salonActivoDoc?.nombre||'')+ ' seleccionado');
}

function abrirModalSalon(){
  hubToast('ℹ️ Los grupos son asignados por la secretaría. Contacta al administrador.', 'warn');
}

function guardarSalonDoc(){
  hubToast('ℹ️ Operación no permitida. Los grupos son asignados por la secretaría.', 'warn');
}

function eliminarSalonDoc(id){
  hubToast('ℹ️ No puedes eliminar grupos. Contacta a la secretaría.', 'warn');
}

// ══ ALUMNOS Y ETIQUETAS ══
async function cambiarSalonEtq(id){
  // FIX 3: buscar primero en grupos reales de Supabase, luego en demo
  const gruposReales = window._gruposDocente || [];
  if (id) {
    const grupoReal = gruposReales.find(g => g.id === id);
    if (grupoReal) {
      salonActivoDoc = {
        id: grupoReal.id,
        nombre: grupoReal.nombre || (grupoReal.grado+'°'),
        escuela: grupoReal.escuela_nombre || grupoReal.escuela_cct || ''
      };
    } else {
      salonActivoDoc = docSalones.find(s=>s.id===id) || salonActivoDoc;
    }
  }
  document.getElementById('etq-salon-nombre').textContent = salonActivoDoc?.nombre || '—';
  window._grupoActivo = salonActivoDoc?.id || window._grupoActivo;

  // FIX 3: Cargar alumnos REALES de Supabase para este grupo
  docAlumnos.length = 0; // siempre limpiar antes de cargar el nuevo grupo
  if (typeof sb !== 'undefined' && sb && salonActivoDoc?.id) {
    try {
      const alumnosDB = await calCargarAlumnosGrupo(salonActivoDoc.id);
      if (alumnosDB.length) {
        const COLORES = ['#0d5c2f','#2563eb','#7c3aed','#dc2626','#0891b2','#c2410c','#065f46','#1d4ed8','#166534','#b91c1c'];

        // Cargar etiquetas guardadas para este grupo
        let etiquetasMap = {};
        try {
          const { data: etqData } = await sb.from('alumno_etiquetas')
            .select('alumno_id, etiquetas')
            .eq('grupo_id', salonActivoDoc.id);
          if (etqData?.length) {
            etqData.forEach(r => { etiquetasMap[r.alumno_id] = r.etiquetas || []; });
          }
        } catch(e2) {
          // Fallback: leer localStorage
          alumnosDB.forEach(a => {
            try {
              const raw = localStorage.getItem('etq_' + a.id + '_' + salonActivoDoc.id);
              if (raw) etiquetasMap[a.id] = JSON.parse(raw);
            } catch(_) {}
          });
        }

        ordenarAlumnosPorApellido(alumnosDB).forEach((a, i) => {
          const partes = alumnoNombrePartes(a);
          docAlumnos.push({
            id: a.id,
            nombre: partes.nombre || 'Alumno',
            apellido_p: partes.apellidoP || '',
            apellido_m: partes.apellidoM || '',
            nombre_lista: alumnoNombreLista(a),
            iniciales: alumnoIniciales(a),
            etiquetas: etiquetasMap[a.id] || [],
            color: COLORES[i % COLORES.length]
          });
        });
      }
    } catch(e) {
      console.warn('[cambiarSalonEtq] Error cargando alumnos reales:', e.message);
    }
  }

  renderAlumnosDoc();
}

function renderAlumnosDoc(){
  document.getElementById('etq-count').textContent=docAlumnos.length+' alumnos';
  const list=document.getElementById('doc-alumnos-list');
  if(!docAlumnos.length){list.innerHTML='<div style="text-align:center;padding:40px;color:var(--gris-50);">Sin alumnos</div>';return;}
  list.innerHTML=docAlumnos.map(a=>`
    <div class="alumno-row">
      <div class="alumno-av" style="background:${a.color}">${a.iniciales || alumnoIniciales(a)}</div>
      <div style="flex:1;font-size:14px;font-weight:600;">${a.nombre_lista || alumnoNombreLista(a)}</div>
      <div class="alumno-tags">${a.etiquetas.map(tagHTMLDoc).join('')}</div>
      <button class="btn btn-outline btn-sm" onclick="abrirEtqDoc('${a.id}')">🏷️</button>
    </div>
  `).join('');
}

function abrirEtqDoc(alumnoId){
  docEditAlumnoId=alumnoId;
  const a=docAlumnos.find(x=>x.id===alumnoId); if(!a)return;
  document.getElementById('modal-alumno-nm').textContent=a.nombre_lista || alumnoNombreLista(a);
  document.getElementById('etq-selector-doc').innerHTML=ETIQUETAS_DOC.map(e=>`
    <div class="etq-chip-sel etq-tag ${e.clase} ${a.etiquetas.includes(e.id)?'etq-selected':''}"
         onclick="this.classList.toggle('etq-selected')" data-id="${e.id}">${e.label}</div>
  `).join('');
  openMod('modal-alumno-ov');
}

async function guardarEtiquetasDoc(){
  const a=docAlumnos.find(x=>x.id===docEditAlumnoId); if(!a)return;
  a.etiquetas=[...document.querySelectorAll('#etq-selector-doc .etq-selected')].map(el=>el.dataset.id);
  closeMod('modal-alumno-ov');
  renderAlumnosDoc();
  renderUnassignedDoc();

  // FIX 3: Persistir etiquetas en Supabase si está disponible
  if (typeof sb !== 'undefined' && sb && a.id) {
    try {
      await sb.from('alumno_etiquetas').upsert({
        alumno_id: a.id,
        grupo_id: salonActivoDoc?.id || window._grupoActivo || null,
        etiquetas: a.etiquetas,
        actualizado_en: new Date().toISOString()
      }, { onConflict: 'alumno_id,grupo_id' });
    } catch(e) {
      // Si la tabla no existe aún, guardar en localStorage como fallback
      try {
        const key = 'etq_' + a.id + '_' + (salonActivoDoc?.id || '');
        localStorage.setItem(key, JSON.stringify(a.etiquetas));
      } catch(_) {}
      console.warn('[guardarEtiquetasDoc] Supabase no disponible, guardado local:', e.message);
    }
  }

  hubToastDoc('✅ Etiquetas guardadas para '+a.nombre);
}

// ══ ETIQUETAS MULTI-GRUPO (acordeón) ══
let _etqGruposCache = {}; // grupoId → [{id, nombre, apellido, etiquetas, color}]

async function renderEtiquetasMultiGrupo(forceReload) {
  const container = document.getElementById('etq-grupos-accordion');
  if (!container) return;
  const grupos = window._gruposDocente || [];
  if (!grupos.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gris-50);font-size:13px;">Sin grupos asignados. El administrador debe asignarte grupos.</div>';
    return;
  }
  if (forceReload) _etqGruposCache = {};

  // Render skeleton while loading
  container.innerHTML = grupos.map((g,i) => {
    const nombre = g.nombre || (g.grado+'° '+g.seccion).trim();
    return `<div class="card" style="margin-bottom:12px;padding:0;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;user-select:none;" onclick="etqToggleGrupo('${g.id}')">
        <div style="width:36px;height:36px;background:var(--verde-light);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🏫</div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:700;color:var(--texto);">${nombre}</div>
          <div style="font-size:11px;color:var(--gris-50);" id="etq-g-count-${g.id}">Cargando…</div>
        </div>
        <div style="font-size:18px;transition:.2s;color:var(--gris-50);" id="etq-g-arrow-${g.id}">›</div>
      </div>
      <div id="etq-g-body-${g.id}" style="display:none;border-top:1px solid var(--gris-10);padding:12px 14px;"></div>
    </div>`;
  }).join('');

  // Load all groups in parallel
  await Promise.all(grupos.map(g => etqCargarGrupo(g)));
}

async function etqCargarGrupo(g) {
  if (!g?.id) return;
  const nombre = g.nombre || (g.grado+'° '+g.seccion).trim();
  const countEl = document.getElementById('etq-g-count-'+g.id);

  if (!_etqGruposCache[g.id]) {
    try {
      const alumnos = await calCargarAlumnosGrupo(g.id);
      let etiquetasMap = {};
      try {
        const { data: etqData } = await sb.from('alumno_etiquetas').select('alumno_id, etiquetas').eq('grupo_id', g.id);
        etqData?.forEach(r => { etiquetasMap[r.alumno_id] = r.etiquetas || []; });
      } catch(_) {
        alumnos.forEach(a => {
          try { const raw = localStorage.getItem('etq_'+a.id+'_'+g.id); if (raw) etiquetasMap[a.id] = JSON.parse(raw); } catch(_){}
        });
      }
      const COLORES = ['#0d5c2f','#2563eb','#7c3aed','#dc2626','#0891b2','#c2410c','#065f46','#1d4ed8'];
      _etqGruposCache[g.id] = alumnos.map((a, i) => {
        const partes = (a.n||'').split(' ');
        return { id:a.id, nombre:partes[0]||'Alumno', apellido:partes.slice(1).join(' ')||'', etiquetas:etiquetasMap[a.id]||[], color:COLORES[i%COLORES.length] };
      });
    } catch(e) { _etqGruposCache[g.id] = []; }
  }

  const alumnos = _etqGruposCache[g.id] || [];
  if (countEl) countEl.textContent = alumnos.length + ' alumno' + (alumnos.length!==1?'s':'') + ' · ' + alumnos.filter(a=>a.etiquetas.length>0).length + ' con etiquetas';
  _etqRenderGrupoBody(g.id, alumnos);
}

function _etqRenderGrupoBody(grupoId, alumnos) {
  const bodyEl = document.getElementById('etq-g-body-'+grupoId);
  if (!bodyEl) return;
  if (!alumnos.length) {
    bodyEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--gris-50);font-size:13px;">Sin alumnos en este grupo</div>';
    return;
  }
  bodyEl.innerHTML = alumnos.map(a => `
    <div class="alumno-row" style="margin-bottom:8px;">
      <div class="alumno-av" style="background:${a.color}">${a.nombre[0]}${(a.apellido||'_')[0]}</div>
      <div style="flex:1;font-size:14px;font-weight:600;">${a.nombre} ${a.apellido}</div>
      <div class="alumno-tags">${a.etiquetas.map(tagHTMLDoc).join('')}</div>
      <button class="btn btn-outline btn-sm" onclick="etqAbrirDesdeGrupo('${a.id}','${grupoId}')" title="Editar etiquetas">🏷️</button>
    </div>
  `).join('');
}

function etqToggleGrupo(grupoId) {
  const body = document.getElementById('etq-g-body-'+grupoId);
  const arrow = document.getElementById('etq-g-arrow-'+grupoId);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(90deg)';
}

function etqAbrirDesdeGrupo(alumnoId, grupoId) {
  // Set active group context so guardarEtiquetasDoc uses the right grupo_id
  salonActivoDoc = { id: grupoId, nombre: '', escuela: '' };
  window._grupoActivo = grupoId;
  // Load docAlumnos from cache so the existing modal function works
  docAlumnos.length = 0;
  (_etqGruposCache[grupoId]||[]).forEach(a => docAlumnos.push({...a}));
  abrirEtqDoc(alumnoId);
  // After save, refresh this group's body
  window._etqPostSaveGrupoId = grupoId;
}

// Patch guardarEtiquetasDoc to refresh multi-group view after save
const _guardarEtiquetasDocOrig = window.guardarEtiquetasDoc;
window.guardarEtiquetasDoc = async function() {
  await _guardarEtiquetasDocOrig?.();
  const grupoId = window._etqPostSaveGrupoId || salonActivoDoc?.id;
  if (grupoId && _etqGruposCache[grupoId]) {
    // Update cache from docAlumnos (which was mutated by guardarEtiquetasDoc)
    const updated = docAlumnos.find(a => a.id === docEditAlumnoId);
    if (updated) {
      const cacheItem = _etqGruposCache[grupoId].find(a => a.id === docEditAlumnoId);
      if (cacheItem) cacheItem.etiquetas = [...updated.etiquetas];
    }
    _etqRenderGrupoBody(grupoId, _etqGruposCache[grupoId]);
    const countEl = document.getElementById('etq-g-count-'+grupoId);
    if (countEl) {
      const alumnos = _etqGruposCache[grupoId];
      countEl.textContent = alumnos.length + ' alumno' + (alumnos.length!==1?'s':'') + ' · ' + alumnos.filter(a=>a.etiquetas.length>0).length + ' con etiquetas';
    }
  }
};

// ══ ACOMODO ══
function cambiarSalonAco(id){
  // buscar en grupos reales primero, luego en demo
  if (id) {
    const grupoReal = (window._gruposDocente || []).find(g => g.id === id);
    if (grupoReal) {
      salonActivoDoc = {
        id: grupoReal.id,
        nombre: grupoReal.nombre || (grupoReal.grado + '° ' + (grupoReal.seccion||'')).trim(),
        escuela: grupoReal.escuela_nombre || grupoReal.escuela_cct || ''
      };
    } else {
      salonActivoDoc = docSalones.find(s=>s.id===id) || salonActivoDoc;
    }
  }
  document.getElementById('acomodo-salon-label').textContent=(salonActivoDoc?.nombre||'—')+' · '+(salonActivoDoc?.escuela||'');
  const pizGrupo = document.getElementById('aco-pizarron-grupo');
  if (pizGrupo) pizGrupo.textContent = salonActivoDoc?.nombre || '';
  try{const raw=localStorage.getItem('aco_'+salonActivoDoc?.id);docAcomodos=raw?JSON.parse(raw):[];}catch(e){docAcomodos=[];}
  // Limpiar grid para el nuevo grupo
  docGridState = [];
  renderSavedListDoc();
  // Cargar alumnos del grupo si cambió
  const gid = salonActivoDoc?.id;
  if (gid && gid !== window._acoGrupoId && sb && currentPerfil) {
    window._acoGrupoId = gid;
    cargarAlumnosGrupo(gid).then(data => {
      if (data?.length) {
        docAlumnos.length = 0;
        data.forEach(a => docAlumnos.push({ id: a.id, nombre: [a.nombre, a.apellido_p].filter(Boolean).join(' '), etiquetas: a.etiquetas || [], color: '#2db55d' }));
      }
      regenGrid();
    }).catch(() => regenGrid());
  } else {
    regenGrid();
  }
}

function regenGrid(){
  const filas=parseInt(document.getElementById('aco-filas')?.value)||5;
  const cols=parseInt(document.getElementById('aco-cols')?.value)||6;
  // Siempre reiniciar grid si dimensiones cambian o está vacío
  if(!docGridState.length||docGridState.length!==filas||(docGridState[0]||[]).length!==cols){
    docGridState=Array.from({length:filas},()=>Array(cols).fill(null));
  }
  renderGridDoc();
  renderUnassignedDoc();
}

function renderGridDoc(){
  const filas=parseInt(document.getElementById('aco-filas')?.value)||5;
  const cols=parseInt(document.getElementById('aco-cols')?.value)||6;
  const wrap=document.getElementById('aco-grid-filas'); if(!wrap)return;
  wrap.innerHTML='';
  for(let f=0;f<filas;f++){
    const fila=document.createElement('div');
    fila.className='grid-fila-doc';
    fila.style.gridTemplateColumns=`repeat(${cols},1fr)`;
    for(let c=0;c<cols;c++){
      fila.appendChild(crearAsientoDoc(f,c,(docGridState[f]||[])[c]||null));
    }
    wrap.appendChild(fila);
    if(f<filas-1&&(f+1)%2===0){
      const aisle=document.createElement('div');
      aisle.className='aisle-strip-doc';
      for(let c=0;c<cols;c++){const ac=document.createElement('div');ac.className='aisle-cell-doc';aisle.appendChild(ac);}
      wrap.appendChild(aisle);
    }
  }
}

function crearAsientoDoc(fila,col,alumnoId){
  const seat=document.createElement('div');
  const key=`${fila}_${col}`;
  seat.className='aco-grid-cell '+(alumnoId?'occupied':'');
  seat.dataset.fila=fila; seat.dataset.col=col; seat.dataset.key=key;
  if(alumnoId) seat.dataset.alumnoId=alumnoId;
  if(alumnoId){
    const a=docAlumnos.find(x=>x.id===alumnoId);
    if(a){
      const nota=docNotasGrid[key];
      // Get level badge color
      const prom = typeof calPromPonderado==='function' && CAL_DATA && Object.keys(CAL_DATA).length
        ? MATERIAS_NEM.reduce((s,m)=>s+calPromPonderado(docAlumnos.indexOf(a),m,1),0)/MATERIAS_NEM.length : 7.5;
      const nivCol = prom>=8?'#dcfce7':prom>=6?'#fef9c3':'#fee2e2';
      const nivTc  = prom>=8?'#15803d':prom>=6?'#a16207':'#b91c1c';
      const inis = a.nombre[0]+((a.apellido||'')[0]||'');
      const etqDots = a.etiquetas.slice(0,3).map(id=>{
        const e=getEtqDoc(id); return e?`<span style="width:7px;height:7px;border-radius:50%;background:${e.color||'#ccc'};display:inline-block;"></span>`:'';
      }).join('');
      // Color del asiento basado en la primera etiqueta dominante
      const borderColor = a.color || '#2db55d';
      seat.style.borderColor = borderColor;
      seat.style.borderWidth = '2px';
      seat.style.background = `${borderColor}12`;
      seat.innerHTML=`
        <button class="aco-cell-remove" onclick="event.stopPropagation();docGridState[${fila}][${col}]=null;renderGridDoc();renderUnassignedDoc();" aria-label="Cerrar">✕</button>
        <div class="aco-cell-av" style="background:${a.color||borderColor};">${inis.toUpperCase()}</div>
        <div class="aco-cell-name">${a.nombre}</div>
        <div class="aco-cell-tag">${etqDots}</div>
        ${nota?`<div style="position:absolute;top:3px;left:3px;font-size:10px;" title="${nota}">📝</div>`:''}
      `;
    }
  } else {
    seat.innerHTML='<div class="aco-cell-plus">+</div>';
  }
  seat.draggable=true;
  seat.addEventListener('dragstart',docDragStart);
  seat.addEventListener('dragover',docDragOver);
  seat.addEventListener('drop',docDrop);
  seat.addEventListener('dragleave',()=>seat.classList.remove('drag-over'));
  seat.addEventListener('dblclick',e=>{e.stopPropagation();if(!seat.dataset.alumnoId)return;docGridState[fila][col]=null;renderGridDoc();renderUnassignedDoc();});
  seat.addEventListener('click',()=>{if(seat.dataset.alumnoId)abrirEtqDoc(seat.dataset.alumnoId);});
  return seat;
}

function docDragStart(e){
  docDragSrc=this; this.style.opacity='.4';
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',JSON.stringify({fila:parseInt(this.dataset.fila??-1),col:parseInt(this.dataset.col??-1),alumnoId:this.dataset.alumnoId||this.dataset.unassId||null,fromUnass:!!this.dataset.unassId}));
}
function docDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='move';this.classList.add('drag-over');}
function docDrop(e){
  e.preventDefault();this.classList.remove('drag-over');
  if(docDragSrc)docDragSrc.style.opacity='1';
  try{
    const src=JSON.parse(e.dataTransfer.getData('text/plain'));
    const df=parseInt(this.dataset.fila),dc=parseInt(this.dataset.col);
    const destId=this.dataset.alumnoId||null, srcId=src.alumnoId;
    if(!srcId)return;
    if(src.fromUnass){docGridState[df][dc]=srcId;}
    else{docGridState[df][dc]=srcId;if(src.fila>=0)docGridState[src.fila][src.col]=destId;}
    renderGridDoc();renderUnassignedDoc();
  }catch(err){}
  docDragSrc=null;
}

function renderUnassignedDoc(){
  const asignados=new Set(docGridState.flat().filter(Boolean));
  const sinAsignar=docAlumnos.filter(a=>!asignados.has(a.id));
  const el=document.getElementById('aco-unassigned-count');if(el)el.textContent=sinAsignar.length;
  const list=document.getElementById('aco-unassigned-list');if(!list)return;
  if(!sinAsignar.length){list.innerHTML='<div style="padding:10px 0;font-size:12px;color:#15803d;font-weight:700;display:flex;align-items:center;gap:8px;"><span style="font-size:18px;">🎉</span> ¡Todos los alumnos asignados!</div>';return;}
  list.innerHTML=sinAsignar.map(a=>{
    const etiqDots = (a.etiquetas||[]).slice(0,3).map(id=>{
      const e=getEtqDoc(id); return e?`<span style="width:8px;height:8px;border-radius:50%;background:${e.color||'#ccc'};display:inline-block;border:1px solid rgba(255,255,255,.5);"></span>`:'';
    }).join('');
    return `<div class="unassigned-pill" draggable="true" data-unass-id="${a.id}"
         title="${(a.etiquetas||[]).map(id=>getEtqDoc(id)?.label||id).join(', ')||'Sin etiquetas'}"
         style="border-radius:12px;padding:8px 12px;background:white;border:2px solid ${a.color||'#e2e8f0'};box-shadow:0 2px 8px rgba(0,0,0,.08);">
      <span style="width:28px;height:28px;border-radius:50%;background:${a.color||'#2db55d'};display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:white;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,.2);">${(a.nombre||'?')[0].toUpperCase()}</span>
      <span style="font-size:11px;font-weight:700;color:#1e293b;">${a.nombre}</span>
      ${etiqDots ? `<span style="display:flex;gap:2px;align-items:center;">${etiqDots}</span>` : ''}
    </div>`;
  }).join('');
  list.querySelectorAll('.unassigned-pill').forEach(chip=>{
    const aid = chip.dataset.unassId || chip.dataset.unassid;
    chip.addEventListener('dragstart',function(e){
      docDragSrc=this; this.style.opacity='.5';
      e.dataTransfer.setData('text/plain',JSON.stringify({fila:-1,col:-1,alumnoId:aid,fromUnass:true}));
    });
    chip.addEventListener('dragend',()=>chip.style.opacity='1');
  });
}

// ── Notas ──
function abrirNotaDoc(e,key){
  e.stopPropagation();
  docEditNotaKey=key;
  document.getElementById('nota-doc-text').value=docNotasGrid[key]||'';
  openMod('modal-nota-ov');
}
function guardarNotaDoc(){
  const txt=document.getElementById('nota-doc-text').value.trim();
  if(docEditNotaKey){if(txt)docNotasGrid[docEditNotaKey]=txt;else delete docNotasGrid[docEditNotaKey];}
  closeMod('modal-nota-ov');renderGridDoc();hubToastDoc('📝 Nota guardada');
}

// ── Guardar / cargar acomodos ──
function guardarAcomodoDoc(){
  if(!salonActivoDoc){hubToastDoc('⚠️ Selecciona un salón');return;}
  const nombre=document.getElementById('aco-nombre').value.trim()||'Acomodo '+new Date().toLocaleDateString('es-MX');
  const nuevo={id:'a_'+Date.now(),nombre,filas:parseInt(document.getElementById('aco-filas').value),cols:parseInt(document.getElementById('aco-cols').value),grid:JSON.parse(JSON.stringify(docGridState)),notas:JSON.parse(JSON.stringify(docNotasGrid)),fecha:new Date().toISOString()};
  docAcomodos=docAcomodos.filter(a=>a.nombre!==nombre);
  docAcomodos.unshift(nuevo);
  try{localStorage.setItem('aco_'+salonActivoDoc.id,JSON.stringify(docAcomodos));}catch(e){}
  renderSavedListDoc();hubToastDoc('💾 Acomodo "'+nombre+'" guardado');
}

function cargarAcomodoDoc(id){
  const a=docAcomodos.find(x=>x.id===id);if(!a)return;
  document.getElementById('aco-filas').value=a.filas;
  document.getElementById('aco-cols').value=a.cols;
  document.getElementById('aco-nombre').value=a.nombre;
  docGridState=JSON.parse(JSON.stringify(a.grid));
  docNotasGrid=JSON.parse(JSON.stringify(a.notas||{}));
  renderGridDoc();renderUnassignedDoc();renderSavedListDoc(id);
  hubToastDoc('📂 Cargado: '+a.nombre);
}

function borrarAcomodoDoc(id){
  docAcomodos=docAcomodos.filter(a=>a.id!==id);
  try{localStorage.setItem('aco_'+salonActivoDoc?.id,JSON.stringify(docAcomodos));}catch(e){}
  renderSavedListDoc();
}

function renderSavedListDoc(activeId){
  const wrap=document.getElementById('doc-saved-list');if(!wrap)return;
  if(!docAcomodos.length){wrap.innerHTML='<span style="font-size:12px;color:var(--gris-50)">Sin acomodos guardados</span>';return;}
  wrap.innerHTML=docAcomodos.map(a=>`
    <div class="saved-chip ${a.id===activeId?'sav-active':''}" onclick="cargarAcomodoDoc('${a.id}')">
      🪑 ${a.nombre}
      <span class="sdel" onclick="event.stopPropagation();borrarAcomodoDoc('${a.id}')">✕</span>
    </div>
  `).join('');
}

function limpiarGridDoc(){
  if(!confirm('¿Limpiar todos los asientos?'))return;
  const filas=parseInt(document.getElementById('aco-filas').value)||5;
  const cols=parseInt(document.getElementById('aco-cols').value)||6;
  docGridState=Array.from({length:filas},()=>Array(cols).fill(null));
  docNotasGrid={};
  renderGridDoc();renderUnassignedDoc();hubToastDoc('🗑 Grid limpiado');
}

// ── IA Strategy ──
function selIAOpt(opt){
  docIAStrategy=opt;
  document.querySelectorAll('.ia-opt').forEach(el=>el.classList.remove('ia-selected'));
  document.getElementById('iaopt-'+opt)?.classList.add('ia-selected');
}

const IA_STRATS = {
  pedagogico:`Experto pedagogo. Reglas: distraídos/inquietos al frente cerca del docente, listos distribuidos como tutores, tímidos al frente con vecinos solidarios, platicadores separados en extremos, líderes distribuidos.`,
  conducta:`Experto en manejo de conducta. Reglas: agresivos en esquinas separadas nunca juntos, platicadores en extremos opuestos, inquietos/impulsivos cerca del pasillo, listos y líderes rodeando a alumnos difíciles.`,
  inclusion:`Experto en educación inclusiva. Reglas: atención especial en segunda fila centro con solidarios a ambos lados, tímidos junto a solidarios, perfeccionistas separados entre sí, líderes distribuidos para motivar.`,
  examen:`Experto en evaluación. Reglas: platicadores separados mínimo 2 asientos y fila diferente, distraídos primera fila, agresivos esquinas, impulsivos cerca de la salida, máxima separación entre similares.`
};

async function generarAcomodoDocIA(){
  if(!docAlumnos.length){hubToastDoc('⚠️ No hay alumnos');return;}
  const btn=document.getElementById('btn-gen-ia');
  const icon=document.getElementById('ia-doc-icon');
  const txt=document.getElementById('ia-doc-text');
  btn.disabled=true; icon.innerHTML='<span class="spin"></span>'; txt.textContent='Analizando…';
  const filas=parseInt(document.getElementById('aco-filas').value)||5;
  const cols=parseInt(document.getElementById('aco-cols').value)||6;
  const alumnosInfo=docAlumnos.map(a=>({id:a.id,nombre:a.nombre+' '+a.apellido,etiquetas:a.etiquetas.map(id=>getEtqDoc(id)?.label||id)}));
  const prompt=`${IA_STRATS[docIAStrategy]}

Salón: ${filas} filas × ${cols} columnas. Total alumnos: ${docAlumnos.length}

Alumnos:
${alumnosInfo.map(a=>`- ID:${a.id} | ${a.nombre} | ${a.etiquetas.join(', ')||'Sin etiquetas'}`).join('\n')}

Responde SOLO con JSON válido sin markdown:
{"grid":[[id_o_null,...],...],"notas":{"fila_col":"razón breve máx 12 palabras",...},"resumen":"2 oraciones del acomodo"}

Fila 0 = primera fila (cerca del pizarrón). Asigna TODOS los alumnos.`;

  try{
    let rawText=await callAI({ feature: 'acomodo_salon', prompt });
    rawText=rawText.replace(/```json|```/g,'').trim();
    const result=JSON.parse(rawText);
    if(result.grid){
      docGridState=result.grid.map(f=>f.map(id=>(id&&docAlumnos.find(a=>a.id===id))?id:null));
      while(docGridState.length<filas)docGridState.push(Array(cols).fill(null));
      docGridState=docGridState.slice(0,filas).map(f=>{while(f.length<cols)f.push(null);return f.slice(0,cols);});
    }
    if(result.notas) docNotasGrid=result.notas;
    renderGridDoc();renderUnassignedDoc();
    const notasWrap=document.getElementById('ia-doc-notas');
    let html=result.resumen?`<div class="ia-nota" style="border-color:#22c55e;">📊 ${result.resumen}</div>`:'';
    Object.entries(result.notas||{}).slice(0,6).forEach(([key,nota])=>{
      const [f,c]=key.split('_').map(Number);
      const id=(docGridState[f]||[])[c];
      const a=docAlumnos.find(x=>x.id===id);
      if(a&&nota)html+=`<div class="ia-nota"><strong>${a.nombre}:</strong> ${nota}</div>`;
    });
    notasWrap.innerHTML=html||'<div class="ia-nota">Acomodo generado.</div>';
    document.getElementById('ia-doc-result').style.display='block';
    hubToastDoc('✨ Acomodo IA generado para '+salonActivoDoc?.nombre);
  }catch(err){
    acomodoFallbackDoc(filas,cols);
    hubToastDoc('✅ Acomodo generado (demo)');
  }
  btn.disabled=false;icon.textContent='✨';txt.textContent='Generar acomodo';
}

function acomodoFallbackDoc(filas,cols){
  const orden=['distraido','inquieto','especial','timido','listo','solidario','lider','creativo','platicador','agresivo','impulsivo','perfeccionista'];
  const sorted=[...docAlumnos].sort((a,b)=>{
    const pa=Math.min(...a.etiquetas.map(e=>orden.indexOf(e)).filter(x=>x>=0),99);
    const pb=Math.min(...b.etiquetas.map(e=>orden.indexOf(e)).filter(x=>x>=0),99);
    return pa-pb;
  });
  docGridState=Array.from({length:filas},()=>Array(cols).fill(null));
  let i=0;
  for(let f=0;f<filas&&i<sorted.length;f++)for(let c=0;c<cols&&i<sorted.length;c++)docGridState[f][c]=sorted[i++].id;
  docNotasGrid={};
  renderGridDoc();renderUnassignedDoc();
  document.getElementById('ia-doc-result').style.display='block';
  document.getElementById('ia-doc-notas').innerHTML='<div class="ia-nota" style="border-color:#f59e0b;">⚠️ IA no disponible en este momento. Intenta de nuevo.</div>';
}
// ══ FIN MÓDULO SALONES ══

// ══════════════════════════════════════════════════
// PLANEACIONES — PDF UPLOAD
// ══════════════════════════════════════════════════
let planPDFbase64 = null;

function planSwitchTab(tab) {
  document.getElementById('plan-tab-manual').classList.toggle('active', tab==='manual');
  document.getElementById('plan-tab-pdf').classList.toggle('active', tab==='pdf');
  document.getElementById('plan-pdf-zona').style.display = tab==='pdf' ? 'block' : 'none';
  // Ocultar/mostrar formulario manual
  const formCols = document.querySelector('#plan-vista-form .grid-2');
  if(formCols) formCols.style.display = tab==='manual' ? '' : 'none';
}

function planCargarPDF(input) {
  const file = input.files[0];
  if(!file) return;
  if(file.size > 10 * 1024 * 1024) { hubToast('⚠️ El PDF es muy grande (máx 10 MB)', 'warn'); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    planPDFbase64 = e.target.result.split(',')[1];
    document.getElementById('plan-pdf-preview').style.display = 'block';
    document.getElementById('plan-pdf-nombre').textContent = file.name;
    document.getElementById('plan-pdf-size').textContent = (file.size/1024).toFixed(0) + ' KB';
    document.getElementById('plan-pdf-dropzone').style.display = 'none';
    document.getElementById('plan-btn-generar-pdf').disabled = false;
    document.getElementById('plan-btn-generar-pdf').textContent = '✨ Analizar PDF y generar planeación';
  };
  reader.readAsDataURL(file);
}

function planQuitarPDF() {
  planPDFbase64 = null;
  document.getElementById('plan-pdf-preview').style.display = 'none';
  document.getElementById('plan-pdf-dropzone').style.display = 'block';
  document.getElementById('plan-pdf-input').value = '';
  document.getElementById('plan-btn-generar-pdf').disabled = true;
}

// planGenerarDesdePDF defined above

// Drag & drop en zona PDF
document.addEventListener('DOMContentLoaded', ()=>{
  const dz = document.getElementById('plan-pdf-dropzone');
  if(!dz) return;
  dz.addEventListener('dragover', e=>{ e.preventDefault(); dz.style.borderColor='var(--verde-accent)'; dz.style.background='var(--verde-light)'; });
  dz.addEventListener('dragleave', ()=>{ dz.style.borderColor='var(--gris-20)'; dz.style.background='var(--crema)'; });
  dz.addEventListener('drop', e=>{ e.preventDefault(); dz.style.borderColor='var(--gris-20)'; dz.style.background='var(--crema)'; const file=e.dataTransfer.files[0]; if(file&&file.type==='application/pdf'){ const inp=document.getElementById('plan-pdf-input'); const dt=new DataTransfer(); dt.items.add(file); inp.files=dt.files; planCargarPDF(inp); } });
});