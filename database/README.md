# Base de datos para version online

Esta carpeta deja preparada la estructura para mover el trabajo interno desde `localStorage` a Supabase/Postgres.

## Que guarda

- Usuarios y perfiles.
- Equipos y miembros.
- Licitaciones guardadas como snapshot.
- Favoritos, flujo, prioridad, notas, fecha interna, margen e ITBMS.
- Cotizaciones de proveedores.
- CRM interno de proveedores.
- Historial de acciones.

## Como activarlo

1. Crear un proyecto en Supabase.
2. Abrir SQL Editor.
3. Ejecutar `database/schema.sql`.
4. Crear el primer usuario desde Supabase Auth.
5. Crear un equipo y asociar miembros en `team_members`.
6. Conectar la app con las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` o `DATABASE_URL`.

La app actual sigue funcionando local con `localStorage`. El siguiente paso es cambiar las funciones de guardado para usar estas tablas cuando existan credenciales de Supabase.
