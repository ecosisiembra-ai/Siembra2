create extension if not exists "pgcrypto";

create table if not exists public.escuelas (
  id uuid primary key default gen_random_uuid(),
  cct text unique not null,
  nombre text not null,
  nivel text default 'secundaria',
  municipio text,
  estado text,
  zona_escolar text,
  turno text,
  ciclo_actual text default '2025-2026',
  activa boolean default true,
  plan_suscripcion text,
  estado_suscripcion text default 'trial',
  fecha_vencimiento date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique,
  escuela_id uuid references public.escuelas(id) on delete set null,
  escuela_cct text,
  nombre text not null,
  apellido_p text,
  apellido_m text,
  email text unique,
  telefono text,
  curp text,
  fecha_nac date,
  rol text not null,
  activo boolean default true,
  codigo_vinculacion text,
  tutor_nombre text,
  telefono_tutor text,
  grupo_tutoria uuid,
  nivel text,
  nivel_default text,
  num_lista integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  ultimo_acceso timestamptz,
  last_seen timestamptz
);

alter table public.usuarios
  drop constraint if exists usuarios_rol_check;

alter table public.usuarios
  add constraint usuarios_rol_check
  check (
    rol in (
      'superadmin','admin','director','subdirector','coordinador','prefecto',
      'docente','tutor','ts','padre','alumno'
    )
  );

create table if not exists public.usuario_escuelas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.usuarios(id) on delete cascade,
  escuela_id uuid references public.escuelas(id) on delete cascade,
  escuela_cct text,
  rol text,
  activo boolean default true,
  created_at timestamptz default now(),
  unique(usuario_id, escuela_id)
);

create table if not exists public.grupos (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid references public.escuelas(id) on delete cascade,
  escuela_cct text not null,
  nombre text,
  grado integer not null,
  seccion text not null default 'A',
  nivel text default 'secundaria',
  turno text default 'matutino',
  capacidad integer default 35,
  ciclo text default '2025-2026',
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(escuela_cct, ciclo, grado, seccion)
);

create table if not exists public.alumnos_grupos (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid references public.usuarios(id) on delete cascade,
  grupo_id uuid references public.grupos(id) on delete cascade,
  ciclo_escolar text not null default '2025-2026',
  ciclo text default '2025-2026',
  activo boolean default true,
  created_at timestamptz default now(),
  unique(alumno_id, grupo_id, ciclo_escolar)
);

create table if not exists public.docente_grupos (
  id uuid primary key default gen_random_uuid(),
  docente_id uuid references public.usuarios(id) on delete cascade,
  grupo_id uuid references public.grupos(id) on delete cascade,
  materia text not null,
  campo_formativo text,
  ciclo text default '2025-2026',
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(docente_id, grupo_id, materia, ciclo)
);

create table if not exists public.tutores_grupo (
  id uuid primary key default gen_random_uuid(),
  docente_id uuid references public.usuarios(id) on delete cascade,
  grupo_id uuid references public.grupos(id) on delete cascade,
  ciclo text default '2025-2026',
  activo boolean default true,
  created_at timestamptz default now(),
  unique(docente_id, grupo_id, ciclo)
);

create table if not exists public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  escuela_id uuid references public.escuelas(id) on delete cascade,
  escuela_cct text,
  rol text not null,
  email_destino text not null,
  nombre_destino text,
  estado text default 'pendiente',
  created_by uuid references public.usuarios(id) on delete set null,
  expira_at timestamptz,
  usado_at timestamptz,
  reenviado_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.vinculos_padre (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  alumno_id uuid references public.usuarios(id) on delete cascade,
  padre_id uuid references public.usuarios(id) on delete set null,
  escuela_id uuid references public.escuelas(id) on delete cascade,
  escuela_cct text,
  nombre_tutor text,
  telefono_tutor text,
  usado boolean default false,
  expira_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.padres_alumnos (
  id uuid primary key default gen_random_uuid(),
  padre_id uuid references public.usuarios(id) on delete cascade,
  alumno_id uuid references public.usuarios(id) on delete cascade,
  activo boolean default true,
  created_at timestamptz default now(),
  unique(padre_id, alumno_id)
);

create table if not exists public.planeaciones_clase (
  id uuid primary key default gen_random_uuid(),
  docente_id uuid references public.usuarios(id) on delete cascade,
  escuela_cct text not null,
  ciclo text not null default '2025-2026',
  semana text not null,
  materia text not null,
  grupo text not null,
  objetivo text,
  recursos text,
  evaluacion text,
  contenido_json jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(docente_id, ciclo, semana, materia, grupo)
);

create table if not exists public.tareas_docente (
  id uuid primary key default gen_random_uuid(),
  docente_id uuid references public.usuarios(id) on delete cascade,
  grupo_id uuid references public.grupos(id) on delete cascade,
  escuela_cct text,
  materia text,
  titulo text not null,
  descripcion text,
  fecha_entrega date,
  visible boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tareas_entregas (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid references public.tareas_docente(id) on delete cascade,
  alumno_id uuid references public.usuarios(id) on delete cascade,
  estado text default 'pendiente',
  nota numeric(5,2),
  entregado_en timestamptz,
  updated_at timestamptz default now(),
  unique(tarea_id, alumno_id)
);

create table if not exists public.perfil_alumno (
  alumno_id uuid primary key references public.usuarios(id) on delete cascade,
  xp_total integer default 0,
  racha_dias integer default 0,
  nivel integer default 1,
  nivel_planta integer default 1,
  ultimo_login date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.historial_xp (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid references public.usuarios(id) on delete cascade,
  cantidad integer not null,
  motivo text,
  fecha timestamptz default now()
);

create table if not exists public.asistencia (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid references public.usuarios(id) on delete cascade,
  grupo_id uuid references public.grupos(id) on delete cascade,
  docente_id uuid references public.usuarios(id) on delete set null,
  escuela_cct text,
  fecha date not null,
  estado text not null default 'P',
  created_at timestamptz default now(),
  unique(alumno_id, grupo_id, fecha)
);

create table if not exists public.calificaciones (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid references public.usuarios(id) on delete cascade,
  grupo_id uuid references public.grupos(id) on delete set null,
  docente_id uuid references public.usuarios(id) on delete set null,
  escuela_cct text,
  materia text not null,
  trimestre text,
  periodo text,
  aspecto text,
  calificacion numeric(5,2),
  observacion text,
  ciclo text default '2025-2026',
  created_at timestamptz default now()
);

create table if not exists public.alertas (
  id uuid primary key default gen_random_uuid(),
  escuela_cct text,
  alumno_id uuid references public.usuarios(id) on delete cascade,
  docente_id uuid references public.usuarios(id) on delete set null,
  destinatario_id uuid references public.usuarios(id) on delete set null,
  tipo text,
  origen text,
  mensaje text,
  leido boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.config_global (
  clave text primary key,
  valor jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.parent_rfcs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.usuarios(id) on delete cascade,
  rfc text not null,
  nombre_fiscal text,
  regimen_fiscal text,
  uso_cfdi text,
  codigo_postal text,
  activo boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_usuarios_escuela_cct on public.usuarios(escuela_cct);
create index if not exists idx_grupos_escuela_cct on public.grupos(escuela_cct);
create index if not exists idx_alumnos_grupos_grupo on public.alumnos_grupos(grupo_id);
create index if not exists idx_docente_grupos_docente on public.docente_grupos(docente_id);
create index if not exists idx_planeaciones_docente on public.planeaciones_clase(docente_id, ciclo);
create index if not exists idx_tareas_grupo on public.tareas_docente(grupo_id);
