// ── SQL MIGRACIONES ──
const SQL_MIGRATIONS = [
  {
    nombre: 'Tabla escuelas',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS escuelas (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre          text NOT NULL,
  cct             text UNIQUE,
  municipio       text,
  estado          text DEFAULT 'Nuevo Le\xf3n',
  nivel           text DEFAULT 'primaria',
  nivel_default   text DEFAULT 'primaria',
  zona_escolar    text,
  turno           text DEFAULT 'matutino',
  ciclo_actual    text DEFAULT '2025-2026',
  limite_alumnos  int DEFAULT 500,
  activa          boolean DEFAULT true,
  activo          boolean DEFAULT true,
  creado_en       timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE escuelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "escuelas_read" ON escuelas FOR SELECT TO authenticated USING (true);
CREATE POLICY "escuelas_write" ON escuelas FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND rol IN ('superadmin','director','admin'))
);
CREATE POLICY "escuelas_update" ON escuelas FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND rol IN ('superadmin','director','admin'))
);`
  },
  {
    nombre: 'Tabla invitaciones',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS invitaciones (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token          text UNIQUE NOT NULL,
  escuela_id     uuid REFERENCES escuelas(id) ON DELETE CASCADE,
  rol            text NOT NULL,
  email_destino  text,
  nombre_destino text,
  estado         text DEFAULT 'pendiente' CHECK (estado IN ('pendiente','usado','expirado')),
  expira_at      timestamptz,
  usado_por      uuid,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
ALTER TABLE invitaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_read" ON invitaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "inv_insert" ON invitaciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "inv_update" ON invitaciones FOR UPDATE TO authenticated USING (true);
-- Permitir lectura anónima para verificar tokens de invitación en el registro
CREATE POLICY "inv_anon_read" ON invitaciones FOR SELECT TO anon USING (true);`
  },
  {
    nombre: 'Tabla horarios_docente',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS horarios_docente (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  docente_id  uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  grupo_id    uuid REFERENCES grupos(id),
  dia_semana  text NOT NULL,
  hora_idx    int  NOT NULL,
  materia     text,
  grupo_label text,
  ciclo       text DEFAULT '2025-2026',
  UNIQUE(docente_id, dia_semana, hora_idx, ciclo)
);`
  },
  {
    nombre: 'Tablas tareas_docente + tareas_entregas',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS tareas_docente (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  docente_id    uuid REFERENCES usuarios(id),
  grupo_id      uuid REFERENCES grupos(id),
  titulo        text NOT NULL,
  materia       text,
  fecha_entrega date,
  ciclo         text DEFAULT '2025-2026',
  created_at    timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tareas_entregas (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tarea_id  uuid REFERENCES tareas_docente(id) ON DELETE CASCADE,
  alumno_id uuid REFERENCES usuarios(id),
  estado    text DEFAULT 'pendiente' CHECK (estado IN ('pendiente','entregada','tarde')),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tarea_id, alumno_id)
);`
  },
  {
    nombre: 'Tabla evidencias (portafolio)',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS evidencias (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alumno_id    uuid REFERENCES usuarios(id),
  grupo_id     uuid REFERENCES grupos(id),
  titulo       text NOT NULL,
  campo        text,
  tipo         text,
  archivo_url  text,
  archivo_tipo text,
  estado       text DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada','rechazada')),
  docente_nota text,
  xp_otorgado  int  DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);`
  },
  {
    nombre: 'Tabla cal_observaciones_cualitativas',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS cal_observaciones_cualitativas (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alumno_id   uuid REFERENCES usuarios(id),
  grupo_id    uuid REFERENCES grupos(id),
  docente_id  uuid REFERENCES usuarios(id),
  materia     text NOT NULL,
  trimestre   int  NOT NULL,
  observacion text,
  ciclo       text DEFAULT '2025-2026',
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(alumno_id, grupo_id, materia, trimestre, ciclo)
);`
  },
  {
    nombre: 'RLS: escuelas isolation',
    estado: 'seguridad',
    sql: `-- Activar RLS en tablas nuevas
ALTER TABLE escuelas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_docente ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas_docente   ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidencias       ENABLE ROW LEVEL SECURITY;

-- Política: usuarios solo ven datos de su escuela
CREATE POLICY "escuela_isolation" ON usuarios
  USING (escuela_id = (SELECT escuela_id FROM usuarios WHERE auth_id = auth.uid()));

-- Superadmin ve todo (basado en JWT claim o rol en tabla)
CREATE POLICY "superadmin_all" ON escuelas
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND rol = 'superadmin')
  );`
  },
  {
    nombre: 'Tabla productos_docente (antes tareas)',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS productos_docente (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  docente_id    uuid REFERENCES usuarios(id),
  grupo_id      uuid REFERENCES grupos(id),
  titulo        text NOT NULL,
  materia       text,
  tipo          text DEFAULT 'tarea' CHECK (tipo IN ('tarea','proyecto','examen','exposicion','participacion','otro')),
  descripcion   text,
  fecha_entrega date,
  ciclo         text DEFAULT '2025-2026',
  trimestre     int DEFAULT 1,
  created_at    timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS productos_entregas (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id  uuid REFERENCES productos_docente(id) ON DELETE CASCADE,
  alumno_id    uuid REFERENCES usuarios(id),
  estado       text DEFAULT 'pendiente' CHECK (estado IN ('pendiente','entregada','tarde','no_entregada')),
  calificacion numeric(4,2),
  observacion  text,
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(producto_id, alumno_id)
);`
  },
  {
    nombre: 'Tabla rubricas_actividad',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS rubricas_actividad (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id   uuid REFERENCES productos_docente(id) ON DELETE CASCADE,
  docente_id    uuid REFERENCES usuarios(id),
  nombre        text NOT NULL,
  peso          numeric(5,2) DEFAULT 0,
  descripcion   text,
  escala_tipo   text DEFAULT 'numerica' CHECK (escala_tipo IN ('numerica','descriptiva','si_no')),
  orden         int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);
-- Calificaciones por rúbrica por alumno
CREATE TABLE IF NOT EXISTS rubrica_calificaciones (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rubrica_id    uuid REFERENCES rubricas_actividad(id) ON DELETE CASCADE,
  alumno_id     uuid REFERENCES usuarios(id),
  valor         numeric(4,2),
  texto_ia      text,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(rubrica_id, alumno_id)
);`
  },
  {
    nombre: 'Tabla system_logs (errores y auditoria)',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS system_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo        text NOT NULL CHECK (tipo IN ('error','warning','info','auth','action')),
  severidad   text DEFAULT 'low' CHECK (severidad IN ('critical','high','medium','low')),
  usuario_id  uuid REFERENCES usuarios(id),
  escuela_id  uuid REFERENCES escuelas(id),
  portal      text,
  mensaje     text NOT NULL,
  detalle     jsonb,
  ip          text,
  resuelto    boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_logs_tipo ON system_logs(tipo);
CREATE INDEX IF NOT EXISTS idx_logs_fecha ON system_logs(created_at DESC);
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin_logs" ON system_logs
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND rol = 'superadmin')
  );`
  },
  {
    nombre: 'Tabla aspectos_evaluacion',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS aspectos_evaluacion (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  docente_id  uuid REFERENCES usuarios(id),
  grupo_id    uuid REFERENCES grupos(id),
  materia     text NOT NULL,
  nombre      text NOT NULL,
  porcentaje  numeric(5,2) DEFAULT 0,
  orden       int DEFAULT 0,
  ciclo       text DEFAULT '2025-2026',
  UNIQUE(docente_id, grupo_id, materia, nombre, ciclo)
);`
  },
  {
    nombre: 'Tabla calificaciones (CRITICA - flujo docente->alumno->padre)',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS calificaciones (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alumno_id      uuid NOT NULL,
  grupo_id       uuid,
  docente_id     uuid,
  materia        text NOT NULL,
  trimestre      int NOT NULL DEFAULT 1,
  aspecto        text NOT NULL DEFAULT 'General',
  calificacion   numeric(4,1) NOT NULL,
  ciclo          text DEFAULT '2025-2026',
  actualizado_en timestamptz DEFAULT now(),
  UNIQUE(alumno_id, grupo_id, materia, trimestre, aspecto, ciclo)
);
CREATE INDEX IF NOT EXISTS idx_cal_alumno ON calificaciones(alumno_id);
CREATE INDEX IF NOT EXISTS idx_cal_grupo ON calificaciones(grupo_id);
ALTER TABLE calificaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docente_insert_cal" ON calificaciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "docente_update_cal" ON calificaciones FOR UPDATE TO authenticated USING (true);
CREATE POLICY "read_own_cal" ON calificaciones FOR SELECT TO authenticated USING (true);`
  },
  {
    nombre: 'Tabla usuarios (CRITICA - todos los roles)',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS usuarios (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id       uuid UNIQUE,
  nombre        text,
  apellido_p    text,
  apellido_m    text,
  email         text,
  rol           text NOT NULL DEFAULT 'docente'
                CHECK (rol IN ('superadmin','director','admin','docente','coordinador',
                               'subdirector','ts','prefecto','tutor','padre','alumno')),
  escuela_id    uuid REFERENCES escuelas(id),
  escuela_cct   text,
  activo        boolean DEFAULT true,
  nivel_default text DEFAULT 'primaria',
  grado_asignado int,
  codigo_vinculacion text UNIQUE,
  last_seen     timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usr_auth ON usuarios(auth_id);
CREATE INDEX IF NOT EXISTS idx_usr_escuela ON usuarios(escuela_id);
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own" ON usuarios FOR SELECT TO authenticated
  USING (auth_id = auth.uid() OR escuela_id IN (SELECT escuela_id FROM usuarios WHERE auth_id = auth.uid()));
CREATE POLICY "users_insert" ON usuarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "users_update_own" ON usuarios FOR UPDATE TO authenticated USING (auth_id = auth.uid());`
  },
  {
    nombre: 'Tabla grupos',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS grupos (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre       text NOT NULL,
  grado        int,
  seccion      text DEFAULT 'A',
  nivel        text DEFAULT 'primaria',
  turno        text DEFAULT 'matutino',
  escuela_id   text,
  escuela_cct  text,
  ciclo        text DEFAULT '2025-2026',
  activo       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grupos_read" ON grupos FOR SELECT TO authenticated USING (true);
CREATE POLICY "grupos_write" ON grupos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "grupos_update" ON grupos FOR UPDATE TO authenticated USING (true);`
  },
  {
    nombre: 'Tabla alumnos_grupos (vinculacion alumno-grupo)',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS alumnos_grupos (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alumno_id      uuid NOT NULL,
  grupo_id       uuid NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  ciclo_escolar  text DEFAULT '2025-2026',
  activo         boolean DEFAULT true,
  fecha_alta     date DEFAULT CURRENT_DATE,
  UNIQUE(alumno_id, grupo_id, ciclo_escolar)
);
ALTER TABLE alumnos_grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ag_read" ON alumnos_grupos FOR SELECT TO authenticated USING (true);
CREATE POLICY "ag_write" ON alumnos_grupos FOR INSERT TO authenticated WITH CHECK (true);`
  },
  {
    nombre: 'Tabla docente_grupos (asignacion docente-grupo-materia)',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS docente_grupos (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  docente_id  uuid NOT NULL,
  grupo_id    uuid NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  materia     text,
  ciclo       text DEFAULT '2025-2026',
  activo      boolean DEFAULT true,
  UNIQUE(docente_id, grupo_id, materia, ciclo)
);
ALTER TABLE docente_grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dg_read" ON docente_grupos FOR SELECT TO authenticated USING (true);
CREATE POLICY "dg_write" ON docente_grupos FOR INSERT TO authenticated WITH CHECK (true);`
  },
  {
    nombre: 'Tabla planeaciones',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS planeaciones (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  docente_id    uuid,
  grupo_id      uuid REFERENCES grupos(id),
  materia       text NOT NULL,
  semana        text,
  ciclo         text DEFAULT '2025-2026',
  campo_formativo text,
  eje_articulador text,
  contenido     text,
  pda           text,
  actividades   text,
  recursos      text,
  evaluacion    text,
  observaciones text,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(docente_id, grupo_id, materia, semana, ciclo)
);
ALTER TABLE planeaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_rw" ON planeaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);`
  },
  {
    nombre: 'Tabla padres_alumnos (vinculacion padre-hijo)',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS padres_alumnos (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  padre_id   uuid NOT NULL,
  alumno_id  uuid NOT NULL,
  parentesco text DEFAULT 'padre/madre',
  activo     boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(padre_id, alumno_id)
);
ALTER TABLE padres_alumnos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_read" ON padres_alumnos FOR SELECT TO authenticated USING (true);
CREATE POLICY "pa_write" ON padres_alumnos FOR INSERT TO authenticated WITH CHECK (true);`
  },
  {
    nombre: 'Tabla perfil_alumno (XP, racha, gamificacion)',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS perfil_alumno (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alumno_id    uuid UNIQUE NOT NULL,
  xp_total     int DEFAULT 0,
  racha_dias   int DEFAULT 0,
  nivel        int DEFAULT 1,
  ultimo_login date,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE perfil_alumno ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_rw" ON perfil_alumno FOR ALL TO authenticated USING (true) WITH CHECK (true);`
  },
  {
    nombre: 'Constraints faltantes en asistencia',
    estado: 'requerida',
    sql: `-- Agregar constraint único para upsert de asistencia
DO $$ BEGIN
  ALTER TABLE asistencia ADD CONSTRAINT asistencia_unique_alumno_grupo_fecha
    UNIQUE(alumno_id, grupo_id, fecha);
EXCEPTION WHEN duplicate_table THEN NULL;
          WHEN duplicate_object THEN NULL;
END $$;
-- Agregar docente_id si no existe  
ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS docente_id uuid;
ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS nota text;
ALTER TABLE asistencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "asist_rw" ON asistencia FOR ALL TO authenticated USING (true) WITH CHECK (true);`
  },
  {
    nombre: 'Tabla usuario_escuelas (multi-escuela)',
    estado: 'requerida',
    sql: `CREATE TABLE IF NOT EXISTS usuario_escuelas (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id   uuid NOT NULL,
  escuela_cct  text,
  escuela_id   uuid REFERENCES escuelas(id),
  rol          text,
  activo       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(usuario_id, escuela_cct)
);
ALTER TABLE usuario_escuelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ue_rw" ON usuario_escuelas FOR ALL TO authenticated USING (true) WITH CHECK (true);`
  },
  {
    nombre: 'Columnas adicionales en usuarios',
    estado: 'requerida',
    sql: `-- Columnas que usan los distintos portales
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS apellido_p text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS apellido_m text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS escuela_cct text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nivel_default text DEFAULT 'primaria';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS grado_asignado int;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_vinculacion text UNIQUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_seen timestamptz;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
-- Ampliar constraint de rol si existe
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('superadmin','director','admin','docente','coordinador',
                 'subdirector','ts','prefecto','tutor','padre','alumno'));`
  },
  {
    nombre: 'Capacitacion SEP',
    estado: 'requerida',
    sql: `
-- ══════════════════════════════════════════════════════
-- CAPACITACIÓN SEP (nuevo módulo)
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS capacitaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escuela_cct   text NOT NULL,
  titulo        text NOT NULL,
  descripcion   text,
  tipo          text DEFAULT 'escolar' CHECK (tipo IN ('SEP','escolar','urgente')),
  fecha_limite  date,
  creado_por    uuid REFERENCES usuarios(id),
  activo        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE capacitaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_read"   ON capacitaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "cap_write"  ON capacitaciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cap_update" ON capacitaciones FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS capacitacion_archivos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capacitacion_id   uuid NOT NULL REFERENCES capacitaciones(id) ON DELETE CASCADE,
  nombre            text,
  url               text,
  tipo_archivo      text,
  created_at        timestamptz DEFAULT now()
);
ALTER TABLE capacitacion_archivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_arch_read"  ON capacitacion_archivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "cap_arch_write" ON capacitacion_archivos FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS capacitacion_lecturas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capacitacion_id   uuid NOT NULL REFERENCES capacitaciones(id) ON DELETE CASCADE,
  docente_id        uuid NOT NULL REFERENCES usuarios(id),
  leido_at          timestamptz DEFAULT now(),
  UNIQUE(capacitacion_id, docente_id)
);
ALTER TABLE capacitacion_lecturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_lect_read"   ON capacitacion_lecturas FOR SELECT TO authenticated USING (true);
CREATE POLICY "cap_lect_write"  ON capacitacion_lecturas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cap_lect_update" ON capacitacion_lecturas FOR UPDATE TO authenticated USING (true);

-- ══════════════════════════════════════════════════════
-- GESTIÓN FINANCIERA (Contralor + Director)
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS gastos_escolares (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escuela_cct   text NOT NULL,
  concepto      text NOT NULL,
  monto         numeric(12,2) NOT NULL DEFAULT 0,
  categoria     text,
  proveedor_id  uuid,
  factura_url   text,
  fecha         date DEFAULT CURRENT_DATE,
  ciclo         text DEFAULT '2025-2026',
  creado_por    uuid REFERENCES usuarios(id),
  activo        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE gastos_escolares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gastos_read"  ON gastos_escolares FOR SELECT TO authenticated USING (true);
CREATE POLICY "gastos_write" ON gastos_escolares FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gastos_upd"   ON gastos_escolares FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS ingresos_escolares (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escuela_cct   text NOT NULL,
  concepto      text NOT NULL,
  monto         numeric(12,2) NOT NULL DEFAULT 0,
  tipo          text DEFAULT 'Otro',
  fecha         date DEFAULT CURRENT_DATE,
  ciclo         text DEFAULT '2025-2026',
  creado_por    uuid REFERENCES usuarios(id),
  activo        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE ingresos_escolares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingresos_read"  ON ingresos_escolares FOR SELECT TO authenticated USING (true);
CREATE POLICY "ingresos_write" ON ingresos_escolares FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS proveedores_escuela (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escuela_cct   text NOT NULL,
  nombre        text NOT NULL,
  categoria     text,
  rfc           text,
  contacto      text,
  activo        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE proveedores_escuela ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prov_read"  ON proveedores_escuela FOR SELECT TO authenticated USING (true);
CREATE POLICY "prov_write" ON proveedores_escuela FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS tiendita_movimientos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escuela_cct   text NOT NULL,
  concepto      text NOT NULL,
  monto         numeric(12,2) NOT NULL DEFAULT 0,
  tipo          text DEFAULT 'ingreso' CHECK (tipo IN ('ingreso','gasto')),
  periodo       text,
  ciclo         text DEFAULT '2025-2026',
  fecha         date DEFAULT CURRENT_DATE,
  creado_por    uuid REFERENCES usuarios(id),
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE tiendita_movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tiendita_read"  ON tiendita_movimientos FOR SELECT TO authenticated USING (true);
CREATE POLICY "tiendita_write" ON tiendita_movimientos FOR INSERT TO authenticated WITH CHECK (true);

-- ══════════════════════════════════════════════════════
-- FEATURE FLAGS (módulos por escuela)
-- ══════════════════════════════════════════════════════
ALTER TABLE escuelas ADD COLUMN IF NOT EXISTS modulos jsonb DEFAULT '{"capacitacion":true,"contralor":true,"tiendita":true,"padres_gastos":false}'::jsonb;`
  },
];

function renderSQL() {
  const el = document.getElementById('sql-blocks');
  if (!el) return;
  // Botón para copiar TODO el SQL de una vez
  const allSQL = SQL_MIGRATIONS.map(m => `-- ═══ ${m.nombre} ═══\n${m.sql}`).join('\n\n');
  el.innerHTML = `
    <div style="margin-bottom:20px;padding:16px;background:var(--green-dim);border:1px solid rgba(34,197,94,.3);border-radius:var(--r-lg);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="font-size:18px;">⚡</span>
        <span style="font-size:14px;font-weight:700;color:var(--green);">Ejecutar TODAS las migraciones de una vez</span>
        <button class="btn btn-primary btn-sm" style="margin-left:auto;" onclick="copiarTexto(\`${allSQL.replace(/`/g,'\\`')}\`)">📋 Copiar TODO el SQL</button>
      </div>
      <div style="font-size:12px;color:var(--text2);">Copia todo el SQL y ejecutalo en <strong>Supabase &rarr; SQL Editor</strong>. Es seguro ejecutarlo multiples veces (usa IF NOT EXISTS).</div>
    </div>` +
  SQL_MIGRATIONS.map((m, i) => `
    <div style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span class="badge ${m.estado==='seguridad'?'badge-amber':'badge-red'}">${m.estado}</span>
        <span style="font-size:13px;font-weight:500;color:var(--text);">${m.nombre}</span>
        <button class="btn btn-outline btn-sm" style="margin-left:auto;" onclick="copiarTexto(\`${m.sql.replace(/`/g,'\\`')}\`)">Copiar SQL</button>
      </div>
      <pre class="sql-note">${m.sql}</pre>
    </div>`).join('');
}
