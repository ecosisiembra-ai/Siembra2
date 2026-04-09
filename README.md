# SIEMBRA

Sistema escolar web para operacion academica y administrativa en escuelas de Mexico. Incluye portal docente, familias, alumno, administracion escolar, superadmin, PWA y funciones asistidas por IA.

## Estado actual del repo

Este repositorio contiene la app web cliente lista para correr como sitio estatico.

Incluye:

- `index.html` como hub principal de acceso y operacion multirol
- `alumno.html` para portal alumno
- `padres.html` para portal familias
- `sa.html` para superadmin
- `facturacion.html` y `onboarding.html`
- servicios JS compartidos en `siembra-services.js`
- modulos iniciales en `app/core`, `app/services`, `app/admin` y `app/demo`
- pruebas unitarias y configuracion CI

No incluye todavia:

- todo el backend historico completo del proyecto
- seeds de produccion o bootstrap institucional final
- cobertura SQL para absolutamente todos los modulos legacy del frontend

La app actualmente apunta a un proyecto Supabase ya configurado desde el frontend. Si vas a conectar tu propio proyecto, revisa la seccion de configuracion.

## Demo y produccion

SIEMBRA ya separa demo y produccion dentro de la misma base de codigo:

- `index.html` es la entrada principal de produccion
- `demo.html` es la portada de demo
- `alumno.html?mode=demo` abre alumno demo
- `padres.html?mode=demo` abre familias demo

No se recomienda duplicar el proyecto en carpetas separadas tipo `demo/` y `produccion/`. El mantenimiento correcto es un solo repo con modos y entradas separadas.

## Estructura del proyecto

```text
.
|-- app/
|   |-- admin/
|   |   `-- grupos.js
|   |-- core/
|   |   |-- runtime.js
|   |   `-- store.js
|   |-- demo/
|   |   `-- fixtures.js
|   `-- services/
|       |-- asignaciones.js
|       |-- coberturas.js
|       `-- planeaciones.js
|-- tests/
|-- index.html
|-- alumno.html
|-- padres.html
|-- sa.html
|-- facturacion.html
|-- onboarding.html
|-- demo.html
|-- siembra-services.js
|-- sw.js
|-- manifest.json
|-- vercel.json
`-- README.md
```

## Requisitos minimos

- Node.js 20 o superior
- Un servidor estatico local
- Navegador moderno
- Proyecto Supabase operativo si quieres usar backend real

## Levantar el proyecto

Instala dependencias de desarrollo:

```bash
npm install
```

Levanta un servidor local estatico. Puedes usar cualquiera de estas opciones:

```bash
npx serve .
```

o

```bash
python -m http.server 3000
```

Luego abre:

- `http://localhost:3000/index.html`
- `http://localhost:3000/demo.html`

## Scripts disponibles

```bash
npm run test:unit
npm run test:e2e
npm run test
npm run lint
```

## Configuracion minima

### Frontend

Hoy la app toma la configuracion publica de Supabase desde constantes hardcodeadas y tambien puede apoyarse en `localStorage`.

Puntos importantes:

- `index.html` define `_URL_HUB` y `_KEY_HUB`
- `index.html` genera `SUPABASE_URL` y `SUPABASE_KEY`
- `alumno.html` y `padres.html` leen configuracion compatible para usar el mismo backend

Si conectas tu propio proyecto Supabase, revisa al menos:

- [index.html](./index.html)
- [alumno.html](./alumno.html)
- [padres.html](./padres.html)
- [facturacion.html](./facturacion.html)

Variables de referencia documentadas en `.env.example`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`
- `CONEKTA_PRIVATE_KEY`

Nota importante:
El frontend actual no consume `.env` de manera directa porque es HTML estatico. El archivo `.env.example` es una referencia operativa para despliegue y backend, no un cargador automatico.

### Backend esperado

La app espera que existan estas Edge Functions en Supabase:

- `ai-router`
- `invite-user`
- `conekta-checkout`
- `conekta-webhook`

Y varias tablas operativas, por ejemplo:

- `usuarios`
- `escuelas`
- `grupos`
- `alumnos_grupos`
- `docente_grupos`
- `planeaciones_clase`
- `tareas_docente`
- `tareas_entregas`
- `vinculos_padre`
- `pagos`

Este repo ya incluye una primera base versionada en `supabase/` para piloto serio:

- `supabase/functions/` con `ai-router`, `invite-user`, `conekta-checkout` y `conekta-webhook`
- `supabase/schema/base.sql`
- `supabase/schema/billing.sql`
- `supabase/schema/rls.sql`

Todavia conviene ampliar esa base conforme se vayan consolidando modulos legacy del frontend.

## Deploy

El proyecto se despliega como sitio estatico. `vercel.json` ya viene configurado.

Configuracion actual:

- Build Command: vacio
- Output Directory: `.`
- Framework: `Other`

## Calidad

Actualmente se valida:

- sintaxis JS incrustada en HTML
- accesibilidad minima en botones de icono
- pruebas unitarias del proyecto
- flujo E2E con Playwright en CI

## Pendientes recomendados para dejar el repo "listo para terceros"

- documentar credenciales y secrets reales por ambiente
- mover configuracion publica de Supabase a un mecanismo mas claro por ambiente
- agregar instrucciones exactas de bootstrap de una escuela nueva

## Verificacion local

A la fecha de esta actualizacion, el proyecto pasa:

```bash
npm run test:unit
```

## Licencia

Proyecto propietario. Todos los derechos reservados.
