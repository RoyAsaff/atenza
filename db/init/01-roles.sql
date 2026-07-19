-- Se ejecuta solo la primera vez que se crea el contenedor.
-- Rol de la aplicación en runtime (decisión D-10):
-- las migraciones corren como "postgres"; la API corre como "atenza_app",
-- que NUNCA tendrá UPDATE/DELETE sobre la bitácora.
CREATE ROLE atenza_app LOGIN PASSWORD 'atenza_app_dev';
GRANT CONNECT ON DATABASE atenza TO atenza_app;
