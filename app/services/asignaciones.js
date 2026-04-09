window.SiembraAsignaciones = (function() {
  function getStore(ADM) {
    if (!ADM.asignacionesPorDocente || typeof ADM.asignacionesPorDocente !== 'object') {
      ADM.asignacionesPorDocente = {};
    }
    return ADM.asignacionesPorDocente;
  }

  function setStore(ADM, value) {
    ADM.asignacionesPorDocente = value || {};
    window._admAsignaciones = ADM.asignacionesPorDocente;
    return ADM.asignacionesPorDocente;
  }

  function getDocenteAsignaciones(ADM, docenteId) {
    const store = getStore(ADM);
    return store[docenteId] || [];
  }

  function buildRowMap(rows) {
    const store = {};
    (rows || []).forEach(a => {
      if (!a?.docente_id) return;
      if (!store[a.docente_id]) store[a.docente_id] = [];
      store[a.docente_id].push({
        id: a.id || ('tmp-' + Math.random().toString(36).slice(2)),
        materia: a.materia,
        grupo_id: a.grupo_id || null,
        grupo: a.grupos?.nombre || a.grupo || 'Todos',
        turno: a.grupos?.turno || a.turno || null,
        ciclo: a.ciclo || window.CICLO_ACTIVO,
      });
    });
    return store;
  }

  async function cargarDesdeDB(ADM, sb, docentesIds) {
    if (!sb || !docentesIds?.length) return setStore(ADM, {});
    const { data: asigns, error } = await sb.from('docente_grupos')
      .select('id, docente_id, grupo_id, materia, ciclo, grupos(nombre, turno, grado)')
      .in('docente_id', docentesIds)
      .eq('activo', true);
    if (error) throw error;
    return setStore(ADM, buildRowMap(asigns || []));
  }

  async function guardarAsignacion(ADM, payload) {
    const { sb, docenteId, grupoId, materia, ciclo } = payload;
    let savedId = 'demo-' + Date.now();
    if (sb) {
      const { data, error } = await sb.from('docente_grupos').upsert({
        docente_id: docenteId,
        grupo_id: grupoId || null,
        materia,
        ciclo: ciclo || window.CICLO_ACTIVO,
        activo: true,
      }, { onConflict: 'docente_id,grupo_id,materia,ciclo' }).select('id').maybeSingle();
      if (error) throw error;
      if (data?.id) savedId = data.id;
    }

    const store = getStore(ADM);
    if (!store[docenteId]) store[docenteId] = [];
    const grupoNom = ADM.grupos.find(g => g.id === grupoId)?.nombre || 'Todos';
    store[docenteId].push({
      id: savedId,
      materia,
      grupo_id: grupoId || null,
      grupo: grupoNom,
      ciclo: ciclo || window.CICLO_ACTIVO,
    });
    window._admAsignaciones = store;
    return store[docenteId];
  }

  async function quitarAsignacion(ADM, payload) {
    const { sb, docenteId, asignId } = payload;
    if (sb && asignId && !String(asignId).includes('demo')) {
      const { error } = await sb.from('docente_grupos').update({ activo: false }).eq('id', asignId);
      if (error) throw error;
    }
    const store = getStore(ADM);
    if (store[docenteId]) {
      store[docenteId] = store[docenteId].filter(a => a.id !== asignId);
    }
    window._admAsignaciones = store;
    return store[docenteId] || [];
  }

  function agruparParaTabla(rows) {
    const grouped = {};
    (rows || []).forEach(r => {
      const key = r.docente_id || r.docente_nom;
      if (!grouped[key]) {
        grouped[key] = {
          nombre: r.docente_nom || `${r.usuarios?.nombre || ''} ${r.usuarios?.apellido_p || ''}`.trim(),
          asignaciones: [],
        };
      }
      if (r._demo) {
        (r.materias || []).forEach(m => grouped[key].asignaciones.push({ materia: m, grupo: '—' }));
      } else if (r.grupos) {
        grouped[key].asignaciones.push({ materia: r.materia || '—', grupo: r.grupos.nombre });
      }
    });
    return grouped;
  }

  function getAllAsignaciones(ADM) {
    const store = getStore(ADM);
    return Object.entries(store).flatMap(([docenteId, rows]) =>
      (rows || []).map(row => ({ ...row, docente_id: docenteId }))
    );
  }

  function analizarConflicto(ADM, payload) {
    const docenteId = payload?.docenteId || null;
    const grupoId = payload?.grupoId || null;
    const materia = String(payload?.materia || '').trim();
    const ciclo = payload?.ciclo || window.CICLO_ACTIVO;
    const materiaNorm = materia.toLowerCase();
    const allRows = getAllAsignaciones(ADM);

    const duplicadaMismoDocente = allRows.find(row =>
      String(row.docente_id) === String(docenteId) &&
      String(row.grupo_id || '') === String(grupoId || '') &&
      String(row.ciclo || window.CICLO_ACTIVO) === String(ciclo) &&
      String(row.materia || '').trim().toLowerCase() === materiaNorm
    ) || null;

    const conflictoGrupoMateria = allRows.find(row =>
      String(row.docente_id) !== String(docenteId) &&
      String(row.grupo_id || '') === String(grupoId || '') &&
      String(row.ciclo || window.CICLO_ACTIVO) === String(ciclo) &&
      String(row.materia || '').trim().toLowerCase() === materiaNorm
    ) || null;

    const cargaDocente = allRows.filter(row =>
      String(row.docente_id) === String(docenteId) &&
      String(row.ciclo || window.CICLO_ACTIVO) === String(ciclo)
    );

    return {
      duplicadaMismoDocente,
      conflictoGrupoMateria,
      cargaDocente,
      totalCargaDocente: cargaDocente.length,
    };
  }

  return {
    getDocenteAsignaciones,
    cargarDesdeDB,
    guardarAsignacion,
    quitarAsignacion,
    agruparParaTabla,
    analizarConflicto,
    getAllAsignaciones,
    setStore,
  };
})();
