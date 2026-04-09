window.SiembraPlaneaciones = (function() {
  function getGrupoDocente(grupoId, gruposDocente, grupoActivo) {
    const grupos = gruposDocente || window._gruposDocente || [];
    const wanted = String(grupoId || grupoActivo || window._grupoActivo || '');
    return grupos.find(g => String(g.id) === wanted) || null;
  }

  function getGrupoNombre(grupo) {
    if (!grupo) return '';
    return grupo.nombre || `${grupo.grado || ''}° ${grupo.seccion || ''}`.trim();
  }

  function buildPayload(params) {
    const {
      seleccion,
      texto,
      meta,
      checklist,
      status,
      fechaHoy,
    } = params;

    if (!seleccion || !texto) return null;

    const ejes = Object.keys(checklist || {})
      .filter(k => checklist[k])
      .map(k => ({
        contextualizada: 'Contextualizada al grupo',
        evaluacion_clara: 'Evaluacion formativa',
        inclusion: 'Inclusion y ajustes',
        evidencia: 'Producto definido',
      })[k])
      .filter(Boolean);

    return {
      titulo: `${seleccion.matNombre}: ${seleccion.contenido.substring(0, 40)}`,
      materia: seleccion.matNombre || '',
      grupo: meta.grupoNombre || meta.grado || '',
      semana: meta.semana || '',
      objetivo: meta.proposito || seleccion.contenido || '',
      recursos: meta.recursosBase || meta.producto || '',
      evaluacion: meta.ajustes || '',
      contenido_json: {
        titulo: `${seleccion.matNombre}: ${seleccion.contenido.substring(0, 60)}`,
        texto,
        grado: meta.grado || '—',
        grupo_id: meta.grupoId || '',
        nivel: meta.nivel,
        campo: seleccion.campoNombre,
        materia: seleccion.matNombre,
        contenido: seleccion.contenido,
        pdas: seleccion.pdasSel || seleccion.pdaTexto || '',
        docente: meta.docente || '',
        escuela: meta.escuela || '',
        contexto: meta.contexto || '',
        proposito: meta.proposito || '',
        producto: meta.producto || '',
        recursos_base: meta.recursosBase || '',
        ajustes: meta.ajustes || '',
        notas_revision: meta.notasRevision || '',
        checklist: checklist || {},
        ejes,
        semanas: 1,
        fecha: fechaHoy,
        status: status || 'lista',
        revision: {
          comentarios: '',
          revisada_por: null,
          revisada_at: null,
        },
      },
    };
  }

  function validarPlaneacion(params) {
    const { seleccion, texto, meta } = params || {};
    const errores = [];
    const warnings = [];
    if (!meta?.grupoId) errores.push('Selecciona un grupo asignado antes de guardar.');
    if (!meta?.grupoNombre && !meta?.grado) errores.push('No se pudo resolver el grupo de la planeacion.');
    if (!seleccion?.matNombre) errores.push('Selecciona una materia valida para la planeacion.');
    if (!seleccion?.contenido) errores.push('Selecciona un contenido antes de guardar.');
    if (!texto || String(texto).trim().length < 120) errores.push('La planeacion generada esta incompleta o demasiado corta.');

    const grupoTexto = String(meta?.grupoNombre || meta?.grado || '').toLowerCase();
    const materiaTexto = String(seleccion?.matNombre || '').toLowerCase();
    const textoNorm = String(texto || '').toLowerCase();

    if (grupoTexto && !textoNorm.includes(grupoTexto.slice(0, Math.min(grupoTexto.length, 8)))) {
      warnings.push('Revisa que el texto final mencione el grupo correcto.');
    }
    if (materiaTexto && !textoNorm.includes(materiaTexto.slice(0, Math.min(materiaTexto.length, 8)))) {
      warnings.push('Revisa que el texto final mantenga la materia seleccionada.');
    }

    return {
      ok: errores.length === 0,
      errores,
      warnings,
    };
  }

  async function cargarDesdeDB(options) {
    const { sb, cct, docenteId, ciclo } = options;
    if (!sb || !cct || !docenteId) return [];
    const { data, error } = await sb.from('planeaciones_clase')
      .select('*')
      .eq('docente_id', docenteId)
      .eq('escuela_cct', cct)
      .eq('ciclo', ciclo)
      .order('semana', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function guardarDB(options) {
    const { sb, cct, docenteId, ciclo, planData, updatedAt } = options;
    if (!sb || !cct || !docenteId) throw new Error('Sin conexión — no se puede guardar');
    const payload = {
      docente_id: docenteId,
      escuela_cct: cct,
      ciclo,
      semana: planData.semana || new Date().toISOString().split('T')[0],
      materia: planData.materia || '',
      grupo: planData.grupo || '',
      objetivo: planData.objetivo || '',
      recursos: planData.recursos || '',
      evaluacion: planData.evaluacion || '',
      contenido_json: planData.contenido_json || {},
      updated_at: updatedAt || new Date().toISOString(),
    };

    const { data, error } = await sb.from('planeaciones_clase')
      .upsert(payload, { onConflict: 'docente_id,ciclo,semana,materia,grupo' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  return {
    getGrupoDocente,
    getGrupoNombre,
    buildPayload,
    validarPlaneacion,
    cargarDesdeDB,
    guardarDB,
  };
})();
