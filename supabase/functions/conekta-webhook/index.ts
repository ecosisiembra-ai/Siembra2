import { corsHeaders, json } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Faltan variables de Supabase" }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = await req.json();
    const eventType = String(body?.type || "").trim();
    const object = body?.data?.object || {};
    const metadata = object?.metadata || {};
    const orderId = object?.id || object?.order_id || null;
    const paid = eventType === "order.paid";
    const failed = eventType === "charge.failed";
    const refunded = eventType === "charge.refunded";

    if (orderId) {
      let estado = "pendiente";
      if (paid) estado = "pagado";
      if (failed) estado = "fallido";
      if (refunded) estado = "reembolsado";

      await admin.from("pagos").update({
        estado,
        updated_at: new Date().toISOString(),
        payload_ref: object,
      }).eq("conekta_order_id", orderId).catch(() => null);

      if (paid && metadata?.escuela_id) {
        await admin.from("escuelas").update({
          estado_suscripcion: "activa",
          plan_suscripcion: metadata?.plan_id || null,
          fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        }).eq("id", metadata.escuela_id).catch(() => null);
      }
    }

    return json({ ok: true, received: eventType, order_id: orderId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error interno" }, { status: 400 });
  }
});
