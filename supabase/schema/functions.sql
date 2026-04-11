-- ══════════════════════════════════════════════════════════════════════
-- FUNCIONES RPC — SIEMBRA
-- Agregan datos en el servidor para reducir Disk IO y tráfico de red.
-- Ejecutar en Supabase SQL Editor. Seguro de re-ejecutar (CREATE OR REPLACE).
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Métricas por escuela — conteos en servidor ─────────────────────
-- Reemplaza el fetch de 5,000+ filas que hacía el dashboard superadmin.
-- Retorna una fila por escuela con conteos de alumnos, docentes y grupos.
create or replace function public.sa_metricas_escuelas()
returns table (
  escuela_cct   text,
  total_alumnos bigint,
  total_docentes bigint,
  total_usuarios bigint,
  total_grupos  bigint
)
language sql
security definer
set search_path = public
as $$
  select
    u.escuela_cct,
    count(*) filter (where u.rol = 'alumno')                                                          as total_alumnos,
    count(*) filter (where u.rol in ('docente','tutor','coordinador','ts','prefecto','subdirector','director','admin')) as total_docentes,
    count(*)                                                                                           as total_usuarios,
    0::bigint                                                                                          as total_grupos
  from public.usuarios u
  where u.activo = true
    and u.rol <> 'superadmin'
    and u.escuela_cct is not null
    and u.escuela_cct <> ''
  group by u.escuela_cct

  union all

  -- Grupos en tabla separada (no están en usuarios)
  select
    g.escuela_cct,
    0::bigint,
    0::bigint,
    0::bigint,
    count(*)
  from public.grupos g
  where g.activo = true
    and g.escuela_cct is not null
    and g.escuela_cct <> ''
  group by g.escuela_cct
$$;

-- Permitir que cualquier usuario autenticado llame la función
-- (la función hace sus propios filtros internamente)
grant execute on function public.sa_metricas_escuelas() to authenticated;


-- ── 2. Conteo de evidencias de hoy — evita query ad-hoc en renderDashboard ──
create or replace function public.sa_evidencias_hoy()
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)
  from public.evidencias
  where created_at >= current_date
$$;

grant execute on function public.sa_evidencias_hoy() to authenticated;