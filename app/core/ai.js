// ══════════════════════════════════════════════════════════════════════════════
// SIEMBRA — Módulo de IA v2  (app/core/ai.js)
// Cubre los 4 roles de acompañamiento:
//   Docente | Director | Padres | Alumno
// ══════════════════════════════════════════════════════════════════════════════

// ── Límites de uso diario por feature ────────────────────────────────────────
const AI_LIMITES = {
  // Docente
  actividad:    2,
  examen:       3,   // aumentado: fácil + medio + difícil
  planeacion:   1,
  observacion:  3,
  retroalim:    3,
  ficha:        2,
  acomodo:      1,
  radar:        2,
  portafolio:   2,
  docente_chat: 20,
  // Director
  director_radar:    3,
  director_alertas:  3,
  director_chat:     15,
  // Padres
  padres_consejo: 5,
  padres_chat:    10,
  // Alumno
  alumno_tutor:    5,
  alumno_ejercicio: 5,
  alumno_chat:     20,
  // Default
  _default: 3,
};

function aiVerificarLimite(feature) {
  const hoy = new Date().toISOString().slice(0, 10);
  const key = 'siembra_ai_uso_' + (window.currentPerfil?.id || 'demo');
  let datos;
  try { datos = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { datos = null; }
  if (!datos || datos.fecha !== hoy) datos = { fecha: hoy, conteos: {} };

  const limite = AI_LIMITES[feature] ?? AI_LIMITES._default;
  const usado  = datos.conteos[feature] || 0;
  return { ok: usado < limite, usado, limite, datos, key };
}

function aiRegistrarUso(feature) {
  const { datos, key } = aiVerificarLimite(feature);
  datos.conteos[feature] = (datos.conteos[feature] || 0) + 1;
  try { localStorage.setItem(key, JSON.stringify(datos)); } catch (e) { /* noop */ }
}

function aiMostrarLimiteAgotado(feature, limite) {
  if (typeof hubToast === 'function') {
    hubToast(`Límite de ${limite} uso${limite > 1 ? 's' : ''} diarios para esta función. Disponible mañana.`, 'warn');
  }
}

// ── Función central ───────────────────────────────────────────────────────────
async function callAI({ feature, prompt, system, context, stream = false, extra = {} }) {
  if (feature) {
    const check = aiVerificarLimite(feature);
    if (!check.ok) {
      aiMostrarLimiteAgotado(feature, check.limite);
      throw new Error(`Límite diario alcanzado (${check.limite} usos) para esta función. Disponible mañana.`);
    }
    aiRegistrarUso(feature);
  }

  const { data: { session } } = await sb.auth.getSession();
  const jwt = session?.access_token;
  if (!jwt) throw new Error('Sesión expirada. Por favor recarga la página.');

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-router`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
    body: JSON.stringify({
      feature, prompt, system, context,
      escuela_id: window.currentPerfil?.escuela_cct || window._escuelaCfg?.cct,
      nivel:      window._nivelActivo || 'secundaria',
      ciclo:      window.CICLO_ACTIVO,
      grado:      window.currentPerfil?.grado || window._gradoActivo || null,
      stream,
      ...extra, // campos adicionales: materia, temas, dificultad, etc.
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Error ${resp.status}`);
  }
  if (stream) return resp;
  const data = await resp.json();
  return data.text || '';
}

// ── Sistema NEM (context builder para docentes) ───────────────────────────────
function _nemSys(extra = '') {
  const nivel  = window._nivelActivo || 'secundaria';
  const ciclo  = window.CICLO_ACTIVO || '2025-2026';
  const p      = window.currentPerfil || {};
  const escuela = p.escuela_nombre || p.escuela_cct || 'escuela pública mexicana';
  return `Eres un experto en educación básica mexicana con 20 años de experiencia docente y especialización en la Nueva Escuela Mexicana (NEM 2022).

MARCO PEDAGÓGICO:
• Campos formativos NEM: Lenguajes | Saberes y Pensamiento Científico | Ética Naturaleza y Sociedades | De lo Humano y lo Comunitario
• Ejes articuladores: Inclusión, Pensamiento crítico, Interculturalidad crítica, Igualdad de género, Vida saludable, Lectura y escritura, Artes
• Evaluación formativa (procesos, no solo resultados numéricos)
• Aprendizaje situado: conectar con la vida real y comunidad del alumno
• Anti-rezago: scaffolding y actividades de nivelación progresiva

CONTEXTO: Nivel ${nivel} | Ciclo ${ciclo} | Escuela: ${escuela}${extra ? '\n\n' + extra : ''}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ██  FUNCIONES DE ACOMPAÑAMIENTO DOCENTE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Genera un examen completo con nivel de dificultad seleccionable.
 * @param {object} opts
 * @param {string} opts.materia
 * @param {string} opts.temas       - Temas o aprendizajes clave
 * @param {'facil'|'medio'|'dificil'|'mixto'} opts.dificultad
 * @param {number}  opts.numPreguntas
 * @param {number}  opts.trimestre
 */
async function aiGenerarExamen({ materia, temas, dificultad = 'mixto', numPreguntas = 10, trimestre = 1 }) {
  return callAI({
    feature: 'examen',
    prompt:  `Genera examen para ${materia}. Temas: ${temas}`,
    extra: { materia, temas, dificultad, num_preguntas: numPreguntas, trimestre },
  });
}

/**
 * Consejo pedagógico rápido para el docente.
 * @param {string} situacion  - Descripción del problema o pregunta
 */
async function aiConsejoDocente(situacion) {
  return callAI({
    feature: 'docente_chat',
    prompt:  situacion,
    system:  _nemSys('Responde en máximo 200 palabras con 2-3 acciones concretas que el docente puede aplicar esta semana.'),
  });
}

/**
 * Retroalimentación individual para un alumno específico.
 * @param {object} opts
 * @param {string} opts.alumnoNombre
 * @param {string} opts.materia
 * @param {number} opts.calificacion
 * @param {string} opts.observaciones  - Notas del docente sobre el alumno
 */
async function aiRetroalimentacion({ alumnoNombre, materia, calificacion, observaciones = '' }) {
  const grado = window.currentPerfil?.grado || window._gradoActivo || '';
  return callAI({
    feature: 'retroalim',
    prompt: `Alumno: ${alumnoNombre} | Materia: ${materia} | Calificación: ${calificacion}/10 | Grado: ${grado}
Observaciones del docente: ${observaciones || 'ninguna'}

Genera una retroalimentación motivadora y específica para este alumno que:
1. Reconozca lo que ya logra
2. Señale exactamente dónde mejorar (con ejemplo concreto)
3. Proponga 2 ejercicios de práctica para esta semana
4. Cierre con una frase motivadora personalizada`,
    system: _nemSys(),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ██  FUNCIONES DE ACOMPAÑAMIENTO DIRECTOR
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Radar de riesgo escolar: analiza datos de grupos y genera alertas.
 * @param {Array} datosGrupos  - Array de { grupo, materia, promedio, reprobados, ausencias }
 */
async function aiRadarDirector(datosGrupos) {
  const resumen = JSON.stringify(datosGrupos, null, 2);
  return callAI({
    feature: 'director_radar',
    prompt: `Analiza los siguientes datos de la escuela y genera un RADAR DE RIESGO ESCOLAR:

${resumen}

ESTRUCTURA DE TU ANÁLISIS:
## 🚨 Alertas Críticas (acción inmediata)
[Grupos/alumnos con riesgo alto: promedio < 6, ausencias > 20%, etc.]

## ⚠️ Focos de Atención (seguimiento cercano)
[Situaciones que requieren vigilancia]

## ✅ Fortalezas Identificadas
[Lo que va bien para capitalizar]

## 📋 Recomendaciones de Intervención
[3-5 acciones concretas priorizadas por urgencia]

## 📊 Resumen Ejecutivo (para informe a supervisión)
[2 párrafos de síntesis]`,
  });
}

/**
 * Genera alertas tempranas individuales por alumno.
 * @param {Array} datosAlumnos  - Array de alumnos con sus calificaciones y asistencia
 */
async function aiAlertasTempranas(datosAlumnos) {
  const top10Riesgo = datosAlumnos
    .sort((a, b) => (a.promedio || 10) - (b.promedio || 10))
    .slice(0, 15);

  return callAI({
    feature: 'director_alertas',
    prompt: `Genera ALERTAS TEMPRANAS para los siguientes alumnos en situación de riesgo:

${JSON.stringify(top10Riesgo, null, 2)}

Para cada alumno indica:
• Nivel de riesgo: 🔴 Alto | 🟡 Medio | 🟢 Bajo
• Factores de riesgo identificados
• Acción recomendada (quién debe intervenir y cuándo)
• Mensaje sugerido para comunicar a padres de familia`,
  });
}

/**
 * Chat de asesoría para directores.
 * @param {string} pregunta
 */
async function aiChatDirector(pregunta) {
  return callAI({
    feature: 'director_chat',
    prompt:  pregunta,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ██  FUNCIONES DE ACOMPAÑAMIENTO PADRES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Consejo personalizado para padres de familia.
 * @param {object} opts
 * @param {string} opts.alumnoNombre
 * @param {string} opts.materia
 * @param {number} opts.calificacion
 * @param {string} opts.situacion    - Situación específica (opcional)
 */
async function aiConsejoPadres({ alumnoNombre, materia, calificacion, situacion = '' }) {
  const grado = window.currentPerfil?.grado || window._gradoActivo || '';
  return callAI({
    feature: 'padres_consejo',
    prompt: `Mi hijo/a ${alumnoNombre} está en ${grado}. En la materia ${materia} tiene calificación ${calificacion}/10.
${situacion ? 'Situación adicional: ' + situacion : ''}

Dame consejos prácticos para apoyarle en casa esta semana.`,
  });
}

/**
 * Chat de orientación para padres.
 * @param {string} mensaje
 */
async function aiChatPadres(mensaje) {
  return callAI({
    feature: 'padres_chat',
    prompt:  mensaje,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ██  FUNCIONES DE ACOMPAÑAMIENTO ALUMNO
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Explica un tema al alumno de forma adaptada.
 * @param {object} opts
 * @param {string} opts.tema
 * @param {string} opts.materia
 * @param {string} opts.duda    - La duda específica del alumno (opcional)
 */
async function aiExplicarTema({ tema, materia, duda = '' }) {
  const grado = window.currentPerfil?.grado || window._gradoActivo || '';
  return callAI({
    feature: 'alumno_tutor',
    prompt: `Soy alumno de ${grado}. Estoy viendo en ${materia} el tema: "${tema}".
${duda ? 'Mi duda específica es: ' + duda : 'Explícame el tema de forma clara y con ejemplos.'}`,
  });
}

/**
 * Genera ejercicios de práctica para el alumno.
 * @param {object} opts
 * @param {string} opts.materia
 * @param {string} opts.tema
 * @param {'facil'|'medio'|'dificil'} opts.nivel
 * @param {number}  opts.cantidad  - Número de ejercicios (máx 5)
 */
async function aiEjerciciosAlumno({ materia, tema, nivel = 'medio', cantidad = 3 }) {
  const grado = window.currentPerfil?.grado || window._gradoActivo || '';
  const nivelTexto = { facil: 'fáciles para repasar lo básico', medio: 'de dificultad media para practicar', dificil: 'desafiantes para profundizar' };
  return callAI({
    feature: 'alumno_ejercicio',
    prompt: `Soy alumno de ${grado}. Dame ${cantidad} ejercicios ${nivelTexto[nivel] || nivelTexto.medio} de ${materia} sobre el tema "${tema}".
Después de cada ejercicio incluye: Pista para resolverlo (no la respuesta directa).
Al final incluye las respuestas en una sección separada.`,
  });
}

/**
 * Chat tutor para el alumno (responde preguntas en general).
 * @param {string} mensaje
 */
async function aiChatAlumno(mensaje) {
  return callAI({
    feature: 'alumno_chat',
    prompt:  mensaje,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Exports para uso en otros módulos (si se usa ESM)
// ══════════════════════════════════════════════════════════════════════════════
if (typeof window !== 'undefined') {
  // Exponer globalmente para uso desde HTML vanilla
  Object.assign(window, {
    callAI,
    aiGenerarExamen,
    aiConsejoDocente,
    aiRetroalimentacion,
    aiRadarDirector,
    aiAlertasTempranas,
    aiChatDirector,
    aiConsejoPadres,
    aiChatPadres,
    aiExplicarTema,
    aiEjerciciosAlumno,
    aiChatAlumno,
    // Utilidades internas
    _nemSys,
    aiVerificarLimite,
  });
}
