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
    const rolNombres = { director:"Director/a de escuela", docente:"Docente", admin:"Administrador/a escolar", ts:"Trabajador/a Social", padre:"Padre/Madre de familia" };
    const rolLabel = rolNombres[rol] || rol;
    const asunto = "SIEMBRA - Invitacion como " + rolLabel + (escuela_nombre ? " - " + escuela_nombre : "");
    const emailHtml = "<h2>Invitacion a SIEMBRA</h2><p>Rol: <b>" + rolLabel + "</b></p><p>Escuela: <b>" + escuela_nombre + "</b></p><p>Invita: " + invited_by + "</p><p><a href='" + inviteLink + "'>Crear mi cuenta</a></p><p>" + inviteLink + "</p>";
    let emailSent = false;
    let metodo = "ninguno";
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      console.log("[invite-user] Intentando Resend para:", email);
      const r = await fetch("https://api.resend.com/emails", { method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+resendKey}, body:JSON.stringify({from:"SIEMBRA <onboarding@resend.dev>",to:[email],subject:asunto,html:emailHtml}) }).catch(e=>{console.error("Resend error:",e);return null;});
      const st = r?.status; const bd = await r?.text().catch(()=>"");
      console.log("[invite-user] Resend status:", st, "body:", bd);
      emailSent = r?.ok === true;
      if (emailSent) metodo = "resend";
    }
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (brevoKey && !emailSent) {
      console.log("[invite-user] Intentando Brevo para:", email);
      const r = await fetch("https://api.brevo.com/v3/smtp/email", { method:"POST", headers:{"api-key":brevoKey,"Content-Type":"application/json"}, body:JSON.stringify({sender:{name:"SIEMBRA",email:"ecosisiembra@gmail.com"},to:[{email:email}],subject:asunto,htmlContent:emailHtml}) }).catch(e=>{console.error("Brevo error:",e);return null;});
      const st = r?.status; const bd = await r?.text().catch(()=>"");
      console.log("[invite-user] Brevo status:", st, "body:", bd);
      emailSent = r?.ok === true;
      if (emailSent) metodo = "brevo";
    }
    console.log("[invite-user] RESULTADO emailSent:", emailSent, "metodo:", metodo);
    return new Response(JSON.stringify({ok:true,email_enviado:emailSent,email_sent:emailSent,metodo}), {status:200,headers:{...cors,"Content-Type":"application/json"}});
  } catch(err) {
    const message = err instanceof Error ? err.message : "Error interno";
    console.error("[invite-user] Error:", message);
    return new Response(JSON.stringify({error:message}), {status:500,headers:{...cors,"Content-Type":"application/json"}});
  }
});
