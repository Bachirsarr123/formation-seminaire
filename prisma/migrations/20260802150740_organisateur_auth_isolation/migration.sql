-- AlterTable
ALTER TABLE "cabinet" ADD COLUMN     "jeton_flux_ics" TEXT;

-- AlterTable
ALTER TABLE "inscription" ADD COLUMN     "jeton_regenere_le" TIMESTAMP(3),
ADD COLUMN     "jeton_regenere_par_id" TEXT;

-- CreateEnum
CREATE TYPE "type_jeton_action" AS ENUM ('REINITIALISATION_MOT_DE_PASSE', 'CONNEXION_FORMATEUR');

-- CreateTable
CREATE TABLE "session_organisateur" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_organisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jeton_action_utilisateur" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "type" "type_jeton_action" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "utilise_le" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jeton_action_utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tentative_connexion_organisateur" (
    "id" TEXT NOT NULL,
    "email_normalise" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "dernier_echec_le" TIMESTAMP(3),
    "bloque_jusqua" TIMESTAMP(3),

    CONSTRAINT "tentative_connexion_organisateur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cabinet_jeton_flux_ics_key" ON "cabinet"("jeton_flux_ics");

-- CreateIndex
CREATE UNIQUE INDEX "session_organisateur_token_hash_key" ON "session_organisateur"("token_hash");

-- CreateIndex
CREATE INDEX "session_organisateur_utilisateur_id_idx" ON "session_organisateur"("utilisateur_id");

-- CreateIndex
CREATE UNIQUE INDEX "jeton_action_utilisateur_token_hash_key" ON "jeton_action_utilisateur"("token_hash");

-- CreateIndex
CREATE INDEX "jeton_action_utilisateur_utilisateur_id_type_idx" ON "jeton_action_utilisateur"("utilisateur_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "tentative_connexion_organisateur_email_normalise_ip_key" ON "tentative_connexion_organisateur"("email_normalise", "ip");

-- AddForeignKey
ALTER TABLE "inscription" ADD CONSTRAINT "inscription_jeton_regenere_par_id_fkey" FOREIGN KEY ("jeton_regenere_par_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_organisateur" ADD CONSTRAINT "session_organisateur_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jeton_action_utilisateur" ADD CONSTRAINT "jeton_action_utilisateur_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
