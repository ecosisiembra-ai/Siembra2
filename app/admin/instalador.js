// ── Panel Instalador ───────────────────────────────────────────────────────
function abrirInstalador() {
  document.getElementById('panel-instalador').style.display = 'block';
  instRefreshDisplay();
  // Pre-rellenar con config actual
  const cfg = window._escuelaCfg || {};
  document.getElementById('inst-nombre').value = cfg.nombre || '';
  document.getElementById('inst-cct').value    = cfg.cct    || '';
  document.getElementById('inst-url').value    = cfg.url    || '';
  document.getElementById('inst-key').value    = cfg.key    || '';
  document.getElementById('inst-nivel').value  = cfg.nivel_default || 'primaria';
  // Pre-seleccionar plan
  const plan = cfg.plan || 'base';
  const radioEl = document.getElementById('inst-plan-' + plan);
  if (radioEl) { radioEl.checked = true; radioEl.dispatchEvent(new Event('change')); }
  instValidar();
}
function cerrarInstalador() {
  document.getElementById('panel-instalador').style.display = 'none';
}
function instRefreshDisplay() {
  const cfg = window._escuelaCfg || {};
  const el = document.getElementById('inst-cfg-display');
  if (!el) return;
  const activo = localStorage.getItem('siembra_escuela_cfg');
  if (activo) {
    el.innerHTML = `<strong>${cfg.nombre || '—'}</strong> · ${cfg.cct || '—'}<br><span style="color:#64748b;font-size:11px;">${cfg.url || '—'}</span>`;
  } else {
    el.innerHTML = '<span style="color:#92400e;">⚠️ Usando configuración DEMO. Ingresa credenciales reales.</span>';
  }
}
function instValidar() {
  const url = document.getElementById('inst-url').value.trim();
  const key = document.getElementById('inst-key').value.trim();
  const nombre = document.getElementById('inst-nombre').value.trim();
  const valid = url.startsWith('https://') && url.includes('supabase') && key.length > 10 && nombre.length > 2;
  document.getElementById('inst-save-btn').disabled = !valid;
  document.getElementById('inst-save-btn').style.opacity = valid ? '1' : '.5';
  document.getElementById('inst-test-btn').disabled = !valid;
  document.getElementById('inst-error').style.display = 'none';
}
async function instTestConexion() {
  const url = document.getElementById('inst-url').value.trim();
  const key = document.getElementById('inst-key').value.trim();
  const btn = document.getElementById('inst-test-btn');
  btn.textContent = '⏳ Probando…';
  try {
    const resp = await fetch(`${url}/rest/v1/`, {
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    });
    if (resp.ok || resp.status === 200) {
      btn.textContent = '✅ Conexión OK';
      btn.style.background = '#f0fdf4';
      btn.style.borderColor = '#86efac';
      btn.style.color = '#16a34a';
    } else {
      throw new Error('Status ' + resp.status);
    }
  } catch(e) {
    btn.textContent = '❌ Falló';
    const errEl = document.getElementById('inst-error');
    errEl.textContent = 'No se pudo conectar: ' + e.message + '. Verifica URL y key.';
    errEl.style.display = 'block';
  }
  setTimeout(() => { btn.textContent = '🔌 Probar conexión'; btn.style.background=''; btn.style.borderColor=''; btn.style.color=''; }, 3000);
}
function instGuardar() {
  const planSeleccionado = document.querySelector('input[name="inst-plan"]:checked')?.value || 'base';
  const cfg = {
    nombre:        document.getElementById('inst-nombre').value.trim(),
    cct:           document.getElementById('inst-cct').value.trim().toUpperCase(),
    url:           document.getElementById('inst-url').value.trim(),
    key:           document.getElementById('inst-key').value.trim(),
    nivel_default: document.getElementById('inst-nivel').value,
    plan:          planSeleccionado,
    guardado_en:   new Date().toISOString()
  };
  localStorage.setItem('siembra_escuela_cfg', JSON.stringify(cfg));
  hubToast('✅ Configuración guardada. Recargando…', 'ok');
  setTimeout(() => location.reload(), 1200);
}

// ══════════════════════════════════════════════════════
// FUNCIONES FALTANTES — añadidas en revisión de auditoría
// ══════════════════════════════════════════════════════

// ── toggleDarkMode (doc-portal topbar button) ────────────────────────
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  const btn = document.getElementById('dm-toggle');
  if (btn) btn.textContent = isDark ? '🌙' : '☀️';
  try { localStorage.setItem('siembra_dark', isDark ? '1' : '0'); } catch(e) {}
}
(function _initDarkMode() {
  try {
    if (localStorage.getItem('siembra_dark') === '1') {
      document.body.classList.add('dark-mode');
      const btn = document.getElementById('dm-toggle');
      if (btn) btn.textContent = '🌙';
    }
  } catch(e) {}
})();

// ── instLimpiar (coordinador portal — config page) ───────────────────
// ══════════════════════════════════════════════════════════════════════
// MÓDULOS NEM/SEP — lógica completa para los 8 módulos
// ══════════════════════════════════════════════════════════════════════

// ── Estado global NEM ─────────────────────────────────────────────────
window._nemData = {
  pemc: JSON.parse(localStorage.getItem('siembra_pemc') || '[]'),
  cte:  JSON.parse(localStorage.getItem('siembra_cte')  || '[]'),
  apf:  JSON.parse(localStorage.getItem('siembra_apf')  || '{"directiva":{},"asambleas":[]}'),
  nee:  JSON.parse(localStorage.getItem('siembra_nee')  || '[]'),
  inv:  JSON.parse(localStorage.getItem('siembra_inv')  || '[]'),
};

function _nemSave(key) {
  try { localStorage.setItem('siembra_' + key, JSON.stringify(window._nemData[key])); } catch(e) {}
}

// ── NAV TITLES for NEM pages ──────────────────────────────────────────
const NEM_TITLES = {
  'nem-911':    'Estadística 911',
  'nem-ficha':  'Ficha de inscripción SEP',
  'nem-pemc':   'PEMC — Plan de Mejora Continua',
  'nem-cte':    'Consejo Técnico Escolar',
  'nem-boleta': 'Boleta NEM',
  'nem-apf':    'Consejo APF',
  'nem-nee':    'Bienestar / NEE',
  'nem-inv':    'Inventario escolar',
};

// Patch ADM.navTo to handle NEM pages — deferred until ADM is available
function _applyNemNavToPatch() {
  if (!window.ADM || !ADM.navTo) return;
  const _admNavToOrig = ADM.navTo.bind(ADM);
  ADM.navTo = function(page) {
  if (page.startsWith('nem-')) {
    document.querySelectorAll('#admin-portal .adm-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#admin-portal .adm-page').forEach(p => { p.style.display=''; p.classList.remove('active'); });
    const btn = document.getElementById('adm-nav-' + page);
    const pg  = document.getElementById('adm-p-' + page);
    if (btn) btn.classList.add('active');
    if (pg)  { pg.style.display=''; pg.classList.add('active'); }
    const topbarTitle = document.getElementById('adm-topbar-title');
    if (topbarTitle) topbarTitle.textContent = NEM_TITLES[page] || page;
    // Init the specific page
    if (page === 'nem-911')    nem911Init();
    if (page === 'nem-ficha')  nemFichaInit();
    if (page === 'nem-pemc')   nemPemcRender();
    if (page === 'nem-cte')    nemCteRender();
    if (page === 'nem-boleta') nemBoletaInit();
    if (page === 'nem-apf')    nemApfRender();
    if (page === 'nem-nee')    nemNeeRender();
    if (page === 'nem-inv')    nemInvRender();
  } else {
    _admNavToOrig(page);
  }
  };
}

// ═══════════════════════════════════════════════════════
// 1. ESTADÍSTICA 911
// ═══════════════════════════════════════════════════════
function nem911Init() {
  const grid = document.getElementById('nem911-matricula-grid');
  if (!grid) return;
  const grados = ['1°','2°','3°','4°','5°','6°'];
  const extras = grid.querySelectorAll('.nem911-row');
  extras.forEach(e => e.remove());
  grados.forEach(g => {
    const h = document.createElement('div'); h.className='nem911-row'; h.style.cssText='font-size:13px;font-weight:600;color:#0f172a;'; h.textContent=g;
    const hm = document.createElement('input'); hm.type='number'; hm.min='0'; hm.id='nem911-h-'+g; hm.placeholder='0'; hm.style.cssText='width:100%;padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:13px;text-align:center;outline:none;'; hm.className='nem911-row'; hm.oninput=nem911Total;
    const hf = document.createElement('input'); hf.type='number'; hf.min='0'; hf.id='nem911-m-'+g; hf.placeholder='0'; hf.style.cssText='width:100%;padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:13px;text-align:center;outline:none;'; hf.className='nem911-row'; hf.oninput=nem911Total;
    const ht = document.createElement('div'); ht.id='nem911-t-'+g; ht.className='nem911-row'; ht.style.cssText='font-size:13px;font-weight:700;color:#0d5c2f;text-align:center;padding:6px 0;'; ht.textContent='0';
    [h, hm, hf, ht].forEach(el => grid.appendChild(el));
  });
  // Total row
  const tl = document.createElement('div'); tl.className='nem911-row'; tl.style.cssText='font-size:13px;font-weight:700;'; tl.textContent='Total';
  const th = document.createElement('div'); th.id='nem911-total-h'; th.className='nem911-row'; th.style.cssText='font-size:13px;font-weight:700;color:#1d4ed8;text-align:center;'; th.textContent='0';
  const tf = document.createElement('div'); tf.id='nem911-total-m'; tf.className='nem911-row'; tf.style.cssText='font-size:13px;font-weight:700;color:#c2410c;text-align:center;'; tf.textContent='0';
  const tt = document.createElement('div'); tt.id='nem911-total-t'; tt.className='nem911-row'; tt.style.cssText='font-size:13px;font-weight:900;color:#0d5c2f;text-align:center;'; tt.textContent='0';
  [tl, th, tf, tt].forEach(el => grid.appendChild(el));
}
function nem911Total() {
  const grados = ['1°','2°','3°','4°','5°','6°'];
  let totalH=0, totalM=0;
  grados.forEach(g => {
    const h = parseInt(document.getElementById('nem911-h-'+g)?.value)||0;
    const m = parseInt(document.getElementById('nem911-m-'+g)?.value)||0;
    const t = document.getElementById('nem911-t-'+g);
    if(t) t.textContent = h+m;
    totalH+=h; totalM+=m;
  });
  const th = document.getElementById('nem911-total-h'); if(th) th.textContent=totalH;
  const tm = document.getElementById('nem911-total-m'); if(tm) tm.textContent=totalM;
  const tt = document.getElementById('nem911-total-t'); if(tt) tt.textContent=totalH+totalM;
}
async function nem911Guardar() {
  const grados = ['1°','2°','3°','4°','5°','6°'];
  const matricula = {};
  grados.forEach(g => {
    matricula[g] = {
      h: parseInt(document.getElementById('nem911-h-'+g)?.value)||0,
      m: parseInt(document.getElementById('nem911-m-'+g)?.value)||0,
    };
  });
  const payload = {
    ciclo: window.CICLO_ACTIVO,
    periodo: document.getElementById('nem911-periodo')?.value,
    matricula,
    doc_fg:   parseInt(document.getElementById('nem911-doc-fg')?.value)||0,
    doc_ap:   parseInt(document.getElementById('nem911-doc-ap')?.value)||0,
    directivo:parseInt(document.getElementById('nem911-dir')?.value)||0,
    adm:      parseInt(document.getElementById('nem911-adm')?.value)||0,
    apoyo:    parseInt(document.getElementById('nem911-apoyo')?.value)||0,
    aulas:    parseInt(document.getElementById('nem911-aulas')?.value)||0,
    aulas_ok: parseInt(document.getElementById('nem911-aulas-ok')?.value)||0,
    san_al:   parseInt(document.getElementById('nem911-san-al')?.value)||0,
    san_doc:  parseInt(document.getElementById('nem911-san-doc')?.value)||0,
    biblioteca: document.getElementById('nem911-bib')?.value==='1',
    computo:    document.getElementById('nem911-comp')?.value==='1',
    internet:   document.getElementById('nem911-inet')?.value==='1',
    comedor:    document.getElementById('nem911-comedor')?.value==='1',
    becas:    parseInt(document.getElementById('nem911-becas')?.value)||0,
    nee:      parseInt(document.getElementById('nem911-nee')?.value)||0,
    rezago:   parseInt(document.getElementById('nem911-rezago')?.value)||0,
    repro:    parseInt(document.getElementById('nem911-repro')?.value)||0,
    escuela_cct: window.currentPerfil?.escuela_cct || null,
    guardado: new Date().toISOString(),
  };
  try {
    if (window.sb && window.currentPerfil?.escuela_cct) {
      await sb.from('estadistica_911').upsert(payload, { onConflict: 'ciclo,periodo,escuela_cct' });
    }
    localStorage.setItem('siembra_911_' + payload.periodo, JSON.stringify(payload));
    const res = document.getElementById('nem911-resultado');
    if (res) { res.textContent = '✅ Reporte guardado: ' + payload.periodo + ' · Total: ' + Object.values(payload.matricula).reduce((s,v)=>s+v.h+v.m,0) + ' alumnos'; res.style.display='block'; }
    hubToast('✅ Estadística 911 guardada', 'ok');
  } catch(e) {
    localStorage.setItem('siembra_911_' + payload.periodo, JSON.stringify(payload));
    hubToast('✅ Guardado localmente (sin conexión a BD)', 'ok');
  }
}

// ═══════════════════════════════════════════════════════
// 2. FICHA DE INSCRIPCIÓN SEP
// ═══════════════════════════════════════════════════════
function nemFichaInit() {
  const sel = document.getElementById('nem-ficha-alumno-sel');
  if (!sel) return;
  const opts = (ADM.alumnos || []).map(a => `<option value="${a.id}">${(a.nombre+' '+(a.apellido||a.apellido_p||'')).trim()}</option>`).join('');
  sel.innerHTML = '<option value="">Seleccionar alumno…</option>' + opts;
}
function nemFichaCargar(id) {
  if (!id) return;
  const a = (ADM.alumnos || []).find(x => x.id === id);
  if (!a) return;
  const set = (elId, val) => { const el = document.getElementById(elId); if(el && val) el.value = val; };
  set('nf-nombre', a.nombre);
  set('nf-ap', a.apellido_p || (a.apellido||'').split(' ')[0]);
  set('nf-am', a.apellido_m || (a.apellido||'').split(' ')[1]);
  set('nf-curp', a.curp);
  set('nf-nac', a.fecha_nacimiento || a.fecha_nac);
  set('nf-tutor-nom', a.tutor_nombre);
  set('nf-tutor-tel', a.telefono_tutor);
}
async function nemFichaGuardar() {
  const alumnoId = document.getElementById('nem-ficha-alumno-sel')?.value;
  const payload = {
    alumno_id:       alumnoId || null,
    nombre:          document.getElementById('nf-nombre')?.value.trim(),
    apellido_p:      document.getElementById('nf-ap')?.value.trim(),
    apellido_m:      document.getElementById('nf-am')?.value.trim(),
    curp:            document.getElementById('nf-curp')?.value.trim(),
    fecha_nacimiento:document.getElementById('nf-nac')?.value,
    sexo:            document.getElementById('nf-sexo')?.value,
    lugar_nacimiento:document.getElementById('nf-lugar-nac')?.value.trim(),
    tipo_sangre:     document.getElementById('nf-sangre')?.value,
    lengua_indigena: document.getElementById('nf-lengua')?.value,
    tutor_nombre:    document.getElementById('nf-tutor-nom')?.value.trim(),
    tutor_parentesco:document.getElementById('nf-tutor-rel')?.value,
    telefono_1:      document.getElementById('nf-tutor-tel')?.value.trim(),
    telefono_2:      document.getElementById('nf-tutor-tel2')?.value.trim(),
    email_tutor:     document.getElementById('nf-tutor-email')?.value.trim(),
    domicilio:       document.getElementById('nf-domicilio')?.value.trim(),
    municipio:       document.getElementById('nf-municipio')?.value.trim(),
    cp:              document.getElementById('nf-cp')?.value.trim(),
    ocupacion_tutor: document.getElementById('nf-ocupacion')?.value.trim(),
    escolaridad_tutor:document.getElementById('nf-escolaridad')?.value,
    grado:           document.getElementById('nf-grado')?.value,
    grupo_letra:     document.getElementById('nf-grupo-ltr')?.value.trim(),
    turno:           document.getElementById('nf-turno')?.value,
    esc_procedencia: document.getElementById('nf-esc-proc')?.value.trim(),
    programa_apoyo:  document.getElementById('nf-programa')?.value,
    obs_salud:       document.getElementById('nf-obs-salud')?.value.trim(),
    vivienda:        document.getElementById('nf-vivienda')?.value,
    hogar_personas:  parseInt(document.getElementById('nf-hogar-personas')?.value)||0,
    tiene_internet:  document.getElementById('nf-inet')?.value==='1',
    dispositivo:     document.getElementById('nf-dispositivo')?.value,
    distancia_esc:   document.getElementById('nf-distancia')?.value,
    trabaja_alumno:  parseInt(document.getElementById('nf-trabaja')?.value)||0,
    escuela_cct:     window.currentPerfil?.escuela_cct || null,
    guardado:        new Date().toISOString(),
  };
  if (!payload.nombre) { hubToast('⚠️ Ingresa el nombre del alumno', 'warn'); return; }
  try {
    if (window.sb && alumnoId) {
      await sb.from('fichas_inscripcion').upsert({ ...payload }, { onConflict: 'alumno_id' });

      // ── Auto-vínculo: si el admin ingresó email del tutor, crear invitación
      //    para que el padre se ligue solo al iniciar sesión ──────────────────
      const emailTutor = payload.email_tutor?.toLowerCase().trim();
      if (emailTutor && alumnoId) {
        const cct = window.currentPerfil?.escuela_cct;
        // Upsert: si ya existe una invitación para este alumno+email no duplicar
        await sb.from('invitaciones').upsert({
          email_destino: emailTutor,
          alumno_id:     alumnoId,
          rol:           'padre',
          escuela_id:    cct || null,
          estado:        'activa',
          creado_en:     new Date().toISOString(),
        }, { onConflict: 'email_destino,alumno_id', ignoreDuplicates: true }).catch(()=>{});
      }
    }
    localStorage.setItem('siembra_ficha_' + (alumnoId||payload.curp), JSON.stringify(payload));
    const res = document.getElementById('nf-resultado');
    if (res) { res.textContent = '✅ Ficha guardada para ' + payload.nombre + ' ' + payload.apellido_p; res.style.display='block'; }
    hubToast('✅ Ficha guardada' + (payload.email_tutor ? ' · Padre vinculado por correo' : ''), 'ok');
  } catch(e) {
    localStorage.setItem('siembra_ficha_' + (alumnoId||payload.curp||Date.now()), JSON.stringify(payload));
    hubToast('✅ Ficha guardada localmente', 'ok');
  }
}

// ═══════════════════════════════════════════════════════
// 3. PEMC — PLAN DE MEJORA CONTINUA
// ═══════════════════════════════════════════════════════
const PEMC_EJES = [
  { id:'logro',       label:'Logro educativo',       color:'#0d5c2f', bg:'#f0fdf4', border:'#86efac' },
  { id:'normalidad',  label:'Normalidad mínima',      color:'#1e40af', bg:'#eff6ff', border:'#93c5fd' },
  { id:'convivencia', label:'Convivencia escolar',    color:'#7c3aed', bg:'#f5f3ff', border:'#c4b5fd' },
  { id:'gestion',     label:'Gestión escolar',        color:'#c2410c', bg:'#fff7ed', border:'#fed7aa' },
];
const ESTATUS_BADGE = {
  pendiente: '<span style="background:#fef9c3;color:#a16207;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">⏳ Pendiente</span>',
  proceso:   '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">🔄 En proceso</span>',
  logrado:   '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">✅ Logrado</span>',
  cancelado: '<span style="background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">❌ Cancelado</span>',
};
function nemPemcRender() {
  const cont = document.getElementById('nem-pemc-ejes') ||
                   document.getElementById('subdir-nem-pemc-ejes') ||
                   document.getElementById('coord-nem-pemc-ejes');
  if (!cont) return;
  const acciones = window._nemData.pemc || [];
  cont.innerHTML = PEMC_EJES.map(eje => {
    const items = acciones.filter(a => a.eje === eje.id);
    const pct = items.length ? Math.round(items.filter(a=>a.estatus==='logrado').length/items.length*100) : 0;
    return `<div class="adm-card" style="margin-bottom:0;border-left:4px solid ${eje.color};">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-weight:700;font-size:15px;color:${eje.color};">${eje.label}</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-size:12px;color:#64748b;">${items.length} acciones · ${pct}% logrado</div>
          <div style="height:8px;width:80px;background:#f1f5f9;border-radius:99px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${eje.color};border-radius:99px;transition:.4s;"></div></div>
        </div>
      </div>
      ${items.length ? items.map((a,i) => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:${eje.bg};border-radius:9px;margin-bottom:7px;border:1px solid ${eje.border};">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:#0f172a;">${a.accion}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;">Resp: ${a.resp||'—'} · ${a.inicio||''} → ${a.fin||''}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            ${ESTATUS_BADGE[a.estatus]||''}
            <button onclick="nemPemcCambiarEstatus(${acciones.indexOf(a)})" style="padding:3px 8px;background:white;border:1.5px solid #e2e8f0;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;">Cambiar</button>
            <button onclick="nemPemcEliminar(${acciones.indexOf(a)})" style="padding:3px 8px;background:#fff1f2;border:1.5px solid #fecdd3;color:#be123c;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;" aria-label="Cerrar">✕</button>
          </div>
        </div>`).join('') : `<div style="font-size:13px;color:#94a3b8;padding:8px 0;">Sin acciones registradas para este eje.</div>`}
    </div>`;
  }).join('<div style="height:14px;"></div>');
}
function nemPemcAgregarAccion() {
  const accion = document.getElementById('pemc-nuevo-accion')?.value.trim();
  if (!accion) { hubToast('⚠️ Describe la acción de mejora', 'warn'); return; }
  window._nemData.pemc.push({
    eje:     document.getElementById('pemc-nuevo-eje')?.value,
    accion,
    resp:    document.getElementById('pemc-nuevo-resp')?.value.trim(),
    inicio:  document.getElementById('pemc-nuevo-inicio')?.value,
    fin:     document.getElementById('pemc-nuevo-fin')?.value,
    estatus: document.getElementById('pemc-nuevo-estatus')?.value || 'pendiente',
  });
  _nemSave('pemc');
  ['pemc-nuevo-accion','pemc-nuevo-resp','pemc-nuevo-inicio','pemc-nuevo-fin'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  nemPemcRender();
  hubToast('✅ Acción agregada al PEMC', 'ok');
}
function nemPemcCambiarEstatus(idx) {
  const estados = ['pendiente','proceso','logrado','cancelado'];
  const curr = window._nemData.pemc[idx]?.estatus || 'pendiente';
  const next = estados[(estados.indexOf(curr)+1) % estados.length];
  window._nemData.pemc[idx].estatus = next;
  _nemSave('pemc');
  nemPemcRender();
}
function nemPemcEliminar(idx) {
  if (!confirm('¿Eliminar esta acción?')) return;
  window._nemData.pemc.splice(idx, 1);
  _nemSave('pemc');
  nemPemcRender();
}
async function nemPemcGuardar() {
  try {
    if (window.sb && window.currentPerfil?.escuela_cct) {
      await sb.from('pemc').upsert({ ciclo: window.CICLO_ACTIVO, acciones: window._nemData.pemc, escuela_cct: window.currentPerfil.escuela_cct }, { onConflict:'ciclo,escuela_cct' });
    }
    hubToast('✅ PEMC guardado', 'ok');
  } catch(e) { hubToast('✅ PEMC guardado localmente', 'ok'); }
}

// ═══════════════════════════════════════════════════════
// 4. CTE — CONSEJO TÉCNICO ESCOLAR
// ═══════════════════════════════════════════════════════
let _cteSesionActual = null;
function nemCteRender() {
  const grid = document.getElementById('nem-cte-sesiones-grid');
  if (!grid) return;
  const sesiones = window._nemData.cte || [];
  const nombres = ['1ª Sesión\nOrdinaria','2ª Sesión\nOrdinaria','3ª Sesión\nOrdinaria','4ª Sesión\nOrdinaria','5ª Sesión\nOrdinaria','6ª Sesión\nOrdinaria','7ª Sesión\nOrdinaria','8ª Sesión\nOrdinaria'];
  grid.innerHTML = nombres.map((nom, i) => {
    const s = sesiones.find(x => x.numero === i+1);
    const color = s ? (s.acuerdos ? '#f0fdf4' : '#eff6ff') : '#f8fafc';
    const border = s ? '#86efac' : '#e2e8f0';
    const label = s ? `<div style="font-size:11px;color:#0d5c2f;margin-top:4px;">${s.fecha||'Sin fecha'}</div>` : '<div style="font-size:11px;color:#94a3b8;margin-top:4px;">Sin registrar</div>';
    return `<div onclick="nemCteAbrirSesion(${i+1})" style="background:${color};border:1.5px solid ${border};border-radius:12px;padding:16px;cursor:pointer;transition:.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
      <div style="font-size:20px;text-align:center;margin-bottom:6px;">${s ? '✅' : '📋'}</div>
      <div style="font-size:12px;font-weight:700;text-align:center;color:#0f172a;">${nom.replace('\n','<br>')}</div>
      ${label}
    </div>`;
  }).join('');
}
function nemCteAbrirSesion(num) {
  _cteSesionActual = num;
  const sesiones = window._nemData.cte || [];
  const s = sesiones.find(x => x.numero === num);
  const titulo = document.getElementById('nem-cte-titulo-sesion');
  if (titulo) titulo.textContent = `Sesión ${num} · CTE`;
  const set = (id, val) => { const el=document.getElementById(id); if(el) el.value=val||''; };
  set('cte-fecha', s?.fecha);
  set('cte-tipo', s?.tipo || 'Ordinaria');
  set('cte-tema', s?.tema);
  set('cte-orden', s?.orden);
  set('cte-acuerdos', s?.acuerdos);
  set('cte-asistentes', s?.asistentes);
  set('cte-ausentes', s?.ausentes);
  const grid = document.getElementById('nem-cte-sesiones-grid');
  const detalle = document.getElementById('nem-cte-detalle');
  if (grid) grid.style.display = 'none';
  if (detalle) detalle.style.display = 'block';
}
function nemCteCerrarDetalle() {
  document.getElementById('nem-cte-sesiones-grid').style.display = '';
  document.getElementById('nem-cte-detalle').style.display = 'none';
  _cteSesionActual = null;
}
async function nemCteGuardarSesion() {
  if (!_cteSesionActual) return;
  const payload = {
    numero:    _cteSesionActual,
    fecha:     document.getElementById('cte-fecha')?.value,
    tipo:      document.getElementById('cte-tipo')?.value,
    tema:      document.getElementById('cte-tema')?.value.trim(),
    orden:     document.getElementById('cte-orden')?.value.trim(),
    acuerdos:  document.getElementById('cte-acuerdos')?.value.trim(),
    asistentes:parseInt(document.getElementById('cte-asistentes')?.value)||0,
    ausentes:  parseInt(document.getElementById('cte-ausentes')?.value)||0,
    ciclo: window.CICLO_ACTIVO,
    guardado:  new Date().toISOString(),
  };
  const idx = window._nemData.cte.findIndex(x => x.numero === _cteSesionActual);
  if (idx !== -1) window._nemData.cte[idx] = payload;
  else window._nemData.cte.push(payload);
  _nemSave('cte');
  try {
    if (window.sb && window.currentPerfil?.escuela_cct) {
      await sb.from('cte_sesiones').upsert({ ...payload, escuela_cct: window.currentPerfil.escuela_cct }, { onConflict: 'numero,ciclo,escuela_cct' });
    }
  } catch(e) {}
  hubToast('✅ Sesión CTE guardada', 'ok');
  nemCteCerrarDetalle();
  nemCteRender();
}
function nemCteNuevaSesion() {
  const next = (window._nemData.cte.length || 0) + 1;
  if (next > 8) { hubToast('⚠️ Ya se registraron las 8 sesiones ordinarias', 'warn'); return; }
  nemCteAbrirSesion(next);
}

// ═══════════════════════════════════════════════════════
// 5. BOLETA NEM
// ═══════════════════════════════════════════════════════
// BOLETA_CAMPOS is dynamic — reads from getCamposByNivel()
function getBOLETA_CAMPOS() {
  return getCamposByNivel(window._admNivelActivo || window._nivelActivo || 'primaria').map(c => ({
    id:    c.id,
    label: c.nombre,
    color: c.color,
    emoji: c.emoji,
  }));
}
// Legacy alias
const BOLETA_CAMPOS = new Proxy([], {
  get(t, prop) {
    const cur = getBOLETA_CAMPOS();
    if (prop === 'length') return cur.length;
    if (prop === 'map')    return cur.map.bind(cur);
    if (prop === 'forEach') return cur.forEach.bind(cur);
    if (typeof prop === 'string' && !isNaN(prop)) return cur[parseInt(prop)];
    return cur[prop];
  }
});
const BOLETA_DESCRIPTORES = [
  'Logro destacado — Sobresaliente',
  'Logro satisfactorio — Bien',
  'Logro en proceso — Suficiente',
  'Logro inicial — Requiere apoyo',
];
function nemBoletaInit() {
  const sel = document.getElementById('nem-boleta-alumno');
  if (!sel) return;
  const opts = (ADM.alumnos || []).map(a => `<option value="${a.id}">${(a.nombre+' '+(a.apellido||a.apellido_p||'')).trim()}</option>`).join('');
  sel.innerHTML = '<option value="">Seleccionar alumno…</option>' + opts;
  const cont = document.getElementById('nem-boleta-campos');
  if (!cont) return;
  const campos = getBOLETA_CAMPOS();
  cont.innerHTML = campos.map(c => `
    <div class="adm-card" style="border-top:4px solid ${c.color};">
      <div style="font-weight:700;font-size:14px;color:${c.color};margin-bottom:12px;">${c.label}</div>
      <div class="adm-form-group">
        <label>Nivel de logro</label>
        <select id="boleta-${c.id}-nivel" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px;outline:none;font-family:inherit;">
          <option value="">Seleccionar…</option>
          ${BOLETA_DESCRIPTORES.map(d => `<option value="${d}">${d}</option>`).join('')}
        </select>
      </div>
      <div class="adm-form-group">
        <label>Observaciones del campo</label>
        <textarea id="boleta-${c.id}-obs" rows="3" style="width:100%;padding:9px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px;resize:vertical;outline:none;box-sizing:border-box;font-family:inherit;" placeholder="El alumno muestra avances en…"></textarea>
      </div>
    </div>`).join('');
}
function nemBoletaCargar(id) {
  if (!id) return;
  const key = 'siembra_boleta_' + id + '_' + (document.getElementById('nem-boleta-periodo')?.value||'');
  const data = JSON.parse(localStorage.getItem(key) || 'null');
  if (!data) return;
  BOLETA_CAMPOS.forEach(c => {
    const nEl = document.getElementById('boleta-'+c.id+'-nivel');
    const oEl = document.getElementById('boleta-'+c.id+'-obs');
    if(nEl && data[c.id+'_nivel']) nEl.value = data[c.id+'_nivel'];
    if(oEl && data[c.id+'_obs'])   oEl.value = data[c.id+'_obs'];
  });
}
async function nemBoletaGuardar() {
  const alumnoId = document.getElementById('nem-boleta-alumno')?.value;
  const periodo  = document.getElementById('nem-boleta-periodo')?.value;
  if (!alumnoId) { hubToast('⚠️ Selecciona un alumno', 'warn'); return; }
  const payload = { alumno_id: alumnoId, periodo, ciclo: window.CICLO_ACTIVO, escuela_cct: window.currentPerfil?.escuela_cct };
  BOLETA_CAMPOS.forEach(c => {
    payload[c.id+'_nivel'] = document.getElementById('boleta-'+c.id+'-nivel')?.value || '';
    payload[c.id+'_obs']   = document.getElementById('boleta-'+c.id+'-obs')?.value.trim() || '';
  });
  payload.obs_general  = document.getElementById('nem-boleta-obs')?.value.trim();
  payload.asistencias  = parseInt(document.getElementById('nem-boleta-asist')?.value)||0;
  payload.inasist_j    = parseInt(document.getElementById('nem-boleta-inasist-j')?.value)||0;
  payload.inasist_i    = parseInt(document.getElementById('nem-boleta-inasist-i')?.value)||0;
  localStorage.setItem('siembra_boleta_' + alumnoId + '_' + periodo, JSON.stringify(payload));
  try {
    if (window.sb) await sb.from('boletas_nem').upsert(payload, { onConflict:'alumno_id,periodo,ciclo' });
  } catch(e) {}
  hubToast('✅ Boleta NEM guardada', 'ok');
}

// ═══════════════════════════════════════════════════════
// 6. CONSEJO APF
// ═══════════════════════════════════════════════════════
function nemApfRender() {
  const data = window._nemData.apf;
  if (data.directiva) {
    const set = (id, val) => { const el=document.getElementById(id); if(el && val) el.value=val; };
    set('apf-pres', data.directiva.presidente);
    set('apf-sec',  data.directiva.secretario);
    set('apf-tes',  data.directiva.tesorero);
    set('apf-voc1', data.directiva.vocal1);
    set('apf-voc2', data.directiva.vocal2);
  }
  const lista = document.getElementById('nem-apf-asambleas-lista');
  if (!lista) return;
  const asambleas = data.asambleas || [];
  if (!asambleas.length) {
    lista.innerHTML = '<div class="adm-empty" style="padding:28px;">Aún no hay asambleas registradas. Cuando captures la primera, aparecerá aquí.</div>';
    return;
  }
  lista.innerHTML = asambleas.map((a, i) => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid #f1f5f9;">
      <div style="width:40px;height:40px;border-radius:10px;background:#f0fdf4;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🏛️</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;">${a.tipo||'Asamblea'} · ${a.fecha||'Sin fecha'}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">${a.asistentes||0} asistentes · ${a.acuerdos?.substring(0,80)||'Sin acuerdos'}…</div>
      </div>
      <button onclick="nemApfEliminarAsamblea(${i})" class="adm-btn-sm adm-btn-danger" aria-label="Cerrar">✕</button>
    </div>`).join('');
}
function nemApfCalcular() {
  const cuota   = parseFloat(document.getElementById('apf-cuota')?.value) || 0;
  const pagaron = parseInt(document.getElementById('apf-pagaron')?.value) || 0;
  const total   = cuota * pagaron;
  const badge   = document.getElementById('apf-total-badge');
  const res     = document.getElementById('apf-calc-result');
  if (badge) badge.textContent = '$' + total.toLocaleString('es-MX') + ' recaudados';
  if (res)   res.textContent   = 'Total recaudado: $' + total.toLocaleString('es-MX') + ' de ' + pagaron + ' familias';
}
async function nemApfGuardarDirectiva() {
  window._nemData.apf.directiva = {
    presidente: document.getElementById('apf-pres')?.value.trim(),
    secretario: document.getElementById('apf-sec')?.value.trim(),
    tesorero:   document.getElementById('apf-tes')?.value.trim(),
    vocal1:     document.getElementById('apf-voc1')?.value.trim(),
    vocal2:     document.getElementById('apf-voc2')?.value.trim(),
  };
  _nemSave('apf');
  hubToast('✅ Directiva APF guardada', 'ok');
}
function nemApfNuevaAsamblea() {
  const fecha   = prompt('Fecha de la asamblea (dd/mm/aaaa):');
  if (!fecha) return;
  const tipo    = prompt('Tipo: Ordinaria / Extraordinaria') || 'Ordinaria';
  const asist   = parseInt(prompt('Número de asistentes:')) || 0;
  const acuerdos= prompt('Acuerdos principales:') || '';
  window._nemData.apf.asambleas.push({ fecha, tipo, asistentes: asist, acuerdos });
  _nemSave('apf');
  nemApfRender();
  hubToast('✅ Asamblea registrada', 'ok');
}
function nemApfEliminarAsamblea(idx) {
  if (!confirm('¿Eliminar este registro de asamblea?')) return;
  window._nemData.apf.asambleas.splice(idx, 1);
  _nemSave('apf');
  nemApfRender();
}

// ═══════════════════════════════════════════════════════
// 7. BIENESTAR / NEE
// ═══════════════════════════════════════════════════════
function nemNeeRender() {
  const perfiles = window._nemData.nee || [];
  document.getElementById('nee-total').textContent   = perfiles.length;
  document.getElementById('nee-usaer').textContent   = perfiles.filter(p=>p.usaer).length;
  document.getElementById('nee-nutricion').textContent = perfiles.filter(p=>p.alerta_nutricional).length;
  document.getElementById('nee-riesgo').textContent  = perfiles.filter(p=>p.seguimiento_ts).length;
  const tipos = {};
  perfiles.forEach(p => { if(p.tipo_nee) tipos[p.tipo_nee] = (tipos[p.tipo_nee]||0)+1; });
  const chart = document.getElementById('nem-nee-tipos-chart');
  if (chart) {
    chart.innerHTML = Object.entries(tipos).length
      ? Object.entries(tipos).map(([t,c]) => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="flex:1;font-size:13px;font-weight:600;">${t}</div>
            <div style="width:${Math.round(c/perfiles.length*120)}px;height:8px;background:#0d5c2f;border-radius:99px;"></div>
            <div style="font-size:13px;font-weight:700;color:#0d5c2f;">${c}</div>
          </div>`).join('')
      : '<div style="font-size:13px;color:#94a3b8;">Sin perfiles NEE registrados</div>';
  }
  const lista = document.getElementById('nem-nee-lista');
  if (!lista) return;
  if (!perfiles.length) {
    lista.innerHTML = '<div class="adm-empty" style="padding:36px;text-align:center;"><div style="font-size:36px;margin-bottom:10px;">💚</div><div style="font-size:14px;font-weight:700;">Aún no hay perfiles registrados</div><div style="font-size:13px;color:#94a3b8;margin-top:4px;">Registra alumnos que requieran apoyos o atención especial para dar seguimiento oportuno.</div></div>';
    return;
  }
  lista.innerHTML = perfiles.map((p, i) => `
    <div class="adm-card" style="margin-bottom:10px;">
      <div class="adm-card-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:38px;height:38px;border-radius:50%;background:#f0fdf4;display:flex;align-items:center;justify-content:center;font-size:16px;">💚</div>
          <div>
            <div class="adm-card-title">${p.nombre||'Alumno sin nombre'}</div>
            <div class="adm-card-sub">${p.tipo_nee||'Tipo no especificado'} · Grupo ${p.grupo||'—'}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${p.usaer ? '<span class="adm-badge adm-badge-blue">USAER</span>' : ''}
          ${p.alerta_nutricional ? '<span class="adm-badge adm-badge-amber">⚠️ Nutrición</span>' : ''}
          ${p.seguimiento_ts ? '<span class="adm-badge adm-badge-red">TS</span>' : ''}
          <button onclick="nemNeeEliminar(${i})" class="adm-btn-sm adm-btn-danger" aria-label="Cerrar">✕</button>
        </div>
      </div>
      ${p.adaptaciones ? `<div style="font-size:12px;color:#64748b;margin-top:10px;padding:8px 12px;background:#f8fafc;border-radius:7px;">${p.adaptaciones}</div>` : ''}
    </div>`).join('');
}
function nemNeeNuevoPerfil() {
  const alumnoNom = prompt('Nombre del alumno:');
  if (!alumnoNom) return;
  const tipo = prompt('Tipo de NEE (ej: Déficit de atención, Discapacidad visual, Autismo, Rezago lector…):') || '';
  const grupo = prompt('Grupo (ej: 3° A):') || '';
  const usaer = confirm('¿Tiene apoyo USAER?');
  const nutri = confirm('¿Tiene alerta nutricional?');
  const ts    = confirm('¿Está en seguimiento de Trabajo Social?');
  const adapt = prompt('Adaptaciones curriculares (opcional):') || '';
  window._nemData.nee.push({ nombre:alumnoNom, tipo_nee:tipo, grupo, usaer, alerta_nutricional:nutri, seguimiento_ts:ts, adaptaciones:adapt, registrado:new Date().toISOString() });
  _nemSave('nee');
  nemNeeRender();
  hubToast('✅ Perfil de bienestar registrado', 'ok');
}
function nemNeeEliminar(idx) {
  if (!confirm('¿Eliminar este perfil de bienestar?')) return;
  window._nemData.nee.splice(idx, 1);
  _nemSave('nee');
  nemNeeRender();
}

// ═══════════════════════════════════════════════════════
// 8. INVENTARIO ESCOLAR
// ═══════════════════════════════════════════════════════
const INV_ESTADO_COLOR = { 'Bueno':'#dcfce7', 'Regular':'#fef9c3', 'Malo':'#fee2e2', 'Dado de baja':'#f1f5f9' };
const INV_ESTADO_TEXT  = { 'Bueno':'#166534', 'Regular':'#a16207', 'Malo':'#b91c1c', 'Dado de baja':'#64748b' };
function nemInvRender() {
  const items = window._nemData.inv || [];
  const catFil = document.getElementById('nem-inv-filtro-cat')?.value || '';
  const estFil = document.getElementById('nem-inv-filtro-est')?.value || '';
  const filtered = items.filter(i => (!catFil || i.categoria===catFil) && (!estFil || i.estado===estFil));
  // Stats
  const statsEl = document.getElementById('nem-inv-stats');
  if (statsEl) {
    const cats = ['Aulas','Mobiliario','Equipo tecnológico','Material didáctico','Instalaciones'];
    statsEl.innerHTML = cats.map(c => {
      const cnt = items.filter(i=>i.categoria===c).length;
      const bad = items.filter(i=>i.categoria===c && i.estado==='Malo').length;
      return `<div style="background:white;border-radius:14px;padding:16px;border:1px solid #e2e8f0;text-align:center;">
        <div style="font-size:22px;font-weight:900;color:#0f172a;">${cnt}</div>
        <div style="font-size:12px;color:#64748b;font-weight:600;margin-top:2px;">${c}</div>
        ${bad ? `<div style="font-size:11px;color:#b91c1c;margin-top:4px;">${bad} en mal estado</div>` : ''}
      </div>`;
    }).join('');
  }
  // Table
  const tabla = document.getElementById('nem-inv-tabla');
  if (!tabla) return;
  if (!filtered.length) {
    tabla.innerHTML = '<div class="adm-empty" style="padding:36px;text-align:center;">Sin artículos en el inventario.</div>';
    return;
  }
  tabla.innerHTML = `<table class="adm-tabla" style="width:100%;">
    <thead><tr><th>#</th><th>Artículo</th><th>Categoría</th><th>Cantidad</th><th>Estado</th><th>Ubicación</th><th>Acciones</th></tr></thead>
    <tbody>
    ${filtered.map((item, i) => `<tr>
      <td style="color:#94a3b8;font-size:12px;">${i+1}</td>
      <td style="font-weight:600;">${item.nombre}</td>
      <td><span class="adm-badge" style="background:#f0f4f8;color:#475569;">${item.categoria||'—'}</span></td>
      <td style="text-align:center;font-weight:700;">${item.cantidad||1}</td>
      <td><span style="padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:${INV_ESTADO_COLOR[item.estado]||'#f1f5f9'};color:${INV_ESTADO_TEXT[item.estado]||'#64748b'};">${item.estado||'—'}</span></td>
      <td style="font-size:12px;color:#64748b;">${item.ubicacion||'—'}</td>
      <td><button onclick="nemInvEliminar(${items.indexOf(item)})" class="adm-btn-sm adm-btn-danger" aria-label="Cerrar">✕</button></td>
    </tr>`).join('')}
    </tbody>
  </table>`;
}
function nemInvNuevoItem() {
  const nombre    = prompt('Nombre del artículo (ej: Silla escolar, Proyector, Escritorio):');
  if (!nombre) return;
  const categoria = prompt('Categoría: Aulas / Mobiliario / Equipo tecnológico / Material didáctico / Instalaciones') || 'Mobiliario';
  const cantidad  = parseInt(prompt('Cantidad:')) || 1;
  const estado    = prompt('Estado: Bueno / Regular / Malo / Dado de baja') || 'Bueno';
  const ubicacion = prompt('Ubicación (ej: Aula 3, Dirección):') || '';
  window._nemData.inv.push({ nombre, categoria, cantidad, estado, ubicacion, registrado: new Date().toISOString() });
  _nemSave('inv');
  nemInvRender();
  hubToast(`✅ ${nombre} agregado al inventario`, 'ok');
}
function nemInvEliminar(idx) {
  if (!confirm('¿Eliminar este artículo del inventario?')) return;
  window._nemData.inv.splice(idx, 1);
  _nemSave('inv');
  nemInvRender();
}


function admDescargarPadron() {
  const alumnos = ADM.alumnos || [];
  if (!alumnos.length) {
    hubToast('⚠️ No hay alumnos en el padrón', 'warn');
    return;
  }

  // Build CSV with all fields
  const headers = [
    'No.','Nombre','Apellido Paterno','Apellido Materno','CURP',
    'Fecha Nacimiento','Grupo','Código Vinculación','Activo','Registrado'
  ];

  const rows = alumnos.map((a, i) => {
    const grupo = a.alumnos_grupos?.[0]?.grupos?.nombre || '';
    const esc   = (v) => '"' + String(v||'').replace(/"/g,'""') + '"';
    return [
      i+1,
      esc(a.nombre),
      esc(a.apellido_p || (a.apellido||'').split(' ')[0]),
      esc(a.apellido_m || (a.apellido||'').split(' ')[1]),
      esc(a.curp),
      esc(a.fecha_nacimiento || a.fecha_nac),
      esc(grupo),
      esc(a.codigo_vinculacion),
      a.activo ? 'Sí' : 'No',
      esc(a.created_at ? new Date(a.created_at).toLocaleDateString('es-MX') : ''),
    ].join(',');
  });

  const csv = 'ï»¿' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const cct   = window.currentPerfil?.escuela_cct || 'escuela';
  const ciclo = window.CICLO_ACTIVO;
  a.href     = url;
  a.download = `padron_${cct}_${ciclo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  hubToast(`✅ Padrón descargado · ${alumnos.length} alumnos`, 'ok');
}

function docInicializarLibretas() {
  const grid = document.getElementById('libretas-doc-grid');
  if (!grid) return;
  const alumnos = window._grupoAlumnos || [];
  if (!alumnos.length) {
    hubToast('⚠️ No hay alumnos cargados en el grupo activo', 'warn');
    return;
  }
  const hoy = new Date().toLocaleDateString('es-MX');
  grid.innerHTML = alumnos.map((a, i) => {
    const nom = (a.nombre + ' ' + (a.apellido_p || '')).trim();
    const ini = nom.split(' ').map(p => p[0] || '').join('').toUpperCase().slice(0, 2);
    return `
    <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:14px;text-align:center;">
      <div style="width:38px;height:38px;border-radius:50%;background:#f0fdf4;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#0d5c2f;margin:0 auto 8px;">${ini}</div>
      <div style="font-size:12px;font-weight:700;margin-bottom:8px;">${nom}</div>
      <select id="lib-${a.id||i}" style="width:100%;padding:6px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:12px;outline:none;">
        <option value="revisada">✅ Revisada</option>
        <option value="incompleta">⚠️ Incompleta</option>
        <option value="no-presentada">❌ No presentada</option>
        <option value="pendiente">⏳ Pendiente</option>
      </select>
    </div>`;
  }).join('');
  hubToast(`✅ ${alumnos.length} alumnos cargados`, 'ok');
}

// ── Doc-portal: Visitas de acompañamiento ────────────────────────────
let _docVisitas = JSON.parse(localStorage.getItem('siembra_doc_visitas') || '[]');
function docNuevaVisita() {
  const fecha   = prompt('Fecha de la visita (dd/mm/aaaa):') || '';
  if (!fecha) return;
  const obs     = prompt('Observaciones del coordinador:') || '';
  const compromisos = prompt('Compromisos de mejora:') || '';
  _docVisitas.push({ fecha, obs, compromisos, registrado: new Date().toISOString() });
  localStorage.setItem('siembra_doc_visitas', JSON.stringify(_docVisitas));
  docRenderVisitas();
  hubToast('✅ Visita registrada', 'ok');
}
function docRenderVisitas() {
  const lista = document.getElementById('visitas-doc-lista');
  if (!lista) return;
  if (!_docVisitas.length) {
    lista.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gris-50);"><div style="font-size:36px;margin-bottom:10px;">🏫</div><div style="font-weight:700;">Aún no hay visitas registradas</div><div style="font-size:12px;margin-top:4px;">Aquí se mostrará el historial de acompañamiento recibido por tu grupo o plantel.</div></div>';
    return;
  }
  lista.innerHTML = _docVisitas.map((v, i) => `
    <div style="display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid #f1f5f9;">
      <div style="width:38px;height:38px;border-radius:10px;background:#f0fdf4;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">🏫</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;">Visita del ${v.fecha}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">${v.obs || '—'}</div>
        ${v.compromisos ? `<div style="font-size:12px;margin-top:6px;padding:6px 10px;background:#f0fdf4;border-radius:7px;color:#0d5c2f;"><strong>Compromisos:</strong> ${v.compromisos}</div>` : ''}
      </div>
      <button onclick="docEliminarVisita(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;padding:0;flex-shrink:0;" aria-label="Cerrar">✕</button>
    </div>`).join('');
}
function docEliminarVisita(idx) {
  if (!confirm('¿Eliminar este registro de visita?')) return;
  _docVisitas.splice(idx, 1);
  localStorage.setItem('siembra_doc_visitas', JSON.stringify(_docVisitas));
  docRenderVisitas();
}

// ── Dir-portal: Calendario ───────────────────────────────────────────
let _dirEventos = JSON.parse(localStorage.getItem('siembra_dir_eventos') || '[]');
const _DIR_EVENTOS_DEFAULT = [
  { fecha:'01/09/2025', tipo:'inicio', label:'Inicio del ciclo escolar 2025-2026' },
  { fecha:'26/09/2025', tipo:'cte',    label:'1ª Sesión CTE' },
  { fecha:'31/10/2025', tipo:'evento', label:'Día de Muertos — actividad escolar' },
  { fecha:'20/11/2025', tipo:'evento', label:'Aniversario de la Revolución Mexicana' },
  { fecha:'19/12/2025', tipo:'fin',    label:'Fin del 1er semestre — vacaciones' },
  { fecha:'07/01/2026', tipo:'inicio', label:'Regreso a clases — 2do semestre' },
  { fecha:'03/02/2026', tipo:'cte',    label:'5ª Sesión CTE' },
  { fecha:'05/02/2026', tipo:'evento', label:'Día de la Constitución' },
  { fecha:'21/03/2026', tipo:'evento', label:'Conmemoración cívica escolar' },
  { fecha:'02/04/2026', tipo:'fin',    label:'Vacaciones de Semana Santa' },
  { fecha:'13/04/2026', tipo:'inicio', label:'Regreso de vacaciones' },
  { fecha:'26/06/2026', tipo:'fin',    label:'Fin del ciclo escolar 2025-2026' },
];
function dirRenderCalendario() {
  const container = document.getElementById('dir-cal-eventos');
  if (!container) return;
  const todos = [..._DIR_EVENTOS_DEFAULT, ..._dirEventos].sort((a,b) => {
    const pa = a.fecha.split('/').reverse().join('');
    const pb = b.fecha.split('/').reverse().join('');
    return pa.localeCompare(pb);
  });
  const colorTipo = { inicio:'#dcfce7', fin:'#fee2e2', cte:'#dbeafe', evento:'#fef9c3' };
  const textTipo  = { inicio:'#166534', fin:'#b91c1c', cte:'#1e40af', evento:'#a16207' };
  container.innerHTML = todos.map(e => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid #f1f5f9;">
      <div style="font-size:12px;font-weight:700;color:#0f172a;min-width:80px;">${e.fecha}</div>
      <span style="padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;background:${colorTipo[e.tipo]||'#f1f5f9'};color:${textTipo[e.tipo]||'#64748b'};">${e.tipo}</span>
      <div style="font-size:13px;flex:1;">${e.label}</div>
    </div>`).join('');
}
function dirAgregarEvento() {
  hubModal('📅 Agregar evento al calendario', `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Fecha</label>
        <input id="cal-ev-fecha" type="date" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Descripción</label>
        <input id="cal-ev-label" type="text" placeholder="Ej: Día del maestro" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Tipo</label>
        <select id="cal-ev-tipo" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
          <option value="evento">📅 Evento general</option>
          <option value="inicio">🟢 Inicio de clases</option>
          <option value="fin">🔴 Fin / vacaciones</option>
          <option value="cte">📋 Sesión CTE</option>
        </select>
      </div>
    </div>`, 'Agregar', async () => {
    const fechaRaw = document.getElementById('cal-ev-fecha')?.value;
    const label = document.getElementById('cal-ev-label')?.value?.trim();
    const tipo  = document.getElementById('cal-ev-tipo')?.value || 'evento';
    if (!fechaRaw || !label) { hubToast('⚠️ Completa fecha y descripción', 'warn'); return; }
    // Convertir de YYYY-MM-DD a DD/MM/YYYY para compatibilidad
    const [y,m,d] = fechaRaw.split('-');
    const fecha = `${d}/${m}/${y}`;
    const cct = _getCct?.() || window.currentPerfil?.escuela_cct;
    // Guardar en Supabase
    try {
      if (window.sb && cct) {
        await window.sb.from('eventos').insert({
          escuela_cct: cct, fecha: fechaRaw, tipo, label,
          ciclo: window.CICLO_ACTIVO || '2025-2026', activo: true,
          creado_por: window.currentPerfil?.id || null,
        });
      }
    } catch(e) { console.warn('[Cal] Supabase:', e.message); }
    // También en localStorage como respaldo
    _dirEventos.push({ fecha, label, tipo });
    localStorage.setItem('siembra_dir_eventos', JSON.stringify(_dirEventos));
    dirRenderCalendario();
    hubToast('✅ Evento agregado al calendario', 'ok');
  });
}
function dirExportarCalendario() {
  const todos = [..._DIR_EVENTOS_DEFAULT, ..._dirEventos].sort((a,b) => a.fecha.localeCompare(b.fecha));
  const csv = 'ï»¿' + 'Fecha,Tipo,Evento\r\n' + todos.map(e => `${e.fecha},${e.tipo},"${e.label}"`).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'calendario_escolar_2025-2026.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  hubToast('✅ Calendario exportado', 'ok');
}

// ── Dir-portal: CTE ──────────────────────────────────────────────────
let _dirCte = JSON.parse(localStorage.getItem('siembra_dir_cte') || '[]');

// Carga sesiones CTE desde Supabase (con fallback a localStorage)
async function dirCargarCte() {
  const cct = _getCct?.() || window.currentPerfil?.escuela_cct;
  if (!window.sb || !cct) { dirRenderCte(); return; }
  try {
    const { data } = await window.sb.from('pemc')
      .select('*').eq('escuela_cct', cct).eq('tipo', 'cte_sesion')
      .eq('ciclo', window.CICLO_ACTIVO || '2025-2026').order('created_at');
    if (data?.length) {
      _dirCte = data.map(r => ({
        numero: r.numero_sesion || parseInt(r.contenido?.match(/\d+/)?.[0] || '0'),
        fecha: r.fecha_sesion || '',
        tema: r.contenido || '',
        acuerdos: r.acuerdos || '',
        guardado: r.created_at,
        db_id: r.id,
      }));
      localStorage.setItem('siembra_dir_cte', JSON.stringify(_dirCte));
    }
  } catch(e) { console.warn('[CTE]', e.message); }
  dirRenderCte();
}

function dirRenderCte() {
  const grid = document.getElementById('dir-cte-grid');
  if (!grid) return;
  const sesiones = Array.from({length: 8}, (_, i) => {
    const s = _dirCte.find(x => x.numero === i+1);
    return { num: i+1, data: s };
  });
  grid.innerHTML = sesiones.map(({num, data}) => `
    <div onclick="dirAbrirCte(${num})" style="background:${data?'#f0fdf4':'white'};border-radius:12px;border:1.5px solid ${data?'#86efac':'#e2e8f0'};padding:16px;text-align:center;cursor:pointer;transition:.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
      <div style="font-size:20px;margin-bottom:6px;">${data ? '✅' : '📋'}</div>
      <div style="font-size:12px;font-weight:700;">${num}ª Sesión</div>
      <div style="font-size:11px;color:#64748b;margin-top:3px;">${data ? data.fecha || 'Sin fecha' : 'Sin registrar'}</div>
    </div>`).join('');
  // Render acuerdos pendientes
  const acDiv = document.getElementById('dir-cte-acuerdos');
  if (acDiv) {
    const acuerdos = _dirCte.flatMap(s => (s.acuerdos || '').split('\n').filter(Boolean).map(a => ({sesion: s.numero, texto: a})));
    acDiv.innerHTML = acuerdos.length
      ? acuerdos.map(a => `<div style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;"><span style="background:#dbeafe;color:#1e40af;padding:1px 8px;border-radius:99px;font-size:11px;font-weight:700;margin-right:8px;">Sesión ${a.sesion}</span>${a.texto}</div>`).join('')
      : '<div style="padding:12px;color:#94a3b8;font-size:13px;">Todavía no hay acuerdos registrados para este periodo.</div>';
  }
}
function dirAbrirCte(num) {
  const s = _dirCte.find(x => x.numero === num) || {};
  // Convertir fecha guardada DD/MM/YYYY → YYYY-MM-DD para input date
  let fechaInput = '';
  if (s.fecha) {
    const parts = s.fecha.split('/');
    if (parts.length === 3) fechaInput = `${parts[2]}-${parts[1]}-${parts[0]}`;
    else fechaInput = s.fecha;
  }
  hubModal(`📋 ${num}ª Sesión CTE`, `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Fecha de la sesión</label>
        <input id="cte-fecha" type="date" value="${fechaInput}" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Tema principal</label>
        <input id="cte-tema" type="text" value="${(s.tema||'').replace(/"/g,'&quot;')}" placeholder="Ej: Evaluación diagnóstica" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Acuerdos tomados (uno por línea)</label>
        <textarea id="cte-acuerdos" rows="4" placeholder="Escribe cada acuerdo en una línea…" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;resize:vertical;">${s.acuerdos||''}</textarea>
      </div>
      <div>
        <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Asistentes (opcional)</label>
        <input id="cte-asistentes" type="text" value="${(s.asistentes||'').replace(/"/g,'&quot;')}" placeholder="Ej: 12 docentes, director, subdirector" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;outline:none;box-sizing:border-box;">
      </div>
    </div>`, 'Guardar sesión', async () => {
    const fechaRaw   = document.getElementById('cte-fecha')?.value || '';
    const tema       = document.getElementById('cte-tema')?.value?.trim() || '';
    const acuerdos   = document.getElementById('cte-acuerdos')?.value?.trim() || '';
    const asistentes = document.getElementById('cte-asistentes')?.value?.trim() || '';
    // Convertir YYYY-MM-DD → DD/MM/YYYY
    let fecha = fechaRaw;
    if (fechaRaw.includes('-')) { const [y,m,d] = fechaRaw.split('-'); fecha = `${d}/${m}/${y}`; }
    const nuevo = { numero: num, fecha, tema, acuerdos, asistentes, guardado: new Date().toISOString() };
    const idx = _dirCte.findIndex(x => x.numero === num);
    if (idx !== -1) _dirCte[idx] = { ..._dirCte[idx], ...nuevo }; else _dirCte.push(nuevo);
    localStorage.setItem('siembra_dir_cte', JSON.stringify(_dirCte));
    // Guardar en Supabase
    const cct = _getCct?.() || window.currentPerfil?.escuela_cct;
    try {
      if (window.sb && cct) {
        const payload = {
          escuela_cct: cct, tipo: 'cte_sesion',
          numero_sesion: num, fecha_sesion: fechaRaw || null,
          contenido: tema, acuerdos, asistentes,
          ciclo: window.CICLO_ACTIVO || '2025-2026',
          autor_id: window.currentPerfil?.id || null,
        };
        if (s.db_id) {
          await window.sb.from('pemc').update(payload).eq('id', s.db_id);
        } else {
          const { data: ins } = await window.sb.from('pemc').insert(payload).select('id').single();
          if (ins?.id && idx !== -1) _dirCte[idx].db_id = ins.id;
          else if (ins?.id) _dirCte[_dirCte.length-1].db_id = ins.id;
        }
        localStorage.setItem('siembra_dir_cte', JSON.stringify(_dirCte));
      }
    } catch(e) { console.warn('[CTE] Supabase:', e.message); }
    dirRenderCte();
    hubToast(`✅ ${num}ª Sesión CTE guardada`, 'ok');
  });
}
function dirCteSesion() {
  const next = (_dirCte.length || 0) + 1;
  if (next > 8) { hubToast('⚠️ Ya se completaron las 8 sesiones ordinarias', 'warn'); return; }
  dirAbrirCte(next);
}

// ── Dir-portal: Prefectos ────────────────────────────────────────────
let _dirPrefectos = JSON.parse(localStorage.getItem('siembra_dir_prefectos') || '[]');
function dirRenderPrefectos() {
  const grid = document.getElementById('dir-prefectos-grid');
  if (!grid) return;
  if (!_dirPrefectos.length) {
    grid.innerHTML = '<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:24px;text-align:center;"><div style="font-size:36px;margin-bottom:8px;">🛡️</div><div style="font-weight:700;">Aún no hay prefectos registrados</div><div style="font-size:12px;color:#94a3b8;margin-top:6px;">Da de alta al personal para comenzar control operativo y acompañamiento.</div></div>';
    return;
  }
  const colors = ['#7c3aed','#0369a1','#c2410c','#047857'];
  grid.innerHTML = _dirPrefectos.map((p, i) => `
    <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:18px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="width:42px;height:42px;border-radius:50%;background:${colors[i%colors.length]};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;">${p.nombre.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()}</div>
        <div><div style="font-size:13px;font-weight:700;">${p.nombre}</div><div style="font-size:11px;color:#64748b;">${p.turno||'—'} · ${p.grados||'—'}</div></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <span style="background:#f5f3ff;color:#7c3aed;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;">🛡️ Prefecto</span>
        ${p.turno ? `<span style="background:#f8fafc;color:#475569;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;">${p.turno}</span>` : ''}
      </div>
      <button onclick="dirEliminarPrefecto(${i})" style="margin-top:10px;width:100%;padding:6px;background:#fff1f2;border:1.5px solid #fecdd3;color:#be123c;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">✕ Eliminar</button>
    </div>`).join('');
}
function dirAltaPrefecto() {
  const nombre = prompt('Nombre completo del prefecto:');
  if (!nombre) return;
  const turno  = prompt('Turno: Matutino / Vespertino') || 'Matutino';
  const grados = prompt('Grados que atiende (ej: 1° y 2°):') || 'Todos';
  _dirPrefectos.push({ nombre, turno, grados, alta: new Date().toISOString() });
  localStorage.setItem('siembra_dir_prefectos', JSON.stringify(_dirPrefectos));
  dirRenderPrefectos();
  hubToast(`✅ Prefecto ${nombre} dado de alta`, 'ok');
}
function dirEliminarPrefecto(idx) {
  if (!confirm('¿Eliminar este prefecto?')) return;
  _dirPrefectos.splice(idx, 1);
  localStorage.setItem('siembra_dir_prefectos', JSON.stringify(_dirPrefectos));
  dirRenderPrefectos();
}

// ── TS-portal: Observaciones ─────────────────────────────────────────
let _tsObservaciones = JSON.parse(localStorage.getItem('siembra_ts_obs') || '[]');
function tsNuevaObservacion() {
  const alumno = document.getElementById('obs-filtro-alumno')?.value || prompt('Nombre del alumno:');
  if (!alumno) return;
  const tipo   = prompt('Tipo: Conductual / Académica / Asistencia / Salud / Familiar') || 'Conductual';
  const desc   = prompt('Descripción de la observación:');
  if (!desc) return;
  const urgente = confirm('¿Es urgente o requiere seguimiento inmediato?');
  _tsObservaciones.push({
    alumno, tipo, descripcion: desc, urgente,
    fecha: new Date().toLocaleDateString('es-MX'),
    guardado: new Date().toISOString(),
  });
  localStorage.setItem('siembra_ts_obs', JSON.stringify(_tsObservaciones));
  tsRenderObservaciones();
  hubToast('✅ Observación registrada', 'ok');
}
function tsRenderObservaciones() {
  const lista   = document.getElementById('tsp-obs-lista');
  const filtroA = document.getElementById('obs-filtro-alumno')?.value || '';
  const filtroT = document.getElementById('obs-filtro-tipo')?.value || '';
  if (!lista) return;
  const filtered = _tsObservaciones.filter(o =>
    (!filtroA || o.alumno === filtroA) &&
    (!filtroT || o.tipo === filtroT)
  );
  // Update stats
  const total   = document.getElementById('obs-stat-total');
  const urgentes= document.getElementById('obs-stat-urgentes');
  if (total)    total.textContent    = filtered.length;
  if (urgentes) urgentes.textContent = filtered.filter(o => o.urgente).length;
  if (!filtered.length) {
    lista.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;"><div style="font-size:36px;margin-bottom:10px;">📋</div><div style="font-weight:700;">Sin observaciones</div></div>';
    return;
  }
  const tipoColor = { Conductual:'#fef9c3', 'Académica':'#dbeafe', Asistencia:'#dcfce7', Salud:'#fee2e2', Familiar:'#f5f3ff' };
  const tipoText  = { Conductual:'#a16207', 'Académica':'#1e40af', Asistencia:'#166534', Salud:'#b91c1c', Familiar:'#7c3aed' };
  lista.innerHTML = filtered.map((o, i) => `
    <div style="display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid #f1f5f9;">
      <div style="width:38px;height:38px;border-radius:10px;background:#eff6ff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">📋</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
          <span style="font-size:13px;font-weight:700;">${o.alumno}</span>
          <span style="padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;background:${tipoColor[o.tipo]||'#f1f5f9'};color:${tipoText[o.tipo]||'#64748b'};">${o.tipo}</span>
          ${o.urgente ? '<span style="padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;background:#fee2e2;color:#b91c1c;">🚨 Urgente</span>' : ''}
          <span style="font-size:11px;color:#94a3b8;">${o.fecha}</span>
        </div>
        <div style="font-size:13px;color:#374151;">${o.descripcion}</div>
      </div>
      <button onclick="tsEliminarObservacion(${_tsObservaciones.indexOf(o)})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;padding:0;flex-shrink:0;" aria-label="Cerrar">✕</button>
    </div>`).join('');
}
function tsEliminarObservacion(idx) {
  if (!confirm('¿Eliminar esta observación?')) return;
  _tsObservaciones.splice(idx, 1);
  localStorage.setItem('siembra_ts_obs', JSON.stringify(_tsObservaciones));
  tsRenderObservaciones();
}

// Init functions for new pages when navigated to
// Nav patches — deferred to after DOM ready so originals exist
document.addEventListener('DOMContentLoaded', function() {
  const _origDirNav = window.dirNav;
  if (typeof _origDirNav === 'function') {
    window.dirNav = function(page) {
      _origDirNav(page);
      if (page === 'calendario') setTimeout(dirRenderCalendario, 50);
      if (page === 'cte')        setTimeout(dirCargarCte, 50);
      if (page === 'prefectos')  setTimeout(dirRenderPrefectos, 50);
    };
  }
  const _origTsNav = window.tsNav;
  if (typeof _origTsNav === 'function') {
    window.tsNav = function(page) {
      _origTsNav(page);
      if (page === 'observaciones') setTimeout(tsRenderObservaciones, 50);
    };
  }
}, { once: true });


// ══════════════════════════════════════════════════════════
// PROPAGACIÓN DE DATOS ENTRE PORTALES
// Los portales usan esta fuente de verdad compartida
// ══════════════════════════════════════════════════════════

/**
 * Obtiene alumnos desde la caché global (cargada por ADM)
 * o desde Supabase directamente si el admin no cargó datos.
 */
async function siembraGetAlumnos(escuelaCct) {
  if (window._siembraAlumnos?.length) return window._siembraAlumnos;
  if (!window.sb) return [];
  try {
    const cct = escuelaCct || window.currentPerfil?.escuela_cct;
    if (!cct) return [];
    const { data: d1 } = await sb.from('usuarios')
      .select('*, alumnos_grupos(grupo_id, grupos(nombre,grado))')
      .eq('escuela_cct', cct).eq('rol','alumno').eq('activo',true).order('nombre');
    const { data: d2 } = await sb.from('usuarios')
      .select('*, alumnos_grupos(grupo_id, grupos(nombre,grado))')
      .eq('escuela_id', cct).eq('rol','alumno').eq('activo',true).order('nombre');
    const combined = [...(d1||[]), ...(d2||[])];
    const seen = new Set();
    const result = combined.filter(u => { if(seen.has(u.id)) return false; seen.add(u.id); return true; });
    window._siembraAlumnos = result;
    return result;
  } catch(e) { return []; }
}

async function siembraGetGrupos(escuelaCct) {
  if (window._siembraGrupos?.length) return window._siembraGrupos;
  if (!window.sb) return [];
  try {
    const cct = escuelaCct || window.currentPerfil?.escuela_cct;
    const { data } = await sb.from('grupos').select('*').eq('escuela_cct', cct||'').eq('activo',true).order('grado');
    return window._siembraGrupos = data || [];
  } catch(e) { return []; }
}

async function siembraGetMaterias() {
  if (window._siembraMaterias?.length) return window._siembraMaterias;
  if (!window.sb) return [];
  try {
    const { data } = await sb.from('materias').select('*').eq('activo',true).order('nombre');
    if (data?.length) return window._siembraMaterias = data;
    // Return NEM defaults
    const nivel = window._nivelActivo || 'primaria';
    const lista = nivel === 'secundaria'
      ? ['Español','Matemáticas','Ciencias (Física)','Ciencias (Química)','Ciencias (Biología)','Historia','Geografía','Formación Cívica y Ética','Tecnología','Educación Física','Artes','Inglés']
      : ['Lengua Materna (Español)','Matemáticas','Conocimiento del Medio','Ciencias Naturales','Historia','Geografía','Formación Cívica y Ética','Educación Física','Educación Artística','Inglés'];
    return window._siembraMaterias = lista.map((n,i) => ({id:'m-'+i, nombre:n, nivel, horas_semana:5, activo:true}));
  } catch(e) { return []; }
}

// Poblar un <select> con alumnos
async function siembraPopularSelectAlumnos(selectId, placeholder) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const alumnos = await siembraGetAlumnos();
  const ph = placeholder || 'Seleccionar alumno…';
  sel.innerHTML = `<option value="">${ph}</option>` +
    alumnos.map(a => {
      const nom = (a.nombre + ' ' + (a.apellido_p||a.apellido||'')).trim();
      const grp = a.alumnos_grupos?.[0]?.grupos?.nombre || '';
      return `<option value="${a.id}">${nom}${grp?' · '+grp:''}</option>`;
    }).join('');
}

// Poblar un <select> con grupos
async function siembraPopularSelectGrupos(selectId, placeholder) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const grupos = await siembraGetGrupos();
  const ph = placeholder || 'Todos los grupos';
  sel.innerHTML = `<option value="">${ph}</option>` +
    grupos.map(g => `<option value="${g.id}">${g.nombre||g.grado+'°'}</option>`).join('');
}

// Listen for data-loaded event to update all selects in any portal
window.addEventListener('siembra:datos-cargados', (e) => {
  const { alumnos, grupos, materias } = e.detail;
  // Update TS portal alumno select
  const tsAlumnoSel = document.getElementById('obs-filtro-alumno');
  if (tsAlumnoSel && alumnos.length) {
    tsAlumnoSel.innerHTML = '<option value="">Todos los alumnos</option>' +
      alumnos.map(a => {
        const nom = (a.nombre + ' ' + (a.apellido_p||a.apellido||'')).trim();
        return `<option value="${nom}">${nom}</option>`;
      }).join('');
  }
  // Update ficha de inscripción select
  const fichaAlumnoSel = document.getElementById('nem-ficha-alumno-sel');
  if (fichaAlumnoSel && alumnos.length) {
    fichaAlumnoSel.innerHTML = '<option value="">Seleccionar alumno…</option>' +
      alumnos.map(a => {
        const nom = (a.nombre + ' ' + (a.apellido_p||a.apellido||'')).trim();
        return `<option value="${a.id}">${nom}</option>`;
      }).join('');
  }
  // Update boleta NEM alumno select
  const boletaAlumnoSel = document.getElementById('nem-boleta-alumno');
  if (boletaAlumnoSel && alumnos.length) {
    boletaAlumnoSel.innerHTML = '<option value="">Seleccionar alumno…</option>' +
      alumnos.map(a => {
        const nom = (a.nombre + ' ' + (a.apellido_p||a.apellido||'')).trim();
        const grp = a.alumnos_grupos?.[0]?.grupos?.nombre || '';
        return `<option value="${a.id}">${nom}${grp?' · '+grp:''}</option>`;
      }).join('');
  }
  // Update bienestar/NEE familia select
  const famAlumnoSel = document.getElementById('adm-p-familia-alumno');
  if (famAlumnoSel && alumnos.length) {
    famAlumnoSel.innerHTML = '<option value="">Seleccionar alumno…</option>' +
      alumnos.map(a => {
        const nom = (a.nombre + ' ' + (a.apellido_p||a.apellido||'')).trim();
        return `<option value="${a.id}">${nom}</option>`;
      }).join('');
  }
  // Update docente-portal alumno selectors if any exist
  document.querySelectorAll('.siembra-alumno-select').forEach(sel => {
    const ph = sel.getAttribute('data-placeholder') || 'Seleccionar alumno…';
    sel.innerHTML = `<option value="">${ph}</option>` +
      alumnos.map(a => {
        const nom = (a.nombre + ' ' + (a.apellido_p||a.apellido||'')).trim();
        const grp = a.alumnos_grupos?.[0]?.grupos?.nombre || '';
        return `<option value="${a.id}" data-grupo="${grp}">${nom}${grp?' · '+grp:''}</option>`;
      }).join('');
  });
  console.log('[SIEMBRA] Datos propagados a todos los portales:', alumnos.length, 'alumnos,', grupos.length, 'grupos,', materias.length, 'materias');
});


// ══════════════════════════════════════════════════════════════════════
// SISTEMA DE NIVELES — Primaria / Secundaria / Ambas
// ══════════════════════════════════════════════════════════════════════

// Nivel activo en el panel admin (se resolverá correctamente en ADM.init)
window._admNivelActivo = localStorage.getItem('siembra_adm_nivel') || null;

/**
 * Cambia el nivel activo en el panel de administración.
 * Recarga grupos, alumnos y materias filtrados por ese nivel.
 */
async function admCambiarNivel(nivel) {
  // Sincronizar AMBAS variables para que todo el sistema use el nivel correcto
  window._admNivelActivo = nivel;
  window._nivelActivo    = nivel;  // ← esto es lo que lee el Proxy MATERIAS_NEM
  ADM.escuelaNivel       = nivel;
  try { localStorage.setItem('siembra_adm_nivel', nivel); } catch(e) {}
  try { localStorage.setItem('siembra_nivel', nivel); } catch(e) {}

  // Update button styles
  const btnPri = document.getElementById('adm-nivel-btn-pri');
  const btnSec = document.getElementById('adm-nivel-btn-sec');
  if (btnPri) {
    btnPri.style.background = nivel === 'primaria' ? '#0d5c2f' : 'transparent';
    btnPri.style.color      = nivel === 'primaria' ? 'white'   : '#64748b';
  }
  if (btnSec) {
    btnSec.style.background = nivel === 'secundaria' ? '#1e40af' : 'transparent';
    btnSec.style.color      = nivel === 'secundaria' ? 'white'   : '#64748b';
  }

  // Reload data for the selected nivel

  await Promise.all([
    admCargarGruposNivel(nivel),
    admCargarAlumnosNivel(nivel),
    admCargarMateriasNivel(nivel),
  ]);

  // Re-render current page
  ADM.renderDashboard();
  ADM.renderGrupos();
  ADM.renderDocentes();
  ADM.renderAlumnos();
  ADM.renderMaterias();
  ADM.popularSelects();

  hubToast(`✅ Viendo ${nivel === 'primaria' ? 'Primaria' : 'Secundaria'}`, 'ok');
}

async function admCargarGruposNivel(nivel) {
  if (!window.ADM) return;
  if (!window.sb || !window.currentPerfil?.escuela_cct) { ADM.grupos = []; return; }
  try {
    const cct = window.currentPerfil.escuela_cct;
    const { data: d1 } = await sb.from('grupos').select('*')
      .eq('escuela_cct', cct).eq('nivel', nivel).eq('activo', true).order('grado');
    const d2 = [];
    const combined = [...(d1||[]), ...(d2||[])];
    const seen = new Set();
    ADM.grupos = combined.filter(g => { if(seen.has(g.id)) return false; seen.add(g.id); return true; });
  } catch(e) { ADM.grupos = []; }
}

async function admCargarAlumnosNivel(nivel) {
  if (!window.ADM) return;
  if (!window.sb || !window.currentPerfil?.escuela_cct) { ADM.alumnos = []; return; }
  try {
    const cct = window.currentPerfil.escuela_cct;
    // Get grupo IDs for this nivel
    const grupoIds = ADM.grupos.map(g => g.id);
    if (!grupoIds.length) { ADM.alumnos = []; return; }

    const { data } = await sb.from('alumnos_grupos')
      .select('alumno_id, grupo_id, grupos(nombre,grado,nivel), usuarios!alumno_id(*)')
      .in('grupo_id', grupoIds).eq('activo', true);

    ADM.alumnos = (data || []).map(row => ({
      ...row.usuarios,
      alumnos_grupos: [{ grupo_id: row.grupo_id, grupos: row.grupos }],
    })).filter(a => a.id);
  } catch(e) { ADM.alumnos = []; }
}

async function admCargarMateriasNivel(nivel) {
  if (!window.ADM) return;
  if (!window.sb) { ADM.materias = ADM._materiasDefault ? ADM._materiasDefault() : []; return; }
  try {
    const { data } = await sb.from('materias')
      .select('*').eq('nivel', nivel).eq('activo', true).order('nombre');
    if (data?.length) {
      ADM.materias = data;
    } else {
      // Seed NEM materias for this nivel
      ADM.materias = (ADM._materiasDefault ? ADM._materiasDefault() : [])
        .filter(m => m.nivel === nivel || !m.nivel);
    }
    window._siembraMaterias = ADM.materias;
  } catch(e) { ADM.materias = []; }
}

/**
 * Inicializa el selector de nivel en el topbar del admin.
 * Se llama desde ADM.init() después de cargar el perfil.
 */
function admInicializarSwitcherNivel() {
  // Usar el nivel de la ESCUELA (resuelto en ADM.init desde tabla escuelas)
  // NUNCA usar 'primaria' como fallback sin verificar la escuela primero
  const escuelaNivel = ADM.escuelaNivel || window._admNivelActivo
    || window._escuelaCfg?.nivel_default || 'secundaria';
  const switcher = document.getElementById('adm-nivel-switcher');

  if (escuelaNivel === 'primaria_y_secundaria' || escuelaNivel === 'ambos') {
    // Escuela maneja ambos niveles — mostrar switcher
    if (switcher) switcher.style.display = 'flex';
    // Respetar lo que el admin eligió en esta sesión, pero sin asumir primaria
    const savedNivel = localStorage.getItem('siembra_adm_nivel') || escuelaNivel || 'secundaria';
    window._admNivelActivo = savedNivel;
    ADM.escuelaNivel = savedNivel;
    admCambiarNivel(savedNivel);
  } else {
    // Escuela de nivel único — ocultar switcher, forzar nivel correcto
    if (switcher) switcher.style.display = 'none';
    window._admNivelActivo = escuelaNivel;
    ADM.escuelaNivel = escuelaNivel;
    try { localStorage.setItem('siembra_adm_nivel', escuelaNivel); } catch(e) {}
    // Actualizar visualmente los botones del switcher
    const btnPri = document.getElementById('adm-nivel-btn-pri');
    const btnSec = document.getElementById('adm-nivel-btn-sec');
    if (btnPri) btnPri.style.background = escuelaNivel === 'primaria' ? 'var(--verde)' : '';
    if (btnSec) btnSec.style.background = escuelaNivel === 'secundaria' ? 'var(--verde)' : '';
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// INITS Y DATA LOADERS — dir, coord, subdir + doc calificaciones/horario
// ═══════════════════════════════════════════════════════════════════════════

// ── Shared helper: get escuela CCT for current user ───────────────────────
function _getCct() {
  return window.currentPerfil?.escuela_cct
    || window.ADM?.escuelaCct
    || window._escuelaCfg?.cct
    || null;
}

function dirToggleEscuelaDrop() {
  const drop = document.getElementById('dir-escuela-dropdown');
  if (!drop) return;
  const visible = drop.style.display !== 'none';
  drop.style.display = visible ? 'none' : 'block';
  if (!visible) dirRenderEscuelaSwitcher();
}
// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', function(e) {
  const sw = document.getElementById('dir-escuela-switcher');
  if (sw && !sw.contains(e.target)) {
    const drop = document.getElementById('dir-escuela-dropdown');
    if (drop) drop.style.display = 'none';
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DIR-PORTAL — director académico
// ═══════════════════════════════════════════════════════════════════════════
async function dirInit() {
  const perfil = window.currentPerfil || {};
  const sbRef  = window.sb;
  // Paso 1: Resolver escuela real del perfil
  if (sbRef && (!perfil.escuela_cct || !perfil.escuela_nombre)) {
    try {
      // Intento A: buscar por escuela_id (UUID)
      if (perfil.escuela_id) {
        const { data: esc } = await sbRef.from('escuelas')
          .select('cct, nombre, nivel, nivel_default')
          .eq('id', perfil.escuela_id).maybeSingle();
        if (esc?.cct) {
          perfil.escuela_cct = esc.cct;
          perfil.escuela_nombre = esc.nombre || perfil.escuela_nombre;
          if (!window._nivelActivo && esc.nivel) window._nivelActivo = esc.nivel === 'primaria_y_secundaria' ? (esc.nivel_default || 'secundaria') : esc.nivel;
        }
      }
      // Intento B: tabla usuario_escuelas (multi-escuela)
      if (!perfil.escuela_cct || !perfil.escuela_nombre) {
        const { data: ues } = await sbRef.from('usuario_escuelas')
          .select('escuela_cct, activo, escuelas(id,cct,nombre,nivel,nivel_default)')
          .eq('usuario_id', perfil.id).eq('activo', true).limit(10);
        if (ues?.length) {
          window._dirEscuelas = ues.map(r => r.escuelas || { cct: r.escuela_cct });
          const primera = window._dirEscuelas[0];
          perfil.escuela_cct = perfil.escuela_cct || primera.cct;
          perfil.escuela_nombre = perfil.escuela_nombre || primera.nombre || primera.cct;
          if (!window._nivelActivo && primera.nivel)
            window._nivelActivo = primera.nivel === 'primaria_y_secundaria' ? (primera.nivel_default || 'secundaria') : primera.nivel;
        }
      }
      // Intento C: buscar por CCT cuando solo falta el nombre
      if (perfil.escuela_cct && !perfil.escuela_nombre) {
        const { data: escPorCct } = await sbRef.from('escuelas')
          .select('nombre, nivel, nivel_default')
          .eq('cct', perfil.escuela_cct).maybeSingle();
        if (escPorCct) {
          perfil.escuela_nombre = escPorCct.nombre || perfil.escuela_cct;
          if (!window._nivelActivo && escPorCct.nivel)
            window._nivelActivo = escPorCct.nivel === 'primaria_y_secundaria' ? (escPorCct.nivel_default || 'secundaria') : escPorCct.nivel;
        }
      }
      // Intento D: fallback a _escuelaCfg
      if ((!perfil.escuela_cct || !perfil.escuela_nombre) && window._escuelaCfg?.cct) {
        perfil.escuela_cct = perfil.escuela_cct || window._escuelaCfg.cct;
        perfil.escuela_nombre = perfil.escuela_nombre || window._escuelaCfg.nombre || window._escuelaCfg.cct;
      }
    } catch(e) { console.warn('[dirInit] resolucion escuela:', e.message); }
  }

  // ── PASO 2: Cargar lista de escuelas del director (multi-escuela) ────────
  if (!window._dirEscuelas && perfil.escuela_cct && sbRef) {
    try {
      const { data: ues } = await sbRef.from('usuario_escuelas')
        .select('escuela_cct, escuelas(id,cct,nombre,nivel,nivel_default)')
        .eq('usuario_id', perfil.id).eq('activo', true).limit(20);
      window._dirEscuelas = ues?.length
        ? ues.map(r => r.escuelas || { cct: r.escuela_cct })
        : [{ cct: perfil.escuela_cct, nombre: perfil.escuela_nombre || perfil.escuela_cct }];
    } catch(e) { window._dirEscuelas = [{ cct: perfil.escuela_cct, nombre: perfil.escuela_nombre || perfil.escuela_cct }]; }
  }

  // ── PASO 3: Actualizar UI con datos reales ───────────────────────────────
  const nombreReal  = `${perfil.nombre||''} ${perfil.apellido_p||''}`.trim() || 'Director';
  const iniciales   = ((perfil.nombre||'')[0]||'') + ((perfil.apellido_p||'')[0]||'');
  const rolLabel    = { director:'Director', subdirector:'Subdirector', coordinador:'Coordinador', admin:'Admin' }[perfil.rol] || 'Director';
  const escuelaNom  = perfil.escuela_nombre || window.ESCUELA_ACTIVA?.nombre || window._escuelaCfg?.nombre || perfil.escuela_cct || window.ESCUELA_ACTIVA?.cct || 'Mi Escuela';
  const escuelas    = window._dirEscuelas || [];

  const sbAvatar = document.getElementById('dir-sb-avatar');
  const sbName   = document.getElementById('dir-sb-name');
  const sbRole   = document.getElementById('dir-sb-role');
  if (sbAvatar) sbAvatar.textContent = iniciales.toUpperCase() || 'D';
  if (sbName)   sbName.textContent   = nombreReal;
  if (sbRole)   sbRole.textContent   = `${rolLabel} · ${escuelaNom}`;

  // Selector de escuela en topbar
  const topSwEl = document.getElementById('dir-escuela-switcher');
  const topNomEl = document.getElementById('dir-escuela-nombre-top');
  if (topNomEl) topNomEl.textContent = escuelaNom;
  if (topSwEl) {
    topSwEl.style.display = '';
    topSwEl.title = escuelas.length > 1 ? `${escuelas.length} escuelas — clic para cambiar` : escuelaNom;
  }
  dirRenderEscuelaSwitcher();

  // ── PASO 4: Cargar datos ────────────────────────────────────────────────
  await Promise.all([
    dirCargarDocentes(),
    dirCargarGrupos(),
    dirCargarHorarios(),
    dirCargarStats(),
    typeof dirCargarDatosDB === 'function' ? dirCargarDatosDB() : Promise.resolve(),
    _dirCargarConfigEscuela(),
  ]);

  dirNav(window._modoCoordinador ? 'docentes' : 'dashboard');
  if (typeof dirSuscribirAlertas === 'function') dirSuscribirAlertas();
}

function dirRenderEscuelaSwitcher() {
  const escuelas = window._dirEscuelas || [];
  const perfil   = window.currentPerfil || {};
  const topSwEl  = document.getElementById('dir-escuela-switcher');
  const dropEl   = document.getElementById('dir-escuela-dropdown');
  if (!topSwEl || !dropEl) return;

  if (escuelas.length <= 1) { dropEl.style.display = 'none'; return; }

  dropEl.innerHTML = escuelas.map(e => {
    const activa = e.cct === perfil.escuela_cct;
    return `<div onclick="dirCambiarEscuela('${e.cct}','${(e.nombre||e.cct).replace(/'/g,"\\'")}',this.closest('#dir-escuela-dropdown'))"
      style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;background:${activa?'#f0fdf4':'white'};border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:${activa?'700':'400'};">
      <span style="font-size:16px;">🏫</span>
      <div><div style="color:#0f172a;">${e.nombre||e.cct}</div><div style="font-size:11px;color:#94a3b8;">${e.cct||''}</div></div>
      ${activa?'<span style="margin-left:auto;color:#059669;font-size:14px;">✓</span>':''}
    </div>`;
  }).join('');
}

// ── Configuración de evaluación del director ──
async function _dirCargarConfigEscuela() {
  const perfil = window.currentPerfil || {};
  const cct = perfil.escuela_cct
    || window._escuelaCfg?.cct
    || (typeof _getCct === 'function' ? _getCct() : null)
    || window._dirEscuelas?.[0]?.cct;
  if (!sb || !cct) return;
  try {
    const { data } = await sb.from('escuelas')
      .select('config_evaluacion')
      .eq('cct', cct).maybeSingle();
    if (data) {
      window._escuelaConfig = data;
      // Publicar CAL_CONFIG globalmente para que calInit() y otros módulos lo consuman
      const cfg = data.config_evaluacion || {};
      window.CAL_CONFIG = {
        num_periodos:        cfg.num_periodos        || 3,
        nombre_periodo:      cfg.nombre_periodo      || 'Trimestre',
        escala:              cfg.escala              || '1-10',
        minimo_aprobatorio:  cfg.minimo_aprobatorio  != null ? cfg.minimo_aprobatorio  : 6,
        minimo_recuperacion: cfg.minimo_recuperacion != null ? cfg.minimo_recuperacion : 6,
        usa_nem_materias:    cfg.usa_nem_materias    !== false,
      };
    }
  } catch(e) { console.warn('[dirConfig]', e.message); }
}

async function dirCambiarEscuela(cct, nombre, dropEl) {
  if (dropEl) dropEl.style.display = 'none';
  const perfil = window.currentPerfil;
  if (!perfil || perfil.escuela_cct === cct) return;
  perfil.escuela_cct    = cct;
  perfil.escuela_nombre = nombre;
  const sbNomEl  = document.getElementById('dir-sb-role');
  const topNomEl = document.getElementById('dir-escuela-nombre-top');
  const rolLabel = { director:'Director', subdirector:'Subdirector' }[perfil.rol] || 'Director';
  if (sbNomEl)  sbNomEl.textContent  = `${rolLabel} · ${nombre}`;
  if (topNomEl) topNomEl.textContent = nombre;
  showToast(`🏫 Escuela: ${nombre}`);
  // Recargar datos para la nueva escuela
  docentes.length = 0; grupos.length = 0;
  await Promise.all([dirCargarDocentes(), dirCargarGrupos(), dirCargarStats(),
    typeof dirCargarDatosDB === 'function' ? dirCargarDatosDB() : Promise.resolve()]);
  dirNav('dashboard');
}

function dirRenderDocentes() {
  // Sincroniza window._dirDocentes → docentes[] global y re-renderiza
  if (window._dirDocentes?.length) {
    docentes.length = 0;
    window._dirDocentes.forEach((d, i) => {
      const existing = docentes.find(x => x.db_id === d.id);
      if (!existing) {
        const nom = `${d.nombre||''} ${d.apellido_p||''}`.trim();
        const ini = ((d.nombre||'')[0]||'') + ((d.apellido_p||'')[0]||'');
        const materiasList = (d.docente_grupos||[]).map(dg => dg.materia).filter(Boolean);
        const gruposList = (d.docente_grupos||[]).map(dg => dg.grupos?.nombre).filter(Boolean);
        docentes.push({
          id: i, db_id: d.id,
          nombre: nom, ini: ini.toUpperCase(),
          materias: materiasList.length ? materiasList : ['—'],
          grupos: gruposList.length ? gruposList : [],
          horas: materiasList.length * 5,
          estado: 'enviado', email: d.email, rol: d.rol
        });
      }
    });
  }
  renderDocentes();
}

async function dirCargarDocentes() {
  const cct = _getCct();
  if (!cct || !window.sb) { window._dirDocentes = []; dirRenderDocentes(); return; }
  try {
    const { data: d1 } = await sb.from('usuarios')
      .select('*, docente_grupos(grupo_id, materia, grupos(nombre,grado))')
      .eq('escuela_cct', cct)
      .in('rol', ['docente','tutor','coordinador','subdirector','director','ts','prefecto'])
      .eq('activo', true).order('nombre');
    const { data: d2 } = await sb.from('usuarios')
      .select('*, docente_grupos(grupo_id, materia, grupos(nombre,grado))')
      .eq('escuela_id', cct)
      .in('rol', ['docente','tutor','coordinador','subdirector','director','ts','prefecto'])
      .eq('activo', true).order('nombre');
    const combined = [...(d1||[]), ...(d2||[])];
    const seen = new Set();
    window._dirDocentes = combined.filter(d => { if(seen.has(d.id)) return false; seen.add(d.id); return true; });
  } catch(e) {
    console.warn('[dir] cargarDocentes:', e.message);
    window._dirDocentes = [];
  }
  dirRenderDocentes();
}

async function dirCargarGrupos() {
  const cct = _getCct();
  if (!cct || !window.sb) { window._dirGrupos = []; return; }
  try {
    const { data: d1 } = await sb.from('grupos').select('*, alumnos_grupos(count)').eq('escuela_cct', cct).eq('activo', true).order('grado');
    const { data: d2 } = await sb.from('grupos').select('*, alumnos_grupos(count)').eq('escuela_cct', cct).eq('activo', true).order('grado');
    const combined = [...(d1||[]), ...(d2||[])];
    const seen = new Set();
    window._dirGrupos = combined.filter(g => { if(seen.has(g.id)) return false; seen.add(g.id); return true; });
  } catch(e) { window._dirGrupos = []; }
}

async function dirCargarHorarios() {
  const cct = _getCct();
  if (!cct || !window.sb) return;
  try {
    const { data } = await sb.from('horarios_docente')
      .select('*, usuarios!docente_id(nombre), grupos!grupo_id(nombre,grado)')
      .eq('escuela_id', cct).eq('activo', true);
    window._dirHorarios = data || [];
  } catch(e) { window._dirHorarios = []; }
}

async function dirCargarStats() {
  const cct = _getCct();
  if (!cct || !window.sb) return;
  try {
    const nivelActivo = window._dirNivelActivo || window._admNivelActivo || 'secundaria';
    const [
      { count: alumnosCount },
      { count: docentesCount },
      { count: gruposCount },
    ] = await Promise.all([
      sb.from('alumnos').select('*', { count:'exact', head:true }).eq('escuela_cct', cct).eq('activo', true),
      sb.from('perfiles').select('*', { count:'exact', head:true }).eq('escuela_cct', cct).eq('rol', 'docente').eq('activo', true),
      sb.from('grupos').select('id', { count:'exact', head:true }).eq('escuela_cct', cct).eq('activo', true),
    ]);
    const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v??0; };
    // Update KPI stat cards
    set('dir-stat-alumnos',   alumnosCount  || 0);
    set('dir-stat-docentes',  docentesCount || 0);
    set('dir-stat-grupos',    gruposCount   || 0);
    // Fallback to usuarios table if perfiles returns 0
    if (!docentesCount) {
      const { count: docentesAlt } = await sb.from('usuarios').select('id', { count:'exact', head:true })
        .eq('escuela_cct', cct).in('rol',['docente','tutor']).eq('activo', true);
      set('dir-stat-docentes', docentesAlt || 0);
    }
    if (!alumnosCount) {
      const { count: alumnosAlt } = await sb.from('usuarios').select('id', { count:'exact', head:true })
        .eq('escuela_cct', cct).eq('rol', 'alumno').eq('activo', true);
      set('dir-stat-alumnos', alumnosAlt || 0);
    }
  } catch(e) { console.warn('[dirCargarStats]', e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════
// COORD-PORTAL — coordinador académico
// ═══════════════════════════════════════════════════════════════════════════
async function coordInit() {
  const nameEl = document.getElementById('coord-nombre');
  if (nameEl && currentPerfil?.nombre) nameEl.textContent = currentPerfil.nombre;
  const topTag = document.getElementById('coord-escuela-nombre');
  if (topTag && currentPerfil) topTag.textContent = currentPerfil.escuela_nombre || currentPerfil.escuela_cct || 'Mi escuela';

  await Promise.all([
    coordCargarDocentes(),
    coordCargarVisitas(),
    coordCargarCalificaciones(),
  ]);

  coordNav('dashboard');
}

async function coordCargarCalificaciones() {
  const cct = _getCct();
  if (!cct || !window.sb) return;
  try {
    const { data } = await sb.from('calificaciones')
      .select('*, alumno:usuarios!alumno_id(nombre,apellido_p), grupo:grupos!grupo_id(nombre,grado)')
      .eq('escuela_cct', cct)
      .eq('ciclo', window.CICLO_ACTIVO || '2025-2026')
      .order('created_at', { ascending:false }).limit(500);
    window._coordCalificaciones = data || [];
    // Calculate alumnos en riesgo (avg < 6)
    const porAlumno = {};
    (data||[]).forEach(c => {
      if (!porAlumno[c.alumno_id]) porAlumno[c.alumno_id] = { vals:[], nombre:`${c.alumno?.nombre||''} ${c.alumno?.apellido_p||''}`.trim(), grupo:c.grupo?.nombre };
      if (c.calificacion != null) porAlumno[c.alumno_id].vals.push(parseFloat(c.calificacion));
    });
    window._coordEnRiesgo = Object.entries(porAlumno)
      .filter(([_,v]) => v.vals.length && v.vals.reduce((s,x)=>s+x,0)/v.vals.length < 6)
      .map(([id,v]) => ({ id, ...v, prom:(v.vals.reduce((s,x)=>s+x,0)/v.vals.length).toFixed(1) }));
    console.log('[COORD] En riesgo:', window._coordEnRiesgo.length);
  } catch(e) { console.warn('[COORD] cal:', e.message); }
}

async function coordCargarDocentes() {
  const cct = _getCct();
  if (!cct || !window.sb) { window._coordDocentes = []; return; }
  try {
    const { data: d1 } = await sb.from('usuarios')
      .select('*, docente_grupos(grupo_id, materia, grupos(nombre,grado))')
      .eq('escuela_cct', cct).in('rol',['docente','tutor']).eq('activo',true).order('nombre');
    const { data: d2 } = await sb.from('usuarios')
      .select('*, docente_grupos(grupo_id, materia, grupos(nombre,grado))')
      .eq('escuela_id', cct).in('rol',['docente','tutor']).eq('activo',true).order('nombre');
    const combined = [...(d1||[]), ...(d2||[])];
    const seen = new Set();
    window._coordDocentes = combined.filter(d => { if(seen.has(d.id)) return false; seen.add(d.id); return true; });
    // Populate docente selects in coord portal
    ['coord-visita-docente','coord-libreta-docente','coord-eval-docente'].forEach(selId => {
      const sel = document.getElementById(selId);
      if (!sel) return;
      sel.innerHTML = '<option value="">Seleccionar docente…</option>' +
        window._coordDocentes.map(d => `<option value="${d.id}">${d.nombre} ${d.apellido_p||''}</option>`).join('');
    });
  } catch(e) { window._coordDocentes = []; }
}

async function coordCargarVisitas() {
  const userId = currentUser?.id || currentPerfil?.id;
  if (!userId || !window.sb) { window._coordVisitas = []; coordRenderVisitas(); return; }
  try {
    const { data } = await sb.from('observaciones')
      .select('*, usuarios!docente_id(nombre, apellido_p)')
      .eq('coordinador_id', userId).order('fecha', { ascending: false });
    window._coordVisitas = data || [];
  } catch(e) { window._coordVisitas = []; }
  coordRenderVisitas();
}

async function coordGuardarVisita(docenteId, tipo, obs, compromisos) {
  const userId = currentUser?.id || currentPerfil?.id;
  const cct    = _getCct();
  const payload = {
    coordinador_id: userId,
    docente_id:     docenteId,
    tipo:           tipo || 'acompañamiento',
    observaciones:  obs,
    compromisos:    compromisos || '',
    fecha:          new Date().toISOString().split('T')[0],
    escuela_cct:    cct,
    ciclo: window.CICLO_ACTIVO,
  };
  try {
    if (window.sb) await sb.from('observaciones').insert(payload);
    if (!window._coordVisitas) window._coordVisitas = [];
    window._coordVisitas.unshift(payload);
    coordRenderVisitas();
    hubToast('✅ Visita de acompañamiento guardada', 'ok');
  } catch(e) { hubToast('❌ ' + e.message, 'err'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUBDIR-PORTAL — subdirector
// ═══════════════════════════════════════════════════════════════════════════
async function subdirCargarDocentes() {
  const cct = _getCct();
  if (!cct || !window.sb) { window._subdirDocentes = []; subdirRenderDocentes(); return; }
  try {
    const { data: d1 } = await sb.from('usuarios')
      .select('*, docente_grupos(grupo_id, materia, grupos(nombre,grado))')
      .eq('escuela_cct', cct).in('rol',['docente','tutor','prefecto']).eq('activo',true).order('nombre');
    const { data: d2 } = await sb.from('usuarios')
      .select('*, docente_grupos(grupo_id, materia, grupos(nombre,grado))')
      .eq('escuela_id', cct).in('rol',['docente','tutor','prefecto']).eq('activo',true).order('nombre');
    const combined = [...(d1||[]), ...(d2||[])];
    const seen = new Set();
    window._subdirDocentes = combined.filter(d => { if(seen.has(d.id)) return false; seen.add(d.id); return true; });
  } catch(e) { window._subdirDocentes = []; }
  subdirRenderDocentes();
}

async function subdirCargarPrefectos() {
  const cct = _getCct();
  if (!cct || !window.sb) return;
  try {
    const { data: d1 } = await sb.from('usuarios').select('*').eq('escuela_cct', cct).eq('rol','prefecto').eq('activo',true);
    const { data: d2 } = await sb.from('usuarios').select('*').eq('escuela_id', cct).eq('rol','prefecto').eq('activo',true);
    const combined = [...(d1||[]), ...(d2||[])];
    const seen = new Set();
    window._subdirPrefectos = combined.filter(d => { if(seen.has(d.id)) return false; seen.add(d.id); return true; });
  } catch(e) { window._subdirPrefectos = []; }
}

// ═══════════════════════════════════════════════════════════════════════════
// DOC-PORTAL — cargarCalificaciones y horario desde Supabase
// ═══════════════════════════════════════════════════════════════════════════
async function cargarCalificaciones(grupoId) {
  if (!grupoId || !window.sb) return null;
  try {
    const { data } = await sb.from('calificaciones')
      .select('*, usuarios!alumno_id(id, nombre, apellido_p, apellido_m)')
      .eq('grupo_id', grupoId)
      .eq('ciclo', window.CICLO_ACTIVO)
      .order('created_at', { ascending: false });
    return data || [];
  } catch(e) {
    console.warn('[doc] cargarCalificaciones:', e.message);
    return [];
  }
}

async function guardarCalificacion(alumnoId, grupoId, materia, periodo, valor, tipo) {
  if (!window.sb) { hubToast('Sin conexión a BD', 'warn'); return; }
  try {
    const { data: { user } } = await sb.auth.getUser();
    await sb.from('calificaciones').upsert({
      alumno_id:   alumnoId,
      grupo_id:    grupoId,
      materia:     materia,
      periodo:     periodo || '1er bimestre',
      valor:       valor,
      tipo:        tipo || 'bimestral',
      docente_id:  user?.id || currentUser?.id,
      ciclo: window.CICLO_ACTIVO,
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'alumno_id,grupo_id,materia,periodo,ciclo' });
    hubToast('✅ Calificación guardada', 'ok');
  } catch(e) { hubToast('❌ ' + e.message, 'err'); }
}

async function cargarHorarioDocente(docenteId) {
  if (!docenteId || !window.sb) return [];
  try {
    const { data } = await sb.from('horarios_docente')
      .select('*, grupos!grupo_id(nombre,grado)')
      .eq('docente_id', docenteId).eq('ciclo', window.CICLO_ACTIVO);
    return data || [];
  } catch(e) { return []; }
}

async function guardarPlaneacion(grupoId, materia, semana, campos) {
  if (!window.sb) {
    hubToast('Sin conexión — no se puede guardar la planeación', 'error');
    return;
  }
  const cct = typeof _getCct === 'function' ? _getCct() : (window.currentPerfil?.escuela_cct || null);
  const docenteId = window.currentPerfil?.id || window.currentUser?.id;
  if (!cct || !docenteId) { hubToast('Sesión no disponible', 'error'); return; }
  try {
    const payload = {
      docente_id:    docenteId,
      escuela_cct:   cct,
      materia:       materia,
      grupo:         grupoId || '',
      semana:        semana,
      ciclo:         window.CICLO_ACTIVO || '2025-2026',
      objetivo:      campos.objetivo || '',
      recursos:      campos.recursos || '',
      evaluacion:    campos.evaluacion || '',
      contenido_json: campos.contenido_json || campos || {},
      updated_at:    new Date().toISOString(),
    };
    await window.sb.from('planeaciones_clase').upsert(payload,
      { onConflict: 'docente_id,ciclo,semana,materia,grupo' });
    hubToast('✅ Planeación guardada en la nube', 'ok');
    await planCargarDesdeDB();
  } catch(e) {
    hubToast('Error al guardar planeación: ' + (e.message || e), 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PADRE-PORTAL — calificaciones y boleta reales
// ═══════════════════════════════════════════════════════════════════════════
async function pCargarCalificacionesReal(alumnoId) {
  if (!alumnoId || !window.sb) return null;
  try {
    const { data } = await sb.from('calificaciones')
      .select('materia, periodo, valor, tipo')
      .eq('alumno_id', alumnoId)
      .eq('ciclo', window.CICLO_ACTIVO)
      .order('periodo');
    return data || [];
  } catch(e) { return null; }
}

async function pCargarAsistenciaReal(alumnoId) {
  if (!alumnoId || !window.sb) return null;
  try {
    const { data } = await sb.from('asistencia')
      .select('fecha, estado')
      .eq('alumno_id', alumnoId)
      .gte('fecha', '2025-09-01')
      .order('fecha', { ascending: false });
    return data || [];
  } catch(e) { return null; }
}

function pRenderProgreso(calificaciones) {
  const cont = document.getElementById('p-progreso-cont');
  if (!cont || !calificaciones?.length) return;
  // Group by materia
  const por_materia = {};
  calificaciones.forEach(c => {
    if (!por_materia[c.materia]) por_materia[c.materia] = [];
    por_materia[c.materia].push(c);
  });
  cont.innerHTML = Object.entries(por_materia).map(([mat, cals]) => {
    const prom = cals.reduce((s,c) => s + parseFloat(c.valor||0), 0) / cals.length;
    const pct  = Math.min(100, Math.round(prom * 10));
    const color = prom >= 8 ? '#0d5c2f' : prom >= 6 ? '#ca8a04' : '#dc2626';
    return `<div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
        <span style="font-weight:600;">${mat}</span>
        <span style="font-weight:800;color:${color};">${prom.toFixed(1)}</span>
      </div>
      <div style="height:6px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:99px;transition:.4s;"></div>
      </div>
    </div>`;
  }).join('');
}

function pMostrarBoleta(alumnoNombre, calificaciones) {
  if (!calificaciones?.length) { hubToast('Sin calificaciones registradas', 'warn'); return; }
  const por_materia = {};
  calificaciones.forEach(c => {
    if (!por_materia[c.materia]) por_materia[c.materia] = {};
    por_materia[c.materia][c.periodo] = c.valor;
  });
  const periodos = ['1er bimestre','2do bimestre','3er bimestre','4to bimestre','5to bimestre'];
  const rows = Object.entries(por_materia).map(([mat, vals]) => {
    const celdas = periodos.map(p => `<td style="text-align:center;padding:8px 10px;border:1px solid #e2e8f0;">${vals[p] || '—'}</td>`).join('');
    const nums   = periodos.map(p => parseFloat(vals[p]||0)).filter(v=>v>0);
    const prom   = nums.length ? (nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(1) : '—';
    return `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">${mat}</td>${celdas}<td style="text-align:center;font-weight:800;padding:8px 10px;border:1px solid #e2e8f0;">${prom}</td></tr>`;
  }).join('');
  const html = `<div style="overflow-x:auto;">
    <div style="font-size:14px;font-weight:700;margin-bottom:14px;color:#0f172a;">${alumnoNombre} — Ciclo 2025-2026</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f0fdf4;">
        <th style="text-align:left;padding:8px 12px;border:1px solid #e2e8f0;">Materia</th>
        ${periodos.map(p=>`<th style="text-align:center;padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;">${p}</th>`).join('')}
        <th style="text-align:center;padding:8px 10px;border:1px solid #e2e8f0;">Promedio</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
  // Show in a modal or dedicated section
  const boletaEl = document.getElementById('p-boleta-cont');
  if (boletaEl) { boletaEl.innerHTML = html; boletaEl.style.display = 'block'; }
  else { hubToast('📋 Boleta cargada', 'ok'); }
}

// Patch pSetAlumno to load real calificaciones after setting alumno
const _pSetAlumnoOrig = typeof pSetAlumno === 'function' ? pSetAlumno : null;
async function pSetAlumnoConCalifs(alumno) {
  if (_pSetAlumnoOrig) await _pSetAlumnoOrig(alumno);
  // Load real calificaciones
  const cals = await pCargarCalificacionesReal(alumno.id);
  if (cals?.length) {
    pRenderProgreso(cals);
    window._alumnoCalificaciones = cals;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PATCH portal inits to use new loaders
// ═══════════════════════════════════════════════════════════════════════════
// coordInit and subdirInit are defined above as async functions
// subdirInit patch — runs after DOM ready so original function exists
document.addEventListener('DOMContentLoaded', function() {
  // Extend subdirInit to load real data
  const _origSubdirInit = window.subdirInit;
  window.subdirInit = async function() {
    if (typeof _origSubdirInit === 'function') _origSubdirInit();
    await Promise.all([
      typeof subdirCargarDocentes === 'function' ? subdirCargarDocentes() : Promise.resolve(),
      typeof subdirCargarPrefectos === 'function' ? subdirCargarPrefectos() : Promise.resolve(),
    ]);
  };
  // Extend coordNav to lazy-load visitas
  const _origCoordNav = window.coordNav;
  if (typeof _origCoordNav === 'function') {
    window.coordNav = function(page) {
      _origCoordNav(page);
      if (page === 'visitas' && !window._coordVisitas && typeof coordCargarVisitas === 'function') {
        coordCargarVisitas();
      }
    };
  }
}, { once: true });


function admAgregarMateriaExtra() {
  const inp  = document.getElementById('adm-p-materia-extra');
  const v    = inp?.value.trim();
  if (!v) return;
  const wrap = document.getElementById('adm-p-materias-checks');
  if (!wrap) return;
  const lbl  = document.createElement('label');
  lbl.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;cursor:pointer;padding:5px 10px;border:1.5px solid #0d5c2f;border-radius:8px;background:#f0fdf4;';
  const cb   = document.createElement('input');
  cb.type    = 'checkbox';
  cb.value   = v;
  cb.checked = true;
  cb.style.accentColor = '#0d5c2f';
  lbl.appendChild(cb);
  lbl.appendChild(document.createTextNode(' ' + v));
  wrap.appendChild(lbl);
  inp.value = '';
}


function instLimpiar() {
  if (!confirm('¿Restaurar configuración predeterminada? Se borrará la escuela configurada.')) return;
  try {
    localStorage.removeItem('siembra_escuela_cfg');
    localStorage.removeItem('siembra_supabase_url');
    localStorage.removeItem('siembra_supabase_key');
  } catch(e) {}
  hubToast('🗑 Configuración borrada. Recargando…', 'ok');
  setTimeout(() => location.reload(), 1200);
}

// ── coordSetCal (coordinador — evaluación de docentes) ────────────────
let coordCalificaciones = {};
function coordSetCal(key, valor, btn) {
  coordCalificaciones[key] = valor;
  // Re-colorear todos los botones del mismo criterio
  const prefix = key.substring(0, key.lastIndexOf('_') + 1);
  // Find sibling buttons by iterating the parent
  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('button').forEach((b, i) => {
      const n = i + 1;
      const sel = n <= valor;
      b.style.borderColor  = sel ? '#5b21b6' : '#d1d5db';
      b.style.background   = sel ? '#ede9fe' : 'white';
      b.style.color        = sel ? '#5b21b6' : '#9ca3af';
    });
  }
  // Update hidden total if exists
  const totalEl = document.getElementById('coord-eval-total');
  if (totalEl) {
    const vals = Object.values(coordCalificaciones).filter(v => typeof v === 'number');
    const avg  = vals.length ? (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1) : '—';
    totalEl.textContent = avg;
  }
}

// ── coordGuardarEvaluacion (coordinador — guardar eval de docente) ────
async function coordGuardarEvaluacion(idx) {
  const d = (typeof COORD_DOCENTES !== 'undefined') ? COORD_DOCENTES[idx] : null;
  const obs = document.getElementById('coord-obs-textarea')?.value?.trim() || '';
  if (!d) { hubToast('⚠️ No se encontró el docente', 'warn'); return; }
  const vals = Object.values(coordCalificaciones).filter(v => typeof v === 'number');
  const promedio = vals.length ? (vals.reduce((a,b) => a+b, 0) / vals.length) : 0;
  try {
    if (window.sb && window.currentPerfil) {
      await sb.from('evaluaciones_coordinador').insert({
        coordinador_id: currentPerfil.id,
        docente_id:     d.id || null,
        fecha_visita:   new Date().toISOString().split('T')[0],
        calificacion:   parseFloat(promedio.toFixed(2)),
        observaciones:  obs,
        planeacion_ok:  (coordCalificaciones['p_' + idx + '_planeacion_0'] || 0) >= 3,
        actividades_ok: (coordCalificaciones['p_' + idx + '_actividades_0'] || 0) >= 3,
        libretas_ok:    (coordCalificaciones['p_' + idx + '_libretas_0'] || 0) >= 3,
      });
    }
    if (typeof COORD_DOCENTES !== 'undefined' && COORD_DOCENTES[idx]) {
      COORD_DOCENTES[idx].promedio = parseFloat(promedio.toFixed(1));
      if (typeof coordRenderVisitasLista === 'function') coordRenderVisitasLista();
    }
    const coordCalificaciones_backup = { ...coordCalificaciones };
    coordCalificaciones = {};
    hubToast(`✅ Evaluación de ${d.nombre} guardada · Promedio: ${promedio.toFixed(1)}`, 'ok');

    // ── IA genera resumen de la visita automáticamente ──────────────
    const criterios = Object.entries(coordCalificaciones_backup || {})
      .filter(([,v]) => typeof v === 'number')
      .map(([k,v]) => `${k.split('_').pop()}: ${v}/4`).join(', ');

    callAI({
      feature: 'coord_eval_docente',
      prompt: `Coordinador evaluó al docente ${d.nombre} con promedio ${promedio.toFixed(1)}/10.
Observaciones del coordinador: "${obs || 'Sin observaciones adicionales'}"
Criterios evaluados: ${criterios || 'Planeación, actividades y libretas'}
Planeación correcta: ${(coordCalificaciones['p_'+idx+'_planeacion_0']||0)>=3 ? 'Sí':'No'}
Actividades correctas: ${(coordCalificaciones['p_'+idx+'_actividades_0']||0)>=3 ? 'Sí':'No'}
Libretas al corriente: ${(coordCalificaciones['p_'+idx+'_libretas_0']||0)>=3 ? 'Sí':'No'}

Genera el resumen de la visita de acompañamiento para el expediente del docente.`,
      escuela_id: currentPerfil?.escuela_cct,
    }).then(async textoIA => {
      if (!textoIA || !window.sb) return;
      // Guardar análisis IA en la evaluación más reciente
      await sb.from('evaluaciones_coordinador')
        .update({ analisis_ia: textoIA })
        .eq('coordinador_id', currentPerfil.id)
        .eq('docente_id', d.id || null)
        .eq('fecha_visita', new Date().toISOString().split('T')[0])
        .catch(()=>{});

      // Mostrar en panel de visitas
      const panelId = 'coord-ia-visita-' + (d.id || idx);
      let panel = document.getElementById(panelId);
      if (!panel) {
        panel = document.createElement('div');
        panel.id = panelId;
        const container = document.getElementById('coord-p-visitas') ||
                          document.getElementById('coord-visitas-lista');
        if (container) container.insertAdjacentElement('afterbegin', panel);
      }
      const html = textoIA.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
      panel.innerHTML = `
        <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #86efac;border-radius:12px;padding:16px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="font-size:13px;font-weight:700;color:#0d5c2f;">📊 Resumen — Visita a ${d.nombre} (${promedio.toFixed(1)}/10)</div>
            <button onclick="this.closest('div[style]').parentElement.remove()"
              style="background:none;border:none;color:#0d5c2f;cursor:pointer;opacity:.6;font-size:16px;" aria-label="Cerrar">✕</button>
          </div>
          <div style="font-size:12px;color:#166534;line-height:1.7;">${html}</div>
          <div style="margin-top:10px;display:flex;gap:8px;">
            <button onclick="navigator.clipboard.writeText('${textoIA.replace(/'/g,"\\'")}');hubToast('✅ Copiado','ok')"
              style="padding:5px 12px;background:white;border:1.5px solid #86efac;border-radius:7px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;color:#0d5c2f;cursor:pointer;">
              📋 Copiar para expediente
            </button>
          </div>
        </div>`;
    }).catch(()=>{});
  } catch(e) {
    hubToast('❌ Error al guardar: ' + e.message, 'err');
  }
}

// ── coordEnviarDocente (coordinador — enviar feedback al docente) ─────
async function coordEnviarDocente(idx) {
  const d = (typeof COORD_DOCENTES !== 'undefined') ? COORD_DOCENTES[idx] : null;
  if (!d) { hubToast('⚠️ No se encontró el docente', 'warn'); return; }
  const obs = document.getElementById('coord-obs-textarea')?.value?.trim();
  if (!obs) { hubToast('⚠️ Escribe observaciones antes de enviar', 'warn'); return; }
  try {
    if (window.sb) {
      await sb.from('mensajes_internos').insert({
        remitente_id:    currentPerfil?.id,
        destinatario_id: d.id || null,
        asunto:          'Retroalimentación de visita de acompañamiento',
        cuerpo:          obs,
        tipo:            'coordinador',
        leido:           false,
        created_at:      new Date().toISOString(),
      });
    }
    hubToast(`✅ Feedback enviado a ${d.nombre}`, 'ok');
    const textarea = document.getElementById('coord-obs-textarea');
    if (textarea) textarea.value = '';
  } catch(e) {
    hubToast('❌ Error al enviar: ' + e.message, 'err');
  }
}

// ── rubricaRapidaAbrir (doc-portal — abrir rúbrica para aplicar) ──────
let _rubricaAbiertaIdx = null;
function rubricaRapidaAbrir(i) {
  if (typeof RUBRICAS_RAPIDAS === 'undefined' || !RUBRICAS_RAPIDAS[i]) {
    hubToast('⚠️ Rúbrica no encontrada', 'warn'); return;
  }
  _rubricaAbiertaIdx = i;
  const r = RUBRICAS_RAPIDAS[i];
  // Build a modal-like overlay
  let modal = document.getElementById('rubrica-modal-overlay');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rubrica-modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:560px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <div>
          <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;color:#0d5c2f;">${r.titulo}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">📚 ${r.materia||'General'} · ${r.criterios?.length||0} criterios</div>
        </div>
        <button onclick="document.getElementById('rubrica-modal-overlay').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;" aria-label="Cerrar">✕</button>
      </div>
      ${(r.criterios||[]).map((c, ci) => `
        <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:10px;">
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:10px;">${ci+1}. ${c.txt||c}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${(c.niveles||['Excelente','Suficiente','Insuficiente']).map((nv, ni) => `
              <button onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.style.background='#f1f5f9');this.style.background='#0d5c2f';this.style.color='white';"
                style="padding:5px 12px;background:#f1f5f9;border:1.5px solid #e2e8f0;border-radius:7px;font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;transition:.15s;">
                ${nv}
              </button>`).join('')}
          </div>
        </div>`).join('')}
      <div style="margin-top:16px;">
        <label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Observaciones (opcional)</label>
        <textarea id="rubrica-obs" style="width:100%;margin-top:6px;padding:10px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;resize:vertical;min-height:70px;outline:none;box-sizing:border-box;" placeholder="Comentarios adicionales…"></textarea>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
        <button onclick="document.getElementById('rubrica-modal-overlay').remove()" style="padding:9px 18px;background:#f1f5f9;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;font-weight:600;cursor:pointer;color:#64748b;">Cancelar</button>
        <button onclick="document.getElementById('rubrica-modal-overlay').remove();hubToast('✅ Rúbrica aplicada','ok');" style="padding:9px 18px;background:#0d5c2f;color:white;border:none;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">✅ Aplicar</button>
      </div>
    </div>`;
  modal.style.display = 'flex';
}

// ── obsAbrirModal (ts-portal — abrir modal de observación de alumno) ──
function obsAbrirModal(alumnoNombre) {
  // Reutilizar el sistema de observaciones existente (obsGuardar, obsTab, etc.)
  // Pre-fill el campo de alumno si existe
  const alumnoInput = document.getElementById('obs-alumno-sel') || document.getElementById('obs-alumno');
  if (alumnoInput) {
    alumnoInput.value = alumnoNombre || '';
    // Trigger change if it's a select
    alumnoInput.dispatchEvent(new Event('change'));
  }
  // Navigate to obs tab
  if (typeof obsTab === 'function') {
    obsTab('nueva');
  } else if (typeof tsNav === 'function') {
    tsNav('observaciones');
  }
  // Scroll to obs section
  const obsSection = document.getElementById('ts-p-observaciones') || document.getElementById('obs-form');
  if (obsSection) obsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  hubToast(`📝 Abriendo observación para ${alumnoNombre}`, 'ok');
}
