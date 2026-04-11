-- Migración: agregar columnas destinatario_rol y remitente_id a la tabla alertas
-- Ejecutar en Supabase SQL editor si la tabla ya existe en producción

alter table public.alertas
  add column if not exists destinatario_rol text,    -- null = todos, o 'docente','prefecto', etc.
  add column if not exists remitente_id uuid references public.usuarios(id) on delete set null;

-- RLS: todos los usuarios de la escuela pueden leer alertas de su escuela
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

-- Cualquier usuario puede marcar alertas como leídas
drop policy if exists "mark_alertas_leidas" on public.alertas;
create policy "mark_alertas_leidas"
on public.alertas
for update
using (escuela_cct = (select escuela_cct from public.current_profile()))
with check (escuela_cct = (select escuela_cct from public.current_profile()));