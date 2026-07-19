-- Ejecutar DESPUÉS de cada "prisma migrate dev" (como usuario postgres):
--   docker exec -i atenza-db psql -U postgres -d atenza < db/grants.sql
--
-- Implementa la decisión D-10 (HU-29): el rol de la aplicación solo puede
-- INSERTAR en la bitácora; ni UPDATE ni DELETE, ni siquiera para el admin.

GRANT USAGE ON SCHEMA public TO atenza_app;

-- Permisos generales sobre todas las tablas
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO atenza_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO atenza_app;

-- Bitácora: append-only real a nivel de BD
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE bitacora FROM atenza_app;
