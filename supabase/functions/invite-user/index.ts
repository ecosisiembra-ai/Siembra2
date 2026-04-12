import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const email = body.email || "";
    const rol = body.rol || "usuario";
    const escuela_nombre = body.escuela_nombre || "";
    const invited_by = body.invited_by || "";
    const token = body.token || "";
    const link = body.link || "";

    if (!email) throw new Error("Email es requerido");

    const siteUrl = Deno.env.get("SITE_URL") || "https://siembra2.vercel.app";
    const inviteLink = link || (token ? siteUrl + "/index.html?invite=" + token : siteUrl);

    const rolNombres = {
      director: "Director/a de escuela",
      docente: "Docente",
      admin: "Administrador/a escolar",
      ts: "Trabajador/a Social",
      padre: "Padre/Madre de familia",
      coordinador: "Coordinador/a academico",
      prefecto: "Prefecto/a",
      subdirector: "Subdirector/a",
      tutor: "Tutor/a de grupo",
      superadmin: "Administrador central",
    };
    const rolLabel = rolNombres[rol] || rol;

    const escuelaStr = escuela_nombre ? " en <strong>" + escuela_nombre + "</strong>" : "";
    const invitadoPor = invited_by ? "Invitado/a por: " + invited_by + "<br>" : "";

    const emailHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Segoe UI,Arial,sans-serif;background:#f5f5f0;margin:0;padding:40px 20px;"><div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);"><div style="background:#0d5c2f;padding:32px 40px;text-align:center;"><div style="font-size:40px;margin-bottom:8px;">&#127793;</div><h1 style="color:white;font-size:24px;margin:0;font-weight:800;">SIEMBRA</h1><p style="color:rgba(255,255,255,.6);font-size:12px;margin:6px 0 0;letter-spacing:2px;text-transform:uppercase;">Sistema Educativo NEM 2026</p></div><div style="padding:36px 40px;"><h2 style="font-size:20px;color:#1a1a1a;margin:0 0 14px;">Bienvenido/a a SIEMBRA!</h2><p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 20px;">Fuiste invitado/a como <strong style="color:#0d5c2f;">' + rolLabel + '</strong>' + escuelaStr + '.</p><div style="text-align:center;margin-bottom:24px;"><a href="' + inviteLink + '" style="background:#0d5c2f;color:white;padding:16px 40px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:800;display:inline-block;">Crear mi cuenta &rarr;</a></div><div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:14px;margin-bottom:24px;text-align:center;"><p style="color:#94a3b8;font-size:11px;margin:0 0 6px;">Si el boton no funciona, copia este link:</p><p style="color:#0d5c2f;font-size:12px;font-family:monospace;word-break:break-all;margin:0;">' + inviteLink + '</p></div><p style="color:#999;font-size:12px;text-align:center;margin:0;">' + invitadoPor + 'La invitacion expira en 7 dias.</p></div></div></body></html>';

    const asunto = "SIEMBRA - Invitacion como " + rolLabel + (escuela_nombre ? " - " + escuela_nombre : "");
    let emailSent = false;
    let metodo = "ninguno";

    // 1. Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && !emailSent) {
      console.log("[invite-user] Intentando Resend para:", email);
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + resendKey },
        body: JSON.stringify({ from: "SIEMBRA <onboarding@resend.dev>", to: [email], subject: asunto, html: emailHtml }),
      }).catch((e) => { console.error("[invite-user] Resend error:", e); return null; });
      const st = r?.status;
      const bd = await r?.text().catch(() => "");
      console.log("[invite-user] Resend status:", st, "body:", bd);
      emailSent = r?.ok === true;
      if (emailSent) metodo = "resend";
    }

    // 2. Brevo
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (brevoKey && !emailSent) {
      console.log("[invite-user] Intentando Brevo para:", email);
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({ sender: { name: "SIEMBRA", email: "ecosisiembra@gmail.com" }, to: [{ email: email, name: email }], subject: asunto, htmlContent: emailHtml }),
      }).catch((e) => { console.error("[invite-user] Brevo error:", e); return null; });
      const st = r?.status;
      const bd = await r?.text().catch(() => "");
      console.log("[invite-user] Brevo status:", st, "body:", bd);
      emailSent = r?.ok === true;
      if (emailSent) metodo = "brevo";
    }

    console.log("[invite-user] RESULTADO emailSent:", emailSent, "metodo:", metodo);

    if (token) {
      try {
        const sbAdmin = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
        await sbAdmin.from("invitaciones")
          .update({ estado: emailSent ? "enviada" : "pendiente", enviada_at: new Date().toISOString() })
          .eq("token", token);
      } catch (e) { console.warn("[invite-user] BD update error:", e); }
    }

    return new Response(
      JSON.stringify({ ok: true, email_enviado: emailSent, email_sent: emailSent, metodo }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    console.error("[invite-user] Error general:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
