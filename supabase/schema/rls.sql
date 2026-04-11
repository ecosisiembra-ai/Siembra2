alter table public.escuelas enable row level security;
alter table public.usuarios enable row level security;
alter table public.usuario_escuelas enable row level security;
alter table public.grupos enable row level security;
alter table public.alumnos_grupos enable row level security;
alter table public.docente_grupos enable row level security;
alter table public.tutores_grupo enable row level security;
alter table public.invitaciones enable row level security;
alter table public.vinculos_padre enable row level security;
alter table public.padres_alumnos enable row level security;
alter table public.planeaciones_clase enable row level security;
alter table public.tareas_docente enable row level security;
alter table public.tareas_entregas enable row level security;
alter table public.perfil_alumno enable row level security;
alter table public.historial_xp enable row level security;
alter table public.asistencia enable row level security;
alter table public.calificaciones enable row level security;
alter table public.alertas enable row level security;
alter table public.parent_rfcs enable row level security;
alter table public.planes_config enable row level security;
alter table public.pagos enable row level security;

create or replace function public.current_profile()
returns public.usuarios
language sql
stable
as $$
  select u.*
  from public.usuarios u
  where u.auth_id = auth.uid()
  limit 1
$$;

-- ── Políticas para escuelas ──────────────────────────────────────────────────
-- Todos los usuarios autenticados pueden leer escuelas (necesario para dirInit, etc.)
drop policy if exists "read_escuelas" on public.escuelas;
create policy "read_escuelas"
on public.escuelas
for select
using (auth.role() = 'authenticated');

-- Solo superadmin puede crear/editar/eliminar escuelas
drop policy if exists "manage_escuelas" on public.escuelas;
create policy "manage_escuelas"
on public.escuelas
for all
using ((select rol from public.current_profile()) = 'superadmin')
with check ((select rol from public.current_profile()) = 'superadmin');

-- ── Políticas para usuarios ───────────────────────────────────────────────────
-- IMPORTANTE: Se usa auth_id = auth.uid() directamente para romper la dependencia
-- circular con current_profile(). Sin esto, un usuario sin auth_id vinculado no puede
-- leer su propio perfil y queda bloqueado en el login.
drop policy if exists "read_own_school_usuarios" on public.usuarios;
create policy "read_own_school_usuarios"
on public.usuarios
for select
using (
  auth_id = auth.uid()
  or lower(email) = lower(auth.email())
  or (select rol from public.current_profile()) = 'superadmin'
  or escuela_cct = (select escuela_cct from public.current_profile())
);

drop policy if exists "manage_own_school_usuarios" on public.usuarios;
create policy "manage_own_school_usuarios"
on public.usuarios
for all
using (
  (select rol from public.current_profile()) = 'superadmin'
  or (
    (select rol from public.current_profile()) in ('admin','director','subdirector')
    and escuela_cct = (select escuela_cct from public.current_profile())
  )
)
with check (
  (select rol from public.current_profile()) = 'superadmin'
  or (
    (select rol from public.current_profile()) in ('admin','director','subdirector')
    and escuela_cct = (select escuela_cct from public.current_profile())
  )
);

drop policy if exists "school_read_grupos" on public.grupos;
create policy "school_read_grupos"
on public.grupos
for select
using (
  (select rol from public.current_profile()) = 'superadmin'
  or escuela_cct = (select escuela_cct from public.current_profile())
);

drop policy if exists "school_manage_grupos" on public.grupos;
create policy "school_manage_grupos"
on public.grupos
for all
using (
  (select rol from public.current_profile()) = 'superadmin'
  or (
    (select rol from public.current_profile()) in ('admin','director','subdirector','coordinador')
    and escuela_cct = (select escuela_cct from public.current_profile())
  )
)
with check (
  (select rol from public.current_profile()) = 'superadmin'
  or (
    (select rol from public.current_profile()) in ('admin','director','subdirector','coordinador')
    and escuela_cct = (select escuela_cct from public.current_profile())
  )
);

drop policy if exists "school_read_planeaciones" on public.planeaciones_clase;
create policy "school_read_planeaciones"
on public.planeaciones_clase
for select
using (escuela_cct = (select escuela_cct from public.current_profile()));

drop policy if exists "docente_manage_planeaciones" on public.planeaciones_clase;
create policy "docente_manage_planeaciones"
on public.planeaciones_clase
for all
using (
  docente_id = (select id from public.current_profile())
  or (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector','coordinador')
)
with check (
  docente_id = (select id from public.current_profile())
  or (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector','coordinador')
);

drop policy if exists "school_read_docente_grupos" on public.docente_grupos;
create policy "school_read_docente_grupos"
on public.docente_grupos
for select
using (
  exists (
    select 1
    from public.grupos g
    where g.id = docente_grupos.grupo_id
      and g.escuela_cct = (select escuela_cct from public.current_profile())
  )
);

drop policy if exists "school_manage_docente_grupos" on public.docente_grupos;
create policy "school_manage_docente_grupos"
on public.docente_grupos
for all
using (
  (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector','coordinador')
)
with check (
  (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector','coordinador')
);

drop policy if exists "read_parent_links" on public.padres_alumnos;
create policy "read_parent_links"
on public.padres_alumnos
for select
using (
  padre_id = (select id from public.current_profile())
  or alumno_id = (select id from public.current_profile())
  or (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector')
);

drop policy if exists "manage_parent_links" on public.padres_alumnos;
create policy "manage_parent_links"
on public.padres_alumnos
for all
using (
  padre_id = (select id from public.current_profile())
  or (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector')
)
with check (
  padre_id = (select id from public.current_profile())
  or (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector')
);

drop policy if exists "school_read_tasks" on public.tareas_docente;
create policy "school_read_tasks"
on public.tareas_docente
for select
using (escuela_cct = (select escuela_cct from public.current_profile()));

drop policy if exists "docente_manage_tasks" on public.tareas_docente;
create policy "docente_manage_tasks"
on public.tareas_docente
for all
using (
  docente_id = (select id from public.current_profile())
  or (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector','coordinador')
)
with check (
  docente_id = (select id from public.current_profile())
  or (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector','coordinador')
);

drop policy if exists "read_deliveries" on public.tareas_entregas;
create policy "read_deliveries"
on public.tareas_entregas
for select
using (
  alumno_id = (select id from public.current_profile())
  or (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector','coordinador','docente','tutor')
);

drop policy if exists "manage_deliveries" on public.tareas_entregas;
create policy "manage_deliveries"
on public.tareas_entregas
for all
using (
  alumno_id = (select id from public.current_profile())
  or (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector','coordinador','docente','tutor')
)
with check (
  alumno_id = (select id from public.current_profile())
  or (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector','coordinador','docente','tutor')
);

drop policy if exists "read_school_finance" on public.pagos;
create policy "read_school_finance"
on public.pagos
for select
using (
  escuela_cct = (select escuela_cct from public.current_profile())
  or (select rol from public.current_profile()) = 'superadmin'
);

drop policy if exists "read_planes_config" on public.planes_config;
create policy "read_planes_config"
on public.planes_config
for select
using (true);

-- ── Alertas del plantel ──────────────────────────────────────────────────────
-- Todos los usuarios de la escuela pueden leer alertas de su escuela
drop policy if exists "read_school_alertas" on public.alertas;
create policy "read_school_alertas"
on public.alertas
for select
using (escuela_cct = (select escuela_cct from public.current_profile()));

-- Solo admin/director/subdirector pueden insertar/editar/eliminar alertas
drop policy if exists "manage_school_alertas" on public.alertas;
create policy "manage_school_alertas"
on public.alertas
for all
using (
  (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector')
  and escuela_cct = (select escuela_cct from public.current_profile())
)
with check (
  (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector')
  and escuela_cct = (select escuela_cct from public.current_profile())
);

-- Cualquier usuario puede marcar sus alertas como leídas (update leido=true)
drop policy if exists "mark_alertas_leidas" on public.alertas;
create policy "mark_alertas_leidas"
on public.alertas
for update
using (escuela_cct = (select escuela_cct from public.current_profile()))
with check (escuela_cct = (select escuela_cct from public.current_profile()));

-- ── alumnos_grupos ───────────────────────────────────────────────────────────
-- Necesario para que el director cuente alumnos por grupo y para asistencia/calificaciones
drop policy if exists "school_read_alumnos_grupos" on public.alumnos_grupos;
create policy "school_read_alumnos_grupos"
on public.alumnos_grupos
for select
using (
  exists (
    select 1 from public.grupos g
    where g.id = alumnos_grupos.grupo_id
      and (
        g.escuela_cct = (select escuela_cct from public.current_profile())
        or (select rol from public.current_profile()) = 'superadmin'
      )
  )
);

drop policy if exists "school_manage_alumnos_grupos" on public.alumnos_grupos;
create policy "school_manage_alumnos_grupos"
on public.alumnos_grupos
for all
using (
  exists (
    select 1 from public.grupos g
    where g.id = alumnos_grupos.grupo_id
      and (
        (select rol from public.current_profile()) = 'superadmin'
        or (
          g.escuela_cct = (select escuela_cct from public.current_profile())
          and (select rol from public.current_profile()) in ('admin','director','subdirector','coordinador','docente','tutor')
        )
      )
  )
)
with check (
  exists (
    select 1 from public.grupos g
    where g.id = alumnos_grupos.grupo_id
      and (
        (select rol from public.current_profile()) = 'superadmin'
        or (
          g.escuela_cct = (select escuela_cct from public.current_profile())
          and (select rol from public.current_profile()) in ('admin','director','subdirector','coordinador','docente','tutor')
        )
      )
  )
);

-- ── invitaciones ─────────────────────────────────────────────────────────────
-- Superadmin lee todas; admin/director/subdirector leen las de su escuela
drop policy if exists "read_invitaciones" on public.invitaciones;
create policy "read_invitaciones"
on public.invitaciones
for select
using (
  (select rol from public.current_profile()) = 'superadmin'
  or escuela_cct = (select escuela_cct from public.current_profile())
);

drop policy if exists "manage_invitaciones" on public.invitaciones;
create policy "manage_invitaciones"
on public.invitaciones
for all
using (
  (select rol from public.current_profile()) = 'superadmin'
  or (
    escuela_cct = (select escuela_cct from public.current_profile())
    and (select rol from public.current_profile()) in ('admin','director','subdirector')
  )
)
with check (
  (select rol from public.current_profile()) = 'superadmin'
  or (
    escuela_cct = (select escuela_cct from public.current_profile())
    and (select rol from public.current_profile()) in ('admin','director','subdirector')
  )
);

-- ── usuario_escuelas ─────────────────────────────────────────────────────────
-- Necesario para que dirInit() cargue la lista de escuelas del director
drop policy if exists "read_usuario_escuelas" on public.usuario_escuelas;
create policy "read_usuario_escuelas"
on public.usuario_escuelas
for select
using (
  usuario_id = (select id from public.current_profile())
  or (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector')
);

drop policy if exists "manage_usuario_escuelas" on public.usuario_escuelas;
create policy "manage_usuario_escuelas"
on public.usuario_escuelas
for all
using (
  (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector')
)
with check (
  (select rol from public.current_profile()) in ('superadmin','admin','director','subdirector')
);
