window.SiembraRuntime = (function() {
  const params = new URLSearchParams(window.location.search);
  const htmlMode = String(document.documentElement?.dataset?.siembraMode || '').trim().toLowerCase();
  const queryMode = String(params.get('mode') || '').trim().toLowerCase();
  const explicitDemo = params.get('demo') === '1';
  const path = String(window.location.pathname || '').toLowerCase();

  const isDemoRoute = path.endsWith('/demo.html') || path.endsWith('\\demo.html');
  const isDemoMode = explicitDemo || queryMode === 'demo' || htmlMode === 'demo' || isDemoRoute;
  const mode = isDemoMode ? 'demo' : 'production';
  const demoUrl = 'demo.html?mode=demo';

  function shouldAllowDemoEntry() {
    return mode === 'demo';
  }

  function configureLoginScreen() {
    const btn = document.getElementById('hub-demo-btn');
    const wrap = document.getElementById('hub-demo-wrap');
    if (!btn || !wrap) return;

    if (shouldAllowDemoEntry()) {
      wrap.style.display = 'flex';
      return;
    }

    wrap.style.display = 'none';
  }

  function buildNoConnectionMessage() {
    return shouldAllowDemoEntry()
      ? 'Sin conexión a Supabase. Usa esta entrada de demo para explorar.'
      : 'Sin conexión a Supabase. La entrada productiva requiere backend activo.';
  }

  function setVisible(id, visible, displayValue) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = visible ? (displayValue || '') : 'none';
  }

  return {
    mode,
    isDemoMode,
    demoUrl,
    shouldAllowDemoEntry,
    configureLoginScreen,
    buildNoConnectionMessage,
    setVisible,
  };
})();

window.SIEMBRA_RUNTIME = window.SiembraRuntime;
