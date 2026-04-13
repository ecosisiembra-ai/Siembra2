/**
 * SIEMBRA — ai-router Edge Function v2
 * Enruta todas las peticiones de IA según el `feature` recibido.
 *
 * Features soportados:
 *  DOCENTE:   actividad | examen | planeacion | observacion | retroalim |
 *             ficha | acomodo | radar | portafolio | docente_chat
 *  DIRECTOR:  director_radar | director_alertas | director_chat
 *  PADRES:    padres_consejo | padres_chat
 *  ALUMNO:    alumno_tutor | alumno_ejercicio | alumno_chat
 *  GENERAL:   general
 */

import { corsHeaders, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

// ── Prompts de sistema por rol ───────────────────────────────────────────────

function sysDocente(ctx: Ctx): string {
  return `Eres un asesor pedagógico experto en la Nueva Escuela Mexicana (NEM 2022), con 20 años de experiencia en educación básica mexicana.

CONTEXTO: Nivel ${ctx.nivel} | Ciclo ${ctx.ciclo} | Escuela: ${ctx.escuela}
GRADO/GRUPO: ${ctx.grado || "no especificado"}

MARCO NEM QUE APLICAS SIEMPRE:
• Campos formativos: Lenguajes | Saberes y Pensamiento Científico | Ética Naturaleza y Sociedades | De lo Humano y lo Comunitario
• Ejes articuladores: Inclusión, Pensamiento crítico, Interculturalidad crítica, Igualdad de género, Vida saludable, Lectura y escritura, Artes
• Evaluación formativa (procesos, no solo números)
• Aprendizaje situado y conectado a la comunidad
• Anti-rezago: scaffolding y actividades de nivelación progresiva

PRINCIPIOS:
1. Personaliza al grupo/alumno específico, nunca respuestas genéricas
2. Vocabulario y complejidad apropiados al grado
3. Ejemplos con cultura mexicana (comida, lugares, historia MX)
4. Actividades de 15-20 min máximo para tarea en casa
5. Tono motivador, nunca negativo ni etiquetante`;
}

function sysDirector(ctx: Ctx): string {
  return `Eres un asesor de gestión escolar experto en el sistema educativo SEP México, especializado en liderazgo pedagógico y mejora continua de escuelas públicas.

CONTEXTO: Escuela ${ctx.escuela} | Nivel ${ctx.nivel} | Ciclo ${ctx.ciclo}

TU FUNCIÓN:
• Analizar datos de grupos, docentes y alumnos para detectar patrones y riesgos
• Generar alertas tempranas de rezago escolar con nombres y datos concretos
• Proponer intervenciones institucionales basadas en evidencia
• Recomendar acciones de acompañamiento docente
• Elaborar narrativas ejecutivas para informes a supervisión

PRINCIPIOS:
1. Basa todas tus recomendaciones en los datos proporcionados
2. Prioriza por urgencia: riesgo alto > riesgo medio > oportunidad
3. Sé concreto: alumno/grupo/docente específico, no generalidades
4. Propón acciones realizables en el contexto de una escuela pública mexicana
5. Usa lenguaje directivo y ejecutivo, sin tecnicismos innecesarios`;
}

function sysPadres(ctx: Ctx): string {
  return `Eres un orientador familiar amigable y empático, especializado en apoyar a padres de familia mexicanos para acompañar el aprendizaje de sus hijos en la escuela pública.

CONTEXTO: Escuela ${ctx.escuela} | Nivel ${ctx.nivel} | Ciclo ${ctx.ciclo}

TU FUNCIÓN:
• Dar consejos prácticos, concretos y realizables en casa
• Explicar con palabras sencillas cómo apoyar a su hijo/a
• Motivar sin generar culpa ni angustia
• Señalar cuándo acudir con el maestro o con apoyo especializado
• Celebrar los avances, por pequeños que sean

PRINCIPIOS:
1. Lenguaje sencillo, cálido y sin jerga pedagógica
2. Actividades de apoyo en casa que no requieran materiales costosos
3. Respeta la diversidad de familias: monoparentales, trabajo en campo, etc.
4. No culpar ni juzgar al padre/madre ni al alumno
5. Máximo 3-4 consejos concretos por respuesta`;
}

function sysAlumno(ctx: Ctx): string {
  return `Eres un tutor virtual amigable, paciente y motivador para estudiantes de educación básica mexicana.

CONTEXTO: Nivel ${ctx.nivel} | Grado: ${ctx.grado || "no especificado"} | Ciclo ${ctx.ciclo}

TU FUNCIÓN:
• Explicar temas de forma clara, con ejemplos de la vida cotidiana
• Generar ejercicios adaptados al nivel del alumno
• Celebrar los logros y mantener la motivación
• Identificar dónde está el error y guiar hacia la respuesta correcta (no dar la respuesta directamente)
• Hacer el aprendizaje divertido y relevante

PRINCIPIOS:
1. Usa lenguaje accesible para la edad del alumno
2. Un concepto a la vez — no abrumes con información
3. Usa ejemplos de México: comida, cultura, naturaleza, historia MX
4. Nunca digas "está mal" — di "casi, intenta esto..."
5. Máximo 3 ejercicios por sesión para no agotar al alumno`;
}

// ── Generador de exámenes por nivel de dificultad ───────────────────────────

function buildExamenPrompt(body: Record<string, unknown>, ctx: Ctx): string {
  const materia = String(body.materia || "");
  const temas = String(body.temas || "");
  const grado = String(ctx.grado || body.grado || "");
  const dificultad = String(body.dificultad || "mixto"); // facil | medio | dificil | mixto
  const numPreguntas = Number(body.num_preguntas || 10);
  const trimestre = Number(body.trimestre || 1);

  const nivelDesc: Record<string, string> = {
    facil: `NIVEL FÁCIL: preguntas de comprensión básica, definiciones, identificación. Respuesta directa en el texto o de memoria simple. Verbos de Bloom: recordar, identificar, nombrar.`,
    medio: `NIVEL MEDIO: preguntas de aplicación y análisis. El alumno debe relacionar conceptos o aplicarlos a situaciones. Verbos de Bloom: explicar, comparar, aplicar, clasificar.`,
    dificil: `NIVEL DIFÍCIL: preguntas de síntesis, evaluación y creación. Requieren pensamiento crítico, argumentar, resolver problemas complejos o crear algo nuevo. Verbos de Bloom: evaluar, diseñar, argumentar, proponer.`,
    mixto: `NIVEL MIXTO: incluye preguntas fáciles (30%), medias (40%) y difíciles (30%) para evaluar el espectro completo de aprendizajes.`,
  };

  return `Genera un examen completo para la siguiente situación:

MATERIA: ${materia}
GRADO: ${grado} | NIVEL: ${ctx.nivel} | TRIMESTRE: ${trimestre}
TEMAS/APRENDIZAJES: ${temas}
DIFICULTAD: ${nivelDesc[dificultad] || nivelDesc.mixto}
NÚMERO DE PREGUNTAS: ${numPreguntas}

INSTRUCCIONES:
1. Genera exactamente ${numPreguntas} preguntas variadas (opción múltiple, respuesta corta, completar, relacionar columnas, análisis breve)
2. Cada pregunta debe indicar: tipo, valor en puntos, e indicador NEM que evalúa
3. Al final incluye: GUÍA DE RESPUESTAS con las respuestas correctas y criterios de evaluación
4. Las preguntas deben ser originales — no copies de libros de texto
5. Usa contextos mexicanos cuando sea posible
6. Incluye al menos una pregunta con imagen mental descrita textualmente

FORMATO DE SALIDA:
## Examen: [Nombre del examen]
**Materia:** | **Grado:** | **Trimestre:** | **Fecha:** ___________
**Nombre del alumno:** _____________________________ **Grupo:** _____

[INSTRUCCIONES PARA EL ALUMNO]

### Sección 1: [Tipo de preguntas]
[Preguntas numeradas...]

---
## Guía de Respuestas (solo docente)
[Respuestas y criterios...]`;
}

// ── Tipos internos ───────────────────────────────────────────────────────────

interface Ctx {
  nivel: string;
  ciclo: string;
  escuela: string;
  grado: string;
}

// ── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireUser(req);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 500 });
    }

    const body = await req.json() as Record<string, unknown>;
    const feature = String(body?.feature || "general");
    const stream  = body?.stream === true;

    // Contexto enriquecido
    const ctx: Ctx = {
      nivel:   String(body?.nivel   || "secundaria"),
      ciclo:   String(body?.ciclo   || "2025-2026"),
      escuela: String(body?.escuela_id || body?.escuela || "escuela pública mexicana"),
      grado:   String(body?.grado   || ""),
    };

    // ── Seleccionar system prompt y prompt final ─────────────────────────────
    let systemPrompt = String(body?.system || "").trim();
    let userPrompt   = String(body?.prompt || "").trim();

    // Si el feature es examen y viene con datos estructurados, construir prompt
    if (feature === "examen" && body?.materia && body?.temas) {
      userPrompt = buildExamenPrompt(body, ctx);
    }

    if (!userPrompt) {
      return json({ error: "Prompt requerido" }, { status: 400 });
    }

    // System prompt por rol si no viene personalizado
    if (!systemPrompt) {
      const grupo = feature.split("_")[0]; // director_radar → director
      if (["director", "director_radar", "director_alertas", "director_chat"].includes(feature)) {
        systemPrompt = sysDirector(ctx);
      } else if (["padres_consejo", "padres_chat", "padre"].includes(feature)) {
        systemPrompt = sysPadres(ctx);
      } else if (["alumno_tutor", "alumno_ejercicio", "alumno_chat", "alumno"].includes(feature)) {
        systemPrompt = sysAlumno(ctx);
      } else {
        // default: docente
        systemPrompt = sysDocente(ctx);
      }
      void grupo; // used implicitly above
    }

    // ── Llamada a Anthropic ──────────────────────────────────────────────────
    const payload = {
      model:      Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-20250514",
      max_tokens: Number(Deno.env.get("ANTHROPIC_MAX_TOKENS") || 2500),
      system:     systemPrompt,
      stream,
      messages:   [{ role: "user", content: userPrompt }],
    };

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "x-api-key":       anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: `Anthropic error: ${detail}` }, { status: resp.status });
    }

    if (stream) {
      return new Response(resp.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":  "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection":    "keep-alive",
        },
      });
    }

    const data = await resp.json() as { content?: Array<{ type?: string; text?: string }> };
    const text = Array.isArray(data?.content)
      ? data.content
          .filter((item) => item?.type === "text")
          .map((item) => item?.text || "")
          .join("\n")
      : "";

    return json({ ok: true, text, feature, raw: data });

  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 401 }
    );
  }
});
