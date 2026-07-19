-- CreateEnum
CREATE TYPE "EstadoEvaluacion" AS ENUM ('borrador', 'lista', 'lanzada', 'finalizada');

-- CreateTable
CREATE TABLE "evaluaciones" (
    "id" SERIAL NOT NULL,
    "tema" TEXT NOT NULL,
    "clase_id" INTEGER NOT NULL,
    "nota" INTEGER NOT NULL,
    "estado" "EstadoEvaluacion" NOT NULL DEFAULT 'borrador',

    CONSTRAINT "evaluaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preguntas" (
    "id" SERIAL NOT NULL,
    "pregunta" TEXT NOT NULL,
    "url_imagen" TEXT,
    "evaluacion_id" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "preguntas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opciones" (
    "id" SERIAL NOT NULL,
    "texto" TEXT NOT NULL,
    "pregunta_id" INTEGER NOT NULL,
    "es_correcta" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "opciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluaciones_clase_id_idx" ON "evaluaciones"("clase_id");

-- CreateIndex
CREATE INDEX "preguntas_evaluacion_id_orden_idx" ON "preguntas"("evaluacion_id", "orden");

-- CreateIndex
CREATE INDEX "opciones_pregunta_id_idx" ON "opciones"("pregunta_id");

-- AddForeignKey
ALTER TABLE "evaluaciones" ADD CONSTRAINT "evaluaciones_clase_id_fkey" FOREIGN KEY ("clase_id") REFERENCES "clases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preguntas" ADD CONSTRAINT "preguntas_evaluacion_id_fkey" FOREIGN KEY ("evaluacion_id") REFERENCES "evaluaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opciones" ADD CONSTRAINT "opciones_pregunta_id_fkey" FOREIGN KEY ("pregunta_id") REFERENCES "preguntas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
