-- CreateEnum
CREATE TYPE "TipoIncidenteCodigo" AS ENUM ('perdida_foco', 'ventana_minimizada', 'intento_cierre');

-- AlterTable
ALTER TABLE "planes" ADD COLUMN     "permite_examenes_codigo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "examenes_codigo" (
    "id" SERIAL NOT NULL,
    "tema" TEXT NOT NULL,
    "clase_id" INTEGER NOT NULL,
    "nota" INTEGER NOT NULL,
    "estado" "EstadoEvaluacion" NOT NULL DEFAULT 'borrador',
    "tiempo_limite_minutos" INTEGER,
    "fecha_lanzamiento" TIMESTAMP(3),
    "publicada" BOOLEAN NOT NULL DEFAULT false,
    "fecha_publicacion" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "examenes_codigo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ejercicios" (
    "id" SERIAL NOT NULL,
    "enunciado" TEXT NOT NULL,
    "plantilla_codigo" TEXT,
    "examen_codigo_id" INTEGER NOT NULL,
    "nota" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "ejercicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casos_prueba" (
    "id" SERIAL NOT NULL,
    "ejercicio_id" INTEGER NOT NULL,
    "entrada" TEXT NOT NULL,
    "salida_esperada" TEXT NOT NULL,
    "es_oculto" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "casos_prueba_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intentos_codigo" (
    "id" SERIAL NOT NULL,
    "examen_codigo_id" INTEGER NOT NULL,
    "estudiante_id" INTEGER NOT NULL,
    "estado" "EstadoIntento" NOT NULL DEFAULT 'en_curso',
    "orden_ejercicios" JSONB NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_limite" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),

    CONSTRAINT "intentos_codigo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respuestas_codigo" (
    "id" SERIAL NOT NULL,
    "intento_id" INTEGER NOT NULL,
    "ejercicio_id" INTEGER NOT NULL,
    "codigo_fuente" TEXT NOT NULL,
    "casos_acertados" INTEGER NOT NULL,
    "casos_totales" INTEGER NOT NULL,
    "resultado_json" JSONB NOT NULL,
    "respondida_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respuestas_codigo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidentes_codigo" (
    "id" SERIAL NOT NULL,
    "intento_id" INTEGER NOT NULL,
    "tipo" "TipoIncidenteCodigo" NOT NULL,
    "detalle" TEXT,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidentes_codigo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_codigo" (
    "id" SERIAL NOT NULL,
    "intento_id" INTEGER NOT NULL,
    "examen_codigo_id" INTEGER NOT NULL,
    "estudiante_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "casos_acertados" INTEGER NOT NULL,
    "casos_totales" INTEGER NOT NULL,
    "nota_obtenida" DOUBLE PRECISION NOT NULL,
    "calculada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_codigo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "examenes_codigo_clase_id_idx" ON "examenes_codigo"("clase_id");

-- CreateIndex
CREATE INDEX "ejercicios_examen_codigo_id_orden_idx" ON "ejercicios"("examen_codigo_id", "orden");

-- CreateIndex
CREATE INDEX "casos_prueba_ejercicio_id_orden_idx" ON "casos_prueba"("ejercicio_id", "orden");

-- CreateIndex
CREATE INDEX "intentos_codigo_examen_codigo_id_idx" ON "intentos_codigo"("examen_codigo_id");

-- CreateIndex
CREATE INDEX "intentos_codigo_estudiante_id_idx" ON "intentos_codigo"("estudiante_id");

-- CreateIndex
CREATE UNIQUE INDEX "intentos_codigo_examen_codigo_id_estudiante_id_key" ON "intentos_codigo"("examen_codigo_id", "estudiante_id");

-- CreateIndex
CREATE UNIQUE INDEX "respuestas_codigo_intento_id_ejercicio_id_key" ON "respuestas_codigo"("intento_id", "ejercicio_id");

-- CreateIndex
CREATE INDEX "incidentes_codigo_intento_id_idx" ON "incidentes_codigo"("intento_id");

-- CreateIndex
CREATE INDEX "notas_codigo_examen_codigo_id_idx" ON "notas_codigo"("examen_codigo_id");

-- CreateIndex
CREATE INDEX "notas_codigo_estudiante_id_idx" ON "notas_codigo"("estudiante_id");

-- AddForeignKey
ALTER TABLE "examenes_codigo" ADD CONSTRAINT "examenes_codigo_clase_id_fkey" FOREIGN KEY ("clase_id") REFERENCES "clases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejercicios" ADD CONSTRAINT "ejercicios_examen_codigo_id_fkey" FOREIGN KEY ("examen_codigo_id") REFERENCES "examenes_codigo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos_prueba" ADD CONSTRAINT "casos_prueba_ejercicio_id_fkey" FOREIGN KEY ("ejercicio_id") REFERENCES "ejercicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentos_codigo" ADD CONSTRAINT "intentos_codigo_examen_codigo_id_fkey" FOREIGN KEY ("examen_codigo_id") REFERENCES "examenes_codigo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentos_codigo" ADD CONSTRAINT "intentos_codigo_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas_codigo" ADD CONSTRAINT "respuestas_codigo_intento_id_fkey" FOREIGN KEY ("intento_id") REFERENCES "intentos_codigo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas_codigo" ADD CONSTRAINT "respuestas_codigo_ejercicio_id_fkey" FOREIGN KEY ("ejercicio_id") REFERENCES "ejercicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes_codigo" ADD CONSTRAINT "incidentes_codigo_intento_id_fkey" FOREIGN KEY ("intento_id") REFERENCES "intentos_codigo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_codigo" ADD CONSTRAINT "notas_codigo_intento_id_fkey" FOREIGN KEY ("intento_id") REFERENCES "intentos_codigo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
