import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function enviarCorreoBrevo(para, asunto, htmlBody, nombrePara) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) return { ok: false, error: "BREVO_API_KEY no configurada" };
  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "SIEMBRA", email: "ecosisiembra@gmail.com" },
      to: [{ email: para, name: nombrePara || para }],
      subject: asunto,
      htmlContent: htmlBody,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    console.error("Brevo error:", JSON.stringify(err));
    return { ok: false, error: JSON.stringify(err) };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const email = body.email;
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

    const emailHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Segoe UI,Arial,sans-serif;background:#f5f5f0;margin:0;padding:40px 20px;"><div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);"><div style="background:#0d5c2f;padding:32px 40px;text-align:center;"><div style="font-size:40px;margin-bottom:8px;">&#127793;</div><h1 style="color:white;font-size:24px;margin:0;font-weight:800;">SIEMBRA</h1><p style="color:rgba(255,255,255,.6);font-size:12px;margin:6px 0 0;letter-spacing:2px;text-transform:uppercase;">Sistema Educativo NEM 2026</p></div><div style="padding:36px 40px;"><h2 style="font-size:20px;color:#1a1a1a;margin:0 0 14px;">Bienvenido/a a SIEMBRA!</h2><p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 20px;">Fuiste invitado/a como <strong style="color:#0d5c2f;">' + rolLabel + '</strong>' + (escuela_nombre ? ' en <strong>' + escuela_nombre + '</strong>' : '') + '.</p><div style="text-align:center;margin-bottom:24px;"><a href="' + inviteLink + '" style="background:#0d5c2f;color:white;padding:16px 40px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:800;display:inline-block;">Crear mi cuenta &rarr;</a></div><div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:20px;margin-bottom:24px;"><p style="color:#166534;font-size:13px;font-weight:700;margin:0 0 10px;">Pasos para registrarte:</p><ol style="color:#166534;font-size:13px;line-height:1.8;margin:0;padding-left:20px;"><li>Haz clic en el boton "Crear mi cuenta"</li><li>Completa tu nombre y apellidos</li><li>Ingresa tu correo: <strong>' + email + '</strong></li><li>Crea una contrasena (minimo 8 caracteres)</li><li>Listo! Entraras a tu portal</li></ol></div><div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:14px;margin-bottom:24px;text-align:center;"><p style="color:#94a3b8;font-size:11px;margin:0 0 6px;">Si el boton no funciona, copia este link:</p><p style="color:#0d5c2f;font-size:12px;font-family:monospace;word-break:break-all;margin:0;">' + inviteLink + '</p></div><p style="color:#999;font-size:12px;text-align:center;margin:0;">' + (invited_by ? 'Invitado/a por: ' + invited_by + '<br>' : '') + 'La invitacion expira en 7 dias.</p></div><div style="background:#f5f5f0;padding:16px 40px;text-align:center;"><p style="color:#aaa;font-size:11px;margin:0;">SIEMBRA - Sistema Educativo NEM 2026</p></div></div></body></html>';

    const asunto = "SIEMBRA - Invitacion como " + rolLabel + (escuela_nombre ? " - " + escuela_nombre : "");
    const resultado = await enviarCorreoBrevo(email, asunto, emailHtml, "");

    console.log("[invite-user] email:", email, "| brevo ok:", resultado.ok, resultado.error || "");

    if (token) {
      try {
        const sbAdmin = createClient(
          Deno.env.get("SUPABASE_URL"),
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
        await sbAdmin.from("invitaciones").update({ estado: "enviada", enviada_at: new Date().toISOString() }).eq("token", token);
      } catch (e) { console.warn("No se pudo actualizar invitacion:", e); }
    }

    return new Response(
      JSON.stringify({ ok: true, email_enviado: resultado.ok, email_sent: resultado.ok, message: resultado.ok ? "Invitacion enviada a " + email : "No se pudo enviar email: " + (resultado.error || "") }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    console.error("invite-user error:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
