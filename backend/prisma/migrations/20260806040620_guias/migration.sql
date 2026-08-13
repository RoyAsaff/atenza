-- CreateTable
CREATE TABLE "guias" (
    "id" SERIAL NOT NULL,
    "clase_id" INTEGER NOT NULL,
    "tema" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "guias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guias_completadas" (
    "id" SERIAL NOT NULL,
    "guia_id" INTEGER NOT NULL,
    "estudiante_id" INTEGER NOT NULL,
    "completado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guias_completadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guias_clase_id_idx" ON "guias"("clase_id");

-- CreateIndex
CREATE UNIQUE INDEX "guias_completadas_guia_id_estudiante_id_key" ON "guias_completadas"("guia_id", "estudiante_id");

-- AddForeignKey
ALTER TABLE "guias" ADD CONSTRAINT "guias_clase_id_fkey" FOREIGN KEY ("clase_id") REFERENCES "clases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_completadas" ADD CONSTRAINT "guias_completadas_guia_id_fkey" FOREIGN KEY ("guia_id") REFERENCES "guias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_completadas" ADD CONSTRAINT "guias_completadas_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
