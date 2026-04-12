import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AuthContext = {
  admin: ReturnType<typeof createClient>;
  userClient: ReturnType<typeof createClient>;
  user: { id: string; email?: string | null };
};

export async function requireUser(req: Request): Promise<AuthContext> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const saSecret = Deno.env.get("SA_SECRET"); // Clave estática para superadmin
  const authHeader = req.headers.get("Authorization") || "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Faltan variables SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Authorization bearer token requerido");
  }

  const token = authHeader.slice(7); // quitar "Bearer "

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ── Bypass para superadmin con SA_SECRET ──────────────────────────────────
  // Si el token coincide con SA_SECRET, se omite la validación JWT.
  // SA_SECRET es una clave estática que nunca expira.
  if (saSecret && token === saSecret) {
    return {
      admin,
      userClient: admin, // superadmin usa service role directamente
      user: {
        id: "superadmin",
        email: "superadmin@siembra.internal",
      },
    };
  }

  // ── Validación JWT normal para otros usuarios ─────────────────────────────
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    throw new Error("Sesion no valida");
  }

  return {
    admin,
    userClient,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  };
}
