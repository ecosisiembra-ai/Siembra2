window.SiembraDemoFixtures = {
  hubRoles: {
    docente:     { email: 'docente.demo@siembra.mx', hint: 'Recorrido demo - Docente' },
    tutor:       { email: 'tutor.demo@siembra.mx', hint: 'Recorrido demo - Tutor de grupo' },
    director:    { email: 'director.demo@siembra.mx', hint: 'Recorrido demo - Director' },
    subdirector: { email: 'subdirector.demo@siembra.mx', hint: 'Recorrido demo - Subdirector' },
    coordinador: { email: 'coordinacion.demo@siembra.mx', hint: 'Recorrido demo - Coordinacion' },
    prefecto:    { email: 'prefectura.demo@siembra.mx', hint: 'Recorrido demo - Prefectura' },
    admin:       { email: 'admin.demo@siembra.mx', hint: 'Recorrido demo - Administracion' },
    padre:       { email: 'familia.demo@siembra.mx', hint: 'Recorrido demo - Familia' },
    ts:          { email: 'ts.demo@siembra.mx', hint: 'Recorrido demo - Trabajo social' },
    contralor:   { email: 'contraloria.demo@siembra.mx', hint: 'Recorrido demo - Contraloria' },
  },
  escuelas: [
    { cct:'19EPR0001A', nombre:'Escuela Primaria Piloto Norte', municipio:'Guadalupe', estado:'Nuevo Leon', zona:'09', sector:'02', nivel:'Primaria', sostenimiento:'Estatal', turno:'Matutino', director:'Direccion escolar A', tel:'81-1234-5678' },
    { cct:'19EPR0045B', nombre:'Escuela Primaria Piloto Centro', municipio:'Monterrey', estado:'Nuevo Leon', zona:'12', sector:'04', nivel:'Primaria', sostenimiento:'Federal', turno:'Matutino', director:'Direccion escolar B', tel:'81-9876-5432' },
    { cct:'19EPR0112C', nombre:'Escuela Primaria Piloto Oriente', municipio:'San Nicolas', estado:'Nuevo Leon', zona:'07', sector:'03', nivel:'Primaria', sostenimiento:'Estatal', turno:'Vespertino', director:'Direccion escolar C', tel:'81-5555-4321' },
    { cct:'19EPR0230D', nombre:'Escuela Primaria Piloto Sur', municipio:'Apodaca', estado:'Nuevo Leon', zona:'14', sector:'06', nivel:'Primaria', sostenimiento:'Federal', turno:'Matutino', director:'Direccion escolar D', tel:'81-3333-2222' },
    { cct:'19DPR0007K', nombre:'Escuela Primaria Piloto Poniente', municipio:'Guadalupe', estado:'Nuevo Leon', zona:'09', sector:'02', nivel:'Primaria', sostenimiento:'Federal', turno:'Matutino', director:'Direccion escolar E', tel:'81-7777-1234' },
  ],
  portafolio: {
    evidencias: [
      { id:'ev-001', alumno_id:'demo-1', alumno_nombre:'Alumno Demo 1', alumno_iniciales:'AD', titulo:'Maqueta del sistema solar', campo:'Saberes y pensamiento cientifico', tipo:'foto', archivo_url:'', archivo_tipo:'image', estado:'pendiente', docente_nota:'', xp_otorgado:0, created_at: new Date(Date.now()-2*86400000).toISOString() },
      { id:'ev-002', alumno_id:'demo-2', alumno_nombre:'Alumno Demo 2', alumno_iniciales:'A2', titulo:'Redaccion: carta a mi comunidad', campo:'Lenguajes', tipo:'documento', archivo_url:'', archivo_tipo:'document', estado:'pendiente', docente_nota:'', xp_otorgado:0, created_at: new Date(Date.now()-1*86400000).toISOString() },
      { id:'ev-003', alumno_id:'demo-1', alumno_nombre:'Alumno Demo 1', alumno_iniciales:'AD', titulo:'Ejercicios de fracciones resueltos', campo:'Saberes y pensamiento cientifico', tipo:'foto', archivo_url:'', archivo_tipo:'image', estado:'aprobada', docente_nota:'Excelente trabajo. Buena presentacion.', xp_otorgado:80, created_at: new Date(Date.now()-5*86400000).toISOString() },
      { id:'ev-004', alumno_id:'demo-4', alumno_nombre:'Alumno Demo 4', alumno_iniciales:'A4', titulo:'Video: danza folclorica', campo:'De lo humano y lo comunitario', tipo:'video', archivo_url:'', archivo_tipo:'video', estado:'pendiente', docente_nota:'', xp_otorgado:0, created_at: new Date().toISOString() },
    ],
  },
  admin: {
    usuarios: [
      {id:'d1',nombre:'Docente',apellido_p:'Demo',email:'docente1@demo.edu',rol:'docente',activo:true,grupo_tutoria:'6A',created_at:new Date().toISOString()},
      {id:'d2',nombre:'Director',apellido_p:'Demo',email:'director@demo.edu',rol:'director',activo:true,grupo_tutoria:null,created_at:new Date().toISOString()},
      {id:'d3',nombre:'Trabajo Social',apellido_p:'Demo',email:'ts@demo.edu',rol:'ts',activo:true,grupo_tutoria:null,created_at:new Date().toISOString()},
      {id:'d4',nombre:'Prefectura',apellido_p:'Demo',email:'prefectura@demo.edu',rol:'prefecto',activo:true,grupo_tutoria:null,created_at:new Date().toISOString()},
      {id:'d5',nombre:'Coordinacion',apellido_p:'Demo',email:'coordinacion@demo.edu',rol:'coordinador',activo:false,grupo_tutoria:null,created_at:new Date().toISOString()},
    ],
    grupos: [
      { id:'g1', nombre:'1A', grado:1, seccion:'A', turno:'matutino', nivel:'primaria', capacidad:35 },
      { id:'g2', nombre:'2B', grado:2, seccion:'B', turno:'matutino', nivel:'primaria', capacidad:35 },
      { id:'g3', nombre:'3A', grado:3, seccion:'A', turno:'matutino', nivel:'primaria', capacidad:35 },
      { id:'g4', nombre:'6A', grado:6, seccion:'A', turno:'matutino', nivel:'primaria', capacidad:35 },
    ],
    docentes: [
      { id:'d1', nombre:'Docente', apellido:'Demo Uno', email:'docente1@escuela.edu.mx', rol:'docente', turno:'matutino', activo:true },
      { id:'d2', nombre:'Docente', apellido:'Demo Dos', email:'docente2@escuela.edu.mx', rol:'docente', turno:'matutino', activo:true },
      { id:'d3', nombre:'Trabajo Social', apellido:'Demo', email:'ts@escuela.edu.mx', rol:'ts', turno:'matutino', activo:true },
    ],
    alumnos: [
      { id:'a1', nombre:'Alumno', apellido:'Demo Uno', curp:'DEMO140320HNLLRG01', codigo_vinculacion:'ALU-X1', alumnos_grupos:[{ grupo_id:'g2', grupos:{ nombre:'2B', grado:2 } }] },
      { id:'a2', nombre:'Alumno', apellido:'Demo Dos', curp:'DEMO150812MNLRMN02', codigo_vinculacion:'ALU-Y2', alumnos_grupos:[{ grupo_id:'g1', grupos:{ nombre:'1A', grado:1 } }] },
      { id:'a3', nombre:'Alumno', apellido:'Sin Grupo', curp:'', codigo_vinculacion:'', alumnos_grupos:[] },
    ],
    asignacionesResumen: [
      { docente:'Docente Demo 1', materias:['Matematicas','Ciencias'], horas:10 },
      { docente:'Docente Demo 2', materias:['Espanol','Historia'], horas:8 },
    ],
  },
  ts: {
    alumnos: [
      { id:'a1', nombre:'Alumno', apellido:'Demo Uno', alumnos_grupos:[{grupos:{nombre:'2B',grado:2}}], perfil_alumno:{xp_total:320} },
      { id:'a2', nombre:'Alumno', apellido:'Demo Dos', alumnos_grupos:[{grupos:{nombre:'1A',grado:1}}], perfil_alumno:{xp_total:540} },
      { id:'a3', nombre:'Alumno', apellido:'Demo Tres', alumnos_grupos:[{grupos:{nombre:'3A',grado:3}}], perfil_alumno:{xp_total:120} },
      { id:'a4', nombre:'Alumno', apellido:'Demo Cuatro', alumnos_grupos:[{grupos:{nombre:'6A',grado:6}}], perfil_alumno:{xp_total:890} },
      { id:'a5', nombre:'Alumno', apellido:'Sin Seguimiento', alumnos_grupos:[{grupos:{nombre:'2B',grado:2}}], perfil_alumno:{xp_total:0} },
    ],
    incidencias: [
      { id:'i1', alumno_id:'a3', alumno:{nombre:'Alumno',apellido:'Demo Tres'}, tipo:'asistencia', estado:'urgente', descripcion:'Acumulacion de ausencias sin contacto reciente con la familia.', reportado:{nombre:'Docente titular',rol:'docente'}, grupo:{nombre:'3A'}, created_at: new Date().toISOString(), derivada_ts:true },
      { id:'i2', alumno_id:'a1', alumno:{nombre:'Alumno',apellido:'Demo Uno'}, tipo:'academica', estado:'en_seguimiento', descripcion:'Rendimiento por debajo de lo esperado en dos materias base.', reportado:{nombre:'Docente asignado',rol:'docente'}, grupo:{nombre:'2B'}, created_at: new Date(Date.now()-86400000).toISOString(), derivada_ts:false },
      { id:'i3', alumno_id:'a5', alumno:{nombre:'Alumno',apellido:'Sin Seguimiento'}, tipo:'conducta', estado:'abierta', descripcion:'Se requiere seguimiento por incidentes repetidos durante recreo.', reportado:{nombre:'Prefectura',rol:'prefecto'}, grupo:{nombre:'2B'}, created_at: new Date(Date.now()-172800000).toISOString(), derivada_ts:false },
    ],
  },
  portafolioDemoAlumnos: [
    {id:'a3',nombre:'Alumno Demo 3'},
    {id:'a4',nombre:'Alumno Demo 4'},
    {id:'a5',nombre:'Alumno Demo 5'},
  ],
  sa: {
    escuelas: [
      { id:'demo-1', nombre:'Escuela primaria piloto', cct:'19EPR0001A', municipio:'Guadalupe, NL', nivel:'primaria', activo:true },
      { id:'demo-2', nombre:'Escuela secundaria piloto', cct:'19EST0045A', municipio:'Monterrey, NL', nivel:'secundaria', activo:true },
    ],
    directorioAlumnos: [
      {id:'d1',nombre:'Alumno Demo Uno',grado:1,seccion:'A'},
      {id:'d2',nombre:'Alumno Demo Dos',grado:1,seccion:'A'},
      {id:'d3',nombre:'Alumno Demo Tres',grado:2,seccion:'B'},
      {id:'d4',nombre:'Alumno Demo Cuatro',grado:2,seccion:'B'},
      {id:'d5',nombre:'Alumno Demo Cinco',grado:3,seccion:'A'},
      {id:'d6',nombre:'Alumno Demo Seis',grado:3,seccion:'A'},
      {id:'d7',nombre:'Alumno Demo Siete',grado:1,seccion:'B'},
      {id:'d8',nombre:'Alumno Demo Ocho',grado:2,seccion:'A'},
    ],
  },
};
