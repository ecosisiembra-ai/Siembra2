window.SiembraStore = (function() {
  function ensureRoot() {
    window.SIEMBRA = window.SIEMBRA || {};
    window.SIEMBRA.state = window.SIEMBRA.state || {};
    return window.SIEMBRA.state;
  }

  function defineAlias(name, key) {
    const desc = Object.getOwnPropertyDescriptor(window, name);
    if (desc && !desc.configurable) return;
    Object.defineProperty(window, name, {
      configurable: true,
      get() {
        return ensureRoot()[key];
      },
      set(value) {
        ensureRoot()[key] = value;
      },
    });
  }

  function initState(defaults) {
    const state = Object.assign({}, defaults || {}, ensureRoot());
    window.SIEMBRA.state = state;

    defineAlias('_grupoActivo', 'grupoActivo');
    defineAlias('_alumnosActivos', 'alumnos');
    defineAlias('_gruposDocente', 'grupos');
    defineAlias('_materiasDocente', 'materias');
    defineAlias('currentPerfil', 'perfil');
    defineAlias('ESCUELA_ACTIVA', 'escuela');
    defineAlias('CICLO_ACTIVO', 'ciclo');

    return state;
  }

  function getState() {
    return ensureRoot();
  }

  return {
    initState,
    getState,
  };
})();
