-- CreateEnum
CREATE TYPE "TipoPlan" AS ENUM ('gratuito', 'pago', 'institucional');

-- CreateEnum
CREATE TYPE "TipoDescuentoPromocion" AS ENUM ('porcentaje', 'monto_fijo');

-- CreateEnum
CREATE TYPE "CicloAplicablePromocion" AS ENUM ('mensual', 'anual', 'ambos');

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "monto_lista" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "promocion_id" INTEGER;

-- AlterTable
ALTER TABLE "planes" ADD COLUMN     "limite_materias" INTEGER,
ADD COLUMN     "permite_guias" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permite_import_word" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipo" "TipoPlan" NOT NULL DEFAULT 'pago';

-- AlterTable
ALTER TABLE "usuarios" DROP COLUMN "trial_inicio";

-- CreateTable
CREATE TABLE "promociones" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "tipo_descuento" "TipoDescuentoPromocion" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "ciclo_aplicable" "CicloAplicablePromocion" NOT NULL DEFAULT 'ambos',
    "combinable_con_anual" BOOLEAN NOT NULL DEFAULT true,
    "solo_cuentas_nuevas" BOOLEAN NOT NULL DEFAULT false,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "usos_maximos" INTEGER,
    "usos_maximos_por_cuenta" INTEGER,
    "usos_actuales" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "promociones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promociones_codigo_key" ON "promociones"("codigo");

-- CreateIndex
CREATE INDEX "promociones_codigo_idx" ON "promociones"("codigo");

-- CreateIndex
CREATE INDEX "promociones_activo_fecha_inicio_fecha_fin_idx" ON "promociones"("activo", "fecha_inicio", "fecha_fin");

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_promocion_id_fkey" FOREIGN KEY ("promocion_id") REFERENCES "promociones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

