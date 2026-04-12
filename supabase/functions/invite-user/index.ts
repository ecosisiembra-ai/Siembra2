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

    console.log("[invite-user] Solicitud de:", user.email, "| Para:", email, "| Rol:", rol);

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
    console.log("[invite-user] Invitacion guardada en BD");

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
    let emailSent = false;

    if (webhookUrl) {
      console.log("[invite-user] Enviando via webhook...");
      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      }).catch((e) => { console.error("[invite-user] Webhook error:", e); return null; });
      emailSent = Boolean(resp?.ok);
      console.log("[invite-user] Webhook status:", resp?.status, "ok:", emailSent);
    } else {
      const brevoApiKey = Deno.env.get("BREVO_API_KEY");
      const brevoFromEmail = Deno.env.get("BREVO_FROM_EMAIL");
      const brevoFromName = Deno.env.get("BREVO_FROM_NAME") || "SIEMBRA";

      console.log("[invite-user] Brevo config:", {
        tieneKey: Boolean(brevoApiKey),
        from: brevoFromEmail || "(no definido)",
      });

      if (brevoApiKey && brevoFromEmail) {
        const brevoResp = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": brevoApiKey,
          },
          body: JSON.stringify({
            sender: { email: brevoFromEmail, name: brevoFromName },
            to: [{ email }],
            subject: emailPayload.subject,
            htmlContent: emailPayload.html,
          }),
        }).catch((e) => { console.error("[invite-user] Brevo fetch error:", e); return null; });

        const brevoStatus = brevoResp?.status ?? "null";
        const brevoBody = await brevoResp?.text().catch(() => "") ?? "";
        console.log("[invite-user] Brevo status:", brevoStatus, "| body:", brevoBody);

        emailSent = Boolean(brevoResp?.ok);
      } else {
        console.warn("[invite-user] Faltan BREVO_API_KEY o BREVO_FROM_EMAIL");
      }
    }

    return json({
      ok: true,
      token,
      invitation,
      email_sent: emailSent,
      email_enviado: emailSent,
      note: emailSent
        ? "Invitacion enviada por correo"
        : "Invitacion guardada. Revisa los logs de la Edge Function para ver el error de envio.",
    });
  } catch (error) {
    console.error("[invite-user] Error general:", error);
    return json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 401 }
    );
  }
});
