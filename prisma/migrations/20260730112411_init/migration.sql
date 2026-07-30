-- CreateEnum
CREATE TYPE "role_utilisateur" AS ENUM ('ORGANISATEUR', 'FORMATEUR');

-- CreateEnum
CREATE TYPE "modalite" AS ENUM ('PRESENTIEL', 'DISTANCIEL', 'HYBRIDE');

-- CreateEnum
CREATE TYPE "statut_seminaire" AS ENUM ('BROUILLON', 'PUBLIE', 'EN_COURS', 'CLOTURE', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "role_formateur" AS ENUM ('PRINCIPAL', 'INTERVENANT');

-- CreateEnum
CREATE TYPE "statut_inscription" AS ENUM ('EN_ATTENTE', 'CONFIRMEE', 'REFUSEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "source_inscription" AS ENUM ('IMPORT', 'MANUEL', 'AUTO_INSCRIPTION');

-- CreateEnum
CREATE TYPE "statut_questionnaire" AS ENUM ('BROUILLON', 'PUBLIE', 'FERME');

-- CreateEnum
CREATE TYPE "type_question" AS ENUM ('NOTE_5', 'NOTE_10', 'ECHELLE_4', 'QCM_UNIQUE', 'QCM_MULTIPLE', 'TEXTE_LIBRE', 'OUI_NON', 'NPS');

-- CreateEnum
CREATE TYPE "statut_message" AS ENUM ('NOUVEAU', 'LU', 'TRAITE');

-- CreateTable
CREATE TABLE "cabinet" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "logo_url" TEXT,
    "couleur_primaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cabinet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateur" (
    "id" TEXT NOT NULL,
    "cabinet_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "role" "role_utilisateur" NOT NULL,
    "mot_de_passe_hash" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seminaire" (
    "id" TEXT NOT NULL,
    "cabinet_id" TEXT NOT NULL,
    "code_public" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3) NOT NULL,
    "lieu" TEXT,
    "modalite" "modalite" NOT NULL,
    "duree_heures" DOUBLE PRECISION NOT NULL,
    "capacite_max" INTEGER,
    "statut" "statut_seminaire" NOT NULL DEFAULT 'BROUILLON',
    "inscription_ouverte" BOOLEAN NOT NULL DEFAULT false,
    "validation_requise" BOOLEAN NOT NULL DEFAULT false,
    "seuil_anonymat" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supprime_le" TIMESTAMP(3),

    CONSTRAINT "seminaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module" (
    "id" TEXT NOT NULL,
    "seminaire_id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "duree_minutes" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL,

    CONSTRAINT "module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seminaire_formateur" (
    "seminaire_id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "role_formateur" "role_formateur" NOT NULL,

    CONSTRAINT "seminaire_formateur_pkey" PRIMARY KEY ("seminaire_id","utilisateur_id")
);

-- CreateTable
CREATE TABLE "participant" (
    "id" TEXT NOT NULL,
    "cabinet_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "fonction" TEXT,
    "organisation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscription" (
    "id" TEXT NOT NULL,
    "seminaire_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "jeton" TEXT NOT NULL,
    "statut" "statut_inscription" NOT NULL DEFAULT 'EN_ATTENTE',
    "source" "source_inscription" NOT NULL,
    "date_inscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jeton_expire_le" TIMESTAMP(3),
    "a_repondu" BOOLEAN NOT NULL DEFAULT false,
    "a_repondu_le" DATE,

    CONSTRAINT "inscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaire" (
    "id" TEXT NOT NULL,
    "seminaire_id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "date_limite" TIMESTAMP(3),
    "statut" "statut_questionnaire" NOT NULL DEFAULT 'BROUILLON',
    "supprime_le" TIMESTAMP(3),

    CONSTRAINT "questionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section" (
    "id" TEXT NOT NULL,
    "questionnaire_id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "ordre" INTEGER NOT NULL,

    CONSTRAINT "section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "module_id" TEXT,
    "intitule" TEXT NOT NULL,
    "description" TEXT,
    "type" "type_question" NOT NULL,
    "obligatoire" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL,
    "options" JSONB,
    "supprime_le" TIMESTAMP(3),

    CONSTRAINT "question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soumission" (
    "id" TEXT NOT NULL,
    "questionnaire_id" TEXT NOT NULL,
    "jour_soumission" DATE NOT NULL DEFAULT CURRENT_DATE,

    CONSTRAINT "soumission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reponse" (
    "id" TEXT NOT NULL,
    "soumission_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "valeur_numerique" DOUBLE PRECISION,
    "valeur_texte" TEXT,
    "valeur_options" JSONB,

    CONSTRAINT "reponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_anonyme" (
    "id" TEXT NOT NULL,
    "seminaire_id" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "jour_envoi" DATE NOT NULL DEFAULT CURRENT_DATE,
    "code_suivi_hash" TEXT NOT NULL,
    "statut" "statut_message" NOT NULL DEFAULT 'NOUVEAU',
    "reponse_organisateur" TEXT,
    "date_reponse" TIMESTAMP(3),

    CONSTRAINT "message_anonyme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_email_key" ON "utilisateur"("email");

-- CreateIndex
CREATE INDEX "utilisateur_cabinet_id_idx" ON "utilisateur"("cabinet_id");

-- CreateIndex
CREATE UNIQUE INDEX "seminaire_code_public_key" ON "seminaire"("code_public");

-- CreateIndex
CREATE INDEX "seminaire_cabinet_id_idx" ON "seminaire"("cabinet_id");

-- CreateIndex
CREATE INDEX "module_seminaire_id_idx" ON "module"("seminaire_id");

-- CreateIndex
CREATE INDEX "participant_cabinet_id_idx" ON "participant"("cabinet_id");

-- CreateIndex
CREATE UNIQUE INDEX "inscription_jeton_key" ON "inscription"("jeton");

-- CreateIndex
CREATE INDEX "inscription_seminaire_id_idx" ON "inscription"("seminaire_id");

-- CreateIndex
CREATE INDEX "inscription_participant_id_idx" ON "inscription"("participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "inscription_seminaire_id_participant_id_key" ON "inscription"("seminaire_id", "participant_id");

-- CreateIndex
CREATE INDEX "questionnaire_seminaire_id_idx" ON "questionnaire"("seminaire_id");

-- CreateIndex
CREATE INDEX "section_questionnaire_id_idx" ON "section"("questionnaire_id");

-- CreateIndex
CREATE INDEX "question_section_id_idx" ON "question"("section_id");

-- CreateIndex
CREATE INDEX "question_module_id_idx" ON "question"("module_id");

-- CreateIndex
CREATE INDEX "soumission_questionnaire_id_idx" ON "soumission"("questionnaire_id");

-- CreateIndex
CREATE INDEX "reponse_soumission_id_idx" ON "reponse"("soumission_id");

-- CreateIndex
CREATE INDEX "reponse_question_id_idx" ON "reponse"("question_id");

-- CreateIndex
CREATE INDEX "message_anonyme_seminaire_id_idx" ON "message_anonyme"("seminaire_id");

-- AddForeignKey
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seminaire" ADD CONSTRAINT "seminaire_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module" ADD CONSTRAINT "module_seminaire_id_fkey" FOREIGN KEY ("seminaire_id") REFERENCES "seminaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seminaire_formateur" ADD CONSTRAINT "seminaire_formateur_seminaire_id_fkey" FOREIGN KEY ("seminaire_id") REFERENCES "seminaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seminaire_formateur" ADD CONSTRAINT "seminaire_formateur_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant" ADD CONSTRAINT "participant_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscription" ADD CONSTRAINT "inscription_seminaire_id_fkey" FOREIGN KEY ("seminaire_id") REFERENCES "seminaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscription" ADD CONSTRAINT "inscription_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire" ADD CONSTRAINT "questionnaire_seminaire_id_fkey" FOREIGN KEY ("seminaire_id") REFERENCES "seminaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section" ADD CONSTRAINT "section_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question" ADD CONSTRAINT "question_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question" ADD CONSTRAINT "question_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soumission" ADD CONSTRAINT "soumission_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponse" ADD CONSTRAINT "reponse_soumission_id_fkey" FOREIGN KEY ("soumission_id") REFERENCES "soumission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponse" ADD CONSTRAINT "reponse_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_anonyme" ADD CONSTRAINT "message_anonyme_seminaire_id_fkey" FOREIGN KEY ("seminaire_id") REFERENCES "seminaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraint
-- Non exprimable dans le DSL Prisma : au moins un moyen de contact requis
-- (beaucoup de participants ne sont joignables que par WhatsApp/téléphone).
ALTER TABLE "participant" ADD CONSTRAINT "participant_contact_requis"
  CHECK (email IS NOT NULL OR telephone IS NOT NULL);
