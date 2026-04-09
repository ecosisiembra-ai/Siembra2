// ── IndexedDB wrapper ─────────────────────────────────────────────
const IDB_NAME    = 'siembra_libros';
const IDB_VERSION = 1;
const IDB_STORE   = 'libros';

function idbAbrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess  = (e) => resolve(e.target.result);
    req.onerror    = (e) => reject(e.target.error);
  });
}
async function idbGuardar(libro) {
  const db = await idbAbrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(libro);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}
async function idbObtenerTodos() {
  const db = await idbAbrir();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = (e) => resolve(e.target.result || []);
    req.onerror   = (e) => reject(e.target.error);
  });
}
async function idbEliminar(id) {
  const db = await idbAbrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ── Limpiar libros expirados al arrancar ──────────────────────────
async function idbLimpiarExpirados() {
  try {
    const libros = await idbObtenerTodos();
    const ahora = Date.now();
    for (const l of libros) {
      if (l.fechaExpira && l.fechaExpira < ahora) {
        await idbEliminar(l.id);
        // También quitar de LIBROS en memoria
        const idx = LIBROS.findIndex(lb => lb.id === l.id);
        if (idx !== -1) LIBROS.splice(idx, 1);
        console.log('[SIEMBRA] Libro expirado eliminado:', l.titulo);
      }
    }
  } catch(e) { console.warn('[idbLimpiarExpirados]', e); }
}

// ── Cargar libros guardados en IDB al iniciar la app ─────────────
async function idbCargarEnMemoria() {
  try {
    await idbLimpiarExpirados();
    const guardados = await idbObtenerTodos();
    for (const libro of guardados) {
      const existe = LIBROS.find(l => l.id === libro.id);
      if (!existe) LIBROS.push(libro);
    }
    if (guardados.length) bibRenderGrid();
  } catch(e) { console.warn('[idbCargarEnMemoria]', e); }
}

// ── Marcar libro terminado y activar expiración de 10 días ────────
async function idbMarcarTerminado(libroId) {
  try {
    const libro = LIBROS.find(l => l.id === libroId);
    if (!libro) return;
    libro.estado       = 'terminado';
    libro.progreso     = 100;
    libro.fechaTerminado = Date.now();
    libro.fechaExpira    = Date.now() + (10 * 24 * 60 * 60 * 1000); // +10 días
    // No guardar el contenido completo en IDB para los terminados (ahorra espacio)
    const libroParaGuardar = { ...libro };
    delete libroParaGuardar.capitulos; // no necesitamos el texto tras terminar
    await idbGuardar(libroParaGuardar);
  } catch(e) { console.warn('[idbMarcarTerminado]', e); }
}

// ── Buscar en Gutendex (API de Project Gutenberg) ─────────────────
const GUTENDEX_BASE = 'https://gutendex.com/books/';
const _gutendexCache = {};

async function gutendexBuscar(titulo) {
  if (_gutendexCache[titulo]) return _gutendexCache[titulo];
  const url = GUTENDEX_BASE + '?search=' + encodeURIComponent(titulo) + '&languages=es,en&mime_type=text/plain';
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Gutendex no disponible');
  const data = await resp.json();
  // Filtrar resultados inapropiados
  const resultadosFiltrados = (data.results || []).filter(r => {
    const texto = (r.title + ' ' + (r.subjects || []).join(' ')).toLowerCase();
    return !BIB_PALABRAS_BLOQUEADAS.some(p => texto.includes(p));
  });
  _gutendexCache[titulo] = resultadosFiltrados;
  return resultadosFiltrados;
}

// ── Descargar texto de Gutenberg y dividir en capítulos ───────────
async function gutenbergDescargarTexto(gutenbergId) {
  // Intentar primero el caché CDN de gutenberg.org
  const urlsToTry = [
    `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`,
    `https://www.gutenberg.org/files/${gutenbergId}/${gutenbergId}-0.txt`,
    `https://www.gutenberg.org/files/${gutenbergId}/${gutenbergId}.txt`,
  ];
  for (const url of urlsToTry) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const texto = await resp.text();
        return texto;
      }
    } catch(e) {}
  }
  throw new Error('No se pudo descargar el texto del libro');
}

function gutenbergPartirCapitulos(texto, titulo) {
  // Eliminar header/footer de Project Gutenberg
  const startMark = /\*\*\* START OF [^*]+\*\*\*/i;
  const endMark   = /\*\*\* END OF [^*]+\*\*\*/i;
  let cuerpo = texto;
  const startMatch = texto.search(startMark);
  const endMatch   = texto.search(endMark);
  if (startMatch !== -1) cuerpo = texto.slice(startMatch);
  if (endMatch !== -1)   cuerpo = cuerpo.slice(0, cuerpo.search(endMark));

  // Detectar encabezados de capítulo
  const capRegex = /^(CAP[IÍ]TULO\s+[\wIVXLC]+|CHAPTER\s+[\wIVXLC]+|PARTE\s+[\wIVXLC]+|Capítulo\s+\d+|Chapter\s+\d+)/gim;
  const partes = cuerpo.split(capRegex);

  const capitulos = [];
  if (partes.length > 2) {
    // Hay capítulos detectados
    for (let i = 1; i < partes.length; i += 2) {
      const encabezado = partes[i].trim();
      const contenido  = (partes[i + 1] || '').trim();
      if (contenido.length > 100) {
        capitulos.push({
          num:    capitulos.length + 1,
          titulo: encabezado,
          texto:  formatearTexto(contenido.slice(0, 15000)), // máx 15k chars/cap
        });
      }
    }
  }

  // Si no se detectaron capítulos, dividir por bloques de ~5000 palabras
  if (capitulos.length < 2) {
    const palabras = cuerpo.split(/\s+/);
    const blockSize = 3000; // palabras por "capítulo"
    for (let i = 0; i < Math.min(palabras.length, 90000); i += blockSize) {
      const bloque = palabras.slice(i, i + blockSize).join(' ');
      capitulos.push({
        num:    capitulos.length + 1,
        titulo: `Parte ${capitulos.length + 1}`,
        texto:  formatearTexto(bloque),
      });
    }
  }

  return capitulos.length ? capitulos : [{
    num: 1,
    titulo: titulo,
    texto: formatearTexto(cuerpo.slice(0, 20000)),
  }];
}

function formatearTexto(texto) {
  // Convertir texto plano en HTML legible
  const parrafos = texto.split(/\n{2,}/);
  return parrafos
    .map(p => p.trim())
    .filter(p => p.length > 20)
    .map(p => `<p style="margin:0 0 14px 0;line-height:1.75;">${p.replace(/\n/g, ' ')}</p>`)
    .join('');
}

// ── Descargar libro desde Gutenberg y guardar en IDB ─────────────
async function bibDescargarLibroGutenberg(workKey, meta) {
  const progEl = document.getElementById('bib-descarga-progress');
  const btnEl  = document.getElementById('bib-btn-descargar');

  function setEstado(msg) {
    if (progEl) progEl.textContent = msg;
  }

  try {
    setEstado('🔍 Buscando en Project Gutenberg…');
    const resultados = await gutendexBuscar(meta.title || '');

    let gutId = null;
    let gutMeta = null;

    if (resultados.length) {
      // Preferir libros en español
      const esLibro = resultados.find(r => r.languages?.includes('es')) || resultados[0];
      gutId   = esLibro.id;
      gutMeta = esLibro;
    }

    if (!gutId) {
      // Libro no en Gutenberg — agregar con placeholder
      return bibAgregarConPlaceholder(workKey, meta);
    }

    setEstado('📥 Descargando texto… (puede tardar unos segundos)');
    const texto = await gutenbergDescargarTexto(gutId);

    setEstado('📖 Dividiendo en capítulos…');
    const capitulos = gutenbergPartirCapitulos(texto, meta.title);

    const pal = colorRandom(meta.cover_i || (gutId % 20));
    const libro = {
      id:         'GUT_' + gutId,
      titulo:     gutMeta?.title || meta.title || 'Libro',
      autor:      gutMeta?.authors?.[0]?.name || meta.author || 'Autor',
      emoji:      '📖',
      color1:     pal[0], color2: pal[1],
      paginas:    Math.round(capitulos.length * 8),
      progreso:   0,
      estado:     'leyendo',
      capitulos,
      capActual:  0,
      xpPorCap:   80,
      xpTotal:    0,
      coverUrl:   meta.cover_i ? `https://covers.openlibrary.org/b/id/${meta.cover_i}-M.jpg` : null,
      descargado: true,
      fechaDescarga: Date.now(),
      fechaExpira:   null, // se asigna al terminar
      gutenbergId:   gutId,
    };

    // Guardar en IDB (con capítulos = contenido completo)
    await idbGuardar(libro);

    // Agregar en memoria
    const existente = LIBROS.findIndex(l => l.id === libro.id);
    if (existente !== -1) LIBROS[existente] = libro;
    else LIBROS.push(libro);

    cerrarDetalleBib();
    bibTabActual = 'leyendo';
    document.querySelectorAll('.bib-tab').forEach(b => b.classList.remove('active'));
    const t = document.getElementById('bib-tab-leyendo'); if(t) t.classList.add('active');
    const bw = document.getElementById('bib-buscar-wrap'); if(bw) bw.style.display='none';
    const bg = document.getElementById('bib-grid'); if(bg) bg.style.display='grid';
    bibRenderGrid();
    toast(`📚 "${libro.titulo}" descargado — ${capitulos.length} capítulos · +50 XP`);

  } catch(e) {
    console.warn('[bibDescargarLibroGutenberg]', e);
    setEstado('⚠️ ' + (e.message || 'Error al descargar'));
    // Fallback: agregar con placeholder
    setTimeout(() => bibAgregarConPlaceholder(workKey, meta), 1500);
  }
}

function bibAgregarConPlaceholder(workKey, meta) {
  const idx = LIBROS.length;
  const pal = colorRandom(meta.cover_i || idx);
  const nuevoLibro = {
    id:        'OL_' + workKey,
    titulo:    meta.title  || 'Libro',
    autor:     meta.author || 'Autor',
    emoji:     '📖', color1: pal[0], color2: pal[1],
    paginas:   meta.pages || 150,
    progreso:  0, estado: 'leyendo',
    capitulos: [{
      num: 1, titulo: 'Contenido',
      texto: '<p>Este libro está disponible en Open Library. El texto completo se cargará cuando haya conexión a Project Gutenberg.</p>',
    }],
    capActual: 0, xpPorCap: 80, xpTotal: 0,
    descargado: false,
    fechaDescarga: Date.now(),
    fechaExpira: null,
  };
  LIBROS.push(nuevoLibro);
  cerrarDetalleBib();
  bibTabActual = 'leyendo';
  document.querySelectorAll('.bib-tab').forEach(b => b.classList.remove('active'));
  const t = document.getElementById('bib-tab-leyendo'); if(t) t.classList.add('active');
  const bw = document.getElementById('bib-buscar-wrap'); if(bw) bw.style.display='none';
  const bg = document.getElementById('bib-grid'); if(bg) bg.style.display='grid';
  bibRenderGrid();
  toast(`📚 "${nuevoLibro.titulo}" agregado a tu biblioteca`);
}

// ── Override bibVerDetalleOL para mostrar botón con descarga real ─
const _bibVerDetalleOrig = window.bibVerDetalleOL;
window.bibVerDetalleOL = async function(workKey) {
  const meta = bibOLCache[workKey] || {};
  const modal = document.getElementById('bib-detalle-modal');
  const card  = document.getElementById('bib-detalle-card');
  if (!modal || !card) return;
  modal.classList.add('open');
  const pal = colorRandom(meta.cover_i || 7);
  const c1 = pal[0], c2 = pal[1];
  const coverUrl = meta.cover_i ? 'https://covers.openlibrary.org/b/id/' + meta.cover_i + '-L.jpg' : null;
  const yaAgregado = LIBROS.some(l => l.titulo === meta.title);

  const portadaHTML = coverUrl
    ? `<img class="bib-detalle-portada-img" src="${coverUrl}" onerror="this.style.display='none'">`
      + `<div class="bib-detalle-portada-placeholder" style="background:linear-gradient(160deg,${c1},${c2});display:none;"><span style="font-size:32px;">📖</span></div>`
    : `<div class="bib-detalle-portada-placeholder" style="background:linear-gradient(160deg,${c1},${c2});"><span style="font-size:32px;">📖</span></div>`;

  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">' +
      '<div style="font-size:13px;font-weight:700;color:var(--texto-2);">📚 Biblioteca gratuita</div>' +
      '<button onclick="cerrarDetalleBib()" style="border:none;background:#f0f0f0;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px;" aria-label="Cerrar">✕</button>' +
    '</div>' +
    '<div class="bib-detalle-portada-row">' +
      '<div style="flex-shrink:0;">' + portadaHTML + '</div>' +
      '<div style="flex:1;">' +
        `<div class="bib-detalle-titulo">${meta.title || ''}</div>` +
        `<div class="bib-detalle-autor">${meta.author || ''}</div>` +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' +
          (meta.year ? `<span class="bib-detalle-chip" style="background:#f0f9ff;color:#0369a1;">${meta.year}</span>` : '') +
          (meta.pages ? `<span class="bib-detalle-chip" style="background:#f0fdf4;color:#15803d;">${meta.pages} págs.</span>` : '') +
          '<span class="bib-detalle-chip" style="background:#fef3c7;color:#92400e;">Dominio público</span>' +
          '<span class="bib-detalle-chip" style="background:#f5f3ff;color:#7c3aed;">Gratis ✓</span>' +
        '</div>' +
        '<div style="font-size:11px;color:#64748b;margin-top:4px;">📥 Se descarga en tu dispositivo · disponible sin internet · se borra 10 días después de terminarlo</div>' +
      '</div>' +
    '</div>' +
    '<div id="bib-detalle-desc-wrap"><div style="text-align:center;"><div class="bib-spinner"></div></div></div>' +
    '<div id="bib-detalle-botones" style="margin-top:16px;">' +
      (yaAgregado
        ? '<div style="text-align:center;padding:12px;color:var(--verde);font-weight:700;font-size:14px;">✅ Ya está en tu biblioteca</div>'
        : `<div id="bib-descarga-progress" style="font-size:12px;color:#64748b;margin-bottom:8px;min-height:18px;"></div>
           <button id="bib-btn-descargar" onclick="bibDescargarLibroGutenberg('${workKey}',bibOLCache['${workKey}']||{})"
             style="width:100%;padding:14px;background:linear-gradient(135deg,#0f766e,#14b8a6);color:white;border:none;border-radius:14px;font-size:14px;font-weight:900;cursor:pointer;font-family:Nunito,sans-serif;margin-bottom:8px;">
             📥 Descargar y leer gratis
           </button>
           <button onclick="cerrarDetalleBib()" style="width:100%;padding:12px;background:#f0f0f0;color:var(--texto-2);border:none;border-radius:14px;font-size:13px;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;">Cancelar</button>`) +
    '</div>';

  if (workKey && !workKey.includes('fb')) {
    try {
      const resp = await fetch('https://openlibrary.org/works/' + workKey + '.json');
      const data = await resp.json();
      const desc = typeof data.description === 'string' ? data.description : (data.description?.value || 'Libro en dominio público disponible en español.');
      const descEl = document.getElementById('bib-detalle-desc-wrap');
      if (descEl) descEl.innerHTML = '<div class="bib-detalle-desc">' + (desc.length > 300 ? desc.slice(0, 298) + '…' : desc) + '</div>';
    } catch(e) {
      const descEl = document.getElementById('bib-detalle-desc-wrap');
      if (descEl) descEl.innerHTML = '<div class="bib-detalle-desc">Libro en dominio público disponible en español.</div>';
    }
  }
};

// ── Override bibMostrarResultadoFinal para activar expiración ─────
const _bibMostrarResultadoFinalOrig = window.bibMostrarResultadoFinal;
window.bibMostrarResultadoFinal = async function() {
  // Llamar la función original primero
  if (typeof _bibMostrarResultadoFinalOrig === 'function') _bibMostrarResultadoFinalOrig();
  // Activar temporizador de expiración en IDB
  if (lectorLibroId) {
    await idbMarcarTerminado(lectorLibroId);
    console.log('[SIEMBRA] Libro terminado, expira en 10 días:', lectorLibroId);
  }
};

// ── Indicador de expiración en la grid de libros terminados ──────
const _bibRenderGridOrig = window.bibRenderGrid;
window.bibRenderGrid = function() {
  // Llamar el render original
  if (typeof _bibRenderGridOrig === 'function') _bibRenderGridOrig();

  // Para terminados, agregar días restantes
  if (bibTabActual === 'terminados') {
    const ahora = Date.now();
    const terminados = LIBROS.filter(l => l.estado === 'terminado');
    terminados.forEach((l, i) => {
      if (!l.fechaExpira) return;
      const diasRestantes = Math.ceil((l.fechaExpira - ahora) / 86400000);
      const cards = document.querySelectorAll('#bib-grid .bib-libro-card');
      const card  = cards[i];
      if (!card) return;
      const badge = document.createElement('div');
      badge.style.cssText = 'position:absolute;bottom:6px;left:6px;background:rgba(0,0,0,.6);color:white;font-size:9px;font-weight:800;padding:3px 7px;border-radius:8px;';
      badge.textContent = diasRestantes > 0 ? `⏳ ${diasRestantes}d` : '🗑️ Hoy';
      card.appendChild(badge);
    });
  }
};

// ── Inicializar al cargar la lectura ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(idbCargarEnMemoria, 800); // después de que LIBROS esté inicializado
});

// ══════════════════════════════════════════════════════════════════
// BLOQUE A — TAREAS DEL DOCENTE (alumno ve sus tareas asignadas)
// ══════════════════════════════════════════════════════════════════
let _tareasAlumno   = [];
let _entregasAlumno = {};
let _tareasFiltro   = 'pendiente';

async function initTareas() {
  if (!currentPerfil?.id || !sb) { renderTareasEmpty('Sin sesión activa'); return; }
  const lista = document.getElementById('tareas-lista-alumno');
  if (lista) lista.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:13px;">⏳ Cargando…</div>';

  try {
    // Cargar tareas del grupo del alumno
    const grupoId = currentPerfil.grupo_id || currentPerfil.grupo;
    if (!grupoId) { renderTareasEmpty('Aún no estás asignado a un grupo'); return; }

    const [tareasRes, entregasRes] = await Promise.all([
      sb.from('tareas_docente')
        .select('id,titulo,descripcion,fecha_entrega,materia,tipo_eval,grupo_id,created_at')
        .eq('grupo_id', grupoId)
        .order('fecha_entrega', { ascending: true }),
      sb.from('tareas_entregas')
        .select('tarea_id,estado,entregado_en,nota')
        .eq('alumno_id', currentPerfil.id),
    ]);

    _tareasAlumno = tareasRes.data || [];
    _entregasAlumno = {};
    (entregasRes.data || []).forEach(e => { _entregasAlumno[e.tarea_id] = e; });

    renderTareasAlumno();
    actualizarBadgeTareas();

    // Suscripción Realtime — nuevas tareas del grupo
    sb.channel('alumno-tareas-' + grupoId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tareas_docente',
        filter: `grupo_id=eq.${grupoId}`
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          _tareasAlumno.unshift(payload.new);
          renderTareasAlumno();
          actualizarBadgeTareas();
          showAlumnoNotif('📋 Nueva tarea: ' + (payload.new.titulo || 'sin título'));
        } else if (payload.eventType === 'UPDATE') {
          const idx = _tareasAlumno.findIndex(t => t.id === payload.new.id);
          if (idx >= 0) _tareasAlumno[idx] = payload.new;
          renderTareasAlumno();
        }
      })
      .subscribe();

    // Suscripción Realtime — cambios en calificaciones (alumno ve su nota actualizada)
    sb.channel('alumno-cals-' + currentPerfil.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'calificaciones',
        filter: `alumno_id=eq.${currentPerfil.id}`
      }, (payload) => {
        showAlumnoNotif('📊 Nueva calificación registrada en ' + (payload.new.materia || 'una materia'));
      })
      .subscribe();

    // Suscripción Realtime — feedback de evidencias
    sb.channel('alumno-evidencias-' + currentPerfil.id)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'evidencias',
        filter: `alumno_id=eq.${currentPerfil.id}`
      }, (payload) => {
        const estado = payload.new.estado;
        if (estado === 'aprobada') showAlumnoNotif('✅ Tu evidencia fue aprobada por el docente');
        else if (estado === 'rechazada') showAlumnoNotif('📝 Tu docente revisó tu evidencia — revisa los comentarios');
      })
      .subscribe();

  } catch(e) {
    console.warn('[tareas]', e);
    renderTareasEmpty('Error al cargar tareas');
  }
}

function renderTareasAlumno() {
  const lista = document.getElementById('tareas-lista-alumno');
  if (!lista) return;

  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const tareas = _tareasFiltro === 'pendiente'
    ? _tareasAlumno.filter(t => {
        const e = _entregasAlumno[t.id];
        return !e || e.estado === 'pendiente';
      })
    : _tareasAlumno;

  if (!tareas.length) {
    lista.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#94a3b8;">
      <div style="font-size:40px;margin-bottom:12px;">${_tareasFiltro === 'pendiente' ? '🎉' : '📋'}</div>
      <div style="font-weight:700;color:#64748b;font-size:15px;">${_tareasFiltro === 'pendiente' ? 'No tienes tareas pendientes' : 'Todavía no hay tareas en esta vista'}</div>
      <div style="font-size:12px;margin-top:6px;">${_tareasFiltro === 'pendiente' ? 'Vas al día. Cuando tus docentes asignen nuevas actividades, aparecerán aquí.' : 'Cuando tu docente publique tareas o actividades, podrás revisarlas aquí mismo.'}</div>
    </div>`;
    return;
  }

  lista.innerHTML = tareas.map(t => {
    const entrega = _entregasAlumno[t.id];
    const estado  = entrega?.estado || 'pendiente';
    const nota    = entrega?.nota;
    const fechaE  = t.fecha_entrega ? new Date(t.fecha_entrega + 'T00:00:00') : null;
    const diasRest = fechaE ? Math.ceil((fechaE - hoy) / 86400000) : null;
    const vencida  = diasRest !== null && diasRest < 0 && estado === 'pendiente';

    const colorBorde = estado === 'entregada' ? '#22c55e' : vencida ? '#ef4444' : '#e2e8f0';
    const bgCard = estado === 'entregada' ? '#f0fdf4' : vencida ? '#fef2f2' : 'white';
    const badgeHtml = estado === 'entregada'
      ? `<span style="background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:800;">✅ Entregada${nota ? ' · ' + nota + '/10' : ''}</span>`
      : vencida
      ? `<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:800;">⏰ Vencida</span>`
      : diasRest !== null
      ? `<span style="background:${diasRest <= 2 ? '#fef3c7' : '#f1f5f9'};color:${diasRest <= 2 ? '#b45309' : '#475569'};padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700;">${diasRest === 0 ? '⚡ Hoy' : diasRest === 1 ? '⚠️ Mañana' : `📅 ${diasRest} días`}</span>`
      : '';

    return `<div style="background:${bgCard};border:1.5px solid ${colorBorde};border-radius:14px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.05);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;">
        <div style="font-weight:800;font-size:14px;color:#0f172a;flex:1;">${t.titulo || 'Tarea sin título'}</div>
        ${badgeHtml}
      </div>
      ${t.materia ? `<div style="font-size:11px;color:#0a5c2e;font-weight:700;margin-bottom:6px;">📚 ${t.materia}</div>` : ''}
      ${t.descripcion ? `<div style="font-size:12px;color:#475569;line-height:1.6;margin-bottom:10px;">${t.descripcion}</div>` : ''}
      ${fechaE ? `<div style="font-size:11px;color:#64748b;margin-bottom:10px;">📅 Entregar: ${fechaE.toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'})}</div>` : ''}
      ${estado === 'pendiente' ? `<button onclick="tareaMarcarEntregada('${t.id}')" style="width:100%;padding:10px;background:linear-gradient(135deg,#0a5c2e,#16793a);color:white;border:none;border-radius:10px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;cursor:pointer;">✅ Marcar como entregada</button>` : ''}
    </div>`;
  }).join('');
}

function renderTareasEmpty(msg) {
  const lista = document.getElementById('tareas-lista-alumno');
  if (lista) lista.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8;font-size:13px;"><div style="font-size:36px;margin-bottom:10px;">📋</div><div>${msg}</div></div>`;
}

function tareasFiltrar(filtro) {
  _tareasFiltro = filtro;
  document.getElementById('tf-pend').style.background  = filtro === 'pendiente' ? '#0a5c2e' : 'white';
  document.getElementById('tf-pend').style.color       = filtro === 'pendiente' ? 'white' : '#475569';
  document.getElementById('tf-todas').style.background = filtro === 'todas' ? '#0a5c2e' : 'white';
  document.getElementById('tf-todas').style.color      = filtro === 'todas' ? 'white' : '#475569';
  renderTareasAlumno();
}

async function tareaMarcarEntregada(tareaId) {
  if (!currentPerfil?.id || !sb) return;
  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }
  try {
    await sb.from('tareas_entregas').upsert({
      tarea_id: tareaId,
      alumno_id: currentPerfil.id,
      estado: 'entregada',
      entregado_en: new Date().toISOString(),
    }, { onConflict: 'tarea_id,alumno_id' });
    _entregasAlumno[tareaId] = { tarea_id: tareaId, estado: 'entregada', entregado_en: new Date().toISOString() };
    renderTareasAlumno();
    actualizarBadgeTareas();
    showAlumnoNotif('✅ ¡Tarea marcada como entregada!');
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = '✅ Marcar como entregada'; }
    showAlumnoNotif('❌ Error: ' + e.message);
  }
}

function actualizarBadgeTareas() {
  const pendientes = _tareasAlumno.filter(t => {
    const e = _entregasAlumno[t.id];
    return !e || e.estado === 'pendiente';
  }).length;
  const badge = document.getElementById('tareas-nav-badge');
  if (!badge) return;
  if (pendientes > 0) { badge.textContent = pendientes; badge.style.display = 'block'; }
  else { badge.style.display = 'none'; }
}

function showAlumnoNotif(msg) {
  // Reusar el sistema de toast existente o crear uno simple
  if (typeof toast === 'function') { toast(msg); return; }
  const t = document.getElementById('hub-toast');
  if (t) { t.textContent = msg; t.className = 'show'; setTimeout(() => t.className = '', 3500); }
}
window.initTareas          = initTareas;
window.tareasFiltrar       = tareasFiltrar;
window.tareaMarcarEntregada= tareaMarcarEntregada;