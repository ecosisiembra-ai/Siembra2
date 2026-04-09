window.SiembraAdminGrupos = (function() {
  function getAsignacionesDocente(ADM, docenteId) {
    if (typeof ADM.obtenerAsignacionesDocente === 'function') {
      return ADM.obtenerAsignacionesDocente(docenteId) || [];
    }
    const asignaciones = ADM.asignacionesPorDocente || window._admAsignaciones || {};
    return Array.isArray(asignaciones) ? [] : (asignaciones[docenteId] || []);
  }

  function renderGrupos(ADM) {
    const el = document.getElementById('adm-grupos-list');
    const sidebar = document.getElementById('adm-grados-sidebar');
    if (!el) return;

    if (!ADM.grupos.length) {
      if (sidebar) sidebar.innerHTML = '';
      el.innerHTML = `<div style="padding:48px 20px;text-align:center;background:white;border-radius:14px;border:1.5px solid #e2e8f0;">
        <div style="font-size:48px;margin-bottom:12px;">Grupo</div>
        <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:6px;">Sin grupos registrados</div>
        <div style="font-size:13px;color:#94a3b8;margin-bottom:16px;">Crea los grupos del ciclo escolar para organizar a los alumnos.</div>
        <button onclick="ADM.abrirModalGrupo()" style="padding:10px 20px;background:linear-gradient(135deg,#0d5c2f,#157a40);color:white;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;">Crear primer grupo</button>
      </div>`;
      return;
    }

    const porGrado = {};
    ADM.grupos.forEach(grupo => {
      const grado = parseInt(grupo.grado, 10) || 0;
      if (!porGrado[grado]) porGrado[grado] = [];
      porGrado[grado].push(grupo);
    });
    Object.values(porGrado).forEach(lista => {
      lista.sort((a, b) => (a.seccion || '').localeCompare(b.seccion || ''));
    });

    const grados = Object.keys(porGrado).map(Number).sort((a, b) => a - b);
    if (!window._admGradoActivo || !porGrado[window._admGradoActivo]) {
      window._admGradoActivo = grados[0];
    }

    if (sidebar) {
      sidebar.innerHTML = grados.map(grado => {
        const total = porGrado[grado].length;
        const activa = grado === window._admGradoActivo;
        return `<button onclick="admSelGrado(${grado})" style="width:100%;text-align:left;padding:10px 12px;border:none;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;font-weight:${activa ? '700' : '600'};cursor:pointer;background:${activa ? '#0d5c2f' : 'transparent'};color:${activa ? 'white' : '#334155'};display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;transition:.15s;">
          <span>${grado} grado</span>
          <span style="font-size:10px;background:${activa ? 'rgba(255,255,255,.25)' : '#f1f5f9'};color:${activa ? 'white' : '#64748b'};border-radius:99px;padding:1px 7px;font-weight:700;">${total}</span>
        </button>`;
      }).join('');
    }

    const gruposDelGrado = porGrado[window._admGradoActivo] || [];
    el.innerHTML = gruposDelGrado.map(grupo => {
      const alumnosDelGrupo = ADM.alumnos.filter(alumno => alumno.alumnos_grupos?.some(rel => rel.grupo_id === grupo.id));
      const alumnosCnt = alumnosDelGrupo.length;
      const cobertura = ADM._coberturaGrupo(grupo);

      const docentesAsignados = [];
      ADM.docentes.forEach(docente => {
        const asignaciones = getAsignacionesDocente(ADM, docente.id).filter(item => item.grupo_id === grupo.id);
        if (asignaciones.length) {
          docentesAsignados.push({
            nombre: `${docente.nombre || ''} ${docente.apellido || docente.apellido_p || ''}`.trim(),
            materias: asignaciones.map(item => item.materia).join(', '),
          });
        }
      });

      const docentesHtml = docentesAsignados.length
        ? docentesAsignados.map(docente => `<span style="display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px;padding:3px 10px;font-size:11px;color:#166534;font-weight:600;">Docente ${docente.nombre.split(' ')[0]} <span style="color:#64748b;font-weight:400;">(${docente.materias})</span></span>`).join(' ')
        : '<span style="font-size:11px;color:#94a3b8;">Sin docentes asignados</span>';

      const coberturaBadge = cobertura.estado === 'completo'
        ? '<span class="adm-badge" style="background:#dcfce7;color:#166534;">Cobertura completa</span>'
        : (cobertura.cubiertas.length
            ? `<span class="adm-badge" style="background:#fef3c7;color:#92400e;">Faltan ${cobertura.faltantes.length}</span>`
            : '<span class="adm-badge" style="background:#fee2e2;color:#b91c1c;">Sin cobertura docente</span>');

      const materiasBaseHtml = cobertura.esperadas.map(materia => {
        const ok = cobertura.cubiertas.some(cubierta => ADM._normalizarMateriaCobertura(cubierta) === ADM._normalizarMateriaCobertura(materia));
        return `<span style="display:inline-flex;align-items:center;gap:4px;background:${ok ? '#f0fdf4' : '#f8fafc'};border:1px solid ${ok ? '#bbf7d0' : '#e2e8f0'};border-radius:20px;padding:3px 10px;font-size:11px;color:${ok ? '#166534' : '#64748b'};font-weight:600;">${ok ? 'OK' : 'Pendiente'} ${materia}</span>`;
      }).join(' ');

      const faltantesHtml = cobertura.faltantes.length
        ? cobertura.faltantes.map(materia => `<span style="display:inline-flex;align-items:center;gap:4px;background:#fff7ed;border:1px solid #fed7aa;border-radius:20px;padding:3px 10px;font-size:11px;color:#9a3412;font-weight:700;">Falta ${materia}</span>`).join(' ')
        : '<span style="font-size:11px;color:#16a34a;font-weight:700;">Todas las materias base estan cubiertas.</span>';

      const alumnosHtml = alumnosDelGrupo.length
        ? alumnosDelGrupo
            .sort((a, b) => ((a.apellido_p || a.apellido || '') + (a.nombre || '')).localeCompare((b.apellido_p || b.apellido || '') + (b.nombre || '')))
            .map(alumno => {
              const nombre = [alumno.apellido_p, alumno.apellido_m, alumno.nombre].filter(Boolean).join(' ') || alumno.nombre || '-';
              return `<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:#f8fafc;border-radius:7px;font-size:12px;">
                <div style="width:24px;height:24px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#475569;flex-shrink:0;">${(alumno.nombre || '?')[0].toUpperCase()}</div>
                <span style="flex:1;">${nombre}</span>
                <button onclick="ADM.abrirFichaAlumno && ADM.abrirFichaAlumno('${alumno.id}')" style="padding:2px 8px;border:1px solid #e2e8f0;border-radius:5px;background:white;font-size:10px;color:#64748b;cursor:pointer;font-family:'Sora',sans-serif;">Ver</button>
              </div>`;
            }).join('')
        : '<div style="padding:10px 12px;font-size:12px;color:#94a3b8;">Sin alumnos en este grupo</div>';

      const gid = grupo.id;
      return `<div class="adm-card" style="margin-bottom:12px;">
        <div class="adm-card-header" style="cursor:pointer;" onclick="admToggleGrupo('${gid}')">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:18px;font-weight:700;color:#15803d;flex-shrink:0;">${grupo.grado}${grupo.seccion || 'A'}</div>
              <div>
                <div class="adm-card-title">${grupo.nombre || `${grupo.grado} ${grupo.seccion || 'A'}`}</div>
                <div class="adm-card-sub">${grupo.turno || 'Matutino'} · ${grupo.nivel || 'primaria'} · ${grupo.ciclo || window.CICLO_ACTIVO}</div>
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
            <button class="adm-btn-sm" onclick="event.stopPropagation();ADM.abrirEditarGrupo('${gid}')">Editar</button>
            <button class="adm-btn-sm adm-btn-danger" onclick="event.stopPropagation();ADM.eliminarGrupo('${gid}','${grupo.nombre || grupo.grado}')" aria-label="Eliminar">X</button>
            <span id="adm-grp-arrow-${gid}" style="font-size:14px;color:#94a3b8;transition:.2s;display:inline-block;">v</span>
          </div>
        </div>
        <div id="adm-grp-alumnos-${gid}" style="display:none;border-top:1px solid #f1f5f9;padding:10px 16px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
            <button class="adm-btn-sm" onclick="ADM.abrirAltaAlumnoGrupo('${gid}')">Alta alumno</button>
            <button class="adm-btn-sm" onclick="ADM.navTo && ADM.navTo('docentes'); ADM.toast('Revisa Personal para cubrir las materias faltantes del grupo', 'ok');">Asignar docentes</button>
          </div>
          <div style="margin-bottom:12px;">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:8px;">Cobertura academica</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">${materiasBaseHtml}</div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin:10px 0 8px;">Materias faltantes por cubrir</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">${faltantesHtml}</div>
          </div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:8px;">Alumnos · ${alumnosCnt}</div>
          <div style="display:flex;flex-direction:column;gap:4px;">${alumnosHtml}</div>
        </div>
      </div>`;
    }).join('') || `<div style="padding:40px;text-align:center;background:white;border-radius:14px;border:1.5px dashed #e2e8f0;color:#94a3b8;">Sin grupos en ${window._admGradoActivo} grado</div>`;
  }

  function renderCoberturaAcademica(ADM) {
    const kpisEl = document.getElementById('adm-cobertura-kpis');
    const gradosEl = document.getElementById('adm-cobertura-grados');
    const estadosEl = document.getElementById('adm-cobertura-estados');
    const tablaEl = document.getElementById('adm-cobertura-tabla');
    const legendEl = document.getElementById('adm-cobertura-legend');
    if (!kpisEl || !gradosEl || !estadosEl || !tablaEl) return;

    const grupos = ADM.grupos || [];
    if (!grupos.length) {
      kpisEl.innerHTML = '';
      gradosEl.innerHTML = '<div style="padding:28px;color:#94a3b8;text-align:center;">Sin grupos para analizar todavia.</div>';
      estadosEl.innerHTML = '<div style="padding:28px;color:#94a3b8;text-align:center;">Crea grupos para ver cobertura.</div>';
      tablaEl.innerHTML = '<div style="padding:28px;color:#94a3b8;text-align:center;">Aun no hay datos de cobertura.</div>';
      return;
    }

    const detalle = grupos.map(grupo => {
      const alumnosCnt = ADM.alumnos.filter(alumno => alumno.alumnos_grupos?.some(rel => rel.grupo_id === grupo.id)).length;
      const cobertura = ADM._coberturaGrupo(grupo);
      const porcentaje = cobertura.esperadas.length ? Math.round((cobertura.cubiertas.length / cobertura.esperadas.length) * 100) : 0;
      const estado = !alumnosCnt ? 'sin_alumnos' : (cobertura.estado === 'completo' ? 'completo' : (cobertura.cubiertas.length ? 'incompleto' : 'critico'));
      return { grupo, alumnosCnt, cobertura, porcentaje, estado };
    });

    const totalEsperadas = detalle.reduce((acc, item) => acc + item.cobertura.esperadas.length, 0);
    const totalCubiertas = detalle.reduce((acc, item) => acc + item.cobertura.cubiertas.length, 0);
    const totalFaltantes = detalle.reduce((acc, item) => acc + item.cobertura.faltantes.length, 0);
    const gruposCompletos = detalle.filter(item => item.estado === 'completo').length;
    const gruposSinAlumnos = detalle.filter(item => item.estado === 'sin_alumnos').length;
    const porcentajeGlobal = totalEsperadas ? Math.round((totalCubiertas / totalEsperadas) * 100) : 0;

    kpisEl.innerHTML = [
      { label: 'Cobertura global', value: `${porcentajeGlobal}%`, sub: `${totalCubiertas}/${totalEsperadas} materias cubiertas`, color: '#0d5c2f', bg: '#f0fdf4' },
      { label: 'Grupos completos', value: String(gruposCompletos), sub: `de ${detalle.length} grupos activos`, color: '#1d4ed8', bg: '#eff6ff' },
      { label: 'Materias faltantes', value: String(totalFaltantes), sub: 'pendientes de asignar', color: '#b45309', bg: '#fffbeb' },
      { label: 'Grupos sin alumnos', value: String(gruposSinAlumnos), sub: 'requieren carga escolar', color: '#be123c', bg: '#fff1f2' },
    ].map(card => `
      <div style="background:${card.bg};border:1px solid rgba(15,23,42,.06);border-radius:16px;padding:18px;">
        <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.6px;">${card.label}</div>
        <div style="font-size:34px;font-weight:900;color:${card.color};line-height:1;margin-top:8px;">${card.value}</div>
        <div style="font-size:12px;color:#64748b;margin-top:8px;">${card.sub}</div>
      </div>`).join('');

    const porGrado = {};
    detalle.forEach(item => {
      const grado = String(item.grupo.grado).replace(/\s/g, '') || '1';
      if (!porGrado[grado]) porGrado[grado] = { cubiertas: 0, esperadas: 0 };
      porGrado[grado].cubiertas += item.cobertura.cubiertas.length;
      porGrado[grado].esperadas += item.cobertura.esperadas.length;
    });

    gradosEl.innerHTML = Object.keys(porGrado).sort((a, b) => Number(a) - Number(b)).map(grado => {
      const row = porGrado[grado];
      const pct = row.esperadas ? Math.round((row.cubiertas / row.esperadas) * 100) : 0;
      const color = pct >= 95 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626';
      return `
        <div style="display:grid;grid-template-columns:90px 1fr 56px;gap:12px;align-items:center;margin-bottom:12px;">
          <div style="font-size:13px;font-weight:800;color:#0f172a;">${grado} grado</div>
          <div style="height:12px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${color};border-radius:999px;"></div>
          </div>
          <div style="font-size:12px;font-weight:800;color:${color};text-align:right;">${pct}%</div>
        </div>`;
    }).join('');

    const estadoConfig = {
      completo: { label: 'Completos', color: '#166534', bg: '#dcfce7' },
      incompleto: { label: 'Incompletos', color: '#92400e', bg: '#fef3c7' },
      critico: { label: 'Criticos', color: '#b91c1c', bg: '#fee2e2' },
      sin_alumnos: { label: 'Sin alumnos', color: '#7c2d12', bg: '#ffedd5' },
    };

    estadosEl.innerHTML = Object.entries(estadoConfig).map(([key, config]) => {
      const count = detalle.filter(item => item.estado === key).length;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:14px;background:${config.bg};margin-bottom:10px;">
          <div style="font-size:13px;font-weight:800;color:${config.color};">${config.label}</div>
          <div style="font-size:26px;font-weight:900;color:${config.color};line-height:1;">${count}</div>
        </div>`;
    }).join('');

    if (legendEl) {
      legendEl.innerHTML = `
        <span style="padding:4px 10px;border-radius:999px;background:#dcfce7;color:#166534;font-size:11px;font-weight:800;">Completo</span>
        <span style="padding:4px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:800;">Incompleto</span>
        <span style="padding:4px 10px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:11px;font-weight:800;">Critico</span>
        <span style="padding:4px 10px;border-radius:999px;background:#ffedd5;color:#9a3412;font-size:11px;font-weight:800;">Sin alumnos</span>`;
    }

    const estadoChip = item => {
      const map = {
        completo: ['#dcfce7', '#166534', 'Completo'],
        incompleto: ['#fef3c7', '#92400e', 'Incompleto'],
        critico: ['#fee2e2', '#b91c1c', 'Critico'],
        sin_alumnos: ['#ffedd5', '#9a3412', 'Sin alumnos'],
      };
      const [bg, color, label] = map[item.estado];
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
            <th>Accion</th>
          </tr>
        </thead>
        <tbody>
          ${detalle
            .sort((a, b) => (Number(a.grupo.grado) - Number(b.grupo.grado)) || String(a.grupo.seccion || '').localeCompare(String(b.grupo.seccion || '')))
            .map(item => `
            <tr>
              <td>
                <div style="font-weight:800;color:#0f172a;">${item.grupo.nombre || `${item.grupo.grado} ${item.grupo.seccion || 'A'}`}</div>
                <div style="font-size:11px;color:#64748b;">${item.grupo.turno || 'matutino'} · ${item.grupo.nivel || ADM.escuelaNivel || window._admNivelActivo || '-'}</div>
              </td>
              <td style="font-weight:800;">${item.alumnosCnt}</td>
              <td>
                <div style="font-size:12px;font-weight:800;color:#0f172a;">${item.cobertura.cubiertas.length}/${item.cobertura.esperadas.length}</div>
                <div style="height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-top:6px;min-width:120px;">
                  <div style="width:${item.porcentaje}%;height:100%;background:${item.porcentaje >= 95 ? '#16a34a' : item.porcentaje >= 70 ? '#d97706' : '#dc2626'};"></div>
                </div>
              </td>
              <td>
                ${item.cobertura.faltantes.length
                  ? item.cobertura.faltantes.slice(0, 3).map(materia => `<span style="display:inline-flex;align-items:center;gap:4px;background:#fff7ed;border:1px solid #fed7aa;border-radius:20px;padding:3px 8px;font-size:10px;color:#9a3412;font-weight:700;margin:2px;">${materia}</span>`).join('')
                  : '<span style="font-size:11px;color:#16a34a;font-weight:800;">Sin faltantes</span>'}
              </td>
              <td>${estadoChip(item)}</td>
              <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <button class="adm-btn-sm" onclick="ADM.abrirAltaAlumnoGrupo('${item.grupo.id}')">Alumno</button>
                  <button class="adm-btn-sm" onclick="ADM.navTo('docentes'); ADM.toast('Revisa Personal para cubrir las materias faltantes', 'ok');">Docente</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  return {
    renderGrupos,
    renderCoberturaAcademica,
  };
})();
