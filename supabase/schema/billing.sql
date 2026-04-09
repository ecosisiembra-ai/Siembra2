create table if not exists public.planes_config (
  id text primary key,
  nombre text not null,
  precio_mxn integer not null default 0,
  limite_alumnos integer,
  limite_docentes integer,
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.planes_config (id, nombre, precio_mxn, limite_alumnos, limite_docentes, activo)
values
  ('basico', 'Basico', 499, 150, 15, true),
  ('estandar', 'Estandar', 999, 500, 50, true),
  ('premium', 'Premium', 1999, 2000, 200, true)
on conflict (id) do update
set
  nombre = excluded.nombre,
  precio_mxn = excluded.precio_mxn,
  limite_alumnos = excluded.limite_alumnos,
  limite_docentes = excluded.limite_docentes,
  activo = excluded.activo,
  updated_at = now();

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid references public.escuelas(id) on delete cascade,
  escuela_cct text,
  plan_id text references public.planes_config(id) on delete set null,
  monto_mxn integer not null,
  metodo text not null,
  estado text not null default 'pendiente',
  periodo_inicio date,
  periodo_fin date,
  conekta_order_id text,
  payload_ref jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_pagos_escuela on public.pagos(escuela_id, created_at desc);
create index if not exists idx_pagos_order on public.pagos(conekta_order_id);
