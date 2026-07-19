-- CreateEnum
CREATE TYPE "TipoPlan" AS ENUM ('mensual', 'anual');

-- DropIndex
DROP INDEX "pagos_materia_id_key";

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "fecha_expira" TIMESTAMP(3),
ADD COLUMN     "tipo_plan" "TipoPlan" NOT NULL DEFAULT 'mensual';

-- AlterTable
ALTER TABLE "precios" ADD COLUMN     "tipo" "TipoPlan" NOT NULL DEFAULT 'mensual';

-- CreateIndex
CREATE INDEX "pagos_materia_id_estado_idx" ON "pagos"("materia_id", "estado");
