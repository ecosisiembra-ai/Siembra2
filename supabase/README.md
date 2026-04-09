# Supabase en este repo

Esta carpeta ya contiene una primera version del backend esperado por SIEMBRA.

## Estado actual

Incluye actualmente:

- `functions/` con funciones Edge base
- `schema/` con SQL inicial para piloto

Todavia no se versionan en este repositorio:

- seeds de demo o bootstrap institucional
- migraciones historicas por fecha
- cobertura completa de todos los modulos legacy

## Estructura actual

```text
supabase/
|-- functions/
|   |-- _shared/
|   |-- ai-router/
|   |-- invite-user/
|   |-- conekta-checkout/
|   `-- conekta-webhook/
`-- schema/
    |-- base.sql
    |-- billing.sql
    `-- rls.sql
```

## Orden recomendado de aplicacion

1. `schema/base.sql`
2. `schema/billing.sql`
3. `schema/rls.sql`

## Recomendacion

Cuando se suba la siguiente fase del backend, conviene versionar aqui:

1. convertir estos SQL en migraciones formales
2. completar tablas faltantes de modulos legacy
3. agregar seeds de escuela piloto
4. endurecer secretos y correo transaccional real
