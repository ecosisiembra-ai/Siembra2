// ── Límites de uso diario por feature ──────────────────────────────────────
// Estructura: { fecha: 'YYYY-MM-DD', conteos: { feature: n } }
const AI_LIMITES = {
  // Docente
  actividad:    2,   // 2 actividades con IA por día
  examen:       2,   // 2 exámenes con IA por día
  planeacion:   1,   // ~1 por día → ~20-25/mes
  observacion:  3,   // 3 observaciones con IA por día
  retroalim:    3,
  ficha:        2,
  acomodo:      1,
  radar:        2,
  portafolio:   2,
  docente_chat: 20,  // 20 mensajes de chat asesor por día
  // Default para cualquier feature no listado
  _default:     3,
};

function aiVerificarLimite(feature) {
  const hoy = new Date().toISOString().slice(0,10);
  const key = 'siembra_ai_uso_' + (window.currentPerfil?.id || 'demo');
  let datos;
  try { datos = JSON.parse(localStorage.getItem(key) || 'null'); } catch(e) { datos = null; }
  if (!datos || datos.fecha !== hoy) datos = { fecha: hoy, conteos: {} };

  const limite = AI_LIMITES[feature] ?? AI_LIMITES._default;
  const usado  = datos.conteos[feature] || 0;
  return { ok: usado < limite, usado, limite, datos, key };
}

function aiRegistrarUso(feature) {
  const { datos, key } = aiVerificarLimite(feature);
  datos.conteos[feature] = (datos.conteos[feature] || 0) + 1;
  try { localStorage.setItem(key, JSON.stringify(datos)); } catch(e) {}
}

function aiMostrarLimiteAgotado(feature, limite) {
  if (typeof hubToast === 'function') {
    hubToast(`Has alcanzado el límite de ${limite} uso${limite>1?'s':''} de análisis para "${feature}" hoy. Disponible mañana.`, 'warn');
  }
}

// ── Función central de IA — reemplaza todas las llamadas directas a Anthropic ──
async function callAI({ feature, prompt, system, context, stream = false }) {
  // Verificar límite diario
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
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
    body: JSON.stringify({
      feature, prompt, system, context,
      escuela_id:  window.currentPerfil?.escuela_cct || window._escuelaCfg?.cct,
      nivel:       window._nivelActivo || 'secundaria',
      ciclo: window.CICLO_ACTIVO,
      grado: window.currentPerfil?.grado || window._gradoActivo || null,
      stream,
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

// ── NEM: Contexto pedagógico rico para todas las funciones de IA ──
function _nemSys(extra = '') {
  const nivel = window._nivelActivo || 'secundaria';
  const ciclo = window.CICLO_ACTIVO || '2025-2026';
  const p = window.currentPerfil || {};
  const escuela = p.escuela_nombre || p.escuela_cct || 'escuela pública mexicana';
  return `Eres un experto en educación básica mexicana con 20 años de experiencia docente y especialización en la Nueva Escuela Mexicana (NEM 2022).

MARCO PEDAGÓGICO QUE DEBES APLICAR SIEMPRE:
• Campos formativos NEM: Lenguajes | Saberes y Pensamiento Científico | Ética Naturaleza y Sociedades | De lo Humano y lo Comunitario
• Ejes articuladores: Inclusión, Pensamiento crítico, Interculturalidad crítica, Igualdad de género, Vida saludable, Lectura y escritura, Artes
• Evaluación formativa (no punitiva): procesos, no solo resultados numéricos
• Aprendizaje situado: conectar contenido con la vida real y comunidad del alumno
• Diversidad: diseña para distintos estilos de aprendizaje y ritmos
• Anti-rezago: identifica brechas y propón actividades de remediación específicas
• Proyectos comunitarios como eje integrador

CONTEXTO ACTUAL:
• Nivel: ${nivel} | Ciclo: ${ciclo} | Escuela: ${escuela}
• País: México | Sistema: SEP — Plan de Estudios 2022

PRINCIPIOS PARA TUS RESPUESTAS:
1. NUNCA generes análisis genéricos para "todos" — personaliza al alumno/grupo específico
2. Cada ejercicio debe ser diferente al anterior — evita repetición
3. Graduación por nivel: usa vocabulario, complejidad y ejemplos apropiados al grado
4. Contexto mexicano: usa ejemplos de comida, lugares, personajes históricos y cultura MX
5. Rezago educativo: si el alumno está por debajo del nivel esperado, propón actividades de nivelación progresiva (scaffolding)
6. Lenguaje: claro, motivador, nunca negativo ni etiquetante
7. Tiempo realista: actividades de 15-20 min máximo para tarea en casa${extra ? '\n\n' + extra : ''}`;
}
