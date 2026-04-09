// ── UTILIDADES ──
function generarToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

function copiarTexto(txt) {
  navigator.clipboard.writeText(txt).then(() => toast('Copiado al portapapeles', 'ok'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = txt; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
      toast('Copiado', 'ok');
    });
}

let _toastTimer;
function toast(msg, tipo) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (tipo ? ' ' + tipo : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = ''; }, 3200);
}

// ── DATOS DEMO (sin Supabase) ──
function _demoEscuelas() {
  return [
    { id:'e1', nombre:'Escuela primaria piloto', cct:'19EPR0001A', municipio:'Guadalupe', estado:'Nuevo Le\xf3n', nivel_default:'primaria', limite_alumnos:500, activa:true, creado_en: new Date().toISOString() },
    { id:'e2', nombre:'Escuela secundaria piloto', cct:'19DES0024B', municipio:'Monterrey', estado:'Nuevo Le\xf3n', nivel_default:'secundaria', limite_alumnos:300, activa:true, creado_en: new Date(Date.now()-86400000*5).toISOString() },
    { id:'e3', nombre:'Escuela primaria adicional', cct:'14EPR0055C', municipio:'Guadalajara', estado:'Jalisco', nivel_default:'primaria', limite_alumnos:400, activo:false, created_at: new Date(Date.now()-86400000*12).toISOString() },
  ];
}

function _demoUsuarios() {
  return [
    { id:'u1', nombre:'Docente demo', email:'docente@bjuarez.edu', rol:'docente', escuela_id:'e1', activo:true, created_at:new Date().toISOString(), escuelas:{nombre:'Escuela primaria piloto'} },
    { id:'u2', nombre:'Director demo', email:'direccion@bjuarez.edu', rol:'director', escuela_id:'e1', activo:true, created_at:new Date().toISOString(), escuelas:{nombre:'Escuela primaria piloto'} },
    { id:'u3', nombre:'Alumno demo', email:'alumno@escuela.edu', rol:'alumno', escuela_id:'e1', activo:true, created_at:new Date().toISOString(), escuelas:{nombre:'Escuela primaria piloto'} },
    { id:'u4', nombre:'Familia demo', email:'familia@email.com', rol:'padre', escuela_id:'e1', activo:true, created_at:new Date().toISOString(), escuelas:{nombre:'Escuela primaria piloto'} },
    { id:'u5', nombre:'Directivo demo', email:'direccion@sec12.edu', rol:'director', escuela_id:'e2', activo:true, created_at:new Date().toISOString(), escuelas:{nombre:'Escuela secundaria piloto'} },
  ];
}

function _demoInvitaciones() {
  return [
    { id:'i1', token: generarToken(), escuela_id:'e1', rol:'docente', email_destino:'nuevo@escuela.demo', estado:'pendiente', expira_at: new Date(Date.now()+7*86400000).toISOString(), created_at:new Date().toISOString(), escuelas:{nombre:'Escuela primaria piloto'} },
  ];
}

// ── POBLAR SELECTORES ──
function poblarSelectores() {
  const selEsc = document.getElementById('usr-escuela-fil');
  if (selEsc) {
    selEsc.innerHTML = '<option value="">Todas las escuelas</option>' +
      escuelasData.map(e => `<option value="${e.id}">${e.nombre||e.cct}</option>`).join('');
  }
}
