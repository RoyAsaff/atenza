-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('puntual', 'atrasado', 'licencia', 'falta');

-- CreateTable
CREATE TABLE "asistencias" (
    "id" SERIAL NOT NULL,
    "clase_id" INTEGER NOT NULL,
    "estudiante_id" INTEGER NOT NULL,
    "marcaje" "EstadoAsistencia" NOT NULL,

    CONSTRAINT "asistencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asistencias_estudiante_id_idx" ON "asistencias"("estudiante_id");

-- CreateIndex
CREATE UNIQUE INDEX "asistencias_clase_id_estudiante_id_key" ON "asistencias"("clase_id", "estudiante_id");

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_clase_id_fkey" FOREIGN KEY ("clase_id") REFERENCES "clases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
