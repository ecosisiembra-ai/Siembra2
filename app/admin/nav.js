window.SiembraAdminNav = (function() {
  const pageTitles = {
    dashboard: 'Dashboard',
    grupos: 'Grupos y salones',
    cobertura: 'Cobertura academica',
    personal: 'Personal y materias',
    docentes: 'Personal y materias',
    alumnos: 'Alumnos',
    materias: 'Personal y materias',
    asignaciones: 'Personal y materias',
    importar: 'Importar CSV',
    vinculos: 'Codigos QR',
    solicitudes: 'Vinculaciones Padre-Alumno',
    constructor: 'Constructor de horarios',
    conflictos: 'Deteccion de conflictos',
    horarios: 'Horarios escolares',
    'horarios-pub': 'Horarios publicados',
    acceso: 'Solicitudes de acceso',
    anuncios: 'Anuncios',
    cobranza: 'Cobranza escolar',
    'control-escolar': 'Control Escolar',
    expedientes: 'Expedientes',
    constancias: 'Constancias',
    correspondencia: 'Correspondencia',
  };

  function activatePage(page) {
    document.querySelectorAll('#admin-portal .adm-nav-btn').forEach(button => {
      button.classList.remove('active');
    });
    document.querySelectorAll('#admin-portal .adm-page').forEach(panel => {
      panel.style.display = '';
      panel.classList.remove('active');
    });

    const button = document.getElementById(`adm-nav-${page}`);
    const panel = document.getElementById(`adm-p-${page}`);
    if (button) button.classList.add('active');
    if (panel) {
      panel.style.display = '';
      panel.classList.add('active');
    }
  }

  function updateTopbar(page) {
    const topbarTitle = document.getElementById('adm-topbar-title');
    if (topbarTitle) {
      topbarTitle.textContent = pageTitles[page] || page;
    }
  }

  function runPageHooks(ADM, page) {
    if (page === 'personal') {
      ADM.renderPersonalKPIs?.();
      ADM.renderDocentes?.();
      ADM.renderMaterias?.();
      ADM.renderAsignaciones?.();
      ADM.renderMapaCobertura?.();
      // Asegurar que el tab Personal esté activo al entrar
      if (typeof window.admPMTab === 'function') {
        window.admPMTab('personal');
      }
    }

    if (page === 'asignaciones') {
      // compat: redirigir al tab Asignaciones dentro de personal
      ADM.renderPersonalKPIs?.();
      ADM.renderMaterias?.();
      ADM.renderAsignaciones?.();
      ADM.renderMapaCobertura?.();
      if (typeof window.admPMTab === 'function') {
        window.admPMTab('asignaciones');
      }
    }

    if (page === 'cobertura') {
      ADM.renderCoberturaAcademica?.();
    }

    if (page === 'horarios') {
      window.setTimeout(() => {
        if (typeof window.admCargarHorarios === 'function') {
          window.admCargarHorarios();
        }
      }, 100);
    }

    if (page === 'horarios-pub') {
      window.setTimeout(() => {
        if (typeof window.admCargarHorariosPublicados === 'function') {
          window.admCargarHorariosPublicados();
        }
      }, 100);
    }

    if (page === 'cobranza') {
      window.COB?.init?.();
    }
  }

  function syncUserHeader(ADM) {
    const nameEl = document.getElementById('adm-user-name');
    const avatarEl = document.getElementById('adm-avatar');
    const escuelaTag = document.getElementById('adm-escuela-tag');
    const perfil = window.currentPerfil;

    if (!perfil) return;

    const nombre = perfil.nombre || '-';
    if (nameEl) {
      nameEl.textContent = nombre;
    }
    if (avatarEl) {
      avatarEl.textContent = nombre
        .split(' ')
        .map(part => part[0] || '')
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'A';
    }
    if (escuelaTag) {
      escuelaTag.textContent = ADM.escuelaNombre || perfil.escuela_nombre || 'Escuela';
    }
  }

  function navTo(ADM, page) {
    // Redirigir páginas fusionadas a la nueva página unificada
    const pageMap = { docentes: 'personal', materias: 'personal' };
    const resolvedPage = pageMap[page] || page;
    activatePage(resolvedPage);
    // Activar también el botón de personal si se navega desde docentes/asignaciones
    if (pageMap[page]) {
      const btnPersonal = document.getElementById('adm-nav-personal');
      if (btnPersonal) btnPersonal.classList.add('active');
    }
    ADM.paginaActual = resolvedPage;
    updateTopbar(resolvedPage);
    runPageHooks(ADM, resolvedPage);
    // Si venía de asignaciones, activar ese tab dentro de personal
    if (page === 'asignaciones' && typeof window.admPMTab === 'function') {
      window.admPMTab('asignaciones');
    }
    syncUserHeader(ADM);
  }

  return {
    navTo,
    pageTitles,
  };
})();
