-- CreateEnum
CREATE TYPE "EstadoGuia" AS ENUM ('publicada', 'lanzada', 'cerrada', 'externa_legacy');

-- CreateEnum
CREATE TYPE "TipoGuiaPregunta" AS ENUM ('automatica', 'abierta');

-- AlterTable
ALTER TABLE "guias" ADD COLUMN     "estado" "EstadoGuia" NOT NULL DEFAULT 'publicada',
ADD COLUMN     "nota" DOUBLE PRECISION,
ADD COLUMN     "tiempo_limite_minutos" INTEGER;

-- CreateTable
CREATE TABLE "guias_preguntas" (
    "id" SERIAL NOT NULL,
    "guia_id" INTEGER NOT NULL,
    "referencia" TEXT NOT NULL,
    "tipo" "TipoGuiaPregunta" NOT NULL,
    "respuesta_modelo" TEXT,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "guias_preguntas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guias_intentos" (
    "id" SERIAL NOT NULL,
    "guia_id" INTEGER NOT NULL,
    "estudiante_id" INTEGER NOT NULL,
    "estado" "EstadoIntento" NOT NULL DEFAULT 'en_curso',
    "es_oficial" BOOLEAN NOT NULL,
    "numero_intento" INTEGER NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_limite" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),

    CONSTRAINT "guias_intentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guias_respuestas" (
    "id" SERIAL NOT NULL,
    "guia_intento_id" INTEGER NOT NULL,
    "guia_pregunta_id" INTEGER NOT NULL,
    "correcta" BOOLEAN,
    "texto_libre" TEXT,
    "respondida_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisada_en" TIMESTAMP(3),
    "revisada_por_id" INTEGER,

    CONSTRAINT "guias_respuestas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guias_incidentes" (
    "id" SERIAL NOT NULL,
    "guia_intento_id" INTEGER NOT NULL,
    "tipo" "TipoIncidente" NOT NULL,
    "detalle" TEXT,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guias_incidentes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guias_preguntas_guia_id_idx" ON "guias_preguntas"("guia_id");

-- CreateIndex
CREATE UNIQUE INDEX "guias_preguntas_guia_id_referencia_key" ON "guias_preguntas"("guia_id", "referencia");

-- CreateIndex
CREATE INDEX "guias_intentos_guia_id_idx" ON "guias_intentos"("guia_id");

-- CreateIndex
CREATE INDEX "guias_intentos_estudiante_id_idx" ON "guias_intentos"("estudiante_id");

-- CreateIndex
CREATE UNIQUE INDEX "guias_respuestas_guia_intento_id_guia_pregunta_id_key" ON "guias_respuestas"("guia_intento_id", "guia_pregunta_id");

-- CreateIndex
CREATE INDEX "guias_incidentes_guia_intento_id_idx" ON "guias_incidentes"("guia_intento_id");

-- AddForeignKey
ALTER TABLE "guias_preguntas" ADD CONSTRAINT "guias_preguntas_guia_id_fkey" FOREIGN KEY ("guia_id") REFERENCES "guias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_intentos" ADD CONSTRAINT "guias_intentos_guia_id_fkey" FOREIGN KEY ("guia_id") REFERENCES "guias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_intentos" ADD CONSTRAINT "guias_intentos_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_respuestas" ADD CONSTRAINT "guias_respuestas_guia_intento_id_fkey" FOREIGN KEY ("guia_intento_id") REFERENCES "guias_intentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_respuestas" ADD CONSTRAINT "guias_respuestas_guia_pregunta_id_fkey" FOREIGN KEY ("guia_pregunta_id") REFERENCES "guias_preguntas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_respuestas" ADD CONSTRAINT "guias_respuestas_revisada_por_id_fkey" FOREIGN KEY ("revisada_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_incidentes" ADD CONSTRAINT "guias_incidentes_guia_intento_id_fkey" FOREIGN KEY ("guia_intento_id") REFERENCES "guias_intentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DataFix: las guías creadas antes de este cambio (todas, hoy) quedaron con
-- "estado" en 'publicada' por el DEFAULT de la columna nueva — no es lo que
-- son. No tienen nota (columna nueva, siempre null en las viejas), así que
-- ese es el marcador correcto para dejarlas en su estado real: externas,
-- solo booleano, sin intentos ni lanzamiento.
UPDATE "guias" SET "estado" = 'externa_legacy' WHERE "nota" IS NULL;
