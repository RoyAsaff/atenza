-- CreateEnum
CREATE TYPE "EstadoIntento" AS ENUM ('en_curso', 'pausado', 'finalizado', 'desconectado', 'cancelado');

-- CreateEnum
CREATE TYPE "TipoIncidente" AS ENUM ('salida_pantalla');

-- AlterTable
ALTER TABLE "evaluaciones" ADD COLUMN     "fecha_lanzamiento" TIMESTAMP(3),
ADD COLUMN     "tiempo_limite_minutos" INTEGER;

-- CreateTable
CREATE TABLE "intentos" (
    "id" SERIAL NOT NULL,
    "evaluacion_id" INTEGER NOT NULL,
    "estudiante_id" INTEGER NOT NULL,
    "estado" "EstadoIntento" NOT NULL DEFAULT 'en_curso',
    "orden_preguntas" JSONB NOT NULL,
    "orden_opciones" JSONB NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_limite" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),

    CONSTRAINT "intentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respuestas" (
    "id" SERIAL NOT NULL,
    "intento_id" INTEGER NOT NULL,
    "pregunta_id" INTEGER NOT NULL,
    "opcion_id" INTEGER NOT NULL,
    "respondida_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respuestas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidentes" (
    "id" SERIAL NOT NULL,
    "intento_id" INTEGER NOT NULL,
    "tipo" "TipoIncidente" NOT NULL,
    "detalle" TEXT,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidentes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intentos_evaluacion_id_idx" ON "intentos"("evaluacion_id");

-- CreateIndex
CREATE INDEX "intentos_estudiante_id_idx" ON "intentos"("estudiante_id");

-- CreateIndex
CREATE UNIQUE INDEX "intentos_evaluacion_id_estudiante_id_key" ON "intentos"("evaluacion_id", "estudiante_id");

-- CreateIndex
CREATE UNIQUE INDEX "respuestas_intento_id_pregunta_id_key" ON "respuestas"("intento_id", "pregunta_id");

-- CreateIndex
CREATE INDEX "incidentes_intento_id_idx" ON "incidentes"("intento_id");

-- AddForeignKey
ALTER TABLE "intentos" ADD CONSTRAINT "intentos_evaluacion_id_fkey" FOREIGN KEY ("evaluacion_id") REFERENCES "evaluaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentos" ADD CONSTRAINT "intentos_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas" ADD CONSTRAINT "respuestas_intento_id_fkey" FOREIGN KEY ("intento_id") REFERENCES "intentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas" ADD CONSTRAINT "respuestas_pregunta_id_fkey" FOREIGN KEY ("pregunta_id") REFERENCES "preguntas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas" ADD CONSTRAINT "respuestas_opcion_id_fkey" FOREIGN KEY ("opcion_id") REFERENCES "opciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes" ADD CONSTRAINT "incidentes_intento_id_fkey" FOREIGN KEY ("intento_id") REFERENCES "intentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
