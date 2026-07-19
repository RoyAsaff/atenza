-- AlterTable
ALTER TABLE "evaluaciones" ADD COLUMN     "fecha_publicacion" TIMESTAMP(3),
ADD COLUMN     "publicada" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "notas" (
    "id" SERIAL NOT NULL,
    "intento_id" INTEGER NOT NULL,
    "evaluacion_id" INTEGER NOT NULL,
    "estudiante_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "aciertos" INTEGER NOT NULL,
    "total_preguntas" INTEGER NOT NULL,
    "nota_obtenida" DOUBLE PRECISION NOT NULL,
    "calculada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notas_evaluacion_id_idx" ON "notas"("evaluacion_id");

-- CreateIndex
CREATE INDEX "notas_estudiante_id_idx" ON "notas"("estudiante_id");

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_intento_id_fkey" FOREIGN KEY ("intento_id") REFERENCES "intentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
