-- CreateEnum
CREATE TYPE "type_recueil_question" AS ENUM ('TEXTE_LIBRE', 'CHOIX_UNIQUE', 'CHOIX_MULTIPLE');

-- AlterTable
ALTER TABLE "cabinet" ADD COLUMN     "adresse" TEXT;

-- CreateTable
CREATE TABLE "recueil" (
    "id" TEXT NOT NULL,
    "seminaire_id" TEXT NOT NULL,
    "cabinet_id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "code_acces" TEXT NOT NULL,
    "code_consultation" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recueil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recueil_question" (
    "id" TEXT NOT NULL,
    "recueil_id" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "type" "type_recueil_question" NOT NULL,
    "options" JSONB,
    "ordre" INTEGER NOT NULL,

    CONSTRAINT "recueil_question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recueil_reponse" (
    "id" TEXT NOT NULL,
    "recueil_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "fonction" TEXT,
    "organisation" TEXT,
    "reponses" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recueil_reponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recueil_seminaire_id_key" ON "recueil"("seminaire_id");

-- CreateIndex
CREATE UNIQUE INDEX "recueil_code_acces_key" ON "recueil"("code_acces");

-- CreateIndex
CREATE UNIQUE INDEX "recueil_code_consultation_key" ON "recueil"("code_consultation");

-- CreateIndex
CREATE INDEX "recueil_cabinet_id_idx" ON "recueil"("cabinet_id");

-- CreateIndex
CREATE INDEX "recueil_question_recueil_id_idx" ON "recueil_question"("recueil_id");

-- CreateIndex
CREATE INDEX "recueil_reponse_recueil_id_idx" ON "recueil_reponse"("recueil_id");

-- AddForeignKey
ALTER TABLE "recueil" ADD CONSTRAINT "recueil_seminaire_id_fkey" FOREIGN KEY ("seminaire_id") REFERENCES "seminaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recueil" ADD CONSTRAINT "recueil_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recueil_question" ADD CONSTRAINT "recueil_question_recueil_id_fkey" FOREIGN KEY ("recueil_id") REFERENCES "recueil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recueil_reponse" ADD CONSTRAINT "recueil_reponse_recueil_id_fkey" FOREIGN KEY ("recueil_id") REFERENCES "recueil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
