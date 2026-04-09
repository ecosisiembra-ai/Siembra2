import { corsHeaders, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { admin, user } = await requireUser(req);
    const body = await req.json();

    const email = String(body?.email || "").trim().toLowerCase();
    const rol = String(body?.rol || "docente").trim().toLowerCase();
    const token = String(body?.token || crypto.randomUUID()).trim();
    const escuelaNombre = String(body?.escuela_nombre || "").trim();
    const invitedBy = String(body?.invited_by || user.email || user.id).trim();
    const link = String(body?.link || "").trim();
    const escuelaCct = String(body?.escuela_cct || "").trim() || null;
    const escuelaId = body?.escuela_id || null;

    if (!email) {
      return json({ error: "Email requerido" }, { status: 400 });
    }

    const invitation = {
      token,
      email_destino: email,
      rol,
      escuela_id: escuelaId,
      escuela_cct: escuelaCct,
      nombre_destino: body?.nombre_destino || email,
      estado: "pendiente",
      created_by: user.id,
      expira_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      reenviado_at: new Date().toISOString(),
    };

    await admin.from("invitaciones").upsert(invitation, { onConflict: "token" });

    const emailPayload = {
      to: email,
      subject: `Invitacion a ${escuelaNombre || "SIEMBRA"}`,
      html: `
        <h2>Invitacion a SIEMBRA</h2>
        <p>Rol: <strong>${rol}</strong></p>
        <p>Escuela: <strong>${escuelaNombre || escuelaCct || "SIEMBRA"}</strong></p>
        <p>Invita: <strong>${invitedBy}</strong></p>
        <p><a href="${link || "#"}">Abrir invitacion</a></p>
        <p>Token: <code>${token}</code></p>
      `,
    };

    const webhookUrl = Deno.env.get("EMAIL_WEBHOOK_URL");
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      }).catch(() => null);
    }

    return json({
      ok: true,
      token,
      invitation,
      email_sent: Boolean(webhookUrl),
      note: webhookUrl ? "Invitacion enviada al webhook de correo" : "Invitacion guardada. Configura EMAIL_WEBHOOK_URL para enviar correo real.",
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error interno" }, { status: 401 });
  }
});
