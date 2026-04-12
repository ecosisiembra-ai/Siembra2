/**
 * SIEMBRA — Configuración centralizada
 * Todas las credenciales y URLs viven aquí.
 * En producción, Vercel/CI inyecta __SIEMBRA_CONFIG__ desde las variables de entorno.
 * En desarrollo local, se usa el fallback o el instalador.
 */
(function () {
  // 1. Configuración inyectada en build-time (Vercel Edge Config / env vars)
  //    Dejar vacío en desarrollo; rellenar en el proceso de CI/CD.
  const _BUILD_CFG = (typeof __SIEMBRA_BUILD_CFG__ !== 'undefined')
    ? __SIEMBRA_BUILD_CFG__          // eslint-disable-line no-undef
    : null;

  // 2. Configuración guardada por el instalador de escuela
  let _installerCfg = null;
  try {
    _installerCfg = JSON.parse(localStorage.getItem('siembra_escuela_cfg') || 'null');
  } catch (_) {}

  // 3. Defaults de fallback (hub compartido)
  //    La anon key de Supabase es pública por diseño — no es un secreto.
  //    El API key de Anthropic vive solo en el Edge Function (servidor).
  const _DEFAULTS = {
    supabaseUrl: 'https://mgmkzxtljkyoxqeytbjv.supabase.co',
    supabaseKey: 'sb_publishable_OrPA2AtUeRl20uuj6uqTaw_yYnWAWt3',
    appName: 'SIEMBRA',
    version: '17.0',
  };

  // Orden de prioridad: build > instalador > defaults
  const resolved = Object.assign({}, _DEFAULTS, _installerCfg || {}, _BUILD_CFG || {});

  window.SIEMBRA_CONFIG = {
    supabaseUrl: resolved.supabaseUrl || resolved.url || _DEFAULTS.supabaseUrl,
    supabaseKey: resolved.supabaseKey || resolved.key || _DEFAULTS.supabaseKey,
    appName:     resolved.appName     || _DEFAULTS.appName,
    version:     resolved.version     || _DEFAULTS.version,
    plan:        resolved.plan        || 'base',
    escuelaNombre: resolved.nombre    || '',
    escuelaCct:    resolved.cct       || '',
    nivelDefault:  resolved.nivel_default || 'secundaria',
  };

  // Retrocompatibilidad: exponer las variables globales que usa el resto del código
  window.SUPABASE_URL = window.SIEMBRA_CONFIG.supabaseUrl;
  window.SUPABASE_KEY = window.SIEMBRA_CONFIG.supabaseKey;
  window._escuelaCfg  = window._escuelaCfg || {
    url:           window.SIEMBRA_CONFIG.supabaseUrl,
    key:           window.SIEMBRA_CONFIG.supabaseKey,
    nombre:        window.SIEMBRA_CONFIG.escuelaNombre,
    cct:           window.SIEMBRA_CONFIG.escuelaCct,
    nivel_default: window.SIEMBRA_CONFIG.nivelDefault,
    plan:          window.SIEMBRA_CONFIG.plan,
  };

  // Sincronizar localStorage para que alumno.html y padres.html hereden la config
  try {
    if (!localStorage.getItem('siembra_supabase_url')) {
      localStorage.setItem('siembra_supabase_url', window.SIEMBRA_CONFIG.supabaseUrl);
      localStorage.setItem('siembra_supabase_key', window.SIEMBRA_CONFIG.supabaseKey);
    }
  } catch (_) {}
})();
