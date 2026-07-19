-- CreateTable
CREATE TABLE "clases" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "hora" VARCHAR(5) NOT NULL,
    "tema" TEXT NOT NULL,
    "materia_id" INTEGER NOT NULL,

    CONSTRAINT "clases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clases_materia_id_fecha_idx" ON "clases"("materia_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "clases_materia_id_fecha_hora_key" ON "clases"("materia_id", "fecha", "hora");

-- AddForeignKey
ALTER TABLE "clases" ADD CONSTRAINT "clases_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
