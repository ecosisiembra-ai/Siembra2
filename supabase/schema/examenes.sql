-- ══════════════════════════════════════════════════════════════════════
-- MÓDULO EXÁMENES — SIEMBRA
-- Tablas: examenes_docente, examenes_calificaciones, notificaciones
-- Ejecutar en Supabase SQL Editor. Seguro de re-ejecutar.
-- Patrón: CREATE TABLE con solo id, luego ADD COLUMN IF NOT EXISTS.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. examenes_docente ───────────────────────────────────────────────
create table if not exists public.examenes_docente (
  id uuid primary key default gen_random_uuid()
);

alter table public.examenes_docente add column if not exists docente_id       uuid references public.usuarios(id) on delete set null;
alter table public.examenes_docente add column if not exists grupo_id         uuid references public.grupos(id) on delete set null;
alter table public.examenes_docente add column if not exists grupo_nombre     text;
alter table public.examenes_docente add column if not exists escuela_cct      text not null default '';
alter table public.examenes_docente add column if not exists ciclo            text not null default '2025-2026';
alter table public.examenes_docente add column if not exists materia          text not null default '';
alter table public.examenes_docente add column if not exists trimestre        integer not null default 1;
alter table public.examenes_docente add column if not exists nombre           text not null default '';
alter table public.examenes_docente add column if not exists descripcion      text;
alter table public.examenes_docente add column if not exists temas_guia       text;
alter table public.examenes_docente add column if not exists fecha_aplicacion date;
alter table public.examenes_docente add column if not exists valor_maximo     numeric(5,2) default 10;
alter table public.examenes_docente add column if not exists guia_ia          text;
alter table public.examenes_docente add column if not exists guia_pdf_url     text;
alter table public.examenes_docente add column if not exists promedio_grupo   numeric(4,2);
alter table public.examenes_docente add column if not exists total_alumnos    integer default 0;
alter table public.examenes_docente add column if not exists total_aprobados  integer default 0;
alter table public.examenes_docente add column if not exists visible_alumnos  boolean default false;
alter table public.examenes_docente add column if not exists notificado       boolean default false;
alter table public.examenes_docente add column if not exists creado_en        timestamptz default now();
alter table public.examenes_docente add column if not exists updated_at       timestamptz default now();

create index if not exists idx_examenes_docente_grupo   on public.examenes_docente(grupo_id);
create index if not exists idx_examenes_docente_escuela on public.examenes_docente(escuela_cct, ciclo);
create index if not exists idx_examenes_docente_fecha   on public.examenes_docente(fecha_aplicacion) where fecha_aplicacion is not null;

-- ── 2. examenes_calificaciones ────────────────────────────────────────
create table if not exists public.examenes_calificaciones (
  id uuid primary key default gen_random_uuid()
);

alter table public.examenes_calificaciones add column if not exists examen_id    uuid references public.examenes_docente(id) on delete cascade;
alter table public.examenes_calificaciones add column if not exists alumno_id    uuid references public.usuarios(id) on delete cascade;
alter table public.examenes_calificaciones add column if not exists grupo_id     uuid references public.grupos(id) on delete set null;
alter table public.examenes_calificaciones add column if not exists docente_id   uuid references public.usuarios(id) on delete set null;
alter table public.examenes_calificaciones add column if not exists ciclo        text;
alter table public.examenes_calificaciones add column if not exists calificacion numeric(5,2);
alter table public.examenes_calificaciones add column if not exists comentario   text;
alter table public.examenes_calificaciones add column if not exists creado_en    timestamptz default now();

do $$ begin
  alter table public.examenes_calificaciones add constraint examenes_cals_unique unique(examen_id, alumno_id);
exception when duplicate_table or duplicate_object then null; end $$;

create index if not exists idx_examenes_cals_examen on public.examenes_calificaciones(examen_id);
create index if not exists idx_examenes_cals_alumno on public.examenes_calificaciones(alumno_id);

-- ── 3. notificaciones ─────────────────────────────────────────────────
create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid()
);

alter table public.notificaciones add column if not exists usuario_id  uuid references public.usuarios(id) on delete cascade;
alter table public.notificaciones add column if not exists tipo        text not null default 'aviso';
alter table public.notificaciones add column if not exists titulo      text not null default '';
alter table public.notificaciones add column if not exists cuerpo      text;
alter table public.notificaciones add column if not exists icono       text default '🔔';
alter table public.notificaciones add column if not exists leida       boolean default false;
alter table public.notificaciones add column if not exists ref_tipo    text;
alter table public.notificaciones add column if not exists ref_id      uuid;
alter table public.notificaciones add column if not exists escuela_cct text;
alter table public.notificaciones add column if not exists creado_en   timestamptz default now();

create index if not exists idx_notificaciones_usuario on public.notificaciones(usuario_id, leida);
create index if not exists idx_notificaciones_tipo    on public.notificaciones(tipo);

-- ── RLS — examenes_docente ────────────────────────────────────────────
alter table public.examenes_docente enable row level security;

drop policy if exists "examenes_read" on public.examenes_docente;
create policy "examenes_read" on public.examenes_docente
  for select using (
    docente_id = (select id from public.usuarios where auth_id = auth.uid() limit 1)
    or (
      escuela_cct = (select escuela_cct from public.usuarios where auth_id = auth.uid() limit 1)
      and (select rol from public.usuarios where auth_id = auth.uid() limit 1)
          in ('superadmin','admin','director','subdirector','coordinador')
    )
    or (
      visible_alumnos = true
      and grupo_id in (
        select ag.grupo_id from public.alumnos_grupos ag
        where ag.alumno_id = (select id from public.usuarios where auth_id = auth.uid() limit 1)
          and ag.activo = true
        limit 20
      )
    )
    or (select rol from public.usuarios where auth_id = auth.uid() limit 1) = 'superadmin'
  );

drop policy if exists "examenes_write" on public.examenes_docente;
create policy "examenes_write" on public.examenes_docente
  for all using (
    docente_id = (select id from public.usuarios where auth_id = auth.uid() limit 1)
    or (select rol from public.usuarios where auth_id = auth.uid() limit 1)
        in ('superadmin','admin','director','subdirector')
  );

-- ── RLS — examenes_calificaciones ─────────────────────────────────────
alter table public.examenes_calificaciones enable row level security;

drop policy if exists "examenes_cals_read" on public.examenes_calificaciones;
create policy "examenes_cals_read" on public.examenes_calificaciones
  for select using (
    docente_id = (select id from public.usuarios where auth_id = auth.uid() limit 1)
    or alumno_id = (select id from public.usuarios where auth_id = auth.uid() limit 1)
    or (select rol from public.usuarios where auth_id = auth.uid() limit 1)
        in ('superadmin','admin','director','subdirector','coordinador')
  );

drop policy if exists "examenes_cals_write" on public.examenes_calificaciones;
create policy "examenes_cals_write" on public.examenes_calificaciones
  for all using (
    docente_id = (select id from public.usuarios where auth_id = auth.uid() limit 1)
    or (select rol from public.usuarios where auth_id = auth.uid() limit 1)
        in ('superadmin','admin','director','subdirector')
  );

-- ── RLS — notificaciones ─────────────────────────────────────────────
alter table public.notificaciones enable row level security;

drop policy if exists "notificaciones_read" on public.notificaciones;
create policy "notificaciones_read" on public.notificaciones
  for select using (
    usuario_id = (select id from public.usuarios where auth_id = auth.uid() limit 1)
  );

drop policy if exists "notificaciones_update" on public.notificaciones;
create policy "notificaciones_update" on public.notificaciones
  for update using (
    usuario_id = (select id from public.usuarios where auth_id = auth.uid() limit 1)
  );

drop policy if exists "notificaciones_insert" on public.notificaciones;
create policy "notificaciones_insert" on public.notificaciones
  for insert with check (
    auth.role() = 'authenticated'
  );
