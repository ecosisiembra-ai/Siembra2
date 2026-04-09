import { corsHeaders, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

function toConektaMethod(method: string) {
  const val = String(method || "").toLowerCase();
  if (val === "card" || val === "tarjeta") return "card";
  if (val === "oxxo") return "oxxo_cash";
  if (val === "spei") return "bank_transfer";
  return "card";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { admin } = await requireUser(req);
    const body = await req.json();
    const secretKey = Deno.env.get("CONEKTA_PRIVATE_KEY");

    if (!secretKey) {
      return json({ error: "CONEKTA_PRIVATE_KEY no configurada" }, { status: 500 });
    }

    const escuelaId = body?.escuela_id || null;
    const escuelaCct = body?.escuela_cct || null;
    const planId = String(body?.plan_id || "").trim() || null;
    const method = toConektaMethod(body?.metodo || "card");
    const amount = Number(body?.monto || 0) || null;
    const concepto = String(body?.concepto || body?.plan_id || "Suscripcion SIEMBRA").trim();

    let montoMxn = amount ? Math.round(amount / 100) : 0;
    let planNombre = planId || "Plan SIEMBRA";

    if (planId) {
      let plan = null;

      const { data: byCode } = await admin.from("planes_config")
        .select("id,codigo,nombre,precio_mxn")
        .eq("codigo", planId)
        .maybeSingle()
        .catch(() => ({ data: null }));

      if (byCode) {
        plan = byCode;
      } else {
        const { data: byName } = await admin.from("planes_config")
          .select("id,codigo,nombre,precio_mxn")
          .ilike("nombre", planId)
          .maybeSingle()
          .catch(() => ({ data: null }));

        if (byName) {
          plan = byName;
        } else if (/^[0-9a-fA-F-]{36}$/.test(planId)) {
          const { data: byUuid } = await admin.from("planes_config")
            .select("id,codigo,nombre,precio_mxn")
            .eq("id", planId)
            .maybeSingle()
            .catch(() => ({ data: null }));
          if (byUuid) plan = byUuid;
        }
      }

      if (plan) {
        montoMxn = Number(plan.precio_mxn || 0);
        planNombre = String(plan.nombre || plan.codigo || planId);
      }
    }

    if (!montoMxn) {
      return json({ error: "Monto o plan requerido" }, { status: 400 });
    }

    const customerName = String(body?.alumno_nombre || body?.nombre || "Cliente SIEMBRA").trim();
    const payload = {
      currency: "MXN",
      customer_info: {
        name: customerName,
        email: body?.email || "pagos@siembra.local",
      },
      line_items: [
        {
          name: concepto,
          unit_price: montoMxn * 100,
          quantity: 1,
        },
      ],
      charges: [
        {
          payment_method: {
            type: method,
            ...(method === "card" ? {
              success_url: body?.success_url || null,
              failure_url: body?.cancel_url || null,
            } : {}),
          },
        },
      ],
      metadata: {
        escuela_id: escuelaId,
        escuela_cct: escuelaCct,
        plan_id: planId,
        cargo_id: body?.cargo_id || null,
        alumno_id: body?.alumno_id || null,
        padre_id: body?.padre_id || null,
        concepto,
      },
    };

    const resp = await fetch("https://api.conekta.io/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/vnd.conekta-v2.1.0+json",
        "Authorization": "Basic " + btoa(`${secretKey}:`),
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return json({ error: data?.details?.[0]?.message || data?.message || "Error creando orden en Conekta" }, { status: resp.status });
    }

    const charge = Array.isArray(data?.charges) ? data.charges[0] : null;
    const paymentMethod = charge?.payment_method || {};
    const checkoutUrl = paymentMethod?.url || data?.checkout?.url || null;
    const checkoutId = method === "card" ? (paymentMethod?.id || data?.id) : data?.id;
    const referenciaOxxo = paymentMethod?.reference || paymentMethod?.barcode || null;
    const clabeSpei = paymentMethod?.clabe || null;

    await admin.from("pagos").insert({
      escuela_id: escuelaId,
      escuela_cct: escuelaCct,
      plan_id: planId,
      monto_mxn: montoMxn,
      metodo: method,
      estado: "pendiente",
      conekta_order_id: data?.id || null,
      payload_ref: {
        charge_id: charge?.id || null,
        checkout_url: checkoutUrl,
      },
    }).catch(() => null);

    return json({
      ok: true,
      plan_nombre: planNombre,
      monto_mxn: montoMxn,
      order_id: data?.id || null,
      checkout_id: checkoutId,
      checkout_url: checkoutUrl,
      referencia_oxxo: referenciaOxxo,
      clabe_spei: clabeSpei,
      raw: data,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error interno" }, { status: 401 });
  }
});
