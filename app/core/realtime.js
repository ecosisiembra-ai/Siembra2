// ══ SIEMBRA REALTIME ENGINE ══
// ══════════════════════════════════════════════════════════════════════
// SIEMBRA REALTIME ENGINE v1.0
// Extiende el realtime existente a todas las tablas y roles
// ══════════════════════════════════════════════════════════════════════

window._realtimeChannels = window._realtimeChannels || {};

// ── Suscripción genérica con payload optimizado ────────────────────
function siembraSuscribir(tabla, filtro, onInsert, onUpdate, onDelete) {
  const chKey = `rt_${tabla}_${filtro || 'all'}`;
  if (window._realtimeChannels[chKey]) return; // ya suscrito
  if (!window.sb) return;

  const ch = window.sb.channel(chKey)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: tabla,
      ...(filtro ? { filter: filtro } : {}),
    }, (payload) => {
      console.log(`[RT] ${tabla}`, payload.eventType);
      if (payload.eventType === 'INSERT' && onInsert) onInsert(payload.new, payload);
      if (payload.eventType === 'UPDATE' && onUpdate) onUpdate(payload.new, payload.old, payload);
      if (payload.eventType === 'DELETE' && onDelete) onDelete(payload.old, payload);
      // Dispatch global para que cualquier portal pueda escuchar
      window.dispatchEvent(new CustomEvent(`siembra:rt_${tabla}`, { detail: payload }));
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log(`[RT] ✅ ${tabla} suscrito`);
      if (status === 'CHANNEL_ERROR') console.warn(`[RT] ❌ ${tabla} error`);
    });

  window._realtimeChannels[chKey] = ch;
}

// ══════════════════════════════════════════════════════════════════════
// INIT REALTIME POR ROL
// ══════════════════════════════════════════════════════════════════════

function initRealtimeDocente(grupoId, escuelaCct) {
  if (!grupoId) return;

  // Calificaciones del grupo (ya existe, reusar patrón)
  siembraSuscribir('calificaciones', `grupo_id=eq.${grupoId}`,
    (row) => {
      window.dispatchEvent(new CustomEvent('siembra:cal_update', { detail: { eventType:'INSERT', new: row }}));
      if (typeof calInit === 'function') calInit();
    },
    (row) => {
      window.dispatchEvent(new CustomEvent('siembra:cal_update', { detail: { eventType:'UPDATE', new: row }}));
    }
  );

  // Asistencia del grupo
  siembraSuscribir('asistencia', `grupo_id=eq.${grupoId}`,
    (row) => { window.dispatchEvent(new CustomEvent('siembra:as_update', { detail: row })); },
    (row) => { window.dispatchEvent(new CustomEvent('siembra:as_update', { detail: row })); }
  );

  // Alertas de la escuela → badge en topbar
  if (escuelaCct) {
    siembraSuscribir('alertas', `escuela_cct=eq.${escuelaCct}`,
      (row) => {
        _rtActualizarBadgeAlertas(1);
        hubToast(`🔔 Nueva alerta: ${row.tipo || 'incidencia'}`, 'warn');
      }
    );
  }

  // Alumnos del grupo (si cambia la lista)
  siembraSuscribir('alumnos_grupos', `grupo_id=eq.${grupoId}`,
    async () => {
      if (typeof calCargarAlumnosGrupo === 'function') {
        const alumnos = await calCargarAlumnosGrupo(grupoId);
        if (alumnos.length) {
          window._alumnosActivos = alumnos;
          if (typeof calRenderTabla === 'function') calRenderTabla();
          if (typeof dRenderDash === 'function') dRenderDash();
        }
      }
    },
    async () => {
      if (typeof calCargarAlumnosGrupo === 'function') {
        const alumnos = await calCargarAlumnosGrupo(grupoId);
        window._alumnosActivos = alumnos;
        if (typeof calRenderTabla === 'function') calRenderTabla();
      }
    }
  );

  console.log('[RT] Docente suscrito — grupo:', grupoId);
}

function initRealtimeTS(escuelaCct) {
  if (!escuelaCct) return;

  // Incidencias de la escuela → TS las recibe en tiempo real
  siembraSuscribir('incidencias', `escuela_cct=eq.${escuelaCct}`,
    (row) => {
      hubToast(`🚨 Nueva incidencia: ${row.tipo || 'reporte'}`, 'warn');
      _rtActualizarBadgeAlertas(1);
      if (typeof tsInit === 'function') tsInit();
    },
    (row) => {
      if (typeof tsInit === 'function') tsInit();
    }
  );

  // Alertas
  siembraSuscribir('alertas', `escuela_cct=eq.${escuelaCct}`,
    (row) => {
      hubToast(`🔔 Alerta: ${row.descripcion?.slice(0,50) || row.tipo}`, 'warn');
      if (typeof tsInit === 'function') tsInit();
    }
  );

  console.log('[RT] TS suscrito — escuela:', escuelaCct);
}

function initRealtimeAdmin(escuelaCct) {
  if (!escuelaCct) return;

  // Usuarios nuevos en la escuela
  siembraSuscribir('usuarios', `escuela_cct=eq.${escuelaCct}`,
    (row) => {
      hubToast(`👤 Nuevo usuario: ${row.nombre || row.email}`, 'ok');
      if (window.ADM) { ADM.cargarDocentes().then(() => ADM.renderDocentes()); }
    },
    (row) => {
      if (window.ADM) { ADM.cargarDocentes().then(() => ADM.renderDocentes()); }
    }
  );

  // Grupos
  siembraSuscribir('grupos', `escuela_cct=eq.${escuelaCct}`,
    (row) => {
      if (window.ADM) { ADM.cargarGrupos().then(() => { ADM.renderGrupos(); ADM.popularSelects(); }); }
    },
    (row) => {
      if (window.ADM) { ADM.cargarGrupos().then(() => ADM.renderGrupos()); }
    }
  );

  // Alertas → dashboard admin
  siembraSuscribir('alertas', `escuela_cct=eq.${escuelaCct}`,
    (row) => {
      hubToast(`🚨 ${row.tipo}: ${row.descripcion?.slice(0,40) || ''}`, 'warn');
      _rtActualizarBadgeAlertas(1);
    }
  );

  // Incidencias → admin las ve
  siembraSuscribir('incidencias', `escuela_cct=eq.${escuelaCct}`,
    (row) => { _rtActualizarBadgeAlertas(1); }
  );

  console.log('[RT] Admin suscrito — escuela:', escuelaCct);
}

function initRealtimeDirector(escuelaCct) {
  if (!escuelaCct) return;

  // Incidencias → director las monitorea
  siembraSuscribir('incidencias', `escuela_cct=eq.${escuelaCct}`,
    (row) => {
      hubToast(`🚨 Incidencia: ${row.tipo}`, 'warn');
      _rtActualizarBadgeAlertas(1);
      if (typeof dirInit === 'function') dirInit();
    }
  );

  // Asistencia → reporte en tiempo real
  siembraSuscribir('asistencia', null,
    () => { window.dispatchEvent(new Event('siembra:asistencia_update')); }
  );

  // Calificaciones → reporte
  siembraSuscribir('calificaciones', null,
    () => { window.dispatchEvent(new Event('siembra:calificaciones_update')); }
  );

  console.log('[RT] Director suscrito — escuela:', escuelaCct);
}

// ══════════════════════════════════════════════════════════════════════
// INIT PRINCIPAL — se llama después de login
// ══════════════════════════════════════════════════════════════════════
function initRealtime() {
  if (!window.sb || !window.currentPerfil) return;
  const perfil = window.currentPerfil;
  const cct    = window.ESCUELA_ACTIVA?.cct || perfil.escuela_cct;
  const grupoId = window._grupoActivo;
  const rol     = perfil.rol;

  console.log('[RT] Iniciando realtime para rol:', rol, '| escuela:', cct);

  switch(rol) {
    case 'docente':
    case 'tutor':
      if (grupoId) initRealtimeDocente(grupoId, cct);
      break;
    case 'ts':
    case 'prefecto':
      initRealtimeTS(cct);
      break;
    case 'admin':
    case 'coordinador':
      initRealtimeAdmin(cct);
      if (rol === 'coordinador') initRealtimeTS(cct);
      break;
    case 'director':
    case 'subdirector':
      initRealtimeDirector(cct);
      initRealtimeAdmin(cct);
      break;
  }

  // Todos los roles escuchan mensajes
  siembraSuscribir('mensajes', null,
    (row) => {
      if (row.destinatario_id === perfil.id || row.escuela_cct === cct) {
        _rtMostrarNotifMensaje(row);
      }
    }
  );
}

// ══════════════════════════════════════════════════════════════════════
// HELPERS UI
// ══════════════════════════════════════════════════════════════════════
function _rtActualizarBadgeAlertas(delta) {
  ['notif-badge', 'badge-alertas', 'ts-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const n = Math.max(0, parseInt(el.textContent || '0') + delta);
    el.textContent = n;
    el.style.display = n > 0 ? 'inline-flex' : 'none';
  });
  // Badge en el botón de notificaciones del topbar
  const topBadge = document.querySelector('.tb-btn .badge');
  if (topBadge) {
    const n = Math.max(0, parseInt(topBadge.textContent || '0') + delta);
    topBadge.textContent = n;
  }
}

function _rtMostrarNotifMensaje(row) {
  const nombre = row.remitente_nombre || 'Sistema';
  const texto  = row.contenido?.slice(0, 60) || 'Nuevo mensaje';
  hubToast(`✉️ ${nombre}: ${texto}`, 'ok');
  // Actualizar badge mensajes
  const badgeMsj = document.getElementById('nav-label-mensajes');
  if (badgeMsj) badgeMsj.innerHTML = 'Mensajes <span style="background:#ef4444;color:white;border-radius:99px;padding:1px 6px;font-size:10px;">+1</span>';
}

// ══════════════════════════════════════════════════════════════════════
// HOOK: llamar initRealtime después de login exitoso
// ══════════════════════════════════════════════════════════════════════
window.addEventListener('siembra:login_exitoso', () => {
  setTimeout(initRealtime, 500); // pequeño delay para que los datos estén listos
  // Arrancar watcher de sesión: detecta token expirado y logout externo
  if (window.SIEMBRA?.sessionWatcher) {
    window.SIEMBRA.sessionWatcher.start();
  }
});

// También cuando el docente cambia de grupo → resuscribir
window.addEventListener('siembra:grupo_cambiado', (e) => {
  const nuevoGrupoId = e.detail?.grupo_id || window._grupoActivo;
  if (!nuevoGrupoId) return;
  const cct = window.ESCUELA_ACTIVA?.cct || window.currentPerfil?.escuela_cct;
  // Desuscribir canales de grupo anterior
  ['cal_','as_','rt_calificaciones_','rt_asistencia_','rt_alumnos_grupos_'].forEach(prefix => {
    Object.keys(window._realtimeChannels)
      .filter(k => k.startsWith(prefix))
      .forEach(k => {
        try { window.sb.removeChannel(window._realtimeChannels[k]); } catch(e) {}
        delete window._realtimeChannels[k];
      });
  });
  initRealtimeDocente(nuevoGrupoId, cct);
});

// ══════════════════════════════════════════════════════════════════════
// EXPONER
// ══════════════════════════════════════════════════════════════════════
window.initRealtime            = initRealtime;
window.siembraSuscribir        = siembraSuscribir;
window.initRealtimeDocente     = initRealtimeDocente;
window.initRealtimeTS          = initRealtimeTS;
window.initRealtimeAdmin       = initRealtimeAdmin;
window.initRealtimeDirector    = initRealtimeDirector;

console.log('[SIEMBRA Realtime] Engine cargado ✅');

function realtimeSuscribirCalificaciones(grupoId) {
  if (!sb) return;
  const chKey = 'cal_' + grupoId;
  if (window.SIEMBRA?.realtime) {
    window._realtimeChannels[chKey] = window.SIEMBRA.realtime.subscribe(chKey, {
      table: 'calificaciones',
      filter: `grupo_id=eq.${grupoId}`,
      debugLabel: 'Calificaciones suscrito: ' + grupoId,
      onMessage: (payload) => {
        window.dispatchEvent(new CustomEvent('siembra:cal_update', { detail: payload }));
      },
    });
    return;
  }
}

function realtimeSuscribirAsistencia(grupoId) {
  if (!sb) return;
  const chKey = 'as_' + grupoId;
  if (window.SIEMBRA?.realtime) {
    window._realtimeChannels[chKey] = window.SIEMBRA.realtime.subscribe(chKey, {
      table: 'asistencia',
      filter: `grupo_id=eq.${grupoId}`,
      debugLabel: 'Asistencia suscrito: ' + grupoId,
      onMessage: (payload) => {
        window.dispatchEvent(new CustomEvent('siembra:as_update', { detail: payload }));
      },
    });
    return;
  }
}

function realtimeDesuscribir(chKey) {
  if (window.SIEMBRA?.realtime) {
    window.SIEMBRA.realtime.unsubscribe(chKey);
  }
  delete window._realtimeChannels[chKey];
}

function realtimeDesuscribirTodos() {
  if (window.SIEMBRA?.realtime) {
    window.SIEMBRA.realtime.unsubscribeAll();
  }
  window._realtimeChannels = {};
}
