-- ══════════════════════════════════════════════════════════════════════
-- MÓDULOS SIEMBRA: PEMC, CTE, EVENTOS CALENDARIO
-- Ejecutar en Supabase SQL Editor
-- Seguro de re-ejecutar: usa ADD COLUMN IF NOT EXISTS (Postgres 9.6+)
-- ══════════════════════════════════════════════════════════════════════

-- ── PEMC ──────────────────────────────────────────────────────────────
create table if not exists public.pemc (
  id uuid primary key default gen_random_uuid()
);

alter table public.pemc add column if not exists escuela_cct  text not null default '';
alter table public.pemc add column if not exists ciclo         text not null default '2025-2026';
alter table public.pemc add column if not exists created_at   timestamptz default now();
alter table public.pemc add column if not exists tipo         text not null default 'meta';
alter table public.pemc add column if not exists contenido    text;
alter table public.pemc add column if not exists responsable  text;
alter table public.pemc add column if not exists subtipo      text;
alter table public.pemc add column if not exists estatus      text default 'pendiente';
alter table public.pemc add column if not exists fecha_compromiso date;
alter table public.pemc add column if not exists fecha_sesion     date;
alter table public.pemc add column if not exists numero_sesion    integer;
alter table public.pemc add column if not exists acuerdos     text;
alter table public.pemc add column if not exists acciones     jsonb;
alter table public.pemc add column if not exists plan_json    jsonb;
alter table public.pemc add column if not exists generado_por uuid;
alter table public.pemc add column if not exists autor_id     uuid;
alter table public.pemc add column if not exists updated_at   timestamptz default now();

create index if not exists idx_pemc_escuela_ciclo on public.pemc(escuela_cct, ciclo);
create index if not exists idx_pemc_tipo          on public.pemc(tipo);

-- ── CTE — Sesiones del Consejo Técnico Escolar ───────────────────────
create table if not exists public.cte_sesiones (
  id uuid primary key default gen_random_uuid()
);

alter table public.cte_sesiones add column if not exists escuela_cct text not null default '';
alter table public.cte_sesiones add column if not exists ciclo       text not null default '2025-2026';
alter table public.cte_sesiones add column if not exists numero      integer not null default 1;
alter table public.cte_sesiones add column if not exists tipo        text default 'Ordinaria';
alter table public.cte_sesiones add column if not exists fecha       date;
alter table public.cte_sesiones add column if not exists tema        text;
alter table public.cte_sesiones add column if not exists orden       text;
alter table public.cte_sesiones add column if not exists acuerdos    text;
alter table public.cte_sesiones add column if not exists asistentes  integer default 0;
alter table public.cte_sesiones add column if not exists ausentes    integer default 0;
alter table public.cte_sesiones add column if not exists guardado    timestamptz default now();
alter table public.cte_sesiones add column if not exists autor_id    uuid;
alter table public.cte_sesiones add column if not exists created_at  timestamptz default now();
alter table public.cte_sesiones add column if not exists updated_at  timestamptz default now();

do $$ begin
  alter table public.cte_sesiones add constraint cte_sesiones_unique unique(escuela_cct, ciclo, numero);
exception when duplicate_table or duplicate_object then null; end $$;

create index if not exists idx_cte_sesiones_escuela on public.cte_sesiones(escuela_cct, ciclo);

-- ── EVENTOS — Calendario Escolar compartido ──────────────────────────
create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid()
);

alter table public.eventos add column if not exists escuela_cct text not null default '';
alter table public.eventos add column if not exists ciclo       text default '2025-2026';
alter table public.eventos add column if not exists fecha       date;
alter table public.eventos add column if not exists tipo        text not null default 'evento';
alter table public.eventos add column if not exists label       text not null default '';
alter table public.eventos add column if not exists descripcion text;
alter table public.eventos add column if not exists activo      boolean default true;
alter table public.eventos add column if not exists creado_por  uuid;
alter table public.eventos add column if not exists created_at  timestamptz default now();

create index if not exists idx_eventos_escuela_fecha on public.eventos(escuela_cct, fecha);

-- ── RLS — PEMC ────────────────────────────────────────────────────────
alter table public.pemc enable row level security;

drop policy if exists "pemc_read_own_school"  on public.pemc;
drop policy if exists "pemc_write_own_school" on public.pemc;

create policy "pemc_read_own_school" on public.pemc
  for select using (
    escuela_cct = (select escuela_cct from public.usuarios where auth_id = auth.uid() limit 1)
  );

create policy "pemc_write_own_school" on public.pemc
  for all using (
    escuela_cct = (select escuela_cct from public.usuarios where auth_id = auth.uid() limit 1)
  );

-- ── RLS — CTE Sesiones ────────────────────────────────────────────────
alter table public.cte_sesiones enable row level security;

drop policy if exists "cte_read_own_school"  on public.cte_sesiones;
drop policy if exists "cte_write_own_school" on public.cte_sesiones;

create policy "cte_read_own_school" on public.cte_sesiones
  for select using (
    escuela_cct = (select escuela_cct from public.usuarios where auth_id = auth.uid() limit 1)
  );

create policy "cte_write_own_school" on public.cte_sesiones
  for all using (
    escuela_cct = (select escuela_cct from public.usuarios where auth_id = auth.uid() limit 1)
  );

-- ── RLS — Eventos ─────────────────────────────────────────────────────
alter table public.eventos enable row level security;

drop policy if exists "eventos_read_own_school"   on public.eventos;
drop policy if exists "eventos_write_directivos"  on public.eventos;

create policy "eventos_read_own_school" on public.eventos
  for select using (
    escuela_cct = (select escuela_cct from public.usuarios where auth_id = auth.uid() limit 1)
  );

create policy "eventos_write_directivos" on public.eventos
  for all using (
    escuela_cct = (select escuela_cct from public.usuarios where auth_id = auth.uid() limit 1)
    and (select rol from public.usuarios where auth_id = auth.uid() limit 1)
        in ('superadmin','admin','director','subdirector','coordinador')
  );