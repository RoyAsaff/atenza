-- Permite eliminar una evaluación (opción nueva para el docente, p.ej.
-- deshacer una lanzada por error) sin que las tablas dependientes bloqueen
-- el borrado con una violación de FK: ahora cascadean.
--   evaluaciones -> preguntas -> opciones (ya cascadeaba) -> respuestas
--   evaluaciones -> intentos -> respuestas / incidentes / notas

-- DropForeignKey
ALTER TABLE "incidentes" DROP CONSTRAINT "incidentes_intento_id_fkey";

-- DropForeignKey
ALTER TABLE "intentos" DROP CONSTRAINT "intentos_evaluacion_id_fkey";

-- DropForeignKey
ALTER TABLE "notas" DROP CONSTRAINT "notas_intento_id_fkey";

-- DropForeignKey
ALTER TABLE "preguntas" DROP CONSTRAINT "preguntas_evaluacion_id_fkey";

-- DropForeignKey
ALTER TABLE "respuestas" DROP CONSTRAINT "respuestas_intento_id_fkey";

-- DropForeignKey
ALTER TABLE "respuestas" DROP CONSTRAINT "respuestas_opcion_id_fkey";

-- DropForeignKey
ALTER TABLE "respuestas" DROP CONSTRAINT "respuestas_pregunta_id_fkey";

-- AddForeignKey
ALTER TABLE "preguntas" ADD CONSTRAINT "preguntas_evaluacion_id_fkey" FOREIGN KEY ("evaluacion_id") REFERENCES "evaluaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentos" ADD CONSTRAINT "intentos_evaluacion_id_fkey" FOREIGN KEY ("evaluacion_id") REFERENCES "evaluaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas" ADD CONSTRAINT "respuestas_intento_id_fkey" FOREIGN KEY ("intento_id") REFERENCES "intentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas" ADD CONSTRAINT "respuestas_pregunta_id_fkey" FOREIGN KEY ("pregunta_id") REFERENCES "preguntas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas" ADD CONSTRAINT "respuestas_opcion_id_fkey" FOREIGN KEY ("opcion_id") REFERENCES "opciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes" ADD CONSTRAINT "incidentes_intento_id_fkey" FOREIGN KEY ("intento_id") REFERENCES "intentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_intento_id_fkey" FOREIGN KEY ("intento_id") REFERENCES "intentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
