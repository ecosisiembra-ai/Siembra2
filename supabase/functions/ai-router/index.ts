import { corsHeaders, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

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

    const body = await req.json();
    const prompt = String(body?.prompt || "").trim();
    const system = String(body?.system || "").trim();
    const feature = String(body?.feature || "general");
    const stream = body?.stream === true;

    if (!prompt) {
      return json({ error: "Prompt requerido" }, { status: 400 });
    }

    const payload = {
      model: Deno.env.get("ANTHROPIC_MODEL") || "claude-3-5-sonnet-latest",
      max_tokens: Number(Deno.env.get("ANTHROPIC_MAX_TOKENS") || 1800),
      system: system || `Asistente educativo SIEMBRA. Feature: ${feature}.`,
      stream,
      messages: [{ role: "user", content: prompt }],
    };

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
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
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const data = await resp.json();
    const text = Array.isArray(data?.content)
      ? data.content
          .filter((item: { type?: string }) => item?.type === "text")
          .map((item: { text?: string }) => item?.text || "")
          .join("\n")
      : "";

    return json({ ok: true, text, raw: data });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error interno" }, { status: 401 });
  }
});
