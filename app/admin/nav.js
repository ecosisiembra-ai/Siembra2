window.SiembraAdminNav = (function() {
  const pageTitles = {
    dashboard: 'Dashboard',
    grupos: 'Grupos y salones',
    cobertura: 'Cobertura academica',
    docentes: 'Personal escolar',
    alumnos: 'Alumnos',
    materias: 'Materias',
    asignaciones: 'Asignaciones',
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
    if (page === 'asignaciones') {
      ADM.renderMaterias?.();
      ADM.renderAsignaciones?.();
      if (typeof window.admAsigTab === 'function') {
        window.admAsigTab('catalogo');
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
    activatePage(page);
    ADM.paginaActual = page;
    updateTopbar(page);
    runPageHooks(ADM, page);
    syncUserHeader(ADM);
  }

  return {
    navTo,
    pageTitles,
  };
})();
