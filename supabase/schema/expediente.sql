-- ══════════════════════════════════════════════════════════════════════
-- EXPEDIENTE ACADÉMICO LONGITUDINAL — SIEMBRA
-- El historial del alumno que viaja de grado en grado y de escuela en
-- escuela dentro del ecosistema. Clave: CURP (ID único nacional).
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.expediente_alumno (
  id            uuid primary key default gen_random_uuid(),

  -- ── Identidad ──────────────────────────────────────────────────────
  curp          text not null,            -- LLAVE UNIVERSAL (ID único nacional)
  alumno_id     uuid references public.usuarios(id) on delete set null,
  escuela_cct   text not null,
  ciclo         text not null,            -- '2025-2026'
  nivel         text not null,            -- 'primaria' | 'secundaria'
  grado         integer not null,         -- 1-6 primaria / 1-3 secundaria
  grupo_id      uuid references public.grupos(id) on delete set null,

  -- ── Promedios del ciclo (calculados al cerrar el año) ──────────────
  promedio_general    numeric(4,2),
  promedio_t1         numeric(4,2),
  promedio_t2         numeric(4,2),
  promedio_t3         numeric(4,2),
  calificaciones_json jsonb,              -- snapshot completo: {materia: {t1,t2,t3}}

  -- ── Asistencia del ciclo ───────────────────────────────────────────
  asistencias_total          integer default 0,
  inasistencias_justificadas integer default 0,
  inasistencias_injustificadas integer default 0,

  -- ── Análisis IA (generado por Claude al cierre del ciclo) ──────────
  resumen_ia              text,           -- Narrativa: fortalezas, áreas de mejora
  fortalezas              jsonb,          -- ["Matemáticas", "Comprensión lectora"]
  areas_oportunidad       jsonb,          -- ["Expresión oral", "Geometría"]
  estilo_aprendizaje      text,           -- inferido por IA: 'visual','kinestésico','auditivo'
  recomendaciones_ia      text,           -- Sugerencias para el siguiente docente

  -- ── Voz del docente (para el siguiente) ───────────────────────────
  comentarios_docente     text,           -- Observaciones generales del docente
  recomendaciones_docente text,           -- "Necesita apoyo en...", "Destaca en..."
  docente_id              uuid references public.usuarios(id) on delete set null,

  -- ── Gamificación al cierre del ciclo ──────────────────────────────
  xp_final        integer default 0,
  nivel_planta    integer default 1,
  logros          jsonb,                  -- badges obtenidos en el ciclo

  -- ── Portabilidad entre escuelas (requiere autorización del padre) ──
  portabilidad_autorizada  boolean default false,
  autorizado_por           uuid references public.usuarios(id) on delete set null,
  autorizado_en            timestamptz,

  -- ── Auditoría ─────────────────────────────────────────────────────
  cerrado_en    timestamptz,              -- cuando el director/admin cerró el ciclo
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  unique(curp, ciclo, nivel, escuela_cct)
);

-- Índices para búsqueda rápida por CURP y por escuela
create index if not exists idx_expediente_curp     on public.expediente_alumno(curp);
create index if not exists idx_expediente_escuela  on public.expediente_alumno(escuela_cct, ciclo);
create index if not exists idx_expediente_alumno   on public.expediente_alumno(alumno_id);

-- ── RLS ────────────────────────────────────────────────────────────────
alter table public.expediente_alumno enable row level security;

-- Lectura: docentes/directivos de la escuela ven los expedientes de sus alumnos.
-- También: si portabilidad_autorizada = true, cualquier escuela SIEMBRA puede leer.
drop policy if exists "expediente_read" on public.expediente_alumno;
create policy "expediente_read" on public.expediente_alumno
  for select using (
    -- La escuela donde está registrado el expediente
    escuela_cct = (select escuela_cct from public.usuarios where auth_id = auth.uid() limit 1)
    -- O expediente con portabilidad autorizada (alumno se cambió de escuela)
    or (
      portabilidad_autorizada = true
      and (select rol from public.usuarios where auth_id = auth.uid() limit 1)
          in ('superadmin','admin','director','subdirector','coordinador')
    )
    -- O el propio alumno/padre puede ver su expediente (por CURP o alumno_id)
    or alumno_id = (select id from public.usuarios where auth_id = auth.uid() limit 1)
    -- Superadmin ve todo
    or (select rol from public.usuarios where auth_id = auth.uid() limit 1) = 'superadmin'
  );

-- Escritura: solo directivos/admin de la escuela pueden crear/editar expedientes
drop policy if exists "expediente_write" on public.expediente_alumno;
create policy "expediente_write" on public.expediente_alumno
  for all using (
    (select rol from public.usuarios where auth_id = auth.uid() limit 1)
        in ('superadmin','admin','director','subdirector')
    and (
      escuela_cct = (select escuela_cct from public.usuarios where auth_id = auth.uid() limit 1)
      or (select rol from public.usuarios where auth_id = auth.uid() limit 1) = 'superadmin'
    )
  )
  with check (
    (select rol from public.usuarios where auth_id = auth.uid() limit 1)
        in ('superadmin','admin','director','subdirector')
  );