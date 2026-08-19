-- Backfill (18/08): la migración 20260817194040_saas_plan_unico_promociones
-- desactivó los 3 tramos legados (Básico/Intermedio/Avanzado, "activo" =
-- false) a favor del plan único "Gratis" (permanente, tipo='gratuito'),
-- pero nunca reasignó `usuarios.plan_id` de los docentes que estaban en
-- esos planes legados — quedó anotado como pendiente en CONTEXTO.md y
-- solo se corrigió a mano para las cuentas de prueba locales.
--
-- Efecto del bug: ObtenerEstadoCuenta solo toma la rama sin expiración
-- cuando `plan.tipo === 'gratuito'`; un docente que sigue apuntando al
-- Básico legado (tipo='pago', solo desactivado) cae en la rama de plan
-- de pago y mira `Pago.fecha_expira` — de ahí que siga viendo el banner
-- "Tu plan vence en X días" (o quede en solo lectura) aunque ya debería
-- estar en el plan Gratis sin vencimiento.
--
-- UPDATE ... FROM con una subconsulta de a lo sumo 1 fila: si "Gratis"
-- no existiera todavía (no debería pasar — la migración anterior más el
-- seed ya la crean), la subconsulta no aporta filas y el UPDATE no toca
-- nada, en vez de dejar `plan_id` en NULL.
UPDATE "usuarios"
SET "plan_id" = "gratis"."id"
FROM (SELECT "id" FROM "planes" WHERE "nombre" = 'Gratis' LIMIT 1) AS "gratis"
WHERE "usuarios"."plan_id" IN (
  SELECT "id" FROM "planes" WHERE "nombre" IN ('Básico', 'Intermedio', 'Avanzado')
);
