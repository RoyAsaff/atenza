-- CreateEnum
CREATE TYPE "TipoTokenUsuario" AS ENUM ('verificacion_email', 'reset_password');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "email_verificado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "tokens_usuario" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "tipo" "TipoTokenUsuario" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "usado_en" TIMESTAMP(3),

    CONSTRAINT "tokens_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tokens_usuario_token_hash_key" ON "tokens_usuario"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_usuario_usuario_id_tipo_idx" ON "tokens_usuario"("usuario_id", "tipo");

-- AddForeignKey
ALTER TABLE "tokens_usuario" ADD CONSTRAINT "tokens_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
