-- AlterTable
ALTER TABLE "materias" ADD COLUMN     "codigo_activo" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "inscripciones" (
    "id" SERIAL NOT NULL,
    "estudiante_id" INTEGER NOT NULL,
    "materia_id" INTEGER NOT NULL,
    "codigo_estudiante" TEXT NOT NULL,
    "fecha_inscripcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retirado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_retiro" TIMESTAMP(3),

    CONSTRAINT "inscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inscripciones_materia_id_retirado_idx" ON "inscripciones"("materia_id", "retirado");

-- CreateIndex
CREATE UNIQUE INDEX "inscripciones_estudiante_id_materia_id_key" ON "inscripciones"("estudiante_id", "materia_id");

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
