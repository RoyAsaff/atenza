-- CreateEnum
CREATE TYPE "CicloPago" AS ENUM ('mensual', 'anual');

-- DropForeignKey
ALTER TABLE "pagos" DROP CONSTRAINT "pagos_materia_id_fkey";

-- DropIndex
DROP INDEX "pagos_materia_id_estado_idx";

-- SaaS por cuenta (17/07): el modelo de pago por materia se reemplaza por
-- completo (confirmado con Roy, sin materias de pago activas en producción).
-- Los pagos existentes son de prueba/dev y no mapean a ningún Plan nuevo,
-- así que se limpian antes de agregar la columna plan_id (NOT NULL).
DELETE FROM "pagos";

-- AlterTable
ALTER TABLE "materias" DROP COLUMN "activado";

-- AlterTable
ALTER TABLE "pagos" DROP COLUMN "materia_id",
DROP COLUMN "tipo_plan",
ADD COLUMN     "ciclo" "CicloPago" NOT NULL DEFAULT 'mensual',
ADD COLUMN     "plan_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "plan_id" INTEGER,
ADD COLUMN     "trial_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "precios";

-- DropEnum
DROP TYPE "TipoPlan";

-- CreateTable
CREATE TABLE "planes" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "limite_estudiantes" INTEGER,
    "monto_mensual" DECIMAL(10,2) NOT NULL,
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "planes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_pago" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "url_qr" TEXT NOT NULL,

    CONSTRAINT "configuracion_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pagos_usuario_id_estado_idx" ON "pagos"("usuario_id", "estado");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "planes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "planes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
