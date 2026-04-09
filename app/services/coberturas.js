window.SiembraCoberturas = (function() {
  function getAsignacionesDocente(ADM, docenteId) {
    if (typeof ADM.obtenerAsignacionesDocente === 'function') {
      return ADM.obtenerAsignacionesDocente(docenteId) || [];
    }
    const asignaciones = ADM.asignacionesPorDocente || window._admAsignaciones || {};
    return Array.isArray(asignaciones) ? [] : (asignaciones[docenteId] || []);
  }

  function normalizarMateria(raw) {
    return String(raw || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function materiasBaseGrupo(ADM, grupo) {
    const nivel = grupo?.nivel || ADM.escuelaNivel || window._admNivelActivo || 'primaria';
    const grado = String(grupo?.grado || '').replace(/[°\s]/g, '').trim() || '1';
    if (nivel === 'secundaria') {
      return [...(window.MATERIAS_SECUNDARIA_POR_GRADO?.[grado] || window.MATERIAS_SECUNDARIA_POR_GRADO?.['1'] || [])];
    }
    return [...(window.getMateriasByNivel ? window.getMateriasByNivel('primaria') : [])];
  }

  function enriquecerGrupo(ADM, grupo) {
    if (!grupo) return grupo;
    const materiasBase = materiasBaseGrupo(ADM, grupo);
    return {
      ...grupo,
      materias_base: materiasBase,
      materias_base_count: materiasBase.length,
    };
  }

  function enriquecerGrupos(ADM, grupos) {
    return (grupos || []).map(g => enriquecerGrupo(ADM, g));
  }

  function coberturaGrupo(ADM, grupo) {
    const esperadas = materiasBaseGrupo(ADM, grupo);
    const cubiertasMap = new Map();
    (ADM.docentes || []).forEach(d => {
      const enEsteGrupo = getAsignacionesDocente(ADM, d.id).filter(a => a.grupo_id === grupo.id);
      enEsteGrupo.forEach(a => {
        const key = normalizarMateria(a.materia);
        const match = esperadas.find(m => normalizarMateria(m) === key);
        if (match) cubiertasMap.set(key, match);
      });
    });
    const cubiertas = Array.from(cubiertasMap.values());
    const faltantes = esperadas.filter(m => !cubiertasMap.has(normalizarMateria(m)));
    const estado = !faltantes.length ? 'completo' : (cubiertas.length ? 'incompleto' : 'sin_docentes');
    return { esperadas, cubiertas, faltantes, estado };
  }

  function alumnosPorGrupo(ADM, grupoId) {
    return (ADM.alumnos || []).filter(a => a.alumnos_grupos?.some(ag => String(ag.grupo_id) === String(grupoId)));
  }

  function siguienteAccion(detalle) {
    if (!detalle.alumnosCnt) return 'Cargar alumnos';
    if (detalle.cobertura.faltantes.length) return 'Asignar docentes';
    return 'Grupo operativo';
  }

  function detalleGrupo(ADM, grupo) {
    const alumnosCnt = alumnosPorGrupo(ADM, grupo?.id).length;
    const cobertura = coberturaGrupo(ADM, grupo);
    const porcentaje = cobertura.esperadas.length
      ? Math.round((cobertura.cubiertas.length / cobertura.esperadas.length) * 100)
      : 0;
    const estado = !alumnosCnt
      ? 'sin_alumnos'
      : (cobertura.estado === 'completo' ? 'completo' : (cobertura.cubiertas.length ? 'incompleto' : 'critico'));
    return {
      grupo,
      alumnosCnt,
      cobertura,
      porcentaje,
      estado,
      siguienteAccion: siguienteAccion({ alumnosCnt, cobertura }),
    };
  }

  function resumenGlobal(ADM) {
    const detalle = (ADM.grupos || []).map(g => detalleGrupo(ADM, g));
    const totalEsperadas = detalle.reduce((acc, d) => acc + d.cobertura.esperadas.length, 0);
    const totalCubiertas = detalle.reduce((acc, d) => acc + d.cobertura.cubiertas.length, 0);
    const totalFaltantes = detalle.reduce((acc, d) => acc + d.cobertura.faltantes.length, 0);
    const gruposCompletos = detalle.filter(d => d.estado === 'completo').length;
    const gruposSinAlumnos = detalle.filter(d => d.estado === 'sin_alumnos').length;
    const gruposOperativos = detalle.filter(d => d.alumnosCnt > 0 && d.cobertura.estado === 'completo').length;
    const porcentajeGlobal = totalEsperadas ? Math.round((totalCubiertas / totalEsperadas) * 100) : 0;
    return {
      detalle,
      totalEsperadas,
      totalCubiertas,
      totalFaltantes,
      gruposCompletos,
      gruposSinAlumnos,
      gruposOperativos,
      porcentajeGlobal,
    };
  }

  function checklistOperativo(ADM) {
    const resumen = resumenGlobal(ADM);
    const grupos = ADM.grupos || [];
    const docentes = ADM.docentes || [];
    const alumnos = ADM.alumnos || [];
    return [
      {
        key: 'grupos',
        label: 'Grupos creados',
        ok: grupos.length > 0,
        detail: grupos.length ? `${grupos.length} grupo(s) activos` : 'Crea la estructura escolar base',
      },
      {
        key: 'docentes',
        label: 'Docentes registrados',
        ok: docentes.length > 0,
        detail: docentes.length ? `${docentes.length} docente(s) disponibles` : 'Da de alta al personal docente',
      },
      {
        key: 'cobertura',
        label: 'Materias base cubiertas',
        ok: resumen.totalFaltantes === 0 && grupos.length > 0,
        detail: resumen.totalFaltantes ? `${resumen.totalFaltantes} materia(s) faltantes por asignar` : 'Cobertura base completa',
      },
      {
        key: 'alumnos',
        label: 'Alumnos cargados',
        ok: alumnos.length > 0,
        detail: alumnos.length ? `${alumnos.length} alumno(s) en padron` : 'Carga alumnos individualmente o por importacion',
      },
      {
        key: 'operacion',
        label: 'Grupos operativos',
        ok: resumen.gruposOperativos > 0,
        detail: resumen.gruposOperativos ? `${resumen.gruposOperativos} grupo(s) listos para operar` : 'Todavia no hay grupos completos para piloto',
      },
    ];
  }

  return {
    normalizarMateria,
    materiasBaseGrupo,
    enriquecerGrupo,
    enriquecerGrupos,
    coberturaGrupo,
    detalleGrupo,
    resumenGlobal,
    checklistOperativo,
  };
})();
